"use client";

import { Fragment, useRef, useState } from "react";
import { periodoDoItem, PERIODOS_EM_ORDEM, ROTULO_PERIODO, SUFIXO_PERIODO, totaisPorPeriodo, type PeriodoDeCobranca } from "@/lib/crm/periodo-cobranca";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, FileSignature, CreditCard, CheckCircle2, AlertTriangle, Download, ShieldCheck, Loader2, Mail } from "lucide-react";
import { conteudoDasFamilias } from "@/lib/propostas/conteudo-familia";
import { rotuloDaRecorrencia } from "@/lib/catalogo/rotulos";
import "./publico.css";

/**
 * Página pública da proposta — o documento que o CLIENTE da Callface abre.
 *
 * Redesenho ONFACE (01/10): é a pré-visualização do compositor
 * (`OnFace Proposta.dc.html`) viva — fio coral no topo, cabeçalho com número
 * e validade, "Escopo e investimento" na tabela de cabeça grafite, resumo
 * financeiro com o valor no bloco escuro e a decisão num único bloco com
 * contorno. Antes era o gradiente carmim→roxo do CRM 1, que não conversava
 * com nada do produto novo.
 *
 * O comportamento é o mesmo de antes: aceitar/recusar/pedir ajuste, um card
 * de próximo passo por grupo comercial depois do aceite (venda mista tem
 * contrato e pagamento independentes — seção 15 do briefing) e polling de 8s
 * porque assinatura e pagamento confirmam por webhook a qualquer momento.
 */

interface Item { id: string; nome: string; descricao: string | null; tipo: string; periodo?: string | null; quantidade: string; valorUnitario: string; subtotal: string; commercialModel: string }
interface Grupo {
  id: string;
  commercialModel: string;
  status: string;
  itens: Item[];
  contrato: { id: string; corpoGerado: string | null; assinaturaStatus: string; signatureStatus: string | null; status: string; signingUrl?: string | null; assinaturaExterna?: boolean } | null;
  checkoutUrl: string | null;
  pagamentoEstado: "aberto" | "pago" | "boleto_pendente" | "indisponivel" | null;
  /** O fechamento deste grupo parou com erro — o time já foi avisado. */
  fechamentoTravado?: boolean;
}
interface PropostaPublicaData {
  id: string; numero: number; versao: number; status: string; moeda: string;
  dataValidade: string | null; dataEmissao: string | null; condicoesPagamento: string | null;
  totalRecorrente: string; totalAvulso: string; totalGeral: string;
  motivoRecusa: string | null; clienteRespondeuEm: string | null;
  clienteNome: string | null; clienteCargo: string | null;
  empresa: string | null; empresaCnpj: string | null; negocioTitulo: string | null;
  condicaoPagamentoTipo: string | null; parcelas: number | null; prazoContratoMeses: number | null;
  itens: Item[]; grupos: Grupo[];
  /** Apresentação: as famílias dos itens escolhem o conteúdo (PABX, Callface AI, White Label) na MESMA estrutura. */
  familias?: string[]; trialDias?: number | null; reajusteIndice?: string | null;
  responsavelNome?: string | null; responsavelEmail?: string | null;
}

const brl = (v: string | number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Data do banco (`2026-10-31` ou ISO) em dd/mm/aaaa sem escorregar de fuso. */
function data(v: string | null): string | null {
  if (!v) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
}

/** Os mesmos de `STATUS_PROPOSTA_VIGENTE` (lib/vendas/dominio) e do aceite público. */
const STATUS_VIGENTE = ["enviada", "visualizada", "ajuste_solicitado"];

const CONDICAO_LABEL: Record<string, string> = {
  cartao: "Cartão",
  boleto: "Boleto à vista",
  boleto_parcelado: "Parcelado",
  outro: "A combinar",
};

/** Título da seção de cada período na tabela, e rótulo da linha no resumo. */
const TITULO_PERIODO: Record<PeriodoDeCobranca, string> = {
  mensal: "Mensalidade", trimestral: "Cobrança trimestral", semestral: "Cobrança semestral", anual: "Anuidade", unico: "Implantação e itens únicos",
};
const RESUMO_PERIODO: Record<PeriodoDeCobranca, string> = {
  mensal: "Mensalidade", trimestral: "Cobrança trimestral", semestral: "Cobrança semestral", anual: "Anuidade", unico: "Setup e itens únicos",
};

/** CNPJ só é formatado quando tem os 14 dígitos; senão vai como veio. */
function formatarCnpj(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Cada etapa do pós-aceite (contrato/assinatura/pagamento) tem um sinal
// próprio — status nunca só por cor: o rótulo vai junto.
type Tom = "neutro" | "atencao" | "ok" | "risco";
const GRUPO_STATUS: Record<string, { texto: string; tom: Tom }> = {
  aguardando_contrato: { texto: "Contrato sendo preparado", tom: "neutro" },
  contrato_enviado_assinatura: { texto: "Aguardando sua assinatura", tom: "atencao" },
  contrato_assinado: { texto: "Contrato assinado", tom: "ok" },
  aguardando_checkout: { texto: "Preparando pagamento", tom: "neutro" },
  checkout_gerado: { texto: "Aguardando pagamento", tom: "atencao" },
  pagamento_pendente: { texto: "Pagamento em processamento", tom: "atencao" },
  pago: { texto: "Pago", tom: "ok" },
  concluido: { texto: "Concluído", tom: "ok" },
  falhou: { texto: "Pagamento não confirmado", tom: "risco" },
};

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <main className="pp-tela">
      <div className="pp-coluna">
        {children}
        <p className="pp-selo"><ShieldCheck size={13} aria-hidden /> Proposta emitida pela Callface · link pessoal, não compartilhe</p>
      </div>
    </main>
  );
}

function Marca() {
  return (
    <div className="pp-marca">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/proto/callface-logo.png" alt="Callface" />
      <span>Telefonia em nuvem, IA e discagem</span>
    </div>
  );
}

function Aviso({ tom, children }: { tom: "erro" | "ok" | "neutro"; children: React.ReactNode }) {
  const Icone = tom === "ok" ? CheckCircle2 : tom === "erro" ? AlertTriangle : Clock;
  return (
    <div className={`pp-aviso pp-aviso-${tom}`} role={tom === "erro" ? "alert" : "status"}>
      <Icone size={15} aria-hidden /> <span>{children}</span>
    </div>
  );
}

function EstadoUnico({ titulo, corpo, tom = "neutro" }: { titulo: string; corpo: string; tom?: "ok" | "erro" | "neutro" }) {
  const Icone = tom === "ok" ? CheckCircle2 : tom === "erro" ? AlertTriangle : Clock;
  const cor = tom === "ok" ? "pp-status-ok" : tom === "erro" ? "pp-status-risco" : "pp-status-neutro";
  return (
    <Tela>
      <article className="pp-doc">
        <div className="pp-doc-corpo">
          <Marca />
          <div className="pp-estado" style={{ padding: 0 }}>
            <span className={`pp-estado-icone ${cor}`}><Icone size={18} aria-hidden /></span>
            <h1>{titulo}</h1>
            <p>{corpo}</p>
          </div>
        </div>
      </article>
    </Tela>
  );
}

function Carregando() {
  return (
    <Tela>
      <article className="pp-doc" aria-busy="true" aria-label="Carregando proposta">
        <div className="pp-doc-corpo">
          <Marca />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="pp-esqueleto" style={{ width: 120, height: 10 }} />
            <div className="pp-esqueleto" style={{ width: "62%", height: 28 }} />
            <div className="pp-esqueleto" style={{ width: "38%", height: 12 }} />
          </div>
          <div className="pp-esqueleto" style={{ height: 160, borderRadius: 10 }} />
          <div className="pp-esqueleto" style={{ height: 96, borderRadius: 10 }} />
        </div>
      </article>
    </Tela>
  );
}

function SecaoTitulo({ n, children }: { n: string; children: React.ReactNode }) {
  return <div className="pp-secao-titulo"><span>{n}</span><h2>{children}</h2></div>;
}

function ItemLinha({ item }: { item: Item }) {
  // O mesmo período do agrupamento e do resumo: o do Price. Locação de hardware é cobrada todo mês mesmo não sendo "recorrente" no tipo.
  const { periodo } = periodoDoItem(item);
  const suf = SUFIXO_PERIODO[periodo];
  const qtd = Number(item.quantidade || 1);
  // Itens do catálogo trazem os recursos numa string só, separados por ";" ou quebra de linha (o PDF faz o mesmo).
  const recursos = (item.descricao || "").split(/;\s*|\r?\n/).map((l) => l.trim()).filter(Boolean);
  return (
    <div className="pp-item">
      <div className="pp-item-nome">
        <strong>{item.nome}</strong>
        {recursos.length > 1 ? (
          <ul className="pp-item-lista">{recursos.map((r, i) => <li key={i}>{r}</li>)}</ul>
        ) : item.descricao ? <small>{item.descricao}</small> : null}
      </div>
      <div className="pp-item-valor">
        <strong>{brl(item.subtotal)}{suf}</strong>
        <small>{qtd.toLocaleString("pt-BR")} × {brl(item.valorUnitario)} · {periodo === "unico" ? rotuloDaRecorrencia(item.tipo, item.periodo) : `Cobrança ${ROTULO_PERIODO[periodo].toLowerCase()}`}</small>
      </div>
    </div>
  );
}

/** Um card de "próximo passo" por GRUPO COMERCIAL — venda mista tem requirements independentes (seção 15 do briefing). */
function GrupoCard({ grupo, id, onAssinado }: { grupo: Grupo; id: string; onAssinado: () => void }) {
  const [nomeAssinatura, setNomeAssinatura] = useState("");
  const status = GRUPO_STATUS[grupo.status] || { texto: "Em andamento", tom: "neutro" as Tom };
  const titulo = grupo.itens.map((i) => i.nome).join(" + ") || "Composição";

  const assinar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/assinar-publico`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeCompleto: nomeAssinatura, contratoId: grupo.contrato?.id }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Não conseguimos registrar a assinatura. Tente de novo em instantes.");
      return body;
    },
    onSuccess: onAssinado,
  });

  return (
    <div className="pp-passo" id={`grupo-${grupo.id}`}>
      <div className="pp-passo-topo">
        <strong>{titulo}</strong>
        <span className={`pp-status pp-status-${status.tom}`}>{status.texto}</span>
      </div>

      {grupo.status === "contrato_enviado_assinatura" && grupo.contrato && (
        grupo.contrato.signingUrl ? (
          <a href={grupo.contrato.signingUrl} target="_blank" rel="noreferrer" className="pp-btn pp-btn-primario pp-btn-largo">
            <FileSignature size={15} aria-hidden /> Ler e assinar contrato
          </a>
        ) : grupo.contrato.assinaturaExterna ? (
          /* Sob Documenso a assinatura é por link externo. Enquanto a signingUrl
             não chega, mostramos "preparando" — NUNCA o formulário de aceite
             simples abaixo, que sob Documenso falharia no envio. Mas quando o
             fechamento travou de verdade, "em instantes" vira mentira do mesmo
             jeito que virava no pagamento: o link não vem sozinho. */
          grupo.fechamentoTravado ? (
            <Aviso tom="neutro">Recebemos o seu aceite. O contrato precisa de um ajuste do nosso time antes de ir para assinatura — já avisamos quem cuida da sua conta e você será procurado em breve.</Aviso>
          ) : (
            <Aviso tom="neutro">Estamos preparando seu link de assinatura. Recarregue esta página em instantes para assinar o contrato.</Aviso>
          )
        ) : (
          <>
            {grupo.contrato.corpoGerado && (
              <div className="pp-contrato">
                <div className="pp-contrato-cabeca">
                  <span className="pp-rotulo">Contrato de prestação de serviços</span>
                  <FileSignature size={14} aria-hidden />
                </div>
                <div className="pp-contrato-corpo" tabIndex={0} aria-label="Texto do contrato">
                  {grupo.contrato.corpoGerado.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((linha, i) => {
                    const dp = linha.indexOf(":");
                    const rotulo = dp > 0 && dp < 24 ? linha.slice(0, dp) : null;
                    return <p key={i}>{rotulo && <b>{rotulo}: </b>}{rotulo ? linha.slice(dp + 1).trim() : linha}</p>;
                  })}
                </div>
              </div>
            )}
            <label htmlFor={`assinatura-${grupo.id}`} style={{ fontSize: 12.5, color: "var(--of-tinta-3)" }}>
              Digite seu nome completo para assinar. Isso registra um aceite eletrônico simples (não é assinatura com certificado digital).
            </label>
            <input
              id={`assinatura-${grupo.id}`} className="pp-campo" autoComplete="name"
              value={nomeAssinatura} onChange={(e) => setNomeAssinatura(e.target.value)} placeholder="Nome completo"
            />
            <button
              type="button" className="pp-btn pp-btn-primario pp-btn-largo"
              onClick={() => assinar.mutate()} disabled={!nomeAssinatura.trim() || assinar.isPending}
            >
              {assinar.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Check size={15} aria-hidden />}
              {assinar.isPending ? "Registrando…" : "Concordo e assino eletronicamente"}
            </button>
            {assinar.isError && <Aviso tom="erro">{(assinar.error as Error).message}</Aviso>}
          </>
        )
      )}

      {grupo.status === "aguardando_contrato" && (
        <Aviso tom="neutro">Recebemos o seu aceite. O contrato está sendo preparado e você o receberá por e-mail para assinar. Esta página atualiza sozinha.</Aviso>
      )}

      {(grupo.status === "aguardando_checkout" || grupo.status === "checkout_gerado") && (
        grupo.pagamentoEstado === "boleto_pendente" ? (
          <Aviso tom="neutro">Pagamento em andamento — aguardando compensação (boleto: até 1 dia útil; Pix: confirma em instantes após o pagamento no app do banco).</Aviso>
        ) : grupo.pagamentoEstado === "indisponivel" ? (
          <Aviso tom="erro">Não conseguimos gerar o link de pagamento agora. Fale com quem te enviou a proposta.</Aviso>
        ) : grupo.checkoutUrl ? (
          <>
            <a href={grupo.checkoutUrl} className="pp-btn pp-btn-primario pp-btn-largo">
              <CreditCard size={15} aria-hidden /> Ir para o pagamento seguro
            </a>
            <Aviso tom="neutro">
              {grupo.itens.some((i) => i.tipo === "recorrente")
                ? "Pagamento por cartão ou boleto. Pix não está disponível para cobrança recorrente."
                : "Pague por Pix, cartão ou boleto. O QR code do Pix vale 24 horas."}
            </Aviso>
          </>
        ) : grupo.fechamentoTravado ? (
          /* "Preparando…" aqui era mentira: o fechamento parou com erro e a
             página seguia prometendo um link que não ia chegar — um cliente
             ficou um dia inteiro olhando isso. Travou, o cliente merece saber
             que o aceite entrou e que alguém vai procurá-lo. */
          <Aviso tom="neutro">Recebemos o seu aceite. Este pedido precisa de um ajuste do nosso time antes do pagamento — já avisamos quem cuida da sua conta e você será procurado em breve. Não é necessário aceitar de novo.</Aviso>
        ) : (
          <Aviso tom="neutro">Preparando o link de pagamento…</Aviso>
        )
      )}

      {(grupo.status === "pago" || grupo.status === "concluido") && (
        <Aviso tom="ok">Pagamento confirmado — obrigado!</Aviso>
      )}
      {grupo.status === "falhou" && (
        <Aviso tom="erro">Não conseguimos confirmar o pagamento. Fale com quem te enviou a proposta para gerar um novo link.</Aviso>
      )}
    </div>
  );
}

export function PropostaPublica({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [painel, setPainel] = useState<"decisao" | "ajuste" | "recusa">("decisao");
  const [ajusteMsg, setAjusteMsg] = useState("");
  const [ajusteEnviado, setAjusteEnviado] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const jaAbriu = useRef(false);

  const { data: p, isLoading, error } = useQuery<PropostaPublicaData>({
    queryKey: ["proposta-publica", id],
    queryFn: async () => {
      // Só a primeira leitura é uma visita. O refetch de 8s e o refresh pós-ação
      // vão com ?acompanhar=1 e não contam: cada poll gravava um ProposalOpened e
      // inflava `visualizacoes` enquanto o cliente deixava a aba aberta.
      const acompanhar = jaAbriu.current;
      jaAbriu.current = true;
      const r = await fetch(`/api/propostas/${id}/publica${acompanhar ? "?acompanhar=1" : ""}`);
      if (!r.ok) throw new Error("not-found");
      return r.json();
    },
    retry: false,
    refetchInterval: 8000, // pagamento/assinatura pode confirmar via webhook a qualquer momento — sem isso o cliente fica olhando pra tela parada
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["proposta-publica", id] });

  const aceitar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/aceitar-publico`, { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Não conseguimos registrar o aceite. Tente de novo em instantes.");
      return body;
    },
    onSuccess: (body) => {
      // O aceite foi gravado, mas um grupo pode não ter andado (`erro`): contrato que não pôde ser gerado ou
      // enviado, checkout que não saiu. Nesse caso NÃO navegamos para um link que não existe; a tela diz ao
      // cliente que recebeu o aceite e o que esperar (ver `pendenciaDoAceite`), e o time é avisado no servidor.
      type G = { checkoutId?: string; grupoId?: string; proximoPasso?: string; proximoUrl?: string; erro?: string };
      const primeiroPagamento = body?.grupos?.find((grupo: G) => grupo.checkoutId && !grupo.erro);
      const primeiroContrato = body?.grupos?.find((grupo: G) => grupo.proximoPasso === "contrato" && !grupo.erro);
      if (primeiroPagamento?.checkoutId) {
        window.location.assign(`/checkout/${primeiroPagamento.checkoutId}`);
        return;
      }
      if (primeiroContrato?.grupoId) {
        window.location.assign(primeiroContrato.proximoUrl || `/p/${id}#grupo-${primeiroContrato.grupoId}`);
        return;
      }
      invalidar();
    },
  });

  /** O aceite entrou, mas o próximo passo (contrato ou pagamento) de algum grupo não saiu agora. */
  const pendenciaDoAceite = Boolean((aceitar.data as { grupos?: Array<{ erro?: string }> } | undefined)?.grupos?.some((g) => g.erro));

  const recusar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/recusar-publico`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: recusaMotivo || undefined }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Não conseguimos registrar a recusa. Tente de novo em instantes.");
      return body;
    },
    onSuccess: invalidar,
  });

  const solicitarAjuste = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/ajuste-publico`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensagem: ajusteMsg }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Não conseguimos enviar o pedido. Tente de novo em instantes.");
      return body;
    },
    onSuccess: () => setAjusteEnviado(true),
  });

  if (isLoading) return <Carregando />;
  if (error || !p) {
    return <EstadoUnico tom="erro" titulo="Proposta não encontrada" corpo="Confira se o link chegou completo ou fale com quem te enviou a proposta na Callface." />;
  }

  const numeroFmt = `P-${String(p.numero).padStart(3, "0")}-v${p.versao}`;
  // "Não especificar" (tipo nulo) não vira texto nenhum — o cliente escolhe no próprio checkout.
  const condicaoPagamentoTexto = p.condicaoPagamentoTipo
    ? p.condicaoPagamentoTipo === "boleto_parcelado" && p.parcelas && p.parcelas > 1
      ? `Parcelado em ${p.parcelas}x`
      : CONDICAO_LABEL[p.condicaoPagamentoTipo] || p.condicaoPagamentoTipo
    : null;

  const validadeVencida = p.dataValidade ? new Date(`${p.dataValidade.slice(0, 10)}T23:59:59`) < new Date() : false;
  const validaAte = data(p.dataValidade);
  const emitidaEm = data(p.dataEmissao);

  // `visualizada` é vigente: o primeiro GET desta própria página muda o status
  // para ela. Antes a lista não tinha `visualizada` e os botões de decisão
  // sumiam no refetch de 8s — o cliente abria e não conseguia aceitar.
  const vigente = STATUS_VIGENTE.includes(p.status);
  if (p.status === "expirada" || (vigente && validadeVencida)) {
    return <EstadoUnico tom="erro" titulo="Este link de proposta expirou" corpo="O prazo de validade dessa proposta passou. Fale com quem te enviou a proposta na Callface para receber uma versão atualizada." />;
  }
  if (p.status === "rascunho") {
    return <EstadoUnico titulo="Esta proposta ainda não foi enviada" corpo="O time da Callface ainda está preparando este documento. Quando ele for enviado, este mesmo link mostra a proposta completa." />;
  }
  if (p.status === "substituida") {
    return <EstadoUnico titulo="Esta proposta foi atualizada" corpo="Existe uma versão mais nova desta proposta. Peça o link atualizado a quem te enviou na Callface." />;
  }
  if (p.status === "recusada") {
    return (
      <EstadoUnico
        titulo="Proposta recusada"
        corpo={`Você recusou a proposta ${numeroFmt}. Nosso time vai entrar em contato para entender melhor e combinar os próximos passos.${p.motivoRecusa ? ` Motivo informado: “${p.motivoRecusa}”.` : ""}`}
      />
    );
  }

  const todosGruposConcluidos = p.grupos.length > 0 && p.grupos.every((g) => g.status === "concluido" || g.status === "pago");
  const aindaNaoAceitou = vigente;
  // Cada linha no seu período de cobrança (o do Price): mensalidade, anuidade e itens únicos
  // nunca viram um número só, e anuidade nunca leva "/mês".
  const doPeriodo = (per: PeriodoDeCobranca) => p.itens.filter((i) => periodoDoItem(i).periodo === per);
  const tot = totaisPorPeriodo(p.itens);
  const periodosComValor = PERIODOS_EM_ORDEM.filter((per) => tot[per] > 0);

  const conteudo = conteudoDasFamilias(p.familias);
  const titulo = p.empresa || p.clienteNome || "Proposta comercial";
  const sub = p.negocioTitulo && p.negocioTitulo !== titulo ? p.negocioTitulo : null;

  const meta: Array<[string, string]> = [["Proposta nº", numeroFmt]];
  if (emitidaEm) meta.push(["Emissão", emitidaEm]);
  if (validaAte) meta.push(["Válida até", validaAte]);
  if (p.prazoContratoMeses) meta.push(["Contrato", `${p.prazoContratoMeses} meses`]);

  const linhasResumo: Array<[string, string]> = [];
  for (const per of PERIODOS_EM_ORDEM) if (tot[per] > 0) linhasResumo.push([RESUMO_PERIODO[per], `${brl(tot[per])}${SUFIXO_PERIODO[per]}`]);
  if (condicaoPagamentoTexto) linhasResumo.push(["Pagamento", condicaoPagamentoTexto]);
  if (p.prazoContratoMeses) linhasResumo.push(["Fidelidade", `${p.prazoContratoMeses} meses`]);
  if (p.trialDias) linhasResumo.push(["Período de teste", `${p.trialDias} dias`]);
  if (p.reajusteIndice && p.reajusteIndice !== "nenhum") linhasResumo.push(["Reajuste", p.reajusteIndice]);
  if (validaAte) linhasResumo.push(["Proposta válida até", validaAte]);

  let n = 0;
  const proximo = () => String(++n).padStart(2, "0");

  return (
    <Tela>
      <article className="pp-doc">
        <div className="pp-doc-corpo">
          <header style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <Marca />
            <div className="pp-cabeca">
              <div className="pp-cabeca-titulo">
                <span className="pp-overline">Proposta comercial</span>
                <h1 className="pp-titulo">{titulo}</h1>
                {sub ? <p className="pp-sub">{sub}</p> : null}
                <p className="pp-promessa">{conteudo.promessa}</p>
              </div>
              <dl className="pp-meta" style={{ margin: 0 }}>
                {meta.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
            {(p.empresa || p.clienteNome) && (
              <div className="pp-partes">
                {p.empresa && (
                  <div>
                    <span className="pp-rotulo">Cliente</span>
                    <strong>{p.empresa}</strong>
                    {p.empresaCnpj ? <small>CNPJ {formatarCnpj(p.empresaCnpj)}</small> : null}
                  </div>
                )}
                {p.clienteNome && (
                  <div>
                    <span className="pp-rotulo">A/C</span>
                    <strong>{p.clienteNome}</strong>
                    {p.clienteCargo ? <small>{p.clienteCargo}</small> : null}
                  </div>
                )}
              </div>
            )}
          </header>

          <section aria-labelledby="pp-apresentacao">
            <SecaoTitulo n={proximo()}><span id="pp-apresentacao">Por que a Callface{conteudo.rotulo !== "Callface" ? ` · ${conteudo.rotulo}` : ""}</span></SecaoTitulo>
            <div className="pp-difs">
              {conteudo.diferenciais.map((d) => (
                <div key={d.titulo} className="pp-dif"><strong>{d.titulo}</strong><small>{d.texto}</small></div>
              ))}
            </div>
            {conteudo.entregas.length > 1 && (
              <div className="pp-incluso">
                <span className="pp-rotulo">O que está incluso</span>
                <ul>{conteudo.entregas.map((e) => <li key={e}><Check size={13} aria-hidden /> {e}</li>)}</ul>
              </div>
            )}
          </section>

          <section aria-labelledby="pp-escopo">
            <SecaoTitulo n={proximo()}><span id="pp-escopo">Escopo e investimento</span></SecaoTitulo>
            <div className="pp-tabela">
              <div className="pp-tabela-cabeca"><span>Descrição</span><span>Valor</span></div>
              {p.itens.length === 0 ? (
                <div className="pp-item"><div className="pp-item-nome"><small>Esta proposta ainda não tem itens. Fale com quem te enviou.</small></div></div>
              ) : (
                <>
                  {PERIODOS_EM_ORDEM.map((per) => {
                    const doPer = doPeriodo(per);
                    return doPer.length === 0 ? null : (
                      <Fragment key={per}>
                        <div className="pp-grupo"><span>{TITULO_PERIODO[per]}</span><b>{brl(tot[per])}{SUFIXO_PERIODO[per]}</b></div>
                        {doPer.map((item) => <ItemLinha key={item.id} item={item} />)}
                      </Fragment>
                    );
                  })}
                </>
              )}
            </div>
          </section>

          <section aria-labelledby="pp-resumo">
            <SecaoTitulo n={proximo()}><span id="pp-resumo">Condições e resumo financeiro</span></SecaoTitulo>
            <div className="pp-resumo">
              {linhasResumo.length > 0 && (
                <div className="pp-cartao">
                  <dl className="pp-linhas" style={{ margin: 0 }}>
                    {linhasResumo.map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}
                  </dl>
                </div>
              )}
              {/* Um período só: o valor dele, com o sufixo certo. Mais de um: o resumo acima já os separa, e
                  somá-los num "valor da proposta" misturaria mensalidade, anuidade e itens únicos. */}
              {periodosComValor.length === 1 ? (
                <div className="pp-total">
                  <div>
                    <span className="pp-rotulo">Valor da proposta</span>
                    <small>{periodosComValor[0] === "unico" ? "Pagamento único" : `Cobrança ${ROTULO_PERIODO[periodosComValor[0]].toLowerCase()}`}</small>
                  </div>
                  <strong>{brl(tot[periodosComValor[0]])}{SUFIXO_PERIODO[periodosComValor[0]]}</strong>
                </div>
              ) : periodosComValor.length > 1 ? (
                <div className="pp-total">
                  <div>
                    <span className="pp-rotulo">Seu investimento</span>
                    <small>Cada cobrança no seu próprio período</small>
                  </div>
                  <ul className="pp-total-lista">
                    {periodosComValor.map((per) => (
                      <li key={per}><span>{RESUMO_PERIODO[per]}</span><strong>{brl(tot[per])}{SUFIXO_PERIODO[per]}</strong></li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {p.condicoesPagamento ? <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--of-tinta-3)" }}>{p.condicoesPagamento}</p> : null}
          </section>

          {/* Pré-aceite: o cliente decide uma vez só, mesmo numa composição mista. */}
          {aindaNaoAceitou && (
            <section className="pp-decisao" aria-label="Sua decisão">
              {painel === "decisao" && (
                <>
                  <div className="pp-decisao-texto">
                    <h3>{validaAte ? `Proposta válida até ${validaAte}` : "Pronto para seguir?"}</h3>
                    <p>{p.status === "ajuste_solicitado" ? "Recebemos seu pedido de ajuste. Você ainda pode aceitar esta versão." : "Depois do aceite, o contrato e o pagamento chegam prontos, nesta mesma página."}</p>
                  </div>
                  <ol className="pp-jornada" aria-label="O que acontece depois do aceite">
                    {["Você aceita aqui", "Recebe o contrato para assinar", "Paga pelo link seguro", "Nosso time ativa e acompanha"].map((t, i) => (
                      <li key={t}><span>{i + 1}</span>{t}</li>
                    ))}
                  </ol>
                  <ul className="pp-garantias">
                    {conteudo.garantias.map((g) => <li key={g}><ShieldCheck size={13} aria-hidden /> {g}</li>)}
                  </ul>
                  <div className="pp-decisao-acoes">
                    <button type="button" className="pp-btn pp-btn-secundario" onClick={() => setPainel("ajuste")}>Pedir ajuste</button>
                    <button type="button" className="pp-btn pp-btn-ghost" onClick={() => setPainel("recusa")}>Recusar</button>
                    <button type="button" className="pp-btn pp-btn-primario" onClick={() => aceitar.mutate()} disabled={aceitar.isPending}>
                      {aceitar.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Check size={15} aria-hidden />}
                      {aceitar.isPending ? "Preparando seu contrato…" : "Aceitar proposta"}
                    </button>
                  </div>
                  {aceitar.isError && <div className="pp-decisao-form"><Aviso tom="erro">{(aceitar.error as Error).message}</Aviso></div>}
                </>
              )}

              {painel === "ajuste" && (
                <div className="pp-decisao-form">
                  {ajusteEnviado ? (
                    <>
                      <Aviso tom="ok">Pedido de ajuste enviado. Nosso time vai entrar em contato com você.</Aviso>
                      <div><button type="button" className="pp-btn pp-btn-secundario" onClick={() => setPainel("decisao")}>Voltar à proposta</button></div>
                    </>
                  ) : (
                    <>
                      <div className="pp-decisao-texto"><h3>O que você gostaria de ajustar?</h3><p>Escreva com suas palavras — quem te enviou a proposta recebe na hora.</p></div>
                      <textarea className="pp-campo" rows={4} value={ajusteMsg} onChange={(e) => setAjusteMsg(e.target.value)} placeholder="Ex.: preciso de mais 5 ramais e começar só em novembro" aria-label="Ajuste desejado" autoFocus />
                      {solicitarAjuste.isError && <Aviso tom="erro">{(solicitarAjuste.error as Error).message}</Aviso>}
                      <div className="pp-decisao-acoes" style={{ marginLeft: 0 }}>
                        <button type="button" className="pp-btn pp-btn-ghost" onClick={() => setPainel("decisao")}>Voltar</button>
                        <button type="button" className="pp-btn pp-btn-primario" onClick={() => solicitarAjuste.mutate()} disabled={!ajusteMsg.trim() || solicitarAjuste.isPending}>
                          {solicitarAjuste.isPending ? "Enviando…" : "Enviar pedido de ajuste"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {painel === "recusa" && (
                <div className="pp-decisao-form">
                  <div className="pp-decisao-texto"><h3>Recusar esta proposta</h3><p>Se puder, conte o motivo. Isso ajuda a gente a voltar com algo que faça sentido.</p></div>
                  <textarea className="pp-campo" rows={3} value={recusaMotivo} onChange={(e) => setRecusaMotivo(e.target.value)} placeholder="Motivo (opcional)" aria-label="Motivo da recusa" autoFocus />
                  {recusar.isError && <Aviso tom="erro">{(recusar.error as Error).message}</Aviso>}
                  <div className="pp-decisao-acoes" style={{ marginLeft: 0 }}>
                    <button type="button" className="pp-btn pp-btn-ghost" onClick={() => setPainel("decisao")}>Voltar</button>
                    <button type="button" className="pp-btn pp-btn-escuro" onClick={() => recusar.mutate()} disabled={recusar.isPending}>
                      {recusar.isPending ? "Enviando…" : "Confirmar recusa"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Pós-aceite: um card por grupo comercial — requirements independentes (seção 15). */}
          {p.grupos.length > 0 && (
            <section aria-labelledby="pp-passos">
              <SecaoTitulo n={proximo()}><span id="pp-passos">Próximos passos</span></SecaoTitulo>
              {p.grupos.map((grupo) => <GrupoCard key={grupo.id} grupo={grupo} id={id} onAssinado={invalidar} />)}
            </section>
          )}

          {!aindaNaoAceitou && pendenciaDoAceite && (
            <Aviso tom="neutro">
              Recebemos o seu aceite. O contrato (ou o link de pagamento) ainda está sendo preparado e não ficou pronto agora.
              Você não precisa aceitar de novo: assim que estiver pronto, enviamos por e-mail, e nosso time já foi avisado.
            </Aviso>
          )}
          {!aindaNaoAceitou && p.grupos.length === 0 && p.status === "aceita" && (
            <Aviso tom="ok">Proposta aceita. Nosso time vai entrar em contato para dar sequência.</Aviso>
          )}
          {todosGruposConcluidos && (
            <Aviso tom="ok">Tudo certo! Recebemos a confirmação de todos os itens desta proposta. Nosso time vai entrar em contato para dar sequência.</Aviso>
          )}

          {p.responsavelNome && (
            <div className="pp-contato">
              <span className="pp-rotulo">Dúvidas sobre esta proposta?</span>
              <strong>{p.responsavelNome}</strong>
              {p.responsavelEmail ? <a className="pp-link" href={`mailto:${p.responsavelEmail}`}><Mail size={13} aria-hidden /> {p.responsavelEmail}</a> : null}
            </div>
          )}

          <footer className="pp-rodape-doc">
            <span>Proposta {numeroFmt} · Callface</span>
            <a className="pp-link" href={`/api/propostas/${id}/pdf`} target="_blank" rel="noreferrer">
              <Download size={13} aria-hidden /> Baixar PDF
            </a>
          </footer>
        </div>
      </article>
    </Tela>
  );
}
