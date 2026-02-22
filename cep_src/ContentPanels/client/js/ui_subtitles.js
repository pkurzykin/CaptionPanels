// ui_subtitles.js
// Subtitles + general buttons

function generateSubtitles(isItalic) {
    var txtEl = document.getElementById("sub-text");
    var txt = txtEl ? txtEl.value : "";
    if (!txt) { uiAlert("Введите текст!"); return; }

    var safeTxt = txt.replace(/\r?\n|\r/g, " ");

    var jumpEl = document.getElementById("chk-playhead-jump");
    var jump = jumpEl ? !!jumpEl.checked : false;

    callHost("generateSubs", [safeTxt, !!isItalic, !!jump], { module: "subtitles", timeoutMs: 15000 }, function (out) {
        if (!out || !out.ok) {
            var err = out && (out.error || out.result) ? String(out.error || out.result) : "Unknown error";
            uiAlert("Generate subtitles failed.\n" + err);
            logUiError("subtitles.generate", err);
            return;
        }
        logUi("generateSubs" + (isItalic ? ":italic" : ":regular"));
    });
}

function initSubtitlesUI() {
    // Кнопка очистки СУБТИТРОВ
    attachClick("btn-clear-sub", function () {
        var subText = document.getElementById("sub-text");
        if (subText) subText.value = "";
    });

    attachClick("btn-gen-regular", function () { generateSubtitles(false); });
    attachClick("btn-gen-italic", function () { generateSubtitles(true); });

    // Глубокая чистка
    attachClick("btn-deep-clean", function () {
        callHost("deepCleanProject", [], { module: "subtitles", timeoutMs: 30000 }, function (out) {
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
