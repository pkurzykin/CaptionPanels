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
                if (typeof safeJsonStringify === "function") {
                    json = safeJsonStringify(obj, 2);
                } else if (typeof JSON !== "undefined" && JSON && typeof JSON.stringify === "function") {
                    json = JSON.stringify(obj, null, 2);
                } else {
                    json = String(obj);
                }
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

    function _getCaptionPanelsDataRoot() {
        var raw = "";
        try { raw = String(getConfigValue("captionPanelsDataRoot", "") || ""); } catch (e) {}
        var root = _resolvePathRelativeToConfig(raw);
        // Sane Windows default (also matches our documentation).
        if (!root) root = "C:/AE/CaptionPanelsData";
        return _normalizePath(root);
    }

    function _getAutoTimingOutDir() {
        var outDirRaw = "";
        try { outDirRaw = String(getConfigValue("autoTimingOutDir", "") || ""); } catch (e) {}
        var outDir = _resolvePathRelativeToConfig(outDirRaw);

        // Prefer the unified data root if the legacy key is not set.
        if (!outDir) {
            var root = _getCaptionPanelsDataRoot();
            if (root) outDir = root + "/auto_timing";
        }

        if (!outDir) {
            try {
                outDir = Folder.userData.fsName + "/CaptionPanels/auto_timing";
            } catch (e2) {
                try { outDir = Folder.temp.fsName + "/CaptionPanels/auto_timing"; } catch (e3) {}
            }
        }

        return _normalizePath(outDir);
    }

    function _getAutoTimingBlocksDir() {
        var raw = "";
        try { raw = String(getConfigValue("autoTimingBlocksDir", "") || ""); } catch (e) {}
        var dir = _resolvePathRelativeToConfig(raw);
        if (!dir) {
            var outDir = _getAutoTimingOutDir();
            if (outDir) dir = outDir + "/blocks";
        }
        return _normalizePath(dir);
    }

    function _getAutoTimingWhisperXDir() {
        var raw = "";
        try { raw = String(getConfigValue("autoTimingWhisperXDir", "") || ""); } catch (e) {}
        var dir = _resolvePathRelativeToConfig(raw);
        if (!dir) {
            var outDir = _getAutoTimingOutDir();
            if (outDir) dir = outDir + "/whisperx";
        }
        return _normalizePath(dir);
    }

    function _getAutoTimingAlignmentDir() {
        var raw = "";
        try { raw = String(getConfigValue("autoTimingAlignmentDir", "") || ""); } catch (e) {}
        var dir = _resolvePathRelativeToConfig(raw);
        if (!dir) {
            var outDir = _getAutoTimingOutDir();
            if (outDir) dir = outDir + "/alignment";
        }
        return _normalizePath(dir);
    }

    function _getAutoTimingLogsDir() {
        var raw = "";
        try { raw = String(getConfigValue("autoTimingLogsDir", "") || ""); } catch (e) {}
        var dir = _resolvePathRelativeToConfig(raw);
        if (!dir) {
            var outDir = _getAutoTimingOutDir();
            if (outDir) dir = outDir + "/logs";
        }
        return _normalizePath(dir);
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

    // Debug helper: dumps diagnostics to a file in autoTimingLogsDir.
    // This is useful when the bridge returns an unexpected response that is hard to copy from alert().
    writeAutoTimingDebug = function (text) {
        try {
            // Read fresh config (paths can be changed via config.json).
            try { if (typeof reloadConfig === "function") reloadConfig(); } catch (eCfg) {}

            var outDir = _getAutoTimingLogsDir();
            if (!outDir) return respondErr("autoTimingLogsDir is empty");
            _ensureFolder(outDir);

            var outPath = outDir + "/auto_timing_debug_" + _timestamp() + ".txt";
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

    

    function _readFileText(filePath) {
        var p = _normalizePath(filePath);
        var f = new File(p);
        if (!f.exists) throw new Error("File not found: " + p);

        var txt = "";
        try {
            f.encoding = "UTF-8";
            if (!f.open("r")) throw new Error("Cannot open file: " + p);
            txt = f.read();
            f.close();
        } catch (e1) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            // UTF-16 fallback (some Windows tools save JSON as UTF-16)
            f = new File(p);
            f.encoding = "UTF-16";
            if (!f.open("r")) throw new Error("Cannot open file (UTF-16): " + p);
            txt = f.read();
            f.close();
        }

        if (txt && txt.length && txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
        return String(txt || "");
    }

    function _parseJsonSafe(text) {
        var s = String(text || "");
        if (s && s.length && s.charCodeAt(0) === 0xFEFF) s = s.slice(1);

        // Prefer JSON.parse when available.
        if (typeof JSON !== "undefined" && JSON && typeof JSON.parse === "function") {
            try { return JSON.parse(s); } catch (e) {}
        }

        // Fallback: ExtendScript eval.
        try { return eval("(" + s + ")"); } catch (e2) {}
        return null;
    }

    function _readJsonFile(filePath) {
        var txt = _readFileText(filePath);
        var obj = _parseJsonSafe(txt);
        if (!obj) throw new Error("Invalid JSON: " + _normalizePath(filePath));
        return obj;
    }

    function _asNum(v) {
        var n = Number(v);
        return isNaN(n) ? null : n;
    }

    function _timeFromAlignmentItem(item, compFps) {
        if (!item) return null;

        var segId = String(item.segId || item.segID || item.id || "");
        if (!segId) return null;

        // seconds-based keys
        var s = _asNum(item.start);
        if (s === null) s = _asNum(item["in"]);
        if (s === null) s = _asNum(item.startSec);
        if (s === null) s = _asNum(item.inSec);

        var e = _asNum(item.end);
        if (e === null) e = _asNum(item["out"]);
        if (e === null) e = _asNum(item.endSec);
        if (e === null) e = _asNum(item.outSec);

        // frame-based keys
        if (s === null) {
            var sf = _asNum(item.startFrame);
            if (sf === null) sf = _asNum(item.startFrames);
            if (sf !== null) s = sf / (compFps || 25);
        }
        if (e === null) {
            var ef = _asNum(item.endFrame);
            if (ef === null) ef = _asNum(item.endFrames);
            if (ef !== null) e = ef / (compFps || 25);
        }
        if (s === null || e === null) return null;

        return { segId: segId, start: s, end: e, confidence: _asNum(item.confidence) };
    }

    function _extractAlignmentBlocks(alignmentObj) {
        if (!alignmentObj) return [];
        var a = alignmentObj;
        if (a instanceof Array) return a;
        if (a.blocks && (a.blocks instanceof Array)) return a.blocks;
        if (a.timings && (a.timings instanceof Array)) return a.timings;
        if (a.items && (a.items instanceof Array)) return a.items;
        return [];
    }

    function _collectSegIdMap(comp) {
        var map = {};
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !l.name) continue;
            if (!_isSubtitleLayerName(l.name)) continue;

            var segId = _getSegId(l);
            if (segId) map[segId] = l;
            // Fallback: layer name as ID too.
            try {
                var ln = String(l.name || "");
                if (ln && !map[ln]) map[ln] = l;
            } catch (e) {}
        }
        return map;
    }

    function _readAlignmentSettings(alignmentObj) {
        var s = (alignmentObj && alignmentObj.settings) ? alignmentObj.settings : {};
        function n(key, def) {
            var v = null;
            try { v = _asNum(s[key]); } catch (e) { v = null; }
            return (v === null) ? def : v;
        }
        return {
            padStartFrames: n("padStartFrames", 0),
            padEndFrames: n("padEndFrames", 0),
            minDurationFrames: n("minDurationFrames", 1)
        };
    }

    function _clamp(v, a, b) {
        if (v < a) return a;
        if (v > b) return b;
        return v;
    }

    function _buildTimingChanges(comp, alignmentObj) {
        var fps = Number(comp.frameRate) || 25;
        var st = _readAlignmentSettings(alignmentObj);
        var items = _extractAlignmentBlocks(alignmentObj);
        var map = _collectSegIdMap(comp);

        var changes = [];
        var missing = [];
        var invalid = [];

        for (var i = 0; i < items.length; i++) {
            var t = _timeFromAlignmentItem(items[i], fps);
            if (!t) {
                invalid.push({ idx: i, reason: "bad_item" });
                continue;
            }

            var layer = map[t.segId];
            if (!layer) {
                missing.push({ segId: t.segId });
                continue;
            }

            var start = t.start - (st.padStartFrames / fps);
            var end = t.end + (st.padEndFrames / fps);

            // Minimum duration
            var minDur = (st.minDurationFrames / fps);
            if (end - start < minDur) end = start + minDur;

            // Clamp to comp duration
            start = _clamp(start, 0, comp.duration);
            end = _clamp(end, 0, comp.duration);

            if (end <= start) {
                invalid.push({ segId: t.segId, reason: "end<=start" });
                continue;
            }

            changes.push({
                segId: t.segId,
                layerIndex: layer.index,
                oldIn: Number(layer.inPoint) || 0,
                oldOut: Number(layer.outPoint) || 0,
                newIn: start,
                newOut: end,
                confidence: t.confidence
            });
        }

        // Sort by newIn to apply left-to-right.
        changes.sort(function (a, b) {
            if (a.newIn === b.newIn) return a.layerIndex - b.layerIndex;
            return a.newIn - b.newIn;
        });

        return {
            settings: st,
            total: items.length,
            changes: changes,
            missing: missing,
            invalid: invalid
        };
    }

    autoTimingPickAlignmentFile = function () {
        try {
            var f = File.openDialog("Select alignment.json", "*.json");
            if (!f) return respondErr("CANCELLED");
            return respondOk({ path: _normalizePath(f.fsName) });
        } catch (e) {
            return respondErr(e.message);
        }
    };

    autoTimingPreviewApply = function (alignmentPath) {
        try {
            if (!app || !app.project) return respondErr("No active project");
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return respondErr("No active comp");

            var p = _normalizePath(alignmentPath);
            if (!p) return respondErr("alignmentPath is empty");

            var alignmentObj = _readJsonFile(p);
            var res = _buildTimingChanges(comp, alignmentObj);

            // Keep preview small (UI can ask for full later)
            var first = [];
            for (var i = 0; i < res.changes.length && i < 30; i++) {
                first.push(res.changes[i]);
            }

            return respondOk({
                filePath: p,
                total: res.total,
                matched: res.changes.length,
                missingCount: res.missing.length,
                invalidCount: res.invalid.length,
                settings: res.settings,
                firstChanges: first,
                firstMissing: res.missing.slice(0, 30)
            });
        } catch (e) {
            return respondErr(e.message);
        }
    };

    autoTimingApply = function (alignmentPath) {
        try {
            if (!app || !app.project) return respondErr("No active project");
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return respondErr("No active comp");

            var p = _normalizePath(alignmentPath);
            if (!p) return respondErr("alignmentPath is empty");

            var alignmentObj = _readJsonFile(p);
            var res = _buildTimingChanges(comp, alignmentObj);

            app.beginUndoGroup("CaptionPanels: Apply Auto Timing");

            // Rebuild segId map once more (layers can be reordered)
            var segMap = _collectSegIdMap(comp);
            var applied = 0;
            var errors = [];

            for (var i = 0; i < res.changes.length; i++) {
                var ch = res.changes[i];
                var layer = segMap[ch.segId];
                if (!layer) continue;

                try {
                    var delta = ch.newIn - (Number(layer.inPoint) || 0);
                    // Move the layer to the new start time.
                    layer.startTime = (Number(layer.startTime) || 0) + delta;

                    // Force in/out exactly (avoid drift if AE didn't shift them as expected).
                    try { layer.inPoint = ch.newIn; } catch (eIn) {}
                    try { layer.outPoint = ch.newOut; } catch (eOut) {}

                    applied++;
                } catch (eL) {
                    errors.push({ segId: ch.segId, error: eL.message });
                }
            }

            // Recompute BG groups after timings changed.
            try {
                if (typeof _updateSubtitleBg === "function") _updateSubtitleBg(comp);
            } catch (eBg) {}

            app.endUndoGroup();

            return respondOk({
                filePath: p,
                total: res.total,
                matched: res.changes.length,
                applied: applied,
                missingCount: res.missing.length,
                invalidCount: res.invalid.length,
                errorCount: errors.length,
                firstErrors: errors.slice(0, 20)
            });
        } catch (e) {
            try { app.endUndoGroup(); } catch (e2) {}
            return respondErr(e.message);
        }
    };

    autoTimingApplyFromDialog = function () {
        try {
            var pick = autoTimingPickAlignmentFile();
            var parsed = null;
            try { parsed = _parseJsonSafe(String(pick || "")); } catch (e0) { parsed = null; }
            // If pick returned a JSON response string, parse it. Otherwise, just return it.
            if (parsed && parsed.ok) {
                var p = parsed.result && parsed.result.path ? String(parsed.result.path) : "";
                if (!p) return respondErr("No path returned from picker");
                return autoTimingApply(p);
            }
            return pick;
        } catch (e) {
            return respondErr(e.message);
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

            var blocksDir = _getAutoTimingBlocksDir();
            if (!blocksDir) return respondErr("autoTimingBlocksDir is empty");
            _ensureFolder(blocksDir);

            var base = _sanitizeFileBase(comp.name || "comp");
            var outPath = blocksDir + "/blocks_" + base + "_" + _timestamp() + ".json";
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
                blocksDir: blocksDir,
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
            $.global.autoTimingPickAlignmentFile = autoTimingPickAlignmentFile;
            $.global.autoTimingPreviewApply = autoTimingPreviewApply;
            $.global.autoTimingApply = autoTimingApply;
            $.global.autoTimingApplyFromDialog = autoTimingApplyFromDialog;
        }
    } catch (eG) {}
})();
