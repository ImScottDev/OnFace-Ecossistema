/**
 * O relatório do `--simular` do portal: o que a configuração do ONFACE faria na conta Stripe, campo a campo.
 * Puro (texto sai de dados já lidos), para o script de configuração e o teste usarem a mesma montagem.
 */
import {
  corpoDaConfiguracao, decidirConfiguracao, diferencasDaConfiguracao, ehDoOnface, ehDoSaaS, riscosDeConfiguracaoAlheia,
  type ConfiguracaoDoStripe, type PoliticasPortal,
} from "./stripe-portal-config";
import type { PlanosResolvidos } from "./stripe-portal-planos";

export interface EntradaDoRelatorio {
  configuracoes: ConfiguracaoDoStripe[];
  fixadoId?: string | null;
  politicas: PoliticasPortal;
  /** `null` = os planos não foram resolvidos (sem banco/organização): a troca de plano não entra na comparação. */
  planos: PlanosResolvidos | null;
  /** id → nome legível, só para o relatório. */
  nomes?: Record<string, string>;
}

const nomeDe = (nomes: Record<string, string> | undefined, id: string) => (nomes?.[id] ? `${id} (${nomes[id]})` : id);

export function montarRelatorioDoPortal(e: EntradaDoRelatorio): string[] {
  const out: string[] = [];
  const planos = e.planos ? e.planos.planos : null;

  out.push(`${e.configuracoes.length} configuração(ões) de portal na conta:`);
  for (const c of e.configuracoes) {
    const dono = ehDoSaaS(c) ? "SaaS (intocável)" : ehDoOnface(c) ? "ONFACE" : c.is_default ? "padrão da conta (Dashboard)" : "sem dono";
    out.push(`  ${c.id}  ${c.active === false ? "inativa" : "ativa"}  ${dono}`);
    if (!ehDoSaaS(c) && !ehDoOnface(c)) for (const r of riscosDeConfiguracaoAlheia(c)) out.push(`      risco: ${r}`);
  }

  out.push("", "Planos da troca de plano (catálogo do ONFACE ∩ Stripe, sem objeto do SaaS):");
  if (!e.planos) {
    out.push("  (não resolvidos: sem banco/organização. A seção subscription_update NÃO entra na comparação nem no --aplicar.)");
  } else {
    if (e.planos.planos.length === 0) out.push("  nenhum");
    for (const p of e.planos.planos) out.push(`  + ${nomeDe(e.nomes, p.produto)}: ${p.precos.map((x) => nomeDe(e.nomes, x)).join(", ")}`);
    for (const x of e.planos.excluidos) out.push(`  - ${x.id}: ${x.motivo}`);
    if (e.planos.aviso) out.push(`  aviso: ${e.planos.aviso}`);
  }

  const desejado = corpoDaConfiguracao(e.politicas, planos);
  const d = decidirConfiguracao({ fixadoId: e.fixadoId, lista: e.configuracoes, politicas: e.politicas, planos });
  out.push("", `STRIPE_PORTAL_CONFIGURATION_ID=${e.fixadoId ?? "(não definido)"}`);
  out.push(`STRIPE_PORTAL_PRIVACY_URL/TERMS_URL=${e.politicas.privacyUrl && e.politicas.termsUrl ? "definidos" : "FALTAM"}`);

  let alvo: ConfiguracaoDoStripe | null = null;
  switch (d.acao) {
    case "usar_fixada":
      out.push(`Decisão: usar a configuração FIXADA ${d.id} (escolha explícita do operador). Este script NÃO a altera e o --aplicar é ignorado.`);
      for (const r of d.riscos) out.push(`  risco: ${r}`);
      if (d.riscos.length) out.push("  Para o ONFACE gerir a própria: remova STRIPE_PORTAL_CONFIGURATION_ID e rode com --aplicar.");
      break;
    case "recusar_fixada": out.push(`Decisão: RECUSAR a fixada ${d.id}: ${d.motivo}.`); break;
    case "reusar": out.push(`Decisão: REUSAR a configuração do ONFACE ${d.id} (sem divergência).`); break;
    case "atualizar":
      alvo = e.configuracoes.find((c) => c.id === d.id) ?? null;
      out.push(`Decisão: ATUALIZAR ${d.id} (${d.diferencas.length} divergência(s)).`);
      break;
    case "criar":
      out.push("Decisão: CRIAR a configuração do ONFACE (nenhuma ativa com a marca atual na conta).");
      if (d.semPoliticas) out.push("  Atenção: sem as URLs de política o Stripe pode recusar a criação; nesse caso o botão do Cliente 360 mostra o que falta (422), não um 400.");
      break;
  }

  if (d.acao === "criar" || d.acao === "atualizar") {
    const diffs = diferencasDaConfiguracao(desejado, alvo);
    out.push("", d.acao === "criar" ? "Campo a campo (configuração NOVA; \"atual\" = não existe):" : `Campo a campo (${alvo?.id}):`);
    for (const x of diffs) out.push(`  ${x.campo}\n      atual:    ${x.atual ?? "(ausente)"}\n      desejado: ${x.desejado}`);
    if (diffs.length === 0) out.push("  (nenhuma)");

    // O que muda para o cliente HOJE: o portal que ele usa é a padrão da conta.
    const padrao = e.configuracoes.find((c) => c.is_default && !ehDoSaaS(c));
    if (padrao) {
      const vsPadrao = diferencasDaConfiguracao(desejado, padrao).filter((x) => !x.campo.startsWith("metadata."));
      out.push("", `Para o cliente, em relação à padrão da conta (${padrao.id}), mudam ${vsPadrao.length} campo(s):`);
      for (const x of vsPadrao) out.push(`  ${x.campo}: ${x.atual ?? "(ausente)"} → ${x.desejado}`);
    }
  }
  return out;
}
