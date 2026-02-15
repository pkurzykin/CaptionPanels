// host/lib/config.jsx
// =====================================================
// Config loader (shared settings)
// =====================================================

(function () {
    var _configCache = null;
    var _configPathCache = "";

    function _resolveRootPath() {
        if (typeof rootPath !== "undefined" && rootPath) return rootPath;
        try {
            var f = new File($.fileName);
            if (f && f.parent && f.parent.parent && f.parent.parent.parent) {
                return f.parent.parent.parent.fsName; // .../host/lib -> .../host -> .../<root>
            }
        } catch (e) {}
        return "";
    }

    function _normalizePath(p) {
        var s = String(p || "").replace(/\\/g, "/");
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

    function _configCandidates() {
        var list = [];
        try {
            if (Folder.appData) {
                var ad = Folder.appData;
                if (ad) list.push(_normalizePath(ad.fsName) + "/CaptionPanels/config.json");
            }
        } catch (e) {}

        try {
            var ud = Folder.userData;
            if (ud) list.push(_normalizePath(ud.fsName) + "/CaptionPanels/config.json");
        } catch (e) {}

        var base = _normalizePath(_resolveRootPath());
        if (!base) return list;

        list.push(base + "/config.json");

        // If base points to /client or /host, try parent.
        var trimmed = base.replace(/\/(client|host)$/, "");
        if (trimmed !== base) list.unshift(trimmed + "/config.json");

        // If config is one level above, try parent too.
        var parent = _dirName(base);
        if (parent) list.push(parent + "/config.json");

        return list;
    }

    function _configPath() {
        if (_configPathCache) return _configPathCache;
        var list = _configCandidates();
        for (var i = 0; i < list.length; i++) {
            var f = new File(list[i]);
            if (f.exists) {
                _configPathCache = list[i];
                return _configPathCache;
            }
        }
        _configPathCache = list.length ? list[0] : "";
        return _configPathCache;
    }

    function _tryReadConfig(p, encoding) {
        var f = new File(p);
        if (!f.exists) return null;
        try {
            f.encoding = encoding;
            if (!f.open("r")) return null;
            var txt = f.read();
            f.close();
            if (txt && txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
            return _parseJsonSafe(txt) || {};
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            return null;
        }
    }

    function _parseJsonSafe(text) {
        var s = String(text || "");
        if (s && s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
        if (typeof JSON !== "undefined" && JSON.parse) {
            try { return JSON.parse(s); } catch (e) {}
        }
        try { return eval("(" + s + ")"); } catch (e2) {}
        return null;
    }

    function _readConfigFile() {
        // Merge defaults (shipped config.json under extension root) with the active config path.
        // This makes new config keys available even if the user already has an older AppData config.

        var primaryPath = _configPath();
        var primary = null;
        if (primaryPath) {
            primary = _tryReadConfig(primaryPath, "UTF-8");
            if (!primary) primary = _tryReadConfig(primaryPath, "UTF-16");
        }
        if (!primary) primary = {};

        var shipped = {};
        try {
            var base = _normalizePath(_resolveRootPath());
            if (base) {
                var shippedPath = base + "/config.json";
                if (shippedPath && shippedPath !== primaryPath) {
                    var s1 = _tryReadConfig(shippedPath, "UTF-8");
                    if (!s1) s1 = _tryReadConfig(shippedPath, "UTF-16");
                    if (s1) shipped = s1;
                }
            }
        } catch (e) {
            shipped = {};
        }

        function merge(dst, src) {
            for (var k in src) {
                var own = true;
                try { own = src.hasOwnProperty(k); } catch (e2) { own = true; }
                if (!own) continue;
                dst[k] = src[k];
            }
            return dst;
        }

        var merged = {};
        merge(merged, shipped);
        merge(merged, primary);
        return merged;
    }

    getConfig = function () {
        if (!_configCache) _configCache = _readConfigFile();
        return _configCache;
    };

    reloadConfig = function () {
        _configCache = _readConfigFile();
        return _configCache;
    };

    getConfigPath = function () {
        return _configPath();
    };

    getConfigValue = function (key, def) {
        var cfg = getConfig();
        if (cfg && cfg.hasOwnProperty(key)) return cfg[key];
        return def;
    };

    getSpeakersDbPath = function () {
        reloadConfig();
        var v = getConfigValue("speakersDbPath", "");
        var p = _normalizePath(v);
        if (p && !_isAbsolutePath(p)) {
            var base = _dirName(_configPath());
            if (base) p = base + "/" + p;
        }
        if (p) return p;

        var root = _normalizePath(_resolveRootPath());
        if (root) {
            var local = root + "/speakers.json";
            if (new File(local).exists) return local;
        }

        return "H:/Media/Kurzykin/PROJECT/Titles_Template_NEW2025/work/json/speakers.json";
    };

    getConfigDebugString = function () {
        try {
            var cfg = reloadConfig();
            var path = _configPath();
            var exists = path ? (new File(path)).exists : false;
            var root = _resolveRootPath();
            var rawVal = (cfg && cfg.hasOwnProperty("speakersDbPath")) ? cfg["speakersDbPath"] : "";
            var resolved = getSpeakersDbPath();
            return "configPath=" + path +
                " | exists=" + exists +
                " | root=" + root +
                " | speakersDbPath(raw)=" + rawVal +
                " | speakersDbPath(resolved)=" + resolved;
        } catch (e) {
            return "configDebug error: " + e.message;
        }
    };



    function _stringifyPretty(obj) {
        try {
            if (typeof JSON !== "undefined" && JSON.stringify) {
                return JSON.stringify(obj, null, 2);
            }
        } catch (e) {}
        try { return obj.toSource(); } catch (e2) {}
        return String(obj);
    }

    function _ensureFolderForFile(fileObj) {
        try {
            var folder = fileObj.parent;
            if (folder && !folder.exists) folder.create();
        } catch (e) {}
    }

    function _preferredWriteConfigPath() {
        // Always prefer the user-writable config location (AppData) for writes.
        // This avoids trying to write into Program Files when the plugin ships with a default config.json.
        var list = _configCandidates();
        return (list && list.length) ? list[0] : _configPath();
    }

    function _writeConfigFileAt(p, cfg) {
        if (!p) return false;
        var f = new File(p);
        try {
            _ensureFolderForFile(f);
            f.encoding = "UTF-8";
            if (!f.open("w")) return false;
            f.write(_stringifyPretty(cfg || {}));
            f.close();
            return true;
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            return false;
        }
    }

    function _writeConfigFile(cfg) {
        var p = _configPath();
        return _writeConfigFileAt(p, cfg);
    }

    // UI helpers
    getConfigForUI = function () {
        try {
            var cfg = reloadConfig();

            var v = getConfigValue("subtitleCharsPerLine", 60);
            var n = Number(v);
            if (isNaN(n) || n < 20 || n > 200) n = 60;

            var swMax = Number(getConfigValue("subtitleShortWordMaxLen", 3));
            if (isNaN(swMax) || swMax < 1 || swMax > 10) swMax = 3;
            swMax = Math.round(swMax);

            var rawSp = (cfg && cfg.hasOwnProperty("speakersDbPath")) ? String(cfg["speakersDbPath"] || "") : "";
            var resolvedSp = "";
            try { resolvedSp = String(getSpeakersDbPath() || ""); } catch (eSp) {}

            var rawTopics = getConfigValue("topicOptions", []);
            var topics = [];
            var seen = {};

            function addTopic(s) {
                var t = String(s || "").replace(/^\s+|\s+$/g, "");
                if (!t) return;
                if (seen[t]) return;
                seen[t] = true;
                topics.push(t);
            }

            if (rawTopics instanceof Array) {
                for (var i = 0; i < rawTopics.length; i++) addTopic(rawTopics[i]);
            } else if (typeof rawTopics === "string") {
                var lines = String(rawTopics).split(/\r\n|\r|\n/);
                for (var j = 0; j < lines.length; j++) addTopic(lines[j]);
            }

            var wxModel = String(getConfigValue("whisperxModel", "medium") || "medium");
            var wxLang = String(getConfigValue("whisperxLanguage", "ru") || "ru");
            var wxDevice = String(getConfigValue("whisperxDevice", "cuda") || "cuda");
            var wxDeviceMode = String(getConfigValue("whisperxDeviceMode", "") || "").toLowerCase();
            var wxVad = String(getConfigValue("whisperxVadMethod", "silero") || "silero");
            if (wxDeviceMode !== "auto" && wxDeviceMode !== "cuda" && wxDeviceMode !== "cpu") {
                wxDeviceMode = (String(wxDevice).toLowerCase() === "cpu") ? "cpu" : "auto";
            }

            var wxAdvEnabled = false;
            try { wxAdvEnabled = !!getConfigValue("whisperxAdvancedArgsEnabled", false); } catch (eWx) { wxAdvEnabled = false; }

            function num(key, def) {
                var v = getConfigValue(key, def);
                var n = Number(v);
                return isNaN(n) ? def : n;
            }

            var wxBeam = num("whisperxBeamSize", 5);
            var wxTemp = num("whisperxTemperature", 0.0);
            var wxNoSpeech = num("whisperxNoSpeechThreshold", 0.6);
            var wxLogprob = num("whisperxLogprobThreshold", -1.0);

            var wxCondPrev = true;
            try { wxCondPrev = !!getConfigValue("whisperxConditionOnPreviousText", true); } catch (eC) { wxCondPrev = true; }

            var wxExtraArgs = "";
            try { wxExtraArgs = String(getConfigValue("whisperxExtraArgs", "") || ""); } catch (eX) { wxExtraArgs = ""; }

            return respondOk({
                configPath: getConfigPath(),
                subtitleCharsPerLine: n,
                subtitleShortWordMaxLen: swMax,
                speakersDbPath: rawSp,
                speakersDbPathResolved: resolvedSp,
                topicOptions: topics,

                whisperxModel: wxModel,
                whisperxLanguage: wxLang,
                whisperxDeviceMode: wxDeviceMode,
                whisperxDevice: wxDevice,
                whisperxVadMethod: wxVad,

                whisperxAdvancedArgsEnabled: wxAdvEnabled,
                whisperxBeamSize: wxBeam,
                whisperxTemperature: wxTemp,
                whisperxNoSpeechThreshold: wxNoSpeech,
                whisperxLogprobThreshold: wxLogprob,
                whisperxConditionOnPreviousText: wxCondPrev,
                whisperxExtraArgs: wxExtraArgs
            });
        } catch (e) {
            return respondErr(e.message);
        }
    };

    setConfigValue = function (key, value) {
        try {
            var k = String(key || "");
            if (!k) return respondErr("Empty key");

            var cfg = reloadConfig() || {};
            cfg[k] = value;

            var writePath = _preferredWriteConfigPath();
            if (!_writeConfigFileAt(writePath, cfg)) {
                return respondErr("Cannot write config: " + writePath);
            }

            // Clear caches so reads switch to the user config (AppData) once it exists.
            _configPathCache = "";
            _configCache = null;

            // keep cache in sync
            _configCache = reloadConfig();

            return respondOk({
                configPath: getConfigPath(),
                key: k,
                value: value
            });
        } catch (e) {
            return respondErr(e.message);
        }
    };

    pickSpeakersDbPath = function () {
        try {
            var file = File.openDialog("Выберите speakers.json", "*.json");
            if (!file) return respondErr("CANCELLED");
            // Return a plain string so CEP doesn't end up with "[object Object]" in UI fields.
            return respondOk(_normalizePath(file.fsName));
        } catch (e) {
            return respondErr(e.message);
        }
    };

    getLogsRoot = function () {
        var v = getConfigValue("logsRoot", "");
        if (v) return v;
        try {
            var base = Folder.userData;
            if (!base) return "";
            return base.fsName + "/CaptionPanels";
        } catch (e) {
            return "";
        }
    };
})();
