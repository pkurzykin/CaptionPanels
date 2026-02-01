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
