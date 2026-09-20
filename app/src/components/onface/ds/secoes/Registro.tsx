"use client";

/** Registro e CRM — a família de domínio.
 *
 * Documenta CabecalhoEntidade, LinhaDoTempo, Anel, Metrica e GavetaDetalhe, e
 * fecha montando um Cliente 360 de verdade com os dados da TechCorp Telecom.
 * A composição final existe para provar a tese do arquivo `crm.tsx`: oito tipos
 * de entidade, um layout só. */

import * as React from "react";
import {
  CalendarClock, MessageSquarePlus, Phone, RefreshCw, Sparkles, Star, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Bloco, Chave, Playground, Regras, Secao } from "../lab";
import { Momento } from "../marca";
import {
  ATIVIDADES, CLIENTE_360, INSIGHTS, NEGOCIOS, RECEITA_SEMANAL, RESPONSAVEIS, brl, compacto,
} from "../dados";
import {
  Anel, CabecalhoEntidade, CampoEditavel, CampoLink, GavetaDetalhe, LinhaDoTempo, Metrica,
  type AbaGaveta, type CabecalhoEntidadeProps, type TipoEntidade,
} from "../crm";

/* ── Exemplos por tipo de entidade ──────────────────────────────────────── */
type Exemplo = Omit<CabecalhoEntidadeProps, "abas" | "compacto">;

const NEGOCIO = NEGOCIOS[0];
const CONTRATO = NEGOCIOS[9];
const LEAD = NEGOCIOS[10];
const MAYARA = RESPONSAVEIS[0];

const EXEMPLOS: Record<TipoEntidade, Exemplo> = {
  lead: {
    tipo: "lead", nome: LEAD.empresa, iniciais: "IC",
    /* Mesma palavra, mesma cor que no cartão do quadro: "sem tarefa" é lead
       parado esperando ação, não prazo estourado. Vermelho é do "Atrasada". */
    estado: { rotulo: "Sem tarefa", tom: "acento" },
    campos: { dono: LEAD.responsavel.nome, origem: LEAD.origem, criadoEm: "14 set 2026" },
  },
  contato: {
    tipo: "contato", nome: CLIENTE_360.contatos[0].nome, iniciais: CLIENTE_360.contatos[0].iniciais,
    estado: { rotulo: "Contato principal", tom: "acento" },
    campos: { cargo: CLIENTE_360.contatos[0].cargo, empresa: CLIENTE_360.nome, dono: "Mayara Ribeiro" },
  },
  empresa: {
    tipo: "empresa", nome: CLIENTE_360.nome, iniciais: CLIENTE_360.iniciais,
    estado: { rotulo: CLIENTE_360.status, tom: "ok" },
    campos: { dono: CLIENTE_360.csResponsavel, origem: "Meta Ads", plano: CLIENTE_360.plano, desde: CLIENTE_360.desde },
  },
  oportunidade: {
    tipo: "oportunidade", nome: NEGOCIO.titulo, iniciais: CLIENTE_360.iniciais,
    estado: { rotulo: NEGOCIO.etapa, tom: "acento" },
    campos: { valor: brl(NEGOCIO.valor), dono: NEGOCIO.responsavel.nome, origem: NEGOCIO.origem, criadoEm: "28 ago 2026" },
  },
  cliente: {
    tipo: "cliente", nome: CLIENTE_360.nome, iniciais: CLIENTE_360.iniciais,
    estado: { rotulo: CLIENTE_360.status, tom: "ok" },
    campos: { plano: CLIENTE_360.plano, mrr: `${brl(CLIENTE_360.mrr)}/mês`, desde: CLIENTE_360.desde, dono: CLIENTE_360.csResponsavel },
  },
  contrato: {
    tipo: "contrato", nome: `${CONTRATO.titulo} · ${CONTRATO.empresa}`,
    estado: { rotulo: "Assinado", tom: "ok" },
    campos: { valor: brl(CONTRATO.valor), vigencia: "12 meses", dono: CONTRATO.responsavel.nome, desde: "30 jul 2026" },
  },
  ticket: {
    tipo: "ticket", nome: `Fora do SLA · ${CLIENTE_360.nome}`,
    estado: { rotulo: "Em risco", tom: "risco" },
    campos: { prioridade: "Alta", sla: "3 chamados fora do prazo", canal: "WhatsApp", dono: CLIENTE_360.csResponsavel },
  },
  tarefa: {
    tipo: "tarefa", nome: `Retornar para ${CLIENTE_360.contatos[0].nome}`,
    estado: { rotulo: "Hoje", tom: "acento" },
    campos: { vencimento: NEGOCIO.proximaAcao, dono: NEGOCIO.responsavel.nome, empresa: NEGOCIO.empresa, canal: "Ligação" },
  },
};

const TIPOS = Object.keys(EXEMPLOS) as TipoEntidade[];
const ABAS_DEMO = [
  { valor: "visao", rotulo: "Visão geral" },
  { valor: "atividades", rotulo: "Atividades", contagem: ATIVIDADES.length },
  { valor: "arquivos", rotulo: "Arquivos" },
];

const RECEITA_ATUAL = RECEITA_SEMANAL[RECEITA_SEMANAL.length - 1];
const VARIACAO_RECEITA = ((RECEITA_ATUAL.atual - RECEITA_ATUAL.anterior) / RECEITA_ATUAL.anterior) * 100;
const NEGOCIOS_DA_CONTA = NEGOCIOS.filter((n) => n.empresa === CLIENTE_360.nome);
const ABERTOS = NEGOCIOS.filter((n) => n.etapa !== "Ganho" && n.etapa !== "Perdido");

export function SecaoRegistro() {
  const [tipo, setTipo] = React.useState<TipoEntidade>("oportunidade");
  const [abaDemo, setAbaDemo] = React.useState("visao");
  const [compacta, setCompacta] = React.useState(false);
  const [comFiltro, setComFiltro] = React.useState(true);
  // Remontar os anéis é a forma honesta de reexibir a animação sem inventar
  // número novo: o dado é o mesmo, o traço é que cresce de novo.
  const [ciclo, setCiclo] = React.useState(0);
  const [gaveta, setGaveta] = React.useState<"negocio" | "tarefa" | null>(null);
  const [aba360, setAba360] = React.useState("visao");

  /* O cabeçalho publica o campo; a tela decide o que ele faz. Aqui o
     responsável é editável no lugar e a empresa leva para o registro dela —
     é o padrão que o produto deve usar, não uma exceção da documentação. */
  const [dono, setDono] = React.useState(RESPONSAVEIS[0].nome);
  const exemploBase = EXEMPLOS[tipo];
  const exemplo: Exemplo = {
    ...exemploBase,
    campos: {
      ...exemploBase.campos,
      ...(exemploBase.campos?.dono !== undefined
        ? {
            dono: (
              <CampoEditavel
                valor={dono}
                opcoes={RESPONSAVEIS.map((r) => r.nome)}
                rotulo="Responsável pelo registro"
                aoMudar={(novo) => {
                  setDono(novo);
                  toast.success(`Responsável agora é ${novo}`, { description: "A troca vale para este registro." });
                }}
              />
            ),
          }
        : {}),
      ...(exemploBase.campos?.empresa !== undefined
        ? { empresa: <CampoLink href="#composicao-cliente-360">{exemploBase.campos.empresa}</CampoLink> }
        : {}),
    },
  };

  const abasNegocio: AbaGaveta[] = [
    {
      valor: "resumo",
      rotulo: "Resumo",
      conteudo: (
        <div className="ds-coluna">
          <div className="of-metricas">
            <Metrica rotulo="Valor" valor={brl(NEGOCIO.valor)} apoio={NEGOCIO.produto} densidade="compacta" />
            <Metrica rotulo="Etapa" valor={NEGOCIO.etapa} apoio="há 9 dias nesta etapa" densidade="compacta" />
            <Metrica rotulo="Origem" valor={NEGOCIO.origem} apoio={`Criado em 28 ago`} densidade="compacta" />
          </div>
          <div className="ds-insight">
            <span className="ds-nexo-marca"><Sparkles aria-hidden /></span>
            <div>
              <strong>{ATIVIDADES[0].titulo}</strong>
              <p>{ATIVIDADES[0].detalhe}</p>
            </div>
          </div>
          <div className="of-lista-item">
            <span className="of-lista-avatar"><CalendarClock aria-hidden /></span>
            <div>
              <strong>Próxima ação · {NEGOCIO.proximaAcao}</strong>
              <small>Enviar cronograma de implantação por escrito, pedido na ligação de hoje.</small>
            </div>
          </div>
        </div>
      ),
    },
    {
      valor: "contatos",
      rotulo: "Contatos",
      contagem: CLIENTE_360.contatos.length,
      conteudo: <ListaContatos />,
    },
    {
      valor: "atividades",
      rotulo: "Atividades",
      contagem: ATIVIDADES.length,
      conteudo: <LinhaDoTempo eventos={ATIVIDADES} densidade="compacta" comFiltro={false} />,
    },
  ];

  const abasTarefa: AbaGaveta[] = [
    {
      valor: "detalhe",
      rotulo: "Detalhe",
      conteudo: (
        <div className="ds-coluna">
          <div className="of-lista-item">
            <span className="of-lista-avatar"><Phone aria-hidden /></span>
            <div>
              <strong>Ligar para {CLIENTE_360.contatos[0].nome}</strong>
              <small>{CLIENTE_360.contatos[0].cargo} · {CLIENTE_360.nome}</small>
            </div>
            <span className="of-lista-valor">{NEGOCIO.proximaAcao}</span>
          </div>
          <div className="of-metricas">
            <Metrica rotulo="Negócio vinculado" valor={brl(NEGOCIO.valor)} apoio={NEGOCIO.titulo} densidade="compacta" />
            <Metrica rotulo="Responsável" valor={NEGOCIO.responsavel.nome} apoio="Carteira de 6 negócios abertos" densidade="compacta" />
          </div>
        </div>
      ),
    },
    {
      valor: "historico",
      rotulo: "Histórico",
      conteudo: <LinhaDoTempo eventos={ATIVIDADES.slice(2, 6)} densidade="compacta" comFiltro={false} />,
    },
  ];

  return (
    <Secao
      titulo="Registro e CRM"
      chamada="A parte que faz o ONFACE parecer ONFACE. Lead, contato, empresa, oportunidade, cliente, contrato, ticket e tarefa entram pelo mesmo cabeçalho, pela mesma linha do tempo e pela mesma gaveta. O que muda é o ícone e o conjunto de campos, nunca o layout."
    >
      {/* ═══ Cabeçalho de entidade ═══ */}
      <Bloco
        titulo="CabecalhoEntidade"
        descricao="Um cabeçalho para oito entidades. O tipo escolhe o ícone e a lista de campos; a identidade, o estado, as ações e as abas ficam sempre no mesmo lugar, então quem aprendeu a tela de Lead já sabe operar a de Contrato."
      >
        {/* A seção abre no registro, não no seletor: o que a pessoa precisa ver
            em três segundos é DE QUEM é a tela (a oportunidade da TechCorp, com
            valor, dono e próxima ação), não uma fileira de chips perguntando
            qual entidade ela quer. O controle é meta-documentação e desceu para
            depois do exemplo, onde ele explica o que acabou de ser mostrado. */}
        <Tabs value={abaDemo} onValueChange={setAbaDemo}>
          <CabecalhoEntidade
            {...exemplo}
            abas={ABAS_DEMO}
            acaoSecundaria={<Button variant="outline" size="sm">Registrar atividade</Button>}
            acaoPrimaria={<Button size="sm">{acaoPrimariaPorTipo(tipo)}</Button>}
          />
          {ABAS_DEMO.map((aba) => (
            <TabsContent key={aba.valor} value={aba.valor}>
              <p className="ds-metrica-apoio" style={{ paddingTop: "var(--space-12)" }}>
                Conteúdo da aba <strong>{aba.rotulo}</strong> para {rotuloTipo(tipo).toLowerCase()}. A aba é do
                consumidor, o cabeçalho só publica a barra.
              </p>
            </TabsContent>
          ))}
        </Tabs>

        <div style={{ marginTop: "var(--space-20)" }}>
          <Playground>
            <span className="ds-rotulo-estado">Trocar tipo</span>
            <div className="ds-controle-grupo" role="group" aria-label="Tipo de entidade">
              {TIPOS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="ds-chip-filtro"
                  data-ativo={item === tipo ? "true" : undefined}
                  aria-pressed={item === tipo}
                  onClick={() => setTipo(item)}
                >
                  {EXEMPLOS[item].nome.length > 0 ? rotuloTipo(item) : item}
                </button>
              ))}
            </div>
          </Playground>
        </div>
      </Bloco>

      {/* ═══ Linha do tempo ═══ */}
      <Bloco
        titulo="LinhaDoTempo e AtividadeItem"
        descricao="O histórico é o coração do CRM: é onde se descobre por que um negócio parou. A marca do trilho identifica o canal e só ganha cor quando o evento tem consequência. Os chips filtram de verdade."
      >
        {/* Mesma ordem do bloco de cima: o histórico real primeiro, os
            interruptores de documentação depois. */}
        <LinhaDoTempo
          eventos={ATIVIDADES}
          densidade={compacta ? "compacta" : "padrao"}
          comFiltro={comFiltro}
        />

        <div style={{ marginTop: "var(--space-20)" }}>
          <Playground>
            <Chave id="tempo-densidade" rotulo="Densidade compacta" valor={compacta} aoMudar={setCompacta} />
            <Chave id="tempo-filtro" rotulo="Chips de filtro" valor={comFiltro} aoMudar={setComFiltro} />
          </Playground>
        </div>
      </Bloco>

      {/* ═══ Anel ═══ */}
      <Bloco
        titulo="Anel"
        descricao="Percentual de um todo: meta batida, saúde da conta, SLA, adoção. O traço cresce de uma ponta só, com mola, então o olho acompanha o preenchimento em vez de ver o número aparecer pronto."
        acoes={
          <Button variant="outline" size="sm" onClick={() => setCiclo((c) => c + 1)}>
            <RefreshCw aria-hidden />
            Reanimar
          </Button>
        }
      >
        <div className="of-galeria" key={ciclo}>
          <figure>
            <Anel valor={CLIENTE_360.saude} tamanho="lg" tom="acento" rotulo="Saúde da conta" />
            <figcaption>lg · acento</figcaption>
          </figure>
          <figure>
            <Anel
              valor={(MAYARA.realizado / MAYARA.meta) * 100}
              tamanho="md"
              tom="ok"
              rotulo={`Meta ${MAYARA.iniciais}`}
              descricao={`Meta de ${MAYARA.nome}`}
            />
            <figcaption>md · ok</figcaption>
          </figure>
          <figure>
            <Anel valor={CLIENTE_360.indicadores[2].valor} tamanho="md" tom="risco" rotulo="Tickets no prazo" />
            <figcaption>md · risco</figcaption>
          </figure>
          <figure>
            <Anel valor={CLIENTE_360.indicadores[0].valor} tamanho="sm" tom="neutro" descricao="Adoção" />
            <figcaption>sm · neutro</figcaption>
          </figure>
        </div>
      </Bloco>

      {/* ═══ Métrica ═══ */}
      <Bloco
        titulo="Metrica"
        descricao="Uma família, não seis cartões. Rótulo, número e apoio ficam sempre nas mesmas coordenadas; o que entra é a evidência: tendência, série curta, anel. A versão escura serve o KPI que vive sobre a casca."
        fundo="sunken"
      >
        <div className="of-metricas">
          <Metrica
            rotulo="Receita ganha"
            valor={compacto(RECEITA_ATUAL.atual)}
            apoio={`Semana de ${RECEITA_ATUAL.semana}`}
          />
          <Metrica
            rotulo="Receita vs. período anterior"
            valor={brl(RECEITA_ATUAL.atual)}
            apoio={`Anterior ${brl(RECEITA_ATUAL.anterior)}`}
            tendencia={{ variacao: Number(VARIACAO_RECEITA.toFixed(1)) }}
          />
          <Metrica
            rotulo="Receita · 12 semanas"
            valor={compacto(RECEITA_SEMANAL.reduce((t, s) => t + s.atual, 0))}
            apoio="Ganho por semana"
            faixa={RECEITA_SEMANAL.map((s) => s.atual)}
          />
          <Metrica
            rotulo={`Meta · ${MAYARA.nome}`}
            valor={compacto(MAYARA.realizado)}
            apoio={`Meta ${compacto(MAYARA.meta)}`}
            anel={{ valor: (MAYARA.realizado / MAYARA.meta) * 100, tom: "ok" }}
          />
          <Metrica
            rotulo="Negócios em aberto"
            valor={ABERTOS.length}
            apoio={compacto(ABERTOS.reduce((t, n) => t + n.valor, 0))}
            densidade="compacta"
          />
          <Metrica
            rotulo="Sobre a casca"
            valor={compacto(RECEITA_ATUAL.atual)}
            apoio="Faixa de topo e painéis escuros"
            tom="escuro"
            icone={<TrendingUp aria-hidden />}
            tendencia={{ variacao: Number(VARIACAO_RECEITA.toFixed(1)) }}
            faixa={RECEITA_SEMANAL.slice(-8).map((s) => s.atual)}
          />
        </div>
      </Bloco>

      {/* ═══ Gaveta ═══ */}
      <Bloco
        titulo="GavetaDetalhe"
        descricao="A mesma gaveta abre negócio, tarefa, lead e contrato. Entra com mola, sai pelo mesmo caminho, prende o foco e fecha no Esc. Cinco gavetas diferentes seriam cinco dialetos para manter."
      >
        <div className="ds-linha">
          <Button onClick={() => setGaveta("negocio")}>Abrir negócio · larga</Button>
          <Button variant="outline" onClick={() => setGaveta("tarefa")}>Abrir tarefa · média</Button>
        </div>

        <GavetaDetalhe
          aberta={gaveta === "negocio"}
          aoFechar={() => setGaveta(null)}
          largura="larga"
          entidade={EXEMPLOS.oportunidade}
          abas={abasNegocio}
          rodape={
            <>
              <Button variant="subtle">
                <MessageSquarePlus aria-hidden />
                Registrar atividade
              </Button>
              <Button>Avançar etapa</Button>
            </>
          }
        />

        <GavetaDetalhe
          aberta={gaveta === "tarefa"}
          aoFechar={() => setGaveta(null)}
          entidade={EXEMPLOS.tarefa}
          abas={abasTarefa}
          rodape={
            <>
              <Button variant="subtle">Adiar</Button>
              <Button variant="success">Concluir tarefa</Button>
            </>
          }
        />
      </Bloco>

      {/* ═══ Cliente 360 ═══ */}
      <Bloco
        titulo="Composição · Cliente 360"
        descricao="A prova de que a família se sustenta junta: cabeçalho de cliente, saúde em anel, MRR e plano em métrica, abas trocando conteúdo real e o histórico na mesma linha do tempo do resto do produto."
        fundo="sunken"
      >
        <Tabs value={aba360} onValueChange={setAba360}>
          <CabecalhoEntidade
            {...EXEMPLOS.cliente}
            abas={[
              { valor: "visao", rotulo: "Visão geral" },
              { valor: "contatos", rotulo: "Contatos", contagem: CLIENTE_360.contatos.length },
              { valor: "negocios", rotulo: "Negócios", contagem: NEGOCIOS_DA_CONTA.length },
              { valor: "atividades", rotulo: "Atividades", contagem: ATIVIDADES.length },
              { valor: "financeiro", rotulo: "Financeiro" },
            ]}
            acaoSecundaria={<Button variant="outline" size="sm">Abrir ticket</Button>}
            acaoPrimaria={<Button size="sm">Registrar contato</Button>}
          />

          <div style={{ paddingTop: "var(--space-16)" }}>
            <TabsContent value="visao">
              <div className="of-360">
                <div className="of-360-painel">
                  {/* Três recortes da mesma pergunta dividem uma superfície só.
                      Em três cartões separados, adoção, qualidade e SLA teriam
                      o mesmo peso do MRR, que é o que decide a conversa. */}
                  <div className="of-indicadores">
                    {CLIENTE_360.indicadores.map((indicador) => (
                      <div className="of-indicador" key={indicador.rotulo}>
                        <Anel
                          valor={indicador.valor}
                          tamanho="sm"
                          tom={indicador.valor < 70 ? "risco" : "ok"}
                          descricao={indicador.rotulo}
                        />
                        <div>
                          <strong>{indicador.rotulo}</strong>
                          <small>{indicador.apoio}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="ds-insight">
                    <span className="ds-nexo-marca"><Sparkles aria-hidden /></span>
                    <div>
                      <strong>{INSIGHTS[0].titulo}</strong>
                      <p>{INSIGHTS[0].detalhe}</p>
                    </div>
                  </div>
                </div>

                {/* O momento da composição: saúde e MRR sobre grafite. É o
                    único bloco escuro da tela, e por isso é o que a pessoa lê
                    primeiro. Arcos porque aqui se decide renovar ou resgatar a
                    conta, não porque fica bonito. */}
                <aside className="of-360-lateral">
                  <Momento
                    rotulo="Receita recorrente"
                    titulo={`${brl(CLIENTE_360.mrr)}/mês`}
                    apoio={`${CLIENTE_360.plano} · cliente desde ${CLIENTE_360.desde}`}
                    variante="arcos"
                    /* Sem halo: dentro do bloco escuro o único coral é o anel
                       de saúde. Halo mais anel seriam dois focos brigando. */
                    halo={false}
                  >
                    <div className="of-saude">
                      <Anel
                        valor={CLIENTE_360.saude}
                        tamanho="md"
                        tom="acento"
                        rotulo="Saúde"
                        descricao={`Saúde da conta ${CLIENTE_360.nome}`}
                      />
                      <dl className="of-saude-fatos">
                        <div>
                          <dt>Situação</dt>
                          <dd>{CLIENTE_360.status}</dd>
                        </div>
                        <div>
                          <dt>CS responsável</dt>
                          <dd>{CLIENTE_360.csResponsavel}</dd>
                        </div>
                        <div>
                          <dt>ARR projetado</dt>
                          <dd>{compacto(CLIENTE_360.mrr * 12)}</dd>
                        </div>
                      </dl>
                    </div>
                  </Momento>
                </aside>
              </div>
            </TabsContent>

            <TabsContent value="contatos">
              <ListaContatos />
            </TabsContent>

            <TabsContent value="negocios">
              <div className="of-lista">
                {NEGOCIOS_DA_CONTA.map((negocio) => (
                  <div key={negocio.id} className="of-lista-item">
                    <span className="of-lista-avatar">{negocio.responsavel.iniciais}</span>
                    <div>
                      <strong>{negocio.titulo}</strong>
                      <small>{negocio.etapa} · {negocio.responsavel.nome} · {negocio.proximaAcao}</small>
                    </div>
                    <span className="of-lista-valor">{brl(negocio.valor)}</span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="atividades">
              <LinhaDoTempo eventos={ATIVIDADES} densidade="compacta" />
            </TabsContent>

            <TabsContent value="financeiro">
              <div className="of-metricas">
                <Metrica rotulo="MRR" valor={brl(CLIENTE_360.mrr)} apoio="Cobrança mensal recorrente" />
                {/* ARR é derivado do MRR, não um número novo: 12 ciclos. */}
                <Metrica rotulo="ARR projetado" valor={compacto(CLIENTE_360.mrr * 12)} apoio="12 ciclos no plano atual" />
                <Metrica rotulo="Plano" valor={CLIENTE_360.plano} apoio={`Ativo desde ${CLIENTE_360.desde}`} densidade="compacta" />
                <Metrica rotulo="Contrato em aberto" valor={brl(NEGOCIO.valor)} apoio={NEGOCIO.titulo} densidade="compacta" />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </Bloco>

      <Regras
        faca={{
          titulo: "Um layout, muitos tipos",
          texto:
            "Entidade nova entra como novo `tipo` no mapa de perfis: ícone e campos mudam, o cabeçalho continua o mesmo. Estado sempre colado no nome, ação primária sempre à direita, histórico sempre na mesma linha do tempo.",
        }}
        naoFaca={{
          titulo: "Uma tela por entidade",
          texto:
            "Não crie gaveta, cabeçalho ou timeline específicos para Lead, Ticket ou Contrato. Cada variação solta vira um dialeto para manter e faz o operador reaprender a mesma tela cinco vezes.",
        }}
      />
    </Secao>
  );
}

/* ── Apoio da seção ─────────────────────────────────────────────────────── */

function ListaContatos() {
  return (
    <div className="of-lista">
      {CLIENTE_360.contatos.map((contato) => (
        <div key={contato.nome} className="of-lista-item">
          <span className="of-lista-avatar">{contato.iniciais}</span>
          <div>
            <strong>{contato.nome}</strong>
            <small>{contato.cargo} · {CLIENTE_360.nome}</small>
          </div>
          {contato.principal ? (
            <span className="of-status" data-tom="acento">
              <Star aria-hidden />
              Principal
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function rotuloTipo(tipo: TipoEntidade) {
  const mapa: Record<TipoEntidade, string> = {
    lead: "Lead", contato: "Contato", empresa: "Empresa", oportunidade: "Oportunidade",
    cliente: "Cliente", contrato: "Contrato", ticket: "Ticket", tarefa: "Tarefa",
  };
  return mapa[tipo];
}

/** A ação primária é o próximo passo real daquele tipo, não um "Salvar" genérico. */
function acaoPrimariaPorTipo(tipo: TipoEntidade) {
  const mapa: Record<TipoEntidade, string> = {
    lead: "Qualificar",
    contato: "Ligar",
    empresa: "Novo negócio",
    oportunidade: "Avançar etapa",
    cliente: "Registrar contato",
    contrato: "Ver documento",
    ticket: "Responder",
    tarefa: "Concluir",
  };
  return mapa[tipo];
}
