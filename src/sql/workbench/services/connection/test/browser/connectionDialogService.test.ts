/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionDialogService } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { ConnectionDialogWidget } from 'sql/workbench/services/connection/browser/connectionDialogWidget';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { ConnectionType, IConnectableInput, IConnectionResult, INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { TestErrorMessageService } from 'sql/platform/errorMessage/test/common/testErrorMessageService';

import * as TypeMoq from 'typemoq';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { NullLogService } from 'vs/platform/log/common/log';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';

suite('ConnectionDialogService tests', () => {

	let connectionDialogService: ConnectionDialogService;
	let mockConnectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	let mockConnectionDialog: TypeMoq.Mock<ConnectionDialogWidget>;

	setup(() => {
		let testinstantiationService = new TestInstantiationService();
		testinstantiationService.stub(IStorageService, new TestStorageService());
		let errorMessageService = getMockErrorMessageService();
		connectionDialogService = new ConnectionDialogService(undefined, undefined, errorMessageService.object,
			undefined, undefined, undefined, new NullLogService());
		mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict,
			undefined, // connection store
			undefined, // connection status manager
			undefined, // connection dialog service
			testinstantiationService, // instantiation service
			undefined, // editor service
			undefined, // telemetry service
			undefined, // configuration service
			new TestCapabilitiesService());
		(connectionDialogService as any)._connectionManagementService = mockConnectionManagementService.object;
		mockConnectionDialog = TypeMoq.Mock.ofType(ConnectionDialogWidget, TypeMoq.MockBehavior.Strict,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			new MockContextKeyService()
		);
		mockConnectionDialog.setup(c => c.resetConnection());
		(connectionDialogService as any)._connectionDialog = mockConnectionDialog.object;
	});

	function getMockErrorMessageService(): TypeMoq.Mock<TestErrorMessageService> {
		let mockMessageService = TypeMoq.Mock.ofType(TestErrorMessageService);
		mockMessageService.setup(x => x.showDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()));
		return mockMessageService;
	}

	function testHandleDefaultOnConnectUri(isEditor: boolean): Thenable<void> {
		let testUri = 'test_uri';
		let connectionParams = <INewConnectionParams>{
			connectionType: isEditor ? ConnectionType.editor : ConnectionType.default,
			input: <IConnectableInput>{
				uri: testUri,
				onConnectStart: undefined,
				onConnectSuccess: undefined,
				onConnectReject: undefined,
				onDisconnect: undefined,
				onConnectCanceled: undefined
			},
			runQueryOnCompletion: undefined,
			querySelection: undefined
		};
		mockConnectionManagementService.setup(x => x.connectAndSaveProfile(undefined, TypeMoq.It.is(_ => true), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(
			() => Promise.resolve(<IConnectionResult>{ connected: true, errorMessage: undefined, errorCode: undefined }));

		// If I call handleDefaultOnConnect with the given parameters
		let thenable: Thenable<void> = (connectionDialogService as any).handleDefaultOnConnect(connectionParams, undefined);
		return thenable.then(() => {
			// Then the Connection Management Service's connect method was called with the expected URI
			let expectedUri = isEditor ? testUri : undefined;
			mockConnectionManagementService.verify(
				x => x.connectAndSaveProfile(undefined, TypeMoq.It.is(uri => uri === expectedUri), TypeMoq.It.isAny(), TypeMoq.It.isAny()),
				TypeMoq.Times.once());
		});
	}

	test('handleDefaultOnConnect uses params URI for editor connections', () => {
		return testHandleDefaultOnConnectUri(true);
	});

	test('handleDefaultOnConnect uses undefined URI for non-editor connections', () => {
		return testHandleDefaultOnConnectUri(false);
	});
});
