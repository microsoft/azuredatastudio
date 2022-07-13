/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const MarkdownIt: typeof import('markdown-it') = require('markdown-it');
import * as DOMPurify from 'dompurify';
import type * as MarkdownItToken from 'markdown-it/lib/token';
import type { ActivationFunction } from 'vscode-notebook-renderer';

const sanitizerOptions: DOMPurify.Config = {
	ALLOWED_TAGS: ['a', 'button', 'blockquote', 'code', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'input', 'label', 'li', 'p', 'pre', 'select', 'small', 'span', 'strong', 'textarea', 'ul', 'ol'],
};

export const activate: ActivationFunction<void> = (ctx) => {
	let markdownIt = new MarkdownIt({
		html: true
	});
	addNamedHeaderRendering(markdownIt);

	const style = document.createElement('style');
	style.textContent = `
		.emptyMarkdownCell::before {
			content: "${document.documentElement.style.getPropertyValue('--notebook-cell-markup-empty-content')}";
			font-style: italic;
			opacity: 0.6;
		}

		img {
			max-width: 100%;
			max-height: 100%;
		}

		a {
			text-decoration: none;
		}

		a:hover {
			text-decoration: underline;
		}

		a:focus,
		input:focus,
		select:focus,
		textarea:focus {
			outline: 1px solid -webkit-focus-ring-color;
			outline-offset: -1px;
		}

		hr {
			border: 0;
			height: 2px;
			border-bottom: 2px solid;
		}

		h1 {
			font-size: 2.25em;
		}

		h2 {
			font-size: 1.9em;
		}

		h3 {
			font-size: 1.6em;
		}

		p {
			font-size: 1.1em;
		}

		h1,
		h2,
		h3 {
			font-weight: normal;
		}

		div {
			width: 100%;
		}

		/* Adjust margin of first item in markdown cell */
		*:first-child {
			margin-top: 0px;
		}

		/* h1 tags don't need top margin */
		h1:first-child {
			margin-top: 0;
		}

		/* Removes bottom margin when only one item exists in markdown cell */
		*:only-child,
		*:last-child {
			margin-bottom: 0;
			padding-bottom: 0;
		}

		/* makes all markdown cells consistent */
		div {
			min-height: var(--notebook-markdown-min-height);
		}

		table {
			border-collapse: collapse;
			border-spacing: 0;
		}

		table th,
		table td {
			border: 1px solid;
		}

		table > thead > tr > th {
			text-align: left;
			border-bottom: 1px solid;
		}

		table > thead > tr > th,
		table > thead > tr > td,
		table > tbody > tr > th,
		table > tbody > tr > td {
			padding: 5px 10px;
		}

		table > tbody > tr + tr > td {
			border-top: 1px solid;
		}

		blockquote {
			margin: 0 7px 0 5px;
			padding: 0 16px 0 10px;
			border-left-width: 5px;
			border-left-style: solid;
		}

		code,
		.code {
			font-size: 1em;
			line-height: 1.357em;
		}

		.code {
			white-space: pre-wrap;
		}
	`;
	const template = document.createElement('template');
	template.classList.add('markdown-style');
	template.content.appendChild(style);
	document.head.appendChild(template);

	return {
		renderOutputItem: (outputInfo, element) => {
			let previewNode: HTMLElement;
			if (!element.shadowRoot) {
				const previewRoot = element.attachShadow({ mode: 'open' });

				// Insert styles into markdown preview shadow dom so that they are applied.
				// First add default webview style
				const defaultStyles = document.getElementById('_defaultStyles') as HTMLStyleElement;
				previewRoot.appendChild(defaultStyles.cloneNode(true));

				// And then contributed styles
				for (const element of document.getElementsByClassName('markdown-style')) {
					if (element instanceof HTMLTemplateElement) {
						previewRoot.appendChild(element.content.cloneNode(true));
					} else {
						previewRoot.appendChild(element.cloneNode(true));
					}
				}

				previewNode = document.createElement('div');
				previewNode.id = 'preview';
				previewRoot.appendChild(previewNode);
			} else {
				previewNode = element.shadowRoot.getElementById('preview')!;
			}

			const text = outputInfo.text();
			if (text.trim().length === 0) {
				previewNode.innerText = '';
				previewNode.classList.add('emptyMarkdownCell');
			} else {
				previewNode.classList.remove('emptyMarkdownCell');

				const unsanitizedRenderedMarkdown = markdownIt.render(text);
				previewNode.innerHTML = <any>(ctx.workspace.isTrusted
					? unsanitizedRenderedMarkdown
					: DOMPurify.sanitize(unsanitizedRenderedMarkdown, sanitizerOptions));
			}
		},
		extendMarkdownIt: (f: (md: typeof markdownIt) => void) => {
			f(markdownIt);
		}
	};
};


function addNamedHeaderRendering(md: InstanceType<typeof MarkdownIt>): void {
	const slugCounter = new Map<string, number>();

	const originalHeaderOpen = md.renderer.rules.heading_open;
	md.renderer.rules.heading_open = (tokens: MarkdownItToken[], idx: number, options, env, self) => {
		const title = tokens[idx + 1].children!.reduce<string>((acc, t) => acc + t.content, '');
		let slug = slugFromHeading(title);

		if (slugCounter.has(slug)) {
			const count = slugCounter.get(slug)!;
			slugCounter.set(slug, count + 1);
			slug = slugFromHeading(slug + '-' + (count + 1));
		} else {
			slugCounter.set(slug, 0);
		}

		tokens[idx].attrSet('id', slug);

		if (originalHeaderOpen) {
			return originalHeaderOpen(tokens, idx, options, env, self);
		} else {
			return self.renderToken(tokens, idx, options);
		}
	};

	const originalRender = md.render;
	md.render = function () {
		slugCounter.clear();
		return originalRender.apply(this, arguments as any);
	};
}

function slugFromHeading(heading: string): string {
	const slugifiedHeading = encodeURI(
		heading.trim()
			.toLowerCase()
			.replace(/\s+/g, '-') // Replace whitespace with -
			.replace(/[\]\[\!\'\#\$\%\&\(\)\*\+\,\.\/\:\;\<\=\>\?\@\\\^\_\{\|\}\~\`。，、；：？！…—·ˉ¨‘’“”々～‖∶＂＇｀｜〃〔〕〈〉《》「」『』．〖〗【】（）［］｛｝]/g, '') // Remove known punctuators
			.replace(/^\-+/, '') // Remove leading -
			.replace(/\-+$/, '') // Remove trailing -
	);
	return slugifiedHeading;
}
