"use client";

/** Família de domínio do ONFACE.
 *
 * É aqui que o sistema deixa de ser "dashboard genérico com a logo trocada".
 * Um Lead, um Contrato e um Ticket são a MESMA tela: muda o ícone e mudam os
 * campos, nunca o layout. Cada gaveta nova que alguém desenhasse do zero seria
 * mais um dialeto para manter, então existe uma só, com variantes.
 *
 * Ordem do arquivo: tipos e mapas → CabecalhoEntidade → LinhaDoTempo →
 * Anel → Metrica → GavetaDetalhe. */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Dialog as GavetaPrimitive } from "radix-ui";
import {
  ArrowUpRight, Bot, Briefcase, Building2, CalendarClock, CalendarDays, CalendarPlus, CalendarRange,
  ChevronDown,
  ChevronsRight, CircleDollarSign, Clock, FileSignature, FileText,
  Flag, HeartHandshake, Inbox, LifeBuoy, ListTodo, Mail, Megaphone, MessageCircle,
  Minus, Package, Phone, Sparkles, StickyNote, Target, TrendingDown, TrendingUp,
  User, UserPlus, Users, X, type LucideIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DURACAO, MOLA } from "./motion";
import type { EventoTempo } from "./dados";
import "./crm.css";

/* ═══ Tipos e mapas ═══════════════════════════════════════════════════════ */

/** Toda entidade de CRM que abre em tela de detalhe. A lista é fechada de
 *  propósito: entidade nova entra aqui, não vira componente novo. */
export type TipoEntidade =
  | "lead" | "contato" | "empresa" | "oportunidade"
  | "cliente" | "contrato" | "ticket" | "tarefa";

export type CampoEntidade =
  | "dono" | "origem" | "criadoEm" | "valor" | "plano" | "mrr" | "desde"
  | "cargo" | "empresa" | "telefone" | "vigencia" | "sla" | "prioridade"
  | "canal" | "vencimento";

export type TomEstado = "ok" | "risco" | "acento" | "neutro";
export type TomAnel = "acento" | "ok" | "risco" | "neutro";
export type Densidade = "padrao" | "compacta";

export type AbaEntidade = { valor: string; rotulo: string; contagem?: number };

const PERFIL: Record<TipoEntidade, { rotulo: string; icone: LucideIcon; campos: CampoEntidade[] }> = {
  lead: { rotulo: "Lead", icone: UserPlus, campos: ["dono", "origem", "telefone", "criadoEm"] },
  contato: { rotulo: "Contato", icone: User, campos: ["cargo", "empresa", "telefone", "dono"] },
  empresa: { rotulo: "Empresa", icone: Building2, campos: ["dono", "origem", "plano", "desde"] },
  oportunidade: { rotulo: "Oportunidade", icone: Target, campos: ["valor", "dono", "origem", "criadoEm"] },
  cliente: { rotulo: "Cliente", icone: HeartHandshake, campos: ["plano", "mrr", "desde", "dono"] },
  contrato: { rotulo: "Contrato", icone: FileSignature, campos: ["valor", "vigencia", "dono", "desde"] },
  ticket: { rotulo: "Ticket", icone: LifeBuoy, campos: ["prioridade", "sla", "canal", "dono"] },
  tarefa: { rotulo: "Tarefa", icone: ListTodo, campos: ["vencimento", "dono", "empresa", "canal"] },
};

const CAMPO: Record<CampoEntidade, { rotulo: string; icone: LucideIcon }> = {
  dono: { rotulo: "Responsável", icone: User },
  origem: { rotulo: "Origem", icone: Megaphone },
  criadoEm: { rotulo: "Criado em", icone: CalendarPlus },
  valor: { rotulo: "Valor", icone: CircleDollarSign },
  plano: { rotulo: "Plano", icone: Package },
  mrr: { rotulo: "MRR", icone: CircleDollarSign },
  desde: { rotulo: "Cliente desde", icone: CalendarDays },
  cargo: { rotulo: "Cargo", icone: Briefcase },
  empresa: { rotulo: "Empresa", icone: Building2 },
  telefone: { rotulo: "Telefone", icone: Phone },
  vigencia: { rotulo: "Vigência", icone: CalendarRange },
  sla: { rotulo: "SLA", icone: Clock },
  prioridade: { rotulo: "Prioridade", icone: Flag },
  canal: { rotulo: "Canal", icone: MessageCircle },
  vencimento: { rotulo: "Vence", icone: CalendarClock },
};

const MARCA_TEMPO: Record<EventoTempo["tipo"], { icone: LucideIcon; rotulo: string }> = {
  ligacao: { icone: Phone, rotulo: "Ligação" },
  whatsapp: { icone: MessageCircle, rotulo: "WhatsApp" },
  email: { icone: Mail, rotulo: "E-mail" },
  reuniao: { icone: Users, rotulo: "Reunião" },
  nota: { icone: StickyNote, rotulo: "Nota" },
  etapa: { icone: ChevronsRight, rotulo: "Etapa" },
  proposta: { icone: FileText, rotulo: "Proposta" },
  contrato: { icone: FileSignature, rotulo: "Contrato" },
  pagamento: { icone: CircleDollarSign, rotulo: "Pagamento" },
  automacao: { icone: Bot, rotulo: "Automação" },
  nexo: { icone: Sparkles, rotulo: "NEXO" },
};

/* ═══ CabecalhoEntidade ═══════════════════════════════════════════════════ */

export type CabecalhoEntidadeProps = {
  tipo: TipoEntidade;
  nome: string;
  /** Sem iniciais o avatar cai no ícone do tipo (ticket e contrato não têm). */
  iniciais?: string;
  estado?: { rotulo: string; tom: TomEstado };
  /** Preenche só o que existe: a ordem e o rótulo vêm do perfil do tipo. */
  campos?: Partial<Record<CampoEntidade, React.ReactNode>>;
  acaoPrimaria?: React.ReactNode;
  acaoSecundaria?: React.ReactNode;
  /** Exige um `<Tabs>` por volta: o conteúdo das abas vive fora do cabeçalho. */
  abas?: AbaEntidade[];
  compacto?: boolean;
};

export function CabecalhoEntidade({
  tipo, nome, iniciais, estado, campos, acaoPrimaria, acaoSecundaria, abas, compacto,
}: CabecalhoEntidadeProps) {
  const perfil = PERFIL[tipo];
  const IconeTipo = perfil.icone;
  const visiveis = perfil.campos.filter((c) => campos?.[c] !== undefined && campos[c] !== null);

  return (
    <div className="of-cabecalho" data-compacto={compacto ? "true" : undefined}>
      <div className="ds-entidade">
        <div className="ds-entidade-identidade">
          <span className="ds-entidade-avatar" aria-hidden>
            {iniciais ?? <IconeTipo />}
          </span>
          <div className="of-entidade-texto">
            <span className="of-entidade-eyebrow">
              <IconeTipo aria-hidden />
              {perfil.rotulo}
            </span>
            <h3 className="ds-entidade-nome">
              {nome}
              {estado ? <span className="of-status" data-tom={estado.tom}>{estado.rotulo}</span> : null}
            </h3>
            {visiveis.length > 0 ? (
              <div className="ds-entidade-meta">
                {visiveis.map((chave) => {
                  const IconeCampo = CAMPO[chave].icone;
                  return (
                    <span key={chave} className="of-entidade-campo">
                      <IconeCampo aria-hidden />
                      {CAMPO[chave].rotulo}: <strong>{campos?.[chave]}</strong>
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {acaoPrimaria || acaoSecundaria ? (
          <div className="of-entidade-acoes">
            {acaoSecundaria}
            {acaoPrimaria}
          </div>
        ) : null}
      </div>

      {abas ? (
        <TabsList variant="line" className="of-entidade-abas">
          {abas.map((aba) => (
            <TabsTrigger key={aba.valor} value={aba.valor}>
              {aba.rotulo}
              {aba.contagem !== undefined ? <span className="of-aba-contagem">{aba.contagem}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      ) : null}
    </div>
  );
}

/* ═══ LinhaDoTempo ════════════════════════════════════════════════════════ */

/** Eventos que mudam o estado do negócio, não só o registram. Proposta,
 *  contrato e pagamento entram por tipo; o resto entra quando o dado já
 *  carrega tom (risco, ganho, NEXO). Sem essa separação o histórico vira uma
 *  lista cinza uniforme onde a assinatura do contrato tem o mesmo peso de um
 *  e-mail aberto. */
const CONSEQUENTES: EventoTempo["tipo"][] = ["proposta", "contrato", "pagamento"];
const temConsequencia = (e: EventoTempo) => e.tom !== undefined || CONSEQUENTES.includes(e.tipo);

export function AtividadeItem({
  evento,
  densidade = "padrao",
  animado = false,
}: {
  evento: EventoTempo;
  densidade?: Densidade;
  /** O item vira o próprio elemento animado.
   *
   * Envolver o item num `motion.div` quebrava tudo que depende de irmão:
   * `:last-child` passava a valer para TODOS (cada item virava filho único do
   * wrapper), então o respiro entre eventos sumia e o trilho de continuidade,
   * que é `:not(:last-child)::after`, nunca era desenhado. */
  animado?: boolean;
}) {
  const marca = MARCA_TEMPO[evento.tipo];
  const Icone = marca.icone;
  const reduzido = useReducedMotion();
  const Item = animado ? motion.div : "div";
  const movimento = animado
    ? {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0 },
        transition: { duration: reduzido ? 0 : DURACAO.rapido },
      }
    : {};

  return (
    <Item className="ds-tempo-item" data-marcante={temConsequencia(evento) ? "true" : undefined} {...movimento}>
      <div className="ds-tempo-trilho">
        {/* O ícone identifica o canal; a cor só aparece quando o evento tem
            consequência (risco, ganho, NEXO). Cor em tudo não classifica nada. */}
        <span className="ds-tempo-marca" data-tom={evento.tom} title={marca.rotulo}>
          <Icone aria-hidden />
          <span className="sr-only">{marca.rotulo}</span>
        </span>
      </div>
      <div className="ds-tempo-corpo">
        <strong>{evento.titulo}</strong>
        {evento.detalhe ? <p>{evento.detalhe}</p> : null}
        <div className="ds-tempo-meta">
          <span className="of-tempo-autor">{evento.autor}</span>
          <i className="of-tempo-ponto" aria-hidden />
          <time>{evento.quando}</time>
          {densidade === "compacta" && evento.detalhe ? (
            <>
              <i className="of-tempo-ponto" aria-hidden />
              <span>{marca.rotulo}</span>
            </>
          ) : null}
        </div>
      </div>
    </Item>
  );
}

export function LinhaDoTempo({
  eventos,
  densidade = "padrao",
  comFiltro = true,
}: {
  eventos: EventoTempo[];
  densidade?: Densidade;
  comFiltro?: boolean;
}) {
  // Filtro guardado como "tipos ligados". Conjunto vazio = tudo, que é o
  // estado honesto: ninguém abre um histórico querendo ver nada.
  const [ligados, setLigados] = React.useState<EventoTempo["tipo"][]>([]);

  const tiposPresentes = React.useMemo(() => {
    const vistos: EventoTempo["tipo"][] = [];
    for (const e of eventos) if (!vistos.includes(e.tipo)) vistos.push(e.tipo);
    return vistos;
  }, [eventos]);

  const visiveis = ligados.length === 0 ? eventos : eventos.filter((e) => ligados.includes(e.tipo));

  function alternar(tipo: EventoTempo["tipo"]) {
    setLigados((atual) => (atual.includes(tipo) ? atual.filter((t) => t !== tipo) : [...atual, tipo]));
  }

  return (
    <div>
      {comFiltro ? (
        <div className="of-tempo-filtros" role="group" aria-label="Filtrar atividades por tipo">
          {tiposPresentes.map((tipo) => {
            const Icone = MARCA_TEMPO[tipo].icone;
            const ativo = ligados.includes(tipo);
            return (
              <button
                key={tipo}
                type="button"
                className="ds-chip-filtro"
                data-ativo={ativo ? "true" : undefined}
                aria-pressed={ativo}
                onClick={() => alternar(tipo)}
              >
                <Icone aria-hidden />
                {MARCA_TEMPO[tipo].rotulo}
              </button>
            );
          })}
          {ligados.length > 0 ? (
            <button type="button" className="ds-chip-filtro" onClick={() => setLigados([])}>
              <X aria-hidden />
              Limpar
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="ds-tempo" data-densidade={densidade === "compacta" ? "compacta" : undefined}>
        <AnimatePresence initial={false}>
          {visiveis.map((evento) => (
            <AtividadeItem key={evento.id} evento={evento} densidade={densidade} animado />
          ))}
        </AnimatePresence>
      </div>

      {visiveis.length === 0 ? (
        <div className="ds-vazio">
          <span className="ds-vazio-figura"><Inbox aria-hidden /></span>
          <strong>Nenhuma atividade desse tipo</strong>
          <p>O filtro atual não encontrou registros. Limpe os chips para ver o histórico completo.</p>
        </div>
      ) : null}
    </div>
  );
}

/* ═══ Campos interativos do cabeçalho ═════════════════════════════════════

   O cabeçalho publica o campo; quem monta a tela decide se ele é leitura,
   destino ou edição. Sem isso, ou tudo vira texto morto (o que o Scott achou:
   empresa que não clica, responsável que não troca), ou cada tela inventa o seu
   próprio jeito de deixar um campo editável. Estes dois nós resolvem os dois
   casos que o CRM realmente tem. */

/** Campo que leva para outro registro: empresa, contato, contrato, negócio. */
export function CampoLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="of-campo-link" href={href}>
      {children}
      <ArrowUpRight aria-hidden />
    </a>
  );
}

/** Campo que se edita no lugar, sem abrir tela: responsável, etapa, prioridade.
 *
 * `select` nativo de propósito: é um campo de uma escolha só, dentro de uma
 * linha de texto. Combobox aqui seria um popover inteiro para trocar um nome,
 * e no telefone o nativo abre a roda do sistema, que é melhor do que qualquer
 * lista que a gente desenhe. */
export function CampoEditavel({
  valor,
  opcoes,
  aoMudar,
  rotulo,
}: {
  valor: string;
  opcoes: string[];
  aoMudar: (novo: string) => void;
  /** Nome acessível: o rótulo visível fica fora do controle, no texto. */
  rotulo: string;
}) {
  return (
    <span className="of-campo-editavel">
      <span aria-hidden>{valor}</span>
      <ChevronDown aria-hidden />
      <select
        aria-label={rotulo}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
      >
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>{opcao}</option>
        ))}
      </select>
    </span>
  );
}

/* ═══ Anel ════════════════════════════════════════════════════════════════ */

// Geometria em unidades do viewBox (não são px: o tamanho real sai do CSS).
const RAIO = 44;
const PERIMETRO = 2 * Math.PI * RAIO;
const ESPESSURA: Record<"sm" | "md" | "lg", number> = { sm: 12, md: 9, lg: 8 };

export function Anel({
  valor,
  tamanho = "md",
  tom = "acento",
  rotulo,
  formato,
  descricao,
}: {
  /** 0 a 100. Meta, saúde, SLA, adoção: tudo que é percentual de um todo. */
  valor: number;
  tamanho?: "sm" | "md" | "lg";
  tom?: TomAnel;
  rotulo?: string;
  /** Texto do centro quando o número exibido não é o percentual cru. */
  formato?: string;
  /** Nome acessível quando o rótulo visível não basta (ex.: dentro de KPI). */
  descricao?: string;
}) {
  const reduzido = useReducedMotion();
  const limitado = Math.min(100, Math.max(0, valor));
  const alvo = PERIMETRO * (1 - limitado / 100);

  return (
    <div
      className="ds-anel of-anel"
      data-tamanho={tamanho}
      data-tom={tom}
      role="progressbar"
      aria-valuenow={Math.round(limitado)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={descricao ?? rotulo}
    >
      <svg viewBox="0 0 100 100" aria-hidden focusable="false">
        <circle
          cx="50" cy="50" r={RAIO} fill="none"
          stroke="var(--of-anel-trilho)" strokeWidth={ESPESSURA[tamanho]}
        />
        {/* dasharray fixo no perímetro + dashoffset animado: o traço "cresce"
            de uma ponta só, em vez de aparecer inteiro e depois encolher. */}
        <motion.circle
          cx="50" cy="50" r={RAIO} fill="none"
          stroke="var(--of-anel-cor)" strokeWidth={ESPESSURA[tamanho]} strokeLinecap="round"
          strokeDasharray={PERIMETRO}
          initial={{ strokeDashoffset: PERIMETRO }}
          animate={{ strokeDashoffset: alvo }}
          transition={reduzido ? { duration: 0 } : MOLA.suave}
        />
      </svg>
      <span className="ds-anel-centro">
        <span className="ds-anel-valor">{formato ?? `${Math.round(limitado)}%`}</span>
        {rotulo ? <span className="ds-anel-rotulo">{rotulo}</span> : null}
      </span>
    </div>
  );
}

/* ═══ Metrica ═════════════════════════════════════════════════════════════ */

export type Tendencia = {
  /** Variação percentual no período. Sinal define a seta. */
  variacao: number;
  rotulo?: string;
  /** Indicador em que subir é ruim (no-show, churn, tempo de resposta). */
  invertido?: boolean;
};

function ChipTendencia({ variacao, rotulo, invertido }: Tendencia) {
  const subiu = variacao > 0;
  const parado = variacao === 0;
  const bom = invertido ? !subiu : subiu;
  const Icone = parado ? Minus : subiu ? TrendingUp : TrendingDown;
  const tom = parado ? "neutro" : bom ? "ok" : "risco";

  return (
    <span className="of-tendencia" data-tom={tom}>
      <Icone aria-hidden />
      {`${subiu ? "+" : ""}${variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
      {/* A seta diz a direção, a cor diz o julgamento, e num indicador
          invertido (no-show, churn) as duas discordam de propósito. Quem não
          enxerga cor ficaria só com a seta e leria o contrário: o julgamento
          vira texto para não depender de cor nenhuma. */}
      {parado ? null : <span className="sr-only">{bom ? "melhora" : "piora"}</span>}
      {rotulo ? <span className="ds-metrica-apoio">{rotulo}</span> : null}
    </span>
  );
}

export function Metrica({
  rotulo,
  valor,
  apoio,
  icone,
  tendencia,
  faixa,
  anel,
  tom,
  densidade = "padrao",
}: {
  rotulo: string;
  valor: React.ReactNode;
  apoio?: string;
  icone?: React.ReactNode;
  tendencia?: Tendencia;
  /** Série curta para leitura de forma, não de valor: sem eixo, sem tooltip. */
  faixa?: number[];
  anel?: { valor: number; tom?: TomAnel };
  /** `escuro` para o KPI que vive sobre a casca (topbar, faixa de topo). */
  tom?: "escuro";
  densidade?: Densidade;
}) {
  const maximo = faixa && faixa.length > 0 ? Math.max(...faixa) : 0;

  return (
    <div className="ds-metrica" data-tom={tom} data-densidade={densidade === "compacta" ? "compacta" : undefined}>
      <div className="ds-metrica-topo">
        <span className="ds-metrica-rotulo">{rotulo}</span>
        {icone ?? (tendencia ? <ChipTendencia {...tendencia} /> : null)}
      </div>

      <div className="of-metrica-corpo">
        <div className="of-metrica-num">
          <span className="ds-metrica-valor">{valor}</span>
          {apoio ? <span className="ds-metrica-apoio">{apoio}</span> : null}
          {icone && tendencia ? <ChipTendencia {...tendencia} /> : null}
        </div>
        {anel ? <Anel valor={anel.valor} tom={anel.tom} tamanho="sm" descricao={rotulo} /> : null}
      </div>

      {faixa && faixa.length > 0 ? (
        <div className="ds-faixa" aria-hidden>
          {faixa.map((ponto, i) => (
            // Altura é proporção do dado, não medida de layout; o piso evita
            // que a semana fraca suma e finja não ter existido.
            <i key={i} style={{ height: `${Math.max(8, (ponto / maximo) * 100)}%` }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ═══ GavetaDetalhe ═══════════════════════════════════════════════════════ */

export type AbaGaveta = AbaEntidade & { conteudo: React.ReactNode };

export function GavetaDetalhe({
  aberta,
  aoFechar,
  entidade,
  abas,
  rodape,
  largura = "media",
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** O mesmo contrato do cabeçalho: lead, negócio, tarefa e contrato entram
   *  todos por aqui. Gaveta nova por entidade é dialeto novo para manter. */
  entidade: Omit<CabecalhoEntidadeProps, "abas" | "compacto">;
  abas: AbaGaveta[];
  rodape?: React.ReactNode;
  largura?: "media" | "larga";
}) {
  const reduzido = useReducedMotion();
  const primeira = abas[0]?.valor ?? "";
  /* Reabrir a gaveta em outra entidade não pode herdar a aba da anterior.
     O reset vem da REMONTAGEM (o conteúdo só existe enquanto `aberta`), não de
     um efeito que chama setState depois de pintar: `set-state-in-effect` é
     render em dois passos, e aqui o primeiro passo mostraria a aba errada. */
  const [aba, setAba] = React.useState(primeira);

  return (
    <GavetaPrimitive.Root open={aberta} onOpenChange={(estado) => { if (!estado) aoFechar(); }}>
      <AnimatePresence>
        {aberta ? (
          <GavetaPrimitive.Portal forceMount>
            <GavetaPrimitive.Overlay asChild forceMount>
              <motion.div
                className="of-gaveta-veu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduzido ? 0 : DURACAO.rapido }}
              />
            </GavetaPrimitive.Overlay>

            <GavetaPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.aside
                className="of-gaveta"
                data-largura={largura}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                // Mola, não curva: o painel tem peso e chega no lugar sem quicar.
                transition={reduzido ? { duration: 0 } : MOLA.gaveta}
              >
                <GavetaPrimitive.Title className="sr-only">{entidade.nome}</GavetaPrimitive.Title>

                <Tabs value={aba} onValueChange={setAba} className="of-gaveta-tabs">
                  <div className="of-gaveta-topo">
                    <CabecalhoEntidade {...entidade} compacto abas={abas} />
                    <GavetaPrimitive.Close className="of-gaveta-fechar" aria-label="Fechar detalhe">
                      <X aria-hidden />
                    </GavetaPrimitive.Close>
                  </div>

                  <div className="of-gaveta-corpo">
                    {abas.map((item) => (
                      <TabsContent key={item.valor} value={item.valor}>
                        {item.conteudo}
                      </TabsContent>
                    ))}
                  </div>
                </Tabs>

                {rodape ? <footer className="of-gaveta-rodape">{rodape}</footer> : null}
              </motion.aside>
            </GavetaPrimitive.Content>
          </GavetaPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </GavetaPrimitive.Root>
  );
}
