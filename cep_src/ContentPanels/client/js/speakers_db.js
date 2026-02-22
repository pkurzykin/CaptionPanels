// speakers_db.js
// Speakers database helpers + modal rendering

// ===== Speakers Database (speakers.json) =====
var SPEAKERS_DB = [];
var SPEAKERS_DB_LOADED = false;

var SPEAKERS_DB_SELECTED_INDEX = -1;
var SPEAKERS_DB_SELECTED_OBJ = null;

function isDuplicateSpeaker(name, job) {
    var n = normalizeSpeakerText(name);
    var j = normalizeSpeakerText(job);
    for (var i = 0; i < SPEAKERS_DB.length; i++) {
        var s = SPEAKERS_DB[i] || {};
        if (normalizeSpeakerText(s.name) === n && normalizeSpeakerText(s.job) === j) return true;
    }
    return false;
}

function updateAddSpeakerBtnState() {
    var btn = document.getElementById("btn-add-speaker");
    if (!btn) return;
    var nameEl = document.getElementById("input-name");
    var jobEl = document.getElementById("input-job");
    var n = normalizeSpeakerText(nameEl ? nameEl.value : "");
    var j = normalizeSpeakerText(jobEl ? jobEl.value : "");
    btn.disabled = !(n && j);
}

function openDbModal() {
    var overlay = document.getElementById("db-overlay");
    if (overlay) overlay.style.display = "block";
}

function closeDbModal() {
    var overlay = document.getElementById("db-overlay");
    if (overlay) overlay.style.display = "none";
}

function renderDbList(filterText) {
    var list = document.getElementById("db-list");
    var addBtn = document.getElementById("btn-db-add");
    if (!list) return;

    var q = String(filterText || "").toLowerCase().trim();
    list.innerHTML = "";

    // сброс выбора при перерисовке
    SPEAKERS_DB_SELECTED_INDEX = -1;
    SPEAKERS_DB_SELECTED_OBJ = null;
    if (addBtn) addBtn.disabled = true;

    var filtered = SPEAKERS_DB.filter(function (sp) {
        if (!sp) return false;
        var oneLine = normalizeNameToOneLine(sp.name);
        return !q || oneLine.toLowerCase().indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
        var empty = document.createElement("div");
        empty.className = "db-row";
        empty.innerHTML = '<div class="db-name" style="color:#aaa;">Ничего не найдено</div>';
        list.appendChild(empty);
        return;
    }

    filtered.forEach(function (sp, idx) {
        var row = document.createElement("div");
        row.className = "db-row";
        row.dataset.idx = String(idx);

        var nameDiv = document.createElement("div");
        nameDiv.className = "db-name";
        nameDiv.textContent = normalizeNameToOneLine(sp.name);

        var delBtn = document.createElement("button");
        delBtn.className = "db-del";
        delBtn.type = "button";
        delBtn.textContent = "✕";

        row.appendChild(nameDiv);
        row.appendChild(delBtn);

        row.addEventListener("click", function () {
            // снять выделение со всех
            var rows = list.getElementsByClassName("db-row");
            for (var i = 0; i < rows.length; i++) rows[i].classList.remove("selected");

            // выделить текущую
            row.classList.add("selected");
            SPEAKERS_DB_SELECTED_INDEX = idx;
            SPEAKERS_DB_SELECTED_OBJ = sp;

            if (addBtn) addBtn.disabled = false;
        });

        delBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            uiConfirm("Удалить выбранного спикера из базы?", function (okConfirm) {
                if (!okConfirm) return;

                ensureSpeakersDbLoaded(function (ok) {
                    if (!ok) return;
                    callHost("removeSpeakerFromDb", [sp.name || "", sp.job || ""], { module: "speakersDb", timeoutMs: 15000 }, function (out) {
                        var res = out.result || "";
                        if (out.ok && res === "OK") {
                            // удаляем из локального массива
                            for (var i = 0; i < SPEAKERS_DB.length; i++) {
                                if (normalizeSpeakerText(SPEAKERS_DB[i].name) === normalizeSpeakerText(sp.name) &&
                                    normalizeSpeakerText(SPEAKERS_DB[i].job) === normalizeSpeakerText(sp.job)) {
                                    SPEAKERS_DB.splice(i, 1);
                                    break;
                                }
                            }
                            renderDbList(document.getElementById("db-search") ? document.getElementById("db-search").value : "");
                        } else if (res === "NOT_FOUND") {
                            uiAlert("Спикер не найден в базе.");
                        } else if (!out.ok) {
                            uiAlert("Не удалось удалить спикера. " + (out.error || res));
                            logUiError("speakers.remove", out.error || res);
                        } else {
                            uiAlert("Не удалось удалить спикера.");
                        }
                    });
                });
            });
        });

        row.addEventListener("dblclick", function () {
            // на dblclick сразу выбираем и добавляем
            SPEAKERS_DB_SELECTED_INDEX = idx;
            SPEAKERS_DB_SELECTED_OBJ = sp;

            var nameEl = document.getElementById("input-name");
            var jobEl  = document.getElementById("input-job");

            if (nameEl) nameEl.value = sp.name || "";
            if (jobEl)  jobEl.value  = sp.job || "";

            closeDbModal();

            if (typeof triggerSpeakerPreview === "function") {
                triggerSpeakerPreview();
            }
            updateAddSpeakerBtnState();
        });

        list.appendChild(row);
    });
}

function loadSpeakersDbThenOpen() {
    ensureSpeakersDbLoaded(function (ok) {
        if (!ok) return;
        renderDbList(document.getElementById("db-search") ? document.getElementById("db-search").value : "");
        openDbModal();
    });
}

function ensureSpeakersDbLoaded(cb) {
    if (SPEAKERS_DB_LOADED) return cb(true);
    callHost("getSpeakersDbJson", [], { module: "speakersDb", timeoutMs: 15000 }, function (out) {
        if (!out.ok) {
            var msg = out.error || out.result || "Unknown error";
            console.log("DB load error:", msg);
            uiAlert("Не удалось загрузить базу спикеров.\n" + msg);
            logUiError("speakers.load", msg);
            cb(false);
            return;
        }
        try {
            var data = out.result;
            if (typeof data === "string") {
                var txt = data;
                if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1); // strip BOM
                if (txt.replace(/\s+/g, "").length === 0) {
                    data = [];
                } else {
                    data = JSON.parse(txt);
                }
            }
            SPEAKERS_DB = (data && data.length) ? data : (Array.isArray(data) ? data : []);
            SPEAKERS_DB_LOADED = true;
            cb(true);
        } catch (e) {
            var raw = "";
            try { raw = String(out.result); } catch (e2) { raw = "<non-string>"; }
            if (raw.length > 200) raw = raw.slice(0, 200) + "...";
            console.log("DB JSON parse error:", e, "raw:", raw);
            uiAlert("Ошибка чтения базы спикеров (JSON parse).");
            logUiError("speakers.parse", e.message + " | raw=" + raw);
            cb(false);
        }
    });
}
// ===== /Speakers Database =====

function initSpeakersDbUI() {
    // Добавить выбранного спикера
    attachClick("btn-db-add", function () {
        if (!SPEAKERS_DB_SELECTED_OBJ) return;

        var sp = SPEAKERS_DB_SELECTED_OBJ;

        var nameEl = document.getElementById("input-name");
        var jobEl  = document.getElementById("input-job");

        if (nameEl) nameEl.value = sp.name || "";
        if (jobEl)  jobEl.value  = sp.job || "";

        closeDbModal();

        if (typeof safeTriggerSpeakerPreview === "function") {
            safeTriggerSpeakerPreview();
        }
        updateAddSpeakerBtnState();
    });

    // Закрытие модалки базы
    attachClick("btn-db-close", function () { closeDbModal(); });

    // Закрытие по клику на затемнение (только если клик именно по overlay)
    var overlay = document.getElementById("db-overlay");
    if (overlay) {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) closeDbModal();
        });
    }

    // Поиск
    var dbSearch = document.getElementById("db-search");
    if (dbSearch) {
        dbSearch.addEventListener("input", function () {
            renderDbList(dbSearch.value);
        });
    }
}
