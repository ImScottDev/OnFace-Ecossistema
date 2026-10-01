"use client";

/* Cartão de um bloco no canvas, na linguagem `fx-no` do DS (cartão branco,
 * rótulo de tipo em caixa alta com ícone, título, resumo) adaptada ao React
 * Flow: entrada à esquerda, saídas à direita, uma linha por saída quando há
 * mais de uma (Sim/Não, rotas, classes, Erro), como o nó Opções do benchmark.
 * Saída livre ganha o "+" que abre a paleta já ligada a ela. */
import { memo, useEffect, type MouseEvent } from "react";
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Check, Clock, Plus, PowerOff, X } from "lucide-react";
import {
  CATALOGO_NOS, saidasDoNo,
  type NoFluxo, type OpcoesInspetor, type Pendencia,
} from "@/lib/automacoes/grafo";
import { iconeDe } from "./icones";
import { resumoNo, tituloGatilho } from "./resumo";

/** Marca de execução/ensaio sobre o nó. */
export type MarcaTrilha = "ok" | "simulado" | "esperaria" | "erro" | "pendencia" | "aguardando" | "pulado";

export interface DadosNo extends Record<string, unknown> {
  no: NoFluxo;
  pendencias: Pendencia[];
  opcoes?: OpcoesInspetor;
  /** Saídas sem ligação: ganham o "+". */
  livres: string[];
  trilha?: { marca: MarcaTrilha; saida: string | null };
  somenteLeitura: boolean;
  aoMais: (noId: string, saidaId: string) => void;
}

export type NoRF = Node<DadosNo, "no">;

const ROTULO_CATEGORIA = { gatilho: "Quando", logica: "Lógica", acao: "Plataforma", integracao: "Integração", ia: "IA" } as const;

const MARCA: Record<MarcaTrilha, { rotulo: string; Icone: typeof Check }> = {
  ok: { rotulo: "Passou", Icone: Check },
  simulado: { rotulo: "Simulado", Icone: Check },
  esperaria: { rotulo: "Esperaria", Icone: Clock },
  aguardando: { rotulo: "Aguardando", Icone: Clock },
  erro: { rotulo: "Erro", Icone: X },
  pendencia: { rotulo: "Pendência", Icone: AlertTriangle },
  pulado: { rotulo: "Pulado", Icone: PowerOff },
};

function TextoComExpressao({ texto }: { texto: string }) {
  // {{ caminho }} vira uma pílula: dá para ver de relance o que é dado vivo.
  const partes = texto.split(/(\{\{[^}]*\}\})/g);
  return (
    <>
      {partes.map((p, i) =>
        /^\{\{[^}]*\}\}$/.test(p)
          ? <code key={i} className="ofx-expr">{p.slice(2, -2).trim()}</code>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function NoCanvasBase({ id, data, selected }: NodeProps<NoRF>) {
  const { no, pendencias, opcoes, livres, trilha, somenteLeitura, aoMais } = data;
  const meta = CATALOGO_NOS[no.tipo];
  const Icone = iconeDe(meta.icone);
  const saidas = saidasDoNo(no);
  const multiplas = saidas.length > 1;
  const titulo = no.rotulo?.trim() || (no.tipo === "gatilho" ? tituloGatilho(no) : meta.rotulo);
  const linhas = resumoNo(no, opcoes);
  const marca = trilha ? MARCA[trilha.marca] : null;

  // Saída nova (rota, classe, saída de erro) muda os handles: o React Flow só
  // re-mede quando avisado, senão a ligação nova sai do lugar errado.
  const updateNodeInternals = useUpdateNodeInternals();
  const chaveSaidas = saidas.map((s) => s.id).join("|");
  useEffect(() => { updateNodeInternals(id); }, [id, chaveSaidas, updateNodeInternals]);

  const mais = (saidaId: string) => (e: MouseEvent) => { e.stopPropagation(); aoMais(id, saidaId); };

  const botaoMais = (saidaId: string, rotulo: string) =>
    !somenteLeitura && livres.includes(saidaId) ? (
      <button type="button" className="ofx-mais nodrag nopan" onClick={mais(saidaId)} aria-label={`Adicionar bloco depois de ${rotulo}`} title="Adicionar o próximo bloco">
        <Plus size={12} strokeWidth={2.6} />
      </button>
    ) : null;

  return (
    <div
      className="ofx-no"
      data-categoria={meta.categoria}
      data-selecionado={selected ? "true" : undefined}
      data-pendente={pendencias.length ? "true" : undefined}
      data-desligado={no.desativado ? "true" : undefined}
      data-trilha={trilha?.marca}
    >
      {no.tipo !== "gatilho" && <Handle type="target" position={Position.Left} className="ofx-porta ofx-porta-entrada" isConnectable={!somenteLeitura} />}

      <div className="ofx-no-cab">
        <span className="ofx-no-icone"><Icone size={13} strokeWidth={2.2} aria-hidden /></span>
        <span className="ofx-no-tipo">{no.tipo === "gatilho" ? "Quando" : ROTULO_CATEGORIA[meta.categoria]}</span>
        {no.desativado && <span className="ofx-no-selo">Desligado</span>}
        {marca && (
          <span className="ofx-no-marca" data-marca={trilha!.marca}>
            <marca.Icone size={11} strokeWidth={2.6} aria-hidden />{marca.rotulo}
          </span>
        )}
        <span className="ofx-no-id" title="Use em {{ nos.<id>.campo }}">{id}</span>
      </div>
      <strong className="ofx-no-titulo">{titulo}</strong>
      {no.rotulo?.trim() && no.tipo !== "gatilho" && <span className="ofx-no-sub">{meta.rotulo}</span>}

      {linhas.length > 0 && (
        <dl className="ofx-no-resumo">
          {linhas.map((l) => (
            <div key={l.rotulo}>
              <dt>{l.rotulo}</dt>
              <dd><TextoComExpressao texto={l.valor.length > 90 ? `${l.valor.slice(0, 88)}…` : l.valor} /></dd>
            </div>
          ))}
        </dl>
      )}

      {pendencias.length > 0 && (
        <p className="ofx-no-pend" title={pendencias.map((p) => p.mensagem).join("\n")}>
          <AlertTriangle size={12} aria-hidden />
          <span>{pendencias[0].mensagem}</span>
          {pendencias.length > 1 && <b>+{pendencias.length - 1}</b>}
        </p>
      )}

      {multiplas ? (
        <ul className="ofx-no-saidas">
          {saidas.map((s) => (
            <li key={s.id} data-erro={s.erro ? "true" : undefined} data-tomada={trilha?.saida === s.id ? "true" : undefined}>
              <span>{s.rotulo}</span>
              <Handle type="source" position={Position.Right} id={s.id} className="ofx-porta" isConnectable={!somenteLeitura} />
              {botaoMais(s.id, s.rotulo)}
            </li>
          ))}
        </ul>
      ) : saidas.length === 1 ? (
        <>
          <Handle type="source" position={Position.Right} id={saidas[0].id} className="ofx-porta" isConnectable={!somenteLeitura} />
          <span className="ofx-mais-unico">{botaoMais(saidas[0].id, titulo)}</span>
        </>
      ) : null}
    </div>
  );
}

export const NoCanvas = memo(NoCanvasBase);
