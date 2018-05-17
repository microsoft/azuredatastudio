/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModuleRef, enableProdMode, InjectionToken, ReflectiveInjector } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { IConnectionManagementService, IConnectionDialogService, IErrorMessageService }
	from 'sql/parts/connection/common/connectionManagement';
import { IMetadataService } from 'sql/services/metadata/metadataService';
import { IObjectExplorerService } from 'sql/parts/objectExplorer/common/objectExplorerService';
import { IQueryEditorService } from 'sql/parts/query/common/queryEditorService';
import { IScriptingService } from 'sql/services/scripting/scriptingService';
import { IQueryManagementService } from 'sql/parts/query/common/queryManagement';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';
import { IAdminService } from 'sql/parts/admin/common/adminService';
import { IRestoreDialogController, IRestoreService } from 'sql/parts/disasterRecovery/restore/common/restoreService';
import { IBackupService, IBackupUiService } from 'sql/parts/disasterRecovery/backup/common/backupService';
import { IAngularEventingService } from 'sql/services/angularEventing/angularEventingService';
import { IInsightsDialogService } from 'sql/parts/insights/common/interfaces';
import { ISqlOAuthService } from 'sql/common/sqlOAuthService';
import { IFileBrowserService, IFileBrowserDialogController } from 'sql/parts/fileBrowser/common/interfaces';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { IDashboardViewService } from 'sql/services/dashboard/common/dashboardViewService';
import { IModelViewService } from 'sql/services/modelComponents/modelViewService';
import { IJobManagementService } from 'sql/parts/jobManagement/common/interfaces';

import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IEditorInput } from 'vs/platform/editor/common/editor';
import { IInstantiationService, ServicesAccessor, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { IWindowsService, IWindowService } from 'vs/platform/windows/common/windows';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IClipboardService as vsIClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ALLOW_MULTIPLE_PLATFORMS, PlatformRef } from '@angular/core/src/application_ref';
const selectorCounter = new Map<string, number>();

export const IBootstrapParams = new InjectionToken('bootstrap_params');
export interface IBootstrapParams {
}

export const IUniqueSelector = new InjectionToken('unique_selector');
export type IUniqueSelector = string;

function createUniqueSelector(selector: string): string {
	let num: number;
	if (selectorCounter.has(selector)) {
		num = selectorCounter.get(selector);
	} else {
		num = 0;
	}
	selectorCounter.set(selector, num + 1);
	return `${selector}_${num}`;
}

let platform: PlatformRef;

export function bootstrapAngular(collection: ServicesAccessor, moduleType: any, container: HTMLElement, selectorString: string, params: IBootstrapParams, input?: IEditorInput, callbackSetModule?: (value: NgModuleRef<{}>) => void): string {
	// Create the uniqueSelectorString
	let uniqueSelectorString = createUniqueSelector(selectorString);
	let selector = document.createElement(uniqueSelectorString);
	container.appendChild(selector);

	if (!platform) {
		// Perform the bootsrap
		const providers: { provide: ServiceIdentifier<any> | InjectionToken<any>, useValue: any }[] = [
			// sql services
			{ provide: IConnectionManagementService, useValue: collection.get(IConnectionManagementService)},
			{ provide: IConnectionDialogService, useValue: collection.get(IConnectionDialogService) },
			{ provide: IErrorMessageService, useValue: collection.get(IErrorMessageService) },
			{ provide: IMetadataService, useValue: collection.get(IMetadataService) },
			{ provide: IObjectExplorerService, useValue: collection.get(IObjectExplorerService) },
			{ provide: IQueryEditorService, useValue: collection.get(IQueryEditorService) },
			{ provide: IScriptingService, useValue: collection.get(IScriptingService) },
			{ provide: IQueryManagementService, useValue: collection.get(IQueryManagementService) },
			{ provide: IQueryModelService, useValue: collection.get(IQueryModelService) },
			{ provide: IAdminService, useValue: collection.get(IAdminService) },
			{ provide: IRestoreDialogController, useValue: collection.get(IRestoreDialogController) },
			{ provide: IRestoreService, useValue: collection.get(IRestoreService) },
			{ provide: IBackupService, useValue: collection.get(IBackupService) },
			{ provide: IBackupUiService, useValue: collection.get(IBackupUiService) },
			{ provide: IAngularEventingService, useValue: collection.get(IAngularEventingService) },
			{ provide: IInsightsDialogService, useValue: collection.get(IInsightsDialogService) },
			{ provide: ISqlOAuthService, useValue: collection.get(ISqlOAuthService) },
			{ provide: IFileBrowserService, useValue: collection.get(IFileBrowserService) },
			{ provide: IFileBrowserDialogController, useValue: collection.get(IFileBrowserDialogController) },
			{ provide: IClipboardService, useValue: collection.get(IClipboardService) },
			{ provide: ICapabilitiesService, useValue: collection.get(ICapabilitiesService) },
			{ provide: IDashboardViewService, useValue: collection.get(IDashboardViewService) },
			{ provide: IModelViewService, useValue: collection.get(IModelViewService) },

			// vscode services
			{ provide: vsIClipboardService, useValue: collection.get(vsIClipboardService) },
			{ provide: IKeybindingService, useValue: collection.get(IKeybindingService) },
			{ provide: IContextKeyService, useValue: collection.get(IContextKeyService) },
			{ provide: IContextMenuService, useValue: collection.get(IContextMenuService) },
			{ provide: IContextViewService, useValue: collection.get(IContextViewService) },
			{ provide: IWorkbenchEditorService, useValue: collection.get(IWorkbenchEditorService) },
			{ provide: IPartService, useValue: collection.get(IPartService) },
			{ provide: IInstantiationService, useValue: collection.get(IInstantiationService) },
			{ provide: IConfigurationService, useValue: collection.get(IConfigurationService) },
			{ provide: IWorkspaceContextService, useValue: collection.get(IWorkspaceContextService) },
			{ provide: IAccountManagementService, useValue: collection.get(IAccountManagementService) },
			{ provide: IWindowsService, useValue: collection.get(IWindowsService) },
			{ provide: IWindowService, useValue: collection.get(IWindowService) },
			{ provide: ITelemetryService, useValue: collection.get(ITelemetryService) },
			{ provide: IStorageService, useValue: collection.get(IStorageService) },
			{ provide: ICommandService, useValue: collection.get(ICommandService) },
			{ provide: IJobManagementService, useValue: collection.get(IJobManagementService) },
			{ provide: IEnvironmentService, useValue: collection.get(IEnvironmentService) },
			{ provide: INotificationService, useValue: collection.get(INotificationService) },
			{ provide: IWorkbenchThemeService, useValue: collection.get(IWorkbenchThemeService) }
		];

		platform = platformBrowserDynamic(providers);
	}
	platform.bootstrapModule(moduleType, { providers: [
		{ provide: IUniqueSelector, useValue: uniqueSelectorString },
		{ provide: IBootstrapParams, useValue: params }
	]}).then(moduleRef => {
		if (input) {
			input.onDispose(() => {
				moduleRef.destroy();
			});
		}
		if (callbackSetModule) {
			callbackSetModule(moduleRef);
		}
	});

	return uniqueSelectorString;
}

if (!process.env['VSCODE_DEV']) {
	enableProdMode();
}
