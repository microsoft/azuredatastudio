/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ElementRef, Component, Inject, forwardRef } from '@angular/core';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { IDashboardComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';

export const CREATELOGIN_SELECTOR: string = 'createlogin-component';

@Component({
	selector: CREATELOGIN_SELECTOR,
	templateUrl: decodeURI(require.toUrl('sql/parts/admin/security/createLogin.component.html'))
})
export class CreateLoginComponent {

	public ownerUri: string;

	public connection: ConnectionManagementInfo;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IBootstrapParams) private _params: IDashboardComponentParams
	) {
	}
}
