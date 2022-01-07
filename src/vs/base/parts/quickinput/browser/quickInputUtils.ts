/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { IdGenerator } from 'vs/base/common/idGenerator';
import { URI } from 'vs/base/common/uri';
import 'vs/css!./media/quickInput';

const iconPathToClass: Record<string, string> = {};
const iconClassGenerator = new IdGenerator('quick-input-button-icon-');

export function getIconClass(iconPath: { dark: URI; light?: URI; } | undefined): string | undefined {
	if (!iconPath) {
		return undefined;
	}
	let iconClass: string;

	const key = iconPath.dark.toString();
	if (iconPathToClass[key]) {
		iconClass = iconPathToClass[key];
	} else {
		iconClass = iconClassGenerator.nextId();
		dom.createCSSRule(`.${iconClass}`, `background-image: ${dom.asCSSUrl(iconPath.light || iconPath.dark)}`);
		dom.createCSSRule(`.vs-dark .${iconClass}, .hc-black .${iconClass}`, `background-image: ${dom.asCSSUrl(iconPath.dark)}`);
		iconPathToClass[key] = iconClass;
	}

	return iconClass;
}
