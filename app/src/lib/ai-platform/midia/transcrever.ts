/**
 * Transcrição de áudios recebidos no WhatsApp.
 *
 * O agente só "entende" o áudio se houver texto: a transcrição é gravada em
 * `whatsapp_mensagens.dados.transcricao` (uma vez; reaproveitada por todos) e o
 * Context Builder a mostra na conversa. Falha não derruba a execução: o áudio
 * aparece como "sem transcrição disponível" e o motivo fica em `transcricaoErro`.
 * Resposta por áudio sintetizado NÃO faz parte da v1.
 */
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");

type Provedor = { url: string; chave: string; modelo: string };

function provedor(): Provedor | null {
  const teste = process.env.NODE_ENV !== "production" ? process.env.ONFACE_TRANSCRICAO_BASE_URL_TESTE : undefined;
  if (teste) return { url: `${teste}/audio/transcriptions`, chave: "teste", modelo: "teste" };
  if (process.env.GROQ_API_KEY) return { url: "https://api.groq.com/openai/v1/audio/transcriptions", chave: process.env.GROQ_API_KEY, modelo: "whisper-large-v3-turbo" };
  if (process.env.OPENAI_API_KEY) return { url: "https://api.openai.com/v1/audio/transcriptions", chave: process.env.OPENAI_API_KEY, modelo: "whisper-1" };
  return null;
}

export const transcricaoDisponivel = () => provedor() !== null;

/** `/uploads/x.ogg` -> arquivo local. Só o nome do arquivo conta: nada de sair da pasta. */
function arquivoLocal(mediaUrl: string | null): string | null {
  if (!mediaUrl || !mediaUrl.startsWith("/uploads/")) return null;
  const nome = path.basename(mediaUrl);
  const caminho = path.join(UPLOADS_DIR, nome);
  return fs.existsSync(caminho) ? caminho : null;
}

export async function transcreverArquivo(caminho: string): Promise<string> {
  const p = provedor();
  if (!p) throw new Error("nenhum provedor de transcrição configurado (GROQ_API_KEY ou OPENAI_API_KEY)");
  const form = new FormData();
  form.set("file", new Blob([fs.readFileSync(caminho)]), path.basename(caminho));
  form.set("model", p.modelo);
  form.set("language", "pt");
  form.set("response_format", "json");
  const res = await fetch(p.url, { method: "POST", headers: { Authorization: `Bearer ${p.chave}` }, body: form, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`transcrição HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { text?: string };
  return (j.text ?? "").trim();
}

/** Transcreve os áudios recentes do contato que ainda não têm texto. Devolve quantos ganharam transcrição. */
export async function garantirTranscricoes(contatoId: string, max = 3): Promise<number> {
  const linhas = await db.execute<{ id: string; media_url: string | null }>(sql`
    SELECT id::text, media_url FROM whatsapp_mensagens
     WHERE contato_id = ${contatoId}::uuid AND direcao = 'in' AND tipo = 'audio'
       AND dados->>'transcricao' IS NULL AND dados->>'transcricaoErro' IS NULL
       AND created_at > now() - interval '14 days'
     ORDER BY created_at DESC LIMIT ${max}`);
  let feitas = 0;
  for (const m of linhas) {
    const caminho = arquivoLocal(m.media_url);
    try {
      if (!caminho) throw new Error("arquivo de áudio não está disponível localmente");
      const texto = await transcreverArquivo(caminho);
      if (!texto) throw new Error("transcrição vazia");
      await db.execute(sql`UPDATE whatsapp_mensagens SET dados = coalesce(dados,'{}'::jsonb) || jsonb_build_object('transcricao', ${texto}::text, 'transcricaoEm', now()::text) WHERE id = ${m.id}::uuid`);
      feitas++;
    } catch (e) {
      const motivo = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      await db.execute(sql`UPDATE whatsapp_mensagens SET dados = coalesce(dados,'{}'::jsonb) || jsonb_build_object('transcricaoErro', ${motivo}::text) WHERE id = ${m.id}::uuid`);
    }
  }
  return feitas;
}
