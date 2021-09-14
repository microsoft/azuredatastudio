/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./insertCellsModal';
import { Button } from 'sql/base/browser/ui/button/button';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILogService } from 'vs/platform/log/common/log';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import { ServiceOption } from 'azdata';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { TextCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { NgModuleRef, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { bootstrapAngular } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { localize } from 'vs/nls';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { InsertCellsModule } from 'sql/workbench/contrib/notebook/browser/notebookViews/insertCellsModal.module';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { truncate } from 'vs/base/common/strings';
import { toJpeg } from 'html-to-image';
import { IComponentEventArgs } from 'sql/platform/dashboard/browser/interfaces';
import { Thumbnail } from 'sql/workbench/contrib/notebook/browser/notebookViews/insertCellsScreenshots.component';

type CellOption = {
	optionMetadata: ServiceOption,
	defaultValue: string,
	currentValue: boolean
};

export class CellOptionsModel {
	private _optionsMap: { [name: string]: CellOption } = {};

	constructor(
		optionsMetadata: ServiceOption[],
		private onInsert: (cell: ICellModel) => void,
		private _context: NotebookViewsExtension,
	) {
		optionsMetadata.forEach(optionMetadata => {
			let defaultValue = this.getDisplayValue(optionMetadata, optionMetadata.defaultValue);
			this._optionsMap[optionMetadata.name] = {
				optionMetadata: optionMetadata,
				defaultValue: optionMetadata.defaultValue,
				currentValue: defaultValue
			};
		});
	}

	public get checkedOptions(): CellOption[] {
		return Object.values(this._optionsMap).filter(o => o.currentValue === true);
	}

	private getDisplayValue(optionMetadata: ServiceOption, optionValue: string): boolean {
		let displayValue: boolean = false;
		switch (optionMetadata.valueType) {
			case ServiceOptionType.boolean:
				displayValue = DialogHelper.getBooleanValueFromStringOrBoolean(optionValue);
				break;
		}
		return displayValue;
	}

	restoreCells(): void {
		for (let key in this._optionsMap) {
			let optionElement = this._optionsMap[key];
			if (optionElement.currentValue === true) {
				const activeView = this._context.getActiveView();
				const cellToInsert = activeView.getCell(optionElement.optionMetadata.name);
				if (cellToInsert) {
					this.onInsert(cellToInsert);
				}
			}
		}
	}

	public setOptionValue(optionName: string, value: boolean): void {
		if (this._optionsMap[optionName] !== undefined) {
			this._optionsMap[optionName].currentValue = value;
		}
	}

	public getOptionValue(optionName: string): boolean | undefined {
		return this._optionsMap[optionName]?.currentValue;
	}
}

export class InsertCellsModal extends Modal {
	public viewModel: CellOptionsModel;

	private _submitButton: Button;
	private _cancelButton: Button;
	private _maxTitleLength: number = 20;
	private _moduleRef?: NgModuleRef<typeof InsertCellsModule>;

	constructor(
		private onInsert: (cell: ICellModel) => void,
		private _context: NotebookViewsExtension,
		private _containerRef: ViewContainerRef,
		private _componentFactoryResolver: ComponentFactoryResolver,
		@ILogService logService: ILogService,
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
		@IClipboardService clipboardService: IClipboardService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
	) {
		super(
			localize("insertCellsModal.title", "Insert cells"),
			'InsertCellsModal',
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{ hasErrors: true, hasSpinner: true }
		);

		const options = this.getOptions();
		this.viewModel = new CellOptionsModel(options, this.onInsert, this._context);
	}

	protected renderBody(container: HTMLElement): void {
		this.createOptions(container)
			.catch((e) => { this.setError(localize("insertCellsModal.thumbnailError", "Error: Unable to generate thumbnails.")); });
	}

	protected layout(height: number): void {
		// No-op for now. No need to relayout.
	}

	private async createOptions(container: HTMLElement): Promise<void> {
		const activeView = this._context.getActiveView();
		const cellsAvailableToInsert = activeView.hiddenCells;

		const thumbnails = await Promise.all(
			cellsAvailableToInsert.map(async (cell) => {
				return {
					id: cell.cellGuid,
					path: await this.generateScreenshot(cell),
					title: localize("insertCellsModal.cellTitle", "Cell {0}", Number.parseInt(cell.id) + 1)
				} as Thumbnail;
			})
		);

		this.bootstrapAngular(container, thumbnails);
	}

	public onOptionChecked(e: IComponentEventArgs) {
		if (e.args?.value) {
			let optionName: string = e.args.value;
			this.viewModel.setOptionValue(optionName, e.args.selected);
			this.validate();
		}
	}

	public async generateScreenshot(cell: ICellModel, screenshotWidth: number = 300, screenshowHeight: number = 300, backgroundColor: string = '#ffffff'): Promise<string> {
		try {
			let componentFactory = this._componentFactoryResolver.resolveComponentFactory(TextCellComponent);
			let component = this._containerRef.createComponent(componentFactory);

			component.instance.model = this._context.notebook as NotebookModel;
			component.instance.cellModel = cell;

			component.instance.handleContentChanged();

			const element: HTMLElement = component.instance.outputRef.nativeElement;

			const scale = element.clientWidth / screenshotWidth;
			const canvasWidth = element.clientWidth / scale;
			const canvasHeight = element.clientHeight / scale;

			return toJpeg(component.instance.outputRef.nativeElement, { quality: .6, canvasWidth, canvasHeight, backgroundColor });
		} catch (e) {
			this.logService.error(`Error generating screenshot: ${e}`);
			return '';
		}
	}

	private getOptions(): ServiceOption[] {
		const activeView = this._context.getActiveView();
		const cellsAvailableToInsert = activeView.hiddenCells;
		return cellsAvailableToInsert.map((cell) => ({
			name: cell.cellGuid,
			displayName: truncate(cell.renderedOutputTextContent[0] ?? '', this._maxTitleLength) || localize("insertCellsModal.untitled", "Untitled Cell : {0}", cell.cellGuid),
			description: '',
			groupName: undefined,
			valueType: ServiceOptionType.boolean,
			defaultValue: '',
			objectType: undefined,
			categoryValues: [],
			isRequired: false,
			isArray: undefined,
		}));
	}

	public override render() {
		super.render();

		this._submitButton = this.addFooterButton(localize('insertCellsModal.Insert', "Insert"), () => this.onSubmitHandler());
		this._cancelButton = this.addFooterButton(localize('insertCellsModal.Cancel', "Cancel"), () => this.onCancelHandler(), 'right', true);

		this._register(attachButtonStyler(this._submitButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));

		attachModalDialogStyler(this, this._themeService);
		this.validate();
	}

	private validate() {
		if (this.viewModel.checkedOptions.length) {
			this._submitButton.enabled = true;
		} else {
			this._submitButton.enabled = false;
		}
	}

	private onSubmitHandler() {
		this.viewModel.restoreCells();
		this.close();
	}

	private onCancelHandler() {
		this.close();
	}

	public close(): void {
		return this.hide();
	}

	public async open(): Promise<void> {
		this.show();
	}

	public override dispose(): void {
		super.dispose();

		if (this._moduleRef) {
			this._moduleRef.destroy();
		}
	}

	/**
	 * Get the bootstrap params and perform the bootstrap
	 */
	private bootstrapAngular(bodyContainer: HTMLElement, thumbnails: Thumbnail[]) {
		this._instantiationService.invokeFunction<void, any[]>(bootstrapAngular,
			InsertCellsModule,
			bodyContainer,
			'insert-cells-screenshots-component',
			{
				thumbnails,
				onClick: (e: IComponentEventArgs) => { this.onOptionChecked(e); }
			},
			undefined,
			(moduleRef: NgModuleRef<typeof InsertCellsModule>) => this._moduleRef = moduleRef);
	}
}
