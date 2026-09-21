// Formulário de implantação PABX — página pública (sem login, 18/08).
// Etapa 1 do checklist de Fulfillment ("levantamento de informações")
// depende do cliente preencher contatos/ramais/linhas/canais/URAs/filas/
// regras de atendimento/telefones IP — hoje sem nenhuma superfície. Este
// arquivo é a rota pública (sem getCtx/sessão), no mesmo espírito de
// GET /propostas/:id/publica: valida só pelo token opaco (publicToken) da
// URL, nunca por ID sequencial.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { fulfillments, fulfillmentFormularios, fulfillmentItens, fulfillmentLinhasPortabilidade, fulfillmentRamais } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { notificarFormularioImplantacaoRecebido } from "@/lib/crm/notificar";
import { guardarNoAcervo } from "@/lib/arquivos/servico";

const app = new Hono();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
// de segurança do restante deste arquivo. O binário vai pro acervo canônico
// (SPEC §32) como o de qualquer outra rota: o fato de quem envia não ter conta
// no CRM muda a AUTORIZAÇÃO, não o lugar onde o arquivo mora.
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

  const guardado = await guardarNoAcervo({
    organizacaoId: fulfillment.organizacaoId,
    nomeOriginal: file.name,
    mimeType: file.type,
    conteudo: new Uint8Array(await file.arrayBuffer()),
    // O vínculo não é decoração: é ele que autoriza a leitura pública depois.
    vinculos: [{ tipo: "fulfillment", id: fulfillment.id, papel: "formulario_implantacao" }],
    metadata: { origem: "formulario_publico" },
  });
  if (!guardado.ok) return c.json({ error: guardado.erro }, 400);

  return c.json({
    url: `/api/arquivos/publico/${fulfillment.id}/${guardado.arquivo.id}`,
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
    // White Label: identidade, domínio e faturamento. O jsonb continua como
    // fonte de verdade, permitindo evoluir a coleta sem migration a cada campo.
    whiteLabel: z.record(z.string(), z.any()).optional(),
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

// Materialização relacional (20/08, pedido Kauã: "não deixar só no jsonb
// invisível") — projeta linhas de portabilidade e ramais do jsonb bruto
// (fonte de verdade/backup, continua sendo gravado igual) pras duas tabelas
// novas. Idempotente por reconstrução: apaga tudo daquele fulfillment e
// reinsere do payload atual — nunca acumula linha órfã de um envio
// anterior. Mesmo filtro de "linha em branco" que o frontend já aplica
// antes de mandar (defensivo: reaplicado aqui pro caso de payload vir de
// outro client no futuro).
async function materializarLinhasERamais(fulfillmentId: string, organizacaoId: string, respostas: Record<string, unknown>): Promise<void> {
  const portabilidade = (respostas.portabilidade ?? {}) as Record<string, unknown>;
  const linhasRaw = Array.isArray(portabilidade.linhas) ? (portabilidade.linhas as Record<string, unknown>[]) : [];
  const titular = portabilidade.razaoSocialTitular ? String(portabilidade.razaoSocialTitular) : null;
  const operadoraAtual = portabilidade.operadoraAtual ? String(portabilidade.operadoraAtual) : null;
  const linhasValidas = linhasRaw.filter((l) => l.ddd || l.numero || l.anexoUrl);

  const ramaisRaw = Array.isArray(respostas.ramais) ? (respostas.ramais as Record<string, unknown>[]) : [];
  const ramaisValidos = ramaisRaw.filter((r) => r.ramal || r.nome || r.departamento);

  await db.delete(fulfillmentLinhasPortabilidade).where(eq(fulfillmentLinhasPortabilidade.fulfillmentId, fulfillmentId));
  await db.delete(fulfillmentRamais).where(eq(fulfillmentRamais.fulfillmentId, fulfillmentId));

  if (linhasValidas.length > 0) {
    await db.insert(fulfillmentLinhasPortabilidade).values(
      linhasValidas.map((l) => ({
        organizacaoId,
        fulfillmentId,
        ddd: l.ddd ? String(l.ddd) : null,
        numero: l.novaLinha ? null : l.numero ? String(l.numero) : null,
        tipo: l.novaLinha ? "nova_linha" : "portabilidade",
        operadoraAtual,
        titular,
        anexoUrl: l.anexoUrl ? String(l.anexoUrl) : null,
        // Sem entidade "anexo" própria pra este upload (fs local direto,
        // ver rota de upload abaixo) — guarda o nome original do arquivo
        // como referência textual, não um ID de outra tabela.
        anexoId: l.anexoNome ? String(l.anexoNome) : null,
      }))
    );
  }

  if (ramaisValidos.length > 0) {
    await db.insert(fulfillmentRamais).values(
      ramaisValidos.map((r) => ({
        organizacaoId,
        fulfillmentId,
        departamento: r.departamento ? String(r.departamento) : null,
        numeroExterno: r.numeroExterno ? String(r.numeroExterno) : null,
        ramal: r.ramal ? String(r.ramal) : null,
        usuario: r.nome ? String(r.nome) : null,
        email: r.email ? String(r.email) : null,
        celular: r.celular ? String(r.celular) : null,
        modeloAparelho: r.modeloAparelho ? String(r.modeloAparelho) : null,
        usaAparelhoFisico: !!r.utilizaAparelhoMesa,
        gravacao: !!r.gravarLigacao,
        ligacoesInternacionais: !!r.ligacoesInternacionais,
        paisesPermitidos: r.paises
          ? String(r.paises).split(",").map((s) => s.trim()).filter(Boolean)
          : null,
      }))
    );
  }
}

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

  // White Label não é concluído pelo envio do formulário: ele apenas passa
  // para revisão interna (validação humana), no item que representa a
  // validação dos materiais — não conclui a implantação nem mexe nas demais
  // etapas do checklist.
  if (fulfillment.serviceFamily === "WHITE_LABEL") {
    await db.update(fulfillmentItens)
      .set({ status: "VALIDATION", updatedAt: new Date() })
      .where(and(
        eq(fulfillmentItens.fulfillmentId, fulfillment.id),
        eq(fulfillmentItens.titulo, "Receber e validar materiais e informações do cliente"),
      ));
  }

  // Materialização relacional — best-effort: uma falha aqui não pode
  // derrubar a submissão (o jsonb acima já é a fonte de verdade/backup e
  // já foi salvo com sucesso).
  try {
    await materializarLinhasERamais(fulfillment.id, fulfillment.organizacaoId, parsed.data.respostas);
  } catch (err) {
    console.error(`[fulfillment-formulario] falha ao materializar linhas/ramais do fulfillment ${fulfillment.id}:`, err);
  }

  // Notificação real ao responsável + atividade (fire-and-forget, nunca
  // derruba a submissão — ver lib/crm/notificar.ts).
  await notificarFormularioImplantacaoRecebido(fulfillment.id);

  return c.json({
    formulario: {
      status: atualizado.status,
      respostas: atualizado.respostas,
      submetidoEm: atualizado.submetidoEm,
    },
  });
});

export const fulfillmentFormularioPublicoRoutes = app;
