/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ADSPerformanceEntry {
	readonly name: string;
	readonly timestamp: number;
}

export class ADSPerformance {
	static browserPerformance: Performance = window.performance;
	static marks: ADSPerformanceEntry[] = [];
	static transactionMarks: { string?: ADSPerformanceEntry[] } = {};
	/**
	 * Mark that something is taking place
	 * @param name the event taking place
	 */
	public static mark(name: string, timestamp: number = ADSPerformance.getTimestamp()): void {
		const entry: ADSPerformanceEntry = {
			name,
			timestamp
		};

		this.marks.push(entry);
		this.browserPerformance.mark(name);
	}

	/**
	 * Mark when you want to measure the performance of a unique transaction
	 * @param name the type of the transaction
	 * @param uid the unique identifier of the transaction
	 */
	public static transactionMark(name: string, uid: string, timestamp: number = ADSPerformance.getTimestamp()): void {

		if (!this.transactionMarks[uid]) {
			this.transactionMarks[uid] = [];
		}
		const entry: ADSPerformanceEntry = {
			name,
			timestamp
		};

		this.transactionMarks[uid].push(entry);
		this.mark(name, timestamp);
	}

	public static getTimestamp(): number {
		return this.browserPerformance.now();
	}

	/**
	 * Get entries for a specific name
	 * @param name name of entry
	 */
	public static getEntries(name?: string): ADSPerformanceEntry[] {
		if (!name) {
			return this.marks;
		}

		return this.marks.filter(m => m.name === name);
	}

	/**
	 * Get entries for a specific transaction
	 * @param uid the unique identifier of the transaction
	 */
	public static getTransactionEntries(uid: string): ADSPerformanceEntry[] {
		return this.transactionMarks[uid] || [];
	}

	/**
	 * This is NOT a secure random string. Do NOT use this for any security token.
	 *
	 * Any implementation of this method must prepend NotSecure to the generated string.
	 */
	public static getUid(): string {
		return `NotSecure_${Math.random().toString(36).substr(2, 9)}`;
	}
}
