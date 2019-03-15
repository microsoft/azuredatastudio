// This code is originally from https://github.com/harrisiirak/webhdfs
// License: https://github.com/harrisiirak/webhdfs/blob/master/LICENSE

'use strict';

import * as url from 'url';
import * as fs from 'fs';
import * as querystring from 'querystring';
import * as request from 'request';
import * as BufferStreamReader from 'buffer-stream-reader';
import * as nls from 'vscode-nls';
import { IHdfsOptions, IRequestParams } from './fileSources';

const localize = nls.loadMessageBundle();
const ErrorMessageInvalidDataStructure =
	localize('webhdfs.invalidDataStructure', 'Invalid Data Structure');

export class WebHDFS {
	private _requestParams: IRequestParams;
	private _opts: IHdfsOptions;
	private _url: any;

	constructor(opts: IHdfsOptions, requestParams: IRequestParams) {
		if (!(this instanceof WebHDFS)) {
			return new WebHDFS(opts, requestParams);
		}

		let missingProps = ['host', 'port', 'path']
			.filter(p => !opts.hasOwnProperty(p) || !opts[p]);
		if (missingProps && missingProps.length > 0) {
			throw new Error(localize('webhdfs.missingProperties',
				'Unable to create WebHDFS client due to missing options: ${0}', missingProps.join(', ')));
		}

		this._requestParams = requestParams || {};
		this._requestParams.timeout = this._requestParams.timeout || 10000;

		this._opts = opts;
		this._url = {
			protocol: opts.protocol || 'http',
			hostname: opts.host.trim(),
			port: opts.port || 80,
			pathname: opts.path
		};
	}

	private checkArgDefined(argName: string, argValue: any): void {
		if (!argValue) {
			throw new Error(localize('webhdfs.undefinedArgument', '\'${0}\' is undefined.', argName));
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
		return encodeURI(url.format(endpoint));
	}

	/**
	 * Gets localized status message for given status code
	 *
	 * @param {number} statusCode Http status code
	 * @returns {string} status message
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
	 * Gets status message from response
	 *
	 * @param {request.Response} response response object
	 * @param {boolean} strict If set true then RemoteException must be present in the body
	 * @returns {string} Error message interpreted by status code
	 */
	private getStatusMessage(response: request.Response): string {
		if (!response) { return undefined; }
		let statusMessage: string = this.toStatusMessage(response.statusCode)
			|| (response && response.statusMessage);
		return statusMessage;
	}

	/**
	 * Gets remote exception message from response body
	 *
	 * @param {any} responseBody response body
	 * @returns {string} Error message interpreted by status code
	 */
	private getRemoteExceptionMessage(responseBody: any): string {
		if (!responseBody) { return undefined; }
		if (typeof responseBody === 'string') {
			try {
				responseBody = JSON.parse(responseBody);
			} catch { }
		}
		let remoteExceptionMessage: string = undefined;
		if (responseBody.hasOwnProperty('RemoteException')
			&& responseBody.RemoteException.hasOwnProperty('message')) {
			remoteExceptionMessage = responseBody.RemoteException.message;
		}
		return remoteExceptionMessage;
	}

	/**
	 * Generates error message descriptive as much as possible
	 *
	 * @param {string} statusMessage status message
	 * @param {string} [remoteExceptionMessage] remote exception message
	 * @param {any} [error] error
	 * @returns {string} error message
	 */
	private getErrorMessage(statusMessage: string, remoteExceptionMessage?: string, error?: any): string {
		statusMessage = statusMessage === '' ? undefined : statusMessage;
		remoteExceptionMessage = remoteExceptionMessage === '' ? undefined : remoteExceptionMessage;
		let messageFromError: string = error ? (error['message'] || error.toString()) : undefined;
		return statusMessage && remoteExceptionMessage ?
			`${statusMessage} (${remoteExceptionMessage})` :
			statusMessage || remoteExceptionMessage || messageFromError ||
				localize('webhdfs.unknownError', 'Unknown Error');
	}

	/**
	 * Parse error state from response and return valid Error object
	 *
	 * @param {request.Response} response response object
	 * @param {any} [responseBody] response body
	 * @param {any} [error] error
	 * @returns {HdfsError} HdfsError object
	 */
	private parseError(response: request.Response, responseBody?: any, error?: any): HdfsError {
		let statusMessage: string = this.getStatusMessage(response);
		if (!responseBody && response) {
			responseBody = response.body;
		}
		let remoteExceptionMessage: string = this.getRemoteExceptionMessage(responseBody);
		let errorMessage: string = this.getErrorMessage(statusMessage, remoteExceptionMessage, error);
		return new HdfsError(errorMessage, response && response.statusCode,
			response && response.statusMessage, remoteExceptionMessage, error);
	}

	/**
	 * Check if response is redirect
	 *
	 * @param {request.Response} response response object
	 * @returns {boolean} if response is redirect
	 */
	private isRedirect(response: request.Response): boolean {
		return [301, 307].indexOf(response.statusCode) !== -1 &&
			response.headers.hasOwnProperty('location');
	}

	/**
	 * Check if response is successful
	 *
	 * @param {request.Response} response response object
	 * @returns {boolean} if response is successful
	 */
	private isSuccess(response: request.Response): boolean {
		return [200, 201].indexOf(response.statusCode) !== -1;
	}

	/**
	 * Check if response is error
	 *
	 * @param {request.Response} response response object
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
	 * @param {(error: HdfsError, response: request.Response) => void} callback
	 * @returns void
	 */
	private sendRequest(method: string, url: string, opts: object,
		callback: (error: HdfsError, response: request.Response) => void): void {

		let requestParams = Object.assign(
			{ method: method, url: url, json: true },
			this._requestParams,
			opts || {}
		);

		request(requestParams, (error, response, body) => {
			if (!callback) { return; }

			if (error || this.isError(response)) {
				let hdfsError = this.parseError(response, body, error);
				callback(hdfsError, response);
			} else if (this.isSuccess(response)) {
				callback(undefined, response);
			} else {
				let hdfsError = new HdfsError(
					localize('webhdfs.unexpectedRedirect', 'Unexpected Redirect'),
					response && response.statusCode,
					response && response.statusMessage,
					this.getRemoteExceptionMessage(body || response.body),
					error
				);
				callback(hdfsError, response);
			}
		});
	}

	/**
	 * Change file permissions
	 *
	 * @param {string} path
	 * @param {string} mode
	 * @param {(error: HdfsError) => void} callback
	 * @returns void
	 */
	public chmod(path: string, mode: string, callback: (error: HdfsError) => void): void {
		this.checkArgDefined('path', path);
		this.checkArgDefined('mode', mode);

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
	 * @param {(error: HdfsError) => void} callback
	 * @returns void
	 */
	public chown(path: string, userId: string, groupId: string, callback: (error: HdfsError) => void): void {
		this.checkArgDefined('path', path);
		this.checkArgDefined('userId', userId);
		this.checkArgDefined('groupId', groupId);

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
	 * @param {(error: HdfsError, files: any[]) => void)} callback
	 * @returns void
	 */
	public readdir(path: string, callback: (error: HdfsError, files: any[]) => void): void {
		this.checkArgDefined('path', path);

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
				callback(new HdfsError(ErrorMessageInvalidDataStructure), undefined);
			}
		});
	}

	/**
	 * Make new directory
	 *
	 * @param {string} path
	 * @param {string} [permission=0755]
	 * @param {(error: HdfsError) => void} callback
	 * @returns void
	 */
	public mkdir(path: string, permission: string = '0755', callback: (error: HdfsError) => void): void {
		this.checkArgDefined('path', path);

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
	 * @param {(error: HdfsError) => void} callback
	 * @returns void
	 */
	public rename(path: string, destination: string, callback: (error: HdfsError) => void): void {
		this.checkArgDefined('path', path);
		this.checkArgDefined('destination', destination);

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
	 * @param {(error: HdfsError, fileStatus: any) => void} callback
	 * @returns void
	 */
	public stat(path: string, callback: (error: HdfsError, fileStatus: any) => void): void {
		this.checkArgDefined('path', path);

		let endpoint = this.getOperationEndpoint('getfilestatus', path);
		this.sendRequest('GET', endpoint, undefined, (error, response) => {
			if (!callback) { return; }
			if (error) {
				callback(error, undefined);
			} else if (response.body.hasOwnProperty('FileStatus')) {
				callback(undefined, response.body.FileStatus);
			} else {
				callback(new HdfsError(ErrorMessageInvalidDataStructure), undefined);
			}
		});
	}

	/**
	 * Check file existence
	 * Wraps stat method
	 *
	 * @see WebHDFS.stat
	 * @param {string} path
	 * @param {(error: HdfsError, exists: boolean) => void} callback
	 * @returns void
	 */
	public exists(path: string, callback: (error: HdfsError, exists: boolean) => void): void {
		this.checkArgDefined('path', path);

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
	 * @param {(error: HdfsError) => void} callback
	 * @returns {fs.WriteStream}
	 */
	public writeFile(path: string, data: string | Buffer, append: boolean, opts: object,
		callback: (error: HdfsError) => void): fs.WriteStream {
		this.checkArgDefined('path', path);
		this.checkArgDefined('data', data);

		let error: HdfsError = null;
		let localStream = new BufferStreamReader(data);
		let remoteStream: fs.WriteStream = this.createWriteStream(path, !!append, opts || {});

		// Handle events
		remoteStream.once('error', (err) => {
			error = <HdfsError>err;
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
	 * @param {(error: HdfsError) => void} callback
	 * @returns {fs.WriteStream}
	 */
	public appendFile(path: string, data: string | Buffer, opts: object, callback: (error: HdfsError) => void): fs.WriteStream {
		return this.writeFile(path, data, true, opts, callback);
	}

	/**
	 * Read data from the file
	 *
	 * @fires Request#data
	 * @fires WebHDFS#finish
	 * @param {path} path
	 * @param {(error: HdfsError, buffer: Buffer) => void} callback
	 * @returns void
	 */
	public readFile(path: string, callback: (error: HdfsError, buffer: Buffer) => void): void {
		this.checkArgDefined('path', path);

		let remoteFileStream = this.createReadStream(path);
		let data: any[] = [];
		let error: HdfsError = undefined;

		remoteFileStream.once('error', (err) => {
			error = <HdfsError>err;
		});

		remoteFileStream.on('data', (dataChunk) => {
			data.push(dataChunk);
		});

		remoteFileStream.once('finish', () => {
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
	 * remoteFileStream.on('error', (err) => {
	 *	// Do something with the error
	 * });
	 *
	 * remoteFileStream.on('finish', () => {
	 *	// Upload is done
	 * });
	 */
	public createWriteStream(path: string, append?: boolean, opts?: object): fs.WriteStream {
		this.checkArgDefined('path', path);

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
							emitError(req, this.parseError(res, bo, err));
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

			if (error && !response) {
				// request failed, and req is not accessible in this case.
				throw this.parseError(undefined, undefined, error);
			}

			if (error || this.isError(response)) {
				emitError(req, this.parseError(response, body, error));
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
	 * remoteFileStream.on('error', (err) => {
	 *  // Do something with the error
	 * });
	 *
	 * remoteFileStream.on('data', (dataChunk) => {
	 *  // Do something with the data chunk
	 * });
	 *
	 * remoteFileStream.on('finish', () => {
	 *  // Upload is done
	 * });
	 */
	public createReadStream(path: string, opts?: object): fs.ReadStream {
		this.checkArgDefined('path', path);

		let endpoint = this.getOperationEndpoint('open', path, opts);
		let params = Object.assign(
			{
				method: 'GET',
				url: endpoint,
				json: true
			},
			this._requestParams
		);

		let req: request.Request = request(params);

		req.on('complete', (response) => {
			req.emit('finish');
		});

		req.on('response', (response) => {
			// Handle remote exceptions
			// Remove all data handlers and parse error data
			if (this.isError(response)) {
				req.removeAllListeners('data');
				req.on('data', (data) => {
					req.emit('error', this.parseError(response, data.toString()));
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
				download.on('response', (response) => {
					if (this.isError(response)) {
						download.removeAllListeners('data');
						download.on('data', (data) => {
							req.emit('error', this.parseError(response, data.toString()));
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
	 * @param {(error: HdfsError) => void} callback
	 * @returns void
	 */
	public symlink(src: string, destination: string, createParent: boolean = false, callback: (error: HdfsError) => void): void {
		this.checkArgDefined('src', src);
		this.checkArgDefined('destination', destination);

		let endpoint = this.getOperationEndpoint('createsymlink', src, {
			createParent: createParent,
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
	public unlink(path: string, recursive: boolean = false, callback: (error: HdfsError) => void): void {
		this.checkArgDefined('path', path);

		let endpoint = this.getOperationEndpoint('delete', path, { recursive: recursive });
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
	public rmdir(path: string, recursive: boolean = false, callback: (error: HdfsError) => void): void {
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
				opts || {}
			),
			requestParams
		);
	}
}

export class HdfsError extends Error {
	constructor(
		errorMessage: string,
		public statusCode?: number,
		public statusMessage?: string,
		public remoteExceptionMessage?: string,
		public internalError?: any) {
		super(errorMessage);
	}
}
