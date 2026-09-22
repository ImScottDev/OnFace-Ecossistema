# Componentes sem caminho a partir de rota

> Levantado em 22/09/2026 durante a reconstrução de UX.
> Método: travessia dos imports a partir de todo `page.tsx`, `layout.tsx`,
> `route.ts`, `error.tsx`, `loading.tsx`, `not-found.tsx` e do `middleware.ts`.
> Um componente aqui NÃO é alcançável por nenhuma rota do produto.

**93 de 488 componentes (19%), 24816 linhas.**

Isto NÃO é uma lista de remoção. É o levantamento que a remoção exigiria, e
remover legado depende de autorização explícita do Kauã. Três ressalvas antes
de qualquer exclusão:

1. A travessia segue import estático. Componente carregado por string, por
   registro dinâmico ou por `require` condicional não aparece como alcançável
   mesmo estando vivo.
2. Alguns são utilitários de teste ou de storybook interno.
3. Alguns são a versão nova que ainda não foi ligada — remover seria apagar
   trabalho adiantado, não dívida.

O valor da lista é outro: enquanto ela existir com este tamanho, qualquer
medição sobre "o front" está contando código que ninguém executa. Exemplo
medido no mesmo dia:

| Medição | Todo o código | Só o alcançável |
|---|---|---|
| Cores hardcoded em `.tsx` | 1.325 em 129 arquivos | **946 em 83 arquivos** |

**28% da dívida de cor que eu tinha reportado estava em código morto.** O
número que vale para planejar a migração de tokens é 946, não 1.325.

## Lista

- `app/(crm2)/inicio/_command-center-legado.tsx`
- `app/estudio/Micrografico.tsx`
- `components/crm/AgendarReuniaoModal.tsx`
- `components/crm/AlertasUrgentes.tsx`
- `components/crm/ButtonSpinner.tsx`
- `components/crm/CadenciaPanel.tsx`
- `components/crm/ChatPanel.tsx`
- `components/crm/ContatoActionBar.tsx`
- `components/crm/ContatoInfoSidebar.tsx`
- `components/crm/ContratoDrawer.tsx`
- `components/crm/CrmSidebar.tsx`
- `components/crm/CrmTopbar.tsx`
- `components/crm/CustomFieldsSection.tsx`
- `components/crm/DisqualifyReasonModal.tsx`
- `components/crm/EmailComposer.tsx`
- `components/crm/EmailPanel.tsx`
- `components/crm/EmailThreadView.tsx`
- `components/crm/EmpresaDrawer.tsx`
- `components/crm/EmptyState.tsx`
- `components/crm/LeadDrawer.tsx`
- `components/crm/LeadTimeline.tsx`
- `components/crm/LossReasonModal.tsx`
- `components/crm/MeuDiaClient.tsx`
- `components/crm/NegocioDrawer.tsx`
- `components/crm/NegocioSections.tsx`
- `components/crm/NotificationDropdown.tsx`
- `components/crm/PropostaDrawer.tsx`
- `components/crm/SdrStageControl.tsx`
- `components/crm/ServiceCatalogManager.tsx`
- `components/crm/Skeleton.tsx`
- `components/crm/ViewAsBanner.tsx`
- `components/crm/proposta-utils.tsx`
- `components/crm2/AreaTabs.tsx`
- `components/crm2/DesempenhoChart.tsx`
- `components/crm2/ModuleTabs.tsx`
- `components/crm2/PreVendasPulse.tsx`
- `components/crm2/Sidebar.tsx`
- `components/crm2/carol/Widget.tsx`
- `components/crm2/contatos/Workspace.tsx`
- `components/crm2/ds/index.tsx`
- `components/crm2/inicio/HeroPulso.tsx`
- `components/crm2/inicio/JornadaOperacao.tsx`
- `components/crm2/inicio/MetaMes.tsx`
- `components/crm2/inicio/MrrEvolucao.tsx`
- `components/crm2/inicio/OperacaoHoje.tsx`
- `components/crm2/inicio/PrecisaAtencao.tsx`
- `components/crm2/inicio/Workspaces.tsx`
- `components/crm2/leads/PaginaCompleta.tsx`
- `components/crm2/pipeline/BulkTarefaModal.tsx`
- `components/crm2/pipeline/NegocioDrawer.tsx`
- `components/crm2/pipeline/TopbarActions.tsx`
- `components/crm2/pipeline/Workspace.tsx`
- `components/crm2/propostas/NovaProposta.tsx`
- `components/crm2/propostas/PropostaCharts.tsx`
- `components/crm2/propostas/PropostaDetalhe.tsx`
- `components/crm2/propostas/PropostaDrawer.tsx`
- `components/crm2/propostas/Workspace.tsx`
- `components/crm2/prospeccao/ImportModal.tsx`
- `components/crm2/prospeccao/NovoProspectModal.tsx`
- `components/crm2/prospeccao/ProspeccaoDrawer.tsx`
- `components/crm2/prospeccao/TopbarActions.tsx`
- `components/crm2/prospeccao/Workspace.tsx`
- `components/crm2/qualificacao/AgendarReuniaoModal.tsx`
- `components/crm2/qualificacao/CadenciaCard.tsx`
- `components/crm2/qualificacao/NovoLeadModal.tsx`
- `components/crm2/qualificacao/PreVendasTopbarActions.tsx`
- `components/crm2/qualificacao/Workspace.tsx`
- `components/crm2/relatorios/KpiBar.tsx`
- `components/crm2/relatorios/charts/GaugeChart.tsx`
- `components/crm2/relatorios/charts/KpiCard.tsx`
- `components/crm2/shared/ChromeCard.tsx`
- `components/crm2/shared/DarkFilterSelect.tsx`
- `components/crm2/shared/SelectBox.tsx`
- `components/crm2/ui/Chart.tsx`
- `components/crm2/ui/Command.tsx`
- `components/crm2/ui/Select.tsx`
- `components/crm2/ui/Tooltip.tsx`
- `components/crm2/vendas/Blocos.tsx`
- `components/crm2/vendas/FiltrosVendas.tsx`
- `components/crm2/vendas/MovimentoComercial.tsx`
- `components/ui/alert-dialog.tsx`
- `components/ui/aspect-ratio.tsx`
- `components/ui/card.tsx`
- `components/ui/context-menu.tsx`
- `components/ui/form.tsx`
- `components/ui/item.tsx`
- `components/ui/kbd.tsx`
- `components/ui/menubar.tsx`
- `components/ui/native-select.tsx`
- `components/ui/navigation-menu.tsx`
- `components/ui/scroll-area.tsx`
- `components/ui/slider.tsx`
- `components/ui/spinner.tsx`
