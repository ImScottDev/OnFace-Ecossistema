# Estado

Atualizado: 2026-10-12, início do L1.

## Ambiente
- Repo `~/Documents/Scott Studio/onface-ux-rebuild`, main, base `0e5393d` (local, sem push/deploy). Banco local `callface_crm`; dev local Next :3000, Hono :3012.
- Outro agente trabalha em WhatsApp/Atendimento/NEXO: não tocar `lib/whatsapp`, `lib/atendimento`, `lib/nexo`, Ajustes > WhatsApp.

## Verificado no código atual (12/10)
- MRR: agregado em `lib/metricas/catalogo.ts` soma última competência MRR (476.414,49 local) + assinaturas ativas sem competência (1.599,30 local); o drill só lia a competência. Causa da divergência confirmada.
- `oportunidades.service_family` é nulo em 1619 linhas (só 16 preenchidas): família não serve de filtro em booking hoje.
- Teste: não há flag. Marcadores explícitos: empresa.nome com prefixo `[QA`/`[DOCUMENSO-E2E]`, leads.origem `qa`/`teste_local`. Nomes tipo "teste"/"GARRAFAS TESTE" são suspeitos, não excluídos.

## Pendente
Tudo em PLANO.md. Próximo passo concreto: L1 (ver RETOMADA.md).

## Perguntas ao Kauã/Scott
(nenhuma aberta)
