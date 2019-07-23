/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/queryHistoryPanel';
import { Dimension } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { QueryHistoryView } from 'sql/workbench/parts/queryHistory/browser/queryHistoryView';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { Panel } from 'vs/workbench/browser/panel';
import { QUERY_HISTORY_PANEL_ID } from 'sql/workbench/parts/queryHistory/common/constants';

export class QueryHistoryPanel extends Panel {

	private _queryHistoryView: QueryHistoryView;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(QUERY_HISTORY_PANEL_ID, telemetryService, themeService, storageService);
	}

	public create(parent: HTMLElement): void {
		super.create(parent);
		this._queryHistoryView = this.instantiationService.createInstance(QueryHistoryView);
		this._queryHistoryView.renderBody(parent);
	}

	public setVisible(visible: boolean): void {
		super.setVisible(visible);
		this._queryHistoryView.setVisible(visible);
	}

	public layout({ height }: Dimension): void {
		this._queryHistoryView.layout(height);
	}
}
