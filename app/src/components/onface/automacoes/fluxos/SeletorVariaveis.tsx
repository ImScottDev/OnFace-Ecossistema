"use client";

/* Seletor de variáveis ao lado de todo campo que aceita {{ }} (contrato
 * §7.2): o que o gatilho traz, os dados do registro, as variáveis definidas
 * e as saídas SÓ dos blocos anteriores no caminho — oferecer a saída de um
 * bloco que roda depois seria oferecer um valor que ainda não existe. Com um
 * ensaio feito, cada variável mostra o valor real que teve. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, Search } from "lucide-react";
import {
  CATALOGO_NOS, VARIAVEIS_CONTEXTO, eventoPorId, lerCaminho,
  type GrafoFluxo,
} from "@/lib/automacoes/grafo";
import { anteriores, gruposContexto } from "./operacoes";

export interface GrupoVariaveis { rotulo: string; itens: { caminho: string; rotulo: string }[] }

export function variaveisPara(grafo: GrafoFluxo, noId: string | null): GrupoVariaveis[] {
  const grupos: GrupoVariaveis[] = [];
  const gatilho = grafo.nos.find((n) => n.tipo === "gatilho");
  if (gatilho?.config.modo === "evento") {
    const ev = eventoPorId(String(gatilho.config.evento ?? ""));
    if (ev?.campos.length) grupos.push({ rotulo: `Evento: ${ev.rotulo}`, itens: ev.campos.map((c) => ({ caminho: `gatilho.${c.chave}`, rotulo: c.rotulo })) });
  }
  if (gatilho?.config.modo === "webhook") {
    grupos.push({ rotulo: "Chamada recebida", itens: [{ caminho: "gatilho.body", rotulo: "Corpo inteiro (use gatilho.body.campo)" }] });
  }
  grupos.push(...gruposContexto(VARIAVEIS_CONTEXTO));
  const antes = noId ? new Set(anteriores(grafo, noId)) : new Set<string>();
  const nosAntes = grafo.nos.filter((n) => antes.has(n.id));
  const vars = nosAntes.flatMap((n) => n.tipo === "definir_variavel"
    ? ((n.config.pares as { chave?: string }[] | undefined) ?? []).filter((p) => p.chave).map((p) => ({ caminho: `vars.${p.chave}`, rotulo: String(p.chave) }))
    : []);
  if (vars.length) grupos.push({ rotulo: "Variáveis definidas", itens: vars });
  const saidas = nosAntes.flatMap((n) => {
    const meta = CATALOGO_NOS[n.tipo];
    const nome = n.rotulo?.trim() || meta.rotulo;
    return meta.saidaCampos.map((c) => ({ caminho: `nos.${n.id}.${c.chave}`, rotulo: `${nome} (${n.id}) › ${c.rotulo}` }));
  });
  if (saidas.length) grupos.push({ rotulo: "Blocos anteriores", itens: saidas });
  return grupos;
}

/**
 * Escolher OU digitar, numa peça só — a variante do seletor para os campos
 * que não são texto corrido (campo e valor de uma regra).
 *
 * `grupos` liga o mesmo popup de variáveis dos Fluxos, que escreve a chave
 * certa no lugar de deixar a pessoa adivinhar. `sugestoes` liga o datalist
 * nativo, com o que a conta já tem. O campo continua sendo um input comum:
 * quem precisa de uma chave fora da lista digita e segue.
 */
export function EntradaComLista({ id, valor, aoMudar, rotulo, placeholder, grupos, contexto, sugestoes, desabilitado }: {
  id?: string;
  valor: string;
  aoMudar: (valor: string) => void;
  rotulo: string;
  placeholder?: string;
  /** Com grupos, aparece o botão que escolhe a chave da variável. */
  grupos?: GrupoVariaveis[];
  contexto?: Record<string, unknown> | null;
  /** Valores conhecidos (etapas, tags…) para o datalist nativo. */
  sugestoes?: { valor: string; rotulo: string }[];
  desabilitado?: boolean;
}) {
  const idLista = `${id ?? rotulo}-lista`;
  const comLista = Boolean(sugestoes?.length);
  return (
    <div className="ofx-campo-linha">
      <input
        id={id} className="oa-input" value={valor} aria-label={rotulo} placeholder={placeholder}
        disabled={desabilitado} list={comLista ? idLista : undefined}
        onChange={(e) => aoMudar(e.target.value)}
      />
      {comLista && (
        <datalist id={idLista}>
          {sugestoes!.map((s) => <option key={s.valor} value={s.valor} label={s.rotulo !== s.valor ? s.rotulo : undefined} />)}
        </datalist>
      )}
      {grupos && (
        <SeletorVariaveis grupos={grupos} contexto={contexto ?? null} desabilitado={desabilitado} aoInserir={aoMudar} />
      )}
    </div>
  );
}

function previa(v: unknown): string {
  if (v === undefined || v === null || v === "") return "vazio";
  const t = typeof v === "object" ? JSON.stringify(v) : String(v);
  return t.length > 40 ? `${t.slice(0, 38)}…` : t;
}

export function SeletorVariaveis({ grupos, contexto, aoInserir, desabilitado }: {
  grupos: GrupoVariaveis[];
  /** Contexto hidratado do último ensaio, para mostrar o valor real. */
  contexto: Record<string, unknown> | null;
  aoInserir: (caminho: string) => void;
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const termo = busca.trim().toLowerCase();
  const filtrados = useMemo(() => grupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !termo || `${i.rotulo} ${i.caminho}`.toLowerCase().includes(termo)) }))
    .filter((g) => g.itens.length), [grupos, termo]);

  return (
    <div className="ofx-vars" ref={raiz}>
      <button
        type="button"
        className="ofx-vars-botao"
        onClick={() => setAberto((a) => !a)}
        disabled={desabilitado}
        aria-expanded={aberto}
        aria-label="Inserir variável"
        title="Inserir variável"
      >
        <Braces size={13} strokeWidth={2.2} />
      </button>
      {aberto && (
        <div className="ofx-vars-pop" role="dialog" aria-label="Variáveis" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false); } }}>
          <label className="ofx-paleta-busca">
            <Search size={13} aria-hidden />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar variável" aria-label="Buscar variável" />
          </label>
          <div className="ofx-vars-lista">
            {filtrados.length === 0 && <p className="oa-dica">Nada com “{busca}”.</p>}
            {filtrados.map((g) => (
              <div key={g.rotulo}>
                <span className="ofx-vars-grupo">{g.rotulo}</span>
                {g.itens.map((i) => (
                  <button key={i.caminho} type="button" className="ofx-vars-item" onClick={() => { aoInserir(i.caminho); setAberto(false); setBusca(""); }}>
                    <span>{i.rotulo}</span>
                    <code>{contexto ? previa(lerCaminho(contexto, i.caminho)) : i.caminho}</code>
                  </button>
                ))}
              </div>
            ))}
          </div>
          {!contexto && <p className="ofx-vars-dica">Faça um ensaio para ver o valor real de cada variável.</p>}
        </div>
      )}
    </div>
  );
}
