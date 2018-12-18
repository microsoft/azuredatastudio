/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { context } from './testContext';
import { join, normalize } from 'path';
import * as fs from 'fs';

if (!context.RunTest) {
	suite('test setup', () => {
		vscode.workspace.getConfiguration().update('workbench.enablePreviewFeatures', true, true);
		vscode.workspace.getConfiguration().update('workbench.showConnectDialogOnStartup', false, true);
		vscode.workspace.getConfiguration().update('adstest.testSetupCompleted', true, true);
		let extensionInstallersFolder = normalize(join(__dirname, '../extensionInstallers'));
		let installers = fs.readdirSync(extensionInstallersFolder);
		installers.forEach(installer => {
			let installerFullPath = join(extensionInstallersFolder, installer);
			test(`install extension: ${installer}`, function (done) {
				sqlops.extensionManagement.install(installerFullPath).then((reason) => {
					if (reason) {
						done(reason);
					} else {
						done();
					}
				});
			});
		});
	});
}
