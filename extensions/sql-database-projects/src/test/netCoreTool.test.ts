/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { NetCoreTool, DBProjectConfigurationKey, NetCoreInstallLocationKey, NetCoreNonWindowsDefaultPath } from '../tools/netcoreTool';
import { getQuotedPath } from '../common/utils';
import { isNullOrUndefined } from 'util';
import { generateTestFolderPath } from './testUtils';

describe('NetCoreTool: Net core tests', function (): void {
	afterEach(function (): void {
		sinon.restore();
	});

	it('Should override dotnet default value with settings', async function (): Promise<void> {
		try {
			// update settings and validate
			await vscode.workspace.getConfiguration(DBProjectConfigurationKey).update(NetCoreInstallLocationKey, 'test value path', true);
			const netcoreTool = new NetCoreTool();
			sinon.stub(netcoreTool, 'showInstallDialog').returns(Promise.resolve());
			should(netcoreTool.netcoreInstallLocation).equal('test value path'); // the path in settings should be taken
			should(await netcoreTool.findOrInstallNetCore()).equal(false); // dotnet can not be present at dummy path in settings
		}
		finally {
			// clean again
			await vscode.workspace.getConfiguration(DBProjectConfigurationKey).update(NetCoreInstallLocationKey, '', true);
		}
	});

	it('Should find right dotnet default paths', async function (): Promise<void> {
		const netcoreTool = new NetCoreTool();
		sinon.stub(netcoreTool, 'showInstallDialog').returns(Promise.resolve());
		await netcoreTool.findOrInstallNetCore();

		if (os.platform() === 'win32') {
			// check that path should start with c:\program files
			let result = isNullOrUndefined(netcoreTool.netcoreInstallLocation) || netcoreTool.netcoreInstallLocation.toLowerCase().startsWith('c:\\program files');
			should(result).true('dotnet is either not present or in programfiles by default');
		}

		if (os.platform() === 'linux' || os.platform() === 'darwin') {
			//check that path should start with /usr/local/share
			let result = isNullOrUndefined(netcoreTool.netcoreInstallLocation) || netcoreTool.netcoreInstallLocation.toLowerCase().startsWith(NetCoreNonWindowsDefaultPath);
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
