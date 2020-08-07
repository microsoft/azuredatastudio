/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as sinon from 'sinon';
import { ControllerInfo, ControllerModel, Registration } from '../../../models/controllerModel';
import { ConnectToControllerDialog } from '../../../ui/dialogs/connectControllerDialog';

describe('ConnectControllerDialog', function (): void {
	afterEach(function (): void {
		sinon.restore();
	});

	(<{ info: ControllerInfo | undefined, description: string }[]>[
		{ info: undefined, description: 'all input' },
		{ info: { url: '127.0.0.1' }, description: 'all but URL' },
		{ info: { url: '127.0.0.1', username: 'sa' }, description: 'all but URL and password' }]).forEach(test => {
			it(`Validate returns false when ${test.description} is empty`, async function (): Promise<void> {
				const connectControllerDialog = new ConnectToControllerDialog(undefined!);
				connectControllerDialog.showDialog(test.info, undefined);
				await connectControllerDialog.isInitialized;
				const validateResult = await connectControllerDialog.validate();
				should(validateResult).be.false();
			});
		});

	it('validate returns false if controller refresh fails', async function (): Promise<void> {
		sinon.stub(ControllerModel.prototype, 'refresh').returns(Promise.reject('Controller refresh failed'));
		const connectControllerDialog = new ConnectToControllerDialog(undefined!);
		const info = { url: 'https://127.0.0.1:30080', name: 'my-arc', username: 'sa', rememberPassword: true, resources: [] };
		connectControllerDialog.showDialog(info, 'pwd');
		await connectControllerDialog.isInitialized;
		const validateResult = await connectControllerDialog.validate();
		should(validateResult).be.false('Validation should have returned false');
	});

	it('validate replaces http with https', async function (): Promise<void> {
		await validateConnectControllerDialog(
			{ url: 'http://127.0.0.1:30081', name: 'my-arc', username: 'sa', rememberPassword: true, resources: [] },
			'https://127.0.0.1:30081');
	});

	it('validate appends https if missing', async function (): Promise<void> {
		await validateConnectControllerDialog({ url: '127.0.0.1:30080', name: 'my-arc', username: 'sa', rememberPassword: true, resources: [] },
			'https://127.0.0.1:30080');
	});

	it('validate appends default port if missing', async function (): Promise<void> {
		await validateConnectControllerDialog({ url: 'https://127.0.0.1', name: 'my-arc', username: 'sa', rememberPassword: true, resources: [] },
			'https://127.0.0.1:30080');
	});

	it('validate appends both port and https if missing', async function (): Promise<void> {
		await validateConnectControllerDialog({ url: '127.0.0.1', name: 'my-arc', username: 'sa', rememberPassword: true, resources: [] },
			'https://127.0.0.1:30080');
	});

	for (const name of ['', undefined]) {
		it(`validate display name gets set to arc instance name for user chosen name of:${name}`, async function (): Promise<void> {
			await validateConnectControllerDialog(
				{ url: 'http://127.0.0.1:30081', name: name!, username: 'sa', rememberPassword: true, resources: [] },
				'https://127.0.0.1:30081');
		});
	}

});

async function validateConnectControllerDialog(info: ControllerInfo, expectedUrl: string): Promise<void> {
	const arcInstanceName = 'arc-instance';
	const expectedControllerInfoName = info.name || arcInstanceName;
	// For first set of tests just stub out refresh calls - we'll test that separately
	const connectControllerDialog = new ConnectToControllerDialog(undefined!);
	sinon.stub(ControllerModel.prototype, 'refresh').returns(Promise.resolve());
	sinon.stub(ControllerModel.prototype, 'controllerRegistration').get(function getterFunction() {
		return <Registration>{ instanceName: arcInstanceName };
	});
	connectControllerDialog.showDialog(info, 'pwd');
	await connectControllerDialog.isInitialized;
	const validateResult = await connectControllerDialog.validate();
	should(validateResult).be.true('Validation should have returned true');
	const model = await connectControllerDialog.waitForClose();
	should(model?.controllerModel.info.url).equal(expectedUrl);
	should(model?.controllerModel.info.name).equal(expectedControllerInfoName);
}
