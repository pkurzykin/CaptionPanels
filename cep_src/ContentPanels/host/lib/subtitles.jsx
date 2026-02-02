// host/lib/subtitles.jsx

// Глобальная функция генерации
generateSubs = function(rawText, isItalic, jumpPlayhead) {
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
            newL.name = "Sub_" + type.toUpperCase() + "_" + (n + 1);
            newL.property("Source Text").setValue(chunks[n]);

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

        // Update subtitle_BG to cover all subtitle layers
        _updateSubtitleBg(comp);
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
    var linesPerLayer = 3;
    
    // Чистим типографику перед нарезкой (общая функция из utils.jsx)
var fixedText = (typeof fixTypographyText === "function") ? fixTypographyText(text) : text.toString();


    var words = fixedText.replace(/\r/g, " ").split(/\s+/);
    var allLines = [];
    var currentLineWords = [];

    for (var i = 0; i < words.length; i++) {
        currentLineWords.push(words[i]);
        if (currentLineWords.join(" ").length > charPerLine) {
            if (currentLineWords.length > 1) {
                var poppedWords = [currentLineWords.pop()];
                while (currentLineWords.length > 0) {
                    var lastWord = currentLineWords[currentLineWords.length - 1];
                    
                    // Условие переноса коротких слов (ПРАВКА №3)
                    var shouldMove = false;
                    if (lastWord.length <= 2) { 
                        shouldMove = true; 
                    } else if (lastWord.length === 3 && lastWord === lastWord.toUpperCase()) {
                        shouldMove = true;
                    }

                    if (shouldMove) {
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
    var BG_PREFIX = "subtitle_BG__AUTO__";
    var GAP_SEC = 2.0;

    var bg = comp.layer(BG_NAME);
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
