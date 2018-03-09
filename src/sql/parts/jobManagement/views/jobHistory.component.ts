/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./jobHistory';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import { PanelComponent } from 'sql/base/browser/ui/panel/panel.component';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IJobManagementService } from '../common/interfaces';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { ExplorerDataSource } from 'sql/parts/dashboard/widgets/explorer/explorerTree';
import { TreeCreationUtils } from 'sql/parts/registeredServer/viewlet/treeCreationUtils';
import { ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
// import { JobHistoryController, JobHistoryDataSource,
// 	JobHistoryRenderer, JobHistoryFilter } from 'sql/parts/agent/views/jobHistoryTree';

export const DASHBOARD_SELECTOR: string = 'jobhistory-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobHistory.component.html'))
})
export class JobHistoryComponent implements OnInit, OnDestroy {

	private _jobManagementService: IJobManagementService;
	private _tree: Tree;

	// private _treeController: JobHistoryController;
	// private _treeDataSource: JobHistoryDataSource;
	// private _treeRenderer: JobHistoryRenderer;
	// private _treeFilter: JobHistoryFilter;

	@ViewChild('table') private _tableContainer: ElementRef;

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => ChangeDetectorRef)) _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IThemeService private _themeService: IThemeService,
	) {
		this._jobManagementService = bootstrapService.jobManagementService;
		// this._tree = new Tree(this._tableContainer.nativeElement, {
		// 	controller: this._treeController,
		// 	dataSource: this._treeDataSource,
		// 	filter: this._treeFilter,
		// 	renderer: this._treeRenderer
		// });
	}

	ngOnInit() {
	}

	ngOnDestroy() {
	}

	private toggleCollapse(): void {
		let arrow: HTMLElement = $('.resultsViewCollapsible').get(0);
		let checkbox: any = document.getElementById('accordion');
		if (arrow.className === 'resultsViewCollapsible' && checkbox.checked === false) {
			arrow.className = 'resultsViewCollapsible collapsed';
		} else if (arrow.className === 'resultsViewCollapsible collapsed' && checkbox.checked === true) {
			arrow.className = 'resultsViewCollapsible';
		}
	}

}

