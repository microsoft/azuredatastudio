/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import * as DOM from 'vs/base/browser/dom';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { InfoBox } from 'sql/workbench/browser/ui/infoBox/infoBox';
import { ExecutionPlanComparisonPropertiesView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonPropertiesView';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { Action } from 'vs/base/common/actions';
import { addIconClassName, openPropertiesIconClassNames, zoomInIconClassNames, zoomOutIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { extname } from 'vs/base/common/path';
import { ExecutionPlanComparisonView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonView';
import { INotificationService } from 'vs/platform/notification/common/notification';

export class ExecutionPlanComparisonEditorView {

	public static LABEL: string = localize('compareExecutionPlanEditor', "Compare Execution Plan Editor");

	private _container: HTMLElement;

	private _planContainer: HTMLElement;

	private _toolbarContainer: HTMLElement;

	private _taskbar: Taskbar;

	private _placeholderContainer: HTMLElement;
	private _placeholderInfoBox: InfoBox;

	private _executionPlans: azdata.executionPlan.ExecutionPlanGraph[][] = [];
	private _plans: azdata.executionPlan.ExecutionPlanGraphInfo[] = [];
	private _planControls: ExecutionPlanComparisonView[] = [];

	private _propertiesContainer: HTMLElement;
	private _propertiesView: ExecutionPlanComparisonPropertiesView;

	private _addExecutionPlanAction: AddExecutionPlanAction;

	constructor(
		private _parentContainer: HTMLElement,
		@IExecutionPlanService public executionPlanService: IExecutionPlanService,
		@IFileDialogService public fileDialogService: IFileDialogService,
		@ITextFileService public textFileService: ITextFileService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IThemeService private _themeService: IThemeService,
		@INotificationService private _notificationService: INotificationService,
	) {
		// creating the parent container for the editor
		this._container = DOM.$('.compare-execution-plan-editor');
		this._parentContainer.appendChild(this._container);

		// creating and adding editor toolbar actions
		this._toolbarContainer = DOM.$('.editor-toolbar');
		this._taskbar = new Taskbar(this._toolbarContainer, {
			orientation: ActionsOrientation.HORIZONTAL
		});

		this._addExecutionPlanAction = new AddExecutionPlanAction();
		this._taskbar.context = this;
		const content: ITaskbarContent[] = [
			{ action: this._addExecutionPlanAction },
			{ action: new ZoomIn() },
			{ action: new ZoomOut() },
			{ action: new Properties() }
		];
		this._taskbar.setContent(content);
		this._container.appendChild(this._toolbarContainer);

		this._planContainer = DOM.$('.plan-container');

		this._placeholderContainer = DOM.$('.placeholder');
		this._placeholderInfoBox = this._instantiationService.createInstance(InfoBox, this._placeholderContainer, {
			style: 'information',
			text: ''
		});
		this._planContainer.appendChild(this._placeholderContainer);
		this.updatePlaceHolderContainer();

		const actualEditorContent = DOM.$('.actual-editor');
		this._container.appendChild(actualEditorContent);
		actualEditorContent.appendChild(this._planContainer);

		this._propertiesContainer = DOM.$('.properties');
		this._propertiesView = new ExecutionPlanComparisonPropertiesView(this._propertiesContainer, this._themeService);
		actualEditorContent.appendChild(this._propertiesContainer);
	}

	public show(): void {
		this._parentContainer.appendChild(this._container);
	}

	public hide(): void {
		this._parentContainer.removeChild(this._container);
	}


	private updatePlaceHolderContainer(): void {
		if (this._plans.length === 0) {
			this._placeholderContainer.style.visibility = 'visible';
			this._placeholderInfoBox.text = 'Add execution plans to compare';
		} else if (this._plans.length === 1) {
			this._placeholderContainer.style.visibility = 'visible';
			this._placeholderInfoBox.text = 'Add execution plans to compare';
		} else {
			this._placeholderContainer.style.display = 'none';
			this._addExecutionPlanAction.enabled = false;
		}
	}

	public async addExecutionPlan(plan: azdata.executionPlan.ExecutionPlanGraphInfo): Promise<void> {

		try {
			let executionPlanGraph = await this.executionPlanService.getExecutionPlan(plan);
			this._plans.push(plan);
			const planView = this._instantiationService.createInstance(ExecutionPlanComparisonView, this._planContainer, this._placeholderContainer);
			this._planControls.push(planView);
			this.updatePlaceHolderContainer();
			const l = this._plans.length;
			planView._onCellSelectedEvent(e => {
				if (l === 1) {
					this._propertiesView.setTopElement(e);
				} else {
					this._propertiesView.setBottomElement(e);
				}
			});
			this._executionPlans.push(executionPlanGraph.graphs);
			planView.addGraphs(executionPlanGraph.graphs);
		} catch (e) {
			this._notificationService.error(e);
		}
	}

	public togglePropertiesView() {
		if (this._propertiesContainer.style.display === 'none') {
			this._propertiesContainer.style.display = '';

		} else {
			this._propertiesContainer.style.display = 'none';

		}

	}

	public zoomIn() {
		this._planControls.forEach(pc => {
			pc.azdataGraphDiagram.forEach(d => {
				d.zoomIn();
			});
		});
	}
	public zoomOut() {
		this._planControls.forEach(pc => {
			pc.azdataGraphDiagram.forEach(d => {
				d.zoomOut();
			});
		});
	}

	public zoomToFit() {
		this._planControls.forEach(pc => {
			pc.azdataGraphDiagram.forEach(d => {
				d.zoomToFit();
			});
		});
	}
}

class AddExecutionPlanAction extends Action {
	public static ID = 'ep.AddExecutionPlan';
	public static LABEL = localize('addExecutionPlanLabel', "Add execution plan");
	constructor(
	) {
		super(AddExecutionPlanAction.ID, AddExecutionPlanAction.LABEL, addIconClassName);
	}

	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		const openFileURI = await context.fileDialogService.showOpenDialog({
			filters: [
				{
					extensions: await context.executionPlanService.getAllSupportedExecutionPlanExtensions(),
					name: localize('executionPlan.SaveFileDescription', "Execution Plan Files")
				}
			],
			canSelectMany: false
		});

		if (openFileURI?.length === 1) {
			const selectedFile = openFileURI[0];
			const selectedFileContent = (await context.textFileService.read(selectedFile, { acceptTextOnly: true })).value;
			context.addExecutionPlan({
				graphFileContent: selectedFileContent,
				graphFileType: extname(selectedFile.fsPath).replace('.', '')
			});

		} else {
			// no file selected.
		}
	}
}

class Properties extends Action {
	public static ID = 'ep.comparePropertiesAction';
	public static LABEL = 'Properties';
	constructor() {
		super(Properties.ID, Properties.LABEL, openPropertiesIconClassNames);
	}
	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.togglePropertiesView();
	}
}


class ZoomIn extends Action {
	public static ID = 'ep.zoomIn';
	public static LABEL = 'Zoom In';
	constructor() {
		super(ZoomIn.ID, ZoomIn.LABEL, zoomInIconClassNames);
	}
	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.zoomIn();
	}
}

class ZoomOut extends Action {
	public static ID = 'ep.zoomOut';
	public static LABEL = 'Zoom Out';
	constructor() {
		super(ZoomOut.ID, ZoomOut.LABEL, zoomOutIconClassNames);
	}
	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.zoomOut();
	}
}
