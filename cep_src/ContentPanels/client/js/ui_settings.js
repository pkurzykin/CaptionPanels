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

function _settingsLoad() {
    aeCall("getConfigForUI()", function (out) {
        if (!out || !out.ok) {
            uiAlert("Настройки: не удалось прочитать config.json\n" + (out ? (out.error || out.result) : "Unknown"));
            return;
        }
        var res = out.result || {};
        var val = (typeof res.subtitleCharsPerLine !== "undefined") ? res.subtitleCharsPerLine : 60;
        var input = document.getElementById("settings-chars");
        if (input) input.value = String(val);
    });
}

function _settingsSave() {
    var input = document.getElementById("settings-chars");
    var n = _settingsParseInt(input ? input.value : "", 60);

    // Guardrails (we don't want absurd values).
    if (n < 20) n = 20;
    if (n > 200) n = 200;

    var cmd = "setConfigValue(" + JSON.stringify("subtitleCharsPerLine") + "," + Number(n) + ")";
    aeCall(cmd, function (out) {
        if (!out || !out.ok) {
            uiAlert("Настройки: не удалось сохранить.\n" + (out ? (out.error || out.result) : "Unknown"));
            return;
        }

        // Applies to new subtitles immediately. Reload isn't required.
        uiAlert("Сохранено. Новые субтитры будут нарезаться по " + n + " символов в строке.");
        _settingsClose();
    });
}

function initSettingsUI() {
    attachClick("btn-settings", function () {
        _settingsLoad();
        _settingsOpen();
    });

    attachClick("btn-settings-close", function () { _settingsClose(); });
    attachClick("btn-settings-cancel", function () { _settingsClose(); });
    attachClick("btn-settings-save", function () { _settingsSave(); });

    var overlay = document.getElementById("settings-overlay");
    if (overlay) {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) _settingsClose();
        });
    }
}
