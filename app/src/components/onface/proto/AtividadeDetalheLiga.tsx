"use client";

import * as React from "react";
import { AtividadesLiga } from "./AtividadesLiga";
import { AtividadeDetalheDesenho } from "./AtividadeDetalheDesenho";
import { rotaDoDesenho } from "./rota-do-desenho";

/**
 * A gaveta da atividade: a lógica da tela de Atividades (`AtividadesLiga`),
 * com UMA atividade, aberta, mostrando só os blocos `dt` e `ed` do desenho.
 * Tudo que a gaveta grava passa por `props.gravar` (o adaptador em `AtividadePecaProto`).
 */
export class AtividadeDetalheLiga extends AtividadesLiga {
  constructor(props: any) {
    super(props);
    (this as any).state = { ...(this as any).state, aberta: props.chave };
    const E = (this as any).E;
    (this as any).E = {
      ...E,
      // `?atv=`, `?nova=` e `?projeto=` são da tela de Atividades, não da peça.
      parametro: () => null,
      // Os vínculos do desenho navegam sem id; a atividade sabe os ids reais.
      irPara: (href: string, _r?: string, params?: Record<string, string | null>) => {
        const it = (this as any).props.dados.atividadesV2[0] ?? {};
        (this as any).props.ir(rotaDoDesenho(href, { empresa: it.empresaId, lead: it.leadId, opp: it.oppId, ...params }));
      },
    };
  }

  diz(t: string) { (this as any).props.avisou?.(t); }

  componentDidUpdate() {
    super.componentDidUpdate();
    const s = (this as any).state;
    if (!s.aberta && !s.ed) (this as any).props.fechar();
  }

  /** Anexo do comentário: guarda o arquivo de verdade (o desenho só guardava o nome do que não é imagem). */
  guardarAnexos(fs: File[]) {
    const novos = fs.map((fl) => ({ nome: fl.name || "arquivo", url: /^image\//.test(fl.type) ? URL.createObjectURL(fl) : null, arquivo: fl }));
    (this as any).setState((s: any) => ({ comAnx: (s.comAnx || []).concat(novos) }));
  }

  renderVals() {
    const v: any = super.renderVals();
    const S = (this as any).state;
    if (v.dt?.aberto) {
      v.dt.anexar = (e: any) => { const fs = Array.from(e.target.files || []) as File[]; e.target.value = ""; this.guardarAnexos(fs); };
      v.dt.colar = (e: any) => { const fs = Array.from((e.clipboardData && e.clipboardData.files) || []) as File[]; if (!fs.length) return; e.preventDefault(); this.guardarAnexos(fs); };
    }
    if (v.ed?.aberto && S.ed?.it && (this as any).props.excluir) {
      /* Excluir mora no rodapé do editor, à esquerda (onde o desenho põe o erro).
         Pede confirmação; a exclusão é da rota (dono ou gestor). */
      const id = S.ed.it.id, conf = !!S.confExcluir, erro = v.ed.erro;
      v.ed.temErro = true;
      v.ed.erro = (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {erro ? <span>{erro}</span> : null}
          <button
            onClick={() => (conf ? (this as any).props.excluir(id) : (this as any).setState({ confExcluir: true }))}
            style={{ height: 40, padding: "0 16px", borderRadius: 10, border: 0, cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: conf ? "var(--of-coral-acao)" : "transparent", color: conf ? "var(--of-papel)" : "var(--of-coral-texto)" }}
          >
            {conf ? "Confirmar exclusão" : "Excluir"}
          </button>
        </span>
      );
    }
    return v;
  }

  render() {
    const v: any = this.renderVals();
    return <AtividadeDetalheDesenho dt={v.dt} ed={v.ed} abrirPicker={v.abrirPicker} />;
  }
}

