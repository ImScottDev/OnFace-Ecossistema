# 23 — DE-PARA DE CUTOVER (modelo antigo → modelo novo canônico)

O mapa "o que vai pra onde" no cutover, extraído dos scripts de backfill `05→16` (a linhagem correta; a SQL `backfill-crm2-domain-model.sql` é antiga, termina em ROLLBACK — ignorar). Números "Fato" de `backfill_provenance`/banco em 23/09. Chave de leitura: **DETERMINÍSTICO** (join por id/chave — seguro) vs **HEURÍSTICO** (match por nome/texto/regra — risco de cutover).

## Mapa por entidade
| Entidade nova | Origem (legado) | Regra | Tipo | Buraco principal |
|---|---|---|---|---|
| **pessoas** (+pessoa_empresa_vinculos) | `leads` (05-identidade.ts) | e-mail→telefone→`lead:id` (nunca nome) | **DET** | 110 `ORIGEM_UNICA` sem e-mail/tel = 1 pessoa por linha (duplicata assumida); nome ausente → "Sem nome" |
| **empresas** | `leads.empresa` (texto) / `empresas` | `resolver-empresa.ts`: CNPJ exato → `ilike(nome)` → **cria nova** | **HEURÍSTICO** | **gera lixo** — sem CNPJ, cada grafia vira empresa nova. Ver §crítico |
| **aquisicoes** (+pontos_contato) | `leads` (06 + 06b) | 1 lead→1 aquisição (DET); tipo/canal por **regex** em `leads.origem` | DET vínculo / **HEUR** tipo | 659 caem em `MANUAL` (não casou); qualificado/desqualificado vazios em prod → estado vem do 06b lendo sdr_status+negócio |
| **oportunidades** (+pipeline_etapas) | `negocios` (07) | 1 negócio→1 oportunidade (DET); `service_family` por cadeia de evidência | DET vínculo / **HEUR** família | **`service_family` NULL em 1094 de 1577 (69%)** = NAO_RESOLVIDO → oferta e pós-venda não atribuídos |
| **propostas/contratos** | já existem (09) | join exato `negocio_id_legado` | **DET** | **408 contratos sem processo comercial** (271 ativos) → invisíveis p/ carteira/metas |
| **clientes** | `leads tipo='cliente'` / runtime | por `lead_id_legado`/`empresa_id` | **DET** | empresas com >1 cliente (viola 1:1); `oportunidade_origem_id` = 1ª por data (atribuição fraca) |
| **servicos_canonicos** | já existe (fonte de MRR) | 10 só religa empresa/oportunidade | **DET** | — |
| **fulfillments** | `servicos_canonicos` ACTIVE | 1 por serviço ativo | **DET** | serviços por reconciliação Zoho nunca ganharam fulfillment; CHURNED/SUPERSEDED nunca ganham (desenho) |
| **faturas + pagamentos** | `faturas` (12) | empresa por cadeia de FKs; pagamento só de fatura PAID c/ data | **DET** | 29 faturas pagas sem empresa + 1 sem data → receita fora do canônico |
| **communications + conversas** | whatsapp/email/ligacoes (13) | pessoa por provenance; thread por telefone/message_id | **DET** | 24.380 de 25.363 WhatsApp sem lead → identidade via `contatos`; comunicação órfã de pessoa entra com pessoa_id NULL |
| **domain_events + timeline_events** | atividades/oportunidades (14-15) | tipo→FATO_DE_NEGOCIO; âncoras por id | **DET** | contradições do legado (ganho+perda no mesmo) → canônico força exclusividade e descarta data residual |
| **cs_marcos / cs_riscos** | **nenhuma** | — | — | **NASCEM VAZIOS** — sem origem; só se preenchem com operação viva pós-cutover |
| **cliente_receita_mensal** | arquivo externo | `importar-receita-mensal-historica.py` (fora da cadeia) | — | não vem de tabela de produção; depende de arquivo-fonte |

## §CRÍTICO — o gerador de empresas-lixo (pré-requisito de cutover)
Cadeia: `api-server/routes/leads.ts:526-536` (+ webhooks site-lead/rd-lead, contatos-unified) passa `leads.empresa` (texto digitado) para `resolver-empresa.ts:33-72`, que casa por CNPJ exato OU `ilike(nome)` inteiro e, se não achar, **cria nova empresa**. Sem normalização/fuzzy → cada grafia ("Acme", "Acme Ltda", "ACME ") vira empresa distinta. Como leads de campanha chegam sem CNPJ, o critério é só o texto sujo.
- Reconciliação do número: os **877 leads Meta** importados hoje no local geraram ~877 empresas de texto livre por esse caminho → local 3.105 vs produção 2.222 (diferença ≈ os leads de teste). Base local: ~2.170 empresas sem CNPJ.
- **Os scripts 05-16 NÃO deduplicam empresa** — herdam `leads.empresa_id` como verdade. Logo, **todo o lixo de empresa entra no canônico intacto**, com pessoas e oportunidades penduradas em empresas duplicadas.
- ⇒ **Dedup de empresas (por CNPJ e nome normalizado) é PRÉ-REQUISITO do cutover que hoje não existe na cadeia.** Vale para produção também (o mesmo mecanismo roda lá há tempo — a base de prod pode já ter lixo acumulado).

## Passos HEURÍSTICOS (os riscos do cutover, por ordem de impacto)
1. Criação de empresa por texto livre (resolver-empresa.ts) — maior gerador de lixo.
2. `service_family` por cadeia — 1094/1577 não resolvem.
3. Classificação de tipo/canal de aquisição por regex — 659 em MANUAL.
4. Tradução de etapa (06b) depende de cópia manual de `sdrBoardColumn` — divergência silenciosa se o original mudar.
5. Dedup de pessoa no dual-write (só e-mail) difere da regra do 05 (e-mail+telefone).

## O que NÃO tem destino (perda/invisibilidade no cutover)
- `service_family` NULL em 1094 oportunidades (dado de produto não recuperável pelo backfill).
- 408 contratos sem processo comercial (271 ativos), 29 faturas pagas sem empresa.
- Colunas de qualificação de leads vazias em produção (estado só via 06b).
- cs_marcos/cs_riscos nascem vazios.
- Datas contraditórias descartadas por exclusividade.
- **Campos de `leads`/`negocios` sem coluna correspondente no canônico** — não auditado 1:1 aqui; **exige diff de schema coluna-a-coluna antes do cutover** (área a validar).

## Pré-requisitos de cutover (derivados) — REGISTRO, não execução
1. **Dedup de empresas** (não existe na cadeia) — senão o canônico nasce poluído.
2. **Resolver os 1094 service_family** (ou aceitar pós-venda não atribuído).
3. **Resolver/decidir os 408 contratos sem processo** e 29 faturas órfãs.
4. **Diff de schema coluna-a-coluna** legado→canônico para achar campos sem destino.
5. **Recuperar assinatura (ZohoSign)** e Lead Status/owner do payload — determinístico (entregável 18).
6. **Definição única de MRR/cliente** antes de materializar (entregável 04 §E).
