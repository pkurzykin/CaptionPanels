// Core helpers are in app_core.js
// Speakers DB helpers are in speakers_db.js

window.onload = function() {
    var extensionPath = getExtensionRootPath();

    // ЦЕПОЧКА ЗАГРУЗКИ JSX
    loadHostModules([
        "response.jsx",
        "config.jsx",
        "logger.jsx",
        "utils.jsx",
        "cleanup.jsx",
        "subtitles.jsx",
        "branding.jsx",
        "json_import.jsx",
        "speakers.jsx",
        "job_runner.jsx"
    ], function () {
        console.log("Все системы AE готовы");
    });

    initTabs();
    initTopicDropdown();
    initSpeakersDbUI();
    initSpeakersUI();
    initSubtitlesUI();
    initBrandingUI();
    initJsonImportUI();

    var reloadBtn = document.getElementById("btn-reload");
    if (reloadBtn) {
        reloadBtn.addEventListener("click", function () {
            window.location.reload();
        });
    }

    // Крестики очистки для инпутов (по data-clear)
    var clearBtns = document.querySelectorAll(".clear-btn");
    clearBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
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

    var vEl = document.getElementById("ui-version");
    if (vEl && typeof UI_VERSION !== "undefined") {
        vEl.textContent = UI_VERSION;
    }
};
