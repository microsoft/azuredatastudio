/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { QueryStatus } from 'sql/platform/queryHistory/common/queryHistoryInfo';
import * as dom from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { QueryHistoryNode } from 'sql/workbench/parts/queryHistory/browser/queryHistoryNode';

const $ = dom.$;

export interface IQueryHistoryItemTemplateData {
	root: HTMLElement;
	icon: HTMLElement;
	label: HTMLSpanElement;
	connectionInfo: HTMLSpanElement;
	time: HTMLSpanElement;
	disposables: Array<IDisposable>;
}

/**
 * Renders the tree items.
 * Uses the dom template to render task history.
 */
export class QueryHistoryRenderer implements IRenderer {

	public static readonly QUERYHISTORYOBJECT_HEIGHT = 22;
	private static readonly FAIL_CLASS = 'error';
	private static readonly SUCCESS_CLASS = 'success';
	/**
	 * Returns the element's height in the tree, in pixels.
	 */
	public getHeight(tree: ITree, element: QueryHistoryNode): number {
		return QueryHistoryRenderer.QUERYHISTORYOBJECT_HEIGHT;
	}

	/**
	 * Returns a template ID for a given element.
	 */
	public getTemplateId(tree: ITree, element: QueryHistoryNode): string {
		return element.info.id;
	}

	/**
	 * Render template in a dom element based on template id
	 */
	public renderTemplate(tree: ITree, templateId: string, container: HTMLElement): any {
		const taskTemplate: IQueryHistoryItemTemplateData = Object.create(null);
		taskTemplate.root = dom.append(container, $('.query-history-item'));
		taskTemplate.icon = dom.append(taskTemplate.root, $('.icon.query-history-icon'));
		taskTemplate.label = dom.append(taskTemplate.root, $('.label'));
		taskTemplate.connectionInfo = dom.append(taskTemplate.root, $('.connection-info'));
		taskTemplate.time = dom.append(taskTemplate.root, $('.time'));
		taskTemplate.disposables = [];
		return taskTemplate;
	}

	/**
	 * Render a element, given an object bag returned by the template
	 */
	public renderElement(tree: ITree, element: QueryHistoryNode, templateId: string, templateData: IQueryHistoryItemTemplateData): void {
		let taskStatus;
		if (element && element.info) {
			templateData.icon.className = 'query-history-icon';
			if (element.info.status === QueryStatus.Succeeded) {
				dom.addClass(templateData.icon, QueryHistoryRenderer.SUCCESS_CLASS);
				taskStatus = localize('succeeded', "succeeded");
			}
			else if (element.info.status === QueryStatus.Failed) {
				dom.addClass(templateData.icon, QueryHistoryRenderer.FAIL_CLASS);
				taskStatus = localize('failed', "failed");
			}

			templateData.icon.title = taskStatus;

			templateData.label.textContent = element.info.queryText;
			templateData.label.title = templateData.label.textContent;

			// Determine the target name and set hover text equal to that
			const connectionInfo = `${element.info.connectionProfile.serverName}|${element.info.database}`;
			templateData.connectionInfo.textContent = connectionInfo;
			templateData.connectionInfo.title = templateData.connectionInfo.textContent;
			templateData.time.textContent = element.info.startTime.toLocaleString();
			templateData.time.title = templateData.time.textContent;

		}
	}

	public disposeTemplate(tree: ITree, templateId: string, templateData: IQueryHistoryItemTemplateData): void {
		dispose(templateData.disposables);
	}
}
