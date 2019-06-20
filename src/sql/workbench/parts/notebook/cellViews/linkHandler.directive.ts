/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Directive, Inject, HostListener, Input } from '@angular/core';

import { URI } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { onUnexpectedError } from 'vs/base/common/errors';
import product from 'vs/platform/product/node/product';

const knownSchemes = new Set(['http', 'https', 'file', 'mailto', 'data', `${product.urlProtocol}`, 'azuredatastudio', 'azuredatastudio-insiders', 'vscode', 'vscode-insiders', 'vscode-resource']);
@Directive({
	selector: '[link-handler]',
})
export class LinkHandlerDirective {

	@Input() isTrusted: boolean;
	constructor(@Inject(IOpenerService) private readonly openerService: IOpenerService) {
	}

	@HostListener('click', ['$event'])
	onclick(event: MouseEvent): void {
		// Note: this logic is taken from the VSCode handling of links in markdown
		// Untrusted cells will not support commands or raw HTML tags
		// Finally, we should consider supporting relative paths - created #5238 to track
		let target: HTMLElement = event.target as HTMLElement;
		if (target.tagName !== 'A') {
			target = target.parentElement;
			if (!target || target.tagName !== 'A') {
				return;
			}
		}
		try {
			const href = target['href'];
			if (href) {
				this.handleLink(href);
			}
		} catch (err) {
			onUnexpectedError(err);
		} finally {
			event.preventDefault();
		}
	}

	private handleLink(content: string): void {
		let uri: URI | undefined;
		try {
			uri = URI.parse(content);
		} catch {
			// ignore
		}
		if (uri && this.openerService && this.isSupportedLink(uri)) {
			this.openerService.open(uri).catch(onUnexpectedError);
		}
	}

	private isSupportedLink(link: URI): boolean {
		if (knownSchemes.has(link.scheme)) {
			return true;
		}
		return !!this.isTrusted && link.scheme === 'command';
	}
}