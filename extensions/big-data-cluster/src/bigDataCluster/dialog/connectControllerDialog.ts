/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { HdfsDialogBase, HdfsDialogModelBase, HdfsDialogProperties } from './hdfsDialogBase';
import { ClusterController } from '../controller/clusterControllerApi';
import * as loc from '../localizedConstants';


export class ConnectControllerDialog extends HdfsDialogBase<HdfsDialogProperties, ClusterController> {
	constructor(model: ConnectControllerModel) {
		super(loc.connectToController, model);
	}

	protected getMainSectionComponents(): (azdata.FormComponentGroup | azdata.FormComponent)[] {
		return [];
	}

	protected async validate(): Promise<{ validated: boolean, value?: ClusterController }> {
		try {
			const controller = await this.model.onComplete({
				url: this.urlInputBox && this.urlInputBox.value,
				auth: this.authValue,
				username: this.usernameInputBox && this.usernameInputBox.value,
				password: this.passwordInputBox && this.passwordInputBox.value
			});
			return { validated: true, value: controller };
		} catch (error) {
			await this.reportError(error);
			return { validated: false, value: undefined };
		}
	}
}

export class ConnectControllerModel extends HdfsDialogModelBase<HdfsDialogProperties, ClusterController> {

	constructor(props: HdfsDialogProperties) {
		super(props);
	}

	protected async handleCompleted(): Promise<ClusterController> {
		this.throwIfMissingUsernamePassword();

		// We pre-fetch the endpoints here to verify that the information entered is correct (the user is able to connect)
		return await this.createAndVerifyControllerConnection();
	}
}
