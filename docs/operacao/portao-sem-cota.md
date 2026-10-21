# Quando o GitHub trava o deploy (cota de Actions)

**O sintoma:** `./deploy.sh` fica 20 minutos em
`[imagens] esperando ghcr.io/imscottdev/onface-{app,backend}:<sha> no GHCR...`
e termina com `✘ imagens não apareceram no GHCR em 20 min`. No GitHub, os jobs
do portão aparecem como *failure* **com zero passos executados** — não é o
código quebrando, é o job que nunca começou.

**A anotação do run diz a verdade:**

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

Aconteceu em 19/10/2026, no meio de um dia de muitos deploys.

## Por que acontece

O repositório é **privado**. Em repositório privado, cada execução de Actions
consome a cota mensal da conta (plano Free: 2.000 minutos). O portão monta
**duas imagens Docker** por push — é a parte cara. Num dia de muitos deploys a
cota acaba, e como o limite de gasto fica em zero por padrão, o GitHub **para**
em vez de cobrar. Não há dívida: em 19/10 a conta marcava
`$12.00 consumido − $12.00 de desconto = $0 a pagar`, com os 2.000 minutos
zerados e reset em 13 dias.

Repositório público não teria esse limite, mas este é privado por decisão de
produto.

## A saída permanente: runner próprio (já montado)

**Self-hosted runner não consome cota**, mesmo em repositório privado. O fluxo
continua idêntico — push → portão → imagem no GHCR → `./deploy.sh` —, só muda
a máquina que executa.

O runner está instalado no **Mac do Scott**:

| | |
|---|---|
| Pasta | `~/actions-runner-onface` |
| Nome | `mac-do-scott` |
| Label | `onface-mac` |
| Serviço | `actions.runner.ImScottDev-OnFace-Ecossistema.mac-do-scott` (LaunchAgent, sobe no login) |

O workflow não tem máquina fixa:

```yaml
runs-on: ${{ vars.RUNNER_PORTAO || 'ubuntu-latest' }}
```

`RUNNER_PORTAO` é variável do repositório
(*Settings → Secrets and variables → Actions → Variables*), hoje com o valor
`onface-mac`.

## Como trocar, sem mexer em código

| Quero | O que fazer |
|---|---|
| Rodar no Mac (grátis, padrão atual) | `RUNNER_PORTAO = onface-mac` |
| Voltar para a máquina do GitHub | apagar a variável `RUNNER_PORTAO` |

Pela linha de comando, com o token do `git credential fill`:

```bash
TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | grep '^password=' | cut -d= -f2-)
# ver o valor atual
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/ImScottDev/OnFace-Ecossistema/actions/variables/RUNNER_PORTAO
# voltar para a máquina do GitHub
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/ImScottDev/OnFace-Ecossistema/actions/variables/RUNNER_PORTAO
```

## Cuidar do runner

```bash
cd ~/actions-runner-onface
./svc.sh status      # está rodando?
./svc.sh start       # subir
./svc.sh stop        # parar
```

Ver se o GitHub o enxerga online:

```bash
TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | grep '^password=' | cut -d= -f2-)
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/ImScottDev/OnFace-Ecossistema/actions/runners \
  | python3 -c "import json,sys; [print(r['name'], r['status']) for r in json.load(sys.stdin)['runners']]"
```

**A pega:** com `RUNNER_PORTAO=onface-mac`, o portão precisa do Mac ligado e do
serviço de pé. Mac desligado = job esperando na fila, e o `deploy.sh`
estourando os 20 minutos como se a cota tivesse acabado. Se o deploy travar na
espera da imagem, **o primeiro lugar a olhar é se o runner está online.**

A versão mínima do runner é cobrada pelo GitHub: a 2.328.0 foi recusada com
`minimum runner version required is 2.329.0`. Para atualizar, baixar o release
novo por cima em `~/actions-runner-onface` e rodar `./config.sh ... --replace`.

## As outras saídas, e por que não são a principal

**Aumentar o limite de gasto** (*Billing → Budgets and alerts*): destrava na
hora e passa a cobrar por minuto depois da cota. Serve como emergência.

**`./deploy.sh producao --construir-aqui`**: constrói a imagem na própria EC2, sem
GitHub nenhum. Funciona, mas leva ~48 min e disputa as 2 vCPU com a produção
que está no ar — por isso é fallback, não rotina.

**Esperar o reset da cota**: até 30 dias parado. Não é opção.

## Reduzir o consumo (não resolve sozinho, mas ajuda)

O que pesa é montar as imagens. Se um dia o portão voltar para a máquina do
GitHub, vale olhar: cache de camadas Docker entre execuções, e não montar
imagem em push que só mexe em documentação.
