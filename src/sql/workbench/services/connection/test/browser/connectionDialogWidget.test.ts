/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import * as DOM from 'vs/base/browser/dom';
import * as Constants from 'sql/platform/connection/common/constants';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestStorageService, TestTextResourcePropertiesService } from 'vs/workbench/test/common/workbenchTestServices';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { NullLogService } from 'vs/platform/log/common/log';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { TestConnectionDialogWidget } from 'sql/workbench/services/connection/test/browser/testConnectionDialogWidget';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { entries } from 'sql/base/common/collections';
import { TestLayoutService, workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { INewConnectionParams, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { NullAdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { createConnectionProfile } from 'sql/workbench/services/connection/test/browser/connectionManagementService.test';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { ViewDescriptorService } from 'vs/workbench/services/views/browser/viewDescriptorService';
import { ViewContainer, Extensions, IViewsRegistry, IViewContainersRegistry, ITreeViewDescriptor, ViewContainerLocation, IViewDescriptorService } from 'vs/workbench/common/views';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { TestTreeView } from 'sql/workbench/services/connection/test/browser/testTreeView';
import { ConnectionTreeService, IConnectionTreeService } from 'sql/workbench/services/connection/common/connectionTreeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
suite('ConnectionDialogWidget tests', () => {
	const testTreeViewId = 'testTreeView';
	const ViewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);

	let connectionDialogWidget: TestConnectionDialogWidget;
	let mockConnectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	let cmInstantiationService: TestInstantiationService;
	let element: HTMLElement;
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
		cmInstantiationService = new TestInstantiationService();
		cmInstantiationService.stub(IStorageService, new TestStorageService());
		cmInstantiationService.stub(IConnectionTreeService, new ConnectionTreeService());
		cmInstantiationService.stub(IContextKeyService, new MockContextKeyService());

		mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict,
			undefined, // connection dialog service
			cmInstantiationService, // instantiation service
			undefined, // editor service
			undefined, // telemetry service
			undefined, // configuration service
			new TestCapabilitiesService());
		let providerDisplayNames = ['Mock SQL Server'];
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server' };
		connectionDialogWidget = new TestConnectionDialogWidget(providerDisplayNames, providerNameToDisplayMap['MSSQL'], providerNameToDisplayMap, cmInstantiationService, mockConnectionManagementService.object, undefined, undefined, viewDescriptorService, new TestThemeService(), new TestLayoutService(), new NullAdsTelemetryService(), new MockContextKeyService(), undefined, new NullLogService(), new TestTextResourcePropertiesService(new TestConfigurationService()), new TestConfigurationService());
		element = DOM.createStyleSheet();
		connectionDialogWidget.render();
		connectionDialogWidget['renderBody'](element);
	});

	teardown(() => {
		ViewsRegistry.deregisterViews(ViewsRegistry.getViews(container), container);
	});

	test('renderBody should have attached a connection dialog body onto element', () => {
		assert.strictEqual(element.childElementCount, 1);
		assert.strictEqual(element.children[0].className, 'connection-dialog');
	});

	test('updateConnectionProviders should update connection providers', () => {
		let providerDisplayNames = ['Mock SQL Server', 'Mock SQL Server 1'];
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server', 'PGSQL': 'Mock SQL Server 1' };
		mockConnectionManagementService.setup(x => x.getUniqueConnectionProvidersByNameMap(TypeMoq.It.isAny())).returns(() => {
			return getUniqueConnectionProvidersByNameMap(providerNameToDisplayMap);
		});
		connectionDialogWidget.updateConnectionProviders(providerDisplayNames, providerNameToDisplayMap);
		assert.strictEqual(connectionDialogWidget.getDisplayNameFromProviderName('PGSQL'), providerNameToDisplayMap['PGSQL']);
	});

	test('setting newConnectionParams test for connectionDialogWidget', () => {
		let params: INewConnectionParams = {
			connectionType: ConnectionType.editor,
			input: {
				onConnectReject: undefined,
				onConnectStart: undefined,
				onDisconnect: undefined,
				onConnectSuccess: undefined,
				onConnectCanceled: undefined,
				uri: 'Editor Uri'
			},
			runQueryOnCompletion: RunQueryOnConnectionMode.executeQuery,
			providers: ['MSSQL']
		};
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server' };
		mockConnectionManagementService.setup(x => x.getUniqueConnectionProvidersByNameMap(TypeMoq.It.isAny())).returns(() => {
			return getUniqueConnectionProvidersByNameMap(providerNameToDisplayMap);
		});
		connectionDialogWidget.newConnectionParams = params;
		assert.strictEqual(connectionDialogWidget.newConnectionParams, params);
	});

	test('open should call onInitDialog', async () => {
		let params: INewConnectionParams = {
			connectionType: ConnectionType.editor,
			input: {
				onConnectReject: undefined,
				onConnectStart: undefined,
				onDisconnect: undefined,
				onConnectSuccess: undefined,
				onConnectCanceled: undefined,
				uri: 'Editor Uri'
			},
			runQueryOnCompletion: RunQueryOnConnectionMode.executeQuery,
			providers: ['MSSQL']
		};
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server' };
		mockConnectionManagementService.setup(x => x.getUniqueConnectionProvidersByNameMap(TypeMoq.It.isAny())).returns(() => {
			return getUniqueConnectionProvidersByNameMap(providerNameToDisplayMap);
		});
		//params must be assigned to get load providers
		connectionDialogWidget.newConnectionParams = params;
		let mockConnectionProfile = createConnectionProfile('test_id', '');
		mockConnectionManagementService.setup(x => x.getRecentConnections(TypeMoq.It.isValue(params.providers))).returns(() => {
			return [mockConnectionProfile];
		});
		let called = false;
		connectionDialogWidget.onInitDialog(() => {
			called = true;
		});
		await connectionDialogWidget.open(true);
		assert(called);
		called = false;
		await connectionDialogWidget.open(false);
		assert(called);
	});

	test('get set tests for connectButtonState and databaseDropdownExpanded', () => {
		connectionDialogWidget.connectButtonState = true;
		assert(connectionDialogWidget.connectButtonState);
		connectionDialogWidget.databaseDropdownExpanded = true;
		assert(connectionDialogWidget.databaseDropdownExpanded);
	});

	test('close/resetConnection should fire onRecentConnect', () => {
		let called = false;
		connectionDialogWidget.onResetConnection(() => {
			called = true;
		});
		connectionDialogWidget.close();
		assert(called);
	});

	test('updateProvider should call onShowUiComponent and onInitDialog', () => {
		let returnedDisplayName: string;
		let returnedContainer: HTMLElement;
		let called = false;
		connectionDialogWidget.onInitDialog(() => {
			called = true;
		});
		connectionDialogWidget.onShowUiComponent(e => {
			returnedDisplayName = e.selectedProviderDisplayName;
			returnedContainer = e.container;
		});
		let providerDisplayName = 'Mock SQL Server';
		connectionDialogWidget.updateProvider(providerDisplayName);
		assert.strictEqual(returnedDisplayName, providerDisplayName);
		assert.strictEqual(returnedContainer.className, 'connection-provider-info');
		assert(called);
	});
});

// Copy of function in connectionManagementService.
export function getUniqueConnectionProvidersByNameMap(providerNameToDisplayNameMap: { [providerDisplayName: string]: string }): { [providerDisplayName: string]: string } {
	let uniqueProvidersMap = {};
	let providerNames = entries(providerNameToDisplayNameMap);
	providerNames.forEach(p => {
		// Only add CMS provider if explicitly called from CMS extension
		// otherwise avoid duplicate listing in dropdown
		if (p[0] !== Constants.cmsProviderName) {
			uniqueProvidersMap[p[0]] = p[1];
		} else {
			if (providerNames.length === 1) {
				uniqueProvidersMap[p[0]] = p[1];
			}
		}
	});

	return uniqueProvidersMap;
}
