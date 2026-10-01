"use client";

/* ─────────────────────────────────────────────────────────────────────────
 * Tags da oportunidade (tagsopp) e do lead (tagslead) — o adaptador.
 *
 * `TagsOportunidadeLiga` é a lógica do handoff, gerada; aqui ela ganha dado
 * real e gravação, por subclasse, sem encostar no gerado:
 *
 * - A Liga abria por `assinarPecas`, que no produto não existe: quem abre é o
 *   hospedeiro, montando esta peça. O estado inicial é semeado no didMount.
 * - O catálogo é a tabela `labels` da organização. Nenhuma tag dispara
 *   automação hoje (nenhuma automação escuta tag), então todas são
 *   "Organização" — o catálogo de lead do protótipo, com agentes inventados,
 *   nunca é usado: a peça roda sempre no ramo "opp" e o texto é ajustado
 *   quando o alvo é lead.
 * - `aplicar` e `criar` gravam pelas server actions de tags, que passam pela
 *   porta única `lib/crm/tags.ts`.
 * ───────────────────────────────────────────────────────────────────────── */

import * as React from "react";
import { toast } from "sonner";

import type { PecaProps } from "./pecas-host";
import { TagsOportunidadeLiga } from "./TagsOportunidadeLiga";
import { TagsOportunidadeDesenho } from "./TagsOportunidadeDesenho";
import {
  acaoAplicarTags, acaoCriarTag, acaoTagsDoAlvo,
  type AlvoDeTag, type TagDoCatalogo, type TipoAlvoDeTag,
} from "@/app/(crm2)/pipeline/tags-actions";

interface Externo {
  alvo: AlvoDeTag;
  ehLead: boolean;
  catalogo: TagDoCatalogo[];
  criarTag: (nome: string, auto: boolean) => Promise<TagDoCatalogo | null>;
  aplicarTags: (add: string[], rem: string[], naEmpresa: boolean, naPessoa: boolean) => Promise<boolean>;
  fechar: () => void;
}

class TagsLigada extends TagsOportunidadeLiga {
  get x(): Externo { return (this as any).props.externo; }

  opp(id: string) {
    const A = this.x.alvo;
    if (id !== A.id) return null;
    return {
      id: A.id, empresa: A.empresa ?? "", familia: A.familia,
      // No lead a pessoa É o alvo; a caixa "pessoa" fica escondida.
      pessoa: this.x.ehLead ? null : A.leadId ? A.pessoa : null,
      tags: A.tags,
    };
  }

  get dadosDoProto(): any {
    return { TagsOpp: this.x.catalogo.map((t) => ({ nome: t.nome, auto: false })) };
  }

  componentDidMount() {
    super.componentDidMount();
    const O = this.opp(this.x.alvo.id)!;
    (this as any).setState({
      oppId: O.id, tipo: "opp", sel: O.tags.slice(),
      comEmp: !!this.x.alvo.empresaId, comPes: !!O.pessoa, pessoa: O.pessoa, busca: "", novaAuto: false,
    });
  }

  componentDidUpdate(_p: any, antes: any) {
    if (antes.oppId && !(this as any).state.oppId) this.x.fechar();
  }

  diz(texto: string) {
    toast.success(this.x.ehLead ? texto.replace("a oportunidade", "o lead") : texto);
  }

  render() {
    const v: any = this.renderVals();
    if (v.aberto) {
      const S: any = (this as any).state;
      const A = this.x.alvo;
      const lead = this.x.ehLead;
      // Empresa sem cadastro (só o nome solto no lead) não tem onde receber tag.
      v.temEmp = !!A.empresaId;
      v.temPes = !lead && !!A.leadId;
      if (lead) {
        v.titulo = "Tags do lead";
        v.sub = [A.pessoa, A.empresa, "Pré-vendas"].filter(Boolean).join(" · ");
        v.resumo = String(v.resumo).replace(" na oportunidade", " no lead");
        v.alcance = String(v.alcance).replace("a oportunidade", "o lead");
      }
      if (!A.empresa) v.sub = String(v.sub).replace(/ · $/, "");
      v.pessoas = (v.pessoas ?? []).slice(0, 1);

      const limpa = String(S.busca ?? "").trim();
      const criar = async () => {
        if (!v.podeCriar) return;
        const t = await this.x.criarTag(limpa, !!S.novaAuto);
        if (t) (this as any).setState((s: any) => ({ sel: s.sel.concat(t.nome), busca: "" }));
      };
      v.criar = criar;
      const teclaOriginal = v.tecla;
      v.tecla = (e: any) => {
        if (e.key === "Enter" && v.podeCriar) { e.preventDefault(); criar(); return; }
        teclaOriginal(e);
      };

      const aplicarOriginal = v.aplicar;
      v.aplicar = async () => {
        const id = (nome: string) => this.x.catalogo.find((t) => t.nome === nome)?.id ?? "";
        const add = S.sel.filter((n: string) => !A.tags.includes(n)).map(id).filter(Boolean);
        const rem = A.tags.filter((n) => !S.sel.includes(n)).map(id).filter(Boolean);
        if (!add.length && !rem.length) { aplicarOriginal(); return; }
        const ok = await this.x.aplicarTags(add, rem, v.temEmp && S.comEmp, v.temPes && S.comPes);
        // A Liga fecha e dá o aviso; o patch que ela emite vai para `gravar`, que aqui não faz nada.
        if (ok) aplicarOriginal();
      };
    }
    return <TagsOportunidadeDesenho {...v} />;
  }
}

export default function TagsOportunidadePecaProto({ peca, id, contexto, fechar, gravou }: PecaProps) {
  const tipo: TipoAlvoDeTag = peca === "tagslead" ? "lead" : "opp";
  const alvoId = id ?? (tipo === "lead"
    ? (contexto.leadId as string | undefined)
    : (contexto.oportunidadeId as string | undefined)) ?? null;
  const [dados, setDados] = React.useState<{ alvo: AlvoDeTag; catalogo: TagDoCatalogo[] } | null>(null);

  React.useEffect(() => {
    let vivo = true;
    if (!alvoId) {
      toast(tipo === "lead" ? "Sem lead para marcar." : "Sem oportunidade para marcar.", { id: "tags-sem-alvo" });
      fechar();
      return;
    }
    acaoTagsDoAlvo(tipo, alvoId).then((r) => {
      if (!vivo) return;
      if (!r.ok || !r.dados?.alvo) {
        toast.error(r.ok ? "Registro não encontrado nesta organização." : r.erro, { id: "tags-erro" });
        fechar();
        return;
      }
      setDados({ alvo: r.dados.alvo, catalogo: r.dados.catalogo });
    });
    return () => { vivo = false; };
  }, [tipo, alvoId, fechar]);

  const criarTag = React.useCallback(async (nome: string, auto: boolean) => {
    const r = await acaoCriarTag(nome);
    if (!r.ok || !r.dados) { toast.error(r.ok ? "Não consegui criar a tag." : r.erro); return null; }
    const t = r.dados;
    setDados((d) => d && (d.catalogo.some((x) => x.id === t.id) ? d : { ...d, catalogo: [...d.catalogo, t] }));
    // Automação não nasce aqui: a tag é criada e o fluxo se liga em Automações.
    toast.success(auto ? `Tag “${t.nome}” criada. Ligue o fluxo dela em Automações.` : `Tag “${t.nome}” criada.`);
    return t;
  }, []);

  const aplicarTags = React.useCallback(async (add: string[], rem: string[], naEmpresa: boolean, naPessoa: boolean) => {
    if (!dados) return false;
    const r = await acaoAplicarTags({ tipo, id: dados.alvo.id, adicionar: add, remover: rem, naEmpresa, naPessoa });
    if (!r.ok) { toast.error(r.erro); return false; }
    gravou();
    return true;
  }, [dados, tipo, gravou]);

  if (!dados) return null;
  return (
    <div data-workspace="desenho">
      <TagsLigada
        externo={{ alvo: dados.alvo, ehLead: tipo === "lead", catalogo: dados.catalogo, criarTag, aplicarTags, fechar }}
        ir={() => {}}
      />
    </div>
  );
}
