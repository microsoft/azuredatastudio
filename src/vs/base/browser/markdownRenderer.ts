/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { createElement, FormattedTextRenderOptions } from 'vs/base/browser/formattedTextRenderer';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IMarkdownString, parseHrefAndDimensions, removeMarkdownEscapes } from 'vs/base/common/htmlContent';
import { defaultGenerator } from 'vs/base/common/idGenerator';
import * as marked from 'vs/base/common/marked/marked';
import { insane } from 'vs/base/common/insane/insane';
import { parse } from 'vs/base/common/marshalling';
import { cloneAndChange } from 'vs/base/common/objects';
import { escape } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';
import { Schemas } from 'vs/base/common/network';
import { renderCodicons, markdownEscapeEscapedCodicons } from 'vs/base/common/codicons';

export interface MarkdownRenderOptions extends FormattedTextRenderOptions {
	codeBlockRenderer?: (modeId: string, value: string) => Promise<string>;
	codeBlockRenderCallback?: () => void;
}

/**
 * Create html nodes for the given content element.
 */
export function renderMarkdown(markdown: IMarkdownString, options: MarkdownRenderOptions = {}, markedOptions: marked.MarkedOptions = {}): HTMLElement {
	const element = createElement(options);

	const _uriMassage = function (part: string): string {
		let data: any;
		try {
			data = parse(decodeURIComponent(part));
		} catch (e) {
			// ignore
		}
		if (!data) {
			return part;
		}
		data = cloneAndChange(data, value => {
			if (markdown.uris && markdown.uris[value]) {
				return URI.revive(markdown.uris[value]);
			} else {
				return undefined;
			}
		});
		return encodeURIComponent(JSON.stringify(data));
	};

	const _href = function (href: string, isDomUri: boolean): string {
		const data = markdown.uris && markdown.uris[href];
		if (!data) {
			return href; // no uri exists
		}
		let uri = URI.revive(data);
		if (URI.parse(href).toString() === uri.toString()) {
			return href; // no tranformation performed
		}
		if (isDomUri) {
			// this URI will end up as "src"-attribute of a dom node
			// and because of that special rewriting needs to be done
			// so that the URI uses a protocol that's understood by
			// browsers (like http or https)
			return DOM.asDomUri(uri).toString(true);
		}
		if (uri.query) {
			uri = uri.with({ query: _uriMassage(uri.query) });
		}
		return uri.toString();
	};

	// signal to code-block render that the
	// element has been created
	let signalInnerHTML: () => void;
	const withInnerHTML = new Promise<void>(c => signalInnerHTML = c);

	const renderer = new marked.Renderer();
	renderer.image = (href: string, title: string, text: string) => {
		let dimensions: string[] = [];
		let attributes: string[] = [];
		if (href) {
			({ href, dimensions } = parseHrefAndDimensions(href));
			href = _href(href, true);
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
	renderer.link = (href, title, text): string => {
		// Remove markdown escapes. Workaround for https://github.com/chjj/marked/issues/829
		if (href === text) { // raw link case
			text = removeMarkdownEscapes(text);
		}
		href = _href(href, false);
		title = removeMarkdownEscapes(title);
		href = removeMarkdownEscapes(href);
		if (
			!href
			|| href.match(/^data:|javascript:/i)
			|| (href.match(/^command:/i) && !markdown.isTrusted)
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
			return `<a href="#" data-href="${href}" title="${title || href}">${text}</a>`;
		}
	};
	renderer.paragraph = (text): string => {
		return `<p>${markdown.supportThemeIcons ? renderCodicons(text) : text}</p>`;
	};

	if (options.codeBlockRenderer) {
		renderer.code = (code, lang) => {
			const value = options.codeBlockRenderer!(lang, code);
			// when code-block rendering is async we return sync
			// but update the node with the real result later.
			const id = defaultGenerator.nextId();

			// {{SQL CARBON EDIT}} - Promise.all not returning the strValue properly in original code? @todo anthonydresser 4/12/19 investigate a better way to do this.
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

			// original VS Code source
			// const promise = Promise.all([value, withInnerHTML]).then(values => {
			// 	const strValue = values[0];
			// 	const span = element.querySelector(`div[data-code="${id}"]`);
			// 	if (span) {
			// 		span.innerHTML = strValue;
			// 	}
			// }).catch(err => {
			// 	// ignore
			// });

			if (options.codeBlockRenderCallback) {
				promise.then(options.codeBlockRenderCallback);
			}

			return `<div class="code" data-code="${id}">${escape(code)}</div>`;
		};
	}

	const actionHandler = options.actionHandler;
	if (actionHandler) {
		actionHandler.disposeables.add(DOM.addStandardDisposableListener(element, 'click', event => {
			let target: HTMLElement | null = event.target;
			if (target.tagName !== 'A') {
				target = target.parentElement;
				if (!target || target.tagName !== 'A') {
					return;
				}
			}
			try {
				const href = target.dataset['href'];
				if (href) {
					actionHandler.callback(href, event);
				}
			} catch (err) {
				onUnexpectedError(err);
			} finally {
				event.preventDefault();
			}
		}));
	}

	markedOptions.sanitize = true;
	markedOptions.renderer = renderer;

	const allowedSchemes = [Schemas.http, Schemas.https, Schemas.mailto, Schemas.data, Schemas.file, Schemas.vscodeRemote, Schemas.vscodeRemoteResource];
	if (markdown.isTrusted) {
		allowedSchemes.push(Schemas.command);
	}

	const renderedMarkdown = marked.parse(
		markdown.supportThemeIcons
			? markdownEscapeEscapedCodicons(markdown.value || '')
			: (markdown.value || ''),
		markedOptions
	);

	element.innerHTML = insane(renderedMarkdown, {
		allowedSchemes,
		allowedAttributes: {
			'a': ['href', 'name', 'target', 'data-href'],
			'iframe': ['allowfullscreen', 'frameborder', 'src'],
			'img': ['src', 'title', 'alt', 'width', 'height'],
			'div': ['class', 'data-code'],
			'span': ['class'],
			// https://github.com/microsoft/vscode/issues/95937
			'th': ['align'],
			'td': ['align']
		}
	});

	signalInnerHTML!();

	return element;
}
