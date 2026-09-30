"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Pré-vendas — o adaptador.
 *
 * Três peças, nesta ordem:
 *
 *   PreVendasDesenho.tsx  o markup, convertido por máquina do Claude Design
 *   PreVendasLiga.tsx     a lógica do protótipo, portada por substituição
 *   PreVendasProto.tsx    ESTE: traduz o domínio para a forma que o desenho
 *                         consome, e liga os overlays nas ações reais
 *
 * Só este arquivo foi escrito à mão, e de propósito: traduzir `CardPreVendas`
 * para o lead do desenho é julgamento (qual campo vira qual), e julgamento não
 * se automatiza. O markup e a lógica não foram transcritos, então não há
 * divergência visual para procurar neles.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { BoardPreVendas, CardPreVendas, DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import type { AcoesPreVendas } from "../vendas/PreVendas";
import { PreVendasLiga } from "./PreVendasLiga";
import { PecasLiga } from "./PecasLiga";
import { type CanalAtendimento } from "../vendas/atendimento";

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

/**
 * O lead do banco na forma que o protótipo espera.
 *
 * O desenho foi feito sobre um mock com campos próprios (`resp`, `dias`,
 * `acao`, `venceEm`). Traduzir aqui, num lugar só, é o que permite o markup
 * ficar intocado: ele continua lendo os nomes que sempre leu.
 */
/** O lead na forma que o desenho consome. */
export interface LeadDoDesenho {
  id: string; empresa: string | null; pessoa: string; cargo: string;
  resp: string | null; dias: number; origem: string | null; campanha: string | null;
  interesse: string | null; tag: string | null; acao: string | null;
  venceEm: string | null; etapa: string;
  telefone?: string | null; whatsapp?: string | null; email?: string | null;
  empresaId?: string | null;
}

export type PecaDoDesenho = "detalhe" | "qualificar" | "nutrir" | "desqualificar";

function paraODesenho(c: CardPreVendas): LeadDoDesenho {
  return {
    id: c.leadId,
    // O desenho trata empresa vazia como ausente e escreve "Sem empresa" —
    // e é isso que destrava a regra de Oportunidade, que exige conta.
    empresa: c.empresa && c.empresa !== "Empresa não informada" ? c.empresa : null,
    pessoa: c.pessoa ?? "Sem contato",
    cargo: c.cargo ?? "",
    resp: c.responsavel,
    // `dias` no desenho é tempo parado, que aqui é horas sem interação.
    dias: c.horasSemInteracao == null ? 0 : Math.floor(c.horasSemInteracao / 24),
    origem: c.origem,
    campanha: c.campanha,
    interesse: c.servicos?.[0] ?? null,
    // O protótipo tem UMA tag por cartão; o domínio traz a lista de serviços.
    tag: c.servicos && c.servicos.length > 1 ? c.servicos[1] : null,
    telefone: c.temTelefone ? "sim" : null,
    whatsapp: c.temWhatsapp ? "sim" : null,
    email: c.temEmail ? "sim" : null,
    empresaId: c.empresaId,
    acao: c.proximaAcao?.titulo ?? null,
    venceEm: c.proximaAcao?.venceEm ? quando(c.proximaAcao.venceEm) : null,
    etapa: c.etapa,
  };
}

/** "hoje", "amanhã", "3d" — o vocabulário curto que o cartão usa. */
function quando(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(d) - dia(new Date())) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias < 0 ? `${Math.abs(dias)}d atrás` : `em ${dias}d`;
}

function iniciais(nome: string | null) {
  if (!nome) return "—";
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function PreVendasProto({ dados, acoes }: {
  dados: BoardPreVendas;
  acoes: AcoesPreVendas;
}) {
  const router = useRouter();

  const todos = React.useMemo(
    () => dados.colunas.flatMap((c) => c.cards),
    [dados.colunas],
  );
  const leads = React.useMemo(() => todos.map(paraODesenho), [todos]);

  /* As PEÇAS do protótipo — gaveta, qualificação, nutrição, desqualificação,
     atividade, tags, cadência — vêm de `OnFace Pecas.dc.html`, convertidas.
     Antes eram as versões recriadas à mão (`vendas/GavetaLead`,
     `vendas/SaidasLead`), e era daí que vinha boa parte da divergência.

     O protótipo as abre por um barramento; aqui a `ref` faz esse papel: a
     tela chama `abrirPeca`, que é o método do protótipo, intocado. */
  const pecas = React.useRef<PecasLiga>(null);

  const abrir = React.useCallback((peca: PecaDoDesenho, id: string) => {
    pecas.current?.abrirPeca(peca, id);
  }, []);

  /**
   * Os três toques da gaveta: registra o contato E abre o canal.
   *
   * Registrar sozinho era meio caminho, e do lado de quem usa parecia
   * quebrado: o toast dizia "conversa aberta no Atendimento" e nada abria.
   *
   * A conversa certa é resolvida por `urlAtendimento`, a porta única do
   * produto — `wa.me` e `mailto:` jogam o operador para fora e deixam o
   * histórico do lead com um buraco no momento em que alguém falou com ele.
   */
  const falar = React.useCallback(async (canal: CanalAtendimento, leadId: string) => {
    const card = todos.find((c) => c.leadId === leadId);
    if (!card) return;

    /* A URL sai do `leadId`, não do número.
     *
     * `urlAtendimento` exige o telefone e o board não o carrega — só sabe SE
     * existe (`temTelefone`). Passar um placeholder para satisfazer a função
     * fazia ela devolver `null` na validação de 10 dígitos, e o botão não
     * levava a lugar nenhum.
     *
     * Quem resolve a conversa certa é o Atendimento, a partir do lead: é assim
     * que o deep link do Negócio sempre funcionou. O que o board precisa saber
     * é apenas se há canal para abrir. */
    const temCanal = canal === "email" ? card.temEmail : (card.temTelefone || card.temWhatsapp);
    if (!temCanal) {
      toast(`Este contato não tem ${canal === "email" ? "e-mail" : "telefone"} cadastrado.`);
      return;
    }
    const destino = `/atendimento?canal=${canal}&leadId=${encodeURIComponent(leadId)}`;

    // Antes da navegação: depois do push este componente desmonta e a
    // promessa ficaria órfã.
    await acoes.registrarContato(leadId, canal);
    router.push(destino);
  }, [todos, acoes, router]);

  return (
    <>
      {/* `data-workspace="desenho"`: a tela traz o próprio fundo e o leva até
          a borda, então a casca tira o recuo de 24/28px. Sem isto sobrava uma
          moldura branca em volta e o quadro chegava cortado na direita. */}
      <div data-workspace="desenho">
        <PreVendasLiga dados={{ leads }} abrir={abrir} ir={(href: string) => router.push(href)} />
      </div>

      <PecasLiga
        ref={pecas}
        dados={{ leads }}
        leads={leads}
        ir={(href: string) => router.push(href)}
        aoGravar={() => router.refresh()}
        falar={falar}
      />

    </>
  );
}
