# Retomada (leia isto primeiro)

L1 e L2 prontos e commitados (catálogo com recorte único + explorador de métrica oficial). Próximo: L3 (diagnóstico Zoho -> empresa -> serviço -> pagador -> fatura, De/Para) e L3b/L3c (Stripe x planilhas, Callface AI). Comandos de prova: `npx tsx --env-file=.env src/scripts/provar-relatorios-metricas.ts` e `node --import tsx --env-file-if-exists=.env --test src/lib/metricas/*.test.ts`. Dev: se o Next der 500 de módulo ou hidratação, reinicie `npm run dev`; Hono (`src/api-server/index.ts`) não recarrega: reiniciar após mexer em rota.
Ler: PLANO.md (checklist), ESTADO.md, EVIDENCIAS.md. Conferir `git log --oneline -5` e `git status`.
Não tocar: WhatsApp/Atendimento/NEXO (outro agente). Sem deploy. Commits sem Co-Authored-By (AGENTS.md do repo).

Diretrizes novas (PLANO.md): visual premium em cada lote; prioridade = veracidade; integrar Stripe/planilhas/Callface AI (verificar acesso `CALLFACE_AI_DATABASE_URL`, não assumir).
