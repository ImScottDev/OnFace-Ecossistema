"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Oportunidade 360 — o adaptador.
 *
 * `OportunidadeDesenho` é o markup convertido do handoff e `OportunidadeLiga`
 * a lógica dele, portada. Este arquivo fica entre os dois e o produto.
 *
 * É o único dos três escrito à mão: decidir qual campo do domínio corresponde
 * a qual campo do desenho é julgamento, e julgamento não se automatiza.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useOrdemDaEquipe } from "./equipe-do-proto";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DelegarAgenteHost } from "./DelegarAgenteHost";

import type { DetalheOportunidade } from "@/lib/vendas/consultas";
import { ehFamiliaValida } from "@/lib/vendas/dominio";
import type { Resultado } from "@/lib/vendas/resultado";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { rotuloDeEvento, tituloLegivel } from "@/lib/vendas/rotulos-evento";
import { OportunidadeLiga } from "./OportunidadeLiga";
import { oportunidadeParaODesenho } from "./oportunidade-para-o-desenho";
import { levarParametros } from "./rota-do-desenho";
import { persistirEtapa, type CommandsDeEtapa } from "./persistencia";
import { usePecas } from "./pecas-host";
import { qualDoDesenho } from "./qual-do-desenho";
import { prazoDoBanco, situacaoDoBanco, tipoDoBanco } from "./atividade-tarefa";

/* ── Contratos ─────────────────────────────────────────────────────────── */

export interface AcoesOportunidade extends CommandsDeEtapa {
  definirProximaAcao: (negocioId: string, descricao: string | null, quando: string | null) => Promise<Resultado>;
  /** Derivar nova oportunidade da mesma empresa. Sem isto o botao avisa que nao grava. */
  criarOportunidade?: (entrada: {
    empresaId: string; familias: Array<"CALLFACE_AI" | "PABX" | "WHITE_LABEL">; responsavelId: string;
    titulo?: string | null; leadId?: string | null;
  }) => Promise<Resultado<{ ids: string[] }>>;
  /** Define/corrige a família comercial desta oportunidade. Usado pelos
   *  negócios LEGADOS que vieram do dump sem família — sem ela o card não
   *  avança para Proposta/Negociação nem fecha em Ganho. */
  alterarFamilia?: (negocioId: string, familia: "CALLFACE_AI" | "PABX" | "WHITE_LABEL", motivo: string | null) => Promise<Resultado<{ propostasIncompativeis: number }>>;
  atribuirResponsavel?: (negocioId: string, nome: string) => Promise<Resultado>;
  salvarResumo?: (negocioId: string, campos: Record<string, string>) => Promise<Resultado>;
  recusarProposta?: (propostaId: string, motivo: string) => Promise<Resultado>;
  excluirRascunho?: (propostaId: string) => Promise<Resultado>;
}

const FAMILIAS_ESCOLHA: Array<{ v: "CALLFACE_AI" | "PABX" | "WHITE_LABEL"; rotulo: string; desc: string }> = [
  { v: "CALLFACE_AI", rotulo: "Callface AI", desc: "Discador e inteligência de ligação" },
  { v: "PABX", rotulo: "PABX", desc: "Telefonia, ramais e linhas" },
  { v: "WHITE_LABEL", rotulo: "White Label", desc: "Revenda da plataforma" },
];

/* ── Persistência ──────────────────────────────────────────────────────── */


/**
 * O protótipo com as gravações ligadas.
 *
 * Duas intervenções, ambas por subclasse para não encostar no arquivo gerado:
 *
 * 1. `gravarOpp` é o ponto único das mutações — daqui elas viram command.
 * 2. `autoRevisao` é desligada. Ver a nota no método.
 */
class OportunidadeLigada extends OportunidadeLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
    /* O protótipo lia a oportunidade de `?opp=` porque navegava por query
       string, e só no `componentDidMount` — que não roda no servidor. Sem o id
       aqui, o SSR não acha a oportunidade, `renderVals` devolve um objeto
       incompleto e a tela cai com "Cannot read properties of undefined". */
    (this as any).oppId = props.oppId;
  }

  componentDidMount() {
    super.componentDidMount?.();
    // O didMount do protótipo sobrescreve `oppId` com o query param; devolver.
    (this as any).oppId = (this as any).props.oppId;
    (this as any).forceUpdate();
  }

  /**
   * Desligada de propósito.
   *
   * A regra é real — proposta recusada ou com ajuste pedido deve gerar uma
   * atividade de revisão para o responsável. Mas ela roda no
   * `componentDidUpdate` e GRAVA, o que aqui daria dois problemas: criaria a
   * tarefa uma vez por aba aberta (sem `chave_idempotencia` que a impeça), e
   * cairia no `persistir` abaixo, que responde "isto ainda não grava" e
   * recarrega — um laço de refresh sem fim.
   *
   * Automação que cria tarefa é do DOMÍNIO, não da tela: pertence ao command
   * que muda o status da proposta, onde roda uma vez e é idempotente.
   */
  autoRevisao() {}

  /* Mutacao sem command (nota, atividade, pessoa, resumo...) NAO grava: o `persistir` avisa e a tela
     relê. O toast de sucesso que o desenho dispara logo depois ("Nota adicionada") era mentira; fica
     calado ate o fim do tick, e so o aviso de que nao gravou aparece. */
  private naoGrava = false;

  gravarOpp(o: any, evento: string) {
    const antes = (this as any).todas?.().find((x: any) => x.id === o.id);
    const novo = super.gravarOpp(o, evento);
    this.naoGrava = !antes || antes.etapa === novo.etapa;
    if (this.naoGrava) queueMicrotask(() => { this.naoGrava = false; });
    (this as any).props.persistir?.(antes, novo, evento || "Esta alteração");
    return novo;
  }

  /* NÃO chamar super.diz: a Liga faz `diz -> E.avisar -> this.diz`, e como
     `this.diz` é este override, super.diz recursava infinito (Maximum call
     stack) e travava "Avançar etapa" no drawer. Mostra o toast direto, igual
     aos outros protos (Empresa/Pessoa/Calendário). */
  diz(t: string, tom?: string) {
    if (this.naoGrava) return;
    if (tom === "erro") toast.error(t);
    else if (tom === "aviso") toast.warning(t);
    else toast.success(t);
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function OportunidadeProto({ oportunidade, timeline, acoes, equipe = [], abrirDefinirFamilia = false }: {
  oportunidade: DetalheOportunidade;
  timeline: LinhaDoTempo[];
  acoes: AcoesOportunidade;
  /** Equipe real da organização (nomes), para @menção e seletor de responsável. */
  equipe?: string[];
  /** Vem do board quando o gate "defina a família antes de avançar" dispara:
   *  abre o seletor de família já na entrada. */
  abrirDefinirFamilia?: boolean;
}) {
  const router = useRouter();

  /* Seletor de família para o LEGADO sem família. Abre sozinho quando o board
     mandou (abrirDefinirFamilia) e a oportunidade ainda não tem família.
     SÓ em oportunidade ABERTA: ganho/perdido não muda de família (o command
     recusa), então o banner viraria um botão que só dá erro. `ehFamiliaValida`
     cobre o caso `service_family='UNKNOWN'` (string truthy que o gate rejeita). */
  const semFamilia = !ehFamiliaValida(oportunidade.familia)
    && oportunidade.etapa !== "ganho" && oportunidade.etapa !== "perdido";
  const [famAberto, setFamAberto] = React.useState(false);
  const [famSalvando, setFamSalvando] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (abrirDefinirFamilia && semFamilia) setFamAberto(true);
  }, [abrirDefinirFamilia, semFamilia]);

  const escolherFamilia = React.useCallback(async (familia: "CALLFACE_AI" | "PABX" | "WHITE_LABEL") => {
    if (!acoes.alterarFamilia) { toast.error("Definir família ainda não está ligado nesta tela."); return; }
    setFamSalvando(familia);
    const r = await acoes.alterarFamilia(oportunidade.id, familia, "Família definida na oportunidade legada");
    setFamSalvando(null);
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success("Família definida. Agora dá para avançar a oportunidade.");
    setFamAberto(false);
    router.refresh();
  }, [acoes, oportunidade.id, router]);

  /* O protótipo semeia o estado uma vez e depois só escreve nele. Bumpar a
     chave quando `dados` muda faz a tela renascer sobre a verdade do servidor
     — inclusive quando o command RECUSA a mudança. */
  const [geracao, setGeracao] = React.useState(0);
  const primeira = React.useRef(true);
  React.useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    setGeracao((n) => n + 1);
  }, [oportunidade, timeline]);

  const opp = React.useMemo(
    () => oportunidadeParaODesenho(oportunidade, timeline),
    [oportunidade, timeline],
  );

  const ordenarEquipe = useOrdemDaEquipe();
  const catalogo = React.useMemo(() => {
    // Equipe real da organização, vinda do banco. Garante que o responsável
    // atual esteja na lista mesmo se, por algum motivo, não vier na query.
    const nomes = equipe.length ? equipe.slice() : [];
    if (oportunidade.responsavel.nome && !nomes.includes(oportunidade.responsavel.nome)) {
      nomes.unshift(oportunidade.responsavel.nome);
    }
    return {
      EQUIPE: ordenarEquipe(nomes),
      OPORTUNIDADES: [],
      LEADS: [],
    };
  }, [equipe, oportunidade.responsavel.nome, ordenarEquipe]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "empresa" && id) { router.push(`/empresas/${id}`); return; }
    if (peca === "proposta" && id) { router.push(`/propostas/${id}`); return; }
    if (peca === "lead" && id) { router.push(`/pre-vendas?lead=${encodeURIComponent(id)}`); return; }
    abrirPeca(peca, id, {
      tela: "oportunidade", oportunidadeId: oportunidade.id,
      leadId: oportunidade.leadId, empresaId: oportunidade.empresa.id, empresa: oportunidade.empresa.nome,
    });
  }, [router, abrirPeca, oportunidade.id, oportunidade.leadId, oportunidade.empresa.id, oportunidade.empresa.nome]);

  /**
   * Cada mutação do desenho, traduzida para o command certo.
   *
   * O que não tem command NÃO grava em silêncio: avisa e desfaz. Tela que
   * parece que gravou e não gravou é o defeito mais caro, porque não dá erro.
   */
  const derivar = React.useCallback(async (f: { familia: any; resp: string; pessoa: string; etapa?: string; motivo: string }) => {
    if (!acoes.criarOportunidade) { toast.error("Derivar oportunidade ainda não é gravado por esta tela."); return; }
    if (!oportunidade.empresa.id || !oportunidade.responsavel.id || f.resp !== oportunidade.responsavel.nome) {
      toast.error("Só é possível derivar para o responsável atual desta oportunidade (a lista de equipe ainda não vem do banco).");
      return;
    }
    const r = await acoes.criarOportunidade({
      empresaId: oportunidade.empresa.id, familias: [f.familia], responsavelId: oportunidade.responsavel.id,
      titulo: null, leadId: oportunidade.leadId,
    });
    if (!r.ok) { toast.error(r.erro); return; }
    const novo = r.dados?.ids?.[0];

    /* A nota interna é obrigatória no modal: ela é o contexto para quem vai
       tocar a nova oportunidade. Gravar pela mesma rota que a ficha usa, para
       a nota nascer igual às outras. Falhar aqui não desfaz a oportunidade,
       mas NÃO pode passar em silêncio — o modal pediu a nota. */
    const nota = (f.motivo ?? "").trim();
    let notaGravou = true;
    if (novo && nota) {
      const rn = await fetch("/api/notas", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: nota, negocioId: novo }),
      }).catch(() => null);
      notaGravou = !!rn?.ok;
    }

    /* O modal ainda pergunta a etapa inicial, e criarOportunidade não recebe
       etapa: a nova nasce sempre na primeira. Avisar em vez de fingir.
       (O contato principal do modal também não chega aqui com id — a lista do
       desenho só carrega nome —, então a derivada herda o lead da origem.) */
    const naoGravou = [
      f.etapa && f.etapa !== "entrada" ? "a etapa inicial" : null,
      !notaGravou && nota ? "a nota interna" : null,
    ].filter(Boolean) as string[];

    if (naoGravou.length) toast.warning(`Oportunidade criada, mas não gravei ${naoGravou.join(" nem ")}.`);
    else toast.success("Oportunidade criada.");

    if (novo) router.push(`/pipeline/${novo}`); else router.refresh();
  }, [acoes, oportunidade, router]);

  /**
   * O que a tela edita sem ser etapa: nota, responsável, resumo, proposta.
   *
   * Compara o antes e o depois que o desenho entrega e leva cada diferença ao
   * lugar certo. Devolve a lista do que gravou, ou o erro. Atividade NÃO passa
   * por aqui: nasce e se edita na peça de Atividade (tarefas), que já grava.
   */
  const persistirOutras = React.useCallback(async (antes: any, depois: any): Promise<{ gravou: string[]; naoGravou: string[]; erro?: string }> => {
    const gravou: string[] = [];
    const naoGravou: string[] = [];
    const falhou = (erro: string) => ({ gravou, naoGravou, erro });

    // Notas: nova (sem id), removida (id que sumiu). Fixar não tem coluna.
    const notasAntes: any[] = antes?.notas ?? [], notasDepois: any[] = depois?.notas ?? [];
    for (const n of notasDepois.filter((x) => !x.id && !x.sistema && !x.virtual && String(x.texto ?? "").trim())) {
      const r = await fetch("/api/notas", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: String(n.texto).trim(), negocioId: depois.id }),
      });
      if (!r.ok) return falhou("Não consegui gravar a nota.");
      gravou.push("Nota adicionada");
    }
    const idsDepois = new Set(notasDepois.map((x) => x.id).filter(Boolean));
    for (const n of notasAntes.filter((x) => x.id && !x.sistema && !idsDepois.has(x.id))) {
      const r = await fetch(`/api/notas/${n.id}`, { method: "DELETE", credentials: "same-origin" });
      if (!r.ok) return falhou("Não consegui excluir a nota.");
      gravou.push("Nota excluída");
    }
    if (notasDepois.some((x) => x.id && x.fixada && !notasAntes.find((y) => y.id === x.id)?.fixada)) naoGravou.push("fixar nota");

    // Responsável.
    if (antes?.resp && depois?.resp && antes.resp !== depois.resp) {
      const r = await acoes.atribuirResponsavel?.(depois.id, depois.resp);
      if (!r) naoGravou.push("trocar responsável");
      else if (!r.ok) return falhou(r.erro);
      else gravou.push(`Responsável: ${depois.resp}`);
    }

    // Resumo da oportunidade.
    if (JSON.stringify(antes?.resumoCampos ?? {}) !== JSON.stringify(depois?.resumoCampos ?? {})) {
      const r = await acoes.salvarResumo?.(depois.id, depois.resumoCampos ?? {});
      if (!r) naoGravou.push("resumo");
      else if (!r.ok) return falhou(r.erro);
      else gravou.push("Resumo salvo");
    }

    // Propostas: rascunho excluído e recusa registrada pelo vendedor.
    const propsAntes: any[] = antes?.propostas ?? [], propsDepois: any[] = depois?.propostas ?? [];
    for (const p of propsAntes.filter((x) => x.id && !propsDepois.some((y) => y.id === x.id))) {
      const r = await acoes.excluirRascunho?.(p.id);
      if (!r) naoGravou.push("excluir rascunho");
      else if (!r.ok) return falhou(r.erro);
      else gravou.push("Rascunho excluído");
    }
    for (const p of propsDepois) {
      const antesP = propsAntes.find((x) => x.id === p.id);
      if (antesP && antesP.status !== "recusada" && p.status === "recusada") {
        const r = await acoes.recusarProposta?.(p.id, String(p.resposta ?? "").trim());
        if (!r) naoGravou.push("registrar recusa");
        else if (!r.ok) return falhou(r.erro);
        else gravou.push("Recusa registrada");
      }
    }

    // O que o desenho ainda deixa mudar sem ter onde gravar.
    const mudou = (k: string) => JSON.stringify(antes?.[k] ?? null) !== JSON.stringify(depois?.[k] ?? null);
    if (mudou("pessoas")) naoGravou.push("contatos da oportunidade");
    if (mudou("arquivos")) naoGravou.push("arquivos");
    return { gravou, naoGravou };
  }, [acoes]);

  const persistir = React.useCallback(async (antes: any, depois: any, evento: string) => {
    const d = await persistirEtapa(antes, depois, evento, acoes);
    if (d.tipo === "gravou") { router.refresh(); return; }

    if (d.tipo === "sem-command") {
      const o = await persistirOutras(antes, depois);
      if (o.erro) toast.error(o.erro);
      else if (o.gravou.length) toast.success(o.gravou.join(" · "));
      if (o.naoGravou.length) toast.warning(`Ainda não é gravado nesta tela: ${o.naoGravou.join(", ")}.`);
      if (!o.erro && !o.gravou.length && !o.naoGravou.length) toast.warning(d.motivo);
      router.refresh();
      return;
    }

    /* Recusa desfaz igual — a tela relê do servidor. O que muda é a mensagem,
       e o CTA quando o domínio manda um. Aqui ele não navega: já estamos na
       página onde a família e a proposta se resolvem. */
    toast.error(d.motivo);
    router.refresh();
  }, [acoes, router, persistirOutras]);

  return (
    <div data-workspace="desenho">
      {semFamilia && (
        <button
          type="button"
          onClick={() => setFamAberto(true)}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", margin: "0 0 12px", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--of-coral-anel)", background: "var(--of-coral-fundo)", color: "var(--of-coral-texto)", font: "inherit", fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
        >
          <span aria-hidden style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: 7, background: "var(--of-coral-texto)", color: "var(--of-papel)", display: "grid", placeItems: "center", fontSize: 14 }}>!</span>
          Esta oportunidade (legado) está sem família comercial. Clique para definir e poder avançar.
        </button>
      )}

      <OportunidadeLigada
        key={geracao}
        oppId={oportunidade.id}
        dados={{ opps: [opp], leads: [] }}
        catalogo={catalogo}
        abrir={abrir}
        persistir={persistir}
        derivar={derivar}
        ir={(href: string) => router.push(href)}
      />

      <DelegarAgenteHost />

      {famAberto && (
        <div
          role="dialog" aria-modal="true" aria-label="Definir família da oportunidade"
          onClick={() => !famSalvando && setFamAberto(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(18,23,29,.45)", display: "grid", placeItems: "center", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 100%)", background: "var(--of-papel)", borderRadius: 18, padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--of-tinta-forte)", letterSpacing: "-.02em" }}>A qual família pertence?</h2>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--of-tinta-2)" }}>Oportunidade legada sem família. Escolha uma para amarrar e seguir o fluxo (proposta, checkout, ganho).</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FAMILIAS_ESCOLHA.map((f) => (
                <button
                  key={f.v} type="button" disabled={!!famSalvando}
                  onClick={() => escolherFamilia(f.v)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid var(--of-linha)", background: famSalvando === f.v ? "var(--of-coral-fundo)" : "var(--of-papel)", cursor: famSalvando ? "wait" : "pointer", textAlign: "left", font: "inherit" }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--of-tinta-forte)" }}>{f.rotulo}{famSalvando === f.v ? " · salvando…" : ""}</span>
                  <span style={{ fontSize: 12, color: "var(--of-tinta-3)" }}>{f.desc}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => !famSalvando && setFamAberto(false)} style={{ marginTop: 14, width: "100%", padding: "10px", borderRadius: 10, border: 0, background: "transparent", color: "var(--of-tinta-2)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Agora não</button>
          </div>
        </div>
      )}
    </div>
  );
}
