/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IExtensionsWorkbenchService, VIEWLET_ID, IExtensionsViewlet } from 'vs/workbench/contrib/extensions/common/extensions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionRecommendation, IExtensionManagementServerService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { CancellationToken } from 'vs/base/common/cancellation';
import { PagedModel } from 'vs/base/common/paging';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

function getScenarioID(scenarioType: string) {
	return 'workbench.extensions.action.show' + scenarioType;
}

export class ShowRecommendedExtensionsByScenarioAction extends Action {
	constructor(
		private readonly scenarioType: string,
		@IViewletService private readonly viewletService: IViewletService
	) {
		super(getScenarioID(scenarioType), localize('showRecommendations', "Show Recommendations"), undefined, true);
	}

	run(): Promise<void> {
		return this.viewletService.openViewlet(VIEWLET_ID, true)
			.then(viewlet => viewlet as IExtensionsViewlet)
			.then(viewlet => {
				viewlet.search('@' + this.scenarioType);
				viewlet.focus();
			});
	}
}

export class InstallRecommendedExtensionsByScenarioAction extends Action {
	private _recommendations: IExtensionRecommendation[] = [];
	get recommendations(): IExtensionRecommendation[] { return this._recommendations; }
	set recommendations(recommendations: IExtensionRecommendation[]) { this._recommendations = recommendations; this.enabled = this._recommendations.length > 0; }

	constructor(
		private readonly scenarioType: string,
		recommendations: IExtensionRecommendation[],
		@IViewletService private readonly viewletService: IViewletService,
		@INotificationService private readonly notificationService: INotificationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IExtensionsWorkbenchService private readonly extensionWorkbenchService: IExtensionsWorkbenchService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IExtensionManagementServerService private readonly extensionManagementServerService: IExtensionManagementServerService
	) {
		super(getScenarioID(scenarioType), localize('Install Extensions', "Install Extensions"), 'extension-action');
		this.recommendations = recommendations;
	}

	run(): Promise<any> {
		if (!this.recommendations.length) { return Promise.resolve(); }
		return this.viewletService.openViewlet(VIEWLET_ID, true)
			.then(viewlet => viewlet as IExtensionsViewlet)
			.then(viewlet => {
				viewlet.search('@' + this.scenarioType);
				viewlet.focus();
				const names = this.recommendations.map(({ extensionId }) => extensionId);
				return this.extensionWorkbenchService.queryGallery({ names, source: 'install-' + this.scenarioType }, CancellationToken.None).then(pager => {
					let installPromises: Promise<any>[] = [];
					let model = new PagedModel(pager);
					for (let i = 0; i < pager.total; i++) {
						installPromises.push(model.resolve(i, CancellationToken.None).then(e => this.extensionWorkbenchService.install(e)));
					}
					return Promise.all(installPromises);
				});
			});
	}
}
