/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import { createCSSRule, asCSSUrl } from 'vs/base/browser/dom';
import * as resources from 'vs/base/common/resources';

export interface IAccountContrib {
	id: string;
	icon?: IUserFriendlyIcon;
}

export type IUserFriendlyIcon = string | { light: string; dark: string; };

const account: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			description: localize('carbon.extension.contributes.account.id', "Identifier of the account type"),
			type: 'string'
		},
		icon: {
			description: localize('carbon.extension.contributes.account.icon', "(Optional) Icon which is used to represent the accpunt in the UI. Either a file path or a themable configuration"),
			anyOf: [{
				type: 'string'
			},
			{
				type: 'object',
				properties: {
					light: {
						description: localize('carbon.extension.contributes.account.icon.light', "Icon path when a light theme is used"),
						type: 'string'
					},
					dark: {
						description: localize('carbon.extension.contributes.account.icon.dark', "Icon path when a dark theme is used"),
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

ExtensionsRegistry.registerExtensionPoint<IAccountContrib | IAccountContrib[]>({ extensionPoint: 'account-type', jsonSchema: accountsContribution }).setHandler(extensions => {

	function handleCommand(account: IAccountContrib, extension: IExtensionPointUser<any>) {
		const { icon, id } = account;
		if (icon) {
			const iconClass = id;
			if (typeof icon === 'string') {
				const path = resources.joinPath(extension.description.extensionLocation, icon);
				createCSSRule(`.codicon.${iconClass}`, `background-image: ${asCSSUrl(path)}`);
			} else {
				const light = resources.joinPath(extension.description.extensionLocation, icon.light);
				const dark = resources.joinPath(extension.description.extensionLocation, icon.dark);
				createCSSRule(`.codicon.${iconClass}`, `background-image: ${asCSSUrl(light)}`);
				createCSSRule(`.vs-dark .codicon.${iconClass}, .hc-black .codicon.${iconClass}`, `background-image: ${asCSSUrl(dark)}`);
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
