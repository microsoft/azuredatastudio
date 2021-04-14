/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/button';
import { ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnDestroy, ViewChild } from '@angular/core';
import * as azdata from 'azdata';

import { convertSize } from 'sql/base/browser/dom';
import { Button } from 'sql/base/browser/ui/button/button';
import { InfoButton } from 'sql/base/browser/ui/infoButton/infoButton';
import { ComponentEventType, IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { attachInfoButtonStyler } from 'sql/platform/theme/common/styler';
import { ComponentWithIconBase } from 'sql/workbench/browser/modelComponents/componentWithIconBase';
import { createIconCssClass } from 'sql/workbench/browser/modelComponents/iconUtils';
import { IDisposable } from 'vs/base/common/lifecycle';
import { ILogService } from 'vs/platform/log/common/log';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';

enum ButtonType {
	File = 'File',
	Normal = 'Normal',
	Informational = 'Informational'
}

@Component({
	selector: 'modelview-button',
	template: `
	<div *ngIf="this.buttonType !== 'Informational'; then thenBlock else elseBlock"></div>
	<ng-template #thenBlock>
		<label for={{this.label}}>
			<div #input [ngStyle]="CSSStyles">
				<input #fileInput *ngIf="this.isFile === true" id={{this.label}} type="file" accept="{{ this.fileType }}" style="display: none">
			</div>
		</label>
	</ng-template>
	<ng-template #elseBlock>
		<div #infoButton [ngStyle]="CSSStyles"></div>
	</ng-template>
	`
})
export default class ButtonComponent extends ComponentWithIconBase<azdata.ButtonProperties> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _button: Button | InfoButton;
	public fileType: string = '.sql';
	private _currentButtonType?: ButtonType = undefined;
	private _buttonStyler: IDisposable | undefined = undefined;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	@ViewChild('fileInput', { read: ElementRef }) private _fileInputContainer: ElementRef;
	@ViewChild('infoButton', { read: ElementRef }) private _infoButtonContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	public setLayout(layout: any): void {
		this.layout();
	}

	private initButton(): void {
		this._currentButtonType = this.buttonType;
		const elementToRemove = this._button?.element;
		if (this._inputContainer) {
			this._button = new Button(this._inputContainer.nativeElement, { secondary: this.secondary });
		} else if (this._infoButtonContainer) {
			this._button = new InfoButton(this._infoButtonContainer.nativeElement);
		}

		// remove the previously created element if any.
		if (elementToRemove) {
			const container = this._inputContainer || this._infoButtonContainer;
			(container.nativeElement as HTMLElement)?.removeChild(elementToRemove);
		}

		this._register(this._button);
		this.updateStyler();
		this._register(this._button.onDidClick(e => {
			if (this._fileInputContainer) {
				const self = this;
				this._fileInputContainer.nativeElement.onchange = () => {
					let file = self._fileInputContainer.nativeElement.files[0];
					let reader = new FileReader();
					reader.onload = (e) => {
						let text = (e.target as FileReader).result;
						self.fileContent = text.toString();
						self.fireEvent({
							eventType: ComponentEventType.onDidClick,
							args: {
								filePath: file.path,
								fileContent: self.fileContent
							}
						});
					};
					reader.readAsText(file);
				};
			} else {
				this.fireEvent({
					eventType: ComponentEventType.onDidClick,
					args: e
				});
			}
		}));
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this._currentButtonType !== this.buttonType) {
			this.initButton();
		}
		if (this._button instanceof InfoButton) {
			this._button.buttonMaxHeight = this.properties.height;
			this._button.buttonMaxWidth = this.properties.width;
			this._button.description = this.properties.description;
			this._button.iconClass = createIconCssClass(this.properties.iconPath);
			this._button.iconHeight = this.properties.iconHeight;
			this._button.iconWidth = this.properties.iconWidth;
			this._button.title = this.properties.title;
		} else {
			this._button.enabled = this.enabled;
			this._button.label = this.label;

			if (this.properties.fileType) {
				this.fileType = properties.fileType;
			}
			this._button.title = this.title;

			// Button's ariaLabel gets set to the label by default.
			// We only want to override that if buttonComponent's ariaLabel is set explicitly.
			if (this.ariaLabel) {
				this._button.ariaLabel = this.ariaLabel;
			}

			if (this.width) {
				this._button.setWidth(convertSize(this.width.toString()));
			}
			if (this.height) {
				this._button.setHeight(convertSize(this.height.toString()));
			}

			if (this.iconPath) {
				this._button.element.style.backgroundSize = `${this.getIconWidth()} ${this.getIconHeight()}`;
				this._button.element.style.paddingLeft = this.getIconWidth();
				// If we have an icon but no specified height then default to the height of the icon so we're sure it fits
				if (this.height === undefined) {
					this._button.setHeight(convertSize(this.getIconHeight().toString()));
				}
			}

		}

		this.updateIcon();
		this._changeRef.detectChanges();
	}

	public focus(): void {
		this._button.focus();
	}

	protected updateIcon() {
		if (this.iconPath) {
			if (!this._iconClass) {
				super.updateIcon();
				this._button.icon = {
					classNames: this._iconClass + ' icon'
				};
				this.updateStyler();
			} else {
				super.updateIcon();
			}
		} else {
			this.updateStyler();
		}
	}

	/**
	 * Updates the styler for this button based on whether it has an icon or not
	 */
	private updateStyler(): void {
		this._buttonStyler?.dispose();
		if (this.buttonType === ButtonType.Informational) {
			this._buttonStyler = this._register(attachInfoButtonStyler(this._button, this.themeService));
		} else {
			this._buttonStyler = this._register(attachButtonStyler(this._button, this.themeService));
		}
	}

	protected get defaultIconHeight(): number {
		return 15;
	}

	protected get defaultIconWidth(): number {
		return 15;
	}

	// CSS-bound properties

	private get label(): string {
		return this.getPropertyOrDefault<string>((props) => props.label, '');
	}

	private set label(newValue: string) {
		this.setPropertyFromUI<string>(this.setValueProperties, newValue);
	}

	public get buttonType(): ButtonType {
		if (this.isFile === true) {
			return ButtonType.File;
		} else {
			return this.getPropertyOrDefault((props) => props.buttonType, ButtonType.Normal);
		}
	}

	public get description(): string {
		return this.getPropertyOrDefault((props) => props.description, '');
	}

	public get isFile(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.isFile, false);
	}

	public set isFile(newValue: boolean) {
		this.setPropertyFromUI<boolean>(this.setFileProperties, newValue);
	}

	private get fileContent(): string {
		return this.getPropertyOrDefault<string>((props) => props.fileContent, '');
	}

	private set fileContent(newValue: string) {
		this.setPropertyFromUI<string>(this.setFileContentProperties, newValue);
	}

	private setFileContentProperties(properties: azdata.ButtonProperties, fileContent: string): void {
		properties.fileContent = fileContent;
	}

	private setValueProperties(properties: azdata.ButtonProperties, label: string): void {
		properties.label = label;
	}

	private setFileProperties(properties: azdata.ButtonProperties, isFile: boolean): void {
		properties.isFile = isFile;
	}

	private get secondary(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.secondary, false);
	}
}
