/**
 * Visões de leitura da Prospecção: Operação (fila BDR), Campanhas e Inteligência.
 * Todo número vem de `operacaoProspeccao` (dados persistidos). Onde não há base
 * para calcular, a tela diz isso em vez de preencher.
 */
import Link from "next/link";
import type { OperacaoProspeccao } from "@/lib/vendas/consultas";
import { MOTIVOS_DESCARTE, type EstadoProspeccao } from "@/lib/vendas/dominio";
import { decorrido } from "./formato";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : "—");
const rotuloMotivo = (m: string) => MOTIVOS_DESCARTE.find((x) => x.chave === m)?.rotulo ?? m;

function Tile({ rotulo, valor, apoio, href, sinal }: { rotulo: string; valor: number | string; apoio?: string; href?: string; sinal?: boolean }) {
  const corpo = (
    <>
      <span className="pp-tile-rotulo">{rotulo}</span>
      <strong className="pp-tile-valor" data-sinal={sinal || undefined}>{valor}</strong>
      {apoio ? <span className="pp-apoio">{apoio}</span> : null}
    </>
  );
  return href ? <Link href={href} className="pp-tile">{corpo}</Link> : <div className="pp-tile">{corpo}</div>;
}

export function VisaoOperacao({ op }: { op: OperacaoProspeccao }) {
  const i = op.indicadores;
  if (op.total === 0) {
    return <div className="pp-vazio"><strong>A base outbound está vazia</strong><p>Adicione uma empresa, importe um CSV ou busque no Apollo para começar a prospectar.</p></div>;
  }
  const lista = (estado: EstadoProspeccao, extra = "") => `/prospeccao?visao=lista&estado=${estado}${extra}`;
  return (
    <div className="pp-visao">
      <section aria-label="Indicadores" className="pp-tiles">
        <Tile rotulo="Novos" valor={op.porEstado.novo} apoio="ainda sem abordagem" href={lista("novo")} />
        <Tile rotulo="Em cadência" valor={op.porEstado.em_cadencia} apoio={`${i.cadenciaAtiva} ativas, ${i.cadenciaPausada} pausadas`} href={lista("em_cadencia")} />
        <Tile rotulo="Responderam" valor={op.porEstado.respondeu} sinal={op.porEstado.respondeu > 0}
          apoio={i.respondeuMaisAntigoHoras != null ? `a mais antiga espera há ${decorrido(i.respondeuMaisAntigoHoras)}` : "ninguém aguardando"} href={lista("respondeu")} />
        <Tile rotulo="Pré-qualificados" valor={op.porEstado.pre_qualificado} apoio="entregues a Pré-vendas" href={lista("pre_qualificado")} />
        <Tile rotulo="Oportunidades diretas" valor={op.porEstado.oportunidade} apoio="foram ao Pipeline" href={lista("oportunidade")} />
        <Tile rotulo="Sem resposta" valor={op.porEstado.sem_resposta} href={lista("sem_resposta")} />
        <Tile rotulo="Descartados" valor={op.porEstado.descartado} href={lista("descartado")} />
        <Tile rotulo="Adicionados em 7 dias" valor={i.adicionadosUltimos7Dias} />
      </section>

      <section aria-label="Pedem atenção" className="pp-bloco">
        <h2>Pedem atenção</h2>
        <ul className="pp-atencao">
          <li><Link href="/prospeccao?visao=lista&fila=sem_responsavel">{i.novosSemResponsavel > 0 ? `${i.novosSemResponsavel} novos sem responsável` : "Nenhum novo sem responsável"}</Link></li>
          <li><Link href="/prospeccao?visao=lista&fila=sem_contato">{i.semContato > 0 ? `${i.semContato} sem e-mail nem telefone` : "Todos têm algum contato"}</Link></li>
          <li><Link href="/prospeccao?visao=lista&fila=cadencia_com_falha">{i.cadenciaComFalha > 0 ? `${i.cadenciaComFalha} com cadência que falhou` : "Nenhuma cadência com falha"}</Link></li>
          <li><Link href="/prospeccao?visao=lista&fila=cadencia_pausada">{i.cadenciaPausada > 0 ? `${i.cadenciaPausada} com cadência pausada` : "Nenhuma cadência pausada"}</Link></li>
        </ul>
      </section>

      <section aria-label="Fila por responsável" className="pp-bloco">
        <h2>Fila por responsável</h2>
        {op.filaPorResponsavel.length === 0 ? <p className="ov-nota">Nenhuma empresa em Novo, Em cadência ou Respondeu.</p> : (
          <div className="pp-rolagem-x">
            <table className="pp-tabela-simples">
              <thead><tr><th>Responsável</th><th>Novo</th><th>Em cadência</th><th>Respondeu</th><th>Total</th></tr></thead>
              <tbody>
                {op.filaPorResponsavel.map((f) => {
                  const resp = `&responsavel=${f.responsavelId ?? "sem"}`;
                  return (
                    <tr key={f.responsavelId ?? "sem"}>
                      <td><Link href={`/prospeccao?visao=kanban${resp}`}>{f.nome}</Link></td>
                      <td>{f.novo}</td><td>{f.emCadencia}</td><td>{f.respondeu}</td><td>{f.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function VisaoCampanhas({ op }: { op: OperacaoProspeccao }) {
  return (
    <div className="pp-visao">
      <section className="pp-bloco" aria-label="Listas">
        <h2>Listas em uso</h2>
        {op.listas.length === 0 ? <p className="ov-nota">Nenhuma lista ainda. Listas nascem ao adicionar ou importar empresas informando o nome da lista.</p> : (
          <div className="pp-rolagem-x"><table className="pp-tabela-simples">
            <thead><tr><th>Lista</th><th>Empresas</th><th>Em aberto</th></tr></thead>
            <tbody>{op.listas.map((l) => (
              <tr key={l.nome}><td><Link href={`/prospeccao?visao=lista&lista=${encodeURIComponent(l.nome)}`}>{l.nome}</Link></td><td>{l.total}</td><td>{l.abertas}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <section className="pp-bloco" aria-label="Cadências">
        <h2>Cadências que já receberam prospects</h2>
        {op.cadencias.length === 0 ? <p className="ov-nota">Nenhum prospect entrou em cadência ainda. As cadências são configuradas em Automações › Cadências e consumidas aqui.</p> : (
          <div className="pp-rolagem-x"><table className="pp-tabela-simples">
            <thead><tr><th>Cadência</th><th>Matriculados</th><th>Ativos</th><th>Responderam</th><th>Concluídos</th><th>Falhas</th></tr></thead>
            <tbody>{op.cadencias.map((c) => (
              <tr key={c.id}><td><Link href={`/prospeccao?visao=lista&cadencia=${c.id}`}>{c.nome}</Link></td><td>{c.matriculados}</td><td>{c.ativos}</td><td>{c.responderam}</td><td>{c.concluidos}</td><td>{c.falhas}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <p className="ov-nota">Campanhas de disparo para a base outbound, com métricas por campanha, entram na Fase 2. Hoje a abordagem é feita por cadência.</p>
    </div>
  );
}

export function VisaoInteligencia({ op }: { op: OperacaoProspeccao }) {
  const f = op.funil;
  const linhas: Array<[string, number, string]> = [
    ["Na base", f.base, "—"],
    ["Chegaram a Em cadência", f.chegaramEmCadencia, pct(f.chegaramEmCadencia, f.base)],
    ["Responderam", f.responderam, pct(f.responderam, f.chegaramEmCadencia)],
    ["Pré-qualificados", f.preQualificados, pct(f.preQualificados, f.base)],
    ["Oportunidades diretas", f.oportunidades, pct(f.oportunidades, f.base)],
    ["Descartados", f.descartados, pct(f.descartados, f.base)],
  ];
  return (
    <div className="pp-visao">
      <section className="pp-bloco" aria-label="Funil">
        <h2>Funil da base</h2>
        {f.base === 0 ? <p className="ov-nota">Sem prospects para medir.</p> : (
          <div className="pp-rolagem-x"><table className="pp-tabela-simples">
            <thead><tr><th>Marco</th><th>Empresas</th><th>Taxa</th></tr></thead>
            <tbody>{linhas.map(([r, n, t]) => <tr key={r}><td>{r}</td><td>{n}</td><td>{t}</td></tr>)}</tbody>
          </table></div>
        )}
        <p className="ov-nota">
          {f.chegaramEmCadencia === 0
            ? "Nenhum prospect passou por cadência neste ambiente, então a taxa de resposta ainda não tem base. Pré-qualificados do histórico anterior entraram sem cadência."
            : "Taxa de resposta = responderam ÷ chegaram a cadência. As demais são sobre a base. Os marcos vêm do histórico de mudanças de estado."}
        </p>
      </section>
      <section className="pp-bloco" aria-label="Descartes">
        <h2>Motivos de descarte</h2>
        {op.descartePorMotivo.length === 0 ? <p className="ov-nota">Nenhum prospect descartado ainda.</p> : (
          <ul className="pp-atencao">{op.descartePorMotivo.map((d) => <li key={d.motivo}>{rotuloMotivo(d.motivo)}: <strong>{d.n}</strong></li>)}</ul>
        )}
      </section>
      <p className="ov-nota">Cruzamentos por fonte, lista, família e período entram nas próximas fases.</p>
    </div>
  );
}
