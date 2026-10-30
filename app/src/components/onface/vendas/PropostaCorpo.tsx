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
import { AlertTriangle, FileText, Send } from "lucide-react";
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
import { MODELOS_PDF, ROTULO_MODELO_PDF, type ModeloPdf } from "@/lib/propostas/modelos-pdf";
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
  /** Tenta de novo o contrato/pagamento de uma proposta aceita que não andou. Seguro de repetir. */
  reprocessar?: () => Promise<void>;
  /** Troca o modelo do PDF desta proposta. Sem isso, o bloco do PDF só pré-visualiza. */
  salvarModeloPdf?: (modelo: ModeloPdf) => Promise<void>;
  /** Desativa/reativa o link público. Sem isso, o bloco só copia e abre. */
  alternarLinkPublico?: (ativo: boolean) => Promise<void>;
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

      {proposta.pendenciasDoAceite.length > 0 ? (
        <div className="ov-bloqueio" role="alert">
          <AlertTriangle aria-hidden />
          <div>
            <strong>O cliente aceitou, mas o fechamento não andou.</strong>
            <ul style={{ margin: "4px 0", paddingLeft: 16 }}>
              {proposta.pendenciasDoAceite.map((g) => (
                <li key={g.grupoId} style={{ fontSize: "inherit" }}>
                  {g.passo === "contrato" ? "Contrato não gerado ou não enviado" : "Link de pagamento não gerado"}
                  {g.erro ? `: ${g.erro}` : " (sem erro registrado; a tentativa pode ter sido interrompida)"}
                  {g.tentativas > 0 ? ` · ${g.tentativas} tentativa(s)` : ""}
                  {g.ultimaTentativaEm ? ` · última em ${dataHora(g.ultimaTentativaEm)}` : ""}
                </li>
              ))}
            </ul>
            O sistema tenta de novo sozinho (até 5 vezes, com intervalo crescente). Corrija o dado que falta e reprocesse agora.
            {acoes.reprocessar ? (
              <div className="ov-acoes" style={{ marginTop: 8 }}>
                <button type="button" className="ov-botao" disabled={pendente} onClick={() => void acoes.reprocessar!()}>Reprocessar aceite</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* O link onde o cliente paga, à mão do vendedor. Aceita sem link visível
          obrigava a abrir o Stripe ou a página pública para reenviar ao cliente
          que acabou de fechar — e quando a cobrança é na assinatura (upgrade),
          é a fatura do pró-rata que o cliente precisa receber. */}
      {proposta.linksDePagamento.length > 0 ? (
        <div className="ov-bloqueio" role="status">
          <FileText aria-hidden />
          <div>
            <strong>{proposta.linksDePagamento.some((l) => l.pago) ? "Pagamento confirmado." : "Link de pagamento do cliente"}</strong>
            {proposta.linksDePagamento.map((l) => (
              <div key={l.grupoId + l.url} className="ov-acoes" style={{ marginTop: 8, alignItems: "center", gap: 8 }}>
                <a className="ov-botao" href={l.url} target="_blank" rel="noreferrer">
                  {l.tipo === "fatura" ? "Abrir fatura do upgrade" : "Abrir checkout"}
                </a>
                <button type="button" className="ov-botao" onClick={() => void navigator.clipboard?.writeText(l.url)}>Copiar link</button>
                {l.pago ? <span style={{ fontSize: 12 }}>já pago</span> : null}
              </div>
            ))}
            {proposta.linksDePagamento.some((l) => l.tipo === "fatura") ? (
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Os itens já entraram na assinatura do cliente. Esta fatura é só o proporcional dos dias que faltam no ciclo.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Venda por contrato: a cobrança é a fatura que a assinatura emite, não um
          link de checkout. Dizer a data e o prazo é o que o vendedor precisa
          para falar com o cliente — e evita o botão que levava a "Pagamento
          online indisponível" (proposta #1590, 26/10/2026). */}
      {proposta.cobrancaNaAssinatura ? (
        <div className="ov-bloqueio" role="status">
          <FileText aria-hidden />
          <div>
            <strong>Cobrança na assinatura do cliente</strong>
            <div style={{ marginTop: 6 }}>
              {proposta.cobrancaNaAssinatura.faturaUrl ? (
                <>
                  Fatura emitida{proposta.cobrancaNaAssinatura.faturaValor !== null
                    ? ` de ${moedaExata(proposta.cobrancaNaAssinatura.faturaValor)}`
                    : ""}
                  {proposta.cobrancaNaAssinatura.faturaVenceEm
                    ? `, vence em ${dataCurta(proposta.cobrancaNaAssinatura.faturaVenceEm)}`
                    : ""}. Mande o link ao cliente.
                </>
              ) : (
                <>
                  Não há link de pagamento agora: esta venda é por contrato e o
                  cliente paga depois de usar.{" "}
                  {proposta.cobrancaNaAssinatura.proximaFaturaEm
                    ? `A primeira fatura sai em ${dataCurta(proposta.cobrancaNaAssinatura.proximaFaturaEm)}`
                    : "A fatura sai na virada do ciclo"}
                  {`, com ${proposta.cobrancaNaAssinatura.diasParaPagar} dias para pagar. `}
                  O boleto vai para o cliente por e-mail quando for emitido.
                </>
              )}
            </div>
            {proposta.cobrancaNaAssinatura.faturaUrl ? (
              <div className="ov-acoes" style={{ marginTop: 8, alignItems: "center", gap: 8 }}>
                <a className="ov-botao" href={proposta.cobrancaNaAssinatura.faturaUrl} target="_blank" rel="noreferrer">Abrir fatura</a>
                <button type="button" className="ov-botao"
                  onClick={() => void navigator.clipboard?.writeText(proposta.cobrancaNaAssinatura!.faturaUrl!)}>Copiar link</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

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
          {proposta.composicao.recorrenteMensal > 0 || (proposta.composicao.recorrenteAnual === 0 && proposta.composicao.recorrenteTrimestral === 0 && proposta.composicao.recorrenteSemestral === 0 && proposta.composicao.naoRecorrente === 0) ? (
            <div className="ov-composicao-item">
              <dt>Mensal / mês</dt>
              <dd>{moedaExata(proposta.composicao.recorrenteMensal)}</dd>
            </div>
          ) : null}
          {proposta.composicao.recorrenteTrimestral > 0 ? (
            <div className="ov-composicao-item">
              <dt>Trimestral / trimestre</dt>
              <dd>{moedaExata(proposta.composicao.recorrenteTrimestral)}</dd>
            </div>
          ) : null}
          {proposta.composicao.recorrenteSemestral > 0 ? (
            <div className="ov-composicao-item">
              <dt>Semestral / semestre</dt>
              <dd>{moedaExata(proposta.composicao.recorrenteSemestral)}</dd>
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
        {proposta.composicao.tcv === null && (proposta.composicao.recorrenteMensal > 0 || proposta.composicao.recorrenteTrimestral > 0 || proposta.composicao.recorrenteSemestral > 0 || proposta.composicao.recorrenteAnual > 0) ? (
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

      <LinkPublico proposta={proposta} acoes={acoes} Wrap={Wrap} />
      <ModeloDoPdf proposta={proposta} acoes={acoes} Wrap={Wrap} />
      <ContratoDaProposta proposta={proposta} Wrap={Wrap} />
      <EmailsDaProposta proposta={proposta} Wrap={Wrap} />

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
function LinkPublico({ proposta, acoes, Wrap }: { proposta: DetalheProposta; acoes: AcoesCorpoProposta; Wrap: typeof Secao }) {
  const [salvando, setSalvando] = React.useState(false);
  if (proposta.status === "rascunho" || proposta.status === "substituida") return null;
  const alternar = (ativo: boolean) => {
    if (!acoes.alternarLinkPublico) return;
    setSalvando(true);
    void acoes.alternarLinkPublico(ativo).finally(() => setSalvando(false));
  };
  if (proposta.linkRevogadoEm) {
    return (
      <Wrap titulo="Link para o cliente">
        <p className="ov-nota">Link desativado em {dataHora(proposta.linkRevogadoEm)}. Quem abrir vê "link desativado" e não consegue aceitar nem pagar.</p>
        {acoes.alternarLinkPublico ? (
          <div className="ov-acoes">
            <button type="button" className="ov-botao" data-variante="contorno" disabled={salvando} onClick={() => alternar(true)}>Reativar link</button>
          </div>
        ) : null}
      </Wrap>
    );
  }
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
        {acoes.alternarLinkPublico ? (
          <button type="button" className="ov-botao" data-variante="contorno" disabled={salvando} onClick={() => alternar(false)}>Desativar link</button>
        ) : null}
      </div>
    </Wrap>
  );
}

/** O que o aceite gerou: estado da assinatura e o documento final assinado. */
/**
 * Qual PDF o cliente recebe. "Ver" abre o modelo sem gravar nada (`?modelo=`), para
 * comparar antes de escolher; escolher grava na proposta e passa a valer no e-mail e
 * na página pública. `padrao` é o PDF de sempre.
 */
function ModeloDoPdf({ proposta, acoes, Wrap }: {
  proposta: DetalheProposta; acoes: AcoesCorpoProposta; Wrap: typeof Secao;
}) {
  // Enquanto grava, o rádio fica travado para não enfileirar duas trocas.
  const [salvando, setSalvando] = React.useState(false);
  return (
    <Wrap titulo="PDF da proposta">
      <div style={{ display: "grid", gap: 6 }}>
        {MODELOS_PDF.map((m) => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, cursor: acoes.salvarModeloPdf && !salvando ? "pointer" : "default" }}>
              <input
                type="radio" name={`modelo-pdf-${proposta.id}`} value={m}
                checked={proposta.modeloPdf === m}
                disabled={salvando || !acoes.salvarModeloPdf}
                onChange={() => {
                  if (!acoes.salvarModeloPdf) return;
                  setSalvando(true);
                  void acoes.salvarModeloPdf(m).finally(() => setSalvando(false));
                }}
              />
              {ROTULO_MODELO_PDF[m]}
            </label>
            <a className="ov-botao" data-variante="contorno" style={{ padding: "2px 8px", fontSize: 12 }}
               href={`/api/propostas/${proposta.id}/pdf?modelo=${m}`} target="_blank" rel="noreferrer">ver</a>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

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

/**
 * Os e-mails desta proposta e dos contratos dela, com a entrega que o PROVEDOR informou. "Aceito pelo provedor"
 * não é "entregue", e "não chegou" aparece em destaque para quem enviou corrigir o endereço.
 */
function EmailsDaProposta({ proposta, Wrap }: { proposta: DetalheProposta; Wrap: typeof Secao }) {
  if (proposta.entregas.length === 0) return null;
  return (
    <Wrap titulo="E-mails enviados">
      <div className="ov-timeline">
        {proposta.entregas.map((e) => (
          <div className="ov-timeline-item" key={e.id}>
            <span className="ov-timeline-marca" aria-hidden />
            <div>
              <strong>{e.assunto}</strong>
              <span>
                Para {e.para} · {dataHora(e.enviadoEm)} · {e.via === "conta" ? `pela caixa ${e.de}` : "pelo e-mail do sistema"}
              </span>
              <span role={e.falhou ? "alert" : undefined} style={e.falhou ? { color: "var(--destructive)", fontWeight: 600 } : undefined}>
                {e.texto}
              </span>
            </div>
          </div>
        ))}
      </div>
      {proposta.entregas.some((e) => e.falhou) ? (
        <p className="ov-nota">
          Corrija o e-mail do contato na Pessoa. Para reenviar, copie o link da proposta ou crie uma revisão.
        </p>
      ) : null}
    </Wrap>
  );
}
