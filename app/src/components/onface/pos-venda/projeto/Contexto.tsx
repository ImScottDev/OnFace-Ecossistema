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
import { ChevronRight, ExternalLink, FileSignature, FileText, Handshake, Link2, ClipboardList, CreditCard, UserRound } from "lucide-react";
import type { EscopoVendido, Projeto } from "@/lib/pos-venda/contrato";
import { moeda } from "../formatos";
import { Avatar } from "../pecas";

const RECORRENCIA: Record<NonNullable<NonNullable<Projeto["escopo"]>["recorrencia"]>, string> = {
  mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual", unica: "Cobrança única",
};

/**
 * Um item da venda, como ele sai da proposta aceita.
 *
 * `escopoDaOportunidade()` já lê isto do banco e devolve em `EscopoCongelado.itens`,
 * mas `escopoDoSnapshot()` descarta o campo e `produto` chega aqui como
 * `"A + B + C"` — é exatamente o "concatena nomes e perde o item" que o dono
 * reprovou. Enquanto o contrato não carrega `itens`, a tela lê o campo de
 * forma defensiva: quando ele chegar, a lista aparece sozinha; enquanto não
 * chega, o resumo continua valendo e a tela diz o que falta.
 */
export interface ItemVendido {
  produto: string | null;
  quantidade: number | null;
  valorTotal: number | null;
  natureza: string | null;
}

const NATUREZA: Record<string, string> = { MRR: "Recorrente", SETUP: "Setup", USAGE: "Uso", HARDWARE: "Equipamento" };

function itensDoEscopo(escopo: EscopoVendido): ItemVendido[] {
  const comItens = escopo as EscopoVendido & { itens?: unknown };
  return Array.isArray(comItens.itens) ? (comItens.itens as ItemVendido[]) : [];
}

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

/**
 * O que foi vendido, item a item.
 *
 * O dono reprovou o resumo: "não tem as informações completas que tem na
 * proposta, quantidade e tudo mais". Então a lista de itens vem primeiro —
 * cada produto com a sua quantidade e o seu valor — e o resumo (mensalidade,
 * setup, recorrência) fecha embaixo, como totais, que é o papel dele.
 *
 * Tabela e não cartões: são três colunas de dado comparável, e a régua de
 * leitura é a linha. Valor nulo diz que não foi informado; nunca vira R$ 0,00.
 */
function EscopoVendidoBloco({ escopo, propostaHref }: { escopo: EscopoVendido; propostaHref: string | null }) {
  const itens = itensDoEscopo(escopo);

  return (
    <>
      {itens.length > 0 ? (
        <table className="pv-itens">
          <caption className="pv-sr-only">Itens vendidos, com quantidade e valor</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className="pv-col-num">Qtd.</th>
              <th scope="col" className="pv-col-num">Valor</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i, n) => (
              <tr key={`${i.produto ?? "item"}-${n}`}>
                <th scope="row">
                  <span className="pv-item-nome">{i.produto ?? "Item sem nome"}</span>
                  {i.natureza ? <span className="pv-item-natureza">{NATUREZA[i.natureza] ?? i.natureza}</span> : null}
                </th>
                <td className="pv-col-num pv-num" data-ausente={i.quantidade === null || undefined}>
                  {i.quantidade !== null ? i.quantidade : "—"}
                </td>
                <td className="pv-col-num pv-num" data-ausente={i.valorTotal === null || undefined}>
                  {moeda(i.valorTotal) ?? "Não informado"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="pv-secao-nota">
          Os itens desta venda ainda não chegam ao projeto — só o resumo abaixo.
          {propostaHref ? " A proposta tem a lista completa." : ""}
        </p>
      )}

      <dl className="pv-fatos">
        {itens.length === 0 ? <Fato rotulo="Produto" valor={escopo.produto} /> : null}
        {itens.length === 0 ? (
          <Fato rotulo="Quantidade" valor={escopo.quantidade !== null ? `${escopo.quantidade}${escopo.unidade ? ` ${escopo.unidade}` : ""}` : null} />
        ) : null}
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

      {propostaHref ? (
        <Link className="pv-link pv-link-discreto" href={propostaHref}>
          <FileText aria-hidden /> Ver a proposta
        </Link>
      ) : null}
    </>
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
        {escopo ? <EscopoVendidoBloco escopo={escopo} propostaHref={links.proposta} /> : (
          <p className="pv-secao-nota">O escopo vendido não foi registrado para este projeto.</p>
        )}
      </section>

      {/* "Pessoas da empresa, não consigo clicar": cada linha é um link para a
          ficha da pessoa, com o alvo inteiro clicável, não só o nome. */}
      <section className="pv-ctx-secao">
        <h2 className="pv-rotulo">Pessoas da empresa</h2>
        {pessoas.length > 0 ? (
          <ul className="pv-pessoas">
            {pessoas.map((p) => (
              <li key={p.id}>
                <Link className="pv-pessoa" href={`/contatos/pessoas/${p.id}`} title={`Abrir a ficha de ${p.nome}`}>
                  <Avatar quem={p} tamanho="md" titulo={false} decorativo />
                  <span className="pv-pessoa-texto">
                    <span className="pv-pessoa-nome pv-truncar">{p.nome}</span>
                    <span className="pv-pessoa-sub pv-truncar">{[p.cargo, p.telefone ?? p.email].filter(Boolean).join(" · ") || "Sem cargo informado"}</span>
                  </span>
                  <ChevronRight className="pv-pessoa-seta" aria-hidden />
                </Link>
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
