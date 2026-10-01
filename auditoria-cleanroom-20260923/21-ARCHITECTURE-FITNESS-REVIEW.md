# 21 — ARCHITECTURE FITNESS REVIEW

Pergunta: a arquitetura é adequada ao produto que se está construindo (um CRM operado hoje por ~3 pessoas, ~200 negócios/mês)? Base: entregáveis 02, 04, 05, 06.

## Veredito geral
A arquitetura do CRM 2.0 é **conceitualmente sólida mas grosseiramente super-dimensionada** para a operação real, e a super-estrutura ficou **inacabada** — o custo de manutenção do andaime já pesa mais que o valor entregue. O problema não é falta de arquitetura; é excesso de arquitetura pela metade.

## OVERENGINEERED (evidência)
1. **39 packages @onface, 30 stubs vazios** com 0 importadores, mais um script de fronteira (`checar-fronteiras.ts`) que **não existe** e é referenciado por 30 cabeçalhos. A trava `fronteiras.test.ts` passa trivialmente. O andaime de "monorepo por domínio" existe no papel; `apps/*` sequer existe no disco.
2. **31 tabelas ai_* + 29 endpoints CRUD, 29 tabelas vazias, 0 execuções de agente.** Plataforma de IA (knowledge base, memory, skills, routers, budgets, send ledger) para um produto que ainda não tem um agente publicado. Custo conceitual altíssimo, valor zero medido.
3. **4-5 motores de automação paralelos** (regras F5, cadence engine, cadência SDR inbound, sequências de e-mail, retry AI SDR hardcoded). O único com dado é o legado (1.306); os genéricos "que unificariam" têm 0 linhas. A própria API expõe `mecanismosParalelos` como dívida.
4. **Dual model completo** (leads/contatos/empresas ↔ aquisicoes/pessoas/pontos_contato; negocios ↔ oportunidades) mantido por dual-write vivo, com a escrita primária ainda no legado. `aquisicoes` é espelho 1:1 estéril de `leads` — custo puro.
5. **2 publicadores de evento, 2 resolvedores de tenant, 3 gates de autorização, 4 fontes na timeline, 3 camadas de anexo, 3-4 bibliotecas de componentes (91.666 LOC)** — cada um justificável isoladamente, insustentável somado.

## SUBARQUITETADO (evidência)
1. **Isolamento de tenant procedural, não estrutural**: 127 de 208 mutações sem `organizacao_id` no WHERE (guard-then-write). Para um SaaS multi-org, o isolamento deveria ser estrutural — hoje depende de o guard nunca ser removido.
2. **RBAC populado mas cobrindo ~10 de 68 rotas** — 90% da autorização ainda é string de papel.
3. **Zero observabilidade de integração** (`integracao_sync_estado` vazia) e observabilidade geral = console.log. Para um sistema com 9 integrações e 24 jobs, não há como saber o que quebrou sem inspecionar tabela por tabela (ex.: invoice travado 9 dias, lead preso 63 dias — só descobertos por auditoria).
4. **Worker monolítico de 4.260 linhas** com 1 teste, contendo regra de negócio (SDR) que deveria estar em lib.
5. **Sem telemetria de login/uso** — impossível medir adoção.

## DUPLICADO / DESNECESSÁRIO
- `conversion-sync` e `follow-up`: filas-placebo (corpo = console.log).
- `eventos_comerciais`, `vendas_eventos`: órfãos no código.
- `lib/billing`: contrato pronto, 0 importadores.
- Rotas Next fora da allowlist do Traefik: código morto em prod (declarado).
- `/api/meta/resolve`, montagens duplicadas de rotas Hono.
- 4 cascas de UI (`crm2`, `onface-preview`, `onface-desenho`, `estudio`) + `(crm)` redirects.

## CONCEITUALMENTE ERRADO / ARRISCADO
1. **`empresas` como entidade destruída por normalização** — 877 empresas de texto livre criadas em 1 minuto (`Autônomo`, `Casa`, `.`); 38% não referenciadas. "Empresa" deixou de ser agregável (MRR/empresa, carteira).
2. **MRR com 6 respostas** e "cliente" com 4 — não há fonte de verdade única de fato, apesar do `metric_catalog` declará-la. Duplicação de subscription infla MRR em R$62.822.
3. **Correction ledger (30.876 mudanças) materializado em 434** — o sistema "acredita" que corrigiu dados que não estão no banco.
4. **Assinatura de contrato sem prova em 745 contratos** — um CRM que fecha contrato mas não sabe se foi assinado.

## O que É adequado (preservar)
- **Padrão outbox transacional + sweep de 60s com dead-letter real e consumidores nomeados** — bem feito, é a espinha dorsal correta.
- **Integração Meta** — único ciclo completo (pacote + adapter + outbox + dado).
- **26 travas de arquitetura executáveis** — disciplina rara; a maioria cobra invariantes reais.
- **Núcleo comercial via server actions** (bloco vendas) — funciona sem depender do proxy.
- **Camada canônica** (pessoas/oportunidades/servicos_canonicos) — o modelo de destino é correto; falta terminar a virada e desligar o legado.

## Recomendação de fitness (para o Target State)
Cortar andaime não usado (packages stub, ai-* dormente, motores duplicados, filas-placebo, cascas extras), **terminar** o que está pela metade (dual-write→canônico, isolamento estrutural, observabilidade), e dimensionar para a operação real de ~3 usuários antes de investir em IA/automação avançada. **Não é caso de reconstruir — é caso de podar e concluir.**
