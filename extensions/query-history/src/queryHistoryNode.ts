/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Query history node
 */
export class QueryHistoryNode extends vscode.TreeItem {
	private _connectionId: string;
	private _timeStamp: Date;
	private _isSuccess: boolean;
	private _queryString: string;
	private _connectionLabel: string;

	constructor(
		label: string,
		tooltip: string,
		queryString: string,
		connectionId: string,
		timeStamp: Date,
		connectionLabel: string,
		isSuccess: boolean
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this._queryString = queryString;
		this._connectionId = connectionId;
		this._timeStamp = timeStamp;
		this._isSuccess = isSuccess;
		this._connectionLabel = connectionLabel;
		this.iconPath = this._isSuccess ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed')) : new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
		this.tooltip = tooltip;
		this.description = timeStamp.toLocaleString();
	}

	/** Getters */
	public get historyNodeLabel(): string {
		const label = typeof this.label === 'string' ? this.label : this.label!.label;
		return label;
	}

	public get connectionId(): string {
		return this._connectionId;
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
