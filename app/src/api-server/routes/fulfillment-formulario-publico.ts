// Formulário de implantação PABX — página pública (sem login, 18/08).
// Etapa 1 do checklist de Fulfillment ("levantamento de informações")
// depende do cliente preencher contatos/ramais/linhas/canais/URAs/filas/
// regras de atendimento/telefones IP — hoje sem nenhuma superfície. Este
// arquivo é a rota pública (sem getCtx/sessão), no mesmo espírito de
// GET /propostas/:id/publica: valida só pelo token opaco (publicToken) da
// URL, nunca por ID sequencial.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { fulfillments, fulfillmentFormularios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import fs from "fs";
import path from "path";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10MB — fatura/documento com foto

async function buscarFulfillmentPorToken(publicToken: string) {
  const [fulfillment] = await db
    .select({
      id: fulfillments.id,
      organizacaoId: fulfillments.organizacaoId,
      serviceFamily: fulfillments.serviceFamily,
      status: fulfillments.status,
      publicToken: fulfillments.publicToken,
    })
    .from(fulfillments)
    .where(eq(fulfillments.publicToken, publicToken))
    .limit(1);
  return fulfillment ?? null;
}

async function buscarOuCriarFormulario(fulfillmentId: string, organizacaoId: string) {
  const [existente] = await db
    .select()
    .from(fulfillmentFormularios)
    .where(eq(fulfillmentFormularios.fulfillmentId, fulfillmentId))
    .limit(1);
  if (existente) return existente;

  const [criado] = await db
    .insert(fulfillmentFormularios)
    .values({ organizacaoId, fulfillmentId, status: "NOT_SENT" })
    .returning();
  return criado;
}

// GET /fulfillment-formulario/:publicToken — payload pra página pública.
// Cria o formulário na primeira vez (status NOT_SENT) e, no primeiro
// acesso real do cliente, marca NOT_SENT → SENT + enviadoEm (o "envio" aqui
// é o link ser aberto, não um disparo de e-mail — não existe isso ainda).
app.get("/fulfillment-formulario/:publicToken", async (c) => {
  const publicToken = c.req.param("publicToken");
  if (!UUID_RE.test(publicToken)) return c.json({ error: "Link inválido" }, 404);

  const fulfillment = await buscarFulfillmentPorToken(publicToken);
  if (!fulfillment) return c.json({ error: "Link inválido ou expirado" }, 404);

  let formulario = await buscarOuCriarFormulario(fulfillment.id, fulfillment.organizacaoId);

  if (formulario.status === "NOT_SENT") {
    const [atualizado] = await db
      .update(fulfillmentFormularios)
      .set({ status: "SENT", enviadoEm: new Date(), updatedAt: new Date() })
      .where(eq(fulfillmentFormularios.id, formulario.id))
      .returning();
    formulario = atualizado;
  }

  return c.json({
    fulfillment: { serviceFamily: fulfillment.serviceFamily, status: fulfillment.status },
    formulario: {
      status: formulario.status,
      respostas: formulario.respostas,
      enviadoEm: formulario.enviadoEm,
      submetidoEm: formulario.submetidoEm,
      notaRevisao: formulario.notaRevisao,
    },
  });
});

// POST /fulfillment-formulario/:publicToken/upload — anexo real (fatura/
// documento do titular da linha, pedido explícito do Kauã: "a pessoa tem
// que colocar lá, já anexar o arquivo", nada de "envie por e-mail depois").
// Sem sessão (rota pública), autenticado só pelo publicToken — mesmo padrão
// de segurança do restante deste arquivo. Reaproveita o mesmo mecanismo de
// disco de `routes/uploads.ts`/`routes/perfil.ts` (fs local, sem storage novo).
app.post("/fulfillment-formulario/:publicToken/upload", async (c) => {
  const publicToken = c.req.param("publicToken");
  if (!UUID_RE.test(publicToken)) return c.json({ error: "Link inválido" }, 404);

  const fulfillment = await buscarFulfillmentPorToken(publicToken);
  if (!fulfillment) return c.json({ error: "Link inválido ou expirado" }, 404);

  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  if (!file) return c.json({ error: "Nenhum arquivo enviado" }, 400);
  if (!TIPOS_PERMITIDOS.includes(file.type)) return c.json({ error: "Formato inválido. Use PDF, JPG, PNG ou WebP" }, 400);
  if (file.size > TAMANHO_MAXIMO) return c.json({ error: "Arquivo muito grande. Máximo 10MB" }, 400);

  const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
  const dir = path.join(UPLOADS_DIR, "fulfillment-formularios", fulfillment.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const nomeArquivo = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, nomeArquivo), buffer);

  return c.json({
    url: `/api/uploads/fulfillment-formularios/${fulfillment.id}/${nomeArquivo}`,
    nomeOriginal: file.name,
  });
});

// Payload livre (jsonb) — schema permissivo de propósito (não travar o
// cliente por causa de um campo que não sabe preencher ainda, e não perder
// dado se o formulário evoluir). Reconstrução 19/08 (referência real:
// Callface-Processo-Delivery-PABX.pdf + os 3 formulários reais em planilha
// — Portabilidade/Ramais/URA): `ramais`/`portabilidade`/`ura` viraram
// objetos ricos com os campos reais do processo — `.record(z.any())` em vez
// de schema tipado estrito evita que um campo novo seja silenciosamente
// removido pelo strip default do Zod (aconteceu com a versão anterior).
const respostasSchema = z
  .object({
    portabilidade: z.record(z.string(), z.any()).optional(),
    ramais: z.array(z.record(z.string(), z.any())).optional(),
    ura: z.record(z.string(), z.any()).optional(),
    outrasInformacoes: z.string().optional(),
    // Chaves do formulário legado (compat, sessões antigas ainda no jsonb).
    contatos: z.array(z.record(z.string(), z.any())).optional(),
    linhas: z.array(z.record(z.string(), z.any())).optional(),
    canais: z.string().optional(),
    uras: z.string().optional(),
    filas: z.string().optional(),
    regrasAtendimento: z.string().optional(),
    telefonesIp: z.array(z.record(z.string(), z.any())).optional(),
  })
  .catchall(z.any()); // permissivo: campo novo do processo real não deve ser rejeitado

const postSchema = z.object({ respostas: respostasSchema });

// POST /fulfillment-formulario/:publicToken — submissão do cliente.
// Escolha: SOBRESCREVE `respostas` por completo com o que veio no body (não
// faz merge campo a campo com o valor anterior). A página pública sempre
// manda o objeto completo do formulário (todas as seções, mesmo vazias),
// então sobrescrever é equivalente a mergear e muito mais simples/previsível
// — evita "campo fantasma" de uma resposta antiga que o cliente queria
// apagar mas o merge teria preservado.
app.post("/fulfillment-formulario/:publicToken", async (c) => {
  const publicToken = c.req.param("publicToken");
  if (!UUID_RE.test(publicToken)) return c.json({ error: "Link inválido" }, 404);

  const fulfillment = await buscarFulfillmentPorToken(publicToken);
  if (!fulfillment) return c.json({ error: "Link inválido ou expirado" }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const formulario = await buscarOuCriarFormulario(fulfillment.id, fulfillment.organizacaoId);

  const [atualizado] = await db
    .update(fulfillmentFormularios)
    .set({
      respostas: parsed.data.respostas,
      status: "SUBMITTED",
      submetidoEm: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(fulfillmentFormularios.id, formulario.id))
    .returning();

  return c.json({
    formulario: {
      status: atualizado.status,
      respostas: atualizado.respostas,
      submetidoEm: atualizado.submetidoEm,
    },
  });
});

export const fulfillmentFormularioPublicoRoutes = app;
