/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { InsightsDialogView } from 'sql/workbench/services/insights/browser/insightsDialogView';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IInsightsDialogModel, IInsightsDialogService } from 'sql/workbench/services/insights/browser/insightsDialogService';
import { InsightsDialogModel } from 'sql/workbench/services/insights/browser/insightsDialogModel';
import { IInsightsConfig } from 'sql/platform/dashboard/browser/insightRegistry';
import { InsightsDialogController } from 'sql/workbench/services/insights/browser/insightsDialogController';

export class InsightsDialogService implements IInsightsDialogService {
	_serviceBrand: undefined;
	private _insightsDialogController: InsightsDialogController;
	private _insightsDialogView: InsightsDialogView;
	private _insightsDialogModel: IInsightsDialogModel;

	constructor(@IInstantiationService private _instantiationService: IInstantiationService) { }

	// query string
	public async show(input: IInsightsConfig, connectionProfile: IConnectionProfile): Promise<void> {
		if (!this._insightsDialogView) {
			this._insightsDialogModel = new InsightsDialogModel();
			this._insightsDialogController = this._instantiationService.createInstance(InsightsDialogController, this._insightsDialogModel);
			this._insightsDialogView = this._instantiationService.createInstance(InsightsDialogView, this._insightsDialogModel);
			this._insightsDialogView.render();
		} else {
			this._insightsDialogModel.reset();
			this._insightsDialogView.reset();
		}

		this._insightsDialogModel.insight = input.details;
		await this._insightsDialogController.update(input.details, connectionProfile);
		this._insightsDialogView.open(input.details, connectionProfile);
	}

	public close(): void {
		this._insightsDialogView.close();
	}
}
