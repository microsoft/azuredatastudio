/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { localize } from 'vs/nls';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { getCurrentGlobalConnection } from 'sql/workbench/browser/taskUtilities';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IBackupUiService } from 'sql/workbench/services/backup/common/backupUiService';
import { Task } from 'sql/platform/tasks/browser/tasksRegistry';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

export const BackupFeatureName = 'backup';

export function showBackup(accessor: ServicesAccessor, connection: IConnectionProfile): Promise<void> {
	const backupUiService = accessor.get(IBackupUiService);
	return backupUiService.showBackup(connection).then();
}

export class BackupAction extends Task {
	public static readonly ID = BackupFeatureName;
	public static readonly LABEL = localize('backupAction.backup', "Backup");
	public static readonly ICON = BackupFeatureName;

	constructor() {
		super({
			id: BackupAction.ID,
			title: BackupAction.LABEL,
			iconPath: undefined,
			iconClass: BackupAction.ICON
		});
	}

	runTask(accessor: ServicesAccessor, profile: IConnectionProfile): void | Promise<void> {
		const configurationService = accessor.get<IConfigurationService>(IConfigurationService);
		const previewFeaturesEnabled: boolean = configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (!previewFeaturesEnabled) {
			return accessor.get<INotificationService>(INotificationService).info(localize('backup.isPreviewFeature', "You must enable preview features in order to use backup"));
		}

		const connectionManagementService = accessor.get<IConnectionManagementService>(IConnectionManagementService);
		if (!profile) {
			const objectExplorerService = accessor.get<IObjectExplorerService>(IObjectExplorerService);
			const workbenchEditorService = accessor.get<IEditorService>(IEditorService);
			profile = getCurrentGlobalConnection(objectExplorerService, connectionManagementService, workbenchEditorService);
		}
		if (profile) {
			const serverInfo = connectionManagementService.getServerInfo(profile.id);
			if (serverInfo && serverInfo.isCloud && profile.providerName === mssqlProviderName) {
				return accessor.get<INotificationService>(INotificationService).info(localize('backup.commandNotSupported', "Backup command is not supported for Azure SQL databases."));
			}

			if (!profile.databaseName && profile.providerName === mssqlProviderName) {
				return accessor.get<INotificationService>(INotificationService).info(localize('backup.commandNotSupportedForServer', "Backup command is not supported in Server Context. Please select a Database and try again."));
			}
		}

		const capabilitiesService = accessor.get(ICapabilitiesService);
		const instantiationService = accessor.get(IInstantiationService);
		profile = profile ? profile : new ConnectionProfile(capabilitiesService, profile);
		return instantiationService.invokeFunction(showBackup, profile);
	}
}
