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
    if (r.whisperxDeviceMode) msg += "\nWhisperX device mode: " + r.whisperxDeviceMode;
    if (r.whisperxDeviceRequested) msg += "\nWhisperX device requested: " + r.whisperxDeviceRequested;
    if (r.whisperxDeviceUsed) msg += "\nWhisperX device used: " + r.whisperxDeviceUsed;

    if (r.whisperxArgs) msg += "\nWhisperX args: " + r.whisperxArgs;
    if (r.whisperxArgsIgnored && r.whisperxArgsIgnored.length) msg += "\nWhisperX ignored: " + r.whisperxArgsIgnored.join(", ");
    if (typeof r.whisperxTimeShiftAppliedSec !== "undefined") msg += "\nTime shift applied (sec): " + r.whisperxTimeShiftAppliedSec;
    if (typeof r.whisperxTimeShiftSuggestedSec !== "undefined") msg += "\nTime shift suggested (sec): " + r.whisperxTimeShiftSuggestedSec;
    if (r.whisperxOnsetBiasSec && typeof r.whisperxOnsetBiasSec === "object") {
        msg += "\nOnset bias (sec): median=" + (r.whisperxOnsetBiasSec.median || 0) + " p90=" + (r.whisperxOnsetBiasSec.p90 || 0) + " n=" + (r.whisperxOnsetBiasSec.count || 0);
    }

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

function _startAutoTimingProgress() {
    var dots = 0;
    var t0 = Date.now();
    showTaskProgress("Auto Timing (WhisperX)", "Preparing...");
    updateTaskProgress(2, "Preparing...");

    var timer = setInterval(function () {
        var sec = (Date.now() - t0) / 1000.0;
        var pct = 2;
        var caption = "Preparing...";

        if (sec < 3) {
            pct = 2 + sec * 4; // 2..14
            caption = "Exporting subtitle blocks...";
        } else if (sec < 25) {
            pct = 14 + (sec - 3) * 2.1; // 14..60
            caption = "Running WhisperX transcription...";
        } else if (sec < 55) {
            pct = 60 + (sec - 25) * 0.9; // 60..87
            caption = "Aligning words to subtitle blocks...";
        } else if (sec < 75) {
            pct = 87 + (sec - 55) * 0.35; // 87..94
            caption = "Applying timings in After Effects...";
        } else {
            pct = 94;
            dots = (dots + 1) % 4;
            caption = "Finalizing" + Array(dots + 1).join(".");
        }

        if (pct > 95) pct = 95;
        updateTaskProgress(pct, caption);
    }, 500);

    return function (ok) {
        clearInterval(timer);
        if (ok) {
            updateTaskProgress(100, "Done.");
            setTimeout(function () { hideTaskProgress(); }, 250);
        } else {
            hideTaskProgress();
        }
    };
}

function initAutoTimingUI() {
    attachClick("btn-auto-timing-whisperx", function () {
        var btn = document.getElementById("btn-auto-timing-whisperx");
        var prevText = btn ? btn.textContent : "";
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Running WhisperX...";
        }

        var stopProgress = _startAutoTimingProgress();

        _evalAe("autoTimingRunWhisperXAndApply()", function (out, raw) {
            if (btn) {
                btn.disabled = false;
                btn.textContent = prevText;
            }

            if (!out || !out.ok) {
                try { stopProgress(false); } catch (eP0) {}
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
                try { stopProgress(false); } catch (eP1) {}
                uiAlert("Auto Timing (WhisperX): unexpected host result");
                return;
            }

            try { stopProgress(true); } catch (eP2) {}
            uiAlert(_formatWhisperAutoTimingSummary(r));
        });
    });
}
