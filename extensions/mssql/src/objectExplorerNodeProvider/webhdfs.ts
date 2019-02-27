/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as util from 'util';
import * as url from 'url';
import * as fs from 'fs';
import * as querystring from 'querystring';
import * as request from 'request';
import * as BufferStreamReader from 'buffer-stream-reader';
import * as nls from 'vscode-nls';
import { IHdfsOptions, IRequestParams } from './fileSources';

const localize = nls.loadMessageBundle();

export class WebHDFS {
	private _requestParams: IRequestParams;
	private _opts: IHdfsOptions;
	private _url: any;

	private static ErrorMessageInvalidDataStructure =
		localize('webhdfs.invalidDataStructure', 'Invalid Data Structure');

	constructor(opts: IHdfsOptions, requestParams: IRequestParams) {
		if (!(this instanceof WebHDFS)) {
			return new WebHDFS(opts, requestParams);
		}

		let missingProps = ['host', 'port', 'path']
			.filter(p => !opts.hasOwnProperty(p));
		if (missingProps && missingProps.length > 0) {
			throw new Error(
				util.format(
					localize('webhdfs.missingProperties',
						'Unable to create WebHDFS client: missing options: %s'),
					missingProps.join(', ')
				)
			);
		}

		this._requestParams = requestParams;
		this._opts = opts;
		this._url = {
			protocol: opts.protocol || 'http',
			hostname: opts.host,
			port: opts.port || 80,
			pathname: opts.path
		};
	}

	private checkArgUndefined(argName: string, argValue: any): void {
		if (!argValue) {
			throw new Error(
				util.format(
					localize('webhdfs.undefinedArgument', '\'%s\' is undefined.'),
					argName
				)
			);
		}
	}

	/**
	 * Generate WebHDFS REST API endpoint URL for given operation
	 *
	 * @param {string} operation WebHDFS operation name
	 * @param {string} path
	 * @param {object} params
	 * @returns {string} WebHDFS REST API endpoint URL
	 */
	private getOperationEndpoint(operation: string, path: string, params?: object): string {
		let endpoint = this._url;
		endpoint.pathname = this._opts.path + path;
		let searchOpts = Object.assign(
			{ 'op': operation },
			this._opts.user ? { 'user.name': this._opts.user } : {},
			params || {}
		);
		endpoint.search = querystring.stringify(searchOpts);
		return url.format(endpoint);
	}

	/**
	 * Gets localized status message for given status code
	 *
	 * @param {number} statusCode Http status code
	 * @returns {string} Status message
	 */
	private toStatusMessage(statusCode: number): string {
		let statusMessage: string = undefined;
		switch (statusCode) {
			case 400: statusMessage = localize('webhdfs.httpError400', 'Bad Request'); break;
			case 401: statusMessage = localize('webhdfs.httpError401', 'Unauthorized'); break;
			case 403: statusMessage = localize('webhdfs.httpError403', 'Forbidden'); break;
			case 404: statusMessage = localize('webhdfs.httpError404', 'Not Found'); break;
			case 500: statusMessage = localize('webhdfs.httpError500', 'Internal Server Error'); break;
			// TODO: define more messages here
			default: break;
		}
		return statusMessage;
	}

	/**
	 * Retrieve error message from response
	 *
	 * @param {request.Response} response Response
	 * @param {boolean} strict If set true then RemoteException must be present in the body
	 * @returns {string} Error message
	 */
	private retrieveErrorMessage(response: request.Response, strict: boolean = false): string {
		let errorMessage: string = undefined;
		if (!strict) {
			errorMessage = this.toStatusMessage(response.statusCode);
		} else {
			let responseBody = response.body;
			if (typeof responseBody === 'string') {
				try {
					responseBody = JSON.parse(responseBody);
				} catch { }
			}

			if (responseBody && responseBody.hasOwnProperty('RemoteException')) {
				errorMessage = responseBody.RemoteException.message;
			}
		}

		if (!errorMessage) {
			errorMessage = localize('webhdfs.unknownError', 'Unknown Error');
		}

		return errorMessage;
	}

	/**
	 * Parse error state from response and return valid Error object
	 *
	 * @param {request.Response} response Response
	 * @param {boolean} strict If set true then RemoteException must be present in the body
	 * @returns {Error} Error object
	 */
	private parseError(response: request.Response, strict: boolean = false): Error {
		let errorMessage: string = this.retrieveErrorMessage(response, strict);
		return new Error(errorMessage);
	}

	/**
	 * Check if response is redirect
	 *
	 * @param {request.Response} response response
	 * @returns {boolean} if response is redirect
	 */
	private isRedirect(response: request.Response): boolean {
		return [301, 307].indexOf(response.statusCode) !== -1 &&
			response.headers.hasOwnProperty('location');
	}

	/**
	 * Check if response is successful
	 *
	 * @param {request.Response} response response
	 * @returns {boolean} if response is successful
	 */
	private isSuccess(response: request.Response): boolean {
		return [200, 201].indexOf(response.statusCode) !== -1;
	}

	/**
	 * Check if response is error
	 *
	 * @param {request.Response} response response
	 * @returns {boolean} if response is error
	 */
	private isError(response: request.Response): boolean {
		return [400, 401, 402, 403, 404, 500].indexOf(response.statusCode) !== -1;
	}

	/**
	 * Send a request to WebHDFS REST API
	 *
	 * @param {string} method HTTP method
	 * @param {string} url
	 * @param {object} opts Options for request
	 * @param {(error: any, response: request.Response, body: any) => void} callback
	 * @returns void
	 */
	private sendRequest(method: string, url: string, opts: object,
		callback: (error: any, response: request.Response, body: any) => void): void {

		let requestParams = Object.assign(
			{ method: method, url: url, json: true },
			this._requestParams,
			opts || {}
		);

		request(requestParams, (error, response, body) => {
			if (!callback) { return; }
			if (error) {
				callback(error, undefined, undefined);
			} else if (this.isError(response)) {
				callback(this.parseError(response), undefined, undefined);
			} else if (this.isSuccess(response)) {
				callback(error, response, body);
			} else {
				let errorMessage = localize('webhdfs.unexpectedRedirect', 'Unexpected Redirect');
				callback(new Error(errorMessage), response, body);
			}
		});
	}

	/**
	 * Change file permissions
	 *
	 * @param {string} path
	 * @param {string} mode
	 * @param {(error: any) => void} callback
	 * @returns void
	 */
	public chmod(path: string, mode: string, callback: (error: any) => void): void {
		this.checkArgUndefined('path', path);
		this.checkArgUndefined('mode', mode);

		let endpoint = this.getOperationEndpoint('setpermission', path, { permission: mode });
		this.sendRequest('PUT', endpoint, undefined, (error) => {
			return callback && callback(error);
		});
	}

	/**
	 * Change file owner
	 *
	 * @param {string} path
	 * @param {string} userId User name
	 * @param {string} groupId Group name
	 * @param {(error: any) => void} callback
	 * @returns void
	 */
	public chown(path: string, userId: string, groupId: string, callback: (error: any) => void): void {
		this.checkArgUndefined('path', path);
		this.checkArgUndefined('userId', userId);
		this.checkArgUndefined('groupId', groupId);

		let endpoint = this.getOperationEndpoint('setowner', path, {
			owner: userId,
			group: groupId
		});

		this.sendRequest('PUT', endpoint, undefined, (error) => {
			if (callback) {
				callback(error);
			}
		});
	}

	/**
	 * Read directory contents
	 *
	 * @param {string} path
	 * @param {(error: any, files: any[]) => void)} callback
	 * @returns void
	 */
	public readdir(path: string, callback: (error: any, files: any[]) => void): void {
		this.checkArgUndefined('path', path);

		let endpoint = this.getOperationEndpoint('liststatus', path);
		this.sendRequest('GET', endpoint, undefined, (error, response) => {
			if (!callback) { return; }

			let files: any[] = [];
			if (error) {
				callback(error, undefined);
			} else if (response.body.hasOwnProperty('FileStatuses')
				&& response.body.FileStatuses.hasOwnProperty('FileStatus')) {
				files = response.body.FileStatuses.FileStatus;
				callback(undefined, files);
			} else {
				callback(new Error(WebHDFS.ErrorMessageInvalidDataStructure), undefined);
			}
		});
	}

	/**
	 * Make new directory
	 *
	 * @param {string} path
	 * @param {string} [permission=0755]
	 * @param {Function} callback
	 * @returns void
	 */
	public mkdir(path: string, permission: string = '0755', callback: (error: any) => void): void {
		this.checkArgUndefined('path', path);

		let endpoint = this.getOperationEndpoint('mkdirs', path, {
			permission: permission
		});

		this.sendRequest('PUT', endpoint, undefined, (error) => {
			if (callback) {
				callback(error);
			}
		});
	}

	/**
	 * Rename path
	 *
	 * @param {string} path
	 * @param {string} destination
	 * @param {(error: any) => void} callback
	 * @returns void
	 */
	public rename(path: string, destination: string, callback: (error: any) => void): void {
		this.checkArgUndefined('path', path);
		this.checkArgUndefined('destination', destination);

		let endpoint = this.getOperationEndpoint('rename', path, {
			destination: destination
		});

		this.sendRequest('PUT', endpoint, undefined, (error) => {
			if (callback) {
				callback(error);
			}
		});
	}

	/**
	 * Get file status for given path
	 *
	 * @param {string} path
	 * @param {(error: any, fileStatus: any) => void} callback
	 * @returns void
	 */
	public stat(path: string, callback: (error: any, fileStatus: any) => void): void {
		this.checkArgUndefined('path', path);

		let endpoint = this.getOperationEndpoint('getfilestatus', path);
		this.sendRequest('GET', endpoint, undefined, (error, response) => {
			if (!callback) { return; }
			if (error) {
				callback(error, undefined);
			} else if (response.body.hasOwnProperty('FileStatus')) {
				callback(undefined, response.body.FileStatus);
			} else {
				callback(new Error(WebHDFS.ErrorMessageInvalidDataStructure), undefined);
			}
		});
	}

	/**
	 * Check file existence
	 * Wraps stat method
	 *
	 * @see WebHDFS.stat
	 * @param {string} path
	 * @param {(error: any, exists: boolean) => void} callback
	 * @returns void
	 */
	public exists(path: string, callback: (error: any, exists: boolean) => void): void {
		this.checkArgUndefined('path', path);

		this.stat(path, (error, fileStatus) => {
			let exists = !fileStatus ? false : true;
			callback(error, exists);
		});
	}

	/**
	 * Write data to the file
	 *
	 * @param {string} path
	 * @param {string | Buffer} data
	 * @param {boolean} append If set to true then append data to the file
	 * @param {object} opts
	 * @param {(error: any) => void} callback
	 * @returns {fs.WriteStream}
	 */
	public writeFile(path: string, data: string | Buffer, append: boolean, opts: object,
		callback: (error: any) => void): fs.WriteStream {
		this.checkArgUndefined('path', path);
		this.checkArgUndefined('data', data);

		let error: any = null;
		let localStream = new BufferStreamReader(data);
		let remoteStream: fs.WriteStream = this.createWriteStream(path, !!append, opts || {});

		// Handle events
		remoteStream.once('error', (err) => {
			error = err;
		});

		remoteStream.once('finish', () => {
			if (callback && error) {
				callback(error);
			}
		});

		localStream.pipe(remoteStream); // Pipe data
		return remoteStream;
	}

	/**
	 * Append data to the file
	 *
	 * @see writeFile
	 * @param {string} path
	 * @param {string | Buffer} data
	 * @param {object} opts
	 * @param {(error: any) => void} callback
	 * @returns {fs.WriteStream}
	 */
	public appendFile(path: string, data: string | Buffer, opts: object, callback: (error: any) => void): fs.WriteStream {
		return this.writeFile(path, data, true, opts, callback);
	}

	/**
	 * Read data from the file
	 *
	 * @fires Request#data
	 * @fires WebHDFS#finish
	 * @param {path} path
	 * @param {(error: any, buffer: Buffer) => void} callback
	 * @returns void
	 */
	public readFile(path: string, callback: (error: any, buffer: Buffer) => void): void {
		this.checkArgUndefined('path', path);

		let remoteFileStream = this.createReadStream(path);
		let data: any[] = [];
		let error: any = undefined;

		remoteFileStream.once('error', (err) => {
			error = err;
		});

		remoteFileStream.on('data', (dataChunk) => {
			data.push(dataChunk);
		});

		remoteFileStream.once('finish', function () {
			if (!callback) { return; }
			if (!error) {
				callback(undefined, Buffer.concat(data));
			} else {
				callback(error, undefined);
			}
		});
	}

	/**
	 * Create writable stream for given path
	 *
	 * @fires WebHDFS#finish
	 * @param {string} path
	 * @param {boolean} [append] If set to true then append data to the file
	 * @param {object} [opts]
	 * @returns {fs.WriteStream}
	 *
	 * @example
	 * let hdfs = WebHDFS.createClient();
	 *
	 * let localFileStream = hdfs.createReadStream('/path/to/local/file');
	 * let remoteFileStream = hdfs.createWriteStream('/path/to/remote/file');
	 *
	 * localFileStream.pipe(remoteFileStream);
	 *
	 * remoteFileStream.on('error', function onError (err) {
	 *   // Do something with the error
	 * });
	 *
	 * remoteFileStream.on('finish', function onFinish () {
	 *  // Upload is done
	 * });
	 */
	public createWriteStream(path: string, append?: boolean, opts?: object): fs.WriteStream {
		this.checkArgUndefined('path', path);

		let emitError = (instance, err) => {
			const isErrorEmitted = instance.errorEmitted;

			if (!isErrorEmitted) {
				instance.emit('error', err);
				instance.emit('finish');
			}

			instance.errorEmitted = true;
		};

		let endpoint = this.getOperationEndpoint(
			append ? 'append' : 'create',
			path,
			Object.assign(
				{
					overwrite: true,
					permission: '0755'
				},
				opts || {}
			)
		);

		let stream = undefined;
		let canResume: boolean = true;
		let params = Object.assign(
			{
				method: append ? 'POST' : 'PUT',
				url: endpoint,
				json: true,
				headers: { 'content-type': 'application/octet-stream' }
			},
			this._requestParams
		);

		let req = request(params, (error, response, body) => {
			// Handle redirect only if there was not an error (e.g. res is defined)
			if (response && this.isRedirect(response)) {
				let upload = request(
					Object.assign(params, { url: response.headers.location }),
					(err, res, bo) => {
						if (err || this.isError(res)) {
							err = err || this.parseError(res);
							emitError(req, err);
							req.end();
						} else if (res.headers.hasOwnProperty('location')) {
							req.emit('finish', res.headers.location);
						} else {
							req.emit('finish');
						}
					}
				);
				canResume = true; // Enable resume
				stream.pipe(upload);
				stream.resume();
			}

			if (error || this.isError(response)) {
				emitError(req, error || this.parseError(response));
			}
		});

		req.on('pipe', (src) => {
			// Pause read stream
			stream = src;
			stream.pause();

			// This is not an elegant solution but here we go
			// Basically we don't allow pipe() method to resume reading input
			// and set internal _readableState.flowing to false
			canResume = false;
			stream.on('resume', () => {
				if (!canResume) {
					stream._readableState.flowing = false;
				}
			});

			// Unpipe initial request
			src.unpipe(req);
			req.end();
		});

		return <fs.WriteStream><any>req;
	}

	/**
	 * Create readable stream for given path
	 *
	 * @fires Request#data
	 * @fires WebHDFS#finish
	 * @param {string} path
	 * @param {object} [opts]
	 * @returns {fs.ReadStream}
	 *
	 * @example
	 * let hdfs = WebHDFS.createClient();
	 *
	 * let remoteFileStream = hdfs.createReadStream('/path/to/remote/file');
	 *
	 * remoteFileStream.on('error', function onError (err) {
	 *  // Do something with the error
	 * });
	 *
	 * remoteFileStream.on('data', function onChunk (chunk) {
	 *  // Do something with the data chunk
	 * });
	 *
	 * remoteFileStream.on('finish', function onFinish () {
	 *  // Upload is done
	 * });
	 */
	public createReadStream(path: string, opts?: object): fs.ReadStream {
		this.checkArgUndefined('path', path);

		let endpoint = this.getOperationEndpoint('open', path, opts);
		let params = Object.assign(
			{
				method: 'GET',
				url: endpoint,
				json: true
			},
			this._requestParams);

		let req: request.Request = request(params);

		req.on('complete', (response) => {
			req.emit('finish');
		});

		req.on('response', (response) => {
			// Handle remote exceptions
			// Remove all data handlers and parse error data
			if (this.isError(response)) {
				req.removeAllListeners('data');
				req.on('data', function onData(data) {
					req.emit('error', this.parseError(data.toString(), false, response.statusCode));
					req.end();
				});
			} else if (this.isRedirect(response)) {
				let download = request(params);

				download.on('complete', (response) => {
					req.emit('finish');
				});

				// Proxy data to original data handler
				// Not the nicest way but hey
				download.on('data', (dataChunk) => {
					req.emit('data', dataChunk);
				});

				// Handle subrequest
				download.on('response', function onResponse(response) {
					if (this.isError(response)) {
						download.removeAllListeners('data');
						download.on('data', function onData(data) {
							req.emit('error', this._parseError(data.toString()));
							req.end();
						});
					}
				});
			}

			// No need to interrupt the request
			// data will be automatically sent to the data handler
		});

		return <fs.ReadStream><any>req;
	}

	/**
	 * Create symbolic link to the destination path
	 *
	 * @param {string} src
	 * @param {string} destination
	 * @param {boolean} [createParent=false]
	 * @param {(error: any) => void} callback
	 * @returns void
	 */
	public symlink(src: string, destination: string, createParent: boolean, callback: (error: any) => void): void {
		this.checkArgUndefined('src', src);
		this.checkArgUndefined('destination', destination);

		let endpoint = this.getOperationEndpoint('createsymlink', src, {
			createParent: !!createParent,
			destination: destination
		});

		this.sendRequest('PUT', endpoint, undefined, (error) => {
			if (callback) {
				callback(error);
			}
		});
	}

	/**
	 * Unlink path
	 *
	 * @param {string} path
	 * @param {boolean} [recursive=false]
	 * @param {(error: any) => void} callback
	 * @returns void
	 */
	public unlink(path: string, recursive: boolean = false, callback: (error: any) => void): void {
		this.checkArgUndefined('path', path);

		let endpoint = this.getOperationEndpoint('delete', path, { recursive: !!recursive });
		this.sendRequest('DELETE', endpoint, undefined, (error) => {
			if (callback) {
				callback(error);
			}
		});
	}

	/**
	 * @alias WebHDFS.unlink
	 * @param {string} path
	 * @param {boolean} [recursive=false]
	 * @param {(error: any) => void} callback
	 * @returns void
	 */
	public rmdir(path: string, recursive: boolean = false, callback: (error: any) => void): void {
		this.unlink(path, recursive, callback);
	}

	public static createClient(opts, requestParams): WebHDFS {
		return new WebHDFS(
			Object.assign(
				{
					host: 'localhost',
					port: '50070',
					path: '/webhdfs/v1'
				},
				opts
			),
			requestParams
		);
	}
}
