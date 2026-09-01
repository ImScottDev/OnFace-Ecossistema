import { Building2, User, Bot } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";

/**
 * Avatar de ENTIDADE do CRM2 (30/08) — construído sobre o `avatar` do
 * shadcn/ui (pedido do Kauã: usar os componentes prontos como base em vez de
 * inventar). Um componente só resolve lead, contato, empresa e usuário, que
 * antes eram três marcações diferentes espalhadas (círculo de iniciais na
 * Performance do Time, quadrado com inicial no Onboarding, etc).
 *
 * O que ele adiciona por cima do shadcn:
 *  - iniciais derivadas do nome, com fallback de ÍCONE por tipo quando não há
 *    nome (empresa → prédio, pessoa → usuário, agente → bot) — antes um nome
 *    vazio virava um círculo com string vazia;
 *  - cor determinística por nome, então a MESMA pessoa tem sempre a mesma cor
 *    em todas as telas (antes a cor vinha do índice da lista, ou seja, mudava
 *    conforme a ordenação — a mesma pessoa aparecia de cores diferentes);
 *  - empresa usa cantos arredondados (não círculo), convenção que distingue
 *    organização de pessoa à primeira vista.
 */

export type TipoEntidade = "pessoa" | "empresa" | "usuario" | "agente";

const ICONE_VAZIO = { pessoa: User, empresa: Building2, usuario: User, agente: Bot } as const;

const PALETA = [
  "var(--cf2-avatar-1)", "var(--cf2-avatar-2)", "var(--cf2-avatar-3)",
  "var(--cf2-avatar-4)", "var(--cf2-avatar-5)",
];

/** Hash estável do nome → índice de cor. Mesma pessoa, mesma cor, sempre. */
function corDoNome(nome: string) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

export function iniciaisDe(nome: string | null | undefined) {
  if (!nome?.trim()) return "";
  return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function Cf2Avatar({
  nome, tipo = "pessoa", src, size = "default", className,
}: {
  nome: string | null | undefined;
  tipo?: TipoEntidade;
  src?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const iniciais = iniciaisDe(nome);
  const Icone = ICONE_VAZIO[tipo];
  const cor = nome ? corDoNome(nome) : "var(--cf2-bg-surface-muted)";

  return (
    <Avatar
      size={size}
      title={nome ?? undefined}
      className={cn(tipo === "empresa" && "rounded-[10px] [&>*]:rounded-[10px]", className)}
    >
      {src && <AvatarImage src={src} alt={nome ?? ""} />}
      <AvatarFallback
        className="font-bold"
        style={iniciais ? { background: cor, color: "var(--cf2-home-lime-ink)" } : undefined}
      >
        {iniciais || <Icone className="size-3.5" style={{ color: "var(--cf2-text-secondary)" }} />}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * Pilha de avatares com contador de excedente — o "+3" sai do próprio
 * `AvatarGroupCount` do shadcn, em vez de ser um `<span>` improvisado.
 */
export function Cf2AvatarGrupo({
  nomes, max = 4, size = "sm", tipo = "pessoa", className,
}: {
  nomes: string[];
  max?: number;
  size?: "sm" | "default" | "lg";
  tipo?: TipoEntidade;
  className?: string;
}) {
  if (nomes.length === 0) return null;
  const visiveis = nomes.slice(0, max);
  const resto = nomes.length - visiveis.length;

  return (
    <AvatarGroup className={className}>
      {visiveis.map((n) => (
        <Cf2Avatar key={n} nome={n} tipo={tipo} size={size} />
      ))}
      {resto > 0 && (
        <AvatarGroupCount className={size === "sm" ? "size-6 text-xs" : undefined} title={nomes.slice(max).join(", ")}>
          +{resto}
        </AvatarGroupCount>
      )}
    </AvatarGroup>
  );
}
