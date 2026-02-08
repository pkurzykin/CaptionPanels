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
        function _doExport() {
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
        }

        // Ensure host function is available even if the host/lib folder wasn't copied yet.
        aeCall("typeof exportSubtitleBlocks", function (chk) {
            var t = chk && chk.result !== undefined ? String(chk.result) : "";
            var isFn = String(t || "").toLowerCase() === "function";
            if (isFn) {
                _doExport();
                return;
            }

            aeCall('loadModule("auto_timing.jsx")', function () {
                aeCall("typeof exportSubtitleBlocks", function (chk2) {
                    var t2 = chk2 && chk2.result !== undefined ? String(chk2.result) : "";
                    var isFn2 = String(t2 || "").toLowerCase() === "function";
                    if (!isFn2) {
                        var dbg2 = "";
                        try { dbg2 = JSON.stringify({ before: chk, after: chk2 }); } catch (eDbg2) { dbg2 = String(t2); }
                        uiAlert(
                            "Export Blocks: host function is not available.\n\nDEBUG:\n" + dbg2 +
                            "\n\nMake sure this file exists in the plugin folder:\n" +
                            "host/lib/auto_timing.jsx\n\nThen press Reload."
                        );
                        logUiError("autoTiming.exportBlocks", "host function missing: " + dbg2);
                        return;
                    }

                    _doExport();
                });
            });
        });
    });
}
