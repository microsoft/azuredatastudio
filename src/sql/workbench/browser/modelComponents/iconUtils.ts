/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { asCSSUrl, createCSSRule, removeCSSRulesContainingSelector } from 'vs/base/browser/dom';
import { IdGenerator } from 'vs/base/common/idGenerator';
import { URI } from 'vs/base/common/uri';

const ids = new IdGenerator('model-view-component-icon-');

export type IconPath = string | URI | { light: string | URI; dark: string | URI };

/**
 * Create a CSS class for the specified icon, if a class with the name already exists, it will be deleted first.
 * @param iconPath icon specification
 * @param className optional, the class name you want to reuse.
 * @returns the CSS class name
 */
export function createIconCssClass(iconPath: IconPath, className?: string): string {
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

function getLightIconUri(iconPath: IconPath): URI {
	if (iconPath && iconPath['light']) {
		return getIconUri(iconPath['light']);
	} else {
		return getIconUri(<string | URI>iconPath);
	}
}

function getDarkIconUri(iconPath: IconPath): URI {
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

export function getIconKey(iconPath: IconPath): string {
	return getLightIconUri(iconPath).toString(true) + getDarkIconUri(iconPath)?.toString(true);
}
