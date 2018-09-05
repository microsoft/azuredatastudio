/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MessagePoster } from './messaging';

export class StyleLoadingMonitor {
	private unloadedStyles: string[] = [];
	private finishedLoading: boolean = false;

	private poster?: MessagePoster;

	constructor() {
		const onStyleLoadError = (event: any) => {
			const source = event.target.dataset.source;
			this.unloadedStyles.push(source);
		};

		window.addEventListener('DOMContentLoaded', () => {
			for (const link of document.getElementsByClassName('code-user-style') as HTMLCollectionOf<HTMLElement>) {
				if (link.dataset.source) {
					link.onerror = onStyleLoadError;
				}
			}
		});

		window.addEventListener('load', () => {
			if (!this.unloadedStyles.length) {
				return;
			}
			this.finishedLoading = true;
			if (this.poster) {
				this.poster.postCommand('_markdown.onPreviewStyleLoadError', [this.unloadedStyles]);
			}
		});
	}

	public setPoster(poster: MessagePoster): void {
		this.poster = poster;
		if (this.finishedLoading) {
			poster.postCommand('_markdown.onPreviewStyleLoadError', [this.unloadedStyles]);
		}
	}
}