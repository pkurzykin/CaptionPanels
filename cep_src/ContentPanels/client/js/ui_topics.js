// ui_topics.js
// Topic dropdown handling

var TOPIC_OPTIONS = [
    "Новости",
    "Специальный репортаж",
    "Транснефть помогает",
    "Волонтеры Транснефти",
    "Люди компании",
    "Новость дня",
    "Оптимум"
];

function initTopicDropdown() {
    var topicField = document.getElementById("topic-field");
    var topicDropdown = document.getElementById("topic-dropdown");
    var topicToggle = document.getElementById("btn-topic-dropdown");
    var topicInput = document.getElementById("input-head-topic");

    function closeTopicDropdown() {
        if (topicDropdown) topicDropdown.classList.remove("open");
    }

    function toggleTopicDropdown() {
        if (!topicDropdown) return;
        topicDropdown.classList.toggle("open");
    }

    if (topicDropdown) {
        topicDropdown.innerHTML = "";
        TOPIC_OPTIONS.forEach(function (name) {
            var item = document.createElement("div");
            item.className = "topic-item";
            item.textContent = name;
            item.addEventListener("click", function () {
                if (topicInput) topicInput.value = name;
                closeTopicDropdown();
            });
            topicDropdown.appendChild(item);
        });
    }

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
