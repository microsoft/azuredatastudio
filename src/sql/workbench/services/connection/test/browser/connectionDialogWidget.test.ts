/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionDialogWidget } from 'sql/workbench/services/connection/browser/connectionDialogWidget';
import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { ConnectionManagementService } from 'sql/workbench/services/connection/browser/connectionManagementService';
import { TestCapabilitiesService } from 'sql/platform/capabilities/test/common/testCapabilitiesService';
import { NullLogService } from 'vs/platform/log/common/log';

suite('ConnectionDialogWidget tests', () => {
	let connectionDialogWidget: ConnectionDialogWidget;
	let mockConnectionManagementService: TypeMoq.Mock<ConnectionManagementService>;
	setup(() => {
		let testinstantiationService = new TestInstantiationService();
		testinstantiationService.stub(IStorageService, new TestStorageService());
		mockConnectionManagementService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Strict,
			undefined, // connection store
			undefined, // connection status manager
			undefined, // connection dialog service
			testinstantiationService, // instantiation service
			undefined, // editor service
			undefined, // telemetry service
			undefined, // configuration service
			new TestCapabilitiesService());
		let providerDisplayNames = ['Mock SQL Server'];
		let providerNameToDisplayMap = { 'MSSQL': 'Mock SQL Server' };
		connectionDialogWidget = new ConnectionDialogWidget(providerDisplayNames, providerNameToDisplayMap['MSSQL'], providerNameToDisplayMap, undefined, mockConnectionManagementService.object, undefined, undefined, undefined, undefined, undefined, undefined, undefined, new NullLogService(), undefined);
	});
});
