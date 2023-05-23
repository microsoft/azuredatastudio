/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';
import { IObjectManagementService, ObjectManagement } from 'mssql';
import * as localizedConstants from '../localizedConstants';
import { AlterUserDocUrl, CreateUserDocUrl } from '../constants';
// extends ObjectManagementDialogBase<ObjectManagement.ServerInfo, ObjectManagement.ServerViewInfo>
export class ServerPropertiesDialog {
	private generalSection: azdata.GroupContainer;

	constructor() {

	}
	// private memorySection: azdata.GroupContainer;
	// private processorsSection: azdata.GroupContainer;
	// private securitySection: azdata.GroupContainer;
	// // private databaseSettingsSection: azdata.GroupContainer;
	// private advancedSection: azdata.GroupContainer;
	// // General Section
	// private nameInput: azdata.InputBoxComponent;
	// private languageInput: azdata.InputBoxComponent;
	// private memoryInput: azdata.InputBoxComponent;
	// private operatingSystemInput: azdata.InputBoxComponent;
	// // private platformInput: azdata.InputBoxComponent;
	// // private processorsInput: azdata.InputBoxComponent;


	// constructor(objectManagementService: IObjectManagementService, options: ObjectManagementDialogOptions) {
	// 	super(objectManagementService, options);
	// }

	// protected override get helpUrl(): string {
	// 	return this.options.isNewObject ? CreateUserDocUrl : AlterUserDocUrl;
	// }

	// protected override async validateInput(): Promise<string[]> {
	// 	const errors = await super.validateInput();
	// 	return errors;
	// }

	// protected async initializeUI(): Promise<void> {
	// 	this.initializeGeneralSection();
	// 	this.initializeMemorySection();
	// 	this.initializeProcessorsSection();
	// 	this.initializeSecuritySection();
	// 	this.initializeAdvancedSection();
	// 	this.formContainer.addItems([this.generalSection, this.memorySection, this.processorsSection, this.securitySection, this.advancedSection]);
	// }

	// private initializeGeneralSection(): void {
	// 	this.nameInput = this.createInputBox(localizedConstants.NameText, async (newValue) => {
	// 		this.objectInfo.name = newValue;
	// 	}, this.objectInfo.name, this.options.isNewObject);
	// 	const nameContainer = this.createLabelInputContainer(localizedConstants.NameText, this.nameInput);

	// 	this.languageInput = this.createInputBox('Language', async (newValue) => {
	// 		this.objectInfo.name = newValue;
	// 	}, this.objectInfo.name, this.options.isNewObject);
	// 	const languageContainer = this.createLabelInputContainer('Language', this.languageInput);

	// 	this.memoryInput = this.createInputBox('Memory', async (newValue) => {
	// 		this.objectInfo.name = newValue;
	// 	}, this.objectInfo.name, this.options.isNewObject);
	// 	const memoryContainer = this.createLabelInputContainer('Memory', this.memoryInput);

	// 	this.operatingSystemInput = this.createInputBox('Operating System', async (newValue) => {
	// 		this.objectInfo.name = newValue;
	// 	}, this.objectInfo.name, this.options.isNewObject);
	// 	const operatingSystemContainer = this.createLabelInputContainer('Operating System', this.operatingSystemInput);

	// 	this.generalSection = this.createGroup(localizedConstants.GeneralSectionHeader, [
	// 		nameContainer,
	// 		languageContainer,
	// 		memoryContainer,
	// 		operatingSystemContainer
	// 	], false);
	// }

	// private initializeMemorySection(): void {
	// }

	// private initializeProcessorsSection(): void {
	// }

	// private initializeSecuritySection(): void {
	// }

	// private initializeAdvancedSection(): void {
	// }

}
