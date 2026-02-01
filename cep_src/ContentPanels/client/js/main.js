// Core helpers are in app_core.js
// Speakers DB helpers are in speakers_db.js

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
    });

    initTabs();
    initTopicDropdown();
    initSpeakersDbUI();
    initSpeakersUI();
    initSubtitlesUI();
    initBrandingUI();

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
};
