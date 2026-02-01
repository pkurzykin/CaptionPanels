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
        csInterface.evalScript('loadModule("' + name + '")', function () {
            next();
        });
    }

    csInterface.evalScript('initPath("' + extensionPath + '")', function () {
        next();
    });
}
