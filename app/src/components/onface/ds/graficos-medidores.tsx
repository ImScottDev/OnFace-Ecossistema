"use client";

/** Medidores segmentados do ONFACE.
 *
 * Quatro cartões do produto (saúde da carteira, meta do trimestre, entradas por
 * origem, alocação do funil, renovações) dividem o MESMO desenho: uma trilha
 * cortada em células discretas, cada célula pintada pela faixa em que cai e
 * apagada depois do ponto de preenchimento. Só a projeção muda: reta (barra) ou
 * 180° (arco). Quatro desenhos diferentes para a mesma leitura seriam quatro
 * lugares para o espaçamento divergir.
 *
 * Por que segmento e não traço contínuo: a célula é uma régua. Em barra cheia a
 * pessoa estima "uns 60%" e erra; contando blocos ela lê a proporção sem eixo,
 * sem grade e sem rótulo em cima do dado.
 *
 * Composição estudada nas referências que o dono do produto mandou; o código,
 * os tokens e os dados são nossos. */

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { CalendarClock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { brl, compacto, RESPONSAVEIS } from "./dados";
import "./graficos-medidores.css";

/* ═══ Base: faixas e segmentos ════════════════════════════════════════════ */

/** Uma faixa da trilha. `serie` é o índice de `--chart-1..5`, nunca uma cor:
 *  quem escolhe o tom é a fundação, não o cartão. */
export type Faixa = { chave: string; rotulo: string; valor: number; serie: 1 | 2 | 3 | 4 | 5 };

type Fatia = Faixa & { inicio: number; fim: number; fracao: number; cor: string };

function fatiar(faixas: Faixa[]): { total: number; fatias: Fatia[] } {
  const total = faixas.reduce((soma, f) => soma + f.valor, 0);
  /* Divisor mínimo 1: base zerada (conta nova, filtro que não achou nada) não
     pode virar NaN e apagar o cartão inteiro. */
  const divisor = total || 1;
  let acumulado = 0;
  const fatias = faixas.map((f) => {
    const inicio = acumulado / divisor;
    acumulado += f.valor;
    return {
      ...f,
      inicio,
      fim: acumulado / divisor,
      fracao: f.valor / divisor,
      cor: `var(--chart-${f.serie})`,
    };
  });
  return { total, fatias };
}

/** Recharts não entra aqui: o arco é geometria fixa, não série. Estas são as
 *  únicas medidas numéricas do arquivo e ficam nomeadas em um lugar só. O
 *  viewBox é espaço próprio do SVG, então não é px de tela. */
const ARCO = {
  largura: 200,
  altura: 112,
  centroX: 100,
  centroY: 100,
  raioExterno: 92,
  raioInterno: 74,
  traco: 5,
} as const;

/** Trilha segmentada. Projeção `linha` para distribuição, `arco` para medidor.
 *
 * `preenchidoAte` é a fração acesa (medidor); distribuição usa 1, porque a
 * barra inteira é o total e o que varia é a divisão entre as faixas. */
export function Segmentos({
  faixas,
  quantidade = 40,
  preenchidoAte = 1,
  projecao = "linha",
  destaque,
  rotulo,
}: {
  faixas: Faixa[];
  quantidade?: number;
  preenchidoAte?: number;
  projecao?: "linha" | "arco";
  /** Chave da faixa em foco: as outras recuam, nenhuma some. */
  destaque?: string | null;
  rotulo: string;
}) {
  const reduzido = useReducedMotion();
  const { fatias } = React.useMemo(() => fatiar(faixas), [faixas]);

  const celulas = React.useMemo(
    () =>
      Array.from({ length: quantidade }, (_, i) => {
        const posicao = (i + 0.5) / quantidade;
        /* `fim` exclusivo com fallback na última fatia: erro de ponto flutuante
           no acumulado deixaria a célula final sem dono e apagada. */
        const fatia = fatias.find((f) => posicao >= f.inicio && posicao < f.fim) ?? fatias.at(-1);
        return {
          aceso: posicao <= preenchidoAte,
          cor: fatia?.cor ?? "var(--chart-4)",
          chave: fatia?.chave,
        };
      }),
    [fatias, quantidade, preenchidoAte]
  );

  if (projecao === "arco") {
    return (
      <svg
        className="med-arco"
        viewBox={`0 0 ${ARCO.largura} ${ARCO.altura}`}
        role="img"
        aria-label={rotulo}
        data-animar={reduzido ? undefined : "true"}
      >
        {celulas.map((celula, i) => {
          /* Da esquerda (180°) para a direita (0°), meia volta. */
          const angulo = Math.PI * (1 - (i + 0.5) / quantidade);
          const cos = Math.cos(angulo);
          const sen = Math.sin(angulo);
          return (
            <line
              key={i}
              x1={ARCO.centroX + ARCO.raioExterno * cos}
              y1={ARCO.centroY - ARCO.raioExterno * sen}
              x2={ARCO.centroX + ARCO.raioInterno * cos}
              y2={ARCO.centroY - ARCO.raioInterno * sen}
              stroke={celula.aceso ? celula.cor : "var(--med-trilha)"}
              strokeWidth={ARCO.traco}
              strokeLinecap="round"
              style={{ "--i": i } as React.CSSProperties}
              data-atenuado={destaque && celula.chave !== destaque ? "true" : undefined}
            />
          );
        })}
      </svg>
    );
  }

  return (
    <div className="med-barra" role="img" aria-label={rotulo} data-animar={reduzido ? undefined : "true"}>
      {celulas.map((celula, i) => (
        <i
          key={i}
          style={{ "--i": i, background: celula.aceso ? celula.cor : "var(--med-trilha)" } as React.CSSProperties}
          data-atenuado={destaque && celula.chave !== destaque ? "true" : undefined}
        />
      ))}
    </div>
  );
}

/** Controle segmentado de recorte. Mora aqui porque os cartões de medidor e os
 *  de série usam o mesmo gesto; dois controles iguais em dois arquivos é onde a
 *  altura e o raio começam a divergir. */
export function Abas({
  rotulo,
  itens,
  ativo,
  aoTrocar,
}: {
  rotulo: string;
  itens: { chave: string; rotulo: string }[];
  ativo: string;
  aoTrocar: (chave: string) => void;
}) {
  return (
    <div className="med-abas" role="tablist" aria-label={rotulo}>
      {itens.map((item) => (
        <button
          key={item.chave}
          type="button"
          role="tab"
          aria-selected={item.chave === ativo}
          className="med-aba"
          onClick={() => aoTrocar(item.chave)}
        >
          {item.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Legenda que também é o controle de foco. O item não some quando é desligado:
 *  ele passa a ser o único em cor, e os outros recuam. Esconder faixa mudaria a
 *  proporção e a barra mentiria. */
function LegendaFaixas({
  faixas,
  total,
  destaque,
  aoDestacar,
  formatar,
}: {
  faixas: Faixa[];
  total: number;
  destaque: string | null;
  aoDestacar: (chave: string | null) => void;
  formatar: (valor: number) => string;
}) {
  return (
    <ul className="med-legenda">
      {faixas.map((f) => {
        const parte = total ? Math.round((f.valor / total) * 100) : 0;
        const ativa = destaque === f.chave;
        return (
          <li key={f.chave}>
            <button
              type="button"
              className="med-legenda-item"
              aria-pressed={ativa}
              onClick={() => aoDestacar(ativa ? null : f.chave)}
            >
              <i style={{ background: `var(--chart-${f.serie})` }} aria-hidden />
              <span className="med-legenda-rotulo">{f.rotulo}</span>
              <span className="med-legenda-valor">{formatar(f.valor)}</span>
              <span className="med-legenda-parte">{parte}%</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Pilha de avatares. Sobreposição em vez de fila: o cartão responde "quem está
 *  nisso" de relance, e a fila roubaria a largura do medidor. */
function PilhaDeAvatares({
  pessoas,
  selecionada,
  aoSelecionar,
}: {
  pessoas: { nome: string; iniciais: string }[];
  selecionada: string | null;
  aoSelecionar: (nome: string | null) => void;
}) {
  return (
    <div className="med-pilha" role="group" aria-label="Pessoas neste medidor">
      {pessoas.map((p) => {
        const ativa = selecionada === p.nome;
        return (
          <button
            key={p.nome}
            type="button"
            className="med-pilha-item"
            aria-pressed={ativa}
            aria-label={`Ver ${p.nome}`}
            title={p.nome}
            onClick={() => aoSelecionar(ativa ? null : p.nome)}
          >
            <Avatar size="sm">
              <AvatarFallback>{p.iniciais}</AvatarFallback>
            </Avatar>
          </button>
        );
      })}
    </div>
  );
}

/* ═══ 1. Painéis de arco segmentado ═══════════════════════════════════════ */

export type ItemArco = { nome: string; iniciais: string; valor: number; apoio: string };

/** Medidor de arco com pilha de quem participa. Clicar num avatar troca o arco
 *  para a leitura daquela pessoa; clicar de novo volta ao consolidado. É a
 *  mesma pergunta em dois níveis sem abrir outra tela. */
export function PainelArcoSegmentado({
  titulo,
  resumo,
  itens,
  max = 100,
  sufixo = "%",
}: {
  titulo: string;
  resumo: { rotulo: string; valor: number; apoio: string };
  itens: ItemArco[];
  max?: number;
  sufixo?: string;
}) {
  const [pessoa, setPessoa] = React.useState<string | null>(null);
  const item = itens.find((i) => i.nome === pessoa);
  const valor = item?.valor ?? resumo.valor;
  const rotulo = item?.nome ?? resumo.rotulo;
  const apoio = item?.apoio ?? resumo.apoio;

  const faixas: Faixa[] = React.useMemo(() => [{ chave: "valor", rotulo, valor: 1, serie: 1 }], [rotulo]);

  return (
    <section className="med-painel">
      <header className="med-painel-topo">
        <h4>{titulo}</h4>
        <PilhaDeAvatares pessoas={itens} selecionada={pessoa} aoSelecionar={setPessoa} />
      </header>

      <div className="med-arco-caixa">
        <Segmentos
          faixas={faixas}
          quantidade={32}
          preenchidoAte={Math.min(1, valor / max)}
          projecao="arco"
          rotulo={`${rotulo}: ${valor}${sufixo} de ${max}${sufixo}`}
        />
        {/* Número em HTML e não em <text>: dentro do SVG ele escalaria junto com
            o viewBox e ignoraria a escala tipográfica do ONFACE. */}
        <div className="med-arco-centro" aria-hidden>
          <strong>
            {valor}
            <i>{sufixo}</i>
          </strong>
          <span>{rotulo}</span>
        </div>
      </div>

      <p className="med-painel-apoio" role="status">{apoio}</p>
    </section>
  );
}

const SAUDE_CARTEIRA: ItemArco[] = [
  { nome: "Ana Souza", iniciais: "AS", valor: 78, apoio: "TechCorp Telecom puxa a média para baixo: 3 tickets fora do SLA." },
  { nome: "Mayara Ribeiro", iniciais: "MR", valor: 86, apoio: "Nenhuma conta da carteira com adoção abaixo de 70%." },
  { nome: "Lucas Pacheco", iniciais: "LP", valor: 64, apoio: "Duas contas de PABX sem login há mais de 14 dias." },
];

/** Os dois painéis lado a lado: saúde da base e meta do time. Juntos porque a
 *  pergunta de diretoria é uma só — "entrega e retenção estão de pé?". */
export function PaineisDeArco() {
  const metaTotal = RESPONSAVEIS.reduce((s, r) => s + r.meta, 0);
  const realizadoTotal = RESPONSAVEIS.reduce((s, r) => s + r.realizado, 0);
  const mediaSaude = Math.round(SAUDE_CARTEIRA.reduce((s, i) => s + i.valor, 0) / SAUDE_CARTEIRA.length);

  return (
    <div className="med-par">
      <PainelArcoSegmentado
        titulo="Saúde da carteira"
        resumo={{ rotulo: "Base ativa", valor: mediaSaude, apoio: "Média das três carteiras. Toque num avatar para abrir a carteira da pessoa." }}
        itens={SAUDE_CARTEIRA}
      />
      <PainelArcoSegmentado
        titulo="Meta do trimestre"
        resumo={{
          rotulo: "Time",
          valor: Math.round((realizadoTotal / metaTotal) * 100),
          apoio: `${compacto(realizadoTotal)} de ${compacto(metaTotal)} fechados até hoje.`,
        }}
        itens={RESPONSAVEIS.map((r) => ({
          nome: r.nome,
          iniciais: r.iniciais,
          valor: Math.round((r.realizado / r.meta) * 100),
          apoio: `${compacto(r.realizado)} de ${compacto(r.meta)}.`,
        }))}
      />
    </div>
  );
}

/* ═══ 2 e 3. Cartão de distribuição ═══════════════════════════════════════ */

export type Recorte = { chave: string; rotulo: string; faixas: Faixa[] };

/** Barra de distribuição com troca de recorte. Um componente serve os dois
 *  cartões porque a leitura é a mesma: um total dividido em faixas. O que muda
 *  é o controle (abas quando os recortes são uma escada de tempo, menu quando
 *  são uma lista) e se o total aparece como manchete. */
export function CartaoDistribuicao({
  titulo,
  apoio,
  recortes,
  controle = "abas",
  mostrarTotal = true,
  formatar = compacto,
  formatarLegenda = brl,
}: {
  titulo: string;
  apoio?: string;
  recortes: Recorte[];
  controle?: "abas" | "menu";
  mostrarTotal?: boolean;
  formatar?: (v: number) => string;
  formatarLegenda?: (v: number) => string;
}) {
  const [recorteAtivo, setRecorteAtivo] = React.useState(recortes[0].chave);
  const [destaque, setDestaque] = React.useState<string | null>(null);
  const recorte = recortes.find((r) => r.chave === recorteAtivo) ?? recortes[0];
  const { total } = React.useMemo(() => fatiar(recorte.faixas), [recorte.faixas]);

  /* Trocar de recorte com uma faixa em foco deixaria o destaque apontando para
     uma chave que pode nem existir no novo corte. */
  function trocarRecorte(chave: string) {
    setRecorteAtivo(chave);
    setDestaque(null);
  }

  const descricao = recorte.faixas
    .map((f) => `${f.rotulo}: ${total ? Math.round((f.valor / total) * 100) : 0}%`)
    .join(", ");

  return (
    <section className="med-cartao">
      <header className="med-cartao-topo">
        <div>
          <h4>{titulo}</h4>
          {mostrarTotal ? <p className="med-cartao-total">{formatar(total)}</p> : null}
          {apoio ? <p className="med-cartao-apoio">{apoio}</p> : null}
        </div>

        {controle === "abas" ? (
          <Abas rotulo={`Recorte de ${titulo}`} itens={recortes} ativo={recorte.chave} aoTrocar={trocarRecorte} />
        ) : (
          <Select value={recorte.chave} onValueChange={trocarRecorte}>
            <SelectTrigger size="sm" className="med-seletor" aria-label={`Período de ${titulo}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {recortes.map((r) => (
                <SelectItem key={r.chave} value={r.chave}>{r.rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      <Segmentos faixas={recorte.faixas} destaque={destaque} rotulo={`${titulo}, ${recorte.rotulo}. ${descricao}.`} />

      <LegendaFaixas
        faixas={recorte.faixas}
        total={total}
        destaque={destaque}
        aoDestacar={setDestaque}
        formatar={formatarLegenda}
      />
    </section>
  );
}

const ENTRADAS_POR_ORIGEM: Recorte[] = [
  {
    chave: "mes",
    rotulo: "Este mês",
    faixas: [
      { chave: "meta", rotulo: "Meta Ads", valor: 186400, serie: 1 },
      { chave: "inbound", rotulo: "Inbound site", valor: 98200, serie: 2 },
      { chave: "indicacao", rotulo: "Indicação", valor: 64700, serie: 3 },
      { chave: "parceiro", rotulo: "Parceiro", valor: 41300, serie: 4 },
    ],
  },
  {
    chave: "trimestre",
    rotulo: "Trimestre",
    faixas: [
      { chave: "meta", rotulo: "Meta Ads", valor: 482600, serie: 1 },
      { chave: "inbound", rotulo: "Inbound site", valor: 331800, serie: 2 },
      { chave: "indicacao", rotulo: "Indicação", valor: 224100, serie: 3 },
      { chave: "parceiro", rotulo: "Parceiro", valor: 186900, serie: 4 },
    ],
  },
  {
    chave: "ano",
    rotulo: "12 meses",
    faixas: [
      { chave: "meta", rotulo: "Meta Ads", valor: 1642000, serie: 1 },
      { chave: "inbound", rotulo: "Inbound site", valor: 1218400, serie: 2 },
      { chave: "indicacao", rotulo: "Indicação", valor: 904300, serie: 3 },
      { chave: "parceiro", rotulo: "Parceiro", valor: 736100, serie: 4 },
    ],
  },
];

export function EntradasPorOrigem() {
  return (
    <CartaoDistribuicao
      titulo="Receita entrada por origem"
      apoio="Negócios ganhos, por onde o lead chegou."
      recortes={ENTRADAS_POR_ORIGEM}
      controle="menu"
    />
  );
}

const ALOCACAO_FUNIL: Recorte[] = [
  {
    chave: "semana",
    rotulo: "Semana",
    faixas: [
      { chave: "pabx", rotulo: "PABX", valor: 128400, serie: 1 },
      { chave: "ai", rotulo: "Callface AI", valor: 46200, serie: 2 },
      { chave: "discador", rotulo: "Discador", valor: 38900, serie: 3 },
      { chave: "licencas", rotulo: "Licenças", valor: 21600, serie: 4 },
    ],
  },
  {
    chave: "mes",
    rotulo: "Mês",
    faixas: [
      { chave: "pabx", rotulo: "PABX", valor: 486300, serie: 1 },
      { chave: "ai", rotulo: "Callface AI", valor: 212800, serie: 2 },
      { chave: "discador", rotulo: "Discador", valor: 174500, serie: 3 },
      { chave: "licencas", rotulo: "Licenças", valor: 96400, serie: 4 },
    ],
  },
  {
    chave: "ano",
    rotulo: "Ano",
    faixas: [
      { chave: "pabx", rotulo: "PABX", valor: 4218000, serie: 1 },
      { chave: "ai", rotulo: "Callface AI", valor: 1864000, serie: 2 },
      { chave: "discador", rotulo: "Discador", valor: 1442000, serie: 3 },
      { chave: "licencas", rotulo: "Licenças", valor: 812000, serie: 4 },
    ],
  },
];

export function AlocacaoDoFunil() {
  return (
    <CartaoDistribuicao
      titulo="Funil em aberto por produto"
      apoio="Valor em negociação hoje, por linha de produto."
      recortes={ALOCACAO_FUNIL}
    />
  );
}

/* ═══ 4. Assinaturas por plano + renovações ═══════════════════════════════ */

const PLANOS: Faixa[] = [
  { chave: "pro", rotulo: "Callface Pro", valor: 184, serie: 1 },
  { chave: "essencial", rotulo: "Essencial", valor: 126, serie: 2 },
  { chave: "enterprise", rotulo: "Enterprise", valor: 38, serie: 3 },
  { chave: "white", rotulo: "White Label", valor: 17, serie: 4 },
];

const RENOVACOES = [
  { id: "r-1", empresa: "TechCorp Telecom", plano: "pro", ramais: 40, vence: "24 set", mrr: 8400, risco: true },
  { id: "r-2", empresa: "Odonto Prime", plano: "essencial", ramais: 12, vence: "27 set", mrr: 1180, risco: false },
  { id: "r-3", empresa: "Rede Farma Bem", plano: "pro", ramais: 40, vence: "02 out", mrr: 6900, risco: false },
  { id: "r-4", empresa: "BR Conecta", plano: "white", ramais: 0, vence: "05 out", mrr: 12400, risco: true },
  { id: "r-5", empresa: "Grupo Vitale", plano: "enterprise", ramais: 120, vence: "11 out", mrr: 19800, risco: false },
];

/** Base por plano e o que vence em seguida no mesmo cartão. Separados, o time
 *  vê a composição sem ver o que está prestes a sair dela. Clicar num plano na
 *  legenda filtra a lista: é o mesmo gesto do foco, com consequência. */
export function AssinaturasPorPlano() {
  const [destaque, setDestaque] = React.useState<string | null>(null);
  const { total } = React.useMemo(() => fatiar(PLANOS), []);
  const lista = destaque ? RENOVACOES.filter((r) => r.plano === destaque) : RENOVACOES;
  const rotuloPlano = (chave: string) => PLANOS.find((p) => p.chave === chave)?.rotulo ?? chave;

  return (
    <section className="med-cartao">
      <header className="med-cartao-topo">
        <div>
          <h4>Assinaturas ativas</h4>
          <p className="med-cartao-total">{total} contas</p>
          <p className="med-cartao-apoio">Distribuição por plano na base ativa.</p>
        </div>
      </header>

      <Segmentos
        faixas={PLANOS}
        destaque={destaque}
        rotulo={`Assinaturas por plano. ${PLANOS.map((p) => `${p.rotulo}: ${p.valor} contas`).join(", ")}.`}
      />

      <LegendaFaixas
        faixas={PLANOS}
        total={total}
        destaque={destaque}
        aoDestacar={setDestaque}
        formatar={(v) => `${v}`}
      />

      <div className="med-expirando">
        <p className="med-expirando-titulo">
          <CalendarClock aria-hidden />
          Vencem nos próximos 30 dias
          {destaque ? <span className="med-expirando-filtro">· {rotuloPlano(destaque)}</span> : null}
        </p>

        {/* `role="status"` porque a lista muda por causa de um clique que
            acontece em outro lugar do cartão: sem isso, quem usa leitor de tela
            filtra e não recebe retorno nenhum. */}
        <ul className="med-expirando-lista" role="status">
          {lista.map((r) => (
            <li key={r.id}>
              <span className="med-expirando-data" data-risco={r.risco ? "true" : undefined}>{r.vence}</span>
              <span className="med-expirando-empresa">
                {r.empresa}
                <i>{rotuloPlano(r.plano)}{r.ramais ? ` · ${r.ramais} ramais` : ""}</i>
              </span>
              <span className="med-expirando-mrr">{brl(r.mrr)}</span>
              <Button variant="outline" size="xs">Renovar</Button>
            </li>
          ))}
          {lista.length === 0 ? <li className="med-expirando-vazio">Nenhum contrato deste plano vence no período.</li> : null}
        </ul>
      </div>
    </section>
  );
}
