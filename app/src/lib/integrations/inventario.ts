/**
 * Inventário de integrações (Integration Hub, Documento Mestre v0.13 §12).
 *
 * A tela de Integrações listava TRÊS coisas: Apollo, e dois cartões com a
 * palavra "placeholder" no código (Meta Conversions API e Google Ads). Não
 * listava nada do que está vivo em produção:
 *
 *     Callface (discador)   4.918 atividades, última em 18/09
 *     Stripe                  828 faturas,    última em 20/09
 *     Meta Lead Ads           797 leads,      último em 18/09
 *     Microsoft Graph          58 reuniões,   última em 18/09
 *
 * Quem abria a tela concluía que o produto tinha uma integração configurada.
 *
 * O ESTADO É DERIVADO, nunca declarado. "Configurado" é a credencial existir
 * de fato; "em uso" é ter sinal no banco com data. Uma lista estática de
 * cartões diz o que alguém escreveu um dia, e é assim que dois placeholders
 * sobrevivem meses ao lado de cinco integrações reais invisíveis.
 *
 * NÃO LÊ SEGREDO. Pergunta se a variável existe, nunca o valor, pelo mesmo
 * motivo de `ai-platform/prontidao`.
 *
 * ESCOPO DA ORGANIZAÇÃO (01/10/2026). As contagens eram do banco inteiro: em
 * ambiente com mais de um tenant, a tela de Integrações de uma organização
 * mostrava faturas e ligações de outra. Agora toda consulta recebe o
 * `organizacaoId`; o Callface AI, que não tem a coluna, chega à organização
 * pela identidade externa da empresa (mesmo caminho de `lib/cs/health`).
 *
 * Também entraram os dois canais que a tela não mostrava — WhatsApp e caixas
 * de e-mail — e a IA da plataforma (chave no servidor, sem credencial própria).
 * Cada linha diz ONDE se resolve (`href`) ou, quando a credencial vive no
 * servidor, que é configuração do time técnico: nunca um botão que finge conectar.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export type EstadoIntegracao = "em_uso" | "configurada" | "nao_configurada";

export interface Integracao {
  chave: string;
  nome: string;
  /** O que ela faz, em uma linha, para quem não conhece o sistema. */
  paraQue: string;
  estado: EstadoIntegracao;
  /** Quantos registros ela produziu. Null quando não há contador honesto. */
  volume: number | null;
  rotuloVolume: string | null;
  /** Data do sinal mais recente. Null quando nunca houve. */
  ultimoSinal: string | null;
  /** O que falta, quando falta. Em português. */
  pendencia: string | null;
  /** Tela onde a própria organização conecta/ajusta. Null = credencial de servidor. */
  href: string | null;
  /** Estado de erro medido (sessão caída, caixa com falha de sincronização). */
  comErro?: number;
}

type Consulta = (org: string) => ReturnType<typeof sql>;

/** Uma consulta por integração, com o sinal que prova uso real. */
const SINAIS: Array<{
  chave: string; nome: string; paraQue: string;
  envs: string[];
  rotuloVolume: string;
  consulta: Consulta | null;
  pendenciaSemEnv: string;
  href?: string;
}> = [
  {
    chave: "callface", nome: "Callface (discador)",
    paraQue: "envia o lead para a fila de ligação e devolve o resultado da chamada",
    envs: ["CALLFACE_INBOUND_TOKEN"],
    rotuloVolume: "ligações registradas",
    consulta: (org) => sql`SELECT count(*)::int AS n, max(created_at)::date::text AS ultimo
                    FROM atividades WHERE organizacao_id = ${org}::uuid AND tipo ILIKE '%ligac%'`,
    pendenciaSemEnv: "falta o token de entrada da Callface",
  },
  {
    chave: "stripe", nome: "Stripe",
    paraQue: "autoridade de produto, preço e cobrança; o ONFACE sincroniza o catálogo",
    envs: ["STRIPE_API_KEY"],
    rotuloVolume: "faturas sincronizadas",
    consulta: (org) => sql`SELECT count(*)::int AS n, max(synced_at)::date::text AS ultimo
                    FROM faturas WHERE organizacao_id = ${org}::uuid AND origem = 'stripe'`,
    pendenciaSemEnv: "falta a chave de API do Stripe",
  },
  {
    chave: "meta_lead_ads", nome: "Meta Lead Ads",
    paraQue: "recebe o lead do formulário do anúncio assim que ele é preenchido",
    envs: ["META_LEADS_ACCESS_TOKEN", "META_WEBHOOK_VERIFY_TOKEN"],
    rotuloVolume: "leads recebidos",
    consulta: (org) => sql`SELECT count(*)::int AS n, max(created_at)::date::text AS ultimo
                    FROM leads WHERE organizacao_id = ${org}::uuid AND meta_ad_id IS NOT NULL`,
    pendenciaSemEnv: "falta o token de leads da Meta",
  },
  {
    chave: "meta_capi", nome: "Meta Conversions API",
    paraQue: "devolve para a Meta o que aconteceu com o lead, para otimizar a campanha",
    envs: ["META_CAPI_ACCESS_TOKEN", "META_PIXEL_ID"],
    rotuloVolume: "conversões enviadas",
    // Conta o que foi ENTREGUE. Tentativa que falhou não é conversão enviada.
    consulta: (org) => sql`SELECT count(*) FILTER (WHERE entregue)::int AS n,
                         max(criado_em) FILTER (WHERE entregue)::date::text AS ultimo
                    FROM meta_capi_entregas WHERE organizacao_id = ${org}::uuid`,
    pendenciaSemEnv: "falta o token da Conversions API",
  },
  {
    chave: "microsoft_graph", nome: "Microsoft 365 (agenda)",
    paraQue: "cria, atualiza e cancela o convite da reunião na agenda do closer",
    envs: ["MICROSOFT_CLIENT_ID", "AZURE_CLIENT_ID"],
    rotuloVolume: "reuniões com convite",
    consulta: (org) => sql`SELECT count(*)::int AS n, max(updated_at)::date::text AS ultimo
                    FROM reunioes WHERE organizacao_id = ${org}::uuid AND calendar_provider = 'microsoft'`,
    pendenciaSemEnv: "falta o aplicativo do Microsoft 365",
    href: "/ajustes/email",
  },
  {
    chave: "google_calendar", nome: "Google Agenda",
    paraQue: "mesma função do Microsoft 365, para quem usa Google",
    envs: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    rotuloVolume: "reuniões com convite",
    consulta: (org) => sql`SELECT count(*)::int AS n, max(updated_at)::date::text AS ultimo
                    FROM reunioes WHERE organizacao_id = ${org}::uuid AND calendar_provider = 'google'`,
    pendenciaSemEnv: "falta o aplicativo do Google (client id e secret)",
  },
  {
    chave: "callface_ai_db", nome: "Callface AI (dados do produto)",
    paraQue: "lê o uso real do SaaS para alimentar Cliente 360 e as métricas de CS",
    envs: ["CALLFACE_AI_DATABASE_URL"],
    rotuloVolume: "snapshots de uso",
    consulta: (org) => sql`SELECT count(*)::int AS n, max(s.snapshot_at)::date::text AS ultimo
                    FROM callface_ai_tenant_snapshots s
                    JOIN callface_ai_external_identities i ON i.id = s.external_identity_id
                    JOIN empresas e ON e.id = i.entity_id AND i.entity_type = 'empresa'
                   WHERE e.organizacao_id = ${org}::uuid`,
    pendenciaSemEnv: "falta a conexão de leitura do banco do produto",
  },
];

/** IA da plataforma: chave no servidor, usada quando a organização não tem a sua. */
const IA_PLATAFORMA: Array<{ nome: string; env: string[] }> = [
  { nome: "Claude (Anthropic)", env: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"] },
  { nome: "Groq", env: ["GROQ_API_KEY"] },
  { nome: "OpenAI", env: ["OPENAI_API_KEY"] },
  { nome: "Google", env: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"] },
];

/**
 * Canais e IA: o que a PRÓPRIA organização conecta, lido das tabelas dela.
 * Sessão de WhatsApp e caixa de e-mail têm estado próprio (conectada / com
 * erro), então o "em uso" aqui é conexão viva, não volume histórico.
 */
async function canaisDaOrganizacao(organizacaoId: string): Promise<Integracao[]> {
  const [r] = await db.execute<{
    wa_total: number; wa_conectadas: number; wa_ultima: string | null;
    em_total: number; em_ativas: number; em_erro: number; em_ultima: string | null;
    ia_ativas: number; ia_erro: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM whatsapp_sessao WHERE organizacao_id = ${organizacaoId}::uuid) AS wa_total,
      (SELECT count(*)::int FROM whatsapp_sessao WHERE organizacao_id = ${organizacaoId}::uuid AND status = 'connected') AS wa_conectadas,
      (SELECT max(coalesce(last_connected_at, updated_at))::date::text FROM whatsapp_sessao WHERE organizacao_id = ${organizacaoId}::uuid) AS wa_ultima,
      (SELECT count(*)::int FROM email_contas WHERE organizacao_id = ${organizacaoId}::uuid) AS em_total,
      (SELECT count(*)::int FROM email_contas WHERE organizacao_id = ${organizacaoId}::uuid AND sync_status = 'active') AS em_ativas,
      (SELECT count(*)::int FROM email_contas WHERE organizacao_id = ${organizacaoId}::uuid AND sync_status = 'error') AS em_erro,
      (SELECT max(coalesce(last_sync_at, updated_at))::date::text FROM email_contas WHERE organizacao_id = ${organizacaoId}::uuid) AS em_ultima,
      (SELECT count(*)::int FROM ai_provider_credentials WHERE organizacao_id = ${organizacaoId}::uuid AND ativo AND validation_error IS NULL) AS ia_ativas,
      (SELECT count(*)::int FROM ai_provider_credentials WHERE organizacao_id = ${organizacaoId}::uuid AND validation_error IS NOT NULL) AS ia_erro`);

  const waTotal = r?.wa_total ?? 0, waOn = r?.wa_conectadas ?? 0;
  const emTotal = r?.em_total ?? 0, emErro = r?.em_erro ?? 0;
  const iaPlataforma = IA_PLATAFORMA.filter((p) => p.env.some((e) => Boolean(process.env[e]?.trim()))).map((p) => p.nome);
  const iaPropria = r?.ia_ativas ?? 0;

  return [
    {
      chave: "whatsapp", nome: "WhatsApp",
      paraQue: "cada sessão é um número conectado por QR Code; é por onde saem conversas e cadências",
      estado: waOn > 0 ? "em_uso" : waTotal > 0 ? "configurada" : "nao_configurada",
      volume: waTotal, rotuloVolume: waTotal === 1 ? "sessão" : "sessões",
      ultimoSinal: r?.wa_ultima ?? null,
      pendencia: waTotal === 0 ? "nenhum número conectado: crie uma sessão e leia o QR Code"
        : waOn < waTotal ? `${waTotal - waOn} de ${waTotal} sessões desconectadas: mensagem por elas não sai` : null,
      comErro: waTotal - waOn,
      href: "/ajustes/whatsapp",
    },
    {
      chave: "email", nome: "E-mail (Outlook, Google, IMAP)",
      paraQue: "caixas sincronizadas para enviar e receber e-mail com histórico no CRM",
      estado: (r?.em_ativas ?? 0) > 0 ? "em_uso" : emTotal > 0 ? "configurada" : "nao_configurada",
      volume: emTotal, rotuloVolume: emTotal === 1 ? "caixa" : "caixas",
      ultimoSinal: r?.em_ultima ?? null,
      pendencia: emTotal === 0 ? "nenhuma caixa conectada" : emErro > 0 ? `${emErro} com erro de sincronização` : null,
      comErro: emErro,
      href: "/ajustes/email",
    },
    {
      chave: "ia", nome: "IA (agentes e NEXO)",
      paraQue: "modelo que os agentes usam; a chave da organização tem prioridade sobre a da plataforma",
      estado: iaPropria > 0 || iaPlataforma.length > 0 ? "configurada" : "nao_configurada",
      volume: iaPropria, rotuloVolume: iaPropria === 1 ? "chave própria" : "chaves próprias", ultimoSinal: null,
      pendencia: iaPropria > 0 ? null
        : iaPlataforma.length > 0 ? `usando a IA da plataforma (${iaPlataforma.join(", ")}); cadastre uma chave própria abaixo se quiser`
        : "nenhuma chave de IA: cadastre uma credencial abaixo",
      comErro: r?.ia_erro ?? 0,
      href: null,
    },
  ];
}

export async function inventarioDeIntegracoes(organizacaoId: string): Promise<Integracao[]> {
  const saida: Integracao[] = [...(await canaisDaOrganizacao(organizacaoId))];

  for (const s of SINAIS) {
    // Basta UMA das variáveis: Microsoft aceita dois nomes, e exigir as duas
    // marcaria como não configurada uma integração que está funcionando.
    const configurada = s.envs.some((e) => Boolean(process.env[e]?.trim()));

    let volume: number | null = null;
    let ultimo: string | null = null;
    let erroDeLeitura: string | null = null;
    if (s.consulta) {
      // SEM catch cego. A primeira versão engolia o erro e devolvia 0, e com
      // isso duas consultas erradas (coluna inexistente nas duas) passaram por
      // "integração sem uso". Zero por falha e zero por ausência de dado são
      // coisas diferentes, e o produto inteiro deste refactor existe para não
      // confundir as duas.
      try {
        const [r] = await db.execute<{ n: number; ultimo: string | null }>(s.consulta(organizacaoId));
        volume = r?.n ?? 0;
        ultimo = r?.ultimo ?? null;
      } catch (e) {
        volume = null;
        erroDeLeitura = e instanceof Error ? e.message : String(e);
      }
    }

    const emUso = (volume ?? 0) > 0;
    saida.push({
      chave: s.chave, nome: s.nome, paraQue: s.paraQue,
      // "Em uso" vence "configurada": integração com sinal no banco está
      // funcionando, mesmo que a credencial venha de um lugar que este
      // processo não enxerga.
      estado: emUso ? "em_uso" : configurada ? "configurada" : "nao_configurada",
      volume, rotuloVolume: s.rotuloVolume,
      ultimoSinal: ultimo,
      pendencia: erroDeLeitura
        ? `não foi possível ler o estado desta integração: ${erroDeLeitura}`
        : !configurada && !emUso ? `${s.pendenciaSemEnv} (configuração do servidor, feita pelo time técnico)` : null,
      href: s.href ?? null,
    });
  }

  const ordem: Record<EstadoIntegracao, number> = { em_uso: 0, configurada: 1, nao_configurada: 2 };
  return saida.sort((a, b) => ordem[a.estado] - ordem[b.estado] || (b.volume ?? 0) - (a.volume ?? 0));
}
