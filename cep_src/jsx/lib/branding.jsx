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

    function _findLastRegularLayer(comp) {
        var last = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (_isRegularSubLayer(l)) {
                if (!last || l.outPoint > last.outPoint) last = l;
            }
        }
        return last;
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

    function _collectSynchLayersSorted(comp) {
        var out = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !l.name || l.name.indexOf("Sub_SYNCH_") !== 0) continue;
            out.push({ start: Number(l.inPoint) || 0, end: Number(l.outPoint) || 0, layer: l });
        }
        out.sort(function (a, b) {
            return (a.start === b.start) ? (a.end - b.end) : (a.start - b.start);
        });
        return out;
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

    function _findSubtitleLayerByExactName(comp, layerName) {
        if (!comp || !layerName) return null;
        try {
            var l = comp.layer(String(layerName));
            if (l && _isSubtitleLayerName(l.name)) return l;
        } catch (e) {}
        return null;
    }

    function _getCommentTagValue(layer, tagName) {
        if (!layer || !tagName) return "";
        try {
            var c = String(layer.comment || "");
            if (!c) return "";
            var re = new RegExp("(?:^|\\r?\\n)" + String(tagName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^\\r\\n]+)");
            var m = c.match(re);
            return (m && m[1]) ? String(m[1]) : "";
        } catch (e) {
            return "";
        }
    }

    function _findFirstSubtitleLayerBySegId(comp, segId) {
        if (!comp) return null;
        var id = String(segId || "").replace(/^\s+|\s+$/g, "");
        if (!id) return null;

        var best = null;
        var bestStart = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !_isSubtitleLayerName(l.name)) continue;
            var srcId = _getCommentTagValue(l, "CP_SRCSEGID");
            var layerSegId = _getCommentTagValue(l, "CP_SEGID");
            if (srcId !== id && layerSegId !== id) continue;
            var st = Number(l.inPoint);
            if (isNaN(st)) st = 0;
            if (!best || st < bestStart) {
                best = l;
                bestStart = st;
            }
        }
        return best;
    }

    function _findFirstSubtitleLayerByBatch(comp, typeUpper, batchNum) {
        if (!comp) return null;
        var type = String(typeUpper || "").toUpperCase();
        var batch = parseInt(batchNum, 10);
        if (!type || isNaN(batch) || batch <= 0) return null;

        var prefix = "Sub_" + type + "_" + String(batch) + "_";
        var best = null;
        var bestStart = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !l.name || String(l.name).indexOf(prefix) !== 0) continue;
            var st = Number(l.inPoint);
            if (isNaN(st)) st = 0;
            if (!best || st < bestStart) {
                best = l;
                bestStart = st;
            }
        }
        return best;
    }

    function _findSubtitleLayerByBatchIndex(comp, typeUpper, batchNum, indexNum) {
        if (!comp) return null;
        var type = String(typeUpper || "").toUpperCase();
        var batch = parseInt(batchNum, 10);
        var idx = parseInt(indexNum, 10);
        if (!type || isNaN(batch) || batch <= 0 || isNaN(idx) || idx <= 0) return null;
        var exactName = "Sub_" + type + "_" + String(batch) + "_" + String(idx);
        return _findSubtitleLayerByExactName(comp, exactName);
    }

    function _findFirstSubtitleLayerInComp(comp) {
        if (!comp) return null;
        var best = null;
        var bestStart = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !_isSubtitleLayerName(l.name)) continue;
            var st = Number(l.inPoint);
            if (isNaN(st)) st = 0;
            if (!best || st < bestStart) {
                best = l;
                bestStart = st;
            }
        }
        return best;
    }

    function _findFirstSubtitleLayerAfter(comp, afterTime) {
        if (!comp) return null;
        var t = Number(afterTime);
        if (isNaN(t)) t = -999999;
        var EPS = 1.0 / 60.0;
        var best = null;
        var bestStart = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !_isSubtitleLayerName(l.name)) continue;
            var st = Number(l.inPoint);
            if (isNaN(st)) st = 0;
            if (st <= t + EPS) continue;
            if (!best || st < bestStart) {
                best = l;
                bestStart = st;
            }
        }
        return best;
    }

    function _findSubtitleLayerNearTime(comp, timeSec) {
        if (!comp) return null;
        var t = Number(timeSec);
        if (isNaN(t)) t = Number(comp.time) || 0;
        var EPS = 1.0 / 60.0;

        var inside = null;
        var insideStart = null;
        var next = null;
        var nextStart = null;
        var prev = null;
        var prevStart = null;

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !_isSubtitleLayerName(l.name)) continue;
            var st = Number(l.inPoint);
            var en = Number(l.outPoint);
            if (isNaN(st)) st = 0;
            if (isNaN(en)) en = st;

            if (st <= t + EPS && en >= t - EPS) {
                if (!inside || st > insideStart) {
                    inside = l;
                    insideStart = st;
                }
                continue;
            }

            if (st >= t - EPS) {
                if (!next || st < nextStart) {
                    next = l;
                    nextStart = st;
                }
                continue;
            }

            if (!prev || st > prevStart) {
                prev = l;
                prevStart = st;
            }
        }

        if (inside) return inside;
        if (next) return next;
        return prev;
    }

    function _resolveGeotagAnchorLayer(comp, geotagMeta, afterTimeHint) {
        if (!comp) return null;
        var g = geotagMeta || {};

        var bySegId = _findFirstSubtitleLayerBySegId(comp, g.anchorSegId || "");
        if (bySegId) return bySegId;

        var byName = _findSubtitleLayerByExactName(comp, g.anchorLayer || "");
        if (byName) return byName;

        var byBatchIndex = _findSubtitleLayerByBatchIndex(comp, g.anchorType || "", g.anchorBatch || 0, g.anchorIndex || 0);
        if (byBatchIndex) return byBatchIndex;

        var byBatch = _findFirstSubtitleLayerByBatch(comp, g.anchorType || "", g.anchorBatch || 0);
        if (byBatch) return byBatch;

        // If anchorType wasn't preserved, still try both subtitle families by batch.
        var rawBatch = parseInt(g.anchorBatch, 10);
        var rawIndex = parseInt(g.anchorIndex, 10);
        if (!isNaN(rawBatch) && rawBatch > 0) {
            if (!isNaN(rawIndex) && rawIndex > 0) {
                var byVoiceBatchIndex = _findSubtitleLayerByBatchIndex(comp, "VOICEOVER", rawBatch, rawIndex);
                if (byVoiceBatchIndex) return byVoiceBatchIndex;
                var bySynchBatchIndex = _findSubtitleLayerByBatchIndex(comp, "SYNCH", rawBatch, rawIndex);
                if (bySynchBatchIndex) return bySynchBatchIndex;
            }
            var byVoiceBatch = _findFirstSubtitleLayerByBatch(comp, "VOICEOVER", rawBatch);
            if (byVoiceBatch) return byVoiceBatch;
            var bySynchBatch = _findFirstSubtitleLayerByBatch(comp, "SYNCH", rawBatch);
            if (bySynchBatch) return bySynchBatch;
        }

        // Parsed mode fallback (do not rely on stale imported time):
        // place geotag on the first subtitle that starts after previously resolved geotag anchor.
        var byOrder = _findFirstSubtitleLayerAfter(comp, afterTimeHint);
        if (byOrder) return byOrder;

        // Last subtitle-only fallback: first subtitle in comp.
        var firstAny = _findFirstSubtitleLayerInComp(comp);
        if (firstAny) return firstAny;

        return null;
    }

    function _buildCreatedGeotagEntry(layer, anchorLayer) {
        if (!layer) return null;
        var st = Number(layer.inPoint);
        var en = Number(layer.outPoint);
        if (isNaN(st)) st = Number(layer.startTime) || 0;
        if (isNaN(en)) en = st;
        return {
            layerName: String(layer.name || ""),
            start: st,
            out: en,
            anchorLayer: anchorLayer && anchorLayer.name ? String(anchorLayer.name) : ""
        };
    }

    function _createGeotagLayerAt(comp, tplComp, text, startTime, anchorLayer) {
        if (!comp || !tplComp) return null;

        var copy = tplComp.duplicate();
        copy.name = "geotag_" + _getNextNumber("geotag");

        if (typeof moveItemToFolder === "function") {
            moveItemToFolder(copy, "_GENERATED/Geotag");
        }

        _safeSetText(copy, "TXT", text);

        var layer = comp.layers.add(copy);
        var st = Number(startTime);
        if (isNaN(st)) st = Number(comp.time) || 0;
        layer.startTime = st;
        layer.inPoint = st;
        try { layer.label = GEOTAG_LABEL; } catch (eLbl) {}
        _applyFadeOutOpacityExpr(layer, 0.5);

        var anchor = anchorLayer || _findSubtitleLayerNearTime(comp, st);
        if (anchor) {
            try { layer.moveAfter(anchor); } catch (eMv) {}
        }

        return _buildCreatedGeotagEntry(layer, anchor);
    }

    function _normalizeGeotagHints(comp, hints) {
        var arr = hints;
        if (typeof hints === "string") {
            try { arr = _parseJsonSafe(hints); } catch (e) { arr = []; }
        }
        if (!(arr instanceof Array)) return [];

        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var h = arr[i] || {};
            var st = Number(h.start);
            var en = Number(h.out);
            var layerName = String(h.layerName || "");

            if ((isNaN(st) || isNaN(en)) && layerName) {
                try {
                    var l = comp.layer(layerName);
                    if (l) {
                        st = Number(l.inPoint);
                        en = Number(l.outPoint);
                    }
                } catch (eL) {}
            }

            if (isNaN(st)) {
                st = Number(h.time);
            }
            if (isNaN(st)) continue;
            if (isNaN(en) || en < st) en = st;

            out.push({
                start: st,
                out: en,
                layerName: layerName,
                anchorLayer: String(h.anchorLayer || "")
            });
        }

        out.sort(function (a, b) {
            return (a.start === b.start) ? (a.out - b.out) : (a.start - b.start);
        });
        return out;
    }

    function _consumeLatestGeotagResetOutBefore(geotagHints, state, endTime, minStartExclusive, eps) {
        if (!(geotagHints instanceof Array) || geotagHints.length === 0) return null;
        if (!state) return null;
        if (typeof state.index !== "number") state.index = 0;

        var chosen = null;
        while (state.index < geotagHints.length) {
            var g = geotagHints[state.index];
            if (!g) {
                state.index++;
                continue;
            }

            var go = Number(g.out);
            if (isNaN(go)) {
                state.index++;
                continue;
            }

            // Consume by geotag OUT time (not start). If geotag starts earlier but
            // ends inside a later SYNCH window, reset must be applied to that window.
            if (go > endTime + eps) break;

            if (go > minStartExclusive + eps && go <= endTime - eps) {
                chosen = g;
            }
            state.index++;
        }

        return chosen;
    }

    function _findGeotagLayerByName(comp, layerName) {
        if (!comp || !layerName) return null;
        try {
            var l = comp.layer(String(layerName));
            if (l && _isGeotagLayer(l)) return l;
        } catch (e) {}
        return null;
    }

    function _findLatestGeotagLayerEndingAt(comp, outTime, eps) {
        if (!comp) return null;
        var target = Number(outTime);
        if (isNaN(target)) return null;
        var tol = (typeof eps === "number" && eps > 0) ? eps : (1.0 / 60.0);
        var best = null;
        var bestStart = null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l || !_isGeotagLayer(l)) continue;
            var en = Number(l.outPoint);
            var st = Number(l.inPoint);
            if (isNaN(en) || isNaN(st)) continue;
            if (Math.abs(en - target) > tol) continue;
            if (!best || st > bestStart) {
                best = l;
                bestStart = st;
            }
        }
        return best;
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
        var created = _createGeotagLayerAt(comp, tpl, text, Number(comp.time) || 0, null);
        app.endUndoGroup();
        return respondOk({ created: created ? [created] : [], count: created ? 1 : 0 });
    };

    // GEOTAG LIST: [{text,time,anchorSegId,anchorLayer,anchorType,anchorBatch,anchorIndex}, ...]
    // Parsed mode prefers subtitle anchor and ignores stale imported "time".
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
        if (!tpl) { alert("Композиция 'geotag' не найдена"); return respondErr("No geotag"); }

        app.beginUndoGroup("Create Geotags (Anchored)");
        var created = [];
        var lastResolvedAnchorStart = null;

        for (var i = 0; i < arr.length; i++) {
            var g = arr[i] || {};
            var anchor = _resolveGeotagAnchorLayer(comp, g, lastResolvedAnchorStart);
            var targetStart = null;
            if (anchor) {
                targetStart = Number(anchor.inPoint);
                if (!isNaN(targetStart)) lastResolvedAnchorStart = targetStart;
            }
            if (isNaN(targetStart)) targetStart = t0;

            var c = _createGeotagLayerAt(comp, tpl, g.text || "", targetStart, anchor);
            if (c) created.push(c);
        }
        comp.time = Number(t0) || comp.time;
        app.endUndoGroup();
        return respondOk({ created: created, count: created.length });
    };

    // HEAD_TOPIC:
    // 1) ensures one WORK comp (head_topic_WORK), updates HEAD/TOPIC text
    // 2) removes previously generated head_topic layers in active comp
    // 3) creates layers over groups of consecutive Sub_VOICEOVER_* blocks
    applyHeadTopicToRegular = function (headText, topicText, geotagHints) {
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

        // Head-topic chain:
        // - base rule: by SYNCH boundaries (next starts at previous SYNCH end, ends at next SYNCH start)
        // - geotag rule: if a geotag is present before the next SYNCH start, next head_topic starts from geotag.out
        var EPS = Math.max(1.0 / 60.0, Number(comp.frameDuration) || (1.0 / 25.0));
        var MIN_DUR = 0.25;
        try {
            var cfgMinDur = Number(getConfigValue("headTopicMinDurSec", 0.25));
            if (!isNaN(cfgMinDur) && cfgMinDur > 0) MIN_DUR = cfgMinDur;
        } catch (eCfg) {}
        if (MIN_DUR < EPS * 2) MIN_DUR = EPS * 2;

        var geoHints = _normalizeGeotagHints(comp, geotagHints);
        var geoState = { index: 0 };
        var synchs = _collectSynchLayersSorted(comp);
        var made = 0;
        var firstStart = Number(comp.time) || 0;
        var prevSynchEnd = null;

        if (synchs.length > 0) {
            for (var si = 0; si < synchs.length; si++) {
                var syn = synchs[si];
                var defaultStart = (si === 0) ? firstStart : ((prevSynchEnd !== null) ? prevSynchEnd : firstStart);
                var en = Number(syn.start);
                if (isNaN(en)) en = defaultStart;
                var synEnd = Number(syn.end) || en;
                var st = defaultStart;

                var resetGeo = _consumeLatestGeotagResetOutBefore(geoHints, geoState, en, defaultStart, EPS);
                if (resetGeo) st = Number(resetGeo.out);

                if ((en - st) > MIN_DUR) {
                    var anchor = null;
                    if (resetGeo && resetGeo.anchorLayer) {
                        anchor = _findSubtitleLayerByExactName(comp, resetGeo.anchorLayer);
                    }
                    if (!anchor) anchor = _findSubtitleLayerNearTime(comp, st + EPS);
                    if (!anchor) anchor = _findLowestRegularLayerInRange(comp, st, en);

                    if (anchor) {
                        var relatedGeoLayer = null;
                        if (resetGeo && resetGeo.layerName) {
                            relatedGeoLayer = _findGeotagLayerByName(comp, resetGeo.layerName);
                        }
                        if (!relatedGeoLayer && resetGeo) {
                            relatedGeoLayer = _findLatestGeotagLayerEndingAt(comp, Number(resetGeo.out), EPS);
                        }

                        if (relatedGeoLayer && relatedGeoLayer.index < anchor.index) {
                            try { relatedGeoLayer.moveAfter(anchor); } catch (eGeoMv) {}
                        }

                        var l = comp.layers.add(work);
                        made++;
                        l.name = HEAD_LAYER_PREFIX + "_" + made;
                        try { l.label = HEAD_LABEL; } catch (eLbl) {}
                        l.startTime = st;
                        l.inPoint = st;
                        l.outPoint = en;
                        _applyFadeOutOpacityExpr(l, 0.5);

                        // Всегда держим head_topic под блоком субтитров, чтобы не оставались "висящие" слои наверху.
                        try { l.moveAfter(anchor); } catch (eMv) {}
                        if (relatedGeoLayer) {
                            try { l.moveBefore(relatedGeoLayer); } catch (eHeadMv) {}
                        }
                    }
                }

                if (synEnd > defaultStart + EPS) prevSynchEnd = synEnd;
            }
        }

        // Fallback: no SYNCH blocks, but regular subtitles exist.
        if (made === 0) {
            var lastReg = _findLastRegularLayer(comp);
            var fallbackStart = firstStart;
            var fallbackEnd = lastReg ? (Number(lastReg.outPoint) || fallbackStart) : fallbackStart;

            if (lastReg && geoHints.length > 0) {
                for (var gi = 0; gi < geoHints.length; gi++) {
                    var gh = geoHints[gi];
                    if (!gh) continue;
                    var go = Number(gh.out);
                    if (isNaN(go)) continue;
                    if (go > fallbackStart + EPS && go < fallbackEnd - EPS) {
                        fallbackStart = go;
                        break;
                    }
                }
            }

            if (lastReg && (fallbackEnd - fallbackStart > MIN_DUR)) {
                var fallbackAnchor = _findLowestRegularLayerInRange(comp, fallbackStart, fallbackEnd);
                if (fallbackAnchor) {
                    var one = comp.layers.add(work);
                    one.name = HEAD_LAYER_PREFIX + "_1";
                    try { one.label = HEAD_LABEL; } catch (eLbl2) {}
                    one.startTime = fallbackStart;
                    one.inPoint = fallbackStart;
                    one.outPoint = fallbackEnd;
                    _applyFadeOutOpacityExpr(one, 0.5);
                    try { one.moveAfter(fallbackAnchor); } catch (eMv2) {}
                    made = 1;
                }
            }
        }

        app.endUndoGroup();
        return respondOk("OK");
    };

})();
