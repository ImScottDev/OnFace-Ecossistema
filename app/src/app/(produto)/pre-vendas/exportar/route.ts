import { NextResponse, type NextRequest } from "next/server";
import { getTenantContext } from "@/lib/auth/tenant";
import { boardPreVendas, ehView, type CardPreVendas, type ViewPreVendas } from "@/lib/vendas/consultas";

export const dynamic = "force-dynamic";

/**
 * Exportação de Pré-vendas em CSV.
 *
 * Duas regras que a spec pede e que esta rota cumpre no servidor, onde elas
 * não dependem do cliente ter se comportado:
 *
 * 1. **Respeita o recorte.** Os mesmos parâmetros da tela entram na mesma
 *    consulta. Exportar num board filtrado por campanha e receber os 3.989
 *    registros seria pior do que não exportar.
 * 2. **Respeita o tenant.** `organizacaoId` vem da sessão, nunca da URL.
 *
 * Só saem os campos que o board já mostra. Documento e endereço ficam de fora
 * de propósito: uma planilha que sai do CRM circula por e-mail, e a spec (§27)
 * proíbe exportar campo sem autorização.
 */

/** Escapa um valor para CSV. */
function celula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  // Aspas, ponto-e-vírgula e quebra de linha quebram a coluna se passarem
  // crus — nome de campanha real da Callface tem os três.
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Coluna da planilha: a chave que a tela manda, o cabeçalho e como ler o card.
 *
 * A ordem aqui é a ordem da planilha, e ela não muda com a ordem em que a
 * pessoa marcou as caixas — planilha que sai com coluna em ordem diferente a
 * cada exportação não dá para comparar com a anterior. */
const COLUNAS: Array<{
  chave: string;
  titulo: string;
  ler: (c: CardPreVendas, etapa: string) => string | number | null | undefined;
}> = [
  { chave: "empresa", titulo: "Empresa", ler: (c) => c.empresa },
  { chave: "pessoa", titulo: "Contato", ler: (c) => c.pessoa },
  { chave: "cargo", titulo: "Cargo", ler: (c) => c.cargo },
  /* Telefone, WhatsApp e e-mail: é o que a planilha serve para fazer — ligar
     e escrever. Os campos já vinham na consulta (ver `CardPreVendas`), mas
     nunca viraram coluna, e a exportação saía sem como falar com ninguém.
     Decisão do Scott em 19/10/2026. Documento e endereço seguem de fora. */
  { chave: "telefone", titulo: "Telefone", ler: (c) => c.telefone },
  { chave: "whatsapp", titulo: "WhatsApp", ler: (c) => c.whatsapp },
  { chave: "email", titulo: "E-mail", ler: (c) => c.email },
  { chave: "etapa", titulo: "Etapa", ler: (_c, etapa) => etapa },
  { chave: "responsavel", titulo: "Responsável", ler: (c) => c.responsavel },
  { chave: "origem", titulo: "Origem", ler: (c) => c.origem },
  { chave: "campanha", titulo: "Campanha", ler: (c) => c.campanha },
  { chave: "interesse", titulo: "Interesse", ler: (c) => c.servicos?.join(", ") },
  { chave: "qualificado", titulo: "Qualificado", ler: (c) => (c.qualificado ? "Sim" : "Não") },
  { chave: "dias", titulo: "Dias parado", ler: (c) => (c.horasNaEtapa == null ? null : Math.floor(c.horasNaEtapa / 24)) },
  { chave: "acao", titulo: "Próxima ação", ler: (c) => c.proximaAcao?.titulo },
  { chave: "vence", titulo: "Próxima ação vence em", ler: (c) => c.proximaAcao?.venceEm },
  { chave: "criado", titulo: "Criado em", ler: (c) => c.criadoEm },
];

export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return new NextResponse("Não autenticado.", { status: 401 });

  const p = request.nextUrl.searchParams;
  const view: ViewPreVendas = ehView(p.get("view")) ? (p.get("view") as ViewPreVendas) : "todos";

  /* Teto alto de propósito: a TELA corta em 400 porque ninguém rola 4.000
     cartões, mas planilha cortada em 400 de um board de milhares mente sem
     avisar — quem abre não tem como saber que faltou. */
  const dados = await boardPreVendas(ctx.organizacaoId, {
    limite: 50_000,
    porColuna: 50_000,
    busca: p.get("busca"),
    responsavelId: p.get("responsavel"),
    origem: p.get("origem"),
    campanha: p.get("campanha"),
    desde: p.get("desde"),
    view,
    usuarioId: ctx.userId,
  });

  /* Quais colunas entram.
   *
   * Sem o parâmetro, entram todas — é o que a exportação da visão atual faz, e
   * é o comportamento que existia antes desta rota aceitar escolha. Chave
   * desconhecida é ignorada em silêncio: a planilha não é lugar de erro de
   * digitação de query string. */
  const pedidas = p.get("colunas")?.split(",").filter(Boolean);
  const colunas = pedidas?.length
    ? COLUNAS.filter((c) => pedidas.includes(c.chave))
    : COLUNAS;

  /* Quais leads entram.
   *
   * Com `ids`, só eles — é o caminho "selecionar na tela". O recorte da
   * consulta continua valendo por cima, então um id de outra organização não
   * entra mesmo que alguém o coloque na URL. */
  const ids = p.get("ids")?.split(",").filter(Boolean);
  const somente = ids?.length ? new Set(ids) : null;

  const linhas = dados.colunas.flatMap((coluna) =>
    coluna.cards
      .filter((c) => !somente || somente.has(c.leadId))
      .map((c) => colunas.map((col) => celula(col.ler(c, coluna.rotulo))).join(";")),
  );

  // BOM + ponto-e-vírgula: é o que o Excel em pt-BR abre com acento correto e
  // em colunas separadas. Sem isso a planilha chega como uma coluna só com
  // "PrÃ©-vendas" na primeira célula.
  const csv = `﻿${colunas.map((c) => c.titulo).join(";")}\n${linhas.join("\n")}`;
  const dia = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pre-vendas-${dia}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
