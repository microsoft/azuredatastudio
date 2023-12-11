/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
import { IBackupUiService } from 'sql/workbench/contrib/backup/common/backupUiService';
import { Task } from 'sql/workbench/services/tasks/browser/tasksRegistry';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES } from 'sql/workbench/common/constants';
import { ILogService } from 'vs/platform/log/common/log';

export const BackupFeatureName = 'backup';
export const backupIsPreviewFeature = localize('backup.isPreviewFeature', "You must enable preview features in order to use backup");
export const backupNotSupportedOutOfDBContext = localize('backup.commandNotSupportedForServer', "Backup command is not supported outside of a database context. Please select a database and try again.");
export const backupNotSupportedForAzure = localize('backup.commandNotSupported', "Backup command is not supported for Azure SQL databases.");

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

	runTask(accessor: ServicesAccessor, profile?: IConnectionProfile): void | Promise<void> {
		const configurationService = accessor.get<IConfigurationService>(IConfigurationService);
		const previewFeaturesEnabled = configurationService.getValue(CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES);
		if (!previewFeaturesEnabled) {
			return accessor.get<INotificationService>(INotificationService).info(backupIsPreviewFeature);
		}

		const connectionManagementService = accessor.get<IConnectionManagementService>(IConnectionManagementService);
		if (!profile) {
			const objectExplorerService = accessor.get<IObjectExplorerService>(IObjectExplorerService);
			const workbenchEditorService = accessor.get<IEditorService>(IEditorService);
			const logService = accessor.get<ILogService>(ILogService);
			profile = getCurrentGlobalConnection(objectExplorerService, connectionManagementService, workbenchEditorService, logService);
		}
		if (profile) {
			const serverInfo = connectionManagementService.getServerInfo(profile.id);
			if (serverInfo && serverInfo.isCloud && profile.providerName === mssqlProviderName) {
				return accessor.get<INotificationService>(INotificationService).info(backupNotSupportedForAzure);
			}

			if (!profile.databaseName && profile.providerName === mssqlProviderName) {
				return accessor.get<INotificationService>(INotificationService).info(backupNotSupportedOutOfDBContext);
			}
		}

		const capabilitiesService = accessor.get(ICapabilitiesService);
		const instantiationService = accessor.get(IInstantiationService);
		profile = profile ? profile : new ConnectionProfile(capabilitiesService, profile);
		if (!profile.databaseName) {
			return accessor.get<INotificationService>(INotificationService).info(backupNotSupportedOutOfDBContext);
		}
		return instantiationService.invokeFunction(showBackup, profile);
	}
}
