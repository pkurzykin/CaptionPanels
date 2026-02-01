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

var UI_VERSION = "1.0";

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

function normalizeSpeakerText(txt) {
    return String(txt || "").replace(/\r\n|\r/g, "\n").trim();
}

function parseAeResult(res) {
    var s = String(res || "");
    var t = s.trim();
    if (t && t[0] === "{") {
        try {
            var obj = JSON.parse(t);
            if (obj && typeof obj.ok !== "undefined") return obj;
        } catch (e) {}
    }
    if (t.indexOf("Error:") === 0 || t === "Error") {
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
