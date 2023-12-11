/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { TableDesignerProvider, ITableDesignerService } from 'sql/workbench/services/tableDesigner/common/interface';
import { invalidProvider } from 'sql/base/common/errors';
import * as azdata from 'azdata';
import { ACTIVE_GROUP, IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { TableDesignerInput } from 'sql/workbench/browser/editor/tableDesigner/tableDesignerInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IAdsTelemetryService, ITelemetryEventProperties } from 'sql/platform/telemetry/common/telemetry';
import { TelemetryAction, TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';

export class TableDesignerService implements ITableDesignerService {

	constructor(@IEditorService private _editorService: IEditorService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IAdsTelemetryService private _adsTelemetryService: IAdsTelemetryService,
		@ILifecycleService private _lifecycleService: ILifecycleService,
		@IDialogService private _dialogService: IDialogService) {
		this._lifecycleService.onBeforeShutdown(async (event) => {
			event.veto(this.confirmBeforeExit(), 'veto.tableDesigner');
		});
	}

	public _serviceBrand: undefined;
	private _providers = new Map<string, TableDesignerProvider>();

	private async confirmBeforeExit(): Promise<boolean> {
		let dirtyTableDesigners = this._editorService.editors.filter(e => e instanceof TableDesignerInput && e.isDirty());
		if (dirtyTableDesigners.length > 0) {
			let result = await this._dialogService.confirm({
				message: localize('TableDesigner.saveBeforeExit', 'There are unsaved changes in Table Designer that will be lost if you close the application. Do you want to close the application?'),
				primaryButton: localize({ key: 'TableDesigner.closeApplication', comment: ['&& denotes a mnemonic'] }, "&&Close Application"),
				type: 'question'
			});
			return !result.confirmed;
		}
		return false;
	}

	/**
	 * Register a data grid provider
	 */
	public registerProvider(providerId: string, provider: TableDesignerProvider): void {
		if (this._providers.has(providerId)) {
			throw new Error(`A table designer provider with id "${providerId}" is already registered`);
		}
		this._providers.set(providerId, provider);
	}

	public unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	public getProvider(providerId: string): TableDesignerProvider {
		const provider = this._providers.get(providerId);
		if (provider) {
			return provider;
		}
		throw invalidProvider(providerId);
	}

	public async openTableDesigner(providerId: string, tableInfo: azdata.designers.TableInfo, telemetryInfo?: ITelemetryEventProperties, objectExplorerContext?: azdata.ObjectExplorerContext): Promise<void> {
		this._adsTelemetryService.createActionEvent(TelemetryView.TableDesigner, TelemetryAction.Open).withAdditionalProperties(telemetryInfo).send();
		const provider = this.getProvider(providerId);
		const tableDesignerInput = this._instantiationService.createInstance(TableDesignerInput, provider, tableInfo, telemetryInfo, objectExplorerContext);
		await this._editorService.openEditor(tableDesignerInput, { pinned: true }, ACTIVE_GROUP);
	}
}
