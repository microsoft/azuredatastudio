/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import * as dompurify from 'vs/base/browser/dompurify/dompurify';
import { DomEmitter } from 'vs/base/browser/event';
import { createElement, FormattedTextRenderOptions } from 'vs/base/browser/formattedTextRenderer';
import { StandardMouseEvent } from 'vs/base/browser/mouseEvent';
import { renderLabelWithIcons } from 'vs/base/browser/ui/iconLabel/iconLabels';
import { raceCancellation } from 'vs/base/common/async';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { onUnexpectedError } from 'vs/base/common/errors';
import { Event } from 'vs/base/common/event';
import { IMarkdownString, parseHrefAndDimensions, removeMarkdownEscapes } from 'vs/base/common/htmlContent';
import { markdownEscapeEscapedIcons } from 'vs/base/common/iconLabels';
import { defaultGenerator } from 'vs/base/common/idGenerator';
import { DisposableStore } from 'vs/base/common/lifecycle';
import * as marked from 'vs/base/common/marked/marked';
import { parse } from 'vs/base/common/marshalling';
import { FileAccess, Schemas } from 'vs/base/common/network';
import { cloneAndChange } from 'vs/base/common/objects';
import { resolvePath } from 'vs/base/common/resources';
import { escape } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';

export interface MarkedOptions extends marked.MarkedOptions {
	baseUrl?: never;
}

export interface MarkdownRenderOptions extends FormattedTextRenderOptions {
	codeBlockRenderer?: (languageId: string, value: string) => Promise<HTMLElement>;
	asyncRenderCallback?: () => void;
	baseUrl?: URI;
}

/**
 * Low-level way create a html element from a markdown string.
 *
 * **Note** that for most cases you should be using [`MarkdownRenderer`](./src/vs/editor/browser/core/markdownRenderer.ts)
 * which comes with support for pretty code block rendering and which uses the default way of handling links.
 */
export function renderMarkdown(markdown: IMarkdownString, options: MarkdownRenderOptions = {}, markedOptions: MarkedOptions = {}): { element: HTMLElement, dispose: () => void } {
	const disposables = new DisposableStore();
	let isDisposed = false;

	const cts = disposables.add(new CancellationTokenSource());

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
		if (isDomUri) {
			if (href.startsWith(Schemas.data + ':')) {
				return href;
			}
			// this URI will end up as "src"-attribute of a dom node
			// and because of that special rewriting needs to be done
			// so that the URI uses a protocol that's understood by
			// browsers (like http or https)
			return FileAccess.asBrowserUri(uri).toString(true);
		}
		if (URI.parse(href).toString() === uri.toString()) {
			return href; // no transformation performed
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
			try {
				const hrefAsUri = URI.parse(href);
				if (options.baseUrl && hrefAsUri.scheme === Schemas.file) { // absolute or relative local path, or file: uri
					href = resolvePath(options.baseUrl, href).toString();
				}
			} catch (err) { }

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
		if (options.baseUrl) {
			const hasScheme = /^\w[\w\d+.-]*:/.test(href);
			if (!hasScheme) {
				href = resolvePath(options.baseUrl, href).toString();
			}
		}
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
		return `<p>${text}</p>`;
	};

	if (options.codeBlockRenderer) {
		renderer.code = (code, lang) => {
			const value = options.codeBlockRenderer!(lang, code);
			// when code-block rendering is async we return sync
			// but update the node with the real result later.
			const id = defaultGenerator.nextId();
			raceCancellation(Promise.all([value, withInnerHTML]), cts.token).then(values => {
				if (!isDisposed && values) {
					const span = <HTMLDivElement>element.querySelector(`div[data-code="${id}"]`);
					if (span) {
						DOM.reset(span, values[0]);
					}
					options.asyncRenderCallback?.();
				}
			}).catch(() => {
				// ignore
			});

			return `<div class="code" data-code="${id}">${escape(code)}</div>`;
		};
	}


	if (options.actionHandler) {
		const onClick = options.actionHandler.disposables.add(new DomEmitter(element, 'click'));
		const onAuxClick = options.actionHandler.disposables.add(new DomEmitter(element, 'auxclick'));
		options.actionHandler.disposables.add(Event.any(onClick.event, onAuxClick.event)(e => {
			const mouseEvent = new StandardMouseEvent(e);
			if (!mouseEvent.leftButton && !mouseEvent.middleButton) {
				return;
			}

			let target: HTMLElement | null = mouseEvent.target;
			if (target.tagName !== 'A') {
				target = target.parentElement;
				if (!target || target.tagName !== 'A') {
					return;
				}
			}
			try {
				const href = target.dataset['href'];
				if (href) {
					options.actionHandler!.callback(href, mouseEvent);
				}
			} catch (err) {
				onUnexpectedError(err);
			} finally {
				mouseEvent.preventDefault();
			}
		}));
	}

	if (!markdown.supportHtml) {
		// TODO: Can we deprecated this in favor of 'supportHtml'?

		// Use our own sanitizer so that we can let through only spans.
		// Otherwise, we'd be letting all html be rendered.
		// If we want to allow markdown permitted tags, then we can delete sanitizer and sanitize.
		// We always pass the output through dompurify after this so that we don't rely on
		// marked for sanitization.
		markedOptions.sanitizer = (html: string): string => {
			const match = markdown.isTrusted ? html.match(/^(<span[^>]+>)|(<\/\s*span>)$/) : undefined;
			return match ? html : '';
		};
		markedOptions.sanitize = true;
		markedOptions.silent = true;
	}

	markedOptions.renderer = renderer;

	// values that are too long will freeze the UI
	let value = markdown.value ?? '';
	if (value.length > 100_000) {
		value = `${value.substr(0, 100_000)}…`;
	}
	// escape theme icons
	if (markdown.supportThemeIcons) {
		value = markdownEscapeEscapedIcons(value);
	}

	let renderedMarkdown = marked.parse(value, markedOptions);

	// Rewrite theme icons
	if (markdown.supportThemeIcons) {
		const elements = renderLabelWithIcons(renderedMarkdown);
		renderedMarkdown = elements.map(e => typeof e === 'string' ? e : e.outerHTML).join('');
	}

	element.innerHTML = sanitizeRenderedMarkdown(markdown, renderedMarkdown) as unknown as string;

	// signal that async code blocks can be now be inserted
	signalInnerHTML!();

	// signal size changes for image tags
	if (options.asyncRenderCallback) {
		for (const img of element.getElementsByTagName('img')) {
			const listener = disposables.add(DOM.addDisposableListener(img, 'load', () => {
				listener.dispose();
				options.asyncRenderCallback!();
			}));
		}
	}

	return {
		element,
		dispose: () => {
			isDisposed = true;
			cts.cancel();
			disposables.dispose();
		}
	};
}

function sanitizeRenderedMarkdown(
	options: { isTrusted?: boolean },
	renderedMarkdown: string,
): TrustedHTML {
	const { config, allowedSchemes } = getSanitizerOptions(options);
	dompurify.addHook('uponSanitizeAttribute', (element, e) => {
		if (e.attrName === 'style' || e.attrName === 'class') {
			if (element.tagName === 'SPAN') {
				if (e.attrName === 'style') {
					e.keepAttr = /^(color\:#[0-9a-fA-F]+;)?(background-color\:#[0-9a-fA-F]+;)?$/.test(e.attrValue);
					return;
				} else if (e.attrName === 'class') {
					e.keepAttr = /^codicon codicon-[a-z\-]+( codicon-modifier-[a-z\-]+)?$/.test(e.attrValue);
					return;
				}
			}
			e.keepAttr = false;
			return;
		}
	});

	// build an anchor to map URLs to
	const anchor = document.createElement('a');

	// https://github.com/cure53/DOMPurify/blob/main/demos/hooks-scheme-allowlist.html
	dompurify.addHook('afterSanitizeAttributes', (node) => {
		// check all href/src attributes for validity
		for (const attr of ['href', 'src']) {
			if (node.hasAttribute(attr)) {
				anchor.href = node.getAttribute(attr) as string;
				if (!allowedSchemes.includes(anchor.protocol.replace(/:$/, ''))) {
					node.removeAttribute(attr);
				}
			}
		}
	});

	try {
		return dompurify.sanitize(renderedMarkdown, { ...config, RETURN_TRUSTED_TYPE: true });
	} finally {
		dompurify.removeHook('uponSanitizeAttribute');
		dompurify.removeHook('afterSanitizeAttributes');
	}
}

function getSanitizerOptions(options: { readonly isTrusted?: boolean }): { config: dompurify.Config, allowedSchemes: string[] } {
	const allowedSchemes = [
		Schemas.http,
		Schemas.https,
		Schemas.mailto,
		Schemas.data,
		Schemas.file,
		Schemas.vscodeFileResource,
		Schemas.vscodeRemote,
		Schemas.vscodeRemoteResource,
	];

	if (options.isTrusted) {
		allowedSchemes.push(Schemas.command);
	}

	return {
		config: {
			// allowedTags should included everything that markdown renders to.
			// Since we have our own sanitize function for marked, it's possible we missed some tag so let dompurify make sure.
			// HTML tags that can result from markdown are from reading https://spec.commonmark.org/0.29/
			// HTML table tags that can result from markdown are from https://github.github.com/gfm/#tables-extension-
			ALLOWED_TAGS: ['ul', 'li', 'p', 'b', 'i', 'code', 'blockquote', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'em', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'del', 'a', 'strong', 'br', 'img', 'span'],
			ALLOWED_ATTR: ['href', 'data-href', 'target', 'title', 'src', 'alt', 'class', 'style', 'data-code', 'width', 'height', 'align'],
			ALLOW_UNKNOWN_PROTOCOLS: true,
		},
		allowedSchemes
	};
}

/**
 * Strips all markdown from `string`, if it's an IMarkdownString. For example
 * `# Header` would be output as `Header`. If it's not, the string is returned.
 */
export function renderStringAsPlaintext(string: IMarkdownString | string) {
	return typeof string === 'string' ? string : renderMarkdownAsPlaintext(string);
}

/**
 * Strips all markdown from `markdown`. For example `# Header` would be output as `Header`.
 */
export function renderMarkdownAsPlaintext(markdown: IMarkdownString) {
	const renderer = new marked.Renderer();

	renderer.code = (code: string): string => {
		return code;
	};
	renderer.blockquote = (quote: string): string => {
		return quote;
	};
	renderer.html = (_html: string): string => {
		return '';
	};
	renderer.heading = (text: string, _level: 1 | 2 | 3 | 4 | 5 | 6, _raw: string): string => {
		return text + '\n';
	};
	renderer.hr = (): string => {
		return '';
	};
	renderer.list = (body: string, _ordered: boolean): string => {
		return body;
	};
	renderer.listitem = (text: string): string => {
		return text + '\n';
	};
	renderer.paragraph = (text: string): string => {
		return text + '\n';
	};
	renderer.table = (header: string, body: string): string => {
		return header + body + '\n';
	};
	renderer.tablerow = (content: string): string => {
		return content;
	};
	renderer.tablecell = (content: string, _flags: {
		header: boolean;
		align: 'center' | 'left' | 'right' | null;
	}): string => {
		return content + ' ';
	};
	renderer.strong = (text: string): string => {
		return text;
	};
	renderer.em = (text: string): string => {
		return text;
	};
	renderer.codespan = (code: string): string => {
		return code;
	};
	renderer.br = (): string => {
		return '\n';
	};
	renderer.del = (text: string): string => {
		return text;
	};
	renderer.image = (_href: string, _title: string, _text: string): string => {
		return '';
	};
	renderer.text = (text: string): string => {
		return text;
	};
	renderer.link = (_href: string, _title: string, text: string): string => {
		return text;
	};
	// values that are too long will freeze the UI
	let value = markdown.value ?? '';
	if (value.length > 100_000) {
		value = `${value.substr(0, 100_000)}…`;
	}

	const unescapeInfo = new Map<string, string>([
		['&quot;', '"'],
		['&nbsp;', ' '],
		['&amp;', '&'],
		['&#39;', '\''],
		['&lt;', '<'],
		['&gt;', '>'],
	]);

	const html = marked.parse(value, { renderer }).replace(/&(#\d+|[a-zA-Z]+);/g, m => unescapeInfo.get(m) ?? m);

	return sanitizeRenderedMarkdown({ isTrusted: false }, html).toString();
}
