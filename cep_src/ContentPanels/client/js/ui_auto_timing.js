// ui_auto_timing.js
// Export subtitle blocks (segId + text) for external alignment utility.

function _formatBlocksExportSummary(res) {
    var r = res || {};
    var msg = "Blocks exported.";
    msg += "
Blocks: " + (r.count || 0);
    if (r.path) msg += "
File: " + r.path;
    return msg;
}

function initAutoTimingUI() {
    attachClick("btn-export-blocks", function () {
        aeCall("exportSubtitleBlocks()", function (out) {
            if (!out || !out.ok) {
                var err = out && out.error ? String(out.error) : "Unknown error";
                if (err === "CANCELLED") return;
                uiAlert("Export Blocks failed.
" + err);
                logUiError("autoTiming.exportBlocks", err);
                return;
            }

            uiAlert(_formatBlocksExportSummary(out.result));
            logUi("autoTiming.exportBlocks ok");
        });
    });
}
