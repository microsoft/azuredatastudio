// This code is originally from https://github.com/harrisiirak/webhdfs
// License: https://github.com/harrisiirak/webhdfs/blob/master/LICENSE

import * as url from 'url';
import * as fs from 'fs';
import * as querystring from 'querystring';
import * as request from 'request';
import * as BufferStreamReader from 'buffer-stream-reader';
import { Cookie } from 'tough-cookie';
import * as through from 'through2';
import * as nls from 'vscode-nls';
import * as auth from '../util/auth';
import { IHdfsOptions, IRequestParams, FileType } from '../objectExplorerNodeProvider/fileSources';
import { PermissionStatus, AclEntry, parseAclList, PermissionType, parseAclPermissionFromOctal, AclEntryScope, AclType } from './aclEntry';
import { Mount } from './mount';
import { everyoneName, ownerPostfix, owningGroupPostfix } from '../localizedConstants';
import { FileStatus, parseHdfsFileType } from './fileStatus';
import { Readable, Transform } from 'stream';

const localize = nls.loadMessageBundle();
const ErrorMessageInvalidDataStructure = localize('webhdfs.invalidDataStructure', "Invalid Data Structure");

const emitError = (instance: request.Request | Transform, err: any) => {
	const isErrorEmitted = (instance as any).errorEmitted;

	if (!isErrorEmitted) {
		instance.emit('error', err);
		instance.emit('finish');
	}

	(instance as any).errorEmitted = true;
};

export class WebHDFS {
	private _requestParams: IRequestParams;
	private _opts: IHdfsOptions;
	private _url: any;
	private _authCookie: Cookie;
	constructor(opts: IHdfsOptions, requestParams: IRequestParams) {
		if (!(this instanceof WebHDFS)) {
			return new WebHDFS(opts, requestParams);
		}

		let missingProps = ['host', 'port', 'path']
			.filter((p: keyof IHdfsOptions) => !opts.hasOwnProperty(p) || !opts[p]);
		if (missingProps && missingProps.length > 0) {
			throw new Error(localize('webhdfs.missingProperties',
				"Unable to create WebHDFS client due to missing options: ${0}", missingProps.join(', ')));
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
			throw new Error(localize('webhdfs.undefinedArgument', "'${0}' is undefined.", argName));
		}
	}

	/**
	 * Generate WebHDFS REST API endpoint URL for given operation
	 *
	 * @param operation WebHDFS operation name
	 * @returns WebHDFS REST API endpoint URL
	 */
	private getOperationEndpoint(operation: string, path: string, params?: object): string {
		let endpoint = this._url;
		endpoint.pathname = encodeURI(this._opts.path + path);
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
	 * @param statusCode Http status code
	 * @returns status message
	 */
	private toStatusMessage(statusCode: number): string {
		let statusMessage: string = undefined;
		switch (statusCode) {
			case 400: statusMessage = localize('webhdfs.httpError400', "Bad Request"); break;
			case 401: statusMessage = localize('webhdfs.httpError401', "Unauthorized"); break;
			case 403: statusMessage = localize('webhdfs.httpError403', "Forbidden"); break;
			case 404: statusMessage = localize('webhdfs.httpError404', "Not Found"); break;
			case 500: statusMessage = localize('webhdfs.httpError500', "Internal Server Error"); break;
			// TODO: define more messages here
			default: break;
		}
		return statusMessage;
	}

	/**
	 * Gets status message from response
	 *
	 * @param response response object
	 * @param strict If set true then RemoteException must be present in the body
	 * @returns Error message interpreted by status code
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
	 * @param responseBody response body
	 * @returns Error message interpreted by status code
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
	 * @param statusMessage status message
	 * @param [remoteExceptionMessage] remote exception message
	 * @param [error] error
	 * @returns error message
	 */
	private getErrorMessage(statusMessage: string, remoteExceptionMessage?: string, error?: any): string {
		statusMessage = statusMessage === '' ? undefined : statusMessage;
		remoteExceptionMessage = remoteExceptionMessage === '' ? undefined : remoteExceptionMessage;
		let messageFromError: string = error ? (error['message'] || error.toString()) : undefined;
		return statusMessage && remoteExceptionMessage ?
			`${statusMessage} (${remoteExceptionMessage})` :
			statusMessage || remoteExceptionMessage || messageFromError ||
			localize('webhdfs.unknownError', "Unknown Error");
	}

	/**
	 * Parse error state from response and return valid Error object
	 *
	 * @param response response object
	 * @param [responseBody] response body
	 * @param [error] error
	 * @returns HdfsError object
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
	 * @param response response object
	 * @returns if response is redirect
	 */
	private isRedirect(response: request.Response): boolean {
		return [301, 307].indexOf(response.statusCode) !== -1 &&
			response.headers.hasOwnProperty('location');
	}

	/**
	 * Check if response is successful
	 *
	 * @param response response object
	 * @returns if response is successful
	 */
	private isSuccess(response: request.Response): boolean {
		return [200, 201].indexOf(response.statusCode) !== -1;
	}

	/**
	 * Check if response is error
	 *
	 * @param response response object
	 * @returns if response is error
	 */
	private isError(response: request.Response): boolean {
		return [400, 401, 402, 403, 404, 500].indexOf(response.statusCode) !== -1;
	}

	/**
	 * Send a request to WebHDFS REST API
	 *
	 * @param method HTTP method
	 * @param opts Options for request
	 * @returns void
	 */
	private sendRequest(method: string, urlValue: string, opts: object, callback: (error: HdfsError, response: request.Response) => void): void {
		if (!callback) {
			return;
		}
		let requestParams = Object.assign(
			{ method: method, url: urlValue, json: true },
			this._requestParams,
			opts || {}
		);
		this.ensureCookie(requestParams);
		// Add a wrapper to handle unauthorized requests by adding kerberos auth steps
		let handler = (error: any, response: request.Response) => {
			if (error && error.statusCode === 401 && this._requestParams.isKerberos) {
				this.requestWithKerberosSync(requestParams, callback);
			} else {
				callback(error, response);
			}
		};
		this.doSendRequest(requestParams, handler);
	}

	private ensureCookie(requestParams: { headers?: { [key: string]: string } }) {
		if (this._authCookie && this._authCookie.expiryTime() > Date.now()) {
			requestParams.headers = requestParams.headers || {};
			requestParams.headers['cookie'] = `${this._authCookie.key}=${this._authCookie.value}`;
		}
	}

	private doSendRequest(requestParams: any, callback: (error: HdfsError, response: any) => void): void {
		request(requestParams, (error: any, response: request.Response, body: any) => {
			if (error || this.isError(response)) {
				let hdfsError = this.parseError(response, body, error);
				callback(hdfsError, response);
			}
			else if (this.isSuccess(response)) {
				callback(undefined, response);
			}
			else {
				let hdfsError = new HdfsError(localize('webhdfs.unexpectedRedirect', "Unexpected Redirect"), response && response.statusCode, response && response.statusMessage, this.getRemoteExceptionMessage(body || response.body), error);
				callback(hdfsError, response);
			}
		});
	}

	/**
	 * Authenticates using kerberos as part of a request, and saves cookie if successful.
	 * Ideally would use request's built-in cookie functionality but this isn't working with non-public domains.
	 * Instead, save the cookie in this module and reuse if not expired
	 */
	private requestWithKerberosSync(requestParams: any, callback: (error: HdfsError, response: request.Response) => void) {
		this.setKerberosAuthOnParams(requestParams).then(() => {
			this.doSendRequest(requestParams, (error, response) => {
				if (error) {
					// Pass on the callback
					callback(error, response);
				}
				else {
					// Capture cookie for future requests
					this.setAuthCookie(response);
					callback(error, response);
				}
			});
		}).catch((err) => {
			callback(err, undefined);
		});
	}

	private async setKerberosAuthOnParams(requestParams: any): Promise<void> {
		let kerberosToken = await auth.authenticateKerberos(this._opts.host);
		requestParams.headers = { Authorization: `Negotiate ${kerberosToken}` };
		return requestParams;
	}

	private setAuthCookie(response: request.Response) {
		try {
			if (response && response.headers && response.headers['set-cookie']) {
				let cookies: Cookie[];
				if (response.headers['set-cookie'] instanceof Array) {
					cookies = response.headers['set-cookie'].map(c => Cookie.parse(c));
				}
				else {
					cookies = [Cookie.parse(response.headers['set-cookie'])];
				}
				this._authCookie = cookies[0];
			}
		} catch { }
	}

	/**
	 * Change file permissions
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
	 * @param userId User name
	 * @param groupId Group name
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
	 * List the status of a path
	 *
	 * @returns void
	 */
	public listStatus(path: string, callback: (error: HdfsError, files: FileStatus[]) => void): void {
		this.checkArgDefined('path', path);

		let endpoint = this.getOperationEndpoint('liststatus', path);
		this.sendRequest('GET', endpoint, undefined, (error, response) => {
			if (!callback) { return; }

			let files: any[] = [];
			if (error) {
				callback(error, undefined);
			} else if (response.body.hasOwnProperty('FileStatuses')
				&& response.body.FileStatuses.hasOwnProperty('FileStatus')) {
				files = (<any[]>response.body.FileStatuses.FileStatus).map(fs => {
					return new FileStatus(
						fs.accessTime || '',
						fs.blockSize || '',
						fs.group || '',
						fs.length || '',
						fs.modificationTime || '',
						fs.owner || '',
						fs.pathSuffix || '',
						fs.permission || '',
						fs.replication || '',
						fs.snapshotEnabled || '',
						parseHdfsFileType(fs.type)
					);
				});
				callback(undefined, files);
			} else {
				callback(new HdfsError(ErrorMessageInvalidDataStructure), undefined);
			}
		});
	}

	/**
	 * Make new directory
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

	public getFileStatus(path: string, callback: (error: HdfsError, fileStatus: FileStatus) => void): void {
		this.checkArgDefined('path', path);

		let endpoint = this.getOperationEndpoint('getfilestatus', path);
		this.sendRequest('GET', endpoint, undefined, (error, response) => {
			if (!callback) { return; }
			if (error) {
				callback(error, undefined);
			} else if (response.body.hasOwnProperty('FileStatus')) {
				const fileStatus = new FileStatus(
					response.body.FileStatus.accessTime || '',
					response.body.FileStatus.blockSize || '',
					response.body.FileStatus.group || '',
					response.body.FileStatus.length || '',
					response.body.FileStatus.modificationTime || '',
					response.body.FileStatus.owner || '',
					response.body.FileStatus.pathSuffix || '',
					response.body.FileStatus.permission || '',
					response.body.FileStatus.replication || '',
					response.body.FileStatus.snapshotEnabled || '',
					parseHdfsFileType(response.body.FileStatus.type || 'undefined')
				);
				callback(undefined, fileStatus);
			} else {
				callback(new HdfsError(ErrorMessageInvalidDataStructure), undefined);
			}
		});
	}

	/**
	 * Get ACL status for given path
	 * @param path The path to the file/folder to get the status of
	 * @param callback Callback to handle the response
	 * @returns void
	 */
	public getAclStatus(path: string, callback: (error: HdfsError, permissionStatus: PermissionStatus) => void): void {
		this.checkArgDefined('path', path);

		let endpoint = this.getOperationEndpoint('getaclstatus', path);
		this.sendRequest('GET', endpoint, undefined, (error, response) => {
			if (!callback) { return; }
			if (error) {
				callback(error, undefined);
			} else if (response.body.hasOwnProperty('AclStatus')) {
				const permissions = parseAclPermissionFromOctal(response.body.AclStatus.permission);
				const ownerEntry = new AclEntry(PermissionType.owner, '', `${response.body.AclStatus.owner || ''}${ownerPostfix}`);
				ownerEntry.addPermission(AclEntryScope.access, permissions.owner);
				const groupEntry = new AclEntry(PermissionType.group, '', `${response.body.AclStatus.group || ''}${owningGroupPostfix}`);
				groupEntry.addPermission(AclEntryScope.access, permissions.group);
				const otherEntry = new AclEntry(PermissionType.other, '', everyoneName);
				otherEntry.addPermission(AclEntryScope.access, permissions.other);
				const parsedEntries = parseAclList((<any[]>response.body.AclStatus.entries).join(','));

				// First go through and apply any ACLs for the unnamed entries (which correspond to the permissions in
				// the permission octal)
				parsedEntries.filter(e => e.name === '').forEach(e => {
					let targetEntry: AclEntry;
					switch (e.type) {
						case AclType.user:
							targetEntry = ownerEntry;
							break;
						case AclType.group:
							targetEntry = groupEntry;
							break;
						case AclType.other:
							targetEntry = otherEntry;
							break;
						default:
							// Unknown type - just ignore since we don't currently support the other types
							return;
					}
					e.getAllPermissions().forEach(sp => {
						targetEntry.addPermission(sp.scope, sp.permission);
					});
				});

				const permissionStatus = new PermissionStatus(
					ownerEntry,
					groupEntry,
					otherEntry,
					!!response.body.AclStatus.stickyBit,
					// We filter out empty names here since those have already been merged into the
					// owner/owning group/other entries
					parsedEntries.filter(e => e.name !== ''));
				callback(undefined, permissionStatus);
			} else {
				callback(new HdfsError(ErrorMessageInvalidDataStructure), undefined);
			}
		});
	}

	/**
	 * Set ACL for the given path. The owner, group and other fields are required - other entries are optional.
	 * @param path The path to the file/folder to set the ACL on
	 * @param fileType The type of file we're setting to determine if defaults should be applied. Use undefined if type is unknown
	 * @param ownerEntry The status containing the permissions to set
	 * @param callback Callback to handle the response
	 */
	public setAcl(path: string, fileType: FileType | undefined, permissionStatus: PermissionStatus, callback: (error: HdfsError) => void): void {
		this.checkArgDefined('path', path);
		this.checkArgDefined('permissionStatus', permissionStatus);
		const concatEntries = [permissionStatus.owner, permissionStatus.group, permissionStatus.other].concat(permissionStatus.aclEntries);
		const aclSpec = concatEntries.reduce((acc, entry: AclEntry) => acc.concat(entry.toAclStrings(fileType !== FileType.File)), []).join(',');
		let endpoint = this.getOperationEndpoint('setacl', path, { aclspec: aclSpec });
		this.sendRequest('PUT', endpoint, undefined, (error) => {
			return callback && callback(error);
		});
	}

	/**
	 * Sets the permission octal (sticky, owner, group & other) for a file/folder
	 * @param path The path to the file/folder to set the permission of
	 * @param permissionStatus The status containing the permission to set
	 * @param callback Callback to handle the response
	 */
	public setPermission(path: string, permissionStatus: PermissionStatus, callback: (error: HdfsError) => void): void {
		this.checkArgDefined('path', path);
		this.checkArgDefined('permissionStatus', permissionStatus);
		let endpoint = this.getOperationEndpoint('setpermission', path, { permission: permissionStatus.permissionOctal });
		this.sendRequest('PUT', endpoint, undefined, (error) => {
			return callback && callback(error);
		});
	}

	/**
	 * Removes the default ACLs for the specified path
	 * @param path The path to remove the default ACLs for
	 * @param callback Callback to handle the response
	 */
	public removeDefaultAcl(path: string, callback: (error: HdfsError) => void): void {
		this.checkArgDefined('path', path);
		let endpoint = this.getOperationEndpoint('removedefaultacl', path);
		this.sendRequest('PUT', endpoint, undefined, (error) => {
			return callback && callback(error);
		});
	}

	/**
	 * Get all mounts for a HDFS connection
	 * @param callback Callback to handle the response
	 * @returns void
	 */
	public getMounts(callback: (error: HdfsError, mounts: Mount[]) => void): void {
		let endpoint = this.getOperationEndpoint('listmounts', '');
		this.sendRequest('GET', endpoint, undefined, (error, response) => {
			if (!callback) { return; }
			if (error) {
				callback(error, undefined);
			} else if (response.body.hasOwnProperty('Mounts')) {
				const mounts = response.body.Mounts;
				callback(undefined, mounts);
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
	 * @returns void
	 */
	public exists(path: string, callback: (error: HdfsError, exists: boolean) => void): void {
		this.checkArgDefined('path', path);

		this.listStatus(path, (error, fileStatus) => {
			let exists = !fileStatus ? false : true;
			callback(error, exists);
		});
	}

	/**
	 * Write data to the file
	 *
	 * @param append If set to true then append data to the file
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
	 */
	public appendFile(path: string, data: string | Buffer, opts: object, callback: (error: HdfsError) => void): fs.WriteStream {
		return this.writeFile(path, data, true, opts, callback);
	}

	/**
	 * Read data from the file
	 *
	 * @fires Request#data
	 * @fires WebHDFS#finish
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
	 * @param [append] If set to true then append data to the file
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

		let params: any = Object.assign(
			{
				method: append ? 'POST' : 'PUT',
				url: endpoint,
				json: true,
			},
			this._requestParams
		);
		params.headers = params.headers || {};
		params.headers['content-type'] = 'application/octet-stream';

		if (!this._requestParams.isKerberos) {
			return this.doCreateWriteStream(params);
		}
		// Else, must add kerberos token and handle redirects
		return this.createKerberosWriteStream(params);
	}

	private createKerberosWriteStream(params: any): fs.WriteStream {
		params.followRedirect = false;
		// Create an intermediate stream that pauses until we get a positive
		// response from the server
		let isWaiting = true;
		let firstCb: Function = undefined;
		let replyStream = through(function (chunk, enc, cb) {
			this.push(chunk, enc);
			if (isWaiting) {
				firstCb = cb;
			} else {
				cb();
			}
		});
		let handleErr = (err: any) => {
			replyStream.emit('error', err);
			replyStream.end();
		};
		let initRedirectedStream = () => {
			// After redirect, create valid stream to correct location
			// and pipe the intermediate stream to it, unblocking the data flow
			params.headers['content-type'] = 'application/octet-stream';
			let upload = request(params, (err: any, res: request.Response, bo: any) => {
				if (err || this.isError(res)) {
					emitError(replyStream, this.parseError(res, bo, err));
					replyStream.end();
				}
				else if (res.headers.hasOwnProperty('location')) {
					replyStream.emit('finish', res.headers.location);
				}
				else {
					replyStream.emit('finish');
				}
			});
			isWaiting = false;
			replyStream.pipe(upload);
			if (firstCb) {
				firstCb();
			}
		};
		this.requestWithRedirectAndAuth(params, initRedirectedStream, handleErr);
		return <fs.WriteStream><any>replyStream;
	}

	private doCreateWriteStream(params: any): fs.WriteStream {

		let canResume: boolean = true;
		let stream: Readable;
		let req = request(params, (error: any, response: request.Response, body: any) => {
			// Handle redirect only if there was not an error (e.g. res is defined)
			if (response && this.isRedirect(response)) {
				let upload = request(Object.assign(params, { url: response.headers.location }), (err: any, res: request.Response, bo: any) => {
					if (err || this.isError(res)) {
						emitError(req, this.parseError(res, bo, err));
						req.end();
					}
					else if (res.headers.hasOwnProperty('location')) {
						req.emit('finish', res.headers.location);
					}
					else {
						req.emit('finish');
					}
				});
				canResume = true; // Enable resume
				stream.pipe(upload);
				stream.resume();
			}
			if (error || this.isError(response)) {
				emitError(req, this.parseError(response, body, error));
			}
		});
		req.on('pipe', (src: Readable) => {
			// Pause read stream
			stream = src;
			stream.pause();
			// This is not an elegant solution but here we go
			// Basically we don't allow pipe() method to resume reading input
			// and set internal _readableState.flowing to false
			canResume = false;
			stream.on('resume', () => {
				if (!canResume) {
					(stream as any)._readableState.flowing = false; // i guess we are unsafely accessing this
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
		let params: request.OptionsWithUrl = Object.assign(
			{
				method: 'GET',
				url: endpoint,
				json: true
			},
			this._requestParams
		);
		if (!this._requestParams.isKerberos) {
			return <fs.ReadStream><any>this.doCreateReadStream(params);
		}
		// Else, must add kerberos token and handle redirects
		params.followRedirect = false;
		let replyStream = through();
		let handleErr = (err: any) => {
			replyStream.emit('error', err);
			replyStream.end();
		};
		let initRedirectedStream = () => {
			let redirectedStream = this.doCreateReadStream(params);
			redirectedStream.pipe(replyStream);
		};
		this.requestWithRedirectAndAuth(params, initRedirectedStream, handleErr);

		return <fs.ReadStream><any>replyStream;
	}

	private requestWithRedirectAndAuth(params: request.OptionsWithUrl, onRedirected: () => void, handleErr: (err: any) => void) {
		this.requestWithKerberosSync(params, (err, response: request.Response) => {
			if (err && err.statusCode === 307 && response.headers['location']) {
				// It's a redirect
				params.url = response.headers['location'];
				this.setKerberosAuthOnParams(params)
					.then(onRedirected)
					.catch(handleErr);
			} else {
				handleErr(err);
			}
		});
	}

	private doCreateReadStream(params: request.OptionsWithUrl): fs.ReadStream {

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
			}
			else if (this.isRedirect(response)) {
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
	 * @returns void
	 */
	public rmdir(path: string, recursive: boolean = false, callback: (error: HdfsError) => void): void {
		this.unlink(path, recursive, callback);
	}

	public static createClient(opts: IHdfsOptions, requestParams: IRequestParams): WebHDFS {
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
