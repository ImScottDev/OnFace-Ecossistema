/**
 * O agente consegue mesmo rodar? (SPEC-IA-01)
 *
 * O gate de publicação conferia provider, modelo, instruções e gatilho. NÃO
 * conferia **credencial**. Com isso, publicar o NEXO hoje passa em todas as
 * checagens, e na primeira mensagem do cliente o runtime levanta "Credencial
 * anthropic não configurada". O worker registra e, por decisão explícita, NÃO
 * cai no SDR legado (cair geraria resposta duplicada). Resultado: o cliente
 * escreve e **ninguém responde**, com um `console.error` no servidor como único
 * sinal.
 *
 * Estado medido em 21/09: os dois agentes (NEXO e Hermes) apontam para
 * `anthropic` sem credencial própria, e o ambiente só tem `GROQ_API_KEY`.
 * Publicar qualquer um dos dois produziria exatamente esse silêncio.
 *
 * A verificação é a MESMA para publicar e para a tela mostrar. Duas listas de
 * requisito divergem, e a que diverge é sempre a que o usuário lê.
 *
 * NÃO TOCA EM CREDENCIAL. Só pergunta se existe; nunca lê, decifra ou loga o
 * valor.
 */
import { db } from "@/lib/db";
import { aiProviderCredentials, aiAgentVersions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type Provider = "groq" | "openai" | "anthropic" | "google";

export interface Falta {
  campo: "provider" | "modelo" | "credencial" | "instrucoes" | "gatilho";
  /** Em português, para a tela mostrar sem tradução. */
  mensagem: string;
  /** O que a pessoa faz para resolver. */
  comoResolver: string;
}

export interface Prontidao {
  pronto: boolean;
  faltas: Falta[];
  /** De onde viria a chave se o agente rodasse agora. Nunca o valor. */
  origemDaCredencial: "organizacao" | "ambiente" | null;
}

/** Espelha `resolveApiKey` do runtime. Se um mudar, o outro precisa mudar. */
const ENV_POR_PROVIDER: Record<Provider, () => string | undefined> = {
  groq: () => process.env.GROQ_API_KEY,
  openai: () => process.env.OPENAI_API_KEY,
  anthropic: () => process.env.ANTHROPIC_API_KEY,
  google: () => process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
};

const NOME_DO_PROVIDER: Record<Provider, string> = {
  groq: "Groq", openai: "OpenAI", anthropic: "Anthropic", google: "Google",
};

export async function verificarProntidao(
  version: Pick<typeof aiAgentVersions.$inferSelect,
    "provider" | "modelo" | "systemPrompt" | "triggerConfig" | "credentialId" | "organizacaoId">,
): Promise<Prontidao> {
  const faltas: Falta[] = [];
  const provider = (version.provider?.trim() || null) as Provider | null;

  if (!provider) {
    faltas.push({
      campo: "provider",
      mensagem: "nenhum provedor de IA escolhido",
      comoResolver: "escolha o provedor na aba do modelo",
    });
  }
  if (!version.modelo?.trim()) {
    faltas.push({
      campo: "modelo",
      mensagem: "nenhum modelo escolhido",
      comoResolver: "escolha o modelo na aba do modelo",
    });
  }
  if ((version.systemPrompt ?? "").trim().length < 20) {
    faltas.push({
      campo: "instrucoes",
      mensagem: "as instruções do agente estão vazias ou curtas demais",
      comoResolver: "descreva o que o agente faz, em pelo menos uma frase completa",
    });
  }

  const trigger = version.triggerConfig && typeof version.triggerConfig === "object"
    ? version.triggerConfig as Record<string, unknown> : {};
  const eventos = Array.isArray(trigger.events)
    ? trigger.events.filter((e): e is string => typeof e === "string") : [];
  if (eventos.length === 0) {
    faltas.push({
      campo: "gatilho",
      mensagem: "o agente não tem nenhum gatilho",
      comoResolver: "escolha pelo menos um evento que aciona o agente",
    });
  }

  // Credencial: a verificação que faltava.
  let origem: Prontidao["origemDaCredencial"] = null;
  if (provider) {
    if (version.credentialId && version.organizacaoId) {
      const [credencial] = await db.select({ id: aiProviderCredentials.id })
        .from(aiProviderCredentials)
        .where(and(
          eq(aiProviderCredentials.id, version.credentialId),
          eq(aiProviderCredentials.organizacaoId, version.organizacaoId),
          eq(aiProviderCredentials.ativo, true),
        ))
        .limit(1);
      if (credencial) origem = "organizacao";
      else {
        faltas.push({
          campo: "credencial",
          mensagem: "a credencial escolhida não existe mais ou foi desativada",
          comoResolver: "escolha outra credencial ativa em Integrações",
        });
      }
    } else if (ENV_POR_PROVIDER[provider]?.()) {
      origem = "ambiente";
    } else {
      faltas.push({
        campo: "credencial",
        mensagem: `não há credencial de ${NOME_DO_PROVIDER[provider]} configurada`,
        // A frase diz a consequência de propósito: sem ela, quem publica não
        // tem como saber que o custo do erro é o cliente falando sozinho.
        comoResolver:
          `cadastre uma chave de ${NOME_DO_PROVIDER[provider]} em Integrações. ` +
          "Sem ela o agente é acionado, falha na chamada e o contato fica sem resposta",
      });
    }
  }

  return { pronto: faltas.length === 0, faltas, origemDaCredencial: origem };
}

/** Uma frase só, para erro de API e para log. */
export function resumoDasFaltas(p: Prontidao): string {
  return p.faltas.map((f) => f.mensagem).join("; ");
}
