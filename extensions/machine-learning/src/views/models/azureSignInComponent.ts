/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, SignInToAzureEventName } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import * as constants from '../../common/constants';

/**
 * View to render filters to pick an azure resource
 */
const componentWidth = 300;
export class AzureSignInComponent extends ModelViewBase {

	private _form: azdata.FormContainer;
	private _signInButton: azdata.ButtonComponent;

	/**
	 * Creates a new view
	 */
	constructor(apiWrapper: ApiWrapper, private _modelBuilder: azdata.ModelBuilder, parent: ModelViewBase) {
		super(apiWrapper, parent.root, parent);
		this._signInButton = this._modelBuilder.button().withProperties({
			width: componentWidth,
			label: constants.azureSignIn,
		}).component();
		this._signInButton.onDidClick(() => {
			this.sendRequest(SignInToAzureEventName);
		});

		this._form = this._modelBuilder.formContainer().withFormItems([{
			title: constants.azureAccount,
			component: this._signInButton
		}]).component();
	}

	public addComponents(formBuilder: azdata.FormBuilder) {
		if (this._signInButton) {
			formBuilder.addFormItems([{
				title: constants.azureAccount,
				component: this._signInButton
			}]);
		}
	}

	public removeComponents(formBuilder: azdata.FormBuilder) {
		if (this._signInButton) {
			formBuilder.removeFormItem({
				title: constants.azureAccount,
				component: this._signInButton
			});
		}
	}

	/**
	 * Returns the created component
	 */
	public get component(): azdata.Component {
		return this._form;
	}

	/**
	 * refreshes the view
	 */
	public async refresh(): Promise<void> {
	}
}
