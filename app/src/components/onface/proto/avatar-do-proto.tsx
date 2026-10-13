import * as React from "react";
import { IniciaisUsuario, NomeUsuario, SeloIA } from "@/components/ui/avatar";

/**
 * Conteúdo do avatar para os desenhos (que recebem `iniciais` como valor):
 * iniciais da pessoa, ou o selo de IA quando o nome é de um agente da
 * organização. A decisão vem do contexto da casca (`AgentesDaOrgContexto`);
 * `ehAgente` explícito, quando o dado já traz, vale mais que o nome.
 */
export function avatarDe(nome: string | null | undefined, iniciais?: string, ehAgente?: boolean): React.ReactNode {
  if (!nome) return iniciais ?? "—";
  return <IniciaisUsuario nome={nome} iniciais={iniciais} ehAgente={ehAgente} />;
}

/**
 * Autor de um evento/nota para os desenhos: nome com selo de IA quando foi um
 * agente (`atorTipo === "AI_AGENT"` ou usuário-agente); sem nome, o rótulo do ator.
 */
export function autorDoEvento(e: { usuarioNome?: string | null; atorTipo?: string | null }, padrao = "Sistema"): React.ReactNode {
  const ia = e.atorTipo === "AI_AGENT";
  if (e.usuarioNome) return <NomeUsuario nome={e.usuarioNome} ehAgente={ia || undefined} />;
  if (ia) return <span className="inline-flex items-center gap-1"><SeloIA className="size-3" />Agente de IA</span>;
  return padrao;
}
