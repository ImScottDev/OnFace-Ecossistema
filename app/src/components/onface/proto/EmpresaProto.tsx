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
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ROTULO_ETAPA_PRE_VENDAS, ROTULO_FAMILIA, type Familia } from "@/lib/vendas/dominio";
import type { DetalheLead, Empresa360 } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { EmpresaLiga } from "./EmpresaLiga";
import { levarParametros } from "./rota-do-desenho";
import { registroDoDesenho, linkDoAnuncio } from "./registro-do-desenho";
import { usePecas } from "./pecas-host";

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
    autor: e.usuarioNome ?? "Sistema",
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

  /* `E.avisar` chama `this.diz`, que a Liga gerada não define: todo aviso desta
     ficha (inclusive o erro do Apollo) morria em TypeError e nada aparecia. */
  diz(texto: string, tom?: string) {
    if (tom === "erro") toast.error(texto);
    else if (tom === "aviso") toast.warning(texto);
    else toast.success(texto);
  }
}

export function EmpresaProto({ empresa, lead, timeline }: {
  empresa: Empresa360;
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
      empresaTel: empresa.telefone,
      empresaObs: empresa.observacoes,
      leadScore: empresa.leadScore ?? 0,
      /* Respostas do formulário de cada lead da empresa, com o anúncio de origem. */
      formularios: empresa.formularios.map((f) => ({
        id: f.leadId, titulo: [f.nome, f.criadoEm.slice(0, 10).split("-").reverse().join("/")].filter(Boolean).join(" · "),
        adHref: linkDoAnuncio(f.metaAdId), linhas: f.respostas,
      })),
    };
  }, [empresa, lead]);

  const catalogo = React.useMemo(() => ({
    EQUIPE: registro.resp ? [registro.resp] : [],
    /* `ETAPAS` é o que dá o chip de etapa no cabeçalho — sem ele a ficha
       mostrava "—" no lugar de "Em contato". */
    ETAPAS: Object.fromEntries(
      Object.entries(ROTULO_ETAPA_PRE_VENDAS).map(([k, label]) => [k, { label }]),
    ),
    LEADS: [], CONVERSAS: [], CADENCIAS: [], SEGMENTOS: [],
    /* Mesmo card "Relações em andamento" da ficha da Pessoa, agora na Empresa:
       sem isto a empresa CLIENTE (oportunidade ganha) dizia "Nada em andamento".
       Ganho vira vínculo de Cliente (verde), abertas viram oportunidade (coral),
       perdidas só contam. Fonte: oportunidades reais do empresa360. */
    Relacoes: () => ({
      itens: [
        ...empresa.oportunidades
          .filter((o) => o.etapa === "ganho")
          .map((o) => ({
            k: "cliente", tipo: "Cliente", titulo: o.titulo,
            sub: o.familia ? ROTULO_FAMILIA[o.familia as Familia] ?? o.familia : "Família a definir",
            status: "Cliente ativo", tom: "verde",
            ir: () => router.push(`/pipeline/${o.id}`),
          })),
        ...empresa.oportunidades
          .filter((o) => o.etapa !== "ganho" && o.etapa !== "perdido")
          .map((o) => ({
            k: "opp", tipo: "Oportunidade", titulo: o.titulo,
            sub: o.familia ? ROTULO_FAMILIA[o.familia as Familia] ?? o.familia : "Família a definir",
            status: o.etapaRotulo, tom: "coral",
            ir: () => router.push(`/pipeline/${o.id}`),
          })),
      ],
      perdidas: empresa.oportunidades.filter((o) => o.etapa === "perdido").length,
    }),
  }), [registro.resp, empresa.oportunidades, router]);

  /* Peça do protótipo: abre por cima desta tela pelo hospedeiro global. */
  const { abrir: abrirPeca } = usePecas();
  const abrir = React.useCallback((peca: string, id?: string | null) => {
    if (peca === "pessoa" && id) { router.push(`/pessoas/${id}`); return; }
    if (peca === "oportunidade" && id) { router.push(`/pipeline/${id}`); return; }
    /* Sem lead, o registro da ficha leva o id da EMPRESA — não é lead para a peça abrir. */
    const idDaPeca = !lead && id === empresa.id ? null : id;
    abrirPeca(peca, idDaPeca, { tela: "empresa", empresaId: empresa.id, empresa: empresa.nome, leadId: lead?.id ?? null });
  }, [router, abrirPeca, empresa.id, empresa.nome, lead?.id]);

  const gravar = React.useCallback(() => {
    toast("Editar a empresa ainda não está ligado nesta tela.");
    router.refresh();
  }, [router]);

  return (
    <div data-workspace="desenho">
      <EmpresaLigada
        /* `empresas[nome]` é de onde a ficha lê tags, segmento e porte —
           `empresaDados(nome)` no protótipo. Sem esta entrada as tags reais
           do lead não chegavam à tela. */
        dados={{
          leads: [registro],
          eventos: timeline,
          empresas: { [empresa.nome]: {
            tags: registro.tags,
            /* Timeline REAL (40 eventos: ligações, reuniões, notas, mudanças de
               etapa) — antes a aba Timeline mostrava só "Cadastrado". */
            eventos: eventosDoDesenho(timeline, "Empresa"),
            segmento: empresa.setor,
            porte: empresa.porte,
            cidade: [empresa.cidade, empresa.estado].filter(Boolean).join(" / ") || undefined,
            site: empresa.website,
            /* Antes só o contato do lead aparecia na aba Pessoas; quem o Apollo
               importa para a empresa ficava invisível. O contato do lead sai daqui
               porque a ficha já o mostra à parte. */
            pessoas: empresa.pessoas
              .filter((p) => p.nome !== registro.pessoa)
              .map((p) => ({ nome: p.nome, cargo: p.cargo ?? "", tel: p.telefone || "—", email: p.email ?? "" })),
          } },
        }}
        catalogo={catalogo}
        abrir={abrir}
        gravar={gravar}
        ir={(href: string) => router.push(href)}
        /* Depois de importar contatos do Apollo a ficha relê o servidor. */
        recarregar={() => router.refresh()}
      />
    </div>
  );
}
