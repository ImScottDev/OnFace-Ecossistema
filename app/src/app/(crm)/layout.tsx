import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { Providers } from "@/components/crm/Providers";
import { ViewAsBanner } from "@/components/crm/ViewAsBanner";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <Providers session={session}>
      <ViewAsBanner />
      <div className="flex h-dvh overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <CrmSidebar />
        <main className="flex-1 overflow-hidden min-h-0 pt-12 lg:pt-0">{children}</main>
      </div>
    </Providers>
  );
}
