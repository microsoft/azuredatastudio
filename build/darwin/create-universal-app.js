"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs-extra"); // {{SQL CARBON EDIT}} - use fs-extra instead of fs
const vscode_universal_bundler_1 = require("vscode-universal-bundler");
const cross_spawn_promise_1 = require("@malept/cross-spawn-promise");
const glob = require("glob"); // {{SQL CARBON EDIT}}
const root = path.dirname(path.dirname(__dirname));
async function main(buildDir) {
    const arch = process.env['VSCODE_ARCH'];
    if (!buildDir) {
        throw new Error('Build dir not provided');
    }
    const product = JSON.parse(fs.readFileSync(path.join(root, 'product.json'), 'utf8'));
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
    // {{SQL CARBON EDIT}}
    // STS binaries for x64 and arm64 have different file count and cannot be combined
    // Remove them from the package before the makeUniversalApp step and copy them to the universal package after it.
    const stsPath = '/Contents/Resources/app/extensions/mssql/sqltoolsservice';
    const tempSTSDir = path.join(buildDir, 'sqltoolsservice');
    const x64STSDir = path.join(x64AppPath, stsPath);
    const arm64STSDir = path.join(arm64AppPath, stsPath);
    const targetSTSDirs = [x64STSDir, arm64STSDir];
    // backup the STS folders to a temporary directory, later they will be copied to the universal app directory.
    await fs.copy(x64STSDir, tempSTSDir);
    await fs.copy(arm64STSDir, tempSTSDir);
    // delete STS directories from both x64 ADS and arm64 ADS.
    console.debug(`Removing SqlToolsService folders.`);
    targetSTSDirs.forEach(async (dir) => {
        await fs.remove(dir);
    });
    // makeUniversalApp requires the non-binary files in arm64 and x64 versions to be exactly the same,
    // but sometimes the content of nls.metadata.json files could be different(only the order of the entries).
    // To workaround the issue, we need to replace these files in arm64 ADS with the files from x64 ADS.
    // Tracked by issue: https://github.com/microsoft/azuredatastudio/issues/20792
    const sourceFiles = glob.sync(path.join(x64AppPath, '/Contents/Resources/app/**/nls.metadata.json'));
    sourceFiles.forEach(source => {
        const target = source.replace(x64AppNameBase, arm64AppNameBase);
        console.debug(`Replacing file '${target}' with '${source}'`);
        fs.copySync(source, target, { overwrite: true });
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
            'MainMenu.nib',
            '.npmrc'
        ],
        outAppPath,
        force: true
    });
    const productJson = JSON.parse(fs.readFileSync(productJsonPath, 'utf8'));
    Object.assign(productJson, {
        darwinUniversalAssetId: 'darwin-universal'
    });
    fs.writeFileSync(productJsonPath, JSON.stringify(productJson, null, '\t'));
    // Verify if native module architecture is correct
    // {{SQL CARBON EDIT}} Some of our extensions have their own keytar so lookup
    //   only in core modules since this code doesn't work with multiple found modules.
    //   We're assuming here the intent is just to check a single file for validation and not
    //   needing to check any others since this currently is ignoring all other native modules.
    const findOutput = await (0, cross_spawn_promise_1.spawn)('find', [outAppPath, '-name', 'keytar.node', '-regex', '.*node_modules.asar.unpacked.*',]);
    const lipoOutput = await (0, cross_spawn_promise_1.spawn)('lipo', ['-archs', findOutput.replace(/\n$/, '')]);
    if (lipoOutput.replace(/\n$/, '') !== 'x86_64 arm64') {
        throw new Error(`Invalid arch, got : ${lipoOutput}`);
    }
    // {{SQL CARBON EDIT}}
    console.debug(`Copying SqlToolsService to the universal app folder.`);
    await fs.copy(path.join(tempSTSDir, 'OSX'), path.join(outAppPath, stsPath, 'OSX'), { overwrite: true });
    await fs.copy(path.join(tempSTSDir, 'OSX_ARM64'), path.join(outAppPath, stsPath, 'OSX_ARM64'), { overwrite: true });
}
if (require.main === module) {
    main(process.argv[2]).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLXVuaXZlcnNhbC1hcHAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjcmVhdGUtdW5pdmVyc2FsLWFwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztnR0FHZ0c7O0FBRWhHLDZCQUE2QjtBQUM3QiwrQkFBK0IsQ0FBQyxtREFBbUQ7QUFDbkYsdUVBQTREO0FBQzVELHFFQUFvRDtBQUNwRCw2QkFBNkIsQ0FBQyxzQkFBc0I7QUFFcEQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFFbkQsS0FBSyxVQUFVLElBQUksQ0FBQyxRQUFpQjtJQUNwQyxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBRXhDLElBQUksQ0FBQyxRQUFRLEVBQUU7UUFDZCxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7S0FDMUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNyRixNQUFNLGNBQWMsR0FBRyw0QkFBNEIsQ0FBQztJQUNwRCxNQUFNLGdCQUFnQixHQUFHLDhCQUE4QixDQUFDO0lBQ3hELDRCQUE0QjtJQUU1QixNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQztJQUMxQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyx5REFBeUQ7SUFDMUgsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyx5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