/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export class FakeRadioButton implements azdata.RadioButtonComponent {

	private _onDidClickEmitter = new vscode.EventEmitter<any>();

	onDidClick = this._onDidClickEmitter.event;

	constructor(props: azdata.RadioButtonProperties) {
		this.label = props.label;
		this.value = props.value;
		this.checked = props.checked;
		this.enabled = props.enabled;
	}

	//#region RadioButtonProperties implementation
	label?: string;
	value?: string;
	checked?: boolean;
	//#endregion

	click() {
		this.checked = true;
		this._onDidClickEmitter.fire(this);
	}
	//#region Component Implementation
	id: string = '';
	updateProperties(_properties: { [key: string]: any; }): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	updateProperty(_key: string, _value: any): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	updateCssStyles(_cssStyles: { [key: string]: string; }): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	onValidityChanged: vscode.Event<boolean> = <vscode.Event<boolean>>{};
	valid: boolean = false;
	validate(): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}
	focus(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	ariaHidden?: boolean | undefined;
	//#endregion

	//#region ComponentProperties Implementation
	height?: number | string;
	width?: number | string;
	/**
	 * The position CSS property. Empty by default.
	 * This is particularly useful if laying out components inside a FlexContainer and
	 * the size of the component is meant to be a fixed size. In this case the position must be
	 * set to 'absolute', with the parent FlexContainer having 'relative' position.
	 * Without this the component will fail to correctly size itself
	 */
	position?: azdata.PositionType;
	/**
	 * Whether the component is enabled in the DOM
	 */
	enabled?: boolean;
	/**
	 * Corresponds to the display CSS property for the element
	 */
	display?: azdata.DisplayType;
	/**
	 * Corresponds to the aria-label accessibility attribute for this component
	 */
	ariaLabel?: string;
	/**
	 * Corresponds to the role accessibility attribute for this component
	 */
	ariaRole?: string;
	/**
	 * Corresponds to the aria-selected accessibility attribute for this component
	 */
	ariaSelected?: boolean;
	/**
	 * Matches the CSS style key and its available values.
	 */
	CSSStyles?: { [key: string]: string };
	//#endregion

}
