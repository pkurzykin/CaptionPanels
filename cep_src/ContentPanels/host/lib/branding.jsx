// host/lib/branding.jsx
// =====================================================
// BRANDING: geotag + head_topic
// Exposed globals:
//   createGeotag(text)
//   applyHeadTopicToRegular(headText, topicText)
// =====================================================

(function () {

    var HEAD_WORK_COMP_NAME = "head_topic_WORK";
    var HEAD_LAYER_PREFIX   = "HEAD_TOPIC"; // метка для удаления/пересоздания
    var HEAD_LAYER_PREFIX_OLD = "__NH_HEADTOPIC__";
    var HEAD_LABEL = 10; // Purple (default label index)
    var GEOTAG_LABEL = 12; // Brown (default label index)

    // --------- helpers ---------
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

    function _applyFadeOutOpacityExpr(layer, durSeconds) {
        // Adds a simple fade-out at the end of the layer (based on outPoint).
        // Safe to call multiple times; it will overwrite previous expression.
        try {
            if (!layer) return;
            var d = Number(durSeconds);
            if (isNaN(d) || d <= 0) d = 0.5;
            var tr = layer.property("ADBE Transform Group");
            if (!tr) return;
            var op = tr.property("ADBE Opacity");
            if (!op || !op.canSetExpression) return;
            op.expression =
                "dur = " + d + ";\n" +
                "linear(time, outPoint - dur, outPoint, 100, 0);";
        } catch (e) {}
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


    function _safeSetText(comp, layerName, value) {
        var l = comp.layer(layerName);
        if (l && (l instanceof TextLayer)) {
            l.property("Source Text").setValue(value || "");
            return true;
        }
        return false;
    }

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

    function _removeGeneratedHeadLayers(comp) {
        for (var i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (l && l.name && (l.name.indexOf(HEAD_LAYER_PREFIX) === 0 || l.name.indexOf(HEAD_LAYER_PREFIX_OLD) === 0)) {
                try { l.remove(); } catch (e) {}
            }
        }
    }

    function _isRegularSubLayer(layer) {
        // регулярные слои субтитров: Sub_VOICEOVER_...
        if (!layer) return false;
        return (layer.name && layer.name.indexOf("Sub_VOICEOVER_") === 0);
    }

    function _isSubtitleLayerName(name) {
        var s = String(name || "");
        return (s.indexOf("Sub_VOICEOVER_") === 0) || (s.indexOf("Sub_SYNCH_") === 0);
    }

    function _refreshSubtitleBgFallback(comp) {
        if (!comp) return false;

        var BG_NAME = "subtitle_BG";
        var BG_PREFIX = "subtitle_BG_";
        var GAP_SEC = 3.0;
        try {
            var gv = Number(getConfigValue("subtitleBgGapSec", 3.0));
            if (!isNaN(gv) && gv >= 0 && gv <= 10) GAP_SEC = gv;
        } catch (eG) {}
        if (GAP_SEC < 3.0) GAP_SEC = 3.0;

        var bg = null;
        try { bg = comp.layer(BG_NAME); } catch (e0) { bg = null; }
        if (!bg) {
            for (var i = 1; i <= comp.numLayers; i++) {
                var l0 = comp.layer(i);
                if (l0 && l0.name && String(l0.name).indexOf(BG_PREFIX) === 0) {
                    bg = l0;
                    try { bg.name = BG_NAME; } catch (eRn) {}
                    break;
                }
            }
        }
        if (!bg) return false;

        for (var r = comp.numLayers; r >= 1; r--) {
            var lr = comp.layer(r);
            if (lr && lr.name && String(lr.name).indexOf(BG_PREFIX) === 0) {
                try { lr.remove(); } catch (eRm) {}
            }
        }

        var subs = [];
        for (var s = 1; s <= comp.numLayers; s++) {
            var sl = comp.layer(s);
            if (!sl || !_isSubtitleLayerName(sl.name)) continue;
            subs.push({
                layer: sl,
                start: Number(sl.inPoint) || 0,
                end: Number(sl.outPoint) || 0
            });
        }
        subs.sort(function (a, b) {
            return (a.start === b.start) ? (a.end - b.end) : (a.start - b.start);
        });

        var groups = [];
        if (subs.length > 0) {
            var gs = subs[0].start;
            var ge = subs[0].end;
            for (var k = 1; k < subs.length; k++) {
                var ss = subs[k].start;
                var ee = subs[k].end;
                if (ss - ge > GAP_SEC) {
                    groups.push({ start: gs, end: ge });
                    gs = ss;
                    ge = ee;
                } else {
                    if (ee > ge) ge = ee;
                }
            }
            groups.push({ start: gs, end: ge });
        }

        if (groups.length === 0) {
            bg.inPoint = comp.time;
            bg.outPoint = comp.time;
            bg.startTime = comp.time;
            return true;
        }

        for (var g = 0; g < groups.length; g++) {
            var grp = groups[g];
            var layer = bg;
            if (g > 0) {
                layer = bg.duplicate();
                layer.name = BG_PREFIX + (g + 1);
            }

            layer.startTime = grp.start;
            layer.inPoint = grp.start;
            layer.outPoint = grp.end;

            var anchor = null;
            for (var j = 1; j <= comp.numLayers; j++) {
                var la = comp.layer(j);
                if (!la || !_isSubtitleLayerName(la.name)) continue;
                var inP = Number(la.inPoint) || 0;
                if (inP < grp.start || inP > grp.end) continue;
                if (!anchor || la.index > anchor.index) anchor = la;
            }
            if (anchor) {
                try { layer.moveAfter(anchor); } catch (eMv) {}
            }
        }

        return true;
    }

    function _refreshSubtitleBgAfterBranding(comp) {
        var ok = false;
        try {
            if (typeof loadModule === "function") loadModule("subtitles.jsx");
        } catch (eLm) {}

        try {
            if (typeof _updateSubtitleBg === "function") {
                _updateSubtitleBg(comp);
                ok = true;
            }
        } catch (eUp) {
            ok = false;
        }

        if (!ok) {
            try { ok = _refreshSubtitleBgFallback(comp); } catch (eFb) { ok = false; }
        }

        return ok;
    }

    function _parseSubLayerNameInfo(name) {
        var s = String(name || "");
        var m = s.match(/^Sub_(VOICEOVER|SYNCH)_(\d+)_(\d+)$/i);
        if (!m) return null;
        var t = String(m[1] || "").toUpperCase();
        var b = parseInt(m[2], 10);
        var i = parseInt(m[3], 10);
        if (isNaN(b) || isNaN(i)) return null;
        return { type: t, batch: b, index: i };
    }

    function _collectRegularGroups(comp) {
        // Возвращает массив групп [{start:Number, end:Number}]
        // Основной путь: группируем по batch в имени Sub_VOICEOVER_<batch>_<index>.
        // Это не рвет группу на мелких паузах между блоками.
        // Fallback для legacy-имен: группируем по времени с мягким порогом gap.
        var regs = [];
        var byBatch = {};
        var allParsed = true;

        // соберём все regular-слои
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (_isRegularSubLayer(l)) {
                var info = _parseSubLayerNameInfo(l.name);
                if (!info || info.type !== "VOICEOVER") {
                    allParsed = false;
                }
                regs.push({
                    layer: l,
                    start: l.inPoint,
                    end: l.outPoint,
                    batch: (info && info.type === "VOICEOVER") ? info.batch : null
                });
            }
        }

        if (regs.length === 0) return [];

        if (allParsed) {
            for (var r = 0; r < regs.length; r++) {
                var it = regs[r];
                var key = String(it.batch);
                if (!byBatch[key]) {
                    byBatch[key] = { start: it.start, end: it.end };
                } else {
                    if (it.start < byBatch[key].start) byBatch[key].start = it.start;
                    if (it.end > byBatch[key].end) byBatch[key].end = it.end;
                }
            }

            var out = [];
            for (var k in byBatch) {
                if (!byBatch.hasOwnProperty(k)) continue;
                out.push({ start: byBatch[k].start, end: byBatch[k].end });
            }
            out.sort(function (a, b) {
                return (a.start === b.start) ? (a.end - b.end) : (a.start - b.start);
            });
            return out;
        }

        // Legacy fallback: разрываем только на заметных паузах.
        regs.sort(function (a, b) {
            return (a.start === b.start) ? (a.end - b.end) : (a.start - b.start);
        });
        var GAP_SEC = 1.0;
        var groups = [];
        var curStart = regs[0].start;
        var curEnd = regs[0].end;

        for (var p = 1; p < regs.length; p++) {
            var s = regs[p].start;
            var e = regs[p].end;

            if (s - curEnd <= GAP_SEC) {
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

    function _findFirstRegularLayer(comp) {
        var first = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (_isRegularSubLayer(l)) {
                if (!first || l.inPoint < first.inPoint) first = l;
            }
        }
        return first;
    }

    function _findLastRegularLayerInRange(comp, startTime, endTime) {
        var last = null;
        var EPS = 1.0 / 60.0;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!_isRegularSubLayer(l)) continue;
            if (l.inPoint + EPS < startTime || l.inPoint - EPS > endTime) continue;
            if (!last || l.inPoint > last.inPoint) last = l;
        }
        return last;
    }

    function _findLowestRegularLayerInRange(comp, startTime, endTime) {
        // Нижний в стеке слой среди регулярных субтитров в интервале
        var lowest = null;
        var EPS = 1.0 / 60.0;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!_isRegularSubLayer(l)) continue;
            if (l.inPoint + EPS < startTime || l.inPoint - EPS > endTime) continue;
            if (!lowest || l.index > lowest.index) lowest = l;
        }
        return lowest;
    }

    function _findGeotagLayerAtPlayhead(comp) {
        var t = comp.time;
        var EPS = 1.0 / 60.0; // ~1 frame
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var src = l.source;
            var srcName = (src && src.name) ? src.name : "";
            var layerName = l.name || "";
            var isGeo = (srcName.indexOf("geotag_") === 0) || (layerName.indexOf("geotag_") === 0);
            if (!isGeo) continue;
            if (Math.abs(l.startTime - t) <= EPS) return l;
        }
        return null;
    }

    function _isGeotagLayer(layer) {
        if (!layer) return false;
        var src = layer.source;
        var srcName = (src && src.name) ? src.name : "";
        var layerName = layer.name || "";
        return (srcName.indexOf("geotag_") === 0) || (layerName.indexOf("geotag_") === 0);
    }

    function _findGeotagEndForGroup(comp, groupStart, afterTime) {
        var EPS = 1.0 / 60.0;
        var hasAfter = (typeof afterTime === "number");
        var best = null;
        var bestStart = -999999;
        var groups = _collectRegularGroups(comp);
        var groupEnd = groupStart;
        for (var gi = 0; gi < groups.length; gi++) {
            if (Math.abs(Number(groups[gi].start) - Number(groupStart)) <= EPS) {
                groupEnd = Number(groups[gi].end) || groupStart;
                break;
            }
        }
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!_isGeotagLayer(l)) continue;
            var st = Number(l.inPoint);
            if (isNaN(st)) continue;
            // Geotag belongs to this group if it starts before/equal end of the group.
            // This keeps "first geotag -> first head_topic" even when geotag is inside VO range.
            if (st > groupEnd + EPS) continue;
            // ...and after previous group, if provided.
            if (hasAfter && st <= afterTime + EPS) continue;
            if (st > bestStart) {
                bestStart = st;
                best = l;
            }
        }
        return best ? (Number(best.outPoint) || null) : null;
    }

    function _findFirstSynchAfter(comp, t) {
        var EPS = 1.0 / 60.0;
        var best = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !l.name || l.name.indexOf("Sub_SYNCH_") !== 0) continue;
            var st = Number(l.inPoint) || 0;
            var en = Number(l.outPoint) || 0;
            if (st + EPS < t) continue;
            if (!best || st < best.start) {
                best = { start: st, end: en };
            }
        }
        return best;
    }

    function _findLayerStartByName(comp, layerName) {
        if (!comp || !layerName) return null;
        try {
            var l = comp.layer(layerName);
            if (!l) return null;
            var st = Number(l.inPoint);
            if (isNaN(st)) return null;
            return st;
        } catch (e) {
            return null;
        }
    }

    function _findLayerStartByBatch(comp, typeUpper, batchNum) {
        if (!comp) return null;
        var type = String(typeUpper || "").toUpperCase();
        var batch = Number(batchNum) || 0;
        if (!type || batch <= 0) return null;

        var prefix = "Sub_" + type + "_" + String(batch) + "_";
        var best = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !l.name || String(l.name).indexOf(prefix) !== 0) continue;
            var st = Number(l.inPoint);
            if (isNaN(st)) continue;
            if (best === null || st < best) best = st;
        }
        return best;
    }

    function _findNextRegularGroupStartAfter(comp, afterTime) {
        var groups = _collectRegularGroups(comp);
        var t = Number(afterTime);
        if (isNaN(t)) t = -999999;
        var EPS = 1.0 / 60.0;
        for (var i = 0; i < groups.length; i++) {
            var st = Number(groups[i].start);
            if (isNaN(st)) continue;
            if (st > t + EPS) return st;
        }
        return null;
    }

    // =====================================================
    // PUBLIC GLOBALS
    // =====================================================

    // GEOTAG: template comp "geotag", text layer "TXT", place at playhead
    createGeotag = function (text) {
        var comp = _ensureActiveComp();
        if (!comp) return respondErr("No active comp");

        var tpl = _findCompByName("geotag");
        if (!tpl) { alert("Композиция 'geotag' не найдена"); return respondErr("No geotag"); }

        app.beginUndoGroup("Create Geotag");

        // дублируем шаблон (чтобы не портить оригинал)
        var copy = tpl.duplicate();
        // можно не переименовывать или переименовать — оставим аккуратно
        copy.name = "geotag_" + _getNextNumber("geotag");

        // авто-сортировка: geotag_N в папку _GENERATED/Geotag
    if (typeof moveItemToFolder === "function") {
            moveItemToFolder(copy, "_GENERATED/Geotag");
        }

        _safeSetText(copy, "TXT", text);

        var layer = comp.layers.add(copy);
        layer.startTime = comp.time;
        try { layer.label = GEOTAG_LABEL; } catch (eLbl) {}
        _applyFadeOutOpacityExpr(layer, 0.5);
        // Геотег должен быть ниже первого блока субтитров (вниз перед первым)
        var firstSub = _findFirstRegularLayer(comp);
        if (firstSub) {
            try { layer.moveAfter(firstSub); } catch (e) {}
        }

        app.endUndoGroup();
        return respondOk("OK");
    };

    // GEOTAG LIST: [{text, time}, ...] - place each at provided time
    createGeotagsAtTimes = function (list) {
        var comp = _ensureActiveComp();
        if (!comp) return respondErr("No active comp");

        var arr = list;
        if (typeof list === "string") {
            arr = _parseJsonSafe(list);
        }
        if (!(arr instanceof Array)) return respondErr("Invalid geotags list");

        var t0 = Number(comp.time) || 0;
        var tpl = _findCompByName("geotag");
        var geotagDur = tpl ? (Number(tpl.duration) || 0) : 0;
        var nextStart = t0;

        for (var i = 0; i < arr.length; i++) {
            var g = arr[i] || {};
            comp.time = nextStart;
            createGeotag(g.text || "");

            // Additional geotags are placed sequentially (in butt-join) after the first one.
            if (geotagDur > 0) nextStart += geotagDur;
        }
        comp.time = Number(t0) || comp.time;
        return respondOk("OK");
    };

    // HEAD_TOPIC:
    // 1) ensures one WORK comp (head_topic_WORK), updates HEAD/TOPIC text
    // 2) removes previously generated head_topic layers in active comp
    // 3) creates layers over groups of consecutive Sub_VOICEOVER_* blocks
    applyHeadTopicToRegular = function (headText, topicText) {
        var comp = _ensureActiveComp();
        if (!comp) return respondErr("No active comp");

        var tpl = _findCompByName("head_topic");
        if (!tpl) { alert("Композиция 'head_topic' не найдена"); return respondErr("No head_topic"); }

        app.beginUndoGroup("Apply Head Topic To Regular");

        // WORK comp (reused)
        var work = _findCompByName(HEAD_WORK_COMP_NAME);
        if (!work) {
            work = tpl.duplicate();
            work.name = HEAD_WORK_COMP_NAME;
        }
        try { work.label = HEAD_LABEL; } catch (e) {}

        // авто-сортировка: рабочий head_topic в папку _GENERATED/HeadTopic
        if (typeof moveItemToFolder === "function") {
            moveItemToFolder(work, "_GENERATED/HeadTopic");
        }

        // update text inside WORK comp (global change)
        _safeSetText(work, "HEAD", headText);
        _safeSetText(work, "TOPIC", topicText);

        // remove previous generated layers
        _removeGeneratedHeadLayers(comp);

        // collect groups of regular subs
    var groups = _collectRegularGroups(comp);

    // FALLBACK: если нет regular-субтитров — создаём один head_topic по плейхеду
        if (groups.length === 0) {

        var one = comp.layers.add(work);
        one.name = HEAD_LAYER_PREFIX + "_PLAYHEAD";
        try { one.label = HEAD_LABEL; } catch (e) {}

        // строго по плейхеду
        one.startTime = comp.time;
        _applyFadeOutOpacityExpr(one, 0.5);

        // длительность НЕ трогаем — остаётся "как в шаблоне head_topic_WORK"
        try { _refreshSubtitleBgAfterBranding(comp); } catch (eBg0) {}

        app.endUndoGroup();
        return respondOk("OK");
    }
        // HEAD_TOPIC: first layer starts at the first subtitle block start (not playhead).

        // create layers for each group
        var prevSynchEnd = null;
        var made = 0;
        var firstStart = Number(comp.time) || 0;
        for (var g = 0; g < groups.length; g++) {
            var st = groups[g].start;
            var EPS = 1.0 / 60.0;

            // First head_topic always starts at playhead.
            if (g === 0) {
                st = firstStart;
            } else if (prevSynchEnd !== null && !isNaN(prevSynchEnd)) {
                // Next head_topic starts at the end of previous synch.
                st = prevSynchEnd;
            }

            // End at the first Sub_SYNCH start after this head_topic start.
            var syn = _findFirstSynchAfter(comp, st);
            if (!syn || !(syn.start > st + EPS)) {
                continue;
            }
            var en = syn.start;

            var l = comp.layers.add(work);
            made++;
            l.name = HEAD_LAYER_PREFIX + "_" + made;
            try { l.label = HEAD_LABEL; } catch (e) {}
            // start and duration match group
            l.startTime = st;
            l.inPoint = st;
            l.outPoint = en;

            _applyFadeOutOpacityExpr(l, 0.5);

            // Размещаем head_topic под всем блоком субтитров
            var anchor = _findLowestRegularLayerInRange(comp, st, en);
            if (anchor) {
                try { l.moveAfter(anchor); } catch (e) {}
            }

            if (syn.end > st + EPS) prevSynchEnd = syn.end;
        }

        try { _refreshSubtitleBgAfterBranding(comp); } catch (eBg1) {}

        app.endUndoGroup();
        return respondOk("OK");
    };

})();
