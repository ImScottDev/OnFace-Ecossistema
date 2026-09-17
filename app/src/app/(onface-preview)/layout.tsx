import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Providers } from "@/components/crm/Providers";
import { OnfaceThemeRoot } from "@/components/onface/OnfaceThemeRoot";
import { OnfaceTopbar } from "@/components/onface/OnfaceTopbar";
import { TooltipProvider } from "@/components/ui/tooltip";

export const dynamic = "force-dynamic";

export default async function OnfacePreviewLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <Providers session={session} variant="onface"><OnfaceThemeRoot /><TooltipProvider delayDuration={200}><div className="onface-app-shell"><OnfaceTopbar />{children}</div></TooltipProvider></Providers>;
}
