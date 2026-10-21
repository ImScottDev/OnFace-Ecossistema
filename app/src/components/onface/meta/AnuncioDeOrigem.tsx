"use client";
/**
 * O anúncio que trouxe o lead — a peça ÚNICA, em toda superfície.
 *
 * Antes cada tela resolvia isto do seu jeito, e as três erravam diferente:
 * a ficha de pessoa mostrava o `ad_id` de 17 dígitos e um link que abria a
 * Biblioteca de Anúncios (que indexa pelo Ad Archive ID, não pelo `ad_id`, e
 * dava "nenhum anúncio encontrado" sempre); a ficha de empresa repetia o mesmo
 * link no bloco de formulários; e a gaveta do Financeiro montava um "Criativo"
 * próprio com `utmContent || metaAdId`, sem nome da Meta e sem link nenhum.
 *
 * O nome do anúncio JÁ ESTAVA gravado o tempo todo (`meta_ad_nome`,
 * `meta_conjunto_nome`, `meta_campanha_nome`, de `camposRastreioMeta`) e
 * nenhuma das três lia.
 *
 * E mandar para o Gerenciador não resolve: ele exige acesso à conta de
 * anúncios, que quem atende o lead não tem — e quem tem cai na última conta
 * que usou, não na do anúncio. Por isso o criativo aparece AQUI DENTRO: a
 * Graph devolve a prévia renderizada num iframe com token próprio, que não
 * pede login.
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export interface AnuncioDeOrigemProps {
  /** `ad_id` da Meta. Sem ele não há o que mostrar. */
  adId: string | null | undefined;
  /** Conta de anúncios, do servidor. Sem ela o link do Gerenciador abriria na conta errada. */
  adAccountId?: string | null;
  /** Nome do anúncio, quando o CRM já o tem; a prévia traz o da Meta. */
  nome?: string | null;
  /** Texto do gatilho. O padrão serve para a maioria das superfícies. */
  rotulo?: string;
  className?: string;
}

interface Previa {
  adId: string;
  nome: string | null;
  contaId: string | null;
  status: string | null;
  thumbnailUrl: string | null;
  previaUrl: string | null;
}

const STATUS_LEGIVEL: Record<string, string> = {
  ACTIVE: "Veiculando", PAUSED: "Pausado", DELETED: "Excluído", ARCHIVED: "Arquivado",
  ADSET_PAUSED: "Conjunto pausado", CAMPAIGN_PAUSED: "Campanha pausada",
  DISAPPROVED: "Reprovado", PENDING_REVIEW: "Em análise", IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com pendência",
};

/** Gerenciador, só com a conta: sem ela abre na última que a pessoa usou. */
export function linkDoGerenciador(adId: string, contaId: string | null | undefined): string | null {
  const c = contaId?.trim();
  if (!c) return null;
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${c.startsWith("act_") ? c.slice(4) : c}&selected_ad_ids=${adId}`;
}

export function AnuncioDeOrigem({ adId, adAccountId, nome, rotulo = "Ver anúncio", className }: AnuncioDeOrigemProps) {
  const [aberta, setAberta] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const id = adId?.trim();

  useEffect(() => {
    if (!aberta || !id || previa || erro) return;
    let vivo = true;
    setCarregando(true);
    fetch(`/api/meta/criativo/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!vivo) return;
        // Motivo na tela, nunca espaço vazio: vazio parece bug do CRM, e o
        // problema costuma ser token ou permissão na conta de anúncios.
        if (!r.ok) setErro(typeof j.erro === "string" ? j.erro : `a Meta respondeu ${r.status}`);
        else setPrevia(j.previa as Previa);
      })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [aberta, id, previa, erro]);

  if (!id || !/^\d+$/.test(id)) return null;

  // A conta do ANÚNCIO (vinda da prévia) vence a do ambiente: a empresa pode
  // ter mais de uma conta, e o link tem que abrir na dona do criativo.
  const gerenciador = linkDoGerenciador(id, previa?.contaId ?? adAccountId);
  const titulo = previa?.nome ?? nome ?? "Anúncio";

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setAberta(true); }}
        className={className}
        style={className ? undefined : { fontSize: "12px", color: "var(--of-coral-acao)", textDecoration: "underline", background: "none", border: 0, padding: 0, cursor: "pointer" }}
      >
        {rotulo}
      </button>

      <Sheet open={aberta} onOpenChange={(v) => { if (!v) setAberta(false); }}>
        <SheetContent side="right" className="w-full sm:max-w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{titulo}</SheetTitle>
            <SheetDescription>
              {previa?.status ? (STATUS_LEGIVEL[previa.status] ?? previa.status) : "Anúncio de origem do lead"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 p-4">
            {carregando && <p className="text-[13px] opacity-70">Buscando o criativo na Meta…</p>}

            {erro && (
              <div className="text-[13px]" style={{ color: "var(--of-coral-acao)" }}>
                <p className="font-semibold">Não deu para carregar o criativo.</p>
                <p className="opacity-80">{erro}</p>
              </div>
            )}

            {previa?.previaUrl ? (
              /* A prévia da Meta vem dimensionada para feed de celular. */
              <iframe
                src={previa.previaUrl}
                title={`Prévia do anúncio ${titulo}`}
                width="100%"
                height={560}
                style={{ border: "1px solid var(--of-linha)", borderRadius: "var(--of-r-painel)" }}
              />
            ) : previa?.thumbnailUrl ? (
              /* Sem prévia renderizada (formato não suportado), a miniatura
                 ainda identifica o criativo. */
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previa.thumbnailUrl} alt={`Criativo do anúncio ${titulo}`}
                style={{ width: "100%", borderRadius: "var(--of-r-painel)", border: "1px solid var(--of-linha)" }} />
            ) : null}

            <dl className="text-[12px] flex flex-col gap-1">
              <div className="flex justify-between gap-3">
                <dt className="opacity-70">ID do anúncio</dt>
                <dd className="font-mono">{id}</dd>
              </div>
              {previa?.contaId && (
                <div className="flex justify-between gap-3">
                  <dt className="opacity-70">Conta de anúncios</dt>
                  <dd className="font-mono">{previa.contaId}</dd>
                </div>
              )}
            </dl>

            {gerenciador && (
              <a href={gerenciador} target="_blank" rel="noreferrer"
                className="text-[12px] font-semibold"
                style={{ color: "var(--of-coral-acao)" }}>
                Abrir no Gerenciador de Anúncios ↗
              </a>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
