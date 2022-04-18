/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/executionPlan';
import { localize } from 'vs/nls';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import * as DOM from 'vs/base/browser/dom';
import { ExecutionPlanComparisonInput } from 'sql/workbench/contrib/executionPlan/common/compareExecutionPlanInput';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { Action } from 'vs/base/common/actions';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import * as azdata from 'azdata';
import { addIconClassName, openPropertiesIconClassNames, zoomInIconClassNames, zoomOutIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { extname } from 'vs/base/common/path';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';
import { Emitter } from 'vs/base/common/event';
import { Event } from 'vscode';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ExecutionPlanComparisonPropertiesView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonPropertiesView';
import { InfoBox } from 'sql/workbench/browser/ui/infoBox/infoBox';
import { AzdataGraphView, InternalExecutionPlanEdge, InternalExecutionPlanNode } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { ExecutionPlanFileViewCache } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileViewCache';
import { generateUuid } from 'vs/base/common/uuid';

export class ExecutionPlanComparisonEditor extends EditorPane {
	private _container: HTMLElement;

	public static ID: string = 'workbench.editor.compareExecutionPlan';
	public static LABEL: string = localize('compareExecutionPlanEditor', "Compare Execution Plan Editor");

	private _viewCache: ExecutionPlanFileViewCache = ExecutionPlanFileViewCache.getInstance();

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IExecutionPlanService public executionPlanService: IExecutionPlanService,
		@IFileDialogService public fileDialogService: IFileDialogService,
		@ITextFileService public textFileService: ITextFileService,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
		super(ExecutionPlanComparisonEditor.ID, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		// creating the parent container for the editor
		this._container = DOM.$('.compare-execution-plan-parent-editor');
		parent.appendChild(this._container);
	}

	layout(dimension: DOM.Dimension): void {
		this._container.style.width = dimension.width + 'px';
		this._container.style.height = dimension.height + 'px';
	}

	public override async setInput(newInput: ExecutionPlanComparisonInput, options: IEditorOptions, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		const oldInput = this.input as ExecutionPlanComparisonInput;

		if (oldInput && newInput.matches(oldInput)) {
			return Promise.resolve();
		}

		super.setInput(newInput, options, context, token);

		if (oldInput?._comparisonEditorUUID) {
			const oldView = this._viewCache.executionPlanComparisonViewMap.get(oldInput._comparisonEditorUUID);
			if (oldView) {
				oldView.hide();
			}
		}

		let newView = this._viewCache.executionPlanComparisonViewMap.get(newInput._comparisonEditorUUID);

		if (newView) {
			newView.show();
		} else {
			newInput._comparisonEditorUUID = generateUuid();
			newView = this._instantiationService.createInstance(CompareExecutionPlanEditorView, this._container);
		}
	}

}

export class CompareExecutionPlanEditorView {

	public static LABEL: string = localize('compareExecutionPlanEditor', "Compare Execution Plan Editor");

	private _container: HTMLElement;

	private _planContainer: HTMLElement;

	private _toolbarContainer: HTMLElement;

	private _taskbar: Taskbar;

	private _placeholderContainer: HTMLElement;
	private _placeholderInfoBox: InfoBox;

	private _executionPlans: azdata.executionPlan.ExecutionPlanGraph[][] = [];
	private _plans: azdata.executionPlan.ExecutionPlanGraphInfo[] = [];
	private _planControls: CompareExecutionPlanView[] = [];

	private _propertiesContainer: HTMLElement;
	private _propertiesView: ExecutionPlanComparisonPropertiesView;

	private _addExecutionPlanAction: AddExecutionPlanAction;

	constructor(
		private _parentContainer: HTMLElement,
		@IExecutionPlanService public executionPlanService: IExecutionPlanService,
		@IFileDialogService public fileDialogService: IFileDialogService,
		@ITextFileService public textFileService: ITextFileService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IThemeService private _themeService: IThemeService
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
		this._plans.push(plan);
		const planView = this._instantiationService.createInstance(CompareExecutionPlanView, this._planContainer, this._placeholderContainer);
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
		new Promise(async (reject, resolve) => {
			const executionPlanGraph = await this.executionPlanService.getExecutionPlan(plan);
			this._executionPlans.push(executionPlanGraph.graphs);
			planView.addGraphs(executionPlanGraph.graphs);
			resolve();
		});
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


class CompareExecutionPlanView {
	private graphContainer: HTMLElement[] = [];
	public azdataGraphDiagram: AzdataGraphView[] = [];

	private _executionPlanGraph: azdata.executionPlan.ExecutionPlanGraph[] = [];

	public graphElementPropertiesSet: Set<string> = new Set();

	private _container: HTMLElement;

	private _dropdown: SelectBox;
	private _dropdownContainer: HTMLElement;


	private loadingSpinner: LoadingSpinner;

	public _onCellSelectedEmitter: Emitter<InternalExecutionPlanEdge | InternalExecutionPlanNode> = new Emitter<InternalExecutionPlanNode | InternalExecutionPlanEdge>();
	public _onCellSelectedEvent: Event<InternalExecutionPlanNode | InternalExecutionPlanEdge>;


	constructor(
		parent: HTMLElement,
		placeholder: HTMLElement,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IExecutionPlanService executionPlanService: IExecutionPlanService,
		@IContextViewService readonly contextViewService: IContextViewService
	) {

		this._container = DOM.$('.plan');
		parent.insertBefore(this._container, placeholder);

		this.loadingSpinner = new LoadingSpinner(this._container, { showText: true, fullSize: true });
		this.loadingSpinner.loading = true;

		this._dropdown = new SelectBox([], 0, contextViewService);

		this._dropdown.onDidSelect(e => {
			this.graphContainer.forEach(c => {
				c.style.display = 'none';
			});
			this.graphContainer[e.index].style.display = '';
			this.azdataGraphDiagram[e.index].selectElement(undefined);
			this._onCellSelectedEmitter.fire(this._executionPlanGraph[e.index].root);
		});

		this._dropdownContainer = DOM.$('.plan-dropdown-container');
		this._dropdownContainer.style.display = 'none';
		this._dropdown.render(this._dropdownContainer);
		this._container.append(this._dropdownContainer);

		this._onCellSelectedEvent = this._onCellSelectedEmitter.event;
	}

	private createPlanDiagram(container: HTMLElement, executionPlan: azdata.executionPlan.ExecutionPlanGraph, index: number) {
		const diagram = this._instantiationService.createInstance(AzdataGraphView, container, executionPlan);
		diagram.onElementSelected(e => {
			this._onCellSelectedEmitter.fire(e);
		});
		return {
			diagram: diagram
		};
	}

	public addGraphs(executionPlan: azdata.executionPlan.ExecutionPlanGraph[]) {
		this._executionPlanGraph = executionPlan;
		this._dropdown.setOptions(executionPlan.map(e => {
			return {
				text: e.query
			};
		}), 0);
		executionPlan.forEach((e, i) => {
			const graphContainer = DOM.$('.plan-diagram');
			this.graphContainer.push(graphContainer);
			const diagramClose = this.createPlanDiagram(graphContainer, e, i);
			this.azdataGraphDiagram.push(diagramClose.diagram);
			this._container.append(graphContainer);
			graphContainer.style.display = 'none';
		});

		this.graphContainer[0].style.display = '';
		this.azdataGraphDiagram[0].selectElement(undefined);
		this._onCellSelectedEmitter.fire(executionPlan[0].root);
		this._dropdownContainer.style.display = '';
		this.loadingSpinner.loading = false;
	}
}

class AddExecutionPlanAction extends Action {
	public static ID = 'ep.AddExecutionPlan';
	public static LABEL = localize('addExecutionPlanLabel', "Add execution plan");
	constructor(
	) {
		super(AddExecutionPlanAction.ID, AddExecutionPlanAction.LABEL, addIconClassName);
	}

	public override async run(context: CompareExecutionPlanEditorView): Promise<void> {
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
	public override async run(context: CompareExecutionPlanEditorView): Promise<void> {
		context.togglePropertiesView();
	}
}


class ZoomIn extends Action {
	public static ID = 'ep.zoomIn';
	public static LABEL = 'Zoom In';
	constructor() {
		super(ZoomIn.ID, ZoomIn.LABEL, zoomInIconClassNames);
	}
	public override async run(context: CompareExecutionPlanEditorView): Promise<void> {
		context.zoomIn();
	}
}

class ZoomOut extends Action {
	public static ID = 'ep.zoomOut';
	public static LABEL = 'Zoom Out';
	constructor() {
		super(ZoomOut.ID, ZoomOut.LABEL, zoomOutIconClassNames);
	}
	public override async run(context: CompareExecutionPlanEditorView): Promise<void> {
		context.zoomOut();
	}
}
