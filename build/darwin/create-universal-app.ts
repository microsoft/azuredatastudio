/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs-extra'; // {{SQL CARBON EDIT}} - use fs-extra instead of fs
import { makeUniversalApp } from 'vscode-universal-bundler';
import { spawn } from '@malept/cross-spawn-promise';
import * as glob from 'glob'; // {{SQL CARBON EDIT}}

const root = path.dirname(path.dirname(__dirname));

async function main(buildDir?: string) {
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
	targetSTSDirs.forEach(async dir => {
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

	await makeUniversalApp({
		x64AppPath,
		arm64AppPath,
		x64AsarPath,
		arm64AsarPath,
		filesToSkip: [
			'product.json',
			'Credits.rtf',
			'CodeResources',
			'fsevents.node',
			'Info.plist', // TODO@deepak1556: regressed with 11.4.2 internal builds
			'MainMenu.nib', // Generated sequence is not deterministic with Xcode 13
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
	const findOutput = await spawn('find', [outAppPath, '-name', 'keytar.node', '-regex', '.*node_modules.asar.unpacked.*',]);
	const lipoOutput = await spawn('lipo', ['-archs', findOutput.replace(/\n$/, '')]);
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
