"use client";

/** Fluxos guiados do ONFACE.
 *
 * Três formas de conduzir alguém por um trabalho que tem ordem: o assistente
 * (o usuário monta um documento em passos, e vê o resultado o tempo todo), o
 * onboarding (a operação executa um roteiro longo em dias, e precisa saber o
 * que já ficou de pé) e o canvas (uma automação que roda sozinha, e alguém
 * precisa entender por onde o lead passou).
 *
 * O que os três têm em comum e é a regra da família: passo não é tela bonita,
 * é compromisso. Quem avança sabe o que ficou decidido atrás e o que falta na
 * frente; quem volta não perde o que digitou. Wizard que esquece o passo
 * anterior é formulário longo com animação.
 *
 * Nada aqui guarda dado em contexto global: os três são controlados por estado
 * React local e podem ser montados duas vezes na mesma página sem se falarem. */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Clock,
  FileSignature,
  GitBranch,
  Plus,
  Sparkles,
  Trash2,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURVA, DURACAO } from "./motion";
import { brl } from "./dados";
import { CampoNexo, FundoGrafico } from "./marca";
import "./fluxos.css";

/* `CURVA` é `as const`, então vem como tupla readonly; a tipagem de `ease` do
   motion pede a tupla mutável. Uma cópia num lugar só, em vez de espalhar
   spread por cada transição. */
const ENTRADA: [number, number, number, number] = [...CURVA.entrada];

/* ════════════════════════════════════════════════════════════════════════
   1. Assistente de proposta
   ════════════════════════════════════════════════════════════════════════
   O fluxo real do Callface antes do Documenso: o vendedor monta a proposta a
   partir do negócio, e o cliente recebe um PDF para assinar. O preview ao lado
   existe porque proposta é dinheiro: quem digita 40 ramais precisa ver o total
   mudar no mesmo instante, senão o erro só aparece depois de enviado. */

export type ItemProposta = {
  id: string;
  descricao: string;
  quantidade: number;
  unitario: number;
};

export type RascunhoProposta = {
  empresa: string;
  contato: string;
  produto: string;
  itens: ItemProposta[];
  descontoPct: number;
  vigenciaMeses: number;
  pagamento: string;
  validadeDias: number;
  observacao: string;
};

const RASCUNHO_INICIAL: RascunhoProposta = {
  empresa: "TechCorp Telecom",
  contato: "Ricardo Alves",
  produto: "PABX",
  itens: [
    { id: "it-1", descricao: "Licença PABX · por ramal", quantidade: 40, unitario: 79 },
    { id: "it-2", descricao: "Implantação e portabilidade", quantidade: 1, unitario: 3800 },
  ],
  descontoPct: 8,
  vigenciaMeses: 12,
  pagamento: "Boleto mensal",
  validadeDias: 7,
  observacao: "",
};

const PASSOS_PROPOSTA = [
  { rotulo: "Escopo", apoio: "Cliente e produto" },
  { rotulo: "Itens e valores", apoio: "O que entra na conta" },
  { rotulo: "Condições", apoio: "Vigência e pagamento" },
  { rotulo: "Revisão", apoio: "Confere e envia" },
] as const;

const PAGAMENTOS = ["Boleto mensal", "Cartão recorrente", "Boleto anual com 2 meses de bônus"];

/** O mínimo de cada passo, em uma frase que o vendedor entende.
 *
 * Fica fora do componente de propósito: a regra de "o que trava o avanço" é a
 * mesma no wizard, no rascunho salvo e em quem for enviar por API depois. */
function pendenciaDoPasso(passo: number, r: RascunhoProposta): string | null {
  if (passo === 0) {
    if (!r.empresa.trim()) return "Informe a empresa do negócio.";
    if (!r.contato.trim()) return "Informe quem assina pelo lado do cliente.";
    return null;
  }
  if (passo === 1) {
    if (r.itens.length === 0) return "A proposta precisa de pelo menos um item.";
    if (r.itens.some((i) => !i.descricao.trim())) return "Todo item precisa de descrição.";
    if (r.itens.some((i) => i.quantidade <= 0 || i.unitario <= 0))
      return "Quantidade e valor unitário precisam ser maiores que zero.";
    return null;
  }
  if (passo === 2) {
    if (r.vigenciaMeses < 1) return "A vigência mínima de contrato é de 1 mês.";
    if (r.validadeDias < 1) return "Defina por quantos dias a proposta vale.";
    return null;
  }
  return null;
}

function totaisDa(r: RascunhoProposta) {
  const subtotal = r.itens.reduce((soma, i) => soma + i.quantidade * i.unitario, 0);
  const desconto = Math.round(subtotal * (r.descontoPct / 100));
  return { subtotal, desconto, total: subtotal - desconto };
}

/** Número vindo de `<input type="number">` sempre volta string, e string vazia
 *  vira NaN. Sem este saneamento o total some da tela no meio da digitação. */
const numero = (bruto: string, minimo = 0) => {
  const n = Number(bruto);
  return Number.isFinite(n) ? Math.max(minimo, n) : minimo;
};

export function AssistenteProposta() {
  const [passo, setPasso] = React.useState(0);
  const [rascunho, setRascunho] = React.useState<RascunhoProposta>(RASCUNHO_INICIAL);
  /* Só depois de tentar avançar a pendência aparece. Validar a cada tecla
     acusa o campo antes de a pessoa terminar de escrever nele. */
  const [tentouAvancar, setTentouAvancar] = React.useState(false);
  const [enviada, setEnviada] = React.useState(false);
  const reduzido = useReducedMotion();

  const transicao: Transition = reduzido
    ? { duration: 0 }
    : { duration: DURACAO.base, ease: ENTRADA };

  const pendencia = pendenciaDoPasso(passo, rascunho);
  const { subtotal, desconto, total } = totaisDa(rascunho);
  const ultimo = passo === PASSOS_PROPOSTA.length - 1;

  const ajustar = React.useCallback(
    (patch: Partial<RascunhoProposta>) => setRascunho((r) => ({ ...r, ...patch })),
    [],
  );

  const ajustarItem = React.useCallback((id: string, patch: Partial<ItemProposta>) => {
    setRascunho((r) => ({
      ...r,
      itens: r.itens.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }, []);

  function avancar() {
    if (pendencia) {
      /* O botão continua habilitado de propósito: botão desabilitado não diz
         por que está desabilitado e some da navegação por teclado. Aqui o
         clique revela o motivo, que é anunciado pelo aria-live abaixo. */
      setTentouAvancar(true);
      return;
    }
    setTentouAvancar(false);
    setPasso((p) => Math.min(p + 1, PASSOS_PROPOSTA.length - 1));
  }

  function voltar() {
    setTentouAvancar(false);
    setPasso((p) => Math.max(p - 1, 0));
  }

  function enviar() {
    setEnviada(true);
    toast.success("Proposta enviada para assinatura", {
      description: `${rascunho.empresa} · ${brl(total)} · vale por ${rascunho.validadeDias} dias.`,
    });
  }

  function recomecar() {
    setRascunho(RASCUNHO_INICIAL);
    setPasso(0);
    setTentouAvancar(false);
    setEnviada(false);
  }

  if (enviada) {
    return (
      <div className="fx-enviada">
        <span className="fx-enviada-marca" aria-hidden>
          <FileSignature />
        </span>
        <strong>Proposta a caminho do cliente</strong>
        <p>
          {rascunho.empresa} recebeu {brl(total)} em {rascunho.itens.length}{" "}
          {rascunho.itens.length === 1 ? "item" : "itens"}. O negócio fica em Proposta até a
          assinatura voltar.
        </p>
        <Button variant="outline" size="sm" onClick={recomecar}>
          Montar outra proposta
        </Button>
      </div>
    );
  }

  return (
    <div className="fx-assistente">
      <div className="fx-assistente-form">
        {/* Trilha: onde estou, o que já passou, quanto falta. Voltar é sempre
            permitido; pular para a frente não, porque o passo seguinte depende
            do anterior estar válido. */}
        <ol className="fx-trilha">
          {PASSOS_PROPOSTA.map((p, i) => {
            const estado = i < passo ? "feito" : i === passo ? "agora" : "futuro";
            return (
              <li key={p.rotulo} className="fx-trilha-item" data-estado={estado}>
                <button
                  type="button"
                  className="fx-trilha-botao"
                  onClick={() => i < passo && setPasso(i)}
                  disabled={i > passo}
                  aria-current={i === passo ? "step" : undefined}
                >
                  <span className="fx-trilha-marca" aria-hidden>
                    {i < passo ? <Check /> : i + 1}
                  </span>
                  <span className="fx-trilha-texto">
                    <strong>{p.rotulo}</strong>
                    <small>{p.apoio}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="fx-progresso" role="presentation">
          <motion.i
            className="fx-progresso-fill"
            initial={false}
            animate={{ scaleX: (passo + 1) / PASSOS_PROPOSTA.length }}
            transition={transicao}
          />
        </div>

        {/* `mode="wait"` porque os passos ocupam a mesma coluna: sem ele os dois
            se sobrepõem e o formulário "pula" durante a troca. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={passo}
            className="fx-passo"
            initial={{ opacity: 0, x: reduzido ? 0 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduzido ? 0 : -12 }}
            transition={transicao}
          >
            {passo === 0 ? (
              <PassoEscopo rascunho={rascunho} ajustar={ajustar} />
            ) : null}
            {passo === 1 ? (
              <PassoItens
                rascunho={rascunho}
                ajustar={ajustar}
                ajustarItem={ajustarItem}
                setRascunho={setRascunho}
              />
            ) : null}
            {passo === 2 ? <PassoCondicoes rascunho={rascunho} ajustar={ajustar} /> : null}
            {passo === 3 ? <PassoRevisao rascunho={rascunho} /> : null}
          </motion.div>
        </AnimatePresence>

        {/* Região viva única para o passo inteiro: o leitor de tela ouve o
            motivo do bloqueio no momento em que ele aparece. */}
        <p className="fx-pendencia" role="status" data-visivel={tentouAvancar && pendencia ? "true" : "false"}>
          {tentouAvancar && pendencia ? (
            <>
              <CircleAlert aria-hidden />
              {pendencia}
            </>
          ) : null}
        </p>

        <div className="fx-acoes">
          <Button variant="ghost" size="sm" onClick={voltar} disabled={passo === 0}>
            <ArrowLeft aria-hidden />
            Voltar
          </Button>
          {ultimo ? (
            <Button size="sm" onClick={enviar}>
              <FileSignature aria-hidden />
              Enviar para assinatura
            </Button>
          ) : (
            <Button size="sm" onClick={avancar}>
              Avançar
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <PreviewProposta
        rascunho={rascunho}
        subtotal={subtotal}
        desconto={desconto}
        total={total}
        transicao={transicao}
      />
    </div>
  );
}

function PassoEscopo({
  rascunho,
  ajustar,
}: {
  rascunho: RascunhoProposta;
  ajustar: (patch: Partial<RascunhoProposta>) => void;
}) {
  return (
    <fieldset className="fx-campos">
      <legend className="fx-legenda">De quem é a proposta</legend>
      <div className="fx-campo">
        <Label htmlFor="fx-empresa">Empresa</Label>
        <Input
          id="fx-empresa"
          value={rascunho.empresa}
          onChange={(e) => ajustar({ empresa: e.target.value })}
          placeholder="TechCorp Telecom"
        />
      </div>
      <div className="fx-campo">
        <Label htmlFor="fx-contato">Quem assina</Label>
        <Input
          id="fx-contato"
          value={rascunho.contato}
          onChange={(e) => ajustar({ contato: e.target.value })}
          placeholder="Ricardo Alves"
        />
      </div>
      <div className="fx-campo">
        <Label htmlFor="fx-produto">Produto</Label>
        <Select value={rascunho.produto} onValueChange={(v) => ajustar({ produto: v })}>
          <SelectTrigger id="fx-produto" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["PABX", "Callface AI", "Discador", "White Label", "Licenças"].map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  );
}

function PassoItens({
  rascunho,
  ajustar,
  ajustarItem,
  setRascunho,
}: {
  rascunho: RascunhoProposta;
  ajustar: (patch: Partial<RascunhoProposta>) => void;
  ajustarItem: (id: string, patch: Partial<ItemProposta>) => void;
  setRascunho: React.Dispatch<React.SetStateAction<RascunhoProposta>>;
}) {
  const proximoId = React.useRef(rascunho.itens.length + 1);

  function adicionar() {
    proximoId.current += 1;
    setRascunho((r) => ({
      ...r,
      itens: [...r.itens, { id: `it-${proximoId.current}`, descricao: "", quantidade: 1, unitario: 0 }],
    }));
  }

  function remover(id: string) {
    setRascunho((r) => ({ ...r, itens: r.itens.filter((i) => i.id !== id) }));
  }

  return (
    <fieldset className="fx-campos">
      <legend className="fx-legenda">O que o cliente está comprando</legend>

      <div className="fx-itens">
        {rascunho.itens.map((item, indice) => (
          <div key={item.id} className="fx-item">
            <div className="fx-campo">
              <Label htmlFor={`${item.id}-desc`}>Item {indice + 1}</Label>
              <Input
                id={`${item.id}-desc`}
                value={item.descricao}
                onChange={(e) => ajustarItem(item.id, { descricao: e.target.value })}
                placeholder="Licença PABX · por ramal"
              />
            </div>
            <div className="fx-campo fx-campo-num">
              <Label htmlFor={`${item.id}-qtd`}>Qtd.</Label>
              <Input
                id={`${item.id}-qtd`}
                type="number"
                min={1}
                inputMode="numeric"
                value={item.quantidade}
                onChange={(e) => ajustarItem(item.id, { quantidade: numero(e.target.value) })}
              />
            </div>
            <div className="fx-campo fx-campo-num">
              <Label htmlFor={`${item.id}-valor`}>Unitário (R$)</Label>
              <Input
                id={`${item.id}-valor`}
                type="number"
                min={0}
                inputMode="decimal"
                value={item.unitario}
                onChange={(e) => ajustarItem(item.id, { unitario: numero(e.target.value) })}
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => remover(item.id)}
              aria-label={`Remover item ${indice + 1}${item.descricao ? `: ${item.descricao}` : ""}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={adicionar}>
        <Plus aria-hidden />
        Adicionar item
      </Button>

      <div className="fx-campo fx-campo-num">
        <Label htmlFor="fx-desconto">Desconto (%)</Label>
        <Input
          id="fx-desconto"
          type="number"
          min={0}
          max={30}
          inputMode="numeric"
          value={rascunho.descontoPct}
          onChange={(e) => ajustar({ descontoPct: Math.min(30, numero(e.target.value)) })}
        />
      </div>

      {/* Sinal do NEXO no ponto da decisão, não num painel separado: a margem
          se perde aqui, com o cursor dentro do campo de desconto. */}
      {rascunho.descontoPct > 12 ? (
        <p className="fx-nexo-nota">
          <Sparkles aria-hidden />
          NEXO: negócios semelhantes de {rascunho.produto} fecharam com 8% nos últimos 90 dias.
        </p>
      ) : null}
    </fieldset>
  );
}

function PassoCondicoes({
  rascunho,
  ajustar,
}: {
  rascunho: RascunhoProposta;
  ajustar: (patch: Partial<RascunhoProposta>) => void;
}) {
  return (
    <fieldset className="fx-campos">
      <legend className="fx-legenda">Como o contrato roda</legend>
      <div className="fx-dupla">
        <div className="fx-campo">
          <Label htmlFor="fx-vigencia">Vigência (meses)</Label>
          <Input
            id="fx-vigencia"
            type="number"
            min={1}
            inputMode="numeric"
            value={rascunho.vigenciaMeses}
            onChange={(e) => ajustar({ vigenciaMeses: numero(e.target.value) })}
          />
        </div>
        <div className="fx-campo">
          <Label htmlFor="fx-validade">Proposta vale por (dias)</Label>
          <Input
            id="fx-validade"
            type="number"
            min={1}
            inputMode="numeric"
            value={rascunho.validadeDias}
            onChange={(e) => ajustar({ validadeDias: numero(e.target.value) })}
          />
        </div>
      </div>
      <div className="fx-campo">
        <Label htmlFor="fx-pagamento">Forma de pagamento</Label>
        <Select value={rascunho.pagamento} onValueChange={(v) => ajustar({ pagamento: v })}>
          <SelectTrigger id="fx-pagamento" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGAMENTOS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="fx-campo">
        <Label htmlFor="fx-obs">Observação para o cliente</Label>
        <Textarea
          id="fx-obs"
          rows={3}
          value={rascunho.observacao}
          onChange={(e) => ajustar({ observacao: e.target.value })}
          placeholder="Ex.: portabilidade agendada para a primeira semana após a assinatura."
        />
      </div>
    </fieldset>
  );
}

function PassoRevisao({ rascunho }: { rascunho: RascunhoProposta }) {
  const { total } = totaisDa(rascunho);
  const linhas = [
    { rotulo: "Cliente", valor: `${rascunho.empresa} · ${rascunho.contato}` },
    { rotulo: "Produto", valor: rascunho.produto },
    { rotulo: "Itens", valor: `${rascunho.itens.length} na proposta` },
    { rotulo: "Desconto", valor: `${rascunho.descontoPct}%` },
    { rotulo: "Vigência", valor: `${rascunho.vigenciaMeses} meses · ${rascunho.pagamento}` },
    { rotulo: "Validade", valor: `${rascunho.validadeDias} dias` },
    { rotulo: "Total", valor: brl(total) },
  ];

  return (
    <div className="fx-campos">
      <p className="fx-legenda">Confira antes de mandar para assinatura</p>
      <dl className="fx-revisao">
        {linhas.map((l) => (
          <div key={l.rotulo} className="fx-revisao-linha">
            <dt>{l.rotulo}</dt>
            <dd>{l.valor}</dd>
          </div>
        ))}
      </dl>
      <p className="fx-revisao-aviso">
        O envio cria o documento no Documenso e registra a atividade no negócio. Enquanto o cliente
        não assinar, o negócio continua em Proposta.
      </p>
    </div>
  );
}

/** Preview: o documento que o cliente vai receber, montado a partir do mesmo
 *  estado do formulário. Não é resumo nem espelho parcial — é a fatura. */
function PreviewProposta({
  rascunho,
  subtotal,
  desconto,
  total,
  transicao,
}: {
  rascunho: RascunhoProposta;
  subtotal: number;
  desconto: number;
  total: number;
  transicao: Transition;
}) {
  return (
    <aside className="fx-preview" aria-label="Pré-visualização da proposta">
      <header className="fx-preview-topo">
        <p className="fx-preview-rotulo">Proposta comercial</p>
        <strong>{rascunho.empresa || "Empresa sem nome"}</strong>
        <small>
          A/C {rascunho.contato || "—"} · {rascunho.produto}
        </small>
      </header>

      <ul className="fx-preview-itens">
        {rascunho.itens.length === 0 ? (
          <li className="fx-preview-vazio">Nenhum item na proposta ainda.</li>
        ) : (
          rascunho.itens.map((i) => (
            <li key={i.id}>
              <span>
                {i.descricao || "Item sem descrição"}
                <small>
                  {i.quantidade} × {brl(i.unitario, true)}
                </small>
              </span>
              <b>{brl(i.quantidade * i.unitario)}</b>
            </li>
          ))
        )}
      </ul>

      <dl className="fx-preview-somas">
        <div>
          <dt>Subtotal</dt>
          <dd>{brl(subtotal)}</dd>
        </div>
        <div data-tom={desconto > 0 ? "abate" : undefined}>
          <dt>Desconto {rascunho.descontoPct}%</dt>
          <dd>{desconto > 0 ? `− ${brl(desconto)}` : brl(0)}</dd>
        </div>
      </dl>

      <div className="fx-preview-total">
        <span>Total devido</span>
        {/* `key` no valor: a troca remonta o nó e o número entra com um fade
            curto, que é o sinal de "isto acabou de mudar". Sem movimento
            lateral, para não competir com a leitura do próprio número. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.b
            key={total}
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 1 }}
            transition={transicao}
          >
            {brl(total)}
          </motion.b>
        </AnimatePresence>
      </div>

      <footer className="fx-preview-pe">
        <span>{rascunho.vigenciaMeses} meses</span>
        <span>{rascunho.pagamento}</span>
        <span>Vale {rascunho.validadeDias} dias</span>
      </footer>
      {rascunho.observacao.trim() ? (
        <p className="fx-preview-obs">{rascunho.observacao}</p>
      ) : null}
    </aside>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   2. Onboarding de implantação
   ════════════════════════════════════════════════════════════════════════
   Implantação de PABX não acontece numa sessão: são dias, gente diferente em
   cada etapa e uma portabilidade que depende da operadora. Por isso o roteiro
   é vertical e persistente — quem abre amanhã precisa ver onde parou, não
   recomeçar. A lateral grafite existe para separar "o contrato da implantação"
   (a identidade, que não muda) do "o que fazer agora" (o painel, que muda). */

type PassoImplantacao = {
  id: string;
  rotulo: string;
  apoio: string;
  responsavel: string;
  prazo: string;
  tarefas: string[];
};

const IMPLANTACAO: PassoImplantacao[] = [
  {
    id: "contrato",
    rotulo: "Contrato assinado",
    apoio: "Documenso devolveu as assinaturas",
    responsavel: "Mayara Ribeiro",
    prazo: "D+0",
    tarefas: [
      "Conferir assinatura das duas partes no Documenso",
      "Anexar o contrato ao negócio no CRM",
      "Abrir o card de implantação para o time de operação",
    ],
  },
  {
    id: "operacao",
    rotulo: "Dados da operação",
    apoio: "Quantos ramais, quais filas, quem atende",
    responsavel: "Ana Souza",
    prazo: "D+1",
    tarefas: [
      "Levantar ramais por setor e horário de atendimento",
      "Mapear as filas e a regra de transbordo",
      "Cadastrar os usuários que vão receber licença",
    ],
  },
  {
    id: "portabilidade",
    rotulo: "Portabilidade",
    apoio: "A etapa que depende de terceiro",
    responsavel: "Lucas Pacheco",
    prazo: "D+3",
    tarefas: [
      "Solicitar a portabilidade dos números à operadora atual",
      "Combinar a janela de corte com o cliente",
      "Manter o número antigo ativo até a confirmação",
    ],
  },
  {
    id: "pabx",
    rotulo: "Configuração do PABX",
    apoio: "URA, filas, gravação e integração",
    responsavel: "Ana Souza",
    prazo: "D+5",
    tarefas: [
      "Montar a URA com a árvore aprovada pelo cliente",
      "Ligar a gravação de chamada e a retenção acordada",
      "Conectar o PABX ao CRM para registrar ligação automaticamente",
    ],
  },
  {
    id: "treinamento",
    rotulo: "Treinamento",
    apoio: "Time do cliente usando de verdade",
    responsavel: "Ana Souza",
    prazo: "D+8",
    tarefas: [
      "Sessão ao vivo com o time de atendimento",
      "Entregar o roteiro curto de uso diário",
      "Deixar um canal direto aberto na primeira semana",
    ],
  },
  {
    id: "go-live",
    rotulo: "Go-live",
    apoio: "Operação inteira no Callface",
    responsavel: "Mayara Ribeiro",
    prazo: "D+10",
    tarefas: [
      "Cortar o tráfego para a nova operação",
      "Acompanhar as duas primeiras horas com o time em linha",
      "Passar a conta para o acompanhamento de CS",
    ],
  },
];

/* O campo do NEXO ganha densidade conforme a implantação anda: é o mesmo
   desenho de nós do resto do sistema, não um loader genérico. */
const ESTAGIOS_NEXO = ["escutando", "pensando", "buscando", "analisando", "executando", "executando"] as const;

export function OnboardingImplantacao() {
  const [atual, setAtual] = React.useState(0);
  const [concluidos, setConcluidos] = React.useState<boolean[]>(() => IMPLANTACAO.map(() => false));
  const reduzido = useReducedMotion();

  const transicao: Transition = reduzido
    ? { duration: 0 }
    : { duration: DURACAO.base, ease: ENTRADA };

  const feitos = concluidos.filter(Boolean).length;
  const passo = IMPLANTACAO[atual];
  const estagio = feitos >= IMPLANTACAO.length ? "concluido" : ESTAGIOS_NEXO[feitos] ?? "pensando";

  function concluirEAvancar() {
    setConcluidos((antes) => antes.map((v, i) => (i === atual ? true : v)));
    setAtual((i) => Math.min(i + 1, IMPLANTACAO.length - 1));
  }

  function reabrir() {
    setConcluidos((antes) => antes.map((v, i) => (i === atual ? false : v)));
  }

  return (
    <div className="fx-onb">
      {/* A lateral é um escopo de superfície escura: os componentes dentro dela
          continuam lendo os mesmos tokens e ficam legíveis sem override. */}
      <div className="fx-onb-lado" data-onface-superficie="escura">
        <FundoGrafico variante="conexoes" superficie="escura" halo />
        <div className="fx-onb-lado-conteudo">
          <p className="fx-onb-rotulo">Implantação Callface</p>
          <h4 className="fx-onb-cliente">TechCorp Telecom</h4>
          <p className="fx-onb-plano">PABX · 40 ramais · início em 2 de setembro</p>

          <CampoNexo estagio={estagio} superficie="escura" altura={84} />

          <p className="fx-onb-contagem">
            <strong>{feitos}</strong> de {IMPLANTACAO.length} etapas concluídas
          </p>

          <ol className="fx-stepper">
            {IMPLANTACAO.map((p, i) => {
              const feito = concluidos[i];
              const estado = feito ? "feito" : i === atual ? "agora" : "futuro";
              return (
                <li key={p.id} className="fx-stepper-item" data-estado={estado}>
                  <button
                    type="button"
                    className="fx-stepper-botao"
                    onClick={() => setAtual(i)}
                    aria-current={i === atual ? "step" : undefined}
                  >
                    <span className="fx-stepper-marca" aria-hidden>
                      {feito ? <Check /> : i + 1}
                    </span>
                    <span className="fx-stepper-texto">
                      <strong>{p.rotulo}</strong>
                      <small>{p.apoio}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="fx-onb-painel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={passo.id}
            initial={{ opacity: 0, y: reduzido ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduzido ? 0 : -8 }}
            transition={transicao}
          >
            <p className="fx-onb-passo-ordem">
              Etapa {atual + 1} de {IMPLANTACAO.length} · prazo {passo.prazo}
            </p>
            <h4 className="fx-onb-passo-titulo">{passo.rotulo}</h4>
            <p className="fx-onb-passo-apoio">{passo.apoio}</p>

            <ul className="fx-onb-tarefas">
              {passo.tarefas.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>

            <p className="fx-onb-dono">
              <User aria-hidden />
              {passo.responsavel}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="fx-acoes">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAtual((i) => Math.max(i - 1, 0))}
            disabled={atual === 0}
          >
            <ArrowLeft aria-hidden />
            Etapa anterior
          </Button>
          {concluidos[atual] ? (
            <Button variant="outline" size="sm" onClick={reabrir}>
              Reabrir etapa
            </Button>
          ) : (
            <Button size="sm" onClick={concluirEAvancar}>
              <Check aria-hidden />
              Concluir etapa
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   3. Canvas de automação
   ════════════════════════════════════════════════════════════════════════
   O que a tela responde: por onde o lead passou e onde a automação está
   custando tempo. Por isso o nó carrega dono, duração média e o resultado da
   última execução — sem isso é um diagrama bonito que ninguém consulta.

   Sem biblioteca de fluxo: o layout é grid (coluna/linha declaradas no nó) e os
   conectores são um SVG desenhado a partir da posição MEDIDA de cada cartão.
   Medir em vez de fixar coordenada é o que mantém o desenho certo quando o
   texto quebra em outra largura.

   ponytail: arrastar nó e editar o fluxo ficam de fora até o produto pedir.
   Quando pedir, o caminho é trocar coluna/linha por posição livre e reaproveitar
   o @dnd-kit que o Quadro já usa, não instalar um motor de fluxo. */

type TipoNo = "gatilho" | "condicao" | "acao";

type NoFluxo = {
  id: string;
  tipo: TipoNo;
  titulo: string;
  detalhe: string;
  dono: string;
  duracao: string;
  ultima: { estado: "ok" | "falha" | "espera"; texto: string };
  coluna: number;
  linha: number;
};

const ICONE_TIPO: Record<TipoNo, LucideIcon> = {
  gatilho: Zap,
  condicao: GitBranch,
  acao: ArrowRight,
};

const ROTULO_TIPO: Record<TipoNo, string> = {
  gatilho: "Gatilho",
  condicao: "Condição",
  acao: "Ação",
};

const NOS: NoFluxo[] = [
  {
    id: "f-1",
    tipo: "gatilho",
    titulo: "Lead novo no Meta Ads",
    detalhe: "Webhook do formulário de campanha",
    dono: "Growth",
    duracao: "1,2s",
    ultima: { estado: "ok", texto: "há 4 min · 38 hoje" },
    coluna: 1,
    linha: 2,
  },
  {
    id: "f-2",
    tipo: "condicao",
    titulo: "Telefone é válido?",
    detalhe: "DDD conhecido e 10 ou 11 dígitos",
    dono: "Operações",
    duracao: "0,3s",
    ultima: { estado: "ok", texto: "há 4 min · 31 sim / 7 não" },
    coluna: 2,
    linha: 2,
  },
  {
    id: "f-3",
    tipo: "acao",
    titulo: "Cria negócio em Qualificação",
    detalhe: "Distribui pelo rodízio do time comercial",
    dono: "CRM",
    duracao: "2,8s",
    ultima: { estado: "ok", texto: "há 4 min · 31 negócios" },
    coluna: 3,
    linha: 1,
  },
  {
    id: "f-4",
    tipo: "acao",
    titulo: "NEXO abre a conversa no WhatsApp",
    detalhe: "Primeira mensagem em até 2 minutos do cadastro",
    dono: "NEXO",
    duracao: "11s",
    ultima: { estado: "ok", texto: "há 5 min · 68% de resposta" },
    coluna: 4,
    linha: 1,
  },
  {
    id: "f-5",
    tipo: "condicao",
    titulo: "Tem CNPJ no cadastro?",
    detalhe: "Só enriquece quem dá para identificar",
    dono: "Operações",
    duracao: "0,4s",
    ultima: { estado: "ok", texto: "há 12 min · 7 avaliados" },
    coluna: 3,
    linha: 3,
  },
  {
    id: "f-6",
    tipo: "acao",
    titulo: "Enriquece e devolve para a fila",
    detalhe: "Busca telefone da empresa e reprocessa o lead",
    dono: "Growth",
    duracao: "6,5s",
    ultima: { estado: "falha", texto: "há 12 min · 2 sem telefone" },
    coluna: 4,
    linha: 3,
  },
];

const LIGACOES: { de: string; para: string; rotulo?: string }[] = [
  { de: "f-1", para: "f-2" },
  { de: "f-2", para: "f-3", rotulo: "sim" },
  { de: "f-2", para: "f-5", rotulo: "não" },
  { de: "f-3", para: "f-4" },
  { de: "f-5", para: "f-6", rotulo: "sim" },
];

type Conector = { id: string; de: string; para: string; d: string; rotulo?: string; x: number; y: number };

export function CanvasAutomacao() {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const cartoesRef = React.useRef(new Map<string, HTMLElement>());
  const [conectores, setConectores] = React.useState<Conector[]>([]);
  const [selecionado, setSelecionado] = React.useState<string | null>(null);
  /* O marker de seta é referenciado por id dentro do SVG. Duas instâncias do
     canvas na mesma página com o mesmo id fariam a segunda apontar para o
     marker da primeira. */
  const idBase = React.useId().replace(/:/g, "");

  /* Layout primeiro, medida depois: `useLayoutEffect` desenha os conectores no
     mesmo frame em que os cartões existem, então nunca aparece um quadro com
     os cartões soltos e as linhas faltando. */
  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function medir() {
      const base = canvas?.getBoundingClientRect();
      if (!base) return;
      setConectores(
        LIGACOES.flatMap<Conector>((lig) => {
          const a = cartoesRef.current.get(lig.de);
          const b = cartoesRef.current.get(lig.para);
          if (!a || !b) return [];
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          const x1 = ra.right - base.left;
          const y1 = ra.top - base.top + ra.height / 2;
          const x2 = rb.left - base.left;
          const y2 = rb.top - base.top + rb.height / 2;
          const meio = x1 + (x2 - x1) / 2;
          const sentido = Math.sign(y2 - y1);
          /* Cotovelo ortogonal com canto arredondado: o raio nunca passa da
             metade de nenhum dos dois trechos, senão a curva se dobra sobre si
             mesma quando os cartões ficam próximos. */
          const raio = Math.min(12, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2);
          const d =
            sentido === 0 || raio <= 0
              ? `M ${x1} ${y1} H ${x2}`
              : `M ${x1} ${y1} H ${meio - raio}` +
                ` Q ${meio} ${y1} ${meio} ${y1 + sentido * raio}` +
                ` V ${y2 - sentido * raio}` +
                ` Q ${meio} ${y2} ${meio + raio} ${y2}` +
                ` H ${x2}`;
          return [
            { id: `${lig.de}-${lig.para}`, de: lig.de, para: lig.para, d, rotulo: lig.rotulo, x: meio, y: (y1 + y2) / 2 },
          ];
        }),
      );
    }

    medir();
    /* Observa o canvas E cada cartão: mudar a largura da janela move tudo, mas
       um título que quebra em duas linhas só muda a altura do próprio cartão. */
    const observador = new ResizeObserver(medir);
    observador.observe(canvas);
    cartoesRef.current.forEach((no) => observador.observe(no));
    return () => observador.disconnect();
  }, []);

  return (
    <div className="fx-canvas-rolagem">
      <div className="fx-canvas" ref={canvasRef}>
        <FundoGrafico variante="pontos" superficie="clara" intensidade="apagada" />

        <svg className="fx-canvas-svg" aria-hidden focusable="false">
          <defs>
            <marker
              id={`${idBase}-seta`}
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 7 4 L 0 7 z" className="fx-canvas-ponta" />
            </marker>
          </defs>
          {conectores.map((c) => {
            const aceso = selecionado === c.de || selecionado === c.para;
            return (
              <g key={c.id} data-aceso={aceso ? "true" : undefined}>
                <path className="fx-canvas-caminho" d={c.d} markerEnd={`url(#${idBase}-seta)`} />
                {c.rotulo ? (
                  <text className="fx-canvas-rotulo" x={c.x} y={c.y} textAnchor="middle">
                    {c.rotulo}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {NOS.map((no) => {
          const Icone = ICONE_TIPO[no.tipo];
          return (
            <button
              key={no.id}
              type="button"
              className="fx-no"
              data-tipo={no.tipo}
              data-selecionado={selecionado === no.id ? "true" : undefined}
              style={{ gridColumn: no.coluna, gridRow: no.linha }}
              ref={(el) => {
                if (el) cartoesRef.current.set(no.id, el);
                else cartoesRef.current.delete(no.id);
              }}
              onClick={() => setSelecionado((atual) => (atual === no.id ? null : no.id))}
              aria-pressed={selecionado === no.id}
            >
              <span className="fx-no-tipo">
                <Icone aria-hidden />
                {ROTULO_TIPO[no.tipo]}
              </span>
              <strong>{no.titulo}</strong>
              <small>{no.detalhe}</small>
              <span className="fx-no-pe">
                <span className="fx-no-meta">
                  <User aria-hidden />
                  {no.dono}
                </span>
                <span className="fx-no-meta">
                  <Clock aria-hidden />
                  {no.duracao}
                </span>
              </span>
              <span className="fx-no-execucao" data-estado={no.ultima.estado}>
                {no.ultima.texto}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
