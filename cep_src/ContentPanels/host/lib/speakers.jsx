// host/lib/speakers.jsx
// =====================================================
// SPEAKERS: markers + preview + create title
// Exposed globals:
//   updateSpeakerPreview(name, job, side, size, bgOffset)
//   createSpeakerTitle(name, job, side, size, bgOffset)
//   addSpeakerToDb(name, job)
//   removeSpeakerFromDb(name, job)
//   removePreview()
// =====================================================

(function () {

    // ===== Speakers DB location (shared network path) =====
    // Default path (can be overridden via config.json).
    var DEFAULT_SPEAKERS_DB_PATH = "H:/Media/Kurzykin/PROJECT/Titles_Template_NEW2025/work/json/speakers.json";

    // --------- Internal state (persist while AE session is alive) ---------
    var _inited = false;
    var _markerLayer = null;
    var _markers = []; // [{time:Number, comment:String}]
    var _currentIndex = 0;

    var PREVIEW_LAYER_NAME = "__NH_SPEAKER_PREVIEW__";
    var PREVIEW_COMP_NAME  = "__NH_SPEAKER_PREVIEW_COMP__";

    // --------- Utils ---------
    function _ensureActiveComp() {
        var c = app.project.activeItem;
        return (c && (c instanceof CompItem)) ? c : null;
    }

    function _findCompByName(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it.name === name) return it;
        }
        return null;
    }

    function _getNextNumber(prefix) {
        var maxN = 0;
        var re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "_(\\d+)$");
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem) {
                var m = it.name.match(re);
                if (m && m[1]) {
                    var n = parseInt(m[1], 10);
                    if (n > maxN) maxN = n;
                }
            }
        }
        return maxN + 1;
    }

    function _safeSetTextLayer(comp, layerName, text) {
        var lyr = comp.layer(layerName);
        if (lyr && (lyr instanceof TextLayer)) {
            lyr.property("Source Text").setValue(text || "");
            return true;
        }
        return false;
    }

    function _safeSetControl(comp, side, size, bgOffset) {
        var ctrl = comp.layer("Global_Control");
        if (!ctrl) return;

        // side: "Left"/"Right"
        var isRight = (String(side).toLowerCase() === "right") ? 1 : 0;
        // size: "Default"/"Short"
        var useFixed = (String(size).toLowerCase() === "short") ? 1 : 0;

        try { ctrl.effect("isRight")("Checkbox").setValue(isRight); } catch (e) {}
        try { ctrl.effect("BGoffsetX")("Slider").setValue(Number(bgOffset) || 0); } catch (e) {}
        try { ctrl.effect("UseFixedSize")("Checkbox").setValue(useFixed); } catch (e) {}
    }

    function _isItalicSubLayer(layer) {
        if (!layer) return false;
        return (layer.name && layer.name.indexOf("Sub_SYNCH_") === 0);
    }

    function _collectItalicGroups(comp) {
        var arr = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (_isItalicSubLayer(l)) {
                arr.push({ start: l.inPoint, end: l.outPoint });
            }
        }
        if (arr.length === 0) return [];

        arr.sort(function (a, b) {
            return (a.start === b.start) ? (a.end - b.end) : (a.start - b.start);
        });

        var EPS = 1.0 / 60.0;
        var groups = [];
        var curStart = arr[0].start;
        var curEnd = arr[0].end;

        for (var k = 1; k < arr.length; k++) {
            var s = arr[k].start;
            var e = arr[k].end;
            if (s <= curEnd + EPS) {
                if (e > curEnd) curEnd = e;
            } else {
                groups.push({ start: curStart, end: curEnd });
                curStart = s;
                curEnd = e;
            }
        }
        groups.push({ start: curStart, end: curEnd });
        return groups;
    }

    function _findItalicGroupForTime(comp, t) {
        var groups = _collectItalicGroups(comp);
        for (var i = 0; i < groups.length; i++) {
            if (t >= groups[i].start - 0.0001 && t <= groups[i].end + 0.0001) return groups[i];
        }
        return null;
    }

    function _findLastItalicLayerInRange(comp, startT, endT) {
        var last = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!_isItalicSubLayer(l)) continue;
            if (l.outPoint <= startT || l.inPoint >= endT) continue;
            if (!last || l.index > last.index) last = l;
        }
        return last;
    }

    function _parseCommentToNameJob(comment) {
        if (!comment) return { name: "", job: "" };
        var lines = String(comment).split(/\r\n|\n|\r/);
        return {
            name: lines[0] ? lines[0] : "",
            job:  lines[1] ? lines[1] : ""
        };
    }

    function _initIfNeeded(comp) {
        if (_inited) return;

        _markerLayer = null;
        _markers = [];
        _currentIndex = 0;

        // Find first layer with markers (you said markers are on a layer)
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            try {
                var mp = l.property("Marker");
                if (mp && mp.numKeys > 0) {
                    _markerLayer = l;
                    break;
                }
            } catch (e) {}
        }

        if (!_markerLayer) {
            // No markers — still allow manual preview/create at playhead,
            // but marker workflow will be disabled.
            _inited = true;
            return;
        }

        var markerProp = _markerLayer.property("Marker");
        for (var k = 1; k <= markerProp.numKeys; k++) {
            var v = markerProp.keyValue(k);
            _markers.push({
                time: markerProp.keyTime(k),
                comment: (v && v.comment) ? v.comment : ""
            });
        }

        // Start from the marker at/after current time
        var t = comp.time;
        var idx = 0;
        for (var m = 0; m < _markers.length; m++) {
            if (_markers[m].time >= t - 0.0001) { idx = m; break; }
            idx = m; // fallback last
        }
        _currentIndex = idx;

        _inited = true;
    }

    function _getCurrentMarkerTime(comp) {
        if (_markerLayer && _markers.length > 0 && _markers[_currentIndex]) {
            return _markers[_currentIndex].time;
        }
        return comp.time;
    }

    function _removePreviewInternal(comp) {
        // remove preview layer if exists
        for (var i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (l && l.name === PREVIEW_LAYER_NAME) {
                try { l.remove(); } catch (e) {}
            }
        }

        // remove preview comp if exists
        var pc = _findCompByName(PREVIEW_COMP_NAME);
        if (pc) {
            try { pc.remove(); } catch (e) {}
        }
    }

    function _ensureTemplate() {
        return _findCompByName("name_job_title_LR");
    }

    function _json(obj) {
        // ExtendScript JSON is usually available; fallback to simple manual
        try { return JSON.stringify(obj); } catch (e) {}
        var s = "{";
        var first = true;
        for (var k in obj) {
            if (!obj.hasOwnProperty(k)) continue;
            if (!first) s += ",";
            first = false;
            s += "\"" + k + "\":\"" + String(obj[k]).replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"";
        }
        s += "}";
        return s;
    }

    function _normalizeSpeakerText(txt) {
        return String(txt || "").replace(/\r\n|\r/g, "\n").replace(/^\s+|\s+$/g, "");
    }

    function _parseJsonSafe(str) {
        var s = String(str || "");
        // strip UTF-8 BOM if present
        if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
        if (typeof JSON !== "undefined" && JSON.parse) {
            return JSON.parse(s);
        }
        return eval("(" + s + ")");
    }

    function _stringifyJsonSafe(arr) {
        if (typeof JSON !== "undefined" && JSON.stringify) {
            return JSON.stringify(arr, null, 4);
        }
        // simple manual stringify for array of {name, job}
        var out = "[\n";
        for (var i = 0; i < arr.length; i++) {
            var s = arr[i] || {};
            if (i > 0) out += ",\n";
            var n = String(s.name || "")
                .replace(/\\/g, "\\\\")
                .replace(/"/g, "\\\"")
                .replace(/\r/g, "\\r")
                .replace(/\n/g, "\\n");
            var j = String(s.job || "")
                .replace(/\\/g, "\\\\")
                .replace(/"/g, "\\\"")
                .replace(/\r/g, "\\r")
                .replace(/\n/g, "\\n");
            out += "    {\"name\":\"" + n + "\",\"job\":\"" + j + "\"}";
        }
        out += "\n]";
        return out;
    }

    function _resolveSpeakersPath() {
        try {
            if (typeof getSpeakersDbPath === "function") {
                var p = getSpeakersDbPath();
                if (p) return p;
            }
        } catch (e) {}
        return DEFAULT_SPEAKERS_DB_PATH;
    }

    function _getSpeakersDbFile() {
        var path = _resolveSpeakersPath();
        if (!path) return null;
        return new File(path);
    }

    getSpeakersDbJson = function () {
        var f = _getSpeakersDbFile();
        if (!f) return "Error: No data folder";
        if (!f.exists) return "[]";
        try {
            f.encoding = "UTF-8";
            f.open("r");
            var content = f.read();
            f.close();
            return content || "[]";
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            try { if (typeof logError === "function") logError("speakers.getJson", e.message); } catch (e3) {}
            return "Error: " + e.message;
        }
    };

    // =====================================================
    // PUBLIC GLOBALS (called from CEP via evalScript)
    // =====================================================

    // Add speaker to speakers.json with duplicate check
    addSpeakerToDb = function (name, job) {
        var f = null;
        try {
            f = _getSpeakersDbFile();
            if (!f) return "Error";

            var arr = [];
            if (f.exists) {
                f.encoding = "UTF-8";
                f.open("r");
                var content = f.read();
                f.close();
                try { arr = _parseJsonSafe(content) || []; } catch (e) { return "Error: JSON parse"; }
            }

            var n = _normalizeSpeakerText(name);
            var j = _normalizeSpeakerText(job);
            for (var i = 0; i < arr.length; i++) {
                var s = arr[i] || {};
                if (_normalizeSpeakerText(s.name) === n && _normalizeSpeakerText(s.job) === j) {
                    return "DUPLICATE";
                }
            }

            arr.push({ name: name || "", job: job || "" });

            f.encoding = "UTF-8";
            f.lineFeed = "Unix";
            f.open("w");
            f.write(_stringifyJsonSafe(arr));
            f.close();
            return "OK";
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            try { if (typeof logError === "function") logError("speakers.add", e.message); } catch (e3) {}
            return "Error: " + e.message;
        }
    };

    removeSpeakerFromDb = function (name, job) {
        var f = null;
        try {
            f = _getSpeakersDbFile();
            if (!f) return "Error";
            if (!f.exists) return "NOT_FOUND";

            f.encoding = "UTF-8";
            f.open("r");
            var content = f.read();
            f.close();

            var arr = _parseJsonSafe(content) || [];
            var n = _normalizeSpeakerText(name);
            var j = _normalizeSpeakerText(job);
            var idx = -1;
            for (var i = 0; i < arr.length; i++) {
                var s = arr[i] || {};
                if (_normalizeSpeakerText(s.name) === n && _normalizeSpeakerText(s.job) === j) {
                    idx = i;
                    break;
                }
            }
            if (idx === -1) return "NOT_FOUND";

            arr.splice(idx, 1);
            f.encoding = "UTF-8";
            f.lineFeed = "Unix";
            f.open("w");
            f.write(_stringifyJsonSafe(arr));
            f.close();
            return "OK";
        } catch (e) {
            try { if (f && f.opened) f.close(); } catch (e2) {}
            try { if (typeof logError === "function") logError("speakers.remove", e.message); } catch (e3) {}
            return "Error: " + e.message;
        }
    };

    // Remove preview (called from "Clear fields" too)
    removePreview = function () {
        var comp = _ensureActiveComp();
        if (!comp) return "No active comp";
        app.beginUndoGroup("Remove Speaker Preview");
        _removePreviewInternal(comp);
        app.endUndoGroup();
        return "OK";
    };

    // Update preview (called on input/radio/slider changes)
    updateSpeakerPreview = function (name, job, side, size, bgOffset) {
        var comp = _ensureActiveComp();
        if (!comp) return "No active comp";

        _initIfNeeded(comp);

        var tpl = _ensureTemplate();
        if (!tpl) return "Template not found";

        app.beginUndoGroup("Update Speaker Preview");

        _removePreviewInternal(comp);

        var pComp = tpl.duplicate();
        pComp.name = PREVIEW_COMP_NAME;

        // apply text
        _safeSetTextLayer(pComp, "Name_Main", name);
        _safeSetTextLayer(pComp, "Job_title", job);

        // apply controls
        _safeSetControl(pComp, side, size, bgOffset);

        var pLayer = comp.layers.add(pComp);
        pLayer.name = PREVIEW_LAYER_NAME;

        // preview should start 1 sec BEFORE playhead time
        pLayer.startTime = Math.max(comp.time - 1.0, 0);

        try { pLayer.collapseTransformation = true; } catch (e) {}

        app.endUndoGroup();
        return "OK";
    };

    // Create title on current marker and jump to next marker
    // Returns JSON with next marker data (optional for UI updates later)
    createSpeakerTitle = function (name, job, side, size, bgOffset) {
        var comp = _ensureActiveComp();
        if (!comp) return "No active comp";

        _initIfNeeded(comp);

        var tpl = _ensureTemplate();
        if (!tpl) return "Template not found";

        app.beginUndoGroup("Create Speaker Title");

        // remove preview before creating
        _removePreviewInternal(comp);

        // Determine placement time
        var placeTime = _getCurrentMarkerTime(comp);

        // Duplicate template for final title
        var newComp = tpl.duplicate();
        newComp.name = "name_job_title_LR_" + _getNextNumber("name_job_title_LR");

        // авто-сортировка: сгенерированный титр в папку _GENERATED/Speakers
    if (typeof moveItemToFolder === "function") {
    moveItemToFolder(newComp, "_GENERATED/Speakers");
        }


        _safeSetTextLayer(newComp, "Name_Main", name);
        _safeSetTextLayer(newComp, "Job_title", job);
        _safeSetControl(newComp, side, size, bgOffset);

        var newLayer = comp.layers.add(newComp);
        newLayer.startTime = placeTime;
        
        try { newLayer.collapseTransformation = true; } catch (e) {}

        // Move speaker title below the italic block that contains this title time
        var group = _findItalicGroupForTime(comp, placeTime);
        var lastItalic = group ? _findLastItalicLayerInRange(comp, group.start, group.end) : null;
        if (lastItalic) {
            try { newLayer.moveAfter(lastItalic); } catch (e) {}
        }


        // Advance marker index and jump playhead
        var nextData = { name: "", job: "", time: "" };

        if (_markers.length > 0) {
            _currentIndex = Math.min(_currentIndex + 1, _markers.length); // can become == length
            if (_currentIndex < _markers.length) {
                comp.time = _markers[_currentIndex].time;

                var parsed = _parseCommentToNameJob(_markers[_currentIndex].comment);
                nextData.name = parsed.name;
                nextData.job = parsed.job;
                nextData.time = String(_markers[_currentIndex].time);
            }
        }

        app.endUndoGroup();

        // Return next marker data (for future JS callback usage)
        return _json(nextData);
    };

})();
