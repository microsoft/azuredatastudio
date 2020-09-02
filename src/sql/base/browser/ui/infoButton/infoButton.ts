/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Button as sqlButton } from 'sql/base/browser/ui/button/button';
import * as DOM from 'vs/base/browser/dom';
import { URI } from 'vs/base/common/uri';

let infoElementInner: any = `
<div class="divContainer" style="cursor: pointer; height: 116px; width: 250px;">
	<div style="padding: 10px; border-radius: 5px; border: 1px solid;">
		<div class="flexContainer" role="" style="flex-direction: row; align-items: flex-start; height: 93px; width: 250px;">
			<!-- ICON -->
			<div style="padding-top: 10px; padding-right: 10px;">
				<div id="btnIcon" title="" class="icon" style="background-size: 20px 20px; width: 20px; height: 20px; background-image: url();"></div>
			</div>
			<!-- TEXT -->
			<div style="padding-top: 5px; padding-right: 10px;">
				<div class="flexContainer" role="" style="flex-direction: column; justify-content: space-between; height: 96px; width: 200px;">
					<div style="padding: 0px 0px 5px; width: 200px; margin: 0px; color: rgb(0, 106, 177);">
						<p id="btnTitle" aria-hidden="false" style="font-size: 14px; font-weight: bold; margin: 0px;">title</p>
					</div>
					<div style="padding: 0px 0px 5px; width: 200px; margin: 0px; color: rgb(0, 106, 177);">
						<p id="btnDesc" aria-hidden="false" style="font-size: 13px; margin: 0px;">description</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
`;

export class InfoButton extends sqlButton {
	private _infoElement: HTMLElement;
	public _title: string;
	public _description: string;
	public _iconPath: string | URI;

	constructor(container: HTMLElement, options?: any) {
		super(container, options);

		this._infoElement = document.createElement('div');
		DOM.addClass(this._infoElement, 'wrapper');
		this._infoElement.innerHTML = infoElementInner;

		this.element.appendChild(this._infoElement);
	}

	public set title(value: string) {
		this.element.title = value;
		this._title = value;
	}

	public set description(value: string) {
		this._description = value;
	}

	public set iconPath(value: string | URI) {
		this._iconPath = value;
	}

	public set ariaLabel(value: string) {
		this.element.setAttribute('aria-label', value);
	}

	public setHeight(value: string) {
		this.element.style.height = value;
	}

	public setWidth(value: string) {
		this.element.style.width = value;
	}
}
