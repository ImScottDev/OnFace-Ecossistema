"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * As peças de `OnFace Pecas.dc.html` abertas por cima de QUALQUER tela.
 *
 * Pré-vendas hospeda as próprias (o board já tem os leads na mão). Aqui não:
 * a tela de baixo só sabe o id do lead, então o lead é lido pelo mesmo
 * caminho que a gaveta de Pré-vendas usa (`acaoDetalhe`), traduzido para a
 * forma do desenho, e a `PecasLigadas` — a mesma subclasse de Pré-vendas —
 * abre a peça pedida. Gravar passa pelos mesmos commands
 * (`executarIntencao`); nenhuma regra de negócio mora aqui.
 *
 * A peça fecha sozinha (Esc, fundo, botão): quando nenhum overlay da
 * PecasLiga está mais de pé, o hospedeiro tira o componente.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { DetalheLead } from "@/lib/vendas/consultas";
import { ROTULO_ETAPA_PRE_VENDAS } from "@/lib/vendas/dominio";
import {
  acaoAssociarEmpresa, acaoAtribuir, acaoAtribuirEmMassa, acaoCriarLead,
  acaoCriarOportunidade, acaoCriarTarefa, acaoDesqualificar, acaoDetalhe,
  acaoMoverEtapa, acaoNutrir, acaoQualificar, acaoReativar,
  acaoRegistrarContato, acaoResponsaveis, acaoSalvarQualificacao,
  acaoTagDoLead, acaoOpcoesEmMassa,
} from "@/app/(produto)/pre-vendas/actions";
import type { AcoesPreVendas } from "../vendas/PreVendas";
import type { CanalAtendimento } from "../vendas/atendimento";
import {
  executarIntencao, PecasLigadas, qualDoDesenho, quando, type LeadDoDesenho,
} from "./PreVendasProto";
import { intencoesDoPatch } from "./saidas-do-lead";
import { usePecas, type PecaProps } from "./pecas-host";

const ACOES: AcoesPreVendas = {
  moverEtapa: acaoMoverEtapa, qualificar: acaoQualificar, salvarQualificacao: acaoSalvarQualificacao,
  nutrir: acaoNutrir, desqualificar: acaoDesqualificar, reativar: acaoReativar,
  registrarContato: acaoRegistrarContato, atribuir: acaoAtribuir,
  criarOportunidade: acaoCriarOportunidade, criarLead: acaoCriarLead,
  associarEmpresa: acaoAssociarEmpresa, detalhe: acaoDetalhe, criarTarefa: acaoCriarTarefa,
  atribuirEmMassa: acaoAtribuirEmMassa, tag: acaoTagDoLead, tagsDaOrg: acaoOpcoesEmMassa,
};

const ETAPAS = Object.fromEntries(
  Object.entries(ROTULO_ETAPA_PRE_VENDAS).map(([k, label]) => [k, { label }]),
);

/** O detalhe do lead na forma do cartão do desenho — o par de `paraODesenho`. */
function doDetalhe(l: DetalheLead): LeadDoDesenho {
  return {
    id: l.id,
    empresa: l.empresa.nome !== "Empresa não informada" ? l.empresa.nome : null,
    empresaId: l.empresa.id,
    pessoa: l.pessoa.nome,
    cargo: l.pessoa.cargo ?? "",
    resp: l.responsavel.nome,
    // O detalhe não traz horas sem interação; 0 é "não sei", não um número inventado.
    dias: 0,
    origem: l.atribuicao.origem,
    campanha: l.atribuicao.campanha,
    interesse: l.servicos?.[0] ?? null,
    tag: l.tags[0]?.nome ?? null,
    telefone: l.pessoa.telefone ? "sim" : null,
    whatsapp: l.pessoa.whatsapp ? "sim" : null,
    email: l.pessoa.email ? "sim" : null,
    acao: l.proximaAcao?.titulo ?? null,
    venceEm: l.proximaAcao?.venceEm ? quando(l.proximaAcao.venceEm) : null,
    etapa: l.etapa,
  };
}

const OVERLAYS = ["detalhe", "nutrir", "desqAberto", "qualAberto", "vincAberto", "cadModal", "atvAberta"];

/** A mesma PecasLigadas, avisando o hospedeiro quando nada mais está aberto. */
class PecasGlobais extends PecasLigadas {
  _abriu = false;

  componentDidUpdate() {
    super.componentDidUpdate();
    const s: any = (this as any).state ?? {};
    if (OVERLAYS.some((k) => s[k])) this._abriu = true;
    else if (this._abriu) { this._abriu = false; (this as any).props.fechar?.(); }
  }

  /** Abre e, se a peça recusou abrir (ex.: oportunidade sem empresa), sai. */
  abrirGlobal(peca: string, leadId: string) {
    (this as any).abrirPeca(peca, leadId);
    setTimeout(() => { if (!this._abriu) (this as any).props.fechar?.(); }, 0);
  }
}

export default function PecasGlobalProto({ peca, id, contexto, fechar, gravou }: PecaProps) {
  const router = useRouter();
  const { abrir } = usePecas();
  const leadId = id ?? (typeof contexto.leadId === "string" ? contexto.leadId : null)
    ?? (typeof contexto.lead === "string" ? contexto.lead : null);

  const [carga, setCarga] = React.useState<{ detalhe: DetalheLead; equipe: Array<{ id: string; nome: string }> } | null>(null);

  React.useEffect(() => {
    if (!leadId) { toast("Sem lead vinculado — esta peça trabalha sobre um lead.", { id: "pecas-global" }); fechar(); return; }
    // Id que não é de lead (contato sem lead, id do protótipo): dizer, não consultar.
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) { toast("Este contato ainda não é lead no CRM.", { id: "pecas-global" }); fechar(); return; }
    let vivo = true;
    Promise.all([acaoDetalhe(leadId), acaoResponsaveis()]).then(([r, equipe]) => {
      if (!vivo) return;
      if (!r.ok || !r.dados?.lead) {
        toast.error(r.ok ? "Não encontrei este lead." : (r.erro ?? "Não consegui abrir o lead."));
        fechar();
        return;
      }
      setCarga({ detalhe: r.dados.lead, equipe });
    }, () => { if (vivo) { toast.error("Não consegui abrir o lead."); fechar(); } });
    return () => { vivo = false; };
  }, [leadId, fechar]);

  const lead = React.useMemo(() => (carga ? doDetalhe(carga.detalhe) : null), [carga]);
  const leads = React.useMemo(() => (lead ? [lead] : []), [lead]);
  /* A qualificação já gravada, para a peça abrir com o que alguém preencheu
     em vez de em branco. */
  const qual = React.useMemo(() => {
    const campos = lead ? qualDoDesenho(carga?.detalhe.qualificacao) : null;
    return campos && lead ? { [lead.id]: campos } : {};
  }, [lead, carga]);
  const catalogo = React.useMemo(() => ({
    EQUIPE: carga?.equipe.map((r) => r.nome) ?? [],
    ETAPAS,
  }), [carga]);
  const idDoResponsavel = React.useMemo(
    () => new Map((carga?.equipe ?? []).map((r) => [r.nome, r.id])),
    [carga],
  );

  const pecas = React.useRef<PecasGlobais>(null);
  const ultimos = React.useRef<any[] | null>(null);
  // Tags vivem em `tagsLead`, fora do patch `leads` — mesmo caso do Pré-vendas.
  const ultimasTags = React.useRef<Record<string, string[]>>({});
  React.useEffect(() => { ultimos.current = leads; }, [leads]);

  // Abre a peça assim que o lead chegou e a PecasLiga montou.
  React.useEffect(() => {
    if (lead) pecas.current?.abrirGlobal(peca, lead.id);
  }, [lead, peca]);

  /** O patch das peças → commands. O mesmo caminho de Pré-vendas. */
  const gravar = React.useCallback(async (patch: { leads?: any[]; tagsLead?: Record<string, string[]> }) => {
    if (!patch?.leads && !patch?.tagsLead) return;
    const ctx = pecas.current?._contexto ?? {};
    if (patch.leads) {
      const intencoes = intencoesDoPatch(ultimos.current, patch.leads);
      ultimos.current = patch.leads;
      for (const i of intencoes) {
        const erro = await executarIntencao(i, ctx, ACOES, idDoResponsavel);
        if (erro) toast.error(erro);
      }
    }
    // Tag aplicada/removida na gaveta → command real + evento TagAdded/Removed.
    if (patch.tagsLead) {
      for (const leadId of Object.keys(patch.tagsLead)) {
        const novas = patch.tagsLead[leadId] ?? [];
        const antigas = ultimasTags.current[leadId] ?? [];
        for (const t of novas) {
          if (antigas.includes(t)) continue;
          const r = await ACOES.tag(leadId, t, "adicionar");
          if (!r.ok) toast.error(r.erro ?? `Não consegui aplicar a tag "${t}".`);
        }
        for (const t of antigas) {
          if (novas.includes(t)) continue;
          const r = await ACOES.tag(leadId, t, "remover");
          if (!r.ok) toast.error(r.erro ?? `Não consegui remover a tag "${t}".`);
        }
      }
      ultimasTags.current = { ...ultimasTags.current, ...patch.tagsLead };
    }
    gravou();
  }, [idDoResponsavel, gravou]);

  /** Os toques de canal da gaveta: registra o contato e abre o Atendimento. */
  const falar = React.useCallback(async (canal: CanalAtendimento, alvo: string) => {
    const p = carga?.detalhe.pessoa;
    const temCanal = canal === "email" ? !!p?.email : !!(p?.telefone || p?.whatsapp);
    if (!temCanal) {
      toast(`Este contato não tem ${canal === "email" ? "e-mail" : "telefone"} cadastrado.`);
      return;
    }
    await ACOES.registrarContato(alvo, canal);
    router.push(`/atendimento?canal=${canal}&leadId=${encodeURIComponent(alvo)}`);
  }, [carga, router]);

  if (!lead) return null;

  return (
    <PecasGlobais
      ref={pecas}
      dados={{ leads, qual }}
      catalogo={catalogo}
      leads={leads}
      ir={(href: string) => router.push(href)}
      abrir={abrir}
      gravar={gravar}
      falar={falar}
      fechar={fechar}
    />
  );
}
