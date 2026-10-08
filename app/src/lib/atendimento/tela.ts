/**
 * Leitura da tela de Atendimento (o desenho do handoff, `AtendimentoProto`).
 *
 * Arquivo PRÓPRIO de propósito: `api-server/routes/atendimento.ts` já tem a
 * busca do inbox, mas pagina em 40/100 e não traz três coisas que o desenho
 * precisa para não mentir — a direção da última mensagem (sem ela o grupo
 * "AGUARDANDO RESPOSTA" e as métricas NA FILA / SLA zeram), o NOME do
 * responsável (o desenho compara por nome) e a caixa de WhatsApp de cada
 * conversa (whatsapp_sessao). Mexer na rota compartilhada com outros agentes
 * trabalhando em paralelo não era opção.
 *
 * Tudo aqui é dado CRU (ISO, ids). A tradução para o vocabulário do desenho
 * ("Hoje", "09:52", "Em atendimento") é do adaptador, no cliente: o relógio
 * que importa para "espera há 26 min" é o de quem está olhando.
 */
import { nomeCompleto } from "@/lib/vendas/texto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { condicaoMinhasConversas, veTodasAsConversas } from "@/lib/whatsapp/acesso";

type Ctx = {
  organizacaoId: string;
  userId: string;
  userRole?: string | null;
  realRole?: string | null;
};

/** "minhas" = meus números + atribuídas a mim; "equipe" = todos (só quem pode, ver `veTodasAsConversas`). */
export type EscopoAtendimento = "minhas" | "equipe";

export type ConversaAtendimento = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  naoLidas: number;
  status: string;
  snoozedUntil: string | null;
  ultimaMsg: string | null;
  ultimaMsgAt: string | null;
  /** Direção da última mensagem REAL em whatsapp_mensagens ('in' | 'out'), ou null. */
  ultimaDirecao: string | null;
  ultimaTipo: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  sessaoId: string | null;
  sessaoLabel: string | null;
  sessaoFone: string | null;
  /** Lead direto (contatos.lead_id) ou casado pelo telefone — ver `leadPorTelefone`. */
  leadId: string | null;
};

export type LeadAtendimento = {
  id: string;
  nome: string;
  cargo: string | null;
  empresa: string | null;
  empresaId: string | null;
  setor: string | null;
  telefone: string | null;
  email: string | null;
  etapa: string | null;
  origem: string | null;
  campanha: string | null;
  interesse: string | null;
  responsavelNome: string | null;
};

export type DadosAtendimento = {
  eu: { id: string; nome: string };
  /** Escopo efetivo da lista (pedido da URL já limitado pela permissão). */
  escopo: EscopoAtendimento;
  /** Pode alternar para "Equipe": decisão de 09/09 mantida, só super_admin. */
  podeVerEquipe: boolean;
  conversas: ConversaAtendimento[];
  leads: LeadAtendimento[];
  equipe: Array<{ id: string; nome: string }>;
  /** Conversas abertas de WhatsApp por responsável (nome), na organização inteira: a carga que a transferência mostra. */
  cargaEquipe: Record<string, number>;
  sessoes: Array<{ id: string; label: string; fone: string | null }>;
  labels: Array<{ id: string; nome: string }>;
  tagsPorContato: Record<string, string[]>;
  templates: Array<{ id: string; nome: string; categoria: string; conteudo: string }>;
  /** Média em segundos da 1ª resposta por turno do cliente, últimos 30 dias. null = sem amostra. */
  primeiraRespostaMediaSeg: number | null;
  primeiraRespostaAmostra: number;
};

/** Últimos 8 dígitos — mesma regra de `mapaLeadPorTelefone` da rota do inbox. */
function ultimosDigitos(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const d = tel.replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : null;
}

export async function paginaDeAtendimento(ctx: Ctx, escopoPedido: EscopoAtendimento = "minhas"): Promise<DadosAtendimento> {
  const org = ctx.organizacaoId;
  /* Conversa de WhatsApp é dado pessoal (decisão Kauã 09/09, lib/whatsapp/acesso).
     O escopo PADRÃO de todo mundo, inclusive super_admin, é "Minhas": os números
     que são seus e o que está atribuído a você. Só quem `veTodasAsConversas`
     pode pedir "Equipe". A mesma condição vale para a lista, os números, as
     abas, a busca e as métricas — total que conta conversa fora do escopo
     seria o mesmo vazamento disfarçado. */
  const podeVerEquipe = veTodasAsConversas(ctx);
  const escopo: EscopoAtendimento = escopoPedido === "equipe" && podeVerEquipe ? "equipe" : "minhas";
  const acesso = escopo === "equipe"
    ? sql`TRUE`
    : condicaoMinhasConversas(ctx.userId, sql`c.responsavel_id`, sql`c.sessao_id`);

  const [conversas, leadsTel, equipe, sessoes, labels, tags, templates, eu, carga, resp] = await Promise.all([
    db.execute<{
      id: string; nome: string; telefone: string | null; email: string | null; nao_lidas: number | null;
      status: string; snoozed_until: string | null; ultima_msg: string | null; ultima_msg_at: string | null;
      ultima_direcao: string | null; ultima_tipo: string | null; responsavel_id: string | null;
      responsavel_nome: string | null; sessao_id: string | null; sessao_label: string | null;
      sessao_fone: string | null; lead_id: string | null;
    }>(sql`
      SELECT c.id::text, c.nome, c.telefone, c.email, c.nao_lidas, c.status,
             c.snoozed_until::text,
             -- A última mensagem do HISTÓRICO manda; o resumo em contatos fica de
             -- reserva. 43 contatos têm mensagem 'in' e ultima_msg_at nulo — sem
             -- isto saíam da fila (NA FILA dava 255 em vez de 298).
             -- Mídia sem legenda não herda o resumo de contatos ("[image]" do worker): fica
             -- nulo e a tela escreve o rótulo do tipo ("Imagem", "Documento", "Áudio").
             CASE WHEN um.tipo IS NOT NULL AND um.tipo <> 'text' AND COALESCE(um.conteudo, '') = '' THEN NULL
                  ELSE COALESCE(NULLIF(um.conteudo, ''), c.ultima_msg) END AS ultima_msg,
             COALESCE(um.created_at, c.ultima_msg_at)::text AS ultima_msg_at,
             um.direcao AS ultima_direcao, um.tipo AS ultima_tipo,
             c.responsavel_id::text, u.nome AS responsavel_nome,
             c.sessao_id::text, btrim(s.label) AS sessao_label,
             split_part(s.phone_number, ':', 1) AS sessao_fone,
             c.lead_id::text
        FROM contatos c
        LEFT JOIN usuarios u ON u.id = c.responsavel_id
        LEFT JOIN whatsapp_sessao s ON s.id = c.sessao_id
        LEFT JOIN LATERAL (
          SELECT direcao, tipo, conteudo, created_at FROM whatsapp_mensagens m
           WHERE m.contato_id = c.id
           ORDER BY m.created_at DESC LIMIT 1
        ) um ON TRUE
       WHERE c.organizacao_id = ${org} AND c.canal = 'whatsapp' AND ${acesso}
       ORDER BY COALESCE(um.created_at, c.ultima_msg_at) DESC NULLS LAST`),
    db.execute<{
      id: string; nome: string; sobrenome: string | null; cargo: string | null; empresa: string | null;
      empresa_id: string | null; setor: string | null; telefone: string | null; email: string | null;
      etapa: string | null; origem: string | null; campanha: string | null; interesse: string | null;
      responsavel_nome: string | null; tem_empresa: boolean;
    }>(sql`
      SELECT l.id::text, l.nome, l.sobrenome, l.cargo,
             COALESCE(e.nome, l.empresa) AS empresa, l.empresa_id::text,
             COALESCE(e.setor, l.empresa_setor) AS setor,
             l.telefone, l.email, l.estagio_pre_vendas AS etapa, l.origem,
             l.utm_campaign AS campanha, array_to_string(l.servicos_interesse, ', ') AS interesse,
             u.nome AS responsavel_nome, (l.empresa_id IS NOT NULL) AS tem_empresa
        FROM leads l
        LEFT JOIN empresas e ON e.id = l.empresa_id
        LEFT JOIN usuarios u ON u.id = l.responsavel_id
       WHERE l.organizacao_id = ${org}
         AND (l.telefone IS NOT NULL OR l.id IN (SELECT lead_id FROM contatos WHERE organizacao_id = ${org} AND lead_id IS NOT NULL))
       ORDER BY (l.empresa_id IS NULL) ASC, l.updated_at DESC`),
    // Destino de transferência: quem está ativo na organização, não só quem já tem conversa.
    db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM usuarios WHERE organizacao_id = ${org} AND ativo ORDER BY nome`),
    /* Os números DA PESSOA, não os da organização.
       O seletor de caixa listava os 8 números da empresa. O conteúdo nunca
       vazou — `acesso` acima já barra conversa alheia — mas o rótulo e o
       TELEFONE dos colegas apareciam, e escolher a caixa de outro abria uma
       lista vazia. A mesma regra da query de conversas, aplicada aqui.
       Sessão sem dono é compartilhada da organização e continua visível. */
    db.execute<{ id: string; label: string; fone: string | null }>(sql`
      SELECT id::text, btrim(label) AS label, NULLIF(split_part(phone_number, ':', 1), '') AS fone
        FROM whatsapp_sessao
       WHERE organizacao_id = ${org}
         AND ${escopo === "equipe" ? sql`TRUE` : sql`(usuario_id = ${ctx.userId} OR usuario_id IS NULL)`}
       ORDER BY label`),
    db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM labels WHERE organizacao_id = ${org} ORDER BY nome`),
    db.execute<{ contato_id: string; nome: string }>(sql`
      SELECT cl.contato_id::text, l.nome
        FROM contato_labels cl
        JOIN labels l ON l.id = cl.label_id
        JOIN contatos c ON c.id = cl.contato_id
       WHERE c.organizacao_id = ${org}`),
    db.execute<{ id: string; nome: string; categoria: string; conteudo: string }>(sql`
      SELECT id::text, nome, categoria, conteudo FROM whatsapp_templates
       WHERE organizacao_id = ${org} AND ativo ORDER BY categoria, nome`),
    db.execute<{ nome: string }>(sql`SELECT nome FROM usuarios WHERE id = ${ctx.userId}`),
    /* Carga de cada pessoa, sem escopo de "Minhas": a lista da tela só tem as MINHAS conversas, e
       contar nela mostrava "0 conversas abertas" para quem tem centenas. Só números, nenhuma conversa. */
    db.execute<{ nome: string; n: number }>(sql`
      SELECT u.nome, count(*)::int AS n FROM contatos c JOIN usuarios u ON u.id = c.responsavel_id
       WHERE c.organizacao_id = ${org} AND c.canal = 'whatsapp' AND c.status = 'open' GROUP BY u.nome`),
    /* "1ª RESP. MÉDIA" — o protótipo escrevia "3m 40s" fixo.
       Turno do cliente = mensagem 'in' cuja anterior NÃO é 'in' (rajada de três
       mensagens seguidas é um pedido só). Resposta = primeiro 'out' depois dela.
       Média simples nos últimos 30 dias, com a mesma regra de acesso da lista.
       É média e não mediana porque o rótulo diz MÉDIA; madrugada pesa, e pesa
       porque o cliente de fato esperou. Chamada de voz ('call') fica fora. */
    db.execute<{ media: string | null; n: number }>(sql`
      WITH m AS (
        SELECT wm.contato_id, wm.direcao, wm.created_at,
               lag(wm.direcao) OVER (PARTITION BY wm.contato_id ORDER BY wm.created_at) AS dir_ant
          FROM whatsapp_mensagens wm
          JOIN contatos c ON c.id = wm.contato_id
         WHERE c.organizacao_id = ${org} AND c.canal = 'whatsapp' AND ${acesso}
           AND wm.created_at >= now() - interval '30 days' AND wm.tipo <> 'call'
      ), turnos AS (
        SELECT contato_id, created_at AS inicio FROM m
         WHERE direcao = 'in' AND (dir_ant IS NULL OR dir_ant <> 'in')
      )
      SELECT avg(EXTRACT(EPOCH FROM (r.prox - t.inicio)))::text AS media, count(r.prox)::int AS n
        FROM turnos t
        CROSS JOIN LATERAL (
          SELECT min(o.created_at) AS prox FROM whatsapp_mensagens o
           WHERE o.contato_id = t.contato_id AND o.direcao = 'out' AND o.created_at > t.inicio
        ) r
       WHERE r.prox IS NOT NULL`),
  ]);

  /* Só 25 dos 1.731 contatos têm lead_id. O inbox atual casa o resto pelo
     telefone (últimos 8 dígitos, preferindo o lead com empresa e o mais
     recente) — mesmo critério aqui, para a tela não dizer "sem cadastro" de
     quem está no CRM. Só leitura: nunca grava lead_id de volta. */
  const leadPorId = new Map<string, (typeof leadsTel)[number]>();
  const leadPorTelefone = new Map<string, string>();
  for (const l of leadsTel) {
    leadPorId.set(l.id, l);
    const k = ultimosDigitos(l.telefone);
    if (k && !leadPorTelefone.has(k)) leadPorTelefone.set(k, l.id);
  }

  const lista: ConversaAtendimento[] = conversas.map((r) => ({
    id: r.id,
    nome: r.nome,
    telefone: r.telefone,
    email: r.email,
    naoLidas: r.nao_lidas ?? 0,
    status: r.status,
    snoozedUntil: r.snoozed_until,
    ultimaMsg: r.ultima_msg,
    ultimaMsgAt: r.ultima_msg_at,
    ultimaDirecao: r.ultima_direcao,
    ultimaTipo: r.ultima_tipo,
    responsavelId: r.responsavel_id,
    responsavelNome: r.responsavel_nome,
    sessaoId: r.sessao_id,
    sessaoLabel: r.sessao_label,
    sessaoFone: r.sessao_fone,
    leadId: (r.lead_id && leadPorId.has(r.lead_id) ? r.lead_id : null)
      ?? leadPorTelefone.get(ultimosDigitos(r.telefone) ?? "") ?? null,
  }));

  const usados = new Set(lista.map((c) => c.leadId).filter(Boolean) as string[]);
  const leads: LeadAtendimento[] = [...usados].map((id) => {
    const l = leadPorId.get(id)!;
    return {
      id: l.id,
      nome: nomeCompleto(l.nome, l.sobrenome),
      cargo: l.cargo, empresa: l.empresa, empresaId: l.empresa_id, setor: l.setor,
      telefone: l.telefone, email: l.email, etapa: l.etapa, origem: l.origem,
      campanha: l.campanha, interesse: l.interesse || null, responsavelNome: l.responsavel_nome,
    };
  });

  const tagsPorContato: Record<string, string[]> = {};
  for (const t of tags) (tagsPorContato[t.contato_id] ??= []).push(t.nome);

  const media = resp[0]?.media != null ? Number(resp[0].media) : null;

  return {
    eu: { id: ctx.userId, nome: eu[0]?.nome ?? "" },
    escopo,
    podeVerEquipe,
    conversas: lista,
    leads,
    equipe: [...equipe],
    cargaEquipe: Object.fromEntries(carga.map((r) => [r.nome, r.n])),
    sessoes: [...sessoes],
    labels: [...labels],
    tagsPorContato,
    templates: [...templates],
    primeiraRespostaMediaSeg: media != null && Number.isFinite(media) ? media : null,
    primeiraRespostaAmostra: resp[0]?.n ?? 0,
  };
}
