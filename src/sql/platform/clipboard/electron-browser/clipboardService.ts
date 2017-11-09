/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IClipboardService as vsIClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { clipboard, nativeImage } from 'electron';

export class ClipboardService implements IClipboardService {
	_serviceBrand: any;

	constructor(
		@vsIClipboardService private _vsClipboardService: vsIClipboardService
	) { }

	/**
	 * Writes the input image as a dataurl to the clipbaord
	 */
	writeImageDataUrl(data: string): void {
		let image = nativeImage.createFromDataURL(data);
		clipboard.writeImage(image);
	}

	writeText(text: string): void {
		this._vsClipboardService.writeText(text);
	}
}
