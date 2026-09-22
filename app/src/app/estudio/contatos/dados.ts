/** Contrato e amostra da tela de Contatos & Empresas.
 *
 * Integrar = trocar `CONTATOS_AMOSTRA` por uma consulta. O componente recebe
 * tudo por props e não escreve texto no JSX.
 */

export type Situacao = "ativo" | "novo" | "sem-dono" | "inativo";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  ativo: "Ativo",
  novo: "Novo",
  "sem-dono": "Sem dono",
  inativo: "Inativo",
};

export type Contato = {
  id: string;
  nome: string;
  iniciais: string;
  cargo: string;
  empresa: string;
  email: string;
  telefone: string;
  dono: string | null;
  situacao: Situacao;
  ultimaInteracao: string;
  oportunidadesAbertas: number;
};

export const CONTATOS_AMOSTRA: Contato[] = [
  { id: "1", nome: "Thays Luana", iniciais: "TL", cargo: "Diretora", empresa: "Suprema Farma", email: "diretoria@supremafarma.com.br", telefone: "+55 11 99812-4477", dono: "Mayara Silva", situacao: "ativo", ultimaInteracao: "há 4 min", oportunidadesAbertas: 0 },
  { id: "2", nome: "Ricardo Alves", iniciais: "RA", cargo: "Gerente de Operações", empresa: "Transportes Rota Norte", email: "ricardo@rotanorte.com.br", telefone: "+55 41 98771-0032", dono: "Bruno Alves", situacao: "ativo", ultimaInteracao: "há 22 min", oportunidadesAbertas: 1 },
  { id: "3", nome: "Camila Souza", iniciais: "CS", cargo: "Coordenadora", empresa: "Clínica Odonto Prime", email: "camila@odontoprime.com.br", telefone: "+55 21 99140-8865", dono: "Mayara Silva", situacao: "ativo", ultimaInteracao: "há 1 h", oportunidadesAbertas: 1 },
  { id: "4", nome: "Pedro Henrique", iniciais: "PH", cargo: "Sócio", empresa: "Construtora Marco Zero", email: "pedro@marcozero.eng.br", telefone: "+55 31 98220-1194", dono: null, situacao: "sem-dono", ultimaInteracao: "há 3 h", oportunidadesAbertas: 1 },
  { id: "5", nome: "Fernanda Lima", iniciais: "FL", cargo: "Diretora Acadêmica", empresa: "Grupo Educacional Horizonte", email: "fernanda@horizonte.edu.br", telefone: "+55 51 99663-2018", dono: "Jenifer Costa", situacao: "ativo", ultimaInteracao: "ontem", oportunidadesAbertas: 1 },
  { id: "6", nome: "Marcelo Tavares", iniciais: "MT", cargo: "TI", empresa: "Rede Farmacêutica Bem Estar", email: "marcelo.ti@bemestar.com.br", telefone: "+55 11 97744-5521", dono: null, situacao: "novo", ultimaInteracao: "há 2 d", oportunidadesAbertas: 1 },
  { id: "7", nome: "Juliana Prado", iniciais: "JP", cargo: "Compras", empresa: "Supermercados União", email: "juliana.prado@uniao.com.br", telefone: "+55 62 98812-7740", dono: "Mayara Silva", situacao: "novo", ultimaInteracao: "há 3 d", oportunidadesAbertas: 1 },
  { id: "8", nome: "André Bastos", iniciais: "AB", cargo: "Financeiro", empresa: "Metalúrgica Ferro Forte", email: "andre@ferroforte.ind.br", telefone: "+55 47 99031-6688", dono: "Bruno Alves", situacao: "inativo", ultimaInteracao: "há 2 meses", oportunidadesAbertas: 0 },
  { id: "9", nome: "Larissa Monteiro", iniciais: "LM", cargo: "Marketing", empresa: "Agência Ponto Digital", email: "larissa@pontodigital.com", telefone: "+55 11 98450-3327", dono: "Jenifer Costa", situacao: "ativo", ultimaInteracao: "há 5 d", oportunidadesAbertas: 1 },
  { id: "10", nome: "Rogério Neves", iniciais: "RN", cargo: "Proprietário", empresa: "Padaria Pão Quente", email: "rogerio@paoquente.com.br", telefone: "+55 11 99302-4471", dono: null, situacao: "sem-dono", ultimaInteracao: "há 1 mês", oportunidadesAbertas: 1 },
];
