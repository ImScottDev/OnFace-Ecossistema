"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Lead 360 (/pre-vendas/[id]) — o adaptador.
 *
 * `LeadDesenho` é o markup (derivado da Oportunidade), `LeadLiga` a lógica de
 * tela. Este arquivo decide qual campo do domínio vai para qual lugar do
 * desenho e qual command cada gesto chama: é o único dos três com julgamento.
 *
 * Não há store local. A tela lê `detalheLead` (o mesmo do drawer e da ficha da
 * Pessoa), grava pelos commands de `pre-vendas/actions.ts` e relê com
 * `router.refresh()`. O que não tem command NÃO grava em silêncio: some do
 * menu ou diz o motivo.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import type { CadenciaDoLead, NotaDoLead, ReuniaoDoLead, TarefaDoLead } from "@/lib/vendas/ficha-extras";
import { rotuloDeEvento } from "@/lib/vendas/rotulos-evento";
import { urlLigarCallface, abrirUrlExterna } from "@/lib/callface-ligar";
import { montarRelacoes } from "./relacoes-da-ficha";
import { situacaoDoBanco, tipoDoBanco } from "./atividade-tarefa";
import { usePecas } from "./pecas-host";
import { LeadLiga, type AcoesDoLead, type LeadDaTela } from "./LeadLiga";
import {
  MODULO_PRE_VENDAS, bannerDoLead, dataBR, haQuanto, proximaDaTela, qualDaTela, qualMudou, qualParaDominio,
  quandoBR, tilesDeSla, type ModuloDoLead,
} from "./lead-da-tela";
import {
  acaoAtribuir, acaoMoverEtapa, acaoReativar, acaoRegistrarContato, acaoRemoverDaCadencia,
  acaoSalvarQualificacao, acaoSalvarContato,
} from "@/app/(produto)/pre-vendas/actions";
import { acaoPausarCadenciaDoLead } from "@/app/(produto)/contatos/actions";

const ETAPAS_ATIVAS = new Set(["novo", "em_contato", "qualificacao", "qualificado"]);

/** O dado real na forma que a Liga consome. Puro: o relógio entra por `agora`. */
export function leadDaTela(p: {
  lead: DetalheLead; timeline: LinhaDoTempo[]; cadencia: CadenciaDoLead | null;
  tarefas: TarefaDoLead[]; notas: NotaDoLead[]; equipe: string[]; modulo: ModuloDoLead; agora: Date;
  reunioes?: ReuniaoDoLead[];
}): LeadDaTela {
  const { lead, timeline, cadencia, tarefas, notas, equipe, modulo, agora, reunioes = [] } = p;
  const temEmpresa = !!lead.empresa.id;
  const rel = montarRelacoes({
    empresaId: lead.empresa.id ?? "", leadId: lead.id,
    aquisicoes: [], oportunidades: lead.oportunidades, propostas: null,
    conta: { nome: lead.empresa.nome, ativo: lead.naCarteira, jaTeveServico: lead.jaTeveServico, ficha: lead.fichaDeCliente },
    vazioPrefixo: "Nenhuma oportunidade criada a partir deste lead ainda.",
  });
  const a = lead.atribuicao;
  const origem = a.origem ?? "Origem não informada";
  const manual = /manual/i.test(origem);
  const linhas = ([
    ["Canal", origem, false], ["Campanha", a.campanha, true], ["Meio", a.medium, false], ["Conteúdo", a.conteudo, false],
    ["Primeiro toque", a.primeiroToque, false], ["Criado em", dataBR(lead.criadoEm), false],
  ] as Array<[string, string | null, boolean]>).filter(([, v]) => !!v).map(([label, valor, destaque]) => ({ label, valor: valor as string, destaque }));

  return {
    id: lead.id,
    moduloRotulo: modulo.rotulo,
    titulo: temEmpresa ? `${lead.empresa.nome} · ${lead.pessoa.nome}` : lead.pessoa.nome,
    empresa: {
      id: lead.empresa.id, nome: temEmpresa ? lead.empresa.nome : "Sem empresa vinculada", temEmpresa,
      sub: [lead.empresa.setor, lead.empresa.cidade].filter(Boolean).join(" · ") || (temEmpresa ? "Sem dados cadastrais" : "Associe uma empresa a este lead"),
    },
    pessoa: {
      nome: lead.pessoa.nome, cargo: lead.pessoa.cargo ?? "", email: lead.pessoa.email,
      telefone: lead.pessoa.telefone, whatsapp: lead.pessoa.whatsapp,
    },
    etapa: lead.etapa, etapaRotulo: lead.etapaRotulo,
    diasTexto: ETAPAS_ATIVAS.has(lead.etapa) && lead.etapaDesde ? `${haQuanto(lead.etapaDesde, agora)} nesta etapa` : "",
    resp: lead.responsavel, equipe,
    criadoEm: dataBR(lead.criadoEm),
    origem: {
      selo: manual ? "Manual" : "Automática", titulo: origem,
      sub: a.campanha ? `Campanha ${a.campanha}` : manual ? "Cadastrado à mão" : "Entrou pelo canal acima",
      linhas,
    },
    tags: lead.tags.map((t) => t.nome),
    sla: tilesDeSla(lead, cadencia, agora),
    banner: bannerDoLead(lead, agora),
    qual: qualDaTela(lead),
    proxima: proximaDaTela(lead, tarefas, agora),
    cadencia,
    respostas: lead.respostasFormulario,
    relacoes: rel.itens.map((i) => ({ id: i.id, tipo: i.tipo, titulo: i.titulo, sub: i.sub, status: i.status, tom: i.tom, href: i.href })),
    relacoesVazio: rel.vazioTxt,
    atividades: tarefas.map((t) => {
      const feita = t.status === "concluida" || t.status === "declinada";
      return {
        id: t.id, tarefaId: t.id, tipo: tipoDoBanco(t.tipo), titulo: t.titulo, desc: t.descricao ?? "",
        autor: t.responsavel ?? "Sem responsável", quando: t.venceEm ? quandoBR(t.venceEm, agora) : "Sem prazo",
        situacao: situacaoDoBanco(t.status), feita,
      };
    }).concat(reunioes.map((r) => ({
      /* Reunião é atividade; a situação vem do status real. Abre a peça única de Reunião, por id. */
      id: r.id, reuniaoId: r.id, tarefaId: "", tipo: "Reunião", titulo: r.titulo, desc: "",
      autor: lead.responsavel.nome ?? "Sem responsável", quando: quandoBR(r.data, agora),
      situacao: r.status === "realizada" ? "Feita" : r.status === "agendada" ? "A fazer" : "Declinada",
      feita: r.status !== "agendada",
    }))),
    notas: notas.map((n) => ({ id: n.id, autor: n.autor ?? "Sistema", texto: n.texto, quando: quandoBR(n.em, agora), sistema: !n.autor })),
    eventos: timeline.map((e) => ({ t: e.titulo || rotuloDeEvento(e.tipo), quando: quandoBR(e.ocorridoEm, agora), autor: e.usuarioNome ?? "Sistema" })),
  };
}

export function LeadProto({ lead, timeline, cadencia, tarefas, reunioes = [], notas, equipe, agora, modulo = MODULO_PRE_VENDAS }: {
  lead: DetalheLead;
  timeline: LinhaDoTempo[];
  cadencia: CadenciaDoLead | null;
  tarefas: TarefaDoLead[];
  reunioes?: ReuniaoDoLead[];
  notas: NotaDoLead[];
  /** Equipe real da organização (id + nome). */
  equipe: Array<{ id: string; nome: string }>;
  /** O instante em que o servidor leu o lead: servidor e navegador contam o tempo a partir dele. */
  agora: string;
  modulo?: ModuloDoLead;
}) {
  const router = useRouter();
  const { abrir: abrirPeca } = usePecas();

  const l = React.useMemo(
    () => leadDaTela({ lead, timeline, cadencia, tarefas, reunioes, notas, equipe: equipe.map((e) => e.nome), modulo, agora: new Date(agora) }),
    [lead, timeline, cadencia, tarefas, reunioes, notas, equipe, modulo, agora],
  );

  const acoes = React.useMemo<AcoesDoLead>(() => {
    /* Gravou: relê o servidor (detalheLead) e a tela mostra o que ficou, não o que se esperava. */
    const releia = <T extends { ok: boolean }>(r: T): T => { if (r.ok) router.refresh(); return r; };
    const idDe = (nome: string | null) => (nome ? equipe.find((e) => e.nome === nome)?.id ?? null : null);

    return {
      moverEtapa: async (para) => releia(await acaoMoverEtapa(lead.id, para)),
      reativar: async () => releia(await acaoReativar(lead.id)),
      salvarQualificacao: async (rascunho) => {
        const m = qualMudou(qualDaTela(lead), rascunho);
        if (m.qualificacao) {
          const r = await acaoSalvarQualificacao(lead.id, qualParaDominio(rascunho, lead.qualificacao?.observacoes));
          if (!r.ok) return r;
        }
        if (m.observacao) {
          const r = await acaoSalvarContato(lead.id, { observacao: rascunho.observacao });
          if (!r.ok) return r;
        }
        return releia({ ok: true as const });
      },
      atribuir: async (nome) => {
        if (nome && !idDe(nome)) return { ok: false as const, erro: `Não encontrei "${nome}" na equipe.` };
        return releia(await acaoAtribuir(lead.id, idDe(nome)));
      },
      criarNota: async (texto) => {
        const r = await fetch("/api/notas", {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, conteudo: texto }),
        }).catch(() => null);
        if (!r?.ok) return { ok: false as const, erro: "Não consegui salvar a nota." };
        return releia({ ok: true as const });
      },
      excluirNota: async (id) => {
        const r = await fetch(`/api/notas/${id}`, { method: "DELETE", credentials: "same-origin" }).catch(() => null);
        if (!r?.ok) return { ok: false as const, erro: "Não consegui excluir a nota." };
        return releia({ ok: true as const });
      },
      pausarCadencia: async (pausar) => releia(await acaoPausarCadenciaDoLead(lead.id, pausar)),
      removerDaCadencia: async () => releia(await acaoRemoverDaCadencia(lead.id)),
      abrirPeca: (peca, id, contexto) => abrirPeca(peca, id, contexto),
      ir: (rota) => router.push(rota),
      voltar: () => router.push(modulo.lista),
      ligar: () => {
        const url = urlLigarCallface(lead.pessoa.telefone || lead.pessoa.whatsapp);
        if (!url) { toast.warning("Sem telefone cadastrado para ligar."); return; }
        /* Como o drawer: ligar é contato, e sem o marco o SLA de quem foi chamado por telefone fica em branco. */
        void acaoRegistrarContato(lead.id, "ligacao").then((r) => { if (r.ok) router.refresh(); });
        abrirUrlExterna(url);
        toast.success(`Abrindo o Callface para ligar para ${lead.pessoa.nome.split(" ")[0]}`);
      },
      falar: (canal) => {
        void acaoRegistrarContato(lead.id, canal).finally(() => router.push(`/atendimento?canal=${canal}&leadId=${encodeURIComponent(lead.id)}`));
      },
    };
  }, [lead, equipe, modulo, router, abrirPeca]);

  return (
    <div data-workspace="desenho">
      <LeadLiga l={l} acoes={acoes} />
    </div>
  );
}
