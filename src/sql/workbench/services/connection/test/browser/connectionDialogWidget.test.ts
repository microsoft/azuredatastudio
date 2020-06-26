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
import { ClearRecentConnectionsAction } from 'sql/workbench/services/connection/browser/connectionActions';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { TestDialogService } from 'vs/platform/dialogs/test/common/testDialogService';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { RecentConnectionActionsProvider } from 'sql/workbench/services/connection/browser/recentConnectionTreeController';

suite('ConnectionDialogWidget tests', () => {
	let connectionDialogWidget: TestConnectionDialogWidget;
	let mockConnectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	let testInstantiationService: TypeMoq.Mock<InstantiationService>;
	setup(() => {
		testInstantiationService = TypeMoq.Mock.ofType(InstantiationService, TypeMoq.MockBehavior.Loose, new TestInstantiationService());
		mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict,
			undefined, // connection store
			undefined, // connection status manager
			undefined, // connection dialog service
			new TestInstantiationService(), // instantiation service
			undefined, // editor service
			undefined, // telemetry service
			undefined, // configuration service
			new TestCapabilitiesService(),
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			new NullLogService(),
			new TestStorageService());
		let providerDisplayNames = ['Mock SQL Server'];
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server' };
		connectionDialogWidget = new TestConnectionDialogWidget(providerDisplayNames, providerNameToDisplayMap['MSSQL'], providerNameToDisplayMap, testInstantiationService.object, mockConnectionManagementService.object, undefined, undefined, undefined, new MockContextKeyService(), undefined, undefined, undefined, new NullLogService(), undefined);
	});

	test('do something!', () => {
		let element = DOM.createStyleSheet();
		assert(true);
		testInstantiationService.setup(x => x.createInstance(ClearRecentConnectionsAction, ClearRecentConnectionsAction.ID, ClearRecentConnectionsAction.LABEL)).returns(() => {
			return new ClearRecentConnectionsAction(ClearRecentConnectionsAction.ID, ClearRecentConnectionsAction.LABEL, mockConnectionManagementService.object, new TestNotificationService(), undefined, new TestDialogService());
		});
		testInstantiationService.setup(x => x.createInstance(RecentConnectionActionsProvider)).returns(() => {
			return new RecentConnectionActionsProvider(new TestInstantiationService());
		});
		connectionDialogWidget.renderBody(element);
	});
});
