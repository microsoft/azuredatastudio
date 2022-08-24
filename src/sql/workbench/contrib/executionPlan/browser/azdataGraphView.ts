/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataGraphModule from 'azdataGraph';
import * as azdata from 'azdata';
import * as sqlExtHostType from 'sql/workbench/api/common/sqlExtHostTypes';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { isString } from 'vs/base/common/types';
import { badgeIconPaths, collapseExpandNodeIconPaths, executionPlanNodeIconPaths } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { localize } from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { foreground } from 'vs/platform/theme/common/colorRegistry';
import { generateUuid } from 'vs/base/common/uuid';
const azdataGraph = azdataGraphModule();

/**
 * This view holds the azdataGraph diagram and provides different
 * methods to manipulate the azdataGraph
 */
export class AzdataGraphView {

	private _diagram: any;
	private _diagramModel: AzDataGraphCell;
	private _cellInFocus: AzDataGraphCell;

	private _graphElementPropertiesSet: Set<string> = new Set();

	private _onElementSelectedEmitter: Emitter<InternalExecutionPlanElement> = new Emitter<InternalExecutionPlanElement>();
	public onElementSelected: Event<InternalExecutionPlanElement>;

	constructor(
		private _parentContainer: HTMLElement,
		private _executionPlan: azdata.executionPlan.ExecutionPlanGraph,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService,
	) {
		this._diagramModel = this.populate(this._executionPlan.root);

		let queryPlanConfiguration = {
			container: this._parentContainer,
			queryPlanGraph: this._diagramModel,
			iconPaths: executionPlanNodeIconPaths,
			badgeIconPaths: badgeIconPaths,
			expandCollapsePaths: collapseExpandNodeIconPaths
		};
		this._diagram = new azdataGraph.azdataQueryPlan(queryPlanConfiguration);

		this.setGraphProperties();
		this._cellInFocus = this._diagram.graph.getSelectionCell();
		this.initializeGraphEvents();
	}

	private setGraphProperties(): void {
		this._diagram.graph.setCellsMovable(false); // preventing drag and drop of graph nodes.
		this._diagram.graph.setCellsDisconnectable(false); // preventing graph edges to be disconnected from source and target nodes.
		this._diagram.graph.tooltipHandler.delay = 700; // increasing delay for tooltips

		registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
			const iconLabelColor = theme.getColor(foreground);
			if (iconLabelColor) {
				this._diagram.setTextFontColor(iconLabelColor);
				this._diagram.setEdgeColor(iconLabelColor);
			}
		});
	}

	private initializeGraphEvents(): void {
		this.onElementSelected = this._onElementSelectedEmitter.event;
		this._diagram.graph.getSelectionModel().addListener('change', (sender, evt) => {
			if (evt.properties?.removed) {
				if (this._cellInFocus?.id === evt.properties.removed[0].id) {
					return;
				}
				const newSelection = evt.properties.removed[0];
				this._onElementSelectedEmitter.fire(this.getElementById(newSelection.id));
				this.centerElement(this.getElementById(newSelection.id));
				this._cellInFocus = evt.properties.removed[0];
			} else {
				if (evt.properties?.added) {
					const getPreviousSelection = evt.properties.added[0];
					this.selectElement(this.getElementById(getPreviousSelection.id));
				}
			}
		});
	}

	/**
	 * Selects an execution plan node/edge in the graph diagram.
	 * @param element  Element to be selected
	 * @param bringToCenter Check if the selected element has to be brought into the center of this view
	 */
	public selectElement(element: InternalExecutionPlanElement | undefined, bringToCenter: boolean = false): void {
		let cell;
		if (element) {
			cell = this._diagram.graph.model.getCell(element.id);
		} else {
			cell = this._diagram.graph.model.getCell((<azdata.executionPlan.ExecutionPlanNode>this._executionPlan.root).id);
		}
		this._diagram.graph.getSelectionModel().setCell(cell);
		if (bringToCenter) {
			this.centerElement(element);
		}
	}

	/**
	 * returns the currently selected graph element.
	 */
	public getSelectedElement(): InternalExecutionPlanElement | undefined {
		const cell = this._diagram.graph.getSelectionCell();
		if (cell?.id) {
			return this.getElementById(cell.id);
		}
		return undefined;
	}

	/**
	 * Zooms in to the diagram.
	 */
	public zoomIn(): void {
		this._diagram.zoomIn();
	}

	/**
	 * Zooms out of the diagram
	 */
	public zoomOut(): void {
		this._diagram.zoomOut();
	}

	/**
	 * Fits the diagram into the parent container size.
	 */
	public zoomToFit(): void {
		this._diagram.zoomToFit();
	}

	/**
	 * Gets the current zoom level of the diagram.
	 */
	public getZoomLevel(): number {
		return this._diagram.graph.view.getScale() * 100;
	}

	/**
	 * Sets the zoom level of the diagram
	 * @param level The scale factor to be be applied to the diagram.
	 */
	public setZoomLevel(level: number): void {
		if (level < 1) {
			throw new Error(localize('invalidExecutionPlanZoomError', "Zoom level cannot be 0 or negative"));
		}
		this._diagram.zoomTo(level);
	}

	/**
	 * Get the diagram element by its id
	 * @param id id of the diagram element
	 */
	public getElementById(id: string): InternalExecutionPlanElement | undefined {
		const nodeStack: azdata.executionPlan.ExecutionPlanNode[] = [];
		nodeStack.push(this._executionPlan.root);
		while (nodeStack.length !== 0) {
			const currentNode = nodeStack.pop();
			if (currentNode.id === id) {
				return currentNode;
			}
			if (currentNode.edges) {
				for (let i = 0; i < currentNode.edges.length; i++) {
					if ((<InternalExecutionPlanEdge>currentNode.edges[i]).id === id) {
						return currentNode.edges[i];
					}
				}
			}
			nodeStack.push(...currentNode.children);
		}
		return undefined;
	}

	/**
	 * Searches the diagram nodes based on the search query provided.
	 */
	public searchNodes(searchQuery: SearchQuery): azdata.executionPlan.ExecutionPlanNode[] {
		const resultNodes: azdata.executionPlan.ExecutionPlanNode[] = [];

		const nodeStack: azdata.executionPlan.ExecutionPlanNode[] = [];
		nodeStack.push(this._executionPlan.root);

		while (nodeStack.length !== 0) {
			const currentNode = nodeStack.pop();

			const matchingProp = currentNode.properties.find(e => e.name === searchQuery.propertyName);
			let matchFound = false;
			// Searching only properties with string value.
			if (isString(matchingProp?.value)) {
				// If the search type is '=' we look for exact match and for 'contains' we look search string occurrences in prop value
				switch (searchQuery.searchType) {
					case SearchType.Equals:
						matchFound = matchingProp.value === searchQuery.value;
						break;
					case SearchType.Contains:
						matchFound = matchingProp.value.includes(searchQuery.value);
						break;
					case SearchType.GreaterThan:
						matchFound = matchingProp.value > searchQuery.value;
						break;
					case SearchType.LesserThan:
						matchFound = matchingProp.value < searchQuery.value;
						break;
					case SearchType.GreaterThanEqualTo:
						matchFound = matchingProp.value >= searchQuery.value;
						break;
					case SearchType.LesserThanEqualTo:
						matchFound = matchingProp.value <= searchQuery.value;
						break;
					case SearchType.LesserAndGreaterThan:
						matchFound = matchingProp.value < searchQuery.value || matchingProp.value > searchQuery.value;
						break;
				}
				if (matchFound) {
					resultNodes.push(currentNode);
				}
			}
			nodeStack.push(...currentNode.children);
		}
		return resultNodes;
	}


	/**
	 * Brings a graph element to the center of the parent view.
	 * @param node Node to be brought into the center
	 */
	public centerElement(node: InternalExecutionPlanElement): void {
		/**
		 * The selected graph node might be hidden/partially visible if the graph is overflowing the parent container.
		 * Apart from the obvious problems in aesthetics, user do not get a proper feedback of the search result.
		 * To solve this problem, we will have to scroll the node into view. (preferably into the center of the view)
		 * Steps for that:
		 *  1. Get the bounding rect of the node on graph.
		 *  2. Get the midpoint of the node's bounding rect.
		 *  3. Find the dimensions of the parent container.
		 *  4. Since, we are trying to position the node into center, we set the left top corner position of parent to
		 *     below x and y.
		 *  x =	node's x midpoint - half the width of parent container
		 *  y = node's y midpoint - half the height of parent container
		 * 	5. If the x and y are negative, we set them 0 as that is the minimum possible scroll position.
		 *  6. Smoothly scroll to the left top x and y calculated in step 4, 5.
		 */

		if (!node) {
			return;
		}
		const cell = this._diagram.graph.model.getCell(node.id);
		if (!cell) {
			return;
		}

		const cellRect = this._diagram.graph.getCellBounds(cell);

		const cellMidPoint: Point = {
			x: cellRect.x + cellRect.width / 2,
			y: cellRect.y + cellRect.height / 2
		};

		const graphContainer = <HTMLElement>this._diagram.graph.container;

		const diagramContainerRect = graphContainer.getBoundingClientRect();

		const leftTopScrollPoint: Point = {
			x: cellMidPoint.x - diagramContainerRect.width / 2,
			y: cellMidPoint.y - diagramContainerRect.height / 2
		};

		leftTopScrollPoint.x = leftTopScrollPoint.x < 0 ? 0 : leftTopScrollPoint.x;
		leftTopScrollPoint.y = leftTopScrollPoint.y < 0 ? 0 : leftTopScrollPoint.y;

		graphContainer.scrollTo({
			left: leftTopScrollPoint.x,
			top: leftTopScrollPoint.y,
			behavior: 'smooth'
		});
	}

	private populate(node: azdata.executionPlan.ExecutionPlanNode): AzDataGraphCell {
		let diagramNode: AzDataGraphCell = <AzDataGraphCell>{};
		diagramNode.label = node.subtext.join(this.textResourcePropertiesService.getEOL(undefined));
		diagramNode.tooltipTitle = node.name;
		diagramNode.rowCountDisplayString = node.rowCountDisplayString;
		diagramNode.costDisplayString = node.costDisplayString;
		if (!node.id.toString().startsWith(`element-`)) {
			node.id = `element-${node.id}`;
		}
		diagramNode.id = node.id;

		if (node.type) {
			diagramNode.icon = node.type;
		}

		if (node.properties) {
			diagramNode.metrics = this.populateProperties(node.properties);
		}

		if (node.badges) {
			diagramNode.badges = [];
			for (let i = 0; i < node.badges.length; i++) {
				diagramNode.badges.push(this.getBadgeTypeString(node.badges[i].type));
			}
		}

		if (node.edges) {
			diagramNode.edges = this.populateEdges(node.edges);
		}

		if (node.children) {
			diagramNode.children = [];
			for (let i = 0; i < node.children.length; ++i) {
				diagramNode.children.push(this.populate(node.children[i]));
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

	private populateProperties(props: azdata.executionPlan.ExecutionPlanGraphElementProperty[]): AzDataGraphCellMetric[] {
		props.forEach(p => {
			this._graphElementPropertiesSet.add(p.name);
		});
		return props.filter(e => isString(e.displayValue) && e.showInTooltip)
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map(e => {
				return {
					name: e.name,
					value: e.displayValue,
					isLongString: e.positionAtBottom
				};
			});
	}

	private populateEdges(edges: InternalExecutionPlanEdge[]): AzDataGraphCellEdge[] {
		return edges.map(e => {
			e.id = this.createGraphElementId();
			return {
				id: e.id,
				metrics: this.populateProperties(e.properties),
				weight: Math.max(0.5, Math.min(0.5 + 0.75 * Math.log10(e.rowCount), 6)),
				label: ''
			};
		});
	}

	private createGraphElementId(): string {
		return `element-${generateUuid()}`;
	}

	/**
	 * Gets a list of unique properties of the graph elements.
	 */
	public getUniqueElementProperties(): string[] {
		return [...this._graphElementPropertiesSet].sort();
	}

	/**
	 * Enables/Disables the graph tooltips
	 * @returns state of the tooltip after toggling
	 */
	public toggleTooltip(): boolean {
		if (this._diagram.graph.tooltipHandler.enabled) {
			this._diagram.graph.tooltipHandler.setEnabled(false);
		} else {
			this._diagram.graph.tooltipHandler.setEnabled(true);
		}
		return this._diagram.graph.tooltipHandler.enabled;
	}

	public drawSubtreePolygon(subtreeRoot: string, fillColor: string, borderColor: string): void {
		const drawPolygon = this._diagram.graph.model.getCell(`element-${subtreeRoot}`);
		this._diagram.drawPolygon(drawPolygon, fillColor, borderColor);
	}

	public clearSubtreePolygon(): void {
		this._diagram.removeDrawnPolygons();
	}

	public disableNodeCollapse(disable: boolean): void {
		this._diagram.disableNodeCollapse(disable);
	}
}

export interface InternalExecutionPlanEdge extends azdata.executionPlan.ExecutionPlanEdge {
	/**
	 * Unique internal id given to graph edge by ADS.
	 */
	id?: string;
}

export type InternalExecutionPlanElement = InternalExecutionPlanEdge | azdata.executionPlan.ExecutionPlanNode;

export interface AzDataGraphCell {
	/**
	 * Label for the azdata cell
	 */
	label: string;
	/**
	 * unique identifier for the cell
	 */
	id: string;
	/**
	 * icon for the cell
	 */
	icon: string;
	/**
	 * cost string for the cell
	 */
	costDisplayString: string;
	/**
	 * row count for the cell
	 */
	rowCountDisplayString: string;
	/**
	 * title for the cell hover tooltip
	 */
	tooltipTitle: string;
	/**
	 * metrics to be shown in the tooltip
	 */
	metrics: AzDataGraphCellMetric[];
	/**
	 * cell edges
	 */
	edges: AzDataGraphCellEdge[];
	/**
	 * child cells
	 */
	children: AzDataGraphCell[];
	/**
	 * Description to be displayed in the cell tooltip
	 */
	description: string;
	badges: AzDataGraphNodeBadge[];
}

export interface AzDataGraphNodeBadge {
	type: string;
	tooltip: string;
}

export interface AzDataGraphCellMetric {
	/**
	 * name of the metric
	 */
	name: string;
	/**
	 * display value of the metric
	 */
	value: string;
	/**
	 * flag that indicates if the display property is a long string
	 * long strings will be displayed at the bottom
	 */
	isLongString: boolean;
}

export interface AzDataGraphCellEdge {
	/**
	 * Label for the edge
	 */
	label: string;
	/**
	 * Unique identifier for the edge
	 */
	id: string;
	/**
	 * weight of the edge. This value determines the edge thickness
	 */
	weight: number;
	/**
	 * metrics to be shown in the edge tooltip
	 */
	metrics: AzDataGraphCellMetric[];
}

interface Point {
	x: number;
	y: number;
}

export enum SearchType {
	Equals,
	Contains,
	LesserThan,
	GreaterThan,
	GreaterThanEqualTo,
	LesserThanEqualTo,
	LesserAndGreaterThan
}
export interface SearchQuery {
	/**
	 * property name to be searched
	 */
	propertyName: string,
	/**
	 * expected value of the property
	 */
	value: string,
	/**
	 * Type of search to be performed
	 */
	searchType: SearchType
}
