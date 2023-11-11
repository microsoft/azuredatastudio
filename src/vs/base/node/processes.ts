/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import { Stats } from 'fs';
import * as path from 'vs/base/common/path';
import * as Platform from 'vs/base/common/platform';
import * as process from 'vs/base/common/process';
import { CommandOptions, ForkOptions, Source, SuccessData, TerminateResponse, TerminateResponseCode } from 'vs/base/common/processes';
import * as Types from 'vs/base/common/types';
import * as pfs from 'vs/base/node/pfs';
export { CommandOptions, ForkOptions, SuccessData, Source, TerminateResponse, TerminateResponseCode };

export type ValueCallback<T> = (value: T | Promise<T>) => void;
export type ErrorCallback = (error?: any) => void;
export type ProgressCallback<T> = (progress: T) => void;


export function getWindowsShell(env = process.env as Platform.IProcessEnvironment): string {
	return env['comspec'] || 'cmd.exe';
}

export interface IQueuedSender {
	send: (msg: any) => void;
}

// Wrapper around process.send() that will queue any messages if the internal node.js
// queue is filled with messages and only continue sending messages when the internal
// queue is free again to consume messages.
// On Windows we always wait for the send() method to return before sending the next message
// to workaround https://github.com/nodejs/node/issues/7657 (IPC can freeze process)
export function createQueuedSender(childProcess: cp.ChildProcess): IQueuedSender {
	let msgQueue: string[] = [];
	let useQueue = false;

	const send = function (msg: any): void {
		if (useQueue) {
			msgQueue.push(msg); // add to the queue if the process cannot handle more messages
			return;
		}

		const result = childProcess.send(msg, (error: Error | null) => {
			if (error) {
				console.error(error); // unlikely to happen, best we can do is log this error
			}

			useQueue = false; // we are good again to send directly without queue

			// now send all the messages that we have in our queue and did not send yet
			if (msgQueue.length > 0) {
				const msgQueueCopy = msgQueue.slice(0);
				msgQueue = [];
				msgQueueCopy.forEach(entry => send(entry));
			}
		});

		if (!result || Platform.isWindows /* workaround https://github.com/nodejs/node/issues/7657 */) {
			useQueue = true;
		}
	};

	return { send };
}

export namespace win32 {
	export async function findExecutable(command: string, cwd?: string, paths?: string[]): Promise<string> {
		// If we have an absolute path then we take it.
		if (path.isAbsolute(command)) {
			return command;
		}
		if (cwd === undefined) {
			cwd = process.cwd();
		}
		const dir = path.dirname(command);
		if (dir !== '.') {
			// We have a directory and the directory is relative (see above). Make the path absolute
			// to the current working directory.
			return path.join(cwd, command);
		}
		if (paths === undefined && Types.isString(process.env['PATH'])) {
			paths = process.env['PATH'].split(path.delimiter);
		}
		// No PATH environment. Make path absolute to the cwd.
		if (paths === undefined || paths.length === 0) {
			return path.join(cwd, command);
		}

		async function fileExists(path: string): Promise<boolean> {
			if (await pfs.Promises.exists(path)) {
				let statValue: Stats | undefined;
				try {
					statValue = await pfs.Promises.stat(path);
				} catch (e) {
					if (e.message.startsWith('EACCES')) {
						// it might be symlink
						statValue = await pfs.Promises.lstat(path);
					}
				}
				return statValue ? !statValue.isDirectory() : false;
			}
			return false;
		}

		// We have a simple file name. We get the path variable from the env
		// and try to find the executable on the path.
		for (const pathEntry of paths) {
			// The path entry is absolute.
			let fullPath: string;
			if (path.isAbsolute(pathEntry)) {
				fullPath = path.join(pathEntry, command);
			} else {
				fullPath = path.join(cwd, pathEntry, command);
			}
			if (await fileExists(fullPath)) {
				return fullPath;
			}
			let withExtension = fullPath + '.com';
			if (await fileExists(withExtension)) {
				return withExtension;
			}
			withExtension = fullPath + '.exe';
			if (await fileExists(withExtension)) {
				return withExtension;
			}
		}
		return path.join(cwd, command);
	}
}
