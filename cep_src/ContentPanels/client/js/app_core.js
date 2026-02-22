// app_core.js
// Shared bridge + UI helpers

function bridgeEval(script, cb) {
    if (!window.Bridge || typeof Bridge.eval !== "function") {
        console.warn("Bridge.eval not available");
        var res = "NO_BRIDGE";
        if (typeof cb === "function") cb(res);
        return Promise.resolve(res);
    }
    var p = Bridge.eval(script);
    if (typeof cb === "function") {
        p.then(cb);
    }
    return p;
}

var csInterface = null;
if (typeof CSInterface !== "undefined" && (window.__adobe_cep__ || window.cep)) {
    csInterface = new CSInterface();
}
if (!csInterface) {
    csInterface = {
        evalScript: function (script, cb) {
            return bridgeEval(script, cb);
        },
        getSystemPath: function () {
            if (window.Bridge && typeof Bridge.getExtensionRootPath === "function") {
                return Bridge.getExtensionRootPath();
            }
            return "";
        }
    };
}

var UI_VERSION = "2.3.3";

function buildJob(type, payload) {
    return {
        schemaVersion: 1,
        type: type,
        payload: payload || {},
        meta: {
            createdAt: new Date().toISOString(),
            uiVersion: UI_VERSION
        }
    };
}

function runJobFromUI(job) {
    var json;
    try {
        json = JSON.stringify(job || {});
    } catch (e) {
        uiAlert("Job JSON error: " + e.message);
        return Promise.resolve("Error");
    }
    return bridgeEval("runJobFromJson(" + JSON.stringify(json) + ")");
}

function getExtensionRootPath() {
    if (csInterface && typeof csInterface.getSystemPath === "function" && typeof SystemPath !== "undefined") {
        return csInterface.getSystemPath(SystemPath.EXTENSION).replace(/\\/g, '/');
    }
    if (window.Bridge && typeof Bridge.getExtensionRootPath === "function") {
        return Bridge.getExtensionRootPath();
    }
    return "";
}

function normalizeNameToOneLine(name) {
    return String(name || "").replace(/\r\n|\n|\r/g, " ").replace(/\s+/g, " ").trim();
}


// For speaker titles input: if name is a simple "Name Surname" (2 words), convert to 2 lines.
// If name is already multiline or non-standard (3+ words, punctuation, etc.) keep as-is.
function formatSpeakerNameForInput(name) {
    var raw = String(name || "");

    // Preserve multiline names (DB often stores as "Имя\nФамилия").
    if (raw.indexOf("\n") !== -1 || raw.indexOf("\r") !== -1) return raw;

    // Normalize whitespace.
    var norm = raw.replace(/\u00A0/g, " ");
    norm = norm.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
    if (!norm) return raw;

    var parts = norm.split(" ");
    if (parts.length !== 2) return raw;

    // Only split clean words (letters + optional hyphen), otherwise keep as-is.
    var reWord = /^[A-Za-zА-Яа-яЁё-]+$/;
    if (!reWord.test(parts[0]) || !reWord.test(parts[1])) return raw;

    return parts[0] + "\n" + parts[1];
}

function uiAlert(msg) {
    try {
        csInterface.evalScript("alert(" + JSON.stringify(String(msg)) + ")");
    } catch (e) {
        alert(msg);
    }
}

function uiConfirm(msg, cb) {
    try {
        csInterface.evalScript("confirm(" + JSON.stringify(String(msg)) + ")", function (res) {
            cb(String(res).toLowerCase() === "true");
        });
    } catch (e) {
        cb(confirm(msg));
    }
}

function _taskProgressEls() {
    return {
        overlay: document.getElementById("task-progress-overlay"),
        title: document.getElementById("task-progress-title"),
        fill: document.getElementById("task-progress-fill"),
        caption: document.getElementById("task-progress-caption")
    };
}

function showTaskProgress(title, caption) {
    var el = _taskProgressEls();
    if (!el.overlay) return;
    if (el.title) el.title.textContent = String(title || "Processing...");
    if (el.caption) el.caption.textContent = String(caption || "Please wait...");
    if (el.fill) el.fill.style.width = "2%";
    el.overlay.style.display = "block";
}

function updateTaskProgress(percent, caption) {
    var el = _taskProgressEls();
    if (!el.overlay || el.overlay.style.display === "none") return;
    if (el.fill && typeof percent !== "undefined" && percent !== null) {
        var p = Number(percent);
        if (isNaN(p)) p = 0;
        if (p < 0) p = 0;
        if (p > 100) p = 100;
        el.fill.style.width = p.toFixed(1) + "%";
    }
    if (el.caption && typeof caption !== "undefined" && caption !== null) {
        el.caption.textContent = String(caption);
    }
}

function hideTaskProgress() {
    var el = _taskProgressEls();
    if (!el.overlay) return;
    el.overlay.style.display = "none";
}

function normalizeSpeakerText(txt) {
    return String(txt || "").replace(/\r\n|\r/g, "\n").trim();
}

function parseAeResult(res) {
    // WebView2 bridge can return a non-string result; normalize it here.
    if (res && typeof res === "object") {
        if (typeof res.ok !== "undefined") {
            if (typeof res.error === "undefined") res.error = "";
            if (typeof res.result === "undefined") res.result = "";
            return res;
        }
        return { ok: true, error: "", result: res };
    }

    var s = String(res || "");
    var t = s.trim();

    if (t && t[0] === "{") {
        try {
            var obj = JSON.parse(t);
            if (obj && typeof obj.ok !== "undefined") return obj;
        } catch (e) {}
    }

    if (t.indexOf("Error:") === 0) {
        return { ok: false, error: t.slice("Error:".length).trim(), result: "" };
    }
    if (t === "Error") {
        return { ok: false, error: t, result: "" };
    }

    if (t === "OK") {
        return { ok: true, error: "", result: t };
    }

    return { ok: true, error: "", result: s };
}

function aeCall(cmd, cb) {
    return new Promise(function (resolve) {
        csInterface.evalScript(cmd, function (res) {
            var out = parseAeResult(res);
            if (typeof cb === "function") cb(out);
            resolve(out);
        });
    });
}

var __hostRequestSeq = 1;

function _buildHostCallScript(fnName, args) {
    var fn = String(fnName || "").replace(/^\s+|\s+$/g, "");
    if (!fn) throw new Error("Empty host function name");

    var a = (args instanceof Array) ? args : (typeof args === "undefined" ? [] : [args]);
    var parts = [];
    for (var i = 0; i < a.length; i++) {
        parts.push(JSON.stringify(a[i]));
    }
    return fn + "(" + parts.join(",") + ")";
}

// Phase-1 host wrapper (roadmap 1.1): keeps old aeCall behavior,
// but attaches request metadata for deterministic diagnostics.
function callHost(fnName, args, opts, cb) {
    var o = opts || {};
    var requestId = "req_" + (__hostRequestSeq++);
    var startedAt = Date.now();
    var script = "";

    try {
        if (o.rawScript) {
            script = String(o.rawScript);
        } else {
            script = _buildHostCallScript(fnName, args);
        }
    } catch (eBuild) {
        var fail = {
            ok: false,
            error: "callHost build error: " + (eBuild && eBuild.message ? eBuild.message : String(eBuild)),
            result: "",
            requestId: requestId,
            ts: new Date(startedAt).toISOString(),
            module: String(o.module || ""),
            fn: String(fnName || "")
        };
        if (typeof cb === "function") cb(fail);
        return Promise.resolve(fail);
    }

    var timeoutMs = Number(o.timeoutMs);
    if (isNaN(timeoutMs) || timeoutMs < 0) timeoutMs = 0;

    return new Promise(function (resolve) {
        var done = false;
        var timer = null;

        function finish(res) {
            if (done) return;
            done = true;
            if (timer) clearTimeout(timer);
            if (typeof cb === "function") cb(res);
            resolve(res);
        }

        if (timeoutMs > 0) {
            timer = setTimeout(function () {
                finish({
                    ok: false,
                    error: "Host call timeout (" + timeoutMs + " ms)",
                    result: "",
                    requestId: requestId,
                    ts: new Date(startedAt).toISOString(),
                    module: String(o.module || ""),
                    fn: String(fnName || ""),
                    durationMs: Date.now() - startedAt
                });
            }, timeoutMs);
        }

        aeCall(script).then(function (out) {
            var res = out || { ok: false, error: "Unknown host response", result: "" };
            res.requestId = requestId;
            res.ts = new Date(startedAt).toISOString();
            res.module = String(o.module || "");
            res.fn = String(fnName || "");
            res.durationMs = Date.now() - startedAt;
            finish(res);
        });
    });
}

function attachClick(id, fn) {
    var el = document.getElementById(id);
    if (el) el.onclick = fn;
}

function logUi(msg) {
    try {
        csInterface.evalScript("logMessage(" + JSON.stringify(String(msg || "")) + ")");
    } catch (e) {}
}

function logUiError(ctx, msg) {
    try {
        csInterface.evalScript("logError(" + JSON.stringify(String(ctx || "")) + "," + JSON.stringify(String(msg || "")) + ")");
    } catch (e) {}
}
