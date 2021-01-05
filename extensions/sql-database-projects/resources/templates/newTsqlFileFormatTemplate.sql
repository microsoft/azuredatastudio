CREATE EXTERNAL FILE FORMAT [@@OBJECT_NAME@@] WITH
(
	FORMAT_TYPE = JSON,
	DATA_COMPRESSION = 'org.apache.hadoop.io.compress.GzipCodec'
)
