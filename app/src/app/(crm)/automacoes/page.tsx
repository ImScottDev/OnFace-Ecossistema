import { db } from "@/lib/db";
import { automacoes } from "@/lib/db/schema";
import { Zap } from "lucide-react";

export default async function AutomacoesPage() {
  const rules = await db.select().from(automacoes).limit(100);

  return (
    <div className="page-scroll space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Automações</h1>
      </div>

      {rules.length === 0 ? (
        <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-12 border border-white/[0.06] text-center">
          <Zap className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-white/70">Nenhuma automação configurada</h2>
          <p className="text-sm text-white/40 mt-1">
            Automações serão adicionadas em breve: notificações de lead novo, follow-up automático, alertas de inatividade.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-[rgba(255,255,255,0.03)] rounded-xl p-5 border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">{rule.nome}</h3>
                  <p className="text-sm text-white/50">
                    Gatilho: {rule.gatilho} → Ação: {rule.acao}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${rule.ativo ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-white/50"}`}>
                  {rule.ativo ? "Ativa" : "Inativa"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
