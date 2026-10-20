"use client";

/* Inspetor (painel direito). Com um bloco selecionado: título e descrição do
 * catálogo, os campos na ordem respeitando `mostrarSe`, a política de falha
 * nos blocos com efeito externo e IA, desligar e nota. Sem seleção: as
 * configurações da automação (pasta, reentrada, o que fazer quando o lead
 * responde, fuso, expediente). */
import { useEffect } from "react";
import { Copy, Trash2 } from "lucide-react";
import {
  CATALOGO_NOS, FALHA_PADRAO, eventoPorId,
  type ConfigFluxo, type FalhaNo, type NoFluxo, type OpcoesInspetor, type Pendencia, type PoliticaFalha, type TipoEntidade,
} from "@/lib/automacoes/grafo";
import { Campo, type ContextoCampo } from "./Campos";
import { iconeDe } from "./icones";
import { trocarNo } from "./operacoes";
import { visivel } from "./resumo";
import { variaveisPara } from "./SeletorVariaveis";
import type { DocFluxo, OpcoesMudanca } from "./useEditorFluxo";

const POLITICAS: { valor: PoliticaFalha; rotulo: string; ajuda: string }[] = [
  { valor: "parar", rotulo: "Parar", ajuda: "A execução termina com erro." },
  { valor: "saida_erro", rotulo: "Seguir pela saída de erro", ajuda: "Ganha uma saída Erro para você tratar." },
  { valor: "ignorar", rotulo: "Ignorar e continuar", ajuda: "Segue pela saída normal como se tivesse dado certo." },
];

const FUSOS = [
  ["America/Sao_Paulo", "Brasília (São Paulo, Rio, Sul, Nordeste)"], ["America/Manaus", "Manaus (Amazonas)"],
  ["America/Cuiaba", "Cuiabá (Mato Grosso)"], ["America/Rio_Branco", "Rio Branco (Acre)"], ["America/Noronha", "Fernando de Noronha"],
] as const;

export function entidadeDoGatilho(gatilho: NoFluxo | undefined): TipoEntidade | null {
  if (!gatilho) return null;
  const c = gatilho.config;
  const v = c.modo === "evento" ? eventoPorId(String(c.evento ?? ""))?.entidade
    : c.modo === "manual" ? c.entidade : c.modo === "agendado" ? c.alvo : c.modo === "webhook" ? c.webhookEntidade : null;
  return v && v !== "nenhuma" ? (v as TipoEntidade) : null;
}

export function Inspetor({
  doc, no, pendencias, opcoes, ensaio, somenteLeitura, webhookUrl, pastas, foco,
  mudar, aoDuplicar, aoExcluir, aoRegenerarWebhook,
}: {
  doc: DocFluxo;
  no: NoFluxo | null;
  pendencias: Pendencia[];
  opcoes?: OpcoesInspetor;
  ensaio: Record<string, unknown> | null;
  somenteLeitura: boolean;
  webhookUrl: string | null;
  pastas: string[];
  /** Pendência clicada: rola e foca o campo. `n` muda a cada clique. */
  foco: { noId: string; campo?: string; n: number } | null;
  mudar: (fn: (d: DocFluxo) => DocFluxo, opcoes?: OpcoesMudanca) => void;
  aoDuplicar: (id: string) => void;
  aoExcluir: (id: string) => void;
  aoRegenerarWebhook: () => void;
}) {
  useEffect(() => {
    if (!foco || foco.noId !== no?.id) return;
    const alvo = document.getElementById(foco.campo ? `insp-${foco.noId}-${foco.campo}` : `insp-${foco.noId}--rotulo`);
    alvo?.scrollIntoView({ block: "center", behavior: "smooth" });
    (alvo as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, [foco, no?.id]);

  const gatilho = doc.grafo.nos.find((n) => n.tipo === "gatilho");
  const ctx: ContextoCampo = {
    opcoes, ensaio, somenteLeitura, webhookUrl, aoRegenerarWebhook,
    grupos: variaveisPara(doc.grafo, no?.id ?? null),
    entidade: entidadeDoGatilho(gatilho),
  };

  if (!no) return <ConfigAutomacao doc={doc} mudar={mudar} somenteLeitura={somenteLeitura} pastas={pastas} pendencias={pendencias} />;

  const meta = CATALOGO_NOS[no.tipo];
  const Icone = iconeDe(meta.icone);
  const minhas = pendencias.filter((p) => p.noId === no.id);
  const trocar = (fn: (n: NoFluxo) => NoFluxo, opcoesMudanca?: OpcoesMudanca) =>
    mudar((d) => ({ ...d, grafo: trocarNo(d.grafo, no.id, fn) }), opcoesMudanca);
  const falha: FalhaNo = no.falha ?? FALHA_PADRAO;
  const temFalha = meta.efeitoExterno || meta.categoria === "ia";
  const semCampo = minhas.filter((p) => !p.campo);

  return (
    <div className="ofx-insp" data-categoria={meta.categoria}>
      <header className="ofx-insp-cab">
        <span className="ofx-no-icone"><Icone size={15} strokeWidth={2.2} aria-hidden /></span>
        <div className="ofx-insp-cab-texto">
          <strong>{meta.rotulo}</strong>
          <span>{meta.descricao}</span>
        </div>
        {no.tipo !== "gatilho" && !somenteLeitura && (
          <div className="ofx-insp-cab-acoes">
            <button type="button" className="oa-icone" onClick={() => aoDuplicar(no.id)} aria-label="Duplicar bloco" title="Duplicar (Ctrl+D)"><Copy size={14} /></button>
            <button type="button" className="oa-icone" onClick={() => aoExcluir(no.id)} aria-label="Excluir bloco" title="Excluir (Delete)"><Trash2 size={14} /></button>
          </div>
        )}
      </header>

      {semCampo.length > 0 && (
        <ul className="ofx-insp-pend">
          {semCampo.map((p, i) => <li key={i}>{p.mensagem}</li>)}
        </ul>
      )}

      <div className="ofx-campo">
        <label className="ofx-campo-rotulo" htmlFor={`insp-${no.id}--rotulo`}>Título no desenho</label>
        <input id={`insp-${no.id}--rotulo`} className="oa-input" value={no.rotulo ?? ""} maxLength={80} disabled={somenteLeitura}
          placeholder={meta.rotulo} onChange={(e) => trocar((n) => ({ ...n, rotulo: e.target.value || undefined }), { agrupar: `${no.id}:rotulo` })} />
      </div>

      {meta.campos.filter((c) => visivel(c, no.config, meta.campos)).map((c) => (
        <Campo
          key={c.chave}
          campo={c}
          valor={no.config[c.chave] ?? (c.tipo === "booleano" ? c.padrao : undefined)}
          ctx={ctx}
          idBase={`insp-${no.id}`}
          pendencia={minhas.find((p) => p.campo === c.chave)?.mensagem}
          aoMudar={(v, agrupar) => trocar((n) => ({ ...n, config: { ...n.config, [c.chave]: v } }), agrupar ? { agrupar: `${no.id}:${c.chave}` } : undefined)}
        />
      ))}
      {meta.campos.length === 0 && no.tipo !== "gatilho" && <p className="oa-dica">Este bloco não tem o que configurar: usa o registro do gatilho.</p>}

      {temFalha && (
        <fieldset className="ofx-insp-secao">
          <legend>Se este bloco falhar</legend>
          <div className="ofx-radios">
            {POLITICAS.map((p) => (
              <label key={p.valor} className="ofx-radio">
                <input type="radio" name={`falha-${no.id}`} checked={falha.politica === p.valor} disabled={somenteLeitura}
                  onChange={() => trocar((n) => ({ ...n, falha: { ...falha, politica: p.valor } }))} />
                <span><strong>{p.rotulo}</strong><em>{p.ajuda}</em></span>
              </label>
            ))}
          </div>
          <div className="ofx-dupla">
            <div className="ofx-campo">
              <label className="ofx-campo-rotulo" htmlFor={`insp-${no.id}-timeout`}>Tempo limite (segundos)</label>
              <input id={`insp-${no.id}-timeout`} type="number" min={1} max={300} className="oa-input ofx-numero" value={falha.timeoutSeg} disabled={somenteLeitura}
                onChange={(e) => trocar((n) => ({ ...n, falha: { ...falha, timeoutSeg: Math.min(300, Math.max(1, Number(e.target.value) || 1)) } }), { agrupar: `${no.id}:timeout` })} />
            </div>
            <div className="ofx-campo">
              <label className="ofx-campo-rotulo" htmlFor={`insp-${no.id}-tent`}>Tentar de novo</label>
              <select id={`insp-${no.id}-tent`} className="oa-input" value={falha.tentativas} disabled={somenteLeitura}
                onChange={(e) => trocar((n) => ({ ...n, falha: { ...falha, tentativas: Number(e.target.value) } }))}>
                <option value={0}>Não</option><option value={1}>1 vez (1 min)</option><option value={2}>2 vezes (1 e 5 min)</option><option value={3}>3 vezes (1, 5 e 15 min)</option>
              </select>
            </div>
          </div>
        </fieldset>
      )}

      {no.tipo !== "gatilho" && (
        <fieldset className="ofx-insp-secao">
          <legend>Mais</legend>
          <label className="ofx-interruptor">
            <input type="checkbox" checked={Boolean(no.desativado)} disabled={somenteLeitura} onChange={(e) => trocar((n) => ({ ...n, desativado: e.target.checked || undefined }))} />
            <span aria-hidden />
            <em>Desligar este bloco <small>A execução passa direto por ele.</small></em>
          </label>
          <div className="ofx-campo">
            <label className="ofx-campo-rotulo" htmlFor={`insp-${no.id}-nota`}>Nota</label>
            <textarea id={`insp-${no.id}-nota`} className="oa-input" rows={2} maxLength={500} value={no.nota ?? ""} disabled={somenteLeitura} placeholder="Por que este bloco existe (só para quem edita)"
              onChange={(e) => trocar((n) => ({ ...n, nota: e.target.value || undefined }), { agrupar: `${no.id}:nota` })} />
          </div>
        </fieldset>
      )}
    </div>
  );
}

function ConfigAutomacao({ doc, mudar, somenteLeitura, pastas, pendencias }: {
  doc: DocFluxo; mudar: (fn: (d: DocFluxo) => DocFluxo, o?: OpcoesMudanca) => void; somenteLeitura: boolean; pastas: string[]; pendencias: Pendencia[];
}) {
  const c = doc.config;
  const setConfig = (p: Partial<ConfigFluxo>, agrupar?: string) => mudar((d) => ({ ...d, config: { ...d.config, ...p } }), agrupar ? { agrupar } : undefined);
  const gerais = pendencias.filter((p) => !p.noId);
  return (
    <div className="ofx-insp">
      <header className="ofx-insp-cab">
        <div className="ofx-insp-cab-texto">
          <strong>Configurações da automação</strong>
          <span>Clique num bloco do desenho para editar o que ele faz.</span>
        </div>
      </header>

      {gerais.length > 0 && <ul className="ofx-insp-pend">{gerais.map((p, i) => <li key={i}>{p.mensagem}</li>)}</ul>}

      <div className="ofx-campo">
        <label className="ofx-campo-rotulo" htmlFor="cfg-pasta">Pasta</label>
        <input id="cfg-pasta" className="oa-input" list="cfg-pastas" value={doc.pasta ?? ""} maxLength={60} disabled={somenteLeitura} placeholder="Sem pasta"
          onChange={(e) => mudar((d) => ({ ...d, pasta: e.target.value.trim() ? e.target.value : null }), { agrupar: "pasta" })} />
        <datalist id="cfg-pastas">{pastas.map((p) => <option key={p} value={p} />)}</datalist>
      </div>

      <div className="ofx-campo">
        <span className="ofx-campo-rotulo">O mesmo registro pode entrar de novo?</span>
        <div className="ofx-radios">
          {([
            ["uma_viva", "Só depois de terminar", "Enquanto houver uma execução em andamento para o registro, ele não entra de novo."],
            ["sempre", "Sempre", "Cada disparo vira uma execução nova, mesmo com outra em andamento."],
            ["uma_vez", "Uma vez na vida", "O registro passa por esta automação uma única vez."],
          ] as const).map(([v, r, a]) => (
            <label key={v} className="ofx-radio">
              <input type="radio" name="reentrada" checked={c.reentrada === v} disabled={somenteLeitura} onChange={() => setConfig({ reentrada: v })} />
              <span><strong>{r}</strong><em>{a}</em></span>
            </label>
          ))}
        </div>
      </div>

      <div className="ofx-campo">
        <span className="ofx-campo-rotulo">Quando o lead responder</span>
        <div className="ofx-radios">
          {([
            ["continuar", "Continuar o fluxo", "A resposta não muda nada: as esperas vencem no horário e a automação segue."],
            ["parar", "Parar o fluxo", "Se o lead responder enquanto a automação espera, ela é encerrada ali."],
          ] as const).map(([v, r, a]) => (
            <label key={v} className="ofx-radio">
              <input type="radio" name="ao-responder" checked={(c.aoResponder ?? "continuar") === v} disabled={somenteLeitura} onChange={() => setConfig({ aoResponder: v })} />
              <span><strong>{r}</strong><em>{a}</em></span>
            </label>
          ))}
        </div>
      </div>

      <div className="ofx-campo">
        <label className="ofx-campo-rotulo" htmlFor="cfg-fuso">Fuso horário</label>
        <select id="cfg-fuso" className="oa-input" value={c.fuso} disabled={somenteLeitura} onChange={(e) => setConfig({ fuso: e.target.value })}>
          {FUSOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          {!FUSOS.some(([v]) => v === c.fuso) && <option value={c.fuso}>{c.fuso}</option>}
        </select>
        <span className="oa-dica">Vale para agendamentos, “Aguardar até horário” e “Horário comercial”.</span>
      </div>

      <fieldset className="ofx-insp-secao">
        <legend>Expediente</legend>
        <span className="oa-dica">Usado pelo bloco Horário comercial quando ele segue o padrão da automação.</span>
        <Campo campo={{ chave: "dias", rotulo: "Dias", tipo: "dias_semana" }} valor={c.horarioComercial.dias} idBase="cfg" ctx={{ grupos: [], ensaio: null, entidade: null, somenteLeitura, webhookUrl: null }}
          aoMudar={(v) => setConfig({ horarioComercial: { ...c.horarioComercial, dias: v as number[] } })} />
        <div className="ofx-dupla">
          <div className="ofx-campo">
            <label className="ofx-campo-rotulo" htmlFor="cfg-inicio">Das</label>
            <input id="cfg-inicio" type="time" className="oa-input ofx-numero" value={c.horarioComercial.inicio} disabled={somenteLeitura}
              onChange={(e) => setConfig({ horarioComercial: { ...c.horarioComercial, inicio: e.target.value } }, "inicio")} />
          </div>
          <div className="ofx-campo">
            <label className="ofx-campo-rotulo" htmlFor="cfg-fim">Até</label>
            <input id="cfg-fim" type="time" className="oa-input ofx-numero" value={c.horarioComercial.fim} disabled={somenteLeitura}
              onChange={(e) => setConfig({ horarioComercial: { ...c.horarioComercial, fim: e.target.value } }, "fim")} />
          </div>
        </div>
      </fieldset>

      <div className="ofx-atalhos">
        <span className="ofx-campo-rotulo">Atalhos</span>
        <dl>
          <div><dt><kbd>Ctrl</kbd> <kbd>Z</kbd></dt><dd>Desfazer</dd></div>
          <div><dt><kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>Z</kbd></dt><dd>Refazer</dd></div>
          <div><dt><kbd>Delete</kbd></dt><dd>Apagar o selecionado</dd></div>
          <div><dt><kbd>Ctrl</kbd> <kbd>D</kbd></dt><dd>Duplicar bloco</dd></div>
          <div><dt><kbd>Shift</kbd> + arrastar</dt><dd>Selecionar vários</dd></div>
        </dl>
      </div>
    </div>
  );
}
