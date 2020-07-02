/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { ConnectionType, IConnectableInput, IConnectionResult, INewConnectionParams, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TestErrorMessageService } from 'sql/platform/errorMessage/test/common/testErrorMessageService';

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import * as DOM from 'vs/base/browser/dom';
import * as Constants from 'sql/platform/connection/common/constants';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { NullLogService, ILogService } from 'vs/platform/log/common/log';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { createConnectionProfile } from 'sql/workbench/services/connection/test/browser/connectionManagementService.test';
import { getUniqueConnectionProvidersByNameMap } from 'sql/workbench/services/connection/test/browser/connectionDialogWidget.test';
import { TestConnectionDialogWidget } from 'sql/workbench/services/connection/test/browser/testConnectionDialogWidget';
import { ConnectionDialogService } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { TestLayoutService } from 'vs/workbench/test/browser/workbenchTestServices';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { ServiceOptionType, ConnectionOptionSpecialType } from 'sql/platform/connection/common/interfaces';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ConnectionWidget } from 'sql/workbench/services/connection/browser/connectionWidget';
import { BrowserClipboardService } from 'vs/platform/clipboard/browser/clipboardService';
import { NullCommandService } from 'vs/platform/commands/common/commands';

suite('ConnectionDialogService tests', () => {

	let connectionDialogService: ConnectionDialogService;
	let mockConnectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	let testConnectionDialog: TestConnectionDialogWidget;
	let mockInstantationService: TypeMoq.Mock<InstantiationService>;

	setup(() => {
		mockInstantationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
		let testinstantiationService = new TestInstantiationService();
		testinstantiationService.stub(IStorageService, new TestStorageService());
		testinstantiationService.stub(ILogService, new NullLogService());
		testinstantiationService.stub(IConfigurationService, new TestConfigurationService());
		testinstantiationService.stub(IInstantiationService, mockInstantationService.object);
		let errorMessageService = getMockErrorMessageService();
		let capabilitiesService = new TestCapabilitiesService();
		capabilitiesService.capabilities[Constants.mssqlProviderName] = {
			connection: {
				providerId: Constants.mssqlProviderName,
				displayName: 'MSSQL',
				connectionOptions: [
					{
						name: 'authenticationType',
						displayName: undefined,
						description: undefined,
						groupName: undefined,
						categoryValues: [
							{
								name: 'authenticationType',
								displayName: 'authenticationType'
							}
						],
						defaultValue: undefined,
						isIdentity: true,
						isRequired: true,
						specialValueType: ConnectionOptionSpecialType.authType,
						valueType: ServiceOptionType.string
					}
				]
			}
		};
		mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict,
			undefined, // connection store
			undefined, // connection status manager
			undefined, // connection dialog service
			testinstantiationService, // instantiation service
			undefined, // editor service
			undefined, // telemetry service
			undefined, // configuration service
			new TestCapabilitiesService());
		testinstantiationService.stub(IConnectionManagementService, mockConnectionManagementService.object);
		connectionDialogService = new ConnectionDialogService(testinstantiationService, capabilitiesService, errorMessageService.object,
			new TestConfigurationService(), new BrowserClipboardService(), NullCommandService, new NullLogService());
		(connectionDialogService as any)._connectionManagementService = mockConnectionManagementService.object;
		let providerDisplayNames = ['Mock SQL Server'];
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server' };
		testConnectionDialog = new TestConnectionDialogWidget(providerDisplayNames, providerNameToDisplayMap['MSSQL'], providerNameToDisplayMap, testinstantiationService, mockConnectionManagementService.object, new TestThemeService(), new TestLayoutService(), new NullAdsTelemetryService(), new MockContextKeyService(), undefined, undefined, undefined, new NullLogService(), undefined);
		testConnectionDialog.render();
		testConnectionDialog.renderBody(DOM.createStyleSheet());
		(connectionDialogService as any)._connectionDialog = testConnectionDialog;
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

	test('openDialogAndWait should return a deferred promise when called', () => {
		let connectionParams = <INewConnectionParams>{
			connectionType: ConnectionType.editor,
			input: <IConnectableInput>{
				uri: 'test_uri',
				onConnectStart: undefined,
				onConnectSuccess: undefined,
				onConnectReject: undefined,
				onDisconnect: undefined,
				onConnectCanceled: undefined
			},
			runQueryOnCompletion: undefined,
			querySelection: undefined,
			providers: ['MSSQL']
		};
		let connectionProfile = createConnectionProfile('test_id');
		connectionProfile.providerName = undefined;

		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server' };
		mockConnectionManagementService.setup(x => x.getUniqueConnectionProvidersByNameMap(TypeMoq.It.isAny())).returns(() => {
			return getUniqueConnectionProvidersByNameMap(providerNameToDisplayMap);
		});
		mockConnectionManagementService.setup(x => x.getRecentConnections(TypeMoq.It.isValue(connectionParams.providers))).returns(() => {
			return [connectionProfile];
		});
		let mockWidget = TypeMoq.Mock.ofType(ConnectionWidget, TypeMoq.MockBehavior.Strict, [], undefined, 'MSSQL');
		mockWidget.setup(x => x.focusOnOpen());
		mockInstantationService.setup(x => x.createInstance(TypeMoq.It.isValue(ConnectionWidget), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAnyString())).returns(() => {
			return mockWidget.object;
		});
		// connectionResult is used for testing showErrorDialog.
		let connectionResult: IConnectionResult = {
			connected: false,
			errorMessage: 'test_error',
			errorCode: -1,
			callStack: 'testCallStack'
		};
		// promise only resolves upon handleDefaultOnConnect, must return it at the end
		let connectionPromise = connectionDialogService.openDialogAndWait(mockConnectionManagementService.object, connectionParams, connectionProfile, connectionResult, false);

		/* handleDefaultOnConnect should reset connection and resolve properly
		Also openDialogAndWait returns the connection profile passed in */
		let thenable: Thenable<void> = (connectionDialogService as any).handleDefaultOnConnect(connectionParams, connectionProfile);
		return thenable.then(() => {
			return connectionPromise.then(e => {
				assert.equal(e, connectionProfile);
			});
		});
	});
});
