// host/lib/word_import.jsx
// =====================================================
// Word import workflow (DOCX -> JSON via external word2json.exe)
//
// IMPORTANT:
// - Windows-only
// - Runs an external converter (configured via config.json)
// - Writes JSON to a temp/output folder, then calls importJsonFromFile()
// =====================================================

(function () {
    function _normalizePath(p) {
        var s = String(p || "");
        s = s.replace(/^\s+|\s+$/g, "");
        // Config values are sometimes saved with quotes; strip one wrapping pair.
        if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
            (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
            s = s.substring(1, s.length - 1);
        }
        s = s.replace(/\\/g, "/");
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

    function _getCaptionPanelsDataRoot() {
        var raw = "";
        try { raw = String(getConfigValue("captionPanelsDataRoot", "") || ""); } catch (e) {}
        var root = _resolvePathRelativeToConfig(raw);
        if (!root) root = "C:/CaptionPanelsLocal/CaptionPanelsData";
        return _normalizePath(root);
    }

    function _getCaptionPanelsToolsRoot() {
        var raw = "";
        try { raw = String(getConfigValue("captionPanelsToolsRoot", "") || ""); } catch (e) {}
        var root = _resolvePathRelativeToConfig(raw);
        if (!root) root = "C:/CaptionPanelsLocal/CaptionPanelTools";
        return _normalizePath(root);
    }

    function _buildToolsRootCandidates() {
        var out = [];
        var seen = {};

        function add(p) {
            var n = _normalizePath(p);
            if (!n) return;
            if (seen[n]) return;
            seen[n] = true;
            out.push(n);
        }

        var root = _getCaptionPanelsToolsRoot();
        add(root);

        // Accept both folder spellings (CaptionPanelTools / CaptionPanelsTools).
        if (root) {
            if (/\/CaptionPanelsTools$/i.test(root)) {
                add(root.replace(/\/CaptionPanelsTools$/i, "/CaptionPanelTools"));
            } else if (/\/CaptionPanelTools$/i.test(root)) {
                add(root.replace(/\/CaptionPanelTools$/i, "/CaptionPanelsTools"));
            } else {
                add(root + "/CaptionPanelTools");
                add(root + "/CaptionPanelsTools");
            }
        }

        // If only data root is configured, derive tools root from parent folder.
        try {
            var dataRoot = _getCaptionPanelsDataRoot();
            var parent = _dirName(dataRoot);
            if (parent) {
                add(parent + "/CaptionPanelTools");
                add(parent + "/CaptionPanelsTools");
            }
        } catch (e1) {}

        // Hard defaults + legacy compatibility.
        add("C:/CaptionPanelsLocal/CaptionPanelTools");
        add("C:/CaptionPanelsLocal/CaptionPanelsTools");
        add("C:/AE/CaptionPanelTools");
        add("C:/AE/CaptionPanelsTools");

        return out;
    }

    function _resolveWord2JsonExePath() {
        var candidates = [];
        var checked = [];
        var seen = {};

        function addCandidate(p) {
            var n = _normalizePath(p);
            if (!n) return;
            if (seen[n]) return;
            seen[n] = true;
            candidates.push(n);
        }

        var exeRaw = "";
        try { exeRaw = String(getConfigValue("word2jsonExePath", "") || ""); } catch (e0) { exeRaw = ""; }
        addCandidate(_resolvePathRelativeToConfig(exeRaw));

        var toolRoots = _buildToolsRootCandidates();
        for (var i = 0; i < toolRoots.length; i++) {
            addCandidate(toolRoots[i] + "/word2json/word2json.exe");
        }

        for (var j = 0; j < candidates.length; j++) {
            var p = candidates[j];
            checked.push(p);
            var f = new File(p);
            if (f.exists) return { path: p, checked: checked };
        }

        return { path: "", checked: checked };
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

    function _writeTextFile(filePath, content) {
        var f = null;
        try {
            f = new File(filePath);
            f.encoding = "UTF-8";
            if (!f.open("w")) return false;
            f.write(String(content || ""));
            f.close();
            return true;
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            return false;
        }
    }

    function _appendTextFile(filePath, content) {
        var f = null;
        try {
            f = new File(filePath);
            f.encoding = "UTF-8";
            // Some ExtendScript builds don't support "a" reliably; fallback to read+write.
            if (f.exists) {
                if (!f.open("r")) return false;
                var prev = f.read();
                f.close();
                if (!f.open("w")) return false;
                f.write(String(prev || "") + String(content || ""));
                f.close();
                return true;
            }
            return _writeTextFile(filePath, content);
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            return false;
        }
    }

    function _parseJsonSafe(text) {
        var s = String(text || "");
        try {
            if (typeof JSON !== "undefined" && JSON.parse) {
                return JSON.parse(s);
            }
        } catch (e) {}
        try { return eval("(" + s + ")"); } catch (e2) {}
        return null;
    }

    function _readTextFile(filePath) {
        var f = null;
        try {
            f = new File(filePath);
            if (!f.exists) return "";
            f.encoding = "UTF-8";
            if (!f.open("r")) return "";
            var t = f.read();
            f.close();
            if (t && String(t).length) return String(t);
        } catch (e1) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
        }
        try {
            // Fallback to system code page.
            f = new File(filePath);
            if (!f.exists) return "";
            f.encoding = "";
            if (!f.open("r")) return "";
            var t2 = f.read();
            f.close();
            if (t2 && String(t2).length) return String(t2);
        } catch (e3) {
            try { if (f && f.opened) f.close(); } catch (e4) {}
        }
        try {
            // Fallback to UTF-16.
            f = new File(filePath);
            if (!f.exists) return "";
            f.encoding = "UTF-16";
            if (!f.open("r")) return "";
            var t3 = f.read();
            f.close();
            return String(t3 || "");
        } catch (e5) {
            try { if (f && f.opened) f.close(); } catch (e6) {}
            return "";
        }
    }

    function _parseExitCode(outputText) {
        var s = String(outputText || "");
        var m = s.match(/__EXIT_CODE__:(-?\d+)__/);
        if (m && m[1] !== undefined) {
            var n = Number(m[1]);
            if (!isNaN(n)) return n;
        }
        return -1;
    }

    function _escapeCmdArg(s) {
        return String(s || "").replace(/"/g, '""');
    }

    function _toCmdWinPath(p) {
        // cmd.exe on Windows is safer with backslashes for UNC/local paths.
        return String(p || "").replace(/\//g, "\\");
    }

    function _containsNonAscii(s) {
        return /[^\x00-\x7F]/.test(String(s || ""));
    }

    function _isVideoFilePath(pathValue) {
        var p = _normalizePath(pathValue).toLowerCase();
        return /\.(mp4|mov|mxf|avi|mkv|wmv|webm|m4v)$/i.test(p);
    }

    function _getLayerFilePath(layer) {
        try {
            if (!layer) return "";
            var src = layer.source;
            if (!src || !(src instanceof FootageItem)) return "";
            var f = null;
            try { f = src.file; } catch (e1) { f = null; }
            if (!f) {
                try { f = src.mainSource && src.mainSource.file ? src.mainSource.file : null; } catch (e2) { f = null; }
            }
            if (f && f.exists) return _normalizePath(f.fsName);
        } catch (e) {}
        return "";
    }

    function _findVideoLayerForWorkArea(comp) {
        if (!comp) return null;

        // 1) Prefer selected video footage layer.
        try {
            var selected = comp.selectedLayers;
            if (selected && selected.length) {
                for (var i = 0; i < selected.length; i++) {
                    var lp = _getLayerFilePath(selected[i]);
                    if (_isVideoFilePath(lp)) return selected[i];
                }
            }
        } catch (e1) {}

        // 2) Fallback: first video footage layer on timeline.
        try {
            for (var j = 1; j <= comp.numLayers; j++) {
                var l = comp.layer(j);
                var p = _getLayerFilePath(l);
                if (_isVideoFilePath(p)) return l;
            }
        } catch (e2) {}

        return null;
    }

    function _getWord2JsonLogsDir(outDirFallback) {
        // Prefer explicit Word logs path; fallback to shared auto_timing logs;
        // then to captionPanelsDataRoot/auto_timing/logs; last fallback is outDir.
        var raw = "";
        try { raw = String(getConfigValue("word2jsonLogsDir", "") || ""); } catch (e0) { raw = ""; }
        var dir = _resolvePathRelativeToConfig(raw);

        if (!dir) {
            try { raw = String(getConfigValue("autoTimingLogsDir", "") || ""); } catch (e1) { raw = ""; }
            dir = _resolvePathRelativeToConfig(raw);
        }

        if (!dir) {
            try {
                var dataRoot = String(getConfigValue("captionPanelsDataRoot", "") || "");
                dataRoot = _resolvePathRelativeToConfig(dataRoot);
                if (dataRoot) dir = _normalizePath(dataRoot + "/auto_timing/logs");
            } catch (e2) {}
        }

        if (!dir) dir = _normalizePath(outDirFallback || "");
        return _normalizePath(dir);
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

        try { return system.callSystem(c); } catch (e2) { return "callSystem error: " + String(e2 || "Unknown error"); }
    }

    function _decodeURIComponentSafe(s) {
        var v = String(s || "");
        // File.name can be URI-encoded for non-ASCII (e.g. %D0%A5...), so try to decode it.
        try { return decodeURIComponent(v); } catch (e) { return v; }
    }

    function _runWord2Json(exePath, docxPath, outJsonPath, processLogPath) {
        // Use cmd.exe so we can capture stderr (2>&1) and always get an exit code marker.
        // Run hidden via WScript.Shell so user does not see a console window.
        var procLog = _normalizePath(processLogPath || (_dirName(outJsonPath) + "/word2json_process.log"));
        var exe = _toCmdWinPath(exePath);
        var doc = _toCmdWinPath(docxPath);
        var out = _toCmdWinPath(outJsonPath);
        var log = _toCmdWinPath(procLog);
        var cmd = 'cmd.exe /V:ON /D /Q /S /C ""' + exe + '" "' + doc + '" --out "' + out + '" 1> "' + log + '" 2>&1 & echo __EXIT_CODE__:!errorlevel!__>>"' + log + '""';

        var runOut = _runHiddenCommand(cmd, _dirName(procLog));
        var output = _readTextFile(procLog);
        if (!output) output = String(runOut || "");
        var exitCode = _parseExitCode(output);
        if (exitCode === -1) exitCode = _parseExitCode(runOut);

        return { cmd: cmd, output: output, exitCode: exitCode, processLogPath: procLog };
    }

    pickWordFileForImport = function () {
        var file = File.openDialog("Выберите Word (.docx)", "*.docx");
        if (!file) return respondErr("CANCELLED");
        return respondOk({ path: _normalizePath(file.fsName) });
    };

    importWordFromDialog = function () {
        var file = File.openDialog("Выберите Word (.docx)", "*.docx");
        if (!file) return respondErr("CANCELLED");
        return importWordFromFile(file.fsName);
    };

    setWorkAreaEndToVideoLayer = function () {
        try {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return respondErr("No active comp");

            var layer = _findVideoLayerForWorkArea(comp);
            if (!layer) return respondErr("No video layer found");

            var end = Number(layer.outPoint);
            if (isNaN(end) || end <= 0) return respondErr("Invalid video layer timing");
            if (end > comp.duration) end = comp.duration;

            var frameDur = 1.0 / Math.max(1, Number(comp.frameRate) || 25);
            var start = Number(comp.workAreaStart);
            if (isNaN(start) || start < 0) start = 0;
            if (start >= end - frameDur) {
                start = Number(layer.inPoint);
                if (isNaN(start) || start < 0) start = 0;
                if (start >= end - frameDur) start = Math.max(0, end - frameDur);
                comp.workAreaStart = start;
            }

            var dur = end - start;
            if (dur < frameDur) dur = frameDur;
            comp.workAreaDuration = dur;

            return respondOk({
                layerName: String(layer.name || ""),
                workAreaStart: Number(comp.workAreaStart),
                workAreaEnd: Number(comp.workAreaStart + comp.workAreaDuration)
            });
        } catch (e) {
            return respondErr(e && e.message ? e.message : String(e));
        }
    };

    importWordFromFile = function (docxPath) {
        try {
            if (typeof importJsonFromFile !== "function") {
                return respondErr("importJsonFromFile is not available");
            }

            try { if (typeof reloadConfig === "function") reloadConfig(); } catch (e) {}

            var exeResolved = _resolveWord2JsonExePath();
            var exePath = String(exeResolved.path || "");
            if (!exePath) {
                var tried = "";
                try { tried = exeResolved.checked && exeResolved.checked.length ? ("\nChecked:\n- " + exeResolved.checked.join("\n- ")) : ""; } catch (eT) { tried = ""; }
                return respondErr("word2json.exe not found. Check word2jsonExePath/captionPanelsToolsRoot." + tried);
            }

            var exeFile = new File(exePath);
            if (!exeFile.exists) {
                return respondErr("word2json.exe not found: " + exePath);
            }

            // Where to write JSON.
            var outDirRaw = getConfigValue("word2jsonOutDir", "");
            var outDir = _resolvePathRelativeToConfig(outDirRaw);
            if (!outDir) {
                try {
                    var dataRoot = _getCaptionPanelsDataRoot();
                    if (dataRoot) outDir = dataRoot + "/word2json";
                } catch (eRoot) {}
            }

            if (!outDir) {
                outDir = "C:/CaptionPanelsLocal/CaptionPanelsData/word2json";
            }
            outDir = _normalizePath(outDir);
            _ensureFolder(outDir);

            var inFile = new File(docxPath);
            if (!inFile.exists) {
                return respondErr("DOCX not found: " + docxPath);
            }

            var baseName = String(inFile.name || "script");
            baseName = baseName.replace(/\.docx$/i, "");

            // File.name can be URI-encoded for non-ASCII (e.g. %D0%A5...).
            // Decode it for readability, but also ensure the output name is safe for Windows + cmd.exe.
            baseName = _decodeURIComponentSafe(baseName);

            // Create a safe file name for the generated JSON.
            // - remove reserved characters for Windows file names
            // - avoid '%' because cmd.exe expands %VAR% even inside quotes
            // - collapse whitespace to underscores (stable + readable)
            var safeBase = String(baseName || "");
            safeBase = safeBase.replace(/%/g, "_");
            safeBase = safeBase.replace(/[<>:"\/\\|?*\x00-\x1F]+/g, "_");
            safeBase = safeBase.replace(/\s+/g, "_");
            safeBase = safeBase.replace(/_+/g, "_");
            safeBase = safeBase.replace(/^_+|_+$/g, "");
            if (!safeBase) safeBase = "script";

            var outJsonPath = outDir + "/" + safeBase + "_" + _timestamp() + ".json";
            var logsDir = _getWord2JsonLogsDir(outDir);
            _ensureFolder(logsDir);

            var logPath = logsDir + "/word2json_last.log";
            var processLogPath = logsDir + "/word2json_process_last.log";
            var stagedInputPath = "";

            // Normalize to forward slashes for cmd quoting stability.
            var exeCmd = _normalizePath(exePath);
            var docCmd = _normalizePath(docxPath);
            var outCmd = _normalizePath(outJsonPath);

            // Stage source DOCX to a local ASCII-only path.
            // This avoids UNC/non-ASCII issues in hidden cmd execution.
            try {
                var stageDir = _normalizePath(outDir + "/_input_stage");
                _ensureFolder(stageDir);
                stagedInputPath = _normalizePath(stageDir + "/input_" + _timestamp() + ".docx");

                var dstDoc = new File(stagedInputPath);
                if (dstDoc.exists) {
                    try { dstDoc.remove(); } catch (eRm) {}
                }
                if (!inFile.copy(stagedInputPath)) {
                    stagedInputPath = "";
                }
            } catch (eStage) {
                stagedInputPath = "";
            }

            if (stagedInputPath) {
                docCmd = stagedInputPath;
            } else if (String(docCmd || "").indexOf("//") === 0 || _containsNonAscii(docCmd)) {
                return respondErr("Cannot stage DOCX to local temp path. Check access to: " + outDir);
            }

            var run = _runWord2Json(exeCmd, docCmd, outCmd, processLogPath);
            var output = run && run.output ? String(run.output) : "";

            // Save command/output to a log file for troubleshooting.
            try {
                var logText = "";
                logText += "time=" + _timestamp() + "\n";
                logText += "config=" + String(getConfigPath ? getConfigPath() : "") + "\n";
                logText += "exe=" + String(exePath || "") + "\n";
                logText += "docx=" + String(docxPath || "") + "\n";
                if (stagedInputPath) logText += "docxStaged=" + String(stagedInputPath || "") + "\n";
                logText += "outDir=" + String(outDir || "") + "\n";
                logText += "logsDir=" + String(logsDir || "") + "\n";
                logText += "outJson=" + String(outJsonPath || "") + "\n";
                if (run && run.processLogPath) logText += "processLog=" + String(run.processLogPath) + "\n";
                logText += "\ncmd:\n" + String(run && run.cmd ? run.cmd : "") + "\n";
                logText += "exitCode=" + String(run && typeof run.exitCode !== "undefined" ? run.exitCode : "") + "\n";
                logText += "\noutput:\n" + String(output || "") + "\n";
                _writeTextFile(logPath, logText);
            } catch (eLog) {}

            if (run && typeof run.exitCode !== "undefined" && Number(run.exitCode) !== 0) {
                var fail = "word2json failed (exit=" + String(run.exitCode) + ")";
                fail += "\nlog=" + logPath;
                if (run.processLogPath) fail += "\nprocessLog=" + run.processLogPath;
                fail += "\nOutput:\n" + String(output || "");
                return respondErr(fail);
            }

            var outFile = new File(outJsonPath);
            if (!outFile.exists) {
                // Include converter output + log path to help debugging.
                var msg = "word2json did not produce JSON.";
                msg += "\nlog=" + logPath;
                msg += "\nOutput:\n" + String(output || "");
                return respondErr(msg);
            }

            // Reuse existing JSON import pipeline.
            var res = "";
            try {
                res = importJsonFromFile(outJsonPath);
            } catch (eImp) {
                var impMsg = "";
                try {
                    impMsg = (eImp && (eImp.message || eImp.description)) ? (eImp.message || eImp.description) : String(eImp);
                } catch (eImp2) {
                    impMsg = "Unknown error";
                }
                if (!impMsg) impMsg = "Unknown error";

                try {
                    _appendTextFile(logPath, "\nimportJsonFromFile threw:\n" + impMsg + "\n");
                } catch (eLogImp) {}

                var msg = "importJsonFromFile threw.\n" + impMsg;
                msg += "\nlog=" + logPath;
                msg += "\nconfig=" + String(getConfigPath ? getConfigPath() : "");
                msg += "\noutJson=" + String(outJsonPath || "");
                msg += "\nexe=" + String(exePath || "");
                return respondErr(msg);
            }

            // Append import result to log (even on success).
            try {
                _appendTextFile(logPath, "\nimportJsonFromFile:\n" + String(res || "") + "\n");
            } catch (eLog2) {}

            // If JSON import fails, annotate error with paths to speed up debugging.
            try {
                var obj = _parseJsonSafe(res);
                if (obj && obj.ok === false) {
                    var errMsg = String(obj.error || "");
                    if (!errMsg) errMsg = "Unknown error";
                    errMsg += "\nconfig=" + String(getConfigPath ? getConfigPath() : "");
                    errMsg += "\noutJson=" + String(outJsonPath || "");
                    errMsg += "\nexe=" + String(exePath || "");
                    errMsg += "\nlog=" + String(logPath || "");
                    obj.error = errMsg;

                    if (typeof JSON !== "undefined" && JSON.stringify) {
                        return JSON.stringify(obj);
                    }
                    return respondErr(obj.error);
                }
            } catch (eAnn) {}

            return res;

        } catch (e) {
            var msg = "";
            try {
                msg = (e && (e.message || e.description)) ? (e.message || e.description) : String(e);
            } catch (e2) {
                msg = "Unknown error";
            }
            if (!msg) msg = "Unknown error";
            return respondErr(msg);
        }
    };
})();
