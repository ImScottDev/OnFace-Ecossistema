# Insights 2.0 — contratos das APIs analíticas

Este é o documento que permite implementar uma tela aprovada no Figma **sem reescrever regra de
negócio**: tudo que a tela precisa já vem pronto do servidor, inclusive o recorte do drill.

Três endpoints cobrem o módulo. Não há API paralela: a arquitetura existente foi evoluída.

| Endpoint | Para quê | Arquivo |
|---|---|---|
| `GET /api/relatorios/painel` | o cockpit inteiro numa requisição | `app/src/api-server/routes/relatorios-painel.ts` |
| `GET /api/relatorios/metricas/:codigo` | uma métrica: valor, série, composição, registros | `app/src/api-server/routes/relatorios-metricas.ts` |
| `GET /api/relatorios/metricas/:codigo/exportar` | CSV do recorte completo | idem |

Os 20 endpoints de `relatorios.ts` são a camada a aposentar — ver
[inventario-camada-legada.md](./inventario-camada-legada.md). Não construa tela nova sobre eles.

---

## Princípios do contrato

**1. O servidor emite o recorte do drill.** Todo cartão, fatia de composição e ponto de série traz
um campo `drill` com a querystring pronta (`"faturamento_competencia?periodo=12m&familia=PABX"`). A
tela só prefixa a rota. **A tela nunca remonta um recorte** — é isso que garante que o cartão, a
barra do gráfico e o CSV mostrem exatamente o mesmo conjunto.

**2. Ausência tem estado, não valor.** `estado` ∈ `disponivel | parcial | indisponivel |
nao_aplicavel`, com `motivo: {codigo, mensagem}`. Quando o estado não é `disponivel` ou `parcial`,
`valor` e `registros` vêm `null`. **Nunca zero.** A tela deve renderizar o motivo, não um traço mudo.

**3. Filtro não suportado é erro, não silêncio.** Exemplo real:

```
GET /api/relatorios/metricas/oportunidades_criadas?periodo=tudo                       → 1.645
GET /api/relatorios/metricas/oportunidades_criadas?periodo=tudo&responsavel=ffc3583c… →   538
GET /api/relatorios/metricas/faturamento_competencia?periodo=tudo&responsavel=ffc3583c…
  → 422 "A métrica faturamento_competencia não tem responsável: o filtro não se aplica
         e não foi ignorado em silêncio."
```

O filtro atravessa card, detalhe, composição, série e exportação pelo **mesmo** recorte — é aplicado
dentro de `definir()`, não em cada consumidor, justamente para que não exista caminho em que um
deles enxergue um conjunto diferente.

A tela sabe quais filtros oferecer lendo `metrica.filtros` da própria resposta: oferecer um filtro
que a métrica não aceita é desenhar um controle que vai dar 422.

 Pedir um filtro que a métrica não declara devolve
**422** `filtro_nao_suportado` com a frase do porquê. Parâmetro malformado devolve **400** com os
campos. Nenhum dos dois cai no padrão calado.

**4. Tenant vem do servidor.** `organizacao_id` sai de `getCtx(c)` e nunca do cliente. Não existe
parâmetro de organização.

**5. Unidades.** `BRL` em reais (número, não centavos). `percentual` **já em pontos** — `31.28`
significa 31,28%; não multiplique por 100. `contagem` inteiro. `dias` número.

---

## `GET /api/relatorios/painel`

Monta o cockpit inteiro. Usa `medir()` nos cartões (uma consulta cada) e `explorar()` só nos blocos
que desenham série ou composição; uma métrica que falha vira `indisponivel` em vez de derrubar o
painel (`Promise.allSettled`).

### Parâmetros (zod, `.strict()` — chave desconhecida é 400)

| Param | Valores | Padrão |
|---|---|---|
| `periodo` | preset (`mes_atual`, `12m`, `ano_atual`, `tudo`, …) ou `custom:AAAA-MM-DD:AAAA-MM-DD` | `mes_atual` |
| `familia` | `PABX`, `CALLFACE_AI`, `WHITE_LABEL` | todas |
| `testes` | `0` \| `1` — inclui registros marcados como teste | `0` |
| `serie` | janela dos blocos de evolução, independente dos cartões | `12m` |

### Resposta

```ts
interface PainelGeral {
  organizacaoId: string;
  geradoEm: string;
  params: ParamsPainel;
  blocos: {
    receita: BlocoReceita;      // BlocoCartoes + avisos[]
    carteira: BlocoCartoes;
    aquisicao: BlocoCartoes;
    conversao: BlocoCartoes;
    pipeline: BlocoCartoes;
    metas: BlocoCartoes;
    evolucao: BlocoEvolucao;    // pontos[] com drill por ponto
    composicao: BlocoComposicao; // dimensoes[] com drill por fatia
    alertas: BlocoAlertas;      // versaoLimiares + alertas[]
  };
  lacunas: Array<{ titulo: string; motivo: string }>;
}
```

Todo bloco tem `titulo`, `estado` (`disponivel | parcial | indisponivel`) e `motivo`. Um bloco pode
estar indisponível inteiro, e a tela não deve fingir que ele existe.

**`Cartao`** — a peça que a tela desenha como KPI:

```ts
interface Cartao {
  id: string; tipo: "metrica" | "razao"; codigo: string; nome: string;
  unidade: "BRL" | "contagem" | "percentual" | "dias";
  estado: EstadoCartao; motivo: Motivo | null;
  valor: number | null; registros: number | null;        // null quando o estado não autoriza
  comparacao: { rotulo: string; valor: number; variacao: number | null } | null;
  cobertura: Cobertura | null;                            // piso, observado, frescor, preenchimento
  fonte: string;                                          // definição técnica — use em tooltip, não no corpo
  naoInclui: string | null;                               // ressalva — idem
  drill: string | null;
  razao: { numerador, denominador, amostraMinima, drillDe } | null;
}
```

> **Nota de UI aprendida na prática:** `fonte` e `naoInclui` são documentação longa. Despejá-las no
> corpo do cartão empurra o número para baixo e mata a escaneabilidade. Lugar certo: tooltip. No
> corpo, só uma linha quando `estado === "parcial"` — porque isso muda a confiança no número.

**`AvisoRecorrencia`** (em `blocos.receita.avisos`) — o caso do White Label: o valor está no MRR,
mas a família só teve faturamento em 2 de 67 competências. Traz `valor`, `competenciasComMrr`,
`competenciasReferencia`, `sequenciaAteUltima`, `sequenciaMinima`, `mensagem` e `drill`. É dado
estruturado, não string solta: a tela desenha como quiser.

**`Alerta`** — `{ id, situacao: "disparado" | "ok" | "indisponivel", severidade, titulo, frase,
metrica, valor, limiar: {descricao, versao}, drill, motivo }`. Renderize só os `disparado`.

---

## `GET /api/relatorios/metricas/:codigo`

Uma métrica explorável: o valor, a série, a composição por dimensão e os registros paginados — tudo
derivado do **mesmo recorte**, que é o que impede card e lista de divergirem.

### Parâmetros

| Param | Para quê |
|---|---|
| `periodo` | preset ou `custom:de:ate` |
| `de`, `ate` | recorte dentro da janela (ex.: um mês clicado no gráfico) |
| `familia`, `testes` | filtros declarados pela métrica |
| `dim`, `valorDim` | seleção numa dimensão (o cross-filter) |
| `responsavel`, `etapa`, `pipeline`, `origem`, `campanha` | filtros de dimensão; **cada métrica declara quais aceita** |
| `q` | busca livre no recorte |
| `ordem`, `sentido` | ordenação (coluna precisa estar na allowlist) |
| `pagina`, `tamanho` | paginação (5..200) |

### Resposta

```ts
interface RespostaMetrica {
  metrica: { codigo, nome, tipo, unidade, descricao, fonte, naoInclui, agregacao,
             filtros, dimensoes, ordenaveis };   // metadados: o que esta métrica aceita
  periodo: string;
  janela: { de, ate, rotulo, parcial } | null;
  pisoAplicado: string | null;
  comparacao: { rotulo, valor, variacao } | null;
  exploracao: {
    total: number;              // o card: a janela inteira, sem a seleção
    registrosTotal: number;
    selecionado: { valor, registros };   // igual ao total quando não há seleção
    somaValor: number | null;   // soma de `valor` quando a métrica é de contagem
    ultimoEm: string | null;    // frescor da fonte — sem isso, "mês até hoje" esconde dado parado
    linhas: Record<string, unknown>[];
    pagina, tamanho, paginas;
    dimensoes: Array<{ chave, rotulo, itens: ItemDimensao[], outros }>;
    serie: { granularidade: "dia" | "mes"; pontos: PontoSerie[] } | null;
  };
  serieAnterior: Exploracao["serie"];  // janela anterior alinhada por posição
}
```

Detalhes que importam para a tela:

- **`total` vs `selecionado`** — `total` é o cartão; `selecionado` é o que sobra depois de clicar
  numa fatia. Mostrar os dois é o que explica o cross-filter ao usuário.
- **`comparacao` é `null` quando a janela anterior cai antes do piso.** Não é "0%": é *não
  comparável*, e a seta nem deve aparecer.
- **`serieAnterior` é `null` quando a janela anterior não tem nenhum ponto** — ausência de dado,
  não uma linha no zero.
- **`janela.parcial`** diz que o período ainda não fechou. O mês corrente tem que ser rotulado,
  nunca desenhado como queda.

## `GET /api/relatorios/metricas/:codigo/exportar`

CSV do **recorte inteiro**, não da página. Mesma querystring do endpoint acima, sem `pagina`.
Responde com `X-Registros` e `X-Cortado` (teto de 50 mil linhas). Exportar o que está na tela e
exportar o recorte filtrado têm que ser o mesmo conjunto — há teste.

---

## Permissões

O gate vem de `app/src/lib/relatorios/biblioteca.ts` (`podeVer(acesso, papel)`), aplicado na rota.
No painel, vale o gate **mais restritivo** entre as métricas pedidas, e o cartão sem acesso vira
`indisponivel` com motivo `sem_acesso` — nunca 403 no painel inteiro por causa de um cartão.

**Divergência conhecida:** `biblioteca.ts` declara `acesso: "admin"`/`"gestao"` para os relatórios
legados, mas 18 dos 20 endpoints de `relatorios.ts` só exigem autenticação. O gate anunciado não é
o aplicado. Corrigir faz parte do roadmap (ver [06-ESTADO.md](./06-ESTADO.md)).

## O que ainda falta no contrato

Pendências que o frontend do Figma vai precisar e que ainda não existem:

| Falta | Impacto |
|---|---|
| Filtro por **equipe** e **canal** | equipe não existe como coluna em nenhuma tabela de fato (vem de `usuarios.team_id`); canal depende da normalização de `lib/relatorios/canais.ts` |
| Intervalo personalizado com comparação explícita de período | hoje a comparação é sempre "anterior equivalente" |
| Série por cartão (faísca) no painel | hoje a tela busca a série por fora para o sparkline |
| Endpoints de Performance | Performance ainda é server component com SQL próprio |
| Persistência de relatório salvo / visão salva | não existe: a querystring é o "salvo" |
