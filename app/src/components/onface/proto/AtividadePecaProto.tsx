"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * A peça de Atividade (`OnFace Atividade.dc.html`) por cima de qualquer tela.
 *
 * verAtividade  → lê a tarefa real (`GET /api/tarefas/:id`) e entrega à Liga
 *                 pela `Agenda` que ela consome; cada mudança vira PATCH.
 * novaAtividade / atividade → abre o formulário com o vínculo da tela
 *                 (lead, empresa, oportunidade) e cria pelo POST.
 *
 * A rota Hono é quem valida org e dono/gestor. Subtarefa, comentário e anexo
 * não existem no domínio: o desenho os traz em markup fixo, então são
 * escondidos por CSS em vez de aceitar digitação que não grava.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { toast } from "sonner";

import { acaoDetalhe, acaoResponsaveis } from "@/app/(produto)/pre-vendas/actions";
import { acaoBuscarVinculos } from "@/app/(produto)/contatos/actions";
import { AtividadeLiga } from "./AtividadeLiga";
import { usePecas, type PecaProps } from "./pecas-host";
import {
  TIPO_DO_DESENHO, alterarTarefa, corpoDaMudanca, corpoDaNova, criarTarefa, lerTarefa,
  excluirTarefa, prazoDoBanco, prioridadeDoBanco, proximaDoLead, situacaoDoBanco, tipoDoBanco, type CorpoTarefa,
} from "./atividade-tarefa";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const texto = (v: unknown) => (typeof v === "string" ? v : "");

/* O que o domínio não tem: some da tela em vez de fingir que grava. */
const SEM_DOMINIO = `
[data-peca-atividade] label[title="Anexar arquivo"],
[data-peca-atividade] span:has(+ label[title="Anexar arquivo"]),
[data-peca-atividade] div:has(> div > input[placeholder^="Nova subtarefa"]),
[data-peca-atividade] div:has(+ div > div > input[placeholder^="Nova subtarefa"]),
[data-peca-atividade] div:has(> div > textarea[placeholder="Escreva um comentário"]),
[data-peca-atividade] span:has(+ div > div > textarea[placeholder="Escreva um comentário"]) { display: none !important; }
`;

const p2 = (n: number) => String(n).padStart(2, "0");

/** fimD/fimH → Date com a marca `_h` que a Liga usa para saber se há hora. */
function quandoDe(fimD: string, fimH: string): (Date & { _h?: boolean }) | null {
  if (!fimD) return null;
  const [a, m, d] = fimD.split("-").map(Number);
  const x: Date & { _h?: boolean } = new Date(a, m - 1, d);
  if (fimH) { const [h, mi] = fimH.split(":").map(Number); x.setHours(h, mi); x._h = true; } else x.setHours(23, 59);
  return x;
}

/** A tarefa da rota na forma do item da Agenda do protótipo. */
function itemDaTarefa(t: Record<string, any>, doLead: boolean) {
  const { fimD, fimH } = prazoDoBanco(t.venceEm, t.dataVencimento);
  const pessoa = [t.leadNome, t.leadSobrenome].filter(Boolean).join(" ");
  return {
    key: "p:" + t.id, src: "p", id: t.id,
    titulo: t.titulo ?? "", desc: t.descricao ?? "",
    tipo: tipoDoBanco(t.tipo), situacao: situacaoDoBanco(t.status), prioridade: prioridadeDoBanco(t.prioridade),
    resp: t.responsavelNome ?? null, assignees: t.responsavelNome ? [t.responsavelNome] : [],
    empresa: t.empresaNome ?? null, pessoa: pessoa || null,
    fimD, fimH, quando: quandoDe(fimD, fimH), sub: [], comentarios: [],
    origemTxt: doLead ? "Próxima ação do lead" : t.negocioTitulo ? "Da oportunidade " + t.negocioTitulo : "Atividade",
  };
}

interface Carga {
  equipe: Array<{ id: string; nome: string }>;
  modo: "ver" | "nova";
  item?: ReturnType<typeof itemDaTarefa>;
  pre?: Record<string, any>;
  leads?: Array<{ id: string; empresa: string | null; pessoa: string }>;
  ids?: { leadId: string | null; empresaId: string | null; negocioId: string | null };
}

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
    const p = (this as any).props.pedido;
    if (p.modo === "nova") (this as any).nova(p.pre);
    else (this as any).setState({ modo: "ver", key: p.key, com: "", novaSub: "" });
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

  renderVals() {
    const v: any = super.renderVals();
    if (v.nv?.aberto) v.nv.tipos = v.nv.tipos.filter((t: string) => TIPO_DO_DESENHO[t]);
    if (v.vr?.aberto) v.vr.origem = (this as any).props.catalogo.Agenda.itens()[0]?.origemTxt ?? v.vr.origem;
    return v;
  }

  render() {
    return (
      <div data-peca-atividade="" style={{ display: "contents" }}>
        {super.render()}
        <style>{SEM_DOMINIO}</style>
      </div>
    );
  }
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
        if (vivo) setCarga({ equipe, modo: "ver", item: itemDaTarefa(r.dados, doLead) });
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
  }, [peca, id, contexto, fechar]);

  const idDoResponsavel = React.useCallback(
    (nome: string) => carga?.equipe.find((r) => r.nome === nome)?.id,
    [carga],
  );

  /* ── Ver: mudanças otimistas, PATCH agrupado (o título grava a cada tecla). ── */
  const pendente = React.useRef<CorpoTarefa>({});
  const relogio = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const descarregar = React.useCallback(async () => {
    relogio.current = null;
    const item = carga?.item;
    const corpo = pendente.current;
    pendente.current = {};
    if (!item || !Object.keys(corpo).length) return;
    const r = await alterarTarefa(item.id, corpo);
    const msg = aviso.current;
    aviso.current = null;
    if (!r.ok) {
      toast.error(r.erro);
      const de = await lerTarefa(item.id);
      if (de.ok) setCarga((c) => (c ? { ...c, item: itemDaTarefa(de.dados, c.item?.origemTxt === "Próxima ação do lead") } : c));
      return;
    }
    if (msg) toast.success(msg);
    gravou();
  }, [carga, gravou]);

  // Fechou com título pendente: grava antes de sair.
  const descarregarRef = React.useRef(descarregar);
  React.useEffect(() => { descarregarRef.current = descarregar; }, [descarregar]);
  React.useEffect(() => () => { if (relogio.current) { clearTimeout(relogio.current); void descarregarRef.current(); } }, []);

  const salvar = React.useCallback((_: any, patch: Record<string, any>) => {
    const item = carga?.item;
    if (!item) return;
    const depois = { ...item, ...patch };
    const { corpo, naoGravado } = corpoDaMudanca(item, depois, idDoResponsavel);
    if (naoGravado.length) toast(`Não gravado no CRM: ${naoGravado.join(", ")}.`);
    if (!Object.keys(corpo).length) return;
    depois.quando = quandoDe(depois.fimD, depois.fimH);
    setCarga((c) => (c ? { ...c, item: depois } : c));
    pendente.current = { ...pendente.current, ...corpo };
    if (relogio.current) clearTimeout(relogio.current);
    const soTitulo = Object.keys(corpo).every((k) => k === "titulo");
    relogio.current = setTimeout(() => { void descarregar(); }, soTitulo ? 600 : 0);
  }, [carga, idDoResponsavel, descarregar]);

  /* ── Nova: POST com o vínculo da tela. Devolve o erro ou null. ── */
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
    toast.success(msg ?? "Atividade criada");
    gravou();
    return null;
  }, [carga, idDoResponsavel, gravou]);

  const excluir = React.useCallback(async (tarefaId: string) => {
    const r = await excluirTarefa(tarefaId);
    if (!r.ok) { toast.error(r.erro); return; }
    pendente.current = {};
    if (relogio.current) { clearTimeout(relogio.current); relogio.current = null; }
    toast.success("Atividade excluída");
    gravou();
    fechar();
  }, [gravou, fechar]);

  const catalogo = React.useMemo(() => ({
    EQUIPE: carga?.equipe.map((r) => r.nome) ?? [],
    LEADS: carga?.leads ?? [],
    Agenda: {
      itens: () => (carga?.item ? [carga.item] : []),
      salvar,
      iso: (d: Date | null) => (d ? `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` : ""),
      hm: (d: (Date & { _h?: boolean }) | null) => (d && d._h ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : ""),
    },
  }), [carga, salvar]);

  const pedido = React.useMemo(
    () => (carga?.modo === "ver" ? { modo: "ver", key: carga.item!.key } : { modo: "nova", pre: carga?.pre ?? {} }),
    // O pedido é lido uma vez, na montagem da Liga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [carga?.modo],
  );

  if (!carga) return null;

  return (
    <AtividadePeca
      dados={{ atividadesV2: [], opps: [], leads: carga.leads ?? [] }}
      catalogo={catalogo}
      pedido={pedido}
      abrir={abrir}
      gravar={gravar}
      buscarVinculos={acaoBuscarVinculos}
      excluir={excluir}
      avisou={avisou}
      fechar={fechar}
      ir={() => {}}
    />
  );
}
