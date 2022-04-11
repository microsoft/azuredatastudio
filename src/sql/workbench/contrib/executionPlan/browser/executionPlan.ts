/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/executionPlan';
import * as azdata from 'azdata';
import * as sqlExtHostType from 'sql/workbench/api/common/sqlExtHostTypes';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { localize } from 'vs/nls';
import { dispose } from 'vs/base/common/lifecycle';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import * as DOM from 'vs/base/browser/dom';
import * as azdataGraphModule from 'azdataGraph';
import { customZoomIconClassNames, openPlanFileIconClassNames, openPropertiesIconClassNames, openQueryIconClassNames, executionPlanNodeIconPaths, savePlanIconClassNames, searchIconClassNames, zoomInIconClassNames, zoomOutIconClassNames, zoomToFitIconClassNames, badgeIconPaths } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { isString } from 'vs/base/common/types';
import { PlanHeader } from 'sql/workbench/contrib/executionPlan/browser/planHeader';
import { ExecutionPlanPropertiesView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanPropertiesView';
import { Action } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { openNewQuery } from 'sql/workbench/contrib/query/browser/queryActions';
import { RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { contrastBorder, editorBackground, editorWidgetBackground, foreground, listHoverBackground, textLinkForeground, widgetShadow } from 'vs/platform/theme/common/colorRegistry';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { ISashEvent, ISashLayoutProvider, Orientation, Sash } from 'vs/base/browser/ui/sash/sash';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/format';
import { Progress } from 'vs/platform/progress/common/progress';
import { CancellationToken } from 'vs/base/common/cancellation';
import { EDITOR_FONT_DEFAULTS } from 'vs/editor/common/config/editorOptions';
import { ExecutionPlanWidgetController } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetController';
import { CustomZoomWidget } from 'sql/workbench/contrib/executionPlan/browser/widgets/customZoomWidget';
import { NodeSearchWidget } from 'sql/workbench/contrib/executionPlan/browser/widgets/nodeSearchWidget';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IFileService } from 'vs/platform/files/common/files';
import { VSBuffer } from 'vs/base/common/buffer';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IExecutionPlanService } from 'sql/workbench/services/executionPlan/common/interfaces';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';
import { InfoBox } from 'sql/base/browser/ui/infoBox/infoBox';

let azdataGraph = azdataGraphModule();

export interface InternalExecutionPlanNode extends azdata.executionPlan.ExecutionPlanNode {
	/**
	 * Unique internal id given to graph node by ADS.
	 */
	id?: string;
}

export interface InternalExecutionPlanEdge extends azdata.executionPlan.ExecutionPlanEdge {
	/**
	 * Unique internal id given to graph edge by ADS.
	 */
	id?: string;
}

export class ExecutionPlanTab implements IPanelTab {
	public readonly title = localize('executionPlanTitle', "Query Plan (Preview)");
	public readonly identifier = 'ExecutionPlan2Tab';
	public readonly view: ExecutionPlanView;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		this.view = instantiationService.createInstance(ExecutionPlanView);
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}

}

export class ExecutionPlanView implements IPanelView {
	private _loadingSpinner: LoadingSpinner;
	private _loadingErrorInfoBox: InfoBox;
	private _eps?: ExecutionPlan[] = [];
	private _graphs?: azdata.executionPlan.ExecutionPlanGraph[] = [];
	private _container = DOM.$('.eps-container');

	private _planCache: Map<string, azdata.executionPlan.ExecutionPlanGraph[]> = new Map();

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService,
		@IExecutionPlanService private executionPlanService: IExecutionPlanService
	) {
	}

	public render(parent: HTMLElement): void {
		parent.appendChild(this._container);
	}

	dispose() {
		this._container.remove();
		delete this._eps;
		delete this._graphs;
	}

	public layout(dimension: DOM.Dimension): void {
	}

	public clear() {
		this._eps = [];
		this._graphs = [];
		DOM.clearNode(this._container);
	}

	/**
	 * Adds executionPlanGraph to the graph controller.
	 * @param newGraphs ExecutionPlanGraphs to be added.
	 */
	public addGraphs(newGraphs: azdata.executionPlan.ExecutionPlanGraph[] | undefined) {
		if (newGraphs) {
			newGraphs.forEach(g => {
				const ep = this.instantiationService.createInstance(ExecutionPlan, this._container, this._eps.length + 1);
				ep.graphModel = g;
				this._eps.push(ep);
				this._graphs.push(g);
				this.updateRelativeCosts();
			});
		}
	}

	/**
	 * Loads the graph file by converting the file to generic executionPlan graphs.
	 * This feature requires the right providers to be registered that can handle
	 * the graphFileType in the graphFile
	 * Please note: this method clears the existing graph in the graph control
	 * @param graphFile graph file to be loaded.
	 * @returns
	 */
	public async loadGraphFile(graphFile: azdata.executionPlan.ExecutionPlanGraphInfo) {
		this.clear();
		this._loadingSpinner = new LoadingSpinner(this._container, { showText: true, fullSize: true });
		this._loadingSpinner.loadingMessage = localize('loadingExecutionPlanFile', "Generating execution plans");
		try {
			this._loadingSpinner.loading = true;
			if (this._planCache.has(graphFile.graphFileContent)) {
				this.addGraphs(this._planCache.get(graphFile.graphFileContent));
				return;
			} else {
				const graphs = (await this.executionPlanService.getExecutionPlan({
					graphFileContent: graphFile.graphFileContent,
					graphFileType: graphFile.graphFileType
				})).graphs;
				this.addGraphs(graphs);
				this._planCache.set(graphFile.graphFileContent, graphs);
			}
			this._loadingSpinner.loadingCompletedMessage = localize('executionPlanFileLoadingComplete', "Execution plans are generated");
		} catch (e) {
			this._loadingErrorInfoBox = new InfoBox(this._container, {
				text: e.toString(),
				style: 'error',
				isClickable: false
			});
			this._loadingErrorInfoBox.isClickable = false;
			this._loadingSpinner.loadingCompletedMessage = localize('executionPlanFileLoadingFailed', "Failed to load execution plan");
		} finally {
			this._loadingSpinner.loading = false;
		}
	}

	private updateRelativeCosts() {
		const sum = this._graphs.reduce((prevCost: number, cg) => {
			return prevCost += cg.root.subTreeCost + cg.root.cost;
		}, 0);

		if (sum > 0) {
			this._eps.forEach(ep => {
				ep.planHeader.relativeCost = ((ep.graphModel.root.subTreeCost + ep.graphModel.root.cost) / sum) * 100;
			});
		}
	}
}

export class ExecutionPlan implements ISashLayoutProvider {
	private _graphModel?: azdata.executionPlan.ExecutionPlanGraph;

	private _container: HTMLElement;

	private _actionBarContainer: HTMLElement;
	private _actionBar: ActionBar;

	public planHeader: PlanHeader;
	private _planContainer: HTMLElement;
	private _planHeaderContainer: HTMLElement;

	public propertiesView: ExecutionPlanPropertiesView;
	private _propContainer: HTMLElement;

	private _planActionContainer: HTMLElement;
	public planActionView: ExecutionPlanWidgetController;

	public azdataGraphDiagram: any;

	public graphElementPropertiesSet: Set<string> = new Set();

	private uniqueElementId: number = -1;

	constructor(
		private _parent: HTMLElement,
		private _graphIndex: number,
		@IInstantiationService public readonly _instantiationService: IInstantiationService,
		@IThemeService private readonly _themeService: IThemeService,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IUntitledTextEditorService private readonly _untitledEditorService: IUntitledTextEditorService,
		@IEditorService private readonly editorService: IEditorService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IFileDialogService public fileDialogService: IFileDialogService,
		@IFileService public fileService: IFileService,
		@IWorkspaceContextService public workspaceContextService: IWorkspaceContextService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService,
	) {
		// parent container for query plan.
		this._container = DOM.$('.execution-plan');
		this._parent.appendChild(this._container);
		const sashContainer = DOM.$('.execution-plan-sash');
		this._parent.appendChild(sashContainer);

		const sash = new Sash(sashContainer, this, { orientation: Orientation.HORIZONTAL });
		let originalHeight = this._container.offsetHeight;
		let originalTableHeight = 0;
		let change = 0;
		sash.onDidStart((e: ISashEvent) => {
			originalHeight = this._container.offsetHeight;
			originalTableHeight = this.propertiesView.tableHeight;
		});

		/**
		 * Using onDidChange for the smooth resizing of the graph diagram
		 */
		sash.onDidChange((evt: ISashEvent) => {
			change = evt.startY - evt.currentY;
			const newHeight = originalHeight - change;
			if (newHeight < 200) {
				return;
			}
			/**
			 * Since the parent container is flex, we will have
			 * to change the flex-basis property to change the height.
			 */
			this._container.style.minHeight = '200px';
			this._container.style.flex = `0 0 ${newHeight}px`;
		});

		/**
		 * Resizing properties window table only once at the end as it is a heavy operation and worsens the smooth resizing experience
		 */
		sash.onDidEnd(() => {
			this.propertiesView.tableHeight = originalTableHeight - change;
		});

		this._planContainer = DOM.$('.plan');
		this._container.appendChild(this._planContainer);

		// container that holds plan header info
		this._planHeaderContainer = DOM.$('.header');

		// Styling header text like the query editor
		this._planHeaderContainer.style.fontFamily = EDITOR_FONT_DEFAULTS.fontFamily;
		this._planHeaderContainer.style.fontSize = EDITOR_FONT_DEFAULTS.fontSize.toString();
		this._planHeaderContainer.style.fontWeight = EDITOR_FONT_DEFAULTS.fontWeight;

		this._planContainer.appendChild(this._planHeaderContainer);
		this.planHeader = this._instantiationService.createInstance(PlanHeader, this._planHeaderContainer, {
			planIndex: this._graphIndex,
		});

		// container properties
		this._propContainer = DOM.$('.properties');
		this._container.appendChild(this._propContainer);
		this.propertiesView = new ExecutionPlanPropertiesView(this._propContainer, this._themeService);

		this._planActionContainer = DOM.$('.plan-action-container');
		this._planContainer.appendChild(this._planActionContainer);
		this.planActionView = new ExecutionPlanWidgetController(this._planActionContainer);

		// container that holds actionbar icons
		this._actionBarContainer = DOM.$('.action-bar-container');
		this._container.appendChild(this._actionBarContainer);
		this._actionBar = new ActionBar(this._actionBarContainer, {
			orientation: ActionsOrientation.VERTICAL, context: this
		});


		const actions = [
			new SavePlanFile(),
			new OpenPlanFile(),
			new OpenQueryAction(),
			new SearchNodeAction(),
			new ZoomInAction(),
			new ZoomOutAction(),
			new ZoomToFitAction(),
			new CustomZoomAction(),
			new PropertiesAction(),
		];
		this._actionBar.pushAction(actions, { icon: true, label: false });

		// Setting up context menu
		const self = this;
		this._container.oncontextmenu = (e: MouseEvent) => {
			if (actions) {
				this._contextMenuService.showContextMenu({
					getAnchor: () => {
						return {
							x: e.x,
							y: e.y
						};
					},
					getActions: () => actions,
					getActionsContext: () => (self)
				});
			}
		};
	}

	getHorizontalSashTop(sash: Sash): number {
		return 0;
	}
	getHorizontalSashLeft?(sash: Sash): number {
		return 0;
	}
	getHorizontalSashWidth?(sash: Sash): number {
		return this._container.clientWidth;
	}

	private populate(node: InternalExecutionPlanNode, diagramNode: any): any {
		diagramNode.label = node.subtext.join(this.textResourcePropertiesService.getEOL(undefined));
		diagramNode.tooltipTitle = node.name;
		const nodeId = this.createGraphElementId();
		diagramNode.id = nodeId;
		node.id = nodeId;

		if (node.properties && node.properties.length > 0) {
			diagramNode.metrics = this.populateProperties(node.properties);
		}

		if (node.type) {
			diagramNode.icon = node.type;
		}

		if (node.edges) {
			diagramNode.edges = [];
			for (let i = 0; i < node.edges.length; i++) {
				diagramNode.edges.push(this.populateEdges(node.edges[i], new Object()));
			}
		}

		if (node.children) {
			diagramNode.children = [];
			for (let i = 0; i < node.children.length; ++i) {
				diagramNode.children.push(this.populate(node.children[i], new Object()));
			}
		}

		if (node.badges) {
			diagramNode.badges = [];
			for (let i = 0; i < node.badges.length; i++) {
				diagramNode.badges.push(this.getBadgeTypeString(node.badges[i].type));
			}
		}

		if (node.description) {
			diagramNode.description = node.description;
		}
		return diagramNode;
	}

	private getBadgeTypeString(badgeType: sqlExtHostType.executionPlan.BadgeType): {
		type: string,
		tooltip: string
	} | undefined {
		/**
		 * TODO: Need to figure out if tooltip have to be removed. For now, they are empty
		 */
		switch (badgeType) {
			case sqlExtHostType.executionPlan.BadgeType.Warning:
				return {
					type: 'warning',
					tooltip: ''
				};
			case sqlExtHostType.executionPlan.BadgeType.CriticalWarning:
				return {
					type: 'criticalWarning',
					tooltip: ''
				};
			case sqlExtHostType.executionPlan.BadgeType.Parallelism:
				return {
					type: 'parallelism',
					tooltip: ''
				};
			default:
				return undefined;
		}
	}

	private populateEdges(edge: InternalExecutionPlanEdge, diagramEdge: any) {
		diagramEdge.label = '';
		const edgeId = this.createGraphElementId();
		diagramEdge.id = edgeId;
		edge.id = edgeId;
		diagramEdge.metrics = this.populateProperties(edge.properties);
		diagramEdge.weight = Math.max(0.5, Math.min(0.5 + 0.75 * Math.log10(edge.rowCount), 6));
		return diagramEdge;
	}

	private populateProperties(props: azdata.executionPlan.ExecutionPlanGraphElementProperty[]) {
		return props.filter(e => isString(e.displayValue) && e.showInTooltip)
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map(e => {
				this.graphElementPropertiesSet.add(e.name);
				return {
					name: e.name,
					value: e.displayValue,
					isLongString: e.positionAtBottom
				};
			});
	}

	private createGraphElementId(): string {
		this.uniqueElementId += 1;
		return `element-${this.uniqueElementId}`;
	}

	private createPlanDiagram(container: HTMLElement) {
		let diagramRoot: any = new Object();
		let graphRoot: azdata.executionPlan.ExecutionPlanNode = this._graphModel.root;

		this.populate(graphRoot, diagramRoot);
		this.azdataGraphDiagram = new azdataGraph.azdataQueryPlan(container, diagramRoot, executionPlanNodeIconPaths, badgeIconPaths);

		this.azdataGraphDiagram.graph.setCellsMovable(false); // preventing drag and drop of graph nodes.
		this.azdataGraphDiagram.graph.setCellsDisconnectable(false); // preventing graph edges to be disconnected from source and target nodes.

		this.azdataGraphDiagram.graph.addListener('click', (sender, evt) => {
			// Updating properties view table on node clicks
			const cell = evt.properties['cell'];
			if (cell) {
				this.propertiesView.graphElement = this.searchNodes(cell.id);
			} else if (!this.azdataGraphDiagram.graph.getSelectionCell()) {
				const root = this.azdataGraphDiagram.graph.model.getCell(diagramRoot.id);
				this.azdataGraphDiagram.graph.getSelectionModel().setCell(root);
				this.propertiesView.graphElement = this.searchNodes(diagramRoot.id);
				evt.consume();
			} else {
				evt.consume();
			}
		});

		registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
			const iconBackground = theme.getColor(editorBackground);
			if (iconBackground) {
				this.azdataGraphDiagram.setIconBackgroundColor(iconBackground);
			}

			const iconLabelColor = theme.getColor(foreground);
			if (iconLabelColor) {
				this.azdataGraphDiagram.setTextFontColor(iconLabelColor);
				this.azdataGraphDiagram.setEdgeColor(iconLabelColor);
			}
		});
	}

	public set graphModel(graph: azdata.executionPlan.ExecutionPlanGraph | undefined) {
		this._graphModel = graph;
		if (this._graphModel) {
			this.planHeader.graphIndex = this._graphIndex;
			this.planHeader.query = graph.query;
			if (graph.recommendations) {
				this.planHeader.recommendations = graph.recommendations;
			}
			let diagramContainer = DOM.$('.diagram');
			this.createPlanDiagram(diagramContainer);

			/**
			 * We do not want to scroll the diagram through mouse wheel.
			 * Instead, we pass this event to parent control. So, when user
			 * uses the scroll wheel, they scroll through graphs present in
			 * the graph control. To scroll the individual graphs, users should
			 * use the scroll bars.
			 */
			diagramContainer.addEventListener('wheel', e => {
				this._parent.scrollTop += e.deltaY;
				//Hiding all tooltips when we scroll.
				const element = document.getElementsByClassName('mxTooltip');
				for (let i = 0; i < element.length; i++) {
					(<HTMLElement>element[i]).style.visibility = 'hidden';
				}
				e.preventDefault();
				e.stopPropagation();
			});

			this._planContainer.appendChild(diagramContainer);

			this.propertiesView.graphElement = this._graphModel.root;
		}
	}

	public get graphModel(): azdata.executionPlan.ExecutionPlanGraph | undefined {
		return this._graphModel;
	}

	public openQuery() {
		return this._instantiationService.invokeFunction(openNewQuery, undefined, this.graphModel.query, RunQueryOnConnectionMode.none).then();
	}

	public async openGraphFile() {
		const input = this._untitledEditorService.create({ mode: this.graphModel.graphFile.graphFileType, initialValue: this.graphModel.graphFile.graphFileContent });
		await input.resolve();
		await this._instantiationService.invokeFunction(formatDocumentWithSelectedProvider, input.textEditorModel, FormattingMode.Explicit, Progress.None, CancellationToken.None);
		input.setDirty(false);
		this.editorService.openEditor(input);
	}


	public searchNodes(searchId: string): InternalExecutionPlanNode | InternalExecutionPlanEdge | undefined {
		let stack: InternalExecutionPlanNode[] = [];
		stack.push(this._graphModel.root);
		while (stack.length !== 0) {
			const currentNode = stack.pop();
			if (currentNode.id === searchId) {
				return currentNode;
			}
			stack.push(...currentNode.children);
			const resultEdge = currentNode.edges.find(e => (<InternalExecutionPlanEdge>e).id === searchId);
			if (resultEdge) {
				return resultEdge;
			}
		}
		return undefined;
	}
}

class OpenQueryAction extends Action {
	public static ID = 'ep.OpenQueryAction';
	public static LABEL = localize('openQueryAction', "Open Query");

	constructor() {
		super(OpenQueryAction.ID, OpenQueryAction.LABEL, openQueryIconClassNames);
	}

	public override async run(context: ExecutionPlan): Promise<void> {
		context.openQuery();
	}
}

class PropertiesAction extends Action {
	public static ID = 'ep.propertiesAction';
	public static LABEL = localize('executionPlanPropertiesActionLabel', "Properties");

	constructor() {
		super(PropertiesAction.ID, PropertiesAction.LABEL, openPropertiesIconClassNames);
	}

	public override async run(context: ExecutionPlan): Promise<void> {
		context.propertiesView.toggleVisibility();
	}
}

class ZoomInAction extends Action {
	public static ID = 'ep.ZoomInAction';
	public static LABEL = localize('executionPlanZoomInActionLabel', "Zoom In");

	constructor() {
		super(ZoomInAction.ID, ZoomInAction.LABEL, zoomInIconClassNames);
	}

	public override async run(context: ExecutionPlan): Promise<void> {
		context.azdataGraphDiagram.graph.zoomIn();
	}
}

class ZoomOutAction extends Action {
	public static ID = 'ep.ZoomOutAction';
	public static LABEL = localize('executionPlanZoomOutActionLabel', "Zoom Out");

	constructor() {
		super(ZoomOutAction.ID, ZoomOutAction.LABEL, zoomOutIconClassNames);
	}

	public override async run(context: ExecutionPlan): Promise<void> {
		context.azdataGraphDiagram.graph.zoomOut();
	}
}

class ZoomToFitAction extends Action {
	public static ID = 'ep.FitGraph';
	public static LABEL = localize('executionPlanFitGraphLabel', "Zoom to fit");

	constructor() {
		super(ZoomToFitAction.ID, ZoomToFitAction.LABEL, zoomToFitIconClassNames);
	}

	public override async run(context: ExecutionPlan): Promise<void> {
		context.azdataGraphDiagram.graph.fit();
		context.azdataGraphDiagram.graph.view.rendering = true;
		context.azdataGraphDiagram.graph.refresh();
	}
}

class SavePlanFile extends Action {
	public static ID = 'ep.saveXML';
	public static LABEL = localize('executionPlanSavePlanXML', "Save Plan File");

	constructor() {
		super(SavePlanFile.ID, SavePlanFile.LABEL, savePlanIconClassNames);
	}

	public override async run(context: ExecutionPlan): Promise<void> {
		const workspaceFolders = await context.workspaceContextService.getWorkspace().folders;
		const defaultFileName = 'plan';
		let currentWorkSpaceFolder: URI;
		if (workspaceFolders.length !== 0) {
			currentWorkSpaceFolder = workspaceFolders[0].uri;
			currentWorkSpaceFolder = URI.joinPath(currentWorkSpaceFolder, defaultFileName); //appending default file name to workspace uri
		} else {
			currentWorkSpaceFolder = URI.parse(defaultFileName); // giving default name
		}
		const saveFileUri = await context.fileDialogService.showSaveDialog({
			filters: [
				{
					extensions: ['sqlplan'], //TODO: Get this extension from provider
					name: localize('executionPlan.SaveFileDescription', 'Execution Plan Files') //TODO: Get the names from providers.
				}
			],
			defaultUri: currentWorkSpaceFolder // If no workspaces are opened this will be undefined
		});
		if (saveFileUri) {
			await context.fileService.writeFile(saveFileUri, VSBuffer.fromString(context.graphModel.graphFile.graphFileContent));
		}
	}
}

class CustomZoomAction extends Action {
	public static ID = 'ep.customZoom';
	public static LABEL = localize('executionPlanCustomZoom', "Custom Zoom");

	constructor() {
		super(CustomZoomAction.ID, CustomZoomAction.LABEL, customZoomIconClassNames);
	}

	public override async run(context: ExecutionPlan): Promise<void> {
		context.planActionView.toggleWidget(context._instantiationService.createInstance(CustomZoomWidget, context));
	}
}

class SearchNodeAction extends Action {
	public static ID = 'ep.searchNode';
	public static LABEL = localize('executionPlanSearchNodeAction', "Find Node");

	constructor() {
		super(SearchNodeAction.ID, SearchNodeAction.LABEL, searchIconClassNames);
	}

	public override async run(context: ExecutionPlan): Promise<void> {
		context.planActionView.toggleWidget(context._instantiationService.createInstance(NodeSearchWidget, context));
	}
}

class OpenPlanFile extends Action {
	public static ID = 'ep.openGraphFile';
	public static Label = localize('executionPlanOpenGraphFile', "Show Query Plan XML"); //TODO: add a contribution point for providers to set this text

	constructor() {
		super(OpenPlanFile.ID, OpenPlanFile.Label, openPlanFileIconClassNames);
	}

	public override async run(context: ExecutionPlan): Promise<void> {
		await context.openGraphFile();
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const recommendationsColor = theme.getColor(textLinkForeground);
	if (recommendationsColor) {
		collector.addRule(`
		.eps-container .execution-plan .plan .header .recommendations {
			color: ${recommendationsColor};
		}
		`);
	}
	const shadow = theme.getColor(widgetShadow);
	if (shadow) {
		collector.addRule(`
		.eps-container .execution-plan .plan .plan-action-container .child {
			box-shadow: 0 0 8px 2px ${shadow};
		}
		`);
	}

	const menuBackgroundColor = theme.getColor(listHoverBackground);
	if (menuBackgroundColor) {
		collector.addRule(`
		.eps-container .execution-plan .plan .header,
		.eps-container .execution-plan .properties .title,
		.eps-container .execution-plan .properties .table-action-bar {
			background-color: ${menuBackgroundColor};
		}
		`);
	}

	const widgetBackgroundColor = theme.getColor(editorWidgetBackground);
	if (widgetBackgroundColor) {
		collector.addRule(`
		.eps-container .execution-plan .plan .plan-action-container .child,
		.mxTooltip {
			background-color: ${widgetBackgroundColor};
		}
		`);
	}

	const widgetBorderColor = theme.getColor(contrastBorder);
	if (widgetBorderColor) {
		collector.addRule(`
		.eps-container .execution-plan .plan .plan-action-container .child,
		.eps-container .execution-plan .plan .header,
		.eps-container .execution-plan .properties .title,
		.eps-container .execution-plan .properties .table-action-bar,
		.mxTooltip {
			border: 1px solid ${widgetBorderColor};
		}
		`);
	}

	const textColor = theme.getColor(foreground);
	if (textColor) {
		collector.addRule(`
		.mxTooltip  {
			color: ${textColor};
		}
		`);
	}
});
