"use client";

import { Fragment, useState, useTransition } from "react";
import { acaoAlterarPermissao } from "@/app/(produto)/ajustes/permissoes/actions";
import "./ajustes.css";

/** Nome do domínio em português; o código vem do catálogo `permissions.dominio`. */
const DOMINIO: Record<string, string> = {
  identity: "Empresas",
  acquisition: "Pré-vendas",
  sales: "Vendas",
  finance: "Financeiro",
  "customer-success": "Customer Success",
  automation: "Automações",
  intelligence: "Inteligência artificial",
  integrations: "Integrações",
  admin: "Administração",
};

/** Mesmo texto de ERRO_ULTIMA_PERMISSAO (lib/ajustes/permissoes): repetido
 *  porque aquele módulo importa o banco e não pode entrar no bundle do cliente. */
const ULTIMA_PERMISSAO =
  "Um papel precisa de pelo menos uma permissão; sem nenhuma, o acesso volta para a regra antiga do papel.";

export interface PapelUi {
  id: string;
  codigo: string;
  rotulo: string;
  ajuda: string;
  pessoas: number;
  permissoes: string[];
  travado: boolean;
}

export interface PermissaoUi {
  codigo: string;
  dominio: string;
  descricao: string | null;
}

/**
 * Matriz papel × permissão. Checkbox nativo de propósito: é exatamente um
 * liga/desliga com foco, teclado e leitor de tela de graça.
 *
 * Otimista por célula: a marca muda na hora e volta se a action recusar —
 * esperar o round-trip com a célula "presa" parecia que o clique não pegou.
 * O servidor revalida a rota, então o reload sempre mostra o que persistiu.
 */
export function MatrizPermissoes({
  papeis, permissoes, podeEditar,
}: {
  papeis: PapelUi[];
  permissoes: PermissaoUi[];
  podeEditar: boolean;
}) {
  const [concedidas, setConcedidas] = useState(
    () => new Set(papeis.flatMap((p) => p.permissoes.map((c) => `${p.id}|${c}`))),
  );
  // Set e não uma chave só: com uma chave, a resposta da célula A destravava a
  // célula B ainda em voo e permitia um segundo clique duplicado nela.
  const [pendentes, setPendentes] = useState<ReadonlySet<string>>(() => new Set());
  const marcarPendente = (chave: string, em: boolean) => setPendentes((atual) => {
    const novo = new Set(atual);
    if (em) novo.add(chave); else novo.delete(chave);
    return novo;
  });
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  function alternar(papel: PapelUi, codigo: string) {
    const chave = `${papel.id}|${codigo}`;
    const conceder = !concedidas.has(chave);
    const aplicar = (tem: boolean) => setConcedidas((atual) => {
      const novo = new Set(atual);
      if (tem) novo.add(chave); else novo.delete(chave);
      return novo;
    });

    setErro(null);
    marcarPendente(chave, true);
    aplicar(conceder);
    iniciar(async () => {
      const r = await acaoAlterarPermissao(papel.id, codigo, conceder);
      if (!r.ok) {
        aplicar(!conceder);
        setErro(r.erro);
      }
      marcarPendente(chave, false);
    });
  }

  // Agrupa por domínio mantendo a ordem do catálogo (já vem ordenado).
  const grupos: { dominio: string; itens: PermissaoUi[] }[] = [];
  for (const p of permissoes) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dominio === p.dominio) ultimo.itens.push(p);
    else grupos.push({ dominio: p.dominio, itens: [p] });
  }

  return (
    <>
      {erro && <p className="aj-aviso" data-tom="erro" role="alert">{erro}</p>}
      <div className="aj-matriz-moldura">
        <table className="aj-matriz">
          <caption className="sr-only">Permissões concedidas a cada papel</caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left" }}>Permissão</th>
              {papeis.map((p) => (
                <th key={p.id} scope="col" title={p.ajuda}>
                  {p.rotulo}
                  <small>{p.pessoas === 1 ? "1 pessoa" : `${p.pessoas} pessoas`}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <Fragment key={g.dominio}>
                <tr className="aj-dominio">
                  <th scope="rowgroup" colSpan={papeis.length + 1}>{DOMINIO[g.dominio] ?? g.dominio}</th>
                </tr>
                {g.itens.map((perm) => (
                  <tr key={perm.codigo}>
                    <th scope="row">
                      {perm.descricao ?? perm.codigo}
                      <span>{perm.codigo}</span>
                    </th>
                    {papeis.map((papel) => {
                      const chave = `${papel.id}|${perm.codigo}`;
                      const marcada = concedidas.has(chave);
                      // Última marcada da coluna fica travada: papel vazio cai no
                      // gate legado e recupera o acesso todo (o servidor recusa
                      // também; aqui é para não oferecer um clique que vai falhar).
                      const ultima = marcada
                        && permissoes.every((o) => o.codigo === perm.codigo || !concedidas.has(`${papel.id}|${o.codigo}`));
                      // Motivo do bloqueio vai no title E no aviso do topo: um
                      // checkbox cinza sem explicação é botão mentiroso.
                      const motivo = papel.travado
                        ? "Administrador tem todas as permissões; travado para ninguém perder acesso à própria gestão."
                        : !podeEditar ? "Somente leitura"
                        : ultima ? ULTIMA_PERMISSAO : undefined;
                      return (
                        <td key={papel.id}>
                          <input
                            type="checkbox"
                            checked={marcada}
                            disabled={!podeEditar || papel.travado || ultima || pendentes.has(chave)}
                            onChange={() => alternar(papel, perm.codigo)}
                            title={motivo}
                            aria-label={`${perm.descricao ?? perm.codigo} para ${papel.rotulo}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {papeis.some((p) => p.travado) && (
        <p className="aj-aviso" style={{ marginTop: "0.875rem" }}>
          A coluna <strong>Administrador</strong> é travada: ela sempre tem tudo, para que nenhuma mudança aqui tire
          de todos os administradores o acesso a esta própria tela.
        </p>
      )}
    </>
  );
}
