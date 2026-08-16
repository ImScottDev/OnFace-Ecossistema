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
import { configuracoesRoutes } from "./routes/configuracoes.js";
import { adminRoutes } from "./routes/admin.js";
import { apolloRoutes } from "./routes/apollo.js";
import { carteiraRoutes } from "./routes/carteira.js";
import { usuariosRoutes } from "./routes/usuarios.js";
import { perfilRoutes } from "./routes/perfil.js";
import { agendaRoutes } from "./routes/agenda.js";
import { automacoesRoutes } from "./routes/automacoes.js";
import { uploadsRoutes } from "./routes/uploads.js";
import { customFieldsRoutes } from "./routes/custom-fields.js";
import { servicosCatalogoRoutes } from "./routes/servicos-catalogo.js";
import { enrichmentRoutes } from "./routes/enrichment.js";
import { npsRoutes } from "./routes/nps.js";
import { contatosRoutes } from "./routes/contatos.js";
import { contatosUnifiedRoutes } from "./routes/contatos-unified.js";
import sdrRoutes from "./routes/sdr.js";
import { aiSdrRoutes } from "./routes/ai-sdr.js";
import { metasRoutes } from "./routes/metas.js";
import { meRoutes } from "./routes/me.js";
import { authFlowRoutes } from "./routes/auth-flow.js";
import { atendimentoRoutes } from "./routes/atendimento.js";
import { calendarioRoutes } from "./routes/calendario.js";
import { carolRoutes } from "./routes/carol.js";
import { contatosCrm2Routes } from "./routes/contatos-crm2.js";

const app = new Hono();

// Global error handler
app.onError(errorHandler);

// Logger
app.use("*", logger());

// Global middleware
app.use("*", cors({
  origin: ["https://crm.scottstudio.com.br", "https://n8n.scottdev.com.br", "http://localhost:3000"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Mount all routes under /api
app.route("/api", healthRoutes);
app.route("/api", leadsRoutes);
app.route("/api", negociosRoutes);
app.route("/api", empresasRoutes);
app.route("/api", propostasRoutes);
app.route("/api", checkoutsRoutes);
app.route("/api", contratosRoutes);
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
app.route("/api", cadenciaRoutes);
app.route("/api/relatorios", relatoriosRoutes);
app.route("/api/configuracoes", configuracoesRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/apollo", apolloRoutes);
app.route("/api/carteira", carteiraRoutes);
app.route("/api/usuarios", usuariosRoutes);
app.route("/api/perfil", perfilRoutes);
app.route("/api/agenda", agendaRoutes);
app.route("/api/automacoes", automacoesRoutes);
app.route("/api", uploadsRoutes);
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
// Montado em /api/conta (NÃO /api/auth* — esse prefixo o Traefik manda pro next-auth).
app.route("/api/conta", authFlowRoutes);

export function startServer() {
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
