"use client";

/**
 * Início do ONFACE.
 *
 * A tela é uma só e muda de dono: o papel decide a lente (ver
 * `lib/inicio/lente.ts`), e a lente decide quais blocos existem e de quem são os
 * números. Hierarquia, não grade de cartões iguais:
 *
 *   1. o herói grafite (um número que decide o dia)
 *   2. a fila "Precisa de você agora", ao lado, com ação em um clique
 *   3. a faixa de indicadores, com série e variação
 *   4. funil e agenda
 *   5. o que sustenta a operação (entrega, integrações, financeiro), só para a gestão
 *
 * Cada bloco que falha mostra que falhou; nenhum vira zero.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Bloco, PainelInicio } from "@/lib/inicio/tipos";
import { atualizarInicio } from "@/app/(produto)/inicio/actions";
import { BlocoComErro } from "./compartilhado";
import { HeroDeEntrega, HeroDeFila, HeroDeMeta, HeroDeMrr } from "./herois";
import { FaixaDeKpis } from "./kpis";
import { AgendaDoDia, Atalhos, PrecisaDeVoce } from "./listas";
import { CartaoDeEntrega, CartaoFinanceiro, FunilComercial, SaudeDasIntegracoes } from "./cartoes";
import "./inicio.css";

export type TomDoInicio = "claro" | "escuro";
const COOKIE_TOM = "onface-inicio-tom";

const horaCurta = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

export function Inicio({ painel, tomInicial }: { painel: PainelInicio; tomInicial: TomDoInicio }) {
  const router = useRouter();
  const [tom, setTom] = React.useState<TomDoInicio>(tomInicial);
  const [carregando, iniciar] = React.useTransition();

  const atualizar = React.useCallback(() => {
    iniciar(async () => {
      await atualizarInicio();
      router.refresh();
    });
  }, [router]);

  const trocarTom = (v: string) => {
    if (v !== "claro" && v !== "escuro") return;
    setTom(v);
    // Cookie, não localStorage: o servidor lê no próximo carregamento e a página
    // já nasce no tom certo, sem piscar o claro antes do escuro.
    document.cookie = `${COOKIE_TOM}=${v}; path=/; max-age=31536000; samesite=lax`;
  };

  const comLinks = painel.lente !== "leitor";
  const semBloco = (titulo: string) => (
    <section className="ini-cartao"><BlocoComErro titulo={titulo} aoTentar={atualizar} /></section>
  );
  const ou = <T,>(b: Bloco<T> | null, titulo: string, desenha: (d: T) => React.ReactNode) =>
    b === null ? null : b.ok ? desenha(b.dados) : semBloco(titulo);

  return (
    <div
      className="onface-pagina ini"
      data-lente={painel.lente}
      data-tom={tom === "escuro" ? "escuro" : undefined}
      data-onface-superficie={tom === "escuro" ? "escura" : undefined}
      aria-busy={carregando}
    >
      <header className="ini-cab">
        <div className="ini-cab-id">
          <h1>{painel.saudacao}</h1>
          <p className="ini-cab-data">
            {painel.data}{painel.organizacao ? ` · ${painel.organizacao}` : ""}
            {painel.lente === "leitor" ? " · visão somente leitura" : ""}
          </p>
          {painel.foco ? (
            <p className="ini-foco" data-vazio={painel.foco.vazio ? "true" : undefined}>
              {painel.foco.vazio ? "Nada pedindo você agora." : painel.foco.frases.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="ini-cab-acoes">
          <span className="ini-atualizado">Atualizado às {horaCurta(painel.geradoEm)}</span>
          <Button type="button" variant="ghost" size="sm" onClick={atualizar} disabled={carregando} aria-label="Atualizar o Início agora">
            <RotateCw data-girando={carregando ? "true" : undefined} aria-hidden="true" />
            Atualizar
          </Button>
          <ToggleGroup type="single" value={tom} onValueChange={trocarTom} aria-label="Tom do painel" size="sm">
            <ToggleGroupItem value="claro" className="px-3">Claro</ToggleGroupItem>
            <ToggleGroupItem value="escuro" className="px-3">Escuro</ToggleGroupItem>
          </ToggleGroup>
          {painel.podeAgir ? (
            <Button asChild size="sm">
              <Link href="/tarefas?nova=1"><Plus aria-hidden="true" />Nova atividade</Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="ini-grade" data-lente={painel.lente} data-carregando={carregando ? "true" : undefined}>
        <div className="ini-area" data-area="hero">
          {ou(painel.hero, "o destaque do dia", (h) =>
            h.tipo === "mrr" ? <HeroDeMrr d={h} geradoEm={painel.geradoEm} comLinks={comLinks} />
              : h.tipo === "meta" ? <HeroDeMeta d={h} geradoEm={painel.geradoEm} />
              : h.tipo === "fila" ? <HeroDeFila d={h} />
              : <HeroDeEntrega d={h} />)}
        </div>
        {painel.atencao ? (
          <div className="ini-area" data-area="atencao">
            {ou(painel.atencao, "a fila de atenção", (a) => <PrecisaDeVoce a={a} />)}
          </div>
        ) : null}
        <div className="ini-area" data-area="kpis">
          {ou(painel.kpis, "os indicadores", (k) => <FaixaDeKpis kpis={k} />)}
        </div>
        {painel.funil ? (
          <div className="ini-area" data-area="funil">
            {ou(painel.funil, "o funil", (f) => <FunilComercial f={f} comLinks={comLinks} />)}
          </div>
        ) : null}
        {painel.agenda ? (
          <div className="ini-area" data-area="agenda">
            {ou(painel.agenda, "a agenda", (a) => <AgendaDoDia a={a} />)}
          </div>
        ) : null}
        {painel.entrega && painel.lente !== "operacao" ? (
          <div className="ini-area" data-area="entrega">
            {ou(painel.entrega, "implantação e retenção", (e) => <CartaoDeEntrega e={e} />)}
          </div>
        ) : null}
        {painel.saude ? (
          <div className="ini-area" data-area="saude">
            {ou(painel.saude, "as integrações", (s) => <SaudeDasIntegracoes s={s} />)}
          </div>
        ) : null}
        {painel.financeiro ? (
          <div className="ini-area" data-area="financeiro">
            {ou(painel.financeiro, "o financeiro", (f) => <CartaoFinanceiro f={f} />)}
          </div>
        ) : null}
        <div className="ini-area" data-area="atalhos">
          <Atalhos atalhos={painel.atalhos} comNexo={painel.podeAgir} />
        </div>
      </div>
    </div>
  );
}
