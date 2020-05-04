/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as constants from '../../constants';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import * as vscode from 'vscode';
import { ensure } from '../../services/serviceUtils';
import { FilterErrorPath } from '../../services/telemetry';
import { promises as fs } from 'fs';
import { ServiceClient } from '../../services/serviceClient';


describe('import extension services', function (): void {
	describe('service utils', function (): void {
		it('ensure', async () => {
			//Checking with a non empty key
			should(ensure({ testKey: 'testVal' }, 'testKey')).equal('testVal');
			//Checking with an empty key
			should(ensure({}, 'testKey')).equal({});
		});
	});

	describe('telemetry', function (): void {
		it('filter error path', async () => {
			let inValidOutput = FilterErrorPath('invalidTestInput');
			should(inValidOutput).equal('invalidTestInput');
			let validOutput = FilterErrorPath('src/out/testFile.js');
			should(validOutput).equal('testFile.js');
		});
	});

	describe('service client', function (): void {
		it('check file downloaded', async () => {
			// let vscodeContext: TypeMoq.IMock<vscode.ExtensionContext> = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
			// const rawConfig = await fs.readFile(path.join(context.extensionPath, 'config.json'));
			// const outputChannel = vscode.window.createOutputChannel(constants.serviceName);
			// await new ServiceClient(outputChannel).startService(vscodeContext.object);

		});
	});
});
