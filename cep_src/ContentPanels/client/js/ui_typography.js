// ui_typography.js
// FixTypography report modal

var TYPO_ISSUES = [];

function _escapeHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function _diffHighlightHtml(oldText, newText) {
    var a = String(oldText || "");
    var b = String(newText || "");
    if (a === b) {
        return { oldHtml: _escapeHtml(a), newHtml: _escapeHtml(b) };
    }

    // Cheap & readable diff: common prefix + common suffix.
    // Works well for our typography changes (spaces/dashes/quotes) and is fast.
    var i = 0;
    var max = Math.min(a.length, b.length);
    while (i < max && a.charAt(i) === b.charAt(i)) i++;

    var aEnd = a.length - 1;
    var bEnd = b.length - 1;
    while (aEnd >= i && bEnd >= i && a.charAt(aEnd) === b.charAt(bEnd)) {
        aEnd--;
        bEnd--;
    }

    var aMid = a.substring(i, aEnd + 1);
    var bMid = b.substring(i, bEnd + 1);

    // If the change is a pure insertion/deletion, the mid part could be empty.
    // In practice our typography fixes almost always replace characters, so we keep this simple.
    var oldHtml =
        _escapeHtml(a.substring(0, i)) +
        "<span class=\"typo-hl-old\">" + _escapeHtml(aMid) + "</span>" +
        _escapeHtml(a.substring(aEnd + 1));

    var newHtml =
        _escapeHtml(b.substring(0, i)) +
        "<span class=\"typo-hl-new\">" + _escapeHtml(bMid) + "</span>" +
        _escapeHtml(b.substring(bEnd + 1));

    return { oldHtml: oldHtml, newHtml: newHtml };
}

function _typoOpen() {
    var overlay = document.getElementById("typo-overlay");
    if (overlay) overlay.style.display = "block";
}

function _typoClose() {
    var overlay = document.getElementById("typo-overlay");
    if (overlay) overlay.style.display = "none";
}

function _typoRender() {
    var list = document.getElementById("typo-list");
    var countEl = document.getElementById("typo-count");
    if (!list) return;

    if (countEl) countEl.textContent = String(TYPO_ISSUES.length);
    list.innerHTML = "";

    if (!TYPO_ISSUES.length) {
        var empty = document.createElement("div");
        empty.className = "typo-empty";
        empty.textContent = "Ошибок не найдено.";
        list.appendChild(empty);
        return;
    }

    for (var i = 0; i < TYPO_ISSUES.length; i++) {
        var it = TYPO_ISSUES[i] || {};

        var row = document.createElement("div");
        row.className = "typo-row";

        var chk = document.createElement("input");
        chk.type = "checkbox";
        chk.className = "typo-skip";
        chk.dataset.compId = String(it.compId || "");
        chk.dataset.layerIndex = String(it.layerIndex || "");

        var meta = document.createElement("div");
        meta.className = "typo-meta";

        var path = document.createElement("div");
        path.className = "typo-path";
        path.textContent = it.path || (it.compName || "") + " > " + (it.layerName || "");

        var diff = document.createElement("div");
        diff.className = "typo-diff";

        var h = _diffHighlightHtml(it.oldText || "", it.newText || "");

        var oldBox = document.createElement("div");
        oldBox.className = "typo-old";
        var oldLbl = document.createElement("div");
        oldLbl.className = "typo-lbl";
        oldLbl.textContent = "Было";
        var oldTxt = document.createElement("pre");
        oldTxt.className = "typo-txt";
        oldTxt.innerHTML = h.oldHtml;
        oldBox.appendChild(oldLbl);
        oldBox.appendChild(oldTxt);

        var newBox = document.createElement("div");
        newBox.className = "typo-new";
        var newLbl = document.createElement("div");
        newLbl.className = "typo-lbl";
        newLbl.textContent = "Станет";
        var newTxt = document.createElement("pre");
        newTxt.className = "typo-txt";
        newTxt.innerHTML = h.newHtml;
        newBox.appendChild(newLbl);
        newBox.appendChild(newTxt);

        diff.appendChild(oldBox);
        diff.appendChild(newBox);

        meta.appendChild(path);
        meta.appendChild(diff);

        row.appendChild(chk);
        row.appendChild(meta);
        list.appendChild(row);
    }
}

function _typoCollectSkipList() {
    var nodes = document.querySelectorAll(".typo-skip");
    var out = [];
    nodes.forEach(function (n) {
        if (!n.checked) return;
        out.push({
            compId: Number(n.dataset.compId),
            layerIndex: Number(n.dataset.layerIndex)
        });
    });
    return out;
}

function openTypographyScan() {
    aeCall("scanTypographyIssues()", function (out) {
        if (!out || !out.ok) {
            uiAlert("FixTypography: ошибка сканирования.\n" + (out ? (out.error || out.result) : "Unknown"));
            return;
        }
        var res = out.result || {};
        TYPO_ISSUES = res.issues || [];
        _typoRender();
        _typoOpen();
    });
}

function initTypographyUI() {
    attachClick("btn-deep-clean", function () { openTypographyScan(); });
    attachClick("btn-typo-close", function () { _typoClose(); });

    var overlay = document.getElementById("typo-overlay");
    if (overlay) {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) _typoClose();
        });
    }

    attachClick("btn-typo-fix-all", function () {
        aeCall("applyTypographyFixes([])", function (out) {
            if (!out || !out.ok) {
                uiAlert("FixTypography: ошибка.\n" + (out ? (out.error || out.result) : "Unknown"));
                return;
            }
            var res = out.result || {};
            _typoClose();
            uiAlert("Готово. Исправлено: " + (res.fixed || 0) + ". Пропущено: " + (res.skipped || 0));
        });
    });

    attachClick("btn-typo-fix-except", function () {
        var skip = _typoCollectSkipList();
        var cmd = "applyTypographyFixes(" + JSON.stringify(skip) + ")";
        aeCall(cmd, function (out) {
            if (!out || !out.ok) {
                uiAlert("FixTypography: ошибка.\n" + (out ? (out.error || out.result) : "Unknown"));
                return;
            }
            var res = out.result || {};
            _typoClose();
            uiAlert("Готово. Исправлено: " + (res.fixed || 0) + ". Пропущено: " + (res.skipped || 0));
        });
    });
}
