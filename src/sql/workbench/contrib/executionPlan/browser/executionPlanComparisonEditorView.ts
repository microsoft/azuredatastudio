/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { ITaskbarContent, Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { AzdataGraphView } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { ExecutionPlanCompareOrientation, ExecutionPlanComparisonPropertiesView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanComparisonPropertiesView';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { IHorizontalSashLayoutProvider, ISashEvent, IVerticalSashLayoutProvider, Orientation, Sash } from 'vs/base/browser/ui/sash/sash';
import { Action } from 'vs/base/common/actions';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import * as DOM from 'vs/base/browser/dom';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { localize } from 'vs/nls';
import { addIconClassName, openPropertiesIconClassNames, polygonBorderColor, polygonFillColor, resetZoomIconClassName, splitScreenHorizontallyIconClassName, splitScreenVerticallyIconClassName, zoomInIconClassNames, zoomOutIconClassNames, zoomToFitIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { extname } from 'vs/base/common/path';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { InfoBox } from 'sql/workbench/browser/ui/infoBox/infoBox';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';
import { errorForeground, listHoverBackground, textLinkForeground } from 'vs/platform/theme/common/colorRegistry';
import { ExecutionPlanViewHeader } from 'sql/workbench/contrib/executionPlan/browser/executionPlanViewHeader';
import { attachSelectBoxStyler } from 'sql/platform/theme/common/styler';
import { IProgressService, ProgressLocation } from 'vs/platform/progress/common/progress';
import { generateUuid } from 'vs/base/common/uuid';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';

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
	private _orientation: ExecutionPlanCompareOrientation = ExecutionPlanCompareOrientation.Horizontal;

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
	private _topSimilarNode: Map<string, azdata.executionPlan.ExecutionGraphComparisonResult> = new Map();
	private _polygonRootsMap: Map<number, {
		topPolygon: azdata.executionPlan.ExecutionGraphComparisonResult,
		bottomPolygon: azdata.executionPlan.ExecutionGraphComparisonResult
	}> = new Map();

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
	private _bottomSimilarNode: Map<string, azdata.executionPlan.ExecutionGraphComparisonResult> = new Map();
	private _latestRequestUuid: string;

	private get _activeBottomPlanDiagram(): AzdataGraphView {
		if (this.bottomPlanDiagrams.length > 0) {
			return this.bottomPlanDiagrams[this._activeBottomPlanIndex];
		}
		return undefined;
	}

	private createQueryDropdownPrefixString(query: string, index: number, totalQueries: number): string {
		return localize('queryDropdownPrefix', "Query {0} of {1}: {2}", index, totalQueries, query);
	}

	constructor(
		parentContainer: HTMLElement,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IThemeService private themeService: IThemeService,
		@IExecutionPlanService private _executionPlanService: IExecutionPlanService,
		@IFileDialogService private _fileDialogService: IFileDialogService,
		@IContextViewService readonly contextViewService: IContextViewService,
		@ITextFileService private readonly _textFileService: ITextFileService,
		@INotificationService private _notificationService: INotificationService,
		@IProgressService private _progressService: IProgressService
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
		this._addExecutionPlanAction = this._instantiationService.createInstance(AddExecutionPlanAction);
		this._zoomOutAction = new ZoomOutAction();
		this._zoomInAction = new ZoomInAction();
		this._zoomToFitAction = new ZoomToFitAction();
		this._propertiesAction = this._instantiationService.createInstance(PropertiesAction);
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
		this._topPlanDropdown.onDidSelect(async (e) => {
			if (this._activeBottomPlanDiagram) {
				this._activeBottomPlanDiagram.clearSubtreePolygon();
			}
			this._activeTopPlanDiagram.clearSubtreePolygon();
			this._topPlanDiagramContainers.forEach(c => {
				c.style.display = 'none';
			});
			this._topPlanDiagramContainers[e.index].style.display = '';
			this._propertiesView.setTopElement(this._topPlanDiagramModels[e.index].root);
			this._topPlanRecommendations.recommendations = this._topPlanDiagramModels[e.index].recommendations;
			this._activeTopPlanIndex = e.index;

			await this.getSkeletonNodes();
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
		this._bottomPlanDropdown.onDidSelect(async (e) => {
			this._activeBottomPlanDiagram.clearSubtreePolygon();
			if (this._activeTopPlanDiagram) {
				this._activeTopPlanDiagram.clearSubtreePolygon();
			}
			this._bottomPlanDiagramContainers.forEach(c => {
				c.style.display = 'none';
			});
			this._bottomPlanDiagramContainers[e.index].style.display = '';
			this._propertiesView.setTopElement(this._bottomPlanDiagramModels[e.index].root);
			this._bottomPlanRecommendations.recommendations = this._bottomPlanDiagramModels[e.index].recommendations;
			this._activeBottomPlanIndex = e.index;

			await this.getSkeletonNodes();
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
				await this.addExecutionPlanGraph(executionPlanGraphs.graphs, 0);
			}
			this._placeholderInfoboxContainer.style.display = '';
			this._placeholderLoading.loading = false;
			this._placeholderInfoboxContainer.style.display = '';
		} catch (e) {
			this._placeholderLoading.loading = false;
			this._notificationService.error(e);
		}

	}

	public async addExecutionPlanGraph(executionPlanGraphs: azdata.executionPlan.ExecutionPlanGraph[], preSelectIndex: number): Promise<void> {
		if (!this._topPlanDiagramModels) {
			this._topPlanDiagramModels = executionPlanGraphs;
			this._topPlanDropdown.setOptions(executionPlanGraphs.map((e, index) => {
				return {
					text: this.createQueryDropdownPrefixString(e.query, index + 1, executionPlanGraphs.length)
				};
			}));

			executionPlanGraphs.forEach((e, i) => {
				const graphContainer = DOM.$('.plan-diagram');
				this._topPlanDiagramContainers.push(graphContainer);
				this._topPlanContainer.appendChild(graphContainer);
				const diagram = this._instantiationService.createInstance(AzdataGraphView, graphContainer, e);
				diagram.onElementSelected(e => {
					this._propertiesView.setTopElement(e);
					const id = e.id.replace(`element-`, '');
					if (this._topSimilarNode.has(id)) {
						const similarNode = this._topSimilarNode.get(id);
						const element = this._activeBottomPlanDiagram.getElementById(`element-` + similarNode.matchingNodesId[0]);
						if (similarNode.matchingNodesId.find(m => this._activeBottomPlanDiagram.getSelectedElement().id === `element-` + m) !== undefined) {
							return;
						}
						this._activeBottomPlanDiagram.selectElement(element);
					}
				});
				this.topPlanDiagrams.push(diagram);
				graphContainer.style.display = 'none';
			});
			this._topPlanDropdown.select(preSelectIndex);
			this._propertiesView.setTopElement(executionPlanGraphs[0].root);
			this._propertiesAction.enabled = true;
			this._zoomInAction.enabled = true;
			this._zoomOutAction.enabled = true;
			this._resetZoomAction.enabled = true;
			this._zoomToFitAction.enabled = true;
			this._toggleOrientationAction.enabled = true;
		} else {
			this._bottomPlanDiagramModels = executionPlanGraphs;
			this._bottomPlanDropdown.setOptions(executionPlanGraphs.map((e, index) => {
				return {
					text: this.createQueryDropdownPrefixString(e.query, index + 1, executionPlanGraphs.length)
				};
			}));
			executionPlanGraphs.forEach((e, i) => {
				const graphContainer = DOM.$('.plan-diagram');
				this._bottomPlanDiagramContainers.push(graphContainer);
				this._bottomPlanContainer.appendChild(graphContainer);
				const diagram = this._instantiationService.createInstance(AzdataGraphView, graphContainer, e);
				diagram.onElementSelected(e => {
					this._propertiesView.setBottomElement(e);
					const id = e.id.replace(`element-`, '');
					if (this._bottomSimilarNode.has(id)) {
						const similarNode = this._bottomSimilarNode.get(id);
						const element = this._activeTopPlanDiagram.getElementById(`element-` + similarNode.matchingNodesId[0]);
						if (similarNode.matchingNodesId.find(m => this._activeTopPlanDiagram.getSelectedElement().id === `element-` + m) !== undefined) {
							return;
						}
						this._activeTopPlanDiagram.selectElement(element);
					}
				});
				this.bottomPlanDiagrams.push(diagram);
				graphContainer.style.display = 'none';
			});
			this._bottomPlanDropdown.select(preSelectIndex);
			this._propertiesView.setBottomElement(executionPlanGraphs[0].root);
			this._addExecutionPlanAction.enabled = false;
		}
		this.refreshSplitView();
	}

	private async getSkeletonNodes(): Promise<void> {
		if (!this._activeBottomPlanDiagram) {
			return;
		}
		this._progressService.withProgress(
			{
				location: ProgressLocation.Notification,
				title: localize('epCompare.comparisonProgess', "Loading similar areas in compared plans"),
				cancellable: false
			},
			async (progress) => {
				this._polygonRootsMap = new Map();
				this._topSimilarNode = new Map();
				this._bottomSimilarNode = new Map();
				if (this._topPlanDiagramModels && this._bottomPlanDiagramModels) {
					this._topPlanDiagramModels[this._activeTopPlanIndex].graphFile.graphFileType = 'sqlplan';
					this._bottomPlanDiagramModels[this._activeBottomPlanIndex].graphFile.graphFileType = 'sqlplan';

					const currentRequestId = generateUuid();
					this._latestRequestUuid = currentRequestId;
					const result = await this._executionPlanService.compareExecutionPlanGraph(this._topPlanDiagramModels[this._activeTopPlanIndex].graphFile,
						this._bottomPlanDiagramModels[this._activeBottomPlanIndex].graphFile);
					if (currentRequestId !== this._latestRequestUuid) {
						return;
					}
					this.getSimilarSubtrees(result.firstComparisonResult);
					this.getSimilarSubtrees(result.secondComparisonResult, true);
					let colorIndex = 0;
					this._polygonRootsMap.forEach((v, k) => {
						this._activeTopPlanDiagram.drawSubtreePolygon(v.topPolygon.baseNode.id, polygonFillColor[colorIndex], polygonBorderColor[colorIndex]);
						this._activeBottomPlanDiagram.drawSubtreePolygon(v.bottomPolygon.baseNode.id, polygonFillColor[colorIndex], polygonBorderColor[colorIndex]);
						colorIndex += 1;
					});
				}
				return;
			}
		);
	}

	private getSimilarSubtrees(comparedNode: azdata.executionPlan.ExecutionGraphComparisonResult, isBottomPlan: boolean = false): void {
		if (comparedNode.hasMatch) {
			if (!isBottomPlan) {
				this._topSimilarNode.set(`${comparedNode.baseNode.id}`, comparedNode);
				if (!this._polygonRootsMap.has(comparedNode.groupIndex)) {
					this._polygonRootsMap.set(comparedNode.groupIndex, {
						topPolygon: comparedNode,
						bottomPolygon: undefined
					});
				}
			} else {
				this._bottomSimilarNode.set(`${comparedNode.baseNode.id}`, comparedNode);
				if (this._polygonRootsMap.get(comparedNode.groupIndex).bottomPolygon === undefined) {
					const polygonMapEntry = this._polygonRootsMap.get(comparedNode.groupIndex);
					polygonMapEntry.bottomPolygon = comparedNode;
					this._polygonRootsMap.set(comparedNode.groupIndex, polygonMapEntry);
				}
			}
		}
		comparedNode.children.forEach(c => {
			this.getSimilarSubtrees(c, isBottomPlan);
		});
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
			this._orientation = ExecutionPlanCompareOrientation.Horizontal;
			this._toggleOrientationAction.class = splitScreenHorizontallyIconClassName;
		} else {
			this._sashContainer.style.width = '3px';
			this._sashContainer.style.height = '100%';
			this.planSplitViewContainer.style.flexDirection = 'row';
			this._topPlanContainer.style.minHeight = '';
			this._topPlanContainer.style.minWidth = '200px';
			this._orientation = ExecutionPlanCompareOrientation.Vertical;
			this._toggleOrientationAction.class = splitScreenVerticallyIconClassName;
		}

		this._propertiesView.orientation = this._orientation;
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
		this._activeTopPlanDiagram.zoomIn();
		this._activeBottomPlanDiagram.zoomIn();
		this.syncZoom();
	}

	public zoomOut(): void {
		this._activeTopPlanDiagram.zoomOut();
		this._activeBottomPlanDiagram.zoomOut();
		this.syncZoom();
	}

	public zoomToFit(): void {
		this._activeTopPlanDiagram.zoomToFit();
		this._activeBottomPlanDiagram.zoomToFit();
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
		if (this._activeTopPlanDiagram.getZoomLevel() < this._activeBottomPlanDiagram.getZoomLevel()) {
			this._activeBottomPlanDiagram.setZoomLevel(this._activeTopPlanDiagram.getZoomLevel());
		} else {
			this._activeTopPlanDiagram.setZoomLevel(this._activeBottomPlanDiagram.getZoomLevel());
		}
	}
}


class AddExecutionPlanAction extends Action {
	public static ID = 'ep.AddExecutionPlan';
	public static LABEL = localize('addExecutionPlanLabel', "Add execution plan");

	constructor(
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(AddExecutionPlanAction.ID, AddExecutionPlanAction.LABEL, addIconClassName);
	}

	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		this.telemetryService.sendActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.AddExecutionPlan);

		await context.openAndAddExecutionPlanFile();
	}

}

class ZoomInAction extends Action {
	public static ID = 'ep.zoomIn';
	public static LABEL = localize('epCompare.zoomInAction', "Zoom In");
	constructor() {
		super(ZoomInAction.ID, ZoomInAction.LABEL, zoomInIconClassNames);
		this.enabled = false;
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
		this.enabled = false;
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
		this.enabled = false;
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
		this.enabled = false;
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
		this.enabled = false;
	}

	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		context.toggleOrientation();
	}
}

class PropertiesAction extends Action {
	public static ID = 'epCompare.comparePropertiesAction';
	public static LABEL = localize('epCompare.comparePropertiesAction', "Properties");

	constructor(
		@IAdsTelemetryService private readonly telemetryService: IAdsTelemetryService
	) {
		super(PropertiesAction.ID, PropertiesAction.LABEL, openPropertiesIconClassNames);
		this.enabled = false;
	}

	public override async run(context: ExecutionPlanComparisonEditorView): Promise<void> {
		this.telemetryService
			.createActionEvent(TelemetryKeys.TelemetryView.ExecutionPlan, TelemetryKeys.TelemetryAction.ViewExecutionPlanComparisonProperties)
			.send();

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
