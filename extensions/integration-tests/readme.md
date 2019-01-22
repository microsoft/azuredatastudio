This leverages the extension testing feature provided by VS Code, We can use this for:
a.	Commands for setting up the environment for feature testing.
b.	Adding test cases that do not need UI interaction or the test scenarios not supported by the UI automation framework (e.g. object explorer context menu – not html based)

extensionInstallers folder: copy the VISX installers for the extensions we would like to run the tests with.
src folder: this is where the test file for features should be added, name the file like this: feature.test.ts. e.g. objectExplorer.test.ts

Setup step:
1.	Launch ADS
2.	Install extensions from /extensions/integration-tests/extensionInstallers by calling the test command in the integration-tests extension
3.	Set configuration values. E.g. Enable preview features by calling the test command in the integration-tests extension

For now this has only been tested for Windows platform

How to run the test:
1.	In the build pipeline: 
The integration tests has been added to ADS windows pipeline to run the test and report the results, you can find the test result under the test tab.

2.	Local environment:
run test-integration.bat or test-integration.sh under scripts folder
ADS will be launched using new temp folders: extension folder and data folder
