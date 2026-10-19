import { NextResponse, type NextRequest } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant";
import { boardPipeline, type CardPipeline } from "@/lib/vendas/consultas";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Exportação do Pipeline em CSV, feita NO SERVIDOR.
 *
 * Antes a planilha era montada no navegador, a partir dos cartões que a tela
 * tinha carregado. Duas consequências, as duas reclamadas em 19/10/2026:
 * saía só o que estava na tela (o board corta em 1.800, e a coluna fechada
 * nem carrega), e saía sem telefone e sem e-mail — porque o cartão não tem
 * esses campos, ele mostra empresa, valor e etapa.
 *
 * Aqui a consulta é a mesma da tela, com o mesmo recorte e o mesmo tenant,
 * mas com teto alto: planilha cortada mente sem avisar, e quem abre não tem
 * como saber que faltou. O contato vem de uma consulta à parte, por `leadId`,
 * para não encarecer o board que a tela usa a cada abertura.
 *
 * Documento e endereço seguem de fora (SPEC §27). Telefone, WhatsApp e e-mail
 * entram por decisão do Scott: é o que a planilha serve para fazer.
 */

function celula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

type Contato = { telefone: string | null; whatsapp: string | null; email: string | null };

const COLUNAS: Array<{
  titulo: string;
  ler: (c: CardPipeline, etapa: string, ct: Contato) => string | number | null | undefined;
}> = [
  { titulo: "Oportunidade", ler: (c) => c.titulo },
  { titulo: "Empresa", ler: (c) => c.empresa },
  { titulo: "Contato", ler: (c) => c.pessoa },
  { titulo: "Cargo", ler: (c) => c.cargo },
  { titulo: "Telefone", ler: (_c, _e, ct) => ct.telefone },
  { titulo: "WhatsApp", ler: (_c, _e, ct) => ct.whatsapp },
  { titulo: "E-mail", ler: (_c, _e, ct) => ct.email },
  { titulo: "Etapa", ler: (_c, etapa) => etapa },
  { titulo: "Família", ler: (c) => c.familiaRotulo },
  { titulo: "Valor", ler: (c) => c.valor },
  { titulo: "Responsável", ler: (c) => c.responsavel },
  { titulo: "Propostas", ler: (c) => c.propostas },
  { titulo: "Proposta (status)", ler: (c) => c.propostasLista.at(-1)?.status },
  { titulo: "Próxima ação", ler: (c) => c.proximaAcao },
  { titulo: "Próxima ação em", ler: (c) => c.proximaAcaoEm },
  { titulo: "Dias na etapa", ler: (c) => c.diasNaEtapa },
  { titulo: "Motivo da perda", ler: (c) => c.motivoPerda },
  { titulo: "Tags", ler: (c) => c.tags.join(", ") },
];

/** Telefone, WhatsApp e e-mail dos leads das oportunidades, de uma vez só.
 *
 *  Os ids vão como PARÂMETRO, nunca interpolados no texto do SQL: eles vêm do
 *  board e são uuid, mas montar SQL por concatenação é como se abre a porta
 *  que um dia alguém atravessa. */
async function contatosDosLeads(organizacaoId: string, leadIds: string[]): Promise<Map<string, Contato>> {
  const mapa = new Map<string, Contato>();
  if (!leadIds.length) return mapa;
  const linhas = await db
    .select({ id: leads.id, telefone: leads.telefone, whatsapp: leads.whatsapp, email: leads.email })
    .from(leads)
    .where(and(eq(leads.organizacaoId, organizacaoId), inArray(leads.id, leadIds)));
  for (const r of linhas) mapa.set(r.id, { telefone: r.telefone, whatsapp: r.whatsapp, email: r.email });
  return mapa;
}

const VAZIO: Contato = { telefone: null, whatsapp: null, email: null };

export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return new NextResponse("Não autenticado.", { status: 401 });

  const p = request.nextUrl.searchParams;
  const aba = p.get("aba");

  const dados = await boardPipeline(ctx.organizacaoId, {
    limite: 50_000,
    busca: p.get("busca"),
    responsavelId: p.get("responsavel"),
    familia: p.get("familia"),
    motion: p.get("motion"),
    semProximaAcao: p.get("semProximaAcao") === "1",
    aba: aba === "abertas" || aba === "ganhas" || aba === "perdidas" ? aba : null,
  });

  /* Todas as colunas entram, inclusive Ganho e Perdido — na tela elas vêm
     fechadas, e quem exporta quer o quadro inteiro, não o que estava aberto. */
  const cards = dados.colunas.flatMap((coluna) => coluna.cards.map((c) => ({ c, etapa: coluna.rotulo })));
  const ids = [...new Set(cards.map((x) => x.c.leadId).filter((x): x is string => !!x))];
  const contatos = await contatosDosLeads(ctx.organizacaoId, ids);

  const linhas = cards.map(({ c, etapa }) =>
    COLUNAS.map((col) => celula(col.ler(c, etapa, (c.leadId && contatos.get(c.leadId)) || VAZIO))).join(";"),
  );

  // BOM + ponto-e-vírgula: é o que o Excel em pt-BR abre com acento correto e
  // em colunas separadas.
  const csv = `﻿${COLUNAS.map((c) => c.titulo).join(";")}\n${linhas.join("\n")}`;
  const dia = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pipeline-${dia}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
