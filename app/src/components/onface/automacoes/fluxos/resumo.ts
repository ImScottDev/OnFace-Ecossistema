/* Frases curtas sobre um nó: o título do gatilho e o resumo dos parâmetros
 * que o cartão do canvas mostra. Puro, sem React. */
import {
  CATALOGO_NOS, OPERADORES_REGRA, ROTULO_ENTIDADE, eventoPorId,
  type CampoConfig, type NoFluxo, type OpcoesInspetor, type TipoEntidade,
} from "@/lib/automacoes/grafo";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function duracaoTexto(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return "";
  if (minutos % 1440 === 0) return `${minutos / 1440} dia${minutos === 1440 ? "" : "s"}`;
  if (minutos % 60 === 0) return `${minutos / 60} h`;
  return `${minutos} min`;
}

export function diasTexto(dias: unknown): string {
  if (!Array.isArray(dias) || !dias.length) return "";
  const d = [...dias].map(Number).sort();
  if (d.join() === "1,2,3,4,5") return "seg a sex";
  if (d.length === 7) return "todo dia";
  return d.map((x) => DIAS[x] ?? "?").join(", ");
}

/** Título do cartão do gatilho: o que dispara, em uma frase. */
export function tituloGatilho(no: NoFluxo): string {
  const c = no.config;
  switch (c.modo) {
    case "evento": return eventoPorId(String(c.evento ?? ""))?.rotulo ?? "Escolha o evento";
    case "manual": return "Quando eu mandar rodar";
    case "webhook": return "Ao receber uma chamada HTTP";
    case "agendado": {
      const horarios = Array.isArray(c.horarios) ? (c.horarios as string[]).join(", ") : "";
      if (c.frequencia === "intervalo") return `A cada ${duracaoTexto(Number(c.intervaloMinutos ?? 0)) || "intervalo"}`;
      if (c.frequencia === "semanal") return `${diasTexto(c.diasSemana) || "Dias marcados"} às ${horarios || "?"}`;
      if (c.frequencia === "mensal") return `Todo dia ${c.diaMes ?? "?"} às ${horarios || "?"}`;
      return `Todo dia às ${horarios || "?"}`;
    }
    default: return "Escolha como começa";
  }
}

/** Texto legível de um valor de campo, com nomes no lugar de ids. */
export function valorTexto(campo: CampoConfig, valor: unknown, opcoes?: OpcoesInspetor): string {
  if (valor === undefined || valor === null || valor === "") return "";
  switch (campo.tipo) {
    case "selecao":
    case "tipo_entidade":
      return campo.opcoes?.find((o) => o.valor === valor)?.rotulo ?? String(valor);
    case "booleano": return valor ? "Sim" : "Não";
    case "duracao": return duracaoTexto(Number(valor));
    case "dias_semana": return diasTexto(valor);
    case "horarios": return Array.isArray(valor) ? valor.join(", ") : String(valor);
    case "usuario": return opcoes?.usuarios.find((u) => u.id === valor)?.nome ?? String(valor);
    case "tag": return opcoes?.tags.find((t) => t.id === valor)?.nome ?? String(valor);
    case "cadencia": return opcoes?.cadencias.find((t) => t.id === valor)?.nome ?? String(valor);
    case "template_whatsapp": return opcoes?.templatesWhatsapp.find((t) => t.id === valor)?.nome ?? String(valor);
    case "sessao_whatsapp": return opcoes?.sessoesWhatsapp.find((t) => t.id === valor)?.nome ?? String(valor);
    case "agente_ia": return opcoes?.agentesIa.find((t) => t.id === valor)?.nome ?? String(valor);
    case "etapa": {
      const todas = [...(opcoes?.etapas.negocio ?? []), ...(opcoes?.etapas.lead ?? [])];
      return todas.find((e) => e.valor === valor)?.rotulo ?? String(valor);
    }
    case "evento": return eventoPorId(String(valor))?.rotulo ?? String(valor);
    case "regras": {
      const regras = (Array.isArray(valor) ? valor : []) as { campo?: string; operador?: string; valor?: unknown }[];
      if (!regras.length) return "";
      const primeira = regras[0];
      const op = OPERADORES_REGRA.find((o) => o.valor === primeira.operador)?.rotulo ?? "";
      const resto = regras.length > 1 ? ` (+${regras.length - 1})` : "";
      return `${primeira.campo ?? "?"} ${op} ${primeira.valor ?? ""}`.trim() + resto;
    }
    case "rotas":
    case "classes": {
      const itens = (Array.isArray(valor) ? valor : []) as { rotulo?: string }[];
      return itens.map((i) => i.rotulo).filter(Boolean).join(" · ");
    }
    case "pares": {
      const pares = (Array.isArray(valor) ? valor : []) as { chave?: string }[];
      return pares.map((p) => p.chave).filter(Boolean).join(", ");
    }
    default:
      return typeof valor === "string" ? valor : Array.isArray(valor) ? valor.join(", ") : JSON.stringify(valor);
  }
}

/** Até `max` linhas "rótulo: valor" dos campos preenchidos e visíveis, na ordem do catálogo. */
export function resumoNo(no: NoFluxo, opcoes?: OpcoesInspetor, max = 2): { rotulo: string; valor: string }[] {
  const meta = CATALOGO_NOS[no.tipo];
  if (no.tipo === "gatilho") {
    const c = no.config;
    const linhas: { rotulo: string; valor: string }[] = [];
    if (c.modo === "agendado" && c.alvo && c.alvo !== "nenhuma") linhas.push({ rotulo: "Para cada", valor: ROTULO_ENTIDADE[c.alvo as TipoEntidade] ?? String(c.alvo) });
    if (c.modo === "manual" && c.entidade && c.entidade !== "nenhuma") linhas.push({ rotulo: "Roda sobre", valor: ROTULO_ENTIDADE[c.entidade as TipoEntidade] ?? String(c.entidade) });
    if (c.modo === "evento" && Array.isArray(c.filtros) && c.filtros.length) {
      linhas.push({ rotulo: "Só quando", valor: valorTexto(meta.campos.find((x) => x.chave === "filtros")!, c.filtros) });
    }
    return linhas.slice(0, max);
  }
  if (no.tipo === "esperar") {
    const q = Number(no.config.quantidade ?? 0);
    const u = String(no.config.unidade ?? "dias");
    return [{ rotulo: "Por", valor: `${q} ${q === 1 ? u.replace(/s$/, "") : u}` }];
  }
  const linhas: { rotulo: string; valor: string }[] = [];
  for (const campo of meta.campos) {
    if (linhas.length >= max) break;
    if (campo.tipo === "somente_leitura" || !visivel(campo, no.config, meta.campos)) continue;
    // Modo do WhatsApp é detalhe; a mensagem já diz tudo.
    if (no.tipo === "enviar_whatsapp" && campo.chave === "modo") continue;
    const texto = valorTexto(campo, no.config[campo.chave], opcoes);
    if (texto) linhas.push({ rotulo: campo.rotulo, valor: texto });
  }
  return linhas;
}

/** Mesma regra de `mostrarSe` do validarGrafo (encadeada no pai). */
export function visivel(campo: CampoConfig, config: Record<string, unknown>, todos: CampoConfig[]): boolean {
  if (!campo.mostrarSe) return true;
  const pai = todos.find((c) => c.chave === campo.mostrarSe!.campo);
  if (pai && !visivel(pai, config, todos)) return false;
  const valor = config[campo.mostrarSe.campo] ?? pai?.padrao;
  return campo.mostrarSe.valores.includes(valor);
}
