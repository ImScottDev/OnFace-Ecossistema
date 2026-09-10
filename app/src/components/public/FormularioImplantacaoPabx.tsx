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

interface ContatoTecnico {
  nome: string;
  email: string;
  telefone: string;
  cargo?: string;
  departamento?: string;
  melhorHorario?: string;
  canalPreferencial?: "whatsapp" | "email" | "telefone" | "";
}

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

const linhaTemDado = (l: LinhaPortabilidade) => !!(l.ddd || l.numero || l.novaLinha || l.anexoUrl);
const ramalTemDado = (r: RamalItem) => !!(
  r.ramal || r.nome || r.departamento || r.numeroExterno || r.modeloAparelho || r.email
  || r.celular || r.paises || r.utilizaAparelhoMesa || r.notificacaoLigacoesPerdidas
  || r.gravarLigacao || r.acessoGestor || r.ligacoesInternacionais
);

/**
 * Índice (1-based) do último item com algum dado preenchido, ou 0 se nenhum.
 *
 * Achado real (10/09/2026, reclamação de cliente em produção): "+ Adicionar
 * linha/ramal" empurrava um item VAZIO pro array, mas a lista visível filtrava
 * exatamente os itens vazios — a linha nova nascia escondida e o clique
 * parecia não fazer nada. A visibilidade agora é por CONTAGEM revelada
 * (`linhasReveladas`/`ramaisRevelados`, abaixo), não por "tem conteúdo": o
 * botão sempre soma +1 à contagem, então a linha nova aparece sempre.
 */
function contarPreenchidos<T>(itens: T[], temDado: (item: T) => boolean): number {
  let ultimo = 0;
  itens.forEach((item, i) => { if (temDado(item)) ultimo = i + 1; });
  return ultimo;
}

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
    <div className="public-pabx-shell" style={{ minHeight: "100vh", background: "#f7f7fa", display: "flex", justifyContent: "center", padding: "34px 20px 28px" }}>
      <style>{`
        .public-pabx-shell *, .public-pabx-shell *::before, .public-pabx-shell *::after { box-sizing: border-box; }
        .public-pabx-container { width: 100%; max-width: 1160px; }
        .public-pabx-header { display: flex; justify-content: center; text-align: center; margin: 0 auto 24px; }
        .public-pabx-header h1 { font-size: clamp(28px, 4vw, 42px); line-height: 1.08; letter-spacing: -0.8px; }
        .public-pabx-grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; align-items: start; }
        .public-pabx-grid.is-dense { grid-template-columns: minmax(0, 1fr); }
        .public-pabx-grid.is-dense .public-pabx-aside { display: none; }
        .public-pabx-data-table { min-width: 1180px; }
        .public-pabx-data-table input:not([type="checkbox"]) { min-width: 86px; }
        .public-pabx-data-table input[type="checkbox"] { min-width: auto; }
        .public-pabx-ramais-table { min-width: 1740px; table-layout: fixed; }
        .public-pabx-ramais-table th:nth-child(1), .public-pabx-ramais-table td:nth-child(1) { width: 100px; }
        .public-pabx-ramais-table th:nth-child(2), .public-pabx-ramais-table td:nth-child(2) { width: 170px; }
        .public-pabx-ramais-table th:nth-child(3), .public-pabx-ramais-table td:nth-child(3) { width: 180px; }
        .public-pabx-ramais-table th:nth-child(4), .public-pabx-ramais-table td:nth-child(4) { width: 140px; }
        .public-pabx-ramais-table th:nth-child(5), .public-pabx-ramais-table td:nth-child(5) { width: 130px; }
        .public-pabx-ramais-table th:nth-child(6), .public-pabx-ramais-table td:nth-child(6) { width: 160px; }
        .public-pabx-ramais-table th:nth-child(7), .public-pabx-ramais-table td:nth-child(7) { width: 230px; }
        .public-pabx-ramais-table th:nth-child(8), .public-pabx-ramais-table td:nth-child(8) { width: 170px; }
        .public-pabx-ramais-table th:nth-child(9), .public-pabx-ramais-table td:nth-child(9), .public-pabx-ramais-table th:nth-child(10), .public-pabx-ramais-table td:nth-child(10), .public-pabx-ramais-table th:nth-child(11), .public-pabx-ramais-table td:nth-child(11), .public-pabx-ramais-table th:nth-child(12), .public-pabx-ramais-table td:nth-child(12) { width: 100px; }
        .public-pabx-ramais-table th:nth-child(13), .public-pabx-ramais-table td:nth-child(13) { width: 160px; }
        .public-pabx-ramais-table th:last-child, .public-pabx-ramais-table td:last-child { width: 44px; }
        .public-pabx-ramais-table input:not([type="checkbox"]) { min-width: 0; }
        .public-pabx-table-hint { margin: 2px 0 10px; color: #9497ab; font-size: 11px; }
        .public-pabx-progress-mini { margin: 0 0 20px; padding: 12px 14px; border: 1px solid #ececf2; border-radius: 10px; background: #fafafd; }
        .public-pabx-progress-mini-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #6f7389; font-size: 12px; font-weight: 700; }
        .public-pabx-progress-mini-bar { height: 6px; margin-top: 8px; overflow: hidden; border-radius: 99px; background: #e9eaf0; }
        .public-pabx-progress-mini-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, ${CARMIM}, ${ROXO}); }
        .public-pabx-ramais-list { display: grid; gap: 14px; margin-bottom: 14px; }
        .public-pabx-ramal-card { padding: 16px; border: 1px solid #e5e6ee; border-radius: 14px; background: #fff; }
        .public-pabx-ramal-card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .public-pabx-ramal-fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 14px; }
        .public-pabx-ramal-permissions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 14px; align-items: end; padding-top: 4px; }
        @media (min-width: 621px) { .public-pabx-international-field { transform: translateY(17px); } }
        .public-pabx-check-field { min-height: 42px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid #e2e3eb; border-radius: 8px; color: #596078; font-size: 12px; font-weight: 600; }
        .public-pabx-check-field input { width: 16px; height: 16px; accent-color: ${CARMIM}; }
        .public-pabx-ramal-permissions .public-pabx-countries { grid-column: span 2; }
        .public-pabx-portabilidade-list { display: grid; gap: 14px; margin-bottom: 14px; }
        .public-pabx-portabilidade-card { padding: 16px; border: 1px solid #e5e6ee; border-radius: 14px; background: #fff; }
        .public-pabx-portabilidade-card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .public-pabx-portabilidade-fields { display: grid; grid-template-columns: minmax(120px, .45fr) minmax(220px, 1fr) minmax(170px, .55fr); gap: 0 14px; }
        .public-pabx-upload-field { padding: 12px; border: 1px dashed #d9dbe5; border-radius: 10px; background: #fafafd; }
        .public-pabx-upload-trigger { display: inline-flex; align-items: center; min-height: 38px; padding: 8px 12px; border: 1px solid ${CARMIM}; border-radius: 8px; background: #fff; color: ${CARMIM}; font-size: 12px; font-weight: 700; cursor: pointer; }
        @media (max-width: 620px) { .public-pabx-portabilidade-fields { grid-template-columns: 1fr; } }
        .public-pabx-main > div:last-child { margin-bottom: 0; }
        .public-pabx-aside { position: sticky; top: 20px; }
        .public-pabx-stepper { display: flex; align-items: flex-start; gap: 0; margin-top: 28px; }
        .public-pabx-step { position: relative; flex: 1; text-align: center; min-width: 0; }
        .public-pabx-step:not(:last-child)::after { content: ""; position: absolute; top: 18px; left: calc(50% + 22px); right: calc(-50% + 22px); height: 2px; background: #e9e9f0; }
        .public-pabx-step.is-complete:not(:last-child)::after, .public-pabx-step.is-current:not(:last-child)::after { background: linear-gradient(90deg, ${CARMIM}, #c13ad9); }
        .public-pabx-step-dot { position: relative; z-index: 1; width: 36px; height: 36px; margin: 0 auto 9px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #e3e4ec; background: #fff; color: #8c8fa3; font-size: 13px; font-weight: 800; }
        .public-pabx-step.is-current .public-pabx-step-dot, .public-pabx-step.is-complete .public-pabx-step-dot { border-color: ${CARMIM}; background: ${CARMIM}; color: #fff; box-shadow: 0 5px 14px rgba(226,55,82,.18); }
        .public-pabx-step-label { display: block; color: #7e8196; font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .public-pabx-step.is-current .public-pabx-step-label { color: ${CARMIM}; }
        .public-pabx-step-state { display: block; margin-top: 4px; color: #a1a3b3; font-size: 11px; }
        .public-pabx-step.is-current .public-pabx-step-state { color: ${CARMIM}; }
        .public-pabx-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 22px; }
        .public-pabx-form-grid > * { min-width: 0; }
        .public-pabx-span-2 { grid-column: 1 / -1; }
        .public-pabx-channel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .public-pabx-channel { min-height: 52px; border: 1px solid #e2e3eb; border-radius: 10px; background: #fff; color: ${TEXTO}; font-size: 13px; font-weight: 700; cursor: pointer; }
        .public-pabx-channel.is-selected { border-color: ${CARMIM}; background: #fff1f4; color: ${CARMIM}; box-shadow: 0 0 0 2px rgba(226,55,82,.08); }
        .public-pabx-progress-ring { width: 138px; height: 138px; margin: 8px auto 20px; border-radius: 50%; display: grid; place-items: center; }
        .public-pabx-progress-ring-inner { width: 112px; height: 112px; border-radius: 50%; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .public-pabx-footer { padding: 20px 0 0; color: #9a9cad; font-size: 11px; text-align: center; }
        @media (max-width: 820px) {
          .public-pabx-grid { grid-template-columns: 1fr; }
          .public-pabx-aside { position: static; order: -1; }
          .public-pabx-progress-card { display: none; }
        }
        @media (max-width: 620px) {
          .public-pabx-shell { padding: 24px 12px; }
          .public-pabx-stepper { gap: 2px; margin-top: 22px; }
          .public-pabx-step-label { font-size: 10px; }
          .public-pabx-step-state { display: none; }
          .public-pabx-step:not(:last-child)::after { left: calc(50% + 19px); right: calc(-50% + 19px); }
          .public-pabx-step-dot { width: 32px; height: 32px; font-size: 12px; }
          .public-pabx-form-grid, .public-pabx-channel-grid, .public-pabx-ramal-fields { grid-template-columns: 1fr; }
          .public-pabx-ramal-permissions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .public-pabx-ramal-permissions .public-pabx-countries { grid-column: 1 / -1; }
          .public-pabx-span-2 { grid-column: auto; }
        }
      `}</style>
      <div className="public-pabx-container">
        <div className="public-pabx-header">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/callface-logo.svg" alt="Callface" style={{ height: 38 }} />
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

const PAISES = `Afeganistão|África do Sul|Albânia|Alemanha|Andorra|Angola|Antígua e Barbuda|Arábia Saudita|Argélia|Argentina|Armênia|Austrália|Áustria|Azerbaijão|Bahamas|Bahrein|Bangladesh|Barbados|Belarus|Bélgica|Belize|Benin|Bhutan|Bolívia|Bósnia e Herzegovina|Botsuana|Brasil|Brunei|Bulgária|Burkina Faso|Burundi|Cabo Verde|Camarões|Camboja|Canadá|Catar|Cazaquistão|Chade|Chile|China|Chipre|Colômbia|Comores|Congo|Coreia do Norte|Coreia do Sul|Costa do Marfim|Costa Rica|Croácia|Cuba|Dinamarca|Djibuti|Dominica|Egito|El Salvador|Emirados Árabes Unidos|Equador|Eritreia|Eslováquia|Eslovênia|Espanha|Estados Unidos|Estônia|Eswatini|Etiópia|Fiji|Filipinas|Finlândia|França|Gabão|Gâmbia|Gana|Geórgia|Granada|Grécia|Guatemala|Guiana|Guiné|Guiné-Bissau|Guiné Equatorial|Haiti|Honduras|Hungria|Iêmen|Ilhas Marshall|Ilhas Salomão|Índia|Indonésia|Irã|Iraque|Irlanda|Islândia|Israel|Itália|Jamaica|Japão|Jordânia|Kiribati|Kuwait|Laos|Lesoto|Letônia|Líbano|Libéria|Líbia|Liechtenstein|Lituânia|Luxemburgo|Macedônia do Norte|Madagascar|Malásia|Malaui|Maldivas|Mali|Malta|Marrocos|Maurício|Mauritânia|México|Mianmar|Micronésia|Moçambique|Moldávia|Mônaco|Mongólia|Montenegro|Namíbia|Nauru|Nepal|Nicarágua|Níger|Nigéria|Noruega|Nova Zelândia|Omã|Países Baixos|Palau|Panamá|Papua-Nova Guiné|Paquistão|Paraguai|Peru|Polônia|Portugal|Quênia|Quirguistão|Reino Unido|República Centro-Africana|República Democrática do Congo|República Dominicana|República Tcheca|Romênia|Ruanda|Rússia|Samoa|San Marino|Santa Lúcia|São Cristóvão e Névis|São Tomé e Príncipe|São Vicente e Granadinas|Seicheles|Senegal|Serra Leoa|Sérvia|Singapura|Síria|Somália|Sri Lanka|Sudão|Sudão do Sul|Suécia|Suíça|Suriname|Tailândia|Tajiquistão|Tanzânia|Timor-Leste|Togo|Tonga|Trinidad e Tobago|Tunísia|Turcomenistão|Turquia|Tuvalu|Ucrânia|Uganda|Uruguai|Uzbequistão|Vanuatu|Vaticano|Venezuela|Vietnã|Zâmbia|Zimbábue`.split("|");

function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos.length ? `(${digitos}` : "";
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function Field({ label, value, onChange, placeholder, mask, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mask?: "telefone"; disabled?: boolean }) {
  const valorVisivel = mask === "telefone" ? formatarTelefone(value) : value;
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      <input value={valorVisivel} disabled={disabled} onChange={(e) => onChange(mask === "telefone" ? formatarTelefone(e.target.value) : e.target.value)} placeholder={placeholder} inputMode={mask === "telefone" ? "tel" : undefined} style={{ ...inputStyle, opacity: disabled ? 0.45 : 1 }} />
    </div>
  );
}

function SelectSimNao({ id, label, value, onChange }: { id: string; label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <select id={id} value={value ? "sim" : "nao"} onChange={(e) => onChange(e.target.value === "sim")} style={inputStyle}>
        <option value="nao">Não</option>
        <option value="sim">Sim</option>
      </select>
    </div>
  );
}

function PaisesPicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const selecionados = value.split(",").map((pais) => pais.trim()).filter(Boolean);
  const disponiveis = PAISES.filter((pais) => !selecionados.includes(pais));
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>Países permitidos</label>
      <select
        id={id}
        value=""
        onChange={(e) => {
          const pais = e.target.value;
          if (pais) onChange([...selecionados, pais].join(", "));
        }}
        style={inputStyle}
      >
        <option value="">Selecione um país para adicionar</option>
        {disponiveis.map((pais) => <option key={pais} value={pais}>{pais}</option>)}
      </select>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {selecionados.map((pais) => (
          <span key={pais} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 999, background: "#fff1f4", color: CARMIM, fontSize: 12, fontWeight: 700 }}>
            {pais}
            <button type="button" onClick={() => onChange(selecionados.filter((item) => item !== pais).join(", "))} style={{ border: "none", background: "transparent", color: CARMIM, cursor: "pointer", fontWeight: 800, padding: 0 }}>×</button>
          </span>
        ))}
      </div>
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
    <div className="public-pabx-stepper" aria-label="Progresso do formulário">
      {passos.map((nome, i) => (
        <div key={nome} className={`public-pabx-step ${i < atual ? "is-complete" : i === atual ? "is-current" : ""}`}>
          <button
            type="button"
            onClick={() => i <= atual && onJump(i)}
            aria-label={`${nome}: ${i < atual ? "concluída" : i === atual ? "em andamento" : "pendente"}`}
            className="public-pabx-step-dot"
            style={{
              cursor: i <= atual ? "pointer" : "default",
            }}
          >{i < atual ? "✓" : i + 1}</button>
          <span className="public-pabx-step-label">{nome}</span>
          <span className="public-pabx-step-state">{i < atual ? "Concluído" : i === atual ? "Em andamento" : "Pendente"}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressAside({ passo, passos }: { passo: number; passos: string[] }) {
  const percentual = Math.round(((passo + 1) / passos.length) * 100);
  return (
    <aside className="public-pabx-aside">
      <Card>
        <p style={{ fontSize: 14, fontWeight: 800, color: TEXTO, margin: "0 0 14px" }}>Progresso do formulário</p>
        <div className="public-pabx-progress-card">
          <div className="public-pabx-progress-ring" style={{ background: `conic-gradient(${CARMIM} ${percentual}%, #e9eaf0 0)` }}>
            <div className="public-pabx-progress-ring-inner">
              <strong style={{ fontSize: 28, color: TEXTO }}>{percentual}%</strong>
              <span style={{ fontSize: 11, color: "#7e8196" }}>Concluído</span>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {passos.map((nome, i) => (
            <div key={nome} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", background: i <= passo ? "#fff0f3" : "#f7f7fa", color: i <= passo ? CARMIM : "#7e8196", fontSize: 11, fontWeight: 800 }}>{i < passo ? "✓" : i + 1}</span>
              <span><strong style={{ display: "block", fontSize: 12, color: i === passo ? CARMIM : TEXTO }}>{nome}</strong><small style={{ display: "block", marginTop: 2, color: "#8d90a1", fontSize: 11 }}>{i < passo ? "Concluído" : i === passo ? "Em andamento" : "Não iniciado"}</small></span>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ marginTop: 14, padding: 18, borderRadius: 16, border: "1px solid #eadfff", background: "#fbf8ff" }}>
        <strong style={{ display: "block", marginBottom: 7, color: "#5d2ab5", fontSize: 13 }}>Importante</strong>
        <p style={{ margin: 0, color: "#6f6680", fontSize: 12, lineHeight: 1.6 }}>Essas informações serão usadas exclusivamente para a implantação do seu sistema PABX.</p>
      </div>
    </aside>
  );
}

function ProgressMini({ passo, total }: { passo: number; total: number }) {
  const percentual = Math.round(((passo + 1) / total) * 100);
  return (
    <div className="public-pabx-progress-mini" aria-label={`Progresso do formulário: ${percentual}%`}>
      <div className="public-pabx-progress-mini-head"><span>Progresso da implantação</span><strong style={{ color: CARMIM }}>{percentual}% concluído</strong></div>
      <div className="public-pabx-progress-mini-bar"><div className="public-pabx-progress-mini-fill" style={{ width: `${percentual}%` }} /></div>
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
// Agrupa os ramais já digitados no passo anterior (mesma sessão, client-side,
// sem round-trip de banco) por departamento — pedido explícito do Kauã:
// "departamento Financeiro com ramais 4003/4005/4006 aparece como opção
// selecionável, não texto digitado". Sem departamento informado cai no
// grupo "Sem departamento" (honesto, não força um rótulo inventado).
function agruparPorDepartamento(ramais: RamalItem[]): { departamento: string; ramais: RamalItem[] }[] {
  const grupos = new Map<string, RamalItem[]>();
  for (const r of ramais) {
    const chave = r.departamento?.trim() || "Sem departamento";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(r);
  }
  return Array.from(grupos.entries()).map(([departamento, itens]) => ({ departamento, ramais: itens }));
}

function SeletorDepartamento({ ramaisDisponiveis, valor, onChange }: { ramaisDisponiveis: RamalItem[]; valor: string; onChange: (v: string) => void }) {
  const departamentos = Array.from(new Set(ramaisDisponiveis.map((ramal) => ramal.departamento?.trim()).filter((departamento): departamento is string => !!departamento)));
  const valorCanonico = departamentos.find((departamento) => departamento.toLowerCase() === valor.trim().toLowerCase()) || "";
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <label style={labelStyle}>Departamento desta opção</label>
      <select value={valorCanonico} onChange={(e) => onChange(e.target.value)} disabled={departamentos.length === 0} style={{ ...inputStyle, width: "100%" }}>
        <option value="">{departamentos.length ? "Selecione um departamento já cadastrado..." : "Nenhum departamento cadastrado na etapa Ramais"}</option>
        {departamentos.map((departamento) => <option key={departamento} value={departamento}>{departamento}</option>)}
      </select>
      {departamentos.length === 0 && <p style={{ margin: "6px 0 0", color: "#9497ab", fontSize: 11 }}>Volte à etapa Ramais e informe pelo menos um departamento.</p>}
    </div>
  );
}

function SeletorDestino({ ramaisDisponiveis, valor, onChange }: { ramaisDisponiveis: RamalItem[]; valor: string[]; onChange: (v: string[]) => void }) {
  const [selecao, setSelecao] = useState("");
  const opcoes = ramaisDisponiveis.filter((r) => r.ramal || r.departamento || r.nome);
  const grupos = agruparPorDepartamento(opcoes);

  if (opcoes.length === 0) {
    return (
      <div style={{ marginBottom: 8 }}>
        <ChipList itens={valor} onRemover={(i) => onChange(valor.filter((_, idx) => idx !== i))} />
        <p style={{ margin: "6px 0 0", color: "#9497ab", fontSize: 11 }}>Nenhum ramal ou departamento cadastrado. Volte à etapa Ramais para configurar os destinos.</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <ChipList itens={valor} onRemover={(i) => onChange(valor.filter((_, idx) => idx !== i))} />
      <div style={{ display: "flex", gap: 6 }}>
        <select value={selecao} onChange={(e) => setSelecao(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="">Selecione um ramal/departamento já cadastrado...</option>
          {grupos.map((grupo) => (
            <optgroup key={grupo.departamento} label={grupo.departamento}>
              {grupo.ramais.map((r, i) => (
                <option key={i} value={r.ramal ? `${r.ramal} — ${r.nome || r.departamento}` : r.departamento}>
                  {r.ramal ? `${r.ramal} — ${r.nome || "sem nome"}` : grupo.departamento}
                </option>
              ))}
            </optgroup>
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

// 3 vozes reais disponíveis pra gravação da URA (20/08, pedido Kauã: trocar
// texto livre por preview de áudio real — mesmo padrão de <audio controls
// preload="none"> já usado em CallDetail.tsx). Identificador salvo em
// `ura.vozSelecionada` é o nome (ex.: "camila"), nunca o caminho do arquivo.
const VOZES_URA = [
  { id: "vitoria", nome: "Vitória" },
  { id: "camila", nome: "Camila" },
  { id: "thiago", nome: "Thiago" },
] as const;

function SeletorVoz({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>Voz selecionada para gravação</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {VOZES_URA.map((voz) => {
          const selecionada = valor === voz.id;
          return (
            <div
              key={voz.id}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                border: selecionada ? `1.5px solid ${CARMIM}` : "1px solid #ececf2",
                background: selecionada ? "#fdf1f3" : "#fff",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXTO, minWidth: 64 }}>{voz.nome}</span>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls preload="none" src={`/audio/ura-vozes/${voz.id}.wav`} style={{ height: 32, flex: 1, minWidth: 0 }} />
              <button
                type="button"
                onClick={() => onChange(voz.id)}
                style={{
                  padding: "7px 12px", borderRadius: 8, border: selecionada ? "none" : `1px solid ${CARMIM}`,
                  background: selecionada ? "#0f9d58" : "#fff", color: selecionada ? "#fff" : CARMIM,
                  fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {selecionada ? "Selecionada ✓" : "Selecionar"}
              </button>
            </div>
          );
        })}
      </div>
      {!valor && <p style={{ fontSize: 11, color: "#9497ab", margin: "6px 0 0" }}>Escolha uma das vozes acima pra gravação da sua URA.</p>}
    </div>
  );
}

// Resumo de validação final (20/08, pedido Kauã) — só contagem real do
// próprio estado do formulário (nada fabricado): linhas/ramais/
// departamentos/opções de URA/voz + o que ainda falta preencher, calculado
// direto do `respostas` da sessão atual.
function ResumoValidacao({ respostas, ramaisPreenchidos }: { respostas: Respostas; ramaisPreenchidos: RamalItem[] }) {
  const linhasPreenchidas = respostas.portabilidade.linhas.filter((l) => l.ddd || l.numero);
  const departamentosUnicos = new Set(ramaisPreenchidos.map((r) => r.departamento?.trim()).filter((d): d is string => !!d));
  const opcoesUraConfiguradas = respostas.ura.opcoes.filter((o) => o.destinos.length > 0).length;
  const vozNome = VOZES_URA.find((v) => v.id === respostas.ura.vozSelecionada)?.nome;

  const pendencias: string[] = [];
  if (linhasPreenchidas.length === 0) pendencias.push("Nenhuma linha/número de portabilidade informado");
  if (ramaisPreenchidos.length === 0) pendencias.push("Nenhum ramal cadastrado");
  if (opcoesUraConfiguradas === 0) pendencias.push("Nenhuma opção de URA com destino configurado");
  if (!respostas.ura.vozSelecionada) pendencias.push("Voz da URA ainda não selecionada");
  if (!respostas.portabilidade.razaoSocialTitular) pendencias.push("Titular das linhas não informado");

  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#f7f7fa" }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: TEXTO, margin: "0 0 8px" }}>Resumo rápido</p>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>{linhasPreenchidas.length} número(s)/linha(s) informado(s)</p>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>{ramaisPreenchidos.length} ramal(is) cadastrado(s)</p>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>{departamentosUnicos.size} departamento(s) único(s) entre os ramais</p>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>{opcoesUraConfiguradas} opção(ões) de URA configurada(s)</p>
      <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>Voz selecionada: {vozNome || "nenhuma ainda"}</p>

      {pendencias.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #ececf2" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: CARMIM, margin: "0 0 4px" }}>Ainda pendente:</p>
          {pendencias.map((p) => (
            <p key={p} style={{ fontSize: 12, color: "#6b7280", margin: "2px 0" }}>· {p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function AnexoCelula({ token, linha, onChange }: { token: string; linha: LinhaPortabilidade; onChange: (patch: Partial<LinhaPortabilidade>) => void }) {
  const [enviando, setEnviando] = useState(false);
  // Achado real (10/09/2026): falha de upload (arquivo grande, formato
  // errado, rede) não dava NENHUM retorno — o rótulo voltava pra "Anexar
  // fatura/documento" como se nada tivesse acontecido, e a mesma tela de
  // erro se repetia porque o <input> não era limpo (navegador não dispara
  // onChange de novo pro MESMO arquivo escolhido duas vezes seguidas).
  const [erro, setErro] = useState<string | null>(null);

  const upload = async (file: File, input: HTMLInputElement) => {
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/fulfillment-formulario/${token}/upload`, { method: "POST", body: fd });
      const body = await r.json().catch(() => ({}));
      if (r.ok) onChange({ anexoUrl: body.url, anexoNome: body.nomeOriginal });
      else setErro(body.error || "Falha ao enviar o arquivo");
    } catch {
      setErro("Falha ao enviar o arquivo — confira sua conexão e tente de novo");
    } finally {
      setEnviando(false);
      input.value = "";
    }
  };

  if (linha.anexoUrl) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <a href={linha.anexoUrl} target="_blank" rel="noreferrer" style={{ minWidth: 0, color: ROXO, fontSize: 12, fontWeight: 600, textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linha.anexoNome || "Arquivo anexado"}</a>
        <button type="button" onClick={() => onChange({ anexoUrl: "", anexoNome: "" })} style={{ border: "none", background: "none", color: "#9497ab", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Remover arquivo</button>
      </div>
    );
  }
  return (
    <div>
      <label className="public-pabx-upload-trigger" style={{ color: enviando ? "#9497ab" : CARMIM, cursor: enviando ? "wait" : "pointer" }}>
        {enviando ? "Enviando..." : "Anexar fatura/documento"}
        <input
          type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, e.target); }}
        />
      </label>
      {erro && <p style={{ margin: "6px 0 0", color: CARMIM, fontSize: 11, fontWeight: 600 }}>{erro}</p>}
    </div>
  );
}

export function FormularioImplantacaoPabx({ token }: { token: string }) {
  const [respostas, setRespostas] = useState<Respostas>(RESPOSTAS_VAZIAS);
  const [carregado, setCarregado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [passo, setPasso] = useState(0);
  // Quantas linhas/ramais aparecem na tela — ver comentário em `contarPreenchidos`.
  const [linhasReveladas, setLinhasReveladas] = useState(1);
  const [ramaisRevelados, setRamaisRevelados] = useState(1);

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
      const linhasCarregadas = rp.portabilidade?.linhas?.length ? rp.portabilidade.linhas : PORTABILIDADE_VAZIA.linhas;
      const ramaisCarregados = rp.ramais?.length ? rp.ramais : RESPOSTAS_VAZIAS.ramais;
      setRespostas({
        ...RESPOSTAS_VAZIAS,
        ...rp,
        portabilidade: {
          ...PORTABILIDADE_VAZIA,
          ...rp.portabilidade,
          linhas: linhasCarregadas,
        },
        ramais: ramaisCarregados,
        ura: { ...URA_VAZIA, ...rp.ura },
      });
      // Revela até a última linha/ramal com dado salvo, mais uma em branco pra
      // continuar preenchendo — nunca menos que 1, mesmo num formulário zerado.
      setLinhasReveladas(Math.max(1, contarPreenchidos(linhasCarregadas, linhaTemDado) + 1));
      setRamaisRevelados(Math.max(1, contarPreenchidos(ramaisCarregados, ramalTemDado) + 1));
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

  const PASSOS = ["Dados iniciais", "Portabilidade", "Ramais e usuários", "URA e atendimentos", "Revisão e envio"];
  const p = respostas.portabilidade;
  const u = respostas.ura;
  // Antes filtrava por "tem conteúdo" — o item recém-adicionado (vazio, por
  // definição) nunca aparecia. Agora é um corte simples nos primeiros N itens
  // do array, e N só muda por clique explícito em "+ Adicionar"/"Remover".
  const ramaisPreenchidos = respostas.ramais.filter(ramalTemDado);
  const ramaisVisiveis = respostas.ramais
    .slice(0, Math.min(ramaisRevelados, respostas.ramais.length))
    .map((ramal, index) => ({ ramal, index }));
  const linhasVisiveis = p.linhas
    .slice(0, Math.min(linhasReveladas, p.linhas.length))
    .map((linha, index) => ({ linha, index }));
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
        <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, color: CARMIM, textTransform: "uppercase", margin: "0 0 10px" }}>
          Formulário de implantação — PABX
        </p>
        <h1 style={{ fontSize: 32, lineHeight: 1.15, fontWeight: 800, color: TEXTO, margin: "0 0 10px" }}>Vamos iniciar sua implantação</h1>
        <p style={{ maxWidth: 700, margin: "0 auto", color: "#687087", fontSize: 14, lineHeight: 1.6 }}>Preencha as informações abaixo para que possamos configurar seu sistema da melhor forma.</p>
        </div>
        <StepIndicator passos={PASSOS} atual={passo} onJump={setPasso} />
      </Card>

      <div className={`public-pabx-grid ${passo === 2 ? "is-dense" : ""}`}>
        <div className="public-pabx-main">
          {passo === 0 && (
            <Card>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 22 }}>
                <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 14, display: "grid", placeItems: "center", background: "#fff0f3", color: CARMIM, fontSize: 22 }}>1</div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: TEXTO, margin: "0 0 5px" }}>Dados iniciais</h2>
                  <p style={{ fontSize: 13, color: "#687087", lineHeight: 1.55, margin: 0 }}>Informe os dados do responsável técnico que nos ajudará durante a implantação.</p>
                </div>
              </div>
              <div className="public-pabx-form-grid">
                <Field label="Nome completo" value={p.responsavelTecnico.nome} onChange={(v) => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, nome: v } })} placeholder="Ex.: João da Silva" />
                <Field label="E-mail corporativo" value={p.responsavelTecnico.email} onChange={(v) => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, email: v } })} placeholder="nome@empresa.com" />
                <Field label="Telefone / Celular" value={p.responsavelTecnico.telefone} onChange={(v) => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, telefone: v } })} placeholder="(11) 99999-9999" mask="telefone" />
                <Field label="Cargo / Função" value={p.responsavelTecnico.cargo || ""} onChange={(v) => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, cargo: v } })} placeholder="Ex.: Analista de TI" />
                <Field label="Departamento" value={p.responsavelTecnico.departamento || ""} onChange={(v) => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, departamento: v } })} placeholder="Ex.: Tecnologia da Informação" />
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Melhor horário para contato</label>
                  <select value={p.responsavelTecnico.melhorHorario || ""} onChange={(e) => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, melhorHorario: e.target.value } })} style={inputStyle}>
                    <option value="">Selecione uma opção</option>
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="qualquer_horario">Qualquer horário</option>
                  </select>
                </div>
                <div className="public-pabx-span-2" style={{ margin: "8px 0 16px" }}>
                  <label style={labelStyle}>Método de contato preferido</label>
                  <div className="public-pabx-channel-grid">
                    {(["whatsapp", "email", "telefone"] as const).map((canal) => (
                      <button key={canal} type="button" className={`public-pabx-channel ${p.responsavelTecnico.canalPreferencial === canal ? "is-selected" : ""}`} onClick={() => atualizarPortabilidade({ responsavelTecnico: { ...p.responsavelTecnico, canalPreferencial: canal } })}>
                        {canal === "whatsapp" ? "WhatsApp" : canal === "email" ? "E-mail" : "Telefone"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="public-pabx-span-2">
                  <TextAreaField label="Observações adicionais (opcional)" value={respostas.outrasInformacoes} onChange={(v) => setRespostas((r) => ({ ...r, outrasInformacoes: v }))} placeholder="Conte-nos qualquer informação importante sobre seu ambiente atual..." />
                </div>
              </div>
              <NavegacaoPasso podeVoltar={false} onVoltar={() => {}} onAvancar={() => setPasso(1)} textoAvancar="Salvar e continuar →" />
            </Card>
          )}

      {passo === 1 && (
        <Card>
          <p style={sectionTitleStyle}>Portabilidade / novas linhas</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
            Cadastre uma linha por número. Para uma linha nova, selecione “Sim” e informe somente o DDD. Anexe a fatura correspondente em cada linha de portabilidade.
          </p>
          <div className="public-pabx-portabilidade-list">
            {linhasVisiveis.map(({ linha, index: linhaIndex }) => (
              <div key={linhaIndex} className="public-pabx-portabilidade-card">
                <div className="public-pabx-portabilidade-card-header">
                  <strong style={{ color: TEXTO, fontSize: 14 }}>Linha {linhaIndex + 1}{linha.ddd ? `, DDD ${linha.ddd}` : ""}</strong>
                  <button type="button" onClick={() => { atualizarPortabilidade({ linhas: p.linhas.filter((_, idx) => idx !== linhaIndex) }); setLinhasReveladas((n) => Math.max(1, n - 1)); }} style={{ border: "none", background: "transparent", color: "#9497ab", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Remover linha</button>
                </div>
                <div className="public-pabx-portabilidade-fields">
                  <Field label="DDD" value={linha.ddd} onChange={(v) => atualizarLinha(linhaIndex, { ddd: v })} placeholder="15" />
                  <Field label="Número" value={linha.numero} disabled={linha.novaLinha} onChange={(v) => atualizarLinha(linhaIndex, { numero: v })} placeholder="3333-3333" />
                  <SelectSimNao id={`linha-${linhaIndex}-nova`} label="Linha nova?" value={linha.novaLinha} onChange={(novaLinha) => atualizarLinha(linhaIndex, { novaLinha, numero: novaLinha ? "" : linha.numero })} />
                </div>
                {!linha.novaLinha && (
                  <div className="public-pabx-upload-field">
                    <label style={labelStyle}>Fatura da linha</label>
                    <AnexoCelula token={token} linha={linha} onChange={(patch) => atualizarLinha(linhaIndex, patch)} />
                    {!linha.anexoUrl && <p style={{ margin: "7px 0 0", color: "#9497ab", fontSize: 11 }}>PDF, JPG ou PNG. Envie a fatura correspondente a este número portado.</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              // Só estende o array se a próxima posição ainda não existir —
              // os 8 slots pré-alocados cobrem o caso comum sem crescer o
              // payload à toa.
              if (linhasReveladas >= p.linhas.length) atualizarPortabilidade({ linhas: [...p.linhas, LINHA_VAZIA()] });
              setLinhasReveladas((n) => n + 1);
            }}
            style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${CARMIM}`, background: "#fff", color: CARMIM, fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 16 }}
          >
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
          <ProgressMini passo={passo} total={PASSOS.length} />
          <p style={sectionTitleStyle}>Ramais</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px" }}>
            Uma linha por ramal/usuário. Sem pessoa designada? Preencha só o departamento.
          </p>
          <div className="public-pabx-ramais-list">
            {ramaisVisiveis.map(({ ramal, index: ramalIndex }) => (
              <div key={ramalIndex} className="public-pabx-ramal-card">
                <div className="public-pabx-ramal-card-header">
                  <strong style={{ color: TEXTO, fontSize: 14 }}>Ramal {ramal.ramal || `#${ramalIndex + 1}`}</strong>
                  <button type="button" onClick={() => { setRespostas((r) => ({ ...r, ramais: r.ramais.filter((_, idx) => idx !== ramalIndex) })); setRamaisRevelados((n) => Math.max(1, n - 1)); }} style={{ border: "none", background: "transparent", color: "#9497ab", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Remover ramal</button>
                </div>
                <p style={{ ...sectionTitleStyle, marginBottom: 10 }}>Dados do usuário</p>
                <div className="public-pabx-ramal-fields">
                  <Field label="Ramal" value={ramal.ramal} onChange={(v) => atualizarRamal(ramalIndex, { ramal: v })} placeholder="8001" />
                  <Field label="Nome" value={ramal.nome} onChange={(v) => atualizarRamal(ramalIndex, { nome: v })} placeholder="Nome do usuário" />
                  <Field label="Departamento" value={ramal.departamento} onChange={(v) => atualizarRamal(ramalIndex, { departamento: v })} placeholder="Ex.: Financeiro" />
                  <Field label="Número externo" value={ramal.numeroExterno} onChange={(v) => atualizarRamal(ramalIndex, { numeroExterno: v })} />
                  <SelectSimNao id={`ramal-${ramalIndex}-aparelho`} label="Aparelho de mesa" value={ramal.utilizaAparelhoMesa} onChange={(usaAparelho) => atualizarRamal(ramalIndex, { utilizaAparelhoMesa: usaAparelho, modeloAparelho: usaAparelho ? ramal.modeloAparelho : "" })} />
                  <Field label="E-mail" value={ramal.email} onChange={(v) => atualizarRamal(ramalIndex, { email: v })} placeholder="nome@empresa.com" />
                  <Field label="Celular" value={ramal.celular} onChange={(v) => atualizarRamal(ramalIndex, { celular: v })} mask="telefone" />
                  {ramal.utilizaAparelhoMesa && <Field label="Modelo do aparelho" value={ramal.modeloAparelho} onChange={(v) => atualizarRamal(ramalIndex, { modeloAparelho: v })} placeholder="Ex.: Intelbras TIP 125i" />}
                </div>
                <p style={{ ...sectionTitleStyle, margin: "4px 0 10px", paddingTop: 8, borderTop: "1px solid #f0f0f5" }}>Permissões e recursos</p>
                <div className="public-pabx-ramal-permissions">
                  <label className="public-pabx-check-field"><input type="checkbox" checked={ramal.notificacaoLigacoesPerdidas} onChange={(e) => atualizarRamal(ramalIndex, { notificacaoLigacoesPerdidas: e.target.checked })} /> Notificar ligações perdidas</label>
                  <label className="public-pabx-check-field"><input type="checkbox" checked={ramal.gravarLigacao} onChange={(e) => atualizarRamal(ramalIndex, { gravarLigacao: e.target.checked })} /> Gravar ligações</label>
                  <label className="public-pabx-check-field"><input type="checkbox" checked={ramal.acessoGestor} onChange={(e) => atualizarRamal(ramalIndex, { acessoGestor: e.target.checked })} /> Acesso de gestor</label>
                  <div className="public-pabx-international-field"><SelectSimNao id={`ramal-${ramalIndex}-internacional`} label="Ligações internacionais" value={ramal.ligacoesInternacionais} onChange={(permiteInternacional) => atualizarRamal(ramalIndex, { ligacoesInternacionais: permiteInternacional, paises: permiteInternacional ? ramal.paises : "" })} /></div>
                  {ramal.ligacoesInternacionais && <div className="public-pabx-countries"><PaisesPicker id={`ramal-${ramalIndex}-paises`} value={ramal.paises} onChange={(paises) => atualizarRamal(ramalIndex, { paises })} /></div>}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (ramaisRevelados >= respostas.ramais.length) setRespostas((r) => ({ ...r, ramais: [...r.ramais, RAMAL_VAZIO()] }));
              setRamaisRevelados((n) => n + 1);
            }}
            style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${CARMIM}`, background: "#fff", color: CARMIM, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            {/* Rótulo corrigido junto: dizia "+ Adicionar linha" numa seção
                que é de ramais, não de linhas de portabilidade. */}
            + Adicionar ramal
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
                <SeletorDepartamento
                  ramaisDisponiveis={ramaisPreenchidos}
                  valor={opcao.rotulo}
                  onChange={(rotulo) => { const novas = [...u.opcoes]; novas[i] = { ...opcao, rotulo }; atualizarUra({ opcoes: novas }); }}
                />
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

          <SeletorVoz valor={u.vozSelecionada} onChange={(v) => atualizarUra({ vozSelecionada: v })} />
          <p style={{ fontSize: 11, color: "#9497ab", background: "#f7f7fa", padding: 10, borderRadius: 10 }}>
            Se sua empresa já tem um fluxo de URA mais complexo documentado ou uma gravação existente que quer manter, envie por e-mail ao gestor do seu projeto.
          </p>

          <NavegacaoPasso podeVoltar onVoltar={() => setPasso(2)} onAvancar={() => setPasso(4)} textoAvancar="Continuar" />
        </Card>
      )}

          {passo === 4 && (
        <Card>
          <p style={sectionTitleStyle}>Outras informações</p>
          <p style={{ fontSize: 13, color: "#687087", lineHeight: 1.55, margin: "0 0 14px" }}>Revise os dados preenchidos antes de enviar. Você ainda pode voltar a qualquer etapa para ajustar alguma informação.</p>

          <ResumoValidacao respostas={respostas} ramaisPreenchidos={ramaisPreenchidos} />

          <NavegacaoPasso podeVoltar onVoltar={() => setPasso(3)} onAvancar={() => enviar.mutate()} textoAvancar={enviar.isPending ? "Enviando..." : "Enviar informações"} />
          {enviar.isError && <p style={{ color: CARMIM, fontSize: 12, marginTop: 8 }}>{(enviar.error as Error).message}</p>}
        </Card>
      )}
        </div>
        <ProgressAside passo={passo} passos={PASSOS} />
      </div>
      <div className="public-pabx-footer">Seus dados estão protegidos e são utilizados apenas para este processo de implantação.</div>
    </Shell>
  );
}
