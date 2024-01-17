/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';
import { NotebookLinkHandler } from 'sql/workbench/contrib/notebook/browser/notebookLinkHandler';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';

suite('Noteboook Link Handler', function (): void {
	let notebookUri = URI.file('/tmp/notebook.ipynb');
	let configurationService: TestConfigurationService;

	suiteSetup(() => {
		configurationService = new TestConfigurationService();
	});

	test('Should return absolute path and links properly given string link', () => {
		let result = new NotebookLinkHandler(notebookUri, 'https://www.microsoft.com/images/msft.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `https://www.microsoft.com/images/msft.png`, 'HTTPS link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, 'http://www.microsoft.com/images/msft.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `http://www.microsoft.com/images/msft.png`, 'HTTP link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, `/tmp/stuff.png`, configurationService);
		assert.strictEqual(result.getLinkUrl(), `/tmp/stuff.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, '/stuff.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `/stuff.png`, 'Basic link test above folder failed');
		result = new NotebookLinkHandler(notebookUri, '/tmp/inner/stuff.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `/tmp/inner/stuff.png`, 'Basic link test below folder failed');
	});

	test('Should return relative path and links given anchor element', () => {
		let result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: 'https://www.microsoft.com/images/msft.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `https://www.microsoft.com/images/msft.png`, 'HTTPS link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: 'http://www.microsoft.com/images/msft.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `http://www.microsoft.com/images/msft.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/stuff.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `.${path.sep}stuff.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/stuff.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `..${path.sep}stuff.png`, 'Basic link test above folder failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/inner/stuff.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `.${path.sep}inner${path.sep}stuff.png`, 'Basic link test below folder failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/other/stuff.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `..${path.sep}other${path.sep}stuff.png`, 'Basic link test in different above folder failed');
	});

	test('Should return anchor links', () => {
		let result = new NotebookLinkHandler(notebookUri, '#hello', configurationService);
		assert.strictEqual(result.getLinkUrl(), `#hello`, 'Basic link to a section failed');

		result = new NotebookLinkHandler(notebookUri, 'file.md#hello', configurationService);
		assert.strictEqual(result.getLinkUrl(), `file.md#hello`, 'Basic anchor link to a section failed');

		result = new NotebookLinkHandler(notebookUri, 'http://www.microsoft.com/images/msft.png#Hello', configurationService);
		assert.strictEqual(result.getLinkUrl(), `http://www.microsoft.com/images/msft.png#Hello`, 'Http link containing # sign failed');
	});

	test('Should return absolute links with keep absolute path setting', () => {
		configurationService.updateValue('notebook.useAbsoluteFilePaths', true, ConfigurationTarget.USER);
		let result = new NotebookLinkHandler(notebookUri, 'https://www.microsoft.com/images/msft.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `https://www.microsoft.com/images/msft.png`, 'HTTPS link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, 'http://www.microsoft.com/images/msft.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `http://www.microsoft.com/images/msft.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, '/tmp/stuff.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `/tmp/stuff.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, '/stuff.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `/stuff.png`, 'Basic link test above folder failed');

		result = new NotebookLinkHandler(notebookUri, '/tmp/inner/stuff.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `/tmp/inner/stuff.png`, 'Basic link test below folder failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: 'https://www.microsoft.com/images/msft.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `https://www.microsoft.com/images/msft.png`, 'HTTPS link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: 'http://www.microsoft.com/images/msft.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `http://www.microsoft.com/images/msft.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/stuff.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `.${path.sep}stuff.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/stuff.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `..${path.sep}stuff.png`, 'Basic link test above folder failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/inner/stuff.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `.${path.sep}inner${path.sep}stuff.png`, 'Basic link test below folder failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/my stuff.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `.${path.sep}my%20stuff.png`, 'Basic link test with space filename failed');

		result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/my%20stuff.png' }), configurationService);
		assert.strictEqual(result.getLinkUrl(), `.${path.sep}my%2520stuff.png`, 'Basic link test with %20 filename failed');
	});

	test('Should return correctly encoded url/filePath', () => {
		test('when given an already-encoded URL', () => {
			let notebookLinkHandler = new NotebookLinkHandler(notebookUri, 'https://github.com/search/advanced?q=test&r=microsoft%2Fazuredatastudio&type=Code', configurationService);
			assert.strictEqual(notebookLinkHandler.getEncodedLinkUrl(), `https://github.com/search/advanced?q=test&r=microsoft%2Fazuredatastudio&type=Code`, 'HTTPS link does not need encoding');
		});

		test('when given an already encoded URL with non-reserved characters', () => {
			let notebookLinkHandler = new NotebookLinkHandler(notebookUri, 'https://github.com/search/advanced?q=test&r=(microsoft%2Fazuredatastudio)&type=Code', configurationService);
			assert.strictEqual(notebookLinkHandler.getEncodedLinkUrl(), `https://github.com/search/advanced?q=test&r=(microsoft%2Fazuredatastudio)&type=Code`, '() in HTTP link should not be encoded');
		});

		test('when given an unencoded URL with a space', () => {
			let notebookLinkHandler = new NotebookLinkHandler(notebookUri, 'https://github.com/search/advanced?q=test&r=(microsoft/azuredata studio)&type=Code', configurationService);
			assert.strictEqual(notebookLinkHandler.getEncodedLinkUrl(), `https://github.com/search/advanced?q=test&r=(microsoft/azuredata%20studio)&type=Code`, 'space in the url failed to be encoded');
		});

		test('when given file path with a space', () => {
			let notebookLinkHandler = new NotebookLinkHandler(notebookUri, '/Notebooks/Test_Paths/My File.ipynb', configurationService);
			assert.strictEqual(notebookLinkHandler.getEncodedLinkUrl(), `/Notebooks/Test_Paths/My%20File.ipynb`, 'space in file path failed to be encoded');
		});

		test('when given file path has special characters such as %', () => {
			let notebookLinkHandler = new NotebookLinkHandler(notebookUri, '/Notebooks/Test_Paths/My%20File.ipynb', configurationService);
			assert.strictEqual(notebookLinkHandler.getEncodedLinkUrl(), `/Notebooks/Test_Paths/My%2520File.ipynb`, '% in file path failed to be encoded');
		});
	});
	test('getLinkUrl should return relativePath correctly', () => {
		test('when given an relative link with file protocol and useAbsoluteFilePaths set to true', () => {
			let node = Object.assign(document.createElement('a'), { href: '/tmp//notebook1.ipynb', attributes: { href: { nodeValue: '/tmp/.\\notebook1.ipynb' } } });
			configurationService.updateValue('notebook.useAbsoluteFilePaths', true, ConfigurationTarget.USER);
			node.setAttribute("protocol", 'file:');
			let notebookLinkHandler = new NotebookLinkHandler(notebookUri, node, configurationService);
			let expectedResult = `.${path.join(path.sep, 'notebook1.ipynb')}`
			assert.strictEqual(notebookLinkHandler.getLinkUrl(), expectedResult, 'File relative link is wrong');
		});
		test('when given an relative link with vscode-file protocol', () => {
			let node = Object.assign(document.createElement('a'), { href: '/tmp//notebook1.ipynb', attributes: { href: { nodeValue: '/tmp/.\\notebook1.ipynb' } } });
			node.setAttribute("protocol", 'vscode-file:');
			let notebookLinkHandler = new NotebookLinkHandler(notebookUri, node, configurationService);
			let expectedResult = `.${path.join(path.sep, 'notebook1.ipynb')}`
			assert.strictEqual(notebookLinkHandler.getLinkUrl(), expectedResult, 'File relative link is wrong');
		});
		test('when is-encoded is true', () => {
			let result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/stuff.png', attributes: { isEncoded: true, isMarkdown: true } }), configurationService);
			assert.strictEqual(result.getLinkUrl(), `.${path.sep}stuff.png`, 'Basic link test failed');

			result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/stuff.png', attributes: { isEncoded: true, isMarkdown: true } }), configurationService);
			assert.strictEqual(result.getLinkUrl(), `..${path.sep}stuff.png`, 'Basic link test above folder failed');

			result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/inner/stuff.png', attributes: { isEncoded: true, isMarkdown: true } }), configurationService);
			assert.strictEqual(result.getLinkUrl(), `.${path.sep}inner${path.sep}stuff.png`, 'Basic link test below folder failed');

			result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/my stuff.png', attributes: { isEncoded: true, isMarkdown: true } }), configurationService);
			assert.strictEqual(result.getLinkUrl(), `.${path.sep}my%20stuff.png`, 'Basic link test with space filename failed');

			result = new NotebookLinkHandler(notebookUri, Object.assign(document.createElement('a'), { href: '/tmp/my%20stuff.png', attributes: { isEncoded: true, isMarkdown: true } }), configurationService);
			assert.strictEqual(result.getLinkUrl(), `.${path.sep}my%2520stuff.png`, 'Basic link test with %20 filename failed');
		})
	});
});
