// host/lib/logger.jsx
// =====================================================
// Logging helpers (controlled by config.json)
// =====================================================

(function () {
    function _isEnabled() {
        try {
            if (typeof getConfigValue === "function") {
                var v = getConfigValue("enableLogs", false);
                return (v === true || v === "true" || v === 1 || v === "1");
            }
        } catch (e) {}
        return false;
    }

    function _stamp(d) {
        var dt = d || new Date();
        function _pad2(n) { return (n < 10) ? ("0" + n) : String(n); }
        return [
            dt.getFullYear(),
            _pad2(dt.getMonth() + 1),
            _pad2(dt.getDate())
        ].join("-") + " " + [
            _pad2(dt.getHours()),
            _pad2(dt.getMinutes()),
            _pad2(dt.getSeconds())
        ].join(":");
    }

    function _logFilePath() {
        try {
            if (typeof getLogsRoot !== "function") return "";
            var root = getLogsRoot();
            if (!root) return "";
            var dir = new Folder(root + "/logs");
            if (!dir.exists) {
                try { dir.create(); } catch (e) {}
            }
            if (!dir.exists) return "";
            var dt = new Date();
            function _pad2(n) { return (n < 10) ? ("0" + n) : String(n); }
            var name = "captionpanels_" + dt.getFullYear() + _pad2(dt.getMonth() + 1) + _pad2(dt.getDate()) + ".log";
            return dir.fsName + "/" + name;
        } catch (e) {
            return "";
        }
    }

    function _append(line) {
        var path = _logFilePath();
        if (!path) return false;
        var f = new File(path);
        try {
            f.encoding = "UTF-8";
            f.open("a");
            f.write(line + "\n");
            f.close();
            return true;
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            return false;
        }
    }

    logMessage = function (msg) {
        if (!_isEnabled()) return respondOk("OFF");
        if (!_append("[" + _stamp(new Date()) + "] " + String(msg || ""))) {
            return respondErr("Log write failed");
        }
        return respondOk("OK");
    };

    logError = function (context, msg) {
        if (!_isEnabled()) return respondOk("OFF");
        if (!_append("[" + _stamp(new Date()) + "] ERROR [" + String(context || "") + "] " + String(msg || ""))) {
            return respondErr("Log write failed");
        }
        return respondOk("OK");
    };

    logJson = function (label, jsonText) {
        if (!_isEnabled()) return respondOk("OFF");
        if (!_append("[" + _stamp(new Date()) + "] " + String(label || "JSON") + ": " + String(jsonText || ""))) {
            return respondErr("Log write failed");
        }
        return respondOk("OK");
    };
})();
