"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.createXlfFilesForExtensions = exports.packageADSExtensionsStream = exports.packageLangpacksStream = void 0;
const es = require("event-stream");
const fs = require("fs");
const Is = require("is");
const path = require("path");
const gulp = require("gulp");
const glob = require("glob");
const rename = require("gulp-rename");
const event_stream_1 = require("event-stream");
const File = require("vinyl");
const i18n = require("./i18n");
const ext = require("./extensions");
const root = path.dirname(path.dirname(__dirname));
const extensionsProject = 'extensions';
// Modified packageLocalExtensionsStream from extensions.ts, but for langpacks.
function packageLangpacksStream() {
    const langpackDescriptions = glob.sync('i18n/*/package.json')
        .map(manifestPath => {
        const langpackPath = path.dirname(path.join(root, manifestPath));
        const langpackName = path.basename(langpackPath);
        return { name: langpackName, path: langpackPath };
    });
    const builtLangpacks = langpackDescriptions.map(langpack => {
        return ext.fromLocalNormal(langpack.path)
            .pipe(rename(p => p.dirname = `langpacks/${langpack.name}/${p.dirname}`));
    });
    return es.merge(builtLangpacks);
}
exports.packageLangpacksStream = packageLangpacksStream;
function packageADSExtensionsStream() {
    const currentADSJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../i18n/ADSExtensions.json'), 'utf8'));
    const ADSExtensions = currentADSJson.ADSExtensions;
    const extenalExtensionDescriptions = glob.sync('extensions/*/package.json')
        .map(manifestPath => {
        const extensionPath = path.dirname(path.join(root, manifestPath));
        const extensionName = path.basename(extensionPath);
        return { name: extensionName, path: extensionPath };
    })
        .filter(({ name }) => ADSExtensions[name] !== undefined);
    const builtExtensions = extenalExtensionDescriptions.map(extension => {
        return ext.fromLocal(extension.path, false)
            .pipe(rename(p => p.dirname = `extensions/${extension.name}/${p.dirname}`));
    });
    return es.merge(builtExtensions);
}
exports.packageADSExtensionsStream = packageADSExtensionsStream;
function createXlfFilesForExtensions() {
    let counter = 0;
    let folderStreamEnded = false;
    let folderStreamEndEmitted = false;
    return event_stream_1.through(function (extensionFolder) {
        const folderStream = this;
        const stat = fs.statSync(extensionFolder.path);
        if (!stat.isDirectory()) {
            return;
        }
        let extensionName = path.basename(extensionFolder.path);
        counter++;
        let _xlf;
        function getXlf() {
            if (!_xlf) {
                _xlf = new i18n.XLF(extensionsProject);
            }
            return _xlf;
        }
        gulp.src([`.locbuild/extensions/${extensionName}/package.nls.json`, `.locbuild/extensions/${extensionName}/**/nls.metadata.json`], { allowEmpty: true }).pipe(event_stream_1.through(function (file) {
            if (file.isBuffer()) {
                const buffer = file.contents;
                const basename = path.basename(file.path);
                if (basename === 'package.nls.json') {
                    const json = JSON.parse(buffer.toString('utf8'));
                    const keys = Object.keys(json);
                    const messages = keys.map((key) => {
                        const value = json[key];
                        if (Is.string(value)) {
                            return value;
                        }
                        else if (value) {
                            return value.message;
                        }
                        else {
                            return `Unknown message for key: ${key}`;
                        }
                    });
                    getXlf().addFile(`extensions/${extensionName}/package`, keys, messages);
                }
                else if (basename === 'nls.metadata.json') {
                    const json = JSON.parse(buffer.toString('utf8'));
                    const relPath = path.relative(`.locbuild/extensions/${extensionName}`, path.dirname(file.path));
                    for (let file in json) {
                        const fileContent = json[file];
                        getXlf().addFile(`extensions/${extensionName}/${relPath}/${file}`, fileContent.keys, fileContent.messages);
                    }
                }
                else {
                    this.emit('error', new Error(`${file.path} is not a valid extension nls file`));
                    return;
                }
            }
        }, function () {
            if (_xlf) {
                let xlfFile = new File({
                    path: path.join(extensionsProject, extensionName + '.xlf'),
                    contents: Buffer.from(_xlf.toString(), 'utf8')
                });
                folderStream.queue(xlfFile);
            }
            this.queue(null);
            counter--;
            if (counter === 0 && folderStreamEnded && !folderStreamEndEmitted) {
                folderStreamEndEmitted = true;
                folderStream.queue(null);
            }
        }));
    }, function () {
        folderStreamEnded = true;
        if (counter === 0) {
            folderStreamEndEmitted = true;
            this.queue(null);
        }
    });
}
exports.createXlfFilesForExtensions = createXlfFilesForExtensions;
var LocalizeInfo;
(function (LocalizeInfo) {
    function is(value) {
        let candidate = value;
        return Is.defined(candidate) && Is.string(candidate.key) && (Is.undef(candidate.comment) || (Is.array(candidate.comment) && candidate.comment.every(element => Is.string(element))));
    }
    LocalizeInfo.is = is;
})(LocalizeInfo || (LocalizeInfo = {}));
var PackageJsonFormat;
(function (PackageJsonFormat) {
    function is(value) {
        if (Is.undef(value) || !Is.object(value)) {
            return false;
        }
        return Object.keys(value).every(key => {
            let element = value[key];
            return Is.string(element) || (Is.object(element) && Is.defined(element.message) && Is.defined(element.comment));
        });
    }
    PackageJsonFormat.is = is;
})(PackageJsonFormat || (PackageJsonFormat = {}));
