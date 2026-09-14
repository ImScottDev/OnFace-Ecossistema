# Documenso self-hosted da Callface

Ambiente local isolado do banco do CRM.

1. Execute `bash infra/documenso/setup-local.sh`.
2. Suba com `docker compose --env-file infra/documenso/.env -f infra/documenso/compose.yml up -d`.
3. Abra `http://localhost:3500`, crie a primeira conta e uma equipe.
4. Na equipe, crie um token de API e um webhook apontando para `/api/webhooks/documenso`.
5. Eventos do webhook: `DOCUMENT_OPENED`, `DOCUMENT_SIGNED`, `DOCUMENT_RECIPIENT_COMPLETED`, `DOCUMENT_COMPLETED`, `DOCUMENT_REJECTED`, `DOCUMENT_CANCELLED` e `RECIPIENT_EXPIRED`.
6. Configure no CRM:
   - `DOCUMENSO_API_URL=http://localhost:3500/api/v2`
   - `DOCUMENSO_API_TOKEN=<token da equipe>`
   - `DOCUMENSO_WEBHOOK_SECRET=<mesmo secret do webhook>`

Em produção, troque `DOCUMENSO_PUBLIC_URL` pelo domínio HTTPS da instância, configure SMTP real, mantenha o certificado fora do container e desative novos cadastros depois da criação das contas administrativas.
