// host/lib/subtitles.jsx

// Глобальная функция генерации
generateSubs = function(rawText, isItalic, jumpPlayhead) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Ошибка: Кликните на таймлайн!");
            return;
        }

        var type = isItalic ? "synch" : "voiceover";
        var layerName = (type === "synch") ? "text_italic" : "text_regular";
        var sourceLayer = comp.layer(layerName);

        if (!sourceLayer) {
            alert("Не найден слой-шаблон: " + layerName);
            return;
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
        app.endUndoGroup();
    } catch (err) {
        alert("Ошибка в субтитрах: " + err.message);
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

function _updateSubtitleBg(comp) {
    if (!comp) return;
    var bg = comp.layer("subtitle_BG");
    if (!bg) return;

    var minIn = null;
    var maxOut = null;
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        if (!_isSubtitleLayer(l)) continue;
        if (minIn === null || l.inPoint < minIn) minIn = l.inPoint;
        if (maxOut === null || l.outPoint > maxOut) maxOut = l.outPoint;
    }

    if (minIn !== null && maxOut !== null) {
        bg.inPoint = minIn;
        bg.outPoint = maxOut;
        bg.startTime = minIn;
    }
}
