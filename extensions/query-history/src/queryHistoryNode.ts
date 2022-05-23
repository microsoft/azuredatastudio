/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Query history node
 */
export class QueryHistoryNode extends vscode.TreeItem {
	private readonly iconsPath: string = path.join(__dirname, 'icons');
	private readonly successIcon: string = path.join(this.iconsPath, 'status_success.svg');
	private readonly failureIcon: string = path.join(this.iconsPath, 'status_error.svg');
	private _ownerUri: string;
	private _timeStamp: Date;
	private _isSuccess: boolean;
	private _queryString: string;
	private _connectionLabel: string;

	constructor(
		label: string,
		tooltip: string,
		queryString: string,
		ownerUri: string,
		timeStamp: Date,
		connectionLabel: string,
		isSuccess: boolean
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this._queryString = queryString;
		this._ownerUri = ownerUri;
		this._timeStamp = timeStamp;
		this._isSuccess = isSuccess;
		this._connectionLabel = connectionLabel;
		this.iconPath = this._isSuccess ? this.successIcon : this.failureIcon;
		this.tooltip = tooltip;
	}

	/** Getters */
	public get historyNodeLabel(): string {
		const label = typeof this.label === 'string' ? this.label : this.label!.label;
		return label;
	}

	public get ownerUri(): string {
		return this._ownerUri;
	}

	public get timeStamp(): Date {
		return this._timeStamp;
	}

	public get queryString(): string {
		return this._queryString;
	}

	public get connectionLabel(): string {
		return this._connectionLabel;
	}
}
