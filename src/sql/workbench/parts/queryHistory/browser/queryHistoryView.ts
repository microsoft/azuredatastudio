/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as errors from 'vs/base/common/errors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { Disposable } from 'vs/base/common/lifecycle';
import { DefaultFilter, DefaultDragAndDrop, DefaultAccessibilityProvider } from 'vs/base/parts/tree/browser/treeDefaults';
import { localize } from 'vs/nls';
import { hide, $, append } from 'vs/base/browser/dom';
import { QueryEventType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { QueryHistoryRenderer } from 'sql/workbench/parts/queryHistory/browser/queryHistoryRenderer';
import { QueryHistoryDataSource } from 'sql/workbench/parts/queryHistory/browser/queryHistoryDataSource';
import { QueryHistoryController } from 'sql/workbench/parts/queryHistory/browser/queryHistoryController';
import { QueryHistoryActionProvider } from 'sql/workbench/parts/queryHistory/browser/queryHistoryActionProvider';
import { QueryHistoryNode, QueryStatus } from 'sql/platform/queryHistory/common/queryHistoryNode';
import { IExpandableTree } from 'sql/workbench/parts/objectExplorer/browser/treeUpdateUtils';
import { IQueryModelService, IQueryEvent } from 'sql/platform/query/common/queryModel';
import { URI } from 'vs/base/common/uri';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IModelService } from 'vs/editor/common/services/modelService';
import { Range } from 'vs/editor/common/core/range';
/**
 * QueryHistoryView implements the dynamic tree view for displaying Query History
 */
export class QueryHistoryView extends Disposable {
	private _messages: HTMLElement;
	private _tree: ITree;
	private _nodes: QueryHistoryNode[] = [];

	constructor(
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IThemeService private _themeService: IThemeService,
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@IModelService private readonly _modelService: IModelService
	) {
		super();
	}

	/**
	 * Render the view body
	 */
	public renderBody(container: HTMLElement): void {
		// Add div to display no task executed message
		this._messages = append(container, $('div.no-queries-message'));

		const noQueriesMessage = localize('noQueriesMessage', 'No queries to display.');
		append(this._messages, $('span')).innerText = noQueriesMessage;

		this._tree = this._register(this.createQueryHistoryTree(container, this._instantiationService));
		this._register(this._tree.onDidChangeSelection((event) => this.onSelected(event)));

		// Theme styler
		this._register(attachListStyler(this._tree, this._themeService));

		this._register(this._queryModelService.onQueryEvent((e: IQueryEvent) => {

			if (e.type === QueryEventType.QueryStop) {
				const uri: URI = URI.parse(e.uri);
				// VS Range is 1 based so offset values by 1. The endLine we get back from SqlToolsService is incremented
				// by 1 from the original input range sent in as well so take that into account and don't modify
				const text: string = this._modelService.getModel(uri).getValueInRange(new Range(
					e.queryInfo.selection[0].startLine + 1,
					e.queryInfo.selection[0].startColumn + 1,
					e.queryInfo.selection[0].endLine,
					e.queryInfo.selection[0].endColumn + 1));

				// exapnd as required
				let newNode = new QueryHistoryNode(text, this._connectionManagementService.getConnectionProfile(e.uri), new Date(), undefined, QueryStatus.Succeeded);
				newNode.hasChildren = true;
				if (text.length > 100) {
					newNode.children = [new QueryHistoryNode(text, undefined, undefined, undefined, QueryStatus.Nothing)];
				}

				// icon as required (for now logic is if any message has error query has error)
				let error: boolean = false;
				e.queryInfo.queryRunner.messages.forEach(x => error = error || x.isError);
				if (error) {
					newNode.status = QueryStatus.Failed;
				}

				this._nodes = [newNode].concat(this._nodes);
				this.refreshTree();
			}
		}));
	}

	/**
	 * Create a task history tree
	 */
	public createQueryHistoryTree(treeContainer: HTMLElement, instantiationService: IInstantiationService): Tree {
		const dataSource = instantiationService.createInstance(QueryHistoryDataSource);
		const actionProvider = instantiationService.createInstance(QueryHistoryActionProvider);
		const renderer = instantiationService.createInstance(QueryHistoryRenderer);
		const controller = instantiationService.createInstance(QueryHistoryController, actionProvider);
		const dnd = new DefaultDragAndDrop();
		const filter = new DefaultFilter();
		const sorter = null;
		const accessibilityProvider = new DefaultAccessibilityProvider();

		return new Tree(treeContainer, {
			dataSource, renderer, controller, dnd, filter, sorter, accessibilityProvider
		}, {
				indentPixels: 10,
				twistiePixels: 20,
				ariaLabel: localize({ key: 'queryHistory.regTreeAriaLabel', comment: ['QueryHistory'] }, 'Query History')
			});
	}

	public refreshTree(): void {
		let selectedElement: any;
		let targetsToExpand: any[];

		// Focus
		this._tree.domFocus();

		if (this._tree) {
			const selection = this._tree.getSelection();
			if (selection && selection.length === 1) {
				selectedElement = <any>selection[0];
			}
			// convert to old VS Code tree interface with expandable methods
			const expandableTree: IExpandableTree = <IExpandableTree>this._tree;
			targetsToExpand = expandableTree.getExpandedElements();
		}

		if (this._nodes.length > 0) {
			hide(this._messages);
		}

		// Set the tree input - root node is just an empty container node
		let node: QueryHistoryNode = new QueryHistoryNode('', undefined, undefined);
		node.children = this._nodes;
		node.hasChildren = true;
		const treeInput: QueryHistoryNode = node;
		if (treeInput) {
			this._tree.setInput(treeInput).then(() => {
				// Make sure to expand all folders that were expanded in the previous session
				if (targetsToExpand) {
					this._tree.expandAll(targetsToExpand);
				}
				if (selectedElement) {
					this._tree.select(selectedElement);
				}
				this._tree.getFocus();
			}, errors.onUnexpectedError);
		}
	}

	private onSelected(event: any) {
		let selection = this._tree.getSelection();

		if (selection && selection.length > 0 && (selection[0] instanceof QueryHistoryNode)) {
			//let task = <TaskNode>selection[0];
			let isMouseOrigin = event.payload && (event.payload.origin === 'mouse');
			let isDoubleClick = isMouseOrigin && event.payload.originalEvent && event.payload.originalEvent.detail === 2;
			if (isDoubleClick) {
				/*
				if (task.status === TaskStatus.Failed) {
					let err = task.taskName + ': ' + task.message;
					this._errorMessageService.showDialog(Severity.Error, localize('taskError', 'Task error'), err);
				}
				*/
			}
		}
	}

	/**
	 * set the layout of the view
	 */
	public layout(height: number): void {
		this._tree.layout(height);
	}

	/**
	 * set the visibility of the view
	 */
	public setVisible(visible: boolean): void {
		if (visible) {
			this._tree.onVisible();
		} else {
			this._tree.onHidden();
		}
	}
}
