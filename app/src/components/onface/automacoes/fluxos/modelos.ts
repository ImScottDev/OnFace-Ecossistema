/* Modelos prontos do construtor (contrato §7.6). Dados puros com os tipos de
 * grafo.ts. Campos que dependem da conta (tag, etapa, cadência) ficam vazios
 * de propósito: viram pendência no editor e ensinam o que falta preencher. */
import { novoNo, type GrafoFluxo, type TipoNo } from "@/lib/automacoes/grafo";

export interface ModeloFluxo {
  id: string;
  nome: string;
  descricao: string;
  /** Ícone lucide do gatilho, para o cartão do modelo. */
  icone: string;
  grafo: () => GrafoFluxo;
}

/* Grade da esquerda para a direita: o gatilho na coluna 0, cada passo uma
   coluna adiante. Ramo de cima em y negativo, ramo de baixo em positivo. */
const COL = 340;
const LIN = 150;

type NoModelo = [id: string, tipo: TipoNo, config: Record<string, unknown>, col: number, lin: number];

function montar(nos: NoModelo[], arestas: [origem: string, saida: string, destino: string][]): GrafoFluxo {
  return {
    versao: 1,
    nos: nos.map(([id, tipo, config, col, lin]) => {
      const no = novoNo(tipo, id, { x: col * COL, y: lin * LIN });
      return { ...no, config: { ...no.config, ...config } };
    }),
    arestas: arestas.map(([origem, saida, destino], i) => ({ id: `a${i + 1}`, origem, saida, destino })),
  };
}

export const MODELOS: ModeloFluxo[] = [
  {
    id: "boas-vindas",
    nome: "Boas-vindas ao lead novo",
    descricao: "No expediente, manda WhatsApp e cria a ligação. Fora dele, espera as 9h para escrever.",
    icone: "MessageCircle",
    grafo: () => montar([
      ["n1", "gatilho", { modo: "evento", evento: "lead.criado" }, 0, 0],
      ["n2", "horario_comercial", {}, 1, 0],
      ["n3", "enviar_whatsapp", { modo: "texto", mensagem: "Oi {{ lead.primeiro_nome }}, aqui é da Callface. Recebemos seu contato e já vamos falar com você." }, 2, -0.8],
      ["n4", "criar_tarefa", { titulo: "Ligar para {{ lead.nome }}", prioridade: "alta", prazoMinutos: 60 }, 3, -0.8],
      ["n5", "aguardar_horario", { horario: "09:00", diasSemana: [1, 2, 3, 4, 5] }, 2, 0.9],
      ["n6", "enviar_whatsapp", { modo: "texto", mensagem: "Bom dia, {{ lead.primeiro_nome }}! Aqui é da Callface. Vi seu contato e quero entender o que você precisa." }, 3, 0.9],
    ], [["n1", "ok", "n2"], ["n2", "dentro", "n3"], ["n3", "ok", "n4"], ["n2", "fora", "n5"], ["n5", "ok", "n6"]]),
  },
  {
    id: "negocio-parado",
    nome: "Negócio parado há 7 dias",
    descricao: "Todo dia às 9h, cria tarefa de retomada para cada negócio sem atualização e avisa o responsável.",
    icone: "AlarmClock",
    grafo: () => montar([
      ["n1", "gatilho", { modo: "agendado", frequencia: "diaria", horarios: ["09:00"], alvo: "negocio", alvoParadoHaDias: 7 }, 0, 0],
      ["n2", "criar_tarefa", { titulo: "Retomar {{ negocio.titulo }}", prioridade: "media", prazoMinutos: 1440 }, 1, 0],
      ["n3", "notificar_usuario", { titulo: "Negócio parado", mensagem: "{{ negocio.titulo }} está sem atualização há 7 dias. Criei uma tarefa para retomar." }, 2, 0],
    ], [["n1", "ok", "n2"], ["n2", "ok", "n3"]]),
  },
  {
    id: "pagamento-falhou",
    nome: "Pagamento falhou no Stripe",
    descricao: "Marca a empresa com uma tag, avisa quem cuida e cria a tarefa de cobrança.",
    icone: "CreditCard",
    grafo: () => montar([
      ["n1", "gatilho", { modo: "evento", evento: "stripe.pagamento_falhou" }, 0, 0],
      ["n2", "adicionar_tag", { tagId: "" }, 1, 0],
      ["n3", "notificar_usuario", { titulo: "Pagamento falhou", mensagem: "O pagamento de {{ empresa.nome }} falhou no Stripe ({{ gatilho.valor }})." }, 2, 0],
      ["n4", "criar_tarefa", { titulo: "Cobrar {{ empresa.nome }}: pagamento falhou", prioridade: "alta", prazoMinutos: 1440 }, 3, 0],
    ], [["n1", "ok", "n2"], ["n2", "ok", "n3"], ["n3", "ok", "n4"]]),
  },
  {
    id: "proposta-visualizada",
    nome: "Proposta visualizada sem retorno",
    descricao: "Um dia depois da visualização, se o negócio não foi ganho, cria o follow-up.",
    icone: "Eye",
    grafo: () => montar([
      ["n1", "gatilho", { modo: "evento", evento: "proposta.visualizada" }, 0, 0],
      ["n2", "esperar", { quantidade: 1, unidade: "dias" }, 1, 0],
      ["n3", "condicao", { combinador: "e", regras: [{ campo: "negocio.etapa", operador: "diferente", valor: "ganho" }] }, 2, 0],
      ["n4", "criar_tarefa", { titulo: "Follow-up da proposta: {{ negocio.titulo }}", prioridade: "alta", prazoMinutos: 240 }, 3, -0.5],
    ], [["n1", "ok", "n2"], ["n2", "ok", "n3"], ["n3", "sim", "n4"]]),
  },
  {
    id: "triagem-ia",
    nome: "Triagem da resposta no WhatsApp com IA",
    descricao: "A IA lê a mensagem e separa: interessado avança, sem interesse ganha tag, dúvida vira tarefa.",
    icone: "Bot",
    grafo: () => montar([
      ["n1", "gatilho", { modo: "evento", evento: "whatsapp.recebido" }, 0, 0],
      ["n2", "ia_classificar", {
        texto: "{{ gatilho.conteudo }}",
        classes: [{ id: "interessado", rotulo: "Interessado" }, { id: "sem_interesse", rotulo: "Sem interesse" }, { id: "duvida", rotulo: "Dúvida" }],
      }, 1, 0],
      ["n3", "mover_etapa", { etapa: "" }, 2, -1.2],
      ["n4", "notificar_usuario", { titulo: "Lead interessado", mensagem: "{{ contato.nome }} demonstrou interesse: “{{ gatilho.conteudo }}”" }, 3, -1.2],
      ["n5", "adicionar_tag", { tagId: "" }, 2, 0],
      ["n6", "criar_tarefa", { titulo: "Responder a dúvida de {{ contato.nome }}", prioridade: "alta", prazoMinutos: 120 }, 2, 1.2],
    ], [["n1", "ok", "n2"], ["n2", "interessado", "n3"], ["n3", "ok", "n4"], ["n2", "sem_interesse", "n5"], ["n2", "duvida", "n6"]]),
  },
];
