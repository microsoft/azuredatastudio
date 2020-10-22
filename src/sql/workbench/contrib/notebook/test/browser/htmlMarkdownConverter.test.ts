/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { HTMLMarkdownConverter } from 'sql/workbench/contrib/notebook/browser/htmlMarkdownConverter';
import * as path from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';


suite('HTML Markdown Converter', function (): void {
	let htmlMarkdownConverter: HTMLMarkdownConverter;
	let htmlString: string;

	suiteSetup(() => {
		htmlMarkdownConverter = new HTMLMarkdownConverter(URI.file('/tmp/notebook.ipynb'));
		htmlString = '';
	});

	test('Should not alter HTML with no explicit elements', () => {
		htmlString = 'Hello World 123';
		assert.equal(htmlMarkdownConverter.convert(htmlString), htmlString, 'No tags test failed');
	});

	test('Should keep <u> tag intact', () => {
		htmlString = '<u>Hello test</u>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), htmlString, 'Basic underline test failed');
		htmlString = 'Hello <u>test</u>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), htmlString, 'Partial underline test failed');
		htmlString = '<p>Hello <u>test</u></p>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Hello <u>test</u>', 'Partial underline paragraph test failed');
		htmlString = '<h1>Hello <u>test</u></h1>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '# Hello <u>test</u>', 'Partial underline h1 test failed');
		htmlString = '<h2>Hello <u>test</u></h2>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '## Hello <u>test</u>', 'Partial underline h2 test failed');
		htmlString = '<h3>Hello <u>test</u></h3>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '### Hello <u>test</u>', 'Partial underline h3 test failed');
	});

	test('Should keep <mark> tag intact', () => {
		htmlString = '<mark>Hello test</mark>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), htmlString, 'Basic highlight test failed');
		htmlString = 'Hello <mark>test</mark>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), htmlString, 'Partial highlight test failed');
		htmlString = '<p>Hello <mark>test</mark></p>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Hello <mark>test</mark>', 'Partial highlight paragraph test failed');
		htmlString = '<h1>Hello <mark>test</mark></h1>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '# Hello <mark>test</mark>', 'Partial highlight h1 test failed');
		htmlString = '<h2>Hello <mark>test</mark></h2>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '## Hello <mark>test</mark>', 'Partial highlight h2 test failed');
		htmlString = '<h3>Hello <mark>test</mark></h3>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '### Hello <mark>test</mark>', 'Partial highlight h3 test failed');
	});

	test('Should transform <pre> tag with ```', () => {
		htmlString = '<pre>Hello test</pre>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '```\nHello test\n```', 'Basic pre test failed');
	});

	test('Should transform <span> tag', () => {
		htmlString = '<span>Hello test</span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Hello test', 'Basic span test failed');
		htmlString = 'Yes<span style="background-color: yellow">Hello test</span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Yes<mark>Hello test</mark>', 'Basic yellow highlight span failed');
		htmlString = 'Yes<span style="background-color:yellow">Hello test</span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Yes<mark>Hello test</mark>', 'Basic yellow highlight span no space failed');
		htmlString = 'Yes<span style="font-weight: bold">Hello test</span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Yes**Hello test**', 'Basic bold span failed');
		htmlString = 'Yes<span style="font-weight:bold">Hello test</span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Yes**Hello test**', 'Basic bold span no space failed');
		htmlString = 'Yes<span style="font-style: italic">Hello test</span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Yes_Hello test_', 'Basic italic span failed');
		htmlString = 'Yes<span style="font-style:italic">Hello test</span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Yes_Hello test_', 'Basic italic span no space failed');
		htmlString = 'Yes<span style="text-decoration-line: underline">Hello test</span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Yes<u>Hello test</u>', 'Basic underline span failed');
		htmlString = 'Yes<span style="text-decoration-line:underline">Hello test</span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), 'Yes<u>Hello test</u>', 'Basic underline span no space failed');
		htmlString = '<h1>Yes<span style="text-decoration-line:underline; font-style:italic; font-weight:bold; background-color: yellow">Hello test</span></h1>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '# Yes<u>_**<mark>Hello test</mark>**_</u>', 'Compound elements span failed');
		htmlString = '<span style="background-color: yellow;"><b>Hello test</b></span>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '<mark>**Hello test**</mark>', 'Span with inner html not parsed correctly');
		htmlString = '<b><span style="background-color: yellow;">Hello test</span></b>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '**<mark>Hello test</mark>**', 'Span inside bold tag parsed correctly');
	});

	test('Should transform <img> tag', () => {
		htmlString = '<img src="/tmp/stuff.png" alt="stuff">';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `![stuff](.${path.sep}stuff.png)`, 'Basic img test failed');
		htmlString = '<img src="/tmp/stuff.png">';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `![](.${path.sep}stuff.png)`, 'Basic img test no alt failed');
		htmlString = '<img src="/tmp/my stuff.png">';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `![](.${path.sep}my%20stuff.png)`, 'Basic img test no alt space filename failed');
		htmlString = '<img src="/tmp/inner/stuff.png" alt="stuff">';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `![stuff](.${path.sep}inner${path.sep}stuff.png)`, 'Basic img test below folder failed');
		htmlString = '<img src="/stuff.png" alt="stuff">';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `![stuff](..${path.sep}stuff.png)`, 'Basic img test above folder failed');
		// htmlString = '<img src="e:\\some\\other\\path.png">';
		// assert.equal(htmlMarkdownConverter.convert(htmlString), '![](e:\\some\\other\\path.png)', 'img test different drive failed');
		htmlString = '<img src="https://www.microsoft.com/images/msft.png" alt="msft">';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '![msft](https://www.microsoft.com/images/msft.png)', 'Basic https img test failed');
		htmlString = '<img src="http://www.microsoft.com/images/msft.png" alt="msft">';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '![msft](http://www.microsoft.com/images/msft.png)', 'Basic http img test failed');
	});

	test('Should transform <a> tag', () => {
		htmlString = '<a href="/tmp/stuff.png">stuff</a>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `[stuff](.${path.sep}stuff.png)`, 'Basic link test failed');
		htmlString = '<a href="/tmp/stuff.png"/>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `[](.${path.sep}stuff.png)`, 'Basic link test no label failed');
		htmlString = '<a href="/tmp/my stuff.png"/>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `[](.${path.sep}my%20stuff.png)`, 'Basic link test no label space filename failed');
		htmlString = '<a href="/stuff.png">stuff</a.';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `[stuff](..${path.sep}stuff.png)`, 'Basic link test above folder failed');
		htmlString = '<a href="/tmp/inner/stuff.png">stuff</a>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), `[stuff](.${path.sep}inner${path.sep}stuff.png)`, 'Basic link test below folder failed');
		// htmlString = '<a href="e:\\some\\other\\path.png"/>';
		// assert.equal(htmlMarkdownConverter.convert(htmlString), '[](e:\\some\\other\\path.png)', 'link test different drive failed');
		htmlString = '<a href="https://www.microsoft.com/images/msft.png">msft</a>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '[msft](https://www.microsoft.com/images/msft.png)', 'Basic https link test failed');
		htmlString = '<a href="http://www.microsoft.com/images/msft.png">msft</a>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '[msft](http://www.microsoft.com/images/msft.png)', 'Basic http link test failed');
	});
	test('Should transform <b> and <strong> tags', () => {
		htmlString = '<b>test string</b>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '**test string**', 'Basic bold test failed');
		htmlString = '<b style="background-color: yellow">test string</b>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '**<mark>test string</mark>**', 'Highlight bold test failed');
		htmlString = '<b style="background-color: yellow"><i>test string</i></b>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '**<mark>_test string_</mark>**', 'Highlight bold italic test failed');
		htmlString = '<b style="blah: nothing">test string</b>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '**test string**', 'Incorrect style bold test failed');
		htmlString = '<strong>test string</strong>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '**test string**', 'Basic strong test failed');
		htmlString = '<strong style="background-color: yellow">test string</strong>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '**<mark>test string</mark>**', 'Highlight strong test failed');
		htmlString = '<strong style="blah: nothing">test string</strong>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '**test string**', 'Incorrect style strong test failed');
	});
	test('Should transform <i> and <em> tags', () => {
		htmlString = '<i>test string</i>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '_test string_', 'Basic italic test failed');
		htmlString = '<i style="background-color: yellow">test string</i>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '_<mark>test string</mark>_', 'Highlight italic test failed');
		htmlString = '<i style="background-color: yellow"><b>test string</b></i>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '_<mark>**test string**</mark>_', 'Highlight italic bold test failed');
		htmlString = '<i style="blah: nothing">test string</i>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '_test string_', 'Incorrect style italic test failed');
		htmlString = '<em>test string</em>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '_test string_', 'Basic em test failed');
		htmlString = '<em style="background-color: yellow">test string</em>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '_<mark>test string</mark>_', 'Highlight em test failed');
		htmlString = '<em style="blah: nothing">test string</em>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '_test string_', 'Incorrect style em test failed');
		htmlString = '<em style="background-color: yellow"><b>test string</b></em>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '_<mark>**test string**</mark>_', 'Highlight em bold test failed');
	});
	test('Should transform <u> when necessary', () => {
		htmlString = '<u>test string</u>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), htmlString, 'Basic underline test failed');
		htmlString = '<u style="background-color: yellow">test string</u>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '<u><mark>test string</mark></u>', 'Highlight underline test failed');
		htmlString = '<b><u style="background-color: yellow">test string</u></b>';
		assert.equal(htmlMarkdownConverter.convert(htmlString), '**<u><mark>test string</mark></u>**', 'Underline as inner element failed');
	});
});
