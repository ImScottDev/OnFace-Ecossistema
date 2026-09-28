# Documenso self-hosted da Callface

Servico de assinatura isolado do banco e do runtime do CRM. O CRM conversa com
o Documenso por API e recebe o resultado por webhook; o assinante acessa apenas
o dominio publico da instancia.

## Desenvolvimento local

1. Execute `bash infra/documenso/setup-local.sh`.
2. Suba com `docker compose --env-file infra/documenso/.env -f infra/documenso/compose.yml up -d`.
3. Abra `http://localhost:3500`, crie a primeira conta e uma organizacao.
4. Na organizacao, crie um token de API e um webhook apontando para `/api/webhooks/documenso` do CRM.
5. Configure no CRM:
   - `DOCUMENSO_API_URL=http://documenso:3000/api/v2` quando CRM e Documenso compartilham a rede Docker.
   - `DOCUMENSO_API_TOKEN=<token da organizacao>`.
   - `DOCUMENSO_WEBHOOK_SECRET=<secret exclusivo do webhook>`.

## Instancia publica

O ambiente DEV da Callface usa `https://sign.callface.io`. O arquivo
`traefik/sign-callface.yml` e a regra de proxy correspondente devem ser
instalados no host junto com o registro DNS. O Documenso continua publicado
somente em loopback; o Traefik e a unica entrada publica.

Antes de enviar qualquer contrato real:

1. Defina `DOCUMENSO_PUBLIC_URL=https://sign.callface.io` e recrie o servico.
2. Valide TLS, login administrativo, token de API e webhook.
3. Execute um contrato de teste com um destinatario controlado e confirme os
   eventos `DOCUMENT_OPENED`, `DOCUMENT_SIGNED`, `DOCUMENT_RECIPIENT_COMPLETED`,
   `DOCUMENT_COMPLETED`, `DOCUMENT_REJECTED`, `DOCUMENT_CANCELLED` e
   `RECIPIENT_EXPIRED`.
4. Configure SMTP de entrega real e desative novos cadastros apos as contas
   administrativas estarem criadas.

O certificado local gerado por `setup-local.sh` serve para selar e auditar os
PDFs do ambiente. Ele nao e um certificado ICP-Brasil ou uma declaracao de
assinatura qualificada; esse requisito exige um provedor e certificado
especificos antes de qualquer compromisso contratual que dependa desse nivel.
