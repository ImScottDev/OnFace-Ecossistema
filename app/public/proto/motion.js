/* OnFace motion — entradas estilo GSAP (expo-out) sem dependência.
   Uso no template:
     data-in="rise|fade|fade-down|slide-left|pop|drop|rise-up"   anima o próprio nó quando ele aparece
     data-stagger="30"                                             anima cada filho novo em cascata (ms entre eles)
     data-count                                                    número sobe de 0 até o valor ao aparecer
   Só nós novos animam: re-render do React não repete a entrada. Respeita prefers-reduced-motion. */
(function () {
  if (window.OnFaceMotion) return;
  const reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(.16,1,.3,1)";
  const K = {
    rise: [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }],
    "rise-up": [{ opacity: 0, transform: "translate(-50%,14px) scale(.98)" }, { opacity: 1, transform: "translate(-50%,0) scale(1)" }],
    fade: [{ opacity: 0 }, { opacity: 1 }],
    "fade-down": [{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }],
    "slide-left": [{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }],
    pop: [{ opacity: 0, transform: "translateY(8px) scale(.965)" }, { opacity: 1, transform: "none" }],
    drop: [{ opacity: 0, transform: "translateY(-4px) scale(.98)" }, { opacity: 1, transform: "none" }],
    row: [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
    blur: [{ opacity: 0, filter: "blur(10px)", transform: "translateY(14px) scale(.98)" }, { opacity: 1, filter: "blur(0)", transform: "none" }],
    flip: [{ opacity: 0, transform: "perspective(900px) rotateX(-38deg) translateY(18px)", transformOrigin: "50% 0" }, { opacity: 1, transform: "perspective(900px) rotateX(0) translateY(0)", transformOrigin: "50% 0" }],
    spring: [{ opacity: 0, transform: "translateY(26px) scale(.9)" }, { opacity: 1, transform: "translateY(-4px) scale(1.015)", offset: .62 }, { transform: "translateY(1px) scale(.998)", offset: .84 }, { opacity: 1, transform: "none" }],
    curtain: [{ opacity: 0, clipPath: "inset(0 0 100% 0 round 12px)", transform: "translateY(10px)" }, { opacity: 1, clipPath: "inset(0 0 0% 0 round 12px)", transform: "none" }],
    swing: [{ opacity: 0, transform: "perspective(700px) rotateY(-24deg) translateX(-18px)", transformOrigin: "0 50%" }, { opacity: 1, transform: "perspective(700px) rotateY(0) translateX(0)", transformOrigin: "0 50%" }],
    zoom: [{ opacity: 0, transform: "scale(1.06)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }]
  };
  const DUR = { rise: 620, "rise-up": 520, fade: 360, "fade-down": 480, "slide-left": 560, pop: 440, drop: 260, row: 520, blur: 760, flip: 820, spring: 900, curtain: 820, swing: 760, zoom: 700 };
  const EASE_DE = { spring: "cubic-bezier(.22,1,.36,1)", flip: "cubic-bezier(.2,1.1,.3,1)" };
  const vistos = new WeakSet();

  function anima(el, tipo, atraso) {
    if (vistos.has(el)) return;
    vistos.add(el);
    if (reduz || !el.animate) return;
    const k = K[tipo] || K.rise;
    el.animate(k, { duration: DUR[tipo] || 520, delay: atraso || 0, easing: EASE_DE[tipo] || EASE, fill: "backwards" });
  }

  function conta(el) {
    if (vistos.has(el)) return;
    vistos.add(el);
    const alvo = el.textContent.trim();
    if (!/^-?[\d.,]+\s*%?$/.test(alvo)) return;
    const n = parseFloat(alvo.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (reduz || isNaN(n) || n === 0) return;
    const suf = alvo.replace(/^[\d.,\s-]+/, "");
    const t0 = performance.now(), dur = 900;
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(n * e) + (suf ? suf : "");
      if (p < 1) requestAnimationFrame(passo); else el.textContent = alvo;
    };
    requestAnimationFrame(passo);
  }

  let varre = function (raiz) {
    if (!raiz || raiz.nodeType !== 1) return;
    const lista = [raiz].concat(Array.from(raiz.querySelectorAll("[data-in],[data-stagger],[data-count]")));
    lista.forEach(el => {
      if (el.hasAttribute("data-in")) anima(el, el.getAttribute("data-in"), +(el.getAttribute("data-delay") || 0));
      if (el.hasAttribute("data-count")) conta(el);
      if (el.hasAttribute("data-stagger")) {
        const gap = +(el.getAttribute("data-stagger") || 30);
        let i = 0;
        const base = +(el.getAttribute("data-delay") || 0);
        Array.from(el.children).forEach(c => { if (!vistos.has(c)) { anima(c, el.getAttribute("data-stagger-tipo") || "row", base + Math.min(i, 14) * gap); i++; } });
      }
    });
  };

  // `forcaHerdada` vem do pai com data-stagger-filhos-tilt. Não se escreve
  // `data-tilt` no filho: se isto rodar antes de o React hidratar, o atributo
  // novo vira hydration mismatch.
  function liga3d(el, forcaHerdada) {
    if (el.__of3d || reduz) return; el.__of3d = true;
    const forca = +(el.getAttribute("data-tilt") || forcaHerdada || 6);
    if (getComputedStyle(el).position === "static") el.style.setProperty("position", "relative");
    let raf = 0;
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      const b = el.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("transform", "perspective(800px) rotateX(" + ((.5 - y) * forca).toFixed(2) + "deg) rotateY(" + ((x - .5) * forca).toFixed(2) + "deg) translateY(-3px)");
      });
    });
    el.addEventListener("pointerenter", () => {
      el.__ofTr = el.style.transition;
      el.style.transition = (el.__ofTr ? el.__ofTr + ", " : "") + "transform .18s cubic-bezier(.16,1,.3,1), filter .25s ease";
      el.style.filter = "drop-shadow(0 12px 16px rgba(18,23,29,.16))";
    });
    el.addEventListener("pointerleave", () => {
      cancelAnimationFrame(raf);
      el.style.transition = (el.__ofTr ? el.__ofTr + ", " : "") + "transform .5s cubic-bezier(.16,1,.3,1), filter .3s ease";
      el.style.removeProperty("transform");
      el.style.filter = "";
      setTimeout(() => { if (!el.matches(":hover")) el.style.transition = el.__ofTr || ""; }, 520);
    });
  }
  function ligaIma(el) {
    if (el.__ofIma || reduz) return; el.__ofIma = true;
    const f = +(el.getAttribute("data-magnet") || 6);
    el.addEventListener("pointermove", (e) => { const b = el.getBoundingClientRect(); el.style.transform = "translate(" + (((e.clientX - b.left) / b.width - .5) * f).toFixed(1) + "px," + (((e.clientY - b.top) / b.height - .5) * f).toFixed(1) + "px)"; });
    el.addEventListener("pointerleave", () => { el.style.transition = "transform .45s cubic-bezier(.16,1,.3,1)"; el.style.transform = ""; setTimeout(() => { el.style.transition = ""; }, 460); });
  }
  const varreAntigo = varre;
  varre = function (raiz) {
    varreAntigo(raiz);
    if (!raiz || raiz.nodeType !== 1) return;
    [raiz].concat(Array.from(raiz.querySelectorAll("[data-tilt],[data-magnet]"))).forEach(el => {
      if (el.hasAttribute && el.hasAttribute("data-tilt")) liga3d(el);
      if (el.hasAttribute && el.hasAttribute("data-magnet")) ligaIma(el);
    });
    Array.from(raiz.querySelectorAll("[data-stagger-filhos-tilt]")).forEach(p => Array.from(p.children).forEach(c => { if (!c.hasAttribute("data-tilt")) liga3d(c, p.getAttribute("data-stagger-filhos-tilt")); }));
  };

  const obs = new MutationObserver(ms => {
    ms.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        const pai = n.parentElement;
        if (pai && pai.hasAttribute && pai.hasAttribute("data-stagger") && !vistos.has(n)) {
          const irmaos = Array.from(pai.children).filter(c => !vistos.has(c));
          const i = irmaos.indexOf(n);
          anima(n, pai.getAttribute("data-stagger-tipo") || "row", Math.min(Math.max(i, 0), 14) * (+(pai.getAttribute("data-stagger")) || 30));
        }
        varre(n);
      });
    });
  });
  const liga = () => { varre(document.body); obs.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) liga(); else document.addEventListener("DOMContentLoaded", liga);
  window.OnFaceMotion = { anima, varre };
})();
