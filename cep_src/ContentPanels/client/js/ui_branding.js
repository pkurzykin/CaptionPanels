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

        // 1) GEOTAG
        if (geo) {
            var cmdGeo = "createGeotag(" + JSON.stringify(geo) + ")";
            csInterface.evalScript(cmdGeo);
        }

        // 2) HEAD_TOPIC
        if (head || topic) {
            var cmdHead = "applyHeadTopicToRegular(" + JSON.stringify(head) + "," + JSON.stringify(topic) + ")";
            csInterface.evalScript(cmdHead);
        }
    });
}
