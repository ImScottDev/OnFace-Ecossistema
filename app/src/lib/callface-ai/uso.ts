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
import { avaliarFlags, resumoLicencas, type FlagUso, type LicencasResumo } from "./uso-regras";

export type { FlagUso, LicencasResumo } from "./uso-regras";

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
    ultimaAtividadeEm: null, diasSemAtividade: null, flags: [],
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
  const [snaps, [det], serie] = await Promise.all([
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
    ultimaAtividadeEm: iso(s30?.ultima_atividade_em),
    diasSemAtividade: s30?.dias_sem_atividade ?? null,
    flags: [],
  };
  resultado.flags = avaliarFlags({
    diasSemAtividade: resultado.diasSemAtividade, minutos30d: min.d30,
    minutos30dAnteriores: soma(dMenos(59), (d) => d.minutos) - min.d30,
    percentualMinutos: pct, licencasEmUso: licencas.emUso, licencasContratadas: licencas.contratadas,
    chamadasNaSerie: dias.reduce((a, d) => a + d.chamadas, 0), temAtividade: resultado.ultimaAtividadeEm != null,
  });
  return resultado;
}

// ───────────────────────────────────────────────────────────────────────────
// Carteira: uma linha por cliente vinculado, para CS / carteira / alertas.
// ───────────────────────────────────────────────────────────────────────────

export interface FiltrosCarteiraDeUso {
  /** Só quem tem ao menos uma flag. */
  somenteComFlag?: boolean;
  /** Só quem tem esta flag. */
  flag?: FlagUso["codigo"];
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
  licencasContratadas: number;
  licencasEmUso: number;
  percentualMinutos: number | null;
  ultimaAtividadeEm: string | null;
  diasSemAtividade: number | null;
  /** Horas desde a coleta deste vínculo. */
  idadeDadoHoras: number | null;
  flags: FlagUso[];
}

export async function carteiraDeUso(organizacaoId: string, filtros: FiltrosCarteiraDeUso = {}): Promise<ItemCarteiraDeUso[]> {
  const { hoje, mes } = datasDeReferencia();
  const linhas = await db.execute<{
    empresa_id: string; empresa_nome: string; org: string; estado: string; licencas: unknown;
    ult: Date | null; dias_sem: number | null; ativos: number | null; com_atividade: number | null;
    m30: string; m60: string; mmes: string; ch90: number; idade_h: number | null;
  }>(sql`
    SELECT e.id::text AS empresa_id, e.nome AS empresa_nome, i.external_id AS org, i.estado,
           d.licencas, s.ultima_atividade_em AS ult,
           EXTRACT(day FROM now() - s.ultima_atividade_em)::int AS dias_sem,
           s.usuarios_ativos AS ativos, s.usuarios_com_atividade AS com_atividade,
           coalesce(u.m30, 0) AS m30, coalesce(u.m60, 0) AS m60, coalesce(u.mmes, 0) AS mmes, coalesce(u.ch90, 0) AS ch90,
           EXTRACT(epoch FROM now() - coalesce(s.coletado_em, s.snapshot_at))::float / 3600 AS idade_h
      FROM callface_ai_external_identities i
      JOIN empresas e ON e.id = i.entity_id AND e.organizacao_id = ${organizacaoId}::uuid
      LEFT JOIN callface_ai_tenant_detalhe d ON d.external_identity_id = i.id
      LEFT JOIN LATERAL (
        SELECT * FROM callface_ai_tenant_snapshots t
         WHERE t.external_identity_id = i.id AND t.janela_dias = 30 ORDER BY t.snapshot_at DESC LIMIT 1) s ON TRUE
      LEFT JOIN LATERAL (
        SELECT sum(minutos) FILTER (WHERE dia > ${hoje}::date - 30) AS m30,
               sum(minutos) FILTER (WHERE dia > ${hoje}::date - 60) AS m60,
               sum(minutos) FILTER (WHERE dia >= ${mes}::date) AS mmes,
               sum(chamadas) AS ch90
          FROM callface_ai_uso_diario x WHERE x.external_identity_id = i.id AND x.dia > ${hoje}::date - 90) u ON TRUE
     WHERE i.entity_type = 'empresa' AND i.external_type = 'organization' AND i.provider = 'callface_ai'
       ${filtros.busca ? sql`AND e.nome ILIKE ${"%" + filtros.busca.trim() + "%"}` : sql``}
     ORDER BY e.nome`);

  const itens: ItemCarteiraDeUso[] = linhas.map((l) => {
    const porPlano = ((l.licencas as { porPlano?: Array<{ plano: string; motivo: string; qtd: number; atribuidas: number; minutos: number; semLimite: boolean }> } | null)?.porPlano ?? [])
      .map((p) => ({ plano: p.plano, motivo: p.motivo, licencas: p.qtd, atribuidas: p.atribuidas, minutos: p.minutos, semLimite: p.semLimite }));
    const lic = resumoLicencas(porPlano, l.com_atividade ?? 0);
    const m30 = Number(l.m30), m60 = Number(l.m60), mmes = Number(l.mmes), ant = Math.max(0, m60 - m30);
    const contratados = lic.minutosSemLimite || !lic.minutosContratados ? null : lic.minutosContratados;
    const pct = contratados ? Math.round((mmes / contratados) * 1000) / 10 : null;
    return {
      empresaId: l.empresa_id, empresaNome: l.empresa_nome, orgCallfaceId: l.org,
      estadoVinculo: l.estado as ItemCarteiraDeUso["estadoVinculo"],
      plano: [...porPlano].filter((p) => p.motivo !== "TRIAL").sort((a, b) => b.licencas - a.licencas)[0]?.plano ?? porPlano[0]?.plano ?? null,
      minutos30d: Math.round(m30 * 100) / 100, minutos30dAnteriores: Math.round(ant * 100) / 100,
      tendenciaPct: ant > 0 ? Math.round(((m30 - ant) / ant) * 1000) / 10 : null,
      usuariosAtivos30d: l.com_atividade ?? 0, licencasContratadas: lic.contratadas, licencasEmUso: lic.emUso,
      percentualMinutos: pct, ultimaAtividadeEm: iso(l.ult), diasSemAtividade: l.dias_sem,
      idadeDadoHoras: l.idade_h != null ? Math.round(l.idade_h * 10) / 10 : null,
      flags: avaliarFlags({
        diasSemAtividade: l.dias_sem, minutos30d: m30, minutos30dAnteriores: ant, percentualMinutos: pct,
        licencasEmUso: lic.emUso, licencasContratadas: lic.contratadas, chamadasNaSerie: Number(l.ch90), temAtividade: l.ult != null,
      }),
    };
  });

  return itens
    .filter((i) => (filtros.flag ? i.flags.some((f) => f.codigo === filtros.flag) : filtros.somenteComFlag ? i.flags.length > 0 : true))
    .slice(0, filtros.limite ?? 500);
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
