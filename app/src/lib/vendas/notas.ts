/**
 * Nota escrita por gente, na linha do tempo.
 *
 * Até aqui "nota" só existia como registro do sistema ("Lead qualificado",
 * "Responsável alterado"): não havia por onde alguém escrever a própria. Quem
 * precisava anotar o que ouviu na ligação tinha de abrir a oportunidade e
 * criar uma TAREFA, o que deixa um item pendente para sempre no Foco de hoje
 * de alguém — a nota não tem o que concluir.
 *
 * Porta ÚNICA: Pré-vendas, Pipeline, drawer e ficha chamam esta função. Ela
 * grava o mesmo evento com o mesmo espelho em `atividades` que o resto do
 * módulo já usa, então a nota aparece na linha do tempo de todas as
 * superfícies sem ninguém escrever uma segunda vez.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { registrarEvento } from "./eventos";
import { RegraDeNegocio, type Ator } from "./dominio";

/** Nota curta demais não é nota, e nota gigante não cabe na linha do tempo. */
const LIMITE = 4000;

/** Cada alvo informado existe NESTA organização, ou a nota não é gravada. */
async function exigirDaOrganizacao(
  organizacaoId: string,
  alvos: Record<"leads" | "negocios" | "empresas", string | null | undefined>,
): Promise<void> {
  for (const [tabela, id] of Object.entries(alvos)) {
    if (!id) continue;
    const [linha] = await db.execute<{ existe: boolean }>(sql`
      SELECT true AS existe FROM ${sql.raw(tabela)}
       WHERE id = ${id}::uuid AND organizacao_id = ${organizacaoId}::uuid LIMIT 1`);
    if (!linha) throw new RegraDeNegocio("nota_alvo_invalido", "Registro não encontrado nesta organização.");
  }
}

export async function registrarNota(params: {
  organizacaoId: string;
  ator: Ator;
  texto: string;
  leadId?: string | null;
  negocioId?: string | null;
  empresaId?: string | null;
}): Promise<void> {
  const texto = params.texto.trim();
  if (!texto) throw new RegraDeNegocio("nota_vazia", "Escreva a nota antes de salvar.");
  if (texto.length > LIMITE) throw new RegraDeNegocio("nota_longa", `A nota passa de ${LIMITE} caracteres.`);
  // Sem alvo a nota não tem onde aparecer, e gravá-la seria perdê-la em silêncio.
  if (!params.leadId && !params.negocioId && !params.empresaId) {
    throw new RegraDeNegocio("nota_sem_alvo", "A nota precisa de um lead, uma oportunidade ou uma empresa.");
  }

  /* O id do alvo vem do cliente; a organização vem da sessão. Conferir que
     um pertence à outra é o que impede escrever na linha do tempo de outro
     tenant mandando um id adivinhado. */
  await exigirDaOrganizacao(params.organizacaoId, {
    leads: params.leadId, negocios: params.negocioId, empresas: params.empresaId,
  });

  /* O título é a primeira linha; o resto vira descrição. É o que faz a nota
     caber na linha do tempo (que mostra o título) sem perder o corpo. */
  const [primeira, ...resto] = texto.split("\n");
  const titulo = primeira.length > 120 ? `${primeira.slice(0, 117)}...` : primeira;
  const descricao = resto.join("\n").trim() || (titulo === texto ? null : texto);

  await registrarEvento({
    organizacaoId: params.organizacaoId,
    tipo: "NoteAdded",
    ator: params.ator,
    leadId: params.leadId ?? null,
    negocioId: params.negocioId ?? null,
    empresaId: params.empresaId ?? null,
    contexto: { texto },
    timeline: { tipo: "nota", titulo, descricao },
  });
}
