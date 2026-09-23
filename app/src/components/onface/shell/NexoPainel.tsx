"use client";

import * as React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, MessageSquare, Plus, Send, X } from "lucide-react";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

type Aviso = { id: string; titulo: string; lida: boolean };

type Aba = "mes" | "semana" | "copiloto";

const ATALHOS: Array<{ k: Aba; label: string; Icone: typeof CalendarDays }> = [
  { k: "mes", label: "Meu mês", Icone: CalendarDays },
  { k: "semana", label: "Minha semana", Icone: BarChart3 },
  { k: "copiloto", label: "Copiloto", Icone: MessageSquare },
];

const SUGESTOES = [
  "Quem está sem próxima ação?",
  "Leads parados há mais de 7 dias",
  "Onde o funil está travando?",
];

type Mensagem = { de: "eu" | "oni"; texto: string };

/**
 * NEXO — réplica do protótipo `OnFace Casca.dc.html` (bloco `nexo.aberto`).
 *
 * É um MODAL centralizado de 900×min(640, 100vh−40), não uma gaveta lateral:
 * véu `rgba(9,14,20,.5)`, raio 14, e dentro dele duas colunas — uma barra
 * grafite `#12171d` de 218px com Nova conversa, INSIGHTS NEXO e HISTÓRICO, e a
 * conversa em branco à direita.
 *
 * O gatilho continua no rodapé da coluna da casca, com o resumo e o ⌘J.
 *
 * **O que é forma e o que é dado.** A forma inteira é do desenho. O dado não:
 * não existe runtime de conversa nem meta gravada no banco, então a conversa
 * nasce vazia e os dois modos de radar dizem o que falta em vez de desenhar um
 * arco de ritmo contra um número que ninguém definiu. O resumo do gatilho
 * conta avisos reais de `/api/notificacoes`, que é a única fonte que existe.
 */
export function NexoPainel() {
  const [aberto, setAberto] = React.useState(false);
  const [aba, setAba] = React.useState<Aba>("copiloto");
  const [rascunho, setRascunho] = React.useState("");
  const [mensagens, setMensagens] = React.useState<Mensagem[]>([]);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notificacoes");
      if (!res.ok) return { notificacoes: [] as Aviso[] };
      return (await res.json()) as { notificacoes: Aviso[] };
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const naoLidos = (Array.isArray(data?.notificacoes) ? data.notificacoes : []).filter((a) => !a.lida);

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAberto((v) => !v);
      }
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const enviar = () => {
    const t = rascunho.trim();
    if (!t) return;
    setMensagens((m) => [...m, { de: "eu", texto: t }]);
    setRascunho("");
  };

  const resumo = naoLidos.length
    ? `${naoLidos.length} ${naoLidos.length === 1 ? "aviso" : "avisos"}`
    : "Sem avisos agora";

  const ehRadar = aba === "mes" || aba === "semana";
  const titulo = aba === "mes" ? "Meu mês" : aba === "semana" ? "Minha semana" : "Copiloto";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="onface-nexo"
          tooltip="NEXO — assistente e avisos · ⌘J"
          onClick={() => setAberto(true)}
        >
          <span className="onface-nexo-marca">
            <Image src="/onface/oni/oni-avatar.png" alt="" width={26} height={26} className="onface-nexo-avatar" />
          </span>
          <span className="onface-nexo-texto">
            <span className="onface-nexo-nome">
              NEXO
              {naoLidos.length > 0 && <span className="onface-nexo-ponto" aria-hidden />}
            </span>
            <span className="onface-nexo-resumo">{resumo}</span>
          </span>
          <span className="onface-nexo-kbd">⌘J</span>
        </SidebarMenuButton>

        {aberto && (
          <div className="onface-nexo-veu" onClick={() => setAberto(false)} role="presentation">
            <div
              className="onface-nexo-modal"
              role="dialog"
              aria-modal="true"
              aria-label="NEXO"
              onClick={(e) => e.stopPropagation()}
            >
              <aside className="onface-nexo-coluna">
                <div className="onface-nexo-coluna-topo">
                  <Image src="/onface/oni/oni-avatar.png" alt="" width={26} height={26} className="onface-nexo-avatar" />
                  <span>NEXO</span>
                </div>

                <button
                  type="button"
                  className="onface-nexo-nova"
                  onClick={() => {
                    setAba("copiloto");
                    setMensagens([]);
                  }}
                >
                  <Plus aria-hidden />
                  <span>Nova conversa</span>
                </button>

                <div className="onface-nexo-rotulo">Insights NEXO</div>
                <div className="onface-nexo-atalhos">
                  {ATALHOS.map(({ k, label, Icone }) => (
                    <button
                      key={k}
                      type="button"
                      data-ativo={aba === k}
                      onClick={() => setAba(k)}
                    >
                      <Icone aria-hidden />
                      <span>{label}</span>
                      {aba === k && <span className="onface-nexo-atalho-ponto" aria-hidden />}
                    </button>
                  ))}
                </div>

                <div className="onface-nexo-rotulo">Histórico</div>
                <div className="onface-nexo-historico">
                  {/* Vazio de verdade: conversa não é persistida em lugar nenhum
                      ainda. A lista existe porque ela é a estrutura do desenho. */}
                  <p>Nenhuma conversa guardada.</p>
                </div>
              </aside>

              <div className="onface-nexo-conteudo">
                <div className="onface-nexo-cabecalho">
                  <span className="onface-nexo-titulo">{titulo}</span>
                  <span className="onface-nexo-contexto">
                    {naoLidos.length > 0 ? `${naoLidos.length} em aberto` : "operação comercial"}
                  </span>
                  <button type="button" onClick={() => setAberto(false)} aria-label="Fechar">
                    <X aria-hidden />
                  </button>
                </div>

                {ehRadar ? (
                  <div className="onface-nexo-radar">
                    <div className="onface-nexo-sem-serie">
                      <div>Sem meta gravada para comparar</div>
                      <p>
                        O radar põe o realizado contra o degrau da meta ao longo do
                        período. Não existe meta no banco, e um arco de ritmo sem meta é
                        um desenho bonito afirmando um número que ninguém definiu.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="onface-nexo-conversa">
                      {mensagens.length === 0 ? (
                        <div className="onface-nexo-linha">
                          <Image src="/onface/oni/oni-avatar.png" alt="" width={26} height={26} className="onface-nexo-avatar" />
                          <div className="onface-nexo-bolha" data-de="oni">
                            <div className="onface-nexo-texto-bolha">
                              A conversa ainda não tem runtime ligado. Quando o agente
                              existir, ele responde aqui — e toda ação dele entra com ator
                              AI_AGENT, como o resto do produto já registra.
                            </div>
                          </div>
                        </div>
                      ) : (
                        mensagens.map((m, i) => (
                          <div key={i} className="onface-nexo-linha" data-de={m.de}>
                            {m.de === "oni" && (
                              <Image src="/onface/oni/oni-avatar.png" alt="" width={26} height={26} className="onface-nexo-avatar" />
                            )}
                            <div className="onface-nexo-bolha" data-de={m.de}>
                              <div className="onface-nexo-texto-bolha">{m.texto}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="onface-nexo-composer">
                      <div className="onface-nexo-caixa">
                        <input
                          value={rascunho}
                          onChange={(e) => setRascunho(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && enviar()}
                          placeholder="Como posso te ajudar?"
                        />
                        <button
                          type="button"
                          className="onface-nexo-enviar"
                          data-pronto={rascunho.trim().length > 0}
                          onClick={enviar}
                          aria-label="Enviar"
                        >
                          <Send aria-hidden />
                        </button>
                      </div>
                      <div className="onface-nexo-sugestoes">
                        {SUGESTOES.map((s) => (
                          <button key={s} type="button" onClick={() => setRascunho(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
