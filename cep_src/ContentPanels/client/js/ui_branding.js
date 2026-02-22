// ui_branding.js
// Branding helpers (head/topic/geotag)

function initBrandingUI() {
    attachClick("btn-create-branding", function () {
        var headEl = document.getElementById("input-head-title");
        var topicEl = document.getElementById("input-head-topic");
        var geoEl = document.getElementById("input-geotag");

        var head = headEl ? headEl.value : "";
        var topic = topicEl ? topicEl.value : "";
        var geo = geoEl ? geoEl.value : "";

        // 1) GEOTAG(S)
        var pendingGeo = [];
        if (typeof jsonImportConsumeBrandingGeotags === "function") {
            pendingGeo = jsonImportConsumeBrandingGeotags() || [];
        }

        function _runHost(cmd, logTag) {
            return callHost("", [], { module: "branding", rawScript: cmd, timeoutMs: 20000 }).then(function (out) {
                if (!out || !out.ok) {
                    var err = out && out.error ? String(out.error) : "Unknown error";
                    throw new Error(err);
                }
                if (logTag) logUi(logTag);
                return out;
            });
        }

        var chain = Promise.resolve();

        if (pendingGeo.length > 0) {
            var cmdGeoList = "createGeotagsAtTimes(" + JSON.stringify(pendingGeo) + ")";
            chain = chain.then(function () { return _runHost(cmdGeoList, "createGeotagsAtTimes"); });
        } else if (geo) {
            var cmdGeo = "createGeotag(" + JSON.stringify(geo) + ")";
            chain = chain.then(function () { return _runHost(cmdGeo, "createGeotag"); });
        }

        // 2) HEAD_TOPIC
        if (head || topic) {
            var cmdHead = "applyHeadTopicToRegular(" + JSON.stringify(head) + "," + JSON.stringify(topic) + ")";
            chain = chain.then(function () { return _runHost(cmdHead, "applyHeadTopicToRegular"); });
        }

        // Recompute subtitle_BG after all branding layers are placed.
        // Keep a raw-script fallback to avoid silent regressions if named host calls break.
        chain = chain.then(function () {
            return callHost("refreshSubtitleBgForActiveComp", [], { module: "branding", timeoutMs: 15000 });
        }).then(function (bgOut) {
            if (bgOut && bgOut.ok) {
                logUi("refreshSubtitleBgForActiveComp");
                return;
            }

            var bgErr = bgOut && bgOut.error ? String(bgOut.error) : "Unknown error";
            logUiError("branding.subtitleBg", bgErr);
            return _runHost("refreshSubtitleBgForActiveComp()", "refreshSubtitleBgForActiveComp(raw-fallback)");
        }).catch(function (e) {
            var msg = e && e.message ? e.message : String(e);
            uiAlert("Create Branding error.\n" + msg);
            logUiError("branding.create", msg);
        });
    });
}
