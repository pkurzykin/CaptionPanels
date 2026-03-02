// ui_subtitles.js
// Subtitles + general buttons

var _subtitlesGenerateInProgress = false;

function _setGenerateButtonsDisabled(disabled) {
    var r = document.getElementById("btn-gen-regular");
    var i = document.getElementById("btn-gen-italic");
    if (r) r.disabled = !!disabled;
    if (i) i.disabled = !!disabled;
}

function _blurElementSafe(el) {
    try {
        if (el && typeof el.blur === "function") {
            el.blur();
            return;
        }
    } catch (e0) {}
    try {
        var active = document.activeElement;
        if (active && typeof active.blur === "function") active.blur();
    } catch (e1) {}
}

function generateSubtitles(isItalic, triggerEl) {
    _blurElementSafe(triggerEl);
    if (_subtitlesGenerateInProgress) {
        logUi("generateSubs:skipped_busy");
        return;
    }

    var txtEl = document.getElementById("sub-text");
    var txt = txtEl ? txtEl.value : "";
    if (!txt) { uiAlert("Введите текст!"); return; }

    var safeTxt = txt.replace(/\r?\n|\r/g, " ");

    var jumpEl = document.getElementById("chk-playhead-jump");
    var jump = jumpEl ? !!jumpEl.checked : false;

    _subtitlesGenerateInProgress = true;
    _setGenerateButtonsDisabled(true);
    try {
        CPHostAPI.call("generateSubs", [safeTxt, !!isItalic, !!jump], { module: "subtitles", timeoutMs: 15000 }, function (out) {
            _subtitlesGenerateInProgress = false;
            _setGenerateButtonsDisabled(false);
            if (!out || !out.ok) {
                var err = out && (out.error || out.result) ? String(out.error || out.result) : "Unknown error";
                uiAlert("Generate subtitles failed.\n" + err);
                logUiError("subtitles.generate", err);
                return;
            }
            logUi("generateSubs" + (isItalic ? ":italic" : ":regular"));
        });
    } catch (eCall) {
        _subtitlesGenerateInProgress = false;
        _setGenerateButtonsDisabled(false);
        throw eCall;
    }
}

function initSubtitlesUI() {
    // Кнопка очистки СУБТИТРОВ
    attachClick("btn-clear-sub", function () {
        var subText = document.getElementById("sub-text");
        if (subText) subText.value = "";
    });

    attachClick("btn-gen-regular", function () { generateSubtitles(false, this); });
    attachClick("btn-gen-italic", function () { generateSubtitles(true, this); });

    // Глубокая чистка
    attachClick("btn-deep-clean", function () {
        CPHostAPI.call("deepCleanProject", [], { module: "subtitles", timeoutMs: 30000 }, function (out) {
            if (!out || !out.ok) {
                var err = out && (out.error || out.result) ? String(out.error || out.result) : "Unknown error";
                uiAlert("FixTypography failed.\n" + err);
                logUiError("subtitles.deepClean", err);
                return;
            }
            logUi("deepCleanProject");
        });
    });
}
