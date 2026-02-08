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

                // Some bridges may return a JSON string instead of an object.
                if (typeof r === "string") {
                    var rt = String(r || "").trim();
                    if (rt && rt[0] === "{") {
                        try {
                            var robj = JSON.parse(rt);
                            if (robj && typeof robj === "object") {
                                r = robj;
                            }
                        } catch (eParse) {}
                    }
                }

                if (!r || typeof r !== "object" || !r.path) {
                    var dbg = "";
                    try { dbg = JSON.stringify(out); } catch (eDbg) { dbg = String(out); }

                    var meta = "";
                    try {
                        meta = "resultType=" + (typeof out.result) + ", resultPreview=" + String(out.result).slice(0, 200);
                    } catch (eMeta) {}

                    var dumpText = "Export Blocks: unexpected host response\n" + meta + "\n\nDEBUG(out):\n" + dbg;

                    // Write a debug file so the user can copy/share it (alert() text is hard to copy).
                    aeCall("writeAutoTimingDebug(" + JSON.stringify(dumpText) + ")", function (dumpOut) {
                        var dumpPath = "";
                        try {
                            if (dumpOut && dumpOut.ok) {
                                var dr = dumpOut.result;
                                if (dr && typeof dr === "object" && dr.path) dumpPath = dr.path;
                                else if (typeof dr === "string") dumpPath = dr;
                            }
                        } catch (eDump) {}

                        var msg = "Export Blocks: unexpected host response.";
                        if (dumpPath) msg += "\n\nDebug saved to:\n" + dumpPath;
                        msg += "\n\nDEBUG(out):\n" + dbg;
                        uiAlert(msg);
                    });

                    logUiError("autoTiming.exportBlocks", "unexpected response: " + dumpText);
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
