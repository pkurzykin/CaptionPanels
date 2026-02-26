// host/lib/schema_validation.jsx
// =====================================================
// Runtime schema validators (Stage 3.2)
// Exposed globals:
//   cpValidateImportPayload(obj)
//   cpValidateBlocksPayload(obj)
//   cpValidateAlignmentPayload(obj)
// =====================================================

(function () {
    function _isArray(v) {
        return v instanceof Array;
    }

    function _isObj(v) {
        return !!v && typeof v === "object" && !_isArray(v);
    }

    function _isNum(v) {
        var n = Number(v);
        return !isNaN(n) && isFinite(n);
    }

    function _s(v) {
        return String(v || "");
    }

    function _normType(t) {
        return _s(t).toLowerCase();
    }

    function _trim(v) {
        return _s(v).replace(/^\s+|\s+$/g, "");
    }

    function _newReport(kind) {
        return {
            schema: _s(kind),
            ok: true,
            errors: [],
            warnings: [],
            stats: {}
        };
    }

    function _fail(r, msg) {
        r.ok = false;
        r.errors.push(_s(msg));
    }

    function _warn(r, msg) {
        r.warnings.push(_s(msg));
    }

    function _validateImport(obj) {
        var r = _newReport("import");
        if (!_isObj(obj)) {
            _fail(r, "root must be an object");
            return r;
        }

        var segments = obj.segments;
        if (!_isArray(segments)) {
            _fail(r, "segments must be an array");
            return r;
        }
        if (!segments.length) _fail(r, "segments array is empty");

        var voiceCnt = 0;
        var syncCnt = 0;
        var geoCnt = 0;

        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            if (!_isObj(seg)) {
                _fail(r, "segments[" + i + "] must be an object");
                continue;
            }

            var t = _normType(seg.type);
            if (!t) {
                _fail(r, "segments[" + i + "].type is required");
                continue;
            }

            if (t === "voiceover") voiceCnt++;
            else if (t === "sync" || t === "synch") syncCnt++;
            else if (t === "geotag") geoCnt++;
            else _warn(r, "segments[" + i + "].type is unknown: " + t);

            if ((t === "voiceover" || t === "sync" || t === "synch") && !_trim(seg.text)) {
                _fail(r, "segments[" + i + "].text is empty for subtitle segment");
            }
        }

        if (voiceCnt + syncCnt <= 0) _warn(r, "no subtitle segments found (voiceover/sync)");
        r.stats = {
            segments: segments.length,
            voiceover: voiceCnt,
            synch: syncCnt,
            geotag: geoCnt
        };
        return r;
    }

    function _validateBlocks(obj) {
        var r = _newReport("blocks");
        if (!_isObj(obj)) {
            _fail(r, "root must be an object");
            return r;
        }

        if (!_isNum(obj.schemaVersion)) _warn(r, "schemaVersion is missing or not numeric");

        var source = obj.source;
        if (!_isObj(source)) _warn(r, "source section is missing");
        else {
            if (!_trim(source.compName)) _warn(r, "source.compName is empty");
            if (!_isNum(source.fps) || Number(source.fps) <= 0) _warn(r, "source.fps is missing or invalid");
        }

        var blocks = obj.blocks;
        if (!_isArray(blocks)) {
            _fail(r, "blocks must be an array");
            return r;
        }
        if (!blocks.length) _fail(r, "blocks array is empty");

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!_isObj(b)) {
                _fail(r, "blocks[" + i + "] must be an object");
                continue;
            }
            if (!_trim(b.segId)) _fail(r, "blocks[" + i + "].segId is required");
            if (!_trim(b.text)) _warn(r, "blocks[" + i + "].text is empty");
            if (!_isNum(b.start)) _warn(r, "blocks[" + i + "].start is missing");
            if (!_isNum(b.end)) _warn(r, "blocks[" + i + "].end is missing");
            if (_isNum(b.start) && _isNum(b.end) && Number(b.end) <= Number(b.start)) {
                _fail(r, "blocks[" + i + "].end must be greater than start");
            }
        }

        r.stats = { blocks: blocks.length };
        return r;
    }

    function _validateAlignment(obj) {
        var r = _newReport("alignment");
        if (!_isObj(obj)) {
            _fail(r, "root must be an object");
            return r;
        }

        if (!_isNum(obj.schemaVersion)) _warn(r, "schemaVersion is missing or not numeric");

        var blocks = obj.blocks;
        if (!_isArray(blocks)) {
            _fail(r, "blocks must be an array");
            return r;
        }
        if (!blocks.length) _fail(r, "blocks array is empty");

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (!_isObj(b)) {
                _fail(r, "blocks[" + i + "] must be an object");
                continue;
            }
            if (!_trim(b.segId)) _fail(r, "blocks[" + i + "].segId is required");
            if (!_isNum(b.start)) _fail(r, "blocks[" + i + "].start is required");
            if (!_isNum(b.end)) _fail(r, "blocks[" + i + "].end is required");
            if (_isNum(b.start) && _isNum(b.end) && Number(b.end) <= Number(b.start)) {
                _fail(r, "blocks[" + i + "].end must be greater than start");
            }
            if (typeof b.confidence !== "undefined" && !_isNum(b.confidence)) {
                _warn(r, "blocks[" + i + "].confidence is not numeric");
            }
        }

        if (obj.unmatched && !_isArray(obj.unmatched)) {
            _warn(r, "unmatched exists but is not an array");
        }

        r.stats = {
            blocks: blocks.length,
            unmatched: _isArray(obj.unmatched) ? obj.unmatched.length : 0
        };
        return r;
    }

    cpValidateImportPayload = function (obj) {
        return _validateImport(obj);
    };

    cpValidateBlocksPayload = function (obj) {
        return _validateBlocks(obj);
    };

    cpValidateAlignmentPayload = function (obj) {
        return _validateAlignment(obj);
    };

    // Bridge-friendly wrappers for manual diagnostics.
    validateImportPayloadBridge = function (jsonText) {
        try {
            var obj = null;
            try { obj = JSON.parse(_s(jsonText)); } catch (e1) { obj = eval("(" + _s(jsonText) + ")"); }
            return respondOk(_validateImport(obj));
        } catch (e) {
            return respondErr(e.message || String(e));
        }
    };

    validateBlocksPayloadBridge = function (jsonText) {
        try {
            var obj = null;
            try { obj = JSON.parse(_s(jsonText)); } catch (e1) { obj = eval("(" + _s(jsonText) + ")"); }
            return respondOk(_validateBlocks(obj));
        } catch (e) {
            return respondErr(e.message || String(e));
        }
    };

    validateAlignmentPayloadBridge = function (jsonText) {
        try {
            var obj = null;
            try { obj = JSON.parse(_s(jsonText)); } catch (e1) { obj = eval("(" + _s(jsonText) + ")"); }
            return respondOk(_validateAlignment(obj));
        } catch (e) {
            return respondErr(e.message || String(e));
        }
    };

    try {
        if ($ && $.global) {
            $.global.cpValidateImportPayload = cpValidateImportPayload;
            $.global.cpValidateBlocksPayload = cpValidateBlocksPayload;
            $.global.cpValidateAlignmentPayload = cpValidateAlignmentPayload;
            $.global.validateImportPayloadBridge = validateImportPayloadBridge;
            $.global.validateBlocksPayloadBridge = validateBlocksPayloadBridge;
            $.global.validateAlignmentPayloadBridge = validateAlignmentPayloadBridge;
        }
    } catch (eG) {}
})();
