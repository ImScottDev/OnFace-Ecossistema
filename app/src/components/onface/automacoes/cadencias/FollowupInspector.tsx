"use client";

import { Copy, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { EVENT_CATALOG } from "@/components/crm2/automacoes/followup-types";
import type { FollowupNode } from "@/lib/ai-platform/followup/graph";
import {
  GRUPOS_VARIAVEIS_CADENCIA, SUGESTOES_CAMPO_CADENCIA, previaTexto, ROTULO_TIPO_NO,
  sugestoesDeValor, VARIAVEIS_CADENCIA,
} from "./passos";
import { EntradaComLista } from "../fluxos/SeletorVariaveis";
import type { OpcoesInspetor } from "@/lib/automacoes/grafo";

type Props = { node: FollowupNode | null; somenteLeitura: boolean; opcoes?: OpcoesInspetor; onChange: (node: FollowupNode) => void; onDelete: () => void; onDuplicate: () => void };
const input = "oa-input";

export function FollowupInspector({ node, somenteLeitura, opcoes, onChange, onDelete, onDuplicate }: Props) {
  // O vazio é uma peça do painel, não um texto solto no meio da página: sem
  // a casca `ofc-inspector` ele flutuava sem fundo nem borda ao lado do
  // desenho, e a coluna da direita parecia quebrada.
  if (!node) return <div className="ofc-inspector"><div className="ofc-inspector-empty">
    <MousePointerClick size={26} aria-hidden />
    <strong>Nenhum passo selecionado</strong>
    <p>Clique num passo do desenho para configurar espera, mensagem, condição ou ação. Para ramificar, arraste a bolinha de uma saída até o próximo passo.</p>
  </div></div>;
  const set = (config: Record<string, unknown>) => onChange({ ...node, config } as FollowupNode);
  const text = (label: string, value: string, change: (v: string) => void, multiline = false) => <label className="ofx-campo"><span className="ofx-campo-rotulo">{label}</span>{multiline ? <textarea className={input} rows={4} value={value} disabled={somenteLeitura} onChange={(e) => change(e.target.value)} /> : <input className={input} value={value} disabled={somenteLeitura} onChange={(e) => change(e.target.value)} />}</label>;
  return <div className="ofc-inspector"><header className="ofc-inspector-header"><div><small>{ROTULO_TIPO_NO[node.type]}</small><h2>{node.label}</h2></div>{!somenteLeitura && <div className="ofc-insp-acoes"><button type="button" className="oa-icone" onClick={onDuplicate} aria-label="Duplicar passo" title="Duplicar passo"><Copy size={14} /></button>{node.type !== "trigger" && <button type="button" className="oa-icone ofx-menu-perigo" onClick={onDelete} aria-label="Excluir passo" title="Excluir passo"><Trash2 size={14} /></button>}</div>}</header><div className="ofc-inspector-fields">
    {text("Título no desenho", node.label, (label) => onChange({ ...node, label } as FollowupNode))}
    {node.type === "trigger" && <label className="ofx-campo"><span className="ofx-campo-rotulo">Quando entra</span><select className={input} value={node.config.event} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, event: e.target.value })}>{EVENT_CATALOG.map((event) => <option key={event.id} value={event.id}>{event.nome}</option>)}</select></label>}
    {node.type === "wait" && <WaitFields node={node} somenteLeitura={somenteLeitura} set={set} />}
    {node.type === "condition" && <ConditionFields node={node} somenteLeitura={somenteLeitura} set={set} opcoes={opcoes} />}
    {node.type === "ai_classify" && <ClassifyFields node={node} somenteLeitura={somenteLeitura} set={set} opcoes={opcoes} />}
    {node.type === "action" && <ActionFields node={node} somenteLeitura={somenteLeitura} set={set} opcoes={opcoes} />}
    {node.type === "end" && <label className="ofx-campo"><span className="ofx-campo-rotulo">Resultado</span><select className={input} value={node.config.outcome} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, outcome: e.target.value })}><option value="exhausted">Cadência concluída</option><option value="converted">Convertido</option><option value="custom">Outro</option></select></label>}
  </div></div>;
}

function WaitFields({ node, somenteLeitura, set }: { node: Extract<FollowupNode, { type: "wait" }>; somenteLeitura: boolean; set: (c: Record<string, unknown>) => void }) {
  const ms = node.config.mode === "fixed" ? node.config.duration_ms : node.config.max_ms;
  const unit = ms % 604800000 === 0 ? 604800000 : ms % 86400000 === 0 ? 86400000 : ms % 3600000 === 0 ? 3600000 : ms % 60000 === 0 ? 60000 : 1000;
  return <div className="ofc-espera-editor"><label className="ofx-campo"><span className="ofx-campo-rotulo">Esperar</span><input className={input} type="number" min={1} value={Math.max(1, Math.round(ms / unit))} disabled={somenteLeitura} onChange={(e) => set({ mode: "fixed", duration_ms: Math.max(1000, Number(e.target.value) * unit) })} /></label><label className="ofx-campo"><span className="ofx-campo-rotulo">Unidade</span><select className={input} value={unit} disabled={somenteLeitura} onChange={(e) => set({ mode: "fixed", duration_ms: Math.max(1000, Number(e.target.value) * Math.max(1, Math.round(ms / unit))) })}><option value={1000}>segundo(s)</option><option value={60000}>minuto(s)</option><option value={3600000}>hora(s)</option><option value={86400000}>dia(s)</option><option value={604800000}>semana(s)</option></select></label></div>;
}

function ConditionFields({ node, somenteLeitura, set, opcoes }: { node: Extract<FollowupNode, { type: "condition" }>; somenteLeitura: boolean; set: (c: Record<string, unknown>) => void; opcoes?: Props["opcoes"] }) {
  const checks = node.config.checks;
  // Campo e valor usam a MESMA peça e a MESMA lista da Lista detalhada: aqui
  // eram duas caixas vazias, e quem clicava num passo de Condição tinha de
  // adivinhar o nome do campo e digitar na mão.
  const campoDaRegra = (i: number, check: (typeof checks)[number]) => <label className="ofx-campo"><span className="ofx-campo-rotulo">Campo</span>
    <EntradaComLista id={`${node.id}-campo-${i}`} rotulo="Campo" valor={check.field} placeholder="escolha ou digite o campo"
      grupos={GRUPOS_VARIAVEIS_CADENCIA} sugestoes={SUGESTOES_CAMPO_CADENCIA} desabilitado={somenteLeitura}
      aoMudar={(field) => set({ ...node.config, checks: checks.map((x, j) => j === i ? { ...x, field } : x) })} />
  </label>;
  const valorDaRegra = (i: number, check: (typeof checks)[number]) => <label className="ofx-campo"><span className="ofx-campo-rotulo">Valor</span>
    <EntradaComLista id={`${node.id}-valor-${i}`} rotulo="Valor" valor={String(check.value ?? "")} placeholder="valor"
      sugestoes={sugestoesDeValor(check.field, opcoes)} desabilitado={somenteLeitura}
      aoMudar={(value) => set({ ...node.config, checks: checks.map((x, j) => j === i ? { ...x, value } : x) })} />
  </label>;
  return <><label className="ofx-campo"><span className="ofx-campo-rotulo">Combinar regras</span><select className={input} value={node.config.combinator} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, combinator: e.target.value })}><option value="and">Todas (E)</option><option value="or">Qualquer (OU)</option></select></label><label className="ofx-campo"><span className="ofx-campo-rotulo">Saídas</span><select className={input} value={node.config.branching} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, branching: e.target.value, checks: e.target.value === "per_check" ? checks.map((check, i) => ({ ...check, id: check.id ?? `regra-${i + 1}` })) : checks })}><option value="combined">Sim / Não</option><option value="per_check">Uma saída por regra</option></select></label>{checks.map((check, i) => <div className="ofc-regra" key={check.id ?? i}>{campoDaRegra(i, check)}<label className="ofx-campo"><span className="ofx-campo-rotulo">Operador</span><select className={input} value={check.op} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, checks: checks.map((x, j) => j === i ? { ...x, op: e.target.value } : x) })}><option value="eq">é igual a</option><option value="neq">é diferente de</option><option value="contains">contém</option><option value="gte">maior ou igual</option><option value="lte">menor ou igual</option></select></label>{valorDaRegra(i, check)}{!somenteLeitura && checks.length > 1 && <button type="button" className="oa-icone" onClick={() => set({ ...node.config, checks: checks.filter((_, j) => j !== i) })} aria-label="Remover regra"><Trash2 size={13} /></button>}</div>)}{!somenteLeitura && checks.length < 10 && <button type="button" className="oa-btn oa-btn-secundario" onClick={() => set({ ...node.config, checks: [...checks, { id: `regra-${checks.length + 1}`, field: "status", op: "eq", value: "" }] })}><Plus size={13} /> Adicionar regra</button>}</>;
}

function ClassifyFields({ node, somenteLeitura, set, opcoes }: { node: Extract<FollowupNode, { type: "ai_classify" }>; somenteLeitura: boolean; set: (c: Record<string, unknown>) => void; opcoes?: Props["opcoes"] }) {
  return <>{text("Instrução para a IA", node.config.hint ?? "", (v) => set({ ...node.config, hint: v }), true, somenteLeitura)}<label className="ofx-campo"><span className="ofx-campo-rotulo">Agente</span><select className={input} value={node.config.agent_id ?? ""} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, agent_id: e.target.value || undefined })}><option value="">Agente padrão</option>{opcoes?.agentesIa?.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>{node.config.classes.map((item, i) => <div className="ofc-regra" key={item.id}>{text("Classe", item.label, (v) => set({ ...node.config, classes: node.config.classes.map((x, j) => j === i ? { ...x, label: v } : x) }), false, somenteLeitura)}{!somenteLeitura && node.config.classes.length > 1 && <button type="button" className="oa-icone" onClick={() => set({ ...node.config, classes: node.config.classes.filter((_, j) => j !== i) })} aria-label="Remover classe"><Trash2 size={13} /></button>}</div>)}{!somenteLeitura && <button type="button" className="oa-btn oa-btn-secundario" onClick={() => set({ ...node.config, classes: [...node.config.classes, { id: `classe-${node.config.classes.length + 1}`, label: "Nova classe" }] })}><Plus size={13} /> Adicionar classe</button>}{text("Aguardar resposta (minutos)", String(Math.round(node.config.grace_timeout_ms / 60000)), (v) => set({ ...node.config, grace_timeout_ms: Math.max(900000, Number(v) * 60000) }), false, somenteLeitura)}</>;
}

function ActionFields({ node, somenteLeitura, set, opcoes }: { node: Extract<FollowupNode, { type: "action" }>; somenteLeitura: boolean; set: (c: Record<string, unknown>) => void; opcoes?: Props["opcoes"] }) {
  const mode = node.config.mode;
  return <><label className="ofx-campo"><span className="ofx-campo-rotulo">Tipo de ação</span><select className={input} value={mode} disabled={somenteLeitura} onChange={(e) => { const v = e.target.value; set(v === "whatsapp" ? { mode: v, message: "" } : v === "email" ? { mode: v, subject: "", message: "" } : v === "ai_message" ? { mode: v, prompt_hint: "" }
      : v === "create_task" ? { mode: v, title: "", priority: "media", due_minutes: 1440 }
      : v === "add_note" ? { mode: v, title: "" }
      : v === "assign_owner" ? { mode: v, owner_id: "" }
      : v === "add_tag" || v === "remove_tag" ? { mode: v, label_id: "" }
      : v === "template" ? { mode: v, template_id: "" }
      : { mode: v }); }}><option value="whatsapp">Mensagem WhatsApp</option><option value="template">Modelo aprovado</option><option value="ai_message">Mensagem com IA</option><option value="email">E-mail</option><option value="create_task">Criar tarefa</option><option value="add_note">Adicionar nota</option><option value="update_stage">Atualizar etapa</option><option value="assign_owner">Atribuir responsável</option><option value="add_tag">Adicionar etiqueta</option><option value="remove_tag">Remover etiqueta</option><option value="callface_call">Ligação Callface</option></select></label>{mode === "whatsapp" && <>{text("Mensagem", node.config.message, (v) => set({ ...node.config, message: v }), true, somenteLeitura)}<p className="oa-dica">Prévia: {previaTexto(node.config.message)}</p><label className="ofx-campo"><span className="ofx-campo-rotulo">Enviar por</span><select className={input} value={node.config.sessao_id ?? ""} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, sessao_id: e.target.value || undefined })}><option value="">Número do responsável</option>{opcoes?.sessoesWhatsapp?.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.conectada ? "" : " (desconectado)"}</option>)}</select></label></>}{mode === "email" && <>{text("Assunto", node.config.subject, (v) => set({ ...node.config, subject: v }), false, somenteLeitura)}{text("Mensagem", node.config.message, (v) => set({ ...node.config, message: v }), true, somenteLeitura)}</>}{mode === "ai_message" && <>{text("O que a IA deve escrever", node.config.prompt_hint, (v) => set({ ...node.config, prompt_hint: v }), true, somenteLeitura)}<label className="ofx-campo"><span className="ofx-campo-rotulo">Agente</span><select className={input} value={node.config.agent_id ?? ""} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, agent_id: e.target.value || undefined })}><option value="">Escolha o agente</option>{opcoes?.agentesIa?.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label></>}{mode === "template" && <label className="ofx-campo"><span className="ofx-campo-rotulo">Modelo aprovado</span><select className={input} value={node.config.template_id ?? ""} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, template_id: e.target.value })}><option value="">Escolha</option>{opcoes?.templatesWhatsapp?.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>}{mode === "create_task" && text("Título da tarefa", node.config.title, (v) => set({ ...node.config, title: v }), false, somenteLeitura)}{mode === "add_note" && text("Título da nota", node.config.title, (v) => set({ ...node.config, title: v }), false, somenteLeitura)}{mode === "update_stage" && text("Etapa", node.config.stage, (v) => set({ ...node.config, stage: v }), false, somenteLeitura)}{(mode === "add_tag" || mode === "remove_tag") && <label className="ofx-campo"><span className="ofx-campo-rotulo">Etiqueta</span><select className={input} value={node.config.label_id ?? ""} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, label_id: e.target.value })}><option value="">Escolha uma etiqueta</option>{opcoes?.tags?.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>}
    {mode === "callface_call" && <p className="oa-dica">A cadência inclui a ligação pela integração Callface e registra o resultado da ação.</p>}
    {mode === "create_task" && <>{text("Descrição da tarefa", node.config.description ?? "", (v) => set({ ...node.config, description: v }), true, somenteLeitura)}<label className="ofx-campo"><span className="ofx-campo-rotulo">Prioridade</span><select className={input} value={node.config.priority} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, priority: e.target.value })}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>{text("Prazo em minutos", String(node.config.due_minutes), (v) => set({ ...node.config, due_minutes: Math.max(0, Math.min(525600, Math.round(Number(v) || 0))) }), false, somenteLeitura)}</>}
    {mode === "add_note" && text("Descrição da nota", node.config.description ?? "", (v) => set({ ...node.config, description: v }), true, somenteLeitura)}
    {(mode === "whatsapp" || mode === "email") && <div className="ofc-vars">
       <div><strong>Personalização</strong><p>Insira uma variável na mensagem:</p><div className="ofc-inspector-vars">{VARIAVEIS_CADENCIA.map((item) =>
       <button key={item.chave} type="button" disabled={somenteLeitura} onClick={() => {
          const atual = "message" in node.config ? String(node.config.message) : "";
          set({ ...node.config, message: String(atual) + `{{${item.chave}}}` });
       }}>{item.rotulo}</button>)}</div></div>
    </div>}
    {mode === "assign_owner" && <label className="ofx-campo"><span className="ofx-campo-rotulo">Responsável</span><select className={input} value={node.config.owner_id ?? ""} disabled={somenteLeitura} onChange={(e) => set({ ...node.config, owner_id: e.target.value })}><option value="">Escolha</option>{opcoes?.usuarios?.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>}</>;
}

function text(label: string, value: string, change: (v: string) => void, multiline = false, disabled = false) { return <label className="ofx-campo"><span className="ofx-campo-rotulo">{label}</span>{multiline ? <textarea className={input} rows={4} value={value} disabled={disabled} onChange={(e) => change(e.target.value)} /> : <input className={input} value={value} disabled={disabled} onChange={(e) => change(e.target.value)} />}</label>; }
