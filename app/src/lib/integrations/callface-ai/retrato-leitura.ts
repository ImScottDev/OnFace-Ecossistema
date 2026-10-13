/**
 * O RETRATO DO CLIENTE NA PLATAFORMA CALLFACE AI. Leitura que a tela consome.
 *
 *   const r = await lerRetratoCallfaceAi(tenant.organizacaoId, empresaId);
 *
 * `organizacaoId` vem SEMPRE de `getTenantContext` (servidor); `empresaId` é a
 * empresa do CRM. A empresa precisa pertencer à organização, senão devolve
 * `conectado: false`. Lê só o modelo LOCAL (espelho das tabelas `callface_ai_*`,
 * migration 0123 + as anteriores); nunca o banco do SaaS. Sync parado não
 * derruba a leitura: devolve o último espelho e `sincronizacao`/`idadeDias`
 * dizem de quando ele é.
 *
 * FORMA (campos que a tela pode usar sem recalcular nada):
 *   conectado            false = empresa sem organização vinculada na plataforma (o resto vem vazio)
 *   situacao             'pagante' | 'via_parceiro' | 'trial' | 'interno' | 'sem_licenca_ativa'
 *   pagante              só assinatura paga vigente. TRIAL, INTERNAL e parceiro não contam
 *   stripe               { conectado, estado: 'conectado'|'nao_conectado', stripeCustomerId, migrado }
 *   plano.principal      { nome, precoTabela, stripePriceId, intervalo, quantidade, ... } | null
 *   plano.porPlano[]     um item por (plano, tipo de licença) entre as licenças vigentes
 *   licencas             { ativas, vencendo30d, porTipo: { trial|pago|interno|white_label|outro: { ativas, atribuidas, venceEm } } }
 *   usuarios             { total, ativos, desativados, pendentes, porPapel: { CREATOR|ADMIN|MANAGER|EMPLOYEE: {...} }, comVinculoCrm }
 *   usuariosVinculados[] { crmUserId, papel, ativo }: ponte direta com o usuário do ONFACE
 *   equipes              { workspaces[], equipes[] } ({ nome, status })
 *   receptivos           { total, disponiveis, indisponiveis, semInformacao, lista[] } (número, destino, disponibilidade)
 *   uso                  UsoCallfaceAiDaEmpresa (minutos = TARIFADOS) + minutosDuracao e chamadasSemTarifa da janela de 30 dias
 *   sincronizacao        { status, ultimoSucessoEm, erro, idadeDias }: erro lista blocos que não puderam ser lidos
 *   lacunas[]            o que este retrato NÃO tem, para a tela não inventar (ver abaixo)
 *
 * `precoTabela` é o preço do PLANO no SaaS, não o valor cobrado: desconto e
 * negociação vivem na fatura do Stripe. Um valor ausente é `null`, nunca zero.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { lerUsoCallfaceAi, type UsoCallfaceAiDaEmpresa } from "./leitura-dominio";
import { montarRetrato, usuarioAtivo } from "./retrato-regras";

type Retrato = ReturnType<typeof montarRetrato>;

export interface RetratoCallfaceAi extends Partial<Retrato> {
  conectado: boolean;
  organizationId: string | null;
  coletadoEm: string | null;
  usuariosVinculados: Array<{ crmUserId: string; papel: string; ativo: boolean }>;
  equipes: { workspaces: Array<{ nome: string | null; status: string | null }>; equipes: Array<{ nome: string | null; status: string | null }> };
  receptivos: {
    total: number; disponiveis: number; indisponiveis: number; semInformacao: number;
    lista: Array<{ numero: string; destinoTipo: string | null; destinoId: string | null; disponivel: boolean | null }>;
  };
  uso: (UsoCallfaceAiDaEmpresa & { minutosDuracao: number | null; chamadasSemTarifa: number | null }) | null;
  sincronizacao: { status: string | null; ultimoSucessoEm: string | null; erro: string | null; idadeDias: number | null };
  lacunas: string[];
}

const iso = (d: Date | string | null | undefined): string | null => (d ? (d instanceof Date ? d.toISOString() : String(d)) : null);

const VAZIO: RetratoCallfaceAi = {
  conectado: false, organizationId: null, coletadoEm: null, usuariosVinculados: [],
  equipes: { workspaces: [], equipes: [] },
  receptivos: { total: 0, disponiveis: 0, indisponiveis: 0, semInformacao: 0, lista: [] },
  uso: null, sincronizacao: { status: null, ultimoSucessoEm: null, erro: null, idadeDias: null },
  lacunas: ["empresa sem organização vinculada na plataforma Callface AI"],
};

export async function lerRetratoCallfaceAi(organizacaoId: string, empresaId: string, agora: Date = new Date()): Promise<RetratoCallfaceAi> {
  const [ident] = await db.execute<{ external_id: string }>(sql`
    SELECT i.external_id
      FROM callface_ai_external_identities i
      JOIN empresas e ON e.id = i.entity_id
     WHERE i.entity_type = 'empresa' AND i.entity_id = ${empresaId}::uuid
       AND e.organizacao_id = ${organizacaoId}::uuid
       AND i.provider = 'callface_ai' AND i.external_type = 'organization'
     LIMIT 1`);
  if (!ident) return VAZIO;

  const org = sql`${organizacaoId}::uuid`;
  const ext = ident.external_id;
  const [licencas, planos, usuarios, stripe, equipes, receptivos, estado, usoBase, tarifa] = await Promise.all([
    db.execute<{ id: string; plano: string | null; motivo: string; rev: Date | null; exp: Date | null; atr: boolean; coletado: Date }>(sql`
      SELECT license_id AS id, plan_id AS plano, motivo, revogada_em AS rev, expira_em AS exp, atribuida AS atr, coletado_em AS coletado
        FROM callface_ai_licencas WHERE organizacao_id = ${org} AND external_organization_id = ${ext}`),
    db.execute<{ id: string; nome: string | null; preco: string | null; sp: string | null; iv: string | null }>(sql`
      SELECT plan_id AS id, nome, preco::text, stripe_price_id AS sp, intervalo AS iv
        FROM callface_ai_planos WHERE organizacao_id = ${org}`),
    db.execute<{ papel: string; aceite: string | null; convite: string | null; des: Date | null; ativo: boolean; crm: string | null }>(sql`
      SELECT papel, aceite, convite, desativado_em AS des, usuario_ativo AS ativo, crm_user_id AS crm
        FROM callface_ai_usuarios WHERE organizacao_id = ${org} AND external_organization_id = ${ext}`),
    db.execute<{ cus: string | null; mig: boolean | null; coletado: Date }>(sql`
      SELECT stripe_customer_id AS cus, stripe_migrado AS mig, coletado_em AS coletado
        FROM callface_ai_org_stripe WHERE organizacao_id = ${org} AND external_organization_id = ${ext}`),
    db.execute<{ tipo: string; nome: string | null; status: string | null }>(sql`
      SELECT tipo, nome, status FROM callface_ai_equipes
       WHERE organizacao_id = ${org} AND external_organization_id = ${ext} ORDER BY tipo, nome`),
    db.execute<{ numero: string; dt: string | null; di: string | null; disp: boolean | null }>(sql`
      SELECT numero, destino_tipo AS dt, destino_id AS di, disponivel AS disp FROM callface_ai_receptivos
       WHERE organizacao_id = ${org} AND external_organization_id = ${ext} ORDER BY numero`),
    db.execute<{ status: string; ultimo_sucesso_em: Date | null; erro: string | null }>(sql`
      SELECT status, ultimo_sucesso_em, erro FROM integracao_sync_estado
       WHERE organizacao_id = ${org} AND provider = 'callface_ai' AND recurso = 'retrato'`),
    lerUsoCallfaceAi(empresaId),
    db.execute<{ md: string | null; st: number | null }>(sql`
      SELECT s.minutos_duracao::text AS md, s.chamadas_sem_tarifa AS st
        FROM callface_ai_tenant_snapshots s
        JOIN callface_ai_external_identities i ON i.id = s.external_identity_id
       WHERE i.entity_type = 'empresa' AND i.entity_id = ${empresaId}::uuid AND i.external_type = 'organization'
         AND s.janela_dias = 30
       ORDER BY s.snapshot_at DESC LIMIT 1`),
  ]);

  const dado = montarRetrato({
    licencas: licencas.map((l) => ({ licenseId: l.id, planId: l.plano, motivo: l.motivo, revogadaEm: l.rev, expiraEm: l.exp, atribuida: l.atr })),
    planos: planos.map((p) => ({ planId: p.id, nome: p.nome, preco: p.preco === null ? null : Number(p.preco), stripePriceId: p.sp, intervalo: p.iv })),
    usuarios: usuarios.map((u) => ({ papel: u.papel, aceite: u.aceite, convite: u.convite, desativadoEm: u.des, usuarioAtivo: u.ativo, crmUserId: u.crm })),
    stripe: stripe[0] ? { stripeCustomerId: stripe[0].cus, migrado: stripe[0].mig } : null,
  }, agora);

  const coletados = [...licencas.map((l) => l.coletado), ...stripe.map((s) => s.coletado)];
  const coletadoEm = coletados.length ? new Date(Math.max(...coletados.map((d) => d.getTime()))) : null;
  const e = estado[0];
  const lacunas: string[] = [];
  if (!e) lacunas.push("o espelho do retrato ainda não foi sincronizado");
  else if (e.erro) lacunas.push(e.erro);
  if (e && !stripe.length) lacunas.push("organização fora do último espelho do Stripe");
  if (planos.every((p) => p.preco === null)) lacunas.push("preço de tabela dos planos indisponível");
  lacunas.push("preço de tabela não é o valor cobrado: desconto e negociação ficam na fatura do Stripe");

  return {
    ...dado,
    conectado: true,
    organizationId: ext,
    coletadoEm: iso(coletadoEm),
    usuariosVinculados: usuarios.filter((u) => u.crm).map((u) => ({ crmUserId: u.crm as string, papel: u.papel, ativo: usuarioAtivo({ desativadoEm: u.des, usuarioAtivo: u.ativo }) })),
    equipes: {
      workspaces: equipes.filter((x) => x.tipo === "workspace").map((x) => ({ nome: x.nome, status: x.status })),
      equipes: equipes.filter((x) => x.tipo === "equipe").map((x) => ({ nome: x.nome, status: x.status })),
    },
    receptivos: {
      total: receptivos.length,
      disponiveis: receptivos.filter((r) => r.disp === true).length,
      indisponiveis: receptivos.filter((r) => r.disp === false).length,
      semInformacao: receptivos.filter((r) => r.disp === null).length,
      lista: receptivos.map((r) => ({ numero: r.numero, destinoTipo: r.dt, destinoId: r.di, disponivel: r.disp })),
    },
    uso: usoBase.conectado
      ? { ...usoBase, minutosDuracao: tarifa[0]?.md == null ? null : Number(tarifa[0].md), chamadasSemTarifa: tarifa[0]?.st ?? null }
      : null,
    sincronizacao: {
      status: e?.status ?? null, ultimoSucessoEm: iso(e?.ultimo_sucesso_em ?? null), erro: e?.erro ?? null,
      idadeDias: coletadoEm ? Math.floor((agora.getTime() - coletadoEm.getTime()) / 86_400_000) : null,
    },
    lacunas,
  };
}
