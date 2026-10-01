import { ProvedoresEmailProvider } from "./_provedores";

/**
 * A tela de e-mail é cliente e não enxerga env. Este layout de servidor lê só a
 * presença das credenciais OAuth (mesma checagem do Perfil) e entrega à tela:
 * sem ela, "Conectar" levava a um 500 da rota de auth.
 */
export default function AjustesEmailLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProvedoresEmailProvider
      valor={{
        microsoftConfigurado: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
        googleConfigurado: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      }}
    >
      {children}
    </ProvedoresEmailProvider>
  );
}
