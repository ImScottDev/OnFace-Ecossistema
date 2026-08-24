"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, FileSignature, CreditCard, CheckCircle2, AlertTriangle, Download, ShieldCheck } from "lucide-react";

const CARMIM = "#e23752";
const ROXO = "#8e27ef";
const GRADIENTE = `linear-gradient(90deg, ${CARMIM}, ${ROXO})`;
const FONT_HEADING = "var(--font-heading), system-ui, sans-serif";
const FONT_BODY = "var(--font-body), system-ui, sans-serif";

interface Item { id: string; nome: string; descricao: string | null; tipo: string; quantidade: string; valorUnitario: string; subtotal: string; commercialModel: string }
interface Grupo {
  id: string;
  commercialModel: string;
  status: string;
  itens: Item[];
  contrato: { id: string; corpoGerado: string | null; assinaturaStatus: string; signatureStatus: string | null; status: string; signingUrl?: string | null } | null;
  checkoutUrl: string | null;
  pagamentoEstado: "aberto" | "pago" | "boleto_pendente" | "indisponivel" | null;
}
interface PropostaPublicaData {
  id: string; numero: number; versao: number; status: string; moeda: string;
  dataValidade: string | null; condicoesPagamento: string | null;
  totalRecorrente: string; totalAvulso: string; totalGeral: string;
  motivoRecusa: string | null; clienteRespondeuEm: string | null;
  clienteNome: string | null; empresa: string | null; negocioTitulo: string | null;
  itens: Item[]; grupos: Grupo[];
}

const brl = (v: string | number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_LABEL: Record<string, string> = { recorrente: "Mensal", avulso: "Avulso", setup: "Setup" };
// Ícone + cor por status de grupo comercial (24/08, pedido do Kauã: "algo
// foda mesmo, contextualizando tudo") — cada etapa do pós-aceite (contrato/
// assinatura/pagamento) agora tem um sinal visual próprio, não só texto.
const GRUPO_STATUS_INFO: Record<string, { texto: string; cor: string; bg: string; Icon: typeof Clock }> = {
  aguardando_contrato: { texto: "Contrato sendo preparado", cor: "#78788c", bg: "#f1f1f6", Icon: Clock },
  contrato_enviado_assinatura: { texto: "Aguardando sua assinatura", cor: "#a3720a", bg: "#fdf3e0", Icon: FileSignature },
  contrato_assinado: { texto: "Contrato assinado", cor: "#0f9d58", bg: "#e6f6ec", Icon: CheckCircle2 },
  aguardando_checkout: { texto: "Preparando pagamento", cor: "#78788c", bg: "#f1f1f6", Icon: Clock },
  checkout_gerado: { texto: "Aguardando pagamento", cor: "#a3720a", bg: "#fdf3e0", Icon: CreditCard },
  pagamento_pendente: { texto: "Pagamento em processamento", cor: "#a3720a", bg: "#fdf3e0", Icon: Clock },
  pago: { texto: "Pago", cor: "#0f9d58", bg: "#e6f6ec", Icon: CheckCircle2 },
  concluido: { texto: "Concluído", cor: "#0f9d58", bg: "#e6f6ec", Icon: CheckCircle2 },
  falhou: { texto: "Pagamento não confirmado", cor: CARMIM, bg: "#fdeaec", Icon: AlertTriangle },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f5fa", fontFamily: FONT_BODY }}>
      <div style={{ height: 6, background: GRADIENTE }} />
      <div style={{ display: "flex", justifyContent: "center", padding: "48px 16px 64px" }}>
        <div style={{ width: "100%", maxWidth: 620 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/callface-logo.svg" alt="Callface" style={{ height: 30 }} />
          </div>
          {children}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 28, color: "#9497ab", fontSize: 11 }}>
            <ShieldCheck size={13} /> Proposta gerada e assinada digitalmente pela Callface
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #ececf2", boxShadow: "0 2px 10px -4px rgba(24,26,50,0.08)", padding: padded ? 28 : 0, marginBottom: 16, overflow: "hidden" }}>
      {children}
    </div>
  );
}

function EstadoFinal({ titulo, corpo, tom = "neutro" }: { titulo: string; corpo: string; tom?: "sucesso" | "erro" | "neutro" }) {
  const cor = tom === "sucesso" ? "#0f9d58" : tom === "erro" ? CARMIM : "#4b4d63";
  const Icon = tom === "sucesso" ? CheckCircle2 : tom === "erro" ? AlertTriangle : Clock;
  return (
    <Card>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 999, background: `${cor}18`, color: cor, flexShrink: 0 }}><Icon size={18} /></span>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: cor, margin: "0 0 6px", fontFamily: FONT_HEADING }}>{titulo}</h1>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{corpo}</p>
        </div>
      </div>
    </Card>
  );
}

/** Um card de "próximo passo" por GRUPO COMERCIAL — venda mista tem requirements independentes (seção 15 do briefing). */
function GrupoCard({ grupo, id, onAssinado }: { grupo: Grupo; id: string; onAssinado: () => void }) {
  const [nomeAssinatura, setNomeAssinatura] = useState("");
  const statusInfo = GRUPO_STATUS_INFO[grupo.status] || { texto: grupo.status, cor: "#9497ab", bg: "#f1f1f6", Icon: Clock };
  const titulo = grupo.itens.map((i) => i.nome).join(" + ") || "Composição";
  const StatusIcon = statusInfo.Icon;

  const assinar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/assinar-publico`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeCompleto: nomeAssinatura, contratoId: grupo.contrato?.id }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Falha ao assinar");
      return body;
    },
    onSuccess: onAssinado,
  });

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#181a32", margin: 0, fontFamily: FONT_HEADING }}>{titulo}</p>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: statusInfo.cor, background: statusInfo.bg, padding: "5px 10px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>
          <StatusIcon size={13} /> {statusInfo.texto}
        </span>
      </div>

      {grupo.status === "contrato_enviado_assinatura" && grupo.contrato && (
        <>
          {grupo.contrato.signingUrl ? (
            <a href={grupo.contrato.signingUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, background: GRADIENTE, color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              <FileSignature size={15} /> Ler e assinar contrato
            </a>
          ) : (
            <>
              {grupo.contrato.corpoGerado && (
                <div style={{ fontSize: 12.5, color: "#4b4d63", background: "#f7f7fa", border: "1px solid #ececf2", borderRadius: 12, padding: 14, marginBottom: 14, whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 180, overflowY: "auto" }}>
                  {grupo.contrato.corpoGerado}
                </div>
              )}
              <p style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.6, margin: "0 0 12px" }}>
                Confirme seu nome completo — isso registra um aceite eletrônico simples (não é assinatura digital com certificação).
              </p>
              <input
                value={nomeAssinatura} onChange={(e) => setNomeAssinatura(e.target.value)} placeholder="Nome completo"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #dcdce6", fontSize: 14, marginBottom: 10, boxSizing: "border-box", fontFamily: FONT_BODY }}
              />
              <button
                onClick={() => assinar.mutate()} disabled={!nomeAssinatura.trim() || assinar.isPending}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, border: "none", background: GRADIENTE, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: !nomeAssinatura.trim() || assinar.isPending ? 0.5 : 1 }}
              >
                <Check size={15} /> {assinar.isPending ? "Enviando..." : "Concordo e assino eletronicamente"}
              </button>
              {assinar.isError && <p style={{ color: CARMIM, fontSize: 12, marginTop: 8 }}>{(assinar.error as Error).message}</p>}
            </>
          )}
        </>
      )}

      {(grupo.status === "aguardando_checkout" || grupo.status === "checkout_gerado") && (
        grupo.pagamentoEstado === "boleto_pendente" ? (
          <p style={{ fontSize: 13, color: "#4b4d63", margin: 0 }}>Boleto emitido — aguardando compensação (até 1 dia útil).</p>
        ) : grupo.pagamentoEstado === "indisponivel" ? (
          <p style={{ fontSize: 13, color: CARMIM, margin: 0 }}>Não conseguimos gerar o link de pagamento agora. Fale com quem te enviou a proposta.</p>
        ) : grupo.checkoutUrl ? (
          <a href={grupo.checkoutUrl} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, background: GRADIENTE, color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            <CreditCard size={15} /> Ir para pagamento seguro
          </a>
        ) : (
          <p style={{ fontSize: 13, color: "#9497ab", margin: 0 }}>Preparando o link de pagamento...</p>
        )
      )}

      {(grupo.status === "pago" || grupo.status === "concluido") && (
        <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0f9d58", margin: 0, fontWeight: 600 }}><CheckCircle2 size={15} /> Pagamento confirmado — obrigado!</p>
      )}
      {grupo.status === "falhou" && (
        <p style={{ fontSize: 13, color: CARMIM, margin: 0 }}>Não conseguimos confirmar o pagamento. Fale com quem te enviou a proposta pra gerar um novo link.</p>
      )}
    </Card>
  );
}

export function PropostaPublica({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [ajusteMsg, setAjusteMsg] = useState("");
  const [ajusteEnviado, setAjusteEnviado] = useState(false);
  const [ajusteAberto, setAjusteAberto] = useState(false);
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const [recusaAberta, setRecusaAberta] = useState(false);

  const { data, isLoading, error } = useQuery<PropostaPublicaData>({
    queryKey: ["proposta-publica", id],
    queryFn: async () => {
      const r = await fetch(`/api/propostas/${id}/publica`);
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
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Falha ao aceitar");
      return body;
    },
    onSuccess: invalidar,
  });

  const recusar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/recusar-publico`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: recusaMotivo || undefined }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Falha ao recusar");
      return body;
    },
    onSuccess: invalidar,
  });

  const solicitarAjuste = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/ajuste-publico`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensagem: ajusteMsg }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Falha ao enviar");
      return body;
    },
    onSuccess: () => setAjusteEnviado(true),
  });

  if (isLoading) return <Shell><Card><p style={{ color: "#9497ab", fontSize: 14 }}>Carregando proposta...</p></Card></Shell>;
  if (error || !data) {
    return <Shell><EstadoFinal tom="erro" titulo="Proposta não encontrada" corpo="Confira o link recebido ou fale com quem te enviou a proposta na Callface." /></Shell>;
  }

  const numeroFmt = `#P-${String(data.numero).padStart(3, "0")}-v${data.versao}`;
  const validadeVencida = data.dataValidade ? new Date(data.dataValidade) < new Date(new Date().toDateString()) : false;

  if (data.status === "expirada" || (["enviada", "ajuste_solicitado"].includes(data.status) && validadeVencida)) {
    return <Shell><EstadoFinal tom="erro" titulo="Este link de proposta expirou" corpo="O prazo de validade dessa proposta passou. Fale com quem te enviou a proposta na Callface para receber uma atualizada." /></Shell>;
  }

  if (data.status === "recusada") {
    return (
      <Shell>
        <EstadoFinal
          titulo="Proposta recusada"
          corpo={`Você recusou a proposta ${numeroFmt}. Nosso time vai entrar em contato para entender melhor e ver os próximos passos.${data.motivoRecusa ? ` Motivo informado: "${data.motivoRecusa}"` : ""}`}
        />
      </Shell>
    );
  }

  const todosGruposConcluidos = data.grupos.length > 0 && data.grupos.every((g) => g.status === "concluido" || g.status === "pago");
  const aindaNaoAceitou = ["enviada", "ajuste_solicitado"].includes(data.status);

  return (
    <Shell>
      {/* Header em destaque (24/08, pedido do Kauã: "algo foda mesmo,
          contextualizando tudo") — banda de gradiente da marca no topo do
          card, empresa/cliente como título real, não mais um bloco de texto
          plano igual aos outros. */}
      <Card padded={false}>
        <div style={{ height: 4, background: GRADIENTE }} />
        <div style={{ padding: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: "#9497ab", textTransform: "uppercase", margin: "0 0 8px" }}>
            Proposta {numeroFmt}
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#181a32", margin: "0 0 6px", fontFamily: FONT_HEADING, letterSpacing: -0.3 }}>
            {data.empresa || data.clienteNome || "Cliente"}
          </h1>
          {data.negocioTitulo && <p style={{ fontSize: 13.5, color: "#6b7280", margin: 0 }}>{data.negocioTitulo}</p>}
          {data.dataValidade && aindaNaoAceitou && (
            <p style={{ fontSize: 12, color: validadeVencida ? CARMIM : "#9497ab", margin: "10px 0 0" }}>
              Válida até {new Date(data.dataValidade).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9497ab", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 14px" }}>O que está incluso</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.itens.map((item, i) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingBottom: 12, borderBottom: i < data.itens.length - 1 ? "1px solid #f1f1f5" : "none" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14.5, fontWeight: 600, color: "#181a32", margin: 0, fontFamily: FONT_HEADING }}>{item.nome}</p>
                <p style={{ fontSize: 12, color: "#9497ab", margin: "3px 0 0" }}>
                  {TIPO_LABEL[item.tipo] || item.tipo} · qtd {item.quantidade}
                </p>
              </div>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: "#181a32", whiteSpace: "nowrap", margin: 0 }}>{brl(item.subtotal)}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #ececf2", display: "flex", flexDirection: "column", gap: 5 }}>
          {Number(data.totalRecorrente) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
              <span>Total mensal</span><span>{brl(data.totalRecorrente)}/mês</span>
            </div>
          )}
          {Number(data.totalAvulso) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
              <span>Total avulso</span><span>{brl(data.totalAvulso)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181a32", fontFamily: FONT_HEADING }}>Total geral</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#181a32", fontFamily: FONT_HEADING }}>{brl(data.totalGeral)}</span>
          </div>
        </div>
        {data.condicoesPagamento && (
          <p style={{ fontSize: 12, color: "#9497ab", marginTop: 14 }}>Condições: {data.condicoesPagamento}</p>
        )}
      </Card>

      {/* Pré-aceite: só o botão de decisão (a composição pode ser mista, mas o cliente decide uma vez só) */}
      {aindaNaoAceitou && (
        <Card>
          {!ajusteAberto && !recusaAberta ? (
            <>
              <button
                onClick={() => aceitar.mutate()} disabled={aceitar.isPending}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", borderRadius: 12, border: "none", background: GRADIENTE, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 10, fontFamily: FONT_HEADING }}
              >
                <Check size={17} /> {aceitar.isPending ? "Processando..." : "Aceitar proposta"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setAjusteAberto(true)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Solicitar ajuste
                </button>
                <button onClick={() => setRecusaAberta(true)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Recusar
                </button>
              </div>
              {aceitar.isError && <p style={{ color: CARMIM, fontSize: 12, marginTop: 8 }}>{(aceitar.error as Error).message}</p>}
            </>
          ) : ajusteAberto ? (
            ajusteEnviado ? (
              <p style={{ fontSize: 13, color: "#0f9d58", margin: 0 }}>Ajuste solicitado. Nosso time vai entrar em contato com você.</p>
            ) : (
              <>
                <textarea
                  value={ajusteMsg} onChange={(e) => setAjusteMsg(e.target.value)}
                  placeholder="O que você gostaria de ajustar?" rows={3}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #dcdce6", fontSize: 14, marginBottom: 10, boxSizing: "border-box", resize: "vertical", fontFamily: FONT_BODY }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setAjusteAberto(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontSize: 13, cursor: "pointer" }}>Voltar</button>
                  <button
                    onClick={() => solicitarAjuste.mutate()} disabled={!ajusteMsg.trim() || solicitarAjuste.isPending}
                    style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: CARMIM, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: !ajusteMsg.trim() ? 0.5 : 1 }}
                  >
                    {solicitarAjuste.isPending ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <textarea
                value={recusaMotivo} onChange={(e) => setRecusaMotivo(e.target.value)}
                placeholder="Motivo (opcional)" rows={3}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #dcdce6", fontSize: 14, marginBottom: 10, boxSizing: "border-box", resize: "vertical", fontFamily: FONT_BODY }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRecusaAberta(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontSize: 13, cursor: "pointer" }}>Voltar</button>
                <button
                  onClick={() => recusar.mutate()} disabled={recusar.isPending}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#4b4d63", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {recusar.isPending ? "Enviando..." : "Confirmar recusa"}
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Pós-aceite: um card por grupo comercial — requirements independentes (seção 15) */}
      {data.grupos.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9497ab", textTransform: "uppercase", letterSpacing: 0.5, margin: "24px 0 12px" }}>Próximos passos</p>
          {data.grupos.map((grupo) => (
            <GrupoCard key={grupo.id} grupo={grupo} id={id} onAssinado={invalidar} />
          ))}
        </>
      )}

      {todosGruposConcluidos && (
        <EstadoFinal tom="sucesso" titulo="Tudo certo!" corpo="Recebemos a confirmação de todos os itens desta proposta. Nosso time vai entrar em contato pra dar sequência." />
      )}

      <div style={{ textAlign: "center", marginTop: 12 }}>
        <a href={`/api/propostas/${id}/pdf`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#78788c", textDecoration: "none", fontWeight: 600 }}>
          <Download size={13} /> Baixar PDF da proposta
        </a>
      </div>
    </Shell>
  );
}
