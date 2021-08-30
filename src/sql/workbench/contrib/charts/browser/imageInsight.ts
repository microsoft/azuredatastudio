/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsight } from './interfaces';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { $ } from 'vs/base/browser/dom';
import { mixin } from 'vs/base/common/objects';
import { IInsightOptions, InsightType } from 'sql/workbench/contrib/charts/common/interfaces';
import * as nls from 'vs/nls';
import { startsWith } from 'vs/base/common/strings';
import { IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';

export interface IConfig extends IInsightOptions {
	encoding?: string;
	imageFormat?: string;
}

const defaultConfig: IConfig = {
	type: InsightType.Image,
	encoding: 'hex',
	imageFormat: 'jpeg'
};

export class ImageInsight implements IInsight {

	public static readonly types = [InsightType.Image];
	public readonly types = ImageInsight.types;

	private _options: IConfig;

	private imageEle: HTMLImageElement;

	constructor(container: HTMLElement, options: IConfig, @INotificationService private _notificationService: INotificationService) {
		this._options = mixin(options, defaultConfig, false);
		this.imageEle = $('img');
		container.appendChild(this.imageEle);
	}

	public layout() {

	}

	public dispose() {

	}

	set options(config: IConfig) {
		this._options = mixin(config, defaultConfig, false);
	}

	get options(): IConfig {
		return this._options;
	}

	set data(data: IInsightData) {
		const that = this;
		if (data.rows && data.rows.length > 0 && data.rows[0].length > 0) {
			let img = data.rows[0][0];
			if (this._options.encoding === 'hex') {
				img = ImageInsight._hexToBase64(img);
			}
			this.imageEle.onerror = function () {
				this.src = require.toUrl(`./media/images/invalidImage.png`);
				that._notificationService.error(nls.localize('invalidImage', "Table does not contain a valid image"));
			};
			this.imageEle.src = `data:image/${this._options.imageFormat};base64,${img}`;
		}
	}

	private static _hexToBase64(hexVal: string) {

		if (startsWith(hexVal, '0x')) {
			hexVal = hexVal.slice(2);
		}
		// should be able to be replaced with new Buffer(hexVal, 'hex').toString('base64')
		return btoa(String.fromCharCode.apply(null, hexVal.replace(/\r|\n/g, '').replace(/([\da-fA-F]{2}) ?/g, '0x$1 ').replace(/ +$/, '').split(' ').map(v => Number(v))));
	}
}
