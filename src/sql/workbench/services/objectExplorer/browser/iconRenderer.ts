/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createCSSRule, asCSSUrl } from 'vs/base/browser/dom';
import { hash } from 'vs/base/common/hash';
import { URI } from 'vs/base/common/uri';

class IconRenderer {
	private iconRegistered: Set<string> = new Set<string>();

	public registerIcon(path: URI | IconPath): string {
		if (!path) { return undefined; }
		let iconPath: IconPath = this.toIconPath(path);
		let iconUid: string = this.getIconUid(iconPath);
		if (!this.iconRegistered.has(iconUid)) {
			createCSSRule(`.icon#${iconUid}`, `background: ${asCSSUrl(iconPath.light || iconPath.dark)} center center no-repeat`);
			createCSSRule(`.vs-dark .icon#${iconUid}, .hc-black .icon#${iconUid}`, `background: ${asCSSUrl(iconPath.dark)} center center no-repeat`);
			this.iconRegistered.add(iconUid);
		}
		return iconUid;
	}

	public getIconUid(path: URI | IconPath): string {
		if (!path) { return undefined; }
		let iconPath: IconPath = this.toIconPath(path);
		return `icon${hash(iconPath.light.toString() + iconPath.dark.toString())}`;
	}

	private toIconPath(path: URI | IconPath): IconPath {
		if (path['light']) {
			return path as IconPath;
		} else {
			let singlePath = path as URI;
			return { light: singlePath, dark: singlePath };
		}
	}

	public putIcon(element: HTMLElement, path: URI | IconPath): void {
		if (!element || !path) { return undefined; }
		let iconUid: string = this.registerIcon(path);
		element.id = iconUid;
	}

	public removeIcon(element: HTMLElement): void {
		if (!element) { return undefined; }
		element.id = undefined;
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
			top: 14px;
			left: 19px;
			border: 0.12rem solid ${circleColor};
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
		let current = children[0];
		while (current) {
			let next = current.nextElementSibling;
			if (current.classList.contains(badgeClass)) {
				current.remove();
				break;
			}
			current = next;
		}
	}
}

export const badgeRenderer: BadgeRenderer = new BadgeRenderer();

interface IconPath {
	light: URI;
	dark: URI;
}
