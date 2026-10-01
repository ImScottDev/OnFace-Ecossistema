/**
 * Resumo do índice de Ajustes (arquétipo H do ONFACE).
 *
 * O índice antigo era uma grade de cartões estáticos: dizia que uma tela
 * existia, nunca em que estado a organização estava. Aqui cada grupo carrega
 * o FATO que interessa a quem administra (quantas pessoas ainda não aceitaram
 * o convite, quantas sessões de WhatsApp caíram, se há caixa de e-mail com
 * erro de sincronização) — o estado é derivado do banco, nunca declarado.
 *
 * Toda consulta filtra por `organizacao_id`. O inventário de integrações de
 * `lib/integrations/inventario` NÃO entra aqui de propósito: ele conta sinais
 * sem filtro de organização (faturas, ligações, reuniões do banco inteiro), e
 * num índice de ajustes da organização isso viraria número de outro tenant.
 *
 * NÃO LÊ SEGREDO: chaves e tokens só respondem "existe?" (`IS NOT NULL`).
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface ResumoAjustes {
  organizacao: { nome: string; slug: string } | null;
  /** Vencido fica à parte: ninguém consegue aceitar, então não é "pendente"
   *  — é tarefa de reenviar em Membros. */
  equipe: { ativos: number; convitesPendentes: number; convitesVencidos: number };
  acesso: { papeis: number; ativosSemPapelVinculado: number };
  whatsapp: { conectadas: number; total: number };
  email: { ativas: number; comErro: number; total: number };
  ia: { credenciaisAtivas: number; credenciaisComErro: number };
  apolloConfigurado: boolean;
  tokensApiAtivos: number;
}

export async function resumoAjustes(organizacaoId: string): Promise<ResumoAjustes> {
  // Uma ida ao banco só: são oito contagens pequenas e independentes, e o
  // índice é a primeira tela de Ajustes — não vale oito round-trips.
  const [r] = await db.execute<{
    nome: string | null; slug: string | null; apollo: boolean | null;
    ativos: number; pendentes: number; vencidos: number;
    papeis: number; sem_papel: number;
    wa_conectadas: number; wa_total: number;
    em_ativas: number; em_erro: number; em_total: number;
    ia_ativas: number; ia_erro: number;
    tokens: number;
  }>(sql`
    SELECT
      o.nome, o.slug, (o.apollo_api_key IS NOT NULL AND o.apollo_api_key <> '') AS apollo,
      (SELECT count(*)::int FROM usuarios u WHERE u.organizacao_id = o.id AND u.ativo) AS ativos,
      -- Convite pendente = inativo COM convite não usado E ainda válido. Só
      -- "NOT ativo" contaria também quem o super admin desativou (admin.ts),
      -- que não é convite; sem o expira_em contaria convite que já não abre.
      (SELECT count(*)::int FROM usuarios u
        WHERE u.organizacao_id = o.id AND NOT u.ativo
          AND EXISTS (SELECT 1 FROM auth_tokens t
                       WHERE t.usuario_id = u.id AND t.tipo = 'convite' AND t.usado_em IS NULL
                         AND t.expira_em > now())) AS pendentes,
      -- Vencido = tem convite não usado, mas nenhum válido (quem já recebeu um
      -- reenvio válido conta só em pendentes, não nos dois).
      (SELECT count(*)::int FROM usuarios u
        WHERE u.organizacao_id = o.id AND NOT u.ativo
          AND EXISTS (SELECT 1 FROM auth_tokens t
                       WHERE t.usuario_id = u.id AND t.tipo = 'convite' AND t.usado_em IS NULL)
          AND NOT EXISTS (SELECT 1 FROM auth_tokens t
                       WHERE t.usuario_id = u.id AND t.tipo = 'convite' AND t.usado_em IS NULL
                         AND t.expira_em > now())) AS vencidos,
      (SELECT count(*)::int FROM roles r WHERE r.organizacao_id = o.id) AS papeis,
      (SELECT count(*)::int FROM usuarios u
        WHERE u.organizacao_id = o.id AND u.ativo
          AND NOT EXISTS (SELECT 1 FROM user_roles ur
                           WHERE ur.usuario_id = u.id AND ur.organizacao_id = o.id)) AS sem_papel,
      (SELECT count(*)::int FROM whatsapp_sessao w WHERE w.organizacao_id = o.id AND w.status = 'connected') AS wa_conectadas,
      (SELECT count(*)::int FROM whatsapp_sessao w WHERE w.organizacao_id = o.id) AS wa_total,
      (SELECT count(*)::int FROM email_contas e WHERE e.organizacao_id = o.id AND e.sync_status = 'active') AS em_ativas,
      (SELECT count(*)::int FROM email_contas e WHERE e.organizacao_id = o.id AND e.sync_status = 'error') AS em_erro,
      (SELECT count(*)::int FROM email_contas e WHERE e.organizacao_id = o.id) AS em_total,
      (SELECT count(*)::int FROM ai_provider_credentials a WHERE a.organizacao_id = o.id AND a.ativo AND a.validation_error IS NULL) AS ia_ativas,
      (SELECT count(*)::int FROM ai_provider_credentials a WHERE a.organizacao_id = o.id AND a.validation_error IS NOT NULL) AS ia_erro,
      (SELECT count(*)::int FROM api_tokens t
        WHERE t.organizacao_id = o.id AND t.revogado_em IS NULL
          AND (t.expira_em IS NULL OR t.expira_em > now())) AS tokens
    FROM organizacoes o
    WHERE o.id = ${organizacaoId}::uuid`);

  return {
    organizacao: r?.nome ? { nome: r.nome, slug: r.slug ?? "" } : null,
    equipe: { ativos: r?.ativos ?? 0, convitesPendentes: r?.pendentes ?? 0, convitesVencidos: r?.vencidos ?? 0 },
    acesso: { papeis: r?.papeis ?? 0, ativosSemPapelVinculado: r?.sem_papel ?? 0 },
    whatsapp: { conectadas: r?.wa_conectadas ?? 0, total: r?.wa_total ?? 0 },
    email: { ativas: r?.em_ativas ?? 0, comErro: r?.em_erro ?? 0, total: r?.em_total ?? 0 },
    ia: { credenciaisAtivas: r?.ia_ativas ?? 0, credenciaisComErro: r?.ia_erro ?? 0 },
    apolloConfigurado: Boolean(r?.apollo),
    tokensApiAtivos: r?.tokens ?? 0,
  };
}
