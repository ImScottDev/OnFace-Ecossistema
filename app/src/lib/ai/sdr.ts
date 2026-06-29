/**
 * AI SDR Engine — Groq-powered sales development representative
 * Uses tool_use pattern with Groq (OpenAI-compatible API) for:
 * - respond: send WhatsApp messages
 * - qualify_lead: extract lead data from conversation
 * - handoff: transfer to human
 * - advance_stage: move deal in pipeline
 * - schedule_meeting: request meeting scheduling
 * - update_summary: maintain conversation context
 */

// ─── Types ────────────────────────────────────────────────────

export interface AiSdrConfig {
  groqApiKey: string | null;
  modelo: string;
  systemPrompt: string | null;
  nomeAssistente: string;
  idiomaResposta: string;
  maxTokensResposta: number;
  temperaturaModelo: string;
  stageConfig: Record<string, StageConfig> | null;
  styleGuide: string | null;
  knowledgeBase: string | null;
  handoffTriggers: HandoffTriggers | null;
}

export interface StageConfig {
  ativo: boolean;
  prompt?: string;
  objetivo?: string;
  criterioConcluso?: string;
  acaoAoConcluir?: "advance_and_continue" | "handoff" | "handoff_only";
}

interface HandoffTriggers {
  keywords?: string[];
  sentimentoNegativo?: boolean;
  valorAlto?: number;
}

export interface ConversationMessage {
  direcao: "in" | "out";
  tipo: string;
  conteudo: string | null;
  dados: { aiGenerated?: boolean } | null;
  createdAt: Date | string;
}

export interface LeadContext {
  nome: string | null;
  sobrenome: string | null;
  empresa: string | null;
  cargo: string | null;
  email: string | null;
  servicosInteresse: string[] | null;
  leadScore: number | null;
  status: string | null;
  insumoComercial: Record<string, unknown> | null;
  cipaDiagnostico: Record<string, unknown> | null;
  cipaScore: number | null;
}

export interface NegocioContext {
  titulo: string;
  status: string;
  valorTotal: string | null;
  tipoReceita: string | null;
}

export interface ServicoContext {
  nome: string;
  descricao: string | null;
  tipo: string;
  valorSugerido: string | null;
  unidade: string;
}

export interface AiSdrCallParams {
  config: AiSdrConfig;
  orgNome: string;
  messages: ConversationMessage[];
  currentMessage: string;
  lead: LeadContext | null;
  negocio: NegocioContext | null;
  servicos: ServicoContext[];
  contatoNome: string;
  conversationSummary: string | null;
  qualificacaoExtraida: Record<string, unknown> | null;
}

export interface AiSdrResponse {
  responseText: string | null;
  toolCalls: AiSdrToolCall[];
  tokensInput: number;
  tokensOutput: number;
  intentDetectado: string | null;
  confianca: number | null;
  conversationSummary: string | null;
}

export interface AiSdrToolCall {
  name: string;
  input: Record<string, unknown>;
}

// ─── Tool Definitions (OpenAI format for Groq) ───────────────

const AI_SDR_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "respond",
      description: "Enviar mensagens de resposta ao contato via WhatsApp. Divida em múltiplas mensagens curtas como uma conversa real de WhatsApp.",
      parameters: {
        type: "object",
        properties: {
          messages: {
            type: "array",
            items: { type: "string" },
            description: "Array de mensagens curtas para enviar em sequência. Cada mensagem deve ter 1-2 frases no máximo.",
          },
          intent: {
            type: "string",
            enum: ["saudacao", "qualificacao", "apresentacao_servico", "objecao", "agendamento", "follow_up", "encerramento", "fora_escopo"],
            description: "Intenção principal desta resposta",
          },
          confidence: { type: "number", description: "Confiança na qualidade da resposta (0-1)" },
        },
        required: ["messages", "intent", "confidence"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "qualify_lead",
      description: "Atualizar dados do lead com informações extraídas da conversa. Use quando detectar dados de qualificação.",
      parameters: {
        type: "object",
        properties: {
          empresa: { type: "string", description: "Nome da empresa" },
          cargo: { type: "string", description: "Cargo do contato" },
          servicosInteresse: { type: "array", items: { type: "string" }, description: "Serviços de interesse" },
          orcamentoEstimado: { type: "string", description: "Orçamento mencionado" },
          prazo: { type: "string", description: "Prazo ou urgência" },
          necessidades: { type: "array", items: { type: "string" }, description: "Necessidades identificadas" },
          setor: { type: "string", description: "Setor da empresa" },
          porte: { type: "string", enum: ["pequena", "media", "grande"], description: "Porte da empresa" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "handoff",
      description: "Transferir conversa para um humano. Use quando: contato pede, pergunta complexa, frustração, valor alto, fora do escopo da AI.",
      parameters: {
        type: "object",
        properties: {
          motivo: {
            type: "string",
            enum: ["pedido_contato", "pergunta_complexa", "sentimento_negativo", "valor_alto", "fora_escopo", "criterio_concluido"],
            description: "Motivo da transferência",
          },
          mensagemTransicao: { type: "string", description: "Mensagem de transição para o contato" },
          prioridade: { type: "string", enum: ["normal", "alta", "urgente"], description: "Prioridade do handoff" },
        },
        required: ["motivo", "mensagemTransicao"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "advance_stage",
      description: "Avançar o negócio para o próximo estágio do pipeline quando o critério de conclusão for atingido. Use 'sem_retorno' quando o lead não responde após múltiplos follow-ups.",
      parameters: {
        type: "object",
        properties: {
          novoStatus: { type: "string", enum: ["em_contato", "respondeu", "reuniao_agendada", "sem_retorno"], description: "Novo estágio" },
          motivo: { type: "string", description: "Motivo do avanço" },
        },
        required: ["novoStatus", "motivo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "schedule_meeting",
      description: "Solicitar agendamento de reunião quando o lead estiver qualificado e quiser conversar com um especialista.",
      parameters: {
        type: "object",
        properties: {
          assunto: { type: "string", description: "Assunto da reunião" },
          dataPreferida: { type: "string", description: "Data/período preferido pelo lead" },
          observacoes: { type: "string", description: "Notas adicionais" },
        },
        required: ["assunto"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_summary",
      description: "Atualizar o resumo da conversa. Use SEMPRE ao final de cada interação para manter o contexto.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Resumo completo e atualizado da conversa até agora. Max 500 palavras.",
          },
        },
        required: ["summary"],
      },
    },
  },
];

// ─── Prompt Builder ───────────────────────────────────────────

export function buildSystemPrompt(params: {
  config: AiSdrConfig;
  orgNome: string;
  lead: LeadContext | null;
  negocio: NegocioContext | null;
  servicos: ServicoContext[];
  conversationSummary: string | null;
  qualificacaoExtraida: Record<string, unknown> | null;
}): string {
  const { config, orgNome, lead, negocio, servicos, conversationSummary, qualificacaoExtraida } = params;

  const stageStatus = negocio?.status || "em_contato";
  const stageConf = config.stageConfig?.[stageStatus];

  let prompt = `Você é ${config.nomeAssistente}, um SDR (Sales Development Representative) virtual da ${orgNome}.
Você está em uma conversa por WhatsApp com um potencial cliente.

## Objetivo Geral
1. Qualificar o lead: entender empresa, necessidades, orçamento estimado e prazo
2. Apresentar serviços relevantes quando apropriado
3. Agendar uma reunião com um especialista quando o lead estiver qualificado
4. Responder objeções com empatia e dados

## Regras de Comunicação (CRÍTICO)
- Responda SEMPRE em ${config.idiomaResposta}
- Mensagens CURTAS. Cada mensagem no array deve ter 1-2 frases no máximo
- Divida sua resposta em 2-4 mensagens separadas no array, como uma pessoa real faria no WhatsApp
- NÃO despeje toda a informação de uma vez. Desenvolva a conversa aos poucos
- Na primeira interação: cumprimente, mostre interesse, faça UMA pergunta. Só isso
- NUNCA use travessão (—). Use vírgulas ou pontos
- Não use markdown, negrito, asteriscos ou formatação. Texto puro de WhatsApp
- Tom: conversa real, informal mas profissional
- SIGA O ESTILO DE COMUNICAÇÃO abaixo se disponível

## Regras de Negócio
- NUNCA invente informações sobre serviços, preços ou prazos que não estejam no catálogo ou base de conhecimento
- Se não souber a resposta, diga que vai verificar e use a tool "handoff"
- Se o contato pedir para falar com um humano, use "handoff" IMEDIATAMENTE
- Se detectar frustração ou urgência, use "handoff"
- Personalize com o nome e contexto do lead
- Se receber mídia (imagem/áudio/vídeo), reconheça mas explique que é um assistente de texto
- SEMPRE use a tool "update_summary" ao final para manter o resumo atualizado
- OBRIGATÓRIO: SEMPRE chame a tool "respond" com suas mensagens
- Se o lead não respondeu após múltiplos follow-ups, use advance_stage com "sem_retorno" para mover para estagnados
`;

  // Stage-specific config
  if (stageConf?.ativo) {
    prompt += `
## Estágio Atual: ${stageStatus.toUpperCase()}
Objetivo: ${stageConf.objetivo || "Avançar a conversa"}
Critério de conclusão: ${stageConf.criterioConcluso || "A definir"}
${stageConf.prompt || ""}

Quando o critério for atingido, use a tool "advance_stage" ou "handoff" conforme a ação configurada (${stageConf.acaoAoConcluir || "advance_and_continue"}).
`;
  }

  // InsumoComercial (CLOSER framework) — our unique advantage
  if (lead?.insumoComercial) {
    const ic = lead.insumoComercial;
    prompt += "\n## Insumo Comercial (CLOSER Framework — use como guia)\n";
    if (ic.abertura_recomendada) prompt += `- Abertura recomendada: ${ic.abertura_recomendada}\n`;
    if (ic.angulo_de_ataque) prompt += `- Ângulo de ataque: ${ic.angulo_de_ataque}\n`;
    if (ic.dor_principal) prompt += `- Dor principal: ${ic.dor_principal}\n`;
    if (ic.objecao_provavel) prompt += `- Objeção provável: ${ic.objecao_provavel}\n`;
    if (ic.argumento_scott_studio) prompt += `- Argumento Scott Studio: ${ic.argumento_scott_studio}\n`;
    if (ic.bottleneck) prompt += `- Bottleneck: ${ic.bottleneck}\n`;
    if (ic.closer_c) prompt += `- CLOSER C: ${ic.closer_c}\n`;
    if (ic.closer_l) prompt += `- CLOSER L: ${ic.closer_l}\n`;
  }

  // CIPA Diagnostico
  if (lead?.cipaDiagnostico) {
    const cipa = lead.cipaDiagnostico;
    prompt += `\n## Diagnóstico CIPA (score: ${lead.cipaScore || "N/A"}/100)\n`;
    if (cipa.resumo) prompt += `${cipa.resumo}\n`;
    if (Array.isArray(cipa.problemas) && cipa.problemas.length > 0) {
      prompt += `Problemas encontrados: ${cipa.problemas.slice(0, 5).join(", ")}\n`;
    }
    prompt += `Use esses dados para personalizar a abordagem. Mostre que você já analisou o negócio do lead.\n`;
  }

  // Services catalog
  if (servicos.length > 0) {
    prompt += "\n## Catálogo de Serviços\n";
    for (const s of servicos) {
      prompt += `- ${s.nome} (${s.tipo}, R$ ${s.valorSugerido || "sob consulta"}/${s.unidade}): ${s.descricao || "Sem descrição"}\n`;
    }
  }

  // Knowledge base
  if (config.knowledgeBase) {
    prompt += `\n## Base de Conhecimento\n${config.knowledgeBase}\n`;
  }

  // Style guide
  if (config.styleGuide) {
    prompt += `\n## Estilo de Comunicação (aprenda com o time)\n${config.styleGuide}\n`;
  }

  // Conversation summary
  if (conversationSummary) {
    prompt += `\n## Resumo da Conversa (até agora)\n${conversationSummary}\n`;
  }

  // Qualification data
  if (qualificacaoExtraida && Object.keys(qualificacaoExtraida).length > 0) {
    prompt += "\n## Dados Já Coletados\n";
    for (const [key, value] of Object.entries(qualificacaoExtraida)) {
      if (value) prompt += `- ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}\n`;
    }
  }

  // Lead context
  if (lead) {
    prompt += "\n## Informações do Lead\n";
    if (lead.nome) prompt += `- Nome: ${lead.nome}${lead.sobrenome ? ` ${lead.sobrenome}` : ""}\n`;
    if (lead.empresa) prompt += `- Empresa: ${lead.empresa}\n`;
    if (lead.cargo) prompt += `- Cargo: ${lead.cargo}\n`;
    if (lead.email) prompt += `- Email: ${lead.email}\n`;
    if (lead.servicosInteresse?.length) prompt += `- Interesses: ${lead.servicosInteresse.join(", ")}\n`;
    if (lead.leadScore) prompt += `- Lead Score: ${lead.leadScore}\n`;
  }

  // Deal context
  if (negocio) {
    prompt += `\n## Negócio Ativo\n- ${negocio.titulo} (${negocio.status})`;
    if (negocio.valorTotal) prompt += ` — R$ ${negocio.valorTotal}`;
    prompt += "\n";
  }

  // Custom system prompt
  if (config.systemPrompt) {
    prompt += `\n## Instruções Adicionais\n${config.systemPrompt}\n`;
  }

  return prompt;
}

// ─── Message Builder ──────────────────────────────────────────

interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export function buildMessages(history: ConversationMessage[], currentMessage: string): GroqMessage[] {
  const messages: GroqMessage[] = [];

  for (const msg of history) {
    let content = msg.conteudo || "";

    if (msg.tipo !== "text") {
      const tipoMap: Record<string, string> = {
        image: "Imagem recebida",
        audio: "Áudio recebido",
        video: "Vídeo recebido",
        document: "Documento recebido",
        sticker: "Sticker recebido",
        location: "Localização compartilhada",
        contact: "Contato compartilhado",
        call: "Chamada de voz",
      };
      content = `[${tipoMap[msg.tipo] || msg.tipo}]${content ? `: ${content}` : ""}`;
    }

    if (!content) continue;

    if (msg.direcao === "in") {
      messages.push({ role: "user", content });
    } else {
      const isAi = msg.dados?.aiGenerated;
      const prefix = isAi ? "" : "[Vendedor]: ";
      messages.push({ role: "assistant", content: `${prefix}${content}` });
    }
  }

  // Merge consecutive same-role messages
  const merged: GroqMessage[] = [];
  for (const msg of messages) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].content = `${merged[merged.length - 1].content}\n${msg.content}`;
    } else {
      merged.push(msg);
    }
  }

  // Add current message
  if (currentMessage) {
    if (merged.length > 0 && merged[merged.length - 1].role === "user") {
      merged[merged.length - 1].content += `\n${currentMessage}`;
    } else {
      merged.push({ role: "user", content: currentMessage });
    }
  }

  // Ensure first message is user
  if (merged.length > 0 && merged[0].role !== "user") {
    merged.shift();
  }

  // Ensure alternating roles
  const final: GroqMessage[] = [];
  for (const msg of merged) {
    if (final.length > 0 && final[final.length - 1].role === msg.role) {
      final[final.length - 1].content += `\n${msg.content}`;
    } else {
      final.push(msg);
    }
  }

  return final;
}

// ─── Groq API Call ────────────────────────────────────────────

export async function callAiSdr(params: AiSdrCallParams): Promise<AiSdrResponse> {
  const apiKey = params.config.groqApiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const systemPrompt = buildSystemPrompt({
    config: params.config,
    orgNome: params.orgNome,
    lead: params.lead,
    negocio: params.negocio,
    servicos: params.servicos,
    conversationSummary: params.conversationSummary,
    qualificacaoExtraida: params.qualificacaoExtraida,
  });

  const historyMessages = buildMessages(params.messages, params.currentMessage);

  if (historyMessages.length === 0) {
    historyMessages.push({ role: "user", content: params.currentMessage || "Oi" });
  }

  const allToolCalls: AiSdrToolCall[] = [];
  let responseText: string | null = null;
  let intentDetectado: string | null = null;
  let confianca: number | null = null;
  let conversationSummary: string | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Build full message list: system + history
  let currentMessages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
  ];

  const MAX_ITERATIONS = 3;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.config.modelo || "llama-3.3-70b-versatile",
        messages: currentMessages,
        tools: AI_SDR_TOOLS,
        tool_choice: "auto",
        max_tokens: params.config.maxTokensResposta || 1024,
        temperature: parseFloat(params.config.temperaturaModelo || "0.3"),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error ${res.status}: ${errText}`);
    }

    const data = await res.json() as {
      choices: Array<{
        message: {
          role: string;
          content: string | null;
          tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
        };
        finish_reason: string;
      }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    totalInputTokens += data.usage?.prompt_tokens || 0;
    totalOutputTokens += data.usage?.completion_tokens || 0;

    const choice = data.choices[0];
    if (!choice) break;

    const msg = choice.message;
    console.log(`[AI-SDR] Groq response (iter ${iter + 1}): finish_reason=${choice.finish_reason}, tool_calls=${msg.tool_calls?.length || 0}`);

    // If no tool calls, capture text content as the response
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      if (msg.content) {
        responseText = msg.content;
      }
      break;
    }
    // When tool calls exist, ignore msg.content — the real response comes from the "respond" tool

    // Process tool calls
    let hasRespond = false;
    const toolResults: GroqMessage[] = [];

    // First, push the assistant message with tool_calls
    currentMessages.push({
      role: "assistant",
      content: msg.content,
      tool_calls: msg.tool_calls.map(tc => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    });

    for (const tc of msg.tool_calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function.arguments);
      } catch { /* empty */ }

      allToolCalls.push({ name: tc.function.name, input });

      if (tc.function.name === "respond") {
        hasRespond = true;
        if (Array.isArray(input.messages)) {
          responseText = (input.messages as string[]).join("\n---SPLIT---\n");
        }
        intentDetectado = (input.intent as string) || null;
        confianca = (input.confidence as number) || null;
        toolResults.push({ role: "tool", content: "Mensagem enviada com sucesso", tool_call_id: tc.id });
      } else if (tc.function.name === "update_summary") {
        conversationSummary = (input.summary as string) || null;
        toolResults.push({ role: "tool", content: "Resumo atualizado", tool_call_id: tc.id });
      } else if (tc.function.name === "qualify_lead") {
        toolResults.push({ role: "tool", content: "Dados do lead atualizados com sucesso", tool_call_id: tc.id });
      } else if (tc.function.name === "handoff") {
        toolResults.push({ role: "tool", content: "Handoff iniciado", tool_call_id: tc.id });
      } else if (tc.function.name === "advance_stage") {
        toolResults.push({ role: "tool", content: "Estágio avançado", tool_call_id: tc.id });
      } else if (tc.function.name === "schedule_meeting") {
        toolResults.push({ role: "tool", content: "Agendamento registrado", tool_call_id: tc.id });
      }
    }

    // If we got a respond call, we're done
    if (hasRespond || choice.finish_reason === "stop") {
      break;
    }

    // Otherwise, send tool results back and continue
    currentMessages.push(...toolResults);
  }

  // Sanitize: strip any leaked function/tool calls from response text
  // Groq sometimes leaks tool calls as text alongside structured tool_calls
  if (responseText) {
    responseText = responseText
      // <function=respond>{...}</function> pattern (Groq llama leak)
      .replace(/<function=\w+>[\s\S]*?<\/function>/g, "")
      // <function ...> or </function> standalone tags
      .replace(/<\/?function[^>]*>/g, "")
      // Leaked JSON tool call patterns: {"confidence": ..., "intent": ..., "messages": [...]}
      .replace(/\{["']confidence["']\s*:\s*[\d.]+\s*,\s*["']intent["']\s*:\s*["'][^"']*["']\s*,\s*["']messages["']\s*:\s*\[[\s\S]*?\]\s*\}/g, "")
      // Clean up leftover whitespace/newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // If sanitization emptied the response, null it out
    if (!responseText) responseText = null;
  }

  return {
    responseText,
    toolCalls: allToolCalls,
    tokensInput: totalInputTokens,
    tokensOutput: totalOutputTokens,
    intentDetectado,
    confianca,
    conversationSummary,
  };
}

// ─── Business Hours Check ─────────────────────────────────────

export function isWithinBusinessHours(
  horarioComercial: { inicio: string; fim: string; diasSemana: number[]; timezone: string } | null
): boolean {
  if (!horarioComercial) return true;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: horarioComercial.timezone || "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = dayMap[parts.find((p) => p.type === "weekday")?.value || "Mon"] ?? 1;

  if (!horarioComercial.diasSemana.includes(weekday)) return false;

  const currentMinutes = hour * 60 + minute;
  const [startH, startM] = horarioComercial.inicio.split(":").map(Number);
  const [endH, endM] = horarioComercial.fim.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}
