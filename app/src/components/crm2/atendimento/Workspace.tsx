"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { digitsForDialer } from "@/lib/utils/callface-call";
import { DetailDrawer } from "@/components/crm/DetailDrawer";
import { ConversaItem, Contexto } from "./types";
import { Cf2ConversationList } from "./ConversationList";
import { Cf2ChatThread } from "./ChatThread";
import { Cf2EmailThread } from "./EmailThread";
import { Cf2CallDetail } from "./CallDetail";
import { Cf2Dialer } from "./Dialer";
import { Cf2ContextPanel } from "./ContextPanel";
import { Cf2NovaMensagemModal } from "./NovaMensagemModal";
import { Cf2AtribuirModal } from "./AtribuirModal";
import { Cf2NovaConversaThread } from "./NovaConversaThread";

/**
 * Estado vazio do Atendimento.
 *
 * "Nenhuma conversa por aqui ainda" era a mesma frase para três situações
 * diferentes, e nenhuma delas tinha saída:
 *
 * - a API falhou (o `catch` devolvia lista vazia e o erro sumia);
 * - a fila "Meus" está vazia porque nada foi atribuído a esta pessoa —
 *   medido em 22/09, a caixa tinha 40 conversas em "Todos" enquanto a tela
 *   dizia que não havia nenhuma;
 * - a caixa está realmente vazia.
 *
 * P7 pede que o vazio ensine o próximo movimento, e o movimento certo é
 * diferente em cada caso. Por isso o componente pergunta POR QUE está vazio
 * antes de escolher a frase.
 */
function VazioDoAtendimento({
  deepLinkSemMatch, temLead, view, erro, aoTentarDeNovo, aoVerTodos,
}: {
  deepLinkSemMatch: boolean;
  temLead: boolean;
  view: string;
  erro: boolean;
  aoTentarDeNovo: () => void;
  aoVerTodos: () => void;
}) {
  const estilo = { color: "var(--cf2-text-tertiary)" } as const;

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>
          Não foi possível carregar as conversas.
        </p>
        <Button size="sm" onClick={aoTentarDeNovo}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (deepLinkSemMatch) {
    return (
      <p className="text-[13px]" style={estilo}>
        {temLead
          ? "Esse lead ainda não tem conversa nesse canal."
          : "Esse contato ainda não tem conversa nesse canal."}
      </p>
    );
  }

  // A fila pessoal vazia é o caso mais comum e o mais enganoso: parece
  // produto sem dado, é só ninguém ter atribuído nada a você.
  if (view === "meus") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-[13px]" style={estilo}>
          Nenhuma conversa atribuída a você.
        </p>
        <Button size="sm" variant="outline" onClick={aoVerTodos}>
          Ver a caixa inteira
        </Button>
      </div>
    );
  }

  if (view === "nao_atribuidos") {
    return (
      <p className="text-[13px]" style={estilo}>
        Nenhuma conversa esperando dono. Toda a fila já tem responsável.
      </p>
    );
  }

  return (
    <p className="text-[13px]" style={estilo}>
      Nenhuma conversa nesta caixa.
    </p>
  );
}

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
  const textoParam = searchParams.get("texto");
  const [canal, setCanal] = useState(canalParam || (leadIdParam ? "whatsapp" : "todas"));
  // Deep link com leadId não pode nascer restrito a "meus" (24/08, achado
  // real: clique no card de Pré-vendas caía em "Nenhuma conversa por aqui
  // ainda" sempre que a conversa pertencia a outro atendente — o match por
  // leadId só busca dentro do view atual, então "meus" apagava a conversa
  // certa da lista antes mesmo de tentar selecioná-la). Sem leadId, o
  // comportamento de sempre (fila do próprio usuário) continua o mesmo.
  // Deep link por TELEFONE sem lead (16/09): o Módulo Vendas passou a abrir
  // Atendimento a partir de Empresa, Pessoa, Oportunidade e Proposta, e nem
  // toda essas entidades têm lead de Pré-vendas por trás. Sem isto o clique
  // caía no inbox genérico, que é o mesmo que não ter funcionado. A chave do
  // deep link passa a ser "o lead, se houver; senão o telefone".
  const chaveDeepLink = leadIdParam ?? (telefoneParam ? `tel:${telefoneParam}` : null);
  const [view, setView] = useState(chaveDeepLink ? "todos" : "meus");
  const [search, setSearch] = useState("");
  const [selecionada, setSelecionada] = useState<ConversaItem | null>(null);
  const [novaMensagemAberta, setNovaMensagemAberta] = useState(false);
  const [atribuirAberta, setAtribuirAberta] = useState(false);
  // Painel de contexto (pessoa, empresa, negócio ativo, cadências) só existia
  // fixo a partir de `xl` (1280px) — decisão deliberada pra não espremer a
  // conversa em telas médias, mas isso deixava o contexto TOTALMENTE
  // inacessível abaixo disso, notebook incluso. Vira drawer sob demanda
  // abaixo de `xl`, mesmo dado, sem duplicar o painel.
  const [contextoAberto, setContextoAberto] = useState(false);
  const [deepLinkAplicado, setDeepLinkAplicado] = useState<string | null>(null);

  // Trocar de aba limpa a seleção — não faz sentido continuar mostrando uma
  // conversa de WhatsApp depois de clicar em "Ligar", por exemplo. Também é
  // o que garante o discador aparecer por padrão na aba Ligar (Kauã, 10/08):
  // sem seleção nessa aba = discador, não a última ligação escolhida antes.
  useEffect(() => setSelecionada(null), [canal]);

  // Filtro de `leadId` só entra na busca ENQUANTO o deep link ainda não foi
  // resolvido (achado real 24/08: mandava `leadId` pro backend pra sempre
  // que ele existisse na URL — inclusive no polling de 8s depois da
  // conversa certa já selecionada — então a lista ficava restrita àquele
  // lead pra sempre, "as outras conversas somem"). Uma vez resolvido
  // (`leadIdAplicado === leadIdParam`), a busca volta a ser a lista normal;
  // `selecionada` já guarda a conversa certa independente do que a lista
  // retornar depois.
  const leadIdParaFiltro = leadIdParam && chaveDeepLink !== deepLinkAplicado ? leadIdParam : null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cf2-conversas", canal, view, search, leadIdParaFiltro],
    queryFn: async () => {
      const params = new URLSearchParams({ canal, view });
      if (search) params.set("search", search);
      // Deep link: manda `leadId` pro backend achar a conversa DESSE lead
      // mesmo se for de outro atendente ou já estiver fechada (ver
      // comentário na rota `/atendimento/conversas`).
      if (leadIdParaFiltro) params.set("leadId", leadIdParaFiltro);
      const res = await fetch(`/api/atendimento/conversas?${params.toString()}`);
      // Falha de API NÃO vira lista vazia. Devolver `[]` aqui fazia um 500
      // aparecer na tela como "Nenhuma conversa por aqui ainda" — o operador
      // não tinha como distinguir caixa vazia de produto quebrado, e nem como
      // tentar de novo. Lançar deixa o React Query marcar `isError`, e a tela
      // mostra erro com recuperação (§44, P8).
      if (!res.ok) throw new Error(`conversas:${res.status}`);
      return res.json();
    },
    refetchInterval: 8000,
  });

  const conversas: ConversaItem[] = data?.conversas ?? [];
  const contagens = data?.contagens as { todas: number; whatsapp: number; email: number; ligacao: number } | undefined;

  // Resolve o deep link uma única vez por leadId, no primeiro carregamento
  // completo (não fica competindo com seleção manual do usuário depois, nem
  // tenta de novo a cada refetch de 8s) — ajuste de estado durante o render
  // em vez de efeito (mesmo padrão recomendado pra "sincronizar com uma prop
  // que mudou", evita o setState-em-efeito). Match por `leadId` OU telefone
  // (achado real 24/08: muito contato de WhatsApp não tem `contatos.leadId`
  // preenchido no banco — telefone é o dado que de fato liga a conversa ao
  // lead, mesma normalização do discador). Sem match nos dois, não fabrica
  // seleção: cai no fallback normal da tela abaixo.
  const telefoneNormalizado = telefoneParam || null;
  if (chaveDeepLink && chaveDeepLink !== deepLinkAplicado && !isLoading) {
    setDeepLinkAplicado(chaveDeepLink);
    const match = conversas.find((c) =>
      (!!leadIdParam && c.leadId === leadIdParam)
      || (!!telefoneNormalizado && !!c.telefone && digitsForDialer(c.telefone) === telefoneNormalizado)
    );
    if (match) setSelecionada(match);
  }

  // Enquanto o deep link ainda não foi resolvido, não cai no fallback
  // "primeira conversa da lista" — evita mostrar por um instante a conversa
  // errada antes de trocar pra certa. E se já resolveu SEM achar nada,
  // também não cai nesse fallback (achado 24/08: caía numa conversa
  // qualquer, sem relação com o lead clicado — pior que mostrar vazio).
  const deepLinkPendente = !!chaveDeepLink && chaveDeepLink !== deepLinkAplicado;
  const deepLinkSemMatch = !!chaveDeepLink && chaveDeepLink === deepLinkAplicado && !selecionada;

  // Mantém a seleção sincronizada (naoLidas atualiza sem perder o item aberto).
  // Aba Ligar não auto-seleciona a primeira ligação — só mostra detalhe se o
  // usuário clicar em algo; sem clique, fica no discador.
  const conversaAtual = selecionada
    ? conversas.find((c) => c.id === selecionada.id) ?? selecionada
    : canal === "ligacao" || deepLinkPendente || deepLinkSemMatch
      ? null
      : conversas[0] ?? null;

  // Contexto do lead independe de já existir conversa (24/08, pedido do
  // Kauã: "mesmo que não tenha conversa era pra pelo menos abrir... com os
  // dados do lado") — sem isso, `deepLinkSemMatch` só mostrava um vazio morto.
  const contextoLeadId = conversaAtual?.leadId ?? (deepLinkSemMatch ? leadIdParam : null);
  const { data: contexto, isLoading: carregandoContexto } = useQuery<Contexto>({
    queryKey: ["cf2-contexto", contextoLeadId],
    queryFn: async () => {
      const params = contextoLeadId ? `?leadId=${contextoLeadId}` : "";
      const res = await fetch(`/api/atendimento/contexto${params}`);
      return res.json();
    },
    enabled: !!contextoLeadId,
  });

  // "Conversa rascunho": WhatsApp sem `contatos` ainda, mas o lead é
  // conhecido — mostra a mesma casca de conversa (header + contexto do
  // lado), só sem histórico, com o composer já pronto pra mandar a 1ª
  // mensagem. Some sozinha quando a conversa real aparece (via `onSent`
  // abaixo → invalida a lista → o próximo bloco promove pra seleção real).
  const draftConversa: ConversaItem | null = deepLinkSemMatch && canal === "whatsapp" && leadIdParam && contexto?.pessoa
    ? {
        id: `draft-${leadIdParam}`, tipo: "whatsapp", nome: contexto.pessoa.nome,
        empresaNome: contexto.empresa?.nome ?? null, preview: "", timestamp: null, naoLidas: 0,
        leadId: leadIdParam, responsavelId: null, handoffStatus: null, duracaoSegundos: null,
        callStatus: null, emailThreadId: null, telefone: contexto.pessoa.telefone,
        conversationSummary: null, status: "open", snoozedUntil: null,
        isCliente: contexto?.isCliente ?? false,
      }
    : null;

  // Depois de enviar a 1ª mensagem, o contato real existe no banco — assim
  // que o refetch da lista trouxer ele, promove pra seleção de verdade (sem
  // isso o usuário ficava preso na tela de rascunho até recarregar).
  const [pendingContatoId, setPendingContatoId] = useState<string | null>(null);
  if (pendingContatoId) {
    const criado = conversas.find((c) => c.id === pendingContatoId);
    if (criado) { setSelecionada(criado); setPendingContatoId(null); }
  }

  // Abaixo de lg a tela mostra a lista OU a conversa, nunca as duas.
  // O discador conta como "conversa": ocupa a coluna da direita do mesmo jeito.
  const temConversa = Boolean(conversaAtual || draftConversa || canal === "ligacao");

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
    // `flex-1 min-h-0` e não `h-full`: o inbox é o único conteúdo da rota e
    // precisa ocupar a altura que a casca deixa. `h-full` dependia de um pai
    // com altura fixa — era o `cf2-altura-tela` da página, que somava uma
    // segunda viewport à casca nova e saiu junto com o título duplicado.
    <div data-workspace="tela-cheia" className="flex flex-1 min-h-0 flex-col gap-3">
      {temConversa && (
        <div className="flex items-center justify-between gap-2 -mb-1">
          <button
            type="button"
            onClick={() => { setSelecionada(null); if (canal === "ligacao") setCanal("todos"); }}
            className="lg:hidden flex items-center gap-1.5 self-start px-3 py-2 rounded-lg text-[13px] font-medium transition-colors"
            style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden /> Todas as conversas
          </button>
          {(conversaAtual || draftConversa) && (
            <button
              type="button"
              onClick={() => setContextoAberto(true)}
              className="xl:hidden flex items-center gap-1.5 self-start px-3 py-2 rounded-lg text-[13px] font-medium transition-colors"
              style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)" }}
            >
              <Info className="w-4 h-4" aria-hidden /> Detalhes
            </button>
          )}
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
      {/* Três colunas de largura fixa não cabem abaixo de 1280px: em 834px a
          conversa — o conteúdo principal da tela — ficava espremida em ~40px
          entre a lista e o painel de contexto. Agora a lista e o contexto têm
          largura fixa só a partir do ponto em que ela cabe, o contexto some
          antes disso (é o apoio, não o assunto), e no tablet/celular a tela
          alterna entre lista e conversa como qualquer inbox. */}
      <div className={`${temConversa ? "hidden lg:block" : "block"} w-full lg:w-[336px] lg:shrink-0 h-full min-h-0`}>
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
      </div>

      {conversaAtual ? (
        <>
          {conversaAtual.tipo === "whatsapp" && (
            <Cf2ChatThread
              conversa={conversaAtual}
              contexto={contexto ?? null}
              onAtribuir={() => setAtribuirAberta(true)}
              textoInicial={textoParam || undefined}
            />
          )}
          {conversaAtual.tipo === "email" && <Cf2EmailThread conversa={conversaAtual} contexto={contexto ?? null} textoInicial={textoParam || undefined} />}
          {conversaAtual.tipo === "ligacao" && <Cf2CallDetail conversa={conversaAtual} />}

          <div className="hidden xl:block w-[336px] shrink-0 h-full min-h-0">
            <Cf2ContextPanel conversa={conversaAtual} contexto={contexto ?? null} loading={carregandoContexto} />
          </div>
        </>
      ) : draftConversa ? (
        <>
          <Cf2NovaConversaThread
            leadId={leadIdParam!}
            leadNome={draftConversa.nome}
            leadTelefone={draftConversa.telefone}
            textoInicial={textoParam || undefined}
            onSent={(contatoId) => {
              setPendingContatoId(contatoId);
              queryClient.invalidateQueries({ queryKey: ["cf2-conversas"] });
            }}
          />
          <div className="hidden xl:block w-[336px] shrink-0 h-full min-h-0">
            <Cf2ContextPanel conversa={draftConversa} contexto={contexto ?? null} loading={carregandoContexto} />
          </div>
        </>
      ) : canal === "ligacao" ? (
        <Cf2Dialer numeroInicial={telefoneParam || undefined} />
      ) : (
        <div
          className="hidden lg:flex flex-1 items-center justify-center rounded-2xl"
          style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
        >
          <VazioDoAtendimento
            deepLinkSemMatch={deepLinkSemMatch}
            temLead={Boolean(leadIdParam)}
            view={view}
            erro={isError}
            aoTentarDeNovo={() => void refetch()}
            aoVerTodos={() => setView("todos")}
          />
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

      <DetailDrawer open={contextoAberto && !!(conversaAtual ?? draftConversa)} onClose={() => setContextoAberto(false)} bare panelBg="var(--cf2-bg-surface)" width="w-full sm:w-[380px]">
        {(conversaAtual ?? draftConversa) && (
          <Cf2ContextPanel conversa={(conversaAtual ?? draftConversa)!} contexto={contexto ?? null} loading={carregandoContexto} />
        )}
      </DetailDrawer>
    </div>
  );
}
