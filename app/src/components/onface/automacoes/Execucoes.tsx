import Link from "next/link";
import { LIMITE, type Execucao, type FonteExecucao, type StatusExecucao } from "@/lib/automacoes/execucoes";
import { ReprocessarBotao } from "./ReprocessarBotao";
import "./execucoes.css";

const FONTE_ROTULO: Record<FonteExecucao, string> = {
  fila: "Fila de eventos",
  automacao: "Automação",
  cadencia: "Cadência",
};

const STATUS_ROTULO: Record<StatusExecucao, string> = {
  sucesso: "Sucesso",
  aguardando: "Aguardando o worker",
  pendente: "Na fila",
  processando: "Processando",
  retry_agendado: "Nova tentativa",
  erro: "Erro",
  condicao_nao_atendida: "Condição não atendida",
  cancelado: "Cancelado",
  marco: "Marco do ciclo",
};

// Tom do selo. Coral fica só para erro: é o único estado que pede ação.
const STATUS_TOM: Record<StatusExecucao, "ok" | "neutro" | "atencao" | "erro"> = {
  sucesso: "ok",
  aguardando: "neutro",
  pendente: "neutro",
  processando: "neutro",
  retry_agendado: "atencao",
  erro: "erro",
  condicao_nao_atendida: "atencao",
  cancelado: "neutro",
  marco: "neutro",
};

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
});

function href(fonte: FonteExecucao | null, status: StatusExecucao | null) {
  const p = new URLSearchParams();
  if (fonte) p.set("fonte", fonte);
  if (status) p.set("status", status);
  const q = p.toString();
  return q ? `/automacoes/execucoes?${q}` : "/automacoes/execucoes";
}

export function Execucoes({
  execucoes,
  fonte,
  status,
  verFila,
  podeReprocessar,
}: {
  execucoes: Execucao[];
  fonte: FonteExecucao | null;
  status: StatusExecucao | null;
  verFila: boolean;
  podeReprocessar: boolean;
}) {
  // Fila só aparece como recorte para quem pode vê-la (mesma regra do endpoint
  // de dead-letter: admin, super_admin, gerente). O payload carrega ids de
  // pessoa/empresa.
  const fontes: FonteExecucao[] = verFila ? ["fila", "automacao", "cadencia"] : ["automacao", "cadencia"];
  // Todo status que a página aceita na URL tem chip: deep-link com filtro sem
  // chip marcado deixava o usuário preso no recorte. "Aguardando" e "Na fila"
  // só existem no outbox, então somem para quem não vê a fila. "Processando"
  // fica: a cadência também tem passo em execução.
  const statusOpcoes: StatusExecucao[] = verFila
    ? ["sucesso", "aguardando", "pendente", "processando", "retry_agendado", "erro", "condicao_nao_atendida", "cancelado", "marco"]
    : ["sucesso", "processando", "retry_agendado", "erro", "condicao_nao_atendida", "cancelado", "marco"];

  return (
    <section className="exe" aria-label="Execuções">
      <div className="exe-filtros">
        <nav className="exe-segmento" aria-label="Fonte">
          <Link href={href(null, status)} aria-current={!fonte ? "page" : undefined}>Todas</Link>
          {fontes.map((f) => (
            <Link key={f} href={href(f, status)} aria-current={fonte === f ? "page" : undefined}>{FONTE_ROTULO[f]}</Link>
          ))}
        </nav>
        <nav className="exe-chips" aria-label="Status">
          {statusOpcoes.map((s) => (
            <Link
              key={s}
              href={href(fonte, status === s ? null : s)}
              aria-current={status === s ? "true" : undefined}
              className="exe-chip"
            >
              {STATUS_ROTULO[s]}
            </Link>
          ))}
        </nav>
      </div>

      {execucoes.length === 0 ? (
        <div className="exe-vazio">
          <strong>Nenhuma execução {fonte || status ? "neste recorte" : "registrada"}</strong>
          <span>
            {/* "Nunca rodou" só é verdade sem filtro de status: com status, o
                vazio diz apenas que nenhuma execução tem aquele status. */}
            {status
              ? `Nenhuma execução com status “${STATUS_ROTULO[status]}” ${fonte ? "nesta fonte" : "nas fontes visíveis"}.`
              : fonte === "automacao"
              ? "Nenhuma regra de automação rodou ainda nesta organização."
              : fonte === "cadencia"
                ? "O motor de cadência ainda não executou nenhum passo nesta organização."
                : "Quando o worker processar eventos, regras ou cadências, cada execução aparece aqui."}
          </span>
          {fonte || status ? <Link href="/automacoes/execucoes">Limpar filtros</Link> : null}
        </div>
      ) : (
        <ol className="exe-lista">
          <li className="exe-cab" aria-hidden="true">
            <span>Execução</span>
            <span>Entidade</span>
            <span>Status</span>
            <span>Quando</span>
          </li>
          {execucoes.map((e) => (
            <li key={`${e.fonte}-${e.id}`}>
              {/* <details> nativo: detalhe abre sem JS e sem estado no cliente. */}
              <details className="exe-item">
                <summary className="exe-linha">
                  <span className="exe-nome">
                    <span className="exe-fonte" data-fonte={e.fonte}>{FONTE_ROTULO[e.fonte]}</span>
                    <strong>{e.nome}</strong>
                    {e.detalhe ? <span className="exe-detalhe">{e.detalhe}</span> : null}
                  </span>
                  <span className="exe-entidade">
                    {e.entidadeNome ?? e.entidadeTipo}
                    {e.entidadeNome ? null : <code>{e.entidadeId.slice(0, 8)}</code>}
                  </span>
                  <span><span className="exe-selo" data-tom={STATUS_TOM[e.status]}>{STATUS_ROTULO[e.status]}</span></span>
                  <time dateTime={e.quando} className="exe-quando">{dataHora.format(new Date(e.quando))}</time>
                </summary>
                <div className="exe-painel">
                  <dl>
                    <div><dt>ID</dt><dd><code>{e.id}</code></dd></div>
                    <div><dt>Entidade</dt><dd>{e.entidadeNome ? `${e.entidadeNome} · ` : ""}{e.entidadeTipo} <code>{e.entidadeId}</code></dd></div>
                    <div><dt>Tentativas</dt><dd>{e.tentativas ?? "—"}</dd></div>
                    <div><dt>Criado</dt><dd>{dataHora.format(new Date(e.quando))}</dd></div>
                    <div><dt>Concluído</dt><dd>{e.concluidoEm ? dataHora.format(new Date(e.concluidoEm)) : "—"}</dd></div>
                  </dl>
                  {e.detalhe ? <p className="exe-erro" data-tom={STATUS_TOM[e.status]}>{e.detalhe}</p> : null}
                  <pre className="exe-json">{e.dados ? JSON.stringify(e.dados, null, 2) : "Sem payload registrado."}</pre>
                  {e.reprocessavel ? (
                    <ReprocessarBotao ids={[e.id]} rotulo="Reprocessar este evento" permitido={podeReprocessar} />
                  ) : null}
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
      {execucoes.length >= LIMITE ? <p className="exe-rodape">Mostrando as {LIMITE} mais recentes deste recorte.</p> : null}
    </section>
  );
}
