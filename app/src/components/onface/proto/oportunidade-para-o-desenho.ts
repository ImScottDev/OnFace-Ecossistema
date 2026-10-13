/* Domínio → desenho da oportunidade: UM mapeamento só, usado pela página
   /pipeline/[id] e pelo drawer do quadro. */
import { quandoBR } from "@/lib/datas-br";
import { autorDoEvento } from "./avatar-do-proto";
import type { DetalheOportunidade } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { rotuloDeEvento, rotuloProcesso, tituloLegivel } from "@/lib/vendas/rotulos-evento";
import { qualDoDesenho } from "./qual-do-desenho";
import { prazoDoBanco, situacaoDoBanco, tipoDoBanco } from "./atividade-tarefa";

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

/** "Hoje, 14:30", "Ontem, 09:00", "23/09, 11:41" — o vocabulário do desenho. */
export function quando(iso: string | null): string {
  return quandoBR(iso);
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
export function oportunidadeParaODesenho(o: DetalheOportunidade, timeline: LinhaDoTempo[]) {
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
      id: r.id, reuniaoId: r.id, historico: true, tipo: "Reunião", titulo: r.titulo, desc: "", autor: o.responsavel.nome ?? "Sem responsável",
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
      autor: autorDoEvento(e),
    })),
    /* O resumo é da OPORTUNIDADE (`negocios.campos_custom.resumoOportunidade`); o que ninguém
       escreveu ainda cai na qualificação de Pré-vendas, que é a fonte única dessas respostas. */
    resumoCampos: (() => {
      const q = (qualDoDesenho(o.qualificacaoHerdada) ?? {}) as Record<string, string>;
      return { objetivo: q.necessidade, contexto: q.cenario, dor: q.dor, ...(o.resumo ?? {}) };
    })(),
    // Tags reais (entity_labels ∪ negocio_labels); a peça tagsopp grava.
    tags: o.tags ?? [],
    arquivos: o.arquivos.map((a) => ({ nome: a.nome, url: a.url, quando: quando(a.em), autor: a.autor ?? "Sistema" })),
    itens: [],
    proposta: null,
    // O que o domínio diz que falta para fechar: a tela explica, não decide.
    fechamentoFalta: o.fechamento?.falta ?? [],
  };
}

