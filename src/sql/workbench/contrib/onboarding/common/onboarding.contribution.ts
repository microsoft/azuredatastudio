/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { developers } from 'sql/workbench/contrib/onboarding/common/developers';

CommandsRegistry.registerCommand({
	id: 'onboarding.showDevelopers',
	handler: (accessor) => {
		const notificationService = accessor.get(INotificationService);
		notificationService.info(developers.join('\n'));
	}
});
