/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdataExt from 'azdata-ext';
import * as should from 'should';
import * as sinon from 'sinon';
import { ArcControllerConfigProfilesOptionsSource } from '../../providers/arcControllerConfigProfilesOptionsSource';

describe('arcControllerConfigProfilesOptionsSource', async function (): Promise<void> {
	afterEach(function(): void {
		sinon.restore();
	});

	it('eula accepted returns list', async function (): Promise<void> {
		const options = ['option1', 'option2'];
		const api = vscode.extensions.getExtension(azdataExt.extension.name)?.exports as azdataExt.IExtension;
		sinon.stub(api, 'isEulaAccepted').resolves(true);
		sinon.stub(api.azdata.arc.dc.config, 'list').resolves({ stdout: [''], stderr: [''], logs: [''], result: options});
		const source = new ArcControllerConfigProfilesOptionsSource(api);
		const result = await source.getOptions();
		should(result).deepEqual(options);
	});

	it('eula not accepted prompts for acceptance', async function (): Promise<void> {
		const options = ['option1', 'option2'];
		const api = vscode.extensions.getExtension(azdataExt.extension.name)?.exports as azdataExt.IExtension;
		sinon.stub(api, 'isEulaAccepted').resolves(false);
		const promptStub = sinon.stub(api, 'promptForEula').resolves(true);
		sinon.stub(api.azdata.arc.dc.config, 'list').resolves({ stdout: [''], stderr: [''], logs: [''], result: options});
		const source = new ArcControllerConfigProfilesOptionsSource(api);
		const result = await source.getOptions();
		should(result).deepEqual(options);
		should(promptStub.calledOnce).be.true('promptForEula should have been called');
	});
});
