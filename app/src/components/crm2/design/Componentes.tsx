"use client";

/**
 * Catálogo dos COMPONENTES. Client component porque o valor aqui está nos
 * estados — hover, foco, aberto, carregando, vazio. "Interface morta" foi um
 * dos diagnósticos de "cara de IA": um componente só está pronto quando os
 * estados dele estão desenhados, não só o repouso.
 */
import * as React from "react";
import { MoreHorizontal, Search, Plus, TrendingUp, Inbox, AlertCircle, PhoneCall, Mail, Handshake, UserPlus, LayoutGrid, Rows3, List } from "lucide-react";
import { Secao, Amostra, Grade, Painel } from "./Base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Cf2Avatar, Cf2AvatarGrupo } from "@/components/crm2/ds/Avatar";
import { Cf2SegmentedControl, Cf2Timeline } from "@/components/crm2/ds/Navegacao";
import { Cf2Status, STATUS_NEGOCIO } from "@/components/crm2/ds/Status";
import {
  Cf2Tabela, Cf2TabelaCabecalho, Cf2TabelaCorpo, Cf2Th, Cf2Td, Cf2Linha, Cf2TdAcoes,
  Cf2TabelaToolbar, Cf2TabelaSelecao, Cf2ThSelecao, Cf2TdSelecao, Cf2CelulaEntidade,
  Cf2TabelaPaginacao,
} from "@/components/crm2/ds/Tabela";

const CHAVES_STATUS = ["ganho", "perdido", "risco", "novo", "aberto", "semContato"] as const;

const LEADS = [
  { nome: "Mayara Anjos", email: "mayara@contabilix.com.br", empresa: "Contabilix", valor: "R$ 4.200", status: "ganho" as const },
  { nome: "Rafael Menezes", email: "rafael@opticavero.com", empresa: "Óptica Vero", valor: "R$ 1.850", status: "novo" as const },
  { nome: "Juliana Prado", email: "ju@clinicanovoar.com.br", empresa: "Clínica Novo Ar", valor: "R$ 7.400", status: "risco" as const },
  { nome: "Caio Duarte", email: "caio@lojaskn.com", empresa: "Lojas KN", valor: "R$ 2.980", status: "aberto" as const },
];

export function CatalogoComponentes() {
  const [carregando, setCarregando] = React.useState(false);
  const [periodo, setPeriodo] = React.useState("mes");
  const [visao, setVisao] = React.useState("lista");
  const [densidade, setDensidade] = React.useState<"compacta" | "padrao" | "confortavel">("padrao");
  const [marcados, setMarcados] = React.useState<string[]>([]);
  const [pagina, setPagina] = React.useState(1);

  const alternar = (nome: string) =>
    setMarcados((m) => (m.includes(nome) ? m.filter((x) => x !== nome) : [...m, nome]));
  const todosMarcados = marcados.length === LEADS.length;

  return (
    <div className="flex flex-col gap-10">
      <Secao
        id="botoes"
        titulo="Botões"
        descricao="Cinco degraus de hierarquia (primário → secundário → terciário → sutil → fantasma), na linha do Once UI. Com só dois níveis tudo vira 'primário ou nada', e é isso que achata a tela. Uma ação primária por tela."
      >
        <Grade min={300}>
          <Amostra rotulo="Hierarquia" codigo="variant=…">
            <div className="flex flex-wrap gap-2">
              <Button size="sm"><Plus />Novo negócio</Button>
              <Button size="sm" variant="secondary">Secundário</Button>
              <Button size="sm" variant="tertiary">Terciário</Button>
              <Button size="sm" variant="subtle">Sutil</Button>
              <Button size="sm" variant="ghost">Fantasma</Button>
              <Button size="sm" variant="outline">Contorno</Button>
              <Button size="sm" variant="link">Link</Button>
            </div>
          </Amostra>

          <Amostra rotulo="Semânticas" codigo="success / warning / destructive">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success"><Handshake />Marcar ganho</Button>
              <Button size="sm" variant="warning">Sinalizar risco</Button>
              <Button size="sm" variant="destructive">Marcar perdido</Button>
            </div>
            <p className="text-apoio text-tinta-fraca">
              Ação com consequência carrega a cor do significado — &ldquo;marcar perdido&rdquo;
              nunca deve ser um botão cinza igual a &ldquo;cancelar&rdquo;.
            </p>
          </Amostra>

          <Amostra rotulo="Estados" codigo="loading / disabled">
            <div className="flex flex-wrap gap-2 items-center">
              <Button size="sm" loading>Salvando</Button>
              <Button size="sm" variant="outline" disabled>Desabilitado</Button>
              <Button
                size="sm"
                variant="tertiary"
                loading={carregando}
                onClick={() => { setCarregando(true); setTimeout(() => setCarregando(false), 1800); }}
              >
                Clique pra ver
              </Button>
            </div>
            <p className="text-apoio text-tinta-fraca">
              `loading` bloqueia a interação sozinho — impede duplo-envio sem a tela
              precisar montar isso à mão.
            </p>
          </Amostra>

          <Amostra rotulo="Tamanhos" codigo="size=…">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs">xs</Button>
              <Button size="sm">sm</Button>
              <Button size="default">padrão</Button>
              <Button size="lg">lg</Button>
              <Button size="icon-sm" variant="outline" aria-label="Ligar"><PhoneCall /></Button>
              <Button size="icon" variant="outline" aria-label="E-mail"><Mail /></Button>
            </div>
          </Amostra>

          <Amostra rotulo="Menu de ações" codigo="DropdownMenu">
            <div className="flex gap-2 items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline"><MoreHorizontal />Ações</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem>Editar</DropdownMenuItem>
                  <DropdownMenuItem>Transferir responsável</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive">Marcar como perdido</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label="Mais ações"><MoreHorizontal /></Button>
                </TooltipTrigger>
                <TooltipContent>Ações da linha</TooltipContent>
              </Tooltip>
            </div>
          </Amostra>

          <Amostra rotulo="Largura total" codigo="fillWidth">
            <Button size="sm" fillWidth variant="tertiary"><UserPlus />Adicionar ao pipeline</Button>
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="status"
        titulo="Status"
        descricao="Ponto colorido + texto normal, não pastilha colorida. Numa lista de 50 negócios, 50 pastilhas coloridas não destacam nada — a cor perde a função de sinalizar. O fundo só é preenchido no estado excepcional, que a pessoa precisa ver de longe."
      >
        <Grade min={300}>
          <Amostra rotulo="Padrão — o ponto carrega o significado" codigo="<Cf2Status />">
            <div className="flex flex-col gap-2">
              {CHAVES_STATUS.map((k) => (
                <Cf2Status key={k} tom={STATUS_NEGOCIO[k].tom}>{STATUS_NEGOCIO[k].rotulo}</Cf2Status>
              ))}
            </div>
          </Amostra>
          <Amostra rotulo="Forte — reservado ao excepcional" codigo="forte">
            <div className="flex flex-wrap gap-2">
              <Cf2Status tom="atencao" forte>Em risco</Cf2Status>
              <Cf2Status tom="negativo" forte>Atrasado 12 dias</Cf2Status>
              <Cf2Status tom="positivo" forte>Meta batida</Cf2Status>
            </div>
            <p className="text-apoio text-tinta-fraca">
              Se tudo for forte, nada é. Use quando a linha precisa saltar na varredura.
            </p>
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="formulario"
        titulo="Campos"
        descricao="Altura de alvo de toque no mobile (44px) é requisito de uso real no celular, não estética. O anel de foco é o mesmo em todo controle."
      >
        <Grade min={280}>
          <Amostra rotulo="Texto e busca" codigo="<Input />">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-nome" className="text-apoio">Nome do lead</Label>
                <Input id="d-nome" placeholder="Ex.: Contabilix" className="rounded-control" />
              </div>
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-tinta-fraca pointer-events-none" />
                <Input placeholder="Buscar…" className="rounded-control pl-9" />
              </div>
            </div>
          </Amostra>

          <Amostra rotulo="Alternância" codigo="<Switch />">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="d-sw" className="text-corpo">Notificar por WhatsApp</Label>
              <Switch id="d-sw" defaultChecked />
            </div>
          </Amostra>

        </Grade>
      </Secao>

      <Secao
        id="entidades"
        titulo="Entidades"
        descricao="Um componente só resolve lead, contato, empresa, usuário e agente. Cor derivada por hash do nome, então a mesma pessoa tem a mesma cor em toda tela; empresa usa canto arredondado em vez de círculo."
      >
        <Grade min={260}>
          <Amostra rotulo="Avatar por tipo" codigo="<Cf2Avatar tipo=… />">
            <div className="flex items-center gap-3 flex-wrap">
              <Cf2Avatar nome="Mayara Anjos" tipo="usuario" size="lg" />
              <Cf2Avatar nome="Contabilix" tipo="empresa" size="lg" />
              <Cf2Avatar nome="Rafael Menezes" tipo="pessoa" size="lg" />
              <Cf2Avatar nome={null} tipo="empresa" size="lg" />
              <Cf2Avatar nome={null} tipo="agente" size="lg" />
            </div>
          </Amostra>
          <Amostra rotulo="Grupo com excedente" codigo="<Cf2AvatarGrupo />">
            <Cf2AvatarGrupo nomes={["Mayara Anjos", "Rafael Menezes", "Juliana Prado", "Caio Duarte", "Bia Ramos", "Léo Prado"]} max={4} size="default" />
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="navegacao"
        titulo="Recorte e navegação"
        descricao="Abas trocam de SEÇÃO (conteúdos diferentes). Controle segmentado troca de RECORTE (mesmo conteúdo, outro filtro). São coisas distintas — misturar é o que faz uma tela ter três barras parecidas fazendo coisas diferentes."
      >
        <Grade min={300}>
          <Amostra rotulo="Abas — trocam de seção" codigo="<Tabs />">
            <Tabs defaultValue="todas">
              <TabsList>
                <TabsTrigger value="todas">Todas</TabsTrigger>
                <TabsTrigger value="minhas">Minhas</TabsTrigger>
                <TabsTrigger value="risco">Em risco</TabsTrigger>
              </TabsList>
            </Tabs>
          </Amostra>
          <Amostra rotulo="Segmentado — troca o recorte" codigo="<Cf2SegmentedControl />">
            <Cf2SegmentedControl
              opcoes={[
                { valor: "mes", rotulo: "Mês" },
                { valor: "tri", rotulo: "Trimestre" },
                { valor: "ano", rotulo: "Ano" },
              ]}
              valor={periodo}
              aoMudar={setPeriodo}
            />
            <p className="text-apoio text-tinta-fraca">O indicador desliza — sem isso a troca é um pisca seco.</p>
          </Amostra>
          <Amostra rotulo="Com ícone e largura total" codigo="fillWidth">
            <Cf2SegmentedControl
              fillWidth
              opcoes={[
                { valor: "lista", rotulo: "Lista", icone: List },
                { valor: "quadro", rotulo: "Quadro", icone: LayoutGrid },
                { valor: "linhas", rotulo: "Compacto", icone: Rows3 },
              ]}
              valor={visao}
              aoMudar={setVisao}
            />
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="dados"
        titulo="Tabela"
        descricao="Três densidades, um componente: serve pra um resumo de 5 linhas dentro de um card e pra 300 negócios em tela cheia. Número à direita e tabular, cabeçalho como rótulo, linha clicável e navegável por teclado, ação escondida até o hover. Seleção em lote é o ganho real num CRM — transferir 10 leads de responsável sem abrir 10 telas."
      >
        <div className="flex flex-col gap-3">
          <Cf2SegmentedControl
            opcoes={[
              { valor: "compacta", rotulo: "Compacta" },
              { valor: "padrao", rotulo: "Padrão" },
              { valor: "confortavel", rotulo: "Confortável" },
            ]}
            valor={densidade}
            aoMudar={setDensidade}
          />
          <Painel>
            {/* A barra de seleção SUBSTITUI a toolbar quando há itens marcados —
                empilhar as duas faz a tabela pular a cada clique. */}
            {marcados.length > 0 ? (
              <Cf2TabelaSelecao quantidade={marcados.length} aoLimpar={() => setMarcados([])}>
                <Button size="xs" variant="outline">Transferir responsável</Button>
                <Button size="xs" variant="outline">Adicionar tag</Button>
                <Button size="xs" variant="destructive">Marcar perdidos</Button>
              </Cf2TabelaSelecao>
            ) : (
              <Cf2TabelaToolbar
                acoes={<Button size="sm" variant="outline"><MoreHorizontal />Exportar</Button>}
              >
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-tinta-fraca pointer-events-none" />
                  <Input placeholder="Buscar lead…" className="h-8 rounded-control pl-8 text-corpo w-56 max-w-full" />
                </div>
              </Cf2TabelaToolbar>
            )}

            <Cf2Tabela densidade={densidade} zebrada={densidade === "compacta"}>
              <Cf2TabelaCabecalho>
                <tr>
                  <Cf2ThSelecao
                    todosMarcados={todosMarcados}
                    algunsMarcados={marcados.length > 0 && !todosMarcados}
                    aoAlternar={() => setMarcados(todosMarcados ? [] : LEADS.map((l) => l.nome))}
                  />
                  <Cf2Th>Lead</Cf2Th>
                  <Cf2Th className="hidden sm:table-cell">Empresa</Cf2Th>
                  <Cf2Th>Status</Cf2Th>
                  <Cf2Th numerico>Valor</Cf2Th>
                  <Cf2Th><span className="sr-only">Ações</span></Cf2Th>
                </tr>
              </Cf2TabelaCabecalho>
              <Cf2TabelaCorpo>
                {LEADS.map((l) => (
                  <Cf2Linha key={l.nome} aoClicar={() => {}} selecionada={marcados.includes(l.nome)}>
                    <Cf2TdSelecao
                      marcado={marcados.includes(l.nome)}
                      aoAlternar={() => alternar(l.nome)}
                      rotulo={l.nome}
                    />
                    <Cf2Td>
                      <Cf2CelulaEntidade
                        avatar={<Cf2Avatar nome={l.nome} tipo="pessoa" size="default" />}
                        titulo={l.nome}
                        subtitulo={l.email}
                      />
                    </Cf2Td>
                    <Cf2Td className="hidden sm:table-cell text-tinta-suave">{l.empresa}</Cf2Td>
                    <Cf2Td>
                      <Cf2Status tom={STATUS_NEGOCIO[l.status].tom} forte={STATUS_NEGOCIO[l.status].forte}>
                        {STATUS_NEGOCIO[l.status].rotulo}
                      </Cf2Status>
                    </Cf2Td>
                    <Cf2Td numerico>{l.valor}</Cf2Td>
                    <Cf2TdAcoes>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label={`Ações de ${l.nome}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Abrir negócio</DropdownMenuItem>
                          <DropdownMenuItem>Transferir responsável</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive">Marcar perdido</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Cf2TdAcoes>
                  </Cf2Linha>
                ))}
              </Cf2TabelaCorpo>
            </Cf2Tabela>

            <Cf2TabelaPaginacao
              pagina={pagina}
              porPagina={4}
              total={312}
              aoMudarPagina={setPagina}
            />
          </Painel>
          <p className="text-apoio text-tinta-fraca">
            No celular a coluna Empresa some e vira subtítulo do nome — esconder coluna
            é melhor que espremer todas.
          </p>
        </div>
      </Secao>

      <Secao
        id="historico"
        titulo="Histórico"
        descricao="Timeline de entidade: atividades do lead, etapas do onboarding, mudanças de um negócio. O marcador ancora no topo do item, não no meio — com alturas diferentes, marcador centralizado faz a linha parecer torta."
      >
        <Painel className="cf2-p-card max-w-xl">
          <Cf2Timeline
            itens={[
              { id: "1", titulo: "Negócio ganho", descricao: "Contrato de R$ 4.200/mês assinado.", quando: "hoje, 14:32", quandoCompleto: "31/08/2026 14:32", responsavel: "Mayara Anjos", tom: "positivo", icone: Handshake },
              { id: "2", titulo: "Proposta enviada", descricao: "Plano Pro, 12 meses.", quando: "ontem, 09:10", quandoCompleto: "30/08/2026 09:10", responsavel: "Mayara Anjos", tom: "marca", icone: Mail },
              { id: "3", titulo: "Ligação realizada", descricao: "8 min — decisor confirmou orçamento.", quando: "26/08, 16:04", quandoCompleto: "26/08/2026 16:04", responsavel: "Rafael Menezes", tom: "neutro", icone: PhoneCall },
              { id: "4", titulo: "Lead criado", descricao: "Meta Ads · campanha Retenção 08.", quando: "24/08, 10:22", quandoCompleto: "24/08/2026 10:22", responsavel: "Automação", tom: "neutro", icone: UserPlus },
            ]}
          />
        </Painel>
      </Secao>

      <Secao
        id="estados"
        titulo="Estados de tela"
        descricao="Vazio, carregando e erro fazem parte do componente — não são um `<p>` centralizado improvisado na hora. Vazio sempre oferece a próxima ação; carregando imita a forma do conteúdo real, não um spinner genérico."
      >
        <Grade min={300}>
          <Amostra rotulo="Vazio" codigo="<Empty />">
            <Empty className="border-0 py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                <EmptyTitle className="text-item">Nenhum lead novo hoje</EmptyTitle>
                <EmptyDescription className="text-corpo">
                  Assim que uma campanha gerar contato, ele aparece aqui.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" variant="outline"><Plus />Cadastrar manualmente</Button>
              </EmptyContent>
            </Empty>
          </Amostra>

          <Amostra rotulo="Carregando" codigo="<Skeleton />">
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-full shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                  <Skeleton className="h-3 w-14 shrink-0" />
                </div>
              ))}
            </div>
          </Amostra>

          <Amostra rotulo="Erro" codigo="estado de falha">
            <Empty className="border-0 py-4">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-negativo-suave text-negativo"><AlertCircle /></EmptyMedia>
                <EmptyTitle className="text-item">Não foi possível carregar</EmptyTitle>
                <EmptyDescription className="text-corpo">
                  A conexão falhou. Seus dados não foram perdidos.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" variant="outline">Tentar de novo</Button>
              </EmptyContent>
            </Empty>
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="sobreposicao"
        titulo="Sobreposição"
        descricao="Modal para decisão curta que exige resposta. Para edição longa ou contexto lateral, o padrão é drawer — modal empilhado vira armadilha de usabilidade."
      >
        <Grade min={280}>
        <Amostra rotulo="Modal de confirmação" codigo="<Dialog />">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">Abrir exemplo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Marcar negócio como perdido?</DialogTitle>
                <DialogDescription>
                  O negócio sai do pipeline e passa a contar como perda no mês. Dá pra reverter depois.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" size="sm">Cancelar</Button>
                <Button variant="destructive" size="sm">Marcar como perdido</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <p className="text-apoio text-tinta-fraca">Decisão curta que exige resposta.</p>
        </Amostra>

        <Amostra rotulo="Drawer" codigo="<Drawer />">
          <Drawer direction="right">
            <DrawerTrigger asChild>
              <Button size="sm" variant="outline">Abrir exemplo</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Contabilix</DrawerTitle>
                <DrawerDescription>Detalhe do negócio sem sair da lista.</DrawerDescription>
              </DrawerHeader>
              <div className="px-4">
                <Cf2Timeline
                  itens={[
                    { id: "1", titulo: "Proposta enviada", quando: "ontem, 09:10", responsavel: "Mayara Anjos", tom: "marca", icone: Mail },
                    { id: "2", titulo: "Lead criado", quando: "24/08, 10:22", responsavel: "Automação", tom: "neutro", icone: UserPlus },
                  ]}
                />
              </div>
              <DrawerFooter>
                <Button size="sm" variant="success"><Handshake />Marcar ganho</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          <p className="text-apoio text-tinta-fraca">
            Edição longa e contexto lateral. Preserva a lista atrás — modal empilhado
            vira armadilha.
          </p>
        </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="movimento"
        titulo="Movimento"
        descricao="Duração e curva são token, não improviso. Saída é mais rápida que entrada — sair tem que parecer instantâneo. Quem desativou animação no sistema operacional recebe transição de 1ms automaticamente."
      >
        <Grade min={240}>
          <Amostra rotulo="Hover padrão" codigo="cf2-transicao">
            <div className="cf2-transicao cf2-card cf2-p-card cursor-pointer hover:shadow-flutuante hover:-translate-y-0.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-positivo" />
                <span className="text-item font-medium">Passe o mouse aqui</span>
              </div>
              <p className="text-apoio text-tinta-fraca mt-1">Elevação sobe, card levanta 2px.</p>
            </div>
          </Amostra>
          <Amostra rotulo="Durações" codigo="--animate-duracao-*">
            <ul className="text-corpo text-tinta-suave flex flex-col gap-1">
              <li><strong className="text-tinta">rápida 120ms</strong> — hover, foco</li>
              <li><strong className="text-tinta">padrão 200ms</strong> — abrir menu, trocar aba</li>
              <li><strong className="text-tinta">lenta 320ms</strong> — drawer, sheet</li>
            </ul>
          </Amostra>
        </Grade>
      </Secao>
    </div>
  );
}
