# ADR — Preparação contratual baseada no histórico Zoho

Data: 2026-08-23  
Status: aceito para implementação aditiva

## Evidência observada

- `Data_001/Data/Contratos_001.csv` contém 279 contratos: 234 criados, 27 assinados, 16 enviados ao cliente e 2 cancelados.
- Prazo histórico: 171 contratos de 36 meses, 37 de 12, 26 de 24, 3 de 1, 1 de 48 e 41 sem prazo útil/zero.
- Multa registrada em 256 contratos como 30% e em 6 como 10%; não é seguro transformar isso em default universal.
- `ZohoSign Recipients_C_001.csv` tem 1.257 linhas, múltiplos destinatários e ordens de assinatura até 6. A exportação não possui campo jurídico confiável de vendedor/testemunha.
- Em uma amostra local de 60 PDFs, 20 citam explicitamente duas testemunhas e 32 citam testemunhas; 58 citam assinatura eletrônica/DocuSign/ZohoSign.

## Decisões

1. Propostas cujo modelo comercial exige contrato devem coletar signatários e prazo em meses antes do envio.
2. O prazo é persistido na proposta e copiado ao contrato preparado; não existe default jurídico inventado.
3. Nome, e-mail, papel e ordem permanecem editáveis. O campo de papel aceita representante legal, vendedor, testemunha ou outro papel definido pela operação.
4. Não atribuir automaticamente vendedor/testemunha apenas por domínio de e-mail ou histórico Zoho, porque a exportação não prova o papel jurídico.
5. Variáveis comerciais são preenchidas automaticamente. Texto jurídico continua vindo do template configurável e não é substituído por cláusulas copiadas de PDFs históricos.
6. O checklist White Label deixa de exibir `[EXEMPLO]` e passa a registrar somente passos operacionais sustentados pelo mapa de produto, sem inventar provisionamento técnico.

## Consequência

O envio bloqueia apenas propostas contratuais sem signatário ou prazo. Propostas sem contrato continuam seguindo o caminho de pagamento direto. A decisão preserva a proveniência histórica e mantém a futura troca do provider de assinatura atrás de `SignatureProvider`.
