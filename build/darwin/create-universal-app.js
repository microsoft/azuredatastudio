"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const vscode_universal_bundler_1 = require("vscode-universal-bundler");
const cross_spawn_promise_1 = require("@malept/cross-spawn-promise");
const fs = require("fs-extra");
const path = require("path");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLXVuaXZlcnNhbC1hcHAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjcmVhdGUtdW5pdmVyc2FsLWFwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztnR0FHZ0c7O0FBRWhHLDZCQUE2QjtBQUM3Qix5QkFBeUI7QUFDekIsdUVBQTREO0FBQzVELHFFQUFvRDtBQUVwRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUVuRCxLQUFLLFVBQVUsSUFBSSxDQUFDLFFBQWlCO0lBQ3BDLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7SUFFeEMsSUFBSSxDQUFDLFFBQVEsRUFBRTtRQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztLQUMxQztJQUVELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3JGLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDO0lBQzFDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLG1CQUFtQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3JFLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLHFCQUFxQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3pFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLENBQUM7SUFDL0YsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztJQUNuRyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxpQkFBaUIsSUFBSSxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDekUsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFFakcsTUFBTSxJQUFBLDJDQUFnQixFQUFDO1FBQ3RCLFVBQVU7UUFDVixZQUFZO1FBQ1osV0FBVztRQUNYLGFBQWE7UUFDYixXQUFXLEVBQUU7WUFDWixjQUFjO1lBQ2QsYUFBYTtZQUNiLGVBQWU7WUFDZixlQUFlO1lBQ2YsWUFBWTtZQUNaLGNBQWM7WUFDZCxRQUFRO1NBQ1I7UUFDRCxVQUFVO1FBQ1YsS0FBSyxFQUFFLElBQUk7S0FDWCxDQUFDLENBQUM7SUFFSCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDekUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUU7UUFDMUIsc0JBQXNCLEVBQUUsa0JBQWtCO0tBQzFDLENBQUMsQ0FBQztJQUNILEVBQUUsQ0FBQyxhQUFhLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRTNFLGtEQUFrRDtJQUNsRCxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUEsMkJBQUssRUFBQyxNQUFNLEVBQUUsQ0FBQyxVQUFVLEVBQUUsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7SUFDN0UsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFBLDJCQUFLLEVBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRixJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLGNBQWMsRUFBRTtRQUNyRCxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixVQUFVLEVBQUUsQ0FBQyxDQUFDO0tBQ3JEO0FBQ0YsQ0FBQztBQUVELElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7SUFDNUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDakMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNuQixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pCLENBQUMsQ0FBQyxDQUFDO0NBQ0gifQ==