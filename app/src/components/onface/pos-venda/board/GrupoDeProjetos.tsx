/**
 * Um grupo da fila: título, contagem, o critério em uma frase, e os projetos.
 *
 * É `<details>`: o recolher funciona sem JavaScript, o foco e o teclado vêm do
 * navegador, e o conteúdo recolhido continua no documento. O grupo de
 * encerrados nasce fechado, porque 36 concluídos na frente de 3 que pedem
 * ação é exatamente o ruído que a tela anterior tinha.
 */
import { ChevronRight } from "lucide-react";
import type { CartaoDoProjeto } from "@/lib/pos-venda/contrato";
import type { Visao } from "../parametros";
import type { DefinicaoDeGrupo } from "./analise";
import { CartaoDoProjetoView } from "./CartaoDoProjeto";
import { LinhaDoProjeto } from "./LinhaDoProjeto";

export function GrupoDeProjetos({
  grupo, cartoes, visao, agora, repetidos, aberto,
}: {
  grupo: DefinicaoDeGrupo;
  cartoes: CartaoDoProjeto[];
  visao: Visao;
  agora: Date;
  repetidos: Map<string, number>;
  aberto: boolean;
}) {
  const idTitulo = `pv-grupo-${grupo.id}`;
  return (
    <details className="pv-grupo" open={aberto} data-pv-tom={grupo.tom} data-grupo={grupo.id}>
      <summary className="pv-grupo-cab">
        <ChevronRight className="pv-grupo-seta" aria-hidden />
        <h2 id={idTitulo} className="pv-grupo-titulo">{grupo.titulo}</h2>
        <span className="pv-grupo-n">{cartoes.length}</span>
        <span className="pv-grupo-criterio">{grupo.criterio}</span>
      </summary>
      {visao === "lista" ? (
        <ul className="pv-lista" aria-labelledby={idTitulo}>
          {cartoes.map((c) => <LinhaDoProjeto key={c.id} c={c} agora={agora} repetidos={repetidos.get(c.empresa.nome) ?? 1} />)}
        </ul>
      ) : (
        <ul className="pv-grade" aria-labelledby={idTitulo}>
          {cartoes.map((c) => <CartaoDoProjetoView key={c.id} c={c} agora={agora} repetidos={repetidos.get(c.empresa.nome) ?? 1} />)}
        </ul>
      )}
    </details>
  );
}
