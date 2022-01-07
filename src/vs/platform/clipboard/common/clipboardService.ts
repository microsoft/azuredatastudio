/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IClipboardService = createDecorator<IClipboardService>('clipboardService');

// Added type https://www.electronjs.org/docs/api/clipboard#clipboardwritedata-type
export interface ClipboardData {	// {{SQL CARBON EDIT}}
	text?: string;
	html?: string;
	rtf?: string;
	bookmark?: string;
}

export interface IClipboardService {

	readonly _serviceBrand: undefined;
	/**
	 * Writes data to the system clipboard.
	 */
	write(data: ClipboardData, type?: string): Promise<void>;	// {{SQL CARBON EDIT}}

	/**
	 * Writes text to the system clipboard.
	 */
	writeText(text: string, type?: string): Promise<void>;

	/**
	 * Reads the content of the clipboard in plain text
	 */
	readText(type?: string): Promise<string>;

	/**
	 * Reads text from the system find pasteboard.
	 */
	readFindText(): Promise<string>;

	/**
	 * Writes text to the system find pasteboard.
	 */
	writeFindText(text: string): Promise<void>;

	/**
	 * Writes resources to the system clipboard.
	 */
	writeResources(resources: URI[]): Promise<void>;

	/**
	 * Reads resources from the system clipboard.
	 */
	readResources(): Promise<URI[]>;

	/**
	 * Find out if resources are copied to the clipboard.
	 */
	hasResources(): Promise<boolean>;
}
