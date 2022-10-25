/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isSafari, isWebkitWebView } from 'vs/base/browser/browser';
import { $, addDisposableListener } from 'vs/base/browser/dom';
import { DeferredPromise } from 'vs/base/common/async';
import { Disposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { ClipboardData, IClipboardService } from 'vs/platform/clipboard/common/clipboardService';	// {{SQL CARBON EDIT}}
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILogService } from 'vs/platform/log/common/log';

export class BrowserClipboardService extends Disposable implements IClipboardService {

	declare readonly _serviceBrand: undefined;

	private readonly mapTextToType = new Map<string, string>(); // unsupported in web (only in-memory)

	// {{SQL CARBON EDIT}}
	async write(data: ClipboardData, type?: string): Promise<void> {
		throw new Error('Not Implemented');
	}

	constructor(
		@ILayoutService private readonly layoutService: ILayoutService,
		@ILogService private readonly logService: ILogService) {
		super();
		if (isSafari || isWebkitWebView) {
			this.installWebKitWriteTextWorkaround();
		}
	}

	private webKitPendingClipboardWritePromise: DeferredPromise<string> | undefined;

	// In Safari, it has the following note:
	//
	// "The request to write to the clipboard must be triggered during a user gesture.
	// A call to clipboard.write or clipboard.writeText outside the scope of a user
	// gesture(such as "click" or "touch" event handlers) will result in the immediate
	// rejection of the promise returned by the API call."
	// From: https://webkit.org/blog/10855/async-clipboard-api/
	//
	// Since extensions run in a web worker, and handle gestures in an asynchronous way,
	// they are not classified by Safari as "in response to a user gesture" and will reject.
	//
	// This function sets up some handlers to work around that behavior.
	private installWebKitWriteTextWorkaround(): void {
		const handler = () => {
			const currentWritePromise = new DeferredPromise<string>();

			// Cancel the previous promise since we just created a new one in response to this new event
			if (this.webKitPendingClipboardWritePromise && !this.webKitPendingClipboardWritePromise.isSettled) {
				this.webKitPendingClipboardWritePromise.cancel();
			}
			this.webKitPendingClipboardWritePromise = currentWritePromise;

			// The ctor of ClipboardItem allows you to pass in a promise that will resolve to a string.
			// This allows us to pass in a Promise that will either be cancelled by another event or
			// resolved with the contents of the first call to this.writeText.
			// see https://developer.mozilla.org/en-US/docs/Web/API/ClipboardItem/ClipboardItem#parameters
			navigator.clipboard.write([new ClipboardItem({
				'text/plain': currentWritePromise.p,
			})]).catch(async err => {
				if (!(err instanceof Error) || err.name !== 'NotAllowedError' || !currentWritePromise.isRejected) {
					this.logService.error(err);
				}
			});
		};

		if (this.layoutService.hasContainer) {
			this._register(addDisposableListener(this.layoutService.container, 'click', handler));
			this._register(addDisposableListener(this.layoutService.container, 'keydown', handler));
		}
	}

	async writeText(text: string, type?: string): Promise<void> {

		// With type: only in-memory is supported
		if (type) {
			this.mapTextToType.set(type, text);

			return;
		}

		if (this.webKitPendingClipboardWritePromise) {
			// For Safari, we complete this Promise which allows the call to `navigator.clipboard.write()`
			// above to resolve and successfully copy to the clipboard. If we let this continue, Safari
			// would throw an error because this call stack doesn't appear to originate from a user gesture.
			return this.webKitPendingClipboardWritePromise.complete(text);
		}

		// Guard access to navigator.clipboard with try/catch
		// as we have seen DOMExceptions in certain browsers
		// due to security policies.
		try {
			return await navigator.clipboard.writeText(text);
		} catch (error) {
			console.error(error);
		}

		// Fallback to textarea and execCommand solution

		const activeElement = document.activeElement;

		const textArea: HTMLTextAreaElement = document.body.appendChild($('textarea', { 'aria-hidden': true }));
		textArea.style.height = '1px';
		textArea.style.width = '1px';
		textArea.style.position = 'absolute';

		textArea.value = text;
		textArea.focus();
		textArea.select();

		document.execCommand('copy');

		if (activeElement instanceof HTMLElement) {
			activeElement.focus();
		}

		document.body.removeChild(textArea);

		return;
	}

	async readText(type?: string): Promise<string> {

		// With type: only in-memory is supported
		if (type) {
			return this.mapTextToType.get(type) || '';
		}

		// Guard access to navigator.clipboard with try/catch
		// as we have seen DOMExceptions in certain browsers
		// due to security policies.
		try {
			return await navigator.clipboard.readText();
		} catch (error) {
			console.error(error);

			return '';
		}
	}

	private findText = ''; // unsupported in web (only in-memory)

	async readFindText(): Promise<string> {
		return this.findText;
	}

	async writeFindText(text: string): Promise<void> {
		this.findText = text;
	}

	private resources: URI[] = []; // unsupported in web (only in-memory)

	async writeResources(resources: URI[]): Promise<void> {
		this.resources = resources;
	}

	async readResources(): Promise<URI[]> {
		return this.resources;
	}

	async hasResources(): Promise<boolean> {
		return this.resources.length > 0;
	}
}
