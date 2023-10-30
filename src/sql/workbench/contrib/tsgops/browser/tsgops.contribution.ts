/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ICommandService } from 'vs/platform/commands/common/commands';
import { Registry } from 'vs/platform/registry/common/platform';
import { HideActivityBarViewContainers, HideSettings, HidePanel } from 'sql/workbench/contrib/tsgops/browser/tsgopsActions';
import { IWorkbenchContribution, Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import product from 'vs/platform/product/common/product';
import { TSGOPS_WEB_QUALITY } from 'sql/workbench/common/constants';
import { registerAction2 } from 'vs/platform/actions/common/actions';

export class ADSWebLite implements IWorkbenchContribution {
	constructor(
		@ICommandService private commandService: ICommandService,
	) {
		void this.createTSGOpsImage();
	}

	private async createTSGOpsImage(): Promise<void> {
		await this.commandService.executeCommand('workbench.action.hideSettings');
		await this.commandService.executeCommand('workbench.action.hidePanel');
		await this.commandService.executeCommand('workbench.action.hideActivityBarViewContainers');
	}
}

if (product.quality === TSGOPS_WEB_QUALITY) {
	// Global Actions
	registerAction2(HideActivityBarViewContainers);

	registerAction2(HideSettings);

	registerAction2(HidePanel);

	Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
		.registerWorkbenchContribution(ADSWebLite, LifecyclePhase.Restored);
}
