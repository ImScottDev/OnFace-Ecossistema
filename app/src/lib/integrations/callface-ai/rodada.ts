/**
 * UMA rodada do sincronismo Callface AI — os três passos, nesta ordem:
 *
 *   1. uso      (`sincronizarCallfaceAi`)     espelho de uso, saúde e tarefas de CS
 *   2. parceiros (`sincronizarParceirosCallfaceAi`) White Label: parceiro, licença, fatura
 *   3. retrato  (`sincronizarRetratoCallfaceAi`)   plano, Stripe, licenças, usuários, equipes
 *
 * Fonte única: o job do worker e o script de operação chamam ESTA função. Era
 * inline no worker, e por isso o script `sincronizar-callface-ai.ts` rodava só o
 * passo 1 — foi como as tabelas de parceiro e de retrato ficaram vazias sem
 * ninguém perceber: o único caminho que as preenchia era o job de 6 h.
 *
 * Cada passo é independente: parceiros falhando não impede o retrato, e nenhum
 * dos dois derruba o uso. Quem chama decide o que fazer com o relato.
 */
export type RelatoDaRodada = {
  slug: string;
  uso: string;
  parceiros: string | null;
  retrato: string | null;
  erro: string | null;
};

/** Roda os três passos para UMA organização e devolve as linhas prontas para log. */
export async function rodadaCallfaceAi(organizacaoId: string, slug: string): Promise<RelatoDaRodada> {
  const relato: RelatoDaRodada = { slug, uso: "", parceiros: null, retrato: null, erro: null };
  try {
    const { sincronizarCallfaceAi } = await import("./sincronizar");
    // O sync resolve as identidades por conta própria (primeiro passo dele).
    const r = await sincronizarCallfaceAi(organizacaoId);
    relato.uso =
      `${r.status} em ${r.duracaoMs}ms — ${r.identidadesNovas} identidade(s) nova(s), ${r.tenants} tenant(s), ` +
      `${r.snapshots} snapshot(s), ${r.detalhes} detalhe(s), ${r.diasDeUso} dia(s) de uso, ` +
      `saúde ${r.saude?.linhas ?? 0} linha(s)/${r.saude?.mudancasDeSemaforo ?? 0} mudança(s) de semáforo, ` +
      `tarefas ${r.tarefas ? `+${r.tarefas.criadas} ~${r.tarefas.atualizadas} -${r.tarefas.fechadas}` : "n/a"}` +
      `${r.erro ? ` — ${r.erro}` : ""}`;

    // Desabilitado = não há conexão com o SaaS neste ambiente. Os outros dois
    // passos leem a mesma conexão, então não há o que tentar.
    if (r.status === "desabilitado") return relato;

    try {
      const { sincronizarParceirosCallfaceAi } = await import("./parceiros-sincronizar");
      const p = await sincronizarParceirosCallfaceAi(organizacaoId);
      relato.parceiros =
        `${p.status} em ${p.duracaoMs}ms — ${p.parceiros} parceiro(s), ${p.licencasAtivas}/${p.licencas} licença(s) ativa(s), ` +
        `${p.faturas} fatura(s), ${p.pendenciasAbertas} pendência(s) (${p.pendenciasAltas} alta(s), ${p.faturasVencidas} fatura(s) vencida(s))` +
        `${p.limites.length ? ` — não conferido: ${p.limites.join(" | ")}` : ""}${p.erro ? ` — ${p.erro}` : ""}`;
    } catch (e) {
      relato.parceiros = `falhou: ${e instanceof Error ? e.message : String(e)}`;
    }

    try {
      const { sincronizarRetratoCallfaceAi } = await import("./retrato-sincronizar");
      const rt = await sincronizarRetratoCallfaceAi(organizacaoId);
      relato.retrato =
        `${rt.status} em ${rt.duracaoMs}ms — ${rt.organizacoes} organização(ões), ${rt.planos} plano(s), ` +
        `${rt.licencas} licença(s), ${rt.usuarios} vínculo(s) de usuário, ${rt.equipes} equipe(s)/workspace(s), ` +
        `${rt.receptivos} receptivo(s)${rt.avisos.length ? ` — conferir: ${rt.avisos.join(" | ")}` : ""}` +
        `${rt.erro ? ` — ${rt.erro}` : ""}`;
    } catch (e) {
      relato.retrato = `falhou: ${e instanceof Error ? e.message : String(e)}`;
    }
  } catch (e) {
    relato.erro = e instanceof Error ? e.message : String(e);
  }
  return relato;
}

/** Imprime o relato no formato que o log do worker já usava. */
export function logarRodada(relato: RelatoDaRodada, prefixo: string, origem: string): void {
  if (relato.erro) {
    console.error(`${prefixo} ${relato.slug}: falhou: ${relato.erro}`);
    return;
  }
  console.log(`${prefixo} ${relato.slug} (${origem}): ${relato.uso}`);
  if (relato.parceiros) console.log(`${prefixo} ${relato.slug} parceiros: ${relato.parceiros}`);
  if (relato.retrato) console.log(`${prefixo} ${relato.slug} retrato: ${relato.retrato}`);
}
