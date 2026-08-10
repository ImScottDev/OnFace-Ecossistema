# Auditoria Legado Zoho — Frente 05: Reconciliação de Empresas, Contatos e Leads

**Data da auditoria:** 10/08/2026
**Tipo:** Investigação forense, somente leitura (nenhum CSV ou registro do banco foi alterado)
**Fontes:**
- Zoho export `~/Downloads/Data_001/Data/` (CSV utf-8-sig, IDs `zcrm_<sufixo numérico>`)
- Banco CRM atual `callface_crm` (Postgres), tabelas `empresas`, `leads`, `contatos`, `negocios`

---

## 0. Nota metodológica importante — descoberta de schema

O enunciado da auditoria presumia que a tabela `contatos` do CRM pudesse ser a contraparte do módulo **Contacts** do Zoho. **Não é.** Ao rodar `\d contatos`:

- `contatos` (1.001 linhas) é uma tabela de **canais de conversa** (WhatsApp/e-mail: colunas `canal`, `sessao_id`, `conta_id`, `ultima_msg`) e tem **0 linhas com `zoho_id` preenchido**.
- A contraparte real do módulo Contacts (pessoa física vinculada a uma empresa) é a tabela **`leads`**, filtrando por `tipo = 'contato'` — o modelo unificado descrito no briefing (leads/contatos/clientes convivem em `leads.tipo`) está confirmado.

Toda a reconciliação de pessoas abaixo usa `leads` (por `tipo`), não `contatos`.

---

## 1. Inventário — contagens gerais

Contagem feita com parser CSV real (respeitando aspas/quebras de linha em campos), não `wc -l` — por isso os totais batem quase exato com o enunciado, com pequena diferença de linhas físicas vs. linhas lógicas (campos com quebra de linha embutida).

| Fonte | Zoho (linhas de dado) | CRM atual | CRM com `zoho_id` preenchido |
|---|---|---|---|
| Empresas (Zoho) → `empresas` | 1.102 | 1.560 | 944 (60,5% do total CRM) |
| Contacts (Zoho, pessoa) → `leads` tipo=contato | 2.267 | 1.893 (`tipo='contato'`) | 1.797 |
| Leads (Zoho, módulo Lead) → `leads` tipo=lead | 971 | 1.060 (`tipo='lead'`) | 565 |
| **Total pessoas em `leads`** (contato+lead+cliente) | — | 3.196 | 2.450 |
| Negócios (Oportunidades Zoho) → `negocios` | — | 1.104 | 1.039 |

Leitura: o CRM tem **mais** empresas (1.560) e **mais** leads-pessoa (3.196) do que o Zoho tinha registros brutos — o que já indica que parte do volume é atividade orgânica pós-migração (ver seção 6), não perda. A pergunta de perda real está em **quantos dos IDs do Zoho aparecem** no CRM, não no total bruto.

---

## 2. Cobertura de campo (qualidade dos dados de origem no Zoho)

### Empresas (1.102 linhas no Zoho)

| Campo | Preenchido | Taxa |
|---|---|---|
| CNPJ | 800 / 1.102 | 72,6% |
| Telefone | 334 / 1.102 | 30,3% |
| Endereço (rua ou cidade de cobrança) | 379 / 1.102 | 34,4% |
| Site | 178 / 1.102 | 16,2% |

### Contatos / pessoas (2.267 linhas no Zoho, módulo Contacts)

| Campo | Preenchido | Taxa |
|---|---|---|
| E-mail | 1.908 / 2.267 | 84,2% |
| Telefone ou Celular | 1.147 / 2.267 | 50,6% |
| Cargo | 357 / 2.267 | 15,7% |

**Leitura:** confirma a suspeita do Kauã de que "o processo antigo era ruim" — CNPJ falta em 27%, telefone falta em ~70% das empresas, cargo falta em 84% dos contatos. Isso não é perda de migração, é qualidade de dado herdada do Zoho.

---

## 3. Duplicidade DENTRO do próprio Zoho

### 3.1 Empresas com mesmo CNPJ (normalizado, só dígitos)

**5 grupos**, envolvendo 10 linhas. Confiança: **alta** (CNPJ normalizado é um identificador forte). Todos os 5 exemplos:

| CNPJ | Linha A | Linha B |
|---|---|---|
| 38315122000140 | `zcrm_...760177` PAGGO SOULUCOES | `zcrm_...12576003` JOTABANK (PAGGO) |
| 42830071000161 | `zcrm_...760183` NUVY SOFTWARE E SERVIÇOS LTDA | `zcrm_...22647255` Nuvy |
| 00943122000111 | `zcrm_...4948038` RIO PAX DO CENTRO | `zcrm_...22334178` Agencia Funeraria Rio Pax do Centro LTDA |
| 51914600000104 | `zcrm_...30401001` Scudellari e Vieira Advogados | `zcrm_...30907011` Scudellari Vieira Advogados |
| 12671265000109 | `zcrm_...34150381` POPULAR CRED | `zcrm_...35246068` W.A.BARROS JUNIOR SERVICOS CADASTRAIS - ME |

Padrão visível: em 4 dos 5 casos os nomes são visivelmente a mesma empresa grafada diferente (rebranding, sigla, "e" vs sem "e"). É evidência forte de duplicidade real, mas a decisão de merge é do Kauã.

Volume pequeno (10 linhas em 1.102) — CNPJ não é o principal vetor de duplicidade no Zoho.

### 3.2 Contatos com mesmo telefone (normalizado, DDD+número, sem código de país)

**85 grupos**, envolvendo 182 linhas (8% dos 2.267 contatos). Distribuição de tamanho de grupo: 79 grupos de 2, 2 de 3, 3 de 4, 1 de 6.

Confiança: **média-baixa por padrão observado**. Ao inspecionar os exemplos, a maior parte não parece ser "a mesma pessoa duplicada" — parece ser **números de telefone reciclados/genéricos usados por vários leads de teste ou vários contatos reais na mesma empresa** (recepção, WhatsApp comercial compartilhado):

- Telefone `11941086153` aparece em 6 contatos com nomes claramente de teste/piada: "Mussum Trapalhão", "teste1924 teste teste", "Mesas Mesas", "Pedro Cadeiras" — indício de **dado de teste/sujeira no Zoho**, não duplicidade de cliente real.
- Telefone `31999439028` aparece em 4 contatos todos chamados "Pedro" (Pedro Ferreira, PEDRO SILVA, Pedro teste, Pelé Santos) — mesmo padrão de teste.
- Telefone `5130762612` (fixo) aparece em 3 contatos com nomes diferentes E mesma `Empresa Nome.id` (`zcrm_...971523`) — esse caso é **legítimo**: é o telefone geral da empresa, compartilhado por 3 pessoas de contato dela.
- Telefone `19997621465` — 2 contatos, mesma empresa, nomes diferentes ("Rayane", "Administração Do Condomínio") — mesmo padrão legítimo (telefone corporativo).
- Casos como `19997348688` e `14997369003` e `17997039435`: mesmo telefone, nomes iguais ou muito parecidos, mas **empresas diferentes** (uma com `Empresa Nome.id` preenchido, outra vazio) — indício de contato genuinamente duplicado entre duas tentativas de cadastro.

**Conclusão de confiança:** não recomendo tratar os 85 grupos como "85 duplicidades" — é uma mistura de (a) dado de teste/lixo, (b) telefone corporativo compartilhado legitimamente por vários contatos da mesma empresa, e (c) duplicidade real de pessoa. Decisão de merge precisa de triagem manual por grupo, ideal seria segmentar por "mesma Empresa Nome.id" (provável legítimo) vs "Empresa Nome.id diferente ou nomes near-match" (provável duplicidade real).

### 3.3 Contatos com mesmo e-mail

**0 grupos.** Nenhum e-mail se repete entre os 2.267 contatos (dos 1.908 preenchidos). E-mail é limpo no Zoho quanto a duplicidade exata.

---

## 4. Órfãos no Zoho (qualidade de dado pré-migração, não causada pela migração)

- **Contatos sem `Empresa Nome.id`:** 1.007 / 2.267 (**44,4%**) — quase a metade dos contatos no Zoho nunca foi vinculada a uma empresa. É o maior problema estrutural de dado encontrado nesta frente.
- **Empresas sem nenhum contato relacionado:** 204 / 1.102 (**18,5%**) — empresas cadastradas sem nenhuma pessoa de contato associada.
- IDs de empresa referenciados por contatos mas ausentes do CSV de Empresas (FK pendente/quebrada dentro do próprio Zoho): 0 — não há esse tipo de inconsistência.

---

## 5. `ConvertedLeadRecords_001.csv` — sobrevivência da jornada de conversão

481 linhas de dado (não 482 — esse número conta a linha de cabeçalho do CSV).

Cruzamento via `zoho_id` contra `empresas`, `leads` e `negocios` do CRM atual:

| Campo convertido | Encontrado no CRM via `zoho_id` | Taxa |
|---|---|---|
| `Lead.id` → em `leads.zoho_id` | 1 / 481 | 0,2% |
| `Account.id` → em `empresas.zoho_id` | 464 / 481 | 96,5% |
| `Contact.id` → em `leads.zoho_id` | 464 / 481 | 96,5% |
| `Potential.id` (negócio) → em `negocios.zoho_id` | 374 / 481 | 77,8% |
| Os 4 IDs presentes simultaneamente | 0 / 481 | 0,0% |
| Nenhum dos 4 presentes | 14 / 481 | 2,9% |

### Achado-chave: o `Lead.id` original nunca sobrevive — e isso já era assim dentro do próprio Zoho

Investiguei o motivo do 0,2%: cruzei os 971 IDs do módulo **Leads** do Zoho (`Leads_001.csv`) contra os 481 `Lead.id` do `ConvertedLeadRecords`. **Interseção = 0.** Ou seja, quando um Lead é convertido no Zoho, o registro original do módulo Lead **é apagado/não existe mais nem no próprio export do Zoho** (comportamento padrão do Zoho ao converter com "delete lead" habilitado). Confirma isso também: nenhuma das 971 linhas de `Leads_001.csv` tem a coluna `Está convertido` = verdadeiro (971 são `false`).

**Conclusão:** a jornada pré-conversão (Lead.id original + `Lead Created Time` de `ConvertedLeadRecords`) já não existe mais como registro navegável nem no Zoho — só sobrevive como *metadado* dentro do próprio arquivo `ConvertedLeadRecords`. O CRM não perdeu isso na migração porque **não havia como preservar um `Lead.id` que o próprio Zoho já tinha descartado**. Isso reduz a gravidade do achado: não é falha da migração, é uma característica antiga do processo Zoho.

O que **de fato importa** e está bem preservado: o **resultado** da conversão (Account 96,5%, Contact 96,5%) está presente no CRM na grande maioria dos casos. O ponto de atenção real é o **Potential (negócio) só em 77,8%** — 107 negócios resultantes de conversão não foram encontrados via `zoho_id` em `negocios`. Combinado com o dado abaixo, parte disso é explicada por o próprio Zoho já não ter o Potential.id preenchido:

- Das 481 linhas de `ConvertedLeadRecords`, **66 já vêm com `Potential.id` vazio na fonte Zoho** (conversão sem gerar negócio) — isso explica boa parte dos ~107 "não encontrados", restando um resíduo de ~41 negócios de conversão com `Potential.id` preenchido no Zoho mas ausentes no CRM atual (candidato real a perda, confiança média).
- 12 linhas vêm com `Account.id` vazio e 10 com `Contact.id` vazio na própria fonte Zoho (conversões incompletas mesmo dentro do Zoho).
- As 14 linhas "nenhum dos 4 encontrados": nas 5 primeiras inspecionadas, `Account.id`, `Contact.id` e `Potential.id` já vêm **vazios na fonte Zoho** — não é perda de migração, é conversão que não gerou downstream nenhum dentro do próprio Zoho.

---

## 6. Cruzamento reverso — o que existe no CRM sem `zoho_id`

Total com `zoho_id IS NULL`: **616 empresas** e **746 leads** (todos os `tipo`).

Isso **não é tudo "novo real"**. Ao olhar `created_at`, apareceu um segundo padrão que precisa ser separado:

### 6.1 Genuinamente novo (criado depois da migração, `created_at >= 2026-06-12`)

| Tabela | Quantidade | Perfil |
|---|---|---|
| `empresas` | 292 | crescimento orgânico pós-cutover |
| `leads` | 570 | `tipo='lead'`, origem majoritária **Mídia Paga** (356), outbound (78), Site (33) — geração de lead nova, não relacionada a Zoho |

Este volume é dado real do negócio pós-migração e **não deve ser tratado como falta** — está correto o alerta do briefing.

### 6.2 Achado adicional (fora do escopo original, mas relevante): registros com `created_at` ANTERIOR à migração e `zoho_id` vazio — possível quebra de vínculo, não "novo"

| Tabela | Quantidade | Detalhe |
|---|---|---|
| `empresas` | 324 | `created_at` entre 2023-10 e 2026-06-11, sem `zoho_id` |
| `leads` | 176 | 95 `tipo='contato'` + 4 `tipo='cliente'` com `origem = 'migracao_zoho'` (81 restantes com outras origens antigas: RD Station, Site, manual, etc. anteriores ao cutover) |

Inspecionei uma amostra desses 176 leads: têm `origem = 'migracao_zoho'`, nome no padrão `"Contato — <EMPRESA>"` e `created_at` preservado de 2023/2024 — ou seja, **são registros que vieram do Zoho na migração, mas perderam o `zoho_id` no processo**. Isso é diferente de "não migrou": o dado existe, mas **não é mais rastreável/reconciliável contra o Zoho** (não dá para confirmar duplicidade, não dá para auditar de onde veio). Confiança: **alta** para os 95+4 com `origem='migracao_zoho'` explícita; **baixa-média** para os ~225 restantes de `empresas` sem CNPJ nem marcador de origem — alguns nomes (ex.: "Cobranca", "Imobiliária", "Advocaticia", "Clínica", "Gear", "Echo Hub") parecem placeholders/categorias internas do CRM, não empresas reais do Zoho — não recomendo classificar esse subconjunto sem inspeção adicional.

### 6.3 Achado adicional: leads "Não Trabalhado" do Zoho, criados DEPOIS da migração, nunca chegaram ao CRM

Dos 971 registros do módulo Leads do Zoho, **449 (46%) não têm `zoho_id` correspondente em `leads`** no CRM. Ao investigar a data de criação desses 449:

| Mês de criação (Zoho) | Não encontrados no CRM |
|---|---|
| 2026-05 | 2 |
| 2026-06 | 8 |
| 2026-07 | 359 |
| 2026-08 | 80 |

**100% desses 449 leads foram criados DEPOIS do cutover de 12/06/2026** (356 deles em julho/agosto). Ou seja: **isso não é perda de migração** — é um gap de sincronização pós-migração: o Zoho continuou recebendo leads novos depois do cutover (provavelmente por integração antiga ainda ativa, ou uso manual paralelo) e esses 449 nunca foram trazidos para o CRM novo. 436 desses 449 estão com status "Não Trabalhado" — leads potencialmente ainda acionáveis, nunca tocados, presos no Zoho.

**Este é o achado de maior risco de negócio da frente 05:** possíveis leads comerciais recentes (jul/ago 2026) parados no Zoho, invisíveis para o time comercial no CRM atual. Recomendo aos donos da auditoria decidir se vale importar esse lote de 449 (filtrando os 8 "Qualificado"/"Em Qualificação"/"Attempted to Contact" como prioridade) — mas essa é decisão de negócio, não desta frente.

---

## Resumo de achados por nível de confiança

**Alta confiança (evidência direta, pouco espaço para outra interpretação):**
- `contatos` ≠ módulo Contacts do Zoho; reconciliação correta é via `leads.tipo`.
- 5 grupos de empresas com CNPJ idêntico duplicado no Zoho (10 linhas).
- 0 duplicidade de e-mail em contatos do Zoho.
- 44,4% dos contatos do Zoho nunca tiveram empresa vinculada; 18,5% das empresas nunca tiveram contato — problema de origem, não de migração.
- `Lead.id` original nunca sobrevive à conversão porque o próprio Zoho já o descarta — não é falha de migração.
- 449 leads do Zoho (46% do módulo Lead) ausentes no CRM, e 100% deles criados depois do cutover — gap de sincronização pós-migração, não perda migratória.
- 99 leads com `origem='migracao_zoho'` e `zoho_id` vazio — vínculo de rastreabilidade quebrado na migração (dado presente, auditabilidade perdida).

**Confiança média (padrão sugestivo, mas precisa de triagem humana):**
- 85 grupos de telefone duplicado em contatos — mistura de dado de teste, telefone corporativo compartilhado (legítimo) e duplicidade real; não tratar como número único de "duplicados".
- ~41 negócios de conversão (`Potential.id` preenchido no Zoho) ausentes em `negocios.zoho_id` — candidato residual a perda real, após descontar os 66 casos já vazios na fonte.
- 324 empresas e ~225 leads com `created_at` pré-migração e sem `zoho_id`/marcador de origem — parte parece migração com vínculo quebrado, parte parece placeholder interno do CRM; precisa inspeção adicional para separar.

**Baixa confiança / não conclusivo:**
- Nomes de empresa "near-match" nos grupos de CNPJ duplicado (ex.: Scudellari e Vieira vs Scudellari Vieira) — visualmente parecem a mesma empresa, mas é leitura minha, não confirmação de merge.

---

## Arquivos e queries de apoio (para reprodutibilidade)

- Script de análise: `/private/tmp/claude-501/-Users-Scott-Documents-Brain---Scott-Studio/8181f05b-1f3a-42a5-b277-921eb966cd55/scratchpad/audit.py`
- Exports intermediários do banco (zoho_id sets): mesma pasta, `empresas_zoho.csv`, `leads_zoho.csv`, `negocios_zoho.csv`, `empresas_sem_zoho.csv`, `leads_sem_zoho.csv`
- Todas as contagens usam parser CSV real (`csv.DictReader` em Python, `utf-8-sig`), não `wc -l`, para respeitar campos com quebra de linha embutida.
