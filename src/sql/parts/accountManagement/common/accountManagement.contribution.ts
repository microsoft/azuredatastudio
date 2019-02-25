/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import { join } from 'path';
import { createCSSRule } from 'vs/base/browser/dom';
import { URI } from 'vs/base/common/uri';

import { ManageLinkedAccountAction } from 'sql/parts/accountManagement/accountListStatusbar/accountListStatusbarItem';

let actionRegistry = <IWorkbenchActionRegistry>Registry.as(Extensions.WorkbenchActions);

actionRegistry.registerWorkbenchAction(
	new SyncActionDescriptor(
		ManageLinkedAccountAction,
		ManageLinkedAccountAction.ID,
		ManageLinkedAccountAction.LABEL
	),
	ManageLinkedAccountAction.LABEL
);

export interface IAccountContrib {
	id: string;
	icon?: IUserFriendlyIcon;
}

export type IUserFriendlyIcon = string | { light: string; dark: string; };

const account: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			description: localize('carbon.extension.contributes.account.id', 'Identifier of the account type'),
			type: 'string'
		},
		icon: {
			description: localize('carbon.extension.contributes.account.icon', '(Optional) Icon which is used to represent the accpunt in the UI. Either a file path or a themable configuration'),
			anyOf: [{
				type: 'string'
			},
			{
				type: 'object',
				properties: {
					light: {
						description: localize('carbon.extension.contributes.account.icon.light', 'Icon path when a light theme is used'),
						type: 'string'
					},
					dark: {
						description: localize('carbon.extension.contributes.account.icon.dark', 'Icon path when a dark theme is used'),
						type: 'string'
					}
				}
			}]
		}
	}
};

export const accountsContribution: IJSONSchema = {
	description: localize('carbon.extension.contributes.account', "Contributes icons to account provider."),
	oneOf: [
		account,
		{
			type: 'array',
			items: account
		}
	]
};

ExtensionsRegistry.registerExtensionPoint<IAccountContrib | IAccountContrib[]>('account-type', [], accountsContribution).setHandler(extensions => {

	function handleCommand(account: IAccountContrib, extension: IExtensionPointUser<any>) {
		let { icon, id } = account;
		let iconClass: string;
		if (icon) {
			iconClass = id;
			if (typeof icon === 'string') {
				const path = join(extension.description.extensionLocation.fsPath, icon);
				createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(path).toString()}")`);
			} else {
				const light = join(extension.description.extensionLocation.fsPath, icon.light);
				const dark = join(extension.description.extensionLocation.fsPath, icon.dark);
				createCSSRule(`.icon.${iconClass}`, `background-image: url("${URI.file(light).toString()}")`);
				createCSSRule(`.vs-dark .icon.${iconClass}, .hc-black .icon.${iconClass}`, `background-image: url("${URI.file(dark).toString()}")`);
			}
		}
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<IAccountContrib>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}

});

