"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, PhoneOutgoing } from "lucide-react";
import { Cf2Button } from "@/components/crm2/ui/Button";
import { Cf2Input, Cf2Label } from "@/components/crm2/ui/Input";
import { SecaoAjuste } from "@/components/onface/ajustes/Secao";
import { ligarDeTeste } from "./actions";

/**
 * Ligação de teste do agente de voz.
 *
 * O fluxo de verdade começa num lead que cai em Novo, e esperar um lead real
 * para conferir um ajuste de roteiro é lento. Aqui se preenche exatamente o
 * que o CRM mandaria (as variáveis que o agente recebe) e a ligação sai na
 * hora, sem criar lead, sem mexer no funil.
 */
const CAMPOS = [
  { chave: "nome", rotulo: "Nome de quem atende", dica: "O agente abre chamando por este nome.", exemplo: "Scott" },
  { chave: "telefone", rotulo: "Telefone", dica: "DDD + número. O código do país entra sozinho.", exemplo: "11969044205" },
  { chave: "email", rotulo: "E-mail já cadastrado", dica: "O agente confirma este e-mail em vez de perguntar do zero.", exemplo: "scott@scottdev.com.br" },
  { chave: "empresa", rotulo: "Empresa", dica: "Usada na conversa, em vez de perguntar o nome dela.", exemplo: "Scott Studio" },
  { chave: "origem", rotulo: "Como chegou", dica: "Explica o motivo da ligação logo na abertura.", exemplo: "anúncio no Instagram" },
] as const;

type Campos = Record<(typeof CAMPOS)[number]["chave"], string>;

export default function TesteDoAgenteDeVoz() {
  const [v, setV] = useState<Campos>({ nome: "", telefone: "", email: "", empresa: "", origem: "" });
  const [ligando, setLigando] = useState(false);
  const [ultimo, setUltimo] = useState<string | null>(null);

  async function ligar() {
    setLigando(true);
    setUltimo(null);
    try {
      const r = await ligarDeTeste(v);
      setUltimo(r.mensagem);
      if (r.ok) toast.success("Ligação disparada"); else toast.error(r.mensagem);
    } catch {
      setUltimo("Não consegui falar com a Callface. Tente de novo em instantes.");
      toast.error("Falha ao disparar a ligação");
    } finally {
      setLigando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/ajustes/integracoes" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Integrações
      </Link>

      <SecaoAjuste
        titulo="Ligação de teste do agente de voz"
        ajuda="Dispara uma ligação do agente de primeiro contato com o contexto que você preencher, sem criar lead e sem mexer no funil. Serve para ouvir o roteiro antes de apontar o fluxo de Pré-vendas para ele. Cada disparo gasta minuto de agente."
      >
        <div className="flex flex-col gap-3">
          {CAMPOS.map((c) => (
            <div key={c.chave} className="flex flex-col gap-1">
              <Cf2Label htmlFor={`campo-${c.chave}`}>{c.rotulo}</Cf2Label>
              <Cf2Input
                id={`campo-${c.chave}`}
                placeholder={c.exemplo}
                value={v[c.chave]}
                onChange={(e) => setV((a) => ({ ...a, [c.chave]: e.target.value }))}
              />
              <span className="text-xs text-muted-foreground">{c.dica}</span>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <Cf2Button onClick={ligar} disabled={ligando || !v.nome.trim() || !v.telefone.trim()}>
              <PhoneOutgoing size={15} /> {ligando ? "Disparando…" : "Ligar agora"}
            </Cf2Button>
            <span className="text-xs text-muted-foreground">
              O telefone toca em alguns segundos. A gravação e o resumo aparecem depois no histórico.
            </span>
          </div>

          {ultimo ? <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">{ultimo}</p> : null}
        </div>
      </SecaoAjuste>
    </div>
  );
}
