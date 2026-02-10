// ui_auto_timing.js
// Export subtitle blocks (segId + text) for external alignment utility.

function _formatBlocksExportSummary(res) {
    var r = (res && typeof res === "object") ? res : {};
    var msg = "Blocks exported.";
    msg += "\nBlocks: " + (r.count || 0);
    if (r.path) msg += "\nFile: " + r.path;
    return msg;
}

function _formatReasonStats(stats, maxItems) {
    var s = (stats && typeof stats === "object") ? stats : null;
    if (!s) return "";

    var items = [];
    for (var k in s) {
        if (!s.hasOwnProperty(k)) continue;
        items.push({ k: k, v: Number(s[k]) || 0 });
    }
    if (!items.length) return "";

    items.sort(function (a, b) { return (b.v || 0) - (a.v || 0); });

    var limit = (typeof maxItems === "number" && maxItems > 0) ? maxItems : 8;
    var msg = "";
    for (var i = 0; i < items.length && i < limit; i++) {
        msg += "\n- " + items[i].k + ": " + items[i].v;
    }
    if (items.length > limit) msg += "\n...";
    return msg;
}


function _formatWhisperAutoTimingSummary(res) {
    var r = (res && typeof res === "object") ? res : {};
    var a = (r.apply && typeof r.apply === "object") ? r.apply : {};

    var msg = "WhisperX Auto Timing done.";
    if (r.videoPath) msg += "\nVideo: " + r.videoPath;
    if (r.blocksPath) msg += "\nBlocks: " + r.blocksPath;
    if (r.whisperxJson) msg += "\nWhisperX JSON: " + r.whisperxJson;
    if (r.alignmentPath) msg += "\nAlignment: " + r.alignmentPath;

    if (typeof a.total !== "undefined") msg += "\nTotal: " + (a.total || 0);
    if (typeof a.applied !== "undefined") msg += "\nApplied: " + (a.applied || 0);
    if (typeof a.matched !== "undefined") msg += " / matched " + (a.matched || 0);

    if (a.unmatchedCount) msg += "\nUnmatched (ASR): " + a.unmatchedCount;
    if (a.missingCount) msg += "\nMissing segId: " + a.missingCount;
    if (a.invalidCount) msg += "\nInvalid: " + a.invalidCount;
    if (a.errorCount) msg += "\nErrors: " + a.errorCount;

    if (a.reasonStats) {
        msg += "\n\nSkipped reasons:";
        msg += _formatReasonStats(a.reasonStats, 10);
    }

    if (r.whisperxLog) msg += "\nwhisperx log: " + r.whisperxLog;
    if (r.alignLog) msg += "\nalign log: " + r.alignLog;

    return msg;
}


function _fmtSec(v) {
    var n = Number(v);
    if (isNaN(n)) return String(v);
    return n.toFixed(3);
}

function _formatTimingsPreview(preview) {
    var p = (preview && typeof preview === "object") ? preview : {};
    var s = (p.settings && typeof p.settings === "object") ? p.settings : {};

    var msg = "Auto Timing preview";
    if (p.filePath) msg += "\nFile: " + p.filePath;
    msg += "\nTotal blocks in alignment: " + (p.total || 0);
    msg += "\nMatched in comp: " + (p.matched || 0);
    msg += "\nMissing segId: " + (p.missingCount || 0);
    msg += "\nInvalid items: " + (p.invalidCount || 0);

    msg += "\n\nSettings:";
    msg += "\n  padStartFrames: " + (s.padStartFrames || 0);
    msg += "\n  padEndFrames: " + (s.padEndFrames || 0);
    msg += "\n  minDurationFrames: " + (s.minDurationFrames || 0);

    var ch = p.firstChanges || [];
    if (ch && ch.length) {
        msg += "\n\nFirst changes:";
        for (var i = 0; i < ch.length && i < 10; i++) {
            var it = ch[i] || {};
            msg += "\n- " + (it.segId || "?") + " : " + _fmtSec(it.oldIn) + "-" + _fmtSec(it.oldOut) + "  ->  " + _fmtSec(it.newIn) + "-" + _fmtSec(it.newOut);
        }
        if (ch.length > 10) msg += "\n...";
    }

    var miss = p.firstMissing || [];
    if (miss && miss.length) {
        msg += "\n\nFirst missing segId:";
        for (var j = 0; j < miss.length && j < 10; j++) {
            msg += "\n- " + String((miss[j] && miss[j].segId) || "?");
        }
        if (miss.length > 10) msg += "\n...";
    }

    msg += "\n\nApply timings now?";
    return msg;
}

function _formatTimingsApplySummary(res) {
    var r = (res && typeof res === "object") ? res : {};
    var msg = "Auto Timing applied.";
    if (r.filePath) msg += "\nFile: " + r.filePath;

    if (typeof r.total !== "undefined") msg += "\nTotal: " + (r.total || 0);
    msg += "\nApplied: " + (r.applied || 0) + " / matched " + (r.matched || 0);

    if (r.unmatchedCount) msg += "\nUnmatched (ASR): " + r.unmatchedCount;
    if (r.missingCount) msg += "\nMissing: " + r.missingCount;
    if (r.invalidCount) msg += "\nInvalid: " + r.invalidCount;
    if (r.errorCount) msg += "\nErrors: " + r.errorCount;

    if (r.reasonStats) {
        msg += "\n\nSkipped reasons:";
        msg += _formatReasonStats(r.reasonStats, 10);
    }

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
    attachClick("btn-auto-timing-whisperx", function () {
        var btn = document.getElementById("btn-auto-timing-whisperx");
        var prevText = btn ? btn.textContent : "";
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Running WhisperX...";
        }

        _evalAe("autoTimingRunWhisperXAndApply()", function (out, raw) {
            if (btn) {
                btn.disabled = false;
                btn.textContent = prevText;
            }

            if (!out || !out.ok) {
                var err = out && out.error ? String(out.error) : "Unknown error";
                if (err === "CANCELLED") return;
                uiAlert("Auto Timing (WhisperX) failed.\n" + err);
                try { logUiError("autoTiming.whisperx", err); } catch (eLog) {}
                return;
            }

            var r = out.result;
            if (typeof r === "string") {
                var rt = String(r || "").trim();
                if (rt && rt[0] === "{") {
                    try { r = JSON.parse(rt); } catch (eJ) {}
                }
            }

            if (!r || typeof r !== "object") {
                uiAlert("Auto Timing (WhisperX): unexpected host result");
                return;
            }

            uiAlert(_formatWhisperAutoTimingSummary(r));
        });
    });

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
