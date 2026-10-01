"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
import { Tag } from "@/components/onface/vendas/ui";
import { dataCurta } from "@/components/onface/vendas/formato";
import type { CampanhaLinha } from "@/lib/automacoes/campanhas";
import { OrigemLeads } from "./OrigemLeads";
import { statusCampanha } from "./status";
import "./campanhas.css";

export type AbaCampanhas = "outreach" | "origem";

/**
 * Campanhas no vocabulário ONFACE (arquétipo B, lista de dados), herdando o
 * que `crm2/automacoes/CampanhasWorkspace` fazia: listar as campanhas da org
 * com o estado real do disparo (o worker `campanha-sweep` envia e conta).
 *
 * A aba "Origem dos leads" existe porque o menu promete "Origem e performance
 * do que traz lead" e o dado já existe: `/api/relatorios/tracking` (Hono)
 * cruza utm_campaign do lead com o funil e com o gasto real da Meta. Não criei
 * query nova para isso — só a mostro aqui.
 *
 * A aba vive na URL (`?aba=origem`) para o deep-link e o reload manterem a
 * visão escolhida.
 */
export function Campanhas({ campanhas, aba, veOrigem, podeGerir }: {
  campanhas: CampanhaLinha[]; aba: AbaCampanhas;
  /** Gestão só: a aba Origem expõe gasto/CPL/ROAS/MRR (decidido no servidor). */
  veOrigem: boolean;
  podeGerir: boolean;
}) {
  return (
    <>
      <div className="ov-controles">
        {/* Links em vez do `Abas` (Tabs do Radix): a aba já vive na URL, e o
            useId do Radix divergia entre servidor e cliente (hydration). */}
        <nav className="cp-abas" aria-label="Visão das campanhas">
          <Link className="cp-aba" href="/automacoes/campanhas" aria-current={aba === "outreach" ? "page" : undefined}>
            Outreach <span className="cp-aba-cont">{campanhas.length}</span>
          </Link>
          {veOrigem ? (
            <Link className="cp-aba" href="/automacoes/campanhas?aba=origem" aria-current={aba === "origem" ? "page" : undefined}>
              Origem dos leads
            </Link>
          ) : null}
        </nav>
      </div>

      {aba === "origem" && veOrigem ? <OrigemLeads /> : <Outreach campanhas={campanhas} podeGerir={podeGerir} />}
    </>
  );
}

function Outreach({ campanhas, podeGerir }: { campanhas: CampanhaLinha[]; podeGerir: boolean }) {
  const router = useRouter();
  return (
    <>
      <div className="ov-tabela-wrap cp-superficie">
        <table className="ov-tabela">
          <colgroup>
            <col style={{ width: "38%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Campanha</th><th>Listas</th><th className="ov-num">Destinatários</th>
              <th>Status</th><th>Atualizada</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="ov-vazio">
                    <strong>Nenhuma campanha criada</strong>
                    <p>Monte um cold e-mail ou um disparo de WhatsApp para uma lista: salve, agende ou envie agora.</p>
                    {podeGerir
                      ? <Link className="ov-botao" href="/automacoes/campanhas/nova">Nova campanha</Link>
                      : <p>Criar campanha fica com a gestão.</p>}
                  </div>
                </td>
              </tr>
            ) : campanhas.map((c) => (
              <tr
                key={c.id}
                tabIndex={0}
                onClick={() => router.push(`/automacoes/campanhas/${c.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter") router.push(`/automacoes/campanhas/${c.id}`); }}
              >
                <td>
                  <div className="ov-tabela-principal">{c.nome}</div>
                  <div className="ov-tabela-apoio cp-canal">
                    {c.canal === "whatsapp" ? <MessageCircle aria-hidden /> : <Mail aria-hidden />}
                    {c.canal === "whatsapp" ? "WhatsApp" : "E-mail"}
                    {c.assunto ? ` · ${c.assunto}` : ""}
                  </div>
                </td>
                <td className="ov-tabela-apoio" title={c.listas.join(", ")}>{c.listas.join(", ") || "—"}</td>
                <td className="ov-num">{c.totalDestinatarios}</td>
                <td>
                  <Tag tom={statusCampanha(c.status).tom}>{statusCampanha(c.status).rotulo}</Tag>
                  {c.status !== "rascunho" && c.totalDestinatarios > 0 ? (
                    <div className="ov-tabela-apoio">{c.totalEnviados} de {c.totalDestinatarios} enviados</div>
                  ) : c.status === "agendada" && c.agendadaPara ? (
                    <div className="ov-tabela-apoio">{dataCurta(c.agendadaPara)}</div>
                  ) : null}
                </td>
                <td className="ov-tabela-apoio">{dataCurta(c.atualizadaEm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* "Não confunda com os vizinhos" (benchmark funilvivo §7): campanha e
          cadência resolvem problemas diferentes e moram em menus diferentes. */}
      <p className="ov-nota cp-rodape">
        Campanha é um disparo único para uma lista. Para uma sequência de passos no tempo, por lead, use{" "}
        <Link href="/automacoes/cadencias">Cadências</Link>.
      </p>
    </>
  );
}
