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
async function main() {
    const buildDir = process.env['AGENT_BUILDDIRECTORY'];
    const arch = process.env['VSCODE_ARCH'];
    if (!buildDir) {
        throw new Error('$AGENT_BUILDDIRECTORY not set');
    }
    const appName = product.nameLong + '.app';
    const x64AppPath = path.join(buildDir, 'VSCode-darwin-x64', appName);
    const arm64AppPath = path.join(buildDir, 'VSCode-darwin-arm64', appName);
    const x64AsarPath = path.join(x64AppPath, 'Contents', 'Resources', 'app', 'node_modules.asar');
    const arm64AsarPath = path.join(arm64AppPath, 'Contents', 'Resources', 'app', 'node_modules.asar');
    const outAppPath = path.join(buildDir, `VSCode-darwin-${arch}`, appName);
    const productJsonPath = path.resolve(outAppPath, 'Contents', 'Resources', 'app', 'product.json');
    const infoPlistPath = path.resolve(outAppPath, 'Contents', 'Info.plist');
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
}
if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
