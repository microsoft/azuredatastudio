/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { NetCoreTool, DBProjectConfigurationKey, NetCoreInstallLocationKey, NextCoreNonWindowsDefaultPath } from '../tools/netcoreTool';
import { getQuotedPath } from '../common/utils';
import { isNullOrUndefined } from 'util';
import { generateTestFolderPath } from './testUtils';

describe.skip('NetCoreTool: Net core tests', function (): void {

	it('Should override dotnet default value with settings', async function (): Promise<void> {
		try {
			// update settings and validate
			await vscode.workspace.getConfiguration(DBProjectConfigurationKey).update(NetCoreInstallLocationKey, 'test value path', true);
			const netcoreTool = new NetCoreTool();
			should(netcoreTool.netcoreInstallLocation).equal('test value path'); // the path in settings should be taken
			should(netcoreTool.findOrInstallNetCore()).equal(false); // dotnet can not be present at dummy path in settings
		}
		finally {
			// clean again
			await vscode.workspace.getConfiguration(DBProjectConfigurationKey).update(NetCoreInstallLocationKey, '', true);
		}
	});

	it('Should find right dotnet default paths', function (): void {
		const netcoreTool = new NetCoreTool();
		netcoreTool.findOrInstallNetCore();

		if (os.platform() === 'win32') {
			// check that path should start with c:\program files
			let result = isNullOrUndefined(netcoreTool.netcoreInstallLocation) || netcoreTool.netcoreInstallLocation.toLowerCase().startsWith('c:\\program files');
			should(result).true('dotnet is either not present or in pogramfiles by default');
		}

		if (os.platform() === 'linux' || os.platform() === 'darwin') {
			//check that path should start with /usr/local/share
			let result = isNullOrUndefined(netcoreTool.netcoreInstallLocation) || netcoreTool.netcoreInstallLocation.toLowerCase().startsWith(NextCoreNonWindowsDefaultPath);
			should(result).true('dotnet is either not present or in /usr/local/share by default');
		}
	});

	it('should run a command successfully', async function (): Promise<void> {
		const netcoreTool = new NetCoreTool();
		const dummyFile =  path.join(await generateTestFolderPath(), 'dummy.dacpac');
		const outputChannel = vscode.window.createOutputChannel('db project test');

		try {
			await netcoreTool.runStreamedCommand('echo test > ' + getQuotedPath(dummyFile), outputChannel, undefined);
			const text = await fs.promises.readFile(dummyFile);
			should(text.toString().trim()).equal('test');
		}
		finally {
			await fs.exists(dummyFile, async (existBool) => {
				if (existBool) {
					await fs.promises.unlink(dummyFile);
				}
			});
		}
	});
});
