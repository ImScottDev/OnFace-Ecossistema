"use client";

/* Operação, Campanhas e Inteligência da Prospecção, no vocabulário visual da
 * lista de Pré-vendas (cartão branco de 12px com anel #e3e7e8, cabeçalho em
 * Plus Jakarta 13/700, cabeçalho de tabela #fafafa em 10.5px, linhas com fio
 * #f3f5f5). Todo número vem de `operacaoProspeccao` (dados persistidos); onde
 * não há base para calcular, a tela diz isso.
 */

import * as React from "react";
import Link from "next/link";
import type { OperacaoProspeccao } from "@/lib/vendas/consultas";
import { MOTIVOS_DESCARTE, type EstadoProspeccao } from "@/lib/vendas/dominio";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : "—");
const rotuloMotivo = (m: string) => MOTIVOS_DESCARTE.find((x) => x.chave === m)?.rotulo ?? m;
const horas = (h: number) => (h < 1 ? "agora" : h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`);

const CARTAO = { background: "#fff", borderRadius: "12px", boxShadow: "inset 0 0 0 1px #e3e7e8", overflow: "hidden" } as const;
const LINK = { color: "#c2330f", fontWeight: 600, textDecoration: "none" } as const;

function Bloco({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} style={CARTAO}>
      <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "11px 14px", borderBottom: "1px solid #eef1f1", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", fontWeight: 700, whiteSpace: "nowrap" }}>{titulo}</span>
        {sub ? <span style={{ fontSize: "12px", color: "#4a5560" }}>{sub}</span> : null}
      </div>
      {children}
    </section>
  );
}
const Vazio = ({ children }: { children: React.ReactNode }) => <div style={{ padding: "18px 16px", fontSize: "12.5px", color: "#4a5560", lineHeight: 1.5 }}>{children}</div>;

function Tabela({ colunas, linhas }: { colunas: string[]; linhas: React.ReactNode[][] }) {
  const grade = `minmax(160px,2fr) ${colunas.slice(1).map(() => "minmax(70px,1fr)").join(" ")}`;
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: `${160 + (colunas.length - 1) * 80}px` }}>
        <div style={{ display: "grid", gridTemplateColumns: grade, gap: "10px", padding: "8px 14px", background: "#fafafa", borderBottom: "1px solid #eef1f1", fontSize: "10.5px", fontWeight: 600, color: "#4a5560", letterSpacing: ".05em" }}>
          {colunas.map((c, i) => <div key={c} style={{ textAlign: i === 0 ? "left" : "right" }}>{c.toUpperCase()}</div>)}
        </div>
        {linhas.map((l, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: grade, gap: "10px", padding: "10px 14px", alignItems: "center", borderBottom: "1px solid #f3f5f5", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
            {l.map((c, j) => <div key={j} style={{ textAlign: j === 0 ? "left" : "right", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ rotulo, valor, apoio, href, sinal }: { rotulo: string; valor: number | string; apoio?: string; href?: string; sinal?: boolean }) {
  const corpo = (
    <>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "#4a5560" }}>{rotulo}</span>
      <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "24px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-.02em", color: sinal ? "#c2330f" : "#12171d", fontVariantNumeric: "tabular-nums" }}>{valor}</span>
      {apoio ? <span style={{ fontSize: "11.5px", color: "#6d747e", lineHeight: 1.35 }}>{apoio}</span> : null}
    </>
  );
  const estiloTile = { display: "flex", flexDirection: "column", gap: "4px", padding: "12px 14px", ...CARTAO, textDecoration: "none", color: "inherit" } as React.CSSProperties;
  return href ? <Link href={href} style={estiloTile}>{corpo}</Link> : <div style={estiloTile}>{corpo}</div>;
}

export function VisaoOperacao({ op }: { op: OperacaoProspeccao }) {
  const i = op.indicadores;
  if (op.total === 0) {
    return <Bloco titulo="Operação"><Vazio>A base outbound está vazia. Adicione uma empresa, importe um CSV ou busque no Apollo para começar a prospectar.</Vazio></Bloco>;
  }
  const lista = (e: EstadoProspeccao) => `/prospeccao?estado=${e}`;
  const atencao: Array<[string, string]> = [
    [i.novosSemResponsavel > 0 ? `${i.novosSemResponsavel} novos sem responsável` : "Nenhum novo sem responsável", "/prospeccao?fila=sem_responsavel"],
    [i.semContato > 0 ? `${i.semContato} sem e-mail nem telefone` : "Todos têm algum contato", "/prospeccao?fila=sem_contato"],
    [i.cadenciaComFalha > 0 ? `${i.cadenciaComFalha} com cadência que falhou` : "Nenhuma cadência com falha", "/prospeccao?fila=cadencia_com_falha"],
    [i.cadenciaPausada > 0 ? `${i.cadenciaPausada} com cadência pausada` : "Nenhuma cadência pausada", "/prospeccao?fila=cadencia_pausada"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(176px,1fr))", gap: "10px" }}>
        <Tile rotulo="Novos" valor={op.porEstado.novo} apoio="ainda sem abordagem" href={lista("novo")} />
        <Tile rotulo="Em cadência" valor={op.porEstado.em_cadencia} apoio={`${i.cadenciaAtiva} ativas, ${i.cadenciaPausada} pausadas`} href={lista("em_cadencia")} />
        <Tile rotulo="Responderam" valor={op.porEstado.respondeu} sinal={op.porEstado.respondeu > 0}
          apoio={i.respondeuMaisAntigoHoras != null ? `a mais antiga espera há ${horas(i.respondeuMaisAntigoHoras)}` : "ninguém aguardando"} href={lista("respondeu")} />
        <Tile rotulo="Pré-qualificados" valor={op.porEstado.pre_qualificado} apoio="entregues a Pré-vendas" href={lista("pre_qualificado")} />
        <Tile rotulo="Oportunidades diretas" valor={op.porEstado.oportunidade} apoio="foram ao Pipeline" href={lista("oportunidade")} />
        <Tile rotulo="Sem resposta" valor={op.porEstado.sem_resposta} href={lista("sem_resposta")} />
        <Tile rotulo="Descartados" valor={op.porEstado.descartado} href={lista("descartado")} />
        <Tile rotulo="Adicionados em 7 dias" valor={i.adicionadosUltimos7Dias} />
      </div>
      <Bloco titulo="Pedem atenção" sub="clique para abrir a fila na Lista">
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "7px", fontSize: "13px" }}>
          {atencao.map(([t, h]) => <Link key={h} href={h} style={LINK}>{t}</Link>)}
        </div>
      </Bloco>
      <Bloco titulo="Fila por responsável" sub="quem tem o quê em Novo, Em cadência e Respondeu">
        {op.filaPorResponsavel.length === 0 ? <Vazio>Nenhuma empresa em Novo, Em cadência ou Respondeu.</Vazio> : (
          <Tabela colunas={["Responsável", "Novo", "Em cadência", "Respondeu", "Total"]}
            linhas={op.filaPorResponsavel.map((f) => [
              <Link key="n" href={`/prospeccao?visao=kanban&responsavel=${f.responsavelId ?? "sem"}`} style={{ ...LINK, color: "#12171d" }}>{f.nome}</Link>,
              f.novo, f.emCadencia, f.respondeu, <strong key="t">{f.total}</strong>,
            ])} />
        )}
      </Bloco>
    </div>
  );
}

export function VisaoCampanhas({ op }: { op: OperacaoProspeccao }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Bloco titulo="Listas em uso" sub="uma empresa pode estar em mais de uma lista">
        {op.listas.length === 0 ? <Vazio>Nenhuma lista ainda. Listas nascem ao adicionar ou importar empresas informando o nome da lista.</Vazio> : (
          <Tabela colunas={["Lista", "Empresas", "Em aberto"]}
            linhas={op.listas.map((l) => [<Link key="l" href={`/prospeccao?lista=${encodeURIComponent(l.nome)}`} style={{ ...LINK, color: "#12171d" }}>{l.nome}</Link>, l.total, l.abertas])} />
        )}
      </Bloco>
      <Bloco titulo="Cadências que já receberam prospects" sub="a configuração vive em Automações › Cadências">
        {op.cadencias.length === 0 ? <Vazio>Nenhum prospect entrou em cadência ainda.</Vazio> : (
          <Tabela colunas={["Cadência", "Matriculados", "Ativos", "Responderam", "Concluídos", "Falhas"]}
            linhas={op.cadencias.map((c) => [<Link key="c" href={`/prospeccao?cadencia=${c.id}`} style={{ ...LINK, color: "#12171d" }}>{c.nome}</Link>, c.matriculados, c.ativos, c.responderam, c.concluidos, c.falhas])} />
        )}
      </Bloco>
      <div style={{ fontSize: "12px", color: "#4a5560", lineHeight: 1.5 }}>Campanhas de disparo para a base outbound, com métricas por campanha, entram na Fase 2. Hoje a abordagem é feita por cadência.</div>
    </div>
  );
}

export function VisaoInteligencia({ op }: { op: OperacaoProspeccao }) {
  const f = op.funil;
  const linhas: Array<[string, number, string]> = [
    ["Na base", f.base, "—"], ["Chegaram a Em cadência", f.chegaramEmCadencia, pct(f.chegaramEmCadencia, f.base)],
    ["Responderam", f.responderam, pct(f.responderam, f.chegaramEmCadencia)], ["Pré-qualificados", f.preQualificados, pct(f.preQualificados, f.base)],
    ["Oportunidades diretas", f.oportunidades, pct(f.oportunidades, f.base)], ["Descartados", f.descartados, pct(f.descartados, f.base)],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <Bloco titulo="Funil da base" sub="os marcos vêm do histórico de mudanças de estado">
        {f.base === 0 ? <Vazio>Sem prospects para medir.</Vazio> : <Tabela colunas={["Marco", "Empresas", "Taxa"]} linhas={linhas.map(([r, n, t]) => [r, n, t])} />}
        <div style={{ padding: "10px 14px", fontSize: "12px", color: "#4a5560", lineHeight: 1.5, borderTop: "1px solid #eef1f1" }}>
          {f.chegaramEmCadencia === 0
            ? "Nenhum prospect passou por cadência neste ambiente, então a taxa de resposta ainda não tem base. Os pré-qualificados do histórico anterior entraram sem cadência."
            : "Taxa de resposta = responderam ÷ chegaram a cadência. As demais são sobre a base."}
        </div>
      </Bloco>
      <Bloco titulo="Motivos de descarte">
        {op.descartePorMotivo.length === 0 ? <Vazio>Nenhum prospect descartado ainda.</Vazio> : (
          <Tabela colunas={["Motivo", "Empresas"]} linhas={op.descartePorMotivo.map((d) => [rotuloMotivo(d.motivo), d.n])} />
        )}
      </Bloco>
      <div style={{ fontSize: "12px", color: "#4a5560", lineHeight: 1.5 }}>Cruzamentos por fonte, lista, família e período entram nas próximas fases.</div>
    </div>
  );
}
