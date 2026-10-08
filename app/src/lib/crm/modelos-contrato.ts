/**
 * Modelos oficiais de contrato da Callface.
 *
 * O texto vive em `templates-contrato/*.html` (versionado como arquivo:
 * contrato se relê e se compara). Esta é a única porta que os carrega em
 * `contrato_templates`, usada pelo script de seed e pela subida da API.
 *
 * Por que a subida da API também: o seed era um comando manual, e o ambiente
 * que não o rodou gerava contrato com o único modelo que existia em toda base,
 * o genérico de seis linhas. A subida só INSERE o que falta; nunca sobrescreve
 * o que alguém editou em Ajustes → Contratos.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contratoTemplates, organizacoes } from "@/lib/db/schema";
import { sanitizarCorpoContrato } from "@/lib/crm/contrato-sanitize";
import { converterVariaveisZoho } from "@/lib/crm/contrato-variaveis";

export const CATALOGO_MODELOS = [
  { arquivo: "callface-ai.html", nome: "Contrato Callface AI", tipoDocumento: "CONTRATO", serviceFamily: "CALLFACE_AI", commercialModel: "CONTRATO_OBRIGATORIO" },
  { arquivo: "pabx.html", nome: "Contrato PABX", tipoDocumento: "CONTRATO", serviceFamily: "PABX", commercialModel: "CONTRATO_OBRIGATORIO" },
  { arquivo: "pabx-aditivo.html", nome: "Termo Aditivo PABX", tipoDocumento: "ADITIVO", serviceFamily: "PABX", commercialModel: null },
  { arquivo: "pabx-downgrade.html", nome: "Termo Aditivo de Downgrade PABX", tipoDocumento: "DOWNGRADE", serviceFamily: "PABX", commercialModel: null },
  { arquivo: "pabx-renovacao.html", nome: "Contrato de Renovação PABX", tipoDocumento: "RENOVACAO", serviceFamily: "PABX", commercialModel: null },
  { arquivo: "white-label.html", nome: "Contrato White Label", tipoDocumento: "CONTRATO", serviceFamily: "WHITE_LABEL", commercialModel: "CONTRATO_OBRIGATORIO" },
] as const;

function pastaDosModelos(): string | null {
  const candidatas = [process.env.MODELOS_CONTRATO_DIR, join(process.cwd(), "src/lib/crm/templates-contrato")].filter(Boolean) as string[];
  return candidatas.find((p) => existsSync(p)) ?? null;
}

/** Corpo pronto para gravar: variáveis do Zoho convertidas, HTML saneado. */
export function lerModelo(arquivo: string, pasta = pastaDosModelos()): string {
  if (!pasta) throw new Error("Pasta dos modelos de contrato não encontrada (MODELOS_CONTRATO_DIR)");
  const { corpo, desconhecidas } = converterVariaveisZoho(readFileSync(join(pasta, arquivo), "utf8"));
  if (desconhecidas.length > 0) throw new Error(`${arquivo}: variável sem equivalente: ${desconhecidas.join(", ")}`);
  return sanitizarCorpoContrato(corpo);
}

/**
 * `atualizar: false` só cria o que não existe (subida da API).
 * `atualizar: true` cria NOVA VERSÃO quando o arquivo mudou (comando manual): a
 * linha anterior fica inativa e preservada, porque contratos já gerados apontam
 * para ela e precisam continuar mostrando o texto que foi assinado.
 */
export async function carregarModelosOficiais(opts: { atualizar: boolean; dry?: boolean; log?: (m: string) => void }): Promise<void> {
  const log = opts.log ?? (() => {});
  const pasta = pastaDosModelos();
  if (!pasta) { log("modelos: pasta não encontrada, nada a carregar"); return; }
  const orgs = await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes);
  for (const org of orgs) {
    for (const item of CATALOGO_MODELOS) {
      const corpoTemplate = lerModelo(item.arquivo, pasta);
      const [atual] = (await db.select().from(contratoTemplates).where(and(
        eq(contratoTemplates.organizacaoId, org.id),
        eq(contratoTemplates.tipoDocumento, item.tipoDocumento),
        eq(contratoTemplates.ativo, true),
      ))).filter((l) => l.serviceFamily === item.serviceFamily);

      if (!atual) {
        if (!opts.dry) await db.insert(contratoTemplates).values({ organizacaoId: org.id, nome: item.nome, tipoDocumento: item.tipoDocumento, serviceFamily: item.serviceFamily, commercialModel: item.commercialModel, corpoTemplate });
        log(`[${org.nome}] criado: ${item.nome}`);
      } else if (opts.atualizar && atual.corpoTemplate !== corpoTemplate) {
        if (!opts.dry) {
          await db.update(contratoTemplates).set({ ativo: false }).where(eq(contratoTemplates.id, atual.id));
          await db.insert(contratoTemplates).values({ organizacaoId: org.id, nome: item.nome, tipoDocumento: item.tipoDocumento, serviceFamily: item.serviceFamily, commercialModel: item.commercialModel, corpoTemplate, versao: atual.versao + 1 });
        }
        log(`[${org.nome}] nova versão: ${item.nome} (v${atual.versao} -> v${atual.versao + 1})`);
      } else {
        log(`[${org.nome}] sem mudança: ${item.nome} (v${atual.versao})`);
      }
    }
  }
}
