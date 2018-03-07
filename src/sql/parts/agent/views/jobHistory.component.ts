/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./jobHistory';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import { PanelComponent } from 'sql/base/browser/ui/panel/panel.component';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IAgentService } from '../common/interfaces';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { ExplorerDataSource } from 'sql/parts/dashboard/widgets/explorer/explorerTree';
import { TreeCreationUtils } from 'sql/parts/registeredServer/viewlet/treeCreationUtils';
import { Builder, $ } from 'vs/base/browser/builder';
import { ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { SavedConnectionTreeController } from 'sql/parts/connection/connectionDialog/savedConnectionTreeController';
import { render } from 'vs/base/browser/ui/octiconLabel/octiconLabel';

export const DASHBOARD_SELECTOR: string = 'jobHistory-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobHistory.component.html'))
})
export class JobHistoryComponent implements OnInit, OnDestroy {

	private _agentService: IAgentService;
	private _tree: Tree;
	private _treeDataSource = new ExplorerDataSource();
	private _prevRunsBuilder: Builder;

	@ViewChild('table') private _tableContainer: ElementRef;

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IThemeService private _themeService: IThemeService,
	) {
		this._agentService = bootstrapService.agentService;
	}

	ngOnInit() {
		//this.renderPreviousRuns();
	}

	ngOnDestroy() {
	}

	private renderPreviousRuns(): void {
		let prevRunContainer = $('.prev-runs');
		prevRunContainer.div({ class: 'prev-run-list'}, (divContainer: Builder) => {
			this._prevRunsBuilder = new Builder(divContainer.getHTMLElement());
			this._prevRunsBuilder.div({ class: 'explorer-servers' }, (treeContainer: Builder) => {
				let leftClick = (element: any, eventish: ICancelableEvent, origin: string) => {
					// element will be a server group if the tree is clicked rather than a item
					// if (element instanceof ConnectionProfile) {
					// 	this.onConnectionClick({ payload: { origin: origin, originalEvent: eventish } }, element);
					// }
				};
				//let actionProvider = this._instantiationService.createInstance(RecentConnectionActionsProvider);

				//let controller = new RecentConnectionTreeController(leftClick, actionProvider, this._connectionManagementService, this._contextMenuService);

				let controller = new SavedConnectionTreeController(leftClick);

				// actionProvider.onRecentConnectionRemoved(() => {
				// 	this.open(this._connectionManagementService.getRecentConnections().length > 0);
				// });
				// controller.onRecentConnectionRemoved(() => {
				// 	this.open(this._connectionManagementService.getRecentConnections().length > 0);
				// });
				this._tree = TreeCreationUtils.createConnectionTree(treeContainer.getHTMLElement(), this._instantiationService, controller);

				// Theme styler
				//this._register(styler.attachListStyler(this._tree, this._themeService));
				this._prevRunsBuilder.append(this._tree.getHTMLElement());
			});
		});
	}

}

