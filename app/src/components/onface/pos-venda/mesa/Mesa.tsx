"use client";

/**
 * A mesa de trabalho do pós-venda.
 *
 * Substitui o board. O board era uma tabela densa com filtro, ordenação,
 * busca, recortes e alternância de visão — instrumento correto para varrer
 * centenas de linhas, e errado para o tamanho real deste trabalho: 14
 * projetos abertos em produção, 19 em homologação. Com quatorze itens, a
 * pessoa passa a operar o instrumento em vez de fazer o trabalho, e foi daí
 * que veio o "ficou grande".
 *
 * A mesa mostra TODO o trabalho em aberto de uma vez, sem filtro e sem
 * rolagem, agrupado por quem está com a bola. E dá peso proporcional ao que
 * se pode fazer:
 *
 *   - o que precisa de você vira linha inteira, com o verbo na frente;
 *   - o que está andando vira linha discreta;
 *   - o que espera outra pessoa vira ficha com relógio.
 *
 * Duas ações acontecem AQUI, sem entrar no projeto: passar a bola (marcar
 * espera) e trazer de volta (encerrar espera). É o que separa uma mesa de
 * trabalho de uma lista de leitura.
 *
 * O arquivo — concluídos, cancelados e busca por cliente — mora em
 * `/pos-vendas/todos`, porque procurar é outro trabalho e pede outro
 * instrumento.
 */
import { useMemo, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Check, CornerUpLeft, Hourglass, Inbox, Play } from "lucide-react";
import type { CartaoDoProjeto, MotivoDaEspera, TipoDeProjeto } from "@/lib/pos-venda/contrato";
import { MOTIVOS, TIPO } from "../formatos";
import { montarMesa, oQueFazer, porQue, QUEM } from "./bola";
import { FichaDeEspera, FichaParada, LinhaCalma, LinhaDeAcao } from "./pecas-da-mesa";
import { ModoFoco } from "./ModoFoco";

export interface AcoesDaMesa {
  passarBola(projetoId: string, motivo: MotivoDaEspera, detalhe: string): Promise<{ ok: boolean; erro?: string }>;
  trazerDeVolta(projetoId: string): Promise<{ ok: boolean; erro?: string }>;
}

type Mudanca =
  | { t: "espera"; id: string; motivo: MotivoDaEspera }
  | { t: "volta"; id: string };

/** Move o cartão entre as faixas na hora, antes do servidor confirmar. */
function aplicar(cartoes: CartaoDoProjeto[], m: Mudanca): CartaoDoProjeto[] {
  return cartoes.map((c) => {
    if (c.id !== m.id) return c;
    if (m.t === "volta") return { ...c, relogios: { ...c.relogios, esperando: null } };
    return { ...c, relogios: { ...c.relogios, esperando: { motivo: m.motivo, desde: new Date(), detalhe: null } } };
  });
}

export function Mesa({
  cartoes, agora, acoes, recorte = null,
}: {
  cartoes: CartaoDoProjeto[];
  agora: Date;
  acoes: AcoesDaMesa;
  /** Quando a URL pede só uma jornada (`?aba=imp|onb`), a mesa diz isso e oferece a saída. */
  recorte?: TipoDeProjeto | null;
}) {
  const [otimistas, mudar] = useOptimistic(cartoes, aplicar);
  const [, comecar] = useTransition();
  const [foco, setFoco] = useState(false);

  const mesa = useMemo(() => montarMesa(otimistas, agora), [otimistas, agora]);

  const executar = (m: Mudanca, fazer: () => Promise<{ ok: boolean; erro?: string }>, sucesso: string) =>
    comecar(async () => {
      mudar(m);
      try {
        const r = await fazer();
        if (!r.ok) toast.error(r.erro ?? "Não consegui gravar.");
        else toast.success(sucesso);
      } catch {
        toast.error("Não consegui falar com o servidor. Tente de novo.");
      }
    });

  const passarBola = (c: CartaoDoProjeto, motivo: MotivoDaEspera) =>
    executar(
      { t: "espera", id: c.id, motivo },
      () => acoes.passarBola(c.id, motivo, ""),
      `${c.empresa.nome}: a bola passou para ${MOTIVOS[motivo].rotulo.toLowerCase()}. O relógio do time pausou.`,
    );

  const trazerDeVolta = (c: CartaoDoProjeto) =>
    executar({ t: "volta", id: c.id }, () => acoes.trazerDeVolta(c.id), `${c.empresa.nome} voltou para a casa.`);

  /*
   * Nada em aberto: a mesa inteira dá lugar ao vazio, e nenhuma faixa
   * aparece.
   *
   * Isto apareceu renderizando a tela com zero entregas, que é um estado que
   * homologação nunca produz. Sem esta saída, desenhavam-se DOIS vazios
   * empilhados e contraditórios: a faixa dizia "nada esperando você, todas as
   * entregas em aberto estão andando" logo acima de "nenhuma entrega em
   * aberto". Faixa de trabalho sem trabalho nenhum não é um fim de dia, é uma
   * moldura vazia.
   */
  if (mesa.abertos === 0) {
    return (
      <div className="mz">
        <div className="mz-vazio" role="status">
          <Inbox aria-hidden />
          <h2>Nenhuma entrega em aberto</h2>
          <p>Os projetos nascem quando uma venda é ganha. Assim que a próxima fechar, ela aparece aqui com as tarefas e o prazo prontos.</p>
          <Link className="mz-arquivo" href="/pos-vendas/todos">
            Ver os {mesa.encerrados > 0 ? `${mesa.encerrados} ` : ""}encerrados <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mz">
      {/* Recorte herdado de um endereço antigo. A mesa não esconde que está
          vendo menos do que existe, e a saída fica do lado. */}
      {recorte ? (
        <p className="mz-recorte" role="status">
          Vendo só <strong>{TIPO[recorte]}</strong>, porque o endereço pedia.
          <Link href="/pos-vendas">Ver todas as entregas</Link>
        </p>
      ) : null}

      <div className="mz-topo">
        <p className="mz-conta">
          <strong className="mz-num">{mesa.abertos}</strong>
          {mesa.abertos === 1 ? " entrega em aberto" : " entregas em aberto"}
          {mesa.voce.length > 0 ? <> · <strong className="mz-num">{mesa.voce.length}</strong> {mesa.voce.length === 1 ? "travada" : "travadas"}</> : null}
          {mesa.nunca.length > 0 ? <> · <strong className="mz-num">{mesa.nunca.length}</strong> {mesa.nunca.length === 1 ? "nunca começou" : "nunca começaram"}</> : null}
        </p>
        <div className="mz-topo-acoes">
          {mesa.voce.length > 0 ? (
            <button type="button" className="mz-foco-abrir" onClick={() => setFoco(true)}>
              <Play aria-hidden /> Entrar no foco
            </button>
          ) : null}
          <Link className="mz-arquivo" href="/pos-vendas/todos">
            Todos os projetos
            {mesa.encerrados > 0 ? <span className="mz-num"> · {mesa.encerrados} encerrados</span> : null}
            <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>

      {/* PRECISA DE VOCÊ — a única faixa que ganha a linha inteira. */}
      <section className="mz-faixa" data-posse="voce" aria-labelledby="mz-voce">
        <header className="mz-faixa-cab">
          <span className="mz-ponto" aria-hidden />
          <h2 id="mz-voce" className="mz-faixa-titulo">{QUEM.voce.titulo}</h2>
          {mesa.voce.length > 0 ? <span className="mz-faixa-n mz-num">{mesa.voce.length}</span> : null}
          <span className="mz-faixa-criterio">{QUEM.voce.criterio}</span>
        </header>

        {mesa.voce.length > 0 ? (
          <ul className="mz-acoes">
            {mesa.voce.map((c) => (
              <LinhaDeAcao
                key={c.id}
                c={c}
                verbo={oQueFazer(c)}
                motivo={porQue(c, agora)}
                aoPassarBola={(m) => passarBola(c, m)}
              />
            ))}
          </ul>
        ) : (
          /* O fim do dia. Nenhuma das versões anteriores desta tela tinha um
             fim: lista não termina, e tarefa em aberto ocupa a cabeça. Esta é
             a única celebração da tela, e ela só aparece quando é verdade. */
          <div className="mz-zerou" role="status">
            <Check aria-hidden />
            <div>
              <strong>Nada esperando você agora.</strong>
              <span>
                {mesa.esperando.length > 0
                  ? `${mesa.esperando.reduce((n, g) => n + g.cartoes.length, 0)} entregas estão com outra pessoa. Você vai saber quando voltarem.`
                  : "Todas as entregas em aberto estão andando."}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* NUNCA COMEÇARAM — ficha, não linha. A ação é a mesma para todas; o
          que distingue é a empresa e a idade. Treze linhas repetindo o mesmo
          verbo fazem o verbo parar de informar. */}
      {mesa.nunca.length > 0 ? (
        <section className="mz-faixa" data-posse="nunca" aria-labelledby="mz-nunca">
          <header className="mz-faixa-cab">
            <span className="mz-ponto" aria-hidden />
            <h2 id="mz-nunca" className="mz-faixa-titulo">{QUEM.nunca.titulo}</h2>
            <span className="mz-faixa-n mz-num">{mesa.nunca.length}</span>
            <span className="mz-faixa-criterio">{QUEM.nunca.criterio}</span>
          </header>
          <ul className="mz-fichas">
            {mesa.nunca.map((c) => (
              <FichaParada key={c.id} c={c} agora={agora} />
            ))}
          </ul>
          {/* O número que explica a fila, dito uma vez, em vez de repetido em
              cada linha. Em produção os 5 playbooks estão sem responsável
              padrão: por isso projeto novo nasce órfão e fica. */}
          {mesa.nunca.some((c) => !c.responsavel) ? (
            <p className="mz-nota">
              {mesa.nunca.filter((c) => !c.responsavel).length} destas não têm responsável. Enquanto o playbook da família não tiver dono padrão, toda entrega nova entra assim.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ANDANDO — linha discreta: você só precisa saber que não parou. */}
      {mesa.andando.length > 0 ? (
        <section className="mz-faixa" data-posse="andando" aria-labelledby="mz-andando">
          <header className="mz-faixa-cab">
            <span className="mz-ponto" aria-hidden />
            <h2 id="mz-andando" className="mz-faixa-titulo">{QUEM.andando.titulo}</h2>
            <span className="mz-faixa-n mz-num">{mesa.andando.length}</span>
            <span className="mz-faixa-criterio">{QUEM.andando.criterio}</span>
          </header>
          <ul className="mz-calmas">
            {mesa.andando.map((c) => (
              <LinhaCalma key={c.id} c={c} agora={agora} aoPassarBola={(m) => passarBola(c, m)} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* ESPERANDO — ficha e relógio. Não dá para agir, então não ocupa linha. */}
      {mesa.esperando.map((g) => (
        <section className="mz-faixa" data-posse={g.motivo} key={g.motivo} aria-labelledby={`mz-${g.motivo}`}>
          <header className="mz-faixa-cab">
            <span className="mz-ponto" aria-hidden />
            <h2 id={`mz-${g.motivo}`} className="mz-faixa-titulo">{QUEM[g.motivo].titulo}</h2>
            <span className="mz-faixa-n mz-num">{g.cartoes.length}</span>
            <span className="mz-faixa-criterio">{QUEM[g.motivo].criterio}</span>
          </header>
          <ul className="mz-fichas">
            {g.cartoes.map((c) => (
              <FichaDeEspera key={c.id} c={c} agora={agora} aoVoltar={() => trazerDeVolta(c)} />
            ))}
          </ul>
        </section>
      ))}

      {foco ? (
        <ModoFoco
          cartoes={mesa.voce}
          agora={agora}
          aoFechar={() => setFoco(false)}
          aoPassarBola={(c, m) => passarBola(c, m)}
        />
      ) : null}
    </div>
  );
}

/** Reexportado para a faixa de espera reusar o mesmo vocabulário de ícone. */
export const ICONE_DA_ESPERA = { cliente: Hourglass, operadora: Hourglass, interno: CornerUpLeft } as const;
