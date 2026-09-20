# ONFACE, protocolo de execução

Vale para qualquer agente que trabalhe neste repo na frente ONFACE: Desenvolvedor,
QA Revisor, Maestro. Leia antes de escrever a primeira linha.

## As quatro leis

1. **ADAPTAR, NUNCA CRIAR.** ONFACE não é sistema novo. É o CRM2 existente (75
   telas em `app/src/app/(crm2)`) trocando de casca e sendo adaptado. Toda tarefa
   nomeia arquivo que já existe. Arquivo novo só quando a spec disser, com o nome
   escrito nela. Nada de tela paralela "nova versão de".
2. **O Design System é fonte única e viva.** Está em
   `app/src/components/onface/ds`, com laboratório navegável em `/design/onface`.
   Toda tela parte dele. Se falta capacidade, ela nasce no DS, ganha exemplo no
   laboratório e só então é usada na tela. Caso específico vira variação declarada
   do componente, nunca um componente paralelo na pasta da tela.
3. **Quem faz não fecha.** O Desenvolvedor entrega "pronto para revisão", jamais
   "pronto". Quem assina APROVADO é o QA Revisor, com evidência.
4. **O gate é o navegador.** `tsc` e build são necessários e nunca suficientes.
   Clicou, executou, persistiu, recarregou e continuou lá: isso é pronto.

## Como uma spec nasce (protocolo do Scott, 18/09)

Toda frente/módulo passa por estes seis passos, nesta ordem, antes de qualquer
código:

1. **Tese funcional** — o Maestro escreve como o módulo deveria funcionar na
   Callface, ignorando o legado, pensando na jornada nova.
2. **Inventário do que já existe** — rotas, schemas, componentes, workers,
   docs e decisões no repo. Caminhos reais, não suposição.
3. **Entra / sai** — o que o Maestro acha que deve entrar e o que deve morrer.
4. **Perguntas de decisão para o Scott** — poucas; só as que mudam regra de
   negócio. O resto o Maestro decide e registra.
5. **Spec redonda** — com as respostas, a spec fecha: cada parte vira nota, e
   as notas viram um fichário que todos os agentes acessam.
6. **UX antes do código** — tela nova ou refatoração de página passa por
   desenho de experiência (impeccable shape) antes da implementação; só então
   vai pro Desenvolvedor.

## A ordem de trabalho, obrigatória

Pular etapa aqui é a causa de "achei que estava pronto e não estava".

### 1. Contexto antes do código
Antes de tocar na tela, responda por escrito, na própria tarefa:
- Quais arquivos já existem para isso? (caminho, não suposição)
- O que essa tela faz hoje, de verdade? Abriu no navegador e viu?
- Que dado real ela mostra, de que tabela, por qual consulta?

### 2. Experiência antes do layout
Ainda antes do código, escreva:
- Quem chega aqui, vindo de onde, e o que precisa decidir.
- Quais informações precisam aparecer, em que ordem de importância.
- O que é ação e o que é leitura. O que persiste e o que é só visual.
- Os quatro estados: vazio, carregando, erro, volume alto.

Quando a tarefa for de tela nova ou redesenho, a skill `impeccable shape` cobre
essa etapa. Referência visual colada pelo Scott entra aqui, como direção de
composição, nunca como código gerado a partir da imagem.

### 3. Implementação
- Adapta o arquivo nomeado. Componente vem do DS.
- Regra de negócio não mora na UI. Ação de domínio vira função chamável em
  `src/lib/<modulo>`, que é a porta única de escrita daquele módulo.
- Ação importante emite evento, porque automação, NEXO e agentes externos vão
  se pendurar nele depois. Não construa fila nem barramento agora, só não feche
  a porta.
- IA futura consome ação, nunca o banco direto.

### 4. Prova
Antes de devolver, execute e registre:
- URL exata, passos na ordem, resultado observado.
- Recarregou a página e o efeito continuou lá?
- Console e network limpos?
- 390px conferido quando a tela for de uso diário.

### 5. Entrega
Devolva com: o que mudou (arquivo por arquivo), o que foi provado (passos acima),
o que ficou de fora e por quê. Trabalho parcial é aceitável e declarado. Trabalho
parcial apresentado como completo é o único erro que não é tolerado aqui.

## Definição de pronto, dois níveis

A virada de domingo exige **Nível 1** em tudo que está no escopo. Nível 2 entra
na ordem que o Scott definir.

**Nível 1, obrigatório para virar:**
- A tela abre sob a casca ONFACE, sem vazar para o shell legado.
- Mostra dado real, não placeholder.
- A ação principal funciona e persiste após reload.
- Os quatro estados existem e são honestos.
- Sem erro de console, sem 500, sem rota morta.

**Nível 2, refino:**
- Composição rica, gráficos, densidade, atalhos de teclado, microinterações,
  vazios com orientação, casos de volume alto.

## Fronteira de revisão (aprendido na reprovação do lote 1 da F1)

Revisão em árvore mutante não existe. A regra:

- **Entrega de lote = commit `wip(<frente>): lote N — <resumo>` na branch `dev`**
  antes de qualquer revisão. O QA revisa o diff do commit (fronteira imóvel);
  o Dev segue trabalhando na árvore em cima dele sem invalidar a revisão.
- O QA reprova por princípio qualquer revisão pedida sobre árvore não commitada
  que continue mudando.
- Push continua fora: commit local basta como fronteira. Merge para homolog e
  main seguem as regras de sempre (OK explícito).

**Emenda do espelho congelado:** `/onface-desenho/*` segue proibido para
qualquer mudança visual ou semântica. Fica permitido somente o ajuste mínimo de
import para o build não quebrar quando um módulo muda de lugar — declarado na
entrega, com a linha citada.

## Regras operacionais

- Checkout único: `/Users/Scott/Documents/Scott Studio/callface-crm-dev`, branch
  `dev`. Execução serializada. Nunca criar branch ou worktree novo para tarefa
  pontual.
- Virada: `dev` para `homolog` primeiro, validação com dado real, e só com OK
  explícito do Scott promove para `main`. Nada em produção sem o Kauã.
- Login local de smoke: `kaua.araujo@callface.ai` / `devlocal2026`, banco local.
  Nunca executar Enriquecer nem Apollo.
- Não rodar `pnpm build` com o `next dev` de pé: sobrescreve o `.next` e o dev
  server passa a servir CSS velho. Se a correção "não apareceu", suspeite disso
  e do cache do chunk de CSS do Turbopack antes de mexer no código de novo.

## QA Revisor: como revisar

O QA não escolhe como revisar. São três camadas, nesta ordem, e nenhuma
substitui a outra.

**Camada A, o revisor do Codex com arreio.** Codex cru num terminal é o modelo
sem o arreio: ele não recebe escopo de git, nem o prompt adversarial calibrado,
nem o contrato de saída estruturado. Rode o mesmo comando que a skill roda, da
raiz do repo:

```bash
node /Users/Scott/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs \
  adversarial-review --wait --scope working-tree "<foco da spec>"
```

Trocar `adversarial-review` por `review` chama o revisor nativo do Codex, que é
capacidade do binário e não um prompt. Use `review` para varredura geral e
`adversarial-review` quando a mudança tocar dado, permissão, migração ou
qualquer coisa com risco de regressão. A saída traz arquivo, linhas, severidade,
confiança e veredito `approve` ou `needs-attention`.

**Camada B, o navegador.** Nenhum revisor de diff clica em nada. Percorra o
caminho da spec na tela: ação, persistência, reload, 390px, console e network.
Uma entrega aprovada na Camada A e reprovada aqui está reprovada.

**Camada C, a spec.** Confira entrega contra intenção: o que a spec pediu foi
feito inteiro, ou foi feita a parte fácil e declarada como completa?

- Você recebe a spec e a entrega. Sua saída é veredito, não sugestão gentil.
- Reprove por padrão quando não houver evidência. Ausência de prova é reprovação.
- Verifique no código o que o dev diz ter feito, arquivo por arquivo. Confira se
  ele adaptou o arquivo nomeado ou criou coisa paralela.
- Rode o caminho no navegador. Se não conseguir, diga isso em vez de presumir.
- Procure especificamente: regra de negócio enfiada na UI, componente
  reimplementado à mão em vez de vir do DS, estado que some no reload, tela que
  quebra em 390px, e escopo entregue pela metade com linguagem de completo.
- Assine APROVADO ou REPROVADO na nota da frente, com o motivo e a evidência.
