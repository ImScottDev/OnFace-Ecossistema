"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Propostas — o adaptador.
 *
 * O desenho não lista propostas: lista OPORTUNIDADES com as propostas dentro,
 * e cada linha da tabela é um par (oportunidade, proposta). Por isso o
 * adaptador reagrupa a lista plana que o domínio entrega — é a tradução, e é
 * a razão deste arquivo existir.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  acaoBaseNovaProposta, acaoCriarRevisao, type BaseNovaProposta, type LinhaProposta,
} from "@/app/(produto)/propostas/actions";
import { acaoCriarOportunidade } from "@/app/(produto)/pipeline/actions";
import { PropostasLiga } from "./PropostasLiga";
import { levarParametros } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";

class PropostasLigada extends PropostasLiga {
  private baseCarregada = false;

  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
  }

  /** A base do assistente "Nova proposta" só vem do banco quando ele abre. */
  componentDidUpdate(anterior: any, antes: any) {
    const s: any = (this as any).state;
    /* A Liga lê as oportunidades de um estado semeado na montagem. A base do assistente (abertas sem
       proposta, carteira de clientes) chega depois, e sem ressemear o assistente nunca a enxergava. */
    const opps = (this as any).props.dados?.opps;
    if (opps && opps !== anterior.dados?.opps) (this as any).setState({ opps });
    if (!antes.nova && s.nova && !this.baseCarregada) {
      this.baseCarregada = true;
      (this as any).props.carregarBase?.();
    }
  }
}

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

/**
 * Os itens que o desenho soma para mostrar o valor.
 *
 * `soma()` no protótipo percorre `p.itens`; a lista do domínio traz os totais
 * já calculados (`total`, `totalRecorrente`) e NÃO traz os itens — carregá-los
 * para 200 propostas seria uma varredura por linha, e a lista não desdobra a
 * composição: só o drawer da Proposta faz isso, e ele carrega os seus.
 *
 * Dois itens agregados reproduzem exatamente o total do banco. Não é invenção:
 * é o mesmo número, na forma que o desenho sabe somar.
 */
function itensAgregados(p: LinhaProposta) {
  const recorrente = p.totalRecorrente ?? 0;
  const avulso = (p.total ?? 0) - recorrente;
  const itens: Array<{ nome: string; natureza: string; valor: number; qtd: number }> = [];
  if (recorrente) itens.push({ nome: "Recorrente", natureza: "MRR", valor: recorrente, qtd: 1 });
  if (avulso) itens.push({ nome: "Avulso", natureza: "ONE_TIME", valor: avulso, qtd: 1 });
  return itens;
}

/** Os três meses que o desenho reconhece, abreviados como ele espera. */
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * A data no vocabulário do protótipo: "hoje", "ontem" ou "23 set".
 *
 * Não é preferência de formato — é contrato. O gráfico de forecast chama
 * `dataDe()`, que casa com /(\d{1,2})\s+([a-zç]{3})/ e devolve HOJE para
 * qualquer coisa que não bata. Com "23/09" todas as propostas caíam no mesmo
 * dia e o forecast do mês inteiro desenhava uma reta em R$ 0.
 */
function hora(iso: string | null): string | null {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${dia(iso)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function logReal(p: LinhaProposta) {
  const e = p.eventosEm, ev: { k: string; quando: string; quem?: string; texto?: string }[] = [];
  const add = (k: string, iso: string | null, extra: object = {}) => { const q = hora(iso); if (q) ev.push({ k, quando: q, ...extra }); };
  add("enviada", p.enviadaEm, { quem: p.responsavel ?? undefined });
  add("visualizada", e.visualizada);
  add("ajuste", e.ajuste, { quem: p.pessoa ?? undefined, texto: p.ajusteSolicitado ?? undefined });
  add("aceita", e.aceita, { quem: p.pessoa ?? undefined });
  add("recusada", e.recusada, { quem: p.pessoa ?? undefined });
  return ev;
}

function dia(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const soODia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((soODia(d) - soODia(new Date())) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === -1) return "ontem";
  return `${d.getDate()} ${MES[d.getMonth()]}`;
}

/**
 * A lista plana do domínio, reagrupada por oportunidade.
 *
 * Uma proposta sem negócio vinculado vira um grupo próprio — são 455 no banco,
 * propostas antigas que só apontam para um lead. Jogá-las fora esconderia
 * quase um terço da base; agrupá-las com as outras misturaria empresas.
 */
function agrupar(linhas: LinhaProposta[]) {
  const grupos = new Map<string, any>();

  for (const p of linhas) {
    const chave = p.negocioId ?? `proposta:${p.id}`;
    let o = grupos.get(chave);
    if (!o) {
      o = {
        id: chave,
        negocioId: p.negocioId,
        empresa: p.empresa ?? "Empresa não informada",
        pessoa: p.pessoa ?? "",
        cargo: "",
        familia: p.familia,
        resp: p.responsavel,
        // A etapa REAL da oportunidade; proposta sem oportunidade não é de oportunidade aberta.
        etapa: p.etapa ?? "sem_oportunidade",
        empresaId: p.empresaId,
        propostas: [],
      };
      grupos.set(chave, o);
    }
    o.propostas.push({
      id: p.id,
      // O código é o NÚMERO da proposta no banco, não um "P-1540" inventado.
      codigo: String(p.numero),
      versao: p.versao,
      status: p.status,
      modo: p.modoFechamento,
      enviadaEm: dia(p.enviadaEm),
      atualizadaEm: dia(p.atualizadaEm),
      // Data de referência do gráfico: proposta importada sem envio gravado cai na data do seu desfecho, não em "hoje".
      refEm: dia(p.enviadaEm ?? p.eventosEm.aceita ?? p.eventosEm.recusada ?? p.eventosEm.expirada ?? p.atualizadaEm),
      validade: dia(p.validade),
      validadeDias: p.validadeDias,
      // Eventos reais; o que o banco não registrou não aparece na linha do tempo.
      log: logReal(p),
      // O que o cliente respondeu, quando pediu ajuste. É o texto dele.
      resposta: p.ajusteSolicitado,
      itens: itensAgregados(p),
    });
  }

  // Versões em ordem: o desenho escolhe a vigente pela última viva da lista.
  for (const o of grupos.values()) {
    o.propostas.sort((a: any, b: any) => a.versao - b.versao);
  }
  return [...grupos.values()];
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function PropostasProto({ linhas, responsaveis }: {
  linhas: LinhaProposta[];
  responsaveis: string[];
}) {
  const router = useRouter();
  const [base, setBase] = React.useState<BaseNovaProposta | null>(null);

  const carregarBase = React.useCallback(() => {
    acaoBaseNovaProposta().then(setBase).catch(() => toast.error("Não consegui carregar clientes e contatos."));
  }, []);

  const opps = React.useMemo(() => {
    const lista = agrupar(linhas);
    if (!base) return lista;
    const porNegocio = new Map(lista.filter((o) => o.negocioId).map((o) => [o.negocioId, o]));
    // Oportunidade aberta sem proposta ainda também recebe proposta: entra sem linha na tabela.
    for (const a of base.abertas) {
      if (porNegocio.has(a.negocioId)) continue;
      lista.push({
        id: a.negocioId, negocioId: a.negocioId, empresaId: a.empresaId, empresa: a.empresa, pessoa: a.pessoa, cargo: "",
        familia: a.familia, resp: a.responsavel, etapa: a.etapa, propostas: [],
      });
    }
    // A carteira real: cada cliente vira uma "oportunidade ganha" só para o assistente listar.
    for (const c of base.clientes) {
      lista.push({
        id: `cliente:${c.empresaId}`, negocioId: null, empresaId: c.empresaId, empresa: c.empresa, pessoa: c.pessoa, cargo: "",
        familia: c.familia, resp: null, etapa: "ganho", evidencia: "Contrato ativo", propostas: [],
      });
    }
    return lista;
  }, [linhas, base]);

  const leads = React.useMemo(() => (base?.contatos ?? []).map((c) => ({
    id: c.pessoaId ?? `empresa:${c.empresaId}`, empresaId: c.empresaId, empresa: c.empresa, leadId: c.leadId,
    pessoa: c.pessoa, cargo: c.cargo, email: c.email,
  })), [base]);

  const catalogo = React.useMemo(() => ({
    EQUIPE: base?.equipe.map((u) => u.nome) ?? responsaveis,
    OPORTUNIDADES: [],
    LEADS: [],
  }), [responsaveis, base]);

  /**
   * "Criar" do assistente, de verdade. Devolve a mensagem de erro, ou null
   * quando já navegou para o editor.
   */
  const criarProposta = React.useCallback(async (e: {
    alvo: any; O: any; P0: any; familia: string; closer: string; tipo: string; contatoNome: string; leadId: string | null;
  }): Promise<string | null> => {
    const editor = (negocioId: string, propostaId?: string) =>
      router.push(`/propostas/nova?${new URLSearchParams({ oportunidade: negocioId, ...(propostaId ? { proposta: propostaId } : {}) })}`);

    if (e.alvo.k === "opp") { editor(e.O.negocioId); return null; }

    if (e.alvo.k === "subst") {
      const p = e.O.propostas[e.alvo.i];
      if (!p?.id) return "Não achei a proposta para revisar.";
      if (p.status === "rascunho") { editor(e.O.negocioId, p.id); return null; }
      const r = await acaoCriarRevisao(p.id);
      if (!r.ok) return r.erro;
      editor(e.O.negocioId, r.dados!.propostaId);
      return null;
    }

    // Cliente, empresa ou contato da base: nasce a oportunidade no Pipeline, em Entrada.
    const empresaId = e.alvo.empresaId;
    if (!empresaId) return "Escolha uma empresa cadastrada: a oportunidade precisa de empresa.";
    const closer = base?.equipe.find((u) => u.nome === e.closer);
    if (!closer) return "Escolha o closer.";
    const motion = e.alvo.k === "cli" && e.tipo !== "nova"
      ? (e.tipo === "renovacao" ? "RENEWAL" : "EXPANSION") : "NEW_BUSINESS";
    const r = await acaoCriarOportunidade({
      empresaId, familias: [e.familia as any], responsavelId: closer.id, motion, leadId: e.leadId,
    });
    if (!r.ok) return r.erro;
    const novo = r.dados?.ids?.[0];
    if (!novo) return "A oportunidade não foi criada.";
    toast.success("Oportunidade criada no Pipeline.");
    editor(novo);
    return null;
  }, [router, base]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "proposta" && id) { router.push(`/propostas/${id}`); return; }
    if (peca === "oportunidade" && id) { router.push(`/pipeline/${id}`); return; }
    abrirPeca(peca, id, { tela: "propostas" });
  }, [router, abrirPeca]);

  /**
   * Enviar, revisar e responder moram na página da Proposta, que é onde a
   * composição existe. Daqui a lista leva até lá em vez de fingir que grava:
   * o envio dispara e-mail ao cliente, e disparar isso a partir de uma linha
   * de tabela, sem ver o que vai junto, é o tipo de clique que ninguém desfaz.
   */
  const persistir = React.useCallback((_antes: any, depois: any, evento: string) => {
    const proposta = depois?.propostas?.[depois.propostas.length - 1];
    toast(`"${evento}" acontece na página da proposta.`, proposta?.id ? {
      action: { label: "Abrir proposta", onClick: () => router.push(`/propostas/${proposta.id}`) },
    } : undefined);
    router.refresh();
  }, [router]);

  return (
    <div data-workspace="desenho">
      <PropostasLigada
        dados={{ opps, leads }}
        catalogo={catalogo}
        carregarBase={carregarBase}
        criarProposta={criarProposta}
        abrir={abrir}
        persistir={persistir}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
