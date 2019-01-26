/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { $ } from 'vs/base/browser/dom';
import { ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { ITaskHistoryTemplateData } from 'sql/parts/taskHistory/viewlet/templateData';
import { TaskNode, TaskStatus } from 'sql/parts/taskHistory/common/taskNode';
import dom = require('vs/base/browser/dom');
import { localize } from 'vs/nls';
import * as Utils from 'sql/platform/connection/common/utils';

/**
 * Renders the tree items.
 * Uses the dom template to render task history.
 */
export class TaskHistoryRenderer implements IRenderer {

	public static readonly TASKOBJECT_HEIGHT = 65;
	private static readonly ICON_CLASS = 'task-icon sql icon';
	private static readonly TASKOBJECT_TEMPLATE_ID = 'carbonTask';
	private static readonly FAIL_CLASS = 'error';
	private static readonly SUCCESS_CLASS = 'success';
	private static readonly INPROGRESS_CLASS = 'in-progress';
	private static readonly NOTSTARTED_CLASS = 'not-started';
	private static readonly CANCELED_CLASS = 'canceled';

	/**
	 * Returns the element's height in the tree, in pixels.
	 */
	public getHeight(tree: ITree, element: any): number {
		return TaskHistoryRenderer.TASKOBJECT_HEIGHT;
	}

	/**
	 * Returns a template ID for a given element.
	 */
	public getTemplateId(tree: ITree, element: any): string {
		return TaskHistoryRenderer.TASKOBJECT_TEMPLATE_ID;
	}

	/**
	 * Render template in a dom element based on template id
	 */
	public renderTemplate(tree: ITree, templateId: string, container: HTMLElement): any {
		const taskTemplate: ITaskHistoryTemplateData = Object.create(null);
		taskTemplate.root = dom.append(container, $('.task-group'));
		taskTemplate.icon = dom.append(taskTemplate.root, $('img.task-icon'));
		var titleContainer = dom.append(taskTemplate.root, $('div.task-details'));
		taskTemplate.title = dom.append(titleContainer, $('div.title'));
		taskTemplate.description = dom.append(titleContainer, $('div.description'));
		taskTemplate.time = dom.append(titleContainer, $('div.time'));
		return taskTemplate;
	}

	/**
	 * Render a element, given an object bag returned by the template
	 */
	public renderElement(tree: ITree, element: any, templateId: string, templateData: any): void {
		this.renderTask(tree, element, templateData);
	}

	private renderTask(tree: ITree, taskNode: TaskNode, templateData: ITaskHistoryTemplateData): void {
		let taskStatus;
		if (taskNode) {
			templateData.icon.className = TaskHistoryRenderer.ICON_CLASS;
			switch (taskNode.status) {
				case TaskStatus.Succeeded:
					templateData.icon.classList.add(TaskHistoryRenderer.SUCCESS_CLASS);
					taskStatus = localize('succeeded', "succeeded");
					break;
				case TaskStatus.Failed:
					templateData.icon.classList.add(TaskHistoryRenderer.FAIL_CLASS);
					taskStatus = localize('failed', "failed");
					break;
				case TaskStatus.InProgress:
					templateData.icon.classList.add(TaskHistoryRenderer.INPROGRESS_CLASS);
					taskStatus = localize('inProgress', "in progress");
					break;
				case TaskStatus.NotStarted:
					templateData.icon.classList.add(TaskHistoryRenderer.NOTSTARTED_CLASS);
					taskStatus = localize('notStarted', "not started");
					break;
				case TaskStatus.Canceled:
					templateData.icon.classList.add(TaskHistoryRenderer.CANCELED_CLASS);
					taskStatus = localize('canceled', "canceled");
					break;
				case TaskStatus.Canceling:
					templateData.icon.classList.add(TaskHistoryRenderer.INPROGRESS_CLASS);
					taskStatus = localize('canceling', "canceling");
					break;
			}
			// Set hover text for icon to same as task status
			templateData.icon.title = taskStatus;

			// Determine the task title and set hover text equal to that
			templateData.title.textContent = taskNode.taskName + ' ' + taskStatus;
			templateData.title.title = templateData.title.textContent;

			// Determine the target name and set hover text equal to that
			let description = taskNode.serverName;
			if (taskNode.databaseName) {
				description += ' | ' + taskNode.databaseName;
			}
			templateData.description.textContent = description;
			templateData.description.title = templateData.description.textContent;

			this.timer(taskNode, templateData);
			let self = this;
			setInterval(function () {
				self.timer(taskNode, templateData);
			}, 1000);
		}
	}

	public timer(taskNode: TaskNode, templateData: ITaskHistoryTemplateData) {
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
		templateData.time.textContent = timeLabel;
		templateData.time.title = timeLabel;
	}

	public disposeTemplate(tree: ITree, templateId: string, templateData: any): void {
		// no op
		// InputBox disposed in wrapUp

	}
}

