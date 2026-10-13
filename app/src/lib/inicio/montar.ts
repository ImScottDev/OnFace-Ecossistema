/**
 * Monta o painel do Início para um papel.
 *
 * A tela é uma só; o que muda é quais blocos existem e de quem são os números.
 * Cada bloco é lido e falha sozinho: se o inventário de integrações cair, o
 * resto do Início continua de pé e o bloco diz "não consegui carregar" em vez de
 * mostrar zero.
 *
 * Cache de 20 s por pessoa e lente, em memória do processo: a home é a página
 * mais aberta do produto e reabrir/atualizar não precisa repetir quarenta
 * consultas. Não é cache de verdade (cada instância tem o seu) e o botão
 * "Atualizar" da tela o ignora.
 * ponytail: por processo; se o app rodar em várias instâncias e a defasagem de
 * 20 s importar, troca por `unstable_cache` com tag por organização.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAtendimentoResumo, getCsResumo, getImplantacaoResumo } from "@/lib/analytics/command-center";
import { getPrecisaAtencao } from "@/lib/analytics/inicio";
import { vermelhosDoDia } from "@/lib/callface-ai/uso";
import { boardPreVendas } from "@/lib/vendas/consultas";
import {
  dataPorExtenso, focoDoDia, horaEmSaoPaulo, lenteDoPapel, permissoesDaLente, saudacaoDaHora, type SinalDoFoco,
} from "./lente";
import * as C from "./consultas";
import type { Atalho, Bloco, Hero, Lente, PainelInicio } from "./tipos";

export interface EntradaDoPainel {
  orgId: string;
  userId: string;
  userName: string;
  role: string;
  agora?: Date;
  /** Ignora o cache (botão "Atualizar"). */
  fresco?: boolean;
}

async function bloco<T>(nome: string, fn: () => Promise<T>): Promise<Bloco<T>> {
  try {
    return { ok: true, dados: await fn() };
  } catch (e) {
    console.error(`[inicio] bloco "${nome}" falhou:`, e);
    return { ok: false, erro: nome };
  }
}

const TTL_MS = 20_000;
const cache = new Map<string, { em: number; painel: PainelInicio }>();

const ATALHOS: Record<Lente, Atalho[]> = {
  gestao: [
    { rotulo: "Visão de vendas", href: "/vendas", contagem: null },
    { rotulo: "Pós-vendas", href: "/pos-vendas", contagem: null },
    { rotulo: "Clientes e risco", href: "/clientes/risco", contagem: null },
    { rotulo: "Financeiro", href: "/clientes/financeiro", contagem: null },
    { rotulo: "Relatórios", href: "/relatorios", contagem: null },
    { rotulo: "Automações", href: "/automacoes", contagem: null },
  ],
  operacao: [
    { rotulo: "Pós-vendas", href: "/pos-vendas", contagem: null },
    { rotulo: "Customer Success", href: "/clientes/cs", contagem: null },
    { rotulo: "Risco e churn", href: "/clientes/risco", contagem: null },
    { rotulo: "Atividades", href: "/tarefas", contagem: null },
    { rotulo: "Atendimento", href: "/atendimento", contagem: null },
    { rotulo: "Calendário", href: "/calendario", contagem: null },
  ],
  closer: [
    { rotulo: "Pipeline", href: "/pipeline", contagem: null },
    { rotulo: "Propostas", href: "/propostas", contagem: null },
    { rotulo: "Atividades", href: "/tarefas", contagem: null },
    { rotulo: "Atendimento", href: "/atendimento", contagem: null },
    { rotulo: "Calendário", href: "/calendario", contagem: null },
    { rotulo: "Pré-vendas", href: "/pre-vendas", contagem: null },
  ],
  sdr: [
    { rotulo: "Pré-vendas", href: "/pre-vendas?view=meus", contagem: null },
    { rotulo: "Atendimento", href: "/atendimento", contagem: null },
    { rotulo: "Atividades", href: "/tarefas", contagem: null },
    { rotulo: "Prospecção", href: "/prospeccao", contagem: null },
    { rotulo: "Cadências", href: "/automacoes/cadencias", contagem: null },
    { rotulo: "Calendário", href: "/calendario", contagem: null },
  ],
  leitor: [{ rotulo: "Relatórios", href: "/relatorios", contagem: null }],
};

/** Esquece a leitura guardada desta pessoa (botão "Atualizar"). */
export function limparCacheDoInicio(orgId: string, userId: string) {
  for (const k of cache.keys()) if (k.startsWith(`${orgId}:${userId}:`)) cache.delete(k);
}

export async function montarInicio(entrada: EntradaDoPainel): Promise<PainelInicio> {
  const agora = entrada.agora ?? new Date();
  const lente = lenteDoPapel(entrada.role);
  const chave = `${entrada.orgId}:${entrada.userId}:${lente}`;
  const guardado = cache.get(chave);
  if (!entrada.fresco && guardado && agora.getTime() - guardado.em < TTL_MS) return guardado.painel;

  const painel = await montar(entrada, lente, agora);
  cache.set(chave, { em: agora.getTime(), painel });
  return painel;
}

async function montar(entrada: EntradaDoPainel, lente: Lente, agora: Date): Promise<PainelInicio> {
  const ctx: C.Ctx = { orgId: entrada.orgId, userId: entrada.userId, agora };
  const perm = permissoesDaLente(lente);
  const veOrganizacao = lente === "gestao" || lente === "operacao";

  const hero = bloco<Hero>("hero", () =>
    lente === "closer" ? C.heroMetaCloser(ctx)
      : lente === "sdr" ? C.heroFila(ctx)
      : lente === "operacao" ? C.heroEntrega(ctx)
      : C.heroFaturamento(ctx));

  const kpis = bloco("kpis", () => C.kpis(ctx, lente));

  const atencao = lente === "leitor" ? null : bloco("atencao", async () => {
    if (lente === "closer") return C.atencaoDoCloser(ctx);
    if (lente === "sdr") return C.atencaoDoSdr(ctx);
    const [atencaoSinais, implantacao, cs, atendimento, usoCallfaceAi] = await Promise.all([
      getPrecisaAtencao(entrada.orgId, agora, { semFinanceiro: !perm.financeiro }), getImplantacaoResumo(entrada.orgId),
      getCsResumo(entrada.orgId), getAtendimentoResumo(entrada.orgId),
      // Mesma função da carteira /clientes/uso; falha dela não derruba o Início.
      vermelhosDoDia(entrada.orgId, { limite: 500 }).then((v) => ({
        vermelhos: v.length,
        semUsar: v.filter((x) => x.flags.some((f) => f.codigo === "silencio" || f.codigo === "nunca_usou")).length,
        semResponsavel: v.filter((x) => !x.csResponsavel).length,
      })).catch(() => null),
    ]);
    return C.atencaoDaOrganizacao({ atencao: atencaoSinais, implantacao, cs, atendimento, usoCallfaceAi });
  });

  // Pré-vendas do time: gestão, operação, leitor e SDR veem o recorte da
  // organização; o closer vê o pipeline DELE e não a fila de pré-vendas.
  const funil = lente === "closer"
    ? bloco("funil", () => C.funil(ctx, "pessoal", null))
    : bloco("funil", async () => {
        const board = await boardPreVendas(entrada.orgId, { porColuna: 1 });
        const pv = C.resumoDePreVendas({
          colunas: board.colunas, resumo: board.resumo, contadores: board.contadores,
        });
        return C.funil(ctx, "organizacao", pv, lente !== "sdr");
      });

  const agenda = perm.acoes ? bloco("agenda", async () => {
    const { itensTodos: _todos, ...agendaDoDia } = await C.agendaDoDia(ctx);
    return agendaDoDia;
  }) : null;

  const saude = veOrganizacao ? bloco("saude", () => C.saude(ctx)) : null;
  const entrega = veOrganizacao ? bloco("entrega", () => C.entrega(ctx)) : null;
  const financeiro = perm.financeiro ? bloco("financeiro", () => C.financeiro(ctx)) : null;

  const [h, k, a, f, ag, s, e, fi, nomeOrg] = await Promise.all([
    hero, kpis, atencao, funil, agenda, saude, entrega, financeiro,
    db.execute<{ nome: string | null }>(sql`SELECT nome FROM organizacoes WHERE id = ${entrada.orgId}::uuid`)
      .then((r) => r[0]?.nome ?? null).catch(() => null),
  ]);

  const sinais: SinalDoFoco[] = [];
  if (h.ok && h.dados.tipo === "fila") sinais.push({ n: h.dados.semContato, singular: "lead sem 1º contato", plural: "leads sem 1º contato" });
  if (a?.ok) {
    sinais.push(
      { n: a.dados.porSeveridade.critico, singular: "item crítico", plural: "itens críticos" },
      { n: a.dados.total, singular: veOrganizacao ? "sinal pedindo atenção" : "item pedindo você", plural: veOrganizacao ? "sinais pedindo atenção" : "itens pedindo você" },
    );
  }
  if (ag?.ok) sinais.push({ n: ag.dados.reunioes, singular: "reunião hoje", plural: "reuniões hoje" });
  const completo = (a === null || a.ok) && (ag === null || ag.ok);

  const primeiroNome = (entrada.userName || "").trim().split(/\s+/)[0];
  const saudacao = saudacaoDaHora(horaEmSaoPaulo(agora));

  return {
    lente,
    saudacao: primeiroNome ? `${saudacao}, ${primeiroNome}.` : `${saudacao}.`,
    data: dataPorExtenso(agora),
    organizacao: nomeOrg,
    geradoEm: agora.toISOString(),
    foco: lente === "leitor" ? null : focoDoDia(sinais, completo),
    hero: h,
    kpis: k,
    atencao: a,
    funil: f,
    agenda: ag,
    saude: s,
    entrega: e,
    financeiro: fi,
    atalhos: ATALHOS[lente],
    podeAgir: perm.acoes,
  };
}
