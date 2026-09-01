"use client";

/**
 * Catálogo dos blocos de composição — os agrupamentos que toda tela repete.
 * É aqui que o design system deixa de ser "peças soltas" e vira montagem.
 */
import * as React from "react";
import { Phone, Mail, Plus, Building2, Filter, CalendarDays } from "lucide-react";
import { Secao, Amostra, Grade, Painel } from "./Base";
import { Button } from "@/components/ui/button";
import { Cf2Avatar } from "@/components/crm2/ds/Avatar";
import { Cf2Status } from "@/components/crm2/ds/Status";
import {
  Cf2CabecalhoEntidade, Cf2BarraFiltros, Cf2Metrica, Cf2Etapas, Cf2ItemLista,
} from "@/components/crm2/ds/Blocos";

const SERIE = [{ v: 21 }, { v: 26 }, { v: 24 }, { v: 31 }, { v: 29 }, { v: 38 }];
const SERIE_BAIXA = [{ v: 44 }, { v: 41 }, { v: 36 }, { v: 33 }, { v: 29 }, { v: 24 }];

export function CatalogoBlocos() {
  const [filtros, setFiltros] = React.useState([
    { chave: "resp", rotulo: "Responsável: Mayara" },
    { chave: "per", rotulo: "Agosto/2026" },
    { chave: "org", rotulo: "Meta Ads" },
  ]);

  return (
    <div className="flex flex-col gap-10">
      <Secao
        id="bloco-cabecalho"
        titulo="Cabeçalho de entidade"
        descricao="Topo de qualquer tela de detalhe — lead, empresa, negócio, cliente. Identidade à esquerda, ação primária à direita, metadados numa linha discreta. Sempre nessa ordem, para a pessoa não reaprender a tela a cada entidade."
      >
        <Painel className="cf2-p-card">
          <Cf2CabecalhoEntidade
            avatar={<Cf2Avatar nome="Contabilix" tipo="empresa" size="lg" />}
            titulo="Contabilix"
            subtitulo="Contabilidade · 40–80 funcionários · Belo Horizonte/MG"
            status={<Cf2Status tom="positivo">Cliente ativo</Cf2Status>}
            meta={
              <>
                <span className="inline-flex items-center gap-1"><Building2 className="size-3" />CNPJ 12.345.678/0001-90</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />Cliente desde 24/03/2026</span>
                <span>Responsável · Mayara Anjos</span>
              </>
            }
            acoes={
              <>
                <Button size="sm" variant="outline"><Phone />Ligar</Button>
                <Button size="sm" variant="outline"><Mail />E-mail</Button>
                <Button size="sm"><Plus />Novo negócio</Button>
              </>
            }
          />
        </Painel>
      </Secao>

      <Secao
        id="bloco-filtros"
        titulo="Barra de filtros"
        descricao="Filtro aplicado vira ficha removível. Sem isso a pessoa não entende por que a lista tem 3 itens — é o erro de percepção mais comum em tela filtrada, e custa suporte."
      >
        <Painel className="cf2-p-card">
          <Cf2BarraFiltros
            aplicados={filtros.map((f) => ({
              ...f,
              aoRemover: () => setFiltros((atual) => atual.filter((x) => x.chave !== f.chave)),
            }))}
            aoLimparTudo={() => setFiltros([])}
          >
            <Button size="sm" variant="outline"><Filter />Filtros</Button>
            <Button size="sm" variant="subtle"><CalendarDays />Período</Button>
          </Cf2BarraFiltros>
          {filtros.length === 0 && (
            <p className="text-apoio text-tinta-fraca mt-2">
              Sem filtro aplicado — a barra some sozinha, não deixa espaço morto.
            </p>
          )}
        </Painel>
      </Secao>

      <Secao
        id="bloco-metrica"
        titulo="Métrica"
        descricao="Rótulo pequeno, valor dominante, variação com sinal e tendência opcional. A variação é o que dá SENTIDO ao número — 'R$ 43 mil' sozinho não diz se é bom."
      >
        <Painel className="cf2-p-card">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
            <Cf2Metrica rotulo="MRR fechado" valor="R$ 43.800" variacao={10.9} serie={SERIE} tomSerie="positivo" />
            <Cf2Metrica rotulo="Novos negócios" valor="51" variacao={4.2} serie={SERIE} />
            <Cf2Metrica rotulo="Ticket médio" valor="R$ 859" variacao={-3.1} serie={SERIE_BAIXA} tomSerie="negativo" />
            <Cf2Metrica rotulo="Ciclo de venda" valor="18 dias" variacao={null} ajuda="Sem base comparável no período anterior" />
          </div>
        </Painel>
      </Secao>

      <Secao
        id="bloco-etapas"
        titulo="Etapas"
        descricao="Progresso por etapa NOMEADA — onboarding, implantação, funil. Diferente de uma barra de porcentagem: aqui o nome é que responde 'onde estamos'."
      >
        <Grade min={320}>
          <Amostra rotulo="Onboarding em andamento" codigo="<Cf2Etapas />">
            <Cf2Etapas etapas={["Contrato", "Dados", "Configuração", "Treinamento", "Go-live"]} atual={2} />
          </Amostra>
          <Amostra rotulo="Quase concluído" codigo="atual={4}">
            <Cf2Etapas etapas={["Contrato", "Dados", "Configuração", "Treinamento", "Go-live"]} atual={4} />
          </Amostra>
        </Grade>
      </Secao>

      <Secao
        id="bloco-lista"
        titulo="Item de lista"
        descricao="A alternativa à tabela quando cada registro tem forma irregular — conversa, atividade, notificação. Mesma densidade, sem a rigidez de colunas."
      >
        <Painel className="p-2 max-w-xl">
          <Cf2ItemLista
            ativo
            inicio={<Cf2Avatar nome="Mayara Anjos" tipo="pessoa" size="default" />}
            titulo="Mayara Anjos"
            subtitulo="Confirmou a reunião de quinta às 15h"
            fim={<span className="text-apoio text-tinta-fraca">14:32</span>}
            aoClicar={() => {}}
          />
          <Cf2ItemLista
            inicio={<Cf2Avatar nome="Contabilix" tipo="empresa" size="default" />}
            titulo="Contabilix"
            subtitulo="Proposta visualizada · Plano Pro"
            fim={<Cf2Status tom="informativo">Novo</Cf2Status>}
            aoClicar={() => {}}
          />
          <Cf2ItemLista
            inicio={<Cf2Avatar nome={null} tipo="agente" size="default" />}
            titulo="Agente de qualificação"
            subtitulo="12 leads qualificados automaticamente"
            fim={<span className="text-apoio text-tinta-fraca">ontem</span>}
            aoClicar={() => {}}
          />
        </Painel>
      </Secao>
    </div>
  );
}
