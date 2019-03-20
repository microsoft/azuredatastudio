/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IComposite } from 'vs/workbench/common/composite';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export const ActivePanelContext = new RawContextKey<string>('activePanel', '');
export const PanelFocusContext = new RawContextKey<boolean>('panelFocus', false);

export interface IPanel extends IComposite { }
