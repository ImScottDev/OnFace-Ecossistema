"use client";

import { createContext, useContext } from "react";

/** Se a credencial OAuth de cada provedor existe no servidor. Só o booleano
 *  atravessa para o browser; o segredo fica no servidor. */
export type ProvedoresEmail = { microsoftConfigurado: boolean; googleConfigurado: boolean };

const Ctx = createContext<ProvedoresEmail>({ microsoftConfigurado: false, googleConfigurado: false });

export function ProvedoresEmailProvider({ valor, children }: { valor: ProvedoresEmail; children: React.ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useProvedoresEmail = () => useContext(Ctx);
