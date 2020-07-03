/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export class TestComponent implements azdata.Component {

	private _onValidityChanged = new vscode.EventEmitter<boolean>();
	private _properties: { [key: string]: any } = {};

	///############################
	// # Component Implementation #
	// ############################

	public readonly id!: string;
	public async updateProperties(properties: { [key: string]: any }): Promise<void> {
		this._properties = properties;
	}
	public async updateProperty(key: string, value: any): Promise<void> {
		this._properties[key] = value;
	}
	public async updateCssStyles(_cssStyles: { [key: string]: string }): Promise<void> { }
	public readonly onValidityChanged: vscode.Event<boolean> = this._onValidityChanged.event;
	public readonly valid!: boolean;
	public async validate(): Promise<boolean> { return true; }
	public async focus(): Promise<void> { }
}
