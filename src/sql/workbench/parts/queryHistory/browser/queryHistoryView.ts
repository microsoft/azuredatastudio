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
import { QueryHistoryNode } from 'sql/platform/queryHistory/common/queryHistoryNode';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IExpandableTree } from 'sql/workbench/parts/objectExplorer/browser/treeUpdateUtils';
import { IQueryModelService, IQueryEvent } from 'sql/platform/query/common/queryModel';

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
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IThemeService private _themeService: IThemeService
	) {
		super();
	}

	/**
	 * Render the view body
	 */
	public renderBody(container: HTMLElement): void {

		const queryHistoryNodes: QueryHistoryNode[] = []; // this._taskService.getAllTasks();

		// Add div to display no task executed message
		this._messages = append(container, $('div.no-queries-message'));

		/*
		if (queryHistoryNodes) {
			hide(this._messages);
		}
		*/

		const noQueriesMessage = localize('noQueriesMessage', 'No queries to display.');
		append(this._messages, $('span')).innerText = noQueriesMessage;

		this._tree = this._register(this.createTaskHistoryTree(container, this._instantiationService));
		this._register(this._tree.onDidChangeSelection((event) => this.onSelected(event)));

		// Theme styler
		this._register(attachListStyler(this._tree, this._themeService));

		this._register(this._queryModelService.onQueryEvent((e: IQueryEvent) => {
			if (e.type === QueryEventType.QueryStop) {
				this._nodes.push(new QueryHistoryNode('SELECT * FROM sys.tables', 'abc123', new Date()));
				this.refreshTree();
			}
		}));

		/*
		this._toDispose.push(this._taskService.onAddNewTask(args => {
			hide(this._messages);
			this.refreshTree();
		}));

		this._toDispose.push(this._taskService.onTaskComplete(task => {
			this.updateTask(task);
		}));
		*/

		// Refresh Tree when these events are emitted
		this.refreshTree();
	}

	/**
	 * Create a task history tree
	 */
	public createTaskHistoryTree(treeContainer: HTMLElement, instantiationService: IInstantiationService): Tree {
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

	private updateNode(node: QueryHistoryNode): void {
		this._tree.refresh(node);
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

		//Get the tree Input
		// let treeInput = this._taskService.getAllTasks();
		const treeInput: QueryHistoryNode[] = this._nodes;
		if (treeInput) {
			this._tree.setInput(treeInput).then(() => {
				// Make sure to expand all folders that where expanded in the previous session
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
