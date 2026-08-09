# Relatório de Duplicidade de Contratos — F4, gerado 09/08/2026 (banco LOCAL, mirror de produção)

Gerado por `npm run db:relatorio-duplicidade-contratos` (`app/src/lib/db/relatorio-duplicidade-contratos.ts`).
SÓ LEITURA — nenhuma correção foi aplicada. Checkpoint humano explícito, decisão do Kauã sobre os grupos abaixo.

```
=== Relatório de Duplicidade de Contratos (F4, só leitura) ===
Organizações: 1. Grupos com 2+ contrato ativo do mesmo lead+produto: 57
Classificação (via avaliarContratosAtivosDuplicados, o mesmo helper que o código de produção usa):
  upsell_confirmado (NÃO TOCAR, venda real em paralelo): 68
  obsoleto_confirmado (seguro marcar renovado):          4
  ambiguo (precisa revisão humana, SEM assinatura):      58
--- obsoleto_confirmado (candidatos a marcar 'renovado', NADA APLICADO) ---
  contrato d5008d8a-319b-4fff-974e-f594c4778c32 | lead 828cc87d-86d4-49a4-be74-8a63981fc8f2 | mrr R$3058.30 | criado 2026-07-20 | stripeSubId=sub_1TvKh2Ed4dqxpSBf5kEVBeHD
  contrato a5d5663d-6084-43bb-9173-c0bb00048dc1 | lead c5d9518b-1bdd-4c1d-b306-07631488b695 | mrr R$450.00 | criado 2026-07-01 | stripeSubId=sub_1TZFxjEd4dqxpSBf0NYQRSLF
  contrato 7375fa39-3c97-4abc-90aa-983a5158ebd1 | lead 7dfcfa08-a055-4285-baa7-f0c95dc26dac | mrr R$89.90 | criado 2026-08-06 | stripeSubId=sub_1U1QLgEd4dqxpSBfSdtq4RPR
  contrato a1698ebf-7119-4b2b-8761-de55110ea969 | lead e8515168-7a4f-4cca-bb13-f8bd78e85e4b | mrr R$629.90 | criado 2026-07-01 | stripeSubId=sub_1Tjm9OEd4dqxpSBficczewJC
--- ambiguo (precisa decisão do Kauã, NADA APLICADO) ---
  contrato 5ef3efe3-00c7-40f3-b0c3-8aefa95ddd10 | lead c2a3d299-fae0-41b7-8af2-b428d35f1281 | mrr R$149.90 | criado 2026-07-22 | stripeSubId=sub_1Tw7IxEd4dqxpSBflN1TtoBG
  contrato 10047c01-e064-4751-96a0-1260b6865076 | lead f19cf9b1-bf76-4e40-b6e9-c2cc7a5be777 | mrr R$2857.80 | criado 2026-07-29 | stripeSubId=sub_1Tye9XEd4dqxpSBfiaIWgCcj
  contrato e457bacd-16a2-4c58-b5c0-9a626bef98d8 | lead 66baf432-2ea8-4f29-8232-66262f9759e1 | mrr R$899.50 | criado 2026-07-16 | stripeSubId=(nenhum)
  contrato 19502bd3-ee0b-401e-89ee-e1029a4f43d4 | lead 338b0bd5-9aa9-41d5-a5e3-eb97c3b4c331 | mrr R$539.70 | criado 2026-08-06 | stripeSubId=sub_1U1VceEd4dqxpSBfLhhO2PFw
  contrato 688f5bbd-2a21-43e0-bd5c-4f2aaef0d3e1 | lead 828cc87d-86d4-49a4-be74-8a63981fc8f2 | mrr R$1439.20 | criado 2026-07-20 | stripeSubId=(nenhum)
  contrato 9be0d0c2-66ad-4456-b630-9297c8b7292d | lead 53d1b5cb-e2ae-43e1-824b-3b212a0f6756 | mrr R$179.90 | criado 2026-07-31 | stripeSubId=sub_1TzGkaEd4dqxpSBf4cxeolRS
  contrato 3cb2cdb5-4fcb-4bf0-80a6-0ba2ff2ca10c | lead 5adc2ac1-931e-4099-8654-992db4494581 | mrr R$269.70 | criado 2026-08-04 | stripeSubId=sub_1U0nlwEd4dqxpSBfDoTq1TJN
  contrato ac622b25-9c69-4364-9b38-3694a05d6d0d | lead 7b4ea0f0-6d93-4d12-b894-81da4d7c2e05 | mrr R$179.90 | criado 2026-07-31 | stripeSubId=sub_1TzMh2Ed4dqxpSBfB6D7piWq
  contrato 6a447a1f-ab3e-494d-8121-f5c3b5d54254 | lead 1d3db0d5-315c-49b9-acb2-3c1e3d0a2310 | mrr R$539.70 | criado 2026-07-14 | stripeSubId=(nenhum)
  contrato b948cb72-a33a-4840-b265-ebb5fe83d65e | lead a41ba6de-584d-4ff0-b779-52e9e172caf5 | mrr R$359.80 | criado 2026-07-28 | stripeSubId=sub_1TyIB7Ed4dqxpSBfaH4TAwJd
  contrato 67ea0b19-d6a1-482f-93d4-a2674016e460 | lead a41ba6de-584d-4ff0-b779-52e9e172caf5 | mrr R$89.90 | criado 2026-07-30 | stripeSubId=(nenhum)
  contrato 486dc7bc-f129-4c94-81de-b0b90e3f187a | lead 72b34b79-aec4-4b88-a662-bf8013c4021e | mrr R$9093.00 | criado 2026-07-14 | stripeSubId=(nenhum)
  contrato 821b21f0-00e7-42a2-8750-7d3283ffb09d | lead aef088d7-ca5c-4962-a5ed-e2d1ccae5d8d | mrr R$89.90 | criado 2026-07-15 | stripeSubId=(nenhum)
  contrato dcfa533c-d339-4434-bb29-ffbc1473cc55 | lead d33f0aca-5931-4a4c-90dc-2a9b0cd5cb92 | mrr R$179.90 | criado 2026-07-31 | stripeSubId=sub_1TzH2IEd4dqxpSBfOzc5bUTN
  contrato d18ba7d7-3d52-492b-a1de-bb4b7896689f | lead 77ef7463-f882-4620-8d43-9214fab84394 | mrr R$89.90 | criado 2026-07-16 | stripeSubId=(nenhum)
  contrato b52fa4e3-51e3-4556-a51a-2a775b4fc1a2 | lead d9abcd98-32bf-45e1-a8e5-57d2d94723b3 | mrr R$629.90 | criado 2026-07-30 | stripeSubId=sub_1TyxtHEd4dqxpSBfUj66ZsUl
  contrato fa1a93d8-5427-4e57-932c-c7bd600c8626 | lead ea952314-f027-41bc-a4a4-456851e88c99 | mrr R$179.90 | criado 2026-07-27 | stripeSubId=sub_1TxvaVEd4dqxpSBfIpf988rG
  contrato 6056bfbb-5f99-45bf-94be-219e461d0a04 | lead ea952314-f027-41bc-a4a4-456851e88c99 | mrr R$149.90 | criado 2026-08-03 | stripeSubId=sub_1U0N64Ed4dqxpSBfGjlJO1pZ
  contrato 6db3a153-ee75-44ee-9c70-a52533f03035 | lead 60627101-e4b2-4a39-a5d9-07407cded19e | mrr R$179.90 | criado 2026-07-20 | stripeSubId=(nenhum)
  contrato c8783069-b8f3-4c23-b66c-ba9b59852e5e | lead 651a00ac-11bc-46cc-81b4-9226929e152c | mrr R$809.50 | criado 2026-07-29 | stripeSubId=sub_1TydacEd4dqxpSBfuFy8LGqW
  contrato 0dc30cf7-716a-4c18-97e6-24d18713cb98 | lead 74416654-b140-42ee-8d9e-3a4aa2fb857b | mrr R$89.90 | criado 2026-07-20 | stripeSubId=(nenhum)
  contrato 5066c19d-0bd7-45e2-adf2-aae3d816fcbb | lead a301bd4f-37ae-42a5-bf7c-9cc277a5d58d | mrr R$129.90 | criado 2026-08-05 | stripeSubId=sub_1U1ASqEd4dqxpSBfpUUgdm8G
  contrato eeb93ab3-52b7-4574-ae92-c7336dc42769 | lead a301bd4f-37ae-42a5-bf7c-9cc277a5d58d | mrr R$129.90 | criado 2026-08-05 | stripeSubId=sub_1U19TbEd4dqxpSBf1JThb3lY
  contrato 2915c69f-4dfd-4945-acdb-9450638154c8 | lead 5fa253a1-3890-45cf-9824-dd0c2346ee6d | mrr R$89.90 | criado 2026-07-31 | stripeSubId=sub_1TzIN2Ed4dqxpSBfsy9MQTZg
  contrato 253958ba-c4b1-4700-9b5f-391b8c96f9bc | lead 4f766136-974e-43d3-ba34-94a3cd85640d | mrr R$179.90 | criado 2026-07-17 | stripeSubId=(nenhum)
  contrato 2ff2a8a3-71e4-4b2b-a0a5-94c403538aa1 | lead 4f766136-974e-43d3-ba34-94a3cd85640d | mrr R$100.00 | criado 2026-07-27 | stripeSubId=(nenhum)
  contrato a945498b-eac6-4b29-99c5-7fc637378af4 | lead 4f766136-974e-43d3-ba34-94a3cd85640d | mrr R$1259.30 | criado 2026-07-27 | stripeSubId=sub_1TxoSyEd4dqxpSBf5KgCXnTu
  contrato 2ae09bb9-9163-444e-96b9-03161f9be9ab | lead 4f766136-974e-43d3-ba34-94a3cd85640d | mrr R$539.70 | criado 2026-07-29 | stripeSubId=sub_1TycztEd4dqxpSBf0WdQTAOg
  contrato cee84357-e4bb-4ef1-8593-24b817adb332 | lead 90e651f9-f8fa-4d45-a191-5bc4096cf90f | mrr R$629.90 | criado 2026-07-29 | stripeSubId=sub_1TyWy7Ed4dqxpSBfWgO0Y7fY
  contrato 74b84948-a56d-41a9-be89-df6b76a28809 | lead edab96b9-18b4-4fba-83b1-77d9fbae2a20 | mrr R$89.90 | criado 2026-07-20 | stripeSubId=(nenhum)
  contrato 9f582c35-44d9-4942-bedb-03629d917121 | lead 9554086e-a457-4b73-9c19-53eaf785c5a2 | mrr R$179.90 | criado 2026-07-28 | stripeSubId=sub_1TyEbOEd4dqxpSBfwk0dAi9Z
  contrato 92472624-af79-4698-895f-203dc04fd34b | lead 0611c0d9-c7ef-4dce-a211-780090783fcd | mrr R$359.60 | criado 2026-07-13 | stripeSubId=(nenhum)
  contrato 5431e5ae-bb72-4808-b1e0-cba580f1b4d6 | lead 5b56c004-42c1-424c-af45-cb4f5e5b4711 | mrr R$179.90 | criado 2026-07-29 | stripeSubId=(nenhum)
  contrato 6bb12e91-3803-4b01-b55a-8bf642676e1c | lead 9ff77268-4c02-47ef-8cdb-fa7f471667ab | mrr R$179.90 | criado 2026-08-05 | stripeSubId=sub_1U14yNEd4dqxpSBf2bOWi4zx
  contrato b3ecd7a7-fa10-4e7e-8e46-e878f3da65ec | lead a3d66349-9bce-4d48-8141-098dfbfc8e34 | mrr R$809.50 | criado 2026-07-30 | stripeSubId=sub_1TyttEEd4dqxpSBfdxVQQZ9s
  contrato 4f5898a8-6c19-42bd-9616-21f2934b3007 | lead 88cca8c6-0c2c-4b2e-9245-9e624587ccdd | mrr R$1169.30 | criado 2026-07-28 | stripeSubId=sub_1TyHjSEd4dqxpSBfKpHTAF9C
  contrato 3dadb183-e69e-4228-8d22-bbe01000bb74 | lead 88cca8c6-0c2c-4b2e-9245-9e624587ccdd | mrr R$179.90 | criado 2026-08-06 | stripeSubId=sub_1U1RUzEd4dqxpSBflTVDx6Pv
  contrato de6deca1-1a09-4b2a-bdf4-b989ec5830fd | lead 88cca8c6-0c2c-4b2e-9245-9e624587ccdd | mrr R$359.80 | criado 2026-08-06 | stripeSubId=sub_1U1QkIEd4dqxpSBfgdnkAUTI
  contrato f6a44b9a-568a-4e2e-bca6-d57f34d4f109 | lead c66329fb-a6e9-456e-a219-d25f1f76b39c | mrr R$179.99 | criado 2026-07-02 | stripeSubId=(nenhum)
  contrato 3cfd7676-80ca-4af8-b05a-6a257cf25565 | lead c84f9411-42e9-4e46-8820-8ee2caf7b07a | mrr R$269.90 | criado 2026-08-05 | stripeSubId=sub_1U13u4Ed4dqxpSBfCKhQ66HS
  contrato f9f8bd18-a3fb-451f-9dfe-af00f43495d5 | lead af52bb61-2838-460f-a86b-3f94bb525ab3 | mrr R$179.90 | criado 2026-08-04 | stripeSubId=sub_1U0oN7Ed4dqxpSBfR1g8ckuP
  contrato fa936d8c-be14-46dd-9dee-6a9ba6680a63 | lead daae5694-aa93-4444-964a-e106e4714829 | mrr R$269.70 | criado 2026-08-05 | stripeSubId=sub_1U16pOEd4dqxpSBf2JUTBPMZ
  contrato cc475312-3233-48b1-aed6-157effd5f0db | lead 46f0ce42-4c47-4444-8f7f-19a5fddaf66e | mrr R$500.00 | criado 2026-07-31 | stripeSubId=(nenhum)
  contrato 42c55df8-b088-4812-80d5-bd5828e5555e | lead 46f0ce42-4c47-4444-8f7f-19a5fddaf66e | mrr R$500.00 | criado 2026-07-31 | stripeSubId=(nenhum)
  contrato 7d2b613d-b1a0-4668-b672-7e51b593bdca | lead 993c2af6-907e-4780-81d8-7609deefccfc | mrr R$719.60 | criado 2026-07-23 | stripeSubId=(nenhum)
  contrato 8b2f13e1-c844-4da8-a260-38e2f795de62 | lead 9aa33379-11ee-4d21-a56f-9ab8b8ac9156 | mrr R$179.80 | criado 2026-07-02 | stripeSubId=(nenhum)
  contrato 90b484fd-d811-4416-955e-adf98c1ef749 | lead 6f443b66-cc73-46a6-94d1-7d3d33f3f0fa | mrr R$359.80 | criado 2026-07-24 | stripeSubId=sub_1TwpsFEd4dqxpSBfNcvwcN0D
  contrato 82b81d4f-cf3c-4b20-85d2-ed4cc9718f1c | lead 22aaf0c8-dd86-460c-80eb-5a599da1100f | mrr R$179.90 | criado 2026-08-06 | stripeSubId=sub_1U1Ux3Ed4dqxpSBfZPTGZRxO
  contrato 0ca48745-3395-4eff-8a39-f568b3bec454 | lead 4c05c84f-83d1-486e-872f-d593ac9263db | mrr R$179.90 | criado 2026-07-29 | stripeSubId=sub_1TyfwDEd4dqxpSBf1uzQ211x
  contrato c2e22f18-009a-40c9-a2dc-c817cceb45d7 | lead ab7b30db-ec6a-4bb4-891b-7c4a50aefef8 | mrr R$449.70 | criado 2026-08-03 | stripeSubId=sub_1U0L2LEd4dqxpSBf5tl6EQDl
  contrato 80002656-9bc8-4123-a74b-9955e5328aa0 | lead ae6b8e92-4858-4983-8e95-4a8d3bd4fdd7 | mrr R$89.90 | criado 2026-07-22 | stripeSubId=sub_1Tw1tAEd4dqxpSBfEPHdMYNH
  contrato ab5ae9d0-659f-49f1-b9d0-c2442e215eb1 | lead 67528f10-f124-43c5-a86e-8e343dc1eb11 | mrr R$359.80 | criado 2026-07-02 | stripeSubId=(nenhum)
  contrato 47617080-2abf-4ba7-b8ba-fc0d392d7bed | lead 2b6592e4-153f-482b-a769-aa41bc415f0d | mrr R$539.70 | criado 2026-08-03 | stripeSubId=sub_1U0NL6Ed4dqxpSBf5VAi5Cdo
  contrato 7fb977ce-4b56-482f-b3d4-2ebe6f134e52 | lead 95e8551a-6d18-4ed5-a704-860ce08b9252 | mrr R$269.80 | criado 2026-07-02 | stripeSubId=(nenhum)
  contrato a2ba68dc-4cb6-46c9-b7c9-5e0e947462e9 | lead 25ba01e5-1378-48c3-a572-ebb366f5c63c | mrr R$359.60 | criado 2026-07-30 | stripeSubId=(nenhum)
  contrato 0a90b79a-5600-4146-8e2e-af76e11a7452 | lead e8515168-7a4f-4cca-bb13-f8bd78e85e4b | mrr R$359.80 | criado 2026-07-28 | stripeSubId=sub_1TyHoLEd4dqxpSBfh9CzlViQ
  contrato 6b25c6bc-44cd-43ff-b328-1357c3646063 | lead ad8443b4-8d5e-4602-ad0c-2da86fec598c | mrr R$2248.50 | criado 2026-07-28 | stripeSubId=sub_1TyH38Ed4dqxpSBfpDSQEkZo
  contrato cfc368b7-e96f-4ef9-b437-f4285c9aa0d0 | lead e4ef8241-80c9-4082-a318-59cf4075bb63 | mrr R$179.90 | criado 2026-07-28 | stripeSubId=sub_1TyHwrEd4dqxpSBf5tRKZuVN
MRR em excesso (linhas duplicadas por stripe_subscription_id, mesmo critério da auditoria original): R$17449.30
```
