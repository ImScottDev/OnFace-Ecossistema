"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const CARMIM = "#e23752";
const ROXO = "#8e27ef";

interface Item { nome: string; descricao: string | null; tipo: string; quantidade: string; valorUnitario: string; subtotal: string }
interface PropostaPublicaData {
  id: string; numero: number; versao: number; status: string; moeda: string;
  dataValidade: string | null; condicoesPagamento: string | null;
  totalRecorrente: string; totalAvulso: string; totalGeral: string;
  checkoutUrl: string | null; pagamentoEstado: "aberto" | "pago" | "boleto_pendente" | "indisponivel" | null;
  proximoPasso: "pagamento" | "contrato"; motivoRecusa: string | null; clienteRespondeuEm: string | null;
  clienteNome: string | null; empresa: string | null; negocioTitulo: string | null;
  itens: Item[]; contrato: { assinaturaStatus: string; status: string } | null;
}

const brl = (v: string | number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPO_LABEL: Record<string, string> = { recorrente: "Mensal", avulso: "Avulso", setup: "Setup" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f7fa", display: "flex", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/callface-logo.svg" alt="Callface" style={{ height: 32 }} />
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #ececf2", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", padding: 28, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function EstadoFinal({ titulo, corpo, tom = "neutro" }: { titulo: string; corpo: string; tom?: "sucesso" | "erro" | "neutro" }) {
  const cor = tom === "sucesso" ? "#0f9d58" : tom === "erro" ? CARMIM : "#4b4d63";
  return (
    <Card>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: cor, margin: "0 0 8px" }}>{titulo}</h1>
      <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{corpo}</p>
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
  const [nomeAssinatura, setNomeAssinatura] = useState("");

  const { data, isLoading, error } = useQuery<PropostaPublicaData>({
    queryKey: ["proposta-publica", id],
    queryFn: async () => {
      const r = await fetch(`/api/propostas/${id}/publica`);
      if (!r.ok) throw new Error("not-found");
      return r.json();
    },
    retry: false,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["proposta-publica", id] });

  const aceitar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/aceitar-publico`, { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Falha ao aceitar");
      return body as { proximoPasso: "pagamento" | "contrato"; checkoutUrl?: string | null };
    },
    onSuccess: (result) => {
      if (result.proximoPasso === "pagamento" && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      invalidar();
    },
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

  const assinar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/propostas/${id}/assinar-publico`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nomeCompleto: nomeAssinatura }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Falha ao assinar");
      return body;
    },
    onSuccess: invalidar,
  });

  if (isLoading) return <Shell><Card><p style={{ color: "#9497ab", fontSize: 14 }}>Carregando proposta...</p></Card></Shell>;
  if (error || !data) {
    return <Shell><EstadoFinal tom="erro" titulo="Proposta não encontrada" corpo="Confira o link recebido ou fale com quem te enviou a proposta na Callface." /></Shell>;
  }

  const numeroFmt = `#P-${String(data.numero).padStart(3, "0")}-v${data.versao}`;
  const validadeVencida = data.dataValidade ? new Date(data.dataValidade) < new Date(new Date().toDateString()) : false;

  if (data.status === "expirada" || (data.status === "enviada" && validadeVencida)) {
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

  const contratoAssinado = data.contrato?.assinaturaStatus === "aceite_simples";
  if (contratoAssinado) {
    return <Shell><EstadoFinal tom="sucesso" titulo="Contrato assinado" corpo={`Recebemos sua assinatura da proposta ${numeroFmt}. Nosso time vai entrar em contato pra dar sequência (cobrança/instalação).`} /></Shell>;
  }

  const aguardandoAssinatura = data.status === "aceita" && data.proximoPasso === "contrato" && data.contrato?.assinaturaStatus === "pendente";

  return (
    <Shell>
      <Card>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#9497ab", textTransform: "uppercase", margin: "0 0 6px" }}>
          Proposta {numeroFmt}
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#181a32", margin: "0 0 4px" }}>
          {data.empresa || data.clienteNome || "Cliente"}
        </h1>
        {data.negocioTitulo && <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{data.negocioTitulo}</p>}
      </Card>

      <Card>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9497ab", textTransform: "uppercase", margin: "0 0 12px" }}>Itens</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.itens.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingBottom: 10, borderBottom: i < data.itens.length - 1 ? "1px solid #f1f1f5" : "none" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#181a32", margin: 0 }}>{item.nome}</p>
                <p style={{ fontSize: 12, color: "#9497ab", margin: "2px 0 0" }}>
                  {TIPO_LABEL[item.tipo] || item.tipo} · qtd {item.quantidade}
                </p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#181a32", whiteSpace: "nowrap", margin: 0 }}>{brl(item.subtotal)}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #ececf2", display: "flex", flexDirection: "column", gap: 4 }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#181a32", marginTop: 4 }}>
            <span>Total geral</span><span>{brl(data.totalGeral)}</span>
          </div>
        </div>
        {data.condicoesPagamento && (
          <p style={{ fontSize: 12, color: "#9497ab", marginTop: 12 }}>Condições: {data.condicoesPagamento}</p>
        )}
      </Card>

      {aguardandoAssinatura ? (
        <Card>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#9497ab", textTransform: "uppercase", margin: "0 0 8px" }}>Formalização</p>
          <p style={{ fontSize: 13, color: "#4b4d63", lineHeight: 1.6, margin: "0 0 14px" }}>
            Você aceitou esta proposta. Pra formalizar, confirme seu nome completo abaixo — isso registra um aceite eletrônico simples
            (não é assinatura digital com certificação). Depois disso nosso time entra em contato pra dar sequência ao pagamento.
          </p>
          <input
            value={nomeAssinatura}
            onChange={(e) => setNomeAssinatura(e.target.value)}
            placeholder="Nome completo"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ececf2", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }}
          />
          <button
            onClick={() => assinar.mutate()}
            disabled={!nomeAssinatura.trim() || assinar.isPending}
            style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: CARMIM, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: !nomeAssinatura.trim() || assinar.isPending ? 0.5 : 1 }}
          >
            {assinar.isPending ? "Enviando..." : "Concordo e assino eletronicamente"}
          </button>
          {assinar.isError && <p style={{ color: CARMIM, fontSize: 12, marginTop: 8 }}>{(assinar.error as Error).message}</p>}
        </Card>
      ) : data.status === "enviada" ? (
        <Card>
          {data.pagamentoEstado === "boleto_pendente" ? (
            <p style={{ fontSize: 13, color: "#4b4d63" }}>Boleto emitido — aguardando compensação (até 1 dia útil).</p>
          ) : data.pagamentoEstado === "pago" ? (
            <p style={{ fontSize: 13, color: "#0f9d58" }}>Pagamento confirmado — estamos ativando seu contrato.</p>
          ) : data.pagamentoEstado === "indisponivel" ? (
            <p style={{ fontSize: 13, color: CARMIM }}>Não conseguimos gerar o link de pagamento agora. Fale com quem te enviou a proposta.</p>
          ) : !ajusteAberto && !recusaAberta ? (
            <>
              <button
                onClick={() => aceitar.mutate()}
                disabled={aceitar.isPending}
                style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(90deg, ${CARMIM}, ${ROXO})`, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 10 }}
              >
                {aceitar.isPending ? "Processando..." : data.proximoPasso === "pagamento" ? "Aceitar e ir para pagamento" : "Aceitar proposta"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setAjusteAberto(true)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Solicitar ajuste
                </button>
                <button onClick={() => setRecusaAberta(true)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Recusar
                </button>
              </div>
              {aceitar.isError && <p style={{ color: CARMIM, fontSize: 12, marginTop: 8 }}>{(aceitar.error as Error).message}</p>}
            </>
          ) : ajusteAberto ? (
            ajusteEnviado ? (
              <p style={{ fontSize: 13, color: "#0f9d58" }}>Ajuste solicitado. Nosso time vai entrar em contato com você.</p>
            ) : (
              <>
                <textarea
                  value={ajusteMsg} onChange={(e) => setAjusteMsg(e.target.value)}
                  placeholder="O que você gostaria de ajustar?"
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ececf2", fontSize: 14, marginBottom: 10, boxSizing: "border-box", resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setAjusteAberto(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontSize: 13, cursor: "pointer" }}>Voltar</button>
                  <button
                    onClick={() => solicitarAjuste.mutate()}
                    disabled={!ajusteMsg.trim() || solicitarAjuste.isPending}
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
                placeholder="Motivo (opcional)"
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ececf2", fontSize: 14, marginBottom: 10, boxSizing: "border-box", resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setRecusaAberta(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontSize: 13, cursor: "pointer" }}>Voltar</button>
                <button
                  onClick={() => recusar.mutate()}
                  disabled={recusar.isPending}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#4b4d63", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  {recusar.isPending ? "Enviando..." : "Confirmar recusa"}
                </button>
              </div>
            </>
          )}
        </Card>
      ) : null}

      <div style={{ textAlign: "center", marginTop: 8 }}>
        <a href={`/api/propostas/${id}/pdf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#9497ab", textDecoration: "underline" }}>
          Baixar PDF da proposta
        </a>
      </div>
    </Shell>
  );
}
