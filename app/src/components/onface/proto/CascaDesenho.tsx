"use client";

/* GERADO por scripts/dc-para-tsx.mjs a partir de:
 *   OnFace Casca.dc.html
 *
 * O markup é conversão MECÂNICA do desenho — não foi transcrito à mão, então
 * não há divergência de transcrição para procurar. Reveja a ligação com o
 * dado, não o estilo.
 *
 * Para regerar depois de um desenho novo, rode o conversor de novo e refaça só
 * a ligação. NÃO edite o markup aqui à mão: a próxima geração sobrescreve.
 */

import { Fragment } from "react";
import { estilo, foco, hover } from "./proto-runtime";
import "./CascaDesenho.css";

/**
 * O que o desenho consome.
 *
 * Esta é a FRONTEIRA entre o desenho e o produto: o markup acima é intocável
 * (regenerado a cada desenho novo), e tudo que ele precisa entra por aqui.
 * Ligar a tela é preencher este objeto com dado real — e é só isso que há
 * para revisar, porque o resto não foi escrito à mão.
 */
export interface ValoresDeCascaDesenho {
  aberta: any;
  abrirNexo: any;
  areas: any;
  aviso: any;
  avisoPonto: any;
  buscaAberta: any;
  buscaRef: any;
  buscaSemDados: any;
  buscaVazioTexto: any;
  buscaVazioTitulo: any;
  buscar: any;
  children: any;
  criarStyle: any;
  fechada: any;
  fecharBusca: any;
  fecharMenuMob: any;
  filtrosSino: any;
  gruposBusca: any;
  itensPerfil: any;
  menuMob: any;
  nexo: any;
  nexoBtnStyle: any;
  nexoMarca: any;
  nexoResumo: any;
  parar: any;
  perfilAberto: any;
  perfilBtnStyle: any;
  perfilChevron: any;
  qa: any;
  railStyle: any;
  sair: any;
  setTermo: any;
  sinoAberto: any;
  sinoBtnStyle: any;
  sinoVazioTexto: any;
  sinoVazioTitulo: any;
  subtitulo: any;
  teclaBusca: any;
  temAviso: any;
  temSubtitulo: any;
  termo: any;
  titulo: any;
  togglePerfil: any;
  toggleRail: any;
  toggleSino: any;
  trilha: any;
  usuarioEmail: any;
  usuarioIniciais: any;
  usuarioNome: any;
  usuarioOrganizacao: any;
}

export function CascaDesenho(vals: ValoresDeCascaDesenho) {
  const { aberta, abrirNexo, areas, aviso, avisoPonto, buscaAberta, buscaRef, buscaSemDados, buscaVazioTexto, buscaVazioTitulo, buscar, children, criarStyle, fechada, fecharBusca, fecharMenuMob, filtrosSino, gruposBusca, itensPerfil, menuMob, nexo, nexoBtnStyle, nexoMarca, nexoResumo, parar, perfilAberto, perfilBtnStyle, perfilChevron, qa, railStyle, sair, setTermo, sinoAberto, sinoBtnStyle, sinoVazioTexto, sinoVazioTitulo, subtitulo, teclaBusca, temAviso, temSubtitulo, termo, titulo, togglePerfil, toggleRail, toggleSino, trilha, usuarioEmail, usuarioIniciais, usuarioNome, usuarioOrganizacao } = vals;
  return (
    <>
<div data-r="casca" data-menu={menuMob} style={{ display: "flex", height: "100vh", maxHeight: "100vh", overflow: "hidden", background: "#090e14", padding: "10px", gap: "10px", fontSize: "14px" }}>
<div data-r="rail-fundo" onClick={fecharMenuMob} style={{ display: "none", position: "fixed", inset: "0", zIndex: "89", background: "rgba(9,14,20,.55)" }} />
<aside data-r="rail" style={estilo(railStyle)}>
<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "38px", flex: "0 0 auto", overflow: "hidden" }}>
{(aberta) ? (<>
<svg viewBox="0 0 1346 233" width="93" height="16" style={{ flex: "0 0 auto", display: "block", margin: "0 auto 0 9px" }} role="img" aria-label="ONFACE">
<path d="M166.339 3.0559C167.226 3.00203 168.115 2.96846 169.003 2.95463C173.907 2.91105 179.15 3.14422 184.105 3.17367L215.526 3.1822C247.453 3.23991 271.952 3.04796 299.693 21.7145C315.513 32.3605 325.68 41.798 335.714 58.3796C346.202 76.0907 351.746 96.292 351.764 116.875C351.628 141.607 343.322 165.601 328.135 185.124C310.593 207.755 283.891 224.352 255.427 228.173C243.705 229.747 231.449 229.514 219.621 229.486L186.301 229.453C165.31 229.842 143.974 229.369 122.962 229.394C117.468 229.415 112.056 229.446 106.565 229.131C48.9875 225.831 -0.0109149 175.989 0.129206 117.81C0.201018 87.993 11.1822 60.0247 32.0246 38.3955C40.5361 29.6847 50.3767 22.3804 61.1791 16.7558C64.5651 14.9717 68.2788 12.3291 71.6318 10.911C75.6023 9.10124 80.7248 8.87749 84.6823 7.67278C99.3374 3.21164 112.6 3.18691 127.828 3.13363C140.665 3.20399 153.503 3.17808 166.339 3.0559ZM242.866 192.022C284.424 188.52 315.274 151.992 311.768 110.438C308.261 68.8837 271.726 38.0408 230.168 41.5513C188.616 45.0612 157.776 81.5858 161.282 123.135C164.788 164.683 201.313 195.524 242.866 192.022Z" fill="#FE4F2B" />
<path d="M524.871 3.00586C528.463 3.42127 533.633 3.17073 537.372 3.146L557.229 3.09801C560.986 3.0933 564.31 3.02588 568.088 3.43834C573.92 4.07573 577.754 8.66405 578.284 14.4332C578.843 20.5192 578.678 27.1304 578.714 33.3394L578.628 73.7034L578.867 209.177C578.946 232.76 561.401 229.443 544.112 229.461C537.411 229.584 529.287 229.728 522.928 227.775C517.904 226.232 512.16 222.164 508.695 218.262C506.978 216.329 504.711 212.731 503.139 210.506L491.85 194.539L451.984 138.377L422.431 96.3895C419.137 91.6996 414.317 86.3155 411.723 81.3562C412.223 86.6814 411.967 95.7491 411.964 101.399L411.994 136.892L411.958 193.017C411.982 204.79 412.318 218.101 411.9 229.761C407.883 229.31 400.923 229.437 396.786 229.46L375.926 229.519C371.38 229.559 367.402 229.802 362.829 229.619C362.664 220.575 362.85 210.985 362.853 201.892C362.735 182.285 362.77 162.678 362.959 143.072C362.988 132.953 362.37 122.917 362.859 112.823C362.979 110.316 362.932 107.706 362.923 105.19C362.838 88.1411 362.847 71.092 362.944 54.0433C362.991 47.9906 362.797 42.0253 363.032 35.9661C363.763 17.0078 378.785 4.66189 397.119 3.33913C400.266 2.85689 404.78 3.3194 407.942 3.75718C425.629 6.20635 432.545 18.9168 441.443 31.8341L461.55 60.6909C471.028 74.5707 481.409 88.2229 491.055 102.094L518.95 141.655C521.058 144.618 522.545 147.599 524.794 150.634C524.408 143.579 524.715 134.803 524.691 127.623L524.779 78.3739C524.897 53.7444 524.058 27.5387 524.871 3.00586Z" fill="#FE4F2B" />
<path d="M596.919 228.471V3.62196H750.843V44.3664H643.7V101.409H735.752V142.153H643.7V228.471H596.919ZM727.335 228.471L803.391 3.62196H865.564L941.62 228.471H890.614L875.523 182.596H793.129L778.039 228.471H727.335ZM806.107 141.851H862.546L828.139 35.6139H840.815L806.107 141.851ZM1047.6 232.092C1031.5 232.092 1016.51 229.175 1002.63 223.34C988.948 217.505 976.977 209.356 966.715 198.893C956.453 188.431 948.405 176.157 942.57 162.072C936.936 147.988 934.119 132.596 934.119 115.895C934.119 99.1953 936.936 83.8029 942.57 69.7184C948.204 55.4328 956.152 43.1591 966.413 32.8976C976.675 22.4348 988.647 14.3865 1002.33 8.75274C1016.21 2.91775 1031.3 0.000248973 1047.6 0.000248973C1063.9 0.000248973 1078.49 2.71654 1091.36 8.14913C1104.44 13.5817 1115.51 20.8252 1124.56 29.8795C1133.62 38.9338 1140.05 48.9941 1143.88 60.0605L1102.53 79.98C1098.71 69.1148 1091.97 60.1611 1082.31 53.1189C1072.85 45.8754 1061.28 42.2537 1047.6 42.2537C1034.32 42.2537 1022.65 45.3724 1012.59 51.6098C1002.53 57.8472 994.683 66.4991 989.049 77.5655C983.616 88.4307 980.9 101.207 980.9 115.895C980.9 130.584 983.616 143.461 989.049 154.527C994.683 165.594 1002.53 174.245 1012.59 180.483C1022.65 186.72 1034.32 189.839 1047.6 189.839C1061.28 189.839 1072.85 186.318 1082.31 179.276C1091.97 172.032 1098.71 162.978 1102.53 152.113L1143.88 172.032C1140.05 183.099 1133.62 193.159 1124.56 202.213C1115.51 211.268 1104.44 218.511 1091.36 223.944C1078.49 229.376 1063.9 232.092 1047.6 232.092ZM1158.81 228.471V3.62196H1310.01V44.3664H1205.59V95.3723H1303.98V136.117H1205.59V187.726H1310.01V228.471H1158.81Z" fill="#EEEFF3" />
</svg>
</>) : null}
{(fechada) ? (<>
<svg viewBox="0 0 591 233" width="30" height="12" style={{ flex: "0 0 auto", display: "block" }} role="img" aria-label="ONFACE">
<path d="M166.339 3.0559C167.226 3.00203 168.115 2.96846 169.003 2.95463C173.907 2.91105 179.15 3.14422 184.105 3.17367L215.526 3.1822C247.453 3.23991 271.952 3.04796 299.693 21.7145C315.513 32.3605 325.68 41.798 335.714 58.3796C346.202 76.0907 351.746 96.292 351.764 116.875C351.628 141.607 343.322 165.601 328.135 185.124C310.593 207.755 283.891 224.352 255.427 228.173C243.705 229.747 231.449 229.514 219.621 229.486L186.301 229.453C165.31 229.842 143.974 229.369 122.962 229.394C117.468 229.415 112.056 229.446 106.565 229.131C48.9875 225.831 -0.0109149 175.989 0.129206 117.81C0.201018 87.993 11.1822 60.0247 32.0246 38.3955C40.5361 29.6847 50.3767 22.3804 61.1791 16.7558C64.5651 14.9717 68.2788 12.3291 71.6318 10.911C75.6023 9.10124 80.7248 8.87749 84.6823 7.67278C99.3374 3.21164 112.6 3.18691 127.828 3.13363C140.665 3.20399 153.503 3.17808 166.339 3.0559ZM242.866 192.022C284.424 188.52 315.274 151.992 311.768 110.438C308.261 68.8837 271.726 38.0408 230.168 41.5513C188.616 45.0612 157.776 81.5858 161.282 123.135C164.788 164.683 201.313 195.524 242.866 192.022Z" fill="#FE4F2B" />
<path d="M524.871 3.00586C528.463 3.42127 533.633 3.17073 537.372 3.146L557.229 3.09801C560.986 3.0933 564.31 3.02588 568.088 3.43834C573.92 4.07573 577.754 8.66405 578.284 14.4332C578.843 20.5192 578.678 27.1304 578.714 33.3394L578.628 73.7034L578.867 209.177C578.946 232.76 561.401 229.443 544.112 229.461C537.411 229.584 529.287 229.728 522.928 227.775C517.904 226.232 512.16 222.164 508.695 218.262C506.978 216.329 504.711 212.731 503.139 210.506L491.85 194.539L451.984 138.377L422.431 96.3895C419.137 91.6996 414.317 86.3155 411.723 81.3562C412.223 86.6814 411.967 95.7491 411.964 101.399L411.994 136.892L411.958 193.017C411.982 204.79 412.318 218.101 411.9 229.761C407.883 229.31 400.923 229.437 396.786 229.46L375.926 229.519C371.38 229.559 367.402 229.802 362.829 229.619C362.664 220.575 362.85 210.985 362.853 201.892C362.735 182.285 362.77 162.678 362.959 143.072C362.988 132.953 362.37 122.917 362.859 112.823C362.979 110.316 362.932 107.706 362.923 105.19C362.838 88.1411 362.847 71.092 362.944 54.0433C362.991 47.9906 362.797 42.0253 363.032 35.9661C363.763 17.0078 378.785 4.66189 397.119 3.33913C400.266 2.85689 404.78 3.3194 407.942 3.75718C425.629 6.20635 432.545 18.9168 441.443 31.8341L461.55 60.6909C471.028 74.5707 481.409 88.2229 491.055 102.094L518.95 141.655C521.058 144.618 522.545 147.599 524.794 150.634C524.408 143.579 524.715 134.803 524.691 127.623L524.779 78.3739C524.897 53.7444 524.058 27.5387 524.871 3.00586Z" fill="#FE4F2B" />
</svg>
</>) : null}
</div>
<button onClick={qa.alternar} style={estilo(criarStyle)} title="Acesso rápido" className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M13 2 3 14h9l-1 8 10-12h-9z" />
</svg>
{(aberta) ? (<>
<span style={{ flex: "1", minWidth: "0", textAlign: "left", whiteSpace: "nowrap" }}>
Acesso rápido
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={estilo(qa.chev)}>
<path d="m6 9 6 6 6-6" />
</svg>
</>) : null}
</button>
<div style={estilo(qa.wrap)}>
<div style={{ minHeight: "0", overflow: "hidden" }}>
<div style={estilo(qa.painel)}>
{(qa.itens ?? []).map((qi: any, i1: number) => (
<Fragment key={qi?.id ?? qi?.chave ?? i1}>
<button onClick={qi.onClick} title={qi.l} style={estilo(qi.style)} className={[hover("background:rgba(255,255,255,.08)")].filter(Boolean).join(" ")}>
<span style={estilo(qi.ico)}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d={qi.d} />
</svg>
</span>
{(aberta) ? (<>
<span style={{ flex: "1", minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#eef1f1", whiteSpace: "nowrap" }}>
{qi.l}
</span>
<span style={{ display: "block", marginTop: "1px", fontSize: "11px", color: "#8b949e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{qi.s}
</span>
</span>
{(qi.temN) ? (<>
<span style={estilo(qi.nStyle)}>
{qi.n}
</span>
</>) : null}
</>) : null}
</button>
</Fragment>
))}
</div>
</div>
</div>
<nav style={{ marginTop: "14px", display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden", flex: "1 1 0", minHeight: "0", paddingBottom: "6px", gap: "1px" }}>
{(areas ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<div>
{(a.grupo) ? (<>
<div style={estilo(a.grupoStyle)}>
{a.grupo}
</div>
</>) : null}
<button onClick={a.acionar} style={estilo(a.style)} title={a.label} className={[hover("background:#1a222c")].filter(Boolean).join(" ")}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={a.d} />
</svg>
{(aberta) ? (<>
<span style={{ whiteSpace: "nowrap", flex: "1", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.label}
</span>
</>) : null}
{(a.temFilhos) ? (<>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(a.chevron)}>
<path d="m6 9 6 6 6-6" />
</svg>
</>) : null}
</button>
{(a.expandido) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "1px", margin: "2px 0 6px 17px", paddingLeft: "18px", borderLeft: "1px solid #242c36", animation: "of-fade .14s ease-out both" }}>
{(a.filhos ?? []).map((f: any, i2: number) => (
<Fragment key={f?.id ?? f?.chave ?? i2}>
<button onClick={f.ir} style={estilo(f.style)} className={[hover("color:#eeeff3")].filter(Boolean).join(" ")}>
<span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1" }}>
{f.label}
</span>
{(f.pendente) ? (<>
<span style={{ flex: "0 0 auto", width: "5px", height: "5px", borderRadius: "50%", background: "#59636f" }} title="Rota sem módulo" />
</>) : null}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</Fragment>
))}
</nav>
<button onClick={abrirNexo} style={estilo(nexoBtnStyle)} title="NEXO — assistente e avisos · ⌘J" className={[hover("background:#1f2833")].filter(Boolean).join(" ")}>
<span style={estilo(nexoMarca)}>
<img src="/proto/oni-avatar.png" alt="ONI" width="26" height="26" style={{ display: "block", borderRadius: "7px", flex: "0 0 auto" }} />
</span>
{(aberta) ? (<>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", fontWeight: "700", letterSpacing: ".01em", color: "#eeeff3", whiteSpace: "nowrap" }}>
NEXO
</span>
<span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fe4f2b", flex: "0 0 auto", animation: "of-pisca 1.6s ease-in-out infinite" }} />
</span>
<span style={{ display: "block", fontSize: "11px", color: "#a9b2bc", lineHeight: "1.35", marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{nexoResumo}
</span>
</span>
</>) : null}
{(aberta) ? (<>
<span style={{ flex: "0 0 auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", color: "#7e8894", border: "1px solid #2e3741", borderRadius: "4px", padding: "1px 4px" }}>
⌘J
</span>
</>) : null}
</button>
</aside>
<main data-r="main" style={{ flex: "1", minWidth: "0", height: "100%", minHeight: "0", background: "#fff", borderRadius: "14px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
<header data-r="header" style={{ flex: "0 0 auto", height: "52px", display: "flex", alignItems: "center", gap: "10px", padding: "0 13px", borderBottom: "1px solid #e3e7e8" }}>
<button onClick={toggleRail} style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", display: "grid", placeItems: "center", color: "#5c6672" }} title="Recolher menu · ⌘B" className={[hover("background:#f2f2f0;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
<rect x="3" y="3" width="18" height="18" rx="2" />
<path d="M9 3v18" />
</svg>
</button>
<span data-r="esconde-mobile" style={{ flex: "0 0 auto", width: "1px", height: "18px", background: "#e4e4e1" }} />
{(trilha ?? []).map((t: any, i1: number) => (
<Fragment key={t?.id ?? t?.chave ?? i1}>
<span data-r="trilha" style={{ display: "flex", alignItems: "center", gap: "7px", flex: "0 0 auto", minWidth: "0" }}>
<button onClick={t.ir} style={estilo(t.style)} className={[hover("color:#12171d")].filter(Boolean).join(" ")}>
{t.label}
</button>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a3a8a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="m9 18 6-6-6-6" />
</svg>
</span>
</Fragment>
))}
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14.5px", fontWeight: "700", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: "0", flex: "0 1 auto" }}>
{titulo}
</span>
{(temSubtitulo) ? (<>
<span data-r="sub" style={{ fontSize: "12.5px", color: "#4a5560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: "0" }}>
{subtitulo}
</span>
</>) : null}
<span style={{ flex: "1", minWidth: "8px" }} />
<button onClick={buscar} style={{ flex: "0 0 auto", width: "30px", height: "30px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#5c6672", border: "0", background: "transparent", cursor: "pointer" }} title="Buscar · ⌘K" className={[hover("background:#f2f2f0;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
</button>
<div data-of-sino="1" style={{ position: "relative", flex: "0 0 auto" }}>
<button onClick={toggleSino} style={estilo(sinoBtnStyle)} title="Notificações">
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
</svg>
<span style={{ position: "absolute", top: "5px", right: "5px", width: "6px", height: "6px", borderRadius: "50%", background: "#fe4f2b" }} />
</button>
{(sinoAberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 6px)", right: "0", width: "352px", maxWidth: "calc(100vw - 24px)", zIndex: "45", borderRadius: "10px", background: "#fff", border: "1px solid #e3e7e8", boxShadow: "0 10px 26px -6px rgba(0,0,0,.2)", display: "flex", flexDirection: "column", animation: "of-rise .12s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px", padding: "11px 12px 9px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap" }}>
Notificações
</span>
<span style={{ flex: "1" }} />
</div>
<div style={{ flex: "0 0 auto", display: "flex", gap: "5px", padding: "0 12px 10px" }}>
{(filtrosSino ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<button onClick={s.onClick} style={estilo(s.style)}>
{s.label}
</button>
</Fragment>
))}
</div>
<div style={{ borderTop: "1px solid #eef1f1", padding: "26px 16px 28px", textAlign: "center" }}>
<div style={{ fontSize: "13px", fontWeight: "600", color: "#3d4650", marginBottom: "5px" }}>
{sinoVazioTitulo}
</div>
<div style={{ fontSize: "12px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{sinoVazioTexto}
</div>
</div>
</div>
</>) : null}
</div>
<div data-of-perfil="1" style={{ position: "relative", flex: "0 0 auto" }}>
<button onClick={togglePerfil} style={estilo(perfilBtnStyle)}>
<span style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "9999px", background: "#12171d", color: "#fff", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{usuarioIniciais}
</span>
<span style={{ minWidth: "0", textAlign: "left" }}>
<span style={{ display: "block", fontSize: "12.5px", fontWeight: "600", color: "#12171d", lineHeight: "1.25", whiteSpace: "nowrap" }}>
{usuarioNome}
</span>
<span style={{ display: "block", fontSize: "11px", color: "#67787c", lineHeight: "1.3", whiteSpace: "nowrap" }}>
{usuarioOrganizacao}
</span>
</span>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#67787c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={estilo(perfilChevron)}>
<path d="m6 9 6 6 6-6" />
</svg>
</button>
{(perfilAberto) ? (<>
<div style={{ position: "absolute", top: "calc(100% + 6px)", right: "0", width: "268px", zIndex: "45", borderRadius: "10px", background: "#fff", border: "1px solid #e3e7e8", boxShadow: "0 10px 26px -6px rgba(0,0,0,.2)", padding: "4px", animation: "of-rise .12s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 6px 9px" }}>
<span style={{ flex: "0 0 auto", width: "32px", height: "32px", borderRadius: "9999px", background: "#12171d", color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
{usuarioIniciais}
</span>
<span style={{ minWidth: "0" }}>
<span style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#12171d", lineHeight: "1.3", whiteSpace: "nowrap" }}>
{usuarioNome}
</span>
<span style={{ display: "block", fontSize: "11.5px", color: "#67787c", lineHeight: "1.35", whiteSpace: "nowrap" }}>
{usuarioEmail}
</span>
</span>
</div>
<div style={{ height: "1px", background: "#eef1f1", margin: "0 -4px 4px" }} />
{(itensPerfil ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<button onClick={m.onClick} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", textAlign: "left", color: "#1f252c" }} className={[hover("background:#f6f7f7")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={m.d} />
</svg>
<span style={{ flex: "1", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{m.label}
</span>
{(m.atalho) ? (<>
<span style={{ flex: "0 0 auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", color: "#4a5560", background: "#f1f3f3", borderRadius: "4px", padding: "1px 5px" }}>
{m.atalho}
</span>
</>) : null}
</button>
</Fragment>
))}
<div style={{ height: "1px", background: "#eef1f1", margin: "4px -4px" }} />
<button onClick={sair} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "6px", borderRadius: "7px", border: "0", background: "transparent", cursor: "pointer", color: "#c2330f" }} className={[hover("background:#fdeeea")].filter(Boolean).join(" ")}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
</svg>
<span style={{ flex: "1", fontSize: "13px", whiteSpace: "nowrap", textAlign: "left" }}>
Sair
</span>
</button>
</div>
</>) : null}
</div>
</header>
<div style={{ flex: "1", minHeight: "0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
{children}
</div>
</main>
{(nexo.aberto) ? (<>
<div data-r="modal-fundo" onClick={nexo.fechar} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.5)", zIndex: "58", display: "grid", placeItems: "center", padding: "20px", animation: "of-fade .16s ease-out both" }}>
<div onClick={parar} style={{ width: "900px", maxWidth: "100%", height: "min(640px,calc(100vh - 40px))", background: "#fff", borderRadius: "14px", overflow: "hidden", display: "flex", animation: "of-rise .2s cubic-bezier(.2,0,.2,1) both" }}>
<aside data-r="nexo-lado" style={{ flex: "0 0 auto", width: "218px", background: "#12171d", display: "flex", flexDirection: "column", padding: "12px 10px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "2px 6px 12px" }}>
<img src="/proto/oni-avatar.png" alt="ONI" width="26" height="26" style={{ display: "block", borderRadius: "7px", flex: "0 0 auto" }} />
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "800", letterSpacing: ".02em", color: "#eeeff3", whiteSpace: "nowrap" }}>
NEXO
</span>
</div>
<button onClick={nexo.novaConversa} style={{ display: "flex", alignItems: "center", gap: "8px", height: "34px", padding: "0 11px", borderRadius: "9px", background: "#d93c1a", color: "#fff", fontSize: "13px", fontWeight: "600", whiteSpace: "nowrap", border: "0", cursor: "pointer", flex: "0 0 auto" }} className={[hover("background:#c2330f")].filter(Boolean).join(" ")}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<path d="M12 5v14M5 12h14" />
</svg>
<span>
Nova conversa
</span>
</button>
<div style={{ fontSize: "10.5px", fontWeight: "600", letterSpacing: ".08em", color: "#7e8894", padding: "16px 6px 7px", flex: "0 0 auto" }}>
INSIGHTS NEXO
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: "0 0 auto" }}>
{(nexo.atalhos ?? []).map((a: any, i1: number) => (
<Fragment key={a?.id ?? a?.chave ?? i1}>
<button onClick={a.onClick} style={estilo(a.style)} className={[hover("background:#1a222c")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={a.d} />
</svg>
<span style={{ flex: "1", minWidth: "0", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{a.label}
</span>
{(a.ativo) ? (<>
<span style={{ flex: "0 0 auto", width: "5px", height: "5px", borderRadius: "50%", background: "#fe4f2b" }} />
</>) : null}
</button>
</Fragment>
))}
</div>
<div style={{ fontSize: "10.5px", fontWeight: "600", letterSpacing: ".08em", color: "#7e8894", padding: "16px 6px 7px", flex: "0 0 auto" }}>
HISTÓRICO
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px" }}>
{(nexo.historico ?? []).map((h: any, i1: number) => (
<Fragment key={h?.id ?? h?.chave ?? i1}>
<button onClick={h.onClick} style={estilo(h.style)} className={[hover("background:#1a222c")].filter(Boolean).join(" ")}>
<span style={{ flex: "1", minWidth: "0" }}>
<span style={{ display: "block", fontSize: "12.5px", lineHeight: "1.35", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{h.titulo}
</span>
<span style={{ display: "block", fontSize: "10.5px", color: "#7e8894", lineHeight: "1.3", marginTop: "1px", whiteSpace: "nowrap" }}>
{h.quando}
</span>
</span>
</button>
</Fragment>
))}
</div>
</aside>
<div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", background: "#fff" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "9px", padding: "13px 16px", borderBottom: "1px solid #e3e7e8" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "700", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: "0" }}>
{nexo.titulo}
</span>
<span style={{ flex: "1", minWidth: "8px" }} />
<span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "#4a5560", whiteSpace: "nowrap" }}>
{nexo.contexto}
</span>
<button onClick={nexo.fechar} style={{ flex: "0 0 auto", width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", color: "#4a5560", border: "0", background: "transparent", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
<path d="M6 6l12 12M18 6L6 18" />
</svg>
</button>
</div>
{(nexo.ehRadar) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "14px", background: "#f6f6f3", display: "flex", flexDirection: "column", gap: "11px" }}>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "1px", flex: "0 0 auto", background: "#e3e7e8", borderRadius: "11px", overflow: "hidden", boxShadow: "0 0 0 1px #e3e7e8" }}>
{(nexo.radar.kpis ?? []).map((k: any, i1: number) => (
<Fragment key={k?.id ?? k?.chave ?? i1}>
<div style={{ background: "#fff", padding: "12px 13px 13px", minWidth: "0" }}>
<div style={{ fontSize: "10px", fontWeight: "600", letterSpacing: ".08em", color: "#67787c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.label}
</div>
<div style={{ display: "flex", alignItems: "baseline", gap: "7px", marginTop: "7px" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "23px", fontWeight: "700", letterSpacing: "-.03em", lineHeight: "1", color: "#12171d", whiteSpace: "nowrap" }}>
{k.valor}
</span>
<span style={estilo(k.deltaStyle)}>
{k.delta}
</span>
</div>
<div style={{ fontSize: "11px", color: "#67787c", marginTop: "5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{k.nota}
</div>
</div>
</Fragment>
))}
</div>
<div style={{ display: "grid", gridTemplateColumns: "minmax(0,242px) minmax(0,1fr)", gap: "11px", alignItems: "start", flex: "0 0 auto" }}>
<section style={{ background: "#fff", borderRadius: "11px", boxShadow: "inset 0 0 0 1px #dbdede", padding: "13px 14px 14px", minWidth: "0" }}>
<div style={{ fontSize: "10px", fontWeight: "600", letterSpacing: ".08em", color: "#67787c", lineHeight: "1.4", textWrap: "pretty" }}>
{nexo.radar.arco.rotulo}
</div>
<div style={{ position: "relative", marginTop: "2px" }}>
<svg viewBox="0 0 220 132" width="100%" style={{ display: "block", overflow: "visible" }}>
{(nexo.radar.arco.segmentos ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.cor} strokeWidth="5" strokeLinecap="butt" />
</Fragment>
))}
</svg>
<div style={{ position: "absolute", left: "0", right: "0", bottom: "6%", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", pointerEvents: "none" }}>
<span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "32px", fontWeight: "700", letterSpacing: "-.035em", lineHeight: "1", color: "#12171d" }}>
{nexo.radar.arco.pct}
</span>
<span style={{ fontSize: "11px", color: "#67787c", whiteSpace: "nowrap" }}>
{nexo.radar.arco.sub}
</span>
</div>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "9px", marginTop: "13px", paddingTop: "12px", borderTop: "1px solid #eef1f1" }}>
{(nexo.radar.arco.pilha ?? []).map((p: any, i1: number) => (
<Fragment key={p?.id ?? p?.chave ?? i1}>
<div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: "0" }}>
<span style={estilo(p.chipStyle)} />
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", color: "#1f252c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{p.nome}
</span>
<span style={{ flex: "0 0 auto", fontSize: "12.5px", fontWeight: "700", color: "#12171d", fontVariantNumeric: "tabular-nums" }}>
{p.valor}
</span>
<span style={{ flex: "0 0 auto", width: "34px", textAlign: "right", fontSize: "11px", color: "#67787c", fontVariantNumeric: "tabular-nums" }}>
{p.share}
</span>
</div>
</Fragment>
))}
</div>
</section>
<section style={{ background: "#fff", borderRadius: "11px", boxShadow: "inset 0 0 0 1px #dbdede", padding: "13px 14px 14px", minWidth: "0" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", minWidth: "0" }}>
<span style={{ flex: "0 1 auto", minWidth: "0", fontSize: "10px", fontWeight: "600", letterSpacing: ".08em", color: "#67787c", lineHeight: "1.4", textWrap: "pretty" }}>
{nexo.radar.degrau.rotulo}
</span>
<span style={{ flex: "1", minWidth: "8px" }} />
<span style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "11px" }}>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
<span style={{ width: "13px", height: "0", borderTop: "2px dotted #9aa1a6", display: "inline-block" }} />
<span style={{ fontSize: "10.5px", color: "#67787c", whiteSpace: "nowrap" }}>
meta
</span>
</span>
<span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
<span style={{ width: "13px", height: "2.5px", borderRadius: "2px", background: "#fe4f2b", display: "inline-block" }} />
<span style={{ fontSize: "10.5px", color: "#67787c", whiteSpace: "nowrap" }}>
realizado
</span>
</span>
</span>
</div>
<div style={{ position: "relative" }}>
<svg viewBox="0 0 520 210" width="100%" style={{ display: "block", overflow: "visible" }}>
<defs>
<pattern id="ofPontos" width="5" height="5" patternUnits="userSpaceOnUse">
<circle cx="1.2" cy="1.2" r=".85" fill="#d5d9da" />
</pattern>
<linearGradient id="ofArea" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="#fe4f2b" stopOpacity=".26" />
<stop offset="100%" stopColor="#fe4f2b" stopOpacity=".03" />
</linearGradient>
</defs>
{(nexo.radar.degrau.grade ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<line x1="36" y1={g.y} x2="516" y2={g.y} stroke="#eef1f1" strokeWidth="1" />
</Fragment>
))}
<path d={nexo.radar.degrau.metaArea} fill="url(#ofPontos)" />
<path d={nexo.radar.degrau.metaLinha} fill="none" stroke="#9aa1a6" strokeWidth="1.5" strokeDasharray="1.5 4" strokeLinecap="round" />
<path d={nexo.radar.degrau.realArea} fill="url(#ofArea)" />
<path d={nexo.radar.degrau.realLinha} fill="none" stroke="#fe4f2b" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
<circle cx={nexo.radar.degrau.pontaX} cy={nexo.radar.degrau.pontaY} r="4" fill="#fe4f2b" stroke="#fff" strokeWidth="2" />
</svg>
{(nexo.radar.degrau.grade ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<span style={estilo(g.style)}>
{g.label}
</span>
</Fragment>
))}
{(nexo.radar.degrau.marcos ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<span style={estilo(m.style)}>
{m.label}
</span>
</Fragment>
))}
</div>
<p style={{ margin: "8px 0 0", fontSize: "11.5px", color: "#4a5560", lineHeight: "1.5", textWrap: "pretty" }}>
{nexo.radar.degrau.nota}
</p>
</section>
</div>
<section style={{ background: "#fff", borderRadius: "11px", boxShadow: "inset 0 0 0 1px #dbdede", padding: "12px 14px 13px", flex: "0 0 auto" }}>
<div style={{ fontSize: "10px", fontWeight: "600", letterSpacing: ".08em", color: "#67787c", marginBottom: "4px" }}>
O QUE O NEXO ESTÁ VENDO
</div>
<div style={{ display: "flex", flexDirection: "column" }}>
{(nexo.radar.sinais ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<div style={estilo(s.linhaStyle)}>
<span style={estilo(s.pontoStyle)} />
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", lineHeight: "1.5", color: "#1f252c", textWrap: "pretty" }}>
{s.texto}
</span>
<button onClick={s.onClick} style={{ flex: "0 0 auto", height: "27px", padding: "0 11px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", fontSize: "11.5px", fontWeight: "600", color: "#1f252c", whiteSpace: "nowrap", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3")].filter(Boolean).join(" ")}>
{s.acao}
</button>
</div>
</Fragment>
))}
</div>
</section>
</div>
</>) : null}
{(nexo.ehChat) ? (<>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
{(nexo.mensagens ?? []).map((m: any, i1: number) => (
<Fragment key={m?.id ?? m?.chave ?? i1}>
<div style={estilo(m.linhaStyle)}>
{(m.ehOni) ? (<>
<img src="/proto/oni-avatar.png" alt="ONI" width="26" height="26" style={{ display: "block", borderRadius: "7px", flex: "0 0 auto" }} />
</>) : null}
<div style={estilo(m.bolhaStyle)}>
{(m.ehInsight) ? (<>
<div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
<span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fe4f2b", flex: "0 0 auto" }} />
<span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: ".06em", color: "#9c3210", whiteSpace: "nowrap" }}>
{m.rotulo}
</span>
</div>
</>) : null}
<div style={estilo(m.textoStyle)}>
{m.texto}
</div>
{(m.temItens) ? (<>
<div style={{ display: "flex", flexDirection: "column", gap: "7px", marginTop: "10px" }}>
{(m.itens ?? []).map((i: any, i2: number) => (
<Fragment key={i?.id ?? i?.chave ?? i2}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
<span style={{ flex: "0 0 auto", width: "5px", height: "5px", borderRadius: "50%", background: "#c8ccc9", marginTop: "6px" }} />
<span style={{ flex: "1", minWidth: "0", fontSize: "12.5px", lineHeight: "1.5", color: "#1f252c", textWrap: "pretty" }}>
{i.texto}
</span>
</div>
</Fragment>
))}
</div>
</>) : null}
{(m.temAcoes) ? (<>
<div style={{ display: "flex", gap: "6px", marginTop: "11px", flexWrap: "wrap" }}>
{(m.acoes ?? []).map((b: any, i2: number) => (
<Fragment key={b?.id ?? b?.chave ?? i2}>
<button onClick={b.onClick} style={estilo(b.style)}>
{b.label}
</button>
</Fragment>
))}
</div>
</>) : null}
</div>
</div>
</Fragment>
))}
{(nexo.pensando) ? (<>
<div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
<img src="/proto/oni-avatar.png" alt="ONI" width="26" height="26" style={{ display: "block", borderRadius: "7px", flex: "0 0 auto" }} />
<span style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "9px 12px", borderRadius: "10px", background: "#f6f7f7", fontSize: "12.5px", color: "#4a5560" }}>
<span>
Consultando a base
</span>
<span style={{ width: "2px", height: "13px", background: "#fe4f2b", display: "inline-block", animation: "of-cursor 1s steps(2) infinite" }} />
</span>
</div>
</>) : null}
</div>
<div style={{ flex: "0 0 auto", padding: "11px 16px 13px", borderTop: "1px solid #e3e7e8" }}>
<div style={{ display: "flex", alignItems: "flex-end", gap: "8px", borderRadius: "11px", background: "#fff", boxShadow: "inset 0 0 0 1px #dbdede", padding: "6px 6px 6px 12px" }}>
<input value={nexo.rascunho} onChange={nexo.setRascunho} onKeyDown={nexo.tecla} placeholder="Oii, usuario Comoo posso te ajudar?" style={{ flex: "1", minWidth: "0", border: "0", outline: "0", background: "transparent", fontSize: "13.5px", height: "32px" }} />
<button onClick={nexo.enviar} style={estilo(nexo.enviarStyle)} title="Enviar">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
</svg>
</button>
</div>
<div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
{(nexo.sugestoes ?? []).map((s: any, i1: number) => (
<Fragment key={s?.id ?? s?.chave ?? i1}>
<button onClick={s.onClick} style={{ height: "26px", padding: "0 10px", borderRadius: "7px", background: "#fff", boxShadow: "inset 0 0 0 1px #e3e7e8", color: "#4a5560", fontSize: "11.5px", fontWeight: "500", whiteSpace: "nowrap", flex: "0 0 auto", border: "0", cursor: "pointer" }} className={[hover("background:#f1f3f3;color:#12171d")].filter(Boolean).join(" ")}>
{s.label}
</button>
</Fragment>
))}
</div>
</div>
</>) : null}
</div>
</div>
</div>
</>) : null}
{(buscaAberta) ? (<>
<div data-r="modal-fundo" onClick={fecharBusca} style={{ position: "fixed", inset: "0", background: "rgba(9,14,20,.42)", zIndex: "60", display: "flex", justifyContent: "center", padding: "88px 20px 20px", animation: "of-fade .14s ease-out both" }}>
<div onClick={parar} style={{ width: "576px", maxWidth: "100%", height: "max-content", maxHeight: "calc(100vh - 116px)", background: "#fff", borderRadius: "10px", border: "1px solid #e3e7e8", boxShadow: "0 10px 30px -6px rgba(0,0,0,.22)", overflow: "hidden", display: "flex", flexDirection: "column", animation: "of-rise .16s cubic-bezier(.2,0,.2,1) both" }}>
<div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "9px", padding: "12px 14px", borderBottom: "1px solid #eef1f1" }}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.9" strokeLinecap="round" style={{ flex: "0 0 auto" }}>
<circle cx="11" cy="11" r="7" />
<path d="m16.5 16.5 4 4" />
</svg>
<input value={termo} onChange={setTermo} onKeyDown={teclaBusca} ref={buscaRef} placeholder="Buscar empresa, pessoa, lead, oportunidade ou proposta" style={{ border: "0", outline: "0", background: "transparent", width: "100%", fontSize: "14px", minWidth: "0" }} />
<span style={{ flex: "0 0 auto", fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", color: "#4a5560", background: "#f1f3f3", borderRadius: "4px", padding: "2px 6px" }}>
ESC
</span>
</div>
<div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "4px" }}>
{(gruposBusca ?? []).map((g: any, i1: number) => (
<Fragment key={g?.id ?? g?.chave ?? i1}>
<div>
<div style={{ fontSize: "11px", fontWeight: "600", color: "#4a5560", letterSpacing: ".04em", padding: "8px 8px 4px" }}>
{g.titulo}
</div>
{(g.itens ?? []).map((r: any, i2: number) => (
<Fragment key={r?.id ?? r?.chave ?? i2}>
<button onClick={r.onClick} onMouseEnter={r.onHover} style={estilo(r.style)}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5560" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}>
<path d={r.d} />
</svg>
<span style={{ flex: "1", fontSize: "14px", lineHeight: "20px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
{r.label}
</span>
{(r.tag) ? (<>
<span style={{ flex: "0 0 auto", fontSize: "10.5px", fontWeight: "600", color: "#4a5560", background: "#f1f3f3", borderRadius: "4px", padding: "2px 6px", whiteSpace: "nowrap" }}>
{r.tag}
</span>
</>) : null}
</button>
</Fragment>
))}
</div>
</Fragment>
))}
{(buscaSemDados) ? (<>
<div style={{ padding: "26px 16px", textAlign: "center", borderTop: "1px solid #eef1f1", marginTop: "4px" }}>
<div style={{ fontSize: "12.5px", fontWeight: "600", marginBottom: "5px" }}>
{buscaVazioTitulo}
</div>
<div style={{ fontSize: "12px", color: "#4a5560", lineHeight: "1.5", maxWidth: "400px", margin: "0 auto", textWrap: "pretty" }}>
{buscaVazioTexto}
</div>
</div>
</>) : null}
</div>
<div style={{ flex: "0 0 auto", display: "flex", gap: "14px", padding: "8px 14px", borderTop: "1px solid #eef1f1", background: "#fafafa", fontSize: "11.5px", color: "#4a5560", flexWrap: "wrap" }}>
<span style={{ whiteSpace: "nowrap" }}>
↑↓ navegar
</span>
<span style={{ whiteSpace: "nowrap" }}>
↵ abrir
</span>
<span style={{ whiteSpace: "nowrap" }}>
esc fechar
</span>
</div>
</div>
</div>
</>) : null}
{(temAviso) ? (<>
<div style={{ position: "fixed", bottom: "18px", left: "50%", transform: "translateX(-50%)", zIndex: "70", background: "#12171d", color: "#eeeff3", borderRadius: "10px", padding: "10px 15px", display: "flex", alignItems: "center", gap: "9px", maxWidth: "calc(100vw - 32px)", animation: "of-rise .22s cubic-bezier(.2,0,.2,1) both" }}>
<span style={estilo(avisoPonto)} />
<span style={{ fontSize: "12.5px", fontWeight: "500", lineHeight: "1.4" }}>
{aviso}
</span>
</div>
</>) : null}
</div>
    </>
  );
}
