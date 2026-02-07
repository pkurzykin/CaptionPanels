// ui_settings.js
// Plugin settings modal (config.json)

function _settingsOpen() {
    var overlay = document.getElementById("settings-overlay");
    if (overlay) overlay.style.display = "block";
}

function _settingsClose() {
    var overlay = document.getElementById("settings-overlay");
    if (overlay) overlay.style.display = "none";
}

function _settingsParseInt(val, def) {
    var s = String(val || "").replace(/[^0-9]/g, "");
    if (!s) return def;
    var n = parseInt(s, 10);
    if (isNaN(n)) return def;
    return n;
}

function _settingsParseLinesToList(txt) {
    var raw = String(txt || "");
    var lines = raw.split(/
||
/);
    var out = [];
    var seen = {};

    for (var i = 0; i < lines.length; i++) {
        var s = String(lines[i] || "").replace(/^\s+|\s+$/g, "");
        if (!s) continue;
        if (seen[s]) continue;
        seen[s] = true;
        out.push(s);
    }

    return out;
}

function _settingsLoad() {
    aeCall("getConfigForUI()", function (out) {
        if (!out || !out.ok) {
            uiAlert("Settings: failed to read config.json
" + (out ? (out.error || out.result) : "Unknown"));
            return;
        }

        var res = out.result || {};

        // 1) subtitleCharsPerLine
        var val = (typeof res.subtitleCharsPerLine !== "undefined") ? res.subtitleCharsPerLine : 60;
        var input = document.getElementById("settings-chars");
        if (input) input.value = String(val);

        // 2) speakersDbPath
        var sp = "";
        if (typeof res.speakersDbPath === "string" && res.speakersDbPath) {
            sp = res.speakersDbPath;
        } else if (typeof res.speakersDbPathResolved === "string" && res.speakersDbPathResolved) {
            sp = res.speakersDbPathResolved;
        }
        var spEl = document.getElementById("settings-speakers-path");
        if (spEl) spEl.value = String(sp || "");

        // 3) rubrics list
        var topics = (res.topicOptions && res.topicOptions.length) ? res.topicOptions : null;
        if (!topics && typeof getTopicOptions === "function") {
            topics = getTopicOptions();
        }
        if (!topics) topics = [];

        var topicsEl = document.getElementById("settings-topics");
        if (topicsEl) {
            topicsEl.value = topics.join("
");
        }
    });
}

function _settingsBrowseSpeakersDb() {
    aeCall("pickSpeakersDbPath()", function (out) {
        if (!out || !out.ok) {
            var err = out && out.error ? String(out.error) : "Unknown error";
            if (err === "CANCELLED") return;
            uiAlert("Settings: failed to pick speakers DB
" + err);
            return;
        }

        var res = out.result;
        var p = "";
        if (res && typeof res.path === "string") {
            p = res.path;
        } else if (typeof res === "string") {
            p = res;
        }

        if (!p) return;
        p = String(p).replace(/\/g, "/");

        var spEl = document.getElementById("settings-speakers-path");
        if (spEl) spEl.value = p;
    });
}

function _settingsSave() {
    var input = document.getElementById("settings-chars");
    var n = _settingsParseInt(input ? input.value : "", 60);

    // Guardrails.
    if (n < 20) n = 20;
    if (n > 200) n = 200;

    var spEl = document.getElementById("settings-speakers-path");
    var sp = spEl ? String(spEl.value || "") : "";
    sp = sp.replace(/\/g, "/").replace(/^\s+|\s+$/g, "");

    var topicsEl = document.getElementById("settings-topics");
    var topics = _settingsParseLinesToList(topicsEl ? topicsEl.value : "");

    var items = [
        { key: "subtitleCharsPerLine", value: Number(n) },
        { key: "speakersDbPath", value: String(sp || "") },
        { key: "topicOptions", value: topics }
    ];

    function saveNext(i) {
        if (i >= items.length) {
            // Apply UI changes immediately.
            if (typeof setTopicOptions === "function") {
                setTopicOptions(topics && topics.length ? topics : (typeof getTopicOptions === "function" ? getTopicOptions() : []));
            }
            uiAlert("Saved. New subtitle line limit: " + n + ".");
            _settingsClose();
            return;
        }

        var it = items[i];
        var cmd = "setConfigValue(" + JSON.stringify(String(it.key)) + "," + JSON.stringify(it.value) + ")";
        aeCall(cmd, function (out) {
            if (!out || !out.ok) {
                uiAlert("Settings: failed to save.
" + (out ? (out.error || out.result) : "Unknown"));
                return;
            }
            saveNext(i + 1);
        });
    }

    saveNext(0);
}

function initSettingsUI() {
    attachClick("btn-settings", function () {
        _settingsLoad();
        _settingsOpen();
    });

    attachClick("btn-settings-close", function () { _settingsClose(); });
    attachClick("btn-settings-cancel", function () { _settingsClose(); });
    attachClick("btn-settings-save", function () { _settingsSave(); });
    attachClick("btn-settings-browse-speakers", function () { _settingsBrowseSpeakersDb(); });

    var overlay = document.getElementById("settings-overlay");
    if (overlay) {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) _settingsClose();
        });
    }
}
