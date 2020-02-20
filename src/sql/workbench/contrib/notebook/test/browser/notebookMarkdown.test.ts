/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as marked from 'vs/base/common/marked/marked';
import { NotebookMarkdownRenderer } from '../../browser/outputs/notebookMarkdown';
import { URI } from 'vs/base/common/uri';

suite('NotebookMarkdownRenderer', () => {
	let notebookMarkdownRenderer = new NotebookMarkdownRenderer();
	test('image rendering conforms to default', () => {
		const markdown = { value: `![image](someimageurl 'caption')` };
		const result: HTMLElement = notebookMarkdownRenderer.renderMarkdown(markdown);
		const renderer = new marked.Renderer();
		const imageFromMarked = marked(markdown.value, {
			sanitize: true,
			renderer
		}).trim();
		assert.strictEqual(result.innerHTML, imageFromMarked);
	});

	test('image rendering conforms to default without title', () => {
		const markdown = { value: `![image](someimageurl)` };
		const result: HTMLElement = notebookMarkdownRenderer.renderMarkdown(markdown);
		const renderer = new marked.Renderer();
		const imageFromMarked = marked(markdown.value, {
			sanitize: true,
			renderer
		}).trim();
		assert.strictEqual(result.innerHTML, imageFromMarked);
	});

	test('image width from title params', () => {
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `![image](someimageurl|width=100 'caption')` });
		assert.strictEqual(result.innerHTML, `<p><img src="someimageurl" alt="image" title="caption" width="100"></p>`);
	});

	test('image height from title params', () => {
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `![image](someimageurl|height=100 'caption')` });
		assert.strictEqual(result.innerHTML, `<p><img src="someimageurl" alt="image" title="caption" height="100"></p>`);
	});

	test('image width and height from title params', () => {
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `![image](someimageurl|height=200,width=100 'caption')` });
		assert.strictEqual(result.innerHTML, `<p><img src="someimageurl" alt="image" title="caption" width="100" height="200"></p>`);
	});

	test('link from local file path', () => {
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `[Link to File Path](someFileurl)`, isTrusted: true });
		assert.strictEqual(result.innerHTML, `<p><a href="someFileurl" data-href="someFileurl" title="someFileurl">Link to File Path</a></p>`);
	});

	test('link from relative file path', () => {
		notebookMarkdownRenderer.setNotebookURI(URI.parse('maddy/temp/file1.txt'));
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `[Link to relative path](../test/.build/someimageurl)`, isTrusted: true });
		if (process.platform === 'win32') {
			assert.strictEqual(result.innerHTML, `<p><a href="\\maddy\\test\\.build\\someimageurl" data-href="\\maddy\\test\\.build\\someimageurl" title="\\maddy\\test\\.build\\someimageurl">Link to relative path</a></p>`);
		} else {
			assert.strictEqual(result.innerHTML, `<p><a href="/maddy/test/.build/someimageurl" data-href="/maddy/test/.build/someimageurl" title="/maddy/test/.build/someimageurl">Link to relative path</a></p>`);
		}
	});
});
