"use client";

/* Peças compartilhadas pelo editor do agente (AgenteEditor) e pelas abas de
 * operação (AgenteOperacao): chamada à API, formatação e os três componentes
 * de formulário que o editor já usava (Interruptor, ListaEditavel, Secao). */

import * as React from "react";
import { Plus, X } from "lucide-react";

export const TZ = "America/Sao_Paulo";
export const num = (n: number) => n.toLocaleString("pt-BR");

export async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = await r.json().catch(() => null);
  if (!r.ok) {
    // Corpo que não é JSON: o servidor caiu ou demorou demais (proxy), não é recusa de regra.
    if (!json) throw new Error(`O servidor não respondeu (${r.status}). Tente de novo; se persistir, a execução pode ter passado do tempo limite.`);
    const campos = json?.details?.fieldErrors ? Object.entries(json.details.fieldErrors as Record<string, string[]>).map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ") : "";
    throw new Error([json?.error || json?.message || `Falha (${r.status})`, campos].filter(Boolean).join(" · "));
  }
  return json ?? {};
}

export function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export function Interruptor({ ligado, onChange, rotulo, desligado }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string; desligado?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} className="age-switch" disabled={desligado} onClick={() => onChange(!ligado)}>
      <i />
    </button>
  );
}

export function ListaEditavel({ titulo, ajuda, itens, onChange, exemplo, tom, travado }: {
  titulo: string; ajuda: string; itens: string[]; onChange: (v: string[]) => void; exemplo: string; tom?: "ok" | "alerta" | "humano"; travado: boolean;
}) {
  const [novo, setNovo] = React.useState("");
  const add = () => {
    const v = novo.trim();
    if (!v) return;
    if (!itens.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...itens, v]);
    setNovo("");
  };
  return (
    <div className="age-lista" data-tom={tom}>
      <div className="age-lista-topo"><strong>{titulo}</strong><span>{ajuda}</span></div>
      <div className="age-chips">
        {itens.length === 0 ? <span className="age-chips-vazio">Nada aqui ainda.</span> : null}
        {itens.map((i) => (
          <span key={i} className="age-chip">
            {i}
            {!travado ? <button type="button" aria-label={`Remover ${i}`} onClick={() => onChange(itens.filter((x) => x !== i))}><X size={11} /></button> : null}
          </span>
        ))}
      </div>
      {!travado ? (
        <div className="age-lista-add">
          <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={exemplo} aria-label={`Adicionar em ${titulo}`} maxLength={160}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="agn-secundario" onClick={add} disabled={!novo.trim()} aria-label={`Adicionar em ${titulo}`} title="Adicionar"><Plus size={14} /></button>
        </div>
      ) : null}
    </div>
  );
}

export function Secao({ titulo, ajuda, children, direita }: { titulo: string; ajuda?: React.ReactNode; children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <section className="agn-cartao age-secao">
      <div className="age-secao-topo">
        <div><h2>{titulo}</h2>{ajuda ? <p>{ajuda}</p> : null}</div>
        {direita}
      </div>
      <div className="age-secao-corpo">{children}</div>
    </section>
  );
}

/** Aviso inline de estado (carregando, erro, vazio) para blocos que leem da API. */
export function Aviso({ tom, children }: { tom?: "alerta"; children: React.ReactNode }) {
  return <div className="age-vazio" data-tom={tom}><span>{children}</span></div>;
}

/** Carrega JSON de uma rota ao montar (e quando a chave muda). Erro vira mensagem, nunca tela branca. */
export function useApi<T>(url: string | null) {
  const [dados, setDados] = React.useState<T | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (!url) return;
    let vivo = true;
    setErro(null);
    api(url).then((d) => { if (vivo) setDados(d as T); }).catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : "Falha ao carregar."); });
    return () => { vivo = false; };
  }, [url, n]);
  return { dados, erro, carregando: Boolean(url) && !dados && !erro, recarregar: () => setN((x) => x + 1) };
}
