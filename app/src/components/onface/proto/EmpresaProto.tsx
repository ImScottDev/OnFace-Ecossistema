"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Ficha da Empresa — o adaptador.
 *
 * Como a ficha da Pessoa, a tela do handoff é centrada em LEAD: é dele que
 * vêm contato, origem e etapa. O que muda aqui é o ponto de entrada — a rota
 * recebe o id da EMPRESA — então o adaptador resolve o lead principal dela.
 *
 * Com `registro` preenchido, o desenho usa o ramo que lê o dado recebido; sem
 * ele, cairia num ramo de demonstração com "Ricardo Alves" e telefones fixos.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ROTULO_ETAPA_PRE_VENDAS } from "@/lib/vendas/dominio";
import type { DetalheLead, Empresa360 } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { EmpresaLiga } from "./EmpresaLiga";
import { levarParametros } from "./rota-do-desenho";
import { registroDoDesenho } from "./registro-do-desenho";
import { usePecas } from "./pecas-host";

class EmpresaLigada extends EmpresaLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
  }
}

export function EmpresaProto({ empresa, lead, timeline }: {
  empresa: Empresa360;
  /** O lead principal da empresa, quando existe: é dele que vem o contato. */
  lead: DetalheLead | null;
  timeline: LinhaDoTempo[];
}) {
  const router = useRouter();

  /**
   * O registro que a ficha lê.
   *
   * Sem lead, a empresa existe na base sem conversa nenhuma — e é isso que a
   * tela deve mostrar. O registro vai com os campos da empresa e o contato
   * vazio, em vez de um contato de exemplo.
   */
  const registro = React.useMemo(() => {
    const base = lead ? registroDoDesenho(lead) : null;
    return {
      /* Data real de criação do lead: a ficha mostrava "Hoje"/data fixa. */
      criadoEm: lead?.criadoEm ?? null,
      ...(base ?? {
        id: empresa.id, registro: empresa.id, pessoa: "Sem contato", cargo: "",
        email: null, tel: null, whatsapp: null, linkedin: null, tags: [],
        etapa: "novo", rel: "Contato", resp: null, origem: null, campanha: null,
        interesse: null, acao: null, venceEm: null, dias: 0,
      }),
      // A empresa canônica vence o que o lead guardava: é o cadastro.
      empresa: empresa.nome,
      empresaId: empresa.id,
      cnpj: empresa.cnpj,
      cidade: [empresa.cidade, empresa.estado].filter(Boolean).join(" / ") || null,
      segmento: empresa.setor,
      site: empresa.website,
    };
  }, [empresa, lead]);

  const catalogo = React.useMemo(() => ({
    EQUIPE: registro.resp ? [registro.resp] : [],
    /* `ETAPAS` é o que dá o chip de etapa no cabeçalho — sem ele a ficha
       mostrava "—" no lugar de "Em contato". */
    ETAPAS: Object.fromEntries(
      Object.entries(ROTULO_ETAPA_PRE_VENDAS).map(([k, label]) => [k, { label }]),
    ),
    LEADS: [], CONVERSAS: [], CADENCIAS: [], SEGMENTOS: [],
  }), [registro.resp]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "pessoa" && id) { router.push(`/pessoas/${id}`); return; }
    if (peca === "oportunidade" && id) { router.push(`/pipeline/${id}`); return; }
    /* Sem lead, o registro da ficha leva o id da EMPRESA — não é lead para a peça abrir. */
    const idDaPeca = !lead && id === empresa.id ? null : id;
    abrirPeca(peca, idDaPeca, { tela: "empresa", empresaId: empresa.id, empresa: empresa.nome, leadId: lead?.id ?? null });
  }, [router, abrirPeca, empresa.id, empresa.nome, lead?.id]);

  const gravar = React.useCallback(() => {
    toast("Editar a empresa ainda não está ligado nesta tela.");
    router.refresh();
  }, [router]);

  return (
    <div data-workspace="desenho">
      <EmpresaLigada
        /* `empresas[nome]` é de onde a ficha lê tags, segmento e porte —
           `empresaDados(nome)` no protótipo. Sem esta entrada as tags reais
           do lead não chegavam à tela. */
        dados={{
          leads: [registro],
          eventos: timeline,
          empresas: { [empresa.nome]: {
            tags: registro.tags,
            segmento: empresa.setor,
            porte: empresa.porte,
            cidade: [empresa.cidade, empresa.estado].filter(Boolean).join(" / ") || undefined,
            site: empresa.website,
          } },
        }}
        catalogo={catalogo}
        abrir={abrir}
        gravar={gravar}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
