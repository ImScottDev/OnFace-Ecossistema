"use client";

/**
 * Dados jurídicos e endereço da Empresa.
 *
 * Vive fora das telas de propósito: o gate `dados_juridicos_incompletos`
 * aparece em Propostas, em Contatos e na página da Empresa, e mandar o
 * operador para outra tela para preencher seis campos é o que o Kauã chamou
 * de "Completar dados apresenta bugs" — o CTA saía do contexto, perdia a
 * proposta de vista e não voltava. Aqui a ação termina onde começou.
 */

import { useState } from "react";
import type { DadosJuridicos } from "@/lib/vendas/propostas";
import { AvisoBloqueio, Dialogo } from "./ui";

export interface JuridicosIniciais extends DadosJuridicos {
  /** Identidade da empresa, para recarregar o formulário ao trocar de alvo. */
  empresaId: string | null;
}

export function DialogoJuridicos({ aberto, iniciais, faltando, pendente, bloqueio, aoFechar, aoConfirmar }: {
  aberto: boolean;
  iniciais: JuridicosIniciais | null;
  faltando?: string[];
  pendente: boolean;
  bloqueio: { mensagem: string } | null;
  aoFechar: () => void;
  aoConfirmar: (dados: DadosJuridicos) => Promise<boolean>;
}) {
  const [form, setForm] = useState<DadosJuridicos>({});
  const [ultima, setUltima] = useState<string | null>(null);

  // Trocar de empresa com o diálogo aberto precisa recarregar o formulário,
  // senão os dados de uma empresa seriam gravados em outra.
  if (aberto && iniciais && iniciais.empresaId !== ultima) {
    setUltima(iniciais.empresaId);
    const { empresaId: _ignorado, ...valores } = iniciais;
    setForm(valores);
  }

  const campo = (c: keyof DadosJuridicos) => ({
    value: (form[c] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [c]: e.target.value })),
  });

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo="Dados jurídicos e endereço"
      descricao="Proposta contratual exige esses campos. Eles ficam na Empresa, disponíveis para as próximas propostas e contratos."
      largura="larga">
      <div className="ov-form">
        {bloqueio ? <AvisoBloqueio bloqueio={bloqueio} /> : null}
        {faltando && faltando.length > 0 ? (
          <p className="ov-nota">Falta preencher: {faltando.join(", ")}.</p>
        ) : null}
        <div className="ov-form-linha">
          <label><span>Razão social *</span><input {...campo("razaoSocial")} /></label>
          <label><span>CNPJ *</span><input {...campo("cnpj")} /></label>
          <label><span>Rua *</span><input {...campo("logradouro")} /></label>
          <label><span>Número *</span><input {...campo("numero")} /></label>
          <label><span>Complemento</span><input {...campo("complemento")} /></label>
          <label><span>Bairro *</span><input {...campo("bairro")} /></label>
          <label><span>Cidade *</span><input {...campo("cidade")} /></label>
          <label><span>Estado *</span><input {...campo("estado")} /></label>
          <label><span>CEP *</span><input {...campo("cep")} /></label>
        </div>
        <div className="ov-form-rodape">
          <button type="button" className="ov-botao" data-variante="neutro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="ov-botao" disabled={pendente}
            onClick={() => aoConfirmar(form)}>Salvar na empresa</button>
        </div>
      </div>
    </Dialogo>
  );
}
