##---------------------------------------------------------------------------------------------
##  Copyright (c) Microsoft Corporation. All rights reserved.
##  Licensed under the Source EULA. See License.txt in the project root for license information.
##--------------------------------------------------------------------------------------------

import json
import nbformat
import os
import random
import string
import sys
import uuid
from nbconvert.preprocessors import ExecutePreprocessor
from subprocess import Popen, PIPE, TimeoutExpired

## Variables
notebook_path = '../../notebooks/arcDeployment/'

## Helper functions
def generate_name(prefix, length=8):
	return (prefix + '-' + ''.join(
		[random.choice(string.ascii_lowercase)
			for n in range(length - len(prefix) - 1)]))

def clear_env():
	for k in [k for k in os.environ.keys() if k.startswith('AZDATA_NB_VAR_')]:
		del os.environ[k]

def azdata(commands, timeout=None, stdin=None):
	commands.insert(0, "azdata")
	print('Executing command: \n', ' '.join(commands))
	proc = Popen(commands, stdin=PIPE if stdin is not None else None, stdout=PIPE, stderr=PIPE, shell=os.name=='nt')
	try:
		(stdout, stderr) = proc.communicate(input=stdin, timeout=timeout)
	except TimeoutExpired:
		# https://docs.python.org/3.5/library/subprocess.html#subprocess.Popen.communicate
		# The child process is not killed if the timeout expires, so in order to
		# cleanup properly we should kill the child process and finish communication.
		proc.kill()
		(stdout, stderr) = proc.communicate(timeout=timeout)
		sys.stdout.buffer.write(stdout)
		sys.stderr.buffer.write(stderr)
		raise

	sys.stdout.buffer.write(stdout)
	if proc.returncode != 0:
		raise Exception(stderr)
	else:
		sys.stderr.buffer.write(stderr)

	return (stdout.decode(sys.stdout.encoding),
			stderr.decode(sys.stderr.encoding))

## Tests
def test_postgres_create():
	# Load the notebook
	with open(notebook_path + 'deploy.postgres.existing.arc.ipynb') as f:
		nb = nbformat.read(f, as_version=nbformat.NO_CONVERT)

	name = generate_name('pg')
	try:
		# Setup the environment
		os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_NAME'] = name
		subscription = os.environ['AZDATA_NB_VAR_ARC_SUBSCRIPTION'] = str(uuid.uuid4())
		resource_group = os.environ['AZDATA_NB_VAR_ARC_RESOURCE_GROUP_NAME'] = 'test'
		namespace = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_NAMESPACE'] = 'default'
		workers = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_WORKERS'] = '1'
		service_type = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_SERVICE_TYPE'] = 'NodePort'
		data_size = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_DATA_SIZE'] = '512'
		port = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_PORT'] = '5431'
		extensions = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_EXTENSIONS'] = 'pg_cron,postgis'
		cpu_min = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_CPU_MIN'] = '1'
		cpu_max = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_CPU_MAX'] = '2'
		memory_min = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_MEMORY_MIN'] = '256'
		memory_max = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_MEMORY_MAX'] = '1023'
		backup_sizes = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_BACKUP_SIZES'] = '512,1023'
		backup_full_interval = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_BACKUP_FULL_INTERVAL'] = '20'
		backup_delta_interval = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_BACKUP_DELTA_INTERVAL'] = '10'
		backup_retention_min = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_BACKUP_RETENTION_MIN'] = '1,1GB;2,2GB'
		backup_retention_max = os.environ['AZDATA_NB_VAR_POSTGRES_SERVER_GROUP_BACKUP_RETENTION_MAX'] = '2,2GB;3,3GB'

		# Execute the notebook that creates Postgres
		ExecutePreprocessor(timeout=1200).preprocess(nb, {'metadata': {'path': notebook_path}})

		# Verify that Postgres was created successfully
		(out, _) = azdata(['postgres', 'server', 'show', '-n', name])
		db = json.loads(out)
		assert db['metadata']['name'] == name
		assert db['metadata']['namespace'] == namespace
		assert db['spec']['scale']['shards'] == int(workers)
		assert db['spec']['service']['type'] == service_type
		assert db['spec']['storage']['volumeSize'] == data_size + 'Mi'
		assert db['spec']['service']['port'] == int(port)
		assert [p['name'] for p in db['spec']['engine']['plugins']] == ['pg_cron' ,'postgis']
		assert db['spec']['scheduling']['default']['resources']['requests']['cpu'] == cpu_min
		assert db['spec']['scheduling']['default']['resources']['limits']['cpu'] == cpu_max
		assert db['spec']['scheduling']['default']['resources']['requests']['memory'] == memory_min + 'Mi'
		assert db['spec']['scheduling']['default']['resources']['limits']['memory'] == memory_max + 'Mi'
		assert [t['storage']['volumeSize'] for t in db['spec']['backups']['tiers']] == [b + 'Mi' for b in backup_sizes.split(',')]
		assert db['spec']['backups']['fullMinutes'] == int(backup_full_interval)
		assert db['spec']['backups']['deltaMinutes'] == int(backup_delta_interval)
		for i in range(len(db['spec']['backups']['tiers'])):
			assert db['spec']['backups']['tiers'][i]['retention']['minimums'] == backup_retention_min.split(';')[i].split(',')
			assert db['spec']['backups']['tiers'][i]['retention']['maximums'] == backup_retention_max.split(';')[i].split(',')
	except Exception:
		# Capture cell outputs to help with debugging
		print([c['outputs'] for c in nb['cells'] if c.get('outputs')])
		raise
	finally:
		clear_env()
		azdata(['postgres', 'server', 'delete', '-n', name])
