/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { getErrorMessage } from 'vs/base/common/errors';

export const SERVICE_ID = 'serializationService';

export const ISerializationService = createDecorator<ISerializationService>(SERVICE_ID);
const saveAsNotSupported = localize('saveAsNotSupported', "Saving results into different format disabled for this data provider.");
const defaultBatchSize = 500;

export interface SerializeDataParams {
	/**
	 * 'csv', 'json', 'excel', 'xml'
	 */
	saveFormat: string;
	filePath: string;
	/**
	 * Gets an array of rows to be sent for serialization
	 * @param rowStart Index in the array to start copying rows from
	 * @param numberOfRows Total number of rows to copy. If 0 or undefined, will copy all
	 */
	getRowRange(rowStart: number, numberOfRows?: number): azdata.DbCellValue[][];
	rowCount: number;
	columns: azdata.IDbColumn[];
	includeHeaders?: boolean;
	delimiter?: string;
	lineSeperator?: string;
	textIdentifier?: string;
	encoding?: string;
	formatted?: boolean;
}

export interface ISerializationService {
	_serviceBrand: undefined;

	registerProvider(providerId: string, provider: azdata.SerializationProvider): void;

	hasProvider(): boolean;

	saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<azdata.SaveResultRequestResult>;

	disabledSaveAs(): Thenable<azdata.SaveResultRequestResult>;

	serializeResults(request: SerializeDataParams): Promise<azdata.SerializeDataResult>;

	getSaveResultsFeatureMetadataProvider(ownerUri: string): azdata.FeatureMetadataProvider | undefined;
}

function getBatchSize(totalRows: number, currentIndex: number): number {
	let rowsAvailable = totalRows - currentIndex;
	return (defaultBatchSize < rowsAvailable) ? defaultBatchSize : rowsAvailable;
}

export class SerializationService implements ISerializationService {

	_serviceBrand: undefined;

	private providers: { providerId: string, provider: azdata.SerializationProvider }[] = [];

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
	}

	public registerProvider(providerId: string, provider: azdata.SerializationProvider): void {
		this.providers.push({ providerId: providerId, provider: provider });
	}

	public hasProvider(): boolean {
		return this.providers.length > 0;
	}


	public saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<azdata.SaveResultRequestResult> {
		// ideally, should read data from source & route to the serialization provider, but not implemented yet
		return Promise.reject(new Error(saveAsNotSupported));
	}

	public disabledSaveAs(): Thenable<azdata.SaveResultRequestResult> {
		return Promise.resolve({ messages: saveAsNotSupported });

	}

	public getSaveResultsFeatureMetadataProvider(ownerUri: string): azdata.FeatureMetadataProvider | undefined {
		let providerId: string = this._connectionService.getProviderIdFromUri(ownerUri);
		let providerCapabilities = this._capabilitiesService.getLegacyCapabilities(providerId);

		if (providerCapabilities) {
			return providerCapabilities.features.find(f => f.featureName === SERVICE_ID);
		}

		return undefined;
	}

	public async serializeResults(serializationRequest: SerializeDataParams): Promise<azdata.SerializeDataResult> {
		// Validate inputs
		if (!serializationRequest) {
			// Throwing here as this should only be a development time error
			throw new Error('request data for serialization is missing');
		}
		if (!this.hasProvider()) {
			return <azdata.SerializeDataResult>{
				messages: localize('noSerializationProvider', "Cannot serialize data as no provider has been registered"),
				succeeded: false
			};
		}
		try {
			// Create a new session with the provider and send initial data
			let provider = this.providers[0].provider;
			let index = 0;
			let startRequestParams = this.createStartRequest(serializationRequest, index);
			index = index + startRequestParams.rows.length;

			let startResult = await provider.startSerialization(startRequestParams);

			if (!startResult) {
				return <azdata.SerializeDataResult>{
					messages: localize('unknownSerializationError', "Serialization failed with an unknown error"),
					succeeded: false
				};
			}
			if (!startResult.succeeded) {
				return startResult;
			}
			// Continue to send additional data
			while (index < serializationRequest.rowCount) {
				let continueRequestParams = this.createContinueRequest(serializationRequest, index);
				index += continueRequestParams.rows.length;
				let continueResult = await provider.continueSerialization(continueRequestParams);
				if (!continueResult.succeeded) {
					return continueResult;
				}
			}

			// Complete the request
			return <azdata.SerializeDataResult>{
				messages: undefined,
				succeeded: true
			};
		} catch (error) {
			return <azdata.SerializeDataResult>{
				messages: getErrorMessage(error),
				succeeded: false
			};
		}
	}

	private createStartRequest(serializationRequest: SerializeDataParams, index: number): azdata.SerializeDataStartRequestParams {
		let batchSize = getBatchSize(serializationRequest.rowCount, index);
		let rows = serializationRequest.getRowRange(index, batchSize);
		let columns: azdata.SimpleColumnInfo[] = serializationRequest.columns.map(c => {
			// For now treat all as strings. In the future, would like to use the
			// type info for correct data type mapping
			let simpleCol: azdata.SimpleColumnInfo = {
				name: c.columnName,
				dataTypeName: 'NVarChar'
			};
			return simpleCol;
		});
		let isLastBatch = index + rows.length >= serializationRequest.rowCount;
		let startSerializeRequest: azdata.SerializeDataStartRequestParams = {
			saveFormat: serializationRequest.saveFormat,
			filePath: serializationRequest.filePath,
			columns: columns,
			rows: rows,
			isLastBatch: isLastBatch,
			delimiter: serializationRequest.delimiter,
			encoding: serializationRequest.encoding,
			formatted: serializationRequest.formatted,
			includeHeaders: serializationRequest.includeHeaders,
			lineSeperator: serializationRequest.lineSeperator,
			textIdentifier: serializationRequest.textIdentifier,
		};
		return startSerializeRequest;
	}

	private createContinueRequest(serializationRequest: SerializeDataParams, index: number): azdata.SerializeDataContinueRequestParams {
		let numberOfRows = getBatchSize(serializationRequest.rowCount, index);
		let rows = serializationRequest.getRowRange(index, numberOfRows);
		let isLastBatch = index + rows.length >= serializationRequest.rowCount;
		let continueSerializeRequest: azdata.SerializeDataContinueRequestParams = {
			filePath: serializationRequest.filePath,
			rows: rows,
			isLastBatch: isLastBatch
		};
		return continueSerializeRequest;
	}
}
