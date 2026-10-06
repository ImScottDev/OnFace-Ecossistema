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

import type { Familia } from "@/lib/vendas/dominio";
import type { BoardPreVendas, CardPreVendas, DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
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
      ?? (c.campanha ? c.origem : null),
    telefone: c.temTelefone ? "sim" : null,
    whatsapp: c.temWhatsapp ? "sim" : null,
    email: c.temEmail ? "sim" : null,
    empresaId: c.empresaId,
    acao: c.proximaAcao?.titulo ?? null,
    venceEm: c.proximaAcao?.venceEm ? quando(c.proximaAcao.venceEm) : null,
    etapa: c.etapa,
  };
}

/**
 * `leads.qualificacao` → os campos da peça de qualificação.
 *
 * O caminho de volta do que `salvarQualificacao` grava. Sem ele a gaveta abria
 * sempre em branco: a qualificação ia para o banco e ninguém a lia, então
 * mover o card pedia preencher tudo outra vez. Os nomes diferem dos dois lados
 * (o desenho chama `cenario` e `interesse`), e é esta função que traduz.
 */
export function qualDoDesenho(q: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!q || typeof q !== "object") return null;
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const campos: Record<string, unknown> = {};
  for (const [desenho, dominio] of [
    ["icp", "icp"], ["dor", "dor"], ["necessidade", "necessidade"],
    ["cenario", "cenarioAtual"], ["urgencia", "urgencia"], ["budget", "budget"],
    ["decisor", "decisor"], ["timing", "timing"],
  ] as const) {
    const v = texto(q[dominio]);
    if (v !== undefined) campos[desenho] = v;
  }
  const servicos = q.servicosInteresse;
  if (Array.isArray(servicos) && servicos.length) {
    campos.interesse = servicos.filter((s): s is string => typeof s === "string").join("|");
  }
  return Object.keys(campos).length ? campos : null;
}

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

    case "qualificar": {
      // A peça guarda o formulário por lead em `qual`.
      const q = (ctx.qualificacoes?.[i.leadId] ?? {}) as Record<string, unknown>;
      const interesse = String(q.interesse ?? "");
      return falhou(await acoes.qualificar(i.leadId, {
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
      }));
    }

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
      if (o.empresa && i.empresa && o.empresa !== i.empresa) {
        return `Esta oportunidade é de "${o.empresa}", mas o lead pertence a "${i.empresa}". Crie pela ficha da outra empresa.`;
      }
      const nome = o.resp ?? i.responsavel;
      const responsavelId = nome ? idDoResponsavel.get(nome) : null;
      if (!responsavelId) return nome ? `Não encontrei "${nome}" na equipe.` : "Escolha o responsável comercial.";
      const familia = i.interesse ? FAMILIA_DO_INTERESSE[i.interesse] : undefined;

      const reuniao = o.avanco === "reuniao" && o.data
        ? { data: new Date(`${o.data}T${o.hora ?? "14:00"}`).toISOString() } : null;
      const r = await acoes.criarOportunidade({
        leadId: i.leadId, familias: familia ? [familia] : [], responsavelId, reuniao,
      });
      if (!r.ok) return r.erro ?? "Não foi possível criar a oportunidade.";
      return o.avanco === "reuniao" && !o.data
        ? "Oportunidade criada no Pipeline, mas a reunião não foi agendada: faltou a data."
        : null;
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
  oportunidade?: { resp?: string | null; avanco?: string | null; data?: string | null; hora?: string | null; empresa?: string | null };
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
      const salvar = (this as any).props?.acoes?.salvarQualificacao;
      if (!salvar) return;
      const interesse = String(q.interesse ?? "");
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

  setState(atualizacao: any, callback?: () => void) {
    const s: any = (this as any).state ?? {};
    this._contexto = {
      motivoNutricao: s.motivo ?? null,
      motivoDesqualificacao: s.desqMotivo ?? null,
      observacao: (s.desqObs || s.obs) ?? null,
      qualificacoes: s.qual ?? {},
      oportunidade: {
        resp: s.qualOpp?.resp ?? null, avanco: s.qualOpp?.avanco ?? null,
        data: s.qualOpp?.data ?? null, hora: s.qualOpp?.hora ?? null,
        empresa: s.qualEmpresa ?? null,
      },
    };
    return super.setState(atualizacao, callback);
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function PreVendasProto({ dados, acoes }: {
  dados: BoardPreVendas;
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
  const leads = React.useMemo(() => todos.map(paraODesenho), [todos]);

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

  const catalogo = React.useMemo(() => ({
    EQUIPE: dados.filtros.responsaveis.map((r) => r.nome),
    ETAPAS: Object.fromEntries(dados.colunas.map((c) => [c.chave, { label: c.rotulo }])),
  }), [dados.filtros.responsaveis, dados.colunas]);

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
          dados={{ leads }}
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
        dados={{ leads, qual }}
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
