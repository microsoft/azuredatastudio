/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { $, EventHelper, EventLike } from 'vs/base/browser/dom';
import { DomEmitter, domEvent } from 'vs/base/browser/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Disposable } from 'vs/base/common/lifecycle';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { textLinkActiveForeground, textLinkForeground } from 'vs/platform/theme/common/colorRegistry';

export interface ILinkDescriptor {
	readonly label: string;
	readonly href: string;
	readonly title?: string;
}

export interface ILinkOptions {
	readonly opener?: (href: string) => void;
	readonly textLinkForeground?: string;
}

export class Link extends Disposable {

	readonly el: HTMLAnchorElement;
	private _enabled: boolean = true;

	get enabled(): boolean {
		return this._enabled;
	}

	set enabled(enabled: boolean) {
		if (enabled) {
			this.el.setAttribute('aria-disabled', 'false');
			this.el.tabIndex = 0;
			this.el.style.pointerEvents = 'auto';
			this.el.style.opacity = '1';
			this.el.style.cursor = 'pointer';
			this._enabled = false;
		} else {
			this.el.setAttribute('aria-disabled', 'true');
			this.el.tabIndex = -1;
			this.el.style.pointerEvents = 'none';
			this.el.style.opacity = '0.4';
			this.el.style.cursor = 'default';
			this._enabled = true;
		}

		this._enabled = enabled;
	}

	constructor(
		link: ILinkDescriptor,
		options: ILinkOptions | undefined = undefined,
		@IOpenerService openerService: IOpenerService
	) {
		super();

		this.el = $<HTMLAnchorElement>('a.monaco-link', {
			tabIndex: 0,
			href: link.href,
			title: link.title
		}, link.label);

		const onClickEmitter = this._register(new DomEmitter(this.el, 'click'));
		const onEnterPress = Event.chain(domEvent(this.el, 'keypress'))
			.map(e => new StandardKeyboardEvent(e))
			.filter(e => e.keyCode === KeyCode.Enter)
			.event;
		const onOpen = Event.any<EventLike>(onClickEmitter.event, onEnterPress);

		this._register(onOpen(e => {
			if (!this.enabled) {
				return;
			}

			EventHelper.stop(e, true);

			if (options?.opener) {
				options.opener(link.href);
			} else {
				openerService.open(link.href, { allowCommands: true });
			}
		}));

		this.enabled = true;
	}
}

registerThemingParticipant((theme, collector) => {
	const textLinkForegroundColor = theme.getColor(textLinkForeground);
	if (textLinkForegroundColor) {
		collector.addRule(`.monaco-link { color: ${textLinkForegroundColor}; }`);
	}

	const textLinkActiveForegroundColor = theme.getColor(textLinkActiveForeground);
	if (textLinkActiveForegroundColor) {
		collector.addRule(`.monaco-link:hover { color: ${textLinkActiveForegroundColor}; }`);
	}
});
