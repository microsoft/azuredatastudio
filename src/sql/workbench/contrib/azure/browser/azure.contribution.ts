/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { MssqlNodeContext } from 'sql/workbench/services/objectExplorer/browser/mssqlNodeContext';

MenuRegistry.appendMenuItem(MenuId.DataExplorerContext, {
	group: 'z-azurecore',
	order: 1,
	command: {
		id: 'azure.resource.openInAzurePortal',
		title: localize('azure.openInAzurePortal.title', "Open in Azure Portal")
	},
	when: MssqlNodeContext.CanOpenInAzurePortal
});

