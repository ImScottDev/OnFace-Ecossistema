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
import { comIdGravado } from "./proposta-id-no-estado";
import { resumoDoEnvio, type AvisoDoEnvio } from "./envio-da-proposta";
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
  /** E-mail e telefone do contato do negócio, resolvidos no servidor pela chave `lead_id` (nunca pelo nome). */
  contato?: { email: string; telefone: string };
  /** `leadId` é o que a proposta guarda como destinatário; null = a pessoa não tem cadastro de lead e não pode recebê-la. */
  pessoas: Array<{ id: string; nome: string; papel: string; email: string | null; telefone: string | null; whatsapp?: string | null; cpf?: string | null; leadId?: string | null }>;
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
  /** O texto que o cliente lê sob o nome. Vazio = a descrição do catálogo. */
  descricao?: string | null;
  tipo: "recorrente" | "avulso" | "setup";
  quantidade: number;
  valorUnitario: number;
  desconto: number;
}

export interface AcoesProposta {
  salvarDadosContrato?: (e: { empresaId: string } & MudancaDoContrato) => Promise<Resultado<{ pessoaSalva: boolean; pessoaId: string | null }>>;
  criar: (e: {
    negocioId: string;
    /** O contato que recebe a proposta, escolhido na tela. */
    leadId?: string | null;
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
    /** Só quando o vendedor trocou o contato nesta edição. */
    leadId?: string | null;
    /** Motivo opcional da alteração (a justificativa de desconto do passo 2): vai para a auditoria. */
    motivo?: string | null;
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
    /** Sai pelo número de WhatsApp de QUEM clica em enviar; sem número conectado dele, não sai por outro. */
    enviarWhatsapp?: boolean;
    telefoneWhatsapp?: string | null;
    mensagemWhatsapp?: string | null;
  }) => Promise<Resultado<AvisoDoEnvio & { link: string }>>;
}

/* A conversão das linhas do desenho para o command (`itensParaCriar`) mora em linhas-da-proposta.ts: é conta pura e tem teste. */
import { itensParaCriar } from "./linhas-da-proposta";
export { itensParaCriar };

/** O que `persistir` devolve à tela: ela só mostra "enviada" com `ok` e `enviado`. */
export type ResultadoDaPersistencia =
  | { ok: true; id: string | null; enviado: boolean; aviso?: AvisoDoEnvio | null }
  | { ok: false; erro: string; id?: string | null; etapa?: "gravar" | "enviar" };

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

  /**
   * O ponto único de saída: rascunho e envio passam por aqui, e a tela ESPERA a resposta do servidor.
   *
   * Grava no estado local (otimista, é o que o Builder lê) e persiste. Quando o servidor devolve o id,
   * a tela passa a EDITAR essa proposta (`modo: "editar"` + `id`): o segundo clique vira `atualizar`,
   * não uma proposta duplicada. Falha no envio deixa o rascunho gravado e a tela no passo 5, com o motivo.
   */
  async persistirAgora(propPatch: any, oppPatch: any, evento: string | null) {
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
    super.gravar(propPatch, oppPatch, evento);
    /* `super.gravar` troca a entrada local pelo patch, que não tem id: sem devolver o id, uma falha aqui faria o próximo clique CRIAR outra proposta. */
    if (alvo?.id) (this as any).adotarGravada(alvo.id, false);
    /* O id da proposta gravada volta para o estado: o link público (/p/<id>) só existe a partir dele,
       e na NOVA VERSÃO (revisão) o id nasce agora, no servidor. */
    const aoGravar = (id: string) => (this as any).setState((s: any) => ({ d: comIdGravado(s.d, id) }));
    const r: ResultadoDaPersistencia = await (this as any).props.persistir?.(propPatch, evento, { alvoId: alvo?.id ?? null, baseId: base?.id ?? null, aoGravar })
      ?? { ok: false, erro: "A tela não está ligada ao servidor." };
    if (r.id) (this as any).adotarGravada(r.id, r.ok && r.enviado);
    return r;
  }

  /** Mantida para quem ainda chama `gravar` direto: mesma gravação, sem esperar. */
  gravar(propPatch: any, oppPatch: any, evento: string | null) {
    void this.persistirAgora(propPatch, oppPatch, evento);
    return (this as any).opp?.() ?? null;
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
  const persistir = React.useCallback(async (proposta: any, evento: string | null, alvo?: { alvoId: string | null; baseId: string | null; aoGravar?: (id: string) => void }): Promise<ResultadoDaPersistencia> => {
    const { itens, semPreco } = itensParaCriar(proposta?.itens);

    /* Todo `return` abaixo devolve o motivo à tela (passo 5 mostra e não some); o toast é só reforço. */
    const recusa = (erro: string, extra: { id?: string | null; etapa?: "gravar" | "enviar" } = {}): ResultadoDaPersistencia => {
      toast.error(erro);
      return { ok: false, erro, ...extra };
    };
    if (semPreco.length) {
      return recusa(`Estes itens não vieram do catálogo e não podem ser gravados: ${semPreco.join(", ")}.`, { etapa: "gravar" });
    }
    if (!itens.length) {
      return recusa("Escolha ao menos um item do catálogo.", { etapa: "gravar" });
    }

    await esvaziar();

    const ed = proposta?.editor ?? {};

    /* O contato que recebe a proposta é ESCOLHA do vendedor (passo 0): o nome escolhido vira o lead dele.
       Pessoa da empresa sem lead não pode receber proposta, e dizer isso é melhor que assumir outra. */
    const nomeContato = String(ed.contato ?? "").trim();
    let leadEscolhido: string | null = null;
    if (nomeContato) {
      if (nomeContato === oportunidade.pessoa && oportunidade.leadId) leadEscolhido = oportunidade.leadId;
      else {
        const pessoa = oportunidade.pessoas.find((p) => p.nome === nomeContato);
        if (pessoa && !pessoa.leadId) {
          return recusa(`${nomeContato} não tem cadastro de contato (lead) e não pode receber a proposta. Escolha outro contato ou cadastre este.`, { etapa: "gravar" });
        }
        leadEscolhido = pessoa?.leadId ?? null;
      }
    }
    /* Na edição de um rascunho, só troca o destinatário se o vendedor MUDOU o contato nesta edição. */
    const alvoId = alvo?.alvoId ?? null;
    const salva = alvoId ? oportunidade.propostas.find((p) => p.id === alvoId) : null;
    const contatoSalvo = String((salva?.editor as any)?.contato ?? oportunidade.pessoa ?? "").trim();
    const trocouContato = !!alvoId && nomeContato !== "" && nomeContato !== contatoSalvo;
    /* A justificativa do desconto (opcional) é o motivo que a auditoria guarda. */
    const justif = String(ed.desc?.justif ?? "").trim();
    const justifSalva = String((salva?.editor as any)?.desc?.justif ?? "").trim();
    /* Só vale o que o vendedor escreveu NESTA edição: uma justificativa velha não pode ser colada numa mudança nova. */
    const motivo = justif && justif !== justifSalva ? justif : null;
    const contratual = proposta?.modo !== "PREPAID";
    const condicoes = {
      observacoes: ed.obs ?? null,
      /* No contrato, o prazo é o do modal "Dados do contrato" (ou a fidelidade da proposta). */
      prazoContratoMeses: (contratual ? Number(ed.ct?.prazo) || Number(ed.fidelidade) : 0) || null,
      /* "À vista" é 1 parcela, mesmo que o passo tenha guardado um número de parcelas de antes: o contrato lê este valor. */
      parcelasSetup: ed.setupForma === "parcelado" ? (Number(ed.parcelas) || null) : 1,
      /* Quem assina (dos dois lados) e o editor inteiro, com os dados congelados no envio. */
      signatarios: contratual ? (proposta?.signatarios ?? []) : [],
      editor: proposta?.contrato ? { ...ed, contrato: proposta.contrato } : ed,
    };

    let criada: Resultado<{ propostaId: string }>;
    if (alvo?.alvoId) {
      criada = await acoes.atualizar({ propostaId: alvo.alvoId, itens, motivo, ...(trocouContato && leadEscolhido ? { leadId: leadEscolhido } : {}), ...condicoes });
    } else if (alvo?.baseId) {
      // Versão nova de proposta já enviada: a revisão copia as linhas (e o contato), e o que mudou entra por cima.
      const rev = await acoes.revisar(alvo.baseId);
      if (!rev.ok) return recusa(rev.erro, { etapa: "gravar" });
      criada = await acoes.atualizar({ propostaId: rev.dados!.propostaId, itens, motivo, ...(leadEscolhido ? { leadId: leadEscolhido } : {}), ...condicoes });
    } else {
      criada = await acoes.criar({
        negocioId: oportunidade.id,
        leadId: leadEscolhido,
        itens: itens.map((i) => ({ ...i, catalogoPrecoId: i.catalogoPrecoId })),
        ...condicoes,
      });
    }

    if (!criada.ok) return recusa(criada.erro, { etapa: "gravar" });
    const id = criada.dados?.propostaId ?? null;
    if (id) alvo?.aoGravar?.(id);

    /* O desenho marca `status: "enviada"` quando o usuário conclui o fluxo de
       envio. Criar sempre nasce rascunho no domínio, então o envio é um
       segundo passo — e é ele que manda o e-mail ao cliente. */
    let enviado = false;
    let aviso: AvisoDoEnvio | null = null;
    if (proposta?.status === "enviada" && id) {
      /* O modo e a validade saem da proposta montada: o desenho já pergunta
         os dois no passo de fechamento, e reperguntar seria desfazer o fluxo. */
      const canais: string[] = proposta.editor?.canais ?? [];
      const enviada = await acoes.enviar({
        propostaId: id,
        modoFechamento: proposta.modo === "PREPAID" ? "PREPAID" : "CONTRACT",
        validadeDias: Number(proposta.validade) || 14,
        tipoContratual: proposta.modo === "PREPAID" ? null : "NOVO_CONTRATO",
        /* Só dispara e-mail se o canal "e-mail" ficou marcado no fluxo; "só o link" não manda nada. */
        enviarEmail: canais.includes("email"),
        destinatarioEmail: proposta.editor?.para || null,
        /* WhatsApp: sai pela sessão de quem clicou (o servidor resolve; não há como escolher a de outro). */
        enviarWhatsapp: canais.includes("whatsapp"),
        telefoneWhatsapp: proposta.editor?.wa || null,
        mensagemWhatsapp: proposta.editor?.msgWa || null,
      });
      if (!enviada.ok) {
        /* O rascunho ficou gravado (id devolvido): a tela continua no passo 5, com o motivo, e o próximo clique edita esta mesma proposta. */
        toast.error(`Proposta salva como rascunho, mas não enviada: ${enviada.erro}`, {
          action: { label: "Abrir proposta", onClick: () => router.push(`/propostas/${id}`) },
        });
        return { ok: false, erro: enviada.erro, id, etapa: "enviar" };
      }
      enviado = true;
      aviso = enviada.dados ?? null;
    }

    /* O registro e o aviso dizem o que REALMENTE saiu, não o que estava marcado na tela. */
    const resumo = enviado ? resumoDoEnvio(aviso) : null;
    const base = enviado ? `Proposta enviada. ${resumo!.linhas.join(" ")}` : (evento?.replace(/ #nova-v\d+/g, "") ?? "Proposta gravada.");
    const acao = id ? { action: { label: "Abrir proposta", onClick: () => router.push(`/propostas/${id}`) } } : undefined;
    if (enviado && resumo!.falhou) toast.warning(base, { ...acao, duration: 12000 });
    else toast.success(base, acao);
    if (id) router.push(`/propostas/${id}`);
    return { ok: true, id, enviado, aviso };
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
