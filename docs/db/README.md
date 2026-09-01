# Banco de dados

## O que tem aqui

| Arquivo | O que é |
|---|---|
| [`schema.sql`](./schema.sql) | DDL completo do banco de dev — 137 tabelas, tipos, índices, constraints e sequences. **Sem nenhuma linha de dado.** |
| [`INVENTARIO.md`](./INVENTARIO.md) | Lista de todas as tabelas com contagem aproximada de linhas, pra dar noção de volume e de o que está de fato em uso. |

As migrations versionadas ficam em [`../../app/src/lib/db/migrations/`](../../app/src/lib/db/migrations/)
e o schema em TypeScript (Drizzle, fonte da verdade da aplicação) em
[`../../app/src/lib/db/schema.ts`](../../app/src/lib/db/schema.ts).

O `schema.sql` é um retrato materializado — útil pra subir um banco do zero ou
inspecionar sem rodar a aplicação. Quem manda é o Drizzle.

## Subir um banco do zero

```bash
createdb callface_crm
psql callface_crm -f docs/db/schema.sql

# ou, direto pelo Drizzle (recomendado, mantém o histórico coerente)
cd app && npm run db:push
```

## Regenerar este dump

```bash
DBURL=$(grep -E '^DATABASE_URL=' app/.env | cut -d= -f2- | tr -d '"')
pg_dump --schema-only --no-owner --no-privileges --no-comments "$DBURL" > docs/db/schema.sql
```

## Por que NÃO tem dump com dados aqui

O banco de dev é um espelho do de produção: **3.651 leads, 1.856 empresas,
30.918 mensagens de WhatsApp, 2.752 ligações, 654 contratos** — nomes, e-mails,
telefones, CNPJs e IDs de cliente do Stripe de clientes e prospects reais da
Callface.

Dado real não entra no Git: o histórico é permanente e não dá pra apagar depois
sem reescrever o repo inteiro. É a regra que já está no `.gitignore` da raiz
(`_backups/`, `*.dump`, `app/public/uploads/`).

Se você precisa dos dados pra trabalhar, peça o dump direto ao Kauã — ele sai
por fora do Git.
