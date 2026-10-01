import { redirect } from "next/navigation";

// Os módulos soltos da plataforma de IA foram absorvidos pela jornada de
// Agentes: credencial e provedor moram em Ajustes → Integrações; conhecimento,
// memória, casos e uso aparecem dentro do editor de cada agente.
export default async function AiPlatformModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  redirect(module === "credenciais" || module === "provedores" ? "/ajustes/integracoes" : "/automacoes/agentes");
}
