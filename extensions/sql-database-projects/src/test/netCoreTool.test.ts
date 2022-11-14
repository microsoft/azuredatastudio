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
import { NetCoreTool, DBProjectConfigurationKey, DotnetInstallLocationKey } from '../tools/netcoreTool';
import { getQuotedPath } from '../common/utils';
import { deleteGeneratedTestFolder, generateTestFolderPath } from './testUtils';
import { createContext, TestContext } from './testContext';

let testContext: TestContext;

describe('NetCoreTool: Net core tests', function (): void {
	afterEach(function (): void {
		sinon.restore();
	});

	beforeEach(function (): void {
		testContext = createContext();
	});

	after(async function(): Promise<void> {
		await deleteGeneratedTestFolder();
	});

	it('Should override dotnet default value with settings', async function (): Promise<void> {
		try {
			// update settings and validate
			await vscode.workspace.getConfiguration(DBProjectConfigurationKey).update(DotnetInstallLocationKey, 'test value path', true);
			const netcoreTool = new NetCoreTool(testContext.outputChannel);
			sinon.stub(netcoreTool, 'showInstallDialog').returns(Promise.resolve());
			should(netcoreTool.netcoreInstallLocation).equal('test value path'); // the path in settings should be taken
			should(await netcoreTool.findOrInstallNetCore()).equal(false); // dotnet can not be present at dummy path in settings
		}
		finally {
			// clean again
			await vscode.workspace.getConfiguration(DBProjectConfigurationKey).update(DotnetInstallLocationKey, '', true);
		}
	});

	it('Should find right dotnet default paths', async function (): Promise<void> {
		const netcoreTool = new NetCoreTool(testContext.outputChannel);
		sinon.stub(netcoreTool, 'showInstallDialog').returns(Promise.resolve());
		await netcoreTool.findOrInstallNetCore();

		if (os.platform() === 'win32') {
			// check that path should start with c:\program files
			let result = !netcoreTool.netcoreInstallLocation || netcoreTool.netcoreInstallLocation.toLowerCase().startsWith('c:\\program files');
			should(result).true('dotnet not present in programfiles by default');
		}

		if (os.platform() === 'linux'){
			//check that path should start with /usr/share
			let result = !netcoreTool.netcoreInstallLocation || netcoreTool.netcoreInstallLocation.toLowerCase() === '/usr/share/dotnet';
			should(result).true('dotnet not present in /usr/share');
		}

		if (os.platform() === 'darwin') {
			//check that path should start with /usr/local/share
			let result = !netcoreTool.netcoreInstallLocation || netcoreTool.netcoreInstallLocation.toLowerCase() === '/usr/local/share/dotnet';
			should(result).true('dotnet not present in /usr/local/share');
		}
	});

	it('should run a command successfully', async function (): Promise<void> {
		const netcoreTool = new NetCoreTool(testContext.outputChannel);
		const dummyFile =  path.join(await generateTestFolderPath(), 'dummy.dacpac');

		try {
			await netcoreTool.runStreamedCommand('echo test > ' + getQuotedPath(dummyFile), undefined);
			const text = await fs.promises.readFile(dummyFile);
			should(text.toString().trim()).equal('test');
		}
		finally {
			try {
				await fs.promises.unlink(dummyFile);
			} catch (err) {
				console.warn(`Failed to clean up ${dummyFile}`);
			}
		}
	});
});
