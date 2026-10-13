/* O id da proposta no estado da tela do Builder.

   O link público NÃO é guardado: é `/p/<id da proposta>`. Então a tela só consegue mostrar e copiar o
   link se o estado do editor (`d.id`) tiver o id da proposta REAL do banco. Três regras, em um lugar só:

   1. Depois de gravar, o id que o servidor devolveu volta para o estado (`comIdGravado`).
   2. O id NÃO vai dentro do `editor` gravado (`semIdNoEditor`): senão a próxima versão, aberta a partir
      desse editor, herdaria o id da anterior e o link apontaria para a proposta errada.
   3. Ao abrir, o id só vale se a tela vai editar/ver ESTA proposta; nova versão nasce sem id, e ganha o
      seu quando o servidor devolve (`idAoAbrir`). */

type Editor = Record<string, any>;

export function comIdGravado<T extends Editor>(d: T, id: string | null | undefined): T {
  return id ? { ...d, id } : d;
}

export function semIdNoEditor<T extends Editor>(d: T): Omit<T, "id"> {
  const { id: _id, ...resto } = d;
  return resto;
}

export function idAoAbrir(modo: "novo" | "editar" | "ver" | "versao", p: { id?: string | null } | null | undefined): string | undefined {
  return (modo === "editar" || modo === "ver") && p?.id ? p.id : undefined;
}
