/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotificationService } from 'vs/platform/notification/common/notification';
import { IClipboardService as vsIClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { BrowserClipboardService } from 'sql/platform/clipboard/browser/clipboardService';
import { clipboard, nativeImage } from 'electron';

export class ClipboardService extends BrowserClipboardService {
	_serviceBrand: undefined;

	constructor(
		@vsIClipboardService _vsClipboardService: vsIClipboardService,
		@INotificationService _notificationService: INotificationService
	) {
		super(_vsClipboardService, _notificationService);
	}

	/**
	 * Writes the input image as a dataurl to the clipbaord
	 */
	async writeImageDataUrl(data: string): Promise<void> {
		let image = nativeImage.createFromDataURL(data);
		return clipboard.writeImage(image);
	}
}
