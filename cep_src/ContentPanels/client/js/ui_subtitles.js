// ui_subtitles.js
// Subtitles + general buttons

function generateSubtitles(isItalic) {
    var txtEl = document.getElementById("sub-text");
    var txt = txtEl ? txtEl.value : "";
    if (!txt) { uiAlert("Введите текст!"); return; }

    var safeTxt = txt.replace(/\r?\n|\r/g, " ");

    var jumpEl = document.getElementById("chk-playhead-jump");
    var jump = jumpEl ? !!jumpEl.checked : false;

    var cmd = "generateSubs(" + JSON.stringify(safeTxt) + ", " + isItalic + ", " + jump + ")";
    csInterface.evalScript(cmd);
    logUi("generateSubs" + (isItalic ? ":italic" : ":regular"));
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
    attachClick("btn-deep-clean", function () { csInterface.evalScript("deepCleanProject()"); logUi("deepCleanProject"); });
}
