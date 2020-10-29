/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import TurndownService = require('turndown');
import { URI } from 'vs/base/common/uri';
import * as path from 'vs/base/common/path';
import * as turndownPluginGfm from 'sql/workbench/contrib/notebook/browser/turndownPluginGfm';

export class HTMLMarkdownConverter {
	private turndownService: TurndownService;

	constructor(private notebookUri: URI) {
		this.turndownService = new TurndownService({ 'emDelimiter': '_', 'bulletListMarker': '-', 'headingStyle': 'atx' });
		this.setTurndownOptions();
	}

	public convert(html: string): string {
		return this.turndownService.turndown(html, { gfm: true });
	}

	private setTurndownOptions() {
		this.turndownService.keep(['u', 'mark', 'style']);
		this.turndownService.use(turndownPluginGfm.gfm);
		this.turndownService.addRule('pre', {
			filter: 'pre',
			replacement: function (content, node) {
				return '\n```\n' + node.textContent + '\n```\n';
			}
		});
		this.turndownService.addRule('caption', {
			filter: 'caption',
			replacement: function (content, node) {
				return `${node.outerHTML}
				`;
			}
		});
		// this.turndownService.addRule('span', {
		// 	filter: 'span',
		// 	replacement: function (content, node) {
		// 		// There are certain properties that either don't have equivalents in markdown or whose transformations
		// 		// don't have actions defined in WYSIWYG yet. To unblock users, leaving these elements alone (including their child elements)
		// 		// Note: the initial list was generated from our TSG Jupyter Book
		// 		if (node && node.style) {
		// 			if (node.style.color ||
		// 				node.style.fontSize ||
		// 				(node.style.backgroundColor && node.style.backgroundColor !== 'yellow') ||
		// 				(node.style.background && node.style.background !== 'yellow') ||
		// 				node.style.lineHeight ||
		// 				node.style.marginLeft ||
		// 				node.style.marginBottom ||
		// 				node.style.textAlign
		// 			) {
		// 				return node.outerHTML;
		// 			}
		// 		}
		// 		let beginString = '';
		// 		let endString = '';
		// 		// TODO: handle other background colors and more styles
		// 		if (node?.style?.backgroundColor === 'yellow') {
		// 			beginString = '<mark>' + beginString;
		// 			endString += '</mark>';
		// 		}
		// 		if (node?.style?.fontWeight === 'bold') {
		// 			beginString = '**' + beginString;
		// 			endString += '**';
		// 		}
		// 		if (node?.style?.fontStyle === 'italic') {
		// 			beginString = '_' + beginString;
		// 			endString += '_';
		// 		}
		// 		if (node?.style?.textDecorationLine === 'underline') {
		// 			beginString = '<u>' + beginString;
		// 			endString += '</u>';
		// 		}
		// 		return beginString + content + endString;
		// 	}
		// });
		this.turndownService.addRule('img', {
			filter: 'img',
			replacement: (content, node) => {
				if (node?.src) {
					let imgPath = URI.parse(node.src);
					const notebookFolder: string = this.notebookUri ? path.join(path.dirname(this.notebookUri.fsPath), path.sep) : '';
					let relativePath = findPathRelativeToContent(notebookFolder, imgPath);
					if (relativePath) {
						return `![${node.alt}](${relativePath})`;
					}
				}
				return `![${node.alt}](${node.src})`;
			}
		});
		this.turndownService.addRule('a', {
			filter: 'a',
			replacement: (content, node) => {
				//On Windows, if notebook is not trusted then the href attr is removed for all non-web URL links
				// href contains either a hyperlink or a URI-encoded absolute path. (See resolveUrls method in notebookMarkdown.ts)
				const notebookLink = node.href ? URI.parse(node.href) : URI.file(node.title);
				const notebookFolder = this.notebookUri ? path.join(path.dirname(this.notebookUri.fsPath), path.sep) : '';
				let relativePath = findPathRelativeToContent(notebookFolder, notebookLink);
				if (relativePath) {
					return `[${node.innerText}](${relativePath})`;
				}
				return `[${node.innerText}](${node.href})`;
			}
		});

		this.turndownService.addRule('escapeAngleBrackets', {
			filter: ['span', 'p', 'h1', 'h2', 'h3', 'u', 'mark'],
			replacement: function (content, node) {


				let text = node.textContent;
				let mapTags = { '<': '\\<', '>': '\\>' };

				let escapedText = text.replace(/<|>/gi, function (matched) {
					return mapTags[matched];
				});

				if (node.localName === 'span') {
					// span text
					if (node && node.style) {
						if (node.style.color ||
							node.style.fontSize ||
							(node.style.backgroundColor && node.style.backgroundColor !== 'yellow') ||
							(node.style.background && node.style.background !== 'yellow') ||
							node.style.lineHeight ||
							node.style.marginLeft ||
							node.style.marginBottom ||
							node.style.textAlign
						) {
							return node.outerHTML;
						}
					}

					let beginString = '';
					let endString = '';
					// TODO: handle other background colors and more styles
					if (node?.style?.backgroundColor === 'yellow') {
						beginString = '<mark>' + beginString;
						endString += '</mark>';
					}
					if (node?.style?.fontWeight === 'bold') {
						beginString = '**' + beginString;
						endString += '**';
					}
					if (node?.style?.fontStyle === 'italic') {
						beginString = '_' + beginString;
						endString += '_';
					}
					if (node?.style?.textDecorationLine === 'underline') {
						beginString = '<u>' + beginString;
						endString += '</u>';
					}
					return beginString + escapedText + endString;

				} else if (node.localName === 'p') {
					return '\n\n' + escapedText + '\n\n';
				}
				return escapedText;
			}
		});
	}
}

export function findPathRelativeToContent(notebookFolder: string, contentPath: URI | undefined): string {
	if (notebookFolder) {
		if (contentPath?.scheme === 'file') {
			let relativePath = path.relative(notebookFolder, contentPath.fsPath);
			//if path contains whitespaces then it's not identified as a link
			relativePath = relativePath.replace(/\s/g, '%20');
			if (relativePath.startsWith(path.join('..', path.sep) || path.join('.', path.sep))) {
				return relativePath;
			} else {
				// if the relative path does not contain ./ at the beginning, we need to add it so it's recognized as a link
				return `.${path.join(path.sep, relativePath)}`;
			}
		}
	}
	return '';
}
