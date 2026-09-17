"use client";

/**
 * Propostas (Bloco 03).
 *
 * Três regras da spec governam esta tela, e todas as três aparecem como
 * comportamento, não como texto:
 *
 *   1. O catálogo é filtrado pela família da oportunidade. Não existe tela que
 *      mostre produto de outra família.
 *   2. O modo de fechamento é escolhido ANTES do envio, porque muda o dado
 *      obrigatório e o gate de Won. Modo contrato sem dados jurídicos da
 *      empresa não envia.
 *   3. Proposta enviada não se edita: cria-se uma revisão, e a anterior vira
 *      substituída e deixa de poder ser aceita.
 *
 * E o aceite não é ganho: a tela diz o que ainda falta para fechar.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Plus, Send, Trash2 } from "lucide-react";
import {
  MODOS_FECHAMENTO, ROTULO_FAMILIA, ROTULO_MODO_FECHAMENTO, ROTULO_STATUS_PROPOSTA,
  STATUS_PROPOSTA, TIPOS_CONTRATUAIS, VALIDADES_PROPOSTA,
  type Familia, type ModoFechamento, type TipoContratual,
} from "@/lib/vendas/dominio";
import type { ItemCatalogo } from "@/lib/vendas/propostas";
import type { Resultado } from "@/lib/vendas/resultado";
import type { DetalheProposta, LinhaProposta } from "@/app/(onface-preview)/onface-preview/propostas/actions";
import {
  Abas, AvisoBloqueio, Busca, Campo, ComPainel, Dialogo, Painel, Secao, Tag,
  dataCurta, dataHora, moeda, moedaExata, useAcao,
} from "./ui";
import { rotuloAtor, rotuloEvento } from "./PreVendas";

export interface AcoesPropostas {
  detalhe: (id: string) => Promise<Resultado<DetalheProposta | null>>;
  catalogo: (familia: Familia) => Promise<ItemCatalogo[]>;
  oportunidadesAbertas: (termo: string) => Promise<Array<{ id: string; titulo: string; familia: string | null; empresa: string | null }>>;
  criar: (e: {
    negocioId: string;
    itens: Array<{ catalogoPrecoId: string; nome: string; tipo: "recorrente" | "avulso" | "setup"; quantidade: number; valorUnitario: number; desconto: number }>;
    observacoes?: string | null;
    prazoContratoMeses?: number | null;
    parcelasSetup?: number | null;
  }) => Promise<Resultado<{ propostaId: string }>>;
  enviar: (e: { propostaId: string; modoFechamento: ModoFechamento; validadeDias: number; tipoContratual?: TipoContratual | null }) => Promise<Resultado>;
  criarRevisao: (id: string) => Promise<Resultado<{ propostaId: string; versao: number }>>;
  expirarVencidas: () => Promise<Resultado<{ expiradas: number }>>;
}

export function Propostas({ linhas, filtro, oportunidadeInicial, propostaInicial, acoes }: {
  linhas: LinhaProposta[];
  filtro: { busca: string; status: string | null };
  oportunidadeInicial?: string | null;
  propostaInicial?: string | null;
  acoes: AcoesPropostas;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = useTransition();
  const [busca, setBusca] = useState(filtro.busca);
  const [selecionada, setSelecionada] = useState<string | null>(propostaInicial ?? null);
  const [detalhe, setDetalhe] = useState<DetalheProposta | null>(null);
  const [modal, setModal] = useState<null | "nova" | "enviar">(Boolean(oportunidadeInicial) ? "nova" : null);
  const { pendente, bloqueio, limparBloqueio, executar } = useAcao();

  function navegar(mudancas: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") url.searchParams.delete(chave);
      else url.searchParams.set(chave, valor);
    }
    iniciarNavegacao(() => router.push(`${url.pathname}${url.search}`));
  }

  async function abrir(id: string) {
    setSelecionada(id);
    limparBloqueio();
    setDetalhe(null);
    const r = await acoes.detalhe(id);
    if (r.ok) setDetalhe(r.dados ?? null);
  }

  async function rodar(fn: () => Promise<Resultado<unknown>>) {
    const ok = await executar(async () => (await fn()) as Resultado<unknown>);
    if (ok !== null) {
      setModal(null);
      if (selecionada) {
        const r = await acoes.detalhe(selecionada);
        if (r.ok) setDetalhe(r.dados ?? null);
      }
      router.refresh();
    }
    return ok !== null;
  }

  return (
    <>
      <div className="ov-controles">
        <Abas<string>
          ativa={filtro.status ?? "todas"}
          aoTrocar={(nova) => navegar({ status: nova === "todas" ? null : nova })}
          abas={[
            { chave: "todas", rotulo: "Todas" },
            { chave: "rascunho", rotulo: "Rascunho" },
            { chave: "enviada", rotulo: "Enviadas" },
            { chave: "ajuste_solicitado", rotulo: "Ajuste pedido" },
            { chave: "aceita", rotulo: "Aceitas" },
          ]}
        />
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar por número, empresa ou oportunidade" />
        <button type="button" className="ov-botao" data-variante="neutro" onClick={() => navegar({ busca })}>Buscar</button>
        <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
          onClick={() => rodar(() => acoes.expirarVencidas())}>
          Expirar vencidas
        </button>
        <button type="button" className="ov-botao" onClick={() => { limparBloqueio(); setModal("nova"); }}>
          <Plus aria-hidden />Nova proposta
        </button>
      </div>

      {bloqueio && !modal ? (
        <div style={{ marginBottom: "calc(14 * var(--onface-u))" }}><AvisoBloqueio bloqueio={bloqueio} /></div>
      ) : null}

      <ComPainel
        aberto={Boolean(selecionada)}
        painel={
          <PainelProposta
            proposta={detalhe}
            pendente={pendente}
            bloqueio={bloqueio}
            aoFechar={() => { setSelecionada(null); setDetalhe(null); limparBloqueio(); }}
            aoEnviar={() => setModal("enviar")}
            aoRevisar={() => rodar(async () => {
              const r = await acoes.criarRevisao(detalhe!.id);
              if (r.ok && r.dados) {
                setSelecionada(r.dados.propostaId);
                const d = await acoes.detalhe(r.dados.propostaId);
                if (d.ok) setDetalhe(d.dados ?? null);
              }
              return r;
            })}
          />
        }
      >
        <div className="ov-tabela-wrap">
          <table className="ov-tabela">
            <colgroup>
              <col style={{ width: "12%" }} /><col /><col style={{ width: "14%" }} />
              <col style={{ width: "13%" }} /><col style={{ width: "14%" }} /><col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Proposta</th><th>Empresa / oportunidade</th><th>Família</th>
                <th>Status</th><th className="ov-num">Valor</th><th>Validade</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr><td colSpan={6}><div className="ov-vazio"><strong>Nenhuma proposta</strong><p>Crie a primeira a partir de uma oportunidade aberta.</p></div></td></tr>
              ) : linhas.map((p) => (
                <tr key={p.id} data-selecionada={p.id === selecionada} onClick={() => abrir(p.id)}>
                  <td className="ov-tabela-principal">#{p.numero} <span className="ov-tabela-apoio">v{p.versao}</span></td>
                  <td>
                    <div className="ov-tabela-principal">{p.empresa ?? "—"}</div>
                    <div className="ov-tabela-apoio">{p.oportunidade ?? "Sem oportunidade vinculada"}</div>
                  </td>
                  <td className="ov-tabela-apoio">
                    {p.familia ? (ROTULO_FAMILIA[p.familia as keyof typeof ROTULO_FAMILIA] ?? p.familia) : "—"}
                  </td>
                  <td><Tag tom={tomDoStatus(p.status)}>{rotuloStatus(p.status)}</Tag></td>
                  <td className="ov-num">{moeda(p.total)}</td>
                  <td className="ov-tabela-apoio">{dataCurta(p.validade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ComPainel>

      <DialogoNovaProposta
        aberto={modal === "nova"}
        oportunidadeInicial={oportunidadeInicial ?? null}
        pendente={pendente}
        bloqueio={bloqueio}
        buscarOportunidades={acoes.oportunidadesAbertas}
        catalogo={acoes.catalogo}
        aoFechar={() => setModal(null)}
        aoConfirmar={async (e) => {
          const ok = await rodar(async () => {
            const r = await acoes.criar(e);
            if (r.ok && r.dados) { setSelecionada(r.dados.propostaId); const d = await acoes.detalhe(r.dados.propostaId); if (d.ok) setDetalhe(d.dados ?? null); }
            return r;
          });
          return ok;
        }}
      />

      <DialogoEnviar
        aberto={modal === "enviar"}
        proposta={detalhe}
        pendente={pendente}
        bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(modo, validade, tipoContratual) =>
          rodar(() => acoes.enviar({ propostaId: detalhe!.id, modoFechamento: modo, validadeDias: validade, tipoContratual }))}
      />
    </>
  );
}

/* ── Painel ────────────────────────────────────────────────────────────── */

function PainelProposta({ proposta, pendente, bloqueio, aoFechar, aoEnviar, aoRevisar }: {
  proposta: DetalheProposta | null;
  pendente: boolean;
  bloqueio: { mensagem: string; acao?: { rotulo: string; tipo: string } } | null;
  aoFechar: () => void;
  aoEnviar: () => void;
  aoRevisar: () => Promise<boolean>;
}) {
  if (!proposta) {
    return <Painel titulo="Carregando" aoFechar={aoFechar}><p className="ov-nota">Buscando a proposta…</p></Painel>;
  }

  const rascunho = proposta.status === "rascunho";
  const vigente = ["enviada", "visualizada", "ajuste_solicitado"].includes(proposta.status);
  const aceita = proposta.status === "aceita";

  return (
    <Painel
      titulo={`Proposta #${proposta.numero} · v${proposta.versao}`}
      subtitulo={proposta.empresa.nome ?? proposta.oportunidade.titulo}
      aoFechar={aoFechar}
    >
      <div className="ov-card-meta">
        <Tag tom={tomDoStatus(proposta.status)}>{rotuloStatus(proposta.status)}</Tag>
        {proposta.oportunidade.familia ? (
          <Tag>{ROTULO_FAMILIA[proposta.oportunidade.familia as keyof typeof ROTULO_FAMILIA] ?? proposta.oportunidade.familia}</Tag>
        ) : null}
        {proposta.modoFechamento ? <Tag tom="info">{ROTULO_MODO_FECHAMENTO[proposta.modoFechamento as ModoFechamento]}</Tag> : null}
      </div>

      {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}

      {aceita ? (
        <div className="ov-bloqueio" role="status">
          <FileText aria-hidden />
          <div>
            Proposta aceita. A oportunidade continua aberta até a evidência de fechamento:{" "}
            {proposta.modoFechamento === "CONTRACT" ? "contrato assinado" : "pagamento confirmado"}.
            Aceite não é ganho.
          </div>
        </div>
      ) : null}

      {proposta.tracking.ajusteDescricao ? (
        <Secao titulo="Ajuste pedido pelo cliente">
          <p className="ov-nota">{proposta.tracking.ajusteDescricao}</p>
          <p className="ov-nota">
            O pedido não altera esta proposta. Crie uma revisão: a versão atual vira substituída e não pode mais ser aceita.
          </p>
        </Secao>
      ) : null}

      <Secao titulo="Ações">
        <div className="ov-acoes">
          {rascunho ? (
            <button type="button" className="ov-botao" disabled={pendente} onClick={aoEnviar}>
              <Send aria-hidden />Enviar proposta
            </button>
          ) : null}
          {vigente || proposta.status === "recusada" || proposta.status === "expirada" ? (
            <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente} onClick={aoRevisar}>
              Criar revisão
            </button>
          ) : null}
          {proposta.oportunidade.id ? (
            <Link className="ov-botao" data-variante="contorno" href={`/onface-preview/pipeline?oportunidade=${proposta.oportunidade.id}`}>
              Abrir oportunidade
            </Link>
          ) : null}
        </div>
      </Secao>

      {/* Bloco 03 §5: recorrente e não recorrente separados. Somar os dois num
          total único engana, e a spec proíbe. */}
      <Secao titulo="Composição financeira">
        <div className="ov-composicao">
          <div className="ov-composicao-item">
            <dt>Recorrente / mês</dt>
            <dd>{moedaExata(proposta.composicao.recorrenteMensal)}</dd>
          </div>
          <div className="ov-composicao-item">
            <dt>Não recorrente</dt>
            <dd>{moedaExata(proposta.composicao.naoRecorrente)}</dd>
          </div>
          {proposta.composicao.tcv !== null ? (
            <div className="ov-composicao-item">
              <dt>Contratado ({proposta.composicao.prazoMeses} meses)</dt>
              <dd>{moedaExata(proposta.composicao.tcv)}</dd>
            </div>
          ) : null}
        </div>
        {proposta.composicao.tcv === null && proposta.composicao.recorrenteMensal > 0 ? (
          <p className="ov-nota">Sem prazo contratual definido, o valor total do contrato não é calculado.</p>
        ) : null}
      </Secao>

      <Secao titulo={`Itens (${proposta.itens.length})`}>
        <dl style={{ margin: 0 }}>
          {proposta.itens.map((i) => (
            <Campo key={i.id} rotulo={`${i.nome}${i.quantidade > 1 ? ` · ${i.quantidade}x` : ""}`}>
              {moedaExata(i.subtotal)}
            </Campo>
          ))}
        </dl>
      </Secao>

      <Secao titulo="Empresa">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Nome">{proposta.empresa.nome}</Campo>
          <Campo rotulo="Dados jurídicos">
            {proposta.empresa.dadosJuridicosCompletos ? "Completos" : `Falta: ${proposta.empresa.faltando.join(", ")}`}
          </Campo>
        </dl>
        {!proposta.empresa.dadosJuridicosCompletos && proposta.empresa.id ? (
          <Link className="ov-botao" data-variante="contorno" href={`/onface-preview/contatos?empresa=${proposta.empresa.id}`}>
            Completar dados da empresa
          </Link>
        ) : null}
      </Secao>

      <Secao titulo="Tracking">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Enviada">{dataHora(proposta.tracking.enviadaEm)}</Campo>
          <Campo rotulo="Primeira visualização">{dataHora(proposta.tracking.primeiraVisualizacao)}</Campo>
          <Campo rotulo="Validade">{dataCurta(proposta.dataValidade)}</Campo>
          <Campo rotulo="Aceita">{dataHora(proposta.tracking.aceitaEm)}</Campo>
          <Campo rotulo="Recusada">{dataHora(proposta.tracking.recusadaEm)}</Campo>
        </dl>
      </Secao>

      {proposta.timeline.length > 0 ? (
        <Secao titulo="Histórico">
          <div className="ov-timeline">
            {proposta.timeline.slice(0, 15).map((e) => (
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
        </Secao>
      ) : null}
    </Painel>
  );
}

/* ── Composer ──────────────────────────────────────────────────────────── */

interface ItemEscolhido {
  catalogoPrecoId: string;
  nome: string;
  tipo: "recorrente" | "avulso" | "setup";
  quantidade: number;
  valorUnitario: number;
  desconto: number;
}

function DialogoNovaProposta({ aberto, oportunidadeInicial, pendente, bloqueio, buscarOportunidades, catalogo, aoFechar, aoConfirmar }: {
  aberto: boolean;
  oportunidadeInicial: string | null;
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  buscarOportunidades: (t: string) => Promise<Array<{ id: string; titulo: string; familia: string | null; empresa: string | null }>>;
  catalogo: (familia: Familia) => Promise<ItemCatalogo[]>;
  aoFechar: () => void;
  aoConfirmar: (e: { negocioId: string; itens: ItemEscolhido[]; observacoes?: string | null; prazoContratoMeses?: number | null; parcelasSetup?: number | null }) => Promise<boolean>;
}) {
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<Array<{ id: string; titulo: string; familia: string | null; empresa: string | null }>>([]);
  const [oportunidade, setOportunidade] = useState<{ id: string; titulo: string; familia: string | null } | null>(null);
  const [itensCatalogo, setItensCatalogo] = useState<ItemCatalogo[]>([]);
  const [escolhidos, setEscolhidos] = useState<ItemEscolhido[]>([]);
  const [prazo, setPrazo] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [observacoes, setObservacoes] = useState("");
  const [carregado, setCarregado] = useState<string | null>(null);

  // Abrir vindo do Pipeline já traz a oportunidade escolhida.
  if (aberto && oportunidadeInicial && !oportunidade && carregado !== oportunidadeInicial) {
    setCarregado(oportunidadeInicial);
    void (async () => {
      const lista = await buscarOportunidades("");
      const achada = lista.find((o) => o.id === oportunidadeInicial);
      if (achada) {
        setOportunidade(achada);
        if (achada.familia) setItensCatalogo(await catalogo(achada.familia as Familia));
      }
    })();
  }

  async function escolherOportunidade(o: { id: string; titulo: string; familia: string | null }) {
    setOportunidade(o);
    setOpcoes([]);
    setEscolhidos([]);
    // Bloco 03 §2: o catálogo é o da família da oportunidade e de mais nenhuma.
    setItensCatalogo(o.familia ? await catalogo(o.familia as Familia) : []);
  }

  function adicionar(item: ItemCatalogo) {
    setEscolhidos((atual) => [...atual, {
      catalogoPrecoId: item.catalogoPrecoId,
      nome: `${item.nome}${item.variacao ? ` — ${item.variacao}` : ""}`,
      tipo: item.naturezaReceita === "MRR" ? "recorrente" : item.naturezaReceita === "SETUP" ? "setup" : "avulso",
      quantidade: 1,
      valorUnitario: Number(item.valor) || 0,
      desconto: 0,
    }]);
  }

  function atualizar(indice: number, mudanca: Partial<ItemEscolhido>) {
    setEscolhidos((atual) => atual.map((it, i) => i === indice ? { ...it, ...mudanca } : it));
  }

  const recorrente = escolhidos.filter((i) => i.tipo === "recorrente")
    .reduce((s, i) => s + i.quantidade * i.valorUnitario * (1 - i.desconto / 100), 0);
  const naoRecorrente = escolhidos.filter((i) => i.tipo !== "recorrente")
    .reduce((s, i) => s + i.quantidade * i.valorUnitario * (1 - i.desconto / 100), 0);
  const temSetup = escolhidos.some((i) => i.tipo === "setup");

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Nova proposta"
      descricao="O catálogo mostrado é o da família da oportunidade — e só ele." largura="larga">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}

        <label>
          <span>Oportunidade</span>
          <input value={oportunidade?.titulo ?? termo} placeholder="Buscar oportunidade aberta"
            onChange={async (e) => {
              setTermo(e.target.value); setOportunidade(null); setItensCatalogo([]); setEscolhidos([]);
              setOpcoes(await buscarOportunidades(e.target.value));
            }} />
        </label>
        {opcoes.length > 0 && !oportunidade ? (
          <div className="ov-familias">
            {opcoes.map((o) => (
              <button key={o.id} type="button" className="ov-familia" onClick={() => escolherOportunidade(o)}>
                {o.titulo}
              </button>
            ))}
          </div>
        ) : null}

        {oportunidade && !oportunidade.familia ? (
          <AvisoBloqueio bloqueio={{
            mensagem: "Esta oportunidade não tem família classificada, então não há catálogo para filtrar. Defina a família da oportunidade primeiro.",
          }} />
        ) : null}

        {oportunidade?.familia ? (
          <>
            <Secao titulo={`Catálogo ${ROTULO_FAMILIA[oportunidade.familia as keyof typeof ROTULO_FAMILIA] ?? oportunidade.familia}`}>
              {itensCatalogo.length === 0 ? (
                <p className="ov-nota">Nenhum item ativo no catálogo desta família.</p>
              ) : (
                <select className="ov-select"
                  onChange={(e) => {
                    const item = itensCatalogo.find((i) => i.catalogoPrecoId === e.target.value);
                    if (item) adicionar(item);
                    e.target.value = "";
                  }}
                  defaultValue=""
                  aria-label="Adicionar item do catálogo">
                  <option value="">Adicionar item…</option>
                  {itensCatalogo.map((i) => (
                    <option key={i.catalogoPrecoId} value={i.catalogoPrecoId}>
                      {i.nome}{i.variacao ? ` — ${i.variacao}` : ""} · {moeda(Number(i.valor))}
                    </option>
                  ))}
                </select>
              )}
            </Secao>

            {escolhidos.length > 0 ? (
              <div className="ov-tabela-wrap">
                <table className="ov-tabela">
                  <colgroup><col /><col style={{ width: "14%" }} /><col style={{ width: "18%" }} /><col style={{ width: "14%" }} /><col style={{ width: "10%" }} /></colgroup>
                  <thead>
                    <tr><th>Item</th><th className="ov-num">Qtd</th><th className="ov-num">Preço</th><th className="ov-num">Desc. %</th><th /></tr>
                  </thead>
                  <tbody>
                    {escolhidos.map((i, indice) => (
                      <tr key={`${i.catalogoPrecoId}-${indice}`}>
                        <td>
                          <div className="ov-tabela-principal">{i.nome}</div>
                          <div className="ov-tabela-apoio">{i.tipo === "recorrente" ? "Recorrente" : i.tipo === "setup" ? "Setup" : "Avulso"}</div>
                        </td>
                        <td><input type="number" min={1} value={i.quantidade}
                          onChange={(e) => atualizar(indice, { quantidade: Number(e.target.value) || 1 })} /></td>
                        <td><input type="number" min={0} step="0.01" value={i.valorUnitario}
                          onChange={(e) => atualizar(indice, { valorUnitario: Number(e.target.value) || 0 })} /></td>
                        <td><input type="number" min={0} max={100} value={i.desconto}
                          onChange={(e) => atualizar(indice, { desconto: Number(e.target.value) || 0 })} /></td>
                        <td>
                          <button type="button" className="ov-botao" data-variante="neutro"
                            onClick={() => setEscolhidos((a) => a.filter((_, x) => x !== indice))} aria-label="Remover item">
                            <Trash2 aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="ov-composicao">
              <div className="ov-composicao-item"><dt>Recorrente / mês</dt><dd>{moedaExata(recorrente)}</dd></div>
              <div className="ov-composicao-item"><dt>Não recorrente</dt><dd>{moedaExata(naoRecorrente)}</dd></div>
            </div>

            <div className="ov-form-linha">
              <label>
                <span>Prazo contratual (meses)</span>
                <input type="number" min={0} value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="12" />
              </label>
              {temSetup ? (
                <label>
                  <span>Setup em quantas parcelas</span>
                  <select value={parcelas} onChange={(e) => setParcelas(e.target.value)}>
                    {["1", "2", "3", "5", "6", "12"].map((p) => (
                      <option key={p} value={p}>{p === "1" ? "À vista" : `${p}x`}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <label><span>Observações</span><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></label>
          </>
        ) : null}

        <p className="ov-nota">
          A proposta nasce em rascunho. O modo de fechamento e a validade são escolhidos no envio, porque é o
          modo que define o dado obrigatório e o gate de ganho.
        </p>

        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !oportunidade || escolhidos.length === 0}
            onClick={() => aoConfirmar({
              negocioId: oportunidade!.id,
              itens: escolhidos,
              observacoes: observacoes.trim() || null,
              prazoContratoMeses: prazo ? Number(prazo) : null,
              parcelasSetup: temSetup ? Number(parcelas) : null,
            })}>
            Criar rascunho
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoEnviar({ aberto, proposta, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  proposta: DetalheProposta | null;
  pendente: boolean;
  bloqueio: { mensagem: string; acao?: { rotulo: string; tipo: string } } | null;
  aoFechar: () => void;
  aoConfirmar: (modo: ModoFechamento, validade: number, tipoContratual: TipoContratual | null) => Promise<boolean>;
}) {
  const [modo, setModo] = useState<ModoFechamento>("PREPAID");
  const [validade, setValidade] = useState(14);
  const [tipoContratual, setTipoContratual] = useState<TipoContratual>("NOVO_CONTRATO");

  const faltaJuridico = modo === "CONTRACT" && proposta ? !proposta.empresa.dadosJuridicosCompletos : false;

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Enviar proposta"
      descricao="O modo de fechamento precisa ser conhecido antes do envio: ele muda a regra, o dado obrigatório e o gate de ganho.">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}

        <div>
          <span style={{ display: "block", marginBottom: "calc(6 * var(--onface-u))", color: "var(--text-muted, #666e7d)", fontSize: "calc(10.5 * var(--onface-u))", fontWeight: 700, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase" }}>
            Modo de fechamento
          </span>
          <div className="ov-familias">
            {MODOS_FECHAMENTO.map((m) => (
              <button key={m} type="button" className="ov-familia" data-marcada={modo === m} onClick={() => setModo(m)}>
                {ROTULO_MODO_FECHAMENTO[m]}
              </button>
            ))}
          </div>
          <p className="ov-nota" style={{ marginTop: "calc(6 * var(--onface-u))" }}>
            {modo === "CONTRACT"
              ? "Com contrato, a oportunidade é ganha na assinatura. Cobrança em aberto depois disso não impede o ganho."
              : "No pré-pago, a oportunidade só é ganha com o pagamento confirmado."}
          </p>
        </div>

        {modo === "CONTRACT" ? (
          <>
            <label>
              <span>Tipo contratual</span>
              <select value={tipoContratual} onChange={(e) => setTipoContratual(e.target.value as TipoContratual)}>
                {TIPOS_CONTRATUAIS.map((t) => <option key={t} value={t}>{t.replace("_", " ").toLowerCase()}</option>)}
              </select>
            </label>
            {faltaJuridico ? (
              <AvisoBloqueio bloqueio={{
                mensagem: `Para seguir com uma proposta contratual, complete os dados jurídicos e de endereço da empresa. Falta: ${proposta?.empresa.faltando.join(", ")}.`,
              }} />
            ) : null}
          </>
        ) : null}

        <div>
          <span style={{ display: "block", marginBottom: "calc(6 * var(--onface-u))", color: "var(--text-muted, #666e7d)", fontSize: "calc(10.5 * var(--onface-u))", fontWeight: 700, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase" }}>
            Validade
          </span>
          <div className="ov-familias">
            {VALIDADES_PROPOSTA.map((v) => (
              <button key={v} type="button" className="ov-familia" data-marcada={validade === v} onClick={() => setValidade(v)}>
                {v} dias
              </button>
            ))}
          </div>
        </div>

        <p className="ov-nota">
          Ao enviar, a oportunidade avança para Proposta se estiver em Entrada ou Diagnóstico.
        </p>

        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || faltaJuridico}
            onClick={() => aoConfirmar(modo, validade, modo === "CONTRACT" ? tipoContratual : null)}>
            <Send aria-hidden />Enviar
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

/* ── Rótulos ───────────────────────────────────────────────────────────── */

function rotuloStatus(status: string): string {
  return (STATUS_PROPOSTA as readonly string[]).includes(status)
    ? ROTULO_STATUS_PROPOSTA[status as keyof typeof ROTULO_STATUS_PROPOSTA]
    : status;
}

function tomDoStatus(status: string): "coral" | "alerta" | "sucesso" | "info" | "neutro-escuro" | undefined {
  switch (status) {
    case "aceita": return "sucesso";
    case "enviada": case "visualizada": return "coral";
    case "ajuste_solicitado": return "alerta";
    case "recusada": case "expirada": case "substituida": return "neutro-escuro";
    default: return undefined;
  }
}
