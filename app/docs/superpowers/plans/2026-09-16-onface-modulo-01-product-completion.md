# ONFACE Módulo 01 Product Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar as cinco superfícies de Vendas utilizáveis de ponta a ponta, preservando o domínio `src/lib/vendas` e as ações existentes.

**Architecture:** As páginas completas reutilizam as consultas e comandos de Vendas; drawers permanecem quick views. A UI não cria um segundo motor: comandos continuam em `app/(onface-preview)/onface-preview/*/actions.ts` e `src/lib/vendas`.

**Tech Stack:** Next.js App Router, React client components, TypeScript, PostgreSQL/Drizzle, Node test runner e CUA para smoke real.

**Spec:** `/Users/Scott/Downloads/specdrive-modulo-01-vendas-final.md`

## Global Constraints

- Preservar `src/lib/vendas` salvo bug comprovado.
- Não alterar produção, não fazer push, merge ou reset.
- Reaproveitar componentes/actions existentes e manter ONFACE como única linguagem visual.
- Cada CTA deve executar, persistir, refletir após reload e navegar para a próxima superfície.
- Comunicação de fluxos novos permanece em Atendimento ONFACE, nunca `wa.me`, `mailto:` ou `tel:`.

---

### Task 1: Páginas completas de Oportunidade, Empresa e Pessoa

**Files:**
- Modify: `src/components/onface/vendas/Pipeline.tsx`, `Contatos.tsx`, `pagina.tsx`
- Create/modify: rotas `[id]/page.tsx` em `onface-desenho` e `onface-preview` para Pipeline, Empresas e Pessoas
- Test: `src/app/onface-desenho/rotas-vendas.test.ts`

- [ ] Criar teste vermelho que exige páginas de detalhe reais, não redirects, e que clicar em Pessoa não abre o diálogo de vínculo.
- [ ] Usar `acaoDetalhe`, `acaoEmpresa360` e consultas existentes para montar páginas com cabeçalho, resumo, ações, timeline e links relacionados.
- [ ] Integrar botões "Abrir oportunidade", "Abrir empresa" e "Abrir pessoa" nas quick views.
- [ ] Manter editar família, próxima ação, reunião, no-show, trial, vínculo e dados jurídicos usando ações existentes.
- [ ] Rodar teste focado, typecheck e smoke desktop/mobile das rotas.

### Task 2: Jornada estável de Propostas

**Files:**
- Modify: `src/components/onface/vendas/Propostas.tsx`, `PropostaCorpo.tsx`, páginas/rotas de Propostas
- Test: `src/app/onface-desenho/rotas-vendas.test.ts` e testes de Vendas existentes

- [ ] Criar teste vermelho para rota de criação e para transição página completa → fluxo guiado.
- [ ] Criar `/propostas/nova` que abre o mesmo compositor, sem duplicar catálogo, criação, revisão ou envio.
- [ ] Garantir que salvar dados jurídicos, enviar, criar revisão e abrir links relacionados retornem ao estado correto.
- [ ] Rodar teste focado, typecheck e smoke de rascunho/contrato/revisão em dado isolado.

### Task 3: Operação de Pré-vendas e Prospecção

**Files:**
- Modify: `src/components/onface/vendas/PreVendas.tsx`, `Prospeccao.tsx` e páginas/actions somente quando a ação existente não estiver exposta
- Test: testes focados de renderização/rotas e os aceites de Vendas

- [ ] Expor filtros suportados por dados reais e completar estados/loading/erro/empty.
- [ ] Conectar ações em massa já suportadas a responsável/lista/cadência/tag/enriquecimento/pausa/arquivamento; ocultar somente ações sem infraestrutura correspondente.
- [ ] Garantir que pré-qualificação e oportunidade direta chamam os comandos já existentes, mostram sucesso e atualizam a tela.
- [ ] Rodar smoke real sem alterar dados de negócio fora de fixtures limpas.

### Task 4: Validação de produto e revisão final

**Files:**
- Modify: documentação de handoff/diário somente para decisões e evidência final
- Test: `npm test`, `tsc --noEmit --incremental false`, `npm run check:vendas`, `npm run aceite:vendas`, `npm run build`

- [ ] Executar smoke desktop 1440px e mobile 390px para todos os fluxos definidos na SpecDrive.
- [ ] Inspecionar console, responsividade, erro, loading, vazio e feedback após persistência.
- [ ] Fazer revisão independente do delta e corrigir achados críticos/importantes.
- [ ] Registrar evidências no handoff e diário.
