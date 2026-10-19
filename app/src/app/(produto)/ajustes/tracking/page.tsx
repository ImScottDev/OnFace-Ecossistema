"use client";

import { useQuery } from "@tanstack/react-query";
import { SecaoAjuste, PilulaEstado, type EstadoAjuste } from "@/components/onface/ajustes/Secao";
import type { EstadoTracking, EventoTracking } from "@/lib/integrations/meta/estado-tracking";

/**
 * Tracking — estado real da devolução de conversões à Meta.
 *
 * Antes: três blocos de campos (Meta CAPI, GA4, Google Ads) e um mapeamento por
 * etapa que gravavam em `organizacoes.settings` uma chave que NENHUM processo
 * lia. A entrega à Meta sempre usou as credenciais do servidor, então a tela
 * parecia o painel de uma integração que ela não controlava.
 *
 * Agora é leitura do que roda: credenciais (existe ou não, nunca o valor), o
 * mapeamento que o worker usa (`POLITICA_EVENTOS`) e o que já foi entregue.
 */

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

function estadoDoEvento(e: EventoTracking): { estado: EstadoAjuste; texto: string } {
  if (e.falhas > 0 && e.entregues === 0) return { estado: "erro", texto: "Só falhas" };
  if (e.entregues > 0) return { estado: "ok", texto: "Enviando" };
  if (e.ocorreu === 0) return { estado: "pendente", texto: "Nunca disparou" };
  return { estado: "neutro", texto: "Sem sinal da Meta" };
}

function LinhaEvento({ e }: { e: EventoTracking }) {
  const { estado, texto } = estadoDoEvento(e);
  return (
    <li className="aj-linha">
      <div className="aj-linha-corpo">
        <span className="aj-linha-titulo">
          {e.nomeMeta}{e.comValor ? " · com valor" : ""}{e.padrao ? "" : " · personalizado"}
        </span>
        <span className="aj-linha-meta">
          {e.eventoOnface} → {e.entregues.toLocaleString("pt-BR")} enviados
          {e.falhas > 0 ? `, ${e.falhas} com falha` : ""}
          {e.ultimaEntrega ? `, último em ${data(e.ultimaEntrega)}` : ""}
        </span>
      </div>
      <div className="aj-linha-acoes"><PilulaEstado estado={estado}>{texto}</PilulaEstado></div>
    </li>
  );
}

function Credencial({ rotulo, ok, falta }: { rotulo: string; ok: boolean; falta: string }) {
  return (
    <div className="aj-fato">
      <dt>{rotulo}</dt>
      <dd>
        <PilulaEstado estado={ok ? "ok" : "erro"}>{ok ? "Configurado" : "Ausente"}</PilulaEstado>
        {!ok && <span className="font-normal text-[var(--text-muted)]">{falta}</span>}
      </dd>
    </div>
  );
}

export default function TrackingPage() {
  const { data: s, isLoading, isError, error } = useQuery({
    queryKey: ["tracking-estado"],
    queryFn: async () => {
      const res = await fetch("/api/configuracoes/tracking/estado");
      if (res.status === 403) throw new Error("Só administradores veem o estado do tracking.");
      if (!res.ok) throw new Error("Não foi possível carregar o estado do tracking.");
      return res.json() as Promise<EstadoTracking>;
    },
  });

  if (isLoading) return <p className="aj-grupo-ajuda">Carregando…</p>;
  if (isError || !s) return <div className="aj-vazio"><strong>{(error as Error)?.message ?? "Erro ao carregar."}</strong></div>;

  const c = s.credenciais;
  const semFechamento = s.eventos.filter((e) => e.comValor && e.entregues === 0 && e.ocorreu === 0);

  return (
    <div className="aj-secoes">
      {c.modoTeste && (
        <p className="aj-aviso" data-tom="erro" role="alert">
          <strong>Modo de teste ligado:</strong> há um código de teste da Meta no servidor, então os eventos vão para a aba
          Test Events e <strong>não contam como conversão</strong>. Remova <code>META_CAPI_TEST_EVENT_CODE</code> do ambiente.
        </p>
      )}
      {semFechamento.length > 0 && (
        <p className="aj-aviso" role="status">
          <strong>Venda ganha e pagamento ainda não voltam para a Meta:</strong>{" "}
          {semFechamento.map((e) => e.nomeMeta).join(" e ")} nunca foram disparados. Qualificação, reunião e proposta já vão;
          o fechamento não.
        </p>
      )}

      <SecaoAjuste
        titulo="Conversions API (Meta)"
        ajuda="Devolve à Meta o que aconteceu com o lead que veio do anúncio, para a campanha otimizar por qualidade e não por formulário. As credenciais ficam no servidor, configuradas pelo time técnico."
        acao={<PilulaEstado estado={c.datasetId && c.tokenCapi && !c.modoTeste ? "ok" : "erro"}>
          {c.datasetId && c.tokenCapi ? (c.modoTeste ? "Em teste" : "Ativa") : "Incompleta"}
        </PilulaEstado>}
      >
        <dl className="aj-fatos">
          <Credencial rotulo="Pixel / Dataset ID" ok={c.datasetId} falta="META_PIXEL_ID" />
          <Credencial rotulo="Token da Conversions API" ok={c.tokenCapi} falta="META_CAPI_ACCESS_TOKEN" />
        </dl>
      </SecaoAjuste>

      <SecaoAjuste
        titulo="Entrada de leads (Lead Ads)"
        ajuda="O formulário do anúncio vira lead no CRM assim que é preenchido."
        acao={<PilulaEstado estado={c.tokenLeads && c.segredoApp ? "ok" : "erro"}>{c.tokenLeads && c.segredoApp ? "Ativa" : "Incompleta"}</PilulaEstado>}
      >
        <dl className="aj-fatos">
          <Credencial rotulo="Token de leitura do lead" ok={c.tokenLeads} falta="META_LEADS_ACCESS_TOKEN" />
          <Credencial rotulo="Segredo do app (assinatura do webhook)" ok={c.segredoApp} falta="META_APP_SECRET" />
          <div className="aj-fato"><dt>Leads recebidos nos últimos 30 dias</dt><dd>{s.leads.total30d.toLocaleString("pt-BR")}</dd></div>
          <div className="aj-fato"><dt>Último lead</dt><dd>{data(s.leads.ultimo)}</dd></div>
        </dl>
      </SecaoAjuste>

      <SecaoAjuste
        titulo="Eventos devolvidos"
        ajuda="O que acontece no ONFACE e qual evento a Meta recebe. Só volta o fato de quem veio da Meta; lead de outra origem não é enviado, para não ensinar o algoritmo com público que ela não trouxe."
      >
        <ul className="aj-lista">{s.eventos.map((e) => <LinhaEvento key={e.eventoOnface} e={e} />)}</ul>
      </SecaoAjuste>

      {s.falhasRecentes.length > 0 && (
        <SecaoAjuste titulo="Falhas recentes" ajuda="Últimas entregas que a Meta recusou ou que não puderam sair.">
          <ul className="aj-lista">
            {s.falhasRecentes.map((f, i) => (
              <li key={i} className="aj-linha">
                <div className="aj-linha-corpo">
                  <span className="aj-linha-titulo">{f.evento} · {f.motivo ?? "erro"}</span>
                  <span className="aj-linha-meta">{data(f.quando)}{f.detalhe ? ` — ${f.detalhe}` : ""}</span>
                </div>
              </li>
            ))}
          </ul>
        </SecaoAjuste>
      )}

      <SecaoAjuste
        titulo="GA4 e Google Ads"
        ajuda="Ainda não existe envio de conversões para o GA4 nem para o Google Ads. Não há campo para preencher porque nada leria o valor."
      />
    </div>
  );
}
