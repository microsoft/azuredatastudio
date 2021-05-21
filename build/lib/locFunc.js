"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageLangpacksStream = void 0;
const es = require("event-stream");
const path = require("path");
const fs = require("fs");
const stats_1 = require("./stats");
const File = require("vinyl");
const glob = require("glob");
const rename = require("gulp-rename");
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
        return fromLocalNormal(langpack.path)
            .pipe(rename(p => p.dirname = `langpacks/${langpack.name}/${p.dirname}`));
    });
    return es.merge(builtLangpacks);
}
exports.packageLangpacksStream = packageLangpacksStream;
//copied from extensions.
function fromLocalNormal(extensionPath) {
    const result = es.through();
    const vsce = require('vsce');
    vsce.listFiles({ cwd: extensionPath, packageManager: vsce.PackageManager.Yarn })
        .then(fileNames => {
        const files = fileNames
            .map(fileName => path.join(extensionPath, fileName))
            .map(filePath => new File({
            path: filePath,
            stat: fs.statSync(filePath),
            base: extensionPath,
            contents: fs.createReadStream(filePath)
        }));
        es.readArray(files).pipe(result);
    })
        .catch(err => result.emit('error', err));
    return result.pipe(stats_1.createStatsStream(path.basename(extensionPath)));
}
