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
		notebookMarkdownRenderer.setNotebookURI(URI.parse(`foo/temp/file1.txt`));
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `[Link to relative path](../test/.build/someimageurl)`, isTrusted: true });
		if (process.platform === 'win32') {
			assert.strictEqual(result.innerHTML, `<p><a href="\\foo\\test\\.build\\someimageurl" data-href="\\foo\\test\\.build\\someimageurl" title="\\foo\\test\\.build\\someimageurl">Link to relative path</a></p>`);
		} else {
			assert.strictEqual(result.innerHTML, `<p><a href="/foo/test/.build/someimageurl" data-href="/foo/test/.build/someimageurl" title="/foo/test/.build/someimageurl">Link to relative path</a></p>`);
		}
	});

	// marked js test that alters the relative path requiring regex replace to resolve path properly
	// Issue tracked here: https://github.com/markedjs/marked/issues/2135
	test('marked js compiles relative link incorrectly', () => {
		const markedPath = marked.parse('..\\..\\test.ipynb');
		assert.strict(markedPath, '<p>....\test.ipynb</p>');
	});

	test('cell attachment image', () => {
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `![altText](attachment:ads.png)`, isTrusted: true }, { cellAttachments: JSON.parse('{"ads.png":{"image/png":"iVBORw0KGgoAAAANSUhEUgAAAggg=="}}') });
		assert.strictEqual(result.innerHTML, `<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAggg==" alt="altText"></p>`, 'Cell attachment basic test failed when trusted');

		result = notebookMarkdownRenderer.renderMarkdown({ value: `![altText](attachment:ads.png)`, isTrusted: false }, { cellAttachments: JSON.parse('{"ads.png":{"image/png":"iVBORw0KGgoAAAANSUhEUgAAAggg=="}}') });
		assert.strictEqual(result.innerHTML, `<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAggg==" alt="altText"></p>`, 'Cell attachment basic test failed when not trusted');

		result = notebookMarkdownRenderer.renderMarkdown({ value: `![altText](attachment:ads.png)`, isTrusted: true });
		assert.strictEqual(result.innerHTML, `<p><img src="attachment:ads.png" alt="altText"></p>`, 'Cell attachment no attachment included failed');

		result = notebookMarkdownRenderer.renderMarkdown({ value: `![altText](attachment:ads.png)`, isTrusted: true }, { cellAttachments: JSON.parse('{"ads2.png":{"image/png":"iVBORw0KGgoAAAANSUhEUgAAAggg=="}}') });
		assert.strictEqual(result.innerHTML, `<p><img src="attachment:ads.png" alt="altText"></p>`, 'Cell attachment name not found failed');

		result = notebookMarkdownRenderer.renderMarkdown({ value: `![altText](attachments:ads.png)`, isTrusted: true }, { cellAttachments: JSON.parse('{"ads2.png":{"image/png":"iVBORw0KGgoAAAANSUhEUgAAAggg=="}}') });
		assert.strictEqual(result.innerHTML, `<p><img src="attachments:ads.png" alt="altText"></p>`, 'Cell attachment scheme mismatch failed');

		result = notebookMarkdownRenderer.renderMarkdown({ value: `![altText](attachment:ads.png)`, isTrusted: true }, { cellAttachments: JSON.parse('{"ads2.png":"image/png"}') });
		assert.strictEqual(result.innerHTML, `<p><img src="attachment:ads.png" alt="altText"></p>`, 'Cell attachment no image data failed');
	});
});
