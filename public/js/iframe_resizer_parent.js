(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/.pnpm/@iframe-resizer+parent@5.5.9/node_modules/@iframe-resizer/parent/index.umd.js
  var require_index_umd = __commonJS({
    "node_modules/.pnpm/@iframe-resizer+parent@5.5.9/node_modules/@iframe-resizer/parent/index.umd.js"(exports, module) {
      !(function(e, t) {
        "object" == typeof exports && "undefined" != typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define(t) : (e = "undefined" != typeof globalThis ? globalThis : e || self).iframeResize = t();
      })(exports, function() {
        "use strict";
        const e = "5.5.9", t = "iframeResizer", n = ":", o = "autoResize", i = "init", r = "iframeReady", a = "load", s = "message", l = "onload", c = "pageInfo", u = "parentInfo", d = "reset", f = "resize", p = "scroll", h = "\n", m = "child", g = "parent", y = "string", b = "object", w = "function", v = "undefined", z = "auto", $ = "none", j = "both", k = "vertical", T = "horizontal", x = "[iFrameSizer]", M = Object.freeze({ max: 1, scroll: 1, bodyScroll: 1, documentElementScroll: 1 }), E = Object.freeze({ [l]: 1, [i]: 1, [r]: 1 }), O = "expanded", R = "collapsed", S = Object.freeze({ [O]: 1, [R]: 1 }), I = "Use of the old name will be removed in a future version of <i>iframe-resizer</>.", C = "font-weight: normal;", W = C + "font-style: italic;", A = "default", L = Object.freeze({ assert: true, error: true, warn: true }), N = { expand: false, defaultEvent: void 0, event: void 0, label: "AutoConsoleGroup", showTime: true }, F = { profile: 0, profileEnd: 0, timeStamp: 0, trace: 0 }, B = Object.assign(console);
        const { fromEntries: P, keys: H } = Object, D = (e2) => [e2, B[e2]], q = (e2) => (t2) => [t2, function(n2) {
          e2[t2] = n2;
        }], U = (e2, t2) => P(H(e2).map(t2));
        const J = !(typeof window > "u" || "function" != typeof window.matchMedia) && window.matchMedia("(prefers-color-scheme: dark)").matches, Z = J ? "color: #A9C7FB;" : "color: #135CD2;", V = J ? "color: #E3E3E3;" : "color: #1F1F1F;", G = Object.hasOwn || ((e2, t2) => Object.prototype.hasOwnProperty.call(e2, t2)), X = { br: "\n", rb: "\x1B[31;1m", bb: "\x1B[34;1m", b: "\x1B[1m", i: "\x1B[3m", u: "\x1B[4m", "/": "\x1B[m" }, Y = Object.keys(X), _ = new RegExp(`<(${Y.join("|")})>`, "gi"), K = (e2, t2) => X[t2] ?? "", Q = (e2) => (t2) => e2(typeof t2 === y ? window.chrome ? t2.replace(_, K) : ((e3) => e3.replaceAll("<br>", h).replaceAll(/<\/?[^>]+>/gi, ""))(t2) : t2), ee = {}, te = (ne = function(e2 = {}) {
          const t2 = {}, n2 = {}, o2 = [], i2 = { ...N, expand: !e2.collapsed || N.expanded, ...e2 };
          let r2 = "";
          function a2() {
            o2.length = 0, r2 = "";
          }
          function s2() {
            delete i2.event, a2();
          }
          const l2 = () => !!o2.some(([e3]) => e3 in L) || !!i2.expand;
          function c2() {
            if (0 !== o2.length) {
              B[l2() ? "group" : "groupCollapsed"](`%c${i2.label}%c ${((e3) => {
                const t3 = e3.event || e3.defaultEvent;
                return t3 ? `${t3}` : "";
              })(i2)} %c${i2.showTime ? r2 : ""}`, C, "font-weight: bold;", W);
              for (const [e3, ...t3] of o2) B.assert(e3 in B, `Unknown console method: ${e3}`), e3 in B && B[e3](...t3);
              B.groupEnd(), s2();
            } else s2();
          }
          function u2() {
            "" === r2 && (r2 = (function() {
              const e3 = /* @__PURE__ */ new Date(), t3 = (t4, n3) => e3[t4]().toString().padStart(n3, "0");
              return `@ ${t3("getHours", 2)}:${t3("getMinutes", 2)}:${t3("getSeconds", 2)}.${t3("getMilliseconds", 3)}`;
            })(), queueMicrotask(() => queueMicrotask(c2)));
          }
          function d2(e3, ...t3) {
            0 === o2.length && u2(), o2.push([e3, ...t3]);
          }
          function f2(e3 = A, ...n3) {
            t2[e3] ? d2("log", `${e3}: ${performance.now() - t2[e3]} ms`, ...n3) : d2("timeLog", e3, ...n3);
          }
          return { ...U(i2, q(i2)), ...U(console, (e3) => [e3, (...t3) => d2(e3, ...t3)]), ...U(F, D), assert: function(e3, ...t3) {
            true !== e3 && d2("assert", e3, ...t3);
          }, count: function(e3 = A) {
            n2[e3] ? n2[e3] += 1 : n2[e3] = 1, d2("log", `${e3}: ${n2[e3]}`);
          }, countReset: function(e3 = A) {
            delete n2[e3];
          }, endAutoGroup: c2, errorBoundary: (e3) => (...t3) => {
            let n3;
            try {
              n3 = e3(...t3);
            } catch (e4) {
              if (!Error.prototype.isPrototypeOf(e4)) throw e4;
              d2("error", e4), c2();
            }
            return n3;
          }, event: function(e3) {
            u2(), i2.event = e3;
          }, purge: a2, time: function(e3 = A) {
            u2(), t2[e3] = performance.now();
          }, timeEnd: function(e3 = A) {
            f2(e3), delete t2[e3];
          }, timeLog: f2, touch: u2 };
        }, ne?.__esModule ? ne.default : ne);
        var ne;
        let oe = true;
        const ie = te({ expand: false, label: g }), re = (e2) => window.top === window.self ? `parent(${e2})` : `nested parent(${e2})`;
        const ae = (e2) => (t2, ...n2) => ee[t2] ? ee[t2].console[e2](...n2) : ie[e2](...n2);
        var se;
        const le = (se = "log", (e2, ...t2) => true === ((e3) => ee[e3] ? ee[e3].log : oe)(e2) ? ae(se)(e2, ...t2) : null), ce = ae("warn"), ue = ae("error"), de = ae("event"), fe = ae("purge"), pe = ae("endAutoGroup"), he = ae("errorBoundary");
        const me = Q((e2) => e2), ge = (e2, ...n2) => ee[e2] ? ee[e2].console.warn(...n2.map(me)) : queueMicrotask(() => {
          const o2 = Q(/* @__PURE__ */ ((e3) => (...n3) => [`${t}(${e3})`, ...n3].join(" "))(e2));
          console?.warn(...n2.map(o2));
        }), ye = /* @__PURE__ */ ((e2) => (t2, n2 = "renamed to") => (o2, i2, r2 = "", a2 = "") => e2(a2, `<rb>Deprecated ${t2}(${o2.replace("()", "")})</>

The <b>${o2}</> ${t2.toLowerCase()} has been ${n2} <b>${i2}</>. ${r2}Use of the old ${t2.toLowerCase()} will be removed in a future version of <i>iframe-resizer</>.`))(ge), be = ye("Function"), we = ye("Option"), ve = (e2, t2, n2, o2) => e2.addEventListener(t2, n2, o2 || false), ze = (e2, t2, n2) => e2.removeEventListener(t2, n2, false), $e = (e2) => {
          if (!e2) return "";
          let t2 = -559038744, n2 = 1103547984;
          for (let o2, i2 = 0; i2 < e2.length; i2++) o2 = e2.codePointAt(i2), t2 = Math.imul(t2 ^ o2, 2246822519), n2 = Math.imul(n2 ^ o2, 3266489917);
          return t2 ^= Math.imul(t2 ^ n2 >>> 15, 1935289751), n2 ^= Math.imul(n2 ^ t2 >>> 15, 3405138345), t2 ^= n2 >>> 16, n2 ^= t2 >>> 16, (2097152 * (n2 >>> 0) + (t2 >>> 11)).toString(36);
        }, je = (e2) => e2.replace(/[A-Za-z]/g, (e3) => String.fromCodePoint((e3 <= "Z" ? 90 : 122) >= (e3 = e3.codePointAt(0) + 19) ? e3 : e3 - 26)), ke = ["spjluzl", "rlf", "clyzpvu"], Te = ["<yi>Puchspk Spjluzl Rlf</><iy><iy>", "<yi>Tpzzpun Spjluzl Rlf</><iy><iy>", "Aopz spiyhyf pz hchpshisl dpao ivao Jvttlyjphs huk Vwlu-Zvbyjl spjluzlz.<iy><iy><i>Jvttlyjphs Spjluzl</><iy>Mvy jvttlyjphs bzl, <p>pmyhtl-ylzpgly</> ylxbpylz h svd jvza vul aptl spjluzl mll. Mvy tvyl pumvythapvu cpzpa <b>oaawz://pmyhtl-ylzpgly.jvt/wypjpun</>.<iy><iy><i>Vwlu Zvbyjl Spjluzl</><iy>Pm fvb hyl bzpun aopz spiyhyf pu h uvu-jvttlyjphs vwlu zvbyjl wyvqlja aolu fvb jhu bzl pa mvy myll bukly aol alytz vm aol NWS C3 Spjluzl. Av jvumpyt fvb hjjlwa aolzl alytz, wslhzl zla aol <i>spjluzl</> rlf pu <p>pmyhtl-ylzpgly</> vwapvuz av <i>NWSc3</>.<iy><iy>Mvy tvyl pumvythapvu wslhzl zll: <b>oaawz://pmyhtl-ylzpgly.jvt/nws</>", "<i>NWSc3 Spjluzl Clyzpvu</><iy><iy>Aopz clyzpvu vm <p>pmyhtl-ylzpgly</> pz ilpun bzlk bukly aol alytz vm aol <i>NWS C3</> spjluzl. Aopz spjluzl hssvdz fvb av bzl <p>pmyhtl-ylzpgly</> pu Vwlu Zvbyjl wyvqljaz, iba pa ylxbpylz fvby wyvqlja av il wbispj, wyvcpkl haaypibapvu huk il spjluzlk bukly clyzpvu 3 vy shaly vm aol NUB Nlulyhs Wbispj Spjluzl.<iy><iy>Pm fvb hyl bzpun aopz spiyhyf pu h uvu-vwlu zvbyjl wyvqlja vy dlizpal, fvb dpss ullk av wbyjohzl h svd jvza vul aptl jvttlyjphs spjluzl.<iy><iy>Mvy tvyl pumvythapvu cpzpa <b>oaawz://pmyhtl-ylzpgly.jvt/wypjpun</>.", "<iy><yi>Zvsv spjluzl kvlz uva zbwwvya jyvzz-kvthpu</><iy><iy>Av bzl <p>pmyhtl-ylzpgly</> dpao jyvzz kvthpu pmyhtlz fvb ullk lpaoly aol Wyvmlzzpvuhs vy Ibzpulzz spjluzlz. Mvy klahpsz vu bwnyhkl wypjpun wslhzl jvuahja pumv@pmyhtl-ylzpgly.jvt.", "Pu whnl spurpun ylxbpylz h Wyvmlzzpvuhs vy Ibzpulzz spjluzl. Wslhzl zll <b>oaawz://pmyhtl-ylzpgly.jvt/wypjpun</> mvy tvyl klahpsz."], xe = ["NWSc3", "zvsv", "wyv", "ibzpulzz", "vlt"], Me = Object.fromEntries(["2cgs7fdf4xb", "1c9ctcccr4z", "1q2pc4eebgb", "ueokt0969w", "w2zxchhgqz", "1umuxblj2e5", "2b5sdlfhbev", "zo4ui3arjo", "oclbb4thgl"].map((e2, t2) => [e2, Math.max(0, t2 - 1)])), Ee = (e2) => je(Te[e2]), Oe = (e2) => {
          const t2 = e2[je(ke[0])] || e2[je(ke[1])] || e2[je(ke[2])];
          if (!t2) return -1;
          const n2 = t2.split("-");
          let o2 = (function(e3 = "") {
            let t3 = -2;
            const n3 = $e(je(e3));
            return n3 in Me && (t3 = Me[n3]), t3 > 4 ? t3 - 4 : t3;
          })(n2[0]);
          return 0 === o2 || ((e3) => e3[2] === $e(e3[0] + e3[1]))(n2) || (o2 = -2), o2;
        };
        function Re(e2) {
          const { checkOrigin: t2, iframe: { id: n2, src: o2, sandbox: i2 }, initialisedFirstPage: r2, waitForLoad: a2, warningTimeout: s2 } = e2, l2 = ((e3) => {
            try {
              return new URL(e3).origin;
            } catch (e4) {
              return null;
            }
          })(o2);
          de(n2, "noResponse"), ge(n2, `<rb>No response from iframe</>

The iframe (<i>${n2}</>) has not responded within ${s2 / 1e3} seconds. Check <b>@iframe-resizer/child</> package has been loaded in the iframe.
${t2 && l2 ? `
The <b>checkOrigin</> option is currently enabled. If the iframe redirects away from <i>${l2}</>, then the connection to the iframe may be blocked by the browser. To disable this option, set <b>checkOrigin</> to <bb>false</> or an array of allowed origins. See <u>https://iframe-resizer.com/checkorigin</> for more information.
` : ""}${a2 && !r2 ? "\nThe <b>waitForLoad</> option is currently set to <bb>true</>. If the iframe loads before <i>iframe-resizer</> runs, this option will prevent <i>iframe-resizer</> initialising. To disable this option, set <b>waitForLoad</> to <bb>false</>.\n" : ""}${((e3) => typeof e3 === b && e3.length > 0 && !(e3.contains("allow-scripts") && e3.contains("allow-same-origin")))(i2) ? "\nThe iframe has the <b>sandbox</> attribute, please ensure it contains both the <bb>allow-same-origin</> and <bb>allow-scripts</> values.\n" : ""}
This message can be ignored if everything is working, or you can set the <b>warningTimeout</> option to a higher value or zero to suppress this warning.
`);
        }
        const Se = {};
        const Ie = Object.freeze({ autoResize: true, bodyBackground: null, bodyMargin: null, bodyPadding: null, checkOrigin: true, direction: k, firstRun: true, inPageLinks: false, heightCalculationMethod: z, id: "iFrameResizer", log: false, logExpand: false, license: void 0, mouseEvents: true, offsetHeight: null, offsetWidth: null, postMessageTarget: null, sameDomain: false, scrolling: false, sizeHeight: true, sizeWidth: false, tolerance: 0, waitForLoad: false, warningTimeout: 5e3, widthCalculationMethod: z, onBeforeClose: () => true, onAfterClose() {
        }, onInit: false, onMessage: null, onMouseEnter() {
        }, onMouseLeave() {
        }, onReady: (e2) => {
          typeof ee[e2.id].onInit === w && (we("init()", "onReady()", "", e2.id), ee[e2.id].onInit(e2));
        }, onResized() {
        }, onScroll: () => true }), Ce = { position: null, version: e };
        function We(t2) {
          function r2() {
            De(N2), Pe(P2), I2("onResized", N2);
          }
          function l2(e2) {
            if ("border-box" !== e2.boxSizing) return 0;
            return (e2.paddingTop ? parseInt(e2.paddingTop, 10) : 0) + (e2.paddingBottom ? parseInt(e2.paddingBottom, 10) : 0);
          }
          function h2(e2) {
            if ("border-box" !== e2.boxSizing) return 0;
            return (e2.borderTopWidth ? parseInt(e2.borderTopWidth, 10) : 0) + (e2.borderBottomWidth ? parseInt(e2.borderBottomWidth, 10) : 0);
          }
          const m2 = (e2) => A2.slice(A2.indexOf(n) + 7 + e2);
          const b2 = (e2, t3) => (n2, o2) => {
            const i2 = {};
            var r3, a2;
            r3 = function() {
              Ue(`${n2} (${e2})`, `${e2}:${t3()}`, o2);
            }, i2[a2 = o2] || (r3(), i2[a2] = requestAnimationFrame(() => {
              i2[a2] = null;
            }));
          }, w2 = (e2, t3) => () => {
            let n2 = false;
            const o2 = (t4) => () => {
              ee[c2] ? n2 && n2 !== t4 || (e2(t4, c2), n2 = t4, requestAnimationFrame(() => {
                n2 = false;
              })) : l3();
            }, i2 = o2(p), r3 = o2("resize window");
            function s2(e3, t4) {
              t4(window, p, i2), t4(window, f, r3);
            }
            function l3() {
              de(c2, `stop${t3}`), s2(0, ze), u2.disconnect(), d2.disconnect(), ze(ee[c2].iframe, a, l3);
            }
            const c2 = P2, u2 = new ResizeObserver(o2("pageObserver")), d2 = new ResizeObserver(o2("iframeObserver"));
            ee[c2] && (ee[c2][`stop${t3}`] = l3, ve(ee[c2].iframe, a, l3), s2(0, ve), u2.observe(document.body, { attributes: true, childList: true, subtree: true }), d2.observe(ee[c2].iframe, { attributes: true, childList: false, subtree: false }));
          }, v2 = (e2) => () => {
            e2 in ee[P2] && (ee[P2][e2](), delete ee[P2][e2]);
          }, z2 = b2(c, function() {
            const e2 = document.body.getBoundingClientRect(), t3 = N2.iframe.getBoundingClientRect(), { scrollY: n2, scrollX: o2, innerHeight: i2, innerWidth: r3 } = window, { clientHeight: a2, clientWidth: s2 } = document.documentElement;
            return JSON.stringify({ iframeHeight: t3.height, iframeWidth: t3.width, clientHeight: Math.max(a2, i2 || 0), clientWidth: Math.max(s2, r3 || 0), offsetTop: parseInt(t3.top - e2.top, 10), offsetLeft: parseInt(t3.left - e2.left, 10), scrollTop: n2, scrollLeft: o2, documentHeight: a2, documentWidth: s2, windowHeight: i2, windowWidth: r3 });
          }), $2 = b2(u, function() {
            const { iframe: e2 } = N2, { scrollWidth: t3, scrollHeight: n2 } = document.documentElement, { width: o2, height: i2, offsetLeft: r3, offsetTop: a2, pageLeft: s2, pageTop: l3, scale: c2 } = window.visualViewport;
            return JSON.stringify({ iframe: e2.getBoundingClientRect(), document: { scrollWidth: t3, scrollHeight: n2 }, viewport: { width: o2, height: i2, offsetLeft: r3, offsetTop: a2, pageLeft: s2, pageTop: l3, scale: c2 } });
          }), j2 = w2(z2, "PageInfo"), k2 = w2($2, "ParentInfo"), T2 = v2("stopPageInfo"), M2 = v2("stopParentInfo");
          function E2(e2) {
            const t3 = e2.getBoundingClientRect();
            return Fe(), { x: Number(t3.left) + Number(Ce.position.x), y: Number(t3.top) + Number(Ce.position.y) };
          }
          function O2(e2) {
            const t3 = e2 ? E2(N2.iframe) : { x: 0, y: 0 };
            le(P2, `Reposition requested (offset x:%c${t3.x}%c y:%c${t3.y})`, Z, V, Z);
            const n2 = ((e3, t4) => ({ x: e3.width + t4.x, y: e3.height + t4.y }))(N2, t3), o2 = window.parentIframe || window.parentIFrame;
            o2 ? (function(t4, n3) {
              setTimeout(() => t4["scrollTo" + (e2 ? "Offset" : "")](n3.x, n3.y));
            })(o2, n2) : (function(e3) {
              Ce.position = e3, R2(P2);
            })(n2);
          }
          function R2(e2) {
            const { x: t3, y: n2 } = Ce.position, o2 = ee[e2]?.iframe;
            false !== I2("onScroll", { iframe: o2, top: n2, left: t3, x: t3, y: n2 }) ? Pe(e2) : Be();
          }
          function S2(e2) {
            let t3 = {};
            if (0 === N2.width && 0 === N2.height) {
              const e3 = m2(9).split(n);
              t3 = { x: e3[1], y: e3[0] };
            } else t3 = { x: N2.width, y: N2.height };
            I2(e2, { iframe: N2.iframe, screenX: Number(t3.x), screenY: Number(t3.y), type: N2.type });
          }
          const I2 = (e2, t3) => Ae(P2, e2, t3);
          function C2() {
            const { height: t3, iframe: n2, msg: a2, type: l3, width: f2 } = N2;
            switch (ee[P2]?.firstRun && (function() {
              if (!ee[P2]) return;
              Ge(P2, N2.mode), ee[P2].firstRun = false;
            })(), l3) {
              case "close":
                Ne(n2);
                break;
              case s:
                h3 = m2(6), I2("onMessage", { iframe: N2.iframe, message: JSON.parse(h3) });
                break;
              case "mouseenter":
                S2("onMouseEnter");
                break;
              case "mouseleave":
                S2("onMouseLeave");
                break;
              case "beforeUnload":
                le(P2, "Ready state reset"), ee[P2].initialised = false;
                break;
              case o:
                ee[P2].autoResize = JSON.parse(m2(9));
                break;
              case "scrollBy":
                !(function() {
                  const e2 = N2.width, t4 = N2.height, n3 = window.parentIframe || window.parentIFrame || window;
                  le(P2, `scrollBy: x: %c${e2}%c y: %c${t4}`, Z, V, Z), n3.scrollBy(e2, t4);
                })();
                break;
              case "scrollTo":
                O2(false);
                break;
              case "scrollToOffset":
                O2(true);
                break;
              case c:
                j2();
                break;
              case u:
                k2();
                break;
              case "pageInfoStop":
                T2();
                break;
              case "parentInfoStop":
                M2();
                break;
              case "inPageLink":
                !(function(e2) {
                  const t4 = e2.split("#")[1] || "", n3 = decodeURIComponent(t4);
                  let o2 = document.getElementById(n3) || document.getElementsByName(n3)[0];
                  o2 ? (function() {
                    const e3 = E2(o2);
                    le(P2, `Moving to in page link: %c#${t4}`, Z), Ce.position = { x: e3.x, y: e3.y }, R2(P2), window.location.hash = t4;
                  })() : window.top !== window.self && (function() {
                    const e3 = window.parentIframe || window.parentIFrame;
                    e3 && e3.moveToAnchor(t4);
                  })();
                })(m2(9));
                break;
              case "title":
                !(function(e2, t4) {
                  ee[t4]?.syncTitle && (ee[t4].iframe.title = e2, le(t4, `Set iframe title attribute: %c${e2}`, Z));
                })(a2, P2);
                break;
              case d:
                He(N2);
                break;
              case i:
                r2(), (function(e2) {
                  try {
                    ee[e2].sameOrigin = !!ee[e2]?.iframe?.contentWindow?.iframeChildListener;
                  } catch (t4) {
                    ee[e2].sameOrigin = false;
                  }
                })(P2), (p2 = a2) !== e && (void 0 !== p2 || ge(P2, "<rb>Legacy version detected in iframe</>\n\nDetected legacy version of child page script. It is recommended to update the page in the iframe to use <b>@iframe-resizer/child</>.\n\nSee <u>https://iframe-resizer.com/setup/#child-page-setup</> for more details.\n")), ee[P2].initialised = true, I2("onReady", n2);
                break;
              default:
                if (0 === f2 && 0 === t3) return void ce(P2, `Unsupported message received (${l3}), this is likely due to the iframe containing a later version of iframe-resizer than the parent page`);
                if (0 === f2 || 0 === t3) return;
                if (document.hidden) return;
                r2();
            }
            var p2, h3;
          }
          function W2(e2) {
            if (!ee[e2]) throw new Error(`${N2.type} No settings for ${e2}. Message was: ${A2}`);
          }
          let A2 = t2.data;
          if ("[iFrameResizerChild]Ready" === A2) return L2 = t2.source, void Object.values(ee).forEach(/* @__PURE__ */ ((e2) => ({ initChild: t3, postMessageTarget: n2 }) => {
            e2 === n2 && t3();
          })(L2));
          var L2;
          if (!((e2) => x === `${e2}`.slice(0, 13) && e2.slice(13).split(n)[0] in ee)(A2)) {
            if (typeof A2 !== y) return;
            return void de(g, "ignoredMessage");
          }
          const N2 = (function(e2) {
            const t3 = e2.slice(13).split(n), o2 = t3[1] ? Number(t3[1]) : 0, i2 = ee[t3[0]]?.iframe, r3 = getComputedStyle(i2), a2 = { iframe: i2, id: t3[0], height: o2 + l2(r3) + h2(r3), width: Number(t3[2]), type: t3[3], msg: t3[4] };
            return t3[5] && (a2.mode = t3[5]), a2;
          })(A2), { id: F2, type: B2 } = N2, P2 = F2;
          P2 ? (de(P2, B2), he(P2, function(e2) {
            W2(P2), N2.type in { true: 1, false: 1, undefined: 1 } || (null !== N2.iframe || (ce(P2, `The iframe (${N2.id}) was not found.`), 0)) && (function() {
              const { origin: e3, sameOrigin: n2 } = t2;
              if (n2) return true;
              let o2 = ee[P2]?.checkOrigin;
              if (o2 && "null" != `${e3}` && !(o2.constructor === Array ? (function() {
                let t3 = 0, n3 = false;
                for (; t3 < o2.length; t3++) if (o2[t3] === e3) {
                  n3 = true;
                  break;
                }
                return n3;
              })() : (function() {
                const t3 = ee[P2]?.remoteHost;
                return e3 === t3;
              })())) throw new Error(`Unexpected message received from: ${e3} for ${N2.iframe.id}. Message was: ${t2.data}. This error can be disabled by setting the checkOrigin: false option or by providing of array of trusted domains.`);
              return true;
            })() && C2();
          })(A2)) : ce("", "iframeResizer received messageData without id, message was: ", A2);
        }
        function Ae(e2, t2, n2) {
          let o2 = null, i2 = null;
          if (ee[e2]) {
            if (o2 = ee[e2][t2], typeof o2 !== w) throw new TypeError(`${t2} on iFrame[${e2}] is not a function`);
            if ("onBeforeClose" === t2 || "onScroll" === t2) try {
              i2 = o2(n2);
            } catch (n3) {
              console.error(n3), ce(e2, `Error in ${t2} callback`);
            }
            else ((e3, ...t3) => {
              setTimeout(() => e3(...t3), 0);
            })(o2, n2);
          }
          return i2;
        }
        function Le(e2) {
          const { id: t2 } = e2;
          delete ee[t2], delete e2.iframeResizer;
        }
        function Ne(e2) {
          const { id: t2 } = e2;
          if (false !== Ae(t2, "onBeforeClose", t2)) {
            try {
              e2.parentNode && e2.remove();
            } catch (e3) {
              ce(t2, e3);
            }
            Ae(t2, "onAfterClose", t2), Le(e2);
          }
        }
        function Fe(e2) {
          null === Ce.position && (Ce.position = { x: window.scrollX, y: window.scrollY });
        }
        function Be() {
          Ce.position = null;
        }
        function Pe(e2) {
          null !== Ce.position && (window.scrollTo(Ce.position.x, Ce.position.y), le(e2, `Set page position: %c${Ce.position.x}%c, %c${Ce.position.y}`, Z, V, Z), Be());
        }
        function He(e2) {
          Fe(e2.id), De(e2), Ue(d, d, e2.id);
        }
        function De(e2) {
          function t2(t3) {
            const o3 = `${e2[t3]}px`;
            e2.iframe.style[t3] = o3, le(n2, `Set ${t3}: %c${o3}`, Z);
          }
          const { id: n2 } = e2, { sizeHeight: o2, sizeWidth: i2 } = ee[n2];
          o2 && t2("height"), i2 && t2("width");
        }
        const qe = (e2) => e2.split(n).filter((e3, t2) => 19 !== t2).join(n);
        function Ue(e2, t2, n2) {
          function o2(o3) {
            const i2 = e2 in E ? qe(t2) : t2;
            le(n2, o3, Z, V, Z), le(n2, `Message data: %c${i2}`, Z);
          }
          de(n2, e2), ee[n2] && (ee[n2]?.postMessageTarget ? (function() {
            const { iframe: i2, postMessageTarget: r2, sameOrigin: a2, targetOrigin: s2 } = ee[n2];
            if (a2) try {
              return i2.contentWindow.iframeChildListener(x + t2), void o2(`Sending message to iframe %c${n2}%c via same origin%c`);
            } catch (t3) {
              e2 in E ? ee[n2].sameOrigin = false : ce(n2, "Same origin messaging failed, falling back to postMessage");
            }
            o2(`Sending message to iframe: %c${n2}%c targetOrigin: %c${s2}`), r2.postMessage(x + t2, s2);
          })() : ce(n2, `Iframe(${n2}) not found`));
        }
        let Je = 0, Ze = false, Ve = false;
        function Ge(t2, n2 = -3) {
          if (Ze) return;
          const o2 = Math.max(ee[t2].mode, n2);
          if (o2 > ee[t2].mode && (ee[t2].mode = o2), o2 < 0) throw fe(t2), ee[t2].vAdvised || ge(t2 || "Parent", `${Ee(o2 + 2)}${Ee(2)}`), ee[t2].vAdvised = true, Ee(o2 + 2).replace(/<\/?[a-z][^>]*>|<\/>/gi, "");
          o2 > 0 && Ve || (function(e2, t3) {
            queueMicrotask(() => console.info(`%ciframe-resizer ${e2}`, oe || t3 < 1 ? "font-weight: bold;" : C));
          })(`v${e} (${((e2) => je(xe[e2]))(o2)})`, o2), o2 < 1 && ge("Parent", Ee(3)), Ze = true;
        }
        const Xe = (e2) => (c2) => {
          function u2() {
            ee[W2]?.heightCalculationMethod in M && He({ iframe: c2, height: 1, width: 1, type: i });
          }
          function d2() {
            if (ee[W2]) {
              const { iframe: e3 } = ee[W2], t2 = { close: Ne.bind(null, e3), disconnect: Le.bind(null, e3), removeListeners() {
                ge(W2, `<rb>Deprecated Method Name</>

The <b>removeListeners()</> method has been renamed to <b>disconnect()</>. ${I}
`), this.disconnect();
              }, resize() {
                ge(W2, "<rb>Deprecated Method</>\n\nUse of the <b>resize()</> method from the parent page is deprecated and will be removed in a future version of <i>iframe-resizer</>. As their are no longer any edge cases that require triggering a resize from the parent page, it is recommended to remove this method from your code."), Ue.bind(null, "Window resize", f, W2);
              }, moveToAnchor(e4) {
                ((e5, t3, n2) => {
                  if (typeof e5 !== t3) throw new TypeError(`${n2} is not a ${o2 = t3, o2.charAt(0).toUpperCase() + o2.slice(1)}`);
                  var o2;
                })(e4, y, "moveToAnchor(anchor) anchor"), Ue("Move to anchor", `moveToAnchor:${e4}`, W2);
              }, sendMessage(e4) {
                e4 = JSON.stringify(e4), Ue(s, `${s}:${e4}`, W2);
              } };
              e3.iframeResizer = t2, e3.iFrameResizer = t2;
            }
          }
          function p2(e3, t2) {
            const n2 = (n3) => () => {
              if (!ee[e3]) return;
              const { firstRun: o3, iframe: r2 } = ee[e3];
              Ue(n3, t2, e3), /* @__PURE__ */ ((e4) => e4 === i)(n3) && ((e4) => "lazy" === e4.loading)(r2) || (function(e4, t3) {
                const n4 = t3[e4], { msgTimeout: o4, warningTimeout: i2 } = n4;
                i2 && (o4 && clearTimeout(o4), n4.msgTimeout = setTimeout(function() {
                  const n5 = t3[e4];
                  void 0 !== n5 && (((e5) => {
                    e5.msgTimeout = void 0;
                  })(n5), (function(e5) {
                    const { initialised: t4 } = e5;
                    return t4 && (e5.initialisedFirstPage = true), t4;
                  })(n5) || Re(n5));
                }, i2));
              })(e3, ee), o3 || u2();
            }, { iframe: o2 } = ee[e3];
            ee[e3].initChild = n2(r), (function(e4, t3) {
              ve(e4, a, () => setTimeout(t3, 1));
            })(o2, n2(l)), (function(e4, t3) {
              const { iframe: n3, waitForLoad: o3 } = ee[e4];
              true !== o3 && (((e5) => {
                const { src: t4, srcdoc: n4 } = e5;
                return !n4 && (null == t4 || "" === t4 || "about:blank" === t4);
              })(n3) ? setTimeout(() => {
                de(e4, "noContent"), le(e4, "No content detected in the iframe, delaying initialisation");
              }) : setTimeout(t3));
            })(e3, n2(i));
          }
          function g2(e3) {
            return e3 ? (("sizeWidth" in e3 || "sizeHeight" in e3 || o in e3) && ge(W2, `<rb>Deprecated Option</>

The <b>sizeWidth</>, <b>sizeHeight</> and <b>autoResize</> options have been replaced with new <b>direction</> option which expects values of <bb>${k}</>, <bb>${T}</>, <bb>${j}</> or <bb>${$}</>.
`), e3) : {};
          }
          function w2(e3) {
            const t2 = ee[e3]?.iframe?.title;
            return "" === t2 || void 0 === t2;
          }
          function v2(e3, t2) {
            G(ee[W2], e3) && (ge(W2, `<rb>Deprecated option</>

The <b>${e3}</> option has been renamed to <b>${t2}</>. ${I}`), ee[W2][t2] = ee[W2][e3], delete ee[W2][e3]);
          }
          const x2 = (e3) => G(e3, "onMouseEnter") || G(e3, "onMouseLeave");
          function E2(e3) {
            var t2, n2;
            ee[W2] = { ...ee[W2], iframe: c2, remoteHost: c2?.src.split("/").slice(0, 3).join("/"), ...Ie, ...g2(e3), mouseEvents: x2(e3), mode: Oe(e3), syncTitle: w2(W2) }, v2("offset", "offsetSize"), v2("onClose", "onBeforeClose"), v2("onClosed", "onAfterClose"), de(W2, "setup"), (function() {
              const { direction: e4 } = ee[W2];
              switch (e4) {
                case k:
                  break;
                case T:
                  ee[W2].sizeHeight = false;
                case j:
                  ee[W2].sizeWidth = true;
                  break;
                case $:
                  ee[W2].sizeWidth = false, ee[W2].sizeHeight = false, ee[W2].autoResize = false;
                  break;
                default:
                  throw new TypeError(W2, `Direction value of "${e4}" is not valid`);
              }
            })(), (t2 = e3?.offsetSize || e3?.offset) && (ee[W2].direction === k ? ee[W2].offsetHeight = t2 : ee[W2].offsetWidth = t2), ee[W2].warningTimeout || le(W2, "warningTimeout:%c disabled", Z), null === ee[W2].postMessageTarget && (ee[W2].postMessageTarget = c2.contentWindow), ee[W2].targetOrigin = true === ee[W2].checkOrigin ? "" === (n2 = ee[W2].remoteHost) || null !== n2.match(/^(about:blank|javascript:|file:\/\/)/) ? "*" : n2 : "*";
          }
          const C2 = () => t in c2, W2 = (function(t2) {
            if (t2 && typeof t2 !== y) throw new TypeError("Invalid id for iFrame. Expected String");
            return "" !== t2 && t2 || (t2 = (function() {
              let t3 = e2?.id || Ie.id + Je++;
              return null !== document.getElementById(t3) && (t3 += Je++), t3;
            })(), c2.id = t2, de(t2, "assignId")), t2;
          })(c2.id);
          if (typeof e2 !== b) throw new TypeError("Options is not an object");
          return (function(e3) {
            const { search: t2 } = window.location;
            t2.includes("ifrlog") && (e3.log = R, e3.logExpand = t2.includes("ifrlog=expanded"));
          })(e2), (function(e3, t2) {
            const n2 = G(t2, "log"), o2 = typeof t2.log === y, i2 = n2 ? !!o2 || t2.log : Ie.log;
            G(t2, "logExpand") || (t2.logExpand = n2 && o2 ? t2.log === O : Ie.logExpand), (function(e4) {
              -1 === e4?.log && (e4.log = false, Ve = true);
            })(t2), (function({ enabled: e4, expand: t3, iframeId: n3 }) {
              const o3 = te({ expand: t3, label: re(n3) });
              oe = e4, ee[n3] || (ee[n3] = { console: o3 });
            })({ enabled: i2, expand: t2.logExpand, iframeId: e3 }), o2 && !(t2.log in S) && ue(e3, 'Invalid value for options.log: Accepted values are "expanded" and "collapsed"'), t2.log = i2;
          })(W2, e2), he(W2, function(e3) {
            C2() ? ce(W2, `Ignored iframe (${W2}), already setup.`) : (E2(e3), (function(e4) {
              if (true === Se[e4]) return false;
              const t2 = document.querySelectorAll(`iframe#${CSS.escape(e4)}`);
              if (t2.length <= 1) return true;
              Se[e4] = true;
              const n2 = Array.from(t2).flatMap((e5) => [h, e5, h]);
              ge(e4, `<rb>Duplicate ID attributes detected</>

The <b>${e4}</> ID is not unique. Having multiple iframes on the same page with the same ID causes problems with communication between the iframe and parent page. Please ensure that the ID of each iframe has a unique value.

Found <bb>${t2.length}</> iframes with the <b>${e4}</> ID:`, ...n2, h);
            })(W2), (function() {
              if (Ze) return;
              const { mode: e4 } = ee[W2];
              -1 !== e4 && Ge(W2, e4);
            })(), _e(), (function() {
              switch (c2.style.overflow = false === ee[W2]?.scrolling ? "hidden" : z, ee[W2]?.scrolling) {
                case "omit":
                  break;
                case true:
                  c2.scrolling = "yes";
                  break;
                case false:
                  c2.scrolling = "no";
                  break;
                default:
                  c2.scrolling = ee[W2] ? ee[W2].scrolling : "no";
              }
            })(), (function() {
              const { bodyMargin: e4 } = ee[W2];
              "number" != typeof e4 && "0" !== e4 || (ee[W2].bodyMargin = `${e4}px`);
            })(), p2(W2, (function(e4) {
              const { autoResize: t2, bodyBackground: o2, bodyMargin: i2, bodyPadding: r2, heightCalculationMethod: a2, inPageLinks: s2, license: l2, log: c3, logExpand: u3, mouseEvents: d3, offsetHeight: f2, offsetWidth: p3, mode: h2, sizeHeight: g3, sizeWidth: y2, tolerance: b2, widthCalculationMethod: w3 } = ee[e4];
              return [e4, "8", y2, c3, "32", true, t2, i2, a2, o2, r2, b2, s2, m, w3, d3, f2, p3, g3, l2, Ce.version, h2, "", u3].join(n);
            })(W2)), d2(), pe(W2));
          })(e2), c2?.iframeResizer;
        };
        function Ye() {
          true !== document.hidden && ((e2, t2) => {
            Object.values(ee).filter(({ autoResize: e3, firstRun: t3 }) => e3 && !t3).forEach(({ iframe: n2 }) => Ue(e2, t2, n2.id));
          })("tabVisible", f);
        }
        const _e = /* @__PURE__ */ ((e2) => {
          let t2 = false;
          return function() {
            return t2 ? void 0 : (t2 = true, Reflect.apply(e2, this, arguments));
          };
        })(() => {
          ve(window, s, We), ve(document, "visibilitychange", Ye), window.iframeParentListener = (e2) => setTimeout(() => We({ data: e2, sameOrigin: true }));
        }), Ke = `[${t}] `;
        const Qe = /* @__PURE__ */ (function() {
          function e2(e3) {
            switch (true) {
              case !e3:
                throw new TypeError(`${Ke}iframe is not defined`);
              case !e3.tagName:
                throw new TypeError(`${Ke}Not a valid DOM element`);
              case "IFRAME" !== e3.tagName.toUpperCase():
                throw new TypeError(`${Ke}Expected <IFRAME> tag, found <${e3.tagName}>`);
              case !e3.isConnected:
                !(function(e4) {
                  const n3 = new MutationObserver(() => {
                    e4.isConnected && (t2(e4), n3.disconnect());
                  });
                  n3.observe(document.body, { childList: true, subtree: true });
                })(e3), n2.push(e3);
                break;
              default:
                t2(e3), n2.push(e3);
            }
          }
          let t2, n2;
          return function(o2, i2) {
            if (typeof window === v) return [];
            if (!document.body) throw new TypeError(`${Ke}document.body is not available. Ensure the DOM is fully loaded before calling iframeResize().`);
            switch (t2 = Xe(o2), n2 = [], typeof i2) {
              case v:
              case y:
                document.querySelectorAll(i2 || "iframe").forEach(e2);
                break;
              case b:
                e2(i2);
                break;
              default:
                throw new TypeError(`${Ke}Unexpected data type (${typeof i2})`);
            }
            return Object.freeze(n2);
          };
        })();
        return typeof window !== v && (window.iFrameResize = window.iFrameResize || function(...e2) {
          be("iFrameResize()", "iframeResize()", "", g), Qe(...e2);
        }), Qe;
      });
    }
  });

  // src/iframe_resizer_parent.js
  var import_parent = __toESM(require_index_umd(), 1);
  var emailIframeResizeOptions = {
    license: "GPLv3",
    log: false,
    checkOrigin: false,
    inPageLinks: true,
    waitForLoad: true,
    warningTimeout: 0
  };
  window.kkIframeResize = function kkIframeResize(iframe) {
    if (!(iframe instanceof HTMLIFrameElement)) return null;
    if (iframe.iframeResizer || iframe.iFrameResizer) return iframe.iframeResizer || iframe.iFrameResizer;
    (0, import_parent.default)(emailIframeResizeOptions, iframe);
    return iframe.iframeResizer || iframe.iFrameResizer || null;
  };
  window.kkIframeResizeRaw = import_parent.default;
})();
/*! Bundled license information:

@iframe-resizer/parent/index.umd.js:
  (*!
   *  @preserve
   *  
   *  @module      iframe-resizer/parent 5.5.9 (umd) - 2026-02-06
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
