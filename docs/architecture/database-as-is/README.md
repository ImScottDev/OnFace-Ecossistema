# Banco OnFace, estado AS-IS

Extração técnica fiel do banco PostgreSQL, feita em **20/09/2026** contra o banco local
carregado com os dados de produção do mesmo dia.

Este material é levantamento. **Não propõe arquitetura, não decide qual tabela deve
vencer, não recomenda consolidação.** A arquitetura-alvo é assunto de outro documento.

## Como este material foi produzido

Somente leitura. Nenhuma migration rodou, nenhum dado foi alterado, nada foi removido.
As fontes foram `pg_dump --schema-only`, consultas `SELECT` no catálogo do PostgreSQL,
e leitura estática do código em `app/src`.

O dump de estrutura saiu sem owners, sem grants, sem roles e sem dados. Verificado:
zero ocorrências de `OWNER TO`, `GRANT`, `CREATE ROLE`, `INSERT` e `COPY`, e nenhum
segredo em texto. As colunas com nome de token aparecem apenas como definição de
estrutura, sem valor.

## Arquivos

| Arquivo | O que responde |
|---|---|
| `00-schema-only.sql` | a estrutura completa: tabelas, tipos, PKs, FKs, uniques, checks, defaults, índices, views, triggers e funções |
| `01-inventario-tabelas.md` | toda tabela, com linhas, PK, FKs, quem a referencia e papel aparente, agrupada por domínio |
| `02-relacoes.md` | todas as foreign keys, tabelas mais referenciadas, raízes, ciclos, e os IDs guardados sem FK |
| `03-entidades-duplicadas.md` | conceitos que existem em mais de uma tabela, com evidência, sem decidir solução |
| `04-escritores.md` | todo INSERT/UPDATE/DELETE por entidade, com origem e se passa por regra |
| `05-modelo-v2-ja-existente.md` | o modelo novo já construído em paralelo ao legado, e o estado de cada peça |
| `06-diagrama-as-is.md` | ERDs em Mermaid por área, desenhados só a partir das FKs reais |
| `07-diferencas-schema-vs-banco.md` | drift entre `app/src/lib/db/schema.ts` e o banco |
| `_raw/` | os dados brutos extraídos do catálogo, para conferência e reprocessamento |

## Convenção de confiança

Onde não houve evidência para afirmar algo, está escrito **NÃO CONFIRMADO** em vez de
uma suposição. Números vêm do catálogo do banco ou de contagem exata, nunca de estimativa.

## Três avisos para quem for ler o código a partir daqui

**Os nomes das pastas mentem.** `app/src/app/(onface-preview)/` é o produto;
`app/src/app/(crm2)/` é onde a tela real mora; `app/src/app/onface-desenho/` é referência
congelada; `app/src/app/(crm)/` são redirects.

**Existem dois estilos de acesso a dados no mesmo projeto.** O módulo `src/lib/vendas`
escreve com SQL cru (`db.execute(sql\`...\`)`); o resto usa o query builder do Drizzle
(`db.insert(tabela)`). Uma busca que cubra só um dos dois encontra metade dos escritores.

**O banco tem 151 tabelas e o Drizzle declara 145.** As seis a mais existem no banco e
não no schema. Detalhe em `07-diferencas-schema-vs-banco.md`.
