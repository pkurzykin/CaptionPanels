var csInterface = new CSInterface();

// ===== Speakers Database (speakers.json) =====
var SPEAKERS_DB = [];
var SPEAKERS_DB_LOADED = false;

var SPEAKERS_DB_SELECTED_INDEX = -1;
var SPEAKERS_DB_SELECTED_OBJ = null;

// ===== Topics (рубрики) =====
var TOPIC_OPTIONS = [
    "Новости",
    "Специальный репортаж",
    "Транснефть помогает",
    "Волонтеры Транснефти",
    "Люди компании",
    "Новость дня",
    "Оптимум"
];

function getExtensionRootPath() {
    // extensionPath обычно уже считается в window.onload, но держим и здесь
    return csInterface.getSystemPath(SystemPath.EXTENSION).replace(/\\/g, '/');
}

function normalizeNameToOneLine(name) {
    return String(name || "").replace(/\r\n|\n|\r/g, " ").replace(/\s+/g, " ").trim();
}

function uiAlert(msg) {
    try {
        csInterface.evalScript("alert(" + JSON.stringify(String(msg)) + ")");
    } catch (e) {
        alert(msg);
    }
}

function uiConfirm(msg, cb) {
    try {
        csInterface.evalScript("confirm(" + JSON.stringify(String(msg)) + ")", function (res) {
            cb(String(res).toLowerCase() === "true");
        });
    } catch (e) {
        cb(confirm(msg));
    }
}

function normalizeSpeakerText(txt) {
    return String(txt || "").replace(/\r\n|\r/g, "\n").trim();
}

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
                    var cmd = "removeSpeakerFromDb(" + JSON.stringify(sp.name || "") + "," + JSON.stringify(sp.job || "") + ")";
                    csInterface.evalScript(cmd, function (res) {
                        if (res === "OK") {
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
                        } else if (typeof res === "string" && res.indexOf("Error:") === 0) {
                            uiAlert("Не удалось удалить спикера. " + res);
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

    var root = getExtensionRootPath();
    var url = "file://" + root + "/speakers.json";

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);

    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;

        if (xhr.status === 200 || xhr.status === 0) {
            try {
                var txt = xhr.responseText || "";
                if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1); // strip BOM
                SPEAKERS_DB = JSON.parse(txt) || [];
                SPEAKERS_DB_LOADED = true;
                cb(true);
            } catch (e) {
                console.log("DB JSON parse error:", e);
                uiAlert("Ошибка чтения speakers.json (JSON parse).");
                cb(false);
            }
        } else {
            console.log("DB load failed:", xhr.status, xhr.responseText);
            uiAlert("Не удалось загрузить speakers.json. Проверь, что файл лежит в корне расширения.");
            cb(false);
        }
    };

    xhr.send();
}
// ===== /Speakers Database =====

// ГЛОБАЛЬНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ (вынесена наружу для HTML)
window.openTab = function(evt, tabName) {
    var i, tabcontent, tablinks;

    // 1. Скрываем абсолютно все блоки с контентом
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].style.visibility = "hidden"; // Доп. защита
    }

    // 2. Деактивируем все кнопки вкладок
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // 3. Показываем нужную вкладку
    var targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.style.display = "block";
        targetTab.style.visibility = "visible";
        evt.currentTarget.className += " active";
    }
};

window.onload = function() {
    var extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION).replace(/\\/g, '/');

    // ЦЕПОЧКА ЗАГРУЗКИ JSX
    csInterface.evalScript('initPath("' + extensionPath + '")', function() {
    csInterface.evalScript('loadModule("utils.jsx")', function() {
        csInterface.evalScript('loadModule("cleanup.jsx")', function() {
            csInterface.evalScript('loadModule("subtitles.jsx")', function() {
                csInterface.evalScript('loadModule("branding.jsx")', function() {
                    csInterface.evalScript('loadModule("speakers.jsx")', function(res) {
                        console.log("Все системы AE готовы: " + res);
                    });
                });
            });
        });
    });
});


// --- ОБРАБОТЧИКИ ТИТРОВ (SPEAKERS) ---
// Назначаем события для полей (Превью)
var inputs = ["input-name", "input-job"]; // ВАЖНО: bg-slider обработаем отдельно ниже
inputs.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', triggerSpeakerPreview);
        el.addEventListener('input', updateAddSpeakerBtnState);
        }
    });
    updateAddSpeakerBtnState();

    // Слайдер BG: обновляем цифру, превью, и dblclick -> сброс в 0
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


    function safeTriggerSpeakerPreview() {
    try {
        triggerSpeakerPreview();
    } catch (e) {
        console.log("Preview error:", e);
    }
}

    // --- РУБРИКИ (TOPIC) ---
    var topicField = document.getElementById("topic-field");
    var topicDropdown = document.getElementById("topic-dropdown");
    var topicToggle = document.getElementById("btn-topic-dropdown");
    var topicInput = document.getElementById("input-head-topic");

    function closeTopicDropdown() {
        if (topicDropdown) topicDropdown.classList.remove("open");
    }

    function toggleTopicDropdown() {
        if (!topicDropdown) return;
        topicDropdown.classList.toggle("open");
    }

    if (topicDropdown) {
        topicDropdown.innerHTML = "";
        TOPIC_OPTIONS.forEach(function (name) {
            var item = document.createElement("div");
            item.className = "topic-item";
            item.textContent = name;
            item.addEventListener("click", function () {
                if (topicInput) topicInput.value = name;
                closeTopicDropdown();
            });
            topicDropdown.appendChild(item);
        });
    }

    if (topicToggle) {
        topicToggle.addEventListener("click", function (e) {
            e.stopPropagation();
            toggleTopicDropdown();
        });
    }

    document.addEventListener("click", function (e) {
        if (!topicField) return;
        if (topicField.contains(e.target)) return;
        closeTopicDropdown();
    });

// Добавить выбранного спикера
attachClick("btn-db-add", function() {
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
attachClick("btn-db-close", function() { closeDbModal(); });

// Закрытие по клику на затемнение (только если клик именно по overlay)
var overlay = document.getElementById("db-overlay");
if (overlay) {
    overlay.addEventListener("click", function(e) {
        if (e.target === overlay) closeDbModal();
    });
}

// Поиск
var dbSearch = document.getElementById("db-search");
if (dbSearch) {
    dbSearch.addEventListener("input", function() {
        renderDbList(dbSearch.value);
    });
}

    // Назначаем события для радиокнопок
    var radios = document.querySelectorAll('input[name="side"], input[name="size"]');
    radios.forEach(function(r) {
        r.addEventListener('change', triggerSpeakerPreview);
    });

    // Кнопка добавления в базу
    attachClick("btn-add-speaker", function() {
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
            csInterface.evalScript(cmd, function (res) {
                if (res === "OK") {
                    SPEAKERS_DB.push({ name: name, job: job });
                    var dbSearch = document.getElementById("db-search");
                    var overlay = document.getElementById("db-overlay");
                    if (overlay && overlay.style.display !== "none") {
                        renderDbList(dbSearch ? dbSearch.value : "");
                    }
                    uiAlert("Спикер добавлен в базу.");
                } else if (res === "DUPLICATE") {
                    uiAlert("Такой спикер уже есть в базе.");
                } else if (typeof res === "string" && res.indexOf("Error:") === 0) {
                    uiAlert("Не удалось добавить спикера в базу. " + res);
                } else {
                    uiAlert("Не удалось добавить спикера в базу.");
                }
            });
        });
    });

    // Кнопка создания
    attachClick("btn-create-title", function() {
        var d = getSpeakerData();
        // Важно: используем одинарные кавычки внутри двойных
        var cmd =
    `createSpeakerTitle(${JSON.stringify(d.name)},${JSON.stringify(d.job)},${JSON.stringify(d.side)},${JSON.stringify(d.size)},${Number(d.bgOffset || 0)})`;
    csInterface.evalScript(cmd);

    // --- СБРОС UI в дефолт (Вариант A: без автопревью) ---
    var nameEl = document.getElementById("input-name");
    var jobEl  = document.getElementById("input-job");
    if (nameEl) nameEl.value = "";
    if (jobEl) jobEl.value = "";

    var sideLeft = document.getElementById("side-left");
    if (sideLeft) sideLeft.checked = true;

    var sizeDef = document.getElementById("size-def");
    if (sizeDef) sizeDef.checked = true;

    var bgSliderEl = document.getElementById("bg-slider");
    var bgValEl    = document.getElementById("bg-val");
    if (bgSliderEl) bgSliderEl.value = 0;
    if (bgValEl) bgValEl.textContent = "0";
    updateAddSpeakerBtnState();

    });

    // Кнопка очистки
    attachClick("btn-clear-spk", function() {
        var nameInput = document.getElementById("input-name");
        var jobInput = document.getElementById("input-job");
    if(nameInput) nameInput.value = "";
    if(jobInput) jobInput.value = "";
    csInterface.evalScript("removePreview()");
    updateAddSpeakerBtnState();
    });

    // Кнопка очистки СУБТИТРОВ
    attachClick("btn-clear-sub", function() {
    var subText = document.getElementById("sub-text");
    if (subText) subText.value = "";
    });

    // Крестики очистки для инпутов (по data-clear)
    var clearBtns = document.querySelectorAll(".clear-btn");
    clearBtns.forEach(function(btn) {
    btn.addEventListener("click", function() {
        var targetId = btn.getAttribute("data-clear");
        var el = document.getElementById(targetId);
        if (el) el.value = "";
        if (targetId === "input-head-topic") {
            var dd = document.getElementById("topic-dropdown");
            if (dd) dd.classList.remove("open");
        }
        if (targetId === "input-name" || targetId === "input-job") {
            updateAddSpeakerBtnState();
        }
        el && el.focus();
        });
    });


    // --- ОСТАЛЬНЫЕ КНОПКИ ---
    attachClick("btn-deep-clean", function() { csInterface.evalScript("deepCleanProject()"); });
    attachClick("btn-gen-regular", function() { generateSubtitles(false); });
    attachClick("btn-gen-italic", function() { generateSubtitles(true); });
    
    attachClick("btn-create-branding", function() {
    var headEl = document.getElementById("input-head-title");
    var topicEl = document.getElementById("input-head-topic");
    var geoEl = document.getElementById("input-geotag");

    var head = headEl ? headEl.value : "";
    var topic = topicEl ? topicEl.value : "";
    var geo = geoEl ? geoEl.value : "";

    var didSomething = false;

    // 1) GEOTAG (если заполнен)
    if (geo) {
        var cmdGeo = "createGeotag(" + JSON.stringify(geo) + ")";
        csInterface.evalScript(cmdGeo);
        didSomething = true;
    }

    // 2) HEAD_TOPIC (если есть хоть что-то)
    if (head || topic) {
        var cmdHead = "applyHeadTopicToRegular(" + JSON.stringify(head) + "," + JSON.stringify(topic) + ")";
        csInterface.evalScript(cmdHead);
        didSomething = true;
    }
    
});



    attachClick("btn-trim", function() { csInterface.evalScript("trimLayersInsideSelectedPrecomp()"); });
    attachClick("btn-open-database", function() { loadSpeakersDbThenOpen(); });


    // Открываем первую вкладку по умолчанию
    var firstTab = document.querySelector(".tab-link");
    if (firstTab) firstTab.click();
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function attachClick(id, fn) {
    var el = document.getElementById(id);
    if (el) el.onclick = fn;
}

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
    `updateSpeakerPreview(${JSON.stringify(d.name)},${JSON.stringify(d.job)},${JSON.stringify(d.side)},${JSON.stringify(d.size)},${Number(d.bgOffset || 0)})`;
csInterface.evalScript(cmd);

}

function generateSubtitles(isItalic) {
    var txtEl = document.getElementById("sub-text");
    var txt = txtEl ? txtEl.value : "";
    if (!txt) { uiAlert("Введите текст!"); return; }

    // Не подменяем кавычки — экранируем строку через JSON.stringify
    var safeTxt = txt.replace(/\r?\n|\r/g, " ");

    var jumpEl = document.getElementById("chk-playhead-jump");
    var jump = jumpEl ? !!jumpEl.checked : false; // по умолчанию false

    // Передаём третий параметр: jump (если true — плейхед прыгнет в конец)
    var cmd = "generateSubs(" + JSON.stringify(safeTxt) + ", " + isItalic + ", " + jump + ")";
    csInterface.evalScript(cmd);
}
