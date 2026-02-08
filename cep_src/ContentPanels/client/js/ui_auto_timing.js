// ui_auto_timing.js
// Export subtitle blocks (segId + text) for external alignment utility.

function _formatBlocksExportSummary(res) {
    var r = (res && typeof res === "object") ? res : {};
    var msg = "Blocks exported.";
    msg += "\nBlocks: " + (r.count || 0);
    if (r.path) msg += "\nFile: " + r.path;
    return msg;
}

// Local parser that does NOT depend on app_core.js parseAeResult().
// This makes the button robust even if the bridge returns objects.
function _parseHostResponse(res) {
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

function _evalAeRaw(cmd, cb) {
    try {
        csInterface.evalScript(cmd, function (res) {
            cb(res);
        });
    } catch (e) {
        cb("Error: " + (e && e.message ? e.message : String(e)));
    }
}

function _evalAe(cmd, cb) {
    _evalAeRaw(cmd, function (raw) {
        cb(_parseHostResponse(raw), raw);
    });
}

function initAutoTimingUI() {
    attachClick("btn-export-blocks", function () {
        function _dumpUnexpected(where, parsed, raw, extra) {
            var dbg = "";
            try {
                dbg = JSON.stringify({ where: where, parsed: parsed, rawType: (typeof raw), raw: raw, extra: extra || null });
            } catch (eDbg) {
                dbg = "where=" + where + " | rawType=" + (typeof raw) + " | raw=" + String(raw);
            }

            // Try to persist debug into a file (better than alert()).
            _evalAe("writeAutoTimingDebug(" + JSON.stringify(dbg) + ")", function (dumpOut, dumpRaw) {
                var dumpPath = "";
                try {
                    if (dumpOut && dumpOut.ok) {
                        var dr = dumpOut.result;
                        if (dr && typeof dr === "object" && dr.path) dumpPath = String(dr.path);
                        else if (typeof dr === "string") dumpPath = String(dr);
                    }
                } catch (eP) {}

                var msg = "Export Blocks: unexpected host response.";
                if (dumpPath) msg += "\n\nDebug saved to:\n" + dumpPath;
                msg += "\n\nDEBUG:\n" + dbg;
                uiAlert(msg);
            });

            try { logUiError("autoTiming.exportBlocks", dbg); } catch (eLog) {}
        }

        function _doExport() {
            _evalAe("exportSubtitleBlocks()", function (out, raw) {
                if (!out || !out.ok) {
                    var err = out && out.error ? String(out.error) : "Unknown error";
                    if (err === "CANCELLED") return;
                    uiAlert("Export Blocks failed.\n" + err);
                    try { logUiError("autoTiming.exportBlocks", err); } catch (eLog) {}
                    return;
                }

                var r = out.result;

                // Some bridges may return a JSON string inside result.
                if (typeof r === "string") {
                    var rt = String(r || "").trim();
                    if (rt && rt[0] === "{") {
                        try {
                            var robj = JSON.parse(rt);
                            if (robj && typeof robj === "object") r = robj;
                        } catch (eParse) {}
                    }
                }

                if (!r || typeof r !== "object" || !r.path) {
                    _dumpUnexpected("exportSubtitleBlocks", out, raw, { resultType: (typeof out.result), resultPreview: String(out.result).slice(0, 200) });
                    return;
                }

                uiAlert(_formatBlocksExportSummary(r));
                try { logUi("autoTiming.exportBlocks ok"); } catch (eLog2) {}
            });
        }

        // Ensure host function is available.
        _evalAe("typeof exportSubtitleBlocks", function (chk, rawChk) {
            var t = (chk && chk.result !== undefined) ? String(chk.result) : "";
            var isFn = String(t || "").toLowerCase() === "function";
            if (isFn) {
                _doExport();
                return;
            }

            _evalAe('loadModule("auto_timing.jsx")', function (_lm, rawLm) {
                _evalAe("typeof exportSubtitleBlocks", function (chk2, rawChk2) {
                    var t2 = (chk2 && chk2.result !== undefined) ? String(chk2.result) : "";
                    var isFn2 = String(t2 || "").toLowerCase() === "function";
                    if (!isFn2) {
                        _dumpUnexpected("hostFunctionMissing", chk2, rawChk2, { before: chk, beforeRaw: rawChk, loadModuleRaw: rawLm });
                        return;
                    }

                    _doExport();
                });
            });
        });
    });
}
