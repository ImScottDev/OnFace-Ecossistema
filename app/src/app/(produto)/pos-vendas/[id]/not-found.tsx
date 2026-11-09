import Link from "next/link";
import { SearchX } from "lucide-react";
import { Pagina } from "@/components/onface/shell/Pagina";
import { Button } from "@/components/ui/button";
import "@/components/onface/pos-venda/pos-venda.css";

export default function ProjetoNaoEncontrado() {
  return (
    <Pagina>
      <div className="pv">
        <div className="pv-estado" role="status">
          <span className="pv-estado-icone"><SearchX aria-hidden /></span>
          <h2>Projeto não encontrado</h2>
          <p>Ele pode ter sido removido, ou o endereço está incompleto. Volte ao board para achá-lo pelo nome da empresa.</p>
          <div className="pv-estado-acoes">
            <Button asChild variant="outline"><Link href="/pos-vendas">Voltar ao board</Link></Button>
          </div>
        </div>
      </div>
    </Pagina>
  );
}
