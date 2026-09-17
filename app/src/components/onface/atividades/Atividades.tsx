"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowUpRight, BellPlus, Building2, Calendar, CalendarClock, Check,
  ChevronRight, Circle, CircleAlert, CircleCheck, CircleDotDashed,
  CirclePause, CircleSlash, Clock, Columns3, FileText, Flag, Inbox, Layers,
  LayoutList, Plus, Search, Sparkles, User, X
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { OnfacePage, OnfacePageBand, OnfacePageSurface } from "../shell/OnfacePage";
import type {
  Atividade, ContatoOpcao, DadosAtividades, EmpresaOpcao, GrupoPrazo,
  NegocioOpcao, NovaAtividade, PrioridadeAtividade, StatusAtividade,
} from "./types";
import "../visao-geral/visao-geral.css";
import "./atividades.css";

/* A página herda o CSS da Visão Geral de propósito: moldura, selos, cartões e
 * painel lateral são os mesmos do resto do ONFACE. Só o que é próprio da tela
 * (filtros, kanban, formulário) tem estilo aqui. */

export interface AcoesAtividades {
  mudarStatus: (id: string, status: StatusAtividade) => Promise<{ ok: boolean; erro?: string }>;
  buscarEmpresas: (termo: string) => Promise<EmpresaOpcao[]>;
  buscarContatos: (empresaId: string) => Promise<ContatoOpcao[]>;
  buscarNegocios: (empresaId: string) => Promise<NegocioOpcao[]>;
  responsaveis: () => Promise<Array<{ id: string; nome: string }>>;
  criar: (dados: NovaAtividade) => Promise<{ ok: boolean; erro?: string; id?: string }>;
  alternarConclusao: (id: string, concluir: boolean) => Promise<{ ok: boolean; erro?: string }>;
}

const ROTULO_PRIORIDADE: Record<PrioridadeAtividade, string> = {
  alta: "Alta", media: "Média", baixa: "Baixa",
};

/** Estado do trabalho, não do prazo. A ordem é a do fluxo real. */
const STATUS: Array<{ valor: StatusAtividade; label: string }> = [
  { valor: "a_fazer", label: "A fazer" },
  { valor: "em_andamento", label: "Em andamento" },
  { valor: "aguardando", label: "Aguardando retorno" },
  { valor: "concluida", label: "Concluída" },
  { valor: "declinada", label: "Declinada" },
];

const ROTULO_STATUS = Object.fromEntries(STATUS.map((s) => [s.valor, s.label])) as Record<StatusAtividade, string>;

/* Ícone por estado, na convenção que ferramenta de trabalho usa: o círculo
 * conta o progresso sem depender de ler o rótulo. */
const ICONE_STATUS = {
  a_fazer: Circle,
  em_andamento: CircleDotDashed,
  aguardando: CirclePause,
  concluida: CircleCheck,
  declinada: CircleSlash,
} as const;

/** Seletor de status. Aparece na linha, no cartão do kanban e no resumo,
 * porque mudar o estado é a ação mais frequente da tela e não deveria exigir
 * abrir nada. */
function SeletorStatus({
  valor, ocupado, aoMudar, compacto,
}: {
  valor: StatusAtividade;
  ocupado: boolean;
  aoMudar: (novo: StatusAtividade) => void;
  compacto?: boolean;
}) {
  const Icone = ICONE_STATUS[valor];
  return (
    <span className="atv-status" data-status={valor} data-compacto={compacto ?? false}>
      <Icone className="atv-status-icone" size={13} strokeWidth={2} aria-hidden />
      <select
        value={valor}
        disabled={ocupado}
        aria-label="Status da atividade"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => aoMudar(e.target.value as StatusAtividade)}
      >
        {STATUS.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}
      </select>
    </span>
  );
}

const ICONE_VINCULO = {
  Cliente: Building2,
  Lead: User,
  "Negócio": Sparkles,
  Entrega: CalendarClock,
  Avulsa: Inbox,
} as const;

const TIPOS_ATIVIDADE = [
  { valor: "lembrete", label: "Lembrete" },
  { valor: "ligacao", label: "Ligação" },
  { valor: "reuniao", label: "Reunião" },
  { valor: "email", label: "E-mail" },
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "follow_up", label: "Follow-up" },
  { valor: "interna", label: "Tarefa interna" },
];

function SeloVinculo({ atividade }: { atividade: Atividade }) {
  const Icone = ICONE_VINCULO[atividade.vinculo.tipo] ?? Inbox;
  return (
    <span className="atv-vinculo" title={`${atividade.vinculo.tipo}: ${atividade.vinculo.nome}`}>
      <span className="atv-vinculo-icone" aria-hidden><Icone size={14} strokeWidth={1.9} /></span>
      <span className="atv-vinculo-texto">
        <span className="atv-vinculo-nome">{atividade.vinculo.nome}</span>
        <span className="atv-vinculo-apoio">{atividade.vinculo.apoio}</span>
      </span>
    </span>
  );
}

function SeloPrazo({ atividade }: { atividade: Atividade }) {
  return (
    <span className="atv-prazo" data-tom={atividade.prazoTom}>
      <Calendar size={12} strokeWidth={2} aria-hidden />
      {atividade.prazoTexto}
    </span>
  );
}

/* ── Formulário de criação ──────────────────────────────────────────────
 * Empresa primeiro, pessoa depois. No ONFACE quem entra em pré-vendas é a
 * empresa; a pessoa é o contato dentro dela, e pode ser um lead ou o contato
 * de uma conta que já é cliente. */
function JanelaNovaAtividade({
  acoes, aoFechar, aoCriar, modo,
}: {
  acoes: AcoesAtividades;
  aoFechar: () => void;
  aoCriar: () => void;
  modo: "atividade" | "lembrete";
}) {
  const [termo, setTermo] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaOpcao[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaOpcao | null>(null);
  const [contatos, setContatos] = useState<ContatoOpcao[]>([]);
  const [negocios, setNegocios] = useState<NegocioOpcao[]>([]);
  const [responsaveis, setResponsaveis] = useState<Array<{ id: string; nome: string }>>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciarSalvamento] = useTransition();

  const [form, setForm] = useState<NovaAtividade>({
    empresaId: "", contatoId: null, negocioId: null,
    titulo: "", descricao: "",
    tipo: modo === "lembrete" ? "lembrete" : "follow_up",
    prioridade: "media",
    // Lembrete nasce com data de hoje: é o que faz dele lembrete.
    vencimento: modo === "lembrete" ? new Date().toISOString().slice(0, 10) : null,
    responsavelId: null,
  });

  // Abrir com a lista vazia obriga a adivinhar o nome. As primeiras da base já
  // aparecem, e a busca refina.
  useEffect(() => {
    let vivo = true;
    acoes.buscarEmpresas("").then((lista) => { if (vivo) setEmpresas(lista); });
    return () => { vivo = false; };
  }, [acoes]);

  const procurar = async (valor: string) => {
    setTermo(valor);
    setBuscando(true);
    try {
      setEmpresas(await acoes.buscarEmpresas(valor));
    } finally {
      setBuscando(false);
    }
  };

  const escolherEmpresa = async (opcao: EmpresaOpcao) => {
    setEmpresa(opcao);
    setForm((f) => ({ ...f, empresaId: opcao.id, contatoId: null, negocioId: null }));
    const [c, n, r] = await Promise.all([
      acoes.buscarContatos(opcao.id),
      acoes.buscarNegocios(opcao.id),
      responsaveis.length ? Promise.resolve(responsaveis) : acoes.responsaveis(),
    ]);
    setContatos(c);
    setNegocios(n);
    setResponsaveis(r);
  };

  const salvar = (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro(null);
    iniciarSalvamento(async () => {
      const resultado = await acoes.criar(form);
      if (resultado.ok) {
        aoCriar();
        aoFechar();
      } else {
        setErro(resultado.erro ?? "Não consegui gravar a atividade.");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <DialogContent className="ovg-janela atv-janela" showCloseButton={false}>
        <DialogHeader className="ovg-janela-head">
          <div>
            <DialogTitle className="ovg-janela-titulo">
              {modo === "lembrete" ? "Novo lembrete" : "Nova atividade"}
            </DialogTitle>
            <DialogDescription className="ovg-janela-sub">
              {modo === "lembrete"
                ? "Um lembrete é uma atividade com data. Escolha a empresa e o que precisa lembrar."
                : "Toda atividade pertence a uma empresa. Escolha a empresa e depois a pessoa."}
            </DialogDescription>
          </div>
          <button type="button" className="ovg-fechar" onClick={aoFechar} aria-label="Fechar">
            <X size={15} strokeWidth={2} aria-hidden />
          </button>
        </DialogHeader>

        {!empresa ? (
          <div className="atv-busca-empresa">
            <label className="atv-campo-busca">
              <Search size={15} strokeWidth={2} aria-hidden />
              <input
                autoFocus
                value={termo}
                onChange={(e) => procurar(e.target.value)}
                placeholder="Buscar empresa pelo nome"
                aria-label="Buscar empresa"
              />
            </label>

            <div className="atv-lista-empresas">
              {buscando && !empresas.length ? <p className="ovg-janela-nota">Procurando…</p> : null}
              {!buscando && !empresas.length ? (
                <p className="ovg-janela-nota">
                  {termo ? "Nenhuma empresa com esse nome." : "Digite para buscar, ou veja as primeiras da base."}
                </p>
              ) : null}
              {empresas.map((opcao) => (
                <button key={opcao.id} type="button" className="atv-opcao" onClick={() => escolherEmpresa(opcao)}>
                  <span className="ovg-avatar-mini">{opcao.nome.slice(0, 2).toUpperCase()}</span>
                  <span className="atv-opcao-corpo">
                    <span className="atv-opcao-nome">{opcao.nome}</span>
                    <span className="atv-opcao-apoio">{opcao.apoio || "Sem setor informado"}</span>
                  </span>
                  <span className="ovg-selo" data-estado={opcao.ehCliente ? "concluida" : "andamento"}>
                    {opcao.ehCliente ? "Cliente" : "Prospect"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="ovg-janela-form" onSubmit={salvar}>
            <div className="atv-empresa-escolhida">
              <span className="ovg-vinculo-tipo">{empresa.ehCliente ? "Cliente" : "Prospect"}</span>
              <span className="ovg-vinculo-nome">{empresa.nome}</span>
              <button type="button" className="ovg-ghost-btn" onClick={() => { setEmpresa(null); setEmpresas([]); setTermo(""); }}>
                Trocar empresa
              </button>
            </div>

            <div className="atv-form-linha">
              <label>
                Pessoa
                <select
                  value={form.contatoId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, contatoId: e.target.value || null }))}
                >
                  <option value="">Sem pessoa específica</option>
                  {contatos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}{c.cargo ? ` · ${c.cargo}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Negócio
                <select
                  value={form.negocioId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, negocioId: e.target.value || null }))}
                >
                  <option value="">Sem negócio vinculado</option>
                  {negocios.map((n) => (
                    <option key={n.id} value={n.id}>{n.titulo}</option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Título
              <input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="O que precisa ser feito"
              />
            </label>

            <label>
              Descrição
              <input
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Contexto para quem for executar"
              />
            </label>

            <div className="atv-form-linha">
              <label>
                Tipo
                <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_ATIVIDADE.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                </select>
              </label>
              <label>
                Prioridade
                <select
                  value={form.prioridade}
                  onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value as PrioridadeAtividade }))}
                >
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </label>
            </div>

            <div className="atv-form-linha">
              <label>
                Vencimento
                <input
                  type="date"
                  value={form.vencimento ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value || null }))}
                />
              </label>
              <label>
                Responsável
                <select
                  value={form.responsavelId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, responsavelId: e.target.value || null }))}
                >
                  <option value="">Eu mesmo</option>
                  {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </label>
            </div>

            {erro ? <p className="atv-erro">{erro}</p> : null}

            <div className="ovg-janela-acoes">
              <button type="submit" className="ovg-acao-btn" disabled={salvando || !form.titulo.trim()}>
                {salvando ? "Gravando…" : "Criar atividade"}
              </button>
              <button type="button" className="ovg-ghost-btn" onClick={aoFechar}>Cancelar</button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Painel lateral ─────────────────────────────────────────────────────
 * Mesmo padrão de Pendências: a tabela cede espaço em vez de trocar de página. */
/** Resumo da atividade.
 *
 * Denso de propósito: quem abre isto quer decidir em três segundos. Título em
 * corpo de leitura, o estado logo abaixo porque é o que mais muda, o vínculo
 * em bloco próprio porque é o contexto, e os campos em pares com rótulo
 * pequeno. Nada aqui usa tamanho de manchete. */
function ResumoAtividade({
  atividade, aoFechar, aoMudarStatus, ocupado,
}: {
  atividade: Atividade;
  aoFechar: () => void;
  aoMudarStatus: (status: StatusAtividade) => void;
  ocupado: boolean;
}) {
  const Icone = ICONE_VINCULO[atividade.vinculo.tipo] ?? Inbox;

  const campos = [
    { icone: Calendar, label: "Vencimento", valor: atividade.vencimentoTexto },
    { icone: Clock, label: "Prazo", valor: atividade.prazoTexto, tom: atividade.prazoTom },
    { icone: User, label: "Responsável", valor: atividade.responsavel ?? "Sem responsável" },
    { icone: Flag, label: "Prioridade", valor: ROTULO_PRIORIDADE[atividade.prioridade] },
    { icone: Layers, label: "Jornada", valor: atividade.jornada },
    { icone: FileText, label: "Tipo", valor: atividade.tipo.replace(/_/g, " ") },
  ];

  return (
    <aside className="atv-resumo">
      <header className="atv-resumo-head">
        <span className="atv-resumo-eyebrow">Resumo da atividade</span>
        <button type="button" className="atv-resumo-fechar" onClick={aoFechar} aria-label="Fechar resumo">
          <X size={14} strokeWidth={2.2} aria-hidden />
        </button>
      </header>

      <h3 className="atv-resumo-titulo">{atividade.titulo}</h3>
      {atividade.descricao ? <p className="atv-resumo-desc">{atividade.descricao}</p> : null}

      <div className="atv-resumo-status">
        <span className="atv-resumo-rotulo">Status</span>
        <SeletorStatus valor={atividade.status} ocupado={ocupado} aoMudar={aoMudarStatus} />
      </div>

      <Link className="atv-resumo-vinculo" href={atividade.vinculo.href}>
        <span className="atv-vinculo-icone" aria-hidden><Icone size={15} strokeWidth={1.9} /></span>
        <span className="atv-resumo-vinculo-texto">
          <span className="atv-resumo-vinculo-tipo">{atividade.vinculo.tipo}</span>
          <span className="atv-resumo-vinculo-nome">{atividade.vinculo.nome}</span>
          <span className="atv-resumo-vinculo-apoio">{atividade.vinculo.apoio}</span>
        </span>
        <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
      </Link>

      <dl className="atv-resumo-campos">
        {campos.map((campo) => {
          const IconeCampo = campo.icone;
          return (
            <div key={campo.label}>
              <dt>
                <IconeCampo size={12} strokeWidth={2} aria-hidden />
                {campo.label}
              </dt>
              <dd data-tom={campo.tom ?? "neutro"}>{campo.valor}</dd>
            </div>
          );
        })}
      </dl>

      <div className="atv-resumo-acoes">
        {atividade.status !== "concluida" ? (
          <button type="button" className="atv-btn-principal" onClick={() => aoMudarStatus("concluida")} disabled={ocupado}>
            <Check size={14} strokeWidth={2.4} aria-hidden />
            Concluir
          </button>
        ) : (
          <button type="button" className="atv-btn-secundario" onClick={() => aoMudarStatus("a_fazer")} disabled={ocupado}>
            Reabrir
          </button>
        )}
        <Link className="atv-btn-secundario" href={atividade.vinculo.href}>
          Abrir {atividade.vinculo.tipo.toLowerCase()} completo
          <ArrowUpRight size={13} strokeWidth={2} aria-hidden />
        </Link>
      </div>

      <p className="atv-resumo-rodape">
        Criada em {atividade.criadaEm}{atividade.automatica ? " por uma régua automática" : " manualmente"}
        {atividade.concluidaEm ? ` · concluída em ${atividade.concluidaEm}` : ""}
      </p>
    </aside>
  );
}

export function Atividades({ dados, acoes }: { dados: DadosAtividades; acoes: AcoesAtividades }) {
  const [visao, setVisao] = useState<"tabela" | "kanban">("tabela");
  const [busca, setBusca] = useState("");
  const [jornada, setJornada] = useState("todas");
  const [responsavel, setResponsavel] = useState("todos");
  const [vencimento, setVencimento] = useState("todas");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [modoCriacao, setModoCriacao] = useState<"atividade" | "lembrete">("atividade");
  // Só "Hoje" abre sozinho. Abrir tudo transforma a fila num paredão de
  // trezentas linhas, que é o oposto de saber o que fazer agora.
  const [gruposAbertos, setGruposAbertos] = useState<GrupoPrazo[]>(["hoje"]);
  const [ocupado, iniciar] = useTransition();
  // `revalidatePath` invalida o cache do servidor, mas quem está montado
  // continua com os dados antigos até pedir para recarregar.
  const router = useRouter();

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return dados.atividades.filter((a) => {
      if (termo && !`${a.titulo} ${a.descricao} ${a.vinculo.nome}`.toLowerCase().includes(termo)) return false;
      if (jornada !== "todas" && a.jornada !== jornada) return false;
      if (responsavel === "sem-dono" && a.responsavel) return false;
      if (responsavel !== "todos" && responsavel !== "sem-dono" && a.responsavel !== responsavel) return false;
      if (vencimento === "atrasadas" && a.grupoPrazo !== "atrasada") return false;
      if (vencimento === "hoje" && a.grupoPrazo !== "hoje") return false;
      if (vencimento === "sem-data" && a.vencimento) return false;
      if (vencimento === "semana" && a.grupoPrazo !== "semana" && a.grupoPrazo !== "hoje") return false;
      return true;
    });
  }, [dados.atividades, busca, jornada, responsavel, vencimento]);

  const ativa = visiveis.find((a) => a.id === selecionada) ?? null;

  const porColuna = (chave: StatusAtividade) => visiveis.filter((a) => a.status === chave);
  const porGrupo = (chave: GrupoPrazo) => visiveis.filter((a) => a.grupoPrazo === chave);

  const alternarGrupo = (chave: GrupoPrazo) =>
    setGruposAbertos((atual) =>
      atual.includes(chave) ? atual.filter((g) => g !== chave) : [...atual, chave],
    );

  const mudarStatus = (id: string, status: StatusAtividade) => {
    iniciar(async () => {
      await acoes.mudarStatus(id, status);
      router.refresh();
    });
  };

  const cartoes = [
    { chave: "abertas", label: "Abertas", apoio: "Em andamento na operação", valor: dados.resumo.abertas, icone: LayoutList, tom: "neutro" as const },
    { chave: "atrasadas", label: "Atrasadas", apoio: "Precisam de atenção", valor: dados.resumo.atrasadas, icone: CircleAlert, tom: "alerta" as const },
    { chave: "hoje", label: "Vencem hoje", apoio: "Com prazo para hoje", valor: dados.resumo.vencemHoje, icone: Calendar, tom: "coral" as const },
    { chave: "sem-dono", label: "Sem responsável", apoio: "Aguardando atribuição", valor: dados.resumo.semResponsavel, icone: User, tom: "neutro" as const },
    { chave: "concluidas", label: "Concluídas no mês", apoio: "Atividades finalizadas", valor: dados.resumo.concluidasNoMes, icone: Check, tom: "ok" as const },
  ];

  return (
    <OnfacePage className="ovg">
      <OnfacePageBand className="ovg-hero atv-hero">
        <div className="atv-cabecalho">
          <div>
            <p className="atv-eyebrow">Operação</p>
            <h1 className="ovg-greeting-title">{dados.titulo}</h1>
            <p className="ovg-greeting-date">{dados.subtitulo}</p>
          </div>
          <div className="atv-acoes-topo">
            {/* Lembrete é a mesma atividade com tipo e prazo de hoje: um atalho
                para o caso mais comum, não outra entidade. */}
            <button type="button" className="ovg-ghost-btn" onClick={() => { setModoCriacao("lembrete"); setCriando(true); }}>
              <BellPlus size={14} strokeWidth={2} aria-hidden />
              Novo lembrete
            </button>
            <button type="button" className="ovg-cta" onClick={() => { setModoCriacao("atividade"); setCriando(true); }}>
              <Plus size={15} strokeWidth={2.5} aria-hidden />
              Nova atividade
            </button>
          </div>
        </div>

        <div className="atv-cartoes">
          {cartoes.map((c) => {
            const Icone = c.icone;
            return (
              <article key={c.chave} className="atv-cartao" data-tom={c.tom}>
                <span className="atv-cartao-icone" aria-hidden><Icone size={17} strokeWidth={2} /></span>
                <p className="atv-cartao-valor">{c.valor}</p>
                <p className="atv-cartao-label">{c.label}</p>
                <p className="atv-cartao-apoio">{c.apoio}</p>
              </article>
            );
          })}
        </div>
      </OnfacePageBand>

      <OnfacePageSurface className="ovg-board atv-board" id="atividades" sobreposto>
        <div className="atv-filtros">
          <label className="atv-campo-busca">
            <Search size={15} strokeWidth={2} aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por atividade, empresa ou contexto"
              aria-label="Buscar atividade"
            />
          </label>

          <label className="atv-select">
            <span>Jornada</span>
            <select value={jornada} onChange={(e) => setJornada(e.target.value)}>
              {dados.filtrosJornada.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </label>

          <label className="atv-select">
            <span>Responsável</span>
            <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              {dados.filtrosResponsavel.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </label>

          {/* Vencimento é data, não SLA: o que a operação pergunta é "vence
              quando", não "qual o acordo de nível de serviço". */}
          <label className="atv-select">
            <span>Vencimento</span>
            <select value={vencimento} onChange={(e) => setVencimento(e.target.value)}>
              {dados.filtrosVencimento.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </label>

          <div className="atv-visao" role="group" aria-label="Forma de visualizar">
            <button type="button" data-ativo={visao === "tabela"} onClick={() => setVisao("tabela")} aria-label="Ver em tabela">
              <LayoutList size={15} strokeWidth={2} aria-hidden />
            </button>
            <button type="button" data-ativo={visao === "kanban"} onClick={() => setVisao("kanban")} aria-label="Ver em kanban">
              <Columns3 size={15} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>

        {visao === "tabela" ? (
          <div className="ovg-pendencias" data-aberto={ativa !== null}>
            <section className="ovg-card ovg-pend-tabela">
              <div className="atv-head" aria-hidden>
                <span>Atividade</span>
                <span>Vínculo</span>
                <span>Responsável</span>
                <span>Vencimento</span>
                <span>Status</span>
              </div>

              {/* Agrupada por prazo: é assim que a fila é lida na prática.
                  O que estourou primeiro, depois hoje, depois a semana. */}
              <div className="ovg-pend-linhas">
                {visiveis.length === 0 ? (
                  <p className="ovg-empty">Nenhuma atividade com esses filtros.</p>
                ) : (
                  dados.grupos.map((grupo) => {
                    const itens = porGrupo(grupo.chave);
                    if (!itens.length) return null;
                    const aberto = gruposAbertos.includes(grupo.chave);
                    return (
                      <section key={grupo.chave} className="atv-grupo" data-grupo={grupo.chave} data-aberto={aberto}>
                        <button
                          type="button"
                          className="atv-grupo-head"
                          onClick={() => alternarGrupo(grupo.chave)}
                          aria-expanded={aberto}
                        >
                          <ChevronRight className="atv-grupo-seta" size={14} strokeWidth={2.4} aria-hidden />
                          <span className="atv-grupo-titulo">{grupo.label}</span>
                          <span className="atv-grupo-contador">{itens.length}</span>
                          <span className="atv-grupo-apoio">{grupo.apoio}</span>
                        </button>

                        {aberto ? itens.map((a) => (
                          <div key={a.id} className="ovg-pend-linha" data-selected={a.id === selecionada}>
                            <button
                              type="button"
                              className="atv-linha"
                              onClick={() => setSelecionada(a.id === selecionada ? null : a.id)}
                              aria-expanded={a.id === selecionada}
                            >
                              <span className="ovg-pend-item">
                                <span className="ovg-pend-titulo" data-concluida={a.status === "concluida" || a.status === "declinada"}>
                                  {a.titulo}
                                </span>
                                <span className="ovg-pend-desc">{a.descricao || a.tipo.replace(/_/g, " ")}</span>
                              </span>
                              <span><SeloVinculo atividade={a} /></span>
                              <span className="ovg-pend-dono">
                                {a.responsavelIniciais ? (
                                  <>
                                    <span className="ovg-avatar-mini">{a.responsavelIniciais}</span>
                                    {a.responsavel}
                                  </>
                                ) : (
                                  <span className="ovg-sem-dono">Sem responsável</span>
                                )}
                              </span>
                              <span><SeloPrazo atividade={a} /></span>
                            </button>
                            <SeletorStatus
                              valor={a.status}
                              ocupado={ocupado}
                              aoMudar={(novo) => mudarStatus(a.id, novo)}
                            />
                          </div>
                        )) : null}
                      </section>
                    );
                  })
                )}
              </div>

              <footer className="ovg-table-foot">
                <span className="ovg-table-contagem">
                  {visiveis.length} de {dados.atividades.length} atividades
                </span>
              </footer>
            </section>

            {ativa ? (
              <ResumoAtividade
                atividade={ativa}
                ocupado={ocupado}
                aoFechar={() => setSelecionada(null)}
                aoMudarStatus={(novo) => mudarStatus(ativa.id, novo)}
              />
            ) : null}
          </div>
        ) : (
          <div className="atv-kanban-wrap" data-aberto={ativa !== null}>
            <div className="atv-kanban">
            {dados.colunas.map((coluna) => {
              const itens = porColuna(coluna.chave);
              return (
                <section key={coluna.chave} className="atv-coluna" data-coluna={coluna.chave}>
                  <header className="atv-coluna-head">
                    <span className="atv-coluna-marca" aria-hidden />
                    <span className="atv-coluna-titulo">{coluna.label}</span>
                    <span className="atv-coluna-contador">{itens.length}</span>
                  </header>

                  <div className="atv-coluna-corpo">
                    {itens.length === 0 ? (
                      <p className="atv-coluna-vazia">{coluna.apoio}</p>
                    ) : (
                      itens.map((a) => (
                        <article key={a.id} className="atv-cartao-kanban" data-prioridade={a.prioridade}>
                          {/* Clicar abre o resumo ao lado, sem trocar de visão:
                              tirar a pessoa do kanban a cada clique era o
                              comportamento errado. */}
                          <button
                            type="button"
                            className="atv-cartao-abrir"
                            onClick={() => setSelecionada(a.id === selecionada ? null : a.id)}
                            aria-expanded={a.id === selecionada}
                          >
                            <span className="atv-cartao-titulo">{a.titulo}</span>
                            <span className="atv-cartao-vinculo">
                              {a.vinculo.tipo} · {a.vinculo.nome}
                            </span>
                          </button>

                          <div className="atv-cartao-rodape">
                            <SeloPrazo atividade={a} />
                            {a.responsavelIniciais ? (
                              <span className="ovg-avatar-mini" title={a.responsavel ?? ""}>{a.responsavelIniciais}</span>
                            ) : (
                              <span className="ovg-sem-dono">Sem dono</span>
                            )}
                          </div>

                          <SeletorStatus
                            valor={a.status}
                            ocupado={ocupado}
                            compacto
                            aoMudar={(novo) => mudarStatus(a.id, novo)}
                          />
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
            </div>

            {/* Mesmo padrão da tabela: o quadro cede espaço e o resumo abre ao
                lado, sem tirar a pessoa do kanban. */}
            {ativa ? (
              <ResumoAtividade
                atividade={ativa}
                ocupado={ocupado}
                aoFechar={() => setSelecionada(null)}
                aoMudarStatus={(novo) => mudarStatus(ativa.id, novo)}
              />
            ) : null}
          </div>
        )}
      </OnfacePageSurface>

      {criando ? (
        <JanelaNovaAtividade
          modo={modoCriacao}
          acoes={acoes}
          aoFechar={() => setCriando(false)}
          aoCriar={() => { setSelecionada(null); router.refresh(); }}
        />
      ) : null}
    </OnfacePage>
  );
}
