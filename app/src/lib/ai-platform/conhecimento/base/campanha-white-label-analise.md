---
slug: campanha-white-label-analise
nome: Análise da campanha White Label
categoria: playbook_sdr
governanca: rascunho
origem: vault:02_PROJETOS/Callface/Growth/comercial-growth/analise-campanha-white-label-2026-09-08.md
nota: análise de campanha, não é playbook aprovado de White Label
gerado_em: 2026-10-12
---

# Campanha White Label, análise de conversões

## Fonte

Export RD Station: `rd-wevy-leads-trt-lead-aquisicao-white-label-ii-callface.csv`, recebido em 2026-09-08.

## Achados

- 92 leads no total.
- 89 leads com origem `Busca Paga | ig` e 3 com origem `Desconhecido`.
- 15 pessoas declararam cargo de dono, fundador, CEO, sócio, empresário, empreendedor ou presidente. Isso é autodeclaração e não comprova fit white label.
- 77 leads têm cargos claramente operacionais ou de execução, como atendente, repositor, auxiliar, motorista, vendedor, professor, enfermagem e operador.
- 64 e-mails são Gmail, 21 Hotmail, 3 Yahoo, 2 Outlook, 1 iCloud e somente 1 usa domínio corporativo próprio.
- A base não captura as perguntas que definem o ICP parceiro: tipo de empresa, número de clientes ativos, intenção de operar com marca própria e capacidade de distribuição.

## Interpretação

A campanha está otimizando para preenchimento barato de formulário no Instagram, não para parceiro white label. O ICP de parceiro é software house vertical, CRM vertical, consultoria, franqueadora ou empresa com base própria de clientes, conforme icp-personas e marketing-revenue-blueprint-2026.

## Ação recomendada

- Pausar o conjunto/anúncio atual, preservando a campanha e os dados.
- Criar uma nova versão com mensagem explicitamente dirigida a parceiros com base de clientes e interesse em oferecer tecnologia sob marca própria.
- Trocar o formulário por formulário de maior intenção, com perguntas obrigatórias sobre tipo de empresa, clientes ativos, papel na decisão e interesse em marca própria.
- Separar leads fora do ICP da fila de vendas e registrar o motivo da desqualificação.
- Manter como conversão principal interna o lead qualificado. Depois, devolver `QualifiedLead` via CAPI/offline conversion para a Meta otimizar por qualidade.
- Fazer triagem manual somente dos perfis que parecem ter decisão e algum potencial de canal, sem tratar cargo de dono como prova suficiente.
