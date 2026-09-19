"use client";

/**
 * Corpo da Proposta, compartilhado pela gaveta e pela página.
 *
 * Uma fonte só: o que a spec manda mostrar aparece igual nas duas superfícies,
 * e uma regra nova entra num lugar só. `Wrap` é o que muda — `Secao` aperta em
 * coluna estreita, `Bloco` abre em página.
 */

import Link from "next/link";
import { FileText, Send } from "lucide-react";
import {
  ROTULO_FAMILIA, ROTULO_MODO_FECHAMENTO, ROTULO_STATUS_PROPOSTA,
  type ModoFechamento,
} from "@/lib/vendas/dominio";
import type { DetalheProposta } from "@/app/(crm2)/propostas/actions";
import { AvisoBloqueio, Campo, Secao, Tag, dataCurta, dataHora, moedaExata, type Bloqueio } from "./ui";
import { Bloco } from "./pagina";
import { AcoesContato } from "./pagina";
import { rotuloAtor, rotuloEvento } from "./PreVendas";

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
export function AcoesProposta({ proposta, pendente, acoes, rotaBase = "/onface-preview" }: {
  proposta: DetalheProposta; pendente: boolean; acoes: AcoesCorpoProposta; rotaBase?: string;
}) {
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
        <Link className="ov-botao" data-variante="contorno" href={`${rotaBase}/pipeline/${proposta.oportunidade.id}`}>
          Abrir oportunidade
        </Link>
      ) : null}
      {proposta.empresa.id ? (
        <Link className="ov-botao" data-variante="contorno" href={`${rotaBase}/contatos/empresas/${proposta.empresa.id}`}>
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
            Proposta aceita. A oportunidade continua aberta até a evidência de fechamento:{" "}
            {proposta.modoFechamento === "CONTRACT" ? "contrato assinado" : "pagamento confirmado"}.
            Aceite não é ganho.
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

      {/* Bloco 03 §5: recorrente e não recorrente separados. Somar os dois num
          total único engana, e a spec proíbe. */}
      <Wrap titulo="Composição financeira">
        <div className="ov-composicao">
          <div className="ov-composicao-item">
            <dt>Recorrente / mês</dt>
            <dd>{moedaExata(proposta.composicao.recorrenteMensal)}</dd>
          </div>
          <div className="ov-composicao-item">
            <dt>Não recorrente</dt>
            <dd>{moedaExata(proposta.composicao.naoRecorrente)}</dd>
          </div>
          {proposta.composicao.tcv !== null ? (
            <div className="ov-composicao-item">
              <dt>Contratado ({proposta.composicao.prazoMeses} meses)</dt>
              <dd>{moedaExata(proposta.composicao.tcv)}</dd>
            </div>
          ) : null}
        </div>
        {proposta.composicao.tcv === null && proposta.composicao.recorrenteMensal > 0 ? (
          <p className="ov-nota">Sem prazo contratual definido, o valor total do contrato não é calculado.</p>
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

      <Wrap titulo="Tracking">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Enviada">{dataHora(proposta.tracking.enviadaEm)}</Campo>
          <Campo rotulo="Primeira visualização">{dataHora(proposta.tracking.primeiraVisualizacao)}</Campo>
          <Campo rotulo="Validade">{dataCurta(proposta.dataValidade)}</Campo>
          <Campo rotulo="Aceita">{dataHora(proposta.tracking.aceitaEm)}</Campo>
          <Campo rotulo="Recusada">{dataHora(proposta.tracking.recusadaEm)}</Campo>
        </dl>
      </Wrap>

      <Wrap titulo="Histórico">
        {proposta.timeline.length === 0 ? (
          <p className="ov-nota">Nenhum evento registrado.</p>
        ) : (
          <div className="ov-timeline">
            {proposta.timeline.slice(0, variante === "pagina" ? 30 : 15).map((e) => (
              <div className="ov-timeline-item" key={e.id}>
                <span className="ov-timeline-marca" aria-hidden />
                <div>
                  <strong>{rotuloEvento(e.tipo)}</strong>
                  <span>
                    {dataHora(e.ocorridoEm)}
                    {e.usuarioNome ? ` · ${e.usuarioNome}` : e.atorTipo !== "HUMAN" ? ` · ${rotuloAtor(e.atorTipo)}` : ""}
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
