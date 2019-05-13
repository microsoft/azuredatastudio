/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/actionBarLabel';
import { localize } from 'vs/nls';
import { ViewletRegistry, Extensions as ViewletExtensions, ViewletDescriptor, ShowViewletAction } from 'vs/workbench/browser/viewlet';
import { Registry } from 'vs/platform/registry/common/platform';
import { VIEWLET_ID } from 'sql/workbench/parts/dataExplorer/browser/dataExplorerExtensionPoint';
import { DataExplorerViewlet, DataExplorerViewletViewsContribution } from 'sql/workbench/parts/dataExplorer/browser/dataExplorerViewlet';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { DataExplorerActionRegistry } from 'sql/workbench/parts/dataExplorer/browser/dataExplorerActionRegistry';
import { createCSSRule } from 'vs/base/browser/dom';
import * as path from 'path';
import { URI } from 'vs/base/common/uri';

// Viewlet Action
export class OpenDataExplorerViewletAction extends ShowViewletAction {
	public static ID = VIEWLET_ID;
	public static LABEL = localize('showDataExplorer', "Show Connections");

	constructor(
		id: string,
		label: string,
		@IViewletService viewletService: IViewletService,
		@IEditorGroupsService editorGroupService: IEditorGroupsService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService
	) {
		super(id, label, VIEWLET_ID, viewletService, editorGroupService, layoutService);
	}
}

// Data Explorer Viewlet
const viewletDescriptor = new ViewletDescriptor(
	DataExplorerViewlet,
	VIEWLET_ID,
	localize('workbench.dataExplorer', "Connections"),
	'dataExplorer',
	0
);

Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).registerViewlet(viewletDescriptor);
Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).setDefaultViewletId(VIEWLET_ID);
const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(DataExplorerViewletViewsContribution, LifecyclePhase.Starting);
const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	new SyncActionDescriptor(
		OpenDataExplorerViewletAction,
		OpenDataExplorerViewletAction.ID,
		OpenDataExplorerViewletAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyCode.Shift | KeyCode.KEY_C }),
	'View: Show Data Explorer',
	localize('dataExplorer.view', "View")
);

let configurationRegistry = <IConfigurationRegistry>Registry.as(Extensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'databaseConnections',
	'order': 0,
	'title': localize('databaseConnections', "Database Connections"),
	'type': 'object',
	'properties': {
		'datasource.connections': {
			'description': localize('datasource.connections', "data source connections"),
			'type': 'array'
		},
		'datasource.connectionGroups': {
			'description': localize('datasource.connectionGroups', "data source groups"),
			'type': 'array'
		}
	}
});
configurationRegistry.registerConfiguration({
	'id': 'startupConfig',
	'title': localize('startupConfig', "Startup Configuration"),
	'type': 'object',
	'properties': {
		'startup.alwaysShowServersView': {
			'type': 'boolean',
			'description': localize('startup.alwaysShowServersView', "True for the Servers view to be shown on launch of Azure Data Studio default; false if the last opened view should be shown"),
			'default': true
		}
	}
});

export interface IDataExplorerActionContribution {
	category: string;
	commandId: string;
	label: string;
	icon?: {
		light: string;
		dark: string;
	};
	isPrimary: boolean;
}

const DataExplorerActionSchema: IJSONSchema = {
	type: 'object',
	properties: {
		category: {
			type: 'string',
			description: localize('azdata.extension.contributes.dataExplorer.action.category', "Category of the action used for grouping the actions")
		},
		commandId: {
			type: 'string',
			description: localize('azdata.extension.contributes.dataExplorer.action.commandId', "Id of the command that will be executed")
		},
		label: {
			type: 'string',
			description: localize('azdata.extension.contributes.dataExplorer.action.label', "Display name of the action")
		},
		icon: {
			type: 'object',
			description: localize('azdata.extension.contributes.dataExplorer.action.icon', "Icon for the action")
		},
		isPrimary: {
			type: 'boolean',
			description: localize('azdata.extension.contributes.dataExplorer.action.isPrimary', "Indicates whether the action is a primary action")
		}
	}
};

ExtensionsRegistry.registerExtensionPoint<IDataExplorerActionContribution | IDataExplorerActionContribution[]>({ extensionPoint: 'dataExplorer.actions', jsonSchema: DataExplorerActionSchema }).setHandler(extensions => {
	let primaryActionCount = 0;
	extensions.forEach(extension => {
		function handleAction(action: IDataExplorerActionContribution) {
			try {
				if (!action) {
					log.error('an empty data explorer action is detected in extension: ' + extension.description.name);
					return;
				}
				if (!(action.commandId && action.label)) {
					log.error('a data explorer action without commandId or label is detected in extension:' + extension.description.name);
					return;
				}
				if (action.isPrimary) {
					if (!(action.icon && action.icon.dark && action.icon.light)) {
						log.error(`a data explorer primary action without proper icon is detected in extension: ${extension.description.name}, commandId: ${action.commandId}`);
						return;
					}
					let iconClass = `dataExplorerActionIcon-${primaryActionCount}`;
					const light = path.join(extension.description.extensionLocation.fsPath, action.icon.light);
					const dark = path.join(extension.description.extensionLocation.fsPath, action.icon.dark);
					createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(light).toString()}")`);
					createCSSRule(`.vs-dark .icon.${iconClass}, .hc-black .icon.${iconClass}`, `background-image: url("${URI.file(dark).toString()}")`);
					DataExplorerActionRegistry.registerAction({
						category: action.category,
						commandId: action.commandId,
						cssClass: iconClass,
						label: action.label,
						isPrimary: true
					});
					primaryActionCount++;
				} else {
					DataExplorerActionRegistry.registerAction({
						category: action.category,
						commandId: action.commandId,
						label: action.label,
						isPrimary: false
					});
				}
			}
			catch (err) {
				console.error(`An error occured while loading an data explorer action in extension ${extension.description.name}: ${err}`);
			}
		}

		if (Array.isArray<IDataExplorerActionContribution>(extension.value)) {
			for (const action of extension.value) {
				handleAction(action);
			}
		} else {
			handleAction(extension.value);
		}
	});
});