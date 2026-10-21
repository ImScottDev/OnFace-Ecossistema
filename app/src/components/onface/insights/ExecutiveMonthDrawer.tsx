"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUpRight, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useMetrica } from "@/components/onface/relatorios/useMetrica";
import { dinheiro, rotuloPonto, fimDoPonto, VALOR_FAMILIA } from "@/components/onface/relatorios/explorador-formato";
import "./insights-bi.css";

export function ExecutiveMonthDrawer({ mes, familia, aoFechar }: {
  mes: string; familia?: string; aoFechar: () => void;
}) {
  const [pagina, setPagina] = useState(1);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const parametros = { periodo: "tudo", familia, de: mes, ate: fimDoPonto(mes, "mes"), pagina: String(pagina), tamanho: "25", q: busca || undefined };
  const resultado = useMetrica("faturamento_competencia", parametros);
  const dados = resultado.data?.exploracao;
  const href = "/relatorios/biblioteca/metrica-faturamento_competencia?" +
    new URLSearchParams(Object.entries(parametros).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();
  function pesquisar(evento: FormEvent<HTMLFormElement>) { evento.preventDefault(); setPagina(1); setBusca(texto.trim()); }

  return (
    <Sheet open onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <SheetContent side="right" className="ins-bi-drawer">
        <SheetHeader>
          <span className="ins-bi-drawer-kicker">DETALHAMENTO AUDITÁVEL</span>
          <SheetTitle>{rotuloPonto(mes, "mes")} · faturamento</SheetTitle>
          <SheetDescription>{familia ? VALOR_FAMILIA[familia] ?? familia : "Consolidado"} · exatamente o mesmo recorte do painel executivo.</SheetDescription>
        </SheetHeader>
        <div className="ins-bi-drawer-corpo">
          {resultado.isPending && <div role="status" className="rx-esq" style={{ height: 200 }} aria-label="Carregando competência" />}
          {resultado.error && <div role="alert" className="rx-aviso">Falha ao carregar. <button type="button" onClick={() => void resultado.refetch()}>Tentar novamente</button></div>}
          {dados && <>
            <div className="ins-bi-drawer-total">
              <span>Total selecionado</span>
              <strong>{dinheiro(dados.selecionado.valor, "BRL")}</strong>
              <small>{dados.selecionado.registros.toLocaleString("pt-BR")} linhas explicam este valor</small>
            </div>
            <form onSubmit={pesquisar} className="ins-bi-busca">
              <label htmlFor="ins-bi-pesquisa">Localizar dentro da competência</label>
              <div><input id="ins-bi-pesquisa" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={80} placeholder="Empresa ou identificador" />
                <button type="submit" aria-label="Pesquisar"><Search size={18}/></button></div>
            </form>
            {dados.linhas.length === 0 ? <p className="ins-bi-vazio">Sem registros neste recorte.</p> :
              <ol className="ins-bi-registros">
                {dados.linhas.map((linha, i) => {
                  const nome = String(linha.empresa ?? "Empresa não identificada");
                  const id = typeof linha.empresa_id === "string" ? linha.empresa_id : null;
                  return <li key={String(linha.id ?? pagina + "-" + i)}>
                    <div>
                      <strong>{id ? <Link href={"/empresas/" + id}>{nome}</Link> : nome}</strong>
                      <small>{VALOR_FAMILIA[String(linha.familia ?? "")] ?? String(linha.familia ?? "Sem família")} · {String(linha.natureza ?? "Natureza não informada")}</small>
                    </div>
                    <b>{dinheiro(Number(linha.valor ?? 0), "BRL")}</b>
                  </li>;
                })}
              </ol>}
            <div className="ins-bi-paginacao">
              <span>Página {dados.pagina} de {Math.max(1, dados.paginas)}</span>
              <div>
                <button type="button" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina((v) => Math.max(1, v - 1))}><ChevronLeft size={18}/></button>
                <button type="button" aria-label="Próxima página" disabled={pagina >= dados.paginas} onClick={() => setPagina((v) => v + 1)}><ChevronRight size={18}/></button>
              </div>
            </div>
            <p className="ins-bi-fonte">Fonte: {resultado.data?.metrica.fonte}. {resultado.data?.metrica.descricao}</p>
            <Link className="ins-bi-acao ins-bi-drawer-link" href={href}>Explorar, filtrar e exportar <ArrowUpRight size={16}/></Link>
          </>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
