// ui_topics.js
// Topic dropdown handling (rubrics)
//
// - Uses TOPIC_OPTIONS as the current list.
// - Default list is TOPIC_OPTIONS_DEFAULT.
// - Settings modal can update the list at runtime via setTopicOptions(list).

var TOPIC_OPTIONS_DEFAULT = [
    "Новости",
    "Специальный репортаж",
    "Транснефть помогает",
    "Волонтеры Транснефти",
    "Люди компании",
    "Новость дня",
    "Оптимум",
    "Спорт"
];

var TOPIC_OPTIONS = TOPIC_OPTIONS_DEFAULT.slice();

function getTopicOptions() {
    return TOPIC_OPTIONS.slice();
}

function setTopicOptions(list) {
    if (!(list instanceof Array)) return;
    TOPIC_OPTIONS = list.slice();
    renderTopicDropdown();
}

function renderTopicDropdown() {
    var topicDropdown = document.getElementById("topic-dropdown");
    var topicInput = document.getElementById("input-head-topic");
    if (!topicDropdown) return;

    topicDropdown.innerHTML = "";
    TOPIC_OPTIONS.forEach(function (name) {
        var item = document.createElement("div");
        item.className = "topic-item";
        item.textContent = name;
        item.addEventListener("click", function () {
            if (topicInput) topicInput.value = name;
            topicDropdown.classList.remove("open");
        });
        topicDropdown.appendChild(item);
    });
}

function loadTopicOptionsFromConfig() {
    // Optional: overrides TOPIC_OPTIONS from config.json if present.
    // Safe to call multiple times.
    CPHostAPI.call("getConfigForUI", [], { module: "topics", timeoutMs: 10000 }, function (out) {
        if (!out || !out.ok) return;
        var res = out.result || {};
        if (res.topicOptions && res.topicOptions.length) {
            TOPIC_OPTIONS = res.topicOptions.slice();
            renderTopicDropdown();
        }
    });
}

function initTopicDropdown() {
    var topicField = document.getElementById("topic-field");
    var topicDropdown = document.getElementById("topic-dropdown");
    var topicToggle = document.getElementById("btn-topic-dropdown");

    function closeTopicDropdown() {
        if (topicDropdown) topicDropdown.classList.remove("open");
    }

    function toggleTopicDropdown() {
        if (!topicDropdown) return;
        topicDropdown.classList.toggle("open");
    }

    renderTopicDropdown();

    if (topicToggle) {
        topicToggle.addEventListener("click", function (e) {
            e.stopPropagation();
            toggleTopicDropdown();
        });
    }

    document.addEventListener("click", function (e) {
        if (!topicField) return;
        if (topicField.contains(e.target)) return;
        closeTopicDropdown();
    });
}
