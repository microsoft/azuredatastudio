/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { renderLabelWithIcons } from 'vs/base/browser/ui/iconLabel/iconLabels';
import * as objects from 'vs/base/common/objects';

export interface IHighlight {
	start: number;
	end: number;
	extraClasses?: string;
}

export class HighlightedLabel {

	private readonly domNode: HTMLElement;
	private text: string = '';
	private title: string = '';
	private highlights: IHighlight[] = [];
	private didEverRender: boolean = false;

	constructor(container: HTMLElement, private supportIcons: boolean) {
		this.domNode = document.createElement('span');
		this.domNode.className = 'monaco-highlighted-label';

		container.appendChild(this.domNode);
	}

	get element(): HTMLElement {
		return this.domNode;
	}

	set(text: string | undefined, highlights: IHighlight[] = [], title: string = '', escapeNewLines?: boolean) {
		if (!text) {
			text = '';
		}
		if (escapeNewLines) {
			// adjusts highlights inplace
			text = HighlightedLabel.escapeNewLines(text, highlights);
		}
		if (this.didEverRender && this.text === text && this.title === title && objects.equals(this.highlights, highlights)) {
			return;
		}

		this.text = text;
		this.title = title;
		this.highlights = highlights;
		this.render();
	}

	private render(): void {

		const children: HTMLSpanElement[] = [];
		let pos = 0;

		for (const highlight of this.highlights) {
			if (highlight.end === highlight.start) {
				continue;
			}
			if (pos < highlight.start) {
				const substring = this.text.substring(pos, highlight.start);
				children.push(dom.$('span', undefined, ...this.supportIcons ? renderLabelWithIcons(substring) : [substring]));
				pos = highlight.end;
			}

			const substring = this.text.substring(highlight.start, highlight.end);
			const element = dom.$('span.highlight', undefined, ...this.supportIcons ? renderLabelWithIcons(substring) : [substring]);
			if (highlight.extraClasses) {
				element.classList.add(highlight.extraClasses);
			}
			children.push(element);
			pos = highlight.end;
		}

		if (pos < this.text.length) {
			const substring = this.text.substring(pos,);
			children.push(dom.$('span', undefined, ...this.supportIcons ? renderLabelWithIcons(substring) : [substring]));
		}

		dom.reset(this.domNode, ...children);
		if (this.title) {
			this.domNode.title = this.title;
		} else {
			this.domNode.removeAttribute('title');
		}
		this.didEverRender = true;
	}

	static escapeNewLines(text: string, highlights: IHighlight[]): string {

		let total = 0;
		let extra = 0;

		return text.replace(/\r\n|\r|\n/g, (match, offset) => {
			extra = match === '\r\n' ? -1 : 0;
			offset += total;

			for (const highlight of highlights) {
				if (highlight.end <= offset) {
					continue;
				}
				if (highlight.start >= offset) {
					highlight.start += extra;
				}
				if (highlight.end >= offset) {
					highlight.end += extra;
				}
			}

			total += extra;
			return '\u23CE';
		});
	}
}
