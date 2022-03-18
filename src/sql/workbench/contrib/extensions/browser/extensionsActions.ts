/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IExtensionsWorkbenchService, VIEWLET_ID, IExtensionsViewPaneContainer } from 'vs/workbench/contrib/extensions/common/extensions';
import { IExtensionRecommendation } from 'sql/workbench/services/extensionManagement/common/extensionManagement';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { URI } from 'vs/base/common/uri';
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

	override run(): Promise<void> {
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

	override async run(): Promise<void> {
		if (!this.recommendations.length) { return; }
		const viewlet = await this.viewletService.openViewlet(VIEWLET_ID, true);
		const viewPaneContainer = viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer;
		viewPaneContainer.search('@' + this.scenarioType);
		viewlet.focus();
		const names = this.recommendations.map(({ extensionId }) => extensionId);
		const pager = await this.extensionWorkbenchService.queryGallery({ names, source: 'install-' + this.scenarioType }, CancellationToken.None);
		let installPromises: Promise<any>[] = [];
		let model = new PagedModel(pager);
		for (let i = 0; i < pager.total; i++) {
			installPromises.push(model.resolve(i, CancellationToken.None).then(e => this.extensionWorkbenchService.install(e)));
		}
		await Promise.all(installPromises);
	}
}

export class OpenExtensionAuthoringDocsAction extends Action {

	static readonly ID = 'workbench.extensions.action.openExtensionAuthoringDocs';
	static readonly LABEL = localize('openExtensionAuthoringDocs', "Author an Extension...");
	private static readonly extensionAuthoringDocsURI = 'https://docs.microsoft.com/sql/azure-data-studio/extension-authoring';

	constructor(
		id: string = OpenExtensionAuthoringDocsAction.ID,
		label: string = OpenExtensionAuthoringDocsAction.LABEL,
		@IOpenerService private readonly openerService: IOpenerService,
	) {
		super(id, label);
	}

	override async run(): Promise<void> {
		await this.openerService.open(URI.parse(OpenExtensionAuthoringDocsAction.extensionAuthoringDocsURI));
	}
}
