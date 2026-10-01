"use client";

/* Estado do editor: o documento (grafo + config + nome + pasta), a pilha de
 * desfazer/refazer e o autosave do rascunho (contrato §7.2).
 *
 * O documento é a fonte única: o canvas deriva os nós do React Flow dele, o
 * inspetor escreve nele, e o autosave manda ele inteiro. Ter o React Flow
 * como dono das posições e o grafo como dono do resto foi o que fez o editor
 * de Cadências perder nó em desfazer — aqui não há segunda cópia. */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ConfigFluxo, FluxoDetalhe, GrafoFluxo } from "@/lib/automacoes/grafo";
import { apiFluxos, ErroApi } from "./api";

export interface DocFluxo { grafo: GrafoFluxo; config: ConfigFluxo; nome: string; pasta: string | null }

export type EstadoSalvar =
  | { tipo: "salvo" }
  | { tipo: "pendente" }
  | { tipo: "salvando" }
  | { tipo: "erro"; mensagem: string }
  /** Outra aba salvou depois de nós: parar de salvar para não sobrescrever. */
  | { tipo: "conflito" };

const LIMITE_HISTORICO = 50;
const ESPERA_AUTOSAVE = 1500;
/* Digitação no mesmo campo vira UM passo de desfazer: sem isso, Ctrl+Z
   apagaria letra por letra. */
const JANELA_AGRUPAR = 1200;

export interface OpcoesMudanca {
  /** false = não cria passo de desfazer (arrastar em andamento). */
  historico?: boolean;
  /** Mudanças seguidas com a mesma chave viram um passo só. */
  agrupar?: string;
}

export function useEditorFluxo(detalhe: FluxoDetalhe, somenteLeitura: boolean) {
  const [doc, setDoc] = useState<DocFluxo>(() => docDe(detalhe));
  // Pilhas em ref (não em updater de estado: o StrictMode roda updater duas
  // vezes e empilharia em dobro); `pilhas` só re-renderiza os botões.
  const passadoRef = useRef<DocFluxo[]>([]);
  const futuroRef = useRef<DocFluxo[]>([]);
  const [pilhas, setPilhas] = useState({ passado: 0, futuro: 0 });
  const [salvar, setSalvar] = useState<EstadoSalvar>({ tipo: "salvo" });
  const [salvoEm, setSalvoEm] = useState(detalhe.rascunho.salvoEm);
  const [webhookUrl, setWebhookUrl] = useState(detalhe.webhookUrl);

  const docRef = useRef(doc);
  docRef.current = doc;
  const salvoEmRef = useRef(detalhe.rascunho.salvoEm);
  const versaoRef = useRef(0); // conta mudanças; o save sabe se ficou velho
  const salvaRef = useRef(0); // versão que está no servidor
  const emVooRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grupoRef = useRef<{ chave: string; em: number } | null>(null);
  const travadoRef = useRef(somenteLeitura);
  travadoRef.current = somenteLeitura;
  const conflitoRef = useRef(false);

  const enviar = useCallback(async (): Promise<void> => {
    if (travadoRef.current || conflitoRef.current) return;
    if (emVooRef.current) { await emVooRef.current; return enviar(); }
    if (salvaRef.current === versaoRef.current) return;
    const versao = versaoRef.current;
    const atual = docRef.current;
    setSalvar({ tipo: "salvando" });
    const voo = (async () => {
      try {
        const r = await apiFluxos.salvarRascunho(detalhe.id, {
          grafo: atual.grafo, config: atual.config, nome: atual.nome.trim() || "Automação sem nome", pasta: atual.pasta,
          salvoEmBase: salvoEmRef.current,
        });
        salvoEmRef.current = r.salvoEm;
        salvaRef.current = versao;
        setSalvoEm(r.salvoEm);
        setWebhookUrl(r.webhookUrl);
        setSalvar(versaoRef.current === versao ? { tipo: "salvo" } : { tipo: "pendente" });
      } catch (e) {
        if (e instanceof ErroApi && e.status === 409) { conflitoRef.current = true; setSalvar({ tipo: "conflito" }); return; }
        setSalvar({ tipo: "erro", mensagem: (e as Error).message });
      }
    })();
    emVooRef.current = voo;
    await voo;
    emVooRef.current = null;
    // Mudou enquanto salvava: agenda de novo em vez de perder a última edição.
    if (!conflitoRef.current && salvaRef.current !== versaoRef.current && !timerRef.current) {
      timerRef.current = setTimeout(() => { timerRef.current = null; void enviar(); }, ESPERA_AUTOSAVE);
    }
  }, [detalhe.id]);

  const agendar = useCallback(() => {
    versaoRef.current += 1;
    if (travadoRef.current || conflitoRef.current) return;
    setSalvar({ tipo: "pendente" });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; void enviar(); }, ESPERA_AUTOSAVE);
  }, [enviar]);

  /** Salva já (antes de publicar, ensaiar ou sair). Resolve quando o servidor tem a versão atual. */
  const salvarAgora = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    await enviar();
    return salvaRef.current === versaoRef.current && !conflitoRef.current;
  }, [enviar]);

  const empilhar = useCallback((d: DocFluxo) => {
    passadoRef.current = [...passadoRef.current.slice(-(LIMITE_HISTORICO - 1)), d];
    futuroRef.current = [];
    setPilhas({ passado: passadoRef.current.length, futuro: 0 });
  }, []);

  const mudar = useCallback((fn: (d: DocFluxo) => DocFluxo, opcoes: OpcoesMudanca = {}) => {
    if (travadoRef.current) return;
    const antes = docRef.current;
    const depois = fn(antes);
    if (depois === antes) return;
    const { historico = true, agrupar } = opcoes;
    if (historico) {
      const agora = Date.now();
      const mesmoGrupo = agrupar && grupoRef.current?.chave === agrupar && agora - grupoRef.current.em < JANELA_AGRUPAR;
      grupoRef.current = agrupar ? { chave: agrupar, em: agora } : null;
      if (!mesmoGrupo) empilhar(antes);
    }
    docRef.current = depois;
    setDoc(depois);
    agendar();
  }, [agendar, empilhar]);

  /** Guarda o estado atual como passo de desfazer sem mudar nada (início de arraste). */
  const marcar = useCallback(() => {
    if (travadoRef.current) return;
    grupoRef.current = null;
    empilhar(docRef.current);
  }, [empilhar]);

  const andar = useCallback((de: MutableRefObject<DocFluxo[]>, para: MutableRefObject<DocFluxo[]>, topo: "fim" | "inicio") => {
    if (travadoRef.current || !de.current.length) return;
    const alvo = topo === "fim" ? de.current[de.current.length - 1] : de.current[0];
    de.current = topo === "fim" ? de.current.slice(0, -1) : de.current.slice(1);
    para.current = topo === "fim" ? [docRef.current, ...para.current].slice(0, LIMITE_HISTORICO) : [...para.current.slice(-(LIMITE_HISTORICO - 1)), docRef.current];
    docRef.current = alvo;
    grupoRef.current = null;
    setDoc(alvo);
    setPilhas({ passado: passadoRef.current.length, futuro: futuroRef.current.length });
    agendar();
  }, [agendar]);
  const desfazer = useCallback(() => andar(passadoRef, futuroRef, "fim"), [andar]);
  const refazer = useCallback(() => andar(futuroRef, passadoRef, "inicio"), [andar]);

  /** Troca tudo pelo que o servidor devolveu (restaurar versão, recarregar). Zera o histórico. */
  const substituir = useCallback((novo: FluxoDetalhe) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const d = docDe(novo);
    docRef.current = d;
    setDoc(d);
    passadoRef.current = [];
    futuroRef.current = [];
    setPilhas({ passado: 0, futuro: 0 });
    salvoEmRef.current = novo.rascunho.salvoEm;
    versaoRef.current += 1;
    salvaRef.current = versaoRef.current;
    conflitoRef.current = false;
    setSalvoEm(novo.rascunho.salvoEm);
    setWebhookUrl(novo.webhookUrl);
    setSalvar({ tipo: "salvo" });
  }, []);

  // Fechar a aba com edição não salva: o navegador pergunta antes.
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (salvaRef.current !== versaoRef.current && !travadoRef.current) { e.preventDefault(); }
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return {
    doc, mudar, marcar, desfazer, refazer, substituir, salvarAgora, setWebhookUrl,
    podeDesfazer: pilhas.passado > 0, podeRefazer: pilhas.futuro > 0,
    salvar, salvoEm, webhookUrl,
  };
}

function docDe(d: FluxoDetalhe): DocFluxo {
  return { grafo: d.rascunho.grafo, config: d.rascunho.config, nome: d.nome, pasta: d.pasta };
}
