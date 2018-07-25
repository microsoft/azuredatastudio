/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!sql/media/icons/common-icons';
import * as dom from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITree, IRenderer } from 'vs/base/parts/tree/browser/tree';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as sqlops from 'sqlops';

export interface TreeDataTemplate {
	root: HTMLElement;
	label: HTMLSpanElement;
	icon: HTMLElement;
}
/**
 * Renders the tree items.
 * Uses the dom template to render connection groups and connections.
 */
export class TreeComponentRenderer implements IRenderer {

	public static DEFAULT_TEMPLATE = 'DEFAULT_TEMPLATE';
	public static DEFAULT_HEIGHT = 20;


	constructor(
		@IContextViewService private _contextViewService: IContextViewService,
		@IThemeService private _themeService: IThemeService
	) {
	}

	/**
	 * Returns the element's height in the tree, in pixels.
	 */
	public getHeight(tree: ITree, element: any): number {
		return TreeComponentRenderer.DEFAULT_HEIGHT;
	}

	/**
	 * Returns a template ID for a given element.
	 */
	public getTemplateId(tree: ITree, element: any): string {

		return TreeComponentRenderer.DEFAULT_TEMPLATE;
	}

	/**
	 * Render template in a dom element based on template id
	 */
	public renderTemplate(tree: ITree, templateId: string, container: HTMLElement): any {

		if (templateId === TreeComponentRenderer.DEFAULT_TEMPLATE) {
			const nodeTemplate: TreeDataTemplate = Object.create(null);
			nodeTemplate.root = dom.append(container, dom.$('.connection-tile'));
			nodeTemplate.icon = dom.append(nodeTemplate.root, dom.$('div.icon server-page'));
			nodeTemplate.label = dom.append(nodeTemplate.root, dom.$('div.label'));
			return nodeTemplate;
		}
	}

	/**
	 * Render a element, given an object bag returned by the template
	 */
	public renderElement(tree: ITree, element: any, templateId: string, templateData: any): void {
		if (templateId === TreeComponentRenderer.DEFAULT_TEMPLATE) {
			this.renderNode(element, templateData);
		}
	}

	private renderNode(nodeDate: sqlops.TreeComponentDataModel, templateData: TreeDataTemplate): void {

		let label = 'label';

		templateData.label.textContent = label;
		templateData.root.title = label;
	}

	/**
	 * Returns the first parent which contains the className
	 */
	private findParentElement(container: HTMLElement, className: string): HTMLElement {
		let currentElement = container;
		while (currentElement) {
			if (currentElement.className.includes(className)) {
				break;
			}
			currentElement = currentElement.parentElement;
		}
		return currentElement;
	}

	public disposeTemplate(tree: ITree, templateId: string, templateData: any): void {
		// no op
		// InputBox disposed in wrapUp

	}
}

