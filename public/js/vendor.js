var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e2) {
    throw mod = 0, e2;
  }
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
        for (var i2 = 0; i2 < listeners.length; i2++) {
          var listener = listeners[i2];
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
        for (var i2 = 0; i2 < touches.length; i2++) {
          var touch = touches[i2];
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
            var x3 = customI % hues;
            var y4 = Math.floor(customI / hues);
            var swatch2 = getSwatch(color2);
            if (swatch2) {
              this.addSwatch(swatch2, x3, y4);
              customI++;
            }
          }.bind(this));
        }
        var i2;
        for (i2 = 0; i2 < sats; i2++) {
          var sat = 1 - i2 / sats;
          var yOffset = shades * i2 + this.satY;
          this.updateSaturationGrid(i2, sat, yOffset);
        }
        var grayCount = this.getGrayCount();
        for (i2 = 0; i2 < grayCount; i2++) {
          var lum = 1 - i2 / (shades + 1);
          var color = this.colorModer(0, 0, lum);
          var swatch = getSwatch(color);
          this.addSwatch(swatch, hues + 1, i2);
        }
      };
      proto.getGrayCount = function() {
        return this.options.shades ? this.options.shades + 2 : 0;
      };
      proto.updateSaturationGrid = function(i2, sat, yOffset) {
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
        hsl: function(h3, s2, l4) {
          s2 = Math.round(s2 * 100);
          l4 = Math.round(l4 * 100);
          return "hsl(" + h3 + ", " + s2 + "%, " + l4 + "%)";
        },
        hex: hsl2hex,
        shortHex: function(h3, s2, l4) {
          var hex = hsl2hex(h3, s2, l4);
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
        var h3 = elem.offsetHeight;
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
        var isElement2 = this.element.contains(event.target);
        if (!isAnchor && !isElement2) {
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
        var x3 = Math.round(pointer.pageX - this.offset.x);
        var y4 = Math.round(pointer.pageY - this.offset.y);
        var gridSize = this.gridSize;
        var sx = Math.floor(x3 / gridSize);
        var sy = Math.floor(y4 / gridSize);
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
        for (var i2 = 0; i2 < this.setTextElems.length; i2++) {
          var elem = this.setTextElems[i2];
          var property = elem.nodeName == "INPUT" ? "value" : "textContent";
          elem[property] = this.color;
        }
      };
      proto.setBackgrounds = function() {
        if (!this.setBGElems) {
          return;
        }
        var textColor = this.isLight ? "#222" : "white";
        for (var i2 = 0; i2 < this.setBGElems.length; i2++) {
          var elem = this.setBGElems[i2];
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
        for (var i2 = 0; i2 < elems.length; i2++) {
          var elem = elems[i2];
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
      function extend(a3, b4) {
        for (var prop in b4) {
          a3[prop] = b4[prop];
        }
        return a3;
      }
      function getQueryElement(elem) {
        if (typeof elem == "string") {
          elem = document.querySelector(elem);
        }
        return elem;
      }
      function hsl2hex(h3, s2, l4) {
        var rgb = hsl2rgb(h3, s2, l4);
        return rgb2hex(rgb);
      }
      function hsl2rgb(h3, s2, l4) {
        var C2 = (1 - Math.abs(2 * l4 - 1)) * s2;
        var hp = h3 / 60;
        var X2 = C2 * (1 - Math.abs(hp % 2 - 1));
        var rgb, m4;
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
        m4 = l4 - C2 / 2;
        rgb = rgb.map(function(v3) {
          return v3 + m4;
        });
        return rgb;
      }
      function rgb2hsl(r2, g4, b4) {
        r2 /= 255;
        g4 /= 255;
        b4 /= 255;
        var M3 = Math.max(r2, g4, b4);
        var m4 = Math.min(r2, g4, b4);
        var C2 = M3 - m4;
        var L2 = 0.5 * (M3 + m4);
        var S2 = C2 === 0 ? 0 : C2 / (1 - Math.abs(2 * L2 - 1));
        var h3;
        if (C2 === 0) {
          h3 = 0;
        } else if (M3 === r2) {
          h3 = (g4 - b4) / C2 % 6;
        } else if (M3 === g4) {
          h3 = (b4 - r2) / C2 + 2;
        } else if (M3 === b4) {
          h3 = (r2 - g4) / C2 + 4;
        }
        var H2 = 60 * h3;
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
            var f3 = -(position - target) * stiffness;
            velocity += f3 / mass;
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
      var easeLinear = function easeLinear2(t2) {
        return t2;
      };
      var easeInOutQuad = function easeInOutQuad2(t2) {
        return t2 < 0.5 ? 2 * t2 * t2 : -1 + (4 - 2 * t2) * t2;
      };
      var tween = (
        // default values
        function tween2() {
          var _ref = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, _ref$duration = _ref.duration, duration = _ref$duration === void 0 ? 500 : _ref$duration, _ref$easing = _ref.easing, easing = _ref$easing === void 0 ? easeInOutQuad : _ref$easing, _ref$delay = _ref.delay, delay = _ref$delay === void 0 ? 0 : _ref$delay;
          var start2 = null;
          var t2;
          var p3;
          var resting = true;
          var reverse = false;
          var target = null;
          var interpolate = function interpolate2(ts, skipToEndState) {
            if (resting || target === null) return;
            if (start2 === null) {
              start2 = ts;
            }
            if (ts - start2 < delay) return;
            t2 = ts - start2 - delay;
            if (t2 >= duration || skipToEndState) {
              t2 = 1;
              p3 = reverse ? 0 : 1;
              api.onupdate(p3 * target);
              api.oncomplete(p3 * target);
              resting = true;
            } else {
              p3 = t2 / duration;
              api.onupdate((t2 >= 0 ? easing(reverse ? 1 - p3 : p3) : 0) * target);
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
        obj.forEach(function(o2) {
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
            if (o2[name2] && !overwrite) {
              return;
            }
            o2[name2] = {
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
      var addEvent7 = function addEvent8(element) {
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
        var add = addEvent7(view.element);
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
            Object.keys(mixins).sort(function(a3, b4) {
              if (a3 === "styles") {
                return 1;
              } else if (b4 === "styles") {
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
      var insertBefore2 = function insertBefore3(newNode, referenceNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode);
      };
      var insertAfter2 = function insertAfter3(newNode, referenceNode) {
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
      var createAction = function createAction2(name2, outline, method, timeout2, headers) {
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
          timeout: timeout2,
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
          } catch (e2) {
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
              } catch (e2) {
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
          for (var i2 = 0; i2 < childrenLength; i2++) {
            childArray[i2] = arguments[i2 + 3];
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
        for (var i2 = 0; i2 < props.length; i2++) {
          var descriptor = props[i2];
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
          for (var i2 = 0; i2 < objectSymbols.length; i2++) {
            var sym = objectSymbols[i2];
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
        for (var i2 = 0; i2 < keys.length; i2++) {
          var key = keys[i2];
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
          for (var i2 = 1; i2 < arguments.length; i2++) {
            var source = arguments[i2];
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
        for (var i2 = 1; i2 < arguments.length; i2++) {
          var source = arguments[i2] != null ? arguments[i2] : {};
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
        for (var i2 = 1; i2 < arguments.length; i2++) {
          var source = arguments[i2] != null ? arguments[i2] : {};
          if (i2 % 2) {
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
      function _getPrototypeOf(o2) {
        _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf2(o3) {
          return o3.__proto__ || Object.getPrototypeOf(o3);
        };
        return _getPrototypeOf(o2);
      }
      function _setPrototypeOf(o2, p3) {
        _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf2(o3, p4) {
          o3.__proto__ = p4;
          return o3;
        };
        return _setPrototypeOf(o2, p3);
      }
      function isNativeReflectConstruct() {
        if (typeof Reflect === "undefined" || !Reflect.construct) return false;
        if (Reflect.construct.sham) return false;
        if (typeof Proxy === "function") return true;
        try {
          Date.prototype.toString.call(Reflect.construct(Date, [], function() {
          }));
          return true;
        } catch (e2) {
          return false;
        }
      }
      function _construct(Parent, args, Class) {
        if (isNativeReflectConstruct()) {
          _construct = Reflect.construct;
        } else {
          _construct = function _construct2(Parent2, args2, Class2) {
            var a3 = [null];
            a3.push.apply(a3, args2);
            var Constructor = Function.bind.apply(Parent2, a3);
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
        var key, i2;
        for (i2 = 0; i2 < sourceKeys.length; i2++) {
          key = sourceKeys[i2];
          if (excluded.indexOf(key) >= 0) continue;
          target[key] = source[key];
        }
        return target;
      }
      function _objectWithoutProperties(source, excluded) {
        if (source == null) return {};
        var target = _objectWithoutPropertiesLoose(source, excluded);
        var key, i2;
        if (Object.getOwnPropertySymbols) {
          var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
          for (i2 = 0; i2 < sourceSymbolKeys.length; i2++) {
            key = sourceSymbolKeys[i2];
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
        var s2 = set(target, property, value, receiver || target);
        if (!s2 && isStrict) {
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
      function _slicedToArray(arr, i2) {
        return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i2) || _nonIterableRest();
      }
      function _slicedToArrayLoose(arr, i2) {
        return _arrayWithHoles(arr) || _iterableToArrayLimitLoose(arr, i2) || _nonIterableRest();
      }
      function _toArray(arr) {
        return _arrayWithHoles(arr) || _iterableToArray(arr) || _nonIterableRest();
      }
      function _toConsumableArray(arr) {
        return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
      }
      function _arrayWithoutHoles(arr) {
        if (Array.isArray(arr)) {
          for (var i2 = 0, arr2 = new Array(arr.length); i2 < arr.length; i2++) arr2[i2] = arr[i2];
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
      function _iterableToArrayLimit(arr, i2) {
        var _arr = [];
        var _n = true;
        var _d = false;
        var _e2 = void 0;
        try {
          for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
            _arr.push(_s.value);
            if (i2 && _arr.length === i2) break;
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
      function _iterableToArrayLimitLoose(arr, i2) {
        var _arr = [];
        for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done; ) {
          _arr.push(_step.value);
          if (i2 && _arr.length === i2) break;
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
          var it2 = fn3.apply(this, arguments);
          it2.next();
          return it2;
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
              set value(v3) {
                descriptor.set.call(receiver, v3);
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
          for (var i2 = 0; i2 < mixins.length; i2++) {
            api = mixins[i2](api);
          }
        }
        var r2 = factory(function initialize2(O4) {
          api.initializeInstanceElements(O4, decorated.elements);
        }, superClass);
        var decorated = api.decorateClass(
          _coalesceClassElements(r2.d.map(_createElementDescriptor)),
          decorators
        );
        api.initializeClassElements(r2.F, decorated.elements);
        return api.runClassFinishers(r2.F, decorated.finishers);
      }
      function _getDecoratorsApi() {
        _getDecoratorsApi = function() {
          return api;
        };
        var api = {
          elementsDefinitionOrder: [["method"], ["field"]],
          initializeInstanceElements: function(O4, elements2) {
            ["method", "field"].forEach(function(kind) {
              elements2.forEach(function(element) {
                if (element.kind === kind && element.placement === "own") {
                  this.defineClassElement(O4, element);
                }
              }, this);
            }, this);
          },
          initializeClassElements: function(F2, elements2) {
            var proto = F2.prototype;
            ["method", "field"].forEach(function(kind) {
              elements2.forEach(function(element) {
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
          decorateClass: function(elements2, decorators) {
            var newElements = [];
            var finishers = [];
            var placements2 = {
              static: [],
              prototype: [],
              own: []
            };
            elements2.forEach(function(element) {
              this.addElementPlacement(element, placements2);
            }, this);
            elements2.forEach(function(element) {
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
            for (var decorators = element.decorators, i2 = decorators.length - 1; i2 >= 0; i2--) {
              var keys = placements2[element.placement];
              keys.splice(keys.indexOf(element.key), 1);
              var elementObject = this.fromElementDescriptor(element);
              var elementFinisherExtras = this.toElementFinisherExtras(
                (0, decorators[i2])(elementObject) || elementObject
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
          decorateConstructor: function(elements2, decorators) {
            var finishers = [];
            for (var i2 = decorators.length - 1; i2 >= 0; i2--) {
              var obj = this.fromClassDescriptor(elements2);
              var elementsAndFinisher = this.toClassDescriptor(
                (0, decorators[i2])(obj) || obj
              );
              if (elementsAndFinisher.finisher !== void 0) {
                finishers.push(elementsAndFinisher.finisher);
              }
              if (elementsAndFinisher.elements !== void 0) {
                elements2 = elementsAndFinisher.elements;
                for (var j2 = 0; j2 < elements2.length - 1; j2++) {
                  for (var k = j2 + 1; k < elements2.length; k++) {
                    if (elements2[j2].key === elements2[k].key && elements2[j2].placement === elements2[k].placement) {
                      throw new TypeError(
                        "Duplicated element (" + elements2[j2].key + ")"
                      );
                    }
                  }
                }
              }
            }
            return {
              elements: elements2,
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
          fromClassDescriptor: function(elements2) {
            var obj = {
              kind: "class",
              elements: elements2.map(this.fromElementDescriptor, this)
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
            var elements2 = this.toElementDescriptors(obj.elements);
            return {
              elements: elements2,
              finisher
            };
          },
          runClassFinishers: function(constructor, finishers) {
            for (var i2 = 0; i2 < finishers.length; i2++) {
              var newConstructor = (0, finishers[i2])(constructor);
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
      function _coalesceClassElements(elements2) {
        var newElements = [];
        var isSameElement = function(other2) {
          return other2.kind === "method" && other2.key === element.key && other2.placement === element.placement;
        };
        for (var i2 = 0; i2 < elements2.length; i2++) {
          var element = elements2[i2];
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
      function _wrapRegExp(re, groups) {
        _wrapRegExp = function(re2, groups2) {
          return new BabelRegExp(re2, groups2);
        };
        var _RegExp = _wrapNativeSuper(RegExp);
        var _super = RegExp.prototype;
        var _groups = /* @__PURE__ */ new WeakMap();
        function BabelRegExp(re2, groups2) {
          var _this = _RegExp.call(this, re2);
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
        function buildGroups(result, re2) {
          var g4 = _groups.get(re2);
          return Object.keys(g4).reduce(function(groups2, name2) {
            groups2[name2] = result[g4[name2]];
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
          var matchingFilters = filters.filter(function(f3) {
            return f3.key === key;
          }).map(function(f3) {
            return f3.cb;
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
        return filters.filter(function(f3) {
          return f3.key === key;
        }).map(function(f3) {
          return f3.cb(value, utils);
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
        for (var i2 = 0; i2 < byteString.length; i2++) {
          ia[i2] = byteString.charCodeAt(i2);
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
        process.onprogress = function(e2) {
          if (aborted) {
            return;
          }
          api.onprogress(e2.lengthComputable, e2.loaded, e2.total);
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
        for (var i2 = 0; i2 <= lastChunkIndex; i2++) {
          var offset2 = i2 * chunkSize;
          var data2 = file2.slice(offset2, offset2 + chunkSize, "application/offset+octet-stream");
          chunks[i2] = {
            index: i2,
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
          var totalBytesTransfered = chunks.reduce(function(p3, chunk) {
            if (p3 === null || chunk.progress === null) return null;
            return p3 + chunk.progress;
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
        var timeout2 = null;
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
          timeout2 = setTimeout(tick2, delay);
        };
        if (duration > 0) tick();
        return {
          clear: function clear2() {
            clearTimeout(timeout2);
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
          var v3 = src[key];
          target[key] = v3 && isObject(v3) ? deepCloneObject2(v3) : v3;
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
        state2.items.sort(function(a3, b4) {
          return compare(createItemAPI(a3), createItemAPI(b4));
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
              }).catch(function(e2) {
                if (!e2 || !e2.error || !e2.status) return handleAdd(false);
                dispatch2("DID_THROW_ITEM_INVALID", {
                  id: id2,
                  error: e2.error,
                  status: e2.status
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
      var describeArc = function describeArc2(x3, y4, radius, startAngle, endAngle, arcSweep) {
        var start2 = polarToCartesian(x3, y4, radius, endAngle);
        var end2 = polarToCartesian(x3, y4, radius, startAngle);
        return ["M", start2.x, start2.y, "A", radius, radius, 0, arcSweep, 0, end2.x, end2.y].join(" ");
      };
      var percentageArc = function percentageArc2(x3, y4, radius, from, to) {
        var arcSweep = 1;
        if (to > from && to - from <= 0.5) {
          arcSweep = 0;
        }
        if (from > to && from - to >= 0.5) {
          arcSweep = 0;
        }
        return describeArc(
          x3,
          y4,
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
          buttonView.on("click", function(e2) {
            e2.stopPropagation();
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
        root2.ref.handleClick = function(e2) {
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
        var grab = function grab2(e2) {
          if (!e2.isPrimary) return;
          var removedActivateListener = false;
          var origin = {
            x: e2.pageX,
            y: e2.pageY
          };
          props.dragOrigin = {
            x: root2.translateX,
            y: root2.translateY
          };
          props.dragCenter = {
            x: e2.offsetX,
            y: e2.offsetY
          };
          var dragState = createDragHelper(root2.query("GET_ACTIVE_ITEMS"));
          root2.dispatch("DID_GRAB_ITEM", { id: props.id, dragState });
          var drag = function drag2(e3) {
            if (!e3.isPrimary) return;
            e3.stopPropagation();
            e3.preventDefault();
            props.dragOffset = {
              x: e3.pageX - origin.x,
              y: e3.pageY - origin.y
            };
            var dist = props.dragOffset.x * props.dragOffset.x + props.dragOffset.y * props.dragOffset.y;
            if (dist > 16 && !removedActivateListener) {
              removedActivateListener = true;
              root2.element.removeEventListener("click", root2.ref.handleClick);
            }
            root2.dispatch("DID_DRAG_ITEM", { id: props.id, dragState });
          };
          var drop2 = function drop3(e3) {
            if (!e3.isPrimary) return;
            props.dragOffset = {
              x: e3.pageX - origin.x,
              y: e3.pageY - origin.y
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
        var l4 = children.length;
        var last = null;
        if (l4 === 0 || positionInView.top < children[0].rect.element.top) return -1;
        var item2 = children[0];
        var itemRect = item2.rect.element;
        var itemHorizontalMargin = itemRect.marginLeft + itemRect.marginRight;
        var itemWidth = itemRect.width + itemHorizontalMargin;
        var itemsPerRow = getItemsPerRow(horizontalSpace, itemWidth);
        if (itemsPerRow === 1) {
          for (var index = 0; index < l4; index++) {
            var child = children[index];
            var childMid = child.rect.outer.top + child.rect.element.height * 0.5;
            if (positionInView.top < childMid) {
              return index;
            }
          }
          return l4;
        }
        var itemVerticalMargin = itemRect.marginTop + itemRect.marginBottom;
        var itemHeight = itemRect.height + itemVerticalMargin;
        for (var _index = 0; _index < l4; _index++) {
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
            } else if (_index !== l4 - 1) {
              last = _index;
            } else {
              last = null;
            }
          }
        }
        if (last !== null) {
          return last;
        }
        return l4;
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
      var moveItem = function moveItem2(item2, x3, y4) {
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
          item2.translateX = x3;
          item2.translateY = y4;
          if (Date.now() > item2.spawnDate) {
            if (item2.opacity === 0) {
              introItemView(item2, x3, y4, vx, vy);
            }
            item2.scaleX = 1;
            item2.scaleY = 1;
            item2.opacity = 1;
          }
        }
      };
      var introItemView = function introItemView2(item2, x3, y4, vx, vy) {
        if (item2.interactionMethod === InteractionMethod.NONE) {
          item2.translateX = null;
          item2.translateX = x3;
          item2.translateY = null;
          item2.translateY = y4;
        } else if (item2.interactionMethod === InteractionMethod.DROP) {
          item2.translateX = null;
          item2.translateX = x3 - vx * 20;
          item2.translateY = null;
          item2.translateY = y4 - vy * 10;
          item2.scaleX = 0.8;
          item2.scaleY = 0.8;
        } else if (item2.interactionMethod === InteractionMethod.BROWSE) {
          item2.translateY = null;
          item2.translateY = y4 - 30;
        } else if (item2.interactionMethod === InteractionMethod.API) {
          item2.translateX = null;
          item2.translateX = x3 - 30;
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
            var l4 = children.length;
            var idx = l4;
            var childHeight = 0;
            var childBottom = 0;
            var childTop = 0;
            for (var i2 = 0; i2 < l4; i2++) {
              childHeight = getItemHeight(children[i2]);
              childTop = childBottom;
              childBottom = childTop + childHeight;
              if (dragPosition.y < childBottom) {
                if (currentIndex2 > i2) {
                  if (dragPosition.y < childTop + dragHeight2) {
                    idx = i2;
                    break;
                  }
                  continue;
                }
                idx = i2;
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
        root2.ref.handleChange = function(e2) {
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
          for (var i2 = 0; i2 < activeItems.length; i2++) {
            if (activeItems[i2].status === ItemStatus.LOAD_ERROR) {
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
        root2.ref.handleKeyDown = function(e2) {
          var isActivationKey = e2.keyCode === Key.ENTER || e2.keyCode === Key.SPACE;
          if (!isActivationKey) return;
          e2.preventDefault();
          root2.ref.label.click();
        };
        root2.ref.handleClick = function(e2) {
          var isLabelClick = e2.target === label || label.contains(e2.target);
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
        } catch (e2) {
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
      var eventPosition = function eventPosition2(e2) {
        return {
          pageLeft: e2.pageX,
          pageTop: e2.pageY,
          scopeLeft: e2.offsetX || e2.layerX,
          scopeTop: e2.offsetY || e2.layerY
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
      var isEventTarget = function isEventTarget2(e2, target) {
        var root2 = getRootNode(target);
        var elementAtPosition = elementFromPoint(root2, {
          x: e2.pageX - window.pageXOffset,
          y: e2.pageY - window.pageYOffset
        });
        return elementAtPosition === target || target.contains(elementAtPosition);
      };
      var initialTarget = null;
      var setDropEffect = function setDropEffect2(dataTransfer, effect2) {
        try {
          dataTransfer.dropEffect = effect2;
        } catch (e2) {
        }
      };
      var dragenter = function dragenter2(root2, clients) {
        return function(e2) {
          e2.preventDefault();
          initialTarget = e2.target;
          clients.forEach(function(client) {
            var element = client.element, onenter = client.onenter;
            if (isEventTarget(e2, element)) {
              client.state = "enter";
              onenter(eventPosition(e2));
            }
          });
        };
      };
      var dragover = function dragover2(root2, clients) {
        return function(e2) {
          e2.preventDefault();
          var dataTransfer = e2.dataTransfer;
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
              if (isEventTarget(e2, element)) {
                overDropTarget = true;
                if (client.state === null) {
                  client.state = "enter";
                  onenter(eventPosition(e2));
                  return;
                }
                client.state = "over";
                if (filterElement && !allowsTransfer) {
                  setDropEffect(dataTransfer, "none");
                  return;
                }
                ondrag(eventPosition(e2));
              } else {
                if (filterElement && !overDropTarget) {
                  setDropEffect(dataTransfer, "none");
                }
                if (client.state) {
                  client.state = null;
                  onexit(eventPosition(e2));
                }
              }
            });
          });
        };
      };
      var drop = function drop2(root2, clients) {
        return function(e2) {
          e2.preventDefault();
          var dataTransfer = e2.dataTransfer;
          requestDataTransferItems(dataTransfer).then(function(items) {
            clients.forEach(function(client) {
              var filterElement = client.filterElement, element = client.element, ondrop = client.ondrop, onexit = client.onexit, allowdrop = client.allowdrop;
              client.state = null;
              if (filterElement && !isEventTarget(e2, element)) return;
              if (!allowdrop(items)) return onexit(eventPosition(e2));
              ondrop(eventPosition(e2), items);
            });
          });
        };
      };
      var dragleave = function dragleave2(root2, clients) {
        return function(e2) {
          if (initialTarget !== e2.target) {
            return;
          }
          clients.forEach(function(client) {
            var onexit = client.onexit;
            client.state = null;
            onexit(eventPosition(e2));
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
      var handlePaste = function handlePaste2(e2) {
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
        requestDataTransferItems(e2.clipboardData).then(function(files) {
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
        var timeout2 = null;
        return function() {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          clearTimeout(timeout2);
          var dist = Date.now() - last;
          var fn3 = function fn4() {
            last = Date.now();
            func.apply(void 0, args);
          };
          if (dist < interval) {
            if (!immidiateOnly) {
              timeout2 = setTimeout(fn3, interval - dist);
            }
          } else {
            fn3();
          }
        };
      };
      var MAX_FILES_LIMIT = 1e6;
      var prevent = function prevent2(e2) {
        return e2.preventDefault();
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
            var l4 = history.length;
            var bottom2 = l4 - 10;
            var bounces = 0;
            for (var i2 = l4; i2 >= bottom2; i2--) {
              if (history[i2] === history[i2 - 2]) {
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
              return insertBefore2(view.element, element);
            },
            /**
             * Inserts the plugin after the target element
             */
            insertAfter: function insertAfter$1(element) {
              return insertAfter2(view.element, element);
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
              insertBefore2(view.element, element);
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
              insertAfter2(originalElement, view.element);
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
            worker.onmessage = function(e2) {
              if (e2.data.id === id2) {
                cb(e2.data.message);
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
          img.onerror = function(e2) {
            reject(e2);
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
      var createAppPlugin = function createAppPlugin2(plugin15) {
        if (registeredPlugins.includes(plugin15)) {
          return;
        }
        registeredPlugins.push(plugin15);
        var pluginOutline = plugin15({
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

// node_modules/.pnpm/sweetalert2@11.26.25/node_modules/sweetalert2/dist/sweetalert2.all.js
var require_sweetalert2_all = __commonJS({
  "node_modules/.pnpm/sweetalert2@11.26.25/node_modules/sweetalert2/dist/sweetalert2.all.js"(exports, module) {
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.Sweetalert2 = factory());
    })(exports, (function() {
      "use strict";
      function _assertClassBrand(e2, t2, n2) {
        if ("function" == typeof e2 ? e2 === t2 : e2.has(t2)) return arguments.length < 3 ? t2 : n2;
        throw new TypeError("Private element is not present on this object");
      }
      function _checkPrivateRedeclaration(e2, t2) {
        if (t2.has(e2)) throw new TypeError("Cannot initialize the same private elements twice on an object");
      }
      function _classPrivateFieldGet2(s2, a3) {
        return s2.get(_assertClassBrand(s2, a3));
      }
      function _classPrivateFieldInitSpec(e2, t2, a3) {
        _checkPrivateRedeclaration(e2, t2), t2.set(e2, a3);
      }
      function _classPrivateFieldSet2(s2, a3, r2) {
        return s2.set(_assertClassBrand(s2, a3), r2), r2;
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
          const x3 = window.scrollX;
          const y4 = window.scrollY;
          globalState.restoreFocusTimeout = setTimeout(() => {
            focusPreviousActiveElement();
            resolve();
          }, RESTORE_FOCUS_TIMEOUT);
          window.scrollTo(x3, y4);
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
        const focusableElementsWithTabindexSorted = Array.from(focusableElementsWithTabindex).sort((a3, b4) => {
          const tabindexA = parseInt(a3.getAttribute("tabindex") || "0");
          const tabindexB = parseInt(b4.getAttribute("tabindex") || "0");
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
        return className.split(/\s+/).every((cls) => elem.classList.contains(cls));
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
      const getDirectChildByClass = (elem, className) => (
        /** @type {HTMLElement | undefined} */
        Array.from(elem.children).find((child) => child instanceof HTMLElement && hasClass(child, className))
      );
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
          for (let i2 = 0; i2 in elem; i2++) {
            target.appendChild(elem[i2].cloneNode(true));
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
        for (const {
          name
        } of Array.from(input.attributes)) {
          if (!["id", "type", "value", "style"].includes(name)) {
            input.removeAttribute(name);
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
        successIconParts.forEach((part) => {
          part.style.backgroundColor = popupBackgroundColor;
        });
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
          const handler = (e2) => keydownHandler(innerParams, e2, dismissWith);
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
        const btnIndex = focusableElements.findIndex((el) => el === targetElement);
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
        for (let i2 = 0; i2 < actions.children.length; i2++) {
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
        const swalCloseAnimationFinished = function(e2) {
          if (e2.target === popup) {
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
        } else if (["text", "email", "number", "tel", "textarea"].some((i2) => i2 === params.input) && (hasToPromiseFn(params.inputValue) || isPromise(params.inputValue))) {
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
            optionLabel.forEach((o2) => renderOption(optgroup, o2[1], o2[0]));
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
      const isSelected = (optionValue, inputValue) => Boolean(inputValue) && inputValue != null && inputValue.toString() === optionValue.toString();
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
        this.enableButtons();
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
          radios.forEach((radio) => {
            radio.disabled = disabled;
          });
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
        for (const i2 in obj) {
          obj[i2].delete(instance);
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
          domCache.container.onmouseup = function(e2) {
            domCache.container.onmouseup = () => {
            };
            if (e2.target === domCache.container) {
              ignoreOutsideClick = true;
            }
          };
        };
      };
      const handleContainerMousedown = (domCache) => {
        domCache.container.onmousedown = (e2) => {
          if (e2.target === domCache.container) {
            e2.preventDefault();
          }
          domCache.popup.onmouseup = function(e3) {
            domCache.popup.onmouseup = () => {
            };
            if (e3.target === domCache.popup || e3.target instanceof HTMLElement && domCache.popup.contains(e3.target)) {
              ignoreOutsideClick = true;
            }
          };
        };
      };
      const handleModalClick = (innerParams, domCache, dismissWith) => {
        domCache.container.onclick = (e2) => {
          if (ignoreOutsideClick) {
            ignoreOutsideClick = false;
            return;
          }
          if (e2.target === domCache.container && callIfFunction(innerParams.allowOutsideClick)) {
            dismissWith(DismissReason.backdrop);
          }
        };
      };
      const isJqueryElement = (elem) => typeof elem === "object" && elem !== null && "jquery" in elem;
      const isElement2 = (elem) => elem instanceof Element || isJqueryElement(elem);
      const argsToParams = (args) => {
        const params = {};
        if (typeof args[0] === "object" && !isElement2(args[0])) {
          Object.assign(params, args[0]);
        } else {
          ["title", "html", "icon"].forEach((name, index) => {
            const arg = args[index];
            if (typeof arg === "string" || isElement2(arg)) {
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
        increase(n2) {
          const running = this.running;
          if (running) {
            this.stop();
          }
          this.remaining += n2;
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
        for (const i2 in paramNames) {
          const paramName = paramNames[i2];
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
        addClasses4(container, popup, params);
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
      const addClasses4 = (container, popup, params) => {
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
      SweetAlert.version = "11.26.25";
      const Swal2 = SweetAlert;
      Swal2.default = Swal2;
      return Swal2;
    }));
    if (typeof exports !== "undefined" && exports.Sweetalert2) {
      exports.swal = exports.sweetAlert = exports.Swal = exports.SweetAlert = exports.Sweetalert2;
    }
    "undefined" != typeof document && (function(e2, t2) {
      var n2 = e2.createElement("style");
      if (e2.getElementsByTagName("head")[0].appendChild(n2), n2.styleSheet) n2.styleSheet.disabled || (n2.styleSheet.cssText = t2);
      else try {
        n2.innerHTML = t2;
      } catch (e3) {
        n2.innerText = t2;
      }
    })(document, ':root{--swal2-outline: 0 0 0 3px rgba(100, 150, 200, 0.5);--swal2-container-padding: 0.625em;--swal2-backdrop: rgba(0, 0, 0, 0.4);--swal2-backdrop-transition: background-color 0.15s;--swal2-width: 32em;--swal2-padding: 0 0 1.25em;--swal2-border: none;--swal2-border-radius: 0.3125rem;--swal2-background: white;--swal2-color: #545454;--swal2-show-animation: swal2-show 0.3s;--swal2-hide-animation: swal2-hide 0.15s forwards;--swal2-icon-zoom: 1;--swal2-title-padding: 0.8em 1em 0;--swal2-html-container-padding: 1em 1.6em 0.3em;--swal2-input-border: 1px solid #d9d9d9;--swal2-input-border-radius: 0.1875em;--swal2-input-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 3px transparent;--swal2-input-background: transparent;--swal2-input-transition: border-color 0.2s, box-shadow 0.2s;--swal2-input-hover-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 3px transparent;--swal2-input-focus-border: 1px solid #b4dbed;--swal2-input-focus-box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.06), 0 0 0 3px rgba(100, 150, 200, 0.5);--swal2-progress-step-background: #add8e6;--swal2-validation-message-background: #f0f0f0;--swal2-validation-message-color: #666;--swal2-footer-border-color: #eee;--swal2-footer-background: transparent;--swal2-footer-color: inherit;--swal2-timer-progress-bar-background: rgba(0, 0, 0, 0.3);--swal2-close-button-position: initial;--swal2-close-button-inset: auto;--swal2-close-button-font-size: 2.5em;--swal2-close-button-color: #ccc;--swal2-close-button-transition: color 0.2s, box-shadow 0.2s;--swal2-close-button-outline: initial;--swal2-close-button-box-shadow: inset 0 0 0 3px transparent;--swal2-close-button-focus-box-shadow: inset var(--swal2-outline);--swal2-close-button-hover-transform: none;--swal2-actions-justify-content: center;--swal2-actions-width: auto;--swal2-actions-margin: 1.25em auto 0;--swal2-actions-padding: 0;--swal2-actions-border-radius: 0;--swal2-actions-background: transparent;--swal2-action-button-transition: background-color 0.2s, box-shadow 0.2s;--swal2-action-button-hover: black 10%;--swal2-action-button-active: black 10%;--swal2-confirm-button-box-shadow: none;--swal2-confirm-button-border-radius: 0.25em;--swal2-confirm-button-background-color: #7066e0;--swal2-confirm-button-color: #fff;--swal2-deny-button-box-shadow: none;--swal2-deny-button-border-radius: 0.25em;--swal2-deny-button-background-color: #dc3741;--swal2-deny-button-color: #fff;--swal2-cancel-button-box-shadow: none;--swal2-cancel-button-border-radius: 0.25em;--swal2-cancel-button-background-color: #6e7881;--swal2-cancel-button-color: #fff;--swal2-toast-show-animation: swal2-toast-show 0.5s;--swal2-toast-hide-animation: swal2-toast-hide 0.1s forwards;--swal2-toast-border: none;--swal2-toast-box-shadow: 0 0 1px hsl(0deg 0% 0% / 0.075), 0 1px 2px hsl(0deg 0% 0% / 0.075), 1px 2px 4px hsl(0deg 0% 0% / 0.075), 1px 3px 8px hsl(0deg 0% 0% / 0.075), 2px 4px 16px hsl(0deg 0% 0% / 0.075)}[data-swal2-theme=dark]{--swal2-dark-theme-black: #19191a;--swal2-dark-theme-white: #e1e1e1;--swal2-background: var(--swal2-dark-theme-black);--swal2-color: var(--swal2-dark-theme-white);--swal2-footer-border-color: #555;--swal2-input-background: color-mix(in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10%);--swal2-validation-message-background: color-mix( in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10% );--swal2-validation-message-color: var(--swal2-dark-theme-white);--swal2-timer-progress-bar-background: rgba(255, 255, 255, 0.7)}@media(prefers-color-scheme: dark){[data-swal2-theme=auto]{--swal2-dark-theme-black: #19191a;--swal2-dark-theme-white: #e1e1e1;--swal2-background: var(--swal2-dark-theme-black);--swal2-color: var(--swal2-dark-theme-white);--swal2-footer-border-color: #555;--swal2-input-background: color-mix(in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10%);--swal2-validation-message-background: color-mix( in srgb, var(--swal2-dark-theme-black), var(--swal2-dark-theme-white) 10% );--swal2-validation-message-color: var(--swal2-dark-theme-white);--swal2-timer-progress-bar-background: rgba(255, 255, 255, 0.7)}}body.swal2-shown:not(.swal2-no-backdrop,.swal2-toast-shown){overflow:hidden}body.swal2-height-auto{height:auto !important}body.swal2-no-backdrop .swal2-container{background-color:rgba(0,0,0,0) !important;pointer-events:none}body.swal2-no-backdrop .swal2-container .swal2-popup{pointer-events:auto}body.swal2-no-backdrop .swal2-container .swal2-modal{box-shadow:0 0 10px var(--swal2-backdrop)}body.swal2-toast-shown .swal2-container{box-sizing:border-box;width:360px;max-width:100%;background-color:rgba(0,0,0,0);pointer-events:none}body.swal2-toast-shown .swal2-container.swal2-top{inset:0 auto auto 50%;transform:translateX(-50%)}body.swal2-toast-shown .swal2-container.swal2-top-end,body.swal2-toast-shown .swal2-container.swal2-top-right{inset:0 0 auto auto}body.swal2-toast-shown .swal2-container.swal2-top-start,body.swal2-toast-shown .swal2-container.swal2-top-left{inset:0 auto auto 0}body.swal2-toast-shown .swal2-container.swal2-center-start,body.swal2-toast-shown .swal2-container.swal2-center-left{inset:50% auto auto 0;transform:translateY(-50%)}body.swal2-toast-shown .swal2-container.swal2-center{inset:50% auto auto 50%;transform:translate(-50%, -50%)}body.swal2-toast-shown .swal2-container.swal2-center-end,body.swal2-toast-shown .swal2-container.swal2-center-right{inset:50% 0 auto auto;transform:translateY(-50%)}body.swal2-toast-shown .swal2-container.swal2-bottom-start,body.swal2-toast-shown .swal2-container.swal2-bottom-left{inset:auto auto 0 0}body.swal2-toast-shown .swal2-container.swal2-bottom{inset:auto auto 0 50%;transform:translateX(-50%)}body.swal2-toast-shown .swal2-container.swal2-bottom-end,body.swal2-toast-shown .swal2-container.swal2-bottom-right{inset:auto 0 0 auto}@media print{body.swal2-shown:not(.swal2-no-backdrop,.swal2-toast-shown){overflow-y:scroll !important}body.swal2-shown:not(.swal2-no-backdrop,.swal2-toast-shown)>[aria-hidden=true]{display:none}body.swal2-shown:not(.swal2-no-backdrop,.swal2-toast-shown) .swal2-container{position:static !important}}div:where(.swal2-container){display:grid;position:fixed;z-index:1060;inset:0;box-sizing:border-box;grid-template-areas:"top-start     top            top-end" "center-start  center         center-end" "bottom-start  bottom-center  bottom-end";grid-template-rows:minmax(min-content, auto) minmax(min-content, auto) minmax(min-content, auto);height:100%;padding:var(--swal2-container-padding);overflow-x:hidden;transition:var(--swal2-backdrop-transition);-webkit-overflow-scrolling:touch}div:where(.swal2-container).swal2-backdrop-show,div:where(.swal2-container).swal2-noanimation{background:var(--swal2-backdrop)}div:where(.swal2-container).swal2-backdrop-hide{background:rgba(0,0,0,0) !important}div:where(.swal2-container).swal2-top-start,div:where(.swal2-container).swal2-center-start,div:where(.swal2-container).swal2-bottom-start{grid-template-columns:minmax(0, 1fr) auto auto}div:where(.swal2-container).swal2-top,div:where(.swal2-container).swal2-center,div:where(.swal2-container).swal2-bottom{grid-template-columns:auto minmax(0, 1fr) auto}div:where(.swal2-container).swal2-top-end,div:where(.swal2-container).swal2-center-end,div:where(.swal2-container).swal2-bottom-end{grid-template-columns:auto auto minmax(0, 1fr)}div:where(.swal2-container).swal2-top-start>.swal2-popup{align-self:start}div:where(.swal2-container).swal2-top>.swal2-popup{grid-column:2;place-self:start center}div:where(.swal2-container).swal2-top-end>.swal2-popup,div:where(.swal2-container).swal2-top-right>.swal2-popup{grid-column:3;place-self:start end}div:where(.swal2-container).swal2-center-start>.swal2-popup,div:where(.swal2-container).swal2-center-left>.swal2-popup{grid-row:2;align-self:center}div:where(.swal2-container).swal2-center>.swal2-popup{grid-column:2;grid-row:2;place-self:center center}div:where(.swal2-container).swal2-center-end>.swal2-popup,div:where(.swal2-container).swal2-center-right>.swal2-popup{grid-column:3;grid-row:2;place-self:center end}div:where(.swal2-container).swal2-bottom-start>.swal2-popup,div:where(.swal2-container).swal2-bottom-left>.swal2-popup{grid-column:1;grid-row:3;align-self:end}div:where(.swal2-container).swal2-bottom>.swal2-popup{grid-column:2;grid-row:3;place-self:end center}div:where(.swal2-container).swal2-bottom-end>.swal2-popup,div:where(.swal2-container).swal2-bottom-right>.swal2-popup{grid-column:3;grid-row:3;place-self:end end}div:where(.swal2-container).swal2-grow-row>.swal2-popup,div:where(.swal2-container).swal2-grow-fullscreen>.swal2-popup{grid-column:1/4;width:100%}div:where(.swal2-container).swal2-grow-column>.swal2-popup,div:where(.swal2-container).swal2-grow-fullscreen>.swal2-popup{grid-row:1/4;align-self:stretch}div:where(.swal2-container).swal2-no-transition{transition:none !important}div:where(.swal2-container)[popover]{width:auto;border:0}div:where(.swal2-container) div:where(.swal2-popup){display:none;position:relative;box-sizing:border-box;grid-template-columns:minmax(0, 100%);width:var(--swal2-width);max-width:100%;padding:var(--swal2-padding);border:var(--swal2-border);border-radius:var(--swal2-border-radius);background:var(--swal2-background);color:var(--swal2-color);font-family:inherit;font-size:1rem}div:where(.swal2-container) div:where(.swal2-popup):focus{outline:none}div:where(.swal2-container) div:where(.swal2-popup).swal2-loading{overflow-y:hidden}div:where(.swal2-container) div:where(.swal2-popup).swal2-draggable{cursor:grab}div:where(.swal2-container) div:where(.swal2-popup).swal2-draggable div:where(.swal2-icon){cursor:grab}div:where(.swal2-container) div:where(.swal2-popup).swal2-dragging{cursor:grabbing}div:where(.swal2-container) div:where(.swal2-popup).swal2-dragging div:where(.swal2-icon){cursor:grabbing}div:where(.swal2-container) h2:where(.swal2-title){position:relative;max-width:100%;margin:0;padding:var(--swal2-title-padding);color:inherit;font-size:1.875em;font-weight:600;text-align:center;text-transform:none;overflow-wrap:break-word;cursor:initial}div:where(.swal2-container) div:where(.swal2-actions){display:flex;z-index:1;box-sizing:border-box;flex-wrap:wrap;align-items:center;justify-content:var(--swal2-actions-justify-content);width:var(--swal2-actions-width);margin:var(--swal2-actions-margin);padding:var(--swal2-actions-padding);border-radius:var(--swal2-actions-border-radius);background:var(--swal2-actions-background)}div:where(.swal2-container) div:where(.swal2-loader){display:none;align-items:center;justify-content:center;width:2.2em;height:2.2em;margin:0 1.875em;animation:swal2-rotate-loading 1.5s linear 0s infinite normal;border-width:.25em;border-style:solid;border-radius:100%;border-color:#2778c4 rgba(0,0,0,0) #2778c4 rgba(0,0,0,0)}div:where(.swal2-container) button:where(.swal2-styled){margin:.3125em;padding:.625em 1.1em;transition:var(--swal2-action-button-transition);border:none;box-shadow:0 0 0 3px rgba(0,0,0,0);font-weight:500}div:where(.swal2-container) button:where(.swal2-styled):not([disabled]){cursor:pointer}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-confirm){border-radius:var(--swal2-confirm-button-border-radius);background:initial;background-color:var(--swal2-confirm-button-background-color);box-shadow:var(--swal2-confirm-button-box-shadow);color:var(--swal2-confirm-button-color);font-size:1em}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-confirm):hover{background-color:color-mix(in srgb, var(--swal2-confirm-button-background-color), var(--swal2-action-button-hover))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-confirm):active{background-color:color-mix(in srgb, var(--swal2-confirm-button-background-color), var(--swal2-action-button-active))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-deny){border-radius:var(--swal2-deny-button-border-radius);background:initial;background-color:var(--swal2-deny-button-background-color);box-shadow:var(--swal2-deny-button-box-shadow);color:var(--swal2-deny-button-color);font-size:1em}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-deny):hover{background-color:color-mix(in srgb, var(--swal2-deny-button-background-color), var(--swal2-action-button-hover))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-deny):active{background-color:color-mix(in srgb, var(--swal2-deny-button-background-color), var(--swal2-action-button-active))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-cancel){border-radius:var(--swal2-cancel-button-border-radius);background:initial;background-color:var(--swal2-cancel-button-background-color);box-shadow:var(--swal2-cancel-button-box-shadow);color:var(--swal2-cancel-button-color);font-size:1em}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-cancel):hover{background-color:color-mix(in srgb, var(--swal2-cancel-button-background-color), var(--swal2-action-button-hover))}div:where(.swal2-container) button:where(.swal2-styled):where(.swal2-cancel):active{background-color:color-mix(in srgb, var(--swal2-cancel-button-background-color), var(--swal2-action-button-active))}div:where(.swal2-container) button:where(.swal2-styled):focus-visible{outline:none;box-shadow:var(--swal2-action-button-focus-box-shadow)}div:where(.swal2-container) button:where(.swal2-styled)[disabled]:not(.swal2-loading){opacity:.4}div:where(.swal2-container) button:where(.swal2-styled)::-moz-focus-inner{border:0}div:where(.swal2-container) div:where(.swal2-footer){margin:1em 0 0;padding:1em 1em 0;border-top:1px solid var(--swal2-footer-border-color);background:var(--swal2-footer-background);color:var(--swal2-footer-color);font-size:1em;text-align:center;cursor:initial}div:where(.swal2-container) .swal2-timer-progress-bar-container{position:absolute;right:0;bottom:0;left:0;grid-column:auto !important;overflow:hidden;border-bottom-right-radius:var(--swal2-border-radius);border-bottom-left-radius:var(--swal2-border-radius)}div:where(.swal2-container) div:where(.swal2-timer-progress-bar){width:100%;height:.25em;background:var(--swal2-timer-progress-bar-background)}div:where(.swal2-container) img:where(.swal2-image){max-width:100%;margin:2em auto 1em;cursor:initial}div:where(.swal2-container) button:where(.swal2-close){position:var(--swal2-close-button-position);inset:var(--swal2-close-button-inset);z-index:2;align-items:center;justify-content:center;width:1.2em;height:1.2em;margin-top:0;margin-right:0;margin-bottom:-1.2em;padding:0;overflow:hidden;transition:var(--swal2-close-button-transition);border:none;border-radius:var(--swal2-border-radius);outline:var(--swal2-close-button-outline);background:rgba(0,0,0,0);color:var(--swal2-close-button-color);font-family:monospace;font-size:var(--swal2-close-button-font-size);cursor:pointer;justify-self:end}div:where(.swal2-container) button:where(.swal2-close):hover{transform:var(--swal2-close-button-hover-transform);background:rgba(0,0,0,0);color:#f27474}div:where(.swal2-container) button:where(.swal2-close):focus-visible{outline:none;box-shadow:var(--swal2-close-button-focus-box-shadow)}div:where(.swal2-container) button:where(.swal2-close)::-moz-focus-inner{border:0}div:where(.swal2-container) div:where(.swal2-html-container){z-index:1;justify-content:center;margin:0;padding:var(--swal2-html-container-padding);overflow:auto;color:inherit;font-size:1.125em;font-weight:normal;line-height:normal;text-align:center;overflow-wrap:break-word;word-break:break-word;cursor:initial}div:where(.swal2-container) input:where(.swal2-input),div:where(.swal2-container) input:where(.swal2-file),div:where(.swal2-container) textarea:where(.swal2-textarea),div:where(.swal2-container) select:where(.swal2-select),div:where(.swal2-container) div:where(.swal2-radio),div:where(.swal2-container) label:where(.swal2-checkbox){margin:1em 2em 3px}div:where(.swal2-container) input:where(.swal2-input),div:where(.swal2-container) input:where(.swal2-file),div:where(.swal2-container) textarea:where(.swal2-textarea){box-sizing:border-box;width:auto;transition:var(--swal2-input-transition);border:var(--swal2-input-border);border-radius:var(--swal2-input-border-radius);background:var(--swal2-input-background);box-shadow:var(--swal2-input-box-shadow);color:inherit;font-size:1.125em}div:where(.swal2-container) input:where(.swal2-input).swal2-inputerror,div:where(.swal2-container) input:where(.swal2-file).swal2-inputerror,div:where(.swal2-container) textarea:where(.swal2-textarea).swal2-inputerror{border-color:#f27474 !important;box-shadow:0 0 2px #f27474 !important}div:where(.swal2-container) input:where(.swal2-input):hover,div:where(.swal2-container) input:where(.swal2-file):hover,div:where(.swal2-container) textarea:where(.swal2-textarea):hover{box-shadow:var(--swal2-input-hover-box-shadow)}div:where(.swal2-container) input:where(.swal2-input):focus,div:where(.swal2-container) input:where(.swal2-file):focus,div:where(.swal2-container) textarea:where(.swal2-textarea):focus{border:var(--swal2-input-focus-border);outline:none;box-shadow:var(--swal2-input-focus-box-shadow)}div:where(.swal2-container) input:where(.swal2-input)::placeholder,div:where(.swal2-container) input:where(.swal2-file)::placeholder,div:where(.swal2-container) textarea:where(.swal2-textarea)::placeholder{color:#ccc}div:where(.swal2-container) .swal2-range{margin:1em 2em 3px;background:var(--swal2-background)}div:where(.swal2-container) .swal2-range input{width:80%}div:where(.swal2-container) .swal2-range output{width:20%;color:inherit;font-weight:600;text-align:center}div:where(.swal2-container) .swal2-range input,div:where(.swal2-container) .swal2-range output{height:2.625em;padding:0;font-size:1.125em;line-height:2.625em}div:where(.swal2-container) .swal2-input{height:2.625em;padding:0 .75em}div:where(.swal2-container) .swal2-file{width:75%;margin-right:auto;margin-left:auto;background:var(--swal2-input-background);font-size:1.125em}div:where(.swal2-container) .swal2-textarea{height:6.75em;padding:.75em}div:where(.swal2-container) .swal2-select{min-width:50%;max-width:100%;padding:.375em .625em;background:var(--swal2-input-background);color:inherit;font-size:1.125em}div:where(.swal2-container) .swal2-radio,div:where(.swal2-container) .swal2-checkbox{align-items:center;justify-content:center;background:var(--swal2-background);color:inherit}div:where(.swal2-container) .swal2-radio label,div:where(.swal2-container) .swal2-checkbox label{margin:0 .6em;font-size:1.125em}div:where(.swal2-container) .swal2-radio input,div:where(.swal2-container) .swal2-checkbox input{flex-shrink:0;margin:0 .4em}div:where(.swal2-container) label:where(.swal2-input-label){display:flex;justify-content:center;margin:1em auto 0}div:where(.swal2-container) div:where(.swal2-validation-message){align-items:center;justify-content:center;margin:1em 0 0;padding:.625em;overflow:hidden;background:var(--swal2-validation-message-background);color:var(--swal2-validation-message-color);font-size:1em;font-weight:300}div:where(.swal2-container) div:where(.swal2-validation-message)::before{content:"!";display:inline-block;width:1.5em;min-width:1.5em;height:1.5em;margin:0 .625em;border-radius:50%;background-color:#f27474;color:#fff;font-weight:600;line-height:1.5em;text-align:center}div:where(.swal2-container) .swal2-progress-steps{flex-wrap:wrap;align-items:center;max-width:100%;margin:1.25em auto;padding:0;background:rgba(0,0,0,0);font-weight:600}div:where(.swal2-container) .swal2-progress-steps li{display:inline-block;position:relative}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step{z-index:20;flex-shrink:0;width:2em;height:2em;border-radius:2em;background:#2778c4;color:#fff;line-height:2em;text-align:center}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step.swal2-active-progress-step{background:#2778c4}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step.swal2-active-progress-step~.swal2-progress-step{background:var(--swal2-progress-step-background);color:#fff}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step.swal2-active-progress-step~.swal2-progress-step-line{background:var(--swal2-progress-step-background)}div:where(.swal2-container) .swal2-progress-steps .swal2-progress-step-line{z-index:10;flex-shrink:0;width:2.5em;height:.4em;margin:0 -1px;background:#2778c4}div:where(.swal2-icon){position:relative;box-sizing:content-box;justify-content:center;width:5em;height:5em;margin:2.5em auto .6em;zoom:var(--swal2-icon-zoom);border:.25em solid rgba(0,0,0,0);border-radius:50%;border-color:#000;font-family:inherit;line-height:5em;cursor:default;user-select:none}div:where(.swal2-icon) .swal2-icon-content{display:flex;align-items:center;font-size:3.75em}div:where(.swal2-icon).swal2-error{border-color:#f27474;color:#f27474}div:where(.swal2-icon).swal2-error .swal2-x-mark{position:relative;flex-grow:1}div:where(.swal2-icon).swal2-error [class^=swal2-x-mark-line]{display:block;position:absolute;top:2.3125em;width:2.9375em;height:.3125em;border-radius:.125em;background-color:#f27474}div:where(.swal2-icon).swal2-error [class^=swal2-x-mark-line][class$=left]{left:1.0625em;transform:rotate(45deg)}div:where(.swal2-icon).swal2-error [class^=swal2-x-mark-line][class$=right]{right:1em;transform:rotate(-45deg)}div:where(.swal2-icon).swal2-error.swal2-icon-show{animation:swal2-animate-error-icon .5s}div:where(.swal2-icon).swal2-error.swal2-icon-show .swal2-x-mark{animation:swal2-animate-error-x-mark .5s}div:where(.swal2-icon).swal2-warning{border-color:#f8bb86;color:#f8bb86}div:where(.swal2-icon).swal2-warning.swal2-icon-show{animation:swal2-animate-error-icon .5s}div:where(.swal2-icon).swal2-warning.swal2-icon-show .swal2-icon-content{animation:swal2-animate-i-mark .5s}div:where(.swal2-icon).swal2-info{border-color:#3fc3ee;color:#3fc3ee}div:where(.swal2-icon).swal2-info.swal2-icon-show{animation:swal2-animate-error-icon .5s}div:where(.swal2-icon).swal2-info.swal2-icon-show .swal2-icon-content{animation:swal2-animate-i-mark .8s}div:where(.swal2-icon).swal2-question{border-color:#87adbd;color:#87adbd}div:where(.swal2-icon).swal2-question.swal2-icon-show{animation:swal2-animate-error-icon .5s}div:where(.swal2-icon).swal2-question.swal2-icon-show .swal2-icon-content{animation:swal2-animate-question-mark .8s}div:where(.swal2-icon).swal2-success{border-color:#a5dc86;color:#a5dc86}div:where(.swal2-icon).swal2-success [class^=swal2-success-circular-line]{position:absolute;width:3.75em;height:7.5em;border-radius:50%}div:where(.swal2-icon).swal2-success [class^=swal2-success-circular-line][class$=left]{top:-0.4375em;left:-2.0635em;transform:rotate(-45deg);transform-origin:3.75em 3.75em;border-radius:7.5em 0 0 7.5em}div:where(.swal2-icon).swal2-success [class^=swal2-success-circular-line][class$=right]{top:-0.6875em;left:1.875em;transform:rotate(-45deg);transform-origin:0 3.75em;border-radius:0 7.5em 7.5em 0}div:where(.swal2-icon).swal2-success .swal2-success-ring{position:absolute;z-index:2;top:-0.25em;left:-0.25em;box-sizing:content-box;width:100%;height:100%;border:.25em solid rgba(165,220,134,.3);border-radius:50%}div:where(.swal2-icon).swal2-success .swal2-success-fix{position:absolute;z-index:1;top:.5em;left:1.625em;width:.4375em;height:5.625em;transform:rotate(-45deg)}div:where(.swal2-icon).swal2-success [class^=swal2-success-line]{display:block;position:absolute;z-index:2;height:.3125em;border-radius:.125em;background-color:#a5dc86}div:where(.swal2-icon).swal2-success [class^=swal2-success-line][class$=tip]{top:2.875em;left:.8125em;width:1.5625em;transform:rotate(45deg)}div:where(.swal2-icon).swal2-success [class^=swal2-success-line][class$=long]{top:2.375em;right:.5em;width:2.9375em;transform:rotate(-45deg)}div:where(.swal2-icon).swal2-success.swal2-icon-show .swal2-success-line-tip{animation:swal2-animate-success-line-tip .75s}div:where(.swal2-icon).swal2-success.swal2-icon-show .swal2-success-line-long{animation:swal2-animate-success-line-long .75s}div:where(.swal2-icon).swal2-success.swal2-icon-show .swal2-success-circular-line-right{animation:swal2-rotate-success-circular-line 4.25s ease-in}[class^=swal2]{-webkit-tap-highlight-color:rgba(0,0,0,0)}.swal2-show{animation:var(--swal2-show-animation)}.swal2-hide{animation:var(--swal2-hide-animation)}.swal2-noanimation{transition:none}.swal2-scrollbar-measure{position:absolute;top:-9999px;width:50px;height:50px;overflow:scroll}.swal2-rtl .swal2-close{margin-right:initial;margin-left:0}.swal2-rtl .swal2-timer-progress-bar{right:0;left:auto}.swal2-toast{box-sizing:border-box;grid-column:1/4 !important;grid-row:1/4 !important;grid-template-columns:min-content auto min-content;padding:1em;overflow-y:hidden;border:var(--swal2-toast-border);background:var(--swal2-background);box-shadow:var(--swal2-toast-box-shadow);pointer-events:auto}.swal2-toast>*{grid-column:2}.swal2-toast h2:where(.swal2-title){margin:.5em 1em;padding:0;font-size:1em;text-align:initial}.swal2-toast .swal2-loading{justify-content:center}.swal2-toast input:where(.swal2-input){height:2em;margin:.5em;font-size:1em}.swal2-toast .swal2-validation-message{font-size:1em}.swal2-toast div:where(.swal2-footer){margin:.5em 0 0;padding:.5em 0 0;font-size:.8em}.swal2-toast button:where(.swal2-close){grid-column:3/3;grid-row:1/99;align-self:center;width:.8em;height:.8em;margin:0;font-size:2em}.swal2-toast div:where(.swal2-html-container){margin:.5em 1em;padding:0;overflow:initial;font-size:1em;text-align:initial}.swal2-toast div:where(.swal2-html-container):empty{padding:0}.swal2-toast .swal2-loader{grid-column:1;grid-row:1/99;align-self:center;width:2em;height:2em;margin:.25em}.swal2-toast .swal2-icon{grid-column:1;grid-row:1/99;align-self:center;width:2em;min-width:2em;height:2em;margin:0 .5em 0 0}.swal2-toast .swal2-icon .swal2-icon-content{display:flex;align-items:center;font-size:1.8em;font-weight:bold}.swal2-toast .swal2-icon.swal2-success .swal2-success-ring{width:2em;height:2em}.swal2-toast .swal2-icon.swal2-error [class^=swal2-x-mark-line]{top:.875em;width:1.375em}.swal2-toast .swal2-icon.swal2-error [class^=swal2-x-mark-line][class$=left]{left:.3125em}.swal2-toast .swal2-icon.swal2-error [class^=swal2-x-mark-line][class$=right]{right:.3125em}.swal2-toast div:where(.swal2-actions){justify-content:flex-start;height:auto;margin:0;margin-top:.5em;padding:0 .5em}.swal2-toast button:where(.swal2-styled){margin:.25em .5em;padding:.4em .6em;font-size:1em}.swal2-toast .swal2-success{border-color:#a5dc86}.swal2-toast .swal2-success [class^=swal2-success-circular-line]{position:absolute;width:1.6em;height:3em;border-radius:50%}.swal2-toast .swal2-success [class^=swal2-success-circular-line][class$=left]{top:-0.8em;left:-0.5em;transform:rotate(-45deg);transform-origin:2em 2em;border-radius:4em 0 0 4em}.swal2-toast .swal2-success [class^=swal2-success-circular-line][class$=right]{top:-0.25em;left:.9375em;transform-origin:0 1.5em;border-radius:0 4em 4em 0}.swal2-toast .swal2-success .swal2-success-ring{width:2em;height:2em}.swal2-toast .swal2-success .swal2-success-fix{top:0;left:.4375em;width:.4375em;height:2.6875em}.swal2-toast .swal2-success [class^=swal2-success-line]{height:.3125em}.swal2-toast .swal2-success [class^=swal2-success-line][class$=tip]{top:1.125em;left:.1875em;width:.75em}.swal2-toast .swal2-success [class^=swal2-success-line][class$=long]{top:.9375em;right:.1875em;width:1.375em}.swal2-toast .swal2-success.swal2-icon-show .swal2-success-line-tip{animation:swal2-toast-animate-success-line-tip .75s}.swal2-toast .swal2-success.swal2-icon-show .swal2-success-line-long{animation:swal2-toast-animate-success-line-long .75s}.swal2-toast.swal2-show{animation:var(--swal2-toast-show-animation)}.swal2-toast.swal2-hide{animation:var(--swal2-toast-hide-animation)}@keyframes swal2-show{0%{transform:translate3d(0, -50px, 0) scale(0.9);opacity:0}100%{transform:translate3d(0, 0, 0) scale(1);opacity:1}}@keyframes swal2-hide{0%{transform:translate3d(0, 0, 0) scale(1);opacity:1}100%{transform:translate3d(0, -50px, 0) scale(0.9);opacity:0}}@keyframes swal2-animate-success-line-tip{0%{top:1.1875em;left:.0625em;width:0}54%{top:1.0625em;left:.125em;width:0}70%{top:2.1875em;left:-0.375em;width:3.125em}84%{top:3em;left:1.3125em;width:1.0625em}100%{top:2.8125em;left:.8125em;width:1.5625em}}@keyframes swal2-animate-success-line-long{0%{top:3.375em;right:2.875em;width:0}65%{top:3.375em;right:2.875em;width:0}84%{top:2.1875em;right:0;width:3.4375em}100%{top:2.375em;right:.5em;width:2.9375em}}@keyframes swal2-rotate-success-circular-line{0%{transform:rotate(-45deg)}5%{transform:rotate(-45deg)}12%{transform:rotate(-405deg)}100%{transform:rotate(-405deg)}}@keyframes swal2-animate-error-x-mark{0%{margin-top:1.625em;transform:scale(0.4);opacity:0}50%{margin-top:1.625em;transform:scale(0.4);opacity:0}80%{margin-top:-0.375em;transform:scale(1.15)}100%{margin-top:0;transform:scale(1);opacity:1}}@keyframes swal2-animate-error-icon{0%{transform:rotateX(100deg);opacity:0}100%{transform:rotateX(0deg);opacity:1}}@keyframes swal2-rotate-loading{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes swal2-animate-question-mark{0%{transform:rotateY(-360deg)}100%{transform:rotateY(0)}}@keyframes swal2-animate-i-mark{0%{transform:rotateZ(45deg);opacity:0}25%{transform:rotateZ(-25deg);opacity:.4}50%{transform:rotateZ(15deg);opacity:.8}75%{transform:rotateZ(-5deg);opacity:1}100%{transform:rotateX(0);opacity:1}}@keyframes swal2-toast-show{0%{transform:translateY(-0.625em) rotateZ(2deg)}33%{transform:translateY(0) rotateZ(-2deg)}66%{transform:translateY(0.3125em) rotateZ(2deg)}100%{transform:translateY(0) rotateZ(0deg)}}@keyframes swal2-toast-hide{100%{transform:rotateZ(1deg);opacity:0}}@keyframes swal2-toast-animate-success-line-tip{0%{top:.5625em;left:.0625em;width:0}54%{top:.125em;left:.125em;width:0}70%{top:.625em;left:-0.25em;width:1.625em}84%{top:1.0625em;left:.75em;width:.5em}100%{top:1.125em;left:.1875em;width:.75em}}@keyframes swal2-toast-animate-success-line-long{0%{top:1.625em;right:1.375em;width:0}65%{top:1.25em;right:.9375em;width:0}84%{top:.9375em;right:0;width:1.125em}100%{top:.9375em;right:.1875em;width:1.375em}}');
  }
});

// node_modules/.pnpm/@tabler+core@1.4.0/node_modules/@tabler/core/dist/js/tabler.esm.js
var elements$1 = document.querySelectorAll('[data-bs-toggle="autosize"]');
if (elements$1.length) {
  elements$1.forEach(function(element) {
    window.autosize && window.autosize(element);
  });
}
var elements = document.querySelectorAll("[data-countup]");
if (elements.length) {
  elements.forEach(function(element) {
    let options = {};
    try {
      const dataOptions = element.getAttribute("data-countup") ? JSON.parse(element.getAttribute("data-countup")) : {};
      options = Object.assign({
        "enableScrollSpy": true
      }, dataOptions);
    } catch (error) {
    }
    const value = parseInt(element.innerHTML, 10);
    if (window.countUp && window.countUp.CountUp) {
      const countUp = new window.countUp.CountUp(element, value, options);
      if (!countUp.error) {
        countUp.start();
      }
    }
  });
}
var maskElementList = [].slice.call(document.querySelectorAll("[data-mask]"));
maskElementList.map(function(maskEl) {
  window.IMask && new window.IMask(maskEl, {
    mask: maskEl.dataset.mask,
    lazy: maskEl.dataset["mask-visible"] === "true"
  });
});
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
function getNodeName(element) {
  return element ? (element.nodeName || "").toLowerCase() : null;
}
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
function isElement$1(node) {
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
function effect$2(_ref2) {
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
var applyStyles$1 = {
  name: "applyStyles",
  enabled: true,
  phase: "write",
  fn: applyStyles,
  effect: effect$2,
  requires: ["computeStyles"]
};
function getBasePlacement(placement) {
  return placement.split("-")[0];
}
var max = Math.max;
var min = Math.min;
var round = Math.round;
function getUAString() {
  var uaData = navigator.userAgentData;
  if (uaData != null && uaData.brands && Array.isArray(uaData.brands)) {
    return uaData.brands.map(function(item) {
      return item.brand + "/" + item.version;
    }).join(" ");
  }
  return navigator.userAgent;
}
function isLayoutViewport() {
  return !/^((?!chrome|android).)*safari/i.test(getUAString());
}
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
  var _ref = isElement$1(element) ? getWindow(element) : window, visualViewport = _ref.visualViewport;
  var addVisualOffsets = !isLayoutViewport() && isFixedStrategy;
  var x3 = (clientRect.left + (addVisualOffsets && visualViewport ? visualViewport.offsetLeft : 0)) / scaleX;
  var y4 = (clientRect.top + (addVisualOffsets && visualViewport ? visualViewport.offsetTop : 0)) / scaleY;
  var width = clientRect.width / scaleX;
  var height = clientRect.height / scaleY;
  return {
    width,
    height,
    top: y4,
    right: x3 + width,
    bottom: y4 + height,
    left: x3,
    x: x3,
    y: y4
  };
}
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
function getComputedStyle$1(element) {
  return getWindow(element).getComputedStyle(element);
}
function isTableElement(element) {
  return ["table", "td", "th"].indexOf(getNodeName(element)) >= 0;
}
function getDocumentElement(element) {
  return ((isElement$1(element) ? element.ownerDocument : (
    // $FlowFixMe[prop-missing]
    element.document
  )) || window.document).documentElement;
}
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
function getTrueOffsetParent(element) {
  if (!isHTMLElement(element) || // https://github.com/popperjs/popper-core/issues/837
  getComputedStyle$1(element).position === "fixed") {
    return null;
  }
  return element.offsetParent;
}
function getContainingBlock(element) {
  var isFirefox = /firefox/i.test(getUAString());
  var isIE = /Trident/i.test(getUAString());
  if (isIE && isHTMLElement(element)) {
    var elementCss = getComputedStyle$1(element);
    if (elementCss.position === "fixed") {
      return null;
    }
  }
  var currentNode = getParentNode(element);
  if (isShadowRoot(currentNode)) {
    currentNode = currentNode.host;
  }
  while (isHTMLElement(currentNode) && ["html", "body"].indexOf(getNodeName(currentNode)) < 0) {
    var css = getComputedStyle$1(currentNode);
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
  while (offsetParent && isTableElement(offsetParent) && getComputedStyle$1(offsetParent).position === "static") {
    offsetParent = getTrueOffsetParent(offsetParent);
  }
  if (offsetParent && (getNodeName(offsetParent) === "html" || getNodeName(offsetParent) === "body" && getComputedStyle$1(offsetParent).position === "static")) {
    return window2;
  }
  return offsetParent || getContainingBlock(element) || window2;
}
function getMainAxisFromPlacement(placement) {
  return ["top", "bottom"].indexOf(placement) >= 0 ? "x" : "y";
}
function within(min$1, value, max$1) {
  return max(min$1, min(value, max$1));
}
function withinMaxClamp(min2, value, max2) {
  var v3 = within(min2, value, max2);
  return v3 > max2 ? max2 : v3;
}
function getFreshSideObject() {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
}
function mergePaddingObject(paddingObject) {
  return Object.assign({}, getFreshSideObject(), paddingObject);
}
function expandToHashMap(value, keys) {
  return keys.reduce(function(hashMap, key) {
    hashMap[key] = value;
    return hashMap;
  }, {});
}
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
function effect$1(_ref2) {
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
var arrow$1 = {
  name: "arrow",
  enabled: true,
  phase: "main",
  fn: arrow,
  effect: effect$1,
  requires: ["popperOffsets"],
  requiresIfExists: ["preventOverflow"]
};
function getVariation(placement) {
  return placement.split("-")[1];
}
var unsetSides = {
  top: "auto",
  right: "auto",
  bottom: "auto",
  left: "auto"
};
function roundOffsetsByDPR(_ref, win) {
  var x3 = _ref.x, y4 = _ref.y;
  var dpr = win.devicePixelRatio || 1;
  return {
    x: round(x3 * dpr) / dpr || 0,
    y: round(y4 * dpr) / dpr || 0
  };
}
function mapToStyles(_ref2) {
  var _Object$assign2;
  var popper2 = _ref2.popper, popperRect = _ref2.popperRect, placement = _ref2.placement, variation = _ref2.variation, offsets = _ref2.offsets, position = _ref2.position, gpuAcceleration = _ref2.gpuAcceleration, adaptive = _ref2.adaptive, roundOffsets = _ref2.roundOffsets, isFixed = _ref2.isFixed;
  var _offsets$x = offsets.x, x3 = _offsets$x === void 0 ? 0 : _offsets$x, _offsets$y = offsets.y, y4 = _offsets$y === void 0 ? 0 : _offsets$y;
  var _ref3 = typeof roundOffsets === "function" ? roundOffsets({
    x: x3,
    y: y4
  }) : {
    x: x3,
    y: y4
  };
  x3 = _ref3.x;
  y4 = _ref3.y;
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
      if (getComputedStyle$1(offsetParent).position !== "static" && position === "absolute") {
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
      y4 -= offsetY - popperRect.height;
      y4 *= gpuAcceleration ? 1 : -1;
    }
    if (placement === left || (placement === top || placement === bottom) && variation === end) {
      sideX = right;
      var offsetX = isFixed && offsetParent === win && win.visualViewport ? win.visualViewport.width : (
        // $FlowFixMe[prop-missing]
        offsetParent[widthProp]
      );
      x3 -= offsetX - popperRect.width;
      x3 *= gpuAcceleration ? 1 : -1;
    }
  }
  var commonStyles = Object.assign({
    position
  }, adaptive && unsetSides);
  var _ref4 = roundOffsets === true ? roundOffsetsByDPR({
    x: x3,
    y: y4
  }, getWindow(popper2)) : {
    x: x3,
    y: y4
  };
  x3 = _ref4.x;
  y4 = _ref4.y;
  if (gpuAcceleration) {
    var _Object$assign;
    return Object.assign({}, commonStyles, (_Object$assign = {}, _Object$assign[sideY] = hasY ? "0" : "", _Object$assign[sideX] = hasX ? "0" : "", _Object$assign.transform = (win.devicePixelRatio || 1) <= 1 ? "translate(" + x3 + "px, " + y4 + "px)" : "translate3d(" + x3 + "px, " + y4 + "px, 0)", _Object$assign));
  }
  return Object.assign({}, commonStyles, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y4 + "px" : "", _Object$assign2[sideX] = hasX ? x3 + "px" : "", _Object$assign2.transform = "", _Object$assign2));
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
var computeStyles$1 = {
  name: "computeStyles",
  enabled: true,
  phase: "beforeWrite",
  fn: computeStyles,
  data: {}
};
var passive = {
  passive: true
};
function effect(_ref) {
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
var eventListeners = {
  name: "eventListeners",
  enabled: true,
  phase: "write",
  fn: function fn() {
  },
  effect,
  data: {}
};
var hash$1 = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function getOppositePlacement(placement) {
  return placement.replace(/left|right|bottom|top/g, function(matched) {
    return hash$1[matched];
  });
}
var hash = {
  start: "end",
  end: "start"
};
function getOppositeVariationPlacement(placement) {
  return placement.replace(/start|end/g, function(matched) {
    return hash[matched];
  });
}
function getWindowScroll(node) {
  var win = getWindow(node);
  var scrollLeft = win.pageXOffset;
  var scrollTop = win.pageYOffset;
  return {
    scrollLeft,
    scrollTop
  };
}
function getWindowScrollBarX(element) {
  return getBoundingClientRect(getDocumentElement(element)).left + getWindowScroll(element).scrollLeft;
}
function getViewportRect(element, strategy) {
  var win = getWindow(element);
  var html = getDocumentElement(element);
  var visualViewport = win.visualViewport;
  var width = html.clientWidth;
  var height = html.clientHeight;
  var x3 = 0;
  var y4 = 0;
  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height;
    var layoutViewport = isLayoutViewport();
    if (layoutViewport || !layoutViewport && strategy === "fixed") {
      x3 = visualViewport.offsetLeft;
      y4 = visualViewport.offsetTop;
    }
  }
  return {
    width,
    height,
    x: x3 + getWindowScrollBarX(element),
    y: y4
  };
}
function getDocumentRect(element) {
  var _element$ownerDocumen;
  var html = getDocumentElement(element);
  var winScroll = getWindowScroll(element);
  var body = (_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body;
  var width = max(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
  var height = max(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
  var x3 = -winScroll.scrollLeft + getWindowScrollBarX(element);
  var y4 = -winScroll.scrollTop;
  if (getComputedStyle$1(body || html).direction === "rtl") {
    x3 += max(html.clientWidth, body ? body.clientWidth : 0) - width;
  }
  return {
    width,
    height,
    x: x3,
    y: y4
  };
}
function isScrollParent(element) {
  var _getComputedStyle = getComputedStyle$1(element), overflow = _getComputedStyle.overflow, overflowX = _getComputedStyle.overflowX, overflowY = _getComputedStyle.overflowY;
  return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
}
function getScrollParent(node) {
  if (["html", "body", "#document"].indexOf(getNodeName(node)) >= 0) {
    return node.ownerDocument.body;
  }
  if (isHTMLElement(node) && isScrollParent(node)) {
    return node;
  }
  return getScrollParent(getParentNode(node));
}
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
function rectToClientRect(rect) {
  return Object.assign({}, rect, {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height
  });
}
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
  return clippingParent === viewport ? rectToClientRect(getViewportRect(element, strategy)) : isElement$1(clippingParent) ? getInnerBoundingClientRect(clippingParent, strategy) : rectToClientRect(getDocumentRect(getDocumentElement(element)));
}
function getClippingParents(element) {
  var clippingParents2 = listScrollParents(getParentNode(element));
  var canEscapeClipping = ["absolute", "fixed"].indexOf(getComputedStyle$1(element).position) >= 0;
  var clipperElement = canEscapeClipping && isHTMLElement(element) ? getOffsetParent(element) : element;
  if (!isElement$1(clipperElement)) {
    return [];
  }
  return clippingParents2.filter(function(clippingParent) {
    return isElement$1(clippingParent) && contains(clippingParent, clipperElement) && getNodeName(clippingParent) !== "body";
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
    }
  }
  return offsets;
}
function detectOverflow(state, options) {
  if (options === void 0) {
    options = {};
  }
  var _options = options, _options$placement = _options.placement, placement = _options$placement === void 0 ? state.placement : _options$placement, _options$strategy = _options.strategy, strategy = _options$strategy === void 0 ? state.strategy : _options$strategy, _options$boundary = _options.boundary, boundary = _options$boundary === void 0 ? clippingParents : _options$boundary, _options$rootBoundary = _options.rootBoundary, rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary, _options$elementConte = _options.elementContext, elementContext = _options$elementConte === void 0 ? popper : _options$elementConte, _options$altBoundary = _options.altBoundary, altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary, _options$padding = _options.padding, padding = _options$padding === void 0 ? 0 : _options$padding;
  var paddingObject = mergePaddingObject(typeof padding !== "number" ? padding : expandToHashMap(padding, basePlacements));
  var altContext = elementContext === popper ? reference : popper;
  var popperRect = state.rects.popper;
  var element = state.elements[altBoundary ? altContext : elementContext];
  var clippingClientRect = getClippingRect(isElement$1(element) ? element : element.contextElement || getDocumentElement(state.elements.popper), boundary, rootBoundary, strategy);
  var referenceClientRect = getBoundingClientRect(state.elements.reference);
  var popperOffsets2 = computeOffsets({
    reference: referenceClientRect,
    element: popperRect,
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
function computeAutoPlacement(state, options) {
  if (options === void 0) {
    options = {};
  }
  var _options = options, placement = _options.placement, boundary = _options.boundary, rootBoundary = _options.rootBoundary, padding = _options.padding, flipVariations = _options.flipVariations, _options$allowedAutoP = _options.allowedAutoPlacements, allowedAutoPlacements = _options$allowedAutoP === void 0 ? placements : _options$allowedAutoP;
  var variation = getVariation(placement);
  var placements$1 = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function(placement2) {
    return getVariation(placement2) === variation;
  }) : basePlacements;
  var allowedPlacements = placements$1.filter(function(placement2) {
    return allowedAutoPlacements.indexOf(placement2) >= 0;
  });
  if (allowedPlacements.length === 0) {
    allowedPlacements = placements$1;
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
  return Object.keys(overflows).sort(function(a3, b4) {
    return overflows[a3] - overflows[b4];
  });
}
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
  for (var i2 = 0; i2 < placements2.length; i2++) {
    var placement = placements2[i2];
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
var flip$1 = {
  name: "flip",
  enabled: true,
  phase: "main",
  fn: flip,
  requiresIfExists: ["offset"],
  data: {
    _skip: false
  }
};
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
var hide$1 = {
  name: "hide",
  enabled: true,
  phase: "main",
  requiresIfExists: ["preventOverflow"],
  fn: hide
};
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
  var _data$state$placement = data[state.placement], x3 = _data$state$placement.x, y4 = _data$state$placement.y;
  if (state.modifiersData.popperOffsets != null) {
    state.modifiersData.popperOffsets.x += x3;
    state.modifiersData.popperOffsets.y += y4;
  }
  state.modifiersData[name] = data;
}
var offset$1 = {
  name: "offset",
  enabled: true,
  phase: "main",
  requires: ["popperOffsets"],
  fn: offset
};
function popperOffsets(_ref) {
  var state = _ref.state, name = _ref.name;
  state.modifiersData[name] = computeOffsets({
    reference: state.rects.reference,
    element: state.rects.popper,
    placement: state.placement
  });
}
var popperOffsets$1 = {
  name: "popperOffsets",
  enabled: true,
  phase: "read",
  fn: popperOffsets,
  data: {}
};
function getAltAxis(axis) {
  return axis === "x" ? "y" : "x";
}
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
    var min$1 = offset2 + overflow[mainSide];
    var max$1 = offset2 - overflow[altSide];
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
    var preventedOffset = within(tether ? min(min$1, tetherMin) : min$1, offset2, tether ? max(max$1, tetherMax) : max$1);
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
var preventOverflow$1 = {
  name: "preventOverflow",
  enabled: true,
  phase: "main",
  fn: preventOverflow,
  requiresIfExists: ["offset"]
};
function getHTMLElementScroll(element) {
  return {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop
  };
}
function getNodeScroll(node) {
  if (node === getWindow(node) || !isHTMLElement(node)) {
    return getWindowScroll(node);
  } else {
    return getHTMLElementScroll(node);
  }
}
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
  var _generatorOptions = generatorOptions, _generatorOptions$def = _generatorOptions.defaultModifiers, defaultModifiers2 = _generatorOptions$def === void 0 ? [] : _generatorOptions$def, _generatorOptions$def2 = _generatorOptions.defaultOptions, defaultOptions = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
  return function createPopper2(reference2, popper2, options) {
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
          reference: isElement$1(reference2) ? listScrollParents(reference2) : reference2.contextElement ? listScrollParents(reference2.contextElement) : [],
          popper: listScrollParents(popper2)
        };
        var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers2, state.options.modifiers)));
        state.orderedModifiers = orderedModifiers.filter(function(m4) {
          return m4.enabled;
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
        var name = _ref.name, _ref$options = _ref.options, options2 = _ref$options === void 0 ? {} : _ref$options, effect2 = _ref.effect;
        if (typeof effect2 === "function") {
          var cleanupFn = effect2({
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
var createPopper$2 = /* @__PURE__ */ popperGenerator();
var defaultModifiers$1 = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1];
var createPopper$1 = /* @__PURE__ */ popperGenerator({
  defaultModifiers: defaultModifiers$1
});
var defaultModifiers = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1, offset$1, flip$1, preventOverflow$1, arrow$1, hide$1];
var createPopper = /* @__PURE__ */ popperGenerator({
  defaultModifiers
});
var Popper = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  afterMain,
  afterRead,
  afterWrite,
  applyStyles: applyStyles$1,
  arrow: arrow$1,
  auto,
  basePlacements,
  beforeMain,
  beforeRead,
  beforeWrite,
  bottom,
  clippingParents,
  computeStyles: computeStyles$1,
  createPopper,
  createPopperBase: createPopper$2,
  createPopperLite: createPopper$1,
  detectOverflow,
  end,
  eventListeners,
  flip: flip$1,
  hide: hide$1,
  left,
  main,
  modifierPhases,
  offset: offset$1,
  placements,
  popper,
  popperGenerator,
  popperOffsets: popperOffsets$1,
  preventOverflow: preventOverflow$1,
  read,
  reference,
  right,
  start,
  top,
  variationPlacements,
  viewport,
  write
}, Symbol.toStringTag, { value: "Module" }));
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
var isElement = (object) => {
  if (!object || typeof object !== "object") {
    return false;
  }
  if (typeof object.jquery !== "undefined") {
    object = object[0];
  }
  return typeof object.nodeType !== "undefined";
};
var getElement = (object) => {
  if (isElement(object)) {
    return object.jquery ? object[0] : object;
  }
  if (typeof object === "string" && object.length > 0) {
    return document.querySelector(parseSelector(object));
  }
  return null;
};
var isVisible = (element) => {
  if (!isElement(element) || element.getClientRects().length === 0) {
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
var defineJQueryPlugin = (plugin15) => {
  onDOMContentLoaded(() => {
    const $3 = getjQuery();
    if ($3) {
      const name = plugin15.NAME;
      const JQUERY_NO_CONFLICT = $3.fn[name];
      $3.fn[name] = plugin15.jQueryInterface;
      $3.fn[name].Constructor = plugin15;
      $3.fn[name].noConflict = () => {
        $3.fn[name] = JQUERY_NO_CONFLICT;
        return plugin15.jQueryInterface;
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
    const jsonConfig = isElement(element) ? Manipulator.getDataAttribute(element, "config") : {};
    return {
      ...this.constructor.Default,
      ...typeof jsonConfig === "object" ? jsonConfig : {},
      ...isElement(element) ? Manipulator.getDataAttributes(element) : {},
      ...typeof config === "object" ? config : {}
    };
  }
  _typeCheckConfig(config, configTypes = this.constructor.DefaultType) {
    for (const [property, expectedTypes] of Object.entries(configTypes)) {
      const value = config[property];
      const valueType = isElement(value) ? "element" : toType(value);
      if (!new RegExp(expectedTypes).test(valueType)) {
        throw new TypeError(`${this.constructor.NAME.toUpperCase()}: Option "${property}" provided type "${valueType}" but expected type "${expectedTypes}".`);
      }
    }
  }
};
var VERSION = "5.3.7";
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
    const triggerEvent2 = (eventName) => {
      return EventHandler.trigger(this._element, eventName, {
        relatedTarget: nextElement,
        direction: this._orderToDirection(order2),
        from: this._getItemIndex(activeElement),
        to: nextElementIndex
      });
    };
    const slideEvent = triggerEvent2(EVENT_SLIDE);
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
      triggerEvent2(EVENT_SLID);
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
    this._element.focus();
  }
  _getConfig(config) {
    config = super._getConfig(config);
    if (typeof config.reference === "object" && !isElement(config.reference) && typeof config.reference.getBoundingClientRect !== "function") {
      throw new TypeError(`${NAME$a.toUpperCase()}: Option "reference" provided type "object" without a required "getBoundingClientRect" method.`);
    }
    return config;
  }
  _createPopper() {
    if (typeof Popper === "undefined") {
      throw new TypeError("Bootstrap's dropdowns require Popper (https://popper.js.org/docs/v2/)");
    }
    let referenceElement = this._element;
    if (this._config.reference === "parent") {
      referenceElement = this._parent;
    } else if (isElement(this._config.reference)) {
      referenceElement = getElement(this._config.reference);
    } else if (typeof this._config.reference === "object") {
      referenceElement = this._config.reference;
    }
    const popperConfig = this._getPopperConfig();
    this._popper = createPopper(referenceElement, this._menu, popperConfig);
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
    const elements2 = SelectorEngine.focusableChildren(trapElement);
    if (elements2.length === 0) {
      trapElement.focus();
    } else if (this._lastTabNavDirection === TAB_NAV_BACKWARD) {
      elements2[elements2.length - 1].focus();
    } else {
      elements2[0].focus();
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
    if (isElement(selector)) {
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
  const elements2 = [].concat(...createdDocument.body.querySelectorAll("*"));
  for (const element of elements2) {
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
    if (isElement(content)) {
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
    if (typeof Popper === "undefined") {
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
    return createPopper(this._element, tip, this._getPopperConfig(attachment));
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
  _setTimeout(handler, timeout2) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(handler, timeout2);
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
var dropdownTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="dropdown"]'));
dropdownTriggerList.map(function(dropdownTriggerEl) {
  let options = {
    boundary: dropdownTriggerEl.getAttribute("data-bs-boundary") === "viewport" ? document.querySelector(".btn") : "clippingParents"
  };
  return new Dropdown(dropdownTriggerEl, options);
});
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltipTriggerList.map(function(tooltipTriggerEl) {
  let options = {
    delay: {
      show: 50,
      hide: 50
    },
    html: tooltipTriggerEl.getAttribute("data-bs-html") === "true",
    placement: tooltipTriggerEl.getAttribute("data-bs-placement") ?? "auto"
  };
  return new Tooltip(tooltipTriggerEl, options);
});
var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
popoverTriggerList.map(function(popoverTriggerEl) {
  let options = {
    delay: {
      show: 50,
      hide: 50
    },
    html: popoverTriggerEl.getAttribute("data-bs-html") === "true",
    placement: popoverTriggerEl.getAttribute("data-bs-placement") ?? "auto"
  };
  return new Popover(popoverTriggerEl, options);
});
var switchesTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="switch-icon"]'));
switchesTriggerList.map(function(switchTriggerEl) {
  switchTriggerEl.addEventListener("click", (e2) => {
    e2.stopPropagation();
    switchTriggerEl.classList.toggle("active");
  });
});
var EnableActivationTabsFromLocationHash = () => {
  const locationHash = window.location.hash;
  if (locationHash) {
    const tabsList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tab"]'));
    const matchedTabs = tabsList.filter((tab) => tab.hash === locationHash);
    matchedTabs.map((tab) => {
      new Tab(tab).show();
    });
  }
};
EnableActivationTabsFromLocationHash();
var toastsTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="toast"]'));
toastsTriggerList.map(function(toastTriggerEl) {
  if (!toastTriggerEl.hasAttribute("data-bs-target")) {
    return;
  }
  const toastEl = new Toast(toastTriggerEl.getAttribute("data-bs-target"));
  toastTriggerEl.addEventListener("click", () => {
    toastEl.show();
  });
});

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
var p = (e2, t2) => {
  throw Error(`${e2} ${JSON.stringify(t2)}`);
};
var O = (e2) => {
  if (e2 === "_")
    return " ";
  const t2 = J[e2.charAt(1)];
  return t2 || p("Illegal escape code", e2), t2;
};
var C = (e2) => e2 === " " ? "_" : "*" + b[e2];
var A = /(_|\*.)/g;
var a = (e2) => A.test(e2) ? e2.replace(A, O) : e2;
var $ = /([*_~$+'() <>%?#&=\\\n\r\0\u2028\u2029])/g;
var I = (e2) => $.test(e2) ? e2.replace($, C) : e2;
var c = (e2) => {
  let t2, s2;
  for (t2 = e2.t; t2 < e2.o && (s2 = e2.l.charAt(t2), s2 !== "~" && s2 !== ")"); t2++)
    ;
  const l4 = e2.l.slice(e2.t, t2);
  return s2 === "~" && t2++, e2.t = t2, l4;
};
var h = (e2) => e2.l.charAt(e2.t);
var f = (e2) => {
  e2.t++;
};
var U = {};
var d = (e2) => {
  let t2, s2, l4 = h(e2);
  if (!l4)
    return U;
  if (l4 === "(") {
    let r2;
    for (f(e2), t2 = {}; l4 = h(e2), l4 && l4 !== ")"; )
      s2 = a(c(e2)), l4 = h(e2), r2 = !l4 || l4 === ")" || d(e2), t2[s2] = r2;
    l4 === ")" && f(e2);
  } else if (l4 === "!") {
    for (f(e2), t2 = []; l4 = h(e2), l4 && l4 !== "~" && l4 !== ")"; )
      t2.push(d(e2));
    l4 === "~" && f(e2);
  } else
    l4 === "_" ? (f(e2), s2 = a(c(e2)), s2.charAt(0) === "D" ? t2 = new Date(s2.slice(1)) : s2 in y ? t2 = y[s2] : p("Unknown dict reference", s2)) : l4 === "*" ? (f(e2), t2 = a(c(e2))) : l4 === "~" ? (f(e2), t2 = true) : D.test(l4) ? (t2 = +c(e2), isNaN(t2) && p("Not a number", l4)) : S.test(l4) ? t2 = a(c(e2)) : p("Cannot decode part ", e2.l.slice(e2.t, e2.t + 10));
  return t2;
};
var _ = (e2, t2, s2, l4) => {
  let r2, i2 = typeof e2;
  if (i2 === "number")
    t2.push(isFinite(e2) ? e2.toString() : s2 ? isNaN(e2) ? "_n" : e2 > 0 ? "_I" : "_J" : g);
  else if (i2 === "boolean")
    t2.push(e2 ? "" : "_F");
  else if (i2 === "string")
    r2 = I(e2), S.test(r2) ? t2.push(r2) : t2.push("*" + r2);
  else if (i2 === "object")
    if (e2)
      if (s2 && e2 instanceof Date)
        t2.push("_D" + e2.toJSON().replace("T00:00:00.000Z", ""));
      else if (typeof e2.toJSON == "function")
        _(e2.toJSON(), t2, s2, l4);
      else if (Array.isArray(e2)) {
        t2.push("!");
        for (let n2 = 0; n2 < e2.length; n2++)
          r2 = e2[n2], r2 === true ? t2.push("_T") : _(r2, t2, s2, l4 + 1);
        t2.push("");
      } else {
        t2.push("(");
        for (const n2 of Object.keys(e2))
          r2 = e2[n2], r2 !== void 0 && typeof r2 != "function" && (t2.push(I(n2)), _(r2, t2, s2, l4 + 1));
        for (; t2[t2.length - 1] === ""; )
          t2.pop();
        t2.push(")");
      }
    else
      t2.push(g);
  else
    t2.push(s2 || l4 === 0 ? "_U" : g);
};
var w = { true: "*true", false: "*false", null: "*null" };
var m = (e2, t2) => {
  let s2, l4 = [], r2 = "", i2 = false, n2 = t2?.short, o2 = t2?.rich;
  _(e2, l4, o2, 0);
  let u2 = l4.length;
  do
    s2 = l4[--u2];
  while (s2 === "" || n2 && s2 === ")");
  for (let N3 = 0; u2 >= N3; N3++)
    s2 = l4[N3], i2 && s2 !== ")" && (r2 += "~"), r2 += s2, i2 = !(s2 === "!" || s2 === "(" || s2 === ")");
  return n2 ? 6 > r2.length && (s2 = w[r2], s2 && (r2 = s2)) : r2 += "~", r2;
};
var R = /^({|\[|"|true$|false$|null$)/;
var Z = (e2, t2) => {
  if (t2 && t2.deURI && (e2 = ((r2) => {
    let i2, n2 = "", o2 = 0, u2 = 0;
    for (; o2 < r2.length; )
      i2 = r2.charCodeAt(o2), i2 === 37 ? (o2 > u2 && (n2 += r2.slice(u2, o2)), r2 = decodeURIComponent(r2.slice(o2)), o2 = u2 = 0) : i2 === 32 || i2 === 10 || i2 === 13 || i2 === 0 || i2 === 8232 || i2 === 8233 ? (o2 > u2 && (n2 += r2.slice(u2, o2)), o2++, u2 = o2) : o2++;
    return o2 > u2 && (n2 += r2.slice(u2, o2)), n2;
  })(e2)), R.test(e2))
    return JSON.parse(e2);
  const s2 = e2.length, l4 = d({ l: e2, t: 0, o: s2 });
  return l4 === U || l4;
};
var E = (e2, t2, s2) => {
  try {
    return Z(e2, s2);
  } catch {
    return t2;
  }
};

// src/vendor.js
var FilePond = __toESM(require_filepond(), 1);

// node_modules/.pnpm/@yaireo+tagify@4.38.0_prop-types@15.8.1_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/@yaireo/tagify/dist/tagify.esm.js
var t = "&#8203;";
var e = { isEnabled: () => window.TAGIFY_DEBUG ?? true, log(...t2) {
  this.isEnabled() && console.log("[Tagify]:", ...t2);
}, warn(...t2) {
  this.isEnabled() && console.warn("[Tagify]:", ...t2);
} };
var s = (t2, e2, s2, i2) => (t2 = "" + t2, e2 = "" + e2, i2 && (t2 = t2.trim(), e2 = e2.trim()), s2 ? t2 == e2 : t2.toLowerCase() == e2.toLowerCase());
var i = (t2, e2) => t2 && Array.isArray(t2) && t2.map(((t3) => a2(t3, e2)));
function a2(t2, e2) {
  var s2, i2 = {};
  for (s2 in t2) e2.indexOf(s2) < 0 && (i2[s2] = t2[s2]);
  return i2;
}
function n(t2) {
  return new DOMParser().parseFromString(t2.trim(), "text/html").body.firstElementChild;
}
function o(t2, e2) {
  for (e2 = e2 || "previous"; t2 = t2[e2 + "Sibling"]; ) if (3 == t2.nodeType) return t2;
}
function r(t2) {
  return "string" == typeof t2 ? t2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/`|'/g, "&#039;") : t2;
}
function l(t2) {
  var e2 = Object.prototype.toString.call(t2).split(" ")[1].slice(0, -1);
  return t2 === Object(t2) && "Array" != e2 && "Function" != e2 && "RegExp" != e2 && "HTMLUnknownElement" != e2;
}
function d2(t2, e2, s2) {
  function i2(t3, e3) {
    for (var s3 in e3) if (e3.hasOwnProperty(s3)) {
      if (l(e3[s3])) {
        l(t3[s3]) ? i2(t3[s3], e3[s3]) : t3[s3] = Object.assign({}, e3[s3]);
        continue;
      }
      if (Array.isArray(e3[s3])) {
        t3[s3] = Object.assign([], e3[s3]);
        continue;
      }
      t3[s3] = e3[s3];
    }
  }
  return t2 instanceof Object || (t2 = {}), i2(t2, e2), s2 && i2(t2, s2), t2;
}
function h2() {
  const t2 = [], e2 = {};
  for (let s2 of arguments) for (let i2 of s2) l(i2) ? e2[i2.value] || (t2.push(i2), e2[i2.value] = 1) : t2.includes(i2) || t2.push(i2);
  return t2;
}
function g2(t2) {
  return String.prototype.normalize ? "string" == typeof t2 ? t2.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : void 0 : t2;
}
var c2 = () => /(?=.*chrome)(?=.*android)/i.test(navigator.userAgent);
function p2() {
  return ("10000000-1000-4000-8000" + -1e11).replace(/[018]/g, ((t2) => (t2 ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> t2 / 4).toString(16)));
}
function u(t2) {
  const e2 = v.call(this, t2), s2 = t2?.classList?.contains(this.settings.classNames.tag);
  return e2 && s2;
}
function m2(t2) {
  return v.call(this, t2) && t2?.closest(this.settings.classNames.tagSelector);
}
function v(t2) {
  let e2 = t2?.closest?.(this.settings.classNames.namespaceSelector);
  return e2 === this.DOM.scope;
}
function f2(t2, e2) {
  var s2 = window.getSelection();
  return e2 = e2 || (s2.rangeCount ? s2.getRangeAt(0) : null), "string" == typeof t2 && (t2 = document.createTextNode(t2)), e2 && (e2.deleteContents(), e2.insertNode(t2)), t2;
}
function T(t2, s2, i2) {
  return t2 ? (s2 && (t2.__tagifyTagData = i2 ? s2 : d2({}, t2.__tagifyTagData || {}, s2)), t2.__tagifyTagData) : (e.warn("tag element doesn't exist", { tagElm: t2, data: s2 }), s2);
}
function w2(t2) {
  if (t2 && t2.parentNode) {
    var e2 = window.getSelection();
    if (e2) {
      var s2 = document.createRange();
      s2.setStartAfter(t2), s2.collapse(true), e2.removeAllRanges(), e2.addRange(s2);
    }
  }
}
function b2(t2, e2) {
  t2.forEach(((t3) => {
    if (T(t3.previousSibling) || !t3.previousSibling) {
      var s2 = document.createTextNode("\u200B");
      t3.before(s2), e2 && w2(s2);
    }
  }));
}
var y2 = { delimiters: ",", pattern: null, tagTextProp: "value", maxTags: 1 / 0, callbacks: {}, addTagOnBlur: true, addTagOn: ["blur", "tab", "enter"], onChangeAfterBlur: true, duplicates: false, whitelist: [], blacklist: [], enforceWhitelist: false, userInput: true, focusable: true, focusInputOnRemove: true, keepInvalidTags: false, createInvalidTags: true, mixTagsAllowedAfter: /,|\.|\:|\s/, mixTagsInterpolator: ["[[", "]]"], backspace: true, allowCaretBetweenTags: true, skipInvalid: false, pasteAsTags: true, editTags: { clicks: 2, keepInvalid: true }, transformTag: () => {
}, trim: true, a11y: { focusableTags: false, inputAriaLabel: "Tags input field" }, mixMode: { insertAfterTag: "\xA0" }, autoComplete: { enabled: true, rightKey: false, tabKey: false }, classNames: { namespace: "tagify", mixMode: "tagify--mix", selectMode: "tagify--select", input: "tagify__input", focus: "tagify--focus", tagNoAnimation: "tagify--noAnim", tagInvalid: "tagify--invalid", tagNotAllowed: "tagify--notAllowed", scopeLoading: "tagify--loading", hasMaxTags: "tagify--hasMaxTags", hasNoTags: "tagify--noTags", empty: "tagify--empty", inputInvalid: "tagify__input--invalid", dropdown: "tagify__dropdown", dropdownWrapper: "tagify__dropdown__wrapper", dropdownHeader: "tagify__dropdown__header", dropdownFooter: "tagify__dropdown__footer", dropdownItem: "tagify__dropdown__item", dropdownItemActive: "tagify__dropdown__item--active", dropdownItemHidden: "tagify__dropdown__item--hidden", dropdownItemSelected: "tagify__dropdown__item--selected", dropdownInital: "tagify__dropdown--initial", tag: "tagify__tag", tagText: "tagify__tag-text", tagX: "tagify__tag__removeBtn", tagLoading: "tagify__tag--loading", tagEditing: "tagify__tag--editable", tagFlash: "tagify__tag--flash", tagHide: "tagify__tag--hide" }, dropdown: { classname: "", enabled: 2, maxItems: 10, searchKeys: ["value", "searchBy"], fuzzySearch: true, caseSensitive: false, accentedSearch: true, includeSelectedTags: false, escapeHTML: true, highlightFirst: true, closeOnSelect: true, clearOnSelect: true, position: "all", appendTarget: null }, hooks: { beforeRemoveTag: () => Promise.resolve(), beforePaste: () => Promise.resolve(), suggestionClick: () => Promise.resolve(), beforeKeyDown: () => Promise.resolve() } };
function x() {
  this.dropdown = {};
  for (let t2 in this._dropdown) this.dropdown[t2] = "function" == typeof this._dropdown[t2] ? this._dropdown[t2].bind(this) : this._dropdown[t2];
  this.dropdown.refs(), this.DOM.dropdown.__tagify = this;
}
var D2 = { ...{ events: { binding(t2 = true) {
  var e2 = this.dropdown.events.callbacks, s2 = this.listeners.dropdown = this.listeners.dropdown || { position: this.dropdown.position.bind(this, null), onKeyDown: e2.onKeyDown.bind(this), onMouseOver: e2.onMouseOver.bind(this), onMouseLeave: e2.onMouseLeave.bind(this), onClick: e2.onClick.bind(this), onScroll: e2.onScroll.bind(this) }, i2 = t2 ? "addEventListener" : "removeEventListener";
  "manual" != this.settings.dropdown.position && (document[i2]("scroll", s2.position, true), window[i2]("resize", s2.position), window[i2]("keydown", s2.onKeyDown)), this.DOM.dropdown[i2]("mouseover", s2.onMouseOver), this.DOM.dropdown[i2]("mouseleave", s2.onMouseLeave), this.DOM.dropdown[i2]("mousedown", s2.onClick), this.DOM.dropdown.content[i2]("scroll", s2.onScroll);
}, callbacks: { onKeyDown(t2) {
  if (this.state.hasFocus && !this.state.composing) {
    var s2 = this.settings, i2 = s2.dropdown.includeSelectedTags, a3 = this.DOM.dropdown.querySelector(s2.classNames.dropdownItemActiveSelector), n2 = this.dropdown.getSuggestionDataByNode(a3), o2 = "mix" == s2.mode, r2 = "select" == s2.mode;
    s2.hooks.beforeKeyDown(t2, { tagify: this }).then(((l4) => {
      switch (t2.key) {
        case "ArrowDown":
        case "ArrowUp":
        case "Down":
        case "Up":
          t2.preventDefault();
          var d4 = this.dropdown.getAllSuggestionsRefs(), h3 = "ArrowUp" == t2.key || "Up" == t2.key;
          a3 && (a3 = this.dropdown.getNextOrPrevOption(a3, !h3)), a3 && a3.matches(s2.classNames.dropdownItemSelector) || (a3 = d4[h3 ? d4.length - 1 : 0]), this.dropdown.highlightOption(a3, true);
          break;
        case "PageUp":
        case "PageDown": {
          t2.preventDefault();
          const e2 = this.dropdown.getAllSuggestionsRefs(), s3 = Math.floor(this.DOM.dropdown.content.clientHeight / e2[0]?.offsetHeight) || 1, i3 = "PageUp" === t2.key;
          if (a3) {
            const t3 = e2.indexOf(a3), n3 = i3 ? Math.max(0, t3 - s3) : Math.min(e2.length - 1, t3 + s3);
            a3 = e2[n3];
          } else a3 = e2[0];
          this.dropdown.highlightOption(a3, true);
          break;
        }
        case "Home":
        case "End": {
          t2.preventDefault();
          const e2 = this.dropdown.getAllSuggestionsRefs();
          a3 = e2["Home" === t2.key ? 0 : e2.length - 1], this.dropdown.highlightOption(a3, true);
          break;
        }
        case "Escape":
        case "Esc":
          this.dropdown.hide();
          break;
        case "ArrowRight":
          if (this.state.actions.ArrowLeft || s2.autoComplete.rightKey || s2.allowCaretBetweenTags) return;
        case "Tab": {
          let e2 = !s2.autoComplete.rightKey || !s2.autoComplete.tabKey;
          if (!o2 && !r2 && a3 && e2 && !this.state.editing && n2) {
            t2.preventDefault();
            var g4 = this.dropdown.getMappedValue(n2);
            return this.state.autoCompleteData = n2, this.input.autocomplete.set.call(this, g4), false;
          }
          return true;
        }
        case "Enter":
          t2.preventDefault(), this.state.actions.selectOption = true, setTimeout((() => this.state.actions.selectOption = false), 100), s2.hooks.suggestionClick(t2, { tagify: this, tagData: n2, suggestionElm: a3 }).then((() => {
            if (a3) {
              var e2 = i2 ? a3 : this.dropdown.getNextOrPrevOption(a3, !h3);
              this.dropdown.selectOption(a3, t2, (() => {
                if (e2) {
                  var t3 = e2.getAttribute("value");
                  e2 = this.dropdown.getSuggestionNodeByValue(t3), this.dropdown.highlightOption(e2);
                }
              }));
            } else this.dropdown.hide(), o2 || this.addTags(this.state.inputText.trim(), true);
          })).catch(((t3) => e.warn(t3)));
          break;
        case "Backspace": {
          if (o2 || this.state.editing.scope) return;
          const t3 = this.input.raw.call(this);
          "" != t3 && 8203 != t3.charCodeAt(0) || (true === s2.backspace ? this.removeTags() : "edit" == s2.backspace && setTimeout(this.editTag.bind(this), 0));
        }
      }
    }));
  }
}, onMouseOver(t2) {
  var e2 = t2.target.closest(this.settings.classNames.dropdownItemSelector);
  this.dropdown.highlightOption(e2);
}, onMouseLeave(t2) {
  this.dropdown.highlightOption();
}, onClick(t2) {
  if (0 == t2.button && t2.target != this.DOM.dropdown && t2.target != this.DOM.dropdown.content) {
    var s2 = t2.target.closest(this.settings.classNames.dropdownItemSelector), i2 = this.dropdown.getSuggestionDataByNode(s2);
    this.state.actions.selectOption = true, setTimeout((() => this.state.actions.selectOption = false), 100), this.settings.hooks.suggestionClick(t2, { tagify: this, tagData: i2, suggestionElm: s2 }).then((() => {
      s2 ? this.dropdown.selectOption(s2, t2) : this.dropdown.hide();
    })).catch(((t3) => e.warn(t3)));
  }
}, onScroll(t2) {
  var e2 = t2.target, s2 = e2.scrollTop / (e2.scrollHeight - e2.parentNode.clientHeight) * 100;
  this.trigger("dropdown:scroll", { percentage: Math.round(s2) });
} } }, refilter(t2) {
  t2 = t2 || this.state.dropdown.query || "", this.suggestedListItems = this.dropdown.filterListItems(t2), this.dropdown.fill(), this.suggestedListItems.length || this.dropdown.hide(), this.trigger("dropdown:updated", this.DOM.dropdown);
}, getSuggestionDataByNode(t2) {
  for (var e2, s2 = t2 && t2.getAttribute("value"), i2 = this.suggestedListItems.length; i2--; ) {
    if (l(e2 = this.suggestedListItems[i2]) && e2.value == s2) return e2;
    if (e2 == s2) return { value: e2 };
  }
}, getSuggestionNodeByValue(t2) {
  return this.dropdown.getAllSuggestionsRefs().find(((e2) => e2.getAttribute("value") === t2));
}, getNextOrPrevOption(t2, e2 = true) {
  var s2 = this.dropdown.getAllSuggestionsRefs(), i2 = s2.findIndex(((e3) => e3 === t2));
  return e2 ? s2[i2 + 1] : s2[i2 - 1];
}, highlightOption(t2, e2) {
  var s2, i2 = this.settings.classNames.dropdownItemActive;
  if (this.state.ddItemElm && (this.state.ddItemElm.classList.remove(i2), this.state.ddItemElm.removeAttribute("aria-selected")), !t2) return this.state.ddItemData = null, this.state.ddItemElm = null, void this.input.autocomplete.suggest.call(this);
  s2 = this.dropdown.getSuggestionDataByNode(t2), this.state.ddItemData = s2, this.state.ddItemElm = t2, t2.classList.add(i2), t2.setAttribute("aria-selected", true), e2 && (t2.parentNode.scrollTop = t2.clientHeight + t2.offsetTop - t2.parentNode.clientHeight), this.settings.autoComplete && (this.input.autocomplete.suggest.call(this, s2), this.dropdown.position());
}, selectOption(t2, e2, s2) {
  var i2 = this.settings, a3 = i2.dropdown.includeSelectedTags, { clearOnSelect: n2, closeOnSelect: o2 } = i2.dropdown;
  if (!t2) return this.addTags(this.state.inputText, true), void (o2 && this.dropdown.hide());
  e2 = e2 || {};
  var r2 = t2.getAttribute("value"), l4 = "noMatch" == r2, h3 = "mix" == i2.mode, g4 = this.suggestedListItems.find(((t3) => (t3.value ?? t3) == r2));
  if (this.trigger("dropdown:select", { data: g4, elm: t2, event: e2 }), g4 || l4) {
    if (this.state.editing) {
      let t3 = this.normalizeTags([g4])[0];
      g4 = i2.transformTag.call(this, t3) || t3, this.onEditTagDone(null, d2({ __isValid: true }, g4));
    } else this[h3 ? "addMixTags" : "addTags"]([g4 || this.input.raw.call(this)], n2);
    (h3 || this.DOM.input.parentNode) && (setTimeout((() => {
      this.DOM.input.focus(), this.toggleFocusClass(true);
    })), o2 && setTimeout(this.dropdown.hide.bind(this)), a3 ? s2 && s2() : (t2.addEventListener("transitionend", (() => {
      this.dropdown.fillHeaderFooter(), setTimeout((() => {
        t2.remove(), this.dropdown.refilter(), s2 && s2();
      }), 100);
    }), { once: true }), t2.classList.add(this.settings.classNames.dropdownItemHidden)));
  } else o2 && setTimeout(this.dropdown.hide.bind(this));
}, selectAll(t2) {
  this.suggestedListItems.length = 0, this.dropdown.hide(), this.dropdown.filterListItems("");
  var e2 = this.dropdown.filterListItems("");
  return t2 || (e2 = this.state.dropdown.suggestions), this.addTags(e2, true), this;
}, filterListItems(t2, e2) {
  var s2, i2, a3, n2, o2, r2 = this.settings, d4 = r2.dropdown, h3 = (e2 = e2 || {}, []), c3 = [], p3 = r2.whitelist, u2 = d4.maxItems >= 0 ? d4.maxItems : 1 / 0, m4 = d4.includeSelectedTags, v3 = "function" == typeof d4.sortby, f3 = d4.searchKeys, T3 = 0;
  if (!(t2 = "select" == r2.mode && this.value.length && this.value[0][r2.tagTextProp] == t2 ? "" : t2) || !f3.length) {
    h3 = m4 ? p3 : p3.filter(((t3) => !this.isTagDuplicate(l(t3) ? t3.value : t3)));
    var w4 = v3 ? d4.sortby(h3, o2) : h3.slice(0, u2);
    return this.state.dropdown.suggestions = w4, w4;
  }
  function b4(t3, e3) {
    return e3.toLowerCase().split(" ").every(((e4) => t3.includes(e4.toLowerCase())));
  }
  for (o2 = d4.caseSensitive ? "" + t2 : ("" + t2).toLowerCase(); T3 < p3.length; T3++) {
    let t3, r3;
    s2 = p3[T3] instanceof Object ? p3[T3] : { value: p3[T3] };
    let u3 = !Object.keys(s2).some(((t4) => f3.includes(t4))) ? ["value"] : f3;
    d4.fuzzySearch && !e2.exact ? (a3 = u3.reduce(((t4, e3) => t4 + " " + (s2[e3] || "")), "").toLowerCase().trim(), d4.accentedSearch && (a3 = g2(a3), o2 = g2(o2)), t3 = 0 == a3.indexOf(o2), r3 = a3 === o2, i2 = b4(a3, o2)) : (t3 = true, i2 = u3.some(((t4) => {
      var i3 = "" + (s2[t4] || "");
      return d4.accentedSearch && (i3 = g2(i3), o2 = g2(o2)), d4.caseSensitive || (i3 = i3.toLowerCase()), r3 = i3 === o2, e2.exact ? i3 === o2 : 0 == i3.indexOf(o2);
    }))), n2 = !d4.includeSelectedTags && this.isTagDuplicate(l(s2) ? s2.value : s2), i2 && !n2 && (r3 && t3 ? c3.push(s2) : "startsWith" == d4.sortby && t3 ? h3.unshift(s2) : h3.push(s2));
  }
  this.state.dropdown.suggestions = c3.concat(h3);
  w4 = v3 ? d4.sortby(c3.concat(h3), o2) : c3.concat(h3).slice(0, u2);
  return this.state.dropdown.suggestions = w4, w4;
}, getMappedValue(t2) {
  var e2 = this.settings.dropdown.mapValueTo;
  return e2 ? "function" == typeof e2 ? e2(t2) : t2[e2] || t2.value : t2.value;
}, createListHTML(t2) {
  return d2([], t2).map(((t3, e2) => {
    "string" != typeof t3 && "number" != typeof t3 || (t3 = { value: t3 });
    var s2 = this.dropdown.getMappedValue(t3);
    return s2 = "string" == typeof s2 && this.settings.dropdown.escapeHTML ? r(s2) : s2, this.settings.templates.dropdownItem.apply(this, [{ ...t3, mappedValue: s2 }, this]);
  })).join("");
} }, refs() {
  this.DOM.dropdown = this.parseTemplate("dropdown", [this.settings]), this.DOM.dropdown.content = this.DOM.dropdown.querySelector("[data-selector='tagify-suggestions-wrapper']");
}, getHeaderRef() {
  return this.DOM.dropdown.querySelector("[data-selector='tagify-suggestions-header']");
}, getFooterRef() {
  return this.DOM.dropdown.querySelector("[data-selector='tagify-suggestions-footer']");
}, getAllSuggestionsRefs() {
  return [...this.DOM.dropdown.content.querySelectorAll(this.settings.classNames.dropdownItemSelector)];
}, show(t2) {
  var e2, i2, a3, n2 = this.settings, o2 = "mix" == n2.mode && !n2.enforceWhitelist, r2 = !n2.whitelist || !n2.whitelist.length, d4 = "manual" == n2.dropdown.position;
  if (t2 = void 0 === t2 ? this.state.inputText : t2, !(r2 && !o2 && !n2.templates.dropdownItemNoMatch || false === n2.dropdown.enabled || this.state.isLoading || this.settings.readonly)) {
    if (clearTimeout(this.dropdownHide__bindEventsTimeout), this.suggestedListItems = this.dropdown.filterListItems(t2), t2 && !this.suggestedListItems.length && (this.trigger("dropdown:noMatch", t2), n2.templates.dropdownItemNoMatch && (a3 = n2.templates.dropdownItemNoMatch.call(this, { value: t2 }))), !a3) {
      if (this.suggestedListItems.length) t2 && o2 && !this.state.editing.scope && !s(this.suggestedListItems[0].value, t2) && this.suggestedListItems.unshift({ value: t2 });
      else {
        if (!t2 || !o2 || this.state.editing.scope) return this.input.autocomplete.suggest.call(this), void this.dropdown.hide();
        this.suggestedListItems = [{ value: t2 }];
      }
      i2 = "" + (l(e2 = this.suggestedListItems[0]) ? e2.value : e2), n2.autoComplete && i2 && 0 == i2.indexOf(t2) && this.input.autocomplete.suggest.call(this, e2);
    }
    this.dropdown.fill(a3), n2.dropdown.highlightFirst && this.dropdown.highlightOption(this.DOM.dropdown.content.querySelector(n2.classNames.dropdownItemSelector)), this.state.dropdown.visible || setTimeout(this.dropdown.events.binding.bind(this)), this.state.dropdown.visible = t2 || true, this.state.dropdown.query = t2, this.setStateSelection(), d4 || setTimeout((() => {
      this.dropdown.position(), this.dropdown.render();
    })), setTimeout((() => {
      this.trigger("dropdown:show", this.DOM.dropdown);
    }));
  }
}, hide(t2) {
  var { scope: e2, dropdown: s2 } = this.DOM, i2 = "manual" == this.settings.dropdown.position && !t2;
  if (s2 && document.body.contains(s2) && !i2) return window.removeEventListener("resize", this.dropdown.position), this.dropdown.events.binding.call(this, false), e2.setAttribute("aria-expanded", false), s2.parentNode.removeChild(s2), setTimeout((() => {
    this.state.dropdown.visible = false;
  }), 100), this.state.dropdown.query = this.state.ddItemData = this.state.ddItemElm = this.state.selection = null, this.state.tag && this.state.tag.value.length && (this.state.flaggedTags[this.state.tag.baseOffset] = this.state.tag), this.trigger("dropdown:hide", s2), this;
}, toggle(t2) {
  this.dropdown[this.state.dropdown.visible && !t2 ? "hide" : "show"]();
}, getAppendTarget() {
  var t2 = this.settings.dropdown;
  return "function" == typeof t2.appendTarget ? t2.appendTarget() : t2.appendTarget;
}, render() {
  var t2, e2, s2, i2 = (t2 = this.DOM.dropdown, (s2 = t2.cloneNode(true)).style.cssText = "position:fixed; top:-9999px; opacity:0", document.body.appendChild(s2), e2 = s2.clientHeight, s2.parentNode.removeChild(s2), e2), a3 = this.settings, n2 = this.dropdown.getAppendTarget();
  return false === a3.dropdown.enabled || (this.DOM.scope.setAttribute("aria-expanded", true), document.body.contains(this.DOM.dropdown) || (this.DOM.dropdown.classList.add(a3.classNames.dropdownInital), this.dropdown.position(i2), n2.appendChild(this.DOM.dropdown), setTimeout((() => this.DOM.dropdown.classList.remove(a3.classNames.dropdownInital))))), this;
}, fill(t2) {
  t2 = "string" == typeof t2 ? t2 : this.dropdown.createListHTML(t2 || this.suggestedListItems);
  var e2, s2 = this.settings.templates.dropdownContent.call(this, t2);
  this.DOM.dropdown.content.innerHTML = (e2 = s2) ? e2.replace(/\>[\r\n ]+\</g, "><").split(/>\s+</).join("><").trim() : "";
}, fillHeaderFooter() {
  var t2 = this.dropdown.filterListItems(this.state.dropdown.query), e2 = this.parseTemplate("dropdownHeader", [t2]), s2 = this.parseTemplate("dropdownFooter", [t2]), i2 = this.dropdown.getHeaderRef(), a3 = this.dropdown.getFooterRef();
  e2 && i2?.parentNode.replaceChild(e2, i2), s2 && a3?.parentNode.replaceChild(s2, a3);
}, position(t2) {
  var e2 = this.settings.dropdown, s2 = this.dropdown.getAppendTarget();
  if ("manual" != e2.position && s2) {
    var i2, a3, n2, o2, r2, l4, d4, h3, g4, c3, p3 = this.DOM.dropdown, u2 = e2.RTL, m4 = s2 === document.body, v3 = s2 === this.DOM.scope, f3 = m4 ? window.pageYOffset : s2.scrollTop, T3 = document.fullscreenElement || document.webkitFullscreenElement || document.documentElement, w4 = T3.clientHeight, b4 = Math.max(T3.clientWidth || 0, window.innerWidth || 0), y4 = b4 > 480 ? e2.position : "all", x3 = this.DOM["input" == y4 ? "input" : "scope"];
    if (t2 = t2 || p3.clientHeight, this.state.dropdown.visible) {
      if ("text" == y4 ? (n2 = (i2 = (function() {
        const t3 = document.getSelection();
        if (t3.rangeCount) {
          const e3 = t3.getRangeAt(0), s3 = e3.startContainer, i3 = e3.startOffset;
          let a4, n3;
          if (i3 > 0) return n3 = document.createRange(), n3.setStart(s3, i3 - 1), n3.setEnd(s3, i3), a4 = n3.getBoundingClientRect(), { left: a4.right, top: a4.top, bottom: a4.bottom };
          if (s3.getBoundingClientRect) return s3.getBoundingClientRect();
        }
        return { left: -9999, top: -9999 };
      })()).bottom, a3 = i2.top, o2 = i2.left, r2 = "auto") : (l4 = (function(t3) {
        var e3 = 0, s3 = 0;
        for (t3 = t3.parentNode; t3 && t3 != T3; ) e3 += t3.offsetTop || 0, s3 += t3.offsetLeft || 0, t3 = t3.parentNode;
        return { top: e3, left: s3 };
      })(s2), i2 = x3.getBoundingClientRect(), a3 = v3 ? -1 : i2.top - l4.top, n2 = (v3 ? i2.height : i2.bottom - l4.top) - 1, o2 = v3 ? -1 : i2.left - l4.left, r2 = i2.width + "px"), !m4) {
        let t3 = (function() {
          for (var t4 = 0, s3 = e2.appendTarget.parentNode; s3; ) t4 += s3.scrollTop || 0, s3 = s3.parentNode;
          return t4;
        })();
        a3 += t3, n2 += t3;
      }
      a3 = Math.floor(a3), n2 = Math.ceil(n2), h3 = b4 - o2 < 120, g4 = ((d4 = e2.placeAbove ?? w4 - i2.bottom < t2) ? a3 : n2) + f3, c3 = o2 + (u2 && i2.width || 0) + window.pageXOffset, c3 = "text" == y4 && h3 ? "right: 0;" : `left: ${c3}px;`, p3.style.cssText = `${c3} top: ${g4}px; min-width: ${r2}; max-width: ${r2}`, p3.setAttribute("placement", d4 ? "top" : "bottom"), p3.setAttribute("position", y4);
    }
  }
} };
var O2 = "@yaireo/tagify/";
var I2 = { empty: "empty", exceed: "number of tags exceeded", pattern: "pattern mismatch", duplicate: "already exists", notAllowed: "not allowed" };
var M = { wrapper(e2, s2) {
  return `<tags class="${s2.classNames.namespace} ${s2.mode ? `${s2.classNames[s2.mode + "Mode"]}` : ""} ${e2.className}"
                    ${s2.readonly ? "readonly" : ""}
                    ${s2.disabled ? "disabled" : ""}
                    ${s2.required ? "required" : ""}
                    ${"select" === s2.mode ? "spellcheck='false'" : ""}
                    tabIndex="-1">
                    ${this.settings.templates.input.call(this)}
                ${t}
        </tags>`;
}, input() {
  var e2 = this.settings, s2 = e2.placeholder || t;
  return `<span ${!e2.readonly && e2.userInput ? "contenteditable" : ""} data-can-editable tabIndex="0" data-placeholder="${s2}" aria-placeholder="${e2.placeholder || ""}"
                    class="${e2.classNames.input}"
                    role="textbox"
                    autocapitalize="false"
                    autocorrect="off"
                    aria-label="${e2.a11y.inputAriaLabel}"
                    aria-autocomplete="both"
                    aria-multiline="${"mix" == e2.mode}"></span>`;
}, tag(t2, { settings: e2 }) {
  return `<tag title="${t2.title || t2.value}"
                    contenteditable='false'
                    tabIndex="${e2.a11y.focusableTags ? 0 : -1}"
                    class="${e2.classNames.tag} ${t2.class || ""}"
                    ${this.getAttributes(t2)}>
            <x title='' tabIndex="${e2.a11y.focusableTags ? 0 : -1}" class="${e2.classNames.tagX}" role='button' aria-label='remove tag'></x>
            <div>
                <span ${"select" === e2.mode && e2.userInput ? "contenteditable='true'" : ""} autocapitalize="false" autocorrect="off" spellcheck='false' class="${e2.classNames.tagText}">${t2[e2.tagTextProp] || t2.value}</span>
            </div>
        </tag>`;
}, dropdown(t2) {
  var e2 = t2.dropdown;
  return `<div class="${"manual" == e2.position ? "" : t2.classNames.dropdown} ${e2.classname}" role="listbox" aria-labelledby="dropdown" dir="${e2.RTL ? "rtl" : ""}">
                    <div data-selector='tagify-suggestions-wrapper' class="${t2.classNames.dropdownWrapper}"></div>
                </div>`;
}, dropdownContent(t2) {
  var e2 = this.settings.templates, s2 = this.state.dropdown.suggestions;
  return `
            ${e2.dropdownHeader.call(this, s2)}
            ${t2}
            ${e2.dropdownFooter.call(this, s2)}
        `;
}, dropdownItem(t2) {
  return `<div ${this.getAttributes(t2)}
                    class='${this.settings.classNames.dropdownItem} ${this.isTagDuplicate(t2.value) ? this.settings.classNames.dropdownItemSelected : ""} ${t2.class || ""}'
                    tabindex="0"
                    role="option">${t2.mappedValue || t2.value}</div>`;
}, dropdownHeader(t2) {
  return `<header data-selector='tagify-suggestions-header' class="${this.settings.classNames.dropdownHeader}"></header>`;
}, dropdownFooter(t2) {
  var e2 = t2.length - this.settings.dropdown.maxItems;
  return e2 > 0 ? `<footer data-selector='tagify-suggestions-footer' class="${this.settings.classNames.dropdownFooter}">
                ${e2} more items. Refine your search.
            </footer>` : "";
}, dropdownItemNoMatch: null };
var E2 = { customBinding() {
  this.customEventsList.forEach(((t2) => {
    this.on(t2, this.settings.callbacks[t2]);
  }));
}, binding(t2 = true) {
  var e2, s2 = this.settings, i2 = this.events.callbacks, a3 = t2 ? "addEventListener" : "removeEventListener";
  if (!(this.state.mainEvents && t2 || s2.disabled || s2.readonly)) {
    for (var n2 in this.state.mainEvents = t2, t2 && !this.listeners.main && (this.events.bindGlobal.call(this), this.settings.isJQueryPlugin && jQuery(this.DOM.originalInput).on("tagify.removeAllTags", this.removeAllTags.bind(this))), e2 = this.listeners.main = this.listeners.main || { keydown: ["input", i2.onKeydown.bind(this)], click: ["scope", i2.onClickScope.bind(this)], dblclick: "select" != s2.mode && ["scope", i2.onDoubleClickScope.bind(this)], paste: ["input", i2.onPaste.bind(this)], drop: ["input", i2.onDrop.bind(this)], compositionstart: ["input", i2.onCompositionStart.bind(this)], compositionend: ["input", i2.onCompositionEnd.bind(this)] }) e2[n2] && this.DOM[e2[n2][0]][a3](n2, e2[n2][1]);
    var o2 = this.listeners.main.inputMutationObserver || new MutationObserver(i2.onInputDOMChange.bind(this));
    o2.disconnect(), "mix" == s2.mode && o2.observe(this.DOM.input, { childList: true }), this.events.bindOriginaInputListener.call(this), t2 && (this.listeners.main = void 0);
  }
}, bindOriginaInputListener(t2) {
  const e2 = (t2 || 0) + 500;
  this.listeners.main && (clearInterval(this.listeners.main.originalInputValueObserverInterval), this.listeners.main.originalInputValueObserverInterval = setInterval(this.events.callbacks.observeOriginalInputValue.bind(this), e2));
}, bindGlobal(t2) {
  var e2, s2 = this.events.callbacks, i2 = t2 ? "removeEventListener" : "addEventListener";
  if (this.listeners && (t2 || !this.listeners.global)) {
    for (e2 of (this.listeners.global = this.listeners.global || [{ type: this.isIE ? "keydown" : "input", target: this.DOM.input, cb: s2[this.isIE ? "onInputIE" : "onInput"].bind(this) }, { type: "keydown", target: window, cb: s2.onWindowKeyDown.bind(this) }, { type: "focusin", target: this.DOM.scope, cb: s2.onFocusBlur.bind(this) }, { type: "focusout", target: this.DOM.scope, cb: s2.onFocusBlur.bind(this) }, { type: "click", target: document, cb: s2.onClickAnywhere.bind(this), useCapture: true }], this.listeners.global)) e2.target[i2](e2.type, e2.cb, !!e2.useCapture);
    t2 && (this.listeners.global = void 0);
  }
}, unbindGlobal() {
  this.events.bindGlobal.call(this, true);
}, callbacks: { onFocusBlur(t2) {
  var e2 = this.settings, s2 = m2.call(this, t2.relatedTarget), i2 = u.call(this, t2.target), a3 = t2.target.matches(e2.classNames.tagXSelector), n2 = "focusin" == t2.type, o2 = "focusout" == t2.type;
  a3 && "mix" != e2.mode && e2.focusInputOnRemove && this.DOM.input.focus(), s2 && n2 && !i2 && !a3 && this.toggleFocusClass(this.state.hasFocus = +/* @__PURE__ */ new Date());
  var r2 = t2.target ? this.trim(this.DOM.input.textContent) : "", l4 = this.value?.[0]?.[e2.tagTextProp], d4 = e2.dropdown.enabled >= 0, h3 = { relatedTarget: t2.relatedTarget }, g4 = this.state.actions.selectOption && (d4 || !e2.dropdown.closeOnSelect), c3 = this.state.actions.addNew && d4;
  if (o2) {
    if ("mix" != e2.mode) t2.relatedTarget && this.DOM.dropdown?.contains(t2.relatedTarget) || this.repositionScopeInput("reset", { focus: false });
    if (t2.relatedTarget === this.DOM.scope) return this.dropdown.hide(), void this.DOM.input.focus();
    this.postUpdate(), e2.onChangeAfterBlur && this.triggerChangeEvent();
  }
  if (!(g4 || c3 || a3)) if (this.state.hasFocus = !(!n2 && !s2) && +/* @__PURE__ */ new Date(), this.toggleFocusClass(this.state.hasFocus), "mix" != e2.mode) {
    if (n2) {
      if (!e2.focusable) return;
      var p3 = 0 === e2.dropdown.enabled && !this.state.dropdown.visible, v3 = this.DOM.scope.querySelector(this.settings.classNames.tagTextSelector);
      return this.trigger("focus", h3), void (p3 && !i2 && (this.dropdown.show(this.value.length ? "" : void 0), "select" === e2.mode && this.setRangeAtStartEnd(false, v3)));
    }
    if (o2) {
      if (this.trigger("blur", h3), this.loading(false), "select" == e2.mode) {
        if (this.value.length) {
          let t3 = this.getTagElms()[0];
          r2 = this.trim(t3.textContent);
        }
        l4 === r2 && (r2 = "");
      }
      r2 && !this.state.actions.selectOption && e2.addTagOnBlur && e2.addTagOn.includes("blur") && this.addTags(r2, true);
    }
    s2 || (this.DOM.input.removeAttribute("style"), this.dropdown.hide());
  } else n2 ? this.trigger("focus", h3) : o2 && (this.trigger("blur", h3), this.loading(false), this.dropdown.hide(), this.state.dropdown.visible = void 0, this.setStateSelection());
}, onCompositionStart(t2) {
  this.state.composing = true;
}, onCompositionEnd(t2) {
  this.state.composing = false;
}, onWindowKeyDown(t2) {
  var e2, s2 = this.settings, i2 = document.activeElement, a3 = m2.call(this, i2) && this.DOM.scope.contains(i2), n2 = i2 === this.DOM.input, o2 = a3 && i2.hasAttribute("readonly"), r2 = this.DOM.scope.querySelector(this.settings.classNames.tagTextSelector), l4 = this.state.dropdown.visible;
  if (("Tab" === t2.key && l4 || this.state.hasFocus || a3 && !o2) && !n2) {
    e2 = i2.nextElementSibling;
    var d4 = t2.target.matches(s2.classNames.tagXSelector);
    switch (t2.key) {
      case "Backspace":
        s2.readonly || this.state.editing || (this.removeTags(i2), (e2 || this.DOM.input).focus());
        break;
      case "Enter":
        if (d4) return void this.removeTags(t2.target.parentNode);
        s2.a11y.focusableTags && u.call(this, i2) && setTimeout(this.editTag.bind(this), 0, i2);
        break;
      case "ArrowDown":
        this.state.dropdown.visible || "mix" == s2.mode || this.dropdown.show();
        break;
      case "Tab":
        r2?.focus();
    }
  }
}, onKeydown(t2) {
  var e2 = this.settings;
  if (!this.state.composing && e2.userInput) {
    "select" == e2.mode && e2.enforceWhitelist && this.value.length && "Tab" != t2.key && t2.preventDefault();
    var s2 = this.trim(t2.target.textContent);
    this.trigger("keydown", { event: t2 }), e2.hooks.beforeKeyDown(t2, { tagify: this }).then(((i2) => {
      if ("mix" == e2.mode) {
        switch (t2.key) {
          case "Left":
          case "ArrowLeft":
            this.state.actions.ArrowLeft = true;
            break;
          case "Delete":
          case "Backspace":
            if (this.state.editing) return;
            var a3 = document.getSelection(), n2 = "Delete" == t2.key && a3.anchorOffset == (a3.anchorNode.length || 0), r2 = a3.anchorNode.previousSibling, l4 = 1 == a3.anchorNode.nodeType || !a3.anchorOffset && r2 && 1 == r2.nodeType && a3.anchorNode.previousSibling;
            !(function(t3) {
              var e3 = document.createElement("div");
              t3.replace(/\&#?[0-9a-z]+;/gi, (function(t4) {
                return e3.innerHTML = t4, e3.innerText;
              }));
            })(this.DOM.input.innerHTML);
            var d4, h3, g4, p3 = this.getTagElms(), u2 = 1 === a3.anchorNode.length && a3.anchorNode.nodeValue == String.fromCharCode(8203);
            if ("edit" == e2.backspace && l4) return d4 = 1 == a3.anchorNode.nodeType ? null : a3.anchorNode.previousElementSibling, setTimeout(this.editTag.bind(this), 0, d4), void t2.preventDefault();
            if (c2() && l4 instanceof Element) return g4 = o(l4), l4.hasAttribute("readonly") || l4.remove(), this.DOM.input.focus(), void setTimeout((() => {
              w2(g4), this.DOM.input.click();
            }));
            if ("BR" == a3.anchorNode.nodeName) return;
            if ((n2 || l4) && 1 == a3.anchorNode.nodeType ? h3 = 0 == a3.anchorOffset ? n2 ? p3[0] : null : p3[Math.min(p3.length, a3.anchorOffset) - 1] : n2 ? h3 = a3.anchorNode.nextElementSibling : l4 instanceof Element && (h3 = l4), 3 == a3.anchorNode.nodeType && !a3.anchorNode.nodeValue && a3.anchorNode.previousElementSibling && t2.preventDefault(), (l4 || n2) && !e2.backspace) return void t2.preventDefault();
            if ("Range" != a3.type && !a3.anchorOffset && a3.anchorNode == this.DOM.input && "Delete" != t2.key) return void t2.preventDefault();
            if ("Range" != a3.type && h3 && h3.hasAttribute("readonly")) return void w2(o(h3));
            "Delete" == t2.key && u2 && T(a3.anchorNode.nextSibling) && this.removeTags(a3.anchorNode.nextSibling);
            break;
          case "Enter": {
            if (t2.preventDefault(), this.state.tag) return;
            let e3 = window.getSelection();
            e3.getRangeAt(0).insertNode(document.createElement("br")), e3.collapseToEnd();
          }
        }
        return true;
      }
      var m4 = "manual" == e2.dropdown.position;
      switch (t2.key) {
        case "Backspace":
          var v3 = this.getTagElmBeforeInput();
          "select" == e2.mode && e2.enforceWhitelist && this.value.length ? v3 && this.removeTags(v3) : this.state.dropdown.visible && "manual" != e2.dropdown.position || "" != t2.target.textContent && 8203 != s2.charCodeAt(0) || (true === e2.backspace ? v3 && this.removeTags(v3) : "edit" == e2.backspace && v3 && setTimeout((() => this.editTag(v3)), 0));
          break;
        case "Esc":
        case "Escape":
          if (this.state.dropdown.visible) return;
          t2.target.blur();
          break;
        case "Down":
        case "ArrowDown":
          this.state.dropdown.visible || this.dropdown.show();
          break;
        case "ArrowLeft":
          this.repositionScopeInput("left") && t2.preventDefault();
          break;
        case "ArrowRight": {
          if (this.repositionScopeInput("right")) {
            t2.preventDefault();
            break;
          }
          let s3 = this.state.inputSuggestion || this.state.ddItemData;
          if (s3 && e2.autoComplete.rightKey) return void this.addTags([s3], true);
          break;
        }
        case "Tab":
          if (!e2.addTagOn.includes(t2.key.toLowerCase())) break;
        case "Enter":
          if (this.state.dropdown.visible && !m4) return;
          var f3 = this.state.autoCompleteData || s2;
          if (!f3 && "Tab" === t2.key) return true;
          t2.preventDefault(), setTimeout((() => {
            this.state.dropdown.visible && !m4 || this.state.actions.selectOption || !e2.addTagOn.includes(t2.key.toLowerCase()) || (this.addTags([f3], true), this.state.autoCompleteData = null);
          }));
      }
    })).catch(((t3) => t3));
  }
}, onInput(t2) {
  this.postUpdate();
  var e2 = this.settings;
  if ("mix" == e2.mode) return this.events.callbacks.onMixTagsInput.call(this, t2);
  var s2 = this.input.normalize.call(this, void 0, { trim: false }), i2 = s2.length >= e2.dropdown.enabled, a3 = { value: s2, inputElm: this.DOM.input }, n2 = this.validateTag({ value: s2 });
  "select" == e2.mode && this.toggleScopeValidation(n2), a3.isValid = n2, this.state.inputText != s2 && (this.input.set.call(this, s2, false), -1 != s2.search(e2.delimiters) ? this.addTags(s2) && this.input.set.call(this) : e2.dropdown.enabled >= 0 && this.dropdown[i2 ? "show" : "hide"](s2), this.trigger("input", a3));
}, onMixTagsInput(t2) {
  var e2, s2, i2, a3, n2, o2, r2, l4, h3 = this.settings, g4 = this.value.length, p3 = this.getTagElms(), u2 = document.createDocumentFragment(), m4 = (l4 = window.getSelection()).rangeCount ? l4.getRangeAt(0) : null, v3 = [].map.call(p3, ((t3) => T(t3).value));
  if ("deleteContentBackward" == t2.inputType && c2() && this.events.callbacks.onKeydown.call(this, { target: t2.target, key: "Backspace" }), b2(this.getTagElms()), this.value.slice().forEach(((t3) => {
    t3.readonly && !v3.includes(t3.value) && u2.appendChild(this.createTagElem(t3));
  })), u2.childNodes.length && m4 && (m4.insertNode(u2), this.setRangeAtStartEnd(false, u2.lastChild)), p3.length != g4) return this.value = [].map.call(this.getTagElms(), ((t3) => T(t3))), void this.update({ withoutChangeEvent: true });
  if (this.hasMaxTags()) return true;
  if (window.getSelection && (l4 = window.getSelection()).rangeCount > 0 && 3 == l4.anchorNode.nodeType) {
    if ((m4 = l4.getRangeAt(0).cloneRange()).collapse(true), m4.setStart(l4.focusNode, 0), i2 = (e2 = m4.toString().slice(0, m4.endOffset)).split(h3.pattern).length - 1, (s2 = e2.match(h3.pattern)) && (a3 = e2.slice(e2.lastIndexOf(s2[s2.length - 1]))), a3) {
      if (this.state.actions.ArrowLeft = false, this.state.tag = { prefix: a3.match(h3.pattern)[0], value: a3.replace(h3.pattern, "") }, this.state.tag.baseOffset = l4.baseOffset - this.state.tag.value.length, r2 = this.state.tag.value.match(h3.delimiters)) return this.state.tag.value = this.state.tag.value.replace(h3.delimiters, ""), this.state.tag.delimiters = r2[0], this.addTags(this.state.tag.value, h3.dropdown.clearOnSelect), void this.dropdown.hide();
      n2 = this.state.tag.value.length >= h3.dropdown.enabled;
      try {
        o2 = (o2 = this.state.flaggedTags[this.state.tag.baseOffset]).prefix == this.state.tag.prefix && o2.value[0] == this.state.tag.value[0], this.state.flaggedTags[this.state.tag.baseOffset] && !this.state.tag.value && delete this.state.flaggedTags[this.state.tag.baseOffset];
      } catch (t3) {
      }
      (o2 || i2 < this.state.mixMode.matchedPatternCount) && (n2 = false);
    } else this.state.flaggedTags = {};
    this.state.mixMode.matchedPatternCount = i2;
  }
  setTimeout((() => {
    this.update({ withoutChangeEvent: true }), this.trigger("input", d2({}, this.state.tag, { textContent: this.DOM.input.textContent })), this.state.tag && this.dropdown[n2 ? "show" : "hide"](this.state.tag.value);
  }), 10);
}, onInputIE(t2) {
  var e2 = this;
  setTimeout((function() {
    e2.events.callbacks.onInput.call(e2, t2);
  }));
}, observeOriginalInputValue() {
  this.DOM.originalInput.parentNode || this.destroy(), this.DOM.originalInput.value != this.DOM.originalInput.tagifyValue && this.loadOriginalValues();
}, onClickAnywhere(t2) {
  if (t2.target != this.DOM.scope && !this.DOM.scope.contains(t2.target)) {
    this.toggleFocusClass(false), this.state.hasFocus = false;
    let e2 = t2.target.closest(this.settings.classNames.dropdownSelector);
    e2?.__tagify != this && this.dropdown.hide();
  }
}, onClickScope(t2) {
  var e2 = this.settings, s2 = t2.target.closest("." + e2.classNames.tag);
  t2.target, this.DOM.scope;
  var i2 = +/* @__PURE__ */ new Date() - this.state.hasFocus;
  if (!t2.target.matches(e2.classNames.tagXSelector)) return s2 && !this.state.editing ? (this.trigger("click", { tag: s2, index: this.getNodeIndex(s2), data: T(s2), event: t2 }), void (1 !== e2.editTags && 1 !== e2.editTags.clicks && "select" != e2.mode || this.events.callbacks.onDoubleClickScope.call(this, t2))) : void (t2.target == this.DOM.input && ("mix" == e2.mode && this.fixFirefoxLastTagNoCaret(), i2 > 500 || !e2.focusable) ? this.state.dropdown.visible ? this.dropdown.hide() : 0 === e2.dropdown.enabled && "mix" != e2.mode && this.dropdown.show(this.value.length ? "" : void 0) : "select" != e2.mode || 0 !== e2.dropdown.enabled || this.state.dropdown.visible || (this.events.callbacks.onDoubleClickScope.call(this, { ...t2, target: this.getTagElms()[0] }), !e2.userInput && this.dropdown.show()));
  this.removeTags(t2.target.parentNode);
}, onPaste(t2) {
  t2.preventDefault();
  var e2, s2, i2, a3 = this.settings;
  if (!a3.userInput) return false;
  a3.readonly || (s2 = t2.clipboardData || window.clipboardData, i2 = s2.getData("Text"), a3.hooks.beforePaste(t2, { tagify: this, pastedText: i2, clipboardData: s2 }).then(((a4) => {
    if (void 0 === a4 && (a4 = i2), a4) if ("mix" == this.settings.mode) {
      if (this.settings.pasteAsTags) {
        const t3 = this.convertPastedTextToMixTags(a4), e3 = this.parseMixTags(t3, { skipDOM: true }), s3 = e3.__tagifyTagsData || [];
        this.injectAtCaret(e3, window.getSelection().getRangeAt(0)), s3.forEach(((t4) => this.value.push(t4)));
        const i3 = this.getTagElms().slice(-s3.length);
        i3.forEach(((t4, e4) => T(t4, s3[e4]))), this.update(), b2(i3);
      } else this.injectAtCaret(a4, window.getSelection().getRangeAt(0));
      this.events.callbacks.onMixTagsInput.call(this, t2);
    } else this.injectAtCaret(a4, window.getSelection().getRangeAt(0)), this.settings.pasteAsTags ? e2 = this.addTags(this.state.inputText + a4, true) : (this.state.inputText = a4, this.dropdown.show(a4));
    this.trigger("paste", { event: t2, pastedText: i2, clipboardData: s2, tagsElems: e2 });
  })).catch(((t3) => t3)));
}, onDrop(t2) {
  t2.preventDefault();
}, onEditTagInput(t2, e2) {
  var s2 = t2.closest("." + this.settings.classNames.tag), i2 = this.getNodeIndex(s2), a3 = T(s2), n2 = this.input.normalize.call(this, t2), o2 = { [this.settings.tagTextProp]: n2, __tagId: a3.__tagId }, r2 = this.validateTag(o2);
  this.editTagChangeDetected(d2(a3, o2)) || true !== t2.originalIsValid || (r2 = true), s2.classList.toggle(this.settings.classNames.tagInvalid, true !== r2), a3.__isValid = r2, s2.title = true === r2 ? a3.title || a3.value : r2, n2.length >= this.settings.dropdown.enabled && (this.state.editing && (this.state.editing.value = n2), this.dropdown.show(n2)), this.trigger("edit:input", { tag: s2, index: i2, data: d2({}, this.value[i2], { newValue: n2 }), event: e2 });
}, onEditTagPaste(t2, e2) {
  var s2 = (e2.clipboardData || window.clipboardData).getData("Text");
  e2.preventDefault();
  var i2 = f2(s2);
  this.setRangeAtStartEnd(false, i2);
}, onEditTagClick(t2, e2) {
  this.events.callbacks.onClickScope.call(this, e2);
}, onEditTagFocus(t2) {
  this.state.editing = { scope: t2, input: t2.querySelector("[contenteditable]") };
}, onEditTagBlur(t2, e2) {
  var s2 = u.call(this, e2.relatedTarget);
  if ("select" == this.settings.mode && s2 && e2.relatedTarget.contains(e2.target)) this.dropdown.hide();
  else if (this.state.editing && (this.state.hasFocus || this.toggleFocusClass(), this.DOM.scope.contains(document.activeElement) || this.trigger("blur", {}), this.DOM.scope.contains(t2))) {
    var i2, a3, n2 = this.settings, o2 = t2.closest("." + n2.classNames.tag), r2 = T(o2), l4 = this.input.normalize.call(this, t2), h3 = { [n2.tagTextProp]: l4, __tagId: r2.__tagId }, g4 = r2.__originalData, c3 = this.editTagChangeDetected(d2(r2, h3)), p3 = this.validateTag(h3);
    if (l4) if (c3) {
      if (i2 = this.hasMaxTags(), a3 = d2({}, g4, { [n2.tagTextProp]: this.trim(l4), __isValid: p3 }), n2.transformTag.call(this, a3, g4), true !== (p3 = (!i2 || true === g4.__isValid) && this.validateTag(a3))) {
        if (this.trigger("invalid", { data: a3, tag: o2, message: p3 }), n2.editTags.keepInvalid) return;
        n2.keepInvalidTags ? a3.__isValid = p3 : a3 = g4;
      } else n2.keepInvalidTags && (delete a3.title, delete a3["aria-invalid"], delete a3.class);
      this.onEditTagDone(o2, a3);
    } else this.onEditTagDone(o2, g4);
    else this.onEditTagDone(o2);
  }
}, onEditTagkeydown(t2, e2) {
  if (!this.state.composing) switch (this.trigger("edit:keydown", { event: t2 }), t2.key) {
    case "Esc":
    case "Escape":
      this.state.editing = false, !!e2.__tagifyTagData.__originalData.value ? e2.parentNode.replaceChild(e2.__tagifyTagData.__originalHTML, e2) : e2.remove();
      break;
    case "Enter":
    case "Tab":
      t2.preventDefault();
      setTimeout((() => t2.target.blur()), 0);
  }
}, onDoubleClickScope(t2) {
  var e2 = t2.target.closest("." + this.settings.classNames.tag);
  if (e2) {
    var s2, i2, a3 = T(e2), n2 = this.settings;
    false !== a3?.editable && (s2 = e2.classList.contains(this.settings.classNames.tagEditing), i2 = e2.hasAttribute("readonly"), n2.readonly || s2 || i2 || !this.settings.editTags || !n2.userInput || (this.events.callbacks.onEditTagFocus.call(this, e2), this.editTag(e2)), this.toggleFocusClass(true), "select" != n2.mode && this.trigger("dblclick", { tag: e2, index: this.getNodeIndex(e2), data: T(e2) }));
  }
}, onInputDOMChange(t2) {
  var e2 = this.DOM.input.lastChild;
  t2.forEach(((t3) => {
    t3.addedNodes.forEach(((t4) => {
      if ("<div><br></div>" == t4.outerHTML) t4.replaceWith(document.createElement("br"));
      else if (1 == t4.nodeType && t4.querySelector(this.settings.classNames.tagSelector)) {
        let e3 = document.createTextNode("");
        3 == t4.childNodes[0].nodeType && "BR" != t4.previousSibling.nodeName && (e3 = document.createTextNode("\n")), t4.replaceWith(e3, ...[...t4.childNodes].slice(0, -1)), w2(e3);
      } else if (u.call(this, t4)) if (3 != t4.previousSibling?.nodeType || t4.previousSibling.textContent || t4.previousSibling.remove(), t4.previousSibling && "BR" == t4.previousSibling.nodeName) {
        t4.previousSibling.replaceWith("\n\u200B");
        let e3 = t4.nextSibling, s2 = "";
        for (; e3; ) s2 += e3.textContent, e3 = e3.nextSibling;
        s2.trim() && w2(t4.previousSibling);
      } else t4.previousSibling && !T(t4.previousSibling) || t4.before("\u200B");
    })), t3.removedNodes.forEach(((t4) => {
      t4 && "BR" == t4.nodeName && u.call(this, e2) && (this.removeTags(e2), this.fixFirefoxLastTagNoCaret());
    }));
  })), e2 && "" == e2.nodeValue && e2.remove(), e2 && "BR" == e2.nodeName || this.DOM.input.appendChild(document.createElement("br"));
} } };
function N(t2, s2) {
  if (!t2) {
    e.warn("input element not found", t2);
    const s3 = new Proxy(this, { get: () => () => s3 });
    return s3;
  }
  if (t2.__tagify) return e.warn("input element is already Tagified - Same instance is returned.", t2), t2.__tagify;
  var i2;
  d2(this, (function(t3) {
    var s3 = document.createTextNode(""), i3 = {};
    function a3(t4, e2, i4) {
      i4 && e2.split(/\s+/g).forEach(((e3) => s3[t4 + "EventListener"].call(s3, e3, i4)));
    }
    return { removeAllCustomListeners() {
      Object.entries(i3).forEach((([t4, e2]) => {
        e2.forEach(((e3) => a3("remove", t4, e3)));
      })), i3 = {};
    }, off(t4, e2) {
      return t4 && (e2 ? a3("remove", t4, e2) : t4.split(/\s+/g).forEach(((t5) => {
        i3[t5]?.forEach(((e3) => a3("remove", t5, e3))), delete i3[t5];
      }))), this;
    }, on(t4, e2) {
      return e2 && "function" == typeof e2 && (t4.split(/\s+/g).forEach(((t5) => {
        Array.isArray(i3[t5]) ? i3[t5].push(e2) : i3[t5] = [e2];
      })), a3("add", t4, e2)), this;
    }, trigger(i4, a4, n2) {
      var o2;
      if (n2 = n2 || { cloneData: true }, i4) if (t3.settings.isJQueryPlugin) "remove" == i4 && (i4 = "removeTag"), jQuery(t3.DOM.originalInput).triggerHandler(i4, [a4]);
      else {
        try {
          var r2 = "object" == typeof a4 ? a4 : { value: a4 };
          if ((r2 = n2.cloneData ? d2({}, r2) : r2).tagify = this, a4.event && (r2.event = this.cloneEvent(a4.event)), a4 instanceof Object) for (var l4 in a4) a4[l4] instanceof HTMLElement && (r2[l4] = a4[l4]);
          o2 = new CustomEvent(i4, { detail: r2 });
        } catch (t4) {
          e.warn(t4);
        }
        s3.dispatchEvent(o2);
      }
    } };
  })(this)), this.isFirefox = /firefox|fxios/i.test(navigator.userAgent) && !/seamonkey/i.test(navigator.userAgent), this.isIE = window.document.documentMode, s2 = s2 || {}, this.getPersistedData = (i2 = s2.id, (t3) => {
    if (!i2) return;
    let e2, s3 = "/" + t3, a3 = localStorage?.getItem(O2 + i2 + "/v");
    if (1 === a3) try {
      e2 = JSON.parse(localStorage[O2 + i2 + s3]);
    } catch (t4) {
    }
    return e2;
  }), this.setPersistedData = ((t3) => t3 ? (localStorage?.setItem(O2 + t3 + "/v", 1), (e2, s3) => {
    let i3 = "/" + s3, a3 = JSON.stringify(e2);
    e2 && s3 && (localStorage?.setItem(O2 + t3 + i3, a3), dispatchEvent(new Event("storage")));
  }) : () => {
  })(s2.id), this.clearPersistedData = /* @__PURE__ */ ((t3) => (e2) => {
    const s3 = O2 + "/" + t3 + "/";
    if (e2) localStorage.removeItem(s3 + e2);
    else for (let t4 in localStorage) t4.includes(s3) && localStorage.removeItem(t4);
  })(s2.id), this.applySettings(t2, s2), this.state = { inputText: "", editing: false, composing: false, actions: {}, mixMode: {}, dropdown: {}, flaggedTags: {} }, this.value = [], this.listeners = {}, this.DOM = {}, this.build(t2), x.call(this), this.getCSSVars(), this.loadOriginalValues(), this.events.customBinding.call(this), this.events.binding.call(this), t2.autofocus && this.DOM.input.focus(), t2.__tagify = this;
}
N.prototype = { _dropdown: D2, placeCaretAfterNode: w2, getSetTagData: T, helpers: { sameStr: s, removeCollectionProp: i, omit: a2, isObject: l, parseHTML: n, escapeHTML: r, extend: d2, concatWithoutDups: h2, getUID: p2, isNodeTag: u }, customEventsList: ["change", "add", "remove", "invalid", "input", "paste", "click", "keydown", "focus", "blur", "edit:input", "edit:beforeUpdate", "edit:updated", "edit:start", "edit:keydown", "dropdown:show", "dropdown:hide", "dropdown:select", "dropdown:updated", "dropdown:noMatch", "dropdown:scroll"], dataProps: ["__isValid", "__removed", "__originalData", "__originalHTML", "__tagId"], trim(t2) {
  return this.settings.trim && t2 && "string" == typeof t2 ? t2.trim() : t2;
}, parseHTML: n, templates: M, parseTemplate(t2, e2) {
  return n((t2 = this.settings.templates[t2] || t2).apply(this, e2));
}, set whitelist(t2) {
  const e2 = t2 && Array.isArray(t2);
  this.settings.whitelist = e2 ? t2 : [], this.setPersistedData(e2 ? t2 : [], "whitelist");
}, get whitelist() {
  return this.settings.whitelist;
}, set userInput(t2) {
  this.settings.userInput = !!t2, this.setContentEditable(!!t2);
}, get userInput() {
  return this.settings.userInput;
}, generateClassSelectors(t2) {
  for (let e2 in t2) {
    let s2 = e2;
    Object.defineProperty(t2, s2 + "Selector", { get() {
      return "." + this[s2].split(" ")[0];
    } });
  }
}, applySettings(t2, e2) {
  y2.templates = this.templates;
  var s2 = d2({}, y2, "mix" == e2.mode ? { pasteAsTags: false, dropdown: { position: "text" } } : {});
  this.origSettings = d2({}, e2);
  var i2 = this.settings = d2({}, s2, e2);
  if (i2.disabled = t2.hasAttribute("disabled"), i2.readonly = i2.readonly || t2.hasAttribute("readonly"), i2.placeholder = r(t2.getAttribute("placeholder") || i2.placeholder || ""), i2.required = t2.hasAttribute("required"), this.generateClassSelectors(i2.classNames), this.isIE && (i2.autoComplete = false), ["whitelist", "blacklist"].forEach(((e3) => {
    var s3 = t2.getAttribute("data-" + e3);
    s3 && (s3 = s3.split(i2.delimiters)) instanceof Array && (i2[e3] = s3);
  })), "autoComplete" in e2 && !l(e2.autoComplete) && (i2.autoComplete = y2.autoComplete, i2.autoComplete.enabled = e2.autoComplete), "mix" == i2.mode && (i2.pattern = i2.pattern || /@/, i2.autoComplete.rightKey = true, i2.delimiters = e2.delimiters || null, i2.tagTextProp && !i2.dropdown.searchKeys.includes(i2.tagTextProp) && i2.dropdown.searchKeys.push(i2.tagTextProp)), t2.pattern) try {
    i2.pattern = new RegExp(t2.pattern);
  } catch (t3) {
  }
  if (i2.delimiters) {
    i2._delimiters = i2.delimiters;
    try {
      i2.delimiters = new RegExp(this.settings.delimiters, "g");
    } catch (t3) {
    }
  }
  (i2.disabled || i2.readonly) && (i2.userInput = false), this.TEXTS = { ...I2, ...i2.texts || {} }, "select" == i2.mode && (i2.dropdown.includeSelectedTags = true), ("select" != i2.mode || e2.dropdown?.enabled) && i2.userInput || (i2.dropdown.enabled = 0), i2.disabled && (i2.dropdown.enabled = false), i2.dropdown.appendTarget = e2.dropdown?.appendTarget || document.body, void 0 === i2.dropdown.includeSelectedTags && (i2.dropdown.includeSelectedTags = i2.duplicates);
  let a3 = this.getPersistedData("whitelist");
  Array.isArray(a3) && (this.whitelist = Array.isArray(i2.whitelist) ? h2(i2.whitelist, a3) : a3);
}, getAttributes(t2) {
  var e2, s2 = this.getCustomAttributes(t2), i2 = "";
  for (e2 in s2) i2 += " " + e2 + (void 0 !== t2[e2] ? `="${s2[e2]}"` : "");
  return i2;
}, getCustomAttributes(t2) {
  if (!l(t2)) return "";
  var e2, s2 = {};
  for (e2 in t2) "__" != e2.slice(0, 2) && "class" != e2 && t2.hasOwnProperty(e2) && void 0 !== t2[e2] && (s2[e2] = r(t2[e2]));
  return s2;
}, setStateSelection() {
  var t2 = window.getSelection(), e2 = { anchorOffset: t2.anchorOffset, anchorNode: t2.anchorNode, range: t2.getRangeAt && t2.rangeCount && t2.getRangeAt(0) };
  return this.state.selection = e2, e2;
}, getCSSVars() {
  var t2 = getComputedStyle(this.DOM.scope, null);
  var e2;
  this.CSSVars = { tagHideTransition: (({ value: t3, unit: e3 }) => "s" == e3 ? 1e3 * t3 : t3)((function(t3) {
    if (!t3) return {};
    var e3 = (t3 = t3.trim().split(" ")[0]).split(/\d+/g).filter(((t4) => t4)).pop().trim();
    return { value: +t3.split(e3).filter(((t4) => t4))[0].trim(), unit: e3 };
  })((e2 = "tag-hide-transition", t2.getPropertyValue("--" + e2)))) };
}, build(t2) {
  var e2 = this.DOM, s2 = t2.closest("label");
  this.settings.mixMode.integrated ? (e2.originalInput = null, e2.scope = t2, e2.input = t2) : (e2.originalInput = t2, e2.originalInput_tabIndex = t2.tabIndex, e2.scope = this.parseTemplate("wrapper", [t2, this.settings]), e2.input = e2.scope.querySelector(this.settings.classNames.inputSelector), t2.parentNode.insertBefore(e2.scope, t2), t2.tabIndex = -1), s2 && s2.setAttribute("for", "");
}, destroy() {
  this.events.unbindGlobal.call(this), this.DOM.scope.parentNode?.removeChild(this.DOM.scope), this.DOM.originalInput.tabIndex = this.DOM.originalInput_tabIndex, delete this.DOM.originalInput.__tagify, this.dropdown.hide(true), this.removeAllCustomListeners(), clearTimeout(this.dropdownHide__bindEventsTimeout), clearInterval(this.listeners?.main?.originalInputValueObserverInterval);
}, loadOriginalValues(t2) {
  var e2, s2 = this.settings;
  if (this.state.blockChangeEvent = true, void 0 === t2) {
    const e3 = this.getPersistedData("value");
    t2 = e3 && !this.DOM.originalInput.value ? e3 : s2.mixMode.integrated ? this.DOM.input.textContent : this.DOM.originalInput.value;
  }
  if (this.removeAllTags(), t2) if ("mix" == s2.mode) this.parseMixTags(t2), (e2 = this.DOM.input.lastChild) && "BR" == e2.tagName || this.DOM.input.insertAdjacentHTML("beforeend", "<br>");
  else {
    try {
      JSON.parse(t2) instanceof Array && (t2 = JSON.parse(t2));
    } catch (t3) {
    }
    this.addTags(t2, true).forEach(((t3) => t3 && t3.classList.add(s2.classNames.tagNoAnimation)));
  }
  else this.postUpdate();
  this.state.lastOriginalValueReported = s2.mixMode.integrated ? "" : this.DOM.originalInput.value;
}, cloneEvent(t2) {
  var e2 = {};
  for (var s2 in t2) "path" != s2 && (e2[s2] = t2[s2]);
  return e2;
}, loading(t2) {
  return this.state.isLoading = t2, this.DOM.scope.classList[t2 ? "add" : "remove"](this.settings.classNames.scopeLoading), this;
}, tagLoading(t2, e2) {
  return t2 && t2.classList[e2 ? "add" : "remove"](this.settings.classNames.tagLoading), this;
}, toggleClass(t2, e2) {
  "string" == typeof t2 && this.DOM.scope.classList.toggle(t2, e2);
}, toggleScopeValidation(t2) {
  var e2 = true === t2 || void 0 === t2;
  !this.settings.required && t2 && t2 === this.TEXTS.empty && (e2 = true), this.toggleClass(this.settings.classNames.tagInvalid, !e2), this.DOM.scope.title = e2 ? "" : t2;
}, toggleFocusClass(t2) {
  this.toggleClass(this.settings.classNames.focus, !!t2);
}, setPlaceholder(t2) {
  ["data", "aria"].forEach(((e2) => this.DOM.input.setAttribute(`${e2}-placeholder`, t2)));
}, triggerChangeEvent: function() {
  if (!this.settings.mixMode.integrated) {
    var t2 = this.DOM.originalInput, e2 = this.state.lastOriginalValueReported !== t2.value, s2 = new CustomEvent("change", { bubbles: true });
    e2 && (this.state.lastOriginalValueReported = t2.value, s2.simulated = true, t2._valueTracker && t2._valueTracker.setValue(Math.random()), t2.dispatchEvent(s2), this.trigger("change", this.state.lastOriginalValueReported), t2.value = this.state.lastOriginalValueReported);
  }
}, events: E2, fixFirefoxLastTagNoCaret() {
}, setRangeAtStartEnd(t2, e2) {
  if (e2) {
    t2 = "number" == typeof t2 ? t2 : !!t2, e2 = e2.lastChild || e2;
    var s2 = document.getSelection();
    if (s2.focusNode instanceof Element && !this.DOM.input.contains(s2.focusNode)) return true;
    try {
      s2.rangeCount >= 1 && ["Start", "End"].forEach(((i2) => s2.getRangeAt(0)["set" + i2](e2, t2 || e2.length)));
    } catch (t3) {
      console.warn(t3);
    }
  }
}, insertAfterTag(t2, e2) {
  if (e2 = e2 || this.settings.mixMode.insertAfterTag, t2 && t2.parentNode && e2) return e2 = "string" == typeof e2 ? document.createTextNode(e2) : e2, t2.parentNode.insertBefore(e2, t2.nextSibling), e2;
}, editTagChangeDetected(t2) {
  var e2 = t2.__originalData;
  for (var s2 in e2) if (!this.dataProps.includes(s2) && t2[s2] != e2[s2]) return true;
  return false;
}, getTagTextNode(t2) {
  return t2.querySelector(this.settings.classNames.tagTextSelector);
}, setTagTextNode(t2, e2) {
  this.getTagTextNode(t2).innerHTML = r(e2);
}, editTag(t2, s2) {
  t2 = t2 || this.getLastTag(), s2 = s2 || {};
  var i2 = this.settings, a3 = this.getTagTextNode(t2), n2 = this.getNodeIndex(t2), o2 = T(t2), r2 = this.events.callbacks, l4 = true, h3 = "select" == i2.mode;
  if (!h3 && this.dropdown.hide(), a3) {
    if (!(o2 instanceof Object && "editable" in o2) || o2.editable) return o2 = T(t2, { __originalData: d2({}, o2), __originalHTML: t2.cloneNode(true) }), T(o2.__originalHTML, o2.__originalData), a3.setAttribute("contenteditable", true), t2.classList.add(i2.classNames.tagEditing), this.events.callbacks.onEditTagFocus.call(this, t2), a3.addEventListener("click", r2.onEditTagClick.bind(this, t2)), a3.addEventListener("blur", r2.onEditTagBlur.bind(this, this.getTagTextNode(t2))), a3.addEventListener("input", r2.onEditTagInput.bind(this, a3)), a3.addEventListener("paste", r2.onEditTagPaste.bind(this, a3)), a3.addEventListener("keydown", ((e2) => r2.onEditTagkeydown.call(this, e2, t2))), a3.addEventListener("compositionstart", r2.onCompositionStart.bind(this)), a3.addEventListener("compositionend", r2.onCompositionEnd.bind(this)), s2.skipValidation || (l4 = this.editTagToggleValidity(t2)), a3.originalIsValid = l4, this.trigger("edit:start", { tag: t2, index: n2, data: o2, isValid: l4 }), a3.focus(), !h3 && this.setRangeAtStartEnd(false, a3), 0 === i2.dropdown.enabled && !h3 && this.dropdown.show(), this.state.hasFocus = true, this;
  } else e.warn("Cannot find element in Tag template: .", i2.classNames.tagTextSelector);
}, editTagToggleValidity(t2, s2) {
  var i2;
  if (s2 = s2 || T(t2)) return (i2 = !("__isValid" in s2) || true === s2.__isValid) || this.removeTagsFromValue(t2), this.update(), t2.classList.toggle(this.settings.classNames.tagNotAllowed, !i2), s2.__isValid = i2, s2.__isValid;
  e.warn("tag has no data: ", t2, s2);
}, onEditTagDone(t2, e2) {
  t2 = t2 || this.state.editing.scope, e2 = e2 || {};
  var s2, i2 = this.settings, a3 = { tag: t2, index: this.getNodeIndex(t2), previousData: T(t2), data: e2 };
  this.trigger("edit:beforeUpdate", a3, { cloneData: false }), this.state.editing = false, delete e2.__originalData, delete e2.__originalHTML, t2 && t2.parentNode && ((void 0 !== (s2 = e2[i2.tagTextProp]) ? (s2 += "", s2.trim?.()) : i2.tagTextProp in e2 ? void 0 : e2.value) ? (t2 = this.replaceTag(t2, e2), this.editTagToggleValidity(t2, e2), i2.a11y.focusableTags ? t2.focus() : "select" != i2.mode && w2(t2)) : this.removeTags(t2)), this.trigger("edit:updated", a3), i2.dropdown.closeOnSelect && this.dropdown.hide(), this.settings.keepInvalidTags && this.reCheckInvalidTags();
}, replaceTag(t2, e2) {
  e2 && "" !== e2.value && void 0 !== e2.value || (e2 = t2.__tagifyTagData), e2.__isValid && 1 != e2.__isValid && d2(e2, this.getInvalidTagAttrs(e2, e2.__isValid));
  var s2 = this.createTagElem(e2);
  return t2.parentNode.replaceChild(s2, t2), this.updateValueByDOMTags(), s2;
}, updateValueByDOMTags() {
  this.value.length = 0;
  var t2 = this.settings.classNames, e2 = [t2.tagNotAllowed.split(" ")[0], t2.tagHide];
  [].forEach.call(this.getTagElms(), ((t3) => {
    [...t3.classList].some(((t4) => e2.includes(t4))) || this.value.push(T(t3));
  })), this.update(), this.dropdown.refilter();
}, injectAtCaret(t2, e2) {
  if (e2 = e2 || this.state.selection?.range, "string" == typeof t2 && (t2 = document.createTextNode(t2)), !t2) return this;
  const s2 = 11 === t2.nodeType ? Array.prototype.slice.call(t2.childNodes) : [t2];
  if (!s2.length) return this;
  if (!e2) return this.appendMixTags(t2), this;
  if (!this.DOM.scope.contains(e2?.startContainer)) return this;
  f2(t2, e2);
  const i2 = s2[s2.length - 1] || t2;
  return i2?.parentNode && w2(i2), this.setStateSelection(), this.updateValueByDOMTags(), this.update(), this;
}, input: { set(t2 = "", e2 = true) {
  var s2 = this.settings, i2 = s2.dropdown.closeOnSelect;
  this.state.inputText = t2, e2 && (this.DOM.input.innerHTML = r("" + t2), t2 && this.toggleClass(s2.classNames.empty, !this.DOM.input.innerHTML)), !t2 && i2 && this.dropdown.hide.bind(this), this.input.autocomplete.suggest.call(this), this.input.validate.call(this);
}, raw() {
  return this.DOM.input.textContent;
}, validate() {
  var t2 = !this.state.inputText || true === this.validateTag({ value: this.state.inputText });
  return this.DOM.input.classList.toggle(this.settings.classNames.inputInvalid, !t2), t2;
}, normalize(t2, e2) {
  var s2 = t2 || this.DOM.input, i2 = [];
  s2.childNodes.forEach(((t3) => 3 == t3.nodeType && i2.push(t3.nodeValue))), i2 = i2.join("\n");
  try {
    i2 = i2.replace(/(?:\r\n|\r|\n)/g, this.settings.delimiters.source.charAt(0));
  } catch (t3) {
  }
  return i2 = i2.replace(/\s/g, " "), e2?.trim ? this.trim(i2) : i2;
}, autocomplete: { suggest(t2) {
  if (this.settings.autoComplete.enabled) {
    "object" != typeof (t2 = t2 || { value: "" }) && (t2 = { value: t2 });
    var e2 = this.dropdown.getMappedValue(t2);
    if ("number" != typeof e2) {
      var s2 = this.state.inputText.toLowerCase(), i2 = e2.substr(0, this.state.inputText.length).toLowerCase(), a3 = e2.substring(this.state.inputText.length);
      e2 && this.state.inputText && i2 == s2 ? (this.DOM.input.setAttribute("data-suggest", a3), this.state.inputSuggestion = t2) : (this.DOM.input.removeAttribute("data-suggest"), delete this.state.inputSuggestion);
    }
  }
}, set(t2) {
  var e2 = this.DOM.input.getAttribute("data-suggest"), s2 = t2 || (e2 ? this.state.inputText + e2 : null);
  return !!s2 && ("mix" == this.settings.mode ? this.replaceTextWithNode(document.createTextNode(this.state.tag.prefix + s2)) : (this.input.set.call(this, s2), this.setRangeAtStartEnd(false, this.DOM.input)), this.input.autocomplete.suggest.call(this), this.dropdown.hide(), true);
} } }, getTagIdx(t2) {
  return this.value.findIndex(((e2) => e2.__tagId == (t2 || {}).__tagId));
}, getNodeIndex(t2) {
  var e2 = 0;
  if (t2) for (; t2 = t2.previousElementSibling; ) e2++;
  return e2;
}, getTagElms(...t2) {
  var e2 = "." + [...this.settings.classNames.tag.split(" "), ...t2].join(".");
  return [].slice.call(this.DOM.scope.querySelectorAll(e2));
}, getLastTag() {
  var t2 = this.settings.classNames, e2 = this.DOM.scope.querySelectorAll(`${t2.tagSelector}:not(.${t2.tagHide}):not([readonly])`);
  return e2[e2.length - 1];
}, getTagElmBeforeInput() {
  var t2 = this.DOM.input && this.DOM.input.previousElementSibling;
  return u.call(this, t2) ? t2 : void 0;
}, isTagDuplicate(t2, e2, i2) {
  var a3 = 0;
  for (let n2 of this.value) {
    s(this.trim("" + t2), n2.value, e2) && i2 != n2.__tagId && a3++;
  }
  return a3;
}, getTagIndexByValue(t2) {
  var e2 = [], i2 = this.settings.dropdown.caseSensitive;
  return this.getTagElms().forEach(((a3, n2) => {
    a3.__tagifyTagData && s(this.trim(a3.__tagifyTagData.value), t2, i2) && e2.push(n2);
  })), e2;
}, getTagElmByValue(t2) {
  var e2 = this.getTagIndexByValue(t2)[0];
  return this.getTagElms()[e2];
}, flashTag(t2) {
  t2 && (t2.classList.add(this.settings.classNames.tagFlash), setTimeout((() => {
    t2.classList.remove(this.settings.classNames.tagFlash);
  }), 100));
}, isTagBlacklisted(t2) {
  return t2 = this.trim(t2.toLowerCase()), this.settings.blacklist.filter(((e2) => ("" + e2).toLowerCase() == t2)).length;
}, isTagWhitelisted(t2) {
  return !!this.getWhitelistItem(t2);
}, getWhitelistItem(t2, e2, i2) {
  e2 = e2 || "value";
  var a3, n2 = this.settings;
  return (i2 = i2 || n2.whitelist).some(((i3) => {
    var o2 = "object" == typeof i3 ? i3[e2] || i3.value : i3;
    if (s(o2, t2, n2.dropdown.caseSensitive, n2.trim)) return a3 = "object" == typeof i3 ? i3 : { value: i3 }, true;
  })), a3 || "value" != e2 || "value" == n2.tagTextProp || (a3 = this.getWhitelistItem(t2, n2.tagTextProp, i2)), a3;
}, validateTag(t2) {
  var e2 = this.settings, s2 = "value" in t2 ? "value" : e2.tagTextProp, i2 = this.trim(t2[s2] + "");
  return (t2[s2] + "").trim() ? "mix" != e2.mode && e2.pattern && e2.pattern instanceof RegExp && !e2.pattern.test(i2) ? this.TEXTS.pattern : !e2.duplicates && this.isTagDuplicate(i2, e2.dropdown.caseSensitive, t2.__tagId) ? this.TEXTS.duplicate : this.isTagBlacklisted(i2) || e2.enforceWhitelist && !this.isTagWhitelisted(i2) ? this.TEXTS.notAllowed : !e2.validate || e2.validate(t2) : this.TEXTS.empty;
}, getInvalidTagAttrs(t2, e2) {
  return { "aria-invalid": true, class: `${t2.class || ""} ${this.settings.classNames.tagNotAllowed}`.trim(), title: e2 };
}, hasMaxTags() {
  return this.value.length >= this.settings.maxTags && this.TEXTS.exceed;
}, setReadonly(t2, e2) {
  var s2 = this.settings;
  this.DOM.scope.contains(document.activeElement) && document.activeElement.blur(), s2[e2 || "readonly"] = t2, this.DOM.scope[(t2 ? "set" : "remove") + "Attribute"](e2 || "readonly", true), this.settings.userInput = true, this.setContentEditable(!t2), t2 || (this.events.binding.call(this, true), this.events.binding.call(this), s2.dropdown.enabled = this.origSettings.dropdown.enabled);
}, setContentEditable(t2) {
  this.DOM.scope.querySelectorAll("[data-can-editable]").forEach(((e2) => {
    e2.contentEditable = t2, e2.tabIndex = t2 ? 0 : -1;
  }));
}, setDisabled(t2) {
  this.setReadonly(t2, "disabled");
}, normalizeTags(t2) {
  var { whitelist: e2, delimiters: s2, mode: i2, tagTextProp: a3 } = this.settings, n2 = [], o2 = !!e2 && e2[0] instanceof Object, r2 = Array.isArray(t2), h3 = r2 && t2[0].value, g4 = (t3) => (t3 + "").split(s2).reduce(((t4, e3) => {
    const s3 = this.trim(e3);
    return s3 && t4.push({ [a3]: s3, value: s3 }), t4;
  }), []);
  if ("number" == typeof t2 && (t2 = t2.toString()), "string" == typeof t2) {
    if (!t2.trim()) return [];
    t2 = g4(t2);
  } else r2 && (t2 = t2.reduce(((t3, e3) => {
    if (l(e3)) {
      var s3 = d2({}, e3);
      a3 in s3 || (a3 = "value"), s3[a3] = this.trim(s3[a3]), (s3[a3] || 0 === s3[a3]) && t3.push(s3);
    } else null != e3 && "" !== e3 && void 0 !== e3 && t3.push(...g4(e3));
    return t3;
  }), []));
  return o2 && !h3 && (t2.forEach(((t3) => {
    var e3 = n2.map(((t4) => t4.value)), s3 = this.dropdown.filterListItems.call(this, t3[a3], { exact: true });
    this.settings.duplicates || (s3 = s3.filter(((t4) => !e3.includes(t4.value))));
    var o3 = s3.length > 1 ? this.getWhitelistItem(t3[a3], a3, s3) : s3[0];
    o3 && o3 instanceof Object ? n2.push(o3) : "mix" != i2 && (null == t3.value && (t3.value = t3[a3]), n2.push(t3));
  })), n2.length && (t2 = n2)), t2;
}, parseMixTags(t2, e2) {
  var { mixTagsInterpolator: s2, duplicates: i2, transformTag: a3, enforceWhitelist: n2, maxTags: o2, tagTextProp: r2 } = this.settings, l4 = e2?.skipDOM, d4 = l4 ? document.createDocumentFragment() : null, h3 = [];
  if (t2 = t2.split(s2[0]).map(((t3, e3) => {
    var g5, c3, p3, u2 = t3.split(s2[1]), m4 = u2[0], v3 = h3.length == o2;
    if (l4 && 0 == e3 && t3) return d4.appendChild(document.createTextNode(t3)), "";
    try {
      if (m4 == +m4) throw Error;
      c3 = JSON.parse(m4);
    } catch (t4) {
      c3 = this.normalizeTags(m4)[0] || { value: m4 };
    }
    if (a3.call(this, c3), v3 || !(u2.length > 1) || n2 && !this.isTagWhitelisted(c3.value) || !i2 && this.isTagDuplicate(c3.value)) {
      if (t3) return l4 ? (d4.appendChild(document.createTextNode(s2[0] + t3)), "") : e3 ? s2[0] + t3 : t3;
    } else {
      if (c3[g5 = c3[r2] ? r2 : "value"] = this.trim(c3[g5]), p3 = this.createTagElem(c3), h3.push(c3), p3.classList.add(this.settings.classNames.tagNoAnimation), l4) return d4.appendChild(p3), u2[1] && d4.appendChild(document.createTextNode(u2[1])), "";
      u2[0] = p3.outerHTML, this.value.push(c3);
    }
    return u2.join("");
  })).join(""), l4) return d4.__tagifyTagsData = h3, d4;
  this.DOM.input.innerHTML = t2, this.DOM.input.appendChild(document.createTextNode("")), this.DOM.input.normalize();
  var g4 = this.getTagElms();
  return g4.forEach(((t3, e3) => T(t3, h3[e3]))), this.update({ withoutChangeEvent: true }), b2(g4, this.state.hasFocus), t2;
}, convertPastedTextToMixTags(t2) {
  const { pattern: e2, whitelist: s2, mixTagsInterpolator: i2, mixTagsAllowedAfter: a3, tagTextProp: n2 } = this.settings;
  if (!e2 || !s2?.length) return t2;
  const o2 = e2.source ? e2.source.split("|") : [e2], r2 = {};
  o2.forEach(((t3) => {
    const e3 = t3.replace(/\\/g, "");
    r2[e3] = s2.map(((t4) => {
      let e4;
      return e4 = "string" == typeof t4 ? t4 : t4[n2] || t4.value, e4 = String(e4), { originalItem: t4, value: e4, searchValue: e4.toLowerCase() };
    })).sort(((t4, e4) => e4.value.length - t4.value.length));
  }));
  const l4 = new RegExp(e2.source, "g"), d4 = [];
  let h3;
  for (; null !== (h3 = l4.exec(t2)); ) {
    const e3 = h3[0], s3 = h3.index, n3 = s3 + e3.length, o3 = t2.slice(n3), g5 = r2[e3];
    if (!g5) continue;
    let c3 = null, p3 = 0;
    for (const t3 of g5) {
      const e4 = t3.value.length;
      if (o3.slice(0, e4).toLowerCase() === t3.searchValue) {
        const s4 = o3[e4];
        if (!s4 || a3.test(s4)) {
          c3 = t3, p3 = e4;
          break;
        }
      }
    }
    if (c3) {
      const t3 = "string" == typeof c3.originalItem ? { value: c3.value, prefix: e3 } : { ...c3.originalItem, prefix: e3 };
      if (true === this.validateTag(t3)) {
        const e4 = `${i2[0]}${JSON.stringify(t3)}${i2[1]}`;
        d4.push({ start: s3, end: n3 + p3, replacement: e4 }), l4.lastIndex = n3 + p3;
      }
    }
  }
  let g4 = t2;
  return d4.reverse().forEach((({ start: t3, end: e3, replacement: s3 }) => {
    g4 = g4.slice(0, t3) + s3 + g4.slice(e3);
  })), g4;
}, replaceTextWithNode(t2, e2) {
  if (this.state.tag || e2) {
    e2 = e2 || this.state.tag.prefix + this.state.tag.value;
    var s2, i2, a3 = this.state.selection || window.getSelection(), n2 = a3.anchorNode, o2 = this.state.tag.delimiters ? this.state.tag.delimiters.length : 0;
    return n2.splitText(a3.anchorOffset - o2), -1 == (s2 = n2.nodeValue.lastIndexOf(e2)) ? true : (i2 = n2.splitText(s2), t2 && n2.parentNode.replaceChild(t2, i2), true);
  }
}, prepareNewTagNode(t2, e2) {
  e2 = e2 || {};
  var s2 = this.settings, i2 = [], a3 = {}, n2 = Object.assign({}, t2, { value: t2.value + "" });
  if (t2 = Object.assign({}, n2), s2.transformTag.call(this, t2), t2.__isValid = this.hasMaxTags() || this.validateTag(t2), true !== t2.__isValid) {
    if (e2.skipInvalid) return;
    if (d2(a3, this.getInvalidTagAttrs(t2, t2.__isValid), { __preInvalidData: n2 }), t2.__isValid == this.TEXTS.duplicate && this.flashTag(this.getTagElmByValue(t2.value)), !s2.createInvalidTags) return void i2.push(t2.value);
  }
  return "readonly" in t2 && (t2.readonly ? a3["aria-readonly"] = true : delete t2.readonly), { tagElm: this.createTagElem(t2, a3), tagData: t2, aggregatedInvalidInput: i2 };
}, postProcessNewTagNode(t2, e2) {
  var s2 = this.settings, i2 = e2.__isValid;
  i2 && true === i2 ? this.value.push(e2) : (this.trigger("invalid", { data: e2, index: this.value.length, tag: t2, message: i2 }), s2.keepInvalidTags || setTimeout((() => this.removeTags(t2, true)), 1e3)), this.dropdown.position();
}, selectTag(t2, e2) {
  if (!this.settings.enforceWhitelist || this.isTagWhitelisted(e2.value)) {
    this.state.actions.selectOption && setTimeout((() => this.setRangeAtStartEnd(false, this.DOM.input)));
    var s2 = this.getLastTag();
    return s2 ? this.replaceTag(s2, e2) : this.appendTag(t2), this.value[0] = e2, this.update(), this.trigger("add", { tag: t2, data: e2 }), [t2];
  }
}, addEmptyTag(t2) {
  var e2 = d2({ value: "" }, t2 || {}), s2 = this.createTagElem(e2);
  T(s2, e2), this.appendTag(s2), this.editTag(s2, { skipValidation: true }), this.toggleFocusClass(true);
}, addTags(t2, e2, s2) {
  var i2 = [], a3 = this.settings, n2 = [], o2 = document.createDocumentFragment(), r2 = [];
  if (!t2 || 0 == t2.length) return i2;
  switch (t2 = this.normalizeTags(t2), a3.mode) {
    case "mix":
      return this.addMixTags(t2);
    case "select":
      e2 = false, this.removeAllTags();
  }
  return this.DOM.input.removeAttribute("style"), t2.forEach(((t3) => {
    const e3 = this.prepareNewTagNode(t3, { skipInvalid: s2 || a3.skipInvalid });
    if (!e3) return;
    const l4 = e3.tagElm;
    if (t3 = e3.tagData, n2 = e3.aggregatedInvalidInput, i2.push(l4), "select" == a3.mode) return this.selectTag(l4, t3);
    o2.appendChild(l4), this.postProcessNewTagNode(l4, t3), r2.push({ tagElm: l4, tagData: t3 });
  })), this.appendTag(o2), r2.forEach((({ tagElm: t3, tagData: e3 }) => this.trigger("add", { tag: t3, index: this.getTagIdx(e3), data: e3 }))), this.update(), t2.length && e2 && (this.input.set.call(this, a3.createInvalidTags ? "" : n2.join(a3._delimiters)), this.setRangeAtStartEnd(false, this.DOM.input)), this.dropdown.refilter(), i2;
}, addMixTags(t2) {
  if ((t2 = this.normalizeTags(t2))[0].prefix || this.state.tag) return this.prefixedTextToTag(t2[0]);
  var e2 = document.createDocumentFragment(), s2 = [];
  return t2.forEach(((t3) => {
    const i2 = this.prepareNewTagNode(t3);
    e2.appendChild(i2.tagElm), this.insertAfterTag(i2.tagElm), this.postProcessNewTagNode(i2.tagElm, i2.tagData), s2.push({ tagElm: i2.tagElm, tagData: i2.tagData });
  })), this.appendMixTags(e2, s2), e2.children;
}, appendMixTags(t2, e2) {
  const s2 = this.state.selection?.range, i2 = !!s2 && this.DOM.scope.contains(s2.startContainer), a3 = t2 ? 11 === t2.nodeType ? Array.prototype.slice.call(t2.childNodes) : [t2] : [];
  if (i2) this.injectAtCaret(t2);
  else {
    this.DOM.input.focus();
    const e3 = this.setStateSelection();
    e3?.range && (e3.range.setStart(this.DOM.input, e3.range.endOffset), e3.range.setEnd(this.DOM.input, e3.range.endOffset)), this.DOM.input.appendChild(t2), this.updateValueByDOMTags(), this.update();
    const s3 = a3[a3.length - 1];
    s3?.parentNode && w2(s3), this.setStateSelection();
  }
  const n2 = e2?.length ? e2 : a3.filter(((t3) => 1 === t3.nodeType));
  n2?.length && this.trigger("add", { tags: n2 });
}, prefixedTextToTag(t2) {
  var e2, s2, i2 = this.settings, a3 = this.state.tag?.delimiters;
  if (t2.prefix = t2.prefix || this.state.tag ? this.state.tag.prefix : (i2.pattern.source || i2.pattern)[0], s2 = this.prepareNewTagNode(t2), e2 = s2.tagElm, this.replaceTextWithNode(e2) || this.DOM.input.appendChild(e2), setTimeout((() => e2.classList.add(this.settings.classNames.tagNoAnimation)), 300), this.update(), !a3) {
    var n2 = this.insertAfterTag(e2) || e2;
    setTimeout(w2, 0, n2);
  }
  return this.state.tag = null, this.postProcessNewTagNode(e2, s2.tagData), this.trigger("add", { tag: s2, data: t2 }), e2;
}, appendTag(t2) {
  var e2 = this.DOM, s2 = e2.input;
  e2.scope.insertBefore(t2, s2);
}, repositionScopeInput(t2, e2 = {}) {
  var s2 = this.DOM.input, i2 = this.DOM.scope, a3 = this.settings, n2 = s2 && s2.parentNode, o2 = "reset" === t2, r2 = void 0 !== e2.focus ? e2.focus : !o2;
  if ("mix" == a3.mode || this.state.dropdown.visible) return false;
  if (!s2 || !i2 || n2 != i2) return false;
  if (o2) {
    var l4 = this.getTagElms(), d4 = l4[l4.length - 1];
    return !!d4 && (d4.nextElementSibling !== s2 && (d4.after(s2), r2 && s2.focus(), true));
  }
  if (!a3.allowCaretBetweenTags) return false;
  if ("left" === t2 || "ArrowLeft" === t2) {
    var h3 = this.getTagElmBeforeInput();
    return !!h3 && (i2.insertBefore(s2, h3), r2 && s2.focus(), true);
  }
  if ("right" === t2 || "ArrowRight" === t2) {
    var g4 = s2.nextElementSibling;
    return !!u.call(this, g4) && (g4.after(s2), r2 && s2.focus(), true);
  }
  return false;
}, createTagElem(t2, e2) {
  t2.__tagId = p2();
  var s2, i2 = d2({}, t2, { [this.settings.tagTextProp]: r((t2[this.settings.tagTextProp] || t2.value) + ""), title: r((t2.title || t2.value) + ""), value: r(t2.value + ""), ...e2 });
  return (function(t3) {
    for (var e3, s3 = document.createNodeIterator(t3, NodeFilter.SHOW_TEXT, null, false); e3 = s3.nextNode(); ) e3.textContent.trim() || e3.parentNode.removeChild(e3);
  })(s2 = this.parseTemplate("tag", [i2, this])), T(s2, t2), s2;
}, reCheckInvalidTags() {
  var t2 = this.settings;
  this.getTagElms(t2.classNames.tagNotAllowed).forEach(((e2, s2) => {
    var i2 = T(e2), a3 = this.hasMaxTags(), n2 = this.validateTag(i2), o2 = true === n2 && !a3;
    if ("select" == t2.mode && this.toggleScopeValidation(n2), o2) return i2 = i2.__preInvalidData ? i2.__preInvalidData : { value: i2.value }, this.replaceTag(e2, i2);
    e2.title = a3 || n2;
  }));
}, removeTags(t2, e2, s2) {
  var i2, a3 = this.settings;
  if (t2 = t2 && t2 instanceof HTMLElement ? [t2] : t2 instanceof Array ? t2 : t2 ? [t2] : [this.getLastTag()].filter(((t3) => t3)), i2 = t2.reduce(((t3, e3) => {
    e3 && "string" == typeof e3 && (e3 = this.getTagElmByValue(e3));
    var s3 = T(e3);
    return e3 && s3 && !s3.readonly && t3.push({ node: e3, idx: this.getTagIdx(s3), data: T(e3, { __removed: true }) }), t3;
  }), []), s2 = "number" == typeof s2 ? s2 : this.CSSVars.tagHideTransition, "select" == a3.mode && (s2 = 0, this.input.set.call(this)), 1 == i2.length && "select" != a3.mode && i2[0].node.classList.contains(a3.classNames.tagNotAllowed) && (e2 = true), i2.length) return a3.hooks.beforeRemoveTag(i2, { tagify: this }).then((() => {
    function t3(t4) {
      t4.node.parentNode && (t4.node.parentNode.removeChild(t4.node), e2 ? a3.keepInvalidTags && this.trigger("remove", { tag: t4.node, index: t4.idx }) : (this.dropdown.refilter(), this.dropdown.position(), this.DOM.input.normalize(), a3.keepInvalidTags && this.reCheckInvalidTags(), this.trigger("remove", { tag: t4.node, index: t4.idx, data: t4.data })));
    }
    e2 || (this.removeTagsFromValue(i2.map(((t4) => t4.node))), this.update(), "select" == a3.mode && a3.userInput && this.setContentEditable(true)), s2 && s2 > 10 && 1 == i2.length ? function(e3) {
      e3.node.style.width = parseFloat(window.getComputedStyle(e3.node).width) + "px", document.body.clientTop, e3.node.classList.add(a3.classNames.tagHide), setTimeout(t3.bind(this), s2, e3);
    }.call(this, i2[0]) : i2.forEach(t3.bind(this));
  })).catch(((t3) => {
  }));
}, removeTagsFromDOM() {
  this.getTagElms().forEach(((t2) => t2.remove()));
}, removeTagsFromValue(t2) {
  (t2 = Array.isArray(t2) ? t2 : [t2]).forEach(((t3) => {
    var e2 = T(t3), s2 = this.getTagIdx(e2);
    s2 > -1 && this.value.splice(s2, 1);
  }));
}, removeAllTags(t2) {
  t2 = t2 || {}, this.value = [], "mix" == this.settings.mode ? this.DOM.input.innerHTML = "" : this.removeTagsFromDOM(), this.dropdown.refilter(), this.dropdown.position(), this.state.dropdown.visible && setTimeout((() => {
    this.DOM.input.focus();
  })), "select" == this.settings.mode && (this.input.set.call(this), this.settings.userInput && this.setContentEditable(true));
  const e2 = this.state.blockChangeEvent ? void 0 : () => {
    !this.state.blockChangeEvent && this.trigger("remove", {});
  };
  this.update(t2, e2);
}, postUpdate() {
  this.state.blockChangeEvent = false;
  var t2 = this.settings, e2 = t2.classNames, s2 = "mix" == t2.mode ? t2.mixMode.integrated ? this.DOM.input.textContent : this.DOM.originalInput.value.trim() : this.value.length + this.input.raw.call(this).length;
  this.toggleClass(e2.hasMaxTags, this.value.length >= t2.maxTags), this.toggleClass(e2.hasNoTags, !this.value.length), this.toggleClass(e2.empty, !s2), "select" == t2.mode && this.toggleScopeValidation(this.value?.[0]?.__isValid);
}, setOriginalInputValue(t2) {
  var e2 = this.DOM.originalInput;
  this.settings.mixMode.integrated || (e2.value = t2, e2.tagifyValue = e2.value);
}, update(t2, e2) {
  clearTimeout(this.debouncedUpdateTimeout), this.debouncedUpdateTimeout = setTimeout(function() {
    this.setPersistedData(s2, "value"), this.settings.onChangeAfterBlur && (t2 || {}).withoutChangeEvent || this.state.blockChangeEvent || this.triggerChangeEvent();
    this.postUpdate(), e2?.();
  }.bind(this), 100), this.events.bindOriginaInputListener.call(this, 100);
  var s2 = this.getInputValue();
  this.setOriginalInputValue(s2);
}, getInputValue() {
  var t2 = this.getCleanValue();
  return "mix" == this.settings.mode ? this.getMixedTagsAsString(t2) : t2.length ? this.settings.originalInputValueFormat ? this.settings.originalInputValueFormat(t2) : JSON.stringify(t2) : "";
}, getCleanValue(t2) {
  return i(t2 || this.value, this.dataProps);
}, getMixedTagsAsString() {
  var t2 = "", e2 = this, s2 = this.settings, i2 = s2.originalInputValueFormat || JSON.stringify, n2 = s2.mixTagsInterpolator;
  return (function s3(o2) {
    o2.childNodes.forEach(((o3) => {
      if (1 == o3.nodeType) {
        const r2 = T(o3);
        if ("BR" == o3.tagName && (t2 += "\r\n"), r2 && u.call(e2, o3)) {
          if (r2.__removed) return;
          t2 += n2[0] + i2(a2(r2, e2.dataProps)) + n2[1];
        } else o3.getAttribute("style") || ["B", "I", "U"].includes(o3.tagName) ? t2 += o3.textContent : "DIV" != o3.tagName && "P" != o3.tagName || (t2 += "\r\n", s3(o3));
      } else t2 += o3.textContent;
    }));
  })(this.DOM.input), t2;
} }, N.prototype.removeTag = N.prototype.removeTags;

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/contrib/microevent.js
function forEvents(events, callback) {
  events.split(/\s+/).forEach((event) => {
    callback(event);
  });
}
var MicroEvent = class {
  constructor() {
    this._events = {};
  }
  on(events, fct) {
    forEvents(events, (event) => {
      const event_array = this._events[event] || [];
      event_array.push(fct);
      this._events[event] = event_array;
    });
  }
  off(events, fct) {
    var n2 = arguments.length;
    if (n2 === 0) {
      this._events = {};
      return;
    }
    forEvents(events, (event) => {
      if (n2 === 1) {
        delete this._events[event];
        return;
      }
      const event_array = this._events[event];
      if (event_array === void 0)
        return;
      event_array.splice(event_array.indexOf(fct), 1);
      this._events[event] = event_array;
    });
  }
  trigger(events, ...args) {
    var self2 = this;
    forEvents(events, (event) => {
      const event_array = self2._events[event];
      if (event_array === void 0)
        return;
      event_array.forEach((fct) => {
        fct.apply(self2, args);
      });
    });
  }
};

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/contrib/microplugin.js
function MicroPlugin(Interface) {
  Interface.plugins = {};
  return class extends Interface {
    constructor() {
      super(...arguments);
      this.plugins = {
        names: [],
        settings: {},
        requested: {},
        loaded: {}
      };
    }
    /**
     * Registers a plugin.
     *
     * @param {function} fn
     */
    static define(name, fn2) {
      Interface.plugins[name] = {
        "name": name,
        "fn": fn2
      };
    }
    /**
     * Initializes the listed plugins (with options).
     * Acceptable formats:
     *
     * List (without options):
     *   ['a', 'b', 'c']
     *
     * List (with options):
     *   [{'name': 'a', options: {}}, {'name': 'b', options: {}}]
     *
     * Hash (with options):
     *   {'a': { ... }, 'b': { ... }, 'c': { ... }}
     *
     * @param {array|object} plugins
     */
    initializePlugins(plugins) {
      var key, name;
      const self2 = this;
      const queue = [];
      if (Array.isArray(plugins)) {
        plugins.forEach((plugin15) => {
          if (typeof plugin15 === "string") {
            queue.push(plugin15);
          } else {
            self2.plugins.settings[plugin15.name] = plugin15.options;
            queue.push(plugin15.name);
          }
        });
      } else if (plugins) {
        for (key in plugins) {
          if (plugins.hasOwnProperty(key)) {
            self2.plugins.settings[key] = plugins[key];
            queue.push(key);
          }
        }
      }
      while (name = queue.shift()) {
        self2.require(name);
      }
    }
    loadPlugin(name) {
      var self2 = this;
      var plugins = self2.plugins;
      var plugin15 = Interface.plugins[name];
      if (!Interface.plugins.hasOwnProperty(name)) {
        throw new Error('Unable to find "' + name + '" plugin');
      }
      plugins.requested[name] = true;
      plugins.loaded[name] = plugin15.fn.apply(self2, [self2.plugins.settings[name] || {}]);
      plugins.names.push(name);
    }
    /**
     * Initializes a plugin.
     *
     */
    require(name) {
      var self2 = this;
      var plugins = self2.plugins;
      if (!self2.plugins.loaded.hasOwnProperty(name)) {
        if (plugins.requested[name]) {
          throw new Error('Plugin has circular dependency ("' + name + '")');
        }
        self2.loadPlugin(name);
      }
      return plugins.loaded[name];
    }
  };
}

// node_modules/.pnpm/@orchidjs+unicode-variants@1.1.2/node_modules/@orchidjs/unicode-variants/dist/esm/regex.js
var arrayToPattern = (chars) => {
  chars = chars.filter(Boolean);
  if (chars.length < 2) {
    return chars[0] || "";
  }
  return maxValueLength(chars) == 1 ? "[" + chars.join("") + "]" : "(?:" + chars.join("|") + ")";
};
var sequencePattern = (array) => {
  if (!hasDuplicates(array)) {
    return array.join("");
  }
  let pattern = "";
  let prev_char_count = 0;
  const prev_pattern = () => {
    if (prev_char_count > 1) {
      pattern += "{" + prev_char_count + "}";
    }
  };
  array.forEach((char, i2) => {
    if (char === array[i2 - 1]) {
      prev_char_count++;
      return;
    }
    prev_pattern();
    pattern += char;
    prev_char_count = 1;
  });
  prev_pattern();
  return pattern;
};
var setToPattern = (chars) => {
  let array = Array.from(chars);
  return arrayToPattern(array);
};
var hasDuplicates = (array) => {
  return new Set(array).size !== array.length;
};
var escape_regex = (str) => {
  return (str + "").replace(/([\$\(\)\*\+\.\?\[\]\^\{\|\}\\])/gu, "\\$1");
};
var maxValueLength = (array) => {
  return array.reduce((longest, value) => Math.max(longest, unicodeLength(value)), 0);
};
var unicodeLength = (str) => {
  return Array.from(str).length;
};

// node_modules/.pnpm/@orchidjs+unicode-variants@1.1.2/node_modules/@orchidjs/unicode-variants/dist/esm/strings.js
var allSubstrings = (input) => {
  if (input.length === 1)
    return [[input]];
  let result = [];
  const start2 = input.substring(1);
  const suba = allSubstrings(start2);
  suba.forEach(function(subresult) {
    let tmp = subresult.slice(0);
    tmp[0] = input.charAt(0) + tmp[0];
    result.push(tmp);
    tmp = subresult.slice(0);
    tmp.unshift(input.charAt(0));
    result.push(tmp);
  });
  return result;
};

// node_modules/.pnpm/@orchidjs+unicode-variants@1.1.2/node_modules/@orchidjs/unicode-variants/dist/esm/index.js
var code_points = [[0, 65535]];
var accent_pat = "[\u0300-\u036F\xB7\u02BE\u02BC]";
var unicode_map;
var multi_char_reg;
var max_char_length = 3;
var latin_convert = {};
var latin_condensed = {
  "/": "\u2044\u2215",
  "0": "\u07C0",
  "a": "\u2C65\u0250\u0251",
  "aa": "\uA733",
  "ae": "\xE6\u01FD\u01E3",
  "ao": "\uA735",
  "au": "\uA737",
  "av": "\uA739\uA73B",
  "ay": "\uA73D",
  "b": "\u0180\u0253\u0183",
  "c": "\uA73F\u0188\u023C\u2184",
  "d": "\u0111\u0257\u0256\u1D05\u018C\uABB7\u0501\u0266",
  "e": "\u025B\u01DD\u1D07\u0247",
  "f": "\uA77C\u0192",
  "g": "\u01E5\u0260\uA7A1\u1D79\uA77F\u0262",
  "h": "\u0127\u2C68\u2C76\u0265",
  "i": "\u0268\u0131",
  "j": "\u0249\u0237",
  "k": "\u0199\u2C6A\uA741\uA743\uA745\uA7A3",
  "l": "\u0142\u019A\u026B\u2C61\uA749\uA747\uA781\u026D",
  "m": "\u0271\u026F\u03FB",
  "n": "\uA7A5\u019E\u0272\uA791\u1D0E\u043B\u0509",
  "o": "\xF8\u01FF\u0254\u0275\uA74B\uA74D\u1D11",
  "oe": "\u0153",
  "oi": "\u01A3",
  "oo": "\uA74F",
  "ou": "\u0223",
  "p": "\u01A5\u1D7D\uA751\uA753\uA755\u03C1",
  "q": "\uA757\uA759\u024B",
  "r": "\u024D\u027D\uA75B\uA7A7\uA783",
  "s": "\xDF\u023F\uA7A9\uA785\u0282",
  "t": "\u0167\u01AD\u0288\u2C66\uA787",
  "th": "\xFE",
  "tz": "\uA729",
  "u": "\u0289",
  "v": "\u028B\uA75F\u028C",
  "vy": "\uA761",
  "w": "\u2C73",
  "y": "\u01B4\u024F\u1EFF",
  "z": "\u01B6\u0225\u0240\u2C6C\uA763",
  "hv": "\u0195"
};
for (let latin in latin_condensed) {
  let unicode = latin_condensed[latin] || "";
  for (let i2 = 0; i2 < unicode.length; i2++) {
    let char = unicode.substring(i2, i2 + 1);
    latin_convert[char] = latin;
  }
}
var convert_pat = new RegExp(Object.keys(latin_convert).join("|") + "|" + accent_pat, "gu");
var initialize = (_code_points) => {
  if (unicode_map !== void 0)
    return;
  unicode_map = generateMap(_code_points || code_points);
};
var normalize = (str, form = "NFKD") => str.normalize(form);
var asciifold = (str) => {
  return Array.from(str).reduce(
    /**
     * @param {string} result
     * @param {string} char
     */
    (result, char) => {
      return result + _asciifold(char);
    },
    ""
  );
};
var _asciifold = (str) => {
  str = normalize(str).toLowerCase().replace(convert_pat, (char) => {
    return latin_convert[char] || "";
  });
  return normalize(str, "NFC");
};
function* generator(code_points2) {
  for (const [code_point_min, code_point_max] of code_points2) {
    for (let i2 = code_point_min; i2 <= code_point_max; i2++) {
      let composed = String.fromCharCode(i2);
      let folded = asciifold(composed);
      if (folded == composed.toLowerCase()) {
        continue;
      }
      if (folded.length > max_char_length) {
        continue;
      }
      if (folded.length == 0) {
        continue;
      }
      yield { folded, composed, code_point: i2 };
    }
  }
}
var generateSets = (code_points2) => {
  const unicode_sets = {};
  const addMatching = (folded, to_add) => {
    const folded_set = unicode_sets[folded] || /* @__PURE__ */ new Set();
    const patt = new RegExp("^" + setToPattern(folded_set) + "$", "iu");
    if (to_add.match(patt)) {
      return;
    }
    folded_set.add(escape_regex(to_add));
    unicode_sets[folded] = folded_set;
  };
  for (let value of generator(code_points2)) {
    addMatching(value.folded, value.folded);
    addMatching(value.folded, value.composed);
  }
  return unicode_sets;
};
var generateMap = (code_points2) => {
  const unicode_sets = generateSets(code_points2);
  const unicode_map2 = {};
  let multi_char = [];
  for (let folded in unicode_sets) {
    let set = unicode_sets[folded];
    if (set) {
      unicode_map2[folded] = setToPattern(set);
    }
    if (folded.length > 1) {
      multi_char.push(escape_regex(folded));
    }
  }
  multi_char.sort((a3, b4) => b4.length - a3.length);
  const multi_char_patt = arrayToPattern(multi_char);
  multi_char_reg = new RegExp("^" + multi_char_patt, "u");
  return unicode_map2;
};
var mapSequence = (strings, min_replacement = 1) => {
  let chars_replaced = 0;
  strings = strings.map((str) => {
    if (unicode_map[str]) {
      chars_replaced += str.length;
    }
    return unicode_map[str] || str;
  });
  if (chars_replaced >= min_replacement) {
    return sequencePattern(strings);
  }
  return "";
};
var substringsToPattern = (str, min_replacement = 1) => {
  min_replacement = Math.max(min_replacement, str.length - 1);
  return arrayToPattern(allSubstrings(str).map((sub_pat) => {
    return mapSequence(sub_pat, min_replacement);
  }));
};
var sequencesToPattern = (sequences, all = true) => {
  let min_replacement = sequences.length > 1 ? 1 : 0;
  return arrayToPattern(sequences.map((sequence) => {
    let seq = [];
    const len = all ? sequence.length() : sequence.length() - 1;
    for (let j2 = 0; j2 < len; j2++) {
      seq.push(substringsToPattern(sequence.substrs[j2] || "", min_replacement));
    }
    return sequencePattern(seq);
  }));
};
var inSequences = (needle_seq, sequences) => {
  for (const seq of sequences) {
    if (seq.start != needle_seq.start || seq.end != needle_seq.end) {
      continue;
    }
    if (seq.substrs.join("") !== needle_seq.substrs.join("")) {
      continue;
    }
    let needle_parts = needle_seq.parts;
    const filter = (part) => {
      for (const needle_part of needle_parts) {
        if (needle_part.start === part.start && needle_part.substr === part.substr) {
          return false;
        }
        if (part.length == 1 || needle_part.length == 1) {
          continue;
        }
        if (part.start < needle_part.start && part.end > needle_part.start) {
          return true;
        }
        if (needle_part.start < part.start && needle_part.end > part.start) {
          return true;
        }
      }
      return false;
    };
    let filtered = seq.parts.filter(filter);
    if (filtered.length > 0) {
      continue;
    }
    return true;
  }
  return false;
};
var Sequence = class _Sequence {
  constructor() {
    __publicField(this, "parts");
    __publicField(this, "substrs");
    __publicField(this, "start");
    __publicField(this, "end");
    this.parts = [];
    this.substrs = [];
    this.start = 0;
    this.end = 0;
  }
  add(part) {
    if (part) {
      this.parts.push(part);
      this.substrs.push(part.substr);
      this.start = Math.min(part.start, this.start);
      this.end = Math.max(part.end, this.end);
    }
  }
  last() {
    return this.parts[this.parts.length - 1];
  }
  length() {
    return this.parts.length;
  }
  clone(position, last_piece) {
    let clone = new _Sequence();
    let parts = JSON.parse(JSON.stringify(this.parts));
    let last_part = parts.pop();
    for (const part of parts) {
      clone.add(part);
    }
    let last_substr = last_piece.substr.substring(0, position - last_part.start);
    let clone_last_len = last_substr.length;
    clone.add({ start: last_part.start, end: last_part.start + clone_last_len, length: clone_last_len, substr: last_substr });
    return clone;
  }
};
var getPattern = (str) => {
  initialize();
  str = asciifold(str);
  let pattern = "";
  let sequences = [new Sequence()];
  for (let i2 = 0; i2 < str.length; i2++) {
    let substr = str.substring(i2);
    let match = substr.match(multi_char_reg);
    const char = str.substring(i2, i2 + 1);
    const match_str = match ? match[0] : null;
    let overlapping = [];
    let added_types = /* @__PURE__ */ new Set();
    for (const sequence of sequences) {
      const last_piece = sequence.last();
      if (!last_piece || last_piece.length == 1 || last_piece.end <= i2) {
        if (match_str) {
          const len = match_str.length;
          sequence.add({ start: i2, end: i2 + len, length: len, substr: match_str });
          added_types.add("1");
        } else {
          sequence.add({ start: i2, end: i2 + 1, length: 1, substr: char });
          added_types.add("2");
        }
      } else if (match_str) {
        let clone = sequence.clone(i2, last_piece);
        const len = match_str.length;
        clone.add({ start: i2, end: i2 + len, length: len, substr: match_str });
        overlapping.push(clone);
      } else {
        added_types.add("3");
      }
    }
    if (overlapping.length > 0) {
      overlapping = overlapping.sort((a3, b4) => {
        return a3.length() - b4.length();
      });
      for (let clone of overlapping) {
        if (inSequences(clone, sequences)) {
          continue;
        }
        sequences.push(clone);
      }
      continue;
    }
    if (i2 > 0 && added_types.size == 1 && !added_types.has("3")) {
      pattern += sequencesToPattern(sequences, false);
      let new_seq = new Sequence();
      const old_seq = sequences[0];
      if (old_seq) {
        new_seq.add(old_seq.last());
      }
      sequences = [new_seq];
    }
  }
  pattern += sequencesToPattern(sequences, true);
  return pattern;
};

// node_modules/.pnpm/@orchidjs+sifter@1.1.0/node_modules/@orchidjs/sifter/dist/esm/utils.js
var getAttr = (obj, name) => {
  if (!obj)
    return;
  return obj[name];
};
var getAttrNesting = (obj, name) => {
  if (!obj)
    return;
  var part, names = name.split(".");
  while ((part = names.shift()) && (obj = obj[part]))
    ;
  return obj;
};
var scoreValue = (value, token, weight) => {
  var score, pos;
  if (!value)
    return 0;
  value = value + "";
  if (token.regex == null)
    return 0;
  pos = value.search(token.regex);
  if (pos === -1)
    return 0;
  score = token.string.length / value.length;
  if (pos === 0)
    score += 0.5;
  return score * weight;
};
var propToArray = (obj, key) => {
  var value = obj[key];
  if (typeof value == "function")
    return value;
  if (value && !Array.isArray(value)) {
    obj[key] = [value];
  }
};
var iterate = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var cmp = (a3, b4) => {
  if (typeof a3 === "number" && typeof b4 === "number") {
    return a3 > b4 ? 1 : a3 < b4 ? -1 : 0;
  }
  a3 = asciifold(a3 + "").toLowerCase();
  b4 = asciifold(b4 + "").toLowerCase();
  if (a3 > b4)
    return 1;
  if (b4 > a3)
    return -1;
  return 0;
};

// node_modules/.pnpm/@orchidjs+sifter@1.1.0/node_modules/@orchidjs/sifter/dist/esm/sifter.js
var Sifter = class {
  /**
   * Textually searches arrays and hashes of objects
   * by property (or multiple properties). Designed
   * specifically for autocomplete.
   *
   */
  constructor(items, settings) {
    __publicField(this, "items");
    // []|{};
    __publicField(this, "settings");
    this.items = items;
    this.settings = settings || { diacritics: true };
  }
  /**
   * Splits a search string into an array of individual
   * regexps to be used to match results.
   *
   */
  tokenize(query, respect_word_boundaries, weights) {
    if (!query || !query.length)
      return [];
    const tokens = [];
    const words = query.split(/\s+/);
    var field_regex;
    if (weights) {
      field_regex = new RegExp("^(" + Object.keys(weights).map(escape_regex).join("|") + "):(.*)$");
    }
    words.forEach((word) => {
      let field_match;
      let field = null;
      let regex = null;
      if (field_regex && (field_match = word.match(field_regex))) {
        field = field_match[1];
        word = field_match[2];
      }
      if (word.length > 0) {
        if (this.settings.diacritics) {
          regex = getPattern(word) || null;
        } else {
          regex = escape_regex(word);
        }
        if (regex && respect_word_boundaries)
          regex = "\\b" + regex;
      }
      tokens.push({
        string: word,
        regex: regex ? new RegExp(regex, "iu") : null,
        field
      });
    });
    return tokens;
  }
  /**
   * Returns a function to be used to score individual results.
   *
   * Good matches will have a higher score than poor matches.
   * If an item is not a match, 0 will be returned by the function.
   *
   * @returns {T.ScoreFn}
   */
  getScoreFunction(query, options) {
    var search = this.prepareSearch(query, options);
    return this._getScoreFunction(search);
  }
  /**
   * @returns {T.ScoreFn}
   *
   */
  _getScoreFunction(search) {
    const tokens = search.tokens, token_count = tokens.length;
    if (!token_count) {
      return function() {
        return 0;
      };
    }
    const fields = search.options.fields, weights = search.weights, field_count = fields.length, getAttrFn = search.getAttrFn;
    if (!field_count) {
      return function() {
        return 1;
      };
    }
    const scoreObject = (function() {
      if (field_count === 1) {
        return function(token, data) {
          const field = fields[0].field;
          return scoreValue(getAttrFn(data, field), token, weights[field] || 1);
        };
      }
      return function(token, data) {
        var sum = 0;
        if (token.field) {
          const value = getAttrFn(data, token.field);
          if (!token.regex && value) {
            sum += 1 / field_count;
          } else {
            sum += scoreValue(value, token, 1);
          }
        } else {
          iterate(weights, (weight, field) => {
            sum += scoreValue(getAttrFn(data, field), token, weight);
          });
        }
        return sum / field_count;
      };
    })();
    if (token_count === 1) {
      return function(data) {
        return scoreObject(tokens[0], data);
      };
    }
    if (search.options.conjunction === "and") {
      return function(data) {
        var score, sum = 0;
        for (let token of tokens) {
          score = scoreObject(token, data);
          if (score <= 0)
            return 0;
          sum += score;
        }
        return sum / token_count;
      };
    } else {
      return function(data) {
        var sum = 0;
        iterate(tokens, (token) => {
          sum += scoreObject(token, data);
        });
        return sum / token_count;
      };
    }
  }
  /**
   * Returns a function that can be used to compare two
   * results, for sorting purposes. If no sorting should
   * be performed, `null` will be returned.
   *
   * @return function(a,b)
   */
  getSortFunction(query, options) {
    var search = this.prepareSearch(query, options);
    return this._getSortFunction(search);
  }
  _getSortFunction(search) {
    var implicit_score, sort_flds = [];
    const self2 = this, options = search.options, sort = !search.query && options.sort_empty ? options.sort_empty : options.sort;
    if (typeof sort == "function") {
      return sort.bind(this);
    }
    const get_field = function(name, result) {
      if (name === "$score")
        return result.score;
      return search.getAttrFn(self2.items[result.id], name);
    };
    if (sort) {
      for (let s2 of sort) {
        if (search.query || s2.field !== "$score") {
          sort_flds.push(s2);
        }
      }
    }
    if (search.query) {
      implicit_score = true;
      for (let fld of sort_flds) {
        if (fld.field === "$score") {
          implicit_score = false;
          break;
        }
      }
      if (implicit_score) {
        sort_flds.unshift({ field: "$score", direction: "desc" });
      }
    } else {
      sort_flds = sort_flds.filter((fld) => fld.field !== "$score");
    }
    const sort_flds_count = sort_flds.length;
    if (!sort_flds_count) {
      return null;
    }
    return function(a3, b4) {
      var result, field;
      for (let sort_fld of sort_flds) {
        field = sort_fld.field;
        let multiplier = sort_fld.direction === "desc" ? -1 : 1;
        result = multiplier * cmp(get_field(field, a3), get_field(field, b4));
        if (result)
          return result;
      }
      return 0;
    };
  }
  /**
   * Parses a search query and returns an object
   * with tokens and fields ready to be populated
   * with results.
   *
   */
  prepareSearch(query, optsUser) {
    const weights = {};
    var options = Object.assign({}, optsUser);
    propToArray(options, "sort");
    propToArray(options, "sort_empty");
    if (options.fields) {
      propToArray(options, "fields");
      const fields = [];
      options.fields.forEach((field) => {
        if (typeof field == "string") {
          field = { field, weight: 1 };
        }
        fields.push(field);
        weights[field.field] = "weight" in field ? field.weight : 1;
      });
      options.fields = fields;
    }
    return {
      options,
      query: query.toLowerCase().trim(),
      tokens: this.tokenize(query, options.respect_word_boundaries, weights),
      total: 0,
      items: [],
      weights,
      getAttrFn: options.nesting ? getAttrNesting : getAttr
    };
  }
  /**
   * Searches through all items and returns a sorted array of matches.
   *
   */
  search(query, options) {
    var self2 = this, score, search;
    search = this.prepareSearch(query, options);
    options = search.options;
    query = search.query;
    const fn_score = options.score || self2._getScoreFunction(search);
    if (query.length) {
      iterate(self2.items, (item, id) => {
        score = fn_score(item);
        if (options.filter === false || score > 0) {
          search.items.push({ "score": score, "id": id });
        }
      });
    } else {
      iterate(self2.items, (_3, id) => {
        search.items.push({ "score": 1, "id": id });
      });
    }
    const fn_sort = self2._getSortFunction(search);
    if (fn_sort)
      search.items.sort(fn_sort);
    search.total = search.items.length;
    if (typeof options.limit === "number") {
      search.items = search.items.slice(0, options.limit);
    }
    return search;
  }
};

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/utils.js
var hash_key = (value) => {
  if (typeof value === "undefined" || value === null)
    return null;
  return get_hash(value);
};
var get_hash = (value) => {
  if (typeof value === "boolean")
    return value ? "1" : "0";
  return value + "";
};
var escape_html = (str) => {
  return (str + "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};
var timeout = (fn2, timeout2) => {
  if (timeout2 > 0) {
    return window.setTimeout(fn2, timeout2);
  }
  fn2.call(null);
  return null;
};
var loadDebounce = (fn2, delay) => {
  var timeout2;
  return function(value, callback) {
    var self2 = this;
    if (timeout2) {
      self2.loading = Math.max(self2.loading - 1, 0);
      clearTimeout(timeout2);
    }
    timeout2 = setTimeout(function() {
      timeout2 = null;
      self2.loadedSearches[value] = true;
      fn2.call(self2, value, callback);
    }, delay);
  };
};
var debounce_events = (self2, types, fn2) => {
  var type;
  var trigger = self2.trigger;
  var event_args = {};
  self2.trigger = function() {
    var type2 = arguments[0];
    if (types.indexOf(type2) !== -1) {
      event_args[type2] = arguments;
    } else {
      return trigger.apply(self2, arguments);
    }
  };
  fn2.apply(self2, []);
  self2.trigger = trigger;
  for (type of types) {
    if (type in event_args) {
      trigger.apply(self2, event_args[type]);
    }
  }
};
var getSelection = (input) => {
  return {
    start: input.selectionStart || 0,
    length: (input.selectionEnd || 0) - (input.selectionStart || 0)
  };
};
var preventDefault = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var addEvent = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
var isKeyDown = (key_name, evt) => {
  if (!evt) {
    return false;
  }
  if (!evt[key_name]) {
    return false;
  }
  var count = (evt.altKey ? 1 : 0) + (evt.ctrlKey ? 1 : 0) + (evt.shiftKey ? 1 : 0) + (evt.metaKey ? 1 : 0);
  if (count === 1) {
    return true;
  }
  return false;
};
var getId = (el, id) => {
  const existing_id = el.getAttribute("id");
  if (existing_id) {
    return existing_id;
  }
  el.setAttribute("id", id);
  return id;
};
var addSlashes = (str) => {
  return str.replace(/[\\"']/g, "\\$&");
};
var append = (parent, node) => {
  if (node)
    parent.append(node);
};
var iterate2 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/vanilla.js
var getDom = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
var escapeQuery = (query) => {
  return query.replace(/['"\\]/g, "\\$&");
};
var triggerEvent = (dom_el, event_name) => {
  var event = document.createEvent("HTMLEvents");
  event.initEvent(event_name, true, false);
  dom_el.dispatchEvent(event);
};
var applyCSS = (dom_el, css) => {
  Object.assign(dom_el.style, css);
};
var addClasses = (elmts, ...classes) => {
  var norm_classes = classesArray(classes);
  elmts = castAsArray(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.add(cls);
    });
  });
};
var removeClasses = (elmts, ...classes) => {
  var norm_classes = classesArray(classes);
  elmts = castAsArray(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.remove(cls);
    });
  });
};
var classesArray = (args) => {
  var classes = [];
  iterate2(args, (_classes) => {
    if (typeof _classes === "string") {
      _classes = _classes.trim().split(/[\t\n\f\r\s]/);
    }
    if (Array.isArray(_classes)) {
      classes = classes.concat(_classes);
    }
  });
  return classes.filter(Boolean);
};
var castAsArray = (arg) => {
  if (!Array.isArray(arg)) {
    arg = [arg];
  }
  return arg;
};
var parentMatch = (target, selector, wrapper) => {
  if (wrapper && !wrapper.contains(target)) {
    return;
  }
  while (target && target.matches) {
    if (target.matches(selector)) {
      return target;
    }
    target = target.parentNode;
  }
};
var getTail = (list, direction = 0) => {
  if (direction > 0) {
    return list[list.length - 1];
  }
  return list[0];
};
var isEmptyObject = (obj) => {
  return Object.keys(obj).length === 0;
};
var nodeIndex = (el, amongst) => {
  if (!el)
    return -1;
  amongst = amongst || el.nodeName;
  var i2 = 0;
  while (el = el.previousElementSibling) {
    if (el.matches(amongst)) {
      i2++;
    }
  }
  return i2;
};
var setAttr = (el, attrs) => {
  iterate2(attrs, (val, attr) => {
    if (val == null) {
      el.removeAttribute(attr);
    } else {
      el.setAttribute(attr, "" + val);
    }
  });
};
var replaceNode = (existing, replacement) => {
  if (existing.parentNode)
    existing.parentNode.replaceChild(replacement, existing);
};

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/contrib/highlight.js
var highlight = (element, regex) => {
  if (regex === null)
    return;
  if (typeof regex === "string") {
    if (!regex.length)
      return;
    regex = new RegExp(regex, "i");
  }
  const highlightText = (node) => {
    var match = node.data.match(regex);
    if (match && node.data.length > 0) {
      var spannode = document.createElement("span");
      spannode.className = "highlight";
      var middlebit = node.splitText(match.index);
      middlebit.splitText(match[0].length);
      var middleclone = middlebit.cloneNode(true);
      spannode.appendChild(middleclone);
      replaceNode(middlebit, spannode);
      return 1;
    }
    return 0;
  };
  const highlightChildren = (node) => {
    if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName) && (node.className !== "highlight" || node.tagName !== "SPAN")) {
      Array.from(node.childNodes).forEach((element2) => {
        highlightRecursive(element2);
      });
    }
  };
  const highlightRecursive = (node) => {
    if (node.nodeType === 3) {
      return highlightText(node);
    }
    highlightChildren(node);
    return 0;
  };
  highlightRecursive(element);
};
var removeHighlight = (el) => {
  var elements2 = el.querySelectorAll("span.highlight");
  Array.prototype.forEach.call(elements2, function(el2) {
    var parent = el2.parentNode;
    parent.replaceChild(el2.firstChild, el2);
    parent.normalize();
  });
};

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/constants.js
var KEY_A = 65;
var KEY_RETURN = 13;
var KEY_ESC = 27;
var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;
var KEY_BACKSPACE = 8;
var KEY_DELETE = 46;
var KEY_TAB = 9;
var IS_MAC = typeof navigator === "undefined" ? false : /Mac/.test(navigator.userAgent);
var KEY_SHORTCUT = IS_MAC ? "metaKey" : "ctrlKey";

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/defaults.js
var defaults_default = {
  options: [],
  optgroups: [],
  plugins: [],
  delimiter: ",",
  splitOn: null,
  // regexp or string for splitting up values from a paste command
  persist: true,
  diacritics: true,
  create: null,
  createOnBlur: false,
  createFilter: null,
  clearAfterSelect: false,
  highlight: true,
  openOnFocus: true,
  shouldOpen: null,
  maxOptions: 50,
  maxItems: null,
  hideSelected: null,
  duplicates: false,
  addPrecedence: false,
  selectOnTab: false,
  preload: null,
  allowEmptyOption: false,
  //closeAfterSelect: false,
  refreshThrottle: 300,
  loadThrottle: 300,
  loadingClass: "loading",
  dataAttr: null,
  //'data-data',
  optgroupField: "optgroup",
  valueField: "value",
  labelField: "text",
  disabledField: "disabled",
  optgroupLabelField: "label",
  optgroupValueField: "value",
  lockOptgroupOrder: false,
  sortField: "$order",
  searchField: ["text"],
  searchConjunction: "and",
  mode: null,
  wrapperClass: "ts-wrapper",
  controlClass: "ts-control",
  dropdownClass: "ts-dropdown",
  dropdownContentClass: "ts-dropdown-content",
  itemClass: "item",
  optionClass: "option",
  dropdownParent: null,
  controlInput: '<input type="text" autocomplete="off" size="1" />',
  copyClassesToDropdown: false,
  placeholder: null,
  hidePlaceholder: null,
  shouldLoad: function(query) {
    return query.length > 0;
  },
  /*
  load                 : null, // function(query, callback) { ... }
  score                : null, // function(search) { ... }
  onInitialize         : null, // function() { ... }
  onChange             : null, // function(value) { ... }
  onItemAdd            : null, // function(value, $item) { ... }
  onItemRemove         : null, // function(value) { ... }
  onClear              : null, // function() { ... }
  onOptionAdd          : null, // function(value, data) { ... }
  onOptionRemove       : null, // function(value) { ... }
  onOptionClear        : null, // function() { ... }
  onOptionGroupAdd     : null, // function(id, data) { ... }
  onOptionGroupRemove  : null, // function(id) { ... }
  onOptionGroupClear   : null, // function() { ... }
  onDropdownOpen       : null, // function(dropdown) { ... }
  onDropdownClose      : null, // function(dropdown) { ... }
  onType               : null, // function(str) { ... }
  onDelete             : null, // function(values) { ... }
  */
  render: {
    /*
    item: null,
    optgroup: null,
    optgroup_header: null,
    option: null,
    option_create: null
    */
  }
};

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/getSettings.js
function getSettings(input, settings_user) {
  var settings = Object.assign({}, defaults_default, settings_user);
  var attr_data = settings.dataAttr;
  var field_label = settings.labelField;
  var field_value = settings.valueField;
  var field_disabled = settings.disabledField;
  var field_optgroup = settings.optgroupField;
  var field_optgroup_label = settings.optgroupLabelField;
  var field_optgroup_value = settings.optgroupValueField;
  var tag_name = input.tagName.toLowerCase();
  var placeholder = input.getAttribute("placeholder") || input.getAttribute("data-placeholder");
  if (!placeholder && !settings.allowEmptyOption) {
    let option2 = input.querySelector('option[value=""]');
    if (option2) {
      placeholder = option2.textContent;
    }
  }
  var settings_element = {
    placeholder,
    options: [],
    optgroups: [],
    items: [],
    maxItems: null
  };
  var init_select = () => {
    var tagName;
    var options = settings_element.options;
    var optionsMap = {};
    var group_count = 1;
    let $order = 0;
    var readData = (el) => {
      var data = Object.assign({}, el.dataset);
      var json = attr_data && data[attr_data];
      if (typeof json === "string" && json.length) {
        data = Object.assign(data, JSON.parse(json));
      }
      return data;
    };
    var addOption = (option2, group) => {
      var value = hash_key(option2.value);
      if (value == null)
        return;
      if (!value && !settings.allowEmptyOption)
        return;
      if (optionsMap.hasOwnProperty(value)) {
        if (group) {
          var arr = optionsMap[value][field_optgroup];
          if (!arr) {
            optionsMap[value][field_optgroup] = group;
          } else if (!Array.isArray(arr)) {
            optionsMap[value][field_optgroup] = [arr, group];
          } else {
            arr.push(group);
          }
        }
      } else {
        var option_data = readData(option2);
        option_data[field_label] = option_data[field_label] || option2.textContent;
        option_data[field_value] = option_data[field_value] || value;
        option_data[field_disabled] = option_data[field_disabled] || option2.disabled;
        option_data[field_optgroup] = option_data[field_optgroup] || group;
        option_data.$option = option2;
        option_data.$order = option_data.$order || ++$order;
        optionsMap[value] = option_data;
        options.push(option_data);
      }
      if (option2.selected) {
        settings_element.items.push(value);
      }
    };
    var addGroup = (optgroup) => {
      var id, optgroup_data;
      optgroup_data = readData(optgroup);
      optgroup_data[field_optgroup_label] = optgroup_data[field_optgroup_label] || optgroup.getAttribute("label") || "";
      optgroup_data[field_optgroup_value] = optgroup_data[field_optgroup_value] || group_count++;
      optgroup_data[field_disabled] = optgroup_data[field_disabled] || optgroup.disabled;
      optgroup_data.$order = optgroup_data.$order || ++$order;
      settings_element.optgroups.push(optgroup_data);
      id = optgroup_data[field_optgroup_value];
      iterate2(optgroup.children, (option2) => {
        addOption(option2, id);
      });
    };
    settings_element.maxItems = input.hasAttribute("multiple") ? null : 1;
    iterate2(input.children, (child) => {
      tagName = child.tagName.toLowerCase();
      if (tagName === "optgroup") {
        addGroup(child);
      } else if (tagName === "option") {
        addOption(child);
      }
    });
  };
  var init_textbox = () => {
    var _a2, _b;
    const data_raw = input.getAttribute(attr_data);
    if (!data_raw) {
      var value = (_b = (_a2 = input === null || input === void 0 ? void 0 : input.value) === null || _a2 === void 0 ? void 0 : _a2.trim()) !== null && _b !== void 0 ? _b : "";
      if (!settings.allowEmptyOption && !value.length)
        return;
      const values = value.split(settings.delimiter);
      iterate2(values, (value2) => {
        const option2 = {};
        option2[field_label] = value2;
        option2[field_value] = value2;
        settings_element.options.push(option2);
      });
      settings_element.items = values;
    } else {
      settings_element.options = JSON.parse(data_raw);
      iterate2(settings_element.options, (opt) => {
        settings_element.items.push(opt[field_value]);
      });
    }
  };
  if (tag_name === "select") {
    init_select();
  } else {
    init_textbox();
  }
  return Object.assign({}, defaults_default, settings_element, settings_user);
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/tom-select.js
var instance_i = 0;
var TomSelect = class extends MicroPlugin(MicroEvent) {
  constructor(input_arg, user_settings) {
    super();
    this.order = 0;
    this.isOpen = false;
    this.isDisabled = false;
    this.isReadOnly = false;
    this.isInvalid = false;
    this.isValid = true;
    this.isLocked = false;
    this.isFocused = false;
    this.isInputHidden = false;
    this.isSetup = false;
    this.isDropdownContentStale = true;
    this.ignoreFocus = false;
    this.ignoreHover = false;
    this.hasOptions = false;
    this.lastValue = "";
    this.caretPos = 0;
    this.loading = 0;
    this.loadedSearches = {};
    this.activeOption = null;
    this.activeItems = [];
    this.optgroups = {};
    this.options = {};
    this.userOptions = {};
    this.items = [];
    this.refreshTimeout = null;
    instance_i++;
    var dir;
    var input = getDom(input_arg);
    if (input.tomselect) {
      throw new Error("Tom Select already initialized on this element");
    }
    input.tomselect = this;
    var computedStyle = window.getComputedStyle && window.getComputedStyle(input, null);
    dir = computedStyle.getPropertyValue("direction");
    const settings = getSettings(input, user_settings);
    this.settings = settings;
    this.input = input;
    this.tabIndex = input.tabIndex || 0;
    this.is_select_tag = input.tagName.toLowerCase() === "select";
    this.rtl = /rtl/i.test(dir);
    this.inputId = getId(input, "tomselect-" + instance_i);
    this.isRequired = input.required;
    this.sifter = new Sifter(this.options, { diacritics: settings.diacritics });
    settings.mode = settings.mode || (settings.maxItems === 1 ? "single" : "multi");
    if (typeof settings.hideSelected !== "boolean") {
      settings.hideSelected = settings.mode === "multi";
    }
    if (typeof settings.hidePlaceholder !== "boolean") {
      settings.hidePlaceholder = settings.mode !== "multi";
    }
    var filter = settings.createFilter;
    if (typeof filter !== "function") {
      if (typeof filter === "string") {
        filter = new RegExp(filter);
      }
      if (filter instanceof RegExp) {
        settings.createFilter = (input2) => filter.test(input2);
      } else {
        settings.createFilter = (value) => {
          return this.settings.duplicates || !this.options[value];
        };
      }
    }
    this.initializePlugins(settings.plugins);
    this.setupCallbacks();
    this.setupTemplates();
    const wrapper = getDom("<div>");
    const control = getDom("<div>");
    const dropdown = this._render("dropdown");
    const dropdown_content = getDom(`<div role="listbox" tabindex="-1">`);
    const classes = this.input.getAttribute("class") || "";
    const inputMode = settings.mode;
    var control_input;
    addClasses(wrapper, settings.wrapperClass, classes, inputMode);
    addClasses(control, settings.controlClass);
    append(wrapper, control);
    addClasses(dropdown, settings.dropdownClass, inputMode);
    if (settings.copyClassesToDropdown) {
      addClasses(dropdown, classes);
    }
    addClasses(dropdown_content, settings.dropdownContentClass);
    append(dropdown, dropdown_content);
    getDom(settings.dropdownParent || wrapper).appendChild(dropdown);
    if (isHtmlString(settings.controlInput)) {
      control_input = getDom(settings.controlInput);
      var attrs = ["autocorrect", "autocapitalize", "autocomplete", "spellcheck", "aria-label"];
      iterate2(attrs, (attr) => {
        if (input.getAttribute(attr)) {
          setAttr(control_input, { [attr]: input.getAttribute(attr) });
        }
      });
      control_input.tabIndex = -1;
      control.appendChild(control_input);
      this.focus_node = control_input;
    } else if (settings.controlInput) {
      control_input = getDom(settings.controlInput);
      this.focus_node = control_input;
    } else {
      control_input = getDom("<input/>");
      this.focus_node = control;
    }
    this.wrapper = wrapper;
    this.dropdown = dropdown;
    this.dropdown_content = dropdown_content;
    this.control = control;
    this.control_input = control_input;
    this.setup();
  }
  /**
   * set up event bindings.
   *
   */
  setup() {
    const self2 = this;
    const settings = self2.settings;
    const control_input = self2.control_input;
    const dropdown = self2.dropdown;
    const dropdown_content = self2.dropdown_content;
    const wrapper = self2.wrapper;
    const control = self2.control;
    const input = self2.input;
    const focus_node = self2.focus_node;
    const passive_event = { passive: true };
    const listboxId = self2.inputId + "-ts-dropdown";
    setAttr(dropdown_content, {
      id: listboxId
    });
    setAttr(focus_node, {
      role: "combobox",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
      "aria-controls": listboxId
    });
    const control_id = getId(focus_node, self2.inputId + "-ts-control");
    const query = "label[for='" + escapeQuery(self2.inputId) + "']";
    const label = document.querySelector(query);
    const label_click = self2.focus.bind(self2);
    if (label) {
      addEvent(label, "click", label_click);
      setAttr(label, { for: control_id });
      const label_id = getId(label, self2.inputId + "-ts-label");
      setAttr(focus_node, { "aria-labelledby": label_id });
      setAttr(dropdown_content, { "aria-labelledby": label_id });
    }
    wrapper.style.width = input.style.width;
    wrapper.style.minWidth = input.style.minWidth;
    wrapper.style.maxWidth = input.style.maxWidth;
    if (self2.plugins.names.length) {
      const classes_plugins = "plugin-" + self2.plugins.names.join(" plugin-");
      addClasses([wrapper, dropdown], classes_plugins);
    }
    if ((settings.maxItems === null || settings.maxItems > 1) && self2.is_select_tag) {
      setAttr(input, { multiple: "multiple" });
    }
    if (settings.placeholder) {
      setAttr(control_input, { placeholder: settings.placeholder });
    }
    if (!settings.splitOn && settings.delimiter) {
      settings.splitOn = new RegExp("\\s*" + escape_regex(settings.delimiter) + "+\\s*");
    }
    if (settings.load && settings.loadThrottle) {
      settings.load = loadDebounce(settings.load, settings.loadThrottle);
    }
    addEvent(dropdown, "mousemove", () => {
      self2.ignoreHover = false;
    });
    addEvent(dropdown, "mouseenter", (e2) => {
      var target_match = parentMatch(e2.target, "[data-selectable]", dropdown);
      if (target_match)
        self2.onOptionHover(e2, target_match);
    }, { capture: true });
    addEvent(dropdown, "click", (evt) => {
      const option2 = parentMatch(evt.target, "[data-selectable]");
      if (option2) {
        self2.onOptionSelect(evt, option2);
        preventDefault(evt, true);
      }
    });
    addEvent(control, "click", (evt) => {
      var target_match = parentMatch(evt.target, "[data-ts-item]", control);
      if (target_match && self2.onItemSelect(evt, target_match)) {
        preventDefault(evt, true);
        return;
      }
      if (control_input.value != "") {
        return;
      }
      self2.onClick();
      preventDefault(evt, true);
    });
    addEvent(focus_node, "keydown", (e2) => self2.onKeyDown(e2));
    addEvent(control_input, "keypress", (e2) => self2.onKeyPress(e2));
    addEvent(control_input, "input", (e2) => self2.onInput(e2));
    addEvent(focus_node, "blur", (e2) => self2.onBlur(e2));
    addEvent(focus_node, "focus", (e2) => self2.onFocus(e2));
    addEvent(control_input, "paste", (e2) => self2.onPaste(e2));
    const doc_mousedown = (evt) => {
      const target = evt.composedPath()[0];
      if (!wrapper.contains(target) && !dropdown.contains(target)) {
        if (self2.isFocused) {
          self2.blur();
        }
        self2.inputState();
        return;
      }
      if (target == control_input && self2.isOpen) {
        evt.stopPropagation();
      } else {
        preventDefault(evt, true);
      }
    };
    const win_scroll = () => {
      if (self2.isOpen) {
        self2.positionDropdown();
      }
    };
    const input_invalid = () => {
      if (self2.isValid) {
        self2.isValid = false;
        self2.isInvalid = true;
        self2.refreshState();
      }
    };
    addEvent(input, "invalid", input_invalid);
    addEvent(document, "mousedown", doc_mousedown);
    addEvent(window, "scroll", win_scroll, passive_event);
    addEvent(window, "resize", win_scroll, passive_event);
    this._destroy = () => {
      input.removeEventListener("invalid", input_invalid);
      document.removeEventListener("mousedown", doc_mousedown);
      window.removeEventListener("scroll", win_scroll);
      window.removeEventListener("resize", win_scroll);
      if (label)
        label.removeEventListener("click", label_click);
    };
    this.revertSettings = {
      innerHTML: input.innerHTML,
      tabIndex: input.tabIndex
    };
    input.tabIndex = -1;
    input.insertAdjacentElement("afterend", self2.wrapper);
    self2.sync(false);
    settings.items = [];
    delete settings.optgroups;
    delete settings.options;
    self2.refreshItems();
    self2.close(false);
    self2.inputState();
    self2.isSetup = true;
    self2.on("change", this.onChange);
    addClasses(input, "tomselected", "ts-hidden-accessible");
    self2.trigger("initialize");
    if (settings.preload === true) {
      self2.preload();
    }
  }
  /**
   * Register options and optgroups
   *
   */
  setupOptions(options = [], optgroups = []) {
    this.addOptions(options);
    iterate2(optgroups, (optgroup) => {
      this.registerOptionGroup(optgroup);
    });
  }
  /**
   * Sets up default rendering functions.
   */
  setupTemplates() {
    var self2 = this;
    var field_label = self2.settings.labelField;
    var field_optgroup = self2.settings.optgroupLabelField;
    var templates = {
      "optgroup": (data) => {
        let optgroup = document.createElement("div");
        optgroup.className = "optgroup";
        optgroup.appendChild(data.options);
        return optgroup;
      },
      "optgroup_header": (data, escape) => {
        return '<div class="optgroup-header">' + escape(data[field_optgroup]) + "</div>";
      },
      "option": (data, escape) => {
        return "<div>" + escape(data[field_label]) + "</div>";
      },
      "item": (data, escape) => {
        return "<div>" + escape(data[field_label]) + "</div>";
      },
      "option_create": (data, escape) => {
        return '<div class="create">Add <strong>' + escape(data.input) + "</strong>&hellip;</div>";
      },
      "no_results": () => {
        return '<div class="no-results">No results found</div>';
      },
      "loading": () => {
        return '<div class="spinner"></div>';
      },
      "not_loading": () => {
      },
      "dropdown": () => {
        return "<div></div>";
      }
    };
    self2.settings.render = Object.assign({}, templates, self2.settings.render);
  }
  /**
   * Maps fired events to callbacks provided
   * in the settings used when creating the control.
   */
  setupCallbacks() {
    var key, fn2;
    var callbacks = {
      "initialize": "onInitialize",
      "change": "onChange",
      "item_add": "onItemAdd",
      "item_remove": "onItemRemove",
      "item_select": "onItemSelect",
      "clear": "onClear",
      "option_add": "onOptionAdd",
      "option_remove": "onOptionRemove",
      "option_clear": "onOptionClear",
      "optgroup_add": "onOptionGroupAdd",
      "optgroup_remove": "onOptionGroupRemove",
      "optgroup_clear": "onOptionGroupClear",
      "dropdown_open": "onDropdownOpen",
      "dropdown_close": "onDropdownClose",
      "type": "onType",
      "load": "onLoad",
      "focus": "onFocus",
      "blur": "onBlur"
    };
    for (key in callbacks) {
      fn2 = this.settings[callbacks[key]];
      if (fn2)
        this.on(key, fn2);
    }
  }
  /**
   * Sync the Tom Select instance with the original input or select
   *
   */
  sync(get_settings = true) {
    const self2 = this;
    const settings = get_settings ? getSettings(self2.input, { delimiter: self2.settings.delimiter, allowEmptyOption: self2.settings.allowEmptyOption }) : self2.settings;
    self2.setupOptions(settings.options, settings.optgroups);
    self2.setValue(settings.items || [], true);
    if (self2.input.disabled) {
      self2.disable();
    } else if (self2.input.readOnly) {
      self2.setReadOnly(true);
    } else {
      self2.enable();
    }
    self2.lastQuery = null;
  }
  /**
   * Triggered when the main control element
   * has a click event.
   *
   */
  onClick() {
    var self2 = this;
    if (self2.activeItems.length > 0) {
      self2.clearActiveItems();
      self2.focus();
      return;
    }
    if (self2.isFocused && self2.isOpen) {
      self2.blur();
    } else {
      self2.focus();
    }
  }
  /**
   * @deprecated v1.7
   *
   */
  onMouseDown() {
  }
  /**
   * Triggered when the value of the control has been changed.
   * This should propagate the event to the original DOM
   * input / select element.
   */
  onChange() {
    triggerEvent(this.input, "input");
    triggerEvent(this.input, "change");
  }
  /**
   * Triggered on <input> paste.
   *
   */
  onPaste(e2) {
    var self2 = this;
    if (self2.isInputHidden || self2.isLocked) {
      preventDefault(e2);
      return;
    }
    if (!self2.settings.splitOn) {
      return;
    }
    setTimeout(() => {
      var pastedText = self2.inputValue();
      if (!pastedText.match(self2.settings.splitOn)) {
        return;
      }
      var splitInput = pastedText.trim().split(self2.settings.splitOn);
      iterate2(splitInput, (piece) => {
        const hash2 = hash_key(piece);
        if (hash2) {
          if (this.options[piece]) {
            self2.addItem(piece);
          } else {
            self2.createItem(piece);
          }
        }
      });
    }, 0);
  }
  /**
   * Triggered on <input> keypress.
   *
   */
  onKeyPress(e2) {
    var self2 = this;
    if (self2.isLocked) {
      preventDefault(e2);
      return;
    }
    var character = String.fromCharCode(e2.keyCode || e2.which);
    if (self2.settings.create && self2.settings.mode === "multi" && character === self2.settings.delimiter) {
      self2.createItem();
      preventDefault(e2);
      return;
    }
  }
  /**
   * Triggered on <input> keydown.
   *
   */
  onKeyDown(e2) {
    var self2 = this;
    self2.ignoreHover = true;
    if (self2.isLocked) {
      if (e2.keyCode !== KEY_TAB) {
        preventDefault(e2);
      }
      return;
    }
    switch (e2.keyCode) {
      // ctrl+A: select all
      case KEY_A:
        if (isKeyDown(KEY_SHORTCUT, e2)) {
          if (self2.control_input.value == "") {
            preventDefault(e2);
            self2.selectAll();
            return;
          }
        }
        break;
      // esc: close dropdown
      case KEY_ESC:
        if (self2.isOpen) {
          preventDefault(e2, true);
          self2.close();
        }
        self2.clearActiveItems();
        return;
      // down: open dropdown or move selection down
      case KEY_DOWN:
        if (!self2.isOpen && self2.hasOptions) {
          self2.open();
        } else if (self2.activeOption) {
          let next = self2.getAdjacent(self2.activeOption, 1);
          if (next)
            self2.setActiveOption(next);
        }
        preventDefault(e2);
        return;
      // up: move selection up
      case KEY_UP:
        if (self2.activeOption) {
          let prev = self2.getAdjacent(self2.activeOption, -1);
          if (prev)
            self2.setActiveOption(prev);
        }
        preventDefault(e2);
        return;
      // return: select active option
      case KEY_RETURN:
        if (self2.canSelect(self2.activeOption)) {
          self2.onOptionSelect(e2, self2.activeOption);
          preventDefault(e2);
        } else if (self2.settings.create && self2.createItem()) {
          preventDefault(e2);
        } else if (document.activeElement == self2.control_input && self2.isOpen) {
          preventDefault(e2);
        }
        return;
      // left: modifiy item selection to the left
      case KEY_LEFT:
        self2.advanceSelection(-1, e2);
        return;
      // right: modifiy item selection to the right
      case KEY_RIGHT:
        self2.advanceSelection(1, e2);
        return;
      // tab: select active option and/or create item
      case KEY_TAB:
        if (self2.settings.selectOnTab) {
          if (self2.canSelect(self2.activeOption)) {
            self2.onOptionSelect(e2, self2.activeOption);
            preventDefault(e2);
          } else if (self2.settings.create && self2.createItem()) {
            preventDefault(e2);
          }
        }
        return;
      // delete|backspace: delete items
      case KEY_BACKSPACE:
      case KEY_DELETE:
        self2.deleteSelection(e2);
        return;
    }
    if (self2.isInputHidden && !isKeyDown(KEY_SHORTCUT, e2)) {
      preventDefault(e2);
    }
  }
  /**
   * Triggered on <input> keyup.
   *
   */
  onInput(e2) {
    if (this.isLocked) {
      return;
    }
    const value = this.inputValue();
    if (this.lastValue === value)
      return;
    this.lastValue = value;
    if (value == "") {
      this._onInput();
      return;
    }
    if (this.refreshTimeout) {
      window.clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = timeout(() => {
      this.refreshTimeout = null;
      this._onInput();
    }, this.settings.refreshThrottle);
  }
  _onInput() {
    const value = this.lastValue;
    if (this.settings.shouldLoad.call(this, value)) {
      this.load(value);
    }
    this.refreshOptions();
    this.trigger("type", value);
  }
  /**
   * Triggered when the user rolls over
   * an option in the autocomplete dropdown menu.
   *
   */
  onOptionHover(evt, option2) {
    if (this.ignoreHover)
      return;
    this.setActiveOption(option2, false);
  }
  /**
   * Triggered on <input> focus.
   *
   */
  onFocus(e2) {
    var self2 = this;
    var wasFocused = self2.isFocused;
    if (self2.isDisabled || self2.isReadOnly) {
      self2.blur();
      preventDefault(e2);
      return;
    }
    if (self2.ignoreFocus)
      return;
    self2.isFocused = true;
    if (self2.settings.preload === "focus")
      self2.preload();
    if (!wasFocused)
      self2.trigger("focus");
    if (!self2.activeItems.length) {
      self2.inputState();
      self2.refreshOptions(!!self2.settings.openOnFocus);
    }
    self2.refreshState();
  }
  /**
   * Triggered on <input> blur.
   *
   */
  onBlur(e2) {
    if (document.hasFocus() === false)
      return;
    var self2 = this;
    if (!self2.isFocused)
      return;
    self2.isFocused = false;
    self2.ignoreFocus = false;
    var deactivate = () => {
      self2.close();
      self2.setActiveItem();
      self2.setCaret(self2.items.length);
      self2.trigger("blur");
    };
    if (self2.settings.create && self2.settings.createOnBlur) {
      self2.createItem(null, deactivate);
    } else {
      deactivate();
    }
  }
  /**
   * Triggered when the user clicks on an option
   * in the autocomplete dropdown menu.
   *
   */
  onOptionSelect(evt, option2) {
    var value, self2 = this;
    if (option2.parentElement && option2.parentElement.matches("[data-disabled]")) {
      return;
    }
    if (option2.classList.contains("create")) {
      self2.createItem(null, () => {
        if (self2.settings.closeAfterSelect) {
          self2.close();
        } else if (self2.settings.clearAfterSelect) {
          self2.setTextboxValue();
        }
      });
    } else {
      value = option2.dataset.value;
      if (typeof value !== "undefined") {
        self2.isDropdownContentStale = self2.settings.hideSelected;
        self2.addItem(value);
        if (self2.settings.closeAfterSelect) {
          self2.close();
        } else if (self2.settings.clearAfterSelect) {
          self2.setTextboxValue();
        }
        if (!self2.settings.hideSelected && evt.type && /click/.test(evt.type)) {
          self2.setActiveOption(option2);
        }
      }
    }
  }
  /**
   * Return true if the given option can be selected
   *
   */
  canSelect(option2) {
    if (this.isOpen && option2 && this.dropdown_content.contains(option2)) {
      return true;
    }
    return false;
  }
  /**
   * Triggered when the user clicks on an item
   * that has been selected.
   *
   */
  onItemSelect(evt, item) {
    var self2 = this;
    if (!self2.isLocked && self2.settings.mode === "multi") {
      preventDefault(evt);
      self2.setActiveItem(item, evt);
      return true;
    }
    return false;
  }
  /**
   * Determines whether or not to invoke
   * the user-provided option provider / loader
   *
   * Note, there is a subtle difference between
   * this.canLoad() and this.settings.shouldLoad();
   *
   *	- settings.shouldLoad() is a user-input validator.
   *	When false is returned, the not_loading template
   *	will be added to the dropdown
   *
   *	- canLoad() is lower level validator that checks
   * 	the Tom Select instance. There is no inherent user
   *	feedback when canLoad returns false
   *
   */
  canLoad(value) {
    if (!this.settings.load)
      return false;
    if (this.loadedSearches.hasOwnProperty(value))
      return false;
    return true;
  }
  /**
   * Invokes the user-provided option provider / loader.
   *
   */
  load(value) {
    const self2 = this;
    if (!self2.canLoad(value))
      return;
    addClasses(self2.wrapper, self2.settings.loadingClass);
    self2.loading++;
    const callback = self2.loadCallback.bind(self2);
    self2.settings.load.call(self2, value, callback);
  }
  /**
   * Invoked by the user-provided option provider
   *
   */
  loadCallback(options, optgroups) {
    const self2 = this;
    self2.loading = Math.max(self2.loading - 1, 0);
    self2.isDropdownContentStale = true;
    self2.clearActiveOption();
    self2.setupOptions(options, optgroups);
    self2.refreshOptions(self2.isFocused && !self2.isInputHidden);
    if (!self2.loading) {
      removeClasses(self2.wrapper, self2.settings.loadingClass);
    }
    self2.trigger("load", options, optgroups);
  }
  preload() {
    var classList = this.wrapper.classList;
    if (classList.contains("preloaded"))
      return;
    classList.add("preloaded");
    this.load("");
  }
  /**
   * Sets the input field of the control to the specified value.
   *
   */
  setTextboxValue(value = "") {
    var input = this.control_input;
    var changed = input.value !== value;
    if (changed) {
      input.value = value;
      triggerEvent(input, "update");
      this.lastValue = value;
    }
  }
  /**
   * Returns the value of the control. If multiple items
   * can be selected (e.g. <select multiple>), this returns
   * an array. If only one item can be selected, this
   * returns a string.
   *
   */
  getValue() {
    if (this.is_select_tag && this.input.hasAttribute("multiple")) {
      return this.items;
    }
    return this.items.join(this.settings.delimiter);
  }
  /**
   * Resets the selected items to the given value.
   *
   */
  setValue(value, silent) {
    var events = silent ? [] : ["change"];
    debounce_events(this, events, () => {
      this.clear(silent);
      this.addItems(value, silent);
    });
  }
  /**
   * Resets the number of max items to the given value
   *
   */
  setMaxItems(value) {
    if (value === 0)
      value = null;
    this.settings.maxItems = value;
    this.refreshState();
  }
  /**
   * Sets the selected item.
   *
   */
  setActiveItem(item, e2) {
    var self2 = this;
    var eventName;
    var i2, begin, end2, swap;
    var last;
    if (self2.settings.mode === "single")
      return;
    if (!item) {
      self2.clearActiveItems();
      if (self2.isFocused) {
        self2.inputState();
      }
      return;
    }
    eventName = e2 && e2.type.toLowerCase();
    if (eventName === "click" && isKeyDown("shiftKey", e2) && self2.activeItems.length) {
      last = self2.getLastActive();
      begin = Array.prototype.indexOf.call(self2.control.children, last);
      end2 = Array.prototype.indexOf.call(self2.control.children, item);
      if (begin > end2) {
        swap = begin;
        begin = end2;
        end2 = swap;
      }
      for (i2 = begin; i2 <= end2; i2++) {
        item = self2.control.children[i2];
        if (self2.activeItems.indexOf(item) === -1) {
          self2.setActiveItemClass(item);
        }
      }
      preventDefault(e2);
    } else if (eventName === "click" && isKeyDown(KEY_SHORTCUT, e2) || eventName === "keydown" && isKeyDown("shiftKey", e2)) {
      if (item.classList.contains("active")) {
        self2.removeActiveItem(item);
      } else {
        self2.setActiveItemClass(item);
      }
    } else {
      self2.clearActiveItems();
      self2.setActiveItemClass(item);
    }
    self2.inputState();
    if (!self2.isFocused) {
      self2.focus();
    }
  }
  /**
   * Set the active and last-active classes
   *
   */
  setActiveItemClass(item) {
    const self2 = this;
    const last_active = self2.control.querySelector(".last-active");
    if (last_active)
      removeClasses(last_active, "last-active");
    addClasses(item, "active last-active");
    self2.trigger("item_select", item);
    if (self2.activeItems.indexOf(item) == -1) {
      self2.activeItems.push(item);
    }
  }
  /**
   * Remove active item
   *
   */
  removeActiveItem(item) {
    var idx = this.activeItems.indexOf(item);
    this.activeItems.splice(idx, 1);
    removeClasses(item, "active");
  }
  /**
   * Clears all the active items
   *
   */
  clearActiveItems() {
    removeClasses(this.activeItems, "active");
    this.activeItems = [];
  }
  /**
   * Sets the selected item in the dropdown menu
   * of available options.
   *
   */
  setActiveOption(option2, scroll = true) {
    if (option2 === this.activeOption) {
      return;
    }
    this.clearActiveOption();
    if (!option2)
      return;
    this.activeOption = option2;
    setAttr(this.focus_node, { "aria-activedescendant": option2.getAttribute("id") });
    setAttr(option2, { "aria-selected": "true" });
    addClasses(option2, "active");
    if (scroll)
      this.scrollToOption(option2);
  }
  /**
   * Sets the dropdown_content scrollTop to display the option
   *
   */
  scrollToOption(option2, behavior) {
    if (!option2)
      return;
    const content = this.dropdown_content;
    const height_menu = content.clientHeight;
    const scrollTop = content.scrollTop || 0;
    const height_item = option2.offsetHeight;
    const y4 = option2.getBoundingClientRect().top - content.getBoundingClientRect().top + scrollTop;
    if (y4 + height_item > height_menu + scrollTop) {
      this.scroll(y4 - height_menu + height_item, behavior);
    } else if (y4 < scrollTop) {
      this.scroll(y4, behavior);
    }
  }
  /**
   * Scroll the dropdown to the given position
   *
   */
  scroll(scrollTop, behavior) {
    const content = this.dropdown_content;
    if (behavior) {
      content.style.scrollBehavior = behavior;
    }
    content.scrollTop = scrollTop;
    content.style.scrollBehavior = "";
  }
  /**
   * Clears the active option
   *
   */
  clearActiveOption() {
    if (this.activeOption) {
      removeClasses(this.activeOption, "active");
      setAttr(this.activeOption, { "aria-selected": null });
    }
    this.activeOption = null;
    setAttr(this.focus_node, { "aria-activedescendant": null });
  }
  /**
   * Selects all items (CTRL + A).
   */
  selectAll() {
    const self2 = this;
    if (self2.settings.mode === "single")
      return;
    const activeItems = self2.controlChildren();
    if (!activeItems.length)
      return;
    self2.inputState();
    self2.close();
    self2.activeItems = activeItems;
    iterate2(activeItems, (item) => {
      self2.setActiveItemClass(item);
    });
  }
  /**
   * Determines if the control_input should be in a hidden or visible state
   *
   */
  inputState() {
    var self2 = this;
    if (!self2.control.contains(self2.control_input))
      return;
    setAttr(self2.control_input, { placeholder: self2.settings.placeholder });
    if (self2.activeItems.length > 0 || !self2.isFocused && self2.settings.hidePlaceholder && self2.items.length > 0) {
      self2.setTextboxValue();
      self2.isInputHidden = true;
    } else {
      if (self2.settings.hidePlaceholder && self2.items.length > 0) {
        setAttr(self2.control_input, { placeholder: "" });
      }
      self2.isInputHidden = false;
    }
    self2.wrapper.classList.toggle("input-hidden", self2.isInputHidden);
  }
  /**
   * Get the input value
   */
  inputValue() {
    return this.control_input.value.trim();
  }
  /**
   * Gives the control focus.
   */
  focus() {
    var self2 = this;
    if (self2.isDisabled || self2.isReadOnly)
      return;
    self2.ignoreFocus = true;
    const focusTarget = this.control_input.offsetWidth ? this.control_input : this.focus_node;
    focusTarget.focus();
    setTimeout(() => {
      self2.ignoreFocus = false;
      const root = focusTarget.getRootNode();
      if (root.activeElement !== focusTarget) {
        return;
      }
      this.onFocus();
    }, 0);
  }
  /**
   * Forces the control out of focus.
   *
   */
  blur() {
    this.focus_node.blur();
    this.onBlur();
  }
  /**
   * Returns a function that scores an object
   * to show how good of a match it is to the
   * provided query.
   *
   * @return {function}
   */
  getScoreFunction(query) {
    return this.sifter.getScoreFunction(query, this.getSearchOptions());
  }
  /**
   * Returns search options for sifter (the system
   * for scoring and sorting results).
   *
   * @see https://github.com/orchidjs/sifter.js
   * @return {object}
   */
  getSearchOptions() {
    var settings = this.settings;
    var sort = settings.sortField;
    if (typeof settings.sortField === "string") {
      sort = [{ field: settings.sortField }];
    }
    return {
      fields: settings.searchField,
      conjunction: settings.searchConjunction,
      sort,
      nesting: settings.nesting
    };
  }
  /**
   * Searches through available options and returns
   * a sorted array of matches.
   *
   */
  search(query) {
    var result, calculateScore;
    var self2 = this;
    var options = this.getSearchOptions();
    if (self2.settings.score) {
      calculateScore = self2.settings.score.call(self2, query);
      if (typeof calculateScore !== "function") {
        throw new Error('Tom Select "score" setting must be a function that returns a function');
      }
    }
    if (self2.isDropdownContentStale || query !== self2.lastQuery) {
      self2.lastQuery = query;
      if (/(.)\1{15,}/.test(query)) {
        query = "";
      }
      result = self2.sifter.search(query, Object.assign(options, { score: calculateScore }));
      self2.currentResults = result;
    } else {
      result = Object.assign({}, self2.currentResults);
    }
    if (self2.settings.hideSelected) {
      result.items = result.items.filter((item) => {
        let hashed = hash_key(item.id);
        return !(hashed !== null && self2.items.indexOf(hashed) !== -1);
      });
    }
    return result;
  }
  /**
   * Refreshes the list of available options shown
   * in the autocomplete dropdown menu.
   *
   */
  refreshOptions(triggerDropdown = true) {
    var i2, j2, k, n2, optgroup, optgroups, html, has_create_option, active_group;
    var create;
    const groups = {};
    const groups_order = [];
    var self2 = this;
    var query = self2.inputValue();
    const same_query = query === self2.lastQuery || query == "" && self2.lastQuery == null;
    var results = self2.search(query);
    var active_option = null;
    var show_dropdown = self2.settings.shouldOpen || false;
    var dropdown_content = self2.dropdown_content;
    if (same_query) {
      active_option = self2.activeOption;
      if (active_option) {
        active_group = active_option.closest("[data-group]");
      }
    }
    n2 = results.items.length;
    if (typeof self2.settings.maxOptions === "number") {
      n2 = Math.min(n2, self2.settings.maxOptions);
    }
    if (n2 > 0) {
      show_dropdown = true;
    }
    const getGroupFragment = (optgroup2, order2) => {
      let group_order_i = groups[optgroup2];
      if (group_order_i !== void 0) {
        let order_group = groups_order[group_order_i];
        if (order_group !== void 0) {
          return [group_order_i, order_group.fragment];
        }
      }
      let group_fragment = document.createDocumentFragment();
      group_order_i = groups_order.length;
      groups_order.push({ fragment: group_fragment, order: order2, optgroup: optgroup2 });
      return [group_order_i, group_fragment];
    };
    for (i2 = 0; i2 < n2; i2++) {
      let item = results.items[i2];
      if (!item)
        continue;
      let opt_value = item.id;
      let option2 = self2.options[opt_value];
      if (option2 === void 0)
        continue;
      let opt_hash = get_hash(opt_value);
      let option_el = self2.getOption(opt_hash, true);
      if (!self2.settings.hideSelected) {
        option_el.classList.toggle("selected", self2.items.includes(opt_hash));
      }
      optgroup = option2[self2.settings.optgroupField] || "";
      optgroups = Array.isArray(optgroup) ? optgroup : [optgroup];
      for (j2 = 0, k = optgroups && optgroups.length; j2 < k; j2++) {
        optgroup = optgroups[j2];
        let order2 = option2.$order;
        let self_optgroup = self2.optgroups[optgroup];
        if (self_optgroup === void 0 && typeof self2.settings.optionGroupRegister === "function") {
          var regGroup;
          if (regGroup = self2.settings.optionGroupRegister.apply(self2, [optgroup])) {
            self2.registerOptionGroup(regGroup);
          }
        }
        self_optgroup = self2.optgroups[optgroup];
        if (self_optgroup === void 0) {
          optgroup = "";
        } else {
          order2 = self_optgroup.$order;
        }
        const [group_order_i, group_fragment] = getGroupFragment(optgroup, order2);
        if (j2 > 0) {
          option_el = option_el.cloneNode(true);
          setAttr(option_el, { id: option2.$id + "-clone-" + j2, "aria-selected": null });
          option_el.classList.add("ts-cloned");
          removeClasses(option_el, "active");
          if (self2.activeOption && self2.activeOption.dataset.value == opt_value) {
            if (active_group && active_group.dataset.group === optgroup.toString()) {
              active_option = option_el;
            }
          }
        }
        group_fragment.appendChild(option_el);
        if (optgroup != "") {
          groups[optgroup] = group_order_i;
        }
      }
    }
    if (self2.settings.lockOptgroupOrder) {
      groups_order.sort((a3, b4) => {
        return a3.order - b4.order;
      });
    }
    html = document.createDocumentFragment();
    iterate2(groups_order, (group_order) => {
      let group_fragment = group_order.fragment;
      let optgroup2 = group_order.optgroup;
      if (!group_fragment || !group_fragment.children.length)
        return;
      let group_heading = self2.optgroups[optgroup2];
      if (group_heading !== void 0) {
        let group_options = document.createDocumentFragment();
        let header = self2.render("optgroup_header", group_heading);
        append(group_options, header);
        append(group_options, group_fragment);
        let group_html = self2.render("optgroup", { group: group_heading, options: group_options });
        append(html, group_html);
      } else {
        append(html, group_fragment);
      }
    });
    dropdown_content.innerHTML = "";
    append(dropdown_content, html);
    self2.isDropdownContentStale = false;
    if (self2.settings.highlight) {
      removeHighlight(dropdown_content);
      if (results.query.length && results.tokens.length) {
        iterate2(results.tokens, (tok) => {
          highlight(dropdown_content, tok.regex);
        });
      }
    }
    var add_template = (template) => {
      let content = self2.render(template, { input: query });
      if (content) {
        show_dropdown = true;
        dropdown_content.insertBefore(content, dropdown_content.firstChild);
      }
      return content;
    };
    if (self2.loading) {
      add_template("loading");
    } else if (!self2.settings.shouldLoad.call(self2, query)) {
      add_template("not_loading");
    } else if (results.items.length === 0) {
      add_template("no_results");
    }
    has_create_option = self2.canCreate(query);
    if (has_create_option) {
      create = add_template("option_create");
    }
    self2.hasOptions = results.items.length > 0 || has_create_option;
    if (show_dropdown) {
      if (results.items.length > 0) {
        if (!active_option && self2.settings.mode === "single" && self2.items[0] != void 0) {
          active_option = self2.getOption(self2.items[0]);
        }
        if (!dropdown_content.contains(active_option)) {
          let active_index = 0;
          if (create && !self2.settings.addPrecedence) {
            active_index = 1;
          }
          active_option = self2.selectable()[active_index];
        }
      } else if (create) {
        active_option = create;
      }
      if (triggerDropdown && !self2.isOpen) {
        self2.open();
        self2.scrollToOption(active_option, "auto");
      }
      self2.setActiveOption(active_option);
    } else {
      self2.clearActiveOption();
      if (triggerDropdown && self2.isOpen) {
        self2.close(false);
      }
    }
  }
  /**
   * Return list of selectable options
   *
   */
  selectable() {
    return this.dropdown_content.querySelectorAll("[data-selectable]");
  }
  /**
   * Adds an available option. If it already exists,
   * nothing will happen. Note: this does not refresh
   * the options list dropdown (use `refreshOptions`
   * for that).
   *
   * Usage:
   *
   *   this.addOption(data)
   *
   */
  addOption(data, user_created = false) {
    const self2 = this;
    if (Array.isArray(data)) {
      self2.addOptions(data, user_created);
      return false;
    }
    const key = hash_key(data[self2.settings.valueField]);
    if (key === null || self2.options.hasOwnProperty(key)) {
      self2.updateOption(data[self2.settings.valueField], data);
      return false;
    }
    data.$order = data.$order || ++self2.order;
    data.$id = self2.inputId + "-opt-" + data.$order;
    self2.options[key] = data;
    self2.isDropdownContentStale = true;
    if (user_created) {
      self2.userOptions[key] = user_created;
      self2.trigger("option_add", key, data);
    }
    return key;
  }
  /**
   * Add multiple options
   *
   */
  addOptions(data, user_created = false) {
    iterate2(data, (dat) => {
      this.addOption(dat, user_created);
    });
  }
  /**
   * @deprecated 1.7.7
   */
  registerOption(data) {
    return this.addOption(data);
  }
  /**
   * Registers an option group to the pool of option groups.
   *
   * @return {boolean|string}
   */
  registerOptionGroup(data) {
    var key = hash_key(data[this.settings.optgroupValueField]);
    if (key === null)
      return false;
    data.$order = data.$order || ++this.order;
    this.optgroups[key] = data;
    return key;
  }
  /**
   * Registers a new optgroup for options
   * to be bucketed into.
   *
   */
  addOptionGroup(id, data) {
    var hashed_id;
    data[this.settings.optgroupValueField] = id;
    if (hashed_id = this.registerOptionGroup(data)) {
      this.trigger("optgroup_add", hashed_id, data);
    }
  }
  /**
   * Removes an existing option group.
   *
   */
  removeOptionGroup(id) {
    if (this.optgroups.hasOwnProperty(id)) {
      delete this.optgroups[id];
      this.clearCache();
      this.trigger("optgroup_remove", id);
    }
  }
  /**
   * Clears all existing option groups.
   */
  clearOptionGroups() {
    this.optgroups = {};
    this.clearCache();
    this.trigger("optgroup_clear");
  }
  /**
   * Updates an option available for selection. If
   * it is visible in the selected items or options
   * dropdown, it will be re-rendered automatically.
   *
   */
  updateOption(value, data) {
    const self2 = this;
    var item_new;
    var index_item;
    const value_old = hash_key(value);
    const value_new = hash_key(data[self2.settings.valueField]);
    if (value_old === null)
      return;
    const data_old = self2.options[value_old];
    if (data_old == void 0)
      return;
    if (typeof value_new !== "string")
      throw new Error("Value must be set in option data");
    const option2 = self2.getOption(value_old);
    const item = self2.getItem(value_old);
    data.$order = data.$order || data_old.$order;
    delete self2.options[value_old];
    self2.uncacheValue(value_new);
    self2.options[value_new] = data;
    if (option2) {
      if (self2.dropdown_content.contains(option2)) {
        const option_new = self2._render("option", data);
        replaceNode(option2, option_new);
        if (self2.activeOption === option2) {
          self2.setActiveOption(option_new);
        }
      }
      option2.remove();
    }
    if (item) {
      index_item = self2.items.indexOf(value_old);
      if (index_item !== -1) {
        self2.items.splice(index_item, 1, value_new);
      }
      item_new = self2._render("item", data);
      if (item.classList.contains("active"))
        addClasses(item_new, "active");
      replaceNode(item, item_new);
    }
    self2.isDropdownContentStale = true;
  }
  /**
   * Removes a single option.
   *
   */
  removeOption(value, silent) {
    const self2 = this;
    value = get_hash(value);
    self2.uncacheValue(value);
    delete self2.userOptions[value];
    delete self2.options[value];
    self2.isDropdownContentStale = true;
    self2.trigger("option_remove", value);
    self2.removeItem(value, silent);
  }
  /**
   * Clears all options.
   */
  clearOptions(filter) {
    const boundFilter = (filter || this.clearFilter).bind(this);
    this.loadedSearches = {};
    this.userOptions = {};
    this.clearCache();
    const selected = {};
    iterate2(this.options, (option2, key) => {
      if (boundFilter(option2, key)) {
        selected[key] = option2;
      }
    });
    this.options = this.sifter.items = selected;
    this.isDropdownContentStale = true;
    this.trigger("option_clear");
  }
  /**
   * Used by clearOptions() to decide whether or not an option should be removed
   * Return true to keep an option, false to remove
   *
   */
  clearFilter(option2, value) {
    if (this.items.indexOf(value) >= 0) {
      return true;
    }
    return false;
  }
  /**
   * Returns the dom element of the option
   * matching the given value.
   *
   */
  getOption(value, create = false) {
    const hashed = hash_key(value);
    if (hashed === null)
      return null;
    const option2 = this.options[hashed];
    if (option2 != void 0) {
      if (option2.$div) {
        return option2.$div;
      }
      if (create) {
        return this._render("option", option2);
      }
    }
    return null;
  }
  /**
   * Returns the dom element of the next or previous dom element of the same type
   * Note: adjacent options may not be adjacent DOM elements (optgroups)
   *
   */
  getAdjacent(option2, direction, type = "option") {
    var self2 = this, all;
    if (!option2) {
      return null;
    }
    if (type == "item") {
      all = self2.controlChildren();
    } else {
      all = self2.dropdown_content.querySelectorAll("[data-selectable]");
    }
    for (let i2 = 0; i2 < all.length; i2++) {
      if (all[i2] != option2) {
        continue;
      }
      if (direction > 0) {
        return all[i2 + 1];
      }
      return all[i2 - 1];
    }
    return null;
  }
  /**
   * Returns the dom element of the item
   * matching the given value.
   *
   */
  getItem(item) {
    if (typeof item == "object") {
      return item;
    }
    var value = hash_key(item);
    return value !== null ? this.control.querySelector(`[data-value="${addSlashes(value)}"]`) : null;
  }
  /**
   * "Selects" multiple items at once. Adds them to the list
   * at the current caret position.
   *
   */
  addItems(values, silent) {
    var self2 = this;
    var items = Array.isArray(values) ? values : [values];
    items = items.filter((x3) => self2.items.indexOf(x3) === -1);
    const last_item = items[items.length - 1];
    items.forEach((item) => {
      self2.isPending = item !== last_item;
      self2.addItem(item, silent);
    });
  }
  /**
   * "Selects" an item. Adds it to the list
   * at the current caret position.
   *
   */
  addItem(value, silent) {
    var events = silent ? [] : ["change", "dropdown_close"];
    debounce_events(this, events, () => {
      var item, wasFull;
      const self2 = this;
      const inputMode = self2.settings.mode;
      const hashed = hash_key(value);
      if (hashed && self2.items.indexOf(hashed) !== -1) {
        if (inputMode === "single") {
          self2.close();
        }
        if (inputMode === "single" || !self2.settings.duplicates) {
          return;
        }
      }
      if (hashed === null || !self2.options.hasOwnProperty(hashed))
        return;
      if (inputMode === "single")
        self2.clear(silent);
      if (inputMode === "multi" && self2.isFull())
        return;
      item = self2._render("item", self2.options[hashed]);
      if (self2.control.contains(item)) {
        item = item.cloneNode(true);
      }
      wasFull = self2.isFull();
      self2.items.splice(self2.caretPos, 0, hashed);
      self2.insertAtCaret(item);
      if (self2.isSetup) {
        if (!self2.isPending && self2.settings.hideSelected) {
          let option2 = self2.getOption(hashed);
          let next = self2.getAdjacent(option2, 1);
          if (next) {
            self2.setActiveOption(next);
          }
        }
        if (self2.settings.clearAfterSelect) {
          self2.setTextboxValue();
        }
        if (!self2.isPending && !self2.settings.closeAfterSelect) {
          self2.refreshOptions(self2.isFocused && inputMode !== "single");
        }
        if (self2.settings.closeAfterSelect != false && self2.isFull()) {
          self2.close();
        } else if (!self2.isPending) {
          self2.positionDropdown();
        }
        self2.trigger("item_add", hashed, item);
        if (!self2.isPending) {
          self2.updateOriginalInput({ silent });
        }
      }
      if (!self2.isPending || !wasFull && self2.isFull()) {
        self2.inputState();
        self2.refreshState();
      }
    });
  }
  /**
   * Removes the selected item matching
   * the provided value.
   *
   */
  removeItem(item = null, silent) {
    const self2 = this;
    item = self2.getItem(item);
    if (!item)
      return;
    var i2, idx;
    const value = item.dataset.value;
    i2 = nodeIndex(item);
    item.remove();
    if (item.classList.contains("active")) {
      idx = self2.activeItems.indexOf(item);
      self2.activeItems.splice(idx, 1);
      removeClasses(item, "active");
    }
    self2.items.splice(i2, 1);
    self2.isDropdownContentStale = true;
    if (!self2.settings.persist && self2.userOptions.hasOwnProperty(value)) {
      self2.removeOption(value, silent);
    }
    if (i2 < self2.caretPos) {
      self2.setCaret(self2.caretPos - 1);
    }
    self2.updateOriginalInput({ silent });
    self2.refreshState();
    self2.positionDropdown();
    self2.trigger("item_remove", value, item);
  }
  /**
   * Invokes the `create` method provided in the
   * TomSelect options that should provide the data
   * for the new item, given the user input.
   *
   * Once this completes, it will be added
   * to the item list.
   *
   */
  createItem(input = null, callback = () => {
  }) {
    if (arguments.length === 3) {
      callback = arguments[2];
    }
    if (typeof callback != "function") {
      callback = () => {
      };
    }
    var self2 = this;
    var caret = self2.caretPos;
    var output;
    input = input || self2.inputValue();
    if (!self2.canCreate(input)) {
      const hash2 = hash_key(input);
      if (hash2) {
        if (this.options[input]) {
          self2.addItem(input);
        }
      }
      callback();
      return false;
    }
    self2.lock();
    var created = false;
    var create = (data) => {
      self2.unlock();
      if (!data || typeof data !== "object")
        return callback();
      var value = hash_key(data[self2.settings.valueField]);
      if (typeof value !== "string") {
        return callback();
      }
      self2.setTextboxValue();
      self2.addOption(data, true);
      self2.setCaret(caret);
      self2.addItem(value);
      callback(data);
      created = true;
    };
    if (typeof self2.settings.create === "function") {
      output = self2.settings.create.call(this, input, create);
    } else {
      output = {
        [self2.settings.labelField]: input,
        [self2.settings.valueField]: input
      };
    }
    if (!created) {
      create(output);
    }
    return true;
  }
  /**
   * Re-renders the selected item lists.
   */
  refreshItems() {
    var self2 = this;
    self2.isDropdownContentStale = true;
    if (self2.isSetup) {
      self2.addItems(self2.items);
    }
    self2.updateOriginalInput();
    self2.refreshState();
  }
  /**
   * Updates all state-dependent attributes
   * and CSS classes.
   */
  refreshState() {
    const self2 = this;
    self2.refreshValidityState();
    const isFull = self2.isFull();
    const isLocked = self2.isLocked;
    self2.wrapper.classList.toggle("rtl", self2.rtl);
    const wrap_classList = self2.wrapper.classList;
    wrap_classList.toggle("focus", self2.isFocused);
    wrap_classList.toggle("disabled", self2.isDisabled);
    wrap_classList.toggle("readonly", self2.isReadOnly);
    wrap_classList.toggle("required", self2.isRequired);
    wrap_classList.toggle("invalid", !self2.isValid);
    wrap_classList.toggle("locked", isLocked);
    wrap_classList.toggle("full", isFull);
    wrap_classList.toggle("input-active", self2.isFocused && !self2.isInputHidden);
    wrap_classList.toggle("dropdown-active", self2.isOpen);
    wrap_classList.toggle("has-options", isEmptyObject(self2.options));
    wrap_classList.toggle("has-items", self2.items.length > 0);
  }
  /**
   * Update the `required` attribute of both input and control input.
   *
   * The `required` property needs to be activated on the control input
   * for the error to be displayed at the right place. `required` also
   * needs to be temporarily deactivated on the input since the input is
   * hidden and can't show errors.
   */
  refreshValidityState() {
    var self2 = this;
    if (!self2.input.validity) {
      return;
    }
    self2.isValid = self2.input.validity.valid;
    self2.isInvalid = !self2.isValid;
  }
  /**
   * Determines whether or not more items can be added
   * to the control without exceeding the user-defined maximum.
   *
   * @returns {boolean}
   */
  isFull() {
    return this.settings.maxItems !== null && this.items.length >= this.settings.maxItems;
  }
  /**
   * Refreshes the original <select> or <input>
   * element to reflect the current state.
   *
   */
  updateOriginalInput(opts = {}) {
    const self2 = this;
    var option2, label;
    const empty_option = self2.input.querySelector('option[value=""]');
    if (self2.is_select_tag) {
      let AddSelected = function(option_el, value, label2) {
        if (!option_el) {
          option_el = getDom('<option value="' + escape_html(value) + '">' + escape_html(label2) + "</option>");
        }
        if (option_el != empty_option) {
          self2.input.append(option_el);
        }
        selected.push(option_el);
        if (option_el != empty_option || has_selected > 0 || self2.settings.mode == "multi") {
          option_el.selected = true;
        }
        return option_el;
      };
      const selected = [];
      const has_selected = self2.input.querySelectorAll("option:checked").length;
      self2.input.querySelectorAll("option:checked").forEach((option_el) => {
        option_el.selected = false;
      });
      if (self2.items.length == 0 && self2.settings.mode == "single") {
        AddSelected(empty_option, "", "");
      } else {
        self2.items.forEach((value) => {
          option2 = self2.options[value];
          label = option2[self2.settings.labelField] || "";
          if (selected.includes(option2.$option)) {
            const reuse_opt = self2.input.querySelector(`option[value="${addSlashes(value)}"]:not(:checked)`);
            AddSelected(reuse_opt, value, label);
          } else {
            option2.$option = AddSelected(option2.$option, value, label);
          }
        });
      }
    } else {
      self2.input.value = self2.getValue();
    }
    if (self2.isSetup) {
      if (!opts.silent) {
        self2.trigger("change", self2.getValue());
      }
    }
  }
  /**
   * Shows the autocomplete dropdown containing
   * the available options.
   */
  open() {
    var self2 = this;
    if (self2.isLocked || self2.isOpen || self2.settings.mode === "multi" && self2.isFull())
      return;
    self2.isOpen = true;
    setAttr(self2.focus_node, { "aria-expanded": "true" });
    self2.refreshState();
    applyCSS(self2.dropdown, { visibility: "hidden", display: "block" });
    self2.positionDropdown();
    applyCSS(self2.dropdown, { visibility: "visible", display: "block" });
    self2.focus();
    self2.trigger("dropdown_open", self2.dropdown);
  }
  /**
   * Closes the autocomplete dropdown menu.
   */
  close(setTextboxValue = true) {
    var self2 = this;
    var trigger = self2.isOpen;
    if (setTextboxValue) {
      self2.setTextboxValue();
      if (self2.settings.mode === "single" && self2.items.length) {
        self2.inputState();
      }
    }
    self2.isOpen = false;
    setAttr(self2.focus_node, { "aria-expanded": "false" });
    applyCSS(self2.dropdown, { display: "none" });
    if (self2.settings.hideSelected) {
      self2.clearActiveOption();
    }
    self2.refreshState();
    if (trigger)
      self2.trigger("dropdown_close", self2.dropdown);
  }
  /**
   * Calculates and applies the appropriate
   * position of the dropdown if dropdownParent = 'body'.
   * Otherwise, position is determined by css
   */
  positionDropdown() {
    if (this.settings.dropdownParent !== "body") {
      return;
    }
    var context = this.control;
    var rect = context.getBoundingClientRect();
    var top2 = context.offsetHeight + rect.top + window.scrollY;
    var left2 = rect.left + window.scrollX;
    applyCSS(this.dropdown, {
      width: rect.width + "px",
      top: top2 + "px",
      left: left2 + "px"
    });
  }
  /**
   * Resets / clears all selected items
   * from the control.
   *
   */
  clear(silent) {
    var self2 = this;
    if (!self2.items.length)
      return;
    var items = self2.controlChildren();
    iterate2(items, (item) => {
      self2.removeItem(item, true);
    });
    self2.inputState();
    if (!silent)
      self2.updateOriginalInput();
    self2.trigger("clear");
  }
  /**
   * A helper method for inserting an element
   * at the current caret position.
   *
   */
  insertAtCaret(el) {
    const self2 = this;
    const caret = self2.caretPos;
    const target = self2.control;
    target.insertBefore(el, target.children[caret] || null);
    self2.setCaret(caret + 1);
  }
  /**
   * Removes the current selected item(s).
   *
   */
  deleteSelection(e2) {
    var direction, selection, caret, tail;
    var self2 = this;
    direction = e2 && e2.keyCode === KEY_BACKSPACE ? -1 : 1;
    selection = getSelection(self2.control_input);
    const rm_items = [];
    if (self2.activeItems.length) {
      tail = getTail(self2.activeItems, direction);
      caret = nodeIndex(tail);
      if (direction > 0) {
        caret++;
      }
      iterate2(self2.activeItems, (item) => rm_items.push(item));
    } else if ((self2.isFocused || self2.settings.mode === "single") && self2.items.length) {
      const items = self2.controlChildren();
      let rm_item;
      if (direction < 0 && selection.start === 0 && selection.length === 0) {
        rm_item = items[self2.caretPos - 1];
      } else if (direction > 0 && selection.start === self2.inputValue().length) {
        rm_item = items[self2.caretPos];
      }
      if (rm_item !== void 0) {
        rm_items.push(rm_item);
      }
    }
    if (!self2.shouldDelete(rm_items, e2)) {
      return false;
    }
    preventDefault(e2, true);
    if (typeof caret !== "undefined") {
      self2.setCaret(caret);
    }
    while (rm_items.length) {
      self2.removeItem(rm_items.pop());
    }
    self2.inputState();
    self2.positionDropdown();
    self2.refreshOptions(false);
    return true;
  }
  /**
   * Return true if the items should be deleted
   */
  shouldDelete(items, evt) {
    const values = items.map((item) => item.dataset.value);
    if (!values.length || typeof this.settings.onDelete === "function" && this.settings.onDelete.call(this, values, evt) === false) {
      return false;
    }
    return true;
  }
  /**
   * Selects the previous / next item (depending on the `direction` argument).
   *
   * > 0 - right
   * < 0 - left
   *
   */
  advanceSelection(direction, e2) {
    var last_active, adjacent, self2 = this;
    if (self2.rtl)
      direction *= -1;
    if (self2.inputValue().length)
      return;
    if (isKeyDown(KEY_SHORTCUT, e2) || isKeyDown("shiftKey", e2)) {
      last_active = self2.getLastActive(direction);
      if (last_active) {
        if (!last_active.classList.contains("active")) {
          adjacent = last_active;
        } else {
          adjacent = self2.getAdjacent(last_active, direction, "item");
        }
      } else if (direction > 0) {
        adjacent = self2.control_input.nextElementSibling;
      } else {
        adjacent = self2.control_input.previousElementSibling;
      }
      if (adjacent) {
        if (adjacent.classList.contains("active")) {
          self2.removeActiveItem(last_active);
        }
        self2.setActiveItemClass(adjacent);
      }
    } else {
      self2.moveCaret(direction);
    }
  }
  moveCaret(direction) {
  }
  /**
   * Get the last active item
   *
   */
  getLastActive(direction) {
    let last_active = this.control.querySelector(".last-active");
    if (last_active) {
      return last_active;
    }
    var result = this.control.querySelectorAll(".active");
    if (result) {
      return getTail(result, direction);
    }
  }
  /**
   * Moves the caret to the specified index.
   *
   * The input must be moved by leaving it in place and moving the
   * siblings, due to the fact that focus cannot be restored once lost
   * on mobile webkit devices
   *
   */
  setCaret(new_pos) {
    this.caretPos = this.items.length;
  }
  /**
   * Return list of item dom elements
   *
   */
  controlChildren() {
    return Array.from(this.control.querySelectorAll("[data-ts-item]"));
  }
  /**
   * Disables user input on the control. Used while
   * items are being asynchronously created.
   */
  lock() {
    this.setLocked(true);
  }
  /**
   * Re-enables user input on the control.
   */
  unlock() {
    this.setLocked(false);
  }
  /**
   * Disable or enable user input on the control
   */
  setLocked(lock = this.isReadOnly || this.isDisabled) {
    this.isLocked = lock;
    this.refreshState();
  }
  /**
   * Disables user input on the control completely.
   * While disabled, it cannot receive focus.
   */
  disable() {
    this.setDisabled(true);
    this.close();
  }
  /**
   * Enables the control so that it can respond
   * to focus and user input.
   */
  enable() {
    this.setDisabled(false);
  }
  setDisabled(disabled) {
    this.focus_node.tabIndex = disabled ? -1 : this.tabIndex;
    this.isDisabled = disabled;
    this.input.disabled = disabled;
    this.control_input.disabled = disabled;
    this.setLocked();
  }
  setReadOnly(isReadOnly) {
    this.isReadOnly = isReadOnly;
    this.input.readOnly = isReadOnly;
    this.control_input.readOnly = isReadOnly;
    this.setLocked();
  }
  /**
   * Completely destroys the control and
   * unbinds all event listeners so that it can
   * be garbage collected.
   */
  destroy() {
    var self2 = this;
    var revertSettings = self2.revertSettings;
    self2.trigger("destroy");
    self2.off();
    self2.wrapper.remove();
    self2.dropdown.remove();
    self2.input.innerHTML = revertSettings.innerHTML;
    self2.input.tabIndex = revertSettings.tabIndex;
    removeClasses(self2.input, "tomselected", "ts-hidden-accessible");
    self2._destroy();
    delete self2.input.tomselect;
  }
  /**
   * A helper method for rendering "item" and
   * "option" templates, given the data.
   *
   */
  render(templateName, data) {
    var id, html;
    const self2 = this;
    if (typeof this.settings.render[templateName] !== "function") {
      return null;
    }
    html = self2.settings.render[templateName].call(this, data, escape_html);
    if (!html) {
      return null;
    }
    html = getDom(html);
    if (templateName === "option" || templateName === "option_create") {
      if (data[self2.settings.disabledField]) {
        setAttr(html, { "aria-disabled": "true" });
      } else {
        setAttr(html, { "data-selectable": "" });
      }
    } else if (templateName === "optgroup") {
      id = data.group[self2.settings.optgroupValueField];
      setAttr(html, { "data-group": id });
      if (data.group[self2.settings.disabledField]) {
        setAttr(html, { "data-disabled": "" });
      }
    }
    if (templateName === "option" || templateName === "item") {
      const value = get_hash(data[self2.settings.valueField]);
      setAttr(html, { "data-value": value });
      if (templateName === "item") {
        addClasses(html, self2.settings.itemClass);
        setAttr(html, { "data-ts-item": "" });
      } else {
        addClasses(html, self2.settings.optionClass);
        setAttr(html, {
          role: "option",
          id: data.$id
        });
        data.$div = html;
        self2.options[value] = data;
      }
    }
    return html;
  }
  /**
   * Type guarded rendering
   *
   */
  _render(templateName, data) {
    const html = this.render(templateName, data);
    if (html == null) {
      throw "HTMLElement expected";
    }
    return html;
  }
  /**
   * Clears the render cache for a template. If
   * no template is given, clears all render
   * caches.
   *
   */
  clearCache() {
    iterate2(this.options, (option2) => {
      if (option2.$div) {
        option2.$div.remove();
        delete option2.$div;
      }
    });
  }
  /**
   * Removes a value from item and option caches
   *
   */
  uncacheValue(value) {
    const option_el = this.getOption(value);
    if (option_el)
      option_el.remove();
  }
  /**
   * Determines whether or not to display the
   * create item prompt, given a user input.
   *
   */
  canCreate(input) {
    return this.settings.create && input.length > 0 && this.settings.createFilter.call(this, input);
  }
  /**
   * Wraps this.`method` so that `new_fn` can be invoked 'before', 'after', or 'instead' of the original method
   *
   * this.hook('instead','onKeyDown',function( arg1, arg2 ...){
   *
   * });
   */
  hook(when, method, new_fn) {
    var self2 = this;
    var orig_method = self2[method];
    self2[method] = function() {
      var result, result_new;
      if (when === "after") {
        result = orig_method.apply(self2, arguments);
      }
      result_new = new_fn.apply(self2, arguments);
      if (when === "instead") {
        return result_new;
      }
      if (when === "before") {
        result = orig_method.apply(self2, arguments);
      }
      return result;
    };
  }
};

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/change_listener/plugin.js
var addEvent2 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
function plugin() {
  addEvent2(this.input, "change", () => {
    this.sync();
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/checkbox_options/plugin.js
var hash_key2 = (value) => {
  if (typeof value === "undefined" || value === null) return null;
  return get_hash2(value);
};
var get_hash2 = (value) => {
  if (typeof value === "boolean") return value ? "1" : "0";
  return value + "";
};
var preventDefault2 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var getDom2 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString2(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString2 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
function plugin2(userOptions) {
  var self2 = this;
  var orig_onOptionSelect = self2.onOptionSelect;
  self2.settings.hideSelected = false;
  const cbOptions = Object.assign({
    // so that the user may add different ones as well
    className: "tomselect-checkbox",
    // the following default to the historic plugin's values
    checkedClassNames: void 0,
    uncheckedClassNames: void 0
  }, userOptions);
  var UpdateChecked = function UpdateChecked2(checkbox, toCheck) {
    if (toCheck) {
      checkbox.checked = true;
      if (cbOptions.uncheckedClassNames) {
        checkbox.classList.remove(...cbOptions.uncheckedClassNames);
      }
      if (cbOptions.checkedClassNames) {
        checkbox.classList.add(...cbOptions.checkedClassNames);
      }
    } else {
      checkbox.checked = false;
      if (cbOptions.checkedClassNames) {
        checkbox.classList.remove(...cbOptions.checkedClassNames);
      }
      if (cbOptions.uncheckedClassNames) {
        checkbox.classList.add(...cbOptions.uncheckedClassNames);
      }
    }
  };
  var UpdateCheckbox = function UpdateCheckbox2(option2) {
    setTimeout(() => {
      var checkbox = option2.querySelector("input." + cbOptions.className);
      if (checkbox instanceof HTMLInputElement) {
        UpdateChecked(checkbox, option2.classList.contains("selected"));
      }
    }, 1);
  };
  self2.hook("after", "setupTemplates", () => {
    var orig_render_option = self2.settings.render.option;
    self2.settings.render.option = (data, escape_html2) => {
      var rendered = getDom2(orig_render_option.call(self2, data, escape_html2));
      var checkbox = document.createElement("input");
      if (cbOptions.className) {
        checkbox.classList.add(cbOptions.className);
      }
      checkbox.addEventListener("click", function(evt) {
        preventDefault2(evt);
      });
      checkbox.type = "checkbox";
      const hashed = hash_key2(data[self2.settings.valueField]);
      UpdateChecked(checkbox, !!(hashed && self2.items.indexOf(hashed) > -1));
      rendered.prepend(checkbox);
      return rendered;
    };
  });
  self2.on("item_remove", (value) => {
    var option2 = self2.getOption(value);
    if (option2) {
      option2.classList.remove("selected");
      UpdateCheckbox(option2);
    }
  });
  self2.on("item_add", (value) => {
    var option2 = self2.getOption(value);
    if (option2) {
      UpdateCheckbox(option2);
    }
  });
  self2.hook("instead", "onOptionSelect", (evt, option2) => {
    if (option2.classList.contains("selected")) {
      option2.classList.remove("selected");
      self2.removeItem(option2.dataset.value);
      self2.refreshOptions();
      preventDefault2(evt, true);
      return;
    }
    orig_onOptionSelect.call(self2, evt, option2);
    UpdateCheckbox(option2);
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/clear_button/plugin.js
var getDom3 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString3(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString3 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
function plugin3(userOptions) {
  const self2 = this;
  const options = Object.assign({
    className: "clear-button",
    title: "Clear All",
    role: "button",
    tabindex: 0,
    html: (data) => {
      return `<div class="${data.className}" title="${data.title}" role="${data.role}" tabindex="${data.tabindex}">&times;</div>`;
    }
  }, userOptions);
  self2.on("initialize", () => {
    var button = getDom3(options.html(options));
    button.addEventListener("click", (evt) => {
      if (self2.isLocked) return;
      self2.clear();
      if (self2.settings.mode === "single" && self2.settings.allowEmptyOption) {
        self2.addItem("");
      }
      self2.refreshOptions(false);
      evt.preventDefault();
      evt.stopPropagation();
    });
    self2.control.appendChild(button);
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/drag_drop/plugin.js
var preventDefault3 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var addEvent3 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
var iterate3 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var getDom4 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString4(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString4 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
var setAttr2 = (el, attrs) => {
  iterate3(attrs, (val, attr) => {
    if (val == null) {
      el.removeAttribute(attr);
    } else {
      el.setAttribute(attr, "" + val);
    }
  });
};
var insertAfter = (referenceNode, newNode) => {
  var _referenceNode$parent;
  (_referenceNode$parent = referenceNode.parentNode) == null || _referenceNode$parent.insertBefore(newNode, referenceNode.nextSibling);
};
var insertBefore = (referenceNode, newNode) => {
  var _referenceNode$parent2;
  (_referenceNode$parent2 = referenceNode.parentNode) == null || _referenceNode$parent2.insertBefore(newNode, referenceNode);
};
var isBefore = (referenceNode, newNode) => {
  do {
    var _newNode;
    newNode = (_newNode = newNode) == null ? void 0 : _newNode.previousElementSibling;
    if (referenceNode == newNode) {
      return true;
    }
  } while (newNode && newNode.previousElementSibling);
  return false;
};
function plugin4() {
  var self2 = this;
  if (self2.settings.mode !== "multi") return;
  var orig_lock = self2.lock;
  var orig_unlock = self2.unlock;
  let sortable = true;
  let drag_item;
  self2.hook("after", "setupTemplates", () => {
    var orig_render_item = self2.settings.render.item;
    self2.settings.render.item = (data, escape) => {
      const item = getDom4(orig_render_item.call(self2, data, escape));
      setAttr2(item, {
        "draggable": "true"
      });
      const mousedown = (evt) => {
        if (!sortable) preventDefault3(evt);
        evt.stopPropagation();
      };
      const dragStart = (evt) => {
        drag_item = item;
        setTimeout(() => {
          item.classList.add("ts-dragging");
        }, 0);
      };
      const dragOver = (evt) => {
        evt.preventDefault();
        item.classList.add("ts-drag-over");
        moveitem(item, drag_item);
      };
      const dragLeave = () => {
        item.classList.remove("ts-drag-over");
      };
      const moveitem = (targetitem, dragitem) => {
        if (dragitem === void 0) return;
        if (isBefore(dragitem, item)) {
          insertAfter(targetitem, dragitem);
        } else {
          insertBefore(targetitem, dragitem);
        }
      };
      const dragend = () => {
        var _drag_item;
        document.querySelectorAll(".ts-drag-over").forEach((el) => el.classList.remove("ts-drag-over"));
        (_drag_item = drag_item) == null || _drag_item.classList.remove("ts-dragging");
        drag_item = void 0;
        var values = [];
        self2.control.querySelectorAll(`[data-value]`).forEach((el) => {
          if (el.dataset.value) {
            let value = el.dataset.value;
            if (value) {
              values.push(value);
            }
          }
        });
        self2.setValue(values);
      };
      addEvent3(item, "mousedown", mousedown);
      addEvent3(item, "dragstart", dragStart);
      addEvent3(item, "dragenter", dragOver);
      addEvent3(item, "dragover", dragOver);
      addEvent3(item, "dragleave", dragLeave);
      addEvent3(item, "dragend", dragend);
      return item;
    };
  });
  self2.hook("instead", "lock", () => {
    sortable = false;
    return orig_lock.call(self2);
  });
  self2.hook("instead", "unlock", () => {
    sortable = true;
    return orig_unlock.call(self2);
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/dropdown_header/plugin.js
var preventDefault4 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var getDom5 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString5(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString5 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
function plugin5(userOptions) {
  const self2 = this;
  const options = Object.assign({
    title: "Untitled",
    headerClass: "dropdown-header",
    titleRowClass: "dropdown-header-title",
    labelClass: "dropdown-header-label",
    closeClass: "dropdown-header-close",
    html: (data) => {
      return '<div class="' + data.headerClass + '"><div class="' + data.titleRowClass + '"><span class="' + data.labelClass + '">' + data.title + '</span><a class="' + data.closeClass + '">&times;</a></div></div>';
    }
  }, userOptions);
  self2.on("initialize", () => {
    var header = getDom5(options.html(options));
    var close_link = header.querySelector("." + options.closeClass);
    if (close_link) {
      close_link.addEventListener("click", (evt) => {
        preventDefault4(evt, true);
        self2.close();
      });
    }
    self2.dropdown.insertBefore(header, self2.dropdown.firstChild);
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/caret_position/plugin.js
var iterate4 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var removeClasses2 = (elmts, ...classes) => {
  var norm_classes = classesArray2(classes);
  elmts = castAsArray2(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.remove(cls);
    });
  });
};
var classesArray2 = (args) => {
  var classes = [];
  iterate4(args, (_classes) => {
    if (typeof _classes === "string") {
      _classes = _classes.trim().split(/[\t\n\f\r\s]/);
    }
    if (Array.isArray(_classes)) {
      classes = classes.concat(_classes);
    }
  });
  return classes.filter(Boolean);
};
var castAsArray2 = (arg) => {
  if (!Array.isArray(arg)) {
    arg = [arg];
  }
  return arg;
};
var nodeIndex2 = (el, amongst) => {
  if (!el) return -1;
  amongst = amongst || el.nodeName;
  var i2 = 0;
  while (el = el.previousElementSibling) {
    if (el.matches(amongst)) {
      i2++;
    }
  }
  return i2;
};
function plugin6() {
  var self2 = this;
  self2.hook("instead", "setCaret", (new_pos) => {
    if (self2.settings.mode === "single" || !self2.control.contains(self2.control_input)) {
      new_pos = self2.items.length;
    } else {
      new_pos = Math.max(0, Math.min(self2.items.length, new_pos));
      if (new_pos != self2.caretPos && !self2.isPending) {
        self2.controlChildren().forEach((child, j2) => {
          if (j2 < new_pos) {
            self2.control_input.insertAdjacentElement("beforebegin", child);
          } else {
            self2.control.appendChild(child);
          }
        });
      }
    }
    self2.caretPos = new_pos;
  });
  self2.hook("instead", "moveCaret", (direction) => {
    if (!self2.isFocused) return;
    const last_active = self2.getLastActive(direction);
    if (last_active) {
      const idx = nodeIndex2(last_active);
      self2.setCaret(direction > 0 ? idx + 1 : idx);
      self2.setActiveItem();
      removeClasses2(last_active, "last-active");
    } else {
      self2.setCaret(self2.caretPos + direction);
    }
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/dropdown_input/plugin.js
var KEY_ESC2 = 27;
var KEY_TAB2 = 9;
var preventDefault5 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var addEvent4 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
var iterate5 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var getDom6 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString6(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString6 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
var addClasses2 = (elmts, ...classes) => {
  var norm_classes = classesArray3(classes);
  elmts = castAsArray3(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.add(cls);
    });
  });
};
var classesArray3 = (args) => {
  var classes = [];
  iterate5(args, (_classes) => {
    if (typeof _classes === "string") {
      _classes = _classes.trim().split(/[\t\n\f\r\s]/);
    }
    if (Array.isArray(_classes)) {
      classes = classes.concat(_classes);
    }
  });
  return classes.filter(Boolean);
};
var castAsArray3 = (arg) => {
  if (!Array.isArray(arg)) {
    arg = [arg];
  }
  return arg;
};
function plugin7() {
  const self2 = this;
  self2.settings.shouldOpen = true;
  self2.hook("before", "setup", () => {
    var _self$input;
    self2.focus_node = self2.control;
    addClasses2(self2.control_input, "dropdown-input");
    const div = getDom6('<div class="dropdown-input-wrap">');
    div.append(self2.control_input);
    self2.dropdown.insertBefore(div, self2.dropdown.firstChild);
    const placeholder = getDom6('<input class="items-placeholder" tabindex="-1" />');
    placeholder.placeholder = self2.settings.placeholder || "";
    self2.control.append(placeholder);
    const label = (_self$input = self2.input) == null ? void 0 : _self$input.getAttribute("aria-label");
    if (!label) return;
    placeholder.setAttribute("aria-label", label);
  });
  self2.on("initialize", () => {
    self2.control_input.addEventListener("keydown", (evt) => {
      switch (evt.keyCode) {
        case KEY_ESC2:
          if (self2.isOpen) {
            preventDefault5(evt, true);
            self2.close();
          }
          self2.clearActiveItems();
          return;
        case KEY_TAB2:
          self2.focus_node.tabIndex = -1;
          break;
      }
      return self2.onKeyDown.call(self2, evt);
    });
    self2.on("blur", () => {
      self2.focus_node.tabIndex = self2.isDisabled ? -1 : self2.tabIndex;
    });
    self2.on("dropdown_open", () => {
      self2.control_input.focus();
    });
    const orig_onBlur = self2.onBlur;
    self2.hook("instead", "onBlur", (evt) => {
      if (evt && evt.relatedTarget == self2.control_input) return;
      return orig_onBlur.call(self2);
    });
    addEvent4(self2.control_input, "blur", () => self2.onBlur());
    self2.hook("before", "close", () => {
      if (!self2.isOpen) return;
      self2.focus_node.focus({
        preventScroll: true
      });
    });
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/input_autogrow/plugin.js
var addEvent5 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
function plugin8() {
  var self2 = this;
  self2.on("initialize", () => {
    var test_input = document.createElement("span");
    var control = self2.control_input;
    test_input.style.cssText = "position:absolute; top:-99999px; left:-99999px; width:auto; padding:0; white-space:pre; ";
    self2.wrapper.appendChild(test_input);
    var transfer_styles = ["letterSpacing", "fontSize", "fontFamily", "fontWeight", "textTransform"];
    for (const style_name of transfer_styles) {
      test_input.style[style_name] = control.style[style_name];
    }
    var resize = () => {
      test_input.textContent = control.value;
      control.style.width = test_input.clientWidth + "px";
    };
    resize();
    self2.on("update item_add item_remove", resize);
    addEvent5(control, "input", resize);
    addEvent5(control, "keyup", resize);
    addEvent5(control, "blur", resize);
    addEvent5(control, "update", resize);
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/no_backspace_delete/plugin.js
function plugin9() {
  var self2 = this;
  var orig_deleteSelection = self2.deleteSelection;
  this.hook("instead", "deleteSelection", (evt) => {
    if (self2.activeItems.length) {
      return orig_deleteSelection.call(self2, evt);
    }
    return false;
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/no_active_items/plugin.js
function plugin10() {
  this.hook("instead", "setActiveItem", () => {
  });
  this.hook("instead", "selectAll", () => {
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/optgroup_columns/plugin.js
var KEY_LEFT2 = 37;
var KEY_RIGHT2 = 39;
var parentMatch2 = (target, selector, wrapper) => {
  while (target && target.matches) {
    if (target.matches(selector)) {
      return target;
    }
    target = target.parentNode;
  }
};
var nodeIndex3 = (el, amongst) => {
  if (!el) return -1;
  amongst = amongst || el.nodeName;
  var i2 = 0;
  while (el = el.previousElementSibling) {
    if (el.matches(amongst)) {
      i2++;
    }
  }
  return i2;
};
function plugin11() {
  var self2 = this;
  var orig_keydown = self2.onKeyDown;
  self2.hook("instead", "onKeyDown", (evt) => {
    var index, option2, options, optgroup;
    if (!self2.isOpen || !(evt.keyCode === KEY_LEFT2 || evt.keyCode === KEY_RIGHT2)) {
      return orig_keydown.call(self2, evt);
    }
    self2.ignoreHover = true;
    optgroup = parentMatch2(self2.activeOption, "[data-group]");
    index = nodeIndex3(self2.activeOption, "[data-selectable]");
    if (!optgroup) {
      return;
    }
    if (evt.keyCode === KEY_LEFT2) {
      optgroup = optgroup.previousSibling;
    } else {
      optgroup = optgroup.nextSibling;
    }
    if (!optgroup) {
      return;
    }
    options = optgroup.querySelectorAll("[data-selectable]");
    option2 = options[Math.min(options.length - 1, index)];
    if (option2) {
      self2.setActiveOption(option2);
    }
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/remove_button/plugin.js
var preventDefault6 = (evt, stop = false) => {
  if (evt) {
    evt.preventDefault();
    if (stop) {
      evt.stopPropagation();
    }
  }
};
var addEvent6 = (target, type, callback, options) => {
  target.addEventListener(type, callback, options);
};
var getDom7 = (query) => {
  if (query.jquery) {
    return query[0];
  }
  if (query instanceof HTMLElement) {
    return query;
  }
  if (isHtmlString7(query)) {
    var tpl = document.createElement("template");
    tpl.innerHTML = query.trim();
    return tpl.content.firstChild;
  }
  return document.querySelector(query);
};
var isHtmlString7 = (arg) => {
  if (typeof arg === "string" && arg.indexOf("<") > -1) {
    return true;
  }
  return false;
};
function plugin12(userOptions) {
  const self2 = this;
  const options = Object.assign({
    label: "\xD7",
    title: "Remove",
    className: "remove",
    tabindex: -1,
    role: "button",
    html: (data) => {
      var _data$tabindex;
      const el = document.createElement("div");
      el.className = data.className || "";
      el.title = data.title || "";
      el.setAttribute("role", data.role || "button");
      el.tabIndex = (_data$tabindex = data.tabindex) != null ? _data$tabindex : -1;
      el.textContent = data.label || "";
      return el;
    }
  }, userOptions);
  self2.hook("after", "setupTemplates", () => {
    var orig_render_item = self2.settings.render.item;
    self2.settings.render.item = (data, escape) => {
      var item = getDom7(orig_render_item.call(self2, data, escape));
      var close_button = getDom7(options.html(options));
      item.appendChild(close_button);
      addEvent6(close_button, "mousedown", (evt) => {
        preventDefault6(evt, true);
      });
      addEvent6(close_button, "click", (evt) => {
        if (self2.isLocked) return;
        preventDefault6(evt, true);
        if (self2.isLocked) return;
        if (!self2.shouldDelete([item], evt)) return;
        self2.removeItem(item);
        self2.refreshOptions(false);
        self2.inputState();
      });
      return item;
    };
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/restore_on_backspace/plugin.js
function plugin13(userOptions) {
  const self2 = this;
  const options = Object.assign({
    text: (option2) => {
      return option2[self2.settings.labelField];
    }
  }, userOptions);
  self2.on("item_remove", function(value) {
    if (!self2.isFocused) {
      return;
    }
    if (self2.control_input.value.trim() === "") {
      var option2 = self2.options[value];
      if (option2) {
        self2.setTextboxValue(options.text.call(self2, option2));
      }
    }
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/plugins/virtual_scroll/plugin.js
var iterate6 = (object, callback) => {
  if (Array.isArray(object)) {
    object.forEach(callback);
  } else {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        callback(object[key], key);
      }
    }
  }
};
var addClasses3 = (elmts, ...classes) => {
  var norm_classes = classesArray4(classes);
  elmts = castAsArray4(elmts);
  elmts.map((el) => {
    norm_classes.map((cls) => {
      el.classList.add(cls);
    });
  });
};
var classesArray4 = (args) => {
  var classes = [];
  iterate6(args, (_classes) => {
    if (typeof _classes === "string") {
      _classes = _classes.trim().split(/[\t\n\f\r\s]/);
    }
    if (Array.isArray(_classes)) {
      classes = classes.concat(_classes);
    }
  });
  return classes.filter(Boolean);
};
var castAsArray4 = (arg) => {
  if (!Array.isArray(arg)) {
    arg = [arg];
  }
  return arg;
};
function plugin14() {
  const self2 = this;
  const orig_canLoad = self2.canLoad;
  const orig_clearActiveOption = self2.clearActiveOption;
  const orig_loadCallback = self2.loadCallback;
  var pagination = {};
  var dropdown_content;
  var loading_more = false;
  var load_more_opt;
  var default_values = [];
  var default_values_loaded = false;
  var default_pagination;
  var default_options = [];
  var html_values = [];
  if (!self2.settings.shouldLoadMore) {
    self2.settings.shouldLoadMore = () => {
      const scroll_percent = dropdown_content.clientHeight / (dropdown_content.scrollHeight - dropdown_content.scrollTop);
      if (scroll_percent > 0.9) {
        return true;
      }
      if (self2.activeOption) {
        var selectable = self2.selectable();
        var index = Array.from(selectable).indexOf(self2.activeOption);
        if (index >= selectable.length - 2) {
          return true;
        }
      }
      return false;
    };
  }
  if (!self2.settings.firstUrl) {
    throw "virtual_scroll plugin requires a firstUrl() method";
  }
  self2.settings.sortField = [{
    field: "$order"
  }, {
    field: "$score"
  }];
  const canLoadMore = (query) => {
    if (self2.settings.maxOptions !== null && typeof self2.settings.maxOptions === "number" && dropdown_content.children.length >= self2.settings.maxOptions) {
      return false;
    }
    if (query in pagination && pagination[query]) {
      return true;
    }
    return false;
  };
  const clearFilter = (option2, value) => {
    if (self2.items.indexOf(value) >= 0 || default_values.indexOf(value) >= 0) {
      return true;
    }
    return false;
  };
  self2.setNextUrl = (value, next_url) => {
    pagination[value] = next_url;
  };
  self2.getUrl = (query) => {
    if (query in pagination) {
      const next_url = pagination[query];
      pagination[query] = false;
      return next_url;
    }
    self2.clearPagination();
    return self2.settings.firstUrl.call(self2, query);
  };
  self2.clearPagination = () => {
    pagination = {};
  };
  self2.hook("instead", "clearActiveOption", () => {
    if (loading_more) {
      return;
    }
    return orig_clearActiveOption.call(self2);
  });
  self2.hook("instead", "canLoad", (query) => {
    if (!(query in pagination)) {
      return orig_canLoad.call(self2, query);
    }
    return canLoadMore(query);
  });
  self2.hook("instead", "loadCallback", (options, optgroups) => {
    if (!loading_more) {
      const activeFilter = self2.lastValue !== "" ? (_option, value) => self2.items.indexOf(value) >= 0 || html_values.indexOf(value) >= 0 : clearFilter;
      self2.clearOptions(activeFilter);
    } else if (load_more_opt) {
      const first_option = options[0];
      if (first_option !== void 0) {
        load_more_opt.dataset.value = first_option[self2.settings.valueField];
      }
    }
    orig_loadCallback.call(self2, options, optgroups);
    if (!loading_more && !default_values_loaded) {
      default_values_loaded = true;
      if (self2.lastValue === "") {
        default_values = Object.keys(self2.options);
        default_pagination = pagination[""];
        default_options = Object.values(self2.options);
      }
    }
    loading_more = false;
  });
  self2.hook("before", "refreshOptions", () => {
    if (self2.activeOption && "option" !== self2.activeOption.getAttribute("role")) {
      self2.setActiveOption(self2.activeOption.previousElementSibling);
    }
  });
  self2.hook("after", "refreshOptions", () => {
    const query = self2.lastValue;
    var option2;
    if (canLoadMore(query)) {
      option2 = self2.render("loading_more", {
        query
      });
      if (option2) {
        option2.setAttribute("data-selectable", "");
        load_more_opt = option2;
      }
    } else if (query in pagination && !dropdown_content.querySelector(".no-results")) {
      option2 = self2.render("no_more_results", {
        query
      });
    }
    if (option2) {
      addClasses3(option2, self2.settings.optionClass);
      dropdown_content.append(option2);
    }
  });
  const restoreDefaults = () => {
    if (!default_values_loaded) {
      return;
    }
    self2.addOptions(default_options);
    self2.clearOptions(clearFilter);
    if (default_pagination) {
      pagination[""] = default_pagination;
    }
  };
  self2.on("type", (query) => {
    if (query === "") {
      restoreDefaults();
      self2.refreshOptions(false);
    }
  });
  self2.on("dropdown_close", restoreDefaults);
  self2.on("initialize", () => {
    html_values = Object.keys(self2.options);
    default_values = Object.keys(self2.options);
    dropdown_content = self2.dropdown_content;
    self2.settings.render = Object.assign({}, {
      loading_more: () => {
        return `<div class="loading-more-results">Loading more results ... </div>`;
      },
      no_more_results: () => {
        return `<div class="no-more-results">No more results</div>`;
      }
    }, self2.settings.render);
    dropdown_content.addEventListener("scroll", () => {
      if (!self2.settings.shouldLoadMore.call(self2)) {
        return;
      }
      if (!canLoadMore(self2.lastValue)) {
        return;
      }
      if (loading_more) return;
      loading_more = true;
      self2.load.call(self2, self2.lastValue);
    });
  });
}

// node_modules/.pnpm/tom-select@2.6.2/node_modules/tom-select/dist/esm/tom-select.complete.js
TomSelect.define("change_listener", plugin);
TomSelect.define("checkbox_options", plugin2);
TomSelect.define("clear_button", plugin3);
TomSelect.define("drag_drop", plugin4);
TomSelect.define("dropdown_header", plugin5);
TomSelect.define("caret_position", plugin6);
TomSelect.define("dropdown_input", plugin7);
TomSelect.define("input_autogrow", plugin8);
TomSelect.define("no_backspace_delete", plugin9);
TomSelect.define("no_active_items", plugin10);
TomSelect.define("optgroup_columns", plugin11);
TomSelect.define("remove_button", plugin12);
TomSelect.define("restore_on_backspace", plugin13);
TomSelect.define("virtual_scroll", plugin14);
var tom_select_complete_default = TomSelect;

// src/vendor.js
var import_sweetalert2 = __toESM(require_sweetalert2_all(), 1);

// node_modules/.pnpm/marked@18.0.6/node_modules/marked/lib/marked.esm.js
function M2() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var T2 = M2();
function N2(l4) {
  T2 = l4;
}
var _2 = { exec: () => null };
function E3(l4) {
  let e2 = [];
  return (t2) => {
    let n2 = Math.max(0, Math.min(3, t2 - 1)), s2 = e2[n2];
    return s2 || (s2 = l4(n2), e2[n2] = s2), s2;
  };
}
function d3(l4, e2 = "") {
  let t2 = typeof l4 == "string" ? l4 : l4.source, n2 = { replace: (s2, r2) => {
    let i2 = typeof r2 == "string" ? r2 : r2.source;
    return i2 = i2.replace(m3.caret, "$1"), t2 = t2.replace(s2, i2), n2;
  }, getRegex: () => new RegExp(t2, e2) };
  return n2;
}
var Te = ((l4 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + l4);
  } catch {
    return false;
  }
})();
var m3 = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l4) => new RegExp(`^( {0,3}${l4})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: E3((l4) => new RegExp(`^ {0,${l4}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: E3((l4) => new RegExp(`^ {0,${l4}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: E3((l4) => new RegExp(`^ {0,${l4}}(?:\`\`\`|~~~)`)), headingBeginRegex: E3((l4) => new RegExp(`^ {0,${l4}}#`)), htmlBeginRegex: E3((l4) => new RegExp(`^ {0,${l4}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: E3((l4) => new RegExp(`^ {0,${l4}}>`)) };
var Oe = /^(?:[ \t]*(?:\n|$))+/;
var we = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var ye = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var B = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Pe = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var j = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
var oe = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var ae = d3(oe).replace(/bull/g, j).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Se = d3(oe).replace(/bull/g, j).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var F = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var $e = /^[^\n]+/;
var U2 = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var Le = d3(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", U2).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var _e = d3(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, j).getRegex();
var H = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var K = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var ze = d3("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n+|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n+|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n+|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", K).replace("tag", H).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var le = (l4) => d3(F).replace("hr", B).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", l4).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex();
var Me = le(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
var Ee = le(/ {0,3}(?:[*+-]|\d{1,9}[.)])[ \t]+[^ \t\n]/);
var Ie = d3(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Ee).getRegex();
var W = { blockquote: Ie, code: we, def: Le, fences: ye, heading: Pe, hr: B, html: ze, lheading: ae, list: _e, newline: Oe, paragraph: Me, table: _2, text: $e };
var se = d3("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", B).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex();
var Ae = { ...W, lheading: Se, table: se, paragraph: d3(F).replace("hr", B).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", se).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex() };
var Ce = { ...W, html: d3(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", K).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: _2, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: d3(F).replace("hr", B).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", ae).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Be = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var qe = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var ue = /^( {2,}|\\)\n(?!\s*$)/;
var De = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var I3 = /[\p{P}\p{S}]/u;
var Z2 = /[\s\p{P}\p{S}]/u;
var X = /[^\s\p{P}\p{S}]/u;
var ve = d3(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, Z2).getRegex();
var pe = /(?!~)[\p{P}\p{S}]/u;
var He = /(?!~)[\s\p{P}\p{S}]/u;
var Ze = /(?:[^\s\p{P}\p{S}]|~)/u;
var Ge = d3(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Te ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var ce = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
var Ne = d3(ce, "u").replace(/punct/g, I3).getRegex();
var Qe = d3(ce, "u").replace(/punct/g, pe).getRegex();
var he = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var je = d3(he, "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z2).replace(/punct/g, I3).getRegex();
var Fe = d3(he, "gu").replace(/notPunctSpace/g, Ze).replace(/punctSpace/g, He).replace(/punct/g, pe).getRegex();
var Ue = d3("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z2).replace(/punct/g, I3).getRegex();
var Ke = d3(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, I3).getRegex();
var We = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)";
var Xe = d3(We, "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z2).replace(/punct/g, I3).getRegex();
var Je = d3(/\\(punct)/, "gu").replace(/punct/g, I3).getRegex();
var Ve = d3(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var Ye = d3(K).replace("(?:-->|$)", "-->").getRegex();
var et = d3("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Ye).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var v2 = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/;
var tt = d3(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", v2).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var ke = d3(/^!?\[(label)\]\[(ref)\]/).replace("label", v2).replace("ref", U2).getRegex();
var de = d3(/^!?\[(ref)\](?:\[\])?/).replace("ref", U2).getRegex();
var nt = d3("reflink|nolink(?!\\()", "g").replace("reflink", ke).replace("nolink", de).getRegex();
var ie = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var J2 = { _backpedal: _2, anyPunctuation: Je, autolink: Ve, blockSkip: Ge, br: ue, code: qe, del: _2, delLDelim: _2, delRDelim: _2, emStrongLDelim: Ne, emStrongRDelimAst: je, emStrongRDelimUnd: Ue, escape: Be, link: tt, nolink: de, punctuation: ve, reflink: ke, reflinkSearch: nt, tag: et, text: De, url: _2 };
var rt = { ...J2, link: d3(/^!?\[(label)\]\((.*?)\)/).replace("label", v2).getRegex(), reflink: d3(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", v2).getRegex() };
var Q = { ...J2, emStrongRDelimAst: Fe, emStrongLDelim: Qe, delLDelim: Ke, delRDelim: Xe, url: d3(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ie).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: d3(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ie).getRegex() };
var st = { ...Q, br: d3(ue).replace("{2,}", "*").getRegex(), text: d3(Q.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var q = { normal: W, gfm: Ae, pedantic: Ce };
var A2 = { normal: J2, gfm: Q, breaks: st, pedantic: rt };
var it = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var ge = (l4) => it[l4];
function O3(l4, e2) {
  if (e2) {
    if (m3.escapeTest.test(l4)) return l4.replace(m3.escapeReplace, ge);
  } else if (m3.escapeTestNoEncode.test(l4)) return l4.replace(m3.escapeReplaceNoEncode, ge);
  return l4;
}
function V(l4) {
  try {
    l4 = encodeURI(l4).replace(m3.percentDecode, "%");
  } catch {
    return null;
  }
  return l4;
}
function Y(l4, e2) {
  let t2 = l4.replace(m3.findPipe, (r2, i2, o2) => {
    let u2 = false, a3 = i2;
    for (; --a3 >= 0 && o2[a3] === "\\"; ) u2 = !u2;
    return u2 ? "|" : " |";
  }), n2 = t2.split(m3.splitPipe), s2 = 0;
  if (n2[0].trim() || n2.shift(), n2.length > 0 && !n2.at(-1)?.trim() && n2.pop(), e2) if (n2.length > e2) n2.splice(e2);
  else for (; n2.length < e2; ) n2.push("");
  for (; s2 < n2.length; s2++) n2[s2] = n2[s2].trim().replace(m3.slashPipe, "|");
  return n2;
}
function $2(l4, e2, t2) {
  let n2 = l4.length;
  if (n2 === 0) return "";
  let s2 = 0;
  for (; s2 < n2; ) {
    let r2 = l4.charAt(n2 - s2 - 1);
    if (r2 === e2 && !t2) s2++;
    else if (r2 !== e2 && t2) s2++;
    else break;
  }
  return l4.slice(0, n2 - s2);
}
function ee(l4) {
  let e2 = l4.split(`
`), t2 = e2.length - 1;
  for (; t2 >= 0 && m3.blankLine.test(e2[t2]); ) t2--;
  return e2.length - t2 <= 2 ? l4 : e2.slice(0, t2 + 1).join(`
`);
}
function fe(l4, e2) {
  if (l4.indexOf(e2[1]) === -1) return -1;
  let t2 = 0;
  for (let n2 = 0; n2 < l4.length; n2++) if (l4[n2] === "\\") n2++;
  else if (l4[n2] === e2[0]) t2++;
  else if (l4[n2] === e2[1] && (t2--, t2 < 0)) return n2;
  return t2 > 0 ? -2 : -1;
}
function me(l4, e2 = 0) {
  let t2 = e2, n2 = "";
  for (let s2 of l4) if (s2 === "	") {
    let r2 = 4 - t2 % 4;
    n2 += " ".repeat(r2), t2 += r2;
  } else n2 += s2, t2++;
  return n2;
}
function xe(l4, e2, t2, n2, s2) {
  let r2 = e2.href, i2 = e2.title || null, o2 = l4[1].replace(s2.other.outputLinkReplace, "$1");
  n2.state.inLink = true;
  let u2 = { type: l4[0].charAt(0) === "!" ? "image" : "link", raw: t2, href: r2, title: i2, text: o2, tokens: n2.inlineTokens(o2) };
  return n2.state.inLink = false, u2;
}
function ot(l4, e2, t2) {
  let n2 = l4.match(t2.other.indentCodeCompensation);
  if (n2 === null) return e2;
  let s2 = n2[1];
  return e2.split(`
`).map((r2) => {
    let i2 = r2.match(t2.other.beginningSpace);
    if (i2 === null) return r2;
    let [o2] = i2;
    return o2.length >= s2.length ? r2.slice(s2.length) : r2;
  }).join(`
`);
}
var w3 = class {
  constructor(e2) {
    __publicField(this, "options");
    __publicField(this, "rules");
    __publicField(this, "lexer");
    this.options = e2 || T2;
  }
  space(e2) {
    let t2 = this.rules.block.newline.exec(e2);
    if (t2 && t2[0].length > 0) return { type: "space", raw: t2[0] };
  }
  code(e2) {
    let t2 = this.rules.block.code.exec(e2);
    if (t2) {
      let n2 = this.options.pedantic ? t2[0] : ee(t2[0]), s2 = n2.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n2, codeBlockStyle: "indented", text: s2 };
    }
  }
  fences(e2) {
    let t2 = this.rules.block.fences.exec(e2);
    if (t2) {
      let n2 = t2[0], s2 = ot(n2, t2[3] || "", this.rules);
      return { type: "code", raw: n2, lang: t2[2] ? t2[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t2[2], text: s2 };
    }
  }
  heading(e2) {
    let t2 = this.rules.block.heading.exec(e2);
    if (t2) {
      let n2 = t2[2].trim();
      if (this.rules.other.endingHash.test(n2)) {
        let s2 = $2(n2, "#");
        (this.options.pedantic || !s2 || this.rules.other.endingSpaceChar.test(s2)) && (n2 = s2.trim());
      }
      return { type: "heading", raw: $2(t2[0], `
`), depth: t2[1].length, text: n2, tokens: this.lexer.inline(n2) };
    }
  }
  hr(e2) {
    let t2 = this.rules.block.hr.exec(e2);
    if (t2) return { type: "hr", raw: $2(t2[0], `
`) };
  }
  blockquote(e2) {
    let t2 = this.rules.block.blockquote.exec(e2);
    if (t2) {
      let n2 = $2(t2[0], `
`).split(`
`), s2 = "", r2 = "", i2 = [];
      for (; n2.length > 0; ) {
        let o2 = false, u2 = [], a3;
        for (a3 = 0; a3 < n2.length; a3++) if (this.rules.other.blockquoteStart.test(n2[a3])) u2.push(n2[a3]), o2 = true;
        else if (!o2) u2.push(n2[a3]);
        else break;
        n2 = n2.slice(a3);
        let c3 = u2.join(`
`), p3 = c3.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        s2 = s2 ? `${s2}
${c3}` : c3, r2 = r2 ? `${r2}
${p3}` : p3;
        let k = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(p3, i2, true), this.lexer.state.top = k, n2.length === 0) break;
        let h3 = i2.at(-1);
        if (h3?.type === "code") break;
        if (h3?.type === "blockquote") {
          let R2 = h3, f3 = R2.raw + `
` + n2.join(`
`), S2 = this.blockquote(f3);
          i2[i2.length - 1] = S2, s2 = s2.substring(0, s2.length - R2.raw.length) + S2.raw, r2 = r2.substring(0, r2.length - R2.text.length) + S2.text;
          break;
        } else if (h3?.type === "list") {
          let R2 = h3, f3 = R2.raw + `
` + n2.join(`
`), S2 = this.list(f3);
          i2[i2.length - 1] = S2, s2 = s2.substring(0, s2.length - h3.raw.length) + S2.raw, r2 = r2.substring(0, r2.length - R2.raw.length) + S2.raw, n2 = f3.substring(i2.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: s2, tokens: i2, text: r2 };
    }
  }
  list(e2) {
    let t2 = this.rules.block.list.exec(e2);
    if (t2) {
      let n2 = t2[1].trim(), s2 = n2.length > 1, r2 = { type: "list", raw: "", ordered: s2, start: s2 ? +n2.slice(0, -1) : "", loose: false, items: [] };
      n2 = s2 ? `\\d{1,9}\\${n2.slice(-1)}` : `\\${n2}`, this.options.pedantic && (n2 = s2 ? n2 : "[*+-]");
      let i2 = this.rules.other.listItemRegex(n2), o2 = false;
      for (; e2; ) {
        let a3 = false, c3 = "", p3 = "";
        if (!(t2 = i2.exec(e2)) || this.rules.block.hr.test(e2)) break;
        c3 = t2[0], e2 = e2.substring(c3.length);
        let k = me(t2[2].split(`
`, 1)[0], t2[1].length), h3 = e2.split(`
`, 1)[0], R2 = !k.trim(), f3 = 0;
        if (this.options.pedantic ? (f3 = 2, p3 = k.trimStart()) : R2 ? f3 = t2[1].length + 1 : (f3 = k.search(this.rules.other.nonSpaceChar), f3 = f3 > 4 ? 1 : f3, p3 = k.slice(f3), f3 += t2[1].length), R2 && this.rules.other.blankLine.test(h3) && (c3 += h3 + `
`, e2 = e2.substring(h3.length + 1), a3 = true), !a3) {
          let S2 = this.rules.other.nextBulletRegex(f3), te = this.rules.other.hrRegex(f3), ne = this.rules.other.fencesBeginRegex(f3), re = this.rules.other.headingBeginRegex(f3), be = this.rules.other.htmlBeginRegex(f3), Re = this.rules.other.blockquoteBeginRegex(f3);
          for (; e2; ) {
            let G = e2.split(`
`, 1)[0], C2;
            if (h3 = G, this.options.pedantic ? (h3 = h3.replace(this.rules.other.listReplaceNesting, "  "), C2 = h3) : C2 = h3.replace(this.rules.other.tabCharGlobal, "    "), ne.test(h3) || re.test(h3) || be.test(h3) || Re.test(h3) || S2.test(h3) || te.test(h3)) break;
            if (C2.search(this.rules.other.nonSpaceChar) >= f3 || !h3.trim()) p3 += `
` + C2.slice(f3);
            else {
              if (R2 || k.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || ne.test(k) || re.test(k) || te.test(k)) break;
              p3 += `
` + h3;
            }
            R2 = !h3.trim(), c3 += G + `
`, e2 = e2.substring(G.length + 1), k = C2.slice(f3);
          }
        }
        r2.loose || (o2 ? r2.loose = true : this.rules.other.doubleBlankLine.test(c3) && (o2 = true)), r2.items.push({ type: "list_item", raw: c3, task: !!this.options.gfm && this.rules.other.listIsTask.test(p3), loose: false, text: p3, tokens: [] }), r2.raw += c3;
      }
      let u2 = r2.items.at(-1);
      if (u2) u2.raw = u2.raw.trimEnd(), u2.text = u2.text.trimEnd();
      else return;
      r2.raw = r2.raw.trimEnd();
      for (let a3 of r2.items) {
        this.lexer.state.top = false, a3.tokens = this.lexer.blockTokens(a3.text, []);
        let c3 = a3.tokens[0];
        if (a3.task && (c3?.type === "text" || c3?.type === "paragraph")) {
          a3.text = a3.text.replace(this.rules.other.listReplaceTask, ""), c3.raw = c3.raw.replace(this.rules.other.listReplaceTask, ""), c3.text = c3.text.replace(this.rules.other.listReplaceTask, "");
          for (let k = this.lexer.inlineQueue.length - 1; k >= 0; k--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[k].src)) {
            this.lexer.inlineQueue[k].src = this.lexer.inlineQueue[k].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let p3 = this.rules.other.listTaskCheckbox.exec(a3.raw);
          if (p3) {
            let k = { type: "checkbox", raw: p3[0] + " ", checked: p3[0] !== "[ ]" };
            a3.checked = k.checked, r2.loose ? a3.tokens[0] && ["paragraph", "text"].includes(a3.tokens[0].type) && "tokens" in a3.tokens[0] && a3.tokens[0].tokens ? (a3.tokens[0].raw = k.raw + a3.tokens[0].raw, a3.tokens[0].text = k.raw + a3.tokens[0].text, a3.tokens[0].tokens.unshift(k)) : a3.tokens.unshift({ type: "paragraph", raw: k.raw, text: k.raw, tokens: [k] }) : a3.tokens.unshift(k);
          }
        } else a3.task && (a3.task = false);
        if (!r2.loose) {
          let p3 = a3.tokens.filter((h3) => h3.type === "space"), k = p3.length > 0 && p3.some((h3) => this.rules.other.anyLine.test(h3.raw));
          r2.loose = k;
        }
      }
      if (r2.loose) for (let a3 of r2.items) {
        a3.loose = true;
        for (let c3 of a3.tokens) c3.type === "text" && (c3.type = "paragraph");
      }
      return r2;
    }
  }
  html(e2) {
    let t2 = this.rules.block.html.exec(e2);
    if (t2) {
      let n2 = ee(t2[0]);
      return { type: "html", block: true, raw: n2, pre: t2[1] === "pre" || t2[1] === "script" || t2[1] === "style", text: n2 };
    }
  }
  def(e2) {
    let t2 = this.rules.block.def.exec(e2);
    if (t2) {
      let n2 = t2[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), s2 = t2[2] ? t2[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r2 = t2[3] ? t2[3].substring(1, t2[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t2[3];
      return { type: "def", tag: n2, raw: $2(t2[0], `
`), href: s2, title: r2 };
    }
  }
  table(e2) {
    let t2 = this.rules.block.table.exec(e2);
    if (!t2 || !this.rules.other.tableDelimiter.test(t2[2])) return;
    let n2 = Y(t2[1]), s2 = t2[2].replace(this.rules.other.tableAlignChars, "").split("|"), r2 = t2[3]?.trim() ? t2[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], i2 = { type: "table", raw: $2(t2[0], `
`), header: [], align: [], rows: [] };
    if (n2.length === s2.length) {
      for (let o2 of s2) this.rules.other.tableAlignRight.test(o2) ? i2.align.push("right") : this.rules.other.tableAlignCenter.test(o2) ? i2.align.push("center") : this.rules.other.tableAlignLeft.test(o2) ? i2.align.push("left") : i2.align.push(null);
      for (let o2 = 0; o2 < n2.length; o2++) i2.header.push({ text: n2[o2], tokens: this.lexer.inline(n2[o2]), header: true, align: i2.align[o2] });
      for (let o2 of r2) i2.rows.push(Y(o2, i2.header.length).map((u2, a3) => ({ text: u2, tokens: this.lexer.inline(u2), header: false, align: i2.align[a3] })));
      return i2;
    }
  }
  lheading(e2) {
    let t2 = this.rules.block.lheading.exec(e2);
    if (t2) {
      let n2 = t2[1].trim();
      return { type: "heading", raw: $2(t2[0], `
`), depth: t2[2].charAt(0) === "=" ? 1 : 2, text: n2, tokens: this.lexer.inline(n2) };
    }
  }
  paragraph(e2) {
    let t2 = this.rules.block.paragraph.exec(e2);
    if (t2) {
      let n2 = t2[1].charAt(t2[1].length - 1) === `
` ? t2[1].slice(0, -1) : t2[1];
      return { type: "paragraph", raw: t2[0], text: n2, tokens: this.lexer.inline(n2) };
    }
  }
  text(e2) {
    let t2 = this.rules.block.text.exec(e2);
    if (t2) return { type: "text", raw: t2[0], text: t2[0], tokens: this.lexer.inline(t2[0]) };
  }
  escape(e2) {
    let t2 = this.rules.inline.escape.exec(e2);
    if (t2) return { type: "escape", raw: t2[0], text: t2[1] };
  }
  tag(e2) {
    let t2 = this.rules.inline.tag.exec(e2);
    if (t2) return !this.lexer.state.inLink && this.rules.other.startATag.test(t2[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t2[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t2[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t2[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t2[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t2[0] };
  }
  link(e2) {
    let t2 = this.rules.inline.link.exec(e2);
    if (t2) {
      let n2 = t2[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n2)) {
        if (!this.rules.other.endAngleBracket.test(n2)) return;
        let i2 = $2(n2.slice(0, -1), "\\");
        if ((n2.length - i2.length) % 2 === 0) return;
      } else {
        let i2 = fe(t2[2], "()");
        if (i2 === -2) return;
        if (i2 > -1) {
          let u2 = (t2[0].indexOf("!") === 0 ? 5 : 4) + t2[1].length + i2;
          t2[2] = t2[2].substring(0, i2), t2[0] = t2[0].substring(0, u2).trim(), t2[3] = "";
        }
      }
      let s2 = t2[2], r2 = "";
      if (this.options.pedantic) {
        let i2 = this.rules.other.pedanticHrefTitle.exec(s2);
        i2 && (s2 = i2[1], r2 = i2[3]);
      } else r2 = t2[3] ? t2[3].slice(1, -1) : "";
      return s2 = s2.trim(), this.rules.other.startAngleBracket.test(s2) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n2) ? s2 = s2.slice(1) : s2 = s2.slice(1, -1)), xe(t2, { href: s2 && s2.replace(this.rules.inline.anyPunctuation, "$1"), title: r2 && r2.replace(this.rules.inline.anyPunctuation, "$1") }, t2[0], this.lexer, this.rules);
    }
  }
  reflink(e2, t2) {
    let n2;
    if ((n2 = this.rules.inline.reflink.exec(e2)) || (n2 = this.rules.inline.nolink.exec(e2))) {
      let s2 = (n2[2] || n2[1]).replace(this.rules.other.multipleSpaceGlobal, " "), r2 = t2[s2.toLowerCase()];
      if (!r2) {
        let i2 = n2[0].charAt(0);
        return { type: "text", raw: i2, text: i2 };
      }
      return xe(n2, r2, n2[0], this.lexer, this.rules);
    }
  }
  emStrong(e2, t2, n2 = "") {
    let s2 = this.rules.inline.emStrongLDelim.exec(e2);
    if (!s2 || !s2[1] && !s2[2] && !s2[3] && !s2[4] || s2[4] && n2.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(s2[1] || s2[3] || "") || !n2 || this.rules.inline.punctuation.exec(n2)) {
      let i2 = [...s2[0]].length - 1, o2, u2, a3 = i2, c3 = 0, p3 = s2[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (p3.lastIndex = 0, t2 = t2.slice(-1 * e2.length + i2); (s2 = p3.exec(t2)) !== null; ) {
        if (o2 = s2[1] || s2[2] || s2[3] || s2[4] || s2[5] || s2[6], !o2) continue;
        if (u2 = [...o2].length, s2[3] || s2[4]) {
          a3 += u2;
          continue;
        } else if ((s2[5] || s2[6]) && i2 % 3 && !((i2 + u2) % 3)) {
          c3 += u2;
          continue;
        }
        if (a3 -= u2, a3 > 0) continue;
        u2 = Math.min(u2, u2 + a3 + c3);
        let k = [...s2[0]][0].length, h3 = e2.slice(0, i2 + s2.index + k + u2);
        if (Math.min(i2, u2) % 2) {
          let f3 = h3.slice(1, -1);
          return { type: "em", raw: h3, text: f3, tokens: this.lexer.inlineTokens(f3) };
        }
        let R2 = h3.slice(2, -2);
        return { type: "strong", raw: h3, text: R2, tokens: this.lexer.inlineTokens(R2) };
      }
    }
  }
  codespan(e2) {
    let t2 = this.rules.inline.code.exec(e2);
    if (t2) {
      let n2 = t2[2].replace(this.rules.other.newLineCharGlobal, " "), s2 = this.rules.other.nonSpaceChar.test(n2), r2 = this.rules.other.startingSpaceChar.test(n2) && this.rules.other.endingSpaceChar.test(n2);
      return s2 && r2 && (n2 = n2.substring(1, n2.length - 1)), { type: "codespan", raw: t2[0], text: n2 };
    }
  }
  br(e2) {
    let t2 = this.rules.inline.br.exec(e2);
    if (t2) return { type: "br", raw: t2[0] };
  }
  del(e2, t2, n2 = "") {
    let s2 = this.rules.inline.delLDelim.exec(e2);
    if (!s2) return;
    if (!(s2[1] || "") || !n2 || this.rules.inline.punctuation.exec(n2)) {
      let i2 = [...s2[0]].length - 1, o2, u2, a3 = i2, c3 = this.rules.inline.delRDelim;
      for (c3.lastIndex = 0, t2 = t2.slice(-1 * e2.length + i2); (s2 = c3.exec(t2)) !== null; ) {
        if (o2 = s2[1] || s2[2] || s2[3] || s2[4] || s2[5] || s2[6], !o2 || (u2 = [...o2].length, u2 !== i2)) continue;
        if (s2[3] || s2[4]) {
          a3 += u2;
          continue;
        }
        if (a3 -= u2, a3 > 0) continue;
        u2 = Math.min(u2, u2 + a3);
        let p3 = [...s2[0]][0].length, k = e2.slice(0, i2 + s2.index + p3 + u2), h3 = k.slice(i2, -i2);
        return { type: "del", raw: k, text: h3, tokens: this.lexer.inlineTokens(h3) };
      }
    }
  }
  autolink(e2) {
    let t2 = this.rules.inline.autolink.exec(e2);
    if (t2) {
      let n2, s2;
      return t2[2] === "@" ? (n2 = t2[1], s2 = "mailto:" + n2) : (n2 = t2[1], s2 = n2), { type: "link", raw: t2[0], text: n2, href: s2, tokens: [{ type: "text", raw: n2, text: n2 }] };
    }
  }
  url(e2) {
    let t2;
    if (t2 = this.rules.inline.url.exec(e2)) {
      let n2, s2;
      if (t2[2] === "@") n2 = t2[0], s2 = "mailto:" + n2;
      else {
        let r2;
        do
          r2 = t2[0], t2[0] = this.rules.inline._backpedal.exec(t2[0])?.[0] ?? "";
        while (r2 !== t2[0]);
        n2 = t2[0], t2[1] === "www." ? s2 = "http://" + t2[0] : s2 = t2[0];
      }
      return { type: "link", raw: t2[0], text: n2, href: s2, tokens: [{ type: "text", raw: n2, text: n2 }] };
    }
  }
  inlineText(e2) {
    let t2 = this.rules.inline.text.exec(e2);
    if (t2) {
      let n2 = this.lexer.state.inRawBlock;
      return { type: "text", raw: t2[0], text: t2[0], escaped: n2 };
    }
  }
};
var x2 = class l2 {
  constructor(e2) {
    __publicField(this, "tokens");
    __publicField(this, "options");
    __publicField(this, "state");
    __publicField(this, "inlineQueue");
    __publicField(this, "tokenizer");
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e2 || T2, this.options.tokenizer = this.options.tokenizer || new w3(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t2 = { other: m3, block: q.normal, inline: A2.normal };
    this.options.pedantic ? (t2.block = q.pedantic, t2.inline = A2.pedantic) : this.options.gfm && (t2.block = q.gfm, this.options.breaks ? t2.inline = A2.breaks : t2.inline = A2.gfm), this.tokenizer.rules = t2;
  }
  static get rules() {
    return { block: q, inline: A2 };
  }
  static lex(e2, t2) {
    return new l2(t2).lex(e2);
  }
  static lexInline(e2, t2) {
    return new l2(t2).inlineTokens(e2);
  }
  lex(e2) {
    e2 = e2.replace(m3.carriageReturn, `
`), this.blockTokens(e2, this.tokens);
    for (let t2 = 0; t2 < this.inlineQueue.length; t2++) {
      let n2 = this.inlineQueue[t2];
      this.inlineTokens(n2.src, n2.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e2, t2 = [], n2 = false) {
    this.tokenizer.lexer = this, this.options.pedantic && (e2 = e2.replace(m3.tabCharGlobal, "    ").replace(m3.spaceLine, ""));
    let s2 = 1 / 0;
    for (; e2; ) {
      if (e2.length < s2) s2 = e2.length;
      else {
        this.infiniteLoopError(e2.charCodeAt(0));
        break;
      }
      let r2;
      if (this.options.extensions?.block?.some((o2) => (r2 = o2.call({ lexer: this }, e2, t2)) ? (e2 = e2.substring(r2.raw.length), t2.push(r2), true) : false)) continue;
      if (r2 = this.tokenizer.space(e2)) {
        e2 = e2.substring(r2.raw.length);
        let o2 = t2.at(-1);
        r2.raw.length === 1 && o2 !== void 0 ? o2.raw += `
` : t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.code(e2)) {
        e2 = e2.substring(r2.raw.length);
        let o2 = t2.at(-1);
        o2?.type === "paragraph" || o2?.type === "text" ? (o2.raw += (o2.raw.endsWith(`
`) ? "" : `
`) + r2.raw, o2.text += `
` + r2.text, this.inlineQueue.at(-1).src = o2.text) : t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.fences(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.heading(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.hr(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.blockquote(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.list(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.html(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.def(e2)) {
        e2 = e2.substring(r2.raw.length);
        let o2 = t2.at(-1);
        o2?.type === "paragraph" || o2?.type === "text" ? (o2.raw += (o2.raw.endsWith(`
`) ? "" : `
`) + r2.raw, o2.text += `
` + r2.raw, this.inlineQueue.at(-1).src = o2.text) : this.tokens.links[r2.tag] || (this.tokens.links[r2.tag] = { href: r2.href, title: r2.title }, t2.push(r2));
        continue;
      }
      if (r2 = this.tokenizer.table(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      if (r2 = this.tokenizer.lheading(e2)) {
        e2 = e2.substring(r2.raw.length), t2.push(r2);
        continue;
      }
      let i2 = e2;
      if (this.options.extensions?.startBlock) {
        let o2 = 1 / 0, u2 = e2.slice(1), a3;
        this.options.extensions.startBlock.forEach((c3) => {
          a3 = c3.call({ lexer: this }, u2), typeof a3 == "number" && a3 >= 0 && (o2 = Math.min(o2, a3));
        }), o2 < 1 / 0 && o2 >= 0 && (i2 = e2.substring(0, o2 + 1));
      }
      if (this.state.top && (r2 = this.tokenizer.paragraph(i2))) {
        let o2 = t2.at(-1);
        n2 && o2?.type === "paragraph" ? (o2.raw += (o2.raw.endsWith(`
`) ? "" : `
`) + r2.raw, o2.text += `
` + r2.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o2.text) : t2.push(r2), n2 = i2.length !== e2.length, e2 = e2.substring(r2.raw.length);
        continue;
      }
      if (r2 = this.tokenizer.text(e2)) {
        e2 = e2.substring(r2.raw.length);
        let o2 = t2.at(-1);
        o2?.type === "text" ? (o2.raw += (o2.raw.endsWith(`
`) ? "" : `
`) + r2.raw, o2.text += `
` + r2.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o2.text) : t2.push(r2);
        continue;
      }
      if (e2) {
        this.infiniteLoopError(e2.charCodeAt(0));
        break;
      }
    }
    return this.state.top = true, t2;
  }
  inline(e2, t2 = []) {
    return this.inlineQueue.push({ src: e2, tokens: t2 }), t2;
  }
  inlineTokens(e2, t2 = []) {
    this.tokenizer.lexer = this;
    let n2 = e2, s2 = null;
    if (this.tokens.links) {
      let a3 = Object.keys(this.tokens.links);
      if (a3.length > 0) for (; (s2 = this.tokenizer.rules.inline.reflinkSearch.exec(n2)) !== null; ) a3.includes(s2[0].slice(s2[0].lastIndexOf("[") + 1, -1)) && (n2 = n2.slice(0, s2.index) + "[" + "a".repeat(s2[0].length - 2) + "]" + n2.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
    }
    for (; (s2 = this.tokenizer.rules.inline.anyPunctuation.exec(n2)) !== null; ) n2 = n2.slice(0, s2.index) + "++" + n2.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    let r2;
    for (; (s2 = this.tokenizer.rules.inline.blockSkip.exec(n2)) !== null; ) r2 = s2[2] ? s2[2].length : 0, n2 = n2.slice(0, s2.index + r2) + "[" + "a".repeat(s2[0].length - r2 - 2) + "]" + n2.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    n2 = this.options.hooks?.emStrongMask?.call({ lexer: this }, n2) ?? n2;
    let i2 = false, o2 = "", u2 = 1 / 0;
    for (; e2; ) {
      if (e2.length < u2) u2 = e2.length;
      else {
        this.infiniteLoopError(e2.charCodeAt(0));
        break;
      }
      i2 || (o2 = ""), i2 = false;
      let a3;
      if (this.options.extensions?.inline?.some((p3) => (a3 = p3.call({ lexer: this }, e2, t2)) ? (e2 = e2.substring(a3.raw.length), t2.push(a3), true) : false)) continue;
      if (a3 = this.tokenizer.escape(e2)) {
        e2 = e2.substring(a3.raw.length), t2.push(a3);
        continue;
      }
      if (a3 = this.tokenizer.tag(e2)) {
        e2 = e2.substring(a3.raw.length), t2.push(a3);
        continue;
      }
      if (a3 = this.tokenizer.link(e2)) {
        e2 = e2.substring(a3.raw.length), t2.push(a3);
        continue;
      }
      if (a3 = this.tokenizer.reflink(e2, this.tokens.links)) {
        e2 = e2.substring(a3.raw.length);
        let p3 = t2.at(-1);
        a3.type === "text" && p3?.type === "text" ? (p3.raw += a3.raw, p3.text += a3.text) : t2.push(a3);
        continue;
      }
      if (a3 = this.tokenizer.emStrong(e2, n2, o2)) {
        e2 = e2.substring(a3.raw.length), t2.push(a3);
        continue;
      }
      if (a3 = this.tokenizer.codespan(e2)) {
        e2 = e2.substring(a3.raw.length), t2.push(a3);
        continue;
      }
      if (a3 = this.tokenizer.br(e2)) {
        e2 = e2.substring(a3.raw.length), t2.push(a3);
        continue;
      }
      if (a3 = this.tokenizer.del(e2, n2, o2)) {
        e2 = e2.substring(a3.raw.length), t2.push(a3);
        continue;
      }
      if (a3 = this.tokenizer.autolink(e2)) {
        e2 = e2.substring(a3.raw.length), t2.push(a3);
        continue;
      }
      if (!this.state.inLink && (a3 = this.tokenizer.url(e2))) {
        e2 = e2.substring(a3.raw.length), t2.push(a3);
        continue;
      }
      let c3 = e2;
      if (this.options.extensions?.startInline) {
        let p3 = 1 / 0, k = e2.slice(1), h3;
        this.options.extensions.startInline.forEach((R2) => {
          h3 = R2.call({ lexer: this }, k), typeof h3 == "number" && h3 >= 0 && (p3 = Math.min(p3, h3));
        }), p3 < 1 / 0 && p3 >= 0 && (c3 = e2.substring(0, p3 + 1));
      }
      if (a3 = this.tokenizer.inlineText(c3)) {
        e2 = e2.substring(a3.raw.length), a3.raw.slice(-1) !== "_" && (o2 = a3.raw.slice(-1)), i2 = true;
        let p3 = t2.at(-1);
        p3?.type === "text" ? (p3.raw += a3.raw, p3.text += a3.text) : t2.push(a3);
        continue;
      }
      if (e2) {
        this.infiniteLoopError(e2.charCodeAt(0));
        break;
      }
    }
    return t2;
  }
  infiniteLoopError(e2) {
    let t2 = "Infinite loop on byte: " + e2;
    if (this.options.silent) console.error(t2);
    else throw new Error(t2);
  }
};
var y3 = class {
  constructor(e2) {
    __publicField(this, "options");
    __publicField(this, "parser");
    this.options = e2 || T2;
  }
  space(e2) {
    return "";
  }
  code({ text: e2, lang: t2, escaped: n2 }) {
    let s2 = (t2 || "").match(m3.notSpaceStart)?.[0], r2 = e2.replace(m3.endingNewline, "") + `
`;
    return s2 ? '<pre><code class="language-' + O3(s2) + '">' + (n2 ? r2 : O3(r2, true)) + `</code></pre>
` : "<pre><code>" + (n2 ? r2 : O3(r2, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e2 }) {
    return `<blockquote>
${this.parser.parse(e2)}</blockquote>
`;
  }
  html({ text: e2 }) {
    return e2;
  }
  def(e2) {
    return "";
  }
  heading({ tokens: e2, depth: t2 }) {
    return `<h${t2}>${this.parser.parseInline(e2)}</h${t2}>
`;
  }
  hr(e2) {
    return `<hr>
`;
  }
  list(e2) {
    let t2 = e2.ordered, n2 = e2.start, s2 = "";
    for (let o2 = 0; o2 < e2.items.length; o2++) {
      let u2 = e2.items[o2];
      s2 += this.listitem(u2);
    }
    let r2 = t2 ? "ol" : "ul", i2 = t2 && n2 !== 1 ? ' start="' + n2 + '"' : "";
    return "<" + r2 + i2 + `>
` + s2 + "</" + r2 + `>
`;
  }
  listitem(e2) {
    return `<li>${this.parser.parse(e2.tokens)}</li>
`;
  }
  checkbox({ checked: e2 }) {
    return "<input " + (e2 ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e2 }) {
    return `<p>${this.parser.parseInline(e2)}</p>
`;
  }
  table(e2) {
    let t2 = "", n2 = "";
    for (let r2 = 0; r2 < e2.header.length; r2++) n2 += this.tablecell(e2.header[r2]);
    t2 += this.tablerow({ text: n2 });
    let s2 = "";
    for (let r2 = 0; r2 < e2.rows.length; r2++) {
      let i2 = e2.rows[r2];
      n2 = "";
      for (let o2 = 0; o2 < i2.length; o2++) n2 += this.tablecell(i2[o2]);
      s2 += this.tablerow({ text: n2 });
    }
    return s2 && (s2 = `<tbody>${s2}</tbody>`), `<table>
<thead>
` + t2 + `</thead>
` + s2 + `</table>
`;
  }
  tablerow({ text: e2 }) {
    return `<tr>
${e2}</tr>
`;
  }
  tablecell(e2) {
    let t2 = this.parser.parseInline(e2.tokens), n2 = e2.header ? "th" : "td";
    return (e2.align ? `<${n2} align="${e2.align}">` : `<${n2}>`) + t2 + `</${n2}>
`;
  }
  strong({ tokens: e2 }) {
    return `<strong>${this.parser.parseInline(e2)}</strong>`;
  }
  em({ tokens: e2 }) {
    return `<em>${this.parser.parseInline(e2)}</em>`;
  }
  codespan({ text: e2 }) {
    return `<code>${O3(e2, true)}</code>`;
  }
  br(e2) {
    return "<br>";
  }
  del({ tokens: e2 }) {
    return `<del>${this.parser.parseInline(e2)}</del>`;
  }
  link({ href: e2, title: t2, tokens: n2 }) {
    let s2 = this.parser.parseInline(n2), r2 = V(e2);
    if (r2 === null) return s2;
    e2 = r2;
    let i2 = '<a href="' + e2 + '"';
    return t2 && (i2 += ' title="' + O3(t2) + '"'), i2 += ">" + s2 + "</a>", i2;
  }
  image({ href: e2, title: t2, text: n2, tokens: s2 }) {
    s2 && (n2 = this.parser.parseInline(s2, this.parser.textRenderer));
    let r2 = V(e2);
    if (r2 === null) return O3(n2);
    e2 = r2;
    let i2 = `<img src="${e2}" alt="${O3(n2)}"`;
    return t2 && (i2 += ` title="${O3(t2)}"`), i2 += ">", i2;
  }
  text(e2) {
    return "tokens" in e2 && e2.tokens ? this.parser.parseInline(e2.tokens) : "escaped" in e2 && e2.escaped ? e2.text : O3(e2.text);
  }
};
var L = class {
  strong({ text: e2 }) {
    return e2;
  }
  em({ text: e2 }) {
    return e2;
  }
  codespan({ text: e2 }) {
    return e2;
  }
  del({ text: e2 }) {
    return e2;
  }
  html({ text: e2 }) {
    return e2;
  }
  text({ text: e2 }) {
    return e2;
  }
  link({ text: e2 }) {
    return "" + e2;
  }
  image({ text: e2 }) {
    return "" + e2;
  }
  br() {
    return "";
  }
  checkbox({ raw: e2 }) {
    return e2;
  }
};
var b3 = class l3 {
  constructor(e2) {
    __publicField(this, "options");
    __publicField(this, "renderer");
    __publicField(this, "textRenderer");
    this.options = e2 || T2, this.options.renderer = this.options.renderer || new y3(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new L();
  }
  static parse(e2, t2) {
    return new l3(t2).parse(e2);
  }
  static parseInline(e2, t2) {
    return new l3(t2).parseInline(e2);
  }
  parse(e2) {
    this.renderer.parser = this;
    let t2 = "";
    for (let n2 = 0; n2 < e2.length; n2++) {
      let s2 = e2[n2];
      if (this.options.extensions?.renderers?.[s2.type]) {
        let i2 = s2, o2 = this.options.extensions.renderers[i2.type].call({ parser: this }, i2);
        if (o2 !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(i2.type)) {
          t2 += o2 || "";
          continue;
        }
      }
      let r2 = s2;
      switch (r2.type) {
        case "space": {
          t2 += this.renderer.space(r2);
          break;
        }
        case "hr": {
          t2 += this.renderer.hr(r2);
          break;
        }
        case "heading": {
          t2 += this.renderer.heading(r2);
          break;
        }
        case "code": {
          t2 += this.renderer.code(r2);
          break;
        }
        case "table": {
          t2 += this.renderer.table(r2);
          break;
        }
        case "blockquote": {
          t2 += this.renderer.blockquote(r2);
          break;
        }
        case "list": {
          t2 += this.renderer.list(r2);
          break;
        }
        case "checkbox": {
          t2 += this.renderer.checkbox(r2);
          break;
        }
        case "html": {
          t2 += this.renderer.html(r2);
          break;
        }
        case "def": {
          t2 += this.renderer.def(r2);
          break;
        }
        case "paragraph": {
          t2 += this.renderer.paragraph(r2);
          break;
        }
        case "text": {
          t2 += this.renderer.text(r2);
          break;
        }
        default: {
          let i2 = 'Token with "' + r2.type + '" type was not found.';
          if (this.options.silent) return console.error(i2), "";
          throw new Error(i2);
        }
      }
    }
    return t2;
  }
  parseInline(e2, t2 = this.renderer) {
    this.renderer.parser = this;
    let n2 = "";
    for (let s2 = 0; s2 < e2.length; s2++) {
      let r2 = e2[s2];
      if (this.options.extensions?.renderers?.[r2.type]) {
        let o2 = this.options.extensions.renderers[r2.type].call({ parser: this }, r2);
        if (o2 !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(r2.type)) {
          n2 += o2 || "";
          continue;
        }
      }
      let i2 = r2;
      switch (i2.type) {
        case "escape": {
          n2 += t2.text(i2);
          break;
        }
        case "html": {
          n2 += t2.html(i2);
          break;
        }
        case "link": {
          n2 += t2.link(i2);
          break;
        }
        case "image": {
          n2 += t2.image(i2);
          break;
        }
        case "checkbox": {
          n2 += t2.checkbox(i2);
          break;
        }
        case "strong": {
          n2 += t2.strong(i2);
          break;
        }
        case "em": {
          n2 += t2.em(i2);
          break;
        }
        case "codespan": {
          n2 += t2.codespan(i2);
          break;
        }
        case "br": {
          n2 += t2.br(i2);
          break;
        }
        case "del": {
          n2 += t2.del(i2);
          break;
        }
        case "text": {
          n2 += t2.text(i2);
          break;
        }
        default: {
          let o2 = 'Token with "' + i2.type + '" type was not found.';
          if (this.options.silent) return console.error(o2), "";
          throw new Error(o2);
        }
      }
    }
    return n2;
  }
};
var _a;
var P = (_a = class {
  constructor(e2) {
    __publicField(this, "options");
    __publicField(this, "block");
    this.options = e2 || T2;
  }
  preprocess(e2) {
    return e2;
  }
  postprocess(e2) {
    return e2;
  }
  processAllTokens(e2) {
    return e2;
  }
  emStrongMask(e2) {
    return e2;
  }
  provideLexer(e2 = this.block) {
    return e2 ? x2.lex : x2.lexInline;
  }
  provideParser(e2 = this.block) {
    return e2 ? b3.parse : b3.parseInline;
  }
}, __publicField(_a, "passThroughHooks", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"])), __publicField(_a, "passThroughHooksRespectAsync", /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"])), _a);
var D3 = class {
  constructor(...e2) {
    __publicField(this, "defaults", M2());
    __publicField(this, "options", this.setOptions);
    __publicField(this, "parse", this.parseMarkdown(true));
    __publicField(this, "parseInline", this.parseMarkdown(false));
    __publicField(this, "Parser", b3);
    __publicField(this, "Renderer", y3);
    __publicField(this, "TextRenderer", L);
    __publicField(this, "Lexer", x2);
    __publicField(this, "Tokenizer", w3);
    __publicField(this, "Hooks", P);
    this.use(...e2);
  }
  walkTokens(e2, t2) {
    let n2 = [];
    for (let s2 of e2) switch (n2 = n2.concat(t2.call(this, s2)), s2.type) {
      case "table": {
        let r2 = s2;
        for (let i2 of r2.header) n2 = n2.concat(this.walkTokens(i2.tokens, t2));
        for (let i2 of r2.rows) for (let o2 of i2) n2 = n2.concat(this.walkTokens(o2.tokens, t2));
        break;
      }
      case "list": {
        let r2 = s2;
        n2 = n2.concat(this.walkTokens(r2.items, t2));
        break;
      }
      default: {
        let r2 = s2;
        this.defaults.extensions?.childTokens?.[r2.type] ? this.defaults.extensions.childTokens[r2.type].forEach((i2) => {
          let o2 = r2[i2].flat(1 / 0);
          n2 = n2.concat(this.walkTokens(o2, t2));
        }) : r2.tokens && (n2 = n2.concat(this.walkTokens(r2.tokens, t2)));
      }
    }
    return n2;
  }
  use(...e2) {
    let t2 = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e2.forEach((n2) => {
      let s2 = { ...n2 };
      if (s2.async = this.defaults.async || s2.async || false, n2.extensions && (n2.extensions.forEach((r2) => {
        if (!r2.name) throw new Error("extension name required");
        if ("renderer" in r2) {
          let i2 = t2.renderers[r2.name];
          i2 ? t2.renderers[r2.name] = function(...o2) {
            let u2 = r2.renderer.apply(this, o2);
            return u2 === false && (u2 = i2.apply(this, o2)), u2;
          } : t2.renderers[r2.name] = r2.renderer;
        }
        if ("tokenizer" in r2) {
          if (!r2.level || r2.level !== "block" && r2.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let i2 = t2[r2.level];
          i2 ? i2.unshift(r2.tokenizer) : t2[r2.level] = [r2.tokenizer], r2.start && (r2.level === "block" ? t2.startBlock ? t2.startBlock.push(r2.start) : t2.startBlock = [r2.start] : r2.level === "inline" && (t2.startInline ? t2.startInline.push(r2.start) : t2.startInline = [r2.start]));
        }
        "childTokens" in r2 && r2.childTokens && (t2.childTokens[r2.name] = r2.childTokens);
      }), s2.extensions = t2), n2.renderer) {
        let r2 = this.defaults.renderer || new y3(this.defaults);
        for (let i2 in n2.renderer) {
          if (!(i2 in r2)) throw new Error(`renderer '${i2}' does not exist`);
          if (["options", "parser"].includes(i2)) continue;
          let o2 = i2, u2 = n2.renderer[o2], a3 = r2[o2];
          r2[o2] = (...c3) => {
            let p3 = u2.apply(r2, c3);
            return p3 === false && (p3 = a3.apply(r2, c3)), p3 || "";
          };
        }
        s2.renderer = r2;
      }
      if (n2.tokenizer) {
        let r2 = this.defaults.tokenizer || new w3(this.defaults);
        for (let i2 in n2.tokenizer) {
          if (!(i2 in r2)) throw new Error(`tokenizer '${i2}' does not exist`);
          if (["options", "rules", "lexer"].includes(i2)) continue;
          let o2 = i2, u2 = n2.tokenizer[o2], a3 = r2[o2];
          r2[o2] = (...c3) => {
            let p3 = u2.apply(r2, c3);
            return p3 === false && (p3 = a3.apply(r2, c3)), p3;
          };
        }
        s2.tokenizer = r2;
      }
      if (n2.hooks) {
        let r2 = this.defaults.hooks || new P();
        for (let i2 in n2.hooks) {
          if (!(i2 in r2)) throw new Error(`hook '${i2}' does not exist`);
          if (["options", "block"].includes(i2)) continue;
          let o2 = i2, u2 = n2.hooks[o2], a3 = r2[o2];
          P.passThroughHooks.has(i2) ? r2[o2] = (c3) => {
            if (this.defaults.async && P.passThroughHooksRespectAsync.has(i2)) return (async () => {
              let k = await u2.call(r2, c3);
              return a3.call(r2, k);
            })();
            let p3 = u2.call(r2, c3);
            return a3.call(r2, p3);
          } : r2[o2] = (...c3) => {
            if (this.defaults.async) return (async () => {
              let k = await u2.apply(r2, c3);
              return k === false && (k = await a3.apply(r2, c3)), k;
            })();
            let p3 = u2.apply(r2, c3);
            return p3 === false && (p3 = a3.apply(r2, c3)), p3;
          };
        }
        s2.hooks = r2;
      }
      if (n2.walkTokens) {
        let r2 = this.defaults.walkTokens, i2 = n2.walkTokens;
        s2.walkTokens = function(o2) {
          let u2 = [];
          return u2.push(i2.call(this, o2)), r2 && (u2 = u2.concat(r2.call(this, o2))), u2;
        };
      }
      this.defaults = { ...this.defaults, ...s2 };
    }), this;
  }
  setOptions(e2) {
    return this.defaults = { ...this.defaults, ...e2 }, this;
  }
  lexer(e2, t2) {
    return x2.lex(e2, t2 ?? this.defaults);
  }
  parser(e2, t2) {
    return b3.parse(e2, t2 ?? this.defaults);
  }
  parseMarkdown(e2) {
    return (n2, s2) => {
      let r2 = { ...s2 }, i2 = { ...this.defaults, ...r2 }, o2 = this.onError(!!i2.silent, !!i2.async);
      if (this.defaults.async === true && r2.async === false) return o2(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n2 > "u" || n2 === null) return o2(new Error("marked(): input parameter is undefined or null"));
      if (typeof n2 != "string") return o2(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n2) + ", string expected"));
      if (i2.hooks && (i2.hooks.options = i2, i2.hooks.block = e2), i2.async) return (async () => {
        let u2 = i2.hooks ? await i2.hooks.preprocess(n2) : n2, c3 = await (i2.hooks ? await i2.hooks.provideLexer(e2) : e2 ? x2.lex : x2.lexInline)(u2, i2), p3 = i2.hooks ? await i2.hooks.processAllTokens(c3) : c3;
        i2.walkTokens && await Promise.all(this.walkTokens(p3, i2.walkTokens));
        let h3 = await (i2.hooks ? await i2.hooks.provideParser(e2) : e2 ? b3.parse : b3.parseInline)(p3, i2);
        return i2.hooks ? await i2.hooks.postprocess(h3) : h3;
      })().catch(o2);
      try {
        i2.hooks && (n2 = i2.hooks.preprocess(n2));
        let a3 = (i2.hooks ? i2.hooks.provideLexer(e2) : e2 ? x2.lex : x2.lexInline)(n2, i2);
        i2.hooks && (a3 = i2.hooks.processAllTokens(a3)), i2.walkTokens && this.walkTokens(a3, i2.walkTokens);
        let p3 = (i2.hooks ? i2.hooks.provideParser(e2) : e2 ? b3.parse : b3.parseInline)(a3, i2);
        return i2.hooks && (p3 = i2.hooks.postprocess(p3)), p3;
      } catch (u2) {
        return o2(u2);
      }
    };
  }
  onError(e2, t2) {
    return (n2) => {
      if (n2.message += `
Please report this to https://github.com/markedjs/marked.`, e2) {
        let s2 = "<p>An error occurred:</p><pre>" + O3(n2.message + "", true) + "</pre>";
        return t2 ? Promise.resolve(s2) : s2;
      }
      if (t2) return Promise.reject(n2);
      throw n2;
    };
  }
};
var z = new D3();
function g3(l4, e2) {
  return z.parse(l4, e2);
}
g3.options = g3.setOptions = function(l4) {
  return z.setOptions(l4), g3.defaults = z.defaults, N2(g3.defaults), g3;
};
g3.getDefaults = M2;
g3.defaults = T2;
g3.use = function(...l4) {
  return z.use(...l4), g3.defaults = z.defaults, N2(g3.defaults), g3;
};
g3.walkTokens = function(l4, e2) {
  return z.walkTokens(l4, e2);
};
g3.parseInline = z.parseInline;
g3.Parser = b3;
g3.parser = b3.parse;
g3.Renderer = y3;
g3.TextRenderer = L;
g3.Lexer = x2;
g3.lexer = x2.lex;
g3.Tokenizer = w3;
g3.Hooks = P;
g3.parse = g3;
var Kt = g3.options;
var Wt = g3.setOptions;
var Xt = g3.use;
var Jt = g3.walkTokens;
var Vt = g3.parseInline;
var en = b3.parse;
var tn = x2.lex;

// src/vendor.js
var alertIcons = {
  success: "checkCircle",
  error: "cancel",
  warning: "warning",
  info: "info",
  question: "question"
};
var alertGlyphs = {
  checkCircle: "circle-check",
  cancel: "circle-x",
  warning: "alert-triangle",
  info: "info-circle",
  question: "help-circle"
};
var decorateSwalOptions = (options) => {
  if (!options || typeof options !== "object") return options;
  if (!options.icon || !alertIcons[options.icon] || options.iconHtml) return options;
  const glyph = alertGlyphs[alertIcons[options.icon]];
  return {
    ...options,
    iconHtml: `<span class="st-icon ti ti-${glyph}" aria-hidden="true"></span>`,
    customClass: {
      ...options.customClass,
      icon: ["swal2-st-icon", options.customClass?.icon].filter(Boolean).join(" ")
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
window.Tagify = N;
window.TomSelect = tom_select_complete_default;
window.marked = g3;
window.BsModal = Modal;
window.BsDropdown = Dropdown;
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
  N as Tagify,
  Toast,
  tom_select_complete_default as TomSelect,
  Tooltip,
  g3 as marked
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
  * sweetalert2 v11.26.25
  * Released under the MIT License.
  *)

@tabler/core/dist/js/tabler.esm.js:
  (*!
   * Tabler v1.4.0 (https://tabler.io)
   * Copyright 2018-2025 The Tabler Authors
   * Copyright 2018-2025 codecalm.net Paweł Kuna
   * Licensed under MIT (https://github.com/tabler/tabler/blob/master/LICENSE)
   *)
  (*!
    * Bootstrap v5.3.7 (https://getbootstrap.com/)
    * Copyright 2011-2025 The Bootstrap Authors (https://github.com/twbs/bootstrap/graphs/contributors)
    * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)
    *)
*/
//# sourceMappingURL=vendor.js.map
