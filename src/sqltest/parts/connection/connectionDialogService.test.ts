/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ConnectionDialogService } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { ConnectionDialogWidget } from 'sql/workbench/services/connection/browser/connectionDialogWidget';
import { ConnectionManagementService } from 'sql/platform/connection/common/connectionManagementService';
import { ConnectionType, IConnectableInput, IConnectionResult, INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { ContextKeyServiceStub } from 'sqltest/stubs/contextKeyServiceStub';
import { ErrorMessageServiceStub } from 'sqltest/stubs/errorMessageServiceStub';

import * as TypeMoq from 'typemoq';

suite('ConnectionDialogService tests', () => {

	let connectionDialogService: ConnectionDialogService;
	let mockConnectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	let mockConnectionDialog: TypeMoq.Mock<ConnectionDialogWidget>;

	setup(() => {
		let errorMessageService = getMockErrorMessageService();
		connectionDialogService = new ConnectionDialogService(undefined, undefined, undefined, errorMessageService.object,
			undefined, undefined, undefined);
		mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict, {}, {});
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
			new ContextKeyServiceStub()
		);
		mockConnectionDialog.setup(c => c.resetConnection());
		(connectionDialogService as any)._connectionDialog = mockConnectionDialog.object;
	});

	function getMockErrorMessageService(): TypeMoq.Mock<ErrorMessageServiceStub> {
		let mockMessageService = TypeMoq.Mock.ofType(ErrorMessageServiceStub);
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

	test('handleDefaultOnConnect uses params URI for editor connections', done => {
		testHandleDefaultOnConnectUri(true).then(() => done(), err => {
			done(err);
		});
	});

	test('handleDefaultOnConnect uses undefined URI for non-editor connections', done => {
		testHandleDefaultOnConnectUri(false).then(() => done(), err => {
			done(err);
		});
	});
});