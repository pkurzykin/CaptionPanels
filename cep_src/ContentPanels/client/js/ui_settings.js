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


function _settingsParseFloat(val, def) {
    var s = String(val || "").replace(/,/g, ".");
    s = s.replace(/^\s+|\s+$/g, "");
    if (!s) return def;
    var n = parseFloat(s);
    if (isNaN(n)) return def;
    return n;
}

function _settingsSetDisabled(ids, disabled) {
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) el.disabled = !!disabled;
    }
}

function _settingsParseLinesToList(txt) {
    var raw = String(txt || "");
    var lines = raw.split(/\r\n|\r|\n/);
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
            uiAlert("Settings: failed to read config.json\n" + (out ? (out.error || out.result) : "Unknown"));
            return;
        }

        var res = out.result || {};

        // 1) subtitleCharsPerLine
        var val = (typeof res.subtitleCharsPerLine !== "undefined") ? res.subtitleCharsPerLine : 60;
        var input = document.getElementById("settings-chars");
        if (input) input.value = String(val);


        // 1.1) subtitleShortWordMaxLen
        var swVal = (typeof res.subtitleShortWordMaxLen !== "undefined") ? res.subtitleShortWordMaxLen : 3;
        var swEl = document.getElementById("settings-short-word-len");
        if (swEl) swEl.value = String(swVal);

        // 1.2) autoTimingPadStartFrames
        var psVal = (typeof res.autoTimingPadStartFrames !== "undefined") ? res.autoTimingPadStartFrames : 6;
        var psEl = document.getElementById("settings-pad-start-frames");
        if (psEl) psEl.value = String(psVal);

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
            topicsEl.value = topics.join("\n");
        }

        // 4) WhisperX (ASR)
        var wxModel = (typeof res.whisperxModel === "string" && res.whisperxModel) ? res.whisperxModel : "medium";
        var wxLang = (typeof res.whisperxLanguage === "string" && res.whisperxLanguage) ? res.whisperxLanguage : "ru";

        var wxModelEl = document.getElementById("settings-whisperx-model");
        if (wxModelEl) wxModelEl.value = String(wxModel);

        var wxLangEl = document.getElementById("settings-whisperx-language");
        if (wxLangEl) wxLangEl.value = String(wxLang);

        var wxAdvEnabled = !!res.whisperxAdvancedArgsEnabled;
        var wxAdvEl = document.getElementById("settings-whisperx-adv-enabled");
        if (wxAdvEl) wxAdvEl.checked = wxAdvEnabled;

        var beamEl = document.getElementById("settings-whisperx-beam");
        if (beamEl) beamEl.value = String((typeof res.whisperxBeamSize !== "undefined") ? res.whisperxBeamSize : 5);

        var tempEl = document.getElementById("settings-whisperx-temp");
        if (tempEl) tempEl.value = String((typeof res.whisperxTemperature !== "undefined") ? res.whisperxTemperature : 0.0);

        var nsEl = document.getElementById("settings-whisperx-nospeech");
        if (nsEl) nsEl.value = String((typeof res.whisperxNoSpeechThreshold !== "undefined") ? res.whisperxNoSpeechThreshold : 0.6);

        var lpEl = document.getElementById("settings-whisperx-logprob");
        if (lpEl) lpEl.value = String((typeof res.whisperxLogprobThreshold !== "undefined") ? res.whisperxLogprobThreshold : -1.0);

        var cpEl = document.getElementById("settings-whisperx-condprev");
        if (cpEl) cpEl.checked = (typeof res.whisperxConditionOnPreviousText === "boolean") ? res.whisperxConditionOnPreviousText : true;

        var extraEl = document.getElementById("settings-whisperx-extra");
        if (extraEl) extraEl.value = String((typeof res.whisperxExtraArgs === "string") ? res.whisperxExtraArgs : "");

        _settingsSetDisabled([
            "settings-whisperx-beam",
            "settings-whisperx-temp",
            "settings-whisperx-nospeech",
            "settings-whisperx-logprob",
            "settings-whisperx-condprev",
            "settings-whisperx-extra"
        ], !wxAdvEnabled);
    });
}

function _settingsBrowseSpeakersDb() {
    aeCall("pickSpeakersDbPath()", function (out) {
        if (!out || !out.ok) {
            var err = out && out.error ? String(out.error) : "Unknown error";
            if (err == "CANCELLED") return;
            uiAlert("Settings: failed to pick speakers DB\n" + err);
            return;
        }

        var res = out.result;
        var p = "";

        // We prefer a plain string path.
        if (typeof res === "string") {
            p = res;
        } else if (res && typeof res === "object") {
            // Old/new host shapes.
            if (typeof res.path === "string") p = res.path;
            else if (res.path && typeof res.path === "object" && typeof res.path.fsName === "string") p = res.path.fsName;
            else if (typeof res.fsName === "string") p = res.fsName;
        }

        // As a last resort, try to stringify but avoid '[object Object]'.
        if (!p && res) {
            var s = String(res);
            if (s && s !== "[object Object]") p = s;
        }

        if (!p) {
            uiAlert("Settings: picker did not return a path");
            return;
        }

        p = String(p).replace(/\\/g, "/");

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


    var swInput = document.getElementById("settings-short-word-len");
    var sw = _settingsParseInt(swInput ? swInput.value : "", 3);
    if (sw < 1) sw = 1;
    if (sw > 10) sw = 10;

    var psInput = document.getElementById("settings-pad-start-frames");
    var ps = _settingsParseInt(psInput ? psInput.value : "", 6);
    if (ps < 0) ps = 0;
    if (ps > 50) ps = 50;

    var spEl = document.getElementById("settings-speakers-path");
    var sp = spEl ? String(spEl.value || "") : "";
    sp = sp.replace(/\\/g, "/").replace(/^\s+|\s+$/g, "");

    var topicsEl = document.getElementById("settings-topics");
    var topics = _settingsParseLinesToList(topicsEl ? topicsEl.value : "");


    var wxModelEl = document.getElementById("settings-whisperx-model");
    var wxModel = wxModelEl ? String(wxModelEl.value || "medium") : "medium";

    var wxLangEl = document.getElementById("settings-whisperx-language");
    var wxLang = wxLangEl ? String(wxLangEl.value || "ru") : "ru";
    wxLang = wxLang.replace(/^\s+|\s+$/g, "");
    if (!wxLang) wxLang = "ru";

    var wxAdvEl = document.getElementById("settings-whisperx-adv-enabled");
    var wxAdvEnabled = wxAdvEl ? !!wxAdvEl.checked : false;

    var wxBeamEl = document.getElementById("settings-whisperx-beam");
    var wxBeam = _settingsParseInt(wxBeamEl ? wxBeamEl.value : "", 5);
    if (wxBeam < 1) wxBeam = 1;
    if (wxBeam > 20) wxBeam = 20;

    var wxTempEl = document.getElementById("settings-whisperx-temp");
    var wxTemp = _settingsParseFloat(wxTempEl ? wxTempEl.value : "", 0.0);

    var wxNsEl = document.getElementById("settings-whisperx-nospeech");
    var wxNoSpeech = _settingsParseFloat(wxNsEl ? wxNsEl.value : "", 0.6);

    var wxLpEl = document.getElementById("settings-whisperx-logprob");
    var wxLogprob = _settingsParseFloat(wxLpEl ? wxLpEl.value : "", -1.0);

    var wxCpEl = document.getElementById("settings-whisperx-condprev");
    var wxCondPrev = wxCpEl ? !!wxCpEl.checked : true;

    var wxExtraEl = document.getElementById("settings-whisperx-extra");
    var wxExtra = wxExtraEl ? String(wxExtraEl.value || "") : "";
    wxExtra = wxExtra.replace(/^\s+|\s+$/g, "");

    var items = [
        { key: "subtitleCharsPerLine", value: Number(n) },
        { key: "subtitleShortWordMaxLen", value: Number(sw) },
        { key: "autoTimingPadStartFrames", value: Number(ps) },
        { key: "speakersDbPath", value: String(sp || "") },
        { key: "topicOptions", value: topics },

        { key: "whisperxModel", value: String(wxModel || "medium") },
        { key: "whisperxLanguage", value: String(wxLang || "ru") },

        { key: "whisperxAdvancedArgsEnabled", value: !!wxAdvEnabled },
        { key: "whisperxBeamSize", value: Number(wxBeam) },
        { key: "whisperxTemperature", value: Number(wxTemp) },
        { key: "whisperxNoSpeechThreshold", value: Number(wxNoSpeech) },
        { key: "whisperxLogprobThreshold", value: Number(wxLogprob) },
        { key: "whisperxConditionOnPreviousText", value: !!wxCondPrev },
        { key: "whisperxExtraArgs", value: String(wxExtra || "") }
    ];

    function saveNext(i) {
        if (i >= items.length) {
            // Apply UI changes immediately.
            if (typeof setTopicOptions === "function") {
                setTopicOptions(topics && topics.length ? topics : (typeof getTopicOptions === "function" ? getTopicOptions() : []));
            }
            _settingsClose();
            return;
        }

        var it = items[i];
        var cmd = "setConfigValue(" + JSON.stringify(String(it.key)) + "," + JSON.stringify(it.value) + ")";
        aeCall(cmd, function (out) {
            if (!out || !out.ok) {
                uiAlert("Settings: failed to save.\n" + (out ? (out.error || out.result) : "Unknown"));
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

    var adv = document.getElementById("settings-whisperx-adv-enabled");
    if (adv) {
        adv.addEventListener("change", function () {
            var on = !!adv.checked;
            _settingsSetDisabled([
                "settings-whisperx-beam",
                "settings-whisperx-temp",
                "settings-whisperx-nospeech",
                "settings-whisperx-logprob",
                "settings-whisperx-condprev",
                "settings-whisperx-extra"
            ], !on);
        });
    }


    var overlay = document.getElementById("settings-overlay");
    if (overlay) {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) _settingsClose();
        });
    }
}

