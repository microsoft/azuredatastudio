/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import * as dompurify from 'vs/base/browser/dompurify/dompurify';
import { DomEmitter } from 'vs/base/browser/event';
import { createElement, FormattedTextRenderOptions } from 'vs/base/browser/formattedTextRenderer';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { StandardMouseEvent } from 'vs/base/browser/mouseEvent';
import { renderLabelWithIcons } from 'vs/base/browser/ui/iconLabel/iconLabels';
import { onUnexpectedError } from 'vs/base/common/errors';
import { Event } from 'vs/base/common/event';
import { IMarkdownString, escapeDoubleQuotes, parseHrefAndDimensions, removeMarkdownEscapes, MarkdownStringTrustedOptions } from 'vs/base/common/htmlContent';
import { markdownEscapeEscapedIcons } from 'vs/base/common/iconLabels';
import { defaultGenerator } from 'vs/base/common/idGenerator';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Lazy } from 'vs/base/common/lazy';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { marked } from 'vs/base/common/marked/marked';
import { parse } from 'vs/base/common/marshalling';
import { FileAccess, Schemas } from 'vs/base/common/network';
import { cloneAndChange } from 'vs/base/common/objects';
import { dirname, resolvePath } from 'vs/base/common/resources';
import { escape } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';

export interface MarkedOptions extends marked.MarkedOptions {
	baseUrl?: never;
}

export interface MarkdownRenderOptions extends FormattedTextRenderOptions {
	readonly codeBlockRenderer?: (languageId: string, value: string) => Promise<HTMLElement>;
	readonly codeBlockRendererSync?: (languageId: string, value: string) => HTMLElement;
	readonly asyncRenderCallback?: () => void;
	readonly fillInIncompleteTokens?: boolean;
}

const defaultMarkedRenderers = Object.freeze({
	image: (href: string | null, title: string | null, text: string): string => {
		let dimensions: string[] = [];
		let attributes: string[] = [];
		if (href) {
			({ href, dimensions } = parseHrefAndDimensions(href));
			attributes.push(`src="${escapeDoubleQuotes(href)}"`);
		}
		if (text) {
			attributes.push(`alt="${escapeDoubleQuotes(text)}"`);
		}
		if (title) {
			attributes.push(`title="${escapeDoubleQuotes(title)}"`);
		}
		if (dimensions.length) {
			attributes = attributes.concat(dimensions);
		}
		return '<img ' + attributes.join(' ') + '>';
	},

	paragraph: (text: string): string => {
		return `<p>${text}</p>`;
	},

	link: (href: string | null, title: string | null, text: string): string => {
		if (typeof href !== 'string') {
			return '';
		}

		// Remove markdown escapes. Workaround for https://github.com/chjj/marked/issues/829
		if (href === text) { // raw link case
			text = removeMarkdownEscapes(text);
		}

		title = typeof title === 'string' ? escapeDoubleQuotes(removeMarkdownEscapes(title)) : '';
		href = removeMarkdownEscapes(href);

		// HTML Encode href
		href = href.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
		return `<a href="${href}" title="${title || href}">${text}</a>`;
	},
});

/**
 * Low-level way create a html element from a markdown string.
 *
 * **Note** that for most cases you should be using [`MarkdownRenderer`](./src/vs/editor/contrib/markdownRenderer/browser/markdownRenderer.ts)
 * which comes with support for pretty code block rendering and which uses the default way of handling links.
 */
export function renderMarkdown(markdown: IMarkdownString, options: MarkdownRenderOptions = {}, markedOptions: MarkedOptions = {}): { element: HTMLElement; dispose: () => void } {
	const disposables = new DisposableStore();
	let isDisposed = false;

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
		let uri = URI.revive(data);
		if (isDomUri) {
			if (href.startsWith(Schemas.data + ':')) {
				return href;
			}
			if (!uri) {
				uri = URI.parse(href);
			}
			// this URI will end up as "src"-attribute of a dom node
			// and because of that special rewriting needs to be done
			// so that the URI uses a protocol that's understood by
			// browsers (like http or https)
			return FileAccess.uriToBrowserUri(uri).toString(true);
		}
		if (!uri) {
			return href;
		}
		if (URI.parse(href).toString() === uri.toString()) {
			return href; // no transformation performed
		}
		if (uri.query) {
			uri = uri.with({ query: _uriMassage(uri.query) });
		}
		return uri.toString();
	};

	const renderer = new marked.Renderer();
	renderer.image = defaultMarkedRenderers.image;
	renderer.link = defaultMarkedRenderers.link;
	renderer.paragraph = defaultMarkedRenderers.paragraph;

	// Will collect [id, renderedElement] tuples
	const codeBlocks: Promise<[string, HTMLElement]>[] = [];
	const syncCodeBlocks: [string, HTMLElement][] = [];

	if (options.codeBlockRendererSync) {
		renderer.code = (code, lang) => {
			const id = defaultGenerator.nextId();
			const value = options.codeBlockRendererSync!(postProcessCodeBlockLanguageId(lang), code);
			syncCodeBlocks.push([id, value]);
			return `<div class="code" data-code="${id}">${escape(code)}</div>`;
		};
	} else if (options.codeBlockRenderer) {
		renderer.code = (code, lang) => {
			const id = defaultGenerator.nextId();
			const value = options.codeBlockRenderer!(postProcessCodeBlockLanguageId(lang), code);
			codeBlocks.push(value.then(element => [id, element]));
			return `<div class="code" data-code="${id}">${escape(code)}</div>`;
		};
	}


	if (options.actionHandler) {
		const _activateLink = function (event: StandardMouseEvent | StandardKeyboardEvent): void {
			let target: HTMLElement | null = event.target;
			if (target.tagName !== 'A') {
				target = target.parentElement;
				if (!target || target.tagName !== 'A') {
					return;
				}
			}
			try {
				let href = target.dataset['href'];
				if (href) {
					if (markdown.baseUri) {
						href = resolveWithBaseUri(URI.from(markdown.baseUri), href);
					}
					options.actionHandler!.callback(href, event);
				}
			} catch (err) {
				onUnexpectedError(err);
			} finally {
				event.preventDefault();
			}
		};
		const onClick = options.actionHandler.disposables.add(new DomEmitter(element, 'click'));
		const onAuxClick = options.actionHandler.disposables.add(new DomEmitter(element, 'auxclick'));
		options.actionHandler.disposables.add(Event.any(onClick.event, onAuxClick.event)(e => {
			const mouseEvent = new StandardMouseEvent(e);
			if (!mouseEvent.leftButton && !mouseEvent.middleButton) {
				return;
			}
			_activateLink(mouseEvent);
		}));
		options.actionHandler.disposables.add(DOM.addDisposableListener(element, 'keydown', (e) => {
			const keyboardEvent = new StandardKeyboardEvent(e);
			if (!keyboardEvent.equals(KeyCode.Space) && !keyboardEvent.equals(KeyCode.Enter)) {
				return;
			}
			_activateLink(keyboardEvent);
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

	let renderedMarkdown: string;
	if (options.fillInIncompleteTokens) {
		// The defaults are applied by parse but not lexer()/parser(), and they need to be present
		const opts = {
			...marked.defaults,
			...markedOptions
		};
		const tokens = marked.lexer(value, opts);
		const newTokens = fillInIncompleteTokens(tokens);
		renderedMarkdown = marked.parser(newTokens, opts);
	} else {
		renderedMarkdown = marked.parse(value, markedOptions);
	}

	// Rewrite theme icons
	if (markdown.supportThemeIcons) {
		const elements = renderLabelWithIcons(renderedMarkdown);
		renderedMarkdown = elements.map(e => typeof e === 'string' ? e : e.outerHTML).join('');
	}

	const htmlParser = new DOMParser();
	const markdownHtmlDoc = htmlParser.parseFromString(sanitizeRenderedMarkdown(markdown, renderedMarkdown) as unknown as string, 'text/html');

	markdownHtmlDoc.body.querySelectorAll('img')
		.forEach(img => {
			const src = img.getAttribute('src'); // Get the raw 'src' attribute value as text, not the resolved 'src'
			if (src) {
				let href = src;
				try {
					if (markdown.baseUri) { // absolute or relative local path, or file: uri
						href = resolveWithBaseUri(URI.from(markdown.baseUri), href);
					}
				} catch (err) { }

				img.src = _href(href, true);
			}
		});

	markdownHtmlDoc.body.querySelectorAll('a')
		.forEach(a => {
			const href = a.getAttribute('href'); // Get the raw 'href' attribute value as text, not the resolved 'href'
			a.setAttribute('href', ''); // Clear out href. We use the `data-href` for handling clicks instead
			if (
				!href
				|| /^data:|javascript:/i.test(href)
				|| (/^command:/i.test(href) && !markdown.isTrusted)
				|| /^command:(\/\/\/)?_workbench\.downloadResource/i.test(href)
			) {
				// drop the link
				a.replaceWith(...a.childNodes);
			} else {
				let resolvedHref = _href(href, false);
				if (markdown.baseUri) {
					resolvedHref = resolveWithBaseUri(URI.from(markdown.baseUri), href);
				}
				a.dataset.href = resolvedHref;
			}
		});

	element.innerHTML = sanitizeRenderedMarkdown(markdown, markdownHtmlDoc.body.innerHTML) as unknown as string;

	if (codeBlocks.length > 0) {
		Promise.all(codeBlocks).then((tuples) => {
			if (isDisposed) {
				return;
			}
			const renderedElements = new Map(tuples);
			const placeholderElements = element.querySelectorAll<HTMLDivElement>(`div[data-code]`);
			for (const placeholderElement of placeholderElements) {
				const renderedElement = renderedElements.get(placeholderElement.dataset['code'] ?? '');
				if (renderedElement) {
					DOM.reset(placeholderElement, renderedElement);
				}
			}
			options.asyncRenderCallback?.();
		});
	} else if (syncCodeBlocks.length > 0) {
		const renderedElements = new Map(syncCodeBlocks);
		const placeholderElements = element.querySelectorAll<HTMLDivElement>(`div[data-code]`);
		for (const placeholderElement of placeholderElements) {
			const renderedElement = renderedElements.get(placeholderElement.dataset['code'] ?? '');
			if (renderedElement) {
				DOM.reset(placeholderElement, renderedElement);
			}
		}
	}

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
			disposables.dispose();
		}
	};
}

function postProcessCodeBlockLanguageId(lang: string | undefined): string {
	if (!lang) {
		return '';
	}

	const parts = lang.split(/[\s+|:|,|\{|\?]/, 1);
	if (parts.length) {
		return parts[0];
	}
	return lang;
}

function resolveWithBaseUri(baseUri: URI, href: string): string {
	const hasScheme = /^\w[\w\d+.-]*:/.test(href);
	if (hasScheme) {
		return href;
	}

	if (baseUri.path.endsWith('/')) {
		return resolvePath(baseUri, href).toString();
	} else {
		return resolvePath(dirname(baseUri), href).toString();
	}
}

function sanitizeRenderedMarkdown(
	options: { isTrusted?: boolean | MarkdownStringTrustedOptions },
	renderedMarkdown: string,
): TrustedHTML {
	const { config, allowedSchemes } = getSanitizerOptions(options);
	dompurify.addHook('uponSanitizeAttribute', (element, e) => {
		if (e.attrName === 'style' || e.attrName === 'class') {
			if (element.tagName === 'SPAN') {
				if (e.attrName === 'style') {
					e.keepAttr = /^(color\:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z]+)+\));)?(background-color\:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z]+)+\));)?$/.test(e.attrValue);
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

	const hook = DOM.hookDomPurifyHrefAndSrcSanitizer(allowedSchemes);

	try {
		return dompurify.sanitize(renderedMarkdown, { ...config, RETURN_TRUSTED_TYPE: true });
	} finally {
		dompurify.removeHook('uponSanitizeAttribute');
		hook.dispose();
	}
}

export const allowedMarkdownAttr = [
	'align',
	'autoplay',
	'alt',
	'class',
	'controls',
	'data-code',
	'data-href',
	'height',
	'href',
	'loop',
	'muted',
	'playsinline',
	'poster',
	'src',
	'style',
	'target',
	'title',
	'width',
	'start',
];

function getSanitizerOptions(options: { readonly isTrusted?: boolean | MarkdownStringTrustedOptions }): { config: dompurify.Config; allowedSchemes: string[] } {
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
			ALLOWED_TAGS: [...DOM.basicMarkupHtmlTags],
			ALLOWED_ATTR: allowedMarkdownAttr,
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
	// values that are too long will freeze the UI
	let value = markdown.value ?? '';
	if (value.length > 100_000) {
		value = `${value.substr(0, 100_000)}…`;
	}

	const html = marked.parse(value, { renderer: plainTextRenderer.value }).replace(/&(#\d+|[a-zA-Z]+);/g, m => unescapeInfo.get(m) ?? m);

	return sanitizeRenderedMarkdown({ isTrusted: false }, html).toString();
}

const unescapeInfo = new Map<string, string>([
	['&quot;', '"'],
	['&nbsp;', ' '],
	['&amp;', '&'],
	['&#39;', '\''],
	['&lt;', '<'],
	['&gt;', '>'],
]);

const plainTextRenderer = new Lazy<marked.Renderer>(() => {
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
	return renderer;
});

function mergeRawTokenText(tokens: marked.Token[]): string {
	let mergedTokenText = '';
	tokens.forEach(token => {
		mergedTokenText += token.raw;
	});
	return mergedTokenText;
}

function completeSingleLinePattern(token: marked.Tokens.ListItem | marked.Tokens.Paragraph): marked.Token | undefined {
	for (const subtoken of token.tokens) {
		if (subtoken.type === 'text') {
			const lines = subtoken.raw.split('\n');
			const lastLine = lines[lines.length - 1];
			if (lastLine.includes('`')) {
				return completeCodespan(token);
			} else if (lastLine.includes('**')) {
				return completeDoublestar(token);
			} else if (lastLine.match(/\*\w/)) {
				return completeStar(token);
			} else if (lastLine.match(/(^|\s)__\w/)) {
				return completeDoubleUnderscore(token);
			} else if (lastLine.match(/(^|\s)_\w/)) {
				return completeUnderscore(token);
			} else if (lastLine.match(/(^|\s)\[.*\]\(\w*/)) {
				return completeLinkTarget(token);
			} else if (lastLine.match(/(^|\s)\[\w/)) {
				return completeLinkText(token);
			}
		}
	}

	return undefined;
}

// function completeListItemPattern(token: marked.Tokens.List): marked.Tokens.List | undefined {
// 	// Patch up this one list item
// 	const lastItem = token.items[token.items.length - 1];

// 	const newList = completeSingleLinePattern(lastItem);
// 	if (!newList || newList.type !== 'list') {
// 		// Nothing to fix, or not a pattern we were expecting
// 		return;
// 	}

// 	// Re-parse the whole list with the last item replaced
// 	const completeList = marked.lexer(mergeRawTokenText(token.items.slice(0, token.items.length - 1)) + newList.items[0].raw);
// 	if (completeList.length === 1 && completeList[0].type === 'list') {
// 		return completeList[0];
// 	}

// 	// Not a pattern we were expecting
// 	return undefined;
// }

export function fillInIncompleteTokens(tokens: marked.TokensList): marked.TokensList {
	let i: number;
	let newTokens: marked.Token[] | undefined;
	for (i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.type === 'paragraph' && token.raw.match(/(\n|^)```/)) {
			// If the code block was complete, it would be in a type='code'
			newTokens = completeCodeBlock(tokens.slice(i));
			break;
		}

		if (token.type === 'paragraph' && token.raw.match(/(\n|^)\|/)) {
			newTokens = completeTable(tokens.slice(i));
			break;
		}

		// if (i === tokens.length - 1 && token.type === 'list') {
		// 	const newListToken = completeListItemPattern(token);
		// 	if (newListToken) {
		// 		newTokens = [newListToken];
		// 		break;
		// 	}
		// }

		if (i === tokens.length - 1 && token.type === 'paragraph') {
			// Only operates on a single token, because any newline that follows this should break these patterns
			const newToken = completeSingleLinePattern(token);
			if (newToken) {
				newTokens = [newToken];
				break;
			}
		}
	}

	if (newTokens) {
		const newTokensList = [
			...tokens.slice(0, i),
			...newTokens
		];
		(newTokensList as marked.TokensList).links = tokens.links;
		return newTokensList as marked.TokensList;
	}

	return tokens;
}

function completeCodeBlock(tokens: marked.Token[]): marked.Token[] {
	const mergedRawText = mergeRawTokenText(tokens);
	return marked.lexer(mergedRawText + '\n```');
}

function completeCodespan(token: marked.Token): marked.Token {
	return completeWithString(token, '`');
}

function completeStar(tokens: marked.Token): marked.Token {
	return completeWithString(tokens, '*');
}

function completeUnderscore(tokens: marked.Token): marked.Token {
	return completeWithString(tokens, '_');
}

function completeLinkTarget(tokens: marked.Token): marked.Token {
	return completeWithString(tokens, ')');
}

function completeLinkText(tokens: marked.Token): marked.Token {
	return completeWithString(tokens, '](about:blank)');
}

function completeDoublestar(tokens: marked.Token): marked.Token {
	return completeWithString(tokens, '**');
}

function completeDoubleUnderscore(tokens: marked.Token): marked.Token {
	return completeWithString(tokens, '__');
}

function completeWithString(tokens: marked.Token[] | marked.Token, closingString: string): marked.Token {
	const mergedRawText = mergeRawTokenText(Array.isArray(tokens) ? tokens : [tokens]);

	// If it was completed correctly, this should be a single token.
	// Expecting either a Paragraph or a List
	return marked.lexer(mergedRawText + closingString)[0] as marked.Token;
}

function completeTable(tokens: marked.Token[]): marked.Token[] | undefined {
	const mergedRawText = mergeRawTokenText(tokens);
	const lines = mergedRawText.split('\n');

	let numCols: number | undefined; // The number of line1 col headers
	let hasSeparatorRow = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (typeof numCols === 'undefined' && line.match(/^\s*\|/)) {
			const line1Matches = line.match(/(\|[^\|]+)(?=\||$)/g);
			if (line1Matches) {
				numCols = line1Matches.length;
			}
		} else if (typeof numCols === 'number') {
			if (line.match(/^\s*\|/)) {
				if (i !== lines.length - 1) {
					// We got the line1 header row, and the line2 separator row, but there are more lines, and it wasn't parsed as a table!
					// That's strange and means that the table is probably malformed in the source, so I won't try to patch it up.
					return undefined;
				}

				// Got a line2 separator row- partial or complete, doesn't matter, we'll replace it with a correct one
				hasSeparatorRow = true;
			} else {
				// The line after the header row isn't a valid separator row, so the table is malformed, don't fix it up
				return undefined;
			}
		}
	}

	if (typeof numCols === 'number' && numCols > 0) {
		const prefixText = hasSeparatorRow ? lines.slice(0, -1).join('\n') : mergedRawText;
		const line1EndsInPipe = !!prefixText.match(/\|\s*$/);
		const newRawText = prefixText + (line1EndsInPipe ? '' : '|') + `\n|${' --- |'.repeat(numCols)}`;
		return marked.lexer(newRawText);
	}

	return undefined;
}
