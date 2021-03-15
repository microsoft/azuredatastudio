/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentProvider, InitialVariableValues } from '../interfaces';
import { Model } from './model';
import { ResourceTypeWizard } from './resourceTypeWizard';

export abstract class ResourceTypeModel extends Model {

	constructor(public provider: DeploymentProvider, public wizard: ResourceTypeWizard) {
		super();
	}

	abstract initialize(initialParams?: InitialVariableValues): void;
	abstract onOk(): Promise<void>;
	public onCancel(): void { }
	/**
	 * performs the script generation and returns true if script was generated successfully
	 **/
	async onGenerateScript(): Promise<boolean> { return true; }

}
