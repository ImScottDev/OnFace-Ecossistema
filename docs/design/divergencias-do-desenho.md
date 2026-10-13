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
