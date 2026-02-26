// host/public_api.js
// Single public API layer for UI -> host bridge calls.

(function (global) {
    if (global.CPHostAPI) return;

    function _call(fnName, args, opts, cb) {
        if (typeof global.callHost !== "function") {
            var fail = { ok: false, error: "callHost is not available", result: "" };
            if (typeof cb === "function") cb(fail);
            return Promise.resolve(fail);
        }
        return global.callHost(fnName, args, opts, cb);
    }

    function _extensionRoot() {
        if (typeof global.getExtensionRootPath === "function") {
            return global.getExtensionRootPath();
        }
        return "";
    }

    function _history(limit) {
        if (typeof global.getHostCallHistory === "function") {
            return global.getHostCallHistory(limit);
        }
        return [];
    }

    function _runJob(job) {
        if (typeof global.runJobFromUI === "function") {
            return global.runJobFromUI(job);
        }
        var fail = { ok: false, error: "runJobFromUI is not available", result: "" };
        return Promise.resolve(fail);
    }

    global.CPHostAPI = {
        call: _call,
        extensionRoot: _extensionRoot,
        history: _history,
        runJob: _runJob
    };
})(window);
