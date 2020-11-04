/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RemoteBook } from '../book/remoteBook';
import { IRelease, IAsset } from '../book/remoteBookController';

export class RemoteBookDialogModel {
	private _remoteLocation: string;
	private _releases: IRelease[];
	private _assets: IAsset[];
	private _book: RemoteBook;

	constructor() {
	}

	public get remoteLocation(): string {
		return this._remoteLocation;
	}

	public set remoteLocation(location: string) {
		this._remoteLocation = location;
	}

	public get releases(): IRelease[] {
		return this._releases;
	}

	public set releases(newReleases: IRelease[]) {
		this._releases = newReleases;
	}

	public get assets(): IAsset[] {
		return this._assets;
	}

	public set assets(newAssets: IAsset[]) {
		this._assets = newAssets;
	}

	public get remoteBook(): RemoteBook {
		return this._book;
	}

	public set remoteBook(newBook: RemoteBook) {
		this._book = newBook;
	}

}
