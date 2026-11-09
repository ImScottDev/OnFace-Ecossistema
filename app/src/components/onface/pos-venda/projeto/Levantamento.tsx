"use client";

/**
 * Levantamento: os campos que alimentam o Cliente 360.
 *
 * Os dados moram no CLIENTE, não no projeto; aqui o time só edita. Por isso a
 * tela avisa onde o que se escreve vai parar. O botão de salvar só vive quando
 * há mudança, e o formulário recomeça do que o servidor devolveu (a `key`).
 */
import { useState } from "react";
import { Info, Plus, X } from "lucide-react";
import type { Levantamento as TLevantamento } from "@/lib/pos-venda/contrato";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcao, type AcoesDaTela } from "./acoes";

const NENHUM = "__nenhum__";

/**
 * O rótulo que o gestor digita vira uma chave estável.
 *
 * Estável porque é por ela que o valor se reencontra depois: se a chave
 * mudasse junto com o rótulo, renomear o campo apagaria o que já foi
 * respondido. Acentos saem, espaço vira sublinhado, e o sufixo numérico
 * resolve dois campos com o mesmo nome.
 */
function chaveDoRotulo(rotulo: string, jaUsadas: Set<string>): string {
  const base = rotulo
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 40) || "campo";
  if (!jaUsadas.has(base)) return base;
  for (let n = 2; n < 99; n++) if (!jaUsadas.has(`${base}_${n}`)) return `${base}_${n}`;
  return `${base}_${Date.now()}`;
}
const PERFIS: Array<{ valor: string; rotulo: string }> = [
  { valor: "individual", rotulo: "Individual" },
  { valor: "gestor", rotulo: "Gestor" },
  { valor: "gestor_com_equipe", rotulo: "Gestor com equipe" },
];

export function Levantamento({ levantamento, acoes, podeEditar }: { levantamento: TLevantamento; acoes: AcoesDaTela; podeEditar: boolean }) {
  return <Formulario key={JSON.stringify(levantamento)} inicial={levantamento} acoes={acoes} podeEditar={podeEditar} />;
}

function Formulario({ inicial, acoes, podeEditar }: { inicial: TLevantamento; acoes: AcoesDaTela; podeEditar: boolean }) {
  const [perfil, setPerfil] = useState<string | null>(inicial.perfilDeUso);
  const [crm, setCrm] = useState(inicial.crmQueUsa ?? "");
  const [objetivo, setObjetivo] = useState(inicial.objetivoComACallface ?? "");
  const [extras, setExtras] = useState(inicial.extras);
  const { pendente, rodar } = useAcao();

  const [novoCampo, setNovoCampo] = useState("");

  const sujo =
    perfil !== inicial.perfilDeUso ||
    crm.trim() !== (inicial.crmQueUsa ?? "") ||
    objetivo.trim() !== (inicial.objetivoComACallface ?? "") ||
    extras.length !== inicial.extras.length ||
    extras.some((e, i) => e.chave !== inicial.extras[i]?.chave || (e.valor ?? "") !== (inicial.extras[i]?.valor ?? ""));

  const adicionarCampo = () => {
    const rotulo = novoCampo.trim();
    if (!rotulo) return;
    const chave = chaveDoRotulo(rotulo, new Set(extras.map((e) => e.chave)));
    setExtras((l) => [...l, { chave, rotulo, valor: null }]);
    setNovoCampo("");
  };

  const salvar = () =>
    rodar(
      () => acoes.salvarLevantamento({ perfilDeUso: perfil, crmQueUsa: crm.trim() || null, objetivoComACallface: objetivo.trim() || null, extras }),
      "Levantamento salvo e enviado ao Cliente 360.",
    );

  return (
    <section className="pv-painel" aria-label="Levantamento">
      <div className="pv-aviso" data-pv-tom="neutro">
        <Info aria-hidden />
        <span>O que você escreve aqui fica no cadastro do cliente e aparece no Cliente 360. Preencha com o que o cliente disse, não com o que você supõe.</span>
      </div>

      <div className="pv-form">
        <div className="pv-campo">
          <label htmlFor="pv-perfil">Perfil de uso</label>
          <Select value={perfil ?? NENHUM} onValueChange={(v) => setPerfil(v === NENHUM ? null : v)} disabled={!podeEditar}>
            <SelectTrigger id="pv-perfil"><SelectValue placeholder="Não informado">{PERFIS.find((p) => p.valor === perfil)?.rotulo ?? "Não informado"}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>Não informado</SelectItem>
              {PERFIS.map((p) => <SelectItem key={p.valor} value={p.valor}>{p.rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="pv-campo">
          <label htmlFor="pv-crm">CRM que usa hoje</label>
          <input id="pv-crm" value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="Ex.: RD Station, Pipedrive, planilha" disabled={!podeEditar} maxLength={120} />
        </div>

        <div className="pv-campo" data-largo="true">
          <label htmlFor="pv-objetivo">Objetivo com a Callface</label>
          <textarea id="pv-objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="O que o cliente quer resolver com o produto" disabled={!podeEditar} maxLength={500} />
        </div>

        {extras.map((x, i) => (
          <div className="pv-campo" key={x.chave}>
            <label htmlFor={`pv-extra-${x.chave}`}>
              {x.rotulo}
              {podeEditar ? (
                <button
                  type="button"
                  className="pv-campo-remover"
                  onClick={() => setExtras((l) => l.filter((_, j) => j !== i))}
                  aria-label={`Remover o campo ${x.rotulo}`}
                  title="Remover este campo"
                >
                  <X aria-hidden />
                </button>
              ) : null}
            </label>
            <input
              id={`pv-extra-${x.chave}`}
              value={x.valor ?? ""}
              onChange={(e) => setExtras((l) => l.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)))}
              disabled={!podeEditar}
              maxLength={500}
            />
          </div>
        ))}

        {/* "O levantamento não dá pra colocar mais campos": agora dá. O campo
            novo nasce aqui e só existe de verdade depois de salvar — por isso
            o rodapé diz que há alteração pendente. */}
        {podeEditar ? (
          <div className="pv-campo pv-campo-novo" data-largo="true">
            <label htmlFor="pv-novo-campo">Acrescentar um campo</label>
            <div className="pv-campo-linha">
              <input
                id="pv-novo-campo"
                value={novoCampo}
                onChange={(e) => setNovoCampo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarCampo(); } }}
                placeholder="Ex.: Horário de pico do atendimento"
                maxLength={60}
              />
              <Button variant="outline" disabled={!novoCampo.trim()} onClick={adicionarCampo}>
                <Plus aria-hidden /> Acrescentar
              </Button>
            </div>
            <p className="pv-secao-nota">O campo vale para este cliente e aparece no Cliente 360 depois de salvar.</p>
          </div>
        ) : null}

        {podeEditar ? (
          <div className="pv-form-pe">
            <Button loading={pendente} disabled={!sujo} onClick={salvar}>Salvar levantamento</Button>
            {sujo ? <span className="pv-secao-nota">Há alterações não salvas.</span> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
