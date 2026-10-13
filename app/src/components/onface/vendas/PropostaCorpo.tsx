"use client";

/**
 * Corpo da Proposta, compartilhado pela gaveta e pela página.
 *
 * Uma fonte só: o que a spec manda mostrar aparece igual nas duas superfícies,
 * e uma regra nova entra num lugar só. `Wrap` é o que muda — `Secao` aperta em
 * coluna estreita, `Bloco` abre em página.
 */

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Send } from "lucide-react";
import {
  ROTULO_FAMILIA, ROTULO_MODO_FECHAMENTO, ROTULO_STATUS_PROPOSTA,
  type ModoFechamento,
} from "@/lib/vendas/dominio";
import type { DetalheProposta } from "@/app/(produto)/propostas/actions";
import { NomeUsuario, SeloIA } from "@/components/ui/avatar";
import { AvisoBloqueio, Campo, Secao, Tag, dataCurta, dataHora, moedaExata, type Bloqueio } from "./ui";
import { Bloco } from "./pagina";
import { AcoesContato } from "./pagina";
import { rotuloAtor } from "./PreVendas";
import { rotuloDeEvento } from "@/lib/vendas/rotulos-evento";
import { descreverAlteracao } from "@/lib/vendas/auditoria-comercial";

export function rotuloStatus(status: string): string {
  return ROTULO_STATUS_PROPOSTA[status as keyof typeof ROTULO_STATUS_PROPOSTA] ?? status;
}

export function tomDoStatus(status: string): "coral" | "alerta" | "sucesso" | "info" | "neutro-escuro" | undefined {
  if (status === "aceita") return "sucesso";
  if (status === "recusada" || status === "expirada" || status === "substituida") return "neutro-escuro";
  if (status === "ajuste_solicitado") return "alerta";
  if (status === "enviada" || status === "visualizada") return "coral";
  return undefined;
}

export interface AcoesCorpoProposta {
  enviar: () => void;
  revisar: () => Promise<boolean>;
  completarJuridicos: () => void;
}

/** Marcadores de estado, iguais nas duas superfícies. */
export function TagsProposta({ proposta }: { proposta: DetalheProposta }) {
  return (
    <>
      <Tag tom={tomDoStatus(proposta.status)}>{rotuloStatus(proposta.status)}</Tag>
      {proposta.oportunidade.familia ? (
        <Tag>{ROTULO_FAMILIA[proposta.oportunidade.familia as keyof typeof ROTULO_FAMILIA] ?? proposta.oportunidade.familia}</Tag>
      ) : null}
      {proposta.modoFechamento ? (
        <Tag tom="info">{ROTULO_MODO_FECHAMENTO[proposta.modoFechamento as ModoFechamento]}</Tag>
      ) : null}
    </>
  );
}

/** Os botões que de fato mudam o estado da proposta. */
export function AcoesProposta({ proposta, pendente, acoes }: {
  proposta: DetalheProposta; pendente: boolean; acoes: AcoesCorpoProposta;}) {
  const rascunho = proposta.status === "rascunho";
  const vigente = ["enviada", "visualizada", "ajuste_solicitado"].includes(proposta.status);
  return (
    <>
      {rascunho ? (
        <button type="button" className="ov-botao" disabled={pendente} onClick={acoes.enviar}>
          <Send aria-hidden />Enviar proposta
        </button>
      ) : null}
      {vigente || proposta.status === "recusada" || proposta.status === "expirada" ? (
        <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente} onClick={acoes.revisar}>
          Criar revisão
        </button>
      ) : null}
      {proposta.oportunidade.id ? (
        <Link className="ov-botao" data-variante="contorno" href={`/pipeline/${proposta.oportunidade.id}`}>
          Abrir oportunidade
        </Link>
      ) : null}
      {proposta.empresa.id ? (
        <Link className="ov-botao" data-variante="contorno" href={`/contatos/empresas/${proposta.empresa.id}`}>
          Abrir empresa
        </Link>
      ) : null}
    </>
  );
}

export function CorpoProposta({ proposta, pendente, bloqueio, variante, acoes }: {
  proposta: DetalheProposta;
  pendente: boolean;
  bloqueio: Bloqueio | null;
  variante: "painel" | "pagina";
  acoes: AcoesCorpoProposta;
}) {
  const Wrap = variante === "pagina" ? Bloco : Secao;
  const aceita = proposta.status === "aceita";

  return (
    <>
      {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}

      {aceita ? (
        <div className="ov-bloqueio" role="status">
          <FileText aria-hidden />
          <div>
            {proposta.contratos.some((c) => c.assinaturaStatus === "assinado")
              ? "Proposta aceita e contrato assinado. A assinatura é a evidência de fechamento desta oportunidade."
              : <>
                  Proposta aceita. A oportunidade continua aberta até a evidência de fechamento:{" "}
                  {proposta.modoFechamento === "CONTRACT" ? "contrato assinado" : "pagamento confirmado"}.
                  Aceite não é ganho.
                </>}
          </div>
        </div>
      ) : null}

      {proposta.tracking.ajusteDescricao ? (
        <Wrap titulo="Ajuste pedido pelo cliente">
          <p className="ov-nota">{proposta.tracking.ajusteDescricao}</p>
          <p className="ov-nota">
            O pedido não altera esta proposta. Crie uma revisão: a versão atual vira substituída e não pode mais ser aceita.
          </p>
        </Wrap>
      ) : null}

      {/* Bloco 03 §5: mensal, anual e único separados, cada um no seu período de cobrança (o do Price).
          Somar tudo num total único engana, e dizer "/mês" sobre uma anuidade também. */}
      <Wrap titulo="Composição financeira">
        <div className="ov-composicao">
          {proposta.composicao.recorrenteMensal > 0 || (proposta.composicao.recorrenteAnual === 0 && proposta.composicao.naoRecorrente === 0) ? (
            <div className="ov-composicao-item">
              <dt>Mensal / mês</dt>
              <dd>{moedaExata(proposta.composicao.recorrenteMensal)}</dd>
            </div>
          ) : null}
          {proposta.composicao.recorrenteAnual > 0 ? (
            <div className="ov-composicao-item">
              <dt>Anual / ano</dt>
              <dd>{moedaExata(proposta.composicao.recorrenteAnual)}</dd>
            </div>
          ) : null}
          {proposta.composicao.naoRecorrente > 0 ? (
            <div className="ov-composicao-item">
              <dt>Único (setup e avulsos)</dt>
              <dd>{moedaExata(proposta.composicao.naoRecorrente)}</dd>
            </div>
          ) : null}
          {proposta.composicao.tcv !== null ? (
            <div className="ov-composicao-item">
              <dt>Contratado ({proposta.composicao.prazoMeses} meses)</dt>
              <dd>{moedaExata(proposta.composicao.tcv)}</dd>
            </div>
          ) : null}
        </div>
        {proposta.composicao.tcv === null && (proposta.composicao.recorrenteMensal > 0 || proposta.composicao.recorrenteAnual > 0) ? (
          <p className="ov-nota">Sem prazo contratual definido, o valor total do contrato não é calculado.</p>
        ) : null}
        {proposta.composicao.periodoDeduzido > 0 ? (
          <p className="ov-nota">
            {proposta.composicao.periodoDeduzido === 1 ? "1 linha desta proposta não tem preço no catálogo" : `${proposta.composicao.periodoDeduzido} linhas desta proposta não têm preço no catálogo`}
            : o período de cobrança dela foi deduzido do tipo (recorrente = mensal).
          </p>
        ) : null}
      </Wrap>

      <Wrap titulo={`Itens (${proposta.itens.length})`}>
        {proposta.itens.length === 0 ? (
          <p className="ov-nota">Nenhum item nesta proposta.</p>
        ) : variante === "pagina" ? (
          <div className="ov-tabela-wrap">
            <table className="ov-tabela">
              <colgroup>
                <col /><col style={{ width: "10%" }} /><col style={{ width: "16%" }} />
                <col style={{ width: "12%" }} /><col style={{ width: "18%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Item</th><th className="ov-num">Qtd</th><th className="ov-num">Unitário</th>
                  <th className="ov-num">Desc.</th><th className="ov-num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {proposta.itens.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="ov-tabela-principal">{i.nome}</div>
                      <div className="ov-tabela-apoio">
                        {i.tipo === "recorrente" ? "Recorrente" : i.tipo === "setup" ? "Setup" : "Avulso"}
                      </div>
                    </td>
                    <td className="ov-num">{i.quantidade}</td>
                    <td className="ov-num">{moedaExata(i.valorUnitario)}</td>
                    <td className="ov-num">{i.desconto > 0 ? `${i.desconto}%` : "0%"}</td>
                    <td className="ov-num">{moedaExata(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <dl style={{ margin: 0 }}>
            {proposta.itens.map((i) => (
              <Campo key={i.id} rotulo={`${i.nome}${i.quantidade > 1 ? ` · ${i.quantidade}x` : ""}`}>
                {moedaExata(i.subtotal)}
              </Campo>
            ))}
          </dl>
        )}
      </Wrap>
    </>
  );
}

/** Empresa, tracking e histórico: o apoio da leitura, que na página vai para
 *  a coluna da direita e na gaveta continua na sequência. */
export function ApoioProposta({ proposta, variante, contato, acoes }: {
  proposta: DetalheProposta;
  variante: "painel" | "pagina";
  contato?: { leadId: string | null; telefone: string | null; email: string | null } | null;
  acoes: AcoesCorpoProposta;
}) {
  const Wrap = variante === "pagina" ? Bloco : Secao;
  return (
    <>
      <Wrap titulo="Empresa">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Nome">{proposta.empresa.nome}</Campo>
          <Campo rotulo="Dados jurídicos">
            {proposta.empresa.dadosJuridicosCompletos ? "Completos" : `Falta: ${proposta.empresa.faltando.join(", ")}`}
          </Campo>
        </dl>
        {!proposta.empresa.dadosJuridicosCompletos && proposta.empresa.id ? (
          // O CTA resolve aqui mesmo. Mandar para Contatos era o "bug do
          // Completar dados": saía do contexto da proposta e não voltava.
          <button type="button" className="ov-botao" data-variante="contorno" onClick={acoes.completarJuridicos}>
            Completar dados da empresa
          </button>
        ) : null}
      </Wrap>

      {contato ? (
        <Wrap titulo="Falar com o cliente">
          <AcoesContato alvo={contato} />
        </Wrap>
      ) : null}

      <LinkPublico proposta={proposta} Wrap={Wrap} />
      <ContratoDaProposta proposta={proposta} Wrap={Wrap} />

      <Wrap titulo="Tracking">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Enviada">{dataHora(proposta.tracking.enviadaEm)}</Campo>
          <Campo rotulo="Primeira visualização">{dataHora(proposta.tracking.primeiraVisualizacao)}</Campo>
          <Campo rotulo="Validade">{dataCurta(proposta.dataValidade)}</Campo>
          <Campo rotulo="Aceita">{dataHora(proposta.tracking.aceitaEm)}</Campo>
          <Campo rotulo="Recusada">{dataHora(proposta.tracking.recusadaEm)}</Campo>
        </dl>
      </Wrap>

      <AlteracoesComerciais proposta={proposta} Wrap={Wrap} />

      <Wrap titulo="Histórico">
        {proposta.timeline.length === 0 ? (
          <p className="ov-nota">Nenhum evento registrado.</p>
        ) : (
          <div className="ov-timeline">
            {proposta.timeline.slice(0, variante === "pagina" ? 30 : 15).map((e) => (
              <div className="ov-timeline-item" key={e.id}>
                <span className="ov-timeline-marca" aria-hidden />
                <div>
                  <strong>{e.titulo || rotuloDeEvento(e.tipo)}</strong>
                  <span>
                    {dataHora(e.ocorridoEm)}
                    {e.usuarioNome ? <> · <NomeUsuario nome={e.usuarioNome} ehAgente={e.atorTipo === "AI_AGENT" || undefined} /></> : e.atorTipo !== "HUMAN" ? <> · {e.atorTipo === "AI_AGENT" ? <SeloIA className="size-3" /> : null}{rotuloAtor(e.atorTipo)}</> : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Wrap>
    </>
  );
}

/**
 * Auditoria comercial da proposta, à vista de quem a abre: quem mudou o quê
 * (de → para), quando e por quê. Desconto não tem limite nem aprovação, e por
 * isso mesmo nada fica sem registro. Mesma peça na gaveta e na página.
 */
function AlteracoesComerciais({ proposta, Wrap }: { proposta: DetalheProposta; Wrap: typeof Secao }) {
  const registros = proposta.alteracoes;
  return (
    <Wrap titulo="Alterações comerciais">
      {registros.length === 0 ? (
        <p className="ov-nota">Nenhuma alteração registrada nesta proposta.</p>
      ) : (
        <div className="ov-timeline">
          {registros.map((r) => (
            <div className="ov-timeline-item" key={r.id}>
              <span className="ov-timeline-marca" aria-hidden />
              <div>
                <strong>
                  {r.quem ?? rotuloAtor(r.atorTipo)}
                  {" · "}{dataHora(r.em)}
                  {r.totalAntes !== null && r.totalDepois !== null && r.totalAntes !== r.totalDepois
                    ? <> · total {moedaExata(r.totalAntes)} → {moedaExata(r.totalDepois)}</>
                    : null}
                </strong>
                <ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>
                  {r.alteracoes.map((a, i) => (
                    <li key={i} style={{ fontSize: "inherit" }}>{descreverAlteracao(a)}</li>
                  ))}
                </ul>
                {r.motivo ? <span>Motivo: {r.motivo}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  );
}

const ROTULO_ASSINATURA: Record<string, string> = {
  pendente: "Aguardando assinatura", assinado: "Assinado", recusado: "Recusado pelo signatário",
  cancelado: "Cancelado", expirado: "Expirado",
};

/** O link que o cliente abre. Existe desde o envio; antes dele não há o que copiar. */
function LinkPublico({ proposta, Wrap }: { proposta: DetalheProposta; Wrap: typeof Secao }) {
  if (proposta.status === "rascunho" || proposta.status === "substituida") return null;
  const copiar = async () => {
    const link = `${window.location.origin}/p/${proposta.id}`;
    try { await navigator.clipboard.writeText(link); toast.success("Link da proposta copiado."); }
    catch { toast.error("Não consegui copiar. Selecione o link e copie."); }
  };
  return (
    <Wrap titulo="Link para o cliente">
      <p className="ov-nota">O cliente vê a proposta, aceita, pede ajuste ou recusa por este endereço, sem login.</p>
      <div className="ov-acoes">
        <button type="button" className="ov-botao" data-variante="contorno" onClick={copiar}>Copiar link</button>
        <a className="ov-botao" data-variante="contorno" href={`/p/${proposta.id}`} target="_blank" rel="noreferrer">Abrir como cliente</a>
      </div>
    </Wrap>
  );
}

/** O que o aceite gerou: estado da assinatura e o documento final assinado. */
function ContratoDaProposta({ proposta, Wrap }: { proposta: DetalheProposta; Wrap: typeof Secao }) {
  if (proposta.contratos.length === 0) return null;
  return (
    <Wrap titulo="Contrato e assinatura">
      <dl style={{ margin: 0 }}>
        {proposta.contratos.map((c) => (
          <React.Fragment key={c.id}>
            <Campo rotulo={c.documento}>{ROTULO_ASSINATURA[c.assinaturaStatus] ?? c.assinaturaStatus}</Campo>
            {c.signatarios.length ? <Campo rotulo="Signatários">{c.signatarios.join(", ")}</Campo> : null}
            {c.assinadoEm ? <Campo rotulo="Assinado em">{dataHora(c.assinadoEm)}</Campo> : null}
          </React.Fragment>
        ))}
      </dl>
      {proposta.contratos.filter((c) => c.pdfFinalDisponivel).map((c) => (
        <a key={c.id} className="ov-botao" data-variante="contorno" href={`/api/contratos/${c.id}/pdf-final`} target="_blank" rel="noreferrer">
          Baixar {c.documento.toLowerCase()} assinado
        </a>
      ))}
    </Wrap>
  );
}
