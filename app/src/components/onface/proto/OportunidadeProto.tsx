"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Oportunidade 360 — o adaptador.
 *
 * `OportunidadeDesenho` é o markup convertido do handoff e `OportunidadeLiga`
 * a lógica dele, portada. Este arquivo fica entre os dois e o produto.
 *
 * É o único dos três escrito à mão: decidir qual campo do domínio corresponde
 * a qual campo do desenho é julgamento, e julgamento não se automatiza.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DelegarAgenteHost } from "./DelegarAgenteHost";

import type { DetalheOportunidade } from "@/lib/vendas/consultas";
import { ehFamiliaValida } from "@/lib/vendas/dominio";
import type { Resultado } from "@/lib/vendas/resultado";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { rotuloDeEvento, tituloLegivel } from "@/lib/vendas/rotulos-evento";
import { OportunidadeLiga } from "./OportunidadeLiga";
import { rotuloProcesso } from "../vendas/Pipeline";
import { levarParametros } from "./rota-do-desenho";
import { persistirEtapa, type CommandsDeEtapa } from "./persistencia";
import { usePecas } from "./pecas-host";
import { qualDoDesenho } from "./qual-do-desenho";
import { prazoDoBanco, situacaoDoBanco, tipoDoBanco } from "./atividade-tarefa";

/* ── Contratos ─────────────────────────────────────────────────────────── */

export interface AcoesOportunidade extends CommandsDeEtapa {
  definirProximaAcao: (negocioId: string, descricao: string | null, quando: string | null) => Promise<Resultado>;
  /** Derivar nova oportunidade da mesma empresa. Sem isto o botao avisa que nao grava. */
  criarOportunidade?: (entrada: {
    empresaId: string; familias: Array<"CALLFACE_AI" | "PABX" | "WHITE_LABEL">; responsavelId: string;
    titulo?: string | null; leadId?: string | null;
  }) => Promise<Resultado<{ ids: string[] }>>;
  /** Define/corrige a família comercial desta oportunidade. Usado pelos
   *  negócios LEGADOS que vieram do dump sem família — sem ela o card não
   *  avança para Proposta/Negociação nem fecha em Ganho. */
  alterarFamilia?: (negocioId: string, familia: "CALLFACE_AI" | "PABX" | "WHITE_LABEL", motivo: string | null) => Promise<Resultado<{ propostasIncompativeis: number }>>;
  atribuirResponsavel?: (negocioId: string, nome: string) => Promise<Resultado>;
  salvarResumo?: (negocioId: string, campos: Record<string, string>) => Promise<Resultado>;
  recusarProposta?: (propostaId: string, motivo: string) => Promise<Resultado>;
  excluirRascunho?: (propostaId: string) => Promise<Resultado>;
}

const FAMILIAS_ESCOLHA: Array<{ v: "CALLFACE_AI" | "PABX" | "WHITE_LABEL"; rotulo: string; desc: string }> = [
  { v: "CALLFACE_AI", rotulo: "Callface AI", desc: "Discador e inteligência de ligação" },
  { v: "PABX", rotulo: "PABX", desc: "Telefonia, ramais e linhas" },
  { v: "WHITE_LABEL", rotulo: "White Label", desc: "Revenda da plataforma" },
];

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

/** "Hoje, 14:30", "Ontem, 09:00", "23/09, 11:41" — o vocabulário do desenho. */
function quando(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(d) - dia(new Date())) / 86_400_000);
  if (dias === 0) return `Hoje, ${hora}`;
  if (dias === -1) return `Ontem, ${hora}`;
  if (dias === 1) return `Amanhã, ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hora}`;
}

/**
 * O tipo da atividade no vocabulário do desenho.
 *
 * O banco guarda o tipo da INTEGRAÇÃO (`call`, `email`, `meeting`, `note`), e
 * o desenho desenha selo por "Ligação", "E-mail", "Reunião". Sem o mapa o selo
 * mostraria a chave crua para quem opera.
 */
const TIPO_DA_ATIVIDADE: Record<string, string> = {
  call: "Ligação", ligacao: "Ligação", phone: "Ligação",
  email: "E-mail", mail: "E-mail",
  meeting: "Reunião", reuniao: "Reunião",
  task: "Tarefa", tarefa: "Tarefa",
  note: "Nota", nota: "Nota",
  whatsapp: "WhatsApp",
};

function rotuloDoTipo(tipo: string): string {
  return TIPO_DA_ATIVIDADE[tipo?.toLowerCase()] ?? rotuloDeEvento(tipo);
}

function iniciais(nome: string | null | undefined): string {
  if (!nome) return "—";
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/**
 * A oportunidade canônica na forma que o protótipo consome.
 *
 * O desenho nasceu sobre um mock com nomes próprios (`resp`, `atvs`, `pessoa`),
 * e traduzir num lugar só é o que mantém o markup intocado: ele continua lendo
 * os nomes que sempre leu.
 */
function paraODesenho(o: DetalheOportunidade, timeline: LinhaDoTempo[]) {
  return {
    id: o.id,
    empresa: o.empresa.nome,
    empresaId: o.empresa.id,
    pessoa: o.contato?.nome ?? "Sem contato",
    cargo: o.contato?.cargo ?? "",
    familia: o.familia,
    familiaRotulo: o.familiaRotulo,
    etapa: o.etapa,
    resp: o.responsavel.nome,
    iniciais: iniciais(o.responsavel.nome),
    valor: o.valor,
    titulo: o.titulo,
    criadoEm: quando(o.criadoEm),
    leadId: o.leadId,
    // Rótulo legível (antes ia o código cru); o código vai em origemBruta para a tela decidir pré-vendas x manual.
    origem: rotuloProcesso(o.sourceProcess),
    origemBruta: o.sourceProcess,
    motivoPerda: o.motivoPerda,
    obsPerda: "",
    badges: o.badges,
    // O 360 lista o comitê da empresa, não só quem abriu a conversa.
    pessoas: o.contatos.map((c) => ({
      id: c.id, nome: c.nome, papel: c.cargo ?? "Contato",
      email: c.email, telefone: c.telefone,
      principal: c.id === o.contato?.id,
    })),
    /* A Atividade é a TAREFA (a mesma de /tarefas e da peça de Atividade): abre e edita pela peça.
       O histórico de integração (ligação, e-mail, nota de sistema) vem depois, só para leitura. */
    atvs: (o.tarefas.map((t) => {
      const { fimD } = prazoDoBanco(t.venceEm, null);
      const feita = t.status === "concluida" || t.status === "declinada";
      return {
        id: t.id, tarefaId: t.id,
        tipo: tipoDoBanco(t.tipo),
        titulo: t.titulo,
        desc: t.descricao ?? "",
        autor: t.responsavel ?? "Sem responsável",
        quando: t.venceEm ? quando(t.venceEm) : "Sem prazo",
        fimD,
        situacao: situacaoDoBanco(t.status),
        feita,
      };
    }) as Array<Record<string, unknown>>).concat(o.reunioes.map((r) => ({
      /* A reunião é atividade (a peça tem a aba Reunião); a situação vem do status real dela. */
      id: r.id, historico: true, tipo: "Reunião", titulo: r.titulo, desc: "", autor: o.responsavel.nome ?? "Sem responsável",
      quando: quando(r.data), situacao: r.status === "realizada" ? "Feita" : r.status === "agendada" ? "A fazer" : "Declinada",
      feita: r.status !== "agendada",
    }))).concat(o.atividades.map((a) => ({
      id: a.id,
      historico: true,
      tipo: rotuloDoTipo(a.tipo),
      titulo: tituloLegivel(a.titulo) ?? rotuloDoTipo(a.tipo),
      desc: a.descricao ?? "",
      audioUrl: a.audioUrl ?? null,
      autor: a.autor ?? "Sistema",
      quando: quando(a.em),
      // O que já aconteceu é registro, não fila: atividade do histórico nasce
      // feita. A fila do vendedor vive em `tarefas`, que é outra coisa.
      situacao: "Feita",
      feita: true,
    }))),
    notas: o.notas.map((n) => ({
      id: n.id,
      texto: n.texto,
      autor: n.autor ?? "Sistema",
      sistema: !n.autor,
      quando: quando(n.em),
      anexos: [],
    })),
    propostas: o.propostas.map((p) => ({
      id: p.id,
      codigo: String(p.numero),
      versao: p.versao,
      status: p.status,
      enviadaEm: p.enviadaEm ? quando(p.enviadaEm) : null,
      total: p.total,
      modo: p.modoFechamento,
      /* A composição REAL da proposta.
       *
       * É o bloco "Produtos e valores" do 360 — a tabela com natureza,
       * quantidade e valor de cada linha, e o total ao pé. Com a lista vazia,
       * a tela dizia "O valor nasce na proposta. Crie a primeira" mesmo para
       * oportunidade com proposta fechada.
       *
       * Aqui carregar é barato: é UMA oportunidade, não o quadro inteiro. */
      itens: p.itens.map((i) => ({
        nome: i.nome,
        natureza: i.natureza ?? "ONE_TIME",
        qtd: i.quantidade,
        valor: i.valorUnitario,
      })),
      log: [],
    })),
    eventos: timeline.map((e) => ({
      t: e.titulo || rotuloDeEvento(e.tipo),
      quando: quando(e.ocorridoEm),
      autor: e.usuarioNome ?? "Sistema",
    })),
    /* O resumo é da OPORTUNIDADE (`negocios.campos_custom.resumoOportunidade`); o que ninguém
       escreveu ainda cai na qualificação de Pré-vendas, que é a fonte única dessas respostas. */
    resumoCampos: (() => {
      const q = (qualDoDesenho(o.qualificacaoHerdada) ?? {}) as Record<string, string>;
      return { objetivo: q.necessidade, contexto: q.cenario, dor: q.dor, ...(o.resumo ?? {}) };
    })(),
    // Tags reais (entity_labels ∪ negocio_labels); a peça tagsopp grava.
    tags: o.tags ?? [],
    // Sem fonte no domínio hoje. Vazio é honesto; inventar seria o mock
    // fingindo produção.
    arquivos: [],
    itens: [],
    proposta: null,
    // O que o domínio diz que falta para fechar: a tela explica, não decide.
    fechamentoFalta: o.fechamento?.falta ?? [],
  };
}

/* ── Persistência ──────────────────────────────────────────────────────── */


/**
 * O protótipo com as gravações ligadas.
 *
 * Duas intervenções, ambas por subclasse para não encostar no arquivo gerado:
 *
 * 1. `gravarOpp` é o ponto único das mutações — daqui elas viram command.
 * 2. `autoRevisao` é desligada. Ver a nota no método.
 */
class OportunidadeLigada extends OportunidadeLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
    /* O protótipo lia a oportunidade de `?opp=` porque navegava por query
       string, e só no `componentDidMount` — que não roda no servidor. Sem o id
       aqui, o SSR não acha a oportunidade, `renderVals` devolve um objeto
       incompleto e a tela cai com "Cannot read properties of undefined". */
    (this as any).oppId = props.oppId;
  }

  componentDidMount() {
    super.componentDidMount?.();
    // O didMount do protótipo sobrescreve `oppId` com o query param; devolver.
    (this as any).oppId = (this as any).props.oppId;
    (this as any).forceUpdate();
  }

  /**
   * Desligada de propósito.
   *
   * A regra é real — proposta recusada ou com ajuste pedido deve gerar uma
   * atividade de revisão para o responsável. Mas ela roda no
   * `componentDidUpdate` e GRAVA, o que aqui daria dois problemas: criaria a
   * tarefa uma vez por aba aberta (sem `chave_idempotencia` que a impeça), e
   * cairia no `persistir` abaixo, que responde "isto ainda não grava" e
   * recarrega — um laço de refresh sem fim.
   *
   * Automação que cria tarefa é do DOMÍNIO, não da tela: pertence ao command
   * que muda o status da proposta, onde roda uma vez e é idempotente.
   */
  autoRevisao() {}

  /* Mutacao sem command (nota, atividade, pessoa, resumo...) NAO grava: o `persistir` avisa e a tela
     relê. O toast de sucesso que o desenho dispara logo depois ("Nota adicionada") era mentira; fica
     calado ate o fim do tick, e so o aviso de que nao gravou aparece. */
  private naoGrava = false;

  gravarOpp(o: any, evento: string) {
    const antes = (this as any).todas?.().find((x: any) => x.id === o.id);
    const novo = super.gravarOpp(o, evento);
    this.naoGrava = !antes || antes.etapa === novo.etapa;
    if (this.naoGrava) queueMicrotask(() => { this.naoGrava = false; });
    (this as any).props.persistir?.(antes, novo, evento || "Esta alteração");
    return novo;
  }

  /* NÃO chamar super.diz: a Liga faz `diz -> E.avisar -> this.diz`, e como
     `this.diz` é este override, super.diz recursava infinito (Maximum call
     stack) e travava "Avançar etapa" no drawer. Mostra o toast direto, igual
     aos outros protos (Empresa/Pessoa/Calendário). */
  diz(t: string, tom?: string) {
    if (this.naoGrava) return;
    if (tom === "erro") toast.error(t);
    else if (tom === "aviso") toast.warning(t);
    else toast.success(t);
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function OportunidadeProto({ oportunidade, timeline, acoes, equipe = [], abrirDefinirFamilia = false }: {
  oportunidade: DetalheOportunidade;
  timeline: LinhaDoTempo[];
  acoes: AcoesOportunidade;
  /** Equipe real da organização (nomes), para @menção e seletor de responsável. */
  equipe?: string[];
  /** Vem do board quando o gate "defina a família antes de avançar" dispara:
   *  abre o seletor de família já na entrada. */
  abrirDefinirFamilia?: boolean;
}) {
  const router = useRouter();

  /* Seletor de família para o LEGADO sem família. Abre sozinho quando o board
     mandou (abrirDefinirFamilia) e a oportunidade ainda não tem família.
     SÓ em oportunidade ABERTA: ganho/perdido não muda de família (o command
     recusa), então o banner viraria um botão que só dá erro. `ehFamiliaValida`
     cobre o caso `service_family='UNKNOWN'` (string truthy que o gate rejeita). */
  const semFamilia = !ehFamiliaValida(oportunidade.familia)
    && oportunidade.etapa !== "ganho" && oportunidade.etapa !== "perdido";
  const [famAberto, setFamAberto] = React.useState(false);
  const [famSalvando, setFamSalvando] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (abrirDefinirFamilia && semFamilia) setFamAberto(true);
  }, [abrirDefinirFamilia, semFamilia]);

  const escolherFamilia = React.useCallback(async (familia: "CALLFACE_AI" | "PABX" | "WHITE_LABEL") => {
    if (!acoes.alterarFamilia) { toast.error("Definir família ainda não está ligado nesta tela."); return; }
    setFamSalvando(familia);
    const r = await acoes.alterarFamilia(oportunidade.id, familia, "Família definida na oportunidade legada");
    setFamSalvando(null);
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success("Família definida. Agora dá para avançar a oportunidade.");
    setFamAberto(false);
    router.refresh();
  }, [acoes, oportunidade.id, router]);

  /* O protótipo semeia o estado uma vez e depois só escreve nele. Bumpar a
     chave quando `dados` muda faz a tela renascer sobre a verdade do servidor
     — inclusive quando o command RECUSA a mudança. */
  const [geracao, setGeracao] = React.useState(0);
  const primeira = React.useRef(true);
  React.useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    setGeracao((n) => n + 1);
  }, [oportunidade, timeline]);

  const opp = React.useMemo(
    () => paraODesenho(oportunidade, timeline),
    [oportunidade, timeline],
  );

  const catalogo = React.useMemo(() => {
    // Equipe real da organização, vinda do banco. Garante que o responsável
    // atual esteja na lista mesmo se, por algum motivo, não vier na query.
    const nomes = equipe.length ? equipe.slice() : [];
    if (oportunidade.responsavel.nome && !nomes.includes(oportunidade.responsavel.nome)) {
      nomes.unshift(oportunidade.responsavel.nome);
    }
    return {
      EQUIPE: nomes,
      OPORTUNIDADES: [],
      LEADS: [],
    };
  }, [equipe, oportunidade.responsavel.nome]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "empresa" && id) { router.push(`/empresas/${id}`); return; }
    if (peca === "proposta" && id) { router.push(`/propostas/${id}`); return; }
    if (peca === "lead" && id) { router.push(`/pre-vendas?lead=${encodeURIComponent(id)}`); return; }
    abrirPeca(peca, id, {
      tela: "oportunidade", oportunidadeId: oportunidade.id,
      leadId: oportunidade.leadId, empresaId: oportunidade.empresa.id, empresa: oportunidade.empresa.nome,
    });
  }, [router, abrirPeca, oportunidade.id, oportunidade.leadId, oportunidade.empresa.id, oportunidade.empresa.nome]);

  /**
   * Cada mutação do desenho, traduzida para o command certo.
   *
   * O que não tem command NÃO grava em silêncio: avisa e desfaz. Tela que
   * parece que gravou e não gravou é o defeito mais caro, porque não dá erro.
   */
  const derivar = React.useCallback(async (f: { familia: any; resp: string; pessoa: string; motivo: string }) => {
    if (!acoes.criarOportunidade) { toast.error("Derivar oportunidade ainda não é gravado por esta tela."); return; }
    if (!oportunidade.empresa.id || !oportunidade.responsavel.id || f.resp !== oportunidade.responsavel.nome) {
      toast.error("Só é possível derivar para o responsável atual desta oportunidade (a lista de equipe ainda não vem do banco).");
      return;
    }
    const r = await acoes.criarOportunidade({
      empresaId: oportunidade.empresa.id, familias: [f.familia], responsavelId: oportunidade.responsavel.id,
      titulo: null, leadId: oportunidade.leadId,
    });
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success("Oportunidade criada.");
    const novo = r.dados?.ids?.[0];
    if (novo) router.push(`/pipeline/${novo}`); else router.refresh();
  }, [acoes, oportunidade, router]);

  /**
   * O que a tela edita sem ser etapa: nota, responsável, resumo, proposta.
   *
   * Compara o antes e o depois que o desenho entrega e leva cada diferença ao
   * lugar certo. Devolve a lista do que gravou, ou o erro. Atividade NÃO passa
   * por aqui: nasce e se edita na peça de Atividade (tarefas), que já grava.
   */
  const persistirOutras = React.useCallback(async (antes: any, depois: any): Promise<{ gravou: string[]; naoGravou: string[]; erro?: string }> => {
    const gravou: string[] = [];
    const naoGravou: string[] = [];
    const falhou = (erro: string) => ({ gravou, naoGravou, erro });

    // Notas: nova (sem id), removida (id que sumiu). Fixar não tem coluna.
    const notasAntes: any[] = antes?.notas ?? [], notasDepois: any[] = depois?.notas ?? [];
    for (const n of notasDepois.filter((x) => !x.id && !x.sistema && !x.virtual && String(x.texto ?? "").trim())) {
      const r = await fetch("/api/notas", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: String(n.texto).trim(), negocioId: depois.id }),
      });
      if (!r.ok) return falhou("Não consegui gravar a nota.");
      gravou.push("Nota adicionada");
    }
    const idsDepois = new Set(notasDepois.map((x) => x.id).filter(Boolean));
    for (const n of notasAntes.filter((x) => x.id && !x.sistema && !idsDepois.has(x.id))) {
      const r = await fetch(`/api/notas/${n.id}`, { method: "DELETE", credentials: "same-origin" });
      if (!r.ok) return falhou("Não consegui excluir a nota.");
      gravou.push("Nota excluída");
    }
    if (notasDepois.some((x) => x.id && x.fixada && !notasAntes.find((y) => y.id === x.id)?.fixada)) naoGravou.push("fixar nota");

    // Responsável.
    if (antes?.resp && depois?.resp && antes.resp !== depois.resp) {
      const r = await acoes.atribuirResponsavel?.(depois.id, depois.resp);
      if (!r) naoGravou.push("trocar responsável");
      else if (!r.ok) return falhou(r.erro);
      else gravou.push(`Responsável: ${depois.resp}`);
    }

    // Resumo da oportunidade.
    if (JSON.stringify(antes?.resumoCampos ?? {}) !== JSON.stringify(depois?.resumoCampos ?? {})) {
      const r = await acoes.salvarResumo?.(depois.id, depois.resumoCampos ?? {});
      if (!r) naoGravou.push("resumo");
      else if (!r.ok) return falhou(r.erro);
      else gravou.push("Resumo salvo");
    }

    // Propostas: rascunho excluído e recusa registrada pelo vendedor.
    const propsAntes: any[] = antes?.propostas ?? [], propsDepois: any[] = depois?.propostas ?? [];
    for (const p of propsAntes.filter((x) => x.id && !propsDepois.some((y) => y.id === x.id))) {
      const r = await acoes.excluirRascunho?.(p.id);
      if (!r) naoGravou.push("excluir rascunho");
      else if (!r.ok) return falhou(r.erro);
      else gravou.push("Rascunho excluído");
    }
    for (const p of propsDepois) {
      const antesP = propsAntes.find((x) => x.id === p.id);
      if (antesP && antesP.status !== "recusada" && p.status === "recusada") {
        const r = await acoes.recusarProposta?.(p.id, String(p.resposta ?? "").trim());
        if (!r) naoGravou.push("registrar recusa");
        else if (!r.ok) return falhou(r.erro);
        else gravou.push("Recusa registrada");
      }
    }

    // O que o desenho ainda deixa mudar sem ter onde gravar.
    const mudou = (k: string) => JSON.stringify(antes?.[k] ?? null) !== JSON.stringify(depois?.[k] ?? null);
    if (mudou("pessoas")) naoGravou.push("contatos da oportunidade");
    if (mudou("arquivos")) naoGravou.push("arquivos");
    return { gravou, naoGravou };
  }, [acoes]);

  const persistir = React.useCallback(async (antes: any, depois: any, evento: string) => {
    const d = await persistirEtapa(antes, depois, evento, acoes);
    if (d.tipo === "gravou") { router.refresh(); return; }

    if (d.tipo === "sem-command") {
      const o = await persistirOutras(antes, depois);
      if (o.erro) toast.error(o.erro);
      else if (o.gravou.length) toast.success(o.gravou.join(" · "));
      if (o.naoGravou.length) toast.warning(`Ainda não é gravado nesta tela: ${o.naoGravou.join(", ")}.`);
      if (!o.erro && !o.gravou.length && !o.naoGravou.length) toast.warning(d.motivo);
      router.refresh();
      return;
    }

    /* Recusa desfaz igual — a tela relê do servidor. O que muda é a mensagem,
       e o CTA quando o domínio manda um. Aqui ele não navega: já estamos na
       página onde a família e a proposta se resolvem. */
    toast.error(d.motivo);
    router.refresh();
  }, [acoes, router, persistirOutras]);

  return (
    <div data-workspace="desenho">
      {semFamilia && (
        <button
          type="button"
          onClick={() => setFamAberto(true)}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", margin: "0 0 12px", padding: "12px 14px", borderRadius: 12, border: "1px solid #f3c6bb", background: "#fff6f4", color: "#c2330f", font: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
        >
          <span aria-hidden style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: 7, background: "#c2330f", color: "#fff", display: "grid", placeItems: "center", fontSize: 14 }}>!</span>
          Esta oportunidade (legado) está sem família comercial. Clique para definir e poder avançar.
        </button>
      )}

      <OportunidadeLigada
        key={geracao}
        oppId={oportunidade.id}
        dados={{ opps: [opp], leads: [] }}
        catalogo={catalogo}
        abrir={abrir}
        persistir={persistir}
        derivar={derivar}
        ir={(href: string) => router.push(href)}
      />

      <DelegarAgenteHost />

      {famAberto && (
        <div
          role="dialog" aria-modal="true" aria-label="Definir família da oportunidade"
          onClick={() => !famSalvando && setFamAberto(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(18,23,29,.45)", display: "grid", placeItems: "center", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 100%)", background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#12171d", letterSpacing: "-.02em" }}>A qual família pertence?</h2>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#4a5560" }}>Oportunidade legada sem família. Escolha uma para amarrar e seguir o fluxo (proposta, checkout, ganho).</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FAMILIAS_ESCOLHA.map((f) => (
                <button
                  key={f.v} type="button" disabled={!!famSalvando}
                  onClick={() => escolherFamilia(f.v)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid #e3e7e8", background: famSalvando === f.v ? "#fff6f4" : "#fff", cursor: famSalvando ? "wait" : "pointer", textAlign: "left", font: "inherit" }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: "#12171d" }}>{f.rotulo}{famSalvando === f.v ? " · salvando…" : ""}</span>
                  <span style={{ fontSize: 12, color: "#67787c" }}>{f.desc}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => !famSalvando && setFamAberto(false)} style={{ marginTop: 14, width: "100%", padding: "10px", borderRadius: 10, border: 0, background: "transparent", color: "#4a5560", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Agora não</button>
          </div>
        </div>
      )}
    </div>
  );
}
