"use client";

/**
 * Cabeçalho do projeto: migalha, nome grande, estado ao lado e as ações.
 *
 * As ações vêm de `projeto.permissoes` — a tela não decide permissão sozinha.
 * Botão que o usuário não pode usar não aparece (em vez de aparecer morto).
 */
import { useState } from "react";
import Link from "next/link";
import { ptBR } from "react-day-picker/locale";
import { CalendarDays, ChevronRight, Hourglass, Rocket, Send } from "lucide-react";
import { RadioGroup as RG } from "radix-ui";
import type { MotivoDaEspera, Projeto, Usuario } from "@/lib/pos-venda/contrato";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chaveDoDia, dia, diaEHora, FAMILIAS, fichaDaPessoa, haQuanto, MOTIVOS, prazo as lerPrazo, TIPO } from "../formatos";
import { Avatar, MarcaDaFamilia, PilulaDeEstado } from "../pecas";
import { SeletorDePessoa } from "../SeletorDePessoa";
import { useAcao, type AcoesDaTela } from "./acoes";

const MOTIVOS_ORDEM: MotivoDaEspera[] = ["cliente", "operadora", "interno"];

/** Dia do calendário local a partir do dia de São Paulo, e a volta. */
const paraSeletor = (d: Date | null): Date | undefined => {
  if (!d) return undefined;
  const [a, m, di] = chaveDoDia(d).split("-").map(Number);
  return new Date(a, m - 1, di);
};
const doSeletor = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function Cabecalho({ projeto, equipe, agora, acoes }: { projeto: Projeto; equipe: Usuario[]; agora: Date; acoes: AcoesDaTela }) {
  const p = projeto;
  const [espera, setEspera] = useState(false);
  const [confirma, setConfirma] = useState<null | "escalar" | "handoff">(null);
  const { pendente, rodar } = useAcao();

  const podeEsperar = p.permissoes.podeMarcarEspera && !p.relogios.esperando;

  return (
    <header className="pv-cab">
      <nav aria-label="Migalha">
        <ol className="pv-migalha">
          <li><Link href="/pos-vendas">Pós-vendas</Link><ChevronRight aria-hidden /></li>
          <li><Link href={`/pos-vendas?familia=${p.familia}`}>{FAMILIAS[p.familia].rotulo}</Link><ChevronRight aria-hidden /></li>
          <li><span aria-current="page">{p.empresa.nome}</span></li>
        </ol>
      </nav>

      <div className="pv-cab-linha">
        <div className="pv-cab-id">
          <h1 className="pv-titulo">{p.empresa.nome}</h1>
          <div className="pv-cab-meta">
            <PilulaDeEstado estado={p.estado} />
            <MarcaDaFamilia familia={p.familia} />
            <span className="pv-meta-item">{TIPO[p.tipo]}{p.ciclo > 1 ? ` · ciclo ${p.ciclo}` : ""}</span>
          </div>
        </div>

        <div className="pv-cab-acoes">
          {podeEsperar ? (
            <Button variant="outline" onClick={() => setEspera(true)}>
              <Hourglass aria-hidden /> Marcar espera
            </Button>
          ) : null}
          {p.permissoes.podeEscalarParaImplantacao ? (
            <Button onClick={() => setConfirma("escalar")}>
              <Rocket aria-hidden /> Escalar para implantação
            </Button>
          ) : null}
          {p.permissoes.podeFazerHandoff ? (
            <Button onClick={() => setConfirma("handoff")}>
              <Send aria-hidden /> Fazer handoff
            </Button>
          ) : null}
        </div>
      </div>

      {/* Propriedades: o que o time precisa saber antes de abrir qualquer aba.
          Cada uma tem lugar mesmo quando o dado não existe — projeto sem dono
          e sem contato é o caso comum, e o cabeçalho não pode mudar de forma. */}
      {/* Responsável e prazo são EDITÁVEIS AQUI: eram a primeira e a quinta
          reclamação do dono. O padrão é o da gaveta de atividade — em repouso
          parece texto, o clique abre o controle no lugar, sem modal e sem
          botão Salvar. */}
      <dl className="pv-props">
        <div className="pv-prop">
          <dt>Responsável</dt>
          <dd>
            <SeletorDePessoa
              valor={p.responsavel}
              equipe={equipe}
              rotulo="Responsável pelo projeto"
              desabilitado={!acoes.atribuirProjeto || !p.permissoes.podeTrocarResponsavel}
              aoEscolher={(quem) => {
                const trocar = acoes.atribuirProjeto;
                if (!trocar) return;
                rodar(() => trocar(quem?.id ?? null), quem ? `Projeto atribuído a ${quem.nome}.` : "Responsável removido.");
              }}
            />
          </dd>
        </div>

        <div className="pv-prop">
          <dt>Vendedor</dt>
          <dd data-ausente={!p.vendedor || undefined}>
            {p.vendedor ? <span className="pv-prop-pilula"><Avatar quem={p.vendedor} tamanho="sm" titulo={false} decorativo />{p.vendedor.nome}</span> : "Não registrado"}
          </dd>
        </div>

        {/* "Só tem um dia. Cadê a data, cadê os detalhes?" — dia, hora e há
            quanto tempo, que é o que de fato responde "quando ele entrou?". */}
        <div className="pv-prop">
          <dt>{p.concluidoEm ? "Concluído em" : "Entrou em"}</dt>
          <dd>
            <time className="pv-num" dateTime={(p.concluidoEm ?? p.entrouEm).toISOString()}>
              {diaEHora(p.concluidoEm ?? p.entrouEm, agora)}
            </time>
            <span className="pv-prop-apoio">{haQuanto(p.concluidoEm ?? p.entrouEm, agora)}</span>
          </dd>
        </div>

        <div className="pv-prop">
          <dt>Prazo</dt>
          <dd>
            <PrazoDoProjeto
              venceEm={p.relogios.venceEm}
              venceEmOriginal={p.relogios.venceEmOriginal}
              agora={agora}
              comecaNoT0={p.t0Em === null && p.familia === "PABX"}
              podeEditar={Boolean(p.permissoes.podeEditarPrazo && acoes.editarPrazoProjeto)}
              aoEscolher={(diaISO) => {
                const editar = acoes.editarPrazoProjeto;
                if (!editar) return;
                rodar(() => editar(diaISO), diaISO ? "Prazo definido." : "Prazo removido.");
              }}
            />
          </dd>
        </div>

        {/* "Contatos, não consigo clicar": cada um leva para a ficha da pessoa. */}
        <div className="pv-prop" data-largo="true">
          <dt>Contatos</dt>
          <dd data-ausente={p.pessoas.length === 0 || undefined}>
            {p.pessoas.length > 0 ? (
              <ul className="pv-contatos">
                {p.pessoas.slice(0, 5).map((q) => {
                  const ficha = fichaDaPessoa(q);
                  return (
                    <li key={q.id}>
                      {ficha ? (
                        <Link className="pv-contato" href={ficha} title={`Abrir a ficha de ${q.nome}`}>
                          <Avatar quem={q} tamanho="sm" titulo={false} decorativo />
                          <span className="pv-truncar">{q.nome}</span>
                        </Link>
                      ) : (
                        <span className="pv-contato" data-sem-ficha="true" title={`${q.nome} ainda não tem ficha aberta`}>
                          <Avatar quem={q} tamanho="sm" titulo={false} decorativo />
                          <span className="pv-truncar">{q.nome}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
                {p.pessoas.length > 5 ? <li className="pv-contatos-mais">+{p.pessoas.length - 5}</li> : null}
              </ul>
            ) : (
              "Nenhum cadastrado"
            )}
          </dd>
        </div>

        {p.empresa.documento ? (
          <div className="pv-prop">
            <dt>Documento</dt>
            <dd className="pv-num">{p.empresa.documento}</dd>
          </div>
        ) : null}
      </dl>

      <DialogoDeEspera
        aberto={espera}
        aoFechar={() => setEspera(false)}
        aoConfirmar={(motivo, detalhe) =>
          rodar(() => acoes.marcarEspera(motivo, detalhe), "Espera marcada. O relógio do time pausou.", (ok) => ok && setEspera(false))
        }
        pendente={pendente}
      />

      <AlertDialog open={confirma !== null} onOpenChange={(a) => !a && setConfirma(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirma === "escalar" ? "Escalar para implantação?" : "Fazer o handoff?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirma === "escalar"
                ? "Os materiais ficam como validados, o T0 é gravado e o projeto de implantação é aberto. O prazo da implantação começa a contar."
                : "A entrega passa para a implantação e este projeto sai do seu board. O tempo total fica registrado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirma === "escalar"
                  ? rodar(() => acoes.escalarParaImplantacao(), "Projeto de implantação aberto.")
                  : rodar(() => acoes.fazerHandoff(), "Handoff feito.")
              }
            >
              {confirma === "escalar" ? "Escalar" : "Fazer handoff"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}

/**
 * O prazo do projeto, editável no lugar.
 *
 * "Prazo: não definido" era um beco: o texto dizia que faltava e não havia
 * como resolver. Agora o próprio valor é o gatilho do calendário.
 *
 * Três ausências diferentes, três frases diferentes — nenhuma é "—":
 * o PABX antes do T0 ainda NÃO DEVE ter prazo (o relógio não começou), o
 * projeto sem permissão mostra o estado sem convidar ao clique, e o resto
 * convida a definir.
 */
function PrazoDoProjeto({
  venceEm, venceEmOriginal, agora, comecaNoT0, podeEditar, aoEscolher,
}: {
  venceEm: Date | null;
  /** O prazo que valia antes de alguém remarcar. Null quando nunca mudou. */
  venceEmOriginal: Date | null;
  agora: Date;
  comecaNoT0: boolean;
  podeEditar: boolean;
  aoEscolher: (diaISO: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Date | undefined>(undefined);
  const p = venceEm ? lerPrazo(venceEm, agora) : null;

  const texto = venceEm ? dia(venceEm, agora) : comecaNoT0 ? "Começa no T0" : "Definir prazo";
  /* Remarcar é visível: o prazo de hoje vale, e o de antes fica dito ao lado.
     `venceEmOriginal` só vem quando de fato mudou, então não há "era" igual
     ao "vence". */
  const era = venceEmOriginal ? `era ${dia(venceEmOriginal, agora)}` : null;

  if (!podeEditar) {
    return (
      <span className="pv-num" data-ausente={!venceEm || undefined}>
        {venceEm ? texto : comecaNoT0 ? "Começa no T0" : "Não definido"}
        {p ? <span className="pv-prop-apoio" data-pv-tom={p.tom}>{p.texto}</span> : null}
        {era ? <span className="pv-prop-apoio">{era}</span> : null}
      </span>
    );
  }

  return (
    <Popover open={aberto} onOpenChange={(a) => { setAberto(a); if (a) setRascunho(paraSeletor(venceEm)); }}>
      <PopoverTrigger asChild>
        <button type="button" className="pv-editavel" data-vazio={!venceEm || undefined} aria-label={`Prazo do projeto: ${venceEm ? texto : "não definido"}. Alterar`}>
          <CalendarDays aria-hidden />
          <span className="pv-num">{texto}</span>
          {p ? <span className="pv-prop-apoio" data-pv-tom={p.tom}>{p.texto}</span> : null}
          {era ? <span className="pv-prop-apoio">{era}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" locale={ptBR} selected={rascunho} defaultMonth={rascunho ?? agora} onSelect={setRascunho} />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          {venceEm ? (
            <Button variant="ghost" size="sm" onClick={() => { aoEscolher(null); setAberto(false); }}>Remover prazo</Button>
          ) : <span />}
          <span className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button size="sm" disabled={!rascunho} onClick={() => { if (rascunho) aoEscolher(doSeletor(rascunho)); setAberto(false); }}>
              Confirmar
            </Button>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DialogoDeEspera({ aberto, aoFechar, aoConfirmar, pendente }: { aberto: boolean; aoFechar: () => void; aoConfirmar: (m: MotivoDaEspera, detalhe: string) => void; pendente: boolean }) {
  const [motivo, setMotivo] = useState<MotivoDaEspera | "">("");
  const [detalhe, setDetalhe] = useState("");

  return (
    <Dialog open={aberto} onOpenChange={(a) => { if (!a) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar espera</DialogTitle>
          <DialogDescription>
            O relógio do time pausa. Diga quem está com a bola: sem o motivo não dá para atribuir o atraso a quem o causou.
          </DialogDescription>
        </DialogHeader>

        <RG.Root className="pv-opcoes" value={motivo} onValueChange={(v) => setMotivo(v as MotivoDaEspera)} aria-label="Quem está com a bola">
          {MOTIVOS_ORDEM.map((m) => (
            <RG.Item key={m} value={m} className="pv-opcao">
              <strong>{MOTIVOS[m].rotulo}</strong>
              <span>{MOTIVOS[m].explicacao}</span>
            </RG.Item>
          ))}
        </RG.Root>

        <div className="pv-campo">
          <label htmlFor="pv-espera-detalhe">O que está sendo esperado</label>
          <textarea
            id="pv-espera-detalhe"
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            placeholder="Ex.: aguardando portabilidade da Vivo, protocolo 123"
            maxLength={300}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button disabled={!motivo} loading={pendente} onClick={() => motivo && aoConfirmar(motivo, detalhe)}>
            Pausar relógio do time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
