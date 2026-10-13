/* ─────────────────────────────────────────────────────────────────────────
 * A escolha ÚNICA de destino do cadastro: "só salvar na base" × "enviar para
 * Pré-vendas".
 *
 * Contatos & Empresas (novo contato, nova empresa, importação) e o Atendimento
 * (conversa de número desconhecido) oferecem exatamente esta escolha. Os
 * rótulos, os selos, o ícone e o estilo dos cartões moram AQUI e em nenhum
 * outro lugar: mudou o texto ou o visual, mudou nas duas telas.
 *
 * Quem grava é `acaoCadastrarContato` (contatos/actions.ts), com o mesmo
 * `destino`. Este módulo só descreve a escolha — não importa `db`.
 * ───────────────────────────────────────────────────────────────────────── */

import { Fragment } from "react";
import { estilo, hover } from "./proto-runtime";

export type DestinoDoCadastro = "base" | "prevendas";

/** O que o Atendimento (e qualquer tela que não escolheu) usa: o comportamento que já existia. */
export const DESTINO_PADRAO_DO_ATENDIMENTO: DestinoDoCadastro = "prevendas";

/** "cadastro": modal de novo contato/empresa. "importacao": lista inteira de linhas. */
export type ContextoDoDestino = "cadastro" | "importacao";

const ICONE_BASE = "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8";
const ICONE_PREVENDAS = "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z";

const DESCRICAO: Record<ContextoDoDestino, Record<DestinoDoCadastro, string>> = {
  cadastro: {
    base: "Fica disponível para consultar e trabalhar depois. Sem processo aberto.",
    prevendas: "Inbound: vira lead no quadro do Pré-vendas para qualificação.",
  },
  importacao: {
    base: "Entram como contatos, sem processo aberto.",
    prevendas: "Inbound: cada linha vira lead no quadro do Pré-vendas.",
  },
};

export const DESTINOS_DO_CADASTRO: Array<{ chave: DestinoDoCadastro; label: string; rel: string; d: string }> = [
  { chave: "base", label: "Só salvar na base", rel: "Contato", d: ICONE_BASE },
  { chave: "prevendas", label: "Enviar para Pré-vendas", rel: "Lead", d: ICONE_PREVENDAS },
];

/** O selo "Contato"/"Lead" ao lado do rótulo. Vem da tela (é o mesmo estilo dos selos dela). */
type EstiloDoSelo = (rel: string) => string;

/** O selo padrão (o mesmo de relSelo em ContatosLiga). */
export const ESTILO_SELO_DESTINO: EstiloDoSelo = () => "display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:9999px;font-size:11.5px;font-weight:500;white-space:nowrap;background:var(--of-papel-alterno);box-shadow:inset 0 0 0 1px var(--of-fio);";

/**
 * Os cartões como o desenho os consome (`destinos` do modal). O markup é do
 * desenho; os dados e o estilo, daqui.
 */
export function cartoesDeDestino(
  atual: DestinoDoCadastro,
  escolher: (destino: DestinoDoCadastro) => void,
  estiloDoSelo: EstiloDoSelo,
  contexto: ContextoDoDestino = "cadastro",
) {
  return DESTINOS_DO_CADASTRO.map(({ chave, label, rel, d }) => {
    const on = atual === chave;
    return {
      label, desc: DESCRICAO[contexto][chave], rel, d, on, relStyle: estiloDoSelo(rel),
      onClick: () => escolher(chave),
      style: "display:flex;align-items:center;gap:12px;width:100%;padding:12px;border-radius:11px;border:0;cursor:pointer;text-align:left;background:" + (on ? "var(--of-selecionado)" : "var(--of-papel)") + ";box-shadow:inset 0 0 0 " + (on ? "1.5px var(--of-coral-marca)" : "1px var(--of-linha)"),
      hover: on ? "" : "box-shadow:inset 0 0 0 1px var(--of-linha-ponteiro)",
      ico: "flex:0 0 auto;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;" + (on ? "background:var(--of-coral-marca);color:var(--of-papel)" : "background:var(--of-papel-tela);color:var(--of-tinta);box-shadow:inset 0 0 0 1px var(--of-fio)"),
      radio: "flex:0 0 auto;width:18px;height:18px;border-radius:9999px;display:grid;place-items:center;" + (on ? "background:var(--of-coral-marca)" : "background:var(--of-papel);box-shadow:inset 0 0 0 1.5px var(--of-linha-convite)"),
    };
  });
}

/** Os rótulos que mudam com a escolha, para a tela não reescrever a frase. */
export function rotulosDoDestino(destino: DestinoDoCadastro) {
  return destino === "base"
    ? { titulo: "Salvar contato", botao: "Salvar contato e vincular", verbo: "Contato salvo" }
    : { titulo: "Criar lead", botao: "Criar lead e vincular", verbo: "Lead criado" };
}

/** O markup dos cartões (o mesmo do passo 2 do cadastro em Contatos & Empresas), para quem não tem desenho próprio deles. */
export function CartoesDeDestino({ itens }: { itens: ReturnType<typeof cartoesDeDestino> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {itens.map((dt) => (
        <Fragment key={dt.label}>
          <button onClick={dt.onClick} style={estilo(dt.style)} className={[hover(dt.hover)].filter(Boolean).join(" ")}>
            <span style={estilo(dt.ico)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={dt.d} /></svg>
            </span>
            <span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--of-tinta-forte)" }}>{dt.label}</span>
                <span style={estilo(dt.relStyle)}>{dt.rel}</span>
              </span>
              <span style={{ display: "block", fontSize: "12px", color: "var(--of-tinta-2)", marginTop: "2px", textWrap: "pretty" }}>{dt.desc}</span>
            </span>
            <span style={estilo(dt.radio)}>
              {dt.on ? <span style={{ width: "8px", height: "8px", borderRadius: "9999px", background: "var(--of-papel)" }} /> : null}
            </span>
          </button>
        </Fragment>
      ))}
    </div>
  );
}
