// host/lib/config.jsx
// =====================================================
// Config loader (shared settings)
// =====================================================

(function () {
    var _configCache = null;

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

    function _configPath() {
        var base = _resolveRootPath();
        if (!base) return "";
        return base + "/config.json";
    }

    function _readConfigFile() {
        var p = _configPath();
        if (!p) return {};
        var f = new File(p);
        if (!f.exists) return {};
        try {
            f.encoding = "UTF-8";
            f.open("r");
            var txt = f.read();
            f.close();
            if (txt && txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
            return JSON.parse(txt) || {};
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            return {};
        }
    }

    getConfig = function () {
        if (!_configCache) _configCache = _readConfigFile();
        return _configCache;
    };

    getConfigValue = function (key, def) {
        var cfg = getConfig();
        if (cfg && cfg.hasOwnProperty(key)) return cfg[key];
        return def;
    };

    getSpeakersDbPath = function () {
        return getConfigValue("speakersDbPath",
            "H:/Media/Kurzykin/PROJECT/Titles_Template_NEW2025/work/json/speakers.json");
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
