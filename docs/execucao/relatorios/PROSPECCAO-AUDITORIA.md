# Prospecção 2.0, auditoria da Fase 1 (12/10)

Validado em execução (dev local, `/prospeccao`, 1440px e 390px, sessão admin, banco local: 38 novo, 41 pré-qualificado, 0 nas demais).

## O que existe e funciona
- Lista (busca, filtro de responsável e lista, abas de estado, seleção, ações em massa, importar CSV, adicionar empresa) e Kanban de leitura.
- Domínio em `lib/vendas/prospeccao.ts` com comandos por estado, eventos `Prospect*`, entrada canônica idempotente.
- Console e rede limpos; sem rolagem horizontal da página em 390px.

## Bugs (existia e estava errado)
1. Sem máquina de estados: qualquer comando rodava de qualquer estado (ex.: sem resposta em pré-qualificado). A UI escondia, o backend não recusava.
2. Transição lê-e-escreve sem trava: dois cliques ou duas abas atropelavam o estado.
3. `criarOportunidadeDireta` não era idempotente: clique repetido criava oportunidades duplicadas; aceitava zero família.
4. `registrarResposta` aceitava sem nenhuma evidência.
5. "Pausar cadência" CANCELAVA a matrícula (o motor tem `paused`), deixando o prospect em cadência sem cadência.
6. Inscrever aceitava segunda cadência viva para o mesmo prospect.
7. `passoAtual` sempre null (a consulta nunca derivava).
8. Descartar/pré-qualificar não cancelavam toda cadência viva (só active/waiting).
9. Lista com teto fixo de 400, sem ordenação nem paginação; busca só por empresa/pessoa; contadores das abas ignoravam a busca.

## Ausências (nunca foram construídas)
- Arrastar e soltar, validação de transição na tela, reversão em erro.
- Drawer operacional (era um diálogo só com botões); abas Pessoas, Conversas, Cadência, Histórico, Inteligência.
- Resposta recebida não virava RESPONDEU; cadência concluída não virava SEM RESPOSTA (o worker nunca avisava a Prospecção).
- Visão Operação/Fila BDR, indicadores, navegação Operação/Kanban/Lista/Campanhas/Inteligência.

## Legado anotado, fora da Fase 1
- `/api/prospeccao/import` e `/api/prospeccao/board` gravam/leem `tipo='lead' origem='outbound'` sem `prospeccao_estado`; a tela usa `acaoImportarProspects`.
- "Lista" = etiqueta (`labels`); `contato_listas` só existe no import legado.
- Reativar descartado e arquivar ficam para a Fase 2.

## Decisões (default conservador)
- Desfechos (pré-qualificar, oportunidade, descartar) saem de qualquer estado aberto, como a spec §7 (Novo lista essas ações).
- Resposta só vale para quem está em cadência ou sem resposta; de Novo exige cadência antes.
- Quem já saiu (pré-qualificado, oportunidade, descartado) não volta.
- Abrir lead completo (`LeadDesenho`) só para pré-qualificado: as ações da tela do lead são de Pré-vendas e deixariam o usuário contornar as regras da Prospecção.
