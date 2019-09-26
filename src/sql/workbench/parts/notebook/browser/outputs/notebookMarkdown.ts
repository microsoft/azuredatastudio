/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'vs/base/common/path';

import { URI } from 'vs/base/common/uri';

import { IMarkdownString, removeMarkdownEscapes } from 'vs/base/common/htmlContent';
import { IMarkdownRenderResult } from 'vs/editor/contrib/markdown/markdownRenderer';
import * as marked from 'vs/base/common/marked/marked';
import { defaultGenerator } from 'vs/base/common/idGenerator';
import { revive } from 'vs/base/common/marshalling';
import { MarkdownRenderOptions } from 'vs/base/browser/markdownRenderer';

// Based off of HtmlContentRenderer
export class NotebookMarkdownRenderer {
	private _notebookURI: URI;
	private _baseUrls: string[] = [];

	constructor() {

	}

	render(markdown: IMarkdownString): IMarkdownRenderResult {
		const element: HTMLElement = markdown ? this.renderMarkdown(markdown, undefined) : document.createElement('span');
		return {
			element,
			dispose: () => { }
		};
	}

	createElement(options: MarkdownRenderOptions): HTMLElement {
		const tagName = options.inline ? 'span' : 'div';
		const element = document.createElement(tagName);
		if (options.className) {
			element.className = options.className;
		}
		return element;
	}

	parse(text: string): any {
		let data = JSON.parse(text);
		data = revive(data, 0);
		return data;
	}

	/**
	 * Create html nodes for the given content element.
	 * Adapted from htmlContentRenderer. Ensures that the markdown renderer
	 * gets passed in the correct baseUrl for the notebook's saved location,
	 * respects the trusted state of a notebook, and allows command links to
	 * be clickable.
	 */
	renderMarkdown(markdown: IMarkdownString, options: MarkdownRenderOptions = {}): HTMLElement {
		const element = this.createElement(options);

		// signal to code-block render that the element has been created
		let signalInnerHTML: () => void;
		const withInnerHTML = new Promise(c => signalInnerHTML = c);

		let notebookFolder = path.dirname(this._notebookURI.fsPath) + '/';
		if (!this._baseUrls.includes(notebookFolder)) {
			this._baseUrls.push(notebookFolder);
		}
		const renderer = new marked.Renderer({ baseUrl: notebookFolder });
		renderer.image = (href: string, title: string, text: string) => {
			href = this.cleanUrl(!markdown.isTrusted, notebookFolder, href);
			let dimensions: string[] = [];
			if (href) {
				const splitted = href.split('|').map(s => s.trim());
				href = splitted[0];
				const parameters = splitted[1];
				if (parameters) {
					const heightFromParams = /height=(\d+)/.exec(parameters);
					const widthFromParams = /width=(\d+)/.exec(parameters);
					const height = heightFromParams ? heightFromParams[1] : '';
					const width = widthFromParams ? widthFromParams[1] : '';
					const widthIsFinite = isFinite(parseInt(width));
					const heightIsFinite = isFinite(parseInt(height));
					if (widthIsFinite) {
						dimensions.push(`width="${width}"`);
					}
					if (heightIsFinite) {
						dimensions.push(`height="${height}"`);
					}
				}
			}
			let attributes: string[] = [];
			if (href) {
				attributes.push(`src="${href}"`);
			}
			if (text) {
				attributes.push(`alt="${text}"`);
			}
			if (title) {
				attributes.push(`title="${title}"`);
			}
			if (dimensions.length) {
				attributes = attributes.concat(dimensions);
			}
			return '<img ' + attributes.join(' ') + '>';
		};
		renderer.link = (href: string, title: string, text: string): string => {
			href = this.cleanUrl(!markdown.isTrusted, notebookFolder, href);
			if (href === null) {
				return text;
			}
			// Remove markdown escapes. Workaround for https://github.com/chjj/marked/issues/829
			if (href === text) { // raw link case
				text = removeMarkdownEscapes(text);
			}
			title = removeMarkdownEscapes(title);
			href = removeMarkdownEscapes(href);
			if (
				!href
				|| !markdown.isTrusted
				|| href.match(/^data:|javascript:/i)
				|| href.match(/^command:(\/\/\/)?_workbench\.downloadResource/i)
			) {
				// drop the link
				return text;

			} else {
				// HTML Encode href
				href = href.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;');
				return `<a href=${href} data-href="${href}" title="${title || href}">${text}</a>`;
			}
		};
		renderer.paragraph = (text): string => {
			return `<p>${text}</p>`;
		};

		if (options.codeBlockRenderer) {
			renderer.code = (code, lang) => {
				const value = options.codeBlockRenderer!(lang, code);
				// when code-block rendering is async we return sync
				// but update the node with the real result later.
				const id = defaultGenerator.nextId();

				const promise = value.then(strValue => {
					withInnerHTML.then(e => {
						const span = element.querySelector(`div[data-code="${id}"]`);
						if (span) {
							span.innerHTML = strValue;
						}
					}).catch(err => {
						// ignore
					});
				});

				if (options.codeBlockRenderCallback) {
					promise.then(options.codeBlockRenderCallback);
				}

				return `<div class="code" data-code="${id}">${escape(code)}</div>`;
			};
		}

		const markedOptions: marked.MarkedOptions = {
			sanitize: !markdown.isTrusted,
			renderer,
			baseUrl: notebookFolder
		};

		element.innerHTML = marked.parse(markdown.value, markedOptions);
		signalInnerHTML!();

		return element;
	}

	// This following methods have been adapted from marked.js
	// Copyright (c) 2011-2014, Christopher Jeffrey (https://github.com/chjj/)
	cleanUrl(sanitize: boolean, base: string, href: string) {
		if (sanitize) {
			let prot: string;
			try {
				prot = decodeURIComponent(unescape(href))
					.replace(/[^\w:]/g, '')
					.toLowerCase();
			} catch (e) {
				return null;
			}
			if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
				return null;
			}
		}
		try {
			if (URI.parse(href)) {
				return href;
			}
		} catch {
			// ignore
		}
		let originIndependentUrl = /^$|^[a-z][a-z0-9+.-]*:|^[?#]/i;
		if (base && !originIndependentUrl.test(href) && !path.isAbsolute(href)) {
			href = this.resolveUrl(base, href);
		}
		try {
			href = encodeURI(href).replace(/%25/g, '%');
		} catch (e) {
			return null;
		}
		return href;

	}

	resolveUrl(base: string, href: string) {
		if (!this._baseUrls[' ' + base]) {
			// we can ignore everything in base after the last slash of its path component,
			// but we might need to add _that_
			// https://tools.ietf.org/html/rfc3986#section-3
			if (/^[^:]+:\/*[^/]*$/.test(base)) {
				this._baseUrls[' ' + base] = base + '/';
			} else {
				// Remove trailing 'c's. /c*$/ is vulnerable to REDOS.
				this._baseUrls[' ' + base] = base.replace(/c*$/, '');
			}
		}
		base = this._baseUrls[' ' + base];

		if (href.slice(0, 2) === '//') {
			return base.replace(/:[\s\S]*/, ':') + href;
		} else if (href.charAt(0) === '/') {
			return base.replace(/(:\/*[^/]*)[\s\S]*/, '$1') + href;
		} else if (href.slice(0, 2) === '..') {
			return path.join(base, href);
		} else {
			return base + href;
		}
	}

	// end marked.js adaptation

	setNotebookURI(val: URI) {
		this._notebookURI = val;
	}
}
