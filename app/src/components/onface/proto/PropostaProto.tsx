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
  /** E-mail do cadastro do vendedor responsável: é o da testemunha da Callface. Nunca montado a partir do nome. */
  respEmail?: string | null;
  leadId: string | null;
  origem: string | null;
  /** Dados do contrato já gravados na Empresa, no formato do modal "Dados do contrato". */
  empresaDados?: Record<string, string>;
  pessoas: Array<{ id: string; nome: string; papel: string; email: string | null; telefone: string | null; cpf?: string | null }>;
  /** As propostas da oportunidade, com as linhas: o builder abre o rascunho com elas. */
  propostas: Array<{
    id: string; codigo: string; versao: number; status: string; modo?: string | null; validade?: number;
    editor?: Record<string, unknown>; itens?: any[];
  }>;
}

/** O que o modal "Dados do contrato" mudou: vai para a Empresa e para o contato (ver `acaoSalvarDadosDoContrato`). */
export interface MudancaDoContrato {
  empresa?: Record<string, string>;
  pessoa?: { nome: string; pessoaId?: string | null; cargo?: string; email?: string; telefone?: string; cpf?: string };
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
  salvarDadosContrato?: (e: { empresaId: string } & MudancaDoContrato) => Promise<Resultado<{ pessoaSalva: boolean; pessoaId: string | null }>>;
  criar: (e: {
    negocioId: string;
    itens: ItemParaCriar[];
    observacoes?: string | null;
    prazoContratoMeses?: number | null;
    parcelasSetup?: number | null;
    signatarios?: unknown;
    editor?: unknown;
  }) => Promise<Resultado<{ propostaId: string }>>;
  /** Edita as linhas de um rascunho que já existe. */
  atualizar: (e: {
    propostaId: string;
    itens: Array<Omit<ItemParaCriar, "catalogoPrecoId"> & { catalogoPrecoId?: string | null; itemExistenteId?: string | null }>;
    observacoes?: string | null;
    prazoContratoMeses?: number | null;
    parcelasSetup?: number | null;
    signatarios?: unknown;
    editor?: unknown;
  }) => Promise<Resultado<{ propostaId: string }>>;
  /** Nova versão de uma proposta já enviada: copia as linhas e devolve o rascunho. */
  revisar: (propostaId: string) => Promise<Resultado<{ propostaId: string; versao: number }>>;
  enviar: (e: {
    propostaId: string;
    modoFechamento: "PREPAID" | "CONTRACT";
    validadeDias: number;
    tipoContratual?: "NOVO_CONTRATO" | "ADITIVO" | "UPGRADE" | "DOWNGRADE" | null;
    enviarEmail: boolean;
    destinatarioEmail?: string | null;
  }) => Promise<Resultado<{ link: string; email: "enviado" | "nao_solicitado" | "sem_destinatario" | "sem_provedor" | "falhou"; destinatario: string | null }>>;
}

/* A conversão das linhas do desenho para o command (`itensParaCriar`) mora em linhas-da-proposta.ts: é conta pura e tem teste. */
import { itensParaCriar } from "./linhas-da-proposta";
export { itensParaCriar };

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

  /* NÃO chamar super.diz: a Liga faz `diz -> E.avisar -> this.diz`, e como `this.diz` é este override,
     super.diz recursava (Maximum call stack) e "Salvar rascunho" morria sem gravar nada.
     O toast de sucesso de quem grava é o `persistir` (depois do servidor responder): o "Proposta
     enviada" que a Liga dispara na mesma hora seria mentira se o servidor recusar, então fica calado. */
  private calar = false;
  diz(t: string, tom?: string) {
    if (this.calar && tom !== "erro") { if (/^Salva como rascunho/.test(t)) toast.warning(t); return; }
    if (tom === "erro") toast.error(t);
    else if (tom === "aviso") toast.warning(t);
    else toast.success(t);
  }

  /** O ponto único de saída: rascunho e envio passam por aqui. */
  gravar(propPatch: any, oppPatch: any, evento: string | null) {
    this.calar = true;
    setTimeout(() => { this.calar = false; }, 0);
    /* Antes de `super.gravar`, que mexe no índice: qual proposta REAL este
       salvamento edita. Rascunho existente = atualiza; versão nova de uma
       proposta enviada = revisão; sem nenhuma = cria. */
    const O = (this as any).opp?.();
    const st = (this as any).state;
    const props: any[] = O?.propostas ?? [];
    const alvo = st.modo === "editar" && st.idx != null ? props[st.idx] : null;
    const base = st.modo === "versao" && st.baseIdx != null ? props[st.baseIdx] : null;
    const r = super.gravar(propPatch, oppPatch, evento);
    (this as any).props.persistir?.(propPatch, evento, { alvoId: alvo?.id ?? null, baseId: base?.id ?? null });
    return r;
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function PropostaProto({ oportunidade, catalogo, acoes, repPadrao }: {
  oportunidade: OportunidadeDaProposta;
  /** Representante legal padrão de Ajustes > Contratos: só valor inicial, a proposta ganha dele. */
  repPadrao?: { nome: string; email: string } | null;
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
  /* Os dados da empresa que o modal lê (`Es.ler("empresas")[empresa]`), já gravados no banco. */
  const dados = React.useMemo(() => ({
    opps: [oportunidade],
    empresas: { [oportunidade.empresa]: oportunidade.empresaDados ?? {} },
  }), [oportunidade]);

  /* O modal grava campo a campo; agrupa o que vem em rajada e grava uma vez. `esvaziar` antes de
     enviar garante que o gate de dados jurídicos veja o que acabou de ser digitado. */
  const pendente = React.useRef<MudancaDoContrato>({});
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const esvaziar = React.useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const m = pendente.current; pendente.current = {};
    if (!oportunidade.empresaId || !acoes.salvarDadosContrato || (!m.empresa && !m.pessoa)) return;
    const r = await acoes.salvarDadosContrato({ empresaId: oportunidade.empresaId, ...m });
    if (!r.ok) toast.error(`Não consegui gravar os dados do contrato na empresa: ${r.erro}`);
  }, [acoes, oportunidade.empresaId]);
  const salvarContrato = React.useCallback((m: MudancaDoContrato) => {
    const p = pendente.current;
    if (m.empresa) p.empresa = { ...p.empresa, ...m.empresa };
    if (m.pessoa) p.pessoa = p.pessoa && p.pessoa.nome === m.pessoa.nome ? { ...p.pessoa, ...m.pessoa } : m.pessoa;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void esvaziar(); }, 700);
  }, [esvaziar]);
  React.useEffect(() => () => { void esvaziar(); }, [esvaziar]);

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
  const persistir = React.useCallback(async (proposta: any, evento: string | null, alvo?: { alvoId: string | null; baseId: string | null }) => {
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

    await esvaziar();

    const ed = proposta?.editor ?? {};
    const contratual = proposta?.modo !== "PREPAID";
    const condicoes = {
      observacoes: ed.obs ?? null,
      /* No contrato, o prazo é o do modal "Dados do contrato" (ou a fidelidade da proposta). */
      prazoContratoMeses: (contratual ? Number(ed.ct?.prazo) || Number(ed.fidelidade) : 0) || null,
      parcelasSetup: Number(ed.parcelas) || null,
      /* Quem assina (dos dois lados) e o editor inteiro, com os dados congelados no envio. */
      signatarios: contratual ? (proposta?.signatarios ?? []) : [],
      editor: proposta?.contrato ? { ...ed, contrato: proposta.contrato } : ed,
    };

    let criada: Resultado<{ propostaId: string }>;
    if (alvo?.alvoId) {
      criada = await acoes.atualizar({ propostaId: alvo.alvoId, itens, ...condicoes });
    } else if (alvo?.baseId) {
      // Versão nova de proposta já enviada: a revisão copia as linhas, e o que mudou entra por cima.
      const rev = await acoes.revisar(alvo.baseId);
      if (!rev.ok) { toast.error(rev.erro); return; }
      criada = await acoes.atualizar({ propostaId: rev.dados!.propostaId, itens, ...condicoes });
    } else {
      criada = await acoes.criar({
        negocioId: oportunidade.id,
        itens: itens.map((i) => ({ ...i, catalogoPrecoId: i.catalogoPrecoId })),
        ...condicoes,
      });
    }

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
        /* Só dispara e-mail se o canal "e-mail" ficou marcado no fluxo; "só o link" não manda nada. */
        enviarEmail: (proposta.editor?.canais ?? []).includes("email"),
        destinatarioEmail: proposta.editor?.para || null,
      });
      if (!enviada.ok) {
        toast.error(`Proposta criada, mas não enviada: ${enviada.erro}`, {
          action: { label: "Abrir proposta", onClick: () => router.push(`/propostas/${id}`) },
        });
        return;
      }
      const mail = enviada.dados?.email;
      if (mail === "enviado") toast.success(`E-mail enviado para ${enviada.dados?.destinatario}.`);
      else if (mail === "nao_solicitado") toast.info("Nenhum e-mail enviado: só o link. Copie o link na página da proposta.");
      else if (mail) toast.warning("Proposta enviada, mas o e-mail não saiu. Copie o link na página da proposta e mande ao cliente.");
    }

    /* "#nova-v1" é o código provisório do desenho; o número real nasce no banco. */
    toast.success(evento?.replace(/ #nova-v\d+/g, "") ?? "Proposta gravada.", id ? {
      action: { label: "Abrir proposta", onClick: () => router.push(`/propostas/${id}`) },
    } : undefined);
    if (id) router.push(`/propostas/${id}`);
  }, [acoes, oportunidade.id, router, esvaziar]);

  return (
    <div data-workspace="desenho">
      <PropostaLigada
        oppId={oportunidade.id}
        dados={dados}
        repPadrao={repPadrao ?? null}
        salvarContrato={salvarContrato}
        catalogo={catalogoDoProto}
        catalogoReal={catalogoReal}
        abrir={abrir}
        persistir={persistir}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
