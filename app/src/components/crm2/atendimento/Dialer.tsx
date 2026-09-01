"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Delete, Search } from "lucide-react";
import { callfaceCallUrl } from "@/lib/utils/callface-call";
import { Cf2Badge } from "../ui/Badge";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

type ContatoSimples = { id: string; nome: string; telefone: string | null; empresaNome: string | null };
type LeadBusca = ContatoSimples & { situacao: "negociacao" | "proposta" | null };
type LeadNovo = ContatoSimples & { estagio: { label: string; color: string }; responsavelNome: string | null };

export function Cf2Dialer({ numeroInicial }: { numeroInicial?: string } = {}) {
  // Prefill real (23/08): deep link "Ligar" do drawer de Pré-vendas manda o
  // telefone do lead via `/atendimento?canal=ligacao&telefone=X` — mesmo
  // dígitos que `callfaceCallUrl` já usa (DDD+número sem código do país).
  // Sem isso a SDR tinha que redigitar o número na mão depois do deep link.
  const [numero, setNumero] = useState(numeroInicial || "");
  const [busca, setBusca] = useState("");

  const podeLigar = numero.replace(/\D/g, "").length >= 10;

  const { data } = useQuery({
    queryKey: ["cf2-buscar-leads", busca],
    queryFn: async () => {
      if (busca.length < 2) return { leads: [] as LeadBusca[] };
      const res = await fetch(`/api/atendimento/buscar-leads?search=${encodeURIComponent(busca)}`);
      if (!res.ok) return { leads: [] as LeadBusca[] };
      return res.json();
    },
    enabled: busca.length >= 2,
  });

  const { data: quentes } = useQuery({
    queryKey: ["cf2-contatos-quentes"],
    queryFn: async () => {
      const res = await fetch("/api/atendimento/contatos-quentes");
      if (!res.ok) return { recentes: [], comProposta: [], novos: [] };
      return res.json() as Promise<{ recentes: ContatoSimples[]; comProposta: ContatoSimples[]; novos: LeadNovo[] }>;
    },
    enabled: busca.length < 2,
  });

  const ligar = (tel: string) => window.open(callfaceCallUrl(tel), "_blank");

  return (
    <>
      <div
        className="flex-1 flex flex-col items-center justify-center h-full rounded-2xl gap-5"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/[^\d*#]/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter" && podeLigar) ligar(numero); }}
          placeholder="DDD + número"
          className="w-60 text-center px-4 py-3 rounded-xl text-[22px] font-semibold tracking-wide outline-none"
          style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
        />

        <div className="grid grid-cols-3 gap-3">
          {TECLAS.map((k) => (
            <button
              key={k}
              onClick={() => setNumero((n) => n + k)}
              className="w-14 h-14 rounded-full text-[20px] font-medium transition-colors hover:bg-[var(--cf2-bg-surface-subtle)]"
              style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-5">
          <button
            onClick={() => podeLigar && ligar(numero)}
            disabled={!podeLigar}
            className="flex items-center justify-center rounded-full w-16 h-16 disabled:opacity-40 transition-transform hover:scale-105"
            style={{ background: "var(--cf2-accent)" }}
          >
            <Phone className="w-6 h-6" style={{ color: "var(--cf2-text-on-accent)" }} />
          </button>
          <button
            onClick={() => setNumero((n) => n.slice(0, -1))}
            disabled={!numero}
            className="flex items-center justify-center rounded-full w-11 h-11 disabled:opacity-30 transition-colors hover:bg-[var(--cf2-bg-surface-subtle)]"
            style={{ background: "var(--cf2-bg-surface-muted)" }}
          >
            <Delete className="w-4 h-4" style={{ color: "var(--cf2-text-secondary)" }} />
          </button>
        </div>

        <p className="text-[12px] text-center max-w-[260px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          Ou busque um contato salvo no painel à direita.
        </p>
      </div>

      <div
        className="flex flex-col gap-3 h-full shrink-0 w-[336px] rounded-2xl p-4"
        style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
      >
        <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Buscar contato pra ligar</p>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
          <Search className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-tertiary)" }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome do lead..."
            className="flex-1 bg-transparent outline-none text-[13px]"
            style={{ color: "var(--cf2-text-primary)" }}
          />
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-3">
          {busca.length >= 2 ? (
            <div className="flex flex-col gap-1">
              {(data?.leads ?? []).length === 0 && (
                <p className="text-[12px] py-2 text-center" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum lead encontrado.</p>
              )}
              {(data?.leads ?? []).map((l: LeadBusca) => (
                <ContatoRow key={l.id} contato={l} badge={l.situacao} onLigar={(tel) => { setNumero(tel.replace(/\D/g, "")); ligar(tel); }} />
              ))}
            </div>
          ) : (
            <>
              <Secao titulo="Ligados recentemente" itens={quentes?.recentes ?? []} onLigar={(tel) => { setNumero(tel.replace(/\D/g, "")); ligar(tel); }} />
              <Secao titulo="Com proposta em aberto" itens={quentes?.comProposta ?? []} badge="proposta" onLigar={(tel) => { setNumero(tel.replace(/\D/g, "")); ligar(tel); }} />
              {/* Leads novos (25/08, pedido do Kauã): visão de fila da
                  organização inteira, não só os seus — por isso não usa o
                  ContatoRow genérico, mostra estágio real do board de
                  Pré-vendas + responsável, pra dar contexto de quem já é
                  dono antes de ligar em cima de conversa de outra pessoa. */}
              {(quentes?.novos ?? []).length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide px-1" style={{ color: "var(--cf2-text-tertiary)" }}>Leads novos</p>
                  {(quentes?.novos ?? []).map((l) => (
                    <LeadNovoRow key={l.id} lead={l} onLigar={(tel) => { setNumero(tel.replace(/\D/g, "")); ligar(tel); }} />
                  ))}
                </div>
              )}
              {quentes && !quentes.recentes.length && !quentes.comProposta.length && !quentes.novos.length && (
                <p className="text-[12px] py-4 text-center" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum contato ainda. Busque por nome acima.</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Secao({ titulo, itens, badge, onLigar }: { titulo: string; itens: ContatoSimples[]; badge?: "proposta"; onLigar: (tel: string) => void }) {
  if (itens.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-wide px-1" style={{ color: "var(--cf2-text-tertiary)" }}>{titulo}</p>
      {itens.map((c) => (
        <ContatoRow key={c.id} contato={c} badge={badge} onLigar={onLigar} />
      ))}
    </div>
  );
}

function LeadNovoRow({ lead, onLigar }: { lead: LeadNovo; onLigar: (tel: string) => void }) {
  // Defensivo (25/08, achado real: cache do react-query no navegador guarda
  // a resposta ANTERIOR à mudança de formato do backend até a próxima
  // refetch — sem isso, um `lead.estagio` de uma resposta velha em cache
  // quebra a tela inteira em vez de só ficar sem o rótulo).
  const estagio = lead.estagio ?? { label: "Novo", color: "#3B82F6" };
  return (
    <button
      onClick={() => lead.telefone && onLigar(lead.telefone)}
      disabled={!lead.telefone}
      className="flex flex-col gap-1.5 p-2.5 rounded-xl text-left disabled:opacity-40 transition-colors hover:bg-[var(--cf2-bg-surface-subtle)]"
      style={{ background: "var(--cf2-bg-surface-muted)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{lead.nome}</p>
        <span className="shrink-0 text-[10px] font-bold px-1.5 py-[1px] rounded-full leading-tight" style={{ color: estagio.color, background: `${estagio.color}18` }}>
          {estagio.label}
        </span>
      </div>
      <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{lead.empresaNome || "Sem empresa"}</p>
      <p className="text-[10.5px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>
        {lead.responsavelNome ? `Responsável: ${lead.responsavelNome}` : "Sem responsável"}{!lead.telefone && " · sem telefone"}
      </p>
    </button>
  );
}

function ContatoRow({ contato, badge, onLigar }: { contato: ContatoSimples; badge?: "negociacao" | "proposta" | null; onLigar: (tel: string) => void }) {
  return (
    <button
      onClick={() => contato.telefone && onLigar(contato.telefone)}
      disabled={!contato.telefone}
      className="flex flex-col gap-1 p-2.5 rounded-xl text-left disabled:opacity-40 transition-colors hover:bg-[var(--cf2-bg-surface-subtle)]"
      style={{ background: "var(--cf2-bg-surface-muted)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{contato.nome}</p>
        {badge === "negociacao" && <Cf2Badge variant="warning">Negociação</Cf2Badge>}
        {badge === "proposta" && <Cf2Badge variant="accent">Proposta</Cf2Badge>}
      </div>
      <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>
        {contato.empresaNome || "—"} {!contato.telefone && "· sem telefone"}
      </p>
    </button>
  );
}
