export type Membro = {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo?: boolean;
  avatarUrl?: string | null;
};
