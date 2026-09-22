"use client";

import { AlertTriangle, Inbox, ShieldOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Adaptadores dos estados do CRM 2.0 sobre os componentes do shadcn.
 *
 * Este arquivo desenhava os cinco estados à mão, com `<div>` próprio e cor
 * inline. O shadcn já traz `Empty`, `Alert` e `Skeleton` instalados no repo, e
 * a biblioteca é o contrato: o que era marcação própria virou composição.
 *
 * Ficam como adaptadores em vez de sumir porque são 29 arquivos chamando estes
 * cinco nomes. Trocar o miolo migra os 29 de uma vez; trocar as chamadas seria
 * 29 diffs para o mesmo resultado. Quando o último consumidor compuser
 * `Empty`/`Alert` direto, este arquivo sai.
 *
 * O que muda na tela: o vazio ganha a moldura tracejada e o respiro do
 * `Empty`, e o erro vira um `Alert` de verdade, com `role="alert"`, que o
 * leitor de tela anuncia. A versão anterior era um `<div>` mudo.
 */

/** O `Skeleton` do shadcn, com a mesma assinatura de antes.
 *
 * O ad-hoc pintava `--cf2-bg-surface-muted` e arredondava em `rounded-lg`; o
 * do shadcn usa `bg-accent` e `rounded-md`. Uma linha de `className` continua
 * chegando de fora, que é como os 8 consumidores já dimensionam a peça. */
export function Cf2Skeleton({ className = "" }: { className?: string }) {
  return <Skeleton className={className} />;
}

export function Cf2EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  );
}

/** Falha de leitura.
 *
 * `variant="warning"` e não `destructive`: não deu para carregar não é
 * consequência destrutiva, é uma tentativa que falhou. A distinção existe no
 * `alert.tsx` justamente para o vermelho continuar querendo dizer alguma
 * coisa. */
export function Cf2ErrorState({ message = "Não foi possível carregar este dado." }: { message?: string }) {
  return (
    <Alert variant="warning">
      <AlertTriangle />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/**
 * Métrica sem fonte de dado confiável — princípio do Kauã (09/08): "se o CRM
 * não consegue provar o número através de uma fonte confiável, ele não deve
 * apresentar o número como verdade". Usado em vez de qualquer fórmula
 * inventada (ex: taxa de abertura de e-mail, resposta de WhatsApp sem regra
 * formalizada).
 *
 * Não tem par no shadcn e não deveria ter: é regra de produto, não peça de
 * interface. Continua sendo marcação própria, mas só de token, sem hex.
 */
export function Cf2UnavailableMetric({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={reason}>
      <ShieldOff className="size-3.5 shrink-0" aria-hidden />
      Indisponível
    </span>
  );
}

/** Acesso negado. É um vazio com outro motivo, então é o mesmo `Empty`: quem
 * chega aqui precisa entender que não há o que ver, não que algo quebrou. */
export function Cf2PermissionDenied({ message = "Você não tem permissão para ver este conteúdo." }: { message?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldOff />
        </EmptyMedia>
        <EmptyTitle>Acesso restrito</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
