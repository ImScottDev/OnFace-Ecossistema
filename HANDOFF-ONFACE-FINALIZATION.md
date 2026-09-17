# Handoff — Finalização ONFACE / Callface CRM2

> Documento de continuidade para Claude Code. Atualizado em 15/09/2026.
> Leia inteiro antes de alterar código. Ele complementa `HANDOFF.md`,
> `PRODUCT-FINALIZATION-TRACKER.md` e `docs/reconstruction/PRODUCTION-READINESS-TRACKER.md`.
> Em conflito visual, este documento e o tracker de finalização substituem a seção antiga de
> design system do `HANDOFF.md`; em conflito técnico/P0, o Production Readiness prevalece.

## 1. Objetivo e limite desta fase

O produto não está em uma rodada de "polish". A meta é concluir o CRM2 por
workspaces, mantendo dados reais, integrações e jornadas P0, mas substituindo UI/UX ruim quando
necessário.

Arquitetura visual definida:

```
shadcn/Radix primitives
  -> tokens ONFACE
  -> patterns ONFACE
  -> telas CRM2
```

Stack permanece **Next.js + React + Tailwind + shadcn/Radix + Hono**. Não iniciar migração para
NestJS ou outro framework. Não aplicar o preset shadcn `b6TqMNb5Wb` inteiro: ele conflita com a
linguagem ONFACE e pode sobrescrever componentes no worktree sujo.

## 2. Contexto crítico do repositório

- Repositório: `/Users/Scott/Documents/Scott Studio/callface-crm-dev`
- Aplicação Next: `app/`
- Branch: `dev`
- O worktree estava muito sujo antes desta fase (411 entradas). Há mudanças de outras frentes.
  **Não usar `git reset`, `git checkout --`, limpeza global, reformat em massa, stash global ou
  commit que capture alterações alheias.**
- Checkpoint pré-finalização: tag `product-finalization-baseline-20260915` no commit `a155b49`.
- `PRODUCT-FINALIZATION-TRACKER.md` é o tracker desta etapa. O tracker técnico anterior é
  `docs/reconstruction/PRODUCTION-READINESS-TRACKER.md`; ele continua sendo fonte de verdade para
  P0 e não deve ser contradito.
- Não fazer deploy nem mexer em produção sem autorização explícita do Kauã. O trabalho atual é
  local/DEV e o novo shell ainda **não foi promovido** às rotas oficiais.

## 3. Estado validado antes do redesign

Na reancoragem desta fase, DEV passou:

- `npx tsc --noEmit`
- `npm test` — 51/51
- `npm run check:env`
- `npm run db:migrar:check`
- `npm run check:relatorios`
- `npm run aceite:won-cs` — 31/31
- `npm run aceite:contrato` — 32/32

Pendência conhecida de certificação: `app/src/scripts/simular-fechamento-2c1.ts` ainda simula a
assinatura diretamente; deve passar a injetar o webhook `DOCUMENT_COMPLETED` do Documenso para
PABX e White Label. Não trate a bateria como integralmente verde antes disso.

## 4. Direção visual oficial

Autoridade visual: ONFACE Design System e Figma. Referência da topbar:

`https://www.figma.com/design/GGnhG8f2Cmui7qmfhxPkKC/Callface-CRM---Tela-Inicial-Edit%C3%A1vel?node-id=316-35076&m=dev`

Contratos:

- graphite/paper como base; coral `#FE4F2B` é ação/sinal escasso;
- Plus Jakarta Sans para títulos/display; Inter para a interface; Lucide para ícones;
- topbar graphite de 64px; marca à esquerda, macro navegação central, ações à direita;
- menus, dialogs, popovers, sheets e a busca fazem parte do mesmo sistema dark do chrome;
- desktop largo organiza regiões, não estica controles;
- tablet reduz navegação; celular usa sheet, touch targets de ao menos 44px;
- sem shadcn "default", sidebar concorrente, cards decorativos, gradientes gratuitos ou dados mock.

O ZIP `ONFACE Design System.zip` foi inspecionado previamente. Não copiar JSX de referência;
usar seus princípios/tokens e os assets oficiais.

## 5. O que foi implementado até agora

### Fundação incremental (isolada)

Foi criada uma fundação ONFACE escopada em `data-onface-theme`, para não contaminar ou quebrar as
rotas CRM2 existentes durante a transição:

- `app/src/app/onface.css` — primitives, semânticos e contratos do shell;
- `app/src/components/onface/OnfaceThemeRoot.tsx` — aplica o escopo do tema;
- `app/src/app/layout.tsx` — registra Plus Jakarta uma vez;
- `app/public/onface/figma-*.svg` — assets exportados do Figma.

Ela ainda não é a consolidação final dos tokens do projeto. Não criar uma biblioteca paralela;
ao evoluir, extraia tokens/patterns consistentes e reutilize shadcn/Radix primeiro.

### Preview autenticado da topbar

Rota local de validação:

`http://localhost:3000/onface-preview`

Ela está fora do layout oficial do CRM2 e não duplica API, dados nem páginas. Os links levam às
rotas reais existentes. A intenção é aprovar a navegação antes de mover a rota/layout oficial.

Arquivos envolvidos:

| Arquivo | Papel |
|---|---|
| `app/src/app/(onface-preview)/layout.tsx` | preview autenticado; usa `Providers variant="onface"`, tema e topbar |
| `app/src/app/(onface-preview)/onface-preview/page.tsx` | canvas apenas para validação visual |
| `app/src/components/onface/OnfaceTopbar.tsx` | topbar desktop, sheet mobile, menus de perfil/ajustes |
| `app/src/components/onface/navigation.ts` | fonte canônica das macroáreas e rotas reais |
| `app/src/app/onface.css` | tokens e estilos do preview/topbar/sheet/menu |
| `app/src/components/crm/Providers.tsx` | adicionada variante `onface`, sem duplicar providers |
| `app/src/components/crm2/CommandPalette.tsx` | variante visual `onface`; usa a mesma busca/endpoints |
| `app/src/components/crm2/NotificationBell.tsx` | variante `onface` para o sino e painel dark |

### Comportamento implementado no preview

- Seis macroáreas do Figma: Visão Geral, Operação, Clientes, Financeiro, Automações e Insights.
- Itens de navegação usam larguras controladas na superfície central; isso corrigiu a sensação de
  borda/"fundo" desconectado dos botões.
- Operação, Clientes, Financeiro e Automações usam menus Radix/shadcn ancorados e graphite.
- Perfil usa dropdown real com perfil, preferências, notificações e logout real via `signOut`.
- Ajustes usa dropdown graphite e submenu nativo para administração.
- Busca despacha `open-command-palette`; `Providers variant="onface"` monta **uma única**
  Command Palette com os endpoints reais já existentes. Houve um bug temporário de duas paletas
  porque ela também foi montada no layout do preview; isso já foi corrigido. Não reintroduzir uma
  segunda instância.
- O sino continua usando dados e mutations reais de notificações; recebeu variante dark ONFACE.
- Em <1280px a macro navegação dá lugar ao botão de menu; em mobile o Sheet dark mantém busca e
  avatar e os itens têm alvo mínimo de 44px.

## 6. Avaliação honesta do estado atual

O preview é uma fundação de trabalho, **não uma tela final aprovada**. O usuário considerou a
primeira composição feia e lenta. A correção posterior alinhou a estrutura e os controles, mas
Claude Code deve fazer a crítica visual antes de promover qualquer coisa:

1. Abrir `/onface-preview` em 390, 768, 1280, 1440/1512 e 1920px.
2. Comparar especialmente a topbar ao node Figma `316:35076`; não trocar a linguagem por uma
   interpretação genérica.
3. Conferir clipping, alinhamento óptico da marca, largura e centralização da navegação, foco,
   overflow do Sheet, menus, submenus, busca e avatar.
4. Validar menus com teclado, Escape, tab/foco, navegação de busca e rotas reais.
5. Se a topbar ainda não estiver aprovada visualmente, corrigir **somente o preview**. Não promover
   para as rotas CRM2 por cima da sidebar atual.

## 7. Forma correta de continuar

### Primeiro: recuperar contexto e validar o preview

1. Ler `HANDOFF.md`, este arquivo, `PRODUCT-FINALIZATION-TRACKER.md` e
   `docs/reconstruction/PRODUCTION-READINESS-TRACKER.md`.
2. Rodar `git status --short` e isolar mentalmente somente os arquivos ONFACE acima.
3. Garantir o ambiente local:

```bash
cd /Users/Scott/Documents/Scott\ Studio/callface-crm-dev/app
npm run dev
# Caso a API/worker sejam necessários para o fluxo testado:
npm run api
npm run worker
```

4. Auditar visualmente o preview e pedir aprovação do usuário antes de adotar a topbar em produção
   local (layout CRM2 oficial).

### Depois: tela por tela

Ordem acordada:

1. Fundação/AppShell aprovada;
2. `/inicio`;
3. Vendas (`/pre-vendas`, `/prospeccao`, `/pipeline`, `/propostas`, `/negocios`);
4. Atendimento e calendário;
5. Clientes, Implantação White Label/PABX, Onboarding e CS;
6. Financeiro e Insights;
7. Automações e Ajustes;
8. certificação final.

Antes de codar uma tela, fazer um pre-flight breve com: objetivo de trabalho, rotas/componentes,
dados/endpoints, ações, problemas atuais, nova composição, lacunas e dependências. Perguntar ao
usuário apenas por decisões de produto não inferíveis.

Depois de aprovado, a tela só é FINAL se tiver dados reais, ações reais, responsividade,
loading/empty/erro/permissão/sucesso, acessibilidade básica, console/network limpos e testes
relevantes. Atualizar `PRODUCT-FINALIZATION-TRACKER.md` por módulo.

## 8. Regras específicas de UX e código

- Reutilizar componente shadcn existente, depois pattern ONFACE existente; não criar variações
  como `MetricCard2`, `MetricCardFinal` etc.
- Não introduzir hex/spacing/radius aleatório em módulos concluídos. Mapear papel semântico para
  token.
- Portais Radix vivem fora do shell: tema/token de dropdown, popover, dialog e tooltip precisa
  funcionar no `<html>`, não depender apenas de um wrapper visual.
- Não remover contratos de API ou estados de domínio certificados para reproduzir um mockup.
- Não inventar KPI, health score, prioridade ou dado de negócio ausente.
- O NEXO é inteligência operacional contextual; não colocar chat flutuante decorativo em todas as
  telas.
- A sidebar atual é transição. Nenhuma tela nova deve ser construída em cima dela, mas ela também
  não deve ser removida antes da aprovação/promulgação controlada do novo AppShell.

## 9. Implantação White Label — contexto preservado

O fluxo White Label foi objeto de trabalho anterior e há mudanças relacionadas no worktree. O
objetivo aprovado é substituir o onboarding genérico por **Implantação White Label**:

- formulário público por token em `/impl-white-label/[token]`;
- dados: domínio/subdomínio, contato DNS, logo/favicon, cores HEX, faturamento, prazo, observações;
- reaproveitar uploads seguros e `fulfillment_formularios`;
- formulário submetido gera atividade/notificação e deixa o responsável revisar/solicitar correção;
- sem e-mail automático; templates humanos de WhatsApp e e-mail com `{{link_implantacao}}`;
- o responsável envia manualmente e é levado ao canal correto (Atendimento ou E-mail), não apenas
  copia texto;
- checklist operacional deve começar por responsável/primeiro contato e terminar por reunião de
  onboarding, go-live e handoff para CS; evitar itens de "primeiro acesso" inadequados.

Não reverter nem substituir esse fluxo sem ler os arquivos/aceites atuais e testar PABX como
regressão. Sempre que o White Label cair, ele pode vir sem responsável; a UX deve permitir definir
responsável de forma explícita.

## 10. Qualidade e validação obrigatória

O usuário pediu uso contínuo do Impeccable. Use-o como crítica de composição/UX, não como gerador
automático de mudanças cegas. Para qualquer alteração visual material:

```bash
/Users/Scott/.agents/skills/impeccable/scripts/impeccable detect --json <arquivos-alterados>
npx tsc --noEmit --incremental false
git diff --check
```

Também validar no browser real em 390, 768, 1280, 1440/1512 e 1920px quando aplicável. Conferir
console, requests, teclado, foco, labels, menus/drawers/dialogs e deep links.

Validações feitas na última iteração do preview:

- `npx tsc --noEmit --incremental false` passou;
- `git diff --check` fpassou;
- detector Impeccable no escopo ONFACE retornou `[]`;
- navegador local: desktop amplo, 768px e 390px; console sem erros/warnings;
- servidor Next local estava escutando em `localhost:3000`.

## 11. Registro de continuidade

Ao fazer mudanças materiais, registrar em tempo real:

- `PRODUCT-FINALIZATION-TRACKER.md` no repo;
- vault: `02_PROJETOS/Callface/CRM/produto/crm-callface-status.md`;
- diário do vault: `01_CONTEXTOS/01_CONTEXTOS/diario/AAAA-MM-DD.md`.

Não declarar o shell/tela como aprovado sem validação explícita do usuário. A próxima ação segura
é o Claude abrir o preview, criticar/corrigir o que ainda estiver visualmente ruim e pedir uma
decisão de promoção antes de tocar no AppShell oficial.
