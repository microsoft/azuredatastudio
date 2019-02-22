/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/fileBrowserDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { attachModalDialogStyler, attachButtonStyler } from 'sql/platform/theme/common/styler';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import { FileNode } from 'sql/workbench/services/fileBrowser/common/fileNode';
import { FileBrowserTreeView } from 'sql/workbench/services/fileBrowser/browser/fileBrowserTreeView';
import { FileBrowserViewModel } from 'sql/workbench/services/fileBrowser/common/fileBrowserViewModel';

import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { Builder } from 'sql/base/browser/builder';
import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { Event, Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { attachInputBoxStyler, attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import * as DOM from 'vs/base/browser/dom';
import * as strings from 'vs/base/common/strings';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';

export class FileBrowserDialog extends Modal {
	private _viewModel: FileBrowserViewModel;
	private _bodyBuilder: Builder;
	private _filePathInputBox: InputBox;
	private _fileFilterSelectBox: SelectBox;
	private _okButton: Button;
	private _cancelButton: Button;
	private _onOk = new Emitter<string>();
	public onOk: Event<string> = this._onOk.event;

	private _treeContainer: Builder;
	private _fileBrowserTreeView: FileBrowserTreeView;
	private _selectedFilePath: string;
	private _isFolderSelected: boolean;

	constructor(title: string,
		@IPartService partService: IPartService,
		@IWorkbenchThemeService private _workbenchthemeService: IWorkbenchThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextViewService private _contextViewService: IContextViewService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService
	) {
		super(title, TelemetryKeys.Backup, partService, telemetryService, clipboardService, _workbenchthemeService, contextKeyService, { isFlyout: true, hasTitleIcon: false, hasBackButton: true, hasSpinner: true });
		this._viewModel = this._instantiationService.createInstance(FileBrowserViewModel);
		this._viewModel.onAddFileTree(args => this.handleOnAddFileTree(args.rootNode, args.selectedNode, args.expandedNodes));
		this._viewModel.onPathValidate(args => this.handleOnValidate(args.succeeded, args.message));
	}

	protected layout(height?: number): void {
	}

	protected renderBody(container: HTMLElement) {
		new Builder(container).div({ 'class': 'file-browser-dialog' }, (bodyBuilder) => {
			this._bodyBuilder = bodyBuilder;
		});
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		if (this.backButton) {

			this.backButton.onDidClick(() => {
				this.close();
			});

			this._register(attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND }));
		}

		this._bodyBuilder.div({ class: 'tree-view' }, (treeContainer) => {
			this._treeContainer = treeContainer;
		});

		this._bodyBuilder.div({ class: 'option-section' }, (tableWrapper) => {
			tableWrapper.element('table', { class: 'file-table-content' }, (tableContainer) => {
				let pathLabel = localize('filebrowser.filepath', 'Selected path');
				let pathBuilder = DialogHelper.appendRow(tableContainer, pathLabel, 'file-input-label', 'file-input-box');
				this._filePathInputBox = new InputBox(pathBuilder.getHTMLElement(), this._contextViewService, {
					ariaLabel: pathLabel
				});

				this._fileFilterSelectBox = new SelectBox(['*'], '*', this._contextViewService);
				let filterLabel = localize('fileFilter', 'Files of type');
				let filterBuilder = DialogHelper.appendRow(tableContainer, filterLabel, 'file-input-label', 'file-input-box');
				DialogHelper.appendInputSelectBox(filterBuilder, this._fileFilterSelectBox);
			});
		});

		this._okButton = this.addFooterButton(localize('fileBrowser.ok', 'OK'), () => this.ok());
		this._okButton.enabled = false;
		this._cancelButton = this.addFooterButton(localize('fileBrowser.discard', 'Discard'), () => this.close());

		this.registerListeners();
		this.updateTheme();
	}

	public open(ownerUri: string,
		expandPath: string,
		fileFilters: [{ label: string, filters: string[] }],
		fileValidationServiceType: string,
	) {
		this._viewModel.initialize(ownerUri, expandPath, fileFilters, fileValidationServiceType);
		this._fileFilterSelectBox.setOptions(this._viewModel.formattedFileFilters);
		this._fileFilterSelectBox.select(0);
		this._filePathInputBox.value = expandPath;
		this._isFolderSelected = true;
		this.enableOkButton();
		this.showSpinner();
		this.show();

		this._fileBrowserTreeView = this._instantiationService.createInstance(FileBrowserTreeView);
		this._fileBrowserTreeView.setOnClickedCallback((arg) => this.onClicked(arg));
		this._fileBrowserTreeView.setOnDoubleClickedCallback((arg) => this.onDoubleClicked(arg));
		this._viewModel.openFileBrowser(0, false);
	}

	/* enter key */
	protected onAccept() {
		if (this._okButton.enabled === true) {
			this.ok();
		}
	}

	private handleOnAddFileTree(rootNode: FileNode, selectedNode: FileNode, expandedNodes: FileNode[]) {
		this.updateFileTree(rootNode, selectedNode, expandedNodes);
		this.hideSpinner();
	}

	private enableOkButton() {
		if (strings.isFalsyOrWhitespace(this._selectedFilePath) || this._isFolderSelected === true) {
			this._okButton.enabled = false;
		} else {
			this._okButton.enabled = true;
		}
	}

	private onClicked(selectedNode: FileNode) {
		this._filePathInputBox.value = selectedNode.fullPath;

		if (selectedNode.isFile === true) {
			this._isFolderSelected = false;
		} else {
			this._isFolderSelected = true;
		}

		this.enableOkButton();
	}

	private onDoubleClicked(selectedNode: FileNode) {
		if (selectedNode.isFile === true) {
			this.ok();
		}
	}

	private onFilePathChange(filePath: string) {
		this._isFolderSelected = false;
		this._selectedFilePath = filePath;

		this._filePathInputBox.hideMessage();
		this.enableOkButton();
	}

	private onFilePathBlur(param) {
		if (!strings.isFalsyOrWhitespace(param.value)) {
			this._viewModel.validateFilePaths([param.value]);
		}
	}

	private ok() {
		this._onOk.fire(this._selectedFilePath);
		this.close();
	}

	private handleOnValidate(succeeded: boolean, errorMessage: string) {
		if (succeeded === false) {
			if (strings.isFalsyOrWhitespace(errorMessage)) {
				errorMessage = 'The provided path is invalid.';
			}
			this._filePathInputBox.showMessage({ type: MessageType.ERROR, content: errorMessage });
		}
	}

	private close() {
		if (this._fileBrowserTreeView) {
			this._fileBrowserTreeView.dispose();
		}
		this._onOk.dispose();
		this.hide();
		this._viewModel.closeFileBrowser();
	}

	private updateFileTree(rootNode: FileNode, selectedNode: FileNode, expandedNodes: FileNode[]): void {
		this._fileBrowserTreeView.renderBody(this._treeContainer.getHTMLElement(), rootNode, selectedNode, expandedNodes);
		this._fileBrowserTreeView.setVisible(true);
		this._fileBrowserTreeView.layout(DOM.getTotalHeight(this._treeContainer.getHTMLElement()));
	}

	private onFilterSelectChanged(filterIndex) {
		this.showSpinner();
		this._viewModel.openFileBrowser(filterIndex, true);
	}

	private registerListeners(): void {
		this._register(this._fileFilterSelectBox.onDidSelect(selection => {
			this.onFilterSelectChanged(selection.index);
		}));
		this._register(this._filePathInputBox.onDidChange(e => {
			this.onFilePathChange(e);
		}));
		this._register(this._filePathInputBox.onLoseFocus(params => {
			this.onFilePathBlur(params);
		}));

		// Theme styler
		this._register(attachInputBoxStyler(this._filePathInputBox, this._themeService));
		this._register(attachSelectBoxStyler(this._fileFilterSelectBox, this._themeService));
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));

		this._register(this._workbenchthemeService.onDidColorThemeChange(e => this.updateTheme()));
	}

	// Update theming that is specific to file browser
	private updateTheme(): void {
		if (this._treeContainer) {
			this._treeContainer.style('background-color', this.headerAndFooterBackground);
		}
	}
}