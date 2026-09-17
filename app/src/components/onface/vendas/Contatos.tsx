"use client";

/**
 * Contatos & Empresas (Bloco 05).
 *
 * Não é um funil: é o diretório relacional do ONFACE. Duas abas sobre a mesma
 * identidade, e uma regra que governa a tela inteira: o relacionamento da
 * empresa é DERIVADO dos processos reais, nunca um status que alguém troca à
 * mão. Por isso a coluna "Relação" não é editável em lugar nenhum.
 *
 * Criar Empresa não cria Lead. Criar Pessoa não cria Lead. As duas coisas são
 * ações explícitas e separadas, como a spec exige.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Plus, UserPlus } from "lucide-react";
import type { Empresa360, LinhaEmpresa, LinhaPessoa } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import {
  FAMILIAS, PAPEIS_PESSOA, ROTULO_FAMILIA,
  type Familia, type PapelPessoa, type RelacionamentoEmpresa,
} from "@/lib/vendas/dominio";
import type { DadosJuridicos } from "@/lib/vendas/propostas";
import type { Resultado } from "@/lib/vendas/resultado";
import {
  Abas, AvisoBloqueio, Busca, Campo, ComPainel, Dialogo, Painel, Secao, Tag,
  dataCurta, dataHora, moeda, useAcao,
} from "./ui";
import { rotuloAtor, rotuloEvento } from "./PreVendas";
import { DialogoJuridicos } from "./juridicos";

type Aba = "empresas" | "pessoas";

export interface AcoesContatos {
  criarEmpresa: (e: { nome: string; cnpj?: string | null; website?: string | null; setor?: string | null; cidade?: string | null }) => Promise<Resultado<{ empresaId: string; jaExistia: boolean; resolvidaPor: string | null }>>;
  criarPessoa: (e: { nome: string; sobrenome?: string | null; cargo?: string | null; email?: string | null; telefone?: string | null; empresaId?: string | null; papel?: PapelPessoa }) => Promise<Resultado<{ pessoaId: string; jaExistia: boolean }>>;
  vincularPessoa: (e: { pessoaId: string; empresaId: string; papel: PapelPessoa; principal: boolean; trocaDeEmpresa: boolean }) => Promise<Resultado>;
  criarLeadDaEmpresa: (e: { empresaId: string; pessoaNome: string; cargo?: string | null; email?: string | null; responsavelId?: string | null }) => Promise<Resultado<{ leadId: string }>>;
  novaOportunidade: (e: { empresaId: string; familias: Familia[]; responsavelId: string; expansao: boolean }) => Promise<Resultado<{ ids: string[] }>>;
  salvarDadosJuridicos: (empresaId: string, dados: DadosJuridicos) => Promise<Resultado<{ completo: boolean; faltando: string[] }>>;
  empresa360: (empresaId: string) => Promise<Resultado<{ empresa: Empresa360 | null; timeline: LinhaDoTempo[] }>>;
  buscarEmpresas: (termo: string) => Promise<Array<{ id: string; nome: string; apoio: string | null }>>;
}

const RELACIONAMENTOS_FILTRO: Array<{ chave: RelacionamentoEmpresa | ""; rotulo: string }> = [
  { chave: "", rotulo: "Todas as relações" },
  { chave: "cliente", rotulo: "Cliente" },
  { chave: "em_oportunidade", rotulo: "Em oportunidade" },
  { chave: "em_pre_vendas", rotulo: "Em Pré-vendas" },
  { chave: "ex_cliente", rotulo: "Ex-cliente" },
  { chave: "cadastrada", rotulo: "Cadastrada" },
];

export function Contatos({ aba, empresas, pessoas, filtro, responsaveis, selecaoInicial, pessoaInicial, rotaBase, acoes }: {
  aba: Aba;
  empresas: { linhas: LinhaEmpresa[]; total: number; porRelacionamento: Record<string, number> };
  pessoas: LinhaPessoa[];
  filtro: { busca: string; relacionamento: string | null; semEmpresa: boolean };
  responsaveis: Array<{ id: string; nome: string }>;
  selecaoInicial?: string | null;
  pessoaInicial?: string | null;
  rotaBase: "/onface-desenho" | "/onface-preview";
  acoes: AcoesContatos;
}) {
  const router = useRouter();
  const [, iniciarNavegacao] = useTransition();
  const [busca, setBusca] = useState(filtro.busca);
  const [selecionada, setSelecionada] = useState<string | null>(selecaoInicial ?? null);
  const [detalhe, setDetalhe] = useState<{ empresa: Empresa360 | null; timeline: LinhaDoTempo[] } | null>(null);
  const [pessoaAlvo, setPessoaAlvo] = useState<LinhaPessoa | null>(null);
  const [modal, setModal] = useState<null | "empresa" | "pessoa" | "lead" | "oportunidade" | "juridicos" | "vincular">(null);
  const { pendente, bloqueio, limparBloqueio, executar } = useAcao();

  function navegar(mudancas: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null || valor === "") url.searchParams.delete(chave);
      else url.searchParams.set(chave, valor);
    }
    iniciarNavegacao(() => router.push(`${url.pathname}${url.search}`));
  }

  async function abrirEmpresa(id: string) {
    setSelecionada(id);
    limparBloqueio();
    setDetalhe(null);
    const r = await acoes.empresa360(id);
    if (r.ok && r.dados) setDetalhe(r.dados);
  }

  // As ações "Gerenciar" voltam pela URL. A seleção precisa buscar o detalhe
  // depois do mount, senão o painel abre sem conteúdo.
  useEffect(() => {
    if (!selecaoInicial) return;
    let ativa = true;
    setSelecionada(selecaoInicial);
    setDetalhe(null);
    void acoes.empresa360(selecaoInicial).then((resultado) => {
      if (ativa && resultado.ok && resultado.dados) setDetalhe(resultado.dados);
    });
    return () => { ativa = false; };
  }, [selecaoInicial]);

  // Vínculo é uma ação explícita. Só a query `pessoa` abre este diálogo;
  // clicar em uma linha continua levando à página completa da pessoa.
  useEffect(() => {
    if (!pessoaInicial) return;
    const pessoa = pessoas.find((item) => item.id === pessoaInicial);
    if (!pessoa) return;
    setPessoaAlvo(pessoa);
    setModal("vincular");
  }, [pessoaInicial, pessoas]);

  async function rodar(fn: () => Promise<Resultado<unknown>>) {
    const ok = await executar(async () => (await fn()) as Resultado<unknown>);
    if (ok !== null) {
      setModal(null);
      if (selecionada) {
        const r = await acoes.empresa360(selecionada);
        if (r.ok && r.dados) setDetalhe(r.dados);
      }
      router.refresh();
    }
    return ok !== null;
  }

  const empresa = detalhe?.empresa ?? null;

  return (
    <>
      <div className="ov-controles">
        <Abas<Aba>
          ativa={aba}
          aoTrocar={(nova) => navegar({ aba: nova === "empresas" ? null : nova })}
          abas={[
            { chave: "empresas", rotulo: "Empresas", contagem: empresas.total },
            { chave: "pessoas", rotulo: "Pessoas" },
          ]}
        />
        <Busca valor={busca} aoMudar={setBusca}
          placeholder="Buscar por nome, CNPJ, domínio, e-mail ou telefone" />
        <button type="button" className="ov-botao" data-variante="neutro" onClick={() => navegar({ busca })}>Buscar</button>

        {aba === "empresas" ? (
          <select className="ov-select" value={filtro.relacionamento ?? ""} aria-label="Filtrar por relação"
            onChange={(e) => navegar({ relacao: e.target.value || null })}>
            {RELACIONAMENTOS_FILTRO.map((r) => <option key={r.chave} value={r.chave}>{r.rotulo}</option>)}
          </select>
        ) : (
          <label className="ov-nota" style={{ display: "inline-flex", alignItems: "center", gap: "calc(6 * var(--onface-u))" }}>
            <input type="checkbox" checked={filtro.semEmpresa}
              onChange={(e) => navegar({ semEmpresa: e.target.checked ? "1" : null })} />
            Só pessoas sem empresa
          </label>
        )}

        <button type="button" className="ov-botao" onClick={() => { limparBloqueio(); setModal(aba === "empresas" ? "empresa" : "pessoa"); }}>
          <Plus aria-hidden />{aba === "empresas" ? "Nova empresa" : "Nova pessoa"}
        </button>
      </div>

      {bloqueio && !modal ? (
        <div style={{ marginBottom: "calc(14 * var(--onface-u))" }}><AvisoBloqueio bloqueio={bloqueio} /></div>
      ) : null}

      <ComPainel
        aberto={aba === "empresas" && Boolean(selecionada)}
        painel={
          <PainelEmpresa
            empresa={empresa}
            timeline={detalhe?.timeline ?? []}
            pendente={pendente}
            bloqueio={bloqueio}
            rotaBase={rotaBase}
            aoFechar={() => { setSelecionada(null); setDetalhe(null); limparBloqueio(); }}
            aoAbrirModal={setModal}
          />
        }
      >
        {aba === "empresas" ? (
          <div className="ov-tabela-wrap">
            <table className="ov-tabela">
              <colgroup>
                <col />
                <col style={{ width: "16%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Empresa</th><th>Relação</th><th className="ov-num">Pessoas</th>
                  <th className="ov-num">Oportunidades</th><th className="ov-num">Serviços</th><th>Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {empresas.linhas.length === 0 ? (
                  <tr><td colSpan={6}><div className="ov-vazio"><strong>Nada encontrado</strong><p>Nenhuma empresa com esses filtros.</p></div></td></tr>
                ) : empresas.linhas.map((e) => (
                  <tr key={e.id} data-selecionada={e.id === selecionada} onClick={() => abrirEmpresa(e.id)}>
                    <td>
                      <div className="ov-tabela-principal">{e.nome}</div>
                      <div className="ov-tabela-apoio">{[e.setor, e.cidade, e.cnpj].filter(Boolean).join(" · ") || "—"}</div>
                    </td>
                    <td>
                      <Tag tom={
                        e.relacionamento === "cliente" ? "sucesso"
                        : e.relacionamento === "em_oportunidade" ? "coral"
                        : e.relacionamento === "ex_cliente" ? "neutro-escuro" : undefined
                      }>{e.relacionamentoRotulo}</Tag>
                    </td>
                    <td className="ov-num">{e.pessoas}</td>
                    <td className="ov-num">{e.oportunidadesAbertas}</td>
                    <td className="ov-num">{e.servicosAtivos}</td>
                    <td className="ov-tabela-apoio">{dataCurta(e.ultimaAtividade)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ov-tabela-wrap">
            <table className="ov-tabela">
              <colgroup><col /><col style={{ width: "20%" }} /><col style={{ width: "24%" }} /><col style={{ width: "18%" }} /></colgroup>
              <thead>
                <tr><th>Pessoa</th><th>Cargo</th><th>Contato</th><th>Empresa</th></tr>
              </thead>
              <tbody>
                {pessoas.length === 0 ? (
                  <tr><td colSpan={4}><div className="ov-vazio"><strong>Nada encontrado</strong><p>Nenhuma pessoa com esses filtros.</p></div></td></tr>
                ) : pessoas.map((p) => (
                  <tr key={`${p.fonte}-${p.id}`} onClick={() => router.push(`${rotaBase}/contatos/pessoas/${p.id}`)}>
                    <td className="ov-tabela-principal">{p.nome}</td>
                    <td className="ov-tabela-apoio">{p.cargo ?? "—"}</td>
                    <td className="ov-tabela-apoio">{p.email ?? p.telefone ?? p.whatsapp ?? "—"}</td>
                    <td>
                      {p.empresa
                        ? <span className="ov-tabela-apoio">{p.empresa}</span>
                        : <Tag tom="alerta">Sem empresa</Tag>}
                      <button type="button" className="ov-botao" data-variante="neutro"
                        onClick={(evento) => { evento.stopPropagation(); setPessoaAlvo(p); setModal("vincular"); }}>
                        Vincular
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ComPainel>

      <DialogoNovaEmpresa aberto={modal === "empresa"} pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)} aoConfirmar={(e) => rodar(() => acoes.criarEmpresa(e))} />

      <DialogoNovaPessoa aberto={modal === "pessoa"} pendente={pendente} bloqueio={bloqueio}
        buscarEmpresas={acoes.buscarEmpresas}
        aoFechar={() => setModal(null)} aoConfirmar={(e) => rodar(() => acoes.criarPessoa(e))} />

      <DialogoVincular aberto={modal === "vincular"} pessoa={pessoaAlvo} pendente={pendente} bloqueio={bloqueio}
        buscarEmpresas={acoes.buscarEmpresas}
        aoFechar={() => { setModal(null); setPessoaAlvo(null); }}
        aoConfirmar={(empresaId, papel, troca) =>
          rodar(() => acoes.vincularPessoa({ pessoaId: pessoaAlvo!.id, empresaId, papel, principal: papel === "contato_principal", trocaDeEmpresa: troca }))} />

      <DialogoNovoLead aberto={modal === "lead"} empresa={empresa} responsaveis={responsaveis}
        pendente={pendente} bloqueio={bloqueio} aoFechar={() => setModal(null)}
        aoConfirmar={(e) => rodar(() => acoes.criarLeadDaEmpresa({ ...e, empresaId: empresa!.id }))} />

      <DialogoNovaOportunidade aberto={modal === "oportunidade"} empresa={empresa} responsaveis={responsaveis}
        pendente={pendente} bloqueio={bloqueio} aoFechar={() => setModal(null)}
        aoConfirmar={(familias, responsavelId) =>
          rodar(() => acoes.novaOportunidade({
            empresaId: empresa!.id, familias, responsavelId,
            expansao: empresa!.relacionamento === "cliente",
          }))} />

      <DialogoJuridicos
        aberto={modal === "juridicos"}
        iniciais={empresa ? {
          empresaId: empresa.id, razaoSocial: empresa.razaoSocial, cnpj: empresa.cnpj,
          logradouro: empresa.endereco.logradouro, numero: empresa.endereco.numero,
          complemento: empresa.endereco.complemento, bairro: empresa.endereco.bairro,
          cidade: empresa.cidade, estado: empresa.estado, cep: empresa.endereco.cep,
        } : null}
        faltando={empresa?.dadosJuridicosFaltando}
        pendente={pendente} bloqueio={bloqueio}
        aoFechar={() => setModal(null)}
        aoConfirmar={(dados) => rodar(() => acoes.salvarDadosJuridicos(empresa!.id, dados))} />
    </>
  );
}

/* ── Painel Empresa 360 ────────────────────────────────────────────────── */

function PainelEmpresa({ empresa, timeline, pendente, bloqueio, rotaBase, aoFechar, aoAbrirModal }: {
  empresa: Empresa360 | null;
  timeline: LinhaDoTempo[];
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  rotaBase: "/onface-desenho" | "/onface-preview";
  aoFechar: () => void;
  aoAbrirModal: (m: "lead" | "oportunidade" | "juridicos") => void;
}) {
  if (!empresa) {
    return <Painel titulo="Carregando" aoFechar={aoFechar}><p className="ov-nota">Buscando a empresa…</p></Painel>;
  }

  return (
    <Painel titulo={empresa.nome}
      subtitulo={[empresa.setor, empresa.porte, empresa.cidade].filter(Boolean).join(" · ") || null}
      aoFechar={aoFechar}>
      <div className="ov-card-meta">
        <Tag tom={empresa.relacionamento === "cliente" ? "sucesso" : "coral"}>{empresa.relacionamentoRotulo}</Tag>
        {empresa.dadosJuridicosCompletos ? null : <Tag tom="alerta">Dados jurídicos incompletos</Tag>}
      </div>

      {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}

      <Secao titulo="Ações">
        <div className="ov-acoes">
          <Link className="ov-botao" data-variante="contorno" href={`${rotaBase}/contatos/empresas/${empresa.id}`}>
            Abrir empresa
          </Link>
          <button type="button" className="ov-botao" disabled={pendente} onClick={() => aoAbrirModal("oportunidade")}>
            Nova oportunidade
          </button>
          <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
            onClick={() => aoAbrirModal("lead")}>Criar lead</button>
          <button type="button" className="ov-botao" data-variante="contorno" disabled={pendente}
            onClick={() => aoAbrirModal("juridicos")}>
            {empresa.dadosJuridicosCompletos ? "Editar dados jurídicos" : "Completar dados jurídicos"}
          </button>
          {empresa.relacionamento === "cliente" ? (
            <Link className="ov-botao" data-variante="contorno" href={`/clientes/${empresa.id}`}>
              <Building2 aria-hidden />Abrir Cliente 360
            </Link>
          ) : null}
        </div>
        <p className="ov-nota">
          Criar empresa não cria lead, e criar lead não cria oportunidade. Cada passo é uma decisão comercial.
        </p>
      </Secao>

      <Secao titulo="Cadastro">
        <dl style={{ margin: 0 }}>
          <Campo rotulo="Razão social">{empresa.razaoSocial}</Campo>
          <Campo rotulo="CNPJ">{empresa.cnpj}</Campo>
          <Campo rotulo="Domínio">{empresa.dominio}</Campo>
          <Campo rotulo="Endereço">
            {[empresa.endereco.logradouro, empresa.endereco.numero, empresa.endereco.bairro]
              .filter(Boolean).join(", ") || null}
          </Campo>
          <Campo rotulo="Cidade / UF">{[empresa.cidade, empresa.estado].filter(Boolean).join(" / ") || null}</Campo>
          <Campo rotulo="CEP">{empresa.endereco.cep}</Campo>
        </dl>
      </Secao>

      <Secao titulo={`Pessoas (${empresa.pessoas.length})`}>
        {empresa.pessoas.length === 0 ? (
          <p className="ov-nota">Nenhuma pessoa associada. Uma empresa pode existir sem pessoas — é comum em outbound.</p>
        ) : (
          <dl style={{ margin: 0 }}>
            {empresa.pessoas.map((p) => (
              <Campo key={`${p.fonte}-${p.id}`} rotulo={p.nome}>
                {[p.cargo, p.papel].filter(Boolean).join(" · ") || p.email || "—"}
              </Campo>
            ))}
          </dl>
        )}
      </Secao>

      {empresa.leads.length > 0 ? (
        <Secao titulo="Pré-vendas">
          {empresa.leads.map((l) => (
            <Link key={l.id} className="ov-botao" data-variante="contorno" href={`${rotaBase}/pre-vendas?busca=${encodeURIComponent(empresa.nome)}`}>
              {l.etapaRotulo} · {l.origem ?? "sem origem"} · {dataCurta(l.criadoEm)}
            </Link>
          ))}
        </Secao>
      ) : null}

      {empresa.oportunidades.length > 0 ? (
        <Secao titulo="Oportunidades">
          {empresa.oportunidades.map((o) => (
            <Link key={o.id} className="ov-botao" data-variante="contorno" href={`${rotaBase}/pipeline?oportunidade=${o.id}`}>
              {o.titulo} · {o.etapaRotulo} · {moeda(o.valor)}
            </Link>
          ))}
        </Secao>
      ) : null}

      {empresa.propostas.length > 0 ? (
        <Secao titulo="Propostas">
          {empresa.propostas.map((p) => (
            <Link key={p.id} className="ov-botao" data-variante="contorno" href={`${rotaBase}/propostas?proposta=${p.id}`}>
              #{p.numero} v{p.versao} · {p.status} · {moeda(p.total)}
            </Link>
          ))}
        </Secao>
      ) : null}

      {empresa.servicos.length > 0 ? (
        <Secao titulo="Serviços">
          <dl style={{ margin: 0 }}>
            {empresa.servicos.map((s) => (
              <Campo key={s.id} rotulo={`${ROTULO_FAMILIA[s.familia as keyof typeof ROTULO_FAMILIA] ?? s.familia}${s.ativo ? "" : " (encerrado)"}`}>
                {moeda(s.valor)}
              </Campo>
            ))}
          </dl>
        </Secao>
      ) : null}

      <Secao titulo="Histórico">
        {timeline.length === 0 ? (
          <p className="ov-nota">Nenhum evento registrado para esta empresa.</p>
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

function DialogoNovaEmpresa({ aberto, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean; pendente: boolean; bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (e: { nome: string; cnpj?: string | null; website?: string | null; setor?: string | null; cidade?: string | null }) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ nome: "", cnpj: "", website: "", setor: "", cidade: "" });
  const campo = (c: keyof typeof form) => ({
    value: form[c], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [c]: e.target.value })),
  });
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Nova empresa"
      descricao="Se já existir empresa com este CNPJ, domínio ou nome, ela é reaproveitada. Criar empresa não cria lead." largura="larga">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-form-linha">
          <label><span>Nome *</span><input {...campo("nome")} /></label>
          <label><span>CNPJ</span><input {...campo("cnpj")} /></label>
          <label><span>Site</span><input {...campo("website")} /></label>
          <label><span>Setor</span><input {...campo("setor")} /></label>
          <label><span>Cidade</span><input {...campo("cidade")} /></label>
        </div>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !form.nome.trim()}
            onClick={() => aoConfirmar({
              nome: form.nome, cnpj: form.cnpj || null, website: form.website || null,
              setor: form.setor || null, cidade: form.cidade || null,
            })}>Criar empresa</button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoNovaPessoa({ aberto, pendente, bloqueio, buscarEmpresas, aoFechar, aoConfirmar }: {
  aberto: boolean; pendente: boolean; bloqueio: { mensagem: string } | null;
  buscarEmpresas: (t: string) => Promise<Array<{ id: string; nome: string; apoio: string | null }>>;
  aoFechar: () => void;
  aoConfirmar: (e: { nome: string; sobrenome?: string | null; cargo?: string | null; email?: string | null; telefone?: string | null; empresaId?: string | null; papel?: PapelPessoa }) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ nome: "", sobrenome: "", cargo: "", email: "", telefone: "" });
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<Array<{ id: string; nome: string; apoio: string | null }>>([]);
  const [empresa, setEmpresa] = useState<{ id: string; nome: string } | null>(null);
  const [papel, setPapel] = useState<PapelPessoa>("contato_principal");

  const campo = (c: keyof typeof form) => ({
    value: form[c], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [c]: e.target.value })),
  });

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Nova pessoa"
      descricao="A empresa é opcional: uma pessoa pode existir sem empresa e ser associada depois. Criar pessoa não cria lead." largura="larga">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <div className="ov-form-linha">
          <label><span>Nome *</span><input {...campo("nome")} /></label>
          <label><span>Sobrenome</span><input {...campo("sobrenome")} /></label>
          <label><span>Cargo</span><input {...campo("cargo")} /></label>
          <label><span>E-mail</span><input type="email" {...campo("email")} /></label>
          <label><span>Telefone</span><input {...campo("telefone")} /></label>
          <label>
            <span>Papel na empresa</span>
            <select value={papel} onChange={(e) => setPapel(e.target.value as PapelPessoa)}>
              {PAPEIS_PESSOA.map((p) => <option key={p.chave} value={p.chave}>{p.rotulo}</option>)}
            </select>
          </label>
        </div>
        <label>
          <span>Empresa (opcional)</span>
          <input value={empresa?.nome ?? termo} placeholder="Buscar empresa"
            onChange={async (e) => {
              setTermo(e.target.value); setEmpresa(null);
              setOpcoes(e.target.value.trim().length >= 2 ? await buscarEmpresas(e.target.value) : []);
            }} />
        </label>
        {opcoes.length > 0 && !empresa ? (
          <div className="ov-familias">
            {opcoes.map((o) => (
              <button key={o.id} type="button" className="ov-familia"
                onClick={() => { setEmpresa({ id: o.id, nome: o.nome }); setOpcoes([]); }}>{o.nome}</button>
            ))}
          </div>
        ) : null}
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !form.nome.trim()}
            onClick={() => aoConfirmar({
              nome: form.nome, sobrenome: form.sobrenome || null, cargo: form.cargo || null,
              email: form.email || null, telefone: form.telefone || null,
              empresaId: empresa?.id ?? null, papel,
            })}>Criar pessoa</button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoVincular({ aberto, pessoa, pendente, bloqueio, buscarEmpresas, aoFechar, aoConfirmar }: {
  aberto: boolean; pessoa: LinhaPessoa | null; pendente: boolean; bloqueio: { mensagem: string } | null;
  buscarEmpresas: (t: string) => Promise<Array<{ id: string; nome: string; apoio: string | null }>>;
  aoFechar: () => void;
  aoConfirmar: (empresaId: string, papel: PapelPessoa, troca: boolean) => Promise<boolean>;
}) {
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<Array<{ id: string; nome: string; apoio: string | null }>>([]);
  const [empresa, setEmpresa] = useState<{ id: string; nome: string } | null>(null);
  const [papel, setPapel] = useState<PapelPessoa>("contato_principal");
  const [troca, setTroca] = useState(false);

  const legado = pessoa?.fonte === "lead";

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo={pessoa?.nome ?? "Pessoa"}
      descricao={pessoa?.empresa ? `Hoje vinculada a ${pessoa.empresa}` : "Sem empresa associada"}>
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        {legado ? (
          <p className="ov-nota">
            Esta identidade ainda vive no registro legado. O vínculo com papel e histórico existe para pessoas
            do modelo novo; aqui a associação é feita pelo próprio lead, em Pré-vendas.
          </p>
        ) : (
          <>
            <label>
              <span>Empresa</span>
              <input value={empresa?.nome ?? termo} placeholder="Buscar empresa"
                onChange={async (e) => {
                  setTermo(e.target.value); setEmpresa(null);
                  setOpcoes(e.target.value.trim().length >= 2 ? await buscarEmpresas(e.target.value) : []);
                }} />
            </label>
            {opcoes.length > 0 && !empresa ? (
              <div className="ov-familias">
                {opcoes.map((o) => (
                  <button key={o.id} type="button" className="ov-familia"
                    onClick={() => { setEmpresa({ id: o.id, nome: o.nome }); setOpcoes([]); }}>{o.nome}</button>
                ))}
              </div>
            ) : null}
            <label>
              <span>Papel</span>
              <select value={papel} onChange={(e) => setPapel(e.target.value as PapelPessoa)}>
                {PAPEIS_PESSOA.map((p) => <option key={p.chave} value={p.chave}>{p.rotulo}</option>)}
              </select>
            </label>
            {pessoa?.empresa ? (
              <label className="ov-nota" style={{ flexDirection: "row", alignItems: "center", gap: "calc(6 * var(--onface-u))" }}>
                <input type="checkbox" checked={troca} onChange={(e) => setTroca(e.target.checked)} />
                <span style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>
                  Trocou de empresa — encerrar o vínculo anterior preservando o histórico
                </span>
              </label>
            ) : null}
            <div className="ov-form-rodape">
              <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
              <button type="button" className="ov-botao" disabled={pendente || !empresa}
                onClick={() => aoConfirmar(empresa!.id, papel, troca)}>Vincular</button>
            </div>
          </>
        )}
      </div>
    </Dialogo>
  );
}

function DialogoNovoLead({ aberto, empresa, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean; empresa: Empresa360 | null; responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean; bloqueio: { mensagem: string } | null; aoFechar: () => void;
  aoConfirmar: (e: { pessoaNome: string; cargo?: string | null; email?: string | null; responsavelId?: string | null }) => Promise<boolean>;
}) {
  const [form, setForm] = useState({ pessoaNome: "", cargo: "", email: "", responsavelId: "" });
  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Criar lead" descricao={empresa?.nome}>
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        <label><span>Contato *</span><input value={form.pessoaNome} onChange={(e) => setForm((f) => ({ ...f, pessoaNome: e.target.value }))} /></label>
        <div className="ov-form-linha">
          <label><span>Cargo</span><input value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} /></label>
          <label><span>E-mail</span><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
        </div>
        <label>
          <span>Responsável</span>
          <select value={form.responsavelId} onChange={(e) => setForm((f) => ({ ...f, responsavelId: e.target.value }))}>
            <option value="">Sem responsável</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <p className="ov-nota">O lead nasce em Pré-vendas na etapa Novo. A empresa não é duplicada.</p>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente || !form.pessoaNome.trim()}
            onClick={() => aoConfirmar({
              pessoaNome: form.pessoaNome, cargo: form.cargo || null,
              email: form.email || null, responsavelId: form.responsavelId || null,
            })}>
            <UserPlus aria-hidden />Criar lead
          </button>
        </div>
      </div>
    </Dialogo>
  );
}

function DialogoNovaOportunidade({ aberto, empresa, responsaveis, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean; empresa: Empresa360 | null; responsaveis: Array<{ id: string; nome: string }>;
  pendente: boolean; bloqueio: { mensagem: string } | null; aoFechar: () => void;
  aoConfirmar: (familias: Familia[], responsavelId: string) => Promise<boolean>;
}) {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [responsavelId, setResponsavelId] = useState("");
  const expansao = empresa?.relacionamento === "cliente";

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Nova oportunidade" descricao={empresa?.nome}>
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        {expansao ? (
          <p className="ov-nota">
            Esta empresa já é cliente, então a oportunidade nasce como expansão. Não é uma empresa nova nem um cliente novo.
          </p>
        ) : null}
        <div className="ov-familias">
          {FAMILIAS.map((f) => (
            <button key={f} type="button" className="ov-familia" data-marcada={familias.includes(f)}
              onClick={() => setFamilias((a) => a.includes(f) ? a.filter((x) => x !== f) : [...a, f])}>
              {ROTULO_FAMILIA[f]}
            </button>
          ))}
        </div>
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
            onClick={() => aoConfirmar(familias, responsavelId)}>Criar</button>
        </div>
      </div>
    </Dialogo>
  );
}
