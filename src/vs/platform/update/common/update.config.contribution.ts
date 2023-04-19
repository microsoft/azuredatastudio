/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isWeb, isWindows } from 'vs/base/common/platform';
import { localize } from 'vs/nls';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import * as locConstants from 'sql/base/common/locConstants'; // {{SQL CARBON EDIT}}

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'update',
	order: 15,
	title: localize('updateConfigurationTitle', "Update"),
	type: 'object',
	properties: {
		'update.mode': {
			type: 'string',
			enum: ['none', 'manual', 'start', 'default'],
			default: 'default',
			scope: ConfigurationScope.APPLICATION,
			description: localize('updateMode', "Configure whether you receive automatic updates. Requires a restart after change. The updates are fetched from a Microsoft online service."),
			tags: ['usesOnlineServices'],
			enumDescriptions: [
				localize('none', "Disable updates."),
				localize('manual', "Disable automatic background update checks. Updates will be available if you manually check for updates."),
				localize('start', "Check for updates only on startup. Disable automatic background update checks."),
				locConstants.updateConfigContributionDefault // {{SQL CARBON EDIT}} Change product name to ADS
			]
		},
		'update.channel': {
			type: 'string',
			default: 'default',
			scope: ConfigurationScope.APPLICATION,
			description: localize('updateMode', "Configure whether you receive automatic updates. Requires a restart after change. The updates are fetched from a Microsoft online service."),
			deprecationMessage: localize('deprecated', "This setting is deprecated, please use '{0}' instead.", 'update.mode')
		},
		'update.enableWindowsBackgroundUpdates': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			title: localize('enableWindowsBackgroundUpdatesTitle', "Enable Background Updates on Windows"),
			description: locConstants.updateConfigContributionEnableWindowsBackgroundUpdates, // {{SQL CARBON EDIT}} Change product name to ADS
			included: isWindows && !isWeb
		},
		'update.showReleaseNotes': {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: locConstants.updateConfigContributionShowReleaseNotes, // {{SQL CARBON EDIT}} Update text to be correct for ADS
			tags: ['usesOnlineServices']
		}
	}
});
