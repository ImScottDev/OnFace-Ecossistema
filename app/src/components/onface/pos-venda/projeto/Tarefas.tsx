"use client";

/**
 * Tarefas do projeto.
 *
 * POUCAS e GRANDES, por regra do dono: o passo a passo mora no playbook e no
 * checklist de dentro de cada tarefa, nunca virando trinta linhas soltas. Cada
 * tarefa abre para mostrar o playbook em markdown, o checklist e as ações
 * (concluir, reabrir, remarcar, atribuir).
 *
 * As ações são otimistas: a linha muda na hora, o servidor confirma, e se
 * recusar a linha volta e o motivo aparece em toast. Nada de spinner no lugar
 * do que a pessoa acabou de fazer.
 */
import { useId, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { ptBR } from "react-day-picker/locale";
import { AlarmClock, CalendarDays, Check, ChevronDown, ListChecks, MessageSquare, RotateCcw } from "lucide-react";
import type { TarefaDoProjeto, Usuario } from "@/lib/pos-venda/contrato";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chaveDoDia, dia, prazo, primeiroNome } from "../formatos";
import { Markdown } from "../Markdown";
import { Avatar, PilulaDeTarefa } from "../pecas";
import type { AcoesDaTela, ResultadoDaAcao } from "./acoes";

type Mudanca =
  | { t: "concluir"; id: string }
  | { t: "reabrir"; id: string }
  | { t: "item"; id: string; feito: boolean }
  | { t: "atribuir"; id: string; para: Usuario | null }
  | { t: "remarcar"; id: string; para: Date };

function aplicar(tarefas: TarefaDoProjeto[], m: Mudanca): TarefaDoProjeto[] {
  return tarefas.map((t) => {
    if (m.t === "item") {
      return t.itens.some((i) => i.id === m.id) ? { ...t, itens: t.itens.map((i) => (i.id === m.id ? { ...i, feito: m.feito } : i)) } : t;
    }
    if (t.id !== m.id) return t;
    switch (m.t) {
      case "concluir":
        return { ...t, estado: "CONCLUIDA", atrasada: false, concluidaEm: new Date(), itens: t.itens.map((i) => ({ ...i, feito: true })) };
      case "reabrir":
        return { ...t, estado: "EM_ANDAMENTO", concluidaEm: null, atrasada: Boolean(t.venceEm && t.venceEm.getTime() < Date.now()) };
      case "atribuir":
        return { ...t, responsavel: m.para ? { id: m.para.id, nome: m.para.nome, email: m.para.email, telefone: null, cargo: null, iniciais: m.para.iniciais } : null };
      case "remarcar":
        return { ...t, venceEmOriginal: t.venceEmOriginal ?? t.venceEm, venceEm: m.para, atrasada: t.estado !== "CONCLUIDA" && m.para.getTime() < Date.now() };
    }
  });
}

const SEM_RESPONSAVEL = "__ninguem__";

/** Dia do calendário que o seletor mostra (local), a partir do dia de São Paulo. */
const paraSeletor = (d: Date | null): Date | undefined => {
  if (!d) return undefined;
  const [a, m, di] = chaveDoDia(d).split("-").map(Number);
  return new Date(a, m - 1, di);
};
const doSeletor = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function Tarefas({
  projetoId,
  tarefas,
  equipe,
  agora,
  acoes,
  podeConcluir,
  encerrado,
}: {
  projetoId: string;
  tarefas: TarefaDoProjeto[];
  equipe: Usuario[];
  agora: Date;
  acoes: AcoesDaTela;
  podeConcluir: boolean;
  /** Projeto concluído ou cancelado: a lista vira leitura. */
  encerrado: boolean;
}) {
  const [otimistas, mudar] = useOptimistic(tarefas, aplicar);
  const [, comecar] = useTransition();
  const [abertas, setAbertas] = useState<Set<string>>(() => {
    const primeira = tarefas.find((t) => t.estado !== "CONCLUIDA" && t.estado !== "NAO_SE_APLICA");
    return new Set(primeira ? [primeira.id] : []);
  });

  const alternar = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  /** Aplica na hora, confirma no servidor, e desfaz (a transição termina) se o servidor recusar. */
  const executar = (m: Mudanca, fazer: () => Promise<ResultadoDaAcao>, sucesso?: string) =>
    comecar(async () => {
      mudar(m);
      try {
        const r = await fazer();
        if (!r.ok) toast.error(r.erro);
        else if (sucesso) toast.success(r.msg ?? sucesso);
      } catch {
        toast.error("Não consegui falar com o servidor. Tente de novo.");
      }
    });

  const feitas = otimistas.filter((t) => t.estado === "CONCLUIDA").length;
  const aplicaveis = otimistas.filter((t) => t.estado !== "NAO_SE_APLICA").length;

  if (otimistas.length === 0) {
    return (
      <div className="pv-estado" role="status">
        <h2>Este projeto ainda não tem tarefas</h2>
        <p>As tarefas nascem do playbook da família quando o projeto é criado. Se o playbook estiver vazio, ajuste em Ajustes.</p>
      </div>
    );
  }

  return (
    <section className="pv-secao" aria-label="Tarefas do projeto" data-projeto={projetoId}>
      <div className="pv-secao-cab">
        <h2 className="pv-secao-titulo">Tarefas</h2>
        <span className="pv-secao-nota pv-num">{feitas} de {aplicaveis} concluídas</span>
      </div>
      <ol className="pv-tarefas">
        {otimistas.map((t) => (
          <LinhaDeTarefa
            key={t.id}
            t={t}
            aberta={abertas.has(t.id)}
            aoAlternar={() => alternar(t.id)}
            equipe={equipe}
            agora={agora}
            podeConcluir={podeConcluir && !encerrado}
            aoConcluir={() => executar({ t: "concluir", id: t.id }, () => acoes.concluirTarefa(t.id), "Tarefa concluída.")}
            aoReabrir={() => executar({ t: "reabrir", id: t.id }, () => acoes.reabrirTarefa(t.id), "Tarefa reaberta.")}
            aoMarcarItem={(itemId, feito) => executar({ t: "item", id: itemId, feito }, () => acoes.marcarItem(itemId, feito))}
            aoAtribuir={(para) => executar({ t: "atribuir", id: t.id, para }, () => acoes.atribuirTarefa(t.id, para?.id ?? null), para ? `Tarefa atribuída a ${primeiroNome(para.nome)}.` : "Responsável removido.")}
            aoRemarcar={(para) => executar({ t: "remarcar", id: t.id, para }, () => acoes.remarcarTarefa(t.id, chaveDoDia(para)), "Tarefa remarcada.")}
          />
        ))}
      </ol>
    </section>
  );
}

function LinhaDeTarefa({
  t, aberta, aoAlternar, equipe, agora, podeConcluir, aoConcluir, aoReabrir, aoMarcarItem, aoAtribuir, aoRemarcar,
}: {
  t: TarefaDoProjeto;
  aberta: boolean;
  aoAlternar: () => void;
  equipe: Usuario[];
  agora: Date;
  podeConcluir: boolean;
  aoConcluir: () => void;
  aoReabrir: () => void;
  aoMarcarItem: (itemId: string, feito: boolean) => void;
  aoAtribuir: (para: Usuario | null) => void;
  aoRemarcar: (para: Date) => void;
}) {
  const id = useId();
  const feita = t.estado === "CONCLUIDA";
  const naoSeAplica = t.estado === "NAO_SE_APLICA";
  const p = prazo(t.venceEm, agora);
  const feitos = t.itens.filter((i) => i.feito).length;
  const remarcada = t.venceEmOriginal && t.venceEm && chaveDoDia(t.venceEmOriginal) !== chaveDoDia(t.venceEm);
  const [calAberto, setCalAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Date | undefined>(undefined);

  return (
    <li className="pv-tarefa" data-aberta={aberta || undefined} data-estado={t.estado}>
      <div className="pv-tarefa-cab">
        <button
          type="button"
          className="pv-marca"
          data-feita={feita || undefined}
          disabled={!podeConcluir || naoSeAplica}
          onClick={feita ? aoReabrir : aoConcluir}
          aria-label={feita ? `Reabrir tarefa: ${t.titulo}` : `Concluir tarefa: ${t.titulo}`}
          title={podeConcluir ? (feita ? "Reabrir" : "Concluir") : "Você não pode alterar esta tarefa"}
        >
          <Check aria-hidden />
        </button>

        <button type="button" className="pv-tarefa-corpo-cab" onClick={aoAlternar} aria-expanded={aberta} aria-controls={`${id}-detalhe`}>
          <span className="pv-tarefa-titulo">{t.titulo}</span>
          <span className="pv-tarefa-meta">
            {feita && t.concluidaEm ? (
              <span><Check aria-hidden /> Concluída em {dia(t.concluidaEm, agora)}</span>
            ) : (
              <span data-pv-tom={t.atrasada ? "risco" : undefined}>
                {t.atrasada ? <AlarmClock aria-hidden /> : <CalendarDays aria-hidden />}
                {p.texto}{t.venceEm ? ` · ${dia(t.venceEm, agora)}` : ""}
              </span>
            )}
            {remarcada && t.venceEmOriginal ? <span>remarcada de {dia(t.venceEmOriginal, agora)}</span> : null}
            {t.itens.length > 0 ? <span className="pv-num"><ListChecks aria-hidden />{feitos}/{t.itens.length}</span> : null}
            {t.comentarios > 0 ? <span className="pv-num"><MessageSquare aria-hidden />{t.comentarios}</span> : null}
            {t.condicional ? <span>só quando contratado</span> : null}
          </span>
        </button>

        <div className="pv-tarefa-lado">
          {t.responsavel ? <Avatar quem={t.responsavel} tamanho="sm" /> : null}
          <PilulaDeTarefa estado={t.estado} />
          <button type="button" className="pv-expandir" onClick={aoAlternar} aria-label={aberta ? "Recolher tarefa" : "Expandir tarefa"} aria-expanded={aberta} aria-controls={`${id}-detalhe`}>
            <ChevronDown aria-hidden />
          </button>
        </div>
      </div>

      {aberta ? (
        <div className="pv-tarefa-detalhe" id={`${id}-detalhe`}>
          <div>
            <h3 className="pv-rotulo pv-playbook-tit">Playbook</h3>
            {t.playbook ? <Markdown fonte={t.playbook} /> : <p className="pv-secao-nota">Esta tarefa não tem playbook. Escreva um em Ajustes para o time seguir o mesmo passo a passo.</p>}
          </div>

          <div>
            <h3 className="pv-rotulo pv-check-tit">Checklist</h3>
            {t.itens.length > 0 ? (
              <ul className="pv-check">
                {t.itens.map((i) => (
                  <li key={i.id}>
                    <label className="pv-check-item" data-feito={i.feito || undefined}>
                      <Checkbox checked={i.feito} disabled={!podeConcluir || feita} onCheckedChange={(v) => aoMarcarItem(i.id, v === true)} />
                      <span>{i.titulo}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pv-secao-nota">Sem checklist: a tarefa se resolve inteira.</p>
            )}
          </div>

          {podeConcluir && !naoSeAplica ? (
            <div className="pv-tarefa-acoes">
              {feita ? (
                <Button variant="outline" size="sm" onClick={aoReabrir}><RotateCcw aria-hidden /> Reabrir</Button>
              ) : (
                <Button size="sm" onClick={aoConcluir}><Check aria-hidden /> Concluir tarefa</Button>
              )}

              {!feita ? (
                <Popover open={calAberto} onOpenChange={(a) => { setCalAberto(a); if (a) setRascunho(paraSeletor(t.venceEm)); }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm"><CalendarDays aria-hidden /> Remarcar</Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar mode="single" locale={ptBR} selected={rascunho} defaultMonth={rascunho} onSelect={setRascunho} />
                    <div className="flex justify-end gap-2 border-t p-2">
                      <Button variant="ghost" size="sm" onClick={() => setCalAberto(false)}>Cancelar</Button>
                      <Button
                        size="sm"
                        disabled={!rascunho}
                        onClick={() => {
                          if (rascunho) aoRemarcar(new Date(`${doSeletor(rascunho)}T12:00:00-03:00`));
                          setCalAberto(false);
                        }}
                      >
                        Confirmar nova data
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}

              {equipe.length > 0 ? (
                <div className="pv-tarefa-acoes-fim">
                  <Select
                    value={t.responsavel?.id ?? SEM_RESPONSAVEL}
                    onValueChange={(v) => aoAtribuir(v === SEM_RESPONSAVEL ? null : (equipe.find((u) => u.id === v) ?? null))}
                  >
                    <SelectTrigger size="sm" aria-label={`Responsável por ${t.titulo}`}>
                      <SelectValue placeholder="Atribuir a">{t.responsavel ? t.responsavel.nome : "Sem responsável"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value={SEM_RESPONSAVEL}>Sem responsável</SelectItem>
                      {equipe.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
