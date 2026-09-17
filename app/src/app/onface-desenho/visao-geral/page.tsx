import { VisaoGeral } from "@/components/onface/visao-geral/VisaoGeral";
import { DADOS_VISAO_GERAL } from "@/components/onface/visao-geral/mock";

export const metadata = { title: "ONFACE — Visão Geral (desenho)" };
export const dynamic = "force-dynamic";

/**
 * Banco de desenho da Visão Geral.
 *
 * Existe só para validar a tela sem sessão, enquanto o conteúdo é mock e não
 * há nada real para proteger. O layout do grupo já bloqueia a rota fora de
 * desenvolvimento; a versão oficial é `/onface-preview/visao-geral`.
 */
export default function DesenhoVisaoGeral() {
  return <VisaoGeral dados={DADOS_VISAO_GERAL} />;
}
