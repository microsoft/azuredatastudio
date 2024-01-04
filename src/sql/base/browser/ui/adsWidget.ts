/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Widget } from 'vs/base/browser/ui/widget';
``
/**
 * This interface is implemented by SelectBox and InputBox to provide a common API surface area in connectionWidget.ts
 * If more widgets must be used in Connection Dialog, they should implement this interface.
 */
export interface AdsWidget extends Widget {

	get value(): string;

	get id(): string;

	getAriaLabel(): string;

	enable(): void;

	disable(): void;

	hideMessage(): void;
}
