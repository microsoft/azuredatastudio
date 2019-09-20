/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageBoxOptions, MessageBoxReturnValue } from 'electron';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IElectronService = createDecorator<IElectronService>('electronService');

export interface IElectronService {

	_serviceBrand: undefined;

	// Window
	windowCount(): Promise<number>;

	// Dialogs
	showMessageBox(options: MessageBoxOptions): Promise<MessageBoxReturnValue>;

	// OS
	showItemInFolder(path: string): Promise<void>;
}
