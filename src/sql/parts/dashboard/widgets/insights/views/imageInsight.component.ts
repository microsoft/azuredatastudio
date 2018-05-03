/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild, OnInit, ElementRef } from '@angular/core';

import { IInsightsView, IInsightData } from 'sql/parts/dashboard/widgets/insights/interfaces';

import { mixin } from 'vs/base/common/objects';

interface IConfig {
	encoding?: string;
	imageFormat?: string;
}

const defaultConfig: IConfig = {
	encoding: 'hex',
	imageFormat: 'jpeg'
};

@Component({
	template: `
		<div *ngIf="hasData" #container style="display: block">
			<img #image src="{{source}}" >
		</div>
	`
})
export default class ImageInsight implements IInsightsView, OnInit {
	private _rawSource: string;
	private _config: IConfig = defaultConfig;

	@ViewChild('image') private image: ElementRef;
	@ViewChild('container') private container: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef) { }

	ngOnInit() {
		let size = Math.min(this.container.nativeElement.parentElement.parentElement.offsetHeight, this.container.nativeElement.parentElement.parentElement.offsetWidth);
		this.image.nativeElement.style.width = size + 'px';
		this.image.nativeElement.style.height = size + 'px';
	}

	@Input() set config(config: { [key: string]: any }) {
		this._config = mixin(config, defaultConfig, false);
		this._changeRef.detectChanges();
	}

	@Input() set data(data: IInsightData) {
		let self = this;
		if (data.rows && data.rows.length > 0 && data.rows[0].length > 0) {
			self._rawSource = data.rows[0][0];
		} else {
			this._rawSource = '';
		}
		this._changeRef.detectChanges();
	}

	public get hasData(): boolean {
		return this._rawSource && this._rawSource !== '';
	}

	public get source(): string {
		let img = this._rawSource;
		if (this._config.encoding === 'hex') {
			img = ImageInsight._hexToBase64(img);
		}
		return `data:image/${this._config.imageFormat};base64,${img}`;
	}

	private static _hexToBase64(hexVal: string) {

		if (hexVal.startsWith('0x')) {
			hexVal = hexVal.slice(2);
		}
		// should be able to be replaced with new Buffer(hexVal, 'hex').toString('base64')
		return btoa(String.fromCharCode.apply(null, hexVal.replace(/\r|\n/g, '').replace(/([\da-fA-F]{2}) ?/g, '0x$1 ').replace(/ +$/, '').split(' ')));
	}
}
