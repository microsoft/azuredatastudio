/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import * as DOM from 'vs/base/browser/dom';
import * as Constants from 'sql/platform/connection/common/constants';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { NullLogService } from 'vs/platform/log/common/log';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { TestConnectionDialogWidget } from 'sql/workbench/services/connection/test/browser/testConnectionDialogWidget';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { entries } from 'sql/base/common/collections';
import { TestLayoutService } from 'vs/workbench/test/browser/workbenchTestServices';
import { INewConnectionParams, ConnectionType, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';


suite('ConnectionDialogWidget tests', () => {
	let connectionDialogWidget: TestConnectionDialogWidget;
	let mockConnectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	let cmInstantiationService: TestInstantiationService;
	let element: HTMLElement;
	setup(() => {
		cmInstantiationService = new TestInstantiationService();
		cmInstantiationService.stub(IStorageService, new TestStorageService());
		mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict,
			undefined, // connection store
			undefined, // connection status manager
			undefined, // connection dialog service
			cmInstantiationService, // instantiation service
			undefined, // editor service
			undefined, // telemetry service
			undefined, // configuration service
			new TestCapabilitiesService());
		let providerDisplayNames = ['Mock SQL Server'];
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server' };
		connectionDialogWidget = new TestConnectionDialogWidget(providerDisplayNames, providerNameToDisplayMap['MSSQL'], providerNameToDisplayMap, cmInstantiationService, mockConnectionManagementService.object, new TestThemeService(), new TestLayoutService(), undefined, new MockContextKeyService(), undefined, undefined, undefined, new NullLogService(), undefined);
		element = DOM.createStyleSheet();
		connectionDialogWidget.renderBody(element);
	});

	test('renderBody should have attached a connection dialog body onto element', () => {
		assert.equal(element.childElementCount, 1);
		assert.equal(element.children[0].className, 'connection-dialog');
	});

	test('updateConnectionProviders should update connection providers', () => {
		let providerDisplayNames = ['Mock SQL Server', 'Mock SQL Server 1'];
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server', 'PGSQL': 'Mock SQL Server 1' };
		mockConnectionManagementService.setup(x => x.getUniqueConnectionProvidersByNameMap(TypeMoq.It.isAny())).returns(() => {
			return getUniqueConnectionProvidersByNameMap(providerNameToDisplayMap);
		});
		connectionDialogWidget.updateConnectionProviders(providerDisplayNames, providerNameToDisplayMap);
		assert.equal(connectionDialogWidget.getDisplayNameFromProviderName('PGSQL'), providerNameToDisplayMap['PGSQL']);
	});

	test('render should create connect button and call onInitDialog', () => {
		let called = false;
		connectionDialogWidget.onInitDialog(e => {
			called = true;
		});
		connectionDialogWidget.render();
		assert(called);
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
		assert.equal(connectionDialogWidget.newConnectionParams, params);
	});
});

// Copy of function in connectionManagementService.
function getUniqueConnectionProvidersByNameMap(providerNameToDisplayNameMap: { [providerDisplayName: string]: string }): { [providerDisplayName: string]: string } {
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
