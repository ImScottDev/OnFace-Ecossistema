TASK-001 · 00-demanda

ORIGEM: Scott, 2026-09-17. Destrava o backlog congelado (D1 revogada). Objetivo único: fechar o Módulo 01 Vendas funcional e validado no navegador. Não avançar para Módulo 02. Não refazer domínio correto. Não abrir brainstorming de produto.

CRITÉRIO DE PRONTO (do Scott, inegociável)
clicou, executou, persistiu, UI refletiu, reload preservou, próxima navegação funcionou. Typecheck e teste de backend não substituem tela.

ESTADO REAL DO CHECKOUT (verificado, não é resumo de terceiro)
Checkout: /Users/Scott/Documents/Scott Studio/callface-crm-dev, branch dev. O checkout callface-crm fica fora desta frente.

1. O WIP de 39 arquivos foi PRESERVADO em commit de checkpoint 2c67aed sobre 832d68a. Working tree estava limpo depois disso. Não houve reset, stash, merge, push nem produção. Isso contraria a linha do BACKLOG que diz "nada foi commitado" e a proibição de commit da D5: o commit foi feito pelo Maestro como proteção do WIP antes de qualquer edição, e está registrado aqui por transparência. Trabalho válido: zero perda.
2. Baseline medido no momento do checkpoint: tsc --noEmit --incremental false saía com exit 2 e 3 erros, todos em components/onface/vendas/Prospeccao.tsx (139, 147, 422). Testes de domínio de vendas: 29 passando.
3. ARMADILHA: next.config tem typescript ignoreBuildErrors true. npm run build passar NÃO prova typecheck limpo. O gate é tsc --noEmit --incremental false, como já está na D2.
4. Banco local postgresql://callface@localhost:5432/callface_crm é clone com dados reais. A senha de seed antiga não vale. O Maestro definiu senha de teste LOCAL para kaua.araujo@callface.ai a fim de liberar smoke autenticado. Credencial de QA: kaua.araujo@callface.ai / devlocal2026. Só banco local.

ENTREGA JÁ EXISTENTE, PENDENTE DE QA (não é dev-log de ninguém do time ainda)
O bloqueador de Prospecção foi implementado antes desta correção de fluxo, está no working tree e NÃO foi commitado. Precisa passar por QA Codex antes de ser aceito, e pode ser rejeitado.
Arquivos: components/onface/vendas/Prospeccao.tsx, prospeccao-acoes.ts, prospeccao-acoes.test.ts.
O que foi feito: acoesEmMassaDisponiveis passou de string[] para lista de {chave, rotulo}, matando o mapeamento por texto; DialogoMassa passou a receber operacao, listas e cadencias e a renderizar o controle certo por operação; o valor confirmado passou a ser roteado para o campo certo; os 3 erros de tipo foram corrigidos; o teste tautológico foi trocado por teste de mapeamento e payload.
Estado do gate após essa entrega: tsc exit 0, testes de components/onface/vendas passando. SEM print de tela, SEM smoke. Pela D2, isso é REPROVADO por falta de evidência até o QA rodar o portal.

ACHADOS DE AUDITORIA A ENDEREÇAR (evidência em código, confirmados)
A. Rota canônica (resolve P2.3): a rota VIVA é /onface-preview/*, porque o menu congelado aponta para lá (components/onface/navigation.ts ROTAS_ONFACE) e o layout exige sessão. /onface-desenho/* é espelho de desenvolvimento, retorna notFound em produção e importa as server actions da rota viva. Não é duplicação acidental, é espelho. Consequência operacional: toda alteração precisa do par, no mesmo commit. QA valida na viva e só compara no espelho.
B. Bug de domínio comprovado: FiltrosProspeccao.lista é declarado em lib/vendas/consultas.ts e nunca aplicado no SQL, com LIMIT 400. O filtro de lista opera sobre página truncada. Corrigir só isso dentro de consultas.ts, sem refatorar o motor.
C. PreVendas.tsx é o único dos cinco componentes que não recebe rotaBase e tem dois href fixos em /onface-preview. No espelho, os CTAs pulam para a superfície autenticada.
D. onface-desenho/contatos/pessoas/[id]/page.tsx é a única página do espelho que usa getTenantContext, então dá 404 sem sessão. É o único caminho da tabela de Pessoas.
E. pagina.tsx gera deep link ?lead={id} para uma página que não lê esse parâmetro. CTA que navega e não seleciona nada.
F. Contatos não renderiza a coluna Responsável embora consultas.ts já devolva o dado. Empresa 360 não expõe WhatsApp e E-mail.
G. Import circular entre pagina.tsx e PreVendas.tsx. Tratar como arquivo único para efeito de paralelismo: dois devs nesses dois arquivos ao mesmo tempo quebra.
H. Fora do Módulo 01, components/onface/visao-geral/VisaoGeral.tsx ainda gera link wa.me. Registrar, não corrigir nesta task.
I. lista e tag gravam na mesma tabela de labels. A separação conceitual não existe no dado. Achado de produto, registrar, não resolver sem o Scott.

DECISÕES DO SCOTT NESTA DEMANDA
D7 A SpecDrive §21 aceita página de Lead OU drawer. Fica o drawer que já existe. Não criar /pre-vendas/[id]. Matar o deep link morto do item E.
D8 app/src/scripts/_q.ts (P2.1) entrou no commit de checkpoint por preservação. Sai do código em commit de higiene ao fechar a task. Até lá pode ser usado para inspeção do banco LOCAL pelo QA.
D9 Execução serializada no checkout único. Proibido dois agentes editando o mesmo checkout ao mesmo tempo. Sem branch nova e sem worktree: a regra do repo é main, dev e homolog apenas.
