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
    addKV("toolsRootConfigured", s.toolsRootConfigured || s.toolsRoot || "");
    addKV("word2jsonOutDir", s.word2jsonOutDir || "");
    addKV("autoTimingLogsDir", s.autoTimingLogsDir || "");
    addKV("word2jsonLogsDir", s.word2jsonLogsDir || "");
    lines.push("");

    var paths = s.paths || {};
    addKV("word2jsonExePath", paths.word2jsonExePath || "");
    addKV("whisperxPythonPath", paths.whisperxPythonPath || "");
    addKV("ffmpegExePath", paths.ffmpegExePath || "");
    addKV("modelsRoot", paths.modelsRoot || "");
    var asr = s.asr || {};
    addKV("whisperxOfflineOnly", asr.whisperxOfflineOnly ? "true" : "false");
    addKV("whisperxModel", asr.whisperxModel || "");
    lines.push("");

    var exists = s.exists || {};
    lines.push("exists:");
    for (var k in exists) {
        if (!exists.hasOwnProperty(k)) continue;
        lines.push("  - " + k + ": " + (exists[k] ? "yes" : "no"));
    }
    lines.push("");

    var checks = (s.deploymentChecks instanceof Array) ? s.deploymentChecks : [];
    lines.push("deploymentChecks:");
    if (!checks.length) {
        lines.push("  (empty)");
    } else {
        for (var ci = 0; ci < checks.length; ci++) {
            var c = checks[ci] || {};
            var level = String(c.level || "").toLowerCase();
            var mark = "OK";
            if (level === "warn" || level === "fail") {
                mark = level.toUpperCase();
            } else if (!c.ok) {
                mark = "FAIL";
            }
            var line = "  - [" + mark + "] " + String(c.name || "");
            if (c.details) line += " | " + String(c.details || "");
            lines.push(line);
        }
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

    var runs = s.latestRuns || {};
    lines.push("latestRuns:");
    function addRun(label, r) {
        if (!r || typeof r !== "object") {
            lines.push("  " + label + ": (empty)");
            return;
        }
        var o = (r.outputs && typeof r.outputs === "object") ? r.outputs : {};
        var st = (r.result && typeof r.result === "object") ? r.result : {};
        lines.push("  " + label + ":");
        lines.push("    runId: " + String(r.runId || ""));
        lines.push("    status: " + String(r.status || ""));
        lines.push("    stage: " + String(r.stage || ""));
        lines.push("    updatedAt: " + String(r.updatedAt || ""));
        lines.push("    path: " + String(r.path || ""));
        if (o.blocksPath) lines.push("    blocksPath: " + String(o.blocksPath));
        if (o.whisperxJson) lines.push("    whisperxJson: " + String(o.whisperxJson));
        if (o.alignmentPath) lines.push("    alignmentPath: " + String(o.alignmentPath));
        if (o.applyReportPath) lines.push("    applyReportPath: " + String(o.applyReportPath));
        if (typeof st.total !== "undefined") lines.push("    total: " + String(st.total || 0));
        if (typeof st.applied !== "undefined") lines.push("    applied: " + String(st.applied || 0));
        if (typeof st.missingCount !== "undefined") lines.push("    missingCount: " + String(st.missingCount || 0));
        if (typeof st.unmatchedCount !== "undefined") lines.push("    unmatchedCount: " + String(st.unmatchedCount || 0));
        if (typeof st.invalidCount !== "undefined") lines.push("    invalidCount: " + String(st.invalidCount || 0));
        if (typeof st.errorCount !== "undefined") lines.push("    errorCount: " + String(st.errorCount || 0));
    }
    function sameRun(a, b) {
        if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
        var aRun = String(a.runId || "");
        var bRun = String(b.runId || "");
        var aPath = String(a.path || "");
        var bPath = String(b.path || "");
        if (aRun && bRun && aRun === bRun) return true;
        if (aPath && bPath && aPath === bPath) return true;
        return false;
    }
    addRun("wordImport", runs.wordImport);
    addRun("autoTiming", runs.autoTiming);
    if (!sameRun(runs.autoTiming, runs.autoTimingCompleted)) {
        addRun("autoTimingCompleted", runs.autoTimingCompleted);
    }
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
    CPHostAPI.call("getDiagnosticsSnapshot", [], { module: "diagnostics", timeoutMs: 10000 }, function (out) {
        if (!out || !out.ok) {
            var err = out && (out.error || out.result) ? String(out.error || out.result) : "Unknown error";
            _diagSetText("diag-content", "Diagnostics failed:\n" + err);
            logUiError("diagnostics.load", err);
            return;
        }

        var snap = out.result || {};
        var hist = (window.CPHostAPI && typeof CPHostAPI.history === "function") ? CPHostAPI.history(20) : [];
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
