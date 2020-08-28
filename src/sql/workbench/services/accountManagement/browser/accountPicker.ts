/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';

import * as azdata from 'azdata';

export const IAccountPickerService = createDecorator<IAccountPickerService>('AccountPickerService');
export interface IAccountPickerService {
	_serviceBrand: undefined;
	renderAccountPicker(rootContainer: HTMLElement): void;
	addAccountCompleteEvent: Event<void>;
	addAccountErrorEvent: Event<string>;
	addAccountStartEvent: Event<void>;
	onAccountSelectionChangeEvent: Event<azdata.Account | undefined>;
	onTenantSelectionChangeEvent: Event<string | undefined>;
	selectedAccount: azdata.Account | undefined;
}
