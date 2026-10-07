# Auditoria WEVY x CRM Callface — Reconciliação PABX/CallFace AI

Auditoria 100% read-only (nenhum INSERT/UPDATE/DELETE/DDL executado, nenhum CSV original alterado).
Data da auditoria: 2026-08-12. Fonte CRM: HOMOLOG (`callface-crm-homolog-postgres`, tem CNPJ recuperado
do Zoho) para o cadastro `empresas`; PROD (`callface-crm-postgres`) e HOMOLOG para `contratos`/`negocios`,
comparados lado a lado (ver metodologia).

## Fontes

| Arquivo | Linhas com dado real | Tem CNPJ? | Tem valor? |
|---|---|---|---|
| `Churns Callface - PABX(Churns).csv` | 21 (todas Business Line = `CALL FACE - CLOUD/PABX`, OBS=`Churn`) | Não | Sim (série mensal Jan-Jun/2026) |
| `PLANO 2026(FATURAMENTO).csv` | 997 linhas → 433 linhas com CNPJ válido → 252 CNPJs distintos (o resto são linhas vazias no export) | Sim | Sim (lançamentos de fatura, todos com `Data de Emissao` em 05/2026 — é um snapshot de um único mês, maio/2026) |
| `PLANO 2026(CONTRATOS ).csv` | 999 linhas → 183 com Razão Social preenchida (resto vazio) | Não | Não (só registro de contrato/prazo/término) |

Universo unificado (dedup por CNPJ, depois por nome normalizado): **359 empresas WEVY**.

## Metodologia de cruzamento

1. CNPJ normalizado (só dígitos) é o critério primário — só existe no arquivo de Faturamento.
2. Nome exato normalizado (remove acento, pontuação, sufixos LTDA/SA/EIRELI/ME) como segundo critério.
3. Fallback fuzzy por sobreposição de tokens distintivos (Jaccard, ancorado em pelo menos um token
   não-genérico) — necessário porque o nome da WEVY é a razão social completa e o `empresas.nome` do
   CRM é frequentemente um nome fantasia abreviado (ex: `GRUPO RI HAPPY` vs `RI HAPPY BRINQUEDOS SA`,
   `AGUAPEI` vs `AGUAPEI AGROENERGIA SA`). Threshold e stoplist de termos genéricos calibrados
   manualmente contra ~90 casos revisados um a um para eliminar falsos positivos (ex: sobrenomes comuns,
   nomes de cidade, termos de negócio genéricos como "TECNOLOGIA"/"MARKETING"/"SEGUROS").
4. **Limitação conhecida**: mesmo após a calibração, o fuzzy match por nome (31 casos, ~9% do total)
   tem confiança média — recomendo revisão manual pontual antes de qualquer ação de cobrança/billing
   baseada nele. Os matches por CNPJ exato (192 casos) e nome exato (24 casos) são de alta confiança.
5. Para `contratos`/`negocios`, o join usa `contratos.lead_id → leads.empresa_id` (sempre preenchido)
   com fallback em `contratos.negocio_id → negocios.empresa_id` (~45-55% nulo nas duas bases).
6. PROD e HOMOLOG têm os mesmos UUIDs de `empresas` para os registros que já existiam antes do recovery
   Zoho (confirmado: os 1.560 IDs de `empresas` do PROD são um subconjunto exato dos 1.716 do HOMOLOG),
   então dá pra comparar contrato por `empresa_id` diretamente entre as duas bases.

## Resultado do cruzamento (359 empresas WEVY)

| Confiança | Qtd |
|---|---|
| `cnpj_exact` | 192 |
| `nome_exact` | 24 |
| `nome_fuzzy_editdist` (alta similaridade de string) | 7 |
| `nome_fuzzy_token` (média confiança, revisar) | 31 |
| **Total encontrado no CRM** | **254 (70,8%)** |
| **Não encontrado em nenhuma base (nem HOMOLOG nem PROD)** | **105 (29,2%)**, somando R$ 33.232,74/mês em faturamento real (fonte Faturamento) — clientes possivelmente só-WEVY, nunca migrados/cadastrados no CRM. |

## Achado principal: PABX via WEVY não aparece como `contratos` no CRM (estrutural, não é 1 bug isolado)

Das 210 empresas que têm linha real de faturamento (maio/2026) na WEVY **e** foram encontradas no
cadastro `empresas` do CRM:

- Soma do faturamento WEVY (maio/2026) dessas empresas: **R$ 378.659,62/mês**
- Soma do MRR `ativo` que aparece em `contratos` no **PROD** para essas mesmas empresas: **R$ 32.666,89/mês**
- **175 dessas 210 empresas (83%) têm o registro `empresas` no CRM mas ZERO linha em `contratos` — nem
  em PROD nem em HOMOLOG.** Isso soma **R$ 361.040,14/mês de faturamento WEVY sem qualquer contrato
  correspondente no CRM.**

Interpretação: o PABX faturado pela WEVY historicamente não foi migrado como `contratos` no CRM na
maioria dos casos — só uma fração pequena (contratos legados importados do Zoho) tem representação.
Isso não é necessariamente "erro" pontual, é lacuna estrutural de dados: o CRM não tem visibilidade do
MRR real de PABX pra ~83% da base que ainda fatura assim. Isso limita qualquer dashboard de MRR/churn
que hoje só olhe `contratos` no CRM — está sistematicamente subestimando o PABX.

## Achado 2: gaps de churn confirmados (empresa churnou na WEVY, contrato no CRM não reflete)

Das 20 empresas com `OBS=Churn` na planilha de churns (Jan-Jun/2026; nota: essa janela é histórica,
não prova o estado de agosto/2026 por si só — o estado atual foi confirmado consultando PROD/HOMOLOG
diretamente, não inferido da planilha):

| Categoria | Qtd | Observação |
|---|---|---|
| Empresa não existe em nenhuma base do CRM | 12 | Nunca migrada — não dá pra confirmar/negar status |
| Empresa existe, mas sem nenhum contrato (PROD e HOMOLOG) | 5 | Sem contrato pra confirmar/negar |
| **Gap real confirmado**: contrato `ativo` em HOMOLOG (legado Zoho, criado em 2024/2025) mesmo após churn na WEVY; **PROD nem tem o contrato** | **6** | Ver lista abaixo |
| Contrato PROD `ativo` contradizendo churn direto | 0 | Nenhum caso — PROD nunca mostrou "ativo" pra quem churnou |

**As 6 empresas do gap confirmado** (nome WEVY → status HOMOLOG → MRR homolog vs último valor WEVY):
- TOZZINI FREIRE TEIXEIRA E SILVA ADVOGADOS → `ativo` (R$ 7.659,31) — churnou em 2026-M01 faturando R$ 21.395–34.173/mês na WEVY
- RI HAPPY BRINQUEDOS SA → `ativo` — match por nome fuzzy, confiança média, revisar
- 1º TABELIÃO DE NOTAS DA COMARCA DE CAMPINAS → `ativo` (R$ 1.264,90 ≈ R$ 1.333 WEVY, quase idêntico)
- GBPA TECNOLOGIA DA INFORMAÇÃO LTDA → `ativo` (R$ 1.202,00 = R$ 1.202,00 WEVY, valor idêntico)
- S2B SOFTWARE LTDA → `ativo` (R$ 299,90 ≈ R$ 315 WEVY)
- TUDOR CAMPINAS BATERIAS LTDA → `ativo` (match por nome fuzzy, confiança média)

Esses contratos são todos `produto=legado_zoho`, criados em 2024/2025, e nunca foram atualizados para
`churned` depois que o cliente parou de pagar a WEVY. **Importante**: esse contrato só existe em
HOMOLOG (recovery Zoho ainda não promovido pra PROD, conforme já registrado no histórico do projeto).
Em PROD hoje esses 6 clientes não têm contrato nenhum — ou seja, o gap "ativo indevido" só vai
aparecer de fato pros usuários quando o recovery for promovido. **Recomendação prática: antes de
promover o batch de recovery Zoho de HOMOLOG para PROD, rodar uma passada de `motivo_churn`/status
nesses (e potencialmente outros) contratos legados usando a planilha de churns da WEVY como fonte —
senão o gap vai "nascer" em produção no dia da promoção.**

## Números-chave (resumo executivo)

- **359** empresas únicas nas 3 planilhas WEVY.
- **254 (71%)** cruzaram com o CRM (192 por CNPJ exato = alta confiança).
- **105 (29%)**, R$ 33.232,74/mês, não existem em nenhuma base do CRM — candidatas a "cliente
  só-WEVY nunca migrado".
- **R$ 361.040,14/mês** de faturamento WEVY (maio/2026) de empresas que EXISTEM no CRM mas não têm
  contrato nenhum lá — o CRM não vê esse MRR de PABX.
- **6 churns confirmados da WEVY que ainda aparecem `ativo` no CRM** (só em HOMOLOG, não promovido pra
  PROD) — risco de virar gap real em produção se o recovery for promovido sem correção prévia.
- **0 casos** em que PROD mostrava `ativo` contradizendo diretamente um churn da WEVY — o gap de churn
  hoje está contido em HOMOLOG, não em produção viva.

## Arquivos gerados
- `wevy-reconciliation.csv` — 359 linhas, uma por empresa WEVY, com todas as colunas pedidas.
- Este arquivo (`wevy-reconciliation-summary.md`).
