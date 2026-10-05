# Cadência — definição do produto

Definida pelo Scott em 05/10/2026. É a referência para implementar e para
julgar o que existe hoje.

## O que é

Cadência **não é disparador de mensagem programada**. É uma **sequência
operacional de tentativa de contato e follow-up**, normalmente ligada a um
Lead/Aquisição, que garante que o contato nunca fique parado sem próximo passo.

> **A regra-mãe: ninguém termina uma execução deixando o lead no limbo.**
> Sempre tem que existir *próximo passo* + *quando* + *responsável* +
> *motivo/contexto*.

## Como funciona

1. O lead entra numa cadência **publicada**.
2. A cadência executa uma sequência de passos, por exemplo:
   ligação → espera → WhatsApp → espera → e-mail → espera → nova ligação → follow-up.
3. Cada passo tem **canal, objetivo, momento de execução e regra de saída**.
4. Entre os passos existem esperas: `Wait`, espera até data/hora, espera por
   evento ou *smart wait*.
5. **Se o cliente responder, a sequência cega para.** O sistema entra em
   conversa/qualificação e decide o próximo passo.
6. Se marcar reunião, qualificar, virar oportunidade ou pedir humano, a cadência
   é encerrada ou pausada conforme a regra.
7. Se continuar em silêncio, avança pelos próximos canais e tentativas.
8. Esgotadas as tentativas, **não abandona em silêncio**: vai para nutrição,
   cria tarefa humana, encerra conscientemente, ou outra saída definida.

```
Lead entrou
   ↓
Ligação imediata
   ↓ não atendeu
WhatsApp
   ↓ espera
respondeu?
 ├── Sim → conversa / qualificação / reunião / handoff
 └── Não → e-mail → espera → ligação → follow-up → … → nutrição / humano / encerramento
```

## Ações de um passo

WhatsApp · e-mail · ligação pela Callface · criar tarefa · agendar reunião ·
atribuir responsável · aplicar ou remover tag · chamar agente · iniciar outra
cadência · pausar · cancelar · retomar.

**A ligação é sempre pela Callface.** Não é escolha de provedor: onde a tela
oferece isso como seleção, está errado.

## Follow-up não é etapa de pipeline

Follow-up é **atividade / próxima ação**. O lead pode estar em *Qualificado* e,
ao mesmo tempo, no passo 6 de uma cadência de follow-up. As duas coisas convivem.

## Cadência e Fluxo

Compartilham o mesmo motor e as mesmas primitivas:

```
Trigger → Wait / SmartWait / WaitForEvent → Condition / Switch → Action → … → End
```

O que muda é propósito e experiência. **Cadência é especializada em
relacionamento comercial ao longo do tempo**: tentar contato, esperar, trocar de
canal, tentar de novo, reagir à resposta, qualificar, agendar, fazer handoff.
O **fluxo** é a ferramenta geral, e os dois se compõem: o fim de uma cadência
pode acionar um fluxo, e um fluxo pode iniciar uma cadência.

## Onde entra a IA

**A IA não é dona do relógio.** Quem controla *quando executar, quantas
tentativas, retentativas, esperas, condições e canais* é o motor de cadência.

A IA decide **conteúdo e leitura de contexto**: qual a melhor mensagem agora;
se ainda faz sentido insistir depois do que o cliente falou; qual a próxima
abordagem depois de uma objeção; se já há informação para qualificar; se é
melhor ligar ou responder no WhatsApp; se é hora de passar para um humano.

```
MOTOR DE CADÊNCIA     tempo + ordem + execução + estado
        ↓
AGENTE / IA           contexto + conteúdo + interpretação + decisão
        ↓
CANAL / AÇÃO          WhatsApp · e-mail · Callface · tarefa · reunião
```

## Precisa ser orientada a evento

Se o cliente responde no meio de uma espera de 24 horas, o sistema **não** manda
o próximo WhatsApp como um robô.

```
D0 — WhatsApp enviado → Wait 24h
   ↓ cliente responde depois de 3h
evento MessageReceived
   ↓
a cadência pausa ou cancela aquele caminho
   ↓
o agente lê a conversa e continua a partir do contexto real
```

O mesmo vale para reunião marcada: não pode sair "conseguiu ver minha
mensagem?" com reunião para amanhã.

**No-show** é evento da reunião: a oportunidade é preservada, o lead volta para
*Qualificado* para o SDR trabalhar o reagendamento, e uma cadência de
recuperação pode assumir dali. Ao reagendar, as ações incompatíveis que estavam
programadas **precisam ser canceladas**.

## Casos de uso que o time precisa conseguir montar

- **Primeiro contato:** o time escreve as mensagens com variáveis, ativa e
  escolhe por quais canais dispara.
- **Follow-up:** mensagens pelo WhatsApp do vendedor (ou pelo número que ele
  escolher), dia 1 manda X, dia 2 manda Y, dia 3 manda Z. Mensagem, áudio,
  e-mail e ligação.

## O motor antigo não é referência

O CRM anterior tinha um motor de cadência (`cadencia_execucoes`, com 1.306
execuções no banco). **Decisão do Scott, 05/10: aquilo é lixo e não serve de
base.** Não copiar comportamento, não migrar desenho, não tratar como legado a
preservar. O motor que vale é o novo (`cadence_definitions`,
`cadence_versions`, `cadence_enrollments`), que hoje está vazio.
