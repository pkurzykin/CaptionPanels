// Core helpers are in app_core.js
// Speakers DB helpers are in speakers_db.js

window.onload = function() {
    var extensionPath = getExtensionRootPath();

    // ЦЕПОЧКА ЗАГРУЗКИ JSX
    loadHostModules([
        "response.jsx",
        "config.jsx",
        "logger.jsx",
        "run_registry.jsx",
        "diagnostics.jsx",
        "utils.jsx",
        "cleanup.jsx",
        "subtitles.jsx",
        "auto_timing.jsx",
        "branding.jsx",
        "json_import.jsx",
        "word_import.jsx",
        "speakers.jsx",
        "job_runner.jsx"
    ], function () {
        console.log("Все системы AE готовы");
        if (typeof loadTopicOptionsFromConfig === "function") {
            loadTopicOptionsFromConfig();
        }
    });

    function _safeInit(fnName) {
        try {
            var fn = window[fnName];
            if (typeof fn === "function") {
                fn();
                return true;
            }
            console.warn("Init missing: " + fnName);
            return false;
        } catch (e) {
            console.error("Init failed: " + fnName, e);
            try {
                uiAlert("UI init failed: " + fnName + "\n" + (e && e.message ? e.message : e));
            } catch (e2) {}
            return false;
        }
    }

    _safeInit("initTabs");
    _safeInit("initTopicDropdown");
    _safeInit("initSpeakersDbUI");
    _safeInit("initSpeakersUI");
    _safeInit("initSubtitlesUI");

    var okAuto = _safeInit("initAutoTimingUI");
    if (!okAuto && document.getElementById("btn-export-blocks")) {
        uiAlert("Auto Timing UI is not initialized.\n\n" +
            "Make sure this file exists in the plugin folder:\n" +
            "client/js/ui_auto_timing.js\n\n" +
            "Then press Reload.");
    }

    _safeInit("initTypographyUI");
    _safeInit("initBrandingUI");
    _safeInit("initJsonImportUI");
    _safeInit("initSettingsUI");
    _safeInit("initDiagnosticsUI");

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
