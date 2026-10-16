"use client";

/* Diálogo "Criar cadência": em branco ou a partir de um modelo — mesmo
 * padrão (e mesmas classes) do `fluxos/NovoFluxo.tsx`.
 *
 * Os modelos são as formas que as cadências de produção já têm: um toque
 * imediato, espera, outro canal, e uma tarefa para o humano no fim. Nada de
 * modelo que precise de tag ou etapa da conta — isso cairia em campo vazio
 * logo na abertura. */

import { useState } from "react";
import { Mail, MessageCircle, Plus, Snowflake, X } from "lucide-react";
import { ROTULO_ENTIDADE } from "@/lib/automacoes/grafo";
import { novoId, type Passo } from "./passos";

type Modelo = {
  id: string; nome: string; descricao: string; icone: typeof MessageCircle;
  entityType: string; passos: () => Passo[];
};

/** `Omit` direto sobre a união deixaria só as chaves comuns; distribuir
 *  preserva os campos de cada tipo de passo. */
type PassoSemId = Passo extends infer T ? (T extends Passo ? Omit<T, "id"> : never) : never;
const p = (passo: PassoSemId): Passo => ({ ...passo, id: novoId(passo.tipo) } as Passo);

export const MODELOS: Modelo[] = [
  {
    id: "inbound", nome: "Primeiro contato inbound", icone: MessageCircle, entityType: "lead",
    descricao: "Fala em minutos, insiste por dois dias e passa para uma pessoa.",
    passos: () => [
      p({ tipo: "mensagem", esperaMin: 0, canal: "whatsapp", mensagem: "Oi {{primeiro_nome}}, aqui é da Callface. Recebemos seu contato e já quero entender o que você precisa. Pode me contar em uma linha?" }),
      p({ tipo: "mensagem", esperaMin: 240, canal: "whatsapp_ia" , instrucao: "Retome o contato de hoje sem repetir a primeira mensagem e proponha uma conversa de 15 minutos." }),
      p({ tipo: "mensagem", esperaMin: 1440, canal: "email", assunto: "{{primeiro_nome}}, consegui falar com você?", mensagem: "Olá {{primeiro_nome}},\n\nTentei falar no WhatsApp sobre o contato que você deixou. Me diz um horário bom e eu ligo.\n\nAbraço." }),
      p({ tipo: "mensagem", esperaMin: 1440, canal: "ligacao" }),
      p({ tipo: "tarefa", esperaMin: 60, titulo: "Falar com {{nome}} ({{empresa}})", descricao: "Três toques automáticos sem resposta. Tentar contato humano.", prioridade: "alta", prazoMin: 480 }),
    ],
  },
  {
    id: "pos-proposta", nome: "Follow-up pós-proposta", icone: Mail, entityType: "negocio",
    descricao: "Confirma o recebimento, cobra uma resposta e registra o que aconteceu.",
    passos: () => [
      p({ tipo: "mensagem", esperaMin: 60, canal: "whatsapp", mensagem: "{{primeiro_nome}}, acabei de te enviar a proposta. Conseguiu receber? Qualquer dúvida, me chama por aqui." }),
      p({ tipo: "mensagem", esperaMin: 2880, canal: "whatsapp_ia", instrucao: "Pergunte se houve tempo de analisar a proposta e ofereça ajuda com objeções, sem pressionar." }),
      p({ tipo: "mensagem", esperaMin: 2880, canal: "email", assunto: "Proposta da Callface — {{empresa}}", mensagem: "Olá {{primeiro_nome}},\n\nSeguindo sobre a proposta. Faz sentido conversarmos 15 minutos para ajustar o escopo?\n\nAbraço." }),
      p({ tipo: "tarefa", esperaMin: 1440, titulo: "Decidir o destino da proposta de {{empresa}}", prioridade: "media", prazoMin: 1440 }),
      p({ tipo: "crm", esperaMin: 0, acao: "nota", titulo: "Cadência pós-proposta concluída", descricao: "Três toques enviados sem resposta registrada." }),
    ],
  },
  {
    id: "frio", nome: "Reativação de lead frio", icone: Snowflake, entityType: "lead",
    descricao: "Dois toques espaçados e uma nota, para não sumir nem incomodar.",
    passos: () => [
      p({ tipo: "mensagem", esperaMin: 0, canal: "whatsapp_ia", instrucao: "Retome um contato antigo com leveza, lembrando o interesse original, e pergunte se o cenário mudou." }),
      p({ tipo: "mensagem", esperaMin: 10080, canal: "email", assunto: "Ainda faz sentido, {{primeiro_nome}}?", mensagem: "Olá {{primeiro_nome}},\n\nVocê falou com a gente há algum tempo. Se o assunto voltou a ser prioridade na {{empresa}}, me responde que eu retomo daqui.\n\nAbraço." }),
      p({ tipo: "crm", esperaMin: 10080, acao: "nota", titulo: "Reativação sem resposta", descricao: "Dois toques espaçados sem retorno. Lead segue frio." }),
    ],
  },
];

export function NovaCadencia({ aoFechar, aoCriar }: {
  aoFechar: () => void;
  aoCriar: (escolha: { nome: string; entityType: string; passos: Passo[] }) => void;
}) {
  const [escolha, setEscolha] = useState("branco");
  const modelo = MODELOS.find((m) => m.id === escolha);
  const [nome, setNome] = useState("");
  const [nomeTocado, setNomeTocado] = useState(false);
  const [entityType, setEntityType] = useState("lead");

  /* Escolher o modelo preenche nome e tipo no mesmo gesto. Fazer isso num
   * efeito que observa a escolha seria o mesmo resultado por um caminho que
   * renderiza duas vezes — e a segunda renderização é a que apaga o que a
   * pessoa já tinha digitado. */
  const escolher = (id: string) => {
    const m = MODELOS.find((x) => x.id === id);
    setEscolha(id);
    if (!nomeTocado) setNome(m?.nome ?? "");
    if (m) setEntityType(m.entityType);
  };

  const criar = () => aoCriar({
    nome: nome.trim() || "Cadência sem nome",
    entityType,
    passos: modelo ? modelo.passos() : [],
  });

  return (
    <div className="oa-veu" onMouseDown={aoFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="nova-cadencia-titulo" className="oa-modal ofx-novo"
        onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") aoFechar(); }}>
        <div className="oa-modal-topo">
          <h2 id="nova-cadencia-titulo" className="oa-modal-titulo">Criar cadência</h2>
          <button type="button" className="oa-icone" aria-label="Fechar" onClick={aoFechar}><X size={16} /></button>
        </div>
        <p className="oa-dica">Comece em branco ou de um modelo. O modelo já vem com o texto escrito e as esperas definidas — revise e publique quando estiver do seu jeito.</p>

        <div className="ofx-modelos" role="radiogroup" aria-label="Ponto de partida">
          <button type="button" role="radio" aria-checked={escolha === "branco"} className="ofx-modelo" onClick={() => escolher("branco")}>
            <span className="ofx-modelo-icone"><Plus size={16} strokeWidth={2.4} /></span>
            <span><strong>Em branco</strong><span>Você monta a sequência passo a passo.</span></span>
          </button>
          {MODELOS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={escolha === m.id} className="ofx-modelo" onClick={() => escolher(m.id)}>
              <span className="ofx-modelo-icone"><m.icone size={16} strokeWidth={2.2} /></span>
              <span><strong>{m.nome}</strong><span>{m.descricao}</span></span>
            </button>
          ))}
        </div>

        <label className="oa-campo">
          <span>Nome</span>
          <input className="oa-input" value={nome} maxLength={120} placeholder="Ex.: follow-up de proposta enviada"
            onChange={(e) => { setNome(e.target.value); setNomeTocado(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") criar(); }} />
        </label>
        <label className="oa-campo">
          <span>Tipo de registro</span>
          <select className="oa-input" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            {Object.entries(ROTULO_ENTIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <div className="oa-modal-rodape">
          <button type="button" className="oa-btn oa-btn-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="oa-btn oa-btn-primario" onClick={criar}>Criar e abrir o editor</button>
        </div>
      </div>
    </div>
  );
}
