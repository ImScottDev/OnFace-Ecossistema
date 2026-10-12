# Zoho → clientes pagantes: por que os contratos não aparecem vinculados

Somente leitura, banco local (cópia de produção de 06/10), 12/10/2026. SQL em `depara/*.sql`; saídas em `db-export/2026-10-12/relatorios/depara/` (fora do Git, têm nome e CNPJ). "Pagante" = empresa com MRR na última competência fechada (09/2026): 291 empresas, mais 32 linhas MRR (R$ 9.289,70) sem empresa.

## O que foi provado

| Fato | Número |
|---|---|
| Empresas pagantes (MRR 09/2026) | 291 |
| ... com algum contrato no CRM | 100 |
| ... com contrato originado do Zoho (`zoho_id`) | 67 |
| ... sem nenhum contrato | 191 (R$ 286.688,61 de R$ 467.124,79 de MRR) |
| ... sem contrato e sem documento assinado no negócio | 165 |
| ... com serviço canônico ativo | 290 |
| ... com assinatura Stripe | 61 (230 sem) |
| ... com fatura no CRM | 95 |
| Contratos no CRM | 443 (270 com `zoho_id`) |
| Contratos com PDF assinado importado | 202 (1.152 arquivos), todos com `zoho_id` |
| Anexos legados no banco | 1.980 (as pastas do Mac têm 1.752 PDFs) |

A cadeia **contrato → empresa → serviço → pagador → fatura** quebra em lugares diferentes, não num só:

1. **Faltam contratos, não vínculos (o maior).** 191 das 291 pagantes não têm contrato no CRM. O contrato do Zoho nunca foi migrado como `contratos` para elas. As planilhas de faturamento ligam a empresa por CNPJ (todas as 12.041 linhas têm `empresa_match = cnpj`); o contrato nunca entrou nessa cadeia.
2. **Contrato aponta para a empresa errada quando titular e pagador são partes diferentes (22 contratos).** `FACILITA TELECOM` (CNPJ 13.045.960/0001-10) tem 19 contratos ativos com PDF assinado, mas o negócio de cada um aponta `MAIS TECNOLOGIA`, que é quem paga. `SAFFE ASSIST` tem 3 contratos cujo negócio aponta `CONCESSIONARIA RIO PAX` e `RIO PAX DO CENTRO`. Isso é parceiro/revenda (titular contratual) e cliente final (pagador), e não duplicidade de empresa: não há nenhum CNPJ duplicado em `empresas`.
3. **Contrato sem empresa (38 contratos).** 6 têm negócio com empresa (proposta segura, 1 é `[QA]`); 32 não têm nenhum indício e precisam de revisão humana.
4. **Contrato ativo cuja empresa não paga (161; 184 contas antes da separação).** 49 nem têm CNPJ na empresa; 0 têm CNPJ no faturamento de setembro; 0 mesma raiz de CNPJ (filial) com faturamento. 69 empresas nunca faturaram MRR; 27 faturaram alguma vez. 52 têm fatura no CRM e 18 assinatura Stripe ativa: parte paga por Stripe (Callface AI), fora das planilhas (que são só da entidade CallFace). Não é prova de churn nem de erro.
5. **32 linhas de MRR (R$ 9.289,70) sem empresa**: 14 documentos CPF (11 dígitos, R$ 5.182,50) e 18 CNPJ (R$ 4.107,20) que não existem em `empresas`. Sem empresa cadastrada para esse documento, nada a vincular; ficam na fila de cadastro.

## Classes do De/Para (`contratos-depara.csv`)

A 206 (empresa do contrato paga) · B1 22 (diverge e a do negócio paga) · B2 2 · C1 6 (sem empresa, negócio indica) · C0 32 (sem empresa, sem indício) · D 14 (encerrado, não paga: esperado) · E 161 (ativo, não paga, sem indício).

## Decisões de negócio que travam correção (nenhuma foi aplicada)

- **D1, titular x pagador (22 contratos B1).** Mover o `empresa_id` do contrato para a pagante esconderia que o titular é Facilita Telecom/Saffe. Alternativas: (a) manter o titular no contrato e ligar a pagante por um campo de pagador (migration aditiva, recomendada); (b) mover o contrato para a pagante e registrar o parceiro como origem; (c) não mexer e tratar os dois como grupo comercial (`grupo_comercial_id` já existe em contratos e faturas).
- **D2, 6 contratos C1.** Setar `empresa_id` a partir do negócio (5 reais). Recomendado aplicar com registro em `billing_correction_ledger`, depois de você ver a lista.
- **D3, 32 documentos sem empresa.** Criar empresa a partir do documento da planilha (nome da planilha) ou deixar na fila. Não há merge por nome.
- **D4, Business Line PLATAFORM.** No banco, 286 linhas viraram `CALLFACE_AI`, mas o carregador documenta PLATAFORM como UNKNOWN (sem de/para oficial). Confirmar "PLATAFORM = Callface AI" antes de relatório por família.

## Aplicação (quando aprovada)
Usar `billing_audit_runs` (run), `billing_correction_ledger` (antes/depois, regra, reversível) e `billing_resolution_cases` (fila). Hoje as três estão vazias: a infraestrutura de auditoria existe e nunca foi usada para o Zoho.
