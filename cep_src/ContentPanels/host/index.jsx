// host/index.jsx
var rootPath = "";

function resolveRootPath() {
    if (rootPath) return rootPath;
    try {
        var f = new File($.fileName);
        if (f && f.parent && f.parent.parent) {
            rootPath = f.parent.parent.fsName;
        }
    } catch (e) {}
    return rootPath;
}

function loadModule(fileName) {
    var basePath = resolveRootPath();
    var file = new File(basePath + "/host/lib/" + fileName);
    
    if (file.exists) {
        try {
            file.open("r");
            var content = file.read();
            file.close();
            eval(content); // Выполняем код файла в глобальной области
            return "Module '" + fileName + "' Loaded OK";
        } catch (e) {
            alert("Ошибка в модуле " + fileName + ":\n" + e.message);
            return "Error";
        }
    } else {
        alert("Файл не найден: " + fileName);
        return "Not Found";
    }
}

// Эту функцию вызываем один раз при старте, чтобы запомнить путь
function initPath(path) {
    rootPath = path;
    return "Path initialized";
}
