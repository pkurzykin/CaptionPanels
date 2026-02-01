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
