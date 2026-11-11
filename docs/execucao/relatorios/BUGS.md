# Bugs e erros de relatórios (registro do Kauã/Scott)

Modo de trabalho (definido em 12/10): o Scott limpa o contexto, vai apontando erros parte por parte, e eu só ANOTO aqui, sem corrigir. Quando ele disser "fecho", corrijo o primeiro lote. Cada item: tela/URL, o que viu, o que esperava, severidade (bloqueia / errado / feio), status.

Formato:
- [ ] B001 · tela/URL · o que acontece · o que deveria acontecer · severidade

## Lote 1 (aberto)

- [ ] B001 · Pré-vendas (drawer) x timeline canônica · ação do time (ligação, 1º contato, mudança de etapa) grava em `vendas_eventos`/`status_changes`/`communications` pelo lead legado; `timeline_events` da aquisição parou de receber em outubro (17% out, 0% nov). Quem lê só `timeline_events` vê "sem contato" em lead atendido (ex.: Fabiane/Pizzaria, 11/11: 2 ligações e etapa movida às 09:20, zero na canônica) · ação do runtime também projetar em `timeline_events` com `aquisicao_id` · errado · achado 11/11 pelo painel de aquisição
- [ ] B002 · Cadastro em dobro · 78 aquisições gêmeas (mesma pessoa+empresa, criadas no mesmo minuto), quase todas de 08 a 12/10 (virada). Pessoa, empresa e aquisição em 2 ou 3 cópias; o board mostra uma, a gêmea fica em "Em contato" com outro responsável; oportunidade e eventos ficam numa terceira pessoa (ex.: Mateus/Avantt Company: pessoas 001f9562, de01dc96, 43f909ae; aquisição boa 643ac31b, gêmea f8d0f909) · unificar pessoas/empresas e apagar a aquisição gêmea · errado
- [ ] B003 · Board de pré-vendas atrasado · aquisição fica em "Novo"/"Em contato" depois de a oportunidade nascer ou ser ganha: 216 leads com oportunidade e 124 vendas ganhas com board em Novo/Em contato desde maio (maioria carga mai/jun; 16 vendas de setembro; 24 vendas e 4 oportunidades nos últimos 90 dias). Relatório por etapa conta errado · mover a aquisição para Oportunidade quando a oportunidade nasce + correção única das antigas · errado

## Pistas minhas, ainda NÃO confirmadas (verificar antes de afirmar)
- Hidratação regenera de forma intermitente no dev (0 em 32 cargas simples, ~1 a 3 por rodada do roteiro completo). Checar com build de produção.
- Booking com um dia isolado de R$ 69 mil (22/09): pode ser carga em massa ou registro estranho. Não investigado.
- Composição por família do booking mostra 100% "Sem família" (oportunidades.service_family quase todo nulo).
- Banco local é cópia de 06/10: "mês atual" termina em 06/10, KPIs de mês corrente parecem queda por isso.
- Revisão independente do Codex não retornou resultado.
