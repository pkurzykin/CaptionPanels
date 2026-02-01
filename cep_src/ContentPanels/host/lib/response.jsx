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
            .replace(/\n/g, "\\n");
    }

    function _stringify(obj) {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            var ok = obj && obj.ok ? "true" : "false";
            var result = _escapeString(obj && obj.result);
            var error = _escapeString(obj && obj.error);
            return "{\"ok\":" + ok + ",\"result\":\"" + result + "\",\"error\":\"" + error + "\"}";
        }
    }

    respondOk = function (result) {
        return _stringify({ ok: true, result: (result === undefined ? "" : result), error: "" });
    };

    respondErr = function (error) {
        return _stringify({ ok: false, result: "", error: String(error || "Error") });
    };
})();
