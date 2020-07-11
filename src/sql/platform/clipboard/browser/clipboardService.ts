/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IClipboardService as vsIClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';

export class BrowserClipboardService implements IClipboardService {
	_serviceBrand: any;

	constructor(
		@vsIClipboardService private _vsClipboardService: vsIClipboardService,
		@INotificationService private _notificationService: INotificationService
	) { }

	/**
	 * Writes the input image as a dataurl to the clipbaord
	 */
	async writeImageDataUrl(data: string): Promise<void> {
		// not implemented until web standards catch up
		this._notificationService.info(localize('imageCopyingNotSupported', "Copying images is not supported"));
	}

	writeText(text: string): Promise<void> {
		return this._vsClipboardService.writeText(text);
	}

	/**
	 * Reads the content of the clipboard in plain text
	 */
	readText(): Promise<string> {
		return this._vsClipboardService.readText();
	}
	/**
	 * Reads text from the system find pasteboard.
	 */
	readFindText(): Promise<string> {
		return this._vsClipboardService.readFindText();
	}

	/**
	 * Writes text to the system find pasteboard.
	 */
	writeFindText(text: string): Promise<void> {
		return this._vsClipboardService.writeFindText(text);
	}

	/**
	 * Writes resources to the system clipboard.
	 */
	writeResources(resources: URI[]): Promise<void> {
		return this._vsClipboardService.writeResources(resources);
	}

	/**
	 * Reads resources from the system clipboard.
	 */
	readResources(): Promise<URI[]> {
		return this._vsClipboardService.readResources();
	}

	/**
	 * Find out if resources are copied to the clipboard.
	 */
	hasResources(): Promise<boolean> {
		return this._vsClipboardService.hasResources();
	}
}
