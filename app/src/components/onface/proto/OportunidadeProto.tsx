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

import type { DetalheOportunidade } from "@/lib/vendas/consultas";
import type { Resultado } from "@/lib/vendas/resultado";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { OportunidadeLiga } from "./OportunidadeLiga";
import { rotuloProcesso } from "../vendas/Pipeline";
import { levarParametros } from "./rota-do-desenho";
import { persistirEtapa, type CommandsDeEtapa } from "./persistencia";
import { usePecas } from "./pecas-host";

/* ── Contratos ─────────────────────────────────────────────────────────── */

export interface AcoesOportunidade extends CommandsDeEtapa {
  definirProximaAcao: (negocioId: string, descricao: string | null, quando: string | null) => Promise<Resultado>;
  /** Derivar nova oportunidade da mesma empresa. Sem isto o botao avisa que nao grava. */
  criarOportunidade?: (entrada: {
    empresaId: string; familias: Array<"CALLFACE_AI" | "PABX" | "WHITE_LABEL">; responsavelId: string;
    titulo?: string | null; leadId?: string | null;
  }) => Promise<Resultado<{ ids: string[] }>>;
}

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
  return TIPO_DA_ATIVIDADE[tipo?.toLowerCase()] ?? tipo ?? "Atividade";
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
    atvs: o.atividades.map((a) => ({
      id: a.id,
      tipo: rotuloDoTipo(a.tipo),
      titulo: a.titulo ?? rotuloDoTipo(a.tipo),
      desc: a.descricao ?? "",
      autor: a.autor ?? "Sistema",
      quando: quando(a.em),
      // O que já aconteceu é registro, não fila: atividade do histórico nasce
      // feita. A fila do vendedor vive em `tarefas`, que é outra coisa.
      situacao: "Feita",
      feita: true,
    })),
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
      t: e.titulo || e.tipo,
      quando: quando(e.ocorridoEm),
      autor: e.usuarioNome ?? "Sistema",
    })),
    // Tags reais (entity_labels ∪ negocio_labels); a peça tagsopp grava.
    tags: o.tags ?? [],
    // Sem fonte no domínio hoje. Vazio é honesto; inventar seria o mock
    // fingindo produção.
    arquivos: [],
    itens: [],
    proposta: null,
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

  diz(t: string, tom?: string) {
    if (this.naoGrava) return;
    super.diz(t, tom);
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function OportunidadeProto({ oportunidade, timeline, acoes }: {
  oportunidade: DetalheOportunidade;
  timeline: LinhaDoTempo[];
  acoes: AcoesOportunidade;
}) {
  const router = useRouter();

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

  const catalogo = React.useMemo(() => ({
    // A equipe real desta oportunidade. O quadro traz a lista inteira; aqui
    // só o responsável é conhecido, e inventar colegas seria voltar ao mock.
    EQUIPE: oportunidade.responsavel.nome ? [oportunidade.responsavel.nome] : [],
    OPORTUNIDADES: [],
    LEADS: [],
  }), [oportunidade.responsavel.nome]);

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

  const persistir = React.useCallback(async (antes: any, depois: any, evento: string) => {
    const d = await persistirEtapa(antes, depois, evento, acoes);
    if (d.tipo === "gravou") { router.refresh(); return; }

    /* Recusa e "sem command" desfazem igual — a tela relê do servidor. O que
       muda é a mensagem, e o CTA quando o domínio manda um. Aqui ele não
       navega: já estamos na página onde a família e a proposta se resolvem. */
    toast.error(d.motivo);
    router.refresh();
  }, [acoes, router]);

  return (
    <div data-workspace="desenho">
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
    </div>
  );
}
