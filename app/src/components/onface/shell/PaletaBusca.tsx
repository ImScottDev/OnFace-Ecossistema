"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, type LucideIcon } from "lucide-react";

import { DESTINOS, NAVEGACAO } from "../navegacao";

type Resultado = {
  id: string;
  label: string;
  tag?: string;
  /** Todo resultado carrega ícone no desenho: é ele que diz, antes da leitura,
   *  se a linha cria alguma coisa ou leva a algum lugar. */
  Icone: LucideIcon;
  ir: () => void;
};

type Grupo = { titulo: string; itens: Resultado[] };

/**
 * Paleta ⌘K — réplica do protótipo `OnFace Casca.dc.html` (bloco `buscaAberta`).
 *
 * Geometria do desenho: véu `rgba(9,14,20,.42)` com a caixa ancorada a 88px do
 * topo, 576px de largura, raio 10, contorno `#e3e7e8` e sombra
 * `0 10px 30px -6px rgba(0,0,0,.22)`. Cabeçalho com lupa, campo de 14px e a
 * tecla ESC em mono; rodapé em `#fafafa` com as três dicas de teclado.
 *
 * O que ela alcança HOJE é navegação e criação — as duas coisas que existem
 * sem backend de busca. Registro (empresa, pessoa, lead, oportunidade,
 * proposta) entra quando houver endpoint: o protótipo busca no `dados.js`, que
 * é exemplo, e inventar resultado aqui seria pior que a ausência dele.
 */
export function PaletaBusca() {
  const router = useRouter();
  const [aberta, setAberta] = React.useState(false);
  const [termo, setTermo] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const campo = React.useRef<HTMLInputElement>(null);

  const abrir = React.useCallback(() => {
    setTermo("");
    setIdx(0);
    setAberta(true);
  }, []);

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        abrir();
      }
    };
    const aoPedir = () => abrir();
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("open-command-palette", aoPedir);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("open-command-palette", aoPedir);
    };
  }, [abrir]);

  React.useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);

  const grupos = React.useMemo<Grupo[]>(() => {
    const q = termo.trim().toLowerCase();
    const casa = (t: string) => !q || t.toLowerCase().includes(q);

    const acoes: Resultado[] = [
      { id: "a-lead", label: "Novo lead", Icone: Plus, ir: () => router.push("/pre-vendas") },
      { id: "a-op", label: "Nova oportunidade", Icone: Plus, ir: () => router.push("/pipeline") },
      { id: "a-prop", label: "Nova proposta", Icone: Plus, ir: () => router.push("/propostas") },
      { id: "a-ativ", label: "Nova atividade", Icone: Plus, ir: () => router.push("/tarefas") },
    ].filter((a) => casa(a.label));

    const area = (href: string) =>
      NAVEGACAO.find((a) => a.href === href || a.itens?.some((i) => i.href === href))?.label;

    const telas: Resultado[] = DESTINOS.filter((d) => casa(d.label)).map((d) => ({
      id: `t-${d.href}`,
      label: d.label,
      tag: area(d.href),
      Icone: d.icon,
      ir: () => router.push(d.href),
    }));

    return [
      { titulo: "Ações", itens: acoes },
      { titulo: "Telas", itens: telas },
    ].filter((g) => g.itens.length);
  }, [termo, router]);

  const planos = React.useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);

  const escolher = (r: Resultado) => {
    setAberta(false);
    r.ir();
  };

  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setAberta(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => (planos.length ? (i + 1) % planos.length : 0));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => (planos.length ? (i - 1 + planos.length) % planos.length : 0));
    }
    if (e.key === "Enter" && planos[idx]) {
      e.preventDefault();
      escolher(planos[idx]);
    }
  };

  if (!aberta) return null;

  let pos = -1;

  return (
    <div className="onface-paleta-veu" onClick={() => setAberta(false)} role="presentation">
      <div
        className="onface-paleta"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar no ONFACE"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="onface-paleta-topo">
          <Search aria-hidden />
          <input
            ref={campo}
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setIdx(0);
            }}
            onKeyDown={tecla}
            placeholder="Buscar empresa, pessoa, lead, oportunidade ou proposta"
          />
          <span className="onface-paleta-esc">ESC</span>
        </div>

        <div className="onface-paleta-corpo">
          {grupos.map((g) => (
            <div key={g.titulo}>
              <div className="onface-paleta-grupo">{g.titulo}</div>
              {g.itens.map((r) => {
                pos += 1;
                const aqui = pos;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="onface-paleta-item"
                    data-marcado={aqui === idx}
                    onMouseEnter={() => setIdx(aqui)}
                    onClick={() => escolher(r)}
                  >
                    <r.Icone aria-hidden />
                    <span className="onface-paleta-item-label">{r.label}</span>
                    {r.tag && <span className="onface-paleta-tag">{r.tag}</span>}
                  </button>
                );
              })}
            </div>
          ))}

          {!planos.length && (
            <div className="onface-paleta-vazio">
              <div>Nada encontrado para “{termo}”</div>
              <p>
                A busca alcança telas e atalhos de criação. Registro por nome depende do
                índice de busca, que ainda não existe no servidor.
              </p>
            </div>
          )}
        </div>

        <div className="onface-paleta-rodape">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}
