// ui_branding.js
// Branding helpers (head/topic/geotag)

function runCreateBrandingWorkflow() {
    var headEl = document.getElementById("input-head-title");
    var topicEl = document.getElementById("input-head-topic");
    var geoEl = document.getElementById("input-geotag");

    var head = headEl ? headEl.value : "";
    var topic = topicEl ? topicEl.value : "";
    var geo = geoEl ? geoEl.value : "";
    var hasHead = String(head || "").replace(/^\s+|\s+$/g, "").length > 0;
    var hasTopic = String(topic || "").replace(/^\s+|\s+$/g, "").length > 0;
    var hasGeo = String(geo || "").replace(/^\s+|\s+$/g, "").length > 0;

    // 1) GEOTAG(S)
    var pendingGeo = [];
    if (typeof jsonImportConsumeBrandingGeotags === "function") {
        pendingGeo = jsonImportConsumeBrandingGeotags() || [];
    }

    function _runHost(cmd, logTag) {
        return CPHostAPI.call("", [], { module: "branding", rawScript: cmd, timeoutMs: 20000 }).then(function (out) {
            if (!out || !out.ok) {
                var err = out && out.error ? String(out.error) : "Unknown error";
                throw new Error(err);
            }
            if (logTag) logUi(logTag);
            return out;
        });
    }

    var chain = Promise.resolve();
    var createdGeotags = [];
    var parsedMode = pendingGeo.length > 0;

    if (parsedMode) {
        var cmdGeoList = "createGeotagsAtTimes(" + JSON.stringify(pendingGeo) + ")";
        chain = chain.then(function () { return _runHost(cmdGeoList, "createGeotagsAtTimes"); }).then(function (out) {
            var r = out && out.result ? out.result : null;
            if (r && r.created && r.created.length) createdGeotags = r.created;
            return out;
        });
    } else if (hasGeo) {
        var cmdGeo = "createGeotag(" + JSON.stringify(geo) + ")";
        chain = chain.then(function () { return _runHost(cmdGeo, "createGeotag"); }).then(function (out) {
            var r = out && out.result ? out.result : null;
            if (r && r.created && r.created.length) createdGeotags = r.created;
            return out;
        });
    }

    // 2) HEAD_TOPIC
    if (parsedMode) {
        if (hasHead || hasTopic) {
            chain = chain.then(function () {
                var cmdHeadParsed = "applyHeadTopicToRegular(" + JSON.stringify(head) + "," + JSON.stringify(topic) + "," + JSON.stringify(createdGeotags) + ")";
                return _runHost(cmdHeadParsed, "applyHeadTopicToRegular(parsed)");
            });
        }
    } else {
        // Manual mode:
        // - head+topic+geotag: full chain (first head_topic from geotag).
        // - geotag only: only geotag creation.
        // - head+topic without geotag: keep old behavior.
        var runHeadTopic = false;
        var passGeotagsToHeadTopic = false;

        if (hasHead && hasTopic && hasGeo) {
            runHeadTopic = true;
            passGeotagsToHeadTopic = true;
        } else if (!hasGeo && (hasHead || hasTopic)) {
            runHeadTopic = true;
        } else {
            runHeadTopic = false;
        }

        if (runHeadTopic) {
            chain = chain.then(function () {
                var cmdHeadManual = passGeotagsToHeadTopic
                    ? ("applyHeadTopicToRegular(" + JSON.stringify(head) + "," + JSON.stringify(topic) + "," + JSON.stringify(createdGeotags) + ")")
                    : ("applyHeadTopicToRegular(" + JSON.stringify(head) + "," + JSON.stringify(topic) + ")");
                return _runHost(cmdHeadManual, "applyHeadTopicToRegular(manual)");
            });
        }
    }

    // Recompute subtitle_BG after all branding layers are placed.
    // Keep a raw-script fallback to avoid silent regressions if named host calls break.
    chain = chain.then(function () {
        return CPHostAPI.call("refreshSubtitleBgForActiveComp", [true], { module: "branding", timeoutMs: 15000 });
    }).then(function (bgOut) {
        if (bgOut && bgOut.ok) {
            var bgRes = bgOut.result || {};
            if (bgRes && bgRes.skipped) {
                logUi("refreshSubtitleBgForActiveComp:skipped");
            } else {
                logUi("refreshSubtitleBgForActiveComp");
            }
            return { ok: true, source: "named-call" };
        }

        var bgErr = bgOut && bgOut.error ? String(bgOut.error) : "Unknown error";
        logUiError("branding.subtitleBg", bgErr);
        return _runHost("refreshSubtitleBgForActiveComp(true)", "refreshSubtitleBgForActiveComp(raw-fallback)").then(function () {
            return { ok: true, source: "raw-fallback", warning: bgErr };
        });
    });
    return chain;
}

function initBrandingUI() {
    attachClick("btn-create-branding", function () {
        runCreateBrandingWorkflow().catch(function (e) {
            var msg = e && e.message ? e.message : String(e);
            uiAlert("Create Branding error.\n" + msg);
            logUiError("branding.create", msg);
        });
    });
}
