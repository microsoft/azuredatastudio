"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareIslFiles = exports.prepareI18nPackFiles = exports.i18nPackVersion = exports.createI18nFile = exports.createXlfFilesForIsl = exports.createXlfFilesForExtensions = exports.EXTERNAL_EXTENSIONS = exports.createXlfFilesForCoreBundle = exports.getResource = exports.processNlsFiles = exports.XLF = exports.Line = exports.extraLanguages = exports.defaultLanguages = void 0;
const path = require("path");
const fs = require("fs");
const event_stream_1 = require("event-stream");
const jsonMerge = require("gulp-merge-json");
const File = require("vinyl");
const Is = require("is");
const xml2js = require("xml2js");
const gulp = require("gulp");
const fancyLog = require("fancy-log");
const ansiColors = require("ansi-colors");
const iconv = require("@vscode/iconv-lite-umd");
const l10n_dev_1 = require("@vscode/l10n-dev");
function log(message, ...rest) {
    fancyLog(ansiColors.green('[i18n]'), message, ...rest);
}
exports.defaultLanguages = [
    { id: 'zh-tw', folderName: 'cht', translationId: 'zh-hant' },
    { id: 'zh-cn', folderName: 'chs', translationId: 'zh-hans' },
    { id: 'ja', folderName: 'jpn' },
    { id: 'ko', folderName: 'kor' },
    { id: 'de', folderName: 'deu' },
    { id: 'fr', folderName: 'fra' },
    { id: 'es', folderName: 'esn' },
    { id: 'ru', folderName: 'rus' },
    { id: 'it', folderName: 'ita' }
];
// languages requested by the community to non-stable builds
exports.extraLanguages = [
    { id: 'pt-br', folderName: 'ptb' },
    { id: 'hu', folderName: 'hun' },
    { id: 'tr', folderName: 'trk' }
];
var LocalizeInfo;
(function (LocalizeInfo) {
    function is(value) {
        const candidate = value;
        return Is.defined(candidate) && Is.string(candidate.key) && (Is.undef(candidate.comment) || (Is.array(candidate.comment) && candidate.comment.every(element => Is.string(element))));
    }
    LocalizeInfo.is = is;
})(LocalizeInfo || (LocalizeInfo = {}));
var BundledFormat;
(function (BundledFormat) {
    function is(value) {
        if (Is.undef(value)) {
            return false;
        }
        const candidate = value;
        const length = Object.keys(value).length;
        return length === 3 && Is.defined(candidate.keys) && Is.defined(candidate.messages) && Is.defined(candidate.bundles);
    }
    BundledFormat.is = is;
})(BundledFormat || (BundledFormat = {}));
class Line {
    buffer = [];
    constructor(indent = 0) {
        if (indent > 0) {
            this.buffer.push(new Array(indent + 1).join(' '));
        }
    }
    append(value) {
        this.buffer.push(value);
        return this;
    }
    toString() {
        return this.buffer.join('');
    }
}
exports.Line = Line;
class TextModel {
    _lines;
    constructor(contents) {
        this._lines = contents.split(/\r\n|\r|\n/);
    }
    get lines() {
        return this._lines;
    }
}
class XLF {
    project;
    buffer;
    files;
    numberOfMessages;
    constructor(project) {
        this.project = project;
        this.buffer = [];
        this.files = Object.create(null);
        this.numberOfMessages = 0;
    }
    toString() {
        this.appendHeader();
        const files = Object.keys(this.files).sort();
        for (const file of files) {
            this.appendNewLine(`<file original="${file}" source-language="en" datatype="plaintext"><body>`, 2);
            const items = this.files[file].sort((a, b) => {
                return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
            });
            for (const item of items) {
                this.addStringItem(file, item);
            }
            this.appendNewLine('</body></file>');
        }
        this.appendFooter();
        return this.buffer.join('\r\n');
    }
    addFile(original, keys, messages) {
        if (keys.length === 0) {
            console.log('No keys in ' + original);
            return;
        }
        if (keys.length !== messages.length) {
            throw new Error(`Unmatching keys(${keys.length}) and messages(${messages.length}).`);
        }
        this.numberOfMessages += keys.length;
        this.files[original] = [];
        const existingKeys = new Set();
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            let realKey;
            let comment;
            if (Is.string(key)) {
                realKey = key;
                comment = undefined;
            }
            else if (LocalizeInfo.is(key)) {
                realKey = key.key;
                if (key.comment && key.comment.length > 0) {
                    comment = key.comment.map(comment => encodeEntities(comment)).join('\r\n');
                }
            }
            if (!realKey || existingKeys.has(realKey)) {
                continue;
            }
            existingKeys.add(realKey);
            const message = encodeEntities(messages[i]);
            this.files[original].push({ id: realKey, message: message, comment: comment });
        }
    }
    addStringItem(file, item) {
        if (!item.id || item.message === undefined || item.message === null) {
            throw new Error(`No item ID or value specified: ${JSON.stringify(item)}. File: ${file}`);
        }
        if (item.message.length === 0) {
            log(`Item with id ${item.id} in file ${file} has an empty message.`);
        }
        this.appendNewLine(`<trans-unit id="${item.id}">`, 4);
        this.appendNewLine(`<source xml:lang="en">${item.message}</source>`, 6);
        if (item.comment) {
            this.appendNewLine(`<note>${item.comment}</note>`, 6);
        }
        this.appendNewLine('</trans-unit>', 4);
    }
    appendHeader() {
        this.appendNewLine('<?xml version="1.0" encoding="utf-8"?>', 0);
        this.appendNewLine('<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">', 0);
    }
    appendFooter() {
        this.appendNewLine('</xliff>', 0);
    }
    appendNewLine(content, indent) {
        const line = new Line(indent);
        line.append(content);
        this.buffer.push(line.toString());
    }
    static parsePseudo = function (xlfString) {
        return new Promise((resolve) => {
            const parser = new xml2js.Parser();
            const files = [];
            parser.parseString(xlfString, function (_err, result) {
                const fileNodes = result['xliff']['file'];
                fileNodes.forEach(file => {
                    const originalFilePath = file.$.original;
                    const messages = {};
                    const transUnits = file.body[0]['trans-unit'];
                    if (transUnits) {
                        transUnits.forEach((unit) => {
                            const key = unit.$.id;
                            const val = pseudify(unit.source[0]['_'].toString());
                            if (key && val) {
                                messages[key] = decodeEntities(val);
                            }
                        });
                        files.push({ messages: messages, originalFilePath: originalFilePath, language: 'ps' });
                    }
                });
                resolve(files);
            });
        });
    };
    static org_parse = function (xlfString) {
        return new Promise((resolve, reject) => {
            const parser = new xml2js.Parser();
            const files = [];
            parser.parseString(xlfString, function (err, result) {
                if (err) {
                    reject(new Error(`XLF parsing error: Failed to parse XLIFF string. ${err}`));
                }
                const fileNodes = result['xliff']['file'];
                if (!fileNodes) {
                    reject(new Error(`XLF parsing error: XLIFF file does not contain "xliff" or "file" node(s) required for parsing.`));
                }
                fileNodes.forEach((file) => {
                    const originalFilePath = file.$.original;
                    if (!originalFilePath) {
                        reject(new Error(`XLF parsing error: XLIFF file node does not contain original attribute to determine the original location of the resource file.`));
                    }
                    const language = file.$['target-language'];
                    if (!language) {
                        reject(new Error(`XLF parsing error: XLIFF file node does not contain target-language attribute to determine translated language.`));
                    }
                    const messages = {};
                    const transUnits = file.body[0]['trans-unit'];
                    if (transUnits) {
                        transUnits.forEach((unit) => {
                            const key = unit.$.id;
                            if (!unit.target) {
                                return; // No translation available
                            }
                            let val = unit.target[0];
                            if (typeof val !== 'string') {
                                // We allow empty source values so support them for translations as well.
                                val = val._ ? val._ : '';
                            }
                            if (!key) {
                                reject(new Error(`XLF parsing error: trans-unit ${JSON.stringify(unit, undefined, 0)} defined in file ${originalFilePath} is missing the ID attribute.`));
                                return;
                            }
                            messages[key] = decodeEntities(val);
                        });
                        files.push({ messages: messages, originalFilePath: originalFilePath, language: language.toLowerCase() });
                    }
                });
                resolve(files);
            });
        });
    };
    static parse = function (xlfString) {
        return new Promise((resolve, reject) => {
            const parser = new xml2js.Parser();
            const files = [];
            parser.parseString(xlfString, function (err, result) {
                if (err) {
                    reject(new Error(`XLF parsing error: Failed to parse XLIFF string. ${err}`));
                }
                const fileNodes = result['xliff']['file'];
                if (!fileNodes) {
                    reject(new Error(`XLF parsing error: XLIFF file does not contain "xliff" or "file" node(s) required for parsing.`));
                }
                fileNodes.forEach((file) => {
                    const name = file.$.original;
                    if (!name) {
                        reject(new Error(`XLF parsing error: XLIFF file node does not contain original attribute to determine the original location of the resource file.`));
                    }
                    const language = file.$['target-language'];
                    if (!language) {
                        reject(new Error(`XLF parsing error: XLIFF file node does not contain target-language attribute to determine translated language.`));
                    }
                    const messages = {};
                    const transUnits = file.body[0]['trans-unit'];
                    if (transUnits) {
                        transUnits.forEach((unit) => {
                            const key = unit.$.id;
                            if (!unit.target) {
                                return; // No translation available
                            }
                            let val = unit.target[0];
                            if (typeof val !== 'string') {
                                // We allow empty source values so support them for translations as well.
                                val = val._ ? val._ : '';
                            }
                            if (!key) {
                                reject(new Error(`XLF parsing error: trans-unit ${JSON.stringify(unit, undefined, 0)} defined in file ${name} is missing the ID attribute.`));
                                return;
                            }
                            messages[key] = decodeEntities(val);
                        });
                        files.push({ messages, name, language: language.toLowerCase() });
                    }
                });
                resolve(files);
            });
        });
    };
}
exports.XLF = XLF;
function sortLanguages(languages) {
    return languages.sort((a, b) => {
        return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
}
function stripComments(content) {
    // Copied from stripComments.js
    //
    // First group matches a double quoted string
    // Second group matches a single quoted string
    // Third group matches a multi line comment
    // Forth group matches a single line comment
    // Fifth group matches a trailing comma
    const regexp = /("[^"\\]*(?:\\.[^"\\]*)*")|('[^'\\]*(?:\\.[^'\\]*)*')|(\/\*[^\/\*]*(?:(?:\*|\/)[^\/\*]*)*?\*\/)|(\/{2,}.*?(?:(?:\r?\n)|$))|(,\s*[}\]])/g;
    const result = content.replace(regexp, (match, _m1, _m2, m3, m4, m5) => {
        // Only one of m1, m2, m3, m4, m5 matches
        if (m3) {
            // A block comment. Replace with nothing
            return '';
        }
        else if (m4) {
            // Since m4 is a single line comment is is at least of length 2 (e.g. //)
            // If it ends in \r?\n then keep it.
            const length = m4.length;
            if (m4[length - 1] === '\n') {
                return m4[length - 2] === '\r' ? '\r\n' : '\n';
            }
            else {
                return '';
            }
        }
        else if (m5) {
            // Remove the trailing comma
            return match.substring(1);
        }
        else {
            // We match a string
            return match;
        }
    });
    return result;
}
function escapeCharacters(value) {
    const result = [];
    for (let i = 0; i < value.length; i++) {
        const ch = value.charAt(i);
        switch (ch) {
            case '\'':
                result.push('\\\'');
                break;
            case '"':
                result.push('\\"');
                break;
            case '\\':
                result.push('\\\\');
                break;
            case '\n':
                result.push('\\n');
                break;
            case '\r':
                result.push('\\r');
                break;
            case '\t':
                result.push('\\t');
                break;
            case '\b':
                result.push('\\b');
                break;
            case '\f':
                result.push('\\f');
                break;
            default:
                result.push(ch);
        }
    }
    return result.join('');
}
function processCoreBundleFormat(fileHeader, languages, json, emitter) {
    const keysSection = json.keys;
    const messageSection = json.messages;
    const bundleSection = json.bundles;
    const statistics = Object.create(null);
    const defaultMessages = Object.create(null);
    const modules = Object.keys(keysSection);
    modules.forEach((module) => {
        const keys = keysSection[module];
        const messages = messageSection[module];
        if (!messages || keys.length !== messages.length) {
            emitter.emit('error', `Message for module ${module} corrupted. Mismatch in number of keys and messages.`);
            return;
        }
        const messageMap = Object.create(null);
        defaultMessages[module] = messageMap;
        keys.map((key, i) => {
            if (typeof key === 'string') {
                messageMap[key] = messages[i];
            }
            else {
                messageMap[key.key] = messages[i];
            }
        });
    });
    const languageDirectory = path.join(__dirname, '..', '..', '..', 'vscode-loc', 'i18n');
    if (!fs.existsSync(languageDirectory)) {
        log(`No VS Code localization repository found. Looking at ${languageDirectory}`);
        log(`To bundle translations please check out the vscode-loc repository as a sibling of the vscode repository.`);
    }
    const sortedLanguages = sortLanguages(languages);
    sortedLanguages.forEach((language) => {
        if (process.env['VSCODE_BUILD_VERBOSE']) {
            log(`Generating nls bundles for: ${language.id}`);
        }
        statistics[language.id] = 0;
        const localizedModules = Object.create(null);
        const languageFolderName = language.translationId || language.id;
        const i18nFile = path.join(languageDirectory, `vscode-language-pack-${languageFolderName}`, 'translations', 'main.i18n.json');
        let allMessages;
        if (fs.existsSync(i18nFile)) {
            const content = stripComments(fs.readFileSync(i18nFile, 'utf8'));
            allMessages = JSON.parse(content);
        }
        modules.forEach((module) => {
            const order = keysSection[module];
            let moduleMessage;
            if (allMessages) {
                moduleMessage = allMessages.contents[module];
            }
            if (!moduleMessage) {
                if (process.env['VSCODE_BUILD_VERBOSE']) {
                    log(`No localized messages found for module ${module}. Using default messages.`);
                }
                moduleMessage = defaultMessages[module];
                statistics[language.id] = statistics[language.id] + Object.keys(moduleMessage).length;
            }
            const localizedMessages = [];
            order.forEach((keyInfo) => {
                let key = null;
                if (typeof keyInfo === 'string') {
                    key = keyInfo;
                }
                else {
                    key = keyInfo.key;
                }
                let message = moduleMessage[key];
                if (!message) {
                    if (process.env['VSCODE_BUILD_VERBOSE']) {
                        log(`No localized message found for key ${key} in module ${module}. Using default message.`);
                    }
                    message = defaultMessages[module][key];
                    statistics[language.id] = statistics[language.id] + 1;
                }
                localizedMessages.push(message);
            });
            localizedModules[module] = localizedMessages;
        });
        Object.keys(bundleSection).forEach((bundle) => {
            const modules = bundleSection[bundle];
            const contents = [
                fileHeader,
                `define("${bundle}.nls.${language.id}", {`
            ];
            modules.forEach((module, index) => {
                contents.push(`\t"${module}": [`);
                const messages = localizedModules[module];
                if (!messages) {
                    emitter.emit('error', `Didn't find messages for module ${module}.`);
                    return;
                }
                messages.forEach((message, index) => {
                    contents.push(`\t\t"${escapeCharacters(message)}${index < messages.length ? '",' : '"'}`);
                });
                contents.push(index < modules.length - 1 ? '\t],' : '\t]');
            });
            contents.push('});');
            emitter.queue(new File({ path: bundle + '.nls.' + language.id + '.js', contents: Buffer.from(contents.join('\n'), 'utf-8') }));
        });
    });
    Object.keys(statistics).forEach(key => {
        const value = statistics[key];
        log(`${key} has ${value} untranslated strings.`);
    });
    sortedLanguages.forEach(language => {
        const stats = statistics[language.id];
        if (Is.undef(stats)) {
            log(`\tNo translations found for language ${language.id}. Using default language instead.`);
        }
    });
}
function processNlsFiles(opts) {
    return (0, event_stream_1.through)(function (file) {
        const fileName = path.basename(file.path);
        if (fileName === 'nls.metadata.json') {
            let json = null;
            if (file.isBuffer()) {
                json = JSON.parse(file.contents.toString('utf8'));
            }
            else {
                this.emit('error', `Failed to read component file: ${file.relative}`);
                return;
            }
            if (BundledFormat.is(json)) {
                processCoreBundleFormat(opts.fileHeader, opts.languages, json, this);
            }
        }
        this.queue(file);
    });
}
exports.processNlsFiles = processNlsFiles;
const editorProject = 'vscode-editor', workbenchProject = 'vscode-workbench', extensionsProject = 'vscode-extensions', setupProject = 'vscode-setup', serverProject = 'vscode-server';
// {{SQL CARBON EDIT}}
const adsProject = 'ads-core';
function getResource(sourceFile) {
    let resource;
    if (/^vs\/platform/.test(sourceFile)) {
        return { name: 'vs/platform', project: editorProject };
    }
    else if (/^vs\/editor\/contrib/.test(sourceFile)) {
        return { name: 'vs/editor/contrib', project: editorProject };
    }
    else if (/^vs\/editor/.test(sourceFile)) {
        return { name: 'vs/editor', project: editorProject };
    }
    else if (/^vs\/base/.test(sourceFile)) {
        return { name: 'vs/base', project: editorProject };
    }
    else if (/^vs\/code/.test(sourceFile)) {
        return { name: 'vs/code', project: workbenchProject };
    }
    else if (/^vs\/server/.test(sourceFile)) {
        return { name: 'vs/server', project: serverProject };
    }
    else if (/^vs\/workbench\/contrib/.test(sourceFile)) {
        resource = sourceFile.split('/', 4).join('/');
        return { name: resource, project: workbenchProject };
    }
    else if (/^vs\/workbench\/services/.test(sourceFile)) {
        resource = sourceFile.split('/', 4).join('/');
        return { name: resource, project: workbenchProject };
    }
    else if (/^vs\/workbench/.test(sourceFile)) {
        return { name: 'vs/workbench', project: workbenchProject };
    }
    // {{SQL CARBON EDIT}}
    else if (/^sql/.test(sourceFile)) {
        return { name: 'sql', project: adsProject };
    }
    throw new Error(`Could not identify the XLF bundle for ${sourceFile}`);
}
exports.getResource = getResource;
function createXlfFilesForCoreBundle() {
    return (0, event_stream_1.through)(function (file) {
        const basename = path.basename(file.path);
        if (basename === 'nls.metadata.json') {
            if (file.isBuffer()) {
                const xlfs = Object.create(null);
                const json = JSON.parse(file.contents.toString('utf8'));
                // {{SQL CARBON EDIT}} - Must sort the keys for easier translation.
                let sortedKeys = Object.keys(json.keys).sort();
                for (let i = 0; i < sortedKeys.length; i++) {
                    let coreModule = sortedKeys[i];
                    // {{SQL CARBON EDIT}} - End
                    const projectResource = getResource(coreModule);
                    const resource = projectResource.name;
                    const project = projectResource.project;
                    const keys = json.keys[coreModule];
                    const messages = json.messages[coreModule];
                    if (keys.length !== messages.length) {
                        this.emit('error', `There is a mismatch between keys and messages in ${file.relative} for module ${coreModule}`);
                        return;
                    }
                    else {
                        let xlf = xlfs[resource];
                        if (!xlf) {
                            xlf = new XLF(project);
                            xlfs[resource] = xlf;
                        }
                        xlf.addFile(`src/${coreModule}`, keys, messages);
                    }
                }
                for (const resource in xlfs) {
                    const xlf = xlfs[resource];
                    const filePath = `${xlf.project}/${resource.replace(/\//g, '_')}.xlf`;
                    const xlfFile = new File({
                        path: filePath,
                        contents: Buffer.from(xlf.toString(), 'utf8')
                    });
                    this.queue(xlfFile);
                }
            }
            else {
                this.emit('error', new Error(`File ${file.relative} is not using a buffer content`));
                return;
            }
        }
        else {
            this.emit('error', new Error(`File ${file.relative} is not a core meta data file.`));
            return;
        }
    });
}
exports.createXlfFilesForCoreBundle = createXlfFilesForCoreBundle;
function createL10nBundleForExtension(extensionFolderName, prefixWithBuildFolder) {
    const prefix = prefixWithBuildFolder ? '.build/' : '';
    return gulp
        .src([
        // For source code of extensions
        `${prefix}extensions/${extensionFolderName}/{src,client,server}/**/*.{ts,tsx}`,
        // // For any dependencies pulled in (think vscode-css-languageservice or @vscode/emmet-helper)
        `${prefix}extensions/${extensionFolderName}/**/node_modules/{@vscode,vscode-*}/**/*.{js,jsx}`,
        // // For any dependencies pulled in that bundle @vscode/l10n. They needed to export the bundle
        `${prefix}extensions/${extensionFolderName}/**/bundle.l10n.json`,
    ])
        .pipe((0, event_stream_1.map)(function (data, callback) {
        const file = data;
        if (!file.isBuffer()) {
            // Not a buffer so we drop it
            callback();
            return;
        }
        const extension = path.extname(file.relative);
        if (extension !== '.json') {
            const contents = file.contents.toString('utf8');
            (0, l10n_dev_1.getL10nJson)([{ contents, extension }])
                .then((json) => {
                callback(undefined, new File({
                    path: `extensions/${extensionFolderName}/bundle.l10n.json`,
                    contents: Buffer.from(JSON.stringify(json), 'utf8')
                }));
            })
                .catch((err) => {
                callback(new Error(`File ${file.relative} threw an error when parsing: ${err}`));
            });
            // signal pause?
            return false;
        }
        // for bundle.l10n.jsons
        let bundleJson;
        try {
            bundleJson = JSON.parse(file.contents.toString('utf8'));
        }
        catch (err) {
            callback(new Error(`File ${file.relative} threw an error when parsing: ${err}`));
            return;
        }
        // some validation of the bundle.l10n.json format
        for (const key in bundleJson) {
            if (typeof bundleJson[key] !== 'string' &&
                (typeof bundleJson[key].message !== 'string' || !Array.isArray(bundleJson[key].comment))) {
                callback(new Error(`Invalid bundle.l10n.json file. The value for key ${key} is not in the expected format.`));
                return;
            }
        }
        callback(undefined, file);
    }))
        .pipe(jsonMerge({
        fileName: `extensions/${extensionFolderName}/bundle.l10n.json`,
        jsonSpace: '',
        concatArrays: true
    }));
}
exports.EXTERNAL_EXTENSIONS = [
    'ms-vscode.js-debug',
    'ms-vscode.js-debug-companion',
    'ms-vscode.vscode-js-profile-table',
];
function createXlfFilesForExtensions() {
    let counter = 0;
    let folderStreamEnded = false;
    let folderStreamEndEmitted = false;
    return (0, event_stream_1.through)(function (extensionFolder) {
        const folderStream = this;
        const stat = fs.statSync(extensionFolder.path);
        if (!stat.isDirectory()) {
            return;
        }
        const extensionFolderName = path.basename(extensionFolder.path);
        if (extensionFolderName === 'node_modules') {
            return;
        }
        // Get extension id and use that as the id
        const manifest = fs.readFileSync(path.join(extensionFolder.path, 'package.json'), 'utf-8');
        const manifestJson = JSON.parse(manifest);
        const extensionId = manifestJson.publisher + '.' + manifestJson.name;
        counter++;
        let _l10nMap;
        function getL10nMap() {
            if (!_l10nMap) {
                _l10nMap = new Map();
            }
            return _l10nMap;
        }
        (0, event_stream_1.merge)(gulp.src([`.build/extensions/${extensionFolderName}/package.nls.json`, `.build/extensions/${extensionFolderName}/**/nls.metadata.json`], { allowEmpty: true }), createL10nBundleForExtension(extensionFolderName, exports.EXTERNAL_EXTENSIONS.includes(extensionId))).pipe((0, event_stream_1.through)(function (file) {
            if (file.isBuffer()) {
                const buffer = file.contents;
                const basename = path.basename(file.path);
                if (basename === 'package.nls.json') {
                    const json = JSON.parse(buffer.toString('utf8'));
                    getL10nMap().set(`extensions/${extensionId}/package`, json);
                }
                else if (basename === 'nls.metadata.json') {
                    const json = JSON.parse(buffer.toString('utf8'));
                    const relPath = path.relative(`.build/extensions/${extensionFolderName}`, path.dirname(file.path));
                    for (const file in json) {
                        const fileContent = json[file];
                        const info = Object.create(null);
                        for (let i = 0; i < fileContent.messages.length; i++) {
                            const message = fileContent.messages[i];
                            const { key, comment } = LocalizeInfo.is(fileContent.keys[i])
                                ? fileContent.keys[i]
                                : { key: fileContent.keys[i], comment: undefined };
                            info[key] = comment ? { message, comment } : message;
                        }
                        getL10nMap().set(`extensions/${extensionId}/${relPath}/${file}`, info);
                    }
                }
                else if (basename === 'bundle.l10n.json') {
                    const json = JSON.parse(buffer.toString('utf8'));
                    getL10nMap().set(`extensions/${extensionId}/bundle`, json);
                }
                else {
                    this.emit('error', new Error(`${file.path} is not a valid extension nls file`));
                    return;
                }
            }
        }, function () {
            if (_l10nMap?.size > 0) {
                const xlfFile = new File({
                    path: path.join(extensionsProject, extensionId + '.xlf'),
                    contents: Buffer.from((0, l10n_dev_1.getL10nXlf)(_l10nMap), 'utf8')
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
function createXlfFilesForIsl() {
    return (0, event_stream_1.through)(function (file) {
        let projectName, resourceFile;
        if (path.basename(file.path) === 'messages.en.isl') {
            projectName = setupProject;
            resourceFile = 'messages.xlf';
        }
        else {
            throw new Error(`Unknown input file ${file.path}`);
        }
        const xlf = new XLF(projectName), keys = [], messages = [];
        const model = new TextModel(file.contents.toString());
        let inMessageSection = false;
        model.lines.forEach(line => {
            if (line.length === 0) {
                return;
            }
            const firstChar = line.charAt(0);
            switch (firstChar) {
                case ';':
                    // Comment line;
                    return;
                case '[':
                    inMessageSection = '[Messages]' === line || '[CustomMessages]' === line;
                    return;
            }
            if (!inMessageSection) {
                return;
            }
            const sections = line.split('=');
            if (sections.length !== 2) {
                throw new Error(`Badly formatted message found: ${line}`);
            }
            else {
                const key = sections[0];
                const value = sections[1];
                if (key.length > 0 && value.length > 0) {
                    keys.push(key);
                    messages.push(value);
                }
            }
        });
        const originalPath = file.path.substring(file.cwd.length + 1, file.path.split('.')[0].length).replace(/\\/g, '/');
        xlf.addFile(originalPath, keys, messages);
        // Emit only upon all ISL files combined into single XLF instance
        const newFilePath = path.join(projectName, resourceFile);
        const xlfFile = new File({ path: newFilePath, contents: Buffer.from(xlf.toString(), 'utf-8') });
        this.queue(xlfFile);
    });
}
exports.createXlfFilesForIsl = createXlfFilesForIsl;
function createI18nFile(name, messages) {
    const result = Object.create(null);
    result[''] = [
        '--------------------------------------------------------------------------------------------',
        'Copyright (c) Microsoft Corporation. All rights reserved.',
        'Licensed under the Source EULA. See License.txt in the project root for license information.',
        '--------------------------------------------------------------------------------------------',
        'Do not edit this file. It is machine generated.'
    ];
    for (const key of Object.keys(messages)) {
        result[key] = messages[key];
    }
    let content = JSON.stringify(result, null, '\t');
    if (process.platform === 'win32') {
        content = content.replace(/\n/g, '\r\n');
    }
    return new File({
        path: path.join(name + '.i18n.json'),
        contents: Buffer.from(content, 'utf8')
    });
}
exports.createI18nFile = createI18nFile;
exports.i18nPackVersion = '1.0.0'; // {{SQL CARBON EDIT}} Needed in locfunc.
function getRecordFromL10nJsonFormat(l10nJsonFormat) {
    const record = {};
    for (const key of Object.keys(l10nJsonFormat).sort()) {
        const value = l10nJsonFormat[key];
        record[key] = typeof value === 'string' ? value : value.message;
    }
    return record;
}
function prepareI18nPackFiles(resultingTranslationPaths) {
    const parsePromises = [];
    const mainPack = { version: exports.i18nPackVersion, contents: {} };
    const extensionsPacks = {};
    const errors = [];
    return (0, event_stream_1.through)(function (xlf) {
        let project = path.basename(path.dirname(path.dirname(xlf.relative)));
        // strip `-new` since vscode-extensions-loc uses the `-new` suffix to indicate that it's from the new loc pipeline
        const resource = path.basename(path.basename(xlf.relative, '.xlf'), '-new');
        if (exports.EXTERNAL_EXTENSIONS.find(e => e === resource)) {
            project = extensionsProject;
        }
        const contents = xlf.contents.toString();
        log(`Found ${project}: ${resource}`);
        const parsePromise = (0, l10n_dev_1.getL10nFilesFromXlf)(contents);
        parsePromises.push(parsePromise);
        parsePromise.then(resolvedFiles => {
            resolvedFiles.forEach(file => {
                const path = file.name;
                const firstSlash = path.indexOf('/');
                if (project === extensionsProject) {
                    // resource will be the extension id
                    let extPack = extensionsPacks[resource];
                    if (!extPack) {
                        extPack = extensionsPacks[resource] = { version: exports.i18nPackVersion, contents: {} };
                    }
                    // remove 'extensions/extensionId/' segment
                    const secondSlash = path.indexOf('/', firstSlash + 1);
                    extPack.contents[path.substring(secondSlash + 1)] = getRecordFromL10nJsonFormat(file.messages);
                }
                else {
                    mainPack.contents[path.substring(firstSlash + 1)] = getRecordFromL10nJsonFormat(file.messages);
                }
            });
        }).catch(reason => {
            errors.push(reason);
        });
    }, function () {
        Promise.all(parsePromises)
            .then(() => {
            if (errors.length > 0) {
                throw errors;
            }
            const translatedMainFile = createI18nFile('./main', mainPack);
            resultingTranslationPaths.push({ id: 'vscode', resourceName: 'main.i18n.json' });
            this.queue(translatedMainFile);
            for (const extensionId in extensionsPacks) {
                const translatedExtFile = createI18nFile(`extensions/${extensionId}`, extensionsPacks[extensionId]);
                this.queue(translatedExtFile);
                resultingTranslationPaths.push({ id: extensionId, resourceName: `extensions/${extensionId}.i18n.json` });
            }
            this.queue(null);
        })
            .catch((reason) => {
            this.emit('error', reason);
        });
    });
}
exports.prepareI18nPackFiles = prepareI18nPackFiles;
function prepareIslFiles(language, innoSetupConfig) {
    const parsePromises = [];
    return (0, event_stream_1.through)(function (xlf) {
        const stream = this;
        const parsePromise = XLF.parse(xlf.contents.toString());
        parsePromises.push(parsePromise);
        parsePromise.then(resolvedFiles => {
            resolvedFiles.forEach(file => {
                const translatedFile = createIslFile(file.name, file.messages, language, innoSetupConfig);
                stream.queue(translatedFile);
            });
        }).catch(reason => {
            this.emit('error', reason);
        });
    }, function () {
        Promise.all(parsePromises)
            .then(() => { this.queue(null); })
            .catch(reason => {
            this.emit('error', reason);
        });
    });
}
exports.prepareIslFiles = prepareIslFiles;
function createIslFile(name, messages, language, innoSetup) {
    const content = [];
    let originalContent;
    if (path.basename(name) === 'Default') {
        originalContent = new TextModel(fs.readFileSync(name + '.isl', 'utf8'));
    }
    else {
        originalContent = new TextModel(fs.readFileSync(name + '.en.isl', 'utf8'));
    }
    originalContent.lines.forEach(line => {
        if (line.length > 0) {
            const firstChar = line.charAt(0);
            if (firstChar === '[' || firstChar === ';') {
                content.push(line);
            }
            else {
                const sections = line.split('=');
                const key = sections[0];
                let translated = line;
                if (key) {
                    const translatedMessage = messages[key];
                    if (translatedMessage) {
                        translated = `${key}=${translatedMessage}`;
                    }
                }
                content.push(translated);
            }
        }
    });
    const basename = path.basename(name);
    const filePath = `${basename}.${language.id}.isl`;
    const encoded = iconv.encode(Buffer.from(content.join('\r\n'), 'utf8').toString(), innoSetup.codePage);
    return new File({
        path: filePath,
        contents: Buffer.from(encoded),
    });
}
function encodeEntities(value) {
    const result = [];
    for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        switch (ch) {
            case '<':
                result.push('&lt;');
                break;
            case '>':
                result.push('&gt;');
                break;
            case '&':
                result.push('&amp;');
                break;
            default:
                result.push(ch);
        }
    }
    return result.join('');
}
function decodeEntities(value) {
    return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function pseudify(message) {
    return '\uFF3B' + message.replace(/[aouei]/g, '$&$&') + '\uFF3D';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImkxOG4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Z0dBR2dHOzs7QUFFaEcsNkJBQTZCO0FBQzdCLHlCQUF5QjtBQUV6QiwrQ0FBa0U7QUFDbEUsNkNBQTZDO0FBQzdDLDhCQUE4QjtBQUM5Qix5QkFBeUI7QUFDekIsaUNBQWlDO0FBQ2pDLDZCQUE2QjtBQUM3QixzQ0FBc0M7QUFDdEMsMENBQTBDO0FBQzFDLGdEQUFnRDtBQUNoRCwrQ0FBaUg7QUFFakgsU0FBUyxHQUFHLENBQUMsT0FBWSxFQUFFLEdBQUcsSUFBVztJQUN4QyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUN4RCxDQUFDO0FBWVksUUFBQSxnQkFBZ0IsR0FBZTtJQUMzQyxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFO0lBQzVELEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUU7SUFDNUQsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7SUFDL0IsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7SUFDL0IsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7SUFDL0IsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7SUFDL0IsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7SUFDL0IsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUU7SUFDL0IsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFVB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