// TODO: REMOVER AO LIGAR
//
// DADO DE DESENVOLVIMENTO. Existe para as telas de /pos-vendas poderem ser
// desenhadas e exercitadas antes de `boardDoPosVenda()` e `projetoCompleto()`
// existirem. Nada aqui é dado real: empresas, pessoas, valores e datas são
// inventados.
//
// Como morre:
//   1. Em `app/(produto)/pos-vendas/fonte.ts` trocar os três imports deste
//      arquivo pelos do motor (lerBoard, lerProjeto, acoes).
//   2. Apagar este arquivo.
//   3. `grep -rn fixture-dev src` tem que voltar vazio.
//
// Trava de segurança: `fonte.ts` só entrega esta fixture quando
// NODE_ENV !== "production". Em produção, sem o motor, a tela mostra erro
// escrito, nunca empresa inventada.
//
// Esta fixture guarda estado em memória para as ações (concluir tarefa,
// marcar espera, nota) funcionarem de ponta a ponta em dev. Reiniciar o
// servidor reinicia o estado. Isso NÃO é o motor: é só para a tela poder ser
// clicada.

import type {
  Board,
  CartaoDoProjeto,
  EstadoDaTarefa,
  EstadoDoProjeto,
  EventoDoProjeto,
  FiltrosDoBoard,
  Familia,
  MotivoDaEspera,
  Pessoa,
  Projeto,
  Relogios,
  Resultado,
  TarefaDoProjeto,
  TipoDeProjeto,
  Usuario,
} from "./contrato";

const AGORA = new Date();
const H = 3_600_000;
const D = 24 * H;
const atras = (dias: number, horas = 0) => new Date(AGORA.getTime() - dias * D - horas * H);
const adiante = (dias: number) => new Date(AGORA.getTime() + dias * D);

// ─── Pessoas ───────────────────────────────────────────────────────────────

const usuario = (id: string, nome: string): Usuario => ({
  id,
  nome,
  email: `${nome.split(" ")[0].toLowerCase()}@exemplo.invalid`,
  iniciais: nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
});
const pessoa = (id: string, nome: string, cargo: string | null, tel: string | null = null): Pessoa => ({
  id,
  nome,
  email: `${nome.split(" ")[0].toLowerCase()}@exemplo.invalid`,
  telefone: tel,
  cargo,
  iniciais: nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
});

export const EQUIPE_DEV: Usuario[] = [
  usuario("u-ana", "Ana Ribeiro"),
  usuario("u-bruno", "Bruno Matos"),
  usuario("u-diego", "Diego Souza"),
];
const VENDEDORA = usuario("u-carla", "Carla Nunes");
const [ANA, BRUNO, DIEGO] = EQUIPE_DEV;

// ─── Playbooks (texto de exemplo) ──────────────────────────────────────────

type Molde = { passo: string; titulo: string; playbook: string; itens: string[]; prazoDia: number; prioridade: TarefaDoProjeto["prioridade"]; condicional?: boolean };

const MOLDES: Record<Familia, Molde[]> = {
  CALLFACE_AI: [
    {
      passo: "contato_boas_vindas", titulo: "Boas-vindas e alinhamento de expectativa", prazoDia: 1, prioridade: "alta",
      playbook: "Faça o primeiro contato **no mesmo dia** da venda, por telefone ou WhatsApp.\n\n### O que dizer\n- Quem você é e que vai conduzir a implantação\n- O que acontece nos próximos 15 dias\n- O que você precisa do cliente e até quando\n\n> Se o cliente não atender em duas tentativas, mande a mensagem de boas-vindas e registre na linha do tempo.",
      itens: ["Ligar para o contato principal", "Confirmar quem usará o sistema", "Enviar o formulário de levantamento", "Registrar perfil de uso no Levantamento"],
    },
    {
      passo: "coleta_materiais", titulo: "Coletar materiais e acessos", prazoDia: 4, prioridade: "alta",
      playbook: "Sem o material, nada anda. Cobre o formulário **a cada 48 horas** e marque espera com o cliente quando estiver parado com ele.\n\n### Precisamos de\n1. Lista de usuários com nome e e-mail\n2. Logo e cores da empresa\n3. Script ou roteiro de abordagem atual\n4. Acesso ao CRM, se houver",
      itens: ["Lista de usuários recebida", "Roteiro de abordagem recebido", "Acesso ao CRM validado"],
    },
    {
      passo: "configuracao_conta", titulo: "Configurar conta, usuários e integrações", prazoDia: 7, prioridade: "media",
      playbook: "Crie a conta e os usuários, conecte o número de telefonia e valide uma ligação de teste.\n\n### Antes de entregar\n- Cada usuário consegue entrar\n- Uma ligação de teste foi gravada\n- O CRM do cliente recebe a atividade",
      itens: ["Criar usuários", "Conectar telefonia", "Ligação de teste gravada", "Integração com o CRM do cliente"],
    },
    {
      passo: "treino_agente_ia", titulo: "Treinar o Agente de IA com a base do cliente", prazoDia: 9, prioridade: "media", condicional: true,
      playbook: "Só existe quando o Agente de IA foi vendido.\n\nSuba os documentos do cliente, escreva as 10 perguntas mais comuns e valide as respostas **com o gestor** antes de ligar o agente.",
      itens: ["Subir base de conhecimento", "Validar 10 respostas com o gestor"],
    },
    {
      passo: "treinamento_time", titulo: "Treinar o time do cliente", prazoDia: 11, prioridade: "alta",
      playbook: "Reunião de 60 minutos com todos os usuários. Grave e deixe o link nos Materiais.\n\n### Roteiro\n1. Como fazer a primeira ligação\n2. Como ler o painel\n3. Onde pedir ajuda",
      itens: ["Agendar reunião", "Realizar treinamento", "Enviar gravação aos participantes"],
    },
    {
      passo: "encerramento_nps", titulo: "Acompanhar primeira semana e encerrar com NPS", prazoDia: 15, prioridade: "media",
      playbook: "Acompanhe o uso por 7 dias. Se houver ligações e o agente estiver ligado, envie o NPS e aguarde 3 dias antes de dar baixa.\n\nSem resposta, a baixa exige o retrato de uso.",
      itens: ["Conferir uso nos 7 primeiros dias", "Enviar NPS", "Registrar resultado"],
    },
  ],
  PABX: [
    {
      passo: "validar_dados", titulo: "Validar contrato e dados da linha", prazoDia: 3, prioridade: "alta",
      playbook: "Confira CNPJ, endereço de instalação e titularidade da linha **antes** de abrir pedido na operadora. Dado errado aqui custa semanas depois.\n\nQuando tudo estiver conferido, marque o T0: é daqui que o prazo de 25 dias corre.",
      itens: ["Conferir CNPJ e razão social", "Confirmar titularidade das linhas", "Marcar T0"],
    },
    {
      passo: "portabilidade", titulo: "Portabilidade e pedido na operadora", prazoDia: 12, prioridade: "urgente",
      playbook: "Abra o pedido de portabilidade e **acompanhe todo dia útil**. O prazo é da operadora, mas a cobrança é nossa.\n\n### Se travar\n- Marque espera com motivo *operadora* e escreva o protocolo\n- Avise o cliente por escrito",
      itens: ["Abrir pedido de portabilidade", "Registrar protocolo", "Janela de corte agendada"],
    },
    {
      passo: "ramais_e_uras", titulo: "Configurar ramais, filas e URA", prazoDia: 18, prioridade: "alta",
      playbook: "Monte a estrutura de ramais, filas e a URA conforme o desenho aprovado. Cada ramal precisa ser testado com uma chamada real.",
      itens: ["Criar ramais", "Montar filas", "Gravar áudios da URA", "Testar cada ramal"],
    },
    {
      passo: "homologacao", titulo: "Homologar chamadas com o cliente", prazoDia: 22, prioridade: "alta",
      playbook: "Sessão de 30 minutos com o cliente testando entrada, saída, transferência e fila. Registre o aceite por escrito.",
      itens: ["Teste de entrada", "Teste de saída", "Teste de fila e transferência", "Aceite registrado"],
    },
    {
      passo: "entrega", titulo: "Entrega e virada de chave", prazoDia: 25, prioridade: "media",
      playbook: "Faça o corte para a nova estrutura em horário combinado e fique disponível nas duas primeiras horas.",
      itens: ["Corte realizado", "Plantão nas 2 primeiras horas", "Handoff para o suporte"],
    },
  ],
  WHITE_LABEL: [
    {
      passo: "alinhamento_marca", titulo: "Alinhar marca e domínio do parceiro", prazoDia: 4, prioridade: "alta",
      playbook: "Receba logo, paleta e domínio. O parceiro precisa **apontar o DNS** no registro dele; mande o passo a passo.\n\n### Checklist\n- Logo em SVG\n- Paleta com 3 cores\n- Domínio e acesso ao DNS",
      itens: ["Receber logo e paleta", "Domínio definido", "DNS apontado"],
    },
    {
      passo: "ambiente_parceiro", titulo: "Montar ambiente e licenças do parceiro", prazoDia: 14, prioridade: "alta",
      playbook: "Crie o ambiente do parceiro, aplique a identidade visual e provisione as licenças vendidas.",
      itens: ["Ambiente criado", "Identidade aplicada", "Licenças provisionadas", "E-mails transacionais com a marca"],
    },
    {
      passo: "treino_parceiro", titulo: "Treinar o parceiro para operar e vender", prazoDia: 22, prioridade: "media",
      playbook: "Treinamento operacional (cadastrar cliente final, suporte nível 1) e comercial (como apresentar).",
      itens: ["Treino operacional", "Treino comercial", "Material de venda entregue"],
    },
    {
      passo: "go_live", titulo: "Go-live e acompanhamento de 30 dias", prazoDia: 30, prioridade: "media",
      playbook: "Liberação para o primeiro cliente final do parceiro e acompanhamento até o dia 30.",
      itens: ["Primeiro cliente final ativo", "Revisão no dia 30"],
    },
  ],
};

const PRAZO: Record<Familia, number> = { CALLFACE_AI: 15, WHITE_LABEL: 30, PABX: 25 };

// ─── Construção ────────────────────────────────────────────────────────────

type Espera = { motivo: MotivoDaEspera; desdeDias: number; detalhe: string | null };
type Spec = {
  id: string;
  empresa: string;
  documento: string | null;
  familia: Familia;
  tipo?: TipoDeProjeto;
  estado: EstadoDoProjeto;
  entrouDias: number;
  concluidas: number;
  responsavel: Usuario | null;
  pessoas: Pessoa[];
  produto: string;
  quantidade: number;
  unidade: string;
  mensalidade: number | null;
  setup: number | null;
  complementos?: string[];
  espera?: Espera;
  ciclo?: number;
  concluidoDias?: number;
  nps?: number;
  linksOcultos?: Array<"contrato" | "stripe" | "proposta">;
  esperaAcumulada?: Partial<Record<MotivoDaEspera, number>>;
  iniciado?: boolean;
};

function montarTarefas(spec: Spec, entrou: Date): TarefaDoProjeto[] {
  const base = MOLDES[spec.familia].filter((m) => !m.condicional || (spec.complementos ?? []).length > 0);
  const concluido = spec.estado === "CONCLUIDO";
  return base.map((m, i) => {
    const feita = concluido || i < spec.concluidas;
    const ehAtual = !feita && i === spec.concluidas;
    let estado: EstadoDaTarefa = feita ? "CONCLUIDA" : "A_FAZER";
    if (ehAtual) estado = spec.estado === "AGUARDANDO" ? "AGUARDANDO" : spec.estado === "NAO_INICIADO" ? "A_FAZER" : "EM_ANDAMENTO";
    const vence = new Date(entrou.getTime() + m.prazoDia * D);
    const itens = m.itens.map((t, j) => ({
      id: `${spec.id}-${m.passo}-i${j}`,
      titulo: t,
      feito: feita || (ehAtual && j < Math.floor(m.itens.length / 2)),
      ordem: j,
    }));
    return {
      id: `${spec.id}-${m.passo}`,
      ordem: i,
      passo: m.passo,
      titulo: m.titulo,
      playbook: m.playbook,
      estado,
      prioridade: m.prioridade,
      responsavel: spec.responsavel ? { ...spec.responsavel, telefone: null, cargo: null } : null,
      venceEm: vence,
      venceEmOriginal: i === 1 && spec.espera ? new Date(vence.getTime() - 2 * D) : null,
      atrasada: !feita && vence.getTime() < AGORA.getTime(),
      concluidaEm: feita ? new Date(Math.min(AGORA.getTime(), vence.getTime() - D)) : null,
      itens,
      condicional: Boolean(m.condicional),
      comentarios: ehAtual ? 2 : 0,
    };
  });
}

function calcularProgresso(tarefas: TarefaDoProjeto[]): number {
  const aplica = tarefas.filter((t) => t.estado !== "NAO_SE_APLICA");
  if (aplica.length === 0) return 0;
  return aplica.filter((t) => t.estado === "CONCLUIDA").length / aplica.length;
}

function calcularRelogios(spec: Spec, entrou: Date, t0: Date | null): Relogios {
  const fim = spec.concluidoDias !== undefined ? atras(spec.concluidoDias) : AGORA;
  const corridas = (fim.getTime() - entrou.getTime()) / H;
  const acum: Record<MotivoDaEspera, number> = { cliente: 0, operadora: 0, interno: 0, ...spec.esperaAcumulada };
  const emCurso = spec.espera ? { ...spec.espera } : null;
  const horasEmCurso = emCurso ? emCurso.desdeDias * 24 : 0;
  const descontado = acum.cliente + acum.operadora + acum.interno + horasEmCurso;
  const inicioDoPrazo = t0 ?? entrou;
  const prazoDias = PRAZO[spec.familia];
  const comecou = spec.familia !== "PABX" || t0 !== null;
  const vence = comecou ? new Date(inicioDoPrazo.getTime() + prazoDias * D) : null;
  const diasDeAtraso = vence ? Math.round((fim.getTime() - vence.getTime()) / D) : null;
  return {
    horasCorridas: Math.max(0, corridas),
    horasDoTime: Math.max(0, corridas - descontado),
    prazoDias,
    venceEm: vence,
    diasDeAtraso,
    consumoDoPrazo: comecou ? Math.max(0, (fim.getTime() - inicioDoPrazo.getTime()) / (prazoDias * D)) : null,
    esperando: emCurso ? { motivo: emCurso.motivo, desde: atras(emCurso.desdeDias), detalhe: emCurso.detalhe } : null,
    esperaAcumulada: acum,
  };
}

function eventos(spec: Spec, entrou: Date, tarefas: TarefaDoProjeto[]): EventoDoProjeto[] {
  const ev: EventoDoProjeto[] = [
    { id: `${spec.id}-e0`, em: entrou, tipo: "projeto_criado", titulo: "Projeto criado a partir da venda", detalhe: `${spec.produto} · ${spec.quantidade} ${spec.unidade}`, autor: "sistema", porQuem: null },
    { id: `${spec.id}-e1`, em: new Date(entrou.getTime() + 2 * H), tipo: "responsavel", titulo: `Responsável definido: ${spec.responsavel?.nome ?? "ninguém"}`, detalhe: "Regra do produto em Ajustes", autor: "sistema", porQuem: null },
  ];
  tarefas.filter((t) => t.concluidaEm).forEach((t, i) => {
    ev.push({ id: `${spec.id}-c${i}`, em: t.concluidaEm as Date, tipo: "tarefa_concluida", titulo: `Tarefa concluída: ${t.titulo}`, detalhe: null, autor: "time", porQuem: spec.responsavel?.nome ?? null });
  });
  if (spec.espera) {
    ev.push({ id: `${spec.id}-esp`, em: atras(spec.espera.desdeDias), tipo: "espera_iniciada", titulo: `Espera iniciada: ${spec.espera.motivo}`, detalhe: spec.espera.detalhe, autor: "time", porQuem: spec.responsavel?.nome ?? null });
  }
  if (spec.pessoas[0] && spec.familia === "CALLFACE_AI" && spec.concluidas >= 2) {
    ev.push({ id: `${spec.id}-form`, em: atras(spec.entrouDias - 3), tipo: "formulario_respondido", titulo: "Formulário de levantamento respondido", detalhe: null, autor: "cliente", porQuem: spec.pessoas[0].nome });
  }
  return ev.sort((a, b) => b.em.getTime() - a.em.getTime());
}

function montar(spec: Spec): Projeto {
  const entrou = atras(spec.entrouDias);
  const iniciou = spec.iniciado ?? true;
  const t0 = spec.familia === "PABX" && iniciou ? new Date(entrou.getTime() + 2 * D) : null;
  const tarefas = montarTarefas(spec, entrou);
  const empresaId = `emp-${spec.id}`;
  const oculto = new Set(spec.linksOcultos ?? []);
  const familiaVenda = spec.familia === "CALLFACE_AI" ? "mensal" : "mensal";
  return {
    id: spec.id,
    tipo: spec.tipo ?? (spec.familia === "CALLFACE_AI" ? "ONBOARDING" : "IMPLEMENTATION"),
    familia: spec.familia,
    estado: spec.estado,
    ciclo: spec.ciclo ?? 1,
    empresa: { id: empresaId, nome: spec.empresa, documento: spec.documento },
    pessoas: spec.pessoas,
    responsavel: spec.responsavel,
    vendedor: VENDEDORA,
    escopo: {
      familia: spec.familia,
      produto: spec.produto,
      quantidade: spec.quantidade,
      unidade: spec.unidade,
      mensalidade: spec.mensalidade,
      setup: spec.setup,
      recorrencia: spec.mensalidade === null ? null : familiaVenda,
      complementos: spec.complementos ?? [],
    },
    links: {
      cliente360: `/clientes/${empresaId}`,
      oportunidade: `/pipeline?negocio=${spec.id}`,
      proposta: oculto.has("proposta") ? null : `/propostas/${spec.id}`,
      contrato: oculto.has("contrato") ? null : `https://contratos.exemplo.invalid/${spec.id}`,
      stripe: oculto.has("stripe") ? null : `https://dashboard.stripe.com/customers/cus_${spec.id}`,
      projetoIrmao: null,
      formularioPublico: spec.familia === "CALLFACE_AI" ? `https://app.exemplo.invalid/f/${spec.id}` : null,
    },
    entrouEm: entrou,
    t0Em: t0,
    concluidoEm: spec.concluidoDias !== undefined ? atras(spec.concluidoDias) : null,
    relogios: calcularRelogios(spec, entrou, t0),
    tarefas,
    progresso: calcularProgresso(tarefas),
    timeline: eventos(spec, entrou, tarefas),
    levantamento: {
      perfilDeUso: spec.pessoas.length > 2 ? "gestor_com_equipe" : "individual",
      crmQueUsa: spec.id === "p-aurora" ? "RD Station CRM" : null,
      objetivoComACallface: spec.id === "p-aurora" ? "Reduzir o tempo de primeira resposta a novos pacientes." : null,
      extras: [{ chave: "horario_pico", rotulo: "Horário de pico de ligações", valor: spec.id === "p-aurora" ? "9h às 11h" : null }],
    },
    notas: spec.id === "p-aurora" ? [{ id: "n1", em: atras(3), por: "Ana Ribeiro", texto: "Dra. Helena prefere contato por WhatsApp antes das 10h." }] : [],
    formulario: spec.familia === "CALLFACE_AI"
      ? {
          status: spec.concluidas >= 2 ? "respondido" : spec.concluidas === 1 ? "enviado" : "nao_enviado",
          enviadoEm: spec.concluidas >= 1 ? atras(spec.entrouDias - 1) : null,
          respondidoEm: spec.concluidas >= 2 ? atras(spec.entrouDias - 3) : null,
          respondidoPor: spec.concluidas >= 2 ? spec.pessoas[0]?.nome ?? null : null,
          respostas: spec.concluidas >= 2
            ? [
                { pergunta: "Quantas pessoas vão usar o sistema?", resposta: String(spec.quantidade), arquivo: null },
                { pergunta: "Qual o principal objetivo?", resposta: "Atender mais rápido quem chega pelo anúncio.", arquivo: null },
                { pergunta: "Roteiro de abordagem atual", resposta: "roteiro-recepcao.pdf", arquivo: { nome: "roteiro-recepcao.pdf", url: `/pos-vendas/${spec.id}` } },
              ]
            : [],
          link: `https://app.exemplo.invalid/f/${spec.id}`,
        }
      : null,
    nps: spec.nps !== undefined
      ? { enviadoEm: atras(8), abertoEm: atras(7), respondidoEm: atras(7), nota: spec.nps, faixa: spec.nps >= 9 ? "promotor" : spec.nps >= 7 ? "neutro" : "detrator", comentario: "Atendimento rápido e o time entendeu a rotina da clínica.", link: `https://app.exemplo.invalid/nps/${spec.id}`, esperaAte: null }
      : spec.familia === "CALLFACE_AI"
        ? { enviadoEm: null, abertoEm: null, respondidoEm: null, nota: null, faixa: null, comentario: null, link: `https://app.exemplo.invalid/nps/${spec.id}`, esperaAte: null }
        : null,
    retratoDeUso: spec.familia === "CALLFACE_AI" && spec.estado === "CONCLUIDO"
      ? { capturadoEm: atras(spec.concluidoDias ?? 0), primeiroAcessoEm: atras(spec.entrouDias - 5), ultimoAcessoEm: atras(spec.concluidoDias ?? 0), ligacoesFeitas: 214, campanhasDisparadas: 3, agenteConfigurado: true, indisponivel: false }
      : null,
    herdadoDe: spec.ciclo && spec.ciclo > 1
      ? { projetoId: `${spec.id}-c1`, concluidoEm: atras(spec.entrouDias + 40), passosHerdados: ["contato_boas_vindas", "configuracao_conta"] }
      : null,
    permissoes: {
      podeConcluirTarefa: true,
      podeMarcarEspera: spec.estado !== "CONCLUIDO" && spec.estado !== "CANCELADO",
      podeEscalarParaImplantacao: spec.familia === "CALLFACE_AI" && spec.estado === "EM_VALIDACAO",
      podeFazerHandoff: spec.familia !== "CALLFACE_AI" && spec.estado === "EM_VALIDACAO",
      podeDarBaixaSemNps: false,
      podeEditarPrazo: true,
    },
  };
}

const SPECS: Spec[] = [
  { id: "p-aurora", empresa: "Clínica Aurora Odontologia", documento: "12.345.678/0001-90", familia: "CALLFACE_AI", estado: "EM_ANDAMENTO", entrouDias: 8, concluidas: 2, responsavel: ANA, pessoas: [pessoa("a1", "Helena Prado", "Sócia-diretora", "(11) 98888-1020"), pessoa("a2", "Rafael Lima", "Recepção"), pessoa("a3", "Julia Mota", "Marketing")], produto: "Callface AI Pro", quantidade: 6, unidade: "usuários", mensalidade: 1490, setup: 990, complementos: ["agente_ia"] },
  { id: "p-meridian", empresa: "Meridian Seguros", documento: "98.765.432/0001-10", familia: "CALLFACE_AI", estado: "AGUARDANDO", entrouDias: 19, concluidas: 1, responsavel: ANA, pessoas: [pessoa("m1", "Otávio Brandão", "Gerente comercial"), pessoa("m2", "Paula Reis", "Coordenação")], produto: "Callface AI Essencial", quantidade: 12, unidade: "usuários", mensalidade: 2890, setup: null, espera: { motivo: "cliente", desdeDias: 6, detalhe: "Aguardando lista de usuários e acesso ao CRM" }, esperaAcumulada: { cliente: 30 }, linksOcultos: ["contrato"] },
  { id: "p-torre", empresa: "Torre Forte Engenharia", documento: "45.321.987/0001-55", familia: "CALLFACE_AI", estado: "EM_VALIDACAO", entrouDias: 13, concluidas: 5, responsavel: DIEGO, pessoas: [pessoa("t1", "Marcos Vieira", "Diretor comercial")], produto: "Callface AI Pro", quantidade: 4, unidade: "usuários", mensalidade: 990, setup: 990 },
  { id: "p-lume", empresa: "Grupo Lume Educação", documento: "33.222.111/0001-77", familia: "CALLFACE_AI", estado: "CONCLUIDO", entrouDias: 32, concluidas: 6, concluidoDias: 3, responsavel: ANA, pessoas: [pessoa("l1", "Beatriz Cunha", "Coordenadora de admissões"), pessoa("l2", "Henrique Alves", "Vendas")], produto: "Callface AI Pro", quantidade: 8, unidade: "usuários", mensalidade: 1990, setup: 990, nps: 9, complementos: ["agente_ia"] },
  { id: "p-sol", empresa: "Atelier Sol Nascente", documento: "18.402.771/0001-06", familia: "CALLFACE_AI", estado: "CONCLUIDO", entrouDias: 20, concluidas: 6, concluidoDias: 5, responsavel: DIEGO, pessoas: [pessoa("s1", "Luiza Antunes", "Proprietária")], produto: "Callface AI Essencial", quantidade: 2, unidade: "usuários", mensalidade: 390, setup: null, nps: 8 },
  { id: "p-no", empresa: "Studio Nó Design", documento: null, familia: "CALLFACE_AI", estado: "EM_ANDAMENTO", entrouDias: 4, concluidas: 1, responsavel: DIEGO, pessoas: [pessoa("n1", "Camila Torres", "Fundadora")], produto: "Callface AI Essencial", quantidade: 3, unidade: "usuários", mensalidade: 590, setup: null, ciclo: 2, linksOcultos: ["stripe", "proposta"] },
  { id: "p-vexa", empresa: "Vexa Telecom Parceiros", documento: "21.654.987/0001-02", familia: "WHITE_LABEL", estado: "EM_ANDAMENTO", entrouDias: 12, concluidas: 1, responsavel: BRUNO, pessoas: [pessoa("v1", "Leandro Faria", "CEO"), pessoa("v2", "Sônia Dias", "Operações"), pessoa("v3", "Pedro Gomes", "TI"), pessoa("v4", "Íris Campos", "Comercial")], produto: "White Label Revenda", quantidade: 50, unidade: "licenças", mensalidade: 7500, setup: 4000 },
  { id: "p-orbita", empresa: "Órbita Cloud Revenda", documento: "10.101.202/0001-33", familia: "WHITE_LABEL", estado: "NAO_INICIADO", entrouDias: 1, concluidas: 0, responsavel: null, pessoas: [], produto: "White Label Revenda", quantidade: 20, unidade: "licenças", mensalidade: 3200, setup: 4000, iniciado: false },
  { id: "p-praca", empresa: "Mercado Praça Viva", documento: "55.444.333/0001-21", familia: "PABX", estado: "AGUARDANDO", entrouDias: 17, concluidas: 1, responsavel: BRUNO, pessoas: [pessoa("pv1", "Silvana Rocha", "Proprietária", "(11) 97777-3344"), pessoa("pv2", "Edson Pires", "Financeiro")], produto: "PABX em nuvem", quantidade: 18, unidade: "ramais", mensalidade: 1260, setup: 1500, espera: { motivo: "operadora", desdeDias: 5, detalhe: "Aguardando portabilidade da Vivo — protocolo 88213450" }, esperaAcumulada: { cliente: 22, operadora: 0 } },
  { id: "p-pedra", empresa: "Construtora Pedra Alta", documento: "77.888.999/0001-44", familia: "PABX", estado: "EM_ANDAMENTO", entrouDias: 31, concluidas: 2, responsavel: null, pessoas: [pessoa("pa1", "Nelson Barros", "Diretor administrativo")], produto: "PABX em nuvem", quantidade: 40, unidade: "ramais", mensalidade: 2800, setup: 3000, linksOcultos: ["contrato"], esperaAcumulada: { operadora: 36 } },
  { id: "p-vitta", empresa: "Rede Vitta Farma", documento: "66.123.456/0001-88", familia: "PABX", estado: "CONCLUIDO", entrouDias: 41, concluidas: 5, concluidoDias: 14, responsavel: BRUNO, pessoas: [pessoa("vi1", "Alessandra Neri", "TI")], produto: "PABX em nuvem", quantidade: 25, unidade: "ramais", mensalidade: 1750, setup: 1500, esperaAcumulada: { operadora: 60, cliente: 12 } },
];

// ─── Estado em memória ─────────────────────────────────────────────────────

const store = new Map<string, Projeto>(SPECS.map((s) => [s.id, montar(s)]));

export function projetoDev(id: string): Projeto | null {
  return store.get(id) ?? null;
}

function cartaoDe(p: Projeto): CartaoDoProjeto {
  const aplica = p.tarefas.filter((t) => t.estado !== "NAO_SE_APLICA");
  const proxima = p.tarefas.find((t) => t.estado !== "CONCLUIDA" && t.estado !== "NAO_SE_APLICA") ?? null;
  return {
    id: p.id,
    tipo: p.tipo,
    familia: p.familia,
    estado: p.estado,
    empresa: { id: p.empresa.id, nome: p.empresa.nome },
    responsavel: p.responsavel,
    pessoas: p.pessoas,
    escopoResumo: p.escopo?.produto ? `${p.escopo.produto}${p.escopo.quantidade ? ` · ${p.escopo.quantidade} ${p.escopo.unidade ?? ""}` : ""}`.trim() : null,
    entrouEm: p.entrouEm,
    relogios: {
      horasCorridas: p.relogios.horasCorridas,
      horasDoTime: p.relogios.horasDoTime,
      venceEm: p.relogios.venceEm,
      diasDeAtraso: p.relogios.diasDeAtraso,
      consumoDoPrazo: p.relogios.consumoDoPrazo,
      esperando: p.relogios.esperando,
    },
    progresso: p.progresso,
    tarefasConcluidas: aplica.filter((t) => t.estado === "CONCLUIDA").length,
    tarefasTotal: aplica.length,
    proximaTarefa: proxima ? { titulo: proxima.titulo, venceEm: proxima.venceEm, atrasada: proxima.atrasada } : null,
  };
}

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const aberto = (c: CartaoDoProjeto) => c.estado !== "CONCLUIDO" && c.estado !== "CANCELADO";
const atrasado = (c: CartaoDoProjeto) => aberto(c) && (c.relogios.diasDeAtraso ?? 0) > 0;

export function boardDev(f: FiltrosDoBoard): Board {
  const todos = [...store.values()].map(cartaoDe);
  const inicioDoMes = new Date(AGORA.getFullYear(), AGORA.getMonth(), 1).getTime();
  const concluidosNoMes = [...store.values()].filter((p) => p.concluidoEm && p.concluidoEm.getTime() >= inicioDoMes);

  const amostra = [...store.values()]
    .filter((p) => p.concluidoEm && AGORA.getTime() - p.concluidoEm.getTime() <= 90 * D)
    .map((p) => ((p.concluidoEm as Date).getTime() - p.entrouEm.getTime()) / D)
    .sort((a, b) => a - b);
  const notas = [...store.values()].flatMap((p) => (p.nps?.nota !== null && p.nps?.nota !== undefined ? [p.nps.nota] : []));

  const idsDoMes = new Set(concluidosNoMes.map((p) => p.id));
  const passa = (c: CartaoDoProjeto, ignorarFamilia: boolean) => {
    if (!ignorarFamilia && f.familia && c.familia !== f.familia) return false;
    if (f.tipo && c.tipo !== f.tipo) return false;
    if (f.responsavelId && c.responsavel?.id !== f.responsavelId) return false;
    // Sem `estado`, o board mostra o que está em aberto. "Concluídos no mês" é
    // um recorte que atravessa essa regra.
    const estadoOk = f.recorte === "concluidos_mes" ? idsDoMes.has(c.id) : f.estado ? c.estado === f.estado : aberto(c);
    if (!estadoOk) return false;
    if (f.recorte === "atrasados" && !atrasado(c)) return false;
    if (f.recorte === "aguardando_cliente" && c.relogios.esperando?.motivo !== "cliente") return false;
    if (f.recorte === "sem_responsavel" && c.responsavel) return false;
    if (f.busca && !semAcento(c.empresa.nome).includes(semAcento(f.busca))) return false;
    return true;
  };

  const cartoes = todos.filter((c) => passa(c, false));
  const porFamilia: Record<Familia, number> = { CALLFACE_AI: 0, PABX: 0, WHITE_LABEL: 0 };
  todos.filter((c) => passa(c, true)).forEach((c) => { porFamilia[c.familia] += 1; });

  const mediana = amostra.length >= 3 ? amostra[Math.floor(amostra.length / 2)] : null;
  return {
    indicadores: {
      emAndamento: todos.filter((c) => c.estado === "EM_ANDAMENTO").length,
      aguardandoCliente: todos.filter((c) => aberto(c) && c.relogios.esperando?.motivo === "cliente").length,
      atrasados: todos.filter(atrasado).length,
      concluidosNoMes: concluidosNoMes.length,
      tempoMedianoDias: mediana,
      npsMedio: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null,
    },
    cartoes,
    porFamilia,
    filtros: f,
    total: cartoes.length,
  };
}

// ─── Ações em memória ──────────────────────────────────────────────────────

const ok = (): Resultado => ({ ok: true, dados: undefined });
const nao = (erro: string): Resultado => ({ ok: false, erro });

function recalcular(p: Projeto) {
  p.progresso = calcularProgresso(p.tarefas);
  const aplica = p.tarefas.filter((t) => t.estado !== "NAO_SE_APLICA");
  if (p.estado !== "CONCLUIDO" && p.estado !== "CANCELADO" && aplica.length > 0 && aplica.every((t) => t.estado === "CONCLUIDA")) p.estado = "EM_VALIDACAO";
}

function registrar(p: Projeto, titulo: string, detalhe: string | null = null, tipo = "acao") {
  p.timeline.unshift({ id: `ev-${Date.now()}-${p.timeline.length}`, em: new Date(), tipo, titulo, detalhe, autor: "time", porQuem: "Você (dev)" });
}

export const motorDev = {
  concluirTarefa(projetoId: string, tarefaId: string): Resultado {
    const p = store.get(projetoId); const t = p?.tarefas.find((x) => x.id === tarefaId);
    if (!p || !t) return nao("Tarefa não encontrada.");
    t.estado = "CONCLUIDA"; t.concluidaEm = new Date(); t.atrasada = false;
    t.itens.forEach((i) => { i.feito = true; });
    registrar(p, `Tarefa concluída: ${t.titulo}`, null, "tarefa_concluida");
    recalcular(p);
    return ok();
  },
  reabrirTarefa(projetoId: string, tarefaId: string): Resultado {
    const p = store.get(projetoId); const t = p?.tarefas.find((x) => x.id === tarefaId);
    if (!p || !t) return nao("Tarefa não encontrada.");
    t.estado = "EM_ANDAMENTO"; t.concluidaEm = null; t.atrasada = Boolean(t.venceEm && t.venceEm.getTime() < Date.now());
    if (p.estado === "EM_VALIDACAO") p.estado = "EM_ANDAMENTO";
    registrar(p, `Tarefa reaberta: ${t.titulo}`, null, "tarefa_reaberta");
    recalcular(p);
    return ok();
  },
  marcarItem(projetoId: string, itemId: string, feito: boolean): Resultado {
    const p = store.get(projetoId); const i = p?.tarefas.flatMap((t) => t.itens).find((x) => x.id === itemId);
    if (!p || !i) return nao("Item não encontrado.");
    i.feito = feito;
    return ok();
  },
  atribuirTarefa(projetoId: string, tarefaId: string, usuarioId: string | null): Resultado {
    const p = store.get(projetoId); const t = p?.tarefas.find((x) => x.id === tarefaId);
    if (!p || !t) return nao("Tarefa não encontrada.");
    const u = EQUIPE_DEV.find((x) => x.id === usuarioId) ?? null;
    t.responsavel = u ? { id: u.id, nome: u.nome, email: u.email, telefone: null, cargo: null, iniciais: u.iniciais } : null;
    registrar(p, u ? `Tarefa atribuída a ${u.nome}` : "Tarefa ficou sem responsável", t.titulo, "tarefa_atribuida");
    return ok();
  },
  remarcarTarefa(projetoId: string, tarefaId: string, venceEm: Date): Resultado {
    const p = store.get(projetoId); const t = p?.tarefas.find((x) => x.id === tarefaId);
    if (!p || !t) return nao("Tarefa não encontrada.");
    t.venceEmOriginal = t.venceEmOriginal ?? t.venceEm;
    t.venceEm = venceEm; t.atrasada = t.estado !== "CONCLUIDA" && venceEm.getTime() < Date.now();
    registrar(p, `Tarefa remarcada: ${t.titulo}`, null, "tarefa_remarcada");
    return ok();
  },
  marcarEspera(projetoId: string, motivo: MotivoDaEspera, detalhe: string | null): Resultado {
    const p = store.get(projetoId);
    if (!p) return nao("Projeto não encontrado.");
    if (p.relogios.esperando) return nao("Este projeto já está em espera.");
    p.relogios.esperando = { motivo, desde: new Date(), detalhe };
    p.estado = "AGUARDANDO";
    registrar(p, `Espera iniciada: ${motivo}`, detalhe, "espera_iniciada");
    return ok();
  },
  encerrarEspera(projetoId: string): Resultado {
    const p = store.get(projetoId);
    if (!p?.relogios.esperando) return nao("Não há espera em curso.");
    const e = p.relogios.esperando;
    p.relogios.esperaAcumulada[e.motivo] += (Date.now() - e.desde.getTime()) / H;
    p.relogios.esperando = null;
    p.estado = "EM_ANDAMENTO";
    registrar(p, "Espera encerrada", null, "espera_encerrada");
    return ok();
  },
  adicionarNota(projetoId: string, texto: string): Resultado {
    const p = store.get(projetoId);
    if (!p) return nao("Projeto não encontrado.");
    p.notas.unshift({ id: `nota-${Date.now()}`, em: new Date(), por: "Você (dev)", texto });
    registrar(p, "Nota adicionada", texto, "nota");
    return ok();
  },
  salvarLevantamento(projetoId: string, campos: Partial<Projeto["levantamento"]>): Resultado {
    const p = store.get(projetoId);
    if (!p) return nao("Projeto não encontrado.");
    p.levantamento = { ...p.levantamento, ...campos };
    registrar(p, "Levantamento atualizado", null, "levantamento");
    return ok();
  },
};
