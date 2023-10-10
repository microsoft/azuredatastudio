/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from 'vs/base/common/lifecycle';
import { ITableRenderer } from 'sql/base/browser/ui/table/highPerf/table';

import { $ } from 'vs/base/browser/dom';
export interface ICell {
	domNode: HTMLElement | null;
	templateData: any;
	templateId: string;
}

function removeFromParent(element: HTMLElement): void {
	try {
		if (element.parentElement) {
			element.parentElement.removeChild(element);
		}
	} catch (e) {
		// this will throw if this happens due to a blur event, nasty business
	}
}

export class CellCache<T> implements IDisposable {

	private cache = new Map<string, ICell[]>();

	constructor(private renderers: Map<string, ITableRenderer<T, any>>) { }

	alloc(templateId: string): ICell {
		let result = this.getTemplateCache(templateId).pop();

		if (!result) {
			const domNode = $('.monaco-perftable-cell');
			const renderer = this.getRenderer(templateId);
			const templateData = renderer.renderTemplate(domNode);
			result = { domNode, templateId, templateData };
		}

		return result;
	}

	private getTemplateCache(templateId: string): ICell[] {
		let result = this.cache.get(templateId);

		if (!result) {
			result = [];
			this.cache.set(templateId, result);
		}

		return result;
	}

	private getRenderer(templateId: string): ITableRenderer<T, any> {
		const renderer = this.renderers.get(templateId);
		if (!renderer) {
			throw new Error(`No renderer found for ${templateId}`);
		}
		return renderer;
	}

	release(cell: ICell) {
		const { domNode, templateId } = cell;
		if (domNode) {
			domNode.classList.remove('scrolling');
			removeFromParent(domNode);
		}

		const cache = this.getTemplateCache(templateId);
		cache.push(cell);
	}

	private garbageCollect(): void {
		if (!this.renderers) {
			return;
		}

		this.cache.forEach((cachedRows, templateId) => {
			for (const cachedRow of cachedRows) {
				const renderer = this.getRenderer(templateId);
				renderer.disposeTemplate(cachedRow.templateData);
				cachedRow.domNode = null;
				cachedRow.templateData = null;
			}
		});

		this.cache.clear();
	}

	dispose(): void {
		this.garbageCollect();
		this.cache.clear();
		this.renderers = null!; // StrictNullOverride: nulling out ok in dispose
	}
}
