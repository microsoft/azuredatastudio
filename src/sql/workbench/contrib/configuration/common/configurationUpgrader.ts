/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { deepFreeze } from 'vs/base/common/objects';
import { IConfigurationService, ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { localize } from 'vs/nls';

const settingsToMove: { [key: string]: string } = deepFreeze({
	'sql.saveAsCsv.includeHeaders': 'queryEditor.results.saveAsCsv.includeHeaders', // June 19, 2020
	'sql.saveAsCsv.delimiter': 'queryEditor.results.saveAsCsv.delimiter', // June 19, 2020
	'sql.saveAsCsv.lineSeperator': 'queryEditor.results.saveAsCsv.lineSeperator', // June 19, 2020
	'sql.saveAsCsv.textIdentifier': 'queryEditor.results.saveAsCsv.textIdentifier', // June 19, 2020
	'sql.saveAsCsv.encoding': 'queryEditor.results.saveAsCsv.encoding', // June 19, 2020
	'sql.results.streaming': 'queryEditor.results.streaming', // June 19, 2020
	'sql.saveAsXml.formatted': 'queryEditor.results.saveAsXml.formatted', // June 19, 2020
	'sql.saveAsXml.encoding': 'queryEditor.results.saveAsXml.encoding', // June 19, 2020
	'sql.copyIncludeHeaders': 'queryEditor.results.copyIncludeHeaders', // June 19, 2020
	'sql.copyRemoveNewLine': 'queryEditor.results.copyRemoveNewLine', // June 19, 2020
	'sql.showBatchTime': 'queryEditor.messages.showBatchTime', // June 19, 2020
	'sql.chart.defaultChartType': 'queryEditor.chart.defaultChartType', // June 19, 2020
	'sql.tabColorMode': 'queryEditor.tabColorMode', // June 19, 2020
	'sql.showConnectionInfoInTitle': 'queryEditor.showConnectionInfoInTitle', // June 19, 2020
	'sql.promptToSaveGeneratedFiles': 'queryEditor.promptToSaveGeneratedFiles', // June 19, 2020
});

export class ConfigurationUpgraderContribution implements IWorkbenchContribution {

	private static readonly STORAGE_KEY = 'configurationUpgrader';
	private readonly globalStorage: { [key: string]: boolean };
	private readonly workspaceStorage: { [key: string]: boolean };

	public readonly processingPromise: Promise<void>;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		this.globalStorage = JSON.parse(this.storageService.get(ConfigurationUpgraderContribution.STORAGE_KEY, StorageScope.GLOBAL, '{}'));
		this.workspaceStorage = JSON.parse(this.storageService.get(ConfigurationUpgraderContribution.STORAGE_KEY, StorageScope.WORKSPACE, '{}'));
		this.processingPromise = (async () => {
			await this.processSettings();
			this.storageService.store(ConfigurationUpgraderContribution.STORAGE_KEY, JSON.stringify(this.globalStorage), StorageScope.GLOBAL);
			this.storageService.store(ConfigurationUpgraderContribution.STORAGE_KEY, JSON.stringify(this.workspaceStorage), StorageScope.WORKSPACE);
		})();
	}

	private async processSettings(): Promise<void> {
		for (const key in settingsToMove) {
			const toKey = settingsToMove[key];
			const value = this.configurationService.inspect(key);
			if (this.globalStorage[key] !== true && value.userValue) {
				await this.configurationService.updateValue(toKey, value.userValue, ConfigurationTarget.USER); // update to new settings key
				this.globalStorage[key] = true; // don't proccess again
				this.notificationService.info(localize('workbench.configuration.upgradeUser', "{0} was replaced with {1} in your user settings.", key, toKey));
			}
			if (this.workspaceStorage[key] !== true && value.workspaceValue) {
				await this.configurationService.updateValue(toKey, value.workspaceValue, ConfigurationTarget.WORKSPACE); // update to new settings key
				this.workspaceStorage[key] = true; // don't proccess again
				this.notificationService.info(localize('workbench.configuration.upgradeWorkspace', "{0} was replaced with {1} in your workspace settings.", key, toKey));
			}
		}
	}
}
