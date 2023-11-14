/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionDetailsPage } from "./connectionDetailsPage";
import { CreateMasterKeyPage } from "./createMasterKeyPage";
import { IWizardPageWrapper } from "../wizardPageWrapper";
import { ObjectMappingPage } from "./objectMappingPage";
import { SelectDataSourcePage } from "./selectDataSourcePage";
import { VirtualizeDataModel } from "./virtualizeDataModel";
import { VirtualizeDataInput } from "../../services/contracts";

export class VDIManager {
	private _selectDataSourcePage: IWizardPageWrapper;
	private _createMasterKeyPage: IWizardPageWrapper;
	private _connectionDetailsPage: IWizardPageWrapper;
	private _objectMappingPage: IWizardPageWrapper;
	private _pages: IWizardPageWrapper[];

	private _virtualizeDataModel: VirtualizeDataModel;
	private _propertyLookUp: Map<string, IWizardPageWrapper> = new Map<string, IWizardPageWrapper>();

	public setInputPages(inputPages: IWizardPageWrapper[]): void {
		if (inputPages && inputPages.length > 0) {
			this._pages = inputPages;
			this.setInputPagesInOrder();
			this.setPropertyLookUp();
		}
	}

	private setInputPagesInOrder(): void {
		this._selectDataSourcePage = this.getSelectDataSourcePage();
		this._createMasterKeyPage = this.getCreateMasterKeyPage();
		this._connectionDetailsPage = this.getConnectionDetailsPage();
		this._objectMappingPage = this.getObjectMappingPage();
		let inputPages: IWizardPageWrapper[] = [];
		[
			this._selectDataSourcePage,
			this._createMasterKeyPage,
			this._connectionDetailsPage,
			this._objectMappingPage
		].forEach(e => {
			if (e) { inputPages.push(e); }
		});
		this._pages = inputPages;
	}

	private setPropertyLookUp(): void {
		if (this._pages && this._pages.length > 0) {
			this._pages.forEach(page => {
				if (page instanceof SelectDataSourcePage) {
					this._propertyLookUp.set('destDatabaseName', page);
					this._propertyLookUp.set('sourceServerType', page);
				} else if (page instanceof CreateMasterKeyPage) {
					this._propertyLookUp.set('destDbMasterKeyPwd', page);
				} else if (page instanceof ConnectionDetailsPage) {
					this._propertyLookUp.set('existingCredentialName', page);
					this._propertyLookUp.set('newCredentialName', page);
					this._propertyLookUp.set('sourceUsername', page);
					this._propertyLookUp.set('sourcePassword', page);
					this._propertyLookUp.set('existingDataSourceName', page);
					this._propertyLookUp.set('newDataSourceName', page);
					this._propertyLookUp.set('sourceServerName', page);
					this._propertyLookUp.set('sourceDatabaseName', page);
				} else if (page instanceof ObjectMappingPage) {
					this._propertyLookUp.set('externalTableInfoList', page);
				}
				// No inputs set from SummaryPage
			});
		}
	}

	public setVirtualizeDataModel(virtualizeDataModel: VirtualizeDataModel): void {
		this._virtualizeDataModel = virtualizeDataModel;
	}

	public getVirtualizeDataInput(upToPage?: IWizardPageWrapper): VirtualizeDataInput {
		let virtualizeDataInput: VirtualizeDataInput = VDIManager.getEmptyInputInstance();
		if (this._virtualizeDataModel && this._virtualizeDataModel.configInfoResponse) {
			virtualizeDataInput.sessionId = this._virtualizeDataModel.configInfoResponse.sessionId;
		}
		for (let page of this._pages) {
			if (page) {
				page.getInputValues(virtualizeDataInput);
				if (upToPage && page === upToPage) { break; }
			}
		}
		return virtualizeDataInput;
	}

	public get virtualizeDataInput(): VirtualizeDataInput {
		return this.getVirtualizeDataInput();
	}

	public getPropertyValue(property: string): any {
		let propertyValue: any = undefined;
		if (property && this._propertyLookUp.has(property)) {
			let pageInput = VDIManager.getEmptyInputInstance();
			this._propertyLookUp.get(property).getInputValues(pageInput);
			if (pageInput) {
				propertyValue = pageInput[property];
			}
		}
		return propertyValue;
	}

	public get dataSourceName(): string {
		return this.existingDataSourceName || this.newDataSourceName;
	}

	public get existingDataSourceName(): string {
		return this.getPropertyValue('existingDataSourceName');
	}

	public get newDataSourceName(): string {
		return this.getPropertyValue('newDataSourceName');
	}

	public get sourceServerName(): string {
		return this.getPropertyValue('sourceServerName');
	}

	public get sourceDatabaseName(): string {
		return this.getPropertyValue('sourceDatabaseName');
	}

	public get destinationDatabaseName(): string {
		return this.getPropertyValue('destDatabaseName');
	}

	public get sourceServerType(): string {
		return this.getPropertyValue('sourceServerType');
	}

	public get externalTableInfoList(): string {
		return this.getPropertyValue('externalTableInfoList');
	}

	public get destDbMasterKeyPwd(): string {
		return this.getPropertyValue('destDbMasterKeyPwd');
	}

	public get inputUptoConnectionDetailsPage(): VirtualizeDataInput {
		let inputValues: VirtualizeDataInput = undefined;
		if (this._connectionDetailsPage) {
			inputValues = this.getVirtualizeDataInput(this._connectionDetailsPage);
		}
		return inputValues;
	}

	private getSelectDataSourcePage(): IWizardPageWrapper {
		return this._pages.find(page => page instanceof SelectDataSourcePage);
	}

	private getCreateMasterKeyPage(): IWizardPageWrapper {
		return this._pages.find(page => page instanceof CreateMasterKeyPage);
	}

	private getConnectionDetailsPage(): IWizardPageWrapper {
		return this._pages.find(page => page instanceof ConnectionDetailsPage);
	}

	private getObjectMappingPage(): IWizardPageWrapper {
		return this._pages.find(page => page instanceof ObjectMappingPage);
	}

	public static getEmptyInputInstance(): VirtualizeDataInput {
		return <VirtualizeDataInput>{};
	}
}
