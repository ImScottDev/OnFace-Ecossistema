"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, ChevronsUpDown, Clock, Pencil, Plus, Route, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useOrgUsuarios } from "@/components/crm/BoardFilters";
import { SecaoAjuste } from "@/components/onface/ajustes/Secao";
import { OpcoesDePessoa } from "@/components/onface/OpcoesDePessoa";

type Regra = {
  id: string; nome: string; etapa: string; alvoTipo: "usuario" | "rodizio"; alvoUsuarioId: string | null; rodizioUsuarioIds: string[];
  diasSemana: number[] | null; horaInicio: string | null; horaFim: string | null; humanoDevolucaoId: string | null; prioridade: number; ativo: boolean;
  /* Critérios (migration 0131): nulo ou vazio = qualquer valor; a regra casa quando TODOS os preenchidos casam. */
  descricao?: string | null; origem?: string[] | null; utmSource?: string[] | null; utmCampaign?: string[] | null;
  metaCampaignIds?: string[] | null; formulario?: string[] | null;
  /** Número operacional de onde o lead é trabalhado. */
  sessaoWhatsappId?: string | null;
};
/** Número de WhatsApp como /api/whatsapp/numeros devolve (só o que a regra precisa). */
type NumeroWa = { id: string; label: string; phoneNumber: string | null; privado?: boolean; operacional?: boolean };

/**
 * Critérios de "quando", na ordem da tela e do resumo. Chave = campo da regra
 * na API e no endpoint de opções; `atributo` = o campo do lead hipotético no
 * simulador (lá o valor é um só, não uma lista).
 */
const CRITERIOS = [
  { chave: "utmCampaign", atributo: "utmCampaign", rotulo: "Campanha", dica: "utm_campaign do link que trouxe o lead." },
  { chave: "utmSource", atributo: "utmSource", rotulo: "Fonte", dica: "utm_source: ig, meta, Google." },
  { chave: "origem", atributo: "origem", rotulo: "Origem", dica: "Como o lead entrou: Mídia Paga, Site, outbound." },
  { chave: "metaCampaignIds", atributo: "metaCampaignId", rotulo: "Campanha da Meta", dica: "O id numérico que a Meta manda no lead." },
  { chave: "formulario", atributo: "formulario", rotulo: "Formulário", dica: "Id do formulário da Meta, do RD ou do site." },
] as const;
type ChaveCriterio = (typeof CRITERIOS)[number]["chave"];

/** Um valor que já existe nos leads da organização, com quantos leads vieram por ele. */
type ValorConhecido = { valor: string; leads: number };
type Opcoes = Record<ChaveCriterio, ValorConhecido[]>;
const SEM_OPCOES: Opcoes = { utmCampaign: [], utmSource: [], origem: [], metaCampaignIds: [], formulario: [] };

type Estado = {
  regras: Regra[];
  historico: { id: string; quando: string; quem: string | null; acao: string; regra: string; resumo: string }[];
  padroes: { humanoDevolucaoPadraoId?: string; agenteFollowupPadraoId?: string; responsavelInboundId?: string | null };
};
/** O que `resolverPorRegra` devolve (lib/agentes/distribuicao.ts), via POST /simular. */
type Simulacao = { resultado: { responsavelId: string; regraId: string; regraNome: string; sessaoWhatsappId: string | null; motivo: string } | null };

const DIAS = [
  { i: 0, curto: "dom", longo: "domingo" }, { i: 1, curto: "seg", longo: "segunda" }, { i: 2, curto: "ter", longo: "terça" },
  { i: 3, curto: "qua", longo: "quarta" }, { i: 4, curto: "qui", longo: "quinta" }, { i: 5, curto: "sex", longo: "sexta" },
  { i: 6, curto: "sáb", longo: "sábado" },
];
const hhmm = (h: string | null) => (h ? h.slice(0, 5) : "");
const fmtTel = (t: string | null) => (t ? `+${t.replace(/\D/g, "")}` : null);
const nLeads = (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? "lead" : "leads"}`;

const VAZIA = {
  nome: "", alvoTipo: "usuario" as "usuario" | "rodizio", alvoUsuarioId: "", rodizioUsuarioIds: [] as string[], diasSemana: [] as number[],
  horaInicio: "", horaFim: "", humanoDevolucaoId: "", prioridade: 100, ativo: true, descricao: "",
  utmCampaign: [] as string[], utmSource: [] as string[], origem: [] as string[], metaCampaignIds: [] as string[], formulario: [] as string[],
  sessaoWhatsappId: "",
};
type Form = typeof VAZIA & { id?: string };
const lista = (v: string[]) => (v.length ? v : null);

/** As mesmas recusas de `validar()` em lib/agentes/distribuicao.ts, no campo em que o olho está. */
function conferir(f: Form) {
  return {
    nome: f.nome.trim() ? null : "Dê um nome à regra.",
    alvoUsuarioId: f.alvoTipo === "usuario" && !f.alvoUsuarioId ? "Escolha quem recebe." : null,
    rodizioUsuarioIds: f.alvoTipo === "rodizio" && f.rodizioUsuarioIds.length < 2 ? "O rodízio precisa de pelo menos duas pessoas ou agentes." : null,
    horario: Boolean(f.horaInicio) !== Boolean(f.horaFim) ? "Informe a hora de início e a de fim, ou nenhuma das duas." : null,
  };
}

/**
 * Regras de distribuição de leads novos (Ajustes > Leads): "lead novo que veio
 * de X vai para Y", com Y sendo pessoa, agente de IA (que também é usuário) ou
 * rodízio, podendo valer só em certos dias e horários.
 *
 * Os valores de campanha, fonte, origem, campanha da Meta e formulário não são
 * digitados: vêm de `GET /api/distribuicao-leads/opcoes`, que lê o que a
 * organização já tem em leads e manda a contagem de cada um. Valor novo (a
 * campanha que ainda não trouxe lead) continua aceito, digitando.
 */
export function DistribuicaoLeads() {
  const qc = useQueryClient();
  const { usuarios, byId } = useOrgUsuarios();
  const pessoas = useMemo(() => usuarios.filter((u) => u.tipo !== "agente"), [usuarios]);
  const agentes = useMemo(() => usuarios.filter((u) => u.tipo === "agente"), [usuarios]);
  const [form, setForm] = useState<Form | null>(null);
  const [tentou, setTentou] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<Estado>({
    queryKey: ["distribuicao-leads"],
    queryFn: async () => {
      const r = await fetch("/api/distribuicao-leads");
      if (!r.ok) throw new Error("Não foi possível carregar a distribuição.");
      return r.json();
    },
  });
  /* O que a organização já conhece. Carregado junto da seção para o combobox
     abrir com a lista pronta, em vez de piscar vazio na primeira abertura. */
  const { data: opcoes } = useQuery<Opcoes>({
    queryKey: ["distribuicao-leads-opcoes"],
    queryFn: async () => {
      const r = await fetch("/api/distribuicao-leads/opcoes");
      if (!r.ok) throw new Error("Não foi possível carregar os valores já usados.");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  /* Números de atendimento: só os operacionais e não privados da organização. É a mesma
     lista de Ajustes > WhatsApp, com o escopo resolvido no servidor. */
  const { data: numerosResp } = useQuery<{ numeros: NumeroWa[] }>({
    queryKey: ["whatsapp-numeros", ""],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/numeros");
      if (!r.ok) throw new Error("Falha ao carregar os números");
      return r.json();
    },
  });
  const todosNumeros = useMemo(() => numerosResp?.numeros ?? [], [numerosResp]);
  const numerosOperacionais = useMemo(() => todosNumeros.filter((n) => n.operacional && !n.privado), [todosNumeros]);
  const rotuloNumero = (id: string | null | undefined) => {
    if (!id) return null;
    const n = todosNumeros.find((x) => x.id === id);
    return n ? n.label : "número indisponível";
  };
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["distribuicao-leads"] });
    qc.invalidateQueries({ queryKey: ["org-usuarios"] });
  };

  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const r = await fetch("/api/distribuicao-leads/regras", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: f.id, nome: f.nome, etapa: "novo", alvoTipo: f.alvoTipo,
          alvoUsuarioId: f.alvoTipo === "usuario" ? f.alvoUsuarioId || null : null, rodizioUsuarioIds: f.alvoTipo === "rodizio" ? f.rodizioUsuarioIds : [],
          diasSemana: f.diasSemana.length ? f.diasSemana : null, horaInicio: f.horaInicio || null, horaFim: f.horaFim || null,
          humanoDevolucaoId: f.humanoDevolucaoId || null, prioridade: Number(f.prioridade) || 100, ativo: f.ativo,
          descricao: f.descricao.trim() || null,
          utmCampaign: lista(f.utmCampaign), utmSource: lista(f.utmSource), origem: lista(f.origem),
          metaCampaignIds: lista(f.metaCampaignIds), formulario: lista(f.formulario),
          sessaoWhatsappId: f.sessaoWhatsappId || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Não foi possível salvar a regra.");
      return f;
    },
    onSuccess: (f) => {
      setForm(null); setTentou(false); recarregar();
      toast.success(f.id ? "Regra salva." : "Regra criada.");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remover = useMutation({
    mutationFn: async (r: Regra) => {
      const resp = await fetch(`/api/distribuicao-leads/regras/${r.id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error("Não foi possível remover a regra.");
    },
    onSuccess: () => { recarregar(); toast.success("Regra removida."); },
    onError: (e) => toast.error((e as Error).message),
  });
  const alternar = useMutation({
    mutationFn: async (r: Regra) => {
      const resp = await fetch("/api/distribuicao-leads/regras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...r, ativo: !r.ativo }) });
      if (!resp.ok) throw new Error("Não foi possível alterar a regra.");
      return r;
    },
    onSuccess: (r) => { recarregar(); toast.success(r.ativo ? "Regra desativada." : "Regra ativada."); },
    onError: (e) => toast.error((e as Error).message),
  });
  const salvarPadroes = useMutation({
    mutationFn: async (p: { humanoDevolucaoPadraoId: string | null; agenteFollowupPadraoId: string | null }) => {
      const r = await fetch("/api/distribuicao-leads/padroes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Não foi possível salvar os padrões.");
    },
    onSuccess: () => { recarregar(); toast.success("Padrões salvos."); },
    onError: (e) => toast.error((e as Error).message),
  });

  const nome = (id: string | null) => (id ? byId.get(id)?.nome ?? "—" : "—");
  const padroes = data?.padroes ?? {};
  const regras = data?.regras ?? [];
  const erros = form ? conferir(form) : null;
  const temErro = erros ? Object.values(erros).some(Boolean) : false;

  const abrirNova = () => { setForm({ ...VAZIA }); setTentou(false); };
  const abrirEdicao = (r: Regra) => {
    setTentou(false);
    setForm({
      id: r.id, nome: r.nome, alvoTipo: r.alvoTipo, alvoUsuarioId: r.alvoUsuarioId ?? "", rodizioUsuarioIds: r.rodizioUsuarioIds,
      diasSemana: r.diasSemana ?? [], horaInicio: hhmm(r.horaInicio), horaFim: hhmm(r.horaFim), humanoDevolucaoId: r.humanoDevolucaoId ?? "",
      prioridade: r.prioridade, ativo: r.ativo, descricao: r.descricao ?? "",
      utmCampaign: r.utmCampaign ?? [], utmSource: r.utmSource ?? [], origem: r.origem ?? [],
      metaCampaignIds: r.metaCampaignIds ?? [], formulario: r.formulario ?? [], sessaoWhatsappId: r.sessaoWhatsappId ?? "",
    });
  };
  const enviar = () => {
    setTentou(true);
    if (!form || temErro) return;
    salvar.mutate(form);
  };

  return (
    <SecaoAjuste
      id="dist-titulo"
      titulo="Distribuição de novos leads"
      ajuda="Quem recebe cada lead que cai em Novo de Pré-vendas: uma pessoa, uma agente de IA ou um rodízio. A regra pode olhar de onde o lead veio e valer só em certos dias e horários. Sem nenhuma regra, vale o responsável padrão de inbound."
      acao={!form ? <Button size="sm" onClick={abrirNova}><Plus /> Nova regra</Button> : null}
    >
      {form ? (
        <FormularioDeRegra
          form={form} setForm={setForm} erros={erros!} mostrarErros={tentou}
          opcoes={opcoes ?? SEM_OPCOES} usuarios={usuarios} pessoas={pessoas}
          numerosOperacionais={numerosOperacionais} rotuloNumero={rotuloNumero}
          salvando={salvar.isPending} onSalvar={enviar}
          onCancelar={() => { setForm(null); setTentou(false); }}
        />
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : isError ? (
        <p className="aj-aviso" data-tom="erro" role="alert">
          Não foi possível carregar as regras de distribuição.{" "}
          <Button variant="link" size="xs" onClick={() => refetch()}>Tentar de novo</Button>
        </p>
      ) : regras.length === 0 ? (
        <div className="aj-vazio">
          <strong>Nenhuma regra de distribuição</strong>
          <span>
            Todo lead novo vai para o responsável padrão de inbound, logo abaixo nesta tela. Crie a primeira regra
            para mandar o lead de uma campanha, de uma origem ou de um formulário direto para quem trabalha aquilo.
          </span>
          {!form ? <Button size="sm" variant="outline" onClick={abrirNova}><Plus /> Criar a primeira regra</Button> : null}
        </div>
      ) : (
        <ul className="aj-lista">
          {regras.map((r) => (
            <LinhaDaRegra
              key={r.id} regra={r} nome={nome} numero={rotuloNumero(r.sessaoWhatsappId)}
              ehAgente={r.alvoTipo === "usuario" && byId.get(r.alvoUsuarioId ?? "")?.tipo === "agente"}
              ocupado={alternar.isPending || remover.isPending}
              onAlternar={() => alternar.mutate(r)}
              onEditar={() => abrirEdicao(r)}
              onRemover={() => { if (confirm(`Remover a regra "${r.nome}"?`)) remover.mutate(r); }}
            />
          ))}
        </ul>
      )}

      <Simulador opcoes={opcoes ?? SEM_OPCOES} nome={nome} rotuloNumero={rotuloNumero} temRegra={regras.length > 0} />

      <div className="aj-campos border-t border-linha pt-3.5">
        <label className="aj-campo"><span>Quando uma agente passa para humano, quem recebe</span>
          <NativeSelect
            className="w-full" value={padroes.humanoDevolucaoPadraoId ?? ""}
            onChange={(e) => salvarPadroes.mutate({ humanoDevolucaoPadraoId: e.target.value || null, agenteFollowupPadraoId: padroes.agenteFollowupPadraoId ?? null })}
          >
            <NativeSelectOption value="">Gerente da organização</NativeSelectOption>
            {pessoas.map((u) => <NativeSelectOption key={u.id} value={u.id}>{u.nome}</NativeSelectOption>)}
          </NativeSelect>
          <small>Vale para toda agente que não tenha devolução própria na regra.</small>
        </label>
        <label className="aj-campo"><span>Agente do follow-up por tag</span>
          <NativeSelect
            className="w-full" value={padroes.agenteFollowupPadraoId ?? ""}
            onChange={(e) => salvarPadroes.mutate({ humanoDevolucaoPadraoId: padroes.humanoDevolucaoPadraoId ?? null, agenteFollowupPadraoId: e.target.value || null })}
          >
            <NativeSelectOption value="">Nenhum (a tag não delega)</NativeSelectOption>
            {agentes.map((u) => <NativeSelectOption key={u.id} value={u.id}>{u.nome} (IA)</NativeSelectOption>)}
          </NativeSelect>
          <small>Quem assume o lead que recebe a tag &ldquo;Follow-up IA&rdquo;.</small>
        </label>
      </div>

      {data && data.historico.length > 0 ? (
        <details className="text-apoio text-tinta-suave">
          <summary className="cursor-pointer">Histórico de mudanças ({data.historico.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.historico.map((h) => (
              <li key={h.id}>
                <span className="text-tinta-fraca">{new Date(h.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>{" "}
                <strong className="text-tinta">{h.quem ?? "Sistema"}</strong> {h.acao}: {h.regra} {h.resumo}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </SecaoAjuste>
  );
}

/* ── Uma regra na lista: condição à esquerda, destino à direita ───────────── */

function LinhaDaRegra({ regra: r, nome, numero, ehAgente, ocupado, onAlternar, onEditar, onRemover }: {
  regra: Regra; nome: (id: string | null) => string; numero: string | null; ehAgente: boolean; ocupado: boolean;
  onAlternar: () => void; onEditar: () => void; onRemover: () => void;
}) {
  const condicoes = CRITERIOS.flatMap((c) => {
    const valores = r[c.chave];
    return valores?.length ? [{ rotulo: c.rotulo, valores }] : [];
  });
  const dias = r.diasSemana?.length ? r.diasSemana.map((d) => DIAS[d]?.curto ?? d).join(", ") : null;
  const horario = r.horaInicio && r.horaFim ? `${hhmm(r.horaInicio)} às ${hhmm(r.horaFim)}` : null;
  const destino = r.alvoTipo === "rodizio"
    ? `Rodízio entre ${r.rodizioUsuarioIds.length}: ${r.rodizioUsuarioIds.map(nome).join(", ")}`
    : nome(r.alvoUsuarioId);

  return (
    <li className="aj-linha flex-wrap items-start" data-ativo={r.ativo}>
      {/* `minWidth` em estilo, e não em utilitário: `.aj-linha-corpo` traz
          `min-width: 0` numa folha sem camada, que vence o Tailwind. Abaixo
          de 18rem as ações descem para a linha de baixo em vez de espremer a
          condição numa coluna de três palavras (390px). */}
      <div className="aj-linha-corpo" style={{ opacity: r.ativo ? 1 : 0.6, minWidth: "18rem" }}>
        <p className="aj-linha-titulo flex flex-wrap items-center gap-1.5">
          {r.nome}
          {ehAgente ? <Bot className="size-3.5" aria-label="Agente de IA" /> : null}
          <Badge variant="outline" title="Prioridade: a regra de número menor é avaliada primeiro">#{r.prioridade}</Badge>
          {!r.ativo ? <Badge variant="secondary">Desativada</Badge> : null}
        </p>

        <div className="mt-1 flex flex-col gap-1.5 text-apoio sm:flex-row sm:flex-wrap sm:gap-x-6">
          <div className="min-w-0 flex-1">
            <p className="text-tinta-fraca">Vale quando</p>
            {condicoes.length === 0 ? (
              <p className="text-tinta-suave">Qualquer lead novo</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {condicoes.map((c) => (
                  <li key={c.rotulo} className="text-tinta-suave">
                    {c.rotulo}: <span className="text-tinta">{c.valores!.join(" ou ")}</span>
                  </li>
                ))}
              </ul>
            )}
            {dias || horario ? (
              <p className="mt-0.5 flex items-center gap-1 text-tinta-suave">
                <Clock className="size-3" aria-hidden /> {[dias ?? "todos os dias", horario ?? "o dia todo"].join(" · ")}
              </p>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-tinta-fraca">Recebe</p>
            <p className="text-tinta">{destino}</p>
            {numero ? <p className="text-tinta-suave">Atende pelo número {numero}</p> : null}
            {r.humanoDevolucaoId ? <p className="text-tinta-suave">Devolve para {nome(r.humanoDevolucaoId)}</p> : null}
          </div>
        </div>

        {r.descricao ? <p className="aj-linha-meta mt-1">{r.descricao}</p> : null}
      </div>

      <div className="aj-linha-acoes">
        <label className="flex items-center gap-1.5 text-apoio text-tinta-suave">
          <Switch checked={r.ativo} disabled={ocupado} onCheckedChange={onAlternar} aria-label={r.ativo ? `Desativar ${r.nome}` : `Ativar ${r.nome}`} />
          <span className="sr-only sm:not-sr-only">{r.ativo ? "Ativa" : "Inativa"}</span>
        </label>
        <Button variant="outline" size="icon-sm" onClick={onEditar} aria-label={`Editar ${r.nome}`}><Pencil /></Button>
        <Button variant="outline" size="icon-sm" onClick={onRemover} disabled={ocupado} aria-label={`Remover ${r.nome}`}><Trash2 /></Button>
      </div>
    </li>
  );
}

/* ── O formulário: condição de um lado, destino do outro ──────────────────── */

function Bloco({ titulo, ajuda, children }: { titulo: string; ajuda: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-inner border border-linha bg-superficie p-3">
      <legend className="px-1 text-item font-semibold text-tinta">{titulo}</legend>
      <p className="-mt-1 text-apoio text-tinta-fraca">{ajuda}</p>
      {children}
    </fieldset>
  );
}

function Erro({ children }: { children: string | null }) {
  if (!children) return null;
  /* `<p>` e não `<small>`: `.aj-campo small` pinta tudo de texto auxiliar, e
     recusa que não se distingue da dica é recusa que ninguém lê. */
  return <p role="alert" className="text-apoio font-medium text-negativo">{children}</p>;
}

function FormularioDeRegra({ form, setForm, erros, mostrarErros, opcoes, usuarios, pessoas, numerosOperacionais, rotuloNumero, salvando, onSalvar, onCancelar }: {
  form: Form;
  setForm: (f: Form) => void;
  erros: ReturnType<typeof conferir>;
  mostrarErros: boolean;
  opcoes: Opcoes;
  usuarios: { id: string; nome: string; tipo?: string | null }[];
  pessoas: { id: string; nome: string }[];
  numerosOperacionais: NumeroWa[];
  rotuloNumero: (id: string | null | undefined) => string | null;
  salvando: boolean;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const ver = (campo: keyof typeof erros) => (mostrarErros ? erros[campo] : null);

  return (
    <form
      className="flex flex-col gap-4 rounded-card bg-superficie-alt p-3.5"
      onSubmit={(e) => { e.preventDefault(); onSalvar(); }}
      aria-label={form.id ? "Editar regra de distribuição" : "Nova regra de distribuição"}
    >
      <div className="aj-campos">
        <label className="aj-campo"><span>Nome da regra</span>
          <Input
            value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex.: Campanha TRT 2026 para o time de SP"
            aria-invalid={Boolean(ver("nome"))} autoFocus
          />
          <Erro>{ver("nome")}</Erro>
        </label>
        <label className="aj-campo"><span>Prioridade</span>
          <Input
            type="number" min={0} max={1000} value={form.prioridade}
            onChange={(e) => setForm({ ...form, prioridade: Number(e.target.value) })}
          />
          <small>Número menor é avaliado primeiro. No empate, vence a regra com mais critérios preenchidos.</small>
        </label>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <Bloco
          titulo="Quando esta regra vale"
          ajuda="Campo em branco aceita qualquer valor. Preenchido, o lead precisa casar com TODOS os campos preenchidos; dentro de um campo, basta um dos valores."
        >
          <div className="flex flex-col gap-3">
            {CRITERIOS.map((c) => (
              <CampoDeCriterio
                key={c.chave} rotulo={c.rotulo} dica={c.dica}
                valores={form[c.chave]} opcoes={opcoes[c.chave] ?? []}
                onChange={(v) => setForm({ ...form, [c.chave]: v })}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1.5 border-t border-linha pt-3">
            <span className="text-apoio font-medium text-tinta">Dias e horário (opcional)</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana em que a regra vale">
              {DIAS.map((d) => {
                const on = form.diasSemana.includes(d.i);
                return (
                  <Button
                    key={d.i} type="button" size="xs" variant={on ? "default" : "outline"} aria-pressed={on}
                    onClick={() => setForm({ ...form, diasSemana: on ? form.diasSemana.filter((x) => x !== d.i) : [...form.diasSemana, d.i].sort((a, b) => a - b) })}
                  >
                    <span aria-hidden>{d.curto}</span><span className="sr-only">{d.longo}</span>
                  </Button>
                );
              })}
            </div>
            <small className="text-tinta-fraca">
              {form.diasSemana.length ? "Fora desses dias a regra não é avaliada." : "Nenhum dia marcado: vale todos os dias."}
            </small>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="aj-campo"><span>Das</span>
                <Input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} aria-invalid={Boolean(ver("horario"))} />
              </label>
              <label className="aj-campo"><span>Até</span>
                <Input type="time" value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: e.target.value })} aria-invalid={Boolean(ver("horario"))} />
              </label>
            </div>
            <Erro>{ver("horario")}</Erro>
          </div>
        </Bloco>

        <Bloco titulo="Quem recebe" ajuda="O destino do lead que casar com a condição ao lado.">
          <label className="aj-campo"><span>Tipo de destino</span>
            <NativeSelect className="w-full" value={form.alvoTipo} onChange={(e) => setForm({ ...form, alvoTipo: e.target.value as "usuario" | "rodizio" })}>
              <NativeSelectOption value="usuario">Uma pessoa ou agente de IA</NativeSelectOption>
              <NativeSelectOption value="rodizio">Rodízio entre vários</NativeSelectOption>
            </NativeSelect>
          </label>

          {form.alvoTipo === "usuario" ? (
            <label className="aj-campo"><span>Responsável</span>
              <NativeSelect
                className="w-full" value={form.alvoUsuarioId} aria-invalid={Boolean(ver("alvoUsuarioId"))}
                onChange={(e) => setForm({ ...form, alvoUsuarioId: e.target.value })}
              >
                <NativeSelectOption value="">Escolha…</NativeSelectOption>
                <OpcoesDePessoa itens={usuarios} />
              </NativeSelect>
              <Erro>{ver("alvoUsuarioId")}</Erro>
            </label>
          ) : (
            <div className="aj-campo"><span>Participantes do rodízio</span>
              {usuarios.length === 0 ? (
                <small className="text-tinta-fraca">Nenhum usuário carregado ainda.</small>
              ) : (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Participantes do rodízio">
                  {usuarios.map((u) => {
                    const on = form.rodizioUsuarioIds.includes(u.id);
                    return (
                      <Button
                        key={u.id} type="button" size="xs" variant={on ? "default" : "outline"} aria-pressed={on}
                        onClick={() => setForm({ ...form, rodizioUsuarioIds: on ? form.rodizioUsuarioIds.filter((x) => x !== u.id) : [...form.rodizioUsuarioIds, u.id] })}
                      >
                        {on ? <Check /> : null}{u.nome}{u.tipo === "agente" ? " (IA)" : ""}
                      </Button>
                    );
                  })}
                </div>
              )}
              <small>A fila anda um nome por lead, na ordem em que você marcou. Mínimo de dois.</small>
              <Erro>{ver("rodizioUsuarioIds")}</Erro>
            </div>
          )}

          <label className="aj-campo"><span>Número de atendimento</span>
            <NativeSelect className="w-full" value={form.sessaoWhatsappId} onChange={(e) => setForm({ ...form, sessaoWhatsappId: e.target.value })}>
              <NativeSelectOption value="">Nenhum fixo (segue o número do responsável)</NativeSelectOption>
              {numerosOperacionais.map((n) => (
                <NativeSelectOption key={n.id} value={n.id}>{n.label}{n.phoneNumber ? ` · ${fmtTel(n.phoneNumber)}` : ""}</NativeSelectOption>
              ))}
              {form.sessaoWhatsappId && !numerosOperacionais.some((n) => n.id === form.sessaoWhatsappId) ? (
                <NativeSelectOption value={form.sessaoWhatsappId}>{rotuloNumero(form.sessaoWhatsappId)} (fora do pool operacional)</NativeSelectOption>
              ) : null}
            </NativeSelect>
            <small>
              {numerosOperacionais.length
                ? "Só números operacionais e não privados. O lead é trabalhado por este número."
                : "Nenhum número operacional. Marque um em Ajustes > WhatsApp para ele aparecer aqui."}
            </small>
          </label>

          <label className="aj-campo"><span>Se a agente passar para humano, volta para</span>
            <NativeSelect className="w-full" value={form.humanoDevolucaoId} onChange={(e) => setForm({ ...form, humanoDevolucaoId: e.target.value })}>
              <NativeSelectOption value="">Padrão da organização</NativeSelectOption>
              {pessoas.map((u) => <NativeSelectOption key={u.id} value={u.id}>{u.nome}</NativeSelectOption>)}
            </NativeSelect>
          </label>

          <label className="aj-campo"><span>Observação (opcional)</span>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Por que esta regra existe" />
          </label>
        </Bloco>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
        <label className="flex items-center gap-2 text-apoio text-tinta-suave">
          <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
          {form.ativo ? "Ativa ao salvar" : "Salva desativada"}
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={salvando}>
            {salvando ? <Spinner aria-label="Salvando" /> : null}
            {salvando ? "Salvando…" : form.id ? "Salvar regra" : "Criar regra"}
          </Button>
        </div>
      </div>
      {mostrarErros && Object.values(erros).some(Boolean) ? (
        <p className="aj-aviso" data-tom="erro" role="alert">Falta preencher o que está marcado acima.</p>
      ) : null}
    </form>
  );
}

/* ── O campo que já sabe os valores da organização ───────────────────────── */

/**
 * Um critério da regra: vários valores, cada um um selo removível, escolhidos
 * numa lista do que a organização JÁ tem em leads (com a contagem ao lado, que
 * é o que separa a campanha real do lixo de rastreio) — e aceitando valor novo,
 * digitado, para a campanha que ainda não trouxe lead.
 *
 * `Popover` + `Command` do DS, que é o combobox do shadcn. A filtragem é nossa
 * (`shouldFilter={false}`) porque a lista precisa oferecer "usar o que foi
 * digitado" mesmo quando nada casa.
 */
function CampoDeCriterio({ rotulo, dica, valores, opcoes, onChange }: {
  rotulo: string; dica: string; valores: string[]; opcoes: ValorConhecido[]; onChange: (v: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const alvo = busca.trim();
  const filtradas = useMemo(() => {
    const q = alvo.toLowerCase();
    return q ? opcoes.filter((o) => o.valor.toLowerCase().includes(q)) : opcoes;
  }, [opcoes, alvo]);
  const jaEscolhido = (v: string) => valores.some((x) => x.toLowerCase() === v.toLowerCase());
  const podeCriar = alvo.length > 0 && !opcoes.some((o) => o.valor.toLowerCase() === alvo.toLowerCase()) && !jaEscolhido(alvo);
  const alternar = (v: string) => {
    onChange(jaEscolhido(v) ? valores.filter((x) => x.toLowerCase() !== v.toLowerCase()) : [...valores, v]);
    setBusca("");
  };

  return (
    <div className="aj-campo">
      <span>{rotulo}</span>
      {valores.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {valores.map((v) => (
            <Badge key={v} variant="secondary" className="max-w-full gap-1 pr-1">
              <span className="truncate">{v}</span>
              <button
                type="button" onClick={() => onChange(valores.filter((x) => x !== v))}
                aria-label={`Tirar ${v} de ${rotulo}`}
                className="inline-grid size-4 shrink-0 place-items-center rounded-full hover:bg-superficie-alt"
              >
                <X aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Popover open={aberto} onOpenChange={(o) => { setAberto(o); if (!o) setBusca(""); }}>
        <PopoverTrigger asChild>
          <Button
            type="button" variant="outline" size="sm" role="combobox" aria-expanded={aberto}
            aria-label={`${rotulo}: ${valores.length ? valores.join(", ") : "qualquer valor"}`}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-tinta-suave">
              {valores.length ? `${valores.length} ${valores.length === 1 ? "valor escolhido" : "valores escolhidos"} · adicionar` : "Qualquer valor · escolher"}
            </span>
            <ChevronsUpDown aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
          <Command shouldFilter={false}>
            <CommandInput value={busca} onValueChange={setBusca} placeholder={`Buscar ou cadastrar ${rotulo.toLowerCase()}…`} />
            <CommandList>
              {podeCriar ? (
                <CommandGroup heading="Ainda não existe nos leads">
                  <CommandItem value={`__novo__${alvo}`} onSelect={() => alternar(alvo)}>
                    <Plus aria-hidden /> Usar &ldquo;{alvo}&rdquo;
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {filtradas.length > 0 ? (
                <CommandGroup heading={`Já veio lead por aqui (${opcoes.length})`}>
                  {filtradas.map((o) => (
                    <CommandItem key={o.valor} value={o.valor} onSelect={() => alternar(o.valor)}>
                      <Check aria-hidden className={jaEscolhido(o.valor) ? "opacity-100" : "opacity-0"} />
                      <span className="min-w-0 flex-1 truncate">{o.valor}</span>
                      <span className="shrink-0 text-apoio tabular-nums text-tinta-fraca">{nLeads(o.leads)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <CommandEmpty>
                  {opcoes.length === 0
                    ? `Nenhum valor de ${rotulo.toLowerCase()} gravado nos leads ainda. Digite para cadastrar.`
                    : alvo
                      ? "Nada com esse texto. Continue digitando para cadastrar como valor novo."
                      : "Nada por aqui."}
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <small>{dica}</small>
    </div>
  );
}

/* ── "Para onde este lead iria?" ─────────────────────────────────────────── */

/**
 * O mesmo bloco de conferência do Roteamento comercial, com as regras daqui:
 * descreve um lead hipotético e o servidor roda `resolverPorRegra` em modo
 * simulação — sem gastar o cursor do rodízio de quem está operando.
 */
function Simulador({ opcoes, nome, rotuloNumero, temRegra }: {
  opcoes: Opcoes; nome: (id: string | null) => string; rotuloNumero: (id: string | null | undefined) => string | null; temRegra: boolean;
}) {
  const [lead, setLead] = useState<Record<string, string>>({});
  const simular = useMutation<Simulacao, Error, Record<string, string>>({
    mutationFn: async (l) => {
      const r = await fetch("/api/distribuicao-leads/simular", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(CRITERIOS.map((c) => [c.atributo, l[c.atributo]?.trim() || null]))),
      });
      if (!r.ok) throw new Error("Não foi possível simular.");
      return r.json();
    },
    onError: (e) => toast.error(e.message),
  });
  const r = simular.data?.resultado ?? null;

  return (
    <details className="rounded-inner border border-linha p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-item font-semibold text-tinta">
        <Route className="size-4" aria-hidden /> Para onde este lead iria?
      </summary>
      <p className="mt-2 text-apoio text-tinta-fraca">
        Descreva um lead e veja qual regra venceria e quem receberia. Usa as mesmas regras da distribuição real,
        sem andar a fila do rodízio.
      </p>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => { e.preventDefault(); simular.mutate(lead); }}
      >
        <div className="aj-campos">
          {CRITERIOS.map((c) => (
            <label key={c.atributo} className="aj-campo"><span>{c.rotulo}</span>
              <Input
                list={`sim-${c.atributo}`} value={lead[c.atributo] ?? ""} placeholder="Não informado"
                onChange={(e) => setLead({ ...lead, [c.atributo]: e.target.value })}
              />
              <datalist id={`sim-${c.atributo}`}>
                {(opcoes[c.chave] ?? []).map((o) => <option key={o.valor} value={o.valor}>{nLeads(o.leads)}</option>)}
              </datalist>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline" size="sm" disabled={simular.isPending}>
            {simular.isPending ? <Spinner aria-label="Simulando" /> : <Users />} Simular
          </Button>
          {Object.values(lead).some((v) => v?.trim()) ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setLead({}); simular.reset(); }}>Limpar</Button>
          ) : null}
        </div>
      </form>

      {simular.isSuccess ? (
        r ? (
          <div className="mt-3 flex flex-col gap-1 rounded-inner bg-superficie-alt p-3 text-apoio" role="status">
            <strong className="text-item text-tinta">{nome(r.responsavelId)}</strong>
            <span className="text-tinta-suave">Regra que venceu: {r.regraNome}</span>
            {r.sessaoWhatsappId ? <span className="text-tinta-suave">Atende pelo número {rotuloNumero(r.sessaoWhatsappId)}</span> : null}
            <span className="text-tinta-fraca">{r.motivo}</span>
          </div>
        ) : (
          <p className="aj-vazio mt-3" role="status">
            <strong>Nenhuma regra casaria</strong>
            <span>
              {temRegra
                ? "Este lead cairia no responsável padrão de inbound. Confira se alguma regra exige um campo que este lead não traz, ou se a regra está fora do dia e do horário de agora."
                : "Não existe regra ainda: todo lead novo vai para o responsável padrão de inbound."}
            </span>
          </p>
        )
      ) : null}
    </details>
  );
}
