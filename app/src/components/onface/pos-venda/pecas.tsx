/**
 * Peças pequenas do pós-venda, compartilhadas entre o board e o projeto.
 * Sem "use client": são marcação pura, renderizam no servidor.
 */
import { UserRound } from "lucide-react";
import type { EstadoDaTarefa, EstadoDoProjeto, Familia } from "@/lib/pos-venda/contrato";
import { corDoAvatar, ESTADO_DA_TAREFA, ESTADO_DO_PROJETO, FAMILIAS, percentual, type Tom } from "./formatos";

export function PilulaDeEstado({ estado, className }: { estado: EstadoDoProjeto; className?: string }) {
  const { rotulo, tom } = ESTADO_DO_PROJETO[estado];
  return (
    <span className={className ? `pv-pilula ${className}` : "pv-pilula"} data-pv-tom={tom}>
      <span className="pv-pilula-ponto" aria-hidden />
      {rotulo}
    </span>
  );
}

export function PilulaDeTarefa({ estado }: { estado: EstadoDaTarefa }) {
  const { rotulo, tom } = ESTADO_DA_TAREFA[estado];
  return (
    <span className="pv-pilula" data-pv-tom={tom}>
      <span className="pv-pilula-ponto" aria-hidden />
      {rotulo}
    </span>
  );
}

export function MarcaDaFamilia({ familia }: { familia: Familia }) {
  return (
    <span className="pv-familia" data-familia={familia}>
      {FAMILIAS[familia].rotulo}
    </span>
  );
}

type Quem = { nome: string; iniciais: string };

/** `decorativo`: o nome já está escrito ao lado ou no grupo, então o avatar some para o leitor de tela. */
export function Avatar({ quem, tamanho = "md", titulo = true, decorativo = false }: { quem: Quem; tamanho?: "sm" | "md" | "lg"; titulo?: boolean; decorativo?: boolean }) {
  return (
    <span
      className="pv-avatar"
      data-tam={tamanho}
      data-cor={corDoAvatar(quem.nome)}
      title={titulo ? quem.nome : undefined}
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : quem.nome}
      aria-hidden={decorativo || undefined}
    >
      {quem.iniciais}
    </span>
  );
}

/** Quando não há ninguém, o círculo tracejado diz que falta alguém — não some. */
export function AvatarVazio({ tamanho = "md", rotulo }: { tamanho?: "sm" | "md" | "lg"; rotulo: string }) {
  return (
    <span className="pv-avatar" data-tam={tamanho} data-vazio="true" role="img" aria-label={rotulo} title={rotulo}>
      <UserRound aria-hidden />
    </span>
  );
}

/** Pilha de avatares com excedente. `max` pessoas visíveis, o resto vira "+N". */
export function PilhaDeAvatares({ pessoas, max = 3, rotuloVazio = "Sem pessoas cadastradas" }: { pessoas: Quem[]; max?: number; rotuloVazio?: string }) {
  if (pessoas.length === 0) return <AvatarVazio tamanho="sm" rotulo={rotuloVazio} />;
  const visiveis = pessoas.slice(0, max);
  const resto = pessoas.length - visiveis.length;
  const todos = pessoas.map((p) => p.nome).join(", ");
  return (
    <span className="pv-pilha" title={todos} role="group" aria-label={`Pessoas da empresa: ${todos}`}>
      {visiveis.map((p, i) => (
        <Avatar key={`${p.nome}-${i}`} quem={p} tamanho="sm" titulo={false} decorativo />
      ))}
      {resto > 0 ? (
        <span className="pv-avatar pv-pilha-mais" data-tam="sm" aria-label={`mais ${resto}`}>
          +{resto}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Barra de progresso com semântica. `fracao` de 0 a 1; acima de 1 a barra
 * cheia e o `estouro` pinta de coral, mas o número sempre diz a verdade.
 */
export function Barra({ fracao, tom = "andamento", rotulo, estouro = false }: { fracao: number; tom?: Tom; rotulo: string; estouro?: boolean }) {
  const p = percentual(fracao);
  return (
    <div
      className="pv-barra"
      data-pv-tom={estouro ? "risco" : tom}
      data-estouro={estouro || undefined}
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
    >
      <div className="pv-barra-enche" style={{ ["--pv-p" as string]: `${p}%` }} />
    </div>
  );
}
