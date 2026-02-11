// ui_import.js
// JSON import UI + speakers queue

var JSON_IMPORT_QUEUE = [];
var JSON_IMPORT_INDEX = 0;
var JSON_IMPORT_ACTIVE = false;
var JSON_IMPORT_SOURCE = "";
var JSON_IMPORT_BRANDING = null; // { head, topic, geotags[] }

function _setSpeakerFields(name, job, opts) {
    var nameEl = document.getElementById("input-name");
    var jobEl = document.getElementById("input-job");
    var nameVal = (typeof formatSpeakerNameForInput === "function") ? formatSpeakerNameForInput(name) : String(name || "");
    if (nameEl) nameEl.value = String(nameVal || "");
    if (jobEl) jobEl.value = String(job || "");

    if (typeof updateAddSpeakerBtnState === "function") {
        updateAddSpeakerBtnState();
    }
    if (typeof tryAutoFillSpeakerFromDb === "function") {
        tryAutoFillSpeakerFromDb();
    }
    if (!opts || !opts.noPreview) {
        if (typeof safeTriggerSpeakerPreview === "function") {
            safeTriggerSpeakerPreview();
        } else if (typeof triggerSpeakerPreview === "function") {
            triggerSpeakerPreview();
        }
    }
}

function _clearSpeakerFields(noPreview) {
    _setSpeakerFields("", "", { noPreview: !!noPreview });
    var sideLeft = document.getElementById("side-left");
    if (sideLeft) sideLeft.checked = true;
    var sizeDef = document.getElementById("size-def");
    if (sizeDef) sizeDef.checked = true;
    var bgSliderEl = document.getElementById("bg-slider");
    var bgValEl = document.getElementById("bg-val");
    if (bgSliderEl) bgSliderEl.value = 0;
    if (bgValEl) bgValEl.textContent = "0";
}

function jsonImportIsActive() {
    return JSON_IMPORT_ACTIVE && JSON_IMPORT_QUEUE.length > 0;
}

function jsonImportGetBranding() {
    return JSON_IMPORT_BRANDING;
}

function jsonImportClearBranding() {
    JSON_IMPORT_BRANDING = null;
}

function jsonImportConsumeBrandingGeotags() {
    if (!JSON_IMPORT_BRANDING || !JSON_IMPORT_BRANDING.geotags) return [];
    var list = JSON_IMPORT_BRANDING.geotags;
    JSON_IMPORT_BRANDING.geotags = [];
    return list || [];
}

function jsonImportSetQueue(list, sourcePath) {
    JSON_IMPORT_QUEUE = list || [];
    JSON_IMPORT_INDEX = 0;
    JSON_IMPORT_ACTIVE = JSON_IMPORT_QUEUE.length > 0;
    JSON_IMPORT_SOURCE = sourcePath || "";

    // Do not auto-create the first speaker preview after import.
    // The user will explicitly start the titles flow via the "Load Speaker" button in the Speaker Titles tab.
    if (JSON_IMPORT_ACTIVE) {
        _clearSpeakerFields(true);
        try { csInterface.evalScript("removePreview()"); } catch (ePrev) {}
    }
}


function jsonImportLoadCurrentSpeakerForTitles() {
    if (!jsonImportIsActive()) {
        uiAlert("No speakers in queue. Import Word/JSON first.");
        return false;
    }

    // Reset UI controls first (no preview), then fill and preview.
    _clearSpeakerFields(true);

    var cur = JSON_IMPORT_QUEUE[JSON_IMPORT_INDEX] || {};
    _setSpeakerFields(cur.name || "", cur.job || "");
    return true;
}

function jsonImportAdvanceAfterCreate() {
    if (!jsonImportIsActive()) return false;

    JSON_IMPORT_INDEX++;
    if (JSON_IMPORT_INDEX >= JSON_IMPORT_QUEUE.length) {
        JSON_IMPORT_ACTIVE = false;
        JSON_IMPORT_QUEUE = [];
        JSON_IMPORT_INDEX = 0;
        _clearSpeakerFields(true);
        csInterface.evalScript("removePreview()");
        return true;
    }

    var next = JSON_IMPORT_QUEUE[JSON_IMPORT_INDEX] || {};
    _setSpeakerFields(next.name || "", next.job || "");
    return true;
}

function _setBrandingFields(head, topic, geotag) {
    var headEl = document.getElementById("input-head-title");
    var topicEl = document.getElementById("input-head-topic");
    var geoEl = document.getElementById("input-geotag");
    if (headEl) headEl.value = String(head || "");
    if (topicEl) topicEl.value = String(topic || "");
    if (geoEl && typeof geotag !== "undefined") geoEl.value = String(geotag || "");
}

function jsonImportSetBranding(branding) {
    JSON_IMPORT_BRANDING = branding || null;
    if (!branding) return;

    var head = branding.head || "";
    var topic = branding.topic || "";
    var geos = branding.geotags || [];
    var firstGeo = geos.length > 0 ? geos[0].text : "";
    _setBrandingFields(head, topic, firstGeo);
}

function _formatImportSummary(res) {
    var c = (res && res.counts) ? res.counts : {};
    var msg = "JSON импортирован.";
    msg += "\nБлоков: " + (c.blocks || 0);
    msg += "\nVoiceover: " + (c.voiceover || 0);
    msg += "\nSynch: " + (c.synch || 0);
    msg += "\nСпикеров: " + (c.speakers || 0);
    if ((c.speakers || 0) > 0) msg += "\nТитры: откройте Speaker Titles и нажмите Load Speaker";
    if (JSON_IMPORT_SOURCE) {
        msg += "\nФайл: " + JSON_IMPORT_SOURCE;
    }
    return msg;
}

function initJsonImportUI() {
    attachClick("btn-load-json", function () {
        aeCall("importJsonFromDialog()", function (out) {
            if (!out || !out.ok) {
                var err = out && out.error ? out.error : "Unknown error";
                if (String(err) === "CANCELLED") return;
                uiAlert("Ошибка импорта JSON.\n" + err);
                logUiError("json.import", err);
                return;
            }

            var res = out.result || {};
            var list = (res && res.speakers && res.speakers.length) ? res.speakers : [];
            jsonImportSetQueue(list, res.source || "");
            if (res.branding) {
                jsonImportSetBranding(res.branding);
            }
            uiAlert(_formatImportSummary(res));
            logUi("json.import ok");
        });
    });


    attachClick("btn-load-word", function () {
        aeCall("importWordFromDialog()", function (out) {
            if (!out || !out.ok) {
                var err = (out && typeof out.error !== 'undefined') ? String(out.error) : '';
                if (String(err) === 'CANCELLED') return;

                // If AE returned an empty/whitespace error, show debug payload so we can diagnose.
                if (!err || !err.replace(/\s+/g, '')) {
                    try {
                        err = 'Unknown error\n\nDEBUG(out): ' + JSON.stringify(out);
                    } catch (eDbg) {
                        err = 'Unknown error';
                    }
                }

                uiAlert("Ошибка импорта Word (.docx).\n" + err);
                logUiError("word.import", err);
                return;
            }

            var res = out.result || {};
            var list = (res && res.speakers && res.speakers.length) ? res.speakers : [];
            jsonImportSetQueue(list, res.source || "");
            if (res.branding) {
                jsonImportSetBranding(res.branding);
            }
            uiAlert(_formatImportSummary(res));
            logUi("word.import ok");
        });
    });

    var geoEl = document.getElementById("input-geotag");
    if (geoEl) {
        geoEl.addEventListener("input", function () {
            if (JSON_IMPORT_BRANDING && JSON_IMPORT_BRANDING.geotags && JSON_IMPORT_BRANDING.geotags.length) {
                JSON_IMPORT_BRANDING.geotags = [];
            }
        });
    }
}
