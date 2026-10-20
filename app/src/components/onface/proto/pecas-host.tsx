"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * O hospedeiro global de peças.
 *
 * No protótipo, `E.abrir(peca, arg)` publica num barramento e a peça que
 * escuta aquele nome abre POR CIMA de qualquer tela. Aqui o barramento é este
 * provider, montado na casca (`CascaProto`) por fora do miolo: qualquer
 * adaptador chama `usePecas().abrir(peca, id, contexto)` e a peça certa abre,
 * carregada sob demanda para não pesar o primeiro paint.
 *
 * Pilha, e não uma peça só: a gaveta do lead abre as tags por cima de si, e
 * fechar as tags devolve a gaveta — como no protótipo, onde as duas convivem.
 *
 * Peça sem entrada no registro: toast com o nome amigável. Nunca silêncio.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { guardarVisao, lerVisao, restaurarRolagem } from "./memoria-da-visao";
import { toast } from "sonner";

/** O contrato de toda peça registrada. */
export interface PecaProps {
  /** O nome com que a peça foi pedida ("detalhe", "novaReuniao"…). */
  peca: string;
  /** O id que a tela passou (lead, oportunidade, reunião…), ou null. */
  id: string | null;
  /** O que a peça precisa saber da tela. Quando o desenho passa um objeto no
   *  lugar do id (ex.: `abrir("novaReuniao", { data })`), ele vem aqui. */
  contexto: Record<string, unknown>;
  /** Tira a peça da tela. */
  fechar: () => void;
  /** A peça gravou: a tela de baixo relê (`router.refresh()`). */
  gravou: () => void;
}

export type AbrirPeca = (peca: string, id?: unknown, contexto?: Record<string, unknown>) => void;

/**
 * O alvo da peça de cadência, informado pela tela ANTES de `abrir("cadencia")`.
 *
 * É assim que a peça sabe o TIPO do registro (`lead`, `contato`, `negocio`) —
 * sem isso ela assume lead em qualquer superfície. O canal é um global porque
 * o barramento do protótipo só leva `(peça, id)`; a `PecasLiga` lê e limpa.
 */
export interface AlvoDaCadencia {
  /** O id do registro, no tipo abaixo. */
  chave: string;
  /** Como ele aparece no aviso ("Acme inserido em …"). */
  nome: string;
  /** O tipo que o motor aceita. Mapa fechado em `acaoInserirEmCadencia`. */
  tipo: "lead" | "contato" | "negocio";
}

declare global {
  interface Window { __ofCadAlvo: AlvoDaCadencia | null }
}

const carregar = (f: () => Promise<{ default: React.ComponentType<PecaProps> }>) =>
  dynamic(f, { ssr: false, loading: () => null });

const Pecas = carregar(() => import("./PecasGlobalProto"));
const Atividade = carregar(() => import("./AtividadePecaProto"));
const Reuniao = carregar(() => import("./ReuniaoPecaProto"));
const Relatorio = carregar(() => import("./RelatorioLigacaoPecaProto"));
const Tags = carregar(() => import("./TagsOportunidadePecaProto"));
const IniciarRelacao = carregar(() => import("./IniciarRelacaoPecaProto"));
const Nota = carregar(() => import("./NotaPecaProto"));

/** Peça → adaptador. Os nomes são os do barramento do protótipo. */
export const REGISTRO_DE_PECAS: Record<string, React.ComponentType<PecaProps>> = {
  // OnFace Pecas.dc.html
  detalhe: Pecas, qualificar: Pecas, nutrir: Pecas, desqualificar: Pecas,
  oportunidade: Pecas, cadencia: Pecas, vincular: Pecas,
  // Vocabulário interno da PecasLiga: ela mesma repassa para a peça de atividade.
  "atividade-ver": Pecas, "atividade-nova": Pecas,
  // OnFace Atividade.dc.html
  verAtividade: Atividade, novaAtividade: Atividade, atividade: Atividade,
  // OnFace Reuniao.dc.html
  reuniao: Reuniao, novaReuniao: Reuniao, editarReuniao: Reuniao,
  // OnFace Relatorio Ligacao.dc.html
  relatorio: Relatorio,
  // OnFace Tags Oportunidade.dc.html — atende as tags do lead também
  tagsopp: Tags, tagslead: Tags,
  // OnFace Iniciar Relacao.dc.html
  iniciarRelacao: IniciarRelacao,
  // Sem desenho gerado: o handoff nunca desenhou uma nota. Peça escrita à mão
  // com os componentes de `components/ui`, uma só para lead e oportunidade.
  nota: Nota,
};

/** Como a peça se chama para quem usa — só para o aviso de "não ligada". */
const NOME_AMIGAVEL: Record<string, string> = {
  exportar: "Exportar", nexo: "NEXO", pessoa: "Pessoa", empresa: "Empresa",
  proposta: "Proposta", lead: "Lead",
};

/** Separa id e contexto: o desenho às vezes passa um objeto no lugar do id. */
export function normalizarPedido(id: unknown, contexto?: Record<string, unknown>) {
  if (id && typeof id === "object") {
    const o = id as Record<string, unknown>;
    return { id: typeof o.id === "string" ? o.id : null, contexto: { ...contexto, ...o } };
  }
  return { id: typeof id === "string" && id ? id : null, contexto: { ...contexto } };
}

interface Aberta { chave: number; peca: string; id: string | null; contexto: Record<string, unknown> }

const PecasContexto = React.createContext<{ abrir: AbrirPeca }>({
  abrir: (peca) => { toast(`"${NOME_AMIGAVEL[peca] ?? peca}" ainda não está disponível aqui.`); },
});

export function usePecas() {
  return React.useContext(PecasContexto);
}

/**
 * Peças que o VOLTAR reabre.
 *
 * Só as que são "ver alguma coisa" e que se montam a partir do id sozinho.
 * Peça de CRIAR (nova atividade, nova reunião) fica de fora de propósito:
 * voltar e encontrar um formulário em branco reaberto não é a tela de antes,
 * é uma tela nova no caminho. Peça que precisa de contexto rico também fica
 * de fora — reabrir sem ele daria uma peça pela metade.
 */
const REABRE_NO_VOLTAR = new Set(["detalhe", "verAtividade", "atividade", "reuniao"]);

export function PecasHost({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pilha, setPilha] = React.useState<Aberta[]>([]);
  const seq = React.useRef(0);

  const abrir = React.useCallback<AbrirPeca>((peca, id, contexto) => {
    if (!REGISTRO_DE_PECAS[peca]) {
      toast(`"${NOME_AMIGAVEL[peca] ?? peca}" ainda não está disponível aqui.`);
      return;
    }
    const p = normalizarPedido(id, contexto);
    /* A peça aberta entra na entrada ATUAL do histórico. Quem sai daqui
       (abrir lead, abrir empresa, abrir oportunidade) deixa para trás uma
       entrada que sabe o que estava aberto — e o voltar reabre. */
    if (REABRE_NO_VOLTAR.has(peca)) guardarVisao({ peca: { nome: peca, id: p.id } });
    setPilha((s) => [...s, { chave: ++seq.current, peca, ...p }]);
  }, []);

  /* Ao chegar nesta entrada do histórico — inclusive voltando — reabre o que
     estava aberto e devolve a rolagem de dentro das colunas. */
  React.useEffect(() => {
    const { peca } = lerVisao();
    if (peca?.nome && REGISTRO_DE_PECAS[peca.nome]) {
      setPilha((s) => (s.length ? s : [{ chave: ++seq.current, peca: peca.nome, id: peca.id, contexto: {} }]));
    }
    restaurarRolagem();
  }, []);

  const valor = React.useMemo(() => ({ abrir }), [abrir]);
  const gravou = React.useCallback(() => router.refresh(), [router]);
  const remover = React.useCallback((chave: number) => {
    // Fechou de propósito: o voltar não deve reabrir o que a pessoa fechou.
    guardarVisao({ peca: null });
    setPilha((s) => s.filter((x) => x.chave !== chave));
  }, []);

  return (
    <PecasContexto.Provider value={valor}>
      {children}
      {pilha.map((a) => <Entrada key={a.chave} a={a} remover={remover} gravou={gravou} />)}
    </PecasContexto.Provider>
  );
}

/** Uma peça aberta. `fechar` estável: a peça pode pô-lo em dependência de efeito. */
function Entrada({ a, remover, gravou }: { a: Aberta; remover: (chave: number) => void; gravou: () => void }) {
  const fechar = React.useCallback(() => remover(a.chave), [remover, a.chave]);
  const C = REGISTRO_DE_PECAS[a.peca];
  return <C peca={a.peca} id={a.id} contexto={a.contexto} fechar={fechar} gravou={gravou} />;
}
