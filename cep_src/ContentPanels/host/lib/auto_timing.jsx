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


    function _resolveRootPath() {
        try {
            // initPath() sets rootPath for the session (preferred).
            if (typeof rootPath !== "undefined" && rootPath) return rootPath;
        } catch (e0) {}
        try {
            // Fallback: derive root from this JSX file location.
            var f = new File($.fileName);
            if (f && f.parent && f.parent.parent && f.parent.parent.parent) {
                return f.parent.parent.parent.fsName;
            }
        } catch (e) {}
        return "";
    }

    function _resolvePathRelativeToRoot(pathValue) {
        var v = _normalizePath(pathValue);
        if (!v) return "";
        if (_isAbsolutePath(v)) return v;
        var base = _normalizePath(_resolveRootPath());
        if (base) return base + "/" + v;
        return v;
    }

    function _decodeURIComponentSafe(s) {
        var v = String(s || "");
        try { return decodeURIComponent(v); } catch (e) { return v; }
    }

    function _fileBaseNameNoExt(filePath) {
        try {
            var f = new File(_normalizePath(filePath));
            var name = String(f.name || "");
            name = _decodeURIComponentSafe(name);
            // Strip last extension.
            return name.replace(/\.[^\.]+$/, "");
        } catch (e) {
            return "";
        }
    }

    function _parseExitCode(outputText) {
        var s = String(outputText || "");
        var re = /__EXIT_CODE__:\s*(-?\d+)\s*__/g;
        var m = null;
        var last = -1;
        while ((m = re.exec(s)) !== null) {
            if (!m || m[1] === undefined) continue;
            var n = Number(m[1]);
            if (!isNaN(n)) last = n;
        }
        return last;
    }

    function _isCudaUnavailableError(outputText) {
        var s = String(outputText || "");
        var low = s.toLowerCase();

        // Common CUDA/GPU failure signatures across torch/ctranslate2/onnxruntime.
        var patterns = [
            'no cuda gpus are available',
            'torch.cuda.is_available() is false',
            'cuda driver version is insufficient',
            'cudnn',
            'cublas',
            'cuda error',
            'cuda runtime',
            'cuda out of memory',
            'failed to initialize nvml',
            'no kernel image is available',
            'onnxruntimeerror',
            'failed to load cublas',
            'failed to load cudnn'
        ];

        for (var i = 0; i < patterns.length; i++) {
            if (low.indexOf(patterns[i]) !== -1) return true;
        }

        // Heuristic: if output contains CUDA + a clear error keyword.
        if (low.indexOf('cuda') !== -1) {
            if (low.indexOf('error') !== -1 || low.indexOf('failed') !== -1 || low.indexOf('exception') !== -1) {
                return true;
            }
        }

        return false;
    }

    function _isHardCrashExitCode(code) {
        // Negative Windows exit codes often come from native crashes / fastfail,
        // e.g. -1073740791 (0xC0000409) stack buffer overrun.
        try { return Number(code) < 0; } catch (e) { return false; }
    }

    function _escapeCmdArg(s) {
        // Escape quotes for passing a full command as a single quoted argument.
        return String(s || "").replace(/"/g, '""');
    }

    function _toCmdWinPath(p) {
        // cmd.exe on Windows handles backslashes more predictably for local/UNC paths.
        return String(p || "").replace(/\//g, "\\");
    }

    function _hasNonAscii(s) {
        return /[^\x00-\x7F]/.test(String(s || ""));
    }

    function _ensureHiddenRunnerScript(dirPath) {
        try {
            var dir = _normalizePath(dirPath || "");
            if (!dir) {
                try { dir = _normalizePath(Folder.temp.fsName + "/CaptionPanels"); } catch (e0) { dir = ""; }
            }
            if (!dir) return "";
            _ensureFolder(dir);

            var vbsPath = _normalizePath(dir + "/__cp_run_hidden.vbs");
            var f = new File(vbsPath);
            if (!f.exists) {
                var script =
                    'On Error Resume Next\n' +
                    'Dim sh, cmd, code\n' +
                    'cmd = ""\n' +
                    'If WScript.Arguments.Count > 0 Then cmd = WScript.Arguments(0)\n' +
                    'Set sh = CreateObject("WScript.Shell")\n' +
                    'code = sh.Run(cmd, 0, True)\n' +
                    'If Err.Number <> 0 Then\n' +
                    '  WScript.Echo "__EXIT_CODE__:-1__"\n' +
                    '  WScript.Echo "VBS_RUN_ERROR: " & Err.Description\n' +
                    'Else\n' +
                    '  WScript.Echo "__EXIT_CODE__:" & CStr(code) & "__"\n' +
                    'End If\n';
                _writeTextFile(vbsPath, script);
            }
            return vbsPath;
        } catch (e) {
            return "";
        }
    }

    function _runHiddenCommand(cmd, helperDir) {
        var c = String(cmd || "");
        var vbsPath = _ensureHiddenRunnerScript(helperDir);
        if (!vbsPath) {
            try { return system.callSystem(c); } catch (e0) { return "callSystem error: " + String(e0 || "Unknown error"); }
        }

        var runCmd = 'cscript //nologo "' + _normalizePath(vbsPath) + '" "' + _escapeCmdArg(c) + '"';
        try {
            var out = system.callSystem(runCmd);
            if (_parseExitCode(out) !== -1) return out;
        } catch (e1) {}

        // Fallback: direct run (visible) if hidden wrapper failed.
        try { return system.callSystem(c); } catch (e2) { return "callSystem error: " + String(e2 || "Unknown error"); }
    }

    function _runCmdBody(body, label, logDir, stamp) {
        // Wrap into cmd.exe so we can capture stderr and always emit an exit code marker.
        // system.callSystem() can truncate long outputs; when logDir is provided we redirect
        // stdout/stderr to a file so the full output is always available.

        var outLogPath = "";
        try {
            if (logDir) outLogPath = _normalizePath(logDir + "/" + label + "_" + stamp + ".out.txt");
        } catch (eP) { outLogPath = ""; }

        var b = String(body || "");
        var outLogCmdPath = outLogPath ? _toCmdWinPath(outLogPath) : "";

        // Use a temporary .cmd script to avoid nested-quote parsing issues in cmd /C.
        var cmdScriptPath = "";
        try {
            if (logDir) cmdScriptPath = _normalizePath(logDir + "/" + label + "_" + stamp + ".cmd");
            else cmdScriptPath = _normalizePath(Folder.temp.fsName + "/CaptionPanels/" + label + "_" + stamp + ".cmd");
        } catch (eSp) { cmdScriptPath = ""; }
        if (!cmdScriptPath) {
            return { cmd: "", output: "Cannot build command script path", exitCode: -1, logPath: outLogPath, metaPath: "" };
        }

        var script = "@echo off\r\n";
        script += "setlocal EnableExtensions EnableDelayedExpansion\r\n";
        script += b + (outLogCmdPath ? (' 1> "' + outLogCmdPath + '" 2>&1') : " 2>&1") + "\r\n";
        script += 'set "__CP_EC=!errorlevel!"\r\n';
        if (outLogCmdPath) {
            script += 'echo __EXIT_CODE__:!__CP_EC!__>>"' + outLogCmdPath + '"\r\n';
        }
        script += "echo __EXIT_CODE__:!__CP_EC!__\r\n";
        script += "exit /b !__CP_EC!__\r\n";

        if (!_writeBatchFile(cmdScriptPath, script)) {
            return { cmd: "", output: "Cannot write command script: " + cmdScriptPath, exitCode: -1, logPath: outLogPath, metaPath: "" };
        }

        var cmd = 'cmd.exe /V:ON /D /Q /C "' + _toCmdWinPath(cmdScriptPath) + '"';

        var output = _runHiddenCommand(cmd, logDir);
        if (String(output || "").indexOf("callSystem error:") === 0) {
            output += " (is Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network enabled?)";
        }

        function _readExitCodeFromLogWithRetry(path, attempts, sleepMs) {
            var n = Number(attempts);
            if (isNaN(n) || n < 1) n = 1;
            var wait = Number(sleepMs);
            if (isNaN(wait) || wait < 0) wait = 0;
            for (var i = 0; i < n; i++) {
                try {
                    var t = _readFileText(path);
                    var ec = _parseExitCode(t);
                    if (ec !== -1) return ec;
                } catch (eR) {}
                if (i < n - 1 && wait > 0) {
                    try { $.sleep(wait); } catch (eS) {}
                }
            }
            return -1;
        }

        // Prefer exit code marker from redirected output file (more reliable in hidden mode),
        // fallback to wrapper stdout marker.
        var exitCode = -1;
        try {
            if (outLogPath) {
                exitCode = _readExitCodeFromLogWithRetry(outLogPath, 10, 80);
            }
        } catch (eEc) {}
        if (exitCode === -1) exitCode = _parseExitCode(output);

        // Write a small meta-log that points to the full output log (if any).
        var metaPath = "";
        try {
            if (logDir) {
                metaPath = _normalizePath(logDir + "/" + label + "_" + stamp + ".log");
                var logText = "time=" + stamp + "\n";
                logText += "cmd=" + cmd + "\n\n";
                logText += "cmdScript=" + _normalizePath(cmdScriptPath) + "\n";
                logText += "exitCode=" + String(exitCode) + "\n";
                if (outLogPath) logText += "outLog=" + outLogPath + "\n";
                logText += "\noutputTail:\n" + String(output || "") + "\n";
                _writeTextFile(metaPath, logText);
            }
        } catch (eLog) { metaPath = ""; }

        return { cmd: cmd, output: output, exitCode: exitCode, logPath: (outLogPath || metaPath), metaPath: metaPath };
    }

    function _findNewestJsonFile(dirPath) {
        try {
            var folder = new Folder(_normalizePath(dirPath));
            if (!folder.exists) return "";
            var files = folder.getFiles("*.json");
            if (!files || !files.length) return "";

            var best = null;
            var bestT = 0;
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                if (!(f instanceof File)) continue;
                try {
                    if (!f.exists) continue;
                    var mt = 0;
                    try { mt = f.modified ? f.modified.getTime() : 0; } catch (eT) { mt = 0; }
                    if (!best || mt > bestT) {
                        best = f;
                        bestT = mt;
                    }
                } catch (e2) {}
            }
            return best ? _normalizePath(best.fsName) : "";
        } catch (e) {
            return "";
        }
    }

    function _getFilePathFromLayer(layer) {
        try {
            if (!layer) return "";
            var src = layer.source;
            if (!src) return "";

            // Only file-based footage.
            if (src instanceof FootageItem) {
                var f = null;
                try { f = src.file; } catch (e1) { f = null; }
                if (!f) {
                    try { f = src.mainSource && src.mainSource.file ? src.mainSource.file : null; } catch (e2) { f = null; }
                }
                if (f && f.exists) return _normalizePath(f.fsName);
            }
        } catch (e) {}
        return "";
    }

    function _detectVideoFileFromComp(comp) {
        // 1) Prefer selected layers.
        try {
            var sel = comp.selectedLayers;
            if (sel && sel.length) {
                for (var i = 0; i < sel.length; i++) {
                    var p = _getFilePathFromLayer(sel[i]);
                    if (p && p.toLowerCase().match(/\.mp4$/)) return p;
                }
            }
        } catch (e1) {}

        // 2) Otherwise, scan layers top-to-bottom and pick first mp4.
        try {
            for (var j = 1; j <= comp.numLayers; j++) {
                var l = comp.layer(j);
                var p2 = _getFilePathFromLayer(l);
                if (p2 && p2.toLowerCase().match(/\.mp4$/)) return p2;
            }
        } catch (e2) {}

        return "";
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

    function _writeBatchFile(filePath, text) {
        var f = null;
        try {
            f = new File(filePath);
            // cmd.exe reads ANSI/OEM scripts more reliably than UTF-8 BOM.
            f.encoding = "";
            if (!f.open("w")) return false;
            try { f.lineFeed = "Windows"; } catch (eLf) {}
            f.write(String(text || ""));
            f.close();
            return true;
        } catch (e1) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
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
            if (txt && txt.length) {
                if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
                return String(txt || "");
            }
        } catch (e1) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
        }

        try {
            // System codepage fallback (important for cmd.exe output on Windows).
            f = new File(p);
            f.encoding = "";
            if (!f.open("r")) throw new Error("Cannot open file (system encoding): " + p);
            txt = f.read();
            f.close();
            if (txt && txt.length) {
                if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
                return String(txt || "");
            }
        } catch (e3) {
            try { if (f && f.opened) f.close(); } catch (e4) {}
        }

        // UTF-16 fallback (some Windows tools save JSON/logs as UTF-16)
        f = new File(p);
        f.encoding = "UTF-16";
        if (!f.open("r")) throw new Error("Cannot open file (UTF-16): " + p);
        txt = f.read();
        f.close();

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
        function cfgNum(key, def) {
            try {
                var v = Number(getConfigValue(key, def));
                return isNaN(v) ? def : v;
            } catch (eC) {
                return def;
            }
        }
        return {
            padEndFrames: n("padEndFrames", 0),
            minDurationFrames: n("minDurationFrames", 1),
            minGapFrames: n("minGapFrames", cfgNum("autoTimingMinGapFrames", 1))
        };
    }

    function _clamp(v, a, b) {
        if (v < a) return a;
        if (v > b) return b;
        return v;
    }

    function _frameFloor(sec, fps) {
        var f = Number(fps) || 25;
        return Math.floor((Number(sec) || 0) * f + 1e-6) / f;
    }

    function _frameCeil(sec, fps) {
        var f = Number(fps) || 25;
        return Math.ceil((Number(sec) || 0) * f - 1e-6) / f;
    }

    function _parseSubtitleGroup(segId) {
        var s = String(segId || "");
        var m = s.match(/^Sub_(VOICEOVER|SYNCH)_(\d+)_(\d+)$/i);
        if (!m) return null;
        var t = String(m[1] || "").toUpperCase();
        var batch = parseInt(m[2], 10);
        var idx = parseInt(m[3], 10);
        if (isNaN(batch) || isNaN(idx)) return null;
        return {
            type: t,
            batch: batch,
            index: idx,
            key: "Sub_" + t + "_" + String(batch)
        };
    }

    function _sameStitchGroup(segIdA, segIdB) {
        var a = _parseSubtitleGroup(segIdA);
        var b = _parseSubtitleGroup(segIdB);
        if (!a || !b) return false;
        if (a.key !== b.key) return false;
        // Keep only forward order; protects from accidental reverse pairs.
        return b.index > a.index;
    }

    function _refreshSubtitleBgFallback(comp) {
        if (!comp) return false;

        var BG_NAME = "subtitle_BG";
        var BG_PREFIX = "subtitle_BG_";
        var GAP_SEC = 1.0;
        try {
            var gv = Number(getConfigValue("subtitleBgGapSec", 1.0));
            if (!isNaN(gv) && gv >= 0 && gv <= 10) GAP_SEC = gv;
        } catch (eG) {}

        var bg = null;
        try { bg = comp.layer(BG_NAME); } catch (e0) { bg = null; }
        if (!bg) {
            for (var i = 1; i <= comp.numLayers; i++) {
                var l0 = comp.layer(i);
                if (l0 && l0.name && String(l0.name).indexOf(BG_PREFIX) === 0) {
                    bg = l0;
                    try { bg.name = BG_NAME; } catch (eRn) {}
                    break;
                }
            }
        }
        if (!bg) return false;

        for (var r = comp.numLayers; r >= 1; r--) {
            var lr = comp.layer(r);
            if (lr && lr.name && String(lr.name).indexOf(BG_PREFIX) === 0) {
                try { lr.remove(); } catch (eRm) {}
            }
        }

        var subs = [];
        for (var s = 1; s <= comp.numLayers; s++) {
            var sl = comp.layer(s);
            if (!sl || !_isSubtitleLayerName(sl.name)) continue;
            subs.push({
                layer: sl,
                start: Number(sl.inPoint) || 0,
                end: Number(sl.outPoint) || 0
            });
        }
        subs.sort(function (a, b) {
            return (a.start === b.start) ? (a.end - b.end) : (a.start - b.start);
        });

        var groups = [];
        if (subs.length > 0) {
            var gs = subs[0].start;
            var ge = subs[0].end;
            for (var k = 1; k < subs.length; k++) {
                var ss = subs[k].start;
                var ee = subs[k].end;
                if (ss - ge > GAP_SEC) {
                    groups.push({ start: gs, end: ge });
                    gs = ss;
                    ge = ee;
                } else {
                    if (ee > ge) ge = ee;
                }
            }
            groups.push({ start: gs, end: ge });
        }

        if (groups.length === 0) {
            bg.inPoint = comp.time;
            bg.outPoint = comp.time;
            bg.startTime = comp.time;
            return true;
        }

        for (var g = 0; g < groups.length; g++) {
            var grp = groups[g];
            var layer = bg;
            if (g > 0) {
                layer = bg.duplicate();
                layer.name = BG_PREFIX + (g + 1);
            }

            layer.startTime = grp.start;
            layer.inPoint = grp.start;
            layer.outPoint = grp.end;

            var anchor = null;
            for (var j = 1; j <= comp.numLayers; j++) {
                var la = comp.layer(j);
                if (!la || !_isSubtitleLayerName(la.name)) continue;
                if ((Number(la.inPoint) || 0) < grp.start || (Number(la.inPoint) || 0) > grp.end) continue;
                if (!anchor || la.index > anchor.index) anchor = la;
            }
            if (anchor) {
                try { layer.moveAfter(anchor); } catch (eMv) {}
            }
        }
        return true;
    }

    function _refreshSubtitleBgAfterAutoTiming(comp) {
        var ok = false;
        try {
            if (typeof loadModule === "function") {
                // Reload on each apply to avoid stale/missing symbols from script eval order.
                loadModule("subtitles.jsx");
            }
        } catch (eLm) {}

        try {
            if (typeof _updateSubtitleBg === "function") {
                _updateSubtitleBg(comp);
                ok = true;
            }
        } catch (eUp) {
            ok = false;
        }

        if (!ok) {
            try { ok = _refreshSubtitleBgFallback(comp); } catch (eFb) { ok = false; }
        }
        return ok;
    }

    function _buildTimingChanges(comp, alignmentObj) {
        var fps = Number(comp.frameRate) || 25;
        var st = _readAlignmentSettings(alignmentObj);
        var items = _extractAlignmentBlocks(alignmentObj);
        var unmatched = [];
        try { if (alignmentObj && alignmentObj.unmatched && (alignmentObj.unmatched instanceof Array)) unmatched = alignmentObj.unmatched; } catch (eU) { unmatched = []; }
        var map = _collectSegIdMap(comp);

        var changes = [];
        var missing = [];
        var invalid = [];
        var minDurFrames = Math.max(1, Math.round(Number(st.minDurationFrames) || 1));
        var minDur = minDurFrames / fps;
        var minGapFrames = Math.max(0, Math.round(Number(st.minGapFrames) || 0));
        var minGap = minGapFrames / fps;


        for (var i = 0; i < items.length; i++) {
            var t = _timeFromAlignmentItem(items[i], fps);
            if (!t) {
                invalid.push({ idx: i, reason: "bad_item" });
                continue;
            }

            var layer = map[t.segId];
            if (!layer) {
                missing.push({ segId: t.segId, reason: "layer_not_found" });
                continue;
            }

            var start = _frameFloor(t.start, fps);
            var end = _frameCeil(t.end + (st.padEndFrames / fps), fps);

            // Minimum duration
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


        // Include aligner unmatched reasons (ASR/matching issues) into the report.
        try {
            for (var u = 0; u < unmatched.length; u++) {
                var it = unmatched[u];
                if (!it) continue;
                var sid = String(it.segId || it.segID || it.id || "");
                if (!sid) continue;
                var rsn = String(it.reason || "unmatched");
                missing.push({ segId: sid, reason: rsn });
            }
        } catch (eUnm) {}
        // Sort by newIn to apply left-to-right.
        changes.sort(function (a, b) {
            if (a.newIn === b.newIn) return a.layerIndex - b.layerIndex;
            return a.newIn - b.newIn;
        });

        // Pairwise correction:
        // - default: keep min gap between different groups
        // - inside one generated group (Sub_*_<batch>_<n>): force "butt cut" (no gap)
        for (var c = 1; c < changes.length; c++) {
            var prev = changes[c - 1];
            var curCh = changes[c];
            var stitch = _sameStitchGroup(prev.segId, curCh.segId);
            var reqGap = stitch ? 0 : minGap;

            var overlapSec = (prev.newOut + reqGap) - curCh.newIn;
            if (overlapSec <= 1e-9) continue;

            var desiredPrevOut = _frameFloor(curCh.newIn - reqGap, fps);
            var prevMinOut = prev.newIn + minDur;
            if (desiredPrevOut >= prevMinOut) {
                prev.newOut = desiredPrevOut;
                continue;
            }

            // If previous block cannot be shortened safely, move current block right.
            curCh.newIn = _frameCeil(prev.newOut + reqGap, fps);
            if (curCh.newOut - curCh.newIn < minDur) curCh.newOut = curCh.newIn + minDur;

            // For same-group subtitles we want exact adjacency (no visual hole).
            if (stitch) prev.newOut = curCh.newIn;
        }

        // Fill positive gaps inside one generated group (Sub_*_<batch>_<n>) so blocks are in butt cut.
        for (var g = 1; g < changes.length; g++) {
            var p = changes[g - 1];
            var q = changes[g];
            if (!_sameStitchGroup(p.segId, q.segId)) continue;
            if (q.newIn > p.newOut + 1e-9) p.newOut = _frameFloor(q.newIn, fps);
        }

        // Final frame-quantization pass and validation after anti-overlap correction.
        var normalized = [];
        for (var n = 0; n < changes.length; n++) {
            var ch = changes[n];
            ch.newIn = _clamp(_frameFloor(ch.newIn, fps), 0, comp.duration);
            ch.newOut = _clamp(_frameCeil(ch.newOut, fps), 0, comp.duration);
            if (ch.newOut - ch.newIn < minDur) ch.newOut = _clamp(ch.newIn + minDur, 0, comp.duration);
            if (ch.newOut <= ch.newIn) {
                invalid.push({ segId: ch.segId, reason: "end<=start_after_normalize" });
                continue;
            }
            normalized.push(ch);
        }
        changes = normalized;

        return {
            settings: st,
            total: items.length + (unmatched ? unmatched.length : 0),
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
                firstMissing: res.missing.slice(0, 30),
                unmatchedCount: (alignmentObj && alignmentObj.unmatched && (alignmentObj.unmatched instanceof Array)) ? alignmentObj.unmatched.length : 0,
                firstUnmatched: (alignmentObj && alignmentObj.unmatched && (alignmentObj.unmatched instanceof Array)) ? alignmentObj.unmatched.slice(0, 30) : []
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

            // Recompute subtitle_BG after timings changed.
            try { _refreshSubtitleBgAfterAutoTiming(comp); } catch (eBg) {}

            // Build a concise reason histogram for skipped blocks (unmatched, layer missing, invalid).
            var reasonStats = {};
            function _bumpReason(r) {
                var k = String(r || "unknown");
                if (!reasonStats[k]) reasonStats[k] = 0;
                reasonStats[k]++;
            }
            try {
                for (var mi = 0; mi < res.missing.length; mi++) _bumpReason(res.missing[mi] && res.missing[mi].reason);
                for (var ii = 0; ii < res.invalid.length; ii++) _bumpReason(res.invalid[ii] && res.invalid[ii].reason);
                for (var ei = 0; ei < errors.length; ei++) _bumpReason("apply_error");
            } catch (eStats) {}

            app.endUndoGroup();

            return respondOk({
                filePath: p,
                total: res.total,
                matched: res.changes.length,
                applied: applied,
                missingCount: res.missing.length,
                invalidCount: res.invalid.length,
                errorCount: errors.length,
                unmatchedCount: (alignmentObj && alignmentObj.unmatched && (alignmentObj.unmatched instanceof Array)) ? alignmentObj.unmatched.length : 0,
                reasonStats: reasonStats,
                firstMissing: res.missing.slice(0, 30),
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

    

    // One-button workflow:
    // - export blocks
    // - detect video from timeline (or ask user)
    // - run WhisperX
    // - run alignment
    // - apply timings
    autoTimingRunWhisperXAndApply = function () {
        try {
            if (!app || !app.project) return respondErr("No active project");
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return respondErr("No active comp");

            // Always use fresh config (paths/model can be changed via config.json).
            try { if (typeof reloadConfig === "function") reloadConfig(); } catch (eCfg) {}

            var stamp = _timestamp();

            // Logs
            var logsDir = _getAutoTimingLogsDir();
            if (!logsDir) return respondErr("autoTimingLogsDir is empty");
            _ensureFolder(logsDir);

            // 1) Export blocks
            var expRaw = exportSubtitleBlocks();
            var expObj = null;
            try { expObj = _parseJsonSafe(String(expRaw || "")); } catch (eParse) { expObj = null; }
            if (!expObj || !expObj.ok) {
                var em = expObj && expObj.error ? String(expObj.error) : String(expRaw || "Export blocks failed");
                return respondErr("Export blocks failed. " + em);
            }

            var blocksPath = "";
            try { blocksPath = expObj.result && expObj.result.path ? String(expObj.result.path) : ""; } catch (eP) {}
            if (!blocksPath) return respondErr("Export blocks: empty path");

            // 2) Detect video
            var videoPath = _detectVideoFileFromComp(comp);
            if (!videoPath) {
                var vf = File.openDialog("Select video.mp4 for WhisperX", "*.mp4");
                if (!vf) return respondErr("CANCELLED");
                videoPath = _normalizePath(vf.fsName);
            }

            // Shared run folder name (safe)
            var runBase = _sanitizeFileBase(comp.name || "comp") + "_" + stamp;

            // 3) Run WhisperX
            var pyRaw = "";
            try { pyRaw = String(getConfigValue("whisperxPythonPath", "") || ""); } catch (ePy) {}
            var py = _resolvePathRelativeToConfig(pyRaw);
            if (!py) return respondErr("whisperxPythonPath is not set in config.json");
            if (!(new File(py)).exists) return respondErr("Python not found: " + py);

            var pyExe = "\"" + _toCmdWinPath(_normalizePath(py)) + "\"";


            var model = "";
            var lang = "";
            var device = "";
            var deviceMode = "";
            var allowCpuFallback = false;
            var vad = "";
            try { model = String(getConfigValue("whisperxModel", "medium") || "medium"); } catch (eM) { model = "medium"; }
            try { lang = String(getConfigValue("whisperxLanguage", "ru") || "ru"); } catch (eL) { lang = "ru"; }
            try { device = String(getConfigValue("whisperxDevice", "cuda") || "cuda"); } catch (eD) { device = "cuda"; }
            try { deviceMode = String(getConfigValue("whisperxDeviceMode", "") || "").toLowerCase(); } catch (eDm) { deviceMode = ""; }
            try { vad = String(getConfigValue("whisperxVadMethod", "silero") || "silero"); } catch (eV) { vad = "silero"; }
            device = String(device || "").toLowerCase();
            if (deviceMode !== "auto" && deviceMode !== "cuda" && deviceMode !== "cpu") {
                // Backward-compatible fallback for old configs without whisperxDeviceMode.
                deviceMode = (device === "cpu") ? "cpu" : "auto";
            }
            if (deviceMode === "cpu") {
                device = "cpu";
                allowCpuFallback = false;
            } else {
                // "auto" and "cuda" both start on CUDA, but fallback only in "auto".
                device = "cuda";
                allowCpuFallback = (deviceMode === "auto");
            }
            var wxAdv = false;
            try { wxAdv = !!getConfigValue("whisperxAdvancedArgsEnabled", false); } catch (eAx) { wxAdv = false; }
            var wxApplyShift = false;
            try { wxApplyShift = !!getConfigValue("whisperxApplyTimeShift", false); } catch (eSh) { wxApplyShift = false; }

            var wxExtra = "";
            try { wxExtra = String(getConfigValue("whisperxExtraArgs", "") || ""); } catch (eEx) { wxExtra = ""; }
            wxExtra = String(wxExtra || "").replace(/^\s+|\s+$/g, "");

            var wxArgs = "";
            var wxIgnored = [];
            var wxTimeShiftAppliedSec = 0;
            var wxTimeShiftSuggestedSec = 0;
            var wxOnsetBiasSec = null;

            function _num(key, def) {
                var v = Number(getConfigValue(key, def));
                return isNaN(v) ? def : v;
            }

            if (wxAdv) {
                // We pass advanced decode params to our Python runner (not the WhisperX CLI).
                var beam = Math.round(_num("whisperxBeamSize", 5));
                if (beam < 1) beam = 1;
                if (beam > 20) beam = 20;

                var temp = _num("whisperxTemperature", 0.0);
                var noSpeech = _num("whisperxNoSpeechThreshold", 0.6);
                var logprob = _num("whisperxLogprobThreshold", -1.0);

                var condPrev = true;
                try { condPrev = !!getConfigValue("whisperxConditionOnPreviousText", true); } catch (eC) { condPrev = true; }

                wxArgs += " --beam_size " + String(beam);
                wxArgs += " --temperature " + String(temp);
                wxArgs += " --no_speech_threshold " + String(noSpeech);
                // Use = for negative values to avoid cmd parsing edge cases.
                wxArgs += " --logprob_threshold=" + String(logprob);
                wxArgs += " --condition_on_previous_text " + (condPrev ? "true" : "false");
            }

            if (wxExtra) {
                // Passed through to the runner (unknown args are ignored but reported).
                wxArgs += " " + wxExtra;
            }

            // Optional: use portable ffmpeg without touching system PATH.
            // If ffmpegExePath is set, we prepend its folder to PATH for this WhisperX run only.
            function _escapeCmdValue(v) {
                // Escape cmd metacharacters for safe use in `set VAR=...`.
                // We avoid quotes here because the whole body is wrapped into cmd.exe /c ""..."".
                var s = String(v || "");
                s = s.replace(/\^/g, "^^");
                s = s.replace(/&/g, "^&");
                s = s.replace(/\|/g, "^|");
                s = s.replace(/</g, "^<");
                s = s.replace(/>/g, "^>");
                return s;
            }

            var envPrefix = "";
            try {
                var ffRaw = String(getConfigValue("ffmpegExePath", "") || "");
                var ff = _resolvePathRelativeToConfig(ffRaw);
                if (ff) {
                    var ffFile = new File(ff);
                    if (ffFile.exists) {
                        var ffDir = _dirName(ff);
                        if (ffDir) {
                            envPrefix = "set \"PATH=" + _escapeCmdValue(_normalizePath(ffDir)) + ";%PATH%\" & ";
                        }
                    }
                }
            } catch (eFf) {}

            var whisperBaseDir = _getAutoTimingWhisperXDir();
            if (!whisperBaseDir) return respondErr("autoTimingWhisperXDir is empty");
            var whisperRunDir = _normalizePath(whisperBaseDir + "/" + runBase);
            _ensureFolder(whisperRunDir);

            // WhisperX runner script (stable API wrapper around WhisperX/faster-whisper).
            var runnerRaw = "";
            try { runnerRaw = String(getConfigValue("whisperxRunnerScriptPath", "") || ""); } catch (eR) { runnerRaw = ""; }
            if (!runnerRaw) runnerRaw = "host/tools/whisperx_runner/run_whisperx.py";
            var runnerPath = _resolvePathRelativeToRoot(runnerRaw);
            runnerPath = _normalizePath(runnerPath);
            if (!(new File(runnerPath)).exists) return respondErr("WhisperX runner not found: " + runnerPath);

            // Deterministic model cache root (offline-friendly)
            var cacheDir = "";
            try { cacheDir = String(getConfigValue("captionPanelsDataRoot", "") || ""); } catch (eCd) { cacheDir = ""; }
            if (cacheDir) cacheDir = _normalizePath(cacheDir + "/models");
            if (cacheDir) _ensureFolder(cacheDir);

            var whisperJsonExpected = _normalizePath(whisperRunDir + "/whisperx.json");
            var runnerMetaPath = _normalizePath(whisperRunDir + "/whisperx_runner_meta.json");

            var inputArg = "";
            var videoPathNorm = _normalizePath(videoPath);
            if (_hasNonAscii(videoPathNorm)) {
                var inputFile = _normalizePath(whisperRunDir + "/video_input_path.txt");
                if (!_writeTextFile(inputFile, videoPathNorm + "\n")) {
                    return respondErr("Cannot write WhisperX input path file: " + inputFile);
                }
                inputArg = ' --input_file "' + _toCmdWinPath(inputFile) + '"';
            } else {
                inputArg = ' --input "' + _toCmdWinPath(videoPathNorm) + '"';
            }

            var whisperBody = envPrefix + pyExe + ' "' + _toCmdWinPath(runnerPath) + '"' +
                inputArg +
                ' --output_dir "' + _toCmdWinPath(_normalizePath(whisperRunDir)) + '"' +
                ' --out_json "' + _toCmdWinPath(_normalizePath(whisperJsonExpected)) + '"' +
                ' --language ' + lang +
                ' --model ' + model +
                ' --device ' + device +
                ' --vad_method ' + vad;

            if (cacheDir) {
                whisperBody += ' --cache_dir "' + _toCmdWinPath(_normalizePath(cacheDir)) + '"';
            }

            if (wxApplyShift) {
                whisperBody += " --apply_time_shift";
            }

            whisperBody += wxArgs;

            var w = _runCmdBody(whisperBody, "whisperx_runner", logsDir, stamp);

            // Auto-fallback: if CUDA fails (driver/GPU not available), retry once on CPU.
            var deviceUsed = device;
            var wFallbackLog = "";
            if (
                w.exitCode !== 0 &&
                allowCpuFallback &&
                String(device || "").toLowerCase() === "cuda" &&
                (_isCudaUnavailableError(w.output) || _isHardCrashExitCode(w.exitCode))
            ) {
                deviceUsed = "cpu";

                var whisperBodyCpu = envPrefix + pyExe + ' "' + _toCmdWinPath(runnerPath) + '"' +
                    inputArg +
                    ' --output_dir "' + _toCmdWinPath(_normalizePath(whisperRunDir)) + '"' +
                    ' --out_json "' + _toCmdWinPath(_normalizePath(whisperJsonExpected)) + '"' +
                    ' --language ' + lang +
                    ' --model ' + model +
                    ' --device ' + deviceUsed +
                    ' --vad_method ' + vad;

                if (cacheDir) {
                    whisperBodyCpu += ' --cache_dir "' + _toCmdWinPath(_normalizePath(cacheDir)) + '"';
                }

                if (wxApplyShift) {
                    whisperBodyCpu += " --apply_time_shift";
                }

                whisperBodyCpu += wxArgs;

                var w2 = _runCmdBody(whisperBodyCpu, "whisperx_cpu_fallback", logsDir, stamp);
                wFallbackLog = w2.logPath;
                w = w2;
            }

            function _readTailSafe(filePath, maxChars) {
                try {
                    if (!filePath) return "";
                    var p = _normalizePath(String(filePath));
                    var f = new File(p);
                    if (!f.exists) return "";
                    var t = _readFileText(p);
                    var m = (typeof maxChars === "number" && maxChars > 0) ? maxChars : 2000;
                    if (t && t.length > m) return t.slice(t.length - m);
                    return String(t || "");
                } catch (eRt) {
                    return "";
                }
            }

            if (w.exitCode !== 0) {
                var msg = "WhisperX failed (exit=" + w.exitCode + ")";
                if (w.metaPath) msg += "\nmeta=" + w.metaPath;
                if (w.logPath) msg += "\nout=" + w.logPath;
                if (wxIgnored && wxIgnored.length) msg += "\nignoredArgs=" + wxIgnored.join(", ");

                var tail = _readTailSafe(w.logPath, 2400);
                if (tail) msg += "\n\n---- whisperx output (tail) ----\n" + tail;

                return respondErr(msg);
            }

            // Read runner meta (if present) to report which args were applied/ignored.
            try {
                if (runnerMetaPath && (new File(runnerMetaPath)).exists) {
                    var m = _readJsonFile(runnerMetaPath);
                    if (m && m.argsIgnored && (m.argsIgnored instanceof Array)) {
                        wxIgnored = m.argsIgnored;
                    }
                    try { wxTimeShiftAppliedSec = Number(m.timeShiftAppliedSec) || 0; } catch (eTs1) { wxTimeShiftAppliedSec = 0; }
                    try { wxTimeShiftSuggestedSec = Number(m.timeShiftSuggestedSec) || 0; } catch (eTs2) { wxTimeShiftSuggestedSec = 0; }
                    try { wxOnsetBiasSec = (m.onsetBiasSec && typeof m.onsetBiasSec === "object") ? m.onsetBiasSec : null; } catch (eTs3) { wxOnsetBiasSec = null; }
                }
            } catch (eMeta) {}

            var whisperJson = whisperJsonExpected;
            try {
                if (!(new File(whisperJson)).exists) {
                    whisperJson = _findNewestJsonFile(whisperRunDir);
                }
            } catch (eWj) {
                whisperJson = _findNewestJsonFile(whisperRunDir);
            }

            if (!whisperJson) {
                var msg2 = "WhisperX runner did not produce JSON in: " + whisperRunDir;
                if (w.logPath) msg2 += "\nlog=" + w.logPath;
                return respondErr(msg2);
            }

            // 4) Run alignment

            var alignBaseDir = _getAutoTimingAlignmentDir();
            if (!alignBaseDir) return respondErr("autoTimingAlignmentDir is empty");
            var alignRunDir = _normalizePath(alignBaseDir + "/" + runBase);
            _ensureFolder(alignRunDir);

            var scriptRaw = "";
            try { scriptRaw = String(getConfigValue("transcribeAlignScriptPath", "") || ""); } catch (eS) { scriptRaw = ""; }
            if (!scriptRaw) scriptRaw = "host/tools/transcribe_align/transcribe_align.py";
            var scriptPath = _resolvePathRelativeToRoot(scriptRaw);
            scriptPath = _normalizePath(scriptPath);
            if (!(new File(scriptPath)).exists) return respondErr("transcribe_align.py not found: " + scriptPath);

            var minGapFrames = 1;
            try {
                var mg = Number(getConfigValue("autoTimingMinGapFrames", 1));
                if (!isNaN(mg) && mg >= 0) minGapFrames = mg;
            } catch (eMg) { minGapFrames = 1; }

            var alignBody = pyExe + ' "' + _toCmdWinPath(scriptPath) + '"' +
                ' --blocks "' + _toCmdWinPath(_normalizePath(blocksPath)) + '"' +
                ' --whisperx-json "' + _toCmdWinPath(_normalizePath(whisperJson)) + '"' +
                ' --out-dir "' + _toCmdWinPath(_normalizePath(alignRunDir)) + '"' +
                ' --lang ' + lang +
                ' --min-gap-frames ' + String(minGapFrames);

            var a = _runCmdBody(alignBody, "align", logsDir, stamp);
            if (a.exitCode !== 0) {
                var msg3 = "Alignment failed (exit=" + a.exitCode + ")";
                if (a.logPath) msg3 += "\nlog=" + a.logPath;
                return respondErr(msg3);
            }

            var alignmentPath = _normalizePath(alignRunDir + "/alignment.json");
            if (!(new File(alignmentPath)).exists) {
                var msg4 = "alignment.json not found: " + alignmentPath;
                if (a.logPath) msg4 += "\nlog=" + a.logPath;
                return respondErr(msg4);
            }

            // 5) Apply timings
            var applyRaw = autoTimingApply(alignmentPath);
            var applyObj = null;
            try { applyObj = _parseJsonSafe(String(applyRaw || "")); } catch (eA) { applyObj = null; }
            if (!applyObj || !applyObj.ok) {
                var am = applyObj && applyObj.error ? String(applyObj.error) : String(applyRaw || "Apply failed");
                return respondErr("Apply timings failed. " + am);
            }

            return respondOk({
                runId: runBase,
                blocksPath: blocksPath,
                videoPath: videoPath,
                whisperxDeviceMode: deviceMode,
                whisperxDeviceRequested: device,
                whisperxDeviceUsed: deviceUsed,
                whisperxDir: whisperRunDir,
                whisperxJson: whisperJson,
                alignmentDir: alignRunDir,
                alignmentPath: alignmentPath,
                whisperxLog: w.logPath,
                whisperxFallbackLog: wFallbackLog,
                alignLog: a.logPath,
                whisperxArgs: wxArgs,
                whisperxArgsIgnored: wxIgnored,
                whisperxApplyTimeShift: wxApplyShift,
                whisperxTimeShiftAppliedSec: wxTimeShiftAppliedSec,
                whisperxTimeShiftSuggestedSec: wxTimeShiftSuggestedSec,
                whisperxOnsetBiasSec: wxOnsetBiasSec,
                apply: applyObj.result
            });
        } catch (e) {
            return respondErr(e.message);
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
            $.global.autoTimingRunWhisperXAndApply = autoTimingRunWhisperXAndApply;
        }
    } catch (eG) {}
})();
