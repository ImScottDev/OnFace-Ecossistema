/**
 * Templates de email transacional de conta (convite / redefinição de senha).
 * HTML simples, branded Callface, enviado via Resend (sendResendEmail).
 */

const CARMIM = "#e23752";
const BG = "#0f1015";

function wrapper(titulo: string, corpo: string, cta: { label: string; href: string }): string {
  return `
  <div style="background:${BG};padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#16161c;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
      <div style="padding:28px 32px 8px">
        <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px">Callface <span style="color:${CARMIM}">CRM</span></div>
      </div>
      <div style="padding:8px 32px 4px">
        <h1 style="font-size:20px;color:#fff;margin:12px 0 8px">${titulo}</h1>
        <div style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.65)">${corpo}</div>
        <a href="${cta.href}" style="display:inline-block;margin:22px 0 6px;background:${CARMIM};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px">${cta.label}</a>
        <p style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:16px;word-break:break-all">Se o botão não funcionar, cole no navegador:<br>${cta.href}</p>
      </div>
      <div style="padding:16px 32px 24px;border-top:1px solid rgba(255,255,255,0.06);margin-top:12px">
        <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:0">Se você não esperava este email, pode ignorar com segurança.</p>
      </div>
    </div>
  </div>`;
}

export function inviteEmailHtml(nome: string, link: string, quemConvidou?: string): string {
  const primeiroNome = (nome || "").split(" ")[0] || "";
  return wrapper(
    `Você foi convidado pro Callface CRM`,
    `Olá${primeiroNome ? " " + primeiroNome : ""},<br><br>${quemConvidou ? quemConvidou + " convidou você" : "Você foi convidado"} para acessar o Callface CRM. Clique abaixo para definir sua senha e entrar. O link vale por 7 dias.`,
    { label: "Definir minha senha", href: link },
  );
}

export function resetEmailHtml(nome: string, link: string): string {
  const primeiroNome = (nome || "").split(" ")[0] || "";
  return wrapper(
    `Redefinir sua senha`,
    `Olá${primeiroNome ? " " + primeiroNome : ""},<br><br>Recebemos um pedido para redefinir a senha do seu acesso ao Callface CRM. Clique abaixo para criar uma nova senha. O link vale por 1 hora.`,
    { label: "Redefinir senha", href: link },
  );
}
