(() => {
  // node_modules/.pnpm/@iframe-resizer+child@5.5.9/node_modules/@iframe-resizer/child/index.umd.js
  !(function(e) {
    "function" == typeof define && define.amd ? define(e) : e();
  })(function() {
    "use strict";
    const e = "font-weight: normal;", t = "font-weight: bold;", n = "font-style: italic;", o = e + n, r = "default", i = Object.freeze({ assert: true, error: true, warn: true }), a = { expand: false, defaultEvent: void 0, event: void 0, label: "AutoConsoleGroup", showTime: true }, s = { profile: 0, profileEnd: 0, timeStamp: 0, trace: 0 }, c = Object.assign(console);
    const { fromEntries: l, keys: u } = Object, d = (e2) => [e2, c[e2]], f = (e2) => (t2) => [t2, function(n2) {
      e2[t2] = n2;
    }], m = (e2, t2) => l(u(e2).map(t2));
    const p = !(typeof window > "u" || "function" != typeof window.matchMedia) && window.matchMedia("(prefers-color-scheme: dark)").matches, h = p ? "color: #A9C7FB;" : "color: #135CD2;", y = p ? "color: #E3E3E3;" : "color: #1F1F1F;", g = "5.5.9", b = "iframeResizer", v = ":", z = "init", w = "message", $ = "pageHide", S = "pageInfo", O = "parentInfo", E = "scrollToOffset", M = "title", k = 10, j = "data-iframe-size", x = "data-iframe-overflowed", T = "data-iframe-ignore", I = "height", C = "width", N = "offset", A = "offsetSize", P = "string", R = "number", B = "object", q = "function", L = "auto", D = "readystatechange", F = "bottom", W = "right", H = "autoResizeEnabled", V = /* @__PURE__ */ Symbol("sizeChanged"), U = "manualResize", Z = "parentResize", J = { [U]: 1, [Z]: 1 }, _ = "setOffsetSize", Q = "resizeObserver", G = "overflowObserver", Y = "mutationObserver", X = "visibilityObserver", K = "[iFrameSizer]", ee = /* @__PURE__ */ new Set(["head", "body", "meta", "base", "title", "script", "link", "style", "map", "area", "option", "optgroup", "template", "track", "wbr", "nobr"]), te = (e2) => {
      if (!e2) return "";
      let t2 = -559038744, n2 = 1103547984;
      for (let o2, r2 = 0; r2 < e2.length; r2++) o2 = e2.codePointAt(r2), t2 = Math.imul(t2 ^ o2, 2246822519), n2 = Math.imul(n2 ^ o2, 3266489917);
      return t2 ^= Math.imul(t2 ^ n2 >>> 15, 1935289751), n2 ^= Math.imul(n2 ^ t2 >>> 15, 3405138345), t2 ^= n2 >>> 16, n2 ^= t2 >>> 16, (2097152 * (n2 >>> 0) + (t2 >>> 11)).toString(36);
    }, ne = (e2) => e2.replace(/[A-Za-z]/g, (e3) => String.fromCodePoint((e3 <= "Z" ? 90 : 122) >= (e3 = e3.codePointAt(0) + 19) ? e3 : e3 - 26)), oe = ["spjluzl", "rlf", "clyzpvu"], re = ["<yi>Puchspk Spjluzl Rlf</><iy><iy>", "<yi>Tpzzpun Spjluzl Rlf</><iy><iy>", "Aopz spiyhyf pz hchpshisl dpao ivao Jvttlyjphs huk Vwlu-Zvbyjl spjluzlz.<iy><iy><i>Jvttlyjphs Spjluzl</><iy>Mvy jvttlyjphs bzl, <p>pmyhtl-ylzpgly</> ylxbpylz h svd jvza vul aptl spjluzl mll. Mvy tvyl pumvythapvu cpzpa <b>oaawz://pmyhtl-ylzpgly.jvt/wypjpun</>.<iy><iy><i>Vwlu Zvbyjl Spjluzl</><iy>Pm fvb hyl bzpun aopz spiyhyf pu h uvu-jvttlyjphs vwlu zvbyjl wyvqlja aolu fvb jhu bzl pa mvy myll bukly aol alytz vm aol NWS C3 Spjluzl. Av jvumpyt fvb hjjlwa aolzl alytz, wslhzl zla aol <i>spjluzl</> rlf pu <p>pmyhtl-ylzpgly</> vwapvuz av <i>NWSc3</>.<iy><iy>Mvy tvyl pumvythapvu wslhzl zll: <b>oaawz://pmyhtl-ylzpgly.jvt/nws</>", "<i>NWSc3 Spjluzl Clyzpvu</><iy><iy>Aopz clyzpvu vm <p>pmyhtl-ylzpgly</> pz ilpun bzlk bukly aol alytz vm aol <i>NWS C3</> spjluzl. Aopz spjluzl hssvdz fvb av bzl <p>pmyhtl-ylzpgly</> pu Vwlu Zvbyjl wyvqljaz, iba pa ylxbpylz fvby wyvqlja av il wbispj, wyvcpkl haaypibapvu huk il spjluzlk bukly clyzpvu 3 vy shaly vm aol NUB Nlulyhs Wbispj Spjluzl.<iy><iy>Pm fvb hyl bzpun aopz spiyhyf pu h uvu-vwlu zvbyjl wyvqlja vy dlizpal, fvb dpss ullk av wbyjohzl h svd jvza vul aptl jvttlyjphs spjluzl.<iy><iy>Mvy tvyl pumvythapvu cpzpa <b>oaawz://pmyhtl-ylzpgly.jvt/wypjpun</>.", "<iy><yi>Zvsv spjluzl kvlz uva zbwwvya jyvzz-kvthpu</><iy><iy>Av bzl <p>pmyhtl-ylzpgly</> dpao jyvzz kvthpu pmyhtlz fvb ullk lpaoly aol Wyvmlzzpvuhs vy Ibzpulzz spjluzlz. Mvy klahpsz vu bwnyhkl wypjpun wslhzl jvuahja pumv@pmyhtl-ylzpgly.jvt.", "Pu whnl spurpun ylxbpylz h Wyvmlzzpvuhs vy Ibzpulzz spjluzl. Wslhzl zll <b>oaawz://pmyhtl-ylzpgly.jvt/wypjpun</> mvy tvyl klahpsz."], ie = ["NWSc3", "zvsv", "wyv", "ibzpulzz", "vlt"], ae = Object.fromEntries(["2cgs7fdf4xb", "1c9ctcccr4z", "1q2pc4eebgb", "ueokt0969w", "w2zxchhgqz", "1umuxblj2e5", "2b5sdlfhbev", "zo4ui3arjo", "oclbb4thgl"].map((e2, t2) => [e2, Math.max(0, t2 - 1)])), se = (e2) => ne(re[e2]), ce = (e2) => {
      const t2 = e2[ne(oe[0])] || e2[ne(oe[1])] || e2[ne(oe[2])];
      if (!t2) return -1;
      const n2 = t2.split("-");
      let o2 = (function(e3 = "") {
        let t3 = -2;
        const n3 = te(ne(e3));
        return n3 in ae && (t3 = ae[n3]), t3 > 4 ? t3 - 4 : t3;
      })(n2[0]);
      return 0 === o2 || ((e3) => e3[2] === te(e3[0] + e3[1]))(n2) || (o2 = -2), o2;
    }, le = (e2, ...t2) => setTimeout(() => e2(...t2), 0), ue = (e2) => {
      let t2 = false;
      return function() {
        return t2 ? void 0 : (t2 = true, Reflect.apply(e2, this, arguments));
      };
    }, de = (e2) => e2, fe = (e2) => Math.round(1e3 * e2) / 1e3, me = (e2) => e2.charAt(0).toUpperCase() + e2.slice(1), pe = (e2) => "" != `${e2}` && void 0 !== e2, he = (e2) => e2();
    const ye = (e2, t2, n2) => {
      if (typeof e2 !== t2) throw new TypeError(`${n2} is not a ${me(t2)}`);
    }, ge = { br: "\n", rb: "\x1B[31;1m", bb: "\x1B[34;1m", b: "\x1B[1m", i: "\x1B[3m", u: "\x1B[4m", "/": "\x1B[m" }, be = Object.keys(ge), ve = new RegExp(`<(${be.join("|")})>`, "gi"), ze = (e2, t2) => ge[t2] ?? "";
    let we = true, $e = b;
    const Se = (Oe = function(n2 = {}) {
      const l2 = {}, u2 = {}, p2 = [], h2 = { ...a, expand: !n2.collapsed || a.expanded, ...n2 };
      let y2 = "";
      function g2() {
        p2.length = 0, y2 = "";
      }
      function b2() {
        delete h2.event, g2();
      }
      const v2 = () => !!p2.some(([e2]) => e2 in i) || !!h2.expand;
      function z2() {
        if (0 !== p2.length) {
          c[v2() ? "group" : "groupCollapsed"](`%c${h2.label}%c ${((e2) => {
            const t2 = e2.event || e2.defaultEvent;
            return t2 ? `${t2}` : "";
          })(h2)} %c${h2.showTime ? y2 : ""}`, e, t, o);
          for (const [e2, ...t2] of p2) c.assert(e2 in c, `Unknown console method: ${e2}`), e2 in c && c[e2](...t2);
          c.groupEnd(), b2();
        } else b2();
      }
      function w2() {
        "" === y2 && (y2 = (function() {
          const e2 = /* @__PURE__ */ new Date(), t2 = (t3, n3) => e2[t3]().toString().padStart(n3, "0");
          return `@ ${t2("getHours", 2)}:${t2("getMinutes", 2)}:${t2("getSeconds", 2)}.${t2("getMilliseconds", 3)}`;
        })(), queueMicrotask(() => queueMicrotask(z2)));
      }
      function $2(e2, ...t2) {
        0 === p2.length && w2(), p2.push([e2, ...t2]);
      }
      function S2(e2 = r, ...t2) {
        l2[e2] ? $2("log", `${e2}: ${performance.now() - l2[e2]} ms`, ...t2) : $2("timeLog", e2, ...t2);
      }
      return { ...m(h2, f(h2)), ...m(console, (e2) => [e2, (...t2) => $2(e2, ...t2)]), ...m(s, d), assert: function(e2, ...t2) {
        true !== e2 && $2("assert", e2, ...t2);
      }, count: function(e2 = r) {
        u2[e2] ? u2[e2] += 1 : u2[e2] = 1, $2("log", `${e2}: ${u2[e2]}`);
      }, countReset: function(e2 = r) {
        delete u2[e2];
      }, endAutoGroup: z2, errorBoundary: (e2) => (...t2) => {
        let n3;
        try {
          n3 = e2(...t2);
        } catch (e3) {
          if (!Error.prototype.isPrototypeOf(e3)) throw e3;
          $2("error", e3), z2();
        }
        return n3;
      }, event: function(e2) {
        w2(), h2.event = e2;
      }, purge: g2, time: function(e2 = r) {
        w2(), l2[e2] = performance.now();
      }, timeEnd: function(e2 = r) {
        S2(e2), delete l2[e2];
      }, timeLog: S2, touch: w2 };
    }, Oe?.__esModule ? Oe.default : Oe);
    var Oe;
    const Ee = Se({ label: `${b}(child)`, expand: false });
    var Me;
    const ke = (Me = "log", (...e2) => !we || Ee[Me](...e2));
    const { assert: je, endAutoGroup: xe, error: Te, errorBoundary: Ie, event: Ce, label: Ne, purge: Ae, warn: Pe } = Ee, Re = (Be = de, (e2) => Be(typeof e2 === P ? window.chrome ? e2.replace(ve, ze) : ((e3) => e3.replaceAll("<br>", "\n").replaceAll(/<\/?[^>]+>/gi, ""))(e2) : e2));
    var Be;
    const qe = (...e2) => Ee.warn(...e2.map(Re)), Le = /* @__PURE__ */ ((e2) => (t2, n2 = "renamed to") => (o2, r2, i2 = "", a2 = "") => e2(a2, `<rb>Deprecated ${t2}(${o2.replace("()", "")})</>

The <b>${o2}</> ${t2.toLowerCase()} has been ${n2} <b>${r2}</>. ${i2}Use of the old ${t2.toLowerCase()} will be removed in a future version of <i>iframe-resizer</>.`))((e2, t2) => qe(t2)), De = Le("Method"), Fe = Le("Method", "replaced with"), We = Le("Option"), He = ["min-height", "min-width", "max-height", "max-width"], Ve = /* @__PURE__ */ new Set(), Ue = (e2, t2) => window.getComputedStyle(e2).getPropertyValue(t2), Ze = (e2, t2) => {
      return (n2 = Ue(e2, t2)) && "0px" !== n2 && n2 !== L && "none" !== n2;
      var n2;
    };
    function Je({ href: e2 }) {
      Ve.has(e2) || Ve.add(e2);
    }
    const _e = (e2, t2) => (function(e3, t3) {
      const n2 = e3.style[t3];
      return n2 ? { source: "an inline style attribute", value: n2 } : null;
    })(e2, t2) || (function(e3, t3) {
      for (const n2 of document.styleSheets) try {
        for (const o2 of n2.cssRules || []) if (o2.selectorText && e3.matches(o2.selectorText)) {
          const e4 = o2.style[t3];
          if (e4) return { source: "STYLE" === n2.ownerNode.tagName ? "an inline <style> block" : `stylesheet (${n2.href})`, value: e4 };
        }
      } catch (e4) {
        Je(n2);
      }
      return { source: "cross-origin stylesheet", value: Ue(e3, t3) };
    })(e2, t2), Qe = (e2, t2) => {
      const { source: n2, value: o2 } = _e(e2, t2), r2 = ((e3) => e3.tagName ? e3.tagName.toLowerCase() : "unknown")(e2);
      qe(`The <b>${t2}</> CSS property is set to <b>${o2}</> on the <b><${r2}></> element via ${n2}. This may cause issues with the correct operation of <i>iframe-resizer</>.

If you wish to restrict the size of the iframe, then you should set this property on the iframe element itself, not the content inside it.`);
    };
    function Ge() {
      for (const e2 of [document.documentElement, document.body]) for (const t2 of He) Ze(e2, t2) && Qe(e2, t2);
    }
    const Ye = (e2) => (t2) => void 0 === t2 ? void 0 : e2(t2), Xe = Ye((e2) => "true" === e2), Ke = Ye(Number), et = [], tt = (e2, t2, n2, o2) => {
      e2.removeEventListener(t2, n2, o2);
    }, nt = (e2, t2, n2, o2 = false) => {
      e2.addEventListener(t2, n2, o2), et.push(() => tt(e2, t2, n2, o2));
    }, ot = (e2) => (e3) => {
      e3.size;
    }, rt = /* @__PURE__ */ ((e2 = "") => (t2) => (n2) => {
      n2.size > 0 && Te(`${t2}Observer ${e2}:`, ...Array.from(n2).flatMap((e3) => ["\n", e3]));
    })("already attached"), it = (e2) => (e3) => {
      e3.size;
    }, at = (t2, n2 = true) => (o2) => {
      o2 > 0 && ke(`${n2 ? "At" : "De"}tached %c${t2}Observer%c ${n2 ? "to" : "from"} %c${o2}%c element${1 === o2 ? "" : "s"}`, h, e, h, e);
    }, st = (e2, t2, n2, o2) => {
      const r2 = it(e2);
      return (e3) => {
        const i2 = /* @__PURE__ */ new Set();
        let a2 = 0;
        for (const o3 of e3) n2.has(o3) && (t2.unobserve(o3), n2.delete(o3), i2.add(o3), a2 += 1);
        r2(i2), o2(a2), i2.clear();
      };
    }, ct = /* @__PURE__ */ new Set(), lt = /* @__PURE__ */ new Set(), ut = /* @__PURE__ */ new Set(), dt = [], ft = { attributes: true, attributeFilter: [T, j], attributeOldValue: false, characterData: false, characterDataOldValue: false, childList: true, subtree: true };
    let mt, pt = 1, ht = false, yt = 0;
    const gt = (e2) => {
      e2.size;
    }, bt = (e2) => {
      e2.size;
    }, vt = (e2) => {
      e2.size;
    }, zt = (e2) => e2.nodeType !== Node.ELEMENT_NODE || ee.has(e2.tagName.toLowerCase());
    function wt(e2) {
      const t2 = e2.addedNodes;
      for (const e3 of t2) zt(e3) || ct.add(e3);
    }
    function $t(e2) {
      const t2 = e2.removedNodes;
      for (const e3 of t2) zt(e3) || (ct.has(e3) ? (ct.delete(e3), ut.add(e3)) : lt.add(e3));
    }
    const St = (e2) => {
      ke("Mutations:", e2);
      for (const t2 of e2) wt(t2), $t(t2);
      gt(ct), bt(lt), vt(ut), ut.clear();
    };
    const Ot = (e2) => () => {
      const t2 = performance.now(), n2 = t2 - yt, o2 = 16 * pt++ + 2;
      if (n2 > o2 && n2 < 200) return Ce("mutationThrottled"), ke("Update delayed due to heavy workload on the callStack"), ke(`EventLoop busy time: %c${fe(n2)}ms %c> Max wait: %c${o2 - 2}ms`, h, y, h), setTimeout(mt, 16 * pt), void (yt = t2);
      pt = 1, dt.forEach(St), dt.length = 0, ht = false, lt.size, ct.size, e2({ addedNodes: ct, removedNodes: lt }), ct.clear(), lt.clear();
    };
    function Et(e2) {
      dt.push(e2), ht || (yt = performance.now(), ht = true, requestAnimationFrame(mt));
    }
    function Mt(e2) {
      const t2 = new window.MutationObserver(Et), n2 = document.body || document.documentElement;
      return mt = Ot(e2), t2.observe(n2, ft), ke("Attached%c MutationObserver%c to body", h, y), { ...t2, disconnect: () => {
        ct.clear(), lt.clear(), dt.length = 0, t2.disconnect(), ke("Detached%c MutationObserver", h);
      } };
    }
    const kt = "Overflow", jt = at(kt), xt = at(kt, false), Tt = ot(kt), It = rt(kt), Ct = (e2) => e2.hidden || null === e2.offsetParent || "none" === e2.style.display, Nt = (e2, t2) => {
      const n2 = t2.side, o2 = { root: t2.root, rootMargin: "0px", threshold: 1 }, r2 = window?.requestAnimationFrame || de, i2 = (t3 = false) => e2(t3), a2 = (e3, t3) => 0 === e3 || e3 > t3[n2], s2 = (e3, t3) => e3.toggleAttribute(x, t3);
      const c2 = new IntersectionObserver(function(e3) {
        for (const t3 of e3) {
          const { boundingClientRect: e4, rootBounds: o3, target: r3 } = t3;
          if (!o3) continue;
          const i3 = e4[n2], c3 = a2(i3, o3) && !Ct(r3);
          s2(r3, c3);
        }
        r2(i2);
      }, o2), l2 = /* @__PURE__ */ new WeakSet();
      return { attachObservers: function(e3) {
        const t3 = /* @__PURE__ */ new Set(), n3 = /* @__PURE__ */ new Set();
        let o3 = 0;
        for (const r3 of e3) r3.nodeType === Node.ELEMENT_NODE && (l2.has(r3) ? t3.add(r3) : (c2.observe(r3), l2.add(r3), n3.add(r3), o3 += 1));
        It(t3), Tt(n3), jt(o3), n3.clear(), t3.clear();
      }, detachObservers: st(kt, c2, l2, xt), disconnect: () => {
        c2.disconnect(), ke("Detached%c OverflowObserver", h);
      } };
    }, At = "--ifr-start", Pt = "--ifr-end", Rt = "--ifr-measure", Bt = [];
    let qt, Lt = {}, Dt = 0;
    function Ft() {
      try {
        performance.clearMarks(At), performance.clearMarks(Pt), performance.clearMeasures(Rt);
      } catch {
      }
    }
    function Wt(e2) {
      e2.getEntries().forEach((e3) => {
        if (e3.name === Pt) try {
          const { duration: t2 } = performance.measure(Rt, At, Pt);
          Lt = e3.detail, Bt.push(t2), Bt.length > 100 && Bt.shift();
        } catch {
        }
      });
    }
    function Ht() {
      ke("Attached%c PerformanceObserver%c to page", h, y);
      const e2 = new PerformanceObserver(Wt);
      return e2.observe({ entryTypes: ["mark"] }), qt = setInterval(() => {
        if (Bt.length < 10) return;
        if (Lt.hasTags && Lt.len < 25) return;
        Bt.sort();
        const e3 = Math.min(Bt.reduce((e4, t3) => e4 + t3, 0) / Bt.length, Bt[Math.floor(Bt.length / 2)]), t2 = fe(e3);
        t2 > Dt && (Dt = t2, Ce("performanceObserver")), Ft(), e3 <= 4 || (clearInterval(qt), qe(`<rb>Performance Warning</>

Calculating the page size is taking an excessive amount of time (${fe(e3)}ms).

To improve performance add the <b>data-iframe-size</> attribute to the ${Lt.Side.toLowerCase()} most element on the page. For more details see: <u>https://iframe-resizer.com/perf</>.`));
      }, 5e3), { disconnect: () => {
        Ft(), clearInterval(qt), e2.disconnect(), ke("Detached%c PerformanceObserver", h);
      } };
    }
    const Vt = "Resize", Ut = at(Vt), Zt = at(Vt, false), Jt = ot(Vt), _t = rt(Vt), Qt = /* @__PURE__ */ new WeakSet(), Gt = /* @__PURE__ */ new Set(), Yt = /* @__PURE__ */ new Set();
    let Xt;
    function Kt(e2) {
      let t2 = 0;
      for (const n2 of e2) {
        if (n2.nodeType !== Node.ELEMENT_NODE) continue;
        const e3 = getComputedStyle(n2)?.position;
        "" !== e3 && "static" !== e3 && (Qt.has(n2) ? Gt.add(n2) : (Xt.observe(n2), Qt.add(n2), Yt.add(n2), t2 += 1));
      }
      _t(Gt), Jt(Yt), Ut(t2), Yt.clear(), Gt.clear();
    }
    function en(e2) {
      const t2 = new IntersectionObserver((t3) => e2(t3.at(-1).isIntersecting), { threshold: 0 }), n2 = document.documentElement;
      return t2.observe(n2), ke("Attached%c VisibilityObserver%c to page", h, y), { disconnect: () => {
        t2.disconnect(), ke("Detached%c VisibilityObserver", h);
      } };
    }
    const tn = (e2) => (t2, n2) => {
      if (n2 in t2) {
        if (typeof t2[n2] === e2) return t2[n2];
        throw new TypeError(`${n2} is not a ${e2}.`);
      }
    }, nn = tn(q), on = tn(R), rn = tn(P);
    "undefined" != typeof window && (function() {
      const o2 = { height: () => (Pe("Custom height calculation function not defined"), Nn.auto()), width: () => (Pe("Custom width calculation function not defined"), An.auto()) }, r2 = { bodyOffset: 1, bodyScroll: 1, offset: 1, documentElementOffset: 1, documentElementScroll: 1, boundingClientRect: 1, max: 1, min: 1, grow: 1, lowestElement: 1 }, i2 = {}, a2 = L, s2 = "scroll";
      let c2, l2, u2, d2, f2, m2, p2, te2 = true, re2 = "", ae2 = 0, fe2 = "", ge2 = "", be2 = false, ve2 = true, ze2 = false, Se2 = true, Oe2 = false, Me2 = false, Re2 = true, Be2 = false, Le2 = 1, He2 = a2, Ve2 = "", Ue2 = true, Ze2 = {}, Je2 = false, _e2 = false, Qe2 = false, Ye2 = 0, ot2 = false, rt2 = 0, it2 = 0, at2 = /* @__PURE__ */ new Set(), ct2 = "", lt2 = "child", ut2 = false, dt2 = "", ft2 = [], mt2 = window.parent, pt2 = "*", ht2 = 0, yt2 = false, gt2 = 1, bt2 = s2, vt2 = window, zt2 = () => {
        Pe("onMessage function not defined");
      }, wt2 = () => {
      }, $t2 = null, St2 = null;
      function Ot2(e2) {
        var t2;
        !(function(e3) {
          ct2 = e3[0] ?? ct2, ae2 = Ke(e3[1]) ?? ae2, ze2 = Xe(e3[2]) ?? ze2, Qe2 = Xe(e3[3]) ?? Qe2, te2 = Xe(e3[6]) ?? te2, fe2 = e3[7] ?? fe2, He2 = e3[8] ?? He2, re2 = e3[9] ?? re2, ge2 = e3[10] ?? ge2, ht2 = Ke(e3[11]) ?? ht2, Ze2.enable = Xe(e3[12]) ?? false, lt2 = e3[13] ?? lt2, bt2 = e3[14] ?? bt2, ot2 = Xe(e3[15]) ?? ot2, rt2 = Ke(e3[16]) ?? rt2, it2 = Ke(e3[17]) ?? it2, ve2 = Xe(e3[18]) ?? ve2, c2 = e3[19] ?? c2, m2 = e3[20] ?? m2, Ye2 = Ke(e3[21]) ?? Ye2, _e2 = Xe(e3[23]) ?? _e2;
        })(e2), $e = (t2 = { id: ct2, enabled: Qe2, expand: _e2 }).id || b, Ee.label(`${$e}`), Ee.expand(t2.expand), we = t2.enabled, Ce("initReceived"), (function() {
          function e3(e4) {
            p2 = nn(e4, "onBeforeResize") ?? p2, zt2 = nn(e4, "onMessage") ?? zt2, wt2 = nn(e4, "onReady") ?? wt2, typeof e4?.offset === R && (We(N, A), ve2 && (rt2 = on(e4, N) ?? rt2), ze2 && (it2 = on(e4, N) ?? it2)), typeof e4?.offsetSize === R && (ve2 && (rt2 = on(e4, A) ?? rt2), ze2 && (it2 = on(e4, A) ?? it2)), l2 = rn(e4, ne(oe[0])) ?? l2, Ve2 = rn(e4, "ignoreSelector") ?? Ve2, dt2 = rn(e4, "sizeSelector") ?? dt2, pt2 = rn(e4, "targetOrigin") ?? pt2, He2 = e4?.heightCalculationMethod || He2, bt2 = e4?.widthCalculationMethod || bt2;
          }
          function t3(e4, t4) {
            return typeof e4 === q && (qe(`<rb>Deprecated Option(${t4}CalculationMethod)</>

The use of <b>${t4}CalculationMethod</> as a function is deprecated and will be removed in a future version of <i>iframe-resizer</>. Please use the new <b>onBeforeResize</> event handler instead.

See <u>https://iframe-resizer.com/api/child</> for more details.`), o2[t4] = e4, e4 = "custom"), e4;
          }
          if (1 === Ye2) return;
          const n2 = window.iframeResizer || window.iFrameResizer;
          typeof n2 === B && (e3(n2), He2 = t3(He2, I), bt2 = t3(bt2, C), ke(`Set targetOrigin for parent: %c${pt2}`, h));
        })(), [Bt2, Lt2, sn, Ct2, qt2, tn2, an, Gt2, Rt2, Tt2, be2 ? de : Ge, Ut2, () => Dt2("background", re2), () => Dt2("padding", ge2), be2 ? de : Jt2, ln, Wt2, On, un, cn, dn, kt2, fn].forEach((e3) => {
          try {
            e3();
          } catch (e4) {
            if (Ye2 < 0) throw e4;
            qe("<rb>Error in setup function</>\n<i>iframe-resizer</> detected an error during setup.\n\nPlease report the following error message at <u>https://github.com/davidjbradshaw/iframe-resizer/issues</>"), Te(e4);
          }
        }), xt2(ue(wt2)), xe(), Fn(z, "Init message from host page", void 0, void 0, `${g}:${Ye2}`), document.title && "" !== document.title && Vn(0, 0, M, document.title);
      }
      function Et2({ persisted: e2 }) {
        e2 || Vn(0, 0, "beforeUnload"), Ce($), ke("Page persisted:", e2), e2 || et.forEach(he);
      }
      const kt2 = () => nt(window, $.toLowerCase(), Et2);
      let jt2 = false;
      function xt2(e2) {
        "complete" === document.readyState ? le(e2) : jt2 || nt(document, D, () => xt2(e2)), jt2 = true;
      }
      function Tt2() {
        ft2 = document.querySelectorAll(`[${j}]`), Be2 = ft2.length > 0;
      }
      let It2 = 0;
      function Ct2() {
        const n2 = document.querySelectorAll(`*[${T}]`);
        return Oe2 = n2.length > 0, Oe2 && n2.length !== It2 && ((function(n3) {
          const o3 = 1 === n3.length ? "" : "s";
          Pe(`%c[${T}]%c found on %c${n3.length}%c element${o3}`, t, e, t, e);
        })(n2), It2 = n2.length), Oe2;
      }
      function Rt2() {
        "BackCompat" === document.compatMode && qe("<rb>Quirks Mode Detected</>\n\nThis iframe is running in the browser's legacy <b>Quirks Mode</>, this may cause issues with the correct operation of <i>iframe-resizer</>. It is recommended that you switch to the modern <b>Standards Mode</>.\n\nFor more information see <u>https://iframe-resizer.com/quirks-mode</>.\n");
      }
      function Bt2() {
        m2 && "" !== m2 && "false" !== m2 ? m2 !== g && qe(`<b>Version mismatch</>

The parent and child pages are running different versions of <i>iframe resizer</>.

Parent page: ${m2} - Child page: ${g}.
`) : qe("<rb>Legacy version detected on parent page</>\n\nDetected legacy version of parent page script. It is recommended to update the parent page to use <b>@iframe-resizer/parent</>.\n\nSee <u>https://iframe-resizer.com/setup/</> for more details.\n");
      }
      function qt2() {
        try {
          ut2 = 1 === Ye2 || "iframeParentListener" in window.parent;
        } catch (e2) {
        }
      }
      function Lt2() {
        ze2 === ve2 && (be2 = true);
      }
      function Dt2(e2, t2) {
        void 0 !== t2 && "" !== t2 && "null" !== t2 && (document.body.style.setProperty(e2, t2), ke(`Set body ${e2}: %c${t2}`, h));
      }
      function Ft2(e2, t2, n2) {
        if ("" !== n2) for (const e3 of document.querySelectorAll(n2)) e3.toggleAttribute(t2, true);
      }
      function Wt2() {
        Ft2(0, j, dt2), Ft2(0, T, Ve2);
      }
      function Ut2() {
        var e2, t2;
        void 0 === fe2 && (fe2 = `${ae2}px`), Dt2("margin", (e2 = "margin", (t2 = fe2).includes("-") && (Pe(`Negative CSS value ignored for ${e2}`), t2 = ""), t2));
      }
      function Jt2() {
        const e2 = (e3) => e3.style.setProperty(I, L, "important");
        e2(document.documentElement), e2(document.body);
      }
      function _t2(e2) {
        ({ add(t2) {
          function n2() {
            Fn(e2.eventName, e2.eventType);
          }
          i2[t2] = n2, nt(window, t2, n2, { passive: true });
        }, remove(e3) {
          const t2 = i2[e3];
          delete i2[e3], tt(window, e3, t2);
        } })[e2.method](e2.eventName);
      }
      function Gt2() {
        let e2 = false;
        const t2 = (t3) => document.querySelectorAll(`[${t3}]`).forEach((n2) => {
          e2 = true, n2.removeAttribute(t3), n2.toggleAttribute(j, true);
        });
        t2("data-iframe-height"), t2("data-iframe-width"), e2 && qe("<rb>Deprecated Attributes</>\n\nThe <b>data-iframe-height</> and <b>data-iframe-width</> attributes have been deprecated and replaced with the single <b>data-iframe-size</> attribute. Use of the old attributes will be removed in a future version of <i>iframe-resizer</>.");
      }
      function Yt2(e2, t2, n2) {
        const { label: o3 } = n2;
        return t2 !== e2 && (e2 in n2 || (Pe(`${e2} is not a valid option for ${o3}CalculationMethod.`), e2 = t2), e2 in r2) && qe(`<rb>Deprecated ${o3}CalculationMethod (${e2})</>

This version of <i>iframe-resizer</> can auto detect the most suitable ${o3} calculation method. It is recommended that you ${m2 ? "remove this option." : `set this option to <b>'auto'</> when using an older version of <i>iframe-resizer</> on the parent page. This can be done on the child page by adding the following code:

window.iframeResizer = {
  license: 'xxxx',
  ${o3}CalculationMethod: '${L}',
}
`}
`), e2;
      }
      function tn2() {
        He2 = Yt2(He2, a2, Nn);
      }
      function an() {
        bt2 = Yt2(bt2, s2, An);
      }
      function sn() {
        const t2 = Ye2, n2 = ce({ key: c2 }), o3 = ce({ key: l2 });
        if (Ye2 = Math.max(n2, o3), Ye2 < 0) {
          if (Ye2 = Math.min(n2, o3), Ae(), qe(`${se(Ye2 + 2)}${se(2)}`), pe(m2)) throw se(Ye2 + 2).replace(/<\/?[a-z][^>]*>|<\/>/gi, "");
        } else (!pe(m2) || t2 > -1 && Ye2 > t2) && (sessionStorage.getItem("ifr") !== g && (function(t3, n3) {
          console.info(`${$e} %ciframe-resizer ${t3}`, we || n3 < 1 ? "font-weight: bold;" : e);
        })(`v${g} (${((e2) => ne(ie[e2]))(Ye2)})`, Ye2), Ye2 < 2 && qe(se(3)), sessionStorage.setItem("ifr", g));
      }
      function cn() {
        !(function(e2) {
          _t2({ method: e2, eventType: "After Print", eventName: "afterprint" }), _t2({ method: e2, eventType: "Before Print", eventName: "beforeprint" });
        })("add");
      }
      function ln() {
        const e2 = document.createElement("div");
        e2.style.clear = "both", e2.style.display = "block", e2.style.height = "0", document.body.append(e2);
      }
      function un() {
        function e2(e3) {
          const t3 = e3.getBoundingClientRect(), n3 = { x: document.documentElement.scrollLeft, y: document.documentElement.scrollTop };
          return { x: parseInt(t3.left, k) + parseInt(n3.x, k), y: parseInt(t3.top, k) + parseInt(n3.y, k) };
        }
        function t2(t3) {
          const n3 = t3.split("#")[1] || t3, o4 = decodeURIComponent(n3), r3 = document.getElementById(o4) || document.getElementsByName(o4)[0];
          void 0 === r3 ? Vn(0, 0, "inPageLink", `#${n3}`) : (function(t4) {
            const n4 = e2(t4);
            Vn(n4.y, n4.x, E);
          })(r3);
        }
        function n2() {
          const { hash: e3, href: n3 } = window.location;
          "" !== e3 && "#" !== e3 && t2(n3);
        }
        const { enable: o3 } = Ze2;
        o3 && (1 === Ye2 ? qe(se(5)) : ((function() {
          for (const e3 of document.querySelectorAll('a[href^="#"]')) "#" !== e3.getAttribute("href") && nt(e3, "click", (n3) => {
            n3.preventDefault(), t2(e3.getAttribute("href"));
          });
        })(), nt(window, "hashchange", n2), setTimeout(n2, 128))), Ze2 = { ...Ze2, findTarget: t2 };
      }
      function dn() {
        function e2(e3) {
          Vn(0, 0, e3.type, `${e3.screenY}:${e3.screenX}`);
        }
        function t2(t3, n2) {
          nt(window.document, t3, e2);
        }
        true === ot2 && (t2("mouseenter"), t2("mouseleave"));
      }
      function fn() {
        1 !== Ye2 && (vt2.parentIframe = Object.freeze({ autoResize: (e2) => (ye(e2, "boolean", "parentIframe.autoResize(enable) enable"), false === ze2 && false === ve2 ? (Ce(H), qe("Auto Resize can not be changed when <b>direction</> is set to 'none'."), false) : (true === e2 && false === te2 ? (te2 = true, queueMicrotask(() => Fn(H, "Auto Resize enabled"))) : false === e2 && true === te2 && (te2 = false), Vn(0, 0, "autoResize", JSON.stringify(te2)), te2)), close() {
          Vn(0, 0, "close");
        }, getId: () => ct2, getOrigin: () => (Ce("getOrigin"), De("getOrigin()", "getParentOrigin()"), u2), getParentOrigin: () => u2, getPageInfo(e2) {
          if (typeof e2 === q) return $t2 = e2, Vn(0, 0, S), void Fe("getPageInfo()", "getParentProps()", "See <u>https://iframe-resizer.com/upgrade</> for details. ");
          $t2 = null, Vn(0, 0, "pageInfoStop");
        }, getParentProps: (e2) => (ye(e2, q, "parentIframe.getParentProps(callback) callback"), St2 = e2, Vn(0, 0, O), () => {
          St2 = null, Vn(0, 0, "parentInfoStop");
        }), getParentProperties(e2) {
          De("getParentProperties()", "getParentProps()"), this.getParentProps(e2);
        }, moveToAnchor(e2) {
          ye(e2, P, "parentIframe.moveToAnchor(anchor) anchor"), Ze2.findTarget(e2);
        }, reset() {
          !(function() {
            const e2 = He2;
            He2 = a2, yt2 || (yt2 = true, requestAnimationFrame(() => {
              yt2 = false;
            })), Wn("reset"), He2 = e2;
          })();
        }, setOffsetSize(e2) {
          ye(e2, R, "parentIframe.setOffsetSize(offset) offset"), rt2 = e2, it2 = e2, Fn(_, `parentIframe.setOffsetSize(${e2})`);
        }, scrollBy(e2, t2) {
          ye(e2, R, "parentIframe.scrollBy(x, y) x"), ye(t2, R, "parentIframe.scrollBy(x, y) y"), Vn(t2, e2, "scrollBy");
        }, scrollTo(e2, t2) {
          ye(e2, R, "parentIframe.scrollTo(x, y) x"), ye(t2, R, "parentIframe.scrollTo(x, y) y"), Vn(t2, e2, "scrollTo");
        }, scrollToOffset(e2, t2) {
          ye(e2, R, "parentIframe.scrollToOffset(x, y) x"), ye(t2, R, "parentIframe.scrollToOffset(x, y) y"), Vn(t2, e2, E);
        }, sendMessage(e2, t2) {
          t2 && ye(t2, P, "parentIframe.sendMessage(msg, targetOrigin) targetOrigin"), Vn(0, 0, w, JSON.stringify(e2), t2);
        }, setHeightCalculationMethod(e2) {
          He2 = e2, tn2();
        }, setWidthCalculationMethod(e2) {
          bt2 = e2, an();
        }, setTargetOrigin(e2) {
          ye(e2, P, "parentIframe.setTargetOrigin(targetOrigin) targetOrigin"), pt2 = e2;
        }, resize(e2, t2) {
          void 0 !== e2 && ye(e2, R, "parentIframe.resize(customHeight, customWidth) customHeight"), void 0 !== t2 && ye(t2, R, "parentIframe.resize(customHeight, customWidth) customWidth"), Fn(U, `parentIframe.resize(${e2 || ""}${t2 ? `,${t2}` : ""})`, e2, t2);
        }, size(e2, t2) {
          De("size()", "resize()"), this.resize(e2, t2);
        } }), vt2.parentIFrame = vt2.parentIframe);
      }
      let mn = /* @__PURE__ */ new Set();
      function pn() {
        const e2 = document.querySelectorAll(`[${x}]`);
        at2 = (function(e3) {
          const t2 = /* @__PURE__ */ new Set(), n2 = /* @__PURE__ */ new Set();
          for (const o3 of e3) o3.closest(`[${T}]`) ? n2.add(o3) : t2.add(o3);
          return n2.size > 0 && queueMicrotask(() => {
            Ce("overflowIgnored"), ke("Ignoring elements with [data-iframe-ignore] > *:\n", n2), xe();
          }), t2;
        })(e2), Me2 = at2.size > 0, typeof Set.prototype.symmetricDifference === q && (Re2 = at2.symmetricDifference(mn).size > 0), mn = at2;
      }
      function hn() {
        switch (pn(), true) {
          case !Re2:
            return;
          case at2.size > 1:
            ke("Overflowed Elements:", at2);
            break;
          case Me2:
            break;
          default:
            ke("No overflow detected");
        }
        Fn(G, "Overflow updated");
      }
      function yn(e2) {
        const t2 = { root: document.documentElement, side: ve2 ? F : W };
        return d2 = Nt(hn, t2), d2.attachObservers(e2), d2;
      }
      function gn(e2) {
        if (!Array.isArray(e2) || 0 === e2.length) return;
        const t2 = e2[0].target;
        Fn(Q, `Element resized <${(function(e3) {
          switch (true) {
            case !pe(e3):
              return "";
            case pe(e3.id):
              return `${e3.nodeName}#${e3.id}`;
            case pe(e3.name):
              return `${e3.nodeName} (${e3.name}`;
            case pe(e3.className):
              return `${e3.nodeName}.${e3.className}`;
            default:
              return e3.nodeName;
          }
        })(t2)}>`);
      }
      function bn(e2) {
        return Xt = new ResizeObserver(gn), Xt.observe(document.body), Qt.add(document.body), ke("Attached%c ResizeObserver%c to body", h, y), f2 = { attachObserverToNonStaticElements: Kt, detachObservers: st(Vt, Xt, Qt, Zt), disconnect: () => {
          Xt.disconnect(), ke("Detached%c ResizeObserver", h);
        } }, f2.attachObserverToNonStaticElements(e2), f2;
      }
      function vn(e2) {
        Je2 = !e2, Fn(X, "Visibility changed");
      }
      const zn = (e2) => {
        const t2 = /* @__PURE__ */ new Set();
        for (const n2 of e2) {
          t2.add(n2);
          for (const e3 of jn(n2)) t2.add(e3);
        }
        return ke("Inspecting:\n", t2), t2;
      }, wn = (e2) => {
        if (0 === e2.size) return;
        Ce("addObservers");
        const t2 = zn(e2);
        d2.attachObservers(t2), f2.attachObserverToNonStaticElements(t2), xe();
      }, $n = (e2) => {
        if (0 === e2.size) return;
        Ce("removeObservers");
        const t2 = zn(e2);
        d2.detachObservers(t2), f2.detachObservers(t2), xe();
      };
      function Sn(e2) {
        !(function({ addedNodes: e3, removedNodes: t2 }) {
          Ce("contentMutated"), Wt2(), Tt2(), pn(), xe(), $n(t2), wn(e3);
        })(e2), Fn(Y, "Mutation Observed");
      }
      function On() {
        const e2 = jn(document.documentElement);
        var t2;
        t2 = [Mt(Sn), yn(e2), Ht(), bn(e2), en(vn)], et.push(...t2.map((e3) => e3.disconnect));
      }
      function En(e2) {
        performance.mark(At);
        const t2 = me(e2);
        let n2 = 1, o3 = document.documentElement, r3 = Be2 ? 0 : document.documentElement.getBoundingClientRect().bottom;
        const i3 = Be2 ? ft2 : Me2 ? Array.from(at2) : jn(document.documentElement);
        for (const t3 of i3) n2 = t3.getBoundingClientRect()[e2] + parseFloat(getComputedStyle(t3).getPropertyValue(`margin-${e2}`)), n2 > r3 && (r3 = n2, o3 = t3);
        return ke(`${t2} position calculated from:`, o3), ke(`Checked %c${i3.length}%c elements`, h, y), performance.mark(Pt, { detail: { hasTags: Be2, len: i3.length, logging: Qe2, Side: t2 } }), r3;
      }
      const Mn = (e2) => [e2.bodyOffset(), e2.bodyScroll(), e2.documentElementOffset(), e2.documentElementScroll(), e2.boundingClientRect()], kn = `* ${Array.from(ee).map((e2) => `:not(${e2})`).join("")}`, jn = (e2) => e2.querySelectorAll(kn), xn = { height: 0, width: 0 }, Tn = { height: 0, width: 0 }, In = [h, y, h];
      function Cn(e2) {
        function t2() {
          return Tn[o3] = r3, xn[o3] = s3, Math.max(r3, 1);
        }
        const n2 = e2 === Nn, o3 = e2.label, r3 = e2.boundingClientRect(), i3 = Math.ceil(r3), a3 = Math.floor(r3), s3 = ((e3) => e3.documentElementScroll() + Math.max(0, e3.getOffset()))(e2), c3 = `HTML: %c${r3}px %cPage: %c${s3}px`;
        let l3 = 1;
        switch (true) {
          case !e2.enabled():
            return Math.max(s3, 1);
          case Be2:
            ke("Found element with data-iframe-size attribute"), l3 = e2.taggedElement();
            break;
          case (!Me2 && Se2 && 0 === Tn[o3] && 0 === xn[o3]):
            ke(`Initial page size values: ${c3}`, ...In), l3 = t2();
            break;
          case (yt2 && r3 === Tn[o3] && s3 === xn[o3]):
            ke(`Size unchanged: ${c3}`, ...In), l3 = Math.max(r3, s3);
            break;
          case (0 === r3 && 0 !== s3):
            ke(`Page is hidden: ${c3}`, ...In), l3 = s3;
            break;
          case (!Me2 && r3 !== Tn[o3] && s3 <= xn[o3]):
            ke(`New <html> size: ${c3} `, ...In), ke(`Previous <html> size: %c${Tn[o3]}px`, h), l3 = t2();
            break;
          case !n2:
            l3 = e2.taggedElement();
            break;
          case (!Me2 && r3 < Tn[o3]):
            ke(`<html> size decreased: ${c3}`, ...In), l3 = t2();
            break;
          case (s3 === a3 || s3 === i3):
            ke(`<html> size equals page size: ${c3}`, ...In), l3 = t2();
            break;
          case r3 > s3:
            ke(`Page size < <html> size: ${c3}`, ...In), l3 = t2();
            break;
          case Me2:
            ke("Found elements possibly overflowing <html> "), l3 = e2.taggedElement();
            break;
          default:
            ke(`Using <html> size: ${c3}`, ...In), l3 = t2();
        }
        return ke(`Content ${o3}: %c${l3}px`, h), l3 += (function(e3) {
          const t3 = e3.getOffset();
          return 0 !== t3 && ke(`Page offsetSize: %c${t3}px`, h), t3;
        })(e2), Math.max(l3, 1);
      }
      const Nn = { label: I, enabled: () => ve2, getOffset: () => rt2, auto: () => Cn(Nn), bodyOffset: () => {
        const { body: e2 } = document, t2 = getComputedStyle(e2);
        return e2.offsetHeight + parseInt(t2.marginTop, k) + parseInt(t2.marginBottom, k);
      }, bodyScroll: () => document.body.scrollHeight, offset: () => Nn.bodyOffset(), custom: () => o2.height(), documentElementOffset: () => document.documentElement.offsetHeight, documentElementScroll: () => document.documentElement.scrollHeight, boundingClientRect: () => Math.max(document.documentElement.getBoundingClientRect().bottom, document.body.getBoundingClientRect().bottom), max: () => Math.max(...Mn(Nn)), min: () => Math.min(...Mn(Nn)), grow: () => Nn.max(), lowestElement: () => En(F), taggedElement: () => En(F) }, An = { label: C, enabled: () => ze2, getOffset: () => it2, auto: () => Cn(An), bodyScroll: () => document.body.scrollWidth, bodyOffset: () => document.body.offsetWidth, custom: () => o2.width(), documentElementScroll: () => document.documentElement.scrollWidth, documentElementOffset: () => document.documentElement.offsetWidth, boundingClientRect: () => Math.max(document.documentElement.getBoundingClientRect().right, document.body.getBoundingClientRect().right), max: () => Math.max(...Mn(An)), min: () => Math.min(...Mn(An)), rightMostElement: () => En(W), scroll: () => Math.max(An.bodyScroll(), An.documentElementScroll()), taggedElement: () => En(W) }, Pn = (e2, t2) => !(Math.abs(e2 - t2) <= ht2);
      function Rn(e2, t2) {
        const n2 = e2[t2](), o3 = e2.enabled() && void 0 !== p2 ? (function(e3) {
          const t3 = p2(e3);
          if (void 0 === t3) throw new TypeError("No value returned from onBeforeResize(), expected a numeric value");
          if (Number.isNaN(t3)) throw new TypeError(`Invalid value returned from onBeforeResize(): ${t3}, expected Number`);
          if (t3 < 1) throw new RangeError(`Out of range value returned from onBeforeResize(): ${t3}, must be at least 1`);
          return t3;
        })(n2) : n2;
        return je(o3 >= 1, `New iframe ${e2.label} is too small: ${o3}, must be at least 1`), o3;
      }
      let Bn = false;
      const qn = ue(() => qe(se(4)));
      let Ln, Dn = false;
      const Fn = Ie((e2, t2, n2, o3, r3) => {
        switch (Ce(e2), true) {
          case true === Je2:
            if (true === Dn) break;
            Dn = true, Bn = false, cancelAnimationFrame(Ln), Ln = null;
            break;
          case (true === Bn && e2 !== G):
            Ae();
            break;
          case (!te2 && !(e2 in J)):
            ke("Resizing disabled");
            break;
          default:
            Dn = false, Bn = true, performance.now(), Ln || (Ln = requestAnimationFrame(() => {
              Bn = false, Ln = null, Ce("requestAnimationFrame");
            })), (function(e3, t3, n3, o4, r4) {
              const i3 = n3 ?? Rn(Nn, He2), a3 = o4 ?? Rn(An, bt2);
              switch (ve2 && Pn(Le2, i3) || ze2 && Pn(gt2, a3) ? V : e3) {
                case z:
                case H:
                case V:
                  Le2 = i3, gt2 = a3;
                case _:
                  Hn(Le2, gt2, e3, r4);
                  break;
                case G:
                case Y:
                case Q:
                case X:
                  Ae();
                  break;
                default:
                  Ae(), ke("No change in content size detected");
              }
            })(e2, 0, n2, o3, r3);
        }
        xe();
      });
      function Wn(e2) {
        Le2 = Nn[He2](), gt2 = An[bt2](), Vn(Le2, gt2, e2);
      }
      function Hn(e2, t2, o3, r3, i3) {
        Ye2 < -1 || (void 0 !== i3 || (i3 = pt2), (function() {
          const a3 = `${ct2}:${e2}:${t2}:${o3}${void 0 === r3 ? "" : `:${r3}`}`;
          if (ut2) try {
            window.parent.iframeParentListener(K + a3);
          } catch (e3) {
            if (1 !== Ye2) throw e3;
            return void qn();
          }
          else mt2.postMessage(K + a3, i3);
          ke(`Sending message to parent page via ${ut2 ? "sameOrigin" : "postMessage"}: %c%c${a3}`, n, h);
        })());
      }
      const Vn = Ie((e2, t2, n2, o3, r3) => {
        Ce(n2), Hn(e2, t2, n2, o3, r3), xe();
      }), Un = Ie(function(e2) {
        Ce("onMessage");
        const { freeze: t2 } = Object, { parse: n2 } = JSON, o3 = (e3) => Vn(0, 0, `${e3}Stop`), r3 = { init: function() {
          if ("loading" === document.readyState) return;
          const t3 = e2.data.slice(13).split(v);
          mt2 = e2.source, u2 = e2.origin, Ot2(t3), Se2 = false, setTimeout(() => {
            Ue2 = false;
          }, 128);
        }, reset() {
          Ue2 || Wn("resetPage");
        }, resize() {
          Fn(Z, "Parent window requested size check");
        }, moveToAnchor() {
          Ze2.findTarget(a3());
        }, inPageLink() {
          this.moveToAnchor();
        }, pageInfo() {
          const e3 = a3();
          $t2 ? le($t2, n2(e3)) : o3(S);
        }, parentInfo() {
          const e3 = (r4 = a3(), t2(n2(r4)));
          var r4;
          St2 ? le(St2, e3) : o3(O);
        }, message() {
          const e3 = a3();
          le(zt2, n2(e3));
        } }, i3 = () => e2.data.split("]")[1].split(v)[0], a3 = () => e2.data.slice(e2.data.indexOf(v) + 1), s3 = () => e2.data.split(v)[2] in { true: 1, false: 1 };
        function c3() {
          const t3 = i3();
          Ce(t3), t3 in r3 ? r3[t3]() : "iframeResize" in window || void 0 !== window.jQuery && "" in window.jQuery.prototype || s3() || Pe(`Unexpected message (${e2.data})`);
        }
        K === `${e2.data}`.slice(0, 13) && (function() {
          if (false !== Se2) return s3() ? (Ne(i3()), Ce(z), void r3.init()) : void 0;
          c3();
        })();
      });
      let Zn = false;
      const Jn = (e2) => e2.postMessage("[iFrameResizerChild]Ready", window?.iframeResizer?.targetOrigin || "*");
      function _n() {
        if ("loading" === document.readyState || !Se2 || Zn) return;
        const { parent: e2, top: t2 } = window;
        Ce("ready"), Jn(e2), e2 !== t2 && Jn(t2), Zn = true;
      }
      "iframeChildListener" in window ? Pe("Already setup") : (window.iframeChildListener = (e2) => setTimeout(() => Un({ data: e2, sameOrigin: true })), Ce("listen"), nt(window, w, Un), nt(document, D, _n), _n());
    })();
  });
})();
/*! Bundled license information:

@iframe-resizer/child/index.umd.js:
  (*!
   *  @preserve
   *  
   *  @module      iframe-resizer/child 5.5.9 (umd) - 2026-02-06
   *
   *  @license     GPL-3.0 for non-commercial use only.
   *               For commercial use, you must purchase a license from
   *               https://iframe-resizer.com/pricing
   * 
   *  @description Keep same and cross domain iFrames sized to their content 
   *
   *  @author      David J. Bradshaw <info@iframe-resizer.com>
   * 
   *  @see         {@link https://iframe-resizer.com}
   * 
   *  @copyright  (c) 2013 - 2026, David J. Bradshaw. All rights reserved.
   *)
*/
