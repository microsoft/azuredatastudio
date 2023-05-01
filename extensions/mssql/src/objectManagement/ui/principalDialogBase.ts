/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from 'mssql';
import * as localizedConstants from '../localizedConstants';

import { ObjectManagementDialogBase, ObjectManagementDialogOptions } from './objectManagementDialogBase';


export abstract class PrincipalDialogBase<ObjectInfoType extends mssql.ObjectManagement.SqlObject, ViewInfoType extends mssql.ObjectManagement.ObjectViewInfo<ObjectInfoType>> extends ObjectManagementDialogBase<ObjectInfoType, ViewInfoType> {
	protected securableTable: azdata.TableComponent;
	protected permissionTable: azdata.TableComponent;
	protected addSecurableButton: azdata.ButtonComponent;
	protected securableSection: azdata.GroupContainer;
	protected permissionTableLabel = azdata.TextComponent;

	constructor(objectManagementService: mssql.IObjectManagementService,
		options: ObjectManagementDialogOptions) {
		super(objectManagementService, options);
	}

}
