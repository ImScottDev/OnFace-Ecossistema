import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ETAPAS_PRE_VENDAS, SAIDAS_PRE_VENDAS, ROTULO_ETAPA_PRE_VENDAS, type EstagioPreVendas,
} from "@/lib/vendas/dominio";

/**
 * Onde cada lead está agora, quantos há em cada etapa, e quem são.
 *
 * ## A coluna que manda
 *
 * `leads.estagio_pre_vendas`, e não `leads.status` nem `sdr_status`. Medido:
 * `status` é `novo` em 4.254 de 4.254 leads — qualquer funil montado sobre ela
 * é ficção. `estagio_pre_vendas` bate com a leitura canônica de Pré-vendas
 * (`aquisicoes` → `pipeline_etapas.codigo`) com ZERO divergências nos 4.188
 * leads que têm aquisição; `sdr_status` é espelho degradado, com 56 leads em
 * três estados que nem existem no vocabulário atual.
 *
 * As etapas vêm de `lib/vendas/dominio.ts` — as mesmas do board de Pré-vendas.
 * Este módulo CONTA e EXPLICA; ele não inventa etapa nem reconstrói estado.
 *
 * ## Marcos da jornada são outra pergunta
 *
 * "Em que etapa está" (acima) e "por onde já passou" (abaixo) são perguntas
 * diferentes, e misturá-las foi o que sempre quebrou este funil. Um lead em
 * `desqualificado` pode ter respondido e virado negócio antes. Por isso os
 * marcos vêm separados, como atributos da coorte, nunca como degraus.
 *
 * O marco "respondeu" precisa de uma ponte: as 16.143 mensagens de entrada
 * estão ligadas a um `contato`, e só 26 dos 2.047 contatos têm `lead_id` —
 * 1,3%. Pelo vínculo direto, "quem respondeu" dá 4 leads; casando também por
 * telefone (8 últimos dígitos, que ignoram DDI e o nono dígito), dá 636. O
 * telefone é heurística e só cobre o que o vínculo deixou em branco: a
 * cobertura é devolvida para a tela mostrar por onde cada lead foi alcançado.
 */

export const ESTAGIOS_FUNIL = [...ETAPAS_PRE_VENDAS, ...SAIDAS_PRE_VENDAS] as const;

export interface EtapaDoFunil {
  estagio: EstagioPreVendas | "sem_etapa";
  rotulo: string;
  /** Etapa do caminho principal (true) ou saída lateral (false). */
  principal: boolean;
  leads: number;
  doTotal: number | null;
}

export interface MarcosDaCoorte {
  /** Tem `primeiro_contato_at`, evento `contacted`, ou mensagem enviada. */
  contatados: number;
  /** Tem ao menos uma mensagem de entrada, pela ponte contato→lead. */
  responderam: number;
  /** Tem negócio ligado (`negocio_leads`). */
  comNegocio: number;
  /** Tem negócio ganho. */
  ganhos: number;
}

export interface FatiaFunil { chave: string; rotulo: string; leads: number }

export interface FunilLeads {
  de: string;
  ate: string;
  total: number;
  etapas: EtapaDoFunil[];
  marcos: MarcosDaCoorte;
  cobertura: {
    /** Alcançados por vínculo direto contato→lead. */
    porVinculo: number;
    /** Alcançados só por telefone (heurística declarada). */
    porTelefone: number;
    /** Sem caminho até mensagens: deles não se sabe se responderam. */
    semCaminho: number;
    /** Leads com cargo preenchido. */
    comCargo: number;
  };
  origens: FatiaFunil[];
  cargos: FatiaFunil[];
}

/**
 * A etapa canônica, igual à que `carregarLead` usa em `lib/vendas/pre-vendas.ts`.
 *
 * Ler `leads.estagio_pre_vendas` cru dá etapa errada em lead cuja etapa só
 * existe na aquisição (os que vieram por carga): a verdade é `pipeline_etapas`
 * através de `aquisicoes.lead_legado_id`, com a coluna do lead como fallback.
 * `qualificacao` é a exceção — só o legado conhece esse estado, e o board
 * também o preserva.
 *
 * Copiar a expressão seria convidar as duas a divergirem na primeira mudança;
 * por isso ela mora aqui uma vez só e os dois usos (contagem e lista) a
 * referenciam.
 */
const ETAPA_CANONICA = sql`
  CASE WHEN l.estagio_pre_vendas = 'qualificacao' THEN 'qualificacao'
       ELSE COALESCE(pe.codigo, l.estagio_pre_vendas) END`;

const JUNCAO_ETAPA = sql`
  LEFT JOIN aquisicoes a ON a.lead_legado_id = l.id
  LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id`;

/**
 * Cargo é texto livre vindo do formulário do Meta: 583 valores distintos para
 * cerca de 60 cargos reais, com acento, caixa e pontuação variando ("CEO",
 * "Ceo", "C.E.O.") e até erro de digitação ("Cep", 18 vezes, que é CEO).
 * Normalizar na LEITURA, não no dado: o original fica intacto na ficha.
 */
const CARGO_NORMALIZADO = sql`
  CASE
    WHEN nullif(trim(l.cargo), '') IS NULL THEN NULL
    ELSE initcap(
      regexp_replace(
        translate(lower(trim(l.cargo)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
        '[^a-z0-9 ]', '', 'g'))
  END`;

/** `fbclid`, `gclid` e `landing_page` estão zerados no banco: não entram em nenhuma conta. */
const PONTE_CONTATO = sql`
  SELECT c.id AS lead_id, ct.id AS contato_id, true AS via_vinculo
    FROM coorte c JOIN contatos ct ON ct.lead_id = c.id
  UNION
  SELECT c.id, ct.id, false
    FROM coorte c
    JOIN contatos ct
      ON length(regexp_replace(COALESCE(ct.telefone, ''), '[^0-9]', '', 'g')) >= 10
     AND right(regexp_replace(COALESCE(ct.telefone, ''), '[^0-9]', '', 'g'), 8)
       = right(regexp_replace(COALESCE(NULLIF(c.whatsapp, ''), c.telefone, ''), '[^0-9]', '', 'g'), 8)
   WHERE length(regexp_replace(COALESCE(NULLIF(c.whatsapp, ''), c.telefone, ''), '[^0-9]', '', 'g')) >= 10`;

function coorte(org: string, de: Date, ate: Date, origem?: string) {
  return sql`
    coorte AS (
      SELECT l.*, ${ETAPA_CANONICA} AS etapa_canonica
        FROM leads l ${JUNCAO_ETAPA}
       WHERE l.organizacao_id = ${org}::uuid
         AND l.created_at >= ${de.toISOString()}::timestamptz
         AND l.created_at <  ${ate.toISOString()}::timestamptz
         ${origem ? sql`AND COALESCE(NULLIF(l.origem, ''), 'sem origem') = ${origem}` : sql``}
    )`;
}

export async function funilDeLeads(
  organizacaoId: string, de: Date, ate: Date, origem?: string,
): Promise<FunilLeads> {
  const etapasRows = await db.execute<{ estagio: string | null; n: string }>(sql`
    WITH ${coorte(organizacaoId, de, ate, origem)}
    SELECT etapa_canonica AS estagio, count(*)::text AS n FROM coorte GROUP BY 1`);

  const porEstagio = new Map(etapasRows.map((r) => [r.estagio ?? "sem_etapa", Number(r.n)]));
  const total = [...porEstagio.values()].reduce((a, b) => a + b, 0);

  const etapas: EtapaDoFunil[] = [
    ...ESTAGIOS_FUNIL.map((e) => ({
      estagio: e,
      rotulo: ROTULO_ETAPA_PRE_VENDAS[e],
      principal: (ETAPAS_PRE_VENDAS as readonly string[]).includes(e),
      leads: porEstagio.get(e) ?? 0,
      doTotal: total > 0 ? (porEstagio.get(e) ?? 0) / total : null,
    })),
    ...(porEstagio.has("sem_etapa")
      ? [{
          estagio: "sem_etapa" as const,
          rotulo: "Sem etapa",
          principal: false,
          leads: porEstagio.get("sem_etapa")!,
          doTotal: total > 0 ? porEstagio.get("sem_etapa")! / total : null,
        }]
      : []),
  ];

  const [m] = await db.execute<Record<string, string>>(sql`
    WITH ${coorte(organizacaoId, de, ate, origem)},
    ponte AS (${PONTE_CONTATO}),
    msg AS (
      SELECT p.lead_id,
             bool_or(w.direcao = 'out') AS enviou,
             bool_or(w.direcao = 'in')  AS respondeu
        FROM ponte p JOIN whatsapp_mensagens w ON w.contato_id = p.contato_id
       GROUP BY p.lead_id
    ),
    ev AS (
      SELECT lead_id, bool_or(para_status = 'contacted') AS contatou
        FROM status_changes WHERE lead_id IN (SELECT id FROM coorte) GROUP BY lead_id
    ),
    neg AS (
      SELECT nl.lead_id, bool_or(true) AS tem, bool_or(n.status = 'ganho') AS ganhou
        FROM negocio_leads nl JOIN negocios n ON n.id = nl.negocio_id
       WHERE nl.lead_id IN (SELECT id FROM coorte) GROUP BY nl.lead_id
    ),
    cob AS (SELECT lead_id, bool_or(via_vinculo) AS tem_vinculo FROM ponte GROUP BY lead_id)
    SELECT
      count(*) FILTER (WHERE c.primeiro_contato_at IS NOT NULL OR e.contatou OR m.enviou)::text AS contatados,
      count(*) FILTER (WHERE m.respondeu)::text                          AS responderam,
      count(*) FILTER (WHERE n.tem)::text                                AS com_negocio,
      count(*) FILTER (WHERE n.ganhou)::text                             AS ganhos,
      count(*) FILTER (WHERE cob.tem_vinculo)::text                      AS por_vinculo,
      count(*) FILTER (WHERE cob.lead_id IS NOT NULL AND NOT cob.tem_vinculo)::text AS por_telefone,
      count(*) FILTER (WHERE cob.lead_id IS NULL)::text                  AS sem_caminho,
      count(*) FILTER (WHERE nullif(trim(c.cargo), '') IS NOT NULL)::text AS com_cargo
      FROM coorte c
      LEFT JOIN ev e ON e.lead_id = c.id
      LEFT JOIN msg m ON m.lead_id = c.id
      LEFT JOIN neg n ON n.lead_id = c.id
      LEFT JOIN cob ON cob.lead_id = c.id`);

  const n = (k: string) => Number(m?.[k] ?? 0);

  const origens = await db.execute<{ chave: string; n: string }>(sql`
    WITH ${coorte(organizacaoId, de, ate, undefined)}
    SELECT COALESCE(NULLIF(origem, ''), 'sem origem') AS chave, count(*)::text AS n
      FROM coorte GROUP BY 1 ORDER BY count(*) DESC LIMIT 15`);

  const cargos = await db.execute<{ chave: string; n: string }>(sql`
    WITH ${coorte(organizacaoId, de, ate, origem)}
    SELECT ${CARGO_NORMALIZADO} AS chave, count(*)::text AS n
      FROM coorte l WHERE nullif(trim(l.cargo), '') IS NOT NULL
     GROUP BY 1 ORDER BY count(*) DESC LIMIT 15`);

  return {
    de: de.toISOString(),
    ate: ate.toISOString(),
    total,
    etapas,
    marcos: {
      contatados: n("contatados"),
      responderam: n("responderam"),
      comNegocio: n("com_negocio"),
      ganhos: n("ganhos"),
    },
    cobertura: {
      porVinculo: n("por_vinculo"),
      porTelefone: n("por_telefone"),
      semCaminho: n("sem_caminho"),
      comCargo: n("com_cargo"),
    },
    origens: origens.map((o) => ({ chave: o.chave, rotulo: o.chave, leads: Number(o.n) })),
    cargos: cargos.map((c) => ({ chave: c.chave, rotulo: c.chave, leads: Number(c.n) })),
  };
}

export interface LeadNoFunil {
  id: string;
  nome: string;
  empresa: string | null;
  cargo: string | null;
  origem: string | null;
  estagio: string | null;
  responsavelId: string | null;
  criadoEm: string;
}

/**
 * Os leads de UMA etapa — o que abre no clique. Mesma coluna da contagem, para
 * o card e a lista nunca divergirem. `sem_etapa` é `IS NULL`, não um valor.
 */
export async function leadsDaEtapa(
  organizacaoId: string, estagio: EstagioPreVendas | "sem_etapa",
  de: Date, ate: Date, origem?: string, limite = 500,
): Promise<LeadNoFunil[]> {
  const linhas = await db.execute<{
    id: string; nome: string; empresa: string | null; cargo: string | null;
    origem: string | null; estagio_pre_vendas: string | null;
    responsavel_id: string | null; created_at: string;
  }>(sql`
    WITH ${coorte(organizacaoId, de, ate, origem)}
    SELECT id::text, trim(COALESCE(nome, '') || ' ' || COALESCE(sobrenome, '')) AS nome,
           empresa, cargo, origem, etapa_canonica AS estagio_pre_vendas, responsavel_id::text, created_at::text
      FROM coorte
     WHERE ${estagio === "sem_etapa" ? sql`etapa_canonica IS NULL` : sql`etapa_canonica = ${estagio}`}
     ORDER BY created_at DESC LIMIT ${limite}`);

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome?.trim() || "(sem nome)",
    empresa: l.empresa,
    cargo: l.cargo,
    origem: l.origem,
    estagio: l.estagio_pre_vendas,
    responsavelId: l.responsavel_id,
    criadoEm: l.created_at,
  }));
}
