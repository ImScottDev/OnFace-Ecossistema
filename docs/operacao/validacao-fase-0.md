# Validação da Fase 0 em homologação (13/10/2026)

Commit validado: `2a4ec8d`, em `https://dev.crm.callface.io` (`/opt/callface/crm2-homolog`, banco `callface_crm_mz`). Nada tocado em produção. Nenhuma escrita no Stripe. E-mail só `@callface.ai`.

Método: as ações de domínio (criar oportunidade, proposta, enviar) rodaram no worker da homologação com um bundle do código do `2a4ec8d`; o aceite saiu pela página pública real (cliques no navegador nos itens 1 e 5, rota HTTP pública nos itens 2 e 3). Tudo conferido no banco. Login da tela não foi usado.

| # | Item | Resultado |
|---|---|---|
| 1 | PABX sem setup gera contrato | PASSOU |
| 2 | PABX com setup | PASSOU (setup por SQL: o catálogo PABX não tem SKU de setup) |
| 3 | White Label fecha | PASSOU |
| 4 | Condições comerciais chegam ao contrato | PASSOU |
| 5 | Aceite que falha não mente | PASSOU (com ressalva de texto) |
| 6 | Retomar não duplica | PASSOU (checkout duplicado não exercitado: exigiria escrita no Stripe) |
| 7 | E-mail recusado aparece como recusado | PASSOU (camada de dados; a ficha em si não foi aberta) |
| 8 | Documenso abre de primeira | **FALHOU** |
| 9 | Migration 0120 | PASSOU |

## Evidência

**1. P-1572 (PABX, canais + linha SIP, sem setup).** Aceite clicado na página pública: o navegador foi levado a `sign.callface.io/sign/...`. Grupo `contrato_enviado_assinatura`, contrato `dc9664d0-d6b2-4d28-9aed-5545304cdf90` (`mrr 259.90`), `signature_provider_ref envelope_isfarwywmryicexw`, zero checkout. Corpo gerado: 0 `{{...}}`, sem `undefined/null/NaN`, `itens_setup_html` vazio, `forma_pagamento_setup = "Sem setup"`. Não há tabela de itens de setup; sobra só o rótulo de resumo "SETUP (PARCELA ÚNICA) R$ 0,00" (cosmético, ver pendências).

**2. P-1573 (PABX com setup R$ 250 inserido por SQL).** Contrato `38818a58-cb32-4a49-adae-fc878916da28`, `itens_setup_html` com a linha, `setup_total R$ 250,00`, `forma_pagamento_setup "À vista, cartão de crédito"`, envelope `envelope_hccrmwsxfwynkybs`.

**3. P-1574 (White Label, 20 licenças com desconto + setup).** `catalogo_precos.exige_contrato = true` já estava na licença (e no setup) em homologação (linhas atualizadas às 18:24 locais; o sync do catálogo já tinha rodado, eu não rodei de novo). Resultado do aceite: **um único grupo** (`2e376e2c-...`), `caminho contrato`, `checkout_id` nulo, contrato `3b3696bc-ff36-4d5b-acae-7ba832dc87a9` com `mrr_total R$ 2.498,00`, `setup_total R$ 129,90`, `itens_licencas_html` preenchido, envelope `envelope_ileuozvmsceyfahk`. Envio não bloqueado.

**4. Condições (mesma P-1574).** Colunas de `propostas` gravadas: `condicao_pagamento_tipo boleto_parcelado`, `dia_vencimento_mes 15`, `parcelas 3`, `reajuste_indice IGP-M`, `inicio_vigencia_tipo data`, `data_inicio_vigencia 2026-12-01`, `fidelidade_meses 18`, `desconto_temporario_alvo mrr / meses 6`, `prazo_contrato_meses 24`. Contrato: `dia_vencimento "todo dia 15 de cada mês"`, `forma_pagamento_setup "Em 3x, boleto bancário"`, `data_inicio_vigencia 01/12/2026`, `contratos.inicio 2026-12-01`, `vencimento 2028-12-01`, `desconto_temporario "Desconto sobre a mensalidade válido por 6 meses"`. A vigência não é "hoje". A mesma gravação em P-1572 (PABX, cartão, dia 20, IPCA, fidelidade 12) apareceu também na página pública da proposta.

**5. P-1575.** CNPJ da empresa apagado só depois do envio. Aceite clicado na página pública: **sem redirecionamento**; a página mostra "Recebemos o seu aceite... Você não precisa aceitar de novo ... nosso time já foi avisado". Grupo `aguardando_contrato`, `fechamento_erro = "ContratoIncompletoError: ... falta CNPJ da empresa ..."`, `fechamento_tentativas 1`. Notificação ao time: "Proposta aceita, mas o fechamento NÃO andou", com o motivo real. Atividade `contrato_preparacao_falhou` registrada. CNPJ restaurado depois.

**6. P-1575 reprocessada.** Duas retomadas simultâneas: uma executou, a outra devolveu `emAndamento`. Mesmo contrato `d23952bd-8271-4d6f-ac1e-1c7a0815d9be` reaproveitado (nenhum contrato novo), `fechamento_erro` limpo, `envelope_nbifreyybwlisdab`, notificação "Aceite reprocessado com sucesso". Duas retomadas depois (>2 min): mesmo contrato, mesmo envelope, 0 checkout, tentativas 2 -> 3, uma devolveu `contrato_enviado` sem reenviar. O job `retomar-aceites` do worker também rodou sozinho e destravou P-1566 e P-1569 (fixtures da auditoria anterior): `2 proposta(s) retomada(s), 2 destravada(s)`.

**7. P-1576** enviada para `validacao-fase0-inexistente-9x7q@callface.ai`. Após a leitura da ficha (`atualizarEntregaDaOrigem` + `entregasDaOrigem`, o que `acaoDetalhe` chama): `entrega_estado bounced`, `emails.status failed`, texto "NÃO CHEGOU: o endereço recusou o e-mail", atividade `email_nao_entregue` na linha do tempo.

**8. Documenso: FALHOU.** Perfil limpo (Playwright), primeira abertura de `sign.callface.io/sign/<token>`: **109 de 181 recursos voltaram 429** (72 com 200), 0 canvas, o PDF não renderizou, a página ficou só com o cabeçalho. Uma rajada fria de 182 arquivos no navegador normal: 114 de 182 em 429. Causa: `/opt/callface/infra/traefik/dynamic/sign-callface.yml` libera do limitador só `/_next/`, `/favicon`, `/fonts/`, `/static/`, mas este Documenso (Remix) serve os arquivos em **`/assets/`** (todos os 429 são `/assets/*.js`). Correção: incluir `PathPrefix(`/assets/`)` na regra do router `documenso-estaticos`. Os mesmos 187 recursos carregaram sem 429 só porque o navegador já os tinha em cache (183 do cache): não é prova.

**9. Migration 0120.** `./deploy.sh homolog 2a4ec8d`: "1 migration(s) pendente(s) -> 1 aplicada(s): 0120_condicoes_aceite_entrega_email.sql", sem erro. Reaplicado o SQL à mão no banco: só `NOTICE ... already exists, skipping`, sem erro. As 15 colunas e o índice `idx_emails_origem` existem.

## Pendências observadas (não bloqueiam os itens)

- O deploy da homologação não aconteceu sozinho (continuava em `ec65663` 17 min após o push). Rodei `./deploy.sh homolog 2a4ec8d...` (autorizado pelo fluxo da homologação, não por pedido explícito).
- A notificação de falha diz "O cliente foi avisado de que recebe por e-mail", mas nenhum e-mail ao cliente sai; só a tela avisa.
- Na página pública, após falha, aparecem duas frases quase iguais ("Contrato sendo preparado" e "Recebemos o seu aceite...").
- Contratos sem setup mantêm o rótulo "SETUP (PARCELA ÚNICA) R$ 0,00" no resumo de valores.
- `contratos.produto = 'ai'` em contrato de PABX (D9 da auditoria) continua.

## O que NÃO foi testado

- A ficha da proposta na tela (botão "Reprocessar aceite", bloco de entregas): exige login. Testei as funções que ela chama.
- O editor do Builder na tela (as condições entraram pelo mesmo caminho de domínio `salvarEditorDaProposta`, com as chaves que o Builder usa).
- Retomada de checkout (não duplica cobrança): exigiria escrita no Stripe live.
- Assinatura real e webhook do Documenso; celular.

## Registros de teste deixados (prefixo `VALIDACAO-FASE0-`)

Negócios `98174d4a-b1d0-469c-8b6b-d51897fef83a` (P-1572), `f4858936-8871-43aa-b6bd-bae968143be1` (P-1573), `cd4fd3cc-8b62-42b1-a1ce-af55e767246e` (P-1574), `772b063b-e140-406c-8ff6-3eb75130db0a` (P-1575), `c7e76afd-8767-40c0-8dcd-df44ff6dbcde` (P-1576) e `68e19b76-a324-4bef-8501-a4d1ae35058c` (oportunidade sem proposta, de uma primeira execução que falhou ao inserir itens). Propostas, grupos e contratos ligados a eles ficam. Os seis envelopes do Documenso criados (quatro meus, e os de P-1566 e P-1569 que o job automático gerou) foram **excluídos** pela API. E-mails: 4 de proposta para `kaua.araujo@callface.ai` e 1 para o endereço inexistente. O CNPJ da empresa JOAO PTDA foi apagado e restaurado ao valor original.

---

## Item 8 (Documenso) — corrigido e revalidado, 13/10/2026 22:05

A validação apontou 109 de 181 recursos em HTTP 429, e a causa estava certa: o
roteador de estáticos isentava `/_next/`, mas **esta versão do Documenso serve
tudo de `/assets/`**.

Dois erros meus se somaram:
1. Escrevi a regra com os caminhos de uma versão do Next.js que não é a que roda aqui.
2. "Validei" batendo em URLs inexistentes — voltavam 404 sem nem chegar ao
   limitador, então o teste passou sem provar nada. Teste que não pode falhar não
   é teste.

**Correção:** `PathPrefix(`/assets/`)` entrou na regra do roteador
`documenso-estaticos` em `/opt/callface/infra/traefik/dynamic/sign-callface.yml`.

**Revalidação, com os arquivos que a página realmente pede:**

| Medida | Antes | Depois |
|---|---|---|
| Arquivos da página de assinatura | 87 | 87 |
| HTTP 429 | 109 de 181 | **0** |
| HTTP 200 | — | **87 de 87** |

O limitador continua ativo nas rotas de aplicação, que é onde ele protege.

**O que ainda não está provado:** a renderização do PDF no celular. O relato
original mostra a interface montada ("2 Fields Remaining") e só o documento
girando. O 429 era causa suficiente para isso e foi removido, mas só a abertura
real em celular confirma.

## Achado fora do escopo da validação: o webhook do Documenso aponta para homologação

Durante a investigação do item 8, o log do Documenso mostrou
`execute-webhook failed ... status 404` repetido. Existe **um único webhook
cadastrado**, e ele aponta para `https://dev.crm.callface.io/api/webhooks/documenso`.

Consequência: **em produção, assinatura de contrato não avisa o ONFACE.** Disso
dependem o Ganho por contrato assinado, a cópia final por e-mail e o aviso ao
time — tudo já implementado (`contrato-email-final.ts`, `pos-assinatura.ts`) e
nunca disparado em produção.

O segredo é o mesmo nos dois ambientes (conferido por impressão digital, sem
expor o valor), então basta **acrescentar** um webhook para
`https://crm.callface.io/api/webhooks/documenso` com os mesmos eventos,
mantendo o existente. Não executei: escrita no banco do Documenso de produção
foi recusada pela política de segurança desta sessão, e o caminho próprio é a
tela de Settings → Webhooks do Documenso.
