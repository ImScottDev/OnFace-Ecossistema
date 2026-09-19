/**
 * Aceite do Módulo 01 — Vendas contra o banco real.
 *
 * Roda as jornadas dos critérios de aceite da SpecDrive de ponta a ponta,
 * conferindo o estado persistido depois de cada passo. Não é teste unitário:
 * é a pergunta "isso funciona de verdade no banco?", que `tsc` e `next build`
 * não têm como responder.
 *
 * Tudo que ele cria carrega o prefixo de `MARCA` e é removido no fim, mesmo
 * quando algum passo falha. Rodar duas vezes seguidas dá o mesmo resultado.
 *
 * Uso: npx tsx --env-file=.env src/scripts/aceite-vendas.ts
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { atorHumano, RegraDeNegocio, type Ator } from "@/lib/vendas/dominio";
import * as preVendas from "@/lib/vendas/pre-vendas";
import * as pipeline from "@/lib/vendas/pipeline";
import * as propostasMotor from "@/lib/vendas/propostas";
import * as prospeccao from "@/lib/vendas/prospeccao";
import { criarPropostaComItens } from "@/lib/crm/proposta-criacao";
// O aceite exercita o caminho REAL da página pública, não um atalho: é ele que
// roda em produção quando o cliente responde.
import { solicitarAjustePropostaPublica } from "@/lib/crm/proposta-publica";
import { processarAceiteDaProposta } from "@/lib/crm/proposta-aceite";
import { propostas as tabelaPropostas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { diretorioPessoas, empresa360 } from "@/lib/vendas/consultas";

const MARCA = "[ACEITE-VENDAS]";

let passou = 0;
let falhou = 0;

function ok(titulo: string, condicao: boolean, detalhe?: string) {
  if (condicao) {
    passou += 1;
    console.log(`  ✔ ${titulo}`);
  } else {
    falhou += 1;
    console.log(`  ✘ ${titulo}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

/** Espera que o comando seja BLOQUEADO por uma regra de negócio específica. */
async function esperaBloqueio(titulo: string, codigo: string, executar: () => Promise<unknown>) {
  try {
    await executar();
    ok(titulo, false, "o comando passou quando deveria ter sido bloqueado");
  } catch (erro) {
    if (erro instanceof RegraDeNegocio && erro.codigo === codigo) ok(titulo, true);
    else ok(titulo, false, `erro inesperado: ${(erro as Error).message}`);
  }
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes ORDER BY created_at LIMIT 1`);
  if (!org) throw new Error("nenhuma organização no banco");
  const [usuario] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM usuarios WHERE organizacao_id = ${org.id}::uuid AND ativo = true LIMIT 1
  `);
  if (!usuario) throw new Error("nenhum usuário ativo na organização");

  const ator: Ator = atorHumano(usuario.id);
  const sufixo = Date.now().toString(36);

  try {
    /* ── Jornada inbound (critérios de aceite do Módulo) ──────────────── */
    console.log("\n── Jornada inbound: Empresa/Pessoa → Lead → Qualificado → Oportunidade");

    const lead = await preVendas.criarLead({
      organizacaoId: org.id,
      empresa: {
        nome: `${MARCA} NovaTech ${sufixo}`,
        cnpj: `11${sufixo.padEnd(12, "0").slice(0, 12)}`,
        website: `https://novatech-${sufixo}.com.br`,
      },
      pessoa: {
        nome: "Rafael", sobrenome: "Lima", cargo: "Head de Operações",
        email: `rafael.${sufixo}@novatech-${sufixo}.com.br`,
        // Telefone único por execução: com número fixo, a deduplicação por
        // telefone reconheceria a pessoa da execução ANTERIOR — que é o
        // comportamento correto dela e um dado de teste errado aqui.
        telefone: `119${Date.now().toString().slice(-8)}`,
      },
      touchpoint: {
        tipoOrigem: "campanha", source: "meta", medium: "paid",
        campaign: "SaaS Setembro", landingPage: "https://callface.io/lp",
      },
      origem: "Meta Ads",
    }, ator);

    ok("Empresa e Pessoa resolvidas na entrada", Boolean(lead.empresaId && lead.pessoaId));
    if (!lead.empresaId) throw new Error("lead do aceite nasceu sem empresa");

    const [estadoInicial] = await db.execute<{ etapa: string; utm: string | null }>(sql`
      SELECT estagio_pre_vendas AS etapa, utm_campaign AS utm FROM leads WHERE id = ${lead.leadId}::uuid
    `);
    ok("Lead nasce em Novo", estadoInicial?.etapa === "novo", estadoInicial?.etapa);
    ok("Origem preservada no Lead", estadoInicial?.utm === "SaaS Setembro");

    const [touch] = await db.execute<{ n: number; first: boolean }>(sql`
      SELECT count(*)::int AS n, bool_or(is_first_touch) AS first FROM pontos_contato
       WHERE empresa_id = ${lead.empresaId}::uuid
    `);
    ok("Touchpoint gravado como primeiro toque", (touch?.n ?? 0) > 0 && touch?.first === true);

    // Proibição explícita da spec: inbound não cria oportunidade.
    const [oportunidadesDoLead] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM negocios WHERE lead_id = ${lead.leadId}::uuid
    `);
    ok("Inbound NÃO criou oportunidade automaticamente", (oportunidadesDoLead?.n ?? 0) === 0);
    const [atividadeInbound] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM tarefas
       WHERE lead_id = ${lead.leadId}::uuid
         AND motivo = 'primeiro_contato_inbound'
         AND status = 'a_fazer'
    `);
    ok("Inbound gera atividade de primeiro contato", (atividadeInbound?.n ?? 0) === 1);

    // Deduplicação: mesma empresa e mesma pessoa, segundo lead.
    const lead2 = await preVendas.criarLead({
      organizacaoId: org.id,
      empresa: { nome: `${MARCA} NovaTech ${sufixo} LTDA`, website: `www.novatech-${sufixo}.com.br/contato` },
      pessoa: { nome: "Rafael", email: `rafael.${sufixo}@novatech-${sufixo}.com.br` },
      touchpoint: { tipoOrigem: "indicacao", source: "indicacao" },
    }, ator);
    ok("Empresa não duplicada (resolvida por domínio)", lead2.empresaId === lead.empresaId);
    ok("Pessoa não duplicada (resolvida por e-mail)", lead2.pessoaId === lead.pessoaId);
    ok("Mesma Empresa pode ter mais de um Lead", lead2.leadId !== lead.leadId);

    await preVendas.registrarPrimeiroContato({
      organizacaoId: org.id, leadId: lead.leadId, canal: "whatsapp", ator,
    });
    const [aposContato] = await db.execute<{ etapa: string; pc: string | null }>(sql`
      SELECT estagio_pre_vendas AS etapa, primeiro_contato_at::text AS pc FROM leads WHERE id = ${lead.leadId}::uuid
    `);
    ok("Primeiro contato registrado e Lead em Em contato",
      Boolean(aposContato?.pc) && aposContato?.etapa === "em_contato", aposContato?.etapa);
    const [atividadeConcluida] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM tarefas
       WHERE lead_id = ${lead.leadId}::uuid
         AND motivo = 'primeiro_contato_inbound'
         AND status = 'concluida'
         AND concluida = true
    `);
    ok("Primeiro contato conclui a atividade de entrada", (atividadeConcluida?.n ?? 0) === 1);

    await preVendas.moverEtapa({ organizacaoId: org.id, leadId: lead.leadId, para: "qualificacao", ator });
    await preVendas.salvarQualificacao({
      organizacaoId: org.id, leadId: lead.leadId, ator,
      qualificacao: { dor: "Perde ligação", urgencia: "alta", decisor: "Rafael", budget: "R$ 2k/mês" },
    });

    await esperaBloqueio(
      "Qualificado não é alcançável por arrastar o card", "qualificacao_exige_comando",
      () => preVendas.moverEtapa({ organizacaoId: org.id, leadId: lead.leadId, para: "qualificado", ator }),
    );

    await preVendas.qualificar({ organizacaoId: org.id, leadId: lead.leadId, ator });
    const [aposQualificar] = await db.execute<{
      etapa: string; qualificado: boolean; quando: string | null; tipo: string | null; q: Record<string, unknown> | null;
    }>(sql`
      SELECT estagio_pre_vendas AS etapa, qualificado, qualificado_em::text AS quando,
             qualificado_por_tipo AS tipo, qualificacao AS q
        FROM leads WHERE id = ${lead.leadId}::uuid
    `);
    ok("Lead qualificado com fato histórico",
      aposQualificar?.qualificado === true && Boolean(aposQualificar?.quando) && aposQualificar?.tipo === "HUMAN");
    ok("Dados de qualificação persistidos",
      (aposQualificar?.q as { dor?: string } | null)?.dor === "Perde ligação");

    const [semOportunidade] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM negocios WHERE lead_id = ${lead.leadId}::uuid
    `);
    ok("Qualificado NÃO criou oportunidade automaticamente", (semOportunidade?.n ?? 0) === 0);

    /* ── Criação de oportunidade ──────────────────────────────────────── */
    console.log("\n── Oportunidade: família pode ser definida depois, sem reunião, etapa Entrada");

    const semFamilia = await pipeline.criarOportunidade({
      organizacaoId: org.id, empresaId: lead.empresaId, familias: [],
      responsavelId: usuario.id, sourceProcess: "MANUAL",
    }, ator);
    const [opSemFamilia] = await db.execute<{ etapa: string; familia: string | null }>(sql`
      SELECT etapa, service_family AS familia FROM negocios WHERE id = ${semFamilia.oportunidades[0].id}::uuid
    `);
    ok("Oportunidade pode nascer sem família em Entrada",
      opSemFamilia?.etapa === "entrada" && opSemFamilia?.familia === null,
      `${opSemFamilia?.etapa ?? "sem etapa"} / ${opSemFamilia?.familia ?? "sem família"}`);
    await esperaBloqueio(
      "Oportunidade sem família não entra em Proposta", "etapa_exige_familia",
      () => pipeline.moverEtapa({
        organizacaoId: org.id, negocioId: semFamilia.oportunidades[0].id, para: "proposta", ator,
      }),
    );
    await esperaBloqueio(
      "Oportunidade sem família não cria proposta por chamada direta", "proposta_exige_familia",
      () => criarPropostaComItens({
        organizacaoId: org.id, leadId: lead.leadId, negocioId: semFamilia.oportunidades[0].id,
        moeda: "BRL", itens: [], criadoPorId: usuario.id,
      }),
    );
    await esperaBloqueio(
      "Oportunidade sem família não pode ser ganha", "ganho_exige_familia",
      () => pipeline.tentarGanhar({
        organizacaoId: org.id, negocioId: semFamilia.oportunidades[0].id, ator,
      }),
    );

    const criada = await pipeline.criarOportunidadeDoLead({
      organizacaoId: org.id, leadId: lead.leadId, familias: ["CALLFACE_AI"],
      responsavelId: usuario.id, ator,
    });
    const negocioId = criada.oportunidades[0].id;

    const [op] = await db.execute<{
      etapa: string; status: string; familia: string; empresa: string | null; sp: string | null; titulo: string;
    }>(sql`
      SELECT etapa, status, service_family AS familia, empresa_id::text AS empresa,
             source_process AS sp, titulo
        FROM negocios WHERE id = ${negocioId}::uuid
    `);
    ok("Oportunidade nasce em Entrada mesmo sem reunião", op?.etapa === "entrada", op?.etapa);
    ok("Família gravada na oportunidade", op?.familia === "CALLFACE_AI");
    ok("Empresa obrigatória presente", op?.empresa === lead.empresaId);
    ok("Processo de origem é Pré-vendas", op?.sp === "PRE_SALES");
    ok("Título gerado como {Empresa} — {Família}", op?.titulo.endsWith("— Callface AI"), op?.titulo);

    const [leadEspelho] = await db.execute<{ etapa: string; qualificado: boolean }>(sql`
      SELECT estagio_pre_vendas AS etapa, qualificado FROM leads WHERE id = ${lead.leadId}::uuid
    `);
    ok("Lead aparece como Oportunidade em Pré-vendas", leadEspelho?.etapa === "oportunidade");
    ok("Fato Qualificado sobrevive à mudança de etapa", leadEspelho?.qualificado === true);

    /* ── Gates de etapa ───────────────────────────────────────────────── */
    console.log("\n── Gates do Pipeline");

    await pipeline.moverEtapa({ organizacaoId: org.id, negocioId, para: "diagnostico", ator });
    const [emDiagnostico] = await db.execute<{ etapa: string; status: string }>(sql`
      SELECT etapa, status FROM negocios WHERE id = ${negocioId}::uuid
    `);
    ok("Movimento para Diagnóstico persiste", emDiagnostico?.etapa === "diagnostico");
    ok("Status legado acompanha a etapa", emDiagnostico?.status === "reuniao_realizada");

    const [historico] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM status_changes WHERE negocio_id = ${negocioId}::uuid
    `);
    ok("Mudança de etapa gera histórico", (historico?.n ?? 0) >= 2);

    await esperaBloqueio(
      "Proposta sem proposta vinculada é bloqueada", "etapa_exige_proposta",
      () => pipeline.moverEtapa({ organizacaoId: org.id, negocioId, para: "proposta", ator }),
    );
    await esperaBloqueio(
      "Negociação sem proposta vinculada é bloqueada", "etapa_exige_proposta",
      () => pipeline.moverEtapa({ organizacaoId: org.id, negocioId, para: "negociacao", ator }),
    );

    /* ── No-show ──────────────────────────────────────────────────────── */
    console.log("\n── No-show: evento, não etapa, e sem segunda oportunidade");

    const reuniao = await pipeline.agendarReuniao({
      organizacaoId: org.id, negocioId, data: new Date(Date.now() + 86400000).toISOString(), ator,
    });
    await pipeline.registrarNoShow({ organizacaoId: org.id, negocioId, reuniaoId: reuniao.reuniaoId, ator });

    const [aposNoShow] = await db.execute<{ etapa: string; ns: string | null; contagem: number }>(sql`
      SELECT etapa, no_show_em::text AS ns, no_show_contagem AS contagem FROM negocios WHERE id = ${negocioId}::uuid
    `);
    ok("No-show preserva a etapa da oportunidade", aposNoShow?.etapa === "diagnostico", aposNoShow?.etapa);
    ok("No-show registrado no card", Boolean(aposNoShow?.ns) && aposNoShow?.contagem === 1);

    const [leadAposNoShow] = await db.execute<{ etapa: string }>(sql`
      SELECT estagio_pre_vendas AS etapa FROM leads WHERE id = ${lead.leadId}::uuid
    `);
    ok("Lead volta para Qualificado após no-show", leadAposNoShow?.etapa === "qualificado", leadAposNoShow?.etapa);

    const [contagemOps] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM negocios WHERE lead_id = ${lead.leadId}::uuid
    `);
    ok("No-show NÃO criou segunda oportunidade", (contagemOps?.n ?? 0) === 1);

    await pipeline.reagendarAposNoShow({
      organizacaoId: org.id, negocioId, data: new Date(Date.now() + 172800000).toISOString(), ator,
    });
    const [aposReagendar] = await db.execute<{ n: number; ns: string | null }>(sql`
      SELECT (SELECT count(*)::int FROM negocios WHERE lead_id = ${lead.leadId}::uuid) AS n,
             no_show_em::text AS ns FROM negocios WHERE id = ${negocioId}::uuid
    `);
    ok("Reagendamento reutiliza a MESMA oportunidade", aposReagendar?.n === 1 && !aposReagendar?.ns);

    /* ── Multi-família ────────────────────────────────────────────────── */
    console.log("\n── Multi-família: duas oportunidades irmãs, mesmo bundle");

    const multi = await pipeline.criarOportunidade({
      organizacaoId: org.id, empresaId: lead.empresaId,
      familias: ["CALLFACE_AI", "PABX"], responsavelId: usuario.id, sourceProcess: "MANUAL",
    }, ator);
    ok("Duas famílias criam duas oportunidades", multi.oportunidades.length === 2);
    ok("Oportunidades irmãs compartilham bundle", Boolean(multi.bundleId));

    const familias = multi.oportunidades.map((o) => o.familia).sort();
    ok("Cada oportunidade pertence a uma única família",
      familias.join(",") === "CALLFACE_AI,PABX", familias.join(","));

    // Fechamento independente: perder uma não mexe na irmã.
    await pipeline.perder({
      organizacaoId: org.id, negocioId: multi.oportunidades[1].id, motivo: "preco", ator,
    });
    const [irma] = await db.execute<{ etapa: string }>(sql`
      SELECT etapa FROM negocios WHERE id = ${multi.oportunidades[0].id}::uuid
    `);
    ok("Fechamento é independente entre irmãs", irma?.etapa === "entrada", irma?.etapa);

    /* ── Perda e Ganho ────────────────────────────────────────────────── */
    console.log("\n── Perda com motivo e Ganho sem evidência");

    const [perdida] = await db.execute<{ etapa: string; chave: string | null }>(sql`
      SELECT etapa, motivo_perda_chave AS chave FROM negocios WHERE id = ${multi.oportunidades[1].id}::uuid
    `);
    ok("Perda persiste etapa e motivo estruturado",
      perdida?.etapa === "perdido" && perdida?.chave === "preco");

    const tentativa = await pipeline.tentarGanhar({ organizacaoId: org.id, negocioId, ator });
    ok("Ganho é recusado sem evidência comercial", tentativa.ganhou === false, tentativa.motivo);

    /* ── Nutrição e desqualificação ───────────────────────────────────── */
    console.log("\n── Nutrição e desqualificação exigem motivo");

    await esperaBloqueio(
      "Nutrição com motivo que exige retomada é bloqueada sem data", "nutricao_exige_retomada",
      () => preVendas.nutrir({ organizacaoId: org.id, leadId: lead2.leadId, motivo: "timing", ator }),
    );

    const daquiUmMes = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await preVendas.nutrir({
      organizacaoId: org.id, leadId: lead2.leadId, motivo: "timing", retomarEm: daquiUmMes, ator,
    });
    const [nutrido] = await db.execute<{ etapa: string; motivo: string | null; retomar: string | null; tarefas: number }>(sql`
      SELECT l.estagio_pre_vendas AS etapa, l.nutricao_motivo AS motivo, l.nutricao_retomar_em::text AS retomar,
             (SELECT count(*)::int FROM tarefas t WHERE t.lead_id = l.id) AS tarefas
        FROM leads l WHERE l.id = ${lead2.leadId}::uuid
    `);
    ok("Nutrição persiste motivo e data", nutrido?.etapa === "nutricao" && nutrido?.motivo === "timing");
    ok("Nutrição com data cria a retomada de verdade", (nutrido?.tarefas ?? 0) >= 1);

    await preVendas.desqualificar({
      organizacaoId: org.id, leadId: lead2.leadId, motivo: "fora_icp", detalhe: "Porte muito pequeno", ator,
    });
    const [desq] = await db.execute<{ etapa: string; motivo: string | null; de: string | null }>(sql`
      SELECT estagio_pre_vendas AS etapa, desqualificacao_motivo AS motivo, desqualificado_de_etapa AS de
        FROM leads WHERE id = ${lead2.leadId}::uuid
    `);
    ok("Desqualificação persiste motivo e etapa anterior",
      desq?.etapa === "desqualificado" && desq?.motivo === "fora_icp" && desq?.de === "nutricao");

    /* ── Propostas (Bloco 03) ─────────────────────────────────────────── */
    console.log("\n── Propostas: catálogo por família, gates e versionamento");

    const catalogoAi = await propostasMotor.catalogoDaFamilia(org.id, "CALLFACE_AI");
    const catalogoPabx = await propostasMotor.catalogoDaFamilia(org.id, "PABX");
    ok("Catálogo de Callface AI só traz itens de Callface AI",
      catalogoAi.length > 0 && catalogoAi.every((i) => i.familia === "CALLFACE_AI"));
    ok("Catálogo de PABX é diferente do de Callface AI",
      catalogoPabx.length > 0 && !catalogoPabx.some((i) => catalogoAi.some((a) => a.catalogoPrecoId === i.catalogoPrecoId)));

    const itemAi = catalogoAi[0];
    const proposta = await criarPropostaComItens({
      organizacaoId: org.id, leadId: lead.leadId, negocioId, moeda: "BRL",
      itens: [{
        catalogoPrecoId: itemAi.catalogoPrecoId, nome: itemAi.nome, tipo: "recorrente",
        quantidade: 1, valorUnitario: Number(itemAi.valor), desconto: 0, descontoTipo: "percentual",
      }],
      criadoPorId: usuario.id,
    });
    const propostaId = proposta.id as string;

    // Bloco 03 §17: contrato sem dados jurídicos da empresa não envia.
    await esperaBloqueio(
      "Proposta contratual sem dados jurídicos é bloqueada", "dados_juridicos_incompletos",
      () => propostasMotor.enviarProposta({
        organizacaoId: org.id, propostaId, modoFechamento: "CONTRACT", validadeDias: 14, ator,
      }),
    );

    await propostasMotor.salvarDadosJuridicos({
      organizacaoId: org.id, empresaId: lead.empresaId, ator,
      dados: {
        razaoSocial: "NovaTech LTDA", cnpj: "11222333000199", logradouro: "Rua A",
        numero: "100", bairro: "Centro", cidade: "São Paulo", estado: "SP", cep: "01000-000",
      },
    });
    const juridicos = await propostasMotor.conferirDadosJuridicos(org.id, lead.empresaId);
    ok("Dados jurídicos preenchidos ficam na EMPRESA", juridicos.completo, juridicos.faltando.join(", "));

    await esperaBloqueio(
      "Validade fora das opções é recusada", "validade_invalida",
      () => propostasMotor.enviarProposta({
        organizacaoId: org.id, propostaId, modoFechamento: "PREPAID", validadeDias: 45, ator,
      }),
    );

    await propostasMotor.enviarProposta({
      organizacaoId: org.id, propostaId, modoFechamento: "CONTRACT",
      validadeDias: 14, tipoContratual: "NOVO_CONTRATO", ator,
    });

    const [aposEnvio] = await db.execute<{ status: string; modo: string | null; validade: string | null; etapa: string }>(sql`
      SELECT p.status, p.modo_fechamento AS modo, p.data_validade::text AS validade, n.etapa
        FROM propostas p JOIN negocios n ON n.id = p.negocio_id WHERE p.id = ${propostaId}::uuid
    `);
    ok("Proposta enviada guarda modo e validade",
      aposEnvio?.status === "enviada" && aposEnvio?.modo === "CONTRACT" && Boolean(aposEnvio?.validade));
    ok("Envio move a oportunidade para Proposta", aposEnvio?.etapa === "proposta", aposEnvio?.etapa);

    // Agora que existe proposta, o gate de Negociação libera.
    await pipeline.moverEtapa({ organizacaoId: org.id, negocioId, para: "negociacao", ator });
    const [emNegociacao] = await db.execute<{ etapa: string }>(sql`SELECT etapa FROM negocios WHERE id = ${negocioId}::uuid`);
    ok("Com proposta vinculada, Negociação libera", emNegociacao?.etapa === "negociacao");

    await esperaBloqueio(
      "Proposta já enviada não se edita", "proposta_ja_enviada",
      () => propostasMotor.enviarProposta({
        organizacaoId: org.id, propostaId, modoFechamento: "PREPAID", validadeDias: 7, ator,
      }),
    );

    const [linhaProposta] = await db.select().from(tabelaPropostas).where(eq(tabelaPropostas.id, propostaId)).limit(1);
    await solicitarAjustePropostaPublica(linhaProposta, "Reduzir o setup pela metade");
    const [comAjuste] = await db.execute<{ status: string; desc: string | null }>(sql`
      SELECT status, ajuste_solicitado_descricao AS desc FROM propostas WHERE id = ${propostaId}::uuid
    `);
    ok("Pedido de ajuste do cliente fica registrado sem alterar a proposta",
      comAjuste?.status === "ajuste_solicitado" && comAjuste?.desc === "Reduzir o setup pela metade");
    const revisao = await propostasMotor.criarRevisao({ organizacaoId: org.id, propostaId, ator });
    const [substituida] = await db.execute<{ status: string; por: string | null }>(sql`
      SELECT status, substituida_por_id::text AS por FROM propostas WHERE id = ${propostaId}::uuid
    `);
    ok("Revisão substitui a anterior", substituida?.status === "substituida" && substituida?.por === revisao.propostaId);
    ok("A revisão é a versão seguinte", revisao.versao === 2);

    const aceiteRecusado = await processarAceiteDaProposta({
      propostaId, organizacaoId: org.id, origem: "publico",
    });
    ok("Proposta substituída não pode ser aceita", aceiteRecusado.ok === false);

    // Bloco 03 §26: aceitar não é ganhar.
    await propostasMotor.enviarProposta({
      organizacaoId: org.id, propostaId: revisao.propostaId,
      modoFechamento: "CONTRACT", validadeDias: 14, ator,
    });
    const aceite = await processarAceiteDaProposta({
      propostaId: revisao.propostaId, organizacaoId: org.id, origem: "publico",
    });
    ok("Aceite do cliente é processado", aceite.ok === true, "ok" in aceite && !aceite.ok ? aceite.error : "");

    const [aposAceite] = await db.execute<{ etapa: string; status: string; aceita_em: string | null }>(sql`
      SELECT n.etapa, p.status, p.aceita_em::text FROM propostas p JOIN negocios n ON n.id = p.negocio_id
       WHERE p.id = ${revisao.propostaId}::uuid
    `);
    ok("Aceite registra a proposta como aceita", aposAceite?.status === "aceita");
    ok("Aceite grava a data no campo novo", Boolean(aposAceite?.aceita_em));
    ok("Aceite NÃO ganha a oportunidade", aposAceite?.etapa !== "ganho", aposAceite?.etapa);

    const [eventoAceite] = await db.execute<{ gate: string | null }>(sql`
      SELECT contexto->>'gatePendente' AS gate FROM vendas_eventos
       WHERE proposta_id = ${revisao.propostaId}::uuid AND tipo = 'ProposalAccepted'
       ORDER BY ocorrido_em DESC LIMIT 1
    `);
    ok("A linha do tempo diz qual gate ainda falta",
      eventoAceite?.gate === "Contrato pendente", eventoAceite?.gate ?? "sem evento");

    const composicao = await propostasMotor.composicaoDaProposta(revisao.propostaId);
    ok("Composição separa recorrente de não recorrente",
      composicao.recorrenteMensal >= 0 && composicao.naoRecorrente >= 0);
    ok("Sem prazo contratual, não se inventa TCV", composicao.tcv === null || composicao.prazoMeses !== null);

    /* ── Prospecção (Bloco 04) ────────────────────────────────────────── */
    console.log("\n── Prospecção: duas saídas distintas");

    const prospect = await prospeccao.adicionarProspect({
      organizacaoId: org.id,
      empresa: { nome: `${MARCA} Outbound ${sufixo}`, website: `outbound-${sufixo}.com.br` },
      pessoa: { nome: "Carla", sobrenome: "Souza", email: `carla.${sufixo}@outbound-${sufixo}.com.br` },
      fonte: "Apollo", lista: `${MARCA} Lista ${sufixo}`,
    }, ator);
    const [estadoProspect] = await db.execute<{ estado: string; etapa: string | null; tipo: string }>(sql`
      SELECT prospeccao_estado AS estado, estagio_pre_vendas AS etapa, tipo FROM leads WHERE id = ${prospect.leadId}::uuid
    `);
    ok("Prospect entra em Novo do outbound", estadoProspect?.estado === "novo");
    ok("Prospect NÃO nasce como lead de Pré-vendas", estadoProspect?.etapa === null && estadoProspect?.tipo === "contato");

    const repetido = await prospeccao.adicionarProspect({
      organizacaoId: org.id,
      empresa: { nome: `${MARCA} Outbound ${sufixo} S/A`, website: `www.outbound-${sufixo}.com.br` },
      fonte: "CSV", lista: `${MARCA} Outra lista ${sufixo}`,
    }, ator);
    ok("Importar de novo não duplica a empresa", repetido.empresaId === prospect.empresaId);
    ok("Importar de novo não duplica o prospect", repetido.jaExistia === true);

    await prospeccao.registrarResposta({ organizacaoId: org.id, leadId: prospect.leadId, canal: "email", ator });
    const [respondeu] = await db.execute<{ estado: string; etapa: string | null }>(sql`
      SELECT prospeccao_estado AS estado, estagio_pre_vendas AS etapa FROM leads WHERE id = ${prospect.leadId}::uuid
    `);
    ok("Responder muda o estado do outbound", respondeu?.estado === "respondeu");
    ok("Responder NÃO qualifica em Pré-vendas", respondeu?.etapa === null);

    // Saída 1: pré-qualificado entra em Pré-vendas / Novo.
    await prospeccao.preQualificar({ organizacaoId: org.id, leadId: prospect.leadId, ator });
    const [preQualificado] = await db.execute<{
      estado: string; etapa: string | null; pre: boolean; qualificado: boolean; origem: string | null;
    }>(sql`
      SELECT prospeccao_estado AS estado, estagio_pre_vendas AS etapa, pre_qualificado AS pre,
             qualificado, origem FROM leads WHERE id = ${prospect.leadId}::uuid
    `);
    ok("Pré-qualificado cria o Lead em Pré-vendas / Novo", preQualificado?.etapa === "novo");
    ok("Pré-qualificado é fato próprio", preQualificado?.pre === true);
    ok("Pré-qualificado NÃO é o Qualificado de Pré-vendas", preQualificado?.qualificado === false);
    ok("Origem outbound preservada", (preQualificado?.origem ?? "").toLowerCase() === "outbound");

    // Saída 2: oportunidade direta, em outro prospect.
    const prospect2 = await prospeccao.adicionarProspect({
      organizacaoId: org.id,
      empresa: { nome: `${MARCA} Direto ${sufixo}`, website: `direto-${sufixo}.com.br` },
      fonte: "Apollo",
    }, ator);
    const direta = await prospeccao.criarOportunidadeDireta({
      organizacaoId: org.id, leadId: prospect2.leadId,
      familias: ["PABX"], responsavelId: usuario.id, ator,
    });
    const [opDireta] = await db.execute<{ sp: string | null; etapa: string }>(sql`
      SELECT source_process AS sp, etapa FROM negocios WHERE id = ${direta.oportunidades[0].id}::uuid
    `);
    ok("Oportunidade direta entra no Pipeline em Entrada", opDireta?.etapa === "entrada");
    ok("Oportunidade direta não finge passagem por Pré-vendas", opDireta?.sp === "OUTBOUND_DIRECT", opDireta?.sp ?? "");

    const [leadDoDireto] = await db.execute<{ etapa: string | null; estado: string }>(sql`
      SELECT estagio_pre_vendas AS etapa, prospeccao_estado AS estado FROM leads WHERE id = ${prospect2.leadId}::uuid
    `);
    ok("Oportunidade direta NÃO cria lead de Pré-vendas", leadDoDireto?.etapa === null);
    ok("O prospect passa a estado Oportunidade", leadDoDireto?.estado === "oportunidade");

    await esperaBloqueio(
      "Descarte exige motivo válido", "descarte_exige_motivo",
      () => prospeccao.descartar({
        organizacaoId: org.id, leadId: prospect2.leadId,
        motivo: "motivo_inexistente" as never, ator,
      }),
    );

    /* ── Contatos & Empresas (Bloco 05) ───────────────────────────────── */
    console.log("\n── Diretório: identidade, relacionamento derivado e Pessoa sem Empresa");

    const visao = await empresa360(org.id, lead.empresaId);
    ok("Empresa 360 encontra a empresa", visao !== null);
    ok("Relacionamento é derivado, não editado",
      visao?.relacionamento === "em_oportunidade", visao?.relacionamento);
    ok("Empresa mostra seus leads e oportunidades",
      (visao?.leads.length ?? 0) > 0 && (visao?.oportunidades.length ?? 0) > 0);
    ok("Empresa mostra as propostas da oportunidade", (visao?.propostas.length ?? 0) >= 2);
    ok("Dados jurídicos aparecem completos depois do preenchimento",
      visao?.dadosJuridicosCompletos === true);

    // Bloco 05 §3: Pessoa pode existir sem Empresa.
    const { resolverPessoa } = await import("@/lib/vendas/identidade");
    const solta = await resolverPessoa(org.id, {
      nome: `${MARCA} Avulsa`, email: `avulsa.${sufixo}@gmail.com`,
    }, ator);
    const semEmpresa = await diretorioPessoas(org.id, { semEmpresa: true, busca: MARCA, limite: 20 });
    ok("Pessoa persiste sem empresa", semEmpresa.some((p) => p.id === solta.pessoaId));

    /* ── Eventos ──────────────────────────────────────────────────────── */
    console.log("\n── Linha do tempo comercial");

    const [eventos] = await db.execute<{ n: number; tipos: string[] }>(sql`
      SELECT count(*)::int AS n, array_agg(DISTINCT tipo) AS tipos
        FROM vendas_eventos WHERE lead_id = ${lead.leadId}::uuid
    `);
    const tipos = eventos?.tipos ?? [];
    ok("Eventos do lead registrados", (eventos?.n ?? 0) > 0);
    for (const esperado of ["LeadCreated", "FirstContactMade", "LeadQualified", "OpportunityCreated"]) {
      ok(`Evento ${esperado} presente`, tipos.includes(esperado));
    }

    // Todo evento tem executor identificado. Ator SYSTEM ou AI_AGENT não tem
    // usuário de propósito — o que não pode faltar é o TIPO de quem executou.
    const [semAtor] = await db.execute<{ sem_tipo: number; humano_sem_usuario: number }>(sql`
      SELECT count(*) FILTER (WHERE ator_tipo IS NULL)::int AS sem_tipo,
             count(*) FILTER (WHERE ator_tipo = 'HUMAN' AND usuario_id IS NULL)::int AS humano_sem_usuario
        FROM vendas_eventos WHERE lead_id = ${lead.leadId}::uuid
    `);
    ok("Todo evento diz quem executou", (semAtor?.sem_tipo ?? 0) === 0);
    ok("Evento humano identifica o usuário", (semAtor?.humano_sem_usuario ?? 0) === 0);

  } finally {
    await limpar(sufixo);
  }

  console.log(`\n${falhou === 0 ? "✔" : "✘"} ${passou} passaram, ${falhou} falharam`);
  process.exit(falhou === 0 ? 0 : 1);
}

/**
 * Remove tudo que este aceite criou.
 *
 * A ordem é a das chaves estrangeiras, de fora para dentro: projeções e
 * eventos primeiro, identidade por último. Errar a ordem não corrompe nada —
 * o Postgres recusa —, mas deixa lixo de teste no banco de desenvolvimento.
 */
async function limpar(sufixo: string): Promise<void> {
  const marca = `${MARCA}%${sufixo}%`;
  const marcaLarga = `${MARCA}%`;

  const empresas = sql`(SELECT id FROM empresas WHERE nome LIKE ${marca})`;
  const negocios = sql`(SELECT id FROM negocios WHERE empresa_id IN ${empresas})`;
  const leads = sql`(SELECT id FROM leads WHERE empresa_id IN ${empresas})`;
  const pessoas = sql`(SELECT id FROM pessoas WHERE empresa_id IN ${empresas} OR nome LIKE ${marcaLarga})`;
  const propostas = sql`(SELECT id FROM propostas WHERE negocio_id IN ${negocios})`;

  // Eventos e projeções: nada depende deles.
  await db.execute(sql`DELETE FROM vendas_eventos WHERE empresa_id IN ${empresas}
     OR lead_id IN ${leads} OR negocio_id IN ${negocios}
     OR pessoa_id IN ${pessoas} OR proposta_id IN ${propostas}`);
  await db.execute(sql`DELETE FROM oportunidade_itens WHERE oportunidade_id IN
    (SELECT id FROM oportunidades WHERE empresa_id IN ${empresas})
     OR proposta_item_id_legado IN (SELECT id FROM proposta_itens WHERE proposta_id IN ${propostas})`);
  await db.execute(sql`DELETE FROM comercial_evidencia WHERE negocio_id IN ${negocios}`);

  // O aceite real forma grupos comerciais e pode gerar contrato e checkout.
  // Eles referenciam `proposta_itens`, então saem antes dela.
  const grupos = sql`(SELECT id FROM proposta_grupo_comercial WHERE proposta_id IN ${propostas})`;
  await db.execute(sql`DELETE FROM proposta_grupo_comercial_itens WHERE grupo_id IN ${grupos}
     OR proposta_item_id IN (SELECT id FROM proposta_itens WHERE proposta_id IN ${propostas})`);
  await db.execute(sql`DELETE FROM checkouts WHERE proposta_id IN ${propostas}`);
  await db.execute(sql`UPDATE propostas SET contrato_id = NULL WHERE id IN ${propostas}`);
  // `contratos` se liga ao negócio e ao lead, não à proposta — é `propostas`
  // que aponta para o contrato gerado.
  const contratos = sql`(SELECT id FROM contratos WHERE negocio_id IN ${negocios} OR lead_id IN ${leads})`;
  await db.execute(sql`DELETE FROM contrato_itens WHERE contrato_id IN ${contratos}`);
  await db.execute(sql`DELETE FROM comercial_evidencia WHERE negocio_id IN ${negocios}`);
  await db.execute(sql`DELETE FROM contratos WHERE id IN ${contratos}`);
  await db.execute(sql`UPDATE oportunidade_itens SET grupo_comercial_id = NULL WHERE grupo_comercial_id IN ${grupos}`);
  await db.execute(sql`UPDATE comercial_evidencia SET grupo_comercial_id = NULL WHERE grupo_comercial_id IN ${grupos}`);
  await db.execute(sql`DELETE FROM proposta_grupo_comercial WHERE proposta_id IN ${propostas}`);

  // Propostas: a auto-referência de versão precisa ser solta antes.
  await db.execute(sql`DELETE FROM proposta_itens WHERE proposta_id IN ${propostas}`);
  await db.execute(sql`UPDATE propostas SET substituida_por_id = NULL WHERE negocio_id IN ${negocios}`);
  await db.execute(sql`DELETE FROM propostas WHERE negocio_id IN ${negocios}`);

  // Registros operacionais presos ao lead ou ao negócio.
  await db.execute(sql`DELETE FROM reunioes WHERE negocio_id IN ${negocios} OR lead_id IN ${leads}`);
  await db.execute(sql`DELETE FROM tarefas WHERE lead_id IN ${leads} OR empresa_id IN ${empresas}`);
  await db.execute(sql`DELETE FROM atividades WHERE empresa_id IN ${empresas} OR lead_id IN ${leads} OR negocio_id IN ${negocios}`);
  await db.execute(sql`DELETE FROM status_changes WHERE lead_id IN ${leads} OR negocio_id IN ${negocios}`);
  await db.execute(sql`DELETE FROM negocio_leads WHERE negocio_id IN ${negocios} OR lead_id IN ${leads}`);
  await db.execute(sql`DELETE FROM cadence_enrollments WHERE entity_type = 'lead' AND entity_id IN ${leads}`);

  // Domain model v2, depois a tabela legada que ele espelha.
  // `pessoas` também é referenciada por `oportunidades`: sem incluir esse
  // caminho, um resíduo de execução anterior trava a limpeza desta.
  await db.execute(sql`DELETE FROM oportunidades WHERE empresa_id IN ${empresas} OR lead_id IN ${leads} OR pessoa_id IN ${pessoas}`);
  await db.execute(sql`DELETE FROM negocios WHERE empresa_id IN ${empresas}`);
  await db.execute(sql`DELETE FROM oportunidade_bundle WHERE empresa_id IN ${empresas}`);

  // Identidade.
  await db.execute(sql`DELETE FROM pontos_contato WHERE empresa_id IN ${empresas} OR pessoa_id IN ${pessoas} OR lead_id_legado IN ${leads}`);
  await db.execute(sql`DELETE FROM pessoa_empresa_vinculos WHERE empresa_id IN ${empresas} OR pessoa_id IN ${pessoas}`);
  await db.execute(sql`DELETE FROM pessoas WHERE empresa_id IN ${empresas} OR nome LIKE ${marcaLarga}`);
  await db.execute(sql`DELETE FROM lead_labels WHERE lead_id IN ${leads} OR label_id IN (SELECT id FROM labels WHERE nome LIKE ${marca})`);
  await db.execute(sql`DELETE FROM labels WHERE nome LIKE ${marca}`);
  await db.execute(sql`DELETE FROM leads WHERE empresa_id IN ${empresas}`);
  await db.execute(sql`DELETE FROM empresas WHERE nome LIKE ${marca}`);
}

main().catch((erro) => {
  console.error("\n✘ aceite interrompido:", erro);
  process.exit(1);
});
