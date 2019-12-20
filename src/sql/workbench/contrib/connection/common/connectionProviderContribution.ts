/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IFileService } from 'vs/platform/files/common/files';
import { ConnectionSystemProvider } from 'sql/workbench/contrib/connection/common/connectionSystemProvider';

class ConnectionProviderContribution implements IWorkbenchContribution {
	constructor(@IInstantiationService instantiationService: IInstantiationService, @IFileService fileService: IFileService) {
		fileService.registerProvider(ConnectionSystemProvider.SCHEME, instantiationService.createInstance(ConnectionSystemProvider));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ConnectionProviderContribution, LifecyclePhase.Ready);
