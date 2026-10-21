/**
 * Gera o SQL que publica uma versão nova da Lia a partir do seed do código.
 *
 * Existe porque a imagem de produção só leva o compilado: não há `src` nem
 * `tsx` dentro do container, então script avulso não roda lá. E mudar o seed
 * NÃO muda a agente que está atendendo — o prompt e a lista de ferramentas
 * ficam congelados na linha de `ai_agent_versions` publicada. Sem republicar,
 * todo trabalho no prompt é invisível para o cliente.
 *
 * O SQL reproduz `publicarVersao()` (lib/ai-platform/publicacao.ts): copia a
 * versão publicada, troca prompt e ferramentas pelo seed, supersede a antiga,
 * publica a nova e aponta o agente. Tudo numa transação.
 *
 * Uso:
 *   cd app && pnpm exec tsx src/scripts/gerar-sql-publicar-lia.ts /tmp/publicar-lia.sql
 *
 * Depois, no servidor (escrita em PRODUÇÃO, confira antes de aplicar):
 *   scp -i ~/.ssh/infra_callface.pem /tmp/publicar-lia.sql ubuntu@34.204.200.52:/tmp/
 *   ssh -i ~/.ssh/infra_callface.pem ubuntu@34.204.200.52 \
 *     'docker cp /tmp/publicar-lia.sql callface-crm2-dev-postgres:/tmp/p.sql && \
 *      docker exec callface-crm2-dev-postgres sh -c "psql -U \$POSTGRES_USER -d callface_crm_mz -f /tmp/p.sql"'
 *
 * Para voltar atrás: `ai_agent_versions` guarda todas as versões. Republicar a
 * anterior é trocar `status` e `ai_agents.published_version_id` de volta.
 */
import { writeFileSync } from "node:fs";
import { LIA_PROMPT, LIA_SLUG, LIA_VERSAO, LIA_VERSAO_PROMPT } from "@/lib/ai-platform/lia/definicao";

const destino = process.argv[2];
if (!destino) {
  console.error("uso: tsx src/scripts/gerar-sql-publicar-lia.ts <arquivo.sql>");
  process.exit(1);
}

const ferramentas = (LIA_VERSAO as { tools: string[] }).tools;

// Dollar-quoting: o prompt tem aspas, crases e quebras de linha, e nada disso
// precisa de escape dentro de $lia$...$lia$. Só não pode conter o delimitador.
const DELIM = "$lia$";
for (const [nome, texto] of [["prompt", LIA_PROMPT], ["ferramentas", JSON.stringify(ferramentas)]] as const) {
  if (texto.includes(DELIM)) throw new Error(`o ${nome} contém o delimitador ${DELIM}; troque o delimitador neste script`);
}
const cita = (texto: string) => `${DELIM}${texto}${DELIM}`;

const sql = `-- Publica a versão nova da ${LIA_SLUG} a partir do seed.
-- Prompt ${LIA_VERSAO_PROMPT}, ${LIA_PROMPT.length} caracteres, ${ferramentas.length} ferramentas.
-- Gerado por src/scripts/gerar-sql-publicar-lia.ts. Reproduz publicarVersao().
BEGIN;

INSERT INTO ai_agent_versions (
  organizacao_id, agent_id, versao, status, system_prompt, tools,
  guardrail_config, handoff_config, trigger_config, knowledge_config,
  provider, modelo, credential_id, max_steps, token_budget, cost_budget,
  history_message_window, history_token_window, cases_enabled, channel_session_id, created_by_id
)
SELECT v.organizacao_id, v.agent_id, v.versao + 1, 'draft', ${cita(LIA_PROMPT)}, ${cita(JSON.stringify(ferramentas))}::jsonb,
       v.guardrail_config, v.handoff_config, v.trigger_config, v.knowledge_config,
       v.provider, v.modelo, v.credential_id, v.max_steps, v.token_budget, v.cost_budget,
       v.history_message_window, v.history_token_window, v.cases_enabled, v.channel_session_id, v.created_by_id
  FROM ai_agent_versions v
  JOIN ai_agents a ON a.published_version_id = v.id
 WHERE a.slug = '${LIA_SLUG}';

UPDATE ai_agent_versions v SET status = 'superseded', superseded_at = now()
  FROM ai_agents a
 WHERE a.slug = '${LIA_SLUG}' AND v.agent_id = a.id AND v.status = 'published';

UPDATE ai_agent_versions v SET status = 'published', published_at = now()
  FROM ai_agents a
 WHERE a.slug = '${LIA_SLUG}' AND v.agent_id = a.id AND v.status = 'draft'
   AND v.versao = (SELECT max(versao) FROM ai_agent_versions WHERE agent_id = a.id);

UPDATE ai_agents a SET published_version_id = (
    SELECT id FROM ai_agent_versions
     WHERE agent_id = a.id AND status = 'published' ORDER BY versao DESC LIMIT 1
  ), updated_at = now()
 WHERE a.slug = '${LIA_SLUG}';

-- Confirmação: uma única publicada, e é a de maior número.
SELECT v.versao, v.status, jsonb_array_length(v.tools) AS ferramentas,
       length(v.system_prompt) AS tamanho_prompt,
       (a.published_version_id = v.id) AS e_a_publicada
  FROM ai_agent_versions v JOIN ai_agents a ON a.id = v.agent_id
 WHERE a.slug = '${LIA_SLUG}' ORDER BY v.versao;

COMMIT;
`;

writeFileSync(destino, sql);
console.log(`SQL escrito em ${destino}`);
console.log(`prompt ${LIA_VERSAO_PROMPT}: ${LIA_PROMPT.length} caracteres · ${ferramentas.length} ferramentas`);
