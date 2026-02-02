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
    if (nameEl) nameEl.value = String(name || "");
    if (jobEl) jobEl.value = String(job || "");

    if (typeof updateAddSpeakerBtnState === "function") {
        updateAddSpeakerBtnState();
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

    if (JSON_IMPORT_ACTIVE) {
        var first = JSON_IMPORT_QUEUE[0] || {};
        _setSpeakerFields(first.name || "", first.job || "");
    }
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

    var geoEl = document.getElementById("input-geotag");
    if (geoEl) {
        geoEl.addEventListener("input", function () {
            if (JSON_IMPORT_BRANDING && JSON_IMPORT_BRANDING.geotags && JSON_IMPORT_BRANDING.geotags.length) {
                JSON_IMPORT_BRANDING.geotags = [];
            }
        });
    }
}
