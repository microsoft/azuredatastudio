/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_universal_bundler_1 = require("vscode-universal-bundler");
const cross_spawn_promise_1 = require("@malept/cross-spawn-promise");
const fs = require("fs-extra");
const path = require("path");
const plist = require("plist");
const product = require("../../product.json");
const glob = require("glob"); // {{SQL CARBON EDIT}}
async function main() {
    const buildDir = process.env['AGENT_BUILDDIRECTORY'];
    const arch = process.env['VSCODE_ARCH'];
    if (!buildDir) {
        throw new Error('$AGENT_BUILDDIRECTORY not set');
    }
    // {{SQL CARBON EDIT}}
    const x64AppNameBase = 'azuredatastudio-darwin-x64';
    const arm64AppNameBase = 'azuredatastudio-darwin-arm64';
    // {{SQL CARBON EDIT}} - END
    const appName = product.nameLong + '.app';
    const x64AppPath = path.join(buildDir, x64AppNameBase, appName); // {{SQL CARBON EDIT}} - CHANGE VSCode to azuredatastudio
    const arm64AppPath = path.join(buildDir, arm64AppNameBase, appName); // {{SQL CARBON EDIT}} - CHANGE VSCode to azuredatastudio
    const x64AsarPath = path.join(x64AppPath, 'Contents', 'Resources', 'app', 'node_modules.asar');
    const arm64AsarPath = path.join(arm64AppPath, 'Contents', 'Resources', 'app', 'node_modules.asar');
    const outAppPath = path.join(buildDir, `azuredatastudio-darwin-${arch}`, appName); // {{SQL CARBON EDIT}} - CHANGE VSCode to azuredatastudio
    const productJsonPath = path.resolve(outAppPath, 'Contents', 'Resources', 'app', 'product.json');
    const infoPlistPath = path.resolve(outAppPath, 'Contents', 'Info.plist');
    // {{SQL CARBON EDIT}}
    const stsPath = '/Contents/Resources/app/extensions/mssql/sqltoolsservice';
    const tempSTSDir = path.join(buildDir, 'sqltoolsservice');
    const x64STSDir = path.join(x64AppPath, stsPath);
    const arm64STSDir = path.join(arm64AppPath, stsPath);
    const targetSTSDirs = [x64STSDir, arm64STSDir];
    await fs.copy(x64STSDir, tempSTSDir);
    targetSTSDirs.forEach(async (dir) => {
        await fs.remove(dir);
    });
    glob(path.join(x64AppPath, '/Contents/Resources/app/**/nls.metadata.json'), (err, files) => {
        if (err) {
            console.warn(`Error occured while looking for nls.metadata.json files: ${err}`);
            return;
        }
        files.forEach(async (file) => {
            const fileToReplace = file.replace(x64AppNameBase, arm64AppNameBase);
            console.debug(`replacing file '${fileToReplace}' with '${file}'`);
            await fs.copy(file, fileToReplace, { overwrite: true });
        });
    });
    // {{SQL CARBON EDIT}} - END
    await (0, vscode_universal_bundler_1.makeUniversalApp)({
        x64AppPath,
        arm64AppPath,
        x64AsarPath,
        arm64AsarPath,
        filesToSkip: [
            'product.json',
            'Credits.rtf',
            'CodeResources',
            'fsevents.node',
            'Info.plist',
            '.npmrc'
        ],
        outAppPath,
        force: true
    });
    let productJson = await fs.readJson(productJsonPath);
    Object.assign(productJson, {
        darwinUniversalAssetId: 'darwin-universal'
    });
    await fs.writeJson(productJsonPath, productJson);
    let infoPlistString = await fs.readFile(infoPlistPath, 'utf8');
    let infoPlistJson = plist.parse(infoPlistString);
    Object.assign(infoPlistJson, {
        LSRequiresNativeExecution: true
    });
    await fs.writeFile(infoPlistPath, plist.build(infoPlistJson), 'utf8');
    // Verify if native module architecture is correct
    const findOutput = await (0, cross_spawn_promise_1.spawn)('find', [outAppPath, '-name', 'keytar.node']);
    const lipoOutput = await (0, cross_spawn_promise_1.spawn)('lipo', ['-archs', findOutput.replace(/\n$/, "")]);
    if (lipoOutput.replace(/\n$/, "") !== 'x86_64 arm64') {
        throw new Error(`Invalid arch, got : ${lipoOutput}`);
    }
    // {{SQL CARBON EDIT}} - copy the sts back to its original place
    await fs.copy(tempSTSDir, path.join(outAppPath, stsPath), { overwrite: true });
}
if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
