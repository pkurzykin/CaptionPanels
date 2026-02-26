// host_loader.js
// Sequential JSX module loader

function loadHostModules(modules, cb) {
    var extensionPath = getExtensionRootPath();
    var list = modules || [];
    var i = 0;

    function next() {
        if (i >= list.length) {
            if (typeof cb === "function") cb("OK");
            return;
        }
        var name = list[i++];
        callHost("loadModule", [name], { module: "loader", timeoutMs: 15000 }, function () {
            next();
        });
    }

    callHost("initPath", [extensionPath], { module: "loader", timeoutMs: 10000 }, function () {
        next();
    });
}
