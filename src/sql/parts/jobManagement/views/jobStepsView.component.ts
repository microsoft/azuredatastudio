/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./jobStepsView';

import { OnInit, Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, Injectable, AfterContentChecked } from '@angular/core';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { JobStepsViewController, JobStepsViewDataSource, JobStepsViewFilter,
	JobStepsViewRenderer, JobStepsViewModel} from 'sql/parts/jobManagement/views/jobStepsViewTree';
import { JobHistoryComponent } from 'sql/parts/jobManagement/views/jobHistory.component';
import { JobManagementView } from 'sql/parts/jobManagement/views/jobManagementView';
import { IDashboardService } from 'sql/services/dashboard/common/dashboardService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';

export const JOBSTEPSVIEW_SELECTOR: string = 'jobstepsview-component';

@Component({
	selector: JOBSTEPSVIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./jobStepsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => JobStepsViewComponent) }],
})
export class JobStepsViewComponent extends JobManagementView  implements OnInit, AfterContentChecked {

	private _tree: Tree;
	private _treeController = new JobStepsViewController();
	private _treeDataSource = new JobStepsViewDataSource();
	private _treeRenderer = new JobStepsViewRenderer();
	private _treeFilter =  new JobStepsViewFilter();

	private static readonly INITIAL_TREE_HEIGHT: number = 760;
	private static readonly ROW_SIZE = 22;

	@ViewChild('table') private _tableContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(forwardRef(() => JobHistoryComponent)) private _jobHistoryComponent: JobHistoryComponent,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) instantiationService: IInstantiationService,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService)  keybindingService: IKeybindingService,
		@Inject(IDashboardService) dashboardService: IDashboardService
	) {
		super(commonService, dashboardService, contextMenuService, keybindingService, instantiationService);
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
				}, { verticalScrollMode: ScrollbarVisibility.Visible, horizontalScrollMode: ScrollbarVisibility.Visible });
				this._register(attachListStyler(this._tree, this.themeService));
			}
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
		}, {verticalScrollMode: ScrollbarVisibility.Visible});
		this._register(attachListStyler(this._tree, this.themeService));
	}

	public onFirstVisible() {
	}

	public layout() {
		let historyDetails = $('.overview-container').get(0);
		let statusBar = $('.part.statusbar').get(0);
		if (historyDetails && statusBar) {
			let historyBottom = historyDetails.getBoundingClientRect().bottom;
			let statusTop = statusBar.getBoundingClientRect().top;
			let height: number = Math.min(statusTop - historyBottom, JobStepsViewComponent.INITIAL_TREE_HEIGHT);
			let width: number = $('.step-columns').get(0).clientWidth;
			if (this._tree) {
				this._tree.layout(height, width);
				this._tree.setInput(new JobStepsViewModel());
				this._tableContainer.nativeElement.style.height = height - JobStepsViewComponent.ROW_SIZE + 'px';
			}
		}
	}
}
