"use client";

import { resumoDoEnvio } from "@/components/onface/proto/envio-da-proposta";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  acaoCriarRevisao, acaoEnviar, acaoReprocessarAceite, acaoSalvarJuridicos, type DetalheProposta,
} from "@/app/(produto)/propostas/actions";
import { VALIDADES_PROPOSTA } from "@/lib/vendas/dominio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AcoesProposta, ApoioProposta, CorpoProposta, TagsProposta } from "./PropostaCorpo";
import { Bloco, PaginaColunas, PaginaEntidade } from "./pagina";

const CAMPOS_EMPRESA = [
  ["razaoSocial", "Razão social"], ["cnpj", "CNPJ"], ["logradouro", "Rua"], ["numero", "Número"],
  ["complemento", "Complemento"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["estado", "Estado"], ["cep", "CEP"],
] as const;

/** Leitura integral da proposta, e as três ações que mudam o estado dela, feitas AQUI:
 *  enviar, criar revisão e completar os dados jurídicos da empresa. Antes cada uma
 *  empurrava para `/propostas/nova?acao=...`, que só devolvia a lista. A edição das
 *  linhas do rascunho continua no builder (`/propostas/nova?oportunidade=...`). */
export function DetalhePropostaPagina({ proposta, voltar, abrirEnvio = false }: { proposta: DetalheProposta; voltar: string; abrirEnvio?: boolean }) {
  const router = useRouter();
  const [pendente, setPendente] = React.useState(false);
  const [enviando, setEnviando] = React.useState(abrirEnvio && proposta.status === "rascunho");
  const [juridicos, setJuridicos] = React.useState(false);

  const revisar = async () => {
    setPendente(true);
    const r = await acaoCriarRevisao(proposta.id);
    setPendente(false);
    if (!r.ok) { toast.error(r.erro); return false; }
    toast.success(`Revisão v${r.dados?.versao} criada como rascunho.`);
    router.push(`${voltar}/${r.dados?.propostaId}`);
    return true;
  };

  const reprocessar = async () => {
    setPendente(true);
    const r = await acaoReprocessarAceite(proposta.id);
    setPendente(false);
    if (!r.ok) { toast.error(r.erro); return; }
    const { resultado, detalhes } = r.dados!;
    if (resultado === "andou") toast.success("Aceite reprocessado: o contrato ou o pagamento foi gerado.");
    else toast.warning(`${resultado === "ainda_parado" ? "Ainda não andou." : "Nada a fazer agora."} ${detalhes.join(" ")}`, { duration: 12000 });
    router.refresh();
  };

  const acoes = {
    enviar: () => setEnviando(true),
    revisar,
    completarJuridicos: () => setJuridicos(true),
    reprocessar,
  };

  const editarLinhas = proposta.status === "rascunho" && proposta.oportunidade.id
    ? `${voltar}/nova?${new URLSearchParams({ oportunidade: proposta.oportunidade.id, proposta: proposta.id })}`
    : null;

  return (
    <PaginaEntidade
      voltar={{ href: voltar, rotulo: "Voltar para Propostas" }}
      titulo={`Proposta #${proposta.numero} · v${proposta.versao}`}
      subtitulo={proposta.empresa.nome ?? proposta.oportunidade.titulo ?? undefined}
      tags={<TagsProposta proposta={proposta} />}
    >
      <PaginaColunas
        principal={<>
          <Bloco titulo="Ações">
            <div className="ov-acoes">
              <AcoesProposta proposta={proposta} pendente={pendente} acoes={acoes} />
              {editarLinhas ? (
                <Link className="ov-botao" data-variante="contorno" href={editarLinhas}>Editar itens</Link>
              ) : null}
            </div>
          </Bloco>
          <CorpoProposta proposta={proposta} pendente={pendente} bloqueio={null} variante="pagina" acoes={acoes} />
        </>}
        lateral={<ApoioProposta proposta={proposta} variante="pagina" contato={proposta.contato} acoes={acoes} />}
      />

      <EnviarDialog proposta={proposta} aberto={enviando} fechar={() => setEnviando(false)}
        completarJuridicos={() => { setEnviando(false); setJuridicos(true); }} />
      {proposta.empresa.id ? (
        <JuridicosDialog proposta={proposta} aberto={juridicos} fechar={() => setJuridicos(false)} />
      ) : null}
    </PaginaEntidade>
  );
}

function EnviarDialog({ proposta, aberto, fechar, completarJuridicos }: {
  proposta: DetalheProposta; aberto: boolean; fechar: () => void; completarJuridicos: () => void;
}) {
  const router = useRouter();
  const [modo, setModo] = React.useState<"CONTRACT" | "PREPAID">(proposta.modoFechamento === "PREPAID" ? "PREPAID" : "CONTRACT");
  const [validade, setValidade] = React.useState(String(proposta.validadeDias ?? 14));
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<{ texto: string; juridicos: boolean } | null>(null);
  const emailDoContato = proposta.contato?.email ?? null;
  const [porEmail, setPorEmail] = React.useState(!!emailDoContato);
  const telefoneDoContato = proposta.contato?.telefone ?? null;
  const [porWhatsapp, setPorWhatsapp] = React.useState(false);

  const enviar = async () => {
    setSalvando(true); setErro(null);
    const r = await acaoEnviar({
      propostaId: proposta.id, modoFechamento: modo, validadeDias: Number(validade),
      tipoContratual: modo === "CONTRACT" ? "NOVO_CONTRATO" : null,
      enviarEmail: porEmail, destinatarioEmail: porEmail ? emailDoContato : null,
      // Pelo número de WhatsApp de QUEM clica em enviar (o do Atendimento); sem número conectado, não sai por outro.
      enviarWhatsapp: porWhatsapp, telefoneWhatsapp: porWhatsapp ? telefoneDoContato : null,
    });
    setSalvando(false);
    if (!r.ok) { setErro({ texto: r.erro, juridicos: r.acao?.tipo === "completar_dados_empresa" }); return; }
    // Diz o que de fato saiu (e-mail e WhatsApp), não o que estava marcado: prometer "avisa o cliente" sem avisar era o defeito.
    const resumo = resumoDoEnvio(r.dados);
    const texto = `Proposta #${proposta.numero} enviada. ${resumo.linhas.join(" ")}`;
    if (resumo.falhou) toast.warning(texto, { duration: 12000 }); else toast.success(texto);
    fechar();
    router.refresh();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar proposta #{proposta.numero} · v{proposta.versao}</DialogTitle>
          <DialogDescription>O envio leva a oportunidade para Proposta. O e-mail ao contato só sai se estiver marcado.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            Como o cliente fecha
            <NativeSelect value={modo} onChange={(e) => setModo(e.target.value as "CONTRACT" | "PREPAID")}>
              <NativeSelectOption value="CONTRACT">Contrato e assinatura</NativeSelectOption>
              <NativeSelectOption value="PREPAID">Checkout (pagamento direto)</NativeSelectOption>
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            Validade
            <NativeSelect value={validade} onChange={(e) => setValidade(e.target.value)}>
              {VALIDADES_PROPOSTA.map((d) => <NativeSelectOption key={d} value={d}>{d} dias</NativeSelectOption>)}
            </NativeSelect>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={porEmail} disabled={!emailDoContato} onCheckedChange={(v) => setPorEmail(v === true)} />
            {emailDoContato ? `Enviar o link por e-mail para ${emailDoContato}` : "O contato não tem e-mail: só o link será gerado"}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={porWhatsapp} disabled={!telefoneDoContato} onCheckedChange={(v) => setPorWhatsapp(v === true)} />
            {telefoneDoContato ? `Enviar o link por WhatsApp para ${telefoneDoContato}, pelo seu número do Atendimento` : "O contato não tem número de WhatsApp"}
          </label>
          {erro ? (
            <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
              {erro.texto}
              {erro.juridicos && proposta.empresa.id ? (
                <div className="mt-2"><Button size="sm" variant="outline" onClick={completarJuridicos}>Completar dados da empresa</Button></div>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={salvando} onClick={fechar}>Cancelar</Button>
          <Button disabled={salvando} onClick={enviar}>{salvando ? "Enviando…" : "Enviar proposta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JuridicosDialog({ proposta, aberto, fechar }: { proposta: DetalheProposta; aberto: boolean; fechar: () => void }) {
  const router = useRouter();
  const [v, setV] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS_EMPRESA.map(([k]) => [k, String((proposta.juridicos as Record<string, string | null> | null)?.[k] ?? "")])));
  const [salvando, setSalvando] = React.useState(false);

  const salvar = async () => {
    setSalvando(true);
    const r = await acaoSalvarJuridicos(proposta.empresa.id!, v);
    setSalvando(false);
    if (!r.ok) { toast.error(r.erro); return; }
    toast.success(r.dados?.completo ? "Dados da empresa completos." : `Salvo. Ainda falta: ${r.dados?.faltando.join(", ")}.`);
    fechar();
    router.refresh();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dados da empresa</DialogTitle>
          <DialogDescription>Ficam na Empresa e servem para as próximas propostas e contratos.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {CAMPOS_EMPRESA.map(([k, rotulo]) => (
            <label key={k} className="grid gap-1 text-sm">
              {rotulo}
              <Input value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={salvando} onClick={fechar}>Cancelar</Button>
          <Button disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
