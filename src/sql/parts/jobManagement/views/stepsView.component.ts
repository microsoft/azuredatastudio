/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./stepsView';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnChanges, ViewChild, Input, Injectable } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IJobManagementService } from '../common/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { AgentJobHistoryInfo } from 'sqlops';
import { StepsViewController, StepsViewDataSource, StepsViewFilter, StepsViewRenderer, StepsViewRow, StepsViewModel} from 'sql/parts/jobManagement/views/stepsViewTree';

export const DASHBOARD_SELECTOR: string = 'stepsview-component';

@Component({
	selector: DASHBOARD_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./stepsView.component.html'))
})
export class StepsViewComponent extends Disposable implements OnInit, OnChanges {

	private _jobManagementService: IJobManagementService;
	private _tree: Tree;
	private _treeController = new StepsViewController();
	private _treeDataSource = new StepsViewDataSource();
	private _treeRenderer = new StepsViewRenderer();
	private _treeFilter =  new StepsViewFilter();

	@ViewChild('table') private _tableContainer: ElementRef;

	@Input() public stepRows: StepsViewRow[] = [];

	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => DashboardServiceInterface)) private _dashboardService: DashboardServiceInterface
	) {
		super();
		this._jobManagementService = bootstrapService.jobManagementService;
	}

	ngOnInit() {
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		const self = this;
		this._tree = new Tree(this._tableContainer.nativeElement, {
			controller: this._treeController,
			dataSource: this._treeDataSource,
			filter: this._treeFilter,
			renderer: this._treeRenderer
		});
	}

	ngOnChanges() {
		if (this.stepRows.length > 0) {
			this._treeDataSource.data = this.stepRows;
			if (!this._tree) {
				this._tree = new Tree(this._tableContainer.nativeElement, {
					controller: this._treeController,
					dataSource: this._treeDataSource,
					filter: this._treeFilter,
					renderer: this._treeRenderer
				});
			}
			this._tree.layout(1024);
			this._tree.setInput(new StepsViewModel());
		}
	}

	ngAfterContentChecked() {
	}
}

