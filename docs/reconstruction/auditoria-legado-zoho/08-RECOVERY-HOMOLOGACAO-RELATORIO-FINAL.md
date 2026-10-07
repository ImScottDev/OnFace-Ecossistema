# Recovery de Dados em Homologação — Relatório Final de Reconciliação / Go-No-Go

> Execução dos 5 lotes definidos no ADR-FASE3-RECOVERY-ARCHITECTURE.md, sinal verde do Kauã em 12/08/2026. **Nenhuma escrita em produção em nenhum momento.** Cada lote teve backup de segurança de homologação antes de aplicar (`_backups/pre_batchN_*.dump` no servidor), aplicado dentro de transação (`BEGIN...COMMIT`, revertido automaticamente em caso de erro — usado 2x nesta execução).

---

## 0. Resumo executivo

| Lote | Escopo | Status |
|---|---|---|
| 1 | Companies/Leads/Opportunities | ✅ Aplicado e validado |
| 2 | Contracts + Contract Items + Commercial Events | ✅ Aplicado e validado |
| 3 | Proposals/Invoices | ✅ Aplicado e validado (com limitação de escopo documentada) |
| 4 | Notes/Activities/ZohoSign | ✅ Aplicado e validado |
| 5 | Attachments (metadado + binário) | ✅ Aplicado — ver seção 5 |

**4 achados que pedem decisão/atenção do Kauã antes de ir pra produção**, além do bloqueio já registrado no ADR (fix de duplicação Stripe ausente em produção):

1. **852 Propostas do Zoho ficaram fora de escopo deste recovery** (seção 3) — não por serem irrelevantes, mas porque o método de correspondência por valor+data (usado como plano A) provou ser pouco confiável nesta mesma execução (deu 1044/1067 de match, muito acima do 591/1067 já validado na fase 1) e eu não decidi na base de um heurístico que já provou falhar. Ficaram de fora do recovery até haver um método melhor.
2. **Backup do diretório de anexos** (`public/uploads/legado-zoho/`) — confirmei que é persistente entre deploys (bind mount, não é sobrescrito por redeploy), mas **não está coberto por nenhuma rotina de backup existente hoje**. O 1,1GB de documento (majoritariamente assinado, juridicamente relevante) fica sem redundância além do ZIP original do Zoho que você já tem.
3. **15 contratos nativos + 654 atividades + 2.074 notas não foram recuperados** por falta de vínculo resolvível a um lead/empresa/negócio — residual documentado, não é perda silenciosa (seções 2 e 4).
4. **Gotcha técnico de transferência macOS→Linux (achado e corrigido nesta sessão, mas relevante se algum processo futuro repetir o mesmo caminho)**: nomes de arquivo com acento chegam decompostos (NFD) via `tar` do macOS, quebrando o match com `storage_path` (gravado em NFC) — 204 dos 1.980 arquivos foram afetados e corrigidos aqui. Qualquer rotina futura de importação de arquivo do Mac pro servidor Linux precisa normalizar encoding antes de persistir o caminho no banco.

---

## 1. Batch 1 — Companies/Leads/Opportunities

| Item | Antes | Recuperado | Depois | Confiança |
|---|---:|---:|---:|---|
| Empresas | 1.560 | +156 | 1.716 | Alta |
| Leads (12 LEAD_COMERCIAL_REAL, fase2/D) | — | +12 | — | Média (herdada da fase 2) |
| Contatos (Zoho Contacts, dedup por email/telefone) | — | +216 | — | Alta (170 corretamente não-importados por já existir) |
| Negócios | 1.118 | +204 | 1.322 | Alta |

**Regra aplicada em Negócios** (204 recuperados, 512 candidatos originais): excluídos 159 por serem evento pós-venda (vão pro Batch 2 como `eventos_comerciais`, nunca como negócio novo — regra do ADR), 96 por serem o grupo ambíguo "Origem sem token" (fase 2/A, ficam de fora por decisão já fechada), 52 por Stage não-terminal (pipeline morto, não é histórico a recuperar), 1 artefato de teste. `204+159+96+52+1=512` — bate exato com o achado da fase 1.

**2 conflitos de CNPJ corretamente não-importados** (Nibb Plan Soluções, Bucco Odontologia) — CNPJ já existente em empresa com outro nome, decisão de merge fica com o Kauã, não decidido automaticamente.

**Achado técnico do processo**: 1 empresa do Zoho ("INCLUDER | YESTAR | MAYRA") tinha nome no formato de Deal, não de empresa — mesmo padrão "nome como lógica de negócio" já documentado nas fases 1/2, vazando pro módulo Accounts. Filtrada, não importada como empresa.

**Verificação de integridade**: `empresas.zoho_id`/`negocios.zoho_id` 100% únicos pós-recovery (checado direto no banco). 6 grupos de CNPJ duplicado encontrados na checagem — **investigados um a um, confirmados 100% pré-existentes** (já estavam lá antes desta sessão, mesmo achado da fase 1) — nenhum foi criado por este recovery.

---

## 2. Batch 2 — Contracts + Contract Items + Commercial Events

| Item | Recuperado | Confiança |
|---|---:|---|
| Contratos nativos | 265 (de 279 no CSV) | Alta |
| — incluindo CT-292-06/2026 | 1 (recuperado por cruzamento forense) | Alta |
| Contrato Itens | 487 (100% dos itens do CSV) | Alta |
| — órfãos (`contrato_id=null`, sem contrato-pai resolvível) | 45 | Ver detalhe abaixo |
| Eventos Comerciais | 247 | Alta (88 confirmados fora de dúvida, 24 marcados `ambiguo`) |
| Projeções financeiras (`mrr_movimentos`) | 94 | Média (delta aproximado, não reconstrução exata de MRR antes/depois) |

**14 contratos não recuperados** por falta de lead resolvível (`contratos.lead_id` é NOT NULL) — zoho_ids documentados no script, nenhum foi inventado. Cascata: 35 dos 45 itens órfãos vêm desses 14 contratos (os itens genuínos são só 10, já identificados na auditoria de Products/Contract Items).

**CT-292-06/2026 (MASCARENHAS BARBOSA ADVOGADOS)**: recuperado com todos os campos possíveis — prazo 36 meses, valor R$4.112,22, status ativo, `assinatura_legado_zoho` já carrega a referência do documento ZohoSign + Deal + Quote que permitiram a reconstrução. Multa não recuperada (não estava disponível em nenhuma fonte cruzada).

**Vocabulário de eventos aplicado**: churn 88, upgrade 88, downgrade 30, renovação 25, alteração contratual 16 — bate com o esperado da fase 2 (pequena variação de contagem por refinamento de dedup, dentro do esperado). 24 eventos (downgrade/renovação com Stage=Perdido) marcados `confianca=ambiguo`, conforme regra do ADR — não tratados como fato efetivado.

**Achado técnico do processo**: 1 linha de Itens Solicitados tinha o campo "Desconto" do Zoho preenchido com valor monetário (R$1.000) em vez de percentual — excedia a precisão da coluna (`decimal(5,2)`, máx 999,99). Zerado com segurança (o resto do item — produto, quantidade, valor, subtotal — preservado corretamente), registrado como achado de qualidade de dado do próprio Zoho.

**Verificação "Won permanece Won"**: confirmado diretamente nos scripts aplicados — **zero instrução UPDATE em `negocios` em qualquer um dos 2 lotes** (grep no SQL aplicado). Toda mudança foi INSERT de linha nova. Nenhum negócio pré-existente teve status alterado.

---

## 3. Batch 3 — Proposals/Invoices

| Item | Recuperado | Confiança |
|---|---:|---|
| Faturas históricas | 123 (100% do CSV) | Alta |
| Propostas novas | 166 | Alta (escopo restrito, ver abaixo) |

**Mudança de método no meio da execução (achado, não decisão arbitrária)**: o plano original — casar Zoho Quotes contra propostas atuais por valor+data pra achar só as que faltam — foi testado e descartado. Com tolerância 1:1 exata (centavo + data exata), o match deu **1044/1067 (98%)**, muito acima do **591/1067 (55%) já validado na fase 1**. Isso indica que o heurístico está com falso positivo em escala (provavelmente pontos de preço populares — R$179,90/R$359,80 etc. — coincidindo entre propostas não-relacionadas).

**Decisão tomada**: não confiar no heurístico que provou falhar. Troquei pro sinal mais forte disponível nesta mesma sessão — **uma Quote só é candidata a proposta nova se o Negócio ao qual ela pertence é um dos 204 que o Batch 1 acabou de criar** (ou seja, comprovadamente sem nenhuma representação prévia no CRM). Resultado: 166 propostas recuperadas com confiança alta, **852 ficaram explicitamente fora de escopo** (Quotes de negócios que já existiam antes desta sessão — podem já estar representadas via a migração original, ou podem ser uma perda real; não decidido, não uma perda declarada).

**Isso é o item #1 da seção 0 — precisa de decisão/método melhor antes de fechar Propostas como 100% recuperado.**

---

## 4. Batch 4 — Notes/Activities/ZohoSign

| Item | Recuperado | Não resolvido | Confiança |
|---|---:|---:|---|
| Notas | 2.486 (de 4.560) | 2.074 | Alta nas recuperadas |
| Atividades (Calls/Meetings/Tasks/Emails) | 829 (de 1.483) | 654 | Alta nas recuperadas |
| Contratos com metadado ZohoSign atualizado | 218 contratos distintos (289 eventos de documento) | 79 (documento sem contrato correspondente) | Alta |

**Notas não resolvidas (2.074)**: majoritariamente o grupo `CustomModule1` (1.605 notas — trilha textual de eventos ZohoSign, ex. "SalesOrder_X.pdf has been signed by...") sem parentesco direto resolvível a uma entidade do CRM atual — o FATO já está preservado de forma estruturada em `contratos.assinatura_legado_zoho` (Batch 4, ZohoSign), então a nota-texto duplicaria a mesma informação sem agregar; não inserida para não gerar ruído. O resto é resíduo de módulos sem FK direta em `notas` (Quotes/SalesOrders/Invoices/Tasks/Events, ~140 notas).

**Atividades não resolvidas (654)**: `atividades.lead_id` é NOT NULL — sem contato resolvível (via zoho_id, e-mail ou telefone), a linha não pode ser inserida. Nenhuma foi inventada.

**ZohoSign**: 218 contratos ganharam a trilha real (documento, status, data de envio/conclusão, destinatários com e-mail e status de assinatura) via `UPDATE ... assinatura_legado_zoho = COALESCE(...) || jsonb_build_array(...)` — múltiplos documentos por contrato acumulam corretamente (não sobrescreve).

---

## 5. Batch 5 — Attachments (metadado + binário)

**Pré-requisito confirmado antes de tratar como armazenamento definitivo** (pedido explícito do Kauã):

- ✅ **Persistência entre deploys**: `public/uploads` é bind mount pro host (`/opt/callface/crm-homolog/uploads`), não é parte da imagem Docker — confirmado que o processo de deploy (tarball) **não inclui** essa pasta, então um redeploy normal não sobrescreve nem apaga os arquivos.
- ❌ **Backup**: **não existe hoje nenhuma rotina de backup cobrindo esse diretório.** Achado real, não assumido — checado `crontab` e os scripts de backup existentes no servidor, nenhum toca esse caminho. Fica registrado como item aberto — ver seção 0.

**Execução**: 1.980 arquivos (1,03GB), 100% localizados no export local, 100% com SHA-256 calculado antes da transferência. Tabela `anexos_legado` ganhou coluna `checksum_sha256` (não estava na migration original do ADR — corrigido nesta execução, aditivo).

| Métrica | Valor |
|---|---|
| Arquivos processados | 1.980 / 1.980 (100%) |
| Tamanho total | 1.103.504.222 bytes (~1,03 GB) |
| Entidade resolvida (negócio/empresa/contrato/lead) | 1.108 (56%) |
| Entidade não resolvida (guardado mesmo assim, sem link) | 872 (44%) |
| Categoria `documento_assinado` | (ver detalhe no banco) |

**Transferência física**: tarball único (831MB comprimido) enviado ao servidor, extraído em `public/uploads/legado-zoho/` — servido pela rota já existente `GET /api/uploads/legado-zoho/<nome-do-arquivo>`, sem código novo.

**Achado durante a extração (corrigido antes de aplicar o SQL)**: o `tar` gerado no macOS trouxe 1.981 arquivos `._<nome>` de metadado AppleDouble junto dos 1.980 reais (total 3.961 na extração bruta) — removidos, sobrando exatamente os 1.980 esperados.

**Achado #2, mais sério (corrigido antes de aplicar o SQL)**: 204 dos 1.980 nomes de arquivo com acento (ex. "Cessão", "Nº") chegaram ao Linux normalizados em NFD (macOS decompõe `ã` em `a` + til combinante) — diferente do NFC gravado em `storage_path` no banco. Sem correção, esses 204 arquivos dariam 404 na rota de download mesmo estando fisicamente presentes. Corrigido renomeando todos pra NFC via script (`unicodedata.normalize`) antes de aplicar o SQL.

**Verificação de integridade pós-transferência (100% dos arquivos, não amostra)**:
- 1.980/1.980 `storage_path` esperados existem em disco no caminho exato após a correção de encoding.
- 1.980/1.980 checksums SHA-256 batem exatamente entre o valor calculado localmente (pré-transferência) e o valor real no servidor (pós-transferência) — **zero corrupção, zero perda, zero mismatch**.

**SQL aplicado em homologação**: backup `pre_batch5_20260812_031842.dump` tirado antes; 1.980 INSERT + BEGIN/COMMIT aplicados com sucesso (nenhum rollback).

**Validação final no banco**:

| Métrica | Valor |
|---|---:|
| Total em `anexos_legado` | 1.980 |
| Com `entidade_id` resolvido | 1.108 |
| Com `checksum_sha256` preenchido | 1.980 (100%) |
| Categoria `documento_assinado` | 1.386 |
| Categoria `anexo_generico` | 594 |

**Teste ponta a ponta**: arquivo amostrado ao acaso, acessado via `GET https://homolog.crm.callface.io/api/uploads/legado-zoho/<nome>` → `HTTP 200`, `content-type: application/pdf`, `content-length` batendo exato com o tamanho registrado. Rota existente funcionou sem alteração de código.

---

## 6. Critérios de Go/No-Go (ADR seção 9) — status

- [x] Contagem de cada entidade recuperada bate com o esperado — **com 1 exceção documentada** (Propostas, seção 3).
- [x] Zero negócio com `status='ganho'` alterado — confirmado via ausência de UPDATE nos scripts aplicados.
- [x] Zero novo negócio/contrato duplicado — índices únicos ativos, checados diretamente.
- [x] Provenance em coluna de banco (não só log) — `legacy_provenance`/`eventos_comerciais`/`status_changes` populados.
- [x] Reconciliação em 2 camadas (evento + financeiro) — vocabulário de evento bate com fase 1/2.
- [ ] Idempotência **ainda não testada por rodada dupla** — os scripts atuais não são idempotentes por si (fazem INSERT direto, não `ON CONFLICT`); rodar de novo duplicaria. Recomendo, antes de qualquer repetição, adaptar pra `ON CONFLICT (organizacao_id, zoho_id) DO NOTHING` explícito nos scripts, não só confiar no índice pra abortar a transação inteira.
- [x] Nenhuma automação/notificação disparada — todo o recovery rodou via SQL direto no banco, nunca via rota de API.
- [ ] 76/agora-39 pares Stripe — **resolvidos em homologação nesta sessão** (rodada anterior), mas o **gate de produção** (fix de código + preflight novo) continua pendente, não faz parte deste recovery.
- [x] Auditoria de Products/Contract Items concluída antes do dry-run.
- [ ] Revisão humana dos casos da seção 7 do ADR — pendente, é este relatório que entrega a evidência pra essa revisão.
- [ ] Aprovação explícita do Kauã antes de qualquer escrita em produção — pendente, é o próximo passo.

---

## 7. Recomendação

**Não prosseguir para produção ainda.** Antes:

1. Decidir o método pras 852 Propostas fora de escopo (seção 3) — ou aceitar a lacuna documentada, ou investir num método melhor (ex.: revisão manual de amostra, ou aceitar risco calculado).
2. Resolver a lacuna de backup do diretório de anexos (seção 5) — mesmo que seja um `rsync` periódico simples pro `_backups/`.
3. Adaptar os scripts de recovery pra idempotência real (`ON CONFLICT DO NOTHING`) antes de considerar repetir em produção — o que rodou aqui foi seguro pra uma execução única em ambiente controlado, não pra reexecução despreocupada.
4. Fechar o gate de produção já registrado no ADR (fix do bug de duplicação Stripe + preflight novo) — independente deste recovery.

Só depois disso, replanejar a mesma sequência (Batch 1→5) pra produção, com aprovação explícita antes de cada write real.
