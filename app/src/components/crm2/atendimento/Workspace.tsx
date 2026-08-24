"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConversaItem, Contexto } from "./types";
import { Cf2ConversationList } from "./ConversationList";
import { Cf2ChatThread } from "./ChatThread";
import { Cf2EmailThread } from "./EmailThread";
import { Cf2CallDetail } from "./CallDetail";
import { Cf2Dialer } from "./Dialer";
import { Cf2ContextPanel } from "./ContextPanel";
import { Cf2NovaMensagemModal } from "./NovaMensagemModal";
import { Cf2AtribuirModal } from "./AtribuirModal";

export function Cf2AtendimentoWorkspace() {
  const queryClient = useQueryClient();
  // Deep link real (23/08): "Ver conversas (WhatsApp/e-mail/ligações)" no
  // Negócio (negocios/Workspace.tsx) já linkava pra `/atendimento?leadId=X`
  // — mecanismo de seleção por URL que essa tela nunca consumia (achado
  // real: só existia state local `selecionada`, nada lia query param).
  // Resultado: sempre abria o inbox "genérico", sem selecionar a conversa
  // do contato que originou o clique. `canal` já nasce em "whatsapp" nesse
  // caso porque o bucket "todas" filtra conversas lidas (só mostra
  // naoLidas>0 pra whatsapp/email — ver atendimento.ts) e apagaria uma
  // conversa já lida da lista antes de dar tempo de selecioná-la.
  const searchParams = useSearchParams();
  const leadIdParam = searchParams.get("leadId");
  // `canal` explícito na URL (23/08): o drawer de Pré-vendas manda
  // `?canal=ligacao|whatsapp|email&leadId=X` pros 3 botões de ação rápida —
  // sem isso, todo deep link com leadId caía fixo em "whatsapp" (só o caso
  // que já existia, vindo do Negócio). `telefoneParam` só alimenta o
  // discador (abaixo), nunca decide o canal.
  const canalParam = searchParams.get("canal");
  const telefoneParam = searchParams.get("telefone");
  const [canal, setCanal] = useState(canalParam || (leadIdParam ? "whatsapp" : "todas"));
  const [view, setView] = useState("meus");
  const [search, setSearch] = useState("");
  const [selecionada, setSelecionada] = useState<ConversaItem | null>(null);
  const [novaMensagemAberta, setNovaMensagemAberta] = useState(false);
  const [atribuirAberta, setAtribuirAberta] = useState(false);
  const deepLinkResolvidoRef = useRef(false);

  // Trocar de aba limpa a seleção — não faz sentido continuar mostrando uma
  // conversa de WhatsApp depois de clicar em "Ligar", por exemplo. Também é
  // o que garante o discador aparecer por padrão na aba Ligar (Kauã, 10/08):
  // sem seleção nessa aba = discador, não a última ligação escolhida antes.
  useEffect(() => setSelecionada(null), [canal]);

  const { data, isLoading } = useQuery({
    queryKey: ["cf2-conversas", canal, view, search],
    queryFn: async () => {
      const params = new URLSearchParams({ canal, view });
      if (search) params.set("search", search);
      const res = await fetch(`/api/atendimento/conversas?${params.toString()}`);
      if (!res.ok) return { conversas: [] as ConversaItem[] };
      return res.json();
    },
    refetchInterval: 8000,
  });

  const conversas: ConversaItem[] = data?.conversas ?? [];
  const contagens = data?.contagens as { todas: number; whatsapp: number; email: number; ligacao: number } | undefined;

  // Resolve o deep link uma única vez, no primeiro carregamento completo
  // (não fica competindo com seleção manual do usuário depois, nem tenta de
  // novo a cada refetch de 8s). Sem match no dado real (ex: contato sem
  // conversa de WhatsApp ainda, ou pertence a outro atendente — privacidade
  // já filtra isso no backend) não fabrica seleção: cai no fallback normal
  // da tela abaixo, exatamente como se não houvesse leadId na URL.
  useEffect(() => {
    if (!leadIdParam || deepLinkResolvidoRef.current || isLoading) return;
    deepLinkResolvidoRef.current = true;
    const match = conversas.find((c) => c.leadId === leadIdParam);
    if (match) setSelecionada(match);
  }, [leadIdParam, conversas, isLoading]);

  // Enquanto o deep link ainda não foi resolvido, não cai no fallback
  // "primeira conversa da lista" — evita mostrar por um instante a conversa
  // errada antes de trocar pra certa.
  const deepLinkPendente = !!leadIdParam && !deepLinkResolvidoRef.current;

  // Mantém a seleção sincronizada (naoLidas atualiza sem perder o item aberto).
  // Aba Ligar não auto-seleciona a primeira ligação — só mostra detalhe se o
  // usuário clicar em algo; sem clique, fica no discador.
  const conversaAtual = selecionada
    ? conversas.find((c) => c.id === selecionada.id) ?? selecionada
    : canal === "ligacao" || deepLinkPendente
      ? null
      : conversas[0] ?? null;

  const { data: contexto, isLoading: carregandoContexto } = useQuery<Contexto>({
    queryKey: ["cf2-contexto", conversaAtual?.leadId ?? null],
    queryFn: async () => {
      const params = conversaAtual?.leadId ? `?leadId=${conversaAtual.leadId}` : "";
      const res = await fetch(`/api/atendimento/contexto${params}`);
      return res.json();
    },
    enabled: !!conversaAtual,
  });

  const atribuirMutation = useMutation({
    mutationFn: async ({ contatoId, usuarioId }: { contatoId: string; usuarioId: string }) => {
      const res = await fetch(`/api/contatos/${contatoId}/atribuir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cf2-conversas"] }),
  });

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <div className="flex gap-4 flex-1 min-h-0">
      <Cf2ConversationList
        conversas={conversas}
        loading={isLoading}
        canal={canal}
        onCanalChange={setCanal}
        view={view}
        onViewChange={setView}
        search={search}
        onSearchChange={setSearch}
        selectedId={conversaAtual?.id ?? null}
        onSelect={setSelecionada}
        onNovaMensagem={() => setNovaMensagemAberta(true)}
        contagens={contagens}
      />

      {conversaAtual ? (
        <>
          {conversaAtual.tipo === "whatsapp" && (
            <Cf2ChatThread
              conversa={conversaAtual}
              contexto={contexto ?? null}
              onAtribuir={() => setAtribuirAberta(true)}
            />
          )}
          {conversaAtual.tipo === "email" && <Cf2EmailThread conversa={conversaAtual} contexto={contexto ?? null} />}
          {conversaAtual.tipo === "ligacao" && <Cf2CallDetail conversa={conversaAtual} />}

          <Cf2ContextPanel conversa={conversaAtual} contexto={contexto ?? null} loading={carregandoContexto} />
        </>
      ) : canal === "ligacao" ? (
        <Cf2Dialer numeroInicial={telefoneParam || undefined} />
      ) : (
        <div
          className="flex-1 flex items-center justify-center rounded-3xl"
          style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
        >
          <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma conversa por aqui ainda.</p>
        </div>
      )}
      </div>

      {novaMensagemAberta && (
        <Cf2NovaMensagemModal
          onClose={() => setNovaMensagemAberta(false)}
          onEnviado={() => {
            setNovaMensagemAberta(false);
            queryClient.invalidateQueries({ queryKey: ["cf2-conversas"] });
          }}
        />
      )}

      {atribuirAberta && conversaAtual && (
        <Cf2AtribuirModal
          onClose={() => setAtribuirAberta(false)}
          onConfirmar={(usuarioId) => {
            atribuirMutation.mutate({ contatoId: conversaAtual.id, usuarioId });
            setAtribuirAberta(false);
          }}
        />
      )}
    </div>
  );
}
