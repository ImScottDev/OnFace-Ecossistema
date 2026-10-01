"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Resultado } from "@/lib/vendas/resultado";
import { SEM_PERMISSAO_CAMPANHAS } from "@/lib/automacoes/campanhas-permissao";
import { htmlParaTexto, personalizar } from "@/lib/automacoes/campanhas-texto";
import type { CampanhaCompleta, Canal, EntradaCampanha, ListaDisponivel, SessaoWhatsapp } from "@/lib/automacoes/campanhas";
import "@/components/onface/vendas/vendas.css";
import "./campanhas.css";

/**
 * Editor de rascunho — substitui o wizard de 4 passos de
 * `crm2/automacoes/CampanhaWizard`. Os mesmos campos e as mesmas validações
 * (nome ≥ 2, corpo, assunto se e-mail, audiência, remetente), agora numa
 * página só, porque eram quatro passos para cinco campos e o stepper obrigava
 * a ir e voltar para corrigir um assunto.
 *
 * Mudanças de comportamento, todas a favor de dado real:
 * - A audiência deixou de ser texto livre: escolhe-se entre as listas que
 *   existem (etiquetas da org), com a contagem de quem o canal alcança.
 * - Editar e excluir rascunho passaram a existir (antes só criar).
 * - Enviar agora / Agendar salvam e põem na fila do worker (`campanha-sweep`),
 *   que dispara em lotes e grava o status de cada destinatário.
 * - No WhatsApp o remetente é uma sessão real da org, não texto livre: o
 *   worker precisa do token da sessão para enviar.
 */
export function CampanhaEditor({
  campanha, listas, sessoes, canalInicial, acaoSalvar, acaoExcluir, acaoAgendar, podeGerir,
}: {
  /** automation.manage, calculado no servidor; a action trava de novo. */
  podeGerir: boolean;
  campanha: CampanhaCompleta | null;
  listas: ListaDisponivel[];
  sessoes: SessaoWhatsapp[];
  canalInicial: Canal;
  acaoSalvar: (id: string | null, e: EntradaCampanha) => Promise<Resultado<{ id: string }>>;
  acaoExcluir: (id: string) => Promise<Resultado>;
  acaoAgendar: (id: string | null, e: EntradaCampanha, quandoIso: string | null) => Promise<Resultado<{ id: string }>>;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState(campanha?.nome ?? "");
  const [canal, setCanal] = useState<Canal>(campanha?.canal ?? canalInicial);
  const [assunto, setAssunto] = useState(campanha?.assunto ?? "");
  const [corpoHtml, setCorpoHtml] = useState(campanha?.corpoHtml ?? "<p>Olá {{nome}},</p>\n<p>Seu conteúdo aqui…</p>");
  const [escolhidas, setEscolhidas] = useState<string[]>(campanha?.listas ?? []);
  // Um remetente por canal: trocar de canal não pode deixar um e-mail no
  // lugar do id de sessão (nem o contrário).
  const sessaoSalva = campanha?.canal === "whatsapp" && sessoes.some((s) => s.id === campanha.remetente) ? campanha.remetente! : "";
  const [sessaoId, setSessaoId] = useState(sessaoSalva || sessoes.find((s) => s.conectada)?.id || "");
  const [responderPara, setResponderPara] = useState(campanha?.canal === "email" ? campanha.remetente ?? "" : "");
  const remetente = canal === "whatsapp" ? sessaoId : responderPara;
  const [quando, setQuando] = useState("");

  // Lista salva que não existe mais (rascunho antigo de texto livre) continua
  // visível e desmarcável, mas avisada — sumir com ela em silêncio mudaria o
  // rascunho sem a pessoa saber.
  const nomesExistentes = new Set(listas.map((l) => l.nome));
  const orfas = escolhidas.filter((n) => !nomesExistentes.has(n));
  const alcance = (l: ListaDisponivel) => (canal === "whatsapp" ? l.comTelefone : l.comEmail);
  // Soma por lista é teto (um lead pode estar em duas). O número exato é
  // calculado no servidor ao salvar e é o que a lista mostra.
  const teto = listas.filter((l) => escolhidas.includes(l.nome)).reduce((s, l) => s + alcance(l), 0);

  function alternar(n: string) {
    setEscolhidas((atual) => (atual.includes(n) ? atual.filter((x) => x !== n) : [...atual, n]));
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await acaoSalvar(campanha?.id ?? null, {
        nome, canal, assunto: canal === "email" ? assunto : null, corpoHtml, listas: escolhidas, remetente,
      });
      if (!r.ok) { setErro(r.erro); return; }
      toast.success(campanha ? "Rascunho atualizado" : "Campanha salva como rascunho");
      router.push("/automacoes/campanhas");
      router.refresh();
    });
  }

  function agendar(agora: boolean) {
    setErro(null);
    if (!agora && !quando) { setErro("Escolha data e hora para agendar, ou use Enviar agora."); return; }
    if (!remetente) { setErro(canal === "whatsapp" ? "Escolha a sessão de WhatsApp que assina o disparo." : "Informe o e-mail que recebe as respostas."); return; }
    if (escolhidas.length === 0) { setErro("Escolha ao menos uma lista de contatos."); return; }
    const alvo = canal === "whatsapp" ? "WhatsApp" : "e-mail";
    const pergunta = agora
      ? `Enviar "${nome || "esta campanha"}" por ${alvo} para até ${teto} ${teto === 1 ? "destinatário" : "destinatários"} agora? Depois de começar não dá para desfazer o que já saiu.`
      : `Agendar "${nome || "esta campanha"}" para ${new Date(quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}?`;
    if (!window.confirm(pergunta)) return;
    iniciar(async () => {
      const r = await acaoAgendar(campanha?.id ?? null, {
        nome, canal, assunto: canal === "email" ? assunto : null, corpoHtml, listas: escolhidas, remetente,
      }, agora ? null : new Date(quando).toISOString());
      if (!r.ok) { setErro(r.erro); return; }
      toast.success(agora ? "Campanha na fila: o envio começa em até 1 minuto" : "Campanha agendada");
      router.push(`/automacoes/campanhas/${r.dados!.id}`);
      router.refresh();
    });
  }

  function excluir() {
    if (!campanha || !window.confirm(`Excluir o rascunho "${campanha.nome}"? Não dá para desfazer.`)) return;
    iniciar(async () => {
      const r = await acaoExcluir(campanha.id);
      if (!r.ok) { setErro(r.erro); return; }
      toast.success("Rascunho excluído");
      router.push("/automacoes/campanhas");
      router.refresh();
    });
  }

  // Sem permissão o formulário vira leitura: os campos travam junto, senão a
  // pessoa digita tudo para descobrir no fim que não pode salvar.
  const editavel = podeGerir && (!campanha || campanha.status === "rascunho");

  return (
    <form className="ov-form cp-editor" onSubmit={salvar}>
      <section className="cp-bloco" aria-labelledby="cp-conteudo">
        <h2 id="cp-conteudo">Conteúdo</h2>
        <label>
          <span>Nome da campanha</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Outbound decisores de TI, junho" disabled={!editavel} />
        </label>
        <div className="cp-campo">
          <span className="cp-rotulo">Canal</span>
          <div className="ov-familias" role="group" aria-label="Canal da campanha">
            {([["email", "E-mail"], ["whatsapp", "WhatsApp"]] as const).map(([v, l]) => (
              <button
                key={v} type="button" className="ov-familia" data-marcada={canal === v ? "true" : undefined}
                aria-pressed={canal === v} onClick={() => setCanal(v)} disabled={!editavel}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {canal === "email" ? (
          <label>
            <span>Assunto do e-mail</span>
            <input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Uma ideia para a {{empresa}}" disabled={!editavel} />
          </label>
        ) : null}
        <label>
          <span>Corpo</span>
          <textarea rows={8} className="cp-mono" value={corpoHtml} onChange={(e) => setCorpoHtml(e.target.value)} disabled={!editavel} />
        </label>
        {canal === "whatsapp" && corpoHtml.trim() ? (
          // Mesma conversão que o worker faz antes de enviar: o que se vê aqui
          // é o texto que sai, com as variáveis marcadas no lugar do dado.
          <div className="cp-previa" aria-label="Prévia da mensagem no WhatsApp">
            <span className="cp-rotulo">Como chega no WhatsApp</span>
            <p>{personalizar(htmlParaTexto(corpoHtml), { nome: "‹nome›", empresa: "‹empresa›" })}</p>
          </div>
        ) : null}
        <p className="ov-nota">
          {canal === "whatsapp"
            ? <>Vai como texto: as tags HTML viram quebras de linha. Use {"{{nome}}"} (primeiro nome) e {"{{empresa}}"} para personalizar.</>
            : <>HTML. Use {"{{nome}}"} (primeiro nome) e {"{{empresa}}"} para personalizar.</>}
        </p>
      </section>

      <section className="cp-bloco" aria-labelledby="cp-audiencia">
        <h2 id="cp-audiencia">Audiência</h2>
        {listas.length === 0 && orfas.length === 0 ? (
          <p className="ov-nota">
            Nenhuma lista na organização. Listas são as etiquetas dos leads — crie em{" "}
            <Link href="/prospeccao">Prospecção</Link> ou <Link href="/pre-vendas">Pré-vendas</Link>.
          </p>
        ) : (
          <div className="ov-familias" role="group" aria-label="Listas de contatos">
            {listas.map((l) => (
              <button
                key={l.nome} type="button" className="ov-familia"
                data-marcada={escolhidas.includes(l.nome) ? "true" : undefined}
                aria-pressed={escolhidas.includes(l.nome)} onClick={() => alternar(l.nome)} disabled={!editavel}
              >
                {l.nome} <span className="cp-contagem">{alcance(l)}</span>
              </button>
            ))}
            {orfas.map((n) => (
              <button
                key={n} type="button" className="ov-familia" data-marcada="true" aria-pressed
                onClick={() => alternar(n)} title="Esta lista não existe mais. Clique para remover." disabled={!editavel}
              >
                {n} <span className="cp-contagem">não existe</span>
              </button>
            ))}
          </div>
        )}
        <p className="ov-nota">
          O número ao lado de cada lista é quem tem {canal === "whatsapp" ? "telefone" : "e-mail"}.
          {escolhidas.length ? ` Até ${teto} destinatários; o total exato, sem repetidos, é calculado ao salvar.` : ""}
        </p>
      </section>

      <section className="cp-bloco" aria-labelledby="cp-remetente">
        <h2 id="cp-remetente">Remetente</h2>
        {canal === "whatsapp" ? (
          sessoes.length === 0 ? (
            <p className="ov-nota">
              Nenhuma sessão de WhatsApp na organização. Conecte um número em{" "}
              <Link href="/ajustes/whatsapp">Ajustes › WhatsApp</Link> para poder disparar.
            </p>
          ) : (
            <>
              <label>
                <span>Sessão de WhatsApp</span>
                <select value={sessaoId} onChange={(e) => setSessaoId(e.target.value)} disabled={!editavel}>
                  <option value="">Escolha a sessão que assina o disparo</option>
                  {sessoes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}{s.telefone ? ` · ${s.telefone}` : ""}{s.conectada ? "" : " (desconectada)"}
                    </option>
                  ))}
                </select>
              </label>
              {sessaoId && !sessoes.find((s) => s.id === sessaoId)?.conectada ? (
                <p className="ov-nota" role="note">Esta sessão está desconectada: enquanto ela não voltar, cada envio fica como falha.</p>
              ) : null}
            </>
          )
        ) : (
          <>
            <label>
              <span>Responder para</span>
              <input type="email" value={responderPara} onChange={(e) => setResponderPara(e.target.value)} disabled={!editavel} placeholder="voce@callface.ai" />
            </label>
            <p className="ov-nota">O e-mail sai pela conta do sistema; as respostas chegam neste endereço.</p>
          </>
        )}
      </section>

      {erro ? <p className="ov-form-erro" role="alert">{erro}</p> : null}
      {!podeGerir ? <p className="ov-nota" role="note">{SEM_PERMISSAO_CAMPANHAS} Salvar e excluir ficam com a gestão.</p>
        : !editavel ? <p className="ov-nota">Esta campanha não está mais em rascunho e não pode ser editada.</p> : null}

      <div className="cp-rodape-acoes">
        <div className="ov-acoes">
          {campanha && campanha.status === "rascunho" ? (
            <button
              type="button" className="ov-botao" data-variante="perigo" onClick={excluir}
              disabled={pendente || !podeGerir} title={podeGerir ? undefined : SEM_PERMISSAO_CAMPANHAS}
            >Excluir rascunho</button>
          ) : null}
        </div>
        <div className="cp-envio">
          {editavel ? (
            <label className="cp-quando">
              <span>Agendar para</span>
              <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} disabled={pendente} />
            </label>
          ) : null}
          <div className="ov-acoes">
            <Link className="ov-botao" data-variante="contorno" href="/automacoes/campanhas">{editavel ? "Cancelar" : "Voltar"}</Link>
            {editavel ? (
              <>
                <button type="submit" className="ov-botao" data-variante="contorno" disabled={pendente}>
                  {pendente ? "Salvando…" : "Salvar rascunho"}
                </button>
                <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente || !quando} onClick={() => agendar(false)}>Agendar</button>
                <button type="button" className="ov-botao" disabled={pendente} onClick={() => agendar(true)}>Enviar agora</button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}
