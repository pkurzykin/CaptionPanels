// ui_auto_timing.js
// Export subtitle blocks (segId + text) for external alignment utility.

function _formatBlocksExportSummary(res) {
    var r = (res && typeof res === "object") ? res : {};
    var msg = "Blocks exported.";
    msg += "\nBlocks: " + (r.count || 0);
    if (r.path) msg += "\nFile: " + r.path;
    return msg;
}

function initAutoTimingUI() {
    attachClick("btn-export-blocks", function () {
        aeCall("exportSubtitleBlocks()", function (out) {
            if (!out || !out.ok) {
                var err = out && out.error ? String(out.error) : "Unknown error";
                if (err === "CANCELLED") return;
                uiAlert("Export Blocks failed.\n" + err);
                logUiError("autoTiming.exportBlocks", err);
                return;
            }

            var r = out.result;
            if (!r || typeof r !== "object" || !r.path) {
                var dbg = "";
                try { dbg = JSON.stringify(out); } catch (eDbg) { dbg = String(out); }
                uiAlert("Export Blocks: unexpected host response.\n\nDEBUG:\n" + dbg);
                logUiError("autoTiming.exportBlocks", "unexpected response: " + dbg);
                return;
            }

            uiAlert(_formatBlocksExportSummary(r));
            logUi("autoTiming.exportBlocks ok");
        });
    });
}
