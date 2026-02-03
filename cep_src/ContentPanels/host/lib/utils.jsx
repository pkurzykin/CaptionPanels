// host/lib/utils.jsx
// =====================================================
// Utils module (small helpers)
// =====================================================

// Глобальная функция для вызова из CEP:
// csInterface.evalScript("trimLayersInsideSelectedPrecomp()");
trimLayersInsideSelectedPrecomp = function () {
    try {
        var proj = app.project;
        var activeComp = proj ? proj.activeItem : null;

        // Проверяем активную композицию и выбор ровно одного слоя
        if (!(activeComp instanceof CompItem) || activeComp.selectedLayers.length !== 1) {
            alert("Выберите один слой-прекомпозицию в активной композиции.");
            return respondErr("No/Bad selection");
        }

        var targetLayer = activeComp.selectedLayers[0];
        var sourceComp = targetLayer.source;

        // Проверяем, что выбранный слой — прекомп
        if (!(sourceComp instanceof CompItem)) {
            alert("Выбранный слой не является прекомпозицией.");
            return respondErr("Not a precomp");
        }

        app.beginUndoGroup("Trim Layers Inside Precomp");

        // Время внутри прекомпа с учетом startTime и stretch
        // (оставлено как в твоем рабочем скрипте)
        var timeInPrecomp = (activeComp.time - targetLayer.startTime) * targetLayer.stretch / 100;

        // Обрезаем outPoint у слоев внутри прекомпа
        for (var i = 1; i <= sourceComp.numLayers; i++) {
            var layer = sourceComp.layer(i);

            if (timeInPrecomp >= layer.startTime) {
                layer.outPoint = timeInPrecomp;
            }
        }

        app.endUndoGroup();
        return respondOk("OK");

    } catch (err) {
        alert("Ошибка TRIM: " + err.message);
        try { app.endUndoGroup(); } catch (e) {}
        return respondErr(err.message);
    }
};

// =====================================================
// Shared typography (used by cleanup/subtitles/etc.)
// =====================================================

// Глобальная функция: возвращает "почищенный" текст
// Важно: не трогаем переносы строк, только нормализуем пробелы/знаки
fixTypographyText = function (txt) {
    var t = (txt === undefined || txt === null) ? "" : txt.toString();

    // Множественные пробелы -> один
    t = t.replace(/ {2,}/g, " ");

    // после точки всегда пробел
    t = t.replace(/\.([^\s\r\n])/g, ". $1");

    // исключение: убираем пробел между "." и "," если он появился
    t = t.replace(/\. +,/g, ".,");

    // после запятой всегда пробел,
    // но НЕ ставим пробел, если дальше уже пробел/перенос строки,
    // или дальше идет закрывающая пунктуация/скобки/кавычки, или еще одна запятая/точка
    t = t.replace(/,([^\s\r\n\)\]\}!?:;,.»])/g, ", $1");

    // исключение для десятичных чисел: 1,23 (и похожие)
    // если вдруг стало "1, 23" — склеиваем обратно
    t = t.replace(/(\d),\s+(\d)/g, "$1,$2");

    // " - " -> " – " (длинное тире с пробелами)
    t = t.replace(/ - /g, " – ");

    // Двойной дефис -> тире
    t = t.replace(/--/g, "–");

    // Любые вариации длинного тире приводим к одному (как в твоих правилах)
    t = t.replace(/—/g, "–");

    // Трим по краям
    t = t.replace(/^\s+|\s+$/g, "");

    // Замена обычных кавычек на елочки
            // "текст" -> «текст»
    t = t.replace(/"([^"\r\n]+)"/g, "\u00AB$1\u00BB"); // \u00AB = «, \u00BB = »

    // Защита фразы в кавычках: «Транснефть ...»
    t = t.replace(/«Транснефть[^»\r\n]*»/g, function (m) {
        // Also handle "Транснефть - Север" (hyphen-minus with any spacing) so it doesn't wrap.
        // Convert hyphen-minus between letters to an en dash with spaces, then make spaces non-breaking.
        m = m.replace(/([A-Za-zА-Яа-яЁё])\s*-\s*([A-Za-zА-Яа-яЁё])/g, "$1 – $2");
        return m.replace(/ /g, "\u00A0");
    });

    return t;
};

// =====================================================
// Project organization helpers (auto-sorting)
// Exposed globals:
//   ensureProjectFolder("A/B/C") -> FolderItem
//   moveItemToFolder(item, "A/B/C") -> "OK" / "Error"
// =====================================================

ensureProjectFolder = function (path) {
    if (!app.project) return null;

   var raw = String(path || "").split("/");
    var parts = [];
    for (var i = 0; i < raw.length; i++) {
    var p = raw[i];
    if (p && p.length > 0) parts.push(p);
}

    if (parts.length === 0) return null;

    var current = app.project.rootFolder;

    for (var i = 0; i < parts.length; i++) {
        var name = parts[i];
        var found = null;

        // ищем подпапку с таким именем
        for (var j = 1; j <= current.numItems; j++) {
            var it = current.item(j);
            if (it && (it instanceof FolderItem) && it.name === name) {
                found = it;
                break;
            }
        }

        // если нет — создаём
        if (!found) {
            found = app.project.items.addFolder(name);
            found.parentFolder = current;
        }

        current = found;
    }

    return current;
};

moveItemToFolder = function (item, folderPath) {
    try {
        if (!app.project) return respondErr("No project");
        if (!item) return respondErr("No item");

        var dest = ensureProjectFolder(folderPath);
        if (!dest) return respondErr("No destination");

        // Не перемещаем папку саму в себя/внутрь себя
        if (item instanceof FolderItem) {
            // запрет на перенос папки в свою же ветку
            var f = dest;
            while (f) {
                if (f === item) return respondErr("Blocked: recursive folder move");
                if (f === app.project.rootFolder) break;
                f = f.parentFolder;
            }
        }

        item.parentFolder = dest;
        return respondOk("OK");
    } catch (e) {
        return respondErr(e.message);
    }
};
