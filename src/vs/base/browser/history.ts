/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';

export interface IHistoryNavigationWidget {

	readonly element: HTMLElement;

	showPreviousValue(): void;

	showNextValue(): void;

	onDidFocus: Event<void>;

	onDidBlur: Event<void>;

}
