/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const codesign = require("electron-osx-sign");
const path = require("path");
const util = require("../lib/util");
const product = require("../../product.json");
const cross_spawn_promise_1 = require("@malept/cross-spawn-promise");
async function main() {
    const buildDir = process.env['AGENT_BUILDDIRECTORY'];
    const tempDir = process.env['AGENT_TEMPDIRECTORY'];
    const arch = process.env['VSCODE_ARCH'];
    if (!buildDir) {
        throw new Error('$AGENT_BUILDDIRECTORY not set');
    }
    if (!tempDir) {
        throw new Error('$AGENT_TEMPDIRECTORY not set');
    }
    const baseDir = path.dirname(__dirname);
    const appRoot = path.join(buildDir, `VSCode-darwin-${arch}`);
    const appName = product.nameLong + '.app';
    const appFrameworkPath = path.join(appRoot, appName, 'Contents', 'Frameworks');
    const helperAppBaseName = product.nameShort;
    const gpuHelperAppName = helperAppBaseName + ' Helper (GPU).app';
    const rendererHelperAppName = helperAppBaseName + ' Helper (Renderer).app';
    const infoPlistPath = path.resolve(appRoot, appName, 'Contents', 'Info.plist');
    const defaultOpts = {
        app: path.join(appRoot, appName),
        platform: 'darwin',
        entitlements: path.join(baseDir, 'azure-pipelines', 'darwin', 'app-entitlements.plist'),
        'entitlements-inherit': path.join(baseDir, 'azure-pipelines', 'darwin', 'app-entitlements.plist'),
        hardenedRuntime: true,
        'pre-auto-entitlements': false,
        'pre-embed-provisioning-profile': false,
        keychain: path.join(tempDir, 'buildagent.keychain'),
        version: util.getElectronVersion(),
        identity: '99FM488X57',
        'gatekeeper-assess': false
    };
    const appOpts = Object.assign(Object.assign({}, defaultOpts), { 
        // TODO(deepak1556): Incorrectly declared type in electron-osx-sign
        ignore: (filePath) => {
            return filePath.includes(gpuHelperAppName) ||
                filePath.includes(rendererHelperAppName);
        } });
    const gpuHelperOpts = Object.assign(Object.assign({}, defaultOpts), { app: path.join(appFrameworkPath, gpuHelperAppName), entitlements: path.join(baseDir, 'azure-pipelines', 'darwin', 'helper-gpu-entitlements.plist'), 'entitlements-inherit': path.join(baseDir, 'azure-pipelines', 'darwin', 'helper-gpu-entitlements.plist') });
    const rendererHelperOpts = Object.assign(Object.assign({}, defaultOpts), { app: path.join(appFrameworkPath, rendererHelperAppName), entitlements: path.join(baseDir, 'azure-pipelines', 'darwin', 'helper-renderer-entitlements.plist'), 'entitlements-inherit': path.join(baseDir, 'azure-pipelines', 'darwin', 'helper-renderer-entitlements.plist') });
    // Only overwrite plist entries for x64 and arm64 builds,
    // universal will get its copy from the x64 build.
    if (arch !== 'universal') {
        await (0, cross_spawn_promise_1.spawn)('plutil', [
            '-insert',
            'NSAppleEventsUsageDescription',
            '-string',
            'An application in Visual Studio Code wants to use AppleScript.',
            `${infoPlistPath}`
        ]);
        await (0, cross_spawn_promise_1.spawn)('plutil', [
            '-replace',
            'NSMicrophoneUsageDescription',
            '-string',
            'An application in Visual Studio Code wants to use the Microphone.',
            `${infoPlistPath}`
        ]);
        await (0, cross_spawn_promise_1.spawn)('plutil', [
            '-replace',
            'NSCameraUsageDescription',
            '-string',
            'An application in Visual Studio Code wants to use the Camera.',
            `${infoPlistPath}`
        ]);
    }
    await codesign.signAsync(gpuHelperOpts);
    await codesign.signAsync(rendererHelperOpts);
    await codesign.signAsync(appOpts);
}
if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
