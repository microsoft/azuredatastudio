/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { getCurrentGlobalConnection } from 'sql/workbench/browser/taskUtilities';
import { IRestoreDialogController } from 'sql/workbench/services/restore/common/restoreService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { Task } from 'sql/workbench/services/tasks/browser/tasksRegistry';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES } from 'sql/workbench/common/constants';
import { ILogService } from 'vs/platform/log/common/log';

export function showRestore(accessor: ServicesAccessor, connection: IConnectionProfile): Promise<void> {
	const restoreDialogService = accessor.get(IRestoreDialogController);
	return restoreDialogService.showDialog(connection).then();
}

export const RestoreFeatureName = 'restore';
export const restoreIsPreviewFeature = localize('restore.isPreviewFeature', "You must enable preview features in order to use restore");
export const restoreNotSupportedOutOfContext = localize('restore.commandNotSupportedOutsideContext', "Restore command is not supported outside of a server context. Please select a server or database and try again.");
export const restoreNotSupportedForAzure = localize('restore.commandNotSupported', "Restore command is not supported for Azure SQL databases.");


export class RestoreAction extends Task {
	public static readonly ID = RestoreFeatureName;
	public static readonly LABEL = localize('restoreAction.restore', "Restore");
	public static readonly ICON = RestoreFeatureName;

	constructor() {
		super({
			id: RestoreAction.ID,
			title: RestoreAction.LABEL,
			iconPath: undefined,
			iconClass: RestoreAction.ICON
		});
	}

	runTask(accessor: ServicesAccessor, withProfile?: IConnectionProfile): void | Promise<void> {
		let profile = withProfile;
		const configurationService = accessor.get<IConfigurationService>(IConfigurationService);
		const previewFeaturesEnabled: boolean = configurationService.getValue(CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES);
		if (!previewFeaturesEnabled) {
			return accessor.get<INotificationService>(INotificationService).info(restoreIsPreviewFeature);
		}

		let connectionManagementService = accessor.get<IConnectionManagementService>(IConnectionManagementService);
		if (!profile) {
			const objectExplorerService = accessor.get<IObjectExplorerService>(IObjectExplorerService);
			const workbenchEditorService = accessor.get<IEditorService>(IEditorService);
			const logService = accessor.get<ILogService>(ILogService);
			profile = getCurrentGlobalConnection(objectExplorerService, connectionManagementService, workbenchEditorService, logService);
		}
		if (profile) {
			const serverInfo = connectionManagementService.getServerInfo(profile.id);
			if (serverInfo && serverInfo.isCloud && profile.providerName === mssqlProviderName) {
				return accessor.get<INotificationService>(INotificationService).info(restoreNotSupportedForAzure);
			}
		}

		const capabilitiesService = accessor.get(ICapabilitiesService);
		const instantiationService = accessor.get(IInstantiationService);
		profile = profile ? profile : new ConnectionProfile(capabilitiesService, profile);
		if (!profile.serverName) {
			return accessor.get<INotificationService>(INotificationService).info(restoreNotSupportedOutOfContext);
		}
		return instantiationService.invokeFunction(showRestore, profile);
	}
}
