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
import { TestStorageService, TestTextResourcePropertiesService } from 'vs/workbench/test/common/workbenchTestServices';
import { createConnectionProfile } from 'sql/workbench/services/connection/test/browser/connectionManagementService.test';
import { getUniqueConnectionProvidersByNameMap } from 'sql/workbench/services/connection/test/browser/connectionDialogWidget.test';
import { TestConnectionDialogWidget } from 'sql/workbench/services/connection/test/browser/testConnectionDialogWidget';
import { ConnectionDialogService } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { TestLayoutService, workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { ServiceOptionType, ConnectionOptionSpecialType, IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ConnectionWidget } from 'sql/workbench/services/connection/browser/connectionWidget';
import { BrowserClipboardService } from 'vs/platform/clipboard/browser/clipboardService';
import { NullCommandService } from 'vs/platform/commands/common/commands';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ClearRecentConnectionsAction } from 'sql/workbench/services/connection/browser/connectionActions';
import { RecentConnectionActionsProvider } from 'sql/workbench/services/connection/browser/recentConnectionTreeController';
import { RecentConnectionDataSource } from 'sql/workbench/services/objectExplorer/browser/recentConnectionDataSource';
import { ServerTreeRenderer } from 'sql/workbench/services/objectExplorer/browser/serverTreeRenderer';
import { RecentConnectionsDragAndDrop } from 'sql/workbench/services/objectExplorer/browser/dragAndDropController';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Deferred } from 'sql/base/common/promise';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { localize } from 'vs/nls';
import { ViewDescriptorService } from 'vs/workbench/services/views/browser/viewDescriptorService';
import { ViewContainer, Extensions, IViewsRegistry, IViewContainersRegistry, ITreeViewDescriptor, ViewContainerLocation, IViewDescriptorService } from 'vs/workbench/common/views';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { TestTreeView } from 'sql/workbench/services/connection/test/browser/testTreeView';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { ConnectionTreeService, IConnectionTreeService } from 'sql/workbench/services/connection/common/connectionTreeService';
import { ConnectionBrowserView } from 'sql/workbench/services/connection/browser/connectionBrowseTab';

suite('ConnectionDialogService tests', () => {
	const testTreeViewId = 'testTreeView';
	const ViewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);

	let connectionDialogService: ConnectionDialogService;
	let mockConnectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	let testConnectionDialog: TestConnectionDialogWidget;
	let mockInstantationService: TypeMoq.Mock<InstantiationService>;
	let testConnectionParams: INewConnectionParams;
	let connectionProfile: ConnectionProfile;
	let mockWidget: TypeMoq.Mock<ConnectionWidget>;
	let testInstantiationService: TestInstantiationService;
	let container: ViewContainer;

	setup(() => {
		const viewInstantiationService: TestInstantiationService = <TestInstantiationService>workbenchInstantiationService();
		const viewDescriptorService = viewInstantiationService.createInstance(ViewDescriptorService);
		container = Registry.as<IViewContainersRegistry>(Extensions.ViewContainersRegistry).registerViewContainer({ id: 'testContainer', title: 'test', ctorDescriptor: new SyncDescriptor(<any>{}) }, ViewContainerLocation.Sidebar);
		viewInstantiationService.stub(IViewDescriptorService, viewDescriptorService);
		const viewDescriptor: ITreeViewDescriptor = {
			id: testTreeViewId,
			ctorDescriptor: null!,
			name: 'Test View 1',
			treeView: viewInstantiationService.createInstance(TestTreeView, 'testTree', 'Test Title'),
		};
		ViewsRegistry.registerViews([viewDescriptor], container);

		mockInstantationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Strict);
		testInstantiationService = new TestInstantiationService();
		testInstantiationService.stub(IStorageService, new TestStorageService());
		testInstantiationService.stub(ILogService, new NullLogService());
		testInstantiationService.stub(IConfigurationService, new TestConfigurationService());
		testInstantiationService.stub(IInstantiationService, mockInstantationService.object);
		testInstantiationService.stub(IViewDescriptorService, viewDescriptorService);
		let errorMessageService = getMockErrorMessageService();
		let capabilitiesService = new TestCapabilitiesService();
		mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict,
			undefined, // connection dialog service
			testInstantiationService, // instantiation service
			undefined, // editor service
			undefined, // telemetry service
			undefined, // configuration service
			new TestCapabilitiesService());
		testInstantiationService.stub(IConnectionManagementService, mockConnectionManagementService.object);
		testInstantiationService.stub(IContextKeyService, new MockContextKeyService());
		testInstantiationService.stub(IThemeService, new TestThemeService());
		testInstantiationService.stub(ILayoutService, new TestLayoutService());
		testInstantiationService.stub(IAdsTelemetryService, new NullAdsTelemetryService());
		testInstantiationService.stub(IConnectionTreeService, new ConnectionTreeService());
		connectionDialogService = new ConnectionDialogService(testInstantiationService, capabilitiesService, errorMessageService.object,
			new TestConfigurationService(), new BrowserClipboardService(), NullCommandService, new NullLogService());
		(connectionDialogService as any)._connectionManagementService = mockConnectionManagementService.object;
		let providerDisplayNames = ['Mock SQL Server'];
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server' };
		mockConnectionManagementService.setup(x => x.getUniqueConnectionProvidersByNameMap(TypeMoq.It.isAny())).returns(() => {
			return getUniqueConnectionProvidersByNameMap(providerNameToDisplayMap);
		});
		mockConnectionManagementService.setup(x => x.getConnectionGroups(TypeMoq.It.isAny())).returns(() => {
			return [new ConnectionProfileGroup('test_group', undefined, 'test_group')];
		});
		testConnectionDialog = new TestConnectionDialogWidget(providerDisplayNames, providerNameToDisplayMap['MSSQL'], providerNameToDisplayMap, testInstantiationService, mockConnectionManagementService.object, undefined, undefined, viewDescriptorService, new TestThemeService(), new TestLayoutService(), new NullAdsTelemetryService(), new MockContextKeyService(), undefined, new NullLogService(), new TestTextResourcePropertiesService(new TestConfigurationService), new TestConfigurationService(), new TestCapabilitiesService());
		testConnectionDialog.render();
		testConnectionDialog['renderBody'](DOM.createStyleSheet());
		(connectionDialogService as any)._connectionDialog = testConnectionDialog;

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
		capabilitiesService.fireCapabilitiesRegistered(Constants.mssqlProviderName, capabilitiesService.capabilities[Constants.mssqlProviderName]);
		testConnectionParams = <INewConnectionParams>{
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
		connectionProfile = createConnectionProfile('test_id');
		connectionProfile.providerName = undefined;

		mockConnectionManagementService.setup(x => x.getRecentConnections(TypeMoq.It.isValue(testConnectionParams.providers))).returns(() => {
			return [connectionProfile];
		});
		mockConnectionManagementService.setup(x => x.addSavedPassword(TypeMoq.It.isAny())).returns(() => {
			return Promise.resolve(connectionProfile);
		});
		mockWidget = TypeMoq.Mock.ofType(ConnectionWidget, TypeMoq.MockBehavior.Strict, [], undefined, 'MSSQL');
		mockWidget.setup(x => x.focusOnOpen());
		mockWidget.setup(x => x.handleOnConnecting());
		mockWidget.setup(x => x.handleResetConnection());
		mockWidget.setup(x => x.connect(TypeMoq.It.isValue(connectionProfile))).returns(() => true);
		mockWidget.setup(x => x.createConnectionWidget(TypeMoq.It.isAny()));
		mockWidget.setup(x => x.updateServerGroup(TypeMoq.It.isAny()));
		mockWidget.setup(x => x.initDialog(TypeMoq.It.isAny()));
		mockInstantationService.setup(x => x.createInstance(TypeMoq.It.isValue(ConnectionWidget), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAnyString())).returns(() => {
			return mockWidget.object;
		});
		mockWidget.setup(x => x.DefaultServerGroup).returns(() => {
			return {
				id: '',
				name: localize('defaultServerGroup', "<Default>"),
				parentId: undefined,
				color: undefined,
				description: undefined,
			};
		});
		mockWidget.setup(x => x.NoneServerGroup).returns(() => {
			return {
				id: '',
				name: localize('noneServerGroup', "<Do not save>"),
				parentId: undefined,
				color: undefined,
				description: undefined,
			};
		});
		mockWidget.setup(x => x.databaseDropdownExpanded).returns(() => false);
		mockWidget.setup(x => x.databaseDropdownExpanded = false);

		mockInstantationService.setup(x => x.createInstance(TypeMoq.It.isValue(ClearRecentConnectionsAction), TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => {
			return testInstantiationService.createInstance(ClearRecentConnectionsAction, ClearRecentConnectionsAction.ID, ClearRecentConnectionsAction.LABEL);
		});
		mockInstantationService.setup(x => x.createInstance(TypeMoq.It.isValue(RecentConnectionActionsProvider))).returns(() => {
			return testInstantiationService.createInstance(RecentConnectionActionsProvider);
		});
		mockInstantationService.setup(x => x.createInstance(TypeMoq.It.isValue(RecentConnectionDataSource))).returns(() => {
			return testInstantiationService.createInstance(RecentConnectionDataSource);
		});
		mockInstantationService.setup(x => x.createInstance(TypeMoq.It.isValue(ServerTreeRenderer), true)).returns(() => {
			return testInstantiationService.createInstance(ServerTreeRenderer, true);
		});
		mockInstantationService.setup(x => x.createInstance(TypeMoq.It.isValue(RecentConnectionsDragAndDrop))).returns(() => {
			return testInstantiationService.createInstance(RecentConnectionsDragAndDrop);
		});
		mockInstantationService.setup(x => x.createInstance(TypeMoq.It.isValue(ConnectionBrowserView))).returns(() => {
			return testInstantiationService.createInstance(ConnectionBrowserView);
		});
	});

	teardown(() => {
		ViewsRegistry.deregisterViews(ViewsRegistry.getViews(container), container);
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
				onConnectCanceled: function () { }
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

	test('openDialogAndWait should return a deferred promise when called', async () => {
		// connectionResult is used for testing showErrorDialog.
		let connectionResult: IConnectionResult = {
			connected: false,
			errorMessage: 'test_error',
			errorCode: -1,
			callStack: 'testCallStack'
		};
		// promise only resolves upon handleDefaultOnConnect, must return it at the end
		let connectionPromise = connectionDialogService.openDialogAndWait(mockConnectionManagementService.object, testConnectionParams, connectionProfile, connectionResult, false);

		/* handleDefaultOnConnect should reset connection and resolve properly
		Also openDialogAndWait returns the connection profile passed in */
		(connectionDialogService as any).handleDefaultOnConnect(testConnectionParams, connectionProfile);
		let result = await connectionPromise;
		assert.strictEqual(result, connectionProfile);
	});

	test('handleFillInConnectionInputs calls function on ConnectionController widget', async () => {
		let called = false;
		mockWidget.setup(x => x.fillInConnectionInputs(TypeMoq.It.isAny())).returns(() => {
			called = true;
		});
		await connectionDialogService.showDialog(mockConnectionManagementService.object, testConnectionParams, connectionProfile);
		await (connectionDialogService as any).handleFillInConnectionInputs(connectionProfile);
		let returnedModel = ((connectionDialogService as any)._connectionControllerMap['MSSQL'] as any)._model;
		assert.strictEqual(returnedModel._groupName, 'testGroup');
		assert(called);
	});

	test('handleOnConnect calls connectAndSaveProfile when called with profile', async () => {
		let called = false;
		mockConnectionManagementService.setup(x => x.connectAndSaveProfile(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
			called = true;
			return Promise.resolve(<IConnectionResult>{ connected: true, errorMessage: undefined, errorCode: undefined });
		});

		(connectionDialogService as any)._connectionDialog = undefined;
		(connectionDialogService as any)._dialogDeferredPromise = new Deferred<IConnectionProfile>();
		await connectionDialogService.showDialog(mockConnectionManagementService.object, testConnectionParams, connectionProfile).then(() => {
			((connectionDialogService as any)._connectionControllerMap['MSSQL'] as any)._model = connectionProfile;
			(connectionDialogService as any)._connectionDialog.connectButtonState = true;
			((connectionDialogService as any)._connectionDialog as any).connect(connectionProfile);
		});

		assert(called);
	});

	test('handleOnConnect calls connectAndSaveProfile when called without profile', async () => {
		let called = false;
		mockConnectionManagementService.setup(x => x.connectAndSaveProfile(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
			called = true;
			return Promise.resolve(<IConnectionResult>{ connected: true, errorMessage: undefined, errorCode: undefined });
		});

		(connectionDialogService as any)._connectionDialog = undefined;
		(connectionDialogService as any)._dialogDeferredPromise = new Deferred<IConnectionProfile>();
		await connectionDialogService.showDialog(mockConnectionManagementService.object, testConnectionParams, connectionProfile).then(() => {
			((connectionDialogService as any)._connectionControllerMap['MSSQL'] as any)._model = connectionProfile;
			(connectionDialogService as any)._connectionDialog.connectButtonState = true;
			((connectionDialogService as any)._connectionDialog as any).connect();
		});

		assert(called);
	});

	test('handleOnCancel calls cancelEditorConnection', async () => {
		let called = false;
		mockConnectionManagementService.setup(x => x.cancelEditorConnection(TypeMoq.It.isAny())).returns(() => {
			called = true;
			return Promise.resolve(true);
		});

		(connectionDialogService as any)._connectionDialog = undefined;
		(connectionDialogService as any)._dialogDeferredPromise = new Deferred<IConnectionProfile>();
		await connectionDialogService.showDialog(mockConnectionManagementService.object, testConnectionParams, connectionProfile).then(() => {
			((connectionDialogService as any)._connectionControllerMap['MSSQL'] as any)._model = connectionProfile;
			((connectionDialogService as any)._connectionDialog as any).cancel();
		});
		mockWidget.verify(x => x.databaseDropdownExpanded = false, TypeMoq.Times.atLeastOnce());
		assert(called);
	});
});
