"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Editor de cadência — a sequência como lista, no padrão da seção.
 *
 * Substitui o canvas React Flow que abria num véu escuro
 * (`data-cf2-theme="builder"`, 44 linhas de hex, nenhum componente da casa).
 * Aqui cada passo é um cartão: QUANDO (espera desde o anterior) · O QUÊ
 * (mensagem, tarefa, atualização, condição) · POR ONDE (canal e número).
 * Arrasta para reordenar, clica para editar ali mesmo.
 *
 * Nada de peça nova: os campos saem de `fluxos/Campos.tsx` (o mesmo
 * renderizador do inspetor de Fluxos, com o seletor de variáveis, o número
 * que mostra "(desconectado)" e a duração em minutos/horas/dias) e as
 * classes saem de `automacoes.css` + `fluxos/fluxos.css`. O que esta tela
 * acrescenta de CSS é só o cartão de passo.
 *
 * O documento salvo continua sendo o grafo (`passos.ts` traduz nos dois
 * sentidos), pelas mesmas rotas de rascunho/publicação.
 * ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Braces, ChevronDown, Clock, Copy, Eye,
  GitBranch, GripVertical, ListTodo, Mail, MessageCircle, PhoneOutgoing, Plus, Rocket,
  Save, Sparkles, Tag, Trash2,
} from "lucide-react";
import { ROTULO_ENTIDADE, type OpcoesInspetor, type TipoEntidade } from "@/lib/automacoes/grafo";
import { EVENT_CATALOG } from "@/components/crm2/automacoes/followup-types";
import { followupGraphSchema } from "@/lib/ai-platform/followup/graph";
import { validateFollowupForPublish } from "@/lib/ai-platform/followup/validate";
import type { FollowupGraph, FollowupNode } from "@/lib/ai-platform/followup/graph";
import { Campo, type ContextoCampo } from "../fluxos/Campos";
import type { GrupoVariaveis } from "../fluxos/SeletorVariaveis";
import {
  OPERADORES_CONDICAO, ROTULO_ACAO_CRM, ROTULO_CANAL, ROTULO_TIPO,
  VARIAVEIS_CADENCIA, camposDoPasso, grafoParaPassos, novoId, passoNovo, passosParaGrafo,
  pendenciasDosPassos, previaTexto, textoEspera,
  type AcaoCrm, type Canal, type OperadorCondicao, type Passo, type TipoPasso,
} from "./passos";
import "../automacoes.css";
import "../fluxos/fluxos.css";
import "./cadencias.css";
import { BotaoMotivo, Radiogroup } from "@/components/onface/ds/escolha";
import { FollowupCanvas } from "./FollowupCanvas";
import { FollowupInspector } from "./FollowupInspector";

export type CadenciaEditavel = {
  id: string | null;
  nome: string;
  entityType: string;
  visibility: "personal" | "shared";
  ownerId: string | null;
  ativo: boolean;
  publishedAt: string | null;
  grafo: import("@/lib/ai-platform/followup/graph").FollowupGraph;
};

type Opcoes = OpcoesInspetor & { templates: { id: string; nome: string; categoria: string; conteudo: string }[] };

const SEM_PERMISSAO = "Sua função não tem a permissão automation.manage";

const CANAIS: { valor: Canal; rotulo: string; dica: string }[] = [
  { valor: "whatsapp", rotulo: "WhatsApp", dica: "Texto que você escreve, com variáveis." },
  { valor: "whatsapp_template", rotulo: "Modelo", dica: "Modelo aprovado da biblioteca." },
  { valor: "whatsapp_ia", rotulo: "Com IA", dica: "O agente escreve na hora, pelo histórico." },
  { valor: "email", rotulo: "E-mail", dica: "Assunto e corpo, pelo Resend." },
  { valor: "ligacao", rotulo: "Ligação", dica: "Põe o contato na fila de discagem da Callface." },
];

const ICONE_CANAL: Record<Canal, typeof MessageCircle> = {
  whatsapp: MessageCircle, whatsapp_template: MessageCircle, whatsapp_ia: Sparkles,
  email: Mail, ligacao: PhoneOutgoing,
};

const TIPOS_PARA_ADICIONAR: { tipo: TipoPasso; icone: typeof MessageCircle; dica: string }[] = [
  { tipo: "mensagem", icone: MessageCircle, dica: "WhatsApp, e-mail ou ligação." },
  { tipo: "tarefa", icone: ListTodo, dica: "Tarefa para uma pessoa do time." },
  { tipo: "crm", icone: Tag, dica: "Nota, tag, etapa ou responsável." },
  { tipo: "condicao", icone: GitBranch, dica: "Segue só se a regra bater; senão encerra." },
  { tipo: "classificar", icone: Sparkles, dica: "Espera a resposta e a IA diz o que ela quer." },
];

/** As variáveis que o motor resolve em qualquer passo de texto — sempre as
 *  mesmas, porque o snapshot do enrollment é o mesmo em todo passo. */
const GRUPOS_VARIAVEIS: GrupoVariaveis[] = [
  { rotulo: "Do registro inscrito", itens: VARIAVEIS_CADENCIA.map((v) => ({ caminho: v.chave, rotulo: v.rotulo })) },
];

function iconeDoPasso(passo: Passo) {
  if (passo.tipo === "mensagem") return ICONE_CANAL[passo.canal];
  if (passo.tipo === "tarefa") return ListTodo;
  if (passo.tipo === "crm") return Tag;
  if (passo.tipo === "condicao") return GitBranch;
  return Sparkles;
}

function tituloDoPasso(passo: Passo): string {
  if (passo.tipo === "mensagem") return ROTULO_CANAL[passo.canal];
  if (passo.tipo === "crm") return ROTULO_ACAO_CRM[passo.acao];
  return ROTULO_TIPO[passo.tipo];
}

function resumoDoPasso(passo: Passo, opcoes?: Opcoes): string {
  if (passo.tipo === "mensagem") {
    if (passo.canal === "whatsapp") return passo.mensagem?.trim() || "Sem texto ainda.";
    if (passo.canal === "email") return passo.assunto?.trim() ? `“${passo.assunto}”` : "Sem assunto ainda.";
    if (passo.canal === "whatsapp_ia") return passo.instrucao?.trim() || "Sem instrução ainda.";
    if (passo.canal === "whatsapp_template") {
      const t = opcoes?.templates.find((x) => x.id === passo.templateId);
      return t ? `${t.nome} · ${t.categoria}` : "Nenhum modelo escolhido.";
    }
    return "Entra na fila de discagem.";
  }
  if (passo.tipo === "tarefa") return passo.titulo?.trim() || "Sem título ainda.";
  if (passo.tipo === "crm") {
    if (passo.acao === "nota") return passo.titulo?.trim() || "Sem título ainda.";
    if (passo.acao === "etapa") return passo.etapa ? `Para ${passo.etapa}` : "Sem etapa escolhida.";
    if (passo.acao === "responsavel") return opcoes?.usuarios.find((u) => u.id === passo.responsavelId)?.nome ?? "Sem responsável escolhido.";
    return opcoes?.tags.find((t) => t.id === passo.tagId)?.nome ?? "Sem tag escolhida.";
  }
  if (passo.tipo === "condicao") {
    const r = passo.regras[0];
    const texto = r?.campo ? `${r.campo} ${OPERADORES_CONDICAO.find((o) => o.valor === r.op)?.rotulo ?? r.op} ${r.valor || "…"}` : "Sem regra ainda.";
    return passo.regras.length > 1 ? `${texto} (+${passo.regras.length - 1})` : texto;
  }
  const segue = passo.classes.find((c) => c.id === passo.segueEm);
  return segue ? `Segue quando for “${segue.rotulo}”` : "Sem classe escolhida.";
}

/** O número pelo qual o passo fala, dito por extenso: é a informação que o
 *  editor antigo nunca ofereceu, mesmo com o motor sabendo usar. */
function textoNumero(passo: Passo, opcoes?: Opcoes): string | null {
  if (passo.tipo !== "mensagem" || passo.canal === "email" || passo.canal === "ligacao") return null;
  if (!passo.sessaoId) return "Número do responsável";
  const s = opcoes?.sessoesWhatsapp.find((x) => x.id === passo.sessaoId);
  if (!s) return "Número removido";
  return s.conectada ? s.nome : `${s.nome} (desconectado)`;
}

export function EditorCadencia({ cadencia, podeGerenciar, aoFechar, aoSalvar }: {
  cadencia: CadenciaEditavel;
  podeGerenciar: boolean;
  aoFechar: () => void;
  aoSalvar: (corpo: { nome: string; entityType: string; visibility: "personal" | "shared"; grafo: unknown }, publicar: boolean) => Promise<void>;
}) {
  const leituraInicial = useMemo(() => grafoParaPassos(cadencia.grafo), [cadencia.grafo]);
  const [grafoEditado, setGrafoEditado] = useState<FollowupGraph>(cadencia.grafo);
  const [nome, setNome] = useState(cadencia.nome);
  const [entityType, setEntityType] = useState(cadencia.entityType);
  const [visibility, setVisibility] = useState<"personal" | "shared">(cadencia.visibility);
  const [evento, setEvento] = useState(leituraInicial.evento);
  const [passos, setPassos] = useState<Passo[]>(leituraInicial.passos);
  // Abre fechado: a primeira leitura tem de ser a SEQUÊNCIA inteira. Cartão
  // aberto de saída esconde os passos seguintes e desfaz o motivo da lista.
  const [aberto, setAberto] = useState<string | null>(null);
  const [modoVisual, setModoVisual] = useState(true);
  const [addAberto, setAddAberto] = useState(false);
  const [salvando, setSalvando] = useState<"rascunho" | "publicar" | null>(null);
  const arrastando = useRef<number | null>(null);
  const menuAdd = useRef<HTMLDivElement>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const opcoes = useQuery<Opcoes>({
    queryKey: ["cadencias-opcoes"],
    queryFn: async () => {
      const r = await fetch("/api/automacoes/cadencias/opcoes");
      if (!r.ok) throw new Error("Não foi possível carregar os números e modelos.");
      return r.json();
    },
    staleTime: 60_000,
  });

  const leitura = useMemo(() => grafoParaPassos(grafoEditado), [grafoEditado]);
  const somenteLeitura = !podeGerenciar;
  const grafo = grafoEditado;
  useEffect(() => {
    if (modoVisual) {
      const proxima = grafoParaPassos(grafoEditado).passos;
      setPassos((atual) => JSON.stringify(atual) === JSON.stringify(proxima) ? atual : proxima);
    } else if (!leitura.naoLinear) {
      const proximo = passosParaGrafo(passos, evento);
      setGrafoEditado((atual) => JSON.stringify(atual) === JSON.stringify(proximo) ? atual : proximo);
    }
  }, [modoVisual, grafoEditado, passos, evento, leitura.naoLinear]);
  const pendencias = useMemo(() => {
    const dos = leitura.naoLinear ? [] : pendenciasDosPassos(leitura.passos);
    if (dos.length) return dos;
    const estrutura = followupGraphSchema.safeParse(grafo);
    if (!estrutura.success) return [{ passoId: "", mensagem: estrutura.error.issues[0]?.message ?? "Fluxo inválido." }];
    const v = validateFollowupForPublish(estrutura.data);
    return v.ok ? [] : v.errors.map((e) => ({ passoId: e.nodeId ?? "", mensagem: e.message }));
  }, [grafo]);

  // A pendência precisa aparecer NO passo, não só num aviso no pé: era
  // preciso adivinhar qual dos dez cartões estava incompleto.
  const errosPorNo = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const p of pendencias) if (p.passoId && !mapa[p.passoId]) mapa[p.passoId] = p.mensagem;
    return mapa;
  }, [pendencias]);
  const contagemPassos = Math.max(0, grafo.nodes.length - 2);
  const sujo = useMemo(() => (
    cadencia.id === null
    || nome !== cadencia.nome || entityType !== cadencia.entityType || visibility !== cadencia.visibility
    || JSON.stringify(grafo) !== JSON.stringify(cadencia.grafo)
  ), [nome, entityType, visibility, grafo, cadencia]);

  const ctx: ContextoCampo = {
    opcoes: opcoes.data,
    grupos: GRUPOS_VARIAVEIS,
    ensaio: null,
    entidade: (entityType as TipoEntidade) ?? null,
    somenteLeitura,
    webhookUrl: null,
  };

  const trocar = (id: string, mudanca: Partial<Passo>) =>
    setPassos((atual) => atual.map((p) => (p.id === id ? ({ ...p, ...mudanca } as Passo) : p)));
  const mover = (de: number, para: number) => setPassos((atual) => {
    if (para < 0 || para >= atual.length || de === para) return atual;
    const copia = [...atual];
    copia.splice(para, 0, ...copia.splice(de, 1));
    return copia;
  });
  const adicionar = (tipo: TipoPasso) => {
    const passo = passoNovo(tipo, passos.length ? 1440 : 0);
    setPassos((atual) => [...atual, passo]);
    setAberto(passo.id);
    setAddAberto(false);
  };

  const salvar = async (publicar: boolean) => {
    if (!nome.trim()) { toast.error("Dê um nome à cadência."); return; }
    if (publicar && pendencias.length) { toast.error(pendencias[0].mensagem); return; }
    setSalvando(publicar ? "publicar" : "rascunho");
    try { await aoSalvar({ nome: nome.trim(), entityType, visibility, grafo }, publicar); }
    finally { setSalvando(null); }
  };

  const mudarGrafo = (proximo: FollowupGraph) => {
    setGrafoEditado(proximo);
    const trigger = proximo.nodes.find((n) => n.type === "trigger");
    if (trigger?.type === "trigger") setEvento(trigger.config.event);
  };
  const noSelecionado = grafo.nodes.find((node) => node.id === selecionado) ?? null;
  const editarNo = (node: FollowupNode) => mudarGrafo({ ...grafo, nodes: grafo.nodes.map((item) => item.id === node.id ? node : item) });
  const duplicarNo = () => {
    if (!noSelecionado || noSelecionado.type === "trigger") return;
    const copia = { ...noSelecionado, id: `${noSelecionado.type}-${crypto.randomUUID().slice(0, 8)}`, label: `${noSelecionado.label} (cópia)`, position: { x: noSelecionado.position.x + 40, y: noSelecionado.position.y + 80 } } as FollowupNode;
    mudarGrafo({ ...grafo, nodes: [...grafo.nodes, copia] }); setSelecionado(copia.id);
  };
  const excluirNo = () => {
    if (!noSelecionado || noSelecionado.type === "trigger") return;
    // Apaga o passo E as ligações dele. Sem desfazer nesta tela, pergunta.
    if (!window.confirm(`Excluir “${noSelecionado.label}”? As ligações deste passo saem com ele, e não há como desfazer.`)) return;
    mudarGrafo({ ...grafo, nodes: grafo.nodes.filter((n) => n.id !== noSelecionado.id), edges: grafo.edges.filter((e) => e.source !== noSelecionado.id && e.target !== noSelecionado.id) }); setSelecionado(null);
  };

  // Esc e clique fora fecham o menu de adicionar, nunca o editor: o editor
  // guarda trabalho não salvo, e uma tecla no meio de um campo não pode
  // jogá-lo fora.
  useEffect(() => {
    if (!addAberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAddAberto(false); };
    const fora = (e: MouseEvent) => { if (!menuAdd.current?.contains(e.target as Node)) setAddAberto(false); };
    window.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", fora);
    return () => { window.removeEventListener("keydown", tecla); document.removeEventListener("mousedown", fora); };
  }, [addAberto]);

  const estado = cadencia.ativo ? "Publicada" : cadencia.publishedAt ? "Pausada" : "Rascunho";

  // Sair descartava trabalho em silêncio: esta tela não tem autosave, e o
  // selo "Não salvo" no topo já sabia que havia mudança. Pergunta antes.
  const voltar = () => {
    if (sujo && !window.confirm("Sair sem salvar? As mudanças desta cadência serão perdidas.")) return;
    aoFechar();
  };

  return (
    <div className="ofc-editor" data-modo={modoVisual ? "visual" : "lista"}>
      <header className="ofx-topo">
        <button type="button" className="oa-icone ofx-voltar-topo" aria-label="Voltar às cadências" title="Voltar às cadências" onClick={voltar}>
          <ArrowLeft size={16} />
        </button>
        <input className="ofx-nome" value={nome} maxLength={120} disabled={somenteLeitura} placeholder="Cadência sem nome"
          aria-label="Nome da cadência" onChange={(e) => setNome(e.target.value)} />
        <span className={`oa-selo ${cadencia.ativo ? "oa-ok" : cadencia.publishedAt ? "oa-aviso" : ""}`}>{estado}</span>
        <span className="ofx-espaco" />
        <span className="ofx-salvo" data-estado={sujo ? "erro" : undefined}
          title={sujo ? "Há mudanças que ainda não foram salvas nesta cadência." : "Nada mudou desde o último salvamento."}>
          {sujo ? "Não salvo" : "Salvo"} · {contagemPassos === 1 ? "1 passo" : `${contagemPassos} passos`}
        </span>
        {podeGerenciar && (
          <>
            <button type="button" className="oa-btn oa-btn-secundario" disabled={!!salvando || somenteLeitura} onClick={() => void salvar(false)}>
              <Save size={14} /> {salvando === "rascunho" ? "Salvando…" : "Salvar rascunho"}
            </button>
            <button type="button" className="oa-btn oa-btn-primario" disabled={!!salvando || somenteLeitura || pendencias.length > 0}
              title={pendencias.length ? pendencias[0].mensagem : undefined} onClick={() => void salvar(true)}>
              <Rocket size={14} /> {salvando === "publicar" ? "Publicando…" : "Publicar"}
              {pendencias.length > 0 && <span className="ofx-contador" title={`${pendencias.length} pendência(s)`}>{pendencias.length}</span>}
            </button>
          </>
        )}
      </header>

      {!podeGerenciar && <div className="ofx-faixa"><Eye size={14} aria-hidden /> Somente leitura: {SEM_PERMISSAO.toLowerCase()}.</div>}
      {leitura.naoLinear && (
        <div className="ofx-faixa" data-tom="erro">
          <AlertTriangle size={14} aria-hidden />
          Esta cadência tem caminhos ramificados. O fluxo visual é a fonte de edição; a lista detalhada mostra apenas uma leitura linear parcial para não achatar nenhum ramo.
        </div>
      )}

      <div className="ofc-rolagem">
        <div className="ofc-coluna">
          {/* `fieldset`, não `section`: `legend` só rotula um fieldset — numa
              section ela aparecia mas não dava nome ao grupo. */}
          <fieldset className="ofx-insp-secao ofc-gatilho">
            <legend>Quando começa</legend>
            <div className="ofc-dupla">
              <div className="ofx-campo">
                <label className="ofx-campo-rotulo" htmlFor="cad-evento">Entra na cadência</label>
                <select id="cad-evento" className="oa-input" value={evento} disabled={somenteLeitura} onChange={(e) => { const value = e.target.value; setEvento(value); const trigger = grafo.nodes.find((n) => n.type === "trigger"); if (trigger?.type === "trigger") mudarGrafo({ ...grafo, nodes: grafo.nodes.map((n) => n.id === trigger.id ? { ...trigger, config: { ...trigger.config, event: value } } : n) }); }}>
                  {EVENT_CATALOG.map((ev) => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}
                </select>
                <span className="oa-dica">“Inscrição manual/API” só anda quando alguém inscreve. Evento inscreve quando o fato acontece no CRM.</span>
              </div>
              <div className="ofx-campo">
                <label className="ofx-campo-rotulo" htmlFor="cad-entidade">Tipo de registro</label>
                <select id="cad-entidade" className="oa-input" value={entityType} disabled={somenteLeitura} onChange={(e) => setEntityType(e.target.value)}>
                  {Object.entries(ROTULO_ENTIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <span className="oa-dica">Decide as etapas e os campos oferecidos nos passos. Inscrição manual vale para lead, contato e negócio.</span>
              </div>
              <div className="ofx-campo">
                <label className="ofx-campo-rotulo" htmlFor="cad-visibilidade">Visibilidade</label>
                <select id="cad-visibilidade" className="oa-input" value={visibility} disabled={somenteLeitura} onChange={(e) => setVisibility(e.target.value as "personal" | "shared")}>
                  <option value="personal">Pessoal — só você</option>
                  <option value="shared">Compartilhada — equipe</option>
                </select>
                <span className="oa-dica">Proprietário: {cadencia.ownerId ? "usuário autenticado da criação" : "legado da equipe"}.</span>
              </div>
            </div>
          </fieldset>

          <div className="ofc-vars" role="note">
            <Braces size={14} aria-hidden />
            <span>
              Variáveis se escrevem com <code>{"{{chave}}"}</code> — duas chaves. <code>{"{nome}"}</code>, com uma só, sai literal na mensagem.
              O botão de variáveis ao lado de cada campo de texto escreve a sintaxe certa.
            </span>
          </div>

          <div className="ofc-modos" role="group" aria-label="Modo de edição">
            <div className="ofc-modos-grupo">
              <button type="button" aria-pressed={modoVisual} className={modoVisual ? "ofc-modo-ativo" : undefined} onClick={() => setModoVisual(true)}>
                <GitBranch size={15} /> Fluxo visual
              </button>
              <BotaoMotivo type="button" aria-pressed={!modoVisual} motivo={leitura.naoLinear ? "Use o fluxo visual para editar todos os ramos" : null} className={!modoVisual ? "ofc-modo-ativo" : undefined} onClick={() => setModoVisual(false)}>
                <ListTodo size={15} /> Lista detalhada
              </BotaoMotivo>
            </div>
            <span>{modoVisual ? "Clique num passo para configurar ao lado. Arraste a bolinha de uma saída até outro passo para ramificar." : "Arraste para reordenar; clique para abrir o passo."} O rascunho só substitui a versão publicada ao publicar.</span>
          </div>

          {modoVisual && (
            <div className="ofc-workspace">
              <FollowupCanvas graph={grafo} selectedId={selecionado} somenteLeitura={somenteLeitura} erros={errosPorNo} onChange={mudarGrafo} onSelect={setSelecionado} />
              <FollowupInspector node={noSelecionado} somenteLeitura={somenteLeitura} opcoes={opcoes.data} onChange={editarNo} onDelete={excluirNo} onDuplicate={duplicarNo} />
            </div>
          )}
          {!modoVisual && (passos.length === 0 ? (
            <div className="ofx-vazio">
              <span className="ofx-vazio-icone"><Clock size={20} /></span>
              <h2>Nenhum passo ainda</h2>
              <p>Uma cadência é uma sequência no tempo: espera tanto, fala isso, por este canal. Comece pelo primeiro toque.</p>
            </div>
          ) : (
            <ol className="ofc-passos">
              {passos.map((passo, i) => {
                const Icone = iconeDoPasso(passo);
                const expandido = aberto === passo.id;
                const numero = textoNumero(passo, opcoes.data);
                const falhas = pendencias.filter((p) => p.passoId === passo.id);
                return (
                  <li key={passo.id} data-aberto={expandido ? "true" : undefined} data-alvo={alvo === i ? "true" : undefined}
                    onDragOver={(e) => { if (arrastando.current !== null) { e.preventDefault(); setAlvo(i); } }}
                    onDragLeave={() => setAlvo((a) => (a === i ? null : a))}
                    onDrop={(e) => { e.preventDefault(); if (arrastando.current !== null) mover(arrastando.current, i); arrastando.current = null; setAlvo(null); }}>
                    <div className="ofc-passo">
                      {/* `setData` não é enfeite: sem ele o Firefox nem começa
                          o arraste, e reordenar não funcionava lá. */}
                      <span className="ofc-arrasta" draggable={!somenteLeitura} aria-hidden
                        onDragStart={(e) => { arrastando.current = i; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", passo.id); }}
                        onDragEnd={() => { arrastando.current = null; setAlvo(null); }}>
                        <GripVertical size={14} />
                      </span>
                      <button type="button" className="ofc-passo-cab" aria-expanded={expandido} onClick={() => setAberto(expandido ? null : passo.id)}>
                        <span className="ofx-passo-num">{i + 1}</span>
                        <span className="ofc-quando"><Clock size={11} aria-hidden /> {textoEspera(passo.esperaMin)}</span>
                        <span className="ofc-passo-corpo">
                          <strong><Icone size={13} aria-hidden /> {tituloDoPasso(passo)}</strong>
                          <span>{resumoDoPasso(passo, opcoes.data)}</span>
                        </span>
                        {numero && <span className="oa-selo ofc-numero">{numero}</span>}
                        {falhas.length > 0 && <span className="oa-selo oa-erro">{falhas.length === 1 ? "falta 1 campo" : `faltam ${falhas.length}`}</span>}
                        <ChevronDown size={14} aria-hidden className="ofc-chevron" />
                      </button>
                      {!somenteLeitura && (
                        <span className="ofc-passo-acoes">
                          <button type="button" className="oa-icone" aria-label="Subir" title="Subir" disabled={i === 0} onClick={() => mover(i, i - 1)}><ArrowUp size={13} /></button>
                          <button type="button" className="oa-icone" aria-label="Descer" title="Descer" disabled={i === passos.length - 1} onClick={() => mover(i, i + 1)}><ArrowDown size={13} /></button>
                          <button type="button" className="oa-icone" aria-label="Duplicar" title="Duplicar" onClick={() => {
                            const copia = { ...passo, id: novoId(passo.tipo) } as Passo;
                            setPassos((atual) => [...atual.slice(0, i + 1), copia, ...atual.slice(i + 1)]);
                            setAberto(copia.id);
                          }}><Copy size={13} /></button>
                          {/* Não há desfazer nesta tela: apagar é definitivo
                              até recarregar sem salvar. Pergunta antes. */}
                          <button type="button" className="oa-icone ofx-menu-perigo" aria-label="Remover" title="Remover" onClick={() => {
                            if (!window.confirm(`Remover o passo ${i + 1} (${tituloDoPasso(passo)})? Não há como desfazer.`)) return;
                            setPassos((atual) => atual.filter((p) => p.id !== passo.id));
                            if (aberto === passo.id) setAberto(null);
                          }}><Trash2 size={13} /></button>
                        </span>
                      )}
                    </div>
                    {expandido && (
                      <div className="ofc-passo-detalhe">
                        <PassoEditor passo={passo} ctx={ctx} opcoes={opcoes.data} primeiro={i === 0} falhas={falhas} aoTrocar={(m) => trocar(passo.id, m)} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          ))}

          {!somenteLeitura && !modoVisual && (
            <div className="ofc-add" ref={menuAdd}>
              <button type="button" className="oa-btn oa-btn-secundario" aria-expanded={addAberto} onClick={() => setAddAberto((a) => !a)}>
                <Plus size={14} /> Adicionar passo
              </button>
              {addAberto && (
                <div className="ofc-add-pop" role="menu">
                  {TIPOS_PARA_ADICIONAR.map(({ tipo, icone: Icone, dica }) => (
                    <button key={tipo} type="button" role="menuitem" onClick={() => adicionar(tipo)}>
                      <span className="ofx-modelo-icone"><Icone size={15} strokeWidth={2.2} /></span>
                      <span><strong>{ROTULO_TIPO[tipo]}</strong><span>{dica}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {pendencias.length > 0 && podeGerenciar && (
            <div className="ofx-aviso ofc-pendencias">
              <AlertTriangle size={14} aria-hidden />
              <div>
                <strong>Para publicar, falta:</strong>
                <ul>
                  {pendencias.slice(0, 6).map((p, i) => (
                    <li key={`${p.passoId}-${i}`}>
                      {p.passoId && modoVisual
                        ? <button type="button" onClick={() => setSelecionado(p.passoId)}>{p.mensagem}</button>
                        : p.mensagem}
                    </li>
                  ))}
                </ul>
                {pendencias.length > 6 ? <small>e mais {pendencias.length - 6}.</small> : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const UNIDADES_ESPERA = [
  { valor: 1 / 60, label: "segundos" },
  { valor: 1, label: "minutos" },
  { valor: 60, label: "horas" },
  { valor: 1440, label: "dias" },
  { valor: 10080, label: "semanas" },
] as const;

function EsperaEditavel({ id, minutos, aoMudar, desabilitado }: { id: string; minutos: number; aoMudar: (valor: number) => void; desabilitado: boolean }) {
  const inicial = minutos > 0 && minutos < 1 ? 1 / 60 : minutos >= 10080 && minutos % 10080 === 0 ? 10080 : minutos >= 1440 && minutos % 1440 === 0 ? 1440 : minutos >= 60 && minutos % 60 === 0 ? 60 : 1;
  const [unidade, setUnidade] = useState<number>(inicial);
  return <div className="ofc-espera-editor">
    <input id={id} className="oa-input" type="number" min={0} step={1} value={Math.round((minutos / unidade) * 100) / 100} disabled={desabilitado} onChange={(e) => aoMudar(Math.max(0, Number(e.target.value)) * unidade)} aria-label="Tempo de espera" />
    <select className="oa-input" value={unidade} disabled={desabilitado} aria-label="Unidade de tempo"
      onChange={(e) => { const u=Number(e.target.value); setUnidade(u); aoMudar(minutos === 0 ? u : Math.max(u,Math.round(minutos/unidade)*u)); }}>
      {UNIDADES_ESPERA.map((x) => <option key={x.label} value={x.valor}>{x.label}</option>)}
    </select>
  </div>;
}

/** Corpo editável de um passo. Campo por campo vem de `fluxos/Campos.tsx`. */
function PassoEditor({ passo, ctx, opcoes, primeiro, falhas, aoTrocar }: {
  passo: Passo; ctx: ContextoCampo; opcoes?: Opcoes; primeiro: boolean;
  falhas: { passoId: string; mensagem: string }[];
  aoTrocar: (mudanca: Partial<Passo>) => void;
}) {
  const campos = camposDoPasso(passo);
  const valor = passo as unknown as Record<string, unknown>;
  const textoPrevia = passo.tipo === "mensagem" && (passo.canal === "whatsapp" || passo.canal === "email")
    ? passo.mensagem?.trim() ?? "" : "";

  return (
    <>
      <fieldset className="ofx-insp-secao">
        <legend>Quando</legend>
        <div className="ofx-campo">
          <label className="ofx-campo-rotulo" htmlFor={passo.id + "-espera"}>{primeiro ? "Depois de entrar na cadência" : "Depois do passo anterior"}</label>
          <EsperaEditavel id={passo.id + "-espera"} minutos={passo.esperaMin} aoMudar={(min) => aoTrocar({ esperaMin: min })} desabilitado={ctx.somenteLeitura} />
          <span className="oa-dica">0 executa em sequência. Tempos em segundos são aproximados pelo processamento periódico do motor.</span>
        </div>
      </fieldset>

      {passo.tipo === "mensagem" && (
        <fieldset className="ofx-insp-secao">
          <legend>Por onde</legend>
          <Radiogroup className="ofx-segmentos ofx-segmentos-largo" rotulo="Canal">
            {CANAIS.map((c) => (
              <button key={c.valor} type="button" role="radio" aria-checked={passo.canal === c.valor} disabled={ctx.somenteLeitura}
                title={c.dica} onClick={() => aoTrocar({ canal: c.valor })}>
                {c.rotulo}
              </button>
            ))}
          </Radiogroup>
          <span className="oa-dica">{CANAIS.find((c) => c.valor === passo.canal)?.dica}</span>
        </fieldset>
      )}

      {passo.tipo === "crm" && (
        <fieldset className="ofx-insp-secao">
          <legend>O quê</legend>
          <select className="oa-input" value={passo.acao} disabled={ctx.somenteLeitura} aria-label="O que atualizar"
            onChange={(e) => aoTrocar({ acao: e.target.value as AcaoCrm })}>
            {Object.entries(ROTULO_ACAO_CRM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </fieldset>
      )}

      {passo.tipo === "mensagem" && passo.canal === "whatsapp_template" && (
        <fieldset className="ofx-insp-secao">
          <legend>Modelo aprovado</legend>
          <EscolherTemplate passo={passo} opcoes={opcoes} somenteLeitura={ctx.somenteLeitura} aoTrocar={aoTrocar} />
        </fieldset>
      )}

      {passo.tipo === "condicao" && <EditorCondicao passo={passo} ctx={ctx} aoTrocar={aoTrocar} />}
      {passo.tipo === "classificar" && <EditorClasses passo={passo} ctx={ctx} aoTrocar={aoTrocar} />}

      {campos.length > 0 && (
        <fieldset className="ofx-insp-secao">
          <legend>{passo.tipo === "mensagem" ? "O que vai" : "Detalhes"}</legend>
          {campos.map((campo) => (
            <Campo key={campo.chave} campo={campo} idBase={passo.id} ctx={ctx} valor={valor[campo.chave]}
              aoMudar={(v) => aoTrocar({ [campo.chave]: v } as Partial<Passo>)} />
          ))}
        </fieldset>
      )}

      {textoPrevia && (
        <fieldset className="ofx-insp-secao">
          <legend>Como vai chegar</legend>
          <div className="ofc-previa" data-canal={passo.tipo === "mensagem" ? passo.canal : undefined}>
            {passo.tipo === "mensagem" && passo.canal === "email" && passo.assunto ? <strong>{previaTexto(passo.assunto)}</strong> : null}
            <p>{previaTexto(textoPrevia)}</p>
          </div>
          <span className="oa-dica">Valores de exemplo. No envio, cada <code>{"{{chave}}"}</code> vira o dado do registro inscrito; chave que o motor não conhece fica literal.</span>
        </fieldset>
      )}

      {falhas.map((f, i) => <span key={i} className="ofx-campo-erro">{f.mensagem}</span>)}
    </>
  );
}

/** Biblioteca de modelos agrupada por categoria, com o texto do modelo à
 *  vista: escolher por nome, sem ver o que vai sair, é escolher no escuro. */
function EscolherTemplate({ passo, opcoes, somenteLeitura, aoTrocar }: {
  passo: Passo & { tipo: "mensagem" }; opcoes?: Opcoes; somenteLeitura: boolean;
  aoTrocar: (mudanca: Partial<Passo>) => void;
}) {
  const lista = opcoes?.templates ?? [];
  const categorias = [...new Set(lista.map((t) => t.categoria))];
  const escolhido = lista.find((t) => t.id === passo.templateId);
  return (
    <>
      <select className="oa-input" value={passo.templateId ?? ""} disabled={somenteLeitura} aria-label="Modelo aprovado"
        onChange={(e) => aoTrocar({ templateId: e.target.value || undefined })}>
        <option value="">{lista.length ? "Escolha o modelo" : "Nenhum modelo ativo nesta organização"}</option>
        {categorias.map((cat) => (
          <optgroup key={cat} label={cat}>
            {lista.filter((t) => t.categoria === cat).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </optgroup>
        ))}
      </select>
      {escolhido && (
        <div className="ofc-previa" data-canal="whatsapp_template">
          <p>{previaTexto(escolhido.conteudo)}</p>
        </div>
      )}
      {escolhido && /\{[A-Za-z0-9_]+\}/.test(escolhido.conteudo) && !escolhido.conteudo.includes("{{") && (
        <span className="ofx-campo-erro">
          Este modelo usa <code>{"{chave}"}</code> com uma chave só, e o servidor substitui <code>{"{{chave}}"}</code>. Ele vai sair com o texto literal. Corrija o modelo no Atendimento ou escreva o texto aqui.
        </span>
      )}
      {opcoes && !lista.length && <span className="oa-dica">Os modelos nascem no Atendimento. Crie um lá e ele aparece aqui.</span>}
    </>
  );
}

function EditorCondicao({ passo, ctx, aoTrocar }: {
  passo: Passo & { tipo: "condicao" }; ctx: ContextoCampo; aoTrocar: (mudanca: Partial<Passo>) => void;
}) {
  const trocarRegra = (i: number, mudanca: Partial<(typeof passo.regras)[number]>) =>
    aoTrocar({ regras: passo.regras.map((r, j) => (j === i ? { ...r, ...mudanca } : r)) });
  return (
    <fieldset className="ofx-insp-secao">
      <legend>Segue só se</legend>
      <Radiogroup className="ofx-segmentos" rotulo="Combinar regras">
        {([["and", "Todas as regras"], ["or", "Qualquer regra"]] as const).map(([v, r]) => (
          <button key={v} type="button" role="radio" aria-checked={(passo.combinador ?? "and") === v} disabled={ctx.somenteLeitura} onClick={() => aoTrocar({ combinador: v })}>{r}</button>
        ))}
      </Radiogroup>
      <div className="ofx-lista">
        {passo.regras.map((regra, i) => (
          <div key={i} className="ofx-lista-item">
            <div className="ofx-lista-corpo ofc-regra">
              <select className="oa-input" value={regra.campo} disabled={ctx.somenteLeitura} aria-label="Campo"
                onChange={(e) => trocarRegra(i, { campo: e.target.value })}>
                {!VARIAVEIS_CADENCIA.some((v) => v.chave === regra.campo) && <option value={regra.campo}>{regra.campo || "Escolha o campo"}</option>}
                {VARIAVEIS_CADENCIA.map((v) => <option key={v.chave} value={v.chave}>{v.rotulo}</option>)}
              </select>
              <select className="oa-input" value={regra.op} disabled={ctx.somenteLeitura} aria-label="Operador"
                onChange={(e) => trocarRegra(i, { op: e.target.value as OperadorCondicao })}>
                {OPERADORES_CONDICAO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </select>
              <input className="oa-input" value={regra.valor} disabled={ctx.somenteLeitura} placeholder="valor" aria-label="Valor"
                onChange={(e) => trocarRegra(i, { valor: e.target.value })} />
            </div>
            {!ctx.somenteLeitura && passo.regras.length > 1 && (
              <button type="button" className="oa-icone" aria-label="Remover regra" onClick={() => aoTrocar({ regras: passo.regras.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
            )}
          </div>
        ))}
        {!ctx.somenteLeitura && (
          <button type="button" className="ofx-adicionar" onClick={() => aoTrocar({ regras: [...passo.regras, { campo: "status", op: "eq", valor: "" }] })}>
            <Plus size={13} strokeWidth={2.4} /> Adicionar regra
          </button>
        )}
      </div>
      <span className="oa-dica">Quando a regra não bate, a cadência encerra ali. É a ramificação que a lista aceita — um Sim que segue e um Não que para.</span>
    </fieldset>
  );
}

function EditorClasses({ passo, ctx, aoTrocar }: {
  passo: Passo & { tipo: "classificar" }; ctx: ContextoCampo; aoTrocar: (mudanca: Partial<Passo>) => void;
}) {
  return (
    <fieldset className="ofx-insp-secao">
      <legend>Classes da resposta</legend>
      <div className="ofx-lista">
        {passo.classes.map((classe, i) => (
          <div key={classe.id} className="ofx-lista-item">
            <div className="ofx-lista-corpo ofc-classe">
              <input className="oa-input" value={classe.rotulo} disabled={ctx.somenteLeitura} placeholder="ex.: Quer reunião" aria-label="Nome da classe"
                onChange={(e) => aoTrocar({ classes: passo.classes.map((c, j) => (j === i ? { ...c, rotulo: e.target.value } : c)) })} />
              <label className="ofc-radio">
                <input type="radio" name={`segue-${passo.id}`} checked={passo.segueEm === classe.id} disabled={ctx.somenteLeitura}
                  onChange={() => aoTrocar({ segueEm: classe.id })} />
                segue a cadência
              </label>
            </div>
            {!ctx.somenteLeitura && passo.classes.length > 1 && (
              <button type="button" className="oa-icone" aria-label="Remover classe" onClick={() => aoTrocar({ classes: passo.classes.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
            )}
          </div>
        ))}
        {!ctx.somenteLeitura && passo.classes.length < 8 && (
          <button type="button" className="ofx-adicionar" onClick={() => aoTrocar({ classes: [...passo.classes, { id: novoId("classe"), rotulo: "" }] })}>
            <Plus size={13} strokeWidth={2.4} /> Adicionar classe
          </button>
        )}
      </div>
      <span className="oa-dica">A classe marcada segue para o próximo passo. As outras, e o silêncio, encerram a cadência.</span>
    </fieldset>
  );
}
