/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./jobStepsView';

import * as dom from 'vs/base/browser/dom';
import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, Injectable, AfterContentChecked } from '@angular/core';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import {
	JobStepsViewController, JobStepsViewDataSource, JobStepsViewFilter,
	JobStepsViewRenderer, JobStepsViewModel
} from 'sql/parts/jobManagement/views/jobStepsViewTree';
import { JobHistoryComponent } from 'sql/parts/jobManagement/views/jobHistory.component';
import { JobManagementView } from 'sql/parts/jobManagement/views/jobManagementView';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/common/telemetryKeys';

export const JOBSTEPSVIEW_SELECTOR: string = 'jobstepsview-component';

@Component({
	selector: JOBSTEPSVIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobStepsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => JobStepsViewComponent) }],
})
export class JobStepsViewComponent extends JobManagementView implements OnInit, AfterContentChecked {

	private _tree: Tree;
	private _treeController = new JobStepsViewController();
	private _treeDataSource = new JobStepsViewDataSource();
	private _treeRenderer = new JobStepsViewRenderer();
	private _treeFilter = new JobStepsViewFilter();

	@ViewChild('table') private _tableContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(forwardRef(() => JobHistoryComponent)) private _jobHistoryComponent: JobHistoryComponent,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) instantiationService: IInstantiationService,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService,
		@Inject(IDashboardService) dashboardService: IDashboardService,
		@Inject(ITelemetryService) private _telemetryService: ITelemetryService
	) {
		super(commonService, dashboardService, contextMenuService, keybindingService, instantiationService);
	}

	ngAfterContentChecked() {
		if (this._jobHistoryComponent.stepRows.length > 0) {
			this._treeDataSource.data = this._jobHistoryComponent.stepRows;
			this._tree.setInput(new JobStepsViewModel());
			this.layout();
			$('jobstepsview-component .steps-tree .monaco-tree').attr('tabIndex', '-1');
			$('jobstepsview-component .steps-tree .monaco-tree-row').attr('tabIndex', '0');
		}
	}

	ngOnInit() {
		this._tree = new Tree(this._tableContainer.nativeElement, {
			controller: this._treeController,
			dataSource: this._treeDataSource,
			filter: this._treeFilter,
			renderer: this._treeRenderer
		}, { verticalScrollMode: ScrollbarVisibility.Visible, horizontalScrollMode: ScrollbarVisibility.Visible });
		this.layout();
		this._register(attachListStyler(this._tree, this.themeService));
		this._telemetryService.publicLog(TelemetryKeys.JobStepsView);
	}

	public onFirstVisible() {
	}

	public layout() {
		if (this._tree) {
			let treeheight = dom.getContentHeight(this._tableContainer.nativeElement);
			this._tree.layout(treeheight);
		}
	}
}

