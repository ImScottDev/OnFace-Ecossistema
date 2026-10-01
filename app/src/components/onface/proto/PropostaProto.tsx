"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Proposta — o Builder, ligado.
 *
 * Esta tela não mostra uma proposta: CONSTRÓI uma, a partir de uma
 * oportunidade, em cinco passos. É o arquétipo Builder, o mais denso do
 * handoff.
 *
 * Duas coisas fazem este adaptador existir:
 *
 * 1. O protótipo carrega um catálogo HARDCODED, com preços que não batem com
 *    o banco. Proposta é compromisso com o cliente — o preço não se adivinha.
 * 2. `gravar()` é o ponto único de saída (rascunho e envio passam por ele), e
 *    é ali que a proposta vira `acaoCriar`.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ItemCatalogo } from "@/lib/vendas/propostas";
import type { Resultado } from "@/lib/vendas/resultado";
import { PropostaLiga } from "./PropostaLiga";
import { levarParametros } from "./rota-do-desenho";
import { catalogoDoDesenho } from "./catalogo-do-desenho";
import { usePecas } from "./pecas-host";

/* ── Contratos ─────────────────────────────────────────────────────────── */

/** A oportunidade que recebe a proposta. */
export interface OportunidadeDaProposta {
  id: string;
  empresa: string;
  empresaId: string | null;
  pessoa: string;
  cargo: string;
  familia: string | null;
  etapa: string;
  resp: string | null;
  leadId: string | null;
  origem: string | null;
  pessoas: Array<{ id: string; nome: string; papel: string; email: string | null; telefone: string | null }>;
  propostas: Array<{ codigo: string; versao: number; status: string }>;
}

export interface ItemParaCriar {
  catalogoPrecoId: string;
  nome: string;
  tipo: "recorrente" | "avulso" | "setup";
  quantidade: number;
  valorUnitario: number;
  desconto: number;
}

export interface AcoesProposta {
  criar: (e: {
    negocioId: string;
    itens: ItemParaCriar[];
    observacoes?: string | null;
    prazoContratoMeses?: number | null;
    parcelasSetup?: number | null;
  }) => Promise<Resultado<{ propostaId: string }>>;
  enviar: (e: {
    propostaId: string;
    modoFechamento: "PREPAID" | "CONTRACT";
    validadeDias: number;
    tipoContratual?: "NOVO_CONTRATO" | "ADITIVO" | "UPGRADE" | "DOWNGRADE" | null;
  }) => Promise<Resultado>;
}

/* ── Proposta do desenho → entrada do command ──────────────────────────── */

/**
 * O tipo do item, no vocabulário de `acaoCriar`.
 *
 * O desenho carrega a natureza que ele mesmo derivou do intervalo; o command
 * quer três valores. Mensal e anual são os dois recorrentes.
 */
function tipoDoItem(natureza: string): ItemParaCriar["tipo"] {
  // O desenho deriva ARR do intervalo anual; o domínio não tem essa natureza —
  // anual é MRR com periodicidade diferente, e os dois são recorrentes.
  if (natureza === "MRR" || natureza === "ARR") return "recorrente";
  if (natureza === "SETUP") return "setup";
  return "avulso";
}

/**
 * Os itens da proposta montada, prontos para o command.
 *
 * Item sem `preco` é recusado em vez de enviado com id vazio: `catalogoPrecoId`
 * é o que amarra a linha da proposta ao preço praticado, e sem ele a proposta
 * nasce sem origem de valor.
 */
export function itensParaCriar(itens: any[]): { itens: ItemParaCriar[]; semPreco: string[] } {
  const bons: ItemParaCriar[] = [];
  const semPreco: string[] = [];

  for (const it of itens ?? []) {
    if (!it?.preco) { semPreco.push(it?.nome ?? "item sem nome"); continue; }
    bons.push({
      catalogoPrecoId: String(it.preco),
      nome: String(it.nome ?? "").trim(),
      tipo: tipoDoItem(String(it.natureza ?? "")),
      quantidade: Number(it.qtd) || 1,
      valorUnitario: Number(it.valor) || 0,
      // O desenho guarda desconto em % ou em R$; o command quer o valor.
      desconto: it.descTipo === "pct"
        ? ((Number(it.valor) || 0) * (Number(it.qtd) || 1) * (Number(String(it.descVal).replace(",", ".")) || 0)) / 100
        : Number(String(it.descVal).replace(",", ".")) || 0,
    });
  }

  return { itens: bons, semPreco };
}

/* ── O Builder, ligado ─────────────────────────────────────────────────── */

class PropostaLigada extends PropostaLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
    /* Duas coisas que o protótipo só fazia no cliente, e o servidor precisa:

       1. `oppId` vinha de `?opp=` no `componentDidMount`.
       2. O RASCUNHO (`state.d`) nasce em `iniciar(O)`, chamado pelo
          `componentDidUpdate`.

       Sem os dois, `renderVals` devolve um objeto incompleto no SSR e a tela
       cai com "Cannot read properties of undefined". */
    (this as any).oppId = props.oppId;

    /* `iniciar` chama `setState`, que no construtor o React ignora com um
       aviso. Redirecionar para escrita direta em `this.state` é o que ele
       permite ali — e é exatamente o que `setState` faria antes da montagem.
       Só durante o construtor: depois dele, o `setState` normal volta. */
    const real = (this as any).setState;
    (this as any).setState = (patch: any) => {
      const p = typeof patch === "function" ? patch((this as any).state) : patch;
      (this as any).state = { ...(this as any).state, ...p };
    };
    try {
      const O = (this as any).opp?.();
      if (O) (this as any).iniciar?.(O);
    } finally {
      (this as any).setState = real;
    }
  }

  componentDidMount() {
    super.componentDidMount?.();
    (this as any).oppId = (this as any).props.oppId;
    (this as any).forceUpdate();
  }

  /**
   * O catálogo real, no lugar do que vinha escrito no protótipo.
   *
   * Sobrescrever o método é o que permite trocar a fonte sem tocar no arquivo
   * gerado — e sem isto a tela ofereceria o Agente IA por R$ 349,90 quando o
   * catálogo pratica R$ 500,00.
   */
  catalogo() {
    return (this as any).props.catalogoReal ?? {};
  }

  /** O ponto único de saída: rascunho e envio passam por aqui. */
  gravar(propPatch: any, oppPatch: any, evento: string | null) {
    const r = super.gravar(propPatch, oppPatch, evento);
    (this as any).props.persistir?.(propPatch, evento);
    return r;
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function PropostaProto({ oportunidade, catalogo, acoes }: {
  oportunidade: OportunidadeDaProposta;
  /** O catálogo real, já carregado por família. */
  catalogo: Record<string, ItemCatalogo[]>;
  acoes: AcoesProposta;
}) {
  const router = useRouter();

  const catalogoReal = React.useMemo(() => catalogoDoDesenho(catalogo), [catalogo]);

  const catalogoDoProto = React.useMemo(() => ({
    EQUIPE: oportunidade.resp ? [oportunidade.resp] : [],
    OPORTUNIDADES: [],
    LEADS: [],
  }), [oportunidade.resp]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "empresa" && id) { router.push(`/empresas/${id}`); return; }
    abrirPeca(peca, id, { tela: "proposta", oportunidadeId: oportunidade.id, empresaId: oportunidade.empresaId, empresa: oportunidade.empresa });
  }, [router, abrirPeca, oportunidade.id, oportunidade.empresaId, oportunidade.empresa]);

  /**
   * A proposta montada vira uma proposta de verdade.
   *
   * `acaoCriar` grava os itens amarrados ao catálogo, e `acaoEnviar` dispara
   * o e-mail. São dois passos porque são dois fatos: criar um rascunho não
   * avisa ninguém, enviar avisa o cliente.
   */
  const persistir = React.useCallback(async (proposta: any, evento: string | null) => {
    const { itens, semPreco } = itensParaCriar(proposta?.itens);

    if (semPreco.length) {
      toast.error(
        `Estes itens não vieram do catálogo e não podem ser gravados: ${semPreco.join(", ")}.`,
      );
      return;
    }
    if (!itens.length) {
      toast.error("Escolha ao menos um item do catálogo.");
      return;
    }

    const criada = await acoes.criar({
      negocioId: oportunidade.id,
      itens,
      observacoes: proposta?.editor?.observacoes ?? null,
      prazoContratoMeses: Number(proposta?.editor?.prazo) || null,
      parcelasSetup: Number(proposta?.editor?.parcelas) || null,
    });

    if (!criada.ok) { toast.error(criada.erro); return; }
    const id = criada.dados?.propostaId;

    /* O desenho marca `status: "enviada"` quando o usuário conclui o fluxo de
       envio. Criar sempre nasce rascunho no domínio, então o envio é um
       segundo passo — e é ele que manda o e-mail ao cliente. */
    if (proposta?.status === "enviada" && id) {
      /* O modo e a validade saem da proposta montada: o desenho já pergunta
         os dois no passo de fechamento, e reperguntar seria desfazer o fluxo. */
      const enviada = await acoes.enviar({
        propostaId: id,
        modoFechamento: proposta.modo === "PREPAID" ? "PREPAID" : "CONTRACT",
        validadeDias: Number(proposta.validade) || 14,
        tipoContratual: proposta.modo === "PREPAID" ? null : "NOVO_CONTRATO",
      });
      if (!enviada.ok) {
        toast.error(`Proposta criada, mas não enviada: ${enviada.erro}`, {
          action: { label: "Abrir proposta", onClick: () => router.push(`/propostas/${id}`) },
        });
        return;
      }
    }

    toast.success(evento ?? "Proposta gravada.", id ? {
      action: { label: "Abrir proposta", onClick: () => router.push(`/propostas/${id}`) },
    } : undefined);
    if (id) router.push(`/propostas/${id}`);
  }, [acoes, oportunidade.id, router]);

  return (
    <div data-workspace="desenho">
      <PropostaLigada
        oppId={oportunidade.id}
        dados={{ opps: [oportunidade] }}
        catalogo={catalogoDoProto}
        catalogoReal={catalogoReal}
        abrir={abrir}
        persistir={persistir}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
