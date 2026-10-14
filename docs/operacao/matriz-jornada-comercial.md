# Matriz da jornada comercial — homologação

Objetivo: fechar, testar e **comprovar** a jornada comercial inteira em homologação,
sem promover para produção antes do aceite do Scott.

**Regra de conclusão (dele, e vale para toda linha desta matriz):** nada é "concluído"
por ter código, commit ou typecheck verde. Só conta quando **a ação inicial produz o
resultado final correto** — valores, estados, vínculos, responsáveis, metas, eventos e
ausência de duplicação.

Referência de homologação: **JOAO PTDA**. Nenhuma mensagem, contrato ou cobrança real
para destinatário de verdade.

## Situação por cenário

| # | Cenário | Esperado | Observado | Evidência | Commit | SHA homologado | Situação |
|---|---|---|---|---|---|---|---|
| 1 | Proposta: criar, enviar, aceitar, recusar, ajustar | Estados corretos, condições persistidas, PDF e página pública coerentes | Aceite/recusa e condições validados na Fase 0 | validacao-fase-0.md | 2a4ec8d | 2a4ec8d | parcial — falta recusa e ajuste |
| 2 | Contrato e Documenso | Gera, envia, assina, volta ao ONFACE com cópia e registro | Gera e envia provado; **assinatura em dois pontos relatada pelo dono** | em apuração | 975db8e | 541f8cd | **em apuração** |
| 3 | Estados e retomadas sem resposta falsa | Falha aparece; retomar não duplica | Retomada provada; e-mail recusado aparece | validacao-fase-0.md | 2a4ec8d | 2a4ec8d | comprovado |
| 4 | Ganho → valores → meta e faturamento | mrr_fechado e valor_setup gravados no Ganho | Corrigido; **6 ganhos antigos do JOAO seguem vazios** | a reconciliar | 541f8cd | 541f8cd | **pendente de reconciliação** |
| 5 | Pós-venda: um processo por venda | **Uma jornada principal por venda**, com trilhas por família | Entregue "uma por venda **e família**" — diverge da decisão | 1508bb3 | 1508bb3 | — | **a corrigir** |
| 6 | Histórico de entregas | Entregas antigas consolidadas | 12 entregas não iniciadas para JOAO; histórico não consolidado | — | — | — | **pendente** |
| 7 | Serviços sem vínculo | Agrupamento sabe lidar com serviço sem venda | 448 de 508 sem oportunidade nem contrato | — | — | — | **a investigar** |
| 8 | Upgrade, downgrade, cross-sell, renovação | Upgrade substitui; cross-sell soma; renovação não duplica | Só estudo escrito; nada implementado | upgrade-e-cross-sell.md | — | — | **não implementado** |
| 9 | White Label fim a fim | Implantação única, contrato, cobrança, licença por ativação | Catálogo e grupo corrigidos; licença por ativação depende de integração | — | 975db8e | 541f8cd | parcial |
| 10 | Reconciliação do legado | Família, valores, evidência, responsável, datas preservadas | Script escrito, **não executado** | 1423e0c | 1423e0c | — | **não executado** |
| 11 | Eventos no n8n | Evento real do ONFACE chega e é idempotente | Barramento provado com evento sintético; **falta evento real** | — | 77460f9 | 541f8cd | **a comprovar** |
| 12 | Sincronismos Callface AI | Parceiro, licença, fatura e retrato espelhados | Tabelas criadas e **vazias**: sync nunca rodou | — | 864ea2b | 541f8cd | **a comprovar** |

## Regra esclarecida pelo Scott (13/10/2026): não existe venda mista

> "na real nem existe venda mista. Se uma oportunidade contempla apenas uma família,
> então não tem venda mista."

Com isso, **uma entrega por venda e família É uma entrega por venda**, e o que o commit
`1508bb3` entregou está correto. O board duplo que eu temia não acontece numa venda
legítima.

**Mas o dado discorda da regra, e isso vira trabalho:**

| Combinação | Propostas |
|---|---:|
| Callface AI + PABX | 40 |
| Callface AI + White Label | 6 |
| PABX + White Label | 2 |
| **Total** | **48** |

Pela regra, essas 48 são **erro de cadastro do histórico**, não venda legítima. Entram
na reconciliação do legado (cenário 10), não na mudança da regra.

**Melhoria que isso revela:** nada hoje impede uma oportunidade de receber itens de
famílias diferentes. O sistema aceita calado e só o pós-venda descobre. Vale uma trava
na criação da oportunidade — proposta, não feita.
