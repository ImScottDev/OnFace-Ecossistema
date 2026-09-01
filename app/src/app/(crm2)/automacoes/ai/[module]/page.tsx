import { notFound } from "next/navigation";
import {
  Cf2AiPlatformWorkspace,
  type AiPlatformModule,
} from "@/components/crm2/automacoes/AiPlatformWorkspace";

const MODULES = new Set<AiPlatformModule>([
  "roteadores",
  "credenciais",
  "provedores",
  "conhecimento",
  "memoria",
  "skills",
  "casos",
  "alertas",
  "propostas",
  "uso",
]);

export default async function AiPlatformModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!MODULES.has(module as AiPlatformModule)) notFound();

  return <Cf2AiPlatformWorkspace module={module as AiPlatformModule} />;
}
