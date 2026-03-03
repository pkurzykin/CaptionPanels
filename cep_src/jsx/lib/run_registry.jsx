// host/lib/run_registry.jsx
// =====================================================
// Run registry for long operations (job/runs model)
// Exposed globals:
//   cpRunCreate(kind, options)
//   cpRunUpdate(ref, patch)
//   cpRunFinalize(ref, status, payload)
//   cpRunGetLatest(kind)
//   cpRunFindLatest(kind, criteria)
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

    function _normalizeKind(kind) {
        var s = String(kind || "").toLowerCase();
        if (!s) s = "generic";
        s = s.replace(/[^a-z0-9_\-]+/g, "_");
        s = s.replace(/_+/g, "_");
        s = s.replace(/^_+|_+$/g, "");
        return s || "generic";
    }

    function _jsonStringify(obj) {
        try {
            if (typeof safeJsonStringify === "function") return safeJsonStringify(obj, 2);
        } catch (e0) {}
        try {
            if (typeof JSON !== "undefined" && JSON && JSON.stringify) {
                return JSON.stringify(obj, null, 2);
            }
        } catch (e1) {}
        try { return obj.toSource(); } catch (e2) {}
        return String(obj);
    }

    function _parseJsonSafe(text) {
        var s = String(text || "");
        if (s && s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
        try {
            if (typeof JSON !== "undefined" && JSON && JSON.parse) return JSON.parse(s);
        } catch (e0) {}
        try { return eval("(" + s + ")"); } catch (e1) {}
        return null;
    }

    function _readTextFile(path) {
        var f = null;
        try {
            f = new File(_normalizePath(path));
            if (!f.exists) return "";
            f.encoding = "UTF-8";
            if (!f.open("r")) return "";
            var t = f.read();
            f.close();
            return String(t || "");
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            return "";
        }
    }

    function _writeTextFile(path, text) {
        var f = null;
        try {
            f = new File(_normalizePath(path));
            var parent = f.parent;
            if (parent && !parent.exists) parent.create();
            f.encoding = "UTF-8";
            if (!f.open("w")) return false;
            f.write(String(text || ""));
            f.close();
            return true;
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            return false;
        }
    }

    function _ensureFolder(path) {
        try {
            var d = new Folder(_normalizePath(path));
            if (!d.exists) d.create();
            return d.exists;
        } catch (e) {
            return false;
        }
    }

    function _timestamp() {
        var d = new Date();
        function p2(n) { n = Number(n) || 0; return (n < 10 ? "0" : "") + String(n); }
        return String(d.getFullYear()) + p2(d.getMonth() + 1) + p2(d.getDate()) + "_" + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
    }

    function _dataRoot() {
        var raw = "";
        try { raw = String(getConfigValue("paths.dataRoot", "") || ""); } catch (e0) { raw = ""; }
        var root = "";
        try {
            if (typeof cpResolvePathRelativeToConfig === "function") {
                root = cpResolvePathRelativeToConfig(raw);
            }
        } catch (e1) {}
        if (!root) root = _normalizePath(raw);
        if (!root) {
            try {
                if (typeof cpGetRuntimeDataRootDefault === "function") root = cpGetRuntimeDataRootDefault();
            } catch (e2) {}
        }
        return _normalizePath(root);
    }

    function _runsRoot(kind) {
        return _normalizePath(_dataRoot() + "/runs/" + _normalizeKind(kind));
    }

    function _clone(obj) {
        var out = {};
        if (!obj || typeof obj !== "object") return out;
        for (var k in obj) {
            var own = true;
            try { own = obj.hasOwnProperty(k); } catch (e0) { own = true; }
            if (!own) continue;
            out[k] = obj[k];
        }
        return out;
    }

    function _merge(dst, src) {
        if (!dst || typeof dst !== "object") dst = {};
        if (!src || typeof src !== "object") return dst;
        for (var k in src) {
            var own = true;
            try { own = src.hasOwnProperty(k); } catch (e0) { own = true; }
            if (!own) continue;
            dst[k] = src[k];
        }
        return dst;
    }

    function _manifestPath(ref) {
        if (!ref) return "";
        return _normalizePath(String(ref.manifestPath || ""));
    }

    function _readManifest(ref) {
        var p = _manifestPath(ref);
        if (!p) return null;
        var txt = _readTextFile(p);
        if (!txt) return null;
        var obj = _parseJsonSafe(txt);
        if (!obj || typeof obj !== "object") return null;
        return obj;
    }

    function _writeManifest(ref, obj) {
        var p = _manifestPath(ref);
        if (!p) return false;
        return _writeTextFile(p, _jsonStringify(obj));
    }

    cpRunCreate = function (kind, options) {
        try {
            var k = _normalizeKind(kind);
            var opt = (options && typeof options === "object") ? options : {};
            var runId = String(opt.runId || _timestamp());
            runId = runId.replace(/[^A-Za-z0-9_\-]+/g, "_");
            runId = runId.replace(/_+/g, "_");
            runId = runId.replace(/^_+|_+$/g, "");
            if (!runId) runId = _timestamp();

            var root = _runsRoot(k);
            var runDir = _normalizePath(root + "/" + runId);
            if (!_ensureFolder(root)) return null;
            if (!_ensureFolder(runDir)) return null;

            var manifestPath = _normalizePath(runDir + "/run.json");
            var now = _timestamp();
            var manifest = {
                schemaVersion: 1,
                kind: k,
                runId: runId,
                status: "running",
                stage: "init",
                createdAt: now,
                updatedAt: now,
                inputs: _clone(opt.inputs),
                outputs: _clone(opt.outputs),
                meta: _clone(opt.meta),
                result: {},
                error: "",
                paths: {
                    runDir: runDir,
                    manifestPath: manifestPath
                }
            };

            if (!_writeTextFile(manifestPath, _jsonStringify(manifest))) return null;
            return { kind: k, runId: runId, runDir: runDir, manifestPath: manifestPath };
        } catch (e) {
            return null;
        }
    };

    cpRunUpdate = function (ref, patch) {
        try {
            var m = _readManifest(ref);
            if (!m) return false;

            var p = (patch && typeof patch === "object") ? patch : {};
            if (typeof p.status !== "undefined") m.status = p.status;
            if (typeof p.stage !== "undefined") m.stage = p.stage;
            if (typeof p.error !== "undefined") m.error = String(p.error || "");
            if (p.inputs && typeof p.inputs === "object") m.inputs = _merge(_clone(m.inputs), p.inputs);
            if (p.outputs && typeof p.outputs === "object") m.outputs = _merge(_clone(m.outputs), p.outputs);
            if (p.meta && typeof p.meta === "object") m.meta = _merge(_clone(m.meta), p.meta);
            if (p.result && typeof p.result === "object") m.result = _merge(_clone(m.result), p.result);
            m.updatedAt = _timestamp();

            return _writeManifest(ref, m);
        } catch (e) {
            return false;
        }
    };

    cpRunFinalize = function (ref, status, payload) {
        try {
            var p = (payload && typeof payload === "object") ? payload : {};
            var patch = _clone(p);
            patch.status = String(status || "completed");
            patch.stage = patch.stage || "done";
            patch.meta = _merge(_clone(patch.meta), { finishedAt: _timestamp() });
            return cpRunUpdate(ref, patch);
        } catch (e) {
            return false;
        }
    };

    cpRunGetLatest = function (kind) {
        try {
            var root = new Folder(_runsRoot(kind));
            if (!root.exists) return null;
            var dirs = root.getFiles(function (f) { return f instanceof Folder; });
            if (!dirs || !dirs.length) return null;

            var best = null;
            var bestT = -1;
            for (var i = 0; i < dirs.length; i++) {
                var d = dirs[i];
                if (!(d instanceof Folder)) continue;
                var mPath = _normalizePath(d.fsName + "/run.json");
                var mf = new File(mPath);
                if (!mf.exists) continue;
                var t = 0;
                try { t = mf.modified ? mf.modified.getTime() : 0; } catch (e0) { t = 0; }
                if (!best || t > bestT) {
                    best = mPath;
                    bestT = t;
                }
            }

            if (!best) return null;
            var obj = _parseJsonSafe(_readTextFile(best));
            if (!obj || typeof obj !== "object") return null;
            obj._path = best;
            return obj;
        } catch (e) {
            return null;
        }
    };

    cpRunFindLatest = function (kind, criteria) {
        try {
            var c = (criteria && typeof criteria === "object") ? criteria : {};
            var root = new Folder(_runsRoot(kind));
            if (!root.exists) return null;

            var dirs = root.getFiles(function (f) { return f instanceof Folder; });
            if (!dirs || !dirs.length) return null;

            var statusList = [];
            if (typeof c.status === "string" && c.status) {
                statusList.push(String(c.status));
            } else if (c.status instanceof Array) {
                for (var si = 0; si < c.status.length; si++) {
                    var sv = String(c.status[si] || "");
                    if (sv) statusList.push(sv);
                }
            }

            var requiredOutputs = [];
            if (c.hasOutputs instanceof Array) {
                for (var oi = 0; oi < c.hasOutputs.length; oi++) {
                    var ov = String(c.hasOutputs[oi] || "");
                    if (ov) requiredOutputs.push(ov);
                }
            }

            var best = null;
            var bestTime = -1;

            for (var i = 0; i < dirs.length; i++) {
                var d = dirs[i];
                if (!(d instanceof Folder)) continue;

                var manifestPath = _normalizePath(d.fsName + "/run.json");
                var mf = new File(manifestPath);
                if (!mf.exists) continue;

                var obj = _parseJsonSafe(_readTextFile(manifestPath));
                if (!obj || typeof obj !== "object") continue;

                if (statusList.length) {
                    var st = String(obj.status || "");
                    var statusOk = false;
                    for (var sj = 0; sj < statusList.length; sj++) {
                        if (st === statusList[sj]) {
                            statusOk = true;
                            break;
                        }
                    }
                    if (!statusOk) continue;
                }

                if (requiredOutputs.length) {
                    var outs = (obj.outputs && typeof obj.outputs === "object") ? obj.outputs : {};
                    var outOk = true;
                    for (var okIdx = 0; okIdx < requiredOutputs.length; okIdx++) {
                        var key = requiredOutputs[okIdx];
                        var v = String(outs[key] || "");
                        if (!v) {
                            outOk = false;
                            break;
                        }
                    }
                    if (!outOk) continue;
                }

                var t = 0;
                try { t = mf.modified ? mf.modified.getTime() : 0; } catch (eT) { t = 0; }
                if (!best || t > bestTime) {
                    obj._path = manifestPath;
                    best = obj;
                    bestTime = t;
                }
            }

            return best;
        } catch (e) {
            return null;
        }
    };
})();
