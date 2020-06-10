/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IExtensionsWorkbenchService, VIEWLET_ID, IExtensionsViewPaneContainer } from 'vs/workbench/contrib/extensions/common/extensions';
import { IExtensionRecommendation } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { CancellationToken } from 'vs/base/common/cancellation';
import { PagedModel } from 'vs/base/common/paging';

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
			.then(viewlet => viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer)
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
		@IExtensionsWorkbenchService private readonly extensionWorkbenchService: IExtensionsWorkbenchService
	) {
		super(getScenarioID(scenarioType), localize('Install Extensions', "Install Extensions"), 'extension-action');
		this.recommendations = recommendations;
	}

	run(): Promise<any> {
		if (!this.recommendations.length) { return Promise.resolve(); }
		return this.viewletService.openViewlet(VIEWLET_ID, true)
			.then(viewlet => viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer)
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
