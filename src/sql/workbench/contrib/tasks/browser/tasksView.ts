/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/tasksPanel';
import * as errors from 'vs/base/common/errors';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import { Tree } from 'vs/base/parts/tree/browser/treeImpl';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { DefaultFilter, DefaultDragAndDrop, DefaultAccessibilityProvider } from 'vs/base/parts/tree/browser/treeDefaults';
import { localize } from 'vs/nls';
import { hide, $, append } from 'vs/base/browser/dom';
import { ViewPane, IViewPaneOptions } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IOpenerService } from 'vs/platform/opener/common/opener';

import { TaskHistoryRenderer } from 'sql/workbench/contrib/tasks/browser/tasksRenderer';
import { TaskHistoryDataSource } from 'sql/workbench/contrib/tasks/browser/tasksDataSource';
import { TaskHistoryController } from 'sql/workbench/contrib/tasks/browser/tasksController';
import { TaskHistoryActionProvider } from 'sql/workbench/contrib/tasks/browser/tasksActionProvider';
import { ITaskService } from 'sql/workbench/services/tasks/common/tasksService';
import { TaskNode, TaskStatus } from 'sql/workbench/services/tasks/common/tasksNode';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IExpandableTree } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';

/**
 * TaskHistoryView implements the dynamic tree view.
 */
export class TaskHistoryView extends ViewPane {
	private _messages: HTMLElement;
	private _tree: ITree;

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ITaskService private readonly taskService: ITaskService,
		@IErrorMessageService private readonly errorMessageService: IErrorMessageService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
	}

	/**
	 * Render the view body
	 */
	public renderBody(container: HTMLElement): void {
		super.renderBody(container);

		let taskNode = this.taskService.getAllTasks();

		// Add div to display no task executed message
		this._messages = append(container, $('div.empty-task-message'));

		if (taskNode && taskNode.hasChildren) {
			hide(this._messages);
		}
		let noTaskMessage = localize('noTaskMessage', "No task history to display.");
		append(this._messages, $('span')).innerText = noTaskMessage;

		this._tree = this._register(this.createTaskHistoryTree(container, this.instantiationService));
		this._register(this._tree.onDidChangeSelection((event) => this.onSelected(event)));

		// Theme styler
		this._register(attachListStyler(this._tree, this.themeService));

		this._register(this.taskService.onAddNewTask(args => {
			hide(this._messages);
			this.refreshTree();
		}));
		this._register(this.taskService.onTaskComplete(task => {
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
			ariaLabel: localize({ key: 'taskHistory.regTreeAriaLabel', comment: ['TaskHistory'] }, "Task history")
		});
	}

	private updateTask(task: TaskNode): void {
		this._tree.refresh(task).catch(err => errors.onUnexpectedError(err));
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
			// convert to old VS Code tree interface with expandable methods
			let expandableTree: IExpandableTree = <IExpandableTree>this._tree;
			targetsToExpand = expandableTree.getExpandedElements();
		}

		//Get the tree Input
		let treeInput = this.taskService.getAllTasks();
		if (treeInput) {
			this._tree.setInput(treeInput).then(async () => {
				// Make sure to expand all folders that where expanded in the previous session
				if (targetsToExpand) {
					await this._tree.expandAll(targetsToExpand);
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
					let err = task.taskName + ': ' + task.message;
					this.errorMessageService.showDialog(Severity.Error, localize('taskError', "Task error"), err);
				}
			}
		}
	}

	/**
	 * set the layout of the view
	 */
	public layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this._tree.layout(height);
	}
}
