// ui_speakers.js
// Speakers UI handlers

function getSpeakerData() {
    var side = document.querySelector('input[name="side"]:checked');
    var size = document.querySelector('input[name="size"]:checked');
    var solo = document.getElementById("chk-solo-title");
    return {
        name: document.getElementById("input-name") ? document.getElementById("input-name").value.replace(/'/g, "\\'") : "",
        job: document.getElementById("input-job") ? document.getElementById("input-job").value.replace(/'/g, "\\'") : "",
        side: side ? side.value : "Left",
        size: size ? size.value : "Default",
        bgOffset: document.getElementById("bg-slider") ? document.getElementById("bg-slider").value : 0,
        soloTitle: !!(solo && solo.checked)
    };
}

function triggerSpeakerPreview() {
    var d = getSpeakerData();
    callHost("updateSpeakerPreview", [d.name, d.job, d.side, d.size, Number(d.bgOffset || 0), !!d.soloTitle], { module: "speakers", timeoutMs: 10000 }, function (out) {
        if (!out || !out.ok) {
            var err = out && (out.error || out.result) ? String(out.error || out.result) : "Unknown error";
            logUiError("speakers.preview", err);
        }
    });
}

function safeTriggerSpeakerPreview() {
    try {
        triggerSpeakerPreview();
    } catch (e) {
        console.log("Preview error:", e);
    }
}

var _AUTO_DB_FILL_LOCK = false;

function _normalizeNameKey(s) {
    return normalizeNameToOneLine(s || "").toLowerCase();
}

function _normalizeJobKey(s) {
    return normalizeSpeakerText(s || "").toLowerCase();
}



function _findSpeakerMatch(name, job) {
    var nKey = _normalizeNameKey(name);
    if (!nKey) return null;

    var jKey = _normalizeJobKey(job);
    var byName = [];
    var exact = null;

    for (var i = 0; i < SPEAKERS_DB.length; i++) {
        var sp = SPEAKERS_DB[i] || {};
        if (_normalizeNameKey(sp.name) !== nKey) continue;
        byName.push(sp);
        if (jKey && _normalizeJobKey(sp.job) === jKey) {
            exact = sp;
            break;
        }
    }

    if (exact) return exact;
    if (byName.length === 1) return byName[0];
    return null;
}

function tryAutoFillSpeakerFromDb() {
    if (_AUTO_DB_FILL_LOCK) return;
    var nameEl = document.getElementById("input-name");
    var jobEl = document.getElementById("input-job");
    if (!nameEl || !jobEl) return;

    var name = nameEl.value || "";
    var job = jobEl.value || "";
    if (!normalizeSpeakerText(name)) return;

    ensureSpeakersDbLoaded(function (ok) {
        if (!ok) return;
        var match = _findSpeakerMatch(name, job);
        if (!match) return;

        _AUTO_DB_FILL_LOCK = true;
        nameEl.value = (typeof formatSpeakerNameForInput === "function") ? formatSpeakerNameForInput(match.name || "") : (match.name || "");
        jobEl.value = match.job || "";
        _AUTO_DB_FILL_LOCK = false;

        safeTriggerSpeakerPreview();
        updateAddSpeakerBtnState();
    });
}

function initSpeakersUI() {
    // Назначаем события для полей (Превью)
    var inputs = ["input-name", "input-job"];
    inputs.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", triggerSpeakerPreview);
            el.addEventListener("input", updateAddSpeakerBtnState);
            el.addEventListener("blur", tryAutoFillSpeakerFromDb);
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
    var soloChk = document.getElementById("chk-solo-title");
    if (soloChk) {
        soloChk.addEventListener("change", triggerSpeakerPreview);
    }

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

            callHost("addSpeakerToDb", [name, job], { module: "speakers", timeoutMs: 15000 }, function (out) {
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
        callHost("createSpeakerTitle", [d.name, d.job, d.side, d.size, Number(d.bgOffset || 0), !!d.soloTitle], { module: "speakers", timeoutMs: 20000 }, function (out) {
            if (!out || !out.ok) {
                var err = out && (out.error || out.result) ? (out.error || out.result) : "Unknown error";
                uiAlert("Не удалось создать титр.\n" + err);
                logUiError("speakers.create", err);
                return;
            }

            logUi("createSpeakerTitle");

            if (typeof jsonImportAdvanceAfterCreate === "function" && jsonImportAdvanceAfterCreate()) {
                return;
            }

            // Сброс UI
            var nameEl = document.getElementById("input-name");
            var jobEl  = document.getElementById("input-job");
            if (nameEl) nameEl.value = "";
            if (jobEl) jobEl.value = "";

            var sideLeft = document.getElementById("side-left");
            if (sideLeft) sideLeft.checked = true;

            var sizeDef = document.getElementById("size-def");
            if (sizeDef) sizeDef.checked = true;

            var soloChk = document.getElementById("chk-solo-title");
            if (soloChk) soloChk.checked = false;

            if (bgSliderEl) bgSliderEl.value = 0;
            if (bgValEl) bgValEl.textContent = "0";
            updateAddSpeakerBtnState();
        });
    });

    // Кнопка очистки
    attachClick("btn-clear-spk", function () {
        var nameInput = document.getElementById("input-name");
        var jobInput = document.getElementById("input-job");
        if (nameInput) nameInput.value = "";
        if (jobInput) jobInput.value = "";
        callHost("removePreview", [], { module: "speakers", timeoutMs: 5000 }, function (out) {
            if (!out || !out.ok) {
                var err = out && (out.error || out.result) ? String(out.error || out.result) : "Unknown error";
                logUiError("speakers.preview.remove", err);
                return;
            }
            logUi("removePreview");
        });
        updateAddSpeakerBtnState();
    });

    // Load current speaker from import queue (manual start of preview)
    attachClick("btn-load-speaker", function () {
        if (typeof jsonImportLoadCurrentSpeakerForTitles === "function") {
            if (jsonImportLoadCurrentSpeakerForTitles()) return;
        }
        // Fallback: just show preview for current fields
        safeTriggerSpeakerPreview();
    });

    // Открыть базу
    attachClick("btn-open-database", function () { loadSpeakersDbThenOpen(); });

    // TRIM
    attachClick("btn-trim", function () {
        callHost("trimLayersInsideSelectedPrecomp", [], { module: "speakers", timeoutMs: 15000 }, function (out) {
            if (!out || !out.ok) {
                var err = out && (out.error || out.result) ? String(out.error || out.result) : "Unknown error";
                uiAlert("Trim failed.\n" + err);
                logUiError("speakers.trim", err);
            }
        });
    });
}
