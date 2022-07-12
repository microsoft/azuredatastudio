/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export const SideBarVisibleContext = new RawContextKey<boolean>('sideBarVisible', false, localize('sideBarVisible', "Whether the sidebar is visible"));
export const SidebarFocusContext = new RawContextKey<boolean>('sideBarFocus', false, localize('sideBarFocus', "Whether the sidebar has keyboard focus"));
export const ActiveViewletContext = new RawContextKey<string>('activeViewlet', '', localize('activeViewlet', "The identifier of the active viewlet"));
