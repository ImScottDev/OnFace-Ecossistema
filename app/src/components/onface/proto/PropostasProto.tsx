"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Propostas — o adaptador.
 *
 * O desenho não lista propostas: lista OPORTUNIDADES com as propostas dentro,
 * e cada linha da tabela é um par (oportunidade, proposta). Por isso o
 * adaptador reagrupa a lista plana que o domínio entrega — é a tradução, e é
 * a razão deste arquivo existir.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { LinhaProposta } from "@/app/(crm2)/propostas/actions";
import { PropostasLiga } from "./PropostasLiga";
import { levarParametros } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";

class PropostasLigada extends PropostasLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
  }
}

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

/**
 * Os itens que o desenho soma para mostrar o valor.
 *
 * `soma()` no protótipo percorre `p.itens`; a lista do domínio traz os totais
 * já calculados (`total`, `totalRecorrente`) e NÃO traz os itens — carregá-los
 * para 200 propostas seria uma varredura por linha, e a lista não desdobra a
 * composição: só o drawer da Proposta faz isso, e ele carrega os seus.
 *
 * Dois itens agregados reproduzem exatamente o total do banco. Não é invenção:
 * é o mesmo número, na forma que o desenho sabe somar.
 */
function itensAgregados(p: LinhaProposta) {
  const recorrente = p.totalRecorrente ?? 0;
  const avulso = (p.total ?? 0) - recorrente;
  const itens: Array<{ nome: string; natureza: string; valor: number; qtd: number }> = [];
  if (recorrente) itens.push({ nome: "Recorrente", natureza: "MRR", valor: recorrente, qtd: 1 });
  if (avulso) itens.push({ nome: "Avulso", natureza: "ONE_TIME", valor: avulso, qtd: 1 });
  return itens;
}

/** Os três meses que o desenho reconhece, abreviados como ele espera. */
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * A data no vocabulário do protótipo: "hoje", "ontem" ou "23 set".
 *
 * Não é preferência de formato — é contrato. O gráfico de forecast chama
 * `dataDe()`, que casa com /(\d{1,2})\s+([a-zç]{3})/ e devolve HOJE para
 * qualquer coisa que não bata. Com "23/09" todas as propostas caíam no mesmo
 * dia e o forecast do mês inteiro desenhava uma reta em R$ 0.
 */
function dia(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const soODia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((soODia(d) - soODia(new Date())) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === -1) return "ontem";
  return `${d.getDate()} ${MES[d.getMonth()]}`;
}

/**
 * A lista plana do domínio, reagrupada por oportunidade.
 *
 * Uma proposta sem negócio vinculado vira um grupo próprio — são 455 no banco,
 * propostas antigas que só apontam para um lead. Jogá-las fora esconderia
 * quase um terço da base; agrupá-las com as outras misturaria empresas.
 */
function agrupar(linhas: LinhaProposta[]) {
  const grupos = new Map<string, any>();

  for (const p of linhas) {
    const chave = p.negocioId ?? `proposta:${p.id}`;
    let o = grupos.get(chave);
    if (!o) {
      o = {
        id: chave,
        negocioId: p.negocioId,
        empresa: p.empresa ?? "Empresa não informada",
        pessoa: p.pessoa ?? "",
        cargo: "",
        familia: p.familia,
        resp: p.responsavel,
        etapa: "proposta",
        propostas: [],
      };
      grupos.set(chave, o);
    }
    o.propostas.push({
      id: p.id,
      // O código é o NÚMERO da proposta no banco, não um "P-1540" inventado.
      codigo: String(p.numero),
      versao: p.versao,
      status: p.status,
      modo: p.modoFechamento,
      enviadaEm: dia(p.enviadaEm),
      validade: dia(p.validade),
      // O que o cliente respondeu, quando pediu ajuste. É o texto dele.
      resposta: p.ajusteSolicitado,
      itens: itensAgregados(p),
      log: [],
    });
  }

  // Versões em ordem: o desenho escolhe a vigente pela última viva da lista.
  for (const o of grupos.values()) {
    o.propostas.sort((a: any, b: any) => a.versao - b.versao);
  }
  return [...grupos.values()];
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function PropostasProto({ linhas, responsaveis }: {
  linhas: LinhaProposta[];
  responsaveis: string[];
}) {
  const router = useRouter();

  const opps = React.useMemo(() => agrupar(linhas), [linhas]);

  const catalogo = React.useMemo(() => ({
    EQUIPE: responsaveis,
    OPORTUNIDADES: [],
    LEADS: [],
  }), [responsaveis]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "proposta" && id) { router.push(`/propostas/${id}`); return; }
    if (peca === "oportunidade" && id) { router.push(`/pipeline/${id}`); return; }
    abrirPeca(peca, id, { tela: "propostas" });
  }, [router, abrirPeca]);

  /**
   * Enviar, revisar e responder moram na página da Proposta, que é onde a
   * composição existe. Daqui a lista leva até lá em vez de fingir que grava:
   * o envio dispara e-mail ao cliente, e disparar isso a partir de uma linha
   * de tabela, sem ver o que vai junto, é o tipo de clique que ninguém desfaz.
   */
  const persistir = React.useCallback((_antes: any, depois: any, evento: string) => {
    const proposta = depois?.propostas?.[depois.propostas.length - 1];
    toast(`"${evento}" acontece na página da proposta.`, proposta?.id ? {
      action: { label: "Abrir proposta", onClick: () => router.push(`/propostas/${proposta.id}`) },
    } : undefined);
    router.refresh();
  }, [router]);

  return (
    <div data-workspace="desenho">
      <PropostasLigada
        dados={{ opps }}
        catalogo={catalogo}
        abrir={abrir}
        persistir={persistir}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
