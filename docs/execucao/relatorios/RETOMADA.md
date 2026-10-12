# Retomada (leia isto primeiro)

**Modo atual (12/10):** NÃO implementar mais frentes novas. O Scott vai apontar bugs parte por parte; eu anoto em `BUGS.md` sem corrigir. Quando ele disser "fecho", corrijo o primeiro lote, provo no navegador e commito. O trabalho de relatórios está funcionalmente de pé mas o Scott considera que ainda tem coisa errada: tratar tudo como suspeito e verificar na tela antes de afirmar.

Feitos e commitados: L1 catálogo com recorte único, L2 explorador, L3 diagnóstico Zoho, L4 faturamento histórico conciliado, painel Executivo (aba padrão da gestão). Ler `ESTADO.md` (o que existe, o que espera decisão) e `PLANO.md` (checklist).
Próximo passo concreto: L3b, conciliar Stripe (faturas/pagamentos/assinaturas, `servico_billing_timeline`) com `cliente_receita_mensal` por documento e competência, separando faturado x recebido x contratado; e criar o pouso rastreável das planilhas (tabelas aditivas com arquivo/linha/hash) para a atualização mensal ser reprocessável. Depois L5 (bridge MRR) e L6/L7.
Provas: `node --import tsx --env-file-if-exists=.env --test src/lib/metricas/*.test.ts` e `npx tsx --env-file=.env src/scripts/provar-relatorios-metricas.ts` (Next :3000 e Hono :3012 de pé; Hono precisa reiniciar após mexer em rota/catálogo; se o Next der 500 de módulo, reiniciar `npm run dev`).
Não tocar: WhatsApp/Atendimento/NEXO (outro agente). Sem deploy sem "pode subir". Commits sem Co-Authored-By (AGENTS.md do repo).
Diretrizes: visual premium em cada lote; veracidade antes de beleza; lacuna aparece como lacuna.
