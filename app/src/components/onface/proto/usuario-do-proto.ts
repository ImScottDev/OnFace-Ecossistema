"use client";

import * as React from "react";

/**
 * Quem está usando o produto, para as telas portadas do protótipo.
 *
 * O protótipo fixa "Scott Ferraz" como o usuário — no perfil da casca e como
 * AUTOR de nota, evento e atividade criados pela tela. Sem isto, qualquer
 * pessoa que usasse o ONFACE apareceria (e gravaria) como o Scott.
 *
 * Contexto, e não variável de módulo: no servidor o módulo é compartilhado
 * entre requisições, e o usuário de uma vazaria para a outra. A casca
 * (`CascaProto`) fornece; as `*Liga` leem por `static contextType`, que o
 * portador (`scripts/dc-logica-para-tsx.mjs`) acrescenta.
 */
export interface UsuarioDoProto {
  nome: string;
  email: string;
  iniciais: string;
  organizacao: string;
}

export const UsuarioDoProtoContexto = React.createContext<UsuarioDoProto | null>(null);

export function iniciaisDe(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "—";
}
