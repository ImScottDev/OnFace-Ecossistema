"use client";

/**
 * Prospecção (Bloco 04).
 *
 * Workspace de outbound, não um segundo Pipeline. Duas visualizações da MESMA
 * base — lista para operar em massa, kanban para ler o estado — e duas saídas
 * que nunca se confundem:
 *
 *   Pré-qualificado    → cria Lead em Pré-vendas / Novo
 *   Oportunidade direta → cria Opportunity em Pipeline / Entrada
 *
 * A correção conceitual do bloco é justamente essa: ter oportunidade deixou de
 * significar que o prospect foi qualificado.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus, Send, Users } from "lucide-react";
import type { LinhaProspeccao } from "@/lib/vendas/consultas";
import {
  ESTADOS_PROSPECCAO, FAMILIAS, MOTIVOS_DESCARTE, ROTULO_ESTADO_PROSPECCAO, ROTULO_FAMILIA,
  type EstadoProspeccao, type Familia, type MotivoDescarte,
} from "@/lib/vendas/dominio";
import type { Resultado } from "@/lib/vendas/resultado";
import {
  Abas, AvisoBloqueio, Board, Busca, Coluna, ColunaVazia, Dialogo, Tag, dataCurta, useAcao,
} from "./ui";
import { acoesEmMassaDisponiveis } from "./prospeccao-acoes";

export interface AcoesProspeccao {
  adicionar: (e: EntradaProspect) => Promise<Resultado<{ leadId: string; jaExistia: boolean }>>;
  inscreverEmCadencia: (leadId: string, cadenciaId: string) => Promise<Resultado>;
  pausarCadencia: (leadId: string, motivo: string) => Promise<Resultado>;
  registrarResposta: (leadId: string, canal: string | null) => Promise<Resultado>;
  marcarSemResposta: (leadId: string) => Promise<Resultado>;
  preQualificar: (leadId: string) => Promise<Resultado>;
  oportunidadeDireta: (leadId: string, familias: Familia[], responsavelId: string) => Promise<Resultado<{ ids: string[] }>>;
  descartar: (leadId: string, motivo: MotivoDescarte) => Promise<Resultado>;
  atribuirEmMassa: (leadIds: string[], responsavelId: string | null) => Promise<Resultado<{ aplicados: number; falhas: number }>>;
}

export interface EntradaProspect {
  empresa: string;
  cnpj?: string | null;
  website?: string | null;
  pessoaNome?: string | null;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  fonte?: string | null;
  lista?: string | null;
  responsavelId?: string | null;
}

const COLUNAS_OPERACIONAIS: EstadoProspeccao[] = ["novo", "em_cadencia", "respondeu"];
type OperacaoMassa = "responsavel" | "lista" | "cadencia" | "tag" | "enriquecer" | "pausar";

export function Prospeccao({ dados, filtro, visao, cadencias, responsaveis, acoes }: {
  dados: {
    linhas: LinhaProspeccao[];
    resumo: Record<EstadoProspeccao, number>;
    filtros: { responsaveis: Array<{ id: string; nome: string }>; listas: string[] };
  };
  filtro: { busca: string; estado: EstadoProspeccao | null; responsavelId: string | null };
  visao: "lista" | "kanban";
  cadencias: Array<{ id: string; nome: string }>;
  responsaveis: Array<{ id: string; nome: string }>;
  acoes: AcoesProspeccao;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = useTransition();
  const [busca, setBusca] = useState(filtro.busca);
  const [lista, setLista] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [alvo, setAlvo] = useState<LinhaProspeccao | null>(null);
  const [modal, setModal] = useState<null | "novo" | "cadencia" | "oportunidade" | "descartar" | "massa">(null);
  const [operacaoMassa, setOperacaoMassa] = useState<OperacaoMassa | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const { pendente, bloqueio, limparBloqueio, executar } = useAcao();
  const linhas = lista ? dados.linhas.filter((linha) => linha.lista === lista) : dados.linhas;

  function navegar(mudancas: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") url.searchParams.delete(chave);
      else url.searchParams.set(chave, valor);
    }
    iniciarNavegacao(() => router.push(`${url.pathname}${url.search}`));
  }

  async function rodar(fn: () => Promise<Resultado<unknown>>, mensagem = "Alteração salva.") {
    let confirmou = false;
    await executar(async () => {
      const resultado = await fn();
      confirmou = resultado.ok;
      return resultado as Resultado<unknown>;
    });
    if (confirmou) {
      setModal(null);
      setAlvo(null);
      setSucesso(mensagem);
      router.refresh();
    }
    return confirmou;
  }

  async function resultadoApi(url: string, init: RequestInit): Promise<Resultado> {
    try {
      const resposta = await fetch(url, init);
      const corpo = await resposta.json().catch(() => ({}));
      return resposta.ok ? { ok: true } : { ok: false, erro: corpo.error ?? "A operação não pôde ser concluída." };
    } catch {
      return { ok: false, erro: "Não foi possível falar com o CRM. Tente novamente." };
    }
  }

  async function localizarOuCriarTag(nome: string): Promise<Resultado<{ id: string }>> {
    const existentes = await fetch("/api/labels");
    const tags = await existentes.json().catch(() => []);
    if (!existentes.ok || !Array.isArray(tags)) return { ok: false, erro: "Não foi possível carregar as tags." };
    const encontrada = tags.find((tag: { id: string; nome: string }) => tag.nome.toLowerCase() === nome.toLowerCase());
    if (encontrada) return { ok: true, dados: { id: encontrada.id } };
    const criada = await resultadoApi("/api/labels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, cor: "#2563EB" }),
    });
    if (!criada.ok) return criada;
    const nova = await fetch("/api/labels");
    const novasTags = await nova.json().catch(() => []);
    const criadaAgora = Array.isArray(novasTags) && novasTags.find((tag: { id: string; nome: string }) => tag.nome.toLowerCase() === nome.toLowerCase());
    return criadaAgora ? { ok: true, dados: { id: criadaAgora.id } } : { ok: false, erro: "A tag foi criada, mas não pôde ser localizada." };
  }

  async function adicionarTagEmMassa(nome: string): Promise<Resultado> {
    const tag = await localizarOuCriarTag(nome.trim());
    if (!tag.ok) return tag;
    const resultados = await Promise.all(selecionados.map((leadId) => resultadoApi(`/api/leads/${leadId}/labels`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labelId: tag.dados.id }),
    })));
    const falha = resultados.find((resultado) => !resultado.ok);
    return falha ?? { ok: true };
  }

  async function executarEmMassa(valor: string | null): Promise<Resultado> {
    if (!operacaoMassa) return { ok: false, erro: "Escolha uma ação em massa." };
    if (operacaoMassa === "responsavel") return acoes.atribuirEmMassa(selecionados, valor || null);
    if (operacaoMassa === "cadencia") {
      if (!valor) return { ok: false, erro: "Escolha a cadência." };
      const resultados = await Promise.all(selecionados.map((leadId) => acoes.inscreverEmCadencia(leadId, valor)));
      return resultados.find((resultado) => !resultado.ok) ?? { ok: true };
    }
    if (operacaoMassa === "pausar") {
      const resultados = await Promise.all(selecionados.map((leadId) => acoes.pausarCadencia(leadId, "Pausado em massa")));
      return resultados.find((resultado) => !resultado.ok) ?? { ok: true };
    }
    if (operacaoMassa === "enriquecer") return resultadoApi("/api/leads/enrich-bulk", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filter: "selected", ids: selecionados }),
    });
    if (!valor?.trim()) return { ok: false, erro: operacaoMassa === "lista" ? "Informe a lista." : "Informe a tag." };
    return adicionarTagEmMassa(valor);
  }

  function alternarSelecao(id: string) {
    setSelecionados((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
  }

  return (
    <>
      <div className="ov-controles">
        <Abas<"lista" | "kanban">
          ativa={visao}
          aoTrocar={(nova) => navegar({ visao: nova === "lista" ? null : nova })}
          abas={[{ chave: "lista", rotulo: "Lista" }, { chave: "kanban", rotulo: "Kanban" }]}
        />
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar empresa ou pessoa" />
        <button type="button" className="ov-botao" data-variante="neutro" onClick={() => navegar({ busca })}>Buscar</button>
        <select className="ov-select" value={filtro.estado ?? ""} aria-label="Filtrar por estado"
          onChange={(e) => navegar({ estado: e.target.value || null })}>
          <option value="">Todos os estados</option>
          {ESTADOS_PROSPECCAO.map((e) => (
            <option key={e} value={e}>{ROTULO_ESTADO_PROSPECCAO[e]} · {dados.resumo[e] ?? 0}</option>
          ))}
        </select>
        <select className="ov-select" value={filtro.responsavelId ?? ""} aria-label="Filtrar por responsável"
          onChange={(e) => navegar({ responsavel: e.target.value || null })}>
          <option value="">Todos os responsáveis</option>
          {dados.filtros.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <select className="ov-select" value={lista} aria-label="Filtrar por lista"
          onChange={(e) => { setLista(e.target.value); setSelecionados([]); }}>
          <option value="">Todas as listas</option>
          {dados.filtros.listas.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button type="button" className="ov-botao" onClick={() => { limparBloqueio(); setModal("novo"); }}>
          <Plus aria-hidden />Adicionar empresa
        </button>
      </div>

      {bloqueio && !modal ? (
        <div style={{ marginBottom: "calc(14 * var(--onface-u))" }}><AvisoBloqueio bloqueio={bloqueio} /></div>
      ) : null}
      {sucesso ? <p className="ov-nota" role="status">{sucesso}</p> : null}

      {selecionados.length > 0 ? (
        <div className="ov-controles" style={{ marginTop: "calc(-8 * var(--onface-u))" }}>
          <span className="ov-nota">{selecionados.length} selecionadas</span>
          {acoesEmMassaDisponiveis().map((acao) => (
            <button key={acao} type="button" className="ov-botao" data-variante="contorno"
              onClick={() => {
                const operacoes: Record<string, OperacaoMassa> = {
                  "Atribuir responsável": "responsavel", "Adicionar à lista": "lista",
                  "Adicionar à cadência": "cadencia", "Adicionar tag": "tag",
                  "Enriquecer": "enriquecer", "Pausar cadência": "pausar",
                };
                setOperacaoMassa(operacoes[acao]);
                setModal("massa");
              }}>
              {acao === "Atribuir responsável" ? <Users aria-hidden /> : null}{acao}
            </button>
          ))}
          <button type="button" className="ov-botao" data-variante="neutro" onClick={() => setSelecionados([])}>
            Limpar seleção
          </button>
        </div>
      ) : null}

      {visao === "kanban" ? (
        <Board>
          {COLUNAS_OPERACIONAIS.map((estado) => {
            const daColuna = linhas.filter((l) => l.estado === estado);
            return (
              <Coluna key={estado} titulo={ROTULO_ESTADO_PROSPECCAO[estado]}
                total={dados.resumo[estado] ?? 0} carregados={daColuna.length}>
                {daColuna.length === 0 ? (
                  <ColunaVazia>Nenhuma empresa neste estado.</ColunaVazia>
                ) : (
                  daColuna.map((l) => (
                    <button key={l.leadId} type="button" className="ov-card" onClick={() => setAlvo(l)}>
                      <span className="ov-card-empresa">{l.empresa}</span>
                      <span className="ov-card-pessoa">
                        {l.pessoa ? `${l.pessoa}${l.cargo ? ` · ${l.cargo}` : ""}` : "Sem pessoa associada"}
                      </span>
                      <span className="ov-card-meta">
                        {l.setor ? <Tag>{l.setor}</Tag> : null}
                        {l.lista ? <Tag tom="info">{l.lista}</Tag> : null}
                        {l.preQualificado ? <Tag tom="sucesso">Pré-qualificado</Tag> : null}
                      </span>
                      {l.cadencia ? (
                        <span className="ov-card-pessoa">
                          {l.cadencia}{l.totalPassos ? ` · ${l.totalPassos} passos` : ""}
                        </span>
                      ) : null}
                      <span className="ov-card-rodape">
                        <span>{l.responsavel ?? "Sem responsável"}</span>
                        <span>{dataCurta(l.proximaAcaoEm)}</span>
                      </span>
                    </button>
                  ))
                )}
              </Coluna>
            );
          })}
        </Board>
      ) : (
        <div className="ov-tabela-wrap">
          <table className="ov-tabela">
            <colgroup>
              <col style={{ width: "calc(28 * var(--onface-u))" }} />
              <col />
              <col style={{ width: "22%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr>
                <th><span className="sr-only">Selecionar</span></th>
                <th>Empresa</th>
                <th>Contato</th>
                <th>Estado</th>
                <th>Cadência</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr><td colSpan={6}><div className="ov-vazio"><strong>Nada por aqui</strong><p>Nenhuma empresa na base outbound com esses filtros.</p></div></td></tr>
              ) : linhas.map((l) => (
                <tr key={l.leadId} data-selecionada={alvo?.leadId === l.leadId} onClick={() => setAlvo(l)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selecionados.includes(l.leadId)}
                      onChange={() => alternarSelecao(l.leadId)} aria-label={`Selecionar ${l.empresa}`} />
                  </td>
                  <td>
                    <div className="ov-tabela-principal">{l.empresa}</div>
                    <div className="ov-tabela-apoio">
                      {[l.setor, l.porte, l.lista].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td>
                    <div>{l.pessoa ?? "—"}</div>
                    <div className="ov-tabela-apoio">{l.cargo ?? ""}</div>
                  </td>
                  <td>
                    <Tag tom={l.estado === "descartado" ? "neutro-escuro" : l.preQualificado ? "sucesso" : undefined}>
                      {l.estadoRotulo}
                    </Tag>
                  </td>
                  <td className="ov-tabela-apoio">{l.cadencia ?? "—"}</td>
                  <td className="ov-tabela-apoio">{l.responsavel ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ações do prospect escolhido. Ficam num diálogo em vez de um painel
          porque a lista precisa da largura inteira para operar em massa. */}
      <Dialogo aberto={Boolean(alvo) && !modal} aoFechar={() => { setAlvo(null); limparBloqueio(); }}
        titulo={alvo?.empresa ?? ""}
        descricao={alvo?.pessoa ? `${alvo.pessoa}${alvo.cargo ? ` · ${alvo.cargo}` : ""}` : "Sem pessoa associada"}>
        <div className="ov-form">
          {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
          <div className="ov-card-meta">
            <Tag tom="coral">{alvo?.estadoRotulo}</Tag>
            {alvo?.lista ? <Tag tom="info">{alvo.lista}</Tag> : null}
            {alvo?.preQualificado ? <Tag tom="sucesso">Pré-qualificado</Tag> : null}
          </div>

          <p className="ov-nota">
            Pré-qualificar entrega a empresa para a jornada de Pré-vendas, na etapa Novo.
            Criar oportunidade vai direto ao Pipeline e registra a origem como prospecção direta.
            São caminhos diferentes, e o sistema não finge que um é o outro.
          </p>

          <div className="ov-acoes">
            <button type="button" className="ov-botao" disabled={pendente}
              onClick={() => rodar(() => acoes.preQualificar(alvo!.leadId))}>
              <Send aria-hidden />Pré-qualificar
            </button>
            <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
              onClick={() => setModal("oportunidade")}>
              Criar oportunidade
            </button>
            {cadencias.length > 0 ? (
              <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
                onClick={() => setModal("cadencia")}>
                Adicionar à cadência
              </button>
            ) : null}
            {alvo?.estado === "em_cadencia" ? (
              <>
                <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
                  onClick={() => rodar(() => acoes.registrarResposta(alvo.leadId, null))}>
                  Registrar resposta
                </button>
                <button type="button" className="ov-botao" data-variante="neutro" disabled={pendente}
                  onClick={() => rodar(() => acoes.pausarCadencia(alvo.leadId, "Pausado manualmente"))}>
                  Pausar cadência
                </button>
              </>
            ) : null}
            <button type="button" className="ov-botao" data-variante="neutro" disabled={pendente}
              onClick={() => rodar(() => acoes.marcarSemResposta(alvo!.leadId))}>
              Sem resposta
            </button>
            <button type="button" className="ov-botao" data-variante="perigo" disabled={pendente}
              onClick={() => setModal("descartar")}>
              Descartar
            </button>
          </div>
        </div>
      </Dialogo>

      <DialogoNovoProspect
        aberto={modal === "novo"} listas={dados.filtros.listas} responsaveis={responsaveis}
        pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(e) => rodar(() => acoes.adicionar(e))}
      />

      <Dialogo aberto={modal === "cadencia"} aoFechar={() => setModal(null)} titulo="Adicionar à cadência"
        descricao="A Prospecção consome o motor de cadências; a configuração dos passos vive em Automações.">
        <div className="ov-form">
          {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
          <div className="ov-familias">
            {cadencias.map((c) => (
              <button key={c.id} type="button" className="ov-familia" disabled={pendente}
                onClick={() => rodar(() => acoes.inscreverEmCadencia(alvo!.leadId, c.id))}>
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      </Dialogo>

      <DialogoOportunidadeDireta
        aberto={modal === "oportunidade"} responsaveis={responsaveis}
        pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(familias, responsavelId) => rodar(() => acoes.oportunidadeDireta(alvo!.leadId, familias, responsavelId))}
      />

      <Dialogo aberto={modal === "descartar"} aoFechar={() => setModal(null)} titulo="Descartar prospect"
        descricao="Em Prospecção é descarte, não desqualificação: nem todo prospect descartado passou por qualificação comercial formal.">
        <div className="ov-form">
          {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
          <div className="ov-familias">
            {MOTIVOS_DESCARTE.map((m) => (
              <button key={m.chave} type="button" className="ov-familia" disabled={pendente}
                onClick={() => rodar(() => acoes.descartar(alvo!.leadId, m.chave))}>
                {m.rotulo}
              </button>
            ))}
          </div>
        </div>
      </Dialogo>

      <DialogoMassa
        aberto={modal === "massa"} quantidade={selecionados.length} operacao={operacaoMassa} responsaveis={responsaveis}
        listas={dados.filtros.listas} cadencias={cadencias}
        pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => { setModal(null); setOperacaoMassa(null); }}
        aoConfirmar={async (valor) => {
          const rotulo = operacaoMassa === "enriquecer" ? "Enriquecimento enfileirado." : "Ação em massa aplicada.";
          const ok = await rodar(() => executarEmMassa(valor), rotulo);
          if (ok) setSelecionados([]);
          return ok;
        }}
      />
    </>
  );
}

function DialogoNovoProspect({ aberto, listas, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  listas: string[];
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (e: EntradaProspect) => Promise<boolean>;
}) {
  const [form, setForm] = useState<EntradaProspect>({ empresa: "" });
  const campo = (chave: keyof EntradaProspect) => ({
    value: (form[chave] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [chave]: e.target.value })),
  });

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Adicionar empresa ao outbound"
      descricao="Empresa já existente é reaproveitada, não duplicada. Pessoa é opcional: em outbound, enriquecer depois é parte do processo."
      largura="larga">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-form-linha">
          <label><span>Empresa *</span><input {...campo("empresa")} /></label>
          <label><span>CNPJ</span><input {...campo("cnpj")} /></label>
          <label><span>Site</span><input {...campo("website")} /></label>
          <label><span>Fonte</span><input {...campo("fonte")} placeholder="Apollo, CSV, manual…" /></label>
          <label><span>Contato</span><input {...campo("pessoaNome")} /></label>
          <label><span>Cargo</span><input {...campo("cargo")} /></label>
          <label><span>E-mail</span><input type="email" {...campo("email")} /></label>
          <label><span>Telefone</span><input {...campo("telefone")} /></label>
          <label>
            <span>Lista</span>
            <input list="listas-prospeccao" {...campo("lista")} />
            <datalist id="listas-prospeccao">
              {listas.map((l) => <option key={l} value={l} />)}
            </datalist>
          </label>
          <label>
            <span>Responsável</span>
            <select {...campo("responsavelId")}>
              <option value="">Sem responsável</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !form.empresa.trim()}
            onClick={() => aoConfirmar(form)}>Adicionar</button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoOportunidadeDireta({ aberto, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (familias: Familia[], responsavelId: string) => Promise<boolean>;
}) {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [responsavelId, setResponsavelId] = useState("");

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Oportunidade direta"
      descricao="Vai direto para o Pipeline, sem criar Lead de Pré-vendas. A origem fica registrada como prospecção direta.">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-familias">
          {FAMILIAS.map((f) => (
            <button key={f} type="button" className="ov-familia" data-marcada={familias.includes(f)}
              onClick={() => setFamilias((a) => a.includes(f) ? a.filter((x) => x !== f) : [...a, f])}>
              {ROTULO_FAMILIA[f]}
            </button>
          ))}
        </div>
        {familias.length > 1 ? (
          <p className="ov-nota">{familias.length} oportunidades irmãs, mesmo bundle, fechamento independente.</p>
        ) : null}
        <label>
          <span>Responsável comercial</span>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Escolha</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || familias.length === 0 || !responsavelId}
            onClick={() => aoConfirmar(familias, responsavelId)}>Criar oportunidade</button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoMassa({ aberto, quantidade, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  quantidade: number;
  responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (responsavelId: string | null) => Promise<boolean>;
}) {
  const [responsavelId, setResponsavelId] = useState("");
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo={`Atribuir ${quantidade} empresas`}
      descricao="Cada atribuição registra seu próprio evento: uma ação em massa não apaga o histórico individual.">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label>
          <span>Responsável</span>
          <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
            <option value="">Sem responsável</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente}
            onClick={() => aoConfirmar(responsavelId || null)}>Aplicar</button>
        </div>
      </div>
    </Dialogo>
  );
}

/** Ícones reexportados para a página, que monta o cabeçalho. */
export const IconesProspeccao = { List, LayoutGrid };
