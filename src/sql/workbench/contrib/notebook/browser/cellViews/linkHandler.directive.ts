/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Directive, Inject, HostListener, Input } from '@angular/core';

import { URI } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { onUnexpectedError } from 'vs/base/common/errors';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { dirname, basename } from 'vs/base/common/path';

const knownSchemes = new Set(['http', 'https', 'file', 'mailto', 'data', 'azuredatastudio', 'azuredatastudio-insiders', 'vscode', 'vscode-insiders', 'vscode-resource', 'onenote']);
@Directive({
	selector: '[link-handler]',
})
export class LinkHandlerDirective {
	private workbenchFilePath: URI;
	@Input() isTrusted: boolean;
	@Input() notebookUri: URI;

	constructor(
		@Inject(IOpenerService) private readonly openerService: IOpenerService,
		@Inject(INotebookService) private readonly notebookService: INotebookService
	) {
		this.workbenchFilePath = URI.parse(require.toUrl('vs/code/electron-browser/workbench/workbench.html'));
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
			if (uri.fragment && uri.fragment.length > 0 && uri.fsPath === this.workbenchFilePath.fsPath) {
				this.notebookService.navigateTo(this.notebookUri, uri.fragment);
			} else {
				let newUri: URI | undefined;
				let path = dirname(this.notebookUri.path);
				path = 'file://' + path + '//' + basename(uri.path);
				try {
					newUri = URI.parse(path);
				} catch{
					//ignore
				}
				if (this.forceOpenExternal(newUri)) {
					this.openerService.open(newUri, { openExternal: true }).catch(onUnexpectedError);
				}
				else {
					this.openerService.open(newUri).catch(onUnexpectedError);
				}
			}
		}
	}

	private isSupportedLink(link: URI): boolean {
		if (knownSchemes.has(link.scheme)) {
			return true;
		}
		return !!this.isTrusted && link.scheme === 'command';
	}

	private forceOpenExternal(link: URI): boolean {
		if (link.scheme.toLowerCase() === 'onenote') {
			return true;
		}
		return false;
	}
}
