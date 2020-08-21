/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

class RunTimeInformation {
	constructor(public runtimePerThreads?: RuntimePerThread[]) { }

	public get actualRows(): number {
		let total = 0;
		if (this.runtimePerThreads) {
			this.runtimePerThreads.forEach(element => {
				total += element.actualRow ?? 0;
			});
		}

		return total;
	}

	public get actualExecutions(): number {
		let total = 0;
		if (this.runtimePerThreads) {
			this.runtimePerThreads.forEach(element => {
				total += element.actualExecutions ?? 0;
			});
		}
		return total;
	}
}

interface RuntimePerThread {
	threadId?: number;
	actualRow?: number;
	actualExecutionMode?: string;
	actualExecutions?: number;
}

class IndexObject {
	public database?: string;
	public schema?: string;
	public table?: string;
	public index?: string;
	public indexKind?: string;

	public get title() {
		let title: string = '';
		if (this.database && this.schema && this.table) {
			title = `${this.database}.${this.schema}.${this.table}.${this.index}`;
			if (this.indexKind && this.indexKind !== '') {
				title += `(${this.indexKind})`;
			}
		}
		return title;
	}
}

class PlanNode {
	private childrenNodes: PlanNode[] = [];

	public root?: PlanNode;
	public subtreeCost?: number;
	public parent?: PlanNode;
	public physicalOp?: string;
	public logicalOp?: string;
	public id?: number;
	public estimateRows?: string;
	public estimateIo?: string;
	public estimateCpu?: string;
	public parallel?: boolean;
	public partitioned?: boolean;
	public estimateRewinds?: string;
	public estimateRebinds?: string;
	public runtimeInfo?: RunTimeInformation;
	public indexObject?: IndexObject;

	public addChildren(children: PlanNode[]): void {
		if (children) {
			children.forEach(element => {
				element.parent = this;
			});
		}
		this.childrenNodes = children;
	}

	public get totalSubTreeCost(): number {
		let total = this.subtreeCost ?? 0;
		if (total === 0) {
			this.children.forEach(element => {
				total += element.subtreeCost ?? 0;
			});
		}
		return total;
	}

	public get children(): PlanNode[] {
		return this.childrenNodes;
	}

	public get cost(): number {
		let total = this.subtreeCost ?? 0;
		if (this.children && total !== 0) {
			this.children.forEach(element => {
				total -= element.subtreeCost ?? 0;
			});
		}
		return total;
	}

	public get relativeCost(): number {
		let overallCost = this.root?.totalSubTreeCost ?? 0;
		return overallCost > 0 ? this.cost / overallCost : 0;
	}

	public get estimatedOperatorCost(): number {
		return Math.round(this.relativeCost * 100);
	}

	public get estimatedSubtreeCost(): number {
		let total = this.estimatedOperatorCost;
		if (this.children) {
			this.children.forEach(element => {
				total += element.estimatedSubtreeCost;
			});
		}
		return total;
	}

	public get title(): string {
		if (this.physicalOp === this.logicalOp) {
			return this.physicalOp ?? '';
		} else {
			return `${this.physicalOp}(${this.logicalOp})`;
		}
	}

	public get treeViewPrefix(): string {
		return this.parent === undefined ? '' : `${this.parent.treeViewPrefix}-----`;
	}

	public get treeViewTitle(): string {
		return `${this.treeViewPrefix}${this.title}`;
	}
}

export class PlanXmlParser {
	public parser: DOMParser = new DOMParser();
	public doc?: Document;
	public planXml?: string;
	public root?: PlanNode;

	constructor(planXml: string) {

		this.doc = this.parser.parseFromString(planXml, 'application/xml');
		this.planXml = planXml;
		let queryPlanNode = this.findChildren(this.doc.children[0], 'QueryPlan');
		if (queryPlanNode && queryPlanNode.length > 0) {
			this.root = new PlanNode();
			let ops = this.createPlanNodes(queryPlanNode[0], 'RelOp', this.root);

			this.root.addChildren(ops);
			this.root.subtreeCost = 0;
		}
	}

	public get topOperations(): PlanNode[] {
		let operations: PlanNode[] = [];
		if (this.root && this.root.children) {
			operations = this.addOperationsToList(operations, this.root.children);
			operations.sort((a, b) => {
				if (a.estimatedOperatorCost > b.estimatedOperatorCost) {
					return -1;
				} else if (a.estimatedOperatorCost <= b.estimatedOperatorCost) {
					return 1;
				} else {
					return 0;
				}
			});
		}
		return operations;
	}

	public get toTreeViewList(): PlanNode[] {
		let operations: PlanNode[] = [];
		if (this.root) {
			operations = this.addOperationsToList(operations, this.root.children);
		}

		return operations;
	}

	private addOperationsToList(list: PlanNode[], nodes: PlanNode[]): PlanNode[] {
		list = list.concat(nodes);
		nodes.forEach(element => {
			list = this.addOperationsToList(list, element.children);
		});
		return list;
	}

	private findChildren(element: Element, elementName: string, untilNode: string | undefined = undefined): Element[] | undefined {
		let elements: Element[] = [];
		if (element === undefined) {
			return undefined;
		}

		for (let index = 0; index < element.childNodes.length; index++) {
			if (element.childNodes[index].nodeName.toLocaleLowerCase() === elementName.toLocaleLowerCase()) {
				elements = elements.concat(element.children[index]);
			}
		}
		if (elements.length > 0) {
			return elements;
		}
		for (let index = 0; index < element.childNodes.length; index++) {
			if (untilNode && element.childNodes[index].nodeName === untilNode) {
				continue;
			}
			let result = this.findChildren(element.children[index], elementName, untilNode);
			if (result !== undefined) {
				return result;
			}
		}

		return undefined;
	}

	private createPlanNodes(element: Element, elementName: string, root: PlanNode): PlanNode[] {
		let nodePlans: PlanNode[] = [];

		let children = this.findChildren(element, elementName);
		if (children) {
			for (let index = 0; index < children.length; index++) {
				let childNode = children[index];

				let planNode = this.convertToPlanNode(childNode);
				planNode.root = root;
				planNode.addChildren(this.createPlanNodes(childNode, elementName, root));
				planNode.runtimeInfo = new RunTimeInformation();
				planNode.indexObject = new IndexObject();

				let runtimeInfoNodes = this.findChildren(childNode, 'RunTimeCountersPerThread');
				if (runtimeInfoNodes) {
					planNode.runtimeInfo.runtimePerThreads = runtimeInfoNodes.map(x => this.convertToRuntimeInfo(x));
				}

				let objectNodes = this.findChildren(childNode, 'Object', 'RelOp');
				if (objectNodes && objectNodes.length > 0) {
					planNode.indexObject = this.convertToObject(objectNodes[0]);
				}
				nodePlans = nodePlans.concat(planNode);
			}
		}

		return nodePlans;
	}

	private convertToPlanNode(element: Element): PlanNode {
		let planNode = new PlanNode();
		planNode.id = Number(this.findAttribute(element.attributes, 'NodeId'));
		planNode.logicalOp = this.findAttribute(element.attributes, 'LogicalOp');
		planNode.physicalOp = this.findAttribute(element.attributes, 'PhysicalOp');
		planNode.subtreeCost = Number(this.findAttribute(element.attributes, 'EstimatedTotalSubtreeCost'));
		planNode.estimateRows = this.findAttribute(element.attributes, 'EstimateRows');
		planNode.estimateCpu = this.findAttribute(element.attributes, 'EstimateCPU');
		planNode.estimateIo = this.findAttribute(element.attributes, 'EstimateIO');
		planNode.estimateRebinds = this.findAttribute(element.attributes, 'EstimateRebinds');
		planNode.estimateRewinds = this.findAttribute(element.attributes, 'EstimateRewinds');
		planNode.parallel = this.findAttribute(element.attributes, 'Parallel') === '1';
		planNode.partitioned = this.findAttribute(element.attributes, 'Partitioned') === '1';
		return planNode;
	}

	private convertToRuntimeInfo(element: Element): RuntimePerThread {
		return {
			actualExecutionMode: this.findAttribute(element.attributes, 'ActualExecutionMode'),
			actualExecutions: Number(this.findAttribute(element.attributes, 'ActualExecutions')),
			actualRow: Number(this.findAttribute(element.attributes, 'ActualRows')),
			threadId: Number(this.findAttribute(element.attributes, 'Thread'))
		};
	}

	private convertToObject(element: Element): IndexObject {
		let objectNode = new IndexObject();
		objectNode.database = this.findAttribute(element.attributes, 'Database');
		objectNode.index = this.findAttribute(element.attributes, 'Index');
		objectNode.indexKind = this.findAttribute(element.attributes, 'IndexKind');
		objectNode.schema = this.findAttribute(element.attributes, 'Schema');
		objectNode.table = this.findAttribute(element.attributes, 'Table');
		return objectNode;
	}

	private findAttribute(attributes: NamedNodeMap, attName: string): string | undefined {
		for (let index = 0; index < attributes.length; index++) {
			let attribute = attributes[index];
			if (attribute.name === attName) {
				return attribute.value;
			}
		}
		return undefined;
	}
}
