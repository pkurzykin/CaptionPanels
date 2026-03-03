// host_loader.js
// Sequential JSX module loader

function loadHostModules(modules, cb) {
    var extensionPath = CPHostAPI.extensionRoot();
    var list = modules || [];
    var i = 0;
    var startupRetryDelaysMs = [400, 800, 1200, 1600, 2000, 2500, 3000, 3500, 4000, 5000];

    function _isModalBusyText(text) {
        if (typeof isModalDialogBusyError === "function") {
            return isModalDialogBusyError(text);
        }
        var t = String(text || "").toLowerCase();
        if (!t) return false;
        return (
            (t.indexOf("modal dialog") !== -1 && t.indexOf("waiting response") !== -1) ||
            (t.indexOf("cannot run a script") !== -1 && t.indexOf("modal dialog") !== -1) ||
            (t.indexOf("can not run a script") !== -1 && t.indexOf("modal dialog") !== -1)
        );
    }

    function _callHostWithStartupRetry(fnName, args, timeoutMs, done, attemptNo) {
        var n = Number(attemptNo || 1);
        CPHostAPI.call(fnName, args, { module: "loader", timeoutMs: timeoutMs }, function (out) {
            var res = out || { ok: false, error: "Unknown host response", result: "" };
            var modalBusy = !res.ok && (_isModalBusyText(res.error) || _isModalBusyText(res.result));

            if (modalBusy && n <= startupRetryDelaysMs.length) {
                var delayMs = startupRetryDelaysMs[n - 1];
                setTimeout(function () {
                    _callHostWithStartupRetry(fnName, args, timeoutMs, done, n + 1);
                }, delayMs);
                return;
            }

            done(res);
        });
    }

    function next() {
        if (i >= list.length) {
            if (typeof cb === "function") cb("OK");
            return;
        }
        var name = list[i++];
        _callHostWithStartupRetry("loadModule", [name], 15000, function (out) {
            if (!out || !out.ok) {
                var msg = (out && (out.error || out.result)) ? String(out.error || out.result) : "Unknown host error";
                console.warn("Host module load failed: " + name + " | " + msg);
            }
            next();
        });
    }

    _callHostWithStartupRetry("initPath", [extensionPath], 10000, function (out) {
        if (!out || !out.ok) {
            var msg = (out && (out.error || out.result)) ? String(out.error || out.result) : "Unknown host error";
            console.warn("Host initPath failed: " + msg);
        }
        next();
    });
}
