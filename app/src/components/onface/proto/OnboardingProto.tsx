"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Onboarding (/pos-vendas) — o adaptador.
 *
 * `OnboardingDesenho` é o markup e `OnboardingLiga` a lógica do handoff, os
 * dois GERADOS. Diferente das outras telas, o Liga não lê uma lista: lê um
 * STORE com API (`PR.lista()`, `PR.calc()`, `PR.garantir()`...). Este arquivo
 * monta esse store sobre o dado real de `painelOnboarding` e corrige, na saída
 * de `renderVals`, o que o desenho montaria errado sem prazo e sem command.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { PainelOnboarding, ProjetoOnboarding } from "@/lib/pos-venda/painel-onboarding";
import { OnboardingLiga } from "./OnboardingLiga";
import { levarParametros } from "./rota-do-desenho";

type Resultado = { ok: true; msg?: string } | { ok: false; erro: string };

export interface AcoesOnboarding {
  concluirItem: (itemId: string) => Promise<Resultado>;
  handoff: (fulfillmentId: string, implantadorId: string | null) => Promise<Resultado>;
  concluirOnboarding: (fulfillmentId: string) => Promise<Resultado>;
}

const SEM_COMMAND_BLOQUEIO =
  "Bloqueio é por tarefa no checklist, não por projeto. Marque a tarefa bloqueada no projeto completo.";

/**
 * As correções que só cabem na SAÍDA de `renderVals` — o valor nasce lá dentro,
 * sem gancho, e o arquivo gerado não se edita (mesmo padrão de
 * `corrigirInventados` em PessoaProto.tsx).
 */
class OnboardingLigado extends OnboardingLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
    /* Recorte vindo da URL (?aba=imp&familia=PABX): é o que os endereços
       antigos de Implantação (/clientes/implantacao/pabx…) carregam ao virar
       redirect para cá. O protótipo não lia a URL; o estado inicial é a porta. */
    const self = this as any;
    const ABAS = ["todos", "onb", "imp"];
    if (ABAS.includes(props.abaInicial)) self.state = { ...self.state, tab: props.abaInicial };
    if (props.familiaInicial) self.state = { ...self.state, fam: props.familiaInicial };
  }

  /* A tela remonta a cada resposta do servidor (ver `geracao`). Sem lembrar
     o drawer aberto, concluir uma tarefa fecharia o painel na cara do usuário. */
  componentDidUpdate() {
    (this as any).props.lembrarDrawer?.((this as any).state.drawer);
  }

  renderVals() {
    const vals: any = super.renderVals();
    const props: any = (this as any).props;
    const S: any = (this as any).state;
    const projetos: ProjetoOnboarding[] = props.projetos ?? [];
    const porId = (id: string | null) => projetos.find((p) => p.id === id);

    /* 1. Prazo. Nenhum projeto tem prazo no banco, e o desenho imprimiria
          "prazo NaN/NaN" em todo cartão e "Prazo NaN/NaN · 9999d" no drawer. */
    for (const w of vals.ws ?? []) for (const l of w.linhas ?? []) l.prazo = "sem prazo definido";
    if (vals.dr?.aberto) { vals.dr.prazo = "Sem prazo definido"; vals.dr.prazoCor = "var(--tx3)"; }

    /* 2. Headline do NEXO. Sem prazo, "Entrega em dia" é uma afirmação que o
          banco não sustenta. Diz o que é verificável. */
    const ativos = projetos.length;
    const naoIniciados = projetos.filter((p) => p.c.feitas === 0).length;
    const prontos = projetos.filter((p) => p.c.pronto).length;
    if (vals.nx && !/risco de atraso/.test(vals.nx.headline)) {
      vals.nx.headline = ativos
        ? `${ativos} ${ativos > 1 ? "projetos ativos" : "projeto ativo"}` +
          (naoIniciados ? `, ${naoIniciados} sem nenhuma tarefa concluída` : "") +
          (prontos ? `, ${prontos} pronto${prontos > 1 ? "s" : ""} para handoff` : "") +
          ". Nenhum tem prazo definido."
        : "Nenhum projeto de entrega ativo.";
      // "Criar N tarefas" do NEXO não tem command: sumir com o botão.
      vals.nx.temAplicar = false;
    }

    /* 3. "Novo onboarding": o projeto nasce do ganho no Pipeline
          (criarFulfillmentsParaServicos), não há criação manual no domínio. */
    vals.acoes.novo = () => props.avisar("Projeto de entrega nasce do ganho no Pipeline.", "/pipeline", "Abrir Pipeline");

    /* 4. Destinos reais no lugar das rotas do namespace do protótipo. */
    vals.ir.agenda = () => props.ir("/calendario");

    if (vals.dr?.aberto) {
      const p = porId(S.drawer)!;
      const dr = vals.dr;
      dr.completo = () => props.ir(`/projetos/${p.id}`);
      dr.verAtv = () => props.ir(`/projetos/${p.id}`);
      dr.links = [
        p.empresaId ? { l: "Cliente 360", onClick: () => props.ir(`/clientes/${p.empresaId}`) } : null,
        p.empresaId ? { l: "Empresa", onClick: () => props.ir(`/empresas/${p.empresaId}`) } : null,
        p.oppId ? { l: "Oportunidade", onClick: () => props.ir(`/pipeline/${p.oppId}`) } : null,
      ].filter(Boolean);

      /* Concluir tarefa: o Liga marcava no store e já dizia "concluída". Aqui
         só diz depois que o command confirma. `abertas` é `c.abertas.slice(0,4)`
         na mesma ordem, então o índice casa. */
      (dr.abertas ?? []).forEach((a: any, i: number) => {
        const k = p.c.abertas[i];
        a.concluir = () => props.concluirItem(k.id);
        a.abrir = () => props.ir(`/projetos/${p.id}`);
      });

      dr.liberar = () => props.avisar(SEM_COMMAND_BLOQUEIO, `/projetos/${p.id}`, "Abrir projeto");
      dr.aguardar = () => props.avisar(SEM_COMMAND_BLOQUEIO, `/projetos/${p.id}`, "Abrir projeto");

      /* Contato. O Liga discava o NOME ("call_to=Victor"). Ligar usa o
         telefone do lead; e-mail abre o endereço real. Sem o dado, o botão sai. */
      const pessoa = dr.pessoas?.[0];
      if (pessoa) {
        pessoa.acoes = (pessoa.acoes ?? []).flatMap((ac: any) => {
          if (ac.t === "Ligar") {
            return p.telefone ? [{ ...ac, onClick: () => props.abrirExterno(
              "https://app.callface.ai/calls?call_to=" + encodeURIComponent(p.telefone!.replace(/[^\d+]/g, ""))) }] : [];
          }
          if (ac.t === "E-mail") return p.email ? [{ ...ac, onClick: () => props.abrirExterno("mailto:" + p.email) }] : [];
          if (ac.t === "WhatsApp") return p.telefone ? [{ ...ac, onClick: () => props.ir("/atendimento") }] : [];
          return [ac];
        });
        if (!p.pessoa) pessoa.cargo = "Sem contato vinculado";
      }
    }

    /* 5. Modal de handoff / envio para CS. O Liga gravava no store e dizia
          "primeira reunião agendada" — o command de handoff NÃO agenda reunião
          (só aceita implantadorId). Decisão conservadora: dizer a verdade no
          "o que acontece" e não inventar agendamento. */
    if (vals.mh?.aberto) {
      const p = porId(S.modal?.id)!;
      const mh = vals.mh;
      if (mh.ehImp) {
        mh.efeitos = [
          "Cria o projeto de implantação do mesmo serviço",
          "Fecha este onboarding e preserva o histórico",
          "Registra o handoff (HandoffToImplementation)",
          "A primeira reunião NÃO é agendada por esta tela — agende no Calendário",
        ];
        mh.gate = p.c.gate.map((g: any) => ({ n: g.n + (g.ok ? "" : " — pendente") }));
        mh.confirmar = () => {
          const nome = S.modal?.resp;
          if (!nome) { (this as any).setState((s: any) => ({ modal: { ...s.modal, erro: "Defina o responsável da implantação." } })); return; }
          const u = (props.equipe ?? []).find((x: any) => x.nome === nome);
          props.executar(() => props.handoff(p.id, u?.id ?? null), "Handoff feito · implantação criada", () => (this as any).setState({ modal: null, drawer: null }));
        };
      } else {
        mh.gate = [{ n: "Todas as tarefas do onboarding concluídas" }];
        mh.confirmar = () => props.executar(() => props.concluirOnboarding(p.id), `${p.empresa} enviado para Customer Success`, () => (this as any).setState({ modal: null, drawer: null }));
      }
    }

    /* 6. Agenda de hoje: a reunião abre no Calendário. */
    for (const it of vals.hoje?.itens ?? []) it.onClick = () => props.ir("/calendario");

    return vals;
  }
}

export function OnboardingProto({ dados, acoes, projetoInicial, abaInicial, familiaInicial }: {
  dados: PainelOnboarding;
  acoes: AcoesOnboarding;
  projetoInicial?: string | null;
  abaInicial?: string | null;
  familiaInicial?: string | null;
}) {
  const router = useRouter();

  const [geracao, setGeracao] = React.useState(0);
  const primeira = React.useRef(true);
  React.useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    setGeracao((n) => n + 1);
  }, [dados]);

  const drawerAberto = React.useRef<string | null>(projetoInicial ?? null);
  const drawerInicial = drawerAberto.current && dados.projetos.some((p) => p.id === drawerAberto.current)
    ? drawerAberto.current : null;

  const avisar = React.useCallback((msg: string, href?: string, rotulo?: string) => {
    toast(msg, href && rotulo ? { action: { label: rotulo, onClick: () => router.push(href) } } : undefined);
    router.refresh();
  }, [router]);

  const executar = React.useCallback(async (fn: () => Promise<Resultado>, okMsg: string, depois?: () => void) => {
    const r = await fn();
    if (r.ok) { toast.success(r.msg ?? okMsg); depois?.(); } else toast.error(r.erro);
    router.refresh();
  }, [router]);

  /**
   * O store `Projetos` que o Liga espera, sobre o dado real.
   *
   * - `calc` devolve o `c` pré-calculado no servidor (gate REAL de handoff).
   * - `atv` só alimenta a "Agenda de hoje": reuniões de hoje dos projetos.
   *   O checklist não tem data, então não entra ali.
   * - `EQUIPE_IMP` começa com "" de propósito: o protótipo pré-selecionava o
   *   primeiro nome da lista como implantador, e confirmar sem olhar entregaria
   *   o projeto a alguém aleatório. Vazio força a escolha.
   * - `jornada` vazia: só o modal "novo" a usa, e ele não abre (sem command).
   * - Mutadores do store não são mais chamados (o adaptador troca os handlers
   *   na saída de renderVals); se algum escapar, avisa em vez de fingir.
   */
  const catalogo = React.useMemo(() => {
    const nomes = dados.equipe.map((u) => u.nome);
    const naoGrava = () => avisar("Esta ação ainda não grava por esta tela.");
    return {
      Projetos: {
        FAM: { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Sem família" },
        EQUIPE_ONB: nomes,
        EQUIPE_IMP: ["", ...nomes],
        garantir() {},
        lista: () => dados.projetos,
        atv: () => dados.hoje,
        calc: (p: ProjetoOnboarding) => p.c,
        deIso: (s: string) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); },
        jornada: () => [],
        criar: naoGrava, handoff: naoGrava, concluirCS: naoGrava, bloquear: naoGrava, setTarefa: naoGrava, evento: () => {},
      },
      ClientesSeed: [],
      OPORTUNIDADES: [],
      iniciais: (n: string) => (n || "").replace(/[·\-]/g, " ").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase(),
    };
  }, [dados, avisar]);

  const concluirItem = React.useCallback(
    (id: string) => executar(() => acoes.concluirItem(id), "Tarefa concluída"),
    [acoes, executar],
  );

  return (
    <div data-workspace="desenho">
      <OnboardingLigado
        key={geracao}
        /* `drawer` nasce null no Liga; o construtor copia de `dados` toda chave
           nula. É assim que ?projeto= abre o drawer já no SSR, sem window. */
        dados={{ drawer: drawerInicial }}
        abaInicial={abaInicial}
        familiaInicial={familiaInicial}
        lembrarDrawer={(id: string | null) => { drawerAberto.current = id; }}
        catalogo={catalogo}
        projetos={dados.projetos}
        equipe={dados.equipe}
        concluirItem={concluirItem}
        handoff={acoes.handoff}
        concluirOnboarding={acoes.concluirOnboarding}
        executar={executar}
        avisar={avisar}
        abrir={() => router.push("/calendario")}
        abrirExterno={(url: string) => window.open(url, "_blank", "noopener")}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
