/**
 * Linha do tempo do projeto.
 *
 * Cada evento diz QUEM fez (sistema, time ou cliente) com ícone e cor próprios,
 * e a hora. Agrupada por dia, do mais recente para o mais antigo, como o
 * contrato entrega. Sem JS de cliente: renderiza no servidor.
 */
import { Cog, UserRound, UsersRound } from "lucide-react";
import type { AutorDoEvento, EventoDoProjeto } from "@/lib/pos-venda/contrato";
import { chaveDoDia, hora, rotuloDoDia, type Tom } from "../formatos";

const AUTOR: Record<AutorDoEvento, { rotulo: string; tom: Tom; Icone: typeof Cog }> = {
  sistema: { rotulo: "Sistema", tom: "neutro", Icone: Cog },
  time: { rotulo: "Time", tom: "andamento", Icone: UsersRound },
  cliente: { rotulo: "Cliente", tom: "validacao", Icone: UserRound },
};

export function EventoLinha({ e }: { e: EventoDoProjeto }) {
  const a = AUTOR[e.autor];
  return (
    <li className="pv-evento" data-pv-tom={a.tom}>
      <span className="pv-evento-ponto" aria-hidden><a.Icone /></span>
      <div className="pv-evento-corpo">
        <span className="pv-evento-titulo">{e.titulo}</span>
        {e.detalhe ? <span className="pv-evento-detalhe">{e.detalhe}</span> : null}
        <span className="pv-evento-quem">
          <b>{a.rotulo}</b>{e.porQuem ? ` · ${e.porQuem}` : ""}
        </span>
      </div>
      <time className="pv-evento-hora" dateTime={e.em.toISOString()}>{hora(e.em)}</time>
    </li>
  );
}

export function LinhaDoTempo({ eventos, agora }: { eventos: EventoDoProjeto[]; agora: Date }) {
  if (eventos.length === 0) {
    return (
      <div className="pv-estado" role="status">
        <h2>Nada aconteceu ainda</h2>
        <p>Cada tarefa concluída, espera, nota e resposta do cliente passa a aparecer aqui, com quem fez e a hora.</p>
      </div>
    );
  }

  const grupos: Array<{ chave: string; rotulo: string; itens: EventoDoProjeto[] }> = [];
  for (const e of eventos) {
    const chave = chaveDoDia(e.em);
    const g = grupos[grupos.length - 1];
    if (g && g.chave === chave) g.itens.push(e);
    else grupos.push({ chave, rotulo: rotuloDoDia(e.em, agora), itens: [e] });
  }

  return (
    <section className="pv-secao" aria-label="Linha do tempo">
      {grupos.map((g) => (
        <div key={g.chave}>
          <h3 className="pv-dia">{g.rotulo}</h3>
          <ol className="pv-linha">{g.itens.map((e) => <EventoLinha key={e.id} e={e} />)}</ol>
        </div>
      ))}
    </section>
  );
}
