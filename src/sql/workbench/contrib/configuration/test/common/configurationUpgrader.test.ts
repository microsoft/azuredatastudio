/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ConfigurationUpgraderContribution } from 'sql/workbench/contrib/configuration/common/configurationUpgrader';
import { TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';

suite('Configuration Upgrader', () => {
	test('does upgrade settings in user settings', async () => {
		const configurationService = new TestConfigurationService({ user: { 'sql': { 'saveAsCsv': { 'includeHeaders': true } } } });
		const configurationUpgrader = new ConfigurationUpgraderContribution(new TestStorageService(), configurationService, new TestNotificationService());
		await configurationUpgrader.processingPromise;
		assert(configurationService.inspect('queryEditor.results.saveAsCsv.includeHeaders').userValue === true);
	});

	test('does not change new setting', async () => {
		const configurationService = new TestConfigurationService({ user: { 'queryEditor': { 'results': { 'saveAsCsv': { 'includeHeaders': true } } } } });
		const configurationUpgrader = new ConfigurationUpgraderContribution(new TestStorageService(), configurationService, new TestNotificationService());
		await configurationUpgrader.processingPromise;
		assert(configurationService.inspect('queryEditor.results.saveAsCsv.includeHeaders').userValue === true);
	});

	test('correctly changes multiple settings', async () => {
		const configurationService = new TestConfigurationService({ user: { 'sql': { 'saveAsCsv': { 'includeHeaders': true }, 'promptToSaveGeneratedFiles': true } } });
		const configurationUpgrader = new ConfigurationUpgraderContribution(new TestStorageService(), configurationService, new TestNotificationService());
		await configurationUpgrader.processingPromise;
		assert(configurationService.inspect('queryEditor.results.saveAsCsv.includeHeaders').userValue === true);
		assert(configurationService.inspect('queryEditor.promptToSaveGeneratedFiles').userValue === true);
	});

	test('does change workspace settings', async () => {
		const configurationService = new TestConfigurationService({ workspace: { 'sql': { 'saveAsCsv': { 'includeHeaders': true } } } });
		const configurationUpgrader = new ConfigurationUpgraderContribution(new TestStorageService(), configurationService, new TestNotificationService());
		await configurationUpgrader.processingPromise;
		assert(configurationService.inspect('queryEditor.results.saveAsCsv.includeHeaders').workspaceValue === true);
	});
});
