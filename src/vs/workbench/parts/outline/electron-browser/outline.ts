/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export const OutlineViewId = 'outline';

export const OutlineViewFiltered = new RawContextKey('outlineFiltered', false);
export const OutlineViewFocused = new RawContextKey('outlineFocused', false);

export enum OutlineConfigKeys {
	'icons' = 'outline.icons',
	'problemsEnabled' = 'outline.problems.enabled',
	'problemsColors' = 'outline.problems.colors',
	'problemsBadges' = 'outline.problems.badges'
}
