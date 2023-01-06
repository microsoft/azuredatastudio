/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum TdeMigrationState {
	Pending = 'Pending',
	Running = 'Running',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
	Canceled = 'Canceled',
}

export enum TdeDatabaseMigrationState {
	Running = 'Running',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
	Canceled = 'Canceled',
}

export interface TdeMigrationDbState {
	name: string;
	dbState: TdeDatabaseMigrationState;
	error: string;
}

export interface TdeMigrationResult {
	dbList: TdeMigrationDbState[];
	state: TdeMigrationState;
}


export class TdeMigrationModel {
	private _exportUsingADS?: boolean | undefined;
	private _adsExportConfirmation: boolean;
	private _configurationCompleted: boolean;
	private _shownBefore: boolean;
	private _encryptedDbs: string[];
	private _tdeMigrationCompleted: boolean;
	private _tdeMigrationResult: TdeMigrationResult = {
		state: TdeMigrationState.Pending,
		dbList: []
	};

	public _networkPath: string;
	public _domain: string;
	public _username: string;
	public _password: string;

	constructor(
	) {
		this._adsExportConfirmation = false;
		this._configurationCompleted = false;
		this._shownBefore = false;
		this._encryptedDbs = [];

		this._networkPath = '';
		this._domain = '';
		this._username = '';
		this._password = '';
		this._tdeMigrationCompleted = false;
	}

	//If the configuration dialog was shown already.
	public shownBefore(): boolean {
		return this._shownBefore;
	}

	//If the configuration dialog was shown already.
	public configurationShown(): void {
		this._shownBefore = true;
	}

	//The number of encrypted databaes
	public getTdeEnabledDatabasesCount(): number {
		return this._encryptedDbs.length;
	}

	//Whether or not there are tde enabled databases
	public hasTdeEnabledDatabases(): boolean {
		return this.getTdeEnabledDatabasesCount() > 0;
	}

	//The list of encrypted databaes
	public getTdeEnabledDatabases(): string[] {
		return this._encryptedDbs;
	}

	//Sets the databases that are
	public setTdeEnabledDatabasesCount(encryptedDbs: string[]): void {
		this._encryptedDbs = encryptedDbs;
		this._tdeMigrationCompleted = false;	//Reset the migration status when databases change
		this._shownBefore = false;				//Reset the tde dialog showing status when databases change
	}

	//Sets the certificate migration method
	public setTdeMigrationMethod(useAds: boolean): void {
		if (useAds) {
			this._exportUsingADS = true;
		} else {
			this._exportUsingADS = false;
			this._adsExportConfirmation = false;
		}
		this._tdeMigrationCompleted = false;
	}

	//When a migration configuration was configured and accepted on the configuration blade.
	public setConfigurationCompleted(): void {
		this._configurationCompleted = true;
	}

	//When ADS is configured to do the certificates migration
	public shouldAdsMigrateCertificates(): boolean {
		return this.hasTdeEnabledDatabases() && this._configurationCompleted && this.isTdeMigrationMethodAdsConfirmed();
	}

	//When any valid method is properly set.
	public isTdeMigrationMethodSet(): boolean {
		return this.isTdeMigrationMethodAdsConfirmed() || this.isTdeMigrationMethodManual();
	}

	//When Ads is selected as method. may still need confirmation.
	public isTdeMigrationMethodAds(): boolean {
		return this._exportUsingADS === true;
	}

	//When ads migration method is confirmed
	public isTdeMigrationMethodAdsConfirmed(): boolean {
		return this.isTdeMigrationMethodAds() && this._adsExportConfirmation === true;
	}

	//When manual method is selected
	public isTdeMigrationMethodManual(): boolean {
		return this._exportUsingADS === false;
	}

	//When manual method is selected
	public tdeMigrationCompleted(): boolean {
		return this._tdeMigrationCompleted;
	}

	public lastTdeMigrationResult(): TdeMigrationResult {
		return this._tdeMigrationResult;
	}

	public setTdeMigrationResult(result: TdeMigrationResult): void {
		this._tdeMigrationResult = result;
		this._tdeMigrationCompleted = result.state === TdeMigrationState.Succeeded;
	}

	//When the confirmation is set, for ADS certificate migration method
	public setAdsConfirmation(status: boolean, networkPath: string, domain: string, username: string, password: string): void {
		if (status && this.isTdeMigrationMethodAds()) {
			this._adsExportConfirmation = true;

			this._networkPath = networkPath;
			this._domain = domain;
			this._username = username;
			this._password = password;
		} else {
			this._adsExportConfirmation = false;
		}
	}
}
