import { Check, X } from "lucide-react";
import { Secao, Grade, Painel } from "./Base";

/**
 * Princípios, acessibilidade e governança.
 *
 * Existe porque o checklist do design-squad (DESIGN-CL-001) trata
 * documentação como critério de entrega, e a task `create-design-system`
 * lista "NEVER skip documentation — an undocumented design system will not be
 * adopted" entre as condições de veto. Sem o "por quê" escrito, cada tela
 * reinterpreta o sistema e a divergência volta.
 */

const PRINCIPIOS = [
  {
    titulo: "Um elemento dominante por tela",
    corpo: "Se tudo tem card, borda e sombra iguais, nada tem hierarquia e o olho não sabe onde pousar. A seção é o bloco; card é para superfície de fato elevada.",
  },
  {
    titulo: "Densidade de ferramenta, não de site",
    corpo: "O time passa 8h aqui. Padding generoso e card grande funcionam em landing page; num CRM viram scroll infinito para ver 6 informações.",
  },
  {
    titulo: "Cor só com significado",
    corpo: "Interface neutra por padrão. Verde é ganho, âmbar é risco, vermelho é perda. Cor como decoração gasta o único recurso que sinaliza urgência.",
  },
  {
    titulo: "Nenhuma tela escreve número",
    corpo: "Escreve papel: rounded-card, text-corpo, bg-positivo-suave. Foi a ausência disso que produziu 13 raios e 24 tamanhos de fonte.",
  },
  {
    titulo: "Estado faz parte do componente",
    corpo: "Vazio, carregando e erro são desenhados junto, não improvisados na tela. Vazio sempre oferece a próxima ação.",
  },
  {
    titulo: "Acessível desde o início",
    corpo: "Contraste é medido, não estimado. Retrofit de acessibilidade custa 10x — e a auditoria reprovou o botão primário original.",
  },
];

const REGRAS = [
  { faz: "Usar `text-corpo`", nao: "Escrever `text-[12.5px]`" },
  { faz: "Usar `rounded-card`", nao: "Escrever `rounded-2xl` ou `rounded-[28px]`" },
  { faz: "Uma ação primária por tela", nao: "Três botões preenchidos competindo" },
  { faz: "Ponto de status + texto normal", nao: "Pastilha colorida em toda linha da tabela" },
  { faz: "Número à direita e tabular", nao: "Valor alinhado à esquerda" },
  { faz: "Drawer para edição longa", nao: "Modal empilhado sobre modal" },
  { faz: "Barra horizontal acima de 5 fatias", nao: "Pizza com 9 categorias" },
  { faz: "Esconder coluna no mobile", nao: "Espremer todas as colunas" },
];

export function CatalogoPrincipios() {
  return (
    <div className="flex flex-col gap-10">
      <Secao
        id="principios"
        titulo="Princípios"
        descricao="O 'por quê' das decisões. Sem isso escrito, cada tela reinterpreta o sistema e a divergência volta — foi exatamente o que aconteceu antes desta fundação existir."
      >
        <Grade min={300}>
          {PRINCIPIOS.map((p) => (
            <div key={p.titulo} className="py-3 min-w-0">
              <h3 className="text-item font-semibold text-tinta">{p.titulo}</h3>
              <p className="text-corpo text-tinta-suave mt-1">{p.corpo}</p>
            </div>
          ))}
        </Grade>
      </Secao>

      <Secao
        id="regras"
        titulo="Faça / não faça"
        descricao="As trocas concretas. Cada linha da direita corresponde a um defeito real encontrado no produto."
      >
        <div className="divide-y divide-linha">
          {REGRAS.map((r) => (
            <div key={r.faz} className="grid sm:grid-cols-2 gap-x-6 gap-y-1 py-2.5">
              <p className="inline-flex items-start gap-2 text-corpo text-tinta">
                <Check className="size-4 text-positivo shrink-0 mt-0.5" />
                {r.faz}
              </p>
              <p className="inline-flex items-start gap-2 text-corpo text-tinta-suave">
                <X className="size-4 text-negativo shrink-0 mt-0.5" />
                {r.nao}
              </p>
            </div>
          ))}
        </div>
      </Secao>

      <Secao
        id="acessibilidade"
        titulo="Acessibilidade"
        descricao="Alvo WCAG 2.1 AA. Contraste é medido por script, não estimado no olho — a primeira auditoria reprovou 6 de 19 pares, incluindo o botão primário."
      >
        <Grade min={300}>
          <div className="py-3">
            <h3 className="text-item font-semibold text-tinta">Contraste verificado</h3>
            <p className="text-corpo text-tinta-suave mt-1">
              <code className="text-apoio">npm run ds:contraste</code> confere 18 pares contra
              4.5:1 (texto) e 3:1 (borda de controle). Roda com <code className="text-apoio">--strict</code> em CI.
            </p>
            <p className="text-corpo text-tinta-suave mt-2">
              Correções que a medição impôs: a cor de ação subiu de seaweed-600 (3.93:1,
              reprovado) para o 700 (6.29:1); o botão de atenção usa tinta escura, porque
              branco sobre âmbar dá 2.15:1.
            </p>
          </div>
          <div className="py-3">
            <h3 className="text-item font-semibold text-tinta">Teclado e toque</h3>
            <p className="text-corpo text-tinta-suave mt-1">
              Foco visível e idêntico em todo controle (um contorno, nunca dois). Linha de
              tabela clicável responde a Enter e Espaço. Alvo de toque de 44px no mobile.
              Status nunca depende só da cor — sempre há texto ao lado do ponto.
            </p>
          </div>
        </Grade>
      </Secao>

      <Secao
        id="governanca"
        titulo="Como mexer nisto"
        descricao="Onde cada coisa mora e o que roda antes de dar por pronto."
      >
        <Painel className="cf2-p-card">
          <ul className="text-corpo text-tinta-suave flex flex-col gap-2">
            <li><strong className="text-tinta">Token de escala</strong> — <code className="text-apoio">src/app/cf2-design-system.css</code>. Muda aqui, muda o produto inteiro.</li>
            <li><strong className="text-tinta">Valor de cor por tema</strong> — <code className="text-apoio">src/app/globals.css</code>, nos blocos <code className="text-apoio">[data-cf2-theme]</code>. A escala base <code className="text-apoio">--seaweed-*</code> é crua e ninguém consome direto.</li>
            <li><strong className="text-tinta">Componente do produto</strong> — <code className="text-apoio">src/components/crm2/ds/</code>.</li>
            <li><strong className="text-tinta">Componente do shadcn</strong> — <code className="text-apoio">src/components/ui/</code>. É código nosso; editar aqui é o padrão. <strong className="text-tinta">Cuidado:</strong> <code className="text-apoio">npx shadcn add</code> sobrescreve <code className="text-apoio">button.tsx</code> — confira o diff depois de instalar.</li>
            <li><strong className="text-tinta">Antes de dar por pronto</strong> — <code className="text-apoio">npm run ds:all</code> (contraste + violações), <code className="text-apoio">tsc</code>, <code className="text-apoio">eslint</code>, <code className="text-apoio">next build</code>. E abrir a tela: build limpo não prova que o fluxo funciona.</li>
          </ul>
        </Painel>
      </Secao>
    </div>
  );
}
