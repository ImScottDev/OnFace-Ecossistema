"use client";

/**
 * Página de entidade do Módulo Vendas.
 *
 * O painel lateral é bom para decidir o próximo passo sem perder o board de
 * vista, e ruim para tudo que exige leitura: itens de proposta, endereço,
 * pessoas da empresa, histórico inteiro. Cada entidade do módulo tem as duas
 * superfícies, e as duas leem o MESMO corpo — o painel só o aperta numa
 * coluna, a página o abre em duas.
 */

import Link from "next/link";
import { ArrowLeft, Maximize2, Mail, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import type { DetalheOportunidade, Empresa360, LinhaPessoa } from "@/lib/vendas/consultas";
import type { LinhaDoTempo } from "@/lib/vendas/eventos";
import { ROTULO_FAMILIA } from "@/lib/vendas/dominio";
import { canaisDisponiveis, urlAtendimento, type AlvoDeContato, type CanalAtendimento } from "./atendimento";
import { Campo, Tag, dataCurta, dataHora, moeda, moedaExata } from "./ui";
import { rotuloAtor, rotuloEvento } from "./PreVendas";

/* ── Moldura ───────────────────────────────────────────────────────────── */

export function PaginaEntidade({ voltar, titulo, subtitulo, tags, acoes, children }: {
  voltar: { href: string; rotulo: string };
  titulo: string;
  subtitulo?: ReactNode;
  tags?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ov-pagina">
      <Link className="ov-voltar" href={voltar.href}>
        <ArrowLeft aria-hidden />{voltar.rotulo}
      </Link>

      <header className="ov-pagina-topo">
        <div style={{ minWidth: 0 }}>
          <h1>{titulo}</h1>
          {subtitulo ? <p>{subtitulo}</p> : null}
          {tags ? <div className="ov-card-meta" style={{ marginTop: "calc(8 * var(--onface-u))" }}>{tags}</div> : null}
        </div>
        {acoes ? <div className="ov-acoes ov-pagina-acoes">{acoes}</div> : null}
      </header>

      {children}
    </div>
  );
}

/** Duas colunas: o assunto à esquerda, o apoio à direita. Abaixo de tablet
 *  vira uma coluna só, na mesma ordem em que se lê. */
export function PaginaColunas({ principal, lateral }: { principal: ReactNode; lateral: ReactNode }) {
  return (
    <div className="ov-pagina-colunas">
      <div className="ov-pagina-principal">{principal}</div>
      <div className="ov-pagina-lateral">{lateral}</div>
    </div>
  );
}

/** Bloco de conteúdo da página. Mesmo papel do `Secao` do painel, com o peso
 *  visual de uma página em vez do de uma gaveta. */
export function Bloco({ titulo, acoes, children }: { titulo: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section className="ov-bloco">
      <header className="ov-bloco-topo">
        <h2>{titulo}</h2>
        {acoes ? <div className="ov-acoes">{acoes}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** Link do painel para a página cheia da mesma entidade. */
export function AbrirEmPagina({ href }: { href: string }) {
  return (
    <Link className="ov-painel-expandir" href={href} title="Abrir em tela cheia">
      <Maximize2 aria-hidden />
      <span className="sr-only">Abrir em tela cheia</span>
    </Link>
  );
}

/* ── Ações de contato ──────────────────────────────────────────────────── */

const ROTULO_CANAL: Record<CanalAtendimento, string> = {
  whatsapp: "WhatsApp", ligacao: "Ligar", email: "E-mail",
};
const ICONE_CANAL: Record<CanalAtendimento, typeof Mail> = {
  whatsapp: MessageCircle, ligacao: Phone, email: Mail,
};

/**
 * Abre o Atendimento do ONFACE no canal e no contato certos.
 *
 * Canal sem dado para funcionar não vira botão desabilitado nem botão que leva
 * ao inbox genérico: ele simplesmente não aparece, e a nota diz o que falta.
 */
export function AcoesContato({ alvo, texto, variante = "contorno" }: {
  alvo: AlvoDeContato;
  texto?: string | null;
  variante?: "contorno" | "neutro";
}) {
  const canais = canaisDisponiveis(alvo);
  if (canais.length === 0) {
    return <p className="ov-nota">Sem telefone ou e-mail cadastrado, não há por onde falar com este contato.</p>;
  }
  return (
    <div className="ov-acoes">
      {canais.map((canal) => {
        const Icone = ICONE_CANAL[canal];
        return (
          <Link key={canal} className="ov-botao" data-variante={variante} href={urlAtendimento(canal, alvo, texto)!}>
            <Icone aria-hidden />{ROTULO_CANAL[canal]}
          </Link>
        );
      })}
    </div>
  );
}

/* ── Corpos das páginas de entidade ───────────────────────────────────── */

function Historico({ timeline }: { timeline: LinhaDoTempo[] }) {
  if (timeline.length === 0) return <p className="ov-nota">Nenhum evento registrado.</p>;
  return (
    <div className="ov-timeline">
      {timeline.slice(0, 40).map((evento) => (
        <div className="ov-timeline-item" key={evento.id}>
          <span className="ov-timeline-marca" aria-hidden />
          <div>
            <strong>{evento.titulo || rotuloEvento(evento.tipo)}</strong>
            <span>
              {dataHora(evento.ocorridoEm)}
              {evento.usuarioNome ? ` · ${evento.usuarioNome}` : evento.atorTipo !== "HUMAN" ? ` · ${rotuloAtor(evento.atorTipo)}` : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function rotaDoDiretorio(voltar: string, segmento: string) {
  return voltar.replace(/\/pipeline$/, segmento).replace(/\/contatos$/, segmento);
}

export function DetalheOportunidadePagina({ oportunidade, timeline, voltar }: {
  oportunidade: DetalheOportunidade;
  timeline: LinhaDoTempo[];
  voltar: string;
}) {
  const contatos = rotaDoDiretorio(voltar, "/contatos");
  const propostas = rotaDoDiretorio(voltar, "/propostas");
  const aberta = oportunidade.etapa !== "ganho" && oportunidade.etapa !== "perdido";

  return (
    <PaginaEntidade
      voltar={{ href: voltar, rotulo: "Voltar para Pipeline" }}
      titulo={oportunidade.titulo}
      subtitulo={`${oportunidade.empresa.nome} · ${oportunidade.familiaRotulo}`}
      tags={<><Tag tom="coral">{oportunidade.etapaRotulo}</Tag>{oportunidade.badges.map((b) => <Tag key={b} tom="alerta">{b}</Tag>)}</>}
      acoes={<Link className="ov-botao" href={`${voltar}?oportunidade=${encodeURIComponent(oportunidade.id)}`}>Gerenciar oportunidade</Link>}
    >
      <PaginaColunas
        principal={<>
          <Bloco titulo="Resumo comercial">
            <dl style={{ margin: 0 }}>
              <Campo rotulo="Valor estimado">{moedaExata(oportunidade.valor)}</Campo>
              <Campo rotulo="Previsão de fechamento">{dataCurta(oportunidade.previsaoFechamento)}</Campo>
              <Campo rotulo="Responsável">{oportunidade.responsavel.nome}</Campo>
              <Campo rotulo="Próxima ação">{oportunidade.proximaAcao.descricao}{oportunidade.proximaAcao.quando ? ` · ${dataCurta(oportunidade.proximaAcao.quando)}` : ""}</Campo>
            </dl>
          </Bloco>
          {oportunidade.qualificacaoHerdada ? <Bloco titulo="Qualificação herdada"><pre className="ov-nota" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(oportunidade.qualificacaoHerdada, null, 2)}</pre></Bloco> : null}
          <Bloco titulo="Propostas">
            {oportunidade.propostas.length === 0 ? <p className="ov-nota">Ainda não há proposta vinculada.</p> : oportunidade.propostas.map((proposta) => (
              <Link key={proposta.id} className="ov-botao" data-variante="contorno" href={`${propostas}/${proposta.id}`}>
                Proposta #{proposta.numero} · v{proposta.versao} · {proposta.status} · {moeda(proposta.total)}
              </Link>
            ))}
          </Bloco>
          <Bloco titulo="Histórico"><Historico timeline={timeline} /></Bloco>
        </>}
        lateral={<>
          <Bloco titulo="Empresa">
            <dl style={{ margin: 0 }}><Campo rotulo="Conta">{oportunidade.empresa.nome}</Campo><Campo rotulo="Origem">{oportunidade.sourceProcess ?? "—"}</Campo></dl>
            {oportunidade.empresa.id ? <Link className="ov-botao" data-variante="contorno" href={`${contatos}/empresas/${oportunidade.empresa.id}`}>Abrir empresa</Link> : null}
          </Bloco>
          <Bloco titulo="Contato associado">
            {oportunidade.contato ? <>
              <dl style={{ margin: 0 }}>
                <Campo rotulo="Pessoa">{oportunidade.contato.nome}</Campo>
                <Campo rotulo="Cargo">{oportunidade.contato.cargo}</Campo>
                <Campo rotulo="E-mail">{oportunidade.contato.email}</Campo>
                <Campo rotulo="Telefone">{oportunidade.contato.telefone ?? oportunidade.contato.whatsapp}</Campo>
              </dl>
              <Link className="ov-botao" data-variante="contorno" href={`${contatos}/pessoas/${oportunidade.contato.id}`}>Abrir pessoa</Link>
            </> : <p className="ov-nota">Nenhuma pessoa associada a esta oportunidade.</p>}
          </Bloco>
          <Bloco titulo="Eventos comerciais">
            <dl style={{ margin: 0 }}>
              <Campo rotulo="Reuniões">{oportunidade.reunioes.length}</Campo>
              <Campo rotulo="No-show">{oportunidade.noShow.contagem || "Nenhum"}</Campo>
              <Campo rotulo="Trial">{oportunidade.trial.iniciadoEm ? oportunidade.trial.encerradoEm ? "Encerrado" : "Ativo" : "Não iniciado"}</Campo>
              {aberta ? <Campo rotulo="Ação">Use “Gerenciar oportunidade” para editar família, próxima ação, reunião, no-show ou trial.</Campo> : null}
            </dl>
          </Bloco>
          {oportunidade.irmas.length > 0 ? <Bloco titulo="Oportunidades relacionadas">{oportunidade.irmas.map((irma) => <Link key={irma.id} className="ov-botao" data-variante="contorno" href={`${voltar}/${irma.id}`}>{irma.titulo}</Link>)}</Bloco> : null}
        </>}
      />
    </PaginaEntidade>
  );
}

export function DetalheEmpresaPagina({ empresa, timeline, voltar }: {
  empresa: Empresa360;
  timeline: LinhaDoTempo[];
  voltar: string;
}) {
  const pipeline = rotaDoDiretorio(voltar, "/pipeline");
  const propostas = rotaDoDiretorio(voltar, "/propostas");
  return (
    <PaginaEntidade
      voltar={{ href: voltar, rotulo: "Voltar para Contatos" }}
      titulo={empresa.nome}
      subtitulo={[empresa.setor, empresa.porte, empresa.cidade].filter(Boolean).join(" · ") || undefined}
      tags={<><Tag tom={empresa.relacionamento === "cliente" ? "sucesso" : "coral"}>{empresa.relacionamentoRotulo}</Tag>{!empresa.dadosJuridicosCompletos ? <Tag tom="alerta">Dados jurídicos incompletos</Tag> : null}</>}
      acoes={<Link className="ov-botao" href={`${voltar}?empresa=${encodeURIComponent(empresa.id)}`}>Gerenciar empresa</Link>}
    >
      <PaginaColunas
        principal={<>
          <Bloco titulo="Cadastro e dados jurídicos">
            <dl style={{ margin: 0 }}>
              <Campo rotulo="Razão social">{empresa.razaoSocial}</Campo><Campo rotulo="CNPJ">{empresa.cnpj}</Campo><Campo rotulo="Domínio">{empresa.dominio}</Campo>
              <Campo rotulo="Endereço">{[empresa.endereco.logradouro, empresa.endereco.numero, empresa.endereco.complemento, empresa.endereco.bairro].filter(Boolean).join(", ") || null}</Campo>
              <Campo rotulo="Cidade / UF">{[empresa.cidade, empresa.estado].filter(Boolean).join(" / ") || null}</Campo><Campo rotulo="CEP">{empresa.endereco.cep}</Campo>
            </dl>
            {!empresa.dadosJuridicosCompletos ? <p className="ov-nota">Faltam: {empresa.dadosJuridicosFaltando.join(", ")}. Use “Gerenciar empresa” para completar os dados.</p> : null}
          </Bloco>
          <Bloco titulo={`Pessoas (${empresa.pessoas.length})`}>
            {empresa.pessoas.length === 0 ? <p className="ov-nota">Nenhuma pessoa associada.</p> : empresa.pessoas.map((pessoa) => (
              <Link key={`${pessoa.fonte}-${pessoa.id}`} className="ov-botao" data-variante="contorno" href={`${voltar}/pessoas/${pessoa.id}`}>
                {pessoa.nome}{pessoa.cargo ? ` · ${pessoa.cargo}` : ""}{pessoa.papel ? ` · ${pessoa.papel}` : ""}
              </Link>
            ))}
          </Bloco>
          <Bloco titulo="Histórico"><Historico timeline={timeline} /></Bloco>
        </>}
        lateral={<>
          <Bloco titulo="Processos relacionados">
            {empresa.leads.length === 0 && empresa.oportunidades.length === 0 ? <p className="ov-nota">Nenhum processo comercial aberto.</p> : null}
            {empresa.leads.map((lead) => <Link key={lead.id} className="ov-botao" data-variante="contorno" href={`${rotaDoDiretorio(voltar, "/pre-vendas")}?lead=${lead.id}`}>{lead.etapaRotulo} · {lead.origem ?? "sem origem"}</Link>)}
            {empresa.oportunidades.map((op) => <Link key={op.id} className="ov-botao" data-variante="contorno" href={`${pipeline}/${op.id}`}>{op.titulo} · {op.etapaRotulo} · {moeda(op.valor)}</Link>)}
          </Bloco>
          <Bloco titulo="Propostas">{empresa.propostas.length === 0 ? <p className="ov-nota">Nenhuma proposta vinculada.</p> : empresa.propostas.map((proposta) => <Link key={proposta.id} className="ov-botao" data-variante="contorno" href={`${propostas}/${proposta.id}`}>#{proposta.numero} · v{proposta.versao} · {proposta.status}</Link>)}</Bloco>
          <Bloco titulo="Serviços">{empresa.servicos.length === 0 ? <p className="ov-nota">Nenhum serviço ativo.</p> : <dl style={{ margin: 0 }}>{empresa.servicos.map((servico) => <Campo key={servico.id} rotulo={ROTULO_FAMILIA[servico.familia as keyof typeof ROTULO_FAMILIA] ?? servico.familia}>{moeda(servico.valor)}</Campo>)}</dl>}</Bloco>
        </>}
      />
    </PaginaEntidade>
  );
}

export function DetalhePessoaPagina({ pessoa, timeline, voltar }: { pessoa: LinhaPessoa; timeline: LinhaDoTempo[]; voltar: string }) {
  return (
    <PaginaEntidade
      voltar={{ href: voltar, rotulo: "Voltar para Pessoas" }}
      titulo={pessoa.nome}
      subtitulo={pessoa.cargo ?? undefined}
      acoes={<Link className="ov-botao" href={`${voltar}?aba=pessoas&pessoa=${encodeURIComponent(pessoa.id)}`}>Gerenciar vínculo</Link>}
    >
      <PaginaColunas
        principal={<><Bloco titulo="Contato"><dl style={{ margin: 0 }}><Campo rotulo="E-mail">{pessoa.email}</Campo><Campo rotulo="Telefone">{pessoa.telefone}</Campo><Campo rotulo="WhatsApp">{pessoa.whatsapp}</Campo></dl><AcoesContato alvo={{ leadId: pessoa.fonte === "lead" ? pessoa.id : null, telefone: pessoa.telefone ?? pessoa.whatsapp, email: pessoa.email }} /></Bloco><Bloco titulo="Histórico"><Historico timeline={timeline} /></Bloco></>}
        lateral={<Bloco titulo="Empresa">{pessoa.empresa && pessoa.empresaId ? <Link className="ov-botao" data-variante="contorno" href={`${voltar}/empresas/${pessoa.empresaId}`}>Abrir empresa · {pessoa.empresa}</Link> : <p className="ov-nota">Esta pessoa ainda não está vinculada a uma empresa. Use “Gerenciar vínculo” para associá-la sem criar Lead.</p>}</Bloco>}
      />
    </PaginaEntidade>
  );
}
