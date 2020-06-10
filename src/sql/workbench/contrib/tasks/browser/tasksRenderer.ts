/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { TaskNode, TaskStatus } from 'sql/workbench/services/tasks/common/tasksNode';
import * as dom from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import * as Utils from 'sql/platform/connection/common/utils';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IntervalTimer } from 'vs/base/common/async';

const $ = dom.$;

export interface ITaskHistoryTemplateData {
	root: HTMLElement;
	icon: HTMLElement;
	label: HTMLSpanElement;
	description: HTMLSpanElement;
	time: HTMLSpanElement;
	disposables: Array<IDisposable>;
}

/**
 * Renders the tree items.
 * Uses the dom template to render task history.
 */
export class TaskHistoryRenderer implements IRenderer {

	public static readonly TASKOBJECT_HEIGHT = 22;
	private static readonly FAIL_CLASS = 'error';
	private static readonly SUCCESS_CLASS = 'success';
	private static readonly INPROGRESS_CLASS = 'in-progress';
	private static readonly NOTSTARTED_CLASS = 'not-started';
	private static readonly CANCELED_CLASS = 'canceled';

	/**
	 * Returns the element's height in the tree, in pixels.
	 */
	public getHeight(tree: ITree, element: TaskNode): number {
		return TaskHistoryRenderer.TASKOBJECT_HEIGHT;
	}

	/**
	 * Returns a template ID for a given element.
	 */
	public getTemplateId(tree: ITree, element: TaskNode): string {
		return element.id;
	}

	/**
	 * Render template in a dom element based on template id
	 */
	public renderTemplate(tree: ITree, templateId: string, container: HTMLElement): any {
		const taskTemplate: ITaskHistoryTemplateData = Object.create(null);
		taskTemplate.root = dom.append(container, $('.task-group'));
		taskTemplate.icon = dom.append(taskTemplate.root, $('.codicon.task-icon'));
		taskTemplate.label = dom.append(taskTemplate.root, $('.label'));
		taskTemplate.description = dom.append(taskTemplate.root, $('.description'));
		taskTemplate.time = dom.append(taskTemplate.root, $('.time'));
		taskTemplate.disposables = [];
		return taskTemplate;
	}

	/**
	 * Render a element, given an object bag returned by the template
	 */
	public renderElement(tree: ITree, element: TaskNode, templateId: string, templateData: ITaskHistoryTemplateData): void {
		let taskStatus;
		if (element) {
			templateData.icon.className = 'task-icon';
			switch (element.status) {
				case TaskStatus.Succeeded:
					dom.addClass(templateData.icon, TaskHistoryRenderer.SUCCESS_CLASS);
					taskStatus = localize('succeeded', "succeeded");
					break;
				case TaskStatus.Failed:
					dom.addClass(templateData.icon, TaskHistoryRenderer.FAIL_CLASS);
					taskStatus = localize('failed', "failed");
					break;
				case TaskStatus.InProgress:
					dom.addClass(templateData.icon, TaskHistoryRenderer.INPROGRESS_CLASS);
					taskStatus = localize('inProgress', "in progress");
					break;
				case TaskStatus.NotStarted:
					dom.addClass(templateData.icon, TaskHistoryRenderer.NOTSTARTED_CLASS);
					taskStatus = localize('notStarted', "not started");
					break;
				case TaskStatus.Canceled:
					dom.addClass(templateData.icon, TaskHistoryRenderer.CANCELED_CLASS);
					taskStatus = localize('canceled', "canceled");
					break;
				case TaskStatus.Canceling:
					dom.addClass(templateData.icon, TaskHistoryRenderer.INPROGRESS_CLASS);
					taskStatus = localize('canceling', "canceling");
					break;
			}
			// Set hover text for icon to same as task status
			templateData.icon.title = taskStatus;

			// Determine the task title and set hover text equal to that
			templateData.label.textContent = element.taskName + ' ' + taskStatus;
			templateData.label.title = templateData.label.textContent;

			let description: string;
			// Determine the target name and set hover text equal to that
			// show target location if there is one, otherwise show server and database name
			if (element.targetLocation) {
				description = element.targetLocation;
			} else {
				description = element.serverName;
				if (element.databaseName) {
					description += ' | ' + element.databaseName;
				}
			}

			templateData.description.textContent = description;
			templateData.description.title = templateData.description.textContent;

			this.timer(element, templateData.time);

			const timer = new IntervalTimer();
			timer.cancelAndSet(() => this.timer(element, templateData.time), 1000);
			templateData.disposables.push(timer);
		}
	}

	private timer(taskNode: TaskNode, element: HTMLElement): void {
		let timeLabel = '';
		if (taskNode.status === TaskStatus.Failed) {
			timeLabel += taskNode.startTime + ' Error: ' + taskNode.message;
		} else {
			if (taskNode.startTime) {
				timeLabel = taskNode.startTime;
			}
			if (taskNode.endTime) {
				timeLabel += ' - ' + taskNode.endTime;
			}

			if (taskNode.timer) {
				// Round task duration to seconds and then convert back to milliseconds
				let duration = Math.floor(taskNode.timer.elapsed() / 1000) * 1000;
				timeLabel += ' (' + Utils.parseNumAsTimeString(duration) + ')';
			}
		}
		element.textContent = timeLabel;
		element.title = timeLabel;
	}

	public disposeTemplate(tree: ITree, templateId: string, templateData: ITaskHistoryTemplateData): void {
		dispose(templateData.disposables);
	}
}
