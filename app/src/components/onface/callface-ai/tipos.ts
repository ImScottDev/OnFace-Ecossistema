/**
 * Tipos das telas de uso da Callface AI: os do contrato (`lib/callface-ai/uso`)
 * e o formato das server actions de vínculo. Só `import type` — o módulo
 * importa `db` e Client Component não pode puxá-lo.
 */

export type {
  UsoDoCliente, ItemCarteiraDeUso, VinculoPendente, SugestaoDeVinculo, VinculoCallfaceAi,
  EvidenciaDoVinculo, FlagUso, DiaDeUso, UsuarioDeUso, Semaforo,
} from "@/lib/callface-ai/uso";
import type { ResultadoVinculo } from "@/lib/callface-ai/vinculo-escrita";
export type { ResultadoVinculo };

/** As server actions de `lib/callface-ai/vinculo-actions`, passadas como prop. */
export type AcoesDeVinculo = {
  confirmar: (input: { empresaId: string; candidatoId: string }) => Promise<ResultadoVinculo>;
  remover: (input: { empresaId: string; motivo: string }) => Promise<ResultadoVinculo>;
};

/** empresaId → minutos por dia dos últimos 30 dias (minissérie da carteira). */
export type SeriesDaCarteira = Record<string, number[]>;
