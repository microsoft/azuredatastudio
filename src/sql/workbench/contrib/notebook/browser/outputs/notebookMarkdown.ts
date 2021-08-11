/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'vs/base/common/path';

import { nb } from 'azdata';
import { URI } from 'vs/base/common/uri';
import { IMarkdownString, removeMarkdownEscapes } from 'vs/base/common/htmlContent';
import { IMarkdownRenderResult } from 'vs/editor/browser/core/markdownRenderer';
import * as marked from 'sql/base/common/marked/marked';
import { defaultGenerator } from 'vs/base/common/idGenerator';
import { revive } from 'vs/base/common/marshalling';
import { ImageMimeTypes } from 'sql/workbench/services/notebook/common/contracts';
import { IMarkdownStringWithCellAttachments, MarkdownRenderOptionsWithCellAttachments } from 'sql/workbench/contrib/notebook/browser/cellViews/interfaces';
import { replaceInvalidLinkPath } from 'sql/workbench/contrib/notebook/common/utils';

// Based off of HtmlContentRenderer
export class NotebookMarkdownRenderer {
	private _notebookURI: URI;
	private _baseUrls: string[] = [];

	constructor() {

	}

	render(markdown: IMarkdownStringWithCellAttachments): IMarkdownRenderResult {
		const element: HTMLElement = markdown ? this.renderMarkdown(markdown, { cellAttachments: markdown.cellAttachments }) : document.createElement('span');
		return {
			element,
			dispose: () => { }
		};
	}

	createElement(options: MarkdownRenderOptionsWithCellAttachments): HTMLElement {
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
	renderMarkdown(markdown: IMarkdownString, options: MarkdownRenderOptionsWithCellAttachments = {}): HTMLElement {
		const element = this.createElement(options);

		// signal to code-block render that the element has been created
		let signalInnerHTML: () => void;
		const withInnerHTML = new Promise<void>(c => signalInnerHTML = c);

		let notebookFolder = this._notebookURI ? path.join(path.dirname(this._notebookURI.fsPath), path.sep) : '';
		if (!this._baseUrls.some(x => x === notebookFolder)) {
			this._baseUrls.push(notebookFolder);
		}
		const renderer = new marked.Renderer({ baseUrl: notebookFolder });
		renderer.image = (href: string, title: string, text: string) => {
			const attachment = findAttachmentIfExists(href, options.cellAttachments);
			// Attachments are already properly formed, so do not need cleaning. Cleaning only takes into account relative/absolute
			// paths issues, and encoding issues -- neither of which apply to cell attachments.
			// Attachments are always shown, regardless of notebook trust
			href = attachment ? attachment : this.cleanUrl(!markdown.isTrusted, notebookFolder, href);
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
			// check for isAbsolute prior to escaping and replacement
			let hrefAbsolute: boolean = path.isAbsolute(href);
			href = this.cleanUrl(!markdown.isTrusted, notebookFolder, href);
			if (href === null) {
				return text;
			}
			// Remove markdown escapes. Workaround for https://github.com/chjj/marked/issues/829
			if (href === text) { // raw link case
				text = removeMarkdownEscapes(text);
			}
			title = removeMarkdownEscapes(title);
			// only remove markdown escapes if it's a hyperlink, filepath usually can start with .{}_
			// and the below function escapes them if it encounters in the path.
			// dev note: using path.isAbsolute instead of isPathLocal since the latter accepts resolver (IRenderMime.IResolver) to check isLocal
			if (!hrefAbsolute) {
				href = removeMarkdownEscapes(href);
			}
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
				let uri = URI.parse(href);
				// mailto uris do not need additional encoding of &, otherwise it would not render properly
				if (uri.scheme !== 'mailto') {
					href = href.replace(/&(?!amp;)/g, '&amp;');
				}
				href = href.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;');
				return `<a href=${href} data-href="${href}" title="${title || href}" is-absolute=${hrefAbsolute}>${text}</a>`;
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
							span.innerHTML = strValue.innerHTML;
						}
					}).catch(err => {
						// ignore
					});
				});

				if (options.asyncRenderCallback) {
					promise.then(options.asyncRenderCallback);
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
			// The call to resolveUrl() (where relative hrefs are converted to absolute ones) comes after this point
			// Therefore, we only want to return immediately if the path is absolute here
			if (URI.parse(href) && path.isAbsolute(href)) {
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
			href = encodeURI(href).replace(/%5C/g, '\\').replace(/%7C/g, '|').replace(/%25/g, '%');
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
			// we need to format invalid href formats (ex. ....\file to ..\..\file)
			// in order to resolve to an absolute link
			// Issue tracked here: https://github.com/markedjs/marked/issues/2135
			href = replaceInvalidLinkPath(href);
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

/**
* The following is a sample cell attachment from JSON:
*  "attachments": {
*     "test.png": {
*        "image/png": "iVBORw0KGgoAAAANggg==="
*     }
*  }
*
* In a cell, the above attachment would be referenced in markdown like this:
* ![altText](attachment:test.png)
*/
function findAttachmentIfExists(href: string, cellAttachments: nb.ICellAttachments): string {
	if (href.startsWith('attachment:') && cellAttachments) {
		const imageName = href.replace('attachment:', '');
		const imageDefinition = cellAttachments[imageName];
		if (imageDefinition) {
			for (let i = 0; i < ImageMimeTypes.length; i++) {
				if (imageDefinition[ImageMimeTypes[i]]) {
					return `data:${ImageMimeTypes[i]};base64,${imageDefinition[ImageMimeTypes[i]]}`;
				}
			}
		}
	}
	return '';
}
