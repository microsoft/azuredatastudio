/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

// --- SQL contributions
import 'sql/workbench/api/browser/mainThreadConnectionManagement';
import 'sql/workbench/api/browser/mainThreadCredentialManagement';
import 'sql/workbench/api/browser/mainThreadDataProtocol';
import 'sql/workbench/api/browser/mainThreadObjectExplorer';
import 'sql/workbench/api/browser/mainThreadBackgroundTaskManagement';
import 'sql/workbench/api/browser/mainThreadSerializationProvider';
import 'sql/workbench/api/browser/mainThreadResourceProvider';
import 'sql/workbench/api/browser/mainThreadTasks';
import 'sql/workbench/api/browser/mainThreadDashboard';
import 'sql/workbench/api/browser/mainThreadDashboardWebview';
import 'sql/workbench/api/browser/mainThreadQueryEditor';
import 'sql/workbench/api/browser/mainThreadModelView';
import 'sql/workbench/api/electron-browser/mainThreadModelViewDialog';
import 'sql/workbench/api/browser/mainThreadNotebook';
import 'sql/workbench/api/browser/mainThreadNotebookDocumentsAndEditors';
import 'sql/workbench/api/browser/mainThreadAccountManagement';
import 'sql/workbench/api/browser/mainThreadExtensionManagement';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';

export class SqlExtHostContribution implements IWorkbenchContribution {

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
	}

	public getId(): string {
		return 'sql.api.sqlExtHost';
	}
}

// Register File Tracker
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	SqlExtHostContribution,
	LifecyclePhase.Restored
);
