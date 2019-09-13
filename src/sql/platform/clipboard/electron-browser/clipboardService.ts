/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IClipboardService as vsIClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ClipboardService as BrowserClipboardService } from 'sql/platform/clipboard/browser/clipboardService';
import { clipboard, nativeImage } from 'electron';

export class ClipboardService extends BrowserClipboardService {
	_serviceBrand: any;

	constructor(
		@vsIClipboardService _vsClipboardService: vsIClipboardService
	) {
		super(_vsClipboardService);
	}

	/**
	 * Writes the input image as a dataurl to the clipbaord
	 */
	async writeImageDataUrl(data: string): Promise<boolean> {
		let image = nativeImage.createFromDataURL(data);
		clipboard.writeImage(image);
		return true;
	}
}
