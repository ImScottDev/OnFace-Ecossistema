"use client";

/** Padrões compostos do ONFACE.
 *
 * Quatro telas inteiras, não quatro primitivas: convite de workspace,
 * configurações com trilho de auditoria, changelog e tela de entrada. Todas
 * já existem como problema no CRM da Callface e nenhuma cabia num componente
 * de `ui/`: o que define cada uma é a COMPOSIÇÃO (o que fica perto do quê, o
 * que muda de estado junto), não um controle novo.
 *
 * As referências que o Scott mandou entraram como estudo de capacidade e de
 * comportamento — o que o bloco precisa saber fazer, que estados existem, o
 * que fica de cada lado. O código é nosso, escrito sobre os nossos tokens e
 * componentes; a biblioteca de origem é paga e responde 401 sem licença,
 * então nada de lá foi baixado, extraído ou reconstruído.
 *
 * Mesma disciplina do resto do laboratório: zero hex cru, zero px solto,
 * coral só onde a pessoa precisa agir, e todo estado que acontece em produção
 * (inválido, salvando, erro, sem assento) existe aqui de verdade. */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle, ArrowRight, Bug, Check, Eye, EyeOff, Loader2, Lock, Mail, Send, Sparkles,
  UserPlus, Wrench, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { FundoGrafico } from "./marca";
import { DURACAO, MOLA } from "./motion";
import "./padroes.css";

/* ════════════════════════════════════════════════════════════════════════
   01 · Diálogo de convite
   ═══════════════════════════════════════════════════════════════════════ */

type Papel = "gestor" | "closer" | "sdr" | "leitura";

const PAPEIS: { valor: Papel; rotulo: string; apoio: string }[] = [
  { valor: "gestor", rotulo: "Gestor comercial", apoio: "vê o funil inteiro e edita metas" },
  { valor: "closer", rotulo: "Closer", apoio: "só a própria carteira, fecha negócio" },
  { valor: "sdr", rotulo: "SDR", apoio: "qualifica e passa adiante, não vê valor" },
  { valor: "leitura", rotulo: "Somente leitura", apoio: "painéis e relatórios, sem escrita" },
];

/** Assentos do contrato. Convite que estoura o plano é erro de negócio, não de
 *  formulário: por isso ele bloqueia o envio em vez de virar cobrança surpresa. */
const ASSENTOS = { contratados: 12, ocupados: 7 };

/** Validação de e-mail deliberadamente frouxa: quem valida de verdade é o
 *  servidor, que sabe o domínio permitido. Aqui o objetivo é só não deixar a
 *  pessoa mandar "ricardo@" e descobrir o erro dois minutos depois. */
const EMAIL_VALIDO = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

type Convidado = { id: string; email: string; papel: Papel; valido: boolean };

let sequencia = 0;
const proximoId = () => `cv-${++sequencia}`;

export function DialogoConvite() {
  const [aberto, setAberto] = React.useState(false);
  const [convidados, setConvidados] = React.useState<Convidado[]>([
    { id: proximoId(), email: "ricardo.alves@techcorptelecom.com.br", papel: "closer", valido: true },
  ]);
  const [rascunho, setRascunho] = React.useState("");
  const [mensagem, setMensagem] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);
  const reduzido = useReducedMotion() ?? false;
  const campo = React.useRef<HTMLInputElement>(null);

  const livres = ASSENTOS.contratados - ASSENTOS.ocupados;
  const invalidos = convidados.filter((c) => !c.valido).length;
  const estouro = Math.max(0, convidados.length - livres);
  const podeEnviar = convidados.length > 0 && invalidos === 0 && estouro === 0 && !enviando;

  /* Commita o rascunho em chips. Aceita colagem de lista inteira (a pessoa
     copia do e-mail do RH separado por vírgula, ponto e vírgula ou quebra de
     linha) e derruba duplicata na mesma rodada — convidar duas vezes o mesmo
     e-mail é erro de digitação, não intenção. */
  const commitar = React.useCallback((texto: string) => {
    const partes = texto.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
    if (partes.length === 0) return;
    setConvidados((atual) => {
      const vistos = new Set(atual.map((c) => c.email.toLowerCase()));
      const novos: Convidado[] = [];
      for (const email of partes) {
        if (vistos.has(email.toLowerCase())) continue;
        vistos.add(email.toLowerCase());
        novos.push({ id: proximoId(), email, papel: "closer", valido: EMAIL_VALIDO.test(email) });
      }
      return [...atual, ...novos];
    });
    setRascunho("");
  }, []);

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Enter" || evento.key === "," || evento.key === ";" || evento.key === "Tab") {
      // Tab só vira commit quando há rascunho: senão a pessoa fica presa no
      // campo e não consegue sair do formulário pelo teclado.
      if (!rascunho.trim()) return;
      evento.preventDefault();
      commitar(rascunho);
      return;
    }
    // Backspace com o campo vazio apaga o último chip: é o gesto que todo
    // campo de destinatário de e-mail tem, e a pessoa já vem com ele na mão.
    if (evento.key === "Backspace" && rascunho === "") {
      setConvidados((atual) => atual.slice(0, -1));
    }
  }

  function enviar() {
    if (!podeEnviar) return;
    setEnviando(true);
    window.setTimeout(() => {
      setEnviando(false);
      setEnviado(true);
    }, 700);
  }

  function reabrir(v: boolean) {
    setAberto(v);
    if (!v) setEnviado(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={reabrir}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden />
          Convidar para o workspace
        </Button>
      </DialogTrigger>

      <DialogContent className="of-p-convite">
        <DialogHeader>
          <DialogTitle>Convidar para Callface · Comercial</DialogTitle>
          <DialogDescription>
            Cada convidado entra com um papel. O papel decide o que ele enxerga do funil, não só o
            que ele pode editar.
          </DialogDescription>
        </DialogHeader>

        {enviado ? (
          <div className="of-p-convite-fim" role="status">
            <span className="of-p-convite-fim-marca" aria-hidden><Check /></span>
            <strong>{convidados.length} convite{convidados.length > 1 ? "s" : ""} enviado{convidados.length > 1 ? "s" : ""}</strong>
            <p>Eles aparecem como pendentes em Configurações · Acesso até aceitarem.</p>
          </div>
        ) : (
          <>
            <div className="of-p-campo">
              <Label htmlFor="convite-emails">E-mails</Label>
              {/* O div é o campo visual; o input de verdade fica dentro dele.
                  Clicar em qualquer lugar da caixa foca o input, senão a área
                  dos chips vira um buraco morto. */}
              <div
                className="of-p-chips"
                data-erro={invalidos > 0 ? "true" : undefined}
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) campo.current?.focus();
                }}
              >
                <AnimatePresence initial={false}>
                  {convidados.map((c) => (
                    <motion.span
                      key={c.id}
                      className="of-p-chip"
                      data-invalido={c.valido ? undefined : "true"}
                      initial={reduzido ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                      transition={reduzido ? { duration: 0 } : MOLA.seca}
                      layout={!reduzido}
                    >
                      {c.valido ? null : <AlertCircle aria-hidden />}
                      {c.email}
                      <button
                        type="button"
                        onClick={() => setConvidados((atual) => atual.filter((x) => x.id !== c.id))}
                        aria-label={`Remover ${c.email}`}
                      >
                        <X aria-hidden />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                <input
                  ref={campo}
                  id="convite-emails"
                  className="of-p-chips-entrada"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  value={rascunho}
                  placeholder={convidados.length ? "" : "nome@empresa.com.br"}
                  aria-describedby="convite-ajuda"
                  aria-invalid={invalidos > 0}
                  onChange={(e) => setRascunho(e.target.value)}
                  onKeyDown={aoTeclar}
                  onBlur={() => commitar(rascunho)}
                  onPaste={(e) => {
                    const colado = e.clipboardData.getData("text");
                    if (!/[\s,;]/.test(colado)) return;
                    e.preventDefault();
                    commitar(colado);
                  }}
                />
              </div>
              <p className="of-p-ajuda" id="convite-ajuda">
                {invalidos > 0
                  ? `${invalidos} e-mail${invalidos > 1 ? "s" : ""} fora do formato. Corrija ou remova para enviar.`
                  : "Enter, vírgula ou ponto e vírgula fecham um e-mail. Pode colar a lista inteira de uma vez."}
              </p>
            </div>

            {/* Papel fica numa lista embaixo, não dentro do chip: select
                espremido num pill de 24u não cabe o rótulo "Gestor comercial"
                e a pessoa passa a escolher papel pela primeira letra. */}
            {convidados.some((c) => c.valido) ? (
              <div className="of-p-papeis">
                <p className="of-p-papeis-rotulo">Papel de cada convidado</p>
                {convidados.filter((c) => c.valido).map((c) => (
                  <div className="of-p-papel-linha" key={c.id}>
                    <span title={c.email}>{c.email}</span>
                    <Select
                      value={c.papel}
                      onValueChange={(v) =>
                        setConvidados((atual) =>
                          atual.map((x) => (x.id === c.id ? { ...x, papel: v as Papel } : x)),
                        )
                      }
                    >
                      <SelectTrigger size="sm" aria-label={`Papel de ${c.email}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAPEIS.map((p) => (
                          <SelectItem key={p.valor} value={p.valor}>
                            {p.rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <p className="of-p-ajuda">
                  {PAPEIS.find((p) => p.valor === convidados.find((c) => c.valido)?.papel)?.apoio}
                </p>
              </div>
            ) : null}

            <div className="of-p-campo">
              <Label htmlFor="convite-msg">Mensagem (opcional)</Label>
              <Textarea
                id="convite-msg"
                rows={2}
                value={mensagem}
                placeholder="Entrou pra tocar a carteira de PABX do Sudeste."
                onChange={(e) => setMensagem(e.target.value)}
              />
            </div>

            <DialogFooter className="of-p-convite-rodape">
              <p className="of-p-assentos" data-estouro={estouro > 0 ? "true" : undefined}>
                {estouro > 0 ? (
                  <>
                    <AlertCircle aria-hidden />
                    {estouro} assento{estouro > 1 ? "s" : ""} além do plano. Remova alguém ou amplie o contrato.
                  </>
                ) : (
                  <>
                    {ASSENTOS.ocupados + convidados.length} de {ASSENTOS.contratados} assentos usados
                    {convidados.length ? ` (${convidados.length} neste convite)` : ""}
                  </>
                )}
              </p>
              <Button size="sm" onClick={enviar} disabled={!podeEnviar}>
                {enviando ? <Loader2 className="of-p-girando" aria-hidden /> : <Send aria-hidden />}
                {enviando ? "Enviando" : "Enviar convites"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   02 · Configurações em abas com trilho de auditoria
   ═══════════════════════════════════════════════════════════════════════ */

const FORM_INICIAL = {
  nome: "Mayara Ribeiro",
  cargo: "Closer sênior · Sudeste",
  ramal: "4021",
  lembreteTarefa: true,
  resumoDiario: false,
  alertaNexo: true,
  duploFator: false,
  sessao: "8h",
};

type Formulario = typeof FORM_INICIAL;

const ROTULOS: Record<keyof Formulario, string> = {
  nome: "nome",
  cargo: "cargo",
  ramal: "ramal",
  lembreteTarefa: "lembrete de tarefa",
  resumoDiario: "resumo diário",
  alertaNexo: "alerta do NEXO",
  duploFator: "duplo fator",
  sessao: "expiração de sessão",
};

type Auditoria = { id: string; quem: string; iniciais: string; acao: string; quando: string; novo?: boolean };

const AUDITORIA_INICIAL: Auditoria[] = [
  { id: "au-1", quem: "Kauã Medeiros", iniciais: "KM", acao: "elevou o papel para Closer sênior", quando: "ontem, 18:02" },
  { id: "au-2", quem: "Mayara Ribeiro", iniciais: "MR", acao: "trocou o ramal de 4018 para 4021", quando: "12 set, 09:41" },
  { id: "au-3", quem: "Automação", iniciais: "AU", acao: "desligou o resumo diário por 14 dias sem abertura", quando: "05 set, 03:00" },
  { id: "au-4", quem: "Kauã Medeiros", iniciais: "KM", acao: "liberou acesso ao painel de receita", quando: "28 ago, 11:20" },
];

const SEMANAS = 12;
const DIAS_CURTOS = ["S", "T", "Q", "Q", "S"];

/** Registros por dia nas últimas 12 semanas.
 *
 * Fórmula determinística em vez de Math.random: mapa que muda a cada render
 * não dá para comparar entre builds nem para apontar numa reunião ("olha esse
 * quadradinho aqui" vira outro quadradinho no próximo repaint). */
const ATIVIDADE: number[][] = Array.from({ length: SEMANAS }, (_, s) =>
  Array.from({ length: 5 }, (_, d) => {
    const base = 4 + ((s * 13 + d * 7) % 16);
    return s >= SEMANAS - 3 ? base + 9 : base;
  }),
);
const PICO_ATIVIDADE = Math.max(...ATIVIDADE.flat());
const TOTAL_ATIVIDADE = ATIVIDADE.flat().reduce((a, b) => a + b, 0);

export function ConfiguracoesComAuditoria() {
  const [form, setForm] = React.useState<Formulario>(FORM_INICIAL);
  const [salvo, setSalvo] = React.useState<Formulario>(FORM_INICIAL);
  const [estado, setEstado] = React.useState<"parado" | "salvando" | "salvo">("parado");
  const [trilho, setTrilho] = React.useState<Auditoria[]>(AUDITORIA_INICIAL);
  const [foco, setFoco] = React.useState<{ semana: number; dia: number } | null>(null);
  const reduzido = useReducedMotion() ?? false;

  const alterados = (Object.keys(ROTULOS) as (keyof Formulario)[]).filter((k) => form[k] !== salvo[k]);
  const sujo = alterados.length > 0;

  const trocar = <K extends keyof Formulario>(chave: K, valor: Formulario[K]) =>
    setForm((atual) => ({ ...atual, [chave]: valor }));

  /* Timers presos num ref: sem isso, salvar duas vezes seguidas deixa o botão
     preso em "Salvo" porque o timeout velho ainda vai disparar depois. */
  const timers = React.useRef<number[]>([]);
  React.useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  function salvar() {
    if (!sujo || estado === "salvando") return;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setEstado("salvando");

    const lista = alterados.map((k) => ROTULOS[k]);
    const instantaneo = form;

    timers.current.push(
      window.setTimeout(() => {
        setSalvo(instantaneo);
        setEstado("salvo");
        // O trilho é a prova de que salvou: se a alteração não vira linha de
        // auditoria, ninguém descobre depois quem mexeu no papel de quem.
        setTrilho((atual) => [
          {
            id: `au-${Date.now()}`,
            quem: "Mayara Ribeiro",
            iniciais: "MR",
            acao: `alterou ${listar(lista)}`,
            quando: "agora",
            novo: true,
          },
          ...atual,
        ]);
      }, 700),
      window.setTimeout(() => setEstado("parado"), 2600),
    );
  }

  const intensidadeFoco = foco ? ATIVIDADE[foco.semana][foco.dia] : null;

  return (
    <div className="of-p-config">
      <div className="of-p-config-form">
        <Tabs defaultValue="perfil">
          <TabsList variant="line">
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
            <TabsTrigger value="acesso">Acesso</TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="of-p-aba">
            <div className="of-p-campo">
              <Label htmlFor="cfg-nome">Nome</Label>
              <Input id="cfg-nome" value={form.nome} onChange={(e) => trocar("nome", e.target.value)} />
            </div>
            <div className="of-p-campo">
              <Label htmlFor="cfg-cargo">Cargo</Label>
              <Input id="cfg-cargo" value={form.cargo} onChange={(e) => trocar("cargo", e.target.value)} />
            </div>
            <div className="of-p-campo">
              <Label htmlFor="cfg-ramal">Ramal</Label>
              <Input
                id="cfg-ramal"
                inputMode="numeric"
                value={form.ramal}
                onChange={(e) => trocar("ramal", e.target.value.replace(/\D/g, "").slice(0, 5))}
              />
              <p className="of-p-ajuda">Ramal do PABX. Muda para onde a ligação transferida cai.</p>
            </div>
          </TabsContent>

          <TabsContent value="notificacoes" className="of-p-aba">
            <LinhaChave
              id="cfg-lembrete"
              titulo="Lembrete de tarefa"
              apoio="Avisa 15 minutos antes de cada tarefa agendada no negócio."
              valor={form.lembreteTarefa}
              aoMudar={(v) => trocar("lembreteTarefa", v)}
            />
            <LinhaChave
              id="cfg-resumo"
              titulo="Resumo diário"
              apoio="Um e-mail às 7h com o que venceu e o que vence hoje."
              valor={form.resumoDiario}
              aoMudar={(v) => trocar("resumoDiario", v)}
            />
            <LinhaChave
              id="cfg-nexo"
              titulo="Alerta do NEXO"
              apoio="Só quando o NEXO encontra risco de perda num negócio seu."
              valor={form.alertaNexo}
              aoMudar={(v) => trocar("alertaNexo", v)}
            />
          </TabsContent>

          <TabsContent value="acesso" className="of-p-aba">
            <LinhaChave
              id="cfg-2fa"
              titulo="Duplo fator"
              apoio="Código no app autenticador a cada login em dispositivo novo."
              valor={form.duploFator}
              aoMudar={(v) => trocar("duploFator", v)}
            />
            <div className="of-p-campo">
              <Label htmlFor="cfg-sessao">Expirar sessão após</Label>
              <Select value={form.sessao} onValueChange={(v) => trocar("sessao", v)}>
                <SelectTrigger id="cfg-sessao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hora</SelectItem>
                  <SelectItem value="8h">8 horas (um turno)</SelectItem>
                  <SelectItem value="30d">30 dias</SelectItem>
                </SelectContent>
              </Select>
              <p className="of-p-ajuda">Vale para a web. O softphone mantém a própria sessão.</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="of-p-config-rodape">
          <p className="of-p-ajuda" role="status">
            {estado === "salvando"
              ? "Salvando…"
              : estado === "salvo"
                ? "Salvo. A alteração entrou no trilho ao lado."
                : sujo
                  ? `${alterados.length} alteração${alterados.length > 1 ? "ões" : ""} sem salvar: ${listar(alterados.map((k) => ROTULOS[k]))}.`
                  : "Nada alterado."}
          </p>
          <div className="ds-linha">
            <Button variant="outline" size="sm" onClick={() => setForm(salvo)} disabled={!sujo || estado === "salvando"}>
              Descartar
            </Button>
            <Button size="sm" onClick={salvar} disabled={!sujo || estado === "salvando"}>
              {estado === "salvando" ? <Loader2 className="of-p-girando" aria-hidden /> : null}
              {estado === "salvo" ? <Check aria-hidden /> : null}
              {estado === "salvando" ? "Salvando" : estado === "salvo" ? "Salvo" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </div>

      {/* O trilho não é sidebar decorativa: ele fica grudado no formulário
          porque a pergunta "quem mexeu nisso" nasce olhando para o campo. */}
      <aside className="of-p-trilho" aria-label="Trilho de auditoria e atividade">
        <section>
          <h4 className="of-p-trilho-titulo">Trilho de auditoria</h4>
          <ol className="of-p-trilho-lista">
            <AnimatePresence initial={false}>
              {trilho.slice(0, 6).map((item) => (
                <motion.li
                  key={item.id}
                  data-novo={item.novo ? "true" : undefined}
                  initial={reduzido ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduzido ? { duration: 0 } : { duration: DURACAO.base }}
                  layout={!reduzido}
                >
                  <span className="of-p-trilho-marca" aria-hidden>{item.iniciais}</span>
                  <div>
                    <p><strong>{item.quem}</strong> {item.acao}</p>
                    <time>{item.quando}</time>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </section>

        <section>
          <h4 className="of-p-trilho-titulo">Atividade · 12 semanas</h4>
          {/* Mesma técnica do MapaDeContato: uma cor só, intensidade por
              color-mix. Duas cores num mapa de calor viram duas leituras e a
              pessoa passa a decorar legenda em vez de ler a mancha. */}
          <div className="of-p-heat" style={{ gridTemplateColumns: `repeat(${SEMANAS}, minmax(0, 1fr))` }}>
            {ATIVIDADE.map((semana, s) => (
              <div className="of-p-heat-coluna" key={`sem-${s}`}>
                {semana.map((valor, d) => (
                  <button
                    type="button"
                    key={`${s}-${d}`}
                    className="of-p-heat-celula"
                    style={{ "--intensidade": (valor / PICO_ATIVIDADE).toFixed(2) } as React.CSSProperties}
                    data-foco={foco?.semana === s && foco?.dia === d ? "true" : undefined}
                    onMouseEnter={() => setFoco({ semana: s, dia: d })}
                    onFocus={() => setFoco({ semana: s, dia: d })}
                    onMouseLeave={() => setFoco(null)}
                    onBlur={() => setFoco(null)}
                    aria-label={`${DIAS_CURTOS[d]}, semana ${s + 1}: ${valor} registros`}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="of-p-ajuda" role="status">
            {foco
              ? `Semana ${foco.semana + 1} · ${intensidadeFoco} registros no dia`
              : `${TOTAL_ATIVIDADE} registros no trimestre · pico de ${PICO_ATIVIDADE} num dia`}
          </p>
        </section>
      </aside>
    </div>
  );
}

function LinhaChave({
  id, titulo, apoio, valor, aoMudar,
}: { id: string; titulo: string; apoio: string; valor: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <div className="of-p-linha-chave">
      <div>
        <Label htmlFor={id}>{titulo}</Label>
        <p className="of-p-ajuda">{apoio}</p>
      </div>
      <Switch id={id} checked={valor} onCheckedChange={aoMudar} />
    </div>
  );
}

/** "a, b e c" — enumeração em português. Vírgula antes do último item é
 *  inglês e some no meio de uma frase corrida. */
function listar(itens: string[]) {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/* ════════════════════════════════════════════════════════════════════════
   03 · Changelog
   ═══════════════════════════════════════════════════════════════════════ */

type TipoEntrada = "novidade" | "melhoria" | "correcao";
type Impacto = "alto" | "medio" | "baixo";

const TIPOS: Record<TipoEntrada, { rotulo: string; icone: React.ComponentType<{ "aria-hidden"?: boolean }> }> = {
  novidade: { rotulo: "Novidade", icone: Sparkles },
  melhoria: { rotulo: "Melhoria", icone: Wrench },
  correcao: { rotulo: "Correção", icone: Bug },
};

type EntradaChangelog = {
  id: string;
  versao: string;
  data: string;
  dataCompleta: string;
  tipo: TipoEntrada;
  impacto: Impacto;
  titulo: string;
  itens: string[];
};

const CHANGELOG: EntradaChangelog[] = [
  {
    id: "v-2-9",
    versao: "2.9",
    data: "16 set",
    dataCompleta: "16 de setembro de 2026",
    tipo: "novidade",
    impacto: "alto",
    titulo: "NEXO sugere desconto com base em negócios parecidos",
    itens: [
      "A sugestão aparece na proposta, antes do envio, não no relatório do mês seguinte.",
      "Só considera negócios fechados nos últimos 90 dias do mesmo produto.",
    ],
  },
  {
    id: "v-2-8",
    versao: "2.8",
    data: "09 set",
    dataCompleta: "9 de setembro de 2026",
    tipo: "melhoria",
    impacto: "medio",
    titulo: "Quadro carrega a carteira inteira sem paginar",
    itens: [
      "Colunas com mais de 200 negócios passaram a montar em uma passada só.",
      "Arrastar entre etapas mantém a ordem manual da coluna de destino.",
    ],
  },
  {
    id: "v-2-7-1",
    versao: "2.7.1",
    data: "02 set",
    dataCompleta: "2 de setembro de 2026",
    tipo: "correcao",
    impacto: "alto",
    titulo: "Lead do Meta Ads sem telefone não engole mais o lead anterior",
    itens: [
      "A deduplicação por telefone ignorava o campo vazio e casava dois leads diferentes.",
      "Os 41 leads afetados foram religados ao negócio certo, sem tocar no updated_at.",
    ],
  },
  {
    id: "v-2-7",
    versao: "2.7",
    data: "26 ago",
    dataCompleta: "26 de agosto de 2026",
    tipo: "novidade",
    impacto: "medio",
    titulo: "Transferência de ligação direto do registro do negócio",
    itens: ["Discagem e transferência entre ramais sem sair da tela do negócio."],
  },
  {
    id: "v-2-6",
    versao: "2.6",
    data: "19 ago",
    dataCompleta: "19 de agosto de 2026",
    tipo: "melhoria",
    impacto: "baixo",
    titulo: "Etiqueta de origem passou a caber em uma linha",
    itens: ["\"Inbound site\" e \"Base ativa\" quebravam o cartão do quadro em telas de 13\"."],
  },
];

export function Changelog() {
  const [filtro, setFiltro] = React.useState<TipoEntrada | "tudo">("tudo");
  const reduzido = useReducedMotion() ?? false;
  const visiveis = CHANGELOG.filter((e) => filtro === "tudo" || e.tipo === filtro);

  return (
    <div className="of-p-changelog">
      <div className="ds-linha" role="group" aria-label="Filtrar por tipo">
        {(["tudo", "novidade", "melhoria", "correcao"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="ds-chip-filtro"
            data-ativo={filtro === t ? "true" : undefined}
            aria-pressed={filtro === t}
            onClick={() => setFiltro(t)}
          >
            {t === "tudo" ? "Tudo" : TIPOS[t].rotulo}
          </button>
        ))}
      </div>

      <ol className="of-p-cl-lista">
        {visiveis.map((e) => {
          const Icone = TIPOS[e.tipo].icone;
          return (
            <motion.li
              key={e.id}
              className="of-p-cl-item"
              initial={reduzido ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduzido ? { duration: 0 } : { duration: DURACAO.base }}
              layout={!reduzido}
            >
              {/* Trilho de data à esquerda: o eixo deste componente é a
                  RELEASE. Por isso a data é coluna própria e alinha entre as
                  entradas — dá para varrer "o que saiu em setembro" de cima a
                  baixo sem ler nenhum título. */}
              <div className="of-p-cl-trilho">
                <time dateTime={e.dataCompleta} title={e.dataCompleta}>{e.data}</time>
                <span className="of-p-cl-versao">v{e.versao}</span>
                <span className="of-p-cl-ponto" aria-hidden />
              </div>

              <div className="of-p-cl-corpo">
                <div className="of-p-cl-badges">
                  <span className="of-p-cl-tipo" data-tipo={e.tipo}>
                    <Icone aria-hidden />
                    {TIPOS[e.tipo].rotulo}
                  </span>
                  <span className="of-p-cl-impacto" data-impacto={e.impacto}>
                    Impacto {e.impacto === "medio" ? "médio" : e.impacto}
                  </span>
                </div>
                <h4>{e.titulo}</h4>
                <ul>
                  {e.itens.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {visiveis.length === 0 ? (
        <p className="of-p-ajuda">Nenhuma entrada desse tipo nas últimas cinco versões.</p>
      ) : null}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   04 · Tela de entrada
   ═══════════════════════════════════════════════════════════════════════ */

/** Credencial só para a demo do laboratório funcionar de ponta a ponta:
 *  qualquer senha diferente de "callface" cai no estado de erro. Não existe
 *  autenticação de verdade aqui, e nenhum dado desta tela sai do componente. */
const SENHA_DEMO = "callface";

export function TelaDeEntrada() {
  const [email, setEmail] = React.useState("mayara.ribeiro@callface.io");
  const [senha, setSenha] = React.useState("");
  const [vendo, setVendo] = React.useState(false);
  const [estado, setEstado] = React.useState<"parado" | "entrando" | "erro" | "dentro">("parado");
  const erro = React.useRef<HTMLParagraphElement>(null);
  const timer = React.useRef<number | null>(null);

  React.useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    if (estado === "entrando") return;
    setEstado("entrando");
    timer.current = window.setTimeout(() => {
      setEstado(senha === SENHA_DEMO ? "dentro" : "erro");
    }, 800);
  }

  /* Erro mandado para o leitor de tela via role="alert" no elemento, e o foco
     volta para a senha: quem errou precisa digitar de novo, não caçar o campo. */
  const campoSenha = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (estado === "erro") campoSenha.current?.focus();
  }, [estado]);

  return (
    <div className="of-p-entrada">
      <div className="of-p-entrada-form">
        <div className="of-p-entrada-marca">
          <span className="of-p-entrada-ponto" aria-hidden />
          Callface
        </div>

        <h3>Entrar na operação</h3>
        <p className="of-p-ajuda">Use o e-mail corporativo. O acesso é o mesmo do softphone.</p>

        <form onSubmit={entrar} noValidate>
          <div className="of-p-campo">
            <Label htmlFor="ent-email">E-mail</Label>
            <div className="of-p-entrada-campo">
              <Mail aria-hidden />
              <Input
                id="ent-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (estado === "erro") setEstado("parado"); }}
              />
            </div>
          </div>

          <div className="of-p-campo">
            <Label htmlFor="ent-senha">Senha</Label>
            <div className="of-p-entrada-campo">
              <Lock aria-hidden />
              <Input
                id="ent-senha"
                ref={campoSenha}
                type={vendo ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={estado === "erro"}
                aria-describedby={estado === "erro" ? "ent-erro" : undefined}
                value={senha}
                onChange={(e) => { setSenha(e.target.value); if (estado === "erro") setEstado("parado"); }}
              />
              <button
                type="button"
                className="of-p-entrada-olho"
                onClick={() => setVendo((v) => !v)}
                aria-label={vendo ? "Ocultar senha" : "Mostrar senha"}
              >
                {vendo ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              </button>
            </div>
          </div>

          {estado === "erro" ? (
            <p className="of-p-entrada-erro" id="ent-erro" role="alert" ref={erro}>
              <AlertCircle aria-hidden />
              E-mail ou senha não conferem. Restam 4 tentativas antes do bloqueio temporário.
            </p>
          ) : null}

          {estado === "dentro" ? (
            <p className="of-p-entrada-ok" role="status">
              <Check aria-hidden />
              Autenticado. Levando para o funil.
            </p>
          ) : null}

          <Button type="submit" fillWidth disabled={estado === "entrando" || !email || !senha}>
            {estado === "entrando" ? <Loader2 className="of-p-girando" aria-hidden /> : null}
            {estado === "entrando" ? "Entrando" : "Entrar"}
            {estado === "entrando" ? null : <ArrowRight aria-hidden />}
          </Button>

          <p className="of-p-ajuda of-p-entrada-dica">
            Demo do laboratório: a senha que entra é <code>callface</code>. Qualquer outra mostra o
            estado de erro.
          </p>
        </form>
      </div>

      {/* Painel de marca. Ele NÃO carrega depoimento: número de cliente e
          citação de pessoa real são dado que precisa de origem verificada, e
          inventar um para preencher o espaço é exatamente o que a tela de
          login de SaaS faz e ninguém acredita. Enquanto não houver dado
          auditado, o painel carrega a promessa do produto, que é verdadeira
          por construção. */}
      <aside className="of-p-entrada-marca-painel" data-onface-superficie="escura">
        <FundoGrafico variante="conexoes" superficie="escura" halo />
        <div className="of-p-entrada-painel-conteudo">
          <p className="of-p-entrada-painel-rotulo">Callface</p>
          <h3>Do achismo ao dado.</h3>
          <p className="of-p-entrada-painel-apoio">
            Telefonia, CRM e IA na mesma operação. Toda ligação vira registro, todo registro vira
            funil, e o funil responde por que o negócio andou ou parou.
          </p>
          <ul className="of-p-entrada-painel-lista">
            <li><Check aria-hidden /> A ligação entra no negócio sozinha, com gravação e resumo.</li>
            <li><Check aria-hidden /> O NEXO lê a carteira e aponta o que está prestes a esfriar.</li>
            <li><Check aria-hidden /> Um funil só: marketing, pré-venda e venda leem o mesmo número.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
