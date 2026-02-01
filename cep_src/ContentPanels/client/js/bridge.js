(function (global) {
  function isCepRuntime() {
    return typeof global.__adobe_cep__ !== "undefined" || typeof global.cep !== "undefined";
  }

  function normalizeFsPath(path) {
    var p = String(path || "").replace(/\\/g, "/");
    var winMatch = p.match(/^\/([A-Za-z]:\/.*)/);
    if (winMatch) return winMatch[1];
    return p;
  }

  function rootFromLocation() {
    var href = String((global.location && global.location.href) || "");
    var path = href;
    try {
      path = new URL(href).pathname;
    } catch (e) {}
    path = decodeURIComponent(path || "");
    var marker = "/client/index.html";
    if (path.slice(-marker.length) === marker) {
      path = path.slice(0, -marker.length);
    } else {
      path = path.replace(/\/[^/]*$/, "");
    }
    return normalizeFsPath(path);
  }

  function CEPBridge() {
    if (!isCepRuntime() || typeof CSInterface === "undefined") {
      throw new Error("CEP runtime not available");
    }
    this.cs = new CSInterface();
    this.env = "cep";
  }

  CEPBridge.prototype.eval = function (script) {
    return new Promise((resolve) => {
      this.cs.evalScript(script, function (result) {
        resolve(result);
      });
    });
  };

  CEPBridge.prototype.getExtensionRootPath = function () {
    return normalizeFsPath(this.cs.getSystemPath(SystemPath.EXTENSION));
  };

  function WebView2Bridge() {
    this.env = "webview2";
    this._pending = {};
    this._nextId = 1;

    if (global.chrome && global.chrome.webview && global.chrome.webview.addEventListener) {
      global.chrome.webview.addEventListener("message", this._onMessage.bind(this));
    }
  }

  WebView2Bridge.prototype._onMessage = function (evt) {
    var msg = evt && evt.data !== undefined ? evt.data : evt;
    if (typeof msg === "string") {
      try {
        msg = JSON.parse(msg);
      } catch (e) {}
    }
    if (!msg || !msg.id) return;

    var pending = this._pending[msg.id];
    if (!pending) return;
    delete this._pending[msg.id];

    if (msg.ok === false) {
      pending.resolve(msg.error || "Error");
      return;
    }
    pending.resolve(msg.result || "");
  };

  WebView2Bridge.prototype.eval = function (script) {
    var id = String(this._nextId++);
    var payload = {
      id: id,
      type: "evalScript",
      payload: script,
      expectResult: true,
    };

    return new Promise((resolve) => {
      var hasWebView = !!(global.chrome && global.chrome.webview && global.chrome.webview.postMessage);
      var hasExternal = !!(global.external && typeof global.external.invoke === "function");

      if (!hasWebView && !hasExternal) {
        resolve("NO_BRIDGE");
        return;
      }

      if (hasWebView) {
        this._pending[id] = { resolve: resolve };
        global.chrome.webview.postMessage(payload);
        return;
      }

      try {
        global.external.invoke(JSON.stringify(payload));
        resolve("OK");
      } catch (e) {
        resolve("NO_BRIDGE");
      }
    });
  };

  WebView2Bridge.prototype.getExtensionRootPath = function () {
    return rootFromLocation();
  };

  function NoopBridge() {
    this.env = "noop";
  }

  NoopBridge.prototype.eval = function (script) {
    console.warn("Bridge.eval ignored:", script);
    return Promise.resolve("NO_BRIDGE");
  };

  NoopBridge.prototype.getExtensionRootPath = function () {
    return rootFromLocation();
  };

  function createBridge() {
    if (isCepRuntime() && typeof CSInterface !== "undefined") {
      console.log("Using CEP bridge");
      return new CEPBridge();
    }

    if (global.chrome && global.chrome.webview) {
      console.log("Using WebView2 bridge");
      return new WebView2Bridge();
    }

    if (global.external && global.external.invoke) {
      console.log("Using legacy AEX bridge");
      return new WebView2Bridge();
    }

    console.warn("No available bridge, using noop");
    return new NoopBridge();
  }

  global.Bridge = createBridge();
})(window);
