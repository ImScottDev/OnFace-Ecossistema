"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Iniciar relação — o adaptador da peça (OnFace Iniciar Relacao.dc.html).
 *
 * A Liga é a do handoff, intocada. Três trocas, todas aqui:
 *  1. O barramento: no protótipo a peça escuta `assinarPecas`; aqui ela já
 *     nasce aberta, com o contexto que o hospedeiro trouxe.
 *  2. O dado: pessoas e relacionamento vêm da Empresa 360 (derivado, não o
 *     que a tela supôs), equipe e cadências da organização.
 *  3. O "concluir": em vez de empurrar um lead/opp inventado no store, chama
 *     os commands — `acaoCriarLead` (Pré-vendas) ou `acaoCriarOportunidade`
 *     (Pipeline, criação direta) — e leva ao registro criado.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useOrdemDaEquipe } from "./equipe-do-proto";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  acaoCriarLead, acaoEmMassa, acaoMoverEtapa, acaoOpcoesEmMassa, acaoResponsaveis,
} from "@/app/(produto)/pre-vendas/actions";
import { acaoCriarOportunidade } from "@/app/(produto)/pipeline/actions";
import { acaoContextoDaEmpresa } from "@/app/(produto)/empresas/actions";
import type { Familia, Motion, RelacionamentoEmpresa } from "@/lib/vendas/dominio";
import { IniciarRelacaoLiga } from "./IniciarRelacaoLiga";
import type { PecaProps } from "./pecas-host";

/** Os chips de origem que o desenho oferece — origem fora deles não fica pré-marcada invisível. */
const ORIGENS = ["Meta Ads", "Instagram", "Site", "Formulário", "WhatsApp", "Orgânica"];

const REL: Record<RelacionamentoEmpresa, string> = {
  cadastrada: "Contato", ex_cliente: "Contato",
  em_pre_vendas: "Lead", em_oportunidade: "Lead", cliente: "Cliente",
};

const MOTION: Record<string, Motion> = {
  nova: "NEW_BUSINESS", expansao: "EXPANSION", upgrade: "EXPANSION", renovacao: "RENEWAL",
};

interface Pessoa { id: string; fonte: "pessoa" | "lead"; nome: string; cargo: string | null; email: string | null; telefone: string | null }

export interface Formulario {
  contato: string; origem: string; etapa: "novo" | "em_contato" | "qualificacao";
  resp: string; interesse: string; cadencia: string; tipo: string; familia: Familia; motivo: string;
}

class IniciarRelacaoLigada extends IniciarRelacaoLiga {
  _gravando = false;

  constructor(props: any) {
    super(props);
    const E = (this as any).E;
    // O barramento do protótipo, resolvido na hora: a peça já nasce aberta.
    E.assinarPecas = (cb: (peca: string, ctx: any) => void) => { cb("iniciarRelacao", props.ctxInicial); return null; };
  }

  diz(texto: string, tom?: string) {
    if (tom === "erro") toast.error(texto); else toast(texto);
  }

  componentDidMount() {
    super.componentDidMount();
    const { EQUIPE: equipe, CADENCIAS: cadencias } = (this as any).props.catalogo;
    const eu = (this as any).eu;
    // O que a Liga preenche com nome de exemplo ("Camila Reis", "Primeiro contato") vira dado da organização.
    (this as any).setState((s: any) => ({
      f: {
        ...s.f,
        origem: ORIGENS.includes(s.f.origem) ? s.f.origem : "",
        resp: equipe.includes(s.f.resp) ? s.f.resp : equipe.includes(eu) ? eu : (equipe[0] ?? ""),
        cadencia: cadencias.includes(s.f.cadencia) ? s.f.cadencia : "",
      },
    }));
  }

  componentDidUpdate(_p: any, antes: any) {
    // Esc, fundo ou "x" zeram o ctx: é a peça saindo.
    if (antes.ctx && !(this as any).state.ctx) (this as any).props.fechar();
  }

  async concluir() {
    if (this._gravando) return;
    const S = (this as any).state;
    this._gravando = true;
    this.forceUpdate();
    try {
      await (this as any).props.concluir(S.cam, S.f);
    } finally {
      this._gravando = false;
      this.forceUpdate();
    }
  }

  renderVals() {
    const v: any = super.renderVals();
    if (!v.aberto || (this as any).state.passo !== 2) return v;
    v.avancar = () => this.concluir();
    if (this._gravando) { v.avancarTxt = "Gravando…"; v.avancarStyle += ";opacity:.6;cursor:wait"; }
    return v;
  }
}

export default function IniciarRelacaoPecaProto({ contexto, fechar, gravou }: PecaProps) {
  const router = useRouter();
  const empresaId = typeof contexto.empresaId === "string" ? contexto.empresaId : null;
  const leadDaTela = typeof contexto.leadId === "string" ? contexto.leadId : null;

  const [carga, setCarga] = React.useState<{
    nome: string; rel: string; pessoas: Pessoa[];
    equipe: Array<{ id: string; nome: string }>; cadencias: Array<{ id: string; nome: string }>;
  } | null>(null);

  React.useEffect(() => {
    if (!empresaId) {
      toast("Sem empresa vinculada — associe a empresa antes de iniciar uma relação.", { id: "iniciar-relacao" });
      fechar();
      return;
    }
    let vivo = true;
    Promise.all([acaoContextoDaEmpresa(empresaId), acaoResponsaveis(), acaoOpcoesEmMassa()]).then(([e, equipe, op]) => {
      if (!vivo) return;
      if (!e.ok || !e.dados) { toast.error(e.ok ? "Empresa não encontrada." : e.erro); fechar(); return; }
      setCarga({
        nome: e.dados.nome,
        // Quem já é lead nesta tela é ao menos Lead, mesmo que a empresa esteja "cadastrada".
        rel: REL[e.dados.relacionamento] === "Contato" && leadDaTela ? "Lead" : REL[e.dados.relacionamento],
        pessoas: e.dados.pessoas.filter((p) => p.nome),
        equipe,
        cadencias: op.ok ? op.dados?.cadencias ?? [] : [],
      });
    }, () => { if (vivo) { toast.error("Não consegui abrir a empresa."); fechar(); } });
    return () => { vivo = false; };
  }, [empresaId, leadDaTela, fechar]);

  const ctxInicial = React.useMemo(() => {
    if (!carga) return null;
    const pessoa = typeof contexto.pessoa === "string" && contexto.pessoa.trim() ? contexto.pessoa : null;
    const pessoas = carga.pessoas.map((p) => ({ nome: p.nome, cargo: p.cargo ?? "", email: p.email ?? "", tel: p.telefone ?? "" }));
    // A pessoa da ficha entra mesmo sem vínculo com a empresa — só o nome: o resto que a tela traz pode ser exemplo.
    if (pessoa && !pessoas.some((p) => p.nome === pessoa)) pessoas.unshift({ nome: pessoa, cargo: "", email: "", tel: "" });
    return {
      empresa: carga.nome,
      pessoas,
      pessoa,
      resp: typeof contexto.resp === "string" ? contexto.resp : null,
      origem: typeof contexto.origem === "string" ? contexto.origem : null,
      rel: carga.rel,
    };
  }, [carga, contexto]);

  const ordenarEquipe = useOrdemDaEquipe();
  const catalogo = React.useMemo(() => ({
    EQUIPE: ordenarEquipe(carga?.equipe.map((r) => r.nome) ?? []),
    CADENCIAS: carga?.cadencias.map((c) => c.nome) ?? [],
  }), [carga, ordenarEquipe]);

  const concluir = React.useCallback(async (cam: "pv" | "opp", f: Formulario) => {
    if (!carga || !empresaId) return;
    const p = carga.pessoas.find((x) => x.nome === f.contato);
    const responsavelId = carga.equipe.find((r) => r.nome === f.resp)?.id ?? null;

    if (cam === "pv") {
      const r = await acaoCriarLead({
        empresa: carga.nome, empresaId, pessoaNome: f.contato, cargo: p?.cargo ?? null,
        email: p?.email ?? null, telefone: p?.telefone ?? null,
        origem: f.origem, responsavelId, servicosInteresse: f.interesse ? [f.interesse] : null,
      });
      if (!r.ok || !r.dados) { toast.error(r.ok ? "Não consegui criar o lead." : r.erro); return; }
      const leadId = r.dados.leadId;
      const avisos: string[] = [];
      if (f.etapa !== "novo") {
        const m = await acaoMoverEtapa(leadId, f.etapa);
        if (!m.ok) avisos.push(`etapa: ${m.erro}`);
      }
      const cad = f.cadencia ? carga.cadencias.find((c) => c.nome === f.cadencia) : null;
      if (cad) {
        const c = await acaoEmMassa("incluir_em_cadencia", [leadId], cad.id);
        const item = c.ok ? c.dados?.itens?.[0] : null;
        if (!c.ok) avisos.push(`cadência: ${c.erro}`);
        else if (item && item.desfecho !== "aplicado") avisos.push(`cadência: ${item.motivo ?? item.desfecho}`);
      }
      toast.success(`${f.contato} enviado ao Pré-vendas`);
      if (avisos.length) toast.error(`Lead criado, mas ${avisos.join("; ")}`);
      gravou(); fechar();
      router.push(`/pessoas/${leadId}`);
      return;
    }

    if (!responsavelId) { toast.error("Escolha o responsável comercial."); return; }
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(10, 0, 0, 0);
    const leadId = p?.fonte === "lead" ? p.id : (leadDaTela && f.contato === contexto.pessoa ? leadDaTela : null);
    const r = await acaoCriarOportunidade({
      empresaId, familias: [f.familia], responsavelId, leadId,
      motion: MOTION[f.tipo] ?? "NEW_BUSINESS",
      proximaAcao: "Agendar reunião de diagnóstico", proximaAcaoEm: amanha.toISOString(),
    });
    if (!r.ok || !r.dados?.ids?.[0]) { toast.error(r.ok ? "Não consegui criar a oportunidade." : r.erro); return; }
    const negocioId = r.dados.ids[0];
    // A primeira nota interna: o "por que já vai para o Pipeline".
    const nota = await fetch("/api/notas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudo: f.motivo.trim(), negocioId }),
    }).catch(() => null);
    toast.success("Oportunidade criada no Pipeline");
    if (!nota?.ok) toast.error("A oportunidade foi criada, mas a nota com o motivo não foi gravada.");
    gravou(); fechar();
    router.push(`/pipeline/${negocioId}`);
  }, [carga, empresaId, leadDaTela, contexto.pessoa, gravou, fechar, router]);

  if (!ctxInicial) return null;

  return (
    <IniciarRelacaoLigada
      ctxInicial={ctxInicial}
      dados={{ leads: [{ empresa: carga!.nome, origem: ctxInicial.origem }] }}
      catalogo={catalogo}
      concluir={concluir}
      fechar={fechar}
      ir={(href: string) => router.push(href)}
    />
  );
}
