# Benchmark — funilvivo (app.funilvivo.com.br), 01/10

Referência pedida pelo Kauã para o construtor de Fluxos/Automações do ONFACE
("nível n8n, com gatilhos, triggers e tudo mais"). Conta de estudo da Callface.
Capturas em `~/.playwright-mcp/fv-*.png`. Não copiar visual — o visual é o
ONFACE (tokens e casca do protótipo). Copiar a ESTRUTURA e a usabilidade.

Os dois editores deles usam React Flow (`.react-flow__node-*`), que nós já
temos instalado (`@xyflow/react` 12).

## 1. Fluxos de Conversa (bot de WhatsApp)

Quatro colunas:
1. **Lista de fluxos**: busca, chips de "Jornadas" (pastas: Todas / Sem jornada
   / Nova jornada), item com nome + ID, ações inline (duplicar, compartilhar,
   excluir), botões no topo: compartilhados comigo, nova pasta, novo fluxo.
2. **Paleta de blocos** ("Arraste ou clique para adicionar"), por categoria:
   - Gatilho: Gatilho (inicia o fluxo).
   - Mensagens: Mensagem, Mídia, Multi-mensagens, Enviar modelo (template
     oficial), Opções (números/botões/lista), Pergunta (captura em variável).
   - Lógica: Condição (Sim/Não), Menu de direção (rodízio), Contar evento,
     Espera, Horário de atendimento (dentro/fora), Aguardar até horário,
     Pausar fluxo padrão, Definir variável, Ir para fluxo, Fim.
   - Ações: Etiqueta, Campo do contato, Mover no funil, Atribuir, Ajuda do
     atendente, Definir responsável, Sequência (inscreve/remove), Aviso,
     Gerar cobrança (PIX/link), Rastrear conversão (Meta CAPI), IA (responde
     com assistente), Requisição HTTP.
3. **Canvas**: nome do fluxo editável no topo, toggle Ativo/Inativo, tela
   cheia, Salvar; minimapa; zoom +/−/fit; "Construir com IA" flutuante.
   Nó de Opções tem uma saída por opção + saída "Resposta inválida". Arestas
   curvas. Seleção mostra "Excluir nó selecionado".
4. **Inspetor** (direita, ao clicar no nó): título e descrição do bloco; ex.
   Gatilho → Tipo (Palavra-chave / Nova conversa / Manual), palavras-chave
   em chips com +, texto de ajuda.

## 2. Automações (estilo n8n)

- Lista: "Trabalho que acontece sozinho, no horário ou quando algo muda."
  Cada item: nome, estado ("rascunho, ainda não publicada"), toggle, link
  Execuções. Botões: Execuções, Criar automação.
- Editor, barra do topo: Voltar · nome · toggle · desfazer/refazer ·
  **Histórico** (versões) · **Ensaiar** (dry-run) · **Rodar agora** ·
  "salvo há N s" (autosave de rascunho) · **Publicar**.
- Canvas: nó de gatilho "QUANDO / Algo acontece"; nós de ação com faixa de
  cor da categoria, ícone, título, resumo dos parâmetros (com expressões
  `{{ item.json.chat_id }}`), saída normal e saída de erro.
- "+" abre paleta com busca e categorias com contagem: Lógica 13, Dados 10,
  Plataforma 18, IA 6, Integrações 11. Lógica: Definir campos, Filtro
  (regras), Roteador (rotas), Repetir, Juntar, Esperar, Parar, Tratar erro,
  Remover repetidos, Limitar quantidade, Ordenar, Dividir em itens, Agregar.
- Inspetor do gatilho: "Começa quando" = Eu mandar rodar | Em horários
  marcados | Acontecer algo na plataforma | Receber uma chamada HTTP
  (webhook). "O que acontece" = Contato novo, Lead mudou de etapa, Conversa
  resolvida, Etiqueta adicionada/removida, Agendamento criado/cancelado,
  Mensagem recebida. Checkbox "disparar também quando a mudança vier de
  outra automação" (anti-loop, desmarcado por padrão recomendado).
- Todo nó: "Se este bloco falhar" (Parar / Seguir pela saída de erro /
  Ignorar e continuar) e "Tempo limite (segundos)".

## O que isto significa para o ONFACE

O CRM já tem as peças de baixo: `lib/cadencia/cadence-engine.ts` executa
grafo (passos wait/action/condition, adapters, retry, idempotência), os
gatilhos de evento em `dispararAutomacoes()` (novo_lead, mudanca_status,
tag_adicionada, whatsapp_recebido, Stripe...), as tabelas `automacao_versoes`
(nodes/edges/trigger_config/settings/published_at) e
`automacao_passos_execucao`. Falta o editor e a ponte editor → executor.

## 3. Superagente / Assistentes IA

- **Lista de assistentes**: KPIs no topo (Assistentes, Online agora, Arquivos,
  APIs conectadas); card por assistente: avatar, estado Ativo, nome,
  descrição, provedor·modelo (ex.: OpenAI · gpt-4o-mini), chips de
  capacidades (Agenda, Mídia, Funil, Links), contadores (arquivos, mídias,
  APIs), Editar. "Criar assistente" + "Começar a partir de um modelo"
  (modelos por nicho com prompt e capacidades prontos).
- **Editor do superagente** (captura `fv-superagente.png`): barra com Modo
  clássico · Salvar rascunho · Publicar. Abas: Identidade & Escopo ·
  Conhecimento · Ações · Canais & Handoff · Memória · Desempenho · Histórico.
  - Identidade & Escopo: nome, descrição/nicho, avatar, "Função do agente",
    listas editáveis "Pode ajudar com" / "Não deve tratar de" / "Transferir
    para humano quando" (chips com Adicionar), "Ver prompt compilado"
    (o escopo vira prompt), Jornada do cliente (etapas que o agente segue),
    Modo de atendimento: **Autônomo** (responde sozinho) × **Copiloto**
    (sugere, equipe decide, cada decisão treina), Avançado (instruções,
    modelo, resposta).
  - **Playground** fixo à direita: testa o RASCUNHO, "nada é enviado de
    verdade", histórico de teste local.
- Custos visíveis: custo de treinar (embedding) e de atender (créditos por
  resposta curta/média/longa).

## 4. Orquestração (copiloto → autônomo)

Painel de maturidade da IA: sucesso das sugestões, aceitas sem edição, não
aceitas, nota da equipe; "quem respondeu o cliente" (humano × IA); evolução
semanal; **Prontidão para a IA responder sozinha** (N de 50 decisões em 28
dias) com botão "Graduar para Autônomo" — "a decisão é sua, os limiares são
referência". Funil de sugestões: geradas, aceitas, editadas, rejeitadas,
ignoradas, substituídas, expiradas, pendentes.

## 5. Sequências

"Esteiras automáticas: o lead entra (por fluxo, IA, etiqueta, funil ou
página) e recebe os passos no ritmo que você definir." Passos contam o
tempo a partir da inscrição; removido antes do passo, o passo não dispara.
Estado vazio explica o conceito + "Criar a primeira". (No ONFACE isto é
Cadências.)

## 6. Campanhas (Remarketing)

Abas: Campanhas · Nova campanha · Leads · Públicos · Configurações.
**Agente de campanhas** (IA conversacional que monta, acompanha e melhora)
com sugestões prontas ("Reative quem está parado há 30 dias com um cupom de
10%", "Como estão minhas campanhas?").

## 7. Varredura geral

Varredura em 2026-10-01, só leitura, conta de estudo sem dados (então
quase tudo é estado vazio — e é justamente o que vale estudar). Prints e
innerText em `scratchpad/pw/ref/`.

**Shell / global**
- Sidebar agrupada por intenção: ATENDIMENTO · AUTOMAÇÃO · OPERAÇÃO · CONTA. Rótulo do segmento da conta embaixo do logo ("Loja / E-commerce").
- Faixa fina no topo para pendência de conta ("Confirme seu e-mail… Reenviar") — uma ação, sem modal.
- Botão "?" flutuante de ajuda + modal de boas-vindas com "Assistir depois" (não bloqueia).
- Módulo fora do plano não some: abre tela "NÃO INCLUSO NO SEU PLANO" com a promessa em 1 frase + "Fazer upgrade" (IntegraMax).

**Visão geral (dashboard)**
- Checklist "Primeiros passos" com anel de % (17%), 6 itens que **se completam sozinhos pelo uso** (não por clique), item feito riscado, dispensável (X). Itens incluem marcos reais: "IA respondeu um cliente de verdade", "Primeira automação disparou".
- Seletor de período em pílulas (1d/7d/15d/30d/Personalizado) + "Conselho de IA" (IA que lê o painel e recomenda) + Atualizar.
- 4 KPIs (atendimentos, novos, conversões, taxa) com subtexto que explica a conta ("0 convertidos · 0 novos clientes").
- Tempo de resposta e tempo de conversão como KPIs de primeira classe.
- Card **Alertas** acionável: aguardando resposta, sem interação 24h — fila de trabalho dentro do dashboard.
- "O que a IA fez · últimos 7 dias" e "Performance por atendente" lado a lado: humano × IA na mesma tela.

**Conversas / ClienteVip**
- Inbox com abas Abertas · Minhas · Resolvidas · Todas; painel direito "Selecione uma conversa" no vazio.
- ClienteVip = app do cliente final (portal), vendido como recurso de plano.

**Clientes**
- Filtro de responsável no topo (Qualquer / Sem responsável / pessoa) — "sem responsável" como filtro de primeira classe.
- Mini-KPIs acima da tabela: total, nesta página, com valor.
- Colunas enxutas: contato, etiqueta, última interação, valor, canal, status, responsável. Exportar + densidade 20/50/100.

**Funil (Kanban)**
- Breadcrumb Funil › Padrão (múltiplos funis), subtítulo que ensina ("Arraste os cards entre as etapas…").
- CTA primário "⚡ Automatizar funil" no próprio kanban — automação nasce do contexto, não de outro menu.
- Contador "Negócios ativos" e contagem por coluna; coluna vazia tem slot tracejado "+ Sem cards" clicável; etapas com cor.

**Elementos**
- Peças reutilizáveis (menu de direção, contador de evento, métrica) que fluxos e dashboard consomem. Vazio diz o *porquê*: "ligar e desligar ofertas sem abrir o fluxo".
- Equivalente B2B: flags/feature switches de cadência e métricas customizadas definidas uma vez.

**Páginas / Funis de Páginas**
- Melhor estado vazio do produto: 4 passos numerados do conceito, **um exemplo real** concreto, "Antes de começar" (pré-requisitos), e **"Não confunda com os vizinhos"** (Fluxos × Funil × Funis de Páginas).
- Dois caminhos: "✨ Construir com IA (recomendado)" e "Montar manualmente". Objeto nasce inativo; testa na prévia e ativa.
- Páginas: vazio aponta para modelos ("captura de leads, página de vendas ou evento").

**Templates (WhatsApp)**
- Explica a regra de negócio no subtítulo ("as únicas que podem iniciar conversa fora da janela de 24h").
- "✨ Gerar com IA" ao lado de "Novo template". Pré-requisito ausente vira estado vazio com o próximo passo (conectar API oficial).

**Produtos / Serviços / Agenda / Equipe**
- Subtítulo diz o que a IA faz com o cadastro ("0 ativos — a IA envia a oferta com link de checkout nas conversas"): cadastro tem propósito visível.
- Equipe: KPIs equipe/disponíveis/em folga/especialidades. Agenda depende de equipe e diz isso ("Cadastre equipe para ver a agenda").
- Agenda com legenda de status (agendado/confirmado/concluído/cancelado) e "Hoje".

**Assinatura / Instâncias / Configurações**
- Planos com limites explícitos (números, contatos) e lista do que inclui; cupom inline; trial 3 dias.
- Instâncias: contador "0 conectadas · 0 offline" + cards por canal (QR, API oficial, Instagram, Z-API) com caminho alternativo ("Já tenho o número na Meta").
- Config de IA: IA da plataforma por padrão, BYO key opcional, e aviso claro de quando a chave própria não está sendo usada (créditos).
