import { redirect } from "next/navigation";

// Uma jornada só: o hub antigo "Agente de IA" virou Automação → Agentes.
export default function AutomacoesAgenteIAPage() {
  redirect("/automacoes/agentes");
}
