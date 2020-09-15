/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const { execSync } = require('child_process');
const path = require('path');
const args = process.argv.slice(2);

const adsDir = path.join(process.cwd(), 'azuredatastudio');


const copyCmd = `powershell.exe Copy-Item -Path "C:\\ads\\azuredatastudio\\.build" -Destination "C:\\Output" -Recurse`;

execSync(`git checkout ${args[0]}`, {
	cwd: adsDir,
	stdio: 'inherit'
});

execSync(`yarn install`, {
	cwd: adsDir,
	stdio: 'inherit'
});

execSync(`yarn gulp vscode-win32-x64`, {
	cwd: adsDir,
	stdio: 'inherit'
});

execSync(`yarn gulp vscode-win32-x64-archive`, {
	cwd: adsDir,
	stdio: 'inherit'
});


execSync(copyCmd, {
	cwd: adsDir,
	stdio: 'inherit'
});
