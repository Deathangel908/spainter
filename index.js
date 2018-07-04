String.prototype.format = function() {
  var args = arguments,  replacement = 0;
  return this.replace(/\{\}/g, function() {
    return args[replacement++];
  });
};

String.prototype.formatPos = function () {
  var args = arguments;
  return this.replace(/{(\d+)}/g, function (match, number) {
    return typeof args[number] != 'undefined' ? args[number] : match;
  });
};


function Painter(containerPaitner) {

  containerPaitner.innerHTML = `<div class="toolsAndCanvas">
        <div class="painterTools">
        </div>
        <div class="canvasWrapper">
            <canvas></canvas>
            <span class="text hidden fixInput paintTextSpan" tabindex="-1"
                  contenteditable="true"></span>
            <div pos="m" class="paint-crp-rect">
                <div pos="l"></div>
                <div pos="r"></div>
                <div pos="t"></div>
                <div pos="b"></div>
                <div pos="tl"></div>
                <div pos="tr"></div>
                <div pos="bl"></div>
                <div pos="br"></div>
                <img class="paintPastedImg" pos="m"/>
            </div>
        </div>
    </div>
    <div class="bottomTools">
        <div title="Color" class="paintColor">
            <span>C:</span>
            <input type="color" value="#ff0000" class="value"/>
        </div>
        <div title="Alpha (color transparency)"
             class="paintOpacity">
            <span>A:</span>
            <input type="text" step="1" class="value" value="100"/>
            <div>
                <input type="range" step="1" max="100" min="0" value="100"/>
            </div>
        </div>
        <div title="Fill color" class="paintColorFill">
            <span>CF:</span>
            <input type="color" value="#0000ff" class="value"/>
        </div>
        <div title="Fill alpha" class="paintFillOpacity">
            <span>AF:</span>
            <input type="text" step="1" class="value" value="100"/>
            <div>
                <input type="range" step="1" max="100" min="0" value="100"/>
            </div>
        </div>
        <div title="Width" class="paintRadius">
            <span>W:</span>
            <input type="text" step="1" class="value" value="10"/>
            <div>
                <input type="range" step="1" max="100" min="1" value="10"/>
            </div>
        </div>
        <div title="Font" class="paintFont">
            <span>F:</span>
            <select class="value"></select>
        </div>
        <div class="paintResizeTools ">
            <input type="text" placeholder="width"/>
            <span>X</span>
            <input type="text" placeholder="height"/>
        </div>
        <div class="paintApplyText ">
            <input type="button" value="Apply" class="blue-btn value"/>
        </div>
        <input type="button" value="Paste" class="paintSend value blue-btn"/>
        <div class="paintXYdimens">
            <span class="paintXY" title="[x, y] zoom"></span>
            <span class="paintDimensions" title="width x height"></span><input
                type="checkbox" checked title="Trim image on send"
                class="trimImage"/>
        </div>
    </div>
    <div class="canvasResize"></div>`;

  var logsEnabled = true;
  var mouseWheelEventName = (/Firefox/i.test(navigator.userAgent)) ? "DOMMouseScroll" : "mousewheel";
  var tmpCanvasContext = document.createElement('canvas').getContext('2d');


  var CssUtils = {
    visibilityClass: 'pntrHidden',
    showElement: function (element) {
      CssUtils.removeClass(element, CssUtils.visibilityClass)
    },
    hideElement: function (element) {
      CssUtils.addClass(element, CssUtils.visibilityClass);
    },
    setClassToState: function(element, isVisible, clazz){
      if (isVisible) {
        CssUtils.removeClass(element, clazz);
      } else {
        CssUtils.addClass(element, clazz);
      }
    },
  };

  (function () {
    var cl = document.documentElement.classList;
    if (cl && cl.add) {
      CssUtils.addClass = function (element, className) {
        element.classList.add(className)
      }
    } else {
      CssUtils.addClass = function (element, className) {
        if (!CssUtils.hasClass(element, className)) {
          var oldClassName = element.className;
          element.className += (' '+ className);
        }
      }
    }
    if (cl && cl.remove) {
      CssUtils.removeClass = function (element, className) {
        element.classList.remove(className)
      }
    } else {
      CssUtils.removeClass = function (element, className) {
        if (element.className) {
          element.className.replace(new RegExp('(?:^|\\s)'+ className + '(?:\\s|$)'), ' ');
        }
      }
    }
    if (cl && cl.toggle) {
      CssUtils.toggleClass = function (element, className) {
        return element.classList.toggle(className)
      }
    } else {
      CssUtils.toggleClass = function (element, className) {
        if (CssUtils.hasClass(element, className)) {
          CssUtils.removeClass(element, className);
          return false;
        } else {
          CssUtils.addClass(element, className);
          return true;
        }
      }
    }
    if (cl && cl.contains) {
      CssUtils.hasClass = function (element, className) {
        return element.classList.contains(className);
      }
    } else {
      CssUtils.hasClass = function (element, className) {
        return element.className && element.className.split(' ').indexOf(className) >= 0;
      }
    }
  })();



  function log() {
    if (!logsEnabled) {
      return function dummy() {};
    }
    var args = Array.prototype.slice.call(arguments);
    var parts = args.shift().split('{}');
    var params = [window.console, '%c' + 'painter', 'red'];
    for (var i = 0; i < parts.length; i++) {
      params.push(parts[i]);
      if (typeof args[i] !== 'undefined') { // args can be '0'
        params.push(args[i])
      }
    }
    return Function.prototype.bind.apply(console.log, params);
  }


  var $ = function (id) {
    return containerPaitner.querySelector("." + id);
  };


  var self = this;
  self.zoom = 1;
  self.ZOOM_SCALE = 1.1;
  self.PICKED_TOOL_CLASS = 'active-icon';
  self.dom = {
    container: containerPaitner,
    canvas: containerPaitner.querySelector('canvas'),
    paintDimensions: $('paintDimensions'),
    paintXY: $('paintXY'),
    trimImage :  $('trimImage'),
    header: document.createElement('div'),
    canvasResize: $('canvasResize'),
    canvasWrapper: $('canvasWrapper')
  };
  self.tmp = new function() {
    var tool = this;
    tool.tmpCanvas = document.createElement('canvas');
    tool.tmpData = tool.tmpCanvas.getContext('2d');
    tool.saveState = function() {
      tool.tmpCanvas.width = self.dom.canvas.width;
      tool.tmpCanvas.height = self.dom.canvas.height;
      tool.tmpData.clearRect(0, 0, self.dom.canvas.width, self.dom.canvas.height);
      tool.tmpData.drawImage(self.dom.canvas, 0, 0);
      log("Context saved")();
    };
    tool.restoreState = function() {
      self.ctx.clearRect(0, 0, self.dom.canvas.width, self.dom.canvas.height);
      self.helper.drawImage(tool.tmpCanvas, 0, 0);
      //clear in case new image is transparen
    }
  };
  self.instruments = {
    color: {
      holder: $('paintColor'),
      handler: 'onChangeColor',
      ctxSetter: function (v) {
        self.ctx.strokeStyle = v;
      }
    },
    colorFill: {
      holder: $('paintColorFill'),
      handler: 'onChangeColorFill',
      ctxSetter: function (v) {
        self.ctx.fillStyle = v;
      }
    },
    opacityFill: {
      holder: $('paintFillOpacity'),
      handler: 'onChangeFillOpacity',
      range: true,
      ctxSetter: function (v) {
        self.instruments.opacityFill.inputValue = v / 100;
      }
    },
    apply: {
      holder: $('paintApplyText'),
      trigger: 'click',
      handler: 'onApply'
    },
    opacity: {
      holder: $('paintOpacity'),
      handler: 'onChangeOpacity',
      range: true,
      ctxSetter: function (v) {
        self.ctx.globalAlpha = v / 100;
        self.instruments.opacity.inputValue = v / 100;
      }
    },
    width: {
      range: true,
      holder: $('paintRadius'),
      handler: 'onChangeRadius',
      ctxSetter: function (v) {
        self.ctx.lineWidth = v;
      },
    },
    font: {
      holder: $('paintFont'),
      handler: 'onChangeFont',
      ctxSetter: function (v) {
        self.ctx.fontFamily = v;
      }
    }
  };
  self.init = {
    createFullScreen: function () {
      self.dom.header.ondblclick = function () {
        var w = window,
          d = document,
          e = d.documentElement,
          g = d.getElementsByTagName('body')[0],
          x = w.innerWidth || e.clientWidth || g.clientWidth,
          y = w.innerHeight || e.clientHeight || g.clientHeight

        self.dom.canvasWrapper.style.width = x - 60 + 'px';
        self.dom.canvasWrapper.style.height = y - 95 + 'px';
        self.dom.container.style.left = '1px';
        self.dom.container.style.top = '1px';
      };
    },
    createCanvas: function() {
      self.ctx = self.dom.canvas.getContext('2d');
      self.ctx.imageSmoothingEnabled= false;
      self.ctx.mozImageSmoothingEnabled = false;
      var height = Math.max(document.body.scrollHeight, document.body.offsetHeight, document.documentElement.clientHeight,
        document.documentElement.scrollHeight, document.documentElement.offsetHeight);
      var width = Math.max(document.body.scrollHeight, document.body.offsetHeight, document.documentElement.clientHeight,
        document.documentElement.scrollHeight, document.documentElement.offsetHeight);
      self.helper.setDimensions(500, 500);
      self.dom.canvasWrapper.style.height = height * 0.9 - 100 + 'px'
      self.dom.canvasWrapper.style.width = width * 0.9 - 80 + 'px'
    },
    // fixInput: self.fixInputs, TODO
    initInstruments: function () { // TODO this looks bad
      Object.keys(self.instruments).forEach(function (k) {
        var instr = self.instruments[k];
        instr.value = instr.holder.querySelector('.value')
        instr.value.addEventListener(instr.trigger || 'input', function (e) {
          if (instr.range && instr.value.value.length > 2 && this.value != 100) { // != isntead !== in case it's a string
            instr.value.value = this.value.slice(0, 2)
          }
          instr.ctxSetter && instr.ctxSetter(e.target.value);
          var handler = self.tools[self.mode][instr.handler];
          handler && handler(e);
          if (instr.range) {
            instr.range.value = instr.value.value;
            fixInputRangeStyle(instr.range);
          }
        });
        if (instr.range) {
          instr.value.addEventListener('keypress', function (e) {
            var charCode = e.which || e.keyCode;
            return charCode > 47 && charCode < 58;
          });
          instr.range = instr.holder.querySelector('input[type=range]');
          instr.range.addEventListener('input', function (e) {
            instr.value.value = instr.range.value;
            instr.ctxSetter(e.target.value);
            var handler = self.tools[self.mode][instr.handler];
            handler && handler(e);
          });
        }
      });
    },
    setContext: function () {
      Object.keys(self.instruments).forEach(function (k) {
        var instr = self.instruments[k];
        instr.ctxSetter && instr.ctxSetter(instr.value.value);
      });
    },
    initTools: function () {
      var toolsHolder = $('painterTools');
      self.keyProcessors = [];
      $('paintSend').onclick = self.helper.pasteToTextArea;
      function createIcon(keyActivator,f) {
        var i = document.createElement('i');
        toolsHolder.appendChild(i);
        i.setAttribute('title', keyActivator.title);
        i.className = keyActivator.icon;
        keyActivator.clickAction = f;
        i.onclick = f;
        self.keyProcessors.push(keyActivator);
        return i;
      }
      for (var tool in self.tools) {
        if (!self.tools.hasOwnProperty(tool)) continue;
        self.tools[tool].icon = createIcon(self.tools[tool].keyActivator, self.setMode.bind(self, tool));
      }
      self.actions.forEach(function(a) {
        var i = createIcon(a.keyActivator, function(e) {
          a.handler(e);
          self.helper.applyZoom();
        });
      });
    },
    checkEventCodes: function() {
      var check = [];
      self.keyProcessors.forEach(function (proc) {
        if (check.indexOf(proc.code) >= 0) {
          throw "key " + proc.code + "is used";
        }
        check.push(proc.code);
      });
      log("Registered keys: {}", JSON.stringify(check))();
    },
    initCanvas: function () {
      [
        {dom: self.dom.canvas, listener: ['mousedown', 'touchstart'], handler: 'onmousedown'},
        {dom: self.dom.canvas, listener: ['mousemove', 'touchmove'], handler: 'onmousemove'},
        {dom: self.dom.container, listener: 'keydown', handler: 'contKeyPress', params: false},
        {dom: document.body, listener: 'paste', handler: 'canvasImagePaste', params: false},
        {dom: self.dom.canvasWrapper, listener: mouseWheelEventName, handler: 'onmousewheel', params: {passive: false}},
        {dom: self.dom.container, listener: 'drop', handler: 'canvasImageDrop', params: {passive: false}},
        {dom: self.dom.canvasResize, listener: 'mousedown', handler: 'painterResize'}
      ].forEach(function (e) {
        var listeners = Array.isArray(e.listener) ? e.listener: [e.listener];
        listeners.forEach(function(listener) {
          e.dom.addEventListener(listener, self.events[e.handler], e.params);
        });

      });
    },
    createFonts: function () {
      var select = self.instruments.font.value;
      var fonts = [
        'Arial, Helvetica, sans-serif',
        '"Arial Black", Gadget, sans-serif',
        '"Comic Sans MS", cursive, sans-serif',
        'Impact, Charcoal, sans-serif',
        '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
        'Tahoma, Geneva, sans-serif',
        '"Trebuchet MS", Helvetica, sans-serif',
        'Verdana, Geneva, sans-serif',
        '"Courier New", Courier, monospace',
        '"Lucida Console", Monaco, monospace'
      ];
      fonts.forEach(function (t) {
        var o = document.createElement('option');
        select.appendChild(o);
        o.textContent = t;
        o.style.fontFamily = t;
        o.value = t;
      });
    },
  };
  self.helper = {
    setUIText: function(text) {
      self.dom.paintXY.textContent = text + ' ' + Math.round(self.zoom * 100) + '%';
    },
    openCanvas: function (e) {
      self.show();
      self.buffer.clear();
      self.init.setContext();
      self.setMode('pen');
    },
    getPageXY: function(e) {
      return {
        pageX: e.pageX || e.touches[0].pageX,
        pageY: e.pageY || e.touches[0].pageY,
      }
    },
    pasteToTextArea: function () {
      if (singlePage.currentPage.pageName != 'channels') {
        return;
      }
      if (self.dom.trimImage.checked) {
        var trimImage = self.helper.trimImage();
        if (trimImage) {
          trimImage.toBlob(Utils.pasteBlobImgToTextArea);
          self.hide();
        } else {
          growlError("You can't paste empty images");
        }
      } else {
        self.dom.canvas.toBlob(Utils.pasteBlobImgToTextArea);
        self.hide();
      }
    },
    drawImage: function() {
      var savedA = self.ctx.globalAlpha;
      self.ctx.globalAlpha = 1;
      self.ctx.drawImage.apply(self.ctx, arguments);
      self.ctx.globalAlpha = savedA;
    },
    setCursor: function(text) {
      self.dom.canvas.style.cursor = text;
    },
    buildCursor: function (fill, stroke, width) {
      if (width < 3) {
        width = 3;
      } else if (width > 126) {
        width = 126;
      }
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" height="128" width="128"><circle cx="64" cy="64" r="{0}" fill="{1}"{2}/></svg>'.formatPos(width, fill, stroke);
      return 'url(data:image/svg+xml;base64,{}) {} {}, auto'.format(btoa(svg), 64, 64);
    },
    isNumberKey: function (evt) {
      var charCode = evt.which || evt.keyCode;
      return charCode > 47 && charCode < 58;
    },
    trimImage: function () { // TODO this looks bad
      var pixels = self.ctx.getImageData(0, 0, self.dom.canvas.width, self.dom.canvas.height),
        l = pixels.data.length,
        i,
        bound = {
          top: null,
          left: null,
          right: null,
          bottom: null
        },
        x, y;
      for (i = 0; i < l; i += 4) {
        if (pixels.data[i + 3] !== 0) {
          x = (i / 4) % self.dom.canvas.width;
          y = ~~((i / 4) / self.dom.canvas.width);
          if (bound.top === null) {
            bound.top = y;
          }
          if (bound.left === null) {
            bound.left = x;
          } else if (x < bound.left) {
            bound.left = x;
          }
          if (bound.right === null) {
            bound.right = x;
          } else if (bound.right < x) {
            bound.right = x;
          }
          if (bound.bottom === null) {
            bound.bottom = y;
          } else if (bound.bottom < y) {
            bound.bottom = y;
          }
        }
      }
      var trimHeight = bound.bottom - bound.top,
        trimWidth = bound.right - bound.left;
      if (trimWidth && trimHeight) {
        var trimmed = self.ctx.getImageData(bound.left, bound.top, trimWidth, trimHeight);
        tmpCanvasContext.canvas.width = trimWidth;
        tmpCanvasContext.canvas.height = trimHeight;
        tmpCanvasContext.putImageData(trimmed, 0, 0);
        return tmpCanvasContext.canvas;
      } else {
        return false;
      }
    },
    setZoom: function (isIncrease) {
      if (isIncrease) {
        self.zoom *= self.ZOOM_SCALE;
      } else {
        self.zoom /= self.ZOOM_SCALE;
      }
      self.helper.setUIText(self.dom.paintXY.textContent.split(' ')[0]);
      if (self.tools[self.mode].onZoomChange) {
        self.tools[self.mode].onZoomChange(self.zoom);
      }
    },
    applyZoom: function() {
      self.dom.canvas.style.width = self.dom.canvas.width * self.zoom + 'px';
      self.dom.canvas.style.height = self.dom.canvas.height * self.zoom + 'px';
    },
    getScaledOrdinate: function (ordinateName, clientOrdinateName, value) {
      var clientOrdinate = self.dom.canvas[clientOrdinateName];
      var ordinate = self.dom.canvas[ordinateName];
      return ordinate == clientOrdinate ? value : Math.round(ordinate * value / clientOrdinate); // apply page zoom
    },
    getOffset: function (el) {
      var _x = 0;
      var _y = 0;
      while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
        _x += el.offsetLeft - el.scrollLeft;
        _y += el.offsetTop - el.scrollTop;
        el = el.offsetParent;
      }
      return {offsetTop: _y, offsetLeft: _x};
    },
    setOffset: function(e) {
      if (!e.offsetX && e.touches) {
        var offset = self.helper.getOffset(self.dom.canvas);
        var pxy = self.helper.getPageXY(e);
        e.offsetX = Math.round(pxy.pageX- offset.offsetLeft);
        e.offsetY = Math.round(pxy.pageY- offset.offsetTop);
      }
    },
    getXY: function (e) {
      var newVar = {
        x: self.helper.getScaledOrdinate('width', 'clientWidth', e.offsetX),
        y: self.helper.getScaledOrdinate('height', 'clientHeight', e.offsetY)
      };
      return newVar
    },
    setDimensions: function(w, h) {
      var state = self.buffer.getState();
      w = parseInt(w);
      h = parseInt(h);
      self.dom.canvas.width = w;
      self.dom.canvas.height = h;
      self.buffer.restoreState(state);
      self.dom.paintDimensions.textContent = '{}x{}'.format(w, h);
    }
  };
  self.Appliable = function() {
    var tool = this;
    tool.applyBtn = document.querySelector('#paintApplyText input[type=button]');
    tool.enableApply = function() {
      tool.applyBtn.removeAttribute('disabled');
    };
    tool.disableApply = function() {
      tool.applyBtn.setAttribute('disabled', 'disabled');
    };
  };
  self.events = {
    mouseDown: false,
    onmousedown: function (e) {
      var tool = self.tools[self.mode];
      if (!tool.onMouseDown) {
        return;
      }
      self.helper.setOffset(e);
      // log("{} mouse down", self.mode)();
      self.events.mouseDown = true
      var rect = self.dom.canvas.getBoundingClientRect();
      var imgData;
      if (!tool.bufferHandler) {
        imgData = self.buffer.startAction();
      }
      tool.onMouseDown(e, imgData);
    },
    onmousemove: function(e) {
      var tool = self.tools[self.mode];
      self.helper.setOffset(e);
      var xy = self.helper.getXY(e);
      self.helper.setUIText("[{},{}]".format(xy.x, xy.y));
      if (self.events.mouseDown && tool.onMouseMove) {
        tool.onMouseMove(e, xy);
      }
    },
    onmouseup: function (e) {
      if (self.events.mouseDown) {
        self.events.mouseDown = false;
        var tool = self.tools[self.mode];
        if (!tool.bufferHandler) {
          self.buffer.finishAction();
        }
        var mu = tool.onMouseUp;
        if (mu) {
          // log("{} mouse up", self.mode)();
          mu(e)
        }
      }
    },
    onmousewheel: function (e) {
      if (!e.ctrlKey) {
        return;
      }
      e.preventDefault();
      self.helper.setOffset(e);
      var xy = self.helper.getXY(e)
      self.helper.setZoom(e.detail < 0 || e.wheelDelta > 0); // isTop
      self.helper.applyZoom()
      var clientRect = self.dom.canvasWrapper.getBoundingClientRect();
      var scrollLeft = (xy.x * self.zoom) - (e.clientX - clientRect.left);
      var scrollTop = (xy.y * self.zoom) - (e.clientY - clientRect.top);
      self.dom.canvasWrapper.scrollLeft = scrollLeft
      self.dom.canvasWrapper.scrollTop = scrollTop;
    },
    contKeyPress: function (event) {
      log("keyPress: {} ({})", event.keyCode, event.code)();
      if (event.keyCode === 13) {
        if (self.tools[self.mode].onApply) {
          self.tools[self.mode].onApply();
        } else {
          self.helper.pasteToTextArea();
        }
      }
      self.keyProcessors.forEach(function(proc) {
        if (event.code == proc.code
          && (!proc.ctrlKey || (proc.ctrlKey && event.ctrlKey))) {
          proc.clickAction(event);
        }
      });
    },
    painterResize: function(e) {
      var st = self.dom.canvasWrapper.style;
      var w = parseInt(st.width.split('px')[0]);
      var h = parseInt(st.height.split('px')[0]);
      var pxy =self.helper.getPageXY(e);
      var listener = function(e) {
        var cxy = self.helper.getPageXY(e);
        self.dom.canvasWrapper.style.width = w - pxy.pageX + cxy.pageX + 'px';
        self.dom.canvasWrapper.style.height = h - pxy.pageY + cxy.pageY + 'px';
      };
      log("Added mousmove. touchmove")();
      document.addEventListener('mousemove', listener);
      document.addEventListener('touchmove', listener);
      var remove = function() {
        document.removeEventListener('mousemove', listener);
        document.removeEventListener('touchmove', listener);
      };
      document.addEventListener('mouseup', remove);
      document.addEventListener('touchend', remove);
    },
    canvasImageDrop: function (e) {
      self.dropImg(e.dataTransfer.files, e, function(e) {
        return e
      });
    },
    canvasImagePaste: function (e) {
      if (document.activeElement === self.dom.container && e.clipboardData) {
        self.dropImg(e.clipboardData.items, e, function (b) {
          return b.getAsFile();
        })
      }
    }
  };
  self.dropImg = function (files, e, getter) {
    if (files) {
      for (var i = 0; i < files.length; i++) {
        if (files[i].type.indexOf('image') >= 0) {
          log("Pasting images")();
          self.setMode('img');
          self.tools.img.readAndPasteCanvas(getter(files[i]));
          self.preventDefault(e);
          return;
        }
      }
    }
  };
  self.resizer = new (function() {
    var tool = this;
    tool.cursorStyle = document.createElement('style');
    document.head.appendChild(tool.cursorStyle);
    tool.imgHolder = $('paint-crp-rect');
    tool.params = {
      alias: {
        width: 'ow',
        height: 'oh',
        top: 'oy',
        left: 'ox'
      },
      restoreOrd: function(name, padd) {
        log("restore ord {} {}", name, padd)();
        var alias = tool.params.alias[name];
        tool.params[name] = tool.params.lastCoord[alias] + (padd ? tool.params.lastCoord[padd] : 0)  ;
        tool.imgHolder.style[name] = tool.params[name]* self.zoom + 'px';
      },
      setOrd: function(name, v, ampl, padding) {
        log("setOrd ord {} {} {} {}", name, v, ampl, padding)();
        ampl = ampl || 1;
        padding = padding || 0;
        var alias = tool.params.alias[name];
        tool.imgHolder.style[name] = ampl * ((tool.params.lastCoord[alias] + padding) * self.zoom)+ v + 'px';
        tool.params[name] = ampl * tool.params.lastCoord[alias] + v / self.zoom + padding;
      },
      rotate: function() {
        var w = tool.imgHolder.style.width;
        tool.imgHolder.style.width = tool.imgHolder.style.height;
        tool.imgHolder.style.height = w;
        w = tool.params.width;
        tool.params.width = tool.params.height;
        tool.params.height = w;
      }
    };
    tool.setMode = function (m) {
      tool.mode = m;
    };
    tool.setData = function (t, l, w, h) {
      tool.params.top = t / self.zoom;
      tool.params.left = l / self.zoom;
      tool.params.width = w;
      tool.params.height = h;
      tool.imgHolder.style.left = l - 1 + 'px';
      tool.imgHolder.style.top = t - 1 + 'px';
      tool.imgHolder.style.width = w * self.zoom + 2 + 'px';
      tool.imgHolder.style.height = h * self.zoom + +2 + 'px';
    };
    tool._setCursor = function (cursor) {
      tool.cursorStyle.textContent = cursor ? ".paintPastedImg, .paint-crp-rect, .painter {cursor: {} !important}".format(cursor) : ""
    };
    tool.onZoomChange = function () {
      tool.imgHolder.style.width = tool.params.width * self.zoom + 2 + 'px';
      tool.imgHolder.style.height = tool.params.height * self.zoom + 2 + 'px';
      tool.imgHolder.style.top = tool.params.top * self.zoom - 1 + 'px';
      tool.imgHolder.style.left = tool.params.left * self.zoom - 1 + 'px';
    };
    tool.show = function () {
      CssUtils.showElement(tool.imgHolder);
      log("Adding mouseUp doc listener")();
      document.addEventListener('mouseup', tool.docMouseUp);
      document.addEventListener('touchend', tool.docMouseUp);
    };
    tool.hide = function() {
      tool._setCursor(null);
      CssUtils.hideElement(tool.imgHolder);
      log("Removing mouseUp doc listener")();
      tool.docMouseUp();
      document.removeEventListener('mouseup', tool.docMouseUp);
      document.removeEventListener('touchend', tool.docMouseUp);
    };
    tool.trackMouseMove = function(e, mode) {
      log("Resizer mousedown")();
      tool.mode = mode || e.target.getAttribute('pos');
      self.dom.canvasWrapper.addEventListener('mousemove', tool.handleMouseMove);
      self.dom.canvasWrapper.addEventListener('touchmove', tool.handleMouseMove);
      tool.setParamsFromEvent(e);
      tool._setCursor(tool.cursors[tool.mode]);
    };
    tool.imgHolder.onmousedown = tool.trackMouseMove;
    tool.imgHolder.ontouchstart = tool.trackMouseMove;
    tool.setParamsFromEvent = function(e) {
      var pxy =self.helper.getPageXY(e);
      tool.params.lastCoord = {
        x: pxy.pageX,
        y: pxy.pageY,
        ox: tool.params.left, // origin x
        oy: tool.params.top, // origin y
        ow: tool.params.width, // origin width
        oh: tool.params.height, // origin height
        op: tool.params.width / tool.params.height // origin proportion
      };
      // ( lastCoord.op * x)^2 + x^2 = z;
      tool.params.lastCoord.nl = Math.pow(tool.params.lastCoord.op, 2) + 1;
    };
    tool.docMouseUp = function (e) {
      //log("Resizer mouseup")();
      self.dom.canvasWrapper.removeEventListener('mousemove', tool.handleMouseMove);
      self.dom.canvasWrapper.removeEventListener('touchmove', tool.handleMouseMove);
    };
    tool.cursors = {
      m: 'move',
      b: 's-resize',
      t: 's-resize',
      l: 'e-resize',
      r: 'e-resize',
      tl: 'se-resize',
      br: 'se-resize',
      bl: 'ne-resize',
      tr: 'ne-resize'
    };
    tool.handlers = {
      m: function (x, y) {
        tool.params.setOrd('top', y);
        tool.params.setOrd('left', x);
      },
      b: function (x, y) {
        if (y / self.zoom < -tool.params.lastCoord.oh) {
          tool.params.setOrd('height', -y, -1);
          tool.params.setOrd('top', y, null, tool.params.lastCoord.oh);
        } else {
          tool.params.setOrd('height', y);
          tool.params.restoreOrd('top');
        }
      },
      t: function (x, y) {
        if (y / self.zoom > tool.params.lastCoord.oh) {
          tool.params.setOrd('height', y, -1);
          tool.params.restoreOrd('top', 'oh');
        } else {
          tool.params.setOrd('top', y);
          tool.params.setOrd('height', -y);
        }
      },
      l: function (x, y) {
        if (x / self.zoom  > tool.params.lastCoord.ow) {
          tool.params.setOrd('width', x, -1);
          tool.params.restoreOrd('left', 'ow');
        } else {
          tool.params.setOrd('left', x);
          tool.params.setOrd('width', -x);
        }
      },
      r: function (x, y) {
        if (x / self.zoom  < -tool.params.lastCoord.ow) {
          tool.params.setOrd('width', -x, -1);
          tool.params.setOrd('left', x, null, tool.params.lastCoord.ow);
        } else {
          tool.params.restoreOrd('left');
          tool.params.setOrd('width', x);
        }
      }
    };
    tool.calcProportion = function (x, y) {
      var d = {
        tl: {dx: 1, dy: 1},
        tr: {dx: 1, dy: -1},
        bl: {dx: -1, dy: 1},
        br: {dx: 1, dy: 1}
      }[tool.mode];
      var dx = x > 0 ? 1 : -1;
      var dy = y > 0 ? 1 : -1;
      var nl = x * x * dx * d.dx + y * y * dy * d.dy;
      var dnl = nl > 0 ? 1 : -1;
      var v = dnl * Math.sqrt(Math.abs(nl) / tool.params.lastCoord.nl);
      y = v * d.dy;
      x = v * tool.params.lastCoord.op * d.dx;
      return {x: x, y: y};
    };
    tool.handleMouseMove = function (e) {
      //log('handleMouseMove {}', e)();
      var pxy =self.helper.getPageXY(e);
      var x = pxy.pageX - tool.params.lastCoord.x;
      var y = pxy.pageY - tool.params.lastCoord.y;
      if (e.shiftKey && tool.mode.length === 2) {
        var __ret = tool.calcProportion(x, y);
        x = __ret.x;
        y = __ret.y;
      }
      log('handleMouseMove ({}, {})', x, y)();
      tool.handlers[tool.mode.charAt(0)](x, y);
      if (tool.mode.length === 2) {
        tool.handlers[tool.mode.charAt(1)](x, y);
      }
    };
  })();
  self.tools = {
    select: new (function () {
      var tool = this;
      self.Appliable.call(this);
      tool.keyActivator = {
        code: 'KeyS',
        icon: '' +
        'icon-selection',
        title: 'Select (S)'
      };
      tool.bufferHandler = true;
      tool.domImg = $('paintPastedImg');
      tool.getCursor = function () {
        return 'crosshair';
      };
      tool.onActivate = function() {
        tool.inProgress = false;
        tool.mouseUpClicked = false;
      };
      // document.addEventListener('copy', tool.onCopy);
      tool.onZoomChange = self.resizer.onZoomChange;
      tool.onDeactivate = function () {
        if (tool.inProgress) {
          var params = self.resizer.params;
          log(
            'Applying image {}, {}x{}, to  {x: {}, y: {}, w: {}, h:{}',
            tool.imgInfo.width,
            tool.imgInfo.height,
            params.left,
            params.top,
            params.width,
            params.height
          )();
          self.helper.drawImage(tool.domImg,
            0, 0, tool.imgInfo.width, tool.imgInfo.height,
            params.left, params.top, params.width, params.height);
          self.buffer.finishAction();
          tool.inProgress = false; // don't restore in onDeactivate
        }
        self.resizer.hide();
        CssUtils.hideElement(tool.domImg);
      };
      tool.isSelectionActive = function() {
        return self.mode === 'select' && tool.inProgress && tool.mouseUpClicked;
      };
      tool.onMouseDown = function (e) {
        //log('select mouseDown')();
        tool.onDeactivate();
        tool.mouseUpClicked = false;
        self.resizer.show();
        self.resizer.setData(e.offsetY, e.offsetX, 0, 0);
        self.resizer.trackMouseMove(e, 'br');
      };
      tool.onMouseUp = function (e) {
        if (tool.mouseUpClicked) {
          return;
        }
        var params = self.resizer.params;
        if (!params.width || !params.height) {
          self.resizer.hide();
        } else {
          //log('select mouseUp')();
          tool.inProgress = true;
          tool.mouseUpClicked = true;
          var imageData = self.ctx.getImageData(params.left, params.top, params.width, params.height);
          tmpCanvasContext.canvas.width = params.width;
          tmpCanvasContext.canvas.height = params.height;
          tool.imgInfo = {width: params.width, height: params.height};
          tmpCanvasContext.putImageData(imageData, 0, 0);
          CssUtils.showElement(tool.domImg);
          tool.domImg.src = tmpCanvasContext.canvas.toDataURL();
          self.buffer.startAction();
          self.ctx.clearRect(params.left, params.top, params.width, params.height);
        }
      };
      tool.rotateInfo = function() {
        var c = tool.imgInfo.width;
        tool.imgInfo.width = tool.imgInfo.height;
        tool.imgInfo.height = c;
        self.resizer.params.rotate();
      };
      tool.getAreaData = function() {
        return {
          width: tool.imgInfo.width,
          height: tool.imgInfo.height,
          img: tool.domImg
        }
      };
    })(),
    pen: new (function () {
      var tool = this;
      tool.keyActivator = {
        code: 'KeyB',
        icon: 'icon-brush-1',
        title: 'Brush (B)'
      };
      tool.onChangeColor = function (e) {
        self.helper.setCursor(tool.getCursor());
      };
      tool.onChangeRadius = function (e) {
        self.helper.setCursor(tool.getCursor());
      };
      tool.onChangeOpacity = function (e) {
        self.helper.setCursor(tool.getCursor());
      };
      tool.getCursor = function () {
        return self.helper.buildCursor(self.ctx.strokeStyle, '', self.ctx.lineWidth);
      };
      tool.onActivate = function () {
        self.ctx.lineJoin = 'round';
        self.ctx.lineCap = 'round';
        self.ctx.globalCompositeOperation = "source-over";
      };
      tool.onMouseDown = function (e) {
        var coord = self.helper.getXY(e);
        self.ctx.moveTo(coord.x, coord.y);
        tool.points = [];
        self.tmp.saveState();
        tool.onMouseMove(e, coord)
      };
      tool.onMouseMove = function (e, coord) {
        // log("mouse move,  points {}", JSON.stringify(tool.points))();
        self.tmp.restoreState();
        tool.points.push(coord);
        self.ctx.beginPath();
        self.ctx.moveTo(tool.points[0].x, tool.points[0].y);
        for (var i = 0; i < tool.points.length; i++) {
          self.ctx.lineTo(tool.points[i].x, tool.points[i].y);
        }
        self.ctx.stroke();
      };
      tool.onMouseUp = function (e) {
        self.ctx.closePath();
        tool.points = [];
      };
    }),
    line: new (function () {
      var tool = this;
      tool.keyActivator = {
        code: 'KeyL',
        icon: 'icon-line',
        title: 'Line (L)'
      };
      tool.getCursor = function () {
        return 'crosshair';
      };
      tool.onChangeColor = function (e) { };
      tool.onChangeRadius = function (e) { };
      tool.onChangeOpacity = function (e) { };
      tool.onMouseDown = function (e) {
        self.tmp.saveState();
        tool.startCoord = self.helper.getXY(e);
        tool.onMouseMove(e, tool.startCoord);
      };
      tool.calcProportCoord = function(currCord) {
        var deg = Math.atan((tool.startCoord.x - currCord.x) / (currCord.y - tool.startCoord.y)) * 8 / Math.PI;
        if (Math.abs(deg) < 1) { // < 45/2
          currCord.x = tool.startCoord.x;
        } else if (Math.abs(deg) > 3) { // > 45 + 45/2
          currCord.y = tool.startCoord.y;
        } else {
          var base = (Math.abs(currCord.x - tool.startCoord.x) + Math.abs(currCord.y - tool.startCoord.y, 2)) / 2;
          currCord.x = tool.startCoord.x + base * (tool.startCoord.x < currCord.x ? 1 : -1);
          currCord.y = tool.startCoord.y + base * (tool.startCoord.y < currCord.y ? 1 : -1);
        }
      };
      tool.onMouseMove = function (e, currCord) {
        self.tmp.restoreState();
        self.ctx.beginPath();
        if (e.shiftKey) {
          tool.calcProportCoord(currCord);
        }
        self.ctx.moveTo(tool.startCoord.x, tool.startCoord.y);
        self.ctx.lineTo(currCord.x, currCord.y);
        self.ctx.stroke();
      };
      tool.onMouseUp = function (e) {
        self.ctx.closePath();
      };
    })(),
    fill: new (function (ctx) {
      var tool = this;
      tool.keyActivator = {
        code: 'KeyF',
        icon: 'icon-fill',
        title: 'Flood Fill (F)'
      };
      tool.bufferHandler = true;
      tool.buildCursor = function() {
        return 'url(data:image/svg+xml;base64,{}) {} {}, auto'.format(btoa(FLOOD_FILL_CURSOR.format(self.ctx.fillStyle)), 39, 86);
      }
      tool.getCursor = function() {
        return tool.buildCursor();
      };
      tool.onChangeColorFill = function(e) {
        self.helper.setCursor(tool.buildCursor());
      };
      tool.onChangeFillOpacity = function(e) {};
      tool.floodFill = (function() {
        var called;
        var xssss;
        var yssss;
        var fillcolorssss;
        function floodfill(data, x, y, fillcolor, tolerance, width, height) {
          called = 0;
          xssss = x;
          yssss = y;
          fillcolorssss = fillcolor;
          var length = data.length;
          var Q = [];
          var i = (x + y * width) * 4;
          var e = i, w = i, me, mw, w2 = width * 4;
          var targetcolor = [data[i], data[i + 1], data[i + 2], data[i + 3]];
          if (!pixelCompare(i, targetcolor, fillcolor, data, length, tolerance)) {
            return false;
          }
          Q.push(i);
          while (Q.length) {
            i = Q.pop();
            if (pixelCompareAndSet(i, targetcolor, fillcolor, data, length, tolerance)) {
              e = i;
              w = i;
              mw = parseInt(i / w2) * w2; //left bound
              me = mw + w2;             //right bound
              while (mw < w && mw < (w -= 4) && pixelCompareAndSet(w, targetcolor, fillcolor, data, length, tolerance)); //go left until edge hit
              while (me > e && me > (e += 4) && pixelCompareAndSet(e, targetcolor, fillcolor, data, length, tolerance)); //go right until edge hit
              for (var j = w; j < e; j += 4) {
                if (j - w2 >= 0 && pixelCompare(j - w2, targetcolor, fillcolor, data, length, tolerance)) Q.push(j - w2); //queue y-1
                if (j + w2 < length && pixelCompare(j + w2, targetcolor, fillcolor, data, length, tolerance)) Q.push(j + w2); //queue y+1
              }
            }
          }
          return data;
        }

        function pixelCompare(i, targetcolor, fillcolor, data, length, tolerance) {
          if (i < 0 || i >= length) return false; //out of bounds
          if (data[i + 3] === 0 && fillcolor.a > 0) return true;  //surface is invisible and fill is visible

          if (
            Math.abs(targetcolor[3] - fillcolor.a) <= tolerance &&
            Math.abs(targetcolor[0] - fillcolor.r) <= tolerance &&
            Math.abs(targetcolor[1] - fillcolor.g) <= tolerance &&
            Math.abs(targetcolor[2] - fillcolor.b) <= tolerance
          ) return false; //target is same as fill

          if (
            (targetcolor[3] === data[i + 3]) &&
            (targetcolor[0] === data[i]  ) &&
            (targetcolor[1] === data[i + 1]) &&
            (targetcolor[2] === data[i + 2])
          ) return true; //target matches surface

          if (
            Math.abs(targetcolor[3] - data[i + 3]) <= (255 - tolerance) &&
            Math.abs(targetcolor[0] - data[i]) <= tolerance &&
            Math.abs(targetcolor[1] - data[i + 1]) <= tolerance &&
            Math.abs(targetcolor[2] - data[i + 2]) <= tolerance
          ) return true; //target to surface within tolerance

          return false; //no match
        }

        function pixelCompareAndSet(i, targetcolor, fillcolor, data, length, tolerance) {
          called++;
          if (called > 10000000) {
            self.ctx.canvas.toBlob(function (blob) {
              var fd = new FormData();
              Utils.setBlobName(blob);
              fd.append('s1', blob, blob.name);
              doPost('/upload_file', null, function (res) {
                doPost('/report_issue', {issue: "Error occurred with on x: {}, y: {}. fill {}.{}.{}.{} with response uploadFile: {}".format(xssss, yssss, fillcolorssss.a, fillcolorssss.r, fillcolorssss.g, fillcolorssss.b, res)})
              }, fd);
            });
            throw "Unable to flood fill the image, because cycle detected.";
          }
          if (pixelCompare(i, targetcolor, fillcolor, data, length, tolerance)) {
            //fill the color
            data[i] = fillcolor.r;
            data[i + 1] = fillcolor.g;
            data[i + 2] = fillcolor.b;
            data[i + 3] = fillcolor.a;
            return true;
          }
          return false;
        }
        return floodfill;
      })();
      tool.getRGBA = function () {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(self.ctx.fillStyle);
        if (!result) {
          throw "Invalid color";
        }
        return {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
          a: (self.instruments.opacityFill.inputValue || 0) * 255
        }
      };
      tool.onMouseDown = function (e) {
        if (!((self.dom.canvas.width * self.dom.canvas.height) < 1000001)) {
          growlError("Can't fill image because amount of  data is too huge. Your browser would just explode ;(");
        } else {
          var xy = self.helper.getXY(e);
          var image = self.buffer.startAction();
          var processData = image.data.slice(0);
          tool.floodFill(processData, xy.x, xy.y, tool.getRGBA(), 0, image.width, image.height);
          var resultingImg = new ImageData(processData, image.width, image.height);
          self.ctx.putImageData(resultingImg, 0, 0);
          self.buffer.finishAction(resultingImg);
        }
      }
    })(),
    rect: new (function () {
      var tool = this;
      tool.keyActivator = {
        code: 'KeyQ',
        icon: 'icon-rect',
        title: 'Rectangle (Q)'
      };
      tool.getCursor = function () {
        return 'crosshair';
      };
      tool.onChangeRadius = function (e) { };
      tool.onChangeColor = function (e) { };
      tool.onChangeOpacity = function (e) { };
      tool.onChangeColorFill = function (e) { };
      tool.onChangeFillOpacity = function (e) { };
      tool.onMouseDown = function (e) {
        self.tmp.saveState();
        tool.startCoord = self.helper.getXY(e);
        tool.onMouseMove(e, tool.startCoord)
      };
      tool.calcProportCoord = function(currCord) {
        if (currCord.w < currCord.h) {
          currCord.h = currCord.w;
        } else {
          currCord.w = currCord.h;
        }
      };
      tool.onMouseMove = function (e, endCoord) {
        var dim = {
          w: endCoord.x - tool.startCoord.x,
          h: endCoord.y - tool.startCoord.y,
        };
        if (e.shiftKey) {
          tool.calcProportCoord(dim);
        }
        self.ctx.beginPath();
        self.tmp.restoreState();
        self.ctx.rect(tool.startCoord.x, tool.startCoord.y, dim.w, dim.h);
        self.ctx.globalAlpha = self.instruments.opacityFill.inputValue;
        self.ctx.fill();
        self.ctx.globalAlpha = self.instruments.opacity.inputValue;
        self.ctx.stroke();
      };
    })(),
    ellipse: new (function () {
      var tool = this;
      tool.keyActivator = {
        code: 'KeyE',
        icon: 'icon-ellipse',
        title: 'Eclipse (E)'
      };
      tool.getCursor = function () {
        return 'crosshair';
      };
      tool.onChangeColor = function (e) { };
      tool.onChangeColorFill = function (e) { };
      tool.onChangeRadius = function (e) { };
      tool.onChangeOpacity = function (e) { };
      tool.onChangeFillOpacity = function (e) { };
      tool.onMouseDown = function (e, data) {
        self.tmp.saveState();
        tool.startCoord = self.helper.getXY(e);
        tool.onMouseMove(e, tool.startCoord)
      };
      tool.calcProportCoord = function(currCord) {
        if (currCord.w < currCord.h) {
          currCord.h = currCord.w;
        } else {
          currCord.w = currCord.h;
        }
      };
      tool.draw = function (x, y, w, h) {
        var kappa = .5522848,
          ox = (w / 2) * kappa, // control point offset horizontal
          oy = (h / 2) * kappa, // control point offset vertical
          xe = x + w,           // x-end
          ye = y + h,           // y-end
          xm = x + w / 2,       // x-middle
          ym = y + h / 2;       // y-middle
        self.ctx.moveTo(x, ym);
        self.ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
        self.ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
        self.ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
        self.ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
      };
      tool.onMouseMove = function (e, endCoord) {
        var dim = {
          w: endCoord.x - tool.startCoord.x,
          h: endCoord.y - tool.startCoord.y
        };
        self.tmp.restoreState();
        self.ctx.beginPath();
        if (e.shiftKey) {
          tool.calcProportCoord(dim);
        }
        tool.draw(tool.startCoord.x, tool.startCoord.y, dim.w, dim.h);
        self.ctx.closePath();
        self.ctx.globalAlpha = self.instruments.opacityFill.inputValue;
        self.ctx.fill();
        self.ctx.globalAlpha = self.instruments.opacity.inputValue;
        self.ctx.stroke();
      };
    })(),
    text: new (function () {
      var tool = this;
      self.Appliable.call(this);
      tool.keyActivator = {
        code: 'KeyT',
        icon: 'icon-text',
        title: 'Text (T)'
      };
      tool.span = $('paintTextSpan');
      //prevent self.events.contKeyPress
      tool.span.addEventListener('keypress', function (e) {
        if (e.keyCode !== 13 || e.shiftKey) {
          e.stopPropagation(); //proxy onapply
        }
      });
      tool.bufferHandler = true;
      tool.onChangeFont = function (e) {
        tool.span.style.fontFamily = e.target.value;
      };
      tool.onActivate = function () { // TODO this looks bad
        tool.disableApply();
        tool.onChangeFont({target: {value: self.ctx.fontFamily}});
        tool.onChangeRadius({target: {value: self.ctx.lineWidth}});
        tool.onChangeFillOpacity({target: {value: self.instruments.opacityFill.inputValue * 100}});
        tool.onChangeColorFill({target: {value: self.ctx.fillStyle}});
        tool.span.innerHTML = '';
      };
      tool.onDeactivate = function () {
        if (tool.lastCoord) {
          tool.onApply();
        }
        CssUtils.hideElement(tool.span);
      };
      tool.onApply = function () {
        self.buffer.startAction();
        self.ctx.font = "{}px {}".format(5 + self.ctx.lineWidth, self.ctx.fontFamily);
        self.ctx.globalAlpha = self.instruments.opacityFill.inputValue;
        var width = 5 + self.ctx.lineWidth; //todo lineheight causes so many issues
        var lineheight = parseInt(width * 1.25);
        var linediff = parseInt(width * 0.01);
        var lines = tool.span.textContent.split('\n');
        for (var i = 0; i < lines.length; i++) {
          self.ctx.fillText(lines[i], tool.lastCoord.x, width + i * lineheight + tool.lastCoord.y - linediff);
        }
        self.ctx.globalAlpha = self.instruments.opacity.inputValue;
        self.buffer.finishAction();
        self.setMode('pen');
      };
      tool.onZoomChange = function () {
        tool.span.style.fontSize = (self.zoom * (self.ctx.lineWidth + 5)) + 'px';
        tool.span.style.top = (tool.originOffest.y * self.zoom  / tool.originOffest.z) + 'px';
        tool.span.style.left = (tool.originOffest.x * self.zoom  / tool.originOffest.z) + 'px';
      };
      tool.getCursor = function () {
        return 'text';
      };
      tool.onChangeRadius = function (e) {
        tool.span.style.fontSize = (self.zoom * (5 + parseInt(e.target.value))) + 'px';
      };
      tool.onChangeFillOpacity = function (e) {
        tool.span.style.opacity = e.target.value / 100
      };
      tool.onChangeColorFill = function (e) {
        tool.span.style.color = e.target.value;
      };
      tool.onMouseDown = function (e) {
        CssUtils.showElement(tool.span);
        tool.originOffest = {
          x: e.offsetX,
          y: e.offsetY,
          z: self.zoom
        };
        tool.enableApply();
        tool.span.style.top = tool.originOffest.y +'px';
        tool.span.style.left = tool.originOffest.x +'px';
        tool.lastCoord = self.helper.getXY(e);
        setTimeout(function (e) {
          tool.span.focus()
        });
      };
    }),
    eraser: new (function () {
      var tool = this;
      tool.keyActivator = {
        code: 'KeyD',
        icon: 'icon-eraser',
        title: 'Eraser (D)'
      };
      tool.getCursor = function () {
        return self.helper.buildCursor('#aaaaaa', ' stroke="black" stroke-width="2"', self.ctx.lineWidth);
      };
      tool.onChangeRadius = function (e) {
        self.helper.setCursor(tool.getCursor());
      };
      tool.onActivate = function () {
        tool.tmpAlpha = self.ctx.globalAlpha;
        self.ctx.globalAlpha = 1;
        self.ctx.globalCompositeOperation = "destination-out";
      };
      tool.onDeactivate = function () {
        self.ctx.globalAlpha = tool.tmpAlpha;
      };
      tool.onMouseDown = function (e) {
        var coord = self.helper.getXY(e);
        self.ctx.moveTo(coord.x, coord.y);
        self.ctx.beginPath();
        tool.onMouseMove(e, coord)
      };
      tool.onMouseMove = function (e, coord) {
        self.ctx.lineTo(coord.x, coord.y);
        self.ctx.stroke();
      };
      tool.onMouseUp = function () {
        self.ctx.closePath();
      };
    })(),
    img: new (function () {
      var tool = this;
      tool.keyActivator = {
        icon: 'icon-picture hidden',
        title: 'Pasting image'
      };
      tool.img = $('paintPastedImg');
      tool.bufferHandler = true;
      tool.imgObj = null;
      tool.readAndPasteCanvas = function (file) {
        var reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function (event) {
          tool.imgObj = new Image();
          var b64 = event.target.result;
          tool.imgObj.onload = function () {
            tool.img.src = b64;
            self.resizer.setData(
              self.dom.canvasWrapper.scrollTop,
              self.dom.canvasWrapper.scrollLeft,
              tool.imgObj.width,
              tool.imgObj.height
            );
          };
          tool.imgObj.src = b64;
        };
      };
      tool.getCursor = function () {
        return null;
      };
      tool.onApply = function (event) {
        var data = self.buffer.startAction();
        var params = self.resizer.params;
        var nw = params.left + params.width;
        var nh = params.top + params.height;
        if (nw > self.dom.canvas.width || nh > self.dom.canvas.height) {
          self.helper.setDimensions(
            Math.max(nw, self.dom.canvas.width),
            Math.max(nh, self.dom.canvas.height)
          );
          self.ctx.putImageData(data, 0, 0);
        }
        self.helper.drawImage(tool.imgObj,
          0, 0, tool.imgObj.width, tool.imgObj.height,
          params.left, params.top, params.width, params.height);
        self.buffer.finishAction();
        self.setMode('pen');
      };
      tool.onZoomChange = self.resizer.onZoomChange;
      tool.onActivate = function(e) {
        self.resizer.show();
        CssUtils.showElement(tool.img);
      };
      tool.onDeactivate = function() {
        tool.onApply();
        self.resizer.hide();
        CssUtils.hideElement(tool.img);
      };
    }),
    crop: new (function () {
      var tool = this;
      self.Appliable.call(this);
      tool.keyActivator = {
        code: 'KeyC',
        icon: 'icon-crop',
        title: 'Crop Image (C)'
      };
      tool.bufferHandler = true;
      tool.getCursor = function () {
        return 'crosshair';
      };
      tool.onApply = function () {
        var params = self.resizer.params;
        if (!params.width || !params.height) {
          growlError("Can't crop to {}x{}".format(params.width, params.height));
        } else {
          self.buffer.startAction();
          var img = self.ctx.getImageData(params.left, params.top, params.width, params.height);
          self.helper.setDimensions(params.width, params.height);
          self.ctx.putImageData(img, 0, 0);
          self.buffer.finishAction(img);
          self.setMode('pen');
        }
      };
      tool.onActivate = function() {
        tool.disableApply();
      };
      tool.onZoomChange = self.resizer.onZoomChange;
      tool.onDeactivate = function() {
        self.resizer.hide();
        tool.enableApply();
      };
      tool.onMouseDown = function (e) {
        self.resizer.show();
        tool.disableApply();
        self.resizer.setData(e.offsetY, e.offsetX, 0, 0);
        self.resizer.trackMouseMove(e, 'br');
      };
      tool.onMouseUp = function (e) {
        var params = self.resizer.params;
        if (!params.width || !params.height) {
          self.resizer.hide();
        } else {
          tool.onApply();
        }

      };
    })(),
    resize: new (function () {
      var tool = this;
      tool.keyActivator = {
        code: 'KeyW',
        icon: 'icon-resize',
        title: 'Change dimensions (W)'
      };
      tool.container = $('paintResizeTools');
      tool.width = tool.container.querySelector('[placeholder=width]');
      tool.height = tool.container.querySelector('[placeholder=height]');
      tool.lessThan4 = function(e) {
        if (this.value.length > 4) {
          this.value = this.value.slice(0, 4);
        }
      };
      tool.onlyNumber = function(e) {
        var charCode = e.which || e.keyCode;
        return  charCode > 47 && charCode < 58;
      };
      tool.width.onkeypress = tool.onlyNumber;
      tool.width.oninput = tool.lessThan4;
      tool.height.oninput = tool.lessThan4;
      tool.height.onkeypress = tool.onlyNumber;
      tool.onApply = function() {
        var data = self.buffer.startAction();
        self.helper.setDimensions(tool.width.value, tool.height.value);
        self.ctx.putImageData(data, 0, 0);
        self.buffer.finishAction();
        self.setMode('pen')
      };
      tool.getCursor = function() {
        return null;
      };
      tool.onActivate = function() {
        CssUtils.showElement(tool.container);
        tool.width.value = self.dom.canvas.width;
        tool.height.value = self.dom.canvas.height;
      };
      tool.onDeactivate = function() {
        CssUtils.hideElement(tool.container);
      };
    }),
    move: new (function () {
      var tool = this;
      tool.keyActivator = {
        code: 'KeyM',
        icon: 'icon-move',
        title: 'Move (M)'
      };
      tool.getCursor = function () {
        return 'move';
      };
      tool.onMouseDown = function (e) {
        var pxy = self.helper.getPageXY(e);
        tool.lastCoord = {x: pxy.pageX, y: pxy.pageY};
      };
      tool.onMouseMove = function (e) {
        var pxy = self.helper.getPageXY(e);
        var x = tool.lastCoord.x - pxy.pageX;
        var y = tool.lastCoord.y - pxy.pageY;
        log("Moving to: {{}, {}}", x, y)();
        self.dom.canvasWrapper.scrollTop += y;
        self.dom.canvasWrapper.scrollLeft += x;
        tool.lastCoord = {x: pxy.pageX, y: pxy.pageY};
        // log('X,Y: {{}, {}}', self.dom.canvasWrapper.scrollLeft, self.dom.canvasWrapper.scrollTop )();
      };
      tool.onMouseUp = function (coord) {
        tool.lastCoord = null;
      };
    })
  };
  self.actions = [
    {
      keyActivator: {
        code: 'KeyR',
        icon: 'icon-rotate',
        title: 'Rotate (R)'
      },
      handler: function () {
        if (self.tools['select'].isSelectionActive()) {
          var m = self.tools.select;
          var d = m.getAreaData();
          log("{}x{}", d.width, d.height)();
          tmpCanvasContext.canvas.width = d.height; //specify width of your canvas
          tmpCanvasContext.canvas.height = d.width; //specify height of your canvas
          var ctx = tmpCanvasContext;
          ctx.save();
          ctx.translate(d.height / 2, d.width / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(d.img, -d.width / 2, -d.height / 2); //draw it
          ctx.restore();
          d.img.src = tmpCanvasContext.canvas.toDataURL();
          m.rotateInfo();
        } else {
          self.buffer.startAction();
          var tmpData = self.dom.canvas.toDataURL();
          var w = self.dom.canvas.width;
          var h = self.dom.canvas.height;
          self.helper.setDimensions(h, w);
          self.ctx.save();
          self.ctx.translate(h / 2, w / 2);
          self.ctx.rotate(Math.PI / 2);
          var img = new Image();
          img.onload = function (e) {
            self.helper.drawImage(img, -w / 2, -h / 2);
            self.ctx.restore();
            self.buffer.finishAction();
          };
          img.src = tmpData;
        }
      }
    }, {
      keyActivator: {
        code: 'KeyZ',
        ctrlKey: true,
        icon: 'icon-undo',
        title: 'Undo (Ctrl+Z)'
      },
      handler: function () {
        self.buffer.undo();
      }
    }, {
      keyActivator: {
        code: 'KeyY',
        ctrlKey: true,
        icon: 'icon-redo',
        title: 'Redo (Ctrl+Y)'
      },
      handler: function () {
        self.buffer.redo();
      }
    }, {
      keyActivator: {
        code: '+',
        icon: 'icon-zoom-in',
        title: 'Zoom In (Ctrl+)/(Mouse Wheel)'
      },
      handler: function () {
        self.helper.setZoom(true);
      }
    }, {
      keyActivator: {
        code: '-',
        icon: 'icon-zoom-out',
        title: 'Zoom Out (Ctrl-)/(Mouse Wheel)'
      },
      handler: function () {
        self.helper.setZoom(false);
      }
    }, {
      keyActivator: {
        code: 'Delete',
        icon: 'icon-trash-circled',
        title: 'Delete (Del)'
      },
      handler: function () {
        if (self.tools['select'].isSelectionActive()) {
          self.tools['select'].inProgress = false; // don't restore image
          self.buffer.finishAction();
          self.tools['select'].onDeactivate();
        } else {
          self.buffer.startAction();
          self.ctx.clearRect(0, 0, self.dom.canvas.width, self.dom.canvas.height);
          self.buffer.finishAction();
        }
      }
    }
  ];
  self.buffer = new (function () {
    var tool = this;
    var undoImages = [];
    var redoImages = [];
    // var paintUndo = $('paintUndo');
    // var paintRedo = $('paintRedo');
    var buStateData = ['lineWidth', 'strokeStyle', 'globalAlpha', 'lineJoin', 'lineCap', 'globalCompositeOperation'];
    var current = null;
    tool.getCanvasImage = function (img) {
      return {
        width: self.dom.canvas.width,
        height: self.dom.canvas.height,
        data: img || self.ctx.getImageData(0, 0, self.dom.canvas.width, self.dom.canvas.height)
      }
    };
    tool.clear = function () {
      undoImages = [];
      redoImages = [];
      current = null;
    };
    tool.getUndo = function() {
      return undoImages;
    };
    tool.getRedo = function() {
      return redoImages;
    };
    tool.dodo = function(from, to) {
      var restore = from.pop();
      if (restore) {
        to.push(current);
        current = restore;
        if (self.dom.canvas.width != current.width
          || self.dom.canvas.height != current.height) {
          log("Resizing canvas from {}x{} to {}x{}",
            self.dom.canvas.width, self.dom.canvas.height,
            current.width, current.height
          )();
          self.helper.setDimensions(current.width, current.height)
        }
        self.ctx.putImageData(restore.data, 0, 0);
        tool.setIconsState();
      }
    };
    tool.setIconsState = function() {
      // CssUtils.setClassToState(paintUndo, undoImages.length, 'disabled');
      // CssUtils.setClassToState(paintRedo, redoImages.length, 'disabled');
    };
    tool.redo = function () {
      tool.dodo(redoImages, undoImages);
    };
    tool.undo = function () {
      tool.dodo(undoImages, redoImages);
    };
    tool.finishAction = function (img) {
      log('finish action')();
      if (current) {
        undoImages.push(current);
      }
      redoImages = [];
      tool.setIconsState();
      current = tool.getCanvasImage(img);
      self.helper.applyZoom();
    };
    tool.getState = function() {
      var d = {};
      buStateData.forEach(function (e) {
        d[e] = self.ctx[e];
      });
      return d;
    };
    tool.restoreState = function (state) {
      buStateData.forEach(function (e) {
        self.ctx[e] = state[e];
      });
    };
    tool.setCurrent = function(newCurrent) {
      current = newCurrent;
    };
    tool.startAction = function () {
      log('start action')();
      if (!current) {
        current = tool.getCanvasImage();
      }
      return current.data;
    };
  })();
  self.setMode = function (mode) {
    var oldMode = self.tools[self.mode];
    self.mode = mode;
    if (oldMode) {
      oldMode.onDeactivate && oldMode.onDeactivate();
      CssUtils.removeClass(oldMode.icon, self.PICKED_TOOL_CLASS);
    }
    var newMode = self.tools[self.mode];
    newMode.onActivate && newMode.onActivate();
    newMode.getCursor && self.helper.setCursor(newMode.getCursor());
    newMode.icon && CssUtils.addClass(newMode.icon, self.PICKED_TOOL_CLASS);
    Object.keys(self.instruments).forEach(function (k) {
      var instr = self.instruments[k];
      if (oldMode && oldMode[instr.handler]) {
        CssUtils.hideElement(instr.holder);
      }
      if (newMode[instr.handler]) {
        CssUtils.showElement(instr.holder);
      }
    });
  };
  self.show = function () {
    document.body.addEventListener('mouseup', self.events.onmouseup, false);
    document.body.addEventListener('touchend', self.events.onmouseup, false);
  };
  self.superHide = self.hide;
  self.hide = function () {
    document.body.removeEventListener('mouseup', self.events.onmouseup, false);
    document.body.removeEventListener('touchend', self.events.onmouseup, false);
  };
  Object.keys(self.init).forEach(function (k) {
    self.init[k]()
  });
}