/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NgModuleRef } from '@angular/core';
import { BootstrapParams } from 'sql/services/bootstrap/bootstrapParams';
import { IConnectionManagementService, IConnectionDialogService, IErrorMessageService }
	from 'sql/parts/connection/common/connectionManagement';
import { IMetadataService } from 'sql/services/metadata/metadataService';
import { IObjectExplorerService } from 'sql/parts/registeredServer/common/objectExplorerService';
import { IQueryEditorService } from 'sql/parts/query/common/queryEditorService';
import { IAngularEventingService } from 'sql/services/angularEventing/angularEventingService';
import { IScriptingService } from 'sql/services/scripting/scriptingService';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';
import { IQueryManagementService } from 'sql/parts/query/common/queryManagement';
import { IAdminService } from 'sql/parts/admin/common/adminService';
import { IRestoreDialogController, IRestoreService } from 'sql/parts/disasterRecovery/restore/common/restoreService';
import { IBackupService, IBackupUiService } from 'sql/parts/disasterRecovery/backup/common/backupService';
import { IInsightsDialogService } from 'sql/parts/insights/common/interfaces';
import { ISqlOAuthService } from 'sql/common/sqlOAuthService';
import { IFileBrowserService, IFileBrowserDialogController } from 'sql/parts/fileBrowser/common/interfaces';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { IDashboardWebviewService } from 'sql/services/dashboardWebview/common/dashboardWebviewService';

import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IEditorInput } from 'vs/platform/editor/common/editor';
import { createDecorator, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IMessageService } from 'vs/platform/message/common/message';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IAccountManagementService } from 'sql/services/accountManagement/interfaces';
import { IWindowsService, IWindowService } from 'vs/platform/windows/common/windows';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ConfigurationEditingService } from 'vs/workbench/services/configuration/node/configurationEditingService';

export const BOOTSTRAP_SERVICE_ID = 'bootstrapService';
export const IBootstrapService = createDecorator<IBootstrapService>(BOOTSTRAP_SERVICE_ID);

/*
 * Handles logic for bootstrapping and passing singleton services to Angular components.
 */
export interface IBootstrapService {

	_serviceBrand: any;

	connectionManagementService: IConnectionManagementService;
	metadataService: IMetadataService;
	objectExplorerService: IObjectExplorerService;
	scriptingService: IScriptingService;
	queryEditorService: IQueryEditorService;
	connectionDialogService: IConnectionDialogService;
	queryModelService: IQueryModelService;
	adminService: IAdminService;
	backupService: IBackupService;
	backupUiService: IBackupUiService;
	restoreService: IRestoreService;
	keybindingService: IKeybindingService;
	contextKeyService: IContextKeyService;
	contextMenuService: IContextMenuService;
	themeService: IWorkbenchThemeService;
	editorService: IWorkbenchEditorService;
	errorMessageService: IErrorMessageService;
	partService: IPartService;
	queryManagementService: IQueryManagementService;
	instantiationService: IInstantiationService;
	angularEventingService: IAngularEventingService;
	configurationService: IConfigurationService;
	insightsDialogService: IInsightsDialogService;
	contextViewService: IContextViewService;
	restoreDialogService: IRestoreDialogController;
	messageService: IMessageService;
	workspaceContextService: IWorkspaceContextService;
	accountManagementService: IAccountManagementService;
	windowsService: IWindowsService;
	sqlOAuthService: ISqlOAuthService;
	windowService: IWindowService;
	fileBrowserService: IFileBrowserService;
	fileBrowserDialogService: IFileBrowserDialogController;
	telemetryService: ITelemetryService;
	storageService: IStorageService;
	clipboardService: IClipboardService;
	capabilitiesService: ICapabilitiesService;
	configurationEditorService: ConfigurationEditingService;
	dashboardWebviewService: IDashboardWebviewService;

	/*
	* Bootstraps the Angular module described. Components that need singleton services should inject the
	* 'BootstrapService' dependency to obtain a reference to this class. Components that need dynamic parameters
	* should wrap them in an object and pass them in through the "params" parameter.
	*
	* moduleType:	 	The TypeScript type of the module to bootstrap
	* container: 		The HTML container to append the selector HTMLElement
	* selectorString: 	The tag name and class used to create the element, e.g. 'tagName.cssClassName'
	* params: 			The parameters to be associated with the given id
	* input:            Optional editor input. If specified, will listen to its onDispose event and destroy the module when this happens
	* callbackSetModule:Optional. If specified, will be used to set the moduleRef
	* Returns the unique selector string that this module will bootstrap with.
	*/
	bootstrap(moduleType: any, container: HTMLElement, selectorString: string, params: BootstrapParams, input?: IEditorInput, callbackSetModule?: (value: NgModuleRef<{}>) => void): string;

	/*
	* Gets the "params" entry associated with the given id and unassociates the id/entry pair.
	* Returns undefined if no entry is found.
	*/
	getBootstrapParams(id: string): any;

	/*
	* Gets the next unique selector given the baseSelectorString. A unique selector is the baseSelectorString with a
	* number appended. E.g. if baseSelectorString='query', valid unique selectors could be query0, query1, query2, etc.
	*/
	getUniqueSelector(baseSelectorString: string): string;
}
