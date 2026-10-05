/**
 * Destino do protótipo → rota real do produto. Fonte ÚNICA desta tradução.
 *
 * O handoff navega com `E.irPara(href, rótulo, params)`, onde `href` é o
 * endereço que a tela tinha no protótipo (`/onface-preview/oportunidade`,
 * `/clientes/360`, `/operacao/projeto`…) e o registro alvo vem em `params`
 * (`opp`, `lead`, `cliente`, `id`). Nada disso existe como rota no produto.
 *
 * Antes cada adaptador (*Proto.tsx) traduzia um pedaço por conta própria, e o
 * resto caía em `router.push(href)` cru: abrir uma oportunidade pelo Pipeline
 * ia para `/onface-preview/oportunidade` (404), e tirar só o prefixo dava
 * `/oportunidade` (404 também). Centralizar aqui é o que impede o próximo
 * adaptador de reabrir o buraco.
 *
 * Id que não é UUID (linha otimista do protótipo, "registro" local) não vira
 * rota de detalhe: cairia num 404. Vai para a lista, que é honesto.
 */

type Params = Record<string, string | null | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: string | null | undefined): string | null => (v && UUID.test(v) ? v : null);

/** Telas do protótipo que existem no produto com outro nome. */
const LISTA: Record<string, string> = {
  "/onface-preview": "/inicio",
  "/onface-preview/visao-geral": "/inicio",
  "/onface-preview/atividades": "/tarefas",
  "/operacao/onboarding": "/pos-vendas",
};

export function rotaDoDesenho(href: string, params: Params = {}): string {
  const [caminho] = href.split(/[?#]/);
  const p = params ?? {};

  switch (caminho) {
    case "/onface-preview/oportunidade": {
      const opp = uuid(p.opp);
      return opp ? `/pipeline/${opp}` : "/pipeline";
    }
    case "/onface-preview/proposta": {
      // O editor de proposta nasce da oportunidade: é o que /propostas/nova lê.
      const opp = uuid(p.opp);
      return opp ? `/propostas/nova?oportunidade=${opp}` : "/propostas/nova";
    }
    case "/onface-preview/pessoa": {
      // A ficha da pessoa é chaveada pelo LEAD (ver app/(produto)/pessoas/[id]).
      const lead = uuid(p.lead);
      return lead ? `/pessoas/${lead}` : "/contatos";
    }
    case "/onface-preview/empresa": {
      // O protótipo só sabe o lead; a empresa dele mora no banco. A rota
      // /empresas/por-lead resolve no servidor, com o tenant da sessão.
      const lead = uuid(p.lead);
      return lead ? `/empresas/por-lead?lead=${lead}` : "/contatos";
    }
    case "/atendimento": {
      /* A ficha abre o Atendimento JÁ na conversa daquela pessoa. Antes o
         destino caía aqui sem os parâmetros (`lead` e `canal` iam no objeto e o
         tradutor devolvia só "/atendimento"), então os botões Enviar mensagem e
         Enviar e-mail levavam para a caixa de entrada inteira. */
      const lead = uuid(p.lead);
      const canal = (p.canal || "").toLowerCase();
      const busca = [lead ? `leadId=${lead}` : "", canal ? `canal=${encodeURIComponent(canal)}` : ""].filter(Boolean).join("&");
      return busca ? `/atendimento?${busca}` : "/atendimento";
    }
    case "/clientes/360": {
      const cliente = uuid(p.cliente);
      if (!cliente) return "/clientes";
      return p.aba ? `/clientes/${cliente}?aba=${encodeURIComponent(p.aba)}` : `/clientes/${cliente}`;
    }
    case "/operacao/projeto": {
      // Projeto = fulfillment (ver app/(produto)/projetos/[id]).
      const id = uuid(p.id);
      return id ? `/projetos/${id}` : "/pos-vendas";
    }
  }

  if (LISTA[caminho]) return LISTA[caminho];
  if (href.startsWith("/onface-preview/")) return href.slice("/onface-preview".length);
  return href;
}

/**
 * Faz a Liga gerada entregar os `params` do `irPara` e traduz o destino.
 *
 * O `E.irPara` da Liga é `(href) => props.ir(href)`: descarta os parâmetros,
 * e é neles que vem o id do registro. Como a Liga é gerada (não se edita),
 * a correção mora numa subclasse — chame no construtor do adaptador.
 */
export function levarParametros(liga: { E: any; props: any }) {
  const E = liga.E;
  liga.E = {
    ...E,
    irPara: (href: string, _rotulo?: string, params?: Params) => liga.props.ir?.(rotaDoDesenho(href, params)),
  };
}
