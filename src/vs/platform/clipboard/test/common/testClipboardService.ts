/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { ClipboardData, IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

export class TestClipboardService implements IClipboardService {

	_serviceBrand: undefined;

	private text: string | undefined = undefined;

	async write(data: ClipboardData, type?: string): Promise<void> { // {{SQL CARBON EDIT}} - add method
	}

	async writeText(text: string, type?: string): Promise<void> {
		this.text = text;
	}

	async readText(type?: string): Promise<string> {
		return this.text ?? '';
	}

	private findText: string | undefined = undefined;

	async readFindText(): Promise<string> {
		return this.findText ?? '';
	}

	async writeFindText(text: string): Promise<void> {
		this.findText = text;
	}

	private resources: URI[] | undefined = undefined;

	async writeResources(resources: URI[]): Promise<void> {
		this.resources = resources;
	}

	async readResources(): Promise<URI[]> {
		return this.resources ?? [];
	}

	async hasResources(): Promise<boolean> {
		return Array.isArray(this.resources) && this.resources.length > 0;
	}
}
