/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ScriptableDialogBase, ScriptableDialogOptions } from '../ui/scriptableDialogBase';

export class BackupDialog extends ScriptableDialogBase<ScriptableDialogOptions> {
	protected async initializeUI(): Promise<void> {
		this.createDropdown('Database', async (newValue) => {

		}, ['Db1', 'Db2', 'Db3'], '');
	}
	protected async initializeData(): Promise<void> {

	}
	protected get helpUrl(): string {
		return 'https://microsoft.com';
	}
	protected get isDirty(): boolean {
		return false;
	}
	protected async generateScript(): Promise<string> {
		return 'SELECT 1';
	}

}
export async function openBackupDialog(): Promise<void> {
	/*
	const dialog = azdata.window.createModelViewDialog('', '', 'wide');
	const generalTab = azdata.window.createTab('General');
	generalTab.registerContent(async view => {
		const databaseDropdown = view.modelBuilder.dropDown().withProps({
			values: ['Db1', 'Db2', 'Db3']
		}).component();
		const recoveryModelDropdown = view.modelBuilder.dropDown().withProps({
			values: ['FULL']
		}).component();
		const backupLocationDropdown = view.modelBuilder.dropDown().withProps({
			values: ['Disk', 'URL']
		}).component();
		const locationListBox = view.modelBuilder.listBox().withProps({
			values: ['/var/opt/mssql/data/Backup.bak']
		}).component();
		const form = view.modelBuilder.formContainer().withFormItems([
			{
				components: [
					{
						component: databaseDropdown,
						title: 'Database'
					},
					{
						component: recoveryModelDropdown,
						title: 'Recovery Model'
					}
				],
				title: 'Source'
			},
			{
				components: [
					{
						component: backupLocationDropdown,
						title: 'Back up to'
					},
					{
						component: locationListBox
					}
				],
				title: 'Destination'
			}
		])
			.withLayout({
				'width': '100%'
			}).component();
		await view.initializeModel(form);
	});
	const mediaOptionsTab = azdata.window.createTab('Media Options');
	mediaOptionsTab.registerContent(async view => {

	});
	const backupOptionsTab = azdata.window.createTab('Backup Options');
	backupOptionsTab.registerContent(async view => {

	});
	dialog.content = [generalTab, mediaOptionsTab, backupOptionsTab];
	// this.dialog.registerCloseValidator(async () => await this.create());
	*/
	const dialog = new BackupDialog('Backup', 'Backup', { width: 'wide' });
	await dialog.open();
}
