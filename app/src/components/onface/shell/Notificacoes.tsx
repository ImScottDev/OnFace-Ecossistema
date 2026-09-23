"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Aviso = {
  id: string;
  titulo: string;
  mensagem: string | null;
  tipo: string;
  lida: boolean;
  link: string | null;
  createdAt: string;
};

const FILTROS = [
  { chave: "todas", label: "Todas" },
  { chave: "nao-lidas", label: "Não lidas" },
  { chave: "mencoes", label: "Menções" },
] as const;

type Filtro = (typeof FILTROS)[number]["chave"];

function quando(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Sino — réplica do protótipo `OnFace Casca.dc.html` (bloco `sinoAberto`).
 *
 * Geometria do desenho: gatilho de 30×30 com o ponto coral de 6px no canto,
 * painel de 352px com raio 10, contorno `#e3e7e8` e sombra
 * `0 10px 26px -6px rgba(0,0,0,.2)`; título em Plus Jakarta 13/700, faixa de
 * chips de filtro e estado vazio centralizado acima de um fio `#eef1f1`.
 *
 * Substitui o `Cf2NotificationBell` dentro da casca ONFACE. O endpoint e as
 * mutações são os mesmos (`/api/notificacoes`), então nada de comportamento
 * mudou: o que muda é a superfície, que era do CRM 2.0.
 */
export function Notificacoes() {
  const [filtro, setFiltro] = React.useState<Filtro>("todas");
  const cliente = useQueryClient();

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

  const todas = React.useMemo<Aviso[]>(
    () => (Array.isArray(data?.notificacoes) ? data.notificacoes : []).filter((n) => n.tipo !== "whatsapp_msg"),
    [data],
  );
  const naoLidas = todas.filter((n) => !n.lida);

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notificacoes/${id}`, { method: "PATCH" });
    },
    onSuccess: () => cliente.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // "Menções" não tem coluna no banco: `notificacoes` não guarda autor, só
  // destinatário. O chip existe no desenho, então ele fica — e devolve vazio
  // com explicação, em vez de recortar uma lista qualquer e chamar de menção.
  const lista =
    filtro === "nao-lidas" ? naoLidas : filtro === "mencoes" ? [] : todas;

  const vazio =
    filtro === "mencoes"
      ? { titulo: "Menções ainda não existem", texto: "O aviso guarda quem recebe, não quem escreveu. Sem autor não dá para dizer que alguém mencionou você." }
      : filtro === "nao-lidas"
        ? { titulo: "Tudo lido", texto: "Nenhum aviso esperando você por aqui." }
        : { titulo: "Nada para avisar", texto: "Quando algo mudar na operação, aparece aqui." };

  return (
    <Popover>
      <PopoverTrigger className="onface-utility onface-sino" aria-label={naoLidas.length ? `Notificações, ${naoLidas.length} não lidas` : "Notificações"}>
        <Bell aria-hidden />
        {naoLidas.length > 0 && <span className="onface-sino-ponto" aria-hidden />}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="onface-sino-painel">
        <div className="onface-sino-topo">
          <span>Notificações</span>
        </div>

        <div className="onface-sino-chips">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              type="button"
              data-ativo={filtro === f.chave}
              onClick={() => setFiltro(f.chave)}
            >
              {f.label}
              {f.chave === "nao-lidas" && naoLidas.length > 0 ? ` ${naoLidas.length}` : ""}
            </button>
          ))}
        </div>

        {lista.length === 0 ? (
          <div className="onface-sino-vazio">
            <div>{vazio.titulo}</div>
            <p>{vazio.texto}</p>
          </div>
        ) : (
          <ul className="onface-sino-lista">
            {lista.slice(0, 20).map((n) => {
              const corpo = (
                <>
                  <span className="onface-sino-titulo">{n.titulo}</span>
                  {n.mensagem && <span className="onface-sino-msg">{n.mensagem}</span>}
                  <span className="onface-sino-quando">{quando(n.createdAt)}</span>
                </>
              );
              return (
                <li key={n.id} data-lida={n.lida}>
                  {n.link ? (
                    <Link href={n.link} onClick={() => !n.lida && marcarLida.mutate(n.id)}>
                      {corpo}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => !n.lida && marcarLida.mutate(n.id)}>
                      {corpo}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
