/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IClipboardService as vsIClipboardService } from 'vs/platform/clipboard/common/clipboardService';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IClipboardService = createDecorator<IClipboardService>('sqlclipboardService');

export interface IClipboardService extends vsIClipboardService {
	/**
	 * Writes the input image as a dataurl to the clipbaord
	 */
	writeImageDataUrl(data: string): Promise<void>;
}
