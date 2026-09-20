"use client";

/** Seção Primitivas do ONFACE.
 *
 * Regra da seção: nada aqui é recriado. Todo bloco monta o componente real de
 * `components/ui` e liga estado React de verdade. Documentação com HTML morto
 * envelhece sem ninguém perceber; esta página quebra junto com o produto no
 * dia em que o Button mudar, que é o ponto.
 *
 * Dois primitivos que a lista do shadcn tem e este repo ainda não: AlertDialog
 * e ContextMenu. O bloco de sobreposições mostra o substituto usado hoje e diz
 * de onde ele veio, em vez de fingir que o componente existe. */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import {
  ArrowRight, Bell, Building2, CalendarDays, Check, ChevronLeft, ChevronRight,
  ChevronsUpDown, CircleCheck, Command as IconeComando, Copy, Download, FileText,
  Filter, Info, Mail, MessageSquare, MoveRight, Pencil, Phone, Plus,
  Send, Settings2, Sparkles, Trash2, TriangleAlert, Undo2, UserPlus, Users, X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
  CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter,
  DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader,
  SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Bloco, Chave, Coluna, Linha, Playground, Regras, Secao, Vazio } from "../lab";
import { FundoGrafico } from "../marca";
import { MOLA } from "../motion";
import {
  ATIVIDADES, CONVERSAS, ETAPAS_QUADRO, NEGOCIOS, RESPONSAVEIS, brl, compacto,
} from "../dados";
import "./componentes.css";

/* ════════════════════════════════════════════════════════════════════════
 * Utilidades locais
 * ════════════════════════════════════════════════════════════════════════ */

/** Máscara de moeda pelos centavos: o usuário digita dígito, não pontuação.
 * Formatar a cada tecla evita o campo "42600" virar R$ 4,26 no salvamento. */
function mascaraMoeda(bruto: string) {
  const digitos = bruto.replace(/\D/g, "").slice(0, 11);
  if (!digitos) return "";
  return brl(Number(digitos) / 100, true);
}

/** Máscara de telefone BR, com celular (9 dígitos) e fixo (8) no mesmo campo. */
function mascaraTelefone(bruto: string) {
  const d = bruto.replace(/\D/g, "").slice(0, 11);
  const celular = d.length > 10;
  const meio = celular ? d.slice(2, 7) : d.slice(2, 6);
  const fim = celular ? d.slice(7) : d.slice(6);
  if (d.length <= 2) return d ? `(${d}` : "";
  return `(${d.slice(0, 2)}) ${meio}${fim ? `-${fim}` : ""}`;
}

const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const formatarData = (data: Date) => DATA_CURTA.format(data);

const PRODUTOS = ["PABX", "Callface AI", "White Label", "Licenças", "Discador"] as const;
const CANAIS = ["WhatsApp", "E-mail", "Ligação", "SMS"] as const;

/** Atalho do palette. O símbolo depende do sistema e só pode ser lido no
 * cliente; no servidor não existe `navigator`. `useSyncExternalStore` entrega
 * "Ctrl" na marcação do servidor e corrige na hidratação sem efeito nem
 * segundo render em cascata. Nada para assinar: o valor não muda em runtime. */
const SEM_INSCRICAO = () => () => {};
function useTeclaComando() {
  return React.useSyncExternalStore(
    SEM_INSCRICAO,
    () => (/Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return <kbd className="cmp-tecla">{children}</kbd>;
}

/** Agrupador de blocos por natureza do componente.
 *
 * A seção tem oito blocos e, empilhados com o mesmo intervalo, viram uma
 * rolagem plana onde nada começa nem termina. A família dá capítulo: o
 * intervalo entre grupos é maior que o intervalo entre blocos, e é a diferença
 * entre os dois — não o intervalo sozinho — que o olho lê como corte.
 *
 * O cabeçalho é de propósito mais fraco que o `h2` do bloco. Ele separa; quem
 * titula continua sendo o bloco. */
function Familia({
  indice,
  nome,
  children,
}: {
  indice: string;
  nome: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cmp-familia" aria-label={nome}>
      <header className="cmp-familia-topo">
        <span className="cmp-familia-indice">{indice}</span>
        <h3 className="cmp-familia-nome">{nome}</h3>
      </header>
      {children}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 1. Botão
 * ════════════════════════════════════════════════════════════════════════ */

function BlocoBotoes() {
  const [desabilitado, setDesabilitado] = React.useState(false);
  const [comIcone, setComIcone] = React.useState(true);
  const [enviando, setEnviando] = React.useState(false);
  const [tamanho, setTamanho] = React.useState<"sm" | "default" | "lg">("default");

  /** Envio real: o botão só volta ao normal quando a resposta chega. Spinner
   * que não bloqueia o segundo clique é a origem da proposta duplicada, e o
   * `loading` do Button já desabilita sozinho. */
  async function enviarProposta() {
    setEnviando(true);
    await new Promise<void>((resolver) => window.setTimeout(resolver, 1400));
    setEnviando(false);
    toast.success("Proposta enviada para TechCorp Telecom");
  }

  return (
    <Bloco
      arquivo="components/ui/button.tsx"
      importar={'import { Button } from "@/components/ui/button";'}
      titulo="Botão"
      descricao="Cinco degraus de hierarquia e três semânticos. O degrau escolhe a atenção que a ação merece na tela; a cor semântica só entra quando a ação tem consequência."
    >
      <Coluna>
        <Linha rotulo="Hierarquia">
          <Button>Novo negócio</Button>
          <Button variant="secondary">Registrar ligação</Button>
          <Button variant="tertiary">Duplicar</Button>
          <Button variant="outline">Exportar</Button>
          <Button variant="subtle">Ver histórico</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="link">Abrir no CRM</Button>
        </Linha>

        <Linha rotulo="Semântica">
          <Button variant="success">Marcar como ganho</Button>
          <Button variant="warning">Revisar desconto</Button>
          <Button variant="destructive">Excluir negócio</Button>
        </Linha>

        <Linha rotulo="Tamanho">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button size="default">default</Button>
          <Button size="lg">lg</Button>
        </Linha>

        <Linha rotulo="Só ícone">
          <TooltipProvider>
            {([
              { size: "icon-xs" as const, rotulo: "Copiar telefone", Icone: Copy },
              { size: "icon-sm" as const, rotulo: "Editar negócio", Icone: Pencil },
              { size: "icon" as const, rotulo: "Baixar proposta", Icone: Download },
              { size: "icon-lg" as const, rotulo: "Ligar para o contato", Icone: Phone },
            ]).map(({ size, rotulo, Icone }) => (
              <Tooltip key={size}>
                <TooltipTrigger asChild>
                  {/* Sem rótulo visível, o nome acessível é obrigatório: sem ele
                      o leitor de tela anuncia "botão" e nada mais. */}
                  <Button variant="outline" size={size} aria-label={rotulo}>
                    <Icone />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{rotulo}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </Linha>

        <Linha rotulo="Estados">
          <Button className="cmp-foco">Foco visível</Button>
          <Button disabled>Desabilitado</Button>
          <Button loading>Salvando</Button>
          <Button variant="outline" loading>
            Sincronizando
          </Button>
        </Linha>

        <Linha rotulo="Grupo">
          <span className="cmp-grupo">
            <Button onClick={() => void enviarProposta()} loading={enviando}>
              <Send />
              Enviar proposta
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" aria-label="Outras formas de enviar">
                  <ChevronsUpDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => toast("Proposta enviada por WhatsApp")}>
                  <MessageSquare />
                  Enviar por WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toast("Link copiado")}>
                  <Copy />
                  Copiar link da proposta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>

          <ToggleGroup
            type="single"
            variant="outline"
            value={tamanho}
            onValueChange={(v) => {
              if (v) setTamanho(v as "sm" | "default" | "lg");
            }}
            aria-label="Tamanho do botão de exemplo"
          >
            <ToggleGroupItem value="sm">Compacto</ToggleGroupItem>
            <ToggleGroupItem value="default">Padrão</ToggleGroupItem>
            <ToggleGroupItem value="lg">Grande</ToggleGroupItem>
          </ToggleGroup>
        </Linha>

        <Playground>
          <Chave id="btn-desabilitado" rotulo="Desabilitado" valor={desabilitado} aoMudar={setDesabilitado} />
          <Chave id="btn-icone" rotulo="Com ícone" valor={comIcone} aoMudar={setComIcone} />
          <Button size={tamanho} disabled={desabilitado}>
            {comIcone ? <Plus /> : null}
            Novo negócio
          </Button>
        </Playground>

        <p className="cmp-nota">
          <strong>Carregando é bloqueio, não enfeite.</strong> `loading` desabilita o botão e mantém a
          largura, então a linha não pula e o clique duplo não passa.
        </p>
        {/* Por que a escada de variantes é documentada sobre branco e não sobre
            a superfície afundada: `tertiary` é preenchido com o próprio token
            afundado. Em fundo afundado ele desaparece e a escada passa a ter um
            degrau a menos do que o produto tem. Contraste de demo não pode
            custar a verdade da demo. */}
        <p className="cmp-nota">
          <strong>Este bloco fica sobre branco de propósito.</strong> `tertiary` é preenchido com o
          mesmo token da superfície afundada: em fundo afundado ele some, e a escada apareceria com um
          degrau a menos do que o produto tem. Onde o gatilho é só `outline` (Sobreposições, Command),
          a demo vai para o afundado — lá a placa branca é o que precisa ser visto.
        </p>
      </Coluna>
    </Bloco>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 1b. Estados do controle
 * ════════════════════════════════════════════════════════════════════════ */

const RECORTES = [
  { valor: "meus", rotulo: "Meus" },
  { valor: "time", rotulo: "Do time" },
] as const;

/** Os cinco estados que a lista de botões acima não consegue provar.
 *
 * Hierarquia se mostra lado a lado; estado, não: repouso e desabilitado
 * empilhados numa linha só viram dois botões parecidos. Aqui cada estado tem
 * rótulo, o controle de verdade e a regra dele — e os cinco dividem a mesma
 * superfície, porque o que está sendo comparado é o controle, não a moldura. */
function BlocoEstados() {
  const [recorte, setRecorte] = React.useState<string>("meus");

  return (
    <Bloco
      arquivo="components/ui/switch.tsx"
      importar={'import { Switch } from "@/components/ui/switch";'}
      titulo="Estados do controle"
      descricao="Estado que ninguém percebe é estado que não existe. Foco tem que ser visível sem o mouse, selecionado tem que ser inequívoco na primeira olhada, desabilitado tem que continuar legível e o secundário não pode ser confundido com o texto da tela."
    >
      <div className="cmp-estados">
        <div className="cmp-estado">
          <span className="cmp-estado-rotulo">Repouso</span>
          <div className="cmp-estado-peca">
            <Button variant="outline">Agendar retorno</Button>
          </div>
          <p>A linha de base. Borda hairline e fundo da superfície: quieto, mas nunca invisível.</p>
        </div>

        <div className="cmp-estado">
          <span className="cmp-estado-rotulo">Foco</span>
          <div className="cmp-estado-peca">
            {/* Anel forçado por classe: a página precisa mostrar o estado sem
                depender de quem está com o Tab na mão. O valor é o mesmo token
                do `:focus-visible` da casca, não um anel só desta tela. */}
            <Button variant="outline" className="cmp-foco">
              Agendar retorno
            </Button>
          </div>
          <p>Anel coral de 2px com 2px de folga, por fora da borda. Quem navega por teclado enxerga onde está de qualquer distância.</p>
        </div>

        <div className="cmp-estado">
          <span className="cmp-estado-rotulo">Selecionado</span>
          <div className="cmp-estado-peca">
            <div className="ds-controle-grupo" role="group" aria-label="Recorte da lista">
              {RECORTES.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  className="ds-chip-filtro"
                  data-ativo={recorte === opcao.valor}
                  aria-pressed={recorte === opcao.valor}
                  onClick={() => setRecorte(opcao.valor)}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </div>
          <p>Três sinais juntos: fundo coral esmaecido, borda que sai de tracejada para sólida e texto escurecido. Um só falharia em alguma condição.</p>
        </div>

        <div className="cmp-estado" data-alcance="fora">
          <span className="cmp-estado-rotulo">Desabilitado</span>
          <div className="cmp-estado-peca">
            <Button disabled>Enviar proposta</Button>
          </div>
          <p>Recua de plano, não de existência: o controle continua legível e o motivo anda junto dele. Desabilitado sem motivo vira chamado de suporte.</p>
        </div>

        <div className="cmp-estado">
          <span className="cmp-estado-rotulo">Secundário</span>
          <div className="cmp-estado-peca">
            <span className="cmp-estado-contraprova">O contrato vence em 12 dias.</span>
            <Button variant="secondary">Renovar contrato</Button>
          </div>
          <p>Encostado num texto de verdade: o secundário tem preenchimento próprio, então lê como controle e não como mais uma frase da tela.</p>
        </div>
      </div>
    </Bloco>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 2. Formulário
 * ════════════════════════════════════════════════════════════════════════ */

type Formulario = {
  empresa: string;
  valor: string;
  telefone: string;
  produto: string;
  responsavel: string;
  canais: string[];
  etapa: string;
  desconto: string;
  observacao: string;
  fechamento: Date | undefined;
  periodo: DateRange | undefined;
  aceite: boolean;
  avisarTime: boolean;
};

const FORMULARIO_INICIAL: Formulario = {
  empresa: "TechCorp Telecom",
  valor: "",
  telefone: "",
  produto: "PABX",
  responsavel: "",
  canais: ["WhatsApp"],
  etapa: "Proposta",
  desconto: "8",
  observacao: "",
  fechamento: undefined,
  periodo: undefined,
  aceite: false,
  avisarTime: true,
};

function BlocoFormulario() {
  const [dados, setDados] = React.useState<Formulario>(FORMULARIO_INICIAL);
  const [erros, setErros] = React.useState<Partial<Record<keyof Formulario, string>>>({});
  const [salvando, setSalvando] = React.useState(false);
  const [comboAberto, setComboAberto] = React.useState(false);
  const [canaisAberto, setCanaisAberto] = React.useState(false);
  const semMovimento = useReducedMotion();

  const alterar = <C extends keyof Formulario>(campo: C, valor: Formulario[C]) =>
    setDados((atual) => ({ ...atual, [campo]: valor }));

  function alternarCanal(canal: string) {
    setDados((atual) => ({
      ...atual,
      canais: atual.canais.includes(canal)
        ? atual.canais.filter((c) => c !== canal)
        : [...atual.canais, canal],
    }));
  }

  /** Validação no envio, não a cada tecla: marcar erro enquanto a pessoa ainda
   * está digitando o primeiro caractere é hostil e não ajuda ninguém. */
  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const novos: Partial<Record<keyof Formulario, string>> = {};
    if (!dados.empresa.trim()) novos.empresa = "Informe a empresa do negócio.";
    if (!dados.valor) novos.valor = "Proposta sem valor não entra no funil.";
    if (!dados.responsavel) novos.responsavel = "Todo negócio precisa de um dono.";
    if (!dados.aceite) novos.aceite = "Confirme a revisão antes de enviar.";
    setErros(novos);
    if (Object.keys(novos).length > 0) {
      toast.error("Faltam campos obrigatórios");
      return;
    }
    setSalvando(true);
    await new Promise<void>((resolver) => window.setTimeout(resolver, 1200));
    setSalvando(false);
    toast.success(`Proposta de ${dados.valor || "R$ 0,00"} registrada em ${dados.empresa}`);
  }

  return (
    <Bloco
      arquivo="components/ui/field.tsx"
      importar={'import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";'}
      titulo="Formulário"
      descricao="Um formulário de proposta inteiro e funcional: campo, rótulo, apoio, erro e motivo de bloqueio. Rótulo sempre visível — placeholder não é rótulo, some na hora de conferir."
    >
      <form className="cmp-form" onSubmit={(e) => void enviar(e)} noValidate>
        <Field data-invalid={erros.empresa ? true : undefined}>
          <FieldLabel htmlFor="f-empresa">Empresa</FieldLabel>
          <Input
            id="f-empresa"
            value={dados.empresa}
            onChange={(e) => alterar("empresa", e.target.value)}
            aria-invalid={Boolean(erros.empresa)}
            aria-describedby={erros.empresa ? "f-empresa-erro" : undefined}
          />
          <FieldError id="f-empresa-erro">{erros.empresa}</FieldError>
        </Field>

        <Field data-invalid={erros.valor ? true : undefined}>
          <FieldLabel htmlFor="f-valor">Valor da proposta</FieldLabel>
          <Input
            id="f-valor"
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={dados.valor}
            onChange={(e) => alterar("valor", mascaraMoeda(e.target.value))}
            aria-invalid={Boolean(erros.valor)}
            aria-describedby={erros.valor ? "f-valor-erro" : undefined}
          />
          <FieldError id="f-valor-erro">{erros.valor}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="f-telefone">Telefone do contato</FieldLabel>
          <Input
            id="f-telefone"
            inputMode="tel"
            placeholder="(11) 90000-0000"
            value={dados.telefone}
            onChange={(e) => alterar("telefone", mascaraTelefone(e.target.value))}
          />
          <FieldDescription>Fixo ou celular, o formato se ajusta sozinho.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="f-produto">Produto</FieldLabel>
          <Select value={dados.produto} onValueChange={(v) => alterar("produto", v)}>
            <SelectTrigger id="f-produto" className="cmp-gatilho-campo">
              <SelectValue placeholder="Escolha o produto" />
            </SelectTrigger>
            <SelectContent>
              {PRODUTOS.map((produto) => (
                <SelectItem key={produto} value={produto}>
                  {produto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Combobox = Command dentro de Popover. Lista com busca some do Select
            quando passa de uma dúzia de itens; aqui a busca já vem de graça. */}
        <Field data-invalid={erros.responsavel ? true : undefined}>
          <FieldLabel htmlFor="f-responsavel">Responsável</FieldLabel>
          <Popover open={comboAberto} onOpenChange={setComboAberto}>
            <PopoverTrigger asChild>
              <Button
                id="f-responsavel"
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={comboAberto}
                aria-invalid={Boolean(erros.responsavel)}
                data-vazio={dados.responsavel ? undefined : "true"}
                className="cmp-gatilho-campo"
              >
                {dados.responsavel || "Buscar pessoa do time"}
                <ChevronsUpDown />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar responsável..." />
                <CommandList>
                  <CommandEmpty>Ninguém com esse nome.</CommandEmpty>
                  <CommandGroup heading="Time comercial">
                    {RESPONSAVEIS.map((pessoa) => (
                      <CommandItem
                        key={pessoa.nome}
                        value={pessoa.nome}
                        onSelect={() => {
                          alterar("responsavel", pessoa.nome);
                          setComboAberto(false);
                        }}
                      >
                        <Avatar size="sm">
                          <AvatarFallback>{pessoa.iniciais}</AvatarFallback>
                        </Avatar>
                        {pessoa.nome}
                        {dados.responsavel === pessoa.nome ? <Check className="ml-auto" /> : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <FieldError>{erros.responsavel}</FieldError>
        </Field>

        {/* MultiSelect: a seleção fica fora do gatilho, em chip removível. Chip
            dentro do botão estoura a largura no terceiro item. */}
        <Field className="cmp-form-cheia">
          <FieldLabel htmlFor="f-canais">Canais da cadência</FieldLabel>
          <Popover open={canaisAberto} onOpenChange={setCanaisAberto}>
            <PopoverTrigger asChild>
              <Button
                id="f-canais"
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={canaisAberto}
                className="cmp-gatilho-campo"
              >
                {dados.canais.length} de {CANAIS.length} canais
                <ChevronsUpDown />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
              <Command>
                <CommandInput placeholder="Filtrar canal..." />
                <CommandList>
                  <CommandEmpty>Nenhum canal encontrado.</CommandEmpty>
                  <CommandGroup>
                    {CANAIS.map((canal) => (
                      <CommandItem key={canal} value={canal} onSelect={() => alternarCanal(canal)}>
                        <Checkbox checked={dados.canais.includes(canal)} tabIndex={-1} aria-hidden />
                        {canal}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <div className="cmp-chips">
            <AnimatePresence initial={false}>
              {dados.canais.map((canal) => (
                <motion.span
                  key={canal}
                  className="cmp-chip"
                  layout={!semMovimento}
                  initial={semMovimento ? false : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={semMovimento ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                  transition={MOLA.seca}
                >
                  {canal}
                  <button type="button" onClick={() => alternarCanal(canal)} aria-label={`Remover ${canal}`}>
                    <X />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
            {dados.canais.length === 0 ? (
              <span className="cmp-nota">Nenhum canal: a cadência não dispara.</span>
            ) : null}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="f-fechamento">Previsão de fechamento</FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="f-fechamento"
                type="button"
                variant="outline"
                data-vazio={dados.fechamento ? undefined : "true"}
                className="cmp-gatilho-campo"
              >
                {dados.fechamento ? formatarData(dados.fechamento) : "Escolher data"}
                <CalendarDays />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={ptBR}
                selected={dados.fechamento}
                onSelect={(data) => alterar("fechamento", data)}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </Field>

        <Field>
          <FieldLabel htmlFor="f-periodo">Período do relatório</FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="f-periodo"
                type="button"
                variant="outline"
                data-vazio={dados.periodo?.from ? undefined : "true"}
                className="cmp-gatilho-campo"
              >
                {dados.periodo?.from
                  ? `${formatarData(dados.periodo.from)} → ${dados.periodo.to ? formatarData(dados.periodo.to) : "..."}`
                  : "Escolher período"}
                <CalendarDays />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                locale={ptBR}
                numberOfMonths={2}
                selected={dados.periodo}
                onSelect={(faixa) => alterar("periodo", faixa)}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </Field>

        <Field>
          <FieldLabel>Etapa de destino</FieldLabel>
          <RadioGroup value={dados.etapa} onValueChange={(v) => alterar("etapa", v)}>
            {ETAPAS_QUADRO.map((etapa) => (
              <Label key={etapa} htmlFor={`f-etapa-${etapa}`}>
                <RadioGroupItem id={`f-etapa-${etapa}`} value={etapa} />
                {etapa}
              </Label>
            ))}
          </RadioGroup>
        </Field>

        <Field>
          <FieldLabel>Desconto aplicado</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={dados.desconto}
            onValueChange={(v) => {
              if (v) alterar("desconto", v);
            }}
            aria-label="Desconto aplicado"
          >
            {["0", "5", "8", "12"].map((passo) => (
              <ToggleGroupItem key={passo} value={passo}>
                {passo}%
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>
            Faixa em passos porque não existe Slider em `components/ui`. NEXO recomenda 8% para este perfil.
          </FieldDescription>
        </Field>

        <Field className="cmp-form-cheia">
          <FieldLabel htmlFor="f-observacao">Observação para a proposta</FieldLabel>
          <Textarea
            id="f-observacao"
            rows={3}
            placeholder="Objeção de prazo de implantação. Pediu cronograma por escrito."
            value={dados.observacao}
            onChange={(e) => alterar("observacao", e.target.value)}
          />
          <FieldDescription>Entra no corpo do e-mail que a proposta dispara.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="f-contrato">Número do contrato</FieldLabel>
          <Input id="f-contrato" disabled placeholder="Gerado na assinatura" />
          {/* Campo desabilitado sem motivo vira chamado de suporte. */}
          <FieldDescription>Liberado depois que a proposta for aceita pelo cliente.</FieldDescription>
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="f-avisar">Avisar o time no fechamento</FieldLabel>
          <Switch
            id="f-avisar"
            checked={dados.avisarTime}
            onCheckedChange={(v) => alterar("avisarTime", v)}
          />
        </Field>

        <div className="cmp-form-rodape">
          <Field orientation="horizontal" data-invalid={erros.aceite ? true : undefined}>
            <Checkbox
              id="f-aceite"
              checked={dados.aceite}
              onCheckedChange={(v) => alterar("aceite", v === true)}
              aria-invalid={Boolean(erros.aceite)}
            />
            <div>
              <FieldLabel htmlFor="f-aceite">Revisei valor, prazo e desconto</FieldLabel>
              <FieldError>{erros.aceite}</FieldError>
            </div>
          </Field>

          <Linha>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDados(FORMULARIO_INICIAL);
                setErros({});
              }}
            >
              Descartar
            </Button>
            <Button type="submit" loading={salvando}>
              <Send />
              Enviar proposta
            </Button>
          </Linha>
        </div>
      </form>
    </Bloco>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 3. Abas e navegação
 * ════════════════════════════════════════════════════════════════════════ */

const POR_PAGINA = 4;

function BlocoNavegacao() {
  const [pagina, setPagina] = React.useState(1);
  const totalPaginas = Math.ceil(NEGOCIOS.length / POR_PAGINA);
  const visiveis = NEGOCIOS.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const negocio = NEGOCIOS[0];

  return (
    <Bloco
      arquivo="components/ui/tabs.tsx"
      importar={'import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";'}
      titulo="Abas e navegação"
      descricao="Aba troca conteúdo no mesmo contexto; breadcrumb diz onde a pessoa está; paginação corta uma lista longa. Nenhum dos três muda o assunto da tela."
    >
      <Coluna>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">CRM</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Negócios</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{negocio.empresa}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Tabs defaultValue="resumo">
          <TabsList>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
            <TabsTrigger value="conversas">Conversas</TabsTrigger>
            <TabsTrigger value="arquivos" disabled>
              Arquivos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
            <div className="cmp-caixa">
              <div className="cmp-caixa-corpo cmp-pilha-curta">
                <div className="cmp-entre">
                  <strong>{negocio.titulo}</strong>
                  <span className="cmp-valor">{brl(negocio.valor)}</span>
                </div>
                <p className="cmp-nota">
                  {negocio.empresa} · {negocio.origem} · responsável {negocio.responsavel.nome}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="atividades">
            <div className="cmp-caixa">
              {ATIVIDADES.slice(0, 3).map((evento) => (
                <div key={evento.id} className="cmp-linha-lista">
                  <div>
                    <strong>{evento.titulo}</strong>
                    <small>
                      {evento.autor} · {evento.quando}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="conversas">
            <div className="cmp-caixa">
              {CONVERSAS.map((conversa) => (
                <div key={conversa.id} className="cmp-linha-lista">
                  <div>
                    <strong>{conversa.contato}</strong>
                    <small>{conversa.previa}</small>
                  </div>
                  {conversa.naoLidas > 0 ? <Badge>{conversa.naoLidas}</Badge> : null}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Tabs defaultValue="abertos">
          {/* `line` para quando a aba é filtro de uma lista: sem a caixa
              cinza, o peso visual fica na lista e não na navegação. */}
          <TabsList variant="line">
            <TabsTrigger value="abertos">Abertos</TabsTrigger>
            <TabsTrigger value="ganhos">Ganhos</TabsTrigger>
            <TabsTrigger value="perdidos">Perdidos</TabsTrigger>
          </TabsList>
          <TabsContent value="abertos">
            <p className="cmp-nota">{NEGOCIOS.filter((n) => n.etapa !== "Ganho" && n.etapa !== "Perdido").length} negócios em aberto.</p>
          </TabsContent>
          <TabsContent value="ganhos">
            <p className="cmp-nota">{NEGOCIOS.filter((n) => n.etapa === "Ganho").length} negócio ganho neste recorte.</p>
          </TabsContent>
          <TabsContent value="perdidos">
            <p className="cmp-nota">{NEGOCIOS.filter((n) => n.etapa === "Perdido").length} negócio perdido neste recorte.</p>
          </TabsContent>
        </Tabs>

        <div className="cmp-caixa">
          {visiveis.map((item) => (
            <div key={item.id} className="cmp-linha-lista">
              <div>
                <strong>{item.titulo}</strong>
                <small>
                  {item.empresa} · {item.etapa}
                </small>
              </div>
              <span className="cmp-valor">{compacto(item.valor)}</span>
            </div>
          ))}
        </div>

        <Pagination className="cmp-paginacao">
          <PaginationContent>
            <PaginationItem>
              <PaginationLink
                href="#"
                size="default"
                aria-label="Página anterior"
                aria-disabled={pagina === 1}
                onClick={(e) => {
                  e.preventDefault();
                  setPagina((p) => Math.max(1, p - 1));
                }}
              >
                <ChevronLeft />
                Anterior
              </PaginationLink>
            </PaginationItem>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numero) => (
              <PaginationItem key={numero}>
                <PaginationLink
                  href="#"
                  isActive={numero === pagina}
                  onClick={(e) => {
                    e.preventDefault();
                    setPagina(numero);
                  }}
                >
                  {numero}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationLink
                href="#"
                size="default"
                aria-label="Próxima página"
                aria-disabled={pagina === totalPaginas}
                onClick={(e) => {
                  e.preventDefault();
                  setPagina((p) => Math.min(totalPaginas, p + 1));
                }}
              >
                Próxima
                <ChevronRight />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </Coluna>
    </Bloco>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 4. Sobreposições
 * ════════════════════════════════════════════════════════════════════════ */

function BlocoSobreposicoes() {
  const [excluirAberto, setExcluirAberto] = React.useState(false);
  const [notificar, setNotificar] = React.useState(true);
  const [somenteMeus, setSomenteMeus] = React.useState(false);
  const negocio = NEGOCIOS[0];
  const dona = RESPONSAVEIS[0];

  return (
    <Bloco
      arquivo="components/ui/dialog.tsx"
      importar={'import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";'}
      titulo="Sobreposições"
      descricao="Toda sobreposição abre a partir de um gatilho e devolve o foco para ele ao fechar. Diálogo interrompe, folha e gaveta mantêm a tela de origem viva atrás. Aqui a demo roda sobre superfície afundada de propósito: os gatilhos são todos `outline`, ou seja, placas brancas com fio — sobre branco eles sumiriam no fundo, e o que precisa ser visto neste bloco é justamente de onde cada camada sai."
      fundo="sunken"
    >
      <Coluna>
        <Linha rotulo="Diálogo">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Pencil />
                Editar negócio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar {negocio.titulo}</DialogTitle>
                <DialogDescription>
                  Alteração entra no histórico do negócio e avisa {negocio.responsavel.nome}.
                </DialogDescription>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="d-valor">Valor</FieldLabel>
                <Input id="d-valor" defaultValue={brl(negocio.valor)} />
              </Field>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancelar</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={() => toast.success("Negócio atualizado")}>Salvar</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Confirmação destrutiva. `AlertDialog` do shadcn não está instalado
              neste repo, então o padrão é Dialog em modo alertdialog: sem X, sem
              fechar clicando fora, e o verbo da ação no botão. */}
          <Dialog open={excluirAberto} onOpenChange={setExcluirAberto}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 />
                Excluir negócio
              </Button>
            </DialogTrigger>
            <DialogContent
              role="alertdialog"
              showCloseButton={false}
              onInteractOutside={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Excluir {negocio.titulo}?</DialogTitle>
                <DialogDescription>
                  As {ATIVIDADES.length} atividades e a proposta de {brl(negocio.valor)} vão junto. Não dá para desfazer.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setExcluirAberto(false)}>
                  Manter negócio
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setExcluirAberto(false);
                    toast.error("Negócio excluído", {
                      description: `${negocio.empresa} saiu do funil.`,
                    });
                  }}
                >
                  Excluir mesmo assim
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Linha>

        <Linha rotulo="Painéis">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">
                <FileText />
                Abrir detalhe
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{negocio.empresa}</SheetTitle>
                <SheetDescription>{negocio.titulo}</SheetDescription>
              </SheetHeader>
              <div className="cmp-folha-corpo">
                <div className="cmp-folha-linha">
                  <span>Valor</span>
                  <strong>{brl(negocio.valor)}</strong>
                </div>
                <div className="cmp-folha-linha">
                  <span>Etapa</span>
                  <strong>{negocio.etapa}</strong>
                </div>
                <div className="cmp-folha-linha">
                  <span>Origem</span>
                  <strong>{negocio.origem}</strong>
                </div>
                <div className="cmp-folha-linha">
                  <span>Próxima ação</span>
                  <strong>{negocio.proximaAcao}</strong>
                </div>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Fechar</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">
                <Filter />
                Filtros
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Filtrar funil</DrawerTitle>
                <DrawerDescription>Vale para a lista e para o quadro.</DrawerDescription>
              </DrawerHeader>
              <div className="cmp-folha-corpo">
                <Label htmlFor="g-meus">
                  <Checkbox
                    id="g-meus"
                    checked={somenteMeus}
                    onCheckedChange={(v) => setSomenteMeus(v === true)}
                  />
                  Somente meus negócios
                </Label>
                <Label htmlFor="g-notificar">
                  <Switch id="g-notificar" checked={notificar} onCheckedChange={setNotificar} />
                  Avisar quando algo entrar no filtro
                </Label>
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button onClick={() => toast.success("Filtro aplicado")}>Aplicar</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </Linha>

        <Linha rotulo="Ancorados">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Settings2 />
                Ações do negócio
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{negocio.empresa}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => toast("Ligação iniciada")}>
                <Phone />
                Ligar agora
                <DropdownMenuShortcut>L</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem checked={notificar} onCheckedChange={setNotificar}>
                Seguir este negócio
              </DropdownMenuCheckboxItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <MoveRight />
                  Mover para
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {ETAPAS_QUADRO.map((etapa) => (
                    <DropdownMenuItem key={etapa} onSelect={() => toast.success(`Movido para ${etapa}`)}>
                      {etapa}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setExcluirAberto(true)}>
                <Trash2 />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarDays />
                Agendar retorno
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="cmp-pilha-curta">
              <strong>Retorno para {negocio.empresa}</strong>
              <p className="cmp-nota">Cria tarefa para {negocio.responsavel.nome} e some do filtro &ldquo;sem tarefa&rdquo;.</p>
              <Linha>
                <Button size="sm" onClick={() => toast.success("Retorno agendado para amanhã, 09:00")}>
                  Amanhã, 09:00
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast.success("Retorno agendado para segunda")}>
                  Segunda
                </Button>
              </Linha>
            </PopoverContent>
          </Popover>

          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="subtle">
                <Users />
                {dona.nome}
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="cmp-pilha-curta">
              <div className="cmp-entre">
                <strong>{dona.nome}</strong>
                <Badge variant="secondary">Closer</Badge>
              </div>
              <p className="cmp-nota">
                {compacto(dona.realizado)} de {compacto(dona.meta)} na meta do trimestre.
              </p>
              <Progress value={Math.round((dona.realizado / dona.meta) * 100)} aria-label="Atingimento da meta" />
            </HoverCardContent>
          </HoverCard>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Notificações do negócio">
                  <Bell />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notificações do negócio</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Linha>

        <p className="cmp-nota">
          <strong>Ainda não instalados:</strong> `AlertDialog` e `ContextMenu`. Até entrarem em
          `components/ui`, confirmação destrutiva usa Dialog em modo alertdialog e menu de botão
          direito não existe no produto — não invente um só nesta tela.
        </p>
      </Coluna>
    </Bloco>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 5. Command palette
 * ════════════════════════════════════════════════════════════════════════ */

function BlocoComando() {
  const tecla = useTeclaComando();

  return (
    <Bloco
      arquivo="components/ui/command.tsx"
      importar={'import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";'}
      titulo="Command palette"
      descricao="O palette do produto é um só e já está montado pela casca. A tela não monta outro: dispara o evento e deixa o dono responder. A lista inline abaixo é uma placa branca sobre superfície afundada, que é como ela aparece de verdade dentro de um painel."
      fundo="sunken"
    >
      <Coluna>
        <Linha>
          <Button
            variant="outline"
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          >
            <IconeComando />
            Abrir o palette do produto
          </Button>
          <span className="cmp-nota">
            Ou <Tecla>{tecla}</Tecla> <Tecla>K</Tecla> de qualquer lugar da casca.
          </span>
        </Linha>

        {/* Command inline: mesmo primitivo, sem diálogo. Serve para busca dentro
            de um painel, onde abrir uma sobreposição por cima seria demais. */}
        <div className="cmp-caixa">
          <Command>
            <CommandInput placeholder="Buscar negócio, pessoa ou ação..." />
            <CommandList>
              <CommandEmpty>Nada encontrado no funil.</CommandEmpty>
              <CommandGroup heading="Negócios">
                {NEGOCIOS.slice(0, 3).map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.empresa} ${item.titulo}`}
                    onSelect={() => toast(`Abrindo ${item.empresa}`)}
                  >
                    <Building2 />
                    {item.empresa}
                    <CommandShortcut>{compacto(item.valor)}</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Ações">
                <CommandItem value="novo negócio" onSelect={() => toast.success("Negócio criado")}>
                  <Plus />
                  Novo negócio
                  <CommandShortcut>N</CommandShortcut>
                </CommandItem>
                <CommandItem value="convidar pessoa" onSelect={() => toast.success("Convite enviado")}>
                  <UserPlus />
                  Convidar pessoa para o time
                </CommandItem>
                <CommandItem value="exportar funil" onSelect={() => toast("Exportação na fila")}>
                  <Download />
                  Exportar funil
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </Coluna>
    </Bloco>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 6. Feedback
 * ════════════════════════════════════════════════════════════════════════ */

function BlocoFeedback() {
  const [progresso, setProgresso] = React.useState(0);
  const [importando, setImportando] = React.useState(false);

  /** Progresso determinado só existe quando há total conhecido. Aqui é uma
   * importação de 320 leads: 100% significa alguma coisa.
   * O contador vive fora do estado para o intervalo não depender de leitura
   * antiga, e o fim é decidido dentro do próprio tique. */
  React.useEffect(() => {
    if (!importando) return;
    let valor = 0;
    const id = window.setInterval(() => {
      valor = Math.min(100, valor + 7);
      setProgresso(valor);
      if (valor >= 100) {
        window.clearInterval(id);
        setImportando(false);
        toast.success("320 leads importados");
      }
    }, 180);
    return () => window.clearInterval(id);
  }, [importando]);

  function toastComDesfazer() {
    toast.success("Negócio movido para Fechamento", {
      description: "TechCorp Telecom · Implantação PABX",
      action: {
        label: "Desfazer",
        onClick: () => toast("Movimento desfeito", { icon: <Undo2 /> }),
      },
    });
  }

  function toastPromessa() {
    toast.promise(
      new Promise<string>((resolver) => window.setTimeout(() => resolver("ok"), 1800)),
      {
        loading: "Sincronizando conversas do WhatsApp...",
        success: "3 conversas sincronizadas",
        error: "Falha na sincronização",
      },
    );
  }

  return (
    <Bloco
      arquivo="components/ui/alert.tsx"
      importar={'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";'}
      titulo="Feedback"
      descricao="Toast para o que já aconteceu, alerta para o que continua verdadeiro na tela, progresso para espera com fim e esqueleto para espera com forma conhecida."
    >
      <Coluna>
        <Linha rotulo="Toast">
          <Button variant="outline" onClick={() => toast.success("Proposta enviada")}>
            Sucesso
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.error("Não foi possível ligar", {
                description: "Ramal 204 ocupado. Tente o celular do contato.",
              })
            }
          >
            Erro
          </Button>
          <Button variant="outline" onClick={toastPromessa}>
            Carregando → resolvido
          </Button>
          <Button variant="outline" onClick={toastComDesfazer}>
            Com desfazer
          </Button>
        </Linha>

        <div className="cmp-grade">
          <Alert className="cmp-alerta" data-tom="info">
            <Info />
            <AlertTitle>Importação diária às 03:00</AlertTitle>
            <AlertDescription>Leads do Meta Ads entram antes do primeiro turno.</AlertDescription>
          </Alert>
          <Alert className="cmp-alerta" data-tom="sucesso">
            <CircleCheck />
            <AlertTitle>Contrato assinado</AlertTitle>
            <AlertDescription>Rede Farma Bem renovou 40 licenças.</AlertDescription>
          </Alert>
          <Alert className="cmp-alerta" data-tom="atencao">
            <Sparkles />
            <AlertTitle>NEXO sugere reduzir o desconto para 8%</AlertTitle>
            <AlertDescription>Negócios semelhantes fecharam com 8% nos últimos 90 dias.</AlertDescription>
          </Alert>
          <Alert variant="destructive" className="cmp-alerta" data-tom="erro">
            <TriangleAlert />
            <AlertTitle>6 negócios parados há mais de 9 dias</AlertTitle>
            <AlertDescription>Todos na etapa Proposta, somando R$ 187.400.</AlertDescription>
          </Alert>
        </div>

        <div className="cmp-grade">
          <div className="cmp-pilha-curta">
            <div className="cmp-entre">
              <span className="cmp-nota">Determinado · importação de 320 leads</span>
              <span className="cmp-valor">{progresso}%</span>
            </div>
            <Progress value={progresso} aria-label="Progresso da importação" />
            <Linha>
              <Button
                size="sm"
                variant="outline"
                disabled={importando}
                onClick={() => {
                  setProgresso(0);
                  setImportando(true);
                }}
              >
                Importar
              </Button>
            </Linha>
          </div>

          <div className="cmp-pilha-curta">
            <span className="cmp-nota">Indeterminado · sem total conhecido</span>
            <Progress
              value={100}
              className="cmp-progresso-indeterminado"
              aria-label="Sincronizando, sem previsão de término"
            />
            <p className="cmp-nota">Use só quando o fim é desconhecido. Barra falsa chegando a 90% e parando queima confiança.</p>
          </div>
        </div>

        <div className="cmp-grade">
          <div className="cmp-caixa">
            <div className="cmp-caixa-topo">Texto</div>
            <div className="cmp-caixa-corpo cmp-pilha-curta">
              <Skeleton className="cmp-esqueleto" data-forma="titulo" />
              <Skeleton className="cmp-esqueleto" data-forma="texto" />
              <Skeleton className="cmp-esqueleto" data-forma="texto-curto" />
            </div>
          </div>
          <div className="cmp-caixa">
            <div className="cmp-caixa-topo">Métrica</div>
            <div className="cmp-caixa-corpo cmp-pilha-curta">
              <Skeleton className="cmp-esqueleto" data-forma="texto-curto" />
              <Skeleton className="cmp-esqueleto" data-forma="kpi" />
            </div>
          </div>
          <div className="cmp-caixa">
            <div className="cmp-caixa-topo">Pessoa</div>
            <div className="cmp-caixa-corpo">
              <div className="cmp-esqueleto-identidade">
                <Skeleton className="cmp-esqueleto" data-forma="avatar" />
                <div>
                  <Skeleton className="cmp-esqueleto" data-forma="texto" />
                  <Skeleton className="cmp-esqueleto" data-forma="texto-curto" />
                </div>
              </div>
            </div>
          </div>
          <div className="cmp-caixa">
            <div className="cmp-caixa-topo">Gráfico</div>
            <div className="cmp-caixa-corpo">
              <Skeleton className="cmp-esqueleto" data-forma="bloco" />
            </div>
          </div>
        </div>
      </Coluna>
    </Bloco>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 7. Sinalização
 * ════════════════════════════════════════════════════════════════════════ */

function BlocoSinalizacao() {
  return (
    <Bloco
      arquivo="components/ui/badge.tsx"
      importar={'import { Badge } from "@/components/ui/badge";'}
      titulo="Sinalização"
      descricao="Etiqueta, avatar, separador e tecla. Coisas pequenas que carregam estado sem pedir clique — e que, mal usadas, viram ruído colorido no meio da lista."
    >
      <Coluna>
        <Linha rotulo="Badge">
          <Badge>Ganho</Badge>
          <Badge variant="secondary">Proposta</Badge>
          <Badge variant="outline">Qualificação</Badge>
          <Badge variant="destructive">Atrasado</Badge>
          <Badge variant="ghost">Sem tarefa</Badge>
          <Badge variant="link">Ver no CRM</Badge>
          <Badge variant="secondary">
            <Sparkles />
            NEXO
          </Badge>
        </Linha>

        <Linha rotulo="Avatar">
          <Avatar size="sm">
            <AvatarFallback>MR</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>LP</AvatarFallback>
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>AS</AvatarFallback>
            <AvatarBadge />
          </Avatar>
          <AvatarGroup>
            {RESPONSAVEIS.map((pessoa) => (
              <Avatar key={pessoa.nome}>
                <AvatarFallback>{pessoa.iniciais}</AvatarFallback>
              </Avatar>
            ))}
            <AvatarGroupCount>+4</AvatarGroupCount>
          </AvatarGroup>
        </Linha>

        <Linha rotulo="Apoio">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="E-mail do contato">
                  <Mail />
                </Button>
              </TooltipTrigger>
              <TooltipContent>ricardo@techcorp.com.br</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="cmp-separador-vertical" />
          <span className="cmp-nota">
            Buscar <Tecla>{"/"}</Tecla> · Novo negócio <Tecla>N</Tecla> · Fechar <Tecla>Esc</Tecla>
          </span>
        </Linha>

        <Separator />

        <p className="cmp-nota">
          <strong>Coral não decora.</strong> Etiqueta padrão (coral) é para o estado que exige ação.
          Estado neutro usa `secondary` ou `outline`, senão a lista inteira acende e nada se destaca.
        </p>
      </Coluna>
    </Bloco>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * 8. Estados vazios
 * ════════════════════════════════════════════════════════════════════════ */

function BlocoVazios() {
  return (
    <Bloco
      arquivo="components/onface/ds/lab.tsx"
      importar={'import { Vazio } from "@/components/onface/ds/lab";'}
      titulo="Estados vazios"
      descricao="Três níveis, três pesos, e a diferença entre eles é o ponto. Dentro de um cartão o vazio é uma nota; no recorte de uma seção é um aviso com saída; na primeira vez que a pessoa abre o produto é uma composição inteira, porque ali não falta um dado, falta o produto começar a existir. Todo vazio diz o que aconteceu e oferece a saída — vazio sem botão é beco sem saída."
      fundo="sunken"
    >
      <div className="cmp-pilha">
        <div className="cmp-caixa" data-borda="tracejada">
          <div className="cmp-caixa-topo">Nível componente · dentro de um cartão</div>
          <Vazio
            icone={<MessageSquare />}
            titulo="Sem conversas"
            texto="Nenhuma mensagem trocada com TechCorp Telecom nos últimos 30 dias."
            acoes={
              <Button size="sm" variant="outline" onClick={() => toast("Abrindo WhatsApp")}>
                <MessageSquare />
                Iniciar conversa
              </Button>
            }
          />
        </div>

        <div className="cmp-caixa">
          <div className="cmp-caixa-topo">Nível seção · a seção existe, o recorte está vazio</div>
          <Vazio
            icone={<Filter />}
            titulo="Nenhum negócio neste filtro"
            texto="Origem Parceiro e etapa Fechamento não se cruzam neste período."
            acoes={
              <>
                <Button size="sm" variant="outline" onClick={() => toast("Filtro limpo")}>
                  Limpar filtro
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toast("Período ampliado para 90 dias")}>
                  Ampliar período
                </Button>
              </>
            }
          />
        </div>

        {/* Nível página. O único vazio da seção com elemento gráfico, e ele
            não está aqui por decoração: `conexoes` é literalmente o que falta
            na tela — a ligação entre lead, negócio e tarefa que ainda não
            existe. Se todo vazio tivesse fundo, nenhum teria. */}
        <div className="cmp-caixa">
          <div className="cmp-caixa-topo">Nível página · primeira vez, nada existe ainda</div>
          <div className="cmp-caixa-corpo" data-sem-ar="true">
            <div className="cmp-primeiro-uso">
              <FundoGrafico variante="conexoes" superficie="clara" />

              <span className="cmp-primeiro-uso-selo">
                <Sparkles aria-hidden />
                Primeiro uso
              </span>

              <h4>Seu funil ainda não existe</h4>
              <p className="cmp-primeiro-uso-apoio">
                Nenhum negócio, nenhuma conversa e nenhuma tarefa ligados até agora. Traga a base que
                já roda hoje ou crie um negócio à mão: o quadro, o funil e a fila do dia nascem todos
                desse primeiro registro.
              </p>

              {/* Uma ação coral só. O restante é caminho alternativo, e caminho
                  alternativo não disputa atenção com o caminho principal. */}
              <Linha>
                <Button onClick={() => toast.success("Negócio criado")}>
                  <Plus />
                  Criar o primeiro negócio
                </Button>
                <Button variant="outline" onClick={() => toast("Importação iniciada")}>
                  <Download />
                  Importar base atual
                </Button>
                <Button variant="link" onClick={() => toast("Abrindo o guia")}>
                  Como funciona o funil
                  <ArrowRight />
                </Button>
              </Linha>

              <div className="cmp-passos">
                <span className="cmp-passo">
                  <b>01</b>
                  <strong>Entra o negócio</strong>
                  <span>Importado da planilha, do Meta Ads ou criado aqui.</span>
                </span>
                <span className="cmp-passo">
                  <b>02</b>
                  <strong>Cola a conversa</strong>
                  <span>WhatsApp, e-mail e ligação passam a ficar no mesmo lugar.</span>
                </span>
                <span className="cmp-passo">
                  <b>03</b>
                  <strong>Nasce a fila</strong>
                  <span>Cada negócio ganha próxima tarefa e some do &ldquo;parado&rdquo;.</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Bloco>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Seção
 * ════════════════════════════════════════════════════════════════════════ */

export function SecaoComponentes() {
  return (
    <Secao
      titulo="Primitivas"
      chamada="Os componentes de components/ui rodando dentro da casca ONFACE, com estado real. Nada aqui é uma cópia: é o mesmo Button, o mesmo Select e o mesmo Command que o produto usa, então o que quebrar aqui já quebrou lá."
    >
      {/* O índice da seção não é escrito aqui: `Secao` monta o sumário lendo os
          blocos do DOM (lab.tsx), inclusive os que estão dentro de <Familia>.
          Um segundo índice à mão seria navegação duplicada e a primeira a sair
          de sincronia. O que esta seção acrescenta é o capítulo. */}

      {/* Quatro famílias, na ordem em que a pessoa encontra cada coisa numa
          tela: o que ela aciona, o que a orienta, o que se abre por cima e o
          que o sistema devolve. Bloco solto em ordem de instalação é lista de
          inventário, não documentação. */}
      <Familia indice="01" nome="O que a pessoa aciona">
        <BlocoBotoes />
        <BlocoEstados />
        <BlocoFormulario />
      </Familia>

      <Familia indice="02" nome="O que a orienta">
        <BlocoNavegacao />
        <BlocoComando />
      </Familia>

      <Familia indice="03" nome="O que abre por cima">
        <BlocoSobreposicoes />
      </Familia>

      <Familia indice="04" nome="O que o sistema devolve">
        <BlocoFeedback />
        <BlocoSinalizacao />
        <BlocoVazios />
      </Familia>

      <Regras
        faca={{
          titulo: "Existe no shadcn, usa",
          texto:
            "Antes de escrever um componente, procure entre os que já estão em components/ui. Precisa de comportamento novo? Componha os primitivos (Command dentro de Popover vira combobox; Dialog com role alertdialog vira confirmação) ou passe className com token.",
        }}
        naoFaca={{
          titulo: "Fork de primitiva na pasta da tela",
          texto:
            "Nada de MeuBotao.tsx, nada de copiar o JSX do Select para ajustar um detalhe. Quando nenhuma das primitivas resolve de verdade, o componente novo nasce em components/ui, com variantes e estados, e só depois é usado na tela.",
        }}
      />
    </Secao>
  );
}
