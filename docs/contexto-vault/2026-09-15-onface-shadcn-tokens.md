---
tags: [decisao, onface, callface, crm2, design-system]
data: 2026-09-15
projeto: "[[02_PROJETOS/Callface/CRM/produto/crm-callface-status]]"
---

# ONFACE: shadcn do repo + tokens oficiais, não porte de JSX

## Contexto

A biblioteca oficial de componentes do ONFACE é `/Users/Scott/Documents/Callface /ONFACE - UI COMPONETS.fig`.
O Claude Design extraiu esse `.fig` para `/Users/Scott/Documents/Callface /ONFACE Design System/`
(projeto claude.ai `be2bf578-74fa-4abb-9482-88707b750134`), gerando um JSX por componente.

Ao inspecionar, ficou claro que a biblioteca **é shadcn/Radix com tokens ONFACE aplicados**.
Os nomes batem 1:1 com shadcn, incluindo primitives recentes: Item, Field, InputGroup,
ButtonGroup, Kbd, Empty. O `Button.jsx` do DS mapeia variantes
`default/outline/secondary/ghost/destructive/link` e consome `--primary`, `--border`, `--muted`,
que são exatamente os tokens shadcn.

## Decisão

Não portar o JSX do Claude Design para o repositório.

O JSX extraído usa inline styles e `window.ONFACEDesignSystem_be2bf5` porque é artefato de
prototipagem do canvas. Copiar isso criaria a biblioteca paralela que o handoff proíbe.

A rota é a que o handoff já definia:

```
shadcn/Radix primitives do repo
  -> tokens ONFACE (portados dos 12 CSS de tokens/)
  -> patterns ONFACE
  -> telas CRM2
```

Os arquivos `.prompt.md` de cada componente são a spec de uso real (tamanhos, variantes, estados,
quando usar coral) e valem mais que o JSX correspondente. Ex: Button é 24/28/32/36px,
coral `default` reservado para a única ação primária da tela, hover dim a 80%, disabled 50% de
opacidade e nunca mudança de cor.

## Por quê

- preserva os contratos certificados dos módulos já concluídos do CRM2
- evita `MetricCard2`/`MetricCardFinal` e variações paralelas
- mantém os portais Radix (dropdown, popover, dialog, tooltip) funcionando no `<html>`,
  o que o JSX de inline style não resolveria
- o `.fig` sendo shadcn significa que o mapeamento é direto, sem tradução conceitual

## Consequências

Primitives shadcn a adicionar no repo para cobrir a biblioteca: `button-group`, `input-group`
(+ addon/control), `kbd`, `combobox-chip`, `menubar`, `avatar-group`, `avatar-badge`, `slider`,
`check`, `icon`.

Segue valendo a regra do handoff de **não** aplicar o preset shadcn `b6TqMNb5Wb` inteiro:
ele sobrescreveria componentes no worktree sujo. Adicionar primitive por primitive, sob demanda.

O README do DS avisa que Operação, Clientes, Financeiro, Automações e Insights não têm design
ONFACE nas fontes. Essas telas serão desenhadas, não copiadas.

Relacionado: [[02_PROJETOS/Callface/CRM/HUB]]
