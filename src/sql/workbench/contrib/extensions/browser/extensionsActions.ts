/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { IExtensionsWorkbenchService, VIEWLET_ID, IExtensionsViewPaneContainer } from 'vs/workbench/contrib/extensions/common/extensions';
import { IExtensionRecommendation } from 'sql/workbench/services/extensionManagement/common/extensionManagement';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { URI } from 'vs/base/common/uri';
import { CancellationToken } from 'vs/base/common/cancellation';
import { PagedModel } from 'vs/base/common/paging';
import { IPaneCompositePartService } from 'vs/workbench/services/panecomposite/browser/panecomposite';
import { ViewContainerLocation } from 'vs/workbench/common/views';
import { Action2 } from 'vs/platform/actions/common/actions';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';

function getScenarioID(scenarioType: string) {
	return 'workbench.extensions.action.show' + scenarioType;
}

export class ShowRecommendedExtensionsByScenarioAction extends Action {
	constructor(
		private readonly scenarioType: string,
		@IPaneCompositePartService private readonly viewletService: IPaneCompositePartService
	) {
		super(getScenarioID(scenarioType), localize('showRecommendations', "Show Recommendations"), undefined, true);
	}

	override run(): Promise<void> {
		return this.viewletService.openPaneComposite(VIEWLET_ID, ViewContainerLocation.Sidebar, true)
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
		@IPaneCompositePartService private readonly viewletService: IPaneCompositePartService,
		@IExtensionsWorkbenchService private readonly extensionWorkbenchService: IExtensionsWorkbenchService
	) {
		super(getScenarioID(scenarioType), localize('Install Extensions', "Install Extensions"), 'extension-action');
		this.recommendations = recommendations;
	}

	override async run(): Promise<void> {
		if (!this.recommendations.length) { return; }
		const viewlet = await this.viewletService.openPaneComposite(VIEWLET_ID, ViewContainerLocation.Sidebar, true);
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

export class OpenExtensionAuthoringDocsAction extends Action2 {

	static readonly ID = 'workbench.extensions.action.openExtensionAuthoringDocs';
	static readonly LABEL_ORG = "Author an Extension...";
	static readonly LABEL = localize('openExtensionAuthoringDocs', "Author an Extension...");
	private static readonly extensionAuthoringDocsURI = 'https://docs.microsoft.com/sql/azure-data-studio/extension-authoring';

	constructor() {
		super({
			id: OpenExtensionAuthoringDocsAction.ID,
			title: { value: OpenExtensionAuthoringDocsAction.LABEL, original: OpenExtensionAuthoringDocsAction.LABEL_ORG },
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const openerService = accessor.get(IOpenerService);
		await openerService.open(URI.parse(OpenExtensionAuthoringDocsAction.extensionAuthoringDocsURI));
	}
}
