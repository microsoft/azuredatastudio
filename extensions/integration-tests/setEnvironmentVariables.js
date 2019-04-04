const msrestAzure = require('ms-rest-azure');
const KeyVault = require('azure-keyvault');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Name of the values that are stored in Azure Key Vault
const AKV_URL = 'https://sqltoolssecretstore.vault.azure.net/';
const SECRET_AZURE_SERVER = 'ads-integration-test-azure-server';
const SECRET_AZURE_SERVER_USERNAME = 'ads-integration-test-azure-server-username';
const SECRET_AZURE_SERVER_PASSWORD = 'ads-integration-test-azure-server-password';
const SECRET_BDC_SERVER = 'ads-integration-test-bdc-server';
const SECRET_BDC_SERVER_USERNAME = 'ads-integration-test-bdc-server-username';
const SECRET_BDC_SERVER_PASSWORD = 'ads-integration-test-bdc-server-password';
const SECRET_STANDALONE_SERVER = 'ads-integration-test-standalone-server';
const SECRET_STANDALONE_SERVER_USERNAME = 'ads-integration-test-standalone-server-username';
const SECRET_STANDALONE_SERVER_PASSWORD = 'ads-integration-test-standalone-server-password';

// Environment variable names
const ENVAR_AZURE_SERVER = 'AZURE_SQL';
const ENVAR_AZURE_SERVER_USERNAME = 'AZURE_SQL_USERNAME';
const ENVAR_AZURE_SERVER_PASSWORD = 'AZURE_SQL_PWD';
const ENVAR_BDC_SERVER = 'BDC_BACKEND_HOSTNAME';
const ENVAR_BDC_SERVER_USERNAME = 'BDC_BACKEND_USERNAME';
const ENVAR_BDC_SERVER_PASSWORD = 'BDC_BACKEND_PWD';
const ENVAR_STANDALONE_SERVER = 'STANDALONE_SQL';
const ENVAR_STANDALONE_SERVER_USERNAME = 'STANDALONE_SQL_USERNAME';
const ENVAR_STANDALONE_SERVER_PASSWORD = 'STANDALONE_SQL_PWD';
const ENVAR_PYTHON_INSTALL_PATH = 'PYTHON_TEST_PATH';

const SecretEnVarMapping = {};
SecretEnVarMapping[SECRET_AZURE_SERVER] = ENVAR_AZURE_SERVER;
SecretEnVarMapping[SECRET_AZURE_SERVER_PASSWORD] = ENVAR_AZURE_SERVER_PASSWORD;
SecretEnVarMapping[SECRET_AZURE_SERVER_USERNAME] = ENVAR_AZURE_SERVER_USERNAME;
SecretEnVarMapping[SECRET_BDC_SERVER] = ENVAR_BDC_SERVER;
SecretEnVarMapping[SECRET_BDC_SERVER_PASSWORD] = ENVAR_BDC_SERVER_PASSWORD;
SecretEnVarMapping[SECRET_BDC_SERVER_USERNAME] = ENVAR_BDC_SERVER_USERNAME;
SecretEnVarMapping[SECRET_STANDALONE_SERVER] = ENVAR_STANDALONE_SERVER;
SecretEnVarMapping[SECRET_STANDALONE_SERVER_PASSWORD] = ENVAR_STANDALONE_SERVER_PASSWORD;
SecretEnVarMapping[SECRET_STANDALONE_SERVER_USERNAME] = ENVAR_STANDALONE_SERVER_USERNAME;

const EnVarNameValueMapping = {};

const AkvSecrets = [
	SECRET_AZURE_SERVER,
	SECRET_AZURE_SERVER_PASSWORD,
	SECRET_AZURE_SERVER_USERNAME,
	SECRET_BDC_SERVER,
	SECRET_BDC_SERVER_PASSWORD,
	SECRET_BDC_SERVER_USERNAME,
	SECRET_STANDALONE_SERVER,
	SECRET_STANDALONE_SERVER_PASSWORD,
	SECRET_STANDALONE_SERVER_USERNAME
];

const EnvironmentVariables = [
	ENVAR_AZURE_SERVER,
	ENVAR_AZURE_SERVER_PASSWORD,
	ENVAR_AZURE_SERVER_USERNAME,
	ENVAR_BDC_SERVER,
	ENVAR_BDC_SERVER_PASSWORD,
	ENVAR_BDC_SERVER_USERNAME,
	ENVAR_STANDALONE_SERVER,
	ENVAR_STANDALONE_SERVER_PASSWORD,
	ENVAR_STANDALONE_SERVER_USERNAME,
	ENVAR_PYTHON_INSTALL_PATH
];

// Set the values that are not stored in AKV here
EnVarNameValueMapping[ENVAR_PYTHON_INSTALL_PATH] = path.join(os.homedir(), 'azuredatastudio-python');

let promises = [];

// Fetch the values from AKV
msrestAzure.interactiveLogin().then((credentials) => {
	const client = new KeyVault.KeyVaultClient(credentials);
	AkvSecrets.forEach(secret => {
		let promise = client.getSecret(AKV_URL, secret, '').then((result) => {
			console.log(`${secret}: ${result.value}`);
			EnVarNameValueMapping[SecretEnVarMapping[secret]] = result.value;
		}, (err) => {
			console.error('An error occured while retrieving the key value');
			console.error(err);
		});
		promises.push(promise);
	});

	Promise.all(promises).then(
		() => {
			let content = '';
			EnvironmentVariables.forEach(envar => {
				content += `${envar}=${EnVarNameValueMapping[envar]}${os.EOL}`;
			});
			fs.writeFileSync(path.join(os.homedir(), '.ads-int-test-env'), content);
			console.log('all done!');
		}
	);
}, (err) => {
	console.error('An error occured while retrieving the key value');
	console.error(err);
});