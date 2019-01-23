This integration-tests suite is based on the extension testing feature provided by VS Code, We can use this for:
a.	Commands for setting up the environment for feature testing.
b.	Adding test cases that do not need UI interaction or the test scenarios not supported by the UI automation framework (e.g. object explorer context menu – not html based)

extensionInstallers folder: copy the VISX installers for the extensions we would like to run the tests with.
src folder: this is where the test file for features should be added, name the file like this: feature.test.ts. e.g. objectExplorer.test.ts

UI automation testing:
the ADS UI automation test cases should be added under $root/test/smoke/src/sql folder. Each feature should create its own folder and add 2 files, one for accessing the feature and the other for the test cases. For example: objectExplorer.ts and objectExplorer.test.ts. 

Setup step:
1.	Launch ADS
2.	Install extensions from /extensions/integration-tests/extensionInstallers by calling the test command in the integration-tests extension
3.	Set configuration values. E.g. Enable preview features by calling the test command in the integration-tests extension

For now this has only been tested for Windows platform

How to run the test:
1.	In the build pipeline: 
The integration tests and UI automation tests have been added to ADS windows pipeline to run the test and report the results, you can find the test result under the test tab.

2.	Local environment:
Integration tests:
test-integration.bat or test-integration.sh under scripts folder

UI automation tests:
navigate to test/smoke folder and run: node test/index.js
You can also run UI automation from VSCode by selecting the launch option: Launch Smoke Test.

ADS will be launched using new temp folders: extension folder and data folder so that your local dev environment won't be changed.


