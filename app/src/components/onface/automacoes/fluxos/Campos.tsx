"use client";

/* Um componente por `TipoCampo` do catálogo (grafo.ts). O inspetor percorre
 * os campos do bloco na ordem e chama <Campo> para cada um visível. Selects
 * de conta (usuário, tag, etapa, cadência, modelo, agente) vêm de
 * GET /automacoes/fluxos/opcoes; lista vazia vira dica, nunca opção inventada. */
import { useRef, type ReactNode } from "react";
import { Copy, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  CAMPOS_ATUALIZAVEIS, EVENTOS_PLATAFORMA, OPERADORES_REGRA,
  type CampoConfig, type OpcoesInspetor, type OperadorRegra, type TipoEntidade,
} from "@/lib/automacoes/grafo";
import { Radiogroup } from "@/components/onface/ds/escolha";
import { SeletorVariaveis, type GrupoVariaveis } from "./SeletorVariaveis";

export interface ContextoCampo {
  opcoes?: OpcoesInspetor;
  grupos: GrupoVariaveis[];
  ensaio: Record<string, unknown> | null;
  /** Tipo de registro que o gatilho fornece (decide etapas e campos). */
  entidade: TipoEntidade | null;
  somenteLeitura: boolean;
  webhookUrl: string | null;
  aoRegenerarWebhook?: () => void;
}

type Mudar = (valor: unknown, agrupar?: boolean) => void;

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_NOME = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Insere `{{ caminho }}` onde está o cursor (ou no fim). */
function inserirEm(el: HTMLInputElement | HTMLTextAreaElement | null, atual: string, caminho: string): string {
  const trecho = `{{ ${caminho} }}`;
  if (!el) return atual + trecho;
  const ini = el.selectionStart ?? atual.length;
  const fim = el.selectionEnd ?? atual.length;
  const novo = atual.slice(0, ini) + trecho + atual.slice(fim);
  requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ini + trecho.length, ini + trecho.length); });
  return novo;
}

function Texto({ id, valor, aoMudar, ctx, longo, placeholder, expressao, tipo = "text" }: {
  id: string; valor: unknown; aoMudar: Mudar; ctx: ContextoCampo; longo?: boolean; placeholder?: string; expressao?: boolean; tipo?: string;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const texto = typeof valor === "string" ? valor : valor === undefined || valor === null ? "" : String(valor);
  const comum = {
    id, ref, value: texto, placeholder, disabled: ctx.somenteLeitura, className: "oa-input",
    onChange: (e: { target: { value: string } }) => aoMudar(e.target.value, true),
  };
  return (
    <div className="ofx-campo-linha">
      {longo ? <textarea {...comum} rows={texto.length > 120 ? 5 : 3} /> : <input {...comum} type={tipo} />}
      {expressao && (
        <SeletorVariaveis grupos={ctx.grupos} contexto={ctx.ensaio} desabilitado={ctx.somenteLeitura}
          aoInserir={(c) => aoMudar(inserirEm(ref.current, texto, c))} />
      )}
    </div>
  );
}

function Selecao({ id, valor, aoMudar, ctx, opcoes, vazio, grupos }: {
  id: string; valor: unknown; aoMudar: Mudar; ctx: ContextoCampo;
  opcoes?: { valor: string; rotulo: string; desabilitada?: boolean }[];
  grupos?: { rotulo: string; opcoes: { valor: string; rotulo: string }[] }[];
  vazio?: string;
}) {
  return (
    <select id={id} className="oa-input" value={valor === undefined || valor === null ? "" : String(valor)} disabled={ctx.somenteLeitura}
      onChange={(e) => aoMudar(e.target.value)}>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {opcoes?.map((o) => <option key={o.valor} value={o.valor} disabled={o.desabilitada}>{o.rotulo}</option>)}
      {grupos?.map((g) => (
        <optgroup key={g.rotulo} label={g.rotulo}>
          {g.opcoes.map((o) => <option key={`${g.rotulo}-${o.valor}`} value={o.valor}>{o.rotulo}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/** Pílulas quando são poucas opções curtas: uma olhada mostra a escolha. */
function Segmentos({ valor, aoMudar, ctx, opcoes, rotulo }: { valor: unknown; aoMudar: Mudar; ctx: ContextoCampo; opcoes: { valor: string; rotulo: string }[]; rotulo: string }) {
  return (
    <Radiogroup className="ofx-segmentos" rotulo={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={valor === o.valor} disabled={ctx.somenteLeitura} onClick={() => aoMudar(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </Radiogroup>
  );
}

function DiasSemana({ valor, aoMudar, ctx }: { valor: unknown; aoMudar: Mudar; ctx: ContextoCampo }) {
  const dias = new Set(Array.isArray(valor) ? (valor as number[]) : []);
  return (
    <div className="ofx-dias" role="group" aria-label="Dias da semana">
      {DIAS.map((d, i) => (
        <button key={i} type="button" aria-pressed={dias.has(i)} aria-label={DIAS_NOME[i]} title={DIAS_NOME[i]} disabled={ctx.somenteLeitura}
          onClick={() => { const n = new Set(dias); if (n.has(i)) n.delete(i); else n.add(i); aoMudar([...n].sort()); }}>
          {d}
        </button>
      ))}
    </div>
  );
}

function Lista<T>({ itens, render, novo, aoMudar, ctx, rotuloNovo, minimo = 0 }: {
  itens: T[]; render: (item: T, trocar: (t: T, agrupar?: boolean) => void, i: number) => ReactNode; novo: () => T;
  aoMudar: Mudar; ctx: ContextoCampo; rotuloNovo: string; minimo?: number;
}) {
  return (
    <div className="ofx-lista">
      {itens.map((item, i) => (
        <div key={i} className="ofx-lista-item">
          <div className="ofx-lista-corpo">{render(item, (t, agrupar) => aoMudar(itens.map((x, j) => (j === i ? t : x)), agrupar), i)}</div>
          {!ctx.somenteLeitura && itens.length > minimo && (
            <button type="button" className="oa-icone" aria-label="Remover" title="Remover" onClick={() => aoMudar(itens.filter((_, j) => j !== i))}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      {!ctx.somenteLeitura && (
        <button type="button" className="ofx-adicionar" onClick={() => aoMudar([...itens, novo()])}>
          <Plus size={13} strokeWidth={2.4} /> {rotuloNovo}
        </button>
      )}
    </div>
  );
}

type Regra = { campo: string; operador: OperadorRegra; valor?: unknown };

function EditorRegras({ id, valor, aoMudar, ctx }: { id: string; valor: unknown; aoMudar: Mudar; ctx: ContextoCampo }) {
  const regras = (Array.isArray(valor) ? valor : []) as Regra[];
  return (
    <Lista<Regra>
      itens={regras} aoMudar={aoMudar} ctx={ctx} rotuloNovo="Adicionar regra"
      novo={() => ({ campo: "", operador: "igual", valor: "" })}
      render={(r, trocar, i) => (
        <div className="ofx-regra">
          <div className="ofx-campo-linha">
            <input id={i === 0 ? id : undefined} className="oa-input ofx-mono" value={r.campo} placeholder="campo, ex.: lead.origem" disabled={ctx.somenteLeitura}
              onChange={(e) => trocar({ ...r, campo: e.target.value }, true)} aria-label="Campo" />
            <SeletorVariaveis grupos={ctx.grupos} contexto={ctx.ensaio} desabilitado={ctx.somenteLeitura} aoInserir={(c) => trocar({ ...r, campo: c })} />
          </div>
          <select className="oa-input" value={r.operador} disabled={ctx.somenteLeitura} onChange={(e) => trocar({ ...r, operador: e.target.value as OperadorRegra })} aria-label="Operador">
            {OPERADORES_REGRA.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
          {r.operador !== "vazio" && r.operador !== "preenchido" && (
            <input className="oa-input" value={r.valor === undefined || r.valor === null ? "" : String(r.valor)} placeholder="valor" disabled={ctx.somenteLeitura}
              onChange={(e) => trocar({ ...r, valor: e.target.value }, true)} aria-label="Valor" />
          )}
        </div>
      )}
    />
  );
}

function novoId(prefixo: string, existentes: { id: string }[]): string {
  let n = existentes.length + 1;
  while (existentes.some((e) => e.id === `${prefixo}${n}`)) n++;
  return `${prefixo}${n}`;
}

export function Campo({ campo, valor, aoMudar, ctx, idBase, pendencia }: {
  campo: CampoConfig; valor: unknown; aoMudar: Mudar; ctx: ContextoCampo; idBase: string; pendencia?: string;
}) {
  const id = `${idBase}-${campo.chave}`;
  const corpo = (() => {
    switch (campo.tipo) {
      case "texto":
      case "url":
        return <Texto id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} placeholder={campo.placeholder} expressao={campo.aceitaExpressao} />;
      case "texto_longo":
        return <Texto id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} placeholder={campo.placeholder} expressao={campo.aceitaExpressao} longo />;
      case "numero":
        return (
          <input id={id} type="number" className="oa-input ofx-numero" min={campo.min} max={campo.max} value={valor === undefined || valor === null ? "" : String(valor)}
            disabled={ctx.somenteLeitura} onChange={(e) => aoMudar(e.target.value === "" ? undefined : Number(e.target.value), true)} />
        );
      case "booleano":
        return (
          <label className="ofx-interruptor">
            <input id={id} type="checkbox" checked={Boolean(valor)} disabled={ctx.somenteLeitura} onChange={(e) => aoMudar(e.target.checked)} />
            <span aria-hidden />
            <em>{campo.rotulo}</em>
          </label>
        );
      case "selecao":
      case "tipo_entidade": {
        const opcoes = campo.opcoes ?? [];
        return opcoes.length <= 3 && opcoes.every((o) => o.rotulo.length <= 16)
          ? <Segmentos valor={valor} aoMudar={aoMudar} ctx={ctx} opcoes={opcoes} rotulo={campo.rotulo} />
          : <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} opcoes={opcoes} />;
      }
      case "duracao": {
        const min = Number(valor ?? 0);
        const unidade = min && min % 1440 === 0 ? 1440 : min && min % 60 === 0 ? 60 : 1;
        return (
          <div className="ofx-duracao">
            <input id={id} type="number" min={1} className="oa-input ofx-numero" value={min ? min / unidade : ""} disabled={ctx.somenteLeitura}
              onChange={(e) => aoMudar(Math.max(0, Number(e.target.value)) * unidade, true)} aria-label="Quantidade" />
            <select className="oa-input" value={unidade} disabled={ctx.somenteLeitura} onChange={(e) => aoMudar((min ? min / unidade : 1) * Number(e.target.value))} aria-label="Unidade">
              <option value={1}>minutos</option><option value={60}>horas</option><option value={1440}>dias</option>
            </select>
          </div>
        );
      }
      case "horario":
        return <input id={id} type="time" className="oa-input ofx-numero" value={String(valor ?? "")} disabled={ctx.somenteLeitura} onChange={(e) => aoMudar(e.target.value)} />;
      case "horarios": {
        const lista = (Array.isArray(valor) ? valor : []) as string[];
        return (
          <Lista<string> itens={lista} aoMudar={aoMudar} ctx={ctx} rotuloNovo="Adicionar horário" minimo={1} novo={() => "14:00"}
            render={(h, trocar, i) => <input id={i === 0 ? id : undefined} type="time" className="oa-input ofx-numero" value={h} disabled={ctx.somenteLeitura} onChange={(e) => trocar(e.target.value)} aria-label="Horário" />} />
        );
      }
      case "dias_semana":
        return <DiasSemana valor={valor} aoMudar={aoMudar} ctx={ctx} />;
      case "usuario": {
        const expr = typeof valor === "string" && valor.includes("{{");
        if (expr) {
          return (
            <div className="ofx-campo-linha">
              <Texto id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} expressao />
              {!ctx.somenteLeitura && <button type="button" className="oa-icone" title="Escolher da lista" aria-label="Escolher da lista" onClick={() => aoMudar("")}><X size={13} /></button>}
            </div>
          );
        }
        return (
          <div className="ofx-campo-linha">
            <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio={campo.obrigatorio ? "Escolha a pessoa" : "Responsável do registro"}
              opcoes={(ctx.opcoes?.usuarios ?? []).map((u) => ({ valor: u.id, rotulo: u.nome }))} />
            {campo.aceitaExpressao && <SeletorVariaveis grupos={ctx.grupos} contexto={ctx.ensaio} desabilitado={ctx.somenteLeitura} aoInserir={(c) => aoMudar(`{{ ${c} }}`)} />}
          </div>
        );
      }
      case "tag": {
        const tags = ctx.opcoes?.tags ?? [];
        return (
          <>
            <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio={tags.length ? "Escolha a tag" : "Nenhuma tag na conta"} opcoes={tags.map((t) => ({ valor: t.id, rotulo: t.nome }))} />
            {ctx.opcoes && !tags.length && <span className="oa-dica">As tags nascem no Atendimento e na Pré-vendas. Crie uma lá e ela aparece aqui.</span>}
          </>
        );
      }
      case "etapa": {
        const e = ctx.opcoes?.etapas;
        const deLead = ctx.entidade === "lead";
        const deNegocio = ctx.entidade === "negocio" || ctx.entidade === "oportunidade";
        return deLead || deNegocio
          ? <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio="Escolha a etapa" opcoes={(deLead ? e?.lead : e?.negocio) ?? []} />
          : <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio="Escolha a etapa" grupos={[{ rotulo: "Negócio", opcoes: e?.negocio ?? [] }, { rotulo: "Lead (pré-vendas)", opcoes: e?.lead ?? [] }]} />;
      }
      case "cadencia": {
        const lista = ctx.opcoes?.cadencias ?? [];
        return (
          <>
            <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio={lista.length ? "Escolha a cadência" : "Nenhuma cadência"}
              opcoes={lista.map((c) => ({ valor: c.id, rotulo: c.publicada ? c.nome : `${c.nome} (rascunho, não publicada)`, desabilitada: !c.publicada }))} />
            {ctx.opcoes && !lista.some((c) => c.publicada) && <span className="oa-dica">Só cadência publicada recebe inscrição. Publique uma em <a className="oa-link" href="/automacoes/cadencias">Cadências</a>.</span>}
          </>
        );
      }
      case "template_whatsapp": {
        const lista = ctx.opcoes?.templatesWhatsapp ?? [];
        return <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio={lista.length ? "Escolha o modelo" : "Nenhum modelo aprovado"} opcoes={lista.map((t) => ({ valor: t.id, rotulo: t.nome }))} />;
      }
      case "sessao_whatsapp": {
        const lista = ctx.opcoes?.sessoesWhatsapp ?? [];
        return <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio="Automático" opcoes={lista.map((x) => ({ valor: x.id, rotulo: `${x.nome}${x.operacional ? " (operacional)" : ""}${x.conectada ? "" : " (desconectado)"}` }))} />;
      }
      case "agente_ia": {
        const lista = ctx.opcoes?.agentesIa ?? [];
        return <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio={campo.obrigatorio ? "Escolha o agente" : "Agente padrão da organização"} opcoes={lista.map((t) => ({ valor: t.id, rotulo: t.nome }))} />;
      }
      case "evento": {
        const grupos = [...new Set(EVENTOS_PLATAFORMA.map((e) => e.grupo))].map((g) => ({
          rotulo: g, opcoes: EVENTOS_PLATAFORMA.filter((e) => e.grupo === g).map((e) => ({ valor: e.id, rotulo: e.rotulo })),
        }));
        return <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio="Escolha o evento" grupos={grupos} />;
      }
      case "regras":
        return <EditorRegras id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} />;
      case "rotas": {
        type Rota = { id: string; rotulo: string; combinador?: "e" | "ou"; regras: Regra[] };
        const rotas = (Array.isArray(valor) ? valor : []) as Rota[];
        return (
          <Lista<Rota> itens={rotas} aoMudar={aoMudar} ctx={ctx} rotuloNovo="Adicionar rota"
            novo={() => { const nid = novoId("r", rotas); return { id: nid, rotulo: `Rota ${rotas.length + 1}`, combinador: "e", regras: [] }; }}
            render={(r, trocar, i) => (
              <div className="ofx-rota">
                <div className="ofx-rota-topo">
                  <span className="ofx-rota-num">{i + 1}</span>
                  <input id={i === 0 ? id : undefined} className="oa-input" value={r.rotulo} placeholder="Nome da rota" disabled={ctx.somenteLeitura} onChange={(e) => trocar({ ...r, rotulo: e.target.value }, true)} aria-label="Nome da rota" />
                </div>
                <Segmentos valor={r.combinador ?? "e"} aoMudar={(v) => trocar({ ...r, combinador: v as "e" | "ou" })} ctx={ctx} rotulo="Casar"
                  opcoes={[{ valor: "e", rotulo: "Todas as regras" }, { valor: "ou", rotulo: "Qualquer regra" }]} />
                <EditorRegras id={`${id}-${r.id}`} valor={r.regras} aoMudar={(v) => trocar({ ...r, regras: v as Regra[] }, true)} ctx={ctx} />
              </div>
            )} />
        );
      }
      case "classes": {
        type Classe = { id: string; rotulo: string };
        const classes = (Array.isArray(valor) ? valor : []) as Classe[];
        return (
          <Lista<Classe> itens={classes} aoMudar={aoMudar} ctx={ctx} rotuloNovo="Adicionar classe"
            novo={() => ({ id: novoId("c", classes), rotulo: "" })}
            render={(c, trocar, i) => <input id={i === 0 ? id : undefined} className="oa-input" value={c.rotulo} placeholder="ex.: Quer reunião" disabled={ctx.somenteLeitura} onChange={(e) => trocar({ ...c, rotulo: e.target.value }, true)} aria-label="Classe" />} />
        );
      }
      case "pares": {
        type Par = { chave: string; valor: string };
        const pares = (Array.isArray(valor) ? valor : []) as Par[];
        return (
          <Lista<Par> itens={pares} aoMudar={aoMudar} ctx={ctx} rotuloNovo="Adicionar"
            novo={() => ({ chave: "", valor: "" })}
            render={(p, trocar, i) => (
              <div className="ofx-par">
                <input id={i === 0 ? id : undefined} className="oa-input ofx-mono" value={p.chave} placeholder="nome" disabled={ctx.somenteLeitura} onChange={(e) => trocar({ ...p, chave: e.target.value }, true)} aria-label="Nome" />
                <Texto id={`${id}-v${i}`} valor={p.valor} aoMudar={(v, ag) => trocar({ ...p, valor: String(v ?? "") }, ag)} ctx={ctx} placeholder="valor" expressao={campo.aceitaExpressao} />
              </div>
            )} />
        );
      }
      case "campo_entidade": {
        const e = ctx.entidade;
        const proprio = e === "lead" || e === "negocio" || e === "contato" ? CAMPOS_ATUALIZAVEIS[e] : null;
        return proprio
          ? <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio="Escolha o campo" opcoes={proprio.map((c) => ({ valor: c.chave, rotulo: c.rotulo }))} />
          : <Selecao id={id} valor={valor} aoMudar={aoMudar} ctx={ctx} vazio="Escolha o campo" grupos={(["lead", "negocio", "contato"] as const).map((k) => ({
            rotulo: { lead: "Lead", negocio: "Negócio", contato: "Contato" }[k], opcoes: CAMPOS_ATUALIZAVEIS[k].map((c) => ({ valor: c.chave, rotulo: c.rotulo })),
          }))} />;
      }
      case "somente_leitura": {
        const url = ctx.webhookUrl;
        return url ? (
          <div className="ofx-webhook">
            <code className="ofx-mono">{url}</code>
            <div className="ofx-webhook-acoes">
              <button type="button" className="oa-btn oa-btn-secundario" onClick={() => { void navigator.clipboard.writeText(url).then(() => toast.success("Endereço copiado")); }}>
                <Copy size={13} /> Copiar
              </button>
              {ctx.aoRegenerarWebhook && !ctx.somenteLeitura && (
                <button type="button" className="oa-btn oa-btn-secundario" onClick={ctx.aoRegenerarWebhook}><RefreshCw size={13} /> Gerar outro endereço</button>
              )}
            </div>
          </div>
        ) : <span className="oa-dica">O endereço aparece aqui depois que o rascunho for salvo.</span>;
      }
      default:
        return null;
    }
  })();

  return (
    <div className="ofx-campo" data-pendente={pendencia ? "true" : undefined}>
      {campo.tipo !== "booleano" && (
        <label className="ofx-campo-rotulo" htmlFor={id}>
          {campo.rotulo}{campo.obrigatorio && <span className="ofx-obrigatorio" aria-label="obrigatório">*</span>}
        </label>
      )}
      {corpo}
      {pendencia && <span className="ofx-campo-erro">{pendencia}</span>}
      {campo.ajuda && !pendencia && <span className="oa-dica">{campo.ajuda}</span>}
    </div>
  );
}
