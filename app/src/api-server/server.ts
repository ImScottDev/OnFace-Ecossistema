import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { errorHandler } from "./compat.js";

// Route modules
import { healthRoutes } from "./routes/health.js";
import { leadsRoutes } from "./routes/leads.js";
import { negociosRoutes } from "./routes/negocios.js";
import { empresasRoutes } from "./routes/empresas.js";
import { propostasRoutes } from "./routes/propostas.js";
import { checkoutsRoutes } from "./routes/checkouts.js";
import { contratosRoutes } from "./routes/contratos.js";
import { fulfillmentsRoutes } from "./routes/fulfillments.js";
import { fulfillmentFormularioPublicoRoutes } from "./routes/fulfillment-formulario-publico.js";
import { anexosRoutes } from "./routes/anexos.js";
import { anexosLegadoRoutes } from "./routes/anexos-legado.js";
import { tarefasRoutes } from "./routes/tarefas.js";
import { notificacoesRoutes } from "./routes/notificacoes.js";
import { pipelinesRoutes } from "./routes/pipelines.js";
import { labelsRoutes } from "./routes/labels.js";
import { notasRoutes } from "./routes/notas.js";
import { ligacoesRoutes } from "./routes/ligacoes.js";
import { reunioesRoutes } from "./routes/reunioes.js";
import { whatsappRoutes } from "./routes/whatsapp.js";
import { emailRoutes } from "./routes/email.js";
import { cadenciaRoutes } from "./routes/cadencia.js";
import { relatoriosRoutes } from "./routes/relatorios.js";
import { relatoriosMetricasRoutes } from "./routes/relatorios-metricas.js";
import { configuracoesRoutes } from "./routes/configuracoes.js";
import { adminRoutes } from "./routes/admin.js";
import { apolloRoutes } from "./routes/apollo.js";
import { carteiraRoutes } from "./routes/carteira.js";
import { usuariosRoutes } from "./routes/usuarios.js";
import { distribuicaoLeadsRoutes } from "./routes/distribuicao-leads.js";
import { captacaoRoutes } from "./routes/captacao.js";
import { perfilRoutes } from "./routes/perfil.js";
import { agendaRoutes } from "./routes/agenda.js";
import { automacoesRoutes } from "./routes/automacoes.js";
import { uploadsRoutes } from "./routes/uploads.js";
import { apiTokensRoutes } from "./routes/api-tokens.js";
import { v1Routes } from "./v1/index.js";
import { customFieldsRoutes } from "./routes/custom-fields.js";
import { servicosCatalogoRoutes } from "./routes/servicos-catalogo.js";
import { enrichmentRoutes } from "./routes/enrichment.js";
import { npsRoutes } from "./routes/nps.js";
import { contatosRoutes } from "./routes/contatos.js";
import { contatosUnifiedRoutes } from "./routes/contatos-unified.js";
import { prospeccaoRoutes } from "./routes/prospeccao.js";
import sdrRoutes from "./routes/sdr.js";
import { aiSdrRoutes } from "./routes/ai-sdr.js";
import { metasRoutes } from "./routes/metas.js";
import { meRoutes } from "./routes/me.js";
import { nexoRoutes } from "./routes/nexo.js";
import { authFlowRoutes } from "./routes/auth-flow.js";
import { atendimentoRoutes } from "./routes/atendimento.js";
import { calendarioRoutes } from "./routes/calendario.js";
import { carolRoutes } from "./routes/carol.js";
import { contatosCrm2Routes } from "./routes/contatos-crm2.js";
import { buscaGlobalRoutes } from "./routes/busca-global.js";
import { clientesCrm2Routes } from "./routes/clientes-crm2.js";
import { csRoutes } from "./routes/cs.js";
import { clientesFinanceiroRoutes } from "./routes/clientes-financeiro.js";
import { clientesAssinaturaRoutes } from "./routes/clientes-assinatura.js";
import { scriptsAtendimentoRoutes } from "./routes/scripts-atendimento.js";
import { documentosAtendimentoRoutes } from "./routes/documentos-atendimento.js";
import { automacoesCadenciasRoutes } from "./routes/automacoes-cadencias.js";
import automacoesFluxosRoutes from "./routes/automacoes-fluxos.js";
import { automacoesExecucoesRoutes } from "./routes/automacoes-execucoes.js";
import { automacoesAgentesRoutes } from "./routes/automacoes-agentes.js";
import { automacoesAgentesOperacaoRoutes } from "./routes/automacoes-agentes-operacao.js";
import { automacoesTagsRoutes } from "./routes/automacoes-tags.js";
import { aiPlatformRoutes } from "./routes/ai-platform.js";
import { contratoTemplatesRoutes } from "./routes/contrato-templates.js";
import { pipelineCrm2Routes } from "./routes/pipeline-crm2.js";
import { appUrl } from "@/lib/app-url";

const app = new Hono();

// Global error handler
app.onError(errorHandler);

// Logger
app.use("*", logger());

// Global middleware
app.use("*", cors({
  // O front chama a API pela mesma origem (Traefik em produção, rewrite do
  // next.config em dev local). n8n e webhooks chamam servidor a servidor, sem CORS.
  origin: [appUrl(), "http://localhost:3000"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Mount all routes under /api
// Superfície pública versionada (SPEC §23, §30.2). Autenticação por token, não
// por cookie: cookie não tem escopo, não se revoga sozinho e não diz quem
// consumiu o quê.
app.route("/api", v1Routes);

app.route("/api", healthRoutes);
app.route("/api", leadsRoutes);
app.route("/api", negociosRoutes);
app.route("/api", empresasRoutes);
app.route("/api", propostasRoutes);
app.route("/api", checkoutsRoutes);
app.route("/api", contratosRoutes);
app.route("/api", fulfillmentsRoutes);
app.route("/api", fulfillmentFormularioPublicoRoutes);
app.route("/api", anexosRoutes);
app.route("/api", anexosLegadoRoutes);
app.route("/api", tarefasRoutes);
app.route("/api", notificacoesRoutes);
app.route("/api", pipelinesRoutes);
app.route("/api", labelsRoutes);
app.route("/api", notasRoutes);
app.route("/api", ligacoesRoutes);
app.route("/api", reunioesRoutes);
app.route("/api", whatsappRoutes);
app.route("/api", emailRoutes);
app.route("/api", atendimentoRoutes);
app.route("/api", calendarioRoutes);
app.route("/api", carolRoutes);
app.route("/api", contatosCrm2Routes);
app.route("/api", buscaGlobalRoutes);
app.route("/api", pipelineCrm2Routes);
app.route("/api", prospeccaoRoutes);
app.route("/api", cadenciaRoutes);
app.route("/api", clientesCrm2Routes);
app.route("/api", csRoutes);
app.route("/api", clientesFinanceiroRoutes);
app.route("/api", clientesAssinaturaRoutes);
app.route("/api", scriptsAtendimentoRoutes);
app.route("/api", documentosAtendimentoRoutes);
// Antes de /api/automacoes: aquele tem "/:id" e engoliria /automacoes/fluxos.
app.route("/api", automacoesFluxosRoutes);
app.route("/api", automacoesCadenciasRoutes);
app.route("/api", automacoesExecucoesRoutes);
app.route("/api", automacoesAgentesOperacaoRoutes);
app.route("/api", automacoesAgentesRoutes);
app.route("/api", automacoesTagsRoutes);
app.route("/api", aiPlatformRoutes);
app.route("/api", contratoTemplatesRoutes);
app.route("/api/relatorios/metricas", relatoriosMetricasRoutes);
app.route("/api/relatorios", relatoriosRoutes);
app.route("/api/configuracoes", configuracoesRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/apollo", apolloRoutes);
app.route("/api/carteira", carteiraRoutes);
app.route("/api/usuarios", usuariosRoutes);
app.route("/api/distribuicao-leads", distribuicaoLeadsRoutes);
app.route("/api/captacao", captacaoRoutes);
app.route("/api/perfil", perfilRoutes);
app.route("/api/agenda", agendaRoutes);
app.route("/api/automacoes", automacoesRoutes);
app.route("/api", uploadsRoutes);
app.route("/api", apiTokensRoutes);
app.route("/api", customFieldsRoutes);
app.route("/api", servicosCatalogoRoutes);
app.route("/api/enrichment", enrichmentRoutes);
app.route("/api/nps", npsRoutes);
app.route("/api", contatosRoutes);
app.route("/api", contatosUnifiedRoutes);
app.route("/api/sdr", sdrRoutes);
app.route("/api/ai-sdr", aiSdrRoutes);
app.route("/api/metas", metasRoutes);
app.route("/api/me", meRoutes);
app.route("/api", nexoRoutes);
// Montado em /api/conta (NÃO /api/auth* — esse prefixo o Traefik manda pro next-auth).
app.route("/api/conta", authFlowRoutes);

/** Exportado pro teste de aceite montar requisições sem subir porta (app.request). */
export { app };

export function startServer() {
  // Modelos oficiais de contrato: só cria o que falta (ver lib/crm/modelos-contrato.ts).
  import("@/lib/crm/modelos-contrato")
    .then((m) => m.carregarModelosOficiais({ atualizar: false, log: (l) => console.log(`[API] ${l}`) }))
    .catch((e) => console.error("[API] Falha ao garantir modelos de contrato:", e));

  // 3001 é a porta real do container da API em todos os composes (API_PORT=3001).
  // O default era 3002, que hoje é do healthcheck do worker — subir a API sem
  // API_PORT colidia com ele em ambiente local.
  const port = parseInt(process.env.API_PORT || "3001");
  const server = serve({ fetch: app.fetch, port }, () => {
    console.log(`[API] Process ${process.pid} listening on port ${port}`);
  });

  // Graceful shutdown — drain existing connections before exit
  const shutdown = () => {
    console.log("[API] Shutting down gracefully...");
    server.close(() => {
      console.log("[API] Server closed");
      process.exit(0);
    });
    // Force exit after 10s if connections won't drain
    setTimeout(() => {
      console.error("[API] Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
