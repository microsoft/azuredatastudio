/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class WizardPageInfo {
	public get pageCount(): number {
		return this._pageCount;
	}

	public get currentPageId(): number {
		return this._currentPageId;
	}

	public get isFirstPage(): boolean {
		return this._currentPageId === 0;
	}

	public get isLastPage(): boolean {
		return this._currentPageId === this._pageCount - 1;
	}

	constructor(private _currentPageId: number, private _pageCount: number) {
	}

}
