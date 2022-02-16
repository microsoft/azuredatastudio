/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/queryPlan2';
import type * as azdata from 'azdata';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { localize } from 'vs/nls';
import { dispose } from 'vs/base/common/lifecycle';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import * as DOM from 'vs/base/browser/dom';
import * as azdataGraphModule from 'azdataGraph';
import { customZoomIconClassNames, openPlanFileIconClassNames, openPropertiesIconClassNames, openQueryIconClassNames, queryPlanNodeIconPaths, savePlanIconClassNames, searchIconClassNames, zoomInIconClassNames, zoomOutIconClassNames, zoomToFitIconClassNames } from 'sql/workbench/contrib/queryplan2/browser/constants';
import { isString } from 'vs/base/common/types';
import { PlanHeader } from 'sql/workbench/contrib/queryplan2/browser/planHeader';
import { QueryPlanPropertiesView } from 'sql/workbench/contrib/queryplan2/browser/queryPlanPropertiesView';
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
import { QueryPlanWidgetController } from 'sql/workbench/contrib/queryplan2/browser/queryPlanWidgetController';
import { CustomZoomWidget } from 'sql/workbench/contrib/queryplan2/browser/widgets/customZoomWidget';
import { NodeSearchWidget } from 'sql/workbench/contrib/queryplan2/browser/widgets/nodeSearchWidget';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IFileService } from 'vs/platform/files/common/files';
import { VSBuffer } from 'vs/base/common/buffer';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';

let azdataGraph = azdataGraphModule();

export interface InternalExecutionPlanNode extends azdata.ExecutionPlanNode {
	/**
	 * Unique internal id given to graph node by ADS.
	 */
	id?: string;
}

export interface InternalExecutionPlanEdge extends azdata.ExecutionPlanEdge {
	/**
	 * Unique internal id given to graph edge by ADS.
	 */
	id?: string;
}

export class QueryPlan2Tab implements IPanelTab {
	public readonly title = localize('queryPlanTitle', "Query Plan (Preview)");
	public readonly identifier = 'QueryPlan2Tab';
	public readonly view: QueryPlan2View;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		this.view = instantiationService.createInstance(QueryPlan2View);
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}

}

export class QueryPlan2View implements IPanelView {
	private _qps?: QueryPlan2[] = [];
	private _graphs?: azdata.ExecutionPlanGraph[] = [];
	private _container = DOM.$('.qps-container');

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService,
	) {
	}

	public render(container: HTMLElement): void {
		container.appendChild(this._container);
	}

	dispose() {
		this._container.remove();
		delete this._qps;
		delete this._graphs;
	}

	public layout(dimension: DOM.Dimension): void {
	}

	public clear() {
		this._qps = [];
		this._graphs = [];
		DOM.clearNode(this._container);
	}

	public addGraphs(newGraphs: azdata.ExecutionPlanGraph[] | undefined) {
		if (newGraphs) {
			newGraphs.forEach(g => {
				const qp2 = this.instantiationService.createInstance(QueryPlan2, this._container, this._qps.length + 1);
				qp2.graphModel = g;
				this._qps.push(qp2);
				this._graphs.push(g);
				this.updateRelativeCosts();
			});
		}
	}

	private updateRelativeCosts() {
		const sum = this._graphs.reduce((prevCost: number, cg) => {
			return prevCost += cg.root.subTreeCost + cg.root.cost;
		}, 0);

		if (sum > 0) {
			this._qps.forEach(qp => {
				qp.planHeader.relativeCost = ((qp.graphModel.root.subTreeCost + qp.graphModel.root.cost) / sum) * 100;
			});
		}
	}
}

export class QueryPlan2 implements ISashLayoutProvider {
	private _graphModel?: azdata.ExecutionPlanGraph;

	private _container: HTMLElement;

	private _actionBarContainer: HTMLElement;
	private _actionBar: ActionBar;

	public planHeader: PlanHeader;
	private _planContainer: HTMLElement;
	private _planHeaderContainer: HTMLElement;

	public propertiesView: QueryPlanPropertiesView;
	private _propContainer: HTMLElement;

	private _planActionContainer: HTMLElement;
	public planActionView: QueryPlanWidgetController;

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
		@IWorkspaceContextService public workspaceContextService: IWorkspaceContextService
	) {
		// parent container for query plan.
		this._container = DOM.$('.query-plan');
		this._parent.appendChild(this._container);
		const sashContainer = DOM.$('.query-plan-sash');
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
		this.propertiesView = new QueryPlanPropertiesView(this._propContainer, this._themeService);

		this._planActionContainer = DOM.$('.plan-action-container');
		this._planContainer.appendChild(this._planActionContainer);
		this.planActionView = new QueryPlanWidgetController(this._planActionContainer);

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
		diagramNode.label = node.name;
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

		if (node.description) {
			diagramNode.description = node.description;
		}
		return diagramNode;
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

	private populateProperties(props: azdata.ExecutionPlanGraphElementProperty[]) {
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
		let graphRoot: azdata.ExecutionPlanNode = this._graphModel.root;

		this.populate(graphRoot, diagramRoot);
		this.azdataGraphDiagram = new azdataGraph.azdataQueryPlan(container, diagramRoot, queryPlanNodeIconPaths);

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


	public set graphModel(graph: azdata.ExecutionPlanGraph | undefined) {
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

	public get graphModel(): azdata.ExecutionPlanGraph | undefined {
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
	public static ID = 'qp.OpenQueryAction';
	public static LABEL = localize('openQueryAction', "Open Query");

	constructor() {
		super(OpenQueryAction.ID, OpenQueryAction.LABEL, openQueryIconClassNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
		context.openQuery();
	}
}

class PropertiesAction extends Action {
	public static ID = 'qp.propertiesAction';
	public static LABEL = localize('queryPlanPropertiesActionLabel', "Properties");

	constructor() {
		super(PropertiesAction.ID, PropertiesAction.LABEL, openPropertiesIconClassNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
		context.propertiesView.toggleVisibility();
	}
}

class ZoomInAction extends Action {
	public static ID = 'qp.ZoomInAction';
	public static LABEL = localize('queryPlanZoomInActionLabel', "Zoom In");

	constructor() {
		super(ZoomInAction.ID, ZoomInAction.LABEL, zoomInIconClassNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
		context.azdataGraphDiagram.graph.zoomIn();
	}
}

class ZoomOutAction extends Action {
	public static ID = 'qp.ZoomOutAction';
	public static LABEL = localize('queryPlanZoomOutActionLabel', "Zoom Out");

	constructor() {
		super(ZoomOutAction.ID, ZoomOutAction.LABEL, zoomOutIconClassNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
		context.azdataGraphDiagram.graph.zoomOut();
	}
}

class ZoomToFitAction extends Action {
	public static ID = 'qp.FitGraph';
	public static LABEL = localize('queryPlanFitGraphLabel', "Zoom to fit");

	constructor() {
		super(ZoomToFitAction.ID, ZoomToFitAction.LABEL, zoomToFitIconClassNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
		context.azdataGraphDiagram.graph.fit();
		context.azdataGraphDiagram.graph.view.rendering = true;
		context.azdataGraphDiagram.graph.refresh();
	}
}

class SavePlanFile extends Action {
	public static ID = 'qp.saveXML';
	public static LABEL = localize('queryPlanSavePlanXML', "Save Plan File");

	constructor() {
		super(SavePlanFile.ID, SavePlanFile.LABEL, savePlanIconClassNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
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
					name: localize('queryPlan.SaveFileDescription', 'Execution Plan Files') //TODO: Get the names from providers.
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
	public static ID = 'qp.customZoom';
	public static LABEL = localize('queryPlanCustomZoom', "Custom Zoom");

	constructor() {
		super(CustomZoomAction.ID, CustomZoomAction.LABEL, customZoomIconClassNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
		context.planActionView.toggleWidget(context._instantiationService.createInstance(CustomZoomWidget, context));
	}
}

class SearchNodeAction extends Action {
	public static ID = 'qp.searchNode';
	public static LABEL = localize('queryPlanSearchNodeAction', "Find Node");

	constructor() {
		super(SearchNodeAction.ID, SearchNodeAction.LABEL, searchIconClassNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
		context.planActionView.toggleWidget(context._instantiationService.createInstance(NodeSearchWidget, context));
	}
}

class OpenPlanFile extends Action {
	public static ID = 'qp.openGraphFile';
	public static Label = localize('queryPlanOpenGraphFile', "Show Query Plan XML"); //TODO: add a contribution point for providers to set this text

	constructor() {
		super(OpenPlanFile.ID, OpenPlanFile.Label, openPlanFileIconClassNames);
	}

	public override async run(context: QueryPlan2): Promise<void> {
		await context.openGraphFile();
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const recommendationsColor = theme.getColor(textLinkForeground);
	if (recommendationsColor) {
		collector.addRule(`
		.qps-container .query-plan .plan .header .recommendations {
			color: ${recommendationsColor};
		}
		`);
	}
	const shadow = theme.getColor(widgetShadow);
	if (shadow) {
		collector.addRule(`
		.qps-container .query-plan .plan .plan-action-container .child {
			box-shadow: 0 0 8px 2px ${shadow};
		}
		`);
	}

	const menuBackgroundColor = theme.getColor(listHoverBackground);
	if (menuBackgroundColor) {
		collector.addRule(`
		.qps-container .query-plan .plan .header,
		.qps-container .query-plan .properties .title,
		.qps-container .query-plan .properties .table-action-bar {
			background-color: ${menuBackgroundColor};
		}
		`);
	}

	const widgetBackgroundColor = theme.getColor(editorWidgetBackground);
	if (widgetBackgroundColor) {
		collector.addRule(`
		.qps-container .query-plan .plan .plan-action-container .child,
		.mxTooltip {
			background-color: ${widgetBackgroundColor};
		}
		`);
	}

	const widgetBorderColor = theme.getColor(contrastBorder);
	if (widgetBorderColor) {
		collector.addRule(`
		.qps-container .query-plan .plan .plan-action-container .child,
		.qps-container .query-plan .plan .header,
		.qps-container .query-plan .properties .title,
		.qps-container .query-plan .properties .table-action-bar,
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
