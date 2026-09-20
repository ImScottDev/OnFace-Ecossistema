import "./page.css";

/** Moldura padrão de uma tela ONFACE: grafite em volta, canvas claro dentro.
 * Ver `page.css` para as duas medidas que governam o alinhamento. */
export function OnfacePage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className ? `onface-page ${className}` : "onface-page"}>{children}</div>;
}

/** Faixa escura do topo, sangrando até as bordas da viewport. */
export function OnfacePageBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={className ? `onface-page-band ${className}` : "onface-page-band"}>{children}</section>;
}

/** Canvas, superfície de conteúdo da página.
 *
 * `sobreposto` sobe o canvas por baixo da faixa escura.
 * `tom` escolhe papel (padrão) ou grafite. Escuro não é "dark mode": é a tela
 * que pede escuro — monitoramento, parede, apresentação. A geometria, o gutter
 * e o raio são os mesmos nos dois. */
export function OnfacePageSurface({
  children, className, sobreposto = false, tom = "claro", id,
}: {
  children: React.ReactNode;
  className?: string;
  sobreposto?: boolean;
  tom?: "claro" | "escuro";
  id?: string;
}) {
  return (
    <section
      id={id}
      className={className ? `onface-page-surface ${className}` : "onface-page-surface"}
      data-sobreposto={sobreposto}
      data-tom={tom === "escuro" ? "escuro" : undefined}
    >
      {children}
    </section>
  );
}
