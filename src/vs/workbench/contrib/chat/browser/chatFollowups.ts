/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { Button, IButtonStyles } from 'vs/base/browser/ui/button/button';
import { MarkdownString } from 'vs/base/common/htmlContent';
import { Disposable } from 'vs/base/common/lifecycle';
import { IChatFollowup } from 'vs/workbench/contrib/chat/common/chatService';

const $ = dom.$;

export class ChatFollowups<T extends IChatFollowup> extends Disposable {
	constructor(
		container: HTMLElement,
		followups: T[],
		private readonly options: IButtonStyles | undefined,
		private readonly clickHandler: (followup: T) => void,
	) {
		super();

		const followupsContainer = dom.append(container, $('.interactive-session-followups'));
		followups.forEach(followup => this.renderFollowup(followupsContainer, followup));
	}

	private renderFollowup(container: HTMLElement, followup: T): void {
		const tooltip = 'tooltip' in followup ? followup.tooltip : undefined;
		const button = this._register(new Button(container, { ...this.options, supportIcons: true, title: tooltip }));
		if (followup.kind === 'reply') {
			button.element.classList.add('interactive-followup-reply');
		} else if (followup.kind === 'command') {
			button.element.classList.add('interactive-followup-command');
		}

		const label = followup.kind === 'reply' ?
			'$(sparkle) ' + (followup.title || followup.message) :
			followup.title;
		button.label = new MarkdownString(label, { supportThemeIcons: true });

		this._register(button.onDidClick(() => this.clickHandler(followup)));
	}
}
