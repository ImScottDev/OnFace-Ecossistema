"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Clientes (carteira pós-venda) — o adaptador.
 *
 * `ClientesDesenho` é o markup do handoff e `ClientesLiga` a lógica portada;
 * os dois são GERADOS e não se editam. Aqui a carteira real (montada em
 * lib/clientes/carteira-desenho.ts) entra no lugar do `ClientesSeed` do mock,
 * e o que o protótipo afirma sem ter dado é corrigido na saída.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { CarteiraDoDesenho, ClienteDoDesenho } from "@/lib/clientes/carteira-desenho";
import { ClientesLiga } from "./ClientesLiga";
import { rotaDoDesenho } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";

/**
 * Legendas que o protótipo escreve com uma confiança que o dado não tem.
 *
 * Os valores são montados dentro de `renderVals`, sem gancho; corrigir a saída
 * por RÓTULO (padrão `corrigirInventados` de PessoaProto) é o que resolve sem
 * tocar no gerado. Os números continuam os do protótipo — o que muda é a
 * legenda dizer sobre qual base eles foram calculados.
 */
function corrigirSaida(v: any, c: CarteiraDoDesenho, DC: ClienteDoDesenho | null) {
  const total = c.clientes.length;
  const semInicio = total - c.comInicio;

  /* `inicio` falta em parte da base (nenhuma das quatro fontes tem a data).
     Esses clientes chegam com inicio "" — e "" <= qualquer "YYYY-MM", então o
     `ativoEm` do desenho os conta como ativos em TODO o período. Os números de
     hoje ficam certos (total, MRR, ticket); a curva histórica subestima o
     crescimento. É o default conservador: nunca inventa um mês de entrada,
     e a legenda avisa. */
  const notaInicio = semInicio ? ` · início conhecido em ${c.comInicio} de ${total}` : "";
  const notaContato = ` · entre os ${c.comAtividade} com atividade registrada`;

  for (const k of v.kpi ?? []) {
    /* `diasSem()` devolve 0 para `ultima` vazio: quem NUNCA teve atividade
       conta como "contato recente". Sem a nota o número mente por omissão. */
    if (k.l === "Clientes sem atividade") k.sub += notaContato;
    else k.sub += notaInicio;
  }
  for (const t of v.hero?.kpis ?? []) {
    if (t.l === "Sem contato 30+ dias") t.l = `Sem contato 30+ dias (de ${c.comAtividade})`;
  }
  if (v.evo && semInicio) v.evo.desc += ` · ${semInicio} sem data de início contados no período todo`;
  if (v.cresc && semInicio) v.cresc.rodape2 += ` · ${semInicio} sem data de início`;

  /* Segmentos: o desenho manda setor vazio para "Outros" (173 empresas sem
     setor) E agrupa a cauda depois do 4º lugar também como "Outros" — com o
     dado real saíam DUAS linhas "Outros". Funde numa só, somando. */
  if (Array.isArray(v.segs)) {
    const outros = v.segs.filter((s: any) => s.l === "Outros");
    if (outros.length > 1) {
      const n = outros.reduce((a: number, s: any) => a + parseInt(s.n, 10), 0);
      Object.assign(outros[0], {
        n: n + (n === 1 ? " cliente" : " clientes"),
        pct: Math.round((n / Math.max(1, total)) * 100) + "%",
      });
      v.segs = v.segs.filter((s: any) => s.l !== "Outros" || s === outros[0]);
    }
  }

  for (const l of v.tab?.linhas ?? []) {
    // inicio "" vira "undefined/" no `MESC[am0 - 1]` do desenho.
    if (String(l.desde).startsWith("undefined")) l.desde = "—";
    // clientes.responsavel_id nunca foi populado: coluna mostra "—", não vazio mudo.
    if (!l.resp) l.resp = "—";
    if (!l.ultima) l.ultima = "—";
  }

  if (v.dr?.aberto && DC) {
    const semData = !DC.inicio;
    if (semData) v.dr.desde = "Cliente desde: sem data registrada";
    for (const t of v.dr.tiles ?? []) {
      /* O desenho chama de "Renovação" o aniversário de 12 meses do início.
         Não existe data de renovação de contrato no domínio (cs_renovacoes
         vazio, contratos sem fim de vigência) — o rótulo honesto é aniversário. */
      if (t.l === "Renovação") {
        t.l = "Aniversário";
        if (semData) { t.v = "—"; t.s = "sem data de início"; }
      }
      if (t.l === "Última atividade" && !DC.ultima) t.s = "sem atividade registrada";
    }
    for (const f of v.dr.fatos ?? []) {
      if (f.l === "Cliente desde" && semData) f.v = "—";
      if (f.l === "Customer Success" && !f.v) f.v = "Não atribuído";
    }
  }
  return v;
}

class ClientesLigada extends ClientesLiga {
  _mudo = false;

  constructor(props: any) {
    super(props);
    const E = (this as any).E;
    (this as any).E = {
      ...E,
      /* A Liga passa `irPara(href, label, params)` mas a prop `ir` só recebe o
         href — o id do cliente se perdia e "/clientes/360" abria sem alvo.
         O 360 real é /clientes/<empresaId>. */
      irPara: (href: string, _label?: string, params?: Record<string, string>) => {
        return props.ir(rotaDoDesenho(href, params));
      },
      /* Quem grava sem command recebe o toast honesto do adaptador. O
         protótipo emenda um "N atividades criadas" / "X entrou na carteira"
         logo depois — calado aqui, senão o segundo toast desmente o primeiro. */
      gravar: (patch: any) => {
        this._mudo = true;
        queueMicrotask(() => { this._mudo = false; });
        return props.gravar?.(patch);
      },
      avisar: (texto: string, tom?: string) => { if (!this._mudo) this.diz(texto, tom); },
    };
  }

  // A Liga chama `this.diz` e não o define — sem isto, exportar CSV estourava.
  diz(texto: string, tom?: string) {
    if (tom === "ok") toast.success(texto); else toast(texto);
  }

  /* O chat do NEXO fica desligado: o histórico de conversas (REC) é fixo e
     com carimbo de hora falso, as respostas são template, as ações chamam
     gravar sem command e "Anexar"/"Falar" não têm onClick no gerado. */
  nexo() {
    toast("O NEXO ainda não está ligado nesta tela.");
  }

  renderVals() {
    const v = super.renderVals();
    const p = (this as any).props;
    const s = (this as any).state;
    const DC = s.drawer ? p.carteira.clientes.find((x: ClienteDoDesenho) => x.id === s.drawer) ?? null : null;
    return corrigirSaida(v, p.carteira, DC);
  }
}

export function ClientesProto({ carteira }: { carteira: CarteiraDoDesenho }) {
  const router = useRouter();

  const agenda = React.useMemo(() => carteira.agenda.map((r) => {
    const quando: any = new Date(r.data);
    quando._h = true;
    return {
      key: "p:" + r.id, src: "p", id: r.id, tipo: "Reunião", titulo: r.titulo,
      ini: quando, quando, temHora: true, situacao: "A fazer",
      resp: r.resp, empresa: r.empresa, pessoa: r.pessoa, oppId: r.negocioId,
    };
  }), [carteira]);

  const catalogo = React.useMemo(() => ({
    ClientesSeed: carteira.clientes,
    AtividadesSeed: carteira.atividades,
    /* Agenda e Relacoes NÃO podem faltar: o drawer faz
       `(Agenda ?? []).itens()` e `(Relacoes ?? [])({...})` — o `?? []` devolve
       array, que não tem .itens() nem é função, e o drawer estoura.
       Agenda = reuniões agendadas (forma do `paraItem` do Calendário; `src: "p"`
       faz o clique virar abrir("reuniao")). Vencida sai "Atrasada" pelo diaDe.
       ponytail: o gerado casa por NOME; 5 empresas da carteira se chamam
       "LUMEN EDUCACAO LTDA" (hoje sem relação nem reunião). Se ganharem,
       casar pelo id do drawer aberto. */
    Agenda: { itens: () => agenda },
    Relacoes: ({ empresa }: { empresa: string }) => ({
      itens: carteira.relacoes.filter((r) => r.empresa === empresa).map((r) => ({
        k: r.k, tipo: r.k === "opp" ? "Oportunidade" : "Proposta", titulo: r.titulo, sub: r.sub,
        status: r.status, ir: () => router.push(r.href),
      })),
    }),
    // Só o modal "Novo cliente" usa; ele não grava (ver `gravar`).
    LEADS: [], OPORTUNIDADES: [], SEGMENTOS: {},
  }), [carteira, agenda, router]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, ref?: any) => {
    if (peca === "reuniao" && ref?.id) {
      const r = carteira.agenda.find((x) => x.id === ref.id);
      if (r?.negocioId) { router.push(`/pipeline/${r.negocioId}`); return; }
    }
    abrirPeca(peca, ref, { tela: "clientes" });
  }, [router, carteira, abrirPeca]);

  /* Não há command para criar cliente na carteira nem atividade a partir de
     insight. Avisar e reler, nunca fingir que gravou. */
  const gravar = React.useCallback((patch: Record<string, unknown>) => {
    if ("clientesExtra" in patch) {
      toast("Cliente novo entra na carteira pelo ganho da oportunidade e pela Entrega — não por aqui.");
    } else {
      toast("Criar atividades a partir do insight ainda não grava.", {
        action: { label: "Abrir Tarefas", onClick: () => router.push("/tarefas") },
      });
    }
    router.refresh();
  }, [router]);

  return (
    <div data-workspace="desenho">
      <ClientesLigada
        dados={{ atividadesV2: carteira.atividades }}
        catalogo={catalogo}
        carteira={carteira}
        abrir={abrir}
        gravar={gravar}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
