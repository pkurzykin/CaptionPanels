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
        var m = String(msg || "");
        if (!m) m = "Unknown error";
        return "{\"ok\":false,\"result\":\"\",\"error\":\"" + _escapeString(m) + "\"}";
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
            out += "{\"text\":\"" + _escapeString(g.text) + "\",\"time\":" + (Number(g.time) || 0) +
                ",\"pin\":\"" + _escapeString(g.pin || "") + "\"" +
                ",\"anchorLayer\":\"" + _escapeString(g.anchorLayer || "") + "\"" +
                ",\"anchorType\":\"" + _escapeString(g.anchorType || "") + "\"" +
                ",\"anchorBatch\":" + (Number(g.anchorBatch) || 0) + "}";
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

    function _formatSchemaErrors(report) {
        if (!report || !(report.errors instanceof Array) || report.errors.length === 0) return "";
        var lines = [];
        var limit = 8;
        for (var i = 0; i < report.errors.length && i < limit; i++) {
            lines.push("- " + String(report.errors[i] || ""));
        }
        if (report.errors.length > limit) lines.push("- ...");
        return lines.join("\n");
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

    function _isSubtitleLayerName(name) {
        var n = String(name || "");
        return (n.indexOf("Sub_VOICEOVER_") === 0 || n.indexOf("Sub_SYNCH_") === 0);
    }

    function _findFirstSubtitleStart(comp) {
        var best = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !_isSubtitleLayerName(l.name)) continue;
            var st = Number(l.inPoint);
            if (isNaN(st)) continue;
            if (best === null || st < best) best = st;
        }
        return best;
    }

    function _removeSubtitleLayers(comp) {
        for (var i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (!l || !_isSubtitleLayerName(l.name)) continue;
            try { l.remove(); } catch (e) {}
        }
    }

    function _predictFirstGeneratedLayerName(comp, isItalic) {
        var typeUpper = isItalic ? "SYNCH" : "VOICEOVER";
        var batch = 0;
        try {
            if (typeof _nextSubtitleBatchIndex === "function") {
                batch = Number(_nextSubtitleBatchIndex(comp, typeUpper)) || 0;
            }
        } catch (e) {
            batch = 0;
        }
        if (batch <= 0) return "";
        return "Sub_" + typeUpper + "_" + batch + "_1";
    }

    function _parseAnchorMetaFromLayerName(name) {
        var s = String(name || "");
        var m = s.match(/^Sub_(VOICEOVER|SYNCH)_(\d+)_/i);
        if (!m) return { type: "", batch: 0 };
        var typeUpper = String(m[1] || "").toUpperCase();
        var batch = parseInt(m[2], 10);
        if (isNaN(batch) || batch <= 0) batch = 0;
        return { type: typeUpper, batch: batch };
    }

    function _hasFutureVoiceoverBeforeNextGeotag(segments, fromIndex) {
        var arr = segments || [];
        for (var i = fromIndex + 1; i < arr.length; i++) {
            var seg = arr[i] || {};
            var t = _toLower(seg.type);
            if (!t) continue;
            if (t === "geotag") return false;
            if (t === "voiceover") return true;
        }
        return false;
    }

    importJsonFromDialog = function () {
        var file = File.openDialog("Выберите JSON", "*.json");
        if (!file) return _jsonErr("CANCELLED");
        return importJsonFromFile(file.fsName);
    };

    // Rebuild subtitles from an already generated JSON:
    // - keeps timeline anchor at the first existing subtitle start (if present),
    // - removes current subtitle layers,
    // - re-runs standard importJsonFromFile pipeline.
    rebuildSubtitlesFromJsonFile = function (path) {
        try {
            if (!app || !app.project) return _jsonErr("No active project");
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return _jsonErr("No active comp");

            var p = String(path || "");
            if (!p) return _jsonErr("Empty JSON path");
            var f = new File(p);
            if (!f.exists) return _jsonErr("JSON not found: " + p);

            var anchor = _findFirstSubtitleStart(comp);
            if (anchor === null) anchor = Number(comp.time) || 0;

            app.beginUndoGroup("Rebuild Subtitles From JSON");
            _removeSubtitleLayers(comp);
            comp.time = anchor;
            app.endUndoGroup();

            return importJsonFromFile(p);
        } catch (e) {
            try { app.endUndoGroup(); } catch (e2) {}
            var msg = "";
            try {
                msg = (e && (e.message || e.description)) ? (e.message || e.description) : String(e);
            } catch (e3) {
                msg = "Unknown error";
            }
            if (!msg) msg = "Unknown error";
            return _jsonErr(msg);
        }
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

            if (typeof cpValidateImportPayload === "function") {
                var schemaReport = cpValidateImportPayload(data);
                if (schemaReport && schemaReport.ok === false) {
                    var details = _formatSchemaErrors(schemaReport);
                    var errMsg = "Import JSON schema validation failed.";
                    if (details) errMsg += "\n" + details;
                    return _jsonErr(errMsg);
                }
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
            var pendingGeotags = [];
            for (var i = 0; i < segments.length; i++) {
                var seg = segments[i] || {};
                var t = _toLower(seg.type);
                if (!t) continue;

                if (t === "geotag") {
                    var g = {
                        text: _cleanGeotagText(seg.text || ""),
                        time: comp.time,
                        pin: seg.pin || "",
                        anchorLayer: ""
                    };
                    if (String(g.pin || "").toLowerCase() === "start") {
                        geotags.push(g);
                    } else {
                        pendingGeotags.push(g);
                    }
                    continue;
                }

                if (t === "voiceover" || _isSyncType(t)) {
                    var italic = _isSyncType(t);
                    var anchorLayer = _predictFirstGeneratedLayerName(comp, italic);
                    var attachPendingNow = false;
                    if (!italic) {
                        // Prefer anchoring geotag to the next VO block.
                        attachPendingNow = true;
                    } else {
                        // For SYNCH, only attach if there is no VO before the next geotag.
                        attachPendingNow = !_hasFutureVoiceoverBeforeNextGeotag(segments, i);
                    }

                    if (pendingGeotags.length > 0 && attachPendingNow) {
                        for (var pg = 0; pg < pendingGeotags.length; pg++) {
                            var gg = pendingGeotags[pg];
                            if (anchorLayer) {
                                gg.anchorLayer = anchorLayer;
                                var am = _parseAnchorMetaFromLayerName(anchorLayer);
                                gg.anchorType = am.type;
                                gg.anchorBatch = am.batch;
                            }
                            geotags.push(gg);
                        }
                        pendingGeotags = [];
                    }
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

            if (pendingGeotags.length > 0) {
                for (var pg2 = 0; pg2 < pendingGeotags.length; pg2++) geotags.push(pendingGeotags[pg2]);
                pendingGeotags = [];
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
            // Some ExtendScript/AE exceptions don"t populate .message (or can even be strings).
            // Make sure we always return something useful to the UI.
            var msg = "";
            try {
                msg = (e && (e.message || e.description)) ? (e.message || e.description) : String(e);
            } catch (e2) {
                msg = "Unknown error";
            }
            if (!msg) msg = "Unknown error";
            return _jsonErr(msg);
        }
    };
})();
