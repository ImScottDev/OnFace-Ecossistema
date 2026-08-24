"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Phone, CalendarPlus, Building2, Repeat, ChevronDown, FileText, Info, LayoutList, Tag, Plus, X } from "lucide-react";
import { ConversaItem, Contexto, iniciais, brl } from "./types";
import { Cf2Badge } from "../ui/Badge";
import { Cf2NovoEventoModal, LeadResultado } from "../calendario/NovoEventoModal";
import { Cf2CadenciaPanel } from "../cadencia/CadenciaPanel";
import { useScriptsAtendimento, SCRIPTS_CATEGORIA_LABEL } from "./useScriptsAtendimento";

// Paleta rotativa pra tag nova (24/08) — usuário não escolhe cor na criação
// inline, só dá o nome; cor é decorativa pra diferenciar visualmente no chat,
// não carrega significado (sem semântica tipo "vermelho = urgente").
const TAG_PALETTE = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444", "#64748b"];

/**
 * Tags da conversa (24/08, Kauã: "faltou a opção de colocar tag... vai ser
 * usado para ativar automações depois... precisa ser associado ao lead
 * e/ou ao negócio"). Vivia como um <select> apertado no cabeçalho do chat
 * (ChatThread.tsx) — movido pra cá com espaço pra criar tag nova inline.
 * Independente de ter lead vinculado: a tag é sempre do contato/conversa
 * (contato_labels); o dual-write pro lead (lead_labels + gatilho
 * tag_adicionada) já acontece no backend quando existe leadId.
 */
function Cf2TagsSection({ conversaId }: { conversaId: string }) {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: tagsData } = useQuery<{ tags: { id: string; nome: string; cor: string }[] }>({
    queryKey: ["cf2-conversation-tags", conversaId],
    queryFn: async () => {
      const r = await fetch(`/api/atendimento/conversas/${conversaId}/tags`);
      return r.ok ? r.json() : { tags: [] };
    },
  });
  const { data: todasLabels = [] } = useQuery<{ id: string; nome: string; cor: string }[]>({
    queryKey: ["labels"],
    queryFn: async () => {
      const r = await fetch("/api/labels");
      return r.ok ? r.json() : [];
    },
  });

  const tags = tagsData?.tags ?? [];
  const disponiveis = todasLabels.filter((l) => !tags.some((t) => t.id === l.id));
  const termo = busca.trim().toLowerCase();
  const sugestoes = termo ? disponiveis.filter((l) => l.nome.toLowerCase().includes(termo)) : disponiveis;
  const jaExiste = termo.length > 0 && (
    disponiveis.some((l) => l.nome.toLowerCase() === termo) || tags.some((t) => t.nome.toLowerCase() === termo)
  );

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["cf2-conversation-tags", conversaId] });
    queryClient.invalidateQueries({ queryKey: ["cf2-conversas"] });
  };

  const addMutation = useMutation({
    mutationFn: async (labelId: string) => {
      const r = await fetch(`/api/atendimento/conversas/${conversaId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      });
      if (!r.ok) throw new Error("Falha ao adicionar tag");
    },
    onSuccess: () => { invalidar(); setBusca(""); setAberto(false); },
    onError: () => toast.error("Não foi possível adicionar a tag."),
  });

  const removeMutation = useMutation({
    mutationFn: async (labelId: string) => {
      const r = await fetch(`/api/atendimento/conversas/${conversaId}/tags/${labelId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Falha ao remover tag");
    },
    onSuccess: invalidar,
    onError: () => toast.error("Não foi possível remover a tag."),
  });

  const criarMutation = useMutation({
    mutationFn: async (nome: string) => {
      const cor = TAG_PALETTE[todasLabels.length % TAG_PALETTE.length];
      const r = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, cor }),
      });
      if (!r.ok) throw new Error("Falha ao criar tag");
      return r.json() as Promise<{ id: string; nome: string; cor: string }>;
    },
    onSuccess: async (novaTag) => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      await addMutation.mutateAsync(novaTag.id);
    },
    onError: () => toast.error("Não foi possível criar a tag."),
  });

  const confirmar = () => {
    const nome = busca.trim();
    if (!nome) return;
    const exata = disponiveis.find((l) => l.nome.toLowerCase() === nome.toLowerCase());
    if (exata) { addMutation.mutate(exata.id); return; }
    if (!jaExiste) criarMutation.mutate(nome);
  };

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>
        <Tag className="w-3 h-3" /> TAGS DA CONVERSA
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && !aberto && (
          <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem tags ainda.</p>
        )}
        {tags.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-[11px] font-semibold" style={{ color: tag.cor, background: `${tag.cor}18` }}>
            {tag.nome}
            <button onClick={() => removeMutation.mutate(tag.id)} title={`Remover ${tag.nome}`} className="flex items-center justify-center rounded-full w-3.5 h-3.5 hover:opacity-70">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>

      {aberto ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <input
              ref={inputRef}
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmar();
                if (e.key === "Escape") { setAberto(false); setBusca(""); }
              }}
              placeholder="Nova tag..."
              className="flex-1 rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
              style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
            />
            <button
              onClick={confirmar}
              disabled={!busca.trim() || criarMutation.isPending || addMutation.isPending}
              className="flex items-center justify-center rounded-lg w-8 shrink-0 disabled:opacity-40"
              style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
              title="Adicionar tag"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {sugestoes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {sugestoes.slice(0, 6).map((l) => (
                <button
                  key={l.id}
                  onClick={() => addMutation.mutate(l.id)}
                  className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold hover:opacity-80"
                  style={{ color: l.cor, background: `${l.cor}18` }}
                >
                  {l.nome}
                </button>
              ))}
            </div>
          )}
          {termo && !jaExiste && (
            <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>Enter cria a tag &ldquo;{busca.trim()}&rdquo;.</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1 self-start text-[11px] font-semibold rounded-full px-2.5 py-1"
          style={{ color: "var(--cf2-text-secondary)", background: "var(--cf2-bg-surface-muted)" }}
        >
          <Plus className="w-3 h-3" /> Adicionar tag
        </button>
      )}
    </div>
  );
}

const PORTE_LABEL: Record<string, string> = { pequena: "Pequena empresa", media: "Média empresa", grande: "Grande empresa" };

function formatarCnpjCurto(v: string): string {
  const digits = v.replace(/\D/g, "");
  if (digits.length !== 14) return v;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

const ETAPA_LABEL: Record<string, string> = {
  reuniao_agendada: "Reunião Agendada",
  reuniao_realizada: "Reunião Realizada",
  negociacao_iniciada: "Negociação",
  proposta_apresentada: "Proposta Apresentada",
  ativo: "Ativo",
  outra_data: "Outra Data",
  sem_retorno: "Sem Retorno",
  no_show: "No-show",
  trial: "Trial",
};

export function Cf2ContextPanel({ conversa, contexto, loading }: { conversa: ConversaItem; contexto: Contexto | null; loading: boolean }) {
  const queryClient = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  const [cadenciaAberta, setCadenciaAberta] = useState(false);
  // Duas abas (20/08, referência de UX): "Contexto" (pessoa/empresa/cascata/
  // atividades/cadências, já existia) e "Detalhes" (CNPJ/segmento/porte +
  // Scripts sugeridos) — reorganização de UI com dado que já chegava aqui,
  // só empilhado verticalmente antes.
  const [aba, setAba] = useState<"contexto" | "detalhes">("contexto");

  const leadPreSelecionado: LeadResultado | null =
    conversa.leadId && contexto?.pessoa
      ? {
          id: conversa.leadId,
          nome: contexto.pessoa.nome,
          email: contexto.pessoa.email,
          empresa: contexto.empresa?.nome || null,
          negocioAtivoId: contexto.cascata.tipo === "negocio" ? contexto.cascata.id : null,
        }
      : null;

  function fecharModal() {
    setModalAberto(false);
  }

  function criouEvento() {
    setModalAberto(false);
    queryClient.invalidateQueries({ queryKey: ["cf2-contexto", conversa.leadId] });
  }

  return (
    <div
      className="flex flex-col gap-4 h-full shrink-0 w-[320px] rounded-3xl overflow-y-auto p-4"
      style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
    >
      {/* Só WhatsApp por agora (24/08): a rota de tags resolve por
          contatos.id, e só o WhatsApp usa esse id — ligação/e-mail guardam
          id de outra tabela (ligacoes.id/emails.id), então dava 404 antes
          mesmo de mexer aqui. Estender pra esses canais é escopo de dados
          separado (tag por lead direto, não por "contato"). */}
      {conversa.tipo === "whatsapp" && (
        <>
          <Cf2TagsSection conversaId={conversa.id} />
          <div className="h-px w-full shrink-0" style={{ background: "var(--cf2-border-default)" }} />
        </>
      )}

      {loading && <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando...</p>}

      {!loading && !contexto?.pessoa && (
        <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>
          Sem lead vinculado a esse contato ainda — nenhum dado de CRM pra mostrar aqui.
        </p>
      )}

      {contexto?.pessoa && (
        <>
          <div className="flex gap-1 p-1 rounded-xl shrink-0" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            {([["contexto", "Contexto", LayoutList], ["detalhes", "Detalhes", Info]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setAba(key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold"
                style={{ background: aba === key ? "var(--cf2-bg-surface)" : "transparent", color: aba === key ? "var(--cf2-text-primary)" : "var(--cf2-text-secondary)" }}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {aba === "contexto" && (
          <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>PESSOA</p>
              <Cf2Badge variant={contexto.isCliente ? "success" : "neutral"}>{contexto.isCliente ? "Cliente" : "Lead"}</Cf2Badge>
            </div>
            <div className="flex gap-2.5 items-center">
              <div className="flex items-center justify-center rounded-[18px] shrink-0 w-9 h-9" style={{ background: "var(--cf2-accent)" }}>
                <p className="text-[12px] font-extrabold" style={{ color: "var(--cf2-text-on-accent)" }}>{iniciais(contexto.pessoa.nome)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{contexto.pessoa.nome}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>{contexto.pessoa.cargo || "—"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {conversa.leadId && (
                <a href={`/leads/${conversa.leadId}`} className="flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>
                  <Pencil className="w-3 h-3" /> Editar lead (legado)
                </a>
              )}
              {contexto.pessoa.telefone && (
                <a href={`tel:${contexto.pessoa.telefone}`} className="flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>
                  <Phone className="w-3 h-3" /> Ligar
                </a>
              )}
              <button onClick={() => setModalAberto(true)} className="flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}>
                <CalendarPlus className="w-3 h-3" /> Agenda
              </button>
            </div>
            <div className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>
              {contexto.pessoa.telefone && <p>📞 {contexto.pessoa.telefone}</p>}
              {contexto.pessoa.email && <p>✉️ {contexto.pessoa.email}</p>}
            </div>
          </div>

          <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />

          {contexto.empresa && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>EMPRESA</p>
              <a
                href={contexto.empresa.id ? `/empresas/${contexto.empresa.id}` : undefined}
                className={`flex gap-2.5 items-center rounded-xl p-1 -m-1 ${contexto.empresa.id ? "hover:bg-[var(--cf2-bg-surface-muted)]" : "cursor-default"}`}
              >
                <div className="flex items-center justify-center rounded-lg shrink-0 w-8 h-8" style={{ background: "var(--cf2-bg-inverse)" }}>
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{contexto.empresa.nome}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--cf2-text-secondary)" }}>Ver empresa (tela legada) · CNPJ, porte e segmento</p>
                </div>
              </a>
            </div>
          )}

          <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />

          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>
              {contexto.cascata.tipo === "negocio" ? "NEGÓCIO ATIVO" : contexto.cascata.tipo === "proposta" ? "PROPOSTA ENVIADA" : contexto.cascata.tipo === "reuniao" ? "REUNIÃO AGENDADA" : "SEM NEGOCIAÇÃO ATIVA"}
            </p>

            {/* Relacionamentos ativos clicáveis (19/08) — igual ao card de
                Empresa acima, achado real olhando referência de UX: card de
                Negócio/Proposta/Reunião existia só como leitura, sem levar
                pro registro real (a Empresa já era clicável, esses três
                não). */}
            {contexto.cascata.tipo === "negocio" && (
              <a href={`/negocios/${contexto.cascata.id}`} className="flex flex-col gap-2 p-3 rounded-xl hover:opacity-80" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{contexto.cascata.titulo}</p>
                  <p className="text-[13px] font-extrabold" style={{ color: "var(--cf2-text-primary)" }}>{brl(contexto.cascata.valor)}</p>
                </div>
                <Cf2Badge variant="warning">{ETAPA_LABEL[contexto.cascata.etapa] || contexto.cascata.etapa}</Cf2Badge>
              </a>
            )}

            {contexto.cascata.tipo === "proposta" && (
              <a href={`/propostas?propostaId=${contexto.cascata.id}`} className="flex flex-col gap-2 p-3 rounded-xl hover:opacity-80" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>Proposta #{contexto.cascata.numero}</p>
                  <p className="text-[13px] font-extrabold" style={{ color: "var(--cf2-text-primary)" }}>{brl(contexto.cascata.valor)}</p>
                </div>
                <Cf2Badge variant="accent">Enviada</Cf2Badge>
              </a>
            )}

            {contexto.cascata.tipo === "reuniao" && (
              contexto.cascata.link ? (
                <a href={contexto.cascata.link} target="_blank" rel="noreferrer" className="flex flex-col gap-2 p-3 rounded-xl hover:opacity-80" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                  <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{contexto.cascata.titulo}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{new Date(contexto.cascata.data).toLocaleString("pt-BR")} · Abrir link da reunião ↗</p>
                </a>
              ) : (
                <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                  <p className="text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{contexto.cascata.titulo}</p>
                  <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>{new Date(contexto.cascata.data).toLocaleString("pt-BR")}</p>
                </div>
              )
            )}

            {contexto.cascata.tipo === "nenhum" && (
              <button
                onClick={() => setModalAberto(true)}
                disabled={!conversa.leadId}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold disabled:opacity-50"
                style={{ background: "var(--cf2-accent)", border: "1px solid var(--cf2-accent-border)", color: "var(--cf2-text-on-accent)" }}
              >
                <CalendarPlus className="w-3.5 h-3.5" /> Agendar Reunião
              </button>
            )}
          </div>

          <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>PRÓXIMAS ATIVIDADES</p>
            {contexto.proximasAtividades.length === 0 && (
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma atividade futura.</p>
            )}
            {contexto.proximasAtividades.map((a) => (
              <div key={a.id} className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--cf2-accent-border)" }} />
                <p className="text-[12px] flex-1" style={{ color: "var(--cf2-text-primary)" }}>
                  {a.titulo} ({new Date(a.data).toLocaleDateString("pt-BR")})
                </p>
              </div>
            ))}
          </div>

          {conversa.leadId && (
            <>
              <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />
              <div className="flex flex-col gap-3">
                <button onClick={() => setCadenciaAberta((v) => !v)} className="flex items-center justify-between w-full">
                  <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: "var(--cf2-text-tertiary)" }}>
                    <Repeat className="w-3 h-3" /> CADÊNCIAS
                  </p>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ color: "var(--cf2-text-tertiary)", transform: cadenciaAberta ? "rotate(180deg)" : "none" }} />
                </button>
                {cadenciaAberta && <Cf2CadenciaPanel leadId={conversa.leadId} />}
              </div>
            </>
          )}
          </>
          )}

          {aba === "detalhes" && <DetalhesTab contexto={contexto} />}
        </>
      )}

      {modalAberto && (
        <Cf2NovoEventoModal
          dataInicial={new Date()}
          leadPreSelecionado={leadPreSelecionado}
          tituloInicial={contexto?.pessoa ? `Reunião com ${contexto.pessoa.nome}` : ""}
          onClose={fecharModal}
          onCriado={criouEvento}
        />
      )}
    </div>
  );
}

/**
 * Aba "Detalhes" (20/08, referência de UX) — CNPJ/porte/segmento (dado que
 * já chegava no Contexto, só reorganizado) + Scripts sugeridos. Sem
 * matching por IA: mostra todos os scripts ativos, mais recente primeiro —
 * não existe critério real de relevância por contato ainda, não fabricado.
 */
function DetalhesTab({ contexto }: { contexto: Contexto }) {
  const [scriptAberto, setScriptAberto] = useState<string | null>(null);
  const { data } = useScriptsAtendimento();
  const scripts = [...(data?.scripts ?? [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>EMPRESA</p>
        {contexto.empresa ? (
          <div className="flex flex-col gap-1.5 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
            <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{contexto.empresa.nome}</p>
            {contexto.empresa.setor && <p>Segmento: {contexto.empresa.setor}</p>}
            {contexto.empresa.cnpj && <p>CNPJ: {formatarCnpjCurto(contexto.empresa.cnpj)}</p>}
            {contexto.empresa.porte && <p>{PORTE_LABEL[contexto.empresa.porte] || contexto.empresa.porte}</p>}
            {!contexto.empresa.setor && !contexto.empresa.cnpj && !contexto.empresa.porte && (
              <p style={{ color: "var(--cf2-text-tertiary)" }}>Sem CNPJ/porte/segmento cadastrado.</p>
            )}
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Sem empresa vinculada.</p>
        )}
      </div>

      <div className="h-px w-full" style={{ background: "var(--cf2-border-default)" }} />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold" style={{ color: "var(--cf2-text-tertiary)" }}>SCRIPTS SUGERIDOS</p>
        {scripts.length === 0 && (
          <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum script cadastrado ainda.</p>
        )}
        {scripts.map((s) => (
          <div key={s.id} className="rounded-lg overflow-hidden" style={{ background: "var(--cf2-bg-surface-muted)" }}>
            <button onClick={() => setScriptAberto(scriptAberto === s.id ? null : s.id)} className="w-full flex items-center gap-2 p-2 text-left">
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--cf2-text-tertiary)" }} />
              <p className="flex-1 text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{s.titulo}</p>
              <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-tertiary)" }}>{SCRIPTS_CATEGORIA_LABEL[s.categoria] || s.categoria}</span>
              <ChevronDown className="w-3 h-3 shrink-0" style={{ color: "var(--cf2-text-tertiary)", transform: scriptAberto === s.id ? "rotate(180deg)" : undefined }} />
            </button>
            {scriptAberto === s.id && (
              <p className="px-2 pb-2 text-[12px] whitespace-pre-wrap" style={{ color: "var(--cf2-text-secondary)" }}>{s.conteudo}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
