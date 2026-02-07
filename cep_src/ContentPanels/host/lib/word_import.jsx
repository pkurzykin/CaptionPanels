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

    function _runWord2Json(exePath, docxPath, outJsonPath) {
        // Use cmd.exe so we can capture errors (2>&1).
        // Pattern: cmd.exe /c ""<exe>" "<docx>" --out "<json>" 2>&1"
        var cmd = 'cmd.exe /c ""' + exePath + '" "' + docxPath + '" --out "' + outJsonPath + '" 2>&1"';
        try {
            return system.callSystem(cmd);
        } catch (e) {
            return "callSystem error: " + e.message;
        }
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

            var outJsonPath = outDir + "/" + baseName + "_" + _timestamp() + ".json";

            // Normalize to forward slashes for cmd quoting stability.
            var exeCmd = _normalizePath(exePath);
            var docCmd = _normalizePath(docxPath);
            var outCmd = _normalizePath(outJsonPath);

            var output = _runWord2Json(exeCmd, docCmd, outCmd);

            var outFile = new File(outJsonPath);
            if (!outFile.exists) {
                // Include converter output to help debugging and IБ approval.
                return respondErr("word2json failed. Output:\n" + String(output || ""));
            }

            // Reuse existing JSON import pipeline.
            return importJsonFromFile(outJsonPath);

        } catch (e) {
            return respondErr(e.message);
        }
    };
})();
