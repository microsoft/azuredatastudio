/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor } from 'vs/workbench/browser/viewlet';
import { Registry } from 'vs/platform/registry/common/platform';
import { VIEWLET_ID } from 'sql/parts/dataExplorer/common/dataExplorerExtensionPoint';
import { DataExplorerViewlet, DataExplorerViewletViewsContribution } from 'sql/parts/dataExplorer/viewlet/dataExplorerViewlet';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';


// Data Explorer Viewlet
const viewletDescriptor = new ViewletDescriptor(
	DataExplorerViewlet,
	VIEWLET_ID,
	localize('workbench.dataExplorer', 'Data Explorer'),
	'dataExplorer',
	0
);

Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).registerViewlet(viewletDescriptor);
Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).setDefaultViewletId(VIEWLET_ID);

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(DataExplorerViewletViewsContribution, LifecyclePhase.Starting);