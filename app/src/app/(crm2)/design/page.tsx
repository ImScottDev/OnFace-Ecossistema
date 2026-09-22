import { CatalogoTokens } from "@/components/crm2/design/Tokens";
import { CatalogoComponentes } from "@/components/crm2/design/Componentes";
import { CatalogoBlocos } from "@/components/crm2/design/Blocos";
import { CatalogoGraficos } from "@/components/crm2/design/Graficos";
import { CatalogoPrincipios } from "@/components/crm2/design/Principios";

export const metadata = { title: "Design System" };

/**
 * Design System ONFACE — catálogo vivo (30/08; renomeado 22/09).
 *
 * Chamava-se "Callface UI System". A marca do produto é ONFACE desde 15/09 e
 * o catálogo é a fonte única dele; manter o nome anterior no título da aba e
 * no `h1` era a marca antiga viva no lugar mais visível possível.
 *
 * Não é documentação escrita à mão: renderiza os tokens e componentes REAIS.
 * Se alguém mudar um valor em cf2-design-system.css, esta página muda junto —
 * então ela nunca mente sobre o que o produto de fato usa.
 */
const INDICE = [
  { href: "#principios", rotulo: "Princípios" },
  { href: "#regras", rotulo: "Faça / não faça" },
  { href: "#acessibilidade", rotulo: "Acessibilidade" },
  { href: "#tipografia", rotulo: "Tipografia" },
  { href: "#cor", rotulo: "Cor" },
  { href: "#raio", rotulo: "Raio" },
  { href: "#elevacao", rotulo: "Elevação" },
  { href: "#botoes", rotulo: "Botões" },
  { href: "#status", rotulo: "Status" },
  { href: "#formulario", rotulo: "Campos" },
  { href: "#entidades", rotulo: "Entidades" },
  { href: "#navegacao", rotulo: "Recorte" },
  { href: "#dados", rotulo: "Tabela" },
  { href: "#historico", rotulo: "Histórico" },
  { href: "#bloco-cabecalho", rotulo: "Cabeçalho" },
  { href: "#bloco-filtros", rotulo: "Filtros" },
  { href: "#bloco-metrica", rotulo: "Métrica" },
  { href: "#bloco-etapas", rotulo: "Etapas" },
  { href: "#bloco-lista", rotulo: "Listas" },
  { href: "#grafico-area", rotulo: "Área" },
  { href: "#grafico-barra", rotulo: "Barra" },
  { href: "#grafico-linha", rotulo: "Linha" },
  { href: "#grafico-pizza", rotulo: "Pizza" },
  { href: "#grafico-radar", rotulo: "Radar" },
  { href: "#grafico-radial", rotulo: "Medidor" },
  { href: "#estados", rotulo: "Estados" },
  { href: "#sobreposicao", rotulo: "Sobreposição" },
  { href: "#movimento", rotulo: "Movimento" },
];

export default function PaginaDesign() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      <header className="cf2-faixa cf2-p-card">
        {/* O micro-label "Fundação" saiu: era rótulo em cima do título
            dizendo a mesma coisa que o título já diz. */}
        <h1 className="text-destaque font-display" style={{ color: "var(--cf2-chrome-text-primary)" }}>
          Design System ONFACE
        </h1>
        <p className="text-corpo mt-2 max-w-2xl" style={{ color: "var(--cf2-chrome-text-secondary)" }}>
          A escala única do produto. Toda tela do CRM 2.0 usa estes tokens — nenhuma
          escreve um número solto. Trocar um valor aqui muda o produto inteiro.
        </p>
        <nav className="flex flex-wrap gap-1.5 mt-4">
          {INDICE.map((i) => (
            <a
              key={i.href}
              href={i.href}
              className="cf2-transicao cf2-foco text-apoio rounded-full px-2.5 py-1"
              style={{
                background: "var(--cf2-home-dark-overlay)",
                color: "var(--cf2-chrome-text-primary)",
              }}
            >
              {i.rotulo}
            </a>
          ))}
        </nav>
      </header>

      <CatalogoPrincipios />
      <CatalogoTokens />
      <CatalogoComponentes />
      <CatalogoBlocos />
      <CatalogoGraficos />
      <div id="governanca" />
    </div>
  );
}
