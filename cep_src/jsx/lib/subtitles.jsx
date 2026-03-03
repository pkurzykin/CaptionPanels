// host/lib/subtitles.jsx

function _nextSubtitleBatchIndex(comp, typeUpper) {
    if (!comp) return 1;
    var prefix = "Sub_" + String(typeUpper || "").toUpperCase() + "_";
    var maxBatch = 0;
    var sawLegacy = false;

    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        var name = (l && l.name) ? String(l.name) : "";
        if (name.indexOf(prefix) !== 0) continue;

        // New format: Sub_VOICEOVER_<batch>_<index>
        // Legacy format: Sub_VOICEOVER_<index>
        var rest = name.substring(prefix.length);
        var m = rest.match(/^(\d+)(?:_(\d+))?/);
        if (!m) continue;

        if (m[2] !== undefined && m[2] !== null) {
            var batch = parseInt(m[1], 10);
            if (!isNaN(batch) && batch > maxBatch) maxBatch = batch;
        } else {
            // We can't recover the original "batch" count from legacy names, so treat legacy as batch=1.
            sawLegacy = true;
            if (maxBatch < 1) maxBatch = 1;
        }
    }

    if (maxBatch === 0 && sawLegacy) maxBatch = 1;
    return maxBatch + 1;
}

// Глобальная функция генерации
generateSubs = function(rawText, isItalic, jumpPlayhead, sourceSegId) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Ошибка: Кликните на таймлайн!");
            return respondErr("No active comp");
        }

        var type = isItalic ? "synch" : "voiceover";
        var layerName = (type === "synch") ? "text_italic" : "text_regular";
        var sourceLayer = comp.layer(layerName);

        if (!sourceLayer) {
            alert("Не найден слой-шаблон: " + layerName);
            return respondErr("Missing template: " + layerName);
        }

        app.beginUndoGroup("Generate Smart Subs");

        // Базовые шаблоны всегда shy = true
        sourceLayer.shy = true;

        var batchIndex = _nextSubtitleBatchIndex(comp, type.toUpperCase());

        var currentTime = comp.time;
        // Используем логику нарезки из твоего скрипта
        var chunks = splitTextToChunksCore(rawText);
        var layerDur = sourceLayer.outPoint - sourceLayer.inPoint;

        // Копируем данные о ключах позиции (если они есть)
        var pSource = sourceLayer.transform.position;
        var kData = [];
        for (var k = 1; k <= pSource.numKeys; k++) {
            kData.push({
                relTime: pSource.keyTime(k) - sourceLayer.inPoint,
                v: pSource.keyValue(k),
                inI: pSource.keyInInterpolationType(k),
                outI: pSource.keyOutInterpolationType(k)
            });
        }

        for (var n = 0; n < chunks.length; n++) {
            var newL = sourceLayer.duplicate();
            newL.moveToBeginning();
            newL.name = "Sub_" + type.toUpperCase() + "_" + batchIndex + "_" + (n + 1);
            newL.property("Source Text").setValue(chunks[n]);
            // Готовые субтитры не должны быть shy
            newL.shy = false;

            // Stable ID for auto-timing. Stored in comment so it survives renames.
            try {
                var segId = newL.name;
                var c = String(newL.comment || "");
                // Keep CP_SEGID unique per subtitle layer (auto-timing contract).
                c = c.replace(/(?:^|\r?\n)CP_SEGID=[^\r\n]*/g, "");
                c = c.replace(/(?:^|\r?\n)CP_SRCSEGID=[^\r\n]*/g, "");
                c = c.replace(/^\s+|\s+$/g, "");
                if (c) c += "\n";
                c += "CP_SEGID=" + segId;

                var srcSeg = String(sourceSegId || "").replace(/^\s+|\s+$/g, "");
                if (srcSeg) c += "\nCP_SRCSEGID=" + srcSeg;

                newL.comment = c;
            } catch (e) {}

            var targetIn = currentTime;
            newL.startTime = targetIn - (sourceLayer.inPoint - sourceLayer.startTime);

            // Перенос ключей анимации на новый слой
            var p = newL.transform.position;
            if (kData.length > 0) {
                while (p.numKeys > 0) p.removeKey(1);
                for (var m = 0; m < kData.length; m++) {
                    var newKeyTime = targetIn + kData[m].relTime;
                    var newIdx = p.addKey(newKeyTime);
                    p.setValueAtTime(newKeyTime, kData[m].v);
                    p.setInterpolationTypeAtKey(newIdx, kData[m].inI, kData[m].outI);
                }
            }
            currentTime += layerDur;
        }

        if (jumpPlayhead === true) {
    comp.time = currentTime;
        }

        _hideSubtitleTemplates(comp);
        app.endUndoGroup();
        return respondOk("OK");
    } catch (err) {
        alert("Ошибка в субтитрах: " + err.message);
        try { app.endUndoGroup(); } catch (e) {}
        return respondErr(err.message);
    }
};

// Внутренняя логика нарезки из твоего Ultra v7
function splitTextToChunksCore(text) {
    var charPerLine = 60;
    try {
        if (typeof getConfigValue === "function") {
            var v = Number(getConfigValue("subtitleCharsPerLine", 60));
            if (!isNaN(v) && v >= 20 && v <= 200) charPerLine = v;
        }
    } catch (e) {}
    var linesPerLayer = 3;
    
    var shortWordMaxLen = 3;
    try {
        if (typeof getConfigValue === "function") {
            var sw = Number(getConfigValue("subtitleShortWordMaxLen", 3));
            if (!isNaN(sw) && sw >= 1 && sw <= 10) shortWordMaxLen = Math.round(sw);
        }
    } catch (e) {}

    // Чистим типографику перед нарезкой (общая функция из utils.jsx)
    var fixedText = (typeof fixTypographyText === "function") ? fixTypographyText(text) : text.toString();

    // IMPORTANT: don't split on NBSP (\u00A0). It's used by fixTypographyText to prevent unwanted wraps
    // (e.g. "Транснефть\u00A0–\u00A0медиа"). Splitting by \\s would destroy that protection.
    var words = fixedText.replace(/[\r\n]/g, " ").split(/[ \t]+/);
    var allLines = [];
    var currentLineWords = [];

    function _isDashToken(w) {
        var s = String(w || "").replace(/^\s+|\s+$/g, "");
        return (s === "-" || s === "–" || s === "—");
    }

    function _isMoveableShortWord(w) {
        if (!w) return false;
        // Keep dash at the end of the previous line:
        // "слово –" / "слово", not "слово" / "– слово".
        if (_isDashToken(w)) return false;
        if (w.length <= shortWordMaxLen) return true;
        if (w.length === 3 && w === w.toUpperCase()) return true;
        return false;
    }

    function _endsSentenceToken(w) {
        var s = String(w || "");
        // strip closing quotes/brackets
        s = s.replace(/[»"\)\]\}]+$/g, "");
        if (!s) return false;

        // ellipsis "..."
        if (s.length >= 3 && s.substr(s.length - 3) === "...") return true;

        if (/[!?…]$/.test(s)) return true;

        if (/\.$/.test(s)) {
            // avoid short abbreviations like "г." / and dotted abbreviations like "т.д."
            if (s.length <= 3) return false;
            var dots = s.match(/\./g);
            if (dots && dots.length > 1) return false;
            return true;
        }

        return false;
    }

    function _looksLikeSentenceStart(w) {
        var s = String(w || "");
        if (!s) return false;

        // leading quotes/brackets
        s = s.replace(/^[«"\(\[\{]+/g, "");
        // leading dashes
        s = s.replace(/^[–—-]+/g, "");

        if (!s) return false;
        return /^[A-ZА-ЯЁ]/.test(s);
    }

    function _fitWordsFrom(startIndex, baseLen) {
        var len = baseLen;
        var count = 0;
        var lastIndex = -1;

        for (var j = startIndex; j < words.length; j++) {
            var ww = words[j];
            if (!ww) continue;

            var nextLen = len + (len > 0 ? 1 : 0) + ww.length;
            if (nextLen <= charPerLine) {
                len = nextLen;
                count++;
                lastIndex = j;
            } else {
                break;
            }
        }

        return { count: count, lastIndex: lastIndex };
    }

    function _countEffectiveFitWords(startIndex, fitInfo) {
        var effective = fitInfo.count;
        var j = fitInfo.lastIndex;
        while (j >= startIndex && effective > 0) {
            var ww = words[j];
            if (ww && _isMoveableShortWord(ww)) {
                effective--;
                j--;
                continue;
            }
            break;
        }
        return effective;
    }

    for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (!w) continue;

        // Sentence boundary: don't start a new sentence with only 1-2 words at the end of a line.
        // Apply ONLY to the 3rd line of a 3-line subtitle block.
        var lineIndexInBlock = allLines.length % linesPerLayer; // 0,1,2
        if (lineIndexInBlock == (linesPerLayer - 1) && currentLineWords.length > 0) {
            var prev = currentLineWords[currentLineWords.length - 1];
            if (_endsSentenceToken(prev) && _looksLikeSentenceStart(w)) {
                var baseLen = currentLineWords.join(" ").length;
                var fitInfo = _fitWordsFrom(i, baseLen);
                if (fitInfo.count > 0) {
                    var effective = _countEffectiveFitWords(i, fitInfo);
                    if (effective <= 2) {
                        allLines.push(currentLineWords.join(" "));
                        currentLineWords = [];
                    }
                }
            }
        }

        currentLineWords.push(w);
        if (currentLineWords.join(" ").length > charPerLine) {
            if (currentLineWords.length > 1) {
                var poppedWords = [currentLineWords.pop()];
                while (currentLineWords.length > 0) {
                    var lastWord = currentLineWords[currentLineWords.length - 1];
                    if (_isMoveableShortWord(lastWord)) {
                        poppedWords.unshift(currentLineWords.pop());
                    } else {
                        break;
                    }
                }
                allLines.push(currentLineWords.join(" "));
                currentLineWords = poppedWords;
            } else {
                allLines.push(currentLineWords.join(" "));
                currentLineWords = [];
            }
        }
    }

    if (currentLineWords.length > 0) allLines.push(currentLineWords.join(" "));
    
    function _isShortLine(line) {
        var t = String(line || "").replace(/^\s+|\s+$/g, "");
        if (!t) return false;
        var words = t.split(/\s+/);
        return (t.length <= 15) || (words.length <= 2);
    }

    function _splitShortTailSentence(line) {
        var s = String(line || "");
        // find boundary: . ! ? … followed by space(s)
        var m = s.match(/([.!?…])\s+/g);
        if (!m) return null;
        // use last boundary in the line
        var idx = s.lastIndexOf(m[m.length - 1]);
        if (idx === -1) return null;
        var after = s.slice(idx + m[m.length - 1].length);
        if (_isShortLine(after)) {
            return {
                head: s.slice(0, idx + m[m.length - 1].length).replace(/\s+$/g, ""),
                tail: after.replace(/^\s+/g, "")
            };
        }
        return null;
    }

    // Разбивка на блоки с переносом короткой 3-й строки в следующий блок
    var chunks = [];
    var carryLine = null;
    var i = 0;
    while (i < allLines.length || carryLine) {
        var chunkLines = [];
        if (carryLine) {
            chunkLines.push(carryLine);
            carryLine = null;
        }
        while (chunkLines.length < linesPerLayer && i < allLines.length) {
            chunkLines.push(allLines[i++]);
        }

        if (chunkLines.length === linesPerLayer) {
            var lastLine = chunkLines[linesPerLayer - 1];
            var split = _splitShortTailSentence(lastLine);
            if (split) {
                chunkLines[linesPerLayer - 1] = split.head;
                carryLine = split.tail;
            }
        }

        chunks.push(chunkLines.join("\r"));
    }
    return chunks;
}

function _isSubtitleLayer(layer) {
    if (!layer) return false;
    var name = layer.name || "";
    return (name.indexOf("Sub_VOICEOVER_") === 0 || name.indexOf("Sub_SYNCH_") === 0);
}

function _collectSubtitleLayers(comp) {
    var arr = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        if (_isSubtitleLayer(l)) {
            arr.push({ layer: l, start: l.inPoint, end: l.outPoint });
        }
    }
    arr.sort(function (a, b) {
        return (a.start === b.start) ? (a.end - b.end) : (a.start - b.start);
    });
    return arr;
}

function _collectSubtitleGroups(comp, gapSec) {
    var layers = _collectSubtitleLayers(comp);
    if (layers.length === 0) return [];

    var groups = [];
    var curStart = layers[0].start;
    var curEnd = layers[0].end;

    for (var i = 1; i < layers.length; i++) {
        var s = layers[i].start;
        var e = layers[i].end;
        if (s - curEnd > gapSec) {
            groups.push({ start: curStart, end: curEnd });
            curStart = s;
            curEnd = e;
        } else {
            if (e > curEnd) curEnd = e;
        }
    }
    groups.push({ start: curStart, end: curEnd });
    return groups;
}

function _removeAutoBgLayers(comp, prefix) {
    for (var i = comp.numLayers; i >= 1; i--) {
        var l = comp.layer(i);
        if (l && l.name && l.name.indexOf(prefix) === 0) {
            try { l.remove(); } catch (e) {}
        }
    }
}

function _findLastSubtitleLayerInRange(comp, startTime, endTime) {
    var last = null;
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        if (!_isSubtitleLayer(l)) continue;
        if (l.inPoint < startTime || l.inPoint > endTime) continue;
        if (!last || l.index > last.index) last = l;
    }
    return last;
}

function _updateSubtitleBg(comp) {
    if (!comp) return;
    var BG_NAME = "subtitle_BG";
    var BG_PREFIX = "subtitle_BG_";
    var GAP_SEC = 3.0;
    try {
        if (typeof getConfigValue === "function") {
            var v = Number(getConfigValue("subtitleBgGapSec", 3.0));
            if (!isNaN(v) && v >= 0 && v <= 10) GAP_SEC = v;
        }
    } catch (eGap) {}
    if (GAP_SEC < 3.0) GAP_SEC = 3.0;

    var bg = comp.layer(BG_NAME);
    if (!bg) {
        // Fallback: if the base layer was duplicated/renamed, reuse the first auto BG layer as base.
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (l && l.name && String(l.name).indexOf(BG_PREFIX) === 0) {
                bg = l;
                try { bg.name = BG_NAME; } catch (eRn) {}
                break;
            }
        }
    }
    if (!bg) return;

    _removeAutoBgLayers(comp, BG_PREFIX);

    var groups = _collectSubtitleGroups(comp, GAP_SEC);
    if (groups.length === 0) {
        bg.inPoint = comp.time;
        bg.outPoint = comp.time;
        bg.startTime = comp.time;
        return;
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

        var anchor = _findLastSubtitleLayerInRange(comp, grp.start, grp.end);
        if (anchor) {
            try { layer.moveAfter(anchor); } catch (e) {}
        }
    }
}

function _hideSubtitleTemplates(comp) {
    if (!comp) return;
    var reg = comp.layer("text_regular");
    var ita = comp.layer("text_italic");
    if (reg) reg.shy = true;
    if (ita) ita.shy = true;
    try { comp.hideShyLayers = true; } catch (e) {}
}

var SUBTITLE_BG_ONCE_FLAG = "CP_SUBTITLE_BG_REFRESHED";

function _getItemCommentSafe(item) {
    if (!item) return "";
    try {
        return String(item.comment || "");
    } catch (e) {
        return "";
    }
}

function _hasCompFlag(comp, flagKey) {
    if (!comp || !flagKey) return false;
    var comment = _getItemCommentSafe(comp);
    if (!comment) return false;
    var escaped = String(flagKey).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("(^|\\n)" + escaped + "=1(\\n|$)");
    return re.test(comment);
}

function _setCompFlag(comp, flagKey) {
    if (!comp || !flagKey) return false;
    if (_hasCompFlag(comp, flagKey)) return true;

    var comment = _getItemCommentSafe(comp);
    if (comment && comment.charAt(comment.length - 1) !== "\n") comment += "\n";
    comment += String(flagKey) + "=1";
    try {
        comp.comment = comment;
        return true;
    } catch (e) {
        return false;
    }
}

// Public helper: force subtitle_BG recalculation for active comp.
refreshSubtitleBgForActiveComp = function (onceOnly) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return respondErr("No active comp");
        }

        var once = !!onceOnly;
        if (once && _hasCompFlag(comp, SUBTITLE_BG_ONCE_FLAG)) {
            return respondOk({
                skipped: true,
                reason: "already_refreshed"
            });
        }

        app.beginUndoGroup("Refresh Subtitle BG");
        _updateSubtitleBg(comp);
        if (once) _setCompFlag(comp, SUBTITLE_BG_ONCE_FLAG);
        app.endUndoGroup();

        return respondOk({
            skipped: false,
            onceOnly: once
        });
    } catch (e) {
        try { app.endUndoGroup(); } catch (e2) {}
        return respondErr(e && e.message ? e.message : String(e));
    }
};
