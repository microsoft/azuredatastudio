// /*---------------------------------------------------------------------------------------------
//  *  Copyright (c) Microsoft Corporation. All rights reserved.
//  *  Licensed under the Source EULA. See License.txt in the project root for license information.
//  *--------------------------------------------------------------------------------------------*/

// import { ControllerInfo } from 'arc';
// import * as should from 'should';
// import * as sinon from 'sinon';
// import { v4 as uuid } from 'uuid';
// import * as loc from '../../../localizedConstants';
// import { ControllerModel } from '../../../models/controllerModel';
// import { ConnectToControllerDialog } from '../../../ui/dialogs/connectControllerDialog';

// describe('ConnectControllerDialog', function (): void {
// 	afterEach(function (): void {
// 		sinon.restore();
// 	});

// 	(<{ info: ControllerInfo | undefined, description: string }[]>[
// 		{ info: undefined, description: 'all input' },
// 		{ info: { endpoint: '127.0.0.1' }, description: 'all but URL' },
// 		{ info: { endpoint: '127.0.0.1', username: 'sa' }, description: 'all but URL and password' }]).forEach(test => {
// 			it(`Validate returns false when ${test.description} is empty`, async function (): Promise<void> {
// 				const connectControllerDialog = new ConnectToControllerDialog(undefined!);
// 				connectControllerDialog.showDialog(test.info, undefined);
// 				await connectControllerDialog.isInitialized;
// 				const validateResult = await connectControllerDialog.validate();
// 				should(validateResult).be.false();
// 			});
// 		});

// 	it('validate returns false if controller refresh fails', async function (): Promise<void> {
// 		sinon.stub(ControllerModel.prototype, 'refresh').returns(Promise.reject('Controller refresh failed'));
// 		const connectControllerDialog = new ConnectToControllerDialog(undefined!);
// 		const info: ControllerInfo = { id: uuid(), endpoint: 'https://127.0.0.1:30080', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', name: 'my-arc', namespace: 'arc-ns', username: 'sa', rememberPassword: true, resources: [] };
// 		connectControllerDialog.showDialog(info, 'pwd');
// 		await connectControllerDialog.isInitialized;
// 		const validateResult = await connectControllerDialog.validate();
// 		should(validateResult).be.false('Validation should have returned false');
// 	});

// 	it('validate replaces http with https', async function (): Promise<void> {
// 		await validateConnectControllerDialog(
// 			{ id: uuid(), endpoint: 'http://127.0.0.1:30081', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', name: 'my-arc', namespace: 'arc-ns', username: 'sa', rememberPassword: true, resources: [] },
// 			'https://127.0.0.1:30081');
// 	});

// 	it('validate appends https if missing', async function (): Promise<void> {
// 		await validateConnectControllerDialog({ id: uuid(), endpoint: '127.0.0.1:30080', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', name: 'my-arc', namespace: 'arc-ns', username: 'sa', rememberPassword: true, resources: [] },
// 			'https://127.0.0.1:30080');
// 	});

// 	it('validate appends default port if missing', async function (): Promise<void> {
// 		await validateConnectControllerDialog({ id: uuid(), endpoint: 'https://127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', name: 'my-arc', namespace: 'arc-ns', username: 'sa', rememberPassword: true, resources: [] },
// 			'https://127.0.0.1:30080');
// 	});

// 	it('validate appends both port and https if missing', async function (): Promise<void> {
// 		await validateConnectControllerDialog({ id: uuid(), endpoint: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', name: 'my-arc', namespace: 'arc-ns', username: 'sa', rememberPassword: true, resources: [] },
// 			'https://127.0.0.1:30080');
// 	});

// 	for (const name of ['', undefined]) {
// 		it.skip(`validate display name gets set to arc instance name for user chosen name of:${name}`, async function (): Promise<void> {
// 			await validateConnectControllerDialog(
// 				{ id: uuid(), endpoint: 'http://127.0.0.1:30081', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', name: name!, namespace: 'arc-ns', username: 'sa', rememberPassword: true, resources: [] },
// 				'https://127.0.0.1:30081');
// 		});
// 	}

// 	it.skip(`validate display name gets set to default data controller name for user chosen name of:'' and instanceName in explicably returned as undefined from the controller endpoint`, async function (): Promise<void> {
// 		await validateConnectControllerDialog(
// 			{ id: uuid(), endpoint: 'http://127.0.0.1:30081', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', name: '', namespace: 'arc-ns', username: 'sa', rememberPassword: true, resources: [] },
// 			'https://127.0.0.1:30081',
// 			undefined);
// 	});
// });

// async function validateConnectControllerDialog(info: ControllerInfo, expectedUrl: string, arcInstanceName: string = 'arc-instance'): Promise<void> {
// 	const expectedControllerInfoName = info.name || arcInstanceName || loc.defaultControllerName;
// 	const connectControllerDialog = new ConnectToControllerDialog(undefined!);
// 	// Stub out refresh calls to controllerModel - we'll test those separately
// 	sinon.stub(ControllerModel.prototype, 'refresh').returns(Promise.resolve());
// 	// stub out controller registration response to return a known instanceName for the dc.
// 	/*
// 	sinon.stub(ControllerModel.prototype, 'controllerRegistration').get(() => {
// 		return <Registration>{ instanceName: arcInstanceName };
// 	});
// 	*/
// 	connectControllerDialog.showDialog(info, 'pwd');
// 	await connectControllerDialog.isInitialized;
// 	const validateResult = await connectControllerDialog.validate();
// 	should(validateResult).be.true('Validation should have returned true');
// 	const model = await connectControllerDialog.waitForClose();
// 	should(model?.controllerModel.info.endpoint).equal(expectedUrl);
// 	should(model?.controllerModel.info.name).equal(expectedControllerInfoName);
// }
