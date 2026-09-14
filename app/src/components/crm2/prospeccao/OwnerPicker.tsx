"use client";

import { UserRound } from "lucide-react";
import { corAvatarEmpresa, iniciaisEmpresa, TEXTO_SOBRE_AVATAR } from "@/components/crm2/shared/avatar";
import {
  Cf2DropdownMenu, Cf2DropdownMenuContent, Cf2DropdownMenuItem, Cf2DropdownMenuTrigger,
} from "@/components/crm2/ui/DropdownMenu";

/**
 * Responsável clicável — abre lista de usuários pra reatribuir. Usado na
 * linha da lista e no painel do drawer (pedido do Kauã 25/08: "responsável
 * em canto nenhum dá pra editar"). Mesmo componente nos dois lugares pra
 * não divergir comportamento.
 */
export function OwnerPicker({
  ownerId, ownerName, usuarios, onAssign, size = 22, align = "end",
}: {
  ownerId?: string | null;
  ownerName?: string | null;
  usuarios: { id: string; nome: string }[];
  onAssign: (userId: string | null) => void;
  size?: number;
  align?: "start" | "end";
}) {
  return (
    <Cf2DropdownMenu>
      <Cf2DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          title={ownerName || "Sem responsável — clique para atribuir"}
          className="shrink-0 rounded-full outline-none focus-visible:ring-2 cursor-pointer"
        >
          {ownerId ? (
            <span
              className="flex items-center justify-center rounded-full font-bold"
              style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42), background: corAvatarEmpresa(ownerId), color: TEXTO_SOBRE_AVATAR }}
            >
              {iniciaisEmpresa(ownerName || "?")}
            </span>
          ) : (
            <span
              className="flex items-center justify-center rounded-full border border-dashed"
              style={{ width: size, height: size, borderColor: "var(--cf2-text-tertiary)" }}
            >
              <UserRound style={{ width: size * 0.55, height: size * 0.55, color: "var(--cf2-text-tertiary)" }} />
            </span>
          )}
        </button>
      </Cf2DropdownMenuTrigger>
      <Cf2DropdownMenuContent align={align} className="min-w-[200px]" onClick={(event) => event.stopPropagation()}>
        <Cf2DropdownMenuItem onClick={() => onAssign(null)}>
          <span className="flex items-center justify-center rounded-full border border-dashed size-5 shrink-0" style={{ borderColor: "var(--cf2-text-tertiary)" }} />
          Sem responsável
        </Cf2DropdownMenuItem>
        {usuarios.map((usuario) => (
          <Cf2DropdownMenuItem key={usuario.id} onClick={() => onAssign(usuario.id)}>
            <span
              className="flex items-center justify-center rounded-full font-bold shrink-0 size-5 text-[9px]"
              style={{ background: corAvatarEmpresa(usuario.id), color: TEXTO_SOBRE_AVATAR }}
            >
              {iniciaisEmpresa(usuario.nome)}
            </span>
            {usuario.nome}
          </Cf2DropdownMenuItem>
        ))}
      </Cf2DropdownMenuContent>
    </Cf2DropdownMenu>
  );
}
