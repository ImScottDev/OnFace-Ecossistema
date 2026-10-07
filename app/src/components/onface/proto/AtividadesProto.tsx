"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Atividades — o adaptador.
 *
 * O desenho agrega de três fontes: a lista própria (`atividadesV2`), as
 * atividades penduradas em cada oportunidade e a próxima ação de cada lead.
 * No produto as três são a MESMA tabela — `tarefas` —, e `montarAtividades`
 * já faz a agregação com prazo, prioridade e jornada calculados no servidor.
 *
 * Então tudo entra pela lista própria, e as outras duas ficam vazias: somar a
 * mesma tarefa duas vezes seria pior do que não mostrar.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Atividade, DadosAtividades } from "@/components/onface/atividades/types";
import { acaoResponsaveis } from "@/app/(produto)/pre-vendas/actions";
import { AtividadesLiga } from "./AtividadesLiga";
import { levarParametros } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";
import {
  alterarTarefa, corpoDaMudanca, corpoDaNova, criarTarefa, prazoDoBanco, prioridadeDoBanco, situacaoDoBanco, tipoDoBanco,
} from "./atividade-tarefa";

class AtividadesLigada extends AtividadesLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
  }

  /** O aviso da Liga só sai depois que o servidor confirmar (ver `gravar`). */
  diz(texto: string) { (this as any).props.avisou?.(texto); }
}

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

/**
 * A tarefa canônica na forma que o desenho consome.
 *
 * `iniD`/`fimD` são o par data+hora que ele usa para posicionar a atividade na
 * timeline e no calendário — sem eles, tudo cai em "sem data".
 */
function paraODesenho(a: Atividade) {
  const fim = prazoDoBanco(a.venceEm, a.dataVencimento);
  return {
    id: a.id,
    titulo: a.titulo,
    desc: a.descricao ?? "",
    tipo: tipoDoBanco(a.tipo),
    situacao: situacaoDoBanco(a.status),
    feita: a.status === "concluida",
    prioridade: prioridadeDoBanco(a.prioridade),
    resp: a.responsavel,
    autor: a.responsavel,
    assignees: a.responsavel ? [a.responsavel] : [],
    empresa: a.vinculo?.tipo === "Avulsa" ? null : a.vinculo?.nome ?? null,
    pessoa: "",
    // A jornada de onde a tarefa veio é a "área" do desenho.
    area: a.jornada,
    fimD: fim.fimD || null,
    fimH: fim.fimH || null,
    iniD: null,
    iniH: null,
    quando: a.vencimentoTexto,
    sub: [],
    comentarios: [],
    reuniao: null,
    href: a.vinculo?.href ?? null,
  };
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function AtividadesProto({ dados }: { dados: DadosAtividades }) {
  const router = useRouter();

  const atividades = React.useMemo(
    () => dados.atividades.map(paraODesenho),
    [dados.atividades],
  );

  /* O responsável chega por nome no desenho; o id vem da equipe da org. */
  const [equipe, setEquipe] = React.useState<Array<{ id: string; nome: string }>>([]);
  React.useEffect(() => { acaoResponsaveis().then(setEquipe, () => {}); }, []);
  const idDoResponsavel = React.useCallback((nome: string) => equipe.find((r) => r.nome === nome)?.id, [equipe]);

  const catalogo = React.useMemo(() => ({
    /* "Para outra pessoa" lista TODOS os usuários ativos da org. Antes vinha de
       `filtrosResponsavel`, que só tem quem já tem atividade (e trazia os
       rótulos "Todos os responsáveis" e "Sem responsável" como se fossem gente).
       Sem a equipe carregada ainda, cai nos responsáveis que a tela já conhece. */
    EQUIPE: equipe.length
      ? equipe.map((r) => r.nome)
      : dados.filtrosResponsavel.filter((f) => f.valor !== "todos" && f.valor !== "sem-dono").map((f) => f.label),
    // As outras duas fontes do desenho ficam vazias: no produto as três são a
    // mesma tabela, e agregar de novo contaria a tarefa duas vezes.
    OPORTUNIDADES: [],
    LEADS: [],
    AtividadesSeed: [],
    ProjetosSeed: [],
    Projetos: [],
  }), [dados.filtrosResponsavel, equipe]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    abrirPeca(peca, id, { tela: "tarefas" });
  }, [abrirPeca]);

  /* Empresa por nome → id, só das contas que já aparecem na lista (vínculo Cliente). */
  const idDaEmpresa = React.useMemo(() => new Map(
    dados.atividades.flatMap((a) => {
      const m = a.vinculo?.href?.match(/empresa=([0-9a-f-]{36})/i);
      return m ? [[a.vinculo.nome, m[1]] as [string, string]] : [];
    }),
  ), [dados.atividades]);

  const antes = React.useRef(atividades);
  React.useEffect(() => { antes.current = atividades; }, [atividades]);
  const aviso = React.useRef<string | null>(null);
  const avisou = React.useCallback((t: string) => { aviso.current = t; }, []);

  /**
   * A lista inteira que a Liga devolve, comparada com a anterior: o que é novo
   * vira POST, o que mudou vira PATCH (`/api/tarefas`, org + dono/gestor).
   * Subtarefa, comentário, anexo e fila não existem no domínio — avisa e relê.
   */
  const gravar = React.useCallback(async (patch: { atividadesV2?: any[] }) => {
    const lista = patch?.atividadesV2;
    // O aviso da Liga chega logo depois desta chamada, na mesma volta.
    await Promise.resolve();
    const msg = aviso.current;
    aviso.current = null;
    if (!lista) { toast("Isso ainda não é gravado no CRM."); router.refresh(); return; }

    const porId = new Map(antes.current.map((a) => [a.id, a]));
    antes.current = lista;
    const erros: string[] = [];
    const avisos = new Set<string>();
    let gravou = false;
    for (const a of lista) {
      const velho = porId.get(a.id);
      if (!velho) {
        const empresaId = a.empresa ? idDaEmpresa.get(a.empresa) ?? null : null;
        if ((a.empresa && !empresaId) || a.pessoa) avisos.add("vínculo (escolha pela ficha da empresa ou do lead)");
        if ((a.sub ?? []).length) avisos.add("subtarefas");
        const r = await criarTarefa({ ...corpoDaNova(a, idDoResponsavel), empresaId });
        if (r.ok) gravou = true; else erros.push(r.erro);
        continue;
      }
      const { corpo, naoGravado } = corpoDaMudanca(velho, a, idDoResponsavel);
      naoGravado.forEach((n) => avisos.add(n));
      if (!Object.keys(corpo).length) continue;
      const r = await alterarTarefa(a.id, corpo);
      if (r.ok) gravou = true; else erros.push(r.erro);
    }
    if (erros.length) toast.error(erros[0]);
    else if (gravou && msg) toast.success(msg);
    if (avisos.size) toast(`Não gravado no CRM: ${[...avisos].join(", ")}.`);
    router.refresh();
  }, [router, idDoResponsavel, idDaEmpresa]);

  return (
    <div data-workspace="desenho">
      <AtividadesLigada
        dados={{ atividadesV2: atividades, opps: [], leads: [] }}
        catalogo={catalogo}
        abrir={abrir}
        gravar={gravar}
        avisou={avisou}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
