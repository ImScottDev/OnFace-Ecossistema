import { db } from "@/lib/db";
import { usuarios, organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext } from "@/lib/auth/tenant";

export default async function ConfiguracoesGeralPage() {
  const ctx = await getTenantContext();
  if (!ctx) return <div className="p-8 text-[var(--cf2-text-tertiary)]">Não autorizado</div>;
  const orgId = ctx.organizacaoId;

  const users = await db.select({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, ativo: usuarios.ativo,
  }).from(usuarios).where(eq(usuarios.organizacaoId, orgId)).limit(100);

  const [org] = await db.select({ nome: organizacoes.nome, slug: organizacoes.slug, dominio: organizacoes.dominio })
    .from(organizacoes).where(eq(organizacoes.id, orgId)).limit(1);

  return (
    <div className="space-y-6">
      <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
        <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)] mb-4">Organização</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div><p className="text-[var(--cf2-text-tertiary)] text-xs mb-1">Nome</p><p className="text-[var(--cf2-text-primary)]">{org?.nome}</p></div>
          <div><p className="text-[var(--cf2-text-tertiary)] text-xs mb-1">Slug</p><p className="text-[var(--cf2-text-primary)]">{org?.slug}</p><p className="text-[10px] text-[var(--cf2-text-tertiary)]">Identificador único da organização. Usado em URLs e integrações.</p></div>
          <div><p className="text-[var(--cf2-text-tertiary)] text-xs mb-1">Domínio</p><p className="text-[var(--cf2-text-primary)]">{org?.dominio || "—"}</p><p className="text-[10px] text-[var(--cf2-text-tertiary)]">Domínio personalizado do CRM (opcional).</p></div>
        </div>
      </div>

      <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
        <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)] mb-4">Usuários do CRM</h2>
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between py-2 border-b border-[var(--cf2-border-default)] last:border-0">
              <div>
                <p className="font-medium text-[var(--cf2-text-primary)]">{user.nome}</p>
                <p className="text-sm text-[var(--cf2-text-secondary)]">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-[var(--cf2-bg-surface-muted)] text-[var(--cf2-text-secondary)] capitalize">{user.role}</span>
                <span className={`w-2 h-2 rounded-full ${user.ativo ? "bg-green-500" : "bg-[var(--cf2-bg-surface-muted)]"}`} />
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-[var(--cf2-text-tertiary)]">Nenhum usuário cadastrado</p>}
        </div>
      </div>

      <div className="bg-[var(--cf2-bg-surface)] rounded-xl p-6 border border-[var(--cf2-border-default)]">
        <h2 className="text-lg font-semibold text-[var(--cf2-text-primary)] mb-1">Integrações</h2>
        <p className="text-[10px] text-[var(--cf2-text-tertiary)] mb-4">Configure em Configurações &gt; Integrações.</p>
        <div className="space-y-3 text-sm text-[var(--cf2-text-secondary)]">
          <div className="flex items-center justify-between py-2 border-b border-[var(--cf2-border-default)]">
            <span>Meta Conversions API (CAPI)</span>
            <span className={process.env.META_PIXEL_ID ? "text-[var(--cf2-success-text)]" : "text-[var(--cf2-warning-text)]"}>
              {process.env.META_PIXEL_ID ? "Configurado" : "Pendente"}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span>Google Ads Offline Conversions</span>
            <span className={process.env.GOOGLE_ADS_CUSTOMER_ID ? "text-[var(--cf2-success-text)]" : "text-[var(--cf2-warning-text)]"}>
              {process.env.GOOGLE_ADS_CUSTOMER_ID ? "Configurado" : "Pendente"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
