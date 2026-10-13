# Classificação de relacionamento: Lead, Contato, Prospect, Cliente (regra do Scott, 13/10/2026)

Uma única função no servidor decide a classificação de pessoa e empresa. Todas as telas usam essa função: lista de Contatos & Empresas, ficha da pessoa, ficha da empresa, Cliente 360, drawers, quadros, busca e NEXO.

| Classe | Quando |
|---|---|
| **Cliente** | É cliente: conta com serviço ativo (pessoa ou empresa). Vence as outras classes. |
| **Lead** | Está em processo comercial com o time: aquisição aberta em Pré-vendas (novo, em contato, qualificação) OU oportunidade aberta no Pipeline. |
| **Prospect** | Está ou entrou em Prospecção (outbound) e ainda não virou lead nem cliente. |
| **Contato** | Existe no ONFACE, não é cliente e não está em jornada comercial ativa: em nutrição, desqualificado (com motivo), perdido no Pipeline (com motivo) ou cadastro avulso. |

## Relações em andamento
Aparecem na pessoa, na empresa e no Cliente 360. Mostram SÓ o que está vivo, cada item com o seu destino:
- **Pré-vendas:** só a aquisição aberta (novo, em contato, qualificação). **Quando a aquisição vira oportunidade (handoff), ela é encerrada como convertida e sai daqui.** Fica só a oportunidade.
- **Oportunidade:** só as abertas (não ganha, não perdida).
- **Proposta:** só as em andamento.
- **Cliente:** acesso ao Cliente 360 quando há serviço ativo.

Nutrição, desqualificado e perdido NÃO são "em andamento". Aparecem na ficha como histórico e estágio, com o motivo, e definem a classe Contato. Não existe nada vivo, então o card fica vazio de verdade, com a ação "Iniciar".
