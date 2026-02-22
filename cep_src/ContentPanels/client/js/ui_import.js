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
    var solo = document.getElementById("chk-solo-title");
    if (solo) solo.checked = false;
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

    // Reset controls to defaults before loading the next speaker in queue.
    _clearSpeakerFields(true);

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

function _normalizeImportResult(result) {
    var r = result;

    // Some bridge paths return result as JSON string.
    if (typeof r === "string") {
        var t = r.trim();
        if (t && t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
        if (t && t[0] === "{") {
            try { r = JSON.parse(t); } catch (e1) {}
        }
    }

    // Some bridge paths return { ok, result: "<json>" } as nested payload.
    if (r && typeof r === "object" && typeof r.result === "string") {
        var t2 = String(r.result || "").trim();
        if (t2 && t2.charCodeAt(0) === 0xFEFF) t2 = t2.slice(1);
        if (t2 && t2[0] === "{") {
            try { r = JSON.parse(t2); } catch (e2) {}
        }
    }

    if (!r || typeof r !== "object") return {};
    return r;
}

function _resolveBrandingFromImportResult(res) {
    if (!res || typeof res !== "object") return null;

    var b = res.branding || null;
    if (b && (b.head || b.topic || (b.geotags && b.geotags.length))) return b;

    // Fallback: derive from raw script json shape { meta, segments }.
    var meta = res.meta || null;
    var segs = res.segments || [];
    if (!meta && res.result && typeof res.result === "object") {
        meta = res.result.meta || null;
        if ((!segs || !segs.length) && res.result.segments) segs = res.result.segments;
    }

    var head = "";
    var topic = "";
    if (meta && typeof meta === "object") {
        head = meta.title || meta.head || "";
        topic = meta.rubric || meta.topic || "";
    }

    var geotags = [];
    if (segs && segs.length) {
        for (var i = 0; i < segs.length; i++) {
            var s = segs[i] || {};
            var t = String(s.type || "").toLowerCase();
            if (t !== "geotag") continue;
            geotags.push({ text: String(s.text || ""), time: Number(s.time || 0) || 0 });
        }
    }

    if (head || topic || geotags.length) {
        return { head: head, topic: topic, geotags: geotags };
    }

    return b;
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

function _startWordImportProgress(title) {
    var t0 = Date.now();
    var dots = 0;
    showTaskProgress(String(title || "Load Word"), "Starting import...");
    updateTaskProgress(5, "Starting import...");

    var timer = setInterval(function () {
        var sec = (Date.now() - t0) / 1000.0;
        var pct = 5;
        var caption = "Preparing import...";

        if (sec < 3) {
            pct = 5 + sec * 8; // 5..29
            caption = "Converting DOCX to JSON...";
        } else if (sec < 8) {
            pct = 29 + (sec - 3) * 8; // 29..69
            caption = "Converting DOCX to JSON...";
        } else if (sec < 14) {
            pct = 69 + (sec - 8) * 3.5; // 69..90
            caption = "Importing JSON into project...";
        } else {
            pct = 90;
            dots = (dots + 1) % 4;
            caption = "Finalizing" + Array(dots + 1).join(".");
        }

        if (pct > 92) pct = 92;
        updateTaskProgress(pct, caption);
    }, 400);

    return function (ok) {
        clearInterval(timer);
        if (ok) {
            updateTaskProgress(100, "Done.");
            setTimeout(function () { hideTaskProgress(); }, 200);
        } else {
            hideTaskProgress();
        }
    };
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

            var res = _normalizeImportResult(out.result);
            var list = (res && res.speakers && res.speakers.length) ? res.speakers : [];
            jsonImportSetQueue(list, res.source || "");
            var branding = _resolveBrandingFromImportResult(res);
            if (branding) {
                jsonImportSetBranding(branding);
            }
            uiAlert(_formatImportSummary(res));
            logUi("json.import ok");
        });
    });

    attachClick("btn-rebuild-subs", function () {
        if (!JSON_IMPORT_SOURCE) {
            uiAlert("No source JSON found.\nLoad Word/JSON first.");
            return;
        }

        var stopProgress = _startWordImportProgress("Rebuild Subtitles");
        callHost("rebuildSubtitlesFromJsonFile", [String(JSON_IMPORT_SOURCE)], { module: "import" }, function (out) {
            if (!out || !out.ok) {
                try { stopProgress(false); } catch (ePr0) {}
                var err = (out && typeof out.error !== "undefined") ? String(out.error) : "";
                if (!err || !err.replace(/\s+/g, "")) err = "Unknown error";
                uiAlert("Rebuild Subtitles failed.\n" + err);
                logUiError("subs.rebuild", err);
                return;
            }

            try { stopProgress(true); } catch (ePr1) {}
            var res = _normalizeImportResult(out.result);
            var list = (res && res.speakers && res.speakers.length) ? res.speakers : [];
            jsonImportSetQueue(list, res.source || JSON_IMPORT_SOURCE || "");
            if (res && res.source) JSON_IMPORT_SOURCE = String(res.source);
            var branding = _resolveBrandingFromImportResult(res);
            if (branding) {
                jsonImportSetBranding(branding);
            }
            uiAlert(_formatImportSummary(res));
            logUi("subs.rebuild ok");
        });
    });


    attachClick("btn-load-word", function () {
        callHost("pickWordFileForImport", [], { module: "import" }, function (pick) {
            if (!pick || !pick.ok) {
                var pickErr = (pick && typeof pick.error !== "undefined") ? String(pick.error) : "";
                if (pickErr === "CANCELLED") return;
                uiAlert("Ошибка выбора Word файла.\n" + (pickErr || "Unknown error"));
                logUiError("word.pick", pickErr || "Unknown error");
                return;
            }

            var pickRes = pick.result || {};
            var pickedPath = "";
            if (typeof pickRes === "string") {
                pickedPath = pickRes;
            } else if (pickRes && typeof pickRes.path === "string") {
                pickedPath = pickRes.path;
            }
            if (!pickedPath) {
                uiAlert("Ошибка выбора Word файла.\nПуть не получен.");
                logUiError("word.pick", "Empty path");
                return;
            }

            // Load Word flow: align work area end to selected/first video layer length.
            // Non-blocking for import; if no video layer, we just log.
            callHost("setWorkAreaEndToVideoLayer", [], { module: "import" }, function (waOut) {
                if (!waOut || !waOut.ok) {
                    var waErr = waOut && waOut.error ? String(waOut.error) : "Unknown error";
                    logUiError("word.workArea", waErr);
                } else {
                    logUi("setWorkAreaEndToVideoLayer");
                }
            });

            var stopProgress = _startWordImportProgress("Load Word");
            callHost("importWordFromFile", [String(pickedPath)], { module: "import" }, function (out) {
                if (!out || !out.ok) {
                    try { stopProgress(false); } catch (ePr0) {}
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

                try { stopProgress(true); } catch (ePr1) {}
                var res = _normalizeImportResult(out.result);
                var list = (res && res.speakers && res.speakers.length) ? res.speakers : [];
                jsonImportSetQueue(list, res.source || "");
                var branding = _resolveBrandingFromImportResult(res);
                if (branding) {
                    jsonImportSetBranding(branding);
                }
                uiAlert(_formatImportSummary(res));
                logUi("word.import ok");
            });
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
