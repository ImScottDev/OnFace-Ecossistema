/**
 * Health Score da conta (Documento Mestre v0.13, Módulo 07).
 *
 * "Health é versionado, explicável e baseado em dados observáveis."
 * "Missing data nunca vira nota inventada."
 *
 * O que já existia e foi REUSADO, não reconstruído: o cálculo de risco
 * (`reavaliarRiscos`, 514 riscos reais na base), o scheduler (job `cs-sweep`),
 * o painel e a carteira. O que faltava era só o score e a materialização —
 * `cs_health_snapshots` existia desde a 0057 com zero escritores.
 *
 * COMO O SCORE É EXPLICÁVEL. Ele não é uma fórmula opaca: cada fator devolve
 * seu estado, a evidência numérica que o produziu e quanto tirou do score. O
 * `factors` gravado no snapshot é o que a tela mostra, então "por que esta
 * conta está em risco?" tem resposta sem ninguém abrir o código.
 *
 * COMO DADO AUSENTE É TRATADO. Um fator sem dado vira `desconhecido` e **não
 * tira ponto**. Contar ausência como problema faria toda conta sem integração
 * parecer doente; contar como saúde faria o oposto. As duas mentem. O fator
 * aparece no snapshot dizendo que não sabe, e a cobertura fica visível.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const VERSAO_CALCULO = "v1";

export type EstadoFator = "ok" | "atencao" | "critico" | "desconhecido";

export interface Fator {
  codigo: string;
  rotulo: string;
  estado: EstadoFator;
  /** O número real que produziu o estado. Sem isto o score é opinião. */
  evidencia: string;
  /** Quanto este fator tirou de 100. Zero quando ok ou desconhecido. */
  penalidade: number;
}

export type StatusHealth = "saudavel" | "atencao" | "em_risco";

export interface HealthDaConta {
  empresaId: string;
  score: number;
  status: StatusHealth;
  fatores: Fator[];
  /** Quantos fatores tinham dado. Cobertura baixa = score pouco confiável. */
  cobertura: number;
}

/** Faixas. Acima de 70 saudável, abaixo de 40 em risco. */
function faixa(score: number): StatusHealth {
  if (score >= 70) return "saudavel";
  if (score >= 40) return "atencao";
  return "em_risco";
}

interface LinhaConta extends Record<string, unknown> {
  empresa_id: string;
  riscos_criticos: number;
  riscos_em_risco: number;
  riscos_atencao: number;
  faturas_vencidas: number;
  dias_sem_interacao: number | null;
  tem_comunicacao: boolean;
  entrega_parada: number;
  uso_dias_sem_atividade: number | null;
  tem_uso: boolean;
}

/**
 * Uma consulta por organização, não uma por conta: com 275 clientes, N+1 aqui
 * seria 275 idas ao banco a cada execução do sweep.
 */
async function observar(organizacaoId: string): Promise<LinhaConta[]> {
  return db.execute<LinhaConta>(sql`
    SELECT cli.empresa_id::text,
           COALESCE(r.criticos, 0)::int AS riscos_criticos,
           COALESCE(r.em_risco, 0)::int AS riscos_em_risco,
           COALESCE(r.atencao, 0)::int  AS riscos_atencao,
           COALESCE(f.vencidas, 0)::int AS faturas_vencidas,
           c.dias_sem_interacao::int,
           (c.dias_sem_interacao IS NOT NULL) AS tem_comunicacao,
           COALESCE(j.paradas, 0)::int AS entrega_parada,
           u.dias_sem_atividade::int AS uso_dias_sem_atividade,
           (u.dias_sem_atividade IS NOT NULL) AS tem_uso
      FROM clientes cli
      LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE severidade = 'CRITICO')  AS criticos,
               count(*) FILTER (WHERE severidade = 'EM_RISCO') AS em_risco,
               count(*) FILTER (WHERE severidade = 'ATENCAO')  AS atencao
          FROM cs_riscos x
         WHERE x.empresa_id = cli.empresa_id AND x.status = 'ABERTO'
      ) r ON TRUE
      LEFT JOIN LATERAL (
        SELECT count(*) AS vencidas FROM faturas fx
         WHERE fx.empresa_id = cli.empresa_id
           AND COALESCE(fx.status, '') NOT IN ('paga','cancelada')
           AND fx.vencimento < now()
      ) f ON TRUE
      LEFT JOIN LATERAL (
        SELECT EXTRACT(day FROM now() - max(cm.ocorrido_em))::int AS dias_sem_interacao
          FROM communications cm WHERE cm.empresa_id = cli.empresa_id
      ) c ON TRUE
      LEFT JOIN LATERAL (
        SELECT count(*) AS paradas FROM fulfillments fu
          JOIN servicos_canonicos sc ON sc.id = fu.servico_canonico_id
         WHERE sc.empresa_id = cli.empresa_id
           AND fu.status NOT IN ('COMPLETED', 'CANCELLED')
           AND fu.started_at < now() - interval '45 days'
      ) j ON TRUE
      LEFT JOIN LATERAL (
        SELECT EXTRACT(day FROM now() - s.ultima_atividade_em)::int AS dias_sem_atividade
          FROM callface_ai_external_identities i
          JOIN callface_ai_tenant_snapshots s ON s.external_identity_id = i.id
         WHERE i.entity_type = 'empresa' AND i.entity_id = cli.empresa_id
           AND s.ultima_atividade_em IS NOT NULL
         ORDER BY s.snapshot_at DESC LIMIT 1
      ) u ON TRUE
     WHERE cli.organizacao_id = ${organizacaoId}::uuid`);
}

/** Os pesos são explícitos de propósito: mudar health é mudar esta tabela. */
const PESO = {
  riscoCritico: 40,
  riscoEmRisco: 20,
  riscoAtencao: 5,
  faturaVencida: 15,
  semInteracao: 15,
  entregaParada: 15,
  semUso: 20,
} as const;

export function avaliar(l: LinhaConta): HealthDaConta {
  const fatores: Fator[] = [];
  const add = (f: Fator) => fatores.push(f);

  // 1. Riscos abertos — o sinal mais direto, e já calculado por reavaliarRiscos.
  const pCrit = Math.min(l.riscos_criticos, 2) * PESO.riscoCritico;
  add({
    codigo: "riscos_criticos", rotulo: "Riscos críticos abertos",
    estado: l.riscos_criticos > 0 ? "critico" : "ok",
    evidencia: `${l.riscos_criticos} aberto(s)`, penalidade: pCrit,
  });

  const pRisco = Math.min(l.riscos_em_risco, 2) * PESO.riscoEmRisco;
  add({
    codigo: "riscos_em_risco", rotulo: "Riscos em risco",
    estado: l.riscos_em_risco > 0 ? "atencao" : "ok",
    evidencia: `${l.riscos_em_risco} aberto(s)`, penalidade: pRisco,
  });

  const pAtencao = Math.min(l.riscos_atencao, 3) * PESO.riscoAtencao;
  add({
    codigo: "riscos_atencao", rotulo: "Pontos de atenção",
    estado: l.riscos_atencao > 0 ? "atencao" : "ok",
    evidencia: `${l.riscos_atencao} aberto(s)`, penalidade: pAtencao,
  });

  // 2. Financeiro — fatura vencida em aberto.
  const pFatura = l.faturas_vencidas > 0 ? PESO.faturaVencida : 0;
  add({
    codigo: "faturas_vencidas", rotulo: "Faturas vencidas",
    estado: l.faturas_vencidas > 0 ? "critico" : "ok",
    evidencia: `${l.faturas_vencidas} vencida(s)`, penalidade: pFatura,
  });

  // 3. Relacionamento. Sem comunicação registrada o fator NÃO tira ponto:
  //    3.265 das 33.005 comunicações têm empresa resolvida, então ausência
  //    aqui quase sempre é lacuna de vínculo, não silêncio do cliente.
  let pInteracao = 0;
  if (!l.tem_comunicacao) {
    add({
      codigo: "relacionamento", rotulo: "Última interação",
      estado: "desconhecido", evidencia: "nenhuma comunicação vinculada a esta conta",
      penalidade: 0,
    });
  } else {
    const d = l.dias_sem_interacao ?? 0;
    pInteracao = d > 60 ? PESO.semInteracao : d > 30 ? Math.round(PESO.semInteracao / 2) : 0;
    add({
      codigo: "relacionamento", rotulo: "Última interação",
      estado: d > 60 ? "critico" : d > 30 ? "atencao" : "ok",
      evidencia: `${d} dia(s) sem interação`, penalidade: pInteracao,
    });
  }

  // 4. Entrega parada há mais de 45 dias.
  const pEntrega = l.entrega_parada > 0 ? PESO.entregaParada : 0;
  add({
    codigo: "entrega", rotulo: "Jornada de entrega parada",
    estado: l.entrega_parada > 0 ? "atencao" : "ok",
    evidencia: `${l.entrega_parada} jornada(s) parada(s) há mais de 45 dias`,
    penalidade: pEntrega,
  });

  // 5. Uso real do produto. Só existe para as contas com identidade Callface AI
  //    resolvida — as demais ficam DESCONHECIDAS e não perdem ponto por isso.
  let pUso = 0;
  if (!l.tem_uso) {
    add({
      codigo: "uso_produto", rotulo: "Uso do Callface AI",
      estado: "desconhecido",
      evidencia: "conta sem identidade do SaaS resolvida ou sem snapshot de uso",
      penalidade: 0,
    });
  } else {
    const d = l.uso_dias_sem_atividade ?? 0;
    pUso = d > 30 ? PESO.semUso : d > 14 ? Math.round(PESO.semUso / 2) : 0;
    add({
      codigo: "uso_produto", rotulo: "Uso do Callface AI",
      estado: d > 30 ? "critico" : d > 14 ? "atencao" : "ok",
      evidencia: `${d} dia(s) sem atividade no produto`, penalidade: pUso,
    });
  }

  const total = fatores.reduce((s, f) => s + f.penalidade, 0);
  const score = Math.max(0, Math.min(100, 100 - total));
  const conhecidos = fatores.filter((f) => f.estado !== "desconhecido").length;

  return {
    empresaId: l.empresa_id, score, status: faixa(score), fatores,
    cobertura: Math.round((conhecidos / fatores.length) * 100),
  };
}

export interface ResultadoHealth {
  contas: number;
  saudaveis: number;
  atencao: number;
  emRisco: number;
  coberturaMedia: number;
}

/**
 * Calcula e materializa. Idempotente por (empresa, dia, versão): reexecutar o
 * sweep no mesmo dia ATUALIZA a avaliação em vez de empilhar linhas.
 */
export async function calcularHealth(organizacaoId: string): Promise<ResultadoHealth> {
  const linhas = await observar(organizacaoId);
  if (!linhas.length) return { contas: 0, saudaveis: 0, atencao: 0, emRisco: 0, coberturaMedia: 0 };

  const avaliacoes = linhas.map(avaliar);
  for (const a of avaliacoes) {
    await db.execute(sql`
      INSERT INTO cs_health_snapshots
        (organizacao_id, empresa_id, score, status, factors, calculation_version, calculated_at)
      VALUES (${organizacaoId}::uuid, ${a.empresaId}::uuid, ${a.score}, ${a.status},
              ${JSON.stringify({ fatores: a.fatores, cobertura: a.cobertura })}::jsonb,
              ${VERSAO_CALCULO}, now())
      ON CONFLICT (empresa_id, ((calculated_at AT TIME ZONE 'UTC')::date), calculation_version) DO UPDATE SET
        score = EXCLUDED.score, status = EXCLUDED.status, factors = EXCLUDED.factors`);
  }

  return {
    contas: avaliacoes.length,
    saudaveis: avaliacoes.filter((a) => a.status === "saudavel").length,
    atencao: avaliacoes.filter((a) => a.status === "atencao").length,
    emRisco: avaliacoes.filter((a) => a.status === "em_risco").length,
    coberturaMedia: Math.round(avaliacoes.reduce((s, a) => s + a.cobertura, 0) / avaliacoes.length),
  };
}

/** O health atual de uma conta, para o Cliente 360 e o NEXO. */
export async function healthDaEmpresa(
  organizacaoId: string, empresaId: string,
): Promise<{ score: number; status: string; fatores: Fator[]; cobertura: number; calculadoEm: string } | null> {
  const [l] = await db.execute<{
    score: number; status: string; factors: { fatores: Fator[]; cobertura: number }; calculated_at: Date;
  }>(sql`
    SELECT score, status, factors, calculated_at FROM cs_health_snapshots
     WHERE organizacao_id = ${organizacaoId}::uuid AND empresa_id = ${empresaId}::uuid
     ORDER BY calculated_at DESC LIMIT 1`);
  if (!l) return null;
  return {
    score: l.score, status: l.status,
    fatores: l.factors?.fatores ?? [],
    cobertura: l.factors?.cobertura ?? 0,
    calculadoEm: new Date(l.calculated_at).toISOString(),
  };
}
