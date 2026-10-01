"use client";

/**
 * ⚠️  ÓRFÃO — mapeado em 22/09/2026, NÃO removido.
 *
 * Sem chamador. O compositor em uso é `DialogoNovaProposta`, em
 * `components/onface/vendas/Propostas.tsx`; `/propostas/nova` abre a listagem
 * com `abrirComposer`, e `/propostas/novo` é só um redirect para ela.
 *
 * Está aqui de propósito: remoção de legado exige autorização explícita, e o
 * inventário está em `docs/architecture/refactor-state.md` (CP40) para essa
 * decisão. O aviso existe porque o risco concreto não é o arquivo ocupar
 * espaço — é alguém abrir este e consertar a tela errada, já que ele compila,
 * passa no tsc e parece vivo.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, Minus, Trash2, ArrowLeft, Send, Save, AlertTriangle, CheckCircle2, ChevronDown, Check, Briefcase, Building2, UserSearch, Contact, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Cf2Card } from "../ui/Card";
import { Cf2Badge } from "../ui/Badge";
import { calcSubtotal as calcSubDesconto, getMoedaInfo } from "@/components/crm/proposta-utils";

interface Lead { id: string; nome: string; empresa: string | null; telefone: string; status: string }
interface CatalogoItem {
  id: string; nome: string; descricao: string | null; tipo: string; unidade: string;
  valorSugerido: string | null; categoria: string | null; requerContrato: boolean;
}

/* ── Catálogo Oficial Stripe (02/09) — Família > Categoria > Produto > Variação.
   A árvore vem pronta de `GET /api/catalogo-oficial`, na ordem comercial (não
   alfabética). O legado do Zoho continua acessível por "ver outros produtos",
   que usa a rota antiga — proposta nova usa o catálogo oficial. */
interface PrecoOficial {
  id: string; stripePriceId: string; sku: string | null; lookupKey: string | null;
  variacao: string; descricao: string | null; valor: string; moeda: string;
  tipo: string; recorrente: boolean; periodo: string | null; revenueNature: string;
  modeloCobranca: string | null; exigeContrato: boolean; observacao: string | null;
}
interface ProdutoOficial {
  id: string; nome: string; descricao: string | null; etiquetaUnidade: string | null;
  observacaoOperacional: string | null; quantityBehavior: string; destinoPosVenda: string | null;
  stripeProductId: string | null; skuProduto: string | null; precos: PrecoOficial[];
}
interface CategoriaOficial { key: string; label: string; produtos: ProdutoOficial[] }
interface FamiliaOficial { key: string; label: string; categorias: CategoriaOficial[] }
interface CatalogoOficial { familias: FamiliaOficial[]; totais: { produtos: number; precos: number } }

interface ItemCarrinho {
  servicoCatalogoId: string; nome: string; descricao: string | null; tipo: string; quantidade: number; valorUnitario: number;
  desconto: number; descontoTipo: "percentual" | "valor";
  /* Referência oficial imutável. Desconto e valor negociado mexem em
     `valorUnitario`/`desconto` e NUNCA nestes campos — é o que garante que
     negociar preço não cria produto nem price novo no Stripe. `valorTabela`
     preserva o preço oficial do momento da venda pra auditar o desconto. */
  catalogoPrecoId?: string | null;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
  skuPreco?: string | null;
  variacao?: string | null;
  valorTabela?: number | null;
  serviceFamily?: string | null;
  revenueNature?: string | null;
  exigeContrato?: boolean;
  periodo?: string | null;
  etiquetaUnidade?: string | null;
}
// CPF e cargo do signatário existem porque o contrato os cita nominalmente
// ({{pessoa_cpf}}, {{pessoa_cargo}}). Eram lidos de signatarios[0] e nunca
// coletados: todo contrato saía com "não informado" no lugar.
interface Signatario { nome: string; email: string; papel: string; ordem: number; cpf?: string; cargo?: string }

const CATEGORIA_LABEL: Record<string, string> = { callface_ai: "Callface AI", pabx: "PABX", white_label: "White Label", outros: "Outros produtos" };

/* Sufixo de período no preço. "Único" não recebe sufixo — "R$ 129,90 único"
   lê pior que só "R$ 129,90" num item que já está na coluna de setup/avulso. */
const PERIODO_SUFIXO: Record<string, string> = { mensal: "/mês", anual: "/ano", unico: "" };
/* Família comercial -> slug de categoria legada, usado no resumo por linha.
   Fora do componente de propósito: literal criado dentro de useMemo impede o
   React Compiler de preservar a memoização. */
const FAMILIA_PARA_SLUG: Record<string, string> = { CALLFACE_AI: "callface_ai", PABX: "pabx", WHITE_LABEL: "white_label" };
const REVENUE_LABEL: Record<string, string> = {
  MRR: "Recorrente", SETUP: "Setup", ONE_TIME: "Avulso", USAGE: "Uso", HARDWARE: "Hardware", PROJECT: "Projeto", UNKNOWN: "Não classificado",
};

const ORIGENS_PROPOSTA: { key: "oportunidade" | "empresa" | "lead" | "contato"; titulo: string; descricao: string; placeholder: string; icon: LucideIcon }[] = [
  { key: "oportunidade", titulo: "Oportunidade existente", descricao: "A proposta entra numa oportunidade que já está no pipeline.", placeholder: "Buscar oportunidade, empresa ou pessoa...", icon: Briefcase },
  { key: "empresa", titulo: "Cliente / empresa", descricao: "Organização já cadastrada. Uma oportunidade será criada junto da proposta.", placeholder: "Buscar empresa...", icon: Building2 },
  { key: "lead", titulo: "Lead", descricao: "Jornada comercial em andamento. Uma oportunidade será criada junto da proposta.", placeholder: "Buscar lead...", icon: UserSearch },
  { key: "contato", titulo: "Contato / pessoa", descricao: "Comprador ou interlocutor. Uma oportunidade será criada junto da proposta.", placeholder: "Buscar pessoa...", icon: Contact },
];

/** Retorno de `POST /propostas` quando a composição spana múltiplas famílias. */
interface ResultadoMultiLinha {
  multiLinha: true;
  bundleId: string;
  mensagem: string;
  oportunidades: { family: string; label: string; negocioId: string; propostaId: string; propostaNumeroFormatado: string }[];
}
const MOEDA_OPCOES = [
  { value: "BRL", label: "BRL — Real" },
  { value: "USD", label: "USD — Dólar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "CAD", label: "CAD — Dólar canadense" },
];
const brl = (v: number, moeda: string = "BRL") => v.toLocaleString("pt-BR", { style: "currency", currency: moeda });

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
  const [familiaAtiva, setFamiliaAtiva] = useState<string | null>(null);
  /* Produto aberto no acordeão. Um produto pode ter 45 variações (PABX
     Hardware) — abrir tudo de uma vez viraria uma parede de preços. */
  const [produtoAberto, setProdutoAberto] = useState<string | null>(null);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [moeda, setMoeda] = useState("BRL");
  const [condicoesPagamento, setCondicoesPagamento] = useState("");
  // Condição de pagamento estruturada (25/08, billing avançado) — o texto
  // livre acima passa a ser só observação extra; isto aqui é o que o
  // checkout Stripe usa de fato (payment_method_types + vencimento do
  // boleto, ver stripe-checkout.ts).
  const [condicaoPagamentoTipo, setCondicaoPagamentoTipo] = useState<"" | "cartao" | "boleto" | "boleto_parcelado" | "outro">("");
  const [parcelas, setParcelas] = useState("1");
  const [vencimentoDias, setVencimentoDias] = useState("3");
  const [prazoContratoMeses, setPrazoContratoMeses] = useState("");
  const [resultadoMulti, setResultadoMulti] = useState<ResultadoMultiLinha | null>(null);
  /**
   * Origem da proposta (01/09, 2B). Antes a tela abria numa lista chapada
   * "Selecione o cliente" que na verdade listava LEADS — nomenclatura errada
   * e sem dizer que uma oportunidade seria criada. Agora o vendedor escolhe
   * explicitamente de onde parte, e cada caminho explica a consequência.
   */
  const [origemProposta, setOrigemProposta] = useState<null | "oportunidade" | "empresa" | "lead" | "contato">(null);
  const [dataValidade, setDataValidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [signatarios, setSignatarios] = useState<Signatario[]>([{ nome: "", email: "", papel: "Signatário", ordem: 1, cpf: "", cargo: "" }]);
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
    setCarrinho((propostaEditando.itens || []).map((i: { servicoCatalogoId: string | null; nome: string; descricao?: string | null; tipo: string; quantidade: string; valorUnitario: string; desconto?: string; descontoTipo?: string }) => ({
      servicoCatalogoId: i.servicoCatalogoId || i.nome, nome: i.nome, descricao: i.descricao ?? null, tipo: i.tipo, quantidade: parseFloat(i.quantidade), valorUnitario: parseFloat(i.valorUnitario),
      desconto: parseFloat(i.desconto || "0"), descontoTipo: (i.descontoTipo as "percentual" | "valor") || "percentual",
    })));
    setMoeda(propostaEditando.moeda || "BRL");
    setCondicoesPagamento(propostaEditando.condicoesPagamento || "");
    setCondicaoPagamentoTipo(propostaEditando.condicaoPagamentoTipo || "");
    setParcelas(propostaEditando.parcelas ? String(propostaEditando.parcelas) : "1");
    setVencimentoDias(propostaEditando.vencimentoDias ? String(propostaEditando.vencimentoDias) : "3");
    setPrazoContratoMeses(propostaEditando.prazoContratoMeses ? String(propostaEditando.prazoContratoMeses) : "");
    setDataValidade(propostaEditando.dataValidade || "");
    setObservacoes(propostaEditando.observacoes || "");
    setSignatarios(Array.isArray(propostaEditando.signatarios) && propostaEditando.signatarios.length > 0 ? propostaEditando.signatarios.map((s: Partial<Signatario>, i: number) => ({ nome: s.nome || "", email: s.email || "", papel: s.papel || "Signatário", ordem: s.ordem || i + 1, cpf: s.cpf || "", cargo: s.cargo || "" })) : [{ nome: "", email: "", papel: "Signatário", ordem: 1, cpf: "", cargo: "" }]);
    setHerdouServicos(true);
    setCarregouEdicao(true);
  }, [propostaEditando, carregouEdicao]);

  const { data: oportunidadesBusca } = useQuery<{ id: string; titulo: string; status: string; leadId: string | null; leadNome: string | null; empresaNome: string | null }[]>({
    queryKey: ["negocios-for-proposta", buscaLead],
    queryFn: async () => {
      const r = await fetch(`/api/negocios?limit=20&status=abertos${buscaLead ? `&search=${encodeURIComponent(buscaLead)}` : ""}`);
      if (!r.ok) return [];
      const d = await r.json();
      return d.negocios || d;
    },
    enabled: !leadSelecionado && origemProposta === "oportunidade",
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: ["leads-for-proposta", buscaLead],
    queryFn: async () => {
      const r = await fetch(`/api/leads?limit=20${buscaLead ? `&search=${encodeURIComponent(buscaLead)}` : ""}`);
      const data = await r.json();
      return data.leads || data;
    },
    enabled: !leadSelecionado && origemProposta !== null && origemProposta !== "oportunidade",
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
      // `GET /api/leads/:id` responde `{ lead: {...}, empresa, ... }` — o
      // e-mail está em `.lead.email`, não na raiz. Achado real 25/08: isso
      // fazia `leadDetalhe?.email` vir sempre undefined e o aviso de "sem
      // e-mail" aparecer pra TODO lead, mesmo com e-mail cadastrado.
      const j = await r.json();
      return { email: j.lead?.email ?? null };
    },
    enabled: !!leadSelecionado?.id,
  });
  const semEmail = !!leadSelecionado && leadDetalhe !== undefined && !leadDetalhe?.email;

  // Por padrão só mostra item classificado (família/categoria já definida) —
  // pra não despejar as ~190 linhas históricas do Zoho no vendedor (correção
  // 19/08). "Ver outros produtos" (achado real 25/08, Kauã: "a maioria vai
  // ser PABX, mas se alguém precisar ele precisa conseguir localizar")
  // reusa o `?incluirNaoClassificados=true` que a rota já suporta pra isso.
  const [mostrarOutros, setMostrarOutros] = useState(false);

  // Catálogo Oficial Stripe — a árvore que o vendedor usa pra vender.
  const { data: oficial } = useQuery<CatalogoOficial>({
    queryKey: ["catalogo-oficial"],
    queryFn: async () => {
      const r = await fetch("/api/catalogo-oficial");
      if (!r.ok) return { familias: [], totais: { produtos: 0, precos: 0 } };
      return r.json();
    },
    enabled: !!leadSelecionado,
  });

  const { data: catalogo = [] } = useQuery<CatalogoItem[]>({
    queryKey: ["servicos-catalogo", mostrarOutros],
    queryFn: async () => {
      // `all=true` also bypasses o filtro `ativo=true` — sem ele os ~190
      // itens legados continuam invisíveis (a maioria está inativa, não só
      // não-classificada).
      const r = await fetch(`/api/servicos-catalogo${mostrarOutros ? "?incluirNaoClassificados=true&all=true" : ""}`);
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
        servicoCatalogoId: item.id, nome: item.nome, descricao: item.descricao, tipo: item.tipo, quantidade: 1,
        valorUnitario: parseFloat(item.valorSugerido || "0"), desconto: 0, descontoTipo: "percentual",
      })));
    }
    setHerdouServicos(true);
  }, [catalogo, negocioContexto, herdouServicos]);

  const buscaProdutoNorm = buscaProduto.trim().toLowerCase();

  /* Navegação da árvore oficial. `familiaAtiva`/`categoriaAtiva` são a
     posição do vendedor; "outros produtos" (legado) é uma família sintética
     no fim da lista, nunca misturada com as famílias reais. */
  const familiasOficiais = oficial?.familias ?? [];
  const familiaSelecionada = familiaAtiva ?? familiasOficiais[0]?.key ?? null;
  const familiaAtual = familiasOficiais.find((f) => f.key === familiaSelecionada) ?? null;

  const categoriasDaFamilia = useMemo(() => familiaAtual?.categorias ?? [], [familiaAtual]);
  const categoriaSelecionada = (categoriaAtiva && categoriasDaFamilia.some((c) => c.key === categoriaAtiva))
    ? categoriaAtiva
    : categoriasDaFamilia[0]?.key ?? null;

  /* Busca atravessa a árvore inteira da família: procurar "fanvil" tem que
     achar o produto mesmo estando em outra categoria, senão o vendedor
     precisaria adivinhar em qual aba o item mora (PABX Hardware tem 45
     variações num produto só). Sem busca, respeita a categoria selecionada. */
  const produtosVisiveis = useMemo<{ produto: ProdutoOficial; precos: PrecoOficial[]; categoriaLabel: string }[]>(() => {
    if (!familiaAtual) return [];
    const casa = (p: ProdutoOficial, pr: PrecoOficial) =>
      !buscaProdutoNorm
      || p.nome.toLowerCase().includes(buscaProdutoNorm)
      || (p.descricao || "").toLowerCase().includes(buscaProdutoNorm)
      || pr.variacao.toLowerCase().includes(buscaProdutoNorm)
      || (pr.sku || "").toLowerCase().includes(buscaProdutoNorm);

    const cats = buscaProdutoNorm ? categoriasDaFamilia : categoriasDaFamilia.filter((c) => c.key === categoriaSelecionada);
    const saida: { produto: ProdutoOficial; precos: PrecoOficial[]; categoriaLabel: string }[] = [];
    for (const cat of cats) {
      for (const produto of cat.produtos) {
        const precos = produto.precos.filter((pr) => casa(produto, pr));
        if (precos.length > 0) saida.push({ produto, precos, categoriaLabel: cat.label });
      }
    }
    return saida;
  }, [familiaAtual, categoriasDaFamilia, categoriaSelecionada, buscaProdutoNorm]);

  /* Legado: só aparece quando o vendedor pede explicitamente. Continua vindo
     da rota antiga (lista chapada, sem price) — é histórico, não catálogo de
     venda nova. */
  const legadoVisivel = mostrarOutros
    ? catalogo
        .filter((c) => !buscaProdutoNorm || c.nome.toLowerCase().includes(buscaProdutoNorm) || (c.descricao || "").toLowerCase().includes(buscaProdutoNorm))
        .slice(0, 200)
    : [];

  const totalRecorrente = carrinho.filter((i) => i.tipo === "recorrente").reduce((s, i) => s + calcSubDesconto(i.quantidade, i.valorUnitario, i.desconto, i.descontoTipo), 0);
  const totalAvulso = carrinho.filter((i) => i.tipo !== "recorrente").reduce((s, i) => s + calcSubDesconto(i.quantidade, i.valorUnitario, i.desconto, i.descontoTipo), 0);
  const totalGeral = totalRecorrente + totalAvulso;
  /* Exigência de contrato vem do PRICE oficial quando o item veio do catálogo
     novo (é lá que a regra mora: White Label Licença isolada não exige
     contrato, o Setup exige). Item legado continua caindo no `requerContrato`
     do produto, que é tudo que ele tem. */
  const exigeContrato = carrinho.some((i) =>
    i.catalogoPrecoId ? !!i.exigeContrato : !!catalogo.find((c) => c.id === i.servicoCatalogoId)?.requerContrato
  );
  const signatariosValidos = signatarios.filter((s) => s.nome.trim() && s.email.trim()).map((s, i) => ({ ...s, papel: s.papel.trim() || "Signatário", ordem: s.ordem || i + 1 }));
  const prazoContratoValido = !exigeContrato || (Number.isInteger(Number(prazoContratoMeses)) && Number(prazoContratoMeses) > 0);

  // Commercial Core v3 (ADR-EXEC-022): preview client-side de quantas
  // oportunidades essa composição vai virar — categoria do catálogo mapeia
  // 1:1 pra service_family (a separação real/autoritativa acontece no
  // backend; isso é só pro vendedor ver ANTES de submeter).
  const linhasNoCarrinho = useMemo(() => {
    // Detalhado por família (01/09, 2B): antes era só total agregado. O
    // vendedor precisa ver MRR e setup separados por família, e saber quais
    // exigem contrato — famílias diferentes têm ciclo/pagamento/pós-venda
    // próprios, e é isso que justifica a quebra em oportunidades irmãs.
    const grupos = new Map<string, { total: number; recorrente: number; avulso: number; qtd: number; exigeContrato: boolean }>();
    for (const item of carrinho) {
      const doCatalogo = catalogo.find((c) => c.id === item.servicoCatalogoId);
      // Item oficial já declara a família; legado cai na categoria antiga.
      const cat = item.serviceFamily
        ? FAMILIA_PARA_SLUG[item.serviceFamily] || "outros"
        : doCatalogo?.categoria || "outros";
      const label = CATEGORIA_LABEL[cat] || cat;
      const atual = grupos.get(label) || { total: 0, recorrente: 0, avulso: 0, qtd: 0, exigeContrato: false };
      const valor = calcSubDesconto(item.quantidade, item.valorUnitario, item.desconto, item.descontoTipo);
      atual.total += valor;
      if (item.tipo === "recorrente") atual.recorrente += valor; else atual.avulso += valor;
      atual.qtd += 1;
      if (item.catalogoPrecoId ? item.exigeContrato : doCatalogo?.requerContrato) atual.exigeContrato = true;
      grupos.set(label, atual);
    }
    return grupos;
  }, [carrinho, catalogo]);

  /** Famílias do carrinho que exigem contrato — usado no aviso e no gate de prazo. */
  const familiasComContrato = useMemo(
    () => [...linhasNoCarrinho.entries()].filter(([, info]) => info.exigeContrato).map(([label]) => label),
    [linhasNoCarrinho]
  );

  /**
   * Família PRINCIPAL numa venda multi-family — a que herda a oportunidade
   * existente (01/09, 2B). O backend usa a ordem do Map, que é a ordem em que
   * os itens entraram no carrinho. Aqui só ANTECIPAMOS esse mesmo critério pro
   * vendedor ver antes de gerar; não mudei a regra no backend pra não tocar
   * lógica madura de `organizarVendaMultiLinha`.
   */
  const familiaPrincipal = linhasNoCarrinho.size > 1 ? [...linhasNoCarrinho.keys()][0] : null;

  /**
   * Adiciona uma VARIAÇÃO/PRICE do catálogo oficial. A chave de unicidade no
   * carrinho é o price, não o produto: vender Starter Mensal e Starter Anual
   * na mesma proposta é uma composição possível (o produto é o mesmo).
   */
  function adicionarPrecoOficial(produto: ProdutoOficial, preco: PrecoOficial, familia: string) {
    if (carrinho.some((i) => i.catalogoPrecoId === preco.id)) return;
    setCarrinho((prev) => [...prev, {
      servicoCatalogoId: produto.id,
      nome: `${produto.nome} — ${preco.variacao}`,
      descricao: preco.descricao || produto.descricao,
      tipo: preco.tipo,
      quantidade: 1,
      valorUnitario: parseFloat(preco.valor),
      desconto: 0,
      descontoTipo: "percentual",
      catalogoPrecoId: preco.id,
      stripeProductId: produto.stripeProductId,
      stripePriceId: preco.stripePriceId,
      skuPreco: preco.sku,
      variacao: preco.variacao,
      valorTabela: parseFloat(preco.valor),
      serviceFamily: familia,
      revenueNature: preco.revenueNature,
      exigeContrato: preco.exigeContrato,
      periodo: preco.periodo,
      etiquetaUnidade: produto.etiquetaUnidade,
    }]);
  }

  function adicionarItem(item: CatalogoItem) {
    if (carrinho.some((i) => i.servicoCatalogoId === item.id)) return;
    setCarrinho((prev) => [...prev, {
      servicoCatalogoId: item.id, nome: item.nome, descricao: item.descricao, tipo: item.tipo, quantidade: 1,
      valorUnitario: parseFloat(item.valorSugerido || "0"), desconto: 0, descontoTipo: "percentual",
    }]);
  }
  function removerItem(id: string) { setCarrinho((prev) => prev.filter((i) => i.servicoCatalogoId !== id)); }
  function atualizarQtd(id: string, delta: number) {
    setCarrinho((prev) => prev.map((i) => i.servicoCatalogoId === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i));
  }
  function atualizarValor(id: string, valor: number) {
    setCarrinho((prev) => prev.map((i) => i.servicoCatalogoId === id ? { ...i, valorUnitario: valor } : i));
  }
  function atualizarDesconto(id: string, desconto: number) {
    setCarrinho((prev) => prev.map((i) => i.servicoCatalogoId === id ? { ...i, desconto: Math.max(0, desconto) } : i));
  }
  function alternarDescontoTipo(id: string) {
    setCarrinho((prev) => prev.map((i) => i.servicoCatalogoId === id ? { ...i, descontoTipo: i.descontoTipo === "percentual" ? "valor" : "percentual" } : i));
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
            moeda,
            condicoesPagamento: condicoesPagamento || undefined,
            condicaoPagamentoTipo: condicaoPagamentoTipo || undefined,
            parcelas: condicaoPagamentoTipo === "boleto_parcelado" ? Number(parcelas) : undefined,
            vencimentoDias: condicaoPagamentoTipo === "boleto" || condicaoPagamentoTipo === "boleto_parcelado" ? Number(vencimentoDias) : undefined,
            prazoContratoMeses: prazoContratoMeses ? Number(prazoContratoMeses) : undefined,
            dataValidade: dataValidade || undefined,
            observacoes: observacoes || undefined,
            signatarios: signatariosValidos,
            itens: carrinho.map((i) => ({ servicoCatalogoId: i.servicoCatalogoId, nome: i.nome, descricao: i.descricao || undefined, tipo: i.tipo, quantidade: i.quantidade, valorUnitario: i.valorUnitario, desconto: i.desconto, descontoTipo: i.descontoTipo })),
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
          moeda,
          condicoesPagamento: condicoesPagamento || undefined,
          condicaoPagamentoTipo: condicaoPagamentoTipo || undefined,
          parcelas: condicaoPagamentoTipo === "boleto_parcelado" ? Number(parcelas) : undefined,
          vencimentoDias: condicaoPagamentoTipo === "boleto" || condicaoPagamentoTipo === "boleto_parcelado" ? Number(vencimentoDias) : undefined,
          prazoContratoMeses: prazoContratoMeses ? Number(prazoContratoMeses) : undefined,
          dataValidade: dataValidade || undefined,
          observacoes: observacoes || undefined,
          signatarios: signatariosValidos,
          itens: carrinho.map((i) => ({ servicoCatalogoId: i.servicoCatalogoId, nome: i.nome, descricao: i.descricao || undefined, tipo: i.tipo, quantidade: i.quantidade, valorUnitario: i.valorUnitario, desconto: i.desconto, descontoTipo: i.descontoTipo })),
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
        return resultado as ResultadoMultiLinha;
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
        // NÃO redireciona (01/09, 2B). Antes ia direto pra primeira
        // oportunidade e o vendedor não sabia que outras N foram criadas —
        // a API já devolvia mensagem + ids e o front jogava fora.
        setResultadoMulti(resultado as ResultadoMultiLinha);
        return;
      }
      // Quem entrou aqui a partir de uma oportunidade volta PRA ELA (01/09,
      // Frente 2A): antes caía sempre em /propostas, o closer perdia o
      // contexto e tinha que reabrir a oportunidade na mão pra ver o
      // resultado. `negocioId` já vem na query — é a mesma fonte que
      // pré-seleciona o negócio no formulário.
      router.push(negocioIdPreSelecionado ? `/negocios/${negocioIdPreSelecionado}` : "/propostas");
    },
  });

  if ((negocioIdPreSelecionado && carregandoNegocio) || (leadIdPreSelecionado && carregandoLead) || (propostaIdEditando && carregandoProposta && !carregouEdicao)) {
    return <div className=""><p className="text-sm" style={{ color: "var(--cf2-text-tertiary)" }}>Carregando proposta...</p></div>;
  }

  // ── Tela de sucesso da venda multi-family (01/09, 2B) ──────────────────
  // Substitui o redirect silencioso: o vendedor vê a mensagem que a API já
  // devolvia, quais oportunidades nasceram, qual reaproveitou a existente e
  // quais ainda vão exigir contrato na 2C.
  if (resultadoMulti) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-3">
          <Link href="/propostas" className="p-1.5 rounded-lg" style={{ color: "var(--cf2-text-tertiary)" }}><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--cf2-text-primary)" }}>
              Venda organizada em {resultadoMulti.oportunidades.length} oportunidades
            </h1>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{resultadoMulti.mensagem}</p>
          </div>
        </div>

        <Cf2Card>
          <div className="flex flex-col gap-2">
            {resultadoMulti.oportunidades.map((op, indice) => {
              const reaproveitada = indice === 0 && !!negocioIdPreSelecionado;
              const exigeContratoFamilia = familiasComContrato.includes(op.label);
              return (
                <div key={op.negocioId} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: "var(--cf2-text-primary)" }}>{op.label}</p>
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
                      Proposta {op.propostaNumeroFormatado}
                      {reaproveitada ? " · manteve a oportunidade de origem" : " · oportunidade nova"}
                      {exigeContratoFamilia ? " · exige contrato" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/propostas/${op.propostaId}`} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>Proposta</Link>
                    <Link href={`/negocios/${op.negocioId}`} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>Abrir oportunidade</Link>
                  </div>
                </div>
              );
            })}
          </div>
          {familiasComContrato.length > 0 && (
            <p className="mt-3 text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>
              As famílias marcadas com contrato ({familiasComContrato.join(", ")}) precisam de contrato assinado antes do
              pagamento. Esse passo é tratado depois do aceite.
            </p>
          )}
        </Cf2Card>

        <div className="flex items-center gap-2">
          <Link href="/propostas" className="text-[13px] font-semibold px-4 py-2 rounded-xl" style={{ border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}>Ver todas as propostas</Link>
          {negocioIdPreSelecionado && (
            <Link href={`/negocios/${negocioIdPreSelecionado}`} className="text-[13px] font-semibold px-4 py-2 rounded-xl" style={{ color: "var(--cf2-text-secondary)" }}>Voltar pra oportunidade de origem</Link>
          )}
        </div>
      </div>
    );
  }

  // ── Etapa 1: de onde a proposta parte (01/09, 2B) ───────────────────────
  // Nomenclatura correta e consequência explícita em cada caminho:
  //   empresa/cliente = organização · pessoa/contato = comprador
  //   lead = jornada comercial · oportunidade = onde a proposta MORA
  // Regra: a proposta da UI nova SEMPRE termina vinculada a uma oportunidade.
  // Quando a origem não é uma oportunidade, o backend cria uma
  // (`POST /propostas` já faz isso quando recebe só `leadId`) — o que faltava
  // era o vendedor SABER disso antes.
  if (!leadSelecionado) {
    if (!origemProposta) {
      // 10/09/2026 — a tela de origem era 4 cartões brancos equivalentes,
      // só texto, empilhados numa coluna estreita num container que sobra
      // vazio em qualquer tela maior que um celular. Virou um grid 2x2 com
      // ícone por caminho (a mesma pergunta "de onde vem essa proposta?"
      // fica mais rápida de escanear por forma, não só por título) e hover
      // com o accent do produto, em vez de flat.
      return (
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/propostas" className="p-1.5 rounded-lg hover:bg-[var(--cf2-bg-surface-muted)]" style={{ color: "var(--cf2-text-tertiary)" }}><ArrowLeft className="w-4 h-4" /></Link>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>Nova proposta</h1>
              <p className="text-[13px]" style={{ color: "var(--cf2-text-secondary)" }}>De onde essa proposta parte?</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ORIGENS_PROPOSTA.map((o) => (
              <button
                key={o.key}
                onClick={() => { setOrigemProposta(o.key); setBuscaLead(""); }}
                className="group text-left p-4 rounded-xl transition-colors cf2-transicao"
                style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--cf2-accent-border)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--cf2-border-default)"; }}
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: "var(--cf2-accent-bg-subtle)", color: "var(--cf2-accent)" }}>
                  <o.icon className="w-4 h-4" />
                </span>
                <p className="mt-3 text-[14px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{o.titulo}</p>
                <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--cf2-text-secondary)" }}>{o.descricao}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    const origemAtual = ORIGENS_PROPOSTA.find((o) => o.key === origemProposta)!;
    return (
      <div className="space-y-4 max-w-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => { setOrigemProposta(null); setBuscaLead(""); }} className="p-1.5 rounded-lg hover:bg-[var(--cf2-bg-surface-muted)]" style={{ color: "var(--cf2-text-tertiary)" }}><ArrowLeft className="w-4 h-4" /></button>
          <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ background: "var(--cf2-accent-bg-subtle)", color: "var(--cf2-accent)" }}>
            <origemAtual.icon className="w-4 h-4" />
          </span>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--cf2-text-primary)", fontFamily: "var(--cf2-font-heading)" }}>{origemAtual.titulo}</h1>
            <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{origemAtual.descricao}</p>
          </div>
        </div>

        {origemProposta !== "oportunidade" && (
          <div className="p-2.5 rounded-lg text-[12px]" style={{ background: "var(--cf2-accent-bg-subtle)", color: "var(--cf2-text-primary)", border: "1px solid var(--cf2-accent-border)" }}>
            Ao gerar, o sistema cria uma <strong>oportunidade vinculada</strong> a esta proposta. Toda proposta vive dentro de uma oportunidade.
          </div>
        )}

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-text-tertiary)" }} />
          <input
            value={buscaLead} onChange={(e) => setBuscaLead(e.target.value)} placeholder={origemAtual.placeholder} autoFocus
            className="w-full text-sm pl-8 pr-3 py-2.5 rounded-lg outline-none"
            style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          {origemProposta === "oportunidade" ? (
            <>
              {(oportunidadesBusca || []).map((op) => (
                <Link
                  key={op.id}
                  href={`/propostas/novo?negocioId=${op.id}`}
                  className="text-left p-3 rounded-xl block"
                  style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
                >
                  <p className="text-[14px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{op.titulo}</p>
                  <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{[op.empresaNome, op.leadNome].filter(Boolean).join(" · ") || "Sem contato vinculado"}</p>
                </Link>
              ))}
              {oportunidadesBusca?.length === 0 && <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhuma oportunidade aberta encontrada.</p>}
            </>
          ) : (
            <>
              {leads?.map((lead) => (
                <button key={lead.id} onClick={() => setLeadSelecionado(lead)} className="text-left p-3 rounded-xl flex items-center justify-between" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{lead.nome}</p>
                    <p className="text-[12px]" style={{ color: "var(--cf2-text-secondary)" }}>{[lead.empresa, lead.telefone].filter(Boolean).join(" · ")}</p>
                  </div>
                </button>
              ))}
              {leads?.length === 0 && <p className="text-[13px]" style={{ color: "var(--cf2-text-tertiary)" }}>Nada encontrado.</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            onClick={() => salvarMutation.mutate(true)} disabled={carrinho.length === 0 || salvarMutation.isPending || semEmail || (exigeContrato && signatariosValidos.length === 0) || !prazoContratoValido}
            title={semEmail ? "O lead não tem e-mail cadastrado — preencha antes de enviar" : exigeContrato && signatariosValidos.length === 0 ? "Informe os signatários antes de enviar" : exigeContrato && !prazoContratoValido ? "Informe o prazo do contrato em meses" : undefined}
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
        {/* Painel 1 — Família comercial: a família decide o configurador ao lado; não existe formulário universal */}
        <div className="flex lg:flex-col gap-1.5 lg:w-44 shrink-0 overflow-x-auto">
          <p className="hidden lg:block text-micro font-bold uppercase px-1 mb-1" style={{ color: "var(--cf2-text-tertiary)" }}>Famílias comerciais</p>
          {familiasOficiais.map((fam) => (
            <button
              key={fam.key}
              onClick={() => { setFamiliaAtiva(fam.key); setCategoriaAtiva(null); setProdutoAberto(null); setMostrarOutros(false); }}
              className="text-left px-3 py-2 rounded-chip text-corpo font-semibold whitespace-nowrap"
              style={{
                background: !mostrarOutros && familiaSelecionada === fam.key ? "var(--cf2-accent)" : "transparent",
                color: !mostrarOutros && familiaSelecionada === fam.key ? "var(--cf2-text-on-accent)" : "var(--cf2-text-secondary)",
              }}
            >
              {fam.label}
            </button>
          ))}
          {familiasOficiais.length === 0 && (
            <p className="text-apoio px-1" style={{ color: "var(--cf2-text-tertiary)" }}>
              Catálogo oficial não importado nesta organização.
            </p>
          )}
          <button
            onClick={() => { setMostrarOutros((v) => !v); setProdutoAberto(null); }}
            className="text-left px-3 py-2 rounded-chip text-apoio font-medium whitespace-nowrap"
            style={{
              background: mostrarOutros ? "var(--cf2-bg-surface-muted)" : "transparent",
              color: mostrarOutros ? "var(--cf2-text-secondary)" : "var(--cf2-text-tertiary)",
            }}
          >
            {mostrarOutros ? "− Ocultar histórico" : "+ Produtos do histórico"}
          </button>
        </div>

        {/* Painel 2 — Configurador: Categoria > Produto > Variação/Price da família selecionada */}
        <div className="flex-1 flex flex-col gap-2.5 min-w-0">
          <p className="text-micro font-bold uppercase px-1" style={{ color: "var(--cf2-text-tertiary)" }}>
            {mostrarOutros ? "Histórico — produtos legados (não usar em venda nova)" : `Configurador — ${familiaAtual?.label ?? ""}`}
          </p>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cf2-text-tertiary)" }} />
            <input
              value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)}
              placeholder={mostrarOutros ? "Buscar no histórico..." : "Buscar produto, variação ou SKU..."}
              className="w-full text-corpo pl-8 pr-3 py-2 rounded-chip outline-none"
              style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)", color: "var(--cf2-text-primary)" }}
            />
          </div>

          {/* Categorias CRM da família. Some durante a busca, que atravessa a família inteira. */}
          {!mostrarOutros && !buscaProdutoNorm && categoriasDaFamilia.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {categoriasDaFamilia.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => { setCategoriaAtiva(cat.key); setProdutoAberto(null); }}
                  className="px-2.5 py-1 rounded-chip text-apoio font-semibold"
                  style={{
                    background: categoriaSelecionada === cat.key ? "var(--cf2-accent-soft)" : "var(--cf2-bg-surface-muted)",
                    color: categoriaSelecionada === cat.key ? "var(--cf2-accent-text)" : "var(--cf2-text-secondary)",
                    border: `1px solid ${categoriaSelecionada === cat.key ? "var(--cf2-accent-border)" : "var(--cf2-border-default)"}`,
                  }}
                >
                  {cat.label}
                  <span className="ml-1 opacity-60">{cat.produtos.reduce((n, p) => n + p.precos.length, 0)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Produtos > variações. Produto de 1 variação vira botão direto; com
              2+ abre acordeão (PABX Hardware tem 45 num produto só). */}
          {!mostrarOutros && (
            <div className="flex flex-col gap-2 content-start">
              {produtosVisiveis.map(({ produto, precos, categoriaLabel }) => {
                const unico = precos.length === 1 ? precos[0] : null;
                const aberto = produtoAberto === produto.id || !!buscaProdutoNorm;
                const noCarrinho = precos.filter((pr) => carrinho.some((i) => i.catalogoPrecoId === pr.id)).length;
                return (
                  <div key={produto.id} className="rounded-control overflow-hidden" style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}>
                    <button
                      onClick={() => {
                        if (unico) adicionarPrecoOficial(produto, unico, familiaSelecionada || "");
                        else setProdutoAberto(aberto && !buscaProdutoNorm ? null : produto.id);
                      }}
                      disabled={!!unico && carrinho.some((i) => i.catalogoPrecoId === unico.id)}
                      className="w-full text-left p-3 flex items-start justify-between gap-2 disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-corpo font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{produto.nome}</p>
                          {buscaProdutoNorm && <Cf2Badge variant="neutral">{categoriaLabel}</Cf2Badge>}
                          {noCarrinho > 0 && <Cf2Badge variant="success">{noCarrinho} na proposta</Cf2Badge>}
                        </div>
                        {produto.descricao && <p className="text-micro mt-0.5 line-clamp-2" style={{ color: "var(--cf2-text-tertiary)" }}>{produto.descricao}</p>}
                        {produto.observacaoOperacional && (
                          <p className="text-micro mt-1" style={{ color: "var(--cf2-warning-text)" }}>{produto.observacaoOperacional}</p>
                        )}
                        {unico ? (
                          <p className="text-apoio mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
                            {brl(parseFloat(unico.valor), moeda)}{PERIODO_SUFIXO[unico.periodo || ""] || ""}
                            {produto.etiquetaUnidade ? ` · por ${produto.etiquetaUnidade}` : ""}
                            {unico.exigeContrato && " · exige contrato"}
                          </p>
                        ) : (
                          <p className="text-apoio mt-1" style={{ color: "var(--cf2-text-secondary)" }}>
                            {precos.length} variações · a partir de {brl(Math.min(...precos.map((pr) => parseFloat(pr.valor))), moeda)}
                          </p>
                        )}
                      </div>
                      {unico
                        ? <Plus className="w-4 h-4 shrink-0" style={{ color: "var(--cf2-accent-text)" }} />
                        : <ChevronDown className="w-4 h-4 shrink-0 transition-transform" style={{ color: "var(--cf2-text-tertiary)", transform: aberto ? "rotate(180deg)" : undefined }} />}
                    </button>

                    {!unico && aberto && (
                      <div className="max-h-72 overflow-y-auto border-t" style={{ borderColor: "var(--cf2-border-default)" }}>
                        {precos.map((pr) => {
                          const jaTem = carrinho.some((i) => i.catalogoPrecoId === pr.id);
                          return (
                            <button
                              key={pr.id}
                              onClick={() => adicionarPrecoOficial(produto, pr, familiaSelecionada || "")}
                              disabled={jaTem}
                              className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 disabled:opacity-45"
                              style={{ borderTop: "1px solid var(--cf2-border-subtle)" }}
                            >
                              <div className="min-w-0">
                                <p className="text-apoio font-medium truncate" style={{ color: "var(--cf2-text-primary)" }}>{pr.variacao}</p>
                                <p className="text-micro" style={{ color: "var(--cf2-text-tertiary)" }}>
                                  {REVENUE_LABEL[pr.revenueNature] || pr.revenueNature}
                                  {pr.exigeContrato ? " · exige contrato" : ""}
                                </p>
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <span className="text-apoio font-semibold" style={{ color: "var(--cf2-text-primary)" }}>
                                  {brl(parseFloat(pr.valor), moeda)}{PERIODO_SUFIXO[pr.periodo || ""] || ""}
                                </span>
                                {jaTem
                                  ? <Check className="w-3.5 h-3.5" style={{ color: "var(--cf2-success-text)" }} />
                                  : <Plus className="w-3.5 h-3.5" style={{ color: "var(--cf2-accent-text)" }} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {produtosVisiveis.length === 0 && (
                <p className="text-corpo" style={{ color: "var(--cf2-text-tertiary)" }}>
                  {buscaProdutoNorm ? "Nenhum produto encontrado pra essa busca nesta família." : "Nenhum produto ativo nesta categoria."}
                </p>
              )}
            </div>
          )}

          {/* Histórico legado — lista chapada, sem variação (não tem price no banco).
              Existe pra localizar um item antigo, não pra ser o caminho padrão. */}
          {mostrarOutros && (
            <div className="flex flex-col gap-2">
              <p className="text-micro p-2 rounded-chip" style={{ background: "var(--cf2-warning-soft)", color: "var(--cf2-warning-text)" }}>
                Produtos do histórico (Zoho/legado) não têm preço oficial no Stripe. Use só se o item realmente não existir no catálogo oficial — o valor entra como negociado.
              </p>
              {legadoVisivel.map((item) => {
                const jaAdicionado = carrinho.some((i) => i.servicoCatalogoId === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => adicionarItem(item)}
                    disabled={jaAdicionado}
                    className="text-left p-3 rounded-control flex items-start justify-between gap-2 disabled:opacity-50"
                    style={{ background: "var(--cf2-bg-surface)", border: "1px solid var(--cf2-border-default)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-corpo font-semibold" style={{ color: "var(--cf2-text-primary)" }}>{item.nome}</p>
                      {item.descricao && <p className="text-micro mt-0.5 line-clamp-2" style={{ color: "var(--cf2-text-tertiary)" }}>{item.descricao}</p>}
                      <p className="text-apoio mt-0.5" style={{ color: "var(--cf2-text-secondary)" }}>
                        {brl(parseFloat(item.valorSugerido || "0"), moeda)}{item.tipo === "recorrente" ? "/mês" : ""}
                      </p>
                    </div>
                    <Plus className="w-4 h-4 shrink-0" style={{ color: jaAdicionado ? "var(--cf2-text-tertiary)" : "var(--cf2-accent-border)" }} />
                  </button>
                );
              })}
              {legadoVisivel.length === 0 && (
                <p className="text-corpo" style={{ color: "var(--cf2-text-tertiary)" }}>Nenhum produto do histórico pra essa busca.</p>
              )}
            </div>
          )}
        </div>

        {/* Painel 3 — Resumo comercial: vivo enquanto monta, conduz o próximo passo */}
        <div className="lg:w-80 shrink-0">
          <Cf2Card>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--cf2-text-tertiary)" }}>Resumo comercial</p>
            {linhasNoCarrinho.size > 1 && (
              <div className="mb-3 p-3 rounded-lg text-[12px]" style={{ background: "var(--cf2-accent)", color: "var(--cf2-text-on-accent)" }}>
                <p className="font-bold mb-1.5">Você selecionou produtos de {linhasNoCarrinho.size} famílias comerciais diferentes.</p>
                <p className="mb-2 opacity-90">
                  Esta venda será organizada em <strong>{linhasNoCarrinho.size} oportunidades separadas</strong>, uma por família,
                  porque cada família tem ciclo, contrato, pagamento e pós-venda próprios. Você pode continuar: ao gerar, o
                  sistema cria propostas e oportunidades irmãs vinculadas ao mesmo cliente.
                </p>
                <ul className="space-y-1">
                  {[...linhasNoCarrinho.entries()].map(([label, info]) => (
                    <li key={label} className="flex flex-col">
                      <span className="font-semibold">
                        {label}
                        {label === familiaPrincipal && <span className="ml-1 opacity-80">· mantém esta oportunidade</span>}
                        {info.exigeContrato && <span className="ml-1 opacity-80">· exige contrato</span>}
                      </span>
                      <span className="opacity-90">
                        {info.qtd} {info.qtd === 1 ? "item" : "itens"}
                        {info.recorrente > 0 ? ` · ${brl(info.recorrente, moeda)}/mês` : ""}
                        {info.avulso > 0 ? ` · ${brl(info.avulso, moeda)} setup/avulso` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {familiaPrincipal && (
                  <p className="mt-2 opacity-90">
                    As demais famílias nascem como oportunidades novas, ligadas a esta pelo mesmo bundle.
                  </p>
                )}
              </div>
            )}
            {carrinho.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--cf2-text-tertiary)" }}>Adicione produtos da categoria ao lado.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {carrinho.map((item) => (
                  <div key={item.servicoCatalogoId} className="flex flex-col gap-1.5 pb-2" style={{ borderBottom: "1px solid var(--cf2-border-default)" }}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: "var(--cf2-text-primary)" }}>{item.nome}</p>
                        {item.descricao && <p className="text-[10px] truncate" style={{ color: "var(--cf2-text-tertiary)" }}>{item.descricao}</p>}
                      </div>
                      <button onClick={() => removerItem(item.servicoCatalogoId)} className="shrink-0" style={{ color: "var(--cf2-danger-text)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => atualizarQtd(item.servicoCatalogoId, -1)} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "var(--cf2-bg-surface-muted)" }}><Minus className="w-2.5 h-2.5" /></button>
                      <span className="text-[11px] w-5 text-center">{item.quantidade}</span>
                      <button onClick={() => atualizarQtd(item.servicoCatalogoId, 1)} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "var(--cf2-bg-surface-muted)" }}><Plus className="w-2.5 h-2.5" /></button>
                      <input
                        type="number" value={item.valorUnitario} title="Valor unitário"
                        onChange={(e) => atualizarValor(item.servicoCatalogoId, parseFloat(e.target.value) || 0)}
                        className="w-16 text-[11px] px-1.5 py-0.5 rounded outline-none"
                        style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
                      />
                      <input
                        type="number" min={0} value={item.desconto} title="Desconto"
                        onChange={(e) => atualizarDesconto(item.servicoCatalogoId, parseFloat(e.target.value) || 0)}
                        className="w-14 text-[11px] px-1.5 py-0.5 rounded outline-none"
                        style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}
                      />
                      <button
                        onClick={() => alternarDescontoTipo(item.servicoCatalogoId)}
                        title={item.descontoTipo === "percentual" ? "Desconto em %" : "Desconto em valor"}
                        className="shrink-0 px-1.5 py-1 text-[10px] rounded font-semibold"
                        style={{ background: "var(--cf2-bg-surface-muted)", color: "var(--cf2-text-secondary)" }}
                      >
                        {item.descontoTipo === "percentual" ? "%" : getMoedaInfo(moeda).symbol}
                      </button>
                      <span className="text-[11px] font-semibold ml-auto" style={{ color: "var(--cf2-text-primary)" }}>
                        {brl(calcSubDesconto(item.quantidade, item.valorUnitario, item.desconto, item.descontoTipo), moeda)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-1 text-[12px] mb-3" style={{ color: "var(--cf2-text-secondary)" }}>
              {totalRecorrente > 0 && <div className="flex justify-between"><span>Mensal</span><span>{brl(totalRecorrente, moeda)}</span></div>}
              {totalAvulso > 0 && <div className="flex justify-between"><span>Avulso</span><span>{brl(totalAvulso, moeda)}</span></div>}
              <div className="flex justify-between text-[13px] font-bold" style={{ color: "var(--cf2-text-primary)" }}><span>Total</span><span>{brl(totalGeral, moeda)}</span></div>
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
                {exigeContrato && (
                  <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--cf2-border-default)" }}>
                    <p className="text-[11px] font-bold mb-1" style={{ color: "var(--cf2-text-primary)" }}>Signatários do contrato</p>
                    <p className="text-[10px] mb-2" style={{ color: "var(--cf2-text-secondary)" }}>Informe antes do envio quem assina, o papel e a ordem. Exemplos: representante legal, vendedor, testemunha.</p>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-[10px] font-semibold whitespace-nowrap" style={{ color: "var(--cf2-text-secondary)" }}>Vigência do contrato</label>
                      <select aria-label="Vigência do contrato" value={prazoContratoMeses} onChange={(e) => setPrazoContratoMeses(e.target.value)} className="w-28 text-[11px] px-2 py-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: `1px solid ${exigeContrato && !prazoContratoValido ? "var(--cf2-danger-text)" : "var(--cf2-border-default)"}` }}>
                        <option value="">Selecione...</option>
                        <option value="12">12 meses</option>
                        <option value="24">24 meses</option>
                        <option value="36">36 meses</option>
                        <option value="48">48 meses</option>
                      </select>
                    </div>
                    {signatarios.map((s, idx) => (
                      <div key={idx}>
                        <div className="flex gap-1.5 mb-1.5">
                        <input value={s.nome} onChange={(e) => setSignatarios((prev) => prev.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x))} placeholder="Nome completo" aria-label="Nome completo" className="min-w-0 flex-1 text-[11px] px-2 py-1.5 rounded outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
                        <input type="email" value={s.email} onChange={(e) => setSignatarios((prev) => prev.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))} placeholder="E-mail" className="min-w-0 flex-1 text-[11px] px-2 py-1.5 rounded outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
                        <input value={s.papel} onChange={(e) => setSignatarios((prev) => prev.map((x, i) => i === idx ? { ...x, papel: e.target.value } : x))} placeholder="Papel (ex.: testemunha)" className="w-32 text-[11px] px-2 py-1.5 rounded outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
                        <input type="number" min={1} value={s.ordem} onChange={(e) => setSignatarios((prev) => prev.map((x, i) => i === idx ? { ...x, ordem: Math.max(1, Number(e.target.value) || 1) } : x))} title="Ordem de assinatura" className="w-10 text-[11px] px-2 py-1.5 rounded outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
                        {signatarios.length > 1 && <button type="button" onClick={() => setSignatarios((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remover signatário" style={{ color: "var(--cf2-danger-text)" }}>×</button>}
                        </div>
                        <div className="flex gap-1.5 mb-2.5">
                          <input value={s.cargo ?? ""} onChange={(e) => setSignatarios((prev) => prev.map((x, i) => i === idx ? { ...x, cargo: e.target.value } : x))} placeholder="Cargo (vai no contrato)" aria-label="Cargo do signatário" className="min-w-0 flex-1 text-[11px] px-2 py-1.5 rounded outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
                          <input value={s.cpf ?? ""} onChange={(e) => setSignatarios((prev) => prev.map((x, i) => i === idx ? { ...x, cpf: e.target.value } : x))} placeholder="CPF (vai no contrato)" aria-label="CPF do signatário" inputMode="numeric" className="min-w-0 flex-1 text-[11px] px-2 py-1.5 rounded outline-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setSignatarios((prev) => [...prev, { nome: "", email: "", papel: "Signatário", ordem: prev.length + 1, cpf: "", cargo: "" }])} className="text-[10px] font-semibold" style={{ color: "var(--cf2-accent-text)" }}>+ Adicionar signatário</button>
                  </div>
                )}
              </div>
            )}
            <label className="block text-[10px] mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Moeda</label>
            <select aria-label="Moeda" value={moeda} onChange={(e) => setMoeda(e.target.value)} className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none mb-2 focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
              {MOEDA_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label className="block text-[10px] mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Condição de pagamento</label>
            <select aria-label="Condição de pagamento" value={condicaoPagamentoTipo} onChange={(e) => setCondicaoPagamentoTipo(e.target.value as typeof condicaoPagamentoTipo)} className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none mb-2 focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
              <option value="">Não especificar (cliente escolhe no checkout)</option>
              <option value="cartao">Cartão</option>
              <option value="boleto">Boleto à vista</option>
              <option value="boleto_parcelado">Parcelado</option>
              <option value="outro">Outro</option>
            </select>
            {(condicaoPagamentoTipo === "boleto" || condicaoPagamentoTipo === "boleto_parcelado") && (
              <div className="flex gap-2 mb-2">
                {condicaoPagamentoTipo === "boleto_parcelado" && (
                  <div className="flex-1">
                    <label className="block text-[10px] mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Parcelas</label>
                    <select aria-label="Número de parcelas" value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }}>
                      {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n}x</option>)}
                    </select>
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-[10px] mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Vencimento (dias)</label>
                  <input type="number" min={1} max={60} value={vencimentoDias} onChange={(e) => setVencimentoDias(e.target.value)} className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf2-accent-border)]" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
                </div>
              </div>
            )}
            {condicaoPagamentoTipo === "boleto_parcelado" && (
              <p className="text-[10px] mb-2" style={{ color: "var(--cf2-text-tertiary)" }}>
                O 1º boleto sai no checkout; as demais parcelas são geradas manualmente após o aceite (ver ação &quot;Gerar parcelamento&quot; no negócio).
              </p>
            )}
            <input value={condicoesPagamento} onChange={(e) => setCondicoesPagamento(e.target.value)} placeholder="Observações sobre o pagamento (opcional)" aria-label="Observações sobre o pagamento (opcional)" className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none mb-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
            <label className="block text-[10px] mb-1" style={{ color: "var(--cf2-text-secondary)" }}>Validade da proposta</label>
            <input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none mb-2" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações" aria-label="Observações" rows={2} className="w-full text-[12px] px-2.5 py-2 rounded-lg outline-none resize-none" style={{ background: "var(--cf2-bg-surface-muted)", border: "1px solid var(--cf2-border-default)" }} />
          </Cf2Card>
        </div>
      </div>
    </div>
  );
}
