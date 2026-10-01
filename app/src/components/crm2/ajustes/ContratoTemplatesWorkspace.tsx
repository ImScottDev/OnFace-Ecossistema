"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Eye, Bold, Italic, Underline, List, ListOrdered, Heading2, Pilcrow, AlignLeft, AlignCenter, AlignJustify, Undo2, Redo2, RemoveFormatting, Braces, Code2 } from "lucide-react";
import { toast } from "sonner";
import { VARIAVEIS_CONTRATO, VARIAVEIS_EXEMPLO, corpoEhHtml, renderizarCorpo } from "@/lib/crm/contrato-variaveis";

interface Template {
  id: string;
  nome: string;
  versao: number;
  commercialModel: string | null;
  serviceFamily: string | null;
  tipoDocumento: string | null;
  corpoTemplate: string;
  ativo: boolean;
}

const MODELOS = [
  { value: "", label: "Genérico (qualquer modelo)" },
  { value: "PAGAMENTO_DIRETO", label: "Pagamento direto" },
  { value: "CONTRATO_OBRIGATORIO", label: "Contrato obrigatório" },
  { value: "CONTRATO_FIDELIDADE_OPCIONAL", label: "Contrato com fidelidade opcional" },
];

const FAMILIAS = [
  { value: "", label: "Genérico (qualquer família)" },
  { value: "CALLFACE_AI", label: "Callface AI" },
  { value: "PABX", label: "PABX" },
  { value: "WHITE_LABEL", label: "White Label" },
];

const TIPOS = [
  { value: "CONTRATO", label: "Contrato" },
  { value: "ADITIVO", label: "Aditivo" },
  { value: "RENOVACAO", label: "Renovação" },
];

// O preview usa o MESMO catálogo que a geração real resolve
// (lib/crm/contrato-variaveis.ts). Antes era uma lista própria de 8 chaves:
// variável existente e correta, como {{empresa_endereco}}, aparecia crua aqui
// e passava a impressão de que não existia.
const GRUPOS = [...new Set(VARIAVEIS_CONTRATO.map((v) => v.grupo))];

/**
 * Ajustes → Contratos (19/08, P0.2) — gestão real dos Contract Templates.
 * O schema/motor de render já existia (lib/crm/contrato-template.ts), só
 * não tinha CRUD nem UI — só nascia por seed/SQL direto. Não inventa
 * cláusula jurídica: o corpo é o que o time escrever, preview usa dado
 * fictício claramente rotulado como exemplo.
 */
export function Cf2ContratoTemplatesWorkspace() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Template | null>(null);
  const [criando, setCriando] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);

  const { data } = useQuery<{ templates: Template[] }>({
    queryKey: ["cf2-contrato-templates"],
    queryFn: async () => {
      const r = await fetch("/api/contrato-templates");
      if (!r.ok) return { templates: [] };
      return r.json();
    },
  });
  const templates = data?.templates ?? [];

  const salvar = useMutation({
    mutationFn: async (t: { id?: string; nome: string; commercialModel: string | null; serviceFamily: string | null; tipoDocumento: string; corpoTemplate: string }) => {
      const url = t.id ? `/api/contrato-templates/${t.id}` : "/api/contrato-templates";
      const r = await fetch(url, { method: t.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: t.nome, commercialModel: t.commercialModel, serviceFamily: t.serviceFamily, tipoDocumento: t.tipoDocumento, corpoTemplate: t.corpoTemplate }) });
      if (!r.ok) throw new Error("falha");
      return r.json();
    },
    onSuccess: (salvo: { variaveisDesconhecidas?: string[] }) => {
      qc.invalidateQueries({ queryKey: ["cf2-contrato-templates"] });
      setEditando(null);
      setCriando(false);
      // Marcador do Zoho sem equivalente continua no texto: avisar aqui é o
      // que evita descobrir isso no PDF já enviado para assinatura.
      const sobraram = salvo?.variaveisDesconhecidas ?? [];
      if (sobraram.length > 0) {
        toast.warning(`Template salvo. ${sobraram.length} variável(is) do Zoho sem equivalente continuam no texto: ${sobraram.join(", ")}`, { duration: 12000 });
      } else {
        toast.success("Template salvo");
      }
    },
    onError: () => toast.error("Não foi possível salvar o template"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/contrato-templates/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("falha");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cf2-contrato-templates"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      {!criando && !editando && (
        <button onClick={() => setCriando(true)} className="w-fit flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
          <Plus className="w-3.5 h-3.5" /> Novo template
        </button>
      )}

      {(criando || editando) && (
        <TemplateForm inicial={editando} onSalvar={(t) => salvar.mutate({ id: editando?.id, ...t })} onCancelar={() => { setCriando(false); setEditando(null); }} salvando={salvar.isPending} />
      )}

      <div className="flex flex-col gap-2">
        {templates.length === 0 && !criando && (
          <p className="text-[13px] text-center py-6" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum template cadastrado ainda.</p>
        )}
        {templates.map((t) => (
          <div key={t.id} className="p-4 rounded-2xl flex items-center justify-between" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-bold" style={{ color: "var(--cf2-text-primary)" }}>{t.nome}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-tertiary)" }}>v{t.versao}</span>
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>{TIPOS.find((tp) => tp.value === (t.tipoDocumento || "CONTRATO"))?.label} · {FAMILIAS.find((f) => f.value === (t.serviceFamily || ""))?.label} · {MODELOS.find((m) => m.value === (t.commercialModel || ""))?.label}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setPreview(t)} aria-label={`Pré-visualizar ${t.nome}`} title="Pré-visualizar" className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1" style={{ background: "var(--cf2-bg-surface-muted)", outlineColor: "var(--cf2-accent)" }}><Eye className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} /></button>
              <button type="button" onClick={() => setEditando(t)} aria-label={`Editar ${t.nome}`} title="Editar" className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1" style={{ background: "var(--cf2-bg-surface-muted)", outlineColor: "var(--cf2-accent)" }}><Pencil className="w-3.5 h-3.5" style={{ color: "var(--cf2-text-secondary)" }} /></button>
              <button type="button" onClick={() => remover.mutate(t.id)} aria-label={`Excluir ${t.nome}`} title="Excluir" className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1" style={{ background: "var(--cf2-bg-surface-muted)", outlineColor: "var(--cf2-accent)" }}><Trash2 className="w-3.5 h-3.5" style={{ color: "var(--cf2-danger-text)" }} /></button>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setPreview(null)}>
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6" style={{ background: "var(--cf2-bg-surface)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-bold mb-3 px-2 py-1 rounded w-fit" style={{ background: "var(--cf2-warning-bg)", color: "var(--cf2-warning-text)" }}>PREVIEW — dados fictícios de exemplo</p>
            {corpoEhHtml(preview.corpoTemplate) ? (
              // Já saneado na gravação (api-server/routes/contrato-templates.ts).
              <div className="cf2-contrato-preview text-[13px]" style={{ color: "var(--cf2-text-primary)" }}
                dangerouslySetInnerHTML={{ __html: renderizarCorpo(preview.corpoTemplate, VARIAVEIS_EXEMPLO) }} />
            ) : (
              <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--cf2-text-primary)" }}>{renderizarCorpo(preview.corpoTemplate, VARIAVEIS_EXEMPLO)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Editor do corpo do contrato.
 *
 * `contenteditable` com uma barra de ferramentas pequena, em vez de uma
 * biblioteca de editor: o documento já é HTML, o que falta é escrever sem ver
 * tag. O `#` abre a lista de variáveis — o mesmo gesto que o time já usava no
 * editor do Zoho.
 *
 * O conteúdo não volta do estado para o DOM a cada tecla: um contenteditable
 * controlado reposiciona o cursor no fim a cada caractere. O DOM é a fonte
 * enquanto se edita; o estado recebe o resultado.
 */
function EditorRico({ valorInicial, aoMudar }: { valorInicial: string; aoMudar: (html: string) => void }) {
  const area = useRef<HTMLDivElement>(null);
  const [variaveisAbertas, setVariaveisAbertas] = useState(false);
  const [busca, setBusca] = useState("");
  const [apagarCerquilha, setApagarCerquilha] = useState(false);

  useEffect(() => {
    if (area.current && area.current.innerHTML !== valorInicial) area.current.innerHTML = valorInicial;
    // Só na montagem e ao trocar de template: depois disso, quem manda é o DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sincronizar = () => aoMudar(area.current?.innerHTML ?? "");
  const comando = (nome: string, arg?: string) => {
    area.current?.focus();
    document.execCommand(nome, false, arg);
    sincronizar();
  };

  const inserirVariavel = (chave: string) => {
    area.current?.focus();
    // Quando o painel abriu pelo "#", o caractere digitado sai junto.
    if (apagarCerquilha) document.execCommand("delete");
    document.execCommand("insertText", false, `{{${chave}}}`);
    setVariaveisAbertas(false);
    setApagarCerquilha(false);
    setBusca("");
    sincronizar();
  };

  const encontradas = VARIAVEIS_CONTRATO.filter((v) =>
    !busca.trim() || `${v.chave} ${v.rotulo}`.toLowerCase().includes(busca.trim().toLowerCase()));

  const botao = (titulo: string, Icone: typeof Bold, acao: () => void) => (
    <button type="button" title={titulo} aria-label={titulo} onClick={acao}
      className="flex items-center justify-center w-7 h-7 rounded transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1"
      style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)", outlineColor: "var(--cf2-accent)" }}>
      <Icone className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-lg"
        style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
        {botao("Negrito", Bold, () => comando("bold"))}
        {botao("Itálico", Italic, () => comando("italic"))}
        {botao("Sublinhado", Underline, () => comando("underline"))}
        <span className="w-px h-5 mx-1" style={{ background: "var(--cf2-border-default)" }} />
        {botao("Título de seção", Heading2, () => comando("formatBlock", "h2"))}
        {botao("Parágrafo", Pilcrow, () => comando("formatBlock", "p"))}
        {botao("Lista com marcadores", List, () => comando("insertUnorderedList"))}
        {botao("Lista numerada", ListOrdered, () => comando("insertOrderedList"))}
        <span className="w-px h-5 mx-1" style={{ background: "var(--cf2-border-default)" }} />
        {botao("Alinhar à esquerda", AlignLeft, () => comando("justifyLeft"))}
        {botao("Centralizar", AlignCenter, () => comando("justifyCenter"))}
        {botao("Justificar", AlignJustify, () => comando("justifyFull"))}
        <span className="w-px h-5 mx-1" style={{ background: "var(--cf2-border-default)" }} />
        {botao("Limpar formatação", RemoveFormatting, () => comando("removeFormat"))}
        {botao("Desfazer", Undo2, () => comando("undo"))}
        {botao("Refazer", Redo2, () => comando("redo"))}
        <span className="w-px h-5 mx-1" style={{ background: "var(--cf2-border-default)" }} />
        <button type="button" onClick={() => { setApagarCerquilha(false); setVariaveisAbertas((v) => !v); }}
          className="flex items-center gap-1 px-2 h-7 rounded text-[11px] font-semibold"
          style={{ background: "var(--cf2-bg-surface)", color: "var(--cf2-text-secondary)" }}>
          <Braces className="w-3.5 h-3.5" /> Variável
          <span style={{ color: "var(--cf2-text-tertiary)" }}>#</span>
        </button>
      </div>

      {variaveisAbertas && (
        <div className="rounded-lg p-2 max-h-56 overflow-y-auto"
          style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar variável (ex.: razão social, CNPJ, mensalidade)" aria-label="Buscar variável"
            className="w-full px-2 py-1.5 mb-2 rounded text-[12px] outline-none"
            style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }} />
          {encontradas.length === 0 && (
            <p className="text-[11px] px-1 py-2" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma variável com esse nome.</p>
          )}
          {encontradas.map((v) => (
            <button key={v.chave} type="button" onClick={() => inserirVariavel(v.chave)}
              className="w-full text-left px-2 py-1.5 rounded text-[11px] hover:brightness-95"
              style={{ color: "var(--cf2-text-secondary)" }}>
              <span className="font-mono">{`{{${v.chave}}}`}</span>
              <span className="ml-2" style={{ color: "var(--cf2-text-tertiary)" }}>{v.rotulo}</span>
            </button>
          ))}
        </div>
      )}

      <div
        ref={area}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Corpo do contrato"
        onInput={sincronizar}
        onBlur={sincronizar}
        onKeyDown={(e) => {
          if (e.key === "#") {
            // Deixa o caractere entrar — ele marca o ponto de inserção e some
            // quando a variável é escolhida.
            setApagarCerquilha(true);
            setBusca("");
            setVariaveisAbertas(true);
          } else if (e.key === "Escape" && variaveisAbertas) {
            setVariaveisAbertas(false);
            setApagarCerquilha(false);
          }
        }}
        className="cf2-contrato-preview px-4 py-3 rounded-lg text-[13px] outline-none overflow-y-auto"
        style={{
          background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)",
          color: "var(--cf2-text-primary)", minHeight: "26rem", maxHeight: "60vh",
        }}
      />
    </div>
  );
}

function TemplateForm({ inicial, onSalvar, onCancelar, salvando }: { inicial: Template | null; onSalvar: (t: { nome: string; commercialModel: string | null; serviceFamily: string | null; tipoDocumento: string; corpoTemplate: string }) => void; onCancelar: () => void; salvando: boolean }) {
  const [nome, setNome] = useState(inicial?.nome || "");
  const [commercialModel, setCommercialModel] = useState(inicial?.commercialModel || "");
  const [serviceFamily, setServiceFamily] = useState(inicial?.serviceFamily || "");
  const [tipoDocumento, setTipoDocumento] = useState(inicial?.tipoDocumento || "CONTRATO");
  const [corpoTemplate, setCorpoTemplate] = useState(inicial?.corpoTemplate || "");
  const [verHtml, setVerHtml] = useState(false);
  const corpoRef = useRef<HTMLTextAreaElement>(null);
  const campoSelect = { background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" };

  // Escrever contrato é copiar a variável certa dezenas de vezes. Inserir no
  // ponto do cursor evita o vaivém entre a lista e o texto.
  const inserir = (chave: string) => {
    const campo = corpoRef.current;
    const marca = `{{${chave}}}`;
    if (!campo) return setCorpoTemplate((c) => c + marca);
    const { selectionStart: ini, selectionEnd: fim } = campo;
    setCorpoTemplate((c) => c.slice(0, ini) + marca + c.slice(fim));
    requestAnimationFrame(() => {
      campo.focus();
      campo.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  };

  return (
    <div className="p-4 rounded-2xl flex flex-col gap-2" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do template" aria-label="Nome do template" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={campoSelect} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} aria-label="Tipo de documento" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={campoSelect}>
          {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={serviceFamily} onChange={(e) => setServiceFamily(e.target.value)} aria-label="Família de serviço" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={campoSelect}>
          {FAMILIAS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={commercialModel} onChange={(e) => setCommercialModel(e.target.value)} aria-label="Modelo comercial" className="px-3 py-2 rounded-lg text-[13px] outline-none" style={campoSelect}>
          {MODELOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-end">
        <button type="button" onClick={() => setVerHtml((v) => !v)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold"
          style={{ color: "var(--cf2-text-secondary)" }}>
          <Code2 className="w-3.5 h-3.5" /> {verHtml ? "Editor visual" : "Ver HTML"}
        </button>
      </div>
      {verHtml ? (
        <textarea
          ref={corpoRef}
          value={corpoTemplate}
          onChange={(e) => setCorpoTemplate(e.target.value)}
          placeholder="Corpo do contrato em HTML. Use as variáveis da lista abaixo."
          rows={18}
          aria-label="Corpo do contrato em HTML"
          className="px-3 py-2 rounded-lg text-[12px] outline-none resize-y font-mono"
          style={campoSelect}
        />
      ) : (
        <EditorRico key={inicial?.id ?? "novo"} valorInicial={corpoTemplate} aoMudar={setCorpoTemplate} />
      )}
      <p className="text-[11px]" style={{ color: "var(--cf2-text-tertiary)" }}>
        {corpoEhHtml(corpoTemplate)
          ? "HTML detectado: tabelas e formatação são preservadas no PDF enviado para assinatura."
          : "Texto puro: cada linha vira um parágrafo no PDF. Cole o HTML do contrato para manter quadros e tabelas."}
      </p>

      {verHtml && (
      <details className="rounded-lg p-3" style={{ background: "var(--cf2-bg-surface-muted)" }}>
        <summary className="text-[12px] font-semibold cursor-pointer" style={{ color: "var(--cf2-text-secondary)" }}>
          Variáveis disponíveis ({VARIAVEIS_CONTRATO.length}) — clique para inserir
        </summary>
        <div className="flex flex-col gap-3 mt-3">
          {GRUPOS.map((grupo) => (
            <div key={grupo}>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--cf2-text-tertiary)" }}>{grupo}</p>
              <div className="flex flex-wrap gap-1">
                {VARIAVEIS_CONTRATO.filter((v) => v.grupo === grupo).map((v) => (
                  <button key={v.chave} type="button" onClick={() => inserir(v.chave)} title={`${v.rotulo} — exemplo: ${v.exemplo}`}
                    className="px-2 py-1 rounded text-[11px] font-mono focus-visible:outline-2 focus-visible:outline-offset-1"
                    style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-secondary)", outlineColor: "var(--cf2-accent)" }}>
                    {`{{${v.chave}}}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ color: "var(--cf2-text-secondary)" }}>Cancelar</button>
        <button
          onClick={() => nome.trim() && corpoTemplate.trim() && onSalvar({ nome: nome.trim(), commercialModel: commercialModel || null, serviceFamily: serviceFamily || null, tipoDocumento, corpoTemplate: corpoTemplate.trim() })}
          disabled={salvando || !nome.trim() || !corpoTemplate.trim()}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
          style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
