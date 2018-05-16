/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModuleRef, enableProdMode } from '@angular/core';
import { platformBrowserDynamic, } from '@angular/platform-browser-dynamic';

import { BootstrapParams } from 'sql/services/bootstrap/bootstrapParams';
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

import { $ } from 'vs/base/browser/dom';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IEditorInput } from 'vs/platform/editor/common/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from './bootstrapService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { IWindowsService, IWindowService } from 'vs/platform/windows/common/windows';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ConfigurationEditingService } from 'vs/workbench/services/configuration/node/configurationEditingService';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IJobManagementService } from 'sql/parts/jobManagement/common/interfaces';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';

export class BootstrapService implements IBootstrapService {

	public _serviceBrand: any;

	// Maps uniqueSelectors (as opposed to selectors) to BootstrapParams
	private _bootstrapParameterMap: Map<string, BootstrapParams>;

	// Maps selectors (as opposed to uniqueSelectors) to a queue of uniqueSelectors
	private _selectorQueueMap: Map<string, string[]>;

	// Maps selectors (as opposed to uniqueSelectors) to the next available uniqueSelector ID number
	private _selectorCountMap: Map<string, number>;

	public configurationEditorService: ConfigurationEditingService;

	constructor(
		@IContextViewService private contextViewService: IContextViewService,
		@IWorkbenchThemeService private themeService: IWorkbenchThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@INotificationService private notificationService: INotificationService,
		@ICommandService private commandService: ICommandService,
		@IKeybindingService private keybindingService: IKeybindingService,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IContextMenuService private contextMenuService: IContextMenuService,
		@IErrorMessageService private errorMessageService: IErrorMessageService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@IMetadataService private metadataService: IMetadataService,
		@IObjectExplorerService private objectExplorerService: IObjectExplorerService,
		@IScriptingService private scriptingService: IScriptingService,
		@IQueryEditorService private queryEditorService: IQueryEditorService,
		@IAdminService private adminService: IAdminService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IBackupService private backupService: IBackupService,
		@IBackupUiService private backupUiService: IBackupUiService,
		@IRestoreDialogController private restoreDialogService: IRestoreDialogController,
		@IRestoreService private restoreService: IRestoreService,
		@IConnectionDialogService private connectionDialogService: IConnectionDialogService,
		@IQueryModelService private queryModelService: IQueryModelService,
		@IPartService private partService: IPartService,
		@IQueryManagementService private queryManagementService: IQueryManagementService,
		@IAngularEventingService private angularEventingService: IAngularEventingService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IInsightsDialogService private insightsDialogService: IInsightsDialogService,
		@IWorkspaceContextService private workspaceContextService: IWorkspaceContextService,
		@IAccountManagementService private accountManagementService: IAccountManagementService,
		@IWindowsService private windowsService: IWindowsService,
		@ISqlOAuthService private sqlOAuthService: ISqlOAuthService,
		@IFileBrowserService private fileBrowserService: IFileBrowserService,
		@IFileBrowserDialogController private fileBrowserDialogService: IFileBrowserDialogController,
		@IWindowService private windowService: IWindowService,
		@ITelemetryService private telemetryService: ITelemetryService,
		@IStorageService private storageService: IStorageService,
		@IClipboardService private clipboardService: IClipboardService,
		@ICapabilitiesService private capabilitiesService: ICapabilitiesService,
		@IDashboardViewService private dashboardViewService: IDashboardViewService,
		@IModelViewService private modelViewService: IModelViewService,
		@IJobManagementService private jobManagementService: IJobManagementService,
		@IEnvironmentService private environmentService: IEnvironmentService
	) {
		this.configurationEditorService = this.instantiationService.createInstance(ConfigurationEditingService);
		this._bootstrapParameterMap = new Map<string, BootstrapParams>();
		this._selectorQueueMap = new Map<string, string[]>();
		this._selectorCountMap = new Map<string, number>();
	}

	public bootstrap(moduleType: any, container: HTMLElement, selectorString: string, params: BootstrapParams, input?: IEditorInput, callbackSetModule?: (value: NgModuleRef<{}>) => void): string {
		// Create the uniqueSelectorString
		let uniqueSelectorString: string = this._getUniqueSelectorString(selectorString);
		let selector: HTMLElement = $(uniqueSelectorString);
		container.appendChild(selector);

		// Associate the elementId
		this._setUniqueSelector(selectorString, uniqueSelectorString);

		// Associate the params
		this._bootstrapParameterMap.set(uniqueSelectorString, params);

		// Perform the bootsrap
		const providers = [
			{ provide: BOOTSTRAP_SERVICE_ID, useValue: this },
			{ provide: IWorkbenchThemeService, useValue: this.themeService },
			{ provide: IContextViewService, useValue: this.contextViewService },
			{ provide: INotificationService, useValue: this.notificationService },
			{ provide: ICommandService, useValue: this.commandService },
			{ provide: IInstantiationService, useValue: this.instantiationService },
			{ provide: IKeybindingService, useValue: this.keybindingService },
			{ provide: IContextKeyService, useValue: this.contextKeyService },
			{ provide: IContextMenuService, useValue: this.contextMenuService },
			{ provide: IErrorMessageService, useValue: this.errorMessageService },
			{ provide: IConnectionManagementService, useValue: this.connectionManagementService },
			{ provide: IMetadataService, useValue: this.metadataService },
			{ provide: IObjectExplorerService, useValue: this.objectExplorerService },
			{ provide: IScriptingService, useValue: this.scriptingService },
			{ provide: IQueryEditorService, useValue: this.queryEditorService },
			{ provide: IAdminService, useValue: this.adminService },
			{ provide: IWorkbenchEditorService, useValue: this.editorService },
			{ provide: IBackupService, useValue: this.backupService },
			{ provide: IBackupUiService, useValue: this.backupUiService },
			{ provide: IRestoreDialogController, useValue: this.restoreDialogService },
			{ provide: IRestoreService, useValue: this.restoreService },
			{ provide: IConnectionDialogService, useValue: this.connectionDialogService },
			{ provide: IQueryModelService, useValue: this.queryModelService },
			{ provide: IPartService, useValue: this.partService },
			{ provide: IQueryManagementService, useValue: this.queryManagementService },
			{ provide: IAngularEventingService, useValue: this.angularEventingService },
			{ provide: IConfigurationService, useValue: this.configurationService },
			{ provide: IInsightsDialogService, useValue: this.insightsDialogService },
			{ provide: IWorkspaceContextService, useValue: this.workspaceContextService },
			{ provide: IAccountManagementService, useValue: this.accountManagementService },
			{ provide: IWindowsService, useValue: this.windowsService },
			{ provide: ISqlOAuthService, useValue: this.sqlOAuthService },
			{ provide: IFileBrowserService, useValue: this.fileBrowserService },
			{ provide: IFileBrowserDialogController, useValue: this.fileBrowserDialogService },
			{ provide: IWindowService, useValue: this.windowService },
			{ provide: ITelemetryService, useValue: this.telemetryService },
			{ provide: IStorageService, useValue: this.storageService },
			{ provide: IClipboardService, useValue: this.clipboardService },
			{ provide: ICapabilitiesService, useValue: this.capabilitiesService },
			{ provide: IDashboardViewService, useValue: this.dashboardViewService },
			{ provide: IModelViewService, useValue: this.modelViewService },
			{ provide: IJobManagementService, useValue: this.jobManagementService },
			{ provide: IEnvironmentService, useValue: this.environmentService }
		];

		platformBrowserDynamic(providers).bootstrapModule(moduleType).then(moduleRef => {
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

	public getBootstrapParams(id: string): any {
		let idLowercase = id.toLowerCase();
		let params: BootstrapParams = this._bootstrapParameterMap.get(idLowercase);
		this._bootstrapParameterMap.delete(idLowercase);
		return params;
	}

	public getUniqueSelector(selectorString: string): string {
		let idArray = this._selectorQueueMap.get(selectorString);
		if (!idArray) {
			return undefined;
		}

		let id: string = idArray.shift();

		if (idArray.length === 0) {
			this._selectorQueueMap.delete(selectorString);
		} else {
			this._selectorQueueMap.set(selectorString, idArray);
		}

		return id;
	}

	private _getUniqueSelectorString(selectorString: string): string {
		let count: number = this._selectorCountMap.get(selectorString);
		if (!count) {
			this._selectorCountMap.set(selectorString, 1);
			count = 0;
		} else {
			this._selectorCountMap.set(selectorString, count + 1);
		}
		let casedString = selectorString + count.toString();
		return casedString.toLowerCase();
	}

	private _setUniqueSelector(selectorString: string, elementId: string) {
		let idArray = this._selectorQueueMap.get(selectorString);
		if (!idArray) {
			idArray = [];
		}
		idArray.push(elementId);
		this._selectorQueueMap.set(selectorString, idArray);
	}
}

if (!process.env['VSCODE_DEV']) {
	enableProdMode();
}
