// host/lib/response.jsx
// =====================================================
// Standard JSON response helpers
// =====================================================

(function () {
    function _escapeString(s) {
        return String(s || "")
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t");
    }

    // JSON.stringify() is not guaranteed to exist in every ExtendScript engine.
    // We use a small fallback serializer that supports plain objects/arrays.
    function _safeJsonValue(val, depth, stack) {
        if (depth > 20) return "null";

        if (val === null) return "null";

        var t = typeof val;

        if (t === "string") return "\"" + _escapeString(val) + "\"";

        if (t === "number") {
            return isFinite(val) ? String(val) : "null";
        }

        if (t === "boolean") return val ? "true" : "false";

        if (t === "undefined") return "null";

        // Common ExtendScript types: serialize as string paths.
        try {
            if (val instanceof File) return "\"" + _escapeString(val.fsName) + "\"";
            if (val instanceof Folder) return "\"" + _escapeString(val.fsName) + "\"";
        } catch (e) {}

        if (t === "function") return "\"" + _escapeString(String(val)) + "\"";

        if (t === "object") {
            for (var i = 0; i < stack.length; i++) {
                if (stack[i] === val) return "\"[Circular]\"";
            }
            stack.push(val);

            var isArr = false;
            try { isArr = (val instanceof Array); } catch (e2) { isArr = false; }

            if (isArr) {
                var items = [];
                for (var j = 0; j < val.length; j++) {
                    items.push(_safeJsonValue(val[j], depth + 1, stack));
                }
                stack.pop();
                return "[" + items.join(",") + "]";
            }

            var parts = [];
            for (var k in val) {
                var own = true;
                try { own = val.hasOwnProperty(k); } catch (e3) { own = true; }
                if (!own) continue;
                parts.push("\"" + _escapeString(k) + "\":" + _safeJsonValue(val[k], depth + 1, stack));
            }
            stack.pop();
            return "{" + parts.join(",") + "}";
        }

        return "\"" + _escapeString(String(val)) + "\"";
    }

    function _stringify(obj) {
        try {
            if (typeof JSON !== "undefined" && JSON && typeof JSON.stringify === "function") {
                return JSON.stringify(obj);
            }
        } catch (e) {}

        try {
            return _safeJsonValue(obj, 0, []);
        } catch (e2) {
            var ok = obj && obj.ok ? "true" : "false";
            var result = _escapeString(obj && obj.result);
            var error = _escapeString(obj && obj.error);
            return "{\"ok\":" + ok + ",\"result\":\"" + result + "\",\"error\":\"" + error + "\"}";
        }
    }

    // Public helper for modules that need JSON output even if JSON.stringify() is missing.
    safeJsonStringify = function (value, space) {
        try {
            if (typeof JSON !== "undefined" && JSON && typeof JSON.stringify === "function") {
                return JSON.stringify(value, null, space);
            }
        } catch (e) {}
        return _safeJsonValue(value, 0, []);
    };

    respondOk = function (result) {
        return _stringify({ ok: true, result: (result === undefined ? "" : result), error: "" });
    };

    respondErr = function (error) {
        return _stringify({ ok: false, result: "", error: String(error || "Error") });
    };
})();
