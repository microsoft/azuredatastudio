/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import * as DOM from 'vs/base/browser/dom';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { NullLogService } from 'vs/platform/log/common/log';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { TestConnectionDialogWidget } from 'sql/workbench/services/connection/test/browser/testConnectionDialogWidget';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';

suite('ConnectionDialogWidget tests', () => {
	let connectionDialogWidget: TestConnectionDialogWidget;
	let mockConnectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	let cmInstantiationService: TestInstantiationService;
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
		connectionDialogWidget = new TestConnectionDialogWidget(providerDisplayNames, providerNameToDisplayMap['MSSQL'], providerNameToDisplayMap, cmInstantiationService, mockConnectionManagementService.object, new TestThemeService(), undefined, undefined, new MockContextKeyService(), undefined, undefined, undefined, new NullLogService(), undefined);
	});

	test('renderBody should attach a connection dialog body onto element', () => {
		let element = DOM.createStyleSheet();
		connectionDialogWidget.renderBody(element);
		assert.equal(element.childElementCount, 1);
		assert.equal(element.children[0].className, 'connection-dialog');
	});
});
