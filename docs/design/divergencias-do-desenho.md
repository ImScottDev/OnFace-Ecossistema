# Divergências deliberadas do desenho

Lugares onde o código gerado a partir do Claude Design foi alterado à mão, com
autorização. Quem regerar a tela precisa incorporar isto no desenho, não
sobrescrever.

## Atendimento — modal "Criar lead" (autorizado pelo Scott, 13/10/2026)

Arquivo: `app/src/components/onface/proto/AtendimentoDesenho.tsx` (bloco `nl`).

O desenho só criava lead em Pré-vendas. Foi acrescentado, e só isto:

1. Os dois cartões de destino, "Só salvar na base" e "Enviar para Pré-vendas",
   o mesmo componente de Contatos & Empresas (`destino-do-cadastro.tsx`).
2. Título e rótulo do botão dinâmicos (`nl.titulo`, `nl.botao`).
3. A faixa "Entra em Pré-vendas · Novo" só aparece quando o destino é Pré-vendas
   (`nl.mostraEntra`).

O padrão do seletor é "Enviar para Pré-vendas" (o comportamento anterior).
A gravação é `acaoCadastrarContato` com o `destino` escolhido.

## Proposta — Fidelidade no White Label (autorizado pelo Scott, 19/10/2026)

Arquivo: `app/src/components/onface/proto/PropostaDesenho.tsx` (passo 3,
"Condições" → cartão Recorrência).

No desenho, Fidelidade e Reajuste anual estavam dentro do mesmo `sc-if` de
"Início da cobrança" (`f2.naoWl`). Em proposta de família White Label os três
sumiam juntos — mas só o "Início da cobrança" não se aplica ao White Label
(a cobrança começa a cada ativação de licença, não em uma data única).

Fidelidade e Reajuste continuavam valendo: o padrão de 12 meses e o IPCA
apareciam na pré-visualização e iam para o contrato (`fidelidade_meses`,
`prazoContratoMeses`) sem que ninguém pudesse mudá-los na tela.

A alteração foi tirar o `sc-if` do bloco de Fidelidade + Reajuste. O
"Início da cobrança" segue escondido no White Label, com o mesmo `f2.naoWl`.

Junto, em `PropostaLiga.tsx` e `PropostaDesenho.logica.txt`: o resumo de
condições do passo 5 (`condE`) omitia a linha de fidelidade quando a família
era White Label. Agora ela aparece em toda família, como já aparecia no
painel lateral de pré-visualização.
