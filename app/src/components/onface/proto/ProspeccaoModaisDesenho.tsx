"use client";

/* DERIVADO do modal de exportação de PreVendasDesenho.tsx e dos modais de
 * PecasDesenho.tsx (nutrir, desqualificar): mesma cortina, mesmo cartão de 13px
 * de raio, mesmo cabeçalho (título Plus Jakarta 15/700 e apoio 12.5px), mesmas
 * opções em linha com marcador redondo, mesmo rodapé #fafafa com Cancelar e a
 * ação principal em coral.
 *
 * Cada diálogo só pergunta o que o backend exige (cadência, motivo, família e
 * responsável, confirmação da resposta, empresa nova, CSV, valor da ação em
 * massa). A regra mora no domínio; aqui é só a pergunta.
 */

import * as React from "react";
import { FAMILIAS, MOTIVOS_DESCARTE, ROTULO_FAMILIA, type Familia, type MotivoDescarte } from "@/lib/vendas/dominio";
import { lerCsvProspects, type LinhaCsvProspect, type OperacaoMassa } from "../vendas/prospeccao-acoes";
import { estilo, hover } from "./proto-runtime";

export interface EntradaProspect {
  empresa: string; cnpj?: string | null; website?: string | null; pessoaNome?: string | null; cargo?: string | null;
  email?: string | null; telefone?: string | null; fonte?: string | null; lista?: string | null; responsavelId?: string | null;
}
type Pessoa = { id: string; nome: string };

const CAMPO = "width:100%;height:34px;padding:0 10px;border-radius:8px;border:0;background:#fff;box-shadow:inset 0 0 0 1px #dbdede;font-size:13px;color:#12171d;outline:none";
const ROTULO = { fontSize: "11px", fontWeight: 600, color: "#4a5560", marginBottom: "5px", display: "block" } as const;

function Icone({ d }: { d: string }) {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={d} /></svg>;
}

export function Modal({ aberto, fechar, titulo, descricao, largura = 520, rodape, children }: {
  aberto: boolean; fechar: () => void; titulo: string; descricao?: string; largura?: number;
  rodape: React.ReactNode; children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto, fechar]);
  if (!aberto) return null;
  return (
    <div data-r="modal-fundo" onClick={fechar} style={{ position: "fixed", inset: 0, background: "rgba(9,14,20,.45)", zIndex: 54, display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}
        style={{ width: `${largura}px`, maxWidth: "100%", maxHeight: "calc(100vh - 40px)", background: "#fff", borderRadius: "13px", overflow: "hidden", display: "flex", flexDirection: "column", animation: "of-rise .2s cubic-bezier(.2,0,.2,1) both" }}>
        <div style={{ flex: "0 0 auto", padding: "15px 18px 13px", borderBottom: "1px solid #e3e7e8", display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "15px", fontWeight: 700, letterSpacing: "-.01em", marginBottom: "3px" }}>{titulo}</div>
            {descricao ? <div style={{ fontSize: "12.5px", color: "#4a5560", lineHeight: 1.45, textWrap: "pretty" }}>{descricao}</div> : null}
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar" style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", color: "#4a5560" }} className={hover("background:#f1f3f3;color:#12171d")}>
            <Icone d="M6 6l12 12M18 6L6 18" />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>{children}</div>
        <div style={{ flex: "0 0 auto", padding: "12px 18px", borderTop: "1px solid #e3e7e8", background: "#fafafa", display: "flex", gap: "9px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>{rodape}</div>
      </div>
    </div>
  );
}

function BotaoCancelar({ fechar }: { fechar: () => void }) {
  return <button type="button" onClick={fechar} style={{ height: "34px", padding: "0 14px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12.5px", fontWeight: 500, whiteSpace: "nowrap" }} className={hover("background:#f1f3f3")}>Cancelar</button>;
}
function BotaoPrincipal({ children, onClick, off }: { children: React.ReactNode; onClick: () => void; off?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={off}
      style={estilo("height:34px;padding:0 14px;border-radius:8px;border:0;font-size:12.5px;font-weight:600;white-space:nowrap;display:flex;align-items:center;gap:6px;" + (off ? "background:#eeeff3;color:#a3a8a4;cursor:not-allowed" : "background:#d93c1a;color:#fff;cursor:pointer"))}
      className={off ? undefined : hover("background:#c2330f")}>{children}</button>
  );
}
function Aviso({ texto }: { texto: string | null }) {
  return texto ? <div role="alert" style={{ padding: "9px 11px", borderRadius: "8px", background: "#fff6f4", boxShadow: "inset 0 0 0 1px #fadfd8", fontSize: "12.5px", color: "#9c3210", lineHeight: 1.45 }}>{texto}</div> : null;
}
function Opcao({ rotulo, nota, on, onClick, multi = false }: { rotulo: string; nota?: string; on: boolean; onClick: () => void; multi?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      style={estilo("display:flex;align-items:center;gap:10px;width:100%;padding:8px 11px;border-radius:9px;border:0;cursor:pointer;background:#fff;text-align:left;" + (on ? "box-shadow:inset 0 0 0 1.5px #fe4f2b;background:#fff7f5" : "box-shadow:inset 0 0 0 1px #dbdede"))}>
      <span style={estilo("flex:0 0 auto;width:17px;height:17px;display:grid;place-items:center;border-radius:" + (multi ? "5px" : "9999px") + ";" + (on ? "background:#fe4f2b;box-shadow:inset 0 0 0 1px #fe4f2b" : "background:#fff;box-shadow:inset 0 0 0 1.5px #c8ccc9"))}>
        {on ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "13px", fontWeight: 500 }}>{rotulo}</span>
        {nota ? <span style={{ display: "block", fontSize: "11.5px", color: "#4a5560", lineHeight: 1.4 }}>{nota}</span> : null}
      </span>
    </button>
  );
}
const Campo = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <label style={{ display: "block" }}><span style={ROTULO}>{rotulo}</span>{children}</label>
);

/* ── Adicionar empresa ── */
export function ModalNovoProspect({ aberto, fechar, listas, responsaveis, pendente, erro, confirmar }: {
  aberto: boolean; fechar: () => void; listas: string[]; responsaveis: Pessoa[]; pendente: boolean; erro: string | null;
  confirmar: (e: EntradaProspect) => void;
}) {
  const [f, setF] = React.useState<EntradaProspect>({ empresa: "" });
  const c = (k: keyof EntradaProspect) => ({
    value: (f[k] as string) ?? "", style: estilo(CAMPO),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value })),
  });
  return (
    <Modal aberto={aberto} fechar={fechar} largura={560} titulo="Adicionar empresa ao outbound"
      descricao="Empresa já existente é reaproveitada, não duplicada. A pessoa é opcional: em outbound, enriquecer depois é parte do processo."
      rodape={<><BotaoCancelar fechar={fechar} /><BotaoPrincipal off={pendente || !f.empresa.trim()} onClick={() => confirmar(f)}>{pendente ? "Adicionando…" : "Adicionar"}</BotaoPrincipal></>}>
      <Aviso texto={erro} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "12px" }}>
        <Campo rotulo="Empresa *"><input {...c("empresa")} /></Campo>
        <Campo rotulo="CNPJ"><input {...c("cnpj")} /></Campo>
        <Campo rotulo="Site"><input {...c("website")} /></Campo>
        <Campo rotulo="Fonte"><input {...c("fonte")} placeholder="Apollo, CSV, manual…" /></Campo>
        <Campo rotulo="Contato"><input {...c("pessoaNome")} /></Campo>
        <Campo rotulo="Cargo"><input {...c("cargo")} /></Campo>
        <Campo rotulo="E-mail"><input type="email" {...c("email")} /></Campo>
        <Campo rotulo="Telefone"><input {...c("telefone")} /></Campo>
        <Campo rotulo="Lista"><input list="listas-prospeccao" {...c("lista")} /><datalist id="listas-prospeccao">{listas.map((l) => <option key={l} value={l} />)}</datalist></Campo>
        <Campo rotulo="Responsável">
          <select {...c("responsavelId")}><option value="">Sem responsável</option>{responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select>
        </Campo>
      </div>
    </Modal>
  );
}

/* ── Cadência ── */
export function ModalCadencia({ aberto, fechar, cadencias, pendente, erro, escolher }: {
  aberto: boolean; fechar: () => void; cadencias: Pessoa[]; pendente: boolean; erro: string | null; escolher: (id: string) => void;
}) {
  const [id, setId] = React.useState<string | null>(null);
  return (
    <Modal aberto={aberto} fechar={fechar} titulo="Adicionar à cadência"
      descricao="A Prospecção consome o motor de cadências; a configuração dos passos vive em Automações."
      rodape={<><BotaoCancelar fechar={fechar} /><BotaoPrincipal off={pendente || !id} onClick={() => id && escolher(id)}>{pendente ? "Iniciando…" : "Iniciar cadência"}</BotaoPrincipal></>}>
      <Aviso texto={erro} />
      {cadencias.length === 0 ? <div style={{ fontSize: "12.5px", color: "#4a5560" }}>Nenhuma cadência ativa para leads. Crie uma em Automações › Cadências.</div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {cadencias.map((c) => <Opcao key={c.id} rotulo={c.nome} on={id === c.id} onClick={() => setId(c.id)} />)}
      </div>
    </Modal>
  );
}

/* ── Descartar ── */
export function ModalDescartar({ aberto, fechar, pendente, erro, confirmar }: {
  aberto: boolean; fechar: () => void; pendente: boolean; erro: string | null; confirmar: (m: MotivoDescarte) => void;
}) {
  const [m, setM] = React.useState<MotivoDescarte | null>(null);
  return (
    <Modal aberto={aberto} fechar={fechar} titulo="Descartar prospect"
      descricao="Em Prospecção é descarte, não desqualificação. O motivo é obrigatório e o histórico não é apagado."
      rodape={<><BotaoCancelar fechar={fechar} /><BotaoPrincipal off={pendente || !m} onClick={() => m && confirmar(m)}>{pendente ? "Descartando…" : "Descartar"}</BotaoPrincipal></>}>
      <Aviso texto={erro} />
      <div>
        <span style={ROTULO}>Motivo</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {MOTIVOS_DESCARTE.map((x) => <Opcao key={x.chave} rotulo={x.rotulo} on={m === x.chave} onClick={() => setM(x.chave)} />)}
        </div>
      </div>
    </Modal>
  );
}

/* ── Oportunidade direta ── */
export function ModalOportunidade({ aberto, fechar, responsaveis, pendente, erro, confirmar }: {
  aberto: boolean; fechar: () => void; responsaveis: Pessoa[]; pendente: boolean; erro: string | null;
  confirmar: (familias: Familia[], responsavelId: string) => void;
}) {
  const [familias, setFamilias] = React.useState<Familia[]>([]);
  const [resp, setResp] = React.useState("");
  return (
    <Modal aberto={aberto} fechar={fechar} titulo="Oportunidade direta"
      descricao="Vai direto para o Pipeline, sem criar Lead de Pré-vendas. A origem fica registrada como prospecção direta."
      rodape={<><BotaoCancelar fechar={fechar} /><BotaoPrincipal off={pendente || familias.length === 0 || !resp} onClick={() => confirmar(familias, resp)}>{pendente ? "Criando…" : "Criar oportunidade"}</BotaoPrincipal></>}>
      <Aviso texto={erro} />
      <div>
        <span style={ROTULO}>Família de serviço</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {FAMILIAS.map((f) => <Opcao key={f} multi rotulo={ROTULO_FAMILIA[f]} on={familias.includes(f)} onClick={() => setFamilias((a) => (a.includes(f) ? a.filter((x) => x !== f) : [...a, f]))} />)}
        </div>
        {familias.length > 1 ? <div style={{ marginTop: "7px", fontSize: "12px", color: "#4a5560" }}>{familias.length} oportunidades irmãs, mesmo bundle, fechamento independente.</div> : null}
      </div>
      <Campo rotulo="Responsável comercial *">
        <select value={resp} onChange={(e) => setResp(e.target.value)} style={estilo(CAMPO)}><option value="">Escolha</option>{responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select>
      </Campo>
    </Modal>
  );
}

/* ── Resposta sem evidência ── */
const CANAIS = ["WhatsApp", "E-mail", "Telefone", "LinkedIn", "Presencial", "Outro"];
export function ModalResposta({ aberto, fechar, pendente, erro, confirmar }: {
  aberto: boolean; fechar: () => void; pendente: boolean; erro: string | null; confirmar: (canal: string, observacao: string) => void;
}) {
  const [canal, setCanal] = React.useState("WhatsApp");
  const [obs, setObs] = React.useState("");
  return (
    <Modal aberto={aberto} fechar={fechar} titulo="Confirmar resposta manualmente"
      descricao="Não há resposta deste prospect registrada no Atendimento nem na cadência. Se ele respondeu por outro meio, confirme aqui: a confirmação fica auditada no histórico, com o seu nome."
      rodape={<><BotaoCancelar fechar={fechar} /><BotaoPrincipal off={pendente || obs.trim().length < 3} onClick={() => confirmar(canal, obs)}>{pendente ? "Confirmando…" : "Confirmar resposta"}</BotaoPrincipal></>}>
      <Aviso texto={erro} />
      <Campo rotulo="Canal da resposta"><select value={canal} onChange={(e) => setCanal(e.target.value)} style={estilo(CAMPO)}>{CANAIS.map((c) => <option key={c}>{c}</option>)}</select></Campo>
      <Campo rotulo="O que ele respondeu *"><textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: pediu proposta por telefone" style={estilo(CAMPO + ";height:auto;padding:8px 10px;resize:vertical")} /></Campo>
    </Modal>
  );
}

/* ── Ação em massa que pede texto ── */
const TEXTO_MASSA: Partial<Record<OperacaoMassa, { titulo: string; descricao: string; rotulo: string; confirmar: string }>> = {
  lista: { titulo: "Adicionar à lista", descricao: "Escolha uma lista existente para reaproveitar, ou digite um nome novo para criar.", rotulo: "Lista", confirmar: "Adicionar" },
  tag: { titulo: "Adicionar tag", descricao: "A tag é criada se ainda não existir, e aplicada a todas as empresas selecionadas.", rotulo: "Tag", confirmar: "Adicionar" },
};
export function ModalMassaTexto({ operacao, quantidade, listas, fechar, pendente, erro, confirmar }: {
  operacao: OperacaoMassa | null; quantidade: number; listas: string[]; fechar: () => void; pendente: boolean; erro: string | null;
  confirmar: (valor: string) => void;
}) {
  const [v, setV] = React.useState("");
  const t = operacao ? TEXTO_MASSA[operacao] : undefined;
  if (!operacao || !t) return null;
  return (
    <Modal aberto fechar={fechar} titulo={`${t.titulo} · ${quantidade} ${quantidade === 1 ? "empresa" : "empresas"}`} descricao={t.descricao}
      rodape={<><BotaoCancelar fechar={fechar} /><BotaoPrincipal off={pendente || !v.trim()} onClick={() => confirmar(v)}>{t.confirmar}</BotaoPrincipal></>}>
      <Aviso texto={erro} />
      <Campo rotulo={t.rotulo}>
        <input list="listas-massa" value={v} onChange={(e) => setV(e.target.value)} placeholder={`Nome da ${t.rotulo.toLowerCase()}`} style={estilo(CAMPO)} />
        {operacao === "lista" ? <datalist id="listas-massa">{listas.map((l) => <option key={l} value={l} />)}</datalist> : null}
      </Campo>
    </Modal>
  );
}

/* ── Importar CSV ── */
export function ModalImportar({ aberto, fechar, listas, responsaveis, pendente, erro, confirmar }: {
  aberto: boolean; fechar: () => void; listas: string[]; responsaveis: Pessoa[]; pendente: boolean; erro: string | null;
  confirmar: (linhas: LinhaCsvProspect[], comum: { lista: string | null; responsavelId: string | null; fonte: string | null }) => void;
}) {
  const [leitura, setLeitura] = React.useState<(ReturnType<typeof lerCsvProspects> & { arquivo: string }) | null>(null);
  const [lista, setLista] = React.useState("");
  const [resp, setResp] = React.useState("");
  const [fonte, setFonte] = React.useState("CSV");
  async function ler(a: File | undefined) { if (a) setLeitura({ ...lerCsvProspects(await a.text()), arquivo: a.name }); }
  /* O CSV de exemplo tem exatamente as colunas que `lerCsvProspects` reconhece. BOM para o Excel abrir com acento certo. */
  function baixarModelo() {
    const m = [
      ["empresa", "cnpj", "site", "contato", "cargo", "email", "telefone"],
      ["Nexa Tecnologia", "12.345.678/0001-90", "nexa.com.br", "Mariana Souza", "Head de CX", "mariana@nexa.com.br", "+55 11 99999-9999"],
      ["Vetor Log", "", "vetorlog.com.br", "Paula Reis", "Diretora de Operações", "paula@vetorlog.com.br", "+55 21 97777-6666"],
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + m.map((l) => l.join(";")).join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "onface-modelo-prospeccao.csv"; document.body.appendChild(a); a.click(); a.remove();
  }
  const linhas = leitura?.linhas ?? [];
  const excede = linhas.length > 500;
  return (
    <Modal aberto={aberto} fechar={fechar} largura={560} titulo="Importar empresas (CSV)"
      descricao="Colunas reconhecidas: empresa (obrigatória), cnpj, site, contato, cargo, e-mail, telefone. Separador ; ou ,. Empresa que já está na base é reaproveitada, não duplicada."
      rodape={<><BotaoCancelar fechar={fechar} /><BotaoPrincipal off={pendente || linhas.length === 0 || excede} onClick={() => confirmar(linhas, { lista: lista || null, responsavelId: resp || null, fonte: fonte || null })}>{pendente ? "Importando…" : `Importar ${linhas.length || ""}`.trim()}</BotaoPrincipal></>}>
      <Aviso texto={erro} />
      <Campo rotulo="Arquivo"><input type="file" accept=".csv,text/csv" onChange={(e) => ler(e.target.files?.[0])} style={{ fontSize: "12.5px" }} /></Campo>
      <button type="button" onClick={baixarModelo} style={{ alignSelf: "flex-start", height: "30px", padding: "0 11px", borderRadius: "8px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "12px", fontWeight: 500 }} className={hover("background:#f6f7f7")}>Baixar modelo (CSV de exemplo)</button>
      {leitura?.erro ? <Aviso texto={leitura.erro} /> : null}
      {leitura && !leitura.erro ? (
        <div role="status" style={{ fontSize: "12.5px", color: "#1f252c", lineHeight: 1.45 }}>
          {leitura.arquivo}: {linhas.length} {linhas.length === 1 ? "linha pronta" : "linhas prontas"} para importar
          {leitura.recusadas.length ? `; ${leitura.recusadas.length} sem empresa (linha ${leitura.recusadas.slice(0, 8).join(", ")}${leitura.recusadas.length > 8 ? "…" : ""})` : ""}.
          {excede ? " Acima de 500 linhas: divida o arquivo em lotes." : ""}
        </div>
      ) : null}
      {linhas.length > 0 ? (
        <div style={{ borderRadius: "9px", background: "#fafafa", boxShadow: "inset 0 0 0 1px #eef1f1", padding: "9px 11px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
          {linhas.slice(0, 5).map((l, i) => <div key={i}><strong>{l.empresa}</strong>{l.pessoaNome ? ` · ${l.pessoaNome}` : ""}{l.email ? ` · ${l.email}` : ""}</div>)}
          {linhas.length > 5 ? <div style={{ color: "#4a5560" }}>e mais {linhas.length - 5}…</div> : null}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px" }}>
        <Campo rotulo="Lista (opcional)"><input list="listas-importar" value={lista} onChange={(e) => setLista(e.target.value)} placeholder="Ex.: Feira SP outubro" style={estilo(CAMPO)} /><datalist id="listas-importar">{listas.map((l) => <option key={l} value={l} />)}</datalist></Campo>
        <Campo rotulo="Responsável"><select value={resp} onChange={(e) => setResp(e.target.value)} style={estilo(CAMPO)}><option value="">Sem responsável</option>{responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></Campo>
        <Campo rotulo="Fonte"><input value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="CSV, feira, LinkedIn…" style={estilo(CAMPO)} /></Campo>
      </div>
    </Modal>
  );
}
