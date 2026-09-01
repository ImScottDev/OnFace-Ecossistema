import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * "Jornada da operação" (Figma 559:2438) — o funil inteiro numa faixa só,
 * da aquisição ao pós-venda, com um divisor lime marcando onde termina o
 * comercial e começa a entrega. As 4 primeiras etapas são transparentes
 * sobre o painel escuro; as 3 do pós-venda vêm em caixas claras.
 *
 * O Figma fixa a largura de algumas etapas (125/107/156px) — aqui todas são
 * `flex-1`, porque a faixa precisa acompanhar a largura real da tela e o
 * valor fixo era artefato do frame de 1276px do desenho.
 */

export interface EtapaJornada {
  label: string;
  valor: string;
  apoio: string;
  href: string;
}

function Etapa({ etapa, claro }: { etapa: EtapaJornada; claro?: boolean }) {
  return (
    <Link
      href={etapa.href}
      className="flex flex-col gap-1 flex-1 min-w-[120px] py-3.5 px-4 rounded-[20px] transition-colors"
      style={claro ? { background: "#f6f7f9" } : undefined}
    >
      <p
        className="text-[10.5px] uppercase truncate"
        style={{ color: claro ? "#000000" : "var(--cf2-home-ink-faint)", letterSpacing: "0.62px" }}
      >
        {etapa.label}
      </p>
      <p
        className="text-[24px] leading-none"
        style={{ color: claro ? "var(--cf2-home-ink)" : "#f6f7f9", letterSpacing: "-0.53px", fontFamily: "var(--cf2-font-heading)" }}
      >
        {etapa.valor}
      </p>
      <p className="text-[11.5px] truncate" style={{ color: claro ? "#000000" : "var(--cf2-home-ink-faint)" }}>{etapa.apoio}</p>
    </Link>
  );
}

const Chevron = () => (
  <span className="flex items-center justify-center w-5 shrink-0 text-[14px]" style={{ color: "#e2e4e8" }} aria-hidden>›</span>
);

export function Cf2JornadaOperacao({ comercial, posVenda }: { comercial: EtapaJornada[]; posVenda: EtapaJornada[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex items-center justify-center w-6 h-6 rounded-[10px] shrink-0"
          style={{ background: "#ffffff", boxShadow: "0px 1px 1px rgba(17,19,24,0.03), 0px 6px 10px rgba(17,19,24,0.08)" }}
        >
          <ArrowUpRight className="w-3.5 h-3.5" style={{ color: "var(--cf2-home-ink-soft)" }} />
        </span>
        <p className="text-[15px] font-semibold" style={{ color: "var(--cf2-home-ink)", letterSpacing: "-0.61px" }}>Jornada da operação</p>
        <p className="text-[12px] truncate" style={{ color: "var(--cf2-home-ink-faint)" }}>· Da aquisição ao cliente ativo · clique em cada etapa</p>
      </div>

      {/* Abaixo de xl a faixa não cabe inteira (são 7 etapas + divisor): vira
          scroll horizontal em vez de espremer/sobrepor os rótulos. */}
      <div
        className="p-3 rounded-[28px] overflow-x-auto cf2-hide-scrollbar"
        style={{ background: "var(--cf2-home-hero-bg)", boxShadow: "0px 1px 1px rgba(17,19,24,0.03), 0px 6px 10px rgba(17,19,24,0.08)" }}
      >
        <div className="flex items-center min-w-[900px] xl:min-w-0">
          {comercial.map((e, i) => (
            <div key={e.label} className="flex items-center flex-1 min-w-0">
              <Etapa etapa={e} />
              {i < comercial.length - 1 && <Chevron />}
            </div>
          ))}

          {/* Divisor de fronteira comercial → pós-venda */}
          <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-3 py-2">
            <span className="w-[1.5px] h-7 rounded-sm" style={{ background: "var(--cf2-home-lime)" }} />
            <span
              className="flex flex-col items-center py-1 px-2 rounded-md"
              style={{ background: "var(--cf2-home-lime)", color: "#000000" }}
            >
              <span className="text-[9px] font-medium uppercase leading-none" style={{ letterSpacing: "0.5px" }}>Pós-venda</span>
              <span className="text-[10px] leading-none mt-0.5" aria-hidden>→</span>
            </span>
            <span className="w-[1.5px] h-7 rounded-sm" style={{ background: "var(--cf2-home-lime)" }} />
          </div>

          {posVenda.map((e, i) => (
            <div key={e.label} className="flex items-center flex-1 min-w-0">
              <Etapa etapa={e} claro />
              {i < posVenda.length - 1 && <Chevron />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
