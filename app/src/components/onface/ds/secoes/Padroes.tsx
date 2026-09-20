"use client";

/** Seção "Padrões" do laboratório.
 *
 * As outras seções documentam peças; esta documenta TELAS. Cada bloco aqui é
 * uma composição que já existe como problema no CRM da Callface e que nenhuma
 * primitiva resolve sozinha: convidar alguém sem estourar o contrato, mexer em
 * configuração sem perder o rastro de quem mexeu, contar o que mudou na versão
 * e deixar alguém entrar.
 *
 * Todas foram recriadas a partir da descrição de comportamento das referências
 * que o Scott mandou — o que o bloco precisa saber fazer, quais estados existem
 * e o que fica de cada lado. Nada foi baixado nem portado: a biblioteca de
 * origem é paga e o registry responde 401 sem licença. */

import * as React from "react";
import { Bloco, Regras, Secao } from "../lab";
import { Changelog, ConfiguracoesComAuditoria, DialogoConvite, TelaDeEntrada } from "../padroes";

export function SecaoPadroes() {
  return (
    <Secao
      titulo="Padrões"
      chamada="Quatro telas inteiras, não quatro controles. O que define cada uma é o que fica perto do quê e quais estados acontecem juntos: assento estourado bloqueia o envio, salvar vira linha de auditoria, e a tela de entrada não inventa depoimento para preencher a metade direita."
    >
      <Bloco
        titulo="Diálogo de convite"
        descricao="Convidar várias pessoas de uma vez para o workspace. O campo de e-mail aceita Enter, vírgula, ponto e vírgula e colagem de lista inteira; cada e-mail vira um chip removível e o que está fora do formato fica marcado em vermelho. Papel é escolhido por convidado, porque papel decide o que a pessoa enxerga do funil. O contador de assentos lê o contrato e bloqueia o envio quando estoura — cobrança surpresa não é um bom jeito de descobrir que o plano acabou."
        arquivo="ds/padroes.tsx"
        importar={'import { DialogoConvite } from "@/components/onface/ds/padroes"'}
        fundo="sunken"
      >
        <DialogoConvite />
      </Bloco>

      <Regras
        faca={{
          titulo: "Validar antes de habilitar o envio",
          texto: "O botão só liga quando há pelo menos um convidado, nenhum e-mail quebrado e assento sobrando. Quem errou vê o motivo no chip e no rodapé, no mesmo instante em que erra.",
        }}
        naoFaca={{
          titulo: "Deixar enviar e falhar no servidor",
          texto: "Enviar com e-mail inválido devolve um toast de erro sem dizer qual dos oito estava errado. O estado inválido tem que viver no chip, não numa mensagem genérica depois do envio.",
        }}
      />

      <Bloco
        titulo="Configurações em abas com trilho de auditoria"
        descricao="Abas para perfil, notificações e acesso, com um trilho fixo à direita. Salvar tem três estados de verdade (parado, salvando, salvo) e o rodapé nomeia quais campos estão sem salvar. Ao salvar, a alteração entra no topo do trilho em coral: é a prova de que o registro existe. Embaixo, o heatmap de atividade do usuário nas últimas 12 semanas, na mesma técnica do MapaDeContato — uma cor só, intensidade por color-mix."
        arquivo="ds/padroes.tsx"
        importar={'import { ConfiguracoesComAuditoria } from "@/components/onface/ds/padroes"'}
        fundo="sunken"
      >
        <ConfiguracoesComAuditoria />
      </Bloco>

      <Regras
        faca={{
          titulo: "Auditoria ao lado do campo",
          texto: "O trilho é sticky e fica colado no formulário: a pergunta 'quem mexeu nisso' nasce olhando para o campo. Em tela estreita ele desce para baixo do formulário em vez de sumir.",
        }}
        naoFaca={{
          titulo: "Auditoria numa tela separada",
          texto: "Trilho escondido atrás de outra rota só é consultado depois do incidente. E nada de heatmap com escala de duas cores: duas cores viram duas leituras e a pessoa passa a decorar legenda.",
        }}
      />

      <Bloco
        titulo="Changelog"
        descricao="Timeline de release: data e versão no trilho da esquerda, entrada à direita, com badge de tipo (novidade, melhoria, correção) e de impacto. É diferente da LinhaDoTempo de Registro e CRM — lá o eixo é a atividade do cliente (ligou, respondeu, mudou de etapa) e a data é metadado da linha; aqui o eixo é a VERSÃO, a data é coluna própria e alinha entre as entradas, para dar pra varrer 'o que saiu em setembro' sem ler nenhum título. Os chips filtram por tipo."
        arquivo="ds/padroes.tsx"
        importar={'import { Changelog } from "@/components/onface/ds/padroes"'}
      >
        <Changelog />
      </Bloco>

      <Regras
        faca={{
          titulo: "Coral só em novidade e em impacto alto",
          texto: "Novidade muda o que a pessoa pode fazer, impacto alto muda o que ela precisa saber hoje. Melhoria e correção são histórico e ficam em cinza.",
        }}
        naoFaca={{
          titulo: "Uma cor por tipo de entrada",
          texto: "Três badges coloridos fazem o changelog inteiro brilhar e nenhum tipo se destaca. Também não use este bloco para atividade de cliente: quem faz isso é a LinhaDoTempo, que tem outro eixo.",
        }}
      />

      <Bloco
        titulo="Tela de entrada"
        descricao="Split: formulário à esquerda com os quatro estados reais (parado, entrando, erro, autenticado), painel de marca à direita sobre grafite com FundoGrafico na variante conexões. O erro devolve o foco para a senha e fala por role='alert'. A senha da demo é 'callface' — qualquer outra mostra o estado de erro, para o estado existir de verdade na documentação."
        arquivo="ds/padroes.tsx"
        importar={'import { TelaDeEntrada } from "@/components/onface/ds/padroes"'}
        fundo="sunken"
        plano
      >
        <TelaDeEntrada />
      </Bloco>

      <Regras
        faca={{
          titulo: "Metade direita carrega a promessa",
          texto: "Sem depoimento verificado, o painel diz o que o produto faz: a ligação vira registro, o NEXO lê a carteira, o funil é um só. Isso é verdadeiro por construção e não envelhece.",
        }}
        naoFaca={{
          titulo: "Prova social inventada",
          texto: "Nome de cliente, foto, citação ou '+2.000 empresas' sem origem auditada é dado fabricado numa tela pública. Se o número não tem fonte que alguém assina, ele não entra — o espaço fica com a promessa.",
        }}
      />
    </Secao>
  );
}
