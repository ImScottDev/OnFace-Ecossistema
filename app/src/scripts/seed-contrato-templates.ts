/**
 * Carrega os contratos oficiais da Callface em `contrato_templates`.
 *
 * O texto vive em `lib/crm/templates-contrato/*.html`, versionado como
 * arquivo, porque contrato é documento que se relê e se compara — dentro de
 * um INSERT com aspas escapadas ninguém revisa cláusula.
 *
 * Idempotente: a chave é (organização, tipo de documento, família). Rodar de
 * novo com o HTML igual não faz nada; com o HTML alterado, incrementa a
 * versão, e os contratos já gerados seguem com o texto que foi assinado.
 *
 *   npx tsx src/scripts/seed-contrato-templates.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contratoTemplates, organizacoes } from "@/lib/db/schema";
import { sanitizarCorpoContrato } from "@/lib/crm/contrato-sanitize";
import { converterVariaveisZoho } from "@/lib/crm/contrato-variaveis";

const PASTA = join(process.cwd(), "src/lib/crm/templates-contrato");

const CATALOGO = [
  { arquivo: "callface-ai.html", nome: "Contrato Callface AI", tipoDocumento: "CONTRATO", serviceFamily: "CALLFACE_AI", commercialModel: "CONTRATO_OBRIGATORIO" },
  { arquivo: "pabx.html", nome: "Contrato PABX", tipoDocumento: "CONTRATO", serviceFamily: "PABX", commercialModel: "CONTRATO_OBRIGATORIO" },
  { arquivo: "pabx-aditivo.html", nome: "Termo Aditivo PABX", tipoDocumento: "ADITIVO", serviceFamily: "PABX", commercialModel: null },
  { arquivo: "pabx-renovacao.html", nome: "Contrato de Renovação PABX", tipoDocumento: "RENOVACAO", serviceFamily: "PABX", commercialModel: null },
  { arquivo: "white-label.html", nome: "Contrato White Label", tipoDocumento: "CONTRATO", serviceFamily: "WHITE_LABEL", commercialModel: "CONTRATO_OBRIGATORIO" },
] as const;

async function main() {
  const dry = process.argv.includes("--dry");
  const orgs = await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes);
  if (orgs.length === 0) throw new Error("Nenhuma organização no banco");

  for (const org of orgs) {
    for (const item of CATALOGO) {
      const bruto = readFileSync(join(PASTA, item.arquivo), "utf8");
      const { corpo, desconhecidas } = converterVariaveisZoho(bruto);
      if (desconhecidas.length > 0) throw new Error(`${item.arquivo}: variável sem equivalente — ${desconhecidas.join(", ")}`);
      const corpoTemplate = sanitizarCorpoContrato(corpo);

      const [existente] = await db
        .select()
        .from(contratoTemplates)
        .where(and(
          eq(contratoTemplates.organizacaoId, org.id),
          eq(contratoTemplates.tipoDocumento, item.tipoDocumento),
          eq(contratoTemplates.ativo, true),
        ))
        .then((linhas) => linhas.filter((l) => l.serviceFamily === item.serviceFamily));

      if (!existente) {
        if (!dry) {
          await db.insert(contratoTemplates).values({
            organizacaoId: org.id,
            nome: item.nome,
            tipoDocumento: item.tipoDocumento,
            serviceFamily: item.serviceFamily,
            commercialModel: item.commercialModel,
            corpoTemplate,
          });
        }
        console.log(`[${org.nome}] criado: ${item.nome}`);
        continue;
      }
      if (existente.corpoTemplate === corpoTemplate && existente.nome === item.nome) {
        console.log(`[${org.nome}] sem mudança: ${item.nome} (v${existente.versao})`);
        continue;
      }
      if (!dry) {
        await db.update(contratoTemplates).set({
          nome: item.nome,
          corpoTemplate,
          commercialModel: item.commercialModel,
          versao: existente.versao + 1,
        }).where(eq(contratoTemplates.id, existente.id));
      }
      console.log(`[${org.nome}] atualizado: ${item.nome} (v${existente.versao} → v${existente.versao + 1})`);
    }
  }
  process.exit(0);
}

main();
