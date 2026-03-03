// host/lib/runtime_paths.jsx
// =====================================================
// Central runtime path helpers (Windows-first).
//
// This module introduces a single source of truth for
// per-user runtime roots:
//   %USERPROFILE%/CaptionPanelsLocal
//     - CaptionPanelsData
//     - CaptionPanelTools
//
// NOTE:
// - This file is intentionally self-contained and does not
//   change existing behavior by itself.
// - Consumers are migrated in follow-up PRs.
// =====================================================

(function () {
    function cpNormalizePath(p) {
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

    function _getEnv(name) {
        try {
            var v = $.getenv(String(name || ""));
            return String(v || "");
        } catch (e) {
            return "";
        }
    }

    function cpExpandEnvVars(pathValue) {
        var s = String(pathValue || "");
        // Expand Windows-style vars: %USERPROFILE%, %APPDATA%, etc.
        s = s.replace(/%([^%]+)%/g, function (_, varName) {
            var v = _getEnv(varName);
            if (v) return v;
            return String(_) || "";
        });
        return cpNormalizePath(s);
    }

    function cpGetUserProfileDir() {
        var p = cpExpandEnvVars("%USERPROFILE%");
        if (p) return p;

        var hd = _getEnv("HOMEDRIVE");
        var hp = _getEnv("HOMEPATH");
        if (hd && hp) return cpNormalizePath(hd + hp);

        try {
            if (Folder && Folder.userData) {
                var ud = cpNormalizePath(Folder.userData.fsName);
                // Typical userData:
                // C:/Users/<user>/AppData/Roaming/Adobe/After Effects/<ver>
                // Derive C:/Users/<user> best-effort.
                var m = ud.match(/^([A-Za-z]:\/Users\/[^\/]+)\//i);
                if (m && m[1]) return cpNormalizePath(m[1]);
            }
        } catch (e) {}

        return "C:/Users/Public";
    }

    function cpGetRuntimeRootDefault() {
        return cpNormalizePath(cpGetUserProfileDir() + "/CaptionPanelsLocal");
    }

    function cpGetRuntimeDataRootDefault() {
        return cpNormalizePath(cpGetRuntimeRootDefault() + "/CaptionPanelsData");
    }

    function cpGetRuntimeToolsRootDefault() {
        return cpNormalizePath(cpGetRuntimeRootDefault() + "/CaptionPanelTools");
    }

    function cpResolvePathRelativeToConfig(pathValue) {
        var v = cpExpandEnvVars(pathValue);
        if (!v) return "";

        if ((/^[A-Za-z]:\//).test(v) || v.indexOf("//") === 0 || v.indexOf("/") === 0) {
            return cpNormalizePath(v);
        }

        try {
            if (typeof getConfigPath === "function") {
                var cfg = cpNormalizePath(getConfigPath());
                var idx = cfg.lastIndexOf("/");
                if (idx > 0) return cpNormalizePath(cfg.substring(0, idx) + "/" + v);
            }
        } catch (e) {}

        return cpNormalizePath(v);
    }

    function cpGetRuntimePaths() {
        return {
            userProfile: cpGetUserProfileDir(),
            runtimeRoot: cpGetRuntimeRootDefault(),
            dataRoot: cpGetRuntimeDataRootDefault(),
            toolsRoot: cpGetRuntimeToolsRootDefault()
        };
    }
})();
