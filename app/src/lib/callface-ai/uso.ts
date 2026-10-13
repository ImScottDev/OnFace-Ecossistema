/**
 * CONTRATO DE LEITURA da Callface AI para as telas, o CS e o NEXO.
 *
 * Como usar (só em código de servidor — Server Component, route handler, server
 * action, worker; NUNCA em Client Component, porque importa `db`):
 *
 *   const ctx = await getTenantContext();                 // organizacaoId vem da SESSÃO
 *   const uso = await usoDoCliente(ctx.organizacaoId, empresaOuClienteId);
 *   const carteira = await carteiraDeUso(ctx.organizacaoId, { somenteComFlag: true });
 *   const fila = await vinculosPendentes(ctx.organizacaoId);
 *
 * Confirmar / alterar / remover vínculo: server actions em `./vinculo-actions`.
 *
 * Garantias:
 *   - Todas as funções filtram por `organizacaoId` do ONFACE (o id de empresa/cliente
 *     de outra organização devolve `null`/lista vazia).
 *   - Leem SÓ o modelo local sincronizado (`callface_ai_*`). Nenhuma abre o banco do
 *     SaaS; se o sync parar, devolvem o último dado e `sincronizacao.idadeHoras` cresce.
 *   - Sem vínculo: `vinculo.estado` = "pendente" (há sugestão) ou "sem" — e os blocos de
 *     uso vêm `null`. Nunca número inventado.
 *   - Datas e "hoje/mês" são em America/Sao_Paulo. Minutos já descontam sessão que nunca
 *     fechou (teto de 2 h por ligação).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { resumoLicencas, type LicencasResumo } from "./uso-regras";
import { PESO_SEMAFORO, type MotivoSaude, type Semaforo } from "./saude-regras";

export type { LicencasResumo } from "./uso-regras";
export type { Semaforo } from "./saude-regras";
/** O sinal que a tela mostra É o motivo do semáforo: uma fonte (`saude-regras`), nenhuma conta na tela. */
export type FlagUso = MotivoSaude;

export type EstadoVinculo = "auto" | "confirmado" | "manual" | "pendente" | "sem";

export interface EvidenciaDoVinculo {
  origem: "auto" | "manual" | "confirmado";
  regra: string;
  sinais: Array<{ chave: string; valor: string; onface: string; saas: string }>;
  decididoEm: string;
  [k: string]: unknown;
}

export interface SugestaoDeVinculo {
  candidatoId: string;
  orgCallfaceId: string;
  nomeOrg: string | null;
  score: number;
  sinal: string;
  razao: string | null;
  evidencia: Record<string, unknown> | null;
}

export interface VinculoCallfaceAi {
  estado: EstadoVinculo;
  orgCallfaceId: string | null;
  nomeOrg: string | null;
  evidencia: EvidenciaDoVinculo | null;
  vinculadoEm: string | null;
  /** Quem confirmou/alterou (nome), quando o estado é confirmado/manual. */
  decididoPor: string | null;
  /** Sugestões abertas (estado "pendente"); vazio quando já vinculado. */
  sugestoes: SugestaoDeVinculo[];
}

export interface SincronizacaoCallfaceAi {
  status: string | null;
  ultimoSyncEm: string | null;
  ultimoSucessoEm: string | null;
  erro: string | null;
  /** Horas desde o último sucesso; null se nunca houve. */
  idadeHoras: number | null;
}

export interface UsuarioDeUso {
  nome: string | null; email: string | null; papel: string; aceite: string; ativo: boolean;
  ultimaChamadaEm: string | null; chamadas7d: number; chamadas30d: number;
}
export interface DiaDeUso { dia: string; chamadas: number; finalizadas: number; minutos: number; usuariosAtivos: number }
export interface CampanhaDeUso { nome: string; status: string; total: number; discados: number; atualizadaEm: string | null }
export interface AgenteDeUso { nome: string; status: string; criadoEm: string | null }

export interface UsoDoCliente {
  empresaId: string;
  empresaNome: string;
  vinculo: VinculoCallfaceAi;
  sincronizacao: SincronizacaoCallfaceAi;
  /** null enquanto não houver vínculo com dado sincronizado. */
  plano: null | {
    principal: string | null;
    porPlano: Array<{ plano: string; motivo: string; licencas: number; atribuidas: number; minutos: number; semLimite: boolean }>;
    licencas: LicencasResumo;
  };
  minutos: null | {
    hoje: number; d7: number; d30: number; mesCorrente: number;
    /** Minutos contratados (soma dos limites das licenças pagas); null = sem limite/ilimitado. */
    contratadosMes: number | null;
    percentualDoLimite: number | null;
  };
  ligacoes: null | {
    hoje: number; d7: number; d30: number; mesCorrente: number;
    taxaConexao30d: number | null;
    /** Chamadas que podem ser desta conta mas não entram no total (ver regra de atribuição). */
    ambiguas30d: number;
    /** 90 dias corridos, um item por dia (zeros preenchidos), do mais antigo ao mais novo. */
    serieDiaria90d: DiaDeUso[];
  };
  usuarios: null | {
    total: number; ativos: number; pendentes: number;
    comAtividade7d: number; comAtividade30d: number;
    lista: UsuarioDeUso[];
  };
  campanhas: null | { ativas: number; concluidas30d: number; porStatus: Record<string, number>; recentes: CampanhaDeUso[] };
  agentes: null | { prontos: number; porStatus: Record<string, number>; lista: AgenteDeUso[] };
  integracoes: null | { apps: Array<{ nome: string; ativo: boolean }>; appsAtivos: number; webhooksAtivos: number };
  ultimaAtividadeEm: string | null;
  diasSemAtividade: number | null;
  flags: FlagUso[];
  /** Semáforo do dia e as fontes da última atividade. null enquanto a saúde diária não foi calculada. */
  saude: null | SaudeDoCliente;
  /** Tarefas de CS abertas que a saúde de uso gerou para este cliente. */
  tarefas: TarefaDeUso[];
}

export interface TarefaDeUso { id: string; titulo: string; venceEm: string | null; prioridade: string; responsavel: string | null; motivo: string }

export interface SaudeDoCliente {
  semaforo: Semaforo;
  /** Dia (AAAA-MM-DD, SP) da linha lida e horas desde o cálculo: saúde velha é dita velha. */
  dia: string;
  idadeHoras: number | null;
  ultimaChamadaEm: string | null;
  ultimaCopilotoEm: string | null;
  ultimaReuniaoEm: string | null;
  inicioEm: string | null;
  licencaVenceEm: string | null;
  copiloto: { sessoes30d: number; sugestoes30d: number; usadas30d: number; adocaoPct: number | null };
  assinaturas: { total: number; canceladas: number; canceladaEm: string | null; motivo: string | null };
  minutos14d: number; minutos14dAnteriores: number;
}

const iso = (d: Date | string | null | undefined) => (d ? (d instanceof Date ? d.toISOString() : new Date(d).toISOString()) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hoje e primeiro dia do mês em São Paulo, no mesmo formato do `dia` da série. */
function datasDeReferencia(agora = new Date()) {
  const hoje = new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  return { hoje, mes: `${hoje.slice(0, 7)}-01` };
}

/** Aceita id de empresa OU de cliente (carteira). Devolve a empresa dentro da organização, ou null. */
async function empresaDaOrganizacao(organizacaoId: string, id: string): Promise<{ id: string; nome: string } | null> {
  if (!UUID.test(id)) return null;
  const [e] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT e.id::text, e.nome FROM empresas e
     WHERE e.organizacao_id = ${organizacaoId}::uuid
       AND (e.id = ${id}::uuid OR e.id = (SELECT c.empresa_id FROM clientes c
                                            WHERE c.id = ${id}::uuid AND c.organizacao_id = ${organizacaoId}::uuid))
     LIMIT 1`);
  return e ?? null;
}

async function lerSugestoes(organizacaoId: string, empresaId: string): Promise<SugestaoDeVinculo[]> {
  const l = await db.execute<{
    id: string; org: string; org_nome: string | null; score: string | null; sinal: string;
    razao: string | null; evidencia: Record<string, unknown> | null;
  }>(sql`
    SELECT c.id::text, c.external_organization_id AS org, c.org_nome, c.score, c.match_signal AS sinal, c.razao, c.evidencia
      FROM callface_ai_reconciliation_candidates c JOIN empresas e ON e.id = c.empresa_id
     WHERE c.empresa_id = ${empresaId}::uuid AND e.organizacao_id = ${organizacaoId}::uuid AND c.status = 'pendente'
     ORDER BY c.score DESC NULLS LAST, c.created_at`);
  return l.map((x) => ({
    candidatoId: x.id, orgCallfaceId: x.org, nomeOrg: x.org_nome, score: Number(x.score ?? 0),
    sinal: x.sinal, razao: x.razao, evidencia: x.evidencia,
  }));
}


// ───────────────────────────────────────────────────────────────────────────
// Saúde diária: a linha MAIS RECENTE de cada cliente. Uma leitura para o
// Cliente 360, a carteira, o Início e o NEXO — nenhuma tela refaz a conta.
// ───────────────────────────────────────────────────────────────────────────

interface LinhaSaudeDiaria extends Record<string, unknown> {
  dia: string; ultima_atividade_em: Date | null; ultima_chamada_em: Date | null; ultima_copiloto_em: Date | null;
  ultima_reuniao_em: Date | null; inicio_em: Date | null; licenca_vence_em: Date | null; semaforo: Semaforo;
  motivos: MotivoSaude[]; calculado_em: Date; idade_h: number | null;
  copiloto_sessoes_30d: number | null; copiloto_sugestoes_30d: number | null; copiloto_usadas_30d: number | null;
  assinaturas_total: number | null; assinaturas_canceladas: number | null; cancelada_em: Date | null; cancelamento_motivo: string | null;
  minutos_14d: string | null; minutos_14d_anteriores: string | null;
}

async function lerSaudeDaIdentidade(identityId: string): Promise<LinhaSaudeDiaria | null> {
  const [r] = await db.execute<LinhaSaudeDiaria>(sql`
    SELECT dia::text, ultima_atividade_em, ultima_chamada_em, ultima_copiloto_em, ultima_reuniao_em, inicio_em,
           licenca_vence_em, semaforo, motivos, calculado_em,
           EXTRACT(epoch FROM now() - calculado_em)::float / 3600 AS idade_h,
           copiloto_sessoes_30d, copiloto_sugestoes_30d, copiloto_usadas_30d,
           assinaturas_total, assinaturas_canceladas, cancelada_em, cancelamento_motivo,
           minutos_14d::text, minutos_14d_anteriores::text
      FROM callface_ai_saude_diaria WHERE external_identity_id = ${identityId}::uuid
     ORDER BY dia DESC, calculado_em DESC LIMIT 1`);
  return r ?? null;
}

function saudeDoCliente(r: LinhaSaudeDiaria): SaudeDoCliente {
  const sug = r.copiloto_sugestoes_30d ?? 0, usa = r.copiloto_usadas_30d ?? 0;
  return {
    semaforo: r.semaforo, dia: r.dia, idadeHoras: r.idade_h != null ? Math.round(r.idade_h * 10) / 10 : null,
    ultimaChamadaEm: iso(r.ultima_chamada_em), ultimaCopilotoEm: iso(r.ultima_copiloto_em), ultimaReuniaoEm: iso(r.ultima_reuniao_em),
    inicioEm: iso(r.inicio_em), licencaVenceEm: iso(r.licenca_vence_em),
    copiloto: { sessoes30d: r.copiloto_sessoes_30d ?? 0, sugestoes30d: sug, usadas30d: usa, adocaoPct: sug > 0 ? Math.round((usa / sug) * 1000) / 10 : null },
    assinaturas: { total: r.assinaturas_total ?? 0, canceladas: r.assinaturas_canceladas ?? 0, canceladaEm: iso(r.cancelada_em), motivo: r.cancelamento_motivo },
    minutos14d: Number(r.minutos_14d ?? 0), minutos14dAnteriores: Number(r.minutos_14d_anteriores ?? 0),
  };
}

async function tarefasDeUsoDaEmpresa(organizacaoId: string, empresaId: string): Promise<TarefaDeUso[]> {
  const l = await db.execute<{ id: string; titulo: string; vence_em: Date | null; prioridade: string; responsavel: string | null; motivo: string | null }>(sql`
    SELECT t.id::text, t.titulo, t.vence_em, t.prioridade, u.nome AS responsavel, t.motivo
      FROM tarefas t LEFT JOIN usuarios u ON u.id = t.usuario_id
     WHERE t.organizacao_id = ${organizacaoId}::uuid AND t.empresa_id = ${empresaId}::uuid
       AND t.tipo LIKE 'cs\\_uso\\_%' AND t.origem = 'AUTOMACAO'
       AND t.concluida = false AND t.status NOT IN ('concluida', 'declinada')
     ORDER BY t.vence_em NULLS LAST`);
  return l.map((x) => ({ id: x.id, titulo: x.titulo, venceEm: iso(x.vence_em), prioridade: x.prioridade, responsavel: x.responsavel, motivo: x.motivo ?? "" }));
}

/** O estado do sincronizador, para a tela dizer a verdade quando não há dado ("nunca rodou" × "rodou e não achou"). */
export async function estadoDoSincronizador(organizacaoId: string): Promise<SincronizacaoCallfaceAi> {
  const [estado] = await db.execute<{ status: string; ultimo_sync_em: Date | null; ultimo_sucesso_em: Date | null; erro: string | null; idade_h: number | null }>(sql`
    SELECT status, ultimo_sync_em, ultimo_sucesso_em, erro,
           EXTRACT(epoch FROM now() - ultimo_sucesso_em)::float / 3600 AS idade_h
      FROM integracao_sync_estado
     WHERE organizacao_id = ${organizacaoId}::uuid AND provider = 'callface_ai' AND recurso = 'tenant_snapshot'`);
  return {
    status: estado?.status ?? null, ultimoSyncEm: iso(estado?.ultimo_sync_em), ultimoSucessoEm: iso(estado?.ultimo_sucesso_em),
    erro: estado?.erro ?? null, idadeHoras: estado?.idade_h != null ? Math.round(estado.idade_h * 10) / 10 : null,
  };
}

export async function usoDoCliente(organizacaoId: string, clienteOuEmpresaId: string): Promise<UsoDoCliente | null> {
  const empresa = await empresaDaOrganizacao(organizacaoId, clienteOuEmpresaId);
  if (!empresa) return null;

  const [ident] = await db.execute<{
    id: string; external_id: string; estado: string; evidencia: EvidenciaDoVinculo | null; org_nome: string | null;
    verified_at: Date | null; decidido_por: string | null;
  }>(sql`
    SELECT i.id::text, i.external_id, i.estado, i.evidencia, i.org_nome, i.verified_at,
           (SELECT u.nome FROM audit_log a JOIN usuarios u ON u.id = a.actor_id
             WHERE a.entity_type = 'empresa' AND a.entity_id = i.entity_id AND a.actor_id IS NOT NULL
               AND a.action LIKE 'callface_ai.vinculo.%' AND a.organizacao_id = ${organizacaoId}::uuid
             ORDER BY a.created_at DESC LIMIT 1) AS decidido_por
      FROM callface_ai_external_identities i
     WHERE i.entity_type = 'empresa' AND i.entity_id = ${empresa.id}::uuid
       AND i.provider = 'callface_ai' AND i.external_type = 'organization' LIMIT 1`);

  const [estado] = await db.execute<{ status: string; ultimo_sync_em: Date | null; ultimo_sucesso_em: Date | null; erro: string | null; idade_h: number | null }>(sql`
    SELECT status, ultimo_sync_em, ultimo_sucesso_em, erro,
           EXTRACT(epoch FROM now() - ultimo_sucesso_em)::float / 3600 AS idade_h
      FROM integracao_sync_estado
     WHERE organizacao_id = ${organizacaoId}::uuid AND provider = 'callface_ai' AND recurso = 'tenant_snapshot'`);
  const sincronizacao: SincronizacaoCallfaceAi = {
    status: estado?.status ?? null, ultimoSyncEm: iso(estado?.ultimo_sync_em), ultimoSucessoEm: iso(estado?.ultimo_sucesso_em),
    erro: estado?.erro ?? null, idadeHoras: estado?.idade_h != null ? Math.round(estado.idade_h * 10) / 10 : null,
  };

  const vazio = (vinculo: VinculoCallfaceAi): UsoDoCliente => ({
    empresaId: empresa.id, empresaNome: empresa.nome, vinculo, sincronizacao,
    plano: null, minutos: null, ligacoes: null, usuarios: null, campanhas: null, agentes: null, integracoes: null,
    ultimaAtividadeEm: null, diasSemAtividade: null, flags: [], saude: null, tarefas: [],
  });

  if (!ident) {
    const sugestoes = await lerSugestoes(organizacaoId, empresa.id);
    return vazio({
      estado: sugestoes.length ? "pendente" : "sem", orgCallfaceId: null, nomeOrg: null, evidencia: null,
      vinculadoEm: null, decididoPor: null, sugestoes,
    });
  }

  const vinculo: VinculoCallfaceAi = {
    estado: (ident.estado as EstadoVinculo) ?? "auto", orgCallfaceId: ident.external_id, nomeOrg: ident.org_nome,
    evidencia: ident.evidencia, vinculadoEm: iso(ident.verified_at), decididoPor: ident.decidido_por, sugestoes: [],
  };

  const { hoje, mes } = datasDeReferencia();
  const [snaps, [det], serie, saudeRow, tarefasAbertas] = await Promise.all([
    db.execute<{
      janela_dias: number; chamadas_total: number; chamadas_finalizadas: number; chamadas_ambiguas: number | null;
      usuarios_total: number; usuarios_ativos: number; usuarios_pendentes: number; usuarios_com_atividade: number | null;
      campanhas_ativas: number; campanhas_concluidas: number; agentes_prontos: number; apps_ativos: number | null;
      webhooks_ativos: number | null; ultima_atividade_em: Date | null; dias_sem_atividade: number | null;
    }>(sql`
      SELECT DISTINCT ON (janela_dias) janela_dias, chamadas_total, chamadas_finalizadas, chamadas_ambiguas,
             usuarios_total, usuarios_ativos, usuarios_pendentes, usuarios_com_atividade, campanhas_ativas,
             campanhas_concluidas, agentes_prontos, apps_ativos, webhooks_ativos, ultima_atividade_em,
             EXTRACT(day FROM now() - ultima_atividade_em)::int AS dias_sem_atividade
        FROM callface_ai_tenant_snapshots WHERE external_identity_id = ${ident.id}::uuid
       ORDER BY janela_dias, snapshot_at DESC`),
    db.execute<Record<string, unknown>>(sql`
      SELECT licencas, usuarios, campanhas, agentes, integracoes FROM callface_ai_tenant_detalhe
       WHERE external_identity_id = ${ident.id}::uuid`).then((r) => r.length ? r : [undefined as unknown as Record<string, unknown>]),
    db.execute<{ dia: string; chamadas: number; finalizadas: number; minutos: string; usuarios_ativos: number }>(sql`
      SELECT dia::text, chamadas, finalizadas, minutos, usuarios_ativos FROM callface_ai_uso_diario
       WHERE external_identity_id = ${ident.id}::uuid AND dia > (${hoje}::date - 90) ORDER BY dia`),
    lerSaudeDaIdentidade(ident.id),
    tarefasDeUsoDaEmpresa(organizacaoId, empresa.id),
  ]);

  if (!snaps.length && !det) return vazio(vinculo); // vinculado, ainda sem coleta

  const s30 = snaps.find((s) => s.janela_dias === 30) ?? snaps[0];
  const s7 = snaps.find((s) => s.janela_dias === 7);
  const porDia = new Map(serie.map((d) => [d.dia, d]));
  const dias: DiaDeUso[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(`${hoje}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10), x = porDia.get(k);
    dias.push({ dia: k, chamadas: x?.chamadas ?? 0, finalizadas: x?.finalizadas ?? 0, minutos: Number(x?.minutos ?? 0), usuariosAtivos: x?.usuarios_ativos ?? 0 });
  }
  const soma = (de: string, f: (d: DiaDeUso) => number) => Math.round(dias.filter((d) => d.dia >= de).reduce((a, d) => a + f(d), 0) * 100) / 100;
  const dMenos = (n: number) => { const d = new Date(`${hoje}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const min = { hoje: soma(hoje, (d) => d.minutos), d7: soma(dMenos(6), (d) => d.minutos), d30: soma(dMenos(29), (d) => d.minutos), mes: soma(mes, (d) => d.minutos) };
  const lig = { hoje: soma(hoje, (d) => d.chamadas), d7: soma(dMenos(6), (d) => d.chamadas), d30: soma(dMenos(29), (d) => d.chamadas), mes: soma(mes, (d) => d.chamadas) };

  const lic = (det?.licencas ?? {}) as { porPlano?: Array<{ plano: string; motivo: string; qtd: number; atribuidas: number; minutos: number; semLimite: boolean }> };
  const porPlano = (lic.porPlano ?? []).map((p) => ({ plano: p.plano, motivo: p.motivo, licencas: p.qtd, atribuidas: p.atribuidas, minutos: p.minutos, semLimite: p.semLimite }));
  const licencas = resumoLicencas(porPlano, s30?.usuarios_com_atividade ?? 0);
  const planoPrincipal = [...porPlano].filter((p) => p.motivo !== "TRIAL").sort((a, b) => b.licencas - a.licencas)[0]?.plano ?? porPlano[0]?.plano ?? null;
  const contratadosMes = licencas.minutosSemLimite || !licencas.minutosContratados ? null : licencas.minutosContratados;
  const pct = contratadosMes ? Math.round((min.mes / contratadosMes) * 1000) / 10 : null;

  const usu = ((det?.usuarios ?? []) as Array<Omit<UsuarioDeUso, "ultimaChamadaEm"> & { ultimaChamadaEm: string | null; nome: string | null; email: string | null }>);
  const camp = (det?.campanhas ?? { porStatus: {}, recentes: [] }) as { porStatus: Record<string, number>; recentes: CampanhaDeUso[] };
  const ag = (det?.agentes ?? { porStatus: {}, lista: [] }) as { porStatus: Record<string, number>; lista: AgenteDeUso[] };
  const integ = (det?.integracoes ?? { apps: [], webhooksAtivos: 0 }) as { apps: Array<{ nome: string; ativo: boolean }>; webhooksAtivos: number };

  const resultado: UsoDoCliente = {
    ...vazio(vinculo),
    plano: { principal: planoPrincipal, porPlano, licencas },
    minutos: { hoje: min.hoje, d7: min.d7, d30: min.d30, mesCorrente: min.mes, contratadosMes, percentualDoLimite: pct },
    ligacoes: {
      hoje: lig.hoje, d7: lig.d7, d30: lig.d30, mesCorrente: lig.mes,
      taxaConexao30d: s30 && s30.chamadas_total > 0 ? Math.round((s30.chamadas_finalizadas / s30.chamadas_total) * 1000) / 10 : null,
      ambiguas30d: s30?.chamadas_ambiguas ?? 0, serieDiaria90d: dias,
    },
    usuarios: {
      total: s30?.usuarios_total ?? 0, ativos: s30?.usuarios_ativos ?? 0, pendentes: s30?.usuarios_pendentes ?? 0,
      comAtividade7d: s7?.usuarios_com_atividade ?? 0, comAtividade30d: s30?.usuarios_com_atividade ?? 0,
      lista: usu.slice(0, 15).map((u) => ({ ...u, ultimaChamadaEm: iso(u.ultimaChamadaEm) })),
    },
    campanhas: { ativas: s30?.campanhas_ativas ?? 0, concluidas30d: s30?.campanhas_concluidas ?? 0, porStatus: camp.porStatus, recentes: camp.recentes },
    agentes: { prontos: s30?.agentes_prontos ?? 0, porStatus: ag.porStatus, lista: ag.lista },
    integracoes: { apps: integ.apps, appsAtivos: s30?.apps_ativos ?? integ.apps.filter((a) => a.ativo).length, webhooksAtivos: s30?.webhooks_ativos ?? integ.webhooksAtivos },
    // A ÚLTIMA ATIVIDADE vem da saúde diária (sem janela: chamada, copiloto ou
    // reunião). O snapshot de 7/30 dias devolve NULL para quem parou há mais
    // de 30 dias, justamente o cliente que o CS precisa ligar.
    ultimaAtividadeEm: saudeRow ? iso(saudeRow.ultima_atividade_em) : iso(s30?.ultima_atividade_em),
    diasSemAtividade: saudeRow?.ultima_atividade_em
      ? Math.max(0, Math.floor((Date.now() - new Date(saudeRow.ultima_atividade_em).getTime()) / 86_400_000))
      : (s30?.dias_sem_atividade ?? null),
    flags: saudeRow ? (saudeRow.motivos ?? []) : [],
    saude: saudeRow ? saudeDoCliente(saudeRow) : null,
    tarefas: tarefasAbertas,
  };
  return resultado;
}

// ───────────────────────────────────────────────────────────────────────────
// Carteira: uma linha por cliente vinculado, para CS / carteira / alertas.
// ───────────────────────────────────────────────────────────────────────────

export interface FiltrosCarteiraDeUso {
  /** Só quem tem ao menos um motivo de atenção (amarelo ou vermelho). */
  somenteComFlag?: boolean;
  /** Só quem tem este motivo. */
  flag?: FlagUso["codigo"];
  semaforo?: Semaforo;
  /** CS responsável pela conta (`clientes.responsavel_id`); "sem" = contas sem responsável. */
  responsavelId?: string | "sem";
  busca?: string;
  limite?: number;
}

export interface ItemCarteiraDeUso {
  empresaId: string;
  empresaNome: string;
  orgCallfaceId: string;
  estadoVinculo: Exclude<EstadoVinculo, "pendente" | "sem">;
  plano: string | null;
  minutos30d: number;
  minutos30dAnteriores: number;
  /** Variação % vs 30 dias anteriores; null quando o período anterior é zero. */
  tendenciaPct: number | null;
  usuariosAtivos30d: number;
  usuariosTotal: number | null;
  licencasContratadas: number;
  licencasEmUso: number;
  percentualMinutos: number | null;
  ultimaAtividadeEm: string | null;
  diasSemAtividade: number | null;
  /** Horas desde a coleta deste vínculo. */
  idadeDadoHoras: number | null;
  /** null = saúde diária ainda não calculada para este vínculo. */
  semaforo: Semaforo | null;
  flags: FlagUso[];
  csResponsavel: { id: string; nome: string } | null;
  tarefasAbertas: number;
}

/**
 * A carteira, ordenada do pior para o melhor. É A função de saúde da carteira:
 * a aba /clientes/uso, o Início (vermelhos do dia) e o NEXO leem por aqui.
 */
export async function carteiraDeUso(organizacaoId: string, filtros: FiltrosCarteiraDeUso = {}): Promise<ItemCarteiraDeUso[]> {
  const { hoje } = datasDeReferencia();
  const linhas = await db.execute<{
    empresa_id: string; empresa_nome: string; org: string; estado: string; licencas: unknown;
    ult: Date | null; ativos: number | null; usuarios_total: number | null; com_atividade: number | null;
    m30: string; m60: string; ch90: number; idade_h: number | null;
    semaforo: Semaforo | null; motivos: MotivoSaude[] | null; saude_ult: Date | null; tem_saude: boolean;
    min_mes: number | null; min_contr: number | null;
    cs_id: string | null; cs_nome: string | null; tarefas: number;
  }>(sql`
    SELECT e.id::text AS empresa_id, e.nome AS empresa_nome, i.external_id AS org, i.estado,
           d.licencas, coalesce(h.ultima_atividade_em, s.ultima_atividade_em) AS ult, (h.dia IS NOT NULL) AS tem_saude,
           s.usuarios_ativos AS ativos, s.usuarios_total, s.usuarios_com_atividade AS com_atividade,
           coalesce(u.m30, 0) AS m30, coalesce(u.m60, 0) AS m60, coalesce(u.ch90, 0) AS ch90,
           EXTRACT(epoch FROM now() - coalesce(s.coletado_em, s.snapshot_at))::float / 3600 AS idade_h,
           h.semaforo, h.motivos, h.ultima_atividade_em AS saude_ult,
           h.minutos_mes::float AS min_mes, h.minutos_contratados_mes::float AS min_contr,
           cli.responsavel_id::text AS cs_id, cs.nome AS cs_nome,
           (SELECT count(*)::int FROM tarefas t
             WHERE t.organizacao_id = e.organizacao_id AND t.empresa_id = e.id AND t.origem = 'AUTOMACAO'
               AND t.tipo LIKE 'cs\\_uso\\_%' AND t.concluida = false AND t.status NOT IN ('concluida', 'declinada')) AS tarefas
      FROM callface_ai_external_identities i
      JOIN empresas e ON e.id = i.entity_id AND e.organizacao_id = ${organizacaoId}::uuid
      LEFT JOIN clientes cli ON cli.empresa_id = e.id AND cli.organizacao_id = e.organizacao_id
      LEFT JOIN usuarios cs ON cs.id = cli.responsavel_id
      LEFT JOIN callface_ai_tenant_detalhe d ON d.external_identity_id = i.id
      LEFT JOIN LATERAL (
        SELECT * FROM callface_ai_tenant_snapshots t
         WHERE t.external_identity_id = i.id AND t.janela_dias = 30 ORDER BY t.snapshot_at DESC LIMIT 1) s ON TRUE
      LEFT JOIN LATERAL (
        SELECT * FROM callface_ai_saude_diaria x
         WHERE x.external_identity_id = i.id ORDER BY x.dia DESC, x.calculado_em DESC LIMIT 1) h ON TRUE
      LEFT JOIN LATERAL (
        SELECT sum(minutos) FILTER (WHERE dia > ${hoje}::date - 30) AS m30,
               sum(minutos) FILTER (WHERE dia > ${hoje}::date - 60) AS m60,
               sum(chamadas) AS ch90
          FROM callface_ai_uso_diario x WHERE x.external_identity_id = i.id AND x.dia > ${hoje}::date - 90) u ON TRUE
     WHERE i.entity_type = 'empresa' AND i.external_type = 'organization' AND i.provider = 'callface_ai'
       ${filtros.busca ? sql`AND e.nome ILIKE ${"%" + filtros.busca.trim() + "%"}` : sql``}
       ${filtros.responsavelId === "sem" ? sql`AND cli.responsavel_id IS NULL`
         : filtros.responsavelId ? sql`AND cli.responsavel_id = ${filtros.responsavelId}::uuid` : sql``}
     ORDER BY e.nome`);

  const itens: ItemCarteiraDeUso[] = linhas.map((l) => {
    const porPlano = ((l.licencas as { porPlano?: Array<{ plano: string; motivo: string; qtd: number; atribuidas: number; minutos: number; semLimite: boolean }> } | null)?.porPlano ?? [])
      .map((p) => ({ plano: p.plano, motivo: p.motivo, licencas: p.qtd, atribuidas: p.atribuidas, minutos: p.minutos, semLimite: p.semLimite }));
    const lic = resumoLicencas(porPlano, l.com_atividade ?? 0);
    const m30 = Number(l.m30), m60 = Number(l.m60), ant = Math.max(0, m60 - m30);
    // Percentual do direito do mês: minutos do mês sobre o contratado, como a saúde os gravou.
    const pctDireito = l.min_contr && l.min_contr > 0 && l.min_mes != null ? Math.round((l.min_mes / l.min_contr) * 1000) / 10 : null;
    const dias = l.ult ? Math.max(0, Math.floor((Date.now() - new Date(l.ult).getTime()) / 86_400_000)) : null;
    return {
      empresaId: l.empresa_id, empresaNome: l.empresa_nome, orgCallfaceId: l.org,
      estadoVinculo: l.estado as ItemCarteiraDeUso["estadoVinculo"],
      plano: [...porPlano].filter((p) => p.motivo !== "TRIAL").sort((a, b) => b.licencas - a.licencas)[0]?.plano ?? porPlano[0]?.plano ?? null,
      minutos30d: Math.round(m30 * 100) / 100, minutos30dAnteriores: Math.round(ant * 100) / 100,
      tendenciaPct: ant > 0 ? Math.round(((m30 - ant) / ant) * 1000) / 10 : null,
      usuariosAtivos30d: l.com_atividade ?? 0, usuariosTotal: l.usuarios_total, licencasContratadas: lic.contratadas, licencasEmUso: lic.emUso,
      percentualMinutos: pctDireito,
      ultimaAtividadeEm: iso(l.ult), diasSemAtividade: dias,
      idadeDadoHoras: l.idade_h != null ? Math.round(l.idade_h * 10) / 10 : null,
      semaforo: l.tem_saude ? l.semaforo : null,
      flags: l.motivos ?? [],
      csResponsavel: l.cs_id ? { id: l.cs_id, nome: l.cs_nome ?? "—" } : null,
      tarefasAbertas: l.tarefas ?? 0,
    };
  });

  return itens
    .filter((i) => (filtros.semaforo ? i.semaforo === filtros.semaforo : true))
    .filter((i) => (filtros.flag ? i.flags.some((f) => f.codigo === filtros.flag) : filtros.somenteComFlag ? i.semaforo === "amarelo" || i.semaforo === "vermelho" : true))
    // Pior primeiro: vermelho, amarelo, verde, sem dado; dentro do grupo, quem está há mais tempo parado.
    .sort((a, b) => PESO_SEMAFORO[a.semaforo ?? "sem_dado"] - PESO_SEMAFORO[b.semaforo ?? "sem_dado"]
      || (b.diasSemAtividade ?? -1) - (a.diasSemAtividade ?? -1) || a.empresaNome.localeCompare(b.empresaNome, "pt-BR"))
    .slice(0, filtros.limite ?? 500);
}

/** Os vermelhos do dia, do CS responsável (ou da carteira toda): Início e NEXO leem por aqui. */
export async function vermelhosDoDia(organizacaoId: string, opts: { responsavelId?: string; limite?: number } = {}): Promise<ItemCarteiraDeUso[]> {
  return carteiraDeUso(organizacaoId, { semaforo: "vermelho", responsavelId: opts.responsavelId, limite: opts.limite ?? 20 });
}

// ───────────────────────────────────────────────────────────────────────────
// Fila de vínculos para decidir.
// ───────────────────────────────────────────────────────────────────────────

export interface VinculoPendente {
  empresaId: string;
  empresaNome: string;
  cnpj: string | null;
  /** Melhor sugestão primeiro. Vazio = nenhuma organização parecida. */
  sugestoes: SugestaoDeVinculo[];
  /** "sugestao": há candidata a confirmar; "sem_sugestao": nada encontrado, precisa de busca manual. */
  situacao: "sugestao" | "sem_sugestao";
}

export async function vinculosPendentes(organizacaoId: string): Promise<VinculoPendente[]> {
  const empresas = await db.execute<{ id: string; nome: string; cnpj: string | null }>(sql`
    SELECT e.id::text, e.nome, e.cnpj FROM empresas e
     WHERE e.organizacao_id = ${organizacaoId}::uuid
       AND EXISTS (SELECT 1 FROM servicos_canonicos s WHERE s.empresa_id = e.id AND s.service_family = 'CALLFACE_AI'
                    AND s.organizacao_id = e.organizacao_id)
       AND NOT EXISTS (SELECT 1 FROM callface_ai_external_identities i
                        WHERE i.entity_type = 'empresa' AND i.entity_id = e.id AND i.external_type = 'organization')
     ORDER BY e.nome`);
  const cands = await db.execute<{
    id: string; empresa_id: string; org: string; org_nome: string | null; score: string | null; sinal: string;
    razao: string | null; evidencia: Record<string, unknown> | null;
  }>(sql`
    SELECT c.id::text, c.empresa_id::text, c.external_organization_id AS org, c.org_nome, c.score, c.match_signal AS sinal, c.razao, c.evidencia
      FROM callface_ai_reconciliation_candidates c JOIN empresas e ON e.id = c.empresa_id
     WHERE e.organizacao_id = ${organizacaoId}::uuid AND c.status = 'pendente'
     ORDER BY c.score DESC NULLS LAST`);
  const por = new Map<string, SugestaoDeVinculo[]>();
  for (const c of cands) {
    por.set(c.empresa_id, [...(por.get(c.empresa_id) ?? []), {
      candidatoId: c.id, orgCallfaceId: c.org, nomeOrg: c.org_nome, score: Number(c.score ?? 0), sinal: c.sinal, razao: c.razao, evidencia: c.evidencia,
    }]);
  }
  return empresas.map((e) => {
    const sugestoes = por.get(e.id) ?? [];
    return { empresaId: e.id, empresaNome: e.nome, cnpj: e.cnpj, sugestoes, situacao: (sugestoes.length ? "sugestao" : "sem_sugestao") as VinculoPendente["situacao"] };
  }).sort((a, b) => Number(b.sugestoes.length > 0) - Number(a.sugestoes.length > 0));
}
