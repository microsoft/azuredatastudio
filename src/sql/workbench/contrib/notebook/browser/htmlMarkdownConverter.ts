/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import TurndownService = require('turndown');
import { URI } from 'vs/base/common/uri';
import * as path from 'vs/base/common/path';
import * as turndownPluginGfm from 'sql/workbench/contrib/notebook/browser/turndownPluginGfm';
import { replaceInvalidLinkPath } from 'sql/workbench/contrib/notebook/common/utils';

// These replacements apply only to text. Here's how it's handled from Turndown:
// if (node.nodeType === 3) {
//	replacement = node.isCode ? node.nodeValue : self.escape(node.nodeValue);
// }
const markdownReplacements = [
	[/\\/g, '\\\\'],
	[/\*/g, '\\*'],
	[/^-/g, '\\-'],
	[/^\+ /g, '\\+ '],
	[/^(=+)/g, '\\$1'],
	[/^(#{1,6}) /g, '\\$1 '],
	[/`/g, '\\`'],
	[/^~~~/g, '\\~~~'],
	[/\[/g, '\\['],
	[/\]/g, '\\]'],
	[/^>/g, '\\>'],
	[/_/g, '\\_'],
	[/^(\d+)\. /g, '$1\\. '],
	[/</g, '\\<'], // Added to ensure sample text like <hello> is escaped
	[/>/g, '\\>'], // Added to ensure sample text like <hello> is escaped
];
export class HTMLMarkdownConverter {
	private turndownService: TurndownService;

	constructor(private notebookUri: URI) {
		this.turndownService = new TurndownService({ 'emDelimiter': '_', 'bulletListMarker': '-', 'headingStyle': 'atx', blankReplacement: blankReplacement });
		this.setTurndownOptions();
	}

	public convert(html: string): string {
		return this.turndownService.turndown(html, { gfm: true });
	}

	private setTurndownOptions() {
		this.turndownService.keep(['style']);
		this.turndownService.use(turndownPluginGfm.gfm);
		this.turndownService.addRule('pre', {
			filter: 'pre',
			replacement: function (content, node) {
				return '\n```\n' + node.textContent + '\n```\n';
			}
		});
		this.turndownService.addRule('mark', {
			filter: 'mark',
			replacement: (content, node) => {
				return '<mark>' + content + '</mark>';
			}
		});
		this.turndownService.addRule('underline', {
			filter: ['u'],
			replacement: (content, node, options) => {
				if (!content.trim()) {
					return '';
				}
				content = addHighlightIfYellowBgExists(node, content);
				return '<u>' + content + '</u>';
			}
		});
		this.turndownService.addRule('caption', {
			filter: 'caption',
			replacement: function (content, node) {
				return `${node.outerHTML}
				`;
			}
		});
		this.turndownService.addRule('span', {
			filter: 'span',
			replacement: function (content, node) {
				// There are certain properties that either don't have equivalents in markdown or whose transformations
				// don't have actions defined in WYSIWYG yet. To unblock users, leaving these elements alone (including their child elements)
				// Note: the initial list was generated from our TSG Jupyter Book
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
				return beginString + content + endString;
			}
		});
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
				let href = node.href;
				let notebookLink: URI | undefined;
				const isAnchorLinkInFile = (node.attributes.href?.nodeValue.startsWith('#') || href.includes('#')) && href.startsWith('file://');
				if (isAnchorLinkInFile) {
					notebookLink = getUriAnchorLink(node, this.notebookUri);
				} else {
					//On Windows, if notebook is not trusted then the href attr is removed for all non-web URL links
					// href contains either a hyperlink or a URI-encoded absolute path. (See resolveUrls method in notebookMarkdown.ts)
					notebookLink = href ? URI.parse(href) : URI.file(node.title);
				}
				const notebookFolder = this.notebookUri ? path.join(path.dirname(this.notebookUri.fsPath), path.sep) : '';
				if (notebookLink.fsPath !== this.notebookUri.fsPath) {
					let relativePath = findPathRelativeToContent(notebookFolder, notebookLink);
					if (relativePath) {
						return `[${node.innerText}](${relativePath})`;
					}
				} else if (notebookLink?.fragment) {
					// if the anchor link is to a section in the same notebook then just add the fragment
					return `[${content}](${notebookLink.fragment})`;
				}

				return `[${content}](${href})`;
			}
		});
		// Only nested list case differs from original turndown rule
		// This ensures that tightly coupled lists are treated as such and do not have excess newlines in markdown
		this.turndownService.addRule('list', {
			filter: ['ul', 'ol'],
			replacement: function (content, node) {
				let parent = node.parentNode;
				if ((parent.nodeName === 'LI' && parent.lastElementChild === node)) {
					return '\n' + content;
				} else if (parent.nodeName === 'UL' || parent.nodeName === 'OL') { // Nested list case
					return '\n' + content + '\n';
				} else {
					return '\n\n' + content + '\n\n';
				}
			}
		});
		this.turndownService.addRule('lineBreak', {
			filter: 'br',
			replacement: function (content, node, options) {
				// For elements that aren't lists, convert <br> into its markdown equivalent
				if (node.parentElement?.nodeName !== 'LI') {
					// Keeps <br> in table cell/head in order to keep new linehow
					if (node.parentElement?.nodeName === 'TD' || node.parentElement?.nodeName === 'TH') {
						return '<br>';
					}
					return options.br + '\n';
				}
				// One (and only one) line break is ignored when it's inside of a list item
				// Otherwise, a new list will be created due to the looseness of the list
				let numberLineBreaks = 0;
				(node.parentElement as HTMLElement)?.childNodes?.forEach(n => {
					if (n.nodeName === 'BR') {
						numberLineBreaks++;
					}
				});
				return numberLineBreaks > 1 ? options.br + '\n' : '';
			}
		});
		this.turndownService.addRule('listItem', {
			filter: 'li',
			replacement: function (content, node, options) {
				content = content
					.replace(/^\n+/, '') // remove leading newlines
					.replace(/\n+$/, '\n') // replace trailing newlines with just a single one
					.replace(/\n/gm, '\n    '); // indent
				let prefix = options.bulletListMarker + ' ';
				let parent = node.parentNode;
				let nestedCount = 0;
				if (parent.nodeName === 'OL') {
					let start = parent.getAttribute('start');
					let index = Array.prototype.indexOf.call(parent.children, node);
					prefix = (start ? Number(start) + index : index + 1) + '. ';
				} else if (parent.nodeName === 'UL') {
					while (parent?.nodeName === 'UL') {
						nestedCount++;
						parent = parent?.parentNode;
					}
					prefix = ('    '.repeat(nestedCount - 1)) + options.bulletListMarker + ' ';
				}
				return (
					prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
				);
			}
		});
		this.turndownService.addRule('heading', {
			filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
			replacement: function (content, node, options) {
				let hLevel = Number(node.nodeName.charAt(1));
				if (options.headingStyle === 'setext' && hLevel < 3) {
					let underline = '#'.repeat(hLevel);
					return '\n\n' + content + '\n' + underline + '\n\n';
				} else {
					return '\n\n' + '#'.repeat(hLevel) + ' ' + content + '\n\n';
				}
			}
		});
		this.turndownService.addRule('bold', {
			filter: ['strong', 'b'],
			replacement: function (content, node, options) {
				content = addHighlightIfYellowBgExists(node, content);
				if (!content.trim()) { return ''; }
				return options.strongDelimiter + content + options.strongDelimiter;
			}
		});
		this.turndownService.addRule('italicize', {
			filter: ['em', 'i'],
			replacement: function (content, node, options) {
				content = addHighlightIfYellowBgExists(node, content);
				if (!content.trim()) { return ''; }
				return options.emDelimiter + content + options.emDelimiter;
			}
		});
		this.turndownService.addRule('code', {
			filter: function (node) {
				let hasSiblings = node.previousSibling || node.nextSibling;
				let isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;

				return node.nodeName === 'CODE' && !isCodeBlock;
			},
			replacement: function (content, node, options) {
				if (!content.trim()) { return ''; }

				let delimiter = '`';
				let leadingSpace = '';
				let trailingSpace = '';
				let matches = content.match(/`+/gm);
				if (matches) {
					if (/^`/.test(content)) { leadingSpace = ' '; }
					if (/`$/.test(content)) { trailingSpace = ' '; }
					while (matches.indexOf(delimiter) !== -1) { delimiter = delimiter + '`'; }
				}

				return delimiter + leadingSpace + content + trailingSpace + delimiter;
			}
		});

		this.turndownService.addRule('p', {
			filter: 'p',
			replacement: function (content, node) {
				// If inside of a table cell, extra newlines would break table rendering
				return isInsideTable(node) ? content : '\n\n' + content + '\n\n';
			}
		});

		this.turndownService.escape = escapeMarkdown;
	}
}

function escapeMarkdown(text) {
	return markdownReplacements.reduce(
		(search, replacement) => search.replace(replacement[0], replacement[1]),
		text,
	);
}

function blankReplacement(content, node) {
	// When outdenting a nested list, an empty list will still remain. Need to handle this case.
	if (node.nodeName === 'UL' || node.nodeName === 'OL') {
		return '\n';
	} else if (isInsideTable(node)) {
		return '  ';
	}
	return node.isBlock ? '\n\n' : '';
}

function isInsideTable(node): boolean {
	return node.parentNode?.nodeName === 'TH' || node.parentNode?.nodeName === 'TD';
}

export function findPathRelativeToContent(notebookFolder: string, contentPath: URI | undefined): string {
	if (notebookFolder) {
		if (contentPath?.scheme === 'file') {
			let relativePath = contentPath.fragment ? path.relative(notebookFolder, contentPath.fsPath).concat('#', contentPath.fragment) : path.relative(notebookFolder, contentPath.fsPath);
			//if path contains whitespaces then it's not identified as a link
			relativePath = relativePath.replace(/\s/g, '%20');
			// if relativePath contains improper directory format due to marked js parsing returning an invalid path (ex. ....\) then we need to replace it to ensure the directories are formatted properly (ex. ..\..\)
			relativePath = replaceInvalidLinkPath(relativePath);
			if (relativePath.startsWith(path.join('..', path.sep)) || relativePath.startsWith(path.join('.', path.sep))) {
				return relativePath;
			} else {
				// if the relative path does not contain ./ at the beginning, we need to add it so it's recognized as a link
				return `.${path.join(path.sep, relativePath)}`;
			}
		}
	}
	return '';
}

export function addHighlightIfYellowBgExists(node, content: string): string {
	if (node?.style?.backgroundColor === 'yellow') {
		return '<mark>' + content + '</mark>';
	}
	return content;
}

export function getUriAnchorLink(node, notebookUri: URI): URI {
	const sectionLinkToAnotherFile = node.href.includes('#') && !node.attributes.href?.nodeValue.startsWith('#');
	if (sectionLinkToAnotherFile) {
		let absolutePath = !path.isAbsolute(node.attributes.href?.nodeValue) ? path.resolve(path.dirname(notebookUri.fsPath), node.attributes.href?.nodeValue) : node.attributes.href?.nodeValue;
		// if section link is different from the current notebook
		return URI.file(absolutePath);
	} else {
		// else build an uri using the current notebookUri
		return URI.from({ scheme: 'file', path: notebookUri.path, fragment: node.attributes.href?.nodeValue });
	}
}
