"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Camera, Eye, EyeOff, LogOut } from "lucide-react";
import type { DadosPerfil, HorarioTrabalho } from "@/lib/perfil/consultas";
import "./perfil.css";

/**
 * /perfil — arquétipo H (Settings) do DS ONFACE: coluna de seções à esquerda,
 * grupos de formulário à direita, "salvar por grupo".
 *
 * Cada grupo salva sozinho e mostra o próprio retorno, porque são escritas em
 * endpoints diferentes (PATCH /api/perfil, POST /api/perfil, PUT
 * /api/agenda/disponibilidade). Um "Salvar tudo" único esconderia que um
 * deles falhou e o outro não.
 *
 * Depois de cada escrita: `router.refresh()` relê os dados do servidor (é
 * isso que prova que persistiu, não o estado local) e `updateSession()` faz a
 * topbar pegar o nome/foto novos sem recarregar a página.
 */

const PAPEL: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  gerente: "Gerente",
  director: "Diretoria",
  coordinator: "Coordenação",
  operations: "Operações",
  closer: "Closer",
  vendedor: "Closer",
  sdr: "SDR",
  leitor: "Leitor",
};

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const SECOES = [
  { id: "conta", rotulo: "Conta" },
  { id: "seguranca", rotulo: "Segurança" },
  { id: "agenda", rotulo: "Horário de trabalho" },
  { id: "integracoes", rotulo: "Integrações" },
  { id: "sessao", rotulo: "Sessão" },
];

type Msg = { tipo: "ok" | "erro"; texto: string } | null;

// Fuso fixo: o SSR roda em UTC em produção e o navegador em BRT. Sem isso o
// horário renderizado no servidor diverge do cliente e a hidratação reclama.
const FUSO = "America/Sao_Paulo";

function dataCurta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: FUSO });
}

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

async function lerErro(res: Response, padrao: string) {
  try {
    const j = await res.json();
    return (j.error as string) || padrao;
  } catch {
    return padrao;
  }
}

export function Perfil({
  perfil,
  visualizandoComo,
  podeGerirOrg,
  microsoftConfigurado,
  googleConfigurado,
}: {
  perfil: DadosPerfil;
  /** Admin em "visualizar como": a tela mostra a conta do outro, mas não deixa escrever nela. */
  visualizandoComo: boolean;
  /** Mesmo critério do middleware (isAdminView): sem ele, /ajustes redireciona para /inicio. */
  podeGerirOrg: boolean;
  microsoftConfigurado: boolean;
  googleConfigurado: boolean;
}) {
  const router = useRouter();
  const { update: atualizarSessao } = useSession();
  const bloqueio = visualizandoComo ? "Você está visualizando como outro usuário. Saia desse modo para editar." : null;

  return (
    <div className="pfl">
      <nav className="pfl-nav" aria-label="Seções do perfil">
        <span className="pfl-nav-rotulo">Minha conta</span>
        {SECOES.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="pfl-nav-item">{s.rotulo}</a>
        ))}
        {/* Só para quem o middleware deixa entrar em /ajustes; para closer/SDR o
            clique cairia no Início sem explicação. */}
        {podeGerirOrg ? (
          <>
            <span className="pfl-nav-rotulo pfl-nav-rotulo-2">Da organização</span>
            <Link href="/ajustes" className="pfl-nav-item">Ajustes da organização</Link>
          </>
        ) : null}
      </nav>

      <div className="pfl-grupos">
        <Identidade perfil={perfil} />
        {bloqueio ? <p className="pfl-aviso" role="status">{bloqueio}</p> : null}
        <GrupoConta perfil={perfil} bloqueio={bloqueio} aoSalvar={async () => { await atualizarSessao(); router.refresh(); }} />
        <GrupoSenha bloqueio={bloqueio} />
        <GrupoAgenda perfil={perfil} bloqueio={bloqueio} aoSalvar={() => router.refresh()} />
        <GrupoIntegracoes perfil={perfil} bloqueio={bloqueio} podeGerirOrg={podeGerirOrg} microsoftConfigurado={microsoftConfigurado} googleConfigurado={googleConfigurado} />
        <Grupo id="sessao" titulo="Sessão" ajuda="Encerra a sessão neste navegador.">
          <div className="pfl-acoes">
            <button type="button" className="pfl-btn" onClick={() => void signOut({ callbackUrl: "/login" })}>
              <LogOut aria-hidden /> Sair
            </button>
          </div>
        </Grupo>
      </div>
    </div>
  );
}

function Grupo({ id, titulo, ajuda, children }: { id: string; titulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <section id={id} className="pfl-grupo" aria-labelledby={`${id}-t`}>
      <header className="pfl-grupo-topo">
        <h2 id={`${id}-t`} className="pfl-grupo-titulo">{titulo}</h2>
        {ajuda ? <p className="pfl-grupo-ajuda">{ajuda}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Retorno({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p className="pfl-retorno" data-tipo={msg.tipo} role={msg.tipo === "erro" ? "alert" : "status"}>{msg.texto}</p>;
}

function Identidade({ perfil }: { perfil: DadosPerfil }) {
  return (
    <div className="pfl-identidade">
      <Avatar perfil={perfil} tamanho="g" />
      <div className="pfl-identidade-texto">
        <strong className="pfl-nome">{perfil.nome}</strong>
        <span className="pfl-email">{perfil.email}</span>
        <div className="pfl-fatos">
          <span className="pfl-chip">{PAPEL[perfil.role] ?? perfil.role}</span>
          <span>{perfil.orgNome}</span>
          <span>Slug: {perfil.orgSlug}</span>
          <span>Time: {perfil.timeNome ?? "—"}</span>
          <span>Desde {new Date(perfil.criadoEm).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: FUSO })}</span>
        </div>
      </div>
    </div>
  );
}

function Avatar({ perfil, tamanho }: { perfil: DadosPerfil; tamanho: "g" | "m" }) {
  return perfil.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- servido por /api/arquivos (Hono), fora do otimizador do Next
    <img src={perfil.avatarUrl} alt="" className="pfl-avatar" data-t={tamanho} />
  ) : (
    <span className="pfl-avatar" data-t={tamanho} aria-hidden>{iniciais(perfil.nome)}</span>
  );
}

function GrupoConta({ perfil, bloqueio, aoSalvar }: { perfil: DadosPerfil; bloqueio: string | null; aoSalvar: () => Promise<void> }) {
  const [nome, setNome] = useState(perfil.nome);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const mudou = nome.trim() !== perfil.nome && nome.trim().length > 0;

  async function salvarNome() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      if (!res.ok) return setMsg({ tipo: "erro", texto: await lerErro(res, "Não foi possível salvar o nome") });
      setMsg({ tipo: "ok", texto: "Nome atualizado" });
      await aoSalvar();
    } catch {
      setMsg({ tipo: "erro", texto: "Sem conexão com o servidor" });
    } finally {
      setSalvando(false);
    }
  }

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    // Mesmo limite do Hono (5 MB, JPG/PNG/WebP/GIF): recusar aqui evita subir
    // 20 MB só para ouvir "não" do servidor.
    if (arquivo.size > 5 * 1024 * 1024) return setMsg({ tipo: "erro", texto: "Arquivo muito grande. Máximo 5 MB" });
    setEnviando(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("avatar", arquivo);
      const res = await fetch("/api/perfil", { method: "POST", body: fd });
      if (!res.ok) return setMsg({ tipo: "erro", texto: await lerErro(res, "Não foi possível enviar a foto") });
      setMsg({ tipo: "ok", texto: "Foto atualizada" });
      await aoSalvar();
    } catch {
      setMsg({ tipo: "erro", texto: "Sem conexão com o servidor" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Grupo id="conta" titulo="Conta" ajuda="Como você aparece para o time, nos negócios e nas atividades.">
      <div className="pfl-campos">
        <div className="pfl-foto">
          <Avatar perfil={perfil} tamanho="m" />
          {/* Input visualmente oculto (não `hidden`): continua no Tab, e o
              :focus-within do label desenha o anel quando ele recebe foco. */}
          <label className="pfl-btn" data-desabilitado={Boolean(bloqueio) || enviando}>
            <Camera aria-hidden />
            {enviando ? "Enviando…" : "Trocar foto"}
            <input type="file" className="pfl-oculto" accept="image/jpeg,image/png,image/webp,image/gif" onChange={enviarFoto} disabled={Boolean(bloqueio) || enviando} />
          </label>
          <span className="pfl-dica">JPG, PNG, WebP ou GIF até 5 MB.</span>
        </div>
        <label className="pfl-campo">
          <span>Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} disabled={Boolean(bloqueio)} autoComplete="name" />
        </label>
        <label className="pfl-campo">
          <span>E-mail de acesso</span>
          <input value={perfil.email} readOnly disabled />
          <small>Usado no login. Só um admin altera, em Ajustes › Membros.</small>
        </label>
        <label className="pfl-campo">
          <span>Papel</span>
          <input value={PAPEL[perfil.role] ?? perfil.role} readOnly disabled />
          <small>Define o que você vê e pode fazer. Atribuído pelo admin da organização.</small>
        </label>
      </div>
      <div className="pfl-acoes">
        <Retorno msg={msg} />
        <button type="button" className="pfl-btn-primario" onClick={salvarNome} disabled={!mudou || salvando || Boolean(bloqueio)}>
          {salvando ? "Salvando…" : "Salvar nome"}
        </button>
      </div>
    </Grupo>
  );
}

function CampoSenha({ rotulo, valor, onChange, autoComplete, dica, disabled }: { rotulo: string; valor: string; onChange: (v: string) => void; autoComplete: string; dica?: string; disabled?: boolean }) {
  const [ver, setVer] = useState(false);
  return (
    <label className="pfl-campo">
      <span>{rotulo}</span>
      <div className="pfl-senha">
        <input type={ver ? "text" : "password"} value={valor} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} disabled={disabled} />
        {/* Sem maxLength: ele conta caracteres e o limite real do bcrypt é 72
            bytes; a checagem em bytes fica em GrupoSenha, com a mesma mensagem do Hono. */}
        <button type="button" disabled={disabled} onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar senha" : "Mostrar senha"}>
          {ver ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      </div>
      {dica ? <small>{dica}</small> : null}
    </label>
  );
}

function GrupoSenha({ bloqueio }: { bloqueio: string | null }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  // Validação aqui é só conforto: a regra que vale (8 a 72, senha atual
  // conferida com bcrypt) está no PATCH /api/perfil do Hono.
  const problema =
    nova && nova.length < 8 ? "A nova senha precisa de pelo menos 8 caracteres"
    : new TextEncoder().encode(nova).length > 72 ? "A nova senha deve ter no máximo 72 bytes (caracteres acentuados e emojis contam mais)"
    : confirmar && nova !== confirmar ? "A confirmação não bate com a nova senha"
    : nova && nova === atual ? "A nova senha é igual à atual"
    : null;

  async function trocar() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual: atual, novaSenha: nova }),
      });
      if (!res.ok) return setMsg({ tipo: "erro", texto: await lerErro(res, "Não foi possível alterar a senha") });
      setMsg({ tipo: "ok", texto: "Senha alterada. Use a nova no próximo login." });
      setAtual(""); setNova(""); setConfirmar("");
    } catch {
      setMsg({ tipo: "erro", texto: "Sem conexão com o servidor" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Grupo id="seguranca" titulo="Segurança" ajuda="Para trocar a senha, confirme a atual. Esqueceu? Saia e use “Esqueci minha senha” no login.">
      <div className="pfl-campos pfl-campos-estreitos">
        <CampoSenha rotulo="Senha atual" valor={atual} onChange={setAtual} autoComplete="current-password" disabled={Boolean(bloqueio)} />
        <CampoSenha rotulo="Nova senha" valor={nova} onChange={setNova} autoComplete="new-password" dica="De 8 a 72 bytes (acentos e emojis contam mais de um)." disabled={Boolean(bloqueio)} />
        <CampoSenha rotulo="Confirmar nova senha" valor={confirmar} onChange={setConfirmar} autoComplete="new-password" disabled={Boolean(bloqueio)} />
      </div>
      <div className="pfl-acoes">
        <Retorno msg={problema ? { tipo: "erro", texto: problema } : msg} />
        <button
          type="button"
          className="pfl-btn-primario"
          onClick={trocar}
          disabled={Boolean(bloqueio) || salvando || !atual || !nova || !confirmar || Boolean(problema)}
        >
          {salvando ? "Alterando…" : "Alterar senha"}
        </button>
      </div>
    </Grupo>
  );
}

const HORARIO_PADRAO: HorarioTrabalho = { inicio: "09:00", fim: "18:00", diasSemana: [1, 2, 3, 4, 5] };

function GrupoAgenda({ perfil, bloqueio, aoSalvar }: { perfil: DadosPerfil; bloqueio: string | null; aoSalvar: () => void }) {
  const d = perfil.disponibilidade;
  const [h, setH] = useState<HorarioTrabalho>(d?.horarioTrabalho ?? HORARIO_PADRAO);
  const [temPausa, setTemPausa] = useState(Boolean(d?.pausaAlmoco));
  const [pausa, setPausa] = useState(d?.pausaAlmoco ?? { inicio: "12:00", fim: "13:00" });
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const problema =
    h.diasSemana.length === 0 ? "Selecione ao menos um dia"
    : h.inicio >= h.fim ? "O início precisa ser antes do fim"
    : temPausa && pausa.inicio >= pausa.fim ? "A pausa precisa começar antes de terminar"
    : null;

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/agenda/disponibilidade", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // `ativo` é preservado: quem tira alguém do rodízio é a gestão, não
        // um salvar de horário no próprio perfil.
        body: JSON.stringify({
          horarioTrabalho: { ...h, diasSemana: [...h.diasSemana].sort() },
          pausaAlmoco: temPausa ? pausa : null,
          ativo: d?.ativo ?? true,
        }),
      });
      if (!res.ok) return setMsg({ tipo: "erro", texto: await lerErro(res, "Não foi possível salvar o horário") });
      setMsg({ tipo: "ok", texto: "Horário salvo" });
      aoSalvar();
    } catch {
      setMsg({ tipo: "erro", texto: "Sem conexão com o servidor" });
    } finally {
      setSalvando(false);
    }
  }

  const alternarDia = (i: number) =>
    setH((v) => ({ ...v, diasSemana: v.diasSemana.includes(i) ? v.diasSemana.filter((x) => x !== i) : [...v.diasSemana, i] }));

  return (
    <Grupo
      id="agenda"
      titulo="Horário de trabalho"
      ajuda="O Agente SDR e o agendamento só oferecem reuniões dentro deste horário. Folgas e bloqueios pontuais ficam no Calendário."
    >
      {!d ? <p className="pfl-vazio">Ainda sem horário salvo. Abaixo está uma sugestão: nada é usado até você salvar.</p> : null}
      <div className="pfl-dias" role="group" aria-label="Dias da semana">
        {DIAS.map((rot, i) => (
          <button key={rot} type="button" className="pfl-dia" aria-pressed={h.diasSemana.includes(i)} onClick={() => alternarDia(i)} disabled={Boolean(bloqueio)}>
            {rot}
          </button>
        ))}
      </div>
      <div className="pfl-campos pfl-campos-linha">
        <label className="pfl-campo"><span>Início</span><input type="time" value={h.inicio} onChange={(e) => setH({ ...h, inicio: e.target.value })} disabled={Boolean(bloqueio)} /></label>
        <label className="pfl-campo"><span>Fim</span><input type="time" value={h.fim} onChange={(e) => setH({ ...h, fim: e.target.value })} disabled={Boolean(bloqueio)} /></label>
        <label className="pfl-check">
          <input type="checkbox" checked={temPausa} onChange={(e) => setTemPausa(e.target.checked)} disabled={Boolean(bloqueio)} />
          Pausa de almoço
        </label>
        {temPausa ? (
          <>
            <label className="pfl-campo"><span>Pausa de</span><input type="time" value={pausa.inicio} onChange={(e) => setPausa({ ...pausa, inicio: e.target.value })} disabled={Boolean(bloqueio)} /></label>
            <label className="pfl-campo"><span>até</span><input type="time" value={pausa.fim} onChange={(e) => setPausa({ ...pausa, fim: e.target.value })} disabled={Boolean(bloqueio)} /></label>
          </>
        ) : null}
      </div>
      <div className="pfl-acoes">
        <Link href="/calendario" className="pfl-link">Bloqueios e folgas no Calendário</Link>
        <Retorno msg={problema ? { tipo: "erro", texto: problema } : msg} />
        <button type="button" className="pfl-btn-primario" onClick={salvar} disabled={Boolean(bloqueio) || salvando || Boolean(problema)}>
          {salvando ? "Salvando…" : "Salvar horário"}
        </button>
      </div>
    </Grupo>
  );
}

const ROTULO_TIPO: Record<string, string> = { microsoft: "Microsoft · Outlook", google: "Google · Gmail", imap: "IMAP / SMTP" };

function estadoConta(syncStatus: string, erro: string | null): { rotulo: string; estado: "ok" | "erro" | "pendente" } {
  if (syncStatus === "error" || (erro && syncStatus !== "active")) return { rotulo: "Com erro", estado: "erro" };
  if (syncStatus === "paused") return { rotulo: "Pausada", estado: "pendente" };
  return { rotulo: "Conectada", estado: "ok" };
}

function estadoWhatsapp(status: string): { rotulo: string; estado: "ok" | "erro" | "pendente" } {
  if (status === "connected") return { rotulo: "Conectado", estado: "ok" };
  if (status === "qr" || status === "connecting") return { rotulo: "Aguardando QR", estado: "pendente" };
  return { rotulo: "Desconectado", estado: "erro" };
}

function GrupoIntegracoes({
  perfil, bloqueio, podeGerirOrg, microsoftConfigurado, googleConfigurado,
}: { perfil: DadosPerfil; bloqueio: string | null; podeGerirOrg: boolean; microsoftConfigurado: boolean; googleConfigurado: boolean }) {
  const temMicrosoft = perfil.contasEmail.some((c) => c.tipo === "microsoft" && c.syncStatus === "active");

  // O OAuth grava a conta no usuário do ctx. Em "visualizar como", esse é o
  // usuário visualizado: conectar ali ligaria a caixa do admin à conta alheia.
  const motivoMicrosoft = bloqueio ? "Indisponível em visualizar como" : !microsoftConfigurado ? "Microsoft não configurada neste ambiente" : null;
  const motivoGoogle = bloqueio ? "Indisponível em visualizar como" : !googleConfigurado ? "Google não configurado neste ambiente" : null;

  return (
    <Grupo id="integracoes" titulo="Integrações" ajuda="Contas pessoais que o ONFACE usa em seu nome: e-mail, agenda e WhatsApp.">
      <div className="pfl-sub">E-mail e agenda</div>
      {perfil.contasEmail.length === 0 ? (
        <p className="pfl-vazio">Nenhuma caixa conectada. Sem Outlook, reuniões que você agenda ficam só no ONFACE e não viram convite no calendário.</p>
      ) : (
        <ul className="pfl-lista">
          {perfil.contasEmail.map((c) => {
            const e = estadoConta(c.syncStatus, c.ultimoErro);
            return (
              <li key={c.id} className="pfl-linha">
                <div className="pfl-linha-texto">
                  <strong>{c.email}{c.padrao ? <span className="pfl-chip pfl-chip-suave">Padrão</span> : null}</strong>
                  <span>{ROTULO_TIPO[c.tipo] ?? c.tipo} · última sincronização {dataCurta(c.ultimaSync)}</span>
                  {c.ultimoErro && e.estado !== "ok" ? <span className="pfl-linha-erro">{c.ultimoErro}</span> : null}
                </div>
                <span className="pfl-estado" data-estado={e.estado}>{e.rotulo}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pfl-acoes pfl-acoes-esq">
        <BotaoOAuth href="/api/email/auth/microsoft" motivo={motivoMicrosoft}>
          {temMicrosoft ? "Conectar outra conta Microsoft" : "Conectar Outlook"}
        </BotaoOAuth>
        <BotaoOAuth href="/api/email/auth/google" motivo={motivoGoogle}>Conectar Gmail</BotaoOAuth>
        <Link href="/ajustes/email" className="pfl-link">Gerenciar caixas, assinatura e sincronização</Link>
      </div>

      <div className="pfl-sub">WhatsApp</div>
      {perfil.whatsapp.length === 0 ? (
        <p className="pfl-vazio">Nenhum número pessoal conectado. Conversas saem pelo número compartilhado da organização, se houver.</p>
      ) : (
        <ul className="pfl-lista">
          {perfil.whatsapp.map((s) => {
            const e = estadoWhatsapp(s.status);
            return (
              <li key={s.id} className="pfl-linha">
                <div className="pfl-linha-texto">
                  <strong>{s.telefone ?? s.rotulo ?? "Número sem identificação"}</strong>
                  <span>{s.rotulo ?? "Pessoal"} · última conexão {dataCurta(s.ultimaConexao)}</span>
                </div>
                <span className="pfl-estado" data-estado={e.estado}>{e.rotulo}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pfl-acoes pfl-acoes-esq">
        {/* /ajustes/whatsapp é rota de gestão no middleware: para quem não é
            gestor, o link redirecionaria ao Início. Mostramos o caminho real. */}
        {podeGerirOrg ? (
          <Link href="/ajustes/whatsapp" className="pfl-link">Conectar ou gerenciar número em Ajustes › WhatsApp</Link>
        ) : (
          <span className="pfl-dica">O número pessoal é conectado pela gestão da organização. Peça a um gestor em Ajustes › WhatsApp.</span>
        )}
      </div>
    </Grupo>
  );
}

/** Link de OAuth que vira botão desabilitado com o motivo à vista quando não pode funcionar. */
function BotaoOAuth({ href, motivo, children }: { href: string; motivo: string | null; children: ReactNode }) {
  if (motivo) {
    return (
      <span className="pfl-oauth-off">
        <button type="button" className="pfl-btn" disabled>{children}</button>
        <small>{motivo}</small>
      </span>
    );
  }
  // <a> e não <Link>: é um redirect do servidor para o provedor, não navegação do app.
  return <a href={href} className="pfl-btn">{children}</a>;
}
