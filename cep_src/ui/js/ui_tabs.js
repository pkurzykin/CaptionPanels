// ui_tabs.js
// Tabs handling

window.openTab = function (evt, tabName) {
    var i, tabcontent, tablinks;

    // 1. Скрываем все блоки
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].style.visibility = "hidden";
    }

    // 2. Деактивируем все кнопки вкладок
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // 3. Показываем нужную вкладку
    var targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.style.display = "block";
        targetTab.style.visibility = "visible";
        evt.currentTarget.className += " active";
    }
};

function initTabs() {
    var firstTab = document.querySelector(".tab-link");
    if (firstTab) firstTab.click();
}
