"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

const CARMIM = "#e23752";
const ROXO = "#8e27ef";
const TEXTO = "#181a32";

/**
 * Formulário público de implantação PABX (reconstrução 20/08 — feedback
 * direto do Kauã sobre a v1: nada de "botão pra adicionar um item por vez",
 * Portabilidade/Ramais viram TABELA de verdade com linhas pré-existentes +
 * botão "adicionar linha"; anexo de fatura/documento entra DIRETO na linha
 * (upload real, não "manda por e-mail depois"); URA reaproveita os números
 * já digitados em Portabilidade e os ramais/departamentos já digitados em
 * Ramais em vez de pedir tudo de novo). Campos batem 1:1 com o processo real
 * (`Callface-Processo-Delivery-PABX.pdf` + os 3 formulários reais em
 * planilha — Portabilidade/Ramais/URA).
 */

interface ContatoTecnico { nome: string; email: string; telefone: string }

interface LinhaPortabilidade {
  ddd: string; numero: string; novaLinha: boolean;
  anexoUrl: string; anexoNome: string;
}

interface Portabilidade {
  responsavelTecnico: ContatoTecnico;
  linhas: LinhaPortabilidade[];
  razaoSocialTitular: string;
  cnpjCpfTitular: string;
  operadoraAtual: string;
}

interface RamalItem {
  ramal: string; nome: string; departamento: string;
  numeroExterno: string;
  utilizaAparelhoMesa: boolean; modeloAparelho: string;
  email: string; celular: string;
  notificacaoLigacoesPerdidas: boolean; gravarLigacao: boolean; acessoGestor: boolean;
  ligacoesInternacionais: boolean; paises: string;
}

interface OpcaoUra { rotulo: string; destinos: string[] }

interface Ura {
  numerosAtendidos: string[];
  diasHorarioAtendimento: string;
  fraseBoasVindasHorario: string;
  opcoes: OpcaoUra[];
  semOpcaoSelecionada: string[];
  fraseBoasVindasForaHorario: string;
  encaminhamentoForaHorario: string[];
  vozSelecionada: string;
}

interface Respostas {
  portabilidade: Portabilidade;
  ramais: RamalItem[];
  ura: Ura;
  outrasInformacoes: string;
}

const LINHA_VAZIA = (): LinhaPortabilidade => ({ ddd: "", numero: "", novaLinha: false, anexoUrl: "", anexoNome: "" });
const RAMAL_VAZIO = (): RamalItem => ({
  ramal: "", nome: "", departamento: "", numeroExterno: "",
  utilizaAparelhoMesa: false, modeloAparelho: "", email: "", celular: "",
  notificacaoLigacoesPerdidas: false, gravarLigacao: false, acessoGestor: false,
  ligacoesInternacionais: false, paises: "",
});

const PORTABILIDADE_VAZIA: Portabilidade = {
  responsavelTecnico: { nome: "", email: "", telefone: "" },
  linhas: Array.from({ length: 8 }, LINHA_VAZIA),
  razaoSocialTitular: "", cnpjCpfTitular: "", operadoraAtual: "",
};

const URA_VAZIA: Ura = {
  numerosAtendidos: [], diasHorarioAtendimento: "", fraseBoasVindasHorario: "",
  opcoes: [{ rotulo: "", destinos: [] }], semOpcaoSelecionada: [],
  fraseBoasVindasForaHorario: "", encaminhamentoForaHorario: [], vozSelecionada: "",
};

const RESPOSTAS_VAZIAS: Respostas = {
  portabilidade: PORTABILIDADE_VAZIA,
  ramais: Array.from({ length: 8 }, RAMAL_VAZIO),
  ura: URA_VAZIA,
  outrasInformacoes: "",
};

interface FormularioData {
  fulfillment: { serviceFamily: string; status: string };
  formulario: {
    status: string;
    respostas: Partial<Respostas>;
    enviadoEm: string | null;
    submetidoEm: string | null;
    notaRevisao: string | null;
  };
}

const JA_ENVIADO = new Set(["SUBMITTED", "IN_REVIEW", "APPROVED", "CORRECTION_REQUIRED"]);

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f7fa", display: "flex", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 920 }}>
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
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #ececf2", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", padding: 28, marginBottom: 16, color: TEXTO }}>
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

// FIX crítico (feedback do Kauã): texto invisível ao digitar — faltava
// `color` explícito no input/textarea, herdava branco de algum estilo
// global do app (essa página pública roda no mesmo bundle do CRM). Todo
// campo de texto abaixo tem `color: TEXTO` explícito agora.
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #dcdce6", fontSize: 13, boxSizing: "border-box", color: TEXTO, background: "#fff",
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9497ab", textTransform: "uppercase", margin: "0 0 12px" };
const thStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#9497ab", textTransform: "uppercase", padding: "0 6px 8px", textAlign: "left", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "4px 6px", verticalAlign: "middle" };

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <label style={labelStyle}>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
    </div>
  );
}

function StepIndicator({ passos, atual, onJump }: { passos: string[]; atual: number; onJump: (i: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
      {passos.map((nome, i) => (
        <div key={nome} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={() => i <= atual && onJump(i)}
            style={{
              width: "100%", height: 6, borderRadius: 4, border: "none", cursor: i <= atual ? "pointer" : "default",
              background: i <= atual ? `linear-gradient(90deg, ${CARMIM}, ${ROXO})` : "#ececf2",
            }}
          />
          <p style={{ fontSize: 10, fontWeight: 700, color: i === atual ? TEXTO : "#9497ab", margin: 0, textAlign: "center" }}>{nome}</p>
        </div>
      ))}
    </div>
  );
}

function NavegacaoPasso({ podeVoltar, onVoltar, onAvancar, textoAvancar }: { podeVoltar: boolean; onVoltar: () => void; onAvancar: () => void; textoAvancar: string }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
      {podeVoltar && (
        <button type="button" onClick={onVoltar} style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          Voltar
        </button>
      )}
      <button type="button" onClick={onAvancar} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(90deg, ${CARMIM}, ${ROXO})`, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
        {textoAvancar}
      </button>
    </div>
  );
}

// Chip removível — usado pra "números atendidos pela URA" e pras cadeias de
// encaminhamento (opção/fallback/fora do horário), todos como lista
// ordenada de referências já digitadas em passos anteriores.
function ChipList({ itens, onRemover }: { itens: string[]; onRemover: (i: number) => void }) {
  if (itens.length === 0) return <p style={{ fontSize: 12, color: "#9497ab" }}>Nenhum selecionado ainda.</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {itens.map((item, i) => (
        <span key={`${item}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 999, background: "#f7f7fa", border: "1px solid #ececf2", fontSize: 12, color: TEXTO }}>
          {i > 0 && <span style={{ color: "#9497ab" }}>→</span>}
          {item}
          <button type="button" onClick={() => onRemover(i)} style={{ border: "none", background: "none", color: "#9497ab", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
        </span>
      ))}
    </div>
  );
}

// Seletor de destino de encaminhamento — puxa os ramais/departamentos JÁ
// digitados no passo de Ramais (pedido explícito: "se a pessoa já colocou
// ramal e departamento, não tem por que pedir de novo na URA"). Sem ramais
// preenchidos ainda, cai num campo de texto livre honesto (não trava o
// cliente que ainda não passou pelo passo de Ramais).
function SeletorDestino({ ramaisDisponiveis, valor, onChange }: { ramaisDisponiveis: RamalItem[]; valor: string[]; onChange: (v: string[]) => void }) {
  const [selecao, setSelecao] = useState("");
  const opcoes = ramaisDisponiveis.filter((r) => r.ramal || r.departamento || r.nome);

  if (opcoes.length === 0) {
    return (
      <div style={{ marginBottom: 8 }}>
        <ChipList itens={valor} onRemover={(i) => onChange(valor.filter((_, idx) => idx !== i))} />
        <input
          placeholder="Digite o ramal/setor e tecle Enter"
          style={inputStyle}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) {
              onChange([...valor, e.currentTarget.value.trim()]);
              e.currentTarget.value = "";
            }
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <ChipList itens={valor} onRemover={(i) => onChange(valor.filter((_, idx) => idx !== i))} />
      <div style={{ display: "flex", gap: 6 }}>
        <select value={selecao} onChange={(e) => setSelecao(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="">Selecione um ramal/departamento já cadastrado...</option>
          {opcoes.map((r, i) => (
            <option key={i} value={r.ramal ? `${r.ramal} — ${r.nome || r.departamento}` : r.departamento}>
              {r.ramal ? `${r.ramal} — ${r.nome || "sem nome"}${r.departamento ? ` (${r.departamento})` : ""}` : r.departamento}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { if (selecao) { onChange([...valor, selecao]); setSelecao(""); } }}
          style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${CARMIM}`, background: "#fff", color: CARMIM, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
        >
          + Adicionar
        </button>
      </div>
    </div>
  );
}

function AnexoCelula({ token, linha, onChange }: { token: string; linha: LinhaPortabilidade; onChange: (patch: Partial<LinhaPortabilidade>) => void }) {
  const [enviando, setEnviando] = useState(false);
  const upload = async (file: File) => {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/fulfillment-formulario/${token}/upload`, { method: "POST", body: fd });
      const body = await r.json();
      if (r.ok) onChange({ anexoUrl: body.url, anexoNome: body.nomeOriginal });
    } finally {
      setEnviando(false);
    }
  };

  if (linha.anexoUrl) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <a href={linha.anexoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: ROXO, textDecoration: "underline", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linha.anexoNome || "arquivo"}</a>
        <button type="button" onClick={() => onChange({ anexoUrl: "", anexoNome: "" })} style={{ border: "none", background: "none", color: "#9497ab", cursor: "pointer", fontSize: 12 }}>×</button>
      </div>
    );
  }
  return (
    <label style={{ fontSize: 11, color: enviando ? "#9497ab" : CARMIM, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
      {enviando ? "Enviando..." : "📎 Anexar"}
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
    </label>
  );
}

export function FormularioImplantacaoPabx({ token }: { token: string }) {
  const [respostas, setRespostas] = useState<Respostas>(RESPOSTAS_VAZIAS);
  const [carregado, setCarregado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [passo, setPasso] = useState(0);

  const { data, isLoading, error } = useQuery<FormularioData>({
    queryKey: ["fulfillment-formulario-publico", token],
    queryFn: async () => {
      const r = await fetch(`/api/fulfillment-formulario/${token}`);
      if (!r.ok) throw new Error("not-found");
      return r.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (data && !carregado) {
      const rp = data.formulario.respostas || {};
      setRespostas({
        ...RESPOSTAS_VAZIAS,
        ...rp,
        portabilidade: {
          ...PORTABILIDADE_VAZIA,
          ...rp.portabilidade,
          linhas: rp.portabilidade?.linhas?.length ? rp.portabilidade.linhas : PORTABILIDADE_VAZIA.linhas,
        },
        ramais: rp.ramais?.length ? rp.ramais : RESPOSTAS_VAZIAS.ramais,
        ura: { ...URA_VAZIA, ...rp.ura },
      });
      setCarregado(true);
    }
  }, [data, carregado]);

  const enviar = useMutation({
    mutationFn: async () => {
      // Linhas/ramais 100% em branco (das pré-preenchidas) não vão no
      // envio — evita mandar 8 linhas vazias só porque a tabela nasceu
      // com espaço de sobra.
      const payload: Respostas = {
        ...respostas,
        portabilidade: { ...respostas.portabilidade, linhas: respostas.portabilidade.linhas.filter((l) => l.ddd || l.numero || l.anexoUrl) },
        ramais: respostas.ramais.filter((r) => r.ramal || r.nome || r.departamento),
      };
      const r = await fetch(`/api/fulfillment-formulario/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas: payload }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Falha ao enviar formulário");
      return body;
    },
    onSuccess: () => setEnviado(true),
  });

  if (isLoading) return <Shell><Card><p style={{ color: "#9497ab", fontSize: 14 }}>Carregando formulário...</p></Card></Shell>;
  if (error || !data) {
    return <Shell><EstadoFinal tom="erro" titulo="Link inválido" corpo="Confira o link recebido ou fale com quem te enviou a solicitação na Callface." /></Shell>;
  }

  if (enviado) {
    return (
      <Shell>
        <EstadoFinal
          tom="sucesso"
          titulo="Recebemos suas informações"
          corpo="Nosso time vai revisar os dados e dar sequência à implantação. Se faltar algo, entramos em contato."
        />
      </Shell>
    );
  }

  const jaEnviado = JA_ENVIADO.has(data.formulario.status);
  if (jaEnviado && !editando) {
    return (
      <Shell>
        <EstadoFinal
          tom={data.formulario.status === "APPROVED" ? "sucesso" : "neutro"}
          titulo="Formulário já enviado"
          corpo={
            data.formulario.status === "APPROVED"
              ? "Suas informações já foram revisadas e aprovadas pelo nosso time."
              : data.formulario.status === "CORRECTION_REQUIRED"
                ? `Nosso time pediu uma correção nas informações enviadas.${data.formulario.notaRevisao ? ` Observação: "${data.formulario.notaRevisao}"` : ""}`
                : "Recebemos as informações desse formulário. Se algo mudou, você pode editar e reenviar."
          }
        />
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => setEditando(true)}
            style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #ececf2", background: "#fff", color: "#4b4d63", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Editar e reenviar
          </button>
        </div>
      </Shell>
    );
  }

  const PASSOS = ["Início", "Portabilidade", "Ramais", "URA", "Revisão"];
  const p = respostas.portabilidade;
  const u = respostas.ura;
  const ramaisPreenchidos = respostas.ramais.filter((r) => r.ramal || r.departamento || r.nome);
  const numerosDisponiveis = p.linhas.filter((l) => l.ddd && (l.numero || l.novaLinha)).map((l) => (l.novaLinha ? `${l.ddd} (linha nova)` : `${l.ddd} ${l.numero}`));

  const atualizarPortabilidade = (patch: Partial<Portabilidade>) => setRespostas((r) => ({ ...r, portabilidade: { ...r.portabilidade, ...patch } }));
  const atualizarUra = (patch: Partial<Ura>) => setRespostas((r) => ({ ...r, ura: { ...r.ura, ...patch } }));
  const atualizarLinha = (i: number, patch: Partial<LinhaPortabilidade>) => {
    const novas = [...p.linhas];
    novas[i] = { ...novas[i], ...patch };
    atualizarPortabilidade({ linhas: novas });
  };
  const atualizarRamal = (i: number, patch: Partial<RamalItem>) => {
    const novos = [...respostas.ramais];
    novos[i] = { ...novos[i], ...patch };
    setRespostas((r) => ({ ...r, ramais: novos }));
  };

  return (
    <Shell>
      <Card>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#9497ab", textTransform: "uppercase", margin: "0 0 6px" }}>
          Formulário de implantação — PABX
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: TEXTO, margin: "0 0 10px" }}>Levantamento de informações</h1>
        <StepIndicator passos={PASSOS} atual={passo} onJump={setPasso} />
      </Card>

      {passo === 0 && (
        <Card>
          <p style={sectionTitleStyle}>Responsável técnico</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
            Informe aqui os seus dados. Em caso de dúvidas sobre qualquer etapa deste formulário, nosso time entrará em contato com você.
          </p>
          <Field label="Nome" value={p.responsavelTecnico.nome} onChange={(v) => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, nome: v } })} />
          <Field label="E-mail" value={p.responsavelTecnico.email} onChange={(v) => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, email: v } })} placeholder="nome@empresa.com" />
          <Field label="Telefone/Celular" value={p.responsavelTecnico.telefone} onChange={(v) => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, telefone: v } })} />
          <NavegacaoPasso podeVoltar={false} onVoltar={() => {}} onAvancar={() => setPasso(1)} textoAvancar="Continuar" />
        </Card>
      )}

      {passo === 1 && (
        <Card>
          <p style={sectionTitleStyle}>Portabilidade / novas linhas</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
            Preencha uma linha por número. Se for linha nova, marque a caixa e informe só o DDD. Cada número precisa da sua própria fatura anexada.
          </p>
          <div style={{ overflowX: "auto", marginBottom: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>DDD</th>
                  <th style={thStyle}>Número</th>
                  <th style={thStyle}>Linha nova?</th>
                  <th style={thStyle}>Fatura/Documento</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {p.linhas.map((linha, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #ececf2" }}>
                    <td style={{ ...tdStyle, width: 70 }}><input value={linha.ddd} onChange={(e) => atualizarLinha(i, { ddd: e.target.value })} style={inputStyle} placeholder="15" /></td>
                    <td style={tdStyle}><input value={linha.numero} disabled={linha.novaLinha} onChange={(e) => atualizarLinha(i, { numero: e.target.value })} style={{ ...inputStyle, opacity: linha.novaLinha ? 0.4 : 1 }} placeholder="3333-3333" /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><input type="checkbox" checked={linha.novaLinha} onChange={(e) => atualizarLinha(i, { novaLinha: e.target.checked, numero: e.target.checked ? "" : linha.numero })} /></td>
                    <td style={tdStyle}><AnexoCelula token={token} linha={linha} onChange={(patch) => atualizarLinha(i, patch)} /></td>
                    <td style={tdStyle}>
                      <button type="button" onClick={() => atualizarPortabilidade({ linhas: p.linhas.filter((_, idx) => idx !== i) })} style={{ border: "none", background: "none", color: "#9497ab", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => atualizarPortabilidade({ linhas: [...p.linhas, LINHA_VAZIA()] })} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${CARMIM}`, background: "#fff", color: CARMIM, fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
            + Adicionar linha
          </button>

          <p style={{ fontSize: 11, color: "#9497ab", background: "#f7f7fa", padding: 10, borderRadius: 10, marginBottom: 16 }}>
            Importante: se um conjunto de números tiver alguma lacuna não informada, a operadora pode não conseguir liberar aquele número depois. Confira se todos os números do bloco foram incluídos.
          </p>

          <Field label="Razão social ou nome do titular das linhas" value={p.razaoSocialTitular} onChange={(v) => atualizarPortabilidade({ razaoSocialTitular: v })} />
          <Field label="CNPJ ou CPF do titular" value={p.cnpjCpfTitular} onChange={(v) => atualizarPortabilidade({ cnpjCpfTitular: v })} />
          <Field label="Operadora atual" value={p.operadoraAtual} onChange={(v) => atualizarPortabilidade({ operadoraAtual: v })} />

          <NavegacaoPasso podeVoltar onVoltar={() => setPasso(0)} onAvancar={() => setPasso(2)} textoAvancar="Continuar" />
        </Card>
      )}

      {passo === 2 && (
        <Card>
          <p style={sectionTitleStyle}>Ramais</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
            Uma linha por ramal/usuário. Sem pessoa designada? Preencha só o departamento.
          </p>
          <div style={{ overflowX: "auto", marginBottom: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Ramal</th>
                  <th style={thStyle}>Nome</th>
                  <th style={thStyle}>Departamento</th>
                  <th style={thStyle}>Nº externo</th>
                  <th style={thStyle}>Aparelho mesa</th>
                  <th style={thStyle}>Modelo</th>
                  <th style={thStyle}>E-mail</th>
                  <th style={thStyle}>Celular</th>
                  <th style={thStyle}>Lig. perdida</th>
                  <th style={thStyle}>Gravar</th>
                  <th style={thStyle}>Gestor</th>
                  <th style={thStyle}>Internacional</th>
                  <th style={thStyle}>Países</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {respostas.ramais.map((ramal, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #ececf2" }}>
                    <td style={{ ...tdStyle, width: 60 }}><input value={ramal.ramal} onChange={(e) => atualizarRamal(i, { ramal: e.target.value })} style={inputStyle} placeholder="8001" /></td>
                    <td style={tdStyle}><input value={ramal.nome} onChange={(e) => atualizarRamal(i, { nome: e.target.value })} style={inputStyle} /></td>
                    <td style={tdStyle}><input value={ramal.departamento} onChange={(e) => atualizarRamal(i, { departamento: e.target.value })} style={inputStyle} /></td>
                    <td style={tdStyle}><input value={ramal.numeroExterno} onChange={(e) => atualizarRamal(i, { numeroExterno: e.target.value })} style={inputStyle} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><input type="checkbox" checked={ramal.utilizaAparelhoMesa} onChange={(e) => atualizarRamal(i, { utilizaAparelhoMesa: e.target.checked })} /></td>
                    <td style={tdStyle}><input value={ramal.modeloAparelho} disabled={!ramal.utilizaAparelhoMesa} onChange={(e) => atualizarRamal(i, { modeloAparelho: e.target.value })} style={{ ...inputStyle, opacity: ramal.utilizaAparelhoMesa ? 1 : 0.4 }} /></td>
                    <td style={tdStyle}><input value={ramal.email} onChange={(e) => atualizarRamal(i, { email: e.target.value })} style={inputStyle} /></td>
                    <td style={tdStyle}><input value={ramal.celular} onChange={(e) => atualizarRamal(i, { celular: e.target.value })} style={inputStyle} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><input type="checkbox" checked={ramal.notificacaoLigacoesPerdidas} onChange={(e) => atualizarRamal(i, { notificacaoLigacoesPerdidas: e.target.checked })} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><input type="checkbox" checked={ramal.gravarLigacao} onChange={(e) => atualizarRamal(i, { gravarLigacao: e.target.checked })} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><input type="checkbox" checked={ramal.acessoGestor} onChange={(e) => atualizarRamal(i, { acessoGestor: e.target.checked })} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><input type="checkbox" checked={ramal.ligacoesInternacionais} onChange={(e) => atualizarRamal(i, { ligacoesInternacionais: e.target.checked })} /></td>
                    <td style={tdStyle}><input value={ramal.paises} disabled={!ramal.ligacoesInternacionais} onChange={(e) => atualizarRamal(i, { paises: e.target.value })} style={{ ...inputStyle, opacity: ramal.ligacoesInternacionais ? 1 : 0.4 }} /></td>
                    <td style={tdStyle}>
                      <button type="button" onClick={() => setRespostas((r) => ({ ...r, ramais: r.ramais.filter((_, idx) => idx !== i) }))} style={{ border: "none", background: "none", color: "#9497ab", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setRespostas((r) => ({ ...r, ramais: [...r.ramais, RAMAL_VAZIO()] }))} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${CARMIM}`, background: "#fff", color: CARMIM, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            + Adicionar linha
          </button>
          <NavegacaoPasso podeVoltar onVoltar={() => setPasso(1)} onAvancar={() => setPasso(3)} textoAvancar="Continuar" />
        </Card>
      )}

      {passo === 3 && (
        <Card>
          <p style={sectionTitleStyle}>URA</p>

          <p style={labelStyle}>Números atendidos pela URA</p>
          <ChipList itens={u.numerosAtendidos} onRemover={(i) => atualizarUra({ numerosAtendidos: u.numerosAtendidos.filter((_, idx) => idx !== i) })} />
          {numerosDisponiveis.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {numerosDisponiveis.filter((n) => !u.numerosAtendidos.includes(n)).map((n) => (
                <button key={n} type="button" onClick={() => atualizarUra({ numerosAtendidos: [...u.numerosAtendidos, n] })} style={{ padding: "6px 10px", borderRadius: 999, border: "1px dashed #dcdce6", background: "#fff", color: TEXTO, fontSize: 12, cursor: "pointer" }}>
                  + {n}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: "#9497ab", marginBottom: 12 }}>Nenhum número informado no passo de Portabilidade ainda — volte lá se precisar adicionar.</p>
          )}

          <Field label="Dias e horário de atendimento" value={u.diasHorarioAtendimento} onChange={(v) => atualizarUra({ diasHorarioAtendimento: v })} placeholder="Ex.: Segunda a sexta, 09h às 18h" />
          <TextAreaField
            label="Frase de boas-vindas (horário de funcionamento)"
            value={u.fraseBoasVindasHorario}
            onChange={(v) => atualizarUra({ fraseBoasVindasHorario: v })}
            placeholder="Você ligou para a Empresa X! Digite o ramal desejado ou escolha uma opção..."
          />

          <p style={{ ...sectionTitleStyle, marginTop: 16 }}>Opções de encaminhamento</p>
          <p style={{ fontSize: 11, color: "#9497ab", margin: "0 0 10px" }}>Selecione o ramal/departamento (você pode montar uma ordem de preferência, ex.: tenta o 1º, se não atender tenta o 2º).</p>
          {u.opcoes.map((opcao, i) => (
            <div key={i} style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: "#f7f7fa" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input value={opcao.rotulo} onChange={(e) => { const novas = [...u.opcoes]; novas[i] = { ...opcao, rotulo: e.target.value }; atualizarUra({ opcoes: novas }); }} style={{ ...inputStyle, width: 180 }} placeholder={`Opção ${String(i + 1).padStart(2, "0")} — rótulo (ex.: Financeiro)`} />
                {u.opcoes.length > 1 && (
                  <button type="button" onClick={() => atualizarUra({ opcoes: u.opcoes.filter((_, idx) => idx !== i) })} style={{ border: "none", background: "none", color: "#9497ab", cursor: "pointer", fontSize: 12 }}>Remover opção</button>
                )}
              </div>
              <SeletorDestino ramaisDisponiveis={ramaisPreenchidos} valor={opcao.destinos} onChange={(v) => { const novas = [...u.opcoes]; novas[i] = { ...opcao, destinos: v }; atualizarUra({ opcoes: novas }); }} />
            </div>
          ))}
          {u.opcoes.length < 9 && (
            <button type="button" onClick={() => atualizarUra({ opcoes: [...u.opcoes, { rotulo: "", destinos: [] }] })} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${CARMIM}`, background: "#fff", color: CARMIM, fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
              + Adicionar opção
            </button>
          )}

          <p style={labelStyle}>Se nenhuma opção for selecionada, encaminhar para</p>
          <SeletorDestino ramaisDisponiveis={ramaisPreenchidos} valor={u.semOpcaoSelecionada} onChange={(v) => atualizarUra({ semOpcaoSelecionada: v })} />

          <p style={{ ...sectionTitleStyle, marginTop: 16 }}>Fora do horário de expediente</p>
          <TextAreaField label="Frase de boas-vindas fora do horário" value={u.fraseBoasVindasForaHorario} onChange={(v) => atualizarUra({ fraseBoasVindasForaHorario: v })} placeholder="Você ligou para a Empresa X! Nosso horário é..." />
          <p style={labelStyle}>Encaminhamento fora do horário</p>
          <SeletorDestino ramaisDisponiveis={ramaisPreenchidos} valor={u.encaminhamentoForaHorario} onChange={(v) => atualizarUra({ encaminhamentoForaHorario: v })} />

          <Field label="Voz selecionada para gravação" value={u.vozSelecionada} onChange={(v) => atualizarUra({ vozSelecionada: v })} placeholder="Ex.: Camila" />
          <p style={{ fontSize: 11, color: "#9497ab", background: "#f7f7fa", padding: 10, borderRadius: 10 }}>
            Se sua empresa já tem um fluxo de URA mais complexo documentado ou uma gravação existente que quer manter, envie por e-mail ao gestor do seu projeto.
          </p>

          <NavegacaoPasso podeVoltar onVoltar={() => setPasso(2)} onAvancar={() => setPasso(4)} textoAvancar="Continuar" />
        </Card>
      )}

      {passo === 4 && (
        <Card>
          <p style={sectionTitleStyle}>Outras informações</p>
          <TextAreaField
            label="Algo mais que devemos saber?"
            value={respostas.outrasInformacoes}
            onChange={(v) => setRespostas((r) => ({ ...r, outrasInformacoes: v }))}
            placeholder="Qualquer outra informação relevante pra sua implantação"
          />

          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#f7f7fa" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: TEXTO, margin: "0 0 8px" }}>Resumo rápido</p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>{p.linhas.filter((l) => l.ddd || l.numero).length} número(s)/linha(s) informado(s)</p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>{ramaisPreenchidos.length} ramal(is) cadastrado(s)</p>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>{u.opcoes.filter((o) => o.destinos.length > 0).length} opção(ões) de URA configurada(s)</p>
          </div>

          <NavegacaoPasso podeVoltar onVoltar={() => setPasso(3)} onAvancar={() => enviar.mutate()} textoAvancar={enviar.isPending ? "Enviando..." : "Enviar informações"} />
          {enviar.isError && <p style={{ color: CARMIM, fontSize: 12, marginTop: 8 }}>{(enviar.error as Error).message}</p>}
        </Card>
      )}
    </Shell>
  );
}
