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

    function _decodeURIComponentSafe(s) {
        var v = String(s || "");
        // File.name can be URI-encoded for non-ASCII (e.g. %D0%A5...), so try to decode it.
        try { return decodeURIComponent(v); } catch (e) { return v; }
    }

    function _runWord2Json(exePath, docxPath, outJsonPath) {
        // Use cmd.exe so we can capture stderr (2>&1) and always get an exit code marker.
        // Pattern: cmd.exe /c ""<exe>" "<docx>" --out "<json>" 2>&1 & echo __EXIT_CODE__:%errorlevel%__""
        var cmd = 'cmd.exe /c ""' + exePath + '" "' + docxPath + '" --out "' + outJsonPath + '" 2>&1 & echo __EXIT_CODE__:%errorlevel%__"';

        var output = "";
        try {
            output = system.callSystem(cmd);
        } catch (e) {
            var msg = "";
            try {
                msg = (e && (e.message || e.description)) ? (e.message || e.description) : String(e);
            } catch (e2) {
                msg = "Permission denied";
            }
            output = "callSystem error: " + msg + " (is Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network enabled?)";
        }

        return { cmd: cmd, output: output };
    }

    importWordFromDialog = function () {
        var file = File.openDialog("Выберите Word (.docx)", "*.docx");
        if (!file) return respondErr("CANCELLED");
        return importWordFromFile(file.fsName);
    };

    importWordFromFile = function (docxPath) {
        try {
            if (typeof importJsonFromFile !== "function") {
                return respondErr("importJsonFromFile is not available");
            }

            try { if (typeof reloadConfig === "function") reloadConfig(); } catch (e) {}

            var exeRaw = getConfigValue("word2jsonExePath", "");
            var exePath = _resolvePathRelativeToConfig(exeRaw);
            if (!exePath) {
                return respondErr("word2jsonExePath is not set in config.json");
            }

            var exeFile = new File(exePath);
            if (!exeFile.exists) {
                return respondErr("word2json.exe not found: " + exePath);
            }

            // Where to write JSON.
            var outDirRaw = getConfigValue("word2jsonOutDir", "");
            var outDir = _resolvePathRelativeToConfig(outDirRaw);
            if (!outDir) {
                // Prefer our unified data root if configured.
                try {
                    var dataRoot = String(getConfigValue("captionPanelsDataRoot", "") || "");
                    dataRoot = _normalizePath(dataRoot);
                    if (dataRoot) outDir = dataRoot + "/word2json";
                } catch (eRoot) {}
            }

            if (!outDir) {
                try {
                    outDir = Folder.temp.fsName + "/CaptionPanels/word2json";
                } catch (e) {
                    outDir = "C:/Temp/CaptionPanels/word2json";
                }
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
            var logPath = outDir + "/word2json_last.log";

            // Normalize to forward slashes for cmd quoting stability.
            var exeCmd = _normalizePath(exePath);
            var docCmd = _normalizePath(docxPath);
            var outCmd = _normalizePath(outJsonPath);

            var run = _runWord2Json(exeCmd, docCmd, outCmd);
            var output = run && run.output ? String(run.output) : "";

            // Save command/output to a log file for troubleshooting.
            try {
                var logText = "";
                logText += "time=" + _timestamp() + "\n";
                logText += "config=" + String(getConfigPath ? getConfigPath() : "") + "\n";
                logText += "exe=" + String(exePath || "") + "\n";
                logText += "docx=" + String(docxPath || "") + "\n";
                logText += "outDir=" + String(outDir || "") + "\n";
                logText += "outJson=" + String(outJsonPath || "") + "\n";
                logText += "\ncmd:\n" + String(run && run.cmd ? run.cmd : "") + "\n";
                logText += "\noutput:\n" + String(output || "") + "\n";
                _writeTextFile(logPath, logText);
            } catch (eLog) {}

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
