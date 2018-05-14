/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./jobStepsView';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, Injectable, AfterContentChecked } from '@angular/core';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { IJobManagementService } from '../common/interfaces';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AgentJobHistoryInfo } from 'sqlops';
import { JobStepsViewController, JobStepsViewDataSource, JobStepsViewFilter,
	JobStepsViewRenderer, JobStepsViewRow, JobStepsViewModel} from 'sql/parts/jobManagement/views/jobStepsViewTree';
import { JobHistoryComponent } from 'sql/parts/jobManagement/views/jobHistory.component';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';

export const JOBSTEPSVIEW_SELECTOR: string = 'jobstepsview-component';

@Component({
	selector: JOBSTEPSVIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobStepsView.component.html'))
})
export class JobStepsViewComponent extends Disposable implements OnInit, AfterContentChecked {

	private _jobManagementService: IJobManagementService;
	private _tree: Tree;
	private _treeController = new JobStepsViewController();
	private _treeDataSource = new JobStepsViewDataSource();
	private _treeRenderer = new JobStepsViewRenderer();
	private _treeFilter =  new JobStepsViewFilter();
	private static _pageSize = 1024;

	@ViewChild('table') private _tableContainer: ElementRef;


	constructor(
		@Inject(BOOTSTRAP_SERVICE_ID) private bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) private _dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => JobHistoryComponent)) private _jobHistoryComponent: JobHistoryComponent
	) {
		super();
		this._jobManagementService = bootstrapService.jobManagementService;
	}

	ngAfterContentChecked() {
		if (this._jobHistoryComponent.stepRows.length > 0) {
			this._treeDataSource.data = this._jobHistoryComponent.stepRows;
			if (!this._tree) {
				this._tree = new Tree(this._tableContainer.nativeElement, {
					controller: this._treeController,
					dataSource: this._treeDataSource,
					filter: this._treeFilter,
					renderer: this._treeRenderer
				}, { verticalScrollMode: ScrollbarVisibility.Visible });
				this._register(attachListStyler(this._tree, this.bootstrapService.themeService));
			}
			this._tree.layout(JobStepsViewComponent._pageSize);
			this._tree.setInput(new JobStepsViewModel());
			$('jobstepsview-component .steps-tree .monaco-tree').attr('tabIndex', '-1');
			$('jobstepsview-component .steps-tree .monaco-tree-row').attr('tabIndex', '0');
		}
	}

	ngOnInit() {
		let ownerUri: string = this._dashboardService.connectionManagementService.connectionInfo.ownerUri;
		this._tree = new Tree(this._tableContainer.nativeElement, {
			controller: this._treeController,
			dataSource: this._treeDataSource,
			filter: this._treeFilter,
			renderer: this._treeRenderer
		}, {verticalScrollMode: ScrollbarVisibility.Visible});
		this._register(attachListStyler(this._tree, this.bootstrapService.themeService));
	}
}

