"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * A peça de Atividade por cima de qualquer tela.
 *
 * verAtividade  → a GAVETA do desenho (`OnFace Atividades.dc.html`, blocos
 *                 `dt` e `ed`, ver `AtividadeDetalheDesenho`): detalhe,
 *                 subtarefas, painel lateral com comentários, @menção e anexos,
 *                 e o editor. Lê a tarefa real (`GET /api/tarefas/:id`, que já
 *                 traz subtarefas, comentários, anexos e o feed) e grava pelas
 *                 portas de `/api/tarefas/:id/...`.
 * novaAtividade / atividade → o formulário de `OnFace Atividade.dc.html`, com
 *                 o vínculo da tela (lead, empresa, oportunidade); cria pelo
 *                 POST e, em seguida, as subtarefas e os anexos digitados nele.
 *
 * A rota Hono / a porta `lib/tarefas/detalhe` validam org e dono/gestor.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useOrdemDaEquipe } from "./equipe-do-proto";
import { toast } from "sonner";

import { acaoDetalhe, acaoResponsaveis } from "@/app/(produto)/pre-vendas/actions";
import { acaoBuscarVinculos } from "@/app/(produto)/contatos/actions";
import { useRouter } from "next/navigation";
import { AtividadeLiga } from "./AtividadeLiga";
import { AtividadeDetalheLiga } from "./AtividadeDetalheLiga";
import { usePecas, type PecaProps } from "./pecas-host";
import {
  alterarTarefa, aplicarMudancas, corpoDaMudanca, corpoDaNova, criarTarefa, lerTarefa,
  excluirTarefa, itemDaTarefa, mudancasDoDetalhe, proximaDoLead,
} from "./atividade-tarefa";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const texto = (v: unknown) => (typeof v === "string" ? v : "");

const p2 = (n: number) => String(n).padStart(2, "0");

type Item = ReturnType<typeof itemDaTarefa>;

interface Carga {
  equipe: Array<{ id: string; nome: string }>;
  modo: "ver" | "nova";
  item?: Item;
  pre?: Record<string, any>;
  leads?: Array<{ id: string; empresa: string | null; pessoa: string }>;
  ids?: { leadId: string | null; empresaId: string | null; negocioId: string | null };
  doLead?: boolean;
}

/** O formulário de nova atividade (`OnFace Atividade.dc.html`). */
class AtividadePeca extends AtividadeLiga {
  _criando: Promise<string | null> | null = null;

  constructor(props: any) {
    super(props);
    const E: any = (this as any).E;
    // A criação é assíncrona: guardar a promessa deixa o fechamento esperar por ela.
    E.gravar = (patch: any) => {
      const r = (this as any).props.gravar?.(patch);
      if ((this as any).state.modo === "nova") this._criando = r;
      return r;
    };
  }

  /** O texto do aviso só sai depois que o servidor confirmar. */
  diz(t: string) { (this as any).props.avisou?.(t); }

  componentDidMount() {
    super.componentDidMount();
    (this as any).nova((this as any).props.pre ?? {});
  }

  componentDidUpdate(_: any, prev: any) {
    const s: any = (this as any).state;
    if (!prev.modo || s.modo) return;
    const criando = prev.modo === "nova" ? this._criando : null;
    this._criando = null;
    if (!criando) { (this as any).props.fechar(); return; }
    /* Falhou: o formulário volta com o que foi digitado e o motivo. */
    criando.then((erro) => {
      if (!erro) (this as any).props.fechar();
      else (this as any).setState({ modo: "nova", f: { ...prev.f, erro } });
    });
  }

}

/** Gaveta aberta: estado da atividade, fila de gravação e releitura no fim. */
function DetalheDaAtividade({ inicial, equipe, doLead, abrir, fechar, gravou }: {
  inicial: Item; equipe: Array<{ id: string; nome: string }>; doLead: boolean;
  abrir: ReturnType<typeof usePecas>["abrir"]; fechar: () => void; gravou: () => void;
}) {
  const router = useRouter();
  const [item, setItem] = React.useState<Item>(inicial);
  // A base da comparação é o item que a Liga leu neste render: duas gravações no
  // mesmo clique (marcar a subtarefa e concluir a atividade) partem da mesma base.
  const base = React.useRef(item);
  base.current = item;
  const aviso = React.useRef<string | null>(null);
  const avisou = React.useCallback((t: string) => { aviso.current = t; }, []);
  const fila = React.useRef<Promise<void>>(Promise.resolve());
  const pendentes = React.useRef(0);
  const temps = React.useRef(new Map<string, string>());
  const seq = React.useRef(0);
  const vivo = React.useRef(true);
  React.useEffect(() => () => { vivo.current = false; }, []);

  const idDoResponsavel = React.useCallback((nome: string) => equipe.find((r) => r.nome === nome)?.id, [equipe]);

  const reler = React.useCallback(async () => {
    const r = await lerTarefa(inicial.id);
    if (r.ok && vivo.current) setItem(itemDaTarefa(r.dados, doLead));
  }, [inicial.id, doLead]);

  const gravar = React.useCallback((patch: { atividadesV2?: any[]; tiposAtv?: string[] }) => {
    if (!patch?.atividadesV2) { toast("Não gravado no CRM: tipo de atividade novo."); return; }
    const antes = base.current as Record<string, any>;
    const depois = { ...patch.atividadesV2[0] };
    depois.sub = (depois.sub ?? []).map((x: any) => ({ ...x }));
    depois.comentarios = (depois.comentarios ?? []).map((x: any) => ({ ...x }));
    depois.anexos = (depois.anexos ?? []).map((x: any) => ({ ...x }));
    const { ops, naoGravado, resto } = mudancasDoDetalhe(antes, depois, () => "novo:" + ++seq.current);
    const { corpo, naoGravado: semCampo } = corpoDaMudanca(antes, resto, idDoResponsavel);
    const avisos = [...new Set([...naoGravado, ...semCampo])];
    if (avisos.length) toast(`Não gravado no CRM: ${avisos.join(", ")}.`);
    if (!ops.length && !Object.keys(corpo).length) {
      // Nada gravou: o aviso de sucesso que a Liga manda logo depois não pode sair.
      queueMicrotask(() => { aviso.current = null; });
      return;
    }

    /* Otimista: só o que vai gravar (o que não tem campo fica como estava) e só
       as chaves que ESTA gravação mudou — a outra do mesmo clique mexe nas dela. */
    const novo: Record<string, any> = { ...resto, sub: depois.sub, comentarios: depois.comentarios, anexos: depois.anexos, log: depois.log };
    const mudou = Object.keys(novo).filter((k) => JSON.stringify(novo[k]) !== JSON.stringify(antes[k]));
    setItem((cur) => ({ ...cur, ...Object.fromEntries(mudou.map((k) => [k, novo[k]])) }));

    pendentes.current++;
    fila.current = fila.current.then(async () => {
      await Promise.resolve(); // o aviso da Liga chega logo depois desta chamada
      const msg = aviso.current;
      aviso.current = null;
      const erros = await aplicarMudancas(inicial.id, ops, idDoResponsavel, temps.current);
      if (Object.keys(corpo).length) {
        const r = await alterarTarefa(inicial.id, corpo);
        if (!r.ok) erros.push(r.erro);
      }
      if (erros.length) toast.error(erros[0]);
      else if (msg) toast.success(msg);
      if (--pendentes.current === 0) { await reler(); gravou(); }
    });
  }, [inicial.id, idDoResponsavel, reler, gravou]);

  const excluir = React.useCallback(async (tarefaId: string) => {
    const r = await excluirTarefa(tarefaId);
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success("Atividade excluída");
    gravou();
    fechar();
  }, [gravou, fechar]);

  /* O editor reconstrói o vínculo procurando a oportunidade no catálogo: sem a
     da atividade ali, salvar o editor "desligaria" a oportunidade. */
  const ordenarEquipe = useOrdemDaEquipe();
  const catalogo = React.useMemo(() => ({
    EQUIPE: ordenarEquipe(equipe.map((r) => r.nome)),
    OPORTUNIDADES: inicial.oppId ? [{ id: inicial.oppId, empresa: inicial.empresa, pessoa: inicial.pessoa, etapa: "" }] : [],
    REUNIOES: [], LEADS: [], AtividadesSeed: [], ProjetosSeed: [], Projetos: [],
  }), [equipe, inicial.oppId, inicial.empresa, inicial.pessoa, ordenarEquipe]);

  return (
    <AtividadeDetalheLiga
      dados={{ atividadesV2: [item], opps: [], leads: [] }}
      catalogo={catalogo}
      chave={inicial.key}
      abrir={abrir}
      gravar={gravar}
      avisou={avisou}
      excluir={excluir}
      fechar={fechar}
      ir={(href: string) => { fechar(); router.push(href); }}
    />
  );
}

export default function AtividadePecaProto({ peca, id, contexto, fechar, gravou }: PecaProps) {
  const { abrir } = usePecas();
  const [carga, setCarga] = React.useState<Carga | null>(null);
  const aviso = React.useRef<string | null>(null);
  const avisou = React.useCallback((t: string) => { aviso.current = t; }, []);

  React.useEffect(() => {
    let vivo = true;
    const sair = (msg: string) => { if (vivo) { toast(msg, { id: "peca-atividade" }); fechar(); } };

    (async () => {
      const equipe = await acaoResponsaveis();
      if (peca === "verAtividade") {
        const chave = id ?? "";
        const doLead = chave.startsWith("l:");
        const tarefaId = doLead ? (uuid(chave.slice(2)) ? await proximaDoLead(chave.slice(2)) : null)
          : uuid(chave.startsWith("p:") ? chave.slice(2) : chave);
        if (!tarefaId) return sair(doLead ? "Este lead não tem próxima ação aberta." : "Esta atividade não é uma tarefa do CRM.");
        const r = await lerTarefa(tarefaId);
        if (!r.ok) return sair(r.erro);
        /* Ligação que veio do Callface: a tarefa é só o rastro (resumo em texto
           cru, responsável "Sistema"). O que importa é o Relatório da ligação —
           áudio, transcrição, análise e próximos passos —, que já existe. */
        const t: Record<string, any> = r.dados ?? {};
        const lead = uuid(t.lead_id) ?? uuid(t.leadId);
        if (lead && /^liga/i.test(String(t.tipo ?? "")) && /^liga[cç][aã]o/i.test(String(t.titulo ?? ""))) {
          if (vivo) { fechar(); abrir("relatorio", lead); }
          return;
        }
        if (vivo) setCarga({ equipe, modo: "ver", item: itemDaTarefa(r.dados, doLead), doLead });
        return;
      }

      // novaAtividade / atividade: o vínculo vem da tela.
      const leadId = uuid(contexto.lead) ?? uuid(contexto.leadId) ?? (peca === "atividade" ? uuid(id) : null);
      const ids = {
        leadId,
        empresaId: uuid(contexto.empresaId),
        negocioId: uuid(contexto.oppId) ?? uuid(contexto.oportunidadeId),
      };
      const pre: Record<string, any> = {
        titulo: texto(contexto.titulo), tipo: texto(contexto.tipo), data: texto(contexto.data),
        empresa: texto(contexto.empresa), pessoa: texto(contexto.pessoa), oppId: ids.negocioId ?? "",
        lead: leadId ?? "", empresaId: ids.empresaId ?? "",
      };
      let leads: Carga["leads"] = [];
      if (leadId && !pre.pessoa) {
        const r = await acaoDetalhe(leadId);
        const l = r.ok ? r.dados?.lead : null;
        if (l) {
          const empresa = l.empresa.nome !== "Empresa não informada" ? l.empresa.nome : null;
          leads = [{ id: leadId, empresa: pre.empresa || empresa, pessoa: l.pessoa.nome }];
        }
      }
      if (vivo) setCarga({ equipe, modo: "nova", pre, leads, ids });
    })().catch(() => sair("Não consegui abrir a atividade."));

    return () => { vivo = false; };
  }, [peca, id, contexto, fechar, abrir]);

  const idDoResponsavel = React.useCallback(
    (nome: string) => carga?.equipe.find((r) => r.nome === nome)?.id,
    [carga],
  );

  /* ── Nova: POST com o vínculo da tela; depois as subtarefas e os anexos do formulário. Devolve o erro ou null. ── */
  const gravar = React.useCallback(async (patch: { atividadesV2?: any[] }): Promise<string | null> => {
    const nova = patch?.atividadesV2?.at(-1);
    if (!nova || !carga?.ids) return "Nada para gravar.";
    /* O formulário carrega os ids do vínculo (da tela ou escolhidos no seletor); tirar o chip os zera. */
    const v = nova.vincIds ?? {};
    const r = await criarTarefa({
      ...corpoDaNova(nova, idDoResponsavel),
      leadId: v.leadId ?? null,
      empresaId: v.empresaId ?? null,
      negocioId: v.negocioId ?? null,
    });
    const msg = aviso.current;
    aviso.current = null;
    if (!r.ok) return r.erro;
    let n = 0;
    const { ops } = mudancasDoDetalhe({ sub: [], anexos: [] }, { sub: nova.sub ?? [], anexos: nova.anexos ?? [] }, () => "novo:" + ++n);
    const erros = await aplicarMudancas(r.dados.id, ops, idDoResponsavel, new Map());
    if (erros.length) toast.error(`Atividade criada, mas: ${erros[0]}`);
    else toast.success(msg ?? "Atividade criada");
    gravou();
    return null;
  }, [carga, idDoResponsavel, gravou]);

  const ordenarEquipe = useOrdemDaEquipe();
  const catalogo = React.useMemo(() => ({
    EQUIPE: ordenarEquipe(carga?.equipe.map((r) => r.nome) ?? []),
    LEADS: carga?.leads ?? [],
    Agenda: {
      itens: () => [],
      salvar: () => {},
      iso: (d: Date | null) => (d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : ""),
      hm: (d: (Date & { _h?: boolean }) | null) => (d && d._h ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : ""),
    },
  }), [carga, ordenarEquipe]);

  if (!carga) return null;

  if (carga.modo === "ver" && carga.item) {
    return <DetalheDaAtividade inicial={carga.item} equipe={carga.equipe} doLead={!!carga.doLead} abrir={abrir} fechar={fechar} gravou={gravou} />;
  }

  return (
    <AtividadePeca
      dados={{ atividadesV2: [], opps: [], leads: carga.leads ?? [] }}
      catalogo={catalogo}
      pre={carga.pre ?? {}}
      abrir={abrir}
      gravar={gravar}
      buscarVinculos={acaoBuscarVinculos}
      avisou={avisou}
      fechar={fechar}
      ir={() => {}}
    />
  );
}
