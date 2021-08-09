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
		assert.strictEqual(result.innerHTML, `<p><a href="someFileurl" data-href="someFileurl" title="someFileurl" is-absolute="false">Link to File Path</a></p>`);
	});

	test('link from relative file path', () => {
		notebookMarkdownRenderer.setNotebookURI(URI.parse(`foo/temp/file1.txt`));
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `[Link to relative path](../test/build/someimageurl)`, isTrusted: true });
		if (process.platform === 'win32') {
			assert.strictEqual(result.innerHTML, `<p><a href="\\foo\\test\\build\\someimageurl" data-href="\\foo\\test\\build\\someimageurl" title="\\foo\\test\\build\\someimageurl" is-absolute="false">Link to relative path</a></p>`);
		} else {
			assert.strictEqual(result.innerHTML, `<p><a href="/foo/test/build/someimageurl" data-href="/foo/test/build/someimageurl" title="/foo/test/build/someimageurl" is-absolute="false">Link to relative path</a></p>`);
		}
	});

	// marked js test that alters the relative path requiring regex replace to resolve path properly
	// Issue tracked here: https://github.com/markedjs/marked/issues/2135
	test('marked js compiles relative link incorrectly', () => {
		const markedPath = marked.parse('..\\..\\test.ipynb');
		assert.strict(markedPath, '<p>....\test.ipynb</p>');
	});

	test('email in markdown format renders properly', () => {
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `[test@email.com](mailto:test@email.com)`, isTrusted: true });
		assert.strictEqual(result.innerHTML, `<p><a href="mailto:test@email.com" data-href="mailto:test@email.com" title="mailto:test@email.com" is-absolute="false">test@email.com</a></p>`);
	});

	test('email inserted directly renders properly', () => {
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `test@email.com`, isTrusted: true });
		assert.strictEqual(result.innerHTML, `<p><a href="mailto:test@email.com" data-href="mailto:test@email.com" title="mailto:test@email.com" is-absolute="false">test@email.com</a></p>`);
	});

	test('link to https with query parameters', () => {
		let result: HTMLElement = notebookMarkdownRenderer.renderMarkdown({ value: `[test](https://www.test.com?test=&test2=)`, isTrusted: true });
		assert.strictEqual(result.innerHTML, `<p><a href="https://www.test.com?test=&amp;test2=" data-href="https://www.test.com?test=&amp;test2=" title="https://www.test.com?test=&amp;test2=" is-absolute="false">test</a></p>`);
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

	/**
	 * This suite contains tests that verify the expected parsing results for the current version of marked.js which were determined to have
	 * changed in newer versions of marked.js being brought in. They are put here as a staging ground to keep track of these differences, but once the
	 * differences are understood should be moved out into a generic test like the ones above.
	 */
	suite('parse output differences between current marked.js and newer versions', function (): void {
		test('1', function (): void {
			const markdown = '1) Item 1\n\n2) Item 2\n\n 1) Sub-item 1\n\n 2) Sub-item 2\n\n';
			const expectedValue = '<ol>\n<li><p>Item 1</p></li>\n<li><p>Item 2</p><ol>\n<li><p>Sub-item 1</p></li>\n<li><p>Sub-item 2</p></li>\n</ol>\n</li>\n</ol>\n';
			const result = notebookMarkdownRenderer.renderMarkdown({ value: markdown, isTrusted: true }).innerHTML;
			assert.strictEqual(result, expectedValue);
		});

		test('2', function (): void {
			const markdown = '    ![](attachment:image.png)';
			const expectedValue = '<pre><code>![](attachment:image.png)</code></pre>\n';
			const result = notebookMarkdownRenderer.renderMarkdown({ value: markdown, isTrusted: true }).innerHTML;
			assert.strictEqual(result, expectedValue);
		});

		test('3', function (): void {
			const markdown = 'Some text **%appdata%\\*****Path\\\\To\\\\Folder\\\\<******FileName**>.ext** into **...\\\\Another\\\\****Path\\\\**\n\n';
			const expectedValue = '<p>Some text <strong>%appdata%***</strong>Path\\To\\Folder\\&lt;******FileName**&gt;.ext** into <strong>...\\Another\\**</strong>Path\\**</p>';
			const result = notebookMarkdownRenderer.renderMarkdown({ value: markdown, isTrusted: true }).innerHTML;
			assert.strictEqual(result, expectedValue);
		});

		test('4', function (): void {
			const markdown = '# Heading 1\n- Some text\n\n    \n\n- ## Heading 2';
			const expectedValue = '<h1 id="heading-1">Heading 1</h1>\n<ul>\n<li>Some text</li>\n</ul>\n<ul>\n<li><h2 id="heading-2">Heading 2</h2>\n</li>\n</ul>\n';
			const result = notebookMarkdownRenderer.renderMarkdown({ value: markdown, isTrusted: true }).innerHTML;
			assert.strictEqual(result, expectedValue);
		});

		test('5', function (): void {
			const markdown = `Some text\n\n      Some more text`;
			const expectedValue = '<p>Some text</p><pre><code>  Some more text</code></pre>\n';
			const result = notebookMarkdownRenderer.renderMarkdown({ value: markdown, isTrusted: true }).innerHTML;
			assert.strictEqual(result, expectedValue);
		});

		test('6', function (): void {
			const markdown = `# heading\n##`;
			const expectedValue = `<h1 id="heading">heading</h1>\n<p>##</p>`;
			const result = notebookMarkdownRenderer.renderMarkdown({ value: markdown, isTrusted: true }).innerHTML;
			assert.strictEqual(result, expectedValue);
		});
	});
});
