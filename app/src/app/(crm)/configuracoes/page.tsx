import { db } from "@/lib/db";
import { usuarios, organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";

export default async function ConfiguracoesGeralPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <div className="p-8 text-white/30">Não autorizado</div>;
  const orgId = ctx.organizacaoId;

  const users = await db.select({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, ativo: usuarios.ativo,
  }).from(usuarios).where(eq(usuarios.organizacaoId, orgId)).limit(100);

  const [org] = await db.select({ nome: organizacoes.nome, slug: organizacoes.slug, dominio: organizacoes.dominio })
    .from(organizacoes).where(eq(organizacoes.id, orgId)).limit(1);

  return (
    <div className="space-y-6">
      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white mb-4">Organização</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div><p className="text-white/40 text-xs mb-1">Nome</p><p className="text-white">{org?.nome}</p></div>
          <div><p className="text-white/40 text-xs mb-1">Slug</p><p className="text-white">{org?.slug}</p><p className="text-[10px] text-white/25">Identificador único da organização. Usado em URLs e integrações.</p></div>
          <div><p className="text-white/40 text-xs mb-1">Domínio</p><p className="text-white">{org?.dominio || "—"}</p><p className="text-[10px] text-white/25">Domínio personalizado do CRM (opcional).</p></div>
        </div>
      </div>

      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white mb-4">Usuários do CRM</h2>
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div>
                <p className="font-medium text-white">{user.nome}</p>
                <p className="text-sm text-white/50">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 capitalize">{user.role}</span>
                <span className={`w-2 h-2 rounded-full ${user.ativo ? "bg-green-500" : "bg-white/20"}`} />
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-white/40">Nenhum usuário cadastrado</p>}
        </div>
      </div>

      <div className="bg-[rgba(255,255,255,0.03)] rounded-xl p-6 border border-white/[0.06]">
        <h2 className="text-lg font-semibold text-white mb-1">Integrações</h2>
        <p className="text-[10px] text-white/25 mb-4">Configure em Configurações &gt; Integrações.</p>
        <div className="space-y-3 text-sm text-white/70">
          <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
            <span>Meta Conversions API (CAPI)</span>
            <span className={process.env.META_PIXEL_ID ? "text-emerald-400" : "text-amber-400"}>
              {process.env.META_PIXEL_ID ? "Configurado" : "Pendente"}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span>Google Ads Offline Conversions</span>
            <span className={process.env.GOOGLE_ADS_CUSTOMER_ID ? "text-emerald-400" : "text-amber-400"}>
              {process.env.GOOGLE_ADS_CUSTOMER_ID ? "Configurado" : "Pendente"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
