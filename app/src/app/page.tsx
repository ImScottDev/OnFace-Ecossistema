import { redirect } from "next/navigation";

// Saneamento CRM2 (16/08): raiz do domínio ia direto pro dashboard legado
// (MVP), ignorando o App Shell novo por completo — todo mundo que abria
// crm.callface.io caía fora do CRM2 sem nenhuma navegação.
export default function Home() {
  redirect("/inicio");
}
