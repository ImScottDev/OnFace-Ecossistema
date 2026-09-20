# Plano de Execução · Virada ONFACE — sexta 18/09 → domingo 20/09 à tarde

Base única de trabalho. Protocolo de execução: `ONFACE-PROTOCOLO.md`.
Quem escreve spec: Scott + Maestro. Quem executa: Desenvolvedor. Quem assina:
QA Revisor (Codex, 3 camadas). Tudo dentro do Maestri.

## A estratégia em uma frase

Converter as 75 telas do `(crm2)` para a casca ONFACE **primeiro** (ponto de
partida barato que já muda o produto inteiro), e daí lapidar módulo a módulo por
spec — dados, regras, UX, jornada — na ordem do dinheiro. Nada nasce do zero se
já existe; o que não existe nasce no DS e na camada de ações.

## Fases

### F0 · Fundação e risco (sexta, primeiras horas — paralelo)

| # | Tarefa | Quem | Aceite |
|---|---|---|---|
| F0.1 | **Plano de carga: dados de prod → schema novo.** Modelo da virada (Scott, 18/09): NÃO se migra homolog/prod pra frente; o sistema inteiro novo substitui o antigo e os dados de prod entram no schema de dev. Entregável: ensaio local ponta a ponta (dump prod → migrações dev → checks), lista de perdas (coluna de prod sem lugar no schema novo — decisão do Scott), defaults de preenchimento e a receita executável da virada. | Desenvolvedor | `docs/virada/PLANO-DE-CARGA.md` com o ensaio local rodado e a receita reproduzível |
| F0.2 | **Aplicar as 4 decisões do DS**: `--onface-escala` 1.0, `--onface-gutter` 24u, promover a ponte cf2→ONFACE de `ds/ds.css` para `app/onface.css`, coral preenchido com texto usa `--onface-coral-deep`. | Maestro | Lab e telas ONFACE conferidos no Portal; tsc limpo |
| F0.3 | **Brainstorm Scott + Maestro** (30–60min): visão do produto, o que cada módulo precisa se tornar, referências visuais. Alimenta todas as specs da F2. | Scott + Maestro | Nota "Visão do produto" no fichário |

### F1 · Casca única (sexta)

A spec já existe (nota `F1 · Casca Única`, liberada). Escopo confirmado no código:

1. `(crm2)/layout.tsx` monta o shell ONFACE mantendo `Cf2SidebarProvider`.
2. Ponte de tokens cf2→ONFACE valendo em `data-onface-theme` (herda F0.2).
3. `Cf2Topbar` → `OnfacePageBand`; `ModuloPendente` com cara ONFACE.
4. Logo e redirects param de vazar pro shell verde legado.

**Aceite:** amostra representativa das 75 telas validada no navegador (desktop +
390px), nenhum clique volta ao shell verde, ação real persiste após reload,
tsc/console limpos. QA assina na nota F1.

### F2 · Lapidação módulo a módulo (sexta noite → domingo manhã)

Uma spec por módulo, escrita por mim + Scott **enquanto o dev executa a
anterior**. Cada spec segue a ordem do protocolo: dados/regras → UX e jornada
(impeccable shape) → telas → prova. Nível 1 obrigatório em tudo; Nível 2 até
onde o relógio deixar, nesta ordem:

1. **Pré-vendas + Pipeline + Negócios** (o caminho do dinheiro)
2. **Clientes + Contatos + Empresas** (registro 360)
3. **Atendimento + Tarefas + Calendário** (operação do dia)
4. **Propostas + Pós-vendas**
5. **NEXO e automação** (ver F3)

Cada módulo ganha nota própria no fichário `ONFACE · Frentes` com a spec, o
log do dev e a assinatura do QA.

### F3 · Camada de inteligência — o que entra nas 48h (transversal à F2)

O que entra agora é **arquitetura + casca**, não agente completo:

- Porta única de escrita por módulo em `src/lib/<modulo>` (padrão já provado em
  `src/lib/vendas`). Toda spec da F2 já constrói assim.
- Ação importante emite evento (registro simples em tabela, sem fila/barramento).
- **NEXO casca funcional**: superfície de chat no produto, conectada às ações
  reais determinísticas (resumir registro, sugerir próxima ação a partir de
  regra, executar ação do sistema). Provider de IA de verdade fica atrás de uma
  interface trocável — referência de arquitetura: Vercel AI SDK / AI Elements /
  Chatbot template (estudar e adaptar, nunca depender).

### F4 · Virada (sábado noite → domingo tarde)

| Passo | Quando | Gate |
|---|---|---|
| Congelamento de feature em `dev` | sábado ~22h | Só correção entra depois |
| Carga (dados de prod → schema novo) + deploy do sistema novo em **homolog** | sábado noite | Receita da F0.1; prod antigo intacto (é o rollback) |
| Validação com dado real em homolog | domingo manhã | Checklist N1 módulo a módulo, QA assina |
| Correções da validação | domingo manhã | Só o que reprova N1 |
| **OK explícito do Scott (e Kauã para prod)** | domingo início da tarde | Sem OK, não vira |
| Carga fresca + deploy do sistema novo em **prod** | domingo tarde | Espelho do processo de homolog; antigo preservado até confirmação |

## Fora das 48h — registrado para não travar arquitetura, proibido implementar agora

| Frente | Estado | Nota |
|---|---|---|
| **Inbox omnichannel** (referência KAP/KOKO) | Frente futura | WhatsApp QR + oficial, IG, filtros, handoff, campanhas. DeskcommCRM (MIT) já foi tentado no CRM2 e não vingou — não reaproveitar código na pressa, só conceito. ChatbotX exige auditoria de licença (partes Enterprise) antes de qualquer reuso |
| **Meta CAPI** (devolver conversões de lead/oportunidade pro Meta) | Frente futura | Encaixa na camada de eventos da F3: evento de negócio → despacho pro Meta. É exatamente por isso que eventos entram agora |
| **WhatsApp Cloud API / coexistência** | Frente futura | Depende do inbox |
| **Reuniões/chamadas**: transcrição, pós-call, copilot em tempo real | Frente futura | Referência: Sales Call Summary Agent (Vercel); a definição do CallPilot já existe no vault |
| **RAG / memória de agente** | Frente futura | Referência: AI SDK RAG template |

Regra para todas: quando a frente abrir, estuda-se o repositório de referência,
traz-se a estrutura pro ONFACE e adapta-se ao DS e à camada de ações. Nunca
dependência externa rodando fora, nunca cópia sem auditar licença.

## Cadência e comunicação

- Enquanto o Dev executa o módulo N, Scott + Maestro fecham a spec do N+1.
- QA revisa em 3 camadas (Codex com arreio → navegador → spec) e assina na nota.
- Item sem assinatura do QA não existe. "Pronto" só existe na boca do QA.
- Qualquer bloqueio do Dev sobe pra mim na hora, nunca fica esperando.
- Referência visual do Scott entra na spec como direção de composição; o
  componente que entrega vem do DS (se falta, nasce no DS primeiro).
