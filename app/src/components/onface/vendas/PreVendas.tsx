"use client";

/**
 * Pré-vendas (Bloco 01).
 *
 * Board empresa-first: a Empresa é a protagonista do card e a Pessoa é o
 * contato através do qual se trabalha aquela empresa. O contexto aprofundado
 * fica no painel, não no card — a spec pede explicitamente para não entupir.
 *
 * Três etapas do board NÃO se alcançam arrastando, e isso é regra, não
 * limitação da interface:
 *   - Qualificado grava um fato histórico, então tem comando próprio;
 *   - Oportunidade cria uma entidade no Pipeline;
 *   - Nutrição e Desqualificação exigem motivo estruturado.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Building2, CalendarClock, CheckCircle2, Mail, MessageCircle, Plus, Sparkles, UserPlus,
} from "lucide-react";
import type { BoardPreVendas, CardPreVendas, DetalheLead } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import {
  FAMILIAS, MOTIVOS_DESQUALIFICACAO, MOTIVOS_NUTRICAO, ROTULO_FAMILIA,
  type Familia, type MotivoDesqualificacao, type MotivoNutricao, type Qualificacao,
} from "@/lib/vendas/dominio";
import type { Resultado } from "@/lib/vendas/resultado";
import {
  Abas, AvisoBloqueio, Board, Busca, Campo, Coluna, ColunaVazia, ComPainel,
  Dialogo, Painel, Secao, Tag, dataCurta, dataHora, decorrido, useAcao,
} from "./ui";
import { AcoesContato } from "./pagina";

type Aba = "ativos" | "nutricao" | "desqualificados";

/** O que o formulário de novo lead devolve. Empresa e contato são obrigatórios
 *  porque em Pré-vendas o objeto é a empresa e ela precisa de alguém por quem
 *  ser trabalhada. */
export interface EntradaNovoLead {
  empresa: string;
  pessoaNome: string;
  cnpj?: string | null;
  website?: string | null;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  origem?: string | null;
  responsavelId?: string | null;
}

export interface AcoesPreVendas {
  moverEtapa: (leadId: string, para: "novo" | "em_contato" | "qualificacao") => Promise<Resultado>;
  qualificar: (leadId: string, q: Qualificacao) => Promise<Resultado>;
  salvarQualificacao: (leadId: string, q: Qualificacao) => Promise<Resultado>;
  nutrir: (leadId: string, motivo: MotivoNutricao, retomarEm: string | null, obs: string | null) => Promise<Resultado>;
  desqualificar: (leadId: string, motivo: MotivoDesqualificacao, detalhe: string | null) => Promise<Resultado>;
  reativar: (leadId: string) => Promise<Resultado>;
  registrarContato: (leadId: string, canal: "whatsapp" | "email" | "ligacao") => Promise<Resultado>;
  atribuir: (leadId: string, responsavelId: string | null) => Promise<Resultado>;
  criarOportunidade: (e: { leadId: string; familias: Familia[]; responsavelId: string; reuniao?: { data: string } | null }) => Promise<Resultado<{ ids: string[] }>>;
  criarLead: (e: EntradaNovoLead) => Promise<Resultado<{ leadId: string }>>;
  associarEmpresa: (leadId: string, nome: string, cnpj: string | null) => Promise<Resultado>;
  detalhe: (leadId: string) => Promise<Resultado<{ lead: DetalheLead | null; timeline: LinhaDoTempo[] }>>;
}

export function PreVendas({ dados, aba, filtro, acoes }: {
  dados: BoardPreVendas;
  aba: Aba;
  filtro: { busca: string; responsavelId: string | null };
  acoes: AcoesPreVendas;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = useTransition();
  const [busca, setBusca] = useState(filtro.busca);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<{ lead: DetalheLead | null; timeline: LinhaDoTempo[] } | null>(null);
  const [modal, setModal] = useState<null | "qualificar" | "nutrir" | "desqualificar" | "oportunidade" | "novo" | "empresa">(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const { pendente, bloqueio, limparBloqueio, executar } = useAcao();

  function navegar(mudancas: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") url.searchParams.delete(chave);
      else url.searchParams.set(chave, valor);
    }
    iniciarNavegacao(() => router.push(`${url.pathname}${url.search}`));
  }

  async function abrir(leadId: string) {
    setSelecionado(leadId);
    limparBloqueio();
    setDetalhe(null);
    const resultado = await acoes.detalhe(leadId);
    if (resultado.ok && resultado.dados) setDetalhe(resultado.dados);
  }

  async function recarregarDetalhe() {
    if (!selecionado) return;
    const resultado = await acoes.detalhe(selecionado);
    if (resultado.ok && resultado.dados) setDetalhe(resultado.dados);
  }

  async function rodar(fn: () => Promise<Resultado<unknown>>, fecharModal = true, mensagem = "Alteração salva.") {
    let confirmou = false;
    await executar(async () => {
      const resultado = await fn();
      confirmou = resultado.ok;
      return resultado as Resultado<unknown>;
    });
    if (confirmou) {
      if (fecharModal) setModal(null);
      setSucesso(mensagem);
      await recarregarDetalhe();
      router.refresh();
    }
    return confirmou;
  }

  const lead = detalhe?.lead ?? null;

  return (
    <>
      <div className="ov-controles">
        <Abas<Aba>
          ativa={aba}
          aoTrocar={(nova) => navegar({ aba: nova === "ativos" ? null : nova })}
          abas={[
            { chave: "ativos", rotulo: "Ativos", contagem: dados.resumo.ativos },
            { chave: "nutricao", rotulo: "Nutrição", contagem: dados.resumo.nutricao },
            { chave: "desqualificados", rotulo: "Desqualificados", contagem: dados.resumo.desqualificados },
          ]}
        />
        <Busca
          valor={busca}
          aoMudar={setBusca}
          placeholder="Buscar empresa, pessoa ou e-mail"
        />
        <button type="button" className="ov-botao" data-variante="neutro" onClick={() => navegar({ busca })}>
          Buscar
        </button>
        <select
          className="ov-select"
          value={filtro.responsavelId ?? ""}
          onChange={(e) => navegar({ responsavel: e.target.value || null })}
          aria-label="Filtrar por responsável"
        >
          <option value="">Todos os responsáveis</option>
          {dados.filtros.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <button type="button" className="ov-botao" onClick={() => { limparBloqueio(); setModal("novo"); }}>
          <Plus aria-hidden />Novo lead
        </button>
      </div>

      {bloqueio && !modal ? (
        <div style={{ marginBottom: "calc(14 * var(--onface-u))" }}>
          <AvisoBloqueio bloqueio={bloqueio} />
        </div>
      ) : null}
      {sucesso ? <p className="ov-nota" role="status">{sucesso}</p> : null}

      <ComPainel
        aberto={Boolean(selecionado)}
        painel={
          <PainelLead
            lead={lead}
            timeline={detalhe?.timeline ?? []}
            pendente={pendente}
            bloqueio={bloqueio}
            responsaveis={dados.filtros.responsaveis}
            aoFechar={() => { setSelecionado(null); setDetalhe(null); limparBloqueio(); }}
            aoAgir={(tipo) => {
              if (tipo === "qualificar") setModal("qualificar");
              else if (tipo === "criar_oportunidade") setModal("oportunidade");
              else if (tipo === "associar_empresa") setModal("empresa");
            }}
            acoes={{
              mover: (para) => rodar(() => acoes.moverEtapa(lead!.id, para), false),
              contato: (canal) => rodar(() => acoes.registrarContato(lead!.id, canal), false),
              atribuir: (id) => rodar(() => acoes.atribuir(lead!.id, id), false),
              reativar: () => rodar(() => acoes.reativar(lead!.id), false),
              abrirModal: setModal,
            }}
          />
        }
      >
        <Board>
          {dados.colunas.map((coluna) => (
            <Coluna
              key={coluna.chave}
              titulo={coluna.rotulo}
              total={coluna.total}
              carregados={coluna.cards.length}
            >
              {coluna.cards.length === 0 ? (
                <ColunaVazia>Nenhuma empresa nesta etapa.</ColunaVazia>
              ) : (
                coluna.cards.map((card) => (
                  <CardLead
                    key={card.leadId}
                    card={card}
                    selecionado={card.leadId === selecionado}
                    aoAbrir={() => abrir(card.leadId)}
                  />
                ))
              )}
            </Coluna>
          ))}
        </Board>
      </ComPainel>

      {/* ── Diálogos ────────────────────────────────────────────────────── */}

      <DialogoQualificar
        aberto={modal === "qualificar"}
        lead={lead}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoSalvar={(q, qualificar) =>
          rodar(() => (qualificar ? acoes.qualificar(lead!.id, q) : acoes.salvarQualificacao(lead!.id, q)))}
      />

      <DialogoNutrir
        aberto={modal === "nutrir"}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(motivo, retomarEm, obs) => rodar(() => acoes.nutrir(lead!.id, motivo, retomarEm, obs))}
      />

      <DialogoDesqualificar
        aberto={modal === "desqualificar"}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(motivo, detalhe) => rodar(() => acoes.desqualificar(lead!.id, motivo, detalhe))}
      />

      <DialogoOportunidade
        aberto={modal === "oportunidade"}
        lead={lead}
        responsaveis={dados.filtros.responsaveis}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(familias, responsavelId, reuniao) =>
          rodar(() => acoes.criarOportunidade({ leadId: lead!.id, familias, responsavelId, reuniao }))}
      />

      <DialogoNovoLead
        aberto={modal === "novo"}
        responsaveis={dados.filtros.responsaveis}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(entrada) => rodar(() => acoes.criarLead(entrada))}
      />

      <DialogoAssociarEmpresa
        aberto={modal === "empresa"}
        nomeSugerido={lead?.empresa.nome ?? ""}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(nome, cnpj) => rodar(() => acoes.associarEmpresa(lead!.id, nome, cnpj))}
      />
    </>
  );
}

/* ── Card ──────────────────────────────────────────────────────────────── */

function CardLead({ card, selecionado, aoAbrir }: {
  card: CardPreVendas; selecionado: boolean; aoAbrir: () => void;
}) {
  return (
    <button type="button" className="ov-card" data-selecionado={selecionado} onClick={aoAbrir}>
      <span className="ov-card-empresa">{card.empresa}</span>
      {card.pessoa ? (
        <span className="ov-card-pessoa">
          {card.pessoa}{card.cargo ? ` · ${card.cargo}` : ""}
        </span>
      ) : (
        <span className="ov-card-pessoa">Sem contato associado</span>
      )}

      <span className="ov-card-meta">
        {card.origem ? <Tag>{card.origem}</Tag> : null}
        {card.campanha ? <Tag>{card.campanha}</Tag> : null}
        {card.servicos?.slice(0, 1).map((s) => <Tag key={s} tom="info">{s}</Tag>)}
        {/* O fato Qualificado acompanha o card mesmo fora da coluna
            Qualificado — é o ponto da spec: ele sobrevive à etapa. */}
        {card.qualificado && card.etapa !== "qualificado" ? <Tag tom="sucesso">Qualificado</Tag> : null}
        {card.preQualificado ? <Tag tom="neutro-escuro">Pré-qualificado</Tag> : null}
        {card.nutricaoRetomarEm ? <Tag tom="alerta">Retomar {dataCurta(card.nutricaoRetomarEm)}</Tag> : null}
        {card.desqualificacaoMotivo ? <Tag tom="neutro-escuro">{card.desqualificacaoMotivo}</Tag> : null}
      </span>

      <span className="ov-card-rodape">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "calc(6 * var(--onface-u))" }}>
          {card.responsavelIniciais
            ? <span className="ov-avatar" aria-hidden>{card.responsavelIniciais}</span>
            : <span style={{ color: "var(--onface-coral)" }}>Sem responsável</span>}
          {card.responsavel ? card.responsavel.split(" ")[0] : null}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "calc(8 * var(--onface-u))" }}>
          {card.temWhatsapp ? <MessageCircle aria-label="Tem WhatsApp" style={{ width: "calc(12 * var(--onface-u))", height: "calc(12 * var(--onface-u))" }} /> : null}
          {card.temEmail ? <Mail aria-label="Tem e-mail" style={{ width: "calc(12 * var(--onface-u))", height: "calc(12 * var(--onface-u))" }} /> : null}
          {decorrido(card.horasSemInteracao)}
        </span>
      </span>
    </button>
  );
}

/* ── Painel ────────────────────────────────────────────────────────────── */

function PainelLead({ lead, timeline, pendente, bloqueio, responsaveis, aoFechar, aoAgir, acoes }: {
  lead: DetalheLead | null;
  timeline: LinhaDoTempo[];
  pendente: boolean;
  bloqueio: { mensagem: string; acao?: { rotulo: string; tipo: string } } | null;
  responsaveis: Array<{ id: string; nome: string }>;
  aoFechar: () => void;
  aoAgir: (tipo: string) => void;
  acoes: {
    mover: (para: "novo" | "em_contato" | "qualificacao") => Promise<boolean>;
    contato: (canal: "whatsapp" | "email" | "ligacao") => Promise<boolean>;
    atribuir: (responsavelId: string | null) => Promise<boolean>;
    reativar: () => Promise<boolean>;
    abrirModal: (m: "qualificar" | "nutrir" | "desqualificar" | "oportunidade") => void;
  };
}) {
  if (!lead) {
    return <Painel titulo="Carregando" aoFechar={aoFechar}><p className="ov-nota">Buscando o lead…</p></Painel>;
  }

  const q = (lead.qualificacao ?? {}) as Record<string, string | undefined>;
  const encerrado = lead.etapa === "nutricao" || lead.etapa === "desqualificado";

  return (
    <Painel titulo={lead.empresa.nome} subtitulo={`${lead.pessoa.nome}${lead.pessoa.cargo ? ` · ${lead.pessoa.cargo}` : ""}`} aoFechar={aoFechar}>
      <div className="ov-card-meta">
        <Tag tom="coral">{lead.etapaRotulo}</Tag>
        {lead.qualificado ? <Tag tom="sucesso">Qualificado {dataCurta(lead.qualificadoEm)}</Tag> : null}
        {lead.preQualificado ? <Tag tom="neutro-escuro">Pré-qualificado</Tag> : null}
      </div>

      {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} aoAgir={aoAgir} /> : null}

      <Secao titulo="Ações">
        <div className="ov-acoes">
          {!encerrado ? (
            <>
              {lead.etapa === "novo" ? (
                <button type="button" className="ov-botao" disabled={pendente} onClick={() => acoes.contato("whatsapp")}>
                  <MessageCircle aria-hidden />Registrar 1º contato
                </button>
              ) : null}
              {lead.etapa === "em_contato" ? (
                <button type="button" className="ov-botao" disabled={pendente} onClick={() => acoes.mover("qualificacao")}>
                  <Sparkles aria-hidden />Iniciar qualificação
                </button>
              ) : null}
              {(lead.etapa === "qualificacao" || lead.etapa === "em_contato") ? (
                <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente} onClick={() => acoes.abrirModal("qualificar")}>
                  <CheckCircle2 aria-hidden />Qualificar
                </button>
              ) : null}
              {lead.etapa === "qualificado" ? (
                <button type="button" className="ov-botao" disabled={pendente} onClick={() => acoes.abrirModal("oportunidade")}>
                  <ArrowRight aria-hidden />Criar oportunidade
                </button>
              ) : null}
              <button type="button" className="ov-botao" data-variante="neutro" disabled={pendente} onClick={() => acoes.abrirModal("nutrir")}>
                Nutrir
              </button>
              <button type="button" className="ov-botao" data-variante="perigo" disabled={pendente} onClick={() => acoes.abrirModal("desqualificar")}>
                Desqualificar
              </button>
            </>
          ) : (
            <button type="button" className="ov-botao" disabled={pendente} onClick={() => acoes.reativar()}>
              Retomar lead
            </button>
          )}
        </div>
      </Secao>

      <Secao titulo="Contato">
        <AcoesContato alvo={{
          leadId: lead.id,
          whatsapp: lead.pessoa.whatsapp,
          telefone: lead.pessoa.telefone,
          email: lead.pessoa.email,
        }} />
      </Secao>

      <Secao titulo="Empresa">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Segmento">{lead.empresa.setor}</Campo>
          <Campo rotulo="Porte">{lead.empresa.porte}</Campo>
          <Campo rotulo="Cidade">{lead.empresa.cidade}</Campo>
          <Campo rotulo="CNPJ">{lead.empresa.cnpj}</Campo>
        </dl>
        {lead.empresa.id ? (
          <Link className="ov-botao" data-variante="contorno" href={`/onface-preview/contatos?empresa=${lead.empresa.id}`}>
            <Building2 aria-hidden />Abrir empresa
          </Link>
        ) : (
          <button type="button" className="ov-botao" data-variante="contorno" onClick={() => aoAgir("associar_empresa")}>
            <Building2 aria-hidden />Associar empresa
          </button>
        )}
      </Secao>

      <Secao titulo="Qualificação">
        {Object.keys(q).length === 0 ? (
          <p className="ov-nota">Nada registrado ainda.</p>
        ) : (
          <dl style={{ margin: 0 }}>
            <Campo rotulo="Dor">{q.dor}</Campo>
            <Campo rotulo="Necessidade">{q.necessidade}</Campo>
            <Campo rotulo="Urgência">{q.urgencia}</Campo>
            <Campo rotulo="Budget">{q.budget}</Campo>
            <Campo rotulo="Decisor">{q.decisor}</Campo>
            <Campo rotulo="Timing">{q.timing}</Campo>
            <Campo rotulo="Concorrente">{q.solucaoAtual}</Campo>
          </dl>
        )}
      </Secao>

      <Secao titulo="Atribuição">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Origem">{lead.atribuicao.origem}</Campo>
          <Campo rotulo="Campanha">{lead.atribuicao.campanha}</Campo>
          <Campo rotulo="Primeiro toque">{lead.atribuicao.primeiroToque}</Campo>
          <Campo rotulo="Último toque">{lead.atribuicao.ultimoToque}</Campo>
          <Campo rotulo="Landing page">{lead.atribuicao.landingPage}</Campo>
        </dl>
      </Secao>

      <Secao titulo="Responsável">
        <select
          className="ov-select"
          value={lead.responsavel.id ?? ""}
          disabled={pendente}
          onChange={(e) => acoes.atribuir(e.target.value || null)}
          aria-label="Responsável pelo lead"
        >
          <option value="">Sem responsável</option>
          {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
      </Secao>

      {lead.oportunidades.length > 0 ? (
        <Secao titulo="Oportunidades">
          {lead.oportunidades.map((o) => (
            <Link key={o.id} className="ov-botao" data-variante="contorno" href={`/onface-preview/pipeline?oportunidade=${o.id}`}>
              {o.titulo} · {o.etapaRotulo}
            </Link>
          ))}
        </Secao>
      ) : null}

      {lead.proximaAcao ? (
        <Secao titulo="Próxima ação">
          <p className="ov-nota">
            <CalendarClock aria-hidden style={{ width: "calc(12 * var(--onface-u))", height: "calc(12 * var(--onface-u))", verticalAlign: "-2px" }} />
            {" "}{lead.proximaAcao.titulo} · {dataCurta(lead.proximaAcao.venceEm)}
          </p>
        </Secao>
      ) : null}

      <Secao titulo="Histórico">
        {timeline.length === 0 ? (
          <p className="ov-nota">Nenhum evento registrado.</p>
        ) : (
          <div className="ov-timeline">
            {timeline.map((e) => (
              <div className="ov-timeline-item" key={e.id}>
                <span className="ov-timeline-marca" aria-hidden />
                <div>
                  <strong>{rotuloEvento(e.tipo)}</strong>
                  <span>
                    {dataHora(e.ocorridoEm)}
                    {e.usuarioNome ? ` · ${e.usuarioNome}` : e.atorTipo !== "HUMAN" ? ` · ${rotuloAtor(e.atorTipo)}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>
    </Painel>
  );
}

/* ── Diálogos ──────────────────────────────────────────────────────────── */

function DialogoQualificar({ aberto, lead, pendente, bloqueio, aoFechar, aoSalvar }: {
  aberto: boolean;
  lead: DetalheLead | null;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoSalvar: (q: Qualificacao, qualificar: boolean) => Promise<boolean>;
}) {
  const inicial = useMemo(() => (lead?.qualificacao ?? {}) as Qualificacao, [lead]);
  const [form, setForm] = useState<Qualificacao>(inicial);

  // Reabrir o diálogo com outro lead precisa recarregar o formulário; sem isto
  // a qualificação de um lead apareceria dentro de outro.
  const [ultimoLead, setUltimoLead] = useState<string | null>(null);
  if (aberto && lead && lead.id !== ultimoLead) {
    setUltimoLead(lead.id);
    setForm(inicial);
  }

  const campo = (chave: keyof Qualificacao) => ({
    value: (form[chave] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [chave]: e.target.value })),
  });

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Qualificação"
      descricao="Nenhum campo é obrigatório. Salvar guarda o que foi levantado; qualificar grava o fato de que a empresa passou pelos critérios."
      largura="larga"
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-form-linha">
          <label><span>Dor / problema</span><input {...campo("dor")} /></label>
          <label><span>Necessidade</span><input {...campo("necessidade")} /></label>
          <label><span>Cenário atual</span><input {...campo("cenarioAtual")} /></label>
          <label><span>Solução / concorrente atual</span><input {...campo("solucaoAtual")} /></label>
          <label><span>Urgência</span><input {...campo("urgencia")} /></label>
          <label><span>Budget</span><input {...campo("budget")} /></label>
          <label><span>Decisor</span><input {...campo("decisor")} /></label>
          <label><span>Timing de decisão</span><input {...campo("timing")} /></label>
          <label><span>ICP / aderência</span><input {...campo("icp")} /></label>
          <label><span>Influenciadores</span><input {...campo("influenciadores")} /></label>
        </div>
        <label><span>Observações</span><textarea {...campo("observacoes")} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" disabled={pendente} onClick={() => aoSalvar(form, false)}>
            Salvar sem qualificar
          </button>
          <button type="button" className="ov-botao" disabled={pendente} onClick={() => aoSalvar(form, true)}>
            <CheckCircle2 aria-hidden />Qualificar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoNutrir({ aberto, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (motivo: MotivoNutricao, retomarEm: string | null, obs: string | null) => Promise<boolean>;
}) {
  const [motivo, setMotivo] = useState<MotivoNutricao>("sem_resposta");
  const [retomarEm, setRetomarEm] = useState("");
  const [observacao, setObservacao] = useState("");

  const definicao = MOTIVOS_NUTRICAO.find((m) => m.chave === motivo);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Mover para nutrição"
      descricao="Nutrição não é arquivo morto: com data de retomada, o lead volta sozinho para a fila na data escolhida."
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label>
          <span>Motivo</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoNutricao)}>
            {MOTIVOS_NUTRICAO.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
          </select>
        </label>
        <label>
          <span>Retomar em {definicao?.exigeRetomada ? "(obrigatório)" : "(opcional)"}</span>
          <input type="date" value={retomarEm} onChange={(e) => setRetomarEm(e.target.value)} />
        </label>
        <label><span>Observação</span><textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente}
            onClick={() => aoConfirmar(motivo, retomarEm || null, observacao.trim() || null)}>
            Mover para nutrição
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoDesqualificar({ aberto, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (motivo: MotivoDesqualificacao, detalhe: string | null) => Promise<boolean>;
}) {
  const [motivo, setMotivo] = useState<MotivoDesqualificacao>("fora_icp");
  const [detalhe, setDetalhe] = useState("");

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Desqualificar lead"
      descricao="O motivo alimenta relatório depois: é ele que responde por que o funil perde no topo."
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label>
          <span>Motivo</span>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDesqualificacao)}>
            {MOTIVOS_DESQUALIFICACAO.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
          </select>
        </label>
        <label><span>Detalhe</span><textarea value={detalhe} onChange={(e) => setDetalhe(e.target.value)} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" data-variante="perigo" disabled={pendente}
            onClick={() => aoConfirmar(motivo, detalhe.trim() || null)}>
            Desqualificar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoOportunidade({ aberto, lead, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  lead: DetalheLead | null;
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (familias: Familia[], responsavelId: string, reuniao: { data: string } | null) => Promise<boolean>;
}) {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [responsavelId, setResponsavelId] = useState("");
  const [comReuniao, setComReuniao] = useState(false);
  const [dataReuniao, setDataReuniao] = useState("");

  function alternar(familia: Familia) {
    setFamilias((atual) => atual.includes(familia) ? atual.filter((f) => f !== familia) : [...atual, familia]);
  }

  const pronto = familias.length > 0 && Boolean(responsavelId) && (!comReuniao || Boolean(dataReuniao));

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Criar oportunidade"
      descricao={lead ? `${lead.empresa.nome} · ${lead.pessoa.nome}` : undefined}
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}

        <div>
          <span style={{ display: "block", marginBottom: "calc(6 * var(--onface-u))", color: "var(--text-muted, #666e7d)", fontSize: "calc(10.5 * var(--onface-u))", fontWeight: 700, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase" }}>
            Família comercial
          </span>
          <div className="ov-familias">
            {FAMILIAS.map((f) => (
              <button key={f} type="button" className="ov-familia" data-marcada={familias.includes(f)} onClick={() => alternar(f)}>
                {ROTULO_FAMILIA[f]}
              </button>
            ))}
          </div>
          <p className="ov-nota" style={{ marginTop: "calc(6 * var(--onface-u))" }}>
            {familias.length > 1
              ? `Serão criadas ${familias.length} oportunidades irmãs, uma por família, com fechamento independente e o mesmo bundle.`
              : "Cada oportunidade pertence a exatamente uma família. Marcar mais de uma cria oportunidades irmãs."}
          </p>
        </div>

        <label>
          <span>Responsável comercial</span>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Escolha o closer</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>

        <div>
          <span style={{ display: "block", marginBottom: "calc(6 * var(--onface-u))", color: "var(--text-muted, #666e7d)", fontSize: "calc(10.5 * var(--onface-u))", fontWeight: 700, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase" }}>
            Próximo passo
          </span>
          <div className="ov-familias">
            <button type="button" className="ov-familia" data-marcada={!comReuniao} onClick={() => setComReuniao(false)}>
              Apenas criar oportunidade
            </button>
            <button type="button" className="ov-familia" data-marcada={comReuniao} onClick={() => setComReuniao(true)}>
              Criar e agendar reunião
            </button>
          </div>
          <p className="ov-nota" style={{ marginTop: "calc(6 * var(--onface-u))" }}>
            Reunião não é requisito: a oportunidade entra no Pipeline com ou sem agenda.
          </p>
        </div>

        {comReuniao ? (
          <label>
            <span>Data e hora da reunião</span>
            <input type="datetime-local" value={dataReuniao} onChange={(e) => setDataReuniao(e.target.value)} />
          </label>
        ) : null}

        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !pronto}
            onClick={() => aoConfirmar(familias, responsavelId, comReuniao ? { data: dataReuniao } : null)}>
            <ArrowRight aria-hidden />
            {familias.length > 1 ? `Criar ${familias.length} oportunidades` : "Criar oportunidade"}
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoNovoLead({ aberto, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (entrada: EntradaNovoLead) => Promise<boolean>;
}) {
  const [form, setForm] = useState({
    empresa: "", cnpj: "", website: "", pessoaNome: "", cargo: "",
    email: "", telefone: "", origem: "", responsavelId: "",
  });
  const campo = (chave: keyof typeof form) => ({
    value: form[chave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [chave]: e.target.value })),
  });

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo lead"
      descricao="Empresa é obrigatória: em Pré-vendas o objeto de trabalho é a empresa, e a pessoa é o contato dela."
      largura="larga"
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-form-linha">
          <label><span>Empresa *</span><input {...campo("empresa")} /></label>
          <label><span>CNPJ</span><input {...campo("cnpj")} /></label>
          <label><span>Site</span><input {...campo("website")} placeholder="novatech.com.br" /></label>
          <label><span>Origem</span><input {...campo("origem")} placeholder="Indicação, Evento…" /></label>
          <label><span>Contato *</span><input {...campo("pessoaNome")} /></label>
          <label><span>Cargo</span><input {...campo("cargo")} /></label>
          <label><span>E-mail</span><input type="email" {...campo("email")} /></label>
          <label><span>Telefone</span><input {...campo("telefone")} /></label>
        </div>
        <label>
          <span>Responsável</span>
          <select {...campo("responsavelId")}>
            <option value="">Sem responsável</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <p className="ov-nota">
          Criar um lead não cria oportunidade. O handoff para o Pipeline é uma ação explícita, depois da qualificação.
        </p>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao"
            disabled={pendente || !form.empresa.trim() || !form.pessoaNome.trim()}
            onClick={() => aoConfirmar({
              empresa: form.empresa, cnpj: form.cnpj || null, website: form.website || null,
              pessoaNome: form.pessoaNome, cargo: form.cargo || null, email: form.email || null,
              telefone: form.telefone || null, origem: form.origem || null,
              responsavelId: form.responsavelId || null,
            })}>
            <UserPlus aria-hidden />Criar lead
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoAssociarEmpresa({ aberto, nomeSugerido, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  nomeSugerido: string;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (nome: string, cnpj: string | null) => Promise<boolean>;
}) {
  const [nome, setNome] = useState(nomeSugerido);
  const [cnpj, setCnpj] = useState("");

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Associar empresa"
      descricao="Se já existir uma empresa com este CNPJ, domínio ou nome, ela é reaproveitada em vez de duplicada."
    >
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label><span>Nome da empresa</span><input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label><span>CNPJ</span><input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !nome.trim()}
            onClick={() => aoConfirmar(nome.trim(), cnpj.trim() || null)}>
            Associar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

/* ── Rótulos ───────────────────────────────────────────────────────────── */

export function rotuloEvento(tipo: string): string {
  const mapa: Record<string, string> = {
    LeadCreated: "Lead criado",
    LeadAssigned: "Responsável definido",
    OwnerChanged: "Responsável alterado",
    FirstContactMade: "Primeiro contato",
    StageChanged: "Mudança de etapa",
    QualificationStarted: "Qualificação iniciada",
    LeadQualified: "Lead qualificado",
    LeadNurtured: "Movido para nutrição",
    LeadDisqualified: "Lead desqualificado",
    LeadReactivated: "Lead retomado",
    OpportunityCreated: "Oportunidade criada",
    OpportunityCreatedFromProspecting: "Oportunidade criada no outbound",
    OpportunityStageChanged: "Etapa da oportunidade",
    OpportunityFamilyChanged: "Família alterada",
    OpportunityStalled: "Oportunidade estagnada",
    OpportunityLost: "Oportunidade perdida",
    OpportunityWon: "Oportunidade ganha",
    NextActionSet: "Próxima ação definida",
    MeetingScheduled: "Reunião agendada",
    MeetingRescheduled: "Reunião remarcada",
    MeetingNoShow: "No-show",
    TrialStarted: "Trial iniciado",
    TrialEnded: "Trial encerrado",
    ProposalCreated: "Proposta criada",
    ProposalSent: "Proposta enviada",
    ProposalViewed: "Proposta visualizada",
    ProposalAccepted: "Proposta aceita",
    ProposalRejected: "Proposta recusada",
    ProposalExpired: "Proposta expirada",
    ProposalSuperseded: "Proposta substituída",
    ProposalAdjustmentRequested: "Ajuste solicitado",
    ContractSigned: "Contrato assinado",
    PaymentConfirmed: "Pagamento confirmado",
    ProspectAdded: "Prospect adicionado",
    ProspectImported: "Prospect importado",
    ProspectAssigned: "Prospect atribuído",
    CadenceEnrolled: "Entrou em cadência",
    CadencePaused: "Cadência pausada",
    ProspectReplied: "Prospect respondeu",
    ProspectPreQualified: "Pré-qualificado",
    ProspectNoResponse: "Sem resposta",
    ProspectDiscarded: "Prospect descartado",
    CompanyCreated: "Empresa criada",
    PersonCreated: "Pessoa criada",
    PersonLinkedToCompany: "Pessoa vinculada à empresa",
  };
  return mapa[tipo] ?? tipo;
}

export function rotuloAtor(tipo: string): string {
  switch (tipo) {
    case "AI_AGENT": return "Agente IA";
    case "AUTOMATION": return "Automação";
    case "SYSTEM": return "Sistema";
    default: return "Equipe";
  }
}
