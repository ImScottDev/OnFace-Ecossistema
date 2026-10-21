"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";

type Dados = {
  competencia: string | null;
  corte: string;
  aviso: string;
  historico: Record<string, number | string> | null;
  financeiro: Record<string, number | string> | null;
  legado: Record<string, number | string> | null;
  slaQualidade: Record<string, number | string | null> | null;
};
type Indicador = {
  chave: string; titulo: string; valor: number; base?: number;
  impacto?: number; definicao: string; fonte: string; acao: string;
};
const num = (v: unknown) => Number(v ?? 0);
const nfmt = (v: number) => v.toLocaleString("pt-BR");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function indicadores(d: Dados): Indicador[] {
  const h = d.historico, f = d.financeiro, l = d.legado;
  if (!h || !f || !l) return [];
  return [
    { chave: "contratos", titulo: "Pagantes sem contrato", valor: num(h.pagantes_sem_contrato), base: num(h.pagantes),
      impacto: num(h.valor_sem_contrato), definicao: "Pagantes da última competência MRR sem contrato diretamente vinculado à empresa. Pode existir contrato com titular ou parceiro diferente.",
      fonte: "cliente_receita_mensal × contratos por empresa_id", acao: "Revisar pagador, titular, parceiro e serviço. Não criar contratos automaticamente." },
    { chave: "pagamentos", titulo: "Faturas pagas sem evidência", valor: num(f.faturas_sem_pagamento), base: num(f.faturas_pagas),
      impacto: num(f.valor_faturas_sem_pagamento), definicao: "Faturas com status paga sem linha associada na tabela pagamentos. Não significa que não houve pagamento.",
      fonte: "faturas × pagamentos; somente espelho do CRM", acao: "Conferir Stripe, pagamento externo, baixa manual e sincronização." },
    { chave: "servico", titulo: "Assinaturas sem serviço", valor: num(f.assinaturas_sem_servico), base: num(f.assinaturas_ativas),
      definicao: "Assinaturas ativas do CRM sem ID de serviço canônico.", fonte: "assinaturas.servico_id",
      acao: "Vincular somente após evidência por assinatura, produto e contrato." },
    { chave: "empresa", titulo: "Assinaturas sem empresa", valor: num(f.assinaturas_sem_empresa), base: num(f.assinaturas_ativas),
      definicao: "Assinaturas ativas sem empresa identificada no CRM.", fonte: "assinaturas.empresa_id",
      acao: "Conferir CPF/CNPJ e IDs externos; e-mail isolado não é chave confiável." },
    { chave: "familia", titulo: "Cobranças sem família", valor: num(h.familia_desconhecida), base: num(h.linhas),
      impacto: num(h.valor_familia_desconhecida), definicao: "Linhas do faturamento sem classificação da família de serviço.",
      fonte: "cliente_receita_mensal.service_family", acao: "Conciliar SKU, serviços e natureza antes de categorizar receita." },
    { chave: "identidade", titulo: "Cobranças sem empresa", valor: num(h.linhas_sem_empresa), base: num(h.linhas),
      impacto: num(h.valor_sem_empresa), definicao: "Linhas de faturamento sem identificação canônica.",
      fonte: "cliente_receita_mensal.empresa_id", acao: "Fila de exceções por documento, serviço e pagador." },
    { chave: "legado", titulo: "Contratos sem empresa", valor: num(l.contratos_sem_empresa), base: num(l.contratos_total),
      definicao: "Contratos legados sem vínculo direto de empresa; documentos assinados podem existir.",
      fonte: "contratos × anexos_legado", acao: "Comparar UUID, Zoho, titular e aditivos sem alterar documentos." },
    { chave: "fechamento", titulo: "Lotes fechados com pendências", valor: num(l.lotes_fechados_pendentes),
      definicao: "Lote CLOSED tem registros com confiança, família, natureza ou serviço pendente.",
      fonte: "service_ledger_batches × service_ledger_entries", acao: "Retificação auditada, preservando o fechamento original." },
    ...(d.slaQualidade ? [
      { chave: "sdr-marco", titulo: "Leads sem 1º contato registrado (7d)", valor: num(d.slaQualidade.sem_contato_7d), base: num(d.slaQualidade.leads_7d),
        definicao: "Leads criados nos últimos 7 dias sem primeiro_contato_at. É lacuna de marco, não prova de falta de atendimento.",
        fonte: "leads.primeiro_contato_at · coorte de 7 dias · QA explícito excluído", acao: "Comparar com ligações, WhatsApp e atividades; instrumentar cada canal." },
      { chave: "outbound-marco", titulo: "Outbound sem 1º contato (7d)", valor: num(d.slaQualidade.outbound_sem_contato_7d), base: num(d.slaQualidade.outbound_7d),
        definicao: "Leads de outbound sem evento de primeiro contato no CRM. Não confundir ausência de timestamp com tentativa não realizada.",
        fonte: "leads.origem=outbound e primeiro_contato_at", acao: "Vincular eventos de cadência/telefone ao lead antes de definir SLA outbound." },
      { chave: "cronologia", titulo: "Datas de contato invertidas (7d)", valor: num(d.slaQualidade.cronologia_invalida_7d), base: num(d.slaQualidade.leads_7d),
        definicao: "Primeiro contato anterior à criação do lead: duração negativa, excluída das estatísticas de velocidade.",
        fonte: "leads.primeiro_contato_at < leads.created_at", acao: "Revisar importações históricas, fuso e timestamp de eventos antes de retificar." },
    ] : []),
  ];
}

export function TabQualidadeDados() {
  const reduzido = useReducedMotion();
  const [selecao, setSelecao] = useState<Indicador | null>(null);
  const { data, error, isPending, isFetching, refetch } = useQuery<Dados>({
    queryKey: ["insights", "qualidade-dados"],
    queryFn: async () => {
      const r = await fetch("/api/relatorios/qualidade", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 403 ? "Sem permissão para consultar o financeiro" : "Falha ao consultar a qualidade dos dados");
      return r.json();
    },
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!selecao) return;
    const fechar = (evento: KeyboardEvent) => { if (evento.key === "Escape") setSelecao(null); };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [selecao]);
  const itens = data ? indicadores(data) : [];
  const pagantes = num(data?.historico?.pagantes);
  const semContrato = num(data?.historico?.pagantes_sem_contrato);
  const cobertura = pagantes ? ((pagantes - semContrato) / pagantes) * 100 : null;

  return (
    <section className="flex flex-col gap-4" aria-label="Integridade do CRM">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Qualidade dos dados</h2>
          <p className="text-sm text-[var(--ins-mudo)]">Saúde da informação antes de confiar nos relatórios.</p>
        </div>
        <button type="button" onClick={() => void refetch()} disabled={isFetching}
          className="rounded-lg bg-[var(--ins-branco)] px-3 py-2 text-xs font-semibold shadow-sm disabled:opacity-50">
          {isFetching ? "Atualizando…" : "Atualizar"}
        </button>
      </header>
      {isPending && <p role="status">Carregando dados da organização…</p>}
      {error && <p role="alert">{error.message}</p>}
      {data && (
        <>
          <div className="text-xs text-[var(--ins-mudo)]">
            Competência: {data.competencia?.slice(0, 7) ?? "indisponível"} · Consultado: {new Date(data.corte).toLocaleString("pt-BR")}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-[var(--ins-branco)] p-4 shadow-sm">
              <div className="text-xs text-[var(--ins-mudo)]">Cobertura contratual dos pagantes</div>
              <strong className="text-2xl">{cobertura == null ? "—" : nfmt(Math.round(cobertura * 10) / 10) + "%"}</strong>
              <p className="text-xs text-[var(--ins-mudo)]">{nfmt(pagantes - semContrato)} de {nfmt(pagantes)} empresas MRR identificadas</p>
            </div>
            <div className="rounded-xl bg-[var(--ins-branco)] p-4 shadow-sm">
              <div className="text-xs text-[var(--ins-mudo)]">Indicadores com exceções</div>
              <strong className="text-2xl">{nfmt(itens.filter((x) => x.valor > 0).length)} / {itens.length}</strong>
              <p className="text-xs text-[var(--ins-mudo)]">Não significa receita perdida</p>
            </div>
            <div className="rounded-xl bg-[var(--ins-branco)] p-4 shadow-sm">
              <div className="text-xs text-[var(--ins-mudo)]">Contratos com anexos assinados no legado</div>
              <strong className="text-2xl">{nfmt(num(data.legado?.contratos_com_anexos_legados))}</strong>
              <p className="text-xs text-[var(--ins-mudo)]">Disponibilidade física depende do ambiente</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {itens.map((item) => (
              <motion.button key={item.chave} type="button"
                whileHover={reduzido ? undefined : { y: -3 }}
                whileTap={reduzido ? undefined : { scale: 0.98 }}
                onClick={() => setSelecao(item)}
                className="flex flex-col gap-2 rounded-xl bg-[var(--ins-branco)] p-4 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ins-coral)]">
                <span className="flex items-center justify-between gap-2 text-xs text-[var(--ins-mudo)]">
                  <span>{item.titulo}</span><ArrowUpRight size={16} />
                </span>
                <strong className="text-2xl tabular-nums">{nfmt(item.valor)}</strong>
                <span className="text-xs text-[var(--ins-mudo)]">
                  {item.base == null ? "pendências históricas" : "de " + nfmt(item.base) + " registros"}
                  {item.impacto !== undefined ? " · " + brl(item.impacto) : ""}
                </span>
              </motion.button>
            ))}
          </div>
          <p className="text-xs text-[var(--ins-mudo)]">{data.aviso} Clique nos cards para conhecer cada regra e o próximo passo.</p>
        </>
      )}
      <AnimatePresence>
        {selecao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.button type="button" aria-label="Fechar detalhes"
              onClick={() => setSelecao(null)}
              className="absolute inset-0 bg-black/40"
              initial={reduzido ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div role="dialog" aria-modal="true" aria-label={selecao.titulo}
              initial={reduzido ? false : { opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
              className="relative z-10 flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-[var(--ins-branco)] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{selecao.titulo}</h3>
                <button type="button" onClick={() => setSelecao(null)} aria-label="Fechar detalhes"
                  className="rounded-lg p-1"><X size={19} /></button>
              </div>
              <strong className="text-3xl tabular-nums">{nfmt(selecao.valor)}</strong>
              {selecao.impacto !== undefined &&
                <p className="text-sm">{brl(selecao.impacto)} de valor associado ao diagnóstico</p>}
              <div><h4 className="text-sm font-semibold">O que significa</h4><p className="mt-1 text-sm">{selecao.definicao}</p></div>
              <div><h4 className="text-sm font-semibold">Origem</h4><p className="mt-1 text-sm">{selecao.fonte}</p></div>
              <div><h4 className="text-sm font-semibold">Próxima ação</h4><p className="mt-1 text-sm">{selecao.acao}</p></div>
              <p className="text-xs text-[var(--ins-mudo)]">Este painel exibe agregados. A listagem individual exige exploração autorizada.</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
