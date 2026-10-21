# Insights 2.0 — modelo de Performance

Performance é **gestão de pessoas**, não análise de negócio. Por isso fica fora da biblioteca de
Relatórios: a finalidade é diferente, a cadência é diária e o controle de acesso é outro (cada um
vê o seu; gestão vê o time).

Estado hoje: `app/src/app/(produto)/relatorios/performance/page.tsx` é um server component com
tabela HTML, alimentado por `app/src/lib/relatorios/performance.ts`. Não tem gráfico, não passa
pelo catálogo e não tem endpoint próprio.

---

## 1. A regra que governa este modelo

**Papéis diferentes não se comparam pela mesma régua.** Um SDR que agenda 40 reuniões e um closer
que fecha 3 contratos não cabem na mesma coluna de "resultado", e colocá-los na mesma tabela
ordenada por faturamento diz uma falsidade sobre os dois.

Decorre daí:

- Cada papel tem **seu próprio conjunto** de indicadores.
- Ranking só existe **dentro** do papel, e só com denominador válido e amostra suficiente.
- **Esforço e resultado ficam separados** e visíveis lado a lado: olhar só resultado esconde quem
  trabalha sem converter; olhar só esforço esconde quem converte com pouco volume. (O
  `performance.ts` atual já acerta nisso e a regra se preserva.)

## 2. O papel vem do evento, não do cadastro

`usuarios.role` **não é fonte confiável** para "quem fez o quê, quando". O time foi reorganizado
depois de julho/2026: a SDR real do período hoje tem papel `gerente`, e closers aparecem como
responsáveis de lead por terem feito qualificação direta. Isso já está documentado em
`app/src/lib/relatorios/fechamento-comercial.ts`.

A fonte histórica é **`status_changes`**: quem executou a transição, no instante em que ela
aconteceu. O cadastro atual serve para saber quem ver na tela hoje; o histórico de atribuição sai do
evento.

Papéis no banco (2026-10-21): `gerente` 7 · `admin` 7 · `sdr` 3 · `super_admin` 2 · `closer` 2 —
21 pessoas, 20 ativas. **Com 3 SDRs e 2 closers, qualquer ranking é amostra pequena.** A tela deve
dizer isso em vez de ordenar como se fosse campeonato.

## 3. Réguas por papel

### SDR / Pré-vendas

| | Indicador | Fonte | Cobertura |
|---|---|---|---|
| Esforço | Ligações, minutos | `ligacoes` | ok |
| Esforço | Mensagens enviadas | `whatsapp_mensagens` | ok — sem `organizacao_id`, tenant entra pela lista de usuários |
| Esforço | Notas, mudanças de etapa | `notas`, `status_changes` | ok |
| Qualidade | Contato efetivo, tempo até o 1º contato (mediana, p90) | `leads.primeiro_contato_at` | **221 de 1.207 leads (18%)** — não publicar como SLA |
| Resultado | Reuniões agendadas | `status_changes` → `reuniao_agendada` no lead dela | ok |
| Resultado | Comparecimento / no-show | `reunioes` | a confirmar |
| Resultado | Qualificados, passagem ao comercial | `status_changes` | ok |
| Resultado | Venda atribuída ao SDR | primeiro evento de agendamento (`fechamento-comercial.ts`) | ok, com evidência por linha |

**Não medir SDR por faturamento fechado.** A venda é do closer; a contribuição do SDR é a reunião
que a originou, e ela já tem atribuição rastreável.

### Closer / Comercial

| | Indicador | Fonte | Cobertura |
|---|---|---|---|
| Esforço | Atividades, reuniões realizadas | `ligacoes`, `notas`, `status_changes` | ok |
| Qualidade | Oportunidades sem próxima ação, aging do pipeline | `oportunidades`, `tarefas` | ok |
| Resultado | Booking (recorrente + setup) | `decomporVenda` sobre `negocios` | ok |
| Resultado | Win rate | ganhos / (ganhos + perdidos) por **evento de decisão** | amostra pequena: 2 closers |
| Resultado | Ciclo de venda, ticket médio | `ganho_at` − criação | ok |
| Resultado | Atingimento de meta | `metas` | **meta cadastrada é `mrr_fechado`, booking inclui setup — não comparáveis** |

**Perdidos contam pelo evento de perda na janela**, não por coorte de criação. (O `performance.ts`
atual já faz assim.)

### Atendimento

Volume e fila por canal e número, primeira resposta, resolução, reabertura, conversa sem
responsável, separação humano/agente. **Fonte existe** (`whatsapp_mensagens`, conversas), mas o
módulo de Atendimento é de outra frente — entra aqui por leitura, sem refatorar nada lá.

### Gestão

Visão agregada do time com as réguas acima **preservadas por papel**, nunca somadas numa só coluna.
Mais: distribuição de carga, pessoas sem movimento na janela, tarefas vencidas por pessoa.

## 4. O que não medir

- **Produtividade por número de mensagens.** Volume de mensagem não é trabalho entregue.
- **Horas economizadas por automação** sem baseline medido.
- **Ranking cruzando papéis.**
- **Ranking com amostra pequena** sem dizer o tamanho da amostra.
- **SLA de primeiro contato como se fosse contratual** — 18% de cobertura não sustenta.

## 5. Arquitetura-alvo

Performance passa a ter contrato próprio, no mesmo padrão do resto do módulo:

```
GET /api/relatorios/performance?periodo=&papel=&usuarioId=&equipe=
  → { periodo, janela, papel, pessoas: [{ usuarioId, nome, papelNoPeriodo,
       esforco: Cartao[], qualidade: Cartao[], resultado: Cartao[] }],
      cobertura, lacunas }
```

Mesmas garantias do painel: `Cartao` com estado honesto, `drill` emitido pelo servidor, ausência
nunca virando zero, gate por papel aplicado no servidor (`isPersonalView` → só o próprio recorte).

A migração preserva as réguas já documentadas em `performance.ts` — elas foram conferidas contra as
rotas do Hono de propósito, para a tela de Performance bater com a aba Comercial.

## 6. Pendências

- `usuarios.role` como fonte de papel histórico: substituir por atribuição vinda de evento.
- `leads.primeiro_contato_at` com 18% de cobertura: instrumentar a porta de escrita (é frente de
  Pré-vendas, fora de Insights) antes de publicar qualquer tempo de resposta.
- Metas por papel: hoje só existe `mrr_fechado`, tipo aposentado.
- Comparecimento/no-show: confirmar cobertura de `reunioes`.
- Separar o que hoje está em "Atividade do time" entre Performance (esforço por pessoa) e Operação
  e Atendimento (fila e canal).
