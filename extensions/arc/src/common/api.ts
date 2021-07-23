/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arc from 'arc';
import * as rd from 'resource-deployment';
import * as loc from '../localizedConstants';
import { PasswordToControllerDialog } from '../ui/dialogs/connectControllerDialog';
import { AzureArcTreeDataProvider } from '../ui/tree/azureArcTreeDataProvider';
import { ControllerTreeNode } from '../ui/tree/controllerTreeNode';

export class UserCancelledError extends Error implements rd.ErrorWithType {
	public get type(): rd.ErrorType {
		return rd.ErrorType.userCancelled;
	}
}
export function arcApi(treeDataProvider: AzureArcTreeDataProvider): arc.IExtension {
	return {
		getRegisteredDataControllers: () => getRegisteredDataControllers(treeDataProvider),
		getControllerPassword: (controllerInfo: arc.ControllerInfo) => getControllerPassword(treeDataProvider, controllerInfo),
		reacquireControllerPassword: (controllerInfo: arc.ControllerInfo) => reacquireControllerPassword(treeDataProvider, controllerInfo)
	};
}

export async function reacquireControllerPassword(treeDataProvider: AzureArcTreeDataProvider, controllerInfo: arc.ControllerInfo): Promise<string> {
	const dialog = new PasswordToControllerDialog(treeDataProvider);
	dialog.showDialog(controllerInfo);
	const model = await dialog.waitForClose();
	if (!model) {
		throw new UserCancelledError(loc.userCancelledError);
	}
	return model.password;
}

export async function getControllerPassword(treeDataProvider: AzureArcTreeDataProvider, controllerInfo: arc.ControllerInfo): Promise<string> {
	return await treeDataProvider.getPassword(controllerInfo);
}

export async function getRegisteredDataControllers(treeDataProvider: AzureArcTreeDataProvider): Promise<arc.DataController[]> {
	return (await treeDataProvider.getChildren())
		.filter(node => node instanceof ControllerTreeNode)
		.map(node => ({
			label: (node as ControllerTreeNode).model.label,
			info: (node as ControllerTreeNode).model.info
		}));
}

