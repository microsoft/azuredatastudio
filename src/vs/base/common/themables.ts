/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlIconId } from 'sql/base/common/codicons';
import { Codicon } from 'vs/base/common/codicons';

export type ColorIdentifier = string;

export type IconIdentifier = string;

export interface ThemeColor {
	id: string;
}

export namespace ThemeColor {
	export function isThemeColor(obj: any): obj is ThemeColor {
		return obj && typeof obj === 'object' && typeof (<ThemeColor>obj).id === 'string';
	}
}

export function themeColorFromId(id: ColorIdentifier) {
	return { id };
}


export interface ThemeIcon {
	readonly id: string;
	readonly color?: ThemeColor;
}

export namespace ThemeIcon {
	export const iconNameSegment = '[A-Za-z0-9]+';
	export const iconNameExpression = '[A-Za-z0-9-]+';
	export const iconModifierExpression = '~[A-Za-z]+';
	export const iconNameCharacter = '[A-Za-z0-9~-]';

	const ThemeIconIdRegex = new RegExp(`^(${iconNameExpression})(${iconModifierExpression})?$`);


	// {{SQL CARBON TODO}} - do we need the edit block below
	// export function asClassNameArray(icon: CSSIcon): string[] {
	// 	if (icon instanceof Codicon) {
	// 		return ['codicon', 'codicon-' + icon.id];
	// 	}
	// 	const match = cssIconIdRegex.exec(icon.id);
	// 	if (!match) {
	// 		return asClassNameArray(Codicon.error);
	// 	}
	// 	const [, id, modifier] = match;

	// 	// {{SQL CARBON EDIT}} Modifying method to not add 'codicon' in front of sql carbon icons.
	// 	let sqlCarbonIcons: string[] = [SqlIconId.activeConnectionsAction, SqlIconId.addServerAction, SqlIconId.addServerGroupAction, SqlIconId.serverPage];
	// 	if (sqlCarbonIcons.includes(id)) {
	// 		return ['codicon', id];
	// 		// {{SQL CARBON EDIT}} End of edit
	// 	} else {
	// 		const classNames = ['codicon', 'codicon-' + id];
	// 		if (modifier) {
	// 			classNames.push('codicon-modifier-' + modifier.substr(1));
	// 		}
	// 		return classNames;
	// 	}
	// }

	export function asClassNameArray(icon: ThemeIcon): string[] {
		const match = ThemeIconIdRegex.exec(icon.id);
		if (!match) {
			return asClassNameArray(Codicon.error);
		}

		// {{SQL CARBON EDIT}} Modifying method to not add 'codicon' in front of sql carbon icons.
		const [, id, modifier] = match;
		let sqlCarbonIcons: string[] = [SqlIconId.activeConnectionsAction, SqlIconId.addServerAction, SqlIconId.addServerGroupAction, SqlIconId.serverPage];
		if (sqlCarbonIcons.includes(id)) {
			return ['codicon', id];
			// {{SQL CARBON EDIT}} End of edit
		} else {
			const classNames = ['codicon', 'codicon-' + id];
			if (modifier) {
				classNames.push('codicon-modifier-' + modifier.substring(1));
			}
			return classNames;
		}
	}

	export function asClassName(icon: ThemeIcon): string {
		return asClassNameArray(icon).join(' ');
	}

	export function asCSSSelector(icon: ThemeIcon): string {
		return '.' + asClassNameArray(icon).join('.');
	}

	export function isThemeIcon(obj: any): obj is ThemeIcon {
		return obj && typeof obj === 'object' && typeof (<ThemeIcon>obj).id === 'string' && (typeof (<ThemeIcon>obj).color === 'undefined' || ThemeColor.isThemeColor((<ThemeIcon>obj).color));
	}

	const _regexFromString = new RegExp(`^\\$\\((${ThemeIcon.iconNameExpression}(?:${ThemeIcon.iconModifierExpression})?)\\)$`);

	export function fromString(str: string): ThemeIcon | undefined {
		const match = _regexFromString.exec(str);
		if (!match) {
			return undefined;
		}
		const [, name] = match;
		return { id: name };
	}

	export function fromId(id: string): ThemeIcon {
		return { id };
	}

	export function modify(icon: ThemeIcon, modifier: 'disabled' | 'spin' | undefined): ThemeIcon {
		let id = icon.id;
		const tildeIndex = id.lastIndexOf('~');
		if (tildeIndex !== -1) {
			id = id.substring(0, tildeIndex);
		}
		if (modifier) {
			id = `${id}~${modifier}`;
		}
		return { id };
	}

	export function getModifier(icon: ThemeIcon): string | undefined {
		const tildeIndex = icon.id.lastIndexOf('~');
		if (tildeIndex !== -1) {
			return icon.id.substring(tildeIndex + 1);
		}
		return undefined;
	}

	export function isEqual(ti1: ThemeIcon, ti2: ThemeIcon): boolean {
		return ti1.id === ti2.id && ti1.color?.id === ti2.color?.id;
	}

}
