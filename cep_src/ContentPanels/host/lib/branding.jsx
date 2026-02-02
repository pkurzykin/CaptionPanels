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

    function _collectRegularGroups(comp) {
        // Возвращает массив групп [{start:Number, end:Number}]
        // Логика: группируем последовательности Sub_VOICEOVER_* в порядке времени.
        var regs = [];

        // соберём все regular-слои
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (_isRegularSubLayer(l)) {
                regs.push({
                    layer: l,
                    start: l.inPoint,
                    end: l.outPoint
                });
            }
        }

        if (regs.length === 0) return [];

        // сортировка по start времени
        regs.sort(function (a, b) {
            return (a.start === b.start) ? (a.end - b.end) : (a.start - b.start);
        });

        // группировка “подряд”
        // Считаем, что если следующий start совпадает с текущим end (или почти совпадает) — это продолжение группы.
        var EPS = 1.0 / 60.0; // ~1 кадр (безопасно)
        var groups = [];

        var curStart = regs[0].start;
        var curEnd = regs[0].end;

        for (var k = 1; k < regs.length; k++) {
            var s = regs[k].start;
            var e = regs[k].end;

            if (s <= curEnd + EPS) {
                // перекрытие или вплотную — расширяем
                if (e > curEnd) curEnd = e;
            } else {
                // разрыв — закрываем группу
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

        var t0 = comp.time;
        for (var i = 0; i < arr.length; i++) {
            var g = arr[i] || {};
            var tt = Number(g.time);
            if (!isNaN(tt)) comp.time = tt;
            createGeotag(g.text || "");
        }
        comp.time = t0;
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

        // длительность НЕ трогаем — остаётся "как в шаблоне head_topic_WORK"

        app.endUndoGroup();
        return respondOk("OK");
    }


        // determine first head_topic start:
        // if geotag exists at playhead -> start right after it, else at playhead
        var geoLayer = _findGeotagLayerAtPlayhead(comp);
        var firstStart = geoLayer ? geoLayer.outPoint : comp.time;

        // create layers for each group
        for (var g = 0; g < groups.length; g++) {
            var st = groups[g].start;
            var en = groups[g].end;

            var l = comp.layers.add(work);
            l.name = HEAD_LAYER_PREFIX + "_" + (g + 1);
            try { l.label = HEAD_LABEL; } catch (e) {}

            if (g === 0) {
                var s = firstStart;
                if (s >= en) s = st;
                l.startTime = s;
                l.inPoint = s;
                l.outPoint = en;
            } else {
                // start and duration match group
                l.startTime = st;
                l.inPoint = st;
                l.outPoint = en;
            }

            // Размещаем head_topic выше последнего слоя в блоке субтитров
            var anchor = _findLastRegularLayerInRange(comp, st, en);
            if (anchor) {
                try { l.moveAfter(anchor); } catch (e) {}
            }
        }

        app.endUndoGroup();
        return respondOk("OK");
    };

})();
