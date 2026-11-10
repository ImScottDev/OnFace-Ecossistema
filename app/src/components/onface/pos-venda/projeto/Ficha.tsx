/**
 * Ficha do cliente, coluna esquerda do projeto (referência: ficha + atividade lado a lado).
 * Quem é, como falar com ele agora (WhatsApp, ligar, Cliente 360), o que comprou e o que aconteceu por último.
 * Ação sem dado vira botão desabilitado com o motivo, nunca some nem finge.
 */
import Link from "next/link";
import { ArrowUpRight, MessageCircle, Phone, UserRound } from "lucide-react";
import type { Projeto } from "@/lib/pos-venda/contrato";
import { diaEHora, haQuanto, moeda, FAMILIAS, TIPO } from "../formatos";
import { Avatar } from "../pecas";

const so = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");
const iniciais = (nome: string) => nome.split(/\s+/).filter((p) => /^[A-Za-zÀ-ÿ]/.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

function Atalho({ href, icone: Icone, rotulo, motivo, externo }: { href: string | null; icone: typeof Phone; rotulo: string; motivo: string; externo?: boolean }) {
  const conteudo = (<><span className="pvp-atalho-icone"><Icone aria-hidden /></span><span>{rotulo}</span></>);
  if (!href) return <span className="pvp-atalho" aria-disabled="true" title={motivo}>{conteudo}</span>;
  return externo
    ? <a className="pvp-atalho" href={href} target="_blank" rel="noreferrer">{conteudo}</a>
    : <Link className="pvp-atalho" href={href}>{conteudo}</Link>;
}

export function Ficha({ projeto: p, agora }: { projeto: Projeto; agora: Date }) {
  const contato = p.pessoas.find((x) => so(x.telefone).length >= 10) ?? null;
  const fone = so(contato?.telefone);
  const whats = fone ? `https://wa.me/${fone.startsWith("55") ? fone : `55${fone}`}` : null;
  const ultimo = p.timeline[0] ?? null;
  const e = p.escopo;
  const links = [
    p.links.oportunidade && { href: p.links.oportunidade, rotulo: "Oportunidade" },
    p.links.proposta && { href: p.links.proposta, rotulo: "Proposta" },
    p.links.projetoIrmao && { href: p.links.projetoIrmao, rotulo: p.tipo === "ONBOARDING" ? "Projeto de implantação" : "Projeto de onboarding" },
    p.links.stripe && { href: p.links.stripe, rotulo: "Stripe" },
  ].filter(Boolean) as Array<{ href: string; rotulo: string }>;

  return (
    <div className="pvp-ficha-corpo">
      <div className="pvp-quem">
        <span className="pvp-logo" aria-hidden>{iniciais(p.empresa.nome)}</span>
        <h2>{p.empresa.nome}</h2>
        <p>{FAMILIAS[p.familia].rotulo} · {TIPO[p.tipo]}{p.empresa.documento ? ` · ${p.empresa.documento}` : ""}</p>
      </div>

      <div className="pvp-atalhos">
        <Atalho href={whats} icone={MessageCircle} rotulo="WhatsApp" motivo="Nenhum contato com telefone" externo />
        <Atalho href={fone ? `tel:+${fone.startsWith("55") ? fone : `55${fone}`}` : null} icone={Phone} rotulo="Ligar" motivo="Nenhum contato com telefone" externo />
        <Atalho href={p.links.cliente360} icone={UserRound} rotulo="Cliente 360" motivo="Projeto sem empresa vinculada" />
      </div>
      <p className="pvp-ultima">
        <span className="pvp-ponto" aria-hidden />
        {ultimo ? <>Última atividade {haQuanto(ultimo.em, agora)}</> : "Nenhuma atividade registrada"}
      </p>

      <section className="pvp-secao">
        <h3>Pessoas da empresa</h3>
        {p.pessoas.length === 0 ? (
          <p className="pvp-vazio">Ninguém cadastrado. Adicione o contato no Cliente 360 para liberar WhatsApp e ligação.</p>
        ) : (
          <ul className="pvp-pessoas">
            {p.pessoas.slice(0, 5).map((x) => (
              <li key={x.id}>
                <Avatar quem={x} tamanho="sm" decorativo />
                <span><strong>{x.nome}</strong><small>{[x.cargo, x.telefone].filter(Boolean).join(" · ") || "Sem cargo e telefone"}</small></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pvp-secao">
        <h3>O que foi vendido</h3>
        {e ? (
          <dl className="pvp-vendido">
            <div><dt>Produto</dt><dd>{e.produto ?? FAMILIAS[e.familia].rotulo}</dd></div>
            {e.quantidade != null && <div><dt>Quantidade</dt><dd>{e.quantidade} {e.unidade ?? ""}</dd></div>}
            {e.mensalidade != null && <div><dt>Mensalidade</dt><dd className="pv-num">{moeda(e.mensalidade)}</dd></div>}
            {e.setup != null && <div><dt>Setup</dt><dd className="pv-num">{moeda(e.setup)}</dd></div>}
            {e.recorrencia && <div><dt>Recorrência</dt><dd>{e.recorrencia}</dd></div>}
            {e.complementos.length > 0 && <div><dt>Inclui</dt><dd>{e.complementos.join(", ")}</dd></div>}
          </dl>
        ) : (
          <p className="pvp-vazio">A venda não registrou escopo. Confira na proposta.</p>
        )}
      </section>

      <section className="pvp-secao">
        <h3>Atividade recente</h3>
        {p.timeline.length === 0 ? (
          <p className="pvp-vazio">Nada registrado ainda.</p>
        ) : (
          <ol className="pvp-atividade">
            {p.timeline.slice(0, 5).map((ev) => (
              <li key={ev.id} data-autor={ev.autor}>
                <strong>{ev.titulo}</strong>
                <small>{ev.porQuem ? `${ev.porQuem} · ` : ""}{diaEHora(ev.em, agora)}</small>
              </li>
            ))}
          </ol>
        )}
      </section>

      {links.length > 0 && (
        <section className="pvp-secao">
          <h3>Ir para</h3>
          <ul className="pvp-links">
            {links.map((l) => <li key={l.rotulo}><Link href={l.href}>{l.rotulo}<ArrowUpRight aria-hidden /></Link></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
