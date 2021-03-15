/*
The Source EULA (MIT)

Copyright (c) 2017 Dom Christie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const highlightRegExp = /highlight-(?:text|source)-([a-z0-9]+)/;

export function highlightedCodeBlock(turndownService) {
	turndownService.addRule('highlightedCodeBlock', {
		filter: function (node) {
			let firstChild = node.firstChild;
			return (
				node.nodeName === 'DIV' &&
				highlightRegExp.test(node.className) &&
				firstChild &&
				firstChild.nodeName === 'PRE'
			);
		},
		replacement: function (content, node, options) {
			let className = node.className || '';
			let language = (className.match(highlightRegExp) || [null, ''])[1];

			return (
				'\n\n' + options.fence + language + '\n' +
				node.firstChild.textContent +
				'\n' + options.fence + '\n\n'
			);
		}
	});
}

export function strikethrough(turndownService) {
	turndownService.addRule('strikethrough', {
		filter: ['del', 's', 'strike'],
		replacement: function (content) {
			return '~' + content + '~';
		}
	});
}
let rules = {};

rules['tableCell'] = {
	filter: ['th', 'td'],
	replacement: function (content, node) {
		return cell(content, node);
	}
};

rules['tableRow'] = {
	filter: 'tr',
	replacement: function (content, node) {
		let borderCells = '';
		let alignMap = { left: ':--', right: '--:', center: ':-:' };

		if (isHeadingRow(node)) {
			for (let i = 0; i < node.childNodes.length; i++) {
				let border = '---';
				let align = (
					node.childNodes[i].getAttribute('align') || ''
				).toLowerCase();

				if (align) {
					border = alignMap[align] || border;
				}

				borderCells += cell(border, node.childNodes[i]);
			}
		}
		return '\n' + content + (borderCells ? '\n' + borderCells : '');
	}
};

rules['table'] = {
	// Only convert tables with a heading row.
	// Tables with no heading row are kept using `keep` (see below).
	filter: function (node) {
		return node.nodeName === 'TABLE' && isHeadingRow(node.rows[0]);
	},
	replacement: function (content, node) {
		// Ensure there are no blank lines
		content = content.replace('\n\n', '\n');
		return '\n\n' + content + '\n\n';
	}
};

rules['tableSection'] = {
	filter: ['thead', 'tbody', 'tfoot'],
	replacement: function (content) {
		return content;
	}
};

// A tr is a heading row if:
// - the parent is a THEAD
// - or if its the first child of the TABLE or the first TBODY (possibly
//   following a blank THEAD)
// - and every cell is a TH
function isHeadingRow(tr) {
	let parentNode = tr.parentNode;
	return (
		parentNode.nodeName === 'THEAD' ||
		(
			parentNode.firstChild === tr &&
			(parentNode.nodeName === 'TABLE' || isFirstTbody(parentNode)) &&
			Array.prototype.every.call(tr.childNodes, function (n) { return n.nodeName === 'TH'; })
		)
	);
}

function isFirstTbody(element) {
	let previousSibling = element.previousSibling;
	return (
		element.nodeName === 'TBODY' && (
			!previousSibling ||
			(
				previousSibling.nodeName === 'THEAD' &&
				/^\s*$/i.test(previousSibling.textContent)
			)
		)
	);
}

function cell(content, node) {
	let index = Array.prototype.indexOf.call(node.parentNode.childNodes, node);
	let prefix = ' ';
	if (index === 0) {
		prefix = '| ';
	}
	return prefix + content + ' |';
}

export function tables(turndownService) {
	turndownService.keep(function (node) {
		return node.nodeName === 'TABLE' && !isHeadingRow(node.rows[0]);
	});
	for (let key in rules) {
		turndownService.addRule(key, rules[key]);
	}
}

export function taskListItems(turndownService) {
	turndownService.addRule('taskListItems', {
		filter: function (node) {
			return node.type === 'checkbox' && node.parentNode.nodeName === 'LI';
		},
		replacement: function (content, node) {
			return (node.checked ? '[x]' : '[ ]') + ' ';
		}
	});
}

export function gfm(turndownService) {
	turndownService.use([
		highlightedCodeBlock,
		strikethrough,
		tables,
		taskListItems
	]);
}
