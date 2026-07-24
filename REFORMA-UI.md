# Reforma UI/UX — CRM Callface

**Início:** 2026-07-21/22 · **Referência:** dashboard Earnify (estrutura/gramática, não paleta) · **Princípio-guia:** disciplina de cor — interface neutra por padrão, cor SÓ com significado (ação primária, status); nunca decoração.

## Design tokens (Fase 2 — FEITO, `app/src/app/globals.css`)

| Token | Valor | Uso |
|---|---|---|
| `--bg-primary` | `#0A0A0A` | fundo do app |
| `--surface` | `#121212` | card padrão |
| `--surface-2` | `#1A1A1A` | elevado (hero, dropdown, modal) |
| `--border-subtle` | `rgba(255,255,255,.06)` | borda de card |
| `--border-hover` | `rgba(255,255,255,.1)` | hover (borda, não fundo) |
| `--tick-neutral` | `rgba(255,255,255,.16)` | tique/barra neutra de card |
| `--text-primary/secondary/muted` | `#F5F5F5` / 70% / 40% | textos |
| `--accent-carmim` | `#e23752` | MARCA: menu ativo, avatar, 1 ação primária por tela |
| `--accent-lima` | `#c8ff00` | STATUS sucesso/ganho |
| `--warning` / `--danger` | `#F59E0B` / `#EF4444` | STATUS atenção / perigo |
| `--chart-1/2/3` | branco 85/45/22% | séries de gráfico (neutras) |
| `--chart-accent` | `#e23752` | 1 destaque categórico no máximo |

**Regras:** número de KPI SEMPRE branco (hierarquia = tipografia Kanit, não cor). Cor de status vive num tique fino de 3px à esquerda do card. Funis = rampa de cinza + lima só no estágio de sucesso. Donut/categorias = neutros + 1 acento. Dark mode: profundidade por contraste de superfície + borda (sem sombra colorida — regra da marca). Contraste mínimo AA (4,5:1).

## Componentes (Fase 3 — FEITO nos compartilhados)

- `relatorios/components/kit.tsx`: `Stat`, `HeroBand`, `Secao`, `BarraLinha` — neutros, status por tique. `GRAFICO_CORES` exportada.
- `AlertasCard`: ponto colorido por nível (único lugar com cor de status em série).
- `NotificationDropdown`: sino com tipos novos (negócio ganho, follow-up, no-show, pagamentos) — cor só por status.
- Local (`Kpi`/`HeroKpi` em TabGrowth/TabMarketing/TabMidiaPaga): mesmo tratamento via `STATUS_ACCENTS`.

## Aplicado (Fase 4 — rollout)

- ✅ Relatórios (5 abas): kit neutro, funis em rampa de cinza, donuts com paleta contida, área de leads em linha fina.
- ✅ Dashboard (3 papéis): washes coloridos removidos, superfícies neutras, radar de ações.
- ✅ Notificações: sino já existente ganhou eventos de **negócio ganho** (gestão+responsável, link pro card), **follow-up de proposta** (dono do negócio, dedupe — antes duplicava tarefa pro admin toda hora), boleto falhado/pós-expiração e cobrança recusada (webhook Stripe).

## Inventário da varredura (Fase 1 — achados por tela)

**Financeiro** (pendente de correção):
- Tabela corta colunas na borda direita (Total Pago/Pagamento) sem affordance de scroll; header "TOTAL PAGO" quebra feio.
- Números coloridos sem semântica: "A receber" azul, "Recebido" lima gigante — manter só vermelho (em atraso).
- `R$` quebrando sozinho em linha própria nos KPIs (break no espaço da moeda).
- Nomes longos de cliente truncados sem tooltip.

**Pipeline** (pendente):
- TODOS os cards com borda carmim (decorativa — deveria ser só SLA estourado/status); dilui a atenção.
- Valores "R$ 0" em carmim em todo card; header "R$ 123k" carmim. Trocar por branco; carmim só no botão "Novo Negócio" (ação primária — esse está certo).
- Dots coloridos por coluna (azul/verde/…) → neutro com contagem.

**Relatórios/Dashboard:** reformados nesta rodada (overlap do Investimento×Leads corrigido em 21/07 — caso de regressão mínimo do brief).

**Pendente varredura detalhada:** Contatos, Empresas, Pré-vendas, Propostas, Carteira, Agenda, Contratos, Prospecção, Campanhas, Configurações — mesma caça: contraste < AA, texto sobre badge da mesma família de cor, truncamento sem reticências/tooltip, ícone invisível, hover ilegível.

## Varredura 22/07 — concluída (rodada 2)

- ✅ **Financeiro** — reescrito pela frente paralela já usando o kit (TabVisaoGeral/Clientes/Cobranca/Churn/Faturas/Pabx). Não tocado aqui pra evitar conflito.
- ✅ **Pipeline** — borda vermelha de SLA removida dos cards (estava em TODOS — sinal saturado; o pill vermelho de idade "19d" já carrega a info com precisão); valores carmim → branco (header, card, list view).
- ✅ **Carteira** — MRR estava em VERMELHO (dinheiro positivo em cor de perigo — pior anti-padrão do inventário): KPIs e coluna MRR → branco.
- ✅ **Contratos** — mesmo fix (Receita Recorrente + coluna MRR → branco); "Renovação Próxima" só fica âmbar quando > 0.
- ✅ **Propostas** — KPIs carmim/roxo/lima → branco.
- ✅ **Agenda** — ok (chips carmim = estado de seleção, coerente com menu ativo).
- ✅ Contatos/Empresas — reescritos recentemente (lista/tabela padrão), sem problema crítico na varredura.
- Gauge da Meta Comercial: ✅ feito em 22/07 (semicircular com marcador de ritmo).

**Pendências menores (não críticas):** botão "Salvar disponibilidade" da Agenda com contraste fraco no estado desabilitado; chip "Renova" azul na Carteira (informativo, avaliar se vira neutro); Prospecção/Campanhas/Configurações sem problemas críticos identificados, revisitar quando ganharem uso.

> Restrição do brief: time de 6 pessoas — consistência e legibilidade, não biblioteca enterprise. Nada de variantes além das necessárias.
