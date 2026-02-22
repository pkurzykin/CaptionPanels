// host/lib/diagnostics.jsx
// =====================================================
// Diagnostics helpers for UI
// Exposed globals:
//   getDiagnosticsSnapshot()
// =====================================================

(function () {
    function _normalizePath(p) {
        var s = String(p || "");
        s = s.replace(/^\s+|\s+$/g, "");
        if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
            (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
            s = s.substring(1, s.length - 1);
        }
        s = s.replace(/\\/g, "/");
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

    function _val(key, def) {
        try { return getConfigValue(key, def); } catch (e) { return def; }
    }

    function _fileExists(path) {
        try {
            var p = _normalizePath(path);
            if (!p) return false;
            return (new File(p)).exists;
        } catch (e) { return false; }
    }

    function _folderExists(path) {
        try {
            var p = _normalizePath(path);
            if (!p) return false;
            return (new Folder(p)).exists;
        } catch (e) { return false; }
    }

    function _runSummary(kind, criteria) {
        try {
            var r = null;
            if (criteria && typeof cpRunFindLatest === "function") {
                r = cpRunFindLatest(kind, criteria);
            }
            if (!r && typeof cpRunGetLatest === "function") {
                r = cpRunGetLatest(kind);
            }
            if (!r || typeof r !== "object") return null;
            return {
                kind: String(r.kind || kind || ""),
                runId: String(r.runId || ""),
                status: String(r.status || ""),
                stage: String(r.stage || ""),
                createdAt: String(r.createdAt || ""),
                updatedAt: String(r.updatedAt || ""),
                path: _normalizePath(String(r._path || (r.paths && r.paths.manifestPath) || ""))
            };
        } catch (e) {
            return null;
        }
    }

    function _newestFileByMask(dirPath, mask) {
        try {
            var d = new Folder(_normalizePath(dirPath));
            if (!d.exists) return "";
            var files = d.getFiles(mask);
            if (!files || !files.length) return "";

            var best = null;
            var bestT = -1;
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                if (!(f instanceof File)) continue;
                if (!f.exists) continue;
                var t = 0;
                try { t = f.modified ? f.modified.getTime() : 0; } catch (eT) { t = 0; }
                if (!best || t > bestT) {
                    best = f;
                    bestT = t;
                }
            }
            return best ? _normalizePath(best.fsName) : "";
        } catch (e) {
            return "";
        }
    }

    function _dataRoot() {
        var raw = String(_val("captionPanelsDataRoot", "") || "");
        var root = _resolvePathRelativeToConfig(raw);
        if (!root) root = "C:/CaptionPanelsLocal/CaptionPanelsData";
        return _normalizePath(root);
    }

    function _toolsRoot() {
        var raw = String(_val("captionPanelsToolsRoot", "") || "");
        var root = _resolvePathRelativeToConfig(raw);
        if (!root) root = "C:/CaptionPanelsLocal/CaptionPanelTools";
        return _normalizePath(root);
    }

    function _wordOutDir() {
        var raw = String(_val("word2jsonOutDir", "") || "");
        var d = _resolvePathRelativeToConfig(raw);
        if (!d) d = _dataRoot() + "/word2json";
        return _normalizePath(d);
    }

    function _autoTimingLogsDir() {
        var raw = String(_val("autoTimingLogsDir", "") || "");
        var d = _resolvePathRelativeToConfig(raw);
        if (!d) d = _dataRoot() + "/auto_timing/logs";
        return _normalizePath(d);
    }

    function _wordLogsDir() {
        var raw = String(_val("word2jsonLogsDir", "") || "");
        var d = _resolvePathRelativeToConfig(raw);
        if (!d) d = _autoTimingLogsDir();
        return _normalizePath(d);
    }

    getDiagnosticsSnapshot = function () {
        try {
            var cfgPath = "";
            try { cfgPath = String(getConfigPath() || ""); } catch (eCp) { cfgPath = ""; }
            cfgPath = _normalizePath(cfgPath);

            var dataRoot = _dataRoot();
            var toolsRoot = _toolsRoot();
            var wordOut = _wordOutDir();
            var atLogs = _autoTimingLogsDir();
            var wordLogs = _wordLogsDir();

            var wordExe = _normalizePath(_resolvePathRelativeToConfig(String(_val("word2jsonExePath", "") || "")));
            var wxPy = _normalizePath(_resolvePathRelativeToConfig(String(_val("whisperxPythonPath", "") || "")));
            var ffmpeg = _normalizePath(_resolvePathRelativeToConfig(String(_val("ffmpegExePath", "") || "")));

            var latest = {
                word2jsonLastLog: _normalizePath(wordLogs + "/word2json_last.log"),
                word2jsonProcessLastLog: _normalizePath(wordLogs + "/word2json_process_last.log"),
                whisperxMetaLog: _newestFileByMask(atLogs, "whisperx_runner_*.log"),
                whisperxOutLog: _newestFileByMask(atLogs, "whisperx_runner_*.out.txt"),
                alignOutLog: _newestFileByMask(atLogs, "align_*.out.txt")
            };

            return respondOk({
                configPath: cfgPath,
                dataRoot: dataRoot,
                toolsRoot: toolsRoot,
                word2jsonOutDir: wordOut,
                autoTimingLogsDir: atLogs,
                word2jsonLogsDir: wordLogs,
                paths: {
                    word2jsonExePath: wordExe,
                    whisperxPythonPath: wxPy,
                    ffmpegExePath: ffmpeg
                },
                exists: {
                    configPath: _fileExists(cfgPath),
                    dataRoot: _folderExists(dataRoot),
                    toolsRoot: _folderExists(toolsRoot),
                    word2jsonOutDir: _folderExists(wordOut),
                    autoTimingLogsDir: _folderExists(atLogs),
                    word2jsonLogsDir: _folderExists(wordLogs),
                    word2jsonExePath: _fileExists(wordExe),
                    whisperxPythonPath: _fileExists(wxPy),
                    ffmpegExePath: _fileExists(ffmpeg)
                },
                latestLogs: latest
                ,
                latestRuns: {
                    wordImport: _runSummary("word_import"),
                    autoTiming: _runSummary("auto_timing"),
                    autoTimingCompleted: _runSummary("auto_timing", {
                        status: ["completed"],
                        hasOutputs: ["blocksPath", "whisperxJson"]
                    })
                }
            });
        } catch (e) {
            return respondErr(e && e.message ? e.message : String(e));
        }
    };
})();
