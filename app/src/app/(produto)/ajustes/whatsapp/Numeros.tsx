"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, QrCode, RefreshCw, Search, Star } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input } from "@/components/crm2/ui/Input";
import { Cf2Sheet, Cf2SheetContent, Cf2SheetHeader, Cf2SheetTitle, Cf2SheetDescription } from "@/components/crm2/ui/Sheet";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Radiogroup } from "@/components/onface/ds/escolha";
import { SecaoAjuste, PilulaEstado } from "@/components/onface/ajustes/Secao";

/**
 * Ajustes > WhatsApp: os números como entidade operacional.
 *
 * Um número = uma linha de `whatsapp_sessao`: dono (pessoa ou agente de IA),
 * finalidade, privado/compartilhado, quem mais pode usar, agente que atende por
 * ele, estado da conexão. A lista vem de /api/whatsapp/numeros com o escopo e
 * os filtros resolvidos NO SERVIDOR; a gaveta lê o estado vivo do wuzapi.
 *
 * Toda ação confere a resposta: nada aqui diz "conectado" sem o servidor dizer.
 */

type Pessoa = { id: string; nome: string; tipo: "humano" | "agente"; agenteId?: string | null };
type Numero = {
  id: string; sessionName: string; label: string; phoneNumber: string | null; status: string;
  isDefault: boolean; tipo: string; finalidade: string | null; lastConnectedAt: string | null;
  usuario: Pessoa | null; time: { id: string; nome: string } | null;
  /** Quem atende por aqui. `porPool`: atende por ser número operacional, não por estar preso a ele. */
  agente: { id: string; nome: string; porPool?: boolean } | null;
  conversas: number; minha: boolean; acessos: Array<{ id: string; nome: string }>;
  /** Pessoal/privado: nunca usado por IA nem automação. */
  privado: boolean;
  /** Pool operacional: distribuição, Lia e automações trabalham por ele. Nunca junto com `privado`. */
  operacional?: boolean;
  /** Quem está vendo pode reconfigurar o número (mesma regra do servidor). */
  administra?: boolean;
};
type Resposta = {
  gestao: "organizacao" | "time" | null; eu: string; numeros: Numero[];
  filtros: { usuarios: Array<Pessoa & { team_id: string | null }>; equipes: Array<{ id: string; nome: string }>; agentes: Array<{ id: string; nome: string }> };
};
type Vivo = { status: string; phoneNumber: string | null; qrCode: string | null };

const FINALIDADES: Array<[string, string]> = [["comercial", "Comercial"], ["atendimento", "Atendimento"], ["suporte", "Suporte"], ["sdr", "SDR"], ["cs", "CS"], ["outro", "Outro"]];
const rotuloFinalidade = (f: string | null) => FINALIDADES.find(([k]) => k === f)?.[1] ?? "—";
const ABAS = [["meus", "Meus números"], ["equipe", "Equipe"], ["agentes", "Agentes"], ["compartilhados", "Compartilhados"]] as const;
type Aba = (typeof ABAS)[number][0];

async function acao(nome: string, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/whatsapp/status", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: nome, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(res.status >= 500
      ? "O servidor de WhatsApp não respondeu. Tente de novo em instantes; se persistir, avise o time técnico."
      : body.error || "A ação não foi concluída.");
  }
  return body;
}

const fmtTel = (t: string | null) => {
  if (!t) return null;
  const d = t.replace(/\D/g, "");
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${d}`;
};
const fmtData = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
/* O estado considera o NÚMERO, não só o status da sessão.
   O provedor responde `connected: true, loggedIn: true` com `jid` vazio
   enquanto o pareamento com o celular não termina — e a tela dizia
   "Conectado" em cima disso, ao lado de "Sem número vinculado". Sessão sem
   número não envia nada: chamar isso de conectado manda a pessoa usar um
   número que vai falhar no primeiro disparo. */
const semNumero = (s: string, tel: string | null | undefined) => s === "connected" && !tel;
const estadoDe = (s: string, tel?: string | null) =>
  semNumero(s, tel) ? "pendente" : s === "connected" ? "ok" : s === "waiting_qr" || s === "connecting" ? "pendente" : "erro";
const textoEstado = (s: string, tel?: string | null) =>
  semNumero(s, tel) ? "Pareamento incompleto"
    : s === "connected" ? "Conectado" : s === "waiting_qr" ? "Aguardando QR" : s === "connecting" ? "Conectando" : "Desconectado";

export function NumerosWhatsapp() {
  const qc = useQueryClient();
  const [abaPedida, setAba] = useState<Aba>("meus");
  const [busca, setBusca] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [aberto, setAberto] = useState<string | "novo" | null>(null);

  const params = new URLSearchParams(Object.entries({ ...f, busca }).filter(([, v]) => v));
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Resposta>({
    queryKey: ["whatsapp-numeros", params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/numeros?${params}`);
      if (!res.ok) throw new Error("Falha ao carregar os números");
      return res.json();
    },
    refetchInterval: 10000,
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: ["whatsapp-numeros"] });

  const gestao = data?.gestao ?? null;
  const numeros = useMemo(() => data?.numeros ?? [], [data]);
  const abas = ABAS.filter(([k]) => k === "meus" || (k === "compartilhados" ? gestao || numeros.some((n) => !n.usuario) : !!gestao));
  // Aba pedida que não existe para este usuário cai em "Meus números" sem efeito nem estado extra.
  const aba: Aba = abas.some(([k]) => k === abaPedida) ? abaPedida : "meus";

  const daAba = useMemo(() => numeros.filter((n) => {
    if (aba === "meus") return n.minha;
    if (aba === "agentes") return n.usuario?.tipo === "agente";
    if (aba === "compartilhados") return !n.usuario || n.tipo === "compartilhada";
    return n.usuario?.tipo !== "agente";
  }), [numeros, aba]);

  const conectadas = numeros.filter((n) => n.status === "connected").length;
  const limpar = () => { setF({}); setBusca(""); };
  const temFiltro = busca || Object.values(f).some(Boolean);
  const selecionado = typeof aberto === "string" && aberto !== "novo" ? numeros.find((n) => n.id === aberto) ?? null : null;

  // Equipe: agrupado por pessoa, cada número dela como chip; é o que a gestão olha para saber quem está no ar.
  const grupos = useMemo(() => {
    const m = new Map<string, { pessoa: Pessoa | null; numeros: Numero[] }>();
    for (const n of daAba) {
      const k = n.usuario?.id ?? "";
      if (!m.has(k)) m.set(k, { pessoa: n.usuario, numeros: [] });
      m.get(k)!.numeros.push(n);
    }
    return [...m.values()];
  }, [daAba]);

  return (
    <div className="aj-secoes">
      <SecaoAjuste
        titulo="Números"
        ajuda="Cada número é uma sessão de WhatsApp conectada ao CRM, por QR Code ou por código. Tem um dono (pessoa ou agente), uma finalidade e, se for compartilhado, quem mais pode usar."
        acao={
          <>
            {numeros.length > 0 && (
              <PilulaEstado estado={conectadas === numeros.length ? "ok" : conectadas === 0 ? "erro" : "pendente"}>
                {conectadas} de {numeros.length} conectadas
              </PilulaEstado>
            )}
            <Cf2Button variant="ghost" size="icon" aria-label="Atualizar" onClick={() => refetch()}>
              <RefreshCw className={isFetching ? "animate-spin" : undefined} aria-hidden />
            </Cf2Button>
            <Cf2Button onClick={() => setAberto("novo")}><Plus aria-hidden /> Conectar número</Cf2Button>
          </>
        }
      >
        {/* Escopo é filtro da mesma tabela (os filtros e a lista abaixo não
            trocam de lugar), então radiogroup — e com seta. */}
        <Radiogroup className="aj-abas" rotulo="Escopo dos números" orientacao="horizontal">
          {abas.map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={aba === k} className="aj-aba" onClick={() => setAba(k)}>
              {l}{k !== "meus" && data ? <span className="aj-aba-conta">{numeros.filter((n) => k === "agentes" ? n.usuario?.tipo === "agente" : k === "compartilhados" ? (!n.usuario || n.tipo === "compartilhada") : n.usuario?.tipo !== "agente").length}</span> : null}
            </button>
          ))}
        </Radiogroup>

        <div className="aj-filtros">
          <label className="aj-filtro-busca">
            <Search aria-hidden />
            <Cf2Input placeholder="Buscar número, pessoa ou sessão" aria-label="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <NativeSelect aria-label="Status" value={f.status ?? ""} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <NativeSelectOption value="">Status</NativeSelectOption>
            <NativeSelectOption value="connected">Conectado</NativeSelectOption>
            <NativeSelectOption value="disconnected">Desconectado</NativeSelectOption>
          </NativeSelect>
          {gestao && (
            <NativeSelect aria-label="Usuário" value={f.usuario ?? ""} onChange={(e) => setF({ ...f, usuario: e.target.value })}>
              <NativeSelectOption value="">Usuário</NativeSelectOption>
              {data?.filtros.usuarios.filter((u) => u.tipo !== "agente").map((u) => <NativeSelectOption key={u.id} value={u.id}>{u.nome}</NativeSelectOption>)}
            </NativeSelect>
          )}
          {gestao && data && data.filtros.equipes.length > 0 && (
            <NativeSelect aria-label="Equipe" value={f.equipe ?? ""} onChange={(e) => setF({ ...f, equipe: e.target.value })}>
              <NativeSelectOption value="">Equipe</NativeSelectOption>
              {data.filtros.equipes.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.nome}</NativeSelectOption>)}
            </NativeSelect>
          )}
          {gestao && (
            <NativeSelect aria-label="Agente" value={f.agente ?? ""} onChange={(e) => setF({ ...f, agente: e.target.value })}>
              <NativeSelectOption value="">Agente</NativeSelectOption>
              {data?.filtros.agentes.map((a) => <NativeSelectOption key={a.id} value={a.id}>{a.nome}</NativeSelectOption>)}
            </NativeSelect>
          )}
          <NativeSelect aria-label="Finalidade" value={f.finalidade ?? ""} onChange={(e) => setF({ ...f, finalidade: e.target.value })}>
            <NativeSelectOption value="">Finalidade</NativeSelectOption>
            {FINALIDADES.map(([k, l]) => <NativeSelectOption key={k} value={k}>{l}</NativeSelectOption>)}
          </NativeSelect>
          <NativeSelect aria-label="Compartilhado ou privado" value={f.compartilhado ?? ""} onChange={(e) => setF({ ...f, compartilhado: e.target.value })}>
            <NativeSelectOption value="">Privado ou compartilhado</NativeSelectOption>
            <NativeSelectOption value="0">Privado</NativeSelectOption>
            <NativeSelectOption value="1">Compartilhado</NativeSelectOption>
          </NativeSelect>
          {temFiltro && <Cf2Button variant="ghost" size="sm" onClick={limpar}>Limpar filtros</Cf2Button>}
        </div>

        <LegendaUso />

        {isLoading ? (
          <p className="aj-grupo-ajuda">Carregando números…</p>
        ) : isError ? (
          <div className="aj-vazio"><strong>Não foi possível carregar os números.</strong> Atualize a página em instantes.</div>
        ) : daAba.length === 0 ? (
          <div className="aj-vazio">
            <strong>{temFiltro ? "Nenhum número com esses filtros." : aba === "meus" ? "Você ainda não tem nenhum número." : "Nenhum número aqui."}</strong>
            {aba === "meus" && !temFiltro ? "Clique em Conectar número, dê um nome e leia o QR Code em WhatsApp → Aparelhos conectados." : null}
          </div>
        ) : aba === "equipe" ? (
          <div className="aj-lista">
            {grupos.map((g) => (
              <div key={g.pessoa?.id ?? "compartilhado"} className="aj-linha aj-grupo-pessoa">
                <div className="aj-linha-corpo">
                  <span className="aj-linha-titulo">{g.pessoa?.nome ?? "Compartilhados"}</span>
                  <span className="aj-linha-meta">{g.numeros.filter((n) => n.status === "connected").length} de {g.numeros.length} {g.numeros.length === 1 ? "número conectado" : "números conectados"}</span>
                </div>
                <div className="aj-chips">
                  {g.numeros.map((n) => (
                    <button key={n.id} type="button" className="aj-chip" data-estado={estadoDe(n.status, n.phoneNumber)} onClick={() => setAberto(n.id)}>
                      <span className="aj-chip-titulo">{n.label}</span>
                      <span className="aj-chip-meta">{fmtTel(n.phoneNumber) ?? "Sem número vinculado"}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="aj-lista">
            {daAba.map((n) => (
              <li key={n.id} className="aj-linha aj-numero" data-padrao={n.isDefault || undefined}>
                <span className="aj-conexao-icone" aria-hidden><IconeWa /></span>
                <div className="aj-linha-corpo">
                  <span className="aj-linha-titulo">{n.label}</span>
                  <span className="aj-linha-meta">{fmtTel(n.phoneNumber) ?? "Sem número vinculado"}</span>
                </div>
                <PilulaEstado estado={estadoDe(n.status, n.phoneNumber)}>{textoEstado(n.status, n.phoneNumber)}</PilulaEstado>
                <Fato rotulo={n.usuario?.tipo === "agente" ? "Agente" : "Usuário"}>{n.usuario?.nome ?? "Compartilhado"}</Fato>
                <Fato rotulo="Finalidade">{rotuloFinalidade(n.finalidade)}</Fato>
                <Fato rotulo="Conversas">{n.conversas}</Fato>
                {n.isDefault ? <span className="aj-pilula"><Star aria-hidden style={{ width: 12, height: 12 }} /> Padrão</span> : null}
                <SelosUso n={n} />
                <div className="aj-linha-acoes">
                  {n.status !== "connected" && n.minha ? (
                    <Cf2Button size="sm" onClick={() => setAberto(n.id)}>Conectar</Cf2Button>
                  ) : (
                    <Cf2Button size="sm" variant="secondary" onClick={() => setAberto(n.id)}>Detalhes</Cf2Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SecaoAjuste>

      <Cf2Sheet open={aberto !== null} onOpenChange={(o) => { if (!o) setAberto(null); }}>
        <Cf2SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {aberto === "novo" ? (
            <NovoNumero gestao={gestao} pessoas={data?.filtros.usuarios ?? []} eu={data?.eu ?? ""}
              /* Espera a lista voltar ANTES de abrir o detalhe. Abrindo no
                 mesmo gesto, `selecionado` procurava o número novo numa lista
                 que ainda não o tinha, resolvia para null e o painel abria
                 VAZIO — sem QR Code, sem nada. Quem criava um número para
                 outra pessoa (um agente, por exemplo) não tinha como conectar:
                 só sobrava criar para si e transferir depois. */
              criado={async (id) => { await invalidar(); setAberto(id); }} />
          ) : selecionado ? (
            <DetalheNumero key={selecionado.id} n={selecionado} gestao={gestao} pessoas={data?.filtros.usuarios ?? []} eu={data?.eu ?? ""}
              mudou={invalidar} fechar={() => setAberto(null)} />
          ) : (
            /* Painel pedido para um número que a lista ainda não tem. Antes
               aqui era `null`: a gaveta abria em branco e parecia defeito da
               tela. Dizer que está carregando é a verdade, e some sozinho
               quando a lista chega. */
            <p className="aj-grupo-ajuda">Carregando o número…</p>
          )}
        </Cf2SheetContent>
      </Cf2Sheet>
    </div>
  );
}

/** Selos de uso do número: privado (fora de IA/automação) e operacional (pool de trabalho automático). */
function SelosUso({ n }: { n: Numero }) {
  if (!n.privado && !n.operacional) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {n.privado ? <Badge variant="warning">Privado</Badge> : null}
      {n.operacional ? <Badge variant="info">Operacional</Badge> : null}
    </span>
  );
}

function LegendaUso() {
  return (
    <p className="aj-grupo-ajuda inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1.5"><Badge variant="warning">Privado</Badge> nunca é usado por IA nem por automação.</span>
      <span className="inline-flex items-center gap-1.5"><Badge variant="info">Operacional</Badge> entra no pool de trabalho automático: distribuição de leads, Lia e automações.</span>
    </p>
  );
}

function Fato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <span className="aj-numero-fato">
      <span className="aj-numero-fato-valor">{children}</span>
      <span className="aj-numero-fato-rotulo">{rotulo}</span>
    </span>
  );
}

function IconeWa() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

/** Dono do número: pessoas e agentes do escopo da gestão; fora da gestão, só eu. */
function SelectDono({ valor, pessoas, eu, gestao, onChange }: {
  valor: string | null; pessoas: Pessoa[]; eu: string; gestao: Resposta["gestao"]; onChange: (v: string | null) => void;
}) {
  if (!gestao) return <span className="aj-conexao-fato">Você</span>;
  return (
    <NativeSelect aria-label="Usuário responsável" className="w-full" value={valor ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <NativeSelectOption value="">Compartilhado (sem dono)</NativeSelectOption>
      {pessoas.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.nome}{p.tipo === "agente" ? " · agente" : p.id === eu ? " (você)" : ""}</NativeSelectOption>)}
    </NativeSelect>
  );
}

function NovoNumero({ gestao, pessoas, eu, criado }: { gestao: Resposta["gestao"]; pessoas: Pessoa[]; eu: string; criado: (id: string) => void }) {
  const [nome, setNome] = useState("");
  // `undefined` = ainda não escolheu: vale eu mesmo (o `eu` pode chegar depois da primeira renderização).
  const [donoEscolhido, setDono] = useState<string | null | undefined>(undefined);
  const dono = donoEscolhido === undefined ? (eu || null) : donoEscolhido;
  const [finalidade, setFinalidade] = useState("");
  const [acessos, setAcessos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  async function criar() {
    const rotulo = nome.trim();
    if (!rotulo) return;
    setOcupado(true);
    try {
      const s = await acao("create", {
        sessionName: `${rotulo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36).slice(-4)}`,
        label: rotulo, ...(gestao ? { usuarioId: dono } : {}), finalidade: finalidade || null, acessos: dono === null ? acessos : undefined,
      });
      toast.success("Número criado. Agora conecte lendo o QR Code ou por código.");
      criado(s.id);
    } catch (e) { toast.error((e as Error).message); } finally { setOcupado(false); }
  }

  return (
    <>
      <Cf2SheetHeader>
        <Cf2SheetTitle>Conectar número</Cf2SheetTitle>
        <Cf2SheetDescription>A conexão pertence a esta sessão: o WhatsApp do celular fica pareado com ela, e só ela.</Cf2SheetDescription>
      </Cf2SheetHeader>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
        <label className="aj-campo"><span>Nome do número</span>
          <Cf2Input placeholder="Ex.: Comercial SP, Suporte" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </label>
        <label className="aj-campo"><span>Usuário responsável</span>
          <SelectDono valor={dono} pessoas={pessoas} eu={eu} gestao={gestao} onChange={setDono} />
          <small>Pessoa ou agente de IA. As conversas que chegarem por este número ficam com o responsável.</small>
        </label>
        <label className="aj-campo"><span>Finalidade</span>
          <NativeSelect className="w-full" value={finalidade} onChange={(e) => setFinalidade(e.target.value)}>
            <NativeSelectOption value="">Sem finalidade definida</NativeSelectOption>
            {FINALIDADES.map(([k, l]) => <NativeSelectOption key={k} value={k}>{l}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        {gestao && dono === null && (
          <Acessos pessoas={pessoas} valor={acessos} onChange={setAcessos} />
        )}
        <Cf2Button type="submit" disabled={!nome.trim()} loading={ocupado}>Criar e conectar</Cf2Button>
      </form>
    </>
  );
}

function Acessos({ pessoas, valor, onChange }: { pessoas: Pessoa[]; valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="aj-campo">
      <span>Quem pode usar este número</span>
      <div className="aj-checks">
        {pessoas.filter((p) => p.tipo !== "agente").map((p) => (
          <label key={p.id} className="aj-check">
            <input type="checkbox" checked={valor.includes(p.id)}
              onChange={(e) => onChange(e.target.checked ? [...valor, p.id] : valor.filter((x) => x !== p.id))} />
            {p.nome}
          </label>
        ))}
      </div>
      <small>Número compartilhado só aparece no Atendimento de quem estiver marcado aqui (e da gestão).</small>
    </fieldset>
  );
}

function DetalheNumero({ n, gestao, pessoas, eu, mudou, fechar }: {
  n: Numero; gestao: Resposta["gestao"]; pessoas: Pessoa[]; eu: string; mudou: () => void; fechar: () => void;
}) {
  const [dono, setDono] = useState<string | null>(n.usuario?.id ?? null);
  const [finalidade, setFinalidade] = useState(n.finalidade ?? "");
  const [acessos, setAcessos] = useState<string[]>(n.acessos.map((a) => a.id));
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pareando, setPareando] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);

  /* Estado VIVO: pergunta ao wuzapi (a lista mostra o último estado gravado).
     É aqui que o QR aparece e que "Conectado" só é dito quando é verdade. */
  const { data: vivo, refetch } = useQuery<Vivo>({
    queryKey: ["whatsapp-vivo", n.id],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/status?sessionId=${n.id}`);
      if (!res.ok) throw new Error("Falha ao ler o estado do número");
      return res.json();
    },
    refetchInterval: 3000,
  });
  const status = vivo?.status ?? n.status;
  useEffect(() => { if (vivo && vivo.status !== n.status) mudou(); }, [vivo, n.status, mudou]);

  const sujo = dono !== (n.usuario?.id ?? null) || finalidade !== (n.finalidade ?? "")
    || acessos.slice().sort().join() !== n.acessos.map((a) => a.id).sort().join();

  async function rodar(chave: string, nome: string, extra: Record<string, unknown>, sucesso: string) {
    setOcupado(chave);
    try {
      await acao(nome, { sessionId: n.id, ...extra });
      await refetch();
      mudou();
      toast.success(sucesso);
      return true;
    } catch (e) { toast.error((e as Error).message); return false; } finally { setOcupado(null); }
  }

  async function pedirCodigo() {
    const num = telefone.replace(/\D/g, "");
    if (num.length < 12) { toast.error("Informe o número com DDI e DDD. Ex.: 5511999998888"); return; }
    setOcupado("codigo");
    try {
      const body = await acao("pair-phone", { sessionId: n.id, telefone: num });
      if (!body?.codigo) throw new Error("O servidor não devolveu o código");
      setCodigo(body.codigo);
      toast.success("Código gerado. Digite no celular em até 60 segundos.");
    } catch (e) { toast.error((e as Error).message); } finally { setOcupado(null); }
  }

  const podeEditarVinculo = !!gestao;
  const podeEditarFinalidade = !!gestao || n.usuario?.id === eu;

  return (
    <>
      <Cf2SheetHeader>
        <Cf2SheetTitle className="flex items-center gap-2"><span className="aj-conexao-icone" aria-hidden><IconeWa /></span>{n.label}</Cf2SheetTitle>
        <Cf2SheetDescription className="flex items-center gap-2">
          {fmtTel(vivo?.phoneNumber ?? n.phoneNumber) ?? "Sem número vinculado"} <PilulaEstado estado={estadoDe(status, vivo?.phoneNumber ?? n.phoneNumber)}>{textoEstado(status, vivo?.phoneNumber ?? n.phoneNumber)}</PilulaEstado>
          <SelosUso n={n} />
        </Cf2SheetDescription>
      </Cf2SheetHeader>

      {status !== "connected" && n.minha && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-4">
          {vivo?.qrCode ? (
            <div className="flex flex-col items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--text-muted)]">
                <QrCode style={{ width: 14, height: 14 }} aria-hidden /> No celular: WhatsApp → Aparelhos conectados → Conectar aparelho
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={vivo.qrCode.startsWith("data:") ? vivo.qrCode : `data:image/png;base64,${vivo.qrCode}`} alt={`QR Code para conectar ${n.label}`}
                className="h-48 w-48 rounded-lg bg-white p-2" style={{ imageRendering: "pixelated" }} />
              <span className="text-[var(--text-xs)] text-[var(--text-muted)]">Esta tela atualiza sozinha quando o celular parear.</span>
            </div>
          ) : (
            <Cf2Button loading={ocupado === "connect"} onClick={() => rodar("connect", "connect", {}, "Pedido enviado. O QR Code aparece aqui em instantes.")}>
              Conectar por QR Code
            </Cf2Button>
          )}
          {pareando ? (
            <div className="flex flex-col gap-2">
              <span className="text-[var(--text-sm)] text-[var(--text-muted)]">No celular: WhatsApp → Aparelhos conectados → <strong>Conectar com número de telefone</strong></span>
              <div className="flex gap-2">
                <Cf2Input placeholder="5511999998888" inputMode="numeric" value={telefone} onChange={(e) => setTelefone(e.target.value)} aria-label="Número com DDI e DDD" />
                <Cf2Button size="sm" loading={ocupado === "codigo"} onClick={pedirCodigo}>Gerar código</Cf2Button>
              </div>
              {codigo && (
                <div className="flex flex-col gap-1">
                  <span className="aj-mono text-[var(--text-xl)] tracking-[0.3em]">{codigo}</span>
                  <span className="text-[var(--text-sm)] text-[var(--text-muted)]">Expira em cerca de 60 segundos; gere outro se passar.</span>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="self-start text-[var(--text-sm)] underline" onClick={() => setPareando(true)}>
              Não consigo ler o QR Code — conectar por código
            </button>
          )}
        </div>
      )}

      <dl className="aj-fatos">
        <div className="aj-fato"><dt>Usuário responsável</dt><dd>{n.usuario ? `${n.usuario.nome}${n.usuario.tipo === "agente" ? " · agente" : ""}` : "Compartilhado"}</dd></div>
        <div className="aj-fato"><dt>Agente que atende por aqui</dt><dd>
          {n.agente ? `${n.agente.nome}${n.agente.porPool ? " · pelo pool operacional" : ""}` : "Nenhum"}
        </dd></div>
        <div className="aj-fato"><dt>Equipe</dt><dd>{n.time?.nome ?? "—"}</dd></div>
        <div className="aj-fato"><dt>Conversas</dt><dd>{n.conversas}</dd></div>
        <div className="aj-fato"><dt>É o número padrão</dt><dd>{n.isDefault ? "Sim" : "Não"}</dd></div>
        <div className="aj-fato"><dt>Última conexão</dt><dd>{fmtData(n.lastConnectedAt) ?? "Nunca"}</dd></div>
        <div className="aj-fato"><dt>ID da sessão</dt>
          <dd><span className="aj-mono">{n.sessionName}</span>
            <button type="button" aria-label="Copiar ID da sessão" onClick={() => { void navigator.clipboard.writeText(n.sessionName); toast.success("ID copiado."); }}><Copy style={{ width: 14, height: 14 }} /></button>
          </dd>
        </div>
      </dl>

      {n.administra && (
        <div className="flex flex-col gap-2 border-t border-[var(--line-hairline)] pt-4">
          <span className="aj-grupo-titulo">Uso automático</span>
          <div className="flex items-start justify-between gap-3">
            <label htmlFor={`operacional-${n.id}`} className="aj-campo">
              <span>Número operacional (Lia, distribuição e automações)</span>
              <small>
                {n.privado
                  ? "Indisponível: este número é privado, e número privado nunca é usado por IA nem por automação."
                  : "Ligado, o número entra no pool de trabalho automático: regras de distribuição podem mandar leads para ele, e a Lia e as automações podem falar por ele."}
              </small>
            </label>
            <Switch id={`operacional-${n.id}`} checked={!!n.operacional} disabled={n.privado || ocupado === "operacional"}
              onCheckedChange={(v) => void rodar("operacional", "update", { operacional: v },
                v ? `${n.label} agora é operacional.` : `${n.label} saiu do pool operacional.`)} />
          </div>
        </div>
      )}

      {(podeEditarVinculo || podeEditarFinalidade) && (
        <form className="flex flex-col gap-3 border-t border-[var(--line-hairline)] pt-4" onSubmit={(e) => {
          e.preventDefault();
          void rodar("vincular", "vincular", {
            ...(podeEditarVinculo ? { usuarioId: dono, acessos: dono === null ? acessos : [] } : {}),
            finalidade: finalidade || null,
          }, "Vínculo salvo.");
        }}>
          <span className="aj-grupo-titulo">Vínculo</span>
          {podeEditarVinculo && (
            <label className="aj-campo"><span>Usuário responsável</span>
              <SelectDono valor={dono} pessoas={pessoas} eu={""} gestao={gestao} onChange={setDono} />
            </label>
          )}
          <label className="aj-campo"><span>Finalidade</span>
            <NativeSelect className="w-full" value={finalidade} onChange={(e) => setFinalidade(e.target.value)}>
              <NativeSelectOption value="">Sem finalidade definida</NativeSelectOption>
              {FINALIDADES.map(([k, l]) => <NativeSelectOption key={k} value={k}>{l}</NativeSelectOption>)}
            </NativeSelect>
          </label>
          {podeEditarVinculo && dono === null && <Acessos pessoas={pessoas} valor={acessos} onChange={setAcessos} />}
          <Cf2Button type="submit" disabled={!sujo} loading={ocupado === "vincular"}>Salvar vínculo</Cf2Button>
        </form>
      )}

      <div className="flex flex-col gap-2 border-t border-[var(--line-hairline)] pt-4">
        {gestao && !n.isDefault && (
          <Cf2Button variant="secondary" loading={ocupado === "padrao"} onClick={() => rodar("padrao", "set-default", {}, `${n.label} agora é o número padrão da organização.`)}>
            <Star aria-hidden /> Definir como padrão
          </Cf2Button>
        )}
        {status === "connected" && (
          <Cf2Button variant="secondary" loading={ocupado === "disconnect"} onClick={() => {
            if (confirm(`Desconectar "${n.label}"? As conversas continuam no CRM, mas nada entra nem sai por este número até reconectar.`)) {
              void rodar("disconnect", "disconnect", {}, "Número desconectado.");
            }
          }}>Desconectar número</Cf2Button>
        )}
        {(gestao || n.usuario?.id === eu) && (
          <Cf2Button variant="danger" loading={ocupado === "delete"} onClick={async () => {
            if (!confirm(`Excluir o número "${n.label}"? A sessão é removida do servidor de WhatsApp. As mensagens ficam no histórico das pessoas, sem este número. Não dá para desfazer.`)) return;
            if (await rodar("delete", "delete", {}, "Número excluído.")) fechar();
          }}>Excluir número</Cf2Button>
        )}
      </div>
    </>
  );
}
