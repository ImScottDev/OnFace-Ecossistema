"use client";

import { useRouter } from "next/navigation";
import type { DetalheProposta } from "@/app/(onface-preview)/onface-preview/propostas/actions";
import { AcoesProposta, ApoioProposta, CorpoProposta, TagsProposta } from "./PropostaCorpo";
import { Bloco, PaginaColunas, PaginaEntidade } from "./pagina";
import { type AcaoInicialProposta, urlDoFluxoProposta } from "./fluxoProposta";

/** Leitura integral da proposta. Alterações comerciais continuam no fluxo
 * guiado já existente, que preserva catálogo, versões e gates do domínio. */
export function DetalhePropostaPagina({ proposta, voltar }: { proposta: DetalheProposta; voltar: string }) {
  const router = useRouter();
  // A tela completa é leitura. Toda alteração volta ao mesmo compositor da
  // lista pela rota estável, preservando proposta e a intenção do usuário.
  const abrirFluxo = (acao?: AcaoInicialProposta) => {
    router.push(acao
      ? urlDoFluxoProposta(voltar, proposta.id, acao)
      : `${voltar}/nova?${new URLSearchParams({ proposta: proposta.id })}`,
    );
  };
  const acoes = {
    enviar: () => abrirFluxo("enviar"),
    revisar: async () => { abrirFluxo("revisar"); return true; },
    completarJuridicos: () => abrirFluxo("juridicos"),
  };
  const rotaBase = voltar.replace(/\/propostas$/, "");

  return (
    <PaginaEntidade
      voltar={{ href: voltar, rotulo: "Voltar para Propostas" }}
      titulo={`Proposta #${proposta.numero} · v${proposta.versao}`}
      subtitulo={proposta.empresa.nome ?? proposta.oportunidade.titulo ?? undefined}
      tags={<TagsProposta proposta={proposta} />}
    >
      <PaginaColunas
        principal={<>
          <Bloco titulo="Ações">
            <div className="ov-acoes">
              <AcoesProposta proposta={proposta} pendente={false} acoes={acoes} rotaBase={rotaBase} />
            </div>
          </Bloco>
          <CorpoProposta proposta={proposta} pendente={false} bloqueio={null} variante="pagina" acoes={acoes} />
        </>}
        lateral={<ApoioProposta proposta={proposta} variante="pagina" contato={proposta.contato} acoes={acoes} />}
      />
    </PaginaEntidade>
  );
}
