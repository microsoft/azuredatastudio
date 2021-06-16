"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageADSExtensionsStream = exports.packageLangpacksStream = void 0;
const es = require("event-stream");
const fs = require("fs");
const path = require("path");
const glob = require("glob");
const rename = require("gulp-rename");
const ext = require("./extensions");
const root = path.dirname(path.dirname(__dirname));
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
// Modified packageLocalExtensionsStream but for all ADS extensions that currently listed including excluded/external ones.
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
