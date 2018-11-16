/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';
import 'vs/css!./outputArea';
import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, Output, EventEmitter } from '@angular/core';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import * as themeColors from 'vs/workbench/common/theme';
import { IWorkbenchThemeService, IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';

export const OUTPUT_AREA_SELECTOR: string = 'output-area-component';

@Component({
	selector: OUTPUT_AREA_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./outputArea.component.html'))
})
export class OutputAreaComponent extends AngularDisposable implements OnInit {
	@ViewChild('outputarea', { read: ElementRef }) private outputArea: ElementRef;
	@Input() cellModel: ICellModel;

	private readonly _minimumHeight = 30;

	constructor(
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.outputArea.nativeElement;
		outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}
}
