# CRM 2.0 — Handoff (leia isto antes de tocar em qualquer coisa)

> Estado consolidado em **01/09/2026**, branch `dev`.
> Este arquivo existe pra que alguém (humano ou agente) consiga tocar o projeto
> sem acesso ao vault interno. Contém só o que está **vigente** — histórico
> antigo não entra aqui.
> Complementa o `CLAUDE.md` (convenções/git/ambiente) e o `README.md` (setup).

---

## 1. Onde o projeto está

O CRM 2.0 é uma **reconstrução em cima do mesmo repo e do mesmo deploy** do CRM
legado, não um projeto separado. As duas UIs convivem:

- rotas do grupo `(crm2)` = CRM 2.0 (novo)
- rotas do grupo `(crm)` e sufixo `-legado` = CRM antigo, ainda no ar

A sidebar (`app/src/components/crm2/Sidebar.tsx`) tem a flag `legado: true` por
item de menu. **Fechar um módulo = virar essa flag.** Não existe big bang de
deploy: dá pra promover módulo por módulo.

### Ordem de trabalho acordada
Fechar módulo por módulo na ordem da jornada do cliente:

**Aquisição → Vendas → Pós-venda/Implantação → CS/Retenção → Plataforma**

Ritual por módulo: apresentar como está desenhado e onde o dado erra → validação
do Kauã → refatorar front + back → virar a flag do menu.

Prioridade declarada: **funcional primeiro, visual depois.** O projeto está
atrasado; o fluxo precisa fechar antes do polimento.

---

## 2. DEFINIÇÃO DE PRONTO (não negociável)

Antes de dizer que algo está pronto, as 4 dimensões — e **dizer explicitamente o
que não foi verificado**:

1. **Compila** — `npx tsc --noEmit`, `npm run build`. Necessário, nunca suficiente.
2. **O dado bate** — soma das linhas confere com o KPI do topo, conferido contra
   SQL real no banco.
3. **O fluxo fecha** — criar / editar / salvar / voltar. Não só leitura.
4. **Segue o design system** — sem raio, cor ou fonte fora da escala.

Playwright está **cortado por custo de token**. Sem ele o item 3 raramente é
demonstrável: nesse caso dizer *"não validei em tela, precisa abrir"* em vez de
reportar concluído. Reportar "feito" só porque compilou é o erro mais cobrado
neste projeto.

---

## 3. Design system — está PRONTO, é a base

- Rota **`/design`** (menu: Ajustes › UI System) — catálogo vivo, tokens e
  componentes reais renderizados.
- Fundação: `app/src/app/cf2-design-system.css` (escalas, motion, utilitários).
  Cores por tema: `app/src/app/globals.css`.
- Componentes de produto: `app/src/components/crm2/ds/` — Avatar, Status,
  Tabela, Navegacao (segmented + timeline), Graficos, Blocos.
- Base shadcn/ui em `app/src/components/ui/` (Radix + Tailwind 4).
- **Regra**: a tela escreve PAPEL, nunca número — `rounded-card`, `text-corpo`,
  `bg-positivo-suave`. Nada de `rounded-[7px]` ou hex solto.
- Marca: paleta **seaweed**, verde vivo (500) com tinta escura por cima.

```bash
npm run ds:contraste   # WCAG — 21/21 passando
npm run ds:check       # violações de token (grande dívida herdada, zera módulo a módulo)
npm run ds:all
```

Não instalar Once UI / HeroUI / Flowbite como dependência — cada um traz sistema
de tema próprio e conflita. Usar como referência visual e construir com shadcn +
nossos tokens.

---

## 4. ARMADILHAS conhecidas (cada uma já custou horas)

| Armadilha | Detalhe |
|---|---|
| `npx shadcn add` sobrescreve | Ele reescreve `src/components/ui/button.tsx` (dependência de vários). Sempre conferir `git diff` depois de qualquer `add`. |
| `var()` vazio invalida a declaração inteira | Não cai no fallback da lista. Foi o que fez portais renderizarem em serif. |
| Portais vivem fora da árvore do layout | Dropdown/modal/tooltip herdam do `<body>`. Todo token que eles usam precisa existir no `<html>`. |
| `postgres.js` não aceita `Date` em SQL cru | Usar `.toISOString()` dentro de `db.execute(sql\`...\`)`. |
| Backtick dentro de `` sql`...` `` termina o template JS | O erro aparece centenas de linhas depois do ponto real. |
| `tsx watch` não faz hot-reload confiável de processo em background | Depois de editar qualquer arquivo do `api-server`: `pkill -f "src/api-server/index.ts"` e subir de novo. Já causou muito "o fix não pegou". |
| Backfills somem no refresh do banco de dev | `crm2_pre_vendas_stage` e `fulfillments` são apagados a cada `scripts/refresh-dev-db.sh`. Re-rodar `scripts/migrate-pre-vendas-crm2.ts` e os scripts em `src/scripts/backfill-*`. |
| Receita de negócio ganho | Recorrente/híbrido usa `mrr_fechado`; avulso usa `valor_total`. Somar `valor_total` cru **infla** o realizado (já causou bug real de 231%). |
| Client Component não pode importar arquivo que importa `db` | Quebra o build de forma pouco óbvia. Validar antes de buildar. |

### Invariantes de domínio (violar = número errado no relatório)
- **Status de billing ≠ lifecycle do cliente.** São duas coisas diferentes; já
  houve coluna rotulada "Lifecycle" mostrando status de cobrança.
- **Setup, hardware e uso não são MRR.** Só recorrência entra no MRR.
- **Nunca fabricar métrica sem fonte de dado real.** Se não existe campo pra
  "prioridade" ou "health score", a tela não inventa um — deixa de fora e
  documenta o porquê.

---

## 5. Produção — cuidado

- URL: `https://crm.callface.io` · EC2 `34.204.200.52` · `/opt/callface/crm/`
- Stack: `callface-crm-{app,api,worker,postgres,redis}` + `callface-crm-wuzapi`
  (WhatsApp). Traefik roteia por path.
- **Nem prod nem homolog têm `.git` no servidor.** Deploy é rsync/scp do `app/`
  + `docker compose build <serviço>` + `docker compose up -d --no-deps --no-build <serviço>`.
  O git é fonte de verdade versionada, não mecanismo de deploy.
- **Nunca `rm -rf src` antes de extrair** um pacote de deploy: existem arquivos
  root-owned de build antigo que fazem o `rm` falhar no meio e deixam `src`
  parcial.
- Para patch cirúrgico em prod: **puxar o arquivo do servidor, editar, subir de
  volta** — nunca sincronizar a árvore inteira a partir de uma branch local sem
  antes provar com `git merge-base --is-ancestor` que ela é ancestral do que
  está rodando. Já houve quase-incidente por deploy de branch divergente.
- Sempre fazer backup do arquivo no servidor antes (`arquivo.ts.bak-AAAAMMDD`).

### Branches oficiais (só estas 3, para sempre)
- `main` — espelho de produção
- `homolog` — ambiente de validação (`/opt/callface/crm-homolog/`)
- `dev` — CRM 2.0 em reconstrução ← **é aqui que o trabalho acontece**

Nada de branch/worktree nova pra tarefa pontual. Se precisar isolar algo, cria,
mergeia de volta e **apaga na mesma sessão**.

---

## 6. PENDÊNCIAS ABERTAS (precisam de decisão do Kauã, não de código)

Estas não são bugs — são escolhas de negócio que uma decisão errada faz mexer em
dinheiro, dado histórico ou operação. Não decidir sozinho.

1. **Política de evidência de "Won" pro PBX.** A arquitetura de
   `won_evidence_policies` existe e funciona. Falta decidir se uma aprovação
   de admin basta ou se precisa de dupla aprovação, e inserir **uma linha** na
   tabela pro produto `pabx`. Hoje o catch-all só aceita
   `signed_contract`/`stripe_subscription`/`stripe_payment`.
2. **33 contratos "duplicata provável".** Classificados automaticamente (mesmo
   valor ±5%, mesmo dia). MRR em excesso confirmado: **R$ 17.449,30/mês**.
   Nenhuma correção foi aplicada — é um sinal, não uma ordem de merge. Ver
   `/admin/duplicidade-contratos` ou `npm run db:relatorio-duplicidade-contratos`.
3. **54 leads sem responsável** (`origem='outbound'`, prospecção Apollo White
   Label de 05/08). Regra histórica 100% consistente: os outros 24 outbound são
   todos da Jenifer Matos. Atribuir os 54 a ela dobra a carga dela (24→78) — é
   decisão sobre pessoa real. Se confirmado, é um `UPDATE`.
4. **Dashboard ler do snapshot diário.** `metricas_diarias` está pronto e bate
   exato com o dashboard ao vivo, mas trocar introduz até 1h de defasagem.
   Falta dizer se a defasagem é aceitável no operacional.
5. **`GROQ_API_KEY` expirada.** Bloqueia validar uma conversa real do agente de
   IA ponta a ponta. Não tem decisão de negócio, é só renovar a credencial.
6. **Migrar as cadências reais pro Cadence Engine novo.** O motor genérico
   existe e foi testado, mas o AI SDR (`runAiSdrRetrySweep`) e os 13 toques de
   `sdr-inbound.ts` seguem na lógica antiga. É sequenciamento de risco, não
   bloqueio técnico — provavelmente esperar a Groq voltar.
7. **Ambiente de homolog próprio pro CRM 2.0.** Mesma EC2 com stack isolado vs.
   servidor novo. Não é urgente enquanto nada de CRM2 foi promovido.
8. **Ajuste de assentos/quantidade dentro do CRM (autoatendimento).** Depende de
   `subscription_items` no schema, que não existe. Construir em cima do modelo
   atual (1 linha por subscription) recria a mesma classe de bug do MRR
   duplicado. Substituto aceito hoje: link direto pro Stripe Dashboard no drawer
   do negócio.
9. **Redesign da Página da Pessoa/Lead foi reprovado sem detalhe.** Antes de
   redesenhar de novo no escuro, perguntar o que especificamente não funcionou.

---

## 7. DÍVIDAS TÉCNICAS / coisas que precisam de atenção

- **`app/src/components/crm2/clientes/FulfillmentDetail.tsx`** — a ramificação
  de onboarding (IA) foi isolada em `OnboardingLegacyView`, mas não foi
  deletada. Já não é lógica interleaved, só um `if (!isPabx) return <...>`.
  Decidir se some ou fica.
- **Dívida de tokens do design system** — `npm run ds:check` acusa milhares de
  violações herdadas do código antigo. A estratégia é zerar módulo a módulo
  junto com o refactor, não numa varredura só.
- **Relatório de fechamento comercial**: 4 empresas seguem **sem nenhuma
  evidência de pagamento** localizável (Web Machine, Leal Seguro e Saúde,
  Weligton P, Chatpro Tecnologia). Busca real no Stripe não retornou nada; duas
  delas **não têm e-mail cadastrado no CRM**, o que é um gap de qualidade de
  dado por si só. Aparecem como "Não disponível" na exportação, e isso está
  correto — não inventar link.
- **2 outliers legados do Zoho** no mesmo relatório (Chat Envio 2ª venda,
  Antonio Marcos Silva Trindade): têm `zoho_id`, mas `proposta_status =
  expirada` e `mrr = 0`. Provável resíduo de migração. Nunca foi decidido se
  deveriam sequer constar no relatório.
- **Atribuição de receita a campanha está em ~4%** — a UTM não persiste até o
  checkout Stripe. Fix conhecido: gravar a UTM no checkout.
- **Token do Meta é temporário** (~2h, Graph Explorer). O permanente (System
  User) depende de aprovação de outro admin da Callface.
- **`git stash` pendente** no worktree de `main`
  (`wip-local-antes-de-consolidar-main-20260820`, 10 arquivos). Nunca foi
  revisado — decidir aplicar ou descartar.

---

## 8. Comandos que importam

```bash
cd app

npm run dev                 # Next  :3000
npm run api                 # Hono  :3001
npm run worker              # BullMQ

npx tsc --noEmit            # typecheck
npm run build               # build de produção
npm run lint

npm run ds:all              # design system: contraste + tokens
npm run check:relatorios    # invariantes dos relatórios (dado, não compilação)
npm run db:relatorio-duplicidade-contratos
npm run db:relatorio-data-quality
```

Segredos ficam em `app/.env` (gitignored). **Nunca commitar.**

---

## 9. Banco de dados

Schema completo (DDL, 137 tabelas, sem dados) e inventário de tabelas com volume
em [`docs/db/`](./docs/db/). Migrations em `app/src/lib/db/migrations/`; a fonte
da verdade da aplicação é `app/src/lib/db/schema.ts` (Drizzle).

Dump com dados **não está no repo e não deve entrar** — o banco de dev espelha
produção (leads, empresas, conversas de WhatsApp, contratos de clientes reais).
Ver [`docs/db/README.md`](./docs/db/README.md).
