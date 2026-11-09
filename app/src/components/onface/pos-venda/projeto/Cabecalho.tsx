"use client";

/**
 * Cabeçalho do projeto: migalha, nome grande, estado ao lado e as ações.
 *
 * As ações vêm de `projeto.permissoes` — a tela não decide permissão sozinha.
 * Botão que o usuário não pode usar não aparece (em vez de aparecer morto).
 */
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Hourglass, Rocket, Send } from "lucide-react";
import { RadioGroup as RG } from "radix-ui";
import type { MotivoDaEspera, Projeto } from "@/lib/pos-venda/contrato";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dia, FAMILIAS, MOTIVOS, TIPO } from "../formatos";
import { Avatar, MarcaDaFamilia, PilhaDeAvatares, PilulaDeEstado } from "../pecas";
import { useAcao, type AcoesDaTela } from "./acoes";

const MOTIVOS_ORDEM: MotivoDaEspera[] = ["cliente", "operadora", "interno"];

export function Cabecalho({ projeto, agora, acoes }: { projeto: Projeto; agora: Date; acoes: AcoesDaTela }) {
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
      <dl className="pv-props">
        <div className="pv-prop">
          <dt>Responsável</dt>
          <dd>
            {p.responsavel ? (
              <span className="pv-prop-pilula"><Avatar quem={p.responsavel} tamanho="sm" titulo={false} decorativo />{p.responsavel.nome}</span>
            ) : (
              <span className="pv-prop-pilula" data-vazio="true">Sem responsável</span>
            )}
          </dd>
        </div>
        <div className="pv-prop">
          <dt>Vendedor</dt>
          <dd data-ausente={!p.vendedor || undefined}>
            {p.vendedor ? <span className="pv-prop-pilula"><Avatar quem={p.vendedor} tamanho="sm" titulo={false} decorativo />{p.vendedor.nome}</span> : "Não registrado"}
          </dd>
        </div>
        <div className="pv-prop">
          <dt>{p.concluidoEm ? "Concluído em" : "Entrou em"}</dt>
          <dd className="pv-num">{dia(p.concluidoEm ?? p.entrouEm, agora)}</dd>
        </div>
        <div className="pv-prop">
          <dt>Prazo</dt>
          <dd className="pv-num" data-ausente={!p.relogios.venceEm || undefined}>
            {p.relogios.venceEm ? dia(p.relogios.venceEm, agora) : p.t0Em === null && p.familia === "PABX" ? "Começa no T0" : "Não definido"}
          </dd>
        </div>
        <div className="pv-prop">
          <dt>Contatos</dt>
          <dd data-ausente={p.pessoas.length === 0 || undefined}>
            {p.pessoas.length > 0 ? <PilhaDeAvatares pessoas={p.pessoas} max={4} /> : "Nenhum cadastrado"}
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
