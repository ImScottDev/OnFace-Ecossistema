import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { isAdminView } from "@/lib/auth/roles";
import { carregarPerfil } from "@/lib/perfil/consultas";
import { Pagina, PaginaCabecalho } from "@/components/onface/shell/Pagina";
import { Perfil } from "@/components/onface/perfil/Perfil";

export const metadata = { title: "Minha conta" };
export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  // ctx.userId já é o usuário efetivo (em "visualizar como", o visualizado):
  // a tela mostra o que ele veria, e a escrita é travada por isViewingAs aqui
  // e no Hono.
  const perfil = await carregarPerfil(ctx.organizacaoId, ctx.userId);
  if (!perfil) notFound();

  return (
    <Pagina>
      <PaginaCabecalho titulo="Minha conta" />
      <Perfil
        perfil={perfil}
        visualizandoComo={ctx.isViewingAs}
        // Papel efetivo, o mesmo que o middleware usa para liberar /ajustes.
        podeGerirOrg={isAdminView(ctx.userRole)}
        // Só a presença da credencial; o segredo nunca sai do servidor. Sem
        // ela, o botão de conectar levaria a um erro do provedor.
        microsoftConfigurado={Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)}
        googleConfigurado={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      />
    </Pagina>
  );
}
