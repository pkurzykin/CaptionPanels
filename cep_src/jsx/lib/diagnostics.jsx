// host/lib/diagnostics.jsx
// =====================================================
// Diagnostics helpers for UI
// Exposed globals:
//   getDiagnosticsSnapshot()
//   getDeploymentChecks()
// =====================================================

(function () {
    function _normalizePath(p) {
        try {
            if (typeof cpNormalizePath === "function") return cpNormalizePath(p);
        } catch (e0) {}
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
        try {
            if (typeof cpResolvePathRelativeToConfig === "function") {
                return _normalizePath(cpResolvePathRelativeToConfig(pathValue));
            }
        } catch (e0) {}
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

    function _folderHasFiles(path) {
        try {
            var p = _normalizePath(path);
            if (!p) return false;
            var d = new Folder(p);
            if (!d.exists) return false;
            var list = d.getFiles();
            return !!(list && list.length);
        } catch (e) {
            return false;
        }
    }

    function _folderContainsName(path, token) {
        try {
            var p = _normalizePath(path);
            var t = String(token || "").toLowerCase();
            if (!p || !t) return false;
            var d = new Folder(p);
            if (!d.exists) return false;
            var list = d.getFiles();
            if (!list || !list.length) return false;
            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                var n = "";
                try { n = String(it.name || "").toLowerCase(); } catch (eN) { n = ""; }
                if (n && n.indexOf(t) !== -1) return true;
            }
            return false;
        } catch (e) {
            return false;
        }
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
            var outputs = (r.outputs && typeof r.outputs === "object") ? r.outputs : {};
            var result = (r.result && typeof r.result === "object") ? r.result : {};
            return {
                kind: String(r.kind || kind || ""),
                runId: String(r.runId || ""),
                status: String(r.status || ""),
                stage: String(r.stage || ""),
                createdAt: String(r.createdAt || ""),
                updatedAt: String(r.updatedAt || ""),
                path: _normalizePath(String(r._path || (r.paths && r.paths.manifestPath) || "")),
                outputs: {
                    blocksPath: _normalizePath(String(outputs.blocksPath || "")),
                    whisperxJson: _normalizePath(String(outputs.whisperxJson || "")),
                    alignmentPath: _normalizePath(String(outputs.alignmentPath || "")),
                    applyReportPath: _normalizePath(String(outputs.applyReportPath || ""))
                },
                result: {
                    total: Number(result.total || 0),
                    applied: Number(result.applied || 0),
                    missingCount: Number(result.missingCount || 0),
                    unmatchedCount: Number(result.unmatchedCount || 0),
                    invalidCount: Number(result.invalidCount || 0),
                    errorCount: Number(result.errorCount || 0)
                }
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
        var raw = String(_val("paths.dataRoot", "") || "");
        var root = _resolvePathRelativeToConfig(raw);
        if (!root) {
            try {
                if (typeof cpGetRuntimeDataRootDefault === "function") root = cpGetRuntimeDataRootDefault();
            } catch (e2) {}
        }
        return _normalizePath(root);
    }

    function _toolsRoot() {
        var raw = String(_val("paths.toolsRoot", "") || "");
        var root = _resolvePathRelativeToConfig(raw);
        if (!root) {
            try {
                if (typeof cpGetRuntimeToolsRootDefault === "function") root = cpGetRuntimeToolsRootDefault();
            } catch (e2) {}
        }
        return _normalizePath(root);
    }

    function _wordOutDir() {
        var raw = String(_val("paths.word2jsonOutDir", "") || "");
        var d = _resolvePathRelativeToConfig(raw);
        if (!d) d = _dataRoot() + "/word2json";
        return _normalizePath(d);
    }

    function _autoTimingLogsDir() {
        var raw = String(_val("paths.autoTimingLogsDir", "") || "");
        var d = _resolvePathRelativeToConfig(raw);
        if (!d) d = _dataRoot() + "/auto_timing/logs";
        return _normalizePath(d);
    }

    function _wordLogsDir() {
        var raw = String(_val("paths.word2jsonLogsDir", "") || "");
        var d = _resolvePathRelativeToConfig(raw);
        if (!d) d = _autoTimingLogsDir();
        return _normalizePath(d);
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

        var root = _toolsRoot();
        add(root);

        try {
            var parent = _dirName(_dataRoot());
            if (parent) {
                add(parent + "/CaptionPanelTools");
            }
        } catch (e0) {}
        return out;
    }

    function _resolveToolPath(configPath, subPaths) {
        var candidates = [];
        var seen = {};

        function add(p) {
            var n = _normalizePath(p);
            if (!n) return;
            if (seen[n]) return;
            seen[n] = true;
            candidates.push(n);
        }

        add(_resolvePathRelativeToConfig(String(configPath || "")));
        var roots = _buildToolsRootCandidates();
        for (var i = 0; i < roots.length; i++) {
            for (var j = 0; j < subPaths.length; j++) add(roots[i] + "/" + String(subPaths[j] || ""));
        }
        for (var k = 0; k < candidates.length; k++) {
            var p = candidates[k];
            if (_fileExists(p)) return p;
        }
        return _normalizePath(String(candidates.length ? candidates[0] : ""));
    }

    function _buildDeploymentChecks() {
        var dataRoot = _dataRoot();
        var configuredToolsRoot = _toolsRoot();
        var toolsRoot = configuredToolsRoot;
        var toolRoots = _buildToolsRootCandidates();
        for (var tr = 0; tr < toolRoots.length; tr++) {
            if (_folderExists(toolRoots[tr])) {
                toolsRoot = _normalizePath(toolRoots[tr]);
                break;
            }
        }

        var wordExe = _resolveToolPath(String(_val("paths.word2jsonExePath", "") || ""), [
            "word2json/word2json.exe",
            "word2json/runtime/win-x64/self-contained/word2json.exe"
        ]);
        var wxPy = _resolveToolPath(String(_val("asr.whisperxPythonPath", "") || ""), [
            "whisperx/.venv/Scripts/python.exe",
            "whisperx/venv/Scripts/python.exe",
            "whisperx/python.exe"
        ]);
        var ffmpeg = _resolveToolPath(String(_val("paths.ffmpegExePath", "") || ""), [
            "ffmpeg/ffmpeg.exe",
            "ffmpeg/bin/ffmpeg.exe",
            "ffmpeg.exe"
        ]);

        var wxOfflineOnly = false;
        try { wxOfflineOnly = !!_val("whisperxOfflineOnly", false); } catch (eOff) { wxOfflineOnly = false; }
        var wxModel = "";
        try { wxModel = String(_val("whisperxModel", "medium") || "medium"); } catch (eModel) { wxModel = "medium"; }

        var modelsRoot = _normalizePath(dataRoot + "/models");
        var fwCacheRoot = _normalizePath(modelsRoot + "/faster-whisper");
        var hfHubRoot = _normalizePath(modelsRoot + "/huggingface/hub");

        var checks = [];
        function addCheck(name, ok, level, details) {
            checks.push({
                name: String(name || ""),
                ok: !!ok,
                level: String(level || (ok ? "ok" : "warn")),
                details: String(details || "")
            });
        }

        var hasWordExe = _fileExists(wordExe);
        var hasWxPy = _fileExists(wxPy);
        var hasFfmpeg = _fileExists(ffmpeg);
        var hasDataRoot = _folderExists(dataRoot);
        var hasConfiguredToolsRoot = _folderExists(configuredToolsRoot);
        var hasToolsRoot = _folderExists(toolsRoot);
        var legacyToolsRoot = "C:/CaptionPanelsLocal/CaptionPanelTools";
        var hasLegacyToolsRoot = _folderExists(legacyToolsRoot);
        var hasFwCacheDir = _folderExists(fwCacheRoot);
        var hasFwModel = hasFwCacheDir && _folderContainsName(fwCacheRoot, String(wxModel || "").toLowerCase());
        var hasHubCache = _folderExists(hfHubRoot) && _folderHasFiles(hfHubRoot);

        addCheck("word2json.exe", hasWordExe, hasWordExe ? "ok" : "fail", hasWordExe ? "" : ("word2json executable not found: " + wordExe));
        addCheck("whisperx python", hasWxPy, hasWxPy ? "ok" : "fail", hasWxPy ? "" : ("whisperx python.exe not found: " + wxPy));
        addCheck("ffmpeg.exe", hasFfmpeg, hasFfmpeg ? "ok" : "warn", hasFfmpeg ? "" : ("ffmpeg not found (audio load may fail): " + ffmpeg));
        addCheck("data root", hasDataRoot, hasDataRoot ? "ok" : "fail", hasDataRoot ? "" : "data root folder does not exist");
        if (hasConfiguredToolsRoot) {
            addCheck("tools root", true, "ok", "");
        } else if (hasToolsRoot) {
            addCheck("tools root", true, "warn", "configured tools root not found, using fallback: " + toolsRoot);
        } else if (hasLegacyToolsRoot) {
            addCheck("tools root", false, "fail", "tools root folder does not exist; legacy root found at " + legacyToolsRoot + ". Run scripts/dev/migrate-legacy-runtime-to-user-profile.ps1");
        } else {
            addCheck("tools root", false, "fail", "tools root folder does not exist. Copy dist/CaptionPanels/tools to %USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools or run scripts/dev/migrate-legacy-runtime-to-user-profile.ps1");
        }

        if (wxOfflineOnly) {
            addCheck("offline ASR model cache", hasFwModel, hasFwModel ? "ok" : "fail",
                hasFwModel ? "" : ("model cache for '" + wxModel + "' not found under " + fwCacheRoot));
            addCheck("offline align cache", hasHubCache, hasHubCache ? "ok" : "warn",
                hasHubCache ? "" : ("huggingface hub cache is empty: " + hfHubRoot));
        }

        var failCount = 0;
        var warnCount = 0;
        for (var i = 0; i < checks.length; i++) {
            var level = String(checks[i].level || "").toLowerCase();
            if (level === "fail") failCount++;
            else if (level === "warn") warnCount++;
        }

        return {
            dataRoot: dataRoot,
            toolsRoot: toolsRoot,
            configuredToolsRoot: configuredToolsRoot,
            modelsRoot: modelsRoot,
            fwCacheRoot: fwCacheRoot,
            hfHubRoot: hfHubRoot,
            wordExe: wordExe,
            wxPy: wxPy,
            ffmpeg: ffmpeg,
            wxOfflineOnly: wxOfflineOnly,
            wxModel: wxModel,
            checks: checks,
            failCount: failCount,
            warnCount: warnCount,
            hasFail: failCount > 0,
            hasWarn: warnCount > 0,
            exists: {
                dataRoot: _folderExists(dataRoot),
                toolsRoot: _folderExists(toolsRoot),
                word2jsonExePath: _fileExists(wordExe),
                whisperxPythonPath: _fileExists(wxPy),
                ffmpegExePath: _fileExists(ffmpeg)
            }
        };
    }

    getDeploymentChecks = function () {
        try {
            return respondOk(_buildDeploymentChecks());
        } catch (e) {
            return respondErr(e && e.message ? e.message : String(e));
        }
    };

    getDiagnosticsSnapshot = function () {
        try {
            var cfgPath = "";
            try { cfgPath = String(getConfigPath() || ""); } catch (eCp) { cfgPath = ""; }
            cfgPath = _normalizePath(cfgPath);

            var dep = _buildDeploymentChecks();
            var dataRoot = dep.dataRoot;
            var toolsRoot = dep.toolsRoot;
            var wordOut = _wordOutDir();
            var atLogs = _autoTimingLogsDir();
            var wordLogs = _wordLogsDir();

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
                toolsRootConfigured: dep.configuredToolsRoot || toolsRoot,
                word2jsonOutDir: wordOut,
                autoTimingLogsDir: atLogs,
                word2jsonLogsDir: wordLogs,
                paths: {
                    word2jsonExePath: dep.wordExe,
                    whisperxPythonPath: dep.wxPy,
                    ffmpegExePath: dep.ffmpeg,
                    modelsRoot: dep.modelsRoot,
                    fasterWhisperCacheRoot: dep.fwCacheRoot,
                    huggingfaceHubRoot: dep.hfHubRoot
                },
                asr: {
                    whisperxOfflineOnly: dep.wxOfflineOnly,
                    whisperxModel: dep.wxModel
                },
                exists: {
                    configPath: _fileExists(cfgPath),
                    dataRoot: _folderExists(dataRoot),
                    toolsRoot: _folderExists(toolsRoot),
                    toolsRootConfigured: _folderExists(dep.configuredToolsRoot || ""),
                    word2jsonOutDir: _folderExists(wordOut),
                    autoTimingLogsDir: _folderExists(atLogs),
                    word2jsonLogsDir: _folderExists(wordLogs),
                    word2jsonExePath: _fileExists(dep.wordExe),
                    whisperxPythonPath: _fileExists(dep.wxPy),
                    ffmpegExePath: _fileExists(dep.ffmpeg)
                },
                deploymentChecks: dep.checks,
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
