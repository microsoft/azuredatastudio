/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
		if (process.platform === 'win32') {
			assert.strictEqual(result.getLinkUrl(), `/tmp/stuff.png`, 'Basic link test failed');
		} else {
			assert.strictEqual(result.getLinkUrl(), `${path.sep}tmp${path.sep}stuff.png`, 'Basic link test failed');
		}

		result = new NotebookLinkHandler(notebookUri, '/stuff.png', configurationService);
		if (process.platform === 'win32') {
			assert.strictEqual(result.getLinkUrl(), `/stuff.png`, 'Basic link test above folder failed');
		} else {
			assert.strictEqual(result.getLinkUrl(), `${path.sep}stuff.png`, 'Basic link test above folder failed');
		}
		result = new NotebookLinkHandler(notebookUri, '/tmp/inner/stuff.png', configurationService);
		if (process.platform === 'win32') {
			assert.strictEqual(result.getLinkUrl(), `/tmp/inner/stuff.png`, 'Basic link test below folder failed');
		} else {
			assert.strictEqual(result.getLinkUrl(), `${path.sep}tmp${path.sep}inner${path.sep}stuff.png`, 'Basic link test below folder failed');
		}
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
		configurationService.updateValue('notebook.keepAbsolutePath', true, ConfigurationTarget.USER);
		let result = new NotebookLinkHandler(notebookUri, 'https://www.microsoft.com/images/msft.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `https://www.microsoft.com/images/msft.png`, 'HTTPS link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, 'http://www.microsoft.com/images/msft.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `http://www.microsoft.com/images/msft.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, '/tmp/stuff.png', configurationService);
		if (process.platform === 'win32') {
			assert.strictEqual(result.getLinkUrl(), `/tmp/stuff.png`, 'Basic link test failed');
		} else {
			assert.strictEqual(result.getLinkUrl(), `${path.sep}tmp${path.sep}stuff.png`, 'Basic link test failed');
		}

		result = new NotebookLinkHandler(notebookUri, '/stuff.png', configurationService);
		if (process.platform === 'win32') {
			assert.strictEqual(result.getLinkUrl(), `/stuff.png`, 'Basic link test above folder failed');
		} else {
			assert.strictEqual(result.getLinkUrl(), `${path.sep}stuff.png`, 'Basic link test above folder failed');
		}

		result = new NotebookLinkHandler(notebookUri, '/tmp/inner/stuff.png', configurationService);
		if (process.platform === 'win32') {
			assert.strictEqual(result.getLinkUrl(), `/tmp/inner/stuff.png`, 'Basic link test below folder failed');
		} else {
			assert.strictEqual(result.getLinkUrl(), `${path.sep}tmp${path.sep}inner${path.sep}stuff.png`, 'Basic link test below folder failed');
		}

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
});
