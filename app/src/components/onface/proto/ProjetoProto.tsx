"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Projeto (Onboarding & Implantação) — o adaptador.
 *
 * `ProjetoDesenho` é o markup do handoff e `ProjetoLiga` a lógica portada;
 * os dois são GERADOS. Este arquivo é o único escrito à mão.
 *
 * A tela não lê `props.dados`: lê TUDO de `catalogo.Projetos`, que no
 * protótipo era o módulo `window.OnFaceProjetos` (projetos.js). Aqui esse
 * módulo é reconstruído sobre o fulfillment real — mesma superfície (`lista`,
 * `atv`, `calc`, `tSt`, `subN`, `setSub`…), dado do banco.
 *
 * Três geradores do Liga precisam de correção na saída de `renderVals`
 * (padrão `corrigirInventados` do PessoaProto), porque nascem lá dentro:
 *   1. o telefone fabricado por hash do nome — e o botão "Ligar" DISCAVA ele;
 *   2. o link público `app.onface.com.br/f/...`, que não existe;
 *   3. as respostas do formulário ("3 linhas", "6 ramais", domínio do slug).
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ProjetoReal } from "@/lib/operacao/projeto";
import { acaoNotaDoProjeto, acaoLiberarBloqueio } from "@/app/(produto)/pos-vendas/actions";
import { ProjetoLiga } from "./ProjetoLiga";
import { levarParametros } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";

const FAM: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", ASSISTANT: "Callface Assistant" };
const ABAS = ["geral", "atividades", "materiais", "comunicacoes", "arquivos", "timeline"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (off: number) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const deIso = (s: string) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const dmy = (s: string | null) => { if (!s) return "—"; const d = deIso(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const hoje0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const ROTULO_FORM: Record<string, string> = { NOT_SENT: "Não enviado", SENT: "Enviado", SUBMITTED: "Respondido", REVIEWED: "Revisado", APPROVED: "Aprovado" };

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

/**
 * As "tarefas" do desenho: um grupo de itens do checklist cada.
 *
 * Item NOT_APPLICABLE sai das subtarefas — contá-lo como "a fazer" inflaria o
 * denominador; contá-lo como feito mentiria progresso (a regra do domínio:
 * NA satisfaz o gate, nunca conta como concluído). Grupo 100% NA vira
 * "Declinada", o "Não aplicável" do desenho.
 *
 * `iniD/fimD` ficam nulos: `fulfillment_itens.due_date` está vazio em todas as
 * linhas. A tela mostra "sem data" em vez de uma data inventada.
 */
function kidsDoProjeto(p: ProjetoReal) {
  return p.grupos.map((g, i) => {
    const aplic = g.itens.filter((x) => x.status !== "NOT_APPLICABLE");
    const feitas = aplic.filter((x) => x.status === "DONE").length;
    const na = aplic.length === 0;
    return {
      id: g.chave, ord: i, tarefaK: g.chave, titulo: g.titulo, tipo: "Tarefa",
      situacao: na ? "Declinada" : feitas === aplic.length ? "Feita" : feitas > 0 ? "Em andamento" : "A fazer",
      resp: p.responsavel ?? "",
      iniD: null, iniH: "", fimD: null, fimH: "",
      sub: (na ? g.itens : aplic).map((x) => ({ t: x.titulo, feita: x.status === "DONE", resp: "", fimD: null, itemId: x.id, status: x.status })),
    };
  });
}

type Kid = ReturnType<typeof kidsDoProjeto>[number];

/** O projeto na forma de projetos.js. */
function projetoDoDesenho(p: ProjetoReal) {
  return {
    id: p.id,
    // Todo fulfillment no banco é tipo ONBOARDING; a trilha "implantacao" do
    // desenho (handoff recebido, playbook i1–i4) fica inerte até existir um.
    tipo: "onboarding",
    /* Sem empresa vinculada (7 dos 26), o título cai no nome do serviço —
       o card "Cliente/Empresa" é corrigido para "—" no pós-passe, para não
       passar nome de serviço por razão social. */
    empresa: p.empresa ?? p.servico,
    familia: p.familia,
    oferta: p.servico,
    pessoa: p.contato?.nome ?? "",
    cargo: p.contato?.cargo ?? "",
    resp: p.responsavel ?? "—",
    prazo: p.prazo,
    inicio: p.inicio,
    concluido: p.status === "COMPLETED",
    handoffFeito: false,
    // Derivado dos itens BLOCKED do checklist; sem item bloqueado, a faixa não aparece.
    bloqueio: p.bloqueio ? { kind: p.bloqueio.kind, t: p.bloqueio.texto, desde: p.bloqueio.desde } : null,
    // Sem coluna de projeto-base: a linha "Expansão" não aparece.
    expansao: null,
    oppId: p.oportunidadeId,
    // Nenhum handoff onboarding→implantação foi gravado: o bloco some.
    handoff: null,
    // Não há registro de envio de template por projeto: tudo "Aguardando etapa".
    comms: {},
    arquivos: p.arquivos.map((a) => ({
      nome: a.nome, autor: a.autor ?? "—", quando: a.quando, url: a.url,
      tam: a.tamanhoBytes > 1048576 ? (a.tamanhoBytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(a.tamanhoBytes / 1024)) + " KB",
    })),
    notas: [],
    eventos: p.eventos,
  };
}

/* ── A lógica, ligada ──────────────────────────────────────────────────── */

class ProjetoLigada extends ProjetoLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
    /* O protótipo lia `?aba=` no componentDidMount, que o servidor não roda:
       a aba de deep-link só aparecia depois da hidratação. */
    const aba = props.abaInicial;
    if (aba && ABAS.includes(aba)) (this as any).state = { ...(this as any).state, aba };
  }

  /** O Liga chama `this.diz` em todo aviso e não o define: o primeiro aviso lançava TypeError. */
  diz(t: string, _tom?: string) { (this as any).props.avisar?.(t); }

  renderVals() {
    return this.corrigir(super.renderVals());
  }

  /** Troca, na saída do protótipo, o que ele inventa pelo real. */
  corrigir(vals: any) {
    const { projeto: p, origem, ir, abrirExterno, avisar } = (this as any).props as {
      projeto: ProjetoReal; origem: string; ir: (h: string) => void;
      abrirExterno: (u: string) => void; avisar: (t: string, cta?: { label: string; href: string }) => void;
    };
    if (!vals?.h?.acoes) return vals;

    /* 1. Contato: telefone, WhatsApp e e-mail REAIS. Sem o dado, o botão sai
          — "Ligar" nunca disca um número fabricado. */
    const c = p.contato;
    const tel = c?.telefone?.replace(/\D/g, "") || null;
    const wa = c?.whatsapp || c?.telefone || null;
    const porLabel = Object.fromEntries(vals.h.acoes.map((a: any) => [a.l, a]));
    const acoes = [
      tel && { ...porLabel.Ligar, onClick: () => abrirExterno("https://app.callface.ai/calls?call_to=" + tel) },
      wa && porLabel.WhatsApp,
      c?.email && porLabel["E-mail"],
    ].filter(Boolean);
    vals.h.acoes = acoes;
    vals.pessoas = c
      ? vals.pessoas.map((x: any) => ({ ...x, acoes: acoes.map((a: any) => ({ t: a.l, d: a.d, onClick: a.onClick })) }))
      : [];

    /* 1b. "Nova tarefa"/"Agendar reunião": o desenho cai em "Contato principal" quando não há
          pessoa, e esse texto virava o vínculo da tarefa. Aqui só vai pessoa real, com os ids. */
    const { abrir } = (this as any).props as { abrir: (peca: string, ctx?: unknown) => void };
    const ctxPeca = { empresa: p.empresa ?? "", empresaId: p.empresaId ?? "", pessoa: c?.nome ?? "", lead: p.leadId ?? "", leadId: p.leadId ?? "" };
    vals.ac = {
      ...vals.ac,
      nova: () => abrir("novaAtividade", { ...ctxPeca, projetoId: p.id }),
      reuniao: () => { const d = new Date(Date.now() + 864e5); abrir("novaReuniao", { ...ctxPeca, data: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), hora: "10:00", titulo: "Reunião · " + (p.empresa ?? "") }); },
    };
    if (!c && vals.h?.meta) vals.h.meta = String(vals.h.meta).replace("  ·  Contato principal  ·  ", "  ·  ");

    /* 2. Contexto: os links do protótipo apontavam para /onface-preview com
          query string, que `irPara` descarta. Aqui vão para as rotas reais. */
    const link = (href: string | null, linkL: string) =>
      href ? { temLink: true, ir: () => ir(href), linkL } : { temLink: false, ir: () => {}, linkL: "" };
    vals.ctx = vals.ctx.map((x: any) => {
      switch (x.l) {
        case "Cliente": return { ...x, v: p.empresa ?? "—", ...link(null, "") };
        case "Empresa": return { ...x, v: p.empresa ?? "—", ...link(p.empresaId ? `/empresas/${p.empresaId}` : null, "Ver empresa") };
        case "Contato principal": return c ? { ...x, ...link(p.leadId ? `/pessoas/${p.leadId}` : null, "Ver contato") } : { ...x, v: "—", ...link(null, "") };
        case "Origem": return p.oportunidadeId
          ? { ...x, v: "Oportunidade ganha", ...link(`/pipeline/${p.oportunidadeId}`, "Ver oportunidade") }
          : { ...x, v: "—", ...link(null, "") };
        default: return x;
      }
    });

    /* 3. Tiles. Progresso com denominador zero (tudo NA) não é "0%". O prazo
          é ESTIMADO (target_at/due_at vazios em 100%): sem a marca, um
          palpite pareceria compromisso com o cliente. */
    vals.tiles = vals.tiles.map((t: any) => {
      if (t.l === "Progresso" && /^0 de 0 /.test(t.s)) return { ...t, v: "—", s: "Sem itens aplicáveis", temBarra: false };
      if (t.l === "Prazo") {
        if (!p.prazo) return { ...t, v: "—", s: "Sem prazo definido" };
        if (p.status === "COMPLETED") return { ...t, s: p.concluidoEm ? "Concluído em " + dmy(p.concluidoEm) : "Concluído" };
        const d = Math.round((deIso(p.prazo).getTime() - hoje0().getTime()) / 864e5);
        const s = d >= 0 ? `${d} dias restantes` : `Passou há ${-d} dias`;
        return { ...t, s: s + (p.prazoEstimado ? " · estimado" : "") };
      }
      return t;
    });

    /* 4. Materiais: o link público é o que o produto serve de verdade, e o
          status/respostas saem de fulfillment_formularios. Callface AI não tem
          formulário público — dizer isso em vez de um link morto. */
    const caminho = p.familia === "PABX" ? "/impl-pabx/" : p.familia === "WHITE_LABEL" ? "/impl-white-label/" : null;
    const real = caminho && p.publicToken ? origem + caminho + p.publicToken : null;
    const f = p.formulario;
    const enviado = !!f && f.status !== "NOT_SENT";
    vals.mats = vals.mats.map((m: any) => {
      const titulo = "Respostas · " + m.nome;
      const linhas = !f || f.status === "NOT_SENT" || f.status === "SENT"
        ? [{ l: "Status", v: "Sem respostas" }]
        : p.familia === "WHITE_LABEL"
          ? [{ l: "Status", v: ROTULO_FORM[f.status] ?? f.status }, { l: "Domínio", v: f.dominio ?? "—" }]
          : [{ l: "Status", v: ROTULO_FORM[f.status] ?? f.status }, { l: "Linhas de portabilidade", v: String(f.linhas) },
             { l: "Ramais", v: String(f.ramais) }, { l: "Opções de URA", v: String(f.opcoesUra) },
             { l: "Operadora atual", v: f.operadoras ?? "—" }];
      return {
        ...m,
        link: real ?? (caminho ? "Sem link público" : "Sem formulário público"),
        st: caminho ? (f ? ROTULO_FORM[f.status] ?? f.status : "Não enviado") : "Sem formulário",
        pill: m.pill.replace(/background:.*$/, enviado
          ? "background:var(--okbg);color:var(--ok)"
          : "background:var(--sf);box-shadow:inset 0 0 0 1px var(--ln);color:var(--tx2)"),
        copiar: () => {
          if (!real) { avisar("Não há link público para este projeto."); return; }
          navigator.clipboard.writeText(real).then(() => toast.success("Link copiado"), () => toast.error("Não deu para copiar"));
        },
        resp: () => (this as any).setState({ mod: {
          t: titulo,
          nota: f ? "O que o cliente preencheu pelo link público." : caminho ? "O formulário ainda não foi gerado." : "Callface AI não tem formulário público.",
          linhas,
        } }),
      };
    });

    /* 5. O playbook embute o link fabricado no texto da mensagem. */
    const falso = "https://app.onface.com.br/f/" + (p.familia === "WHITE_LABEL" ? "wl" : "pabx") + "/" + p.id;
    vals.play = vals.play.map((x: any) => ({ ...x, texto: String(x.texto).split(falso).join(real ?? "[link indisponível]") }));

    /* 6. Nota e arquivos gravam de verdade; a tela relê o servidor. */
    const { salvarNota, enviarArquivos, liberar } = (this as any).props.acoes;
    vals.nota = { ...vals.nota, salvar: () => { const t = String(vals.nota.v ?? "").trim(); if (!t) return; void salvarNota(t).then((ok: boolean) => { if (ok) (this as any).setState({ nota: "" }); }); } };
    vals.arq = { ...vals.arq, enviar: (ev: any) => { const fs = Array.from(ev.target.files ?? []) as File[]; ev.target.value = ""; if (fs.length) void enviarArquivos(fs); } };
    if (vals.h) vals.h.liberar = () => { void liberar(); };

    return vals;
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function ProjetoProto({ projeto, abaInicial, origem }: {
  projeto: ProjetoReal;
  abaInicial: string | null;
  origem: string;
}) {
  const router = useRouter();

  const avisar = React.useCallback((texto: string, cta?: { label: string; href: string }) => {
    toast(texto, cta ? { action: { label: cta.label, onClick: () => router.push(cta.href) } } : undefined);
    router.refresh();
  }, [router]);

  const catalogo = React.useMemo(() => {
    const p = projetoDoDesenho(projeto);
    const kids = kidsDoProjeto(projeto);
    const kid = (id: string) => kids.find((k) => k.id === id);
    const tSt = (k: Kid) => (k.situacao === "Declinada" ? "na" : k.situacao === "Feita" ? "feita" : "aberta");
    const subN = (k: Kid) => ({ d: k.sub.filter((s) => s.feita).length, n: k.sub.length || 1 });

    /** PATCH real em cada item; o servidor é a verdade, a tela relê. */
    const patch = async (ids: string[], status: string) => {
      if (!ids.length) return;
      const rs = await Promise.all(ids.map((id) => fetch(`/api/fulfillments/itens/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      }).then((r) => r.ok, () => false)));
      if (rs.some((ok) => !ok)) toast.error("Não foi possível atualizar o checklist.");
      router.refresh();
    };

    /**
     * calc() reescrito sobre o dado real. Duas decisões de tradução:
     *
     * - O gate "Pronto p/ handoff" do protótipo procura as tarefas
     *   kick/form/passagem, que não existem no banco — e `isF()` devolve true
     *   para tarefa ausente, então todo PABX/WL sairia "pronto" com 0% feito.
     *   Aqui "pronto" é o estado do domínio: READY_FOR_VALIDATION, o mesmo que
     *   a rota /concluir exige.
     * - Atraso só conta com prazo ACORDADO. Prazo estimado não deixa projeto
     *   "Em atraso" (mesma regra do risco em getOperacaoDetalhe).
     */
    const calc = () => {
      const hoje = hoje0();
      const ap = kids.filter((k) => tSt(k) !== "na");
      let total = 0, feitas = 0;
      ap.forEach((k) => { const s = k.sub; total += s.length; feitas += s.filter((x) => x.feita).length; });
      const abertas = ap.filter((k) => tSt(k) === "aberta");
      const atual = abertas[0] ?? null;
      const atualIdx = atual ? kids.indexOf(atual) : -1;
      const tudo = total > 0 && feitas === total;
      const ativo = projeto.status !== "COMPLETED";
      const pronto = ativo && projeto.status === "READY_FOR_VALIDATION";
      const prazoD = projeto.prazo ? deIso(projeto.prazo) : hoje;
      const dPrazo = Math.round((prazoD.getTime() - hoje.getTime()) / 864e5);
      const atraso = ativo && !projeto.prazoEstimado ? -dPrazo : 0;
      return {
        ativo, pct: total ? Math.round((feitas / total) * 100) : 0, feitas, total, kids, atual, atualIdx,
        proxSub: atual ? atual.sub.findIndex((s) => !s.feita) : -1,
        faseNome: atual ? atual.titulo : tudo ? "Concluído" : "—",
        abertas, gate: null, gateOk: false, tudo, pronto,
        // Concluir o fulfillment (PABX, WL ou AI) é o que leva o cliente a CS.
        cai: true,
        atraso, dPrazo, dBloq: 0,
        estado: !ativo ? "concluido" : pronto ? "pronto" : atraso > 0 ? "atrasado" : "andamento",
        golive: false, semProx: ativo && !pronto && !atual,
        herdadas: kids.filter((k) => tSt(k) === "na").length, nTarefas: kids.length,
      };
    };

    const Projetos = {
      FAM,
      lista: () => [p],
      atv: () => kids,
      calc,
      tSt,
      subN,
      jornada: () => kids.map((k) => [k.tarefaK, k.titulo, k.sub.map((s) => s.t)]),
      iso,
      deIso,
      // O dado vem do servidor; não há store a semear.
      garantir: () => {},
      // Log interno do protótipo: os fatos reais já entram pela timeline.
      evento: () => null,
      setSub: (id: string, i: number, feita: boolean) => {
        const s = kid(id)?.sub[i];
        if (s) void patch([s.itemId], feita ? "DONE" : "PENDING");
      },
      setTarefa: (id: string, feita: boolean) => {
        const k = kid(id);
        if (!k) return;
        // Concluir mexe só no que falta; reabrir só no que estava feito.
        void patch(k.sub.filter((s) => s.feita !== feita).map((s) => s.itemId), feita ? "DONE" : "PENDING");
      },
      naTarefa: (id: string, na: boolean) => {
        const k = kid(id);
        if (!k) return;
        /* Marcar NA não apaga o que já foi feito: item DONE fica DONE.
           Reativar devolve o grupo inteiro (todo NA) para PENDING. */
        void patch(k.sub.filter((s) => (na ? s.status !== "DONE" : true)).map((s) => s.itemId), na ? "NOT_APPLICABLE" : "PENDING");
      },
      concluirCS: async () => {
        const r = await fetch(`/api/fulfillments/${projeto.id}/concluir`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "concluir_onboarding" }),
        }).catch(() => null);
        if (!r?.ok) {
          const j = await r?.json().catch(() => null);
          toast.error(j?.error ?? "Não foi possível concluir o projeto.");
        }
        router.refresh();
      },
      // Sem command: o pós-passe do adaptador já troca nota e arquivos.
      nota: () => null,
      mut: () => null,
      // Bloquear por projeto não existe no domínio: o bloqueio é do item do checklist.
      bloquear: () => avisar("Bloqueio é por tarefa: marque a tarefa como bloqueada no checklist."),
      comunicou: () => toast("O envio não fica registrado no projeto — siga pelo Atendimento."),
    };

    return { Projetos, ClientesSeed: [], OPORTUNIDADES: [] };
  }, [projeto, router, avisar]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: unknown) => {
    abrirPeca(peca, id, { tela: "projeto", projetoId: projeto.id, empresaId: projeto.empresaId, empresa: projeto.empresa });
  }, [abrirPeca, projeto.id, projeto.empresaId, projeto.empresa]);

  /* Rotas do protótipo que não existem no produto. */
  const ir = React.useCallback((href: string) => {
    const ROTA: Record<string, string> = { "/operacao/onboarding": "/pos-vendas", "/onface-preview/atividades": "/tarefas" };
    router.push(ROTA[href] ?? href);
  }, [router]);

  const abrirExterno = React.useCallback((url: string) => { window.open(url, "_blank", "noopener"); }, []);

  const acoes = React.useMemo(() => ({
    salvarNota: async (texto: string) => {
      const r = await acaoNotaDoProjeto(projeto.id, texto);
      if (!r.ok) { toast.error(r.erro); return false; }
      toast.success("Nota salva na timeline"); router.refresh(); return true;
    },
    enviarArquivos: async (fs: File[]) => {
      let n = 0;
      for (const f of fs) {
        const fd = new FormData(); fd.append("file", f);
        const r = await fetch(`/api/fulfillments/${projeto.id}/arquivos`, { method: "POST", body: fd }).catch(() => null);
        if (r?.ok) n++; else toast.error(f.name + ": " + ((await r?.json().catch(() => ({})))?.error ?? "não foi possível enviar"));
      }
      if (n) { toast.success(n > 1 ? n + " arquivos adicionados" : "Arquivo adicionado"); router.refresh(); }
    },
    liberar: async () => {
      const r = await acaoLiberarBloqueio(projeto.id);
      if (!r.ok) toast.error(r.erro); else toast.success("Bloqueio resolvido");
      router.refresh();
    },
  }), [projeto.id, router]);

  return (
    <div data-workspace="desenho">
      <ProjetoLigada
        projeto={projeto}
        abaInicial={abaInicial}
        origem={origem}
        dados={{}}
        catalogo={catalogo}
        abrir={abrir}
        abrirExterno={abrirExterno}
        avisar={avisar}
        acoes={acoes}
        ir={ir}
      />
    </div>
  );
}
