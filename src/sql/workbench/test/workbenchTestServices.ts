/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITestInstantiationService, workbenchInstantiationService as vsworkbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TestConnectionManagementService } from 'sql/platform/connection/test/common/testConnectionManagementService';
import { TestObjectExplorerService } from 'sql/workbench/services/objectExplorer/test/browser/testObjectExplorerService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';

export function workbenchInstantiationService(): ITestInstantiationService {
	const instantiationService = vsworkbenchInstantiationService();
	instantiationService.stub(IConnectionManagementService, new TestConnectionManagementService());
	instantiationService.stub(IObjectExplorerService, new TestObjectExplorerService());
	return instantiationService;
}
