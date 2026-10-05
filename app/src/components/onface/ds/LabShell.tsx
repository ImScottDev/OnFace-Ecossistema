"use client";

/** ONFACE Design System — casca do laboratório.
 *
 * Uma rota por seção (`/design/onface/<slug>`) para dar link direto ao que se
 * está discutindo: "olha o DataGrid" vira uma URL, não "rola até o meio".
 * A navegação é uma coluna sticky no desktop e uma barra rolável sticky no
 * mobile — em nenhuma das duas ela some. */

import * as React from "react";
import Link from "next/link";
import "./ds.css";
import { NAVEGACAO, SLUGS_VALIDOS } from "./navegacao";
import { OrdemSecao } from "./lab";
import { SecaoVisaoGeral } from "./secoes/VisaoGeral";
import { SecaoFundacoes } from "./secoes/Fundacoes";
import { SecaoMovimento } from "./secoes/Movimento";
import { SecaoLinguagem } from "./secoes/Linguagem";
import { SecaoComponentes } from "./secoes/Componentes";
import { SecaoDados } from "./secoes/Dados";
import { SecaoGraficos } from "./secoes/Graficos";
import { SecaoQuadro } from "./secoes/Quadro";
import { SecaoRegistro } from "./secoes/Registro";
import { SecaoNexo } from "./secoes/Nexo";
import { SecaoAgenda } from "./secoes/Agenda";
import { SecaoFluxos } from "./secoes/Fluxos";
import { SecaoPadroes } from "./secoes/Padroes";
import { SecaoLayouts } from "./secoes/Layouts";


function conteudo(secao: string) {
  switch (secao) {
    case "fundacoes": return <SecaoFundacoes />;
    case "movimento": return <SecaoMovimento />;
    case "linguagem": return <SecaoLinguagem />;
    case "componentes": return <SecaoComponentes />;
    case "dados": return <SecaoDados />;
    case "graficos": return <SecaoGraficos />;
    case "quadro": return <SecaoQuadro />;
    case "registro": return <SecaoRegistro />;
    case "nexo": return <SecaoNexo />;
    case "agenda": return <SecaoAgenda />;
    case "fluxos": return <SecaoFluxos />;
    case "padroes": return <SecaoPadroes />;
    case "layouts": return <SecaoLayouts />;
    default: return <SecaoVisaoGeral />;
  }
}

export function LabShell({ secao }: { secao: string }) {
  const nav = React.useRef<HTMLElement>(null);

  /* No mobile o índice vira barra horizontal, e a seção aberta costuma estar
     fora da janela de rolagem: o índice parece não ter item ativo. Só rola
     quando a barra é mesmo rolável, senão no desktop isto puxaria a página
     inteira atrás de um item que já está visível. `scrollIntoView` sem
     `behavior` é instantâneo, então não há animação para reduced-motion vetar. */
  React.useEffect(() => {
    const barra = nav.current;
    if (!barra || barra.scrollWidth <= barra.clientWidth) return;
    barra.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [secao]);

  /* Congela onde o índice está antes que um overlay abra.
     Todo overlay modal do Radix trava a rolagem do body, e com ela morre o
     `sticky`: o índice vira fixo (regra no ds.css) para não sumir. Só que
     "fixo no encosto abaixo do topbar" não é onde ele estava quando a página
     ainda não rolou até lá, e o índice pulava para cima no instante em que a
     gaveta abria.
     A medida sai do slot, não do próprio índice: o slot continua no fluxo
     durante a trava, então dá para lê-lo depois que o atributo aparece, e a
     conta do sticky é só `max(topo da coluna, encosto)`. Observar o atributo
     cobre abertura por clique, teclado, foco programático ou rota, que é o que
     um listener de clique não alcança. O callback roda antes do quadro seguinte,
     então não há piscada. O mesmo caminho responde ao resize: girar o telefone
     ou cruzar 1100px com a gaveta aberta tem que remedir, não manter a
     geometria de antes. */
  React.useEffect(() => {
    const barra = nav.current;
    const coluna = barra?.parentElement;
    if (!barra || !coluna) return;

    const congelar = () => {
      /* Tirar a variável do caminho antes de ler o `top` é o que garante que o
         encosto medido é o do CSS de agora, e não o valor congelado numa trava
         anterior. Remover e reescrever acontece no mesmo quadro, sem paint no
         meio, então não pisca. */
      barra.style.removeProperty("--ds-nav-top");
      const encosto = parseFloat(getComputedStyle(barra).top) || 0;
      const caixa = coluna.getBoundingClientRect();
      // Sem trava não há o que congelar. Abaixo de 1100px o slot é
      // `display: contents` e não tem caixa: ali o índice é barra deitada e a
      // regra da trava nem chega a fixá-lo.
      if (!document.body.hasAttribute("data-scroll-locked") || !caixa.height) {
        barra.style.removeProperty("--ds-nav-largura");
        return;
      }
      barra.style.setProperty("--ds-nav-top", `${Math.round(Math.max(caixa.top, encosto))}px`);
      barra.style.setProperty("--ds-nav-largura", `${Math.round(caixa.width)}px`);
    };

    const observador = new MutationObserver(congelar);
    observador.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] });
    window.addEventListener("resize", congelar);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", congelar);
    };
  }, []);

  /* A seção não sabe onde está no índice, e não dá para passar uma prop nova
     sem editar as onze. O contexto entrega a posição a partir da fonte única
     de ordenação, que é a própria navegação. */
  const ordem = SLUGS_VALIDOS.indexOf(secao) + 1;

  return (
    <div className="ds-lab">
      {/* O slot guarda a coluna do grid. Quando um overlay modal trava a rolagem
          do body, o `nav` vira fixo para não sumir junto com o sticky — e sem o
          slot ele sairia do fluxo, jogando o conteúdo na coluna estreita. */}
      <div className="ds-lab-nav-slot">
        <nav className="ds-lab-nav" aria-label="Seções do design system" ref={nav}>
        {NAVEGACAO.map((grupo) => (
          <React.Fragment key={grupo.grupo}>
            <p className="ds-lab-nav-grupo">{grupo.grupo}</p>
            {grupo.itens.map((item) => {
              const Icone = item.icone;
              const ativo = item.slug === secao;
              return (
                <Link
                  key={item.slug || "raiz"}
                  className="ds-lab-link"
                  href={item.slug ? `/design/${item.slug}` : "/design"}
                  aria-current={ativo ? "page" : undefined}
                >
                  <Icone />
                  {item.rotulo}
                </Link>
              );
            })}
          </React.Fragment>
        ))}
        </nav>
      </div>

      <OrdemSecao.Provider value={{ ordem: ordem || 1, total: SLUGS_VALIDOS.length }}>
        {conteudo(secao)}
      </OrdemSecao.Provider>
    </div>
  );
}
