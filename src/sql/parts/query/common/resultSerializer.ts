/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ConnectionConstants from 'sql/parts/connection/common/constants';
import * as Constants from 'sql/parts/query/common/constants';
import * as LocalizedConstants from 'sql/parts/query/common/localizedConstants';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import { SaveResultsRequestParams } from 'sqlops';
import { IQueryManagementService } from 'sql/parts/query/common/queryManagement';
import { ISaveRequest, SaveFormat } from 'sql/parts/grid/common/interfaces';
import * as PathUtilities from 'sql/common/pathUtilities';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IMessageService, Severity } from 'vs/platform/message/common/message';
import { IOutputService, IOutputChannel, IOutputChannelRegistry, Extensions as OutputExtensions } from 'vs/workbench/parts/output/common/output';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IWindowsService, IWindowService } from 'vs/platform/windows/common/windows';
import { Registry } from 'vs/platform/registry/common/platform';
import URI from 'vs/base/common/uri';
import { IUntitledEditorService, UNTITLED_SCHEMA } from 'vs/workbench/services/untitled/common/untitledEditorService';
import * as paths from 'vs/base/common/paths';
import * as nls from 'vs/nls';
import * as pretty from 'pretty-data';

import { ISlickRange } from 'angular2-slickgrid';
import * as path from 'path';

/**
 *  Handles save results request from the context menu of slickGrid
 */
export class ResultSerializer {
	public static tempFileCount: number = 1;
	private static MAX_FILENAMES = 100;

	private _uri: string;
	private _filePath: string;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IMessageService private _messageService: IMessageService,
		@IOutputService private _outputService: IOutputService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IWorkspaceConfigurationService private _workspaceConfigurationService: IWorkspaceConfigurationService,
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService,
		@IWorkspaceContextService private _contextService: IWorkspaceContextService,
		@IWindowsService private _windowsService: IWindowsService,
		@IWindowService private _windowService: IWindowService,
		@IUntitledEditorService private _untitledEditorService: IUntitledEditorService
	) { }

	/**
	 * Handle save request by getting filename from user and sending request to service
	 */
	public saveResults(uri: string, saveRequest: ISaveRequest): Thenable<void> {
		const self = this;
		this._uri = uri;

		// prompt for filepath
		let filePath = self.promptForFilepath(saveRequest);
		if (filePath) {
			return self.sendRequestToService(filePath, saveRequest.batchIndex, saveRequest.resultSetNumber, saveRequest.format, saveRequest.selection ? saveRequest.selection[0] : undefined);
		}
		return Promise.resolve(undefined);
	}

	/**
	 * Open a xml/json link - Opens the content in a new editor pane
	 */
	public openLink(content: string, columnName: string, linkType: string): void {
		let fileMode: string = undefined;
		let fileUri = this.getUntitledFileUri(columnName);

		if (linkType === SaveFormat.XML) {
			fileMode = SaveFormat.XML;
			try {
				content = pretty.pd.xml(content);
			} catch (e) {
				// If Xml fails to parse, fall back on original Xml content
			}
		} else if (linkType === SaveFormat.JSON) {
			let jsonContent: string = undefined;
			fileMode = SaveFormat.JSON;
			try {
				jsonContent = JSON.parse(content);
			} catch (e) {
				// If Json fails to parse, fall back on original Json content
			}
			if (jsonContent) {
				// If Json content was valid and parsed, pretty print content to a string
				content = JSON.stringify(jsonContent, undefined, 4);
			}
		}

		this.openUntitledFile(fileMode, content, fileUri);
	}

	private getUntitledFileUri(columnName: string): URI {
		let fileName = columnName;

		let uri: URI = URI.from({ scheme: UNTITLED_SCHEMA, path: fileName });

		// If the current filename is taken, try another up to a max number
		if (this._untitledEditorService.exists(uri)) {
			let i = 1;
			while (i < ResultSerializer.MAX_FILENAMES
				&& this._untitledEditorService.exists(uri)) {
				fileName = [columnName, i.toString()].join('-');
				uri = URI.from({ scheme: UNTITLED_SCHEMA, path: fileName });
				i++;
			}
			if (this._untitledEditorService.exists(uri)) {
				// If this fails, return undefined and let the system figure out the right name
				uri = undefined;
			}
		}
		return uri;
	}

	private ensureOutputChannelExists(): void {
		Registry.as<IOutputChannelRegistry>(OutputExtensions.OutputChannels)
			.registerChannel(ConnectionConstants.outputChannelName, ConnectionConstants.outputChannelName);
	}

	private get outputChannel(): IOutputChannel {
		this.ensureOutputChannelExists();
		return this._outputService.getChannel(ConnectionConstants.outputChannelName);
	}

	private get rootPath(): string {
		return PathUtilities.getRootPath(this._contextService);
	}

	private logToOutputChannel(message: string): void {
		this.outputChannel.append(message);
	}

	private promptForFilepath(saveRequest: ISaveRequest): string {
		let filepathPlaceHolder = PathUtilities.resolveCurrentDirectory(this._uri, this.rootPath);
		filepathPlaceHolder = path.join(filepathPlaceHolder, this.getResultsDefaultFilename(saveRequest));

		let filePath: string = this._windowService.showSaveDialog({
			title: nls.localize('saveAsFileTitle', 'Choose Results File'),
			defaultPath: paths.normalize(filepathPlaceHolder, true)
		});
		return filePath;
	}

	private getResultsDefaultFilename(saveRequest: ISaveRequest): string {
		let fileName = 'Results';
		switch (saveRequest.format) {
			case SaveFormat.CSV:
				fileName = fileName + '.csv';
				break;
			case SaveFormat.JSON:
				fileName = fileName + '.json';
				break;
			case SaveFormat.EXCEL:
				fileName = fileName + '.xlsx';
				break;
			case SaveFormat.XML:
				fileName = fileName + '.xml';
				break;
			default:
				fileName = fileName + '.txt';
		}
		return fileName;
	}

	private getConfigForCsv(): SaveResultsRequestParams {
		let saveResultsParams = <SaveResultsRequestParams>{ resultFormat: SaveFormat.CSV as string };

		// get save results config from vscode config
		let saveConfig = WorkbenchUtils.getSqlConfigSection(this._workspaceConfigurationService, Constants.configSaveAsCsv);
		// if user entered config, set options
		if (saveConfig) {
			if (saveConfig.includeHeaders !== undefined) {
				saveResultsParams.includeHeaders = saveConfig.includeHeaders;
			}
		}
		return saveResultsParams;
	}

	private getConfigForJson(): SaveResultsRequestParams {
		// JSON does not currently have special conditions
		let saveResultsParams = <SaveResultsRequestParams>{ resultFormat: SaveFormat.JSON as string };
		return saveResultsParams;
	}

	private getConfigForExcel(): SaveResultsRequestParams {
		// get save results config from vscode config
		// Note: we are currently using the configSaveAsCsv setting since it has the option mssql.saveAsCsv.includeHeaders
		// and we want to have just 1 setting that lists this.
		let config = this.getConfigForCsv();
		config.resultFormat = SaveFormat.EXCEL;
		return config;
	}

	private getParameters(filePath: string, batchIndex: number, resultSetNo: number, format: string, selection: ISlickRange): SaveResultsRequestParams {
		let saveResultsParams: SaveResultsRequestParams;
		if (!path.isAbsolute(filePath)) {
			this._filePath = PathUtilities.resolveFilePath(this._uri, filePath, this.rootPath);
		} else {
			this._filePath = filePath;
		}

		if (format === SaveFormat.CSV) {
			saveResultsParams = this.getConfigForCsv();
		} else if (format === SaveFormat.JSON) {
			saveResultsParams = this.getConfigForJson();
		} else if (format === SaveFormat.EXCEL) {
			saveResultsParams = this.getConfigForExcel();
		}

		saveResultsParams.filePath = this._filePath;
		saveResultsParams.ownerUri = this._uri;
		saveResultsParams.resultSetIndex = resultSetNo;
		saveResultsParams.batchIndex = batchIndex;
		if (this.isSelected(selection)) {
			saveResultsParams.rowStartIndex = selection.fromRow;
			saveResultsParams.rowEndIndex = selection.toRow;
			saveResultsParams.columnStartIndex = selection.fromCell;
			saveResultsParams.columnEndIndex = selection.toCell;
		}
		return saveResultsParams;
	}

	/**
	 * Check if a range of cells were selected.
	 */
	private isSelected(selection: ISlickRange): boolean {
		return (selection && !((selection.fromCell === selection.toCell) && (selection.fromRow === selection.toRow)));
	}

	/**
	 * Send request to sql tools service to save a result set
	 */
	private sendRequestToService(filePath: string, batchIndex: number, resultSetNo: number, format: string, selection: ISlickRange): Thenable<void> {
		let saveResultsParams = this.getParameters(filePath, batchIndex, resultSetNo, format, selection);

		this.logToOutputChannel(LocalizedConstants.msgSaveStarted + this._filePath);

		// send message to the sqlserverclient for converting results to the requested format and saving to filepath
		return this._queryManagementService.saveResults(saveResultsParams).then(result => {
			if (result.messages) {
				this._messageService.show(Severity.Error, LocalizedConstants.msgSaveFailed + result.messages);
				this.logToOutputChannel(LocalizedConstants.msgSaveFailed + result.messages);
			} else {
				this._messageService.show(Severity.Info, LocalizedConstants.msgSaveSucceeded + this._filePath);
				this.logToOutputChannel(LocalizedConstants.msgSaveSucceeded + filePath);
				this.openSavedFile(this._filePath, format);
			}
			// TODO telemetry for save results
			// Telemetry.sendTelemetryEvent('SavedResults', { 'type': format });

		}, error => {
			this._messageService.show(Severity.Error, LocalizedConstants.msgSaveFailed + error);
			this.logToOutputChannel(LocalizedConstants.msgSaveFailed + error);
		});
	}

	/**
	 * Open the saved file in a new vscode editor pane
	 */
	private openSavedFile(filePath: string, format: string): void {
		if (format === SaveFormat.EXCEL) {
			// This will not open in VSCode as it's treated as binary. Use the native file opener instead
			// Note: must use filePath here, URI does not open correctly
			// TODO see if there is an alternative opener that includes error handling
			let fileUri = URI.from({ scheme: PathUtilities.FILE_SCHEMA, path: filePath });
			this._windowsService.openExternal(fileUri.toString());
		} else {
			let uri = URI.file(filePath);
			this._editorService.openEditor({ resource: uri }).then((result) => {

			}, (error: any) => {
				this._messageService.show(Severity.Error, error);
			});
		}
	}

	/**
	 * Open the saved file in a new vscode editor pane
	 */
	private openUntitledFile(fileMode: string, contents: string, fileUri: URI = undefined): void {
		const input = this._untitledEditorService.createOrGet(fileUri, fileMode, contents);

		this._editorService.openEditor(input, { pinned: true })
			.then(
			(success) => {
			},
			(error: any) => {
				this._messageService.show(Severity.Error, error);
			}
			);
	}
}
