"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bot, Radar as RadarIcon, Sparkles } from "lucide-react";

import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

type Aviso = {
  id: string;
  titulo: string;
  mensagem: string | null;
  lida: boolean;
  link: string | null;
  createdAt: string;
};

/**
 * NEXO — o assistente, no rodapé da coluna (handoff "Casca", 22/09).
 *
 * Ele estava fora da casca de propósito até aqui: `/automacoes/nexo` não
 * existe, e um botão coral levando a 404 é pior que a ausência dele. O handoff
 * resolve isso tirando a ROTA da equação — o NEXO é um painel da casca, não um
 * destino do menu. O que abre é um `Sheet`, e a casca não promete tela nenhuma.
 *
 * O que está ligado e o que não está, explicitamente:
 *
 * - **Avisos** lê `/api/notificacoes`, a MESMA fonte do sino do topo. É dado
 *   real, e é por isso que o resumo do rodapé conta avisos e não "insights".
 * - **Chat** e **Radar** são os outros dois modos do handoff. Não há runtime de
 *   conversa nem série de meta no banco, então eles declaram a ausência em vez
 *   de desenhar uma conversa falsa e um arco de ritmo inventado. Os
 *   componentes de desenho já existem em `ds/nexo.tsx`; falta a origem do dado.
 *
 * O resumo do rodapé NUNCA inventa número: sem aviso não lido ele diz que está
 * quieto, em vez de mostrar o "3 avisos · 2 insights" do protótipo.
 */
export function NexoPainel() {
  const [aberto, setAberto] = React.useState(false);

  // MESMA chave e MESMO formato do sino do topo (`crm2/NotificationBell`).
  // Duas `queryFn` diferentes na mesma `queryKey` compartilham o cache, então
  // quem rodar primeiro define o formato: o sino devolve `{ notificacoes }` e
  // eu devolvia um array, o que derrubava a casca inteira com
  // "avisos.filter is not a function" assim que o sino ganhava a corrida.
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
  const avisos = React.useMemo<Aviso[]>(
    () => (Array.isArray(data?.notificacoes) ? data.notificacoes : []),
    [data],
  );
  const naoLidos = avisos.filter((a) => !a.lida);

  // ⌘J é o atalho que o handoff imprime no próprio botão. Sem o listener, o
  // rótulo estaria mentindo sobre o que a tecla faz.
  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAberto((v) => !v);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const resumo = naoLidos.length
    ? `${naoLidos.length} ${naoLidos.length === 1 ? "aviso" : "avisos"}`
    : "Sem avisos agora";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="onface-nexo"
              tooltip="NEXO — assistente e avisos · ⌘J"
            >
              <span className="onface-nexo-marca">
                <Image
                  src="/onface/oni/oni-avatar.png"
                  alt=""
                  width={26}
                  height={26}
                  className="onface-nexo-avatar"
                />
              </span>
              <span className="onface-nexo-texto">
                <span className="onface-nexo-nome">
                  NEXO
                  {naoLidos.length > 0 && <span className="onface-nexo-ponto" aria-hidden />}
                </span>
                <span className="onface-nexo-resumo">{resumo}</span>
              </span>
              <Kbd className="onface-nexo-kbd">⌘J</Kbd>
            </SidebarMenuButton>
          </SheetTrigger>

          <SheetContent side="right" className="onface-nexo-painel">
            <SheetHeader>
              <SheetTitle>NEXO</SheetTitle>
              <SheetDescription>Assistente da operação comercial</SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="avisos" className="min-h-0 flex-1 px-4">
              <TabsList className="w-full">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="avisos">
                  Avisos{naoLidos.length > 0 ? ` (${naoLidos.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="radar">Radar</TabsTrigger>
              </TabsList>

              <TabsContent value="chat">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Bot />
                    </EmptyMedia>
                    <EmptyTitle>A conversa ainda não está ligada</EmptyTitle>
                    <EmptyDescription>
                      O desenho do chat existe no Design System, mas não há runtime de
                      conversa por trás dele. Enquanto não houver, o NEXO responde pelos
                      avisos.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TabsContent>

              <TabsContent value="avisos" className="min-h-0 overflow-y-auto">
                {avisos.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Sparkles />
                      </EmptyMedia>
                      <EmptyTitle>Nada para avisar</EmptyTitle>
                      <EmptyDescription>
                        Quando algo mudar na operação, aparece aqui.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ul className="onface-nexo-avisos">
                    {avisos.slice(0, 20).map((aviso) => {
                      const corpo = (
                        <>
                          <span className="onface-nexo-aviso-titulo">{aviso.titulo}</span>
                          {aviso.mensagem && (
                            <span className="onface-nexo-aviso-msg">{aviso.mensagem}</span>
                          )}
                        </>
                      );
                      return (
                        <li key={aviso.id} data-lida={aviso.lida}>
                          {aviso.link ? (
                            <Link href={aviso.link} onClick={() => setAberto(false)}>
                              {corpo}
                            </Link>
                          ) : (
                            <span>{corpo}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="radar">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <RadarIcon />
                    </EmptyMedia>
                    <EmptyTitle>Sem série para comparar</EmptyTitle>
                    <EmptyDescription>
                      O radar compara o realizado contra a meta ao longo do período, e
                      não existe meta gravada no banco. Sem ela, o arco de ritmo seria
                      um desenho bonito afirmando um número que ninguém definiu.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent />
                </Empty>
              </TabsContent>
            </Tabs>
          </SheetContent>
        </Sheet>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
