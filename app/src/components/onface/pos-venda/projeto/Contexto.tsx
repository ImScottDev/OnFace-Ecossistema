/**
 * Coluna de contexto: o que foi vendido, quem é quem, e para onde ir.
 *
 * Regra dos links: botão que não existe não aparece. `null` no contrato quer
 * dizer "não existe", nunca "#". Links externos abrem em aba nova; os de dentro
 * do produto navegam.
 *
 * Valor ausente diz que está ausente ("Não informado"), nunca vira R$ 0,00.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, FileSignature, FileText, Handshake, Link2, ClipboardList, CreditCard, UserRound } from "lucide-react";
import type { Projeto } from "@/lib/pos-venda/contrato";
import { moeda } from "../formatos";
import { Avatar, AvatarVazio } from "../pecas";

const RECORRENCIA: Record<NonNullable<NonNullable<Projeto["escopo"]>["recorrencia"]>, string> = {
  mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual", unica: "Cobrança única",
};

/** Rótulo legível dos complementos conhecidos. Desconhecido aparece como veio, sem sublinhado. */
const COMPLEMENTOS: Record<string, string> = { agente_ia: "Agente de IA" };

function Fato({ rotulo, valor, ausente = "Não informado" }: { rotulo: string; valor: ReactNode | null; ausente?: string }) {
  return (
    <div className="pv-fato">
      <dt>{rotulo}</dt>
      <dd data-ausente={valor === null || undefined}>{valor ?? ausente}</dd>
    </div>
  );
}

const ehExterno = (href: string) => /^https?:\/\//i.test(href);

function Atalho({ href, icone: Icone, rotulo }: { href: string; icone: typeof Link2; rotulo: string }) {
  const externo = ehExterno(href);
  const conteudo = (
    <>
      <Icone aria-hidden />
      {rotulo}
      {externo ? <ExternalLink className="pv-link-fim" aria-hidden /> : null}
    </>
  );
  return (
    <li>
      {externo ? (
        <a className="pv-link" href={href} target="_blank" rel="noreferrer noopener">
          {conteudo}
          <span className="pv-sr-only"> (abre em nova aba)</span>
        </a>
      ) : (
        <Link className="pv-link" href={href}>{conteudo}</Link>
      )}
    </li>
  );
}

export function Contexto({ projeto }: { projeto: Projeto }) {
  const { escopo, pessoas, responsavel, vendedor, links } = projeto;

  const atalhos = [
    links.cliente360 ? { href: links.cliente360, icone: UserRound, rotulo: "Cliente 360" } : null,
    links.oportunidade ? { href: links.oportunidade, icone: Handshake, rotulo: "Oportunidade" } : null,
    links.proposta ? { href: links.proposta, icone: FileText, rotulo: "Proposta" } : null,
    links.contrato ? { href: links.contrato, icone: FileSignature, rotulo: "Contrato" } : null,
    links.stripe ? { href: links.stripe, icone: CreditCard, rotulo: "Stripe" } : null,
    links.projetoIrmao ? { href: links.projetoIrmao, icone: Link2, rotulo: "Projeto relacionado" } : null,
    links.formularioPublico ? { href: links.formularioPublico, icone: ClipboardList, rotulo: "Formulário público" } : null,
  ].filter((x): x is { href: string; icone: typeof Link2; rotulo: string } => x !== null);

  return (
    <aside className="pv-contexto" aria-label="Contexto do projeto">
      <section className="pv-ctx-secao">
        <h2 className="pv-rotulo">O que foi vendido</h2>
        {escopo ? (
          <>
            <dl className="pv-fatos">
              <Fato rotulo="Produto" valor={escopo.produto} />
              <Fato rotulo="Quantidade" valor={escopo.quantidade !== null ? `${escopo.quantidade}${escopo.unidade ? ` ${escopo.unidade}` : ""}` : null} />
              <Fato rotulo="Mensalidade" valor={moeda(escopo.mensalidade)} />
              <Fato rotulo="Setup" valor={moeda(escopo.setup)} ausente="Sem setup" />
              <Fato rotulo="Recorrência" valor={escopo.recorrencia ? RECORRENCIA[escopo.recorrencia] : null} />
            </dl>
            {escopo.complementos.length > 0 ? (
              <div className="pv-tags" aria-label="Complementos contratados">
                {escopo.complementos.map((c) => (
                  <span key={c} className="pv-tag">{COMPLEMENTOS[c] ?? c.replace(/_/g, " ")}</span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="pv-secao-nota">O escopo vendido não foi registrado para este projeto.</p>
        )}
      </section>

      <section className="pv-ctx-secao">
        <h2 className="pv-rotulo">Pessoas da empresa</h2>
        {pessoas.length > 0 ? (
          <ul className="pv-pessoas">
            {pessoas.map((p) => (
              <li key={p.id} className="pv-pessoa">
                <Avatar quem={p} tamanho="md" titulo={false} decorativo />
                <span className="pv-pessoa-texto">
                  <span className="pv-pessoa-nome pv-truncar">{p.nome}</span>
                  <span className="pv-pessoa-sub pv-truncar">{[p.cargo, p.telefone ?? p.email].filter(Boolean).join(" · ") || "Sem cargo informado"}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pv-secao-nota">Nenhuma pessoa cadastrada ainda. O contato vem do formulário de levantamento.</p>
        )}
      </section>

      {atalhos.length > 0 ? (
        <section className="pv-ctx-secao">
          <h2 className="pv-rotulo">Ir para</h2>
          <ul className="pv-links">
            {atalhos.map((a) => (
              <Atalho key={a.rotulo} {...a} />
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
