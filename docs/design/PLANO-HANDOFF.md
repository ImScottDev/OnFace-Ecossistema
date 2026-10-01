# Plano — implantar o handoff completo

**Decidido em 30/09 com o Kauã:** prioridade é a **jornada comercial e de
pós-venda ponta a ponta**, funcional e sobre a arquitetura canônica. Agentes,
automação e o resto vêm depois do essencial estar de pé.

O Codex está pausado; a branch `redesign/onface-ux-spec-v1` é minha até ele
voltar. Quando voltar, o território divide assim: ele em `lib/`, `api/`,
`scripts/`, integrações e webhooks; eu em `components/onface/proto`, no layout
e nos `page.tsx` das telas do handoff.

---

## O que já existe

**Pronto e no ar:** as 23 telas canônicas convertidas do `.dc.html` (zero
transcrição à mão), `motion.js` instalado, e casca + peças + Pré-vendas ligadas
com dado real.

**A esteira** — o que faz as próximas telas andarem rápido:

| script | o que faz |
|---|---|
| `dc-para-tsx.mjs` | `.dc.html` → markup React, fiel por construção |
| `dc-logica-para-tsx.mjs` | lógica do protótipo → componente; o store vira props |
| `handoff-telas.mjs` | mapa arquivo→componente; recusa colisão de nome |

Converter uma tela leva segundos. **Ligar leva tempo**, e é onde o julgamento
entra: achar a query, mapear campo a campo, ligar cada botão a um command e
provar no navegador. Não dá para automatizar sem inventar dado.

---

## O que o domínio já entrega

Medido em 30/09. É isto que decide a ordem: tela com query pronta fecha rápido.

| tela | query / command | estado |
|---|---|---|
| Pré-vendas | `boardPreVendas`, `detalheLead` + 14 actions | **ligada e gravando** (30/09) |
| Pipeline | `boardPipeline` + mover/perder/ganhar | **ligada** (30/09) |
| Oportunidade | `detalheOportunidade` + atividades/notas/comitê | **ligada** (30/09) |
| Contatos | `diretorioEmpresas`, `diretorioPessoas` | **NÃO ligar** — o desenho inventa e-mail; ver DEFEITOS-DO-HANDOFF |
| Empresa / Pessoa | `empresa360`, `detalheLead` | **ligadas** (30/09) |
| Propostas | `acaoListar` (a query de lista JÁ existia) | **ligada** (30/09), leitura |
| Proposta (Builder) | `acaoCriar`, `acaoEnviar`, catálogo real | **ligada** (30/09) |
| Atividades / Atividade | `montarAtividades` | query pronta |
| CS | `lib/cs/*` (17 arquivos: carteira, risco, renovação, saúde) | o mais completo |
| Onboarding | `lib/pos-venda/handoff-implantacao.ts` | parcial |
| Clientes / Cliente | — | **falta** |
| Atendimento | `Cf2AtendimentoWorkspace` (tela atual funciona) | trocar a casca visual |
| Calendário / Reunião | `lib/calendario` | a conferir |

---

## As fases

### Fase 1 — a jornada comercial (o essencial)

A ordem é a do funil, e cada tela destrava a seguinte.

1. ~~**Pipeline**~~ — **feito em 30/09.** Arrastar grava e sobrevive ao
   reload; perder e ganhar passam pelos commands; as outras sete mutações
   avisam que ainda não gravam em vez de fingir. Registro em
   `docs/design/pipeline.md`.
2. ~~**Oportunidade**~~ — **feita em 30/09.** O 360 com atividades, notas,
   comitê, propostas e linha do tempo reais; avançar/perder/ganhar gravam e a
   recusa do domínio chega com o CTA que destrava.
3. ~~**Propostas + Proposta**~~ — **feitas em 30/09.** A lista é leitura; o
   Builder cria proposta com o catálogo REAL e grava amarrado ao
   `catalogo_precos`.
4. **Contatos · Empresa · Pessoa** — Empresa e Pessoa **ligadas em 30/09**.
   Contatos fica de fora: o desenho inventa e-mail em 41 pontos, sem fallback
   para o real. A tela atual funciona; o conserto é no Claude Design.

**Fecha a fase quando:** um lead entra em Pré-vendas, vira oportunidade no
Pipeline, recebe proposta, e a proposta chega a aceita — tudo com dado real,
persistindo e sobrevivendo a reload.

### Fase 2 — o pós-venda

5. **Clientes · Cliente** — precisa de query nova; `lib/cs/carteira-em-risco`
   e `metricas` dão a base.
6. **Onboarding** — `handoff-implantacao` cobre parte; o resto é marco e dono.
7. **CS** — o domínio é o mais completo do repo (17 arquivos). A tela existe;
   é trocar a camada visual.

**Fecha a fase quando:** oportunidade ganha vira cliente com serviço, o
onboarding abre com marcos e o CS enxerga a carteira.

### Fase 3 — o que atravessa

8. **Atividades · Atividade** — `montarAtividades` pronto. Hoje só roda no
   preview; promover para a rota.
9. **Atendimento** — a tela funciona; trocar a casca visual pela do handoff.
10. **Calendário · Reunião · Projeto · Relatório de Ligação · Iniciar Relação ·
    Tags de Oportunidade** — as menores, fecham por último.

---

## Sobre subir amanhã

Vale dizer com clareza: **as três fases não fecham em um dia.** A conversão
visual é automática; a ligação de dados é o trabalho, e são ~20 telas.

O que dá para ter amanhã é a **Fase 1** — a jornada comercial ponta a ponta,
funcional. As telas das fases 2 e 3 continuam com a UI atual, que funciona.

Isso é melhor do que 20 telas com a cara nova e metade das ações sem ligar:
tela que parece pronta e não grava é pior que tela antiga que grava, porque
ninguém descobre o buraco até estar operando.

---

## O que precisa de você

1. **Os gaps do handoff.** Você disse que vai arrumar — me manda o zip
   atualizado quando fechar, que eu regero por cima. A regeração é um comando;
   o que se perde é só a ligação, e só das telas que mudarem.
2. **Um defeito no handoff:** `OnFace Atividades.dc.html:651` tem CSS que
   escapou para fora das aspas do `style` e virou texto visível na tela. Conserto
   é no Claude Design.
3. **Telas sem query:** Clientes e Cliente não têm consulta no repo. Preciso
   saber o que a tela mostra — carteira de contratos? serviços canônicos? — para
   escrever a query certa em vez de adivinhar.
4. **Deploy:** eu não subo nada para homolog nem produção. Quando a Fase 1
   fechar, você valida e decide.

---

## Como cada tela fecha

Para não repetir discussão a cada uma:

1. converter (`handoff-telas.mjs`)
2. portar a lógica (`dc-logica-para-tsx.mjs`)
3. escrever o adaptador: mock → query real, botão → command
4. apontar a rota
5. provar no navegador: ação principal, reload, console, 390px
6. registrar em `docs/design/<tela>.md` o que ficou fiel e o que difere

**Botão que existe funciona ou fica desabilitado com o motivo.** Nunca um
toast dizendo que algo aconteceu sem nada acontecer — foi o que aconteceu com
Ligar/WhatsApp/E-mail e com Criar oportunidade, e é o defeito mais caro porque
não dá erro.
