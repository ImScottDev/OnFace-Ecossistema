"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NexoPainel } from "@/components/onface/shell/NexoPainel"
import { NAVEGACAO, destinoAtivo } from "@/components/onface/navegacao"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"

/**
 * Casca do ONFACE — coluna de navegação.
 *
 * A base continua sendo o bloco `sidebar-08` do shadcn (`variant="inset"`,
 * `NavMain` com grupos colapsáveis), e a árvore continua morando em
 * `navegacao.ts`, que tem teste próprio. O que mudou em 22/09 vem do handoff
 * "OnFace — Casca + Pré-vendas", declarado versão final:
 *
 * 1. **Marca em vez de cartão de workspace.** O bloco põe ícone + nome +
 *    subtítulo numa linha de 3 alturas. O handoff põe o lockup e nada mais: o
 *    nome do produto não precisa ser dito duas vezes na mesma coluna.
 * 2. **Botão Criar**, coral, logo abaixo da marca. É o único atalho global de
 *    escrita, e ele fica ACIMA da árvore de propósito — criar não é navegar.
 * 3. **NEXO no rodapé, no lugar do cartão de usuário.** O perfil subiu para o
 *    canto superior direito da barra do topo, que é onde o handoff o desenha.
 *    Isto desfaz a arrumação de mais cedo no mesmo dia, quando o perfil tinha
 *    descido para cá junto com a adoção do bloco.
 * 4. **Ajustes saiu da coluna.** Ele vive agora dentro do menu do perfil, como
 *    "Ajustes da organização" — por isso `NAVEGACAO_RODAPE` ficou vazio e a
 *    `NavSecondary` não é mais montada.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const ativo = destinoAtivo(pathname)

  return (
    // `collapsible="icon"` e não o `offcanvas` padrão: no protótipo a coluna
    // recolhida vira um trilho de 52px só com ícones, ela não sai de cena. Com
    // offcanvas o espaçador colapsa para 0 e o conteúdo passa POR BAIXO da
    // barra fixa — medido em /contatos, a primeira coluna da tabela ficava
    // escondida atrás do menu.
    <Sidebar variant="inset" collapsible="icon" className="onface-sidebar" {...props}>
      <SidebarHeader className="onface-sidebar-header">
        <Link href="/inicio" className="onface-sidebar-marca" aria-label="ONFACE, ir para o início">
          {/* Duas imagens e não uma com `object-fit`: o lockup e o símbolo têm
              proporções diferentes, e recortar o lockup no modo ícone deixaria
              meia palavra aparecendo. Quem troca é o CSS, pelo
              `data-collapsible` do wrapper. */}
          <img src="/onface/onface-lockup-negativa.svg" alt="" className="onface-sidebar-lockup" />
          <img src="/onface/figma-logo.svg" alt="" className="onface-sidebar-simbolo" />
        </Link>

        {/* Criar leva às quatro telas que DONAM cada criação, e não abre o
            formulário direto. É deliberado e é o limite de hoje: nenhuma das
            quatro páginas aceita um parâmetro de abertura (`searchParams` de
            Pipeline e Propostas estão logo ali e não têm um), então um
            `?criar=lead` seria um link que não faz nada. Quando as telas
            honrarem o parâmetro, é trocar o `href` aqui. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="onface-sidebar-criar" title="Criar">
              <Plus aria-hidden />
              <span className="onface-sidebar-criar-rotulo">Criar</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-52">
            <DropdownMenuItem asChild>
              <Link href="/pre-vendas">Novo lead</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/pipeline">Nova oportunidade</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/propostas">Nova proposta</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/tarefas">Nova atividade</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain areas={NAVEGACAO} destinoAtivo={ativo} />
      </SidebarContent>

      <SidebarFooter className="onface-sidebar-rodape">
        <NexoPainel />
      </SidebarFooter>
    </Sidebar>
  )
}
