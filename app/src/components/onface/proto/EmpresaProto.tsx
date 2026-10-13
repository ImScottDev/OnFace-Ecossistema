"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Ficha da Empresa — o adaptador.
 *
 * Como a ficha da Pessoa, a tela do handoff é centrada em LEAD: é dele que
 * vêm contato, origem e etapa. O que muda aqui é o ponto de entrada — a rota
 * recebe o id da EMPRESA — então o adaptador resolve o lead principal dela.
 *
 * Com `registro` preenchido, o desenho usa o ramo que lê o dado recebido; sem
 * ele, cairia num ramo de demonstração com "Ricardo Alves" e telefones fixos.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { autorDoEvento } from "./avatar-do-proto";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatarTelefone } from "@/lib/telefone";

import { ROTULO_ETAPA_PRE_VENDAS } from "@/lib/vendas/dominio";
import type { DetalheLead, Empresa360 } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { EmpresaLiga } from "./EmpresaLiga";
import { levarParametros } from "./rota-do-desenho";
import { aquisicaoDaFicha, corrigirVazio, montarRelacoes, paraALiga } from "./relacoes-da-ficha";
import { registroDoDesenho, linkDoAnuncio } from "./registro-do-desenho";
import { qualDoDesenho } from "./qual-do-desenho";
import { usePecas } from "./pecas-host";
import { acaoAtribuir, acaoRemoverDaCadencia, acaoResponsaveis, acaoSalvarQualificacao, acaoTagDoLead } from "@/app/(produto)/pre-vendas/actions";
import {
  acaoAdicionarPessoaNaEmpresa, acaoExcluirEmpresa, acaoPausarCadenciaDoLead, acaoSalvarDadosDaEmpresa,
} from "@/app/(produto)/contatos/actions";
import type { ArquivoDaEmpresa, CadenciaDoLead, EnriquecimentoDaEmpresa } from "@/lib/vendas/ficha-extras";

/* Timeline real (LinhaDoTempo) no formato que a EmpresaLiga lê em `X.eventos`:
   {titulo, autor, quando, d, vinc}. Um ícone neutro pra todos — sem inventar
   um ícone por tipo que não existe no domínio. `titulo` pronto vence o rótulo
   do tipo; data real formatada (nunca "20 set" fixo). */
const ICONE_EVENTO = "M12 8v4l3 3M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z";
const ROTULO_EVENTO: Record<string, string> = {
  call: "Ligação", ligacao: "Ligação", email: "E-mail", mail: "E-mail",
  meeting: "Reunião", reuniao: "Reunião", task: "Tarefa", tarefa: "Tarefa",
  note: "Nota", nota: "Nota", whatsapp: "WhatsApp",
};
function quandoDoEvento(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(d) - dia(new Date())) / 86_400_000);
  if (dias === 0) return `Hoje, ${hora}`;
  if (dias === -1) return `Ontem, ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hora}`;
}
function eventosDoDesenho(timeline: LinhaDoTempo[], vinc: string) {
  return timeline.map((e) => ({
    titulo: e.titulo || ROTULO_EVENTO[String(e.tipo).toLowerCase()] || String(e.tipo),
    autor: autorDoEvento(e),
    quando: quandoDoEvento(e.ocorridoEm),
    d: ICONE_EVENTO,
    vinc,
  }));
}

class EmpresaLigada extends EmpresaLiga {
  constructor(props: any) {
    super(props);
    // Sem isto o `irPara` da Liga perde o id do registro e cai em rota do protótipo (404).
    levarParametros(this as any);
  }

  renderVals() {
    const vals = super.renderVals();
    const P = (this as any).props;
    /* "Passo 2 de 5" e a barra 2/5 eram do protótipo, para qualquer cadência.
       O motor não guarda a posição numérica do passo: não afirmar um. */
    if (vals.temCad) {
      vals.cadPasso = P.cadPausada ? "Pausada" : "Em andamento";
      vals.cadPassos = (vals.cadPassos ?? []).map(() => ({ style: "flex:1;height:3px;border-radius:2px;background:var(--of-linha)" }));
    }
    /* Arquivos: o envio e a remoção do desenho só mexiam na sessão da tela. */
    vals.enviarArquivo = (e: any) => {
      const lista: File[] = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (lista.length) void P.enviarArquivos?.(lista);
    };
    const reais: ArquivoDaEmpresa[] = P.arquivosReais ?? [];
    vals.arquivos = (vals.arquivos ?? []).map((a: any, i: number) => ({
      ...a, remover: () => { if (reais[i]) void P.removerArquivo?.(reais[i]); },
    }));
    /* Excluir empresa: só avisa e sai depois que o servidor apagar. */
    if (vals.exc?.aberto) {
      const S = (this as any).state;
      const original = vals.exc.confirmar;
      vals.exc.confirmar = async () => {
        if (!S.excMotivo || (S.excMotivo === "Outro" && !String(S.excObs ?? "").trim())) return original();
        const ok = await P.excluirEmpresa?.(S.excAlvo === "tudo", S.excMotivo, String(S.excObs ?? "").trim());
        if (ok) (this as any).setState({ excluir: false });
      };
    }
    corrigirVazio(vals.relAtivas, P.relacoes, !!(this as any).state?.hidratado);
    return vals;
  }

  /* `E.avisar` chama `this.diz`, que a Liga gerada não define: todo aviso desta
     ficha (inclusive o erro do Apollo) morria em TypeError e nada aparecia. */
  diz(texto: string, tom?: string) {
    if (tom === "erro") toast.error(texto);
    else if (tom === "aviso") toast.warning(texto);
    else toast.success(texto);
  }
}

export function EmpresaProto({ empresa, lead, timeline, arquivos, enriquecimento, cadencia, labels, tagsDaEmpresa }: {
  /** Catálogo real de tags da organização e as que já estão nesta empresa. */
  labels: Array<{ id: string; nome: string }>;
  tagsDaEmpresa: string[];
  empresa: Empresa360;
  /** Arquivos enviados para a empresa (acervo canônico). */
  arquivos: ArquivoDaEmpresa[];
  /** Funcionários, faturamento, LinkedIn e tecnologias gravados na empresa. */
  enriquecimento: EnriquecimentoDaEmpresa;
  /** A cadência viva do lead principal, quando há. */
  cadencia: CadenciaDoLead | null;
  /** O lead principal da empresa, quando existe: é dele que vem o contato. */
  lead: DetalheLead | null;
  timeline: LinhaDoTempo[];
}) {
  const router = useRouter();

  /**
   * O registro que a ficha lê.
   *
   * Sem lead, a empresa existe na base sem conversa nenhuma — e é isso que a
   * tela deve mostrar. O registro vai com os campos da empresa e o contato
   * vazio, em vez de um contato de exemplo.
   */
  const registro = React.useMemo(() => {
    const base = lead ? registroDoDesenho(lead) : null;
    return {
      /* Data real de criação do lead: a ficha mostrava "Hoje"/data fixa. */
      criadoEm: lead?.criadoEm ?? null,
      ...(base ?? {
        id: empresa.id, registro: empresa.id, pessoa: "Sem contato", cargo: "",
        email: null, tel: null, whatsapp: null, linkedin: null, tags: [],
        etapa: "novo", rel: "Contato", resp: null, origem: null, campanha: null,
        interesse: null, acao: null, venceEm: null, dias: 0,
      }),
      // A empresa canônica vence o que o lead guardava: é o cadastro.
      empresa: empresa.nome,
      empresaId: empresa.id,
      cnpj: empresa.cnpj,
      cidade: [empresa.cidade, empresa.estado].filter(Boolean).join(" / ") || null,
      segmento: empresa.setor,
      site: empresa.website,
      /* Domínio real da empresa: o modal Enriquecer mostrava "<nome>.com.br" inventado. */
      dominio: empresa.dominio || empresa.website || null,
      /* E12: o que a produção mostrava e a empresa perdeu. O score é o maior
         entre os leads da empresa, não o do lead principal. */
      empresaTel: formatarTelefone(empresa.telefone) || null,
      empresaObs: empresa.observacoes,
      leadScore: empresa.leadScore ?? 0,
      /* Respostas do formulário de cada lead da empresa, com o anúncio de origem. */
      formularios: empresa.formularios.map((f) => ({
        id: f.leadId, titulo: [f.nome, f.criadoEm.slice(0, 10).split("-").reverse().join("/")].filter(Boolean).join(" · "),
        adHref: linkDoAnuncio(f.metaAdId), linhas: f.respostas,
      })),
    };
  }, [empresa, lead]);

  /* A equipe REAL: o menu de responsável só oferecia o responsável atual. */
  const [equipe, setEquipe] = React.useState<Array<{ id: string; nome: string }>>([]);
  React.useEffect(() => { void acaoResponsaveis().then(setEquipe).catch(() => undefined); }, []);

  const relacoes = React.useMemo(() => montarRelacoes({
    empresaId: empresa.id,
    /* A etapa vem do empresa360 (a gravada na aquisição, como o board): cada lead
       da empresa tem a própria, e a nutrição traz motivo e data de entrada. */
    aquisicoes: empresa.leads.map((a) => aquisicaoDaFicha({
      id: a.id, etapa: a.etapa, etapaRotulo: a.etapaRotulo, origem: a.origem, criadoEm: a.criadoEm,
      responsavel: a.responsavel, pessoa: a.pessoa, nutricao: a.nutricao, encerrada: a.encerrada,
    })),
    oportunidades: empresa.oportunidades,
    propostas: empresa.propostas,
    conta: {
      nome: empresa.nome, ativo: empresa.relacionamento === "cliente",
      jaTeveServico: empresa.servicos.length > 0, ficha: empresa.fichaDeCliente,
      detalheAtivo: `${empresa.servicos.filter((s) => s.ativo).length || 1} serviço(s) ativo(s) na carteira`,
    },
    vazioPrefixo: `Nenhuma aquisição ativa, oportunidade, proposta ou serviço registrado para ${empresa.nome}. Por enquanto ela só existe na base.`,
  }), [empresa]);

  const catalogo = React.useMemo(() => ({
    EQUIPE: equipe.length ? equipe.map((e) => e.nome) : (registro.resp ? [registro.resp] : []),
    /* `ETAPAS` é o que dá o chip de etapa no cabeçalho — sem ele a ficha
       mostrava "—" no lugar de "Em contato". */
    ETAPAS: Object.fromEntries(
      Object.entries(ROTULO_ETAPA_PRE_VENDAS).map(([k, label]) => [k, { label }]),
    ),
    LEADS: [], CONVERSAS: [], CADENCIAS: [], SEGMENTOS: [],
    /* Mesmo card "Relações em andamento" da ficha da Pessoa, mesma regra
       (`relacoes-da-ficha.ts`): aquisição, oportunidade, proposta e Cliente
       ativo x acesso ao 360, lidos do empresa360. */
    Relacoes: () => paraALiga(relacoes, (rota) => router.push(rota)),
  }), [registro.resp, relacoes, router, equipe]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "pessoa" && id) { router.push(`/pessoas/${id}`); return; }
    if (peca === "oportunidade" && id) { router.push(`/pipeline/${id}`); return; }
    /* Sem lead, o registro da ficha leva o id da EMPRESA — não é lead para a peça abrir. */
    const idDaPeca = !lead && id === empresa.id ? null : id;
    abrirPeca(peca, idDaPeca, { tela: "empresa", empresaId: empresa.id, empresa: empresa.nome, leadId: lead?.id ?? null });
  }, [router, abrirPeca, empresa.id, empresa.nome, lead?.id]);

  const enviarArquivos = React.useCallback(async (lista: File[]) => {
    let ok = 0;
    for (const f of lista) {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/empresas/${empresa.id}/arquivos`, { method: "POST", body: fd }).catch(() => null);
      if (r?.ok) ok++;
      else toast.error(`${f.name}: ${(await r?.json().catch(() => null))?.error ?? "não consegui enviar."}`);
    }
    if (ok) { toast.success(ok > 1 ? `${ok} arquivos enviados` : "Arquivo enviado"); router.refresh(); }
  }, [empresa.id, router]);

  const removerArquivo = React.useCallback(async (a: ArquivoDaEmpresa) => {
    const r = await fetch(`/api/empresas/${empresa.id}/arquivos/${a.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) return toast.error("Não consegui remover o arquivo.");
    toast.success(`${a.nome} removido`);
    router.refresh();
  }, [empresa.id, router]);

  const excluirEmpresa = React.useCallback(async (comLead: boolean, motivo: string, obs: string) => {
    const r = await acaoExcluirEmpresa(empresa.id, comLead, motivo, obs);
    if (!r.ok) { toast.error(r.erro); return false; }
    toast.success(`${empresa.nome} excluída`);
    router.push("/contatos");
    router.refresh();
    return true;
  }, [empresa.id, empresa.nome, router]);

  /* Cada edição da ficha vira o command que existe. A ficha guardava num store
     local e o aviso "não está ligado" aparecia ao salvar: nada ia ao banco. */
  const persistir = React.useCallback(async (patch: Record<string, any>) => {
    const falha = (t?: string) => toast.error(t ?? "Não consegui salvar.");
    const v = (x: unknown) => { const t = String(x ?? "").trim(); return t === "—" ? "" : t; };

    if (patch.empresa) {
      const p = patch.empresa as Record<string, any>;
      const campos: Record<string, string> = {};
      if ("cnpj" in p) campos.cnpj = v(p.cnpj);
      if ("site" in p) campos.website = v(p.site);
      if ("segmento" in p) campos.setor = v(p.segmento);
      if ("telefone" in p) campos.telefone = v(p.telefone);
      if ("funcionarios" in p) campos.funcionarios = v(p.funcionarios);
      if ("faturamento" in p) campos.faturamento = v(p.faturamento);
      if ("linkedin" in p) campos.linkedin = v(p.linkedin);
      if ("tecnologias" in p) campos.tecnologias = v(p.tecnologias);
      if ("cidade" in p) {
        const [cidade, estado] = v(p.cidade).split("/").map((x) => x.trim());
        campos.cidade = cidade ?? ""; campos.estado = estado ?? "";
      }
      if (Object.keys(campos).length) {
        const r = await acaoSalvarDadosDaEmpresa(empresa.id, campos);
        if (!r.ok) return falha(r.erro);
        router.refresh();
      }
      if (Array.isArray(p.notas) && p.notas[0]?.texto) {
        const r = await fetch("/api/notas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresaId: empresa.id, conteudo: p.notas[0].texto }),
        });
        if (!r.ok) return falha("Não consegui salvar a nota.");
        router.refresh();
      }
      /* Pessoa nova na aba Pessoas: o desenho entrega a lista inteira, a nova é a que o servidor não tem. */
      if (Array.isArray(p.pessoas)) {
        const tem = new Set([registro.pessoa, ...empresa.pessoas.map((x) => x.nome)]);
        for (const n of (p.pessoas as Array<{ nome: string; cargo?: string; tel?: string; email?: string }>).filter((x) => !tem.has(x.nome))) {
          const r = await acaoAdicionarPessoaNaEmpresa(empresa.id, { nome: n.nome, cargo: n.cargo, email: n.email, telefone: n.tel === "—" ? "" : n.tel });
          if (!r.ok) return falha(r.erro);
          toast.success(r.dados?.jaExistia ? `${n.nome} já existia na base e foi vinculada à empresa.` : `${n.nome} vinculada à empresa.`);
        }
        router.refresh();
      }
      /* Anexo de nota: sobe para o acervo da empresa (a nota guarda o texto; o arquivo mora em Arquivos). */
      if (Array.isArray(p.arquivos)) {
        const deNota = (p.arquivos as Array<{ nome: string; tipo?: string; src?: string; quando?: string }>)
          .filter((a) => /nota/.test(a.quando ?? "") && a.src?.startsWith("data:"));
        if (deNota.length) {
          const arquivos = await Promise.all(deNota.map(async (a) => new File([await (await fetch(a.src!)).blob()], a.nome, { type: a.tipo })));
          await enviarArquivos(arquivos);
        }
      }
      if ("pausada" in p) {
        if (!lead) return falha("Esta empresa não tem contato em cadência.");
        const r = await acaoPausarCadenciaDoLead(lead.id, !!p.pausada);
        if (!r.ok) return falha(r.erro);
        router.refresh();
      }
      const sem = ["conjunto", "criativo"].filter((k) => k in p);
      if (sem.length) toast.warning("Conjunto e criativo vêm do anúncio de origem e não se editam aqui.");
    }

    if (patch.qual && lead) {
      const q = patch.qual as Record<string, any>;
      const n = parseInt(String(q.tamanho ?? "").replace(/\D/g, ""), 10);
      const r = await acaoSalvarQualificacao(lead.id, {
        servicosInteresse: typeof q.interesse === "string" && q.interesse ? q.interesse.split("|").filter(Boolean) : undefined,
        dor: q.dor || undefined,
        quantidade: Number.isNaN(n) ? undefined : n,
        observacoes: typeof q.fit === "string" && q.fit ? `Fit ${q.fit}` : undefined,
      } as never);
      if (!r.ok) return falha(r.erro);
      router.refresh();
    }

    /* Tag da própria empresa (a do lead continua pela peça de tags do lead). */
    const tagDaEmpresa = async (nome: string, tirar: boolean) => {
      let lab = labels.find((l) => l.nome === nome);
      if (!lab && !tirar) {
        const c = await fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome }) });
        if (!c.ok) return false;
        lab = await c.json();
      }
      if (!lab) return false;
      const r = await fetch(`/api/labels/${lab.id}/atribuir`, {
        method: tirar ? "DELETE" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "empresa", entityId: empresa.id }),
      });
      return r.ok;
    };
    if (patch.empresa && Array.isArray(patch.empresa.tags)) {
      const novas = (patch.empresa.tags as string[]).filter((t) => !tagsDaEmpresa.includes(t) && !((registro.tags as string[] | undefined) ?? []).includes(t));
      const tiradas = tagsDaEmpresa.filter((t) => !(patch.empresa.tags as string[]).includes(t));
      const ok = await Promise.all([...novas.map((t) => tagDaEmpresa(t, false)), ...tiradas.map((t) => tagDaEmpresa(t, true))]);
      if (ok.some((x) => !x)) return falha("Não consegui gravar a tag.");
      router.refresh();
    }
    if (patch.tagRemover) {
      if (lead && ((registro.tags as string[] | undefined) ?? []).includes(patch.tagRemover)) {
        const r = await acaoTagDoLead(lead.id, patch.tagRemover, "remover");
        if (!r.ok) return falha(r.erro);
      } else if (!(await tagDaEmpresa(patch.tagRemover, true))) return falha("Não consegui remover a tag.");
      router.refresh();
    }

    if (patch.lead?.resp && lead) {
      const id = equipe.find((e) => e.nome === patch.lead.resp)?.id ?? null;
      if (!id) return falha(`Não encontrei "${patch.lead.resp}" na equipe.`);
      const r = await acaoAtribuir(lead.id, id);
      if (!r.ok) return falha(r.erro);
      router.refresh();
    }
    if (patch.lead && ("etapa" in patch.lead || "origem" in patch.lead || "campanha" in patch.lead)) {
      toast.warning("Etapa e origem mudam em Pré-vendas e Pipeline; esta edição não foi aplicada.");
    }
  }, [empresa.id, empresa.pessoas, registro.pessoa, registro.tags, lead, equipe, router, enviarArquivos, labels, tagsDaEmpresa]);

  const gravar = React.useCallback(() => { router.refresh(); }, [router]);

  return (
    <div data-workspace="desenho">
      <EmpresaLigada
        labels={labels.map((l) => l.nome)}
        temLead={!!lead}
        nLeads={empresa.leads.length}
        /* `empresas[nome]` é de onde a ficha lê tags, segmento e porte —
           `empresaDados(nome)` no protótipo. Sem esta entrada as tags reais
           do lead não chegavam à tela. */
        dados={{
          leads: [registro],
          eventos: timeline,
          /* Qualificação real no store `qual`, MESMA fonte do drawer e da ficha
             de Contato. A ficha lia `qual[leadId]` que nunca era preenchido. */
          qual: lead ? { [registro.id]: qualDoDesenho(lead.qualificacao) ?? {} } : {},
          empresas: { [empresa.nome]: {
            tags: Array.from(new Set([...((registro.tags as string[] | undefined) ?? []), ...tagsDaEmpresa])),
            /* Timeline REAL (40 eventos: ligações, reuniões, notas, mudanças de
               etapa) — antes a aba Timeline mostrava só "Cadastrado". */
            eventos: eventosDoDesenho(timeline, "Empresa"),
            segmento: empresa.setor,
            porte: empresa.porte,
            deApollo: enriquecimento.deApollo,
            funcionarios: enriquecimento.funcionarios ?? undefined,
            faturamento: enriquecimento.faturamento ?? undefined,
            linkedin: enriquecimento.linkedin ?? undefined,
            tecnologias: enriquecimento.tecnologias ?? undefined,
            pausada: !!cadencia?.pausada,
            arquivos: arquivos.map((a) => ({
              id: a.id, nome: a.nome, tipo: a.mime, src: `/api/arquivos/${a.id}`,
              tam: a.bytes > 1048576 ? `${(a.bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(a.bytes / 1024))} KB`,
              quando: new Date(a.em).toLocaleDateString("pt-BR"),
            })),
            cidade: [empresa.cidade, empresa.estado].filter(Boolean).join(" / ") || undefined,
            site: empresa.website,
            /* Antes só o contato do lead aparecia na aba Pessoas; quem o Apollo
               importa para a empresa ficava invisível. O contato do lead sai daqui
               porque a ficha já o mostra à parte. */
            pessoas: empresa.pessoas
              .filter((p) => p.nome !== registro.pessoa)
              .map((p) => ({ nome: p.nome, cargo: p.cargo ?? "", tel: formatarTelefone(p.telefone) || "—", email: p.email ?? "" })),
          } },
        }}
        catalogo={catalogo}
        relacoes={relacoes}
        abrir={abrir}
        gravar={gravar}
        persistir={persistir}
        cadencia={cadencia?.nome ?? null}
        cadPausada={!!cadencia?.pausada}
        arquivosReais={arquivos}
        enviarArquivos={enviarArquivos}
        removerArquivo={removerArquivo}
        excluirEmpresa={excluirEmpresa}
        onRemoverCadencia={() => { if (lead) void acaoRemoverDaCadencia(lead.id).then((r) => { if (!r.ok) toast.error(r.erro); router.refresh(); }); }}
        onTrocarCadencia={() => { if (lead) abrir("cadencia", lead.id); }}
        ir={(href: string) => router.push(href)}
        /* Depois de importar contatos do Apollo a ficha relê o servidor. */
        recarregar={() => router.refresh()}
      />
    </div>
  );
}
