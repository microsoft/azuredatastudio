/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./insertCellsModal';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { Button } from 'sql/base/browser/ui/button/button';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILogService } from 'vs/platform/log/common/log';
import { IColorTheme, ICssStyleCollector, IThemeService, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import * as DOM from 'vs/base/browser/dom';
import { attachCheckboxStyler } from 'sql/platform/theme/common/styler';
import { ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import { ServiceOption } from 'azdata';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { TextCellComponent } from 'sql/workbench/contrib/notebook/browser/cellViews/textCell.component';
import { ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { inputBorder, inputValidationInfoBorder } from 'vs/platform/theme/common/colorRegistry';
import { localize } from 'vs/nls';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { truncate } from 'vs/base/common/strings';
import { toJpeg } from 'html-to-image';

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
	private _optionsMap: { [name: string]: Checkbox } = {};
	private _maxTitleLength: number = 20;

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
		const grid = DOM.$<HTMLDivElement>('div#insert-dialog-cell-grid');

		grid.style.display = 'grid';
		grid.style.gridTemplateColumns = '1fr 1fr';
		grid.style.gap = '10px';
		grid.style.padding = '10px';
		grid.style.overflowY = 'auto';
		grid.style.maxHeight = 'calc(100% - 40px)';

		const gridTitle = DOM.$<HTMLHeadElement>('h2.grid-title');
		gridTitle.title = localize("insertCellsModal.selectCells", "Select cell sources");

		DOM.append(container, grid);

		this.createOptions(grid)
			.catch((e) => { this.setError(localize("insertCellsModal.thumbnailError", "Error: Unable to generate thumbnails.")); });
	}

	protected layout(height: number): void {
		// No-op for now. No need to relayout.
	}

	private async createOptions(container: HTMLElement): Promise<void> {
		const activeView = this._context.getActiveView();
		const cellsAvailableToInsert = activeView.hiddenCells;

		cellsAvailableToInsert.forEach(async (cell) => {
			const optionWidget = this.createCheckBoxHelper(
				container,
				'<div class="loading-spinner-container"><div class="loading-spinner codicon in-progress"></div></div>',
				false,
				() => this.onOptionChecked(cell.cellGuid)
			);

			const img = await this.generateScreenshot(cell);
			const wrapper = DOM.$<HTMLDivElement>('div.thumnail-wrapper');
			const thumbnail = DOM.$<HTMLImageElement>('img.thumbnail');

			thumbnail.src = img;
			thumbnail.style.maxWidth = '100%';
			DOM.append(wrapper, thumbnail);
			optionWidget.label = wrapper.outerHTML;

			this._optionsMap[cell.cellGuid] = optionWidget;
		});
	}

	private createCheckBoxHelper(container: HTMLElement, label: string, isChecked: boolean, onCheck: (viaKeyboard: boolean) => void): Checkbox {
		const checkbox = new Checkbox(DOM.append(container, DOM.$('.dialog-input-section')), {
			label: label,
			checked: isChecked,
			onChange: onCheck,
			ariaLabel: label
		});
		this._register(attachCheckboxStyler(checkbox, this._themeService));
		return checkbox;
	}

	public onOptionChecked(optionName: string) {
		this.viewModel.setOptionValue(optionName, (<Checkbox>this._optionsMap[optionName]).checked);
		this.validate();
	}

	public async generateScreenshot(cell: ICellModel, screenshotWidth: number = 300, screenshowHeight: number = 300, backgroundColor: string = '#ffffff'): Promise<string> {
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
		if (Object.keys(this._optionsMap).length) {
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
		for (let key in this._optionsMap) {
			let widget = this._optionsMap[key];
			widget.dispose();
			delete this._optionsMap[key];
		}
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const inputBorderColor = theme.getColor(inputBorder);
	if (inputBorderColor) {
		collector.addRule(`
		#insert-dialog-cell-grid input[type="checkbox"] + label {
			border: 2px solid;
			border-color: ${inputBorderColor.toString()};
			display: flex;
			height: 125px;
			overflow: hidden;
		}
		`);
	}

	const inputActiveOptionBorderColor = theme.getColor(inputValidationInfoBorder);
	if (inputActiveOptionBorderColor) {
		collector.addRule(`
		#insert-dialog-cell-grid input[type="checkbox"]:checked + label {
			border-color: ${inputActiveOptionBorderColor.toString()};
		}
		`);
	}
});
