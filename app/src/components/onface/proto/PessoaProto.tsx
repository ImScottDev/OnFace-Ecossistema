"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Ficha da Pessoa — o adaptador.
 *
 * A tela do handoff é centrada em LEAD: lê uma lista e escolhe o alvo. Aqui
 * ela recebe um lead só, o real, já achatado por `registroDoDesenho`.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ROTULO_ETAPA_PRE_VENDAS, ROTULO_FAMILIA, type Familia } from "@/lib/vendas/dominio";
import type { DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { PessoaLiga } from "./PessoaLiga";
import { levarParametros } from "./rota-do-desenho";
import { aquisicaoDaFicha, corrigirVazio, montarRelacoes, paraALiga } from "./relacoes-da-ficha";
import { registroDoDesenho } from "./registro-do-desenho";
import { qualDoDesenho } from "./PreVendasProto";
import { usePecas } from "./pecas-host";
import { acaoAtribuir, acaoRemoverDaCadencia, acaoResponsaveis, acaoSalvarContato, acaoTagDoLead } from "@/app/(produto)/pre-vendas/actions";
import {
  acaoBuscarEmpresas, acaoDesvincularEmpresaExtra, acaoExcluirContato, acaoPausarCadenciaDoLead, acaoVincularEmpresaExtra,
} from "@/app/(produto)/contatos/actions";
import type { AquisicaoDaPessoa, CadenciaDoLead, EmpresaExtraDaPessoa, OportunidadeDaPessoa } from "@/lib/vendas/ficha-extras";

/**
 * Corrige, na saída do protótipo, os campos que ele INVENTA.
 *
 * A ficha monta "linkedin.com/in/" + o nome quando o campo não vem, e usa
 * "+55 11 91234-5678" como telefone de exemplo. Os dois viram dado plausível e
 * errado na tela — e o botão "Abrir LinkedIn" leva ao perfil de outra pessoa.
 *
 * O valor é montado dentro de `renderVals`, que não tem gancho. Varrer a saída
 * e corrigir por RÓTULO é o que resolve sem tocar no arquivo gerado: a lista
 * de campos é a mesma estrutura em toda a tela, e o rótulo é o que o usuário
 * vê. Quando o handoff parar de inventar, isto fica inerte sozinho.
 */
function corrigirInventados(vals: any, reais: Record<string, string | null>): any {
  const visto = new Set<any>();

  const anda = (no: any): void => {
    if (!no || typeof no !== "object" || visto.has(no)) return;
    visto.add(no);

    if (Array.isArray(no)) { no.forEach(anda); return; }

    if (typeof no.label === "string" && Object.hasOwn(reais, no.label)) {
      const real = reais[no.label];
      no.valor = real ?? "—";
      // Sem valor não há o que abrir: o botão sairia para um endereço vazio.
      if (!real) { no.acao = undefined; no.acaoD = undefined; no.acaoTitulo = undefined; }
    }
    Object.values(no).forEach(anda);
  };

  anda(vals);
  return vals;
}

class PessoaLigada extends PessoaLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
  }

  /* A Liga gerada chama `this.diz` e não o define: sem ele todo aviso da ficha
     (inclusive o de excluir) morria em TypeError e a ação seguinte não rodava. */
  diz(texto: string, tom?: string) {
    if (tom === "erro") toast.error(texto);
    else if (tom === "aviso") toast.warning(texto);
    else toast.success(texto);
  }

  renderVals() {
    const vals = super.renderVals();
    const r = (this as any).props.reais ?? {};
    /* A barra "2 de 5" é do protótipo: o motor não guarda a posição numérica do passo. */
    if (vals.cad?.tem) vals.cad.passos = (vals.cad.passos ?? []).map(() => ({ style: "flex:1;height:3px;border-radius:2px;background:var(--of-linha)" }));
    /* Excluir contato: o desenho avisava "excluído" e navegava sem nada ter
       acontecido. Agora só avisa e sai depois que o servidor apagar; com
       histórico comercial ele recusa e o motivo aparece na tela. */
    if (vals.exc?.aberto) {
      const X = (this as any).state.excluir;
      const original = vals.exc.confirmar;
      vals.exc.confirmar = async () => {
        if (!X?.motivo || (X.motivo === "Outro" && !String(X.obs ?? "").trim())) return original();
        const ok = await (this as any).props.excluirContato?.(X.motivo, String(X.obs ?? "").trim());
        if (ok) (this as any).setState({ excluir: null });
      };
    }
    /* O desenho só liga o relatório a "Ligação realizada|iniciada|recebida";
       o dado real chega como "Ligação finalizada — …" / "Ligação recebido". */
    const abrir = (this as any).props.abrir;
    vals.interacoes = (vals.interacoes ?? []).map((t: any) =>
      t.onClick || !/^Ligação (finalizada|recebid|enviad)/.test(t.titulo || "") ? t : {
        ...t, temRel: true, dica: "Abrir relatório da ligação",
        linha: `${t.linha};cursor:pointer`, hover: "background:var(--of-papel-alterno)",
        onClick: () => abrir?.("relatorio"),
      });
    /* A aba "Oportunidades" e o contador dela leem só o lead local
       (`etapa === "oportunidade"`), nunca as oportunidades gravadas. Aqui vêm
       do que a ficha carregou: as mesmas do card "Relações em andamento". */
    const reais: Array<{ titulo: string; etapa: string; familia: string }> = (this as any).props.oportunidades ?? [];
    vals.opps = reais.map((o) => ({
      titulo: o.titulo, meta: o.familia, etapa: o.etapa,
    }));
    vals.semOpps = reais.length === 0;
    const aba = (vals.abas ?? []).find((a: any) => a.label === "Oportunidades");
    if (aba) { aba.conta = String(reais.length); aba.temConta = reais.length > 0; }
    corrigirVazio(vals.relAtivas, (this as any).props.relacoes, !!(this as any).state?.hidratado);
    return corrigirInventados(vals, r);
  }
}

export function PessoaProto({ lead, timeline, cadencia, extras, daPessoa }: {
  lead: DetalheLead;
  timeline: LinhaDoTempo[];
  /** A inscrição viva do lead numa cadência (ou null). */
  cadencia: CadenciaDoLead | null;
  /** As outras empresas a que a pessoa está vinculada (vínculo aberto). */
  extras: EmpresaExtraDaPessoa[];
  /** TODAS as aquisições e oportunidades da pessoa (`relacoesDaPessoa`): a mesma pessoa pode ter mais de um lead. */
  daPessoa: { aquisicoes: AquisicaoDaPessoa[]; oportunidades: OportunidadeDaPessoa[] };
}) {
  const router = useRouter();

  const registro = React.useMemo(() => ({ ...registroDoDesenho(lead), criadoEm: lead.criadoEm }), [lead]);

  /* Qualificação real do lead (interesse/tamanho/dor/fit), para o card
     "Qualificação" da ficha. Antes a ficha só mostrava o Interesse (fallback de
     `L.interesse`) e deixava Fit/Tamanho/Dor sempre "Não preenchido": o store
     `qual` nunca era alimentado aqui. Mesma fonte do drawer de Pré-vendas. */
  const qual = React.useMemo(() => {
    const q = qualDoDesenho(lead.qualificacao);
    return q ? { [lead.id]: q } : {};
  }, [lead.qualificacao, lead.id]);

  /* A equipe REAL: o menu de responsável só oferecia quem já era o responsável. */
  const [equipe, setEquipe] = React.useState<Array<{ id: string; nome: string }>>([]);
  React.useEffect(() => { void acaoResponsaveis().then(setEquipe).catch(() => undefined); }, []);

  /* TODAS as aquisições da pessoa, não só o lead que a ficha abriu: a mesma
     pessoa entra mais de uma vez (e-mail repetido, deduplicação), e cada entrada
     é uma relação em andamento. `leadId: null` é de propósito: restringir por lead
     as esconderia. A nutrição mostra motivo e quando entrou. */
  const relacoes = React.useMemo(() => montarRelacoes({
    empresaId: lead.empresa.id ?? "", leadId: null,
    aquisicoes: daPessoa.aquisicoes.map((a) => aquisicaoDaFicha({
      id: a.id, etapa: a.etapa, etapaRotulo: a.etapaRotulo, origem: a.origem, criadoEm: a.criadoEm,
      responsavel: a.responsavel, nutricao: a.nutricao,
    })),
    oportunidades: daPessoa.oportunidades,
    propostas: null,
    conta: {
      nome: lead.empresa.nome, ativo: lead.naCarteira, jaTeveServico: lead.jaTeveServico,
      ficha: lead.fichaDeCliente,
    },
    vazioPrefixo: `Nenhuma aquisição ativa ou oportunidade registrada para ${lead.pessoa.nome}.`,
  }), [lead, daPessoa]);

  const catalogo = React.useMemo(() => ({
    EQUIPE: equipe.length ? equipe.map((e) => e.nome) : (lead.responsavel.nome ? [lead.responsavel.nome] : []),
    /* `ETAPAS` é o que dá o chip de etapa no cabeçalho — sem ele a ficha
       mostrava "—" no lugar de "Em contato". */
    ETAPAS: Object.fromEntries(
      Object.entries(ROTULO_ETAPA_PRE_VENDAS).map(([k, label]) => [k, { label }]),
    ),
    LEADS: [], CONVERSAS: [], CADENCIAS: [], SEGMENTOS: [],
    /* O card "Relações em andamento" pergunta por aqui. A regra (aquisição,
       oportunidade, venda ganha, Cliente ativo x 360) mora em
       `relacoes-da-ficha.ts`; o vazio só vale com as fontes lidas. */
    Relacoes: () => paraALiga(relacoes, (rota) => router.push(rota)),
  }), [lead.responsavel.nome, relacoes, router, equipe]);

  const oportunidades = React.useMemo(
    () => daPessoa.oportunidades.map((o) => ({
      titulo: o.titulo, etapa: o.etapaRotulo,
      familia: o.familia ? ROTULO_FAMILIA[o.familia as Familia] ?? o.familia : "Família a definir",
    })),
    [daPessoa.oportunidades],
  );

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "empresa" && id) { router.push(`/empresas/${id}`); return; }
    abrirPeca(peca, id, { tela: "pessoa", leadId: lead.id, empresaId: lead.empresa.id, empresa: lead.empresa.nome });
  }, [router, abrirPeca, lead.id, lead.empresa.id, lead.empresa.nome]);

  /* Notas internas do lead, lidas do servidor (a ficha só guardava na tela e
     elas sumiam ao recarregar). */
  const [notas, setNotas] = React.useState<Array<{ id: string; autor: string; texto: string; quando: string }>>([]);
  const lerNotas = React.useCallback(async () => {
    try {
      const r = await fetch(`/api/notas?leadId=${encodeURIComponent(lead.id)}`);
      if (!r.ok) return;
      const lista: Array<{ id: string; conteudo: string; autorNome: string | null; createdAt: string }> = await r.json();
      setNotas(lista.map((n) => ({
        id: n.id, autor: n.autorNome ?? "Sistema", texto: n.conteudo,
        quando: new Date(n.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      })));
    } catch { /* sem notas: a ficha mostra vazio */ }
  }, [lead.id]);
  React.useEffect(() => { void lerNotas(); }, [lerNotas]);

  const slugP = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const pessoasStore = React.useMemo(
    () => ({ [`${slugP(registro.pessoa ?? "")}@${slugP(registro.empresa || "Sem empresa")}`]: {
      notas, cadPausada: !!cadencia?.pausada, empresasExtra: extras.map((e) => ({ nome: e.nome, papel: e.papel })),
    } }),
    [registro.pessoa, registro.empresa, notas, cadencia, extras],
  );

  /* Cada alteração da ficha vira o command que existe. Era um aviso ("as
     alterações são feitas em Pré-vendas") e o dado se perdia ao recarregar. */
  /* O formulário "Cadastrar e vincular" entrega cnpj/segmento/site no store de
     empresas (`gravar`) um instante ANTES de pedir o vínculo (`persistir`). */
  const detalhesDaEmpresaNova = React.useRef<Record<string, { cnpj?: string; segmento?: string; site?: string }>>({});
  const persistir = React.useCallback(async (patch: Record<string, any>) => {
    const falha = (t?: string) => toast.error(t ?? "Não consegui salvar.");
    /* "—" é o que a ficha mostra para campo vazio; no formulário de edição ele
       vira valor. Gravar o travessão como WhatsApp/LinkedIn seria sujar o dado. */
    const v = (x: unknown) => { const t = String(x ?? "").trim(); return t === "—" ? "" : t; };
    const contato: Record<string, string> = {};
    if ("nome" in patch) contato.nome = v(patch.nome);
    if ("cargo" in patch) contato.cargo = v(patch.cargo);
    if ("email" in patch) contato.email = v(patch.email);
    if ("tel" in patch) contato.telefone = v(patch.tel);
    if ("whats" in patch) contato.whatsapp = v(patch.whats);
    if ("linkedin" in patch) contato.linkedin = v(patch.linkedin);
    if ("cidade" in patch) contato.cidade = v(patch.cidade);
    if ("obs" in patch) contato.observacao = v(patch.obs);
    if (Object.keys(contato).length) {
      const r = await acaoSalvarContato(lead.id, contato);
      if (!r.ok) return falha(r.erro);
      router.refresh();
    }
    if (Array.isArray(patch.notas) && patch.notas[0]?.texto) {
      const r = await fetch("/api/notas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, conteudo: patch.notas[0].texto }),
      });
      if (!r.ok) return falha("Não consegui salvar a nota.");
      await lerNotas();
      router.refresh();
    }
    if (patch.tagRemover) {
      const r = await acaoTagDoLead(lead.id, patch.tagRemover, "remover");
      if (!r.ok) return falha(r.erro);
      router.refresh();
    }
    if (patch.resp) {
      const id = equipe.find((e) => e.nome === patch.resp)?.id ?? null;
      if (!id) return falha(`Não encontrei "${patch.resp}" na equipe.`);
      const r = await acaoAtribuir(lead.id, id);
      if (!r.ok) return falha(r.erro);
      router.refresh();
    }
    if ("cadPausada" in patch) {
      const r = await acaoPausarCadenciaDoLead(lead.id, !!patch.cadPausada);
      if (!r.ok) return falha(r.erro);
      router.refresh();
    }
    if (Array.isArray(patch.empresasExtra)) {
      const lista = patch.empresasExtra as Array<{ nome: string; papel?: string }>;
      const jaTem = new Set(extras.map((e) => e.nome));
      for (const n of lista.filter((x) => !jaTem.has(x.nome))) {
        const novo = detalhesDaEmpresaNova.current[n.nome] ?? {};
        const r = await acaoVincularEmpresaExtra(lead.id, { nome: n.nome, papel: n.papel, ...novo });
        if (!r.ok) return falha(r.erro);
      }
      for (const e of extras.filter((x) => !lista.some((n) => n.nome === x.nome))) {
        const r = await acaoDesvincularEmpresaExtra(lead.id, e.empresaId);
        if (!r.ok) return falha(r.erro);
      }
      router.refresh();
    }
    if ("tags" in patch) {
      toast.warning("As tags do contato mudam pelo botão Adicionar tag.");
    }
  }, [lead.id, equipe, extras, router, lerNotas]);

  const gravar = React.useCallback((patch?: Record<string, any>) => {
    if (patch?.empresas) detalhesDaEmpresaNova.current = { ...detalhesDaEmpresaNova.current, ...patch.empresas };
    /* "Remover da cadência": a Liga só zera o nome no store local. */
    if (patch?.cadencias && Object.values(patch.cadencias).some((v) => v === null)) {
      void acaoRemoverDaCadencia(lead.id).then((r) => {
        if (!r.ok) toast.error(r.erro);
        router.refresh();
      });
      return;
    }
    router.refresh();
  }, [router, lead.id]);

  /* Excluir contato: devolve true quando o servidor apagou (a Liga fecha o modal). */
  const excluirContato = React.useCallback(async (motivo: string, obs: string) => {
    const r = await acaoExcluirContato(lead.id, motivo, obs);
    if (!r.ok) { toast.error(r.erro); return false; }
    toast.success(`${registro.pessoa ?? "Contato"} excluído`);
    router.push(lead.empresa?.id ? `/empresas/${lead.empresa.id}` : "/contatos");
    router.refresh();
    return true;
  }, [lead.id, lead.empresa?.id, registro.pessoa, router]);

  return (
    <div data-workspace="desenho">
      <PessoaLigada
        dados={{ leads: [registro], eventos: timeline, qual, pessoas: pessoasStore, cadencias: cadencia ? { [registro.id]: cadencia.nome } : {} }}
        reais={{
          LinkedIn: registro.linkedin,
          Telefone: registro.tel,
          WhatsApp: registro.whatsapp,
          "E-mail": registro.email,
        }}
        catalogo={catalogo}
        relacoes={relacoes}
        oportunidades={oportunidades}
        abrir={abrir}
        gravar={gravar}
        persistir={persistir}
        excluirContato={excluirContato}
        buscarEmpresas={acaoBuscarEmpresas}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
