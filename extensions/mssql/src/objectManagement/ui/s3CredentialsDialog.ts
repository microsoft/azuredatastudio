/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as localizedConstants from '../localizedConstants';
import { DialogBase } from '../../ui/dialogBase';

export interface S3CredentialsDialogResult {
	s3Url: vscode.Uri;
	secretKey: string;
	accessKey: string;
}

export class S3CredentialsDialog extends DialogBase<S3CredentialsDialogResult> {
	private s3UrlInputBox: azdata.InputBoxComponent;
	private secretKeyInputBox: azdata.InputBoxComponent;
	private accessKeyInputBox: azdata.InputBoxComponent;
	private result: S3CredentialsDialogResult;

	constructor() {
		super(localizedConstants.AddS3CredentialsDialogTitle, localizedConstants.AddS3CredentialsDialogTitle);
		this.result = {
			s3Url: undefined,
			secretKey: undefined,
			accessKey: undefined
		};

		// Relabel Cancel button to Back, since clicking cancel on an inner dialog makes it seem like it would close the whole dialog overall
		this.dialogObject.cancelButton.label = localizedConstants.BackButtonLabel;
	}

	protected async initialize(): Promise<void> {
		this.s3UrlInputBox = this.createInputBox(async (value) => {
			this.result.s3Url = vscode.Uri.parse(value);
		}, {
			ariaLabel: localizedConstants.NameText,
			inputType: 'text',
			placeHolder: "s3://endpoint:port/bucketName/filePath.bak"
		});
		const s3UrlContainer = this.createLabelInputContainer(localizedConstants.S3UrlLabel, this.s3UrlInputBox, true);

		this.secretKeyInputBox = this.createInputBox(async (value) => {
			this.result.secretKey = value;
		}, {
			ariaLabel: localizedConstants.NameText,
			inputType: 'password',
		});
		const secretKeyContainer = this.createLabelInputContainer(localizedConstants.SecretKeyText, this.secretKeyInputBox, true);

		this.accessKeyInputBox = this.createInputBox(async (value) => {
			this.result.accessKey = value;
		}, {
			ariaLabel: localizedConstants.NameText,
			inputType: 'password',
		});
		const accessKeyContainer = this.createLabelInputContainer(localizedConstants.AccessKeyText, this.accessKeyInputBox, true);
		this.formContainer.addItems([s3UrlContainer, secretKeyContainer, accessKeyContainer]);
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		if (this.result.s3Url.scheme !== 's3') {
			errors.push(localizedConstants.InvalidS3UrlError);
		}
		return errors;
	}

	public override get dialogResult(): S3CredentialsDialogResult | undefined {
		return this.result;
	}
}
