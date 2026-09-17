"use client";

import { ChangeEvent, FormEvent, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";

type Dados = Record<string, string>;
type Arquivo = { url: string; nomeOriginal: string };

const inicial: Dados = {
  dominio: "", tecnicoNome: "", tecnicoEmail: "", tecnicoTelefone: "",
  corPrimaria: "#1D6B52", corSecundaria: "#101828", faturamentoNome: "",
  faturamentoEmail: "", diaFechamento: "", prazoPagamento: "", observacoes: "",
};

export default function FormularioWhiteLabelPublico() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<Dados>(inicial);
  const [logo, setLogo] = useState<Arquivo | null>(null);
  const [favicon, setFavicon] = useState<Arquivo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    fetch(`/api/fulfillment-formulario/${token}`).then(async (r) => {
      if (!r.ok) throw new Error("Este link é inválido ou expirou.");
      return r.json();
    }).then((res) => {
      if (res.fulfillment?.serviceFamily !== "WHITE_LABEL") throw new Error("Este link não é de uma implantação White Label.");
      const w = res.formulario?.respostas?.whiteLabel;
      if (w) {
        const campos = Object.fromEntries(Object.entries(w).filter(([, v]) => typeof v === "string")) as Dados;
        setDados((atual) => ({ ...atual, ...campos }));
        setLogo(w.logo ?? null); setFavicon(w.favicon ?? null);
      }
      setEnviado(res.formulario?.status === "SUBMITTED");
    }).catch((e: Error) => setErro(e.message)).finally(() => setCarregando(false));
  }, [token]);

  function atualizar(campo: string, valor: string) { setDados((atual) => ({ ...atual, [campo]: valor })); }
  async function upload(event: ChangeEvent<HTMLInputElement>, tipo: "logo" | "favicon") {
    const arquivo = event.target.files?.[0]; if (!arquivo) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type)) { setErro("Use PNG, JPG ou WebP."); return; }
    setErro(""); const form = new FormData(); form.append("file", arquivo);
    const r = await fetch(`/api/fulfillment-formulario/${token}/upload`, { method: "POST", body: form });
    const res = await r.json(); if (!r.ok) { setErro(res.error ?? "Não foi possível enviar o arquivo."); return; }
    const enviado = { url: res.url, nomeOriginal: res.nomeOriginal };
    tipo === "logo" ? setLogo(enviado) : setFavicon(enviado);
  }
  async function enviar(event: FormEvent) {
    event.preventDefault(); setErro("");
    if (!dados.dominio || !dados.tecnicoNome || !dados.tecnicoEmail || !dados.faturamentoEmail) { setErro("Preencha domínio, contato técnico e e-mail de faturamento."); return; }
    setEnviando(true);
    const r = await fetch(`/api/fulfillment-formulario/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respostas: { whiteLabel: { ...dados, logo, favicon, confirmadoEm: new Date().toISOString() } } }) });
    const res = await r.json(); setEnviando(false);
    if (!r.ok) { setErro(res.error ?? "Não foi possível enviar agora."); return; }
    setEnviado(true);
  }
  if (carregando) return <main className="min-h-screen grid place-items-center bg-slate-50 text-slate-600">Carregando formulário…</main>;
  if (erro && !dados.dominio) return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold text-slate-900">Não foi possível abrir o formulário</h1><p className="mt-3 text-slate-600">{erro}</p></div></main>;
  if (enviado) return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><div className="max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold text-emerald-700">Informações recebidas</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">Obrigado por enviar os materiais.</h1><p className="mt-3 text-slate-600">Nossa equipe vai validar as informações e seguirá com os próximos passos da implantação.</p></div></main>;
  return <main className="min-h-screen bg-slate-50 py-10 px-4"><form onSubmit={enviar} className="mx-auto max-w-3xl rounded-2xl bg-white p-6 sm:p-10 shadow-sm"><p className="text-sm font-semibold text-emerald-700">Callface</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Implantação White Label</h1><p className="mt-3 text-slate-600">Preencha os dados abaixo para prepararmos seu ambiente com a identidade da sua marca.</p>{erro && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    <Secao titulo="Domínio e contato técnico"><Campo label="Domínio ou subdomínio desejado" campo="dominio" dados={dados} atualizar={atualizar} placeholder="app.suaempresa.com.br" required /><Campo label="Responsável técnico por DNS" campo="tecnicoNome" dados={dados} atualizar={atualizar} required /><Campo label="E-mail do responsável técnico" campo="tecnicoEmail" tipo="email" dados={dados} atualizar={atualizar} required /><Campo label="Telefone / WhatsApp" campo="tecnicoTelefone" dados={dados} atualizar={atualizar} /></Secao>
    <Secao titulo="Identidade visual"><Upload label="Logo da marca" arquivo={logo} aoMudar={(e) => upload(e, "logo")} /><Upload label="Favicon" arquivo={favicon} aoMudar={(e) => upload(e, "favicon")} /><div className="grid gap-4 sm:grid-cols-2"><Campo label="Cor primária" campo="corPrimaria" dados={dados} atualizar={atualizar} placeholder="#1D6B52" /><Campo label="Cor secundária" campo="corSecundaria" dados={dados} atualizar={atualizar} placeholder="#101828" /></div></Secao>
    <Secao titulo="Faturamento"><Campo label="Nome do contato de faturamento" campo="faturamentoNome" dados={dados} atualizar={atualizar} /><Campo label="E-mail de faturamento" campo="faturamentoEmail" tipo="email" dados={dados} atualizar={atualizar} required /><div className="grid gap-4 sm:grid-cols-2"><Campo label="Dia de fechamento" campo="diaFechamento" dados={dados} atualizar={atualizar} placeholder="Ex.: dia 25" /><Campo label="Prazo de pagamento acordado" campo="prazoPagamento" dados={dados} atualizar={atualizar} placeholder="Ex.: 15 dias" /></div></Secao>
    <Secao titulo="Observações"><label className="block text-sm font-medium text-slate-800">Alguma informação adicional?</label><textarea value={dados.observacoes} onChange={(e) => atualizar("observacoes", e.target.value)} rows={4} className="mt-2 w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-emerald-600" /></Secao><label className="mt-6 flex gap-3 text-sm text-slate-600"><input required type="checkbox" className="mt-1" />Confirmo que as informações enviadas estão corretas.</label><button disabled={enviando} className="mt-6 w-full rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{enviando ? "Enviando…" : "Enviar informações"}</button></form></main>;
}
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) { return <section className="mt-8 border-t border-slate-200 pt-6"><h2 className="text-lg font-semibold text-slate-950">{titulo}</h2><div className="mt-4 grid gap-4">{children}</div></section>; }
function Campo({ label, campo, dados, atualizar, tipo = "text", placeholder, required }: { label: string; campo: string; dados: Dados; atualizar: (c: string, v: string) => void; tipo?: string; placeholder?: string; required?: boolean }) { return <label className="block text-sm font-medium text-slate-800">{label}<input required={required} type={tipo} value={dados[campo]} onChange={(e) => atualizar(campo, e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal outline-none focus:border-emerald-600" /></label>; }
function Upload({ label, arquivo, aoMudar }: { label: string; arquivo: Arquivo | null; aoMudar: (e: ChangeEvent<HTMLInputElement>) => void }) { return <label className="block rounded-lg border border-dashed border-slate-300 p-4 text-sm font-medium text-slate-800">{label}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={aoMudar} className="mt-2 block text-sm font-normal" />{arquivo && <span className="mt-2 block text-sm font-normal text-emerald-700">Enviado: {arquivo.nomeOriginal}</span>}</label>; }
