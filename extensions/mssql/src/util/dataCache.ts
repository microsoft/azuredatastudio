/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class DataCache {

	millisecondsToLive: number;
	getValueFunction: (...args: any[]) => any;
	cache: any;
	fetchDate: Date;

	constructor(getValueFunction: (...args: any[]) => any, secondsToLive: number) {
		this.millisecondsToLive = secondsToLive * 1000;
		this.getValueFunction = getValueFunction;
		this.cache = null;
		this.fetchDate = new Date(0);
	}

	public isCacheExpired() {
		return (this.fetchDate.getTime() + this.millisecondsToLive) < new Date().getTime();
	}

	public getData(...args: any[]) {
		if (!this.cache || this.isCacheExpired()) {
			console.log('expired - fetching new data');
			let data = this.getValueFunction(...args);
			this.cache = data;
			this.fetchDate = new Date();
			return data;
		} else {
			console.log('cache hit');
			return this.cache;
		}
	}

	public resetCache() {
		this.fetchDate = new Date(0);
	}
}
