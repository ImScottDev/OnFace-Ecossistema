"use client";

/**
 * Seletor de pessoa com busca.
 *
 * O produto não tinha um: a gaveta de atividade usa `<select>` nativo e o
 * filtro bonito de Responsável do Pipeline está preso dentro do markup gerado
 * (`*Desenho`), sem como reusar. Esta é a peça que faltava, e por isso ela
 * nasce aqui em vez de virar mais uma cópia local.
 *
 * Em repouso parece texto, não controle: é o padrão de propriedade editável em
 * linha do Notion e do Linear. O hover revela o fundo, o foco revela o anel. A
 * largura não muda ao abrir, então nada salta na tela.
 *
 * Teclado de graça: `Command` do cmdk já faz setas, Home/End, Enter e busca.
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, UserRound, X } from "lucide-react";
import type { Usuario } from "@/lib/pos-venda/contrato";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarVazio } from "./pecas";

export function SeletorDePessoa({
  valor,
  equipe,
  aoEscolher,
  rotulo,
  vazio = "Sem responsável",
  podeLimpar = true,
  desabilitado = false,
}: {
  valor: { id: string; nome: string; iniciais: string } | null;
  equipe: Usuario[];
  aoEscolher: (quem: Usuario | null) => void;
  /** O que o leitor de tela anuncia. Ex.: "Responsável pelo projeto". */
  rotulo: string;
  vazio?: string;
  podeLimpar?: boolean;
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  // Quem já é o responsável sobe para o topo: o caso mais comum é confirmar ou trocar
  // por alguém próximo, não varrer a lista inteira.
  const lista = useMemo(() => {
    if (!valor) return equipe;
    const eu = equipe.find((u) => u.id === valor.id);
    return eu ? [eu, ...equipe.filter((u) => u.id !== valor.id)] : equipe;
  }, [equipe, valor]);

  if (desabilitado) {
    return valor ? (
      <span className="pv-prop-pilula">
        <Avatar quem={valor} tamanho="sm" titulo={false} decorativo />
        {valor.nome}
      </span>
    ) : (
      <span className="pv-prop-pilula" data-vazio="true">{vazio}</span>
    );
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" className="pv-editavel" data-vazio={!valor || undefined} aria-label={`${rotulo}: ${valor ? valor.nome : vazio}. Trocar`}>
          {valor ? (
            <>
              <Avatar quem={valor} tamanho="sm" titulo={false} decorativo />
              <span className="pv-truncar">{valor.nome}</span>
            </>
          ) : (
            <>
              <AvatarVazio tamanho="sm" rotulo="" />
              <span className="pv-truncar">{vazio}</span>
            </>
          )}
          <ChevronsUpDown className="pv-editavel-seta" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Buscar pessoa…" />
          <CommandList>
            <CommandEmpty>Ninguém com esse nome na equipe.</CommandEmpty>
            <CommandGroup>
              {podeLimpar ? (
                <CommandItem
                  value="sem-responsavel remover ninguem"
                  onSelect={() => { aoEscolher(null); setAberto(false); }}
                >
                  <X aria-hidden />
                  <span>{vazio}</span>
                  {!valor ? <Check className="pv-cmd-check" aria-hidden /> : null}
                </CommandItem>
              ) : null}

              {lista.map((u) => (
                <CommandItem
                  key={u.id}
                  value={`${u.nome} ${u.email ?? ""}`}
                  onSelect={() => { aoEscolher(u); setAberto(false); }}
                >
                  <Avatar quem={u} tamanho="sm" titulo={false} decorativo />
                  <span className="pv-truncar">{u.nome}</span>
                  {valor?.id === u.id ? <Check className="pv-cmd-check" aria-hidden /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** A mesma régua para quem não é da equipe: um contato da empresa, só leitura. */
export function FichaDePessoa({ nome, iniciais, sub }: { nome: string; iniciais: string; sub?: string | null }) {
  return (
    <span className="pv-pessoa">
      <Avatar quem={{ nome, iniciais }} tamanho="md" titulo={false} decorativo />
      <span className="pv-pessoa-texto">
        <span className="pv-pessoa-nome pv-truncar">{nome}</span>
        {sub ? <span className="pv-pessoa-sub pv-truncar">{sub}</span> : null}
      </span>
      <UserRound className="pv-pessoa-seta" aria-hidden />
    </span>
  );
}
