import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { matrizDePermissoes, podeEditarPermissoes, PAPEL_TRAVADO } from "@/lib/ajustes/permissoes";
import { MatrizPermissoes } from "@/components/onface/ajustes/MatrizPermissoes";
import { ROLE_AJUDA, ROLE_LABEL } from "../membros/roles";

export const metadata = { title: "Permissões" };

/**
 * Permissões por papel. Substitui o cartão "Em construção" do índice antigo.
 *
 * Qualquer pessoa logada VÊ a matriz (saber o que o próprio papel pode é
 * transparência, não segredo); só admin edita — a regra mora em
 * `podeEditarPermissoes` e é reaplicada na action, não só aqui.
 */
export default async function PermissoesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  const [{ papeis, permissoes }, podeEditar] = await Promise.all([
    matrizDePermissoes(ctx.organizacaoId),
    podeEditarPermissoes(ctx),
  ]);

  // Rótulo e ajuda em português com acento vêm da fonte única da UI de equipe;
  // o nome gravado em `roles` ("Coordenacao") é seed sem acento.
  const papeisUi = papeis.map((p) => ({
    ...p,
    rotulo: ROLE_LABEL[p.codigo] ?? p.nome,
    ajuda: (ROLE_AJUDA as Record<string, string>)[p.codigo] ?? p.descricao ?? "",
    travado: p.codigo === PAPEL_TRAVADO,
  }));

  const motivoLeitura = ctx.isViewingAs
    ? "Você está no modo \"ver como\": a matriz fica só para leitura."
    : !podeEditar ? "Só administradores podem alterar permissões. Você está vendo a matriz em modo leitura." : null;

  return (
    <div className="flex flex-col">
      <p className="aj-aviso">
        Cada marca concede a permissão a <strong>todas as pessoas</strong> do papel. Hoje obedecem a esta
        matriz: <strong>Financeiro</strong>, <strong>Automações e agentes de IA</strong>,{" "}
        <strong>integrações</strong>, parte da <strong>pré-vendas</strong> e de <strong>CS</strong>, e o teto
        dos <strong>tokens de API</strong>. O restante do CRM ainda
        decide pelo papel da pessoa, em <strong>Membros</strong>.
      </p>
      {motivoLeitura && <p className="aj-aviso" role="status">{motivoLeitura}</p>}
      {papeis.length === 0 ? (
        <p className="aj-aviso">
          Esta organização ainda não tem papéis cadastrados no RBAC. Enquanto isso, o acesso é decidido pelo papel
          de cada pessoa em Membros.
        </p>
      ) : (
        <MatrizPermissoes
          papeis={papeisUi}
          permissoes={permissoes}
          podeEditar={podeEditar && !ctx.isViewingAs}
        />
      )}
    </div>
  );
}
