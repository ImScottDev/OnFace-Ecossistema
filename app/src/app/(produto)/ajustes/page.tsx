import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth/tenant";
import { resumoAjustes } from "@/lib/ajustes/resumo";
import { isAdminView } from "@/lib/auth/roles";

export const metadata = { title: "Ajustes" };

/**
 * Índice de Ajustes no arquétipo H do ONFACE (01/10/2026).
 *
 * Era uma grade de 28 cartões, 7 deles "Em construção": a coluna de seções do
 * layout já lista todo destino real, então repetir os destinos aqui era
 * redundante, e os cartões sem tela eram promessa, não ajuste. Os sete saíram
 * sem perda — nenhum levava a lugar algum (Permissões, que era um deles, agora
 * tem tela própria em /ajustes/permissoes).
 *
 * O espaço virou o que um índice de configurações deveria responder de cara:
 * em que estado está esta organização? Cada grupo é um cartão com título,
 * ajuda, fatos derivados do banco (escopo da organização) e o link para a
 * seção que resolve o que o fato acusa.
 */

type Estado = "ok" | "erro" | "pendente" | "neutro";

function Fato({ rotulo, valor, estado }: { rotulo: string; valor: string; estado?: Estado }) {
  return (
    <div className="aj-fato">
      <dt>{rotulo}</dt>
      <dd className={estado ? "aj-estado" : undefined} data-estado={estado}>{valor}</dd>
    </div>
  );
}

function Grupo({
  titulo, ajuda, children, links,
}: {
  titulo: string;
  ajuda: string;
  children?: React.ReactNode;
  links: { rotulo: string; href: string }[];
}) {
  return (
    <section className="aj-grupo" aria-labelledby={`aj-${titulo}`}>
      <div className="aj-grupo-cabeca">
        <h2 className="aj-grupo-titulo" id={`aj-${titulo}`}>{titulo}</h2>
        <p className="aj-grupo-ajuda">{ajuda}</p>
      </div>
      {children ? <dl className="aj-fatos">{children}</dl> : null}
      <div className="aj-links">
        {links.map((l) => <Link key={l.href} href={l.href} className="aj-link">{l.rotulo}</Link>)}
      </div>
    </section>
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default async function AjustesPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");

  /* Fora da gestão o índice abre (16/10/2026: o time clicava em Ajustes e
     caía no Início), mas mostra só o que o papel alcança. O estado da
     organização — membros, convites, tokens de API, credenciais de IA — é
     leitura de gestão: oferecê-lo aqui seria contornar o mesmo gate que
     barra `/ajustes/membros`. Os links pessoais são os de `PESSOAIS`
     no middleware. */
  if (!isAdminView(ctx.userRole)) {
    return (
      <div className="aj-grupos">
        <Grupo
          titulo="Suas conexões"
          ajuda="Sua conta de e-mail e seu número de WhatsApp. Cada pessoa conecta os próprios."
          links={[
            { rotulo: "E-mail", href: "/ajustes/email" },
            { rotulo: "WhatsApp", href: "/ajustes/whatsapp" },
          ]}
        />
      </div>
    );
  }

  const r = await resumoAjustes(ctx.organizacaoId);

  // "Conectado" só quando TODAS conectadas; parte caída é pendência, não ok —
  // sessão desconectada é mensagem de WhatsApp que não sai.
  const estadoWhats: Estado = r.whatsapp.total === 0 ? "neutro"
    : r.whatsapp.conectadas === r.whatsapp.total ? "ok"
    : r.whatsapp.conectadas === 0 ? "erro" : "pendente";
  const estadoEmail: Estado = r.email.total === 0 ? "neutro" : r.email.comErro > 0 ? "erro" : "ok";

  return (
    <div className="aj-grupos">
      <Grupo
        titulo="Organização"
        ajuda="Identidade da organização e quem trabalha nela."
        links={[{ rotulo: "Geral", href: "/ajustes/geral" }, { rotulo: "Membros", href: "/ajustes/membros" }]}
      >
        <Fato rotulo="Nome" valor={r.organizacao?.nome ?? "—"} />
        <Fato rotulo="Slug" valor={r.organizacao?.slug || "—"} />
        <Fato rotulo="Pessoas ativas" valor={String(r.equipe.ativos)} />
        <Fato
          rotulo="Convites pendentes"
          valor={String(r.equipe.convitesPendentes)}
          estado={r.equipe.convitesPendentes > 0 ? "pendente" : undefined}
        />
        {r.equipe.convitesVencidos > 0 && (
          // Só aparece quando existe: o link Membros, logo abaixo, é onde se reenvia.
          <Fato
            rotulo="Convites vencidos"
            valor={plural(r.equipe.convitesVencidos, "convite vencido", "convites vencidos")}
            estado="pendente"
          />
        )}
      </Grupo>

      <Grupo
        titulo="Acesso"
        ajuda="Papéis e o que cada um pode fazer. Financeiro, automações, agentes, CS e tokens de API já obedecem a esta matriz."
        links={[{ rotulo: "Permissões", href: "/ajustes/permissoes" }, { rotulo: "Tokens da API", href: "/ajustes/api-tokens" }]}
      >
        <Fato rotulo="Papéis" valor={String(r.acesso.papeis)} />
        <Fato
          rotulo="Pessoas sem papel vinculado"
          valor={String(r.acesso.ativosSemPapelVinculado)}
          estado={r.acesso.ativosSemPapelVinculado > 0 ? "pendente" : "ok"}
        />
        <Fato rotulo="Tokens de API ativos" valor={String(r.tokensApiAtivos)} />
      </Grupo>

      <Grupo
        titulo="Canais"
        ajuda="Por onde o ONFACE fala com o cliente. Sessão desconectada é mensagem que não sai."
        links={[
          { rotulo: "WhatsApp", href: "/ajustes/whatsapp" },
          { rotulo: "E-mail", href: "/ajustes/email" },
          { rotulo: "Templates de e-mail", href: "/ajustes/email/templates" },
        ]}
      >
        <Fato
          rotulo="WhatsApp"
          valor={r.whatsapp.total === 0 ? "Nenhuma sessão" : `${r.whatsapp.conectadas} de ${r.whatsapp.total} conectadas`}
          estado={estadoWhats}
        />
        <Fato
          rotulo="Caixas de e-mail"
          valor={r.email.total === 0 ? "Nenhuma conectada"
            : r.email.comErro > 0 ? `${plural(r.email.comErro, "com erro", "com erro")} de ${r.email.total}`
            : plural(r.email.ativas, "sincronizando", "sincronizando")}
          estado={estadoEmail}
        />
      </Grupo>

      <Grupo
        titulo="Integrações"
        ajuda="Provedores de IA e de dados da organização. Chaves nunca aparecem aqui, só se existem."
        links={[{ rotulo: "Integrações e IA", href: "/ajustes/integracoes" }, { rotulo: "AI SDR", href: "/ajustes/ai-sdr" }]}
      >
        <Fato
          rotulo="Credenciais de IA"
          valor={r.ia.credenciaisComErro > 0 ? `${r.ia.credenciaisComErro} com erro`
            : r.ia.credenciaisAtivas > 0 ? plural(r.ia.credenciaisAtivas, "ativa", "ativas") : "Nenhuma"}
          estado={r.ia.credenciaisComErro > 0 ? "erro" : r.ia.credenciaisAtivas > 0 ? "ok" : "pendente"}
        />
        <Fato
          rotulo="Apollo"
          valor={r.apolloConfigurado ? "Configurado" : "Não configurado"}
          estado={r.apolloConfigurado ? "ok" : "pendente"}
        />
      </Grupo>

      <Grupo
        titulo="Comercial"
        ajuda="Como o funil está montado: etapas, campos, distribuição de leads e o que se vende."
        links={[
          { rotulo: "Pipeline", href: "/ajustes/pipeline" },
          { rotulo: "Campos custom", href: "/ajustes/campos-custom" },
          { rotulo: "Leads", href: "/ajustes/leads" },
          { rotulo: "Catálogo", href: "/ajustes/catalogo" },
          { rotulo: "Serviços", href: "/ajustes/servicos" },
          { rotulo: "Contratos", href: "/ajustes/contratos" },
        ]}
      />

      <Grupo
        titulo="Sistema"
        ajuda="Conferências de qualidade dos dados da organização."
        // Notificações, Tracking, Enriquecimento, ICP e Handover saíram do índice
        // em 01/10/2026: gravam em organizacoes.settings chaves que nenhum
        // processo lê (ver `semEfeito` em ./Nav). Oferecê-los aqui era prometer
        // alerta, conversão e e-mail que nunca saem.
        links={[{ rotulo: "Qualidade de dados", href: "/ajustes/qualidade-dados" }]}
      />
    </div>
  );
}
