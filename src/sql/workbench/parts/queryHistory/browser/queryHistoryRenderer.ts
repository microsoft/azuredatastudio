/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { QueryHistoryNode } from 'sql/platform/queryHistory/common/queryHistoryNode';
import * as dom from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import * as Utils from 'sql/platform/connection/common/utils';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';

const $ = dom.$;

export interface IQueryHistoryItemTemplateData {
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
export class QueryHistoryRenderer implements IRenderer {

	public static readonly QUERYHISTORYOBJECT_HEIGHT = 22;
	private static readonly QUERYHISTORYOBJECT_TEMPLATE_ID = 'carbonQueryHistoryItem';

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
		return element.id;
	}

	/**
	 * Render template in a dom element based on template id
	 */
	public renderTemplate(tree: ITree, templateId: string, container: HTMLElement): any {
		const taskTemplate: IQueryHistoryItemTemplateData = Object.create(null);
		taskTemplate.root = dom.append(container, $('.task-group'));
		taskTemplate.icon = dom.append(taskTemplate.root, $('.icon.task-icon'));
		taskTemplate.label = dom.append(taskTemplate.root, $('.label'));
		taskTemplate.description = dom.append(taskTemplate.root, $('.description'));
		taskTemplate.time = dom.append(taskTemplate.root, $('.time'));
		taskTemplate.disposables = [];
		return taskTemplate;
	}

	/**
	 * Render a element, given an object bag returned by the template
	 */
	public renderElement(tree: ITree, element: QueryHistoryNode, templateId: string, templateData: IQueryHistoryItemTemplateData): void {
		if (element) {
			templateData.label.textContent = element.queryText;
			templateData.label.title = templateData.label.textContent;

			// Determine the target name and set hover text equal to that
			const description = element.connectionId;
			templateData.description.textContent = description;
			templateData.description.title = templateData.description.textContent;
			templateData.time.textContent = element.startTime.toLocaleDateString();
			templateData.time.title = templateData.time.textContent;

		}
	}

	public disposeTemplate(tree: ITree, templateId: string, templateData: IQueryHistoryItemTemplateData): void {
		dispose(templateData.disposables);
	}
}
