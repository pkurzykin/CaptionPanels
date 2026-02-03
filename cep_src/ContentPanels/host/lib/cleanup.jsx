// host/lib/cleanup.jsx


deepCleanProject = function() {
    try {
        var activeComp = app.project.activeItem;

        if (!activeComp || !(activeComp instanceof CompItem)) {
            alert("Пожалуйста, выберите композицию!");
            return respondErr("No active comp");
        }

        app.beginUndoGroup("Deep Text Cleanup");

        var editCount = 0;
        var compsProcessed = [];

        

        function cleanComposition(comp) {
            for (var c = 0; c < compsProcessed.length; c++) {
                if (compsProcessed[c] === comp.id) return;
            }
            compsProcessed.push(comp.id);

            for (var i = 1; i <= comp.numLayers; i++) {
                var layer = comp.layer(i);
                if (layer instanceof TextLayer) {
                    var textProp = layer.property("Source Text");
                    var oldText = textProp.value.toString();
                    var newText = (typeof fixTypographyText === "function") ? fixTypographyText(oldText) : oldText;
                    if (oldText !== newText) {
                        textProp.setValue(newText);
                        editCount++;
                    }
                }
                if (layer.source instanceof CompItem) {
                    cleanComposition(layer.source);
                }
            }
        }

        cleanComposition(activeComp);
        app.endUndoGroup();
        alert("Очистка завершена! Исправлено слоев: " + editCount);
        return respondOk("OK");
    } catch (err) {
        alert("Ошибка в скрипте: " + err.message);
        return respondErr(err.message);
    }
};

// =====================================================
// Typography report + apply (for UI modal)
// Exposed globals:
//   scanTypographyIssues()
//   applyTypographyFixes(skipList)
// =====================================================

(function () {
    var MAX_TEXT_CHARS = 600;

    function _escapeString(s) {
        return String(s || "")
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

    function _jsonStr(s) {
        return "\"" + _escapeString(s) + "\"";
    }

    function _jsonErr(msg) {
        return "{\"ok\":false,\"result\":\"\",\"error\":" + _jsonStr(msg) + "}";
    }

    function _jsonOk(resultJson) {
        return "{\"ok\":true,\"result\":" + resultJson + ",\"error\":\"\"}";
    }

    function _trimText(s) {
        var t = String(s || "");
        if (t.length > MAX_TEXT_CHARS) {
            return t.slice(0, MAX_TEXT_CHARS) + "...";
        }
        return t;
    }

    function _parseJsonSafe(v) {
        if (v instanceof Array) return v;
        if (typeof v === "string") {
            var s = String(v || "");
            if (s && s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
            try { return eval("(" + s + ")"); } catch (e) { return []; }
        }
        return [];
    }

    function _makeKey(compId, layerIndex) {
        return String(compId) + ":" + String(layerIndex);
    }

    function _jsonIssuesArray(arr) {
        var out = "[";
        for (var i = 0; i < arr.length; i++) {
            var it = arr[i] || {};
            if (i > 0) out += ",";
            out += "{"
                + "\"compId\":" + (Number(it.compId) || 0) + ","
                + "\"compName\":" + _jsonStr(it.compName || "") + ","
                + "\"layerIndex\":" + (Number(it.layerIndex) || 0) + ","
                + "\"layerName\":" + _jsonStr(it.layerName || "") + ","
                + "\"path\":" + _jsonStr(it.path || "") + ","
                + "\"oldText\":" + _jsonStr(it.oldText || "") + ","
                + "\"newText\":" + _jsonStr(it.newText || "") + ","
                + "\"oldLen\":" + (Number(it.oldLen) || 0) + ","
                + "\"newLen\":" + (Number(it.newLen) || 0)
                + "}";
        }
        out += "]";
        return out;
    }

    function _scanActiveComp() {
        if (!app || !app.project) return null;
        var c = app.project.activeItem;
        return (c && (c instanceof CompItem)) ? c : null;
    }

    function _walkComp(comp, compPath, compsProcessed, onTextLayer, onPrecomp) {
        // Avoid loops (same comp can be referenced many times)
        for (var c = 0; c < compsProcessed.length; c++) {
            if (compsProcessed[c] === comp.id) return;
        }
        compsProcessed.push(comp.id);

        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);

            if (layer instanceof TextLayer) {
                onTextLayer(comp, layer, compPath);
            }

            if (layer && layer.source && (layer.source instanceof CompItem)) {
                onPrecomp(comp, layer, compPath);
            }
        }
    }

    scanTypographyIssues = function () {
        try {
            var activeComp = _scanActiveComp();
            if (!activeComp) return _jsonErr("No active comp");

            var issues = [];
            var compsProcessed = [];

            function scan(comp, compPath) {
                _walkComp(comp, compPath, compsProcessed, function (curComp, layer, pathArr) {
                    var textProp = layer.property("Source Text");
                    if (!textProp) return;

                    var oldText = textProp.value.toString();
                    var newText = (typeof fixTypographyText === "function") ? fixTypographyText(oldText) : oldText;
                    if (oldText === newText) return;

                    var fullPath = pathArr.join(" > ") + " > " + (layer.name || "");
                    issues.push({
                        compId: curComp.id,
                        compName: curComp.name,
                        layerIndex: layer.index,
                        layerName: layer.name,
                        path: fullPath,
                        oldText: _trimText(oldText),
                        newText: _trimText(newText),
                        oldLen: String(oldText || "").length,
                        newLen: String(newText || "").length
                    });
                }, function (curComp, layer, pathArr) {
                    var child = layer.source;
                    var nextPath = pathArr.slice(0);
                    nextPath.push(child.name);
                    scan(child, nextPath);
                });
            }

            scan(activeComp, [activeComp.name]);

            var resultJson = "{"
                + "\"total\":" + issues.length + ","
                + "\"issues\":" + _jsonIssuesArray(issues)
                + "}";

            return _jsonOk(resultJson);
        } catch (e) {
            return _jsonErr(e.message);
        }
    };

    applyTypographyFixes = function (skipList) {
        try {
            var activeComp = _scanActiveComp();
            if (!activeComp) return _jsonErr("No active comp");

            var skipArr = _parseJsonSafe(skipList);
            var skipMap = {};
            for (var i = 0; i < skipArr.length; i++) {
                var s = skipArr[i] || {};
                var key = _makeKey(s.compId, s.layerIndex);
                skipMap[key] = true;
            }

            app.beginUndoGroup("Fix Typography");

            var fixed = 0;
            var skipped = 0;
            var compsProcessed = [];

            function apply(comp, compPath) {
                _walkComp(comp, compPath, compsProcessed, function (curComp, layer) {
                    var textProp = layer.property("Source Text");
                    if (!textProp) return;

                    var oldText = textProp.value.toString();
                    var newText = (typeof fixTypographyText === "function") ? fixTypographyText(oldText) : oldText;
                    if (oldText === newText) return;

                    var key = _makeKey(curComp.id, layer.index);
                    if (skipMap[key] === true) {
                        skipped++;
                        return;
                    }

                    textProp.setValue(newText);
                    fixed++;
                }, function (curComp, layer, pathArr) {
                    var child = layer.source;
                    var nextPath = pathArr.slice(0);
                    nextPath.push(child.name);
                    apply(child, nextPath);
                });
            }

            apply(activeComp, [activeComp.name]);

            app.endUndoGroup();

            return _jsonOk("{\"fixed\":" + fixed + ",\"skipped\":" + skipped + "}");
        } catch (e) {
            try { app.endUndoGroup(); } catch (e2) {}
            return _jsonErr(e.message);
        }
    };
})();
