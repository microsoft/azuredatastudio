/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IUserFriendlyIcon } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { asCSSUrl, createCSSRule } from 'vs/base/browser/dom';
import { IdGenerator } from 'vs/base/common/idGenerator';
import * as resources from 'vs/base/common/resources';
import * as nls from 'vs/nls';
import { IExtensionPointUser } from 'vs/workbench/services/extensions/common/extensionsRegistry';

const ids = new IdGenerator('contrib-dashboard-icon-');
export function createCSSRuleForIcon(icon: IUserFriendlyIcon, extension: IExtensionPointUser<any>): string {
	let iconClass: string;
	if (icon) {
		iconClass = ids.nextId();
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
	return iconClass;
}

export function isValidIcon(icon: IUserFriendlyIcon, extension: IExtensionPointUser<any>): boolean {
	if (typeof icon === 'undefined') {
		return false;
	}
	if (typeof icon === 'string') {
		return true;
	} else if (typeof icon.dark === 'string' && typeof icon.light === 'string') {
		return true;
	}
	extension.collector.error(nls.localize('opticon', "property `icon` can be omitted or must be either a string or a literal like `{dark, light}`"));
	return false;
}
