"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Ficha da Pessoa — o adaptador.
 *
 * A tela do handoff é centrada em LEAD: lê uma lista e escolhe o alvo. Aqui
 * ela recebe um lead só, o real, já achatado por `registroDoDesenho`.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ROTULO_ETAPA_PRE_VENDAS, ROTULO_FAMILIA, type Familia } from "@/lib/vendas/dominio";
import type { DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { PessoaLiga } from "./PessoaLiga";
import { levarParametros } from "./rota-do-desenho";
import { registroDoDesenho } from "./registro-do-desenho";
import { usePecas } from "./pecas-host";

/**
 * Corrige, na saída do protótipo, os campos que ele INVENTA.
 *
 * A ficha monta "linkedin.com/in/" + o nome quando o campo não vem, e usa
 * "+55 11 91234-5678" como telefone de exemplo. Os dois viram dado plausível e
 * errado na tela — e o botão "Abrir LinkedIn" leva ao perfil de outra pessoa.
 *
 * O valor é montado dentro de `renderVals`, que não tem gancho. Varrer a saída
 * e corrigir por RÓTULO é o que resolve sem tocar no arquivo gerado: a lista
 * de campos é a mesma estrutura em toda a tela, e o rótulo é o que o usuário
 * vê. Quando o handoff parar de inventar, isto fica inerte sozinho.
 */
function corrigirInventados(vals: any, reais: Record<string, string | null>): any {
  const visto = new Set<any>();

  const anda = (no: any): void => {
    if (!no || typeof no !== "object" || visto.has(no)) return;
    visto.add(no);

    if (Array.isArray(no)) { no.forEach(anda); return; }

    if (typeof no.label === "string" && Object.hasOwn(reais, no.label)) {
      const real = reais[no.label];
      no.valor = real ?? "—";
      // Sem valor não há o que abrir: o botão sairia para um endereço vazio.
      if (!real) { no.acao = undefined; no.acaoD = undefined; no.acaoTitulo = undefined; }
    }
    Object.values(no).forEach(anda);
  };

  anda(vals);
  return vals;
}

class PessoaLigada extends PessoaLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
  }

  renderVals() {
    const vals = super.renderVals();
    const r = (this as any).props.reais ?? {};
    /* O desenho só liga o relatório a "Ligação realizada|iniciada|recebida";
       o dado real chega como "Ligação finalizada — …" / "Ligação recebido". */
    const abrir = (this as any).props.abrir;
    vals.interacoes = (vals.interacoes ?? []).map((t: any) =>
      t.onClick || !/^Ligação (finalizada|recebid|enviad)/.test(t.titulo || "") ? t : {
        ...t, temRel: true, dica: "Abrir relatório da ligação",
        linha: `${t.linha};cursor:pointer`, hover: "background:var(--of-papel-alterno)",
        onClick: () => abrir?.("relatorio"),
      });
    /* A aba "Oportunidades" e o contador dela leem só o lead local
       (`etapa === "oportunidade"`), nunca as oportunidades gravadas. Aqui vêm
       do que a ficha carregou: as mesmas do card "Relações em andamento". */
    const reais: Array<{ titulo: string; etapa: string; familia: string }> = (this as any).props.oportunidades ?? [];
    vals.opps = reais.map((o) => ({
      titulo: o.titulo, meta: o.familia, etapa: o.etapa,
    }));
    vals.semOpps = reais.length === 0;
    const aba = (vals.abas ?? []).find((a: any) => a.label === "Oportunidades");
    if (aba) { aba.conta = String(reais.length); aba.temConta = reais.length > 0; }
    return corrigirInventados(vals, r);
  }
}

export function PessoaProto({ lead, timeline }: {
  lead: DetalheLead;
  timeline: LinhaDoTempo[];
}) {
  const router = useRouter();

  const registro = React.useMemo(() => ({ ...registroDoDesenho(lead), criadoEm: lead.criadoEm }), [lead]);

  const catalogo = React.useMemo(() => ({
    EQUIPE: lead.responsavel.nome ? [lead.responsavel.nome] : [],
    /* `ETAPAS` é o que dá o chip de etapa no cabeçalho — sem ele a ficha
       mostrava "—" no lugar de "Em contato". */
    ETAPAS: Object.fromEntries(
      Object.entries(ROTULO_ETAPA_PRE_VENDAS).map(([k, label]) => [k, { label }]),
    ),
    LEADS: [], CONVERSAS: [], CADENCIAS: [], SEGMENTOS: [],
    /* O card "Relações em andamento" pergunta por aqui. Sem esta função ele
       caía em `{ itens: [] }` e dizia "Nada em andamento" mesmo com
       oportunidade gravada. Abertas viram linha; perdidas só contam. Ganho
       é cliente (a Visão 360 mostra), não relação em andamento. */
    Relacoes: () => ({
      itens: lead.oportunidades
        .filter((o) => o.etapa !== "ganho" && o.etapa !== "perdido")
        .map((o) => ({
          k: "opp", tipo: "Oportunidade", titulo: o.titulo,
          sub: o.familia ? ROTULO_FAMILIA[o.familia as Familia] ?? o.familia : "Família a definir",
          status: o.etapaRotulo, tom: "coral",
          ir: () => router.push(`/pipeline/${o.id}`),
        })),
      perdidas: lead.oportunidades.filter((o) => o.etapa === "perdido").length,
    }),
  }), [lead.responsavel.nome, lead.oportunidades, router]);

  const oportunidades = React.useMemo(
    () => lead.oportunidades.map((o) => ({
      titulo: o.titulo, etapa: o.etapaRotulo,
      familia: o.familia ? ROTULO_FAMILIA[o.familia as Familia] ?? o.familia : "Família a definir",
    })),
    [lead.oportunidades],
  );

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "empresa" && id) { router.push(`/empresas/${id}`); return; }
    abrirPeca(peca, id, { tela: "pessoa", leadId: lead.id, empresaId: lead.empresa.id, empresa: lead.empresa.nome });
  }, [router, abrirPeca, lead.id, lead.empresa.id, lead.empresa.nome]);

  /* O que a ficha tenta gravar não tem command próprio: mudar etapa, nutrir e
     desqualificar acontecem no board de Pré-vendas, que é onde a regra mora.
     Avisar e reler é honesto; gravar pela metade não é. */
  const gravar = React.useCallback(() => {
    toast("Alterações do lead são feitas em Pré-vendas.", {
      action: { label: "Abrir Pré-vendas", onClick: () => router.push("/pre-vendas") },
    });
    router.refresh();
  }, [router]);

  return (
    <div data-workspace="desenho">
      <PessoaLigada
        dados={{ leads: [registro], eventos: timeline }}
        reais={{
          LinkedIn: registro.linkedin,
          Telefone: registro.tel,
          WhatsApp: registro.whatsapp,
          "E-mail": registro.email,
        }}
        catalogo={catalogo}
        oportunidades={oportunidades}
        abrir={abrir}
        gravar={gravar}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
