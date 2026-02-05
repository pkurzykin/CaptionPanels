// host/lib/json_import.jsx
// =====================================================
// JSON import workflow
// =====================================================

(function () {
    function _escapeString(s) {
        return String(s || "")
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

    function _jsonErr(msg) {
        return "{\"ok\":false,\"result\":\"\",\"error\":\"" + _escapeString(msg) + "\"}";
    }

    function _jsonSpeakersArray(arr) {
        var out = "[";
        for (var i = 0; i < arr.length; i++) {
            var s = arr[i] || {};
            if (i > 0) out += ",";
            out += "{\"name\":\"" + _escapeString(s.name) + "\",\"job\":\"" + _escapeString(s.job) + "\"}";
        }
        out += "]";
        return out;
    }

    function _jsonGeotagsArray(arr) {
        var out = "[";
        for (var i = 0; i < arr.length; i++) {
            var g = arr[i] || {};
            if (i > 0) out += ",";
            out += "{\"text\":\"" + _escapeString(g.text) + "\",\"time\":" + (Number(g.time) || 0) + "}";
        }
        out += "]";
        return out;
    }

    function _jsonOk(path, counts, speakers, branding) {
        var src = _escapeString(path || "");
        var c = counts || {};
        var blocks = (c.blocks || 0);
        var vo = (c.voiceover || 0);
        var sy = (c.synch || 0);
        var sp = (c.speakers || 0);
        var b = branding || {};
        var head = _escapeString(b.head || "");
        var topic = _escapeString(b.topic || "");
        var geos = _jsonGeotagsArray(b.geotags || []);
        return "{\"ok\":true,\"result\":{" +
            "\"source\":\"" + src + "\"," +
            "\"counts\":{\"blocks\":" + blocks + ",\"voiceover\":" + vo + ",\"synch\":" + sy + ",\"speakers\":" + sp + "}," +
            "\"speakers\":" + _jsonSpeakersArray(speakers || []) + "," +
            "\"branding\":{\"head\":\"" + head + "\",\"topic\":\"" + topic + "\",\"geotags\":" + geos + "}" +
        "},\"error\":\"\"}";
    }

    function _readJsonFile(path) {
        var f = new File(path);
        if (!f.exists) throw new Error("File not found: " + path);

        function _parseJsonSafe(str) {
            var s = String(str || "");
            if (s && s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
            if (typeof JSON !== "undefined" && JSON.parse) {
                try {
                    return JSON.parse(s);
                } catch (e) {
                    try { return eval("(" + s + ")"); } catch (e2) { throw e; }
                }
            }
            return eval("(" + s + ")");
        }

        // UTF-8
        f.encoding = "UTF-8";
        if (!f.open("r")) throw new Error("Cannot open file: " + path);
        var txt = f.read();
        f.close();

        try {
            return _parseJsonSafe(txt);
        } catch (e) {
            // try UTF-16
            try {
                f.encoding = "UTF-16";
                if (!f.open("r")) throw e;
                var t2 = f.read();
                f.close();
                return _parseJsonSafe(t2);
            } catch (e2) {
                throw e;
            }
        }
    }

    function _normalizeRoot(obj) {
        if (obj instanceof Array || (obj && obj.content && (obj.content instanceof Array))) {
            return { kind: "legacy" };
        }
        if (obj && obj.segments && (obj.segments instanceof Array)) {
            return {
                kind: "segments",
                meta: obj.meta || {},
                speakers: obj.speakers || [],
                segments: obj.segments || [],
                tech: obj.tech || []
            };
        }
        return { kind: "segments", meta: {}, speakers: [], segments: [], tech: [] };
    }

    function _toLower(s) {
        return String(s || "").toLowerCase();
    }

    function _isSyncType(t) {
        return (t === "sync" || t === "synch");
    }

    function _cleanGeotagText(s) {
        var t = String(s || "");
        t = t.replace(/^\s*(geo|гео)\s*[:：]\s*/i, "");
        t = t.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
        return t;
    }

    function _findFirstMarkerTime(comp, fromTime) {
        if (!comp) return null;
        var minTime = null;
        var bestAfter = null;
        var hasFrom = (typeof fromTime === "number");
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            try {
                var mp = l.property("Marker");
                if (mp && mp.numKeys > 0) {
                    for (var k = 1; k <= mp.numKeys; k++) {
                        var t = mp.keyTime(k);
                        if (minTime === null || t < minTime) minTime = t;
                        if (hasFrom && t >= fromTime && (bestAfter === null || t < bestAfter)) {
                            bestAfter = t;
                        }
                    }
                }
            } catch (e) {}
        }
        if (bestAfter !== null) return bestAfter;
        return minTime;
    }

    importJsonFromDialog = function () {
        var file = File.openDialog("Выберите JSON", "*.json");
        if (!file) return _jsonErr("CANCELLED");
        return importJsonFromFile(file.fsName);
    };

    importJsonFromFile = function (path) {
        try {
            if (!app || !app.project) return _jsonErr("No active project");
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return _jsonErr("No active comp");

            if (typeof generateSubs !== "function") return _jsonErr("generateSubs not available");

            var data = _readJsonFile(path);
            var root = _normalizeRoot(data);
            if (root.kind === "legacy") {
                return _jsonErr("Legacy JSON schema is not supported");
            }

            var startTime = comp.time;
            var speakersQueue = [];
            // De-dupe speakers suggested for title creation. In real projects the same speaker
            // can appear in multiple SYNCH segments, but usually we need the title once.
            var seenSpeakerKeys = {};
            var counts = { blocks: 0, voiceover: 0, synch: 0, speakers: 0 };

            var segments = root.segments || [];
            if (!segments.length) return _jsonErr("Empty segments");

            var spMap = {};
            var spList = root.speakers || [];
            for (var s = 0; s < spList.length; s++) {
                var sp = spList[s] || {};
                if (sp.id) spMap[String(sp.id)] = sp;
            }

            var geotags = [];
            for (var i = 0; i < segments.length; i++) {
                var seg = segments[i] || {};
                var t = _toLower(seg.type);
                if (!t) continue;

                if (t === "geotag") {
                    geotags.push({ text: _cleanGeotagText(seg.text || ""), time: comp.time, pin: seg.pin || "" });
                    continue;
                }

                if (t === "voiceover" || _isSyncType(t)) {
                    var italic = _isSyncType(t);
                    generateSubs(seg.text || "", italic, true);
                    counts.blocks++;
                    if (italic) counts.synch++; else counts.voiceover++;

                    if (italic && seg.speakerId && spMap[String(seg.speakerId)]) {
                        var sObj = spMap[String(seg.speakerId)];
                        var key = "id:" + String(seg.speakerId);
                        if (!seenSpeakerKeys[key]) {
                            seenSpeakerKeys[key] = true;
                            speakersQueue.push({
                                name: sObj.name || "",
                                job: sObj.role || sObj.job || ""
                            });
                            counts.speakers++;
                        }
                    }
                }
            }

            var endTime = comp.time;

            // NOTE (temporary): branding is created manually via UI button
            var head = root.meta && root.meta.title ? root.meta.title : "";
            var topic = root.meta && root.meta.rubric ? root.meta.rubric : "";
            var branding = { head: head, topic: topic, geotags: geotags };

            // move playhead to first speaker marker if present
            var markerTime = _findFirstMarkerTime(comp, startTime);
            if (markerTime !== null) {
                comp.time = markerTime;
            } else {
                comp.time = endTime;
            }
            if (typeof resetSpeakerMarkers === "function") {
                try { resetSpeakerMarkers(); } catch (e) {}
            }

            return _jsonOk(path, counts, speakersQueue, branding);
        } catch (e) {
            return _jsonErr(e.message);
        }
    };
})();
