"use client";

import { Search } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PaginaCabecalho, PaginaResumo, type ItemResumo } from "@/components/onface/shell/Pagina";

/**
 * Cabeçalho do Customer Success.
 *
 * Era `CsHero`: uma faixa grafite de 28px de raio, com micro-label em caixa
 * alta, `h1` próprio, cards dentro da faixa e lime como acento. Quatro
 * problemas, nenhum deles só de gosto:
 *
 * 1. **Três nomes para a mesma tela.** A trilha dizia "Customer Success", o
 *    cabeçalho da página dizia "CS", o micro-label dizia "Customer Success" de
 *    novo e o `h1` dizia "Visão operacional da carteira". Sobra um nome.
 * 2. **Card dentro de card.** A faixa era uma superfície, e dentro dela vinham
 *    o bloco de MRR (raio 22) e seis botões (raio 18). O piso de qualidade
 *    proíbe, e a tela ficava com três níveis de caixa antes do primeiro dado.
 * 3. **Lime é do CRM legado.** O acento do ONFACE é coral. Manter lime aqui
 *    era manter duas marcas na mesma sessão.
 * 4. **Hero dentro de software operacional.** Esta tela é triagem: a pessoa
 *    abre para saber quantos clientes precisam dela hoje.
 *
 * Escopo e busca continuam, agora na gramática que as outras telas já falam:
 * cabeçalho compacto com os controles à direita, e a faixa de resumo — uma
 * superfície só, colunas separadas por hairline.
 *
 * A hierarquia continua de pé e ficou mais explícita: MRR é o contexto
 * (destaque, maior), e coral aparece só nos números que acusam problema.
 */

export interface PulsoCs {
  clientesAtivos: number; mrrCarteira: number; emOnboarding: number; emImplantacao: number;
  emRisco: number; inadimplentes: number; renovacoesProximas: number; expansoesAbertas: number;
  tarefasVencidas: number; checkpointsAtrasados: number; semProximaAcao: number; semDono: number;
}

export type Escopo = "todos" | "me" | "sem_dono";

const ESCOPOS: Array<[Escopo, string]> = [
  ["todos", "Toda a carteira"],
  ["me", "Minha carteira"],
  ["sem_dono", "Sem responsável"],
];

function brlCompacto(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1000)}k`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function Cf2CsCabecalho({
  pulso, escopo, onEscopo, busca, onBusca,
}: {
  pulso?: PulsoCs;
  escopo: Escopo;
  onEscopo: (e: Escopo) => void;
  busca: string;
  onBusca: (v: string) => void;
}) {
  // Antes de `/api/cs/pulso` responder, o travessão. Mostrar "0 em risco"
  // nesse intervalo seria afirmar o que a tela ainda não sabe.
  //
  // Esta faixa é PULSO: a saúde da carteira inteira, não a fila de hoje. A
  // distinção não é de gosto — as duas coisas vêm de endpoints diferentes e
  // dão números diferentes. Enquanto os seis números daqui eram botões de
  // filtro, "Em risco 24" (carteira) recortava uma fila que tinha outra
  // contagem, e "Exigem atenção" e "Expansões" não correspondiam a segmento
  // nenhum: `itemNoSegmento` caía no `default: false` e a fila ficava vazia.
  // Dois filtros mortos parecendo vivos. O recorte da fila é a linha de chips
  // logo acima dela, que sempre leu a contagem certa.
  //
  // Só "Em risco" é coral, e não os dois. Medido na base: dos 24 riscos
  // abertos, ZERO são não-financeiros — "Em risco 24" e "Inadimplentes 18"
  // acusam o mesmo problema contado de dois jeitos, e dois alarmes lado a
  // lado somam 42 na cabeça de quem lê. Inadimplentes continua visível
  // porque é o recorte que o financeiro cobra; deixa de ser um segundo
  // alarme.
  const fatos: ItemResumo[] = pulso
    ? [
        { rotulo: "MRR da carteira", valor: brlCompacto(pulso.mrrCarteira), destaque: true, detalhe: `${pulso.clientesAtivos} clientes ativos` },
        { rotulo: "Em entrega", valor: pulso.emOnboarding + pulso.emImplantacao, detalhe: `${pulso.emOnboarding} onboarding · ${pulso.emImplantacao} implantação` },
        { rotulo: "Em risco", valor: pulso.emRisco, detalhe: "sinal aberto", sinal: true },
        { rotulo: "Inadimplentes", valor: pulso.inadimplentes, detalhe: "cobrança irregular" },
        { rotulo: "Renovações", valor: pulso.renovacoesProximas, detalhe: "na janela" },
        { rotulo: "Expansões", valor: pulso.expansoesAbertas, detalhe: "em aberto" },
      ]
    : [
        { rotulo: "MRR da carteira", valor: "—", destaque: true },
        { rotulo: "Em entrega", valor: "—" },
        { rotulo: "Em risco", valor: "—" },
        { rotulo: "Inadimplentes", valor: "—" },
        { rotulo: "Renovações", valor: "—" },
        { rotulo: "Expansões", valor: "—" },
      ];

  return (
    <>
      <PaginaCabecalho
        titulo="Customer Success"
        acoes={
          <>
            {/* Escopo é um recorte com exatamente uma escolha ativa, então
                `type="single"`. `value` nunca vira string vazia: clicar no
                item já ativo devolve "" no Radix, e "toda a carteira" é o
                estado neutro — desmarcar não significa "nenhuma carteira". */}
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={escopo}
              onValueChange={(v) => onEscopo((v || "todos") as Escopo)}
              aria-label="Escopo da carteira"
            >
              {ESCOPOS.map(([chave, rotulo]) => (
                <ToggleGroupItem key={chave} value={chave}>
                  {rotulo}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <InputGroup className="w-[190px]">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={busca}
                onChange={(e) => onBusca(e.target.value)}
                placeholder="Buscar cliente"
                aria-label="Buscar cliente"
                type="search"
              />
            </InputGroup>
          </>
        }
      />

      <PaginaResumo itens={fatos} />
    </>
  );
}
