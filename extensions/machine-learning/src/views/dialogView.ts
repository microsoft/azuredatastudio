/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import { MainViewBase } from './mainViewBase';
import { IPageView } from './interfaces';

/**
 * Dialog view to create and manage a dialog
 */
export class DialogView extends MainViewBase {

	private _dialog: azdata.window.Dialog | undefined;

	/**
	 * Creates new instance
	 */
	constructor(apiWrapper: ApiWrapper) {
		super(apiWrapper);
	}

	private createDialogPage(title: string, componentView: IPageView): azdata.window.DialogTab {
		let viewPanel = this._apiWrapper.createTab(title);
		this.addPage(componentView);
		this.registerContent(viewPanel, componentView);
		return viewPanel;
	}

	/**
	 * Creates a new dialog
	 * @param title title
	 * @param pages pages
	 */
	public createDialog(title: string, pages: IPageView[]): azdata.window.Dialog {
		this._dialog = this._apiWrapper.createModelViewDialog(title);
		this._dialog.content = pages.map(x => this.createDialogPage(x.title || '', x));
		return this._dialog;
	}
}
