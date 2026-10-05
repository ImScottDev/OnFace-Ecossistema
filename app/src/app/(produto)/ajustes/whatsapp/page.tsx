import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { SecaoAjuste, PilulaEstado } from "@/components/onface/ajustes/Secao";
import { SessoesWhatsapp } from "./Sessoes";

export const metadata = { title: "WhatsApp · Ajustes" };

/**
 * WhatsApp em Ajustes (01/10/2026).
 *
 * A tela listava só as sessões DE QUEM ABRIA (a rota de status filtra pelo
 * dono, de propósito: conversa é privada de quem conectou o número). Para o
 * admin isso dava "0/0 conectadas" enquanto o índice de Ajustes dizia "0 de 8"
 * — as duas telas pareciam discordar. Agora a gestão vê também o panorama da
 * organização: de quem é cada número e se está conectado. Só o estado, nunca
 * mensagem, e sem ação sobre o número alheio (quem reconecta é o dono).
 */
export default async function AjustesWhatsAppPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const gestao = isAdminView(ctx.userRole);
  const daOrganizacao = gestao
    ? await db.execute<{
        id: string; rotulo: string; status: string; telefone: string | null;
        padrao: boolean; dono: string | null; ultima: string | null;
      }>(sql`
        SELECT s.id, coalesce(s.label, s.session_name) AS rotulo, s.status, s.phone_number AS telefone,
               s.is_default AS padrao, u.nome AS dono, s.last_connected_at::text AS ultima
          FROM whatsapp_sessao s
          LEFT JOIN usuarios u ON u.id = s.usuario_id
         WHERE s.organizacao_id = ${ctx.organizacaoId}::uuid
           AND (s.usuario_id IS DISTINCT FROM ${ctx.userId}::uuid)
         ORDER BY (s.status = 'connected') DESC, u.nome NULLS LAST, rotulo`)
    : [];

  const conectadas = daOrganizacao.filter((s) => s.status === "connected").length;

  return (
    <div className="aj-secoes">
      <SessoesWhatsapp />

      {gestao && (
        <SecaoAjuste
          titulo="Números da equipe"
          ajuda="Cada pessoa conecta o próprio número em Ajustes → WhatsApp, e as conversas dele ficam visíveis só para ela. Aqui a gestão vê o estado; quem reconecta é o dono."
          acao={daOrganizacao.length > 0 && (
            <PilulaEstado estado={conectadas === daOrganizacao.length ? "ok" : conectadas === 0 ? "erro" : "pendente"}>
              {conectadas} de {daOrganizacao.length} conectados
            </PilulaEstado>
          )}
        >
          {daOrganizacao.length === 0 ? (
            <div className="aj-vazio">Ninguém mais da equipe conectou um número ainda.</div>
          ) : (
            <ul className="aj-lista">
              {daOrganizacao.map((s) => (
                <li key={s.id} className="aj-linha">
                  <div className="aj-linha-corpo">
                    <span className="aj-linha-titulo">{s.rotulo}{s.padrao ? <span className="aj-mono"> · padrão da organização</span> : null}</span>
                    <span className="aj-linha-meta">
                      {s.dono ?? "Compartilhada"}{s.telefone ? ` · ${s.telefone}` : ""}
                      {s.status !== "connected" && s.ultima ? ` · conectado pela última vez em ${new Date(s.ultima).toLocaleDateString("pt-BR")}` : ""}
                    </span>
                  </div>
                  <PilulaEstado estado={s.status === "connected" ? "ok" : s.status === "waiting_qr" ? "pendente" : "erro"}>
                    {s.status === "connected" ? "Conectado" : s.status === "waiting_qr" ? "Aguardando QR" : "Desconectado"}
                  </PilulaEstado>
                </li>
              ))}
            </ul>
          )}
        </SecaoAjuste>
      )}
    </div>
  );
}
