/**
 * Catálogo dos TOKENS do Callface UI System.
 *
 * Regra que o catálogo torna visível: nenhuma tela escreve número. Escreve
 * papel — `rounded-card`, `text-corpo`, `bg-positivo-suave`. Trocar o valor
 * acontece em cf2-design-system.css e o produto inteiro acompanha.
 */
import { Secao, Amostra, Grade } from "./Base";

const TIPOGRAFIA = [
  { classe: "text-hero", px: "40px", uso: "Número único de destaque no hero. Um por tela." },
  { classe: "text-destaque", px: "30px", uso: "Valor principal de um bloco (MRR do mês, meta)." },
  { classe: "text-kpi", px: "22px", uso: "Valor de KPI dentro de card." },
  { classe: "text-titulo", px: "17px", uso: "Título de card e de seção." },
  { classe: "text-item", px: "14px", uso: "Nome de lead, linha de lista, item clicável." },
  { classe: "text-corpo", px: "13px", uso: "Corpo padrão, célula de tabela. O mais usado." },
  { classe: "text-apoio", px: "12px", uso: "Legenda, texto de apoio, rodapé de card." },
  { classe: "text-micro", px: "11px", uso: "Rótulo de KPI em caixa alta, badge." },
];

const RAIOS = [
  { classe: "rounded-hero", px: "32px", uso: "Faixa escura / hero" },
  { classe: "rounded-card", px: "28px", uso: "Card padrão" },
  { classe: "rounded-inner", px: "20px", uso: "Bloco dentro de card" },
  { classe: "rounded-control", px: "14px", uso: "Botão, input, select" },
  { classe: "rounded-chip", px: "10px", uso: "Badge, tag, ícone pequeno" },
  { classe: "rounded-full", px: "999px", uso: "Avatar, pílula, toggle" },
];

const SEMANTICAS = [
  { nome: "Marca", bg: "bg-marca", fg: "text-marca-tinta", suave: "bg-marca-suave", quando: "Ação primária, item ativo. Uma por tela." },
  { nome: "Positivo", bg: "bg-positivo", fg: "text-white", suave: "bg-positivo-suave", quando: "Ganho, meta batida, ativo." },
  { nome: "Negativo", bg: "bg-negativo", fg: "text-white", suave: "bg-negativo-suave", quando: "Perda, erro, atraso, churn." },
  { nome: "Atenção", bg: "bg-atencao", fg: "text-white", suave: "bg-atencao-suave", quando: "Risco, vence hoje, pendência." },
  { nome: "Informativo", bg: "bg-informativo", fg: "text-white", suave: "bg-informativo-suave", quando: "Neutro com destaque, dica." },
];

const SUPERFICIES = [
  { nome: "Fundo da página", classe: "bg-fundo" },
  { nome: "Superfície (card)", classe: "bg-superficie" },
  { nome: "Superfície alt", classe: "bg-superficie-alt" },
  { nome: "Chrome (sidebar)", classe: "bg-chrome" },
];

export function CatalogoTokens() {
  return (
    <div className="flex flex-col gap-10">
      <Secao
        id="tipografia"
        titulo="Tipografia"
        descricao="8 degraus, não 24. Cada um tem um papel — a escolha é pelo papel, nunca pelo tamanho. Os três do meio (13/12/11px) cobrem a esmagadora maioria de uma tela de CRM."
      >
        <div className="divide-y divide-linha">
          {TIPOGRAFIA.map((t) => (
            <div
              key={t.classe}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6"
            >
              <div className="sm:w-64 shrink-0 flex items-baseline gap-2">
                <code className="text-corpo font-mono text-tinta">{t.classe}</code>
                <span className="text-micro text-tinta-fraca">{t.px}</span>
              </div>
              <div className={`${t.classe} font-display text-tinta flex-1 truncate`}>
                Receita fechada em agosto
              </div>
              <p className="text-apoio text-tinta-fraca sm:w-72 shrink-0">{t.uso}</p>
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        id="cor"
        titulo="Cor semântica"
        descricao="Interface neutra por padrão; cor só quando carrega significado. Cada cor vem em par — a sólida para preenchimento, a suave com o texto correspondente já definido, para o badge nunca sair diferente entre duas telas."
      >
        <Grade min={280}>
          {SEMANTICAS.map((c) => (
            <Amostra key={c.nome} rotulo={c.nome} codigo={c.bg}>
              <div className="flex gap-2">
                <div className={`${c.bg} ${c.fg} rounded-control flex-1 h-14 grid place-items-center text-corpo font-semibold`}>
                  Sólido
                </div>
                <div
                  className={`${c.suave} rounded-control flex-1 h-14 grid place-items-center text-corpo font-semibold`}
                  style={{ color: `var(--cf2-${c.nome === "Marca" ? "brand-deep" : c.nome === "Positivo" ? "positivo-fg" : c.nome === "Negativo" ? "negativo-fg" : c.nome === "Atenção" ? "atencao-fg" : "informativo-fg"})` }}
                >
                  Suave
                </div>
              </div>
              <p className="text-apoio text-tinta-fraca">{c.quando}</p>
            </Amostra>
          ))}
        </Grade>

        <div className="mt-3">
          <Grade min={180}>
            {SUPERFICIES.map((s) => (
              <Amostra key={s.nome} rotulo={s.nome} codigo={s.classe}>
                <div className={`${s.classe} rounded-inner h-14 border border-linha`} />
              </Amostra>
            ))}
          </Grade>
        </div>

        <div className="mt-2">
          <Amostra rotulo="Escala base — seaweed" codigo="--seaweed-50 … 950">
            <p className="text-apoio text-tinta-fraca -mt-1 mb-1 max-w-3xl">
              Camada base: 11 tons crus que nenhum componente consome direto. Quem é
              consumido é a camada semântica acima, que aponta pra cá — trocar a marca
              inteira é reescrever este bloco, não caçar uso pelo código.
            </p>
            <div className="flex rounded-inner overflow-hidden">
              {["bg-seaweed-50","bg-seaweed-100","bg-seaweed-200","bg-seaweed-300","bg-seaweed-400","bg-seaweed-500","bg-seaweed-600","bg-seaweed-700","bg-seaweed-800","bg-seaweed-900","bg-seaweed-950"].map((c) => (
                <div key={c} className={`${c} h-12 flex-1`} title={c} />
              ))}
            </div>
          </Amostra>
        </div>

        <div className="mt-2">
          <Amostra rotulo="Séries de gráfico" codigo="bg-serie-1 … bg-serie-5">
            <p className="text-apoio text-tinta-fraca -mt-1 mb-1">
              Uma paleta só para barra, área, linha, pizza e radar. A série 1 é sempre a
              principal (marca); as demais são frias e neutras, para o gráfico não virar
              arco-íris e dois dashboards não brigarem entre si.
            </p>
            <div className="flex gap-2">
              {/* Classes escritas por extenso de propósito: o Tailwind varre o
                  fonte estaticamente, então `bg-serie-${n}` interpolado não
                  geraria nenhuma dessas classes. */}
              {["bg-serie-1", "bg-serie-2", "bg-serie-3", "bg-serie-4", "bg-serie-5"].map((c, i) => (
                <div key={c} className="flex-1 flex flex-col gap-1">
                  <div className={`${c} rounded-chip h-12`} />
                  <span className="text-micro text-tinta-fraca text-center">série {i + 1}</span>
                </div>
              ))}
            </div>
          </Amostra>
        </div>
      </Secao>

      <Secao
        id="raio"
        titulo="Raio"
        descricao="Nomeado por papel, não por tamanho. `rounded-card` sobrevive a uma troca de valor; `rounded-[28px]` espalhado em 300 arquivos, não. Era exatamente aqui que existiam três escalas concorrentes."
      >
        <Grade min={200}>
          {RAIOS.map((r) => (
            <Amostra key={r.classe} rotulo={r.uso} codigo={r.classe}>
              <div
                className={`${r.classe} h-14 bg-marca-suave border-2 border-marca`}
              />
              <span className="text-micro text-tinta-fraca">{r.px}</span>
            </Amostra>
          ))}
        </Grade>
      </Secao>

      <Secao
        id="elevacao"
        titulo="Elevação"
        descricao="Elevação é hierarquia, não enfeite. Três níveis: o que está em repouso, o que flutua sobre o conteúdo e o que bloqueia a tela."
      >
        <Grade min={220}>
          {[
            { n: "Repouso", c: "shadow-repouso", q: "Card na página." },
            { n: "Flutuante", c: "shadow-flutuante", q: "Dropdown, popover, hover-card." },
            { n: "Modal", c: "shadow-modal", q: "Dialog, sheet — bloqueia a tela." },
          ].map((e) => (
            <Amostra key={e.c} rotulo={e.n} codigo={e.c}>
              <div className={`${e.c} bg-superficie rounded-inner h-14 border border-linha`} />
              <span className="text-apoio text-tinta-fraca">{e.q}</span>
            </Amostra>
          ))}
        </Grade>
      </Secao>
    </div>
  );
}
