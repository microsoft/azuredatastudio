/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsight, IInsightData } from './interfaces';

import { $ } from 'vs/base/browser/dom';
import { mixin } from 'vs/base/common/objects';
import { IInsightOptions, InsightType } from 'sql/workbench/parts/charts/common/interfaces';
import { outputChannelName } from 'sql/platform/connection/common/constants';

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

	constructor(container: HTMLElement, options: IConfig) {
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
		if (data.rows && data.rows.length > 0 && data.rows[0].length > 0) {
			let img = data.rows[0][0];
			if (this._options.encoding === 'hex') {
				img = ImageInsight._hexToBase64(img);
			}

			//this.imageEle.src = `data:image/${this._options.imageFormat};base64,${img}`;
			//Code below creates a placeholder image.
			this.imageEle.src = `data:image/${this._options.imageFormat};base64,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`;
		}
	}

	private static _hexToBase64(hexVal: string) {

		if (hexVal.startsWith('0x')) {
			hexVal = hexVal.slice(2);
		}
		// should be able to be replaced with new Buffer(hexVal, 'hex').toString('base64')
		return btoa(String.fromCharCode.apply(null, hexVal.replace(/\r|\n/g, '').replace(/([\da-fA-F]{2}) ?/g, '0x$1 ').replace(/ +$/, '').split(' ').map(v => Number(v))));
	}
}
