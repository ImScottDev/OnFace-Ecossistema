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
}

/** Uma consulta por integração, com o sinal que prova uso real. */
const SINAIS: Array<{
  chave: string; nome: string; paraQue: string;
  envs: string[];
  rotuloVolume: string;
  consulta: ReturnType<typeof sql> | null;
  pendenciaSemEnv: string;
}> = [
  {
    chave: "callface", nome: "Callface (discador)",
    paraQue: "envia o lead para a fila de ligação e devolve o resultado da chamada",
    envs: ["CALLFACE_INBOUND_TOKEN"],
    rotuloVolume: "ligações registradas",
    consulta: sql`SELECT count(*)::int AS n, max(created_at)::date::text AS ultimo
                    FROM atividades WHERE tipo ILIKE '%ligac%'`,
    pendenciaSemEnv: "falta o token de entrada da Callface",
  },
  {
    chave: "stripe", nome: "Stripe",
    paraQue: "autoridade de produto, preço e cobrança; o ONFACE sincroniza o catálogo",
    envs: ["STRIPE_API_KEY"],
    rotuloVolume: "faturas sincronizadas",
    consulta: sql`SELECT count(*)::int AS n, max(synced_at)::date::text AS ultimo
                    FROM faturas WHERE origem = 'stripe'`,
    pendenciaSemEnv: "falta a chave de API do Stripe",
  },
  {
    chave: "meta_lead_ads", nome: "Meta Lead Ads",
    paraQue: "recebe o lead do formulário do anúncio assim que ele é preenchido",
    envs: ["META_LEADS_ACCESS_TOKEN", "META_WEBHOOK_VERIFY_TOKEN"],
    rotuloVolume: "leads recebidos",
    consulta: sql`SELECT count(*)::int AS n, max(created_at)::date::text AS ultimo
                    FROM leads WHERE meta_ad_id IS NOT NULL`,
    pendenciaSemEnv: "falta o token de leads da Meta",
  },
  {
    chave: "meta_capi", nome: "Meta Conversions API",
    paraQue: "devolve para a Meta o que aconteceu com o lead, para otimizar a campanha",
    envs: ["META_CAPI_ACCESS_TOKEN", "META_PIXEL_ID"],
    rotuloVolume: "conversões enviadas",
    // Conta o que foi ENTREGUE. Tentativa que falhou não é conversão enviada.
    consulta: sql`SELECT count(*) FILTER (WHERE entregue)::int AS n,
                         max(criado_em) FILTER (WHERE entregue)::date::text AS ultimo
                    FROM meta_capi_entregas`,
    pendenciaSemEnv: "falta o token da Conversions API",
  },
  {
    chave: "microsoft_graph", nome: "Microsoft 365 (agenda)",
    paraQue: "cria, atualiza e cancela o convite da reunião na agenda do closer",
    envs: ["MICROSOFT_CLIENT_ID", "AZURE_CLIENT_ID"],
    rotuloVolume: "reuniões com convite",
    consulta: sql`SELECT count(*)::int AS n, max(updated_at)::date::text AS ultimo
                    FROM reunioes WHERE calendar_provider = 'microsoft'`,
    pendenciaSemEnv: "falta o aplicativo do Microsoft 365",
  },
  {
    chave: "google_calendar", nome: "Google Agenda",
    paraQue: "mesma função do Microsoft 365, para quem usa Google",
    envs: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    rotuloVolume: "reuniões com convite",
    consulta: sql`SELECT count(*)::int AS n, max(updated_at)::date::text AS ultimo
                    FROM reunioes WHERE calendar_provider = 'google'`,
    pendenciaSemEnv: "falta o aplicativo do Google (client id e secret)",
  },
  {
    chave: "callface_ai_db", nome: "Callface AI (dados do produto)",
    paraQue: "lê o uso real do SaaS para alimentar Cliente 360 e as métricas de CS",
    envs: ["CALLFACE_AI_DATABASE_URL"],
    rotuloVolume: "snapshots de uso",
    consulta: sql`SELECT count(*)::int AS n, max(snapshot_at)::date::text AS ultimo
                    FROM callface_ai_tenant_snapshots`,
    pendenciaSemEnv: "falta a conexão de leitura do banco do produto",
  },
];

export async function inventarioDeIntegracoes(): Promise<Integracao[]> {
  const saida: Integracao[] = [];

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
        const [r] = await db.execute<{ n: number; ultimo: string | null }>(s.consulta);
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
        : !configurada && !emUso ? s.pendenciaSemEnv : null,
    });
  }

  const ordem: Record<EstadoIntegracao, number> = { em_uso: 0, configurada: 1, nao_configurada: 2 };
  return saida.sort((a, b) => ordem[a.estado] - ordem[b.estado] || (b.volume ?? 0) - (a.volume ?? 0));
}
