export type Membro = {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo?: boolean;
  avatarUrl?: string | null;
  /** 'agente' = agente de IA que é usuário do sistema. */
  tipo?: string;
};
