/**
 * Classifica família comercial (service_family) + categoria pros itens do
 * catálogo que representam produto ATUAL de verdade (Callface AI, CallPilot/
 * Agente IA, PABX, Discador Preditivo) e ativa só esses. Achado real 25/08
 * (Kauã): os 218 itens de `servicos_catalogo` são quase todos lixo histórico
 * migrado do Zoho (nome de cliente específico tipo "SMALL - TABELIAO ITATIBA",
 * hardware avulso, desconto pontual, ramal por hotel) — "ativar tudo" literal
 * recriaria o problema que a correção de 19/08 tentou evitar (nunca despejar
 * 200+ linhas históricas no vendedor). NÃO existe item White Label no
 * catálogo hoje — não foi inventado aqui, precisa ser adicionado com preço
 * real via Ajustes → Catálogo.
 *
 * Reversível/local: só toca o banco de dev. Reclassificar de novo é rodar
 * este script outra vez, ou ajustar direto em Ajustes → Catálogo.
 */
import { db } from "@/lib/db";
import { servicosCatalogo } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CLASSIFICACOES: { nomes: string[]; serviceFamily: "CALLFACE_AI" | "PABX"; categoria: string }[] = [
  {
    serviceFamily: "CALLFACE_AI",
    categoria: "callface_ai",
    nomes: [
      "Callface AI - Starter", "Callface AI - Full", "Callface AI - Business",
      "CALLFACE AI - BUSINESS ENTERPRISE", "CALLFACE AI - COLD CALLING",
      "CALLFACE AI - PRO BUSINESS", "CALLFACE AI - PRO FULL CONNECT",
      "CALLFACE AI - STARTER BUSINESS", "CALLFACE AI - LINHA RECEPTIVA ADICIONAL",
      "Agente IA", "AGENTE DE IA - WHATSAPP", "AGENTE DE MENSAGERIA",
      "AGENTE BDR", "SETUP AGENTE BDR", "MINUTAGEM AGENTE BDR",
      "CallPilot", "CallPilot Plataforma",
      "Minutos adicionais Callface AI", "Pacote 500min Adicionais",
    ],
  },
  {
    serviceFamily: "PABX",
    categoria: "pabx",
    nomes: [
      "PABX Starter (Compartilhado)", "PABX Medium (Dedicado)", "PABX Enterprise (Dedicado)",
      "Setup PABX", "DISCADOR PREDITIVO", "USUÁRIO ADICIONAL DISCADOR PREDITIVO",
      "Linha SIP Adicional", "LINHA SIP - NUMERO NOVO", "LINHA SIP - PORTABILIDADE",
      "Licença Ramal",
    ],
  },
];

async function main() {
  let ativados = 0;
  let naoEncontrados: string[] = [];
  for (const grupo of CLASSIFICACOES) {
    for (const nome of grupo.nomes) {
      const result = await db
        .update(servicosCatalogo)
        .set({ serviceFamily: grupo.serviceFamily, categoria: grupo.categoria, ativo: true })
        .where(eq(servicosCatalogo.nome, nome))
        .returning({ id: servicosCatalogo.id });
      if (result.length === 0) naoEncontrados.push(nome);
      else ativados += result.length;
    }
  }
  console.log(`${ativados} item(ns) classificado(s) e ativado(s).`);
  if (naoEncontrados.length > 0) {
    console.log("Não encontrados (nome não bate exato):", naoEncontrados);
  }
  process.exit(0);
}
main();
