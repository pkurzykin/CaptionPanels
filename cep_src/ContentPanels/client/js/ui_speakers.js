// ui_speakers.js
// Speakers UI handlers

function getSpeakerData() {
    var side = document.querySelector('input[name="side"]:checked');
    var size = document.querySelector('input[name="size"]:checked');
    return {
        name: document.getElementById("input-name") ? document.getElementById("input-name").value.replace(/'/g, "\\'") : "",
        job: document.getElementById("input-job") ? document.getElementById("input-job").value.replace(/'/g, "\\'") : "",
        side: side ? side.value : "Left",
        size: size ? size.value : "Default",
        bgOffset: document.getElementById("bg-slider") ? document.getElementById("bg-slider").value : 0
    };
}

function triggerSpeakerPreview() {
    var d = getSpeakerData();
    var cmd =
    "updateSpeakerPreview(" + JSON.stringify(d.name) + "," + JSON.stringify(d.job) + "," + JSON.stringify(d.side) + "," + JSON.stringify(d.size) + "," + Number(d.bgOffset || 0) + ")";
    csInterface.evalScript(cmd);
}

function safeTriggerSpeakerPreview() {
    try {
        triggerSpeakerPreview();
    } catch (e) {
        console.log("Preview error:", e);
    }
}

function initSpeakersUI() {
    // Назначаем события для полей (Превью)
    var inputs = ["input-name", "input-job"];
    inputs.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", triggerSpeakerPreview);
            el.addEventListener("input", updateAddSpeakerBtnState);
        }
    });
    updateAddSpeakerBtnState();

    // Слайдер BG
    var bgSliderEl = document.getElementById("bg-slider");
    var bgValEl = document.getElementById("bg-val");
    if (bgSliderEl) {
        if (bgValEl) bgValEl.textContent = bgSliderEl.value;

        bgSliderEl.addEventListener("input", function () {
            if (bgValEl) bgValEl.textContent = bgSliderEl.value;
            safeTriggerSpeakerPreview();
        });

        bgSliderEl.addEventListener("dblclick", function () {
            bgSliderEl.value = 0;
            if (bgValEl) bgValEl.textContent = "0";
            safeTriggerSpeakerPreview();
        });
    }

    // Радиокнопки
    var radios = document.querySelectorAll('input[name="side"], input[name="size"]');
    radios.forEach(function (r) {
        r.addEventListener("change", triggerSpeakerPreview);
    });

    // Кнопка добавления в базу
    attachClick("btn-add-speaker", function () {
        var nameEl = document.getElementById("input-name");
        var jobEl  = document.getElementById("input-job");
        var name = nameEl ? nameEl.value : "";
        var job  = jobEl ? jobEl.value : "";

        if (!normalizeSpeakerText(name) || !normalizeSpeakerText(job)) {
            uiAlert("Заполните ФИО и должность.");
            return;
        }

        ensureSpeakersDbLoaded(function (ok) {
            if (!ok) return;
            if (isDuplicateSpeaker(name, job)) {
                uiAlert("Такой спикер уже есть в базе.");
                return;
            }

            var cmd = "addSpeakerToDb(" + JSON.stringify(name) + "," + JSON.stringify(job) + ")";
            aeCall(cmd, function (out) {
                var res = out.result || "";
                if (out.ok && res === "OK") {
                    SPEAKERS_DB.push({ name: name, job: job });
                    var dbSearch = document.getElementById("db-search");
                    var overlay = document.getElementById("db-overlay");
                    if (overlay && overlay.style.display !== "none") {
                        renderDbList(dbSearch ? dbSearch.value : "");
                    }
                    uiAlert("Спикер добавлен в базу.");
                } else if (res === "DUPLICATE") {
                    uiAlert("Такой спикер уже есть в базе.");
                } else if (!out.ok) {
                    uiAlert("Не удалось добавить спикера в базу. " + (out.error || res));
                    logUiError("speakers.add", out.error || res);
                } else {
                    uiAlert("Не удалось добавить спикера в базу.");
                }
            });
        });
    });

    // Кнопка создания
    attachClick("btn-create-title", function () {
        var d = getSpeakerData();
        var cmd =
            "createSpeakerTitle(" + JSON.stringify(d.name) + "," + JSON.stringify(d.job) + "," + JSON.stringify(d.side) + "," + JSON.stringify(d.size) + "," + Number(d.bgOffset || 0) + ")";
        csInterface.evalScript(cmd);
        logUi("createSpeakerTitle");

        // Сброс UI
        var nameEl = document.getElementById("input-name");
        var jobEl  = document.getElementById("input-job");
        if (nameEl) nameEl.value = "";
        if (jobEl) jobEl.value = "";

        var sideLeft = document.getElementById("side-left");
        if (sideLeft) sideLeft.checked = true;

        var sizeDef = document.getElementById("size-def");
        if (sizeDef) sizeDef.checked = true;

        if (bgSliderEl) bgSliderEl.value = 0;
        if (bgValEl) bgValEl.textContent = "0";
        updateAddSpeakerBtnState();
    });

    // Кнопка очистки
    attachClick("btn-clear-spk", function () {
        var nameInput = document.getElementById("input-name");
        var jobInput = document.getElementById("input-job");
        if (nameInput) nameInput.value = "";
        if (jobInput) jobInput.value = "";
        csInterface.evalScript("removePreview()");
        logUi("removePreview");
        updateAddSpeakerBtnState();
    });

    // Открыть базу
    attachClick("btn-open-database", function () { loadSpeakersDbThenOpen(); });

    // TRIM
    attachClick("btn-trim", function () { csInterface.evalScript("trimLayersInsideSelectedPrecomp()"); });
}
