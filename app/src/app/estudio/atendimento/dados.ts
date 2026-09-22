/** Contrato e amostra da tela de Atendimento.
 *
 * Canal e status seguem o que o CRM já tem hoje em `components/crm2/atendimento`.
 * Integrar = trocar `CONVERSAS_AMOSTRA` pela consulta; o componente recebe tudo
 * por props. */

export type Canal = "whatsapp" | "email" | "ligacao";

export const ROTULO_CANAL: Record<Canal, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  ligacao: "Ligação",
};

export type Conversa = {
  id: string;
  contato: string;
  empresa: string;
  iniciais: string;
  canal: Canal;
  ultimaMensagem: string;
  quando: string;
  naoLidas: number;
  responsavel: string | null;
  aguardandoHa: string | null;
};

export type Mensagem = {
  id: string;
  autor: "cliente" | "equipe";
  nome: string;
  texto: string;
  quando: string;
};

export const CONVERSAS_AMOSTRA: Conversa[] = [
  { id: "c1", contato: "Thays Luana", empresa: "Suprema Farma", iniciais: "TL", canal: "whatsapp", ultimaMensagem: "Boa tarde! O boleto que venceu ontem ainda dá pra pagar?", quando: "há 4 min", naoLidas: 2, responsavel: null, aguardandoHa: "4 min" },
  { id: "c2", contato: "Ricardo Alves", empresa: "Transportes Rota Norte", iniciais: "RA", canal: "email", ultimaMensagem: "Segue em anexo o contrato assinado pela diretoria.", quando: "há 22 min", naoLidas: 1, responsavel: "Bruno Alves", aguardandoHa: null },
  { id: "c3", contato: "Camila Souza", empresa: "Clínica Odonto Prime", iniciais: "CS", canal: "whatsapp", ultimaMensagem: "Consigo falar com alguém sobre aumentar os ramais?", quando: "há 1 h", naoLidas: 0, responsavel: "Mayara Silva", aguardandoHa: null },
  { id: "c4", contato: "Pedro Henrique", empresa: "Construtora Marco Zero", iniciais: "PH", canal: "ligacao", ultimaMensagem: "Ligação perdida, 42 s", quando: "há 3 h", naoLidas: 0, responsavel: null, aguardandoHa: "3 h" },
  { id: "c5", contato: "Fernanda Lima", empresa: "Grupo Educacional Horizonte", iniciais: "FL", canal: "email", ultimaMensagem: "Podemos remarcar a demo para sexta pela manhã?", quando: "ontem", naoLidas: 0, responsavel: "Jenifer Costa", aguardandoHa: null },
];

export const THREAD_AMOSTRA: Mensagem[] = [
  { id: "m1", autor: "cliente", nome: "Thays Luana", texto: "Oi! Recebi o boleto do plano Callface AI Full, mas ele venceu ontem.", quando: "14:02" },
  { id: "m2", autor: "equipe", nome: "Mayara Silva", texto: "Oi Thays, tudo bem? Deixa eu verificar aqui no sistema, um minutinho.", quando: "14:05" },
  { id: "m3", autor: "equipe", nome: "Mayara Silva", texto: "Achei. O boleto original compensou dia 09, então está tudo certo por aqui. Você não precisa pagar de novo.", quando: "14:09" },
  { id: "m4", autor: "cliente", nome: "Thays Luana", texto: "Que alívio! E a próxima cobrança cai quando?", quando: "14:11" },
  { id: "m5", autor: "cliente", nome: "Thays Luana", texto: "Boa tarde! O boleto que venceu ontem ainda dá pra pagar?", quando: "14:26" },
];
