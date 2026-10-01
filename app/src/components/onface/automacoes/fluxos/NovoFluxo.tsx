"use client";

/* Diálogo "Criar automação": em branco ou a partir de um modelo pronto
 * (modelos.ts). Cria o rascunho pela API e abre o editor. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { grafoInicial } from "@/lib/automacoes/grafo";
import { apiFluxos } from "./api";
import { iconeDe } from "./icones";
import { MODELOS } from "./modelos";

export function NovoFluxo({ aoFechar, modeloInicial }: { aoFechar: () => void; modeloInicial?: string | null }) {
  const router = useRouter();
  const [escolha, setEscolha] = useState<string>(modeloInicial ?? "branco");
  const modelo = MODELOS.find((m) => m.id === escolha);
  const [nome, setNome] = useState(modelo?.nome ?? "");
  const [nomeTocado, setNomeTocado] = useState(false);
  useEffect(() => { if (!nomeTocado) setNome(modelo?.nome ?? ""); }, [modelo, nomeTocado]);

  const criar = useMutation({
    mutationFn: () => apiFluxos.criar({ nome: nome.trim() || "Automação sem nome", grafo: modelo ? modelo.grafo() : grafoInicial() }),
    onSuccess: (f) => { router.push(`/automacoes/fluxos/${f.id}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="oa-veu" onMouseDown={aoFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="novo-fluxo-titulo" className="oa-modal ofx-novo" onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") aoFechar(); }}>
        <div className="oa-modal-topo">
          <h2 id="novo-fluxo-titulo" className="oa-modal-titulo">Criar automação</h2>
          <button type="button" className="oa-icone" aria-label="Fechar" onClick={aoFechar}><X size={16} /></button>
        </div>
        <p className="oa-dica">Comece em branco ou de um modelo. Campos que dependem da sua conta (tag, etapa) ficam marcados para você preencher antes de publicar.</p>

        <div className="ofx-modelos" role="radiogroup" aria-label="Ponto de partida">
          <button type="button" role="radio" aria-checked={escolha === "branco"} className="ofx-modelo" onClick={() => setEscolha("branco")}>
            <span className="ofx-modelo-icone"><Plus size={16} strokeWidth={2.4} /></span>
            <span><strong>Em branco</strong><span>Só o gatilho. Você monta o resto.</span></span>
          </button>
          {MODELOS.map((m) => {
            const Icone = iconeDe(m.icone);
            return (
              <button key={m.id} type="button" role="radio" aria-checked={escolha === m.id} className="ofx-modelo" onClick={() => setEscolha(m.id)}>
                <span className="ofx-modelo-icone"><Icone size={16} strokeWidth={2.2} /></span>
                <span><strong>{m.nome}</strong><span>{m.descricao}</span></span>
              </button>
            );
          })}
        </div>

        <label className="oa-campo">
          <span>Nome</span>
          <input className="oa-input" value={nome} maxLength={100} placeholder="Ex.: avisar o gestor quando o negócio for ganho"
            onChange={(e) => { setNome(e.target.value); setNomeTocado(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !criar.isPending) criar.mutate(); }} />
        </label>

        <div className="oa-modal-rodape">
          <button type="button" className="oa-btn oa-btn-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="oa-btn oa-btn-primario" disabled={criar.isPending} onClick={() => criar.mutate()}>
            {criar.isPending ? "Criando…" : "Criar e abrir o editor"}
          </button>
        </div>
      </div>
    </div>
  );
}
