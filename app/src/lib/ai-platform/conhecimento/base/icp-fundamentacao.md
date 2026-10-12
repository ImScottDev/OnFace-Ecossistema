---
slug: icp-fundamentacao
nome: ICP: fundamentação com dados
categoria: icp
governanca: historico
origem: vault:02_PROJETOS/Callface/Growth/comercial-growth/icp-callface.md
nota: camada de fundamentação; a referência vigente é o ICP v2
gerado_em: 2026-10-12
---

# Callface — ICP Completo (2026-06-09)

> ⚠️ **Camada de FUNDAMENTAÇÃO data-driven.** Pra ICP **acionável** (achar o cliente, quando atacar, copy), a referência canônica passou a ser icp-publico (v2, 2026-06-26). Esta nota sustenta os números e o perfil de comprador real; a v2 transforma isso em ferramenta de aquisição.

Documento canônico de ICP. Construído sobre dados reais (Metabase, base de 145 pagantes, cohort, ARPA, LTV) e refinado por cinco lentes: @hormozi-leads, @peter-fader, @sean-ellis, @byron-sharp, @scott-ops-strategist.

Substitui como referência primária o icp-personas (que vira base histórica).

---

## 0. Tese de ICP em uma frase

A Callface ganha dinheiro hoje com **gestor-dono de operação comercial pequena que liga muito e não tem controle do que é dito no telefone**, e ganha margem alta amanhã com **parceiros white label verticais** (modelo Carchat) e **gerentes de inside sales mid-market** que precisam analisar 100% das chamadas, não 2%.

O erro estratégico a evitar: tratar o ICP aspiracional (mid-market, enterprise) como se já fosse o ICP real. Quem paga hoje é micro/PME. Quem dá escala com margem é o parceiro de canal. São jogos diferentes, com mensagem, canal e ciclo diferentes.

---

## 1. Leitura por lente (o que cada agente trouxe)

### @hormozi-leads — Starving crowd e qualificação
O mercado faminto da Callface não é "empresas que querem IA". É **operação que vive de telefone e já perdeu dinheiro por não ter prova do que foi falado**. A dor é concreta e recorrente, não aspiracional. Critério de starving crowd: volume de ligações alto + zero visibilidade + consequência financeira já sentida. Quem tem os três compra rápido. Quem tem só "curiosidade por IA" entope o trial e não converte (os 563 trials perdidos em 12 meses).

### @peter-fader — Nem todo cliente vale igual
Customer-base analysis manda não olhar a média e sim a distribuição. Dois fatos dominam a base:
- **Carchat concentra ~47% da base Callface.ai** via um único parceiro white label. Isso não é um cliente, é um canal. O CLV "real" da Callface está mascarado por essa concentração.
- A cauda de clientes diretos é longa e de baixo ticket (ARPA R$810, 3-4 usuários/conta). LTV/CRC de 181x diz que **quando o cliente fica, a economia é excelente**. O problema não é unit economics, é seleção na entrada (trial→pago de ~20%) e concentração de canal.

Conclusão Fader: pare de otimizar para "mais clientes" e comece a otimizar para **mais clientes do perfil que retém** e **mais canais como o Carchat**.

### @sean-ellis — Must-have e ativação
O sinal de PMF está no cohort: clientes de abr/2025 mantêm 13 de 16 usuários ativos no M10 (churn de usuário ~2%/mês). Para quem ativa, o produto é must-have. O gargalo é **ativação**, não retenção. A feature que vira must-have no ICP real é **gravação + transcrição** (controle), e o CallPilot é descoberto depois como bônus. Implicação: a promessa de aquisição deve ser "controle do que seu time fala no telefone", não "IA de conversação". A IA vende a expansão, não a entrada.

### @byron-sharp — Como esse comprador compra
No ICP real a compra é por **disponibilidade**: viu anúncio, fez trial, ativou em 20 minutos, pagou no cartão. Decisão individual, baixa deliberação, alta sensibilidade a preço. Crescimento aqui vem de **penetração** (mais compradores leves entrando), não de lealdade de poucos. Já no aspiracional (mid-market/enterprise) a compra é deliberada, multi-decisor, e aí disponibilidade mental da categoria ("o Gong brasileiro") e prova social com número passam a importar mais que o trial.

### @scott-ops-strategist — Síntese acionável
Três ICPs valem energia agora, em ordem: (1) blindar e crescer o **ICP real** melhorando conversão de trial, (2) **replicar o modelo Carchat** em 2-3 verticais novas (maior alavanca de margem com menor CAC), (3) começar a semear **mid-market inside sales** via ABM. Enterprise compliance fica como aposta de médio prazo, dependente de co-selling Microsoft.

---

## 2. ICP PRIMÁRIO (real, data-driven) — "O Operador"

Quem paga a conta hoje. Otimizar aquisição e ativação aqui é a prioridade 1.

### Firmographics
- **Porte:** micro a PME pequena, 1 a 10 usuários (sweet spot 3-4 usuários/conta)
- **Ticket:** ARPA R$810/conta/mês (faixa R$400 a R$1.200)
- **Verticais comprovadas:** automotivo (revendas/concessionárias, via Carchat), financeiro/crédito (correspondentes, corretoras de seguro, mesa de crédito), marketing/agência, contabilidade, tech/SaaS pequeno
- **Geografia:** Brasil, forte no interior de SP e capitais médias
- **Estrutura:** dono-operador ou gestor que também vende. Sem área de RevOps, sem analista de dados

### Technographics
- **CRM:** Agendor (dominante), Ploomes, Pipedrive, Kommo, Bitrix24. Agendor como CRM #1 é o marcador mais forte de ICP real
- **Telefonia atual:** celular, WhatsApp ou PABX básico sem análise
- **Maturidade digital:** baixa a média. Não usa ferramenta de sales engagement

### Comportamento e gatilhos (Hormozi + Ellis)
- **Volume:** o time liga o dia inteiro, telefone é o canal principal de venda
- **Gatilho de compra:** já perdeu uma venda ou levou um problema por causa de algo dito/prometido no telefone que não pôde provar. Ou um vendedor bom saiu e ninguém sabe o que ele fazia diferente
- **Como compra (Byron Sharp):** vê anúncio (Meta/Google) ou vem por parceiro white label, faz trial de 7 dias, ativa em minutos, paga no cartão. Decide sozinho, em menos de uma semana, baixa deliberação
- **Job to be done:** "quero saber e controlar o que meu time fala no telefone, sem pagar uma fortuna"

### Dores (em ordem de peso)
1. Zero visibilidade do que é dito nas ligações (a dor que vende)
2. Risco de promessa indevida sem prova
3. Não saber por que um vendedor converte e outro não
4. CRM preenchido errado ou não preenchido pelo time

### O que fecha e o que ativa
- **Fecha:** trial que funciona de primeira, gravação + transcrição visíveis no dia 1
- **Ativa (must-have):** ouvir/ler a primeira ligação gravada e transcrita. Esse é o momento "aha"
- **Expande:** CallPilot (scorecard, objeções, sentimento) descoberto depois vira o motivo de ficar

### Objeções
- "Tá caro pra minha realidade" (compara com WhatsApp grátis). Resposta: custo de uma venda perdida > mensalidade
- "Meu time vai resistir à gravação". Resposta: enquadrar como coaching e proteção, não vigilância
- "Já gravo no CRM/celular". Resposta: gravar sem transcrever e analisar não resolve nada

### Risco do segmento
Churn alto **sem onboarding**. O produto é must-have só depois da ativação. Sem mão na ativação, o trial vira o cemitério de 563 leads/ano.

### Persona: Marcos, 36, dono de revenda multimarcas (interior de SP)
4 vendedores ligando o dia todo, usa Agendor ou planilha, sem visibilidade do que é prometido. Já perdeu venda por promessa errada e não conseguiu provar. Viu anúncio no Instagram, fez trial, ativou em 20 minutos.

---

## 3. SEGMENTAÇÃO POR VALOR (lente Fader) — não trate a base como um bloco

| Tier | Quem | % da base | Característica | Ação |
|------|------|-----------|---------------|------|
| **Canal (não cliente)** | Carchat e futuros white labels | ~47% | 1 parceiro = ~44 contas, CAC quase zero | Blindar Carchat + replicar o modelo. Maior alavanca de margem |
| **Core direto** | Operadores que ativaram e retêm (financeiro, contábil, automotivo direto) | núcleo da cauda | ARPA R$810, churn ~2%/mês, LTV/CRC 181x | Aumentar conversão de trial e expandir uso de CallPilot |
| **Cauda de baixo valor / risco** | MEI individual, trial curioso, 1 usuário | volume alto | Sensível a preço, churn elevado | Self-serve total, custo de servir mínimo, não gastar comercial |
| **Alto potencial latente** | Contas com minutagem alta (Conciliador Contábil, DSA, Tx Corretora, Auvo, Solatium) | poucas, valiosas | Já usam muito, candidatas a expansão e a virar case | Account management leve, virar referência com número |

Insight central: a saúde futura da Callface depende de **descolar a base do Carchat** (replicando o modelo, não removendo o parceiro) e de **converter mais trials do perfil core**, não de adicionar mais cauda de baixo valor.

---

## 4. ICPs ASPIRACIONAIS (onde está a margem futura)

### Aspiracional A — Parceiro de Canal White Label (PRIORIDADE de margem)
O Carchat provou: 1 parceiro = ~44 contas sem CAC individual. Replicar em 2-3 verticais multiplica base sem multiplicar custo comercial. **Esta é a maior alavanca da casa e está sub-explorada.**

- **Quem é:** software house vertical, CRM vertical, consultoria, franqueadora com base própria de 50 a 500 clientes
- **Verticais alvo:** saúde (sistemas de clínica), imobiliário (CRM/portais), educação, financial services, contábil
- **Ticket:** R$2k a R$8k/mês de receita indireta por parceiro, comissão 20-30% recorrente
- **Canal:** outbound para founders/CEOs desses softwares
- **O que fecha:** API documentada + case Carchat como prova viva do modelo
- **Persona:** Diego, 43, CEO de software para clínicas, 300 clínicas na base, cujos clientes reclamam que o telefone não integra com nada. 1 deal Diego = 50-100 contas novas

### Aspiracional B — Mid-Market Inside Sales (PRIORIDADE de ticket)
A faixa mais lucrativa por LTV. Um deal aqui equivale a 10-20 clientes do ICP real.

- **Quem é:** 30 a 150 usuários, B2B SaaS, financial services, imobiliário, educação
- **Ticket:** R$3k a R$15k/mês
- **CRM:** HubSpot, Salesforce, Pipedrive
- **Ciclo:** 2 a 6 semanas, 2-3 decisores
- **Canal:** ABM + outbound segmentado + indicação de parceiro
- **Como compra (Byron Sharp):** deliberada, com business case e número. Disponibilidade mental da categoria importa: posicionar como "o Gong brasileiro, com VoIP incluso e preço BR"
- **O que fecha:** demo com scorecard + detecção de objeção em ligação real. Extensão Chrome mata a objeção "já tenho CRM"
- **Persona:** Rafaela, 39, gerente de inside sales, SaaS de RH, 55 vendedores, hoje monitora 2% das chamadas por amostragem

### Aspiracional C — Enterprise Compliance-Driven (médio prazo)
Driver é regulatório, não growth. Ticket alto (R$15k a R$50k/mês), churn quase zero, ciclo 3-6 meses, comitê de compra.

- **Quem é:** 100 a 500 usuários, financeiro (bancos, seguradoras, fintechs), saúde regulada, telecom
- **Gatilho:** incidente de compliance ou auditoria (BACEN/SUSEP exigem gravação)
- **Canal:** co-selling Microsoft (Wevy já tem relação) + evento/webinar de compliance
- **O que fecha:** SOC 2, LGPD, SLA contratual, case de empresa similar
- **Persona:** Carlos, 47, diretor de ops comerciais de seguradora, 180 corretores, dois casos de promessa indevida já viraram processo
- **Pré-requisito:** maturidade de produto (SLA, certificações). Não forçar antes da hora

---

## 5. ANTI-ICP (quem NÃO perseguir)

Tão importante quanto definir quem é. Cada um destes queima CAC, infla trial e distorce métrica:

- **Curioso de IA sem volume de ligação** — entra no trial, não ativa, não paga. É o grosso dos 563 trials perdidos
- **Call center de atendimento/suporte puro** — ICP do Total IP e 55PBX, não da Callface. Callface é sales intelligence, não monitoria de SAC
- **Operação que não vende por telefone** — sem dor, sem produto
- **Quem quer só "o PABX mais barato"** — compete por preço de minuto, não valoriza IA, churn na primeira fatura
- **Enterprise sem gatilho de compliance e sem co-selling** — ciclo longo demais para o estágio atual, custo de venda não se paga ainda
- **MEI de 1 usuário sensível a preço extremo** — servir só faz sentido 100% self-serve, custo comercial zero

---

## 6. Matriz de qualificação (Hormozi) — score na entrada

Sinais que separam quem converte de quem entope o funil. Use no SDR e no self-serve.

| Sinal | Verde (ICP) | Vermelho (anti-ICP) |
|-------|-------------|---------------------|
| Volume de ligações/dia | Alto, telefone é canal central | Esporádico |
| Consequência já sentida | Já perdeu venda/teve problema por algo dito | "Só curiosidade" |
| Decisor | Dono ou gestor que compra sozinho (real) / decisor mapeado (mid) | Indefinido |
| CRM | Agendor, Ploomes, Pipedrive, HubSpot, Salesforce | Nenhum / planilha sem processo |
| Tipo de operação | Vendas/inside sales | Atendimento/SAC puro |
| Sensibilidade a preço | Compara com custo de venda perdida | Compara só com WhatsApp grátis |

Regra prática: 4+ verdes no real = empurrar para ativação rápida. 2+ vermelhos = não gastar comercial, deixar no self-serve.

---

## 7. Mensagem por ICP (o que faz cada um comprar)

| ICP | Promessa de entrada | Prova que fecha | Canal |
|-----|---------------------|-----------------|-------|
| Operador (real) | "Saiba exatamente o que seu time fala no telefone" | Trial: 1ª ligação gravada e transcrita em minutos | Meta/Google + parceiro |
| Parceiro white label | "Adicione telefonia com IA ao seu produto sem construir do zero" | API + case Carchat | Outbound a founders |
| Mid-market | "O Gong brasileiro: VoIP + IA inclusos, preço BR" | Demo scorecard em ligação real + business case | ABM + outbound |
| Enterprise | "Proteja sua operação: 100% das chamadas gravadas e analisadas" | SOC 2, LGPD, SLA, case similar | Co-selling Microsoft + evento |

Nota Ellis: para o real, NUNCA liderar com "IA". Liderar com "controle". A IA é o motivo de ficar e expandir, não o de entrar.

---

## 8. Priorização e sequência (estrategista)

| Prioridade | Frente | Por quê agora | Métrica de sucesso |
|-----------|--------|---------------|--------------------|
| 1 | Conversão de trial do ICP real | 85 trials/mês, ~20% convertem. Geração não é o gargalo, ativação é | Trial→pago de 20% para 35% |
| 2 | Replicar modelo Carchat em 2-3 verticais | Maior margem, menor CAC, reduz concentração de canal | 2 novos parceiros white label ativos |
| 3 | Semear mid-market via ABM | Maior ticket e LTV, descola da cauda de baixo valor | Pipeline mid-market com 10 contas |
| 4 | Enterprise compliance | Aposta de médio prazo, depende de produto + Microsoft | 1 piloto co-selling |

---

## 9. Ações imediatas que saem deste ICP

1. **Reescrever a promessa de aquisição** do site e dos criativos: de "IA de conversação" para "controle do que seu time fala no telefone". A IA aparece como expansão, não como entrada.
2. **Onboarding de ativação obrigatório no trial:** levar o usuário até ouvir/ler a 1ª ligação no dia 1. É o momento aha que separa churn de retenção.
3. **Playbook de parceiro white label** empacotando o modelo Carchat (API, comissão, suporte) para abordar 2-3 verticais novas.
4. **Lista ABM mid-market** filtrada pelos sinais verdes da seção 6 (volume de ligação alto, CRM HubSpot/Salesforce/Pipedrive, inside sales estruturado).
5. **Filtro de SDR** que desqualifica anti-ICP cedo, parando de inflar trial com curioso sem volume.

---

## Dados-base (Metabase, jun/2026)

145 pagantes (94 Callface.ai + 51 white label) · 466 usuários · ARPA R$810 · LTV 12m R$39,3k · CRC R$217 · LTV/CRC 181x · churn usuário ~2%/mês · 85 trials/mês · trial→pago ~20% · Carchat ~47% da base · Agendor CRM #1 · NMRR mai/2026 R$11,9k (acelerando).

Ressalva mantida: discrepância de MRR (R$57,5k Metabase vs R$500k declarado) não impacta a definição de ICP. ICP é sobre quem compra e por quê, e isso os dados de base mostram com clareza.

---

## Log

### 2026-06-09
- ICP completo construído com time de 5 agentes (Hormozi Leads, Peter Fader, Sean Ellis, Byron Sharp, Scott Ops Strategist)
- Definido ICP primário "O Operador" + 3 aspiracionais (parceiro white label, mid-market, enterprise) + anti-ICP
- Segmentação por valor (Fader): Carchat é canal e não cliente, base precisa descolar da concentração de 47%
- Matriz de qualificação, mensagem por ICP, priorização e 5 ações imediatas
- Documento vira referência canônica de ICP, icp-personas passa a ser base histórica

---

## VEREDITO DE COMPRADOR REAL (2026-06-14) — dados Stripe + Zoho

Reconstrução do ICP "sério" (a versão acima virou rascunho de partida). Aterrado em dinheiro real, não em achismo. Fonte: export Stripe (`dados/stripe/`) + Zoho (`dados/zoho/`).

### O número que define tudo
- **96 assinaturas ativas no Callface.ai, MRR ~R$37k.**
- **Ticket mediano R$180/mês. Média R$388.** Distribuição: 64% pagam <R$300, 85% <R$600. Topo raro até R$2.890.
- Tradução: micro/PME, 1 a 4 usuários, self-serve, decisão individual, alta sensibilidade a preço. Sem RevOps, sem comitê. Confirma e ENDURECE o perfil "O Operador".

### Verticais que pagam (topo dos pagantes Stripe)
- **Tecnologia / SaaS:** Auvo (R$2.890), GM Moro, Pontua, Suitable
- **Consultoria:** Aprove, Acelerar
- **Serviços financeiros / seguros / crédito:** Global Solução Financeira, Tx Corretora de Seguros, Smart Soluções Financeiras
- Leitura: **operação de venda por telefone em serviços, tech e financeiro.** É aqui que a aquisição do Callface.ai deve mirar.

### Armadilha nos dados (não confundir os dois jogos)
A base Zoho (891 contas) inclui o **PABX legado**: indústria (46), hotéis/restaurantes (24), construção (16), logística (16). Esses são telefonia tradicional, NÃO o ICP do Callface.ai. Misturar os dois infla e distorce a leitura de ICP. Callface.ai (Stripe) e PABX (Zoho) são públicos, mensagens e ciclos diferentes.

### Geografia
SP domina (~55% das contas com UF preenchida), depois MG, RJ, SC, GO. Forte capital + interior SP.

### Veredito de espelho competitivo (cruzamento com concorrentes)
- **Clint = espelho REAL do comprador.** PME, vertical, WhatsApp-first, self-serve, anti-hype. Igual ao pagante R$180 do Stripe. Copiar o ESTILO de comunicação dela.
- **SalesMeet = teto ASPIRACIONAL.** Enterprise, demo-gated, inteligência premium. Não é o comprador de hoje. Copiar a NARRATIVA de categoria dela ("não é gravador, é inteligência de dados") pra puxar ticket pra cima. (Sem o framing "mente": reprovado, feio de marca.)
- Erro a evitar: comunicar como SalesMeet (premium/enterprise) mirando um comprador que paga R$180. Tom Clint, ambição SalesMeet.
