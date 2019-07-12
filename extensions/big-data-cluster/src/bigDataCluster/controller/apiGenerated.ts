/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as request from 'request';
import * as http from 'http';

let defaultBasePath = 'https://localhost';

let primitives = [
	'string',
	'boolean',
	'double',
	'integer',
	'long',
	'float',
	'number',
	'any'
];

class ObjectSerializer {

	public static findCorrectType(data: any, expectedType: string) {
		if (data === undefined) {
			return expectedType;
		} else if (primitives.indexOf(expectedType.toLowerCase()) !== -1) {
			return expectedType;
		} else if (expectedType === 'Date') {
			return expectedType;
		} else {
			if (enumsMap[expectedType]) {
				return expectedType;
			}

			if (!typeMap[expectedType]) {
				return expectedType; // w/e we don't know the type
			}

			// Check the discriminator
			let discriminatorProperty = typeMap[expectedType].discriminator;
			if (discriminatorProperty === null || discriminatorProperty === undefined) {
				return expectedType; // the type does not have a discriminator. use it.
			} else {
				if (data[discriminatorProperty]) {
					return data[discriminatorProperty]; // use the type given in the discriminator
				} else {
					return expectedType; // discriminator was not present (or an empty string)
				}
			}
		}
	}

	public static serialize(data: any, type: string) {
		if (data === undefined) {
			return data;
		} else if (primitives.indexOf(type.toLowerCase()) !== -1) {
			return data;
		} else if (type.lastIndexOf('Array<', 0) === 0) { // string.startsWith pre es6
			let subType: string = type.replace('Array<', ''); // Array<Type> => Type>
			subType = subType.substring(0, subType.length - 1); // Type> => Type
			let transformedData: any[] = [];
			for (let index in data) {
				let date = data[index];
				transformedData.push(ObjectSerializer.serialize(date, subType));
			}
			return transformedData;
		} else if (type === 'Date') {
			return data.toString();
		} else {
			if (enumsMap[type]) {
				return data;
			}
			if (!typeMap[type]) { // in case we don't know the type
				return data;
			}

			// get the map for the correct type.
			let attributeTypes = typeMap[type].getAttributeTypeMap();
			let instance: { [index: string]: any } = {};
			for (let index in attributeTypes) {
				let attributeType = attributeTypes[index];
				instance[attributeType.baseName] = ObjectSerializer.serialize(data[attributeType.name], attributeType.type);
			}
			return instance;
		}
	}

	public static deserialize(data: any, type: string) {
		// polymorphism may change the actual type.
		type = ObjectSerializer.findCorrectType(data, type);
		if (data === undefined) {
			return data;
		} else if (primitives.indexOf(type.toLowerCase()) !== -1) {
			return data;
		} else if (type.lastIndexOf('Array<', 0) === 0) { // string.startsWith pre es6
			let subType: string = type.replace('Array<', ''); // Array<Type> => Type>
			subType = subType.substring(0, subType.length - 1); // Type> => Type
			let transformedData: any[] = [];
			for (let index in data) {
				let date = data[index];
				transformedData.push(ObjectSerializer.deserialize(date, subType));
			}
			return transformedData;
		} else if (type === 'Date') {
			return new Date(data);
		} else {
			if (enumsMap[type]) {// is Enum
				return data;
			}

			if (!typeMap[type]) { // dont know the type
				return data;
			}
			let instance = new typeMap[type]();
			let attributeTypes = typeMap[type].getAttributeTypeMap();
			for (let index in attributeTypes) {
				let attributeType = attributeTypes[index];
				instance[attributeType.name] = ObjectSerializer.deserialize(data[attributeType.baseName], attributeType.type);
			}
			return instance;
		}
	}
}

export class AppMetadata {
	'name'?: string;
	'version'?: string;
	'description'?: string;
	'runtimeType'?: string;
	'initCode'?: string;
	'code'?: string;
	'azureFileSpec'?: Array<AzureFileSpecDefinition>;
	'inputDef'?: Array<ParameterDefinition>;
	'outputDef'?: Array<ParameterDefinition>;
	'replicas'?: number;
	'poolSizePerReplica'?: number;

	static discriminator: string | undefined = undefined;

	static attributeTypeMap: Array<{ name: string, baseName: string, type: string }> = [
		{
			'name': 'name',
			'baseName': 'name',
			'type': 'string'
		},
		{
			'name': 'version',
			'baseName': 'version',
			'type': 'string'
		},
		{
			'name': 'description',
			'baseName': 'description',
			'type': 'string'
		},
		{
			'name': 'runtimeType',
			'baseName': 'runtimeType',
			'type': 'string'
		},
		{
			'name': 'initCode',
			'baseName': 'initCode',
			'type': 'string'
		},
		{
			'name': 'code',
			'baseName': 'code',
			'type': 'string'
		},
		{
			'name': 'azureFileSpec',
			'baseName': 'azureFileSpec',
			'type': 'Array<AzureFileSpecDefinition>'
		},
		{
			'name': 'inputDef',
			'baseName': 'inputDef',
			'type': 'Array<ParameterDefinition>'
		},
		{
			'name': 'outputDef',
			'baseName': 'outputDef',
			'type': 'Array<ParameterDefinition>'
		},
		{
			'name': 'replicas',
			'baseName': 'replicas',
			'type': 'number'
		},
		{
			'name': 'poolSizePerReplica',
			'baseName': 'poolSizePerReplica',
			'type': 'number'
		}
	];

	static getAttributeTypeMap() {
		return AppMetadata.attributeTypeMap;
	}
}

export class AppModel {
	'name'?: string;
	'internalName'?: string;
	'version'?: string;
	'inputParamDefs'?: Array<AppModelParameterDefinition>;
	'outputParamDefs'?: Array<AppModelParameterDefinition>;
	'state'?: string;
	'links'?: { [key: string]: string; };

	static discriminator: string | undefined = undefined;

	static attributeTypeMap: Array<{ name: string, baseName: string, type: string }> = [
		{
			'name': 'name',
			'baseName': 'name',
			'type': 'string'
		},
		{
			'name': 'internalName',
			'baseName': 'internal_name',
			'type': 'string'
		},
		{
			'name': 'version',
			'baseName': 'version',
			'type': 'string'
		},
		{
			'name': 'inputParamDefs',
			'baseName': 'input_param_defs',
			'type': 'Array<AppModelParameterDefinition>'
		},
		{
			'name': 'outputParamDefs',
			'baseName': 'output_param_defs',
			'type': 'Array<AppModelParameterDefinition>'
		},
		{
			'name': 'state',
			'baseName': 'state',
			'type': 'string'
		},
		{
			'name': 'links',
			'baseName': 'links',
			'type': '{ [key: string]: string; }'
		}
	];

	static getAttributeTypeMap() {
		return AppModel.attributeTypeMap;
	}
}

export class AppModelParameterDefinition {
	'name'?: string;
	'type'?: string;

	static discriminator: string | undefined = undefined;

	static attributeTypeMap: Array<{ name: string, baseName: string, type: string }> = [
		{
			'name': 'name',
			'baseName': 'name',
			'type': 'string'
		},
		{
			'name': 'type',
			'baseName': 'type',
			'type': 'string'
		}
	];

	static getAttributeTypeMap() {
		return AppModelParameterDefinition.attributeTypeMap;
	}
}

export class AppRequest {
	'metadata'?: AppMetadata;

	static discriminator: string | undefined = undefined;

	static attributeTypeMap: Array<{ name: string, baseName: string, type: string }> = [
		{
			'name': 'metadata',
			'baseName': 'metadata',
			'type': 'AppMetadata'
		}
	];

	static getAttributeTypeMap() {
		return AppRequest.attributeTypeMap;
	}
}

export class AzureFileSpecDefinition {
	'secretName'?: string;
	'mountPath'?: string;
	'fileShareName'?: string;

	static discriminator: string | undefined = undefined;

	static attributeTypeMap: Array<{ name: string, baseName: string, type: string }> = [
		{
			'name': 'secretName',
			'baseName': 'secretName',
			'type': 'string'
		},
		{
			'name': 'mountPath',
			'baseName': 'mountPath',
			'type': 'string'
		},
		{
			'name': 'fileShareName',
			'baseName': 'fileShareName',
			'type': 'string'
		}
	];

	static getAttributeTypeMap() {
		return AzureFileSpecDefinition.attributeTypeMap;
	}
}

export class EndpointModel {
	'name'?: string;
	'description'?: string;
	'endpoint'?: string;
	'ip'?: string;
	'port'?: number;
	'path'?: string;
	'protocol'?: string;
	'service'?: string;

	static discriminator: string | undefined = undefined;

	static attributeTypeMap: Array<{ name: string, baseName: string, type: string }> = [
		{
			'name': 'name',
			'baseName': 'name',
			'type': 'string'
		},
		{
			'name': 'description',
			'baseName': 'description',
			'type': 'string'
		},
		{
			'name': 'endpoint',
			'baseName': 'endpoint',
			'type': 'string'
		},
		{
			'name': 'ip',
			'baseName': 'ip',
			'type': 'string'
		},
		{
			'name': 'port',
			'baseName': 'port',
			'type': 'number'
		},
		{
			'name': 'path',
			'baseName': 'path',
			'type': 'string'
		},
		{
			'name': 'protocol',
			'baseName': 'protocol',
			'type': 'string'
		},
		{
			'name': 'service',
			'baseName': 'service',
			'type': 'string'
		}
	];

	static getAttributeTypeMap() {
		return EndpointModel.attributeTypeMap;
	}
}

export class ParameterDefinition {
	'name'?: string;
	'type'?: string;

	static discriminator: string | undefined = undefined;

	static attributeTypeMap: Array<{ name: string, baseName: string, type: string }> = [
		{
			'name': 'name',
			'baseName': 'name',
			'type': 'string'
		},
		{
			'name': 'type',
			'baseName': 'type',
			'type': 'string'
		}
	];

	static getAttributeTypeMap() {
		return ParameterDefinition.attributeTypeMap;
	}
}

export class TokenModel {
	'tokenType'?: string;
	'accessToken'?: string;
	'expiresIn'?: number;
	'expiresOn'?: number;
	'tokenId'?: string;

	static discriminator: string | undefined = undefined;

	static attributeTypeMap: Array<{ name: string, baseName: string, type: string }> = [
		{
			'name': 'tokenType',
			'baseName': 'token_type',
			'type': 'string'
		},
		{
			'name': 'accessToken',
			'baseName': 'access_token',
			'type': 'string'
		},
		{
			'name': 'expiresIn',
			'baseName': 'expires_in',
			'type': 'number'
		},
		{
			'name': 'expiresOn',
			'baseName': 'expires_on',
			'type': 'number'
		},
		{
			'name': 'tokenId',
			'baseName': 'token_id',
			'type': 'string'
		}
	];

	static getAttributeTypeMap() {
		return TokenModel.attributeTypeMap;
	}
}


let enumsMap: { [index: string]: any } = {
};

let typeMap: { [index: string]: any } = {
	'AppMetadata': AppMetadata,
	'AppModel': AppModel,
	'AppModelParameterDefinition': AppModelParameterDefinition,
	'AppRequest': AppRequest,
	'AzureFileSpecDefinition': AzureFileSpecDefinition,
	'EndpointModel': EndpointModel,
	'ParameterDefinition': ParameterDefinition,
	'TokenModel': TokenModel,
};

export interface Authentication {
	/**
	* Apply authentication settings to header and query params.
	*/
	applyToRequest(requestOptions: request.Options): void;
}

export class HttpBasicAuth implements Authentication {
	public username: string = '';
	public password: string = '';

	applyToRequest(requestOptions: request.Options): void {
		requestOptions.auth = {
			username: this.username, password: this.password
		};
	}
}

export class ApiKeyAuth implements Authentication {
	public apiKey: string = '';

	constructor(private location: string, private paramName: string) {
	}

	applyToRequest(requestOptions: request.Options): void {
		if (this.location === 'query') {
			(<any>requestOptions.qs)[this.paramName] = this.apiKey;
		} else if (this.location === 'header' && requestOptions && requestOptions.headers) {
			requestOptions.headers[this.paramName] = this.apiKey;
		}
	}
}

export class OAuth implements Authentication {
	public accessToken: string = '';

	applyToRequest(requestOptions: request.Options): void {
		if (requestOptions && requestOptions.headers) {
			requestOptions.headers['Authorization'] = 'Bearer ' + this.accessToken;
		}
	}
}

export class VoidAuth implements Authentication {
	public username: string = '';
	public password: string = '';

	applyToRequest(_: request.Options): void {
		// Do nothing
	}
}

export enum AppRouterApiApiKeys {
}

export class AppRouterApi {
	protected _basePath = defaultBasePath;
	protected defaultHeaders: any = {};
	protected _useQuerystring: boolean = false;

	protected authentications = {
		'default': <Authentication>new VoidAuth(),
		'basic': new HttpBasicAuth()
	};

	constructor(basePath?: string);
	constructor(username: string, password: string, basePath?: string);
	constructor(basePathOrUsername: string, password?: string, basePath?: string) {
		if (password) {
			this.username = basePathOrUsername;
			this.password = password;
			if (basePath) {
				this.basePath = basePath;
			}
		} else {
			if (basePathOrUsername) {
				this.basePath = basePathOrUsername;
			}
		}
	}

	set useQuerystring(value: boolean) {
		this._useQuerystring = value;
	}

	set basePath(basePath: string) {
		this._basePath = basePath;
	}

	get basePath() {
		return this._basePath;
	}

	public setDefaultAuthentication(auth: Authentication) {
		this.authentications.default = auth;
	}

	public setApiKey(key: AppRouterApiApiKeys, value: string) {
		(this.authentications as any)[AppRouterApiApiKeys[key]].apiKey = value;
	}
	set username(username: string) {
		this.authentications.basic.username = username;
	}

	set password(password: string) {
		this.authentications.basic.password = password;
	}

	/**
	 * @param name name
	 * @param version version
	 * @param [options] Override http request options.
	 */
	public appByNameByVersionDelete(name: string, version: string, options: any = {}): Promise<{ response: http.IncomingMessage; body?: any; }> {
		const localVarPath = this.basePath + '/app/{name}/{version}'
			.replace('{name}', encodeURIComponent(String(name)))
			.replace('{version}', encodeURIComponent(String(version)));
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		// verify required parameter 'name' is not null or undefined
		if (name === null || name === undefined) {
			throw new Error('Required parameter name was null or undefined when calling appByNameByVersionDelete.');
		}

		// verify required parameter 'version' is not null or undefined
		if (version === null || version === undefined) {
			throw new Error('Required parameter version was null or undefined when calling appByNameByVersionDelete.');
		}

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'DELETE',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body?: any; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}

	/**
	 * @param name name
	 * @param version version
	 * @param [options] Override http request options.
	 */
	public appByNameByVersionGet(name: string, version: string, options: any = {}): Promise<{ response: http.IncomingMessage; body: AppModel; }> {
		const localVarPath = this.basePath + '/app/{name}/{version}'
			.replace('{name}', encodeURIComponent(String(name)))
			.replace('{version}', encodeURIComponent(String(version)));
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		// verify required parameter 'name' is not null or undefined
		if (name === null || name === undefined) {
			throw new Error('Required parameter name was null or undefined when calling appByNameByVersionGet.');
		}

		// verify required parameter 'version' is not null or undefined
		if (version === null || version === undefined) {
			throw new Error('Required parameter version was null or undefined when calling appByNameByVersionGet.');
		}

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'GET',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body: AppModel; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					body = ObjectSerializer.deserialize(body, 'AppModel');
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}

	/**
	 * @param name name
	 * @param version version
	 * @param appRequest appRequest
	 * @param [options] Override http request options.
	 */
	public appByNameByVersionPatch(name: string, version: string, appRequest?: AppRequest, options: any = {}): Promise<{ response: http.IncomingMessage; body?: any; }> {
		const localVarPath = this.basePath + '/app/{name}/{version}'
			.replace('{name}', encodeURIComponent(String(name)))
			.replace('{version}', encodeURIComponent(String(version)));
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		// verify required parameter 'name' is not null or undefined
		if (name === null || name === undefined) {
			throw new Error('Required parameter name was null or undefined when calling appByNameByVersionPatch.');
		}

		// verify required parameter 'version' is not null or undefined
		if (version === null || version === undefined) {
			throw new Error('Required parameter version was null or undefined when calling appByNameByVersionPatch.');
		}

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'PATCH',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
			body: ObjectSerializer.serialize(appRequest, 'AppRequest')
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body?: any; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}

	/**
	 * @param name name
	 * @param version version
	 * @param [options] Override http request options.
	 */
	public appByNameByVersionSwaggerJsonGet(name: string, version: string, options: any = {}): Promise<{ response: http.IncomingMessage; body?: any; }> {
		const localVarPath = this.basePath + '/app/{name}/{version}/swagger.json'
			.replace('{name}', encodeURIComponent(String(name)))
			.replace('{version}', encodeURIComponent(String(version)));
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		// verify required parameter 'name' is not null or undefined
		if (name === null || name === undefined) {
			throw new Error('Required parameter name was null or undefined when calling appByNameByVersionSwaggerJsonGet.');
		}

		// verify required parameter 'version' is not null or undefined
		if (version === null || version === undefined) {
			throw new Error('Required parameter version was null or undefined when calling appByNameByVersionSwaggerJsonGet.');
		}

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'GET',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body?: any; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}

	/**
	 * @param name name
	 * @param [options] Override http request options.
	 */
	public appByNameGet(name: string, options: any = {}): Promise<{ response: http.IncomingMessage; body: Array<AppModel>; }> {
		const localVarPath = this.basePath + '/app/{name}'
			.replace('{name}', encodeURIComponent(String(name)));
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		// verify required parameter 'name' is not null or undefined
		if (name === null || name === undefined) {
			throw new Error('Required parameter name was null or undefined when calling appByNameGet.');
		}

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'GET',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body: Array<AppModel>; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					body = ObjectSerializer.deserialize(body, 'Array<AppModel>');
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}

	/**
	 * @param [options] Override http request options.
	 */
	public appGet(options: any = {}): Promise<{ response: http.IncomingMessage; body: Array<AppModel>; }> {
		const localVarPath = this.basePath + '/app';
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'GET',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body: Array<AppModel>; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					body = ObjectSerializer.deserialize(body, 'Array<AppModel>');
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}

	/**
	 * @param _package Zip archive file which contains a spec.yaml
	 * @param [options] Override http request options.
	 */
	public createApp(_package: Buffer, options: any = {}): Promise<{ response: http.IncomingMessage; body?: any; }> {
		const localVarPath = this.basePath + '/app';
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		// verify required parameter '_package' is not null or undefined
		if (_package === null || _package === undefined) {
			throw new Error('Required parameter _package was null or undefined when calling createApp.');
		}

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		if (_package !== undefined) {
			localVarFormParams['package'] = _package;
		}
		localVarUseFormData = true;

		let localVarRequestOptions: request.Options = {
			method: 'POST',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body?: any; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}

	/**
	 * @param _package Zip archive file which contains a spec.yaml
	 * @param [options] Override http request options.
	 */
	public updateApp(_package: Buffer, options: any = {}): Promise<{ response: http.IncomingMessage; body?: any; }> {
		const localVarPath = this.basePath + '/app';
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		// verify required parameter '_package' is not null or undefined
		if (_package === null || _package === undefined) {
			throw new Error('Required parameter _package was null or undefined when calling updateApp.');
		}

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		if (_package !== undefined) {
			localVarFormParams['package'] = _package;
		}
		localVarUseFormData = true;

		let localVarRequestOptions: request.Options = {
			method: 'PATCH',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body?: any; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}
}
export enum CertificateRouterApiApiKeys {
}

export class CertificateRouterApi {
	protected _basePath = defaultBasePath;
	protected defaultHeaders: any = {};
	protected _useQuerystring: boolean = false;

	protected authentications = {
		'default': <Authentication>new VoidAuth(),
		'basic': new HttpBasicAuth()
	};

	constructor(basePath?: string);
	constructor(username: string, password: string, basePath?: string);
	constructor(basePathOrUsername: string, password?: string, basePath?: string) {
		if (password) {
			this.username = basePathOrUsername;
			this.password = password;
			if (basePath) {
				this.basePath = basePath;
			}
		} else {
			if (basePathOrUsername) {
				this.basePath = basePathOrUsername;
			}
		}
	}

	set useQuerystring(value: boolean) {
		this._useQuerystring = value;
	}

	set basePath(basePath: string) {
		this._basePath = basePath;
	}

	get basePath() {
		return this._basePath;
	}

	public setDefaultAuthentication(auth: Authentication) {
		this.authentications.default = auth;
	}

	public setApiKey(key: CertificateRouterApiApiKeys, value: string) {
		(this.authentications as any)[CertificateRouterApiApiKeys[key]].apiKey = value;
	}
	set username(username: string) {
		this.authentications.basic.username = username;
	}

	set password(password: string) {
		this.authentications.basic.password = password;
	}

	/**
	 * @param [options] Override http request options.
	 */
	public certificatesRootcaGet(options: any = {}): Promise<{ response: http.IncomingMessage; body?: any; }> {
		const localVarPath = this.basePath + '/certificates/rootca';
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'GET',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body?: any; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}
}

export enum EndpointRouterApiApiKeys {
}

export class EndpointRouterApi {
	protected _url = defaultBasePath;
	protected _defaultHeaders: any = {};
	protected _useQuerystring: boolean = false;
	protected _ignoreSslVerification: boolean = false;

	protected _authentications = {
		'default': <Authentication>new VoidAuth(),
		'basic': new HttpBasicAuth()
	};

	constructor(url?: string);
	constructor(username: string, password: string, url?: string);
	constructor(urlOrUsername: string, password?: string, url?: string) {
		if (password) {
			this.username = urlOrUsername;
			this.password = password;
			if (url) {
				this.url = url;
			}
		} else {
			if (urlOrUsername) {
				this.url = urlOrUsername;
			}
		}
	}

	set useQuerystring(value: boolean) {
		this._useQuerystring = value;
	}

	set ignoreSslVerification(ignoreSslVerification: boolean) {
		this._ignoreSslVerification = ignoreSslVerification;
	}

	set url(url: string) {
		this._url = url;
	}

	get url() {
		return this._url;
	}

	public setDefaultAuthentication(auth: Authentication) {
		this._authentications.default = auth;
	}

	public setApiKey(key: EndpointRouterApiApiKeys, value: string) {
		(this._authentications as any)[EndpointRouterApiApiKeys[key]].apiKey = value;
	}

	set username(username: string) {
		this._authentications.basic.username = username;
	}

	set password(password: string) {
		this._authentications.basic.password = password;
	}

	/**
	 * @param [options] Override http request options.
	 */
	public endpointsGet(options: request.Options = {}): Promise<{ response: http.IncomingMessage; body: Array<EndpointModel>; }> {
		return this.endpointsGetInternal(undefined, options);
	}

	/**
	 * @param name endpoint name,
	 * @param [options] Override http request options.
	 */
	public endpointsByNameGet(name: string, options: request.Options = {}): Promise<{ response: http.IncomingMessage; body: Array<EndpointModel>; }> {
		// verify required parameter 'name' is not null or undefined
		if (name === null || name === undefined) {
			throw new Error('Required parameter name was null or undefined when calling endpointsByNameGet.');
		}
		return this.endpointsGetInternal(name, options);
	}

	private endpointsGetInternal(name?: string, options: request.Options = {}): Promise<{ response: http.IncomingMessage; body: Array<EndpointModel>; }> {
		const targetUri = this.url + '/endpoints' + (name ? `/${name}` : '');
		let requestOptions: request.Options = {
			method: 'GET',
			qs: {},
			headers: {},
			uri: targetUri,
			useQuerystring: this._useQuerystring,
			json: true,
			agentOptions: {
				rejectUnauthorized: !this._ignoreSslVerification
			}
		};
		if (Object.keys(options).length) {
			requestOptions = Object.assign(requestOptions, options);
		}

		this._authentications.basic.applyToRequest(requestOptions);
		this._authentications.default.applyToRequest(requestOptions);

		return new Promise<{ response: http.IncomingMessage; body: Array<EndpointModel>; }>((resolve, reject) => {
			request(requestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					body = ObjectSerializer.deserialize(body, 'Array<EndpointModel>');
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}
}

export enum FileRouterApiApiKeys {
}

export class FileRouterApi {
	protected _basePath = defaultBasePath;
	protected defaultHeaders: any = {};
	protected _useQuerystring: boolean = false;

	protected authentications = {
		'default': <Authentication>new VoidAuth(),
		'basic': new HttpBasicAuth()
	};

	constructor(basePath?: string);
	constructor(username: string, password: string, basePath?: string);
	constructor(basePathOrUsername: string, password?: string, basePath?: string) {
		if (password) {
			this.username = basePathOrUsername;
			this.password = password;
			if (basePath) {
				this.basePath = basePath;
			}
		} else {
			if (basePathOrUsername) {
				this.basePath = basePathOrUsername;
			}
		}
	}

	set useQuerystring(value: boolean) {
		this._useQuerystring = value;
	}

	set basePath(basePath: string) {
		this._basePath = basePath;
	}

	get basePath() {
		return this._basePath;
	}

	public setDefaultAuthentication(auth: Authentication) {
		this.authentications.default = auth;
	}

	public setApiKey(key: FileRouterApiApiKeys, value: string) {
		(this.authentications as any)[FileRouterApiApiKeys[key]].apiKey = value;
	}
	set username(username: string) {
		this.authentications.basic.username = username;
	}

	set password(password: string) {
		this.authentications.basic.password = password;
	}

	/**
	 * @param filePath filePath
	 * @param op op
	 * @param [options] Override http request options.
	 */
	public filesByFilePathGet(filePath: string, op?: string, options: any = {}): Promise<{ response: http.IncomingMessage; body?: any; }> {
		const localVarPath = this.basePath + '/files/{filePath}'
			.replace('{filePath}', encodeURIComponent(String(filePath)));
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		// verify required parameter 'filePath' is not null or undefined
		if (filePath === null || filePath === undefined) {
			throw new Error('Required parameter filePath was null or undefined when calling filesByFilePathGet.');
		}

		if (op !== undefined) {
			localVarQueryParameters['op'] = ObjectSerializer.serialize(op, 'string');
		}

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'GET',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body?: any; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}
}
export enum HealthRouterApiApiKeys {
}

export class HealthRouterApi {
	protected _basePath = defaultBasePath;
	protected defaultHeaders: any = {};
	protected _useQuerystring: boolean = false;

	protected authentications = {
		'default': <Authentication>new VoidAuth(),
		'basic': new HttpBasicAuth()
	};

	constructor(basePath?: string);
	constructor(username: string, password: string, basePath?: string);
	constructor(basePathOrUsername: string, password?: string, basePath?: string) {
		if (password) {
			this.username = basePathOrUsername;
			this.password = password;
			if (basePath) {
				this.basePath = basePath;
			}
		} else {
			if (basePathOrUsername) {
				this.basePath = basePathOrUsername;
			}
		}
	}

	set useQuerystring(value: boolean) {
		this._useQuerystring = value;
	}

	set basePath(basePath: string) {
		this._basePath = basePath;
	}

	get basePath() {
		return this._basePath;
	}

	public setDefaultAuthentication(auth: Authentication) {
		this.authentications.default = auth;
	}

	public setApiKey(key: HealthRouterApiApiKeys, value: string) {
		(this.authentications as any)[HealthRouterApiApiKeys[key]].apiKey = value;
	}
	set username(username: string) {
		this.authentications.basic.username = username;
	}

	set password(password: string) {
		this.authentications.basic.password = password;
	}

	/**
	 * @param query query
	 * @param [options] Override http request options.
	 */
	public healthGet(query?: string, options: any = {}): Promise<{ response: http.IncomingMessage; body?: any; }> {
		const localVarPath = this.basePath + '/health';
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		if (query !== undefined) {
			localVarQueryParameters['query'] = ObjectSerializer.serialize(query, 'string');
		}

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'GET',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body?: any; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}

	/**
	 * @param [options] Override http request options.
	 */
	public healthPost(options: any = {}): Promise<{ response: http.IncomingMessage; body?: any; }> {
		const localVarPath = this.basePath + '/health';
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'POST',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body?: any; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}
}

export enum TokenRouterApiApiKeys {
}

export class TokenRouterApi {
	protected _basePath = defaultBasePath;
	protected defaultHeaders: any = {};
	protected _useQuerystring: boolean = false;

	protected authentications = {
		'default': <Authentication>new VoidAuth(),
		'basic': new HttpBasicAuth()
	};

	constructor(basePath?: string);
	constructor(username: string, password: string, basePath?: string);
	constructor(basePathOrUsername: string, password?: string, basePath?: string) {
		if (password) {
			this.username = basePathOrUsername;
			this.password = password;
			if (basePath) {
				this.basePath = basePath;
			}
		} else {
			if (basePathOrUsername) {
				this.basePath = basePathOrUsername;
			}
		}
	}

	set useQuerystring(value: boolean) {
		this._useQuerystring = value;
	}

	set basePath(basePath: string) {
		this._basePath = basePath;
	}

	get basePath() {
		return this._basePath;
	}

	public setDefaultAuthentication(auth: Authentication) {
		this.authentications.default = auth;
	}

	public setApiKey(key: TokenRouterApiApiKeys, value: string) {
		(this.authentications as any)[TokenRouterApiApiKeys[key]].apiKey = value;
	}
	set username(username: string) {
		this.authentications.basic.username = username;
	}

	set password(password: string) {
		this.authentications.basic.password = password;
	}

	/**
	 * @param [options] Override http request options.
	 */
	public tokenPost(options: any = {}): Promise<{ response: http.IncomingMessage; body: TokenModel; }> {
		const localVarPath = this.basePath + '/token';
		let localVarQueryParameters: any = {};
		let localVarHeaderParams: any = (<any>Object).assign({}, this.defaultHeaders);
		let localVarFormParams: any = {};

		localVarHeaderParams = (<any>Object).assign(localVarHeaderParams, options.headers);

		let localVarUseFormData = false;

		let localVarRequestOptions: request.Options = {
			method: 'POST',
			qs: localVarQueryParameters,
			headers: localVarHeaderParams,
			uri: localVarPath,
			useQuerystring: this._useQuerystring,
			json: true,
		};

		this.authentications.basic.applyToRequest(localVarRequestOptions);

		this.authentications.default.applyToRequest(localVarRequestOptions);

		if (Object.keys(localVarFormParams).length) {
			if (localVarUseFormData) {
				(<any>localVarRequestOptions).formData = localVarFormParams;
			} else {
				localVarRequestOptions.form = localVarFormParams;
			}
		}
		return new Promise<{ response: http.IncomingMessage; body: TokenModel; }>((resolve, reject) => {
			request(localVarRequestOptions, (error, response, body) => {
				if (error) {
					reject(error);
				} else {
					body = ObjectSerializer.deserialize(body, 'TokenModel');
					if (response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
						resolve({ response: response, body: body });
					} else {
						reject({ response: response, body: body });
					}
				}
			});
		});
	}
}
