import { modelToolsForIds } from "@/lib/ai-platform/tools/registry";
import { NEXO_TOOL_IDS } from "@/lib/nexo/ferramentas";
import { compactarCatalogo } from "@/lib/ai-platform/runtime/claude-subscription-adapter";
const t = modelToolsForIds(NEXO_TOOL_IDS);
const c = compactarCatalogo(t);
console.log(t.length, "compact", c.length, "json", JSON.stringify(t.map(i=>({name:i.name,description:i.description,parameters:i.parameters}))).length);
console.log(c.slice(0, 1800));
process.exit(0);
