/**
 * Checagem enxuta para a imagem de runtime antes do deploy.
 *
 * O verificador completo (`checar-env.ts`) compara fontes e `.env.example`,
 * materiais que não seguem para a imagem de produção. Este mantém o contrato
 * operacional: impedir a troca de containers quando uma jornada obrigatória
 * está sem configuração. Nunca imprime valores de ambiente.
 */
type Jornada = { nome: string; todas?: string[]; umaDelas?: string[] };

// Sem estas, o próprio CRM não consegue iniciar de forma coerente.
const NUCLEO: Jornada[] = [
  { nome: "núcleo", todas: ["DATABASE_URL", "REDIS_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] },
  // Os webhooks de lead são fail-closed: sem o segredo, todo lead do RD e da
  // Meta (via n8n) é recusado na entrada, em silêncio para quem opera.
  { nome: "entrada de leads", todas: ["RD_WEBHOOK_SECRET", "META_LEADIDS_WEBHOOK_SECRET"] },
];

// Integrações podem ser habilitadas em momentos distintos. O deploy não deve
// deixar o schema e o código divergirem só porque uma delas ainda não foi
// conectada; ele as anuncia explicitamente como pendências operacionais.
const INTEGRACOES: Jornada[] = [
  { nome: "Stripe", todas: ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET"] },
  { nome: "Documenso", todas: ["DOCUMENSO_API_URL", "DOCUMENSO_API_TOKEN", "DOCUMENSO_WEBHOOK_SECRET"] },
  { nome: "e-mail", todas: ["EMAIL_ENCRYPTION_KEY"] },
  { nome: "Microsoft 365", todas: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"] },
  { nome: "WhatsApp", todas: ["UAZAPI_WEBHOOK_SECRET", "UAZAPI_BASE_URL"] },
  { nome: "Callface AI", todas: ["CALLFACE_WEBHOOK_SECRET"] },
];

let problemas = 0;
for (const jornada of NUCLEO) {
  const faltando = (jornada.todas ?? []).filter((nome) => !process.env[nome]);
  const alternativa = !jornada.umaDelas || jornada.umaDelas.some((nome) => Boolean(process.env[nome]));
  if (faltando.length === 0 && alternativa) {
    console.log(`OK ${jornada.nome}`);
    continue;
  }
  problemas += faltando.length + (alternativa ? 0 : 1);
  console.error(`FALHA ${jornada.nome}: ${[...faltando, ...(alternativa ? [] : ["uma configuracao alternativa"])].join(", ")}`);
}

for (const jornada of INTEGRACOES) {
  const faltando = (jornada.todas ?? []).filter((nome) => !process.env[nome]);
  const alternativa = !jornada.umaDelas || jornada.umaDelas.some((nome) => Boolean(process.env[nome]));
  console.log(
    faltando.length === 0 && alternativa
      ? `OK ${jornada.nome}`
      : `PENDENTE ${jornada.nome}: ${[...faltando, ...(alternativa ? [] : ["uma configuracao alternativa"])].join(", ")}`
  );
}

if (problemas > 0) process.exit(1);
