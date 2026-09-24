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

import type { BoardPreVendas, CardPreVendas, DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import type { AcoesPreVendas } from "../vendas/PreVendas";
import { PreVendasLiga, type LeadDoDesenho, type PecaDoDesenho } from "./PreVendasLiga";
import { PecasLiga } from "./PecasLiga";

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

/**
 * O lead do banco na forma que o protótipo espera.
 *
 * O desenho foi feito sobre um mock com campos próprios (`resp`, `dias`,
 * `acao`, `venceEm`). Traduzir aqui, num lugar só, é o que permite o markup
 * ficar intocado: ele continua lendo os nomes que sempre leu.
 */
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

  return (
    <>
      {/* `data-workspace="desenho"`: a tela traz o próprio fundo e o leva até
          a borda, então a casca tira o recuo de 24/28px. Sem isto sobrava uma
          moldura branca em volta e o quadro chegava cortado na direita. */}
      <div data-workspace="desenho">
        <PreVendasLiga leads={leads} abrir={abrir} ir={(href) => router.push(href)} />
      </div>

      <PecasLiga
        ref={pecas}
        leads={leads}
        ir={(href) => router.push(href)}
        aoGravar={() => router.refresh()}
      />

    </>
  );
}
