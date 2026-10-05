# ADR — Unicidade dos vínculos legados CRM2

Data: 2026-08-23  
Status: aplicado localmente

## Decisão

`pessoas.lead_id_legado`, `oportunidades.negocio_id_legado` e `clientes.lead_id_legado` são bridges de reconciliação e devem aceitar no máximo uma identidade CRM2 por registro legado. Valores nulos continuam permitidos para registros sem origem legada.

## Evidência e segurança

A auditoria read-only anterior confirmou que os valores não nulos atuais não têm duplicatas no banco local. A migration `0025_reconciliation_uniqueness.sql` substitui os índices comuns por índices únicos, sem alterar registros.

## Limite

Isso protege reprocessamentos futuros, mas não resolve sozinho dual-write fora de transação nem reconcilia duplicatas já existentes em outros campos. Esses problemas continuam sendo tratados por proveniência e idempotência de cada fluxo.
