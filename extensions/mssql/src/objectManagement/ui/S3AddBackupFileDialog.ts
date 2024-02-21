/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as localizedConstants from '../localizedConstants';
import { DefaultInputWidth, DialogBase } from '../../ui/dialogBase';
import * as awsClient from '@aws-sdk/client-s3';
import { IObjectManagementService } from 'mssql';

export interface S3AddBackupFileDialogResult {
	s3Url: vscode.Uri;
	secretKey: string;
	accessKey: string;
	backupFilePath: string;
}

export class S3AddBackupFileDialog extends DialogBase<S3AddBackupFileDialogResult> {
	private s3UrlInputBox: azdata.InputBoxComponent;
	private secretKeyInputBox: azdata.InputBoxComponent;
	private accessKeyInputBox: azdata.InputBoxComponent;
	private credentialButton: azdata.ButtonComponent;
	private regionInputBox: azdata.InputBoxComponent;
	private bucketDropdown: azdata.DropDownComponent;
	private backupFilesDropdown: azdata.DropDownComponent;
	private result: S3AddBackupFileDialogResult;
	private objectManagementService: IObjectManagementService;
	private credentialInfo: azdata.CredentialInfo;
	private connectionUri: string;
	private s3Client: awsClient.S3Client;

	constructor(objectManagementService: IObjectManagementService, connectionUri: string) {
		super(localizedConstants.SelectS3BackupFileDialogTitle, localizedConstants.SelectS3BackupFileDialogTitle);
		this.result = {
			s3Url: undefined,
			secretKey: undefined,
			accessKey: undefined,
			backupFilePath: undefined
		};

		// Relabel Cancel button to Back, since clicking cancel on an inner dialog makes it seem like it would close the whole dialog overall
		this.dialogObject.cancelButton.label = localizedConstants.BackButtonLabel;
		this.dialogObject.okButton.label = localizedConstants.AddButton;
		this.dialogObject.okButton.enabled = false;

		this.objectManagementService = objectManagementService;
		this.connectionUri = connectionUri;

		this.dialogObject.okButton.onClick(async () => {
			// s3 objects can contain special characters that may cause issues with http request
			this.result.backupFilePath = encodeURI(`s3://${this.bucketDropdown.value}.s3.${this.regionInputBox.value}.amazonaws.com/${this.backupFilesDropdown.value}`);
			this.credentialInfo = {
				secret: `${this.result.accessKey}:${this.result.secretKey}`,
				identity: 'S3 Access Key',
				name: this.result.backupFilePath,
				createDate: undefined,
				dateLastModified: undefined,
				providerName: 'MSSQL',
				id: undefined
			}
			await this.objectManagementService.createCredential(this.connectionUri, this.credentialInfo);
		});
	}

	protected async initialize(): Promise<void> {
		this.s3UrlInputBox = this.createInputBox(async (value) => {
			this.result.s3Url = vscode.Uri.parse(value);
			this.regionInputBox.value = this.result.s3Url.toString().split(".")[1];
			this.enableCredentialButton();
		}, {
			ariaLabel: localizedConstants.RegionSpecificEndpointText,
			inputType: 'text',
			placeHolder: 'https://s3.{region}.{server}.com'
		});
		const s3UrlContainer = this.createLabelInputContainer(localizedConstants.RegionSpecificEndpointText, this.s3UrlInputBox, true);

		this.secretKeyInputBox = this.createInputBox(async (value) => {
			this.result.secretKey = value;
			this.enableCredentialButton();
		}, {
			ariaLabel: localizedConstants.SecretKeyText,
			inputType: 'password',
		});
		const secretKeyContainer = this.createLabelInputContainer(localizedConstants.SecretKeyText, this.secretKeyInputBox, true);

		this.accessKeyInputBox = this.createInputBox(async (value) => {
			this.result.accessKey = value;
			this.enableCredentialButton();
		}, {
			ariaLabel: localizedConstants.AccessKeyText,
			inputType: 'password',
		});
		const accessKeyContainer = this.createLabelInputContainer(localizedConstants.AccessKeyText, this.accessKeyInputBox, true);

		this.credentialButton = this.createButton(localizedConstants.AddCredentialsText, localizedConstants.AddCredentialsText, async () => {
			this.createS3Client();
			await this.setBucketDropdown();
		}, false, DefaultInputWidth);
		const credentialButtonContainer = this.createLabelInputContainer(' ', this.credentialButton);

		this.regionInputBox = this.createInputBox(async () => { }, {
			ariaLabel: localizedConstants.RegionText,
			inputType: 'text',
			enabled: false
		});
		const regionInputContainer = this.createLabelInputContainer(localizedConstants.RegionText, this.regionInputBox, true);

		this.bucketDropdown = this.createDropdown(localizedConstants.SelectS3BucketText, async (newValue) => {
			await this.setBackupFilesDropdown(newValue);
		}, [], '', false);
		const bucketContainer = this.createLabelInputContainer(localizedConstants.SelectS3BucketText, this.bucketDropdown, true);

		this.backupFilesDropdown = this.createDropdown(localizedConstants.SelectBackupFileText, async () => {
			// enable ok button once we have a backup file to restore
			this.dialogObject.okButton.enabled = true;
		}, [], '', false);
		const backupFilesContainer = this.createLabelInputContainer(localizedConstants.SelectBackupFileText, this.backupFilesDropdown, true);

		this.formContainer.addItems([s3UrlContainer, secretKeyContainer, accessKeyContainer, credentialButtonContainer, regionInputContainer, bucketContainer, backupFilesContainer]);
	}

	protected override async validateInput(): Promise<string[]> {
		const errors = await super.validateInput();
		if (this.result.s3Url && !this.result.s3Url.toString().includes('s3') && (this.result.s3Url.scheme !== 'http' && this.result.s3Url.scheme !== 'https')) {
			errors.push(localizedConstants.InvalidS3UrlError);
		}
		return errors;
	}

	private createS3Client(): void {
		this.s3Client = new awsClient.S3Client({
			forcePathStyle: true,
			region: this.regionInputBox.value,
			endpoint: encodeURI(this.result.s3Url.toString()),
			credentials: {
				accessKeyId: this.dialogResult.accessKey,
				secretAccessKey: this.dialogResult.secretKey
			}
		});
	}

	private async getBucketList(): Promise<string[]> {
		let command = new awsClient.ListBucketsCommand({});
		let response = await this.s3Client.send(command);
		return response.Buckets.map(r => r.Name);
	}
	/**
	 * Gets a list of all the backup files in S3 storage bucket
	 */
	private async getBackupFiles(bucket: string): Promise<string[]> {
		const input: awsClient.ListObjectVersionsCommandInput = {
			Bucket: bucket
		};
		let command = new awsClient.ListObjectsV2Command(input);
		let response = await this.s3Client.send(command);
		return response.Contents.filter(r => r.Key.endsWith('.bak')).map(r => r.Key);
	}

	private async setBackupFilesDropdown(bucket: string): Promise<void> {
		this.backupFilesDropdown.values = await this.getBackupFiles(bucket);
		this.backupFilesDropdown.enabled = true;
	}

	private async setBucketDropdown(): Promise<void> {
		this.bucketDropdown.values = await this.getBucketList();
		this.bucketDropdown.enabled = true;
	}

	private enableCredentialButton(): void {
		this.credentialButton.enabled = (this.result.s3Url && this.result.accessKey && this.result.secretKey) !== undefined;
	}

	public override get dialogResult(): S3AddBackupFileDialogResult | undefined {
		return this.result;
	}
}
