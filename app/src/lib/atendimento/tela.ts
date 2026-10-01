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
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { veTodasAsConversas } from "@/lib/whatsapp/acesso";

type Ctx = {
  organizacaoId: string;
  userId: string;
  userRole?: string | null;
  realRole?: string | null;
};

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
  conversas: ConversaAtendimento[];
  leads: LeadAtendimento[];
  equipe: Array<{ id: string; nome: string }>;
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

export async function paginaDeAtendimento(ctx: Ctx): Promise<DadosAtendimento> {
  const org = ctx.organizacaoId;
  /* Conversa de WhatsApp é dado pessoal (decisão Kauã 09/09, lib/whatsapp/acesso):
     só super_admin vê tudo; o resto vê as suas e as sem dono. A mesma regra
     vale para TODOS os números da tela — métrica que conta conversa alheia
     seria vazamento disfarçado de total. */
  const acesso = veTodasAsConversas(ctx)
    ? sql`TRUE`
    : sql`(c.responsavel_id = ${ctx.userId} OR c.responsavel_id IS NULL)`;

  const [conversas, leadsTel, equipe, sessoes, labels, tags, templates, eu, resp] = await Promise.all([
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
             COALESCE(NULLIF(um.conteudo, ''), c.ultima_msg) AS ultima_msg,
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
    db.execute<{ id: string; label: string; fone: string | null }>(sql`
      SELECT id::text, btrim(label) AS label, NULLIF(split_part(phone_number, ':', 1), '') AS fone
        FROM whatsapp_sessao WHERE organizacao_id = ${org} ORDER BY label`),
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
      nome: [l.nome, l.sobrenome].filter(Boolean).join(" "),
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
    conversas: lista,
    leads,
    equipe: [...equipe],
    sessoes: [...sessoes],
    labels: [...labels],
    tagsPorContato,
    templates: [...templates],
    primeiraRespostaMediaSeg: media != null && Number.isFinite(media) ? media : null,
    primeiraRespostaAmostra: resp[0]?.n ?? 0,
  };
}
