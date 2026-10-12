"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Contatos — o adaptador.
 *
 * `ContatosDesenho` é o markup convertido do handoff e `ContatosLiga` a lógica
 * dele, portada. Os dois são GERADOS e não se editam. Este arquivo fica entre
 * eles e o produto: traduz a pessoa do banco para o "lead" que o protótipo
 * consome, troca o que o protótipo inventa pelo dado real e liga cada mutação
 * no command que existe.
 *
 * Onde o protótipo inventava (tudo dentro de `base()` em ContatosLiga):
 *  - e-mail montado do primeiro nome + slug da empresa ("rogerio@acme.com.br");
 *  - telefone montado de um hash do nome ("+55 11 9xxxx-xxxx");
 *  - "contato@<empresa>.com.br" e telefone fictício para TODA empresa;
 *  - 4 pessoas e 4 empresas fixas (Grupo Solaris, Clínica Aurea, Rota Sul,
 *    Nortis) empurradas em toda renderização, e 2 "secundários";
 *  - "Ontem, 15:18" para qualquer registro com 0 ou 1 dia;
 *  - "São Paulo / SP" fixo no painel; "Canal principal: WhatsApp" fixo;
 *  - "Callface AI · <empresa>" + etapa "Nova" como oportunidade;
 *  - a visão "Meus contatos" presa a um usuário que não existe (Camila Reis).
 * Todos saem aqui, por subclasse e por pós-processamento da saída.
 * ───────────────────────────────────────────────────────────────────────── */

import { urlLigarCallface } from "@/lib/callface-ligar";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { LinhaContato, EmpresaSemPessoas, TotaisContatos, PorRelacionamento } from "@/lib/contatos/tela-contatos";
import { formatarTelefone } from "@/lib/telefone";
import { rotaDaEmpresa, rotaDaPessoa, rotaDaPessoaCanonica } from "@/lib/vendas/rota-da-ficha";
import type { Resultado } from "@/lib/vendas/resultado";
import type { VisaoSalva, EntradaCadastro, CadastroCriado } from "@/app/(produto)/contatos/actions";
import { urlAtendimento } from "@/components/onface/vendas/atendimento";
import { ContatosLiga } from "./ContatosLiga";
import { rotaDoDesenho } from "./rota-do-desenho";
import { usePecas } from "./pecas-host";

/* ── Contratos ─────────────────────────────────────────────────────────── */

export interface AcoesContatos {
  criarEmpresa: (e: { nome: string; cnpj?: string | null; website?: string | null; setor?: string | null; cidade?: string | null }) => Promise<Resultado<{ empresaId: string; jaExistia: boolean; resolvidaPor: string | null }>>;
  criarPessoa: (p: { nome: string; sobrenome?: string | null; cargo?: string | null; email?: string | null; telefone?: string | null; empresaId?: string | null }) => Promise<Resultado<{ pessoaId: string; jaExistia: boolean }>>;
  criarLead: (l: { empresa: string; pessoaNome: string; cargo?: string | null; email?: string | null; telefone?: string | null; origem?: string | null; responsavelId?: string | null }) => Promise<Resultado<{ leadId: string }>>;
  cadastrar: (e: EntradaCadastro) => Promise<Resultado<CadastroCriado>>;
  atribuirEmMassa: (leadIds: string[], responsavelId: string | null) => Promise<Resultado<{ total: number }>>;
  salvarVisao: (v: { nome: string; q: string; f: unknown; aba: string; visao: string }) => Promise<Resultado<VisaoSalva>>;
  excluirVisao: (id: string) => Promise<Resultado<null>>;
}

/* ── Domínio → desenho ─────────────────────────────────────────────────── */

const ROTULO_ETAPA_NEGOCIO: Record<string, string> = {
  entrada: "Entrada", diagnostico: "Diagnóstico", proposta: "Proposta", negociacao: "Negociação",
};

function iniciais(nome: string): string {
  return (nome || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "—";
}

function slug(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * "Hoje, 14:30" / "Ontem, 09:10" / "há 12 dias" — o vocabulário do desenho.
 *
 * `agora` vem do SERVIDOR e a hora é formatada em America/Sao_Paulo: com
 * `Date.now()` e o fuso da máquina, servidor e navegador escreveriam textos
 * diferentes e o React reclamaria de hidratação. Sem atividade registrada a
 * linha diz isso, em vez do "Ontem, 15:18" que o protótipo usava para tudo.
 * `ordem` alta joga o registro para o fim da ordenação e para a visão
 * "Sem contato há 7+ dias" — nunca ter sido contatado é exatamente isso.
 */
function ultimaInteracao(iso: string | null, agora: number, criadoEm?: string | null): { t: string; o: number } {
  if (!iso && criadoEm) {
    // Registro cadastrado há pouco e ainda sem interação: aparece como cadastro recente (e ordena por ele),
    // em vez de cair no fim da lista como "Sem interação".
    const c = new Date(criadoEm);
    if (!Number.isNaN(c.getTime()) && agora - c.getTime() < 7 * 86_400_000) {
      const u = ultimaInteracao(c.toISOString(), agora);
      return { t: "Cadastrado " + u.t.replace(/^Hoje/, "hoje").replace(/^Ontem/, "ontem"), o: u.o };
    }
  }
  if (!iso) return { t: "Sem interação", o: 99999 };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { t: "—", o: 99999 };
  const fmt = (x: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(x);
  const dia = (x: Date) => fmt(x, { year: "numeric", month: "2-digit", day: "2-digit" });
  const hora = fmt(d, { hour: "2-digit", minute: "2-digit" });
  if (dia(d) === dia(new Date(agora))) return { t: `Hoje, ${hora}`, o: 0 };
  if (dia(d) === dia(new Date(agora - 86_400_000))) return { t: `Ontem, ${hora}`, o: 1 };
  const dias = Math.max(2, Math.floor((agora - d.getTime()) / 86_400_000));
  return { t: `há ${dias} dias`, o: dias };
}

/**
 * Relacionamento no vocabulário do desenho (Cliente · Lead · Prospect · Contato).
 *
 * Mesma precedência do domínio (Bloco 05 §7, `diretorioEmpresas`): serviço
 * ativo da empresa ganha de negócio aberto, que ganha de lead em andamento.
 * O protótipo derivava do estágio de pré-vendas sozinho; aqui o fato
 * comercial manda. "Prospect" não é derivável do banco hoje — nenhum registro
 * real cai nele, e isso é melhor do que chutar.
 */
const ROTULO_REL: Record<string, string> = { cliente: "Cliente", lead: "Lead", prospect: "Prospect", contato: "Contato" };

function relDaPessoa(c: LinhaContato): string {
  // A regra mora no banco (`tela-contatos.ts`), uma só, para a linha e para a
  // contagem do filtro baterem. Aqui só se traduz o rótulo.
  return ROTULO_REL[c.relacionamento] ?? "Contato";
}

function relDaEmpresa(c: LinhaContato, pessoas: string[]): string {
  switch (c.relEmpresa) {
    case "cliente": return "Cliente";
    case "em_oportunidade": case "em_pre_vendas": return "Lead";
    case "ex_cliente": case "cadastrada": return "Contato";
    default: {
      // Empresa só em texto no lead (sem cadastro): herda a pessoa mais quente.
      const peso: Record<string, number> = { Cliente: 4, Lead: 3, Prospect: 2, Contato: 1 };
      return pessoas.sort((a, b) => (peso[b] ?? 0) - (peso[a] ?? 0))[0] ?? "Contato";
    }
  }
}

/**
 * A pessoa do banco na forma de "lead" que `base()` do protótipo lê.
 *
 * `email` e `tel` já vão com o REAL, ou "—": é o sentinela que o próprio
 * desenho entende (`copia: r.email !== "—"`). `campanha` é a utm_campaign do
 * lead — existe para 1.447 dos 4.066 leads. `acao`/`venceEm` ficam nulos:
 * `next_followup_at` está vazio na base inteira, e o painel cai sozinho em
 * "Nenhuma ação agendada", que é a verdade.
 */
function paraODesenho(c: LinhaContato) {
  return {
    id: c.id,
    pessoa: c.nome,
    empresa: c.empresa ?? "",
    cargo: c.cargo ?? "",
    etapa: c.estagio,
    resp: c.responsavel,
    origem: c.origem ?? "—",
    campanha: c.campanha ?? "",
    dias: 0,
    acao: null,
    venceEm: null,
    tel: formatarTelefone(c.telefone || c.whatsapp) || "—",
    email: c.email || "—",
    // Ancora para a subclasse: tudo que o protótipo não sabe carregar.
    real: c,
  };
}

/* ── A subclasse ───────────────────────────────────────────────────────── */

/**
 * Quatro intervenções, todas fora do arquivo gerado:
 *  1. `base()` — filtra o mock e troca cada campo inventado pelo real;
 *  2. `E.irPara` — o gerado repassa só o href e PERDE os parâmetros, então
 *     "Abrir contato" caía em /contatos sem id. Aqui o terceiro argumento chega;
 *  3. `renderVals()` — corrige o que é montado na saída (painel, visões, totais)
 *     e liga a troca de responsável no command;
 *  4. `diz()` — o gerado chama `this.diz` e não o define: o primeiro toast da
 *     tela derrubava a página com "this.diz is not a function".
 */
class ContatosLigada extends ContatosLiga {
  E = {
    ...(this as any).E,
    irPara: (href: string, _rotulo?: string, params?: Record<string, string>) => (this as any).props.irPara?.(href, params ?? {}),
  };

  constructor(props: any) {
    super(props);
    /* Com ?busca= na URL o servidor já devolveu a lista filtrada; o campo de
       busca precisa nascer com o mesmo texto, no construtor (o SSR não roda
       didMount), ou a tela mostra um recorte com a caixa vazia. */
    if (props.busca) (this as any).state = { ...(this as any).state, q: props.busca };
  }

  diz(texto: string, tom?: string) {
    // "X salvo na base" é dito pela Liga ANTES do servidor responder; quem confirma (ou diz "já existia") é `gravar`.
    if (/^(Contato|Empresa) .* salvo na base$/.test(texto)) return;
    if (tom === "erro") toast.error(texto);
    else if (tom === "aviso") toast.warning(texto);
    else toast.success(texto);
  }

  /* Dado novo do servidor (refresh depois de gravar, ou busca) invalida o
     otimista: as linhas "extras" do modal já voltaram como reais, e o
     responsável trocado na tela já está no banco — ou foi recusado. Manter os
     dois duplicaria a linha ou mentiria sobre o dono. */
  componentDidUpdate(anterior: any) {
    if (anterior.catalogo?.LEADS !== (this as any).props.catalogo?.LEADS) {
      (this as any).setState({ extras: [], respOv: {} });
    }
    /* Cadastro recém-criado: com a lista nova na mão, abre o painel do registro e o destaca. */
    const dados = (this as any).props.catalogo?.LEADS, emps = (this as any).props.empresasSemPessoas;
    if ((anterior.catalogo?.LEADS !== dados || anterior.empresasSemPessoas !== emps) && (this as any).props.pendente?.current) {
      const pd = (this as any).props.pendente.current as { painel: string; expandir: boolean };
      (this as any).props.pendente.current = null;
      (this as any).setState((s: any) => ({
        painel: pd.painel, destaque: pd.painel, aba: "todos", pag: 0,
        abertos: pd.expandir ? { ...s.abertos, [pd.painel]: true } : s.abertos,
      }));
      setTimeout(() => (this as any).setState({ destaque: null }), 6000);
    }
  }

  base() {
    const agora: number = (this as any).props.agora;
    const linhas = super.base().filter((r: any) =>
      r.extra
      || (r.tipo === "pessoa" ? !!r.lead?.real && !r.secundario : (r.leadsEmp || []).some((l: any) => l.real)),
    );

    for (const r of linhas) {
      if (r.extra) continue;
      if (r.tipo === "pessoa") {
        const c: LinhaContato = r.lead.real;
        const u = ultimaInteracao(c.ultimaInteracao, agora, c.criadoEm);
        /* O id do protótipo é "p:" + slug(nome) + "@" + slug(empresa): há 64
           pares de homônimos na mesma empresa no banco, e cada par viraria UMA
           linha (seleção, painel e responsável trocando a pessoa errada). */
        Object.assign(r, {
          id: "p:" + c.id,
          email: c.email || "—",
          tel: formatarTelefone(c.telefone || c.whatsapp) || "—",
          rel: relDaPessoa(c),
          opps: c.negocios.length,
          ultima: u.t, ordem: u.o,
        });
      } else {
        const reais: LinhaContato[] = r.leadsEmp.map((l: any) => l.real).filter(Boolean);
        const c = reais.find((x) => x.empresaId) ?? reais[0];
        const u = reais.map((x) => ultimaInteracao(x.ultimaInteracao, agora, x.criadoEm)).sort((a, b) => a.o - b.o)[0];
        /* `empresas` não tem coluna de e-mail nem de telefone: "—" no lugar
           do "contato@<slug>.com.br" que o desenho escrevia. Segmento vazio
           diz "Sem segmento" — o fallback do desenho afirmava "Serviços" para
           87% da base. */
        Object.assign(r, {
          email: "—", tel: "—",
          sub: c.empresaSetor || "Sem segmento",
          rel: relDaEmpresa(c, reais.map(relDaPessoa)),
          opps: c.empresaId ? c.empresaNegocios.length : reais.reduce((n, x) => n + x.negocios.length, 0),
          ultima: u.t, ordem: u.o,
          real: c,
        });
      }
    }
    /* Empresas cadastradas sem nenhuma pessoa: a lista nasce de pessoas, então elas não existiam na tela. */
    const agoraSp: number = (this as any).props.agora;
    const nomes = new Set(linhas.filter((x: any) => x.tipo === "empresa").map((x: any) => x.nome));
    for (const e of ((this as any).props.empresasSemPessoas ?? []) as EmpresaSemPessoas[]) {
      if (nomes.has(e.nome)) continue;
      const u = ultimaInteracao(null, agoraSp, e.criadoEm);
      const id = "e:" + slug(e.nome);
      linhas.push({
        id, tipo: "empresa", nome: e.nome, sub: e.setor || "Sem segmento", emp: null,
        rel: e.relEmpresa === "cliente" ? "Cliente" : e.relEmpresa === "em_oportunidade" ? "Lead" : "Contato",
        estagio: "", motivo: "", motivoDetalhe: "", resp: null, origem: e.origem || "—", campanha: "",
        opps: e.negocios.length, ultima: u.t, ordem: u.o, lead: null, leadsEmp: [], acao: null,
        email: "—", tel: formatarTelefone(e.telefone) || "—", ini: iniciais(e.nome), empresaIdReal: e.empresaId,
        real: { empresaId: e.empresaId, empresaDominio: e.dominio, empresaNegocios: e.negocios, negocios: [], leadId: null, empresaCidade: e.cidade },
      });
    }
    return linhas;
  }

  /** Visão salva no banco (`visoes_salvas`, por usuário): grava, e só então entra na lista. */
  salvarVisao() {
    const S = (this as any).state, nome = (S.nomeVisao || "").trim();
    if (!nome) return;
    (this as any).setState({ salvando: false, nomeVisao: "" });
    void (this as any).props.salvarVisaoNoServidor({ nome, q: S.q, f: S.f, aba: S.aba, visao: S.visao }).then((r: any) => {
      if (!r.ok) return toast.error(r.erro);
      (this as any).setState((s: any) => ({ salvas: (s.salvas || []).concat(r.dados), salva: r.dados.id }));
      toast.success(`Visão "${nome}" salva`);
      (this as any).props.atualizar?.(); // o servidor passa a conhecer o id: apagar depois chega ao banco
    });
  }

  renderVals() {
    const v: any = super.renderVals();
    const S: any = (this as any).state;
    const props: any = (this as any).props;

    // "Meus contatos" comparava com um nome fixo do mock. Sem o usuário logado
    // nesta tela, o tile marcaria 0 para todo mundo — sai.
    v.visoes = (v.visoes || []).filter((x: any) => x.label !== "Meus contatos");

    /* A lista é uma FATIA: as pessoas com interação mais recente. Dizer o
       tamanho do corte é o que impede "1.200 registros" de parecer a base. */
    const t: TotaisContatos = props.totais;
    const n = (props.catalogo?.LEADS || []).length;
    const fmt = (x: number) => x.toLocaleString("pt-BR");
    v.cardSub = props.busca
      ? `${v.cardSub} · busca "${props.busca}": ${fmt(n)} pessoa(s) encontradas no banco`
      : `${v.cardSub} · mostrando as ${fmt(n)} pessoas com interação mais recente, de ${fmt(t.pessoas)} pessoas e ${fmt(t.empresas)} empresas na base`;

    /* A busca do desenho filtra só o que já está na tela. Com a fatia, um
       contato fora dela "não existiria". Espelhar na URL faz o servidor
       buscar na base inteira. */
    const setQ = v.setQ, limparQ = v.limparQ;
    v.setQ = (e: any) => { setQ?.(e); props.buscar?.(e?.target?.value ?? ""); };
    v.limparQ = (...a: any[]) => { limparQ?.(...a); props.buscar?.(""); };

    if (S.painel) {
      const r = this.base().find((x: any) => x.id === S.painel);
      if (r && !r.extra && v.p) {
        const c: LinhaContato = r.tipo === "pessoa" ? r.lead.real : r.real;
        const dados = v.p.dados || [];
        /* Pessoa não tem cidade no banco; a da empresa vinculada é o mais
           perto de verdade (450 das 3.105 empresas têm). Empresa: o domínio
           real (417 têm), não o "<slug>.com.br" que sairia do e-mail fictício. */
        if (dados[2]) dados[2] = { ...dados[2], valor: (r.tipo === "pessoa" ? c?.empresaCidade : c?.empresaDominio) || "—" };
        // Canal principal: outreach_channel está vazio na base — não há canal a afirmar.
        if (r.tipo === "pessoa" && v.p.resumo?.[2]) v.p.resumo[2] = { ...v.p.resumo[2], valor: "—" };
        const negocios = c ? (r.tipo === "pessoa" ? c.negocios : c.empresaNegocios) : [];
        v.p.opps = negocios.map((o) => ({ titulo: o.titulo || "Oportunidade sem título", etapa: ROTULO_ETAPA_NEGOCIO[o.etapa] ?? o.etapa }));
        v.p.oppTitulo = "Oportunidades · " + negocios.length;
        v.p.semOpps = negocios.length === 0;
        // Contador do resumo: a regra do protótipo (etapa/lead) não é negócio real.
        const iOpp = r.tipo === "pessoa" ? 0 : 1;
        if (v.p.resumo?.[iOpp]) v.p.resumo[iOpp] = { ...v.p.resumo[iOpp], valor: String(negocios.length), label: negocios.length === 1 ? "Oportunidade" : "Oportunidades" };
      }
    }

    /* Trocar responsável: o protótipo só mexia no estado e dizia "ok". O dono
       mora no LEAD, e `acaoAtribuirEmMassa` é o command (um evento por lead).
       O super continua fazendo o otimista; o refresh confirma ou desfaz. */
    const P = S.pop;
    if (P && v.pop && (P.k === "massa" || String(P.k).startsWith("resp:"))) {
      const ids: string[] = P.k === "massa" ? Object.keys(S.marc).filter((k) => S.marc[k]) : [P.k.slice(5)];
      const todos = this.base();
      const leadIds = Array.from(new Set(ids.flatMap((id) => {
        const r: any = todos.find((x: any) => x.id === id);
        if (!r || r.extra) return [];
        if (r.tipo === "pessoa") return r.lead.real.leadId ? [r.lead.real.leadId] : [];
        return (r.leadsEmp || []).map((l: any) => l.real?.leadId).filter(Boolean);
      })));
      v.pop.itens = (v.pop.itens || []).map((it: any) => ({
        ...it,
        onClick: () => { it.onClick?.(); props.atribuir?.(leadIds, it.label === "Sem responsável" ? null : it.label); },
      }));
    }
    return v;
  }
}

/* ── A tela ────────────────────────────────────────────────────────────── */

export function ContatosProto({ linhas, empresasSemPessoas, totais, porRelacionamento, responsaveis, busca, agora, acoes, visoes }: {
  /** Visões salvas deste usuário (`visoes_salvas`). */
  visoes: VisaoSalva[];
  linhas: LinhaContato[];
  empresasSemPessoas: EmpresaSemPessoas[];
  totais: TotaisContatos;
  porRelacionamento: PorRelacionamento;
  responsaveis: Array<{ id: string; nome: string }>;
  busca: string;
  agora: number;
  acoes: AcoesContatos;
}) {
  const router = useRouter();

  /* Os leads vão no CATÁLOGO (`D.LEADS`), não em `dados`: `base()` lê
     `state.leads || D.LEADS`, e o estado é semeado uma vez só. Pelo catálogo a
     tela enxerga cada resposta nova do servidor sem remontar — remontar
     apagaria o texto da busca no meio da digitação.

     `SEGMENTOS` cobre toda empresa carregada; sem ele o painel da pessoa cai
     no `|| "Serviços"` do desenho. `CONVERSAS` vazio: a última interação já
     vem calculada da tabela `atividades`. */
  const catalogo = React.useMemo(() => {
    const segmentos: Record<string, string> = {};
    for (const c of linhas) if (c.empresa) segmentos[c.empresa] = c.empresaSetor || "Sem segmento";
    return {
      LEADS: linhas.map(paraODesenho),
      EQUIPE: responsaveis.map((r) => r.nome),
      SEGMENTOS: segmentos,
      CONVERSAS: [],
      CADENCIAS: [],
      slug,
      iniciais,
    };
  }, [linhas, responsaveis]);

  const porId = React.useMemo(() => new Map(linhas.map((c) => [c.id, c])), [linhas]);
  const idDoResponsavel = React.useCallback(
    (nome: string | null | undefined) => (nome ? responsaveis.find((r) => r.nome === nome)?.id ?? null : null),
    [responsaveis],
  );

  /* ── Navegação ──────────────────────────────────────────────────────── */

  const irPara = React.useCallback((href: string, params: Record<string, string>) => {
    if (href.endsWith("/pessoa")) {
      // Id temporário ("x:…", "l…") é linha otimista: o refresh traz a real.
      const c = params.lead ? porId.get(params.lead) : null;
      // Ficha base: pelo lead quando há; senão a porta resolve (e cria o registro de contato que falta).
      if (c) router.push(c.leadId ? rotaDaPessoa(c.leadId) : rotaDaPessoaCanonica(c.id));
      return;
    }
    if (href.endsWith("/empresa")) {
      if (params.empresa) { router.push(rotaDaEmpresa(params.empresa)); return; }
      const c = params.lead ? porId.get(params.lead) : null;
      if (!c) return;
      if (c.empresaId) router.push(rotaDaEmpresa(c.empresaId));
      else toast.warning(`"${c.empresa}" existe só como texto no lead — ainda não tem cadastro de empresa.`);
      return;
    }
    if (href.endsWith("/atendimento")) {
      const c = params.lead ? porId.get(params.lead) : null;
      const canal = params.canal === "E-mail" ? "email" : "whatsapp";
      const destino = c && urlAtendimento(canal, { leadId: c.leadId, telefone: c.telefone, whatsapp: c.whatsapp, email: c.email });
      if (destino) router.push(destino);
      else toast.warning(canal === "email" ? "Sem e-mail cadastrado (ou sem lead) para este contato." : "Sem telefone cadastrado para este contato.");
      return;
    }
    router.push(rotaDoDesenho(href, params));
  }, [porId, router]);

  /** "Ligar" chega como `/calls?call_to=<dígitos>`: abre o Callface, que é o
   *  canal real da chamada. Sem telefone ("—" vira dígitos vazios), avisa. */
  const abrirExterno = React.useCallback((url: string) => {
    const alvo = urlLigarCallface(url.split("call_to=")[1] || "");
    if (!alvo) { toast.warning("Sem telefone cadastrado para este registro."); return; }
    window.open(alvo, "_blank", "noopener");
  }, []);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    const c = id ? porId.get(id) : null;
    /* O desenho pede "atividade-ver"/"atividade-nova" (vocabulário da PecasLiga);
       com lead real, a peça de atividade abre por cima — como a Liga faria. */
    if (c?.leadId && (peca === "atividade-ver" || peca === "atividade-nova")) {
      if (peca === "atividade-ver") abrirPeca("verAtividade", "l:" + c.leadId, { tela: "contatos", leadId: c.leadId });
      else abrirPeca("novaAtividade", { lead: c.leadId }, { tela: "contatos", leadId: c.leadId });
      return;
    }
    toast(`Atividades são agendadas na ficha do contato.`, c ? {
      action: { label: "Abrir ficha", onClick: () => router.push(c.leadId ? rotaDaPessoa(c.leadId) : rotaDaPessoaCanonica(c.id)) },
    } : undefined);
  }, [porId, router, abrirPeca]);

  /* ── Busca no servidor ──────────────────────────────────────────────── */

  const relogio = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscar = React.useCallback((termo: string) => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => {
      const q = termo.trim();
      router.replace(q ? `/contatos?busca=${encodeURIComponent(q)}` : "/contatos", { scroll: false });
    }, 400);
  }, [router]);

  /* ── Responsável ────────────────────────────────────────────────────── */

  const atribuir = React.useCallback(async (leadIds: string[], nome: string | null) => {
    if (!leadIds.length) {
      toast.warning("Responsável não gravado: estes registros não têm lead, e o dono mora no lead.");
      router.refresh();
      return;
    }
    const r = await acoes.atribuirEmMassa(leadIds, idDoResponsavel(nome));
    if (r.ok) toast.success(`Responsável gravado em ${r.dados?.total ?? leadIds.length} lead(s).`);
    else toast.error(r.erro);
    router.refresh();
  }, [acoes, idDoResponsavel, router]);

  /* ── Gravações do protótipo ─────────────────────────────────────────── */

  /* O protótipo regrava a lista INTEIRA a cada patch (`contatosExtra`,
     `leads`). Só o que ainda não foi enviado vira command; o resto já foi. */
  const enviados = React.useRef(new Set<string>());
  const avisouTags = React.useRef(false);

  /** Aplica tags (por nome) a um lead recém-criado, pela porta única de tags. */
  const aplicarTagsNoLead = async (leadId: string, nomes: string[]) => {
    try {
      const catalogo: Array<{ id: string; nome: string }> = await fetch("/api/labels").then((r) => (r.ok ? r.json() : []));
      const resultados = await Promise.all(nomes.map((n) => {
        const lab = catalogo.find((l) => l.nome === n);
        if (!lab) return false;
        return fetch(`/api/labels/${lab.id}/atribuir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entityType: "lead", entityId: leadId }) }).then((r) => r.ok);
      }));
      return resultados.every(Boolean);
    } catch { return false; }
  };

  /* Cadastro pelo modal: UMA chamada ao servidor; o modal só fecha, e o aviso só sai, depois da resposta. */
  const pendente = React.useRef<{ painel: string; expandir: boolean } | null>(null);
  const cadastrar = React.useCallback(async (e: any): Promise<Resultado<CadastroCriado>> => {
    const { responsavelNome, ...resto } = e;
    const r = await acoes.cadastrar({ ...resto, responsavelId: idDoResponsavel(responsavelNome) });
    if (!r.ok) { toast.error(r.erro); return r; }
    const d = r.dados!;
    const quem = e.nome.trim();
    const ja = e.tipo === "empresa" ? d.empresaJaExistia : d.pessoaJaExistia;
    const aviso = e.destino === "prevendas" ? `${quem} enviado ao Pré-vendas.` : ja ? `${quem} já existia na base; nada foi duplicado.` : `${e.tipo === "pessoa" ? "Contato" : "Empresa"} ${quem} salvo na base.`;
    toast.success(aviso, { action: { label: e.tipo === "empresa" ? "Abrir empresa" : "Abrir contato", onClick: () => router.push(d.rota) } });
    pendente.current = e.tipo === "empresa"
      ? { painel: "e:" + slug(quem), expandir: true }
      : { painel: "p:" + d.pessoaId, expandir: false };
    router.refresh();
    return r;
  }, [acoes, idDoResponsavel, router]);

  const gravar = React.useCallback(async (patch: Record<string, any>) => {
    let refrescar = false;

    if (Array.isArray(patch.contatosExtra)) {
      const novos = patch.contatosExtra.filter((x: any) => x?.id && !enviados.current.has(x.id));
      novos.forEach((x: any) => enviados.current.add(x.id));
      if (novos.length) {
        refrescar = true;
        const empresaPorNome = new Map<string, string>();
        const falhas: string[] = [];
        let ok = 0, jaExistiam = 0;
        const resolverEmpresa = async (nome: string, extra: any = {}) => {
          const k = nome.trim().toLowerCase();
          if (empresaPorNome.has(k)) return empresaPorNome.get(k)!;
          const r = await acoes.criarEmpresa({ nome: nome.trim(), cnpj: extra.cnpj || null, website: extra.site || null, setor: extra.segmento || null, cidade: extra.cidade || null });
          if (!r.ok) { falhas.push(r.erro); return null; }
          empresaPorNome.set(k, r.dados!.empresaId);
          if (r.dados!.jaExistia && extra.tipo === "empresa") jaExistiam += 1; // só a empresa pedida; a da pessoa não conta
          return r.dados!.empresaId;
        };
        // Empresas primeiro: as pessoas do mesmo lote penduram nelas.
        for (const x of novos.filter((x: any) => x.tipo === "empresa")) {
          if (await resolverEmpresa(x.nome, x)) ok += 1;
        }
        for (const x of novos.filter((x: any) => x.tipo === "pessoa")) {
          const empresaId = x.emp ? await resolverEmpresa(x.emp) : null;
          const [nome, ...resto] = String(x.nome || "").trim().split(/\s+/);
          const r = await acoes.criarPessoa({
            nome, sobrenome: resto.join(" ") || null, cargo: x.cargo || null,
            email: x.email || null, telefone: x.tel || null, empresaId,
          });
          if (r.ok) { ok += 1; if (r.dados?.jaExistia) jaExistiam += 1; } else falhas.push(r.erro);
        }
        if (falhas.length) toast.error(`${falhas.length} registro(s) não foram gravados: ${falhas[0]}`);
        else if (jaExistiam) toast.success(jaExistiam === ok ? (ok === 1 ? "Este registro já existia na base; nada foi duplicado." : `Os ${ok} registros já existiam na base; nada foi duplicado.`) : `${ok} registro(s) na base, ${jaExistiam} já existia(m); nada foi duplicado.`);
        else toast.success(`${ok} registro(s) gravados na base.`);
        /* Cadência de prospecção e responsável de contato sem lead não têm
           command aqui. O contato fica na base; dizer o que NÃO aconteceu. */
        if (novos.some((x: any) => x.rel === "Prospect")) toast.warning("Cadência de prospecção ainda não é disparada desta tela: o contato ficou só na base.");
        else if (novos.some((x: any) => x.resp)) toast.warning("Responsável não gravado: contato sem lead não tem dono no domínio.");
      }
    }

    if (Array.isArray(patch.leads)) {
      const novos = patch.leads.filter((l: any) => l?.id && !porId.has(l.id) && !enviados.current.has(l.id));
      novos.forEach((l: any) => enviados.current.add(l.id));
      if (novos.length) {
        refrescar = true;
        let ok = 0; const falhas: string[] = [];
        for (const l of novos) {
          const r = await acoes.criarLead({
            empresa: l.empresa || "", pessoaNome: l.pessoa || "", cargo: l.cargo || null,
            email: l.email || null, telefone: l.tel || null, origem: l.origem || null,
            responsavelId: idDoResponsavel(l.resp),
          });
          if (r.ok) {
            ok += 1;
            // Tag escolhida na importação: grava no catálogo real (`labels`/`entity_labels`), não no store local.
            const nomes: string[] = patch.tagsLead?.[l.id] ?? [];
            if (nomes.length && r.dados?.leadId && !(await aplicarTagsNoLead(r.dados.leadId, nomes))) falhas.push("a tag escolhida não foi aplicada");
          } else falhas.push(r.erro);
        }
        if (falhas.length) toast.error(`${falhas.length} lead(s) com problema: ${falhas[0]}`);
        else toast.success(`${ok} lead(s) criados no Pré-vendas.`, { action: { label: "Abrir Pré-vendas", onClick: () => router.push("/pre-vendas") } });
        if (patch.cadencias) toast.warning("A cadência escolhida não foi vinculada: ainda não há command de cadência nesta tela.");
      }
    }

    // Contato sem lead (importado para a base ou Prospecção) não tem alvo de tag: dizer, em vez de fingir.
    if (patch.tagsLead && Object.keys(patch.tagsLead).some((k) => k.startsWith("x:")) && !avisouTags.current) {
      avisouTags.current = true;
      toast.warning("Tag não gravada: contato sem lead ainda não recebe tag. Marque depois de enviar ao Pré-vendas.");
    }
    /* Visão apagada na lista: some do banco. (Salvar é feito pela subclasse, que já tem o id do servidor.) */
    if (Array.isArray(patch.visoesContatos)) {
      const ficam = new Set((patch.visoesContatos as Array<{ id: string }>).map((v) => v.id));
      for (const v of visoes.filter((x) => !ficam.has(x.id))) {
        const r = await acoes.excluirVisao(v.id);
        if (!r.ok) toast.error(r.erro);
      }
    }

    if (refrescar) router.refresh();
  }, [acoes, idDoResponsavel, porId, router, visoes]);

  return (
    <div data-workspace="desenho">
      <ContatosLigada
        dados={{ visoesContatos: visoes }}
        salvarVisaoNoServidor={acoes.salvarVisao}
        atualizar={() => router.refresh()}
        catalogo={catalogo}
        totais={totais}
        porRelacionamento={porRelacionamento}
        busca={busca}
        agora={agora}
        abrir={abrir}
        abrirExterno={abrirExterno}
        gravar={gravar}
        cadastrar={cadastrar}
        pendente={pendente}
        empresasSemPessoas={empresasSemPessoas}
        buscar={buscar}
        atribuir={atribuir}
        irPara={irPara}
        ir={(href: string) => router.push(href)}
      />
    </div>
  );
}
