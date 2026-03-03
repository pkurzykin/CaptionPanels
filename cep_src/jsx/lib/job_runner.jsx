// host/lib/job_runner.jsx
// =====================================================
// JOB RUNNER: public API for AEX/CEP bridge
// Exposed globals:
//   validateEnvironment()
//   runJob(jobPath)
// =====================================================

(function () {
    function _pad2(n) {
        return (n < 10) ? ("0" + n) : String(n);
    }

    function _stamp(d) {
        var dt = d || new Date();
        return [
            dt.getFullYear(),
            _pad2(dt.getMonth() + 1),
            _pad2(dt.getDate())
        ].join("") + "_" + [
            _pad2(dt.getHours()),
            _pad2(dt.getMinutes()),
            _pad2(dt.getSeconds())
        ].join("");
    }

    function _normalizePath(p) {
        var s = String(p || "");
        if (s.indexOf("file://") === 0) s = s.slice("file://".length);
        s = s.replace(/\\/g, "/");
        if (s.length > 2 && s.charAt(0) === "/" && s.charAt(2) === ":") {
            s = s.slice(1);
        }
        return s;
    }

    function _ensureFolder(path) {
        var f = new Folder(path);
        if (!f.exists) {
            try { f.create(); } catch (e) {}
        }
        return f.exists;
    }

    function _readFile(path) {
        var p = _normalizePath(path);
        var f = (p instanceof File) ? p : new File(p);
        if (!f.exists) throw new Error("Job file not found: " + p);
        f.open("r");
        var txt = f.read();
        f.close();
        return txt;
    }

    function _writeFile(path, content) {
        var p = _normalizePath(path);
        var f = (p instanceof File) ? p : new File(p);
        f.open("w");
        f.write(content);
        f.close();
    }

    function _getWritableRoot() {
        try {
            if (typeof getLogsRoot === "function") {
                var custom = getLogsRoot();
                if (custom) {
                    var customDir = new Folder(_normalizePath(custom));
                    if (!customDir.exists) {
                        try { customDir.create(); } catch (e) {}
                    }
                    return customDir.exists ? customDir.fsName : "";
                }
            }
        } catch (e) {}
        try {
            var base = Folder.userData;
            if (!base) return "";
            var dir = new Folder(base.fsName + "/CaptionPanels");
            if (!dir.exists) {
                try { dir.create(); } catch (e) {}
            }
            return dir.exists ? dir.fsName : "";
        } catch (e) {
            return "";
        }
    }

    function _jobLogPath(jobPath) {
        var p = _normalizePath(jobPath);
        if (p) {
            var lower = p.toLowerCase();
            if (lower.lastIndexOf(".json") === lower.length - 5) {
                p = p.substring(0, p.length - 5) + ".log";
            } else if (lower.lastIndexOf(".log") !== lower.length - 4) {
                p += ".log";
            }
            return p;
        }

        var base = _getWritableRoot();
        if (base) {
            return base + "/logs/job_" + _stamp(new Date()) + ".log";
        }
        return "job_" + _stamp(new Date()) + ".log";
    }

    function _jobJsonPath(jobPath) {
        var p = _normalizePath(jobPath);
        if (p) {
            var lower = p.toLowerCase();
            if (lower.lastIndexOf(".json") !== lower.length - 5) {
                p += ".json";
            }
            return p;
        }

        var base = _getWritableRoot();
        if (base) {
            return base + "/logs/job_" + _stamp(new Date()) + ".json";
        }
        return "job_" + _stamp(new Date()) + ".json";
    }

    function _writeLog(jobPath, lines) {
        var logPath = _jobLogPath(jobPath);
        var slash = logPath.lastIndexOf("/");
        var dir = (slash >= 0) ? logPath.substring(0, slash) : "";
        if (dir) _ensureFolder(dir);
        _writeFile(logPath, lines.join("\n"));
        return logPath;
    }

    function _parseJson(text) {
        var t = String(text || "");
        if (t && t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
        return JSON.parse(t);
    }

    validateEnvironment = function () {
        try {
            if (!app || !app.project) return respondErr("No active project");
            return respondOk("OK");
        } catch (e) {
            return respondErr(e.message);
        }
    };

    runJob = function (jobPath) {
        var log = [];
        function _log(msg) {
            log.push("[" + _stamp(new Date()) + "] " + msg);
        }

        _log("runJob start");
        try {
            if (!jobPath) throw new Error("jobPath is required");

            var text = _readFile(jobPath);
            _log("job read");

            var job = _parseJson(text);
            if (!job || job.schemaVersion !== 1) throw new Error("Unsupported schemaVersion");
            if (!job.type) throw new Error("Missing job.type");

            var payload = job.payload || {};

            if (job.type === "generateSubs") {
                if (typeof generateSubs !== "function") throw new Error("generateSubs not available");
                generateSubs(payload.text || "", !!payload.italic, !!payload.jumpPlayhead, payload.sourceSegId || "");
            } else if (job.type === "deepCleanProject") {
                if (typeof deepCleanProject !== "function") throw new Error("deepCleanProject not available");
                deepCleanProject();
            } else {
                throw new Error("Unknown job.type: " + job.type);
            }

            _log("job done: " + job.type);
            _writeLog(jobPath, log);
            try { if (typeof logMessage === "function") logMessage("job:" + job.type + " OK"); } catch (e0) {}
            return respondOk("OK");
        } catch (e) {
            _log("error: " + e.message);
            try { _writeLog(jobPath, log); } catch (e2) {}
            try { if (typeof logError === "function") logError("job_runner", e.message); } catch (e3) {}
            return respondErr(e.message);
        }
    };

    runJobFromJson = function (jobJsonText, jobPath) {
        try {
            if (!jobJsonText) return respondErr("jobJsonText is required");
            var p = _jobJsonPath(jobPath);
            var slash = p.lastIndexOf("/");
            var dir = (slash >= 0) ? p.substring(0, slash) : "";
            if (dir) _ensureFolder(dir);
            _writeFile(p, jobJsonText);
            return runJob(p);
        } catch (e) {
            return respondErr(e.message);
        }
    };
})();
