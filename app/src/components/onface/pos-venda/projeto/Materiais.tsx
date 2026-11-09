"use client";

/**
 * Materiais: o formulário público, o NPS e o retrato de uso.
 *
 * Ausência diz o motivo. Um retrato de uso sem espelho não mostra "0
 * ligações": diz que o espelho está indisponível. Um NPS ainda não enviado diz
 * quando ele é enviado, em vez de mostrar uma nota vazia.
 */
import { Check, ChevronRight, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import type { Projeto } from "@/lib/pos-venda/contrato";
import { Button } from "@/components/ui/button";
import { diaEHora } from "../formatos";
import { useAcao, type AcoesDaTela } from "./acoes";

const PASSOS: Array<{ chave: NonNullable<Projeto["formulario"]>["status"]; rotulo: string }> = [
  { chave: "enviado", rotulo: "Enviado" },
  { chave: "respondido", rotulo: "Respondido" },
  { chave: "em_revisao", rotulo: "Em revisão" },
  { chave: "aprovado", rotulo: "Aprovado" },
];

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Link copiado.");
  } catch {
    toast.error("Não consegui copiar. Selecione o link e copie à mão.");
  }
}

export function Materiais({ projeto, agora, acoes }: { projeto: Projeto; agora: Date; acoes: AcoesDaTela }) {
  const { formulario: f, nps, retratoDeUso: uso } = projeto;
  const { pendente, rodar } = useAcao();

  if (!f && !nps && !uso) {
    return (
      <div className="pv-estado" role="status">
        <h2>Nenhum material para este projeto</h2>
        <p>Este tipo de projeto não usa formulário de coleta nem pesquisa de NPS. Os arquivos que o cliente mandar por outro canal ficam no Cliente 360.</p>
      </div>
    );
  }

  const atual = f ? PASSOS.findIndex((p) => p.chave === f.status) : -1;

  return (
    <div className="pv-painel">
      {f ? (
        <section className="pv-secao" aria-label="Formulário de levantamento">
          <div className="pv-secao-cab">
            <h2 className="pv-secao-titulo">Formulário de levantamento</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => copiar(f.link)}><Copy aria-hidden /> Copiar link</Button>
              {f.status === "nao_enviado" ? (
                <Button size="sm" loading={pendente} onClick={() => rodar(() => acoes.enviarFormulario(), "Formulário enviado ao cliente.")}>
                  <Send aria-hidden /> Enviar formulário
                </Button>
              ) : null}
            </div>
          </div>

          <ol className="pv-passos" aria-label="Etapa do formulário">
            {PASSOS.map((p, i) => (
              <li key={p.chave} className="pv-passo" data-estado={i < atual ? "feito" : i === atual ? "atual" : undefined} aria-current={i === atual ? "step" : undefined}>
                <i>{i < atual ? <Check className="size-3" aria-hidden /> : i + 1}</i>
                {p.rotulo}
                {i < PASSOS.length - 1 ? <ChevronRight className="pv-passo-seta" aria-hidden /> : null}
              </li>
            ))}
          </ol>

          <p className="pv-secao-nota">
            {f.enviadoEm ? `Enviado em ${diaEHora(f.enviadoEm, agora)}. ` : "Ainda não foi enviado ao cliente. "}
            {f.respondidoEm ? `Respondido em ${diaEHora(f.respondidoEm, agora)}${f.respondidoPor ? ` por ${f.respondidoPor}` : ""}.` : f.enviadoEm ? "Aguardando resposta." : ""}
          </p>

          {f.respostas.length > 0 ? (
            <dl className="pv-bloco pv-respostas">
              {f.respostas.map((r, i) => (
                <div key={i} className="pv-resposta">
                  <dt>{r.pergunta}</dt>
                  <dd>
                    {r.arquivo ? <a href={r.arquivo.url} target="_blank" rel="noreferrer noopener">{r.arquivo.nome}</a> : r.resposta || "Sem resposta"}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ) : null}

      {nps ? (
        <section className="pv-secao" aria-label="NPS">
          <div className="pv-secao-cab">
            <h2 className="pv-secao-titulo">NPS</h2>
            <Button variant="outline" size="sm" onClick={() => copiar(nps.link)}><Copy aria-hidden /> Copiar link</Button>
          </div>
          {nps.nota !== null ? (
            <div className="pv-bloco">
              <div className="pv-rosca-linha">
                <div className="pv-relogio-valor">
                  {nps.nota}<small>de 10</small>
                </div>
                {nps.faixa ? (
                  <span className="pv-pilula" data-pv-tom={nps.faixa === "promotor" ? "ok" : nps.faixa === "neutro" ? "espera" : "risco"}>
                    <span className="pv-pilula-ponto" aria-hidden />
                    {nps.faixa === "promotor" ? "Promotor" : nps.faixa === "neutro" ? "Neutro" : "Detrator"}
                  </span>
                ) : null}
              </div>
              {nps.comentario ? <p className="pv-md">{nps.comentario}</p> : null}
              {nps.respondidoEm ? <span className="pv-secao-nota">Respondido em {diaEHora(nps.respondidoEm, agora)}</span> : null}
            </div>
          ) : (
            <p className="pv-secao-nota">
              {nps.enviadoEm
                ? `Enviado em ${diaEHora(nps.enviadoEm, agora)}${nps.abertoEm ? ", aberto pelo cliente" : ", ainda não aberto"}. Sem resposta até agora.`
                : "A pesquisa ainda não foi enviada. Ela vai no encerramento do onboarding, e a baixa espera 3 dias pela resposta."}
            </p>
          )}
        </section>
      ) : null}

      {uso ? (
        <section className="pv-secao" aria-label="Retrato de uso">
          <h2 className="pv-secao-titulo">Retrato de uso no encerramento</h2>
          {uso.indisponivel ? (
            <div className="pv-aviso" data-pv-tom="espera">
              <span>O espelho de uso está defasado ou vazio, então não há números confiáveis. Nada aparece aqui em vez de um zero que pareceria fato.</span>
            </div>
          ) : (
            <dl className="pv-bloco pv-fatos">
              <Linha rotulo="Capturado em" valor={diaEHora(uso.capturadoEm, agora)} />
              <Linha rotulo="Primeiro acesso" valor={uso.primeiroAcessoEm ? diaEHora(uso.primeiroAcessoEm, agora) : null} />
              <Linha rotulo="Último acesso" valor={uso.ultimoAcessoEm ? diaEHora(uso.ultimoAcessoEm, agora) : null} />
              <Linha rotulo="Ligações feitas" valor={uso.ligacoesFeitas !== null ? String(uso.ligacoesFeitas) : null} />
              <Linha rotulo="Campanhas disparadas" valor={uso.campanhasDisparadas !== null ? String(uso.campanhasDisparadas) : null} />
              <Linha rotulo="Agente configurado" valor={uso.agenteConfigurado === null ? null : uso.agenteConfigurado ? "Sim" : "Não"} />
            </dl>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="pv-fato">
      <dt>{rotulo}</dt>
      <dd data-ausente={valor === null || undefined}>{valor ?? "Sem registro"}</dd>
    </div>
  );
}
