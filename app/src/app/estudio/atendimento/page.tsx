import { Mail, MessageSquare, Paperclip, Phone, Search, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  CONVERSAS_AMOSTRA, ROTULO_CANAL, THREAD_AMOSTRA,
  type Canal, type Conversa, type Mensagem,
} from "./dados";

const ICONE_CANAL: Record<Canal, typeof MessageSquare> = {
  whatsapp: MessageSquare,
  email: Mail,
  ligacao: Phone,
};

function LinhaConversa({ conversa, ativa }: { conversa: Conversa; ativa: boolean }) {
  const Icone = ICONE_CANAL[conversa.canal];

  return (
    <button
      className="relative flex w-full items-start gap-3 rounded-[var(--radius)] px-3 py-3 text-left transition-colors hover:bg-[var(--muted)]"
      style={ativa ? { background: "var(--muted)" } : undefined}
      aria-current={ativa ? "true" : undefined}
    >
      <Avatar className="mt-0.5 size-8 shrink-0">
        <AvatarFallback className="bg-[var(--secondary)] text-[0.6875rem] font-medium text-[var(--tinta-media)]">
          {conversa.iniciais}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[0.875rem] font-medium tracking-[-0.01em] text-[var(--tinta-forte)]">
            {conversa.contato}
          </span>
          <span className="estudio-num shrink-0 text-[0.6875rem] text-[var(--tinta-fraca)]">
            {conversa.quando}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-[0.75rem] text-[var(--tinta-fraca)]">
          <Icone className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{conversa.empresa}</span>
        </div>

        <p className="mt-1.5 line-clamp-1 text-[0.8125rem] leading-relaxed text-[var(--tinta-media)]">
          {conversa.ultimaMensagem}
        </p>

        {/* Sem dono é o que decide a ordem da fila, então é a única linha que
            recebe coral. Quem já tem dono não precisa gritar o nome. */}
        <div className="mt-2 flex items-center gap-2">
          {conversa.responsavel === null ? (
            <span className="text-[0.75rem] font-medium text-[var(--coral-texto)]">
              Sem dono{conversa.aguardandoHa ? ` · ${conversa.aguardandoHa}` : ""}
            </span>
          ) : (
            <span className="truncate text-[0.75rem] text-[var(--tinta-fraca)]">
              {conversa.responsavel}
            </span>
          )}
          {conversa.naoLidas > 0 && (
            <span className="estudio-num ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[0.625rem] font-semibold text-[var(--primary-foreground)]">
              {conversa.naoLidas}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Balao({ mensagem }: { mensagem: Mensagem }) {
  const daEquipe = mensagem.autor === "equipe";

  return (
    <div className={`flex flex-col gap-1 ${daEquipe ? "items-end" : "items-start"}`}>
      <div
        className="max-w-[min(32rem,78%)] px-3.5 py-2.5 text-[0.875rem] leading-relaxed"
        style={
          daEquipe
            ? {
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                borderRadius: "1rem 1rem 0.25rem 1rem",
              }
            : {
                background: "var(--card)",
                boxShadow: "var(--sombra-assentada)",
                borderRadius: "1rem 1rem 1rem 0.25rem",
              }
        }
      >
        {mensagem.texto}
      </div>
      <span className="estudio-num px-1 text-[0.6875rem] text-[var(--tinta-fraca)]">
        {mensagem.quando}
      </span>
    </div>
  );
}

function LinhaContexto({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[0.8125rem] text-[var(--tinta-fraca)]">{rotulo}</span>
      <span className="estudio-num truncate text-[0.8125rem] font-medium text-[var(--tinta-forte)]">
        {valor}
      </span>
    </div>
  );
}

export default function AtendimentoEstudio({
  conversas = CONVERSAS_AMOSTRA,
  thread = THREAD_AMOSTRA,
}: {
  conversas?: Conversa[];
  thread?: Mensagem[];
}) {
  const ativa = conversas[0];
  const semDono = conversas.filter((c) => c.responsavel === null).length;

  return (
    <div className="estudio-entrada mx-auto flex w-full max-w-[112rem] flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="estudio-titulo">Atendimento</h1>
          <p className="estudio-legenda mt-1.5">
            <span className="estudio-num">{conversas.length}</span> conversas abertas,{" "}
            <span className="estudio-num">{semDono}</span> esperando dono.
          </p>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0 text-[var(--tinta-media)]">
          Assumir a próxima
        </Button>
      </header>

      {/* Três painéis no desktop, um no telefone. A coluna de contexto sai
          antes da fila, porque é leitura e a fila é ação. */}
      <div className="estudio-paineis">
        <div className="estudio-superficie estudio-grade min-h-[36rem] overflow-hidden">
        <aside className="estudio-fila min-w-0 flex-col border-r estudio-fio">
          <div className="p-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--tinta-fraca)]"
                aria-hidden
              />
              <Input
                placeholder="Buscar conversa"
                className="h-9 border-transparent bg-[var(--muted)] pl-9 text-[0.8125rem] shadow-none placeholder:text-[var(--tinta-fraca)]"
              />
            </div>
            <Tabs defaultValue="todas" className="mt-3">
              <TabsList className="h-8 w-full bg-[var(--muted)]">
                <TabsTrigger value="todas" className="flex-1 text-[0.75rem]">Todas</TabsTrigger>
                <TabsTrigger value="minhas" className="flex-1 text-[0.75rem]">Minhas</TabsTrigger>
                <TabsTrigger value="sem-dono" className="flex-1 text-[0.75rem]">Sem dono</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
            {conversas.map((c) => (
              <LinhaConversa key={c.id} conversa={c} ativa={c.id === ativa.id} />
            ))}
          </div>
        </aside>

        <section className="estudio-conversa min-w-0 flex-col">
          <header className="flex items-center gap-3 border-b px-4 py-3 estudio-fio">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-[var(--secondary)] text-[0.6875rem] font-medium text-[var(--tinta-media)]">
                {ativa.iniciais}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.875rem] font-medium tracking-[-0.01em]">
                {ativa.contato}
              </div>
              <div className="truncate text-[0.75rem] text-[var(--tinta-fraca)]">
                {ativa.empresa} · {ROTULO_CANAL[ativa.canal]}
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 shadow-none">
              Assumir
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[var(--background)] px-4 py-5">
            {thread.map((m) => (
              <Balao key={m.id} mensagem={m} />
            ))}
          </div>

          <footer className="flex items-center gap-2 border-t p-3 estudio-fio">
            <Button variant="ghost" size="icon" className="size-9 shrink-0 text-[var(--tinta-fraca)]" aria-label="Anexar">
              <Paperclip className="size-4" aria-hidden />
            </Button>
            <Input
              placeholder="Escreva uma resposta"
              className="h-9 flex-1 border-transparent bg-[var(--muted)] text-[0.875rem] shadow-none placeholder:text-[var(--tinta-fraca)]"
            />
            <Button size="icon" className="size-9 shrink-0 shadow-none" aria-label="Enviar">
              <Send className="size-4" aria-hidden />
            </Button>
          </footer>
        </section>

        <aside className="estudio-contexto min-w-0 flex-col gap-6 border-l p-4 estudio-fio">
          <div>
            <h2 className="estudio-rotulo">Empresa</h2>
            <p className="mt-2 text-[0.9375rem] font-medium tracking-[-0.011em]">{ativa.empresa}</p>
          </div>

          <div className="flex flex-col gap-2.5">
            <LinhaContexto rotulo="Plano" valor="Callface AI Full" />
            <LinhaContexto rotulo="MRR" valor="R$ 149,90" />
            <LinhaContexto rotulo="Cliente desde" valor="04/09/2026" />
            <LinhaContexto rotulo="Faturamento" valor="Em dia" />
          </div>

          <div>
            <h2 className="estudio-rotulo">Oportunidade aberta</h2>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-[var(--tinta-media)]">
              Nenhuma. A última foi ganha em 09/09.
            </p>
          </div>
        </aside>
        </div>
      </div>
    </div>
  );
}
