/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

(async () => {
	const serviceDownloader = require('service-downloader').ServiceDownloadProvider;
	const platform = require('service-downloader/out/platform').PlatformInformation;
	const path = require('path');
	const fs = require('fs').promises;
	const rimraf = require('rimraf');
	const assert = require('assert');
	const readline = require('readline');

	async function installService() {
		const absoluteConfigPath = require.resolve('../config.json');
		const config = require(absoluteConfigPath);
		const runtime = (await platform.getCurrent()).runtimeId;
		// fix path since it won't be correct
		config.installDirectory = path.join(path.dirname(absoluteConfigPath), config.installDirectory);
		let installer = new serviceDownloader(config);
		installer.eventEmitter.onAny((event, ...values) => {
			readline.cursorTo(process.stdout, 0);
			readline.clearLine(process.stdout, 0);
			process.stdout.write(`${event}${values && values.length > 0 ? ` - ${values.join(' ')}` : ''}`);
		});
		let serviceInstallFolder = installer.getInstallDirectory(runtime);
		await new Promise((rs, rj) => rimraf(serviceInstallFolder, (e) => e ? rj(e) : rs()));
		await installer.installService(runtime);
		let stat;
		for (const file of config.executableFiles) {
			try {
				stat = await fs.stat(path.join(serviceInstallFolder, file));
			} catch (e) { }
		}

		assert(stat);
	}

	await installService();
})().catch(e => {
	console.error(e);
	process.exit(1);
});
