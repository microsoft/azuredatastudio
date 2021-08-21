This is a sample extension that will show some basic model-backed UI scenarios and how to contribute feature providers(e.g. Connection, Object Explorer) in ADS. Note: only implement the providers this way if your data service has native JavaScript SDK available, otherwise use [data protocol client](https://github.com/microsoft/sqlops-dataprotocolclient), please refer to [SQL Tools Service] (https://github.com/microsoft/sqltoolsservice) or [PG Tools Service](https://github.com/microsoft/pgtoolsservice) as examples.

## Run the following commands to produce an extension installation package

- `yarn install` - to install the dependencies
- `yarn build` - to build the code
- `vsce package` - to produce an extension installation package

## Launch ADS Dev instance with this extension
- `yarn install` - to install dependencies
- `yarn build` - to build the code
- Launch VSCode and open the azuredatastudio's code folder, run the 'Launch azuredatastudio' debug option (to work around the issue. The next step won't work without doing this first)
- Launch VSCode and open this folder, run the 'Debug in enlistment'
- Once ADS launches, you should be able to run the sqlservices commands, for example: sqlservices.openDialog
