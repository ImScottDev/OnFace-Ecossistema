/**
 * Ponte de escrita canônica — TEMPORÁRIA, com data de remoção.
 *
 * ESTA FUNÇÃO EXISTE PARA MORRER. Ela é o dual-write da fase de cutover, e o
 * SPEC §56 proíbe dual-write como estado final. Some na fase 25 (desligar
 * escrita legada), quando os leitores já estiverem no modelo canônico.
 *
 * Por que ela existe agora: as telas ainda leem `leads` e `negocios`. Se a
 * entrada passasse a escrever SÓ no modelo canônico hoje, o lead sumiria da
 * tela de pré-vendas no mesmo instante. Então a escrita legada continua, e esta
 * ponte garante que o canônico receba o mesmo fato.
 *
 * Ordem: o legado já foi escrito pelo chamador; aqui o canônico é garantido.
 * Falha da ponte NUNCA derruba a entrada: perder um lead de campanha paga é
 * pior que ficar com o canônico atrasado, e o backfill reconcilia depois.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { registrarEntrada, type EntradaAquisicao } from "@onface/acquisition";
import { resolverPessoa } from "@onface/identity";
import { criarRepositorioAquisicao } from "@onface/platform-database";
import { publicarEvento } from "@onface/platform-events";

export interface ResultadoPonte {
  ok: boolean;
  aquisicaoId?: string;
  pessoaId?: string | null;
  empresaId?: string | null;
  criada?: boolean;
  semDono?: boolean;
  erro?: string;
}

/**
 * Garante que a entrada externa exista no modelo canônico.
 *
 * `leadLegadoId` liga o registro canônico ao lead que o chamador acabou de
 * criar, para a reconciliação saber que são o mesmo fato.
 */
export async function garantirEntradaCanonica(
  entrada: EntradaAquisicao,
  leadLegadoId?: string | null,
): Promise<ResultadoPonte> {
  try {
    const resultado = await db.transaction(async (tx) => {
      const repo = criarRepositorioAquisicao(tx as never, sql as never);
      const r = await registrarEntrada(repo, entrada);
      if (!r.ok) return { ok: false, erro: r.erro };

      if (r.criada) {
        // Evento + outbox na mesma transação da escrita canônica. É o que a
        // escrita legada nunca fez, e por isso 569 ganhos renderam 33 eventos.
        await publicarEvento(tx as never, sql as never, {
          organizacaoId: entrada.organizacaoId,
          eventType: "AcquisitionCreated",
          aggregateType: "aquisicao",
          aggregateId: r.aquisicaoId,
          actorType: "INTEGRATION",
          source: entrada.provider ?? entrada.origem ?? "webhook",
          idempotencyKey: entrada.idempotencyKey ?? `aquisicao:${r.aquisicaoId}`,
          payload: {
            tipo: entrada.tipo, origem: entrada.origem,
            pessoa_id: r.pessoaId, empresa_id: r.empresaId,
            lead_legado_id: leadLegadoId ?? null, sem_dono: r.semDono,
          },
          entregarExternamente: true,
        });
      }

      if (leadLegadoId) {
        await tx.execute(sql`
          INSERT INTO backfill_provenance (organizacao_id, fase, entidade_canonica, id_canonico, tabela_origem, id_origem, chave_identidade, metodo)
          VALUES (${entrada.organizacaoId}::uuid, 'runtime', 'aquisicao', ${r.aquisicaoId}::uuid, 'leads', ${leadLegadoId}::text, ${`lead:${leadLegadoId}`}, 'PONTE_CUTOVER')
          ON CONFLICT (entidade_canonica, tabela_origem, id_origem) DO NOTHING`);
      }

      return { ok: true, aquisicaoId: r.aquisicaoId, pessoaId: r.pessoaId, empresaId: r.empresaId, criada: r.criada, semDono: r.semDono };
    });
    return resultado as ResultadoPonte;
  } catch (e) {
    // Best-effort de propósito: ver o comentário do topo.
    console.error("[ponte-canonica] falhou; a entrada legada seguiu normalmente:", e);
    return { ok: false, erro: String(e) };
  }
}

/**
 * Garante só a IDENTIDADE canônica de um contato, sem abrir aquisição.
 *
 * Um contato de WhatsApp que aparece não é, por si, um processo de aquisição:
 * pode ser cliente ativo mandando mensagem, cobrança respondendo, suporte. Se
 * cada mensagem abrisse aquisição, o funil inflaria com 25.363 processos que
 * ninguém vendeu — exatamente o tipo de dado sujo que este refactor existe
 * para acabar.
 *
 * Mas a PESSOA precisa existir no canônico: é o que liga a conversa à timeline
 * (SPEC §6 e §22). Então aqui se resolve a identidade e nada mais. Quem abre
 * aquisição é o momento em que o contato vira lead — e aquele caminho já passa
 * por `garantirEntradaCanonica`.
 *
 * Também é best-effort: falhar aqui não pode derrubar o recebimento da
 * mensagem.
 */
export async function garantirPessoaDeContato(
  organizacaoId: string,
  dados: { nome?: string | null; email?: string | null; telefone?: string | null },
): Promise<{ ok: boolean; pessoaId?: string; criada?: boolean; erro?: string }> {
  try {
    return await db.transaction(async (tx) => {
      const repo = criarRepositorioAquisicao(tx as never, sql as never);
      const r = await resolverPessoa(repo, organizacaoId, dados);
      if (r.achou) return { ok: true, pessoaId: r.pessoaId, criada: false };
      if (r.motivo === "SEM_IDENTIFICADOR") return { ok: false, erro: "SEM_IDENTIFICADOR" };
      const pessoaId = await repo.criarPessoa(organizacaoId, dados, null);
      return { ok: true, pessoaId, criada: true };
    });
  } catch (e) {
    console.error("[ponte-canonica] identidade de contato falhou; a mensagem seguiu:", e);
    return { ok: false, erro: String(e) };
  }
}
