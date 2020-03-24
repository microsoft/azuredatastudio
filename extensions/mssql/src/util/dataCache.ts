/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class DataItemCache<T> {

	millisecondsToLive: number;
	getValueFunction: (...args: any[]) => Promise<T>;
	cachedItem: T;
	fetchDate: Date;

	constructor(getValueFunction: (...args: any[]) => Promise<T>, secondsToLive: number) {
		this.millisecondsToLive = secondsToLive * 1000;
		this.getValueFunction = getValueFunction;
		this.cachedItem = undefined;
		this.fetchDate = new Date(0);
	}

	public isCacheExpired(): boolean {
		return (this.fetchDate.getTime() + this.millisecondsToLive) < new Date().getTime();
	}

	public async getData(...args: any[]): Promise<T> {
		if (!this.cachedItem || this.isCacheExpired()) {
			let data = await this.getValueFunction(...args);
			this.cachedItem = data;
			this.fetchDate = new Date();
			return data;
		}
		return this.cachedItem;
	}

	public resetCache(): void {
		this.fetchDate = new Date(0);
	}
}
