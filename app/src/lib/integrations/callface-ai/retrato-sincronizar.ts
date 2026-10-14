/**
 * Espelha o retrato do cliente na plataforma Callface AI: plano, Stripe,
 * licenças, usuários por papel e estado, workspaces/equipes e receptivos.
 *
 * SOMENTE SELECT no SaaS (o adapter abre BEGIN READ ONLY). Grava o espelho local
 * numa transação: para cada bloco lido com sucesso, troca o conteúdo; bloco que
 * falhou na leitura NÃO apaga o que já estava espelhado e entra no estado com o
 * motivo (status 'parcial'). Nada é "vazio por falha".
 *
 * Multi-tenant: `organizacaoId` é o argumento (loop do worker), nunca algo lido
 * do SaaS. Só as organizações do SaaS já vinculadas a uma empresa do CRM são lidas.
 * Nenhum array JS vai ao Postgres: lotes seguem como JSON em `jsonb_to_recordset`.
 * Nenhum dado pessoal em log: só contagens.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { lerComTransacao, lerRetratoBruto } from "@onface/integrations-callface-ai";
import { tenantsVinculados } from "./identidade";
import { gravarEstado } from "./sincronizar";

export const RECURSO_RETRATO = "retrato";

const TABELAS_EXIGIDAS = [
  "callface_ai_planos", "callface_ai_org_stripe", "callface_ai_licencas",
  "callface_ai_usuarios", "callface_ai_equipes", "callface_ai_receptivos",
];

export interface ResultadoRetrato {
  ok: boolean;
  status: "ok" | "parcial" | "falhou" | "indisponivel" | "desabilitado";
  organizacoes: number;
  planos: number;
  licencas: number;
  usuarios: number;
  equipes: number;
  receptivos: number;
  /** Bloco -> motivo. Vazio = tudo lido. */
  blocosComFalha: Record<string, string>;
  /** O que o operador precisa conferir na primeira rodada. */
  avisos: string[];
  erro?: string;
  duracaoMs: number;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const LOTE = 1000;
function emLotes<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += LOTE) out.push(xs.slice(i, i + LOTE));
  return out;
}

export async function sincronizarRetratoCallfaceAi(organizacaoId: string): Promise<ResultadoRetrato> {
  const inicio = Date.now();
  const vazio = { organizacoes: 0, planos: 0, licencas: 0, usuarios: 0, equipes: 0, receptivos: 0, blocosComFalha: {}, avisos: [] as string[] };
  const falha = async (status: ResultadoRetrato["status"], erro: string): Promise<ResultadoRetrato> => {
    await gravarEstado(organizacaoId, RECURSO_RETRATO, { status, erro, duracaoMs: Date.now() - inicio });
    return { ...vazio, ok: false, status, erro, duracaoMs: Date.now() - inicio };
  };

  const presentes = await db.execute<{ t: string }>(sql`
    SELECT table_name AS t FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = ANY(${`{${TABELAS_EXIGIDAS.join(",")}}`}::text[])`);
  const tem = new Set(presentes.map((r) => r.t));
  const faltam = TABELAS_EXIGIDAS.filter((t) => !tem.has(t));
  if (faltam.length) return falha("falhou", `esquema do ONFACE sem a migration 0123 (faltam: ${faltam.join(", ")})`);

  const vinculados = await tenantsVinculados(organizacaoId);
  const orgIds = [...new Set(vinculados.map((v) => v.organizationId))];
  if (!orgIds.length) {
    await gravarEstado(organizacaoId, RECURSO_RETRATO, { status: "ok", itens: 0, duracaoMs: Date.now() - inicio, sucesso: true });
    return { ...vazio, ok: true, status: "ok", duracaoMs: Date.now() - inicio };
  }

  const leitura = await lerComTransacao((s) => lerRetratoBruto(s, orgIds));
  if (!leitura.ok) {
    return falha("naoConfigurado" in leitura && leitura.naoConfigurado ? "desabilitado" : "indisponivel", leitura.erro);
  }
  const b = leitura.dados;

  const blocosComFalha: Record<string, string> = {};
  for (const [nome, bl] of Object.entries(b)) if (!bl.ok) blocosComFalha[nome] = bl.erro;
  const avisos: string[] = [];
  // Equipe que a plataforma não tem não é bloco com falha: é ausência. Entra como
  // aviso, e o retrato pode fechar `ok` em vez de ficar `parcial` para sempre —
  // estado que nunca fica verde é estado em que ninguém mais olha.
  if (b.equipes.ok && b.equipes.dados.ausenteEquipes) avisos.push(b.equipes.dados.ausenteEquipes);
  if (b.planos.ok) {
    const cols = new Set(b.planos.dados.map((p) => p.precoColuna).filter(Boolean));
    const precos = b.planos.dados.filter((p) => p.preco !== null).map((p) => p.preco as number);
    avisos.push(precos.length
      ? `preço de plano lido de [${[...cols].join(", ")}]: ${precos.length}/${b.planos.dados.length} planos, de ${Math.min(...precos)} a ${Math.max(...precos)} (conferir que é em reais)`
      : "nenhum plano tem coluna de preço reconhecida");
  }

  const n = { planos: 0, licencas: 0, usuarios: 0, equipes: 0, receptivos: 0 };
  try {
    await db.transaction(async (tx) => {
      const org = sql`${organizacaoId}::uuid`;
      const limpar = (t: string) => tx.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE organizacao_id = ${org} AND coletado_em < now()`);

      if (b.planos.ok) {
        const lote = b.planos.dados.map((p) => ({ id: p.planId, nome: p.nome, preco: p.preco, col: p.precoColuna, sp: p.stripePriceId, iv: p.intervalo }));
        for (const l of emLotes(lote)) {
          await tx.execute(sql`
            INSERT INTO callface_ai_planos (organizacao_id, plan_id, nome, preco, preco_coluna, stripe_price_id, intervalo, coletado_em)
            SELECT ${org}, r.id, r.nome, r.preco, r.col, r.sp, r.iv, now()
              FROM jsonb_to_recordset(${JSON.stringify(l)}::jsonb)
                   AS r(id text, nome text, preco numeric, col text, sp text, iv text)
            ON CONFLICT (organizacao_id, plan_id) DO UPDATE SET
              nome = EXCLUDED.nome, preco = EXCLUDED.preco, preco_coluna = EXCLUDED.preco_coluna,
              stripe_price_id = EXCLUDED.stripe_price_id, intervalo = EXCLUDED.intervalo, coletado_em = EXCLUDED.coletado_em`);
        }
        await limpar("callface_ai_planos");
        n.planos = lote.length;
      }

      if (b.stripe.ok) {
        const lote = b.stripe.dados.map((s) => ({ org: s.organizationId, cus: s.stripeCustomerId, mig: s.migrado }));
        for (const l of emLotes(lote)) {
          await tx.execute(sql`
            INSERT INTO callface_ai_org_stripe (organizacao_id, external_organization_id, stripe_customer_id, stripe_migrado, coletado_em)
            SELECT ${org}, r.org, r.cus, r.mig, now()
              FROM jsonb_to_recordset(${JSON.stringify(l)}::jsonb) AS r(org text, cus text, mig boolean)
            ON CONFLICT (organizacao_id, external_organization_id) DO UPDATE SET
              stripe_customer_id = EXCLUDED.stripe_customer_id, stripe_migrado = EXCLUDED.stripe_migrado, coletado_em = EXCLUDED.coletado_em`);
        }
        await limpar("callface_ai_org_stripe");
      }

      if (b.licencas.ok) {
        const lote = b.licencas.dados.map((l) => ({ id: l.licenseId, org: l.organizationId, plano: l.planId, mot: l.motivo, ini: iso(l.inicioEm), rev: iso(l.revogadaEm), exp: iso(l.expiraEm), atr: l.atribuida }));
        for (const l of emLotes(lote)) {
          await tx.execute(sql`
            INSERT INTO callface_ai_licencas (organizacao_id, license_id, external_organization_id, plan_id, motivo, inicio_em, revogada_em, expira_em, atribuida, coletado_em)
            SELECT ${org}, r.id, r.org, r.plano, r.mot, r.ini, r.rev, r.exp, r.atr, now()
              FROM jsonb_to_recordset(${JSON.stringify(l)}::jsonb)
                   AS r(id text, org text, plano text, mot text, ini timestamptz, rev timestamptz, exp timestamptz, atr boolean)
            ON CONFLICT (organizacao_id, license_id) DO UPDATE SET
              external_organization_id = EXCLUDED.external_organization_id, plan_id = EXCLUDED.plan_id, motivo = EXCLUDED.motivo,
              inicio_em = EXCLUDED.inicio_em, revogada_em = EXCLUDED.revogada_em, expira_em = EXCLUDED.expira_em,
              atribuida = EXCLUDED.atribuida, coletado_em = EXCLUDED.coletado_em`);
        }
        await limpar("callface_ai_licencas");
        n.licencas = lote.length;
      }

      if (b.usuarios.ok) {
        const lote = b.usuarios.dados.map((u) => ({ id: u.vinculoId, org: u.organizationId, papel: u.papel, ac: u.aceite, cv: u.convite, des: iso(u.desativadoEm), ativo: u.usuarioAtivo, crm: u.crmUserId }));
        for (const l of emLotes(lote)) {
          await tx.execute(sql`
            INSERT INTO callface_ai_usuarios (organizacao_id, vinculo_id, external_organization_id, papel, aceite, convite, desativado_em, usuario_ativo, crm_user_id, coletado_em)
            SELECT ${org}, r.id, r.org, r.papel, r.ac, r.cv, r.des, r.ativo, r.crm, now()
              FROM jsonb_to_recordset(${JSON.stringify(l)}::jsonb)
                   AS r(id text, org text, papel text, ac text, cv text, des timestamptz, ativo boolean, crm text)
            ON CONFLICT (organizacao_id, vinculo_id) DO UPDATE SET
              external_organization_id = EXCLUDED.external_organization_id, papel = EXCLUDED.papel, aceite = EXCLUDED.aceite,
              convite = EXCLUDED.convite, desativado_em = EXCLUDED.desativado_em, usuario_ativo = EXCLUDED.usuario_ativo,
              crm_user_id = EXCLUDED.crm_user_id, coletado_em = EXCLUDED.coletado_em`);
        }
        await limpar("callface_ai_usuarios");
        n.usuarios = lote.length;
      }

      if (b.equipes.ok) {
        const lote = b.equipes.dados.dados.map((e) => ({ tipo: e.tipo, id: e.refId, org: e.organizationId, nome: e.nome, st: e.status }));
        for (const l of emLotes(lote)) {
          await tx.execute(sql`
            INSERT INTO callface_ai_equipes (organizacao_id, tipo, ref_id, external_organization_id, nome, status, coletado_em)
            SELECT ${org}, r.tipo, r.id, r.org, r.nome, r.st, now()
              FROM jsonb_to_recordset(${JSON.stringify(l)}::jsonb) AS r(tipo text, id text, org text, nome text, st text)
            ON CONFLICT (organizacao_id, tipo, ref_id) DO UPDATE SET
              external_organization_id = EXCLUDED.external_organization_id, nome = EXCLUDED.nome, status = EXCLUDED.status, coletado_em = EXCLUDED.coletado_em`);
        }
        await limpar("callface_ai_equipes");
        n.equipes = lote.length;
      }

      if (b.receptivos.ok) {
        const lote = b.receptivos.dados.map((r) => ({ id: r.didId, org: r.organizationId, num: r.numero, dt: r.destinoTipo, di: r.destinoId, disp: r.disponivel, st: r.status }));
        for (const l of emLotes(lote)) {
          await tx.execute(sql`
            INSERT INTO callface_ai_receptivos (organizacao_id, did_id, external_organization_id, numero, destino_tipo, destino_id, disponivel, status, coletado_em)
            SELECT ${org}, r.id, r.org, r.num, r.dt, r.di, r.disp, r.st, now()
              FROM jsonb_to_recordset(${JSON.stringify(l)}::jsonb)
                   AS r(id text, org text, num text, dt text, di text, disp boolean, st text)
            ON CONFLICT (organizacao_id, did_id) DO UPDATE SET
              external_organization_id = EXCLUDED.external_organization_id, numero = EXCLUDED.numero, destino_tipo = EXCLUDED.destino_tipo,
              destino_id = EXCLUDED.destino_id, disponivel = EXCLUDED.disponivel, status = EXCLUDED.status, coletado_em = EXCLUDED.coletado_em`);
        }
        await limpar("callface_ai_receptivos");
        n.receptivos = lote.length;
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CallfaceAI] espelho do retrato falhou:", msg);
    return falha("falhou", `espelho do retrato: ${msg.slice(0, 300)}`);
  }

  const falhos = Object.keys(blocosComFalha);
  const status = falhos.length ? "parcial" : "ok";
  const resumo = falhos.length ? `blocos sem leitura: ${falhos.map((k) => `${k} (${blocosComFalha[k].slice(0, 160)})`).join(" | ")}` : null;
  await gravarEstado(organizacaoId, RECURSO_RETRATO, {
    status, erro: resumo, sucesso: falhos.length === 0,
    itens: n.planos + n.licencas + n.usuarios + n.equipes + n.receptivos, duracaoMs: Date.now() - inicio,
  });
  return { ok: falhos.length === 0, status, organizacoes: orgIds.length, ...n, blocosComFalha, avisos, duracaoMs: Date.now() - inicio, erro: resumo ?? undefined };
}
