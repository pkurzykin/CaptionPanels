// host/lib/auto_timing.jsx
// =====================================================
// Auto-timing helpers (Phase A)
// - Export subtitle blocks (segId + text) to blocks.json
// =====================================================

(function () {
    function _normalizePath(p) {
        var s = String(p || "").replace(/\\/g, "/");
        // Fix macOS-style "/C:/..." paths sometimes coming from fsName
        var winMatch = s.match(/^\/([A-Za-z]:\/.*)/);
        if (winMatch) s = winMatch[1];
        return s;
    }

    function _dirName(p) {
        var s = _normalizePath(p);
        var idx = s.lastIndexOf("/");
        if (idx <= 0) return "";
        return s.slice(0, idx);
    }

    function _isAbsolutePath(p) {
        var s = _normalizePath(p);
        return (/^[A-Za-z]:\//).test(s) || s.indexOf("//") === 0 || s.indexOf("/") === 0;
    }

    function _resolvePathRelativeToConfig(pathValue) {
        var v = _normalizePath(pathValue);
        if (!v) return "";
        if (_isAbsolutePath(v)) return v;
        try {
            var base = _dirName(getConfigPath());
            if (base) return base + "/" + v;
        } catch (e) {}
        return v;
    }

    function _two(n) {
        n = Number(n) || 0;
        return (n < 10 ? "0" : "") + String(n);
    }

    function _timestamp() {
        var d = new Date();
        return String(d.getFullYear()) + _two(d.getMonth() + 1) + _two(d.getDate()) +
            "_" + _two(d.getHours()) + _two(d.getMinutes()) + _two(d.getSeconds());
    }

    function _ensureFolder(path) {
        try {
            var f = new Folder(path);
            if (!f.exists) f.create();
        } catch (e) {}
    }

    function _sanitizeFileBase(name) {
        var s = String(name || "");
        // Windows reserved characters
        s = s.replace(/[<>:"\/\\|?*\x00-\x1F]+/g, "_");
        s = s.replace(/\s+/g, "_");
        s = s.replace(/_+/g, "_");
        s = s.replace(/^_+|_+$/g, "");
        if (!s) s = "comp";
        // avoid super long file names
        if (s.length > 60) s = s.slice(0, 60);
        return s;
    }

    function _getSegId(layer) {
        try {
            var c = String(layer.comment || "");
            var m = c.match(/CP_SEGID=([^\r\n]+)/);
            if (m && m[1]) return String(m[1]);
        } catch (e) {}
        try { return String(layer.name || ""); } catch (e2) { return ""; }
    }

    function _getTypeFromName(layerName) {
        var n = String(layerName || "");
        if (n.indexOf("Sub_SYNCH_") === 0) return "synch";
        return "voiceover";
    }

    function _getLayerText(layer) {
        try {
            var p = layer.property("Source Text");
            if (!p) return "";
            var td = p.value;
            var t = "";
            try { t = (td && td.text !== undefined) ? td.text : String(td); } catch (e) { t = String(td); }
            t = String(t || "");
            // Normalize AE line breaks (\r) to \n
            t = t.replace(/\r\n|\r/g, "\n");
            return t;
        } catch (e2) {
            return "";
        }
    }

    function _toOneLine(text) {
        return String(text || "")
            .replace(/\r\n|\r|\n/g, " ")
            .replace(/\s+/g, " ")
            .replace(/^\s+|\s+$/g, "");
    }

    function _isSubtitleLayerName(name) {
        var n = String(name || "");
        return (n.indexOf("Sub_VOICEOVER_") === 0 || n.indexOf("Sub_SYNCH_") === 0);
    }

    function _collectSubtitleBlocks(comp) {
        var arr = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !l.name) continue;
            if (!_isSubtitleLayerName(l.name)) continue;

            var segId = _getSegId(l);
            var text = _getLayerText(l);

            arr.push({
                segId: segId,
                type: _getTypeFromName(l.name),
                text: text,
                textOneLine: _toOneLine(text),
                _in: Number(l.inPoint) || 0,
                _idx: Number(l.index) || i
            });
        }

        // Stable order for downstream matching: left-to-right by timeline.
        arr.sort(function (a, b) {
            if (a._in === b._in) return a._idx - b._idx;
            return a._in - b._in;
        });

        var blocks = [];
        for (var j = 0; j < arr.length; j++) {
            var it = arr[j];
            blocks.push({
                segId: it.segId,
                type: it.type,
                text: it.text,
                textOneLine: it.textOneLine
            });
        }

        return blocks;
    }

    function _writeJsonFile(filePath, obj) {
        var f = null;
        try {
            f = new File(filePath);
            f.encoding = "UTF-8";
            if (!f.open("w")) return false;
            var json = "";
            try {
                json = JSON.stringify(obj, null, 2);
            } catch (e) {
                json = String(obj);
            }
            f.write(json);
            f.close();
            return true;
        } catch (e2) {
            try { if (f && f.opened) f.close(); } catch (e3) {}
            return false;
        }
    }

    function _getAutoTimingOutDir() {
        var outDirRaw = "";
        try { outDirRaw = String(getConfigValue("autoTimingOutDir", "") || ""); } catch (e) {}
        var outDir = _resolvePathRelativeToConfig(outDirRaw);
        if (!outDir) {
            try {
                outDir = Folder.userData.fsName + "/CaptionPanels/auto_timing";
            } catch (e2) {
                try { outDir = Folder.temp.fsName + "/CaptionPanels/auto_timing"; } catch (e3) {}
            }
        }
        return _normalizePath(outDir);
    }

    function _writeTextFile(filePath, text) {
        var f = null;
        try {
            f = new File(filePath);
            f.encoding = "UTF-8";
            if (!f.open("w")) return false;
            f.write(String(text || ""));
            f.close();
            return true;
        } catch (e2) {
            try { if (f && f.opened) f.close(); } catch (e3) {}
            return false;
        }
    }

    // Debug helper: dumps diagnostics to a file in autoTimingOutDir.
    // This is useful when the bridge returns an unexpected response that is hard to copy from alert().
    writeAutoTimingDebug = function (text) {
        try {
            // Read fresh config (outDir can be changed via config.json).
            try { if (typeof reloadConfig === "function") reloadConfig(); } catch (eCfg) {}

            var outDir = _getAutoTimingOutDir();
            if (!outDir) {
                try { outDir = Folder.userData.fsName + "/CaptionPanels/auto_timing"; } catch (e1) {}
                try { if (!outDir) outDir = Folder.temp.fsName + "/CaptionPanels/auto_timing"; } catch (e2) {}
            }

            outDir = _normalizePath(outDir);
            if (!outDir) return respondErr("autoTimingOutDir is empty");
            _ensureFolder(outDir);

            var outPath = outDir + "/export_blocks_debug_" + _timestamp() + ".txt";
            outPath = _normalizePath(outPath);

            if (!_writeTextFile(outPath, String(text || ""))) {
                return respondErr("Cannot write debug file: " + outPath);
            }

            return respondOk({ path: outPath });
        } catch (e0) {
            var msg = "";
            try { msg = (e0 && (e0.message || e0.description)) ? (e0.message || e0.description) : String(e0); } catch (e1x) { msg = "Unknown error"; }
            if (!msg) msg = "Unknown error";
            return respondErr(msg);
        }
    };

    exportSubtitleBlocks = function () {
        try {
            if (!app || !app.project) return respondErr("No active project");
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return respondErr("No active comp");

            // Make sure we read the latest config.
            try { if (typeof reloadConfig === "function") reloadConfig(); } catch (e) {}

            var blocks = _collectSubtitleBlocks(comp);
            if (!blocks || !blocks.length) {
                return respondErr("No subtitle blocks found (expected Sub_VOICEOVER_* or Sub_SYNCH_*)");
            }

            var outDir = _getAutoTimingOutDir();
            if (!outDir) return respondErr("autoTimingOutDir is empty");
            _ensureFolder(outDir);

            var base = _sanitizeFileBase(comp.name || "comp");
            var outPath = outDir + "/blocks_" + base + "_" + _timestamp() + ".json";
            outPath = _normalizePath(outPath);

            var payload = {
                schemaVersion: 1,
                source: {
                    engine: "CaptionPanels",
                    aeVersion: (app && app.version) ? String(app.version) : "",
                    compName: String(comp.name || ""),
                    fps: Number(comp.frameRate) || 0,
                    exportedAt: _timestamp()
                },
                blocks: blocks
            };

            if (!_writeJsonFile(outPath, payload)) {
                return respondErr("Cannot write blocks.json: " + outPath);
            }

            return respondOk({
                outDir: outDir,
                path: outPath,
                count: blocks.length
            });
        } catch (e0) {
            var msg = "";
            try { msg = (e0 && (e0.message || e0.description)) ? (e0.message || e0.description) : String(e0); } catch (e1) { msg = "Unknown error"; }
            if (!msg) msg = "Unknown error";
            return respondErr(msg);
        }
    };

    // Ensure globals are visible when scripts are loaded via eval() inside loadModule().
    try {
        if ($ && $.global) {
            $.global.exportSubtitleBlocks = exportSubtitleBlocks;
            $.global.writeAutoTimingDebug = writeAutoTimingDebug;
        }
    } catch (eG) {}
})();
