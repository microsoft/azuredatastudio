/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { AzdataGraphView } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { ExecutionPlanComparisonPropertiesView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonPropertiesView';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { IHorizontalSashLayoutProvider, ISashEvent, IVerticalSashLayoutProvider, Orientation, Sash } from 'vs/base/browser/ui/sash/sash';
import { Action } from 'vs/base/common/actions';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import * as DOM from 'vs/base/browser/dom';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { localize } from 'vs/nls';
import { addIconClassName, openPropertiesIconClassNames, resetZoomIconClassName, splitScreenHorizontallyIconClassName, splitScreenVerticallyIconClassName, zoomInIconClassNames, zoomOutIconClassNames, zoomToFitIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { extname } from 'vs/base/common/path';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { InfoBox } from 'sql/workbench/browser/ui/infoBox/infoBox';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';
import { errorForeground, listHoverBackground, textLinkForeground } from 'vs/platform/theme/common/colorRegistry';
import { ExecutionPlanViewHeader } from 'sql/workbench/contrib/executionPlan/browser/executionPlanViewHeader';
import { attachSelectBoxStyler } from 'sql/platform/theme/common/styler';


export class ExecutionPlanComparisonEditorView {

	public container: HTMLElement;

	private _taskbarContainer: HTMLElement;
	private _taskbar: Taskbar;
	private _addExecutionPlanAction: Action;
	private _zoomInAction: Action;
	private _zoomOutAction: Action;
	private _zoomToFitAction: Action;
	private _resetZoomAction: Action;
	private _propertiesAction: Action;
	private _toggleOrientationAction: Action;

	private _planComparisonContainer: HTMLElement;

	private _propertiesContainer: HTMLElement;
	private _propertiesView: ExecutionPlanComparisonPropertiesView;

	public planSplitViewContainer: HTMLElement;

	private _sashContainer: HTMLElement;
	private _horizontalSash: Sash;
	private _verticalSash: Sash;
	private _orientation: 'horizontal' | 'vertical' = 'horizontal';

	private _placeholderContainer: HTMLElement;
	private _placeholderInfoboxContainer: HTMLElement;
	private _placeholderInfobox: InfoBox;
	private _placeholderLoading: LoadingSpinner;

	private _topPlanContainer: HTMLElement;
	private _topPlanDropdown: SelectBox;
	private _topPlanDropdownContainer: HTMLElement;
	private _topPlanDiagramContainers: HTMLElement[] = [];
	public topPlanDiagrams: AzdataGraphView[] = [];
	private _topPlanDiagramModels: azdata.executionPlan.ExecutionPlanGraph[];
	private _activeTopPlanIndex: number = 0;
	private _topPlanRecommendations: ExecutionPlanViewHeader;

	private get _activeTopPlanDiagram(): AzdataGraphView {
		if (this.topPlanDiagrams.length > 0) {
			return this.topPlanDiagrams[this._activeTopPlanIndex];
		}
		return undefined;
	}

	private _bottomPlanContainer: HTMLElement;
	private _bottomPlanDropdown: SelectBox;
	private _bottomPlanDropdownContainer: HTMLElement;
	private _bottomPlanDiagramContainers: HTMLElement[] = [];
	public bottomPlanDiagrams: AzdataGraphView[] = [];
	private _bottomPlanDiagramModels: azdata.executionPlan.ExecutionPlanGraph[];
	private _activeBottomPlanIndex: number = 0;
	private _bottomPlanRecommendations: ExecutionPlanViewHeader;

	private get _activeBottomPlanDiagram(): AzdataGraphView {
		if (this.bottomPlanDiagrams.length > 0) {
			return this.bottomPlanDiagrams[this._activeBottomPlanIndex];
		}
		return undefined;
	}

	constructor(
		parentContainer: HTMLElement,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService private themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IExecutionPlanService private _executionPlanService: IExecutionPlanService,
		@IFileDialogService private _fileDialogService: IFileDialogService,
		@IContextViewService readonly contextViewService: IContextViewService,
		@ITextFileService private readonly _textFileService: ITextFileService,
		@INotificationService private _notificationService: INotificationService,
	) {

		this.container = DOM.$('.comparison-editor');
		parentContainer.appendChild(this.container);
		this.initializeToolbar();
		this.initializePlanComparison();
		this.refreshSplitView();
	}

	// creating and adding editor toolbar actions
	private initializeToolbar(): void {
		this._taskbarContainer = DOM.$('.editor-toolbar');
		this._taskbar = new Taskbar(this._taskbarContainer, {
			orientation: ActionsOrientation.HORIZONTAL,

		});
		this._taskbar.context = this;
		this._addExecutionPlanAction = new AddExecutionPlanAction();
		this._zoomOutAction = new ZoomOutAction();
		this._zoomInAction = new ZoomInAction();
		this._zoomToFitAction = new ZoomToFitAction();
		this._propertiesAction = new PropertiesAction();
		this._toggleOrientationAction = new ToggleOrientation();
		this._resetZoomAction = new ZoomReset();
		const content: ITaskbarContent[] = [
			{ action: this._addExecutionPlanAction },
			{ action: this._zoomInAction },
			{ action: this._zoomOutAction },
			{ action: this._zoomToFitAction },
			{ action: this._resetZoomAction },
			{ action: this._toggleOrientationAction },
			{ action: this._propertiesAction }
		];
		this._taskbar.setContent(content);
		this.container.appendChild(this._taskbarContainer);
	}

	private initializePlanComparison(): void {
		this._planComparisonContainer = DOM.$('.plan-comparison-container');
		this.container.appendChild(this._planComparisonContainer);
		this.initializeSplitView();
		this.initializeProperties();
	}

	private initializeSplitView(): void {
		this.planSplitViewContainer = DOM.$('.split-view-container');
		this._planComparisonContainer.appendChild(this.planSplitViewContainer);

		this._placeholderContainer = DOM.$('.placeholder');
		this._placeholderInfoboxContainer = DOM.$('.placeholder-infobox');
		this._placeholderLoading = new LoadingSpinner(this._placeholderContainer, {
			fullSize: true,
			showText: true
		});
		this._placeholderContainer.appendChild(this._placeholderInfoboxContainer);
		this._placeholderLoading.loadingMessage = localize('epComapre.LoadingPlanMessage', "Loading execution plan");
		this._placeholderLoading.loadingCompletedMessage = localize('epComapre.LoadingPlanCompleteMessage', "Execution plan successfully loaded");
		this._placeholderInfobox = this._instantiationService.createInstance(InfoBox, this._placeholderInfoboxContainer, {
			style: 'information',
			text: ''
		});
		this._placeholderInfobox.text = localize('epComapre.placeholderInfoboxText', "Add execution plans to compare");

		this._topPlanContainer = DOM.$('.plan-container');
		this.planSplitViewContainer.appendChild(this._topPlanContainer);
		this._topPlanDropdownContainer = DOM.$('.dropdown-container');
		this._topPlanDropdown = new SelectBox(['option 1', 'option2'], 'option1', this.contextViewService, this._topPlanDropdownContainer);
		this._topPlanDropdown.render(this._topPlanDropdownContainer);
		this._topPlanDropdown.onDidSelect(e => {
			this._topPlanDiagramContainers.forEach(c => {
				c.style.display = 'none';
			});
			this._topPlanDiagramContainers[e.index].style.display = '';
			this.topPlanDiagrams[e.index].selectElement(undefined);
			this._propertiesView.setTopElement(this._topPlanDiagramModels[e.index].root);
			this._topPlanRecommendations.recommendations = this._topPlanDiagramModels[e.index].recommendations;
			this._activeTopPlanIndex = e.index;
			this.getSkeletonNodes();
		});
		attachSelectBoxStyler(this._topPlanDropdown, this.themeService);
		this._topPlanContainer.appendChild(this._topPlanDropdownContainer);
		this._topPlanRecommendations = this._instantiationService.createInstance(ExecutionPlanViewHeader, this._topPlanContainer, undefined);

		this.initializeSash();

		this._bottomPlanContainer = DOM.$('.plan-container');
		this.planSplitViewContainer.appendChild(this._bottomPlanContainer);
		this._bottomPlanDropdownContainer = DOM.$('.dropdown-container');
		this._bottomPlanDropdown = new SelectBox(['option 1', 'option2'], 'option1', this.contextViewService, this._bottomPlanDropdownContainer);
		this._bottomPlanDropdown.render(this._bottomPlanDropdownContainer);
		this._bottomPlanDropdown.onDidSelect(e => {
			this._bottomPlanDiagramContainers.forEach(c => {
				c.style.display = 'none';
			});
			this._bottomPlanDiagramContainers[e.index].style.display = '';
			this.bottomPlanDiagrams[e.index].selectElement(undefined);
			this._propertiesView.setTopElement(this._bottomPlanDiagramModels[e.index].root);
			this._bottomPlanRecommendations.recommendations = this._bottomPlanDiagramModels[e.index].recommendations;
			this._activeBottomPlanIndex = e.index;
			this.getSkeletonNodes();
		});
		attachSelectBoxStyler(this._bottomPlanDropdown, this.themeService);

		this._bottomPlanContainer.appendChild(this._bottomPlanDropdownContainer);
		this._bottomPlanRecommendations = this._instantiationService.createInstance(ExecutionPlanViewHeader, this._bottomPlanContainer, undefined);
	}

	private initializeSash(): void {
		this._sashContainer = DOM.$('.sash-container');
		this.planSplitViewContainer.appendChild(this._sashContainer);
		this._verticalSash = new Sash(this._sashContainer, new VerticalSash(this), { orientation: Orientation.VERTICAL, size: 3 });

		let originalWidth;
		let change = 0;
		this._verticalSash.onDidStart((e: ISashEvent) => {
			originalWidth = this._topPlanContainer.offsetWidth;
		});
		this._verticalSash.onDidChange((evt: ISashEvent) => {
			change = evt.startX - evt.currentX;
			const newWidth = originalWidth - change;
			if (newWidth < 200) {
				return;
			}
			this._topPlanContainer.style.minWidth = '200px';
			this._topPlanContainer.style.flex = `0 0 ${newWidth}px`;
		});

		this._horizontalSash = new Sash(this._sashContainer, new HorizontalSash(this), { orientation: Orientation.HORIZONTAL, size: 3 });
		let startHeight;
		this._horizontalSash.onDidStart((e: ISashEvent) => {
			startHeight = this._topPlanContainer.offsetHeight;
		});
		this._horizontalSash.onDidChange((evt: ISashEvent) => {
			change = evt.startY - evt.currentY;
			const newHeight = startHeight - change;
			if (newHeight < 200) {
				return;
			}
			this._topPlanContainer.style.minHeight = '200px';
			this._topPlanContainer.style.flex = `0 0 ${newHeight}px`;
		});
	}

	private initializeProperties(): void {
		this._propertiesContainer = DOM.$('.properties');
		this._propertiesView = this._instantiationService.createInstance(ExecutionPlanComparisonPropertiesView, this._propertiesContainer);
		this._planComparisonContainer.appendChild(this._propertiesContainer);
	}

	public async openAndAddExecutionPlanFile(): Promise<void> {
		try {
			const openedFileUris = await this._fileDialogService.showOpenDialog({
				filters: [
					{
						extensions: await this._executionPlanService.getSupportedExecutionPlanExtensions(),
						name: localize('epCompare.FileFilterDescription', "Execution Plan Files")
					}
				],
				canSelectMany: false,
				canSelectFiles: true
			});
			if (openedFileUris?.length === 1) {
				this._placeholderInfoboxContainer.style.display = 'none';
				this._placeholderLoading.loading = true;
				const fileURI = openedFileUris[0];
				const fileContent = (await this._textFileService.read(fileURI, { acceptTextOnly: true })).value;
				let executionPlanGraphs = await this._executionPlanService.getExecutionPlan({
					graphFileContent: fileContent,
					graphFileType: extname(fileURI.fsPath).replace('.', '')
				});
				this.addExecutionPlanGraph(executionPlanGraphs.graphs);
			}
			this._placeholderInfoboxContainer.style.display = '';
			this._placeholderLoading.loading = false;
			this._placeholderInfoboxContainer.style.display = '';
		} catch (e) {
			this._placeholderLoading.loading = false;
			this._notificationService.error(e);
		}

	}

	public addExecutionPlanGraph(executionPlanGraphs: azdata.executionPlan.ExecutionPlanGraph[]): void {
		if (!this._topPlanDiagramModels) {
			this._topPlanDiagramModels = executionPlanGraphs;
			this._topPlanDropdown.setOptions(executionPlanGraphs.map(e => {
				return {
					text: e.query
				};
			}), 0);

			executionPlanGraphs.forEach((e, i) => {
				const graphContainer = DOM.$('.plan-diagram');
				this._topPlanDiagramContainers.push(graphContainer);
				this._topPlanContainer.appendChild(graphContainer);
				const diagram = this._instantiationService.createInstance(AzdataGraphView, graphContainer, e);
				diagram.onElementSelected(e => {
					this._propertiesView.setTopElement(e);
				});
				this.topPlanDiagrams.push(diagram);
				graphContainer.style.display = 'none';
			});

			this._topPlanDiagramContainers[0].style.display = '';
			this._topPlanRecommendations.recommendations = executionPlanGraphs[0].recommendations;
			this.topPlanDiagrams[0].selectElement(undefined);
			this._propertiesView.setTopElement(executionPlanGraphs[0].root);
			this._propertiesAction.enabled = true;
		} else {
			this._bottomPlanDiagramModels = executionPlanGraphs;
			this._bottomPlanDropdown.setOptions(executionPlanGraphs.map(e => {
				return {
					text: e.query
				};
			}), 0);
			executionPlanGraphs.forEach((e, i) => {
				const graphContainer = DOM.$('.plan-diagram');
				this._bottomPlanDiagramContainers.push(graphContainer);
				this._bottomPlanContainer.appendChild(graphContainer);
				const diagram = this._instantiationService.createInstance(AzdataGraphView, graphContainer, e);
				diagram.onElementSelected(e => {
					this._propertiesView.setBottomElement(e);
				});
				this.bottomPlanDiagrams.push(diagram);
				graphContainer.style.display = 'none';
			});

			this._bottomPlanDiagramContainers[0].style.display = '';
			this._bottomPlanRecommendations.recommendations = executionPlanGraphs[0].recommendations;
			this.bottomPlanDiagrams[0].selectElement(undefined);
			this._propertiesView.setBottomElement(executionPlanGraphs[0].root);
			this.getSkeletonNodes();
			this._addExecutionPlanAction.enabled = false;
		}
		this.refreshSplitView();
	}

	private getSkeletonNodes(): void {
		if (this._topPlanDiagramModels && this._bottomPlanDiagramModels) {
			this._topPlanDiagramModels[this._activeTopPlanIndex].graphFile.graphFileType = 'sqlplan';
			this._bottomPlanDiagramModels[this._activeBottomPlanIndex].graphFile.graphFileType = 'sqlplan';

			this._executionPlanService.compareExecutionPlanGraph(this._topPlanDiagramModels[this._activeTopPlanIndex].graphFile,
				this._bottomPlanDiagramModels[this._activeBottomPlanIndex].graphFile);
		}
	}

	public togglePropertiesView(): void {
		this._propertiesContainer.style.display = this._propertiesContainer.style.display === 'none' ? '' : 'none';
	}

	public toggleOrientation(): void {
		if (this._orientation === 'vertical') {
			this._sashContainer.style.width = '100%';
			this._sashContainer.style.height = '3px';
			this.planSplitViewContainer.style.flexDirection = 'column';
			this._topPlanContainer.style.minHeight = '200px';
			this._topPlanContainer.style.minWidth = '';
			this._topPlanContainer.style.flex = '1';
			this._orientation = 'horizontal';
			this._toggleOrientationAction.class = splitScreenHorizontallyIconClassName;
		} else {
			this._sashContainer.style.width = '3px';
			this._sashContainer.style.height = '100%';
			this.planSplitViewContainer.style.flexDirection = 'row';
			this._topPlanContainer.style.minHeight = '';
			this._topPlanContainer.style.minWidth = '200px';
			this._orientation = 'vertical';
			this._toggleOrientationAction.class = splitScreenVerticallyIconClassName;
		}
		this._topPlanContainer.style.flex = '1';
		this._bottomPlanContainer.style.flex = '1';
	}

	public refreshSplitView(): void {
		if (this.planSplitViewContainer.contains(this._topPlanContainer)) {
			this.planSplitViewContainer.removeChild(this._topPlanContainer);
		}

		if (this.planSplitViewContainer.contains(this._bottomPlanContainer)) {
			this.planSplitViewContainer.removeChild(this._bottomPlanContainer);
		}

		if (this.planSplitViewContainer.contains(this._sashContainer)) {
			this.planSplitViewContainer.removeChild(this._sashContainer);
		}

		if (this.planSplitViewContainer.contains(this._placeholderContainer)) {
			this.planSplitViewContainer.removeChild(this._placeholderContainer);
		}

		if (!this._topPlanDiagramModels && !this._bottomPlanDiagramModels) {
			this.planSplitViewContainer.appendChild(this._placeholderContainer);
		} else if (this._topPlanDiagramModels && !this._bottomPlanDiagramModels) {
			this.planSplitViewContainer.appendChild(this._topPlanContainer);
			this.planSplitViewContainer.appendChild(this._sashContainer);
			this.planSplitViewContainer.appendChild(this._placeholderContainer);
		} else {
			this.planSplitViewContainer.appendChild(this._topPlanContainer);
			this.planSplitViewContainer.appendChild(this._sashContainer);
			this.planSplitViewContainer.appendChild(this._bottomPlanContainer);
		}
	}

	public zoomIn(): void {
		this.topPlanDiagrams[this._activeTopPlanIndex].zoomIn();
		this.bottomPlanDiagrams[this._activeBottomPlanIndex].zoomIn();
		this.syncZoom();
	}

	public zoomOut(): void {
		this.topPlanDiagrams[this._activeTopPlanIndex].zoomOut();
		this.bottomPlanDiagrams[this._activeBottomPlanIndex].zoomOut();
		this.syncZoom();
	}

	public zoomToFit(): void {
		this.topPlanDiagrams[this._activeTopPlanIndex].zoomToFit();
		this.bottomPlanDiagrams[this._activeBottomPlanIndex].zoomToFit();
		this.syncZoom();
	}

	public resetZoom(): void {
		if (this._activeTopPlanDiagram) {
			this._activeTopPlanDiagram.setZoomLevel(100);
		}
		if (this._activeBottomPlanDiagram) {
			this._activeBottomPlanDiagram.setZoomLevel(100);
		}
	}

	private syncZoom(): void {
		if (this.topPlanDiagrams[this._activeTopPlanIndex].getZoomLevel() < this.bottomPlanDiagrams[this._activeBottomPlanIndex].getZoomLevel()) {
			this.bottomPlanDiagrams[this._activeBottomPlanIndex].setZoomLevel(this.topPlanDiagrams[this._activeTopPlanIndex].getZoomLevel());
		} else {
			this.topPlanDiagrams[this._activeTopPlanIndex].setZoomLevel(this.bottomPlanDiagrams[this._activeBottomPlanIndex].getZoomLevel());
		}
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
		context.openAndAddExecutionPlanFile();
	}

}

class ZoomInAction extends Action {
	public static ID = 'ep.zoomIn';
	public static LABEL = localize('epCompare.zoomInAction', "Zoom In");
	constructor() {
		super(ZoomInAction.ID, ZoomInAction.LABEL, zoomInIconClassNames);
	}
	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.zoomIn();
	}
}

class ZoomOutAction extends Action {
	public static ID = 'ep.zoomOut';
	public static LABEL = localize('epCompare.zoomOutAction', "Zoom Out");
	constructor() {
		super(ZoomOutAction.ID, ZoomOutAction.LABEL, zoomOutIconClassNames);
	}
	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.zoomOut();
	}
}

class ZoomToFitAction extends Action {
	public static ID = 'ep.zoomToFit';
	public static LABEL = localize('epCompare.zoomToFit', "Zoom to fit");

	constructor() {
		super(ZoomToFitAction.ID, ZoomToFitAction.LABEL, zoomToFitIconClassNames);
	}

	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.zoomToFit();
	}
}

class ZoomReset extends Action {
	public static ID = 'ep.resetZoom';
	public static LABEL = localize('epCompare.zoomReset', "Reset Zoom");

	constructor() {
		super(ZoomReset.ID, ZoomReset.LABEL, resetZoomIconClassName);
	}

	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.resetZoom();
	}
}

class ToggleOrientation extends Action {
	public static ID = 'ep.toggleOrientation';
	public static LABEL = localize('epCompare.toggleOrientation', "Toggle Orientation");

	constructor() {
		super(ToggleOrientation.ID, ToggleOrientation.LABEL, splitScreenHorizontallyIconClassName);
	}

	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.toggleOrientation();
	}
}

class PropertiesAction extends Action {
	public static ID = 'epCompare.comparePropertiesAction';
	public static LABEL = localize('epCompare.comparePropertiesAction', "Properties");
	constructor() {
		super(PropertiesAction.ID, PropertiesAction.LABEL, openPropertiesIconClassNames);
		this.enabled = false;
	}
	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.togglePropertiesView();
	}
}

class HorizontalSash implements IHorizontalSashLayoutProvider {
	constructor(private _context: ExecutionPlanComparisonEditorView) {
	}
	getHorizontalSashTop(sash: Sash): number {
		return 0;
	}
	getHorizontalSashLeft?(sash: Sash): number {
		return 0;
	}
	getHorizontalSashWidth?(sash: Sash): number {
		return this._context.planSplitViewContainer.clientWidth;
	}

}

class VerticalSash implements IVerticalSashLayoutProvider {
	constructor(private _context: ExecutionPlanComparisonEditorView) {

	}
	getVerticalSashLeft(sash: Sash): number {
		return 0;
	}
	getVerticalSashTop?(sash: Sash): number {
		return 0;
	}
	getVerticalSashHeight?(sash: Sash): number {
		return this._context.planSplitViewContainer.clientHeight;
	}

}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const separatorColor = theme.getColor(errorForeground);
	if (separatorColor) {
		collector.addRule(`
		.designer-component .issues-container .issue-item .issue-icon.codicon-error {
			color: ${separatorColor};
		}`);
	}
	const recommendationsColor = theme.getColor(textLinkForeground);
	if (recommendationsColor) {
		collector.addRule(`
		.eps-container .comparison-editor .plan-comparison-container .split-view-container .plan-container .recommendations {
			color: ${recommendationsColor};
		}
		`);
	}
	const menuBackgroundColor = theme.getColor(listHoverBackground);
	if (menuBackgroundColor) {
		collector.addRule(`
		.eps-container .comparison-editor .plan-comparison-container .split-view-container .plan-container .recommendations {
			background-color: ${menuBackgroundColor};
		}
		`);
	}
});
