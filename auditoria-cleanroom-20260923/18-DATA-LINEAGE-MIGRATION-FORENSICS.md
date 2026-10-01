# 18 — DATA LINEAGE & MIGRATION FORENSICS (Zoho → CRM Callface → CRM 2.0/canônico → ONFACE)

Execução: 23/09/2026, somente leitura. Bases: `callface_crm` (fresca, migração 0090) e `callface_crm_pre_carga_20260920`. Export Zoho: `/Users/Scott/Downloads/Data_001/` (CSVs) + `/Users/Scott/Downloads/Attachments/` (1.980 PDFs). Convenção: [FATO] medido nesta sessão · [INFERÊNCIA] · [ALEGAÇÃO] (auditoria de 02/09, não é prova).

## Sumário
[FATO] Cutoff do Zoho = **2026-08-10 ~15:15** (ORG 830405635, `kaua.araujo@callface.ai`). Migração em duas ondas: **01/07/2026** (empresas/leads) e **11–12/08/2026** (contratos, propostas, notas, anexos).

**A migração é forte em identidade/valores, fraca em estado/vínculos:**
| Dimensão | Veredicto |
|---|---|
| IDs/rastreabilidade | Forte: `zoho_id` em 8 tabelas + `legacy_provenance` (5.064) + `campos_custom` com payload Zoho bruto |
| Nomes e created_at | Fidelidade quase perfeita (12/12 empresas, 12/12 negócios) |
| Valores | 9/12 contratos, 11/12 propostas, 11/12 negócios batem |
| Owner/responsável | **Degradado** — 38 usuários Zoho → 16; fallback `growth@callface.ai` em 1.680 registros |
| Stage/Status | **Fortemente degradado** — `Lead Status` 100% perdido; `Contratos.Status` colapsado em `ativo`; mapa de `Stage` inconsistente |
| Vínculo empresa↔negócio↔proposta | **Quebrado em massa** — 16,2% negócios e 27,6% propostas legadas sem empresa_id |
| Assinatura eletrônica (ZohoSign) | **100% perdida** — 178 Signed no Zoho, 0 no banco |
| Ponte Zoho↔Stripe (contrato) | **Inexistente** — interseção exatamente 0 |

## Export Zoho (A)
[FATO] 32 CSVs / 34.990 registros (parser CSV real). Principais: Accounts 1.102 (67 col), Contacts 2.267, Leads 971, Deals 1.551, Contratos 279, Propostas 1.067, Itens Cotados 1.876, Itens Solicitados 487, Invoices 123 (até jun/2025), Products 274, Users 38, Notes 4.560, Attachments 1.980, Stage History 6.428, **ZohoSign Documents 368 (178 Signed)**, ZohoSign Recipients 1.257, Calls 414, Meetings 382, Tasks 510.

## Cobertura no banco (B)
[FATO] Descoberta estrutural: `contatos` NÃO é destino dos Zoho Contacts (é inbox omnichannel, 0 zoho_id); Contacts foram para `leads` com `tipo='contato'`.

| Módulo | Export | Destino | Cobertura |
|---|---:|---|---:|
| Empresas | 1.102 | empresas | **99,7%** (1.099) |
| Contacts | 2.267 | leads(contato) | 92,5% |
| Leads | 971 | leads(lead) | **54,9%** |
| Oportunidades | 1.551 | negocios (+eventos_comerciais) | 79,9% → 90,9% combinado |
| Contratos | 279 | contratos | **94,6%** (264) |
| Propostas | 1.067 | propostas via legacy_provenance | 98,5% |
| Itens Solicitados | 487 | contrato_itens | 100% |
| Invoiced Items | 226 | fatura_itens | 100% |
| Attachments | 1.980 | anexos_legado | 100% |
| Itens Cotados | 1.876 | proposta_itens | 23,9% |
| Users | 38 | usuarios | 42,1% |
| Products / Stage History / Calls / Meetings / Tasks / Emails | — | sem zoho_id | **não rastreável** |
| ZohoSign Docs/Recipients/Events | 368/1.257/547 | — | **0%** |

[FATO] O refactor de 20/09 NÃO perdeu linhagem (só adicionou registros nativos). Único delta: 1 lead com zoho_id sumiu entre 20/09 e hoje.

## Fidelidade (C) — placares
- Empresas: 12/12 nome+CNPJ+created_at OK. `empresas` **não tem coluna de owner** → `Proprietário` do Zoho perdido 100%. `updated_at` = data de ETL, não a modificação Zoho.
- Negócios: nome 12/12, montante 11/12, empresa 8/12, **owner substituído por growth@ em 3/12**. Mapa `Stage`→status inconsistente (Closed Won cai em `ganho/ganho` 406 E `ativo/entrada` 52).
- Contratos: valor 9/12; **`prazo_meses` 0/270**, **`codigo_legado` 0/270**, status colapsado em `ativo` (268)+`cancelado`(2); `assinatura_legado_zoho` 0/745.
- Propostas: `contrato_id` 1/1.050 (0,1%); prazo 0; numeração PPA não preservada; mapa de estágio com inversões (`Closed Lost→aceita` 2, rótulos crus vazados no enum).
- Contacts/Leads: bug de nome duplicado ("Gabriel Gabriel Moreno") — artefato de ETL (nome=split do sobrenome); **Lead Status 100% achatado em 'novo'** (2.677/2.677). Mitigação: `leads.campos_custom` preserva payload Zoho bruto (owner real, timestamps) em 2.449/2.677 → owner recuperável por backfill; Lead Status não está no payload.

## Perdas (D)
- Empresas 3 · Contratos 15 (inclui **CT-219 BAITZ `Assinado`** — perda sem justificativa; e 3 de valor negativo/churn; e 2 pós-cutoff) · Propostas 16 (15 de jul/ago-2026, 4 `Proposta Ganha`) · Contacts 170 (pós-cutoff) · **Leads 438 (45,1%; 426 `Não Trabalhado` mas 8 `Qualificado`)** · Oportunidades perda real 141 = **R$ 243.388,46** (46 Perdido, 37 Concluído, 7 Contrato…); [FATO] nenhuma existia no pre_carga → perda na migração ORIGINAL (ago/2026), não no refactor.
- [FATO] 49 `zoho_id` órfãos no banco (47 leads, 1 empresa, 1 contrato) sem correspondente no export → [INFERÊNCIA] houve ≥2 extrações Zoho.

## Cutoff e drift (E)
[FATO] created_at reproduz fielmente a criação Zoho; **updated_at NÃO** reproduz a modificação Zoho (é data de ETL). Módulo Leads só tem registros ≥ 26/03/2026; Invoices param em jun/2025 (faturamento saiu do Zoho 14 meses antes).
[INFERÊNCIA] **44 dias de drift operacional (11/08→23/09)** tornam divergências de status/valor indistinguíveis de erro de ETL — `status_changes` (6.012) tem zoho_id 100% nulo. **Este é o limite metodológico central.**

## PABX/Stripe (F) — dois universos comerciais paralelos
[FATO] Export Zoho não tem NENHUM id Stripe. Disjunção total no nível de contrato:
- contratos COM zoho_id: 270, com stripe_subscription_id: **0**
- contratos SEM zoho_id: 475, com stripe_subscription_id: **418** (todos ≥ 01/07/2026)
- Ponte só no nível de empresa (73) e lead (95).
[INFERÊNCIA] PABX/Zoho legado (270 contratos, faturado por fora) vs Callface AI/Stripe (418 nativos). **O MRR PABX não tem contraparte transacional no banco.**

### F.1 ZohoSign — perda 100%, reparável (achado mais grave e mais fácil)
[FATO] 178 documentos `Signed` no Zoho; `Module Record ID` casa com `contratos.zoho_id` em 295 (158 dos Signed). No banco: `signature_provider/status/assinado_em/documento_final_url` = 0 em TODOS os 745 contratos. **597 contratos ativos, 597 sem evidência de assinatura.** Recuperável de forma determinística via `ZohoSign Documents_C_001.csv`; PDFs já em `anexos_legado`.

## Auditoria de 02/09 (G) — confronto
[FATO] É pacote de diagnóstico read-only (XLSX + scripts com dry-run default e allowlist), não migrador. `billing_correction_ledger`/`billing_audit_runs`/`billing_resolution_cases` vazias → [INFERÊNCIA] o `--apply` provavelmente nunca rodou pelo caminho previsto.
Confrontos-chave: contagens de CSV **CONFIRMADAS**; MRR canônico ativo 426.619,39 **CONFIRMADO e ainda válido**; ZohoSign 178 Signed **CONFIRMADO**; "match contratos×Zoho = 0" **REFUTADA hoje** (94,6%); "257 contratos ativos sem assinatura" **SUBESTIMADA** (hoje 597); "clientes vazia" **SUPERADA** (275 linhas). Alegações financeiras externas (jul 445.375,74 / ago 435.626,64, caso Trevisan) **NÃO CONFRONTADAS** (fontes fora do escopo).

## O que NÃO foi possível provar (I)
ETL-vs-drift em status/valor; fidelidade registro-a-registro de faturas (sem zoho_id); destino de ~20.000 registros de Products/Calls/Meetings/Tasks/Emails/Stage History/históricos (sem zoho_id); se Itens Cotados foram perdidos ou recriados; origem dos 49 órfãos; separação perda intencional×acidental; alegações financeiras externas; se o apply de 02/09 rodou; decomposição de MRR por família; **onde o "ONFACE" vive na cadeia** (não há tabela/coluna onface no banco — a última perna é a camada canônica interna: pessoas 3.986, oportunidades 1.577, servicos_canonicos 439, rastreada por backfill_provenance 10.585).

## Reparos determinísticos possíveis (J) — REGISTRO, não execução
1. Restaurar ZohoSign (158 matches, risco nulo) — derruba P0 de assinatura. 2. Restaurar escalares perdidos (prazo_meses, codigo_legado, multa, setup em contratos; prazo+número em propostas). 3. Reparar empresa_id (201 negócios + 290 propostas, join por ID). 4. Reparar proposta.contrato_id. 5. Restaurar owner real de campos_custom (2.449). 6. Corrigir bug de nome duplicado. 7. Reconstituir Lead Status. 8. Decidir sobre 141 oportunidades perdidas + CT-219 Assinado + 16 propostas jul/ago. 9. Criar zoho_id em propostas/faturas/produtos. 10. Investigar 49 órfãos.

Nível de evidência: dados ≤20/09 espelham PRODUÇÃO (histórico); alterações locais posteriores podem ser teste. Nenhuma escrita, nenhum DDL/DML, nenhum zip extraído.
