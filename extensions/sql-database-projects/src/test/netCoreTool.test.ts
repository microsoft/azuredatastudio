/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import * as baselines from './baselines/baselines';
import * as templates from '../templates/templates';
import { NetCoreTool, DBProjectConfigurationKey, NetCoreInstallLocationKey } from '../tools/netcoreTool';
import { isNullOrUndefined } from 'util';


describe('ProjectsController: project controller operations', function (): void {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	it('settings value should override default paths', async function (): Promise<void> {
		try {
			// update settings and validate
			await vscode.workspace.getConfiguration(DBProjectConfigurationKey).update(NetCoreInstallLocationKey, 'test value path', true);
			const netcoreTool = new NetCoreTool();
			should(netcoreTool.netcoreInstallLocation).equal('test value path'); // the path in settings should be taken
			should(netcoreTool.isNetCoreInstallationPresent).equal(false); // dotnet can not be present at dummy path in settings
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
			let result = isNullOrUndefined(netcoreTool.netcoreInstallLocation) || netcoreTool.netcoreInstallLocation.toLowerCase().startsWith('c:\\program files');
			should(result).true('dotnet is either not present or in pogramfiles by default');
		}

		if (os.platform() === 'linux' || os.platform() === 'darwin') {
			let result = isNullOrUndefined(netcoreTool.netcoreInstallLocation) || netcoreTool.netcoreInstallLocation.toLowerCase().startsWith('/usr/local/share');
			should(result).true('dotnet is either not present or in /usr/local/share by default');
		}
	});
});

export async function sleep(ms: number): Promise<{}> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
