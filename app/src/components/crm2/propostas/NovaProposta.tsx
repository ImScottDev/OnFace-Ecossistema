"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, Minus, Trash2, ArrowLeft, Send, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Cf2Card } from "../ui/Card";

interface Lead { id: string; nome: string; empresa: string | null; telefone: string; status: string }
interface CatalogoItem {
  id: string; nome: string; descricao: string | null; tipo: string; unidade: string;
  valorSugerido: string | null; categoria: string | null; requerContrato: boolean;
}
interface ItemCarrinho {
  servicoCatalogoId: string; nome: string; tipo: string; quantidade: number; valorUnitario: number;
}

const CATEGORIA_LABEL: Record<string, string> = { callface_ai: "Callface AI", pabx: "PABX", white_label: "White Label" };

function calcSubtotal(qty: number, unit: number) {
  return Math.round(qty * unit * 100) / 100;
}
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Cf2NovaPropostaWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const negocioIdPreSelecionado = searchParams.get("negocioId");
  const leadIdPreSelecionado = searchParams.get("leadId");
  const propostaIdEditando = searchParams.get("propostaId");

  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [negocioTitulo, setNegocioTitulo] = useState<string | null>(null);
  const [buscaLead, setBuscaLead] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [condicoesPagamento, setCondicoesPagamento] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [herdouServicos, setHerdouServicos] = useState(false);
  const [carregouEdicao, setCarregouEdicao] = useState(false);

  // Modo edição (spec 18/08: "Editar" no drawer) — PATCH em vez de POST,
  // não permite trocar lead/negócio (edição só ajusta itens/condições da
  // MESMA proposta), gate real já no backend (só rascunho/enviada editável).
  const { data: propostaEditando, isLoading: carregandoProposta } = useQuery({
    queryKey: ["proposta-para-editar", propostaIdEditando],
    queryFn: async () => {
      const r = await fetch(`/api/propostas/${propostaIdEditando}`);
      if (!r.ok) throw new Error("Proposta não encontrada");
      return r.json();
    },
    enabled: !!propostaIdEditando && !carregouEdicao,
  });

  // Negócio → Criar proposta: herda lead/empresa/responsável direto, sem
  // repedir o que o CRM já sabe (pedido explícito do Kauã).
  const { data: negocioContexto, isLoading: carregandoNegocio } = useQuery({
    queryKey: ["negocio-para-proposta", negocioIdPreSelecionado],
    queryFn: async () => {
      const r = await fetch(`/api/negocios/${negocioIdPreSelecionado}`);
      if (!r.ok) throw new Error("Negócio não encontrado");
      return r.json();
    },
    enabled: !!negocioIdPreSelecionado && !leadSelecionado,
  });

  const { data: leadContexto, isLoading: carregandoLead } = useQuery({
    queryKey: ["lead-para-proposta", leadIdPreSelecionado],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadIdPreSelecionado}`);
      if (!r.ok) throw new Error("Lead não encontrado");
      return r.json();
    },
    enabled: !!leadIdPreSelecionado && !negocioIdPreSelecionado && !leadSelecionado,
  });

  useEffect(() => {
    if (negocioContexto?.lead && !leadSelecionado) {
      setLeadSelecionado(negocioContexto.lead);
      setNegocioId(negocioContexto.negocio?.id ?? null);
      setNegocioTitulo(negocioContexto.negocio?.titulo ?? null);
    }
  }, [negocioContexto, leadSelecionado]);

  useEffect(() => {
    if (leadContexto?.lead && !leadSelecionado) setLeadSelecionado(leadContexto.lead);
  }, [leadContexto, leadSelecionado]);

  useEffect(() => {
    if (!propostaEditando || carregouEdicao) return;
    setLeadSelecionado({
      id: propostaEditando.leadId, nome: propostaEditando.leadNome || "", empresa: propostaEditando.leadEmpresa,
      telefone: propostaEditando.leadTelefone || "", status: "",
    });
    setNegocioId(propostaEditando.negocioId ?? null);
    setNegocioTitulo(propostaEditando.negocioTitulo ?? null);
    setCarrinho((propostaEditando.itens || []).map((i: { servicoCatalogoId: string | null; nome: string; tipo: string; quantidade: string; valorUnitario: string }) => ({
      servicoCatalogoId: i.servicoCatalogoId || i.nome, nome: i.nome, tipo: i.tipo, quantidade: parseFloat(i.quantidade), valorUnitario: parseFloat(i.valorUnitario),
    })));
    setCondicoesPagamento(propostaEditando.condicoesPagamento || "");
    setDataValidade(propostaEditando.dataValidade || "");
    setObservacoes(propostaEditando.observacoes || "");
    setHerdouServicos(true);
    setCarregouEdicao(true);
  }, [propostaEditando, carregouEdicao]);

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["leads-for-proposta", buscaLead],
    queryFn: async () => {
      const r = await fetch(`/api/leads?limit=20${buscaLead ? `&search=${encodeURIComponent(buscaLead)}` : ""}`);
      const data = await r.json();
      return data.leads || data;
    },
    enabled: !leadSelecionado,
  });

  // Validação real (referência de UX, 19/08): o backend já rejeita
  // `POST /propostas/:id/enviar` sem e-mail no lead (ver
  // lib/crm/enviar-proposta.ts) — só nunca foi surfaced ANTES do clique,
  // então o vendedor só descobria depois de tentar enviar. `leads` da busca
  // não traz e-mail (lista enxuta); busca o detalhe completo só quando um
  // lead é selecionado.
  const { data: leadDetalhe } = useQuery<{ email: string | null }>({
    queryKey: ["lead-email-para-proposta", leadSelecionado?.id],
    queryFn: async () => {
      const r = await fetch(`/api/leads/${leadSelecionado!.id}`);
      if (!r.ok) return { email: null };
      return r.json();
    },
    enabled: !!leadSelecionado?.id,
  });
  const semEmail = !!leadSelecionado && leadDetalhe !== undefined && !leadDetalhe?.email;

  const { data: catalogo = [] } = useQuery<CatalogoItem[]>({
    queryKey: ["servicos-catalogo"],
    queryFn: async () => {
      const r = await fetch("/api/servicos-catalogo");
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!leadSelecionado,
  });

  // Itens já definidos no negócio (servicosInteresse é texto livre, sem
  // vínculo com o catálogo real) — melhor esforço: casa por nome, o que não
  // bate fica de fora (não inventa item que não existe no catálogo real).
  useEffect(() => {
    if (herdouServicos || catalogo.length === 0) return;
    const nomes: string[] = negocioContexto?.negocio?.servicosInteresse ?? [];
    if (nomes.length === 0) { setHerdouServicos(true); return; }
    const encontrados = nomes
      .map((nome) => catalogo.find((c) => c.nome.toLowerCase() === nome.toLowerCase()))
      .filter((c): c is CatalogoItem => !!c);
    if (encontrados.length > 0) {
      setCarrinho(encontrados.map((item) => ({
        servicoCatalogoId: item.id, nome: item.nome, tipo: item.tipo, quantidade: 1,
        valorUnitario: parseFloat(item.valorSugerido || "0"),
      })));
    }
    setHerdouServicos(true);
  }, [catalogo, negocioContexto, herdouServicos]);

  const categorias = useMemo(() => {
    const set = new Set(catalogo.map((c) => c.categoria || "outros"));
    return Array.from(set);
  }, [catalogo]);

  const categoriaSelecionada = categoriaAtiva ?? categorias[0] ?? null;
  const buscaProdutoNorm = buscaProduto.trim().toLowerCase();
  const itensDaCategoria = catalogo
    .filter((c) => (c.categoria || "outros") === categoriaSelecionada)
    .filter((c) => !buscaProdutoNorm || c.nome.toLowerCase().includes(buscaProdutoNorm) || (c.descricao || "").toLowerCase().includes(buscaProdutoNorm));

  const totalRecorrente = carrinho.filter((i) => i.tipo === "recorrente").reduce((s, i) => s + calcSubtotal(i.quantidade, i.valorUnitario), 0);
  const totalAvulso = carrinho.filter((i) => i.tipo !== "recorrente").reduce((s, i) => s + calcSubtotal(i.quantidade, i.valorUnitario), 0);
  const totalGeral = totalRecorrente + totalAvulso;

  // Commercial Core v3 (ADR-EXEC-022): preview client-side de quantas
  // oportunidades essa composição vai virar — categoria do catálogo mapeia
  // 1:1 pra service_family (a separação real/autoritativa acontece no
  // backend; isso é só pro vendedor ver ANTES de submeter).
  const linhasNoCarrinho = useMemo(() => {
    const grupos = new Map<string, { total: number; qtd: number }>();
    for (const item of carrinho) {
      const cat = catalogo.find((c) => c.id === item.servicoCatalogoId)?.categoria || "outros";
      const label = CATEGORIA_LABEL[cat] || cat;
      const atual = grupos.get(label) || { total: 0, qtd: 0 };
      atual.total += calcSubtotal(item.quantidade, item.valorUnitario);
      atual.qtd += 1;
      grupos.set(label, atual);
    }
    return grupos;
  }, [carrinho, catalogo]);

  function adicionarItem(item: CatalogoItem) {
    if (carrinho.some((i) => i.servicoCatalogoId === item.id)) return;
    setCarrinho((prev) => [...prev, {
      servicoCatalogoId: item.id, nome: item.nome, tipo: item.tipo, quantidade: 1,
      valorUnitario: parseFloat(item.valorSugerido || "0"),
    }]);
  }
  function removerItem(id: string) { setCarrinho((prev) => prev.filter((i) => i.servicoCatalogoId !== id)); }
  function atualizarQtd(id: string, delta: number) {
    setCarrinho((prev) => prev.map((i) => i.servicoCatalogoId === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i));
  }
  function atualizarValor(id: string, valor: number) {
    setCarrinho((prev) => prev.map((i) => i.servicoCatalogoId === id ? { ...i, valorUnitario: valor } : i));
  }

  const salvarMutation = useMutation({
    mutationFn: async (enviar: boolean) => {
      // Modo edição (propostaId na URL) — PATCH na MESMA proposta, sem
      // reabrir a separação multi-linha (já decidida na criação; o backend
      // rejeita edição que introduza uma 2ª família, ver ADR-EXEC-022).
      if (propostaIdEditando) {
        const r = await fetch(`/api/propostas/${propostaIdEditando}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            condicoesPagamento: condicoesPagamento || undefined,
            dataValidade: dataValidade || undefined,
            observacoes: observacoes || undefined,
            itens: carrinho.map((i) => ({ servicoCatalogoId: i.servicoCatalogoId, nome: i.nome, tipo: i.tipo, quantidade: i.quantidade, valorUnitario: i.valorUnitario })),
          }),
        });
        const resultado = await r.json();
        if (!r.ok) throw new Error(resultado.error || "Erro ao editar proposta");
        if (enviar) {
          const r2 = await fetch(`/api/propostas/${propostaIdEditando}/enviar`, { method: "POST" });
          const body2 = await r2.json();
          if (!r2.ok) throw new Error(body2.error || "Proposta editada, mas falhou ao (re)enviar");
        }
        return { id: propostaIdEditando } as { id: string };
      }

      const r = await fetch("/api/propostas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: leadSelecionado!.id,
          negocioId: negocioId || undefined,
          condicoesPagamento: condicoesPagamento || undefined,
          dataValidade: dataValidade || undefined,
          observacoes: observacoes || undefined,
          itens: carrinho.map((i) => ({ servicoCatalogoId: i.servicoCatalogoId, nome: i.nome, tipo: i.tipo, quantidade: i.quantidade, valorUnitario: i.valorUnitario })),
        }),
      });
      const resultado = await r.json();
      if (!r.ok) throw new Error(resultado.error || "Erro ao criar proposta");

      // Commercial Core v3 (ADR-EXEC-022): composição multi-linha vira N
      // oportunidades relacionadas, cada uma com sua proposta.
      if (resultado.multiLinha) {
        if (enviar) {
          for (const op of resultado.oportunidades as { propostaId: string }[]) {
            const r2 = await fetch(`/api/propostas/${op.propostaId}/enviar`, { method: "POST" });
            const body2 = await r2.json();
            if (!r2.ok) throw new Error(body2.error || "Propostas criadas, mas falhou ao enviar uma delas");
          }
        }
        return resultado as { multiLinha: true; oportunidades: { negocioId: string }[] };
      }

      if (enviar) {
        const r2 = await fetch(`/api/propostas/${resultado.id}/enviar`, { method: "POST" });
        const body2 = await r2.json();
        if (!r2.ok) throw new Error(body2.error || "Proposta criada, mas falhou ao enviar");
      }
      return resultado as { id: string };
    },
    onSuccess: (resultado) => {
      if ("multiLinha" in resultado && resultado.multiLinha) {
        router.push(`/negocios/${resultado.oportunidades[0].negocioId}`);
      } else {
        router.push("/propostas");
      }
    },
  });

  if ((negocioIdPreSelecionado && carregandoNegocio) || (leadIdPreSelecionado && carregandoLead) || (propostaIdEditando && carregandoProposta && !carregouEdicao)) {
    return <div className="page-scroll"><p className="text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando proposta...</p></div>;
  }

  if (!leadSelecionado) {
    return (
      <div className="page-scroll space-y-4 max-w-lg">
        <div className="flex items-center gap-3">
          <Link href="/propostas" className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-xl font-bold" style={{ color: "var(--cf2-text-primary)" }}>Nova Proposta</h1>
        </div>
        <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>Selecione o cliente pra montar a proposta:</p>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-text-tertiary)" }} />
          <input
            value={buscaLead} onChange={(e) => setBuscaLead(e.target.value)} placeholder="Buscar cliente..." autoFocus
            className="w-full text-sm pl-8 pr-3 py-2.5 rounded-lg outline-none"
            style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          {leads?.map((lead) => (
            <button key={lead.id} onClick={() => setLeadSelecionado(lead)} className="text-left p-3 rounded-xl flex items-center justify-between" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{lead.nome}</p>
                <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{[lead.empresa, lead.telefone].filter(Boolean).join(" · ")}</p>
              </div>
            </button>
          ))}
          {leads?.length === 0 && <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum cliente encontrado.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page-scroll space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {negocioIdPreSelecionado || leadIdPreSelecionado || propostaIdEditando ? (
            <Link href="/propostas" className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}><ArrowLeft className="w-4 h-4" /></Link>
          ) : (
            <button onClick={() => setLeadSelecionado(null)} className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}><ArrowLeft className="w-4 h-4" /></button>
          )}
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--cf2-text-primary)" }}>{propostaIdEditando ? "Editar Proposta" : "Nova Proposta"}</h1>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
              {leadSelecionado.empresa || leadSelecionado.nome}{negocioTitulo ? ` · ${negocioTitulo}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => salvarMutation.mutate(false)} disabled={carrinho.length === 0 || salvarMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40"
            style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-primary)" }}
          >
            <Save className="w-3.5 h-3.5" /> {propostaIdEditando ? "Salvar alterações" : "Salvar rascunho"}
          </button>
          <button
            onClick={() => salvarMutation.mutate(true)} disabled={carrinho.length === 0 || salvarMutation.isPending || semEmail}
            title={semEmail ? "O lead não tem e-mail cadastrado — preencha antes de enviar" : undefined}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40"
            style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}
          >
            <Send className="w-3.5 h-3.5" />
            {salvarMutation.isPending
              ? "Enviando..."
              : propostaIdEditando
              ? "Salvar e reenviar"
              : linhasNoCarrinho.size > 1
              ? `Gerar ${linhasNoCarrinho.size} propostas →`
              : "Gerar proposta →"}
          </button>
        </div>
      </div>
      {salvarMutation.isError && <p className="text-[12px]" style={{ color: "var(--cf2-danger-text)" }}>{(salvarMutation.error as Error).message}</p>}

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Painel 1 — Famílias comerciais: a família determina o configurador ao lado, não existe formulário universal */}
        <div className="flex lg:flex-col gap-1.5 lg:w-44 shrink-0 overflow-x-auto">
          <p className="hidden lg:block text-[10px] font-bold uppercase px-1 mb-1" style={{ color: "var(--cf2-text-tertiary)" }}>Famílias comerciais</p>
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              className="text-left px-3 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap"
              style={{
                background: categoriaSelecionada === cat ? "var(--cf2-accent)" : "transparent",
                color: categoriaSelecionada === cat ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)",
              }}
            >
              {CATEGORIA_LABEL[cat] || cat}
            </button>
          ))}
        </div>

        {/* Painel 2 — Configurador: monta a solução da família selecionada. Troca de família = configurador diferente, não existe formulário universal */}
        <div className="flex-1 flex flex-col gap-2.5">
          <p className="text-[10px] font-bold uppercase px-1" style={{ color: "var(--cf2-text-tertiary)" }}>Configurador — {CATEGORIA_LABEL[categoriaSelecionada || ""] || categoriaSelecionada}</p>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} placeholder="Buscar produto ou funcionalidade..."
              className="w-full text-[13px] pl-8 pr-3 py-2 rounded-lg outline-none"
              style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start">
          {itensDaCategoria.map((item) => {
            const jaAdicionado = carrinho.some((i) => i.servicoCatalogoId === item.id);
            return (
              <button
                key={item.id}
                onClick={() => adicionarItem(item)}
                disabled={jaAdicionado}
                className="text-left p-3 rounded-xl flex items-start justify-between gap-2 disabled:opacity-50"
                style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{item.nome}</p>
                  <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
                    {brl(parseFloat(item.valorSugerido || "0"))}{item.tipo === "recorrente" ? "/mês" : ""}
                    {item.requerContrato && " · exige contrato"}
                  </p>
                </div>
                <Plus className="w-4 h-4 shrink-0" style={{ color: jaAdicionado ? "var(--cf2-text-tertiary)" : "var(--cf2-accent-border)" }} />
              </button>
            );
          })}
          {itensDaCategoria.length === 0 && (
            <p className="text-[13px] col-span-2" style={{ color: "var(--cf2-text-tertiary)" }}>
              {buscaProdutoNorm ? "Nenhum produto encontrado pra essa busca." : "Nenhum produto ativo nessa categoria."}
            </p>
          )}
          </div>
        </div>

        {/* Painel 3 — Resumo comercial: vivo enquanto monta, conduz o próximo passo */}
        <div className="lg:w-80 shrink-0">
          <Cf2Card>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--cf2-text-tertiary)" }}>Resumo comercial</p>
            {linhasNoCarrinho.size > 1 && (
              <div className="mb-3 p-2.5 rounded-lg text-[12px]" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
                <p className="font-bold mb-1">Esta venda será organizada em {linhasNoCarrinho.size} oportunidades:</p>
                <ul className="space-y-0.5">
                  {[...linhasNoCarrinho.entries()].map(([label, info]) => (
                    <li key={label}>{label} · {info.qtd} {info.qtd === 1 ? "item" : "itens"} · {brl(info.total)}</li>
                  ))}
                </ul>
              </div>
            )}
            {carrinho.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Adicione produtos da categoria ao lado.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {carrinho.map((item) => (
                  <div key={item.servicoCatalogoId} className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{item.nome}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <button onClick={() => atualizarQtd(item.servicoCatalogoId, -1)} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "var(--cf2-bg-surface-muted)" }}><Minus className="w-2.5 h-2.5" /></button>
                        <span className="text-[11px] w-5 text-center">{item.quantidade}</span>
                        <button onClick={() => atualizarQtd(item.servicoCatalogoId, 1)} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "var(--cf2-bg-surface-muted)" }}><Plus className="w-2.5 h-2.5" /></button>
                        <input
                          type="number" value={item.valorUnitario}
                          onChange={(e) => atualizarValor(item.servicoCatalogoId, parseFloat(e.target.value) || 0)}
                          className="w-20 text-[11px] px-1.5 py-0.5 rounded outline-none ml-1"
                          style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
                        />
                      </div>
                    </div>
                    <button onClick={() => removerItem(item.servicoCatalogoId)} style={{ color: "var(--cf2-danger-text)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-1 text-[12px] mb-3" style={{ color: "var(--cf2-text-secondary)" }}>
              {totalRecorrente > 0 && <div className="flex justify-between"><span>Mensal</span><span>{brl(totalRecorrente)}</span></div>}
              {totalAvulso > 0 && <div className="flex justify-between"><span>Avulso</span><span>{brl(totalAvulso)}</span></div>}
              <div className="flex justify-between text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}><span>Total</span><span>{brl(totalGeral)}</span></div>
            </div>
            {/* Validação (referência de UX, 19/08) — regra real do backend
                (lib/crm/enviar-proposta.ts rejeita envio sem e-mail),
                surfaced ANTES do clique em vez do vendedor só descobrir
                depois de tentar enviar e ver o erro. */}
            {leadSelecionado && (
              <div className="flex flex-col gap-1 mb-3 p-2.5 rounded-lg" style={{ background: "var(--cf2-bg-surface-muted)" }}>
                <p className="text-[10px] font-bold uppercase" style={{ color: "var(--cf2-text-tertiary)" }}>Antes de enviar</p>
                <div className="flex items-center gap-1.5">
                  {semEmail ? <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "var(--cf2-danger-text)" }} /> : <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: "var(--cf2-success-text)" }} />}
                  <p className="text-[11px]" style={{ color: semEmail ? "var(--cf2-danger-text)" : "var(--cf2-text-secondary)" }}>
                    {semEmail ? "Lead sem e-mail cadastrado — obrigatório pra enviar" : "E-mail do lead cadastrado"}
                  </p>
                </div>
                {carrinho.some((i) => catalogo.find((c) => c.id === i.servicoCatalogoId)?.requerContrato) && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "var(--cf2-warning-text)" }} />
                    <p className="text-[11px]" style={{ color: "var(--cf2-text-secondary)" }}>Um ou mais itens exigem contrato após aceite</p>
                  </div>
                )}
              </div>
            )}
            <input value={condicoesPagamento} onChange={(e) => setCondicoesPagamento(e.target.value)} placeholder="Condições de pagamento" className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none mb-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
            <input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none mb-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações" rows={2} className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none resize-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
          </Cf2Card>
        </div>
      </div>
    </div>
  );
}
