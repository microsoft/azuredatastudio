/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IdGenerator } from 'vs/base/common/idGenerator';
import { removeCSSRulesContainingSelector, createCSSRule, asCSSUrl } from 'vs/base/browser/dom';
import { URI } from 'vs/base/common/uri';

const ids = new IdGenerator('model-view-component-icon-');

export type IUserFriendlyIcon = string | URI | { light: string | URI; dark: string | URI };

export function getIconClass(iconPath: IUserFriendlyIcon, className?: string): string {
	let iconClass = className;
	if (!iconClass) {
		iconClass = ids.nextId();
	}
	removeCSSRulesContainingSelector(iconClass);
	const icon = getLightIconUri(iconPath);
	const iconDark = getDarkIconUri(iconPath) || icon;
	createCSSRule(`.icon.${iconClass}`, `background-image: ${asCSSUrl(icon)}`);
	createCSSRule(`.vs-dark .icon.${iconClass}, .hc-black .icon.${iconClass}`, `background-image: ${asCSSUrl(iconDark)}`);
	return iconClass;
}

function getLightIconUri(iconPath: IUserFriendlyIcon): URI {
	if (iconPath && iconPath['light']) {
		return getIconUri(iconPath['light']);
	} else {
		return getIconUri(<string | URI>iconPath);
	}
}

function getDarkIconUri(iconPath: IUserFriendlyIcon): URI {
	if (iconPath && iconPath['dark']) {
		return getIconUri(iconPath['dark']);
	}
	return null;
}

function getIconUri(iconPath: string | URI): URI {
	if (typeof iconPath === 'string') {
		return URI.file(iconPath);
	} else {
		return URI.revive(iconPath);
	}
}
