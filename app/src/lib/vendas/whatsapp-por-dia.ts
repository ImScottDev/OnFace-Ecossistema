/**
 * Agrupamento das mensagens de WhatsApp na leitura da linha do tempo.
 *
 * Cada mensagem é uma linha em `communications` (34 mil). Mostrar uma a uma
 * enterra proposta, reunião, etapa e pagamento. O dado continua todo gravado;
 * só a APRESENTAÇÃO muda, e é por aqui que `lerLinhaDoTempo` passa — logo vale
 * para toda tela que mostra histórico (Cliente 360, empresa, contato, lead,
 * oportunidade, drawer, Pré-vendas, Pipeline, propostas).
 *
 * REGRA: por dia civil de São Paulo e por conversa (pessoa; sem pessoa, a
 * conversa), 3 ou mais mensagens viram UM registro
 * "WhatsApp · N mensagens — X enviadas, Y recebidas · HH:MM às HH:MM".
 * Com 1 ou 2 no dia, cada mensagem continua aparecendo sozinha: um "WhatsApp
 * recebido" avulso diz mais do que "WhatsApp · 1 mensagem".
 *
 * Módulo puro (sem `db`): pode ser testado e importado de qualquer lado.
 */
import { diaCivil } from "@/lib/integrations/callface-ai/calendario-sp";

/** A partir de quantas mensagens no mesmo dia/conversa elas viram um registro só. */
export const MINIMO_PARA_AGRUPAR = 3;

export interface MensagemWhatsapp {
  id: string;
  /** Conversa: a pessoa, ou a conversa quando não há pessoa. */
  chave: string;
  pessoaId: string | null;
  /** 'in' | 'entrada' = recebida; 'out' | 'saida' = enviada; outro valor não conta em nenhum lado. */
  direcao: string | null;
  ocorridoEm: string;
  usuarioNome: string | null;
  resumo: string;
}

export interface RegistroWhatsapp {
  id: string;
  tipo: string;
  titulo: string;
  atorTipo: string;
  usuarioNome: string | null;
  contexto: Record<string, unknown>;
  ocorridoEm: string;
}

const recebida = (d: string | null) => d === "in" || d === "entrada";
const enviada = (d: string | null) => d === "out" || d === "saida";

const hora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    .format(new Date(iso));

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function agruparWhatsappPorDia(mensagens: MensagemWhatsapp[]): RegistroWhatsapp[] {
  const grupos = new Map<string, MensagemWhatsapp[]>();
  for (const m of mensagens) {
    const k = `${diaCivil(new Date(m.ocorridoEm))}|${m.chave}`;
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(m);
  }

  const saida: RegistroWhatsapp[] = [];
  for (const [k, msgs] of grupos) {
    if (msgs.length < MINIMO_PARA_AGRUPAR) {
      for (const m of msgs) {
        saida.push({
          id: m.id, tipo: "comunicacao_whatsapp",
          titulo: `WhatsApp${recebida(m.direcao) ? " recebido" : enviada(m.direcao) ? " enviado" : ""}`,
          atorTipo: "HUMAN", usuarioNome: m.usuarioNome,
          contexto: { canal: "whatsapp", direcao: m.direcao, resumo: m.resumo },
          ocorridoEm: m.ocorridoEm,
        });
      }
      continue;
    }
    const porTempo = [...msgs].sort((a, b) => Date.parse(a.ocorridoEm) - Date.parse(b.ocorridoEm));
    const primeira = porTempo[0], ultima = porTempo[porTempo.length - 1];
    const env = msgs.filter((m) => enviada(m.direcao)).length;
    const rec = msgs.filter((m) => recebida(m.direcao)).length;
    const faixa = hora(primeira.ocorridoEm) === hora(ultima.ocorridoEm)
      ? hora(primeira.ocorridoEm) : `${hora(primeira.ocorridoEm)} às ${hora(ultima.ocorridoEm)}`;
    saida.push({
      // Id estável (dia + conversa): o React não remonta a linha a cada leitura.
      id: `wa-dia:${k}`,
      tipo: "comunicacao_whatsapp_dia",
      titulo: `WhatsApp · ${msgs.length} mensagens — ${plural(env, "enviada", "enviadas")}, ${plural(rec, "recebida", "recebidas")} · ${faixa}`,
      atorTipo: "SYSTEM", usuarioNome: null,
      contexto: {
        canal: "whatsapp", mensagens: msgs.length, enviadas: env, recebidas: rec,
        dia: k.split("|")[0], primeiraEm: primeira.ocorridoEm, ultimaEm: ultima.ocorridoEm,
        pessoaId: primeira.pessoaId,
      },
      // A linha fica no instante da última mensagem: é o "último contato" do dia.
      ocorridoEm: ultima.ocorridoEm,
    });
  }
  return saida;
}
