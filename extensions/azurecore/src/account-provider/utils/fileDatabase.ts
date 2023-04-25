/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promises as fs, constants as fsConstants } from 'fs';
import { Logger } from '../../utils/Logger';

export type ReadWriteHook = (contents: string, resetOnError?: boolean) => Promise<string>;
const noOpHook: ReadWriteHook = async (contents): Promise<string> => {
	return contents;
};

export class AlreadyInitializedError extends Error {

}

type DbMap = { [key: string]: string };
export class FileDatabase {
	private db: DbMap = {};
	private isDirty = false;
	private isSaving = false;
	private isInitialized = false;
	private saveInterval: NodeJS.Timer | undefined;

	constructor(
		private readonly dbPath: string,
		private readHook: ReadWriteHook = noOpHook,
		private writeHook: ReadWriteHook = noOpHook
	) {

	}

	/**
	 * Sets a new read hook. Throws AlreadyInitializedError if the database has already started.
	 * @param hook
	 */
	public setReadHook(hook: ReadWriteHook): void {
		if (this.isInitialized) {
			throw new AlreadyInitializedError();
		}
		this.readHook = hook;
	}

	/**
	 * Sets a new write hook.
	 * @param hook
	 */
	public setWriteHook(hook: ReadWriteHook): void {
		this.writeHook = hook;
	}

	public async set(key: string, value: string): Promise<void> {
		await this.waitForFileSave();
		this.db[key] = value;
		this.isDirty = true;
	}

	public get(key: string): string {
		return this.db[key];
	}

	public async delete(key: string): Promise<void> {
		await this.waitForFileSave();
		delete this.db[key];
		this.isDirty = true;
	}

	public async clear(): Promise<void> {
		await this.waitForFileSave();
		this.db = {};
		this.isDirty = true;
	}

	public getPrefix(keyPrefix: string): { key: string, value: string }[] {
		return Object.entries(this.db).filter(([key]) => {
			return key.startsWith(keyPrefix);
		}).map(([key, value]) => {
			return { key, value };
		});
	}

	public async deletePrefix(keyPrefix: string): Promise<void> {
		await this.waitForFileSave();
		Object.keys(this.db).forEach(s => {
			if (s.startsWith(keyPrefix)) {
				delete this.db[s];
			}
		});
		this.isDirty = true;
	}

	public async initialize(): Promise<void> {
		this.isInitialized = true;
		this.saveInterval = setInterval(() => this.save(), 20 * 1000);
		let fileContents: string;
		try {
			await fs.access(this.dbPath, fsConstants.R_OK | fsConstants.R_OK);
			fileContents = await fs.readFile(this.dbPath, { encoding: 'utf8' });
			fileContents = await this.readHook(fileContents, true);
		} catch (ex) {
			Logger.error(`Error occurred when initializing File Database from file system cache, ADAL cache will be reset: ${ex}`);
			await this.createFile();
			this.db = {};
			this.isDirty = true;
			return;
		}

		try {
			this.db = JSON.parse(fileContents) as DbMap;
		} catch (ex) {
			Logger.error(`Error occurred when reading file database contents as JSON, ADAL cache will be reset: ${ex}`);
			await this.createFile();
			this.db = {};
		}
	}

	public async shutdown(): Promise<void> {
		await this.waitForFileSave();
		if (this.saveInterval) {
			clearInterval(this.saveInterval);
		}
		await this.save();
	}

	/**
	 * This doesn't need to be called as a timer will automatically call it.
	 */
	public async save(): Promise<void> {
		try {
			await this.waitForFileSave();
			if (this.isDirty === false) {
				return;
			}

			this.isSaving = true;
			let contents = JSON.stringify(this.db);
			contents = await this.writeHook(contents);

			await fs.writeFile(this.dbPath, contents, { encoding: 'utf8' });

			this.isDirty = false;
		} catch (ex) {
			Logger.error(`Error occurred while saving cache contents to file storage, this may cause issues with ADAL cache persistence: ${ex}`);
		} finally {
			this.isSaving = false;
		}
	}

	private async waitForFileSave(): Promise<void> {
		const cleanupCrew: NodeJS.Timer[] = [];

		const sleepToFail = (time: number): Promise<void> => {
			return new Promise((_, reject) => {
				const timeout = setTimeout(reject, time);
				cleanupCrew.push(timeout);
			});
		};

		const poll = (func: () => boolean): Promise<void> => {
			return new Promise(resolve => {
				const interval = setInterval(() => {
					if (func() === true) {
						resolve();
					}
				}, 100);
				cleanupCrew.push(interval);
			});
		};

		if (this.isSaving) {
			const timeout = sleepToFail(5 * 1000);
			const check = poll(() => !this.isSaving);

			try {
				return await Promise.race([timeout, check]);
			} catch (ex) {
				throw new Error('Save timed out');
			} finally {
				cleanupCrew.forEach(clearInterval);
			}
		}
	}

	private async createFile(): Promise<void> {
		return fs.writeFile(this.dbPath, '', { encoding: 'utf8' });
	}
}
