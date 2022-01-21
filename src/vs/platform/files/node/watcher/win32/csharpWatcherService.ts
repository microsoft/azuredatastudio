/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChildProcess, spawn } from 'child_process';
import { parse, ParsedPattern } from 'vs/base/common/glob';
import { FileAccess } from 'vs/base/common/network';
import { LineDecoder } from 'vs/base/node/decoder';
import { FileChangeType } from 'vs/platform/files/common/files';
import { IDiskFileChange, ILogMessage } from 'vs/platform/files/node/watcher/watcher';

export class OutOfProcessWin32FolderWatcher {

	private static readonly MAX_RESTARTS = 5;

	private static readonly changeTypeMap = [FileChangeType.UPDATED, FileChangeType.ADDED, FileChangeType.DELETED];

	private readonly ignored: ParsedPattern[];

	private handle: ChildProcess | undefined;
	private restartCounter: number;

	constructor(
		private watchedFolder: string,
		ignored: string[],
		private eventCallback: (events: IDiskFileChange[]) => void,
		private logCallback: (message: ILogMessage) => void,
		private verboseLogging: boolean
	) {
		this.restartCounter = 0;

		if (Array.isArray(ignored)) {
			this.ignored = ignored.map(ignore => parse(ignore));
		} else {
			this.ignored = [];
		}

		// Logging
		if (this.verboseLogging) {
			this.log(`Start watching: ${watchedFolder}, excludes: ${ignored.join(',')}`);
		}

		this.startWatcher();
	}

	private startWatcher(): void {
		const args = [this.watchedFolder];
		if (this.verboseLogging) {
			args.push('-verbose');
		}

		this.handle = spawn(FileAccess.asFileUri('vs/platform/files/node/watcher/win32/CodeHelper.exe', require).fsPath, args);

		const stdoutLineDecoder = new LineDecoder();

		// Events over stdout
		this.handle.stdout!.on('data', (data: Buffer) => {

			// Collect raw events from output
			const rawEvents: IDiskFileChange[] = [];
			for (const line of stdoutLineDecoder.write(data)) {
				const eventParts = line.split('|');
				if (eventParts.length === 2) {
					const changeType = Number(eventParts[0]);
					const absolutePath = eventParts[1];

					// File Change Event (0 Changed, 1 Created, 2 Deleted)
					if (changeType >= 0 && changeType < 3) {

						// Support ignores
						if (this.ignored && this.ignored.some(ignore => ignore(absolutePath))) {
							if (this.verboseLogging) {
								this.log(absolutePath);
							}

							continue;
						}

						// Otherwise record as event
						rawEvents.push({
							type: OutOfProcessWin32FolderWatcher.changeTypeMap[changeType],
							path: absolutePath
						});
					}

					// 3 Logging
					else {
						this.log(eventParts[1]);
					}
				}
			}

			// Trigger processing of events through the delayer to batch them up properly
			if (rawEvents.length > 0) {
				this.eventCallback(rawEvents);
			}
		});

		// Errors
		this.handle.on('error', (error: Error) => this.onError(error));
		this.handle.stderr!.on('data', (data: Buffer) => this.onError(data));

		// Exit
		this.handle.on('exit', (code: number, signal: string) => this.onExit(code, signal));
	}

	private onError(error: Error | Buffer): void {
		this.error('process error: ' + error.toString());
	}

	private onExit(code: number, signal: string): void {
		if (this.handle) {

			// exit while not yet being disposed is unexpected!
			this.error(`terminated unexpectedly (code: ${code}, signal: ${signal})`);

			if (this.restartCounter <= OutOfProcessWin32FolderWatcher.MAX_RESTARTS) {
				this.error('is restarted again...');
				this.restartCounter++;
				this.startWatcher(); // restart
			} else {
				this.error('Watcher failed to start after retrying for some time, giving up. Please report this as a bug report!');
			}
		}
	}

	private error(message: string) {
		this.logCallback({ type: 'error', message: `[File Watcher (C#)] ${message}` });
	}

	private log(message: string) {
		this.logCallback({ type: 'trace', message: `[File Watcher (C#)] ${message}` });
	}

	dispose(): void {
		if (this.handle) {
			this.handle.kill();
			this.handle = undefined;
		}
	}
}
