/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SaveResultsRequestParams } from 'azdata';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';

import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';
import * as path from 'vs/base/common/path';
import * as nls from 'vs/nls';

import Severity from 'vs/base/common/severity';
import { INotificationService, INotification } from 'vs/platform/notification/common/notification';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { getRootPath, resolveCurrentDirectory } from 'sql/platform/common/pathUtilities';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IFileDialogService, FileFilter } from 'vs/platform/dialogs/common/dialogs';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';

let prevSavePath: URI;

export interface ISaveRequest {
	format: SaveFormat;
	batchIndex: number;
	resultSetNumber: number;
	selection: Slick.Range[];
}

export interface SaveResultsResponse {
	succeeded: boolean;
	messages?: string;
}

export enum SaveFormat {
	CSV = 'csv',
	JSON = 'json',
	EXCEL = 'excel',
	XML = 'xml'
}

const msgSaveFailed = nls.localize('msgSaveFailed', "Failed to save results. ");

/**
 *  Handles save results request from the context menu of slickGrid
 */
export class ResultSerializer {
	public static tempFileCount: number = 1;

	constructor(
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IEditorService private _editorService: IEditorService,
		@IWorkspaceContextService private _contextService: IWorkspaceContextService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@INotificationService private _notificationService: INotificationService,
		@IOpenerService private readonly openerService: IOpenerService
	) { }

	/**
	 * Handle save request by getting filename from user and sending request to service
	 */
	public saveResults(uri: string, saveRequest: ISaveRequest): Promise<void> {
		const self = this;
		return this.promptForFilepath(saveRequest.format, uri).then(filePath => {
			if (filePath) {
				let saveResultsParams = this.getParameters(uri, filePath, saveRequest.batchIndex, saveRequest.resultSetNumber, saveRequest.format, saveRequest.selection ? saveRequest.selection[0] : undefined);
				let sendRequest = () => this.sendSaveRequestToService(saveResultsParams);
				return self.doSave(filePath, saveRequest.format, sendRequest);
			}
			return Promise.resolve(undefined);
		});
	}

	private async sendSaveRequestToService(saveResultsParams: SaveResultsRequestParams): Promise<SaveResultsResponse> {
		let result = await this._queryManagementService.saveResults(saveResultsParams);
		return {
			succeeded: !result.messages,
			messages: result.messages
		};
	}

	/**
	 * Handle save request by getting filename from user and sending request to service
	 */
	public handleSerialization(uri: string, format: SaveFormat, sendRequest: ((filePath: URI) => Promise<SaveResultsResponse | undefined>)): Thenable<void> {
		const self = this;
		return this.promptForFilepath(format, uri).then(filePath => {
			if (filePath) {
				return self.doSave(filePath, format, () => sendRequest(filePath));
			}
			return Promise.resolve();
		});
	}

	private get rootPath(): string | undefined {
		return getRootPath(this._contextService);
	}

	private promptForFilepath(format: SaveFormat, resourceUri: string): Promise<URI | undefined> {
		let filepathPlaceHolder = prevSavePath ? path.dirname(prevSavePath.fsPath) : resolveCurrentDirectory(resourceUri, this.rootPath);
		if (filepathPlaceHolder) {
			filepathPlaceHolder = path.join(filepathPlaceHolder, this.getResultsDefaultFilename(format));
		}

		return this.fileDialogService.showSaveDialog({
			title: nls.localize('resultsSerializer.saveAsFileTitle', "Choose Results File"),
			defaultUri: filepathPlaceHolder ? URI.file(filepathPlaceHolder) : undefined,
			filters: this.getResultsFileExtension(format)
		}).then(filePath => {
			if (filePath) {
				prevSavePath = filePath;
				return filePath;
			}
			return undefined;
		});
	}

	private getResultsDefaultFilename(format: SaveFormat): string {
		let fileName = 'Results';
		switch (format) {
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

	private getResultsFileExtension(format: SaveFormat): FileFilter[] {
		let fileFilters = new Array<FileFilter>();
		let fileFilter: { extensions: string[]; name: string } = Object.create(null);

		switch (format) {
			case SaveFormat.CSV:
				fileFilter.name = nls.localize('resultsSerializer.saveAsFileExtensionCSVTitle', "CSV (Comma delimited)");
				fileFilter.extensions = ['csv'];
				break;
			case SaveFormat.JSON:
				fileFilter.name = nls.localize('resultsSerializer.saveAsFileExtensionJSONTitle', "JSON");
				fileFilter.extensions = ['json'];
				break;
			case SaveFormat.EXCEL:
				fileFilter.name = nls.localize('resultsSerializer.saveAsFileExtensionExcelTitle', "Excel Workbook");
				fileFilter.extensions = ['xlsx'];
				break;
			case SaveFormat.XML:
				fileFilter.name = nls.localize('resultsSerializer.saveAsFileExtensionXMLTitle', "XML");
				fileFilter.extensions = ['xml'];
				break;
			default:
				fileFilter.name = nls.localize('resultsSerializer.saveAsFileExtensionTXTTitle', "Plain Text");
				fileFilter.extensions = ['txt'];
		}

		fileFilters.push(fileFilter);
		return fileFilters;
	}

	public getBasicSaveParameters(format: string): SaveResultsRequestParams {
		let saveResultsParams: SaveResultsRequestParams;

		if (format === SaveFormat.CSV) {
			saveResultsParams = this.getConfigForCsv();
		} else if (format === SaveFormat.JSON) {
			saveResultsParams = this.getConfigForJson();
		} else if (format === SaveFormat.EXCEL) {
			saveResultsParams = this.getConfigForExcel();
		} else if (format === SaveFormat.XML) {
			saveResultsParams = this.getConfigForXml();
		}
		return saveResultsParams!; // this could be unsafe
	}


	private getConfigForCsv(): SaveResultsRequestParams {
		let saveResultsParams = <SaveResultsRequestParams>{ resultFormat: SaveFormat.CSV as string };

		// get save results config from vscode config
		let saveConfig = this._configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.saveAsCsv;
		// if user entered config, set options
		if (saveConfig) {
			if (saveConfig.includeHeaders !== undefined) {
				saveResultsParams.includeHeaders = saveConfig.includeHeaders;
			}
			if (saveConfig.delimiter !== undefined) {
				saveResultsParams.delimiter = saveConfig.delimiter;
			}
			if (saveConfig.lineSeperator !== undefined) {
				saveResultsParams.lineSeperator = saveConfig.lineSeperator;
			}
			if (saveConfig.textIdentifier !== undefined) {
				saveResultsParams.textIdentifier = saveConfig.textIdentifier;
			}
			if (saveConfig.encoding !== undefined) {
				saveResultsParams.encoding = saveConfig.encoding;
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
		config.delimiter = undefined;
		config.lineSeperator = undefined;
		config.textIdentifier = undefined;
		config.encoding = undefined;
		return config;
	}

	private getConfigForXml(): SaveResultsRequestParams {
		let saveResultsParams = <SaveResultsRequestParams>{ resultFormat: SaveFormat.XML as string };

		// get save results config from vscode config
		let saveConfig = this._configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.saveAsXml;
		// if user entered config, set options
		if (saveConfig) {
			if (saveConfig.formatted !== undefined) {
				saveResultsParams.formatted = saveConfig.formatted;
			}
			if (saveConfig.encoding !== undefined) {
				saveResultsParams.encoding = saveConfig.encoding;
			}
		}

		return saveResultsParams;
	}


	private getParameters(uri: string, filePath: URI, batchIndex: number, resultSetNo: number, format: string, selection?: Slick.Range): SaveResultsRequestParams {
		let saveResultsParams = this.getBasicSaveParameters(format);
		saveResultsParams.filePath = filePath.fsPath;
		saveResultsParams.ownerUri = uri;
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
	private isSelected(selection?: Slick.Range): selection is Slick.Range {
		return !!(selection && !((selection.fromCell === selection.toCell) && (selection.fromRow === selection.toRow)));
	}

	/**
	 * Send request to sql tools service to save a result set
	 */
	private async doSave(filePath: URI, format: string, sendRequest: () => Promise<SaveResultsResponse | undefined>): Promise<void> {

		const saveNotification: INotification = {
			severity: Severity.Info,
			message: nls.localize('savingFile', "Saving file..."),
			progress: {
				infinite: true
			}
		};
		const notificationHandle = this._notificationService.notify(saveNotification);

		// send message to the sqlserverclient for converting results to the requested format and saving to filepath
		try {
			let result = await sendRequest();
			if (!result || result.messages) {
				this._notificationService.notify({
					severity: Severity.Error,
					message: msgSaveFailed + (result ? result.messages : '')
				});
			} else {
				this.openSavedFile(filePath, format);
			}
			// TODO telemetry for save results
			// Telemetry.sendTelemetryEvent('SavedResults', { 'type': format });

		} catch (error) {
			this._notificationService.notify({
				severity: Severity.Error,
				message: msgSaveFailed + error
			});
		} finally {
			notificationHandle.close();
		}
	}

	/**
	 * Open the saved file in a new vscode editor pane
	 */
	private openSavedFile(filePath: URI, format: string): void {
		if (format !== SaveFormat.EXCEL) {
			this._editorService.openEditor({ resource: filePath }).then((result) => {

			}, (error: any) => {
				this._notificationService.notify({
					severity: Severity.Error,
					message: error
				});
			});
		} else {
			this._notificationService.prompt(
				Severity.Info,
				nls.localize('msgSaveSucceeded', "Successfully saved results to {0}", filePath.path),
				[{
					label: nls.localize('openFile', "Open file"),
					run: () => {
						this.openerService.open(filePath, { openExternal: true });
					}
				}]
			);
		}
	}
}
