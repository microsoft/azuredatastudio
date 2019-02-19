/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import nls = require('vs/nls');
import errors = require('vs/base/common/errors');
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import * as builder from 'sql/base/browser/builder';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { DefaultFilter, DefaultDragAndDrop, DefaultAccessibilityProvider } from 'vs/base/parts/tree/browser/treeDefaults';
import { localize } from 'vs/nls';

import { TaskHistoryRenderer } from 'sql/parts/taskHistory/viewlet/taskHistoryRenderer';
import { TaskHistoryDataSource } from 'sql/parts/taskHistory/viewlet/taskHistoryDataSource';
import { TaskHistoryController } from 'sql/parts/taskHistory/viewlet/taskHistoryController';
import { TaskHistoryActionProvider } from 'sql/parts/taskHistory/viewlet/taskHistoryActionProvider';
import { ITaskService } from 'sql/platform/taskHistory/common/taskService';
import { TaskNode, TaskStatus } from 'sql/parts/taskHistory/common/taskNode';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

const $ = builder.$;

/**
 * TaskHistoryView implements the dynamic tree view.
 */
export class TaskHistoryView {
	private _messages: builder.Builder;
	private _tree: ITree;
	private _toDispose: IDisposable[] = [];

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ITaskService private _taskService: ITaskService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IThemeService private _themeService: IThemeService
	) {
	}

	/**
	 * Render the view body
	 */
	public renderBody(container: HTMLElement): void {

		let taskNode = this._taskService.getAllTasks();

		// Add div to display no task executed message
		this._messages = $('div.empty-task-message').appendTo(container);

		if (taskNode && taskNode.hasChildren) {
			this._messages.hide();
		}
		let noTaskMessage = localize('noTaskMessage', 'No task history to display. Try backup or restore task to view its execution status.');
		$('span').text(noTaskMessage).appendTo(this._messages);

		this._tree = this.createTaskHistoryTree(container, this._instantiationService);
		this._toDispose.push(this._tree.onDidChangeSelection((event) => this.onSelected(event)));

		// Theme styler
		this._toDispose.push(attachListStyler(this._tree, this._themeService));

		this._toDispose.push(this._taskService.onAddNewTask(args => {
			this._messages.hide();
			this.refreshTree();
		}));
		this._toDispose.push(this._taskService.onTaskComplete(task => {
			this.updateTask(task);
		}));

		// Refresh Tree when these events are emitted
		this.refreshTree();
	}

	/**
	 * Create a task history tree
	 */
	public createTaskHistoryTree(treeContainer: HTMLElement, instantiationService: IInstantiationService): Tree {
		const dataSource = instantiationService.createInstance(TaskHistoryDataSource);
		const actionProvider = instantiationService.createInstance(TaskHistoryActionProvider);
		const renderer = instantiationService.createInstance(TaskHistoryRenderer);
		const controller = instantiationService.createInstance(TaskHistoryController, actionProvider);
		const dnd = new DefaultDragAndDrop();
		const filter = new DefaultFilter();
		const sorter = null;
		const accessibilityProvider = new DefaultAccessibilityProvider();

		return new Tree(treeContainer, {
			dataSource, renderer, controller, dnd, filter, sorter, accessibilityProvider
		}, {
				indentPixels: 10,
				twistiePixels: 20,
				ariaLabel: nls.localize({ key: 'taskHistory.regTreeAriaLabel', comment: ['TaskHistory'] }, 'Task history')
			});
	}

	private updateTask(task: TaskNode): void {
		this._tree.refresh(task);
	}

	public refreshTree(): void {
		let selectedElement: any;
		let targetsToExpand: any[];

		// Focus
		this._tree.domFocus();

		if (this._tree) {
			let selection = this._tree.getSelection();
			if (selection && selection.length === 1) {
				selectedElement = <any>selection[0];
			}
			targetsToExpand = this._tree.getExpandedElements();
		}

		//Get the tree Input
		let treeInput = this._taskService.getAllTasks();
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

		if (selection && selection.length > 0 && (selection[0] instanceof TaskNode)) {
			let task = <TaskNode>selection[0];
			let isMouseOrigin = event.payload && (event.payload.origin === 'mouse');
			let isDoubleClick = isMouseOrigin && event.payload.originalEvent && event.payload.originalEvent.detail === 2;
			if (isDoubleClick) {
				if (task.status === TaskStatus.Failed) {
					var err = task.taskName + ': ' + task.message;
					this._errorMessageService.showDialog(Severity.Error, nls.localize('taskError', 'Task error'), err);
				}
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

	/**
	 * dispose the server tree view
	 */
	public dispose(): void {
		this._tree.dispose();
		this._toDispose = dispose(this._toDispose);
	}
}