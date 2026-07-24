# Callface CRM — app/

Documentação completa (arquitetura, fluxos, integrações, setup, deploy) está no [README da raiz do repositório](../README.md).

Setup rápido de dev:

```bash
docker compose -f ../docker-compose.dev.yml up -d
npx drizzle-kit push
npm run db:seed
npm run db:seed-servicos
npm run dev -- -p 3010
```
