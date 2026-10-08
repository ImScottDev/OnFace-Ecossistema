/**
 * Implementação Postgres dos repositórios de identidade e aquisição.
 *
 * O domínio define o contrato; a implementação vive aqui, em platform/database.
 * É o que permite testar a regra de negócio sem banco (os 19 testes de domínio
 * rodam com repositório falso) e trocar a persistência sem tocar na regra.
 *
 * Recebe o executor por parâmetro: quando vier a transação em curso, tudo
 * acontece no mesmo BEGIN do evento de domínio.
 */
import type { RepositorioAquisicao, EntradaAquisicao } from "../../../domain/acquisition/commands/registrar-entrada";
import { normalizarEmail, normalizarTelefone, normalizarCnpj, dominioCorporativo } from "../../../domain/identity/commands/resolver-identidade";

export interface Executor {
  execute<T = unknown>(query: unknown): Promise<T[]>;
}
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

/**
 * O domínio fala em `Date`; o driver, não. Um Date entregue cru a um parâmetro
 * do postgres.js estoura em `Buffer.byteLength` ("Received an instance of
 * Date") no momento do Bind, e a transação inteira volta atrás — foi o que
 * derrubava 100% da entrada direta de Lead Ads, porque `normalizarLeadAds`
 * devolve `ocorridoEm` como Date. A conversão mora aqui, na fronteira do SQL,
 * e não em cada chamador.
 */
function instante(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  return v instanceof Date ? (Number.isNaN(v.getTime()) ? null : v.toISOString()) : v;
}

export function criarRepositorioAquisicao(db: Executor, sql: SqlTag): RepositorioAquisicao {
  const um = async <T>(q: unknown): Promise<T | null> => ((await db.execute<T>(q))[0] ?? null);

  return {
    async acharPessoaPorEmail(organizacaoId, email) {
      return um(sql`SELECT id FROM pessoas WHERE organizacao_id = ${organizacaoId}::uuid
                     AND lower(trim(email)) = ${email} LIMIT 1`);
    },
    async acharPessoaPorTelefone(organizacaoId, telefone) {
      // Compara só dígitos dos dois lados: o banco tem telefone com máscara,
      // sem máscara e com +55, e o mesmo número não pode virar três pessoas.
      //
      // A comparação é pelos ÚLTIMOS 10 dígitos, não por sufixo livre: com
      // LIKE '%numero' um celular de 9 dígitos casaria dentro de um de 11, e
      // duas pessoas diferentes virariam uma. O DDD entra na conta porque 10
      // dígitos já incluem ele.
      const ultimos = telefone.slice(-10);
      return um(sql`SELECT id FROM pessoas WHERE organizacao_id = ${organizacaoId}::uuid
                     AND right(regexp_replace(coalesce(telefone,''), '\\D', '', 'g'), 10) = ${ultimos}
                     AND length(regexp_replace(coalesce(telefone,''), '\\D', '', 'g')) >= 10
                     LIMIT 1`);
    },
    async acharEmpresaPorCnpj(organizacaoId, cnpj) {
      return um(sql`SELECT id FROM empresas WHERE organizacao_id = ${organizacaoId}::uuid
                     AND regexp_replace(coalesce(cnpj,''), '\\D', '', 'g') = ${cnpj} LIMIT 1`);
    },
    async acharEmpresaPorDominio(organizacaoId, dominio) {
      // Também a coluna `dominio`, que é a que `resolverEmpresa` do app consulta: com regras diferentes
      // nas duas pontas, o app achava a empresa e a porta canônica criava outra, sem lead, ao lado.
      return um(sql`SELECT id FROM empresas WHERE organizacao_id = ${organizacaoId}::uuid
                     AND (dominio = ${dominio}
                          OR lower(regexp_replace(coalesce(website,''), '^https?://(www\\.)?', '')) LIKE ${dominio + '%'})
                     ORDER BY created_at LIMIT 1`);
    },

    async criarPessoa(organizacaoId, dados, empresaId) {
      const r = await um<{ id: string }>(sql`
        INSERT INTO pessoas (organizacao_id, empresa_id, nome, sobrenome, email, telefone, cargo, metadata)
        VALUES (${organizacaoId}::uuid, ${empresaId}::uuid,
                ${dados.nome ?? "Sem nome"}, ${dados.sobrenome ?? null},
                ${normalizarEmail(dados.email)}, ${dados.telefone ?? null}, ${dados.cargo ?? null},
                ${JSON.stringify({ origem: "comando-de-dominio" })}::jsonb)
        RETURNING id`);
      return r!.id;
    },
    async criarEmpresa(organizacaoId, dados) {
      /* Regra do Scott (06/10), a mesma de `resolverEmpresa` do app: sem CNPJ e sem domínio,
         empresa de NOME IGUAL (sem caixa, acento, espaço e pontuação) é a mesma. Sem isto, todo
         lead criado só com o nome da empresa nascia com uma segunda empresa idêntica aqui. */
      const nomeNorm = String(dados.nome ?? "").toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
      if (!normalizarCnpj(dados.cnpj) && !(dados.website ?? dados.dominio) && nomeNorm.length >= 3) {
        const igual = await um<{ id: string }>(sql`
          SELECT id FROM empresas
           WHERE organizacao_id = ${organizacaoId}::uuid
             AND regexp_replace(
                   translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
                   '[^a-z0-9]+', '', 'g') = ${nomeNorm}
           ORDER BY created_at LIMIT 1`);
        if (igual) return igual.id;
      }
      const r = await um<{ id: string }>(sql`
        INSERT INTO empresas (organizacao_id, nome, cnpj, website)
        VALUES (${organizacaoId}::uuid, ${dados.nome ?? "Sem nome"},
                ${normalizarCnpj(dados.cnpj)}, ${dados.website ?? dados.dominio ?? null})
        RETURNING id`);
      return r!.id;
    },
    async vincularPessoaEmpresa(organizacaoId, pessoaId, empresaId, cargo) {
      await db.execute(sql`
        INSERT INTO pessoa_empresa_vinculos (organizacao_id, pessoa_id, empresa_id, papel, cargo, principal)
        VALUES (${organizacaoId}::uuid, ${pessoaId}::uuid, ${empresaId}::uuid, 'contato_principal', ${cargo}, true)
        ON CONFLICT (pessoa_id, empresa_id) DO NOTHING`);
    },

    async acharAquisicaoPorChave(organizacaoId, chave) {
      return um(sql`SELECT a.id FROM aquisicoes a
                     JOIN backfill_provenance b ON b.entidade_canonica = 'aquisicao' AND b.id_canonico = a.id
                     WHERE a.organizacao_id = ${organizacaoId}::uuid AND b.chave_identidade = ${chave} LIMIT 1`);
    },
    async acharAquisicaoAberta(organizacaoId, pessoaId, empresaId) {
      if (!pessoaId && !empresaId) return null;
      return um(sql`SELECT id FROM aquisicoes
                     WHERE organizacao_id = ${organizacaoId}::uuid AND closed_at IS NULL
                       AND (${pessoaId}::uuid IS NOT NULL AND pessoa_id = ${pessoaId}::uuid
                            OR ${empresaId}::uuid IS NOT NULL AND empresa_id = ${empresaId}::uuid)
                     ORDER BY created_at DESC LIMIT 1`);
    },
    async criarAquisicao(e) {
      const r = await um<{ id: string }>(sql`
        INSERT INTO aquisicoes (organizacao_id, empresa_id, pessoa_id, tipo, origem, source_provider,
                                responsavel_id, lead_legado_id, first_touch_at, last_touch_at)
        VALUES (${e.organizacaoId}::uuid, ${e.empresaId}::uuid, ${e.pessoaId}::uuid,
                ${e.tipo}, ${e.origem ?? null}, ${e.provider ?? null}, ${e.responsavelId ?? null}::uuid,
                ${e.leadLegadoId ?? null}::uuid,
                coalesce(${instante(e.ocorridoEm)}::timestamptz, now()),
                coalesce(${instante(e.ocorridoEm)}::timestamptz, now()))
        RETURNING id`);
      return r!.id;
    },
    async registrarChave(aquisicaoId, e) {
      if (!e.idempotencyKey) return;
      await db.execute(sql`
        INSERT INTO backfill_provenance (organizacao_id, fase, entidade_canonica, id_canonico, tabela_origem, id_origem, chave_identidade, metodo)
        VALUES (${e.organizacaoId}::uuid, 'runtime', 'aquisicao', ${aquisicaoId}::uuid, ${e.provider ?? "externo"}, ${e.idempotencyKey}, ${e.idempotencyKey}, 'IDEMPOTENCIA')
        ON CONFLICT (entidade_canonica, tabela_origem, id_origem) DO NOTHING`);
    },
    async registrarTouchpoint(aquisicaoId, e) {
      const a = e.atribuicao;
      // Sem nenhum sinal não se cria linha vazia: poluiria relatório de campanha.
      const temSinal = a && Object.values(a).some((v) => v != null && String(v).trim() !== "");
      if (!temSinal) return;
      await db.execute(sql`
        INSERT INTO pontos_contato (organizacao_id, aquisicao_id, pessoa_id, empresa_id, tipo_origem,
                                    source, medium, campaign, term, content, landing_page, referrer,
                                    gclid, fbclid, fbc, fbp, meta_lead_id, campaign_id, adset_id, ad_id,
                                    provider, is_first_touch, is_last_touch, ocorrido_em)
        VALUES (${e.organizacaoId}::uuid, ${aquisicaoId}::uuid, ${e.pessoaId}::uuid, ${e.empresaId}::uuid,
                ${e.tipo === "INBOUND" ? "paga" : "organica"},
                ${a!.utmSource ?? null}, ${a!.utmMedium ?? null}, ${a!.utmCampaign ?? null},
                ${a!.utmTerm ?? null}, ${a!.utmContent ?? null}, ${a!.landingPage ?? null}, ${a!.referrer ?? null},
                ${a!.gclid ?? null}, ${a!.fbclid ?? null}, ${a!.fbc ?? null}, ${a!.fbp ?? null},
                ${a!.metaLeadId ?? null}, ${a!.campaignId ?? null}, ${a!.adsetId ?? null}, ${a!.adId ?? null},
                ${e.provider ?? null}, false, true, coalesce(${instante(e.ocorridoEm)}::timestamptz, now()))`);
    },
    async donoDaFilaInbound(organizacaoId) {
      const r = await um<{ id: string }>(sql`
        SELECT u.id FROM organizacoes o
        JOIN usuarios u ON u.id = (o.settings -> 'preVendas' ->> 'responsavelInboundId')::uuid
        WHERE o.id = ${organizacaoId}::uuid AND u.ativo IS NOT FALSE LIMIT 1`);
      return r?.id ?? null;
    },
  };
}
