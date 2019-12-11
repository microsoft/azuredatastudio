/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { getCurrentGlobalConnection } from 'sql/workbench/browser/taskUtilities';
import { IRestoreDialogController } from 'sql/platform/restore/common/restoreService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { Task } from 'sql/platform/tasks/browser/tasksRegistry';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

export function showRestore(accessor: ServicesAccessor, connection: IConnectionProfile): Promise<void> {
	const restoreDialogService = accessor.get(IRestoreDialogController);
	return restoreDialogService.showDialog(connection).then();
}

export const RestoreFeatureName = 'restore';

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

	runTask(accessor: ServicesAccessor, profile: IConnectionProfile): void | Promise<void> {
		const configurationService = accessor.get<IConfigurationService>(IConfigurationService);
		const previewFeaturesEnabled: boolean = configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (!previewFeaturesEnabled) {
			return accessor.get<INotificationService>(INotificationService).info(localize('restore.isPreviewFeature', "You must enable preview features in order to use restore"));
		}

		let connectionManagementService = accessor.get<IConnectionManagementService>(IConnectionManagementService);
		if (!profile) {
			const objectExplorerService = accessor.get<IObjectExplorerService>(IObjectExplorerService);
			const workbenchEditorService = accessor.get<IEditorService>(IEditorService);
			profile = getCurrentGlobalConnection(objectExplorerService, connectionManagementService, workbenchEditorService);
		}
		if (profile) {
			const serverInfo = connectionManagementService.getServerInfo(profile.id);
			if (serverInfo && serverInfo.isCloud && profile.providerName === mssqlProviderName) {
				return accessor.get<INotificationService>(INotificationService).info(localize('restore.commandNotSupported', "Restore command is not supported for Azure SQL databases."));
			}
		}

		const capabilitiesService = accessor.get(ICapabilitiesService);
		const instantiationService = accessor.get(IInstantiationService);
		profile = profile ? profile : new ConnectionProfile(capabilitiesService, profile);
		return instantiationService.invokeFunction(showRestore, profile);
	}
}
