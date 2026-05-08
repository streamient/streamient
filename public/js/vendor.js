var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// node_modules/.pnpm/ev-emitter@1.1.1/node_modules/ev-emitter/ev-emitter.js
var require_ev_emitter = __commonJS({
  "node_modules/.pnpm/ev-emitter@1.1.1/node_modules/ev-emitter/ev-emitter.js"(exports, module) {
    (function(global, factory) {
      if (typeof define == "function" && define.amd) {
        define(factory);
      } else if (typeof module == "object" && module.exports) {
        module.exports = factory();
      } else {
        global.EvEmitter = factory();
      }
    })(typeof window != "undefined" ? window : exports, function() {
      "use strict";
      function EvEmitter() {
      }
      var proto = EvEmitter.prototype;
      proto.on = function(eventName, listener) {
        if (!eventName || !listener) {
          return;
        }
        var events = this._events = this._events || {};
        var listeners = events[eventName] = events[eventName] || [];
        if (listeners.indexOf(listener) == -1) {
          listeners.push(listener);
        }
        return this;
      };
      proto.once = function(eventName, listener) {
        if (!eventName || !listener) {
          return;
        }
        this.on(eventName, listener);
        var onceEvents = this._onceEvents = this._onceEvents || {};
        var onceListeners = onceEvents[eventName] = onceEvents[eventName] || {};
        onceListeners[listener] = true;
        return this;
      };
      proto.off = function(eventName, listener) {
        var listeners = this._events && this._events[eventName];
        if (!listeners || !listeners.length) {
          return;
        }
        var index = listeners.indexOf(listener);
        if (index != -1) {
          listeners.splice(index, 1);
        }
        return this;
      };
      proto.emitEvent = function(eventName, args) {
        var listeners = this._events && this._events[eventName];
        if (!listeners || !listeners.length) {
          return;
        }
        listeners = listeners.slice(0);
        args = args || [];
        var onceListeners = this._onceEvents && this._onceEvents[eventName];
        for (var i = 0; i < listeners.length; i++) {
          var listener = listeners[i];
          var isOnce = onceListeners && onceListeners[listener];
          if (isOnce) {
            this.off(eventName, listener);
            delete onceListeners[listener];
          }
          listener.apply(this, args);
        }
        return this;
      };
      proto.allOff = function() {
        delete this._events;
        delete this._onceEvents;
      };
      return EvEmitter;
    });
  }
});

// node_modules/.pnpm/unipointer@2.4.0/node_modules/unipointer/unipointer.js
var require_unipointer = __commonJS({
  "node_modules/.pnpm/unipointer@2.4.0/node_modules/unipointer/unipointer.js"(exports, module) {
    (function(window2, factory) {
      if (typeof define == "function" && define.amd) {
        define([
          "ev-emitter/ev-emitter"
        ], function(EvEmitter) {
          return factory(window2, EvEmitter);
        });
      } else if (typeof module == "object" && module.exports) {
        module.exports = factory(
          window2,
          require_ev_emitter()
        );
      } else {
        window2.Unipointer = factory(
          window2,
          window2.EvEmitter
        );
      }
    })(window, function factory(window2, EvEmitter) {
      "use strict";
      function noop2() {
      }
      function Unipointer() {
      }
      var proto = Unipointer.prototype = Object.create(EvEmitter.prototype);
      proto.bindStartEvent = function(elem) {
        this._bindStartEvent(elem, true);
      };
      proto.unbindStartEvent = function(elem) {
        this._bindStartEvent(elem, false);
      };
      proto._bindStartEvent = function(elem, isAdd) {
        isAdd = isAdd === void 0 ? true : isAdd;
        var bindMethod = isAdd ? "addEventListener" : "removeEventListener";
        var startEvent = "mousedown";
        if ("ontouchstart" in window2) {
          startEvent = "touchstart";
        } else if (window2.PointerEvent) {
          startEvent = "pointerdown";
        }
        elem[bindMethod](startEvent, this);
      };
      proto.handleEvent = function(event) {
        var method = "on" + event.type;
        if (this[method]) {
          this[method](event);
        }
      };
      proto.getTouch = function(touches) {
        for (var i = 0; i < touches.length; i++) {
          var touch = touches[i];
          if (touch.identifier == this.pointerIdentifier) {
            return touch;
          }
        }
      };
      proto.onmousedown = function(event) {
        var button = event.button;
        if (button && (button !== 0 && button !== 1)) {
          return;
        }
        this._pointerDown(event, event);
      };
      proto.ontouchstart = function(event) {
        this._pointerDown(event, event.changedTouches[0]);
      };
      proto.onpointerdown = function(event) {
        this._pointerDown(event, event);
      };
      proto._pointerDown = function(event, pointer) {
        if (event.button || this.isPointerDown) {
          return;
        }
        this.isPointerDown = true;
        this.pointerIdentifier = pointer.pointerId !== void 0 ? (
          // pointerId for pointer events, touch.indentifier for touch events
          pointer.pointerId
        ) : pointer.identifier;
        this.pointerDown(event, pointer);
      };
      proto.pointerDown = function(event, pointer) {
        this._bindPostStartEvents(event);
        this.emitEvent("pointerDown", [event, pointer]);
      };
      var postStartEvents = {
        mousedown: ["mousemove", "mouseup"],
        touchstart: ["touchmove", "touchend", "touchcancel"],
        pointerdown: ["pointermove", "pointerup", "pointercancel"]
      };
      proto._bindPostStartEvents = function(event) {
        if (!event) {
          return;
        }
        var events = postStartEvents[event.type];
        events.forEach(function(eventName) {
          window2.addEventListener(eventName, this);
        }, this);
        this._boundPointerEvents = events;
      };
      proto._unbindPostStartEvents = function() {
        if (!this._boundPointerEvents) {
          return;
        }
        this._boundPointerEvents.forEach(function(eventName) {
          window2.removeEventListener(eventName, this);
        }, this);
        delete this._boundPointerEvents;
      };
      proto.onmousemove = function(event) {
        this._pointerMove(event, event);
      };
      proto.onpointermove = function(event) {
        if (event.pointerId == this.pointerIdentifier) {
          this._pointerMove(event, event);
        }
      };
      proto.ontouchmove = function(event) {
        var touch = this.getTouch(event.changedTouches);
        if (touch) {
          this._pointerMove(event, touch);
        }
      };
      proto._pointerMove = function(event, pointer) {
        this.pointerMove(event, pointer);
      };
      proto.pointerMove = function(event, pointer) {
        this.emitEvent("pointerMove", [event, pointer]);
      };
      proto.onmouseup = function(event) {
        this._pointerUp(event, event);
      };
      proto.onpointerup = function(event) {
        if (event.pointerId == this.pointerIdentifier) {
          this._pointerUp(event, event);
        }
      };
      proto.ontouchend = function(event) {
        var touch = this.getTouch(event.changedTouches);
        if (touch) {
          this._pointerUp(event, touch);
        }
      };
      proto._pointerUp = function(event, pointer) {
        this._pointerDone();
        this.pointerUp(event, pointer);
      };
      proto.pointerUp = function(event, pointer) {
        this.emitEvent("pointerUp", [event, pointer]);
      };
      proto._pointerDone = function() {
        this._pointerReset();
        this._unbindPostStartEvents();
        this.pointerDone();
      };
      proto._pointerReset = function() {
        this.isPointerDown = false;
        delete this.pointerIdentifier;
      };
      proto.pointerDone = noop2;
      proto.onpointercancel = function(event) {
        if (event.pointerId == this.pointerIdentifier) {
          this._pointerCancel(event, event);
        }
      };
      proto.ontouchcancel = function(event) {
        var touch = this.getTouch(event.changedTouches);
        if (touch) {
          this._pointerCancel(event, touch);
        }
      };
      proto._pointerCancel = function(event, pointer) {
        this._pointerDone();
        this.pointerCancel(event, pointer);
      };
      proto.pointerCancel = function(event, pointer) {
        this.emitEvent("pointerCancel", [event, pointer]);
      };
      Unipointer.getPointerPoint = function(pointer) {
        return {
          x: pointer.pageX,
          y: pointer.pageY
        };
      };
      return Unipointer;
    });
  }
});

// node_modules/.pnpm/huebee@2.1.1/node_modules/huebee/huebee.js
var require_huebee = __commonJS({
  "node_modules/.pnpm/huebee@2.1.1/node_modules/huebee/huebee.js"(exports, module) {
    (function(window2, factory) {
      if (typeof define == "function" && define.amd) {
        define([
          "ev-emitter/ev-emitter",
          "unipointer/unipointer"
        ], function(EvEmitter, Unipointer) {
          return factory(window2, EvEmitter, Unipointer);
        });
      } else if (typeof module == "object" && module.exports) {
        module.exports = factory(
          window2,
          require_ev_emitter(),
          require_unipointer()
        );
      } else {
        window2.Huebee = factory(
          window2,
          window2.EvEmitter,
          window2.Unipointer
        );
      }
    })(window, function factory(window2, EvEmitter, Unipointer) {
      function Huebee(anchor, options) {
        anchor = getQueryElement(anchor);
        if (!anchor) {
          throw new Error("Bad element for Huebee: " + anchor);
        }
        this.anchor = anchor;
        this.options = {};
        this.option(Huebee.defaults);
        this.option(options);
        this.create();
      }
      Huebee.defaults = {
        hues: 12,
        hue0: 0,
        shades: 5,
        saturations: 3,
        notation: "shortHex",
        setText: true,
        setBGColor: true
      };
      var proto = Huebee.prototype = Object.create(EvEmitter.prototype);
      proto.option = function(options) {
        this.options = extend(this.options, options);
      };
      var GUID = 0;
      var instances = {};
      proto.create = function() {
        var guid = this.guid = ++GUID;
        this.anchor.huebeeGUID = guid;
        instances[guid] = this;
        this.setBGElems = this.getSetElems(this.options.setBGColor);
        this.setTextElems = this.getSetElems(this.options.setText);
        this.outsideCloseIt = this.outsideClose.bind(this);
        this.onDocKeydown = this.docKeydown.bind(this);
        this.closeIt = this.close.bind(this);
        this.openIt = this.open.bind(this);
        this.onElemTransitionend = this.elemTransitionend.bind(this);
        this.isInputAnchor = this.anchor.nodeName == "INPUT";
        if (!this.options.staticOpen) {
          this.anchor.addEventListener("click", this.openIt);
          this.anchor.addEventListener("focus", this.openIt);
        }
        if (this.isInputAnchor) {
          this.anchor.addEventListener("input", this.inputInput.bind(this));
        }
        var element = this.element = document.createElement("div");
        element.className = "huebee ";
        element.className += this.options.staticOpen ? "is-static-open " : "is-hidden ";
        element.className += this.options.className || "";
        var container = this.container = document.createElement("div");
        container.className = "huebee__container";
        function onContainerPointerStart(event) {
          if (event.target == container) {
            event.preventDefault();
          }
        }
        container.addEventListener("mousedown", onContainerPointerStart);
        container.addEventListener("touchstart", onContainerPointerStart);
        this.createCanvas();
        this.cursor = document.createElement("div");
        this.cursor.className = "huebee__cursor is-hidden";
        container.appendChild(this.cursor);
        this.createCloseButton();
        element.appendChild(container);
        if (!this.options.staticOpen) {
          var parentStyle = getComputedStyle(this.anchor.parentNode);
          if (parentStyle.position != "relative" && parentStyle.position != "absolute") {
            this.anchor.parentNode.style.position = "relative";
          }
        }
        var customLength = this.getCustomLength();
        this.satY = customLength ? Math.ceil(customLength / this.options.hues) + 1 : 0;
        this.updateColors();
        this.setAnchorColor();
        if (this.options.staticOpen) {
          this.open();
        }
      };
      proto.getSetElems = function(option2) {
        if (option2 === true) {
          return [this.anchor];
        } else if (typeof option2 == "string") {
          return document.querySelectorAll(option2);
        }
      };
      proto.getCustomLength = function() {
        var customColors = this.options.customColors;
        return customColors && customColors.length || 0;
      };
      proto.createCanvas = function() {
        var canvas = this.canvas = document.createElement("canvas");
        canvas.className = "huebee__canvas";
        this.ctx = canvas.getContext("2d");
        var canvasPointer = this.canvasPointer = new Unipointer();
        canvasPointer._bindStartEvent(canvas);
        canvasPointer.on("pointerDown", this.canvasPointerDown.bind(this));
        canvasPointer.on("pointerMove", this.canvasPointerMove.bind(this));
        this.container.appendChild(canvas);
      };
      var svgURI = "http://www.w3.org/2000/svg";
      proto.createCloseButton = function() {
        if (this.options.staticOpen) {
          return;
        }
        var svg = document.createElementNS(svgURI, "svg");
        svg.setAttribute("class", "huebee__close-button");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "24");
        svg.setAttribute("height", "24");
        var path = document.createElementNS(svgURI, "path");
        path.setAttribute("d", "M 7,7 L 17,17 M 17,7 L 7,17");
        path.setAttribute("class", "huebee__close-button__x");
        svg.appendChild(path);
        svg.addEventListener("click", this.closeIt);
        this.container.appendChild(svg);
      };
      proto.updateColors = function() {
        this.swatches = {};
        this.colorGrid = {};
        this.updateColorModer();
        var shades = this.options.shades;
        var sats = this.options.saturations;
        var hues = this.options.hues;
        if (this.getCustomLength()) {
          var customI = 0;
          this.options.customColors.forEach(function(color2) {
            var x2 = customI % hues;
            var y3 = Math.floor(customI / hues);
            var swatch2 = getSwatch(color2);
            if (swatch2) {
              this.addSwatch(swatch2, x2, y3);
              customI++;
            }
          }.bind(this));
        }
        var i;
        for (i = 0; i < sats; i++) {
          var sat = 1 - i / sats;
          var yOffset = shades * i + this.satY;
          this.updateSaturationGrid(i, sat, yOffset);
        }
        var grayCount = this.getGrayCount();
        for (i = 0; i < grayCount; i++) {
          var lum = 1 - i / (shades + 1);
          var color = this.colorModer(0, 0, lum);
          var swatch = getSwatch(color);
          this.addSwatch(swatch, hues + 1, i);
        }
      };
      proto.getGrayCount = function() {
        return this.options.shades ? this.options.shades + 2 : 0;
      };
      proto.updateSaturationGrid = function(i, sat, yOffset) {
        var shades = this.options.shades;
        var hues = this.options.hues;
        var hue0 = this.options.hue0;
        for (var row = 0; row < shades; row++) {
          for (var col = 0; col < hues; col++) {
            var hue = Math.round(col * 360 / hues + hue0) % 360;
            var lum = 1 - (row + 1) / (shades + 1);
            var color = this.colorModer(hue, sat, lum);
            var swatch = getSwatch(color);
            var gridY = row + yOffset;
            this.addSwatch(swatch, col, gridY);
          }
        }
      };
      proto.addSwatch = function(swatch, gridX, gridY) {
        this.swatches[gridX + "," + gridY] = swatch;
        this.colorGrid[swatch.color.toUpperCase()] = {
          x: gridX,
          y: gridY
        };
      };
      var colorModers = {
        hsl: function(h2, s, l3) {
          s = Math.round(s * 100);
          l3 = Math.round(l3 * 100);
          return "hsl(" + h2 + ", " + s + "%, " + l3 + "%)";
        },
        hex: hsl2hex,
        shortHex: function(h2, s, l3) {
          var hex = hsl2hex(h2, s, l3);
          return roundHex(hex);
        }
      };
      proto.updateColorModer = function() {
        this.colorModer = colorModers[this.options.notation] || colorModers.shortHex;
      };
      proto.renderColors = function() {
        var gridSize = this.gridSize * 2;
        for (var position in this.swatches) {
          var swatch = this.swatches[position];
          var duple = position.split(",");
          var gridX = duple[0];
          var gridY = duple[1];
          this.ctx.fillStyle = swatch.color;
          this.ctx.fillRect(gridX * gridSize, gridY * gridSize, gridSize, gridSize);
        }
      };
      proto.setAnchorColor = function() {
        if (this.isInputAnchor) {
          this.setColor(this.anchor.value);
        }
      };
      var docElem = document.documentElement;
      proto.open = function() {
        if (this.isOpen) {
          return;
        }
        var anchor = this.anchor;
        var elem = this.element;
        if (!this.options.staticOpen) {
          elem.style.left = anchor.offsetLeft + "px";
          elem.style.top = anchor.offsetTop + anchor.offsetHeight + "px";
        }
        this.bindOpenEvents(true);
        elem.removeEventListener("transitionend", this.onElemTransitionend);
        anchor.parentNode.insertBefore(elem, anchor.nextSibling);
        var duration = getComputedStyle(elem).transitionDuration;
        this.hasTransition = duration && duration != "none" && parseFloat(duration);
        this.isOpen = true;
        this.updateSizes();
        this.renderColors();
        this.setAnchorColor();
        var h2 = elem.offsetHeight;
        elem.classList.remove("is-hidden");
      };
      proto.bindOpenEvents = function(isAdd) {
        if (this.options.staticOpen) {
          return;
        }
        var method = (isAdd ? "add" : "remove") + "EventListener";
        docElem[method]("mousedown", this.outsideCloseIt);
        docElem[method]("touchstart", this.outsideCloseIt);
        document[method]("focusin", this.outsideCloseIt);
        document[method]("keydown", this.onDocKeydown);
        this.anchor[method]("blur", this.closeIt);
      };
      proto.updateSizes = function() {
        var hues = this.options.hues;
        var shades = this.options.shades;
        var sats = this.options.saturations;
        var grayCount = this.getGrayCount();
        var customLength = this.getCustomLength();
        this.cursorBorder = parseInt(getComputedStyle(this.cursor).borderTopWidth, 10);
        this.gridSize = Math.round(this.cursor.offsetWidth - this.cursorBorder * 2);
        this.canvasOffset = {
          x: this.canvas.offsetLeft,
          y: this.canvas.offsetTop
        };
        var cols, rows;
        if (customLength && !grayCount) {
          cols = Math.min(customLength, hues);
          rows = Math.ceil(customLength / hues);
        } else {
          cols = hues + 2;
          rows = Math.max(shades * sats + this.satY, grayCount);
        }
        var width = this.canvas.width = cols * this.gridSize * 2;
        this.canvas.height = rows * this.gridSize * 2;
        this.canvas.style.width = width / 2 + "px";
      };
      proto.outsideClose = function(event) {
        var isAnchor = this.anchor.contains(event.target);
        var isElement3 = this.element.contains(event.target);
        if (!isAnchor && !isElement3) {
          this.close();
        }
      };
      var closeKeydowns = {
        13: true,
        // enter
        27: true
        // esc
      };
      proto.docKeydown = function(event) {
        if (closeKeydowns[event.keyCode]) {
          this.close();
        }
      };
      var supportsTransitions = typeof docElem.style.transform == "string";
      proto.close = function() {
        if (!this.isOpen) {
          return;
        }
        if (supportsTransitions && this.hasTransition) {
          this.element.addEventListener("transitionend", this.onElemTransitionend);
        } else {
          this.remove();
        }
        this.element.classList.add("is-hidden");
        this.bindOpenEvents(false);
        this.isOpen = false;
      };
      proto.remove = function() {
        var parent = this.element.parentNode;
        if (parent.contains(this.element)) {
          parent.removeChild(this.element);
        }
      };
      proto.elemTransitionend = function(event) {
        if (event.target != this.element) {
          return;
        }
        this.element.removeEventListener("transitionend", this.onElemTransitionend);
        this.remove();
      };
      proto.inputInput = function() {
        this.setColor(this.anchor.value);
      };
      proto.canvasPointerDown = function(event, pointer) {
        event.preventDefault();
        this.updateOffset();
        this.canvasPointerChange(pointer);
      };
      proto.updateOffset = function() {
        var boundingRect = this.canvas.getBoundingClientRect();
        this.offset = {
          x: boundingRect.left + window2.pageXOffset,
          y: boundingRect.top + window2.pageYOffset
        };
      };
      proto.canvasPointerMove = function(event, pointer) {
        this.canvasPointerChange(pointer);
      };
      proto.canvasPointerChange = function(pointer) {
        var x2 = Math.round(pointer.pageX - this.offset.x);
        var y3 = Math.round(pointer.pageY - this.offset.y);
        var gridSize = this.gridSize;
        var sx = Math.floor(x2 / gridSize);
        var sy = Math.floor(y3 / gridSize);
        var swatch = this.swatches[sx + "," + sy];
        this.setSwatch(swatch);
      };
      proto.setColor = function(color) {
        var swatch = getSwatch(color);
        this.setSwatch(swatch);
      };
      proto.setSwatch = function(swatch) {
        var color = swatch && swatch.color;
        if (!swatch) {
          return;
        }
        var wasSameColor = color == this.color;
        this.color = color;
        this.hue = swatch.hue;
        this.sat = swatch.sat;
        this.lum = swatch.lum;
        var lightness = this.lum - Math.cos((this.hue + 70) / 180 * Math.PI) * 0.15;
        this.isLight = lightness > 0.5;
        var gridPosition = this.colorGrid[color.toUpperCase()];
        this.updateCursor(gridPosition);
        this.setTexts();
        this.setBackgrounds();
        if (!wasSameColor) {
          this.emitEvent("change", [color, swatch.hue, swatch.sat, swatch.lum]);
        }
      };
      proto.setTexts = function() {
        if (!this.setTextElems) {
          return;
        }
        for (var i = 0; i < this.setTextElems.length; i++) {
          var elem = this.setTextElems[i];
          var property = elem.nodeName == "INPUT" ? "value" : "textContent";
          elem[property] = this.color;
        }
      };
      proto.setBackgrounds = function() {
        if (!this.setBGElems) {
          return;
        }
        var textColor = this.isLight ? "#222" : "white";
        for (var i = 0; i < this.setBGElems.length; i++) {
          var elem = this.setBGElems[i];
          elem.style.backgroundColor = this.color;
          elem.style.color = textColor;
        }
      };
      proto.updateCursor = function(position) {
        if (!this.isOpen) {
          return;
        }
        var classMethod = position ? "remove" : "add";
        this.cursor.classList[classMethod]("is-hidden");
        if (!position) {
          return;
        }
        var gridSize = this.gridSize;
        var offset2 = this.canvasOffset;
        var border = this.cursorBorder;
        this.cursor.style.left = position.x * gridSize + offset2.x - border + "px";
        this.cursor.style.top = position.y * gridSize + offset2.y - border + "px";
      };
      var console2 = window2.console;
      function htmlInit() {
        var elems = document.querySelectorAll("[data-huebee]");
        for (var i = 0; i < elems.length; i++) {
          var elem = elems[i];
          var attr = elem.getAttribute("data-huebee");
          var options;
          try {
            options = attr && JSON.parse(attr);
          } catch (error) {
            if (console2) {
              console2.error("Error parsing data-huebee on " + elem.className + ": " + error);
            }
            continue;
          }
          new Huebee(elem, options);
        }
      }
      var readyState = document.readyState;
      if (readyState == "complete" || readyState == "interactive") {
        htmlInit();
      } else {
        document.addEventListener("DOMContentLoaded", htmlInit);
      }
      Huebee.data = function(elem) {
        elem = getQueryElement(elem);
        var id = elem && elem.huebeeGUID;
        return id && instances[id];
      };
      var proxyCtx;
      function getSwatch(color) {
        if (!proxyCtx) {
          var proxyCanvas = document.createElement("canvas");
          proxyCanvas.width = proxyCanvas.height = 1;
          proxyCtx = proxyCanvas.getContext("2d");
        }
        proxyCtx.clearRect(0, 0, 1, 1);
        proxyCtx.fillStyle = "#010203";
        proxyCtx.fillStyle = color;
        proxyCtx.fillRect(0, 0, 1, 1);
        var data = proxyCtx.getImageData(0, 0, 1, 1).data;
        data = [data[0], data[1], data[2], data[3]];
        if (data.join(",") == "1,2,3,255") {
          return;
        }
        var hsl = rgb2hsl.apply(this, data);
        return {
          color: color.trim(),
          hue: hsl[0],
          sat: hsl[1],
          lum: hsl[2]
        };
      }
      function extend(a2, b3) {
        for (var prop in b3) {
          a2[prop] = b3[prop];
        }
        return a2;
      }
      function getQueryElement(elem) {
        if (typeof elem == "string") {
          elem = document.querySelector(elem);
        }
        return elem;
      }
      function hsl2hex(h2, s, l3) {
        var rgb = hsl2rgb(h2, s, l3);
        return rgb2hex(rgb);
      }
      function hsl2rgb(h2, s, l3) {
        var C2 = (1 - Math.abs(2 * l3 - 1)) * s;
        var hp = h2 / 60;
        var X2 = C2 * (1 - Math.abs(hp % 2 - 1));
        var rgb, m3;
        switch (Math.floor(hp)) {
          case 0:
            rgb = [C2, X2, 0];
            break;
          case 1:
            rgb = [X2, C2, 0];
            break;
          case 2:
            rgb = [0, C2, X2];
            break;
          case 3:
            rgb = [0, X2, C2];
            break;
          case 4:
            rgb = [X2, 0, C2];
            break;
          case 5:
            rgb = [C2, 0, X2];
            break;
          default:
            rgb = [0, 0, 0];
        }
        m3 = l3 - C2 / 2;
        rgb = rgb.map(function(v2) {
          return v2 + m3;
        });
        return rgb;
      }
      function rgb2hsl(r, g3, b3) {
        r /= 255;
        g3 /= 255;
        b3 /= 255;
        var M2 = Math.max(r, g3, b3);
        var m3 = Math.min(r, g3, b3);
        var C2 = M2 - m3;
        var L2 = 0.5 * (M2 + m3);
        var S2 = C2 === 0 ? 0 : C2 / (1 - Math.abs(2 * L2 - 1));
        var h2;
        if (C2 === 0) {
          h2 = 0;
        } else if (M2 === r) {
          h2 = (g3 - b3) / C2 % 6;
        } else if (M2 === g3) {
          h2 = (b3 - r) / C2 + 2;
        } else if (M2 === b3) {
          h2 = (r - g3) / C2 + 4;
        }
        var H2 = 60 * h2;
        return [H2, parseFloat(S2), parseFloat(L2)];
      }
      function rgb2hex(rgb) {
        var hex = rgb.map(function(value) {
          value = Math.round(value * 255);
          var hexNum = value.toString(16).toUpperCase();
          hexNum = hexNum.length < 2 ? "0" + hexNum : hexNum;
          return hexNum;
        });
        return "#" + hex.join("");
      }
      function roundHex(hex) {
        return "#" + hex[1] + hex[3] + hex[5];
      }
      return Huebee;
    });
  }
});

// node_modules/.pnpm/filepond@4.32.12/node_modules/filepond/dist/filepond.js
var require_filepond = __commonJS({
  "node_modules/.pnpm/filepond@4.32.12/node_modules/filepond/dist/filepond.js"(exports, module) {
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = global || self, factory(global.FilePond = {}));
    })(exports, function(exports2) {
      "use strict";
      var isNode = function isNode2(value) {
        return value instanceof HTMLElement;
      };
      var createStore = function createStore2(initialState) {
        var queries2 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : [];
        var actions2 = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
        var state2 = Object.assign({}, initialState);
        var actionQueue = [];
        var dispatchQueue = [];
        var getState = function getState2() {
          return Object.assign({}, state2);
        };
        var processActionQueue = function processActionQueue2() {
          var queue = [].concat(actionQueue);
          actionQueue.length = 0;
          return queue;
        };
        var processDispatchQueue = function processDispatchQueue2() {
          var queue = [].concat(dispatchQueue);
          dispatchQueue.length = 0;
          queue.forEach(function(_ref) {
            var type = _ref.type, data2 = _ref.data;
            dispatch2(type, data2);
          });
        };
        var dispatch2 = function dispatch3(type, data2, isBlocking) {
          if (isBlocking && !document.hidden) {
            dispatchQueue.push({ type, data: data2 });
            return;
          }
          if (actionHandlers[type]) {
            actionHandlers[type](data2);
          }
          actionQueue.push({
            type,
            data: data2
          });
        };
        var query = function query2(str) {
          var _queryHandles;
          for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            args[_key - 1] = arguments[_key];
          }
          return queryHandles[str] ? (_queryHandles = queryHandles)[str].apply(_queryHandles, args) : null;
        };
        var api = {
          getState,
          processActionQueue,
          processDispatchQueue,
          dispatch: dispatch2,
          query
        };
        var queryHandles = {};
        queries2.forEach(function(query2) {
          queryHandles = Object.assign({}, query2(state2), {}, queryHandles);
        });
        var actionHandlers = {};
        actions2.forEach(function(action) {
          actionHandlers = Object.assign({}, action(dispatch2, query, state2), {}, actionHandlers);
        });
        return api;
      };
      var defineProperty = function defineProperty2(obj, property, definition) {
        if (typeof definition === "function") {
          obj[property] = definition;
          return;
        }
        Object.defineProperty(obj, property, Object.assign({}, definition));
      };
      var forin = function forin2(obj, cb) {
        for (var key in obj) {
          if (!obj.hasOwnProperty(key)) {
            continue;
          }
          cb(key, obj[key]);
        }
      };
      var createObject = function createObject2(definition) {
        var obj = {};
        forin(definition, function(property) {
          defineProperty(obj, property, definition[property]);
        });
        return obj;
      };
      var attr = function attr2(node, name2) {
        var value = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : null;
        if (value === null) {
          return node.getAttribute(name2) || node.hasAttribute(name2);
        }
        node.setAttribute(name2, value);
      };
      var ns = "http://www.w3.org/2000/svg";
      var svgElements = ["svg", "path"];
      var isSVGElement = function isSVGElement2(tag) {
        return svgElements.includes(tag);
      };
      var createElement = function createElement2(tag, className) {
        var attributes = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        if (typeof className === "object") {
          attributes = className;
          className = null;
        }
        var element = isSVGElement(tag) ? document.createElementNS(ns, tag) : document.createElement(tag);
        if (className) {
          if (isSVGElement(tag)) {
            attr(element, "class", className);
          } else {
            element.className = className;
          }
        }
        forin(attributes, function(name2, value) {
          attr(element, name2, value);
        });
        return element;
      };
      var appendChild = function appendChild2(parent) {
        return function(child, index) {
          if (typeof index !== "undefined" && parent.children[index]) {
            parent.insertBefore(child, parent.children[index]);
          } else {
            parent.appendChild(child);
          }
        };
      };
      var appendChildView = function appendChildView2(parent, childViews) {
        return function(view, index) {
          if (typeof index !== "undefined") {
            childViews.splice(index, 0, view);
          } else {
            childViews.push(view);
          }
          return view;
        };
      };
      var removeChildView = function removeChildView2(parent, childViews) {
        return function(view) {
          childViews.splice(childViews.indexOf(view), 1);
          if (view.element.parentNode) {
            parent.removeChild(view.element);
          }
          return view;
        };
      };
      var IS_BROWSER = (function() {
        return typeof window !== "undefined" && typeof window.document !== "undefined";
      })();
      var isBrowser = function isBrowser2() {
        return IS_BROWSER;
      };
      var testElement = isBrowser() ? createElement("svg") : {};
      var getChildCount = "children" in testElement ? function(el) {
        return el.children.length;
      } : function(el) {
        return el.childNodes.length;
      };
      var getViewRect = function getViewRect2(elementRect, childViews, offset2, scale) {
        var left2 = offset2[0] || elementRect.left;
        var top2 = offset2[1] || elementRect.top;
        var right2 = left2 + elementRect.width;
        var bottom2 = top2 + elementRect.height * (scale[1] || 1);
        var rect = {
          // the rectangle of the element itself
          element: Object.assign({}, elementRect),
          // the rectangle of the element expanded to contain its children, does not include any margins
          inner: {
            left: elementRect.left,
            top: elementRect.top,
            right: elementRect.right,
            bottom: elementRect.bottom
          },
          // the rectangle of the element expanded to contain its children including own margin and child margins
          // margins will be added after we've recalculated the size
          outer: {
            left: left2,
            top: top2,
            right: right2,
            bottom: bottom2
          }
        };
        childViews.filter(function(childView) {
          return !childView.isRectIgnored();
        }).map(function(childView) {
          return childView.rect;
        }).forEach(function(childViewRect) {
          expandRect(rect.inner, Object.assign({}, childViewRect.inner));
          expandRect(rect.outer, Object.assign({}, childViewRect.outer));
        });
        calculateRectSize(rect.inner);
        rect.outer.bottom += rect.element.marginBottom;
        rect.outer.right += rect.element.marginRight;
        calculateRectSize(rect.outer);
        return rect;
      };
      var expandRect = function expandRect2(parent, child) {
        child.top += parent.top;
        child.right += parent.left;
        child.bottom += parent.top;
        child.left += parent.left;
        if (child.bottom > parent.bottom) {
          parent.bottom = child.bottom;
        }
        if (child.right > parent.right) {
          parent.right = child.right;
        }
      };
      var calculateRectSize = function calculateRectSize2(rect) {
        rect.width = rect.right - rect.left;
        rect.height = rect.bottom - rect.top;
      };
      var isNumber = function isNumber2(value) {
        return typeof value === "number";
      };
      var thereYet = function thereYet2(position, destination, velocity) {
        var errorMargin = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 1e-3;
        return Math.abs(position - destination) < errorMargin && Math.abs(velocity) < errorMargin;
      };
      var spring = (
        // default options
        function spring2() {
          var _ref = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, _ref$stiffness = _ref.stiffness, stiffness = _ref$stiffness === void 0 ? 0.5 : _ref$stiffness, _ref$damping = _ref.damping, damping = _ref$damping === void 0 ? 0.75 : _ref$damping, _ref$mass = _ref.mass, mass = _ref$mass === void 0 ? 10 : _ref$mass;
          var target = null;
          var position = null;
          var velocity = 0;
          var resting = false;
          var interpolate = function interpolate2(ts, skipToEndState) {
            if (resting) return;
            if (!(isNumber(target) && isNumber(position))) {
              resting = true;
              velocity = 0;
              return;
            }
            var f2 = -(position - target) * stiffness;
            velocity += f2 / mass;
            position += velocity;
            velocity *= damping;
            if (thereYet(position, target, velocity) || skipToEndState) {
              position = target;
              velocity = 0;
              resting = true;
              api.onupdate(position);
              api.oncomplete(position);
            } else {
              api.onupdate(position);
            }
          };
          var setTarget = function setTarget2(value) {
            if (isNumber(value) && !isNumber(position)) {
              position = value;
            }
            if (target === null) {
              target = value;
              position = value;
            }
            target = value;
            if (position === target || typeof target === "undefined") {
              resting = true;
              velocity = 0;
              api.onupdate(position);
              api.oncomplete(position);
              return;
            }
            resting = false;
          };
          var api = createObject({
            interpolate,
            target: {
              set: setTarget,
              get: function get() {
                return target;
              }
            },
            resting: {
              get: function get() {
                return resting;
              }
            },
            onupdate: function onupdate(value) {
            },
            oncomplete: function oncomplete(value) {
            }
          });
          return api;
        }
      );
      var easeLinear = function easeLinear2(t) {
        return t;
      };
      var easeInOutQuad = function easeInOutQuad2(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      };
      var tween = (
        // default values
        function tween2() {
          var _ref = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, _ref$duration = _ref.duration, duration = _ref$duration === void 0 ? 500 : _ref$duration, _ref$easing = _ref.easing, easing = _ref$easing === void 0 ? easeInOutQuad : _ref$easing, _ref$delay = _ref.delay, delay = _ref$delay === void 0 ? 0 : _ref$delay;
          var start2 = null;
          var t;
          var p2;
          var resting = true;
          var reverse = false;
          var target = null;
          var interpolate = function interpolate2(ts, skipToEndState) {
            if (resting || target === null) return;
            if (start2 === null) {
              start2 = ts;
            }
            if (ts - start2 < delay) return;
            t = ts - start2 - delay;
            if (t >= duration || skipToEndState) {
              t = 1;
              p2 = reverse ? 0 : 1;
              api.onupdate(p2 * target);
              api.oncomplete(p2 * target);
              resting = true;
            } else {
              p2 = t / duration;
              api.onupdate((t >= 0 ? easing(reverse ? 1 - p2 : p2) : 0) * target);
            }
          };
          var api = createObject({
            interpolate,
            target: {
              get: function get() {
                return reverse ? 0 : target;
              },
              set: function set2(value) {
                if (target === null) {
                  target = value;
                  api.onupdate(value);
                  api.oncomplete(value);
                  return;
                }
                if (value < target) {
                  target = 1;
                  reverse = true;
                } else {
                  reverse = false;
                  target = value;
                }
                resting = false;
                start2 = null;
              }
            },
            resting: {
              get: function get() {
                return resting;
              }
            },
            onupdate: function onupdate(value) {
            },
            oncomplete: function oncomplete(value) {
            }
          });
          return api;
        }
      );
      var animator = {
        spring,
        tween
      };
      var createAnimator = function createAnimator2(definition, category, property) {
        var def = definition[category] && typeof definition[category][property] === "object" ? definition[category][property] : definition[category] || definition;
        var type = typeof def === "string" ? def : def.type;
        var props = typeof def === "object" ? Object.assign({}, def) : {};
        return animator[type] ? animator[type](props) : null;
      };
      var addGetSet = function addGetSet2(keys, obj, props) {
        var overwrite = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : false;
        obj = Array.isArray(obj) ? obj : [obj];
        obj.forEach(function(o) {
          keys.forEach(function(key) {
            var name2 = key;
            var getter = function getter2() {
              return props[key];
            };
            var setter = function setter2(value) {
              return props[key] = value;
            };
            if (typeof key === "object") {
              name2 = key.key;
              getter = key.getter || getter;
              setter = key.setter || setter;
            }
            if (o[name2] && !overwrite) {
              return;
            }
            o[name2] = {
              get: getter,
              set: setter
            };
          });
        });
      };
      var animations = function animations2(_ref) {
        var mixinConfig = _ref.mixinConfig, viewProps = _ref.viewProps, viewInternalAPI = _ref.viewInternalAPI, viewExternalAPI = _ref.viewExternalAPI;
        var initialProps = Object.assign({}, viewProps);
        var animations3 = [];
        forin(mixinConfig, function(property, animation) {
          var animator2 = createAnimator(animation);
          if (!animator2) {
            return;
          }
          animator2.onupdate = function(value) {
            viewProps[property] = value;
          };
          animator2.target = initialProps[property];
          var prop = {
            key: property,
            setter: function setter(value) {
              if (animator2.target === value) {
                return;
              }
              animator2.target = value;
            },
            getter: function getter() {
              return viewProps[property];
            }
          };
          addGetSet([prop], [viewInternalAPI, viewExternalAPI], viewProps, true);
          animations3.push(animator2);
        });
        return {
          write: function write3(ts) {
            var skipToEndState = document.hidden;
            var resting = true;
            animations3.forEach(function(animation) {
              if (!animation.resting) resting = false;
              animation.interpolate(ts, skipToEndState);
            });
            return resting;
          },
          destroy: function destroy() {
          }
        };
      };
      var addEvent = function addEvent2(element) {
        return function(type, fn3) {
          element.addEventListener(type, fn3);
        };
      };
      var removeEvent = function removeEvent2(element) {
        return function(type, fn3) {
          element.removeEventListener(type, fn3);
        };
      };
      var listeners = function listeners2(_ref) {
        var mixinConfig = _ref.mixinConfig, viewProps = _ref.viewProps, viewInternalAPI = _ref.viewInternalAPI, viewExternalAPI = _ref.viewExternalAPI, viewState = _ref.viewState, view = _ref.view;
        var events = [];
        var add = addEvent(view.element);
        var remove = removeEvent(view.element);
        viewExternalAPI.on = function(type, fn3) {
          events.push({
            type,
            fn: fn3
          });
          add(type, fn3);
        };
        viewExternalAPI.off = function(type, fn3) {
          events.splice(
            events.findIndex(function(event) {
              return event.type === type && event.fn === fn3;
            }),
            1
          );
          remove(type, fn3);
        };
        return {
          write: function write3() {
            return true;
          },
          destroy: function destroy() {
            events.forEach(function(event) {
              remove(event.type, event.fn);
            });
          }
        };
      };
      var apis = function apis2(_ref) {
        var mixinConfig = _ref.mixinConfig, viewProps = _ref.viewProps, viewExternalAPI = _ref.viewExternalAPI;
        addGetSet(mixinConfig, viewExternalAPI, viewProps);
      };
      var isDefined = function isDefined2(value) {
        return value != null;
      };
      var defaults = {
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        translateX: 0,
        translateY: 0,
        rotateX: 0,
        rotateY: 0,
        rotateZ: 0,
        originX: 0,
        originY: 0
      };
      var styles = function styles2(_ref) {
        var mixinConfig = _ref.mixinConfig, viewProps = _ref.viewProps, viewInternalAPI = _ref.viewInternalAPI, viewExternalAPI = _ref.viewExternalAPI, view = _ref.view;
        var initialProps = Object.assign({}, viewProps);
        var currentProps = {};
        addGetSet(mixinConfig, [viewInternalAPI, viewExternalAPI], viewProps);
        var getOffset = function getOffset2() {
          return [viewProps["translateX"] || 0, viewProps["translateY"] || 0];
        };
        var getScale = function getScale2() {
          return [viewProps["scaleX"] || 0, viewProps["scaleY"] || 0];
        };
        var getRect = function getRect2() {
          return view.rect ? getViewRect(view.rect, view.childViews, getOffset(), getScale()) : null;
        };
        viewInternalAPI.rect = { get: getRect };
        viewExternalAPI.rect = { get: getRect };
        mixinConfig.forEach(function(key) {
          viewProps[key] = typeof initialProps[key] === "undefined" ? defaults[key] : initialProps[key];
        });
        return {
          write: function write3() {
            if (!propsHaveChanged(currentProps, viewProps)) {
              return;
            }
            applyStyles2(view.element, viewProps);
            Object.assign(currentProps, Object.assign({}, viewProps));
            return true;
          },
          destroy: function destroy() {
          }
        };
      };
      var propsHaveChanged = function propsHaveChanged2(currentProps, newProps) {
        if (Object.keys(currentProps).length !== Object.keys(newProps).length) {
          return true;
        }
        for (var prop in newProps) {
          if (newProps[prop] !== currentProps[prop]) {
            return true;
          }
        }
        return false;
      };
      var applyStyles2 = function applyStyles3(element, _ref2) {
        var opacity = _ref2.opacity, perspective = _ref2.perspective, translateX = _ref2.translateX, translateY = _ref2.translateY, scaleX = _ref2.scaleX, scaleY = _ref2.scaleY, rotateX = _ref2.rotateX, rotateY = _ref2.rotateY, rotateZ = _ref2.rotateZ, originX = _ref2.originX, originY = _ref2.originY, width = _ref2.width, height = _ref2.height;
        var transforms = "";
        var styles2 = "";
        if (isDefined(originX) || isDefined(originY)) {
          styles2 += "transform-origin: " + (originX || 0) + "px " + (originY || 0) + "px;";
        }
        if (isDefined(perspective)) {
          transforms += "perspective(" + perspective + "px) ";
        }
        if (isDefined(translateX) || isDefined(translateY)) {
          transforms += "translate3d(" + (translateX || 0) + "px, " + (translateY || 0) + "px, 0) ";
        }
        if (isDefined(scaleX) || isDefined(scaleY)) {
          transforms += "scale3d(" + (isDefined(scaleX) ? scaleX : 1) + ", " + (isDefined(scaleY) ? scaleY : 1) + ", 1) ";
        }
        if (isDefined(rotateZ)) {
          transforms += "rotateZ(" + rotateZ + "rad) ";
        }
        if (isDefined(rotateX)) {
          transforms += "rotateX(" + rotateX + "rad) ";
        }
        if (isDefined(rotateY)) {
          transforms += "rotateY(" + rotateY + "rad) ";
        }
        if (transforms.length) {
          styles2 += "transform:" + transforms + ";";
        }
        if (isDefined(opacity)) {
          styles2 += "opacity:" + opacity + ";";
          if (opacity === 0) {
            styles2 += "visibility:hidden;";
          }
          if (opacity < 1) {
            styles2 += "pointer-events:none;";
          }
        }
        if (isDefined(height)) {
          styles2 += "height:" + height + "px;";
        }
        if (isDefined(width)) {
          styles2 += "width:" + width + "px;";
        }
        var elementCurrentStyle = element.elementCurrentStyle || "";
        if (styles2.length !== elementCurrentStyle.length || styles2 !== elementCurrentStyle) {
          element.style.cssText = styles2;
          element.elementCurrentStyle = styles2;
        }
      };
      var Mixins = {
        styles,
        listeners,
        animations,
        apis
      };
      var updateRect = function updateRect2() {
        var rect = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        var element = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        var style = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        if (!element.layoutCalculated) {
          rect.paddingTop = parseInt(style.paddingTop, 10) || 0;
          rect.marginTop = parseInt(style.marginTop, 10) || 0;
          rect.marginRight = parseInt(style.marginRight, 10) || 0;
          rect.marginBottom = parseInt(style.marginBottom, 10) || 0;
          rect.marginLeft = parseInt(style.marginLeft, 10) || 0;
          element.layoutCalculated = true;
        }
        rect.left = element.offsetLeft || 0;
        rect.top = element.offsetTop || 0;
        rect.width = element.offsetWidth || 0;
        rect.height = element.offsetHeight || 0;
        rect.right = rect.left + rect.width;
        rect.bottom = rect.top + rect.height;
        rect.scrollTop = element.scrollTop;
        rect.hidden = element.offsetParent === null;
        return rect;
      };
      var createView = (
        // default view definition
        function createView2() {
          var _ref = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, _ref$tag = _ref.tag, tag = _ref$tag === void 0 ? "div" : _ref$tag, _ref$name = _ref.name, name2 = _ref$name === void 0 ? null : _ref$name, _ref$attributes = _ref.attributes, attributes = _ref$attributes === void 0 ? {} : _ref$attributes, _ref$read = _ref.read, read2 = _ref$read === void 0 ? function() {
          } : _ref$read, _ref$write = _ref.write, write3 = _ref$write === void 0 ? function() {
          } : _ref$write, _ref$create = _ref.create, create2 = _ref$create === void 0 ? function() {
          } : _ref$create, _ref$destroy = _ref.destroy, destroy = _ref$destroy === void 0 ? function() {
          } : _ref$destroy, _ref$filterFrameActio = _ref.filterFrameActionsForChild, filterFrameActionsForChild = _ref$filterFrameActio === void 0 ? function(child, actions2) {
            return actions2;
          } : _ref$filterFrameActio, _ref$didCreateView = _ref.didCreateView, didCreateView = _ref$didCreateView === void 0 ? function() {
          } : _ref$didCreateView, _ref$didWriteView = _ref.didWriteView, didWriteView = _ref$didWriteView === void 0 ? function() {
          } : _ref$didWriteView, _ref$ignoreRect = _ref.ignoreRect, ignoreRect = _ref$ignoreRect === void 0 ? false : _ref$ignoreRect, _ref$ignoreRectUpdate = _ref.ignoreRectUpdate, ignoreRectUpdate = _ref$ignoreRectUpdate === void 0 ? false : _ref$ignoreRectUpdate, _ref$mixins = _ref.mixins, mixins = _ref$mixins === void 0 ? [] : _ref$mixins;
          return function(store) {
            var props = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
            var element = createElement(tag, "filepond--" + name2, attributes);
            var style = window.getComputedStyle(element, null);
            var rect = updateRect();
            var frameRect = null;
            var isResting = false;
            var childViews = [];
            var activeMixins = [];
            var ref = {};
            var state2 = {};
            var writers = [
              write3
              // default writer
            ];
            var readers = [
              read2
              // default reader
            ];
            var destroyers = [
              destroy
              // default destroy
            ];
            var getElement2 = function getElement3() {
              return element;
            };
            var getChildViews = function getChildViews2() {
              return childViews.concat();
            };
            var getReference = function getReference2() {
              return ref;
            };
            var createChildView = function createChildView2(store2) {
              return function(view, props2) {
                return view(store2, props2);
              };
            };
            var getRect = function getRect2() {
              if (frameRect) {
                return frameRect;
              }
              frameRect = getViewRect(rect, childViews, [0, 0], [1, 1]);
              return frameRect;
            };
            var getStyle = function getStyle2() {
              return style;
            };
            var _read = function _read2() {
              frameRect = null;
              childViews.forEach(function(child) {
                return child._read();
              });
              var shouldUpdate = !(ignoreRectUpdate && rect.width && rect.height);
              if (shouldUpdate) {
                updateRect(rect, element, style);
              }
              var api = { root: internalAPI, props, rect };
              readers.forEach(function(reader) {
                return reader(api);
              });
            };
            var _write = function _write2(ts, frameActions, shouldOptimize) {
              var resting = frameActions.length === 0;
              writers.forEach(function(writer) {
                var writerResting = writer({
                  props,
                  root: internalAPI,
                  actions: frameActions,
                  timestamp: ts,
                  shouldOptimize
                });
                if (writerResting === false) {
                  resting = false;
                }
              });
              activeMixins.forEach(function(mixin) {
                var mixinResting = mixin.write(ts);
                if (mixinResting === false) {
                  resting = false;
                }
              });
              childViews.filter(function(child) {
                return !!child.element.parentNode;
              }).forEach(function(child) {
                var childResting = child._write(
                  ts,
                  filterFrameActionsForChild(child, frameActions),
                  shouldOptimize
                );
                if (!childResting) {
                  resting = false;
                }
              });
              childViews.forEach(function(child, index) {
                if (child.element.parentNode) {
                  return;
                }
                internalAPI.appendChild(child.element, index);
                child._read();
                child._write(
                  ts,
                  filterFrameActionsForChild(child, frameActions),
                  shouldOptimize
                );
                resting = false;
              });
              isResting = resting;
              didWriteView({
                props,
                root: internalAPI,
                actions: frameActions,
                timestamp: ts
              });
              return resting;
            };
            var _destroy = function _destroy2() {
              activeMixins.forEach(function(mixin) {
                return mixin.destroy();
              });
              destroyers.forEach(function(destroyer) {
                destroyer({ root: internalAPI, props });
              });
              childViews.forEach(function(child) {
                return child._destroy();
              });
            };
            var sharedAPIDefinition = {
              element: {
                get: getElement2
              },
              style: {
                get: getStyle
              },
              childViews: {
                get: getChildViews
              }
            };
            var internalAPIDefinition = Object.assign({}, sharedAPIDefinition, {
              rect: {
                get: getRect
              },
              // access to custom children references
              ref: {
                get: getReference
              },
              // dom modifiers
              is: function is(needle) {
                return name2 === needle;
              },
              appendChild: appendChild(element),
              createChildView: createChildView(store),
              linkView: function linkView(view) {
                childViews.push(view);
                return view;
              },
              unlinkView: function unlinkView(view) {
                childViews.splice(childViews.indexOf(view), 1);
              },
              appendChildView: appendChildView(element, childViews),
              removeChildView: removeChildView(element, childViews),
              registerWriter: function registerWriter(writer) {
                return writers.push(writer);
              },
              registerReader: function registerReader(reader) {
                return readers.push(reader);
              },
              registerDestroyer: function registerDestroyer(destroyer) {
                return destroyers.push(destroyer);
              },
              invalidateLayout: function invalidateLayout() {
                return element.layoutCalculated = false;
              },
              // access to data store
              dispatch: store.dispatch,
              query: store.query
            });
            var externalAPIDefinition = {
              element: {
                get: getElement2
              },
              childViews: {
                get: getChildViews
              },
              rect: {
                get: getRect
              },
              resting: {
                get: function get() {
                  return isResting;
                }
              },
              isRectIgnored: function isRectIgnored() {
                return ignoreRect;
              },
              _read,
              _write,
              _destroy
            };
            var mixinAPIDefinition = Object.assign({}, sharedAPIDefinition, {
              rect: {
                get: function get() {
                  return rect;
                }
              }
            });
            Object.keys(mixins).sort(function(a2, b3) {
              if (a2 === "styles") {
                return 1;
              } else if (b3 === "styles") {
                return -1;
              }
              return 0;
            }).forEach(function(key) {
              var mixinAPI = Mixins[key]({
                mixinConfig: mixins[key],
                viewProps: props,
                viewState: state2,
                viewInternalAPI: internalAPIDefinition,
                viewExternalAPI: externalAPIDefinition,
                view: createObject(mixinAPIDefinition)
              });
              if (mixinAPI) {
                activeMixins.push(mixinAPI);
              }
            });
            var internalAPI = createObject(internalAPIDefinition);
            create2({
              root: internalAPI,
              props
            });
            var childCount = getChildCount(element);
            childViews.forEach(function(child, index) {
              internalAPI.appendChild(child.element, childCount + index);
            });
            didCreateView(internalAPI);
            return createObject(externalAPIDefinition);
          };
        }
      );
      var createPainter = function createPainter2(read2, write3) {
        var fps = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 60;
        var name2 = "__framePainter";
        if (window[name2]) {
          window[name2].readers.push(read2);
          window[name2].writers.push(write3);
          return;
        }
        window[name2] = {
          readers: [read2],
          writers: [write3]
        };
        var painter = window[name2];
        var interval = 1e3 / fps;
        var last = null;
        var id2 = null;
        var requestTick = null;
        var cancelTick = null;
        var setTimerType = function setTimerType2() {
          if (document.hidden) {
            requestTick = function requestTick2() {
              return window.setTimeout(function() {
                return tick(performance.now());
              }, interval);
            };
            cancelTick = function cancelTick2() {
              return window.clearTimeout(id2);
            };
          } else {
            requestTick = function requestTick2() {
              return window.requestAnimationFrame(tick);
            };
            cancelTick = function cancelTick2() {
              return window.cancelAnimationFrame(id2);
            };
          }
        };
        document.addEventListener("visibilitychange", function() {
          if (cancelTick) cancelTick();
          setTimerType();
          tick(performance.now());
        });
        var tick = function tick2(ts) {
          id2 = requestTick(tick2);
          if (!last) {
            last = ts;
          }
          var delta = ts - last;
          if (delta <= interval) {
            return;
          }
          last = ts - delta % interval;
          painter.readers.forEach(function(read3) {
            return read3();
          });
          painter.writers.forEach(function(write4) {
            return write4(ts);
          });
        };
        setTimerType();
        tick(performance.now());
        return {
          pause: function pause() {
            cancelTick(id2);
          }
        };
      };
      var createRoute = function createRoute2(routes, fn3) {
        return function(_ref) {
          var root2 = _ref.root, props = _ref.props, _ref$actions = _ref.actions, actions2 = _ref$actions === void 0 ? [] : _ref$actions, timestamp = _ref.timestamp, shouldOptimize = _ref.shouldOptimize;
          actions2.filter(function(action) {
            return routes[action.type];
          }).forEach(function(action) {
            return routes[action.type]({
              root: root2,
              props,
              action: action.data,
              timestamp,
              shouldOptimize
            });
          });
          if (fn3) {
            fn3({
              root: root2,
              props,
              actions: actions2,
              timestamp,
              shouldOptimize
            });
          }
        };
      };
      var insertBefore = function insertBefore2(newNode, referenceNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode);
      };
      var insertAfter = function insertAfter2(newNode, referenceNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
      };
      var isArray = function isArray2(value) {
        return Array.isArray(value);
      };
      var isEmpty = function isEmpty2(value) {
        return value == null;
      };
      var trim = function trim2(str) {
        return str.trim();
      };
      var toString = function toString2(value) {
        return "" + value;
      };
      var toArray = function toArray2(value) {
        var splitter = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : ",";
        if (isEmpty(value)) {
          return [];
        }
        if (isArray(value)) {
          return value;
        }
        return toString(value).split(splitter).map(trim).filter(function(str) {
          return str.length;
        });
      };
      var isBoolean = function isBoolean2(value) {
        return typeof value === "boolean";
      };
      var toBoolean = function toBoolean2(value) {
        return isBoolean(value) ? value : value === "true";
      };
      var isString = function isString2(value) {
        return typeof value === "string";
      };
      var toNumber = function toNumber2(value) {
        return isNumber(value) ? value : isString(value) ? toString(value).replace(/[a-z]+/gi, "") : 0;
      };
      var toInt = function toInt2(value) {
        return parseInt(toNumber(value), 10);
      };
      var toFloat = function toFloat2(value) {
        return parseFloat(toNumber(value));
      };
      var isInt = function isInt2(value) {
        return isNumber(value) && isFinite(value) && Math.floor(value) === value;
      };
      var toBytes = function toBytes2(value) {
        var base = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1e3;
        if (isInt(value)) {
          return value;
        }
        var naturalFileSize = toString(value).trim();
        if (/MB$/i.test(naturalFileSize)) {
          naturalFileSize = naturalFileSize.replace(/MB$i/, "").trim();
          return toInt(naturalFileSize) * base * base;
        }
        if (/KB/i.test(naturalFileSize)) {
          naturalFileSize = naturalFileSize.replace(/KB$i/, "").trim();
          return toInt(naturalFileSize) * base;
        }
        return toInt(naturalFileSize);
      };
      var isFunction = function isFunction2(value) {
        return typeof value === "function";
      };
      var toFunctionReference = function toFunctionReference2(string) {
        var ref = self;
        var levels = string.split(".");
        var level = null;
        while (level = levels.shift()) {
          ref = ref[level];
          if (!ref) {
            return null;
          }
        }
        return ref;
      };
      var methods = {
        process: "POST",
        patch: "PATCH",
        revert: "DELETE",
        fetch: "GET",
        restore: "GET",
        load: "GET"
      };
      var createServerAPI = function createServerAPI2(outline) {
        var api = {};
        api.url = isString(outline) ? outline : outline.url || "";
        api.timeout = outline.timeout ? parseInt(outline.timeout, 10) : 0;
        api.headers = outline.headers ? outline.headers : {};
        forin(methods, function(key) {
          api[key] = createAction(key, outline[key], methods[key], api.timeout, api.headers);
        });
        api.process = outline.process || isString(outline) || outline.url ? api.process : null;
        api.remove = outline.remove || null;
        delete api.headers;
        return api;
      };
      var createAction = function createAction2(name2, outline, method, timeout, headers) {
        if (outline === null) {
          return null;
        }
        if (typeof outline === "function") {
          return outline;
        }
        var action = {
          url: method === "GET" || method === "PATCH" ? "?" + name2 + "=" : "",
          method,
          headers,
          withCredentials: false,
          timeout,
          onload: null,
          ondata: null,
          onerror: null
        };
        if (isString(outline)) {
          action.url = outline;
          return action;
        }
        Object.assign(action, outline);
        if (isString(action.headers)) {
          var parts = action.headers.split(/:(.+)/);
          action.headers = {
            header: parts[0],
            value: parts[1]
          };
        }
        action.withCredentials = toBoolean(action.withCredentials);
        return action;
      };
      var toServerAPI = function toServerAPI2(value) {
        return createServerAPI(value);
      };
      var isNull = function isNull2(value) {
        return value === null;
      };
      var isObject = function isObject2(value) {
        return typeof value === "object" && value !== null;
      };
      var isAPI = function isAPI2(value) {
        return isObject(value) && isString(value.url) && isObject(value.process) && isObject(value.revert) && isObject(value.restore) && isObject(value.fetch);
      };
      var getType = function getType2(value) {
        if (isArray(value)) {
          return "array";
        }
        if (isNull(value)) {
          return "null";
        }
        if (isInt(value)) {
          return "int";
        }
        if (/^[0-9]+ ?(?:GB|MB|KB)$/gi.test(value)) {
          return "bytes";
        }
        if (isAPI(value)) {
          return "api";
        }
        return typeof value;
      };
      var replaceSingleQuotes = function replaceSingleQuotes2(str) {
        return str.replace(/{\s*'/g, '{"').replace(/'\s*}/g, '"}').replace(/'\s*:/g, '":').replace(/:\s*'/g, ':"').replace(/,\s*'/g, ',"').replace(/'\s*,/g, '",');
      };
      var conversionTable = {
        array: toArray,
        boolean: toBoolean,
        int: function int(value) {
          return getType(value) === "bytes" ? toBytes(value) : toInt(value);
        },
        number: toFloat,
        float: toFloat,
        bytes: toBytes,
        string: function string(value) {
          return isFunction(value) ? value : toString(value);
        },
        function: function _function(value) {
          return toFunctionReference(value);
        },
        serverapi: toServerAPI,
        object: function object(value) {
          try {
            return JSON.parse(replaceSingleQuotes(value));
          } catch (e) {
            return null;
          }
        }
      };
      var convertTo = function convertTo2(value, type) {
        return conversionTable[type](value);
      };
      var getValueByType = function getValueByType2(newValue, defaultValue, valueType) {
        if (newValue === defaultValue) {
          return newValue;
        }
        var newValueType = getType(newValue);
        if (newValueType !== valueType) {
          var convertedValue = convertTo(newValue, valueType);
          newValueType = getType(convertedValue);
          if (convertedValue === null) {
            throw 'Trying to assign value with incorrect type to "' + option + '", allowed type: "' + valueType + '"';
          } else {
            newValue = convertedValue;
          }
        }
        return newValue;
      };
      var createOption = function createOption2(defaultValue, valueType) {
        var currentValue = defaultValue;
        return {
          enumerable: true,
          get: function get() {
            return currentValue;
          },
          set: function set2(newValue) {
            currentValue = getValueByType(newValue, defaultValue, valueType);
          }
        };
      };
      var createOptions = function createOptions2(options) {
        var obj = {};
        forin(options, function(prop) {
          var optionDefinition = options[prop];
          obj[prop] = createOption(optionDefinition[0], optionDefinition[1]);
        });
        return createObject(obj);
      };
      var createInitialState = function createInitialState2(options) {
        return {
          // model
          items: [],
          // timeout used for calling update items
          listUpdateTimeout: null,
          // timeout used for stacking metadata updates
          itemUpdateTimeout: null,
          // queue of items waiting to be processed
          processingQueue: [],
          // options
          options: createOptions(options)
        };
      };
      var fromCamels = function fromCamels2(string) {
        var separator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "-";
        return string.split(/(?=[A-Z])/).map(function(part) {
          return part.toLowerCase();
        }).join(separator);
      };
      var createOptionAPI = function createOptionAPI2(store, options) {
        var obj = {};
        forin(options, function(key) {
          obj[key] = {
            get: function get() {
              return store.getState().options[key];
            },
            set: function set2(value) {
              store.dispatch("SET_" + fromCamels(key, "_").toUpperCase(), {
                value
              });
            }
          };
        });
        return obj;
      };
      var createOptionActions = function createOptionActions2(options) {
        return function(dispatch2, query, state2) {
          var obj = {};
          forin(options, function(key) {
            var name2 = fromCamels(key, "_").toUpperCase();
            obj["SET_" + name2] = function(action) {
              try {
                state2.options[key] = action.value;
              } catch (e) {
              }
              dispatch2("DID_SET_" + name2, { value: state2.options[key] });
            };
          });
          return obj;
        };
      };
      var createOptionQueries = function createOptionQueries2(options) {
        return function(state2) {
          var obj = {};
          forin(options, function(key) {
            obj["GET_" + fromCamels(key, "_").toUpperCase()] = function(action) {
              return state2.options[key];
            };
          });
          return obj;
        };
      };
      var InteractionMethod = {
        API: 1,
        DROP: 2,
        BROWSE: 3,
        PASTE: 4,
        NONE: 5
      };
      var getUniqueId = function getUniqueId2() {
        return Math.random().toString(36).substring(2, 11);
      };
      function _typeof(obj) {
        if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
          _typeof = function(obj2) {
            return typeof obj2;
          };
        } else {
          _typeof = function(obj2) {
            return obj2 && typeof Symbol === "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
          };
        }
        return _typeof(obj);
      }
      var REACT_ELEMENT_TYPE;
      function _jsx(type, props, key, children) {
        if (!REACT_ELEMENT_TYPE) {
          REACT_ELEMENT_TYPE = typeof Symbol === "function" && Symbol["for"] && Symbol["for"]("react.element") || 60103;
        }
        var defaultProps = type && type.defaultProps;
        var childrenLength = arguments.length - 3;
        if (!props && childrenLength !== 0) {
          props = {
            children: void 0
          };
        }
        if (props && defaultProps) {
          for (var propName in defaultProps) {
            if (props[propName] === void 0) {
              props[propName] = defaultProps[propName];
            }
          }
        } else if (!props) {
          props = defaultProps || {};
        }
        if (childrenLength === 1) {
          props.children = children;
        } else if (childrenLength > 1) {
          var childArray = new Array(childrenLength);
          for (var i = 0; i < childrenLength; i++) {
            childArray[i] = arguments[i + 3];
          }
          props.children = childArray;
        }
        return {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key: key === void 0 ? null : "" + key,
          ref: null,
          props,
          _owner: null
        };
      }
      function _asyncIterator(iterable) {
        var method;
        if (typeof Symbol !== "undefined") {
          if (Symbol.asyncIterator) {
            method = iterable[Symbol.asyncIterator];
            if (method != null) return method.call(iterable);
          }
          if (Symbol.iterator) {
            method = iterable[Symbol.iterator];
            if (method != null) return method.call(iterable);
          }
        }
        throw new TypeError("Object is not async iterable");
      }
      function _AwaitValue(value) {
        this.wrapped = value;
      }
      function _AsyncGenerator(gen) {
        var front, back;
        function send(key, arg) {
          return new Promise(function(resolve, reject) {
            var request = {
              key,
              arg,
              resolve,
              reject,
              next: null
            };
            if (back) {
              back = back.next = request;
            } else {
              front = back = request;
              resume(key, arg);
            }
          });
        }
        function resume(key, arg) {
          try {
            var result = gen[key](arg);
            var value = result.value;
            var wrappedAwait = value instanceof _AwaitValue;
            Promise.resolve(wrappedAwait ? value.wrapped : value).then(
              function(arg2) {
                if (wrappedAwait) {
                  resume("next", arg2);
                  return;
                }
                settle(result.done ? "return" : "normal", arg2);
              },
              function(err) {
                resume("throw", err);
              }
            );
          } catch (err) {
            settle("throw", err);
          }
        }
        function settle(type, value) {
          switch (type) {
            case "return":
              front.resolve({
                value,
                done: true
              });
              break;
            case "throw":
              front.reject(value);
              break;
            default:
              front.resolve({
                value,
                done: false
              });
              break;
          }
          front = front.next;
          if (front) {
            resume(front.key, front.arg);
          } else {
            back = null;
          }
        }
        this._invoke = send;
        if (typeof gen.return !== "function") {
          this.return = void 0;
        }
      }
      if (typeof Symbol === "function" && Symbol.asyncIterator) {
        _AsyncGenerator.prototype[Symbol.asyncIterator] = function() {
          return this;
        };
      }
      _AsyncGenerator.prototype.next = function(arg) {
        return this._invoke("next", arg);
      };
      _AsyncGenerator.prototype.throw = function(arg) {
        return this._invoke("throw", arg);
      };
      _AsyncGenerator.prototype.return = function(arg) {
        return this._invoke("return", arg);
      };
      function _wrapAsyncGenerator(fn3) {
        return function() {
          return new _AsyncGenerator(fn3.apply(this, arguments));
        };
      }
      function _awaitAsyncGenerator(value) {
        return new _AwaitValue(value);
      }
      function _asyncGeneratorDelegate(inner, awaitWrap) {
        var iter = {}, waiting = false;
        function pump(key, value) {
          waiting = true;
          value = new Promise(function(resolve) {
            resolve(inner[key](value));
          });
          return {
            done: false,
            value: awaitWrap(value)
          };
        }
        if (typeof Symbol === "function" && Symbol.iterator) {
          iter[Symbol.iterator] = function() {
            return this;
          };
        }
        iter.next = function(value) {
          if (waiting) {
            waiting = false;
            return value;
          }
          return pump("next", value);
        };
        if (typeof inner.throw === "function") {
          iter.throw = function(value) {
            if (waiting) {
              waiting = false;
              throw value;
            }
            return pump("throw", value);
          };
        }
        if (typeof inner.return === "function") {
          iter.return = function(value) {
            return pump("return", value);
          };
        }
        return iter;
      }
      function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error2) {
          reject(error2);
          return;
        }
        if (info.done) {
          resolve(value);
        } else {
          Promise.resolve(value).then(_next, _throw);
        }
      }
      function _asyncToGenerator(fn3) {
        return function() {
          var self2 = this, args = arguments;
          return new Promise(function(resolve, reject) {
            var gen = fn3.apply(self2, args);
            function _next(value) {
              asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
              asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(void 0);
          });
        };
      }
      function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
          throw new TypeError("Cannot call a class as a function");
        }
      }
      function _defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor) descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }
      function _createClass(Constructor, protoProps, staticProps) {
        if (protoProps) _defineProperties(Constructor.prototype, protoProps);
        if (staticProps) _defineProperties(Constructor, staticProps);
        return Constructor;
      }
      function _defineEnumerableProperties(obj, descs) {
        for (var key in descs) {
          var desc = descs[key];
          desc.configurable = desc.enumerable = true;
          if ("value" in desc) desc.writable = true;
          Object.defineProperty(obj, key, desc);
        }
        if (Object.getOwnPropertySymbols) {
          var objectSymbols = Object.getOwnPropertySymbols(descs);
          for (var i = 0; i < objectSymbols.length; i++) {
            var sym = objectSymbols[i];
            var desc = descs[sym];
            desc.configurable = desc.enumerable = true;
            if ("value" in desc) desc.writable = true;
            Object.defineProperty(obj, sym, desc);
          }
        }
        return obj;
      }
      function _defaults(obj, defaults2) {
        var keys = Object.getOwnPropertyNames(defaults2);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var value = Object.getOwnPropertyDescriptor(defaults2, key);
          if (value && value.configurable && obj[key] === void 0) {
            Object.defineProperty(obj, key, value);
          }
        }
        return obj;
      }
      function _defineProperty(obj, key, value) {
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      }
      function _extends() {
        _extends = Object.assign || function(target) {
          for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            for (var key in source) {
              if (Object.prototype.hasOwnProperty.call(source, key)) {
                target[key] = source[key];
              }
            }
          }
          return target;
        };
        return _extends.apply(this, arguments);
      }
      function _objectSpread(target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i] != null ? arguments[i] : {};
          var ownKeys2 = Object.keys(source);
          if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys2 = ownKeys2.concat(
              Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
              })
            );
          }
          ownKeys2.forEach(function(key) {
            _defineProperty(target, key, source[key]);
          });
        }
        return target;
      }
      function ownKeys(object, enumerableOnly) {
        var keys = Object.keys(object);
        if (Object.getOwnPropertySymbols) {
          var symbols = Object.getOwnPropertySymbols(object);
          if (enumerableOnly)
            symbols = symbols.filter(function(sym) {
              return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
          keys.push.apply(keys, symbols);
        }
        return keys;
      }
      function _objectSpread2(target) {
        for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i] != null ? arguments[i] : {};
          if (i % 2) {
            ownKeys(source, true).forEach(function(key) {
              _defineProperty(target, key, source[key]);
            });
          } else if (Object.getOwnPropertyDescriptors) {
            Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
          } else {
            ownKeys(source).forEach(function(key) {
              Object.defineProperty(
                target,
                key,
                Object.getOwnPropertyDescriptor(source, key)
              );
            });
          }
        }
        return target;
      }
      function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
          throw new TypeError("Super expression must either be null or a function");
        }
        subClass.prototype = Object.create(superClass && superClass.prototype, {
          constructor: {
            value: subClass,
            writable: true,
            configurable: true
          }
        });
        if (superClass) _setPrototypeOf(subClass, superClass);
      }
      function _inheritsLoose(subClass, superClass) {
        subClass.prototype = Object.create(superClass.prototype);
        subClass.prototype.constructor = subClass;
        subClass.__proto__ = superClass;
      }
      function _getPrototypeOf(o) {
        _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf2(o2) {
          return o2.__proto__ || Object.getPrototypeOf(o2);
        };
        return _getPrototypeOf(o);
      }
      function _setPrototypeOf(o, p2) {
        _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf2(o2, p3) {
          o2.__proto__ = p3;
          return o2;
        };
        return _setPrototypeOf(o, p2);
      }
      function isNativeReflectConstruct() {
        if (typeof Reflect === "undefined" || !Reflect.construct) return false;
        if (Reflect.construct.sham) return false;
        if (typeof Proxy === "function") return true;
        try {
          Date.prototype.toString.call(Reflect.construct(Date, [], function() {
          }));
          return true;
        } catch (e) {
          return false;
        }
      }
      function _construct(Parent, args, Class) {
        if (isNativeReflectConstruct()) {
          _construct = Reflect.construct;
        } else {
          _construct = function _construct2(Parent2, args2, Class2) {
            var a2 = [null];
            a2.push.apply(a2, args2);
            var Constructor = Function.bind.apply(Parent2, a2);
            var instance = new Constructor();
            if (Class2) _setPrototypeOf(instance, Class2.prototype);
            return instance;
          };
        }
        return _construct.apply(null, arguments);
      }
      function _isNativeFunction(fn3) {
        return Function.toString.call(fn3).indexOf("[native code]") !== -1;
      }
      function _wrapNativeSuper(Class) {
        var _cache = typeof Map === "function" ? /* @__PURE__ */ new Map() : void 0;
        _wrapNativeSuper = function _wrapNativeSuper2(Class2) {
          if (Class2 === null || !_isNativeFunction(Class2)) return Class2;
          if (typeof Class2 !== "function") {
            throw new TypeError("Super expression must either be null or a function");
          }
          if (typeof _cache !== "undefined") {
            if (_cache.has(Class2)) return _cache.get(Class2);
            _cache.set(Class2, Wrapper);
          }
          function Wrapper() {
            return _construct(Class2, arguments, _getPrototypeOf(this).constructor);
          }
          Wrapper.prototype = Object.create(Class2.prototype, {
            constructor: {
              value: Wrapper,
              enumerable: false,
              writable: true,
              configurable: true
            }
          });
          return _setPrototypeOf(Wrapper, Class2);
        };
        return _wrapNativeSuper(Class);
      }
      function _instanceof(left2, right2) {
        if (right2 != null && typeof Symbol !== "undefined" && right2[Symbol.hasInstance]) {
          return !!right2[Symbol.hasInstance](left2);
        } else {
          return left2 instanceof right2;
        }
      }
      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
          default: obj
        };
      }
      function _interopRequireWildcard(obj) {
        if (obj && obj.__esModule) {
          return obj;
        } else {
          var newObj = {};
          if (obj != null) {
            for (var key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {};
                if (desc.get || desc.set) {
                  Object.defineProperty(newObj, key, desc);
                } else {
                  newObj[key] = obj[key];
                }
              }
            }
          }
          newObj.default = obj;
          return newObj;
        }
      }
      function _newArrowCheck(innerThis, boundThis) {
        if (innerThis !== boundThis) {
          throw new TypeError("Cannot instantiate an arrow function");
        }
      }
      function _objectDestructuringEmpty(obj) {
        if (obj == null) throw new TypeError("Cannot destructure undefined");
      }
      function _objectWithoutPropertiesLoose(source, excluded) {
        if (source == null) return {};
        var target = {};
        var sourceKeys = Object.keys(source);
        var key, i;
        for (i = 0; i < sourceKeys.length; i++) {
          key = sourceKeys[i];
          if (excluded.indexOf(key) >= 0) continue;
          target[key] = source[key];
        }
        return target;
      }
      function _objectWithoutProperties(source, excluded) {
        if (source == null) return {};
        var target = _objectWithoutPropertiesLoose(source, excluded);
        var key, i;
        if (Object.getOwnPropertySymbols) {
          var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
          for (i = 0; i < sourceSymbolKeys.length; i++) {
            key = sourceSymbolKeys[i];
            if (excluded.indexOf(key) >= 0) continue;
            if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
            target[key] = source[key];
          }
        }
        return target;
      }
      function _assertThisInitialized(self2) {
        if (self2 === void 0) {
          throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }
        return self2;
      }
      function _possibleConstructorReturn(self2, call) {
        if (call && (typeof call === "object" || typeof call === "function")) {
          return call;
        }
        return _assertThisInitialized(self2);
      }
      function _superPropBase(object, property) {
        while (!Object.prototype.hasOwnProperty.call(object, property)) {
          object = _getPrototypeOf(object);
          if (object === null) break;
        }
        return object;
      }
      function _get(target, property, receiver) {
        if (typeof Reflect !== "undefined" && Reflect.get) {
          _get = Reflect.get;
        } else {
          _get = function _get2(target2, property2, receiver2) {
            var base = _superPropBase(target2, property2);
            if (!base) return;
            var desc = Object.getOwnPropertyDescriptor(base, property2);
            if (desc.get) {
              return desc.get.call(receiver2);
            }
            return desc.value;
          };
        }
        return _get(target, property, receiver || target);
      }
      function set(target, property, value, receiver) {
        if (typeof Reflect !== "undefined" && Reflect.set) {
          set = Reflect.set;
        } else {
          set = function set2(target2, property2, value2, receiver2) {
            var base = _superPropBase(target2, property2);
            var desc;
            if (base) {
              desc = Object.getOwnPropertyDescriptor(base, property2);
              if (desc.set) {
                desc.set.call(receiver2, value2);
                return true;
              } else if (!desc.writable) {
                return false;
              }
            }
            desc = Object.getOwnPropertyDescriptor(receiver2, property2);
            if (desc) {
              if (!desc.writable) {
                return false;
              }
              desc.value = value2;
              Object.defineProperty(receiver2, property2, desc);
            } else {
              _defineProperty(receiver2, property2, value2);
            }
            return true;
          };
        }
        return set(target, property, value, receiver);
      }
      function _set(target, property, value, receiver, isStrict) {
        var s = set(target, property, value, receiver || target);
        if (!s && isStrict) {
          throw new Error("failed to set property");
        }
        return value;
      }
      function _taggedTemplateLiteral(strings, raw) {
        if (!raw) {
          raw = strings.slice(0);
        }
        return Object.freeze(
          Object.defineProperties(strings, {
            raw: {
              value: Object.freeze(raw)
            }
          })
        );
      }
      function _taggedTemplateLiteralLoose(strings, raw) {
        if (!raw) {
          raw = strings.slice(0);
        }
        strings.raw = raw;
        return strings;
      }
      function _temporalRef(val, name2) {
        if (val === _temporalUndefined) {
          throw new ReferenceError(name2 + " is not defined - temporal dead zone");
        } else {
          return val;
        }
      }
      function _readOnlyError(name2) {
        throw new Error('"' + name2 + '" is read-only');
      }
      function _classNameTDZError(name2) {
        throw new Error('Class "' + name2 + '" cannot be referenced in computed property keys.');
      }
      var _temporalUndefined = {};
      function _slicedToArray(arr, i) {
        return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
      }
      function _slicedToArrayLoose(arr, i) {
        return _arrayWithHoles(arr) || _iterableToArrayLimitLoose(arr, i) || _nonIterableRest();
      }
      function _toArray(arr) {
        return _arrayWithHoles(arr) || _iterableToArray(arr) || _nonIterableRest();
      }
      function _toConsumableArray(arr) {
        return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
      }
      function _arrayWithoutHoles(arr) {
        if (Array.isArray(arr)) {
          for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];
          return arr2;
        }
      }
      function _arrayWithHoles(arr) {
        if (Array.isArray(arr)) return arr;
      }
      function _iterableToArray(iter) {
        if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]")
          return Array.from(iter);
      }
      function _iterableToArrayLimit(arr, i) {
        var _arr = [];
        var _n = true;
        var _d = false;
        var _e2 = void 0;
        try {
          for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
          }
        } catch (err) {
          _d = true;
          _e2 = err;
        } finally {
          try {
            if (!_n && _i["return"] != null) _i["return"]();
          } finally {
            if (_d) throw _e2;
          }
        }
        return _arr;
      }
      function _iterableToArrayLimitLoose(arr, i) {
        var _arr = [];
        for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done; ) {
          _arr.push(_step.value);
          if (i && _arr.length === i) break;
        }
        return _arr;
      }
      function _nonIterableSpread() {
        throw new TypeError("Invalid attempt to spread non-iterable instance");
      }
      function _nonIterableRest() {
        throw new TypeError("Invalid attempt to destructure non-iterable instance");
      }
      function _skipFirstGeneratorNext(fn3) {
        return function() {
          var it = fn3.apply(this, arguments);
          it.next();
          return it;
        };
      }
      function _toPrimitive(input, hint) {
        if (typeof input !== "object" || input === null) return input;
        var prim = input[Symbol.toPrimitive];
        if (prim !== void 0) {
          var res2 = prim.call(input, hint || "default");
          if (typeof res2 !== "object") return res2;
          throw new TypeError("@@toPrimitive must return a primitive value.");
        }
        return (hint === "string" ? String : Number)(input);
      }
      function _toPropertyKey(arg) {
        var key = _toPrimitive(arg, "string");
        return typeof key === "symbol" ? key : String(key);
      }
      function _initializerWarningHelper(descriptor, context) {
        throw new Error(
          "Decorating class property failed. Please ensure that proposal-class-properties is enabled and set to use loose mode. To use proposal-class-properties in spec mode with decorators, wait for the next major version of decorators in stage 2."
        );
      }
      function _initializerDefineProperty(target, property, descriptor, context) {
        if (!descriptor) return;
        Object.defineProperty(target, property, {
          enumerable: descriptor.enumerable,
          configurable: descriptor.configurable,
          writable: descriptor.writable,
          value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
        });
      }
      function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
        var desc = {};
        Object.keys(descriptor).forEach(function(key) {
          desc[key] = descriptor[key];
        });
        desc.enumerable = !!desc.enumerable;
        desc.configurable = !!desc.configurable;
        if ("value" in desc || desc.initializer) {
          desc.writable = true;
        }
        desc = decorators.slice().reverse().reduce(function(desc2, decorator) {
          return decorator(target, property, desc2) || desc2;
        }, desc);
        if (context && desc.initializer !== void 0) {
          desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
          desc.initializer = void 0;
        }
        if (desc.initializer === void 0) {
          Object.defineProperty(target, property, desc);
          desc = null;
        }
        return desc;
      }
      var id = 0;
      function _classPrivateFieldLooseKey(name2) {
        return "__private_" + id++ + "_" + name2;
      }
      function _classPrivateFieldLooseBase(receiver, privateKey) {
        if (!Object.prototype.hasOwnProperty.call(receiver, privateKey)) {
          throw new TypeError("attempted to use private field on non-instance");
        }
        return receiver;
      }
      function _classPrivateFieldGet(receiver, privateMap) {
        var descriptor = privateMap.get(receiver);
        if (!descriptor) {
          throw new TypeError("attempted to get private field on non-instance");
        }
        if (descriptor.get) {
          return descriptor.get.call(receiver);
        }
        return descriptor.value;
      }
      function _classPrivateFieldSet(receiver, privateMap, value) {
        var descriptor = privateMap.get(receiver);
        if (!descriptor) {
          throw new TypeError("attempted to set private field on non-instance");
        }
        if (descriptor.set) {
          descriptor.set.call(receiver, value);
        } else {
          if (!descriptor.writable) {
            throw new TypeError("attempted to set read only private field");
          }
          descriptor.value = value;
        }
        return value;
      }
      function _classPrivateFieldDestructureSet(receiver, privateMap) {
        if (!privateMap.has(receiver)) {
          throw new TypeError("attempted to set private field on non-instance");
        }
        var descriptor = privateMap.get(receiver);
        if (descriptor.set) {
          if (!("__destrObj" in descriptor)) {
            descriptor.__destrObj = {
              set value(v2) {
                descriptor.set.call(receiver, v2);
              }
            };
          }
          return descriptor.__destrObj;
        } else {
          if (!descriptor.writable) {
            throw new TypeError("attempted to set read only private field");
          }
          return descriptor;
        }
      }
      function _classStaticPrivateFieldSpecGet(receiver, classConstructor, descriptor) {
        if (receiver !== classConstructor) {
          throw new TypeError("Private static access of wrong provenance");
        }
        return descriptor.value;
      }
      function _classStaticPrivateFieldSpecSet(receiver, classConstructor, descriptor, value) {
        if (receiver !== classConstructor) {
          throw new TypeError("Private static access of wrong provenance");
        }
        if (!descriptor.writable) {
          throw new TypeError("attempted to set read only private field");
        }
        descriptor.value = value;
        return value;
      }
      function _classStaticPrivateMethodGet(receiver, classConstructor, method) {
        if (receiver !== classConstructor) {
          throw new TypeError("Private static access of wrong provenance");
        }
        return method;
      }
      function _classStaticPrivateMethodSet() {
        throw new TypeError("attempted to set read only static private field");
      }
      function _decorate(decorators, factory, superClass, mixins) {
        var api = _getDecoratorsApi();
        if (mixins) {
          for (var i = 0; i < mixins.length; i++) {
            api = mixins[i](api);
          }
        }
        var r = factory(function initialize(O3) {
          api.initializeInstanceElements(O3, decorated.elements);
        }, superClass);
        var decorated = api.decorateClass(
          _coalesceClassElements(r.d.map(_createElementDescriptor)),
          decorators
        );
        api.initializeClassElements(r.F, decorated.elements);
        return api.runClassFinishers(r.F, decorated.finishers);
      }
      function _getDecoratorsApi() {
        _getDecoratorsApi = function() {
          return api;
        };
        var api = {
          elementsDefinitionOrder: [["method"], ["field"]],
          initializeInstanceElements: function(O3, elements) {
            ["method", "field"].forEach(function(kind) {
              elements.forEach(function(element) {
                if (element.kind === kind && element.placement === "own") {
                  this.defineClassElement(O3, element);
                }
              }, this);
            }, this);
          },
          initializeClassElements: function(F2, elements) {
            var proto = F2.prototype;
            ["method", "field"].forEach(function(kind) {
              elements.forEach(function(element) {
                var placement = element.placement;
                if (element.kind === kind && (placement === "static" || placement === "prototype")) {
                  var receiver = placement === "static" ? F2 : proto;
                  this.defineClassElement(receiver, element);
                }
              }, this);
            }, this);
          },
          defineClassElement: function(receiver, element) {
            var descriptor = element.descriptor;
            if (element.kind === "field") {
              var initializer = element.initializer;
              descriptor = {
                enumerable: descriptor.enumerable,
                writable: descriptor.writable,
                configurable: descriptor.configurable,
                value: initializer === void 0 ? void 0 : initializer.call(receiver)
              };
            }
            Object.defineProperty(receiver, element.key, descriptor);
          },
          decorateClass: function(elements, decorators) {
            var newElements = [];
            var finishers = [];
            var placements2 = {
              static: [],
              prototype: [],
              own: []
            };
            elements.forEach(function(element) {
              this.addElementPlacement(element, placements2);
            }, this);
            elements.forEach(function(element) {
              if (!_hasDecorators(element)) return newElements.push(element);
              var elementFinishersExtras = this.decorateElement(element, placements2);
              newElements.push(elementFinishersExtras.element);
              newElements.push.apply(newElements, elementFinishersExtras.extras);
              finishers.push.apply(finishers, elementFinishersExtras.finishers);
            }, this);
            if (!decorators) {
              return {
                elements: newElements,
                finishers
              };
            }
            var result = this.decorateConstructor(newElements, decorators);
            finishers.push.apply(finishers, result.finishers);
            result.finishers = finishers;
            return result;
          },
          addElementPlacement: function(element, placements2, silent) {
            var keys = placements2[element.placement];
            if (!silent && keys.indexOf(element.key) !== -1) {
              throw new TypeError("Duplicated element (" + element.key + ")");
            }
            keys.push(element.key);
          },
          decorateElement: function(element, placements2) {
            var extras = [];
            var finishers = [];
            for (var decorators = element.decorators, i = decorators.length - 1; i >= 0; i--) {
              var keys = placements2[element.placement];
              keys.splice(keys.indexOf(element.key), 1);
              var elementObject = this.fromElementDescriptor(element);
              var elementFinisherExtras = this.toElementFinisherExtras(
                (0, decorators[i])(elementObject) || elementObject
              );
              element = elementFinisherExtras.element;
              this.addElementPlacement(element, placements2);
              if (elementFinisherExtras.finisher) {
                finishers.push(elementFinisherExtras.finisher);
              }
              var newExtras = elementFinisherExtras.extras;
              if (newExtras) {
                for (var j2 = 0; j2 < newExtras.length; j2++) {
                  this.addElementPlacement(newExtras[j2], placements2);
                }
                extras.push.apply(extras, newExtras);
              }
            }
            return {
              element,
              finishers,
              extras
            };
          },
          decorateConstructor: function(elements, decorators) {
            var finishers = [];
            for (var i = decorators.length - 1; i >= 0; i--) {
              var obj = this.fromClassDescriptor(elements);
              var elementsAndFinisher = this.toClassDescriptor(
                (0, decorators[i])(obj) || obj
              );
              if (elementsAndFinisher.finisher !== void 0) {
                finishers.push(elementsAndFinisher.finisher);
              }
              if (elementsAndFinisher.elements !== void 0) {
                elements = elementsAndFinisher.elements;
                for (var j2 = 0; j2 < elements.length - 1; j2++) {
                  for (var k = j2 + 1; k < elements.length; k++) {
                    if (elements[j2].key === elements[k].key && elements[j2].placement === elements[k].placement) {
                      throw new TypeError(
                        "Duplicated element (" + elements[j2].key + ")"
                      );
                    }
                  }
                }
              }
            }
            return {
              elements,
              finishers
            };
          },
          fromElementDescriptor: function(element) {
            var obj = {
              kind: element.kind,
              key: element.key,
              placement: element.placement,
              descriptor: element.descriptor
            };
            var desc = {
              value: "Descriptor",
              configurable: true
            };
            Object.defineProperty(obj, Symbol.toStringTag, desc);
            if (element.kind === "field") obj.initializer = element.initializer;
            return obj;
          },
          toElementDescriptors: function(elementObjects) {
            if (elementObjects === void 0) return;
            return _toArray(elementObjects).map(function(elementObject) {
              var element = this.toElementDescriptor(elementObject);
              this.disallowProperty(elementObject, "finisher", "An element descriptor");
              this.disallowProperty(elementObject, "extras", "An element descriptor");
              return element;
            }, this);
          },
          toElementDescriptor: function(elementObject) {
            var kind = String(elementObject.kind);
            if (kind !== "method" && kind !== "field") {
              throw new TypeError(
                `An element descriptor's .kind property must be either "method" or "field", but a decorator created an element descriptor with .kind "` + kind + '"'
              );
            }
            var key = _toPropertyKey(elementObject.key);
            var placement = String(elementObject.placement);
            if (placement !== "static" && placement !== "prototype" && placement !== "own") {
              throw new TypeError(
                `An element descriptor's .placement property must be one of "static", "prototype" or "own", but a decorator created an element descriptor with .placement "` + placement + '"'
              );
            }
            var descriptor = elementObject.descriptor;
            this.disallowProperty(elementObject, "elements", "An element descriptor");
            var element = {
              kind,
              key,
              placement,
              descriptor: Object.assign({}, descriptor)
            };
            if (kind !== "field") {
              this.disallowProperty(elementObject, "initializer", "A method descriptor");
            } else {
              this.disallowProperty(
                descriptor,
                "get",
                "The property descriptor of a field descriptor"
              );
              this.disallowProperty(
                descriptor,
                "set",
                "The property descriptor of a field descriptor"
              );
              this.disallowProperty(
                descriptor,
                "value",
                "The property descriptor of a field descriptor"
              );
              element.initializer = elementObject.initializer;
            }
            return element;
          },
          toElementFinisherExtras: function(elementObject) {
            var element = this.toElementDescriptor(elementObject);
            var finisher = _optionalCallableProperty(elementObject, "finisher");
            var extras = this.toElementDescriptors(elementObject.extras);
            return {
              element,
              finisher,
              extras
            };
          },
          fromClassDescriptor: function(elements) {
            var obj = {
              kind: "class",
              elements: elements.map(this.fromElementDescriptor, this)
            };
            var desc = {
              value: "Descriptor",
              configurable: true
            };
            Object.defineProperty(obj, Symbol.toStringTag, desc);
            return obj;
          },
          toClassDescriptor: function(obj) {
            var kind = String(obj.kind);
            if (kind !== "class") {
              throw new TypeError(
                `A class descriptor's .kind property must be "class", but a decorator created a class descriptor with .kind "` + kind + '"'
              );
            }
            this.disallowProperty(obj, "key", "A class descriptor");
            this.disallowProperty(obj, "placement", "A class descriptor");
            this.disallowProperty(obj, "descriptor", "A class descriptor");
            this.disallowProperty(obj, "initializer", "A class descriptor");
            this.disallowProperty(obj, "extras", "A class descriptor");
            var finisher = _optionalCallableProperty(obj, "finisher");
            var elements = this.toElementDescriptors(obj.elements);
            return {
              elements,
              finisher
            };
          },
          runClassFinishers: function(constructor, finishers) {
            for (var i = 0; i < finishers.length; i++) {
              var newConstructor = (0, finishers[i])(constructor);
              if (newConstructor !== void 0) {
                if (typeof newConstructor !== "function") {
                  throw new TypeError("Finishers must return a constructor.");
                }
                constructor = newConstructor;
              }
            }
            return constructor;
          },
          disallowProperty: function(obj, name2, objectType) {
            if (obj[name2] !== void 0) {
              throw new TypeError(objectType + " can't have a ." + name2 + " property.");
            }
          }
        };
        return api;
      }
      function _createElementDescriptor(def) {
        var key = _toPropertyKey(def.key);
        var descriptor;
        if (def.kind === "method") {
          descriptor = {
            value: def.value,
            writable: true,
            configurable: true,
            enumerable: false
          };
        } else if (def.kind === "get") {
          descriptor = {
            get: def.value,
            configurable: true,
            enumerable: false
          };
        } else if (def.kind === "set") {
          descriptor = {
            set: def.value,
            configurable: true,
            enumerable: false
          };
        } else if (def.kind === "field") {
          descriptor = {
            configurable: true,
            writable: true,
            enumerable: true
          };
        }
        var element = {
          kind: def.kind === "field" ? "field" : "method",
          key,
          placement: def.static ? "static" : def.kind === "field" ? "own" : "prototype",
          descriptor
        };
        if (def.decorators) element.decorators = def.decorators;
        if (def.kind === "field") element.initializer = def.value;
        return element;
      }
      function _coalesceGetterSetter(element, other) {
        if (element.descriptor.get !== void 0) {
          other.descriptor.get = element.descriptor.get;
        } else {
          other.descriptor.set = element.descriptor.set;
        }
      }
      function _coalesceClassElements(elements) {
        var newElements = [];
        var isSameElement = function(other2) {
          return other2.kind === "method" && other2.key === element.key && other2.placement === element.placement;
        };
        for (var i = 0; i < elements.length; i++) {
          var element = elements[i];
          var other;
          if (element.kind === "method" && (other = newElements.find(isSameElement))) {
            if (_isDataDescriptor(element.descriptor) || _isDataDescriptor(other.descriptor)) {
              if (_hasDecorators(element) || _hasDecorators(other)) {
                throw new ReferenceError(
                  "Duplicated methods (" + element.key + ") can't be decorated."
                );
              }
              other.descriptor = element.descriptor;
            } else {
              if (_hasDecorators(element)) {
                if (_hasDecorators(other)) {
                  throw new ReferenceError(
                    "Decorators can't be placed on different accessors with for the same property (" + element.key + ")."
                  );
                }
                other.decorators = element.decorators;
              }
              _coalesceGetterSetter(element, other);
            }
          } else {
            newElements.push(element);
          }
        }
        return newElements;
      }
      function _hasDecorators(element) {
        return element.decorators && element.decorators.length;
      }
      function _isDataDescriptor(desc) {
        return desc !== void 0 && !(desc.value === void 0 && desc.writable === void 0);
      }
      function _optionalCallableProperty(obj, name2) {
        var value = obj[name2];
        if (value !== void 0 && typeof value !== "function") {
          throw new TypeError("Expected '" + name2 + "' to be a function");
        }
        return value;
      }
      function _classPrivateMethodGet(receiver, privateSet, fn3) {
        if (!privateSet.has(receiver)) {
          throw new TypeError("attempted to get private field on non-instance");
        }
        return fn3;
      }
      function _classPrivateMethodSet() {
        throw new TypeError("attempted to reassign private method");
      }
      function _wrapRegExp(re2, groups) {
        _wrapRegExp = function(re3, groups2) {
          return new BabelRegExp(re3, groups2);
        };
        var _RegExp = _wrapNativeSuper(RegExp);
        var _super = RegExp.prototype;
        var _groups = /* @__PURE__ */ new WeakMap();
        function BabelRegExp(re3, groups2) {
          var _this = _RegExp.call(this, re3);
          _groups.set(_this, groups2);
          return _this;
        }
        _inherits(BabelRegExp, _RegExp);
        BabelRegExp.prototype.exec = function(str) {
          var result = _super.exec.call(this, str);
          if (result) result.groups = buildGroups(result, this);
          return result;
        };
        BabelRegExp.prototype[Symbol.replace] = function(str, substitution) {
          if (typeof substitution === "string") {
            var groups2 = _groups.get(this);
            return _super[Symbol.replace].call(
              this,
              str,
              substitution.replace(/\$<([^>]+)>/g, function(_3, name2) {
                return "$" + groups2[name2];
              })
            );
          } else if (typeof substitution === "function") {
            var _this = this;
            return _super[Symbol.replace].call(this, str, function() {
              var args = [];
              args.push.apply(args, arguments);
              if (typeof args[args.length - 1] !== "object") {
                args.push(buildGroups(args, _this));
              }
              return substitution.apply(this, args);
            });
          } else {
            return _super[Symbol.replace].call(this, str, substitution);
          }
        };
        function buildGroups(result, re3) {
          var g3 = _groups.get(re3);
          return Object.keys(g3).reduce(function(groups2, name2) {
            groups2[name2] = result[g3[name2]];
            return groups2;
          }, /* @__PURE__ */ Object.create(null));
        }
        return _wrapRegExp.apply(this, arguments);
      }
      var arrayRemove = function arrayRemove2(arr, index) {
        return arr.splice(index, 1);
      };
      var run = function run2(cb, sync) {
        if (sync) {
          cb();
        } else if (document.hidden) {
          Promise.resolve(1).then(cb);
        } else {
          setTimeout(cb, 0);
        }
      };
      var on = function on2() {
        var listeners2 = [];
        var off = function off2(event, cb) {
          arrayRemove(
            listeners2,
            listeners2.findIndex(function(listener) {
              return listener.event === event && (listener.cb === cb || !cb);
            })
          );
        };
        var _fire = function fire(event, args, sync) {
          listeners2.filter(function(listener) {
            return listener.event === event;
          }).map(function(listener) {
            return listener.cb;
          }).forEach(function(cb) {
            return run(function() {
              return cb.apply(void 0, _toConsumableArray(args));
            }, sync);
          });
        };
        return {
          fireSync: function fireSync(event) {
            for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
              args[_key - 1] = arguments[_key];
            }
            _fire(event, args, true);
          },
          fire: function fire(event) {
            for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
              args[_key2 - 1] = arguments[_key2];
            }
            _fire(event, args, false);
          },
          on: function on3(event, cb) {
            listeners2.push({ event, cb });
          },
          onOnce: function onOnce(event, _cb) {
            listeners2.push({
              event,
              cb: function cb() {
                off(event, _cb);
                _cb.apply(void 0, arguments);
              }
            });
          },
          off
        };
      };
      var copyObjectPropertiesToObject = function copyObjectPropertiesToObject2(src, target, excluded) {
        Object.getOwnPropertyNames(src).filter(function(property) {
          return !excluded.includes(property);
        }).forEach(function(key) {
          return Object.defineProperty(
            target,
            key,
            Object.getOwnPropertyDescriptor(src, key)
          );
        });
      };
      var PRIVATE = [
        "fire",
        "process",
        "revert",
        "load",
        "on",
        "off",
        "onOnce",
        "retryLoad",
        "extend",
        "archive",
        "archived",
        "release",
        "released",
        "requestProcessing",
        "freeze"
      ];
      var createItemAPI = function createItemAPI2(item2) {
        var api = {};
        copyObjectPropertiesToObject(item2, api, PRIVATE);
        return api;
      };
      var removeReleasedItems = function removeReleasedItems2(items) {
        items.forEach(function(item2, index) {
          if (item2.released) {
            arrayRemove(items, index);
          }
        });
      };
      var ItemStatus = {
        INIT: 1,
        IDLE: 2,
        PROCESSING_QUEUED: 9,
        PROCESSING: 3,
        PROCESSING_COMPLETE: 5,
        PROCESSING_ERROR: 6,
        PROCESSING_REVERT_ERROR: 10,
        LOADING: 7,
        LOAD_ERROR: 8
      };
      var FileOrigin = {
        INPUT: 1,
        LIMBO: 2,
        LOCAL: 3
      };
      var getNonNumeric = function getNonNumeric2(str) {
        return /[^0-9]+/.exec(str);
      };
      var getDecimalSeparator = function getDecimalSeparator2() {
        return getNonNumeric(1.1.toLocaleString())[0];
      };
      var getThousandsSeparator = function getThousandsSeparator2() {
        var decimalSeparator = getDecimalSeparator();
        var thousandsStringWithSeparator = 1e3.toLocaleString();
        var thousandsStringWithoutSeparator = 1e3.toString();
        if (thousandsStringWithSeparator !== thousandsStringWithoutSeparator) {
          return getNonNumeric(thousandsStringWithSeparator)[0];
        }
        return decimalSeparator === "." ? "," : ".";
      };
      var Type = {
        BOOLEAN: "boolean",
        INT: "int",
        NUMBER: "number",
        STRING: "string",
        ARRAY: "array",
        OBJECT: "object",
        FUNCTION: "function",
        ACTION: "action",
        SERVER_API: "serverapi",
        REGEX: "regex"
      };
      var filters = [];
      var applyFilterChain = function applyFilterChain2(key, value, utils) {
        return new Promise(function(resolve, reject) {
          var matchingFilters = filters.filter(function(f2) {
            return f2.key === key;
          }).map(function(f2) {
            return f2.cb;
          });
          if (matchingFilters.length === 0) {
            resolve(value);
            return;
          }
          var initialFilter = matchingFilters.shift();
          matchingFilters.reduce(
            // loop over promises passing value to next promise
            function(current, next) {
              return current.then(function(value2) {
                return next(value2, utils);
              });
            },
            // call initial filter, will return a promise
            initialFilter(value, utils)
            // all executed
          ).then(function(value2) {
            return resolve(value2);
          }).catch(function(error2) {
            return reject(error2);
          });
        });
      };
      var applyFilters = function applyFilters2(key, value, utils) {
        return filters.filter(function(f2) {
          return f2.key === key;
        }).map(function(f2) {
          return f2.cb(value, utils);
        });
      };
      var addFilter = function addFilter2(key, cb) {
        return filters.push({ key, cb });
      };
      var extendDefaultOptions = function extendDefaultOptions2(additionalOptions) {
        return Object.assign(defaultOptions, additionalOptions);
      };
      var getOptions = function getOptions2() {
        return Object.assign({}, defaultOptions);
      };
      var setOptions = function setOptions2(opts) {
        forin(opts, function(key, value) {
          if (!defaultOptions[key]) {
            return;
          }
          defaultOptions[key][0] = getValueByType(
            value,
            defaultOptions[key][0],
            defaultOptions[key][1]
          );
        });
      };
      var defaultOptions = {
        // the id to add to the root element
        id: [null, Type.STRING],
        // input field name to use
        name: ["filepond", Type.STRING],
        // disable the field
        disabled: [false, Type.BOOLEAN],
        // classname to put on wrapper
        className: [null, Type.STRING],
        // is the field required
        required: [false, Type.BOOLEAN],
        // Allow media capture when value is set
        captureMethod: [null, Type.STRING],
        // - "camera", "microphone" or "camcorder",
        // - Does not work with multiple on apple devices
        // - If set, acceptedFileTypes must be made to match with media wildcard "image/*", "audio/*" or "video/*"
        // sync `acceptedFileTypes` property with `accept` attribute
        allowSyncAcceptAttribute: [true, Type.BOOLEAN],
        // Feature toggles
        allowDrop: [true, Type.BOOLEAN],
        // Allow dropping of files
        allowBrowse: [true, Type.BOOLEAN],
        // Allow browsing the file system
        allowPaste: [true, Type.BOOLEAN],
        // Allow pasting files
        allowMultiple: [false, Type.BOOLEAN],
        // Allow multiple files (disabled by default, as multiple attribute is also required on input to allow multiple)
        allowReplace: [true, Type.BOOLEAN],
        // Allow dropping a file on other file to replace it (only works when multiple is set to false)
        allowRevert: [true, Type.BOOLEAN],
        // Allows user to revert file upload
        allowRemove: [true, Type.BOOLEAN],
        // Allow user to remove a file
        allowProcess: [true, Type.BOOLEAN],
        // Allows user to process a file, when set to false, this removes the file upload button
        allowReorder: [false, Type.BOOLEAN],
        // Allow reordering of files
        allowDirectoriesOnly: [false, Type.BOOLEAN],
        // Allow only selecting directories with browse (no support for filtering dnd at this point)
        // Try store file if `server` not set
        storeAsFile: [false, Type.BOOLEAN],
        // Revert mode
        forceRevert: [false, Type.BOOLEAN],
        // Set to 'force' to require the file to be reverted before removal
        // Input requirements
        maxFiles: [null, Type.INT],
        // Max number of files
        checkValidity: [false, Type.BOOLEAN],
        // Enables custom validity messages
        // Where to put file
        itemInsertLocationFreedom: [true, Type.BOOLEAN],
        // Set to false to always add items to begin or end of list
        itemInsertLocation: ["before", Type.STRING],
        // Default index in list to add items that have been dropped at the top of the list
        itemInsertInterval: [75, Type.INT],
        // Drag 'n Drop related
        dropOnPage: [false, Type.BOOLEAN],
        // Allow dropping of files anywhere on page (prevents browser from opening file if dropped outside of Up)
        dropOnElement: [true, Type.BOOLEAN],
        // Drop needs to happen on element (set to false to also load drops outside of Up)
        dropValidation: [false, Type.BOOLEAN],
        // Enable or disable validating files on drop
        ignoredFiles: [[".ds_store", "thumbs.db", "desktop.ini"], Type.ARRAY],
        // Upload related
        instantUpload: [true, Type.BOOLEAN],
        // Should upload files immediately on drop
        maxParallelUploads: [2, Type.INT],
        // Maximum files to upload in parallel
        allowMinimumUploadDuration: [true, Type.BOOLEAN],
        // if true uploads take at least 750 ms, this ensures the user sees the upload progress giving trust the upload actually happened
        // Chunks
        chunkUploads: [false, Type.BOOLEAN],
        // Enable chunked uploads
        chunkForce: [false, Type.BOOLEAN],
        // Force use of chunk uploads even for files smaller than chunk size
        chunkSize: [5e6, Type.INT],
        // Size of chunks (5MB default)
        chunkRetryDelays: [[500, 1e3, 3e3], Type.ARRAY],
        // Amount of times to retry upload of a chunk when it fails
        // The server api end points to use for uploading (see docs)
        server: [null, Type.SERVER_API],
        // File size calculations, can set to 1024, this is only used for display, properties use file size base 1000
        fileSizeBase: [1e3, Type.INT],
        // Labels and status messages
        labelFileSizeBytes: ["bytes", Type.STRING],
        labelFileSizeKilobytes: ["KB", Type.STRING],
        labelFileSizeMegabytes: ["MB", Type.STRING],
        labelFileSizeGigabytes: ["GB", Type.STRING],
        labelDecimalSeparator: [getDecimalSeparator(), Type.STRING],
        // Default is locale separator
        labelThousandsSeparator: [getThousandsSeparator(), Type.STRING],
        // Default is locale separator
        labelIdle: [
          'Drag & Drop your files or <span class="filepond--label-action">Browse</span>',
          Type.STRING
        ],
        labelInvalidField: ["Field contains invalid files", Type.STRING],
        labelFileWaitingForSize: ["Waiting for size", Type.STRING],
        labelFileSizeNotAvailable: ["Size not available", Type.STRING],
        labelFileCountSingular: ["file in list", Type.STRING],
        labelFileCountPlural: ["files in list", Type.STRING],
        labelFileLoading: ["Loading", Type.STRING],
        labelFileAdded: ["Added", Type.STRING],
        // assistive only
        labelFileLoadError: ["Error during load", Type.STRING],
        labelFileRemoved: ["Removed", Type.STRING],
        // assistive only
        labelFileRemoveError: ["Error during remove", Type.STRING],
        labelFileProcessing: ["Uploading", Type.STRING],
        labelFileProcessingComplete: ["Upload complete", Type.STRING],
        labelFileProcessingAborted: ["Upload cancelled", Type.STRING],
        labelFileProcessingError: ["Error during upload", Type.STRING],
        labelFileProcessingRevertError: ["Error during revert", Type.STRING],
        labelTapToCancel: ["tap to cancel", Type.STRING],
        labelTapToRetry: ["tap to retry", Type.STRING],
        labelTapToUndo: ["tap to undo", Type.STRING],
        labelButtonRemoveItem: ["Remove", Type.STRING],
        labelButtonAbortItemLoad: ["Abort", Type.STRING],
        labelButtonRetryItemLoad: ["Retry", Type.STRING],
        labelButtonAbortItemProcessing: ["Cancel", Type.STRING],
        labelButtonUndoItemProcessing: ["Undo", Type.STRING],
        labelButtonRetryItemProcessing: ["Retry", Type.STRING],
        labelButtonProcessItem: ["Upload", Type.STRING],
        // make sure width and height plus viewpox are even numbers so icons are nicely centered
        iconRemove: [
          '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M11.586 13l-2.293 2.293a1 1 0 0 0 1.414 1.414L13 14.414l2.293 2.293a1 1 0 0 0 1.414-1.414L14.414 13l2.293-2.293a1 1 0 0 0-1.414-1.414L13 11.586l-2.293-2.293a1 1 0 0 0-1.414 1.414L11.586 13z" fill="currentColor" fill-rule="nonzero"/></svg>',
          Type.STRING
        ],
        iconProcess: [
          '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M14 10.414v3.585a1 1 0 0 1-2 0v-3.585l-1.293 1.293a1 1 0 0 1-1.414-1.415l3-3a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1-1.414 1.415L14 10.414zM9 18a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2H9z" fill="currentColor" fill-rule="evenodd"/></svg>',
          Type.STRING
        ],
        iconRetry: [
          '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M10.81 9.185l-.038.02A4.997 4.997 0 0 0 8 13.683a5 5 0 0 0 5 5 5 5 0 0 0 5-5 1 1 0 0 1 2 0A7 7 0 1 1 9.722 7.496l-.842-.21a.999.999 0 1 1 .484-1.94l3.23.806c.535.133.86.675.73 1.21l-.804 3.233a.997.997 0 0 1-1.21.73.997.997 0 0 1-.73-1.21l.23-.928v-.002z" fill="currentColor" fill-rule="nonzero"/></svg>',
          Type.STRING
        ],
        iconUndo: [
          '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M9.185 10.81l.02-.038A4.997 4.997 0 0 1 13.683 8a5 5 0 0 1 5 5 5 5 0 0 1-5 5 1 1 0 0 0 0 2A7 7 0 1 0 7.496 9.722l-.21-.842a.999.999 0 1 0-1.94.484l.806 3.23c.133.535.675.86 1.21.73l3.233-.803a.997.997 0 0 0 .73-1.21.997.997 0 0 0-1.21-.73l-.928.23-.002-.001z" fill="currentColor" fill-rule="nonzero"/></svg>',
          Type.STRING
        ],
        iconDone: [
          '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M18.293 9.293a1 1 0 0 1 1.414 1.414l-7.002 7a1 1 0 0 1-1.414 0l-3.998-4a1 1 0 1 1 1.414-1.414L12 15.586l6.294-6.293z" fill="currentColor" fill-rule="nonzero"/></svg>',
          Type.STRING
        ],
        // event handlers
        oninit: [null, Type.FUNCTION],
        onwarning: [null, Type.FUNCTION],
        onerror: [null, Type.FUNCTION],
        onactivatefile: [null, Type.FUNCTION],
        oninitfile: [null, Type.FUNCTION],
        onaddfilestart: [null, Type.FUNCTION],
        onaddfileprogress: [null, Type.FUNCTION],
        onaddfile: [null, Type.FUNCTION],
        onprocessfilestart: [null, Type.FUNCTION],
        onprocessfileprogress: [null, Type.FUNCTION],
        onprocessfileabort: [null, Type.FUNCTION],
        onprocessfilerevert: [null, Type.FUNCTION],
        onprocessfile: [null, Type.FUNCTION],
        onprocessfiles: [null, Type.FUNCTION],
        onremovefile: [null, Type.FUNCTION],
        onpreparefile: [null, Type.FUNCTION],
        onupdatefiles: [null, Type.FUNCTION],
        onreorderfiles: [null, Type.FUNCTION],
        // hooks
        beforeDropFile: [null, Type.FUNCTION],
        beforeAddFile: [null, Type.FUNCTION],
        beforeRemoveFile: [null, Type.FUNCTION],
        beforePrepareFile: [null, Type.FUNCTION],
        // styles
        stylePanelLayout: [null, Type.STRING],
        // null 'integrated', 'compact', 'circle'
        stylePanelAspectRatio: [null, Type.STRING],
        // null or '3:2' or 1
        styleItemPanelAspectRatio: [null, Type.STRING],
        styleButtonRemoveItemPosition: ["left", Type.STRING],
        styleButtonProcessItemPosition: ["right", Type.STRING],
        styleLoadIndicatorPosition: ["right", Type.STRING],
        styleProgressIndicatorPosition: ["right", Type.STRING],
        styleButtonRemoveItemAlign: [false, Type.BOOLEAN],
        // custom initial files array
        files: [[], Type.ARRAY],
        // show support by displaying credits
        credits: [["https://filepond.com", "Powered by FilePond"], Type.ARRAY]
      };
      var getItemByQuery = function getItemByQuery2(items, query) {
        if (isEmpty(query)) {
          return items[0] || null;
        }
        if (isInt(query)) {
          return items[query] || null;
        }
        if (typeof query === "object") {
          query = query.id;
        }
        return items.find(function(item2) {
          return item2.id === query;
        }) || null;
      };
      var getNumericAspectRatioFromString = function getNumericAspectRatioFromString2(aspectRatio) {
        if (isEmpty(aspectRatio)) {
          return aspectRatio;
        }
        if (/:/.test(aspectRatio)) {
          var parts = aspectRatio.split(":");
          return parts[1] / parts[0];
        }
        return parseFloat(aspectRatio);
      };
      var getActiveItems = function getActiveItems2(items) {
        return items.filter(function(item2) {
          return !item2.archived;
        });
      };
      var Status = {
        EMPTY: 0,
        IDLE: 1,
        // waiting
        ERROR: 2,
        // a file is in error state
        BUSY: 3,
        // busy processing or loading
        READY: 4
        // all files uploaded
      };
      var res = null;
      var canUpdateFileInput = function canUpdateFileInput2() {
        if (res === null) {
          try {
            var dataTransfer = new DataTransfer();
            dataTransfer.items.add(new File(["hello world"], "This_Works.txt"));
            var el = document.createElement("input");
            el.setAttribute("type", "file");
            el.files = dataTransfer.files;
            res = el.files.length === 1;
          } catch (err) {
            res = false;
          }
        }
        return res;
      };
      var ITEM_ERROR = [
        ItemStatus.LOAD_ERROR,
        ItemStatus.PROCESSING_ERROR,
        ItemStatus.PROCESSING_REVERT_ERROR
      ];
      var ITEM_BUSY = [
        ItemStatus.LOADING,
        ItemStatus.PROCESSING,
        ItemStatus.PROCESSING_QUEUED,
        ItemStatus.INIT
      ];
      var ITEM_READY = [ItemStatus.PROCESSING_COMPLETE];
      var isItemInErrorState = function isItemInErrorState2(item2) {
        return ITEM_ERROR.includes(item2.status);
      };
      var isItemInBusyState = function isItemInBusyState2(item2) {
        return ITEM_BUSY.includes(item2.status);
      };
      var isItemInReadyState = function isItemInReadyState2(item2) {
        return ITEM_READY.includes(item2.status);
      };
      var isAsync = function isAsync2(state2) {
        return isObject(state2.options.server) && (isObject(state2.options.server.process) || isFunction(state2.options.server.process));
      };
      var queries = function queries2(state2) {
        return {
          GET_STATUS: function GET_STATUS() {
            var items = getActiveItems(state2.items);
            var EMPTY = Status.EMPTY, ERROR = Status.ERROR, BUSY = Status.BUSY, IDLE = Status.IDLE, READY = Status.READY;
            if (items.length === 0) return EMPTY;
            if (items.some(isItemInErrorState)) return ERROR;
            if (items.some(isItemInBusyState)) return BUSY;
            if (items.some(isItemInReadyState)) return READY;
            return IDLE;
          },
          GET_ITEM: function GET_ITEM(query) {
            return getItemByQuery(state2.items, query);
          },
          GET_ACTIVE_ITEM: function GET_ACTIVE_ITEM(query) {
            return getItemByQuery(getActiveItems(state2.items), query);
          },
          GET_ACTIVE_ITEMS: function GET_ACTIVE_ITEMS() {
            return getActiveItems(state2.items);
          },
          GET_ITEMS: function GET_ITEMS() {
            return state2.items;
          },
          GET_ITEM_NAME: function GET_ITEM_NAME(query) {
            var item2 = getItemByQuery(state2.items, query);
            return item2 ? item2.filename : null;
          },
          GET_ITEM_SIZE: function GET_ITEM_SIZE(query) {
            var item2 = getItemByQuery(state2.items, query);
            return item2 ? item2.fileSize : null;
          },
          GET_STYLES: function GET_STYLES() {
            return Object.keys(state2.options).filter(function(key) {
              return /^style/.test(key);
            }).map(function(option2) {
              return {
                name: option2,
                value: state2.options[option2]
              };
            });
          },
          GET_PANEL_ASPECT_RATIO: function GET_PANEL_ASPECT_RATIO() {
            var isShapeCircle = /circle/.test(state2.options.stylePanelLayout);
            var aspectRatio = isShapeCircle ? 1 : getNumericAspectRatioFromString(state2.options.stylePanelAspectRatio);
            return aspectRatio;
          },
          GET_ITEM_PANEL_ASPECT_RATIO: function GET_ITEM_PANEL_ASPECT_RATIO() {
            return state2.options.styleItemPanelAspectRatio;
          },
          GET_ITEMS_BY_STATUS: function GET_ITEMS_BY_STATUS(status) {
            return getActiveItems(state2.items).filter(function(item2) {
              return item2.status === status;
            });
          },
          GET_TOTAL_ITEMS: function GET_TOTAL_ITEMS() {
            return getActiveItems(state2.items).length;
          },
          SHOULD_UPDATE_FILE_INPUT: function SHOULD_UPDATE_FILE_INPUT() {
            return state2.options.storeAsFile && canUpdateFileInput() && !isAsync(state2);
          },
          IS_ASYNC: function IS_ASYNC() {
            return isAsync(state2);
          },
          GET_FILE_SIZE_LABELS: function GET_FILE_SIZE_LABELS(query) {
            return {
              labelBytes: query("GET_LABEL_FILE_SIZE_BYTES") || void 0,
              labelKilobytes: query("GET_LABEL_FILE_SIZE_KILOBYTES") || void 0,
              labelMegabytes: query("GET_LABEL_FILE_SIZE_MEGABYTES") || void 0,
              labelGigabytes: query("GET_LABEL_FILE_SIZE_GIGABYTES") || void 0
            };
          }
        };
      };
      var hasRoomForItem = function hasRoomForItem2(state2) {
        var count = getActiveItems(state2.items).length;
        if (!state2.options.allowMultiple) {
          return count === 0;
        }
        var maxFileCount = state2.options.maxFiles;
        if (maxFileCount === null) {
          return true;
        }
        if (count < maxFileCount) {
          return true;
        }
        return false;
      };
      var limit = function limit2(value, min2, max2) {
        return Math.max(Math.min(max2, value), min2);
      };
      var arrayInsert = function arrayInsert2(arr, index, item2) {
        return arr.splice(index, 0, item2);
      };
      var insertItem = function insertItem2(items, item2, index) {
        if (isEmpty(item2)) {
          return null;
        }
        if (typeof index === "undefined") {
          items.push(item2);
          return item2;
        }
        index = limit(index, 0, items.length);
        arrayInsert(items, index, item2);
        return item2;
      };
      var isBase64DataURI = function isBase64DataURI2(str) {
        return /^\s*data:([a-z]+\/[a-z0-9-+.]+(;[a-z-]+=[a-z0-9-]+)?)?(;base64)?,([a-z0-9!$&',()*+;=\-._~:@\/?%\s]*)\s*$/i.test(
          str
        );
      };
      var getFilenameFromURL = function getFilenameFromURL2(url) {
        return ("" + url).split("/").pop().split("?").shift();
      };
      var getExtensionFromFilename = function getExtensionFromFilename2(name2) {
        return name2.split(".").pop();
      };
      var guesstimateExtension = function guesstimateExtension2(type) {
        if (typeof type !== "string") {
          return "";
        }
        var subtype = type.split("/").pop();
        if (/svg/.test(subtype)) {
          return "svg";
        }
        if (/zip|compressed/.test(subtype)) {
          return "zip";
        }
        if (/plain/.test(subtype)) {
          return "txt";
        }
        if (/msword/.test(subtype)) {
          return "doc";
        }
        if (/[a-z]+/.test(subtype)) {
          if (subtype === "jpeg") {
            return "jpg";
          }
          return subtype;
        }
        return "";
      };
      var leftPad = function leftPad2(value) {
        var padding = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
        return (padding + value).slice(-padding.length);
      };
      var getDateString = function getDateString2() {
        var date = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : /* @__PURE__ */ new Date();
        return date.getFullYear() + "-" + leftPad(date.getMonth() + 1, "00") + "-" + leftPad(date.getDate(), "00") + "_" + leftPad(date.getHours(), "00") + "-" + leftPad(date.getMinutes(), "00") + "-" + leftPad(date.getSeconds(), "00");
      };
      var getFileFromBlob = function getFileFromBlob2(blob2, filename) {
        var type = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : null;
        var extension = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : null;
        var file2 = typeof type === "string" ? blob2.slice(0, blob2.size, type) : blob2.slice(0, blob2.size, blob2.type);
        file2.lastModifiedDate = /* @__PURE__ */ new Date();
        if (blob2._relativePath) file2._relativePath = blob2._relativePath;
        if (!isString(filename)) {
          filename = getDateString();
        }
        if (filename && extension === null && getExtensionFromFilename(filename)) {
          file2.name = filename;
        } else {
          extension = extension || guesstimateExtension(file2.type);
          file2.name = filename + (extension ? "." + extension : "");
        }
        return file2;
      };
      var getBlobBuilder = function getBlobBuilder2() {
        return window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
      };
      var createBlob = function createBlob2(arrayBuffer, mimeType) {
        var BB = getBlobBuilder();
        if (BB) {
          var bb = new BB();
          bb.append(arrayBuffer);
          return bb.getBlob(mimeType);
        }
        return new Blob([arrayBuffer], {
          type: mimeType
        });
      };
      var getBlobFromByteStringWithMimeType = function getBlobFromByteStringWithMimeType2(byteString, mimeType) {
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        return createBlob(ab, mimeType);
      };
      var getMimeTypeFromBase64DataURI = function getMimeTypeFromBase64DataURI2(dataURI) {
        return (/^data:(.+);/.exec(dataURI) || [])[1] || null;
      };
      var getBase64DataFromBase64DataURI = function getBase64DataFromBase64DataURI2(dataURI) {
        var data2 = dataURI.split(",")[1];
        return data2.replace(/\s/g, "");
      };
      var getByteStringFromBase64DataURI = function getByteStringFromBase64DataURI2(dataURI) {
        return atob(getBase64DataFromBase64DataURI(dataURI));
      };
      var getBlobFromBase64DataURI = function getBlobFromBase64DataURI2(dataURI) {
        var mimeType = getMimeTypeFromBase64DataURI(dataURI);
        var byteString = getByteStringFromBase64DataURI(dataURI);
        return getBlobFromByteStringWithMimeType(byteString, mimeType);
      };
      var getFileFromBase64DataURI = function getFileFromBase64DataURI2(dataURI, filename, extension) {
        return getFileFromBlob(getBlobFromBase64DataURI(dataURI), filename, null, extension);
      };
      var getFileNameFromHeader = function getFileNameFromHeader2(header) {
        if (!/^content-disposition:/i.test(header)) return null;
        var matches = header.split(/filename=|filename\*=.+''/).splice(1).map(function(name2) {
          return name2.trim().replace(/^["']|[;"']{0,2}$/g, "");
        }).filter(function(name2) {
          return name2.length;
        });
        return matches.length ? decodeURI(matches[matches.length - 1]) : null;
      };
      var getFileSizeFromHeader = function getFileSizeFromHeader2(header) {
        if (/content-length:/i.test(header)) {
          var size = header.match(/[0-9]+/)[0];
          return size ? parseInt(size, 10) : null;
        }
        return null;
      };
      var getTranfserIdFromHeader = function getTranfserIdFromHeader2(header) {
        if (/x-content-transfer-id:/i.test(header)) {
          var id2 = (header.split(":")[1] || "").trim();
          return id2 || null;
        }
        return null;
      };
      var getFileInfoFromHeaders = function getFileInfoFromHeaders2(headers) {
        var info = {
          source: null,
          name: null,
          size: null
        };
        var rows = headers.split("\n");
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = void 0;
        try {
          for (var _iterator = rows[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var header = _step.value;
            var name2 = getFileNameFromHeader(header);
            if (name2) {
              info.name = name2;
              continue;
            }
            var size = getFileSizeFromHeader(header);
            if (size) {
              info.size = size;
              continue;
            }
            var source = getTranfserIdFromHeader(header);
            if (source) {
              info.source = source;
              continue;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
        return info;
      };
      var createFileLoader = function createFileLoader2(fetchFn) {
        var state2 = {
          source: null,
          complete: false,
          progress: 0,
          size: null,
          timestamp: null,
          duration: 0,
          request: null
        };
        var getProgress = function getProgress2() {
          return state2.progress;
        };
        var abort = function abort2() {
          if (state2.request && state2.request.abort) {
            state2.request.abort();
          }
        };
        var load = function load2() {
          var source = state2.source;
          api.fire("init", source);
          if (source instanceof File) {
            api.fire("load", source);
          } else if (source instanceof Blob) {
            api.fire("load", getFileFromBlob(source, source.name));
          } else if (isBase64DataURI(source)) {
            api.fire("load", getFileFromBase64DataURI(source));
          } else {
            loadURL(source);
          }
        };
        var loadURL = function loadURL2(url) {
          if (!fetchFn) {
            api.fire("error", {
              type: "error",
              body: "Can't load URL",
              code: 400
            });
            return;
          }
          state2.timestamp = Date.now();
          state2.request = fetchFn(
            url,
            function(response) {
              state2.duration = Date.now() - state2.timestamp;
              state2.complete = true;
              if (response instanceof Blob) {
                response = getFileFromBlob(
                  response,
                  response.name || getFilenameFromURL(url)
                );
              }
              api.fire(
                "load",
                // if has received blob, we go with blob, if no response, we return null
                response instanceof Blob ? response : response ? response.body : null
              );
            },
            function(error2) {
              api.fire(
                "error",
                typeof error2 === "string" ? {
                  type: "error",
                  code: 0,
                  body: error2
                } : error2
              );
            },
            function(computable, current, total) {
              if (total) {
                state2.size = total;
              }
              state2.duration = Date.now() - state2.timestamp;
              if (!computable) {
                state2.progress = null;
                return;
              }
              state2.progress = current / total;
              api.fire("progress", state2.progress);
            },
            function() {
              api.fire("abort");
            },
            function(response) {
              var fileinfo = getFileInfoFromHeaders(
                typeof response === "string" ? response : response.headers
              );
              api.fire("meta", {
                size: state2.size || fileinfo.size,
                filename: fileinfo.name,
                source: fileinfo.source
              });
            }
          );
        };
        var api = Object.assign({}, on(), {
          setSource: function setSource(source) {
            return state2.source = source;
          },
          getProgress,
          // file load progress
          abort,
          // abort file load
          load
          // start load
        });
        return api;
      };
      var isGet = function isGet2(method) {
        return /GET|HEAD/.test(method);
      };
      var sendRequest = function sendRequest2(data2, url, options) {
        var api = {
          onheaders: function onheaders() {
          },
          onprogress: function onprogress() {
          },
          onload: function onload() {
          },
          ontimeout: function ontimeout() {
          },
          onerror: function onerror() {
          },
          onabort: function onabort() {
          },
          abort: function abort() {
            aborted = true;
            xhr.abort();
          }
        };
        var aborted = false;
        var headersReceived = false;
        options = Object.assign(
          {
            method: "POST",
            headers: {},
            withCredentials: false
          },
          options
        );
        url = encodeURI(url);
        if (isGet(options.method) && data2) {
          url = "" + url + encodeURIComponent(typeof data2 === "string" ? data2 : JSON.stringify(data2));
        }
        var xhr = new XMLHttpRequest();
        var process = isGet(options.method) ? xhr : xhr.upload;
        process.onprogress = function(e) {
          if (aborted) {
            return;
          }
          api.onprogress(e.lengthComputable, e.loaded, e.total);
        };
        xhr.onreadystatechange = function() {
          if (xhr.readyState < 2) {
            return;
          }
          if (xhr.readyState === 4 && xhr.status === 0) {
            return;
          }
          if (headersReceived) {
            return;
          }
          headersReceived = true;
          api.onheaders(xhr);
        };
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            api.onload(xhr);
          } else {
            api.onerror(xhr);
          }
        };
        xhr.onerror = function() {
          return api.onerror(xhr);
        };
        xhr.onabort = function() {
          aborted = true;
          api.onabort();
        };
        xhr.ontimeout = function() {
          return api.ontimeout(xhr);
        };
        xhr.open(options.method, url, true);
        if (isInt(options.timeout)) {
          xhr.timeout = options.timeout;
        }
        Object.keys(options.headers).forEach(function(key) {
          var value = unescape(encodeURIComponent(options.headers[key]));
          xhr.setRequestHeader(key, value);
        });
        if (options.responseType) {
          xhr.responseType = options.responseType;
        }
        if (options.withCredentials) {
          xhr.withCredentials = true;
        }
        xhr.send(data2);
        return api;
      };
      var createResponse = function createResponse2(type, code, body, headers) {
        return {
          type,
          code,
          body,
          headers
        };
      };
      var createTimeoutResponse = function createTimeoutResponse2(cb) {
        return function(xhr) {
          cb(createResponse("error", 0, "Timeout", xhr.getAllResponseHeaders()));
        };
      };
      var hasQS = function hasQS2(str) {
        return /\?/.test(str);
      };
      var buildURL = function buildURL2() {
        var url = "";
        for (var _len = arguments.length, parts = new Array(_len), _key = 0; _key < _len; _key++) {
          parts[_key] = arguments[_key];
        }
        parts.forEach(function(part) {
          url += hasQS(url) && hasQS(part) ? part.replace(/\?/, "&") : part;
        });
        return url;
      };
      var createFetchFunction = function createFetchFunction2() {
        var apiUrl = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "";
        var action = arguments.length > 1 ? arguments[1] : void 0;
        if (typeof action === "function") {
          return action;
        }
        if (!action || !isString(action.url)) {
          return null;
        }
        var onload = action.onload || function(res2) {
          return res2;
        };
        var onerror = action.onerror || function(res2) {
          return null;
        };
        return function(url, load, error2, progress, abort, headers) {
          var request = sendRequest(
            url,
            buildURL(apiUrl, action.url),
            Object.assign({}, action, {
              responseType: "blob"
            })
          );
          request.onload = function(xhr) {
            var headers2 = xhr.getAllResponseHeaders();
            var filename = getFileInfoFromHeaders(headers2).name || getFilenameFromURL(url);
            load(
              createResponse(
                "load",
                xhr.status,
                action.method === "HEAD" ? null : getFileFromBlob(onload(xhr.response), filename),
                headers2
              )
            );
          };
          request.onerror = function(xhr) {
            error2(
              createResponse(
                "error",
                xhr.status,
                onerror(xhr.response) || xhr.statusText,
                xhr.getAllResponseHeaders()
              )
            );
          };
          request.onheaders = function(xhr) {
            headers(createResponse("headers", xhr.status, null, xhr.getAllResponseHeaders()));
          };
          request.ontimeout = createTimeoutResponse(error2);
          request.onprogress = progress;
          request.onabort = abort;
          return request;
        };
      };
      var ChunkStatus = {
        QUEUED: 0,
        COMPLETE: 1,
        PROCESSING: 2,
        ERROR: 3,
        WAITING: 4
      };
      var processFileChunked = function processFileChunked2(apiUrl, action, name2, file2, metadata, load, error2, progress, abort, transfer, options) {
        var chunks = [];
        var chunkTransferId = options.chunkTransferId, chunkServer = options.chunkServer, chunkSize = options.chunkSize, chunkRetryDelays = options.chunkRetryDelays;
        var state2 = {
          serverId: chunkTransferId,
          aborted: false
        };
        var ondata = action.ondata || function(fd) {
          return fd;
        };
        var onload = action.onload || function(xhr, method) {
          return method === "HEAD" ? xhr.getResponseHeader("Upload-Offset") : xhr.response;
        };
        var onerror = action.onerror || function(res2) {
          return null;
        };
        var requestTransferId = function requestTransferId2(cb) {
          var formData = new FormData();
          if (isObject(metadata)) formData.append(name2, JSON.stringify(metadata));
          var headers = typeof action.headers === "function" ? action.headers(file2, metadata) : Object.assign(
            {},
            action.headers,
            {
              "Upload-Length": file2.size
            }
          );
          var requestParams = Object.assign({}, action, {
            headers
          });
          var request = sendRequest(
            ondata(formData),
            buildURL(apiUrl, action.url),
            requestParams
          );
          request.onload = function(xhr) {
            return cb(onload(xhr, requestParams.method));
          };
          request.onerror = function(xhr) {
            return error2(
              createResponse(
                "error",
                xhr.status,
                onerror(xhr.response) || xhr.statusText,
                xhr.getAllResponseHeaders()
              )
            );
          };
          request.ontimeout = createTimeoutResponse(error2);
        };
        var requestTransferOffset = function requestTransferOffset2(cb) {
          var requestUrl = buildURL(apiUrl, chunkServer.url, state2.serverId);
          var headers = typeof action.headers === "function" ? action.headers(state2.serverId) : Object.assign(
            {},
            action.headers
          );
          var requestParams = {
            headers,
            method: "HEAD"
          };
          var request = sendRequest(null, requestUrl, requestParams);
          request.onload = function(xhr) {
            return cb(onload(xhr, requestParams.method));
          };
          request.onerror = function(xhr) {
            return error2(
              createResponse(
                "error",
                xhr.status,
                onerror(xhr.response) || xhr.statusText,
                xhr.getAllResponseHeaders()
              )
            );
          };
          request.ontimeout = createTimeoutResponse(error2);
        };
        var lastChunkIndex = Math.floor(file2.size / chunkSize);
        for (var i = 0; i <= lastChunkIndex; i++) {
          var offset2 = i * chunkSize;
          var data2 = file2.slice(offset2, offset2 + chunkSize, "application/offset+octet-stream");
          chunks[i] = {
            index: i,
            size: data2.size,
            offset: offset2,
            data: data2,
            file: file2,
            progress: 0,
            retries: _toConsumableArray(chunkRetryDelays),
            status: ChunkStatus.QUEUED,
            error: null,
            request: null,
            timeout: null
          };
        }
        var completeProcessingChunks = function completeProcessingChunks2() {
          return load(state2.serverId);
        };
        var canProcessChunk = function canProcessChunk2(chunk) {
          return chunk.status === ChunkStatus.QUEUED || chunk.status === ChunkStatus.ERROR;
        };
        var processChunk = function processChunk2(chunk) {
          if (state2.aborted) return;
          chunk = chunk || chunks.find(canProcessChunk);
          if (!chunk) {
            if (chunks.every(function(chunk2) {
              return chunk2.status === ChunkStatus.COMPLETE;
            })) {
              completeProcessingChunks();
            }
            return;
          }
          chunk.status = ChunkStatus.PROCESSING;
          chunk.progress = null;
          var ondata2 = chunkServer.ondata || function(fd) {
            return fd;
          };
          var onerror2 = chunkServer.onerror || function(res2) {
            return null;
          };
          var onload2 = chunkServer.onload || function() {
          };
          var requestUrl = buildURL(apiUrl, chunkServer.url, state2.serverId);
          var headers = typeof chunkServer.headers === "function" ? chunkServer.headers(chunk) : Object.assign(
            {},
            chunkServer.headers,
            {
              "Content-Type": "application/offset+octet-stream",
              "Upload-Offset": chunk.offset,
              "Upload-Length": file2.size,
              "Upload-Name": file2.name
            }
          );
          var request = chunk.request = sendRequest(
            ondata2(chunk.data),
            requestUrl,
            Object.assign({}, chunkServer, {
              headers
            })
          );
          request.onload = function(xhr) {
            onload2(xhr, chunk.index, chunks.length);
            chunk.status = ChunkStatus.COMPLETE;
            chunk.request = null;
            processChunks();
          };
          request.onprogress = function(lengthComputable, loaded, total) {
            chunk.progress = lengthComputable ? loaded : null;
            updateTotalProgress();
          };
          request.onerror = function(xhr) {
            chunk.status = ChunkStatus.ERROR;
            chunk.request = null;
            chunk.error = onerror2(xhr.response) || xhr.statusText;
            if (!retryProcessChunk(chunk)) {
              error2(
                createResponse(
                  "error",
                  xhr.status,
                  onerror2(xhr.response) || xhr.statusText,
                  xhr.getAllResponseHeaders()
                )
              );
            }
          };
          request.ontimeout = function(xhr) {
            chunk.status = ChunkStatus.ERROR;
            chunk.request = null;
            if (!retryProcessChunk(chunk)) {
              createTimeoutResponse(error2)(xhr);
            }
          };
          request.onabort = function() {
            chunk.status = ChunkStatus.QUEUED;
            chunk.request = null;
            abort();
          };
        };
        var retryProcessChunk = function retryProcessChunk2(chunk) {
          if (chunk.retries.length === 0) return false;
          chunk.status = ChunkStatus.WAITING;
          clearTimeout(chunk.timeout);
          chunk.timeout = setTimeout(function() {
            processChunk(chunk);
          }, chunk.retries.shift());
          return true;
        };
        var updateTotalProgress = function updateTotalProgress2() {
          var totalBytesTransfered = chunks.reduce(function(p2, chunk) {
            if (p2 === null || chunk.progress === null) return null;
            return p2 + chunk.progress;
          }, 0);
          if (totalBytesTransfered === null) return progress(false, 0, 0);
          var totalSize = chunks.reduce(function(total, chunk) {
            return total + chunk.size;
          }, 0);
          progress(true, totalBytesTransfered, totalSize);
        };
        var processChunks = function processChunks2() {
          var totalProcessing = chunks.filter(function(chunk) {
            return chunk.status === ChunkStatus.PROCESSING;
          }).length;
          if (totalProcessing >= 1) return;
          processChunk();
        };
        var abortChunks = function abortChunks2() {
          chunks.forEach(function(chunk) {
            clearTimeout(chunk.timeout);
            if (chunk.request) {
              chunk.request.abort();
            }
          });
        };
        if (!state2.serverId) {
          requestTransferId(function(serverId) {
            if (state2.aborted) return;
            transfer(serverId);
            state2.serverId = serverId;
            processChunks();
          });
        } else {
          requestTransferOffset(function(offset3) {
            if (state2.aborted) return;
            chunks.filter(function(chunk) {
              return chunk.offset < offset3;
            }).forEach(function(chunk) {
              chunk.status = ChunkStatus.COMPLETE;
              chunk.progress = chunk.size;
            });
            processChunks();
          });
        }
        return {
          abort: function abort2() {
            state2.aborted = true;
            abortChunks();
          }
        };
      };
      var createFileProcessorFunction = function createFileProcessorFunction2(apiUrl, action, name2, options) {
        return function(file2, metadata, load, error2, progress, abort, transfer) {
          if (!file2) return;
          var canChunkUpload = options.chunkUploads;
          var shouldChunkUpload = canChunkUpload && file2.size > options.chunkSize;
          var willChunkUpload = canChunkUpload && (shouldChunkUpload || options.chunkForce);
          if (file2 instanceof Blob && willChunkUpload)
            return processFileChunked(
              apiUrl,
              action,
              name2,
              file2,
              metadata,
              load,
              error2,
              progress,
              abort,
              transfer,
              options
            );
          var ondata = action.ondata || function(fd) {
            return fd;
          };
          var onload = action.onload || function(res2) {
            return res2;
          };
          var onerror = action.onerror || function(res2) {
            return null;
          };
          var headers = typeof action.headers === "function" ? action.headers(file2, metadata) || {} : Object.assign(
            {},
            action.headers
          );
          var requestParams = Object.assign({}, action, {
            headers
          });
          var formData = new FormData();
          if (isObject(metadata)) {
            formData.append(name2, JSON.stringify(metadata));
          }
          (file2 instanceof Blob ? [{ name: null, file: file2 }] : file2).forEach(function(item2) {
            formData.append(
              name2,
              item2.file,
              item2.name === null ? item2.file.name : "" + item2.name + item2.file.name
            );
          });
          var request = sendRequest(
            ondata(formData),
            buildURL(apiUrl, action.url),
            requestParams
          );
          request.onload = function(xhr) {
            load(
              createResponse(
                "load",
                xhr.status,
                onload(xhr.response),
                xhr.getAllResponseHeaders()
              )
            );
          };
          request.onerror = function(xhr) {
            error2(
              createResponse(
                "error",
                xhr.status,
                onerror(xhr.response) || xhr.statusText,
                xhr.getAllResponseHeaders()
              )
            );
          };
          request.ontimeout = createTimeoutResponse(error2);
          request.onprogress = progress;
          request.onabort = abort;
          return request;
        };
      };
      var createProcessorFunction = function createProcessorFunction2() {
        var apiUrl = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "";
        var action = arguments.length > 1 ? arguments[1] : void 0;
        var name2 = arguments.length > 2 ? arguments[2] : void 0;
        var options = arguments.length > 3 ? arguments[3] : void 0;
        if (typeof action === "function")
          return function() {
            for (var _len = arguments.length, params = new Array(_len), _key = 0; _key < _len; _key++) {
              params[_key] = arguments[_key];
            }
            return action.apply(void 0, [name2].concat(params, [options]));
          };
        if (!action || !isString(action.url)) return null;
        return createFileProcessorFunction(apiUrl, action, name2, options);
      };
      var createRevertFunction = function createRevertFunction2() {
        var apiUrl = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "";
        var action = arguments.length > 1 ? arguments[1] : void 0;
        if (typeof action === "function") {
          return action;
        }
        if (!action || !isString(action.url)) {
          return function(uniqueFileId, load) {
            return load();
          };
        }
        var onload = action.onload || function(res2) {
          return res2;
        };
        var onerror = action.onerror || function(res2) {
          return null;
        };
        return function(uniqueFileId, load, error2) {
          var request = sendRequest(
            uniqueFileId,
            apiUrl + action.url,
            action
            // contains method, headers and withCredentials properties
          );
          request.onload = function(xhr) {
            load(
              createResponse(
                "load",
                xhr.status,
                onload(xhr.response),
                xhr.getAllResponseHeaders()
              )
            );
          };
          request.onerror = function(xhr) {
            error2(
              createResponse(
                "error",
                xhr.status,
                onerror(xhr.response) || xhr.statusText,
                xhr.getAllResponseHeaders()
              )
            );
          };
          request.ontimeout = createTimeoutResponse(error2);
          return request;
        };
      };
      var getRandomNumber = function getRandomNumber2() {
        var min2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
        var max2 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1;
        return min2 + Math.random() * (max2 - min2);
      };
      var createPerceivedPerformanceUpdater = function createPerceivedPerformanceUpdater2(cb) {
        var duration = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1e3;
        var offset2 = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
        var tickMin = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 25;
        var tickMax = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : 250;
        var timeout = null;
        var start2 = Date.now();
        var tick = function tick2() {
          var runtime = Date.now() - start2;
          var delay = getRandomNumber(tickMin, tickMax);
          if (runtime + delay > duration) {
            delay = runtime + delay - duration;
          }
          var progress = runtime / duration;
          if (progress >= 1 || document.hidden) {
            cb(1);
            return;
          }
          cb(progress);
          timeout = setTimeout(tick2, delay);
        };
        if (duration > 0) tick();
        return {
          clear: function clear2() {
            clearTimeout(timeout);
          }
        };
      };
      var createFileProcessor = function createFileProcessor2(processFn, options) {
        var state2 = {
          complete: false,
          perceivedProgress: 0,
          perceivedPerformanceUpdater: null,
          progress: null,
          timestamp: null,
          perceivedDuration: 0,
          duration: 0,
          request: null,
          response: null
        };
        var allowMinimumUploadDuration = options.allowMinimumUploadDuration;
        var process = function process2(file2, metadata) {
          var progressFn = function progressFn2() {
            if (state2.duration === 0 || state2.progress === null) return;
            api.fire("progress", api.getProgress());
          };
          var completeFn = function completeFn2() {
            state2.complete = true;
            api.fire("load-perceived", state2.response.body);
          };
          api.fire("start");
          state2.timestamp = Date.now();
          state2.perceivedPerformanceUpdater = createPerceivedPerformanceUpdater(
            function(progress) {
              state2.perceivedProgress = progress;
              state2.perceivedDuration = Date.now() - state2.timestamp;
              progressFn();
              if (state2.response && state2.perceivedProgress === 1 && !state2.complete) {
                completeFn();
              }
            },
            // random delay as in a list of files you start noticing
            // files uploading at the exact same speed
            allowMinimumUploadDuration ? getRandomNumber(750, 1500) : 0
          );
          state2.request = processFn(
            // the file to process
            file2,
            // the metadata to send along
            metadata,
            // callbacks (load, error, progress, abort, transfer)
            // load expects the body to be a server id if
            // you want to make use of revert
            function(response) {
              state2.response = isObject(response) ? response : {
                type: "load",
                code: 200,
                body: "" + response,
                headers: {}
              };
              state2.duration = Date.now() - state2.timestamp;
              state2.progress = 1;
              api.fire("load", state2.response.body);
              if (!allowMinimumUploadDuration || allowMinimumUploadDuration && state2.perceivedProgress === 1) {
                completeFn();
              }
            },
            // error is expected to be an object with type, code, body
            function(error2) {
              state2.perceivedPerformanceUpdater.clear();
              api.fire(
                "error",
                isObject(error2) ? error2 : {
                  type: "error",
                  code: 0,
                  body: "" + error2
                }
              );
            },
            // actual processing progress
            function(computable, current, total) {
              state2.duration = Date.now() - state2.timestamp;
              state2.progress = computable ? current / total : null;
              progressFn();
            },
            // abort does not expect a value
            function() {
              state2.perceivedPerformanceUpdater.clear();
              api.fire("abort", state2.response ? state2.response.body : null);
            },
            // register the id for this transfer
            function(transferId) {
              api.fire("transfer", transferId);
            }
          );
        };
        var abort = function abort2() {
          if (!state2.request) return;
          state2.perceivedPerformanceUpdater.clear();
          if (state2.request.abort) state2.request.abort();
          state2.complete = true;
        };
        var reset = function reset2() {
          abort();
          state2.complete = false;
          state2.perceivedProgress = 0;
          state2.progress = 0;
          state2.timestamp = null;
          state2.perceivedDuration = 0;
          state2.duration = 0;
          state2.request = null;
          state2.response = null;
        };
        var getProgress = allowMinimumUploadDuration ? function() {
          return state2.progress ? Math.min(state2.progress, state2.perceivedProgress) : null;
        } : function() {
          return state2.progress || null;
        };
        var getDuration = allowMinimumUploadDuration ? function() {
          return Math.min(state2.duration, state2.perceivedDuration);
        } : function() {
          return state2.duration;
        };
        var api = Object.assign({}, on(), {
          process,
          // start processing file
          abort,
          // abort active process request
          getProgress,
          getDuration,
          reset
        });
        return api;
      };
      var getFilenameWithoutExtension = function getFilenameWithoutExtension2(name2) {
        return name2.substring(0, name2.lastIndexOf(".")) || name2;
      };
      var createFileStub = function createFileStub2(source) {
        var data2 = [source.name, source.size, source.type];
        if (source instanceof Blob || isBase64DataURI(source)) {
          data2[0] = source.name || getDateString();
        } else if (isBase64DataURI(source)) {
          data2[1] = source.length;
          data2[2] = getMimeTypeFromBase64DataURI(source);
        } else if (isString(source)) {
          data2[0] = getFilenameFromURL(source);
          data2[1] = 0;
          data2[2] = "application/octet-stream";
        }
        return {
          name: data2[0],
          size: data2[1],
          type: data2[2]
        };
      };
      var isFile = function isFile2(value) {
        return !!(value instanceof File || value instanceof Blob && value.name);
      };
      var deepCloneObject = function deepCloneObject2(src) {
        if (!isObject(src)) return src;
        var target = isArray(src) ? [] : {};
        for (var key in src) {
          if (!src.hasOwnProperty(key)) continue;
          var v2 = src[key];
          target[key] = v2 && isObject(v2) ? deepCloneObject2(v2) : v2;
        }
        return target;
      };
      var createItem = function createItem2() {
        var origin = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : null;
        var serverFileReference = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
        var file2 = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : null;
        var id2 = getUniqueId();
        var state2 = {
          // is archived
          archived: false,
          // if is frozen, no longer fires events
          frozen: false,
          // removed from view
          released: false,
          // original source
          source: null,
          // file model reference
          file: file2,
          // id of file on server
          serverFileReference,
          // id of file transfer on server
          transferId: null,
          // is aborted
          processingAborted: false,
          // current item status
          status: serverFileReference ? ItemStatus.PROCESSING_COMPLETE : ItemStatus.INIT,
          // active processes
          activeLoader: null,
          activeProcessor: null
        };
        var abortProcessingRequestComplete = null;
        var metadata = {};
        var setStatus = function setStatus2(status) {
          return state2.status = status;
        };
        var fire = function fire2(event) {
          if (state2.released || state2.frozen) return;
          for (var _len = arguments.length, params = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            params[_key - 1] = arguments[_key];
          }
          api.fire.apply(api, [event].concat(params));
        };
        var getFileExtension = function getFileExtension2() {
          return getExtensionFromFilename(state2.file.name);
        };
        var getFileType = function getFileType2() {
          return state2.file.type;
        };
        var getFileSize = function getFileSize2() {
          return state2.file.size;
        };
        var getFile = function getFile2() {
          return state2.file;
        };
        var load = function load2(source, loader, onload) {
          state2.source = source;
          api.fireSync("init");
          if (state2.file) {
            api.fireSync("load-skip");
            return;
          }
          state2.file = createFileStub(source);
          loader.on("init", function() {
            fire("load-init");
          });
          loader.on("meta", function(meta) {
            state2.file.size = meta.size;
            state2.file.filename = meta.filename;
            if (meta.source) {
              origin = FileOrigin.LIMBO;
              state2.serverFileReference = meta.source;
              state2.status = ItemStatus.PROCESSING_COMPLETE;
            }
            fire("load-meta");
          });
          loader.on("progress", function(progress) {
            setStatus(ItemStatus.LOADING);
            fire("load-progress", progress);
          });
          loader.on("error", function(error2) {
            setStatus(ItemStatus.LOAD_ERROR);
            fire("load-request-error", error2);
          });
          loader.on("abort", function() {
            setStatus(ItemStatus.INIT);
            fire("load-abort");
          });
          loader.on("load", function(file3) {
            state2.activeLoader = null;
            var success = function success2(result) {
              state2.file = isFile(result) ? result : state2.file;
              if (origin === FileOrigin.LIMBO && state2.serverFileReference) {
                setStatus(ItemStatus.PROCESSING_COMPLETE);
              } else {
                setStatus(ItemStatus.IDLE);
              }
              fire("load");
            };
            var error2 = function error3(result) {
              state2.file = file3;
              fire("load-meta");
              setStatus(ItemStatus.LOAD_ERROR);
              fire("load-file-error", result);
            };
            if (state2.serverFileReference) {
              success(file3);
              return;
            }
            onload(file3, success, error2);
          });
          loader.setSource(source);
          state2.activeLoader = loader;
          loader.load();
        };
        var retryLoad = function retryLoad2() {
          if (!state2.activeLoader) {
            return;
          }
          state2.activeLoader.load();
        };
        var abortLoad = function abortLoad2() {
          if (state2.activeLoader) {
            state2.activeLoader.abort();
            return;
          }
          setStatus(ItemStatus.INIT);
          fire("load-abort");
        };
        var process = function process2(processor, onprocess) {
          if (state2.processingAborted) {
            state2.processingAborted = false;
            return;
          }
          setStatus(ItemStatus.PROCESSING);
          abortProcessingRequestComplete = null;
          if (!(state2.file instanceof Blob)) {
            api.on("load", function() {
              process2(processor, onprocess);
            });
            return;
          }
          processor.on("load", function(serverFileReference2) {
            state2.transferId = null;
            state2.serverFileReference = serverFileReference2;
          });
          processor.on("transfer", function(transferId) {
            state2.transferId = transferId;
          });
          processor.on("load-perceived", function(serverFileReference2) {
            state2.activeProcessor = null;
            state2.transferId = null;
            state2.serverFileReference = serverFileReference2;
            setStatus(ItemStatus.PROCESSING_COMPLETE);
            fire("process-complete", serverFileReference2);
          });
          processor.on("start", function() {
            fire("process-start");
          });
          processor.on("error", function(error3) {
            state2.activeProcessor = null;
            setStatus(ItemStatus.PROCESSING_ERROR);
            fire("process-error", error3);
          });
          processor.on("abort", function(serverFileReference2) {
            state2.activeProcessor = null;
            state2.serverFileReference = serverFileReference2;
            setStatus(ItemStatus.IDLE);
            fire("process-abort");
            if (abortProcessingRequestComplete) {
              abortProcessingRequestComplete();
            }
          });
          processor.on("progress", function(progress) {
            fire("process-progress", progress);
          });
          var success = function success2(file3) {
            if (state2.archived) return;
            processor.process(file3, Object.assign({}, metadata));
          };
          var error2 = console.error;
          onprocess(state2.file, success, error2);
          state2.activeProcessor = processor;
        };
        var requestProcessing = function requestProcessing2() {
          state2.processingAborted = false;
          setStatus(ItemStatus.PROCESSING_QUEUED);
        };
        var abortProcessing = function abortProcessing2() {
          return new Promise(function(resolve) {
            if (!state2.activeProcessor) {
              state2.processingAborted = true;
              setStatus(ItemStatus.IDLE);
              fire("process-abort");
              resolve();
              return;
            }
            abortProcessingRequestComplete = function abortProcessingRequestComplete2() {
              resolve();
            };
            state2.activeProcessor.abort();
          });
        };
        var revert = function revert2(revertFileUpload, forceRevert) {
          return new Promise(function(resolve, reject) {
            var serverTransferId = state2.serverFileReference !== null ? state2.serverFileReference : state2.transferId;
            if (serverTransferId === null) {
              resolve();
              return;
            }
            revertFileUpload(
              serverTransferId,
              function() {
                state2.serverFileReference = null;
                state2.transferId = null;
                resolve();
              },
              function(error2) {
                if (!forceRevert) {
                  resolve();
                  return;
                }
                setStatus(ItemStatus.PROCESSING_REVERT_ERROR);
                fire("process-revert-error");
                reject(error2);
              }
            );
            setStatus(ItemStatus.IDLE);
            fire("process-revert");
          });
        };
        var _setMetadata = function setMetadata(key, value, silent) {
          var keys = key.split(".");
          var root2 = keys[0];
          var last = keys.pop();
          var data2 = metadata;
          keys.forEach(function(key2) {
            return data2 = data2[key2];
          });
          if (JSON.stringify(data2[last]) === JSON.stringify(value)) return;
          data2[last] = value;
          fire("metadata-update", {
            key: root2,
            value: metadata[root2],
            silent
          });
        };
        var getMetadata = function getMetadata2(key) {
          return deepCloneObject(key ? metadata[key] : metadata);
        };
        var api = Object.assign(
          {
            id: {
              get: function get() {
                return id2;
              }
            },
            origin: {
              get: function get() {
                return origin;
              },
              set: function set2(value) {
                return origin = value;
              }
            },
            serverId: {
              get: function get() {
                return state2.serverFileReference;
              }
            },
            transferId: {
              get: function get() {
                return state2.transferId;
              }
            },
            status: {
              get: function get() {
                return state2.status;
              }
            },
            filename: {
              get: function get() {
                return state2.file.name;
              }
            },
            filenameWithoutExtension: {
              get: function get() {
                return getFilenameWithoutExtension(state2.file.name);
              }
            },
            fileExtension: { get: getFileExtension },
            fileType: { get: getFileType },
            fileSize: { get: getFileSize },
            file: { get: getFile },
            relativePath: {
              get: function get() {
                return state2.file._relativePath;
              }
            },
            source: {
              get: function get() {
                return state2.source;
              }
            },
            getMetadata,
            setMetadata: function setMetadata(key, value, silent) {
              if (isObject(key)) {
                var data2 = key;
                Object.keys(data2).forEach(function(key2) {
                  _setMetadata(key2, data2[key2], value);
                });
                return key;
              }
              _setMetadata(key, value, silent);
              return value;
            },
            extend: function extend(name2, handler) {
              return itemAPI[name2] = handler;
            },
            abortLoad,
            retryLoad,
            requestProcessing,
            abortProcessing,
            load,
            process,
            revert
          },
          on(),
          {
            freeze: function freeze() {
              return state2.frozen = true;
            },
            release: function release() {
              return state2.released = true;
            },
            released: {
              get: function get() {
                return state2.released;
              }
            },
            archive: function archive() {
              return state2.archived = true;
            },
            archived: {
              get: function get() {
                return state2.archived;
              }
            },
            // replace source and file object
            setFile: function setFile(file3) {
              return state2.file = file3;
            }
          }
        );
        var itemAPI = createObject(api);
        return itemAPI;
      };
      var getItemIndexByQuery = function getItemIndexByQuery2(items, query) {
        if (isEmpty(query)) {
          return 0;
        }
        if (!isString(query)) {
          return -1;
        }
        return items.findIndex(function(item2) {
          return item2.id === query;
        });
      };
      var getItemById = function getItemById2(items, itemId) {
        var index = getItemIndexByQuery(items, itemId);
        if (index < 0) {
          return;
        }
        return items[index] || null;
      };
      var fetchBlob = function fetchBlob2(url, load, error2, progress, abort, headers) {
        var request = sendRequest(null, url, {
          method: "GET",
          responseType: "blob"
        });
        request.onload = function(xhr) {
          var headers2 = xhr.getAllResponseHeaders();
          var filename = getFileInfoFromHeaders(headers2).name || getFilenameFromURL(url);
          load(
            createResponse("load", xhr.status, getFileFromBlob(xhr.response, filename), headers2)
          );
        };
        request.onerror = function(xhr) {
          error2(createResponse("error", xhr.status, xhr.statusText, xhr.getAllResponseHeaders()));
        };
        request.onheaders = function(xhr) {
          headers(createResponse("headers", xhr.status, null, xhr.getAllResponseHeaders()));
        };
        request.ontimeout = createTimeoutResponse(error2);
        request.onprogress = progress;
        request.onabort = abort;
        return request;
      };
      var getDomainFromURL = function getDomainFromURL2(url) {
        if (url.indexOf("//") === 0) {
          url = location.protocol + url;
        }
        return url.toLowerCase().replace("blob:", "").replace(/([a-z])?:\/\//, "$1").split("/")[0];
      };
      var isExternalURL = function isExternalURL2(url) {
        return (url.indexOf(":") > -1 || url.indexOf("//") > -1) && getDomainFromURL(location.href) !== getDomainFromURL(url);
      };
      var dynamicLabel = function dynamicLabel2(label) {
        return function() {
          return isFunction(label) ? label.apply(void 0, arguments) : label;
        };
      };
      var isMockItem = function isMockItem2(item2) {
        return !isFile(item2.file);
      };
      var listUpdated = function listUpdated2(dispatch2, state2) {
        clearTimeout(state2.listUpdateTimeout);
        state2.listUpdateTimeout = setTimeout(function() {
          dispatch2("DID_UPDATE_ITEMS", { items: getActiveItems(state2.items) });
        }, 0);
      };
      var optionalPromise = function optionalPromise2(fn3) {
        for (var _len = arguments.length, params = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          params[_key - 1] = arguments[_key];
        }
        return new Promise(function(resolve) {
          if (!fn3) {
            return resolve(true);
          }
          var result = fn3.apply(void 0, params);
          if (result == null) {
            return resolve(true);
          }
          if (typeof result === "boolean") {
            return resolve(result);
          }
          if (typeof result.then === "function") {
            result.then(resolve);
          }
        });
      };
      var sortItems = function sortItems2(state2, compare) {
        state2.items.sort(function(a2, b3) {
          return compare(createItemAPI(a2), createItemAPI(b3));
        });
      };
      var getItemByQueryFromState = function getItemByQueryFromState2(state2, itemHandler) {
        return function() {
          var _ref = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
          var query = _ref.query, _ref$success = _ref.success, success = _ref$success === void 0 ? function() {
          } : _ref$success, _ref$failure = _ref.failure, failure = _ref$failure === void 0 ? function() {
          } : _ref$failure, options = _objectWithoutProperties(_ref, ["query", "success", "failure"]);
          var item2 = getItemByQuery(state2.items, query);
          if (!item2) {
            failure({
              error: createResponse("error", 0, "Item not found"),
              file: null
            });
            return;
          }
          itemHandler(item2, success, failure, options || {});
        };
      };
      var actions = function actions2(dispatch2, query, state2) {
        return {
          /**
           * Aborts all ongoing processes
           */
          ABORT_ALL: function ABORT_ALL() {
            getActiveItems(state2.items).forEach(function(item2) {
              item2.freeze();
              item2.abortLoad();
              item2.abortProcessing();
            });
          },
          /**
           * Sets initial files
           */
          DID_SET_FILES: function DID_SET_FILES(_ref2) {
            var _ref2$value = _ref2.value, value = _ref2$value === void 0 ? [] : _ref2$value;
            var files = value.map(function(file2) {
              return {
                source: file2.source ? file2.source : file2,
                options: file2.options
              };
            });
            var activeItems = getActiveItems(state2.items);
            activeItems.forEach(function(item2) {
              if (!files.find(function(file2) {
                return file2.source === item2.source || file2.source === item2.file;
              })) {
                dispatch2("REMOVE_ITEM", { query: item2, remove: false });
              }
            });
            activeItems = getActiveItems(state2.items);
            files.forEach(function(file2, index) {
              if (activeItems.find(function(item2) {
                return item2.source === file2.source || item2.file === file2.source;
              }))
                return;
              dispatch2(
                "ADD_ITEM",
                Object.assign({}, file2, {
                  interactionMethod: InteractionMethod.NONE,
                  index
                })
              );
            });
          },
          DID_UPDATE_ITEM_METADATA: function DID_UPDATE_ITEM_METADATA(_ref3) {
            var id2 = _ref3.id, action = _ref3.action, change = _ref3.change;
            if (change.silent) return;
            clearTimeout(state2.itemUpdateTimeout);
            state2.itemUpdateTimeout = setTimeout(function() {
              var item2 = getItemById(state2.items, id2);
              if (!query("IS_ASYNC")) {
                applyFilterChain("SHOULD_PREPARE_OUTPUT", false, {
                  item: item2,
                  query,
                  action,
                  change
                }).then(function(shouldPrepareOutput) {
                  var beforePrepareFile = query("GET_BEFORE_PREPARE_FILE");
                  if (beforePrepareFile)
                    shouldPrepareOutput = beforePrepareFile(item2, shouldPrepareOutput);
                  if (!shouldPrepareOutput) return;
                  dispatch2(
                    "REQUEST_PREPARE_OUTPUT",
                    {
                      query: id2,
                      item: item2,
                      success: function success(file2) {
                        dispatch2("DID_PREPARE_OUTPUT", { id: id2, file: file2 });
                      }
                    },
                    true
                  );
                });
                return;
              }
              if (item2.origin === FileOrigin.LOCAL) {
                dispatch2("DID_LOAD_ITEM", {
                  id: item2.id,
                  error: null,
                  serverFileReference: item2.source
                });
              }
              var upload = function upload2() {
                setTimeout(function() {
                  dispatch2("REQUEST_ITEM_PROCESSING", { query: id2 });
                }, 32);
              };
              var revert = function revert2(doUpload) {
                item2.revert(
                  createRevertFunction(
                    state2.options.server.url,
                    state2.options.server.revert
                  ),
                  query("GET_FORCE_REVERT")
                ).then(doUpload ? upload : function() {
                }).catch(function() {
                });
              };
              var abort = function abort2(doUpload) {
                item2.abortProcessing().then(doUpload ? upload : function() {
                });
              };
              if (item2.status === ItemStatus.PROCESSING_COMPLETE) {
                return revert(state2.options.instantUpload);
              }
              if (item2.status === ItemStatus.PROCESSING) {
                return abort(state2.options.instantUpload);
              }
              if (state2.options.instantUpload) {
                upload();
              }
            }, 0);
          },
          MOVE_ITEM: function MOVE_ITEM(_ref4) {
            var query2 = _ref4.query, index = _ref4.index;
            var item2 = getItemByQuery(state2.items, query2);
            if (!item2) return;
            var currentIndex = state2.items.indexOf(item2);
            index = limit(index, 0, state2.items.length - 1);
            if (currentIndex === index) return;
            state2.items.splice(index, 0, state2.items.splice(currentIndex, 1)[0]);
          },
          SORT: function SORT(_ref5) {
            var compare = _ref5.compare;
            sortItems(state2, compare);
            dispatch2("DID_SORT_ITEMS", {
              items: query("GET_ACTIVE_ITEMS")
            });
          },
          ADD_ITEMS: function ADD_ITEMS(_ref6) {
            var items = _ref6.items, index = _ref6.index, interactionMethod = _ref6.interactionMethod, _ref6$success = _ref6.success, success = _ref6$success === void 0 ? function() {
            } : _ref6$success, _ref6$failure = _ref6.failure, failure = _ref6$failure === void 0 ? function() {
            } : _ref6$failure;
            var currentIndex = index;
            if (index === -1 || typeof index === "undefined") {
              var insertLocation = query("GET_ITEM_INSERT_LOCATION");
              var totalItems = query("GET_TOTAL_ITEMS");
              currentIndex = insertLocation === "before" ? 0 : totalItems;
            }
            var ignoredFiles = query("GET_IGNORED_FILES");
            var isValidFile = function isValidFile2(source) {
              return isFile(source) ? !ignoredFiles.includes(source.name.toLowerCase()) : !isEmpty(source);
            };
            var validItems = items.filter(isValidFile);
            var promises = validItems.map(function(source) {
              return new Promise(function(resolve, reject) {
                dispatch2("ADD_ITEM", {
                  interactionMethod,
                  source: source.source || source,
                  success: resolve,
                  failure: reject,
                  index: currentIndex++,
                  options: source.options || {}
                });
              });
            });
            Promise.all(promises).then(success).catch(failure);
          },
          /**
           * @param source
           * @param index
           * @param interactionMethod
           */
          ADD_ITEM: function ADD_ITEM(_ref7) {
            var source = _ref7.source, _ref7$index = _ref7.index, index = _ref7$index === void 0 ? -1 : _ref7$index, interactionMethod = _ref7.interactionMethod, _ref7$success = _ref7.success, success = _ref7$success === void 0 ? function() {
            } : _ref7$success, _ref7$failure = _ref7.failure, failure = _ref7$failure === void 0 ? function() {
            } : _ref7$failure, _ref7$options = _ref7.options, options = _ref7$options === void 0 ? {} : _ref7$options;
            if (isEmpty(source)) {
              failure({
                error: createResponse("error", 0, "No source"),
                file: null
              });
              return;
            }
            if (isFile(source) && state2.options.ignoredFiles.includes(source.name.toLowerCase())) {
              return;
            }
            if (!hasRoomForItem(state2)) {
              if (state2.options.allowMultiple || !state2.options.allowMultiple && !state2.options.allowReplace) {
                var error2 = createResponse("warning", 0, "Max files");
                dispatch2("DID_THROW_MAX_FILES", {
                  source,
                  error: error2
                });
                failure({ error: error2, file: null });
                return;
              }
              var _item = getActiveItems(state2.items)[0];
              if (_item.status === ItemStatus.PROCESSING_COMPLETE || _item.status === ItemStatus.PROCESSING_REVERT_ERROR) {
                var forceRevert = query("GET_FORCE_REVERT");
                _item.revert(
                  createRevertFunction(
                    state2.options.server.url,
                    state2.options.server.revert
                  ),
                  forceRevert
                ).then(function() {
                  if (!forceRevert) return;
                  dispatch2("ADD_ITEM", {
                    source,
                    index,
                    interactionMethod,
                    success,
                    failure,
                    options
                  });
                }).catch(function() {
                });
                if (forceRevert) return;
              }
              dispatch2("REMOVE_ITEM", { query: _item.id });
            }
            var origin = options.type === "local" ? FileOrigin.LOCAL : options.type === "limbo" ? FileOrigin.LIMBO : FileOrigin.INPUT;
            var item2 = createItem(
              // where did this file come from
              origin,
              // an input file never has a server file reference
              origin === FileOrigin.INPUT ? null : source,
              // file mock data, if defined
              options.file
            );
            Object.keys(options.metadata || {}).forEach(function(key) {
              item2.setMetadata(key, options.metadata[key]);
            });
            applyFilters("DID_CREATE_ITEM", item2, { query, dispatch: dispatch2 });
            var itemInsertLocation = query("GET_ITEM_INSERT_LOCATION");
            if (!state2.options.itemInsertLocationFreedom) {
              index = itemInsertLocation === "before" ? -1 : state2.items.length;
            }
            insertItem(state2.items, item2, index);
            if (isFunction(itemInsertLocation) && source) {
              sortItems(state2, itemInsertLocation);
            }
            var id2 = item2.id;
            item2.on("init", function() {
              dispatch2("DID_INIT_ITEM", { id: id2 });
            });
            item2.on("load-init", function() {
              dispatch2("DID_START_ITEM_LOAD", { id: id2 });
            });
            item2.on("load-meta", function() {
              dispatch2("DID_UPDATE_ITEM_META", { id: id2 });
            });
            item2.on("load-progress", function(progress) {
              dispatch2("DID_UPDATE_ITEM_LOAD_PROGRESS", { id: id2, progress });
            });
            item2.on("load-request-error", function(error3) {
              var mainStatus = dynamicLabel(state2.options.labelFileLoadError)(error3);
              if (error3.code >= 400 && error3.code < 500) {
                dispatch2("DID_THROW_ITEM_INVALID", {
                  id: id2,
                  error: error3,
                  status: {
                    main: mainStatus,
                    sub: error3.code + " (" + error3.body + ")"
                  }
                });
                failure({ error: error3, file: createItemAPI(item2) });
                return;
              }
              dispatch2("DID_THROW_ITEM_LOAD_ERROR", {
                id: id2,
                error: error3,
                status: {
                  main: mainStatus,
                  sub: state2.options.labelTapToRetry
                }
              });
            });
            item2.on("load-file-error", function(error3) {
              dispatch2("DID_THROW_ITEM_INVALID", {
                id: id2,
                error: error3.status,
                status: error3.status
              });
              failure({ error: error3.status, file: createItemAPI(item2) });
            });
            item2.on("load-abort", function() {
              dispatch2("REMOVE_ITEM", { query: id2 });
            });
            item2.on("load-skip", function() {
              item2.on("metadata-update", function(change) {
                if (!isFile(item2.file)) return;
                dispatch2("DID_UPDATE_ITEM_METADATA", { id: id2, change });
              });
              dispatch2("COMPLETE_LOAD_ITEM", {
                query: id2,
                item: item2,
                data: {
                  source,
                  success
                }
              });
            });
            item2.on("load", function() {
              var handleAdd = function handleAdd2(shouldAdd) {
                if (!shouldAdd) {
                  dispatch2("REMOVE_ITEM", {
                    query: id2
                  });
                  return;
                }
                item2.on("metadata-update", function(change) {
                  dispatch2("DID_UPDATE_ITEM_METADATA", { id: id2, change });
                });
                applyFilterChain("SHOULD_PREPARE_OUTPUT", false, {
                  item: item2,
                  query
                }).then(function(shouldPrepareOutput) {
                  var beforePrepareFile = query("GET_BEFORE_PREPARE_FILE");
                  if (beforePrepareFile)
                    shouldPrepareOutput = beforePrepareFile(item2, shouldPrepareOutput);
                  var loadComplete = function loadComplete2() {
                    dispatch2("COMPLETE_LOAD_ITEM", {
                      query: id2,
                      item: item2,
                      data: {
                        source,
                        success
                      }
                    });
                    listUpdated(dispatch2, state2);
                  };
                  if (shouldPrepareOutput) {
                    dispatch2(
                      "REQUEST_PREPARE_OUTPUT",
                      {
                        query: id2,
                        item: item2,
                        success: function success2(file2) {
                          dispatch2("DID_PREPARE_OUTPUT", { id: id2, file: file2 });
                          loadComplete();
                        }
                      },
                      true
                    );
                    return;
                  }
                  loadComplete();
                });
              };
              applyFilterChain("DID_LOAD_ITEM", item2, { query, dispatch: dispatch2 }).then(function() {
                optionalPromise(query("GET_BEFORE_ADD_FILE"), createItemAPI(item2)).then(
                  handleAdd
                );
              }).catch(function(e) {
                if (!e || !e.error || !e.status) return handleAdd(false);
                dispatch2("DID_THROW_ITEM_INVALID", {
                  id: id2,
                  error: e.error,
                  status: e.status
                });
              });
            });
            item2.on("process-start", function() {
              dispatch2("DID_START_ITEM_PROCESSING", { id: id2 });
            });
            item2.on("process-progress", function(progress) {
              dispatch2("DID_UPDATE_ITEM_PROCESS_PROGRESS", { id: id2, progress });
            });
            item2.on("process-error", function(error3) {
              dispatch2("DID_THROW_ITEM_PROCESSING_ERROR", {
                id: id2,
                error: error3,
                status: {
                  main: dynamicLabel(state2.options.labelFileProcessingError)(error3),
                  sub: state2.options.labelTapToRetry
                }
              });
            });
            item2.on("process-revert-error", function(error3) {
              dispatch2("DID_THROW_ITEM_PROCESSING_REVERT_ERROR", {
                id: id2,
                error: error3,
                status: {
                  main: dynamicLabel(state2.options.labelFileProcessingRevertError)(error3),
                  sub: state2.options.labelTapToRetry
                }
              });
            });
            item2.on("process-complete", function(serverFileReference) {
              dispatch2("DID_COMPLETE_ITEM_PROCESSING", {
                id: id2,
                error: null,
                serverFileReference
              });
              dispatch2("DID_DEFINE_VALUE", { id: id2, value: serverFileReference });
            });
            item2.on("process-abort", function() {
              dispatch2("DID_ABORT_ITEM_PROCESSING", { id: id2 });
            });
            item2.on("process-revert", function() {
              dispatch2("DID_REVERT_ITEM_PROCESSING", { id: id2 });
              dispatch2("DID_DEFINE_VALUE", { id: id2, value: null });
            });
            dispatch2("DID_ADD_ITEM", {
              id: id2,
              index,
              interactionMethod
            });
            listUpdated(dispatch2, state2);
            var _ref8 = state2.options.server || {}, url = _ref8.url, load = _ref8.load, restore = _ref8.restore, fetch = _ref8.fetch;
            item2.load(
              source,
              // this creates a function that loads the file based on the type of file (string, base64, blob, file) and location of file (local, remote, limbo)
              createFileLoader(
                origin === FileOrigin.INPUT ? (
                  // input, if is remote, see if should use custom fetch, else use default fetchBlob
                  isString(source) && isExternalURL(source) ? fetch ? createFetchFunction(url, fetch) : fetchBlob : fetchBlob
                ) : (
                  // limbo or local
                  origin === FileOrigin.LIMBO ? createFetchFunction(url, restore) : createFetchFunction(url, load)
                )
                // local
              ),
              // called when the file is loaded so it can be piped through the filters
              function(file2, success2, error3) {
                applyFilterChain("LOAD_FILE", file2, { query }).then(success2).catch(error3);
              }
            );
          },
          REQUEST_PREPARE_OUTPUT: function REQUEST_PREPARE_OUTPUT(_ref9) {
            var item2 = _ref9.item, success = _ref9.success, _ref9$failure = _ref9.failure, failure = _ref9$failure === void 0 ? function() {
            } : _ref9$failure;
            var err = {
              error: createResponse("error", 0, "Item not found"),
              file: null
            };
            if (item2.archived) return failure(err);
            applyFilterChain("PREPARE_OUTPUT", item2.file, { query, item: item2 }).then(
              function(result) {
                applyFilterChain("COMPLETE_PREPARE_OUTPUT", result, {
                  query,
                  item: item2
                }).then(function(result2) {
                  if (item2.archived) return failure(err);
                  success(result2);
                });
              }
            );
          },
          COMPLETE_LOAD_ITEM: function COMPLETE_LOAD_ITEM(_ref10) {
            var item2 = _ref10.item, data2 = _ref10.data;
            var success = data2.success, source = data2.source;
            var itemInsertLocation = query("GET_ITEM_INSERT_LOCATION");
            if (isFunction(itemInsertLocation) && source) {
              sortItems(state2, itemInsertLocation);
            }
            dispatch2("DID_LOAD_ITEM", {
              id: item2.id,
              error: null,
              serverFileReference: item2.origin === FileOrigin.INPUT ? null : source
            });
            success(createItemAPI(item2));
            if (item2.origin === FileOrigin.LOCAL) {
              dispatch2("DID_LOAD_LOCAL_ITEM", { id: item2.id });
              return;
            }
            if (item2.origin === FileOrigin.LIMBO) {
              dispatch2("DID_COMPLETE_ITEM_PROCESSING", {
                id: item2.id,
                error: null,
                serverFileReference: source
              });
              dispatch2("DID_DEFINE_VALUE", {
                id: item2.id,
                value: item2.serverId || source
              });
              return;
            }
            if (query("IS_ASYNC") && state2.options.instantUpload) {
              dispatch2("REQUEST_ITEM_PROCESSING", { query: item2.id });
            }
          },
          RETRY_ITEM_LOAD: getItemByQueryFromState(state2, function(item2) {
            item2.retryLoad();
          }),
          REQUEST_ITEM_PREPARE: getItemByQueryFromState(state2, function(item2, _success, failure) {
            dispatch2(
              "REQUEST_PREPARE_OUTPUT",
              {
                query: item2.id,
                item: item2,
                success: function success(file2) {
                  dispatch2("DID_PREPARE_OUTPUT", { id: item2.id, file: file2 });
                  _success({
                    file: item2,
                    output: file2
                  });
                },
                failure
              },
              true
            );
          }),
          REQUEST_ITEM_PROCESSING: getItemByQueryFromState(state2, function(item2, success, failure) {
            var itemCanBeQueuedForProcessing = (
              // waiting for something
              item2.status === ItemStatus.IDLE || // processing went wrong earlier
              item2.status === ItemStatus.PROCESSING_ERROR
            );
            if (!itemCanBeQueuedForProcessing) {
              var processNow = function processNow2() {
                return dispatch2("REQUEST_ITEM_PROCESSING", {
                  query: item2,
                  success,
                  failure
                });
              };
              var process = function process2() {
                return document.hidden ? processNow() : setTimeout(processNow, 32);
              };
              if (item2.status === ItemStatus.PROCESSING_COMPLETE || item2.status === ItemStatus.PROCESSING_REVERT_ERROR) {
                item2.revert(
                  createRevertFunction(
                    state2.options.server.url,
                    state2.options.server.revert
                  ),
                  query("GET_FORCE_REVERT")
                ).then(process).catch(function() {
                });
              } else if (item2.status === ItemStatus.PROCESSING) {
                item2.abortProcessing().then(process);
              }
              return;
            }
            if (item2.status === ItemStatus.PROCESSING_QUEUED) return;
            item2.requestProcessing();
            dispatch2("DID_REQUEST_ITEM_PROCESSING", { id: item2.id });
            dispatch2("PROCESS_ITEM", { query: item2, success, failure }, true);
          }),
          PROCESS_ITEM: getItemByQueryFromState(state2, function(item2, success, failure) {
            var maxParallelUploads = query("GET_MAX_PARALLEL_UPLOADS");
            var totalCurrentUploads = query("GET_ITEMS_BY_STATUS", ItemStatus.PROCESSING).length;
            if (totalCurrentUploads === maxParallelUploads) {
              state2.processingQueue.push({
                id: item2.id,
                success,
                failure
              });
              return;
            }
            if (item2.status === ItemStatus.PROCESSING) return;
            var processNext = function processNext2() {
              var queueEntry = state2.processingQueue.shift();
              if (!queueEntry) return;
              var id2 = queueEntry.id, success2 = queueEntry.success, failure2 = queueEntry.failure;
              var itemReference = getItemByQuery(state2.items, id2);
              if (!itemReference || itemReference.archived) {
                processNext2();
                return;
              }
              dispatch2(
                "PROCESS_ITEM",
                { query: id2, success: success2, failure: failure2 },
                true
              );
            };
            item2.onOnce("process-complete", function() {
              success(createItemAPI(item2));
              processNext();
              var server = state2.options.server;
              var instantUpload = state2.options.instantUpload;
              if (instantUpload && item2.origin === FileOrigin.LOCAL && isFunction(server.remove)) {
                var noop2 = function noop3() {
                };
                item2.origin = FileOrigin.LIMBO;
                state2.options.server.remove(item2.source, noop2, noop2);
              }
              var allItemsProcessed = query("GET_ITEMS_BY_STATUS", ItemStatus.PROCESSING_COMPLETE).length === state2.items.length;
              if (allItemsProcessed) {
                dispatch2("DID_COMPLETE_ITEM_PROCESSING_ALL");
              }
            });
            item2.onOnce("process-error", function(error2) {
              failure({ error: error2, file: createItemAPI(item2) });
              processNext();
            });
            item2.onOnce("process-abort", function() {
              processNext();
            });
            var options = state2.options;
            item2.process(
              createFileProcessor(
                createProcessorFunction(
                  options.server.url,
                  options.server.process,
                  options.name,
                  {
                    chunkTransferId: item2.transferId,
                    chunkServer: options.server.patch,
                    chunkUploads: options.chunkUploads,
                    chunkForce: options.chunkForce,
                    chunkSize: options.chunkSize,
                    chunkRetryDelays: options.chunkRetryDelays
                  }
                ),
                {
                  allowMinimumUploadDuration: query("GET_ALLOW_MINIMUM_UPLOAD_DURATION")
                }
              ),
              // called when the file is about to be processed so it can be piped through the transform filters
              function(file2, success2, error2) {
                applyFilterChain("PREPARE_OUTPUT", file2, { query, item: item2 }).then(function(file3) {
                  dispatch2("DID_PREPARE_OUTPUT", { id: item2.id, file: file3 });
                  success2(file3);
                }).catch(error2);
              }
            );
          }),
          RETRY_ITEM_PROCESSING: getItemByQueryFromState(state2, function(item2) {
            dispatch2("REQUEST_ITEM_PROCESSING", { query: item2 });
          }),
          REQUEST_REMOVE_ITEM: getItemByQueryFromState(state2, function(item2) {
            optionalPromise(query("GET_BEFORE_REMOVE_FILE"), createItemAPI(item2)).then(function(shouldRemove) {
              if (!shouldRemove) {
                return;
              }
              dispatch2("REMOVE_ITEM", { query: item2 });
            });
          }),
          RELEASE_ITEM: getItemByQueryFromState(state2, function(item2) {
            item2.release();
          }),
          REMOVE_ITEM: getItemByQueryFromState(state2, function(item2, success, failure, options) {
            var removeFromView = function removeFromView2() {
              var id2 = item2.id;
              getItemById(state2.items, id2).archive();
              dispatch2("DID_REMOVE_ITEM", { error: null, id: id2, item: item2 });
              listUpdated(dispatch2, state2);
              success(createItemAPI(item2));
            };
            var server = state2.options.server;
            if (item2.origin === FileOrigin.LOCAL && server && isFunction(server.remove) && options.remove !== false) {
              dispatch2("DID_START_ITEM_REMOVE", { id: item2.id });
              server.remove(
                item2.source,
                function() {
                  return removeFromView();
                },
                function(status) {
                  dispatch2("DID_THROW_ITEM_REMOVE_ERROR", {
                    id: item2.id,
                    error: createResponse("error", 0, status, null),
                    status: {
                      main: dynamicLabel(state2.options.labelFileRemoveError)(status),
                      sub: state2.options.labelTapToRetry
                    }
                  });
                }
              );
            } else {
              if (options.revert && item2.origin !== FileOrigin.LOCAL && item2.serverId !== null || // if chunked uploads are enabled and we're uploading in chunks for this specific file
              // or if the file isn't big enough for chunked uploads but chunkForce is set then call
              // revert before removing from the view...
              state2.options.chunkUploads && item2.file.size > state2.options.chunkSize || state2.options.chunkUploads && state2.options.chunkForce) {
                item2.revert(
                  createRevertFunction(
                    state2.options.server.url,
                    state2.options.server.revert
                  ),
                  query("GET_FORCE_REVERT")
                );
              }
              removeFromView();
            }
          }),
          ABORT_ITEM_LOAD: getItemByQueryFromState(state2, function(item2) {
            item2.abortLoad();
          }),
          ABORT_ITEM_PROCESSING: getItemByQueryFromState(state2, function(item2) {
            if (item2.serverId) {
              dispatch2("REVERT_ITEM_PROCESSING", { id: item2.id });
              return;
            }
            item2.abortProcessing().then(function() {
              var shouldRemove = state2.options.instantUpload;
              if (shouldRemove) {
                dispatch2("REMOVE_ITEM", { query: item2.id });
              }
            });
          }),
          REQUEST_REVERT_ITEM_PROCESSING: getItemByQueryFromState(state2, function(item2) {
            if (!state2.options.instantUpload) {
              dispatch2("REVERT_ITEM_PROCESSING", { query: item2 });
              return;
            }
            var handleRevert = function handleRevert2(shouldRevert) {
              if (!shouldRevert) return;
              dispatch2("REVERT_ITEM_PROCESSING", { query: item2 });
            };
            var fn3 = query("GET_BEFORE_REMOVE_FILE");
            if (!fn3) {
              return handleRevert(true);
            }
            var requestRemoveResult = fn3(createItemAPI(item2));
            if (requestRemoveResult == null) {
              return handleRevert(true);
            }
            if (typeof requestRemoveResult === "boolean") {
              return handleRevert(requestRemoveResult);
            }
            if (typeof requestRemoveResult.then === "function") {
              requestRemoveResult.then(handleRevert);
            }
          }),
          REVERT_ITEM_PROCESSING: getItemByQueryFromState(state2, function(item2) {
            item2.revert(
              createRevertFunction(state2.options.server.url, state2.options.server.revert),
              query("GET_FORCE_REVERT")
            ).then(function() {
              var shouldRemove = state2.options.instantUpload || isMockItem(item2);
              if (shouldRemove) {
                dispatch2("REMOVE_ITEM", { query: item2.id });
              }
            }).catch(function() {
            });
          }),
          SET_OPTIONS: function SET_OPTIONS(_ref11) {
            var options = _ref11.options;
            var optionKeys = Object.keys(options);
            var prioritizedOptionKeys = PrioritizedOptions.filter(function(key) {
              return optionKeys.includes(key);
            });
            var orderedOptionKeys = [].concat(
              _toConsumableArray(prioritizedOptionKeys),
              _toConsumableArray(
                Object.keys(options).filter(function(key) {
                  return !prioritizedOptionKeys.includes(key);
                })
              )
            );
            orderedOptionKeys.forEach(function(key) {
              dispatch2("SET_" + fromCamels(key, "_").toUpperCase(), {
                value: options[key]
              });
            });
          }
        };
      };
      var PrioritizedOptions = ["server"];
      var formatFilename = function formatFilename2(name2) {
        return name2;
      };
      var createElement$1 = function createElement2(tagName) {
        return document.createElement(tagName);
      };
      var text = function text2(node, value) {
        var textNode = node.childNodes[0];
        if (!textNode) {
          textNode = document.createTextNode(value);
          node.appendChild(textNode);
        } else if (value !== textNode.nodeValue) {
          textNode.nodeValue = value;
        }
      };
      var polarToCartesian = function polarToCartesian2(centerX, centerY, radius, angleInDegrees) {
        var angleInRadians = (angleInDegrees % 360 - 90) * Math.PI / 180;
        return {
          x: centerX + radius * Math.cos(angleInRadians),
          y: centerY + radius * Math.sin(angleInRadians)
        };
      };
      var describeArc = function describeArc2(x2, y3, radius, startAngle, endAngle, arcSweep) {
        var start2 = polarToCartesian(x2, y3, radius, endAngle);
        var end2 = polarToCartesian(x2, y3, radius, startAngle);
        return ["M", start2.x, start2.y, "A", radius, radius, 0, arcSweep, 0, end2.x, end2.y].join(" ");
      };
      var percentageArc = function percentageArc2(x2, y3, radius, from, to) {
        var arcSweep = 1;
        if (to > from && to - from <= 0.5) {
          arcSweep = 0;
        }
        if (from > to && from - to >= 0.5) {
          arcSweep = 0;
        }
        return describeArc(
          x2,
          y3,
          radius,
          Math.min(0.9999, from) * 360,
          Math.min(0.9999, to) * 360,
          arcSweep
        );
      };
      var create = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        props.spin = false;
        props.progress = 0;
        props.opacity = 0;
        var svg = createElement("svg");
        root2.ref.path = createElement("path", {
          "stroke-width": 2,
          "stroke-linecap": "round"
        });
        svg.appendChild(root2.ref.path);
        root2.ref.svg = svg;
        root2.appendChild(svg);
      };
      var write2 = function write3(_ref2) {
        var root2 = _ref2.root, props = _ref2.props;
        if (props.opacity === 0) {
          return;
        }
        if (props.align) {
          root2.element.dataset.align = props.align;
        }
        var ringStrokeWidth = parseInt(attr(root2.ref.path, "stroke-width"), 10);
        var size = root2.rect.element.width * 0.5;
        var ringFrom = 0;
        var ringTo = 0;
        if (props.spin) {
          ringFrom = 0;
          ringTo = 0.5;
        } else {
          ringFrom = 0;
          ringTo = props.progress;
        }
        var coordinates = percentageArc(size, size, size - ringStrokeWidth, ringFrom, ringTo);
        attr(root2.ref.path, "d", coordinates);
        attr(root2.ref.path, "stroke-opacity", props.spin || props.progress > 0 ? 1 : 0);
      };
      var progressIndicator = createView({
        tag: "div",
        name: "progress-indicator",
        ignoreRectUpdate: true,
        ignoreRect: true,
        create,
        write: write2,
        mixins: {
          apis: ["progress", "spin", "align"],
          styles: ["opacity"],
          animations: {
            opacity: { type: "tween", duration: 500 },
            progress: {
              type: "spring",
              stiffness: 0.95,
              damping: 0.65,
              mass: 10
            }
          }
        }
      });
      var create$1 = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        root2.element.innerHTML = (props.icon || "") + ("<span>" + props.label + "</span>");
        props.isDisabled = false;
      };
      var write$1 = function write3(_ref2) {
        var root2 = _ref2.root, props = _ref2.props;
        var isDisabled2 = props.isDisabled;
        var shouldDisable = root2.query("GET_DISABLED") || props.opacity === 0;
        if (shouldDisable && !isDisabled2) {
          props.isDisabled = true;
          attr(root2.element, "disabled", "disabled");
        } else if (!shouldDisable && isDisabled2) {
          props.isDisabled = false;
          root2.element.removeAttribute("disabled");
        }
      };
      var fileActionButton = createView({
        tag: "button",
        attributes: {
          type: "button"
        },
        ignoreRect: true,
        ignoreRectUpdate: true,
        name: "file-action-button",
        mixins: {
          apis: ["label"],
          styles: ["translateX", "translateY", "scaleX", "scaleY", "opacity"],
          animations: {
            scaleX: "spring",
            scaleY: "spring",
            translateX: "spring",
            translateY: "spring",
            opacity: { type: "tween", duration: 250 }
          },
          listeners: true
        },
        create: create$1,
        write: write$1
      });
      var toNaturalFileSize = function toNaturalFileSize2(bytes) {
        var decimalSeparator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : ".";
        var base = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 1e3;
        var options = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : {};
        var _options$labelBytes = options.labelBytes, labelBytes = _options$labelBytes === void 0 ? "bytes" : _options$labelBytes, _options$labelKilobyt = options.labelKilobytes, labelKilobytes = _options$labelKilobyt === void 0 ? "KB" : _options$labelKilobyt, _options$labelMegabyt = options.labelMegabytes, labelMegabytes = _options$labelMegabyt === void 0 ? "MB" : _options$labelMegabyt, _options$labelGigabyt = options.labelGigabytes, labelGigabytes = _options$labelGigabyt === void 0 ? "GB" : _options$labelGigabyt;
        bytes = Math.round(Math.abs(bytes));
        var KB = base;
        var MB = base * base;
        var GB = base * base * base;
        if (bytes < KB) {
          return bytes + " " + labelBytes;
        }
        if (bytes < MB) {
          return Math.floor(bytes / KB) + " " + labelKilobytes;
        }
        if (bytes < GB) {
          return removeDecimalsWhenZero(bytes / MB, 1, decimalSeparator) + " " + labelMegabytes;
        }
        return removeDecimalsWhenZero(bytes / GB, 2, decimalSeparator) + " " + labelGigabytes;
      };
      var removeDecimalsWhenZero = function removeDecimalsWhenZero2(value, decimalCount, separator) {
        return value.toFixed(decimalCount).split(".").filter(function(part) {
          return part !== "0";
        }).join(separator);
      };
      var create$2 = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        var fileName = createElement$1("span");
        fileName.className = "filepond--file-info-main";
        attr(fileName, "aria-hidden", "true");
        root2.appendChild(fileName);
        root2.ref.fileName = fileName;
        var fileSize = createElement$1("span");
        fileSize.className = "filepond--file-info-sub";
        root2.appendChild(fileSize);
        root2.ref.fileSize = fileSize;
        text(fileSize, root2.query("GET_LABEL_FILE_WAITING_FOR_SIZE"));
        text(fileName, formatFilename(root2.query("GET_ITEM_NAME", props.id)));
      };
      var updateFile = function updateFile2(_ref2) {
        var root2 = _ref2.root, props = _ref2.props;
        text(
          root2.ref.fileSize,
          toNaturalFileSize(
            root2.query("GET_ITEM_SIZE", props.id),
            ".",
            root2.query("GET_FILE_SIZE_BASE"),
            root2.query("GET_FILE_SIZE_LABELS", root2.query)
          )
        );
        text(root2.ref.fileName, formatFilename(root2.query("GET_ITEM_NAME", props.id)));
      };
      var updateFileSizeOnError = function updateFileSizeOnError2(_ref3) {
        var root2 = _ref3.root, props = _ref3.props;
        if (isInt(root2.query("GET_ITEM_SIZE", props.id))) {
          updateFile({ root: root2, props });
          return;
        }
        text(root2.ref.fileSize, root2.query("GET_LABEL_FILE_SIZE_NOT_AVAILABLE"));
      };
      var fileInfo = createView({
        name: "file-info",
        ignoreRect: true,
        ignoreRectUpdate: true,
        write: createRoute({
          DID_LOAD_ITEM: updateFile,
          DID_UPDATE_ITEM_META: updateFile,
          DID_THROW_ITEM_LOAD_ERROR: updateFileSizeOnError,
          DID_THROW_ITEM_INVALID: updateFileSizeOnError
        }),
        didCreateView: function didCreateView(root2) {
          applyFilters("CREATE_VIEW", Object.assign({}, root2, { view: root2 }));
        },
        create: create$2,
        mixins: {
          styles: ["translateX", "translateY"],
          animations: {
            translateX: "spring",
            translateY: "spring"
          }
        }
      });
      var toPercentage = function toPercentage2(value) {
        return Math.round(value * 100);
      };
      var create$3 = function create2(_ref) {
        var root2 = _ref.root;
        var main2 = createElement$1("span");
        main2.className = "filepond--file-status-main";
        root2.appendChild(main2);
        root2.ref.main = main2;
        var sub = createElement$1("span");
        sub.className = "filepond--file-status-sub";
        root2.appendChild(sub);
        root2.ref.sub = sub;
        didSetItemLoadProgress({ root: root2, action: { progress: null } });
      };
      var didSetItemLoadProgress = function didSetItemLoadProgress2(_ref2) {
        var root2 = _ref2.root, action = _ref2.action;
        var title = action.progress === null ? root2.query("GET_LABEL_FILE_LOADING") : root2.query("GET_LABEL_FILE_LOADING") + " " + toPercentage(action.progress) + "%";
        text(root2.ref.main, title);
        text(root2.ref.sub, root2.query("GET_LABEL_TAP_TO_CANCEL"));
      };
      var didSetItemProcessProgress = function didSetItemProcessProgress2(_ref3) {
        var root2 = _ref3.root, action = _ref3.action;
        var title = action.progress === null ? root2.query("GET_LABEL_FILE_PROCESSING") : root2.query("GET_LABEL_FILE_PROCESSING") + " " + toPercentage(action.progress) + "%";
        text(root2.ref.main, title);
        text(root2.ref.sub, root2.query("GET_LABEL_TAP_TO_CANCEL"));
      };
      var didRequestItemProcessing = function didRequestItemProcessing2(_ref4) {
        var root2 = _ref4.root;
        text(root2.ref.main, root2.query("GET_LABEL_FILE_PROCESSING"));
        text(root2.ref.sub, root2.query("GET_LABEL_TAP_TO_CANCEL"));
      };
      var didAbortItemProcessing = function didAbortItemProcessing2(_ref5) {
        var root2 = _ref5.root;
        text(root2.ref.main, root2.query("GET_LABEL_FILE_PROCESSING_ABORTED"));
        text(root2.ref.sub, root2.query("GET_LABEL_TAP_TO_RETRY"));
      };
      var didCompleteItemProcessing = function didCompleteItemProcessing2(_ref6) {
        var root2 = _ref6.root;
        text(root2.ref.main, root2.query("GET_LABEL_FILE_PROCESSING_COMPLETE"));
        text(root2.ref.sub, root2.query("GET_LABEL_TAP_TO_UNDO"));
      };
      var clear = function clear2(_ref7) {
        var root2 = _ref7.root;
        text(root2.ref.main, "");
        text(root2.ref.sub, "");
      };
      var error = function error2(_ref8) {
        var root2 = _ref8.root, action = _ref8.action;
        text(root2.ref.main, action.status.main);
        text(root2.ref.sub, action.status.sub);
      };
      var fileStatus = createView({
        name: "file-status",
        ignoreRect: true,
        ignoreRectUpdate: true,
        write: createRoute({
          DID_LOAD_ITEM: clear,
          DID_REVERT_ITEM_PROCESSING: clear,
          DID_REQUEST_ITEM_PROCESSING: didRequestItemProcessing,
          DID_ABORT_ITEM_PROCESSING: didAbortItemProcessing,
          DID_COMPLETE_ITEM_PROCESSING: didCompleteItemProcessing,
          DID_UPDATE_ITEM_PROCESS_PROGRESS: didSetItemProcessProgress,
          DID_UPDATE_ITEM_LOAD_PROGRESS: didSetItemLoadProgress,
          DID_THROW_ITEM_LOAD_ERROR: error,
          DID_THROW_ITEM_INVALID: error,
          DID_THROW_ITEM_PROCESSING_ERROR: error,
          DID_THROW_ITEM_PROCESSING_REVERT_ERROR: error,
          DID_THROW_ITEM_REMOVE_ERROR: error
        }),
        didCreateView: function didCreateView(root2) {
          applyFilters("CREATE_VIEW", Object.assign({}, root2, { view: root2 }));
        },
        create: create$3,
        mixins: {
          styles: ["translateX", "translateY", "opacity"],
          animations: {
            opacity: { type: "tween", duration: 250 },
            translateX: "spring",
            translateY: "spring"
          }
        }
      });
      var Buttons = {
        AbortItemLoad: {
          label: "GET_LABEL_BUTTON_ABORT_ITEM_LOAD",
          action: "ABORT_ITEM_LOAD",
          className: "filepond--action-abort-item-load",
          align: "LOAD_INDICATOR_POSITION"
          // right
        },
        RetryItemLoad: {
          label: "GET_LABEL_BUTTON_RETRY_ITEM_LOAD",
          action: "RETRY_ITEM_LOAD",
          icon: "GET_ICON_RETRY",
          className: "filepond--action-retry-item-load",
          align: "BUTTON_PROCESS_ITEM_POSITION"
          // right
        },
        RemoveItem: {
          label: "GET_LABEL_BUTTON_REMOVE_ITEM",
          action: "REQUEST_REMOVE_ITEM",
          icon: "GET_ICON_REMOVE",
          className: "filepond--action-remove-item",
          align: "BUTTON_REMOVE_ITEM_POSITION"
          // left
        },
        ProcessItem: {
          label: "GET_LABEL_BUTTON_PROCESS_ITEM",
          action: "REQUEST_ITEM_PROCESSING",
          icon: "GET_ICON_PROCESS",
          className: "filepond--action-process-item",
          align: "BUTTON_PROCESS_ITEM_POSITION"
          // right
        },
        AbortItemProcessing: {
          label: "GET_LABEL_BUTTON_ABORT_ITEM_PROCESSING",
          action: "ABORT_ITEM_PROCESSING",
          className: "filepond--action-abort-item-processing",
          align: "BUTTON_PROCESS_ITEM_POSITION"
          // right
        },
        RetryItemProcessing: {
          label: "GET_LABEL_BUTTON_RETRY_ITEM_PROCESSING",
          action: "RETRY_ITEM_PROCESSING",
          icon: "GET_ICON_RETRY",
          className: "filepond--action-retry-item-processing",
          align: "BUTTON_PROCESS_ITEM_POSITION"
          // right
        },
        RevertItemProcessing: {
          label: "GET_LABEL_BUTTON_UNDO_ITEM_PROCESSING",
          action: "REQUEST_REVERT_ITEM_PROCESSING",
          icon: "GET_ICON_UNDO",
          className: "filepond--action-revert-item-processing",
          align: "BUTTON_PROCESS_ITEM_POSITION"
          // right
        }
      };
      var ButtonKeys = [];
      forin(Buttons, function(key) {
        ButtonKeys.push(key);
      });
      var calculateFileInfoOffset = function calculateFileInfoOffset2(root2) {
        if (getRemoveIndicatorAligment(root2) === "right") return 0;
        var buttonRect = root2.ref.buttonRemoveItem.rect.element;
        return buttonRect.hidden ? null : buttonRect.width + buttonRect.left;
      };
      var calculateButtonWidth = function calculateButtonWidth2(root2) {
        var buttonRect = root2.ref.buttonAbortItemLoad.rect.element;
        return buttonRect.width;
      };
      var calculateFileVerticalCenterOffset = function calculateFileVerticalCenterOffset2(root2) {
        return Math.floor(root2.ref.buttonRemoveItem.rect.element.height / 4);
      };
      var calculateFileHorizontalCenterOffset = function calculateFileHorizontalCenterOffset2(root2) {
        return Math.floor(root2.ref.buttonRemoveItem.rect.element.left / 2);
      };
      var getLoadIndicatorAlignment = function getLoadIndicatorAlignment2(root2) {
        return root2.query("GET_STYLE_LOAD_INDICATOR_POSITION");
      };
      var getProcessIndicatorAlignment = function getProcessIndicatorAlignment2(root2) {
        return root2.query("GET_STYLE_PROGRESS_INDICATOR_POSITION");
      };
      var getRemoveIndicatorAligment = function getRemoveIndicatorAligment2(root2) {
        return root2.query("GET_STYLE_BUTTON_REMOVE_ITEM_POSITION");
      };
      var DefaultStyle = {
        buttonAbortItemLoad: { opacity: 0 },
        buttonRetryItemLoad: { opacity: 0 },
        buttonRemoveItem: { opacity: 0 },
        buttonProcessItem: { opacity: 0 },
        buttonAbortItemProcessing: { opacity: 0 },
        buttonRetryItemProcessing: { opacity: 0 },
        buttonRevertItemProcessing: { opacity: 0 },
        loadProgressIndicator: { opacity: 0, align: getLoadIndicatorAlignment },
        processProgressIndicator: { opacity: 0, align: getProcessIndicatorAlignment },
        processingCompleteIndicator: { opacity: 0, scaleX: 0.75, scaleY: 0.75 },
        info: { translateX: 0, translateY: 0, opacity: 0 },
        status: { translateX: 0, translateY: 0, opacity: 0 }
      };
      var IdleStyle = {
        buttonRemoveItem: { opacity: 1 },
        buttonProcessItem: { opacity: 1 },
        info: { translateX: calculateFileInfoOffset },
        status: { translateX: calculateFileInfoOffset }
      };
      var ProcessingStyle = {
        buttonAbortItemProcessing: { opacity: 1 },
        processProgressIndicator: { opacity: 1 },
        status: { opacity: 1 }
      };
      var StyleMap = {
        DID_THROW_ITEM_INVALID: {
          buttonRemoveItem: { opacity: 1 },
          info: { translateX: calculateFileInfoOffset },
          status: { translateX: calculateFileInfoOffset, opacity: 1 }
        },
        DID_START_ITEM_LOAD: {
          buttonAbortItemLoad: { opacity: 1 },
          loadProgressIndicator: { opacity: 1 },
          status: { opacity: 1 }
        },
        DID_THROW_ITEM_LOAD_ERROR: {
          buttonRetryItemLoad: { opacity: 1 },
          buttonRemoveItem: { opacity: 1 },
          info: { translateX: calculateFileInfoOffset },
          status: { opacity: 1 }
        },
        DID_START_ITEM_REMOVE: {
          processProgressIndicator: { opacity: 1, align: getRemoveIndicatorAligment },
          info: { translateX: calculateFileInfoOffset },
          status: { opacity: 0 }
        },
        DID_THROW_ITEM_REMOVE_ERROR: {
          processProgressIndicator: { opacity: 0, align: getRemoveIndicatorAligment },
          buttonRemoveItem: { opacity: 1 },
          info: { translateX: calculateFileInfoOffset },
          status: { opacity: 1, translateX: calculateFileInfoOffset }
        },
        DID_LOAD_ITEM: IdleStyle,
        DID_LOAD_LOCAL_ITEM: {
          buttonRemoveItem: { opacity: 1 },
          info: { translateX: calculateFileInfoOffset },
          status: { translateX: calculateFileInfoOffset }
        },
        DID_START_ITEM_PROCESSING: ProcessingStyle,
        DID_REQUEST_ITEM_PROCESSING: ProcessingStyle,
        DID_UPDATE_ITEM_PROCESS_PROGRESS: ProcessingStyle,
        DID_COMPLETE_ITEM_PROCESSING: {
          buttonRevertItemProcessing: { opacity: 1 },
          info: { opacity: 1 },
          status: { opacity: 1 }
        },
        DID_THROW_ITEM_PROCESSING_ERROR: {
          buttonRemoveItem: { opacity: 1 },
          buttonRetryItemProcessing: { opacity: 1 },
          status: { opacity: 1 },
          info: { translateX: calculateFileInfoOffset }
        },
        DID_THROW_ITEM_PROCESSING_REVERT_ERROR: {
          buttonRevertItemProcessing: { opacity: 1 },
          status: { opacity: 1 },
          info: { opacity: 1 }
        },
        DID_ABORT_ITEM_PROCESSING: {
          buttonRemoveItem: { opacity: 1 },
          buttonProcessItem: { opacity: 1 },
          info: { translateX: calculateFileInfoOffset },
          status: { opacity: 1 }
        },
        DID_REVERT_ITEM_PROCESSING: IdleStyle
      };
      var processingCompleteIndicatorView = createView({
        create: function create2(_ref) {
          var root2 = _ref.root;
          root2.element.innerHTML = root2.query("GET_ICON_DONE");
        },
        name: "processing-complete-indicator",
        ignoreRect: true,
        mixins: {
          styles: ["scaleX", "scaleY", "opacity"],
          animations: {
            scaleX: "spring",
            scaleY: "spring",
            opacity: { type: "tween", duration: 250 }
          }
        }
      });
      var create$4 = function create2(_ref2) {
        var root2 = _ref2.root, props = _ref2.props;
        var LocalButtons = Object.keys(Buttons).reduce(function(prev, curr) {
          prev[curr] = Object.assign({}, Buttons[curr]);
          return prev;
        }, {});
        var id2 = props.id;
        var allowRevert = root2.query("GET_ALLOW_REVERT");
        var allowRemove = root2.query("GET_ALLOW_REMOVE");
        var allowProcess = root2.query("GET_ALLOW_PROCESS");
        var instantUpload = root2.query("GET_INSTANT_UPLOAD");
        var isAsync2 = root2.query("IS_ASYNC");
        var alignRemoveItemButton = root2.query("GET_STYLE_BUTTON_REMOVE_ITEM_ALIGN");
        var buttonFilter;
        if (isAsync2) {
          if (allowProcess && !allowRevert) {
            buttonFilter = function buttonFilter2(key) {
              return !/RevertItemProcessing/.test(key);
            };
          } else if (!allowProcess && allowRevert) {
            buttonFilter = function buttonFilter2(key) {
              return !/ProcessItem|RetryItemProcessing|AbortItemProcessing/.test(key);
            };
          } else if (!allowProcess && !allowRevert) {
            buttonFilter = function buttonFilter2(key) {
              return !/Process/.test(key);
            };
          }
        } else {
          buttonFilter = function buttonFilter2(key) {
            return !/Process/.test(key);
          };
        }
        var enabledButtons = buttonFilter ? ButtonKeys.filter(buttonFilter) : ButtonKeys.concat();
        if (instantUpload && allowRevert) {
          LocalButtons["RevertItemProcessing"].label = "GET_LABEL_BUTTON_REMOVE_ITEM";
          LocalButtons["RevertItemProcessing"].icon = "GET_ICON_REMOVE";
        }
        if (isAsync2 && !allowRevert) {
          var map2 = StyleMap["DID_COMPLETE_ITEM_PROCESSING"];
          map2.info.translateX = calculateFileHorizontalCenterOffset;
          map2.info.translateY = calculateFileVerticalCenterOffset;
          map2.status.translateY = calculateFileVerticalCenterOffset;
          map2.processingCompleteIndicator = { opacity: 1, scaleX: 1, scaleY: 1 };
        }
        if (isAsync2 && !allowProcess) {
          [
            "DID_START_ITEM_PROCESSING",
            "DID_REQUEST_ITEM_PROCESSING",
            "DID_UPDATE_ITEM_PROCESS_PROGRESS",
            "DID_THROW_ITEM_PROCESSING_ERROR"
          ].forEach(function(key) {
            StyleMap[key].status.translateY = calculateFileVerticalCenterOffset;
          });
          StyleMap["DID_THROW_ITEM_PROCESSING_ERROR"].status.translateX = calculateButtonWidth;
        }
        if (alignRemoveItemButton && allowRevert) {
          LocalButtons["RevertItemProcessing"].align = "BUTTON_REMOVE_ITEM_POSITION";
          var _map = StyleMap["DID_COMPLETE_ITEM_PROCESSING"];
          _map.info.translateX = calculateFileInfoOffset;
          _map.status.translateY = calculateFileVerticalCenterOffset;
          _map.processingCompleteIndicator = { opacity: 1, scaleX: 1, scaleY: 1 };
        }
        if (!allowRemove) {
          LocalButtons["RemoveItem"].disabled = true;
        }
        forin(LocalButtons, function(key, definition) {
          var buttonView = root2.createChildView(fileActionButton, {
            label: root2.query(definition.label),
            icon: root2.query(definition.icon),
            opacity: 0
          });
          if (enabledButtons.includes(key)) {
            root2.appendChildView(buttonView);
          }
          if (definition.disabled) {
            buttonView.element.setAttribute("disabled", "disabled");
            buttonView.element.setAttribute("hidden", "hidden");
          }
          buttonView.element.dataset.align = root2.query("GET_STYLE_" + definition.align);
          buttonView.element.classList.add(definition.className);
          buttonView.on("click", function(e) {
            e.stopPropagation();
            if (definition.disabled) return;
            root2.dispatch(definition.action, { query: id2 });
          });
          root2.ref["button" + key] = buttonView;
        });
        root2.ref.processingCompleteIndicator = root2.appendChildView(
          root2.createChildView(processingCompleteIndicatorView)
        );
        root2.ref.processingCompleteIndicator.element.dataset.align = root2.query(
          "GET_STYLE_BUTTON_PROCESS_ITEM_POSITION"
        );
        root2.ref.info = root2.appendChildView(root2.createChildView(fileInfo, { id: id2 }));
        root2.ref.status = root2.appendChildView(root2.createChildView(fileStatus, { id: id2 }));
        var loadIndicatorView = root2.appendChildView(
          root2.createChildView(progressIndicator, {
            opacity: 0,
            align: root2.query("GET_STYLE_LOAD_INDICATOR_POSITION")
          })
        );
        loadIndicatorView.element.classList.add("filepond--load-indicator");
        root2.ref.loadProgressIndicator = loadIndicatorView;
        var progressIndicatorView = root2.appendChildView(
          root2.createChildView(progressIndicator, {
            opacity: 0,
            align: root2.query("GET_STYLE_PROGRESS_INDICATOR_POSITION")
          })
        );
        progressIndicatorView.element.classList.add("filepond--process-indicator");
        root2.ref.processProgressIndicator = progressIndicatorView;
        root2.ref.activeStyles = [];
      };
      var write$2 = function write3(_ref3) {
        var root2 = _ref3.root, actions2 = _ref3.actions, props = _ref3.props;
        route({ root: root2, actions: actions2, props });
        var action = actions2.concat().filter(function(action2) {
          return /^DID_/.test(action2.type);
        }).reverse().find(function(action2) {
          return StyleMap[action2.type];
        });
        if (action) {
          root2.ref.activeStyles = [];
          var stylesToApply = StyleMap[action.type];
          forin(DefaultStyle, function(name2, defaultStyles) {
            var control = root2.ref[name2];
            forin(defaultStyles, function(key, defaultValue) {
              var value = stylesToApply[name2] && typeof stylesToApply[name2][key] !== "undefined" ? stylesToApply[name2][key] : defaultValue;
              root2.ref.activeStyles.push({ control, key, value });
            });
          });
        }
        root2.ref.activeStyles.forEach(function(_ref4) {
          var control = _ref4.control, key = _ref4.key, value = _ref4.value;
          control[key] = typeof value === "function" ? value(root2) : value;
        });
      };
      var route = createRoute({
        DID_SET_LABEL_BUTTON_ABORT_ITEM_PROCESSING: function DID_SET_LABEL_BUTTON_ABORT_ITEM_PROCESSING(_ref5) {
          var root2 = _ref5.root, action = _ref5.action;
          root2.ref.buttonAbortItemProcessing.label = action.value;
        },
        DID_SET_LABEL_BUTTON_ABORT_ITEM_LOAD: function DID_SET_LABEL_BUTTON_ABORT_ITEM_LOAD(_ref6) {
          var root2 = _ref6.root, action = _ref6.action;
          root2.ref.buttonAbortItemLoad.label = action.value;
        },
        DID_SET_LABEL_BUTTON_ABORT_ITEM_REMOVAL: function DID_SET_LABEL_BUTTON_ABORT_ITEM_REMOVAL(_ref7) {
          var root2 = _ref7.root, action = _ref7.action;
          root2.ref.buttonAbortItemRemoval.label = action.value;
        },
        DID_REQUEST_ITEM_PROCESSING: function DID_REQUEST_ITEM_PROCESSING(_ref8) {
          var root2 = _ref8.root;
          root2.ref.processProgressIndicator.spin = true;
          root2.ref.processProgressIndicator.progress = 0;
        },
        DID_START_ITEM_LOAD: function DID_START_ITEM_LOAD(_ref9) {
          var root2 = _ref9.root;
          root2.ref.loadProgressIndicator.spin = true;
          root2.ref.loadProgressIndicator.progress = 0;
        },
        DID_START_ITEM_REMOVE: function DID_START_ITEM_REMOVE(_ref10) {
          var root2 = _ref10.root;
          root2.ref.processProgressIndicator.spin = true;
          root2.ref.processProgressIndicator.progress = 0;
        },
        DID_UPDATE_ITEM_LOAD_PROGRESS: function DID_UPDATE_ITEM_LOAD_PROGRESS(_ref11) {
          var root2 = _ref11.root, action = _ref11.action;
          root2.ref.loadProgressIndicator.spin = false;
          root2.ref.loadProgressIndicator.progress = action.progress;
        },
        DID_UPDATE_ITEM_PROCESS_PROGRESS: function DID_UPDATE_ITEM_PROCESS_PROGRESS(_ref12) {
          var root2 = _ref12.root, action = _ref12.action;
          root2.ref.processProgressIndicator.spin = false;
          root2.ref.processProgressIndicator.progress = action.progress;
        }
      });
      var file = createView({
        create: create$4,
        write: write$2,
        didCreateView: function didCreateView(root2) {
          applyFilters("CREATE_VIEW", Object.assign({}, root2, { view: root2 }));
        },
        name: "file"
      });
      var create$5 = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        root2.ref.fileName = createElement$1("legend");
        root2.appendChild(root2.ref.fileName);
        root2.ref.file = root2.appendChildView(root2.createChildView(file, { id: props.id }));
        root2.ref.data = false;
      };
      var didLoadItem = function didLoadItem2(_ref2) {
        var root2 = _ref2.root, props = _ref2.props;
        text(root2.ref.fileName, formatFilename(root2.query("GET_ITEM_NAME", props.id)));
      };
      var fileWrapper = createView({
        create: create$5,
        ignoreRect: true,
        write: createRoute({
          DID_LOAD_ITEM: didLoadItem
        }),
        didCreateView: function didCreateView(root2) {
          applyFilters("CREATE_VIEW", Object.assign({}, root2, { view: root2 }));
        },
        tag: "fieldset",
        name: "file-wrapper"
      });
      var PANEL_SPRING_PROPS = { type: "spring", damping: 0.6, mass: 7 };
      var create$6 = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        [
          {
            name: "top"
          },
          {
            name: "center",
            props: {
              translateY: null,
              scaleY: null
            },
            mixins: {
              animations: {
                scaleY: PANEL_SPRING_PROPS
              },
              styles: ["translateY", "scaleY"]
            }
          },
          {
            name: "bottom",
            props: {
              translateY: null
            },
            mixins: {
              animations: {
                translateY: PANEL_SPRING_PROPS
              },
              styles: ["translateY"]
            }
          }
        ].forEach(function(section) {
          createSection(root2, section, props.name);
        });
        root2.element.classList.add("filepond--" + props.name);
        root2.ref.scalable = null;
      };
      var createSection = function createSection2(root2, section, className) {
        var viewConstructor = createView({
          name: "panel-" + section.name + " filepond--" + className,
          mixins: section.mixins,
          ignoreRectUpdate: true
        });
        var view = root2.createChildView(viewConstructor, section.props);
        root2.ref[section.name] = root2.appendChildView(view);
      };
      var write$3 = function write3(_ref2) {
        var root2 = _ref2.root, props = _ref2.props;
        if (root2.ref.scalable === null || props.scalable !== root2.ref.scalable) {
          root2.ref.scalable = isBoolean(props.scalable) ? props.scalable : true;
          root2.element.dataset.scalable = root2.ref.scalable;
        }
        if (!props.height) return;
        var topRect = root2.ref.top.rect.element;
        var bottomRect = root2.ref.bottom.rect.element;
        var height = Math.max(topRect.height + bottomRect.height, props.height);
        root2.ref.center.translateY = topRect.height;
        root2.ref.center.scaleY = (height - topRect.height - bottomRect.height) / 100;
        root2.ref.bottom.translateY = height - bottomRect.height;
      };
      var panel = createView({
        name: "panel",
        read: function read2(_ref3) {
          var root2 = _ref3.root, props = _ref3.props;
          return props.heightCurrent = root2.ref.bottom.translateY;
        },
        write: write$3,
        create: create$6,
        ignoreRect: true,
        mixins: {
          apis: ["height", "heightCurrent", "scalable"]
        }
      });
      var createDragHelper = function createDragHelper2(items) {
        var itemIds = items.map(function(item2) {
          return item2.id;
        });
        var prevIndex = void 0;
        return {
          setIndex: function setIndex(index) {
            prevIndex = index;
          },
          getIndex: function getIndex() {
            return prevIndex;
          },
          getItemIndex: function getItemIndex(item2) {
            return itemIds.indexOf(item2.id);
          }
        };
      };
      var ITEM_TRANSLATE_SPRING = {
        type: "spring",
        stiffness: 0.75,
        damping: 0.45,
        mass: 10
      };
      var ITEM_SCALE_SPRING = "spring";
      var StateMap = {
        DID_START_ITEM_LOAD: "busy",
        DID_UPDATE_ITEM_LOAD_PROGRESS: "loading",
        DID_THROW_ITEM_INVALID: "load-invalid",
        DID_THROW_ITEM_LOAD_ERROR: "load-error",
        DID_LOAD_ITEM: "idle",
        DID_THROW_ITEM_REMOVE_ERROR: "remove-error",
        DID_START_ITEM_REMOVE: "busy",
        DID_START_ITEM_PROCESSING: "busy processing",
        DID_REQUEST_ITEM_PROCESSING: "busy processing",
        DID_UPDATE_ITEM_PROCESS_PROGRESS: "processing",
        DID_COMPLETE_ITEM_PROCESSING: "processing-complete",
        DID_THROW_ITEM_PROCESSING_ERROR: "processing-error",
        DID_THROW_ITEM_PROCESSING_REVERT_ERROR: "processing-revert-error",
        DID_ABORT_ITEM_PROCESSING: "cancelled",
        DID_REVERT_ITEM_PROCESSING: "idle"
      };
      var create$7 = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        root2.ref.handleClick = function(e) {
          return root2.dispatch("DID_ACTIVATE_ITEM", { id: props.id });
        };
        root2.element.id = "filepond--item-" + props.id;
        root2.element.addEventListener("click", root2.ref.handleClick);
        root2.ref.container = root2.appendChildView(
          root2.createChildView(fileWrapper, { id: props.id })
        );
        root2.ref.panel = root2.appendChildView(root2.createChildView(panel, { name: "item-panel" }));
        root2.ref.panel.height = null;
        props.markedForRemoval = false;
        if (!root2.query("GET_ALLOW_REORDER")) return;
        root2.element.dataset.dragState = "idle";
        var grab = function grab2(e) {
          if (!e.isPrimary) return;
          var removedActivateListener = false;
          var origin = {
            x: e.pageX,
            y: e.pageY
          };
          props.dragOrigin = {
            x: root2.translateX,
            y: root2.translateY
          };
          props.dragCenter = {
            x: e.offsetX,
            y: e.offsetY
          };
          var dragState = createDragHelper(root2.query("GET_ACTIVE_ITEMS"));
          root2.dispatch("DID_GRAB_ITEM", { id: props.id, dragState });
          var drag = function drag2(e2) {
            if (!e2.isPrimary) return;
            e2.stopPropagation();
            e2.preventDefault();
            props.dragOffset = {
              x: e2.pageX - origin.x,
              y: e2.pageY - origin.y
            };
            var dist = props.dragOffset.x * props.dragOffset.x + props.dragOffset.y * props.dragOffset.y;
            if (dist > 16 && !removedActivateListener) {
              removedActivateListener = true;
              root2.element.removeEventListener("click", root2.ref.handleClick);
            }
            root2.dispatch("DID_DRAG_ITEM", { id: props.id, dragState });
          };
          var drop2 = function drop3(e2) {
            if (!e2.isPrimary) return;
            props.dragOffset = {
              x: e2.pageX - origin.x,
              y: e2.pageY - origin.y
            };
            reset();
          };
          var cancel = function cancel2() {
            reset();
          };
          var reset = function reset2() {
            document.removeEventListener("pointercancel", cancel);
            document.removeEventListener("pointermove", drag);
            document.removeEventListener("pointerup", drop2);
            root2.dispatch("DID_DROP_ITEM", { id: props.id, dragState });
            if (removedActivateListener) {
              setTimeout(function() {
                return root2.element.addEventListener("click", root2.ref.handleClick);
              }, 0);
            }
          };
          document.addEventListener("pointercancel", cancel);
          document.addEventListener("pointermove", drag);
          document.addEventListener("pointerup", drop2);
        };
        root2.element.addEventListener("pointerdown", grab);
      };
      var route$1 = createRoute({
        DID_UPDATE_PANEL_HEIGHT: function DID_UPDATE_PANEL_HEIGHT(_ref2) {
          var root2 = _ref2.root, action = _ref2.action;
          root2.height = action.height;
        }
      });
      var write$4 = createRoute(
        {
          DID_GRAB_ITEM: function DID_GRAB_ITEM(_ref3) {
            var root2 = _ref3.root, props = _ref3.props;
            props.dragOrigin = {
              x: root2.translateX,
              y: root2.translateY
            };
          },
          DID_DRAG_ITEM: function DID_DRAG_ITEM(_ref4) {
            var root2 = _ref4.root;
            root2.element.dataset.dragState = "drag";
          },
          DID_DROP_ITEM: function DID_DROP_ITEM(_ref5) {
            var root2 = _ref5.root, props = _ref5.props;
            props.dragOffset = null;
            props.dragOrigin = null;
            root2.element.dataset.dragState = "drop";
          }
        },
        function(_ref6) {
          var root2 = _ref6.root, actions2 = _ref6.actions, props = _ref6.props, shouldOptimize = _ref6.shouldOptimize;
          if (root2.element.dataset.dragState === "drop") {
            if (root2.scaleX <= 1) {
              root2.element.dataset.dragState = "idle";
            }
          }
          var action = actions2.concat().filter(function(action2) {
            return /^DID_/.test(action2.type);
          }).reverse().find(function(action2) {
            return StateMap[action2.type];
          });
          if (action && action.type !== props.currentState) {
            props.currentState = action.type;
            root2.element.dataset.filepondItemState = StateMap[props.currentState] || "";
          }
          var aspectRatio = root2.query("GET_ITEM_PANEL_ASPECT_RATIO") || root2.query("GET_PANEL_ASPECT_RATIO");
          if (!aspectRatio) {
            route$1({ root: root2, actions: actions2, props });
            if (!root2.height && root2.ref.container.rect.element.height > 0) {
              root2.height = root2.ref.container.rect.element.height;
            }
          } else if (!shouldOptimize) {
            root2.height = root2.rect.element.width * aspectRatio;
          }
          if (shouldOptimize) {
            root2.ref.panel.height = null;
          }
          root2.ref.panel.height = root2.height;
        }
      );
      var item = createView({
        create: create$7,
        write: write$4,
        destroy: function destroy(_ref7) {
          var root2 = _ref7.root, props = _ref7.props;
          root2.element.removeEventListener("click", root2.ref.handleClick);
          root2.dispatch("RELEASE_ITEM", { query: props.id });
        },
        tag: "li",
        name: "item",
        mixins: {
          apis: [
            "id",
            "interactionMethod",
            "markedForRemoval",
            "spawnDate",
            "dragCenter",
            "dragOrigin",
            "dragOffset"
          ],
          styles: ["translateX", "translateY", "scaleX", "scaleY", "opacity", "height"],
          animations: {
            scaleX: ITEM_SCALE_SPRING,
            scaleY: ITEM_SCALE_SPRING,
            translateX: ITEM_TRANSLATE_SPRING,
            translateY: ITEM_TRANSLATE_SPRING,
            opacity: { type: "tween", duration: 150 }
          }
        }
      });
      var getItemsPerRow = function(horizontalSpace, itemWidth) {
        return Math.max(1, Math.floor((horizontalSpace + 1) / itemWidth));
      };
      var getItemIndexByPosition = function getItemIndexByPosition2(view, children, positionInView) {
        if (!positionInView) return;
        var horizontalSpace = view.rect.element.width;
        var l3 = children.length;
        var last = null;
        if (l3 === 0 || positionInView.top < children[0].rect.element.top) return -1;
        var item2 = children[0];
        var itemRect = item2.rect.element;
        var itemHorizontalMargin = itemRect.marginLeft + itemRect.marginRight;
        var itemWidth = itemRect.width + itemHorizontalMargin;
        var itemsPerRow = getItemsPerRow(horizontalSpace, itemWidth);
        if (itemsPerRow === 1) {
          for (var index = 0; index < l3; index++) {
            var child = children[index];
            var childMid = child.rect.outer.top + child.rect.element.height * 0.5;
            if (positionInView.top < childMid) {
              return index;
            }
          }
          return l3;
        }
        var itemVerticalMargin = itemRect.marginTop + itemRect.marginBottom;
        var itemHeight = itemRect.height + itemVerticalMargin;
        for (var _index = 0; _index < l3; _index++) {
          var indexX = _index % itemsPerRow;
          var indexY = Math.floor(_index / itemsPerRow);
          var offsetX = indexX * itemWidth;
          var offsetY = indexY * itemHeight;
          var itemTop = offsetY - itemRect.marginTop;
          var itemRight = offsetX + itemWidth;
          var itemBottom = offsetY + itemHeight + itemRect.marginBottom;
          if (positionInView.top < itemBottom && positionInView.top > itemTop) {
            if (positionInView.left < itemRight) {
              return _index;
            } else if (_index !== l3 - 1) {
              last = _index;
            } else {
              last = null;
            }
          }
        }
        if (last !== null) {
          return last;
        }
        return l3;
      };
      var dropAreaDimensions = {
        height: 0,
        width: 0,
        get getHeight() {
          return this.height;
        },
        set setHeight(val) {
          if (this.height === 0 || val === 0) this.height = val;
        },
        get getWidth() {
          return this.width;
        },
        set setWidth(val) {
          if (this.width === 0 || val === 0) this.width = val;
        },
        setDimensions: function setDimensions(height, width) {
          if (this.height === 0 || height === 0) this.height = height;
          if (this.width === 0 || width === 0) this.width = width;
        }
      };
      var create$8 = function create2(_ref) {
        var root2 = _ref.root;
        attr(root2.element, "role", "list");
        root2.ref.lastItemSpanwDate = Date.now();
      };
      var addItemView = function addItemView2(_ref2) {
        var root2 = _ref2.root, action = _ref2.action;
        var id2 = action.id, index = action.index, interactionMethod = action.interactionMethod;
        root2.ref.addIndex = index;
        var now = Date.now();
        var spawnDate = now;
        var opacity = 1;
        if (interactionMethod !== InteractionMethod.NONE) {
          opacity = 0;
          var cooldown = root2.query("GET_ITEM_INSERT_INTERVAL");
          var dist = now - root2.ref.lastItemSpanwDate;
          spawnDate = dist < cooldown ? now + (cooldown - dist) : now;
        }
        root2.ref.lastItemSpanwDate = spawnDate;
        root2.appendChildView(
          root2.createChildView(
            // view type
            item,
            // props
            {
              spawnDate,
              id: id2,
              opacity,
              interactionMethod
            }
          ),
          index
        );
      };
      var moveItem = function moveItem2(item2, x2, y3) {
        var vx = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 0;
        var vy = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : 1;
        if (item2.dragOffset) {
          item2.translateX = null;
          item2.translateY = null;
          item2.translateX = item2.dragOrigin.x + item2.dragOffset.x;
          item2.translateY = item2.dragOrigin.y + item2.dragOffset.y;
          item2.scaleX = 1.025;
          item2.scaleY = 1.025;
        } else {
          item2.translateX = x2;
          item2.translateY = y3;
          if (Date.now() > item2.spawnDate) {
            if (item2.opacity === 0) {
              introItemView(item2, x2, y3, vx, vy);
            }
            item2.scaleX = 1;
            item2.scaleY = 1;
            item2.opacity = 1;
          }
        }
      };
      var introItemView = function introItemView2(item2, x2, y3, vx, vy) {
        if (item2.interactionMethod === InteractionMethod.NONE) {
          item2.translateX = null;
          item2.translateX = x2;
          item2.translateY = null;
          item2.translateY = y3;
        } else if (item2.interactionMethod === InteractionMethod.DROP) {
          item2.translateX = null;
          item2.translateX = x2 - vx * 20;
          item2.translateY = null;
          item2.translateY = y3 - vy * 10;
          item2.scaleX = 0.8;
          item2.scaleY = 0.8;
        } else if (item2.interactionMethod === InteractionMethod.BROWSE) {
          item2.translateY = null;
          item2.translateY = y3 - 30;
        } else if (item2.interactionMethod === InteractionMethod.API) {
          item2.translateX = null;
          item2.translateX = x2 - 30;
          item2.translateY = null;
        }
      };
      var removeItemView = function removeItemView2(_ref3) {
        var root2 = _ref3.root, action = _ref3.action;
        var id2 = action.id;
        var view = root2.childViews.find(function(child) {
          return child.id === id2;
        });
        if (!view) {
          return;
        }
        view.scaleX = 0.9;
        view.scaleY = 0.9;
        view.opacity = 0;
        view.markedForRemoval = true;
      };
      var getItemHeight = function getItemHeight2(child) {
        return child.rect.element.height + child.rect.element.marginBottom + child.rect.element.marginTop;
      };
      var getItemWidth = function getItemWidth2(child) {
        return child.rect.element.width + child.rect.element.marginLeft * 0.5 + child.rect.element.marginRight * 0.5;
      };
      var dragItem = function dragItem2(_ref4) {
        var root2 = _ref4.root, action = _ref4.action;
        var id2 = action.id, dragState = action.dragState;
        var item2 = root2.query("GET_ITEM", { id: id2 });
        var view = root2.childViews.find(function(child) {
          return child.id === id2;
        });
        var numItems = root2.childViews.length;
        var oldIndex = dragState.getItemIndex(item2);
        if (!view) return;
        var dragPosition = {
          x: view.dragOrigin.x + view.dragOffset.x + view.dragCenter.x,
          y: view.dragOrigin.y + view.dragOffset.y + view.dragCenter.y
        };
        var dragHeight = getItemHeight(view);
        var dragWidth = getItemWidth(view);
        var cols = Math.floor(root2.rect.outer.width / dragWidth);
        if (cols > numItems) cols = numItems;
        var rows = Math.floor(numItems / cols + 1);
        dropAreaDimensions.setHeight = dragHeight * rows;
        dropAreaDimensions.setWidth = dragWidth * cols;
        var location2 = {
          y: Math.floor(dragPosition.y / dragHeight),
          x: Math.floor(dragPosition.x / dragWidth),
          getGridIndex: function getGridIndex() {
            if (dragPosition.y > dropAreaDimensions.getHeight || dragPosition.y < 0 || dragPosition.x > dropAreaDimensions.getWidth || dragPosition.x < 0)
              return oldIndex;
            return this.y * cols + this.x;
          },
          getColIndex: function getColIndex() {
            var items = root2.query("GET_ACTIVE_ITEMS");
            var visibleChildren = root2.childViews.filter(function(child) {
              return child.rect.element.height;
            });
            var children = items.map(function(item3) {
              return visibleChildren.find(function(childView) {
                return childView.id === item3.id;
              });
            });
            var currentIndex2 = children.findIndex(function(child) {
              return child === view;
            });
            var dragHeight2 = getItemHeight(view);
            var l3 = children.length;
            var idx = l3;
            var childHeight = 0;
            var childBottom = 0;
            var childTop = 0;
            for (var i = 0; i < l3; i++) {
              childHeight = getItemHeight(children[i]);
              childTop = childBottom;
              childBottom = childTop + childHeight;
              if (dragPosition.y < childBottom) {
                if (currentIndex2 > i) {
                  if (dragPosition.y < childTop + dragHeight2) {
                    idx = i;
                    break;
                  }
                  continue;
                }
                idx = i;
                break;
              }
            }
            return idx;
          }
        };
        var index = cols > 1 ? location2.getGridIndex() : location2.getColIndex();
        root2.dispatch("MOVE_ITEM", { query: view, index });
        var currentIndex = dragState.getIndex();
        if (currentIndex === void 0 || currentIndex !== index) {
          dragState.setIndex(index);
          if (currentIndex === void 0) return;
          root2.dispatch("DID_REORDER_ITEMS", {
            items: root2.query("GET_ACTIVE_ITEMS"),
            origin: oldIndex,
            target: index
          });
        }
      };
      var route$2 = createRoute({
        DID_ADD_ITEM: addItemView,
        DID_REMOVE_ITEM: removeItemView,
        DID_DRAG_ITEM: dragItem
      });
      var write$5 = function write3(_ref5) {
        var root2 = _ref5.root, props = _ref5.props, actions2 = _ref5.actions, shouldOptimize = _ref5.shouldOptimize;
        route$2({ root: root2, props, actions: actions2 });
        var dragCoordinates = props.dragCoordinates;
        var horizontalSpace = root2.rect.element.width;
        var visibleChildren = root2.childViews.filter(function(child) {
          return child.rect.element.height;
        });
        var children = root2.query("GET_ACTIVE_ITEMS").map(function(item2) {
          return visibleChildren.find(function(child) {
            return child.id === item2.id;
          });
        }).filter(function(item2) {
          return item2;
        });
        var dragIndex = dragCoordinates ? getItemIndexByPosition(root2, children, dragCoordinates) : null;
        var addIndex = root2.ref.addIndex || null;
        root2.ref.addIndex = null;
        var dragIndexOffset = 0;
        var removeIndexOffset = 0;
        var addIndexOffset = 0;
        if (children.length === 0) return;
        var childRect = children[0].rect.element;
        var itemVerticalMargin = childRect.marginTop + childRect.marginBottom;
        var itemHorizontalMargin = childRect.marginLeft + childRect.marginRight;
        var itemWidth = childRect.width + itemHorizontalMargin;
        var itemHeight = childRect.height + itemVerticalMargin;
        var itemsPerRow = getItemsPerRow(horizontalSpace, itemWidth);
        if (itemsPerRow === 1) {
          var offsetY = 0;
          var dragOffset = 0;
          children.forEach(function(child, index) {
            if (dragIndex) {
              var dist = index - dragIndex;
              if (dist === -2) {
                dragOffset = -itemVerticalMargin * 0.25;
              } else if (dist === -1) {
                dragOffset = -itemVerticalMargin * 0.75;
              } else if (dist === 0) {
                dragOffset = itemVerticalMargin * 0.75;
              } else if (dist === 1) {
                dragOffset = itemVerticalMargin * 0.25;
              } else {
                dragOffset = 0;
              }
            }
            if (shouldOptimize) {
              child.translateX = null;
              child.translateY = null;
            }
            if (!child.markedForRemoval) {
              moveItem(child, 0, offsetY + dragOffset);
            }
            var itemHeight2 = child.rect.element.height + itemVerticalMargin;
            var visualHeight = itemHeight2 * (child.markedForRemoval ? child.opacity : 1);
            offsetY += visualHeight;
          });
        } else {
          var prevX = 0;
          var prevY = 0;
          children.forEach(function(child, index) {
            if (index === dragIndex) {
              dragIndexOffset = 1;
            }
            if (index === addIndex) {
              addIndexOffset += 1;
            }
            if (child.markedForRemoval && child.opacity < 0.5) {
              removeIndexOffset -= 1;
            }
            var visualIndex = index + addIndexOffset + dragIndexOffset + removeIndexOffset;
            var indexX = visualIndex % itemsPerRow;
            var indexY = Math.floor(visualIndex / itemsPerRow);
            var offsetX = indexX * itemWidth;
            var offsetY2 = indexY * itemHeight;
            var vectorX = Math.sign(offsetX - prevX);
            var vectorY = Math.sign(offsetY2 - prevY);
            prevX = offsetX;
            prevY = offsetY2;
            if (child.markedForRemoval) return;
            if (shouldOptimize) {
              child.translateX = null;
              child.translateY = null;
            }
            moveItem(child, offsetX, offsetY2, vectorX, vectorY);
          });
        }
      };
      var filterSetItemActions = function filterSetItemActions2(child, actions2) {
        return actions2.filter(function(action) {
          if (action.data && action.data.id) {
            return child.id === action.data.id;
          }
          return true;
        });
      };
      var list = createView({
        create: create$8,
        write: write$5,
        tag: "ul",
        name: "list",
        didWriteView: function didWriteView(_ref6) {
          var root2 = _ref6.root;
          root2.childViews.filter(function(view) {
            return view.markedForRemoval && view.opacity === 0 && view.resting;
          }).forEach(function(view) {
            view._destroy();
            root2.removeChildView(view);
          });
        },
        filterFrameActionsForChild: filterSetItemActions,
        mixins: {
          apis: ["dragCoordinates"]
        }
      });
      var create$9 = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        root2.ref.list = root2.appendChildView(root2.createChildView(list));
        props.dragCoordinates = null;
        props.overflowing = false;
      };
      var storeDragCoordinates = function storeDragCoordinates2(_ref2) {
        var root2 = _ref2.root, props = _ref2.props, action = _ref2.action;
        if (!root2.query("GET_ITEM_INSERT_LOCATION_FREEDOM")) return;
        props.dragCoordinates = {
          left: action.position.scopeLeft - root2.ref.list.rect.element.left,
          top: action.position.scopeTop - (root2.rect.outer.top + root2.rect.element.marginTop + root2.rect.element.scrollTop)
        };
      };
      var clearDragCoordinates = function clearDragCoordinates2(_ref3) {
        var props = _ref3.props;
        props.dragCoordinates = null;
      };
      var route$3 = createRoute({
        DID_DRAG: storeDragCoordinates,
        DID_END_DRAG: clearDragCoordinates
      });
      var write$6 = function write3(_ref4) {
        var root2 = _ref4.root, props = _ref4.props, actions2 = _ref4.actions;
        route$3({ root: root2, props, actions: actions2 });
        root2.ref.list.dragCoordinates = props.dragCoordinates;
        if (props.overflowing && !props.overflow) {
          props.overflowing = false;
          root2.element.dataset.state = "";
          root2.height = null;
        }
        if (props.overflow) {
          var newHeight = Math.round(props.overflow);
          if (newHeight !== root2.height) {
            props.overflowing = true;
            root2.element.dataset.state = "overflow";
            root2.height = newHeight;
          }
        }
      };
      var listScroller = createView({
        create: create$9,
        write: write$6,
        name: "list-scroller",
        mixins: {
          apis: ["overflow", "dragCoordinates"],
          styles: ["height", "translateY"],
          animations: {
            translateY: "spring"
          }
        }
      });
      var attrToggle = function attrToggle2(element, name2, state2) {
        var enabledValue = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : "";
        if (state2) {
          attr(element, name2, enabledValue);
        } else {
          element.removeAttribute(name2);
        }
      };
      var resetFileInput = function resetFileInput2(input) {
        if (!input || input.value === "") {
          return;
        }
        try {
          input.value = "";
        } catch (err) {
        }
        if (input.value) {
          var form = createElement$1("form");
          var parentNode = input.parentNode;
          var ref = input.nextSibling;
          form.appendChild(input);
          form.reset();
          if (ref) {
            parentNode.insertBefore(input, ref);
          } else {
            parentNode.appendChild(input);
          }
        }
      };
      var create$a = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        root2.element.id = "filepond--browser-" + props.id;
        attr(root2.element, "name", root2.query("GET_NAME"));
        attr(root2.element, "aria-controls", "filepond--assistant-" + props.id);
        attr(root2.element, "aria-labelledby", "filepond--drop-label-" + props.id);
        setAcceptedFileTypes({
          root: root2,
          action: { value: root2.query("GET_ACCEPTED_FILE_TYPES") }
        });
        toggleAllowMultiple({ root: root2, action: { value: root2.query("GET_ALLOW_MULTIPLE") } });
        toggleDirectoryFilter({
          root: root2,
          action: { value: root2.query("GET_ALLOW_DIRECTORIES_ONLY") }
        });
        toggleDisabled({ root: root2 });
        toggleRequired({ root: root2, action: { value: root2.query("GET_REQUIRED") } });
        setCaptureMethod({ root: root2, action: { value: root2.query("GET_CAPTURE_METHOD") } });
        root2.ref.handleChange = function(e) {
          if (!root2.element.value) {
            return;
          }
          var files = Array.from(root2.element.files).map(function(file2) {
            file2._relativePath = file2.webkitRelativePath;
            return file2;
          });
          setTimeout(function() {
            props.onload(files);
            resetFileInput(root2.element);
          }, 250);
        };
        root2.element.addEventListener("change", root2.ref.handleChange);
      };
      var setAcceptedFileTypes = function setAcceptedFileTypes2(_ref2) {
        var root2 = _ref2.root, action = _ref2.action;
        if (!root2.query("GET_ALLOW_SYNC_ACCEPT_ATTRIBUTE")) return;
        attrToggle(
          root2.element,
          "accept",
          !!action.value,
          action.value ? action.value.join(",") : ""
        );
      };
      var toggleAllowMultiple = function toggleAllowMultiple2(_ref3) {
        var root2 = _ref3.root, action = _ref3.action;
        attrToggle(root2.element, "multiple", action.value);
      };
      var toggleDirectoryFilter = function toggleDirectoryFilter2(_ref4) {
        var root2 = _ref4.root, action = _ref4.action;
        attrToggle(root2.element, "webkitdirectory", action.value);
      };
      var toggleDisabled = function toggleDisabled2(_ref5) {
        var root2 = _ref5.root;
        var isDisabled2 = root2.query("GET_DISABLED");
        var doesAllowBrowse = root2.query("GET_ALLOW_BROWSE");
        var disableField = isDisabled2 || !doesAllowBrowse;
        attrToggle(root2.element, "disabled", disableField);
      };
      var toggleRequired = function toggleRequired2(_ref6) {
        var root2 = _ref6.root, action = _ref6.action;
        if (!action.value) {
          attrToggle(root2.element, "required", false);
        } else if (root2.query("GET_TOTAL_ITEMS") === 0) {
          attrToggle(root2.element, "required", true);
        }
      };
      var setCaptureMethod = function setCaptureMethod2(_ref7) {
        var root2 = _ref7.root, action = _ref7.action;
        attrToggle(
          root2.element,
          "capture",
          !!action.value,
          action.value === true ? "" : action.value
        );
      };
      var updateRequiredStatus = function updateRequiredStatus2(_ref8) {
        var root2 = _ref8.root;
        var element = root2.element;
        if (root2.query("GET_TOTAL_ITEMS") > 0) {
          attrToggle(element, "required", false);
          attrToggle(element, "name", false);
          var activeItems = root2.query("GET_ACTIVE_ITEMS");
          var hasInvalidField = false;
          for (var i = 0; i < activeItems.length; i++) {
            if (activeItems[i].status === ItemStatus.LOAD_ERROR) {
              hasInvalidField = true;
            }
          }
          root2.element.setCustomValidity(
            hasInvalidField ? root2.query("GET_LABEL_INVALID_FIELD") : ""
          );
        } else {
          attrToggle(element, "name", true, root2.query("GET_NAME"));
          var shouldCheckValidity = root2.query("GET_CHECK_VALIDITY");
          if (shouldCheckValidity) {
            element.setCustomValidity("");
          }
          if (root2.query("GET_REQUIRED")) {
            attrToggle(element, "required", true);
          }
        }
      };
      var updateFieldValidityStatus = function updateFieldValidityStatus2(_ref9) {
        var root2 = _ref9.root;
        var shouldCheckValidity = root2.query("GET_CHECK_VALIDITY");
        if (!shouldCheckValidity) return;
        root2.element.setCustomValidity(root2.query("GET_LABEL_INVALID_FIELD"));
      };
      var browser = createView({
        tag: "input",
        name: "browser",
        ignoreRect: true,
        ignoreRectUpdate: true,
        attributes: {
          type: "file"
        },
        create: create$a,
        destroy: function destroy(_ref10) {
          var root2 = _ref10.root;
          root2.element.removeEventListener("change", root2.ref.handleChange);
        },
        write: createRoute({
          DID_LOAD_ITEM: updateRequiredStatus,
          DID_REMOVE_ITEM: updateRequiredStatus,
          DID_THROW_ITEM_INVALID: updateFieldValidityStatus,
          DID_SET_DISABLED: toggleDisabled,
          DID_SET_ALLOW_BROWSE: toggleDisabled,
          DID_SET_ALLOW_DIRECTORIES_ONLY: toggleDirectoryFilter,
          DID_SET_ALLOW_MULTIPLE: toggleAllowMultiple,
          DID_SET_ACCEPTED_FILE_TYPES: setAcceptedFileTypes,
          DID_SET_CAPTURE_METHOD: setCaptureMethod,
          DID_SET_REQUIRED: toggleRequired
        })
      });
      var Key = {
        ENTER: 13,
        SPACE: 32
      };
      var create$b = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        var label = createElement$1("label");
        attr(label, "for", "filepond--browser-" + props.id);
        attr(label, "id", "filepond--drop-label-" + props.id);
        root2.ref.handleKeyDown = function(e) {
          var isActivationKey = e.keyCode === Key.ENTER || e.keyCode === Key.SPACE;
          if (!isActivationKey) return;
          e.preventDefault();
          root2.ref.label.click();
        };
        root2.ref.handleClick = function(e) {
          var isLabelClick = e.target === label || label.contains(e.target);
          if (isLabelClick) return;
          root2.ref.label.click();
        };
        label.addEventListener("keydown", root2.ref.handleKeyDown);
        root2.element.addEventListener("click", root2.ref.handleClick);
        updateLabelValue(label, props.caption);
        root2.appendChild(label);
        root2.ref.label = label;
      };
      var updateLabelValue = function updateLabelValue2(label, value) {
        label.innerHTML = value;
        var clickable = label.querySelector(".filepond--label-action");
        if (clickable) {
          attr(clickable, "tabindex", "0");
        }
        return value;
      };
      var dropLabel = createView({
        name: "drop-label",
        ignoreRect: true,
        create: create$b,
        destroy: function destroy(_ref2) {
          var root2 = _ref2.root;
          root2.ref.label.addEventListener("keydown", root2.ref.handleKeyDown);
          root2.element.removeEventListener("click", root2.ref.handleClick);
        },
        write: createRoute({
          DID_SET_LABEL_IDLE: function DID_SET_LABEL_IDLE(_ref3) {
            var root2 = _ref3.root, action = _ref3.action;
            updateLabelValue(root2.ref.label, action.value);
          }
        }),
        mixins: {
          styles: ["opacity", "translateX", "translateY"],
          animations: {
            opacity: { type: "tween", duration: 150 },
            translateX: "spring",
            translateY: "spring"
          }
        }
      });
      var blob = createView({
        name: "drip-blob",
        ignoreRect: true,
        mixins: {
          styles: ["translateX", "translateY", "scaleX", "scaleY", "opacity"],
          animations: {
            scaleX: "spring",
            scaleY: "spring",
            translateX: "spring",
            translateY: "spring",
            opacity: { type: "tween", duration: 250 }
          }
        }
      });
      var addBlob = function addBlob2(_ref) {
        var root2 = _ref.root;
        var centerX = root2.rect.element.width * 0.5;
        var centerY = root2.rect.element.height * 0.5;
        root2.ref.blob = root2.appendChildView(
          root2.createChildView(blob, {
            opacity: 0,
            scaleX: 2.5,
            scaleY: 2.5,
            translateX: centerX,
            translateY: centerY
          })
        );
      };
      var moveBlob = function moveBlob2(_ref2) {
        var root2 = _ref2.root, action = _ref2.action;
        if (!root2.ref.blob) {
          addBlob({ root: root2 });
          return;
        }
        root2.ref.blob.translateX = action.position.scopeLeft;
        root2.ref.blob.translateY = action.position.scopeTop;
        root2.ref.blob.scaleX = 1;
        root2.ref.blob.scaleY = 1;
        root2.ref.blob.opacity = 1;
      };
      var hideBlob = function hideBlob2(_ref3) {
        var root2 = _ref3.root;
        if (!root2.ref.blob) {
          return;
        }
        root2.ref.blob.opacity = 0;
      };
      var explodeBlob = function explodeBlob2(_ref4) {
        var root2 = _ref4.root;
        if (!root2.ref.blob) {
          return;
        }
        root2.ref.blob.scaleX = 2.5;
        root2.ref.blob.scaleY = 2.5;
        root2.ref.blob.opacity = 0;
      };
      var write$7 = function write3(_ref5) {
        var root2 = _ref5.root, props = _ref5.props, actions2 = _ref5.actions;
        route$4({ root: root2, props, actions: actions2 });
        var blob2 = root2.ref.blob;
        if (actions2.length === 0 && blob2 && blob2.opacity === 0) {
          root2.removeChildView(blob2);
          root2.ref.blob = null;
        }
      };
      var route$4 = createRoute({
        DID_DRAG: moveBlob,
        DID_DROP: explodeBlob,
        DID_END_DRAG: hideBlob
      });
      var drip = createView({
        ignoreRect: true,
        ignoreRectUpdate: true,
        name: "drip",
        write: write$7
      });
      var setInputFiles = function setInputFiles2(element, files) {
        try {
          var dataTransfer = new DataTransfer();
          files.forEach(function(file2) {
            if (file2 instanceof File) {
              dataTransfer.items.add(file2);
            } else {
              dataTransfer.items.add(
                new File([file2], file2.name, {
                  type: file2.type
                })
              );
            }
          });
          element.files = dataTransfer.files;
        } catch (err) {
          return false;
        }
        return true;
      };
      var create$c = function create2(_ref) {
        var root2 = _ref.root;
        root2.ref.fields = {};
        var legend = document.createElement("legend");
        legend.textContent = "Files";
        root2.element.appendChild(legend);
      };
      var getField = function getField2(root2, id2) {
        return root2.ref.fields[id2];
      };
      var syncFieldPositionsWithItems = function syncFieldPositionsWithItems2(root2) {
        root2.query("GET_ACTIVE_ITEMS").forEach(function(item2) {
          if (!root2.ref.fields[item2.id]) return;
          root2.element.appendChild(root2.ref.fields[item2.id]);
        });
      };
      var didReorderItems = function didReorderItems2(_ref2) {
        var root2 = _ref2.root;
        return syncFieldPositionsWithItems(root2);
      };
      var didAddItem = function didAddItem2(_ref3) {
        var root2 = _ref3.root, action = _ref3.action;
        var fileItem = root2.query("GET_ITEM", action.id);
        var isLocalFile = fileItem.origin === FileOrigin.LOCAL;
        var shouldUseFileInput = !isLocalFile && root2.query("SHOULD_UPDATE_FILE_INPUT");
        var dataContainer = createElement$1("input");
        dataContainer.type = shouldUseFileInput ? "file" : "hidden";
        dataContainer.name = root2.query("GET_NAME");
        root2.ref.fields[action.id] = dataContainer;
        syncFieldPositionsWithItems(root2);
      };
      var didLoadItem$1 = function didLoadItem2(_ref4) {
        var root2 = _ref4.root, action = _ref4.action;
        var field = getField(root2, action.id);
        if (!field) return;
        if (action.serverFileReference !== null) field.value = action.serverFileReference;
        if (!root2.query("SHOULD_UPDATE_FILE_INPUT")) return;
        var fileItem = root2.query("GET_ITEM", action.id);
        setInputFiles(field, [fileItem.file]);
      };
      var didPrepareOutput = function didPrepareOutput2(_ref5) {
        var root2 = _ref5.root, action = _ref5.action;
        if (!root2.query("SHOULD_UPDATE_FILE_INPUT")) return;
        setTimeout(function() {
          var field = getField(root2, action.id);
          if (!field) return;
          setInputFiles(field, [action.file]);
        }, 0);
      };
      var didSetDisabled = function didSetDisabled2(_ref6) {
        var root2 = _ref6.root;
        root2.element.disabled = root2.query("GET_DISABLED");
      };
      var didRemoveItem = function didRemoveItem2(_ref7) {
        var root2 = _ref7.root, action = _ref7.action;
        var field = getField(root2, action.id);
        if (!field) return;
        if (field.parentNode) field.parentNode.removeChild(field);
        delete root2.ref.fields[action.id];
      };
      var didDefineValue = function didDefineValue2(_ref8) {
        var root2 = _ref8.root, action = _ref8.action;
        var field = getField(root2, action.id);
        if (!field) return;
        if (action.value === null) {
          field.removeAttribute("value");
        } else {
          if (field.type != "file") {
            field.value = action.value;
          }
        }
        syncFieldPositionsWithItems(root2);
      };
      var write$8 = createRoute({
        DID_SET_DISABLED: didSetDisabled,
        DID_ADD_ITEM: didAddItem,
        DID_LOAD_ITEM: didLoadItem$1,
        DID_REMOVE_ITEM: didRemoveItem,
        DID_DEFINE_VALUE: didDefineValue,
        DID_PREPARE_OUTPUT: didPrepareOutput,
        DID_REORDER_ITEMS: didReorderItems,
        DID_SORT_ITEMS: didReorderItems
      });
      var data = createView({
        tag: "fieldset",
        name: "data",
        create: create$c,
        write: write$8,
        ignoreRect: true
      });
      var getRootNode = function getRootNode2(element) {
        return "getRootNode" in element ? element.getRootNode() : document;
      };
      var images = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tiff"];
      var text$1 = ["css", "csv", "html", "txt"];
      var map = {
        zip: "zip|compressed",
        epub: "application/epub+zip"
      };
      var guesstimateMimeType = function guesstimateMimeType2() {
        var extension = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "";
        extension = extension.toLowerCase();
        if (images.includes(extension)) {
          return "image/" + (extension === "jpg" ? "jpeg" : extension === "svg" ? "svg+xml" : extension);
        }
        if (text$1.includes(extension)) {
          return "text/" + extension;
        }
        return map[extension] || "";
      };
      var requestDataTransferItems = function requestDataTransferItems2(dataTransfer) {
        return new Promise(function(resolve, reject) {
          var links = getLinks(dataTransfer);
          if (links.length && !hasFiles(dataTransfer)) {
            return resolve(links);
          }
          getFiles(dataTransfer).then(resolve);
        });
      };
      var hasFiles = function hasFiles2(dataTransfer) {
        if (dataTransfer.files) return dataTransfer.files.length > 0;
        return false;
      };
      var getFiles = function getFiles2(dataTransfer) {
        return new Promise(function(resolve, reject) {
          var promisedFiles = (dataTransfer.items ? Array.from(dataTransfer.items) : []).filter(function(item2) {
            return isFileSystemItem(item2);
          }).map(function(item2) {
            return getFilesFromItem(item2);
          });
          if (!promisedFiles.length) {
            resolve(dataTransfer.files ? Array.from(dataTransfer.files) : []);
            return;
          }
          Promise.all(promisedFiles).then(function(returnedFileGroups) {
            var files = [];
            returnedFileGroups.forEach(function(group) {
              files.push.apply(files, group);
            });
            resolve(
              files.filter(function(file2) {
                return file2;
              }).map(function(file2) {
                if (!file2._relativePath)
                  file2._relativePath = file2.webkitRelativePath;
                return file2;
              })
            );
          }).catch(console.error);
        });
      };
      var isFileSystemItem = function isFileSystemItem2(item2) {
        if (isEntry(item2)) {
          var entry = getAsEntry(item2);
          if (entry) {
            return entry.isFile || entry.isDirectory;
          }
        }
        return item2.kind === "file";
      };
      var getFilesFromItem = function getFilesFromItem2(item2) {
        return new Promise(function(resolve, reject) {
          if (isDirectoryEntry(item2)) {
            getFilesInDirectory(getAsEntry(item2)).then(resolve).catch(reject);
            return;
          }
          resolve([item2.getAsFile()]);
        });
      };
      var getFilesInDirectory = function getFilesInDirectory2(entry) {
        return new Promise(function(resolve, reject) {
          var files = [];
          var dirCounter = 0;
          var fileCounter = 0;
          var resolveIfDone = function resolveIfDone2() {
            if (fileCounter === 0 && dirCounter === 0) {
              resolve(files);
            }
          };
          var readEntries = function readEntries2(dirEntry) {
            dirCounter++;
            var directoryReader = dirEntry.createReader();
            var readBatch = function readBatch2() {
              directoryReader.readEntries(function(entries) {
                if (entries.length === 0) {
                  dirCounter--;
                  resolveIfDone();
                  return;
                }
                entries.forEach(function(entry2) {
                  if (entry2.isDirectory) {
                    readEntries2(entry2);
                  } else {
                    fileCounter++;
                    entry2.file(function(file2) {
                      var correctedFile = correctMissingFileType(file2);
                      if (entry2.fullPath)
                        correctedFile._relativePath = entry2.fullPath;
                      files.push(correctedFile);
                      fileCounter--;
                      resolveIfDone();
                    });
                  }
                });
                readBatch2();
              }, reject);
            };
            readBatch();
          };
          readEntries(entry);
        });
      };
      var correctMissingFileType = function correctMissingFileType2(file2) {
        if (file2.type.length) return file2;
        var date = file2.lastModifiedDate;
        var name2 = file2.name;
        var type = guesstimateMimeType(getExtensionFromFilename(file2.name));
        if (!type.length) return file2;
        file2 = file2.slice(0, file2.size, type);
        file2.name = name2;
        file2.lastModifiedDate = date;
        return file2;
      };
      var isDirectoryEntry = function isDirectoryEntry2(item2) {
        return isEntry(item2) && (getAsEntry(item2) || {}).isDirectory;
      };
      var isEntry = function isEntry2(item2) {
        return "webkitGetAsEntry" in item2;
      };
      var getAsEntry = function getAsEntry2(item2) {
        return item2.webkitGetAsEntry();
      };
      var getLinks = function getLinks2(dataTransfer) {
        var links = [];
        try {
          links = getLinksFromTransferMetaData(dataTransfer);
          if (links.length) {
            return links;
          }
          links = getLinksFromTransferURLData(dataTransfer);
        } catch (e) {
        }
        return links;
      };
      var getLinksFromTransferURLData = function getLinksFromTransferURLData2(dataTransfer) {
        var data2 = dataTransfer.getData("url");
        if (typeof data2 === "string" && data2.length) {
          return [data2];
        }
        return [];
      };
      var getLinksFromTransferMetaData = function getLinksFromTransferMetaData2(dataTransfer) {
        var data2 = dataTransfer.getData("text/html");
        if (typeof data2 === "string" && data2.length) {
          var matches = data2.match(/src\s*=\s*"(.+?)"/);
          if (matches) {
            return [matches[1]];
          }
        }
        return [];
      };
      var dragNDropObservers = [];
      var eventPosition = function eventPosition2(e) {
        return {
          pageLeft: e.pageX,
          pageTop: e.pageY,
          scopeLeft: e.offsetX || e.layerX,
          scopeTop: e.offsetY || e.layerY
        };
      };
      var createDragNDropClient = function createDragNDropClient2(element, scopeToObserve, filterElement) {
        var observer = getDragNDropObserver(scopeToObserve);
        var client = {
          element,
          filterElement,
          state: null,
          ondrop: function ondrop() {
          },
          onenter: function onenter() {
          },
          ondrag: function ondrag() {
          },
          onexit: function onexit() {
          },
          onload: function onload() {
          },
          allowdrop: function allowdrop() {
          }
        };
        client.destroy = observer.addListener(client);
        return client;
      };
      var getDragNDropObserver = function getDragNDropObserver2(element) {
        var observer = dragNDropObservers.find(function(item2) {
          return item2.element === element;
        });
        if (observer) {
          return observer;
        }
        var newObserver = createDragNDropObserver(element);
        dragNDropObservers.push(newObserver);
        return newObserver;
      };
      var createDragNDropObserver = function createDragNDropObserver2(element) {
        var clients = [];
        var routes = {
          dragenter,
          dragover,
          dragleave,
          drop
        };
        var handlers = {};
        forin(routes, function(event, createHandler) {
          handlers[event] = createHandler(element, clients);
          element.addEventListener(event, handlers[event], false);
        });
        var observer = {
          element,
          addListener: function addListener(client) {
            clients.push(client);
            return function() {
              clients.splice(clients.indexOf(client), 1);
              if (clients.length === 0) {
                dragNDropObservers.splice(dragNDropObservers.indexOf(observer), 1);
                forin(routes, function(event) {
                  element.removeEventListener(event, handlers[event], false);
                });
              }
            };
          }
        };
        return observer;
      };
      var elementFromPoint = function elementFromPoint2(root2, point) {
        if (!("elementFromPoint" in root2)) {
          root2 = document;
        }
        return root2.elementFromPoint(point.x, point.y);
      };
      var isEventTarget = function isEventTarget2(e, target) {
        var root2 = getRootNode(target);
        var elementAtPosition = elementFromPoint(root2, {
          x: e.pageX - window.pageXOffset,
          y: e.pageY - window.pageYOffset
        });
        return elementAtPosition === target || target.contains(elementAtPosition);
      };
      var initialTarget = null;
      var setDropEffect = function setDropEffect2(dataTransfer, effect4) {
        try {
          dataTransfer.dropEffect = effect4;
        } catch (e) {
        }
      };
      var dragenter = function dragenter2(root2, clients) {
        return function(e) {
          e.preventDefault();
          initialTarget = e.target;
          clients.forEach(function(client) {
            var element = client.element, onenter = client.onenter;
            if (isEventTarget(e, element)) {
              client.state = "enter";
              onenter(eventPosition(e));
            }
          });
        };
      };
      var dragover = function dragover2(root2, clients) {
        return function(e) {
          e.preventDefault();
          var dataTransfer = e.dataTransfer;
          requestDataTransferItems(dataTransfer).then(function(items) {
            var overDropTarget = false;
            clients.some(function(client) {
              var filterElement = client.filterElement, element = client.element, onenter = client.onenter, onexit = client.onexit, ondrag = client.ondrag, allowdrop = client.allowdrop;
              setDropEffect(dataTransfer, "copy");
              var allowsTransfer = allowdrop(items);
              if (!allowsTransfer) {
                setDropEffect(dataTransfer, "none");
                return;
              }
              if (isEventTarget(e, element)) {
                overDropTarget = true;
                if (client.state === null) {
                  client.state = "enter";
                  onenter(eventPosition(e));
                  return;
                }
                client.state = "over";
                if (filterElement && !allowsTransfer) {
                  setDropEffect(dataTransfer, "none");
                  return;
                }
                ondrag(eventPosition(e));
              } else {
                if (filterElement && !overDropTarget) {
                  setDropEffect(dataTransfer, "none");
                }
                if (client.state) {
                  client.state = null;
                  onexit(eventPosition(e));
                }
              }
            });
          });
        };
      };
      var drop = function drop2(root2, clients) {
        return function(e) {
          e.preventDefault();
          var dataTransfer = e.dataTransfer;
          requestDataTransferItems(dataTransfer).then(function(items) {
            clients.forEach(function(client) {
              var filterElement = client.filterElement, element = client.element, ondrop = client.ondrop, onexit = client.onexit, allowdrop = client.allowdrop;
              client.state = null;
              if (filterElement && !isEventTarget(e, element)) return;
              if (!allowdrop(items)) return onexit(eventPosition(e));
              ondrop(eventPosition(e), items);
            });
          });
        };
      };
      var dragleave = function dragleave2(root2, clients) {
        return function(e) {
          if (initialTarget !== e.target) {
            return;
          }
          clients.forEach(function(client) {
            var onexit = client.onexit;
            client.state = null;
            onexit(eventPosition(e));
          });
        };
      };
      var createHopper = function createHopper2(scope, validateItems, options) {
        scope.classList.add("filepond--hopper");
        var catchesDropsOnPage = options.catchesDropsOnPage, requiresDropOnElement = options.requiresDropOnElement, _options$filterItems = options.filterItems, filterItems = _options$filterItems === void 0 ? function(items) {
          return items;
        } : _options$filterItems;
        var client = createDragNDropClient(
          scope,
          catchesDropsOnPage ? document.documentElement : scope,
          requiresDropOnElement
        );
        var lastState = "";
        var currentState = "";
        client.allowdrop = function(items) {
          return validateItems(filterItems(items));
        };
        client.ondrop = function(position, items) {
          var filteredItems = filterItems(items);
          if (!validateItems(filteredItems)) {
            api.ondragend(position);
            return;
          }
          currentState = "drag-drop";
          api.onload(filteredItems, position);
        };
        client.ondrag = function(position) {
          api.ondrag(position);
        };
        client.onenter = function(position) {
          currentState = "drag-over";
          api.ondragstart(position);
        };
        client.onexit = function(position) {
          currentState = "drag-exit";
          api.ondragend(position);
        };
        var api = {
          updateHopperState: function updateHopperState() {
            if (lastState !== currentState) {
              scope.dataset.hopperState = currentState;
              lastState = currentState;
            }
          },
          onload: function onload() {
          },
          ondragstart: function ondragstart() {
          },
          ondrag: function ondrag() {
          },
          ondragend: function ondragend() {
          },
          destroy: function destroy() {
            client.destroy();
          }
        };
        return api;
      };
      var listening = false;
      var listeners$1 = [];
      var handlePaste = function handlePaste2(e) {
        var activeEl = document.activeElement;
        var isActiveElementEditable = activeEl && (/textarea|input/i.test(activeEl.nodeName) || activeEl.getAttribute("contenteditable") === "true" || activeEl.getAttribute("contenteditable") === "");
        if (isActiveElementEditable) {
          var inScope = false;
          var element = activeEl;
          while (element !== document.body) {
            if (element.classList.contains("filepond--root")) {
              inScope = true;
              break;
            }
            element = element.parentNode;
          }
          if (!inScope) return;
        }
        requestDataTransferItems(e.clipboardData).then(function(files) {
          if (!files.length) {
            return;
          }
          listeners$1.forEach(function(listener) {
            return listener(files);
          });
        });
      };
      var listen = function listen2(cb) {
        if (listeners$1.includes(cb)) {
          return;
        }
        listeners$1.push(cb);
        if (listening) {
          return;
        }
        listening = true;
        document.addEventListener("paste", handlePaste);
      };
      var unlisten = function unlisten2(listener) {
        arrayRemove(listeners$1, listeners$1.indexOf(listener));
        if (listeners$1.length === 0) {
          document.removeEventListener("paste", handlePaste);
          listening = false;
        }
      };
      var createPaster = function createPaster2() {
        var cb = function cb2(files) {
          api.onload(files);
        };
        var api = {
          destroy: function destroy() {
            unlisten(cb);
          },
          onload: function onload() {
          }
        };
        listen(cb);
        return api;
      };
      var create$d = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        root2.element.id = "filepond--assistant-" + props.id;
        attr(root2.element, "role", "alert");
        attr(root2.element, "aria-live", "polite");
        attr(root2.element, "aria-relevant", "additions");
      };
      var addFilesNotificationTimeout = null;
      var notificationClearTimeout = null;
      var filenames = [];
      var assist = function assist2(root2, message) {
        root2.element.textContent = message;
      };
      var clear$1 = function clear2(root2) {
        root2.element.textContent = "";
      };
      var listModified = function listModified2(root2, filename, label) {
        var total = root2.query("GET_TOTAL_ITEMS");
        assist(
          root2,
          label + " " + filename + ", " + total + " " + (total === 1 ? root2.query("GET_LABEL_FILE_COUNT_SINGULAR") : root2.query("GET_LABEL_FILE_COUNT_PLURAL"))
        );
        clearTimeout(notificationClearTimeout);
        notificationClearTimeout = setTimeout(function() {
          clear$1(root2);
        }, 1500);
      };
      var isUsingFilePond = function isUsingFilePond2(root2) {
        return root2.element.parentNode.contains(document.activeElement);
      };
      var itemAdded = function itemAdded2(_ref2) {
        var root2 = _ref2.root, action = _ref2.action;
        if (!isUsingFilePond(root2)) {
          return;
        }
        root2.element.textContent = "";
        var item2 = root2.query("GET_ITEM", action.id);
        filenames.push(item2.filename);
        clearTimeout(addFilesNotificationTimeout);
        addFilesNotificationTimeout = setTimeout(function() {
          listModified(root2, filenames.join(", "), root2.query("GET_LABEL_FILE_ADDED"));
          filenames.length = 0;
        }, 750);
      };
      var itemRemoved = function itemRemoved2(_ref3) {
        var root2 = _ref3.root, action = _ref3.action;
        if (!isUsingFilePond(root2)) {
          return;
        }
        var item2 = action.item;
        listModified(root2, item2.filename, root2.query("GET_LABEL_FILE_REMOVED"));
      };
      var itemProcessed = function itemProcessed2(_ref4) {
        var root2 = _ref4.root, action = _ref4.action;
        var item2 = root2.query("GET_ITEM", action.id);
        var filename = item2.filename;
        var label = root2.query("GET_LABEL_FILE_PROCESSING_COMPLETE");
        assist(root2, filename + " " + label);
      };
      var itemProcessedUndo = function itemProcessedUndo2(_ref5) {
        var root2 = _ref5.root, action = _ref5.action;
        var item2 = root2.query("GET_ITEM", action.id);
        var filename = item2.filename;
        var label = root2.query("GET_LABEL_FILE_PROCESSING_ABORTED");
        assist(root2, filename + " " + label);
      };
      var itemError = function itemError2(_ref6) {
        var root2 = _ref6.root, action = _ref6.action;
        var item2 = root2.query("GET_ITEM", action.id);
        var filename = item2.filename;
        assist(root2, action.status.main + " " + filename + " " + action.status.sub);
      };
      var assistant = createView({
        create: create$d,
        ignoreRect: true,
        ignoreRectUpdate: true,
        write: createRoute({
          DID_LOAD_ITEM: itemAdded,
          DID_REMOVE_ITEM: itemRemoved,
          DID_COMPLETE_ITEM_PROCESSING: itemProcessed,
          DID_ABORT_ITEM_PROCESSING: itemProcessedUndo,
          DID_REVERT_ITEM_PROCESSING: itemProcessedUndo,
          DID_THROW_ITEM_REMOVE_ERROR: itemError,
          DID_THROW_ITEM_LOAD_ERROR: itemError,
          DID_THROW_ITEM_INVALID: itemError,
          DID_THROW_ITEM_PROCESSING_ERROR: itemError
        }),
        tag: "span",
        name: "assistant"
      });
      var toCamels = function toCamels2(string) {
        var separator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "-";
        return string.replace(new RegExp(separator + ".", "g"), function(sub) {
          return sub.charAt(1).toUpperCase();
        });
      };
      var debounce2 = function debounce3(func) {
        var interval = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 16;
        var immidiateOnly = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : true;
        var last = Date.now();
        var timeout = null;
        return function() {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          clearTimeout(timeout);
          var dist = Date.now() - last;
          var fn3 = function fn4() {
            last = Date.now();
            func.apply(void 0, args);
          };
          if (dist < interval) {
            if (!immidiateOnly) {
              timeout = setTimeout(fn3, interval - dist);
            }
          } else {
            fn3();
          }
        };
      };
      var MAX_FILES_LIMIT = 1e6;
      var prevent = function prevent2(e) {
        return e.preventDefault();
      };
      var create$e = function create2(_ref) {
        var root2 = _ref.root, props = _ref.props;
        var id2 = root2.query("GET_ID");
        if (id2) {
          root2.element.id = id2;
        }
        var className = root2.query("GET_CLASS_NAME");
        if (className) {
          className.split(" ").filter(function(name2) {
            return name2.length;
          }).forEach(function(name2) {
            root2.element.classList.add(name2);
          });
        }
        root2.ref.label = root2.appendChildView(
          root2.createChildView(
            dropLabel,
            Object.assign({}, props, {
              translateY: null,
              caption: root2.query("GET_LABEL_IDLE")
            })
          )
        );
        root2.ref.list = root2.appendChildView(
          root2.createChildView(listScroller, { translateY: null })
        );
        root2.ref.panel = root2.appendChildView(root2.createChildView(panel, { name: "panel-root" }));
        root2.ref.assistant = root2.appendChildView(
          root2.createChildView(assistant, Object.assign({}, props))
        );
        root2.ref.data = root2.appendChildView(root2.createChildView(data, Object.assign({}, props)));
        root2.ref.measure = createElement$1("div");
        root2.ref.measure.style.height = "100%";
        root2.element.appendChild(root2.ref.measure);
        root2.ref.bounds = null;
        root2.query("GET_STYLES").filter(function(style) {
          return !isEmpty(style.value);
        }).map(function(_ref2) {
          var name2 = _ref2.name, value = _ref2.value;
          root2.element.dataset[name2] = value;
        });
        root2.ref.widthPrevious = null;
        root2.ref.widthUpdated = debounce2(function() {
          root2.ref.updateHistory = [];
          root2.dispatch("DID_RESIZE_ROOT");
        }, 250);
        root2.ref.previousAspectRatio = null;
        root2.ref.updateHistory = [];
        var canHover = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
        var hasPointerEvents = "PointerEvent" in window;
        if (root2.query("GET_ALLOW_REORDER") && hasPointerEvents && !canHover) {
          root2.element.addEventListener("touchmove", prevent, { passive: false });
          root2.element.addEventListener("gesturestart", prevent);
        }
        var credits = root2.query("GET_CREDITS");
        var hasCredits = credits.length === 2;
        if (hasCredits) {
          var frag = document.createElement("a");
          frag.className = "filepond--credits";
          frag.href = credits[0];
          frag.tabIndex = -1;
          frag.target = "_blank";
          frag.rel = "noopener noreferrer nofollow";
          frag.textContent = credits[1];
          root2.element.appendChild(frag);
          root2.ref.credits = frag;
        }
      };
      var write$9 = function write3(_ref3) {
        var root2 = _ref3.root, props = _ref3.props, actions2 = _ref3.actions;
        route$5({ root: root2, props, actions: actions2 });
        actions2.filter(function(action) {
          return /^DID_SET_STYLE_/.test(action.type);
        }).filter(function(action) {
          return !isEmpty(action.data.value);
        }).map(function(_ref4) {
          var type = _ref4.type, data2 = _ref4.data;
          var name2 = toCamels(type.substring(8).toLowerCase(), "_");
          root2.element.dataset[name2] = data2.value;
          root2.invalidateLayout();
        });
        if (root2.rect.element.hidden) return;
        if (root2.rect.element.width !== root2.ref.widthPrevious) {
          root2.ref.widthPrevious = root2.rect.element.width;
          root2.ref.widthUpdated();
        }
        var bounds = root2.ref.bounds;
        if (!bounds) {
          bounds = root2.ref.bounds = calculateRootBoundingBoxHeight(root2);
          root2.element.removeChild(root2.ref.measure);
          root2.ref.measure = null;
        }
        var _root$ref = root2.ref, hopper = _root$ref.hopper, label = _root$ref.label, list2 = _root$ref.list, panel2 = _root$ref.panel;
        if (hopper) {
          hopper.updateHopperState();
        }
        var aspectRatio = root2.query("GET_PANEL_ASPECT_RATIO");
        var isMultiItem = root2.query("GET_ALLOW_MULTIPLE");
        var totalItems = root2.query("GET_TOTAL_ITEMS");
        var maxItems = isMultiItem ? root2.query("GET_MAX_FILES") || MAX_FILES_LIMIT : 1;
        var atMaxCapacity = totalItems === maxItems;
        var addAction = actions2.find(function(action) {
          return action.type === "DID_ADD_ITEM";
        });
        if (atMaxCapacity && addAction) {
          var interactionMethod = addAction.data.interactionMethod;
          label.opacity = 0;
          if (isMultiItem) {
            label.translateY = -40;
          } else {
            if (interactionMethod === InteractionMethod.API) {
              label.translateX = 40;
            } else if (interactionMethod === InteractionMethod.BROWSE) {
              label.translateY = 40;
            } else {
              label.translateY = 30;
            }
          }
        } else if (!atMaxCapacity) {
          label.opacity = 1;
          label.translateX = 0;
          label.translateY = 0;
        }
        var listItemMargin = calculateListItemMargin(root2);
        var listHeight = calculateListHeight(root2);
        var labelHeight = label.rect.element.height;
        var currentLabelHeight = !isMultiItem || atMaxCapacity ? 0 : labelHeight;
        var listMarginTop = atMaxCapacity ? list2.rect.element.marginTop : 0;
        var listMarginBottom = totalItems === 0 ? 0 : list2.rect.element.marginBottom;
        var visualHeight = currentLabelHeight + listMarginTop + listHeight.visual + listMarginBottom;
        var boundsHeight = currentLabelHeight + listMarginTop + listHeight.bounds + listMarginBottom;
        list2.translateY = Math.max(0, currentLabelHeight - list2.rect.element.marginTop) - listItemMargin.top;
        if (aspectRatio) {
          var width = root2.rect.element.width;
          var height = width * aspectRatio;
          if (aspectRatio !== root2.ref.previousAspectRatio) {
            root2.ref.previousAspectRatio = aspectRatio;
            root2.ref.updateHistory = [];
          }
          var history = root2.ref.updateHistory;
          history.push(width);
          var MAX_BOUNCES = 2;
          if (history.length > MAX_BOUNCES * 2) {
            var l3 = history.length;
            var bottom2 = l3 - 10;
            var bounces = 0;
            for (var i = l3; i >= bottom2; i--) {
              if (history[i] === history[i - 2]) {
                bounces++;
              }
              if (bounces >= MAX_BOUNCES) {
                return;
              }
            }
          }
          panel2.scalable = false;
          panel2.height = height;
          var listAvailableHeight = (
            // the height of the panel minus the label height
            height - currentLabelHeight - // the room we leave open between the end of the list and the panel bottom
            (listMarginBottom - listItemMargin.bottom) - // if we're full we need to leave some room between the top of the panel and the list
            (atMaxCapacity ? listMarginTop : 0)
          );
          if (listHeight.visual > listAvailableHeight) {
            list2.overflow = listAvailableHeight;
          } else {
            list2.overflow = null;
          }
          root2.height = height;
        } else if (bounds.fixedHeight) {
          panel2.scalable = false;
          var _listAvailableHeight = (
            // the height of the panel minus the label height
            bounds.fixedHeight - currentLabelHeight - // the room we leave open between the end of the list and the panel bottom
            (listMarginBottom - listItemMargin.bottom) - // if we're full we need to leave some room between the top of the panel and the list
            (atMaxCapacity ? listMarginTop : 0)
          );
          if (listHeight.visual > _listAvailableHeight) {
            list2.overflow = _listAvailableHeight;
          } else {
            list2.overflow = null;
          }
        } else if (bounds.cappedHeight) {
          var isCappedHeight = visualHeight >= bounds.cappedHeight;
          var panelHeight = Math.min(bounds.cappedHeight, visualHeight);
          panel2.scalable = true;
          panel2.height = isCappedHeight ? panelHeight : panelHeight - listItemMargin.top - listItemMargin.bottom;
          var _listAvailableHeight2 = (
            // the height of the panel minus the label height
            panelHeight - currentLabelHeight - // the room we leave open between the end of the list and the panel bottom
            (listMarginBottom - listItemMargin.bottom) - // if we're full we need to leave some room between the top of the panel and the list
            (atMaxCapacity ? listMarginTop : 0)
          );
          if (visualHeight > bounds.cappedHeight && listHeight.visual > _listAvailableHeight2) {
            list2.overflow = _listAvailableHeight2;
          } else {
            list2.overflow = null;
          }
          root2.height = Math.min(
            bounds.cappedHeight,
            boundsHeight - listItemMargin.top - listItemMargin.bottom
          );
        } else {
          var itemMargin = totalItems > 0 ? listItemMargin.top + listItemMargin.bottom : 0;
          panel2.scalable = true;
          panel2.height = Math.max(labelHeight, visualHeight - itemMargin);
          root2.height = Math.max(labelHeight, boundsHeight - itemMargin);
        }
        if (root2.ref.credits && panel2.heightCurrent)
          root2.ref.credits.style.transform = "translateY(" + panel2.heightCurrent + "px)";
      };
      var calculateListItemMargin = function calculateListItemMargin2(root2) {
        var item2 = root2.ref.list.childViews[0].childViews[0];
        return item2 ? {
          top: item2.rect.element.marginTop,
          bottom: item2.rect.element.marginBottom
        } : {
          top: 0,
          bottom: 0
        };
      };
      var calculateListHeight = function calculateListHeight2(root2) {
        var visual = 0;
        var bounds = 0;
        var scrollList = root2.ref.list;
        var itemList = scrollList.childViews[0];
        var visibleChildren = itemList.childViews.filter(function(child) {
          return child.rect.element.height;
        });
        var children = root2.query("GET_ACTIVE_ITEMS").map(function(item2) {
          return visibleChildren.find(function(child) {
            return child.id === item2.id;
          });
        }).filter(function(item2) {
          return item2;
        });
        if (children.length === 0) return { visual, bounds };
        var horizontalSpace = itemList.rect.element.width;
        var dragIndex = getItemIndexByPosition(itemList, children, scrollList.dragCoordinates);
        var childRect = children[0].rect.element;
        var itemVerticalMargin = childRect.marginTop + childRect.marginBottom;
        var itemHorizontalMargin = childRect.marginLeft + childRect.marginRight;
        var itemWidth = childRect.width + itemHorizontalMargin;
        var itemHeight = childRect.height + itemVerticalMargin;
        var newItem = typeof dragIndex !== "undefined" && dragIndex >= 0 ? 1 : 0;
        var removedItem = children.find(function(child) {
          return child.markedForRemoval && child.opacity < 0.45;
        }) ? -1 : 0;
        var verticalItemCount = children.length + newItem + removedItem;
        var itemsPerRow = getItemsPerRow(horizontalSpace, itemWidth);
        if (itemsPerRow === 1) {
          children.forEach(function(item2) {
            var height = item2.rect.element.height + itemVerticalMargin;
            bounds += height;
            visual += height * item2.opacity;
          });
        } else {
          bounds = Math.ceil(verticalItemCount / itemsPerRow) * itemHeight;
          visual = bounds;
        }
        return { visual, bounds };
      };
      var calculateRootBoundingBoxHeight = function calculateRootBoundingBoxHeight2(root2) {
        var height = root2.ref.measureHeight || null;
        var cappedHeight = parseInt(root2.style.maxHeight, 10) || null;
        var fixedHeight = height === 0 ? null : height;
        return {
          cappedHeight,
          fixedHeight
        };
      };
      var exceedsMaxFiles = function exceedsMaxFiles2(root2, items) {
        var allowReplace = root2.query("GET_ALLOW_REPLACE");
        var allowMultiple = root2.query("GET_ALLOW_MULTIPLE");
        var totalItems = root2.query("GET_TOTAL_ITEMS");
        var maxItems = root2.query("GET_MAX_FILES");
        var totalBrowseItems = items.length;
        if (!allowMultiple && totalBrowseItems > 1) {
          root2.dispatch("DID_THROW_MAX_FILES", {
            source: items,
            error: createResponse("warning", 0, "Max files")
          });
          return true;
        }
        maxItems = allowMultiple ? maxItems : 1;
        if (!allowMultiple && allowReplace) {
          return false;
        }
        var hasMaxItems = isInt(maxItems);
        if (hasMaxItems && totalItems + totalBrowseItems > maxItems) {
          root2.dispatch("DID_THROW_MAX_FILES", {
            source: items,
            error: createResponse("warning", 0, "Max files")
          });
          return true;
        }
        return false;
      };
      var getDragIndex = function getDragIndex2(list2, children, position) {
        var itemList = list2.childViews[0];
        return getItemIndexByPosition(itemList, children, {
          left: position.scopeLeft - itemList.rect.element.left,
          top: position.scopeTop - (list2.rect.outer.top + list2.rect.element.marginTop + list2.rect.element.scrollTop)
        });
      };
      var toggleDrop = function toggleDrop2(root2) {
        var isAllowed = root2.query("GET_ALLOW_DROP");
        var isDisabled2 = root2.query("GET_DISABLED");
        var enabled = isAllowed && !isDisabled2;
        if (enabled && !root2.ref.hopper) {
          var hopper = createHopper(
            root2.element,
            function(items) {
              var beforeDropFile = root2.query("GET_BEFORE_DROP_FILE") || function() {
                return true;
              };
              var dropValidation = root2.query("GET_DROP_VALIDATION");
              return dropValidation ? items.every(function(item2) {
                return applyFilters("ALLOW_HOPPER_ITEM", item2, {
                  query: root2.query
                }).every(function(result) {
                  return result === true;
                }) && beforeDropFile(item2);
              }) : true;
            },
            {
              filterItems: function filterItems(items) {
                var ignoredFiles = root2.query("GET_IGNORED_FILES");
                return items.filter(function(item2) {
                  if (isFile(item2)) {
                    return !ignoredFiles.includes(item2.name.toLowerCase());
                  }
                  return true;
                });
              },
              catchesDropsOnPage: root2.query("GET_DROP_ON_PAGE"),
              requiresDropOnElement: root2.query("GET_DROP_ON_ELEMENT")
            }
          );
          hopper.onload = function(items, position) {
            var list2 = root2.ref.list.childViews[0];
            var visibleChildren = list2.childViews.filter(function(child) {
              return child.rect.element.height;
            });
            var children = root2.query("GET_ACTIVE_ITEMS").map(function(item2) {
              return visibleChildren.find(function(child) {
                return child.id === item2.id;
              });
            }).filter(function(item2) {
              return item2;
            });
            applyFilterChain("ADD_ITEMS", items, { dispatch: root2.dispatch }).then(function(queue) {
              if (exceedsMaxFiles(root2, queue)) return false;
              root2.dispatch("ADD_ITEMS", {
                items: queue,
                index: getDragIndex(root2.ref.list, children, position),
                interactionMethod: InteractionMethod.DROP
              });
            });
            root2.dispatch("DID_DROP", { position });
            root2.dispatch("DID_END_DRAG", { position });
          };
          hopper.ondragstart = function(position) {
            root2.dispatch("DID_START_DRAG", { position });
          };
          hopper.ondrag = debounce2(function(position) {
            root2.dispatch("DID_DRAG", { position });
          });
          hopper.ondragend = function(position) {
            root2.dispatch("DID_END_DRAG", { position });
          };
          root2.ref.hopper = hopper;
          root2.ref.drip = root2.appendChildView(root2.createChildView(drip));
        } else if (!enabled && root2.ref.hopper) {
          root2.ref.hopper.destroy();
          root2.ref.hopper = null;
          root2.removeChildView(root2.ref.drip);
        }
      };
      var toggleBrowse = function toggleBrowse2(root2, props) {
        var isAllowed = root2.query("GET_ALLOW_BROWSE");
        var isDisabled2 = root2.query("GET_DISABLED");
        var enabled = isAllowed && !isDisabled2;
        if (enabled && !root2.ref.browser) {
          root2.ref.browser = root2.appendChildView(
            root2.createChildView(
              browser,
              Object.assign({}, props, {
                onload: function onload(items) {
                  applyFilterChain("ADD_ITEMS", items, {
                    dispatch: root2.dispatch
                  }).then(function(queue) {
                    if (exceedsMaxFiles(root2, queue)) return false;
                    root2.dispatch("ADD_ITEMS", {
                      items: queue,
                      index: -1,
                      interactionMethod: InteractionMethod.BROWSE
                    });
                  });
                }
              })
            ),
            0
          );
        } else if (!enabled && root2.ref.browser) {
          root2.removeChildView(root2.ref.browser);
          root2.ref.browser = null;
        }
      };
      var togglePaste = function togglePaste2(root2) {
        var isAllowed = root2.query("GET_ALLOW_PASTE");
        var isDisabled2 = root2.query("GET_DISABLED");
        var enabled = isAllowed && !isDisabled2;
        if (enabled && !root2.ref.paster) {
          root2.ref.paster = createPaster();
          root2.ref.paster.onload = function(items) {
            applyFilterChain("ADD_ITEMS", items, { dispatch: root2.dispatch }).then(function(queue) {
              if (exceedsMaxFiles(root2, queue)) return false;
              root2.dispatch("ADD_ITEMS", {
                items: queue,
                index: -1,
                interactionMethod: InteractionMethod.PASTE
              });
            });
          };
        } else if (!enabled && root2.ref.paster) {
          root2.ref.paster.destroy();
          root2.ref.paster = null;
        }
      };
      var route$5 = createRoute({
        DID_SET_ALLOW_BROWSE: function DID_SET_ALLOW_BROWSE(_ref5) {
          var root2 = _ref5.root, props = _ref5.props;
          toggleBrowse(root2, props);
        },
        DID_SET_ALLOW_DROP: function DID_SET_ALLOW_DROP(_ref6) {
          var root2 = _ref6.root;
          toggleDrop(root2);
        },
        DID_SET_ALLOW_PASTE: function DID_SET_ALLOW_PASTE(_ref7) {
          var root2 = _ref7.root;
          togglePaste(root2);
        },
        DID_SET_DISABLED: function DID_SET_DISABLED(_ref8) {
          var root2 = _ref8.root, props = _ref8.props;
          toggleDrop(root2);
          togglePaste(root2);
          toggleBrowse(root2, props);
          var isDisabled2 = root2.query("GET_DISABLED");
          if (isDisabled2) {
            root2.element.dataset.disabled = "disabled";
          } else {
            root2.element.removeAttribute("data-disabled");
          }
        }
      });
      var root = createView({
        name: "root",
        read: function read2(_ref9) {
          var root2 = _ref9.root;
          if (root2.ref.measure) {
            root2.ref.measureHeight = root2.ref.measure.offsetHeight;
          }
        },
        create: create$e,
        write: write$9,
        destroy: function destroy(_ref10) {
          var root2 = _ref10.root;
          if (root2.ref.paster) {
            root2.ref.paster.destroy();
          }
          if (root2.ref.hopper) {
            root2.ref.hopper.destroy();
          }
          root2.element.removeEventListener("touchmove", prevent);
          root2.element.removeEventListener("gesturestart", prevent);
        },
        mixins: {
          styles: ["height"]
        }
      });
      var createApp = function createApp2() {
        var initialOptions = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        var originalElement = null;
        var defaultOptions2 = getOptions();
        var store = createStore(
          // initial state (should be serializable)
          createInitialState(defaultOptions2),
          // queries
          [queries, createOptionQueries(defaultOptions2)],
          // action handlers
          [actions, createOptionActions(defaultOptions2)]
        );
        store.dispatch("SET_OPTIONS", { options: initialOptions });
        var visibilityHandler = function visibilityHandler2() {
          if (document.hidden) return;
          store.dispatch("KICK");
        };
        document.addEventListener("visibilitychange", visibilityHandler);
        var resizeDoneTimer = null;
        var isResizing = false;
        var isResizingHorizontally = false;
        var initialWindowWidth = null;
        var currentWindowWidth = null;
        var resizeHandler = function resizeHandler2() {
          if (!isResizing) {
            isResizing = true;
          }
          clearTimeout(resizeDoneTimer);
          resizeDoneTimer = setTimeout(function() {
            isResizing = false;
            initialWindowWidth = null;
            currentWindowWidth = null;
            if (isResizingHorizontally) {
              isResizingHorizontally = false;
              store.dispatch("DID_STOP_RESIZE");
            }
          }, 500);
        };
        window.addEventListener("resize", resizeHandler);
        var view = root(store, { id: getUniqueId() });
        var isResting = false;
        var isHidden = false;
        var readWriteApi = {
          // necessary for update loop
          /**
           * Reads from dom (never call manually)
           * @private
           */
          _read: function _read() {
            if (isResizing) {
              currentWindowWidth = window.innerWidth;
              if (!initialWindowWidth) {
                initialWindowWidth = currentWindowWidth;
              }
              if (!isResizingHorizontally && currentWindowWidth !== initialWindowWidth) {
                store.dispatch("DID_START_RESIZE");
                isResizingHorizontally = true;
              }
            }
            if (isHidden && isResting) {
              isResting = view.element.offsetParent === null;
            }
            if (isResting) return;
            view._read();
            isHidden = view.rect.element.hidden;
          },
          /**
           * Writes to dom (never call manually)
           * @private
           */
          _write: function _write(ts) {
            var actions2 = store.processActionQueue().filter(function(action) {
              return !/^SET_/.test(action.type);
            });
            if (isResting && !actions2.length) return;
            routeActionsToEvents(actions2);
            isResting = view._write(ts, actions2, isResizingHorizontally);
            removeReleasedItems(store.query("GET_ITEMS"));
            if (isResting) {
              store.processDispatchQueue();
            }
          }
        };
        var createEvent = function createEvent2(name2) {
          return function(data2) {
            var event = {
              type: name2
            };
            if (!data2) {
              return event;
            }
            if (data2.hasOwnProperty("error")) {
              event.error = data2.error ? Object.assign({}, data2.error) : null;
            }
            if (data2.status) {
              event.status = Object.assign({}, data2.status);
            }
            if (data2.file) {
              event.output = data2.file;
            }
            if (data2.source) {
              event.file = data2.source;
            } else if (data2.item || data2.id) {
              var item2 = data2.item ? data2.item : store.query("GET_ITEM", data2.id);
              event.file = item2 ? createItemAPI(item2) : null;
            }
            if (data2.items) {
              event.items = data2.items.map(createItemAPI);
            }
            if (/progress/.test(name2)) {
              event.progress = data2.progress;
            }
            if (data2.hasOwnProperty("origin") && data2.hasOwnProperty("target")) {
              event.origin = data2.origin;
              event.target = data2.target;
            }
            return event;
          };
        };
        var eventRoutes = {
          DID_DESTROY: createEvent("destroy"),
          DID_INIT: createEvent("init"),
          DID_THROW_MAX_FILES: createEvent("warning"),
          DID_INIT_ITEM: createEvent("initfile"),
          DID_START_ITEM_LOAD: createEvent("addfilestart"),
          DID_UPDATE_ITEM_LOAD_PROGRESS: createEvent("addfileprogress"),
          DID_LOAD_ITEM: createEvent("addfile"),
          DID_THROW_ITEM_INVALID: [createEvent("error"), createEvent("addfile")],
          DID_THROW_ITEM_LOAD_ERROR: [createEvent("error"), createEvent("addfile")],
          DID_THROW_ITEM_REMOVE_ERROR: [createEvent("error"), createEvent("removefile")],
          DID_PREPARE_OUTPUT: createEvent("preparefile"),
          DID_START_ITEM_PROCESSING: createEvent("processfilestart"),
          DID_UPDATE_ITEM_PROCESS_PROGRESS: createEvent("processfileprogress"),
          DID_ABORT_ITEM_PROCESSING: createEvent("processfileabort"),
          DID_COMPLETE_ITEM_PROCESSING: createEvent("processfile"),
          DID_COMPLETE_ITEM_PROCESSING_ALL: createEvent("processfiles"),
          DID_REVERT_ITEM_PROCESSING: createEvent("processfilerevert"),
          DID_THROW_ITEM_PROCESSING_ERROR: [createEvent("error"), createEvent("processfile")],
          DID_REMOVE_ITEM: createEvent("removefile"),
          DID_UPDATE_ITEMS: createEvent("updatefiles"),
          DID_ACTIVATE_ITEM: createEvent("activatefile"),
          DID_REORDER_ITEMS: createEvent("reorderfiles")
        };
        var exposeEvent = function exposeEvent2(event) {
          var detail = Object.assign({ pond: exports3 }, event);
          delete detail.type;
          view.element.dispatchEvent(
            new CustomEvent("FilePond:" + event.type, {
              // event info
              detail,
              // event behaviour
              bubbles: true,
              cancelable: true,
              composed: true
              // triggers listeners outside of shadow root
            })
          );
          var params = [];
          if (event.hasOwnProperty("error")) {
            params.push(event.error);
          }
          if (event.hasOwnProperty("file")) {
            params.push(event.file);
          }
          var filtered = ["type", "error", "file"];
          Object.keys(event).filter(function(key) {
            return !filtered.includes(key);
          }).forEach(function(key) {
            return params.push(event[key]);
          });
          exports3.fire.apply(exports3, [event.type].concat(params));
          var handler = store.query("GET_ON" + event.type.toUpperCase());
          if (handler) {
            handler.apply(void 0, params);
          }
        };
        var routeActionsToEvents = function routeActionsToEvents2(actions2) {
          if (!actions2.length) return;
          actions2.filter(function(action) {
            return eventRoutes[action.type];
          }).forEach(function(action) {
            var routes = eventRoutes[action.type];
            (Array.isArray(routes) ? routes : [routes]).forEach(function(route2) {
              if (action.type === "DID_INIT_ITEM") {
                exposeEvent(route2(action.data));
              } else {
                setTimeout(function() {
                  exposeEvent(route2(action.data));
                }, 0);
              }
            });
          });
        };
        var setOptions2 = function setOptions3(options) {
          return store.dispatch("SET_OPTIONS", { options });
        };
        var getFile = function getFile2(query) {
          return store.query("GET_ACTIVE_ITEM", query);
        };
        var prepareFile = function prepareFile2(query) {
          return new Promise(function(resolve, reject) {
            store.dispatch("REQUEST_ITEM_PREPARE", {
              query,
              success: function success(item2) {
                resolve(item2);
              },
              failure: function failure(error2) {
                reject(error2);
              }
            });
          });
        };
        var addFile = function addFile2(source) {
          var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
          return new Promise(function(resolve, reject) {
            addFiles([{ source, options }], { index: options.index }).then(function(items) {
              return resolve(items && items[0]);
            }).catch(reject);
          });
        };
        var isFilePondFile = function isFilePondFile2(obj) {
          return obj.file && obj.id;
        };
        var removeFile = function removeFile2(query, options) {
          if (typeof query === "object" && !isFilePondFile(query) && !options) {
            options = query;
            query = void 0;
          }
          store.dispatch("REMOVE_ITEM", Object.assign({}, options, { query }));
          return store.query("GET_ACTIVE_ITEM", query) === null;
        };
        var addFiles = function addFiles2() {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          return new Promise(function(resolve, reject) {
            var sources = [];
            var options = {};
            if (isArray(args[0])) {
              sources.push.apply(sources, args[0]);
              Object.assign(options, args[1] || {});
            } else {
              var lastArgument = args[args.length - 1];
              if (typeof lastArgument === "object" && !(lastArgument instanceof Blob)) {
                Object.assign(options, args.pop());
              }
              sources.push.apply(sources, args);
            }
            store.dispatch("ADD_ITEMS", {
              items: sources,
              index: options.index,
              interactionMethod: InteractionMethod.API,
              success: resolve,
              failure: reject
            });
          });
        };
        var getFiles2 = function getFiles3() {
          return store.query("GET_ACTIVE_ITEMS");
        };
        var processFile = function processFile2(query) {
          return new Promise(function(resolve, reject) {
            store.dispatch("REQUEST_ITEM_PROCESSING", {
              query,
              success: function success(item2) {
                resolve(item2);
              },
              failure: function failure(error2) {
                reject(error2);
              }
            });
          });
        };
        var prepareFiles = function prepareFiles2() {
          for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
          }
          var queries2 = Array.isArray(args[0]) ? args[0] : args;
          var items = queries2.length ? queries2 : getFiles2();
          return Promise.all(items.map(prepareFile));
        };
        var processFiles = function processFiles2() {
          for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
            args[_key3] = arguments[_key3];
          }
          var queries2 = Array.isArray(args[0]) ? args[0] : args;
          if (!queries2.length) {
            var files = getFiles2().filter(function(item2) {
              return !(item2.status === ItemStatus.IDLE && item2.origin === FileOrigin.LOCAL) && item2.status !== ItemStatus.PROCESSING && item2.status !== ItemStatus.PROCESSING_COMPLETE && item2.status !== ItemStatus.PROCESSING_REVERT_ERROR;
            });
            return Promise.all(files.map(processFile));
          }
          return Promise.all(queries2.map(processFile));
        };
        var removeFiles = function removeFiles2() {
          for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
            args[_key4] = arguments[_key4];
          }
          var queries2 = Array.isArray(args[0]) ? args[0] : args;
          var options;
          if (typeof queries2[queries2.length - 1] === "object") {
            options = queries2.pop();
          } else if (Array.isArray(args[0])) {
            options = args[1];
          }
          var files = getFiles2();
          if (!queries2.length)
            return Promise.all(
              files.map(function(file2) {
                return removeFile(file2, options);
              })
            );
          var mappedQueries = queries2.map(function(query) {
            return isNumber(query) ? files[query] ? files[query].id : null : query;
          }).filter(function(query) {
            return query;
          });
          return mappedQueries.map(function(q2) {
            return removeFile(q2, options);
          });
        };
        var exports3 = Object.assign(
          {},
          on(),
          {},
          readWriteApi,
          {},
          createOptionAPI(store, defaultOptions2),
          {
            /**
             * Override options defined in options object
             * @param options
             */
            setOptions: setOptions2,
            /**
             * Load the given file
             * @param source - the source of the file (either a File, base64 data uri or url)
             * @param options - object, { index: 0 }
             */
            addFile,
            /**
             * Load the given files
             * @param sources - the sources of the files to load
             * @param options - object, { index: 0 }
             */
            addFiles,
            /**
             * Returns the file objects matching the given query
             * @param query { string, number, null }
             */
            getFile,
            /**
             * Upload file with given name
             * @param query { string, number, null  }
             */
            processFile,
            /**
             * Request prepare output for file with given name
             * @param query { string, number, null  }
             */
            prepareFile,
            /**
             * Removes a file by its name
             * @param query { string, number, null  }
             */
            removeFile,
            /**
             * Moves a file to a new location in the files list
             */
            moveFile: function moveFile(query, index) {
              return store.dispatch("MOVE_ITEM", { query, index });
            },
            /**
             * Returns all files (wrapped in public api)
             */
            getFiles: getFiles2,
            /**
             * Starts uploading all files
             */
            processFiles,
            /**
             * Clears all files from the files list
             */
            removeFiles,
            /**
             * Starts preparing output of all files
             */
            prepareFiles,
            /**
             * Sort list of files
             */
            sort: function sort(compare) {
              return store.dispatch("SORT", { compare });
            },
            /**
             * Browse the file system for a file
             */
            browse: function browse() {
              var input = view.element.querySelector("input[type=file]");
              if (input) {
                input.click();
              }
            },
            /**
             * Destroys the app
             */
            destroy: function destroy() {
              exports3.fire("destroy", view.element);
              store.dispatch("ABORT_ALL");
              view._destroy();
              window.removeEventListener("resize", resizeHandler);
              document.removeEventListener("visibilitychange", visibilityHandler);
              store.dispatch("DID_DESTROY");
            },
            /**
             * Inserts the plugin before the target element
             */
            insertBefore: function insertBefore$1(element) {
              return insertBefore(view.element, element);
            },
            /**
             * Inserts the plugin after the target element
             */
            insertAfter: function insertAfter$1(element) {
              return insertAfter(view.element, element);
            },
            /**
             * Appends the plugin to the target element
             */
            appendTo: function appendTo(element) {
              return element.appendChild(view.element);
            },
            /**
             * Replaces an element with the app
             */
            replaceElement: function replaceElement(element) {
              insertBefore(view.element, element);
              element.parentNode.removeChild(element);
              originalElement = element;
            },
            /**
             * Restores the original element
             */
            restoreElement: function restoreElement() {
              if (!originalElement) {
                return;
              }
              insertAfter(originalElement, view.element);
              view.element.parentNode.removeChild(view.element);
              originalElement = null;
            },
            /**
             * Returns true if the app root is attached to given element
             * @param element
             */
            isAttachedTo: function isAttachedTo(element) {
              return view.element === element || originalElement === element;
            },
            /**
             * Returns the root element
             */
            element: {
              get: function get() {
                return view.element;
              }
            },
            /**
             * Returns the current pond status
             */
            status: {
              get: function get() {
                return store.query("GET_STATUS");
              }
            }
          }
        );
        store.dispatch("DID_INIT");
        return createObject(exports3);
      };
      var createAppObject = function createAppObject2() {
        var customOptions = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
        var defaultOptions2 = {};
        forin(getOptions(), function(key, value) {
          defaultOptions2[key] = value[0];
        });
        var app = createApp(
          Object.assign(
            {},
            defaultOptions2,
            {},
            customOptions
          )
        );
        return app;
      };
      var lowerCaseFirstLetter = function lowerCaseFirstLetter2(string) {
        return string.charAt(0).toLowerCase() + string.slice(1);
      };
      var attributeNameToPropertyName = function attributeNameToPropertyName2(attributeName) {
        return toCamels(attributeName.replace(/^data-/, ""));
      };
      var mapObject = function mapObject2(object, propertyMap) {
        forin(propertyMap, function(selector, mapping) {
          forin(object, function(property, value) {
            var selectorRegExp = new RegExp(selector);
            var matches = selectorRegExp.test(property);
            if (!matches) {
              return;
            }
            delete object[property];
            if (mapping === false) {
              return;
            }
            if (isString(mapping)) {
              object[mapping] = value;
              return;
            }
            var group = mapping.group;
            if (isObject(mapping) && !object[group]) {
              object[group] = {};
            }
            object[group][lowerCaseFirstLetter(property.replace(selectorRegExp, ""))] = value;
          });
          if (mapping.mapping) {
            mapObject2(object[mapping.group], mapping.mapping);
          }
        });
      };
      var getAttributesAsObject = function getAttributesAsObject2(node) {
        var attributeMapping = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        var attributes = [];
        forin(node.attributes, function(index) {
          attributes.push(node.attributes[index]);
        });
        var output = attributes.filter(function(attribute) {
          return attribute.name;
        }).reduce(function(obj, attribute) {
          var value = attr(node, attribute.name);
          obj[attributeNameToPropertyName(attribute.name)] = value === attribute.name ? true : value;
          return obj;
        }, {});
        mapObject(output, attributeMapping);
        return output;
      };
      var createAppAtElement = function createAppAtElement2(element) {
        var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
        var attributeMapping = {
          // translate to other name
          "^class$": "className",
          "^multiple$": "allowMultiple",
          "^capture$": "captureMethod",
          "^webkitdirectory$": "allowDirectoriesOnly",
          // group under single property
          "^server": {
            group: "server",
            mapping: {
              "^process": {
                group: "process"
              },
              "^revert": {
                group: "revert"
              },
              "^fetch": {
                group: "fetch"
              },
              "^restore": {
                group: "restore"
              },
              "^load": {
                group: "load"
              }
            }
          },
          // don't include in object
          "^type$": false,
          "^files$": false
        };
        applyFilters("SET_ATTRIBUTE_TO_OPTION_MAP", attributeMapping);
        var mergedOptions = Object.assign({}, options);
        var attributeOptions = getAttributesAsObject(
          element.nodeName === "FIELDSET" ? element.querySelector("input[type=file]") : element,
          attributeMapping
        );
        Object.keys(attributeOptions).forEach(function(key) {
          if (isObject(attributeOptions[key])) {
            if (!isObject(mergedOptions[key])) {
              mergedOptions[key] = {};
            }
            Object.assign(mergedOptions[key], attributeOptions[key]);
          } else {
            mergedOptions[key] = attributeOptions[key];
          }
        });
        mergedOptions.files = (options.files || []).concat(
          Array.from(element.querySelectorAll("input:not([type=file])")).map(function(input) {
            return {
              source: input.value,
              options: {
                type: input.dataset.type
              }
            };
          })
        );
        var app = createAppObject(mergedOptions);
        if (element.files) {
          Array.from(element.files).forEach(function(file2) {
            app.addFile(file2);
          });
        }
        app.replaceElement(element);
        return app;
      };
      var createApp$1 = function createApp2() {
        return isNode(arguments.length <= 0 ? void 0 : arguments[0]) ? createAppAtElement.apply(void 0, arguments) : createAppObject.apply(void 0, arguments);
      };
      var PRIVATE_METHODS = ["fire", "_read", "_write"];
      var createAppAPI = function createAppAPI2(app) {
        var api = {};
        copyObjectPropertiesToObject(app, api, PRIVATE_METHODS);
        return api;
      };
      var replaceInString = function replaceInString2(string, replacements) {
        return string.replace(/(?:{([a-zA-Z]+)})/g, function(match, group) {
          return replacements[group];
        });
      };
      var createWorker = function createWorker2(fn3) {
        var workerBlob = new Blob(["(", fn3.toString(), ")()"], {
          type: "application/javascript"
        });
        var workerURL = URL.createObjectURL(workerBlob);
        var worker = new Worker(workerURL);
        return {
          transfer: function transfer(message, cb) {
          },
          post: function post(message, cb, transferList) {
            var id2 = getUniqueId();
            worker.onmessage = function(e) {
              if (e.data.id === id2) {
                cb(e.data.message);
              }
            };
            worker.postMessage(
              {
                id: id2,
                message
              },
              transferList
            );
          },
          terminate: function terminate() {
            worker.terminate();
            URL.revokeObjectURL(workerURL);
          }
        };
      };
      var loadImage = function loadImage2(url) {
        return new Promise(function(resolve, reject) {
          var img = new Image();
          img.onload = function() {
            resolve(img);
          };
          img.onerror = function(e) {
            reject(e);
          };
          img.src = url;
        });
      };
      var renameFile = function renameFile2(file2, name2) {
        var renamedFile = file2.slice(0, file2.size, file2.type);
        renamedFile.lastModifiedDate = file2.lastModifiedDate;
        renamedFile.name = name2;
        return renamedFile;
      };
      var copyFile = function copyFile2(file2) {
        return renameFile(file2, file2.name);
      };
      var registeredPlugins = [];
      var createAppPlugin = function createAppPlugin2(plugin) {
        if (registeredPlugins.includes(plugin)) {
          return;
        }
        registeredPlugins.push(plugin);
        var pluginOutline = plugin({
          addFilter,
          utils: {
            Type,
            forin,
            isString,
            isFile,
            toNaturalFileSize,
            replaceInString,
            getExtensionFromFilename,
            getFilenameWithoutExtension,
            guesstimateMimeType,
            getFileFromBlob,
            getFilenameFromURL,
            createRoute,
            createWorker,
            createView,
            createItemAPI,
            loadImage,
            copyFile,
            renameFile,
            createBlob,
            applyFilterChain,
            text,
            getNumericAspectRatioFromString
          },
          views: {
            fileActionButton
          }
        });
        extendDefaultOptions(pluginOutline.options);
      };
      var isOperaMini = function isOperaMini2() {
        return Object.prototype.toString.call(window.operamini) === "[object OperaMini]";
      };
      var hasPromises = function hasPromises2() {
        return "Promise" in window;
      };
      var hasBlobSlice = function hasBlobSlice2() {
        return "slice" in Blob.prototype;
      };
      var hasCreateObjectURL = function hasCreateObjectURL2() {
        return "URL" in window && "createObjectURL" in window.URL;
      };
      var hasVisibility = function hasVisibility2() {
        return "visibilityState" in document;
      };
      var hasTiming = function hasTiming2() {
        return "performance" in window;
      };
      var hasCSSSupports = function hasCSSSupports2() {
        return "supports" in (window.CSS || {});
      };
      var isIE11 = function isIE112() {
        return /MSIE|Trident/.test(window.navigator.userAgent);
      };
      var supported = (function() {
        var isSupported = (
          // Has to be a browser
          isBrowser() && // Can't run on Opera Mini due to lack of everything
          !isOperaMini() && // Require these APIs to feature detect a modern browser
          hasVisibility() && hasPromises() && hasBlobSlice() && hasCreateObjectURL() && hasTiming() && // doesn't need CSSSupports but is a good way to detect Safari 9+ (we do want to support IE11 though)
          (hasCSSSupports() || isIE11())
        );
        return function() {
          return isSupported;
        };
      })();
      var state = {
        // active app instances, used to redraw the apps and to find the later
        apps: []
      };
      var name = "filepond";
      var fn2 = function fn3() {
      };
      exports2.Status = {};
      exports2.FileStatus = {};
      exports2.FileOrigin = {};
      exports2.OptionTypes = {};
      exports2.create = fn2;
      exports2.destroy = fn2;
      exports2.parse = fn2;
      exports2.find = fn2;
      exports2.registerPlugin = fn2;
      exports2.getOptions = fn2;
      exports2.setOptions = fn2;
      if (supported()) {
        createPainter(
          function() {
            state.apps.forEach(function(app) {
              return app._read();
            });
          },
          function(ts) {
            state.apps.forEach(function(app) {
              return app._write(ts);
            });
          }
        );
        var dispatch = function dispatch2() {
          document.dispatchEvent(
            new CustomEvent("FilePond:loaded", {
              detail: {
                supported,
                create: exports2.create,
                destroy: exports2.destroy,
                parse: exports2.parse,
                find: exports2.find,
                registerPlugin: exports2.registerPlugin,
                setOptions: exports2.setOptions
              }
            })
          );
          document.removeEventListener("DOMContentLoaded", dispatch2);
        };
        if (document.readyState !== "loading") {
          setTimeout(function() {
            return dispatch();
          }, 0);
        } else {
          document.addEventListener("DOMContentLoaded", dispatch);
        }
        var updateOptionTypes = function updateOptionTypes2() {
          return forin(getOptions(), function(key, value) {
            exports2.OptionTypes[key] = value[1];
          });
        };
        exports2.Status = Object.assign({}, Status);
        exports2.FileOrigin = Object.assign({}, FileOrigin);
        exports2.FileStatus = Object.assign({}, ItemStatus);
        exports2.OptionTypes = {};
        updateOptionTypes();
        exports2.create = function create2() {
          var app = createApp$1.apply(void 0, arguments);
          app.on("destroy", exports2.destroy);
          state.apps.push(app);
          return createAppAPI(app);
        };
        exports2.destroy = function destroy(hook) {
          var indexToRemove = state.apps.findIndex(function(app2) {
            return app2.isAttachedTo(hook);
          });
          if (indexToRemove >= 0) {
            var app = state.apps.splice(indexToRemove, 1)[0];
            app.restoreElement();
            return true;
          }
          return false;
        };
        exports2.parse = function parse(context) {
          var matchedHooks = Array.from(context.querySelectorAll("." + name));
          var newHooks = matchedHooks.filter(function(newHook) {
            return !state.apps.find(function(app) {
              return app.isAttachedTo(newHook);
            });
          });
          return newHooks.map(function(hook) {
            return exports2.create(hook);
          });
        };
        exports2.find = function find(hook) {
          var app = state.apps.find(function(app2) {
            return app2.isAttachedTo(hook);
          });
          if (!app) {
            return null;
          }
          return createAppAPI(app);
        };
        exports2.registerPlugin = function registerPlugin() {
          for (var _len = arguments.length, plugins = new Array(_len), _key = 0; _key < _len; _key++) {
            plugins[_key] = arguments[_key];
          }
          plugins.forEach(createAppPlugin);
          updateOptionTypes();
        };
        exports2.getOptions = function getOptions$1() {
          var opts = {};
          forin(getOptions(), function(key, value) {
            opts[key] = value[0];
          });
          return opts;
        };
        exports2.setOptions = function setOptions$1(opts) {
          if (isObject(opts)) {
            state.apps.forEach(function(app) {
              app.setOptions(opts);
            });
            setOptions(opts);
          }
          return exports2.getOptions();
        };
      }
      exports2.supported = supported;
      Object.defineProperty(exports2, "__esModule", { value: true });
    });
  }
});

// node_modules/.pnpm/sweetalert2@11.26.24/node_modules/sweetalert2/dist/sweetalert2.all.js
var require_sweetalert2_all = __commonJS({
  "node_modules/.pnpm/sweetalert2@11.26.24/node_modules/sweetalert2/dist/sweetalert2.all.js"(exports, module) {
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.Sweetalert2 = factory());
    })(exports, (function() {
      "use strict";
      function _assertClassBrand(e, t, n) {
        if ("function" == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n;
        throw new TypeError("Private element is not present on this object");
      }
      function _checkPrivateRedeclaration(e, t) {
        if (t.has(e)) throw new TypeError("Cannot initialize the same private elements twice on an object");
      }
      function _classPrivateFieldGet2(s, a2) {
        return s.get(_assertClassBrand(s, a2));
      }
      function _classPrivateFieldInitSpec(e, t, a2) {
        _checkPrivateRedeclaration(e, t), t.set(e, a2);
      }
      function _classPrivateFieldSet2(s, a2, r) {
        return s.set(_assertClassBrand(s, a2), r), r;
      }
      const RESTORE_FOCUS_TIMEOUT = 100;
      const globalState = {};
      const focusPreviousActiveElement = () => {
        if (globalState.previousActiveElement instanceof HTMLElement) {
          globalState.previousActiveElement.focus();
          globalState.previousActiveElement = null;
        } else if (document.body) {
          document.body.focus();
        }
      };
      const restoreActiveElement = (returnFocus) => {
        return new Promise((resolve) => {
          if (!returnFocus) {
            return resolve();
          }
          const x2 = window.scrollX;
          const y3 = window.scrollY;
          globalState.restoreFocusTimeout = setTimeout(() => {
            focusPreviousActiveElement();
            resolve();
          }, RESTORE_FOCUS_TIMEOUT);
          window.scrollTo(x2, y3);
        });
      };
      const swalPrefix = "swal2-";
      const classNames = ["container", "shown", "height-auto", "iosfix", "popup", "modal", "no-backdrop", "no-transition", "toast", "toast-shown", "show", "hide", "close", "title", "html-container", "actions", "confirm", "deny", "cancel", "footer", "icon", "icon-content", "image", "input", "file", "range", "select", "radio", "checkbox", "label", "textarea", "inputerror", "input-label", "validation-message", "progress-steps", "active-progress-step", "progress-step", "progress-step-line", "loader", "loading", "styled", "top", "top-start", "top-end", "top-left", "top-right", "center", "center-start", "center-end", "center-left", "center-right", "bottom", "bottom-start", "bottom-end", "bottom-left", "bottom-right", "grow-row", "grow-column", "grow-fullscreen", "rtl", "timer-progress-bar", "timer-progress-bar-container", "scrollbar-measure", "icon-success", "icon-warning", "icon-info", "icon-question", "icon-error", "draggable", "dragging"];
      const swalClasses = classNames.reduce(
        (acc, className) => {
          acc[className] = swalPrefix + className;
          return acc;
        },
        /** @type {SwalClasses} */
        {}
      );
      const icons = ["success", "warning", "info", "question", "error"];
      const iconTypes = icons.reduce(
        (acc, icon) => {
          acc[icon] = swalPrefix + icon;
          return acc;
        },
        /** @type {SwalIcons} */
        {}
      );
      const consolePrefix = "SweetAlert2:";
      const capitalizeFirstLetter = (str) => str.charAt(0).toUpperCase() + str.slice(1);
      const warn = (message) => {
        console.warn(`${consolePrefix} ${typeof message === "object" ? message.join(" ") : message}`);
      };
      const error = (message) => {
        console.error(`${consolePrefix} ${message}`);
      };
      const previousWarnOnceMessages = [];
      const warnOnce = (message) => {
        if (!previousWarnOnceMessages.includes(message)) {
          previousWarnOnceMessages.push(message);
          warn(message);
        }
      };
      const warnAboutDeprecation = (deprecatedParam, useInstead = null) => {
        warnOnce(`"${deprecatedParam}" is deprecated and will be removed in the next major release.${useInstead ? ` Use "${useInstead}" instead.` : ""}`);
      };
      const callIfFunction = (arg) => typeof arg === "function" ? arg() : arg;
      const hasToPromiseFn = (arg) => arg && typeof arg.toPromise === "function";
      const asPromise = (arg) => hasToPromiseFn(arg) ? arg.toPromise() : Promise.resolve(arg);
      const isPromise = (arg) => arg && Promise.resolve(arg) === arg;
      const isFirefox = () => navigator.userAgent.includes("Firefox");
      const getContainer = () => document.body.querySelector(`.${swalClasses.container}`);
      const elementBySelector = (selectorString) => {
        const container = getContainer();
        return container ? container.querySelector(selectorString) : null;
      };
      const elementByClass = (className) => {
        return elementBySelector(`.${className}`);
      };
      const getPopup = () => elementByClass(swalClasses.popup);
      const getIcon = () => elementByClass(swalClasses.icon);
      const getIconContent = () => elementByClass(swalClasses["icon-content"]);
      const getTitle = () => elementByClass(swalClasses.title);
      const getHtmlContainer = () => elementByClass(swalClasses["html-container"]);
      const getImage = () => elementByClass(swalClasses.image);
      const getProgressSteps = () => elementByClass(swalClasses["progress-steps"]);
      const getValidationMessage = () => elementByClass(swalClasses["validation-message"]);
      const getConfirmButton = () => (
        /** @type {HTMLButtonElement} */
        elementBySelector(`.${swalClasses.actions} .${swalClasses.confirm}`)
      );
      const getCancelButton = () => (
        /** @type {HTMLButtonElement} */
        elementBySelector(`.${swalClasses.actions} .${swalClasses.cancel}`)
      );
      const getDenyButton = () => (
        /** @type {HTMLButtonElement} */
        elementBySelector(`.${swalClasses.actions} .${swalClasses.deny}`)
      );
      const getInputLabel = () => elementByClass(swalClasses["input-label"]);
      const getLoader = () => elementBySelector(`.${swalClasses.loader}`);
      const getActions = () => elementByClass(swalClasses.actions);
      const getFooter = () => elementByClass(swalClasses.footer);
      const getTimerProgressBar = () => elementByClass(swalClasses["timer-progress-bar"]);
      const getCloseButton = () => elementByClass(swalClasses.close);
      const focusable = `
  a[href],
  area[href],
  input:not([disabled]),
  select:not([disabled]),
  textarea:not([disabled]),
  button:not([disabled]),
  iframe,
  object,
  embed,
  [tabindex="0"],
  [contenteditable],
  audio[controls],
  video[controls],
  summary
`;
      const getFocusableElements = () => {
        const popup = getPopup();
        if (!popup) {
          return [];
        }
        const focusableElementsWithTabindex = popup.querySelectorAll('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])');
        const focusableElementsWithTabindexSorted = Array.from(focusableElementsWithTabindex).sort((a2, b3) => {
          const tabindexA = parseInt(a2.getAttribute("tabindex") || "0");
          const tabindexB = parseInt(b3.getAttribute("tabindex") || "0");
          if (tabindexA > tabindexB) {
            return 1;
          } else if (tabindexA < tabindexB) {
            return -1;
          }
          return 0;
        });
        const otherFocusableElements = popup.querySelectorAll(focusable);
        const otherFocusableElementsFiltered = Array.from(otherFocusableElements).filter((el) => el.getAttribute("tabindex") !== "-1");
        return [...new Set(focusableElementsWithTabindexSorted.concat(otherFocusableElementsFiltered))].filter((el) => isVisible$1(el));
      };
      const isModal = () => {
        return hasClass(document.body, swalClasses.shown) && !hasClass(document.body, swalClasses["toast-shown"]) && !hasClass(document.body, swalClasses["no-backdrop"]);
      };
      const isToast = () => {
        const popup = getPopup();
        if (!popup) {
          return false;
        }
        return hasClass(popup, swalClasses.toast);
      };
      const isLoading = () => {
        const popup = getPopup();
        if (!popup) {
          return false;
        }
        return popup.hasAttribute("data-loading");
      };
      const setInnerHtml = (elem, html) => {
        elem.textContent = "";
        if (html) {
          const parser = new DOMParser();
          const parsed = parser.parseFromString(html, `text/html`);
          const head = parsed.querySelector("head");
          if (head) {
            Array.from(head.childNodes).forEach((child) => {
              elem.appendChild(child);
            });
          }
          const body = parsed.querySelector("body");
          if (body) {
            Array.from(body.childNodes).forEach((child) => {
              if (child instanceof HTMLVideoElement || child instanceof HTMLAudioElement) {
                elem.appendChild(child.cloneNode(true));
              } else {
                elem.appendChild(child);
              }
            });
          }
        }
      };
      const hasClass = (elem, className) => {
        if (!className) {
          return false;
        }
        const classList = className.split(/\s+/);
        for (let i = 0; i < classList.length; i++) {
          if (!elem.classList.contains(classList[i])) {
            return false;
          }
        }
        return true;
      };
      const removeCustomClasses = (elem, params) => {
        Array.from(elem.classList).forEach((className) => {
          if (!Object.values(swalClasses).includes(className) && !Object.values(iconTypes).includes(className) && !Object.values(params.showClass || {}).includes(className)) {
            elem.classList.remove(className);
          }
        });
      };
      const applyCustomClass = (elem, params, className) => {
        removeCustomClasses(elem, params);
        if (!params.customClass) {
          return;
        }
        const customClass = params.customClass[
          /** @type {keyof SweetAlertCustomClass} */
          className
        ];
        if (!customClass) {
          return;
        }
        if (typeof customClass !== "string" && !customClass.forEach) {
          warn(`Invalid type of customClass.${className}! Expected string or iterable object, got "${typeof customClass}"`);
          return;
        }
        addClass(elem, customClass);
      };
      const getInput$1 = (popup, inputClass) => {
        if (!inputClass) {
          return null;
        }
        switch (inputClass) {
          case "select":
          case "textarea":
          case "file":
            return popup.querySelector(`.${swalClasses.popup} > .${swalClasses[inputClass]}`);
          case "checkbox":
            return popup.querySelector(`.${swalClasses.popup} > .${swalClasses.checkbox} input`);
          case "radio":
            return popup.querySelector(`.${swalClasses.popup} > .${swalClasses.radio} input:checked`) || popup.querySelector(`.${swalClasses.popup} > .${swalClasses.radio} input:first-child`);
          case "range":
            return popup.querySelector(`.${swalClasses.popup} > .${swalClasses.range} input`);
          default:
            return popup.querySelector(`.${swalClasses.popup} > .${swalClasses.input}`);
        }
      };
      const focusInput = (input) => {
        input.focus();
        if (input.type !== "file") {
          const val = input.value;
          input.value = "";
          input.value = val;
        }
      };
      const toggleClass = (target, classList, condition) => {
        if (!target || !classList) {
          return;
        }
        const classes = typeof classList === "string" ? classList.split(/\s+/).filter(Boolean) : classList;
        const targets = Array.isArray(target) ? target : [target];
        targets.forEach((elem) => {
          classes.forEach((className) => {
            if (condition) {
              elem.classList.add(className);
            } else {
              elem.classList.remove(className);
            }
          });
        });
      };
      const addClass = (target, classList) => {
        toggleClass(target, classList, true);
      };
      const removeClass = (target, classList) => {
        toggleClass(target, classList, false);
      };
      const getDirectChildByClass = (elem, className) => {
        const children = Array.from(elem.children);
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child instanceof HTMLElement && hasClass(child, className)) {
            return child;
          }
        }
      };
      const applyNumericalStyle = (elem, property, value) => {
        if (value === `${parseInt(`${value}`)}`) {
          value = parseInt(value);
        }
        if (value || value === 0) {
          elem.style.setProperty(property, typeof value === "number" ? `${value}px` : (
            /** @type {string} */
            value
          ));
        } else {
          elem.style.removeProperty(property);
        }
      };
      const show = (elem, display = "flex") => {
        if (!elem) {
          return;
        }
        elem.style.display = display;
      };
      const hide2 = (elem) => {
        if (!elem) {
          return;
        }
        elem.style.display = "none";
      };
      const showWhenInnerHtmlPresent = (elem, display = "block") => {
        if (!elem) {
          return;
        }
        new MutationObserver(() => {
          toggle(elem, elem.innerHTML, display);
        }).observe(elem, {
          childList: true,
          subtree: true
        });
      };
      const setStyle = (parent, selector, property, value) => {
        const el = parent.querySelector(selector);
        if (el) {
          el.style.setProperty(property, value);
        }
      };
      const toggle = (elem, condition, display = "flex") => {
        if (condition) {
          show(elem, display);
        } else {
          hide2(elem);
        }
      };
      const isVisible$1 = (elem) => Boolean(elem && (elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length));
      const allButtonsAreHidden = () => !isVisible$1(getConfirmButton()) && !isVisible$1(getDenyButton()) && !isVisible$1(getCancelButton());
      const isScrollable = (elem) => Boolean(elem.scrollHeight > elem.clientHeight);
      const selfOrParentIsScrollable = (element, stopElement) => {
        let parent = (
          /** @type {HTMLElement | null} */
          element
        );
        while (parent && parent !== stopElement) {
          if (isScrollable(parent)) {
            return true;
          }
          parent = parent.parentElement;
        }
        return false;
      };
      const hasCssAnimation = (elem) => {
        const style = window.getComputedStyle(elem);
        const animDuration = parseFloat(style.getPropertyValue("animation-duration") || "0");
        const transDuration = parseFloat(style.getPropertyValue("transition-duration") || "0");
        return animDuration > 0 || transDuration > 0;
      };
      const animateTimerProgressBar = (timer, reset = false) => {
        const timerProgressBar = getTimerProgressBar();
        if (!timerProgressBar) {
          return;
        }
        if (isVisible$1(timerProgressBar)) {
          if (reset) {
            timerProgressBar.style.transition = "none";
            timerProgressBar.style.width = "100%";
          }
          setTimeout(() => {
            timerProgressBar.style.transition = `width ${timer / 1e3}s linear`;
            timerProgressBar.style.width = "0%";
          }, 10);
        }
      };
      const stopTimerProgressBar = () => {
        const timerProgressBar = getTimerProgressBar();
        if (!timerProgressBar) {
          return;
        }
        const timerProgressBarWidth = parseInt(window.getComputedStyle(timerProgressBar).width);
        timerProgressBar.style.removeProperty("transition");
        timerProgressBar.style.width = "100%";
        const timerProgressBarFullWidth = parseInt(window.getComputedStyle(timerProgressBar).width);
        const timerProgressBarPercent = timerProgressBarWidth / timerProgressBarFullWidth * 100;
        timerProgressBar.style.width = `${timerProgressBarPercent}%`;
      };
      const isNodeEnv = () => typeof window === "undefined" || typeof document === "undefined";
      const sweetHTML = `
 <div aria-labelledby="${swalClasses.title}" aria-describedby="${swalClasses["html-container"]}" class="${swalClasses.popup}" tabindex="-1">
   <button type="button" class="${swalClasses.close}"></button>
   <ul class="${swalClasses["progress-steps"]}"></ul>
   <div class="${swalClasses.icon}"></div>
   <img class="${swalClasses.image}" />
   <h2 class="${swalClasses.title}" id="${swalClasses.title}"></h2>
   <div class="${swalClasses["html-container"]}" id="${swalClasses["html-container"]}"></div>
   <input class="${swalClasses.input}" id="${swalClasses.input}" />
   <input type="file" class="${swalClasses.file}" />
   <div class="${swalClasses.range}">
     <input type="range" />
     <output></output>
   </div>
   <select class="${swalClasses.select}" id="${swalClasses.select}"></select>
   <div class="${swalClasses.radio}"></div>
   <label class="${swalClasses.checkbox}">
     <input type="checkbox" id="${swalClasses.checkbox}" />
     <span class="${swalClasses.label}"></span>
   </label>
   <textarea class="${swalClasses.textarea}" id="${swalClasses.textarea}"></textarea>
   <div class="${swalClasses["validation-message"]}" id="${swalClasses["validation-message"]}"></div>
   <div class="${swalClasses.actions}">
     <div class="${swalClasses.loader}"></div>
     <button type="button" class="${swalClasses.confirm}"></button>
     <button type="button" class="${swalClasses.deny}"></button>
     <button type="button" class="${swalClasses.cancel}"></button>
   </div>
   <div class="${swalClasses.footer}"></div>
   <div class="${swalClasses["timer-progress-bar-container"]}">
     <div class="${swalClasses["timer-progress-bar"]}"></div>
   </div>
 </div>
`.replace(/(^|\n)\s*/g, "");
      const resetOldContainer = () => {
        const oldContainer = getContainer();
        if (!oldContainer) {
          return false;
        }
        oldContainer.remove();
        removeClass([document.documentElement, document.body], [
          swalClasses["no-backdrop"],
          swalClasses["toast-shown"],
          // @ts-ignore: 'has-column' is not defined in swalClasses but may be set dynamically
          swalClasses["has-column"]
        ]);
        return true;
      };
      const resetValidationMessage$1 = () => {
        if (globalState.currentInstance) {
          globalState.currentInstance.resetValidationMessage();
        }
      };
      const addInputChangeListeners = () => {
        const popup = getPopup();
        if (!popup) {
          return;
        }
        const input = getDirectChildByClass(popup, swalClasses.input);
        const file = getDirectChildByClass(popup, swalClasses.file);
        const range = popup.querySelector(`.${swalClasses.range} input`);
        const rangeOutput = popup.querySelector(`.${swalClasses.range} output`);
        const select = getDirectChildByClass(popup, swalClasses.select);
        const checkbox = popup.querySelector(`.${swalClasses.checkbox} input`);
        const textarea = getDirectChildByClass(popup, swalClasses.textarea);
        if (input) {
          input.oninput = resetValidationMessage$1;
        }
        if (file) {
          file.onchange = resetValidationMessage$1;
        }
        if (select) {
          select.onchange = resetValidationMessage$1;
        }
        if (checkbox) {
          checkbox.onchange = resetValidationMessage$1;
        }
        if (textarea) {
          textarea.oninput = resetValidationMessage$1;
        }
        if (range && rangeOutput) {
          range.oninput = () => {
            resetValidationMessage$1();
            rangeOutput.value = range.value;
          };
          range.onchange = () => {
            resetValidationMessage$1();
            rangeOutput.value = range.value;
          };
        }
      };
      const getTarget = (target) => {
        if (typeof target === "string") {
          const element = document.querySelector(target);
          if (!element) {
            throw new Error(`Target element "${target}" not found`);
          }
          return (
            /** @type {HTMLElement} */
            element
          );
        }
        return target;
      };
      const setupAccessibility = (params) => {
        const popup = getPopup();
        if (!popup) {
          return;
        }
        popup.setAttribute("role", params.toast ? "alert" : "dialog");
        popup.setAttribute("aria-live", params.toast ? "polite" : "assertive");
        if (!params.toast) {
          popup.setAttribute("aria-modal", "true");
        }
      };
      const setupRTL = (targetElement) => {
        if (window.getComputedStyle(targetElement).direction === "rtl") {
          addClass(getContainer(), swalClasses.rtl);
          globalState.isRTL = true;
        }
      };
      const init = (params) => {
        const oldContainerExisted = resetOldContainer();
        if (isNodeEnv()) {
          error("SweetAlert2 requires document to initialize");
          return;
        }
        const container = document.createElement("div");
        container.className = swalClasses.container;
        if (oldContainerExisted) {
          addClass(container, swalClasses["no-transition"]);
        }
        setInnerHtml(container, sweetHTML);
        container.dataset["swal2Theme"] = params.theme;
        const targetElement = getTarget(params.target || "body");
        targetElement.appendChild(container);
        if (params.topLayer) {
          container.setAttribute("popover", "");
          container.showPopover();
        }
        setupAccessibility(params);
        setupRTL(targetElement);
        addInputChangeListeners();
      };
      const parseHtmlToContainer = (param, target) => {
        if (param instanceof HTMLElement) {
          target.appendChild(param);
        } else if (typeof param === "object") {
          handleObject(param, target);
        } else if (param) {
          setInnerHtml(target, param);
        }
      };
      const handleObject = (param, target) => {
        if ("jquery" in param) {
          handleJqueryElem(target, param);
        } else {
          setInnerHtml(target, param.toString());
        }
      };
      const handleJqueryElem = (target, elem) => {
        target.textContent = "";
        if (0 in elem) {
          for (let i = 0; i in elem; i++) {
            target.appendChild(elem[i].cloneNode(true));
          }
        } else {
          target.appendChild(elem.cloneNode(true));
        }
      };
      const renderActions = (instance, params) => {
        const actions = getActions();
        const loader = getLoader();
        if (!actions || !loader) {
          return;
        }
        if (!params.showConfirmButton && !params.showDenyButton && !params.showCancelButton) {
          hide2(actions);
        } else {
          show(actions);
        }
        applyCustomClass(actions, params, "actions");
        renderButtons(actions, loader, params);
        setInnerHtml(loader, params.loaderHtml || "");
        applyCustomClass(loader, params, "loader");
      };
      function renderButtons(actions, loader, params) {
        const confirmButton = getConfirmButton();
        const denyButton = getDenyButton();
        const cancelButton = getCancelButton();
        if (!confirmButton || !denyButton || !cancelButton) {
          return;
        }
        renderButton(confirmButton, "confirm", params);
        renderButton(denyButton, "deny", params);
        renderButton(cancelButton, "cancel", params);
        handleButtonsStyling(confirmButton, denyButton, cancelButton, params);
        if (params.reverseButtons) {
          if (params.toast) {
            actions.insertBefore(cancelButton, confirmButton);
            actions.insertBefore(denyButton, confirmButton);
          } else {
            actions.insertBefore(cancelButton, loader);
            actions.insertBefore(denyButton, loader);
            actions.insertBefore(confirmButton, loader);
          }
        }
      }
      function handleButtonsStyling(confirmButton, denyButton, cancelButton, params) {
        if (!params.buttonsStyling) {
          removeClass([confirmButton, denyButton, cancelButton], swalClasses.styled);
          return;
        }
        addClass([confirmButton, denyButton, cancelButton], swalClasses.styled);
        const buttons = [[confirmButton, "confirm", params.confirmButtonColor], [denyButton, "deny", params.denyButtonColor], [cancelButton, "cancel", params.cancelButtonColor]];
        buttons.forEach(([button, type, color]) => {
          if (color) {
            button.style.setProperty(`--swal2-${type}-button-background-color`, color);
          }
          applyOutlineColor(button);
        });
      }
      function applyOutlineColor(button) {
        const buttonStyle = window.getComputedStyle(button);
        if (buttonStyle.getPropertyValue("--swal2-action-button-focus-box-shadow")) {
          return;
        }
        const outlineColor = buttonStyle.backgroundColor.replace(/rgba?\((\d+), (\d+), (\d+).*/, "rgba($1, $2, $3, 0.5)");
        button.style.setProperty("--swal2-action-button-focus-box-shadow", buttonStyle.getPropertyValue("--swal2-outline").replace(/ rgba\(.*/, ` ${outlineColor}`));
      }
      function renderButton(button, buttonType, params) {
        const buttonName = (
          /** @type {'Confirm' | 'Deny' | 'Cancel'} */
          capitalizeFirstLetter(buttonType)
        );
        toggle(button, params[`show${buttonName}Button`], "inline-block");
        setInnerHtml(button, params[`${buttonType}ButtonText`] || "");
        button.setAttribute("aria-label", params[`${buttonType}ButtonAriaLabel`] || "");
        button.className = swalClasses[buttonType];
        applyCustomClass(button, params, `${buttonType}Button`);
      }
      const renderCloseButton = (instance, params) => {
        const closeButton = getCloseButton();
        if (!closeButton) {
          return;
        }
        setInnerHtml(closeButton, params.closeButtonHtml || "");
        applyCustomClass(closeButton, params, "closeButton");
        toggle(closeButton, params.showCloseButton);
        closeButton.setAttribute("aria-label", params.closeButtonAriaLabel || "");
      };
      const renderContainer = (instance, params) => {
        const container = getContainer();
        if (!container) {
          return;
        }
        handleBackdropParam(container, params.backdrop);
        handlePositionParam(container, params.position);
        handleGrowParam(container, params.grow);
        applyCustomClass(container, params, "container");
      };
      function handleBackdropParam(container, backdrop) {
        if (typeof backdrop === "string") {
          container.style.background = backdrop;
        } else if (!backdrop) {
          addClass([document.documentElement, document.body], swalClasses["no-backdrop"]);
        }
      }
      function handlePositionParam(container, position) {
        if (!position) {
          return;
        }
        if (position in swalClasses) {
          addClass(container, swalClasses[position]);
        } else {
          warn('The "position" parameter is not valid, defaulting to "center"');
          addClass(container, swalClasses.center);
        }
      }
      function handleGrowParam(container, grow) {
        if (!grow) {
          return;
        }
        addClass(container, swalClasses[`grow-${grow}`]);
      }
      var privateProps = {
        innerParams: /* @__PURE__ */ new WeakMap(),
        domCache: /* @__PURE__ */ new WeakMap(),
        focusedElement: /* @__PURE__ */ new WeakMap()
      };
      const inputClasses = ["input", "file", "range", "select", "radio", "checkbox", "textarea"];
      const renderInput = (instance, params) => {
        const popup = getPopup();
        if (!popup) {
          return;
        }
        const innerParams = privateProps.innerParams.get(instance);
        const rerender = !innerParams || params.input !== innerParams.input;
        inputClasses.forEach((inputClass) => {
          const inputContainer = getDirectChildByClass(popup, swalClasses[inputClass]);
          if (!inputContainer) {
            return;
          }
          setAttributes(inputClass, params.inputAttributes);
          inputContainer.className = swalClasses[inputClass];
          if (rerender) {
            hide2(inputContainer);
          }
        });
        if (params.input) {
          if (rerender) {
            showInput(params);
          }
          setCustomClass(params);
        }
      };
      const showInput = (params) => {
        if (!params.input) {
          return;
        }
        if (!renderInputType[params.input]) {
          error(`Unexpected type of input! Expected ${Object.keys(renderInputType).join(" | ")}, got "${params.input}"`);
          return;
        }
        const inputContainer = getInputContainer(params.input);
        if (!inputContainer) {
          return;
        }
        const input = renderInputType[params.input](inputContainer, params);
        show(inputContainer);
        if (params.inputAutoFocus) {
          setTimeout(() => {
            focusInput(input);
          });
        }
      };
      const removeAttributes = (input) => {
        for (let i = 0; i < input.attributes.length; i++) {
          const attrName = input.attributes[i].name;
          if (!["id", "type", "value", "style"].includes(attrName)) {
            input.removeAttribute(attrName);
          }
        }
      };
      const setAttributes = (inputClass, inputAttributes) => {
        const popup = getPopup();
        if (!popup) {
          return;
        }
        const input = getInput$1(popup, inputClass);
        if (!input) {
          return;
        }
        removeAttributes(input);
        for (const attr in inputAttributes) {
          input.setAttribute(attr, inputAttributes[attr]);
        }
      };
      const setCustomClass = (params) => {
        if (!params.input) {
          return;
        }
        const inputContainer = getInputContainer(params.input);
        if (inputContainer) {
          applyCustomClass(inputContainer, params, "input");
        }
      };
      const setInputPlaceholder = (input, params) => {
        if (!input.placeholder && params.inputPlaceholder) {
          input.placeholder = params.inputPlaceholder;
        }
      };
      const setInputLabel = (input, prependTo, params) => {
        if (params.inputLabel) {
          const label = document.createElement("label");
          const labelClass = swalClasses["input-label"];
          label.setAttribute("for", input.id);
          label.className = labelClass;
          if (typeof params.customClass === "object") {
            addClass(label, params.customClass.inputLabel);
          }
          label.innerText = params.inputLabel;
          prependTo.insertAdjacentElement("beforebegin", label);
        }
      };
      const getInputContainer = (inputType) => {
        const popup = getPopup();
        if (!popup) {
          return;
        }
        return getDirectChildByClass(popup, swalClasses[
          /** @type {SwalClass} */
          inputType
        ] || swalClasses.input);
      };
      const checkAndSetInputValue = (input, inputValue) => {
        if (["string", "number"].includes(typeof inputValue)) {
          input.value = `${inputValue}`;
        } else if (!isPromise(inputValue)) {
          warn(`Unexpected type of inputValue! Expected "string", "number" or "Promise", got "${typeof inputValue}"`);
        }
      };
      const renderInputType = {};
      renderInputType.text = renderInputType.email = renderInputType.password = renderInputType.number = renderInputType.tel = renderInputType.url = renderInputType.search = renderInputType.date = renderInputType["datetime-local"] = renderInputType.time = renderInputType.week = renderInputType.month = /** @type {(input: Input | HTMLElement, params: SweetAlertOptions) => Input} */
      (input, params) => {
        const inputElement = (
          /** @type {HTMLInputElement} */
          input
        );
        checkAndSetInputValue(inputElement, params.inputValue);
        setInputLabel(inputElement, inputElement, params);
        setInputPlaceholder(inputElement, params);
        inputElement.type = /** @type {string} */
        params.input;
        return inputElement;
      };
      renderInputType.file = (input, params) => {
        const inputElement = (
          /** @type {HTMLInputElement} */
          input
        );
        setInputLabel(inputElement, inputElement, params);
        setInputPlaceholder(inputElement, params);
        return inputElement;
      };
      renderInputType.range = (range, params) => {
        const rangeContainer = (
          /** @type {HTMLElement} */
          range
        );
        const rangeInput = rangeContainer.querySelector("input");
        const rangeOutput = rangeContainer.querySelector("output");
        if (rangeInput) {
          checkAndSetInputValue(rangeInput, params.inputValue);
          rangeInput.type = /** @type {string} */
          params.input;
          setInputLabel(
            rangeInput,
            /** @type {Input} */
            range,
            params
          );
        }
        if (rangeOutput) {
          checkAndSetInputValue(rangeOutput, params.inputValue);
        }
        return (
          /** @type {Input} */
          range
        );
      };
      renderInputType.select = (select, params) => {
        const selectElement = (
          /** @type {HTMLSelectElement} */
          select
        );
        selectElement.textContent = "";
        if (params.inputPlaceholder) {
          const placeholder = document.createElement("option");
          setInnerHtml(placeholder, params.inputPlaceholder);
          placeholder.value = "";
          placeholder.disabled = true;
          placeholder.selected = true;
          selectElement.appendChild(placeholder);
        }
        setInputLabel(selectElement, selectElement, params);
        return selectElement;
      };
      renderInputType.radio = (radio) => {
        const radioElement = (
          /** @type {HTMLElement} */
          radio
        );
        radioElement.textContent = "";
        return (
          /** @type {Input} */
          radio
        );
      };
      renderInputType.checkbox = (checkboxContainer, params) => {
        const popup = getPopup();
        if (!popup) {
          throw new Error("Popup not found");
        }
        const checkbox = getInput$1(popup, "checkbox");
        if (!checkbox) {
          throw new Error("Checkbox input not found");
        }
        checkbox.value = "1";
        checkbox.checked = Boolean(params.inputValue);
        const containerElement = (
          /** @type {HTMLElement} */
          checkboxContainer
        );
        const label = containerElement.querySelector("span");
        if (label) {
          const placeholderOrLabel = params.inputPlaceholder || params.inputLabel;
          if (placeholderOrLabel) {
            setInnerHtml(label, placeholderOrLabel);
          }
        }
        return checkbox;
      };
      renderInputType.textarea = (textarea, params) => {
        const textareaElement = (
          /** @type {HTMLTextAreaElement} */
          textarea
        );
        checkAndSetInputValue(textareaElement, params.inputValue);
        setInputPlaceholder(textareaElement, params);
        setInputLabel(textareaElement, textareaElement, params);
        const getMargin = (el) => parseInt(window.getComputedStyle(el).marginLeft) + parseInt(window.getComputedStyle(el).marginRight);
        setTimeout(() => {
          if ("MutationObserver" in window) {
            const popup = getPopup();
            if (!popup) {
              return;
            }
            const initialPopupWidth = parseInt(window.getComputedStyle(popup).width);
            const textareaResizeHandler = () => {
              if (!document.body.contains(textareaElement)) {
                return;
              }
              const textareaWidth = textareaElement.offsetWidth + getMargin(textareaElement);
              const popupElement = getPopup();
              if (popupElement) {
                if (textareaWidth > initialPopupWidth) {
                  popupElement.style.width = `${textareaWidth}px`;
                } else {
                  applyNumericalStyle(popupElement, "width", params.width);
                }
              }
            };
            new MutationObserver(textareaResizeHandler).observe(textareaElement, {
              attributes: true,
              attributeFilter: ["style"]
            });
          }
        });
        return textareaElement;
      };
      const renderContent = (instance, params) => {
        const htmlContainer = getHtmlContainer();
        if (!htmlContainer) {
          return;
        }
        showWhenInnerHtmlPresent(htmlContainer);
        applyCustomClass(htmlContainer, params, "htmlContainer");
        if (params.html) {
          parseHtmlToContainer(params.html, htmlContainer);
          show(htmlContainer, "block");
        } else if (params.text) {
          htmlContainer.textContent = params.text;
          show(htmlContainer, "block");
        } else {
          hide2(htmlContainer);
        }
        renderInput(instance, params);
      };
      const renderFooter = (instance, params) => {
        const footer = getFooter();
        if (!footer) {
          return;
        }
        showWhenInnerHtmlPresent(footer);
        toggle(footer, Boolean(params.footer), "block");
        if (params.footer) {
          parseHtmlToContainer(params.footer, footer);
        }
        applyCustomClass(footer, params, "footer");
      };
      const renderIcon = (instance, params) => {
        const innerParams = privateProps.innerParams.get(instance);
        const icon = getIcon();
        if (!icon) {
          return;
        }
        if (innerParams && params.icon === innerParams.icon) {
          setContent(icon, params);
          applyStyles2(icon, params);
          return;
        }
        if (!params.icon && !params.iconHtml) {
          hide2(icon);
          return;
        }
        if (params.icon && Object.keys(iconTypes).indexOf(params.icon) === -1) {
          error(`Unknown icon! Expected "success", "error", "warning", "info" or "question", got "${params.icon}"`);
          hide2(icon);
          return;
        }
        show(icon);
        setContent(icon, params);
        applyStyles2(icon, params);
        addClass(icon, params.showClass && params.showClass.icon);
        const colorSchemeQueryList = window.matchMedia("(prefers-color-scheme: dark)");
        colorSchemeQueryList.addEventListener("change", adjustSuccessIconBackgroundColor);
      };
      const applyStyles2 = (icon, params) => {
        for (const [iconType, iconClassName] of Object.entries(iconTypes)) {
          if (params.icon !== iconType) {
            removeClass(icon, iconClassName);
          }
        }
        addClass(icon, params.icon && iconTypes[params.icon]);
        setColor(icon, params);
        adjustSuccessIconBackgroundColor();
        applyCustomClass(icon, params, "icon");
      };
      const adjustSuccessIconBackgroundColor = () => {
        const popup = getPopup();
        if (!popup) {
          return;
        }
        const popupBackgroundColor = window.getComputedStyle(popup).getPropertyValue("background-color");
        const successIconParts = popup.querySelectorAll("[class^=swal2-success-circular-line], .swal2-success-fix");
        for (let i = 0; i < successIconParts.length; i++) {
          successIconParts[i].style.backgroundColor = popupBackgroundColor;
        }
      };
      const successIconHtml = (params) => `
  ${params.animation ? '<div class="swal2-success-circular-line-left"></div>' : ""}
  <span class="swal2-success-line-tip"></span> <span class="swal2-success-line-long"></span>
  <div class="swal2-success-ring"></div>
  ${params.animation ? '<div class="swal2-success-fix"></div>' : ""}
  ${params.animation ? '<div class="swal2-success-circular-line-right"></div>' : ""}
`;
      const errorIconHtml = `
  <span class="swal2-x-mark">
    <span class="swal2-x-mark-line-left"></span>
    <span class="swal2-x-mark-line-right"></span>
  </span>
`;
      const setContent = (icon, params) => {
        if (!params.icon && !params.iconHtml) {
          return;
        }
        let oldContent = icon.innerHTML;
        let newContent = "";
        if (params.iconHtml) {
          newContent = iconContent(params.iconHtml);
        } else if (params.icon === "success") {
          newContent = successIconHtml(params);
          oldContent = oldContent.replace(/ style=".*?"/g, "");
        } else if (params.icon === "error") {
          newContent = errorIconHtml;
        } else if (params.icon) {
          const defaultIconHtml = {
            question: "?",
            warning: "!",
            info: "i"
          };
          newContent = iconContent(defaultIconHtml[params.icon]);
        }
        if (oldContent.trim() !== newContent.trim()) {
          setInnerHtml(icon, newContent);
        }
      };
      const setColor = (icon, params) => {
        if (!params.iconColor) {
          return;
        }
        icon.style.color = params.iconColor;
        icon.style.borderColor = params.iconColor;
        for (const sel of [".swal2-success-line-tip", ".swal2-success-line-long", ".swal2-x-mark-line-left", ".swal2-x-mark-line-right"]) {
          setStyle(icon, sel, "background-color", params.iconColor);
        }
        setStyle(icon, ".swal2-success-ring", "border-color", params.iconColor);
      };
      const iconContent = (content) => `<div class="${swalClasses["icon-content"]}">${content}</div>`;
      const renderImage = (instance, params) => {
        const image = getImage();
        if (!image) {
          return;
        }
        if (!params.imageUrl) {
          hide2(image);
          return;
        }
        show(image, "");
        image.setAttribute("src", params.imageUrl);
        image.setAttribute("alt", params.imageAlt || "");
        applyNumericalStyle(image, "width", params.imageWidth);
        applyNumericalStyle(image, "height", params.imageHeight);
        image.className = swalClasses.image;
        applyCustomClass(image, params, "image");
      };
      let dragging = false;
      let mousedownX = 0;
      let mousedownY = 0;
      let initialX = 0;
      let initialY = 0;
      const addDraggableListeners = (popup) => {
        popup.addEventListener("mousedown", down);
        document.body.addEventListener("mousemove", move);
        popup.addEventListener("mouseup", up);
        popup.addEventListener("touchstart", down);
        document.body.addEventListener("touchmove", move);
        popup.addEventListener("touchend", up);
      };
      const removeDraggableListeners = (popup) => {
        popup.removeEventListener("mousedown", down);
        document.body.removeEventListener("mousemove", move);
        popup.removeEventListener("mouseup", up);
        popup.removeEventListener("touchstart", down);
        document.body.removeEventListener("touchmove", move);
        popup.removeEventListener("touchend", up);
      };
      const down = (event) => {
        const popup = getPopup();
        if (!popup) {
          return;
        }
        const icon = getIcon();
        if (event.target === popup || icon && icon.contains(
          /** @type {HTMLElement} */
          event.target
        )) {
          dragging = true;
          const clientXY = getClientXY(event);
          mousedownX = clientXY.clientX;
          mousedownY = clientXY.clientY;
          initialX = parseInt(popup.style.insetInlineStart) || 0;
          initialY = parseInt(popup.style.insetBlockStart) || 0;
          addClass(popup, "swal2-dragging");
        }
      };
      const move = (event) => {
        const popup = getPopup();
        if (!popup) {
          return;
        }
        if (dragging) {
          let {
            clientX,
            clientY
          } = getClientXY(event);
          const deltaX = clientX - mousedownX;
          popup.style.insetInlineStart = `${initialX + (globalState.isRTL ? -deltaX : deltaX)}px`;
          popup.style.insetBlockStart = `${initialY + (clientY - mousedownY)}px`;
        }
      };
      const up = () => {
        const popup = getPopup();
        dragging = false;
        removeClass(popup, "swal2-dragging");
      };
      const getClientXY = (event) => {
        const source = event.type.startsWith("touch") ? (
          /** @type {TouchEvent} */
          event.touches[0]
        ) : (
          /** @type {MouseEvent} */
          event
        );
        return {
          clientX: source.clientX,
          clientY: source.clientY
        };
      };
      const renderPopup = (instance, params) => {
        const container = getContainer();
        const popup = getPopup();
        if (!container || !popup) {
          return;
        }
        if (params.toast) {
          applyNumericalStyle(container, "width", params.width);
          popup.style.width = "100%";
          const loader = getLoader();
          if (loader) {
            popup.insertBefore(loader, getIcon());
          }
        } else {
          applyNumericalStyle(popup, "width", params.width);
        }
        applyNumericalStyle(popup, "padding", params.padding);
        if (params.color) {
          popup.style.color = params.color;
        }
        if (params.background) {
          popup.style.background = params.background;
        }
        hide2(getValidationMessage());
        addClasses$1(popup, params);
        if (params.draggable && !params.toast) {
          addClass(popup, swalClasses.draggable);
          addDraggableListeners(popup);
        } else {
          removeClass(popup, swalClasses.draggable);
          removeDraggableListeners(popup);
        }
      };
      const addClasses$1 = (popup, params) => {
        const showClass = params.showClass || {};
        popup.className = `${swalClasses.popup} ${isVisible$1(popup) ? showClass.popup : ""}`;
        if (params.toast) {
          addClass([document.documentElement, document.body], swalClasses["toast-shown"]);
          addClass(popup, swalClasses.toast);
        } else {
          addClass(popup, swalClasses.modal);
        }
        applyCustomClass(popup, params, "popup");
        if (typeof params.customClass === "string") {
          addClass(popup, params.customClass);
        }
        if (params.icon) {
          addClass(popup, swalClasses[`icon-${params.icon}`]);
        }
      };
      const renderProgressSteps = (instance, params) => {
        const progressStepsContainer = getProgressSteps();
        if (!progressStepsContainer) {
          return;
        }
        const {
          progressSteps,
          currentProgressStep
        } = params;
        if (!progressSteps || progressSteps.length === 0 || currentProgressStep === void 0) {
          hide2(progressStepsContainer);
          return;
        }
        show(progressStepsContainer);
        progressStepsContainer.textContent = "";
        if (currentProgressStep >= progressSteps.length) {
          warn("Invalid currentProgressStep parameter, it should be less than progressSteps.length (currentProgressStep like JS arrays starts from 0)");
        }
        progressSteps.forEach((step, index) => {
          const stepEl = createStepElement(step);
          progressStepsContainer.appendChild(stepEl);
          if (index === currentProgressStep) {
            addClass(stepEl, swalClasses["active-progress-step"]);
          }
          if (index !== progressSteps.length - 1) {
            const lineEl = createLineElement(params);
            progressStepsContainer.appendChild(lineEl);
          }
        });
      };
      const createStepElement = (step) => {
        const stepEl = document.createElement("li");
        addClass(stepEl, swalClasses["progress-step"]);
        setInnerHtml(stepEl, step);
        return stepEl;
      };
      const createLineElement = (params) => {
        const lineEl = document.createElement("li");
        addClass(lineEl, swalClasses["progress-step-line"]);
        if (params.progressStepsDistance) {
          applyNumericalStyle(lineEl, "width", params.progressStepsDistance);
        }
        return lineEl;
      };
      const renderTitle = (instance, params) => {
        const title = getTitle();
        if (!title) {
          return;
        }
        showWhenInnerHtmlPresent(title);
        toggle(title, Boolean(params.title || params.titleText), "block");
        if (params.title) {
          parseHtmlToContainer(params.title, title);
        }
        if (params.titleText) {
          title.innerText = params.titleText;
        }
        applyCustomClass(title, params, "title");
      };
      const render = (instance, params) => {
        var _globalState$eventEmi;
        renderPopup(instance, params);
        renderContainer(instance, params);
        renderProgressSteps(instance, params);
        renderIcon(instance, params);
        renderImage(instance, params);
        renderTitle(instance, params);
        renderCloseButton(instance, params);
        renderContent(instance, params);
        renderActions(instance, params);
        renderFooter(instance, params);
        const popup = getPopup();
        if (typeof params.didRender === "function" && popup) {
          params.didRender(popup);
        }
        (_globalState$eventEmi = globalState.eventEmitter) === null || _globalState$eventEmi === void 0 || _globalState$eventEmi.emit("didRender", popup);
      };
      const isVisible2 = () => {
        return isVisible$1(getPopup());
      };
      const clickConfirm = () => {
        var _dom$getConfirmButton;
        return (_dom$getConfirmButton = getConfirmButton()) === null || _dom$getConfirmButton === void 0 ? void 0 : _dom$getConfirmButton.click();
      };
      const clickDeny = () => {
        var _dom$getDenyButton;
        return (_dom$getDenyButton = getDenyButton()) === null || _dom$getDenyButton === void 0 ? void 0 : _dom$getDenyButton.click();
      };
      const clickCancel = () => {
        var _dom$getCancelButton;
        return (_dom$getCancelButton = getCancelButton()) === null || _dom$getCancelButton === void 0 ? void 0 : _dom$getCancelButton.click();
      };
      const DismissReason = Object.freeze({
        cancel: "cancel",
        backdrop: "backdrop",
        close: "close",
        esc: "esc",
        timer: "timer"
      });
      const removeKeydownHandler = (globalState2) => {
        if (globalState2.keydownTarget && globalState2.keydownHandlerAdded && globalState2.keydownHandler) {
          const handler = (
            /** @type {EventListenerOrEventListenerObject} */
            /** @type {unknown} */
            globalState2.keydownHandler
          );
          globalState2.keydownTarget.removeEventListener("keydown", handler, {
            capture: globalState2.keydownListenerCapture
          });
          globalState2.keydownHandlerAdded = false;
        }
      };
      const addKeydownHandler = (globalState2, innerParams, dismissWith) => {
        removeKeydownHandler(globalState2);
        if (!innerParams.toast) {
          const handler = (e) => keydownHandler(innerParams, e, dismissWith);
          globalState2.keydownHandler = handler;
          const target = innerParams.keydownListenerCapture ? window : getPopup();
          if (target) {
            globalState2.keydownTarget = target;
            globalState2.keydownListenerCapture = innerParams.keydownListenerCapture;
            const eventHandler = (
              /** @type {EventListenerOrEventListenerObject} */
              /** @type {unknown} */
              handler
            );
            globalState2.keydownTarget.addEventListener("keydown", eventHandler, {
              capture: globalState2.keydownListenerCapture
            });
            globalState2.keydownHandlerAdded = true;
          }
        }
      };
      const setFocus = (index, increment) => {
        var _dom$getPopup;
        const focusableElements = getFocusableElements();
        if (focusableElements.length) {
          index = index + increment;
          if (index === -2) {
            index = focusableElements.length - 1;
          }
          if (index === focusableElements.length) {
            index = 0;
          } else if (index === -1) {
            index = focusableElements.length - 1;
          }
          focusableElements[index].focus();
          if (isFirefox() && focusableElements[index] instanceof HTMLIFrameElement) {
            return false;
          }
          return true;
        }
        (_dom$getPopup = getPopup()) === null || _dom$getPopup === void 0 || _dom$getPopup.focus();
        return true;
      };
      const arrowKeysNextButton = ["ArrowRight", "ArrowDown"];
      const arrowKeysPreviousButton = ["ArrowLeft", "ArrowUp"];
      const keydownHandler = (innerParams, event, dismissWith) => {
        if (!innerParams) {
          return;
        }
        if (event.isComposing || event.keyCode === 229) {
          return;
        }
        if (innerParams.stopKeydownPropagation) {
          event.stopPropagation();
        }
        if (event.key === "Enter") {
          handleEnter(event, innerParams);
        } else if (event.key === "Tab") {
          handleTab(event);
        } else if ([...arrowKeysNextButton, ...arrowKeysPreviousButton].includes(event.key)) {
          handleArrows(event.key);
        } else if (event.key === "Escape") {
          handleEsc(event, innerParams, dismissWith);
        }
      };
      const handleEnter = (event, innerParams) => {
        if (!callIfFunction(innerParams.allowEnterKey)) {
          return;
        }
        const popup = getPopup();
        if (!popup || !innerParams.input) {
          return;
        }
        const input = getInput$1(popup, innerParams.input);
        if (event.target && input && event.target instanceof HTMLElement && event.target.outerHTML === input.outerHTML) {
          if (["textarea", "file"].includes(innerParams.input)) {
            return;
          }
          clickConfirm();
          event.preventDefault();
        }
      };
      const handleTab = (event) => {
        const targetElement = event.target;
        const focusableElements = getFocusableElements();
        let btnIndex = -1;
        for (let i = 0; i < focusableElements.length; i++) {
          if (targetElement === focusableElements[i]) {
            btnIndex = i;
            break;
          }
        }
        let shouldPreventDefault = true;
        if (!event.shiftKey) {
          shouldPreventDefault = setFocus(btnIndex, 1);
        } else {
          shouldPreventDefault = setFocus(btnIndex, -1);
        }
        event.stopPropagation();
        if (shouldPreventDefault) {
          event.preventDefault();
        }
      };
      const handleArrows = (key) => {
        const actions = getActions();
        const confirmButton = getConfirmButton();
        const denyButton = getDenyButton();
        const cancelButton = getCancelButton();
        if (!actions || !confirmButton || !denyButton || !cancelButton) {
          return;
        }
        const buttons = [confirmButton, denyButton, cancelButton];
        if (document.activeElement instanceof HTMLElement && !buttons.includes(document.activeElement)) {
          return;
        }
        const sibling = arrowKeysNextButton.includes(key) ? "nextElementSibling" : "previousElementSibling";
        let buttonToFocus = document.activeElement;
        if (!buttonToFocus) {
          return;
        }
        for (let i = 0; i < actions.children.length; i++) {
          buttonToFocus = buttonToFocus[sibling];
          if (!buttonToFocus) {
            return;
          }
          if (buttonToFocus instanceof HTMLButtonElement && isVisible$1(buttonToFocus)) {
            break;
          }
        }
        if (buttonToFocus instanceof HTMLButtonElement) {
          buttonToFocus.focus();
        }
      };
      const handleEsc = (event, innerParams, dismissWith) => {
        event.preventDefault();
        if (callIfFunction(innerParams.allowEscapeKey)) {
          dismissWith(DismissReason.esc);
        }
      };
      var privateMethods = {
        swalPromiseResolve: /* @__PURE__ */ new WeakMap(),
        swalPromiseReject: /* @__PURE__ */ new WeakMap()
      };
      const setAriaHidden = () => {
        const container = getContainer();
        const bodyChildren = Array.from(document.body.children);
        bodyChildren.forEach((el) => {
          if (el.contains(container)) {
            return;
          }
          if (el.hasAttribute("aria-hidden")) {
            el.setAttribute("data-previous-aria-hidden", el.getAttribute("aria-hidden") || "");
          }
          el.setAttribute("aria-hidden", "true");
        });
      };
      const unsetAriaHidden = () => {
        const bodyChildren = Array.from(document.body.children);
        bodyChildren.forEach((el) => {
          if (el.hasAttribute("data-previous-aria-hidden")) {
            el.setAttribute("aria-hidden", el.getAttribute("data-previous-aria-hidden") || "");
            el.removeAttribute("data-previous-aria-hidden");
          } else {
            el.removeAttribute("aria-hidden");
          }
        });
      };
      const isSafariOrIOS = typeof window !== "undefined" && Boolean(window.GestureEvent);
      const isIOS = isSafariOrIOS && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const iOSfix = () => {
        if (isSafariOrIOS && !hasClass(document.body, swalClasses.iosfix)) {
          const offset2 = document.body.scrollTop;
          document.body.style.top = `${offset2 * -1}px`;
          addClass(document.body, swalClasses.iosfix);
          lockBodyScroll();
        }
      };
      const lockBodyScroll = () => {
        const container = getContainer();
        if (!container) {
          return;
        }
        let preventTouchMove;
        container.ontouchstart = (event) => {
          preventTouchMove = shouldPreventTouchMove(event);
        };
        container.ontouchmove = (event) => {
          if (preventTouchMove) {
            event.preventDefault();
            event.stopPropagation();
          }
        };
      };
      const shouldPreventTouchMove = (event) => {
        const target = event.target;
        const container = getContainer();
        const htmlContainer = getHtmlContainer();
        if (!container || !htmlContainer) {
          return false;
        }
        if (isStylus(event) || isZoom(event)) {
          return false;
        }
        if (target === container) {
          return true;
        }
        if (!isScrollable(container) && target instanceof HTMLElement && !selfOrParentIsScrollable(target, htmlContainer) && // #2823
        target.tagName !== "INPUT" && // #1603
        target.tagName !== "TEXTAREA" && // #2266
        !(isScrollable(htmlContainer) && // #1944
        htmlContainer.contains(target))) {
          return true;
        }
        return false;
      };
      const isStylus = (event) => {
        return Boolean(event.touches && event.touches.length && // @ts-ignore - touchType is not a standard property
        event.touches[0].touchType === "stylus");
      };
      const isZoom = (event) => {
        return event.touches && event.touches.length > 1;
      };
      const undoIOSfix = () => {
        if (hasClass(document.body, swalClasses.iosfix)) {
          const offset2 = parseInt(document.body.style.top, 10);
          removeClass(document.body, swalClasses.iosfix);
          document.body.style.top = "";
          document.body.scrollTop = offset2 * -1;
        }
      };
      const measureScrollbar = () => {
        const scrollDiv = document.createElement("div");
        scrollDiv.className = swalClasses["scrollbar-measure"];
        document.body.appendChild(scrollDiv);
        const scrollbarWidth = scrollDiv.getBoundingClientRect().width - scrollDiv.clientWidth;
        document.body.removeChild(scrollDiv);
        return scrollbarWidth;
      };
      let previousBodyPadding = null;
      const replaceScrollbarWithPadding = (initialBodyOverflow) => {
        if (previousBodyPadding !== null) {
          return;
        }
        if (document.body.scrollHeight > window.innerHeight || initialBodyOverflow === "scroll") {
          previousBodyPadding = parseInt(window.getComputedStyle(document.body).getPropertyValue("padding-right"));
          document.body.style.paddingRight = `${previousBodyPadding + measureScrollbar()}px`;
        }
      };
      const undoReplaceScrollbarWithPadding = () => {
        if (previousBodyPadding !== null) {
          document.body.style.paddingRight = `${previousBodyPadding}px`;
          previousBodyPadding = null;
        }
      };
      function removePopupAndResetState(instance, container, returnFocus, didClose) {
        if (isToast()) {
          triggerDidCloseAndDispose(instance, didClose);
        } else {
          restoreActiveElement(returnFocus).then(() => triggerDidCloseAndDispose(instance, didClose));
          removeKeydownHandler(globalState);
        }
        if (isSafariOrIOS) {
          container.setAttribute("style", "display:none !important");
          container.removeAttribute("class");
          container.innerHTML = "";
        } else {
          container.remove();
        }
        if (isModal()) {
          undoReplaceScrollbarWithPadding();
          undoIOSfix();
          unsetAriaHidden();
        }
        removeBodyClasses();
      }
      function removeBodyClasses() {
        removeClass([document.documentElement, document.body], [swalClasses.shown, swalClasses["height-auto"], swalClasses["no-backdrop"], swalClasses["toast-shown"]]);
      }
      function close(resolveValue) {
        resolveValue = prepareResolveValue(resolveValue);
        const swalPromiseResolve = privateMethods.swalPromiseResolve.get(this);
        const didClose = triggerClosePopup(this);
        if (this.isAwaitingPromise) {
          if (!resolveValue.isDismissed) {
            handleAwaitingPromise(this);
            swalPromiseResolve(resolveValue);
          }
        } else if (didClose) {
          swalPromiseResolve(resolveValue);
        }
      }
      const triggerClosePopup = (instance) => {
        const popup = getPopup();
        if (!popup) {
          return false;
        }
        const innerParams = privateProps.innerParams.get(instance);
        if (!innerParams || hasClass(popup, innerParams.hideClass.popup)) {
          return false;
        }
        removeClass(popup, innerParams.showClass.popup);
        addClass(popup, innerParams.hideClass.popup);
        const backdrop = getContainer();
        removeClass(backdrop, innerParams.showClass.backdrop);
        addClass(backdrop, innerParams.hideClass.backdrop);
        handlePopupAnimation(instance, popup, innerParams);
        return true;
      };
      function rejectPromise(error2) {
        const rejectPromise2 = privateMethods.swalPromiseReject.get(this);
        handleAwaitingPromise(this);
        if (rejectPromise2) {
          rejectPromise2(error2);
        }
      }
      const handleAwaitingPromise = (instance) => {
        if (instance.isAwaitingPromise) {
          delete instance.isAwaitingPromise;
          if (!privateProps.innerParams.get(instance)) {
            instance._destroy();
          }
        }
      };
      const prepareResolveValue = (resolveValue) => {
        if (typeof resolveValue === "undefined") {
          return {
            isConfirmed: false,
            isDenied: false,
            isDismissed: true
          };
        }
        return Object.assign({
          isConfirmed: false,
          isDenied: false,
          isDismissed: false
        }, resolveValue);
      };
      const handlePopupAnimation = (instance, popup, innerParams) => {
        var _globalState$eventEmi;
        const container = getContainer();
        const animationIsSupported = hasCssAnimation(popup);
        if (typeof innerParams.willClose === "function") {
          innerParams.willClose(popup);
        }
        (_globalState$eventEmi = globalState.eventEmitter) === null || _globalState$eventEmi === void 0 || _globalState$eventEmi.emit("willClose", popup);
        if (animationIsSupported && container) {
          animatePopup(instance, popup, container, Boolean(innerParams.returnFocus), innerParams.didClose);
        } else if (container) {
          removePopupAndResetState(instance, container, Boolean(innerParams.returnFocus), innerParams.didClose);
        }
      };
      const animatePopup = (instance, popup, container, returnFocus, didClose) => {
        globalState.swalCloseEventFinishedCallback = removePopupAndResetState.bind(null, instance, container, returnFocus, didClose);
        const swalCloseAnimationFinished = function(e) {
          if (e.target === popup) {
            var _globalState$swalClos;
            (_globalState$swalClos = globalState.swalCloseEventFinishedCallback) === null || _globalState$swalClos === void 0 || _globalState$swalClos.call(globalState);
            delete globalState.swalCloseEventFinishedCallback;
            popup.removeEventListener("animationend", swalCloseAnimationFinished);
            popup.removeEventListener("transitionend", swalCloseAnimationFinished);
          }
        };
        popup.addEventListener("animationend", swalCloseAnimationFinished);
        popup.addEventListener("transitionend", swalCloseAnimationFinished);
      };
      const triggerDidCloseAndDispose = (instance, didClose) => {
        setTimeout(() => {
          var _globalState$eventEmi2;
          if (typeof didClose === "function") {
            didClose.bind(instance.params)();
          }
          (_globalState$eventEmi2 = globalState.eventEmitter) === null || _globalState$eventEmi2 === void 0 || _globalState$eventEmi2.emit("didClose");
          if (instance._destroy) {
            instance._destroy();
          }
        });
      };
      const showLoading = (buttonToReplace) => {
        let popup = getPopup();
        if (!popup) {
          new Swal2();
        }
        popup = getPopup();
        if (!popup) {
          return;
        }
        const loader = getLoader();
        if (isToast()) {
          hide2(getIcon());
        } else {
          replaceButton(popup, buttonToReplace);
        }
        show(loader);
        popup.setAttribute("data-loading", "true");
        popup.setAttribute("aria-busy", "true");
        popup.focus();
      };
      const replaceButton = (popup, buttonToReplace) => {
        const actions = getActions();
        const loader = getLoader();
        if (!actions || !loader) {
          return;
        }
        if (!buttonToReplace && isVisible$1(getConfirmButton())) {
          buttonToReplace = getConfirmButton();
        }
        show(actions);
        if (buttonToReplace) {
          hide2(buttonToReplace);
          loader.setAttribute("data-button-to-replace", buttonToReplace.className);
          actions.insertBefore(loader, buttonToReplace);
        }
        addClass([popup, actions], swalClasses.loading);
      };
      const handleInputOptionsAndValue = (instance, params) => {
        if (params.input === "select" || params.input === "radio") {
          handleInputOptions(instance, params);
        } else if (["text", "email", "number", "tel", "textarea"].some((i) => i === params.input) && (hasToPromiseFn(params.inputValue) || isPromise(params.inputValue))) {
          showLoading(getConfirmButton());
          handleInputValue(instance, params);
        }
      };
      const getInputValue = (instance, innerParams) => {
        const input = instance.getInput();
        if (!input) {
          return null;
        }
        switch (innerParams.input) {
          case "checkbox":
            return getCheckboxValue(input);
          case "radio":
            return getRadioValue(input);
          case "file":
            return getFileValue(input);
          default:
            return innerParams.inputAutoTrim ? input.value.trim() : input.value;
        }
      };
      const getCheckboxValue = (input) => input.checked ? 1 : 0;
      const getRadioValue = (input) => input.checked ? input.value : null;
      const getFileValue = (input) => input.files && input.files.length ? input.getAttribute("multiple") !== null ? input.files : input.files[0] : null;
      const handleInputOptions = (instance, params) => {
        const popup = getPopup();
        if (!popup) {
          return;
        }
        const processInputOptions = (inputOptions) => {
          if (params.input === "select") {
            populateSelectOptions(popup, formatInputOptions(inputOptions), params);
          } else if (params.input === "radio") {
            populateRadioOptions(popup, formatInputOptions(inputOptions), params);
          }
        };
        if (hasToPromiseFn(params.inputOptions) || isPromise(params.inputOptions)) {
          showLoading(getConfirmButton());
          asPromise(params.inputOptions).then((inputOptions) => {
            instance.hideLoading();
            processInputOptions(inputOptions);
          });
        } else if (typeof params.inputOptions === "object") {
          processInputOptions(params.inputOptions);
        } else {
          error(`Unexpected type of inputOptions! Expected object, Map or Promise, got ${typeof params.inputOptions}`);
        }
      };
      const handleInputValue = (instance, params) => {
        const input = instance.getInput();
        if (!input) {
          return;
        }
        hide2(input);
        asPromise(params.inputValue).then((inputValue) => {
          input.value = params.input === "number" ? `${parseFloat(inputValue) || 0}` : `${inputValue}`;
          show(input);
          input.focus();
          instance.hideLoading();
        }).catch((err) => {
          error(`Error in inputValue promise: ${err}`);
          input.value = "";
          show(input);
          input.focus();
          instance.hideLoading();
        });
      };
      function populateSelectOptions(popup, inputOptions, params) {
        const select = getDirectChildByClass(popup, swalClasses.select);
        if (!select) {
          return;
        }
        const renderOption = (parent, optionLabel, optionValue) => {
          const option2 = document.createElement("option");
          option2.value = optionValue;
          setInnerHtml(option2, optionLabel);
          option2.selected = isSelected(optionValue, params.inputValue);
          parent.appendChild(option2);
        };
        inputOptions.forEach((inputOption) => {
          const optionValue = inputOption[0];
          const optionLabel = inputOption[1];
          if (Array.isArray(optionLabel)) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = optionValue;
            optgroup.disabled = false;
            select.appendChild(optgroup);
            optionLabel.forEach((o) => renderOption(optgroup, o[1], o[0]));
          } else {
            renderOption(select, optionLabel, optionValue);
          }
        });
        select.focus();
      }
      function populateRadioOptions(popup, inputOptions, params) {
        const radio = getDirectChildByClass(popup, swalClasses.radio);
        if (!radio) {
          return;
        }
        inputOptions.forEach((inputOption) => {
          const radioValue = inputOption[0];
          const radioLabel = inputOption[1];
          const radioInput = document.createElement("input");
          const radioLabelElement = document.createElement("label");
          radioInput.type = "radio";
          radioInput.name = swalClasses.radio;
          radioInput.value = radioValue;
          if (isSelected(radioValue, params.inputValue)) {
            radioInput.checked = true;
          }
          const label = document.createElement("span");
          setInnerHtml(label, radioLabel);
          label.className = swalClasses.label;
          radioLabelElement.appendChild(radioInput);
          radioLabelElement.appendChild(label);
          radio.appendChild(radioLabelElement);
        });
        const radios = radio.querySelectorAll("input");
        if (radios.length) {
          radios[0].focus();
        }
      }
      const formatInputOptions = (inputOptions) => {
        const entries = inputOptions instanceof Map ? Array.from(inputOptions) : Object.entries(inputOptions);
        return entries.map(([key, value]) => [key, typeof value === "object" ? formatInputOptions(value) : value]);
      };
      const isSelected = (optionValue, inputValue) => {
        return Boolean(inputValue) && inputValue !== null && inputValue !== void 0 && inputValue.toString() === optionValue.toString();
      };
      const handleConfirmButtonClick = (instance) => {
        const innerParams = privateProps.innerParams.get(instance);
        instance.disableButtons();
        if (innerParams.input) {
          handleConfirmOrDenyWithInput(instance, "confirm");
        } else {
          confirm(instance, true);
        }
      };
      const handleDenyButtonClick = (instance) => {
        const innerParams = privateProps.innerParams.get(instance);
        instance.disableButtons();
        if (innerParams.returnInputValueOnDeny) {
          handleConfirmOrDenyWithInput(instance, "deny");
        } else {
          deny(instance, false);
        }
      };
      const handleCancelButtonClick = (instance, dismissWith) => {
        instance.disableButtons();
        dismissWith(DismissReason.cancel);
      };
      const handleConfirmOrDenyWithInput = (instance, type) => {
        const innerParams = privateProps.innerParams.get(instance);
        if (!innerParams.input) {
          error(`The "input" parameter is needed to be set when using returnInputValueOn${capitalizeFirstLetter(type)}`);
          return;
        }
        const input = instance.getInput();
        const inputValue = getInputValue(instance, innerParams);
        if (innerParams.inputValidator) {
          handleInputValidator(instance, inputValue, type);
        } else if (input && !input.checkValidity()) {
          instance.enableButtons();
          instance.showValidationMessage(innerParams.validationMessage || input.validationMessage);
        } else if (type === "deny") {
          deny(instance, inputValue);
        } else {
          confirm(instance, inputValue);
        }
      };
      const handleInputValidator = (instance, inputValue, type) => {
        const innerParams = privateProps.innerParams.get(instance);
        instance.disableInput();
        const validationPromise = Promise.resolve().then(() => asPromise(innerParams.inputValidator(inputValue, innerParams.validationMessage)));
        validationPromise.then((validationMessage) => {
          instance.enableButtons();
          instance.enableInput();
          if (validationMessage) {
            instance.showValidationMessage(validationMessage);
          } else if (type === "deny") {
            deny(instance, inputValue);
          } else {
            confirm(instance, inputValue);
          }
        });
      };
      const deny = (instance, value) => {
        const innerParams = privateProps.innerParams.get(instance);
        if (innerParams.showLoaderOnDeny) {
          showLoading(getDenyButton());
        }
        if (innerParams.preDeny) {
          instance.isAwaitingPromise = true;
          const preDenyPromise = Promise.resolve().then(() => asPromise(innerParams.preDeny(value, innerParams.validationMessage)));
          preDenyPromise.then((preDenyValue) => {
            if (preDenyValue === false) {
              instance.hideLoading();
              handleAwaitingPromise(instance);
            } else {
              instance.close(
                /** @type SweetAlertResult */
                {
                  isDenied: true,
                  value: typeof preDenyValue === "undefined" ? value : preDenyValue
                }
              );
            }
          }).catch((error2) => rejectWith(instance, error2));
        } else {
          instance.close(
            /** @type SweetAlertResult */
            {
              isDenied: true,
              value
            }
          );
        }
      };
      const succeedWith = (instance, value) => {
        instance.close(
          /** @type SweetAlertResult */
          {
            isConfirmed: true,
            value
          }
        );
      };
      const rejectWith = (instance, error2) => {
        instance.rejectPromise(error2);
      };
      const confirm = (instance, value) => {
        const innerParams = privateProps.innerParams.get(instance);
        if (innerParams.showLoaderOnConfirm) {
          showLoading();
        }
        if (innerParams.preConfirm) {
          instance.resetValidationMessage();
          instance.isAwaitingPromise = true;
          const preConfirmPromise = Promise.resolve().then(() => asPromise(innerParams.preConfirm(value, innerParams.validationMessage)));
          preConfirmPromise.then((preConfirmValue) => {
            if (isVisible$1(getValidationMessage()) || preConfirmValue === false) {
              instance.hideLoading();
              handleAwaitingPromise(instance);
            } else {
              succeedWith(instance, typeof preConfirmValue === "undefined" ? value : preConfirmValue);
            }
          }).catch((error2) => rejectWith(instance, error2));
        } else {
          succeedWith(instance, value);
        }
      };
      function hideLoading() {
        const innerParams = privateProps.innerParams.get(this);
        if (!innerParams) {
          return;
        }
        const domCache = privateProps.domCache.get(this);
        hide2(domCache.loader);
        if (isToast()) {
          if (innerParams.icon) {
            show(getIcon());
          }
        } else {
          showRelatedButton(domCache);
        }
        removeClass([domCache.popup, domCache.actions], swalClasses.loading);
        domCache.popup.removeAttribute("aria-busy");
        domCache.popup.removeAttribute("data-loading");
        domCache.confirmButton.disabled = false;
        domCache.denyButton.disabled = false;
        domCache.cancelButton.disabled = false;
        const focusedElement = privateProps.focusedElement.get(this);
        if (focusedElement instanceof HTMLElement && document.activeElement === document.body) {
          focusedElement.focus();
        }
        privateProps.focusedElement.delete(this);
      }
      const showRelatedButton = (domCache) => {
        const dataButtonToReplace = domCache.loader.getAttribute("data-button-to-replace");
        const buttonToReplace = dataButtonToReplace ? domCache.popup.getElementsByClassName(dataButtonToReplace) : [];
        if (buttonToReplace.length) {
          show(
            /** @type {HTMLElement} */
            buttonToReplace[0],
            "inline-block"
          );
        } else if (allButtonsAreHidden()) {
          hide2(domCache.actions);
        }
      };
      function getInput() {
        const innerParams = privateProps.innerParams.get(this);
        const domCache = privateProps.domCache.get(this);
        if (!domCache) {
          return null;
        }
        return getInput$1(domCache.popup, innerParams.input);
      }
      function setButtonsDisabled(instance, buttons, disabled) {
        const domCache = privateProps.domCache.get(instance);
        buttons.forEach((button) => {
          domCache[button].disabled = disabled;
        });
      }
      function setInputDisabled(input, disabled) {
        const popup = getPopup();
        if (!popup || !input) {
          return;
        }
        if (input.type === "radio") {
          const radios = popup.querySelectorAll(`[name="${swalClasses.radio}"]`);
          for (let i = 0; i < radios.length; i++) {
            radios[i].disabled = disabled;
          }
        } else {
          input.disabled = disabled;
        }
      }
      function enableButtons() {
        setButtonsDisabled(this, ["confirmButton", "denyButton", "cancelButton"], false);
        const focusedElement = privateProps.focusedElement.get(this);
        if (focusedElement instanceof HTMLElement && document.activeElement === document.body) {
          focusedElement.focus();
        }
        privateProps.focusedElement.delete(this);
      }
      function disableButtons() {
        privateProps.focusedElement.set(this, document.activeElement);
        setButtonsDisabled(this, ["confirmButton", "denyButton", "cancelButton"], true);
      }
      function enableInput() {
        setInputDisabled(this.getInput(), false);
      }
      function disableInput() {
        setInputDisabled(this.getInput(), true);
      }
      function showValidationMessage(error2) {
        const domCache = privateProps.domCache.get(this);
        const params = privateProps.innerParams.get(this);
        setInnerHtml(domCache.validationMessage, error2);
        domCache.validationMessage.className = swalClasses["validation-message"];
        if (params.customClass && params.customClass.validationMessage) {
          addClass(domCache.validationMessage, params.customClass.validationMessage);
        }
        show(domCache.validationMessage);
        const input = this.getInput();
        if (input) {
          input.setAttribute("aria-invalid", "true");
          input.setAttribute("aria-describedby", swalClasses["validation-message"]);
          focusInput(input);
          addClass(input, swalClasses.inputerror);
        }
      }
      function resetValidationMessage() {
        const domCache = privateProps.domCache.get(this);
        if (domCache.validationMessage) {
          hide2(domCache.validationMessage);
        }
        const input = this.getInput();
        if (input) {
          input.removeAttribute("aria-invalid");
          input.removeAttribute("aria-describedby");
          removeClass(input, swalClasses.inputerror);
        }
      }
      const defaultParams = {
        title: "",
        titleText: "",
        text: "",
        html: "",
        footer: "",
        icon: void 0,
        iconColor: void 0,
        iconHtml: void 0,
        template: void 0,
        toast: false,
        draggable: false,
        animation: true,
        theme: "light",
        showClass: {
          popup: "swal2-show",
          backdrop: "swal2-backdrop-show",
          icon: "swal2-icon-show"
        },
        hideClass: {
          popup: "swal2-hide",
          backdrop: "swal2-backdrop-hide",
          icon: "swal2-icon-hide"
        },
        customClass: {},
        target: "body",
        color: void 0,
        backdrop: true,
        heightAuto: true,
        allowOutsideClick: true,
        allowEscapeKey: true,
        allowEnterKey: true,
        stopKeydownPropagation: true,
        keydownListenerCapture: false,
        showConfirmButton: true,
        showDenyButton: false,
        showCancelButton: false,
        preConfirm: void 0,
        preDeny: void 0,
        confirmButtonText: "OK",
        confirmButtonAriaLabel: "",
        confirmButtonColor: void 0,
        denyButtonText: "No",
        denyButtonAriaLabel: "",
        denyButtonColor: void 0,
        cancelButtonText: "Cancel",
        cancelButtonAriaLabel: "",
        cancelButtonColor: void 0,
        buttonsStyling: true,
        reverseButtons: false,
        focusConfirm: true,
        focusDeny: false,
        focusCancel: false,
        returnFocus: true,
        showCloseButton: false,
        closeButtonHtml: "&times;",
        closeButtonAriaLabel: "Close this dialog",
        loaderHtml: "",
        showLoaderOnConfirm: false,
        showLoaderOnDeny: false,
        imageUrl: void 0,
        imageWidth: void 0,
        imageHeight: void 0,
        imageAlt: "",
        timer: void 0,
        timerProgressBar: false,
        width: void 0,
        padding: void 0,
        background: void 0,
        input: void 0,
        inputPlaceholder: "",
        inputLabel: "",
        inputValue: "",
        inputOptions: {},
        inputAutoFocus: true,
        inputAutoTrim: true,
        inputAttributes: {},
        inputValidator: void 0,
        returnInputValueOnDeny: false,
        validationMessage: void 0,
        grow: false,
        position: "center",
        progressSteps: [],
        currentProgressStep: void 0,
        progressStepsDistance: void 0,
        willOpen: void 0,
        didOpen: void 0,
        didRender: void 0,
        willClose: void 0,
        didClose: void 0,
        didDestroy: void 0,
        scrollbarPadding: true,
        topLayer: false
      };
      const updatableParams = ["allowEscapeKey", "allowOutsideClick", "background", "buttonsStyling", "cancelButtonAriaLabel", "cancelButtonColor", "cancelButtonText", "closeButtonAriaLabel", "closeButtonHtml", "color", "confirmButtonAriaLabel", "confirmButtonColor", "confirmButtonText", "currentProgressStep", "customClass", "denyButtonAriaLabel", "denyButtonColor", "denyButtonText", "didClose", "didDestroy", "draggable", "footer", "hideClass", "html", "icon", "iconColor", "iconHtml", "imageAlt", "imageHeight", "imageUrl", "imageWidth", "preConfirm", "preDeny", "progressSteps", "returnFocus", "reverseButtons", "showCancelButton", "showCloseButton", "showConfirmButton", "showDenyButton", "text", "title", "titleText", "theme", "willClose"];
      const deprecatedParams = {
        allowEnterKey: void 0
      };
      const toastIncompatibleParams = ["allowOutsideClick", "allowEnterKey", "backdrop", "draggable", "focusConfirm", "focusDeny", "focusCancel", "returnFocus", "heightAuto", "keydownListenerCapture"];
      const isValidParameter = (paramName) => {
        return Object.prototype.hasOwnProperty.call(defaultParams, paramName);
      };
      const isUpdatableParameter = (paramName) => {
        return updatableParams.indexOf(paramName) !== -1;
      };
      const isDeprecatedParameter = (paramName) => {
        return deprecatedParams[paramName];
      };
      const checkIfParamIsValid = (param) => {
        if (!isValidParameter(param)) {
          warn(`Unknown parameter "${param}"`);
        }
      };
      const checkIfToastParamIsValid = (param) => {
        if (toastIncompatibleParams.includes(param)) {
          warn(`The parameter "${param}" is incompatible with toasts`);
        }
      };
      const checkIfParamIsDeprecated = (param) => {
        const isDeprecated = isDeprecatedParameter(param);
        if (isDeprecated) {
          warnAboutDeprecation(param, isDeprecated);
        }
      };
      const showWarningsForParams = (params) => {
        if (params.backdrop === false && params.allowOutsideClick) {
          warn('"allowOutsideClick" parameter requires `backdrop` parameter to be set to `true`');
        }
        if (params.theme && !["light", "dark", "auto", "minimal", "borderless", "bootstrap-4", "bootstrap-4-light", "bootstrap-4-dark", "bootstrap-5", "bootstrap-5-light", "bootstrap-5-dark", "material-ui", "material-ui-light", "material-ui-dark", "embed-iframe", "bulma", "bulma-light", "bulma-dark"].includes(params.theme)) {
          warn(`Invalid theme "${params.theme}"`);
        }
        for (const param in params) {
          checkIfParamIsValid(param);
          if (params.toast) {
            checkIfToastParamIsValid(param);
          }
          checkIfParamIsDeprecated(param);
        }
      };
      function update(params) {
        const container = getContainer();
        const popup = getPopup();
        const innerParams = privateProps.innerParams.get(this);
        if (!popup || hasClass(popup, innerParams.hideClass.popup)) {
          warn(`You're trying to update the closed or closing popup, that won't work. Use the update() method in preConfirm parameter or show a new popup.`);
          return;
        }
        const validUpdatableParams = filterValidParams(params);
        const updatedParams = Object.assign({}, innerParams, validUpdatableParams);
        showWarningsForParams(updatedParams);
        if (container) {
          container.dataset["swal2Theme"] = updatedParams.theme;
        }
        render(this, updatedParams);
        privateProps.innerParams.set(this, updatedParams);
        Object.defineProperties(this, {
          params: {
            value: Object.assign({}, this.params, params),
            writable: false,
            enumerable: true
          }
        });
      }
      const filterValidParams = (params) => {
        const validUpdatableParams = {};
        Object.keys(params).forEach((param) => {
          if (isUpdatableParameter(param)) {
            const typedParams = (
              /** @type {Record<string, any>} */
              params
            );
            validUpdatableParams[param] = typedParams[param];
          } else {
            warn(`Invalid parameter to update: ${param}`);
          }
        });
        return validUpdatableParams;
      };
      function _destroy() {
        var _globalState$eventEmi;
        const domCache = privateProps.domCache.get(this);
        const innerParams = privateProps.innerParams.get(this);
        if (!innerParams) {
          disposeWeakMaps(this);
          return;
        }
        if (domCache.popup && globalState.swalCloseEventFinishedCallback) {
          globalState.swalCloseEventFinishedCallback();
          delete globalState.swalCloseEventFinishedCallback;
        }
        if (typeof innerParams.didDestroy === "function") {
          innerParams.didDestroy();
        }
        (_globalState$eventEmi = globalState.eventEmitter) === null || _globalState$eventEmi === void 0 || _globalState$eventEmi.emit("didDestroy");
        disposeSwal(this);
      }
      const disposeSwal = (instance) => {
        disposeWeakMaps(instance);
        delete instance.params;
        delete globalState.keydownHandler;
        delete globalState.keydownTarget;
        delete globalState.currentInstance;
      };
      const disposeWeakMaps = (instance) => {
        if (instance.isAwaitingPromise) {
          unsetWeakMaps(privateProps, instance);
          instance.isAwaitingPromise = true;
        } else {
          unsetWeakMaps(privateMethods, instance);
          unsetWeakMaps(privateProps, instance);
          delete instance.isAwaitingPromise;
          delete instance.disableButtons;
          delete instance.enableButtons;
          delete instance.getInput;
          delete instance.disableInput;
          delete instance.enableInput;
          delete instance.hideLoading;
          delete instance.disableLoading;
          delete instance.showValidationMessage;
          delete instance.resetValidationMessage;
          delete instance.close;
          delete instance.closePopup;
          delete instance.closeModal;
          delete instance.closeToast;
          delete instance.rejectPromise;
          delete instance.update;
          delete instance._destroy;
        }
      };
      const unsetWeakMaps = (obj, instance) => {
        for (const i in obj) {
          obj[i].delete(instance);
        }
      };
      var instanceMethods = /* @__PURE__ */ Object.freeze({
        __proto__: null,
        _destroy,
        close,
        closeModal: close,
        closePopup: close,
        closeToast: close,
        disableButtons,
        disableInput,
        disableLoading: hideLoading,
        enableButtons,
        enableInput,
        getInput,
        handleAwaitingPromise,
        hideLoading,
        rejectPromise,
        resetValidationMessage,
        showValidationMessage,
        update
      });
      const handlePopupClick = (innerParams, domCache, dismissWith) => {
        if (innerParams.toast) {
          handleToastClick(innerParams, domCache, dismissWith);
        } else {
          handleModalMousedown(domCache);
          handleContainerMousedown(domCache);
          handleModalClick(innerParams, domCache, dismissWith);
        }
      };
      const handleToastClick = (innerParams, domCache, dismissWith) => {
        domCache.popup.onclick = () => {
          if (innerParams && (isAnyButtonShown(innerParams) || innerParams.timer || innerParams.input)) {
            return;
          }
          dismissWith(DismissReason.close);
        };
      };
      const isAnyButtonShown = (innerParams) => {
        return Boolean(innerParams.showConfirmButton || innerParams.showDenyButton || innerParams.showCancelButton || innerParams.showCloseButton);
      };
      let ignoreOutsideClick = false;
      const handleModalMousedown = (domCache) => {
        domCache.popup.onmousedown = () => {
          domCache.container.onmouseup = function(e) {
            domCache.container.onmouseup = () => {
            };
            if (e.target === domCache.container) {
              ignoreOutsideClick = true;
            }
          };
        };
      };
      const handleContainerMousedown = (domCache) => {
        domCache.container.onmousedown = (e) => {
          if (e.target === domCache.container) {
            e.preventDefault();
          }
          domCache.popup.onmouseup = function(e2) {
            domCache.popup.onmouseup = () => {
            };
            if (e2.target === domCache.popup || e2.target instanceof HTMLElement && domCache.popup.contains(e2.target)) {
              ignoreOutsideClick = true;
            }
          };
        };
      };
      const handleModalClick = (innerParams, domCache, dismissWith) => {
        domCache.container.onclick = (e) => {
          if (ignoreOutsideClick) {
            ignoreOutsideClick = false;
            return;
          }
          if (e.target === domCache.container && callIfFunction(innerParams.allowOutsideClick)) {
            dismissWith(DismissReason.backdrop);
          }
        };
      };
      const isJqueryElement = (elem) => typeof elem === "object" && elem !== null && "jquery" in elem;
      const isElement3 = (elem) => elem instanceof Element || isJqueryElement(elem);
      const argsToParams = (args) => {
        const params = {};
        if (typeof args[0] === "object" && !isElement3(args[0])) {
          Object.assign(params, args[0]);
        } else {
          ["title", "html", "icon"].forEach((name, index) => {
            const arg = args[index];
            if (typeof arg === "string" || isElement3(arg)) {
              params[name] = arg;
            } else if (arg !== void 0) {
              error(`Unexpected type of ${name}! Expected "string" or "Element", got ${typeof arg}`);
            }
          });
        }
        return (
          /** @type {SweetAlertOptions} */
          params
        );
      };
      function fire(...args) {
        return new this(...args);
      }
      function mixin(mixinParams) {
        class MixinSwal extends this {
          /**
           * @param {any} params
           * @param {any} priorityMixinParams
           */
          _main(params, priorityMixinParams) {
            return super._main(params, Object.assign({}, mixinParams, priorityMixinParams));
          }
        }
        return MixinSwal;
      }
      const getTimerLeft = () => {
        return globalState.timeout && globalState.timeout.getTimerLeft();
      };
      const stopTimer = () => {
        if (globalState.timeout) {
          stopTimerProgressBar();
          return globalState.timeout.stop();
        }
      };
      const resumeTimer = () => {
        if (globalState.timeout) {
          const remaining = globalState.timeout.start();
          animateTimerProgressBar(remaining);
          return remaining;
        }
      };
      const toggleTimer = () => {
        const timer = globalState.timeout;
        return timer && (timer.running ? stopTimer() : resumeTimer());
      };
      const increaseTimer = (ms) => {
        if (globalState.timeout) {
          const remaining = globalState.timeout.increase(ms);
          animateTimerProgressBar(remaining, true);
          return remaining;
        }
      };
      const isTimerRunning = () => {
        return Boolean(globalState.timeout && globalState.timeout.isRunning());
      };
      let bodyClickListenerAdded = false;
      const clickHandlers = {};
      function bindClickHandler(attr = "data-swal-template") {
        clickHandlers[attr] = this;
        if (!bodyClickListenerAdded) {
          document.body.addEventListener("click", bodyClickListener);
          bodyClickListenerAdded = true;
        }
      }
      const bodyClickListener = (event) => {
        for (let el = (
          /** @type {any} */
          event.target
        ); el && el !== document; el = el.parentNode) {
          for (const attr in clickHandlers) {
            const template = el.getAttribute && el.getAttribute(attr);
            if (template) {
              clickHandlers[attr].fire({
                template
              });
              return;
            }
          }
        }
      };
      class EventEmitter {
        constructor() {
          this.events = {};
        }
        /**
         * @param {string} eventName
         * @returns {EventHandlers}
         */
        _getHandlersByEventName(eventName) {
          if (typeof this.events[eventName] === "undefined") {
            this.events[eventName] = [];
          }
          return this.events[eventName];
        }
        /**
         * @param {string} eventName
         * @param {EventHandler} eventHandler
         */
        on(eventName, eventHandler) {
          const currentHandlers = this._getHandlersByEventName(eventName);
          if (!currentHandlers.includes(eventHandler)) {
            currentHandlers.push(eventHandler);
          }
        }
        /**
         * @param {string} eventName
         * @param {EventHandler} eventHandler
         */
        once(eventName, eventHandler) {
          const onceFn = (...args) => {
            this.removeListener(eventName, onceFn);
            eventHandler.apply(this, args);
          };
          this.on(eventName, onceFn);
        }
        /**
         * @param {string} eventName
         * @param {...any} args
         */
        emit(eventName, ...args) {
          this._getHandlersByEventName(eventName).forEach(
            /**
             * @param {EventHandler} eventHandler
             */
            (eventHandler) => {
              try {
                eventHandler.apply(this, args);
              } catch (error2) {
                console.error(error2);
              }
            }
          );
        }
        /**
         * @param {string} eventName
         * @param {EventHandler} eventHandler
         */
        removeListener(eventName, eventHandler) {
          const currentHandlers = this._getHandlersByEventName(eventName);
          const index = currentHandlers.indexOf(eventHandler);
          if (index > -1) {
            currentHandlers.splice(index, 1);
          }
        }
        /**
         * @param {string} eventName
         */
        removeAllListeners(eventName) {
          if (this.events[eventName] !== void 0) {
            this.events[eventName].length = 0;
          }
        }
        reset() {
          this.events = {};
        }
      }
      globalState.eventEmitter = new EventEmitter();
      const on = (eventName, eventHandler) => {
        if (globalState.eventEmitter) {
          globalState.eventEmitter.on(eventName, eventHandler);
        }
      };
      const once = (eventName, eventHandler) => {
        if (globalState.eventEmitter) {
          globalState.eventEmitter.once(eventName, eventHandler);
        }
      };
      const off = (eventName, eventHandler) => {
        if (!globalState.eventEmitter) {
          return;
        }
        if (!eventName) {
          globalState.eventEmitter.reset();
          return;
        }
        if (eventHandler) {
          globalState.eventEmitter.removeListener(eventName, eventHandler);
        } else {
          globalState.eventEmitter.removeAllListeners(eventName);
        }
      };
      var staticMethods = /* @__PURE__ */ Object.freeze({
        __proto__: null,
        argsToParams,
        bindClickHandler,
        clickCancel,
        clickConfirm,
        clickDeny,
        enableLoading: showLoading,
        fire,
        getActions,
        getCancelButton,
        getCloseButton,
        getConfirmButton,
        getContainer,
        getDenyButton,
        getFocusableElements,
        getFooter,
        getHtmlContainer,
        getIcon,
        getIconContent,
        getImage,
        getInputLabel,
        getLoader,
        getPopup,
        getProgressSteps,
        getTimerLeft,
        getTimerProgressBar,
        getTitle,
        getValidationMessage,
        increaseTimer,
        isDeprecatedParameter,
        isLoading,
        isTimerRunning,
        isUpdatableParameter,
        isValidParameter,
        isVisible: isVisible2,
        mixin,
        off,
        on,
        once,
        resumeTimer,
        showLoading,
        stopTimer,
        toggleTimer
      });
      class Timer {
        /**
         * @param {() => void} callback
         * @param {number} delay
         */
        constructor(callback, delay) {
          this.callback = callback;
          this.remaining = delay;
          this.running = false;
          this.start();
        }
        /**
         * @returns {number}
         */
        start() {
          if (!this.running) {
            this.running = true;
            this.started = /* @__PURE__ */ new Date();
            this.id = setTimeout(this.callback, this.remaining);
          }
          return this.remaining;
        }
        /**
         * @returns {number}
         */
        stop() {
          if (this.started && this.running) {
            this.running = false;
            clearTimeout(this.id);
            this.remaining -= (/* @__PURE__ */ new Date()).getTime() - this.started.getTime();
          }
          return this.remaining;
        }
        /**
         * @param {number} n
         * @returns {number}
         */
        increase(n) {
          const running = this.running;
          if (running) {
            this.stop();
          }
          this.remaining += n;
          if (running) {
            this.start();
          }
          return this.remaining;
        }
        /**
         * @returns {number}
         */
        getTimerLeft() {
          if (this.running) {
            this.stop();
            this.start();
          }
          return this.remaining;
        }
        /**
         * @returns {boolean}
         */
        isRunning() {
          return this.running;
        }
      }
      const swalStringParams = ["swal-title", "swal-html", "swal-footer"];
      const getTemplateParams = (params) => {
        const template = typeof params.template === "string" ? (
          /** @type {HTMLTemplateElement} */
          document.querySelector(params.template)
        ) : params.template;
        if (!template) {
          return {};
        }
        const templateContent = template.content;
        showWarningsForElements(templateContent);
        const result = Object.assign(getSwalParams(templateContent), getSwalFunctionParams(templateContent), getSwalButtons(templateContent), getSwalImage(templateContent), getSwalIcon(templateContent), getSwalInput(templateContent), getSwalStringParams(templateContent, swalStringParams));
        return result;
      };
      const getSwalParams = (templateContent) => {
        const result = {};
        const swalParams = Array.from(templateContent.querySelectorAll("swal-param"));
        swalParams.forEach((param) => {
          showWarningsForAttributes(param, ["name", "value"]);
          const paramName = (
            /** @type {keyof SweetAlertOptions} */
            param.getAttribute("name")
          );
          const value = param.getAttribute("value");
          if (!paramName || !value) {
            return;
          }
          if (paramName in defaultParams && typeof defaultParams[
            /** @type {keyof typeof defaultParams} */
            paramName
          ] === "boolean") {
            result[paramName] = value !== "false";
          } else if (paramName in defaultParams && typeof defaultParams[
            /** @type {keyof typeof defaultParams} */
            paramName
          ] === "object") {
            result[paramName] = JSON.parse(value);
          } else {
            result[paramName] = value;
          }
        });
        return result;
      };
      const getSwalFunctionParams = (templateContent) => {
        const result = {};
        const swalFunctions = Array.from(templateContent.querySelectorAll("swal-function-param"));
        swalFunctions.forEach((param) => {
          const paramName = (
            /** @type {keyof SweetAlertOptions} */
            param.getAttribute("name")
          );
          const value = param.getAttribute("value");
          if (!paramName || !value) {
            return;
          }
          result[paramName] = new Function(`return ${value}`)();
        });
        return result;
      };
      const getSwalButtons = (templateContent) => {
        const result = {};
        const swalButtons = Array.from(templateContent.querySelectorAll("swal-button"));
        swalButtons.forEach((button) => {
          showWarningsForAttributes(button, ["type", "color", "aria-label"]);
          const type = button.getAttribute("type");
          if (!type || !["confirm", "cancel", "deny"].includes(type)) {
            return;
          }
          result[`${type}ButtonText`] = button.innerHTML;
          result[`show${capitalizeFirstLetter(type)}Button`] = true;
          const color = button.getAttribute("color");
          if (color !== null) {
            result[`${type}ButtonColor`] = color;
          }
          const ariaLabel = button.getAttribute("aria-label");
          if (ariaLabel !== null) {
            result[`${type}ButtonAriaLabel`] = ariaLabel;
          }
        });
        return result;
      };
      const getSwalImage = (templateContent) => {
        const result = {};
        const image = templateContent.querySelector("swal-image");
        if (image) {
          showWarningsForAttributes(image, ["src", "width", "height", "alt"]);
          const src = image.getAttribute("src");
          if (src !== null) result.imageUrl = src || void 0;
          const width = image.getAttribute("width");
          if (width !== null) result.imageWidth = width || void 0;
          const height = image.getAttribute("height");
          if (height !== null) result.imageHeight = height || void 0;
          const alt = image.getAttribute("alt");
          if (alt !== null) result.imageAlt = alt || void 0;
        }
        return result;
      };
      const getSwalIcon = (templateContent) => {
        const result = {};
        const icon = templateContent.querySelector("swal-icon");
        if (icon) {
          showWarningsForAttributes(icon, ["type", "color"]);
          if (icon.hasAttribute("type")) {
            result.icon = icon.getAttribute("type");
          }
          if (icon.hasAttribute("color")) {
            result.iconColor = icon.getAttribute("color");
          }
          result.iconHtml = icon.innerHTML;
        }
        return result;
      };
      const getSwalInput = (templateContent) => {
        const result = {};
        const input = templateContent.querySelector("swal-input");
        if (input) {
          showWarningsForAttributes(input, ["type", "label", "placeholder", "value"]);
          result.input = input.getAttribute("type") || "text";
          if (input.hasAttribute("label")) {
            result.inputLabel = input.getAttribute("label");
          }
          if (input.hasAttribute("placeholder")) {
            result.inputPlaceholder = input.getAttribute("placeholder");
          }
          if (input.hasAttribute("value")) {
            result.inputValue = input.getAttribute("value");
          }
        }
        const inputOptions = Array.from(templateContent.querySelectorAll("swal-input-option"));
        if (inputOptions.length) {
          result.inputOptions = {};
          inputOptions.forEach((option2) => {
            showWarningsForAttributes(option2, ["value"]);
            const optionValue = option2.getAttribute("value");
            if (!optionValue) {
              return;
            }
            const optionName = option2.innerHTML;
            result.inputOptions[optionValue] = optionName;
          });
        }
        return result;
      };
      const getSwalStringParams = (templateContent, paramNames) => {
        const result = {};
        for (const i in paramNames) {
          const paramName = paramNames[i];
          const tag = templateContent.querySelector(paramName);
          if (tag) {
            showWarningsForAttributes(tag, []);
            result[paramName.replace(/^swal-/, "")] = tag.innerHTML.trim();
          }
        }
        return result;
      };
      const showWarningsForElements = (templateContent) => {
        const allowedElements = swalStringParams.concat(["swal-param", "swal-function-param", "swal-button", "swal-image", "swal-icon", "swal-input", "swal-input-option"]);
        Array.from(templateContent.children).forEach((el) => {
          const tagName = el.tagName.toLowerCase();
          if (!allowedElements.includes(tagName)) {
            warn(`Unrecognized element <${tagName}>`);
          }
        });
      };
      const showWarningsForAttributes = (el, allowedAttributes) => {
        Array.from(el.attributes).forEach((attribute) => {
          if (allowedAttributes.indexOf(attribute.name) === -1) {
            warn([`Unrecognized attribute "${attribute.name}" on <${el.tagName.toLowerCase()}>.`, `${allowedAttributes.length ? `Allowed attributes are: ${allowedAttributes.join(", ")}` : "To set the value, use HTML within the element."}`]);
          }
        });
      };
      const SHOW_CLASS_TIMEOUT = 10;
      const openPopup = (params) => {
        var _globalState$eventEmi, _globalState$eventEmi2;
        const container = getContainer();
        const popup = getPopup();
        if (!container || !popup) {
          return;
        }
        if (typeof params.willOpen === "function") {
          params.willOpen(popup);
        }
        (_globalState$eventEmi = globalState.eventEmitter) === null || _globalState$eventEmi === void 0 || _globalState$eventEmi.emit("willOpen", popup);
        const bodyStyles = window.getComputedStyle(document.body);
        const initialBodyOverflow = bodyStyles.overflowY;
        addClasses(container, popup, params);
        setTimeout(() => {
          setScrollingVisibility(container, popup);
        }, SHOW_CLASS_TIMEOUT);
        if (isModal()) {
          fixScrollContainer(container, params.scrollbarPadding !== void 0 ? params.scrollbarPadding : false, initialBodyOverflow);
          setAriaHidden();
        }
        if (isIOS && params.backdrop === false && popup.scrollHeight > container.clientHeight) {
          container.style.pointerEvents = "auto";
        }
        if (!isToast() && !globalState.previousActiveElement) {
          globalState.previousActiveElement = document.activeElement;
        }
        if (typeof params.didOpen === "function") {
          const didOpen = params.didOpen;
          setTimeout(() => didOpen(popup));
        }
        (_globalState$eventEmi2 = globalState.eventEmitter) === null || _globalState$eventEmi2 === void 0 || _globalState$eventEmi2.emit("didOpen", popup);
      };
      const swalOpenAnimationFinished = (event) => {
        const popup = getPopup();
        if (!popup || event.target !== popup) {
          return;
        }
        const container = getContainer();
        if (!container) {
          return;
        }
        popup.removeEventListener("animationend", swalOpenAnimationFinished);
        popup.removeEventListener("transitionend", swalOpenAnimationFinished);
        container.style.overflowY = "auto";
        removeClass(container, swalClasses["no-transition"]);
      };
      const setScrollingVisibility = (container, popup) => {
        if (hasCssAnimation(popup)) {
          container.style.overflowY = "hidden";
          popup.addEventListener("animationend", swalOpenAnimationFinished);
          popup.addEventListener("transitionend", swalOpenAnimationFinished);
        } else {
          container.style.overflowY = "auto";
        }
      };
      const fixScrollContainer = (container, scrollbarPadding, initialBodyOverflow) => {
        iOSfix();
        if (scrollbarPadding && initialBodyOverflow !== "hidden") {
          replaceScrollbarWithPadding(initialBodyOverflow);
        }
        setTimeout(() => {
          container.scrollTop = 0;
        });
      };
      const addClasses = (container, popup, params) => {
        var _params$showClass;
        if ((_params$showClass = params.showClass) !== null && _params$showClass !== void 0 && _params$showClass.backdrop) {
          addClass(container, params.showClass.backdrop);
        }
        if (params.animation) {
          popup.style.setProperty("opacity", "0", "important");
          show(popup, "grid");
          setTimeout(() => {
            var _params$showClass2;
            if ((_params$showClass2 = params.showClass) !== null && _params$showClass2 !== void 0 && _params$showClass2.popup) {
              addClass(popup, params.showClass.popup);
            }
            popup.style.removeProperty("opacity");
          }, SHOW_CLASS_TIMEOUT);
        } else {
          show(popup, "grid");
        }
        addClass([document.documentElement, document.body], swalClasses.shown);
        if (params.heightAuto && params.backdrop && !params.toast) {
          addClass([document.documentElement, document.body], swalClasses["height-auto"]);
        }
      };
      var defaultInputValidators = {
        /**
         * @param {string} string
         * @param {string} [validationMessage]
         * @returns {Promise<string | void>}
         */
        email: (string, validationMessage) => {
          return /^[a-zA-Z0-9.+_'-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9-]+$/.test(string) ? Promise.resolve() : Promise.resolve(validationMessage || "Invalid email address");
        },
        /**
         * @param {string} string
         * @param {string} [validationMessage]
         * @returns {Promise<string | void>}
         */
        url: (string, validationMessage) => {
          return /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-z]{2,63}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)$/.test(string) ? Promise.resolve() : Promise.resolve(validationMessage || "Invalid URL");
        }
      };
      function setDefaultInputValidators(params) {
        if (params.inputValidator) {
          return;
        }
        if (params.input === "email") {
          params.inputValidator = defaultInputValidators["email"];
        }
        if (params.input === "url") {
          params.inputValidator = defaultInputValidators["url"];
        }
      }
      function validateCustomTargetElement(params) {
        if (!params.target || typeof params.target === "string" && !document.querySelector(params.target) || typeof params.target !== "string" && !params.target.appendChild) {
          warn('Target parameter is not valid, defaulting to "body"');
          params.target = "body";
        }
      }
      function setParameters(params) {
        setDefaultInputValidators(params);
        if (params.showLoaderOnConfirm && !params.preConfirm) {
          warn("showLoaderOnConfirm is set to true, but preConfirm is not defined.\nshowLoaderOnConfirm should be used together with preConfirm, see usage example:\nhttps://sweetalert2.github.io/#ajax-request");
        }
        validateCustomTargetElement(params);
        if (typeof params.title === "string") {
          params.title = params.title.split("\n").join("<br />");
        }
        init(params);
      }
      let currentInstance;
      var _promise = /* @__PURE__ */ new WeakMap();
      class SweetAlert {
        /**
         * @param {...(SweetAlertOptions | string)} args
         * @this {SweetAlert}
         */
        constructor(...args) {
          _classPrivateFieldInitSpec(
            this,
            _promise,
            /** @type {Promise<SweetAlertResult>} */
            Promise.resolve({
              isConfirmed: false,
              isDenied: false,
              isDismissed: true
            })
          );
          if (typeof window === "undefined") {
            return;
          }
          currentInstance = this;
          const outerParams = Object.freeze(this.constructor.argsToParams(args));
          this.params = outerParams;
          this.isAwaitingPromise = false;
          _classPrivateFieldSet2(_promise, this, this._main(currentInstance.params));
        }
        /**
         * @param {any} userParams
         * @param {any} mixinParams
         */
        _main(userParams, mixinParams = {}) {
          showWarningsForParams(Object.assign({}, mixinParams, userParams));
          if (globalState.currentInstance) {
            const swalPromiseResolve = privateMethods.swalPromiseResolve.get(globalState.currentInstance);
            const {
              isAwaitingPromise
            } = globalState.currentInstance;
            globalState.currentInstance._destroy();
            if (!isAwaitingPromise) {
              swalPromiseResolve({
                isDismissed: true
              });
            }
            if (isModal()) {
              unsetAriaHidden();
            }
          }
          globalState.currentInstance = currentInstance;
          const innerParams = prepareParams(userParams, mixinParams);
          setParameters(innerParams);
          Object.freeze(innerParams);
          if (globalState.timeout) {
            globalState.timeout.stop();
            delete globalState.timeout;
          }
          clearTimeout(globalState.restoreFocusTimeout);
          const domCache = populateDomCache(currentInstance);
          render(currentInstance, innerParams);
          privateProps.innerParams.set(currentInstance, innerParams);
          return swalPromise(currentInstance, domCache, innerParams);
        }
        // `catch` cannot be the name of a module export, so we define our thenable methods here instead
        /**
         * @param {any} onFulfilled
         */
        // oxlint-disable-next-line unicorn/no-thenable
        then(onFulfilled) {
          return _classPrivateFieldGet2(_promise, this).then(onFulfilled);
        }
        /**
         * @param {any} onFinally
         */
        finally(onFinally) {
          return _classPrivateFieldGet2(_promise, this).finally(onFinally);
        }
      }
      const swalPromise = (instance, domCache, innerParams) => {
        return new Promise((resolve, reject) => {
          const dismissWith = (dismiss) => {
            instance.close({
              isDismissed: true,
              dismiss,
              isConfirmed: false,
              isDenied: false
            });
          };
          privateMethods.swalPromiseResolve.set(instance, resolve);
          privateMethods.swalPromiseReject.set(instance, reject);
          domCache.confirmButton.onclick = () => {
            handleConfirmButtonClick(instance);
          };
          domCache.denyButton.onclick = () => {
            handleDenyButtonClick(instance);
          };
          domCache.cancelButton.onclick = () => {
            handleCancelButtonClick(instance, dismissWith);
          };
          domCache.closeButton.onclick = () => {
            dismissWith(DismissReason.close);
          };
          handlePopupClick(innerParams, domCache, dismissWith);
          addKeydownHandler(globalState, innerParams, dismissWith);
          handleInputOptionsAndValue(instance, innerParams);
          openPopup(innerParams);
          setupTimer(globalState, innerParams, dismissWith);
          initFocus(domCache, innerParams);
          setTimeout(() => {
            domCache.container.scrollTop = 0;
          });
        });
      };
      const prepareParams = (userParams, mixinParams) => {
        const templateParams = getTemplateParams(userParams);
        const params = Object.assign({}, defaultParams, mixinParams, templateParams, userParams);
        params.showClass = Object.assign({}, defaultParams.showClass, params.showClass);
        params.hideClass = Object.assign({}, defaultParams.hideClass, params.hideClass);
        if (params.animation === false) {
          params.showClass = {
            backdrop: "swal2-noanimation"
          };
          params.hideClass = {};
        }
        return params;
      };
      const populateDomCache = (instance) => {
        const domCache = (
          /** @type {DomCache} */
          {
            popup: (
              /** @type {HTMLElement} */
              getPopup()
            ),
            container: (
              /** @type {HTMLElement} */
              getContainer()
            ),
            actions: (
              /** @type {HTMLElement} */
              getActions()
            ),
            confirmButton: (
              /** @type {HTMLElement} */
              getConfirmButton()
            ),
            denyButton: (
              /** @type {HTMLElement} */
              getDenyButton()
            ),
            cancelButton: (
              /** @type {HTMLElement} */
              getCancelButton()
            ),
            loader: (
              /** @type {HTMLElement} */
              getLoader()
            ),
            closeButton: (
              /** @type {HTMLElement} */
              getCloseButton()
            ),
            validationMessage: (
              /** @type {HTMLElement} */
              getValidationMessage()
            ),
            progressSteps: (
              /** @type {HTMLElement} */
              getProgressSteps()
            )
          }
        );
        privateProps.domCache.set(instance, domCache);
        return domCache;
      };
      const setupTimer = (globalState2, innerParams, dismissWith) => {
        const timerProgressBar = getTimerProgressBar();
        hide2(timerProgressBar);
        if (innerParams.timer) {
          globalState2.timeout = new Timer(() => {
            dismissWith("timer");
            delete globalState2.timeout;
          }, innerParams.timer);
          if (innerParams.timerProgressBar && timerProgressBar) {
            show(timerProgressBar);
            applyCustomClass(timerProgressBar, innerParams, "timerProgressBar");
            setTimeout(() => {
              if (globalState2.timeout && globalState2.timeout.running) {
                animateTimerProgressBar(
                  /** @type {number} */
                  innerParams.timer
                );
              }
            });
          }
        }
      };
      const initFocus = (domCache, innerParams) => {
        if (innerParams.toast) {
          return;
        }
        if (!callIfFunction(innerParams.allowEnterKey)) {
          warnAboutDeprecation("allowEnterKey", "preConfirm: () => false");
          domCache.popup.focus();
          return;
        }
        if (focusAutofocus(domCache)) {
          return;
        }
        if (focusButton(domCache, innerParams)) {
          return;
        }
        setFocus(-1, 1);
      };
      const focusAutofocus = (domCache) => {
        const autofocusElements = Array.from(domCache.popup.querySelectorAll("[autofocus]"));
        for (const autofocusElement of autofocusElements) {
          if (autofocusElement instanceof HTMLElement && isVisible$1(autofocusElement)) {
            autofocusElement.focus();
            return true;
          }
        }
        return false;
      };
      const focusButton = (domCache, innerParams) => {
        if (innerParams.focusDeny && isVisible$1(domCache.denyButton)) {
          domCache.denyButton.focus();
          return true;
        }
        if (innerParams.focusCancel && isVisible$1(domCache.cancelButton)) {
          domCache.cancelButton.focus();
          return true;
        }
        if (innerParams.focusConfirm && isVisible$1(domCache.confirmButton)) {
          domCache.confirmButton.focus();
          return true;
        }
        return false;
      };
      SweetAlert.prototype.disableButtons = disableButtons;
      SweetAlert.prototype.enableButtons = enableButtons;
      SweetAlert.prototype.getInput = getInput;
      SweetAlert.prototype.disableInput = disableInput;
      SweetAlert.prototype.enableInput = enableInput;
      SweetAlert.prototype.hideLoading = hideLoading;
      SweetAlert.prototype.disableLoading = hideLoading;
      SweetAlert.prototype.showValidationMessage = showValidationMessage;
      SweetAlert.prototype.resetValidationMessage = resetValidationMessage;
      SweetAlert.prototype.close = close;
      SweetAlert.prototype.closePopup = close;
      SweetAlert.prototype.closeModal = close;
      SweetAlert.prototype.closeToast = close;
      SweetAlert.prototype.rejectPromise = rejectPromise;
      SweetAlert.prototype.update = update;
      SweetAlert.prototype._destroy = _destroy;
      Object.assign(SweetAlert, staticMethods);
      Object.keys(instanceMethods).forEach((key) => {
        SweetAlert[key] = function(...args) {
          if (currentInstance && currentInstance[key]) {
            return currentInstance[key](...args);
          }
          return void 0;
        };
      });
      SweetAlert.DismissReason = DismissReason;
      SweetAlert.version = "11.26.24";
      const Swal2 = SweetAlert;
      Swal2.default = Swal2;
      return Swal2;
    }));
    if (typeof exports !== "undefined" && exports.Sweetalert2) {
      exports.swal = exports.sweetAlert = exports.Swal = exports.SweetAlert = exports.Sweetalert2;
    }
    "undefined" != typeof document && (function(e, t) {
      var n = e.createElement("style");
      if (e.getElementsByTagName("head")[0].appendChild(n), n.styleSheet) n.styleSheet.disabled || (n.styleSheet.cssText = t);
      else try {
        n.innerHTML = t;
      } catch (e2) {
        n.innerText = t;
      }
    })(document, ':root{--swal2-outline: 0 0 0 3px rgba(100, 150, 200, 0.5);--swal2-container-padding: 0.625em;--swal2-backdrop: rgba(0, 0, 0, 0.4);--swal2-backdrop-transition: background-color 0.15s;--swal2-width: 32em;--swal2-padding: 0 0 1.25em;--swal2-border: none;--swal2-border-radius: 0.3125rem;--swal2-background: white;--swal2-color: #545454;--swal2-show-animation: swal2-show 0.3s;--swal2-hide-animation: swal2-hide 0.15s forwards;--swal2-icon-zoom: 1;--swal2-icon-animations: true;--swal2-title-padding: 0.8em 1em 0;--swal2-html-container-padding: 1em 1.6em 0.3em;--swal2-input-border: 1px solid #d9d9d9;--swal2-input-border-radius: 0.1875em;--swal2-input-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 3px transparent;--swal2-input-background: transparent;--swal2-input-transition: border-color 0.2s, box-shadow 0.2s;--swal2-input-hover-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 3px transparent;--swal2-input-focus-border: 1px solid #b4dbed;--swal2-input-focus-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 3px rgba(100, 150, 200, 0.5);--swal2-progress-step-background: #add8e6;--swal2-validation-message-background: #f0f0f0;--swal2-validation-message-color: #666;--swal2-footer-border-color: #eee;--swal2-footer-background: transparent;--swal2-footer-color: inherit;--swal2-timer-progress-bar-background: rgba(0, 0, 0, 0.3);--swal2-close-button-position: initial;--swal2-close-button-inset: auto;--swal2-close-button-font-size: 2.5em;--swal2-close-button-color: #ccc;--swal2-close-button-transition: color 0.2s, box-shadow 0.2s;--swal2-close-button-outline: initial;--swal2-close-button-box-shadow: inset 0 0 0 3px transparent;--swal2-close-button-focus-box-shadow: inset var(--swal2-outline);--swal2-close-button-hover-transform: none;--swal2-actions-justify-content: center;--swal2-actions-width: auto;--swal2-actions-margin: 1.25em auto 0;--swal2-actions-padding: 0;--swal2-actions-border-radius: 0;--swal2-actions-background: transparent;--swal2-action-button-transition: background-color 0.2s, box-shadow 0.2s;--swal2-action-button-hover: black 10%;--swal2-action-button-active: black 10%;--swal2-confirm-button-box-shadow: none;--swal2-confirm-button-border-radius: 0.25em;--swal2-confirm-button-background-color: #7066e0;--swal2-confirm-button-color: #fff;--swal2-deny-button-box-shadow: none;--swal2-deny-button-border-radius: 0.25em;--swal2-deny-button-background-color: #dc3741;--swal2-deny-button-color: #fff;--swal2-cancel-button-box-shadow: none;--swal2-cancel-button-border-radius: 0.25em;--swal2-cancel-button-background-color: #6e7881;--swal2-cancel-button-color: #fff;--swal2-toast-show-animation: swal2-toast-show 0.5s;--swal2-toast-hide-animation: swal2-toast-hide 0.1s forwards;--swal2-toast-border: none;--swal2-toast-box-shadow: 0 0 1px hsl(0deg 0% 0% / 0.075), 0 1px 2px hsl(0deg 0% 0% / 0.075), 1px 2px 4px hsl(0deg 0% 0% / 0.075), 1px 3px 8px hsl(0deg 0% 0% / 0.075), 2px 4px 16px hsl(0deg 0% 0% / 0.075)}[data-swal2-theme=dark]{--swal2-dark-theme-black: #19191a;--swal2-dark-theme-white: #e1e1e1;--swal2-background: var(--swal2-dark-theme-black);--swal2-color: var(--swal2-dark-theme-white);--swal2-footer-border-color: #555;--swal2-input-background: color-mix(in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10%);--swal2-validation-message-background: color-mix( in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10% );--swal2-validation-message-color: var(--swal2-dark-theme-white);--swal2-timer-progress-bar-background: rgba(255, 255, 255, 0.7)}@media(prefers-color-scheme: dark){[data-swal2-theme=auto]{--swal2-dark-theme-black: #19191a;--swal2-dark-theme-white: #e1e1e1;--swal2-background: var(--swal2-dark-theme-black);--swal2-color: var(--swal2-dark-theme-white);--swal2-footer-border-color: #555;--swal2-input-background: color-mix(in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10%);--swal2-validation-message-background: color-mix( in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10% );--swal2-validation-message-color: var(--swal2-dark-theme-white);--swal2-timer-progress-bar-background: rgba(255, 255, 255, 0.7)}}body.swal2-shown:not(.swal2-no-backdrop,.swal2-toast-shown){overflow:hidden}body.swal2-height-auto{height:auto !important}body.swal2-no-backdrop .swal2-container{background-color:rgba(0,0,0,0) !important;pointer-events:none}body.swal2-no-backdrop .swal2-container .swal2-popup{pointer-events:auto}body.swal2-no-backdrop .swal2-container .swal2-modal{box-shadow:0 0 10px var(--swal2-backdrop)}body.swal2-toast-shown .swal2-container{box-sizing:border-box;width:360px;max-width:100%;background-color:rgba(0,0,0,0);pointer-events:none}body.swal2-toast-shown .swal2-container.swal2-top{inset:0 auto auto 50%;transform:translateX(-50%)}body.swal2-toast-shown .swal2-container.swal2-top-end,body.swal2-toast-shown .swal2-container.swal2-top-right{inset:0 0 auto auto}body.swal2-toast-shown .swal2-container.swal2-top-start,body.swal2-toast-shown .swal2-container.swal2-top-left{inset:0 auto auto 0}body.swal2-toast-shown .swal2-container.swal2-center-start,body.swal2-toast-shown .swal2-container.swal2-center-left{inset:50% auto auto 0;transform:translateY(-50%)}body.swal2-toast-shown .swal2-container.swal2-center{inset:50% auto auto 50%;transform:translate(-50%, -50%)}body.swal2-toast-shown .swal2-container.swal2-center-end,body.swal2-toast-shown .swal2-container.swal2-center-right{inset:50% 0 auto auto;transform:translateY(-50%)}body.swal2-toast-shown .swal2-container.swal2-bottom-start,body.swal2-toast-shown .swal2-container.swal2-bottom-left{inset:auto auto 0 0}body.swal2-toast-shown .swal2-container.swal2-bottom{inset:auto auto 0 50%;transform:translateX(-50%)}body.swal2-toast-shown .swal2-container.swal2-bottom-end,body.swal2-toast-shown .swal2-container.swal2-bottom-right{inset:auto 0 0 auto}@media print{body.swal2-shown:not(.swal2-no-backdrop,.swal2-toast-shown){overflow-y:scroll !important}body.swal2-shown:not(.swal2-no-backdrop,.swal2-toast-shown)>[aria-hidden=true]{display:none}body.swal2-shown:not(.swal2-no-backdrop,.swal2-toast-shown) .swal2-container{position:static !important}}div:where(.swal2-container){display:grid;position:fixed;z-index:1060;inset:0;box-sizing:border-box;grid-template-areas:"top-start     top            top-end" "center-start  center         center-end" "bottom-start  bottom-center  bottom-end";grid-template-rows:minmax(min-content, auto) minmax(min-content, auto) minmax(min-content, auto);height:100%;padding:var(--swal2-container-padding);overflow-x:hidden;transition:var(--swal2-backdrop-transition);-webkit-overflow-scrolling:touch}div:where(.swal2-container).swal2-backdrop-show,div:where(.swal2-container).swal2-noanimation{background:var(--swal2-backdrop)}div:where(.swal2-container).swal2-backdrop-hide{background:rgba(0,0,0,0) !important}div:where(.swal2-container).swal2-top-start,div:where(.swal2-container).swal2-center-start,div:where(.swal2-container).swal2-bottom-start{grid-template-columns:minmax(0, 1fr) auto auto}div:where(.swal2-container).swal2-top,div:where(.swal2-container).swal2-center,div:where(.swal2-container).swal2-bottom{grid-template-columns:auto minmax(0, 1fr) auto}div:where(.swal2-container).swal2-top-end,div:where(.swal2-container).swal2-center-end,div:where(.swal2-container).swal2-bottom-end{grid-template-columns:auto auto minmax(0, 1fr)}div:where(.swal2-container).swal2-top-start>.swal2-popup{align-self:start}div:where(.swal2-container).swal2-top>.swal2-popup{grid-column:2;place-self:start center}div:where(.swal2-container).swal2-top-end>.swal2-popup,div:where(.swal2-container).swal2-top-right>.swal2-popup{grid-column:3;place-self:start end}div:where(.swal2-container).swal2-center-start>.swal2-popup,div:where(.swal2-container).swal2-center-left>.swal2-popup{grid-row:2;align-self:center}div:where(.swal2-container).swal2-center>.swal2-popup{grid-column:2;grid-row:2;place-self:center center}div:where(.swal2-container).swal2-center-end>.swal2-popup,div:where(.swal2-container).swal2-center-right>.swal2-popup{grid-column:3;grid-row:2;place-self:center end}div:where(.swal2-container).swal2-bottom-start>.swal2-popup,div:where(.swal2-container).swal2-bottom-left>.swal2-popup{grid-column:1;grid-row:3;align-self:end}div:where(.swal2-container).swal2-bottom>.swal2-popup{grid-column:2;grid-row:3;place-self:end center}div:where(.swal2-container).swal2-bottom-end>.swal2-popup,div:where(.swal2-container).swal2-bottom-right>.swal2-popup{grid-column:3;grid-row:3;place-self:end end}div:where(.swal2-container).swal2-grow-row>.swal2-popup,div:where(.swal2-container).swal2-grow-fullscreen>.swal2-popup{grid-column:1/4;width:100%}div:where(.swal2-container).swal2-grow-column>.swal2-popup,div:where(.swal2-container).swal2-grow-fullscreen>.swal2-popup{grid-row:1/4;align-self:stretch}div:where(.swal2-container).swal2-no-transition{transition:none !important}div:where(.swal2-container)[popover]{width:auto;border:0}div:where(.swal2-container) div:where(.swal2-popup){display:none;position:relative;box-sizing:border-box;grid-template-columns:minmax(0, 100%);width:var(--swal2-width);max-width:100%;padding:var(--swal2-padding);border:var(--swal2-border);border-radius:var(--swal2-border-radius);background:var(--swal2-background);color:var(--swal2-color);font-family:inherit;font-size:1rem;container-name:swal2-popup}div:where(.swal2-container) div:where(.swal2-popup):focus{outline:none}div:where(.swal2-container) div:where(.swal2-popup).swal2-loading{overflow-y:hidden}div:where(.swal2-container) div:where(.swal2-popup).swal2-draggable{cursor:grab}div:where(.swal2-container) div:where(.swal2-popup).swal2-draggable div:where(.swal2-icon){cursor:grab}div:where(.swal2-container) div:where(.swal2-popup).swal2-dragging{cursor:grabbing}div:where(.swal2-container) div:where(.swal2-popup).swal2-dragging div:where(.swal2-icon){cursor:grabbing}div:where(.swal2-container) h2:where(.swal2-title){position:relative;max-width:100%;margin:0;padding:var(--swal2-title-padding);color:inherit;font-size:1.875em;font-weight:600;text-align:center;text-transform:none;overflow-wrap:break-word;cursor:initial}div:where(.swal2-container) div:where(.swal2-actions){display:flex;z-index:1;box-sizing:border-box;flex-wrap:wrap;align-items:center;justify-content:var(--swal2-actions-justify-content);width:var(--swal2-actions-width);margin:var(--swal2-actions-margin);padding:var(--swal2-actions-padding);border-radius:var(--swal2-actions-border-radius);background:var(--swal2-actions-background)}div:where(.swal2-container) div:where(.swal2-loader){display:none;align-items:center;justify-content:center;width:2.2em;height:2.2em;margin:0 1.875em;animation:swal2-rotate-loading 1.5s linear 0s infinite normal;border-width:.25em;border-style:solid;border-radius:100%;border-color:#2778c4 rgba(0,0,0,0) #2778c4 rgba(0,0,0,0)}div:where(.swal2-container) button:where(.swal2-styled){margin:.3125em;padding:.625em 1.1em;transition:var(--swal2-action-button-transition);border:none;box-shadow:0 0 0 3px rgba(0,0,0,0);font-weight:500}div:where(.swal2-container) button:where(.swal2-styled):not([disabled]){cursor:pointer}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-confirm){border-radius:var(--swal2-confirm-button-border-radius);background:initial;background-color:var(--swal2-confirm-button-background-color);box-shadow:var(--swal2-confirm-button-box-shadow);color:var(--swal2-confirm-button-color);font-size:1em}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-confirm):hover{background-color:color-mix(in srgb, var(--swal2-confirm-button-background-color), var(--swal2-action-button-hover))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-confirm):active{background-color:color-mix(in srgb, var(--swal2-confirm-button-background-color), var(--swal2-action-button-active))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-deny){border-radius:var(--swal2-deny-button-border-radius);background:initial;background-color:var(--swal2-deny-button-background-color);box-shadow:var(--swal2-deny-button-box-shadow);color:var(--swal2-deny-button-color);font-size:1em}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-deny):hover{background-color:color-mix(in srgb, var(--swal2-deny-button-background-color), var(--swal2-action-button-hover))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-deny):active{background-color:color-mix(in srgb, var(--swal2-deny-button-background-color), var(--swal2-action-button-active))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-cancel){border-radius:var(--swal2-cancel-button-border-radius);background:initial;background-color:var(--swal2-cancel-button-background-color);box-shadow:var(--swal2-cancel-button-box-shadow);color:var(--swal2-cancel-button-color);font-size:1em}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-cancel):hover{background-color:color-mix(in srgb, var(--swal2-cancel-button-background-color), var(--swal2-action-button-hover))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-cancel):active{background-color:color-mix(in srgb, var(--swal2-cancel-button-background-color), var(--swal2-action-button-active))}div:where(.swal2-container) button:where(.swal2-styled):focus-visible{outline:none;box-shadow:var(--swal2-action-button-focus-box-shadow)}div:where(.swal2-container) button:where(.swal2-styled)[disabled]:not(.swal2-loading){opacity:.4}div:where(.swal2-container) button:where(.swal2-styled)::-moz-focus-inner{border:0}div:where(.swal2-container) div:where(.swal2-footer){margin:1em 0 0;padding:1em 1em 0;border-top:1px solid var(--swal2-footer-border-color);background:var(--swal2-footer-background);color:var(--swal2-footer-color);font-size:1em;text-align:center;cursor:initial}div:where(.swal2-container) .swal2-timer-progress-bar-container{position:absolute;right:0;bottom:0;left:0;grid-column:auto !important;overflow:hidden;border-bottom-right-radius:var(--swal2-border-radius);border-bottom-left-radius:var(--swal2-border-radius)}div:where(.swal2-container) div:where(.swal2-timer-progress-bar){width:100%;height:.25em;background:var(--swal2-timer-progress-bar-background)}div:where(.swal2-container) img:where(.swal2-image){max-width:100%;margin:2em auto 1em;cursor:initial}div:where(.swal2-container) button:where(.swal2-close){position:var(--swal2-close-button-position);inset:var(--swal2-close-button-inset);z-index:2;align-items:center;justify-content:center;width:1.2em;height:1.2em;margin-top:0;margin-right:0;margin-bottom:-1.2em;padding:0;overflow:hidden;transition:var(--swal2-close-button-transition);border:none;border-radius:var(--swal2-border-radius);outline:var(--swal2-close-button-outline);background:rgba(0,0,0,0);color:var(--swal2-close-button-color);font-family:monospace;font-size:var(--swal2-close-button-font-size);cursor:pointer;justify-self:end}div:where(.swal2-container) button:where(.swal2-close):hover{transform:var(--swal2-close-button-hover-transform);background:rgba(0,0,0,0);color:#f27474}div:where(.swal2-container) button:where(.swal2-close):focus-visible{outline:none;box-shadow:var(--swal2-close-button-focus-box-shadow)}div:where(.swal2-container) button:where(.swal2-close)::-moz-focus-inner{border:0}div:where(.swal2-container) div:where(.swal2-html-container){z-index:1;justify-content:center;margin:0;padding:var(--swal2-html-container-padding);overflow:auto;color:inherit;font-size:1.125em;font-weight:normal;line-height:normal;text-align:center;overflow-wrap:break-word;word-break:break-word;cursor:initial}div:where(.swal2-container) input:where(.swal2-input),div:where(.swal2-container) input:where(.swal2-file),div:where(.swal2-container) textarea:where(.swal2-textarea),div:where(.swal2-container) select:where(.swal2-select),div:where(.swal2-container) div:where(.swal2-radio),div:where(.swal2-container) label:where(.swal2-checkbox){margin:1em 2em 3px}div:where(.swal2-container) input:where(.swal2-input),div:where(.swal2-container) input:where(.swal2-file),div:where(.swal2-container) textarea:where(.swal2-textarea){box-sizing:border-box;width:auto;transition:var(--swal2-input-transition);border:var(--swal2-input-border);border-radius:var(--swal2-input-border-radius);background:var(--swal2-input-background);box-shadow:var(--swal2-input-box-shadow);color:inherit;font-size:1.125em}div:where(.swal2-container) input:where(.swal2-input).swal2-inputerror,div:where(.swal2-container) input:where(.swal2-file).swal2-inputerror,div:where(.swal2-container) textarea:where(.swal2-textarea).swal2-inputerror{border-color:#f27474 !important;box-shadow:0 0 2px #f27474 !important}div:where(.swal2-container) input:where(.swal2-input):hover,div:where(.swal2-container) input:where(.swal2-file):hover,div:where(.swal2-container) textarea:where(.swal2-textarea):hover{box-shadow:var(--swal2-input-hover-box-shadow)}div:where(.swal2-container) input:where(.swal2-input):focus,div:where(.swal2-container) input:where(.swal2-file):focus,div:where(.swal2-container) textarea:where(.swal2-textarea):focus{border:var(--swal2-input-focus-border);outline:none;box-shadow:var(--swal2-input-focus-box-shadow)}div:where(.swal2-container) input:where(.swal2-input)::placeholder,div:where(.swal2-container) input:where(.swal2-file)::placeholder,div:where(.swal2-container) textarea:where(.swal2-textarea)::placeholder{color:#ccc}div:where(.swal2-container) .swal2-range{margin:1em 2em 3px;background:var(--swal2-background)}div:where(.swal2-container) .swal2-range input{width:80%}div:where(.swal2-container) .swal2-range output{width:20%;color:inherit;font-weight:600;text-align:center}div:where(.swal2-container) .swal2-range input,div:where(.swal2-container) .swal2-range output{height:2.625em;padding:0;font-size:1.125em;line-height:2.625em}div:where(.swal2-container) .swal2-input{height:2.625em;padding:0 .75em}div:where(.swal2-container) .swal2-file{width:75%;margin-right:auto;margin-left:auto;background:var(--swal2-input-background);font-size:1.125em}div:where(.swal2-container) .swal2-textarea{height:6.75em;padding:.75em}div:where(.swal2-container) .swal2-select{min-width:50%;max-width:100%;padding:.375em .625em;background:var(--swal2-input-background);color:inherit;font-size:1.125em}div:where(.swal2-container) .swal2-radio,div:where(.swal2-container) .swal2-checkbox{align-items:center;justify-content:center;background:var(--swal2-background);color:inherit}div:where(.swal2-container) .swal2-radio label,div:where(.swal2-container) .swal2-checkbox label{margin:0 .6em;font-size:1.125em}div:where(.swal2-container) .swal2-radio input,div:where(.swal2-container) .swal2-checkbox input{flex-shrink:0;margin:0 .4em}div:where(.swal2-container) label:where(.swal2-input-label){display:flex;justify-content:center;margin:1em auto 0}div:where(.swal2-container) div:where(.swal2-validation-message){align-items:center;justify-content:center;margin:1em 0 0;padding:.625em;overflow:hidden;background:var(--swal2-validation-message-background);color:var(--swal2-validation-message-color);font-size:1em;font-weight:300}div:where(.swal2-container) div:where(.swal2-validation-message)::before{content:"!";display:inline-block;width:1.5em;min-width:1.5em;height:1.5em;margin:0 .625em;border-radius:50%;background-color:#f27474;color:#fff;font-weight:600;line-height:1.5em;text-align:center}div:where(.swal2-container) .swal2-progress-steps{flex-wrap:wrap;align-items:center;max-width:100%;margin:1.25em auto;padding:0;background:rgba(0,0,0,0);font-weight:600}div:where(.swal2-container) .swal2-progress-steps li{display:inline-block;position:relative}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step{z-index:20;flex-shrink:0;width:2em;height:2em;border-radius:2em;background:#2778c4;color:#fff;line-height:2em;text-align:center}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step.swal2-active-progress-step{background:#2778c4}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step.swal2-active-progress-step~.swal2-progress-step{background:var(--swal2-progress-step-background);color:#fff}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step.swal2-active-progress-step~.swal2-progress-step-line{background:var(--swal2-progress-step-background)}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step-line{z-index:10;flex-shrink:0;width:2.5em;height:.4em;margin:0 -1px;background:#2778c4}div:where(.swal2-icon){position:relative;box-sizing:content-box;justify-content:center;width:5em;height:5em;margin:2.5em auto .6em;zoom:var(--swal2-icon-zoom);border:.25em solid rgba(0,0,0,0);border-radius:50%;border-color:#000;font-family:inherit;line-height:5em;cursor:default;user-select:none}div:where(.swal2-icon) .swal2-icon-content{display:flex;align-items:center;font-size:3.75em}div:where(.swal2-icon).swal2-error{border-color:#f27474;color:#f27474}div:where(.swal2-icon).swal2-error .swal2-x-mark{position:relative;flex-grow:1}div:where(.swal2-icon).swal2-error [class^=swal2-x-mark-line]{display:block;position:absolute;top:2.3125em;width:2.9375em;height:.3125em;border-radius:.125em;background-color:#f27474}div:where(.swal2-icon).swal2-error [class^=swal2-x-mark-line][class$=left]{left:1.0625em;transform:rotate(45deg)}div:where(.swal2-icon).swal2-error [class^=swal2-x-mark-line][class$=right]{right:1em;transform:rotate(-45deg)}@container swal2-popup style(--swal2-icon-animations:true){div:where(.swal2-icon).swal2-error.swal2-icon-show{animation:swal2-animate-error-icon .5s}div:where(.swal2-icon).swal2-error.swal2-icon-show .swal2-x-mark{animation:swal2-animate-error-x-mark .5s}}div:where(.swal2-icon).swal2-warning{border-color:#f8bb86;color:#f8bb86}@container swal2-popup style(--swal2-icon-animations:true){div:where(.swal2-icon).swal2-warning.swal2-icon-show{animation:swal2-animate-error-icon .5s}div:where(.swal2-icon).swal2-warning.swal2-icon-show .swal2-icon-content{animation:swal2-animate-i-mark .5s}}div:where(.swal2-icon).swal2-info{border-color:#3fc3ee;color:#3fc3ee}@container swal2-popup style(--swal2-icon-animations:true){div:where(.swal2-icon).swal2-info.swal2-icon-show{animation:swal2-animate-error-icon .5s}div:where(.swal2-icon).swal2-info.swal2-icon-show .swal2-icon-content{animation:swal2-animate-i-mark .8s}}div:where(.swal2-icon).swal2-question{border-color:#87adbd;color:#87adbd}@container swal2-popup style(--swal2-icon-animations:true){div:where(.swal2-icon).swal2-question.swal2-icon-show{animation:swal2-animate-error-icon .5s}div:where(.swal2-icon).swal2-question.swal2-icon-show .swal2-icon-content{animation:swal2-animate-question-mark .8s}}div:where(.swal2-icon).swal2-success{border-color:#a5dc86;color:#a5dc86}div:where(.swal2-icon).swal2-success [class^=swal2-success-circular-line]{position:absolute;width:3.75em;height:7.5em;border-radius:50%}div:where(.swal2-icon).swal2-success [class^=swal2-success-circular-line][class$=left]{top:-0.4375em;left:-2.0635em;transform:rotate(-45deg);transform-origin:3.75em 3.75em;border-radius:7.5em 0 0 7.5em}div:where(.swal2-icon).swal2-success [class^=swal2-success-circular-line][class$=right]{top:-0.6875em;left:1.875em;transform:rotate(-45deg);transform-origin:0 3.75em;border-radius:0 7.5em 7.5em 0}div:where(.swal2-icon).swal2-success .swal2-success-ring{position:absolute;z-index:2;top:-0.25em;left:-0.25em;box-sizing:content-box;width:100%;height:100%;border:.25em solid rgba(165,220,134,.3);border-radius:50%}div:where(.swal2-icon).swal2-success .swal2-success-fix{position:absolute;z-index:1;top:.5em;left:1.625em;width:.4375em;height:5.625em;transform:rotate(-45deg)}div:where(.swal2-icon).swal2-success [class^=swal2-success-line]{display:block;position:absolute;z-index:2;height:.3125em;border-radius:.125em;background-color:#a5dc86}div:where(.swal2-icon).swal2-success [class^=swal2-success-line][class$=tip]{top:2.875em;left:.8125em;width:1.5625em;transform:rotate(45deg)}div:where(.swal2-icon).swal2-success [class^=swal2-success-line][class$=long]{top:2.375em;right:.5em;width:2.9375em;transform:rotate(-45deg)}@container swal2-popup style(--swal2-icon-animations:true){div:where(.swal2-icon).swal2-success.swal2-icon-show .swal2-success-line-tip{animation:swal2-animate-success-line-tip .75s}div:where(.swal2-icon).swal2-success.swal2-icon-show .swal2-success-line-long{animation:swal2-animate-success-line-long .75s}div:where(.swal2-icon).swal2-success.swal2-icon-show .swal2-success-circular-line-right{animation:swal2-rotate-success-circular-line 4.25s ease-in}}[class^=swal2]{-webkit-tap-highlight-color:rgba(0,0,0,0)}.swal2-show{animation:var(--swal2-show-animation)}.swal2-hide{animation:var(--swal2-hide-animation)}.swal2-noanimation{transition:none}.swal2-scrollbar-measure{position:absolute;top:-9999px;width:50px;height:50px;overflow:scroll}.swal2-rtl .swal2-close{margin-right:initial;margin-left:0}.swal2-rtl .swal2-timer-progress-bar{right:0;left:auto}.swal2-toast{box-sizing:border-box;grid-column:1/4 !important;grid-row:1/4 !important;grid-template-columns:min-content auto min-content;padding:1em;overflow-y:hidden;border:var(--swal2-toast-border);background:var(--swal2-background);box-shadow:var(--swal2-toast-box-shadow);pointer-events:auto}.swal2-toast>*{grid-column:2}.swal2-toast h2:where(.swal2-title){margin:.5em 1em;padding:0;font-size:1em;text-align:initial}.swal2-toast .swal2-loading{justify-content:center}.swal2-toast input:where(.swal2-input){height:2em;margin:.5em;font-size:1em}.swal2-toast .swal2-validation-message{font-size:1em}.swal2-toast div:where(.swal2-footer){margin:.5em 0 0;padding:.5em 0 0;font-size:.8em}.swal2-toast button:where(.swal2-close){grid-column:3/3;grid-row:1/99;align-self:center;width:.8em;height:.8em;margin:0;font-size:2em}.swal2-toast div:where(.swal2-html-container){margin:.5em 1em;padding:0;overflow:initial;font-size:1em;text-align:initial}.swal2-toast div:where(.swal2-html-container):empty{padding:0}.swal2-toast .swal2-loader{grid-column:1;grid-row:1/99;align-self:center;width:2em;height:2em;margin:.25em}.swal2-toast .swal2-icon{grid-column:1;grid-row:1/99;align-self:center;width:2em;min-width:2em;height:2em;margin:0 .5em 0 0}.swal2-toast .swal2-icon .swal2-icon-content{display:flex;align-items:center;font-size:1.8em;font-weight:bold}.swal2-toast .swal2-icon.swal2-success .swal2-success-ring{width:2em;height:2em}.swal2-toast .swal2-icon.swal2-error [class^=swal2-x-mark-line]{top:.875em;width:1.375em}.swal2-toast .swal2-icon.swal2-error [class^=swal2-x-mark-line][class$=left]{left:.3125em}.swal2-toast .swal2-icon.swal2-error [class^=swal2-x-mark-line][class$=right]{right:.3125em}.swal2-toast div:where(.swal2-actions){justify-content:flex-start;height:auto;margin:0;margin-top:.5em;padding:0 .5em}.swal2-toast button:where(.swal2-styled){margin:.25em .5em;padding:.4em .6em;font-size:1em}.swal2-toast .swal2-success{border-color:#a5dc86}.swal2-toast .swal2-success [class^=swal2-success-circular-line]{position:absolute;width:1.6em;height:3em;border-radius:50%}.swal2-toast .swal2-success [class^=swal2-success-circular-line][class$=left]{top:-0.8em;left:-0.5em;transform:rotate(-45deg);transform-origin:2em 2em;border-radius:4em 0 0 4em}.swal2-toast .swal2-success [class^=swal2-success-circular-line][class$=right]{top:-0.25em;left:.9375em;transform-origin:0 1.5em;border-radius:0 4em 4em 0}.swal2-toast .swal2-success .swal2-success-ring{width:2em;height:2em}.swal2-toast .swal2-success .swal2-success-fix{top:0;left:.4375em;width:.4375em;height:2.6875em}.swal2-toast .swal2-success [class^=swal2-success-line]{height:.3125em}.swal2-toast .swal2-success [class^=swal2-success-line][class$=tip]{top:1.125em;left:.1875em;width:.75em}.swal2-toast .swal2-success [class^=swal2-success-line][class$=long]{top:.9375em;right:.1875em;width:1.375em}@container swal2-popup style(--swal2-icon-animations:true){.swal2-toast .swal2-success.swal2-icon-show .swal2-success-line-tip{animation:swal2-toast-animate-success-line-tip .75s}.swal2-toast .swal2-success.swal2-icon-show .swal2-success-line-long{animation:swal2-toast-animate-success-line-long .75s}}.swal2-toast.swal2-show{animation:var(--swal2-toast-show-animation)}.swal2-toast.swal2-hide{animation:var(--swal2-toast-hide-animation)}@keyframes swal2-show{0%{transform:translate3d(0, -50px, 0) scale(0.9);opacity:0}100%{transform:translate3d(0, 0, 0) scale(1);opacity:1}}@keyframes swal2-hide{0%{transform:translate3d(0, 0, 0) scale(1);opacity:1}100%{transform:translate3d(0, -50px, 0) scale(0.9);opacity:0}}@keyframes swal2-animate-success-line-tip{0%{top:1.1875em;left:.0625em;width:0}54%{top:1.0625em;left:.125em;width:0}70%{top:2.1875em;left:-0.375em;width:3.125em}84%{top:3em;left:1.3125em;width:1.0625em}100%{top:2.8125em;left:.8125em;width:1.5625em}}@keyframes swal2-animate-success-line-long{0%{top:3.375em;right:2.875em;width:0}65%{top:3.375em;right:2.875em;width:0}84%{top:2.1875em;right:0;width:3.4375em}100%{top:2.375em;right:.5em;width:2.9375em}}@keyframes swal2-rotate-success-circular-line{0%{transform:rotate(-45deg)}5%{transform:rotate(-45deg)}12%{transform:rotate(-405deg)}100%{transform:rotate(-405deg)}}@keyframes swal2-animate-error-x-mark{0%{margin-top:1.625em;transform:scale(0.4);opacity:0}50%{margin-top:1.625em;transform:scale(0.4);opacity:0}80%{margin-top:-0.375em;transform:scale(1.15)}100%{margin-top:0;transform:scale(1);opacity:1}}@keyframes swal2-animate-error-icon{0%{transform:rotateX(100deg);opacity:0}100%{transform:rotateX(0deg);opacity:1}}@keyframes swal2-rotate-loading{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes swal2-animate-question-mark{0%{transform:rotateY(-360deg)}100%{transform:rotateY(0)}}@keyframes swal2-animate-i-mark{0%{transform:rotateZ(45deg);opacity:0}25%{transform:rotateZ(-25deg);opacity:.4}50%{transform:rotateZ(15deg);opacity:.8}75%{transform:rotateZ(-5deg);opacity:1}100%{transform:rotateX(0);opacity:1}}@keyframes swal2-toast-show{0%{transform:translateY(-0.625em) rotateZ(2deg)}33%{transform:translateY(0) rotateZ(-2deg)}66%{transform:translateY(0.3125em) rotateZ(2deg)}100%{transform:translateY(0) rotateZ(0deg)}}@keyframes swal2-toast-hide{100%{transform:rotateZ(1deg);opacity:0}}@keyframes swal2-toast-animate-success-line-tip{0%{top:.5625em;left:.0625em;width:0}54%{top:.125em;left:.125em;width:0}70%{top:.625em;left:-0.25em;width:1.625em}84%{top:1.0625em;left:.75em;width:.5em}100%{top:1.125em;left:.1875em;width:.75em}}@keyframes swal2-toast-animate-success-line-long{0%{top:1.625em;right:1.375em;width:0}65%{top:1.25em;right:.9375em;width:0}84%{top:.9375em;right:0;width:1.125em}100%{top:.9375em;right:.1875em;width:1.375em}}');
  }
});

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/index.js
var lib_exports = {};
__export(lib_exports, {
  afterMain: () => afterMain,
  afterRead: () => afterRead,
  afterWrite: () => afterWrite,
  applyStyles: () => applyStyles_default,
  arrow: () => arrow_default,
  auto: () => auto,
  basePlacements: () => basePlacements,
  beforeMain: () => beforeMain,
  beforeRead: () => beforeRead,
  beforeWrite: () => beforeWrite,
  bottom: () => bottom,
  clippingParents: () => clippingParents,
  computeStyles: () => computeStyles_default,
  createPopper: () => createPopper3,
  createPopperBase: () => createPopper,
  createPopperLite: () => createPopper2,
  detectOverflow: () => detectOverflow,
  end: () => end,
  eventListeners: () => eventListeners_default,
  flip: () => flip_default,
  hide: () => hide_default,
  left: () => left,
  main: () => main,
  modifierPhases: () => modifierPhases,
  offset: () => offset_default,
  placements: () => placements,
  popper: () => popper,
  popperGenerator: () => popperGenerator,
  popperOffsets: () => popperOffsets_default,
  preventOverflow: () => preventOverflow_default,
  read: () => read,
  reference: () => reference,
  right: () => right,
  start: () => start,
  top: () => top,
  variationPlacements: () => variationPlacements,
  viewport: () => viewport,
  write: () => write
});

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/enums.js
var top = "top";
var bottom = "bottom";
var right = "right";
var left = "left";
var auto = "auto";
var basePlacements = [top, bottom, right, left];
var start = "start";
var end = "end";
var clippingParents = "clippingParents";
var viewport = "viewport";
var popper = "popper";
var reference = "reference";
var variationPlacements = /* @__PURE__ */ basePlacements.reduce(function(acc, placement) {
  return acc.concat([placement + "-" + start, placement + "-" + end]);
}, []);
var placements = /* @__PURE__ */ [].concat(basePlacements, [auto]).reduce(function(acc, placement) {
  return acc.concat([placement, placement + "-" + start, placement + "-" + end]);
}, []);
var beforeRead = "beforeRead";
var read = "read";
var afterRead = "afterRead";
var beforeMain = "beforeMain";
var main = "main";
var afterMain = "afterMain";
var beforeWrite = "beforeWrite";
var write = "write";
var afterWrite = "afterWrite";
var modifierPhases = [beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite];

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getNodeName.js
function getNodeName(element) {
  return element ? (element.nodeName || "").toLowerCase() : null;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getWindow.js
function getWindow(node) {
  if (node == null) {
    return window;
  }
  if (node.toString() !== "[object Window]") {
    var ownerDocument = node.ownerDocument;
    return ownerDocument ? ownerDocument.defaultView || window : window;
  }
  return node;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/instanceOf.js
function isElement(node) {
  var OwnElement = getWindow(node).Element;
  return node instanceof OwnElement || node instanceof Element;
}
function isHTMLElement(node) {
  var OwnElement = getWindow(node).HTMLElement;
  return node instanceof OwnElement || node instanceof HTMLElement;
}
function isShadowRoot(node) {
  if (typeof ShadowRoot === "undefined") {
    return false;
  }
  var OwnElement = getWindow(node).ShadowRoot;
  return node instanceof OwnElement || node instanceof ShadowRoot;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/modifiers/applyStyles.js
function applyStyles(_ref) {
  var state = _ref.state;
  Object.keys(state.elements).forEach(function(name) {
    var style = state.styles[name] || {};
    var attributes = state.attributes[name] || {};
    var element = state.elements[name];
    if (!isHTMLElement(element) || !getNodeName(element)) {
      return;
    }
    Object.assign(element.style, style);
    Object.keys(attributes).forEach(function(name2) {
      var value = attributes[name2];
      if (value === false) {
        element.removeAttribute(name2);
      } else {
        element.setAttribute(name2, value === true ? "" : value);
      }
    });
  });
}
function effect(_ref2) {
  var state = _ref2.state;
  var initialStyles = {
    popper: {
      position: state.options.strategy,
      left: "0",
      top: "0",
      margin: "0"
    },
    arrow: {
      position: "absolute"
    },
    reference: {}
  };
  Object.assign(state.elements.popper.style, initialStyles.popper);
  state.styles = initialStyles;
  if (state.elements.arrow) {
    Object.assign(state.elements.arrow.style, initialStyles.arrow);
  }
  return function() {
    Object.keys(state.elements).forEach(function(name) {
      var element = state.elements[name];
      var attributes = state.attributes[name] || {};
      var styleProperties = Object.keys(state.styles.hasOwnProperty(name) ? state.styles[name] : initialStyles[name]);
      var style = styleProperties.reduce(function(style2, property) {
        style2[property] = "";
        return style2;
      }, {});
      if (!isHTMLElement(element) || !getNodeName(element)) {
        return;
      }
      Object.assign(element.style, style);
      Object.keys(attributes).forEach(function(attribute) {
        element.removeAttribute(attribute);
      });
    });
  };
}
var applyStyles_default = {
  name: "applyStyles",
  enabled: true,
  phase: "write",
  fn: applyStyles,
  effect,
  requires: ["computeStyles"]
};

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/getBasePlacement.js
function getBasePlacement(placement) {
  return placement.split("-")[0];
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/math.js
var max = Math.max;
var min = Math.min;
var round = Math.round;

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/userAgent.js
function getUAString() {
  var uaData = navigator.userAgentData;
  if (uaData != null && uaData.brands && Array.isArray(uaData.brands)) {
    return uaData.brands.map(function(item) {
      return item.brand + "/" + item.version;
    }).join(" ");
  }
  return navigator.userAgent;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/isLayoutViewport.js
function isLayoutViewport() {
  return !/^((?!chrome|android).)*safari/i.test(getUAString());
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getBoundingClientRect.js
function getBoundingClientRect(element, includeScale, isFixedStrategy) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  var clientRect = element.getBoundingClientRect();
  var scaleX = 1;
  var scaleY = 1;
  if (includeScale && isHTMLElement(element)) {
    scaleX = element.offsetWidth > 0 ? round(clientRect.width) / element.offsetWidth || 1 : 1;
    scaleY = element.offsetHeight > 0 ? round(clientRect.height) / element.offsetHeight || 1 : 1;
  }
  var _ref = isElement(element) ? getWindow(element) : window, visualViewport = _ref.visualViewport;
  var addVisualOffsets = !isLayoutViewport() && isFixedStrategy;
  var x2 = (clientRect.left + (addVisualOffsets && visualViewport ? visualViewport.offsetLeft : 0)) / scaleX;
  var y3 = (clientRect.top + (addVisualOffsets && visualViewport ? visualViewport.offsetTop : 0)) / scaleY;
  var width = clientRect.width / scaleX;
  var height = clientRect.height / scaleY;
  return {
    width,
    height,
    top: y3,
    right: x2 + width,
    bottom: y3 + height,
    left: x2,
    x: x2,
    y: y3
  };
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getLayoutRect.js
function getLayoutRect(element) {
  var clientRect = getBoundingClientRect(element);
  var width = element.offsetWidth;
  var height = element.offsetHeight;
  if (Math.abs(clientRect.width - width) <= 1) {
    width = clientRect.width;
  }
  if (Math.abs(clientRect.height - height) <= 1) {
    height = clientRect.height;
  }
  return {
    x: element.offsetLeft,
    y: element.offsetTop,
    width,
    height
  };
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/contains.js
function contains(parent, child) {
  var rootNode = child.getRootNode && child.getRootNode();
  if (parent.contains(child)) {
    return true;
  } else if (rootNode && isShadowRoot(rootNode)) {
    var next = child;
    do {
      if (next && parent.isSameNode(next)) {
        return true;
      }
      next = next.parentNode || next.host;
    } while (next);
  }
  return false;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getComputedStyle.js
function getComputedStyle2(element) {
  return getWindow(element).getComputedStyle(element);
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/isTableElement.js
function isTableElement(element) {
  return ["table", "td", "th"].indexOf(getNodeName(element)) >= 0;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getDocumentElement.js
function getDocumentElement(element) {
  return ((isElement(element) ? element.ownerDocument : (
    // $FlowFixMe[prop-missing]
    element.document
  )) || window.document).documentElement;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getParentNode.js
function getParentNode(element) {
  if (getNodeName(element) === "html") {
    return element;
  }
  return (
    // this is a quicker (but less type safe) way to save quite some bytes from the bundle
    // $FlowFixMe[incompatible-return]
    // $FlowFixMe[prop-missing]
    element.assignedSlot || // step into the shadow DOM of the parent of a slotted node
    element.parentNode || // DOM Element detected
    (isShadowRoot(element) ? element.host : null) || // ShadowRoot detected
    // $FlowFixMe[incompatible-call]: HTMLElement is a Node
    getDocumentElement(element)
  );
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getOffsetParent.js
function getTrueOffsetParent(element) {
  if (!isHTMLElement(element) || // https://github.com/popperjs/popper-core/issues/837
  getComputedStyle2(element).position === "fixed") {
    return null;
  }
  return element.offsetParent;
}
function getContainingBlock(element) {
  var isFirefox = /firefox/i.test(getUAString());
  var isIE = /Trident/i.test(getUAString());
  if (isIE && isHTMLElement(element)) {
    var elementCss = getComputedStyle2(element);
    if (elementCss.position === "fixed") {
      return null;
    }
  }
  var currentNode = getParentNode(element);
  if (isShadowRoot(currentNode)) {
    currentNode = currentNode.host;
  }
  while (isHTMLElement(currentNode) && ["html", "body"].indexOf(getNodeName(currentNode)) < 0) {
    var css = getComputedStyle2(currentNode);
    if (css.transform !== "none" || css.perspective !== "none" || css.contain === "paint" || ["transform", "perspective"].indexOf(css.willChange) !== -1 || isFirefox && css.willChange === "filter" || isFirefox && css.filter && css.filter !== "none") {
      return currentNode;
    } else {
      currentNode = currentNode.parentNode;
    }
  }
  return null;
}
function getOffsetParent(element) {
  var window2 = getWindow(element);
  var offsetParent = getTrueOffsetParent(element);
  while (offsetParent && isTableElement(offsetParent) && getComputedStyle2(offsetParent).position === "static") {
    offsetParent = getTrueOffsetParent(offsetParent);
  }
  if (offsetParent && (getNodeName(offsetParent) === "html" || getNodeName(offsetParent) === "body" && getComputedStyle2(offsetParent).position === "static")) {
    return window2;
  }
  return offsetParent || getContainingBlock(element) || window2;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/getMainAxisFromPlacement.js
function getMainAxisFromPlacement(placement) {
  return ["top", "bottom"].indexOf(placement) >= 0 ? "x" : "y";
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/within.js
function within(min2, value, max2) {
  return max(min2, min(value, max2));
}
function withinMaxClamp(min2, value, max2) {
  var v2 = within(min2, value, max2);
  return v2 > max2 ? max2 : v2;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/getFreshSideObject.js
function getFreshSideObject() {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/mergePaddingObject.js
function mergePaddingObject(paddingObject) {
  return Object.assign({}, getFreshSideObject(), paddingObject);
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/expandToHashMap.js
function expandToHashMap(value, keys) {
  return keys.reduce(function(hashMap, key) {
    hashMap[key] = value;
    return hashMap;
  }, {});
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/modifiers/arrow.js
var toPaddingObject = function toPaddingObject2(padding, state) {
  padding = typeof padding === "function" ? padding(Object.assign({}, state.rects, {
    placement: state.placement
  })) : padding;
  return mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
};
function arrow(_ref) {
  var _state$modifiersData$;
  var state = _ref.state, name = _ref.name, options = _ref.options;
  var arrowElement = state.elements.arrow;
  var popperOffsets2 = state.modifiersData.popperOffsets;
  var basePlacement = getBasePlacement(state.placement);
  var axis = getMainAxisFromPlacement(basePlacement);
  var isVertical = [left, right].indexOf(basePlacement) >= 0;
  var len = isVertical ? "height" : "width";
  if (!arrowElement || !popperOffsets2) {
    return;
  }
  var paddingObject = toPaddingObject(options.padding, state);
  var arrowRect = getLayoutRect(arrowElement);
  var minProp = axis === "y" ? top : left;
  var maxProp = axis === "y" ? bottom : right;
  var endDiff = state.rects.reference[len] + state.rects.reference[axis] - popperOffsets2[axis] - state.rects.popper[len];
  var startDiff = popperOffsets2[axis] - state.rects.reference[axis];
  var arrowOffsetParent = getOffsetParent(arrowElement);
  var clientSize = arrowOffsetParent ? axis === "y" ? arrowOffsetParent.clientHeight || 0 : arrowOffsetParent.clientWidth || 0 : 0;
  var centerToReference = endDiff / 2 - startDiff / 2;
  var min2 = paddingObject[minProp];
  var max2 = clientSize - arrowRect[len] - paddingObject[maxProp];
  var center = clientSize / 2 - arrowRect[len] / 2 + centerToReference;
  var offset2 = within(min2, center, max2);
  var axisProp = axis;
  state.modifiersData[name] = (_state$modifiersData$ = {}, _state$modifiersData$[axisProp] = offset2, _state$modifiersData$.centerOffset = offset2 - center, _state$modifiersData$);
}
function effect2(_ref2) {
  var state = _ref2.state, options = _ref2.options;
  var _options$element = options.element, arrowElement = _options$element === void 0 ? "[data-popper-arrow]" : _options$element;
  if (arrowElement == null) {
    return;
  }
  if (typeof arrowElement === "string") {
    arrowElement = state.elements.popper.querySelector(arrowElement);
    if (!arrowElement) {
      return;
    }
  }
  if (!contains(state.elements.popper, arrowElement)) {
    return;
  }
  state.elements.arrow = arrowElement;
}
var arrow_default = {
  name: "arrow",
  enabled: true,
  phase: "main",
  fn: arrow,
  effect: effect2,
  requires: ["popperOffsets"],
  requiresIfExists: ["preventOverflow"]
};

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/getVariation.js
function getVariation(placement) {
  return placement.split("-")[1];
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/modifiers/computeStyles.js
var unsetSides = {
  top: "auto",
  right: "auto",
  bottom: "auto",
  left: "auto"
};
function roundOffsetsByDPR(_ref, win) {
  var x2 = _ref.x, y3 = _ref.y;
  var dpr = win.devicePixelRatio || 1;
  return {
    x: round(x2 * dpr) / dpr || 0,
    y: round(y3 * dpr) / dpr || 0
  };
}
function mapToStyles(_ref2) {
  var _Object$assign2;
  var popper2 = _ref2.popper, popperRect = _ref2.popperRect, placement = _ref2.placement, variation = _ref2.variation, offsets = _ref2.offsets, position = _ref2.position, gpuAcceleration = _ref2.gpuAcceleration, adaptive = _ref2.adaptive, roundOffsets = _ref2.roundOffsets, isFixed = _ref2.isFixed;
  var _offsets$x = offsets.x, x2 = _offsets$x === void 0 ? 0 : _offsets$x, _offsets$y = offsets.y, y3 = _offsets$y === void 0 ? 0 : _offsets$y;
  var _ref3 = typeof roundOffsets === "function" ? roundOffsets({
    x: x2,
    y: y3
  }) : {
    x: x2,
    y: y3
  };
  x2 = _ref3.x;
  y3 = _ref3.y;
  var hasX = offsets.hasOwnProperty("x");
  var hasY = offsets.hasOwnProperty("y");
  var sideX = left;
  var sideY = top;
  var win = window;
  if (adaptive) {
    var offsetParent = getOffsetParent(popper2);
    var heightProp = "clientHeight";
    var widthProp = "clientWidth";
    if (offsetParent === getWindow(popper2)) {
      offsetParent = getDocumentElement(popper2);
      if (getComputedStyle2(offsetParent).position !== "static" && position === "absolute") {
        heightProp = "scrollHeight";
        widthProp = "scrollWidth";
      }
    }
    offsetParent = offsetParent;
    if (placement === top || (placement === left || placement === right) && variation === end) {
      sideY = bottom;
      var offsetY = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.height : (
        // $FlowFixMe[prop-missing]
        offsetParent[heightProp]
      );
      y3 -= offsetY - popperRect.height;
      y3 *= gpuAcceleration ? 1 : -1;
    }
    if (placement === left || (placement === top || placement === bottom) && variation === end) {
      sideX = right;
      var offsetX = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.width : (
        // $FlowFixMe[prop-missing]
        offsetParent[widthProp]
      );
      x2 -= offsetX - popperRect.width;
      x2 *= gpuAcceleration ? 1 : -1;
    }
  }
  var commonStyles = Object.assign({
    position
  }, adaptive && unsetSides);
  var _ref4 = roundOffsets === true ? roundOffsetsByDPR({
    x: x2,
    y: y3
  }, getWindow(popper2)) : {
    x: x2,
    y: y3
  };
  x2 = _ref4.x;
  y3 = _ref4.y;
  if (gpuAcceleration) {
    var _Object$assign;
    return Object.assign({}, commonStyles, (_Object$assign = {}, _Object$assign[sideY] = hasY ? "0" : "", _Object$assign[sideX] = hasX ? "0" : "", _Object$assign.transform = (win.devicePixelRatio || 1) <= 1 ? "translate(" + x2 + "px, " + y3 + "px)" : "translate3d(" + x2 + "px, " + y3 + "px, 0)", _Object$assign));
  }
  return Object.assign({}, commonStyles, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y3 + "px" : "", _Object$assign2[sideX] = hasX ? x2 + "px" : "", _Object$assign2.transform = "", _Object$assign2));
}
function computeStyles(_ref5) {
  var state = _ref5.state, options = _ref5.options;
  var _options$gpuAccelerat = options.gpuAcceleration, gpuAcceleration = _options$gpuAccelerat === void 0 ? true : _options$gpuAccelerat, _options$adaptive = options.adaptive, adaptive = _options$adaptive === void 0 ? true : _options$adaptive, _options$roundOffsets = options.roundOffsets, roundOffsets = _options$roundOffsets === void 0 ? true : _options$roundOffsets;
  var commonStyles = {
    placement: getBasePlacement(state.placement),
    variation: getVariation(state.placement),
    popper: state.elements.popper,
    popperRect: state.rects.popper,
    gpuAcceleration,
    isFixed: state.options.strategy === "fixed"
  };
  if (state.modifiersData.popperOffsets != null) {
    state.styles.popper = Object.assign({}, state.styles.popper, mapToStyles(Object.assign({}, commonStyles, {
      offsets: state.modifiersData.popperOffsets,
      position: state.options.strategy,
      adaptive,
      roundOffsets
    })));
  }
  if (state.modifiersData.arrow != null) {
    state.styles.arrow = Object.assign({}, state.styles.arrow, mapToStyles(Object.assign({}, commonStyles, {
      offsets: state.modifiersData.arrow,
      position: "absolute",
      adaptive: false,
      roundOffsets
    })));
  }
  state.attributes.popper = Object.assign({}, state.attributes.popper, {
    "data-popper-placement": state.placement
  });
}
var computeStyles_default = {
  name: "computeStyles",
  enabled: true,
  phase: "beforeWrite",
  fn: computeStyles,
  data: {}
};

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/modifiers/eventListeners.js
var passive = {
  passive: true
};
function effect3(_ref) {
  var state = _ref.state, instance = _ref.instance, options = _ref.options;
  var _options$scroll = options.scroll, scroll = _options$scroll === void 0 ? true : _options$scroll, _options$resize = options.resize, resize = _options$resize === void 0 ? true : _options$resize;
  var window2 = getWindow(state.elements.popper);
  var scrollParents = [].concat(state.scrollParents.reference, state.scrollParents.popper);
  if (scroll) {
    scrollParents.forEach(function(scrollParent) {
      scrollParent.addEventListener("scroll", instance.update, passive);
    });
  }
  if (resize) {
    window2.addEventListener("resize", instance.update, passive);
  }
  return function() {
    if (scroll) {
      scrollParents.forEach(function(scrollParent) {
        scrollParent.removeEventListener("scroll", instance.update, passive);
      });
    }
    if (resize) {
      window2.removeEventListener("resize", instance.update, passive);
    }
  };
}
var eventListeners_default = {
  name: "eventListeners",
  enabled: true,
  phase: "write",
  fn: function fn() {
  },
  effect: effect3,
  data: {}
};

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/getOppositePlacement.js
var hash = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function getOppositePlacement(placement) {
  return placement.replace(/left|right|bottom|top/g, function(matched) {
    return hash[matched];
  });
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/getOppositeVariationPlacement.js
var hash2 = {
  start: "end",
  end: "start"
};
function getOppositeVariationPlacement(placement) {
  return placement.replace(/start|end/g, function(matched) {
    return hash2[matched];
  });
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getWindowScroll.js
function getWindowScroll(node) {
  var win = getWindow(node);
  var scrollLeft = win.pageXOffset;
  var scrollTop = win.pageYOffset;
  return {
    scrollLeft,
    scrollTop
  };
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getWindowScrollBarX.js
function getWindowScrollBarX(element) {
  return getBoundingClientRect(getDocumentElement(element)).left + getWindowScroll(element).scrollLeft;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getViewportRect.js
function getViewportRect(element, strategy) {
  var win = getWindow(element);
  var html = getDocumentElement(element);
  var visualViewport = win.visualViewport;
  var width = html.clientWidth;
  var height = html.clientHeight;
  var x2 = 0;
  var y3 = 0;
  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height;
    var layoutViewport = isLayoutViewport();
    if (layoutViewport || !layoutViewport && strategy === "fixed") {
      x2 = visualViewport.offsetLeft;
      y3 = visualViewport.offsetTop;
    }
  }
  return {
    width,
    height,
    x: x2 + getWindowScrollBarX(element),
    y: y3
  };
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getDocumentRect.js
function getDocumentRect(element) {
  var _element$ownerDocumen;
  var html = getDocumentElement(element);
  var winScroll = getWindowScroll(element);
  var body = (_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body;
  var width = max(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
  var height = max(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
  var x2 = -winScroll.scrollLeft + getWindowScrollBarX(element);
  var y3 = -winScroll.scrollTop;
  if (getComputedStyle2(body || html).direction === "rtl") {
    x2 += max(html.clientWidth, body ? body.clientWidth : 0) - width;
  }
  return {
    width,
    height,
    x: x2,
    y: y3
  };
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/isScrollParent.js
function isScrollParent(element) {
  var _getComputedStyle = getComputedStyle2(element), overflow = _getComputedStyle.overflow, overflowX = _getComputedStyle.overflowX, overflowY = _getComputedStyle.overflowY;
  return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getScrollParent.js
function getScrollParent(node) {
  if (["html", "body", "#document"].indexOf(getNodeName(node)) >= 0) {
    return node.ownerDocument.body;
  }
  if (isHTMLElement(node) && isScrollParent(node)) {
    return node;
  }
  return getScrollParent(getParentNode(node));
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/listScrollParents.js
function listScrollParents(element, list) {
  var _element$ownerDocumen;
  if (list === void 0) {
    list = [];
  }
  var scrollParent = getScrollParent(element);
  var isBody = scrollParent === ((_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body);
  var win = getWindow(scrollParent);
  var target = isBody ? [win].concat(win.visualViewport || [], isScrollParent(scrollParent) ? scrollParent : []) : scrollParent;
  var updatedList = list.concat(target);
  return isBody ? updatedList : (
    // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
    updatedList.concat(listScrollParents(getParentNode(target)))
  );
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/rectToClientRect.js
function rectToClientRect(rect) {
  return Object.assign({}, rect, {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height
  });
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getClippingRect.js
function getInnerBoundingClientRect(element, strategy) {
  var rect = getBoundingClientRect(element, false, strategy === "fixed");
  rect.top = rect.top + element.clientTop;
  rect.left = rect.left + element.clientLeft;
  rect.bottom = rect.top + element.clientHeight;
  rect.right = rect.left + element.clientWidth;
  rect.width = element.clientWidth;
  rect.height = element.clientHeight;
  rect.x = rect.left;
  rect.y = rect.top;
  return rect;
}
function getClientRectFromMixedType(element, clippingParent, strategy) {
  return clippingParent === viewport ? rectToClientRect(getViewportRect(element, strategy)) : isElement(clippingParent) ? getInnerBoundingClientRect(clippingParent, strategy) : rectToClientRect(getDocumentRect(getDocumentElement(element)));
}
function getClippingParents(element) {
  var clippingParents2 = listScrollParents(getParentNode(element));
  var canEscapeClipping = ["absolute", "fixed"].indexOf(getComputedStyle2(element).position) >= 0;
  var clipperElement = canEscapeClipping && isHTMLElement(element) ? getOffsetParent(element) : element;
  if (!isElement(clipperElement)) {
    return [];
  }
  return clippingParents2.filter(function(clippingParent) {
    return isElement(clippingParent) && contains(clippingParent, clipperElement) && getNodeName(clippingParent) !== "body";
  });
}
function getClippingRect(element, boundary, rootBoundary, strategy) {
  var mainClippingParents = boundary === "clippingParents" ? getClippingParents(element) : [].concat(boundary);
  var clippingParents2 = [].concat(mainClippingParents, [rootBoundary]);
  var firstClippingParent = clippingParents2[0];
  var clippingRect = clippingParents2.reduce(function(accRect, clippingParent) {
    var rect = getClientRectFromMixedType(element, clippingParent, strategy);
    accRect.top = max(rect.top, accRect.top);
    accRect.right = min(rect.right, accRect.right);
    accRect.bottom = min(rect.bottom, accRect.bottom);
    accRect.left = max(rect.left, accRect.left);
    return accRect;
  }, getClientRectFromMixedType(element, firstClippingParent, strategy));
  clippingRect.width = clippingRect.right - clippingRect.left;
  clippingRect.height = clippingRect.bottom - clippingRect.top;
  clippingRect.x = clippingRect.left;
  clippingRect.y = clippingRect.top;
  return clippingRect;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/computeOffsets.js
function computeOffsets(_ref) {
  var reference2 = _ref.reference, element = _ref.element, placement = _ref.placement;
  var basePlacement = placement ? getBasePlacement(placement) : null;
  var variation = placement ? getVariation(placement) : null;
  var commonX = reference2.x + reference2.width / 2 - element.width / 2;
  var commonY = reference2.y + reference2.height / 2 - element.height / 2;
  var offsets;
  switch (basePlacement) {
    case top:
      offsets = {
        x: commonX,
        y: reference2.y - element.height
      };
      break;
    case bottom:
      offsets = {
        x: commonX,
        y: reference2.y + reference2.height
      };
      break;
    case right:
      offsets = {
        x: reference2.x + reference2.width,
        y: commonY
      };
      break;
    case left:
      offsets = {
        x: reference2.x - element.width,
        y: commonY
      };
      break;
    default:
      offsets = {
        x: reference2.x,
        y: reference2.y
      };
  }
  var mainAxis = basePlacement ? getMainAxisFromPlacement(basePlacement) : null;
  if (mainAxis != null) {
    var len = mainAxis === "y" ? "height" : "width";
    switch (variation) {
      case start:
        offsets[mainAxis] = offsets[mainAxis] - (reference2[len] / 2 - element[len] / 2);
        break;
      case end:
        offsets[mainAxis] = offsets[mainAxis] + (reference2[len] / 2 - element[len] / 2);
        break;
      default:
    }
  }
  return offsets;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/detectOverflow.js
function detectOverflow(state, options) {
  if (options === void 0) {
    options = {};
  }
  var _options = options, _options$placement = _options.placement, placement = _options$placement === void 0 ? state.placement : _options$placement, _options$strategy = _options.strategy, strategy = _options$strategy === void 0 ? state.strategy : _options$strategy, _options$boundary = _options.boundary, boundary = _options$boundary === void 0 ? clippingParents : _options$boundary, _options$rootBoundary = _options.rootBoundary, rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary, _options$elementConte = _options.elementContext, elementContext = _options$elementConte === void 0 ? popper : _options$elementConte, _options$altBoundary = _options.altBoundary, altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary, _options$padding = _options.padding, padding = _options$padding === void 0 ? 0 : _options$padding;
  var paddingObject = mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
  var altContext = elementContext === popper ? reference : popper;
  var popperRect = state.rects.popper;
  var element = state.elements[altBoundary ? altContext : elementContext];
  var clippingClientRect = getClippingRect(isElement(element) ? element : element.contextElement || getDocumentElement(state.elements.popper), boundary, rootBoundary, strategy);
  var referenceClientRect = getBoundingClientRect(state.elements.reference);
  var popperOffsets2 = computeOffsets({
    reference: referenceClientRect,
    element: popperRect,
    strategy: "absolute",
    placement
  });
  var popperClientRect = rectToClientRect(Object.assign({}, popperRect, popperOffsets2));
  var elementClientRect = elementContext === popper ? popperClientRect : referenceClientRect;
  var overflowOffsets = {
    top: clippingClientRect.top - elementClientRect.top + paddingObject.top,
    bottom: elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom,
    left: clippingClientRect.left - elementClientRect.left + paddingObject.left,
    right: elementClientRect.right - clippingClientRect.right + paddingObject.right
  };
  var offsetData = state.modifiersData.offset;
  if (elementContext === popper && offsetData) {
    var offset2 = offsetData[placement];
    Object.keys(overflowOffsets).forEach(function(key) {
      var multiply = [right, bottom].indexOf(key) >= 0 ? 1 : -1;
      var axis = [top, bottom].indexOf(key) >= 0 ? "y" : "x";
      overflowOffsets[key] += offset2[axis] * multiply;
    });
  }
  return overflowOffsets;
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/computeAutoPlacement.js
function computeAutoPlacement(state, options) {
  if (options === void 0) {
    options = {};
  }
  var _options = options, placement = _options.placement, boundary = _options.boundary, rootBoundary = _options.rootBoundary, padding = _options.padding, flipVariations = _options.flipVariations, _options$allowedAutoP = _options.allowedAutoPlacements, allowedAutoPlacements = _options$allowedAutoP === void 0 ? placements : _options$allowedAutoP;
  var variation = getVariation(placement);
  var placements2 = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function(placement2) {
    return getVariation(placement2) === variation;
  }) : basePlacements;
  var allowedPlacements = placements2.filter(function(placement2) {
    return allowedAutoPlacements.indexOf(placement2) >= 0;
  });
  if (allowedPlacements.length === 0) {
    allowedPlacements = placements2;
  }
  var overflows = allowedPlacements.reduce(function(acc, placement2) {
    acc[placement2] = detectOverflow(state, {
      placement: placement2,
      boundary,
      rootBoundary,
      padding
    })[getBasePlacement(placement2)];
    return acc;
  }, {});
  return Object.keys(overflows).sort(function(a2, b3) {
    return overflows[a2] - overflows[b3];
  });
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/modifiers/flip.js
function getExpandedFallbackPlacements(placement) {
  if (getBasePlacement(placement) === auto) {
    return [];
  }
  var oppositePlacement = getOppositePlacement(placement);
  return [getOppositeVariationPlacement(placement), oppositePlacement, getOppositeVariationPlacement(oppositePlacement)];
}
function flip(_ref) {
  var state = _ref.state, options = _ref.options, name = _ref.name;
  if (state.modifiersData[name]._skip) {
    return;
  }
  var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? true : _options$altAxis, specifiedFallbackPlacements = options.fallbackPlacements, padding = options.padding, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, _options$flipVariatio = options.flipVariations, flipVariations = _options$flipVariatio === void 0 ? true : _options$flipVariatio, allowedAutoPlacements = options.allowedAutoPlacements;
  var preferredPlacement = state.options.placement;
  var basePlacement = getBasePlacement(preferredPlacement);
  var isBasePlacement = basePlacement === preferredPlacement;
  var fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipVariations ? [getOppositePlacement(preferredPlacement)] : getExpandedFallbackPlacements(preferredPlacement));
  var placements2 = [preferredPlacement].concat(fallbackPlacements).reduce(function(acc, placement2) {
    return acc.concat(getBasePlacement(placement2) === auto ? computeAutoPlacement(state, {
      placement: placement2,
      boundary,
      rootBoundary,
      padding,
      flipVariations,
      allowedAutoPlacements
    }) : placement2);
  }, []);
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var checksMap = /* @__PURE__ */ new Map();
  var makeFallbackChecks = true;
  var firstFittingPlacement = placements2[0];
  for (var i = 0; i < placements2.length; i++) {
    var placement = placements2[i];
    var _basePlacement = getBasePlacement(placement);
    var isStartVariation = getVariation(placement) === start;
    var isVertical = [top, bottom].indexOf(_basePlacement) >= 0;
    var len = isVertical ? "width" : "height";
    var overflow = detectOverflow(state, {
      placement,
      boundary,
      rootBoundary,
      altBoundary,
      padding
    });
    var mainVariationSide = isVertical ? isStartVariation ? right : left : isStartVariation ? bottom : top;
    if (referenceRect[len] > popperRect[len]) {
      mainVariationSide = getOppositePlacement(mainVariationSide);
    }
    var altVariationSide = getOppositePlacement(mainVariationSide);
    var checks = [];
    if (checkMainAxis) {
      checks.push(overflow[_basePlacement] <= 0);
    }
    if (checkAltAxis) {
      checks.push(overflow[mainVariationSide] <= 0, overflow[altVariationSide] <= 0);
    }
    if (checks.every(function(check) {
      return check;
    })) {
      firstFittingPlacement = placement;
      makeFallbackChecks = false;
      break;
    }
    checksMap.set(placement, checks);
  }
  if (makeFallbackChecks) {
    var numberOfChecks = flipVariations ? 3 : 1;
    var _loop = function _loop2(_i2) {
      var fittingPlacement = placements2.find(function(placement2) {
        var checks2 = checksMap.get(placement2);
        if (checks2) {
          return checks2.slice(0, _i2).every(function(check) {
            return check;
          });
        }
      });
      if (fittingPlacement) {
        firstFittingPlacement = fittingPlacement;
        return "break";
      }
    };
    for (var _i = numberOfChecks; _i > 0; _i--) {
      var _ret = _loop(_i);
      if (_ret === "break") break;
    }
  }
  if (state.placement !== firstFittingPlacement) {
    state.modifiersData[name]._skip = true;
    state.placement = firstFittingPlacement;
    state.reset = true;
  }
}
var flip_default = {
  name: "flip",
  enabled: true,
  phase: "main",
  fn: flip,
  requiresIfExists: ["offset"],
  data: {
    _skip: false
  }
};

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/modifiers/hide.js
function getSideOffsets(overflow, rect, preventedOffsets) {
  if (preventedOffsets === void 0) {
    preventedOffsets = {
      x: 0,
      y: 0
    };
  }
  return {
    top: overflow.top - rect.height - preventedOffsets.y,
    right: overflow.right - rect.width + preventedOffsets.x,
    bottom: overflow.bottom - rect.height + preventedOffsets.y,
    left: overflow.left - rect.width - preventedOffsets.x
  };
}
function isAnySideFullyClipped(overflow) {
  return [top, right, bottom, left].some(function(side) {
    return overflow[side] >= 0;
  });
}
function hide(_ref) {
  var state = _ref.state, name = _ref.name;
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var preventedOffsets = state.modifiersData.preventOverflow;
  var referenceOverflow = detectOverflow(state, {
    elementContext: "reference"
  });
  var popperAltOverflow = detectOverflow(state, {
    altBoundary: true
  });
  var referenceClippingOffsets = getSideOffsets(referenceOverflow, referenceRect);
  var popperEscapeOffsets = getSideOffsets(popperAltOverflow, popperRect, preventedOffsets);
  var isReferenceHidden = isAnySideFullyClipped(referenceClippingOffsets);
  var hasPopperEscaped = isAnySideFullyClipped(popperEscapeOffsets);
  state.modifiersData[name] = {
    referenceClippingOffsets,
    popperEscapeOffsets,
    isReferenceHidden,
    hasPopperEscaped
  };
  state.attributes.popper = Object.assign({}, state.attributes.popper, {
    "data-popper-reference-hidden": isReferenceHidden,
    "data-popper-escaped": hasPopperEscaped
  });
}
var hide_default = {
  name: "hide",
  enabled: true,
  phase: "main",
  requiresIfExists: ["preventOverflow"],
  fn: hide
};

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/modifiers/offset.js
function distanceAndSkiddingToXY(placement, rects, offset2) {
  var basePlacement = getBasePlacement(placement);
  var invertDistance = [left, top].indexOf(basePlacement) >= 0 ? -1 : 1;
  var _ref = typeof offset2 === "function" ? offset2(Object.assign({}, rects, {
    placement
  })) : offset2, skidding = _ref[0], distance = _ref[1];
  skidding = skidding || 0;
  distance = (distance || 0) * invertDistance;
  return [left, right].indexOf(basePlacement) >= 0 ? {
    x: distance,
    y: skidding
  } : {
    x: skidding,
    y: distance
  };
}
function offset(_ref2) {
  var state = _ref2.state, options = _ref2.options, name = _ref2.name;
  var _options$offset = options.offset, offset2 = _options$offset === void 0 ? [0, 0] : _options$offset;
  var data = placements.reduce(function(acc, placement) {
    acc[placement] = distanceAndSkiddingToXY(placement, state.rects, offset2);
    return acc;
  }, {});
  var _data$state$placement = data[state.placement], x2 = _data$state$placement.x, y3 = _data$state$placement.y;
  if (state.modifiersData.popperOffsets != null) {
    state.modifiersData.popperOffsets.x += x2;
    state.modifiersData.popperOffsets.y += y3;
  }
  state.modifiersData[name] = data;
}
var offset_default = {
  name: "offset",
  enabled: true,
  phase: "main",
  requires: ["popperOffsets"],
  fn: offset
};

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/modifiers/popperOffsets.js
function popperOffsets(_ref) {
  var state = _ref.state, name = _ref.name;
  state.modifiersData[name] = computeOffsets({
    reference: state.rects.reference,
    element: state.rects.popper,
    strategy: "absolute",
    placement: state.placement
  });
}
var popperOffsets_default = {
  name: "popperOffsets",
  enabled: true,
  phase: "read",
  fn: popperOffsets,
  data: {}
};

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/getAltAxis.js
function getAltAxis(axis) {
  return axis === "x" ? "y" : "x";
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/modifiers/preventOverflow.js
function preventOverflow(_ref) {
  var state = _ref.state, options = _ref.options, name = _ref.name;
  var _options$mainAxis = options.mainAxis, checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis, _options$altAxis = options.altAxis, checkAltAxis = _options$altAxis === void 0 ? false : _options$altAxis, boundary = options.boundary, rootBoundary = options.rootBoundary, altBoundary = options.altBoundary, padding = options.padding, _options$tether = options.tether, tether = _options$tether === void 0 ? true : _options$tether, _options$tetherOffset = options.tetherOffset, tetherOffset = _options$tetherOffset === void 0 ? 0 : _options$tetherOffset;
  var overflow = detectOverflow(state, {
    boundary,
    rootBoundary,
    padding,
    altBoundary
  });
  var basePlacement = getBasePlacement(state.placement);
  var variation = getVariation(state.placement);
  var isBasePlacement = !variation;
  var mainAxis = getMainAxisFromPlacement(basePlacement);
  var altAxis = getAltAxis(mainAxis);
  var popperOffsets2 = state.modifiersData.popperOffsets;
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var tetherOffsetValue = typeof tetherOffset === "function" ? tetherOffset(Object.assign({}, state.rects, {
    placement: state.placement
  })) : tetherOffset;
  var normalizedTetherOffsetValue = typeof tetherOffsetValue === "number" ? {
    mainAxis: tetherOffsetValue,
    altAxis: tetherOffsetValue
  } : Object.assign({
    mainAxis: 0,
    altAxis: 0
  }, tetherOffsetValue);
  var offsetModifierState = state.modifiersData.offset ? state.modifiersData.offset[state.placement] : null;
  var data = {
    x: 0,
    y: 0
  };
  if (!popperOffsets2) {
    return;
  }
  if (checkMainAxis) {
    var _offsetModifierState$;
    var mainSide = mainAxis === "y" ? top : left;
    var altSide = mainAxis === "y" ? bottom : right;
    var len = mainAxis === "y" ? "height" : "width";
    var offset2 = popperOffsets2[mainAxis];
    var min2 = offset2 + overflow[mainSide];
    var max2 = offset2 - overflow[altSide];
    var additive = tether ? -popperRect[len] / 2 : 0;
    var minLen = variation === start ? referenceRect[len] : popperRect[len];
    var maxLen = variation === start ? -popperRect[len] : -referenceRect[len];
    var arrowElement = state.elements.arrow;
    var arrowRect = tether && arrowElement ? getLayoutRect(arrowElement) : {
      width: 0,
      height: 0
    };
    var arrowPaddingObject = state.modifiersData["arrow#persistent"] ? state.modifiersData["arrow#persistent"].padding : getFreshSideObject();
    var arrowPaddingMin = arrowPaddingObject[mainSide];
    var arrowPaddingMax = arrowPaddingObject[altSide];
    var arrowLen = within(0, referenceRect[len], arrowRect[len]);
    var minOffset = isBasePlacement ? referenceRect[len] / 2 - additive - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis : minLen - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis;
    var maxOffset = isBasePlacement ? -referenceRect[len] / 2 + additive + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis : maxLen + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis;
    var arrowOffsetParent = state.elements.arrow && getOffsetParent(state.elements.arrow);
    var clientOffset = arrowOffsetParent ? mainAxis === "y" ? arrowOffsetParent.clientTop || 0 : arrowOffsetParent.clientLeft || 0 : 0;
    var offsetModifierValue = (_offsetModifierState$ = offsetModifierState == null ? void 0 : offsetModifierState[mainAxis]) != null ? _offsetModifierState$ : 0;
    var tetherMin = offset2 + minOffset - offsetModifierValue - clientOffset;
    var tetherMax = offset2 + maxOffset - offsetModifierValue;
    var preventedOffset = within(tether ? min(min2, tetherMin) : min2, offset2, tether ? max(max2, tetherMax) : max2);
    popperOffsets2[mainAxis] = preventedOffset;
    data[mainAxis] = preventedOffset - offset2;
  }
  if (checkAltAxis) {
    var _offsetModifierState$2;
    var _mainSide = mainAxis === "x" ? top : left;
    var _altSide = mainAxis === "x" ? bottom : right;
    var _offset = popperOffsets2[altAxis];
    var _len = altAxis === "y" ? "height" : "width";
    var _min = _offset + overflow[_mainSide];
    var _max = _offset - overflow[_altSide];
    var isOriginSide = [top, left].indexOf(basePlacement) !== -1;
    var _offsetModifierValue = (_offsetModifierState$2 = offsetModifierState == null ? void 0 : offsetModifierState[altAxis]) != null ? _offsetModifierState$2 : 0;
    var _tetherMin = isOriginSide ? _min : _offset - referenceRect[_len] - popperRect[_len] - _offsetModifierValue + normalizedTetherOffsetValue.altAxis;
    var _tetherMax = isOriginSide ? _offset + referenceRect[_len] + popperRect[_len] - _offsetModifierValue - normalizedTetherOffsetValue.altAxis : _max;
    var _preventedOffset = tether && isOriginSide ? withinMaxClamp(_tetherMin, _offset, _tetherMax) : within(tether ? _tetherMin : _min, _offset, tether ? _tetherMax : _max);
    popperOffsets2[altAxis] = _preventedOffset;
    data[altAxis] = _preventedOffset - _offset;
  }
  state.modifiersData[name] = data;
}
var preventOverflow_default = {
  name: "preventOverflow",
  enabled: true,
  phase: "main",
  fn: preventOverflow,
  requiresIfExists: ["offset"]
};

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getHTMLElementScroll.js
function getHTMLElementScroll(element) {
  return {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop
  };
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getNodeScroll.js
function getNodeScroll(node) {
  if (node === getWindow(node) || !isHTMLElement(node)) {
    return getWindowScroll(node);
  } else {
    return getHTMLElementScroll(node);
  }
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/dom-utils/getCompositeRect.js
function isElementScaled(element) {
  var rect = element.getBoundingClientRect();
  var scaleX = round(rect.width) / element.offsetWidth || 1;
  var scaleY = round(rect.height) / element.offsetHeight || 1;
  return scaleX !== 1 || scaleY !== 1;
}
function getCompositeRect(elementOrVirtualElement, offsetParent, isFixed) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  var isOffsetParentAnElement = isHTMLElement(offsetParent);
  var offsetParentIsScaled = isHTMLElement(offsetParent) && isElementScaled(offsetParent);
  var documentElement = getDocumentElement(offsetParent);
  var rect = getBoundingClientRect(elementOrVirtualElement, offsetParentIsScaled, isFixed);
  var scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  var offsets = {
    x: 0,
    y: 0
  };
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== "body" || // https://github.com/popperjs/popper-core/issues/1078
    isScrollParent(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isHTMLElement(offsetParent)) {
      offsets = getBoundingClientRect(offsetParent, true);
      offsets.x += offsetParent.clientLeft;
      offsets.y += offsetParent.clientTop;
    } else if (documentElement) {
      offsets.x = getWindowScrollBarX(documentElement);
    }
  }
  return {
    x: rect.left + scroll.scrollLeft - offsets.x,
    y: rect.top + scroll.scrollTop - offsets.y,
    width: rect.width,
    height: rect.height
  };
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/orderModifiers.js
function order(modifiers) {
  var map = /* @__PURE__ */ new Map();
  var visited = /* @__PURE__ */ new Set();
  var result = [];
  modifiers.forEach(function(modifier) {
    map.set(modifier.name, modifier);
  });
  function sort(modifier) {
    visited.add(modifier.name);
    var requires = [].concat(modifier.requires || [], modifier.requiresIfExists || []);
    requires.forEach(function(dep) {
      if (!visited.has(dep)) {
        var depModifier = map.get(dep);
        if (depModifier) {
          sort(depModifier);
        }
      }
    });
    result.push(modifier);
  }
  modifiers.forEach(function(modifier) {
    if (!visited.has(modifier.name)) {
      sort(modifier);
    }
  });
  return result;
}
function orderModifiers(modifiers) {
  var orderedModifiers = order(modifiers);
  return modifierPhases.reduce(function(acc, phase) {
    return acc.concat(orderedModifiers.filter(function(modifier) {
      return modifier.phase === phase;
    }));
  }, []);
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/debounce.js
function debounce(fn2) {
  var pending;
  return function() {
    if (!pending) {
      pending = new Promise(function(resolve) {
        Promise.resolve().then(function() {
          pending = void 0;
          resolve(fn2());
        });
      });
    }
    return pending;
  };
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/utils/mergeByName.js
function mergeByName(modifiers) {
  var merged = modifiers.reduce(function(merged2, current) {
    var existing = merged2[current.name];
    merged2[current.name] = existing ? Object.assign({}, existing, current, {
      options: Object.assign({}, existing.options, current.options),
      data: Object.assign({}, existing.data, current.data)
    }) : current;
    return merged2;
  }, {});
  return Object.keys(merged).map(function(key) {
    return merged[key];
  });
}

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/createPopper.js
var DEFAULT_OPTIONS = {
  placement: "bottom",
  modifiers: [],
  strategy: "absolute"
};
function areValidElements() {
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }
  return !args.some(function(element) {
    return !(element && typeof element.getBoundingClientRect === "function");
  });
}
function popperGenerator(generatorOptions) {
  if (generatorOptions === void 0) {
    generatorOptions = {};
  }
  var _generatorOptions = generatorOptions, _generatorOptions$def = _generatorOptions.defaultModifiers, defaultModifiers3 = _generatorOptions$def === void 0 ? [] : _generatorOptions$def, _generatorOptions$def2 = _generatorOptions.defaultOptions, defaultOptions = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
  return function createPopper4(reference2, popper2, options) {
    if (options === void 0) {
      options = defaultOptions;
    }
    var state = {
      placement: "bottom",
      orderedModifiers: [],
      options: Object.assign({}, DEFAULT_OPTIONS, defaultOptions),
      modifiersData: {},
      elements: {
        reference: reference2,
        popper: popper2
      },
      attributes: {},
      styles: {}
    };
    var effectCleanupFns = [];
    var isDestroyed = false;
    var instance = {
      state,
      setOptions: function setOptions(setOptionsAction) {
        var options2 = typeof setOptionsAction === "function" ? setOptionsAction(state.options) : setOptionsAction;
        cleanupModifierEffects();
        state.options = Object.assign({}, defaultOptions, state.options, options2);
        state.scrollParents = {
          reference: isElement(reference2) ? listScrollParents(reference2) : reference2.contextElement ? listScrollParents(reference2.contextElement) : [],
          popper: listScrollParents(popper2)
        };
        var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers3, state.options.modifiers)));
        state.orderedModifiers = orderedModifiers.filter(function(m3) {
          return m3.enabled;
        });
        runModifierEffects();
        return instance.update();
      },
      // Sync update – it will always be executed, even if not necessary. This
      // is useful for low frequency updates where sync behavior simplifies the
      // logic.
      // For high frequency updates (e.g. `resize` and `scroll` events), always
      // prefer the async Popper#update method
      forceUpdate: function forceUpdate() {
        if (isDestroyed) {
          return;
        }
        var _state$elements = state.elements, reference3 = _state$elements.reference, popper3 = _state$elements.popper;
        if (!areValidElements(reference3, popper3)) {
          return;
        }
        state.rects = {
          reference: getCompositeRect(reference3, getOffsetParent(popper3), state.options.strategy === "fixed"),
          popper: getLayoutRect(popper3)
        };
        state.reset = false;
        state.placement = state.options.placement;
        state.orderedModifiers.forEach(function(modifier) {
          return state.modifiersData[modifier.name] = Object.assign({}, modifier.data);
        });
        for (var index = 0; index < state.orderedModifiers.length; index++) {
          if (state.reset === true) {
            state.reset = false;
            index = -1;
            continue;
          }
          var _state$orderedModifie = state.orderedModifiers[index], fn2 = _state$orderedModifie.fn, _state$orderedModifie2 = _state$orderedModifie.options, _options = _state$orderedModifie2 === void 0 ? {} : _state$orderedModifie2, name = _state$orderedModifie.name;
          if (typeof fn2 === "function") {
            state = fn2({
              state,
              options: _options,
              name,
              instance
            }) || state;
          }
        }
      },
      // Async and optimistically optimized update – it will not be executed if
      // not necessary (debounced to run at most once-per-tick)
      update: debounce(function() {
        return new Promise(function(resolve) {
          instance.forceUpdate();
          resolve(state);
        });
      }),
      destroy: function destroy() {
        cleanupModifierEffects();
        isDestroyed = true;
      }
    };
    if (!areValidElements(reference2, popper2)) {
      return instance;
    }
    instance.setOptions(options).then(function(state2) {
      if (!isDestroyed && options.onFirstUpdate) {
        options.onFirstUpdate(state2);
      }
    });
    function runModifierEffects() {
      state.orderedModifiers.forEach(function(_ref) {
        var name = _ref.name, _ref$options = _ref.options, options2 = _ref$options === void 0 ? {} : _ref$options, effect4 = _ref.effect;
        if (typeof effect4 === "function") {
          var cleanupFn = effect4({
            state,
            name,
            instance,
            options: options2
          });
          var noopFn = function noopFn2() {
          };
          effectCleanupFns.push(cleanupFn || noopFn);
        }
      });
    }
    function cleanupModifierEffects() {
      effectCleanupFns.forEach(function(fn2) {
        return fn2();
      });
      effectCleanupFns = [];
    }
    return instance;
  };
}
var createPopper = /* @__PURE__ */ popperGenerator();

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/popper-lite.js
var defaultModifiers = [eventListeners_default, popperOffsets_default, computeStyles_default, applyStyles_default];
var createPopper2 = /* @__PURE__ */ popperGenerator({
  defaultModifiers
});

// node_modules/.pnpm/@popperjs+core@2.11.8/node_modules/@popperjs/core/lib/popper.js
var defaultModifiers2 = [eventListeners_default, popperOffsets_default, computeStyles_default, applyStyles_default, offset_default, flip_default, preventOverflow_default, arrow_default, hide_default];
var createPopper3 = /* @__PURE__ */ popperGenerator({
  defaultModifiers: defaultModifiers2
});

// node_modules/.pnpm/bootstrap@5.3.8_@popperjs+core@2.11.8/node_modules/bootstrap/dist/js/bootstrap.esm.js
var elementMap = /* @__PURE__ */ new Map();
var Data = {
  set(element, key, instance) {
    if (!elementMap.has(element)) {
      elementMap.set(element, /* @__PURE__ */ new Map());
    }
    const instanceMap = elementMap.get(element);
    if (!instanceMap.has(key) && instanceMap.size !== 0) {
      console.error(`Bootstrap doesn't allow more than one instance per element. Bound instance: ${Array.from(instanceMap.keys())[0]}.`);
      return;
    }
    instanceMap.set(key, instance);
  },
  get(element, key) {
    if (elementMap.has(element)) {
      return elementMap.get(element).get(key) || null;
    }
    return null;
  },
  remove(element, key) {
    if (!elementMap.has(element)) {
      return;
    }
    const instanceMap = elementMap.get(element);
    instanceMap.delete(key);
    if (instanceMap.size === 0) {
      elementMap.delete(element);
    }
  }
};
var MAX_UID = 1e6;
var MILLISECONDS_MULTIPLIER = 1e3;
var TRANSITION_END = "transitionend";
var parseSelector = (selector) => {
  if (selector && window.CSS && window.CSS.escape) {
    selector = selector.replace(/#([^\s"#']+)/g, (match, id) => `#${CSS.escape(id)}`);
  }
  return selector;
};
var toType = (object) => {
  if (object === null || object === void 0) {
    return `${object}`;
  }
  return Object.prototype.toString.call(object).match(/\s([a-z]+)/i)[1].toLowerCase();
};
var getUID = (prefix) => {
  do {
    prefix += Math.floor(Math.random() * MAX_UID);
  } while (document.getElementById(prefix));
  return prefix;
};
var getTransitionDurationFromElement = (element) => {
  if (!element) {
    return 0;
  }
  let {
    transitionDuration,
    transitionDelay
  } = window.getComputedStyle(element);
  const floatTransitionDuration = Number.parseFloat(transitionDuration);
  const floatTransitionDelay = Number.parseFloat(transitionDelay);
  if (!floatTransitionDuration && !floatTransitionDelay) {
    return 0;
  }
  transitionDuration = transitionDuration.split(",")[0];
  transitionDelay = transitionDelay.split(",")[0];
  return (Number.parseFloat(transitionDuration) + Number.parseFloat(transitionDelay)) * MILLISECONDS_MULTIPLIER;
};
var triggerTransitionEnd = (element) => {
  element.dispatchEvent(new Event(TRANSITION_END));
};
var isElement2 = (object) => {
  if (!object || typeof object !== "object") {
    return false;
  }
  if (typeof object.jquery !== "undefined") {
    object = object[0];
  }
  return typeof object.nodeType !== "undefined";
};
var getElement = (object) => {
  if (isElement2(object)) {
    return object.jquery ? object[0] : object;
  }
  if (typeof object === "string" && object.length > 0) {
    return document.querySelector(parseSelector(object));
  }
  return null;
};
var isVisible = (element) => {
  if (!isElement2(element) || element.getClientRects().length === 0) {
    return false;
  }
  const elementIsVisible = getComputedStyle(element).getPropertyValue("visibility") === "visible";
  const closedDetails = element.closest("details:not([open])");
  if (!closedDetails) {
    return elementIsVisible;
  }
  if (closedDetails !== element) {
    const summary = element.closest("summary");
    if (summary && summary.parentNode !== closedDetails) {
      return false;
    }
    if (summary === null) {
      return false;
    }
  }
  return elementIsVisible;
};
var isDisabled = (element) => {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return true;
  }
  if (element.classList.contains("disabled")) {
    return true;
  }
  if (typeof element.disabled !== "undefined") {
    return element.disabled;
  }
  return element.hasAttribute("disabled") && element.getAttribute("disabled") !== "false";
};
var findShadowRoot = (element) => {
  if (!document.documentElement.attachShadow) {
    return null;
  }
  if (typeof element.getRootNode === "function") {
    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root : null;
  }
  if (element instanceof ShadowRoot) {
    return element;
  }
  if (!element.parentNode) {
    return null;
  }
  return findShadowRoot(element.parentNode);
};
var noop = () => {
};
var reflow = (element) => {
  element.offsetHeight;
};
var getjQuery = () => {
  if (window.jQuery && !document.body.hasAttribute("data-bs-no-jquery")) {
    return window.jQuery;
  }
  return null;
};
var DOMContentLoadedCallbacks = [];
var onDOMContentLoaded = (callback) => {
  if (document.readyState === "loading") {
    if (!DOMContentLoadedCallbacks.length) {
      document.addEventListener("DOMContentLoaded", () => {
        for (const callback2 of DOMContentLoadedCallbacks) {
          callback2();
        }
      });
    }
    DOMContentLoadedCallbacks.push(callback);
  } else {
    callback();
  }
};
var isRTL = () => document.documentElement.dir === "rtl";
var defineJQueryPlugin = (plugin) => {
  onDOMContentLoaded(() => {
    const $3 = getjQuery();
    if ($3) {
      const name = plugin.NAME;
      const JQUERY_NO_CONFLICT = $3.fn[name];
      $3.fn[name] = plugin.jQueryInterface;
      $3.fn[name].Constructor = plugin;
      $3.fn[name].noConflict = () => {
        $3.fn[name] = JQUERY_NO_CONFLICT;
        return plugin.jQueryInterface;
      };
    }
  });
};
var execute = (possibleCallback, args = [], defaultValue = possibleCallback) => {
  return typeof possibleCallback === "function" ? possibleCallback.call(...args) : defaultValue;
};
var executeAfterTransition = (callback, transitionElement, waitForTransition = true) => {
  if (!waitForTransition) {
    execute(callback);
    return;
  }
  const durationPadding = 5;
  const emulatedDuration = getTransitionDurationFromElement(transitionElement) + durationPadding;
  let called = false;
  const handler = ({
    target
  }) => {
    if (target !== transitionElement) {
      return;
    }
    called = true;
    transitionElement.removeEventListener(TRANSITION_END, handler);
    execute(callback);
  };
  transitionElement.addEventListener(TRANSITION_END, handler);
  setTimeout(() => {
    if (!called) {
      triggerTransitionEnd(transitionElement);
    }
  }, emulatedDuration);
};
var getNextActiveElement = (list, activeElement, shouldGetNext, isCycleAllowed) => {
  const listLength = list.length;
  let index = list.indexOf(activeElement);
  if (index === -1) {
    return !shouldGetNext && isCycleAllowed ? list[listLength - 1] : list[0];
  }
  index += shouldGetNext ? 1 : -1;
  if (isCycleAllowed) {
    index = (index + listLength) % listLength;
  }
  return list[Math.max(0, Math.min(index, listLength - 1))];
};
var namespaceRegex = /[^.]*(?=\..*)\.|.*/;
var stripNameRegex = /\..*/;
var stripUidRegex = /::\d+$/;
var eventRegistry = {};
var uidEvent = 1;
var customEvents = {
  mouseenter: "mouseover",
  mouseleave: "mouseout"
};
var nativeEvents = /* @__PURE__ */ new Set(["click", "dblclick", "mouseup", "mousedown", "contextmenu", "mousewheel", "DOMMouseScroll", "mouseover", "mouseout", "mousemove", "selectstart", "selectend", "keydown", "keypress", "keyup", "orientationchange", "touchstart", "touchmove", "touchend", "touchcancel", "pointerdown", "pointermove", "pointerup", "pointerleave", "pointercancel", "gesturestart", "gesturechange", "gestureend", "focus", "blur", "change", "reset", "select", "submit", "focusin", "focusout", "load", "unload", "beforeunload", "resize", "move", "DOMContentLoaded", "readystatechange", "error", "abort", "scroll"]);
function makeEventUid(element, uid) {
  return uid && `${uid}::${uidEvent++}` || element.uidEvent || uidEvent++;
}
function getElementEvents(element) {
  const uid = makeEventUid(element);
  element.uidEvent = uid;
  eventRegistry[uid] = eventRegistry[uid] || {};
  return eventRegistry[uid];
}
function bootstrapHandler(element, fn2) {
  return function handler(event) {
    hydrateObj(event, {
      delegateTarget: element
    });
    if (handler.oneOff) {
      EventHandler.off(element, event.type, fn2);
    }
    return fn2.apply(element, [event]);
  };
}
function bootstrapDelegationHandler(element, selector, fn2) {
  return function handler(event) {
    const domElements = element.querySelectorAll(selector);
    for (let {
      target
    } = event; target && target !== this; target = target.parentNode) {
      for (const domElement of domElements) {
        if (domElement !== target) {
          continue;
        }
        hydrateObj(event, {
          delegateTarget: target
        });
        if (handler.oneOff) {
          EventHandler.off(element, event.type, selector, fn2);
        }
        return fn2.apply(target, [event]);
      }
    }
  };
}
function findHandler(events, callable, delegationSelector = null) {
  return Object.values(events).find((event) => event.callable === callable && event.delegationSelector === delegationSelector);
}
function normalizeParameters(originalTypeEvent, handler, delegationFunction) {
  const isDelegated = typeof handler === "string";
  const callable = isDelegated ? delegationFunction : handler || delegationFunction;
  let typeEvent = getTypeEvent(originalTypeEvent);
  if (!nativeEvents.has(typeEvent)) {
    typeEvent = originalTypeEvent;
  }
  return [isDelegated, callable, typeEvent];
}
function addHandler(element, originalTypeEvent, handler, delegationFunction, oneOff) {
  if (typeof originalTypeEvent !== "string" || !element) {
    return;
  }
  let [isDelegated, callable, typeEvent] = normalizeParameters(originalTypeEvent, handler, delegationFunction);
  if (originalTypeEvent in customEvents) {
    const wrapFunction = (fn3) => {
      return function(event) {
        if (!event.relatedTarget || event.relatedTarget !== event.delegateTarget && !event.delegateTarget.contains(event.relatedTarget)) {
          return fn3.call(this, event);
        }
      };
    };
    callable = wrapFunction(callable);
  }
  const events = getElementEvents(element);
  const handlers = events[typeEvent] || (events[typeEvent] = {});
  const previousFunction = findHandler(handlers, callable, isDelegated ? handler : null);
  if (previousFunction) {
    previousFunction.oneOff = previousFunction.oneOff && oneOff;
    return;
  }
  const uid = makeEventUid(callable, originalTypeEvent.replace(namespaceRegex, ""));
  const fn2 = isDelegated ? bootstrapDelegationHandler(element, handler, callable) : bootstrapHandler(element, callable);
  fn2.delegationSelector = isDelegated ? handler : null;
  fn2.callable = callable;
  fn2.oneOff = oneOff;
  fn2.uidEvent = uid;
  handlers[uid] = fn2;
  element.addEventListener(typeEvent, fn2, isDelegated);
}
function removeHandler(element, events, typeEvent, handler, delegationSelector) {
  const fn2 = findHandler(events[typeEvent], handler, delegationSelector);
  if (!fn2) {
    return;
  }
  element.removeEventListener(typeEvent, fn2, Boolean(delegationSelector));
  delete events[typeEvent][fn2.uidEvent];
}
function removeNamespacedHandlers(element, events, typeEvent, namespace) {
  const storeElementEvent = events[typeEvent] || {};
  for (const [handlerKey, event] of Object.entries(storeElementEvent)) {
    if (handlerKey.includes(namespace)) {
      removeHandler(element, events, typeEvent, event.callable, event.delegationSelector);
    }
  }
}
function getTypeEvent(event) {
  event = event.replace(stripNameRegex, "");
  return customEvents[event] || event;
}
var EventHandler = {
  on(element, event, handler, delegationFunction) {
    addHandler(element, event, handler, delegationFunction, false);
  },
  one(element, event, handler, delegationFunction) {
    addHandler(element, event, handler, delegationFunction, true);
  },
  off(element, originalTypeEvent, handler, delegationFunction) {
    if (typeof originalTypeEvent !== "string" || !element) {
      return;
    }
    const [isDelegated, callable, typeEvent] = normalizeParameters(originalTypeEvent, handler, delegationFunction);
    const inNamespace = typeEvent !== originalTypeEvent;
    const events = getElementEvents(element);
    const storeElementEvent = events[typeEvent] || {};
    const isNamespace = originalTypeEvent.startsWith(".");
    if (typeof callable !== "undefined") {
      if (!Object.keys(storeElementEvent).length) {
        return;
      }
      removeHandler(element, events, typeEvent, callable, isDelegated ? handler : null);
      return;
    }
    if (isNamespace) {
      for (const elementEvent of Object.keys(events)) {
        removeNamespacedHandlers(element, events, elementEvent, originalTypeEvent.slice(1));
      }
    }
    for (const [keyHandlers, event] of Object.entries(storeElementEvent)) {
      const handlerKey = keyHandlers.replace(stripUidRegex, "");
      if (!inNamespace || originalTypeEvent.includes(handlerKey)) {
        removeHandler(element, events, typeEvent, event.callable, event.delegationSelector);
      }
    }
  },
  trigger(element, event, args) {
    if (typeof event !== "string" || !element) {
      return null;
    }
    const $3 = getjQuery();
    const typeEvent = getTypeEvent(event);
    const inNamespace = event !== typeEvent;
    let jQueryEvent = null;
    let bubbles = true;
    let nativeDispatch = true;
    let defaultPrevented = false;
    if (inNamespace && $3) {
      jQueryEvent = $3.Event(event, args);
      $3(element).trigger(jQueryEvent);
      bubbles = !jQueryEvent.isPropagationStopped();
      nativeDispatch = !jQueryEvent.isImmediatePropagationStopped();
      defaultPrevented = jQueryEvent.isDefaultPrevented();
    }
    const evt = hydrateObj(new Event(event, {
      bubbles,
      cancelable: true
    }), args);
    if (defaultPrevented) {
      evt.preventDefault();
    }
    if (nativeDispatch) {
      element.dispatchEvent(evt);
    }
    if (evt.defaultPrevented && jQueryEvent) {
      jQueryEvent.preventDefault();
    }
    return evt;
  }
};
function hydrateObj(obj, meta = {}) {
  for (const [key, value] of Object.entries(meta)) {
    try {
      obj[key] = value;
    } catch (_unused) {
      Object.defineProperty(obj, key, {
        configurable: true,
        get() {
          return value;
        }
      });
    }
  }
  return obj;
}
function normalizeData(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value === Number(value).toString()) {
    return Number(value);
  }
  if (value === "" || value === "null") {
    return null;
  }
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch (_unused) {
    return value;
  }
}
function normalizeDataKey(key) {
  return key.replace(/[A-Z]/g, (chr) => `-${chr.toLowerCase()}`);
}
var Manipulator = {
  setDataAttribute(element, key, value) {
    element.setAttribute(`data-bs-${normalizeDataKey(key)}`, value);
  },
  removeDataAttribute(element, key) {
    element.removeAttribute(`data-bs-${normalizeDataKey(key)}`);
  },
  getDataAttributes(element) {
    if (!element) {
      return {};
    }
    const attributes = {};
    const bsKeys = Object.keys(element.dataset).filter((key) => key.startsWith("bs") && !key.startsWith("bsConfig"));
    for (const key of bsKeys) {
      let pureKey = key.replace(/^bs/, "");
      pureKey = pureKey.charAt(0).toLowerCase() + pureKey.slice(1);
      attributes[pureKey] = normalizeData(element.dataset[key]);
    }
    return attributes;
  },
  getDataAttribute(element, key) {
    return normalizeData(element.getAttribute(`data-bs-${normalizeDataKey(key)}`));
  }
};
var Config = class {
  // Getters
  static get Default() {
    return {};
  }
  static get DefaultType() {
    return {};
  }
  static get NAME() {
    throw new Error('You have to implement the static method "NAME", for each component!');
  }
  _getConfig(config) {
    config = this._mergeConfigObj(config);
    config = this._configAfterMerge(config);
    this._typeCheckConfig(config);
    return config;
  }
  _configAfterMerge(config) {
    return config;
  }
  _mergeConfigObj(config, element) {
    const jsonConfig = isElement2(element) ? Manipulator.getDataAttribute(element, "config") : {};
    return {
      ...this.constructor.Default,
      ...typeof jsonConfig === "object" ? jsonConfig : {},
      ...isElement2(element) ? Manipulator.getDataAttributes(element) : {},
      ...typeof config === "object" ? config : {}
    };
  }
  _typeCheckConfig(config, configTypes = this.constructor.DefaultType) {
    for (const [property, expectedTypes] of Object.entries(configTypes)) {
      const value = config[property];
      const valueType = isElement2(value) ? "element" : toType(value);
      if (!new RegExp(expectedTypes).test(valueType)) {
        throw new TypeError(`${this.constructor.NAME.toUpperCase()}: Option "${property}" provided type "${valueType}" but expected type "${expectedTypes}".`);
      }
    }
  }
};
var VERSION = "5.3.8";
var BaseComponent = class extends Config {
  constructor(element, config) {
    super();
    element = getElement(element);
    if (!element) {
      return;
    }
    this._element = element;
    this._config = this._getConfig(config);
    Data.set(this._element, this.constructor.DATA_KEY, this);
  }
  // Public
  dispose() {
    Data.remove(this._element, this.constructor.DATA_KEY);
    EventHandler.off(this._element, this.constructor.EVENT_KEY);
    for (const propertyName of Object.getOwnPropertyNames(this)) {
      this[propertyName] = null;
    }
  }
  // Private
  _queueCallback(callback, element, isAnimated = true) {
    executeAfterTransition(callback, element, isAnimated);
  }
  _getConfig(config) {
    config = this._mergeConfigObj(config, this._element);
    config = this._configAfterMerge(config);
    this._typeCheckConfig(config);
    return config;
  }
  // Static
  static getInstance(element) {
    return Data.get(getElement(element), this.DATA_KEY);
  }
  static getOrCreateInstance(element, config = {}) {
    return this.getInstance(element) || new this(element, typeof config === "object" ? config : null);
  }
  static get VERSION() {
    return VERSION;
  }
  static get DATA_KEY() {
    return `bs.${this.NAME}`;
  }
  static get EVENT_KEY() {
    return `.${this.DATA_KEY}`;
  }
  static eventName(name) {
    return `${name}${this.EVENT_KEY}`;
  }
};
var getSelector = (element) => {
  let selector = element.getAttribute("data-bs-target");
  if (!selector || selector === "#") {
    let hrefAttribute = element.getAttribute("href");
    if (!hrefAttribute || !hrefAttribute.includes("#") && !hrefAttribute.startsWith(".")) {
      return null;
    }
    if (hrefAttribute.includes("#") && !hrefAttribute.startsWith("#")) {
      hrefAttribute = `#${hrefAttribute.split("#")[1]}`;
    }
    selector = hrefAttribute && hrefAttribute !== "#" ? hrefAttribute.trim() : null;
  }
  return selector ? selector.split(",").map((sel) => parseSelector(sel)).join(",") : null;
};
var SelectorEngine = {
  find(selector, element = document.documentElement) {
    return [].concat(...Element.prototype.querySelectorAll.call(element, selector));
  },
  findOne(selector, element = document.documentElement) {
    return Element.prototype.querySelector.call(element, selector);
  },
  children(element, selector) {
    return [].concat(...element.children).filter((child) => child.matches(selector));
  },
  parents(element, selector) {
    const parents = [];
    let ancestor = element.parentNode.closest(selector);
    while (ancestor) {
      parents.push(ancestor);
      ancestor = ancestor.parentNode.closest(selector);
    }
    return parents;
  },
  prev(element, selector) {
    let previous = element.previousElementSibling;
    while (previous) {
      if (previous.matches(selector)) {
        return [previous];
      }
      previous = previous.previousElementSibling;
    }
    return [];
  },
  // TODO: this is now unused; remove later along with prev()
  next(element, selector) {
    let next = element.nextElementSibling;
    while (next) {
      if (next.matches(selector)) {
        return [next];
      }
      next = next.nextElementSibling;
    }
    return [];
  },
  focusableChildren(element) {
    const focusables = ["a", "button", "input", "textarea", "select", "details", "[tabindex]", '[contenteditable="true"]'].map((selector) => `${selector}:not([tabindex^="-"])`).join(",");
    return this.find(focusables, element).filter((el) => !isDisabled(el) && isVisible(el));
  },
  getSelectorFromElement(element) {
    const selector = getSelector(element);
    if (selector) {
      return SelectorEngine.findOne(selector) ? selector : null;
    }
    return null;
  },
  getElementFromSelector(element) {
    const selector = getSelector(element);
    return selector ? SelectorEngine.findOne(selector) : null;
  },
  getMultipleElementsFromSelector(element) {
    const selector = getSelector(element);
    return selector ? SelectorEngine.find(selector) : [];
  }
};
var enableDismissTrigger = (component, method = "hide") => {
  const clickEvent = `click.dismiss${component.EVENT_KEY}`;
  const name = component.NAME;
  EventHandler.on(document, clickEvent, `[data-bs-dismiss="${name}"]`, function(event) {
    if (["A", "AREA"].includes(this.tagName)) {
      event.preventDefault();
    }
    if (isDisabled(this)) {
      return;
    }
    const target = SelectorEngine.getElementFromSelector(this) || this.closest(`.${name}`);
    const instance = component.getOrCreateInstance(target);
    instance[method]();
  });
};
var NAME$f = "alert";
var DATA_KEY$a = "bs.alert";
var EVENT_KEY$b = `.${DATA_KEY$a}`;
var EVENT_CLOSE = `close${EVENT_KEY$b}`;
var EVENT_CLOSED = `closed${EVENT_KEY$b}`;
var CLASS_NAME_FADE$5 = "fade";
var CLASS_NAME_SHOW$8 = "show";
var Alert = class _Alert extends BaseComponent {
  // Getters
  static get NAME() {
    return NAME$f;
  }
  // Public
  close() {
    const closeEvent = EventHandler.trigger(this._element, EVENT_CLOSE);
    if (closeEvent.defaultPrevented) {
      return;
    }
    this._element.classList.remove(CLASS_NAME_SHOW$8);
    const isAnimated = this._element.classList.contains(CLASS_NAME_FADE$5);
    this._queueCallback(() => this._destroyElement(), this._element, isAnimated);
  }
  // Private
  _destroyElement() {
    this._element.remove();
    EventHandler.trigger(this._element, EVENT_CLOSED);
    this.dispose();
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _Alert.getOrCreateInstance(this);
      if (typeof config !== "string") {
        return;
      }
      if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
        throw new TypeError(`No method named "${config}"`);
      }
      data[config](this);
    });
  }
};
enableDismissTrigger(Alert, "close");
defineJQueryPlugin(Alert);
var NAME$e = "button";
var DATA_KEY$9 = "bs.button";
var EVENT_KEY$a = `.${DATA_KEY$9}`;
var DATA_API_KEY$6 = ".data-api";
var CLASS_NAME_ACTIVE$3 = "active";
var SELECTOR_DATA_TOGGLE$5 = '[data-bs-toggle="button"]';
var EVENT_CLICK_DATA_API$6 = `click${EVENT_KEY$a}${DATA_API_KEY$6}`;
var Button = class _Button extends BaseComponent {
  // Getters
  static get NAME() {
    return NAME$e;
  }
  // Public
  toggle() {
    this._element.setAttribute("aria-pressed", this._element.classList.toggle(CLASS_NAME_ACTIVE$3));
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _Button.getOrCreateInstance(this);
      if (config === "toggle") {
        data[config]();
      }
    });
  }
};
EventHandler.on(document, EVENT_CLICK_DATA_API$6, SELECTOR_DATA_TOGGLE$5, (event) => {
  event.preventDefault();
  const button = event.target.closest(SELECTOR_DATA_TOGGLE$5);
  const data = Button.getOrCreateInstance(button);
  data.toggle();
});
defineJQueryPlugin(Button);
var NAME$d = "swipe";
var EVENT_KEY$9 = ".bs.swipe";
var EVENT_TOUCHSTART = `touchstart${EVENT_KEY$9}`;
var EVENT_TOUCHMOVE = `touchmove${EVENT_KEY$9}`;
var EVENT_TOUCHEND = `touchend${EVENT_KEY$9}`;
var EVENT_POINTERDOWN = `pointerdown${EVENT_KEY$9}`;
var EVENT_POINTERUP = `pointerup${EVENT_KEY$9}`;
var POINTER_TYPE_TOUCH = "touch";
var POINTER_TYPE_PEN = "pen";
var CLASS_NAME_POINTER_EVENT = "pointer-event";
var SWIPE_THRESHOLD = 40;
var Default$c = {
  endCallback: null,
  leftCallback: null,
  rightCallback: null
};
var DefaultType$c = {
  endCallback: "(function|null)",
  leftCallback: "(function|null)",
  rightCallback: "(function|null)"
};
var Swipe = class _Swipe extends Config {
  constructor(element, config) {
    super();
    this._element = element;
    if (!element || !_Swipe.isSupported()) {
      return;
    }
    this._config = this._getConfig(config);
    this._deltaX = 0;
    this._supportPointerEvents = Boolean(window.PointerEvent);
    this._initEvents();
  }
  // Getters
  static get Default() {
    return Default$c;
  }
  static get DefaultType() {
    return DefaultType$c;
  }
  static get NAME() {
    return NAME$d;
  }
  // Public
  dispose() {
    EventHandler.off(this._element, EVENT_KEY$9);
  }
  // Private
  _start(event) {
    if (!this._supportPointerEvents) {
      this._deltaX = event.touches[0].clientX;
      return;
    }
    if (this._eventIsPointerPenTouch(event)) {
      this._deltaX = event.clientX;
    }
  }
  _end(event) {
    if (this._eventIsPointerPenTouch(event)) {
      this._deltaX = event.clientX - this._deltaX;
    }
    this._handleSwipe();
    execute(this._config.endCallback);
  }
  _move(event) {
    this._deltaX = event.touches && event.touches.length > 1 ? 0 : event.touches[0].clientX - this._deltaX;
  }
  _handleSwipe() {
    const absDeltaX = Math.abs(this._deltaX);
    if (absDeltaX <= SWIPE_THRESHOLD) {
      return;
    }
    const direction = absDeltaX / this._deltaX;
    this._deltaX = 0;
    if (!direction) {
      return;
    }
    execute(direction > 0 ? this._config.rightCallback : this._config.leftCallback);
  }
  _initEvents() {
    if (this._supportPointerEvents) {
      EventHandler.on(this._element, EVENT_POINTERDOWN, (event) => this._start(event));
      EventHandler.on(this._element, EVENT_POINTERUP, (event) => this._end(event));
      this._element.classList.add(CLASS_NAME_POINTER_EVENT);
    } else {
      EventHandler.on(this._element, EVENT_TOUCHSTART, (event) => this._start(event));
      EventHandler.on(this._element, EVENT_TOUCHMOVE, (event) => this._move(event));
      EventHandler.on(this._element, EVENT_TOUCHEND, (event) => this._end(event));
    }
  }
  _eventIsPointerPenTouch(event) {
    return this._supportPointerEvents && (event.pointerType === POINTER_TYPE_PEN || event.pointerType === POINTER_TYPE_TOUCH);
  }
  // Static
  static isSupported() {
    return "ontouchstart" in document.documentElement || navigator.maxTouchPoints > 0;
  }
};
var NAME$c = "carousel";
var DATA_KEY$8 = "bs.carousel";
var EVENT_KEY$8 = `.${DATA_KEY$8}`;
var DATA_API_KEY$5 = ".data-api";
var ARROW_LEFT_KEY$1 = "ArrowLeft";
var ARROW_RIGHT_KEY$1 = "ArrowRight";
var TOUCHEVENT_COMPAT_WAIT = 500;
var ORDER_NEXT = "next";
var ORDER_PREV = "prev";
var DIRECTION_LEFT = "left";
var DIRECTION_RIGHT = "right";
var EVENT_SLIDE = `slide${EVENT_KEY$8}`;
var EVENT_SLID = `slid${EVENT_KEY$8}`;
var EVENT_KEYDOWN$1 = `keydown${EVENT_KEY$8}`;
var EVENT_MOUSEENTER$1 = `mouseenter${EVENT_KEY$8}`;
var EVENT_MOUSELEAVE$1 = `mouseleave${EVENT_KEY$8}`;
var EVENT_DRAG_START = `dragstart${EVENT_KEY$8}`;
var EVENT_LOAD_DATA_API$3 = `load${EVENT_KEY$8}${DATA_API_KEY$5}`;
var EVENT_CLICK_DATA_API$5 = `click${EVENT_KEY$8}${DATA_API_KEY$5}`;
var CLASS_NAME_CAROUSEL = "carousel";
var CLASS_NAME_ACTIVE$2 = "active";
var CLASS_NAME_SLIDE = "slide";
var CLASS_NAME_END = "carousel-item-end";
var CLASS_NAME_START = "carousel-item-start";
var CLASS_NAME_NEXT = "carousel-item-next";
var CLASS_NAME_PREV = "carousel-item-prev";
var SELECTOR_ACTIVE = ".active";
var SELECTOR_ITEM = ".carousel-item";
var SELECTOR_ACTIVE_ITEM = SELECTOR_ACTIVE + SELECTOR_ITEM;
var SELECTOR_ITEM_IMG = ".carousel-item img";
var SELECTOR_INDICATORS = ".carousel-indicators";
var SELECTOR_DATA_SLIDE = "[data-bs-slide], [data-bs-slide-to]";
var SELECTOR_DATA_RIDE = '[data-bs-ride="carousel"]';
var KEY_TO_DIRECTION = {
  [ARROW_LEFT_KEY$1]: DIRECTION_RIGHT,
  [ARROW_RIGHT_KEY$1]: DIRECTION_LEFT
};
var Default$b = {
  interval: 5e3,
  keyboard: true,
  pause: "hover",
  ride: false,
  touch: true,
  wrap: true
};
var DefaultType$b = {
  interval: "(number|boolean)",
  // TODO:v6 remove boolean support
  keyboard: "boolean",
  pause: "(string|boolean)",
  ride: "(boolean|string)",
  touch: "boolean",
  wrap: "boolean"
};
var Carousel = class _Carousel extends BaseComponent {
  constructor(element, config) {
    super(element, config);
    this._interval = null;
    this._activeElement = null;
    this._isSliding = false;
    this.touchTimeout = null;
    this._swipeHelper = null;
    this._indicatorsElement = SelectorEngine.findOne(SELECTOR_INDICATORS, this._element);
    this._addEventListeners();
    if (this._config.ride === CLASS_NAME_CAROUSEL) {
      this.cycle();
    }
  }
  // Getters
  static get Default() {
    return Default$b;
  }
  static get DefaultType() {
    return DefaultType$b;
  }
  static get NAME() {
    return NAME$c;
  }
  // Public
  next() {
    this._slide(ORDER_NEXT);
  }
  nextWhenVisible() {
    if (!document.hidden && isVisible(this._element)) {
      this.next();
    }
  }
  prev() {
    this._slide(ORDER_PREV);
  }
  pause() {
    if (this._isSliding) {
      triggerTransitionEnd(this._element);
    }
    this._clearInterval();
  }
  cycle() {
    this._clearInterval();
    this._updateInterval();
    this._interval = setInterval(() => this.nextWhenVisible(), this._config.interval);
  }
  _maybeEnableCycle() {
    if (!this._config.ride) {
      return;
    }
    if (this._isSliding) {
      EventHandler.one(this._element, EVENT_SLID, () => this.cycle());
      return;
    }
    this.cycle();
  }
  to(index) {
    const items = this._getItems();
    if (index > items.length - 1 || index < 0) {
      return;
    }
    if (this._isSliding) {
      EventHandler.one(this._element, EVENT_SLID, () => this.to(index));
      return;
    }
    const activeIndex = this._getItemIndex(this._getActive());
    if (activeIndex === index) {
      return;
    }
    const order2 = index > activeIndex ? ORDER_NEXT : ORDER_PREV;
    this._slide(order2, items[index]);
  }
  dispose() {
    if (this._swipeHelper) {
      this._swipeHelper.dispose();
    }
    super.dispose();
  }
  // Private
  _configAfterMerge(config) {
    config.defaultInterval = config.interval;
    return config;
  }
  _addEventListeners() {
    if (this._config.keyboard) {
      EventHandler.on(this._element, EVENT_KEYDOWN$1, (event) => this._keydown(event));
    }
    if (this._config.pause === "hover") {
      EventHandler.on(this._element, EVENT_MOUSEENTER$1, () => this.pause());
      EventHandler.on(this._element, EVENT_MOUSELEAVE$1, () => this._maybeEnableCycle());
    }
    if (this._config.touch && Swipe.isSupported()) {
      this._addTouchEventListeners();
    }
  }
  _addTouchEventListeners() {
    for (const img of SelectorEngine.find(SELECTOR_ITEM_IMG, this._element)) {
      EventHandler.on(img, EVENT_DRAG_START, (event) => event.preventDefault());
    }
    const endCallBack = () => {
      if (this._config.pause !== "hover") {
        return;
      }
      this.pause();
      if (this.touchTimeout) {
        clearTimeout(this.touchTimeout);
      }
      this.touchTimeout = setTimeout(() => this._maybeEnableCycle(), TOUCHEVENT_COMPAT_WAIT + this._config.interval);
    };
    const swipeConfig = {
      leftCallback: () => this._slide(this._directionToOrder(DIRECTION_LEFT)),
      rightCallback: () => this._slide(this._directionToOrder(DIRECTION_RIGHT)),
      endCallback: endCallBack
    };
    this._swipeHelper = new Swipe(this._element, swipeConfig);
  }
  _keydown(event) {
    if (/input|textarea/i.test(event.target.tagName)) {
      return;
    }
    const direction = KEY_TO_DIRECTION[event.key];
    if (direction) {
      event.preventDefault();
      this._slide(this._directionToOrder(direction));
    }
  }
  _getItemIndex(element) {
    return this._getItems().indexOf(element);
  }
  _setActiveIndicatorElement(index) {
    if (!this._indicatorsElement) {
      return;
    }
    const activeIndicator = SelectorEngine.findOne(SELECTOR_ACTIVE, this._indicatorsElement);
    activeIndicator.classList.remove(CLASS_NAME_ACTIVE$2);
    activeIndicator.removeAttribute("aria-current");
    const newActiveIndicator = SelectorEngine.findOne(`[data-bs-slide-to="${index}"]`, this._indicatorsElement);
    if (newActiveIndicator) {
      newActiveIndicator.classList.add(CLASS_NAME_ACTIVE$2);
      newActiveIndicator.setAttribute("aria-current", "true");
    }
  }
  _updateInterval() {
    const element = this._activeElement || this._getActive();
    if (!element) {
      return;
    }
    const elementInterval = Number.parseInt(element.getAttribute("data-bs-interval"), 10);
    this._config.interval = elementInterval || this._config.defaultInterval;
  }
  _slide(order2, element = null) {
    if (this._isSliding) {
      return;
    }
    const activeElement = this._getActive();
    const isNext = order2 === ORDER_NEXT;
    const nextElement = element || getNextActiveElement(this._getItems(), activeElement, isNext, this._config.wrap);
    if (nextElement === activeElement) {
      return;
    }
    const nextElementIndex = this._getItemIndex(nextElement);
    const triggerEvent = (eventName) => {
      return EventHandler.trigger(this._element, eventName, {
        relatedTarget: nextElement,
        direction: this._orderToDirection(order2),
        from: this._getItemIndex(activeElement),
        to: nextElementIndex
      });
    };
    const slideEvent = triggerEvent(EVENT_SLIDE);
    if (slideEvent.defaultPrevented) {
      return;
    }
    if (!activeElement || !nextElement) {
      return;
    }
    const isCycling = Boolean(this._interval);
    this.pause();
    this._isSliding = true;
    this._setActiveIndicatorElement(nextElementIndex);
    this._activeElement = nextElement;
    const directionalClassName = isNext ? CLASS_NAME_START : CLASS_NAME_END;
    const orderClassName = isNext ? CLASS_NAME_NEXT : CLASS_NAME_PREV;
    nextElement.classList.add(orderClassName);
    reflow(nextElement);
    activeElement.classList.add(directionalClassName);
    nextElement.classList.add(directionalClassName);
    const completeCallBack = () => {
      nextElement.classList.remove(directionalClassName, orderClassName);
      nextElement.classList.add(CLASS_NAME_ACTIVE$2);
      activeElement.classList.remove(CLASS_NAME_ACTIVE$2, orderClassName, directionalClassName);
      this._isSliding = false;
      triggerEvent(EVENT_SLID);
    };
    this._queueCallback(completeCallBack, activeElement, this._isAnimated());
    if (isCycling) {
      this.cycle();
    }
  }
  _isAnimated() {
    return this._element.classList.contains(CLASS_NAME_SLIDE);
  }
  _getActive() {
    return SelectorEngine.findOne(SELECTOR_ACTIVE_ITEM, this._element);
  }
  _getItems() {
    return SelectorEngine.find(SELECTOR_ITEM, this._element);
  }
  _clearInterval() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
  _directionToOrder(direction) {
    if (isRTL()) {
      return direction === DIRECTION_LEFT ? ORDER_PREV : ORDER_NEXT;
    }
    return direction === DIRECTION_LEFT ? ORDER_NEXT : ORDER_PREV;
  }
  _orderToDirection(order2) {
    if (isRTL()) {
      return order2 === ORDER_PREV ? DIRECTION_LEFT : DIRECTION_RIGHT;
    }
    return order2 === ORDER_PREV ? DIRECTION_RIGHT : DIRECTION_LEFT;
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _Carousel.getOrCreateInstance(this, config);
      if (typeof config === "number") {
        data.to(config);
        return;
      }
      if (typeof config === "string") {
        if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config]();
      }
    });
  }
};
EventHandler.on(document, EVENT_CLICK_DATA_API$5, SELECTOR_DATA_SLIDE, function(event) {
  const target = SelectorEngine.getElementFromSelector(this);
  if (!target || !target.classList.contains(CLASS_NAME_CAROUSEL)) {
    return;
  }
  event.preventDefault();
  const carousel = Carousel.getOrCreateInstance(target);
  const slideIndex = this.getAttribute("data-bs-slide-to");
  if (slideIndex) {
    carousel.to(slideIndex);
    carousel._maybeEnableCycle();
    return;
  }
  if (Manipulator.getDataAttribute(this, "slide") === "next") {
    carousel.next();
    carousel._maybeEnableCycle();
    return;
  }
  carousel.prev();
  carousel._maybeEnableCycle();
});
EventHandler.on(window, EVENT_LOAD_DATA_API$3, () => {
  const carousels = SelectorEngine.find(SELECTOR_DATA_RIDE);
  for (const carousel of carousels) {
    Carousel.getOrCreateInstance(carousel);
  }
});
defineJQueryPlugin(Carousel);
var NAME$b = "collapse";
var DATA_KEY$7 = "bs.collapse";
var EVENT_KEY$7 = `.${DATA_KEY$7}`;
var DATA_API_KEY$4 = ".data-api";
var EVENT_SHOW$6 = `show${EVENT_KEY$7}`;
var EVENT_SHOWN$6 = `shown${EVENT_KEY$7}`;
var EVENT_HIDE$6 = `hide${EVENT_KEY$7}`;
var EVENT_HIDDEN$6 = `hidden${EVENT_KEY$7}`;
var EVENT_CLICK_DATA_API$4 = `click${EVENT_KEY$7}${DATA_API_KEY$4}`;
var CLASS_NAME_SHOW$7 = "show";
var CLASS_NAME_COLLAPSE = "collapse";
var CLASS_NAME_COLLAPSING = "collapsing";
var CLASS_NAME_COLLAPSED = "collapsed";
var CLASS_NAME_DEEPER_CHILDREN = `:scope .${CLASS_NAME_COLLAPSE} .${CLASS_NAME_COLLAPSE}`;
var CLASS_NAME_HORIZONTAL = "collapse-horizontal";
var WIDTH = "width";
var HEIGHT = "height";
var SELECTOR_ACTIVES = ".collapse.show, .collapse.collapsing";
var SELECTOR_DATA_TOGGLE$4 = '[data-bs-toggle="collapse"]';
var Default$a = {
  parent: null,
  toggle: true
};
var DefaultType$a = {
  parent: "(null|element)",
  toggle: "boolean"
};
var Collapse = class _Collapse extends BaseComponent {
  constructor(element, config) {
    super(element, config);
    this._isTransitioning = false;
    this._triggerArray = [];
    const toggleList = SelectorEngine.find(SELECTOR_DATA_TOGGLE$4);
    for (const elem of toggleList) {
      const selector = SelectorEngine.getSelectorFromElement(elem);
      const filterElement = SelectorEngine.find(selector).filter((foundElement) => foundElement === this._element);
      if (selector !== null && filterElement.length) {
        this._triggerArray.push(elem);
      }
    }
    this._initializeChildren();
    if (!this._config.parent) {
      this._addAriaAndCollapsedClass(this._triggerArray, this._isShown());
    }
    if (this._config.toggle) {
      this.toggle();
    }
  }
  // Getters
  static get Default() {
    return Default$a;
  }
  static get DefaultType() {
    return DefaultType$a;
  }
  static get NAME() {
    return NAME$b;
  }
  // Public
  toggle() {
    if (this._isShown()) {
      this.hide();
    } else {
      this.show();
    }
  }
  show() {
    if (this._isTransitioning || this._isShown()) {
      return;
    }
    let activeChildren = [];
    if (this._config.parent) {
      activeChildren = this._getFirstLevelChildren(SELECTOR_ACTIVES).filter((element) => element !== this._element).map((element) => _Collapse.getOrCreateInstance(element, {
        toggle: false
      }));
    }
    if (activeChildren.length && activeChildren[0]._isTransitioning) {
      return;
    }
    const startEvent = EventHandler.trigger(this._element, EVENT_SHOW$6);
    if (startEvent.defaultPrevented) {
      return;
    }
    for (const activeInstance of activeChildren) {
      activeInstance.hide();
    }
    const dimension = this._getDimension();
    this._element.classList.remove(CLASS_NAME_COLLAPSE);
    this._element.classList.add(CLASS_NAME_COLLAPSING);
    this._element.style[dimension] = 0;
    this._addAriaAndCollapsedClass(this._triggerArray, true);
    this._isTransitioning = true;
    const complete = () => {
      this._isTransitioning = false;
      this._element.classList.remove(CLASS_NAME_COLLAPSING);
      this._element.classList.add(CLASS_NAME_COLLAPSE, CLASS_NAME_SHOW$7);
      this._element.style[dimension] = "";
      EventHandler.trigger(this._element, EVENT_SHOWN$6);
    };
    const capitalizedDimension = dimension[0].toUpperCase() + dimension.slice(1);
    const scrollSize = `scroll${capitalizedDimension}`;
    this._queueCallback(complete, this._element, true);
    this._element.style[dimension] = `${this._element[scrollSize]}px`;
  }
  hide() {
    if (this._isTransitioning || !this._isShown()) {
      return;
    }
    const startEvent = EventHandler.trigger(this._element, EVENT_HIDE$6);
    if (startEvent.defaultPrevented) {
      return;
    }
    const dimension = this._getDimension();
    this._element.style[dimension] = `${this._element.getBoundingClientRect()[dimension]}px`;
    reflow(this._element);
    this._element.classList.add(CLASS_NAME_COLLAPSING);
    this._element.classList.remove(CLASS_NAME_COLLAPSE, CLASS_NAME_SHOW$7);
    for (const trigger of this._triggerArray) {
      const element = SelectorEngine.getElementFromSelector(trigger);
      if (element && !this._isShown(element)) {
        this._addAriaAndCollapsedClass([trigger], false);
      }
    }
    this._isTransitioning = true;
    const complete = () => {
      this._isTransitioning = false;
      this._element.classList.remove(CLASS_NAME_COLLAPSING);
      this._element.classList.add(CLASS_NAME_COLLAPSE);
      EventHandler.trigger(this._element, EVENT_HIDDEN$6);
    };
    this._element.style[dimension] = "";
    this._queueCallback(complete, this._element, true);
  }
  // Private
  _isShown(element = this._element) {
    return element.classList.contains(CLASS_NAME_SHOW$7);
  }
  _configAfterMerge(config) {
    config.toggle = Boolean(config.toggle);
    config.parent = getElement(config.parent);
    return config;
  }
  _getDimension() {
    return this._element.classList.contains(CLASS_NAME_HORIZONTAL) ? WIDTH : HEIGHT;
  }
  _initializeChildren() {
    if (!this._config.parent) {
      return;
    }
    const children = this._getFirstLevelChildren(SELECTOR_DATA_TOGGLE$4);
    for (const element of children) {
      const selected = SelectorEngine.getElementFromSelector(element);
      if (selected) {
        this._addAriaAndCollapsedClass([element], this._isShown(selected));
      }
    }
  }
  _getFirstLevelChildren(selector) {
    const children = SelectorEngine.find(CLASS_NAME_DEEPER_CHILDREN, this._config.parent);
    return SelectorEngine.find(selector, this._config.parent).filter((element) => !children.includes(element));
  }
  _addAriaAndCollapsedClass(triggerArray, isOpen) {
    if (!triggerArray.length) {
      return;
    }
    for (const element of triggerArray) {
      element.classList.toggle(CLASS_NAME_COLLAPSED, !isOpen);
      element.setAttribute("aria-expanded", isOpen);
    }
  }
  // Static
  static jQueryInterface(config) {
    const _config = {};
    if (typeof config === "string" && /show|hide/.test(config)) {
      _config.toggle = false;
    }
    return this.each(function() {
      const data = _Collapse.getOrCreateInstance(this, _config);
      if (typeof config === "string") {
        if (typeof data[config] === "undefined") {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config]();
      }
    });
  }
};
EventHandler.on(document, EVENT_CLICK_DATA_API$4, SELECTOR_DATA_TOGGLE$4, function(event) {
  if (event.target.tagName === "A" || event.delegateTarget && event.delegateTarget.tagName === "A") {
    event.preventDefault();
  }
  for (const element of SelectorEngine.getMultipleElementsFromSelector(this)) {
    Collapse.getOrCreateInstance(element, {
      toggle: false
    }).toggle();
  }
});
defineJQueryPlugin(Collapse);
var NAME$a = "dropdown";
var DATA_KEY$6 = "bs.dropdown";
var EVENT_KEY$6 = `.${DATA_KEY$6}`;
var DATA_API_KEY$3 = ".data-api";
var ESCAPE_KEY$2 = "Escape";
var TAB_KEY$1 = "Tab";
var ARROW_UP_KEY$1 = "ArrowUp";
var ARROW_DOWN_KEY$1 = "ArrowDown";
var RIGHT_MOUSE_BUTTON = 2;
var EVENT_HIDE$5 = `hide${EVENT_KEY$6}`;
var EVENT_HIDDEN$5 = `hidden${EVENT_KEY$6}`;
var EVENT_SHOW$5 = `show${EVENT_KEY$6}`;
var EVENT_SHOWN$5 = `shown${EVENT_KEY$6}`;
var EVENT_CLICK_DATA_API$3 = `click${EVENT_KEY$6}${DATA_API_KEY$3}`;
var EVENT_KEYDOWN_DATA_API = `keydown${EVENT_KEY$6}${DATA_API_KEY$3}`;
var EVENT_KEYUP_DATA_API = `keyup${EVENT_KEY$6}${DATA_API_KEY$3}`;
var CLASS_NAME_SHOW$6 = "show";
var CLASS_NAME_DROPUP = "dropup";
var CLASS_NAME_DROPEND = "dropend";
var CLASS_NAME_DROPSTART = "dropstart";
var CLASS_NAME_DROPUP_CENTER = "dropup-center";
var CLASS_NAME_DROPDOWN_CENTER = "dropdown-center";
var SELECTOR_DATA_TOGGLE$3 = '[data-bs-toggle="dropdown"]:not(.disabled):not(:disabled)';
var SELECTOR_DATA_TOGGLE_SHOWN = `${SELECTOR_DATA_TOGGLE$3}.${CLASS_NAME_SHOW$6}`;
var SELECTOR_MENU = ".dropdown-menu";
var SELECTOR_NAVBAR = ".navbar";
var SELECTOR_NAVBAR_NAV = ".navbar-nav";
var SELECTOR_VISIBLE_ITEMS = ".dropdown-menu .dropdown-item:not(.disabled):not(:disabled)";
var PLACEMENT_TOP = isRTL() ? "top-end" : "top-start";
var PLACEMENT_TOPEND = isRTL() ? "top-start" : "top-end";
var PLACEMENT_BOTTOM = isRTL() ? "bottom-end" : "bottom-start";
var PLACEMENT_BOTTOMEND = isRTL() ? "bottom-start" : "bottom-end";
var PLACEMENT_RIGHT = isRTL() ? "left-start" : "right-start";
var PLACEMENT_LEFT = isRTL() ? "right-start" : "left-start";
var PLACEMENT_TOPCENTER = "top";
var PLACEMENT_BOTTOMCENTER = "bottom";
var Default$9 = {
  autoClose: true,
  boundary: "clippingParents",
  display: "dynamic",
  offset: [0, 2],
  popperConfig: null,
  reference: "toggle"
};
var DefaultType$9 = {
  autoClose: "(boolean|string)",
  boundary: "(string|element)",
  display: "string",
  offset: "(array|string|function)",
  popperConfig: "(null|object|function)",
  reference: "(string|element|object)"
};
var Dropdown = class _Dropdown extends BaseComponent {
  constructor(element, config) {
    super(element, config);
    this._popper = null;
    this._parent = this._element.parentNode;
    this._menu = SelectorEngine.next(this._element, SELECTOR_MENU)[0] || SelectorEngine.prev(this._element, SELECTOR_MENU)[0] || SelectorEngine.findOne(SELECTOR_MENU, this._parent);
    this._inNavbar = this._detectNavbar();
  }
  // Getters
  static get Default() {
    return Default$9;
  }
  static get DefaultType() {
    return DefaultType$9;
  }
  static get NAME() {
    return NAME$a;
  }
  // Public
  toggle() {
    return this._isShown() ? this.hide() : this.show();
  }
  show() {
    if (isDisabled(this._element) || this._isShown()) {
      return;
    }
    const relatedTarget = {
      relatedTarget: this._element
    };
    const showEvent = EventHandler.trigger(this._element, EVENT_SHOW$5, relatedTarget);
    if (showEvent.defaultPrevented) {
      return;
    }
    this._createPopper();
    if ("ontouchstart" in document.documentElement && !this._parent.closest(SELECTOR_NAVBAR_NAV)) {
      for (const element of [].concat(...document.body.children)) {
        EventHandler.on(element, "mouseover", noop);
      }
    }
    this._element.focus();
    this._element.setAttribute("aria-expanded", true);
    this._menu.classList.add(CLASS_NAME_SHOW$6);
    this._element.classList.add(CLASS_NAME_SHOW$6);
    EventHandler.trigger(this._element, EVENT_SHOWN$5, relatedTarget);
  }
  hide() {
    if (isDisabled(this._element) || !this._isShown()) {
      return;
    }
    const relatedTarget = {
      relatedTarget: this._element
    };
    this._completeHide(relatedTarget);
  }
  dispose() {
    if (this._popper) {
      this._popper.destroy();
    }
    super.dispose();
  }
  update() {
    this._inNavbar = this._detectNavbar();
    if (this._popper) {
      this._popper.update();
    }
  }
  // Private
  _completeHide(relatedTarget) {
    const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE$5, relatedTarget);
    if (hideEvent.defaultPrevented) {
      return;
    }
    if ("ontouchstart" in document.documentElement) {
      for (const element of [].concat(...document.body.children)) {
        EventHandler.off(element, "mouseover", noop);
      }
    }
    if (this._popper) {
      this._popper.destroy();
    }
    this._menu.classList.remove(CLASS_NAME_SHOW$6);
    this._element.classList.remove(CLASS_NAME_SHOW$6);
    this._element.setAttribute("aria-expanded", "false");
    Manipulator.removeDataAttribute(this._menu, "popper");
    EventHandler.trigger(this._element, EVENT_HIDDEN$5, relatedTarget);
  }
  _getConfig(config) {
    config = super._getConfig(config);
    if (typeof config.reference === "object" && !isElement2(config.reference) && typeof config.reference.getBoundingClientRect !== "function") {
      throw new TypeError(`${NAME$a.toUpperCase()}: Option "reference" provided type "object" without a required "getBoundingClientRect" method.`);
    }
    return config;
  }
  _createPopper() {
    if (typeof lib_exports === "undefined") {
      throw new TypeError("Bootstrap's dropdowns require Popper (https://popper.js.org/docs/v2/)");
    }
    let referenceElement = this._element;
    if (this._config.reference === "parent") {
      referenceElement = this._parent;
    } else if (isElement2(this._config.reference)) {
      referenceElement = getElement(this._config.reference);
    } else if (typeof this._config.reference === "object") {
      referenceElement = this._config.reference;
    }
    const popperConfig = this._getPopperConfig();
    this._popper = createPopper3(referenceElement, this._menu, popperConfig);
  }
  _isShown() {
    return this._menu.classList.contains(CLASS_NAME_SHOW$6);
  }
  _getPlacement() {
    const parentDropdown = this._parent;
    if (parentDropdown.classList.contains(CLASS_NAME_DROPEND)) {
      return PLACEMENT_RIGHT;
    }
    if (parentDropdown.classList.contains(CLASS_NAME_DROPSTART)) {
      return PLACEMENT_LEFT;
    }
    if (parentDropdown.classList.contains(CLASS_NAME_DROPUP_CENTER)) {
      return PLACEMENT_TOPCENTER;
    }
    if (parentDropdown.classList.contains(CLASS_NAME_DROPDOWN_CENTER)) {
      return PLACEMENT_BOTTOMCENTER;
    }
    const isEnd = getComputedStyle(this._menu).getPropertyValue("--bs-position").trim() === "end";
    if (parentDropdown.classList.contains(CLASS_NAME_DROPUP)) {
      return isEnd ? PLACEMENT_TOPEND : PLACEMENT_TOP;
    }
    return isEnd ? PLACEMENT_BOTTOMEND : PLACEMENT_BOTTOM;
  }
  _detectNavbar() {
    return this._element.closest(SELECTOR_NAVBAR) !== null;
  }
  _getOffset() {
    const {
      offset: offset2
    } = this._config;
    if (typeof offset2 === "string") {
      return offset2.split(",").map((value) => Number.parseInt(value, 10));
    }
    if (typeof offset2 === "function") {
      return (popperData) => offset2(popperData, this._element);
    }
    return offset2;
  }
  _getPopperConfig() {
    const defaultBsPopperConfig = {
      placement: this._getPlacement(),
      modifiers: [{
        name: "preventOverflow",
        options: {
          boundary: this._config.boundary
        }
      }, {
        name: "offset",
        options: {
          offset: this._getOffset()
        }
      }]
    };
    if (this._inNavbar || this._config.display === "static") {
      Manipulator.setDataAttribute(this._menu, "popper", "static");
      defaultBsPopperConfig.modifiers = [{
        name: "applyStyles",
        enabled: false
      }];
    }
    return {
      ...defaultBsPopperConfig,
      ...execute(this._config.popperConfig, [void 0, defaultBsPopperConfig])
    };
  }
  _selectMenuItem({
    key,
    target
  }) {
    const items = SelectorEngine.find(SELECTOR_VISIBLE_ITEMS, this._menu).filter((element) => isVisible(element));
    if (!items.length) {
      return;
    }
    getNextActiveElement(items, target, key === ARROW_DOWN_KEY$1, !items.includes(target)).focus();
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _Dropdown.getOrCreateInstance(this, config);
      if (typeof config !== "string") {
        return;
      }
      if (typeof data[config] === "undefined") {
        throw new TypeError(`No method named "${config}"`);
      }
      data[config]();
    });
  }
  static clearMenus(event) {
    if (event.button === RIGHT_MOUSE_BUTTON || event.type === "keyup" && event.key !== TAB_KEY$1) {
      return;
    }
    const openToggles = SelectorEngine.find(SELECTOR_DATA_TOGGLE_SHOWN);
    for (const toggle of openToggles) {
      const context = _Dropdown.getInstance(toggle);
      if (!context || context._config.autoClose === false) {
        continue;
      }
      const composedPath = event.composedPath();
      const isMenuTarget = composedPath.includes(context._menu);
      if (composedPath.includes(context._element) || context._config.autoClose === "inside" && !isMenuTarget || context._config.autoClose === "outside" && isMenuTarget) {
        continue;
      }
      if (context._menu.contains(event.target) && (event.type === "keyup" && event.key === TAB_KEY$1 || /input|select|option|textarea|form/i.test(event.target.tagName))) {
        continue;
      }
      const relatedTarget = {
        relatedTarget: context._element
      };
      if (event.type === "click") {
        relatedTarget.clickEvent = event;
      }
      context._completeHide(relatedTarget);
    }
  }
  static dataApiKeydownHandler(event) {
    const isInput = /input|textarea/i.test(event.target.tagName);
    const isEscapeEvent = event.key === ESCAPE_KEY$2;
    const isUpOrDownEvent = [ARROW_UP_KEY$1, ARROW_DOWN_KEY$1].includes(event.key);
    if (!isUpOrDownEvent && !isEscapeEvent) {
      return;
    }
    if (isInput && !isEscapeEvent) {
      return;
    }
    event.preventDefault();
    const getToggleButton = this.matches(SELECTOR_DATA_TOGGLE$3) ? this : SelectorEngine.prev(this, SELECTOR_DATA_TOGGLE$3)[0] || SelectorEngine.next(this, SELECTOR_DATA_TOGGLE$3)[0] || SelectorEngine.findOne(SELECTOR_DATA_TOGGLE$3, event.delegateTarget.parentNode);
    const instance = _Dropdown.getOrCreateInstance(getToggleButton);
    if (isUpOrDownEvent) {
      event.stopPropagation();
      instance.show();
      instance._selectMenuItem(event);
      return;
    }
    if (instance._isShown()) {
      event.stopPropagation();
      instance.hide();
      getToggleButton.focus();
    }
  }
};
EventHandler.on(document, EVENT_KEYDOWN_DATA_API, SELECTOR_DATA_TOGGLE$3, Dropdown.dataApiKeydownHandler);
EventHandler.on(document, EVENT_KEYDOWN_DATA_API, SELECTOR_MENU, Dropdown.dataApiKeydownHandler);
EventHandler.on(document, EVENT_CLICK_DATA_API$3, Dropdown.clearMenus);
EventHandler.on(document, EVENT_KEYUP_DATA_API, Dropdown.clearMenus);
EventHandler.on(document, EVENT_CLICK_DATA_API$3, SELECTOR_DATA_TOGGLE$3, function(event) {
  event.preventDefault();
  Dropdown.getOrCreateInstance(this).toggle();
});
defineJQueryPlugin(Dropdown);
var NAME$9 = "backdrop";
var CLASS_NAME_FADE$4 = "fade";
var CLASS_NAME_SHOW$5 = "show";
var EVENT_MOUSEDOWN = `mousedown.bs.${NAME$9}`;
var Default$8 = {
  className: "modal-backdrop",
  clickCallback: null,
  isAnimated: false,
  isVisible: true,
  // if false, we use the backdrop helper without adding any element to the dom
  rootElement: "body"
  // give the choice to place backdrop under different elements
};
var DefaultType$8 = {
  className: "string",
  clickCallback: "(function|null)",
  isAnimated: "boolean",
  isVisible: "boolean",
  rootElement: "(element|string)"
};
var Backdrop = class extends Config {
  constructor(config) {
    super();
    this._config = this._getConfig(config);
    this._isAppended = false;
    this._element = null;
  }
  // Getters
  static get Default() {
    return Default$8;
  }
  static get DefaultType() {
    return DefaultType$8;
  }
  static get NAME() {
    return NAME$9;
  }
  // Public
  show(callback) {
    if (!this._config.isVisible) {
      execute(callback);
      return;
    }
    this._append();
    const element = this._getElement();
    if (this._config.isAnimated) {
      reflow(element);
    }
    element.classList.add(CLASS_NAME_SHOW$5);
    this._emulateAnimation(() => {
      execute(callback);
    });
  }
  hide(callback) {
    if (!this._config.isVisible) {
      execute(callback);
      return;
    }
    this._getElement().classList.remove(CLASS_NAME_SHOW$5);
    this._emulateAnimation(() => {
      this.dispose();
      execute(callback);
    });
  }
  dispose() {
    if (!this._isAppended) {
      return;
    }
    EventHandler.off(this._element, EVENT_MOUSEDOWN);
    this._element.remove();
    this._isAppended = false;
  }
  // Private
  _getElement() {
    if (!this._element) {
      const backdrop = document.createElement("div");
      backdrop.className = this._config.className;
      if (this._config.isAnimated) {
        backdrop.classList.add(CLASS_NAME_FADE$4);
      }
      this._element = backdrop;
    }
    return this._element;
  }
  _configAfterMerge(config) {
    config.rootElement = getElement(config.rootElement);
    return config;
  }
  _append() {
    if (this._isAppended) {
      return;
    }
    const element = this._getElement();
    this._config.rootElement.append(element);
    EventHandler.on(element, EVENT_MOUSEDOWN, () => {
      execute(this._config.clickCallback);
    });
    this._isAppended = true;
  }
  _emulateAnimation(callback) {
    executeAfterTransition(callback, this._getElement(), this._config.isAnimated);
  }
};
var NAME$8 = "focustrap";
var DATA_KEY$5 = "bs.focustrap";
var EVENT_KEY$5 = `.${DATA_KEY$5}`;
var EVENT_FOCUSIN$2 = `focusin${EVENT_KEY$5}`;
var EVENT_KEYDOWN_TAB = `keydown.tab${EVENT_KEY$5}`;
var TAB_KEY = "Tab";
var TAB_NAV_FORWARD = "forward";
var TAB_NAV_BACKWARD = "backward";
var Default$7 = {
  autofocus: true,
  trapElement: null
  // The element to trap focus inside of
};
var DefaultType$7 = {
  autofocus: "boolean",
  trapElement: "element"
};
var FocusTrap = class extends Config {
  constructor(config) {
    super();
    this._config = this._getConfig(config);
    this._isActive = false;
    this._lastTabNavDirection = null;
  }
  // Getters
  static get Default() {
    return Default$7;
  }
  static get DefaultType() {
    return DefaultType$7;
  }
  static get NAME() {
    return NAME$8;
  }
  // Public
  activate() {
    if (this._isActive) {
      return;
    }
    if (this._config.autofocus) {
      this._config.trapElement.focus();
    }
    EventHandler.off(document, EVENT_KEY$5);
    EventHandler.on(document, EVENT_FOCUSIN$2, (event) => this._handleFocusin(event));
    EventHandler.on(document, EVENT_KEYDOWN_TAB, (event) => this._handleKeydown(event));
    this._isActive = true;
  }
  deactivate() {
    if (!this._isActive) {
      return;
    }
    this._isActive = false;
    EventHandler.off(document, EVENT_KEY$5);
  }
  // Private
  _handleFocusin(event) {
    const {
      trapElement
    } = this._config;
    if (event.target === document || event.target === trapElement || trapElement.contains(event.target)) {
      return;
    }
    const elements = SelectorEngine.focusableChildren(trapElement);
    if (elements.length === 0) {
      trapElement.focus();
    } else if (this._lastTabNavDirection === TAB_NAV_BACKWARD) {
      elements[elements.length - 1].focus();
    } else {
      elements[0].focus();
    }
  }
  _handleKeydown(event) {
    if (event.key !== TAB_KEY) {
      return;
    }
    this._lastTabNavDirection = event.shiftKey ? TAB_NAV_BACKWARD : TAB_NAV_FORWARD;
  }
};
var SELECTOR_FIXED_CONTENT = ".fixed-top, .fixed-bottom, .is-fixed, .sticky-top";
var SELECTOR_STICKY_CONTENT = ".sticky-top";
var PROPERTY_PADDING = "padding-right";
var PROPERTY_MARGIN = "margin-right";
var ScrollBarHelper = class {
  constructor() {
    this._element = document.body;
  }
  // Public
  getWidth() {
    const documentWidth = document.documentElement.clientWidth;
    return Math.abs(window.innerWidth - documentWidth);
  }
  hide() {
    const width = this.getWidth();
    this._disableOverFlow();
    this._setElementAttributes(this._element, PROPERTY_PADDING, (calculatedValue) => calculatedValue + width);
    this._setElementAttributes(SELECTOR_FIXED_CONTENT, PROPERTY_PADDING, (calculatedValue) => calculatedValue + width);
    this._setElementAttributes(SELECTOR_STICKY_CONTENT, PROPERTY_MARGIN, (calculatedValue) => calculatedValue - width);
  }
  reset() {
    this._resetElementAttributes(this._element, "overflow");
    this._resetElementAttributes(this._element, PROPERTY_PADDING);
    this._resetElementAttributes(SELECTOR_FIXED_CONTENT, PROPERTY_PADDING);
    this._resetElementAttributes(SELECTOR_STICKY_CONTENT, PROPERTY_MARGIN);
  }
  isOverflowing() {
    return this.getWidth() > 0;
  }
  // Private
  _disableOverFlow() {
    this._saveInitialAttribute(this._element, "overflow");
    this._element.style.overflow = "hidden";
  }
  _setElementAttributes(selector, styleProperty, callback) {
    const scrollbarWidth = this.getWidth();
    const manipulationCallBack = (element) => {
      if (element !== this._element && window.innerWidth > element.clientWidth + scrollbarWidth) {
        return;
      }
      this._saveInitialAttribute(element, styleProperty);
      const calculatedValue = window.getComputedStyle(element).getPropertyValue(styleProperty);
      element.style.setProperty(styleProperty, `${callback(Number.parseFloat(calculatedValue))}px`);
    };
    this._applyManipulationCallback(selector, manipulationCallBack);
  }
  _saveInitialAttribute(element, styleProperty) {
    const actualValue = element.style.getPropertyValue(styleProperty);
    if (actualValue) {
      Manipulator.setDataAttribute(element, styleProperty, actualValue);
    }
  }
  _resetElementAttributes(selector, styleProperty) {
    const manipulationCallBack = (element) => {
      const value = Manipulator.getDataAttribute(element, styleProperty);
      if (value === null) {
        element.style.removeProperty(styleProperty);
        return;
      }
      Manipulator.removeDataAttribute(element, styleProperty);
      element.style.setProperty(styleProperty, value);
    };
    this._applyManipulationCallback(selector, manipulationCallBack);
  }
  _applyManipulationCallback(selector, callBack) {
    if (isElement2(selector)) {
      callBack(selector);
      return;
    }
    for (const sel of SelectorEngine.find(selector, this._element)) {
      callBack(sel);
    }
  }
};
var NAME$7 = "modal";
var DATA_KEY$4 = "bs.modal";
var EVENT_KEY$4 = `.${DATA_KEY$4}`;
var DATA_API_KEY$2 = ".data-api";
var ESCAPE_KEY$1 = "Escape";
var EVENT_HIDE$4 = `hide${EVENT_KEY$4}`;
var EVENT_HIDE_PREVENTED$1 = `hidePrevented${EVENT_KEY$4}`;
var EVENT_HIDDEN$4 = `hidden${EVENT_KEY$4}`;
var EVENT_SHOW$4 = `show${EVENT_KEY$4}`;
var EVENT_SHOWN$4 = `shown${EVENT_KEY$4}`;
var EVENT_RESIZE$1 = `resize${EVENT_KEY$4}`;
var EVENT_CLICK_DISMISS = `click.dismiss${EVENT_KEY$4}`;
var EVENT_MOUSEDOWN_DISMISS = `mousedown.dismiss${EVENT_KEY$4}`;
var EVENT_KEYDOWN_DISMISS$1 = `keydown.dismiss${EVENT_KEY$4}`;
var EVENT_CLICK_DATA_API$2 = `click${EVENT_KEY$4}${DATA_API_KEY$2}`;
var CLASS_NAME_OPEN = "modal-open";
var CLASS_NAME_FADE$3 = "fade";
var CLASS_NAME_SHOW$4 = "show";
var CLASS_NAME_STATIC = "modal-static";
var OPEN_SELECTOR$1 = ".modal.show";
var SELECTOR_DIALOG = ".modal-dialog";
var SELECTOR_MODAL_BODY = ".modal-body";
var SELECTOR_DATA_TOGGLE$2 = '[data-bs-toggle="modal"]';
var Default$6 = {
  backdrop: true,
  focus: true,
  keyboard: true
};
var DefaultType$6 = {
  backdrop: "(boolean|string)",
  focus: "boolean",
  keyboard: "boolean"
};
var Modal = class _Modal extends BaseComponent {
  constructor(element, config) {
    super(element, config);
    this._dialog = SelectorEngine.findOne(SELECTOR_DIALOG, this._element);
    this._backdrop = this._initializeBackDrop();
    this._focustrap = this._initializeFocusTrap();
    this._isShown = false;
    this._isTransitioning = false;
    this._scrollBar = new ScrollBarHelper();
    this._addEventListeners();
  }
  // Getters
  static get Default() {
    return Default$6;
  }
  static get DefaultType() {
    return DefaultType$6;
  }
  static get NAME() {
    return NAME$7;
  }
  // Public
  toggle(relatedTarget) {
    return this._isShown ? this.hide() : this.show(relatedTarget);
  }
  show(relatedTarget) {
    if (this._isShown || this._isTransitioning) {
      return;
    }
    const showEvent = EventHandler.trigger(this._element, EVENT_SHOW$4, {
      relatedTarget
    });
    if (showEvent.defaultPrevented) {
      return;
    }
    this._isShown = true;
    this._isTransitioning = true;
    this._scrollBar.hide();
    document.body.classList.add(CLASS_NAME_OPEN);
    this._adjustDialog();
    this._backdrop.show(() => this._showElement(relatedTarget));
  }
  hide() {
    if (!this._isShown || this._isTransitioning) {
      return;
    }
    const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE$4);
    if (hideEvent.defaultPrevented) {
      return;
    }
    this._isShown = false;
    this._isTransitioning = true;
    this._focustrap.deactivate();
    this._element.classList.remove(CLASS_NAME_SHOW$4);
    this._queueCallback(() => this._hideModal(), this._element, this._isAnimated());
  }
  dispose() {
    EventHandler.off(window, EVENT_KEY$4);
    EventHandler.off(this._dialog, EVENT_KEY$4);
    this._backdrop.dispose();
    this._focustrap.deactivate();
    super.dispose();
  }
  handleUpdate() {
    this._adjustDialog();
  }
  // Private
  _initializeBackDrop() {
    return new Backdrop({
      isVisible: Boolean(this._config.backdrop),
      // 'static' option will be translated to true, and booleans will keep their value,
      isAnimated: this._isAnimated()
    });
  }
  _initializeFocusTrap() {
    return new FocusTrap({
      trapElement: this._element
    });
  }
  _showElement(relatedTarget) {
    if (!document.body.contains(this._element)) {
      document.body.append(this._element);
    }
    this._element.style.display = "block";
    this._element.removeAttribute("aria-hidden");
    this._element.setAttribute("aria-modal", true);
    this._element.setAttribute("role", "dialog");
    this._element.scrollTop = 0;
    const modalBody = SelectorEngine.findOne(SELECTOR_MODAL_BODY, this._dialog);
    if (modalBody) {
      modalBody.scrollTop = 0;
    }
    reflow(this._element);
    this._element.classList.add(CLASS_NAME_SHOW$4);
    const transitionComplete = () => {
      if (this._config.focus) {
        this._focustrap.activate();
      }
      this._isTransitioning = false;
      EventHandler.trigger(this._element, EVENT_SHOWN$4, {
        relatedTarget
      });
    };
    this._queueCallback(transitionComplete, this._dialog, this._isAnimated());
  }
  _addEventListeners() {
    EventHandler.on(this._element, EVENT_KEYDOWN_DISMISS$1, (event) => {
      if (event.key !== ESCAPE_KEY$1) {
        return;
      }
      if (this._config.keyboard) {
        this.hide();
        return;
      }
      this._triggerBackdropTransition();
    });
    EventHandler.on(window, EVENT_RESIZE$1, () => {
      if (this._isShown && !this._isTransitioning) {
        this._adjustDialog();
      }
    });
    EventHandler.on(this._element, EVENT_MOUSEDOWN_DISMISS, (event) => {
      EventHandler.one(this._element, EVENT_CLICK_DISMISS, (event2) => {
        if (this._element !== event.target || this._element !== event2.target) {
          return;
        }
        if (this._config.backdrop === "static") {
          this._triggerBackdropTransition();
          return;
        }
        if (this._config.backdrop) {
          this.hide();
        }
      });
    });
  }
  _hideModal() {
    this._element.style.display = "none";
    this._element.setAttribute("aria-hidden", true);
    this._element.removeAttribute("aria-modal");
    this._element.removeAttribute("role");
    this._isTransitioning = false;
    this._backdrop.hide(() => {
      document.body.classList.remove(CLASS_NAME_OPEN);
      this._resetAdjustments();
      this._scrollBar.reset();
      EventHandler.trigger(this._element, EVENT_HIDDEN$4);
    });
  }
  _isAnimated() {
    return this._element.classList.contains(CLASS_NAME_FADE$3);
  }
  _triggerBackdropTransition() {
    const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED$1);
    if (hideEvent.defaultPrevented) {
      return;
    }
    const isModalOverflowing = this._element.scrollHeight > document.documentElement.clientHeight;
    const initialOverflowY = this._element.style.overflowY;
    if (initialOverflowY === "hidden" || this._element.classList.contains(CLASS_NAME_STATIC)) {
      return;
    }
    if (!isModalOverflowing) {
      this._element.style.overflowY = "hidden";
    }
    this._element.classList.add(CLASS_NAME_STATIC);
    this._queueCallback(() => {
      this._element.classList.remove(CLASS_NAME_STATIC);
      this._queueCallback(() => {
        this._element.style.overflowY = initialOverflowY;
      }, this._dialog);
    }, this._dialog);
    this._element.focus();
  }
  /**
   * The following methods are used to handle overflowing modals
   */
  _adjustDialog() {
    const isModalOverflowing = this._element.scrollHeight > document.documentElement.clientHeight;
    const scrollbarWidth = this._scrollBar.getWidth();
    const isBodyOverflowing = scrollbarWidth > 0;
    if (isBodyOverflowing && !isModalOverflowing) {
      const property = isRTL() ? "paddingLeft" : "paddingRight";
      this._element.style[property] = `${scrollbarWidth}px`;
    }
    if (!isBodyOverflowing && isModalOverflowing) {
      const property = isRTL() ? "paddingRight" : "paddingLeft";
      this._element.style[property] = `${scrollbarWidth}px`;
    }
  }
  _resetAdjustments() {
    this._element.style.paddingLeft = "";
    this._element.style.paddingRight = "";
  }
  // Static
  static jQueryInterface(config, relatedTarget) {
    return this.each(function() {
      const data = _Modal.getOrCreateInstance(this, config);
      if (typeof config !== "string") {
        return;
      }
      if (typeof data[config] === "undefined") {
        throw new TypeError(`No method named "${config}"`);
      }
      data[config](relatedTarget);
    });
  }
};
EventHandler.on(document, EVENT_CLICK_DATA_API$2, SELECTOR_DATA_TOGGLE$2, function(event) {
  const target = SelectorEngine.getElementFromSelector(this);
  if (["A", "AREA"].includes(this.tagName)) {
    event.preventDefault();
  }
  EventHandler.one(target, EVENT_SHOW$4, (showEvent) => {
    if (showEvent.defaultPrevented) {
      return;
    }
    EventHandler.one(target, EVENT_HIDDEN$4, () => {
      if (isVisible(this)) {
        this.focus();
      }
    });
  });
  const alreadyOpen = SelectorEngine.findOne(OPEN_SELECTOR$1);
  if (alreadyOpen) {
    Modal.getInstance(alreadyOpen).hide();
  }
  const data = Modal.getOrCreateInstance(target);
  data.toggle(this);
});
enableDismissTrigger(Modal);
defineJQueryPlugin(Modal);
var NAME$6 = "offcanvas";
var DATA_KEY$3 = "bs.offcanvas";
var EVENT_KEY$3 = `.${DATA_KEY$3}`;
var DATA_API_KEY$1 = ".data-api";
var EVENT_LOAD_DATA_API$2 = `load${EVENT_KEY$3}${DATA_API_KEY$1}`;
var ESCAPE_KEY = "Escape";
var CLASS_NAME_SHOW$3 = "show";
var CLASS_NAME_SHOWING$1 = "showing";
var CLASS_NAME_HIDING = "hiding";
var CLASS_NAME_BACKDROP = "offcanvas-backdrop";
var OPEN_SELECTOR = ".offcanvas.show";
var EVENT_SHOW$3 = `show${EVENT_KEY$3}`;
var EVENT_SHOWN$3 = `shown${EVENT_KEY$3}`;
var EVENT_HIDE$3 = `hide${EVENT_KEY$3}`;
var EVENT_HIDE_PREVENTED = `hidePrevented${EVENT_KEY$3}`;
var EVENT_HIDDEN$3 = `hidden${EVENT_KEY$3}`;
var EVENT_RESIZE = `resize${EVENT_KEY$3}`;
var EVENT_CLICK_DATA_API$1 = `click${EVENT_KEY$3}${DATA_API_KEY$1}`;
var EVENT_KEYDOWN_DISMISS = `keydown.dismiss${EVENT_KEY$3}`;
var SELECTOR_DATA_TOGGLE$1 = '[data-bs-toggle="offcanvas"]';
var Default$5 = {
  backdrop: true,
  keyboard: true,
  scroll: false
};
var DefaultType$5 = {
  backdrop: "(boolean|string)",
  keyboard: "boolean",
  scroll: "boolean"
};
var Offcanvas = class _Offcanvas extends BaseComponent {
  constructor(element, config) {
    super(element, config);
    this._isShown = false;
    this._backdrop = this._initializeBackDrop();
    this._focustrap = this._initializeFocusTrap();
    this._addEventListeners();
  }
  // Getters
  static get Default() {
    return Default$5;
  }
  static get DefaultType() {
    return DefaultType$5;
  }
  static get NAME() {
    return NAME$6;
  }
  // Public
  toggle(relatedTarget) {
    return this._isShown ? this.hide() : this.show(relatedTarget);
  }
  show(relatedTarget) {
    if (this._isShown) {
      return;
    }
    const showEvent = EventHandler.trigger(this._element, EVENT_SHOW$3, {
      relatedTarget
    });
    if (showEvent.defaultPrevented) {
      return;
    }
    this._isShown = true;
    this._backdrop.show();
    if (!this._config.scroll) {
      new ScrollBarHelper().hide();
    }
    this._element.setAttribute("aria-modal", true);
    this._element.setAttribute("role", "dialog");
    this._element.classList.add(CLASS_NAME_SHOWING$1);
    const completeCallBack = () => {
      if (!this._config.scroll || this._config.backdrop) {
        this._focustrap.activate();
      }
      this._element.classList.add(CLASS_NAME_SHOW$3);
      this._element.classList.remove(CLASS_NAME_SHOWING$1);
      EventHandler.trigger(this._element, EVENT_SHOWN$3, {
        relatedTarget
      });
    };
    this._queueCallback(completeCallBack, this._element, true);
  }
  hide() {
    if (!this._isShown) {
      return;
    }
    const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE$3);
    if (hideEvent.defaultPrevented) {
      return;
    }
    this._focustrap.deactivate();
    this._element.blur();
    this._isShown = false;
    this._element.classList.add(CLASS_NAME_HIDING);
    this._backdrop.hide();
    const completeCallback = () => {
      this._element.classList.remove(CLASS_NAME_SHOW$3, CLASS_NAME_HIDING);
      this._element.removeAttribute("aria-modal");
      this._element.removeAttribute("role");
      if (!this._config.scroll) {
        new ScrollBarHelper().reset();
      }
      EventHandler.trigger(this._element, EVENT_HIDDEN$3);
    };
    this._queueCallback(completeCallback, this._element, true);
  }
  dispose() {
    this._backdrop.dispose();
    this._focustrap.deactivate();
    super.dispose();
  }
  // Private
  _initializeBackDrop() {
    const clickCallback = () => {
      if (this._config.backdrop === "static") {
        EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED);
        return;
      }
      this.hide();
    };
    const isVisible2 = Boolean(this._config.backdrop);
    return new Backdrop({
      className: CLASS_NAME_BACKDROP,
      isVisible: isVisible2,
      isAnimated: true,
      rootElement: this._element.parentNode,
      clickCallback: isVisible2 ? clickCallback : null
    });
  }
  _initializeFocusTrap() {
    return new FocusTrap({
      trapElement: this._element
    });
  }
  _addEventListeners() {
    EventHandler.on(this._element, EVENT_KEYDOWN_DISMISS, (event) => {
      if (event.key !== ESCAPE_KEY) {
        return;
      }
      if (this._config.keyboard) {
        this.hide();
        return;
      }
      EventHandler.trigger(this._element, EVENT_HIDE_PREVENTED);
    });
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _Offcanvas.getOrCreateInstance(this, config);
      if (typeof config !== "string") {
        return;
      }
      if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
        throw new TypeError(`No method named "${config}"`);
      }
      data[config](this);
    });
  }
};
EventHandler.on(document, EVENT_CLICK_DATA_API$1, SELECTOR_DATA_TOGGLE$1, function(event) {
  const target = SelectorEngine.getElementFromSelector(this);
  if (["A", "AREA"].includes(this.tagName)) {
    event.preventDefault();
  }
  if (isDisabled(this)) {
    return;
  }
  EventHandler.one(target, EVENT_HIDDEN$3, () => {
    if (isVisible(this)) {
      this.focus();
    }
  });
  const alreadyOpen = SelectorEngine.findOne(OPEN_SELECTOR);
  if (alreadyOpen && alreadyOpen !== target) {
    Offcanvas.getInstance(alreadyOpen).hide();
  }
  const data = Offcanvas.getOrCreateInstance(target);
  data.toggle(this);
});
EventHandler.on(window, EVENT_LOAD_DATA_API$2, () => {
  for (const selector of SelectorEngine.find(OPEN_SELECTOR)) {
    Offcanvas.getOrCreateInstance(selector).show();
  }
});
EventHandler.on(window, EVENT_RESIZE, () => {
  for (const element of SelectorEngine.find("[aria-modal][class*=show][class*=offcanvas-]")) {
    if (getComputedStyle(element).position !== "fixed") {
      Offcanvas.getOrCreateInstance(element).hide();
    }
  }
});
enableDismissTrigger(Offcanvas);
defineJQueryPlugin(Offcanvas);
var ARIA_ATTRIBUTE_PATTERN = /^aria-[\w-]*$/i;
var DefaultAllowlist = {
  // Global attributes allowed on any supplied element below.
  "*": ["class", "dir", "id", "lang", "role", ARIA_ATTRIBUTE_PATTERN],
  a: ["target", "href", "title", "rel"],
  area: [],
  b: [],
  br: [],
  col: [],
  code: [],
  dd: [],
  div: [],
  dl: [],
  dt: [],
  em: [],
  hr: [],
  h1: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  i: [],
  img: ["src", "srcset", "alt", "title", "width", "height"],
  li: [],
  ol: [],
  p: [],
  pre: [],
  s: [],
  small: [],
  span: [],
  sub: [],
  sup: [],
  strong: [],
  u: [],
  ul: []
};
var uriAttributes = /* @__PURE__ */ new Set(["background", "cite", "href", "itemtype", "longdesc", "poster", "src", "xlink:href"]);
var SAFE_URL_PATTERN = /^(?!javascript:)(?:[a-z0-9+.-]+:|[^&:/?#]*(?:[/?#]|$))/i;
var allowedAttribute = (attribute, allowedAttributeList) => {
  const attributeName = attribute.nodeName.toLowerCase();
  if (allowedAttributeList.includes(attributeName)) {
    if (uriAttributes.has(attributeName)) {
      return Boolean(SAFE_URL_PATTERN.test(attribute.nodeValue));
    }
    return true;
  }
  return allowedAttributeList.filter((attributeRegex) => attributeRegex instanceof RegExp).some((regex) => regex.test(attributeName));
};
function sanitizeHtml(unsafeHtml, allowList, sanitizeFunction) {
  if (!unsafeHtml.length) {
    return unsafeHtml;
  }
  if (sanitizeFunction && typeof sanitizeFunction === "function") {
    return sanitizeFunction(unsafeHtml);
  }
  const domParser = new window.DOMParser();
  const createdDocument = domParser.parseFromString(unsafeHtml, "text/html");
  const elements = [].concat(...createdDocument.body.querySelectorAll("*"));
  for (const element of elements) {
    const elementName = element.nodeName.toLowerCase();
    if (!Object.keys(allowList).includes(elementName)) {
      element.remove();
      continue;
    }
    const attributeList = [].concat(...element.attributes);
    const allowedAttributes = [].concat(allowList["*"] || [], allowList[elementName] || []);
    for (const attribute of attributeList) {
      if (!allowedAttribute(attribute, allowedAttributes)) {
        element.removeAttribute(attribute.nodeName);
      }
    }
  }
  return createdDocument.body.innerHTML;
}
var NAME$5 = "TemplateFactory";
var Default$4 = {
  allowList: DefaultAllowlist,
  content: {},
  // { selector : text ,  selector2 : text2 , }
  extraClass: "",
  html: false,
  sanitize: true,
  sanitizeFn: null,
  template: "<div></div>"
};
var DefaultType$4 = {
  allowList: "object",
  content: "object",
  extraClass: "(string|function)",
  html: "boolean",
  sanitize: "boolean",
  sanitizeFn: "(null|function)",
  template: "string"
};
var DefaultContentType = {
  entry: "(string|element|function|null)",
  selector: "(string|element)"
};
var TemplateFactory = class extends Config {
  constructor(config) {
    super();
    this._config = this._getConfig(config);
  }
  // Getters
  static get Default() {
    return Default$4;
  }
  static get DefaultType() {
    return DefaultType$4;
  }
  static get NAME() {
    return NAME$5;
  }
  // Public
  getContent() {
    return Object.values(this._config.content).map((config) => this._resolvePossibleFunction(config)).filter(Boolean);
  }
  hasContent() {
    return this.getContent().length > 0;
  }
  changeContent(content) {
    this._checkContent(content);
    this._config.content = {
      ...this._config.content,
      ...content
    };
    return this;
  }
  toHtml() {
    const templateWrapper = document.createElement("div");
    templateWrapper.innerHTML = this._maybeSanitize(this._config.template);
    for (const [selector, text] of Object.entries(this._config.content)) {
      this._setContent(templateWrapper, text, selector);
    }
    const template = templateWrapper.children[0];
    const extraClass = this._resolvePossibleFunction(this._config.extraClass);
    if (extraClass) {
      template.classList.add(...extraClass.split(" "));
    }
    return template;
  }
  // Private
  _typeCheckConfig(config) {
    super._typeCheckConfig(config);
    this._checkContent(config.content);
  }
  _checkContent(arg) {
    for (const [selector, content] of Object.entries(arg)) {
      super._typeCheckConfig({
        selector,
        entry: content
      }, DefaultContentType);
    }
  }
  _setContent(template, content, selector) {
    const templateElement = SelectorEngine.findOne(selector, template);
    if (!templateElement) {
      return;
    }
    content = this._resolvePossibleFunction(content);
    if (!content) {
      templateElement.remove();
      return;
    }
    if (isElement2(content)) {
      this._putElementInTemplate(getElement(content), templateElement);
      return;
    }
    if (this._config.html) {
      templateElement.innerHTML = this._maybeSanitize(content);
      return;
    }
    templateElement.textContent = content;
  }
  _maybeSanitize(arg) {
    return this._config.sanitize ? sanitizeHtml(arg, this._config.allowList, this._config.sanitizeFn) : arg;
  }
  _resolvePossibleFunction(arg) {
    return execute(arg, [void 0, this]);
  }
  _putElementInTemplate(element, templateElement) {
    if (this._config.html) {
      templateElement.innerHTML = "";
      templateElement.append(element);
      return;
    }
    templateElement.textContent = element.textContent;
  }
};
var NAME$4 = "tooltip";
var DISALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set(["sanitize", "allowList", "sanitizeFn"]);
var CLASS_NAME_FADE$2 = "fade";
var CLASS_NAME_MODAL = "modal";
var CLASS_NAME_SHOW$2 = "show";
var SELECTOR_TOOLTIP_INNER = ".tooltip-inner";
var SELECTOR_MODAL = `.${CLASS_NAME_MODAL}`;
var EVENT_MODAL_HIDE = "hide.bs.modal";
var TRIGGER_HOVER = "hover";
var TRIGGER_FOCUS = "focus";
var TRIGGER_CLICK = "click";
var TRIGGER_MANUAL = "manual";
var EVENT_HIDE$2 = "hide";
var EVENT_HIDDEN$2 = "hidden";
var EVENT_SHOW$2 = "show";
var EVENT_SHOWN$2 = "shown";
var EVENT_INSERTED = "inserted";
var EVENT_CLICK$1 = "click";
var EVENT_FOCUSIN$1 = "focusin";
var EVENT_FOCUSOUT$1 = "focusout";
var EVENT_MOUSEENTER = "mouseenter";
var EVENT_MOUSELEAVE = "mouseleave";
var AttachmentMap = {
  AUTO: "auto",
  TOP: "top",
  RIGHT: isRTL() ? "left" : "right",
  BOTTOM: "bottom",
  LEFT: isRTL() ? "right" : "left"
};
var Default$3 = {
  allowList: DefaultAllowlist,
  animation: true,
  boundary: "clippingParents",
  container: false,
  customClass: "",
  delay: 0,
  fallbackPlacements: ["top", "right", "bottom", "left"],
  html: false,
  offset: [0, 6],
  placement: "top",
  popperConfig: null,
  sanitize: true,
  sanitizeFn: null,
  selector: false,
  template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
  title: "",
  trigger: "hover focus"
};
var DefaultType$3 = {
  allowList: "object",
  animation: "boolean",
  boundary: "(string|element)",
  container: "(string|element|boolean)",
  customClass: "(string|function)",
  delay: "(number|object)",
  fallbackPlacements: "array",
  html: "boolean",
  offset: "(array|string|function)",
  placement: "(string|function)",
  popperConfig: "(null|object|function)",
  sanitize: "boolean",
  sanitizeFn: "(null|function)",
  selector: "(string|boolean)",
  template: "string",
  title: "(string|element|function)",
  trigger: "string"
};
var Tooltip = class _Tooltip extends BaseComponent {
  constructor(element, config) {
    if (typeof lib_exports === "undefined") {
      throw new TypeError("Bootstrap's tooltips require Popper (https://popper.js.org/docs/v2/)");
    }
    super(element, config);
    this._isEnabled = true;
    this._timeout = 0;
    this._isHovered = null;
    this._activeTrigger = {};
    this._popper = null;
    this._templateFactory = null;
    this._newContent = null;
    this.tip = null;
    this._setListeners();
    if (!this._config.selector) {
      this._fixTitle();
    }
  }
  // Getters
  static get Default() {
    return Default$3;
  }
  static get DefaultType() {
    return DefaultType$3;
  }
  static get NAME() {
    return NAME$4;
  }
  // Public
  enable() {
    this._isEnabled = true;
  }
  disable() {
    this._isEnabled = false;
  }
  toggleEnabled() {
    this._isEnabled = !this._isEnabled;
  }
  toggle() {
    if (!this._isEnabled) {
      return;
    }
    if (this._isShown()) {
      this._leave();
      return;
    }
    this._enter();
  }
  dispose() {
    clearTimeout(this._timeout);
    EventHandler.off(this._element.closest(SELECTOR_MODAL), EVENT_MODAL_HIDE, this._hideModalHandler);
    if (this._element.getAttribute("data-bs-original-title")) {
      this._element.setAttribute("title", this._element.getAttribute("data-bs-original-title"));
    }
    this._disposePopper();
    super.dispose();
  }
  show() {
    if (this._element.style.display === "none") {
      throw new Error("Please use show on visible elements");
    }
    if (!(this._isWithContent() && this._isEnabled)) {
      return;
    }
    const showEvent = EventHandler.trigger(this._element, this.constructor.eventName(EVENT_SHOW$2));
    const shadowRoot = findShadowRoot(this._element);
    const isInTheDom = (shadowRoot || this._element.ownerDocument.documentElement).contains(this._element);
    if (showEvent.defaultPrevented || !isInTheDom) {
      return;
    }
    this._disposePopper();
    const tip = this._getTipElement();
    this._element.setAttribute("aria-describedby", tip.getAttribute("id"));
    const {
      container
    } = this._config;
    if (!this._element.ownerDocument.documentElement.contains(this.tip)) {
      container.append(tip);
      EventHandler.trigger(this._element, this.constructor.eventName(EVENT_INSERTED));
    }
    this._popper = this._createPopper(tip);
    tip.classList.add(CLASS_NAME_SHOW$2);
    if ("ontouchstart" in document.documentElement) {
      for (const element of [].concat(...document.body.children)) {
        EventHandler.on(element, "mouseover", noop);
      }
    }
    const complete = () => {
      EventHandler.trigger(this._element, this.constructor.eventName(EVENT_SHOWN$2));
      if (this._isHovered === false) {
        this._leave();
      }
      this._isHovered = false;
    };
    this._queueCallback(complete, this.tip, this._isAnimated());
  }
  hide() {
    if (!this._isShown()) {
      return;
    }
    const hideEvent = EventHandler.trigger(this._element, this.constructor.eventName(EVENT_HIDE$2));
    if (hideEvent.defaultPrevented) {
      return;
    }
    const tip = this._getTipElement();
    tip.classList.remove(CLASS_NAME_SHOW$2);
    if ("ontouchstart" in document.documentElement) {
      for (const element of [].concat(...document.body.children)) {
        EventHandler.off(element, "mouseover", noop);
      }
    }
    this._activeTrigger[TRIGGER_CLICK] = false;
    this._activeTrigger[TRIGGER_FOCUS] = false;
    this._activeTrigger[TRIGGER_HOVER] = false;
    this._isHovered = null;
    const complete = () => {
      if (this._isWithActiveTrigger()) {
        return;
      }
      if (!this._isHovered) {
        this._disposePopper();
      }
      this._element.removeAttribute("aria-describedby");
      EventHandler.trigger(this._element, this.constructor.eventName(EVENT_HIDDEN$2));
    };
    this._queueCallback(complete, this.tip, this._isAnimated());
  }
  update() {
    if (this._popper) {
      this._popper.update();
    }
  }
  // Protected
  _isWithContent() {
    return Boolean(this._getTitle());
  }
  _getTipElement() {
    if (!this.tip) {
      this.tip = this._createTipElement(this._newContent || this._getContentForTemplate());
    }
    return this.tip;
  }
  _createTipElement(content) {
    const tip = this._getTemplateFactory(content).toHtml();
    if (!tip) {
      return null;
    }
    tip.classList.remove(CLASS_NAME_FADE$2, CLASS_NAME_SHOW$2);
    tip.classList.add(`bs-${this.constructor.NAME}-auto`);
    const tipId = getUID(this.constructor.NAME).toString();
    tip.setAttribute("id", tipId);
    if (this._isAnimated()) {
      tip.classList.add(CLASS_NAME_FADE$2);
    }
    return tip;
  }
  setContent(content) {
    this._newContent = content;
    if (this._isShown()) {
      this._disposePopper();
      this.show();
    }
  }
  _getTemplateFactory(content) {
    if (this._templateFactory) {
      this._templateFactory.changeContent(content);
    } else {
      this._templateFactory = new TemplateFactory({
        ...this._config,
        // the `content` var has to be after `this._config`
        // to override config.content in case of popover
        content,
        extraClass: this._resolvePossibleFunction(this._config.customClass)
      });
    }
    return this._templateFactory;
  }
  _getContentForTemplate() {
    return {
      [SELECTOR_TOOLTIP_INNER]: this._getTitle()
    };
  }
  _getTitle() {
    return this._resolvePossibleFunction(this._config.title) || this._element.getAttribute("data-bs-original-title");
  }
  // Private
  _initializeOnDelegatedTarget(event) {
    return this.constructor.getOrCreateInstance(event.delegateTarget, this._getDelegateConfig());
  }
  _isAnimated() {
    return this._config.animation || this.tip && this.tip.classList.contains(CLASS_NAME_FADE$2);
  }
  _isShown() {
    return this.tip && this.tip.classList.contains(CLASS_NAME_SHOW$2);
  }
  _createPopper(tip) {
    const placement = execute(this._config.placement, [this, tip, this._element]);
    const attachment = AttachmentMap[placement.toUpperCase()];
    return createPopper3(this._element, tip, this._getPopperConfig(attachment));
  }
  _getOffset() {
    const {
      offset: offset2
    } = this._config;
    if (typeof offset2 === "string") {
      return offset2.split(",").map((value) => Number.parseInt(value, 10));
    }
    if (typeof offset2 === "function") {
      return (popperData) => offset2(popperData, this._element);
    }
    return offset2;
  }
  _resolvePossibleFunction(arg) {
    return execute(arg, [this._element, this._element]);
  }
  _getPopperConfig(attachment) {
    const defaultBsPopperConfig = {
      placement: attachment,
      modifiers: [{
        name: "flip",
        options: {
          fallbackPlacements: this._config.fallbackPlacements
        }
      }, {
        name: "offset",
        options: {
          offset: this._getOffset()
        }
      }, {
        name: "preventOverflow",
        options: {
          boundary: this._config.boundary
        }
      }, {
        name: "arrow",
        options: {
          element: `.${this.constructor.NAME}-arrow`
        }
      }, {
        name: "preSetPlacement",
        enabled: true,
        phase: "beforeMain",
        fn: (data) => {
          this._getTipElement().setAttribute("data-popper-placement", data.state.placement);
        }
      }]
    };
    return {
      ...defaultBsPopperConfig,
      ...execute(this._config.popperConfig, [void 0, defaultBsPopperConfig])
    };
  }
  _setListeners() {
    const triggers = this._config.trigger.split(" ");
    for (const trigger of triggers) {
      if (trigger === "click") {
        EventHandler.on(this._element, this.constructor.eventName(EVENT_CLICK$1), this._config.selector, (event) => {
          const context = this._initializeOnDelegatedTarget(event);
          context._activeTrigger[TRIGGER_CLICK] = !(context._isShown() && context._activeTrigger[TRIGGER_CLICK]);
          context.toggle();
        });
      } else if (trigger !== TRIGGER_MANUAL) {
        const eventIn = trigger === TRIGGER_HOVER ? this.constructor.eventName(EVENT_MOUSEENTER) : this.constructor.eventName(EVENT_FOCUSIN$1);
        const eventOut = trigger === TRIGGER_HOVER ? this.constructor.eventName(EVENT_MOUSELEAVE) : this.constructor.eventName(EVENT_FOCUSOUT$1);
        EventHandler.on(this._element, eventIn, this._config.selector, (event) => {
          const context = this._initializeOnDelegatedTarget(event);
          context._activeTrigger[event.type === "focusin" ? TRIGGER_FOCUS : TRIGGER_HOVER] = true;
          context._enter();
        });
        EventHandler.on(this._element, eventOut, this._config.selector, (event) => {
          const context = this._initializeOnDelegatedTarget(event);
          context._activeTrigger[event.type === "focusout" ? TRIGGER_FOCUS : TRIGGER_HOVER] = context._element.contains(event.relatedTarget);
          context._leave();
        });
      }
    }
    this._hideModalHandler = () => {
      if (this._element) {
        this.hide();
      }
    };
    EventHandler.on(this._element.closest(SELECTOR_MODAL), EVENT_MODAL_HIDE, this._hideModalHandler);
  }
  _fixTitle() {
    const title = this._element.getAttribute("title");
    if (!title) {
      return;
    }
    if (!this._element.getAttribute("aria-label") && !this._element.textContent.trim()) {
      this._element.setAttribute("aria-label", title);
    }
    this._element.setAttribute("data-bs-original-title", title);
    this._element.removeAttribute("title");
  }
  _enter() {
    if (this._isShown() || this._isHovered) {
      this._isHovered = true;
      return;
    }
    this._isHovered = true;
    this._setTimeout(() => {
      if (this._isHovered) {
        this.show();
      }
    }, this._config.delay.show);
  }
  _leave() {
    if (this._isWithActiveTrigger()) {
      return;
    }
    this._isHovered = false;
    this._setTimeout(() => {
      if (!this._isHovered) {
        this.hide();
      }
    }, this._config.delay.hide);
  }
  _setTimeout(handler, timeout) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(handler, timeout);
  }
  _isWithActiveTrigger() {
    return Object.values(this._activeTrigger).includes(true);
  }
  _getConfig(config) {
    const dataAttributes = Manipulator.getDataAttributes(this._element);
    for (const dataAttribute of Object.keys(dataAttributes)) {
      if (DISALLOWED_ATTRIBUTES.has(dataAttribute)) {
        delete dataAttributes[dataAttribute];
      }
    }
    config = {
      ...dataAttributes,
      ...typeof config === "object" && config ? config : {}
    };
    config = this._mergeConfigObj(config);
    config = this._configAfterMerge(config);
    this._typeCheckConfig(config);
    return config;
  }
  _configAfterMerge(config) {
    config.container = config.container === false ? document.body : getElement(config.container);
    if (typeof config.delay === "number") {
      config.delay = {
        show: config.delay,
        hide: config.delay
      };
    }
    if (typeof config.title === "number") {
      config.title = config.title.toString();
    }
    if (typeof config.content === "number") {
      config.content = config.content.toString();
    }
    return config;
  }
  _getDelegateConfig() {
    const config = {};
    for (const [key, value] of Object.entries(this._config)) {
      if (this.constructor.Default[key] !== value) {
        config[key] = value;
      }
    }
    config.selector = false;
    config.trigger = "manual";
    return config;
  }
  _disposePopper() {
    if (this._popper) {
      this._popper.destroy();
      this._popper = null;
    }
    if (this.tip) {
      this.tip.remove();
      this.tip = null;
    }
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _Tooltip.getOrCreateInstance(this, config);
      if (typeof config !== "string") {
        return;
      }
      if (typeof data[config] === "undefined") {
        throw new TypeError(`No method named "${config}"`);
      }
      data[config]();
    });
  }
};
defineJQueryPlugin(Tooltip);
var NAME$3 = "popover";
var SELECTOR_TITLE = ".popover-header";
var SELECTOR_CONTENT = ".popover-body";
var Default$2 = {
  ...Tooltip.Default,
  content: "",
  offset: [0, 8],
  placement: "right",
  template: '<div class="popover" role="tooltip"><div class="popover-arrow"></div><h3 class="popover-header"></h3><div class="popover-body"></div></div>',
  trigger: "click"
};
var DefaultType$2 = {
  ...Tooltip.DefaultType,
  content: "(null|string|element|function)"
};
var Popover = class _Popover extends Tooltip {
  // Getters
  static get Default() {
    return Default$2;
  }
  static get DefaultType() {
    return DefaultType$2;
  }
  static get NAME() {
    return NAME$3;
  }
  // Overrides
  _isWithContent() {
    return this._getTitle() || this._getContent();
  }
  // Private
  _getContentForTemplate() {
    return {
      [SELECTOR_TITLE]: this._getTitle(),
      [SELECTOR_CONTENT]: this._getContent()
    };
  }
  _getContent() {
    return this._resolvePossibleFunction(this._config.content);
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _Popover.getOrCreateInstance(this, config);
      if (typeof config !== "string") {
        return;
      }
      if (typeof data[config] === "undefined") {
        throw new TypeError(`No method named "${config}"`);
      }
      data[config]();
    });
  }
};
defineJQueryPlugin(Popover);
var NAME$2 = "scrollspy";
var DATA_KEY$2 = "bs.scrollspy";
var EVENT_KEY$2 = `.${DATA_KEY$2}`;
var DATA_API_KEY = ".data-api";
var EVENT_ACTIVATE = `activate${EVENT_KEY$2}`;
var EVENT_CLICK = `click${EVENT_KEY$2}`;
var EVENT_LOAD_DATA_API$1 = `load${EVENT_KEY$2}${DATA_API_KEY}`;
var CLASS_NAME_DROPDOWN_ITEM = "dropdown-item";
var CLASS_NAME_ACTIVE$1 = "active";
var SELECTOR_DATA_SPY = '[data-bs-spy="scroll"]';
var SELECTOR_TARGET_LINKS = "[href]";
var SELECTOR_NAV_LIST_GROUP = ".nav, .list-group";
var SELECTOR_NAV_LINKS = ".nav-link";
var SELECTOR_NAV_ITEMS = ".nav-item";
var SELECTOR_LIST_ITEMS = ".list-group-item";
var SELECTOR_LINK_ITEMS = `${SELECTOR_NAV_LINKS}, ${SELECTOR_NAV_ITEMS} > ${SELECTOR_NAV_LINKS}, ${SELECTOR_LIST_ITEMS}`;
var SELECTOR_DROPDOWN = ".dropdown";
var SELECTOR_DROPDOWN_TOGGLE$1 = ".dropdown-toggle";
var Default$1 = {
  offset: null,
  // TODO: v6 @deprecated, keep it for backwards compatibility reasons
  rootMargin: "0px 0px -25%",
  smoothScroll: false,
  target: null,
  threshold: [0.1, 0.5, 1]
};
var DefaultType$1 = {
  offset: "(number|null)",
  // TODO v6 @deprecated, keep it for backwards compatibility reasons
  rootMargin: "string",
  smoothScroll: "boolean",
  target: "element",
  threshold: "array"
};
var ScrollSpy = class _ScrollSpy extends BaseComponent {
  constructor(element, config) {
    super(element, config);
    this._targetLinks = /* @__PURE__ */ new Map();
    this._observableSections = /* @__PURE__ */ new Map();
    this._rootElement = getComputedStyle(this._element).overflowY === "visible" ? null : this._element;
    this._activeTarget = null;
    this._observer = null;
    this._previousScrollData = {
      visibleEntryTop: 0,
      parentScrollTop: 0
    };
    this.refresh();
  }
  // Getters
  static get Default() {
    return Default$1;
  }
  static get DefaultType() {
    return DefaultType$1;
  }
  static get NAME() {
    return NAME$2;
  }
  // Public
  refresh() {
    this._initializeTargetsAndObservables();
    this._maybeEnableSmoothScroll();
    if (this._observer) {
      this._observer.disconnect();
    } else {
      this._observer = this._getNewObserver();
    }
    for (const section of this._observableSections.values()) {
      this._observer.observe(section);
    }
  }
  dispose() {
    this._observer.disconnect();
    super.dispose();
  }
  // Private
  _configAfterMerge(config) {
    config.target = getElement(config.target) || document.body;
    config.rootMargin = config.offset ? `${config.offset}px 0px -30%` : config.rootMargin;
    if (typeof config.threshold === "string") {
      config.threshold = config.threshold.split(",").map((value) => Number.parseFloat(value));
    }
    return config;
  }
  _maybeEnableSmoothScroll() {
    if (!this._config.smoothScroll) {
      return;
    }
    EventHandler.off(this._config.target, EVENT_CLICK);
    EventHandler.on(this._config.target, EVENT_CLICK, SELECTOR_TARGET_LINKS, (event) => {
      const observableSection = this._observableSections.get(event.target.hash);
      if (observableSection) {
        event.preventDefault();
        const root = this._rootElement || window;
        const height = observableSection.offsetTop - this._element.offsetTop;
        if (root.scrollTo) {
          root.scrollTo({
            top: height,
            behavior: "smooth"
          });
          return;
        }
        root.scrollTop = height;
      }
    });
  }
  _getNewObserver() {
    const options = {
      root: this._rootElement,
      threshold: this._config.threshold,
      rootMargin: this._config.rootMargin
    };
    return new IntersectionObserver((entries) => this._observerCallback(entries), options);
  }
  // The logic of selection
  _observerCallback(entries) {
    const targetElement = (entry) => this._targetLinks.get(`#${entry.target.id}`);
    const activate = (entry) => {
      this._previousScrollData.visibleEntryTop = entry.target.offsetTop;
      this._process(targetElement(entry));
    };
    const parentScrollTop = (this._rootElement || document.documentElement).scrollTop;
    const userScrollsDown = parentScrollTop >= this._previousScrollData.parentScrollTop;
    this._previousScrollData.parentScrollTop = parentScrollTop;
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        this._activeTarget = null;
        this._clearActiveClass(targetElement(entry));
        continue;
      }
      const entryIsLowerThanPrevious = entry.target.offsetTop >= this._previousScrollData.visibleEntryTop;
      if (userScrollsDown && entryIsLowerThanPrevious) {
        activate(entry);
        if (!parentScrollTop) {
          return;
        }
        continue;
      }
      if (!userScrollsDown && !entryIsLowerThanPrevious) {
        activate(entry);
      }
    }
  }
  _initializeTargetsAndObservables() {
    this._targetLinks = /* @__PURE__ */ new Map();
    this._observableSections = /* @__PURE__ */ new Map();
    const targetLinks = SelectorEngine.find(SELECTOR_TARGET_LINKS, this._config.target);
    for (const anchor of targetLinks) {
      if (!anchor.hash || isDisabled(anchor)) {
        continue;
      }
      const observableSection = SelectorEngine.findOne(decodeURI(anchor.hash), this._element);
      if (isVisible(observableSection)) {
        this._targetLinks.set(decodeURI(anchor.hash), anchor);
        this._observableSections.set(anchor.hash, observableSection);
      }
    }
  }
  _process(target) {
    if (this._activeTarget === target) {
      return;
    }
    this._clearActiveClass(this._config.target);
    this._activeTarget = target;
    target.classList.add(CLASS_NAME_ACTIVE$1);
    this._activateParents(target);
    EventHandler.trigger(this._element, EVENT_ACTIVATE, {
      relatedTarget: target
    });
  }
  _activateParents(target) {
    if (target.classList.contains(CLASS_NAME_DROPDOWN_ITEM)) {
      SelectorEngine.findOne(SELECTOR_DROPDOWN_TOGGLE$1, target.closest(SELECTOR_DROPDOWN)).classList.add(CLASS_NAME_ACTIVE$1);
      return;
    }
    for (const listGroup of SelectorEngine.parents(target, SELECTOR_NAV_LIST_GROUP)) {
      for (const item of SelectorEngine.prev(listGroup, SELECTOR_LINK_ITEMS)) {
        item.classList.add(CLASS_NAME_ACTIVE$1);
      }
    }
  }
  _clearActiveClass(parent) {
    parent.classList.remove(CLASS_NAME_ACTIVE$1);
    const activeNodes = SelectorEngine.find(`${SELECTOR_TARGET_LINKS}.${CLASS_NAME_ACTIVE$1}`, parent);
    for (const node of activeNodes) {
      node.classList.remove(CLASS_NAME_ACTIVE$1);
    }
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _ScrollSpy.getOrCreateInstance(this, config);
      if (typeof config !== "string") {
        return;
      }
      if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
        throw new TypeError(`No method named "${config}"`);
      }
      data[config]();
    });
  }
};
EventHandler.on(window, EVENT_LOAD_DATA_API$1, () => {
  for (const spy of SelectorEngine.find(SELECTOR_DATA_SPY)) {
    ScrollSpy.getOrCreateInstance(spy);
  }
});
defineJQueryPlugin(ScrollSpy);
var NAME$1 = "tab";
var DATA_KEY$1 = "bs.tab";
var EVENT_KEY$1 = `.${DATA_KEY$1}`;
var EVENT_HIDE$1 = `hide${EVENT_KEY$1}`;
var EVENT_HIDDEN$1 = `hidden${EVENT_KEY$1}`;
var EVENT_SHOW$1 = `show${EVENT_KEY$1}`;
var EVENT_SHOWN$1 = `shown${EVENT_KEY$1}`;
var EVENT_CLICK_DATA_API = `click${EVENT_KEY$1}`;
var EVENT_KEYDOWN = `keydown${EVENT_KEY$1}`;
var EVENT_LOAD_DATA_API = `load${EVENT_KEY$1}`;
var ARROW_LEFT_KEY = "ArrowLeft";
var ARROW_RIGHT_KEY = "ArrowRight";
var ARROW_UP_KEY = "ArrowUp";
var ARROW_DOWN_KEY = "ArrowDown";
var HOME_KEY = "Home";
var END_KEY = "End";
var CLASS_NAME_ACTIVE = "active";
var CLASS_NAME_FADE$1 = "fade";
var CLASS_NAME_SHOW$1 = "show";
var CLASS_DROPDOWN = "dropdown";
var SELECTOR_DROPDOWN_TOGGLE = ".dropdown-toggle";
var SELECTOR_DROPDOWN_MENU = ".dropdown-menu";
var NOT_SELECTOR_DROPDOWN_TOGGLE = `:not(${SELECTOR_DROPDOWN_TOGGLE})`;
var SELECTOR_TAB_PANEL = '.list-group, .nav, [role="tablist"]';
var SELECTOR_OUTER = ".nav-item, .list-group-item";
var SELECTOR_INNER = `.nav-link${NOT_SELECTOR_DROPDOWN_TOGGLE}, .list-group-item${NOT_SELECTOR_DROPDOWN_TOGGLE}, [role="tab"]${NOT_SELECTOR_DROPDOWN_TOGGLE}`;
var SELECTOR_DATA_TOGGLE = '[data-bs-toggle="tab"], [data-bs-toggle="pill"], [data-bs-toggle="list"]';
var SELECTOR_INNER_ELEM = `${SELECTOR_INNER}, ${SELECTOR_DATA_TOGGLE}`;
var SELECTOR_DATA_TOGGLE_ACTIVE = `.${CLASS_NAME_ACTIVE}[data-bs-toggle="tab"], .${CLASS_NAME_ACTIVE}[data-bs-toggle="pill"], .${CLASS_NAME_ACTIVE}[data-bs-toggle="list"]`;
var Tab = class _Tab extends BaseComponent {
  constructor(element) {
    super(element);
    this._parent = this._element.closest(SELECTOR_TAB_PANEL);
    if (!this._parent) {
      return;
    }
    this._setInitialAttributes(this._parent, this._getChildren());
    EventHandler.on(this._element, EVENT_KEYDOWN, (event) => this._keydown(event));
  }
  // Getters
  static get NAME() {
    return NAME$1;
  }
  // Public
  show() {
    const innerElem = this._element;
    if (this._elemIsActive(innerElem)) {
      return;
    }
    const active = this._getActiveElem();
    const hideEvent = active ? EventHandler.trigger(active, EVENT_HIDE$1, {
      relatedTarget: innerElem
    }) : null;
    const showEvent = EventHandler.trigger(innerElem, EVENT_SHOW$1, {
      relatedTarget: active
    });
    if (showEvent.defaultPrevented || hideEvent && hideEvent.defaultPrevented) {
      return;
    }
    this._deactivate(active, innerElem);
    this._activate(innerElem, active);
  }
  // Private
  _activate(element, relatedElem) {
    if (!element) {
      return;
    }
    element.classList.add(CLASS_NAME_ACTIVE);
    this._activate(SelectorEngine.getElementFromSelector(element));
    const complete = () => {
      if (element.getAttribute("role") !== "tab") {
        element.classList.add(CLASS_NAME_SHOW$1);
        return;
      }
      element.removeAttribute("tabindex");
      element.setAttribute("aria-selected", true);
      this._toggleDropDown(element, true);
      EventHandler.trigger(element, EVENT_SHOWN$1, {
        relatedTarget: relatedElem
      });
    };
    this._queueCallback(complete, element, element.classList.contains(CLASS_NAME_FADE$1));
  }
  _deactivate(element, relatedElem) {
    if (!element) {
      return;
    }
    element.classList.remove(CLASS_NAME_ACTIVE);
    element.blur();
    this._deactivate(SelectorEngine.getElementFromSelector(element));
    const complete = () => {
      if (element.getAttribute("role") !== "tab") {
        element.classList.remove(CLASS_NAME_SHOW$1);
        return;
      }
      element.setAttribute("aria-selected", false);
      element.setAttribute("tabindex", "-1");
      this._toggleDropDown(element, false);
      EventHandler.trigger(element, EVENT_HIDDEN$1, {
        relatedTarget: relatedElem
      });
    };
    this._queueCallback(complete, element, element.classList.contains(CLASS_NAME_FADE$1));
  }
  _keydown(event) {
    if (![ARROW_LEFT_KEY, ARROW_RIGHT_KEY, ARROW_UP_KEY, ARROW_DOWN_KEY, HOME_KEY, END_KEY].includes(event.key)) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    const children = this._getChildren().filter((element) => !isDisabled(element));
    let nextActiveElement;
    if ([HOME_KEY, END_KEY].includes(event.key)) {
      nextActiveElement = children[event.key === HOME_KEY ? 0 : children.length - 1];
    } else {
      const isNext = [ARROW_RIGHT_KEY, ARROW_DOWN_KEY].includes(event.key);
      nextActiveElement = getNextActiveElement(children, event.target, isNext, true);
    }
    if (nextActiveElement) {
      nextActiveElement.focus({
        preventScroll: true
      });
      _Tab.getOrCreateInstance(nextActiveElement).show();
    }
  }
  _getChildren() {
    return SelectorEngine.find(SELECTOR_INNER_ELEM, this._parent);
  }
  _getActiveElem() {
    return this._getChildren().find((child) => this._elemIsActive(child)) || null;
  }
  _setInitialAttributes(parent, children) {
    this._setAttributeIfNotExists(parent, "role", "tablist");
    for (const child of children) {
      this._setInitialAttributesOnChild(child);
    }
  }
  _setInitialAttributesOnChild(child) {
    child = this._getInnerElement(child);
    const isActive = this._elemIsActive(child);
    const outerElem = this._getOuterElement(child);
    child.setAttribute("aria-selected", isActive);
    if (outerElem !== child) {
      this._setAttributeIfNotExists(outerElem, "role", "presentation");
    }
    if (!isActive) {
      child.setAttribute("tabindex", "-1");
    }
    this._setAttributeIfNotExists(child, "role", "tab");
    this._setInitialAttributesOnTargetPanel(child);
  }
  _setInitialAttributesOnTargetPanel(child) {
    const target = SelectorEngine.getElementFromSelector(child);
    if (!target) {
      return;
    }
    this._setAttributeIfNotExists(target, "role", "tabpanel");
    if (child.id) {
      this._setAttributeIfNotExists(target, "aria-labelledby", `${child.id}`);
    }
  }
  _toggleDropDown(element, open) {
    const outerElem = this._getOuterElement(element);
    if (!outerElem.classList.contains(CLASS_DROPDOWN)) {
      return;
    }
    const toggle = (selector, className) => {
      const element2 = SelectorEngine.findOne(selector, outerElem);
      if (element2) {
        element2.classList.toggle(className, open);
      }
    };
    toggle(SELECTOR_DROPDOWN_TOGGLE, CLASS_NAME_ACTIVE);
    toggle(SELECTOR_DROPDOWN_MENU, CLASS_NAME_SHOW$1);
    outerElem.setAttribute("aria-expanded", open);
  }
  _setAttributeIfNotExists(element, attribute, value) {
    if (!element.hasAttribute(attribute)) {
      element.setAttribute(attribute, value);
    }
  }
  _elemIsActive(elem) {
    return elem.classList.contains(CLASS_NAME_ACTIVE);
  }
  // Try to get the inner element (usually the .nav-link)
  _getInnerElement(elem) {
    return elem.matches(SELECTOR_INNER_ELEM) ? elem : SelectorEngine.findOne(SELECTOR_INNER_ELEM, elem);
  }
  // Try to get the outer element (usually the .nav-item)
  _getOuterElement(elem) {
    return elem.closest(SELECTOR_OUTER) || elem;
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _Tab.getOrCreateInstance(this);
      if (typeof config !== "string") {
        return;
      }
      if (data[config] === void 0 || config.startsWith("_") || config === "constructor") {
        throw new TypeError(`No method named "${config}"`);
      }
      data[config]();
    });
  }
};
EventHandler.on(document, EVENT_CLICK_DATA_API, SELECTOR_DATA_TOGGLE, function(event) {
  if (["A", "AREA"].includes(this.tagName)) {
    event.preventDefault();
  }
  if (isDisabled(this)) {
    return;
  }
  Tab.getOrCreateInstance(this).show();
});
EventHandler.on(window, EVENT_LOAD_DATA_API, () => {
  for (const element of SelectorEngine.find(SELECTOR_DATA_TOGGLE_ACTIVE)) {
    Tab.getOrCreateInstance(element);
  }
});
defineJQueryPlugin(Tab);
var NAME = "toast";
var DATA_KEY = "bs.toast";
var EVENT_KEY = `.${DATA_KEY}`;
var EVENT_MOUSEOVER = `mouseover${EVENT_KEY}`;
var EVENT_MOUSEOUT = `mouseout${EVENT_KEY}`;
var EVENT_FOCUSIN = `focusin${EVENT_KEY}`;
var EVENT_FOCUSOUT = `focusout${EVENT_KEY}`;
var EVENT_HIDE = `hide${EVENT_KEY}`;
var EVENT_HIDDEN = `hidden${EVENT_KEY}`;
var EVENT_SHOW = `show${EVENT_KEY}`;
var EVENT_SHOWN = `shown${EVENT_KEY}`;
var CLASS_NAME_FADE = "fade";
var CLASS_NAME_HIDE = "hide";
var CLASS_NAME_SHOW = "show";
var CLASS_NAME_SHOWING = "showing";
var DefaultType = {
  animation: "boolean",
  autohide: "boolean",
  delay: "number"
};
var Default = {
  animation: true,
  autohide: true,
  delay: 5e3
};
var Toast = class _Toast extends BaseComponent {
  constructor(element, config) {
    super(element, config);
    this._timeout = null;
    this._hasMouseInteraction = false;
    this._hasKeyboardInteraction = false;
    this._setListeners();
  }
  // Getters
  static get Default() {
    return Default;
  }
  static get DefaultType() {
    return DefaultType;
  }
  static get NAME() {
    return NAME;
  }
  // Public
  show() {
    const showEvent = EventHandler.trigger(this._element, EVENT_SHOW);
    if (showEvent.defaultPrevented) {
      return;
    }
    this._clearTimeout();
    if (this._config.animation) {
      this._element.classList.add(CLASS_NAME_FADE);
    }
    const complete = () => {
      this._element.classList.remove(CLASS_NAME_SHOWING);
      EventHandler.trigger(this._element, EVENT_SHOWN);
      this._maybeScheduleHide();
    };
    this._element.classList.remove(CLASS_NAME_HIDE);
    reflow(this._element);
    this._element.classList.add(CLASS_NAME_SHOW, CLASS_NAME_SHOWING);
    this._queueCallback(complete, this._element, this._config.animation);
  }
  hide() {
    if (!this.isShown()) {
      return;
    }
    const hideEvent = EventHandler.trigger(this._element, EVENT_HIDE);
    if (hideEvent.defaultPrevented) {
      return;
    }
    const complete = () => {
      this._element.classList.add(CLASS_NAME_HIDE);
      this._element.classList.remove(CLASS_NAME_SHOWING, CLASS_NAME_SHOW);
      EventHandler.trigger(this._element, EVENT_HIDDEN);
    };
    this._element.classList.add(CLASS_NAME_SHOWING);
    this._queueCallback(complete, this._element, this._config.animation);
  }
  dispose() {
    this._clearTimeout();
    if (this.isShown()) {
      this._element.classList.remove(CLASS_NAME_SHOW);
    }
    super.dispose();
  }
  isShown() {
    return this._element.classList.contains(CLASS_NAME_SHOW);
  }
  // Private
  _maybeScheduleHide() {
    if (!this._config.autohide) {
      return;
    }
    if (this._hasMouseInteraction || this._hasKeyboardInteraction) {
      return;
    }
    this._timeout = setTimeout(() => {
      this.hide();
    }, this._config.delay);
  }
  _onInteraction(event, isInteracting) {
    switch (event.type) {
      case "mouseover":
      case "mouseout": {
        this._hasMouseInteraction = isInteracting;
        break;
      }
      case "focusin":
      case "focusout": {
        this._hasKeyboardInteraction = isInteracting;
        break;
      }
    }
    if (isInteracting) {
      this._clearTimeout();
      return;
    }
    const nextElement = event.relatedTarget;
    if (this._element === nextElement || this._element.contains(nextElement)) {
      return;
    }
    this._maybeScheduleHide();
  }
  _setListeners() {
    EventHandler.on(this._element, EVENT_MOUSEOVER, (event) => this._onInteraction(event, true));
    EventHandler.on(this._element, EVENT_MOUSEOUT, (event) => this._onInteraction(event, false));
    EventHandler.on(this._element, EVENT_FOCUSIN, (event) => this._onInteraction(event, true));
    EventHandler.on(this._element, EVENT_FOCUSOUT, (event) => this._onInteraction(event, false));
  }
  _clearTimeout() {
    clearTimeout(this._timeout);
    this._timeout = null;
  }
  // Static
  static jQueryInterface(config) {
    return this.each(function() {
      const data = _Toast.getOrCreateInstance(this, config);
      if (typeof config === "string") {
        if (typeof data[config] === "undefined") {
          throw new TypeError(`No method named "${config}"`);
        }
        data[config](this);
      }
    });
  }
};
enableDismissTrigger(Toast);
defineJQueryPlugin(Toast);

// src/vendor.js
var import_huebee = __toESM(require_huebee(), 1);

// node_modules/.pnpm/jsurl2@2.2.0/node_modules/jsurl2/dist/index.mjs
var dist_exports = {};
__export(dist_exports, {
  parse: () => Z,
  stringify: () => m,
  tryParse: () => E
});
var S = /^[a-zA-Z]/;
var D = /^[\d-]/;
var g = "_N";
var y = { T: true, F: false, N: null, U: void 0, n: NaN, I: 1 / 0, J: -1 / 0 };
var J = { "*": "*", _: "_", "-": "~", S: "$", P: "+", '"': "'", C: "(", D: ")", L: "<", G: ">", ".": "%", Q: "?", H: "#", A: "&", E: "=", B: "\\", N: `
`, R: "\r", U: "\u2028", V: "\u2029", Z: "\0" };
var b = { "*": "*", _: "_", "~": "-", $: "S", "+": "P", "'": '"', "(": "C", ")": "D", "<": "L", ">": "G", "%": ".", "?": "Q", "#": "H", "&": "A", "=": "E", "\\": "B", "\n": "N", "\r": "R", "\0": "Z", "\u2028": "U", "\u2029": "V" };
var p = (e, t) => {
  throw Error(`${e} ${JSON.stringify(t)}`);
};
var O = (e) => {
  if (e === "_")
    return " ";
  const t = J[e.charAt(1)];
  return t || p("Illegal escape code", e), t;
};
var C = (e) => e === " " ? "_" : "*" + b[e];
var A = /(_|\*.)/g;
var a = (e) => A.test(e) ? e.replace(A, O) : e;
var $ = /([*_~$+'() <>%?#&=\\\n\r\0\u2028\u2029])/g;
var I = (e) => $.test(e) ? e.replace($, C) : e;
var c = (e) => {
  let t, s;
  for (t = e.t; t < e.o && (s = e.l.charAt(t), s !== "~" && s !== ")"); t++)
    ;
  const l3 = e.l.slice(e.t, t);
  return s === "~" && t++, e.t = t, l3;
};
var h = (e) => e.l.charAt(e.t);
var f = (e) => {
  e.t++;
};
var U = {};
var d = (e) => {
  let t, s, l3 = h(e);
  if (!l3)
    return U;
  if (l3 === "(") {
    let r;
    for (f(e), t = {}; l3 = h(e), l3 && l3 !== ")"; )
      s = a(c(e)), l3 = h(e), r = !l3 || l3 === ")" || d(e), t[s] = r;
    l3 === ")" && f(e);
  } else if (l3 === "!") {
    for (f(e), t = []; l3 = h(e), l3 && l3 !== "~" && l3 !== ")"; )
      t.push(d(e));
    l3 === "~" && f(e);
  } else
    l3 === "_" ? (f(e), s = a(c(e)), s.charAt(0) === "D" ? t = new Date(s.slice(1)) : s in y ? t = y[s] : p("Unknown dict reference", s)) : l3 === "*" ? (f(e), t = a(c(e))) : l3 === "~" ? (f(e), t = true) : D.test(l3) ? (t = +c(e), isNaN(t) && p("Not a number", l3)) : S.test(l3) ? t = a(c(e)) : p("Cannot decode part ", e.l.slice(e.t, e.t + 10));
  return t;
};
var _ = (e, t, s, l3) => {
  let r, i = typeof e;
  if (i === "number")
    t.push(isFinite(e) ? e.toString() : s ? isNaN(e) ? "_n" : e > 0 ? "_I" : "_J" : g);
  else if (i === "boolean")
    t.push(e ? "" : "_F");
  else if (i === "string")
    r = I(e), S.test(r) ? t.push(r) : t.push("*" + r);
  else if (i === "object")
    if (e)
      if (s && e instanceof Date)
        t.push("_D" + e.toJSON().replace("T00:00:00.000Z", ""));
      else if (typeof e.toJSON == "function")
        _(e.toJSON(), t, s, l3);
      else if (Array.isArray(e)) {
        t.push("!");
        for (let n = 0; n < e.length; n++)
          r = e[n], r === true ? t.push("_T") : _(r, t, s, l3 + 1);
        t.push("");
      } else {
        t.push("(");
        for (const n of Object.keys(e))
          r = e[n], r !== void 0 && typeof r != "function" && (t.push(I(n)), _(r, t, s, l3 + 1));
        for (; t[t.length - 1] === ""; )
          t.pop();
        t.push(")");
      }
    else
      t.push(g);
  else
    t.push(s || l3 === 0 ? "_U" : g);
};
var w = { true: "*true", false: "*false", null: "*null" };
var m = (e, t) => {
  let s, l3 = [], r = "", i = false, n = t?.short, o = t?.rich;
  _(e, l3, o, 0);
  let u = l3.length;
  do
    s = l3[--u];
  while (s === "" || n && s === ")");
  for (let N2 = 0; u >= N2; N2++)
    s = l3[N2], i && s !== ")" && (r += "~"), r += s, i = !(s === "!" || s === "(" || s === ")");
  return n ? 6 > r.length && (s = w[r], s && (r = s)) : r += "~", r;
};
var R = /^({|\[|"|true$|false$|null$)/;
var Z = (e, t) => {
  if (t && t.deURI && (e = ((r) => {
    let i, n = "", o = 0, u = 0;
    for (; o < r.length; )
      i = r.charCodeAt(o), i === 37 ? (o > u && (n += r.slice(u, o)), r = decodeURIComponent(r.slice(o)), o = u = 0) : i === 32 || i === 10 || i === 13 || i === 0 || i === 8232 || i === 8233 ? (o > u && (n += r.slice(u, o)), o++, u = o) : o++;
    return o > u && (n += r.slice(u, o)), n;
  })(e)), R.test(e))
    return JSON.parse(e);
  const s = e.length, l3 = d({ l: e, t: 0, o: s });
  return l3 === U || l3;
};
var E = (e, t, s) => {
  try {
    return Z(e, s);
  } catch {
    return t;
  }
};

// src/vendor.js
var FilePond = __toESM(require_filepond(), 1);
var import_sweetalert2 = __toESM(require_sweetalert2_all(), 1);

// node_modules/.pnpm/marked@18.0.3/node_modules/marked/lib/marked.esm.js
function z() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var T = z();
function G(l3) {
  T = l3;
}
var _2 = { exec: () => null };
function d2(l3, e = "") {
  let t = typeof l3 == "string" ? l3 : l3.source, n = { replace: (s, r) => {
    let i = typeof r == "string" ? r : r.source;
    return i = i.replace(m2.caret, "$1"), t = t.replace(s, i), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var Re = ((l3 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + l3);
  } catch {
    return false;
  }
})();
var m2 = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l3) => new RegExp(`^( {0,3}${l3})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`), hrRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`), fencesBeginRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}(?:\`\`\`|~~~)`), headingBeginRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}#`), htmlBeginRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}<(?:[a-z].*>|!--)`, "i"), blockquoteBeginRegex: (l3) => new RegExp(`^ {0,${Math.min(3, l3 - 1)}}>`) };
var Te = /^(?:[ \t]*(?:\n|$))+/;
var Oe = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var we = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var I2 = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var ye = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var Q = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
var ie = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var oe = d2(ie).replace(/bull/g, Q).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Pe = d2(ie).replace(/bull/g, Q).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var j = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var Se = /^[^\n]+/;
var F = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var $e = d2(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", F).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var Le = d2(/^(bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, Q).getRegex();
var v = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var U2 = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var _e = d2("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", U2).replace("tag", v).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var ae = d2(j).replace("hr", I2).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex();
var Me = d2(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", ae).getRegex();
var K = { blockquote: Me, code: Oe, def: $e, fences: we, heading: ye, hr: I2, html: _e, lheading: oe, list: Le, newline: Te, paragraph: ae, table: _2, text: Se };
var re = d2("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", I2).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex();
var ze = { ...K, lheading: Pe, table: re, paragraph: d2(j).replace("hr", I2).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", re).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", v).getRegex() };
var Ee = { ...K, html: d2(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", U2).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: _2, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: d2(j).replace("hr", I2).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", oe).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Ae = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var Ce = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var le = /^( {2,}|\\)\n(?!\s*$)/;
var Ie = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var E2 = /[\p{P}\p{S}]/u;
var H = /[\s\p{P}\p{S}]/u;
var W = /[^\s\p{P}\p{S}]/u;
var Be = d2(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, H).getRegex();
var ue = /(?!~)[\p{P}\p{S}]/u;
var De = /(?!~)[\s\p{P}\p{S}]/u;
var qe = /(?:[^\s\p{P}\p{S}]|~)/u;
var ve = d2(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Re ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var pe = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
var He = d2(pe, "u").replace(/punct/g, E2).getRegex();
var Ze = d2(pe, "u").replace(/punct/g, ue).getRegex();
var ce = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var Ge = d2(ce, "gu").replace(/notPunctSpace/g, W).replace(/punctSpace/g, H).replace(/punct/g, E2).getRegex();
var Ne = d2(ce, "gu").replace(/notPunctSpace/g, qe).replace(/punctSpace/g, De).replace(/punct/g, ue).getRegex();
var Qe = d2("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, W).replace(/punctSpace/g, H).replace(/punct/g, E2).getRegex();
var je = d2(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, E2).getRegex();
var Fe = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)";
var Ue = d2(Fe, "gu").replace(/notPunctSpace/g, W).replace(/punctSpace/g, H).replace(/punct/g, E2).getRegex();
var Ke = d2(/\\(punct)/, "gu").replace(/punct/g, E2).getRegex();
var We = d2(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var Xe = d2(U2).replace("(?:-->|$)", "-->").getRegex();
var Je = d2("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Xe).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var q = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/;
var Ve = d2(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", q).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var he = d2(/^!?\[(label)\]\[(ref)\]/).replace("label", q).replace("ref", F).getRegex();
var ke = d2(/^!?\[(ref)\](?:\[\])?/).replace("ref", F).getRegex();
var Ye = d2("reflink|nolink(?!\\()", "g").replace("reflink", he).replace("nolink", ke).getRegex();
var se = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var X = { _backpedal: _2, anyPunctuation: Ke, autolink: We, blockSkip: ve, br: le, code: Ce, del: _2, delLDelim: _2, delRDelim: _2, emStrongLDelim: He, emStrongRDelimAst: Ge, emStrongRDelimUnd: Qe, escape: Ae, link: Ve, nolink: ke, punctuation: Be, reflink: he, reflinkSearch: Ye, tag: Je, text: Ie, url: _2 };
var et = { ...X, link: d2(/^!?\[(label)\]\((.*?)\)/).replace("label", q).getRegex(), reflink: d2(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", q).getRegex() };
var N = { ...X, emStrongRDelimAst: Ne, emStrongLDelim: Ze, delLDelim: je, delRDelim: Ue, url: d2(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", se).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: d2(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", se).getRegex() };
var tt = { ...N, br: d2(le).replace("{2,}", "*").getRegex(), text: d2(N.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var B = { normal: K, gfm: ze, pedantic: Ee };
var A2 = { normal: X, gfm: N, breaks: tt, pedantic: et };
var nt = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var de = (l3) => nt[l3];
function O2(l3, e) {
  if (e) {
    if (m2.escapeTest.test(l3)) return l3.replace(m2.escapeReplace, de);
  } else if (m2.escapeTestNoEncode.test(l3)) return l3.replace(m2.escapeReplaceNoEncode, de);
  return l3;
}
function J2(l3) {
  try {
    l3 = encodeURI(l3).replace(m2.percentDecode, "%");
  } catch {
    return null;
  }
  return l3;
}
function V(l3, e) {
  let t = l3.replace(m2.findPipe, (r, i, o) => {
    let u = false, a2 = i;
    for (; --a2 >= 0 && o[a2] === "\\"; ) u = !u;
    return u ? "|" : " |";
  }), n = t.split(m2.splitPipe), s = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; s < n.length; s++) n[s] = n[s].trim().replace(m2.slashPipe, "|");
  return n;
}
function $2(l3, e, t) {
  let n = l3.length;
  if (n === 0) return "";
  let s = 0;
  for (; s < n; ) {
    let r = l3.charAt(n - s - 1);
    if (r === e && !t) s++;
    else if (r !== e && t) s++;
    else break;
  }
  return l3.slice(0, n - s);
}
function Y(l3) {
  let e = l3.split(`
`), t = e.length - 1;
  for (; t >= 0 && m2.blankLine.test(e[t]); ) t--;
  return e.length - t <= 2 ? l3 : e.slice(0, t + 1).join(`
`);
}
function ge(l3, e) {
  if (l3.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < l3.length; n++) if (l3[n] === "\\") n++;
  else if (l3[n] === e[0]) t++;
  else if (l3[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
function fe(l3, e = 0) {
  let t = e, n = "";
  for (let s of l3) if (s === "	") {
    let r = 4 - t % 4;
    n += " ".repeat(r), t += r;
  } else n += s, t++;
  return n;
}
function me(l3, e, t, n, s) {
  let r = e.href, i = e.title || null, o = l3[1].replace(s.other.outputLinkReplace, "$1");
  n.state.inLink = true;
  let u = { type: l3[0].charAt(0) === "!" ? "image" : "link", raw: t, href: r, title: i, text: o, tokens: n.inlineTokens(o) };
  return n.state.inLink = false, u;
}
function rt(l3, e, t) {
  let n = l3.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let s = n[1];
  return e.split(`
`).map((r) => {
    let i = r.match(t.other.beginningSpace);
    if (i === null) return r;
    let [o] = i;
    return o.length >= s.length ? r.slice(s.length) : r;
  }).join(`
`);
}
var w2 = class {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "rules");
    __publicField(this, "lexer");
    this.options = e || T;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0) return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = this.options.pedantic ? t[0] : Y(t[0]), s = n.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n, codeBlockStyle: "indented", text: s };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], s = rt(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: s };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let s = $2(n, "#");
        (this.options.pedantic || !s || this.rules.other.endingSpaceChar.test(s)) && (n = s.trim());
      }
      return { type: "heading", raw: $2(t[0], `
`), depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t) return { type: "hr", raw: $2(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = $2(t[0], `
`).split(`
`), s = "", r = "", i = [];
      for (; n.length > 0; ) {
        let o = false, u = [], a2;
        for (a2 = 0; a2 < n.length; a2++) if (this.rules.other.blockquoteStart.test(n[a2])) u.push(n[a2]), o = true;
        else if (!o) u.push(n[a2]);
        else break;
        n = n.slice(a2);
        let c2 = u.join(`
`), p2 = c2.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        s = s ? `${s}
${c2}` : c2, r = r ? `${r}
${p2}` : p2;
        let k = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(p2, i, true), this.lexer.state.top = k, n.length === 0) break;
        let h2 = i.at(-1);
        if (h2?.type === "code") break;
        if (h2?.type === "blockquote") {
          let R2 = h2, f2 = R2.raw + `
` + n.join(`
`), S2 = this.blockquote(f2);
          i[i.length - 1] = S2, s = s.substring(0, s.length - R2.raw.length) + S2.raw, r = r.substring(0, r.length - R2.text.length) + S2.text;
          break;
        } else if (h2?.type === "list") {
          let R2 = h2, f2 = R2.raw + `
` + n.join(`
`), S2 = this.list(f2);
          i[i.length - 1] = S2, s = s.substring(0, s.length - h2.raw.length) + S2.raw, r = r.substring(0, r.length - R2.raw.length) + S2.raw, n = f2.substring(i.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: s, tokens: i, text: r };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = t[1].trim(), s = n.length > 1, r = { type: "list", raw: "", ordered: s, start: s ? +n.slice(0, -1) : "", loose: false, items: [] };
      n = s ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = s ? n : "[*+-]");
      let i = this.rules.other.listItemRegex(n), o = false;
      for (; e; ) {
        let a2 = false, c2 = "", p2 = "";
        if (!(t = i.exec(e)) || this.rules.block.hr.test(e)) break;
        c2 = t[0], e = e.substring(c2.length);
        let k = fe(t[2].split(`
`, 1)[0], t[1].length), h2 = e.split(`
`, 1)[0], R2 = !k.trim(), f2 = 0;
        if (this.options.pedantic ? (f2 = 2, p2 = k.trimStart()) : R2 ? f2 = t[1].length + 1 : (f2 = k.search(this.rules.other.nonSpaceChar), f2 = f2 > 4 ? 1 : f2, p2 = k.slice(f2), f2 += t[1].length), R2 && this.rules.other.blankLine.test(h2) && (c2 += h2 + `
`, e = e.substring(h2.length + 1), a2 = true), !a2) {
          let S2 = this.rules.other.nextBulletRegex(f2), ee = this.rules.other.hrRegex(f2), te = this.rules.other.fencesBeginRegex(f2), ne = this.rules.other.headingBeginRegex(f2), xe = this.rules.other.htmlBeginRegex(f2), be = this.rules.other.blockquoteBeginRegex(f2);
          for (; e; ) {
            let Z2 = e.split(`
`, 1)[0], C2;
            if (h2 = Z2, this.options.pedantic ? (h2 = h2.replace(this.rules.other.listReplaceNesting, "  "), C2 = h2) : C2 = h2.replace(this.rules.other.tabCharGlobal, "    "), te.test(h2) || ne.test(h2) || xe.test(h2) || be.test(h2) || S2.test(h2) || ee.test(h2)) break;
            if (C2.search(this.rules.other.nonSpaceChar) >= f2 || !h2.trim()) p2 += `
` + C2.slice(f2);
            else {
              if (R2 || k.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || te.test(k) || ne.test(k) || ee.test(k)) break;
              p2 += `
` + h2;
            }
            R2 = !h2.trim(), c2 += Z2 + `
`, e = e.substring(Z2.length + 1), k = C2.slice(f2);
          }
        }
        r.loose || (o ? r.loose = true : this.rules.other.doubleBlankLine.test(c2) && (o = true)), r.items.push({ type: "list_item", raw: c2, task: !!this.options.gfm && this.rules.other.listIsTask.test(p2), loose: false, text: p2, tokens: [] }), r.raw += c2;
      }
      let u = r.items.at(-1);
      if (u) u.raw = u.raw.trimEnd(), u.text = u.text.trimEnd();
      else return;
      r.raw = r.raw.trimEnd();
      for (let a2 of r.items) {
        this.lexer.state.top = false, a2.tokens = this.lexer.blockTokens(a2.text, []);
        let c2 = a2.tokens[0];
        if (a2.task && (c2?.type === "text" || c2?.type === "paragraph")) {
          a2.text = a2.text.replace(this.rules.other.listReplaceTask, ""), c2.raw = c2.raw.replace(this.rules.other.listReplaceTask, ""), c2.text = c2.text.replace(this.rules.other.listReplaceTask, "");
          for (let k = this.lexer.inlineQueue.length - 1; k >= 0; k--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[k].src)) {
            this.lexer.inlineQueue[k].src = this.lexer.inlineQueue[k].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let p2 = this.rules.other.listTaskCheckbox.exec(a2.raw);
          if (p2) {
            let k = { type: "checkbox", raw: p2[0] + " ", checked: p2[0] !== "[ ]" };
            a2.checked = k.checked, r.loose ? a2.tokens[0] && ["paragraph", "text"].includes(a2.tokens[0].type) && "tokens" in a2.tokens[0] && a2.tokens[0].tokens ? (a2.tokens[0].raw = k.raw + a2.tokens[0].raw, a2.tokens[0].text = k.raw + a2.tokens[0].text, a2.tokens[0].tokens.unshift(k)) : a2.tokens.unshift({ type: "paragraph", raw: k.raw, text: k.raw, tokens: [k] }) : a2.tokens.unshift(k);
          }
        } else a2.task && (a2.task = false);
        if (!r.loose) {
          let p2 = a2.tokens.filter((h2) => h2.type === "space"), k = p2.length > 0 && p2.some((h2) => this.rules.other.anyLine.test(h2.raw));
          r.loose = k;
        }
      }
      if (r.loose) for (let a2 of r.items) {
        a2.loose = true;
        for (let c2 of a2.tokens) c2.type === "text" && (c2.type = "paragraph");
      }
      return r;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t) {
      let n = Y(t[0]);
      return { type: "html", block: true, raw: n, pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: n };
    }
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      let n = t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), s = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: $2(t[0], `
`), href: s, title: r };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
    let n = V(t[1]), s = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], i = { type: "table", raw: $2(t[0], `
`), header: [], align: [], rows: [] };
    if (n.length === s.length) {
      for (let o of s) this.rules.other.tableAlignRight.test(o) ? i.align.push("right") : this.rules.other.tableAlignCenter.test(o) ? i.align.push("center") : this.rules.other.tableAlignLeft.test(o) ? i.align.push("left") : i.align.push(null);
      for (let o = 0; o < n.length; o++) i.header.push({ text: n[o], tokens: this.lexer.inline(n[o]), header: true, align: i.align[o] });
      for (let o of r) i.rows.push(V(o, i.header.length).map((u, a2) => ({ text: u, tokens: this.lexer.inline(u), header: false, align: i.align[a2] })));
      return i;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t) {
      let n = t[1].trim();
      return { type: "heading", raw: $2(t[0], `
`), depth: t[2].charAt(0) === "=" ? 1 : 2, text: n, tokens: this.lexer.inline(n) };
    }
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t) return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    let t = this.rules.inline.escape.exec(e);
    if (t) return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    let t = this.rules.inline.tag.exec(e);
    if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    let t = this.rules.inline.link.exec(e);
    if (t) {
      let n = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n)) {
        if (!this.rules.other.endAngleBracket.test(n)) return;
        let i = $2(n.slice(0, -1), "\\");
        if ((n.length - i.length) % 2 === 0) return;
      } else {
        let i = ge(t[2], "()");
        if (i === -2) return;
        if (i > -1) {
          let u = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + i;
          t[2] = t[2].substring(0, i), t[0] = t[0].substring(0, u).trim(), t[3] = "";
        }
      }
      let s = t[2], r = "";
      if (this.options.pedantic) {
        let i = this.rules.other.pedanticHrefTitle.exec(s);
        i && (s = i[1], r = i[3]);
      } else r = t[3] ? t[3].slice(1, -1) : "";
      return s = s.trim(), this.rules.other.startAngleBracket.test(s) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n) ? s = s.slice(1) : s = s.slice(1, -1)), me(t, { href: s && s.replace(this.rules.inline.anyPunctuation, "$1"), title: r && r.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let s = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), r = t[s.toLowerCase()];
      if (!r) {
        let i = n[0].charAt(0);
        return { type: "text", raw: i, text: i };
      }
      return me(n, r, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let s = this.rules.inline.emStrongLDelim.exec(e);
    if (!s || !s[1] && !s[2] && !s[3] && !s[4] || s[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(s[1] || s[3] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, u, a2 = i, c2 = 0, p2 = s[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (p2.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = p2.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o) continue;
        if (u = [...o].length, s[3] || s[4]) {
          a2 += u;
          continue;
        } else if ((s[5] || s[6]) && i % 3 && !((i + u) % 3)) {
          c2 += u;
          continue;
        }
        if (a2 -= u, a2 > 0) continue;
        u = Math.min(u, u + a2 + c2);
        let k = [...s[0]][0].length, h2 = e.slice(0, i + s.index + k + u);
        if (Math.min(i, u) % 2) {
          let f2 = h2.slice(1, -1);
          return { type: "em", raw: h2, text: f2, tokens: this.lexer.inlineTokens(f2) };
        }
        let R2 = h2.slice(2, -2);
        return { type: "strong", raw: h2, text: R2, tokens: this.lexer.inlineTokens(R2) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), s = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return s && r && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t) return { type: "br", raw: t[0] };
  }
  del(e, t, n = "") {
    let s = this.rules.inline.delLDelim.exec(e);
    if (!s) return;
    if (!(s[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, u, a2 = i, c2 = this.rules.inline.delRDelim;
      for (c2.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = c2.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o || (u = [...o].length, u !== i)) continue;
        if (s[3] || s[4]) {
          a2 += u;
          continue;
        }
        if (a2 -= u, a2 > 0) continue;
        u = Math.min(u, u + a2);
        let p2 = [...s[0]][0].length, k = e.slice(0, i + s.index + p2 + u), h2 = k.slice(i, -i);
        return { type: "del", raw: k, text: h2, tokens: this.lexer.inlineTokens(h2) };
      }
    }
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, s;
      return t[2] === "@" ? (n = t[1], s = "mailto:" + n) : (n = t[1], s = n), { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, s;
      if (t[2] === "@") n = t[0], s = "mailto:" + n;
      else {
        let r;
        do
          r = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (r !== t[0]);
        n = t[0], t[1] === "www." ? s = "http://" + t[0] : s = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: t[0], escaped: n };
    }
  }
};
var x = class l {
  constructor(e) {
    __publicField(this, "tokens");
    __publicField(this, "options");
    __publicField(this, "state");
    __publicField(this, "inlineQueue");
    __publicField(this, "tokenizer");
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || T, this.options.tokenizer = this.options.tokenizer || new w2(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t = { other: m2, block: B.normal, inline: A2.normal };
    this.options.pedantic ? (t.block = B.pedantic, t.inline = A2.pedantic) : this.options.gfm && (t.block = B.gfm, this.options.breaks ? t.inline = A2.breaks : t.inline = A2.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: B, inline: A2 };
  }
  static lex(e, t) {
    return new l(t).lex(e);
  }
  static lexInline(e, t) {
    return new l(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(m2.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    this.tokenizer.lexer = this, this.options.pedantic && (e = e.replace(m2.tabCharGlobal, "    ").replace(m2.spaceLine, ""));
    let s = 1 / 0;
    for (; e; ) {
      if (e.length < s) s = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      let r;
      if (this.options.extensions?.block?.some((o) => (r = o.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false)) continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        r.raw.length === 1 && o !== void 0 ? o.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.list(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.html(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.def(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.raw, this.inlineQueue.at(-1).src = o.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
        continue;
      }
      if (r = this.tokenizer.table(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      let i = e;
      if (this.options.extensions?.startBlock) {
        let o = 1 / 0, u = e.slice(1), a2;
        this.options.extensions.startBlock.forEach((c2) => {
          a2 = c2.call({ lexer: this }, u), typeof a2 == "number" && a2 >= 0 && (o = Math.min(o, a2));
        }), o < 1 / 0 && o >= 0 && (i = e.substring(0, o + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(i))) {
        let o = t.at(-1);
        n && o?.type === "paragraph" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r), n = i.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return this.state.top = true, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  inlineTokens(e, t = []) {
    this.tokenizer.lexer = this;
    let n = e, s = null;
    if (this.tokens.links) {
      let a2 = Object.keys(this.tokens.links);
      if (a2.length > 0) for (; (s = this.tokenizer.rules.inline.reflinkSearch.exec(n)) !== null; ) a2.includes(s[0].slice(s[0].lastIndexOf("[") + 1, -1)) && (n = n.slice(0, s.index) + "[" + "a".repeat(s[0].length - 2) + "]" + n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
    }
    for (; (s = this.tokenizer.rules.inline.anyPunctuation.exec(n)) !== null; ) n = n.slice(0, s.index) + "++" + n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    let r;
    for (; (s = this.tokenizer.rules.inline.blockSkip.exec(n)) !== null; ) r = s[2] ? s[2].length : 0, n = n.slice(0, s.index + r) + "[" + "a".repeat(s[0].length - r - 2) + "]" + n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
    let i = false, o = "", u = 1 / 0;
    for (; e; ) {
      if (e.length < u) u = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      i || (o = ""), i = false;
      let a2;
      if (this.options.extensions?.inline?.some((p2) => (a2 = p2.call({ lexer: this }, e, t)) ? (e = e.substring(a2.raw.length), t.push(a2), true) : false)) continue;
      if (a2 = this.tokenizer.escape(e)) {
        e = e.substring(a2.raw.length), t.push(a2);
        continue;
      }
      if (a2 = this.tokenizer.tag(e)) {
        e = e.substring(a2.raw.length), t.push(a2);
        continue;
      }
      if (a2 = this.tokenizer.link(e)) {
        e = e.substring(a2.raw.length), t.push(a2);
        continue;
      }
      if (a2 = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(a2.raw.length);
        let p2 = t.at(-1);
        a2.type === "text" && p2?.type === "text" ? (p2.raw += a2.raw, p2.text += a2.text) : t.push(a2);
        continue;
      }
      if (a2 = this.tokenizer.emStrong(e, n, o)) {
        e = e.substring(a2.raw.length), t.push(a2);
        continue;
      }
      if (a2 = this.tokenizer.codespan(e)) {
        e = e.substring(a2.raw.length), t.push(a2);
        continue;
      }
      if (a2 = this.tokenizer.br(e)) {
        e = e.substring(a2.raw.length), t.push(a2);
        continue;
      }
      if (a2 = this.tokenizer.del(e, n, o)) {
        e = e.substring(a2.raw.length), t.push(a2);
        continue;
      }
      if (a2 = this.tokenizer.autolink(e)) {
        e = e.substring(a2.raw.length), t.push(a2);
        continue;
      }
      if (!this.state.inLink && (a2 = this.tokenizer.url(e))) {
        e = e.substring(a2.raw.length), t.push(a2);
        continue;
      }
      let c2 = e;
      if (this.options.extensions?.startInline) {
        let p2 = 1 / 0, k = e.slice(1), h2;
        this.options.extensions.startInline.forEach((R2) => {
          h2 = R2.call({ lexer: this }, k), typeof h2 == "number" && h2 >= 0 && (p2 = Math.min(p2, h2));
        }), p2 < 1 / 0 && p2 >= 0 && (c2 = e.substring(0, p2 + 1));
      }
      if (a2 = this.tokenizer.inlineText(c2)) {
        e = e.substring(a2.raw.length), a2.raw.slice(-1) !== "_" && (o = a2.raw.slice(-1)), i = true;
        let p2 = t.at(-1);
        p2?.type === "text" ? (p2.raw += a2.raw, p2.text += a2.text) : t.push(a2);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return t;
  }
  infiniteLoopError(e) {
    let t = "Infinite loop on byte: " + e;
    if (this.options.silent) console.error(t);
    else throw new Error(t);
  }
};
var y2 = class {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "parser");
    this.options = e || T;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let s = (t || "").match(m2.notSpaceStart)?.[0], r = e.replace(m2.endingNewline, "") + `
`;
    return s ? '<pre><code class="language-' + O2(s) + '">' + (n ? r : O2(r, true)) + `</code></pre>
` : "<pre><code>" + (n ? r : O2(r, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let t = e.ordered, n = e.start, s = "";
    for (let o = 0; o < e.items.length; o++) {
      let u = e.items[o];
      s += this.listitem(u);
    }
    let r = t ? "ol" : "ul", i = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + r + i + `>
` + s + "</" + r + `>
`;
  }
  listitem(e) {
    return `<li>${this.parser.parse(e.tokens)}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let r = 0; r < e.header.length; r++) n += this.tablecell(e.header[r]);
    t += this.tablerow({ text: n });
    let s = "";
    for (let r = 0; r < e.rows.length; r++) {
      let i = e.rows[r];
      n = "";
      for (let o = 0; o < i.length; o++) n += this.tablecell(i[o]);
      s += this.tablerow({ text: n });
    }
    return s && (s = `<tbody>${s}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + s + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${O2(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, tokens: n }) {
    let s = this.parser.parseInline(n), r = J2(e);
    if (r === null) return s;
    e = r;
    let i = '<a href="' + e + '"';
    return t && (i += ' title="' + O2(t) + '"'), i += ">" + s + "</a>", i;
  }
  image({ href: e, title: t, text: n, tokens: s }) {
    s && (n = this.parser.parseInline(s, this.parser.textRenderer));
    let r = J2(e);
    if (r === null) return O2(n);
    e = r;
    let i = `<img src="${e}" alt="${O2(n)}"`;
    return t && (i += ` title="${O2(t)}"`), i += ">", i;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : O2(e.text);
  }
};
var L = class {
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
  checkbox({ raw: e }) {
    return e;
  }
};
var b2 = class l2 {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "renderer");
    __publicField(this, "textRenderer");
    this.options = e || T, this.options.renderer = this.options.renderer || new y2(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new L();
  }
  static parse(e, t) {
    return new l2(t).parse(e);
  }
  static parseInline(e, t) {
    return new l2(t).parseInline(e);
  }
  parse(e) {
    this.renderer.parser = this;
    let t = "";
    for (let n = 0; n < e.length; n++) {
      let s = e[n];
      if (this.options.extensions?.renderers?.[s.type]) {
        let i = s, o = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (o !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(i.type)) {
          t += o || "";
          continue;
        }
      }
      let r = s;
      switch (r.type) {
        case "space": {
          t += this.renderer.space(r);
          break;
        }
        case "hr": {
          t += this.renderer.hr(r);
          break;
        }
        case "heading": {
          t += this.renderer.heading(r);
          break;
        }
        case "code": {
          t += this.renderer.code(r);
          break;
        }
        case "table": {
          t += this.renderer.table(r);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(r);
          break;
        }
        case "list": {
          t += this.renderer.list(r);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(r);
          break;
        }
        case "html": {
          t += this.renderer.html(r);
          break;
        }
        case "def": {
          t += this.renderer.def(r);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(r);
          break;
        }
        case "text": {
          t += this.renderer.text(r);
          break;
        }
        default: {
          let i = 'Token with "' + r.type + '" type was not found.';
          if (this.options.silent) return console.error(i), "";
          throw new Error(i);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    this.renderer.parser = this;
    let n = "";
    for (let s = 0; s < e.length; s++) {
      let r = e[s];
      if (this.options.extensions?.renderers?.[r.type]) {
        let o = this.options.extensions.renderers[r.type].call({ parser: this }, r);
        if (o !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(r.type)) {
          n += o || "";
          continue;
        }
      }
      let i = r;
      switch (i.type) {
        case "escape": {
          n += t.text(i);
          break;
        }
        case "html": {
          n += t.html(i);
          break;
        }
        case "link": {
          n += t.link(i);
          break;
        }
        case "image": {
          n += t.image(i);
          break;
        }
        case "checkbox": {
          n += t.checkbox(i);
          break;
        }
        case "strong": {
          n += t.strong(i);
          break;
        }
        case "em": {
          n += t.em(i);
          break;
        }
        case "codespan": {
          n += t.codespan(i);
          break;
        }
        case "br": {
          n += t.br(i);
          break;
        }
        case "del": {
          n += t.del(i);
          break;
        }
        case "text": {
          n += t.text(i);
          break;
        }
        default: {
          let o = 'Token with "' + i.type + '" type was not found.';
          if (this.options.silent) return console.error(o), "";
          throw new Error(o);
        }
      }
    }
    return n;
  }
};
var _a;
var P = (_a = class {
  constructor(e) {
    __publicField(this, "options");
    __publicField(this, "block");
    this.options = e || T;
  }
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer(e = this.block) {
    return e ? x.lex : x.lexInline;
  }
  provideParser(e = this.block) {
    return e ? b2.parse : b2.parseInline;
  }
}, __publicField(_a, "passThroughHooks", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"])), __publicField(_a, "passThroughHooksRespectAsync", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"])), _a);
var D2 = class {
  constructor(...e) {
    __publicField(this, "defaults", z());
    __publicField(this, "options", this.setOptions);
    __publicField(this, "parse", this.parseMarkdown(true));
    __publicField(this, "parseInline", this.parseMarkdown(false));
    __publicField(this, "Parser", b2);
    __publicField(this, "Renderer", y2);
    __publicField(this, "TextRenderer", L);
    __publicField(this, "Lexer", x);
    __publicField(this, "Tokenizer", w2);
    __publicField(this, "Hooks", P);
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let s of e) switch (n = n.concat(t.call(this, s)), s.type) {
      case "table": {
        let r = s;
        for (let i of r.header) n = n.concat(this.walkTokens(i.tokens, t));
        for (let i of r.rows) for (let o of i) n = n.concat(this.walkTokens(o.tokens, t));
        break;
      }
      case "list": {
        let r = s;
        n = n.concat(this.walkTokens(r.items, t));
        break;
      }
      default: {
        let r = s;
        this.defaults.extensions?.childTokens?.[r.type] ? this.defaults.extensions.childTokens[r.type].forEach((i) => {
          let o = r[i].flat(1 / 0);
          n = n.concat(this.walkTokens(o, t));
        }) : r.tokens && (n = n.concat(this.walkTokens(r.tokens, t)));
      }
    }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let s = { ...n };
      if (s.async = this.defaults.async || s.async || false, n.extensions && (n.extensions.forEach((r) => {
        if (!r.name) throw new Error("extension name required");
        if ("renderer" in r) {
          let i = t.renderers[r.name];
          i ? t.renderers[r.name] = function(...o) {
            let u = r.renderer.apply(this, o);
            return u === false && (u = i.apply(this, o)), u;
          } : t.renderers[r.name] = r.renderer;
        }
        if ("tokenizer" in r) {
          if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let i = t[r.level];
          i ? i.unshift(r.tokenizer) : t[r.level] = [r.tokenizer], r.start && (r.level === "block" ? t.startBlock ? t.startBlock.push(r.start) : t.startBlock = [r.start] : r.level === "inline" && (t.startInline ? t.startInline.push(r.start) : t.startInline = [r.start]));
        }
        "childTokens" in r && r.childTokens && (t.childTokens[r.name] = r.childTokens);
      }), s.extensions = t), n.renderer) {
        let r = this.defaults.renderer || new y2(this.defaults);
        for (let i in n.renderer) {
          if (!(i in r)) throw new Error(`renderer '${i}' does not exist`);
          if (["options", "parser"].includes(i)) continue;
          let o = i, u = n.renderer[o], a2 = r[o];
          r[o] = (...c2) => {
            let p2 = u.apply(r, c2);
            return p2 === false && (p2 = a2.apply(r, c2)), p2 || "";
          };
        }
        s.renderer = r;
      }
      if (n.tokenizer) {
        let r = this.defaults.tokenizer || new w2(this.defaults);
        for (let i in n.tokenizer) {
          if (!(i in r)) throw new Error(`tokenizer '${i}' does not exist`);
          if (["options", "rules", "lexer"].includes(i)) continue;
          let o = i, u = n.tokenizer[o], a2 = r[o];
          r[o] = (...c2) => {
            let p2 = u.apply(r, c2);
            return p2 === false && (p2 = a2.apply(r, c2)), p2;
          };
        }
        s.tokenizer = r;
      }
      if (n.hooks) {
        let r = this.defaults.hooks || new P();
        for (let i in n.hooks) {
          if (!(i in r)) throw new Error(`hook '${i}' does not exist`);
          if (["options", "block"].includes(i)) continue;
          let o = i, u = n.hooks[o], a2 = r[o];
          P.passThroughHooks.has(i) ? r[o] = (c2) => {
            if (this.defaults.async && P.passThroughHooksRespectAsync.has(i)) return (async () => {
              let k = await u.call(r, c2);
              return a2.call(r, k);
            })();
            let p2 = u.call(r, c2);
            return a2.call(r, p2);
          } : r[o] = (...c2) => {
            if (this.defaults.async) return (async () => {
              let k = await u.apply(r, c2);
              return k === false && (k = await a2.apply(r, c2)), k;
            })();
            let p2 = u.apply(r, c2);
            return p2 === false && (p2 = a2.apply(r, c2)), p2;
          };
        }
        s.hooks = r;
      }
      if (n.walkTokens) {
        let r = this.defaults.walkTokens, i = n.walkTokens;
        s.walkTokens = function(o) {
          let u = [];
          return u.push(i.call(this, o)), r && (u = u.concat(r.call(this, o))), u;
        };
      }
      this.defaults = { ...this.defaults, ...s };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return x.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return b2.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, s) => {
      let r = { ...s }, i = { ...this.defaults, ...r }, o = this.onError(!!i.silent, !!i.async);
      if (this.defaults.async === true && r.async === false) return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null) return o(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string") return o(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (i.hooks && (i.hooks.options = i, i.hooks.block = e), i.async) return (async () => {
        let u = i.hooks ? await i.hooks.preprocess(n) : n, c2 = await (i.hooks ? await i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(u, i), p2 = i.hooks ? await i.hooks.processAllTokens(c2) : c2;
        i.walkTokens && await Promise.all(this.walkTokens(p2, i.walkTokens));
        let h2 = await (i.hooks ? await i.hooks.provideParser(e) : e ? b2.parse : b2.parseInline)(p2, i);
        return i.hooks ? await i.hooks.postprocess(h2) : h2;
      })().catch(o);
      try {
        i.hooks && (n = i.hooks.preprocess(n));
        let a2 = (i.hooks ? i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(n, i);
        i.hooks && (a2 = i.hooks.processAllTokens(a2)), i.walkTokens && this.walkTokens(a2, i.walkTokens);
        let p2 = (i.hooks ? i.hooks.provideParser(e) : e ? b2.parse : b2.parseInline)(a2, i);
        return i.hooks && (p2 = i.hooks.postprocess(p2)), p2;
      } catch (u) {
        return o(u);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let s = "<p>An error occurred:</p><pre>" + O2(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(s) : s;
      }
      if (t) return Promise.reject(n);
      throw n;
    };
  }
};
var M = new D2();
function g2(l3, e) {
  return M.parse(l3, e);
}
g2.options = g2.setOptions = function(l3) {
  return M.setOptions(l3), g2.defaults = M.defaults, G(g2.defaults), g2;
};
g2.getDefaults = z;
g2.defaults = T;
g2.use = function(...l3) {
  return M.use(...l3), g2.defaults = M.defaults, G(g2.defaults), g2;
};
g2.walkTokens = function(l3, e) {
  return M.walkTokens(l3, e);
};
g2.parseInline = M.parseInline;
g2.Parser = b2;
g2.parser = b2.parse;
g2.Renderer = y2;
g2.TextRenderer = L;
g2.Lexer = x;
g2.lexer = x.lex;
g2.Tokenizer = w2;
g2.Hooks = P;
g2.parse = g2;
var jt = g2.options;
var Ft = g2.setOptions;
var Ut = g2.use;
var Kt = g2.walkTokens;
var Wt = g2.parseInline;
var Jt = b2.parse;
var Vt = x.lex;

// src/vendor.js
var alertIcons = {
  success: "checkCircle",
  error: "cancel",
  warning: "warning",
  info: "info",
  question: "question"
};
var alertGlyphs = {
  checkCircle: "check_circle",
  cancel: "cancel",
  warning: "warning",
  info: "info",
  question: "help"
};
var decorateSwalOptions = (options) => {
  if (!options || typeof options !== "object") return options;
  if (!options.icon || !alertIcons[options.icon] || options.iconHtml) return options;
  const glyph = alertGlyphs[alertIcons[options.icon]];
  return {
    ...options,
    iconHtml: `<span class="kk-icon material-symbols-outlined" aria-hidden="true">${glyph}</span>`,
    customClass: {
      ...options.customClass,
      icon: ["swal2-kk-icon", options.customClass?.icon].filter(Boolean).join(" ")
    }
  };
};
var originalSwalFire = import_sweetalert2.default.fire.bind(import_sweetalert2.default);
import_sweetalert2.default.fire = (...args) => {
  if (args.length === 1 && typeof args[0] === "object") {
    return originalSwalFire(decorateSwalOptions(args[0]));
  }
  if (args.length >= 3 && typeof args[2] === "string") {
    return originalSwalFire(decorateSwalOptions({
      title: args[0],
      html: args[1],
      icon: args[2]
    }));
  }
  return originalSwalFire(...args);
};
window.Swal = import_sweetalert2.default;
window.JSURL = dist_exports;
window.FilePond = FilePond;
window.marked = g2;
window.BsModal = Modal;
var export_Huebee = import_huebee.default;
var export_Swal = import_sweetalert2.default;
export {
  Collapse,
  Dropdown,
  FilePond,
  export_Huebee as Huebee,
  dist_exports as JSURL,
  Modal,
  Offcanvas,
  export_Swal as Swal,
  Tab,
  Toast,
  Tooltip,
  g2 as marked
};
/*! Bundled license information:

unipointer/unipointer.js:
  (*!
   * Unipointer v2.4.0
   * base class for doing one thing with pointer event
   * MIT license
   *)

huebee/huebee.js:
  (*!
   * Huebee v2.1.1
   * 1-click color picker
   * MIT license
   * https://huebee.buzz
   * Copyright 2020 Metafizzy
   *)

filepond/dist/filepond.js:
  (*!
   * FilePond 4.32.12
   * Licensed under MIT, https://opensource.org/licenses/MIT/
   * Please visit https://pqina.nl/filepond/ for details.
   *)

sweetalert2/dist/sweetalert2.all.js:
  (*!
  * sweetalert2 v11.26.24
  * Released under the MIT License.
  *)

bootstrap/dist/js/bootstrap.esm.js:
  (*!
    * Bootstrap v5.3.8 (https://getbootstrap.com/)
    * Copyright 2011-2025 The Bootstrap Authors (https://github.com/twbs/bootstrap/graphs/contributors)
    * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
    *)
*/
//# sourceMappingURL=vendor.js.map
