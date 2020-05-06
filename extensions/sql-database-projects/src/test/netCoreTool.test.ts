/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as os from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { NetCoreTool, DBProjectConfigurationKey, NetCoreInstallLocationKey, NextCoreNonWindowsDefaultPath, DotNetCommandOptions, NetCoreInstallationConfirmation } from '../tools/netcoreTool';
import { isNullOrUndefined } from 'util';
import { BuildHelper } from '../tools/buildHelper';

describe('NetCoreTool: Net core install popup tests', function (): void {

	it('settings value should override default paths', async function (): Promise<void> {
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

	it('should find right default paths', async function (): Promise<void> {
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

	it('should run dotnet command', async function (): Promise<void> {
		this.timeout(10000 * 10); // higher timeout for this test

		const netcoreTool = new NetCoreTool();
		const projfile = path.join(__dirname, 'baselines', 'simpleProject.sqlproj');
		const dacpacfile = path.join(__dirname, 'baselines', 'bin', 'debug', 'simpleProject.dacpac');

		const buildHelper = new BuildHelper();
		await buildHelper.createBuildDirFolder();
		const arg = buildHelper.constructBuildArguments(projfile, buildHelper.extensionBuildDirPath);

		const options: DotNetCommandOptions = {
			argument: arg
		};

		try {
			await netcoreTool.runDotnetCommand(options);
			should(fs.existsSync(dacpacfile)).equal(true); //if net core is present
		}
		catch (error) {
			should(error.message).equal(NetCoreInstallationConfirmation); // if net ore is not present
		}
		finally {
			if (fs.existsSync(dacpacfile)) {
				fs.unlinkSync(dacpacfile);
			}
		}
	});
});
