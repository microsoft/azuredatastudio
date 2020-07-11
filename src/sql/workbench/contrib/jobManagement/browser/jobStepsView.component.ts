/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/jobStepsView';
import * as nls from 'vs/nls';
import * as dom from 'vs/base/browser/dom';
import { OnInit, Component, Inject, forwardRef, ElementRef, ViewChild, AfterContentChecked } from '@angular/core';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import {
	JobStepsViewController, JobStepsViewDataSource, JobStepsViewFilter,
	JobStepsViewRenderer, JobStepsViewModel, JobStepsViewRow
} from 'sql/workbench/contrib/jobManagement/browser/jobStepsViewTree';
import { JobHistoryComponent } from 'sql/workbench/contrib/jobManagement/browser/jobHistory.component';
import { JobManagementView } from 'sql/workbench/contrib/jobManagement/browser/jobManagementView';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IJobManagementService } from 'sql/workbench/services/jobManagement/common/interfaces';

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
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(forwardRef(() => JobHistoryComponent)) private _jobHistoryComponent: JobHistoryComponent,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) instantiationService: IInstantiationService,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService) keybindingService: IKeybindingService,
		@Inject(IDashboardService) dashboardService: IDashboardService,
		@Inject(ITelemetryService) private _telemetryService: ITelemetryService
	) {
		super(commonService, dashboardService, contextMenuService, keybindingService, instantiationService, undefined);
	}

	ngAfterContentChecked() {
		jQuery('.steps-tree .step-column-heading').closest('.monaco-tree-row').addClass('step-column-row');
		this.layout();
		this._tree.onDidScroll(() => {
			jQuery('.steps-tree .step-column-heading').closest('.monaco-tree-row').addClass('step-column-row');
		});
		this._treeController.onClick = (tree, element, event, origin = 'mouse') => {
			const payload = { origin: origin };
			const isDoubleClick = (origin === 'mouse' && event.detail === 2);
			// Cancel Event
			const isMouseDown = event && event.browserEvent && event.browserEvent.type === 'mousedown';
			if (!isMouseDown) {
				event.preventDefault(); // we cannot preventDefault onMouseDown because this would break DND otherwise
			}
			event.stopPropagation();
			tree.setFocus(element, payload);
			if (element && isDoubleClick) {
				event.preventDefault(); // focus moves to editor, we need to prevent default
			} else {
				tree.setFocus(element, payload);
				tree.setSelection([element], payload);
			}
			jQuery('.steps-tree .step-column-heading').closest('.monaco-tree-row').addClass('step-column-row');
			return true;
		};
		this._treeController.onKeyDown = (tree, event) => {
			this._treeController.onKeyDownWrapper(tree, event);
			jQuery('.steps-tree .step-column-heading').closest('.monaco-tree-row').addClass('step-column-row');
			return true;
		};
		this._tree.onDidFocus(() => {
			this._tree.focusNth(1);
			let element = this._tree.getFocus();
			this._tree.select(element);
		});
		this._tree.setInput(new JobStepsViewModel());
	}

	ngOnInit() {
		this._treeDataSource.data = this._jobHistoryComponent.stepRows;
		this._tree = new Tree(this._tableContainer.nativeElement, {
			controller: this._treeController,
			dataSource: this._treeDataSource,
			filter: this._treeFilter,
			renderer: this._treeRenderer
		}, { verticalScrollMode: ScrollbarVisibility.Visible, horizontalScrollMode: ScrollbarVisibility.Visible });
		this._register(attachListStyler(this._tree, this.themeService));
		const stepsTooltip = nls.localize('agent.steps', "Steps");
		jQuery('.steps-header > .steps-icon').attr('title', stepsTooltip);
		this._jobManagementService.stepsChanged(async (data: JobStepsViewRow[]) => {
			this._treeDataSource.data = data;
			await this._tree.refresh();
		});
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
