// Fonte única de dados do protótipo OnFace.
// Um arquivo, um dono: alterações de dados entram AQUI, nunca duplicadas nas páginas.
(function () {
  const LEADS = [
  { id: "l1", etapa: "novo", empresa: "Meridiano Log", pessoa: "Ana Paula Serra", cargo: "Diretora de Operações", origem: "Meta Ads", campanha: "Callface AI · Prospecção SP", interesse: "Callface AI", resp: null, acao: null, dias: 3, tag: "Inbound" },
  { id: "l2", etapa: "novo", empresa: null, pessoa: "Rogério Tavares", cargo: "Sócio", origem: "WhatsApp", interesse: "PABX", resp: "Camila Reis", acao: "Ligar para confirmar empresa", venceEm: "hoje", dias: 1, tag: "Sem CNPJ" },
  { id: "l3", etapa: "novo", empresa: "Cliniface Saúde", pessoa: "Dr. Marcos Beltrão", cargo: "Diretor Clínico", origem: "Meta Ads", campanha: "Clínicas · Atendimento 24h", interesse: "Callface AI", resp: null, acao: null, dias: 6, tag: "Saúde" },
  { id: "l4", etapa: "em_contato", empresa: "Vertex Energia", pessoa: "Juliana Prado", cargo: "Gerente de CX", origem: "Site", interesse: "White Label", resp: "Diego Nunes", acao: "E-mail de follow-up", venceEm: "amanhã", dias: 2, tag: "Enterprise" },
  { id: "l5", etapa: "em_contato", empresa: "Braspar Distribuidora", pessoa: "Felipe Andrade", cargo: "Head de Vendas", origem: "Instagram", interesse: "PABX", resp: "Camila Reis", acao: null, dias: 9, tag: "Direct" },
  { id: "l6", etapa: "em_contato", empresa: "Norte Telecom", pessoa: "Larissa Quadros", cargo: "Coordenadora", origem: "Orgânica", interesse: "Callface AI", resp: "Diego Nunes", acao: "Retornar ligação", venceEm: "hoje", dias: 1, tag: "" },
  { id: "l7", etapa: "qualificacao", empresa: "Grupo Aurora", pessoa: "Eduardo Vilhena", cargo: "CFO", origem: "Meta Ads", campanha: "White Label · Revenda", interesse: "White Label", resp: "Camila Reis", acao: "Reunião de descoberta", venceEm: "qui, 14h", dias: 2, tag: "Enterprise" },
  { id: "l8", etapa: "qualificacao", empresa: "Sollar Imóveis", pessoa: "Renata Bastos", cargo: "Diretora Comercial", origem: "Meta Ads", campanha: "PABX · Migração", interesse: "PABX", resp: "Diego Nunes", acao: null, dias: 14, tag: "" },
  { id: "l9", etapa: "qualificacao", empresa: "TecPonto Serviços", pessoa: "Gustavo Menezes", cargo: "Gerente de TI", origem: "Site", interesse: "Callface AI", resp: "Ana Vitória", acao: "Enviar escopo técnico", venceEm: "sex", dias: 4, tag: "Técnico" },
  { id: "l10", etapa: "qualificado", empresa: "Interlagos Frotas", pessoa: "Patrícia Moraes", cargo: "COO", origem: "Meta Ads", campanha: "Callface AI · Prospecção SP", interesse: "Callface AI", resp: "Camila Reis", acao: "Montar proposta", venceEm: "seg", dias: 1, tag: "Prioridade" },
  { id: "l11", etapa: "qualificado", empresa: "Rede Vivace", pessoa: "Thiago Salgado", cargo: "Diretor de Expansão", origem: "Instagram", interesse: "White Label", resp: "Diego Nunes", acao: "Alinhar preço com diretoria", venceEm: "qua", dias: 3, tag: "" },
  { id: "l12", etapa: "oportunidade", empresa: "Construtora Palma", pessoa: "Beatriz Fontes", cargo: "Diretora Financeira", origem: "Site", interesse: "PABX", resp: "Ana Vitória", acao: "Proposta enviada — aguardando", venceEm: "ter", dias: 2, tag: "Proposta" },
  { id: "l13", etapa: "oportunidade", empresa: "Atlas Seguros", pessoa: "Henrique Duarte", cargo: "Superintendente", origem: "Meta Ads", campanha: "Clínicas · Atendimento 24h", interesse: "Callface AI", resp: "Camila Reis", acao: null, dias: 8, tag: "Enterprise" },
  { id: "l14", etapa: "nutricao", empresa: "Móveis Trentino", pessoa: "Sandra Vasques", cargo: "Proprietária", origem: "Formulário", interesse: "PABX", resp: "Diego Nunes", acao: "Retomar contato", venceEm: "15 out", dias: 22, tag: "Sem orçamento" },
  { id: "l15", etapa: "nutricao", empresa: "Ágil Transportes", pessoa: "Wagner Peixoto", cargo: "Gerente", origem: "Instagram", interesse: "Callface AI", resp: "Camila Reis", acao: "Retomar contato", venceEm: "3 nov", dias: 31, tag: "Contrato vigente" },
  { id: "l16", etapa: "nutricao", empresa: "Bela Vista Eventos", pessoa: "Cláudia Rennó", cargo: "Sócia", origem: "WhatsApp", interesse: "PABX", resp: "Diego Nunes", acao: null, dias: 47, tag: "Timing" },
  { id: "l17", etapa: "desqualificado", empresa: "Ferragens União", pessoa: "Jorge Antunes", cargo: "Comprador", origem: "Site", interesse: "PABX", resp: "Camila Reis", acao: null, dias: 63, tag: "Fora do ICP" },
  { id: "l18", etapa: "desqualificado", empresa: "Studio Lumen", pessoa: "Priscila Xavier", cargo: "Diretora", origem: "Meta Ads", campanha: "PABX · Migração", interesse: "Callface AI", resp: "Ana Vitória", acao: null, dias: 71, tag: "Sem fit" }
      ];

  const EQUIPE = ["Camila Reis", "Diego Nunes", "Ana Vitória"];

  const ETAPAS = {
    novo: { label: "Novo", cor: "#4a5560" },
    em_contato: { label: "Em contato", cor: "#4c8fe0" },
    qualificacao: { label: "Qualificação", cor: "#9b8bd8" },
    qualificado: { label: "Qualificado", cor: "#2f9e7a" },
    oportunidade: { label: "Oportunidade", cor: "#fe4f2b" },
    nutricao: { label: "Nutrição", cor: "#c8a86a" },
    desqualificado: { label: "Desqualificado", cor: "#4a5560" }
  };

  const CADENCIAS = ["Primeiro contato", "Prospecção inbound", "Pós-proposta", "Reativação"];

  const SEGMENTOS = {
    "Meridiano Log": "Logística e Transporte",
    "Grupo Aurora": "Indústria",
    "Cliniface Saúde": "Saúde",
    "Sollar Imóveis": "Imobiliário",
    "Vertex Energia": "Energia",
    "Braspar Distribuidora": "Distribuição"
  };

  const CANAIS = {
    "Meta Ads": "background:#fff6f4;color:#9c3210",
    "Instagram": "background:#efecfa;color:#4f3fa8",
    "WhatsApp": "background:#e6f4ee;color:#1f7256",
    "Formulário": "background:#e8f0fb;color:#2c5f9e",
    "Site": "background:#e8f0fb;color:#2c5f9e",
    "Orgânica": "background:#f7edd8;color:#6e5420"
  };

  const slug = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  const iniciais = (n) => (n || "").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase() || "—";
  const cadenciaPadrao = (L) => L.etapa === "novo" ? null : L.etapa === "oportunidade" ? "Pós-proposta" : "Primeiro contato";

  window.OnFaceDados = { LEADS, EQUIPE, ETAPAS, CADENCIAS, SEGMENTOS, CANAIS, slug, iniciais, cadenciaPadrao };
})();

/* Estado compartilhado entre páginas — sobrevive à troca de arquivo (localStorage).
   Concentra também os barramentos: avisos, peças (gaveta/modais) e navegação. */
(function () {
  const CHAVE = "onface.estado.v1";
  const D = window.OnFaceDados || {};
  const PERSISTIR = ["leads", "qual", "cadencias", "atvs", "tagsLead", "tagsCriadas", "menuAberto", "menuGrupos", "visao"];

  const ROTAS = {
    "/onface-preview/pre-vendas": "OnFace Pre-vendas.dc.html",
    "/onface-preview/empresa": "OnFace Empresa.dc.html"
  };

  const padrao = () => ({
    leads: D.LEADS || [],
    qual: {}, cadencias: {}, atvs: {}, tagsLead: {}, tagsCriadas: [],
    menuAberto: true,
    menuGrupos: { Vendas: true, "Operação": false, Clientes: false, "Automações": false, Insights: false },
    visao: "quadro"
  });

  let dados = padrao();
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (cru) dados = Object.assign(dados, JSON.parse(cru));
  } catch (e) { /* sessão sem storage: segue em memória */ }

  const ouvintes = new Set(), avisos = new Set(), pecas = new Set();

  function persistir() {
    try {
      const recorte = {};
      PERSISTIR.forEach(k => { recorte[k] = dados[k]; });
      window.localStorage.setItem(CHAVE, JSON.stringify(recorte));
    } catch (e) { /* ignora cota/modo privado */ }
  }

  function arquivoAtual() {
    try { return decodeURIComponent((window.location.pathname || "").split("/").pop()); } catch (e) { return ""; }
  }

  const Estado = {
    tudo: () => dados,
    ler: (chave, alternativa) => (dados[chave] === undefined ? alternativa : dados[chave]),
    gravar(patch) {
      dados = Object.assign({}, dados, patch);
      persistir();
      ouvintes.forEach(fn => fn(dados));
    },
    assinar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },

    avisar(texto, tom) { avisos.forEach(fn => fn(texto, tom || "ok")); },
    assinarAviso(fn) { avisos.add(fn); return () => avisos.delete(fn); },

    abrir(peca, leadId) { pecas.forEach(fn => fn(peca, leadId)); },
    assinarPecas(fn) { pecas.add(fn); return () => pecas.delete(fn); },

    rotas: ROTAS,
    arquivoDe: (href) => ROTAS[href] || null,
    irPara(href, rotulo, params) {
      const arq = ROTAS[href];
      if (!arq) {
        Estado.avisar('"' + (rotulo || href) + '" ainda não foi desenhada — em construção', "aviso");
        return false;
      }
      if (arq === arquivoAtual() && !params) return true;
      let destino = encodeURIComponent(arq);
      try {
        // preserva os parâmetros do host (token, srcmap) e troca só o ?lead=
        const url = new URL(destino, window.location.href);
        const atuais = new URLSearchParams(window.location.search);
        atuais.delete("lead");
        if (params) Object.keys(params).forEach(k => atuais.set(k, params[k]));
        const q = atuais.toString();
        destino = url.pathname + (q ? "?" + q : "");
      } catch (e) {
        if (params) destino += "?" + Object.keys(params).map(k => k + "=" + encodeURIComponent(params[k])).join("&");
      }
      window.location.href = destino;
      return true;
    },
    parametro(nome) {
      try { return new URLSearchParams(window.location.search).get(nome); } catch (e) { return null; }
    },
    reiniciar() { dados = padrao(); persistir(); ouvintes.forEach(fn => fn(dados)); }
  };

  window.OnFaceEstado = Estado;
})();
