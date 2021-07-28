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
	let notebookLinkHandler: NotebookLinkHandler;
	let notebookUri = URI.file('/tmp/notebook.ipynb');
	let link: string | HTMLAnchorElement = '';
	let configurationService: TestConfigurationService;

	suiteSetup(() => {
		configurationService = new TestConfigurationService();
		notebookLinkHandler = new NotebookLinkHandler(notebookUri, link, configurationService);

	});


	test('Should get links properly', () => {
		let result = new NotebookLinkHandler(notebookUri, 'https://www.microsoft.com/images/msft.png', configurationService);
		assert.strictEqual(result.getLinkUrl(), `https://www.microsoft.com/images/msft.png`, 'HTTPS link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, 'http://www.microsoft.com/images/msft.png', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `http://www.microsoft.com/images/msft.png`, 'HTTP link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, '/tmp/stuff.png', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `.${path.sep}stuff.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, '/stuff.png', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `..${path.sep}stuff.png`, 'Basic link test above folder failed');

		result = new NotebookLinkHandler(notebookUri, '/tmp/inner/stuff.png', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `.${path.sep}inner${path.sep}stuff.png`, 'Basic link test below folder failed');
	});

	test('Should return links given anchor element', () => {
		let result = new NotebookLinkHandler(notebookUri, '<a href="https://www.microsoft.com/images/msft.png"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `![stuff](.${path.sep}stuff.png)`, 'HTTPS link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, '<a href="http://www.microsoft.com/images/msft.png"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `http://www.microsoft.com/images/msft.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, '<a href="/tmp/stuff.png"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `.${path.sep}stuff.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, '<a href="/stuff.png"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `..${path.sep}stuff.png`, 'Basic link test above folder failed');

		result = new NotebookLinkHandler(notebookUri, '<a href="/tmp/inner/stuff.png"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `.${path.sep}inner${path.sep}stuff.png`, 'Basic link test below folder failed');
	});

	test('Should return anchor links', () => {
		let result = new NotebookLinkHandler(notebookUri, '<a href="#hello"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `#hello`, 'Basic link to a section failed');

		result = new NotebookLinkHandler(notebookUri, '<a href="file.md#hello"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `file.md#hello`, 'Basic anchor link to a section failed');

		result = new NotebookLinkHandler(notebookUri, '<a href="http://www.microsoft.com/images/msft.png#Hello">hello</a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `http://www.microsoft.com/images/msft.png#Hello`, 'Http link containing # sign failed');
	});

	test.skip('Should return file links with keep absolute path setting', () => {
		// let basePath = process.cwd();
		configurationService.updateValue('notebook.keepAbsolutePath', true, ConfigurationTarget.USER);
		let result = new NotebookLinkHandler(notebookUri, '<a href="https://www.microsoft.com/images/msft.png" is-absolute="true"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `https://www.microsoft.com/images/msft.png`, 'HTTPS link failed to resolve');

		result = new NotebookLinkHandler(notebookUri, '<a href="http://www.microsoft.com/images/msft.png"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `http://www.microsoft.com/images/msft.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, '<a href="/tmp/stuff.png" is-absolute="true"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `.${path.sep}stuff.png`, 'Basic link test failed');

		result = new NotebookLinkHandler(notebookUri, '<a href="/stuff.png" is-absolute="true"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `..${path.sep}stuff.png`, 'Basic link test above folder failed');

		result = new NotebookLinkHandler(notebookUri, '<a href="/tmp/inner/stuff.png" is-absolute="true"></a>', configurationService);
		assert.strictEqual(notebookLinkHandler.getLinkUrl(), `.${path.sep}inner${path.sep}stuff.png`, 'Basic link test below folder failed');
	});
});
