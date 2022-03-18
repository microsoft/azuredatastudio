/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IconPath } from 'sql/workbench/api/common/sqlExtHostTypes';
import { createCSSRule, asCSSUrl } from 'vs/base/browser/dom';
import { hash } from 'vs/base/common/hash';
import { URI } from 'vs/base/common/uri';

class IconRenderer {
	private iconRegistered: Set<string> = new Set<string>();

	public registerIcon(path: IconPath | undefined): string | undefined {
		if (!path) { return undefined; }
		const iconPath: ThemedIconUri = this.toThemedIconUri(path);
		const iconUid: string | undefined = this.getIconUid(iconPath);
		if (iconUid && !this.iconRegistered.has(iconUid)) {
			createCSSRule(`.icon#${iconUid}`, `background: ${asCSSUrl(iconPath.light || iconPath.dark)} center center no-repeat`);
			createCSSRule(`.vs-dark .icon#${iconUid}, .hc-black .icon#${iconUid}`, `background: ${asCSSUrl(iconPath.dark)} center center no-repeat`);
			this.iconRegistered.add(iconUid);
		}
		return iconUid;
	}

	public getIconUid(path: IconPath): string | undefined {
		if (!path) { return undefined; }
		const iconPath: ThemedIconUri = this.toThemedIconUri(path);
		return `icon${hash(iconPath.light.toString() + iconPath.dark.toString())}`;
	}

	private toThemedIconUri(path: IconPath): ThemedIconUri {
		let light, dark: string | URI;

		if (URI.isUri(path) || (typeof (path) === 'string')) {
			light = dark = path;
		} else {
			light = path.light;
			dark = path.dark;
		}
		return {
			light: this.toUri(light),
			dark: this.toUri(dark)
		};
	}

	private toUri(path: string | URI): URI {
		return URI.isUri(path) ? path : URI.file(path);
	}

	public putIcon(element: HTMLElement, path: IconPath | undefined): void {
		let iconUid: string | undefined = this.registerIcon(path);
		element.id = iconUid ?? '';
	}

	public removeIcon(element: HTMLElement): void {
		if (!element) { return undefined; }
		element.id = '';
	}
}

export const iconRenderer: IconRenderer = new IconRenderer();

class BadgeRenderer {
	public readonly serverConnected: string = 'serverConnected';
	public readonly serverDisconnected: string = 'serverDisconnected';
	public readonly newTag: string = 'newTag';

	private badgeCreated: Set<string> = new Set<string>();

	constructor() {
		this.createBadge(this.serverConnected, this.getConnectionStatusBadge(true));
		this.createBadge(this.serverDisconnected, this.getConnectionStatusBadge(false));
		this.createBadge(this.newTag, this.getNewTagBadge());
	}

	private getConnectionStatusBadge(isConnected: boolean) {
		let circleColor: string = isConnected ? 'rgba(59, 180, 74, 100%)' : 'rgba(208, 46, 0, 100%)';
		let bgColor: string = isConnected ? 'rgba(59, 180, 74, 100%)' : 'rgba(255, 255, 255, 80%)';
		return `position: absolute;
			height: 0.25rem;
			width: 0.25rem;
			top: 12px;
			left: 19px;
			border: 2.4px solid ${circleColor};
			border-radius: 100%;
			background: ${bgColor};
			content:"";
			font-size: 100%;
			line-height: 100%;
			color:white;
			text-align:center;
			vertical-align:middle;`
			.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').replace(/  +/g, ' ');
	}

	private getNewTagBadge(): string {
		return `position: absolute;
			height: 0.4rem;
			width: 0.4rem;
			top: 3px;
			left: 5px;
			border: 1px solid green;
			border-radius: 15%;
			background: green;
			content:"N";
			font-size: 0.3rem;
			font-weight: bold;
			line-height: 0.4rem;
			color: white;
			text-align:center;
			vertical-align:middle;`
			.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').replace(/  +/g, ' ');
	}

	private createBadge(badgeClass: string, badge: string): void {
		if (!this.badgeCreated.has(badgeClass)) {
			createCSSRule(`.${badgeClass}:after`, badge);
			this.badgeCreated.add(badgeClass);
		}
	}

	public addBadge(element: HTMLElement, badgeClass: string): void {
		element.innerHTML = (element.innerHTML || '') +
			`<div class="${badgeClass}" style="width: 0px; height: 0px;"><div>`;
	}

	public removeBadge(element: HTMLElement, badgeClass: string): void {
		let children: HTMLCollection = element.children;
		let current: Element | null = children[0];
		while (current) {
			let next: Element | null = current.nextElementSibling;
			if (current.classList.contains(badgeClass)) {
				current.remove();
				break;
			}
			current = next;
		}
	}
}

export const badgeRenderer: BadgeRenderer = new BadgeRenderer();

interface ThemedIconUri {
	light: URI;
	dark: URI;
}
