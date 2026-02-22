// ui_diagnostics.js
// Minimal diagnostics modal (Phase 1.2)

function _diagOpen() {
    var overlay = document.getElementById("diag-overlay");
    if (overlay) overlay.style.display = "block";
}

function _diagClose() {
    var overlay = document.getElementById("diag-overlay");
    if (overlay) overlay.style.display = "none";
}

function _diagSetText(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(val || "");
}

function _diagBuildText(snapshot, history) {
    var s = (snapshot && typeof snapshot === "object") ? snapshot : {};
    var h = (history instanceof Array) ? history : [];

    var lines = [];
    lines.push("Diagnostics snapshot");
    lines.push("");

    function addKV(k, v) {
        lines.push(k + ": " + String(v || ""));
    }

    addKV("configPath", s.configPath || "");
    addKV("dataRoot", s.dataRoot || "");
    addKV("toolsRoot", s.toolsRoot || "");
    addKV("word2jsonOutDir", s.word2jsonOutDir || "");
    addKV("autoTimingLogsDir", s.autoTimingLogsDir || "");
    addKV("word2jsonLogsDir", s.word2jsonLogsDir || "");
    lines.push("");

    var paths = s.paths || {};
    addKV("word2jsonExePath", paths.word2jsonExePath || "");
    addKV("whisperxPythonPath", paths.whisperxPythonPath || "");
    addKV("ffmpegExePath", paths.ffmpegExePath || "");
    lines.push("");

    var exists = s.exists || {};
    lines.push("exists:");
    for (var k in exists) {
        if (!exists.hasOwnProperty(k)) continue;
        lines.push("  - " + k + ": " + (exists[k] ? "yes" : "no"));
    }
    lines.push("");

    var logs = s.latestLogs || {};
    lines.push("latestLogs:");
    addKV("  word2jsonLastLog", logs.word2jsonLastLog || "");
    addKV("  word2jsonProcessLastLog", logs.word2jsonProcessLastLog || "");
    addKV("  whisperxMetaLog", logs.whisperxMetaLog || "");
    addKV("  whisperxOutLog", logs.whisperxOutLog || "");
    addKV("  alignOutLog", logs.alignOutLog || "");
    lines.push("");

    lines.push("host calls (latest):");
    if (!h.length) {
        lines.push("  (empty)");
    } else {
        for (var i = 0; i < h.length; i++) {
            var it = h[i] || {};
            lines.push(
                "  - " +
                String(it.requestId || "") +
                " | " +
                String(it.module || "") + "." + String(it.fn || "") +
                " | ok=" + (it.ok ? "1" : "0") +
                " | ms=" + String(it.durationMs || 0) +
                (it.error ? " | err=" + String(it.error) : "")
            );
        }
    }

    return lines.join("\n");
}

function _diagRefresh() {
    _diagSetText("diag-content", "Loading diagnostics...");
    callHost("getDiagnosticsSnapshot", [], { module: "diagnostics", timeoutMs: 10000 }, function (out) {
        if (!out || !out.ok) {
            var err = out && (out.error || out.result) ? String(out.error || out.result) : "Unknown error";
            _diagSetText("diag-content", "Diagnostics failed:\n" + err);
            logUiError("diagnostics.load", err);
            return;
        }

        var snap = out.result || {};
        var hist = (typeof getHostCallHistory === "function") ? getHostCallHistory(20) : [];
        _diagSetText("diag-content", _diagBuildText(snap, hist));
    });
}

function initDiagnosticsUI() {
    attachClick("btn-diagnostics", function () {
        _diagOpen();
        _diagRefresh();
    });

    attachClick("btn-diag-close", function () { _diagClose(); });
    attachClick("btn-diag-refresh", function () { _diagRefresh(); });

    var overlay = document.getElementById("diag-overlay");
    if (overlay) {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) _diagClose();
        });
    }
}
