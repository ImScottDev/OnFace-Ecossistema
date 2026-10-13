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
import { autorDoEvento } from "./avatar-do-proto";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acaoSalvarContato } from "@/app/(produto)/pre-vendas/actions";

import type { Familia } from "@/lib/vendas/dominio";
import type { BoardPreVendas, CardPreVendas, DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { rotuloDeEvento } from "@/lib/vendas/rotulos-evento";
import { origemCanonica } from "@/lib/vendas/origem-canonica";
import { qualDoDesenho } from "./qual-do-desenho";
import type { AcoesPreVendas } from "../vendas/PreVendas";
import { PreVendasLiga } from "./PreVendasLiga";
import { PecasLiga } from "./PecasLiga";
import { levarParametros } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";
import {
  intencoesDoPatch, motivoDeDesqualificacao, motivoDeNutricao,
  type Intencao,
} from "./saidas-do-lead";
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
  /** E11: passo da cadência (nome da inscrição ou último toque registrado). */
  cadencia?: string | null;
}

export type PecaDoDesenho = "detalhe" | "qualificar" | "nutrir" | "desqualificar";

function paraODesenho(c: CardPreVendas, cadencia: string | null = null): LeadDoDesenho {
  return {
    id: c.leadId,
    // O desenho trata empresa vazia como ausente e escreve "Sem empresa" —
    // e é isso que destrava a regra de Oportunidade, que exige conta.
    empresa: c.empresa && c.empresa !== "Empresa não informada" ? c.empresa : null,
    pessoa: c.pessoa ?? "Sem contato",
    cargo: c.cargo ?? "",
    resp: c.responsavel,
    // `dias` no cartão: há quantos dias o lead está NESTA etapa. Zera ao mover.
    dias: c.horasNaEtapa == null ? 0 : Math.floor(c.horasNaEtapa / 24),
    origem: origemCanonica(c.origem),
    campanha: c.campanha,
    interesse: c.servicos?.[0] ?? null,
    /* O SEGUNDO chip do cartão.
     *
     * O desenho põe `campanha || origem` no primeiro e a `tag` no segundo.
     * Com campanha preenchida, a origem sumia — e 3.505 dos 4.066 leads têm
     * origem ("Mídia Paga", "ZohoDesk", "Site"), que é justamente como a
     * pré-venda decide o tom da abordagem.
     *
     * Então: a origem ocupa o segundo chip quando a campanha tomou o
     * primeiro. Serviço de interesse vem antes quando existe — mas só 3 leads
     * da base têm o campo, então na prática quem aparece é a origem. */
    tag: (c.servicos && c.servicos.length > 1 ? c.servicos[1] : null)
      ?? (c.campanha ? origemCanonica(c.origem) : null),
    /* O valor real, não o "sim": o cartão só precisa saber SE existe, mas a
       exportação e o botão de ligar/enviar precisam do número e do e-mail.
       Enquanto aqui vinha "sim", a planilha saía com as colunas em branco. */
    telefone: c.telefone ?? (c.temTelefone ? "sim" : null),
    whatsapp: c.whatsapp ?? (c.temWhatsapp ? "sim" : null),
    email: c.email ?? (c.temEmail ? "sim" : null),
    empresaId: c.empresaId,
    acao: c.proximaAcao?.titulo ?? null,
    venceEm: c.proximaAcao?.venceEm ? quando(c.proximaAcao.venceEm) : null,
    etapa: c.etapa,
    // No-show ocupa o chip de destaque: é quem o time precisa remarcar.
    cadencia: c.noShow ? (cadencia ? `No-show · ${cadencia}` : "No-show") : cadencia,
  };
}

/* O mapeador da qualificação é fonte única em `qual-do-desenho.ts`. Reexporta
   para não quebrar quem já importava daqui. */
export { qualDoDesenho };

/** "hoje", "amanhã", "3d" — o vocabulário curto que o cartão usa. */
export function quando(iso: string): string | null {
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

/* ── Intenção → command ────────────────────────────────────────────────── */

/** Qualifica com o que a peça coletou (modal "Qualificar lead" ou gaveta). */
async function qualificarComOContexto(leadId: string, ctx: ContextoDaSaida, acoes: AcoesPreVendas) {
  // A peça guarda o formulário por lead em `qual`.
  const q = (ctx.qualificacoes?.[leadId] ?? {}) as Record<string, unknown>;
  const interesse = String(q.interesse ?? "");
  const qtd = typeof q.quantidade === "number" ? q.quantidade : undefined;
  const fit = typeof q.fit === "string" && q.fit ? `Fit ${q.fit}` : undefined;
  return acoes.qualificar(leadId, {
    icp: q.icp as string | undefined,
    dor: q.dor as string | undefined,
    necessidade: q.necessidade as string | undefined,
    // O protótipo junta os serviços com "|" num campo só.
    servicosInteresse: interesse ? interesse.split("|").filter(Boolean) : undefined,
    cenarioAtual: q.cenario as string | undefined,
    urgencia: q.urgencia as string | undefined,
    budget: q.budget as string | undefined,
    decisor: q.decisor as string | undefined,
    timing: q.timing as string | undefined,
    // O modal de qualificação traz tamanho da operação e fit.
    quantidade: qtd,
    observacoes: fit,
  });
}

/**
 * Executa uma intenção. Devolve a mensagem de erro, ou `null` se deu certo.
 *
 * Motivo ausente é recusa explícita, não um valor padrão: gravar "outro"
 * porque o motivo não chegou envenena o relatório de perdas com uma fatia que
 * ninguém consegue interpretar depois.
 */
export async function executarIntencao(
  i: Intencao,
  ctx: ContextoDaSaida,
  acoes: AcoesPreVendas,
  idDoResponsavel: Map<string, string>,
): Promise<string | null> {
  const falhou = (r: { ok: boolean; erro?: string }) => (r.ok ? null : r.erro ?? "Não foi possível gravar.");

  switch (i.tipo) {
    case "mover":
      return falhou(await acoes.moverEtapa(i.leadId, i.para));

    case "qualificar":
      return falhou(await qualificarComOContexto(i.leadId, ctx, acoes));

    case "nutrir": {
      const motivo = motivoDeNutricao(ctx.motivoNutricao);
      if (!motivo) return "Nutrição sem motivo não é gravada — escolha um motivo.";
      return falhou(await acoes.nutrir(i.leadId, motivo, i.retomarEm, ctx.observacao ?? null));
    }

    case "desqualificar": {
      const motivo = motivoDeDesqualificacao(ctx.motivoDesqualificacao);
      if (!motivo) return "Desqualificação sem motivo não é gravada — escolha um motivo.";
      return falhou(await acoes.desqualificar(i.leadId, motivo, ctx.observacao ?? null));
    }

    case "criar-oportunidade": {
      /* Antes devolvia um aviso de não-ligado e a peça mostrava "Oportunidade
         criada" por cima: o modal mentia e nada era gravado. Agora o command é
         chamado com o que o modal coletou (`ctx.oportunidade`).

         Família: vem do serviço de interesse que o modal mostra. "Não
         identificado" vai sem família — o domínio cria "Família a definir" e a
         recusa de mover para Proposta cobra a escolha depois. */
      const o = ctx.oportunidade ?? {};
      /* O modal abre em "Qualificar lead" e só depois pergunta como a oportunidade
         avança. Quem sai de uma etapa que não é "qualificado" e não passava por
         `qualificar` criava a oportunidade com o lead ainda "não qualificado":
         sem LeadQualified, sem qualificação gravada, e o funil de Pré-vendas
         contava conversão de quem nunca foi qualificado. */
      if (i.de !== "qualificado" && ctx.qualificacoes?.[i.leadId]) {
        const rq = await qualificarComOContexto(i.leadId, ctx, acoes);
        if (!rq.ok) return rq.erro ?? "Não foi possível qualificar o lead antes de criar a oportunidade.";
      }
      if (o.empresa && i.empresa && o.empresa !== i.empresa) {
        return `Esta oportunidade é de "${o.empresa}", mas o lead pertence a "${i.empresa}". Crie pela ficha da outra empresa.`;
      }
      const nome = o.resp ?? i.responsavel;
      const responsavelId = nome ? idDoResponsavel.get(nome) : null;
      if (!responsavelId) return nome ? `Não encontrei "${nome}" na equipe.` : "Escolha o responsável comercial.";
      const familia = i.interesse ? FAMILIA_DO_INTERESSE[i.interesse] : undefined;

      /* O modal MOSTRA data, hora, duração, título e closer padrão, mas esses
         valores moravam só na tela: o estado ia vazio ao servidor e a reunião
         nunca era gravada ("faltou a data"). Os padrões são os mesmos do modal. */
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const hoje = new Date();
      const amanha = new Date(hoje.getTime() + 86_400_000);
      const ehReuniao = o.avanco === "reuniao";
      const data = o.data || iso(hoje);
      const hora = o.hora || "14:00";
      const duracao = ({ "30 min": 30, "45 min": 45, "1 h": 60 } as Record<string, number>)[o.duracao ?? "30 min"] ?? 30;
      const tipo = ({ "Vídeo": "video", "Ligação": "call", "Presencial": "presencial" } as Record<string, "video" | "call" | "presencial">)[o.tipo ?? "Vídeo"] ?? "video";
      const closerId = o.closer ? idDoResponsavel.get(o.closer) : undefined;
      const reuniao = ehReuniao
        ? {
            data: new Date(`${data}T${hora}`).toISOString(), duracao, tipo,
            titulo: (o.titulo ?? `${i.empresa ?? "Lead"} x Callface`).trim() || undefined,
            closerId,
          }
        : null;
      const r = await acoes.criarOportunidade({
        leadId: i.leadId, familias: familia ? [familia] : [], responsavelId, reuniao,
      });
      if (!r.ok) return r.erro ?? "Não foi possível criar a oportunidade.";
      // A oportunidade e a reunião estão salvas; se o convite não saiu, a tela diz (nunca silencioso).
      if (r.dados?.aviso) toast(r.dados.aviso, { duration: 9000 });
      /* WhatsApp, Ligação, E-mail e Outro viram a PRÓXIMA AÇÃO: uma tarefa com
         prazo. Antes o desenho coletava título/data/hora e nada era gravado. */
      if (!ehReuniao && o.avanco) {
        const titulos: Record<string, string> = { whatsapp: "Retomar conversa no WhatsApp", ligacao: "Ligar para alinhar proposta", email: "Enviar proposta por e-mail", outro: "Próximo passo" };
        const titulo = (o.tarTitulo ?? titulos[o.avanco] ?? "").trim();
        if (titulo) {
          const t = await acoes.criarTarefa({
            leadId: i.leadId, titulo, responsavelId,
            venceEm: new Date(`${o.tarData || iso(amanha)}T${o.tarHora || "10:00"}`).toISOString(),
            prioridade: "media", descricao: null,
          });
          if (!t.ok) return `Oportunidade criada, mas a próxima ação não foi gravada: ${t.erro ?? "erro ao criar a tarefa"}`;
        }
      }
      return null;
    }

    case "atribuir": {
      /* O desenho guarda o NOME e o command quer o id. O mapa vem do board,
         que já lista os responsáveis reais da organização. */
      if (!i.responsavel) return falhou(await acoes.atribuir(i.leadId, null));
      const id = idDoResponsavel.get(i.responsavel);
      if (!id) return `Não encontrei "${i.responsavel}" na equipe.`;
      return falhou(await acoes.atribuir(i.leadId, id));
    }

    case "desconhecida":
      return `Isto ainda não é gravado: ${i.descricao}.`;
  }
}

/* ── As peças, com as saídas ligadas ───────────────────────────────────── */

/** O serviço que o modal de oportunidade mostra → a família do domínio. */
const FAMILIA_DO_INTERESSE: Record<string, Familia> = {
  "Callface AI": "CALLFACE_AI", PABX: "PABX", "White Label": "WHITE_LABEL",
};

/** O que a peça sabia no instante em que gravou. */
export interface ContextoDaSaida {
  /** O que o modal "Criar oportunidade" coletou (vive em `qualOpp`/`qualEmpresa`). */
  oportunidade?: {
    resp?: string | null; avanco?: string | null; data?: string | null; hora?: string | null; empresa?: string | null;
    duracao?: string | null; tipo?: string | null; titulo?: string | null; closer?: string | null;
    tarTitulo?: string | null; tarData?: string | null; tarHora?: string | null;
  };
  motivoNutricao?: string | null;
  motivoDesqualificacao?: string | null;
  observacao?: string | null;
  qualificacoes?: Record<string, Record<string, unknown>>;
}

/**
 * As peças do protótipo, com o contexto da saída preservado.
 *
 * O problema: a peça grava o lead e LIMPA o formulário no mesmo `setState`.
 * Quando o `componentDidUpdate` manda o patch, `motivo` e `observação` já
 * foram embora — e o command precisa deles: nutrição sem motivo é limbo, e
 * desqualificação sem motivo não alimenta relatório nenhum.
 *
 * Interceptar `setState` resolve porque ali o estado ANTERIOR ainda está de
 * pé. É o único lugar por onde toda mutação da peça passa, e continua sendo
 * subclasse: o arquivo gerado não é tocado.
 */
export class PecasLigadas extends PecasLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
  }

  _contexto: ContextoDaSaida = {};
  /* Gravar a qualificação digitada, sem esperar o botão Qualificar.
     O protótipo guardava os campos só na memória da tela: fechar a gaveta
     perdia tudo, e mover o card pedia preencher de novo. `salvarQualificacao`
     já existia no servidor e ninguém chamava. Espera 900ms depois da última
     tecla para não gravar a cada caractere. */
  _qualTimer: any = null;
  _qualPendente: Record<string, Record<string, unknown>> = {};

  agendarSalvarQualificacao(leadId: string) {
    clearTimeout(this._qualTimer);
    this._qualTimer = setTimeout(() => {
      const q = this._qualPendente[leadId];
      if (!q) return;
      delete this._qualPendente[leadId];
      /* A observação é do contato (campos_custom), não da qualificação: grava pela mesma ação da ficha. */
      if (typeof q.obs === "string") void acaoSalvarContato(leadId, { observacao: q.obs }).catch(() => undefined);
      const salvar = (this as any).props?.acoes?.salvarQualificacao;
      if (!salvar) return;
      const interesse = String(q.interesse ?? "");
      // Tamanho da operação e Fit também: editados inline no drawer, eram
      // descartados aqui (só dor/interesse/etc iam ao banco), por isso Fit e
      // Tamanho voltavam "Não preenchido". Mesma conversão do modal.
      const nTam = parseInt(String(q.tamanho == null ? "" : q.tamanho).replace(/[^0-9]/g, ""), 10);
      const fit = typeof q.fit === "string" && q.fit ? `Fit ${q.fit}` : undefined;
      void salvar(leadId, {
        icp: q.icp as string | undefined,
        dor: q.dor as string | undefined,
        necessidade: q.necessidade as string | undefined,
        servicosInteresse: interesse ? interesse.split("|").filter(Boolean) : undefined,
        cenarioAtual: q.cenario as string | undefined,
        urgencia: q.urgencia as string | undefined,
        budget: q.budget as string | undefined,
        decisor: q.decisor as string | undefined,
        timing: q.timing as string | undefined,
        quantidade: Number.isNaN(nTam) ? undefined : nTam,
        observacoes: fit,
      }).catch(() => undefined);
    }, 900);
  }

  setQual(id: string, campo: string, valor: unknown, padrao?: Record<string, unknown>) {
    (super.setQual as any).call(this, id, campo, valor, padrao);
    const atual = ((this as any).state?.qual ?? {})[id] ?? {};
    this._qualPendente[id] = { ...atual, [campo]: valor };
    this.agendarSalvarQualificacao(id);
  }

  componentWillUnmount() {
    clearTimeout(this._qualTimer);
    const pai = (PecasLiga.prototype as any).componentWillUnmount;
    if (pai) pai.call(this);
  }

  /* Timeline real do lead, por id. O protótipo trazia 8 eventos chumbados no
     código (WhatsApp recebido, ligação de 4min, cadência iniciada…) — tudo
     inventado. Ao abrir o detalhe, busca a linha do tempo de verdade e injeta
     no state; a peça lê daqui em vez do mock. */
  /* Tag aplicada, etapa movida, qualificação: a tela de baixo relê (`router.refresh`)
     e entrega `leads` novos. A gaveta aberta relê o detalhe junto — senão
     mostrava a tag/contato de antes até fechar e abrir de novo. */
  componentDidUpdate(prevProps?: any, prevState?: any) {
    const pai = (PecasLiga.prototype as any).componentDidUpdate;
    if (pai) pai.call(this, prevProps, prevState);
    const id = (this as any).state?.detalheId;
    if (prevProps && prevProps.leads !== (this as any).props?.leads) {
      // O board atualizou: a cadência da gaveta acompanha a inscrição real.
      (this as any).setState({ cadencias: (this as any).props?.dados?.cadencias ?? {} });
      if (id) this.carregarDetalhe(id);
    }
  }

  abrirPeca(peca: string, leadId: string) {
    (super.abrirPeca as any).call(this, peca, leadId);
    if (peca === "detalhe" && leadId) this.carregarDetalhe(leadId);
    /* O gerado (PecasLiga.abrirPeca) dá `return` no ramo "cadencia" ANTES da linha que carrega a
       lista (código morto logo abaixo): só o picker interno da gaveta carregava. Aberta de fora
       (Atendimento, Cliente 360), a peça dizia "Nenhuma cadência publicada" com duas publicadas. */
    if (peca === "cadencia") (this as any).carregarCadencias();
  }

  carregarDetalhe(leadId: string) {
    {
      const carregar = (this as any).props?.acoes?.detalhe;
      if (typeof carregar === "function") {
        void Promise.resolve(carregar(leadId)).then((r: any) => {
          const tl: any[] = (r?.ok && r?.dados?.timeline) ? r.dados.timeline : [];
          /* Sempre data + hora: "18:01" sozinho não diz de que dia é. */
          const hhmm = (iso: string) => {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return "—";
            const dd = String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
            return dd + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
          };
          const eventos = tl.map((e) => ({
            hora: hhmm(e.ocorridoEm),
            titulo: e.titulo || rotuloDeEvento(e.tipo),
            ator: e.atorTipo || "SYSTEM",
            autor: autorDoEvento(e, e.atorTipo === "AUTOMATION" ? "Automação" : "Sistema"),
          }));
          /* Contato, respostas do formulário e tags REAIS do lead: a gaveta lê
             daqui. Antes telefone/e-mail eram fabricados a partir do id. */
          const lead = r?.ok ? r.dados?.lead ?? null : null;
          (this as any).setState((st: any) => ({
            timelineReal: { ...(st.timelineReal ?? {}), [leadId]: eventos },
            detalheReal: { ...(st.detalheReal ?? {}), [leadId]: lead },
          }));
        }).catch(() => undefined);
      }
    }
  }

  setState(atualizacao: any, callback?: () => void) {
    const s: any = (this as any).state ?? {};
    /* O modal "Qualificar lead" coleta em `qualDados` (interesses/porte/dor/fit),
       não em `qual` (a gaveta de detalhe). Sem esta ponte a qualificação ia ao
       servidor vazia: gravava `{}` e o lead voltava sem nada preenchido. Mapeia
       os campos do modal para a forma que `executarIntencao` lê. */
    const qd = s.qualDados ?? {};
    const temModal = (Array.isArray(qd.interesses) && qd.interesses.length) || (qd.dor && String(qd.dor).trim());
    const qualificacoes = { ...(s.qual ?? {}) };
    if (temModal && s.detalheId) {
      const nPorte = parseInt(String(qd.porte ?? "").replace(/[^0-9]/g, ""), 10);
      qualificacoes[s.detalheId] = {
        ...(qualificacoes[s.detalheId] ?? {}),
        interesse: Array.isArray(qd.interesses) ? qd.interesses.join("|") : undefined,
        dor: qd.dor || undefined,
        quantidade: Number.isNaN(nPorte) ? undefined : nPorte,
        fit: qd.fit || undefined,
      };
    }
    this._contexto = {
      motivoNutricao: s.motivo ?? null,
      motivoDesqualificacao: s.desqMotivo ?? null,
      observacao: (s.desqObs || s.obs) ?? null,
      qualificacoes,
      oportunidade: {
        resp: s.qualOpp?.resp ?? null, avanco: s.qualOpp?.avanco ?? null,
        data: s.qualOpp?.data ?? null, hora: s.qualOpp?.hora ?? null,
        duracao: s.qualOpp?.duracao ?? null, tipo: s.qualOpp?.tipo ?? null,
        titulo: s.qualOpp?.titulo ?? null, closer: s.qualOpp?.closer ?? null,
        tarTitulo: s.qualOpp?.tarTitulo ?? null, tarData: s.qualOpp?.tarData ?? null, tarHora: s.qualOpp?.tarHora ?? null,
        empresa: s.qualEmpresa ?? null,
      },
    };
    return super.setState(atualizacao, callback);
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function PreVendasProto({ dados, acoes, cadenciaPorLead = {} }: {
  dados: BoardPreVendas;
  cadenciaPorLead?: Record<string, string>;
  acoes: AcoesPreVendas;
}) {
  const router = useRouter();
  /* O que as peças daqui pedem e não hospedam (tags, atividade) abre pelo
     hospedeiro global, por cima desta tela. */
  const { abrir: abrirGlobal } = usePecas();

  const todos = React.useMemo(
    () => dados.colunas.flatMap((c) => c.cards),
    [dados.colunas],
  );
  const leads = React.useMemo(
    () => todos.map((c) => paraODesenho(c, cadenciaPorLead[c.leadId] ?? null)),
    [todos, cadenciaPorLead],
  );

  /* A cadência REAL de cada lead (inscrição viva). A gaveta lê daqui: antes ela
     guardava um estado próprio e dizia "Fora de cadência" com o cartão mostrando
     a cadência. */
  const cadenciasVivas = React.useMemo(
    () => Object.fromEntries(Object.entries(cadenciaPorLead).map(([k, v]) => [k, String(v).replace(/^Cadência /, "")])),
    [cadenciaPorLead],
  );

  /* O que já foi qualificado, por lead. Só entra quem tem algo gravado: mapa
     vazio é a prova de que ninguém preencheu, e não um convite a inventar. */
  const qual = React.useMemo(() => {
    const m: Record<string, Record<string, unknown>> = {};
    for (const c of todos) {
      if (!c.leadId) continue;
      const campos = qualDoDesenho(c.qualificacao);
      if (campos) m[c.leadId] = campos;
    }
    return m;
  }, [todos]);

  /* As PEÇAS do protótipo — gaveta, qualificação, nutrição, desqualificação,
     atividade, tags, cadência — vêm de `OnFace Pecas.dc.html`, convertidas.
     Antes eram as versões recriadas à mão (`vendas/GavetaLead`,
     `vendas/SaidasLead`), e era daí que vinha boa parte da divergência.

     O protótipo as abre por um barramento; aqui a `ref` faz esse papel: a
     tela chama `abrirPeca`, que é o método do protótipo, intocado. */
  const pecas = React.useRef<PecasLigadas>(null);

  /* O patch das peças traz a lista NOVA; para saber o que mudou é preciso a
     anterior. Um ref, e não estado: comparar não deve re-renderizar. */
  const ultimosLeads = React.useRef<any[] | null>(null);
  React.useEffect(() => { ultimosLeads.current = leads; }, [leads]);

  /* As tags aplicadas na gaveta vivem em `tagsLead` (nome do lead → tags novas
     da sessão), FORA do patch `leads`. O gravar só olhava `leads`, então
     aplicar tag não gravava NADA: nenhum `entity_label`, nenhum evento
     `tag.adicionada`, e por isso automação com gatilho de tag nunca disparava.
     Este ref guarda o estado anterior das tags para o gravar diferenciar o que
     entrou e o que saiu. */
  const ultimasTags = React.useRef<Record<string, string[]>>({});

  /* O catálogo estático do protótipo, vindo do domínio.
     Sem ele as peças caem no mock: o dropdown de responsável listava
     "Camila Reis, Diego Nunes, Ana Vitória" e o de etapa mostrava a chave
     crua ("em_contato") no lugar do rótulo.

     `EQUIPE` é lista de NOMES — é com o nome que o cartão compara. */
  /* Nome → id. O desenho trabalha com nome (é o que o cartão mostra) e todo
     command quer o id. */
  const idDoResponsavel = React.useMemo(
    () => new Map(dados.filtros.responsaveis.map((r) => [r.nome, r.id])),
    [dados.filtros.responsaveis],
  );

  const catalogo = React.useMemo(() => {
    /* O campo "Closer" (reunião/oportunidade) só lista quem fecha, não o time
       todo: o modal mostrava Aline Aragão e demais admins/gerentes. Filtra por
       papel `closer`; se o cadastro ainda não tem nenhum, cai na equipe toda
       para não travar o agendamento. */
    const closers = dados.filtros.responsaveis.filter((r) => r.papel === "closer").map((r) => r.nome);
    return {
      EQUIPE: dados.filtros.responsaveis.map((r) => r.nome),
      CLOSERS: closers.length ? closers : dados.filtros.responsaveis.map((r) => r.nome),
      ETAPAS: Object.fromEntries(dados.colunas.map((c) => [c.chave, { label: c.rotulo }])),
    };
  }, [dados.filtros.responsaveis, dados.colunas]);

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

  /**
   * O patch das peças, traduzido em commands.
   *
   * O protótipo grava a lista inteira de leads; o produto tem um command por
   * intenção. `intencoesDoPatch` compara antes e depois e diz o que o usuário
   * quis — e cada intenção vira a chamada certa, com o motivo que a peça
   * coletou.
   *
   * O que não dá para traduzir NÃO grava em silêncio: avisa e relê.
   */
  const gravar = React.useCallback(async (patch: { leads?: any[]; tagsLead?: Record<string, string[]> }) => {
    if (!patch?.leads && !patch?.tagsLead) return;

    const ctx = pecas.current?._contexto ?? {};
    const falhas: string[] = [];

    if (patch.leads) {
      const intencoes = intencoesDoPatch(ultimosLeads.current, patch.leads);
      ultimosLeads.current = patch.leads;
      for (const i of intencoes) {
        const r = await executarIntencao(i, ctx, acoes, idDoResponsavel);
        if (r) falhas.push(r);
      }
    }

    /* Tag aplicada ou removida na gaveta: diferença contra o estado anterior,
       cada mudança vira um command real (`acoes.tag`), que grava o vínculo e
       emite o evento que as automações de tag escutam. */
    if (patch.tagsLead) {
      for (const leadId of Object.keys(patch.tagsLead)) {
        const novas = patch.tagsLead[leadId] ?? [];
        const antigas = ultimasTags.current[leadId] ?? [];
        for (const t of novas) {
          if (antigas.includes(t)) continue;
          const r = await acoes.tag(leadId, t, "adicionar");
          if (!r.ok) falhas.push(r.erro ?? `Não consegui aplicar a tag "${t}".`);
        }
        for (const t of antigas) {
          if (novas.includes(t)) continue;
          const r = await acoes.tag(leadId, t, "remover");
          if (!r.ok) falhas.push(r.erro ?? `Não consegui remover a tag "${t}".`);
        }
      }
      ultimasTags.current = { ...ultimasTags.current, ...patch.tagsLead };
    }

    if (falhas.length) falhas.forEach((f) => toast.error(f));
    router.refresh();
  }, [acoes, router, idDoResponsavel]);

  return (
    <>
      {/* `data-workspace="desenho"`: a tela traz o próprio fundo e o leva até
          a borda, então a casca tira o recuo de 24/28px. Sem isto sobrava uma
          moldura branca em volta e o quadro chegava cortado na direita. */}
      <div data-workspace="desenho">
        {/* O QUADRO também grava — o arraste entre colunas passa por aqui, e
            não pelas peças. Ligar só as peças deixava o arraste sem efeito. */}
        <PreVendasLiga
          dados={{ leads, cadencias: cadenciaPorLead }}
          /* Sem catalogo o board caía nos nomes ficticios (Camila Reis e cia.)
             no Exportar e no "Atribuir responsavel" da acao em massa. EQUIPE
             real vem daqui. */
          catalogo={catalogo}
          abrir={abrir}
          gravar={gravar}
          ir={(href: string) => router.push(href)}
        />
      </div>

      <PecasLigadas
        ref={pecas}
        dados={{ leads, qual, cadencias: cadenciasVivas }}
        catalogo={catalogo}
        leads={leads}
        /* Sem `acoes`, o save-ao-digitar da qualificação (agendarSalvarQualificacao,
           que lê props.acoes.salvarQualificacao) ficava mudo: o contador subia
           para "1 de 4" mas nada ia ao banco, e mover o card pedia preencher de
           novo. É o mesmo bug que o fix pretendia resolver, vivo porque esta
           instância do board não recebia as ações. */
        acoes={acoes}
        ir={(href: string) => router.push(href)}
        abrir={abrirGlobal}
        gravar={gravar}
        falar={falar}
      />

    </>
  );
}
