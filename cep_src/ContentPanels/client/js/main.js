// Core helpers are in app_core.js
// Speakers DB helpers are in speakers_db.js

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
    var extensionPath = getExtensionRootPath();

    // ЦЕПОЧКА ЗАГРУЗКИ JSX
    csInterface.evalScript('initPath("' + extensionPath + '")', function() {
    csInterface.evalScript('loadModule("config.jsx")', function() {
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
