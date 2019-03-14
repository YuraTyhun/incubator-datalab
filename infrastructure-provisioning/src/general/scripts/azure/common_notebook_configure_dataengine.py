#!/usr/bin/python

# *****************************************************************************
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
# ******************************************************************************

import logging
import json
import sys
from dlab.fab import *
from dlab.meta_lib import *
from dlab.actions_lib import *
import os
import uuid


if __name__ == "__main__":
    local_log_filename = "{}_{}_{}.log".format(os.environ['conf_resource'], os.environ['edge_user_name'],
                                               os.environ['request_id'])
    local_log_filepath = "/logs/" + os.environ['conf_resource'] + "/" + local_log_filename
    logging.basicConfig(format='%(levelname)-8s [%(asctime)s]  %(message)s',
                        level=logging.DEBUG,
                        filename=local_log_filepath)

    try:
        # generating variables dictionary
        print('Generating infrastructure names and tags')
        notebook_config = dict()
        try:
            notebook_config['exploratory_name'] = os.environ['exploratory_name'].replace('_', '-')
        except:
            notebook_config['exploratory_name'] = ''
        try:
            notebook_config['computational_name'] = os.environ['computational_name'].replace('_', '-')
        except:
            notebook_config['computational_name'] = ''
        notebook_config['service_base_name'] = os.environ['conf_service_base_name']
        notebook_config['resource_group_name'] = os.environ['azure_resource_group_name']
        notebook_config['region'] = os.environ['azure_region']
        notebook_config['user_name'] = os.environ['edge_user_name'].replace('_', '-')
        notebook_config['cluster_name'] = notebook_config['service_base_name'] + '-' + notebook_config['user_name'] + \
                                          '-de-' + notebook_config['exploratory_name'] + '-' + \
                                          notebook_config['computational_name']
        notebook_config['master_node_name'] = notebook_config['cluster_name'] + '-m'
        notebook_config['slave_node_name'] = notebook_config['cluster_name'] + '-s'
        notebook_config['notebook_name'] = os.environ['notebook_instance_name']
        notebook_config['key_path'] = os.environ['conf_key_dir'] + '/' + os.environ['conf_key_name'] + '.pem'
        notebook_config['dlab_ssh_user'] = os.environ['conf_os_user']
        notebook_config['instance_count'] = int(os.environ['dataengine_instance_count'])
        try:
            notebook_config['spark_master_ip'] = AzureMeta().get_private_ip_address(
                notebook_config['resource_group_name'], notebook_config['master_node_name'])
            notebook_config['notebook_ip'] = AzureMeta().get_private_ip_address(
                notebook_config['resource_group_name'], notebook_config['notebook_name'])
        except Exception as err:
            print('Error: {0}'.format(err))
            sys.exit(1)
        notebook_config['spark_master_url'] = 'spark://{}:7077'.format(notebook_config['spark_master_ip'])

    except Exception as err:
        for i in range(notebook_config['instance_count'] - 1):
            slave_name = notebook_config['slave_node_name'] + '{}'.format(i+1)
            AzureActions().remove_instance(notebook_config['resource_group_name'], slave_name)
        AzureActions().remove_instance(notebook_config['resource_group_name'], notebook_config['master_node_name'])
        append_result("Failed to generate infrastructure names", str(err))
        sys.exit(1)

    try:
        logging.info('[INSTALLING KERNELS INTO SPECIFIED NOTEBOOK]')
        print('[INSTALLING KERNELS INTO SPECIFIED NOTEBOOK]')
        params = "--cluster_name {} --spark_version {} --hadoop_version {} --os_user {} --spark_master {} --keyfile {} --notebook_ip {} --datalake_enabled {}".\
            format(notebook_config['cluster_name'], os.environ['notebook_spark_version'],
                   os.environ['notebook_hadoop_version'], notebook_config['dlab_ssh_user'],
                   notebook_config['spark_master_url'], notebook_config['key_path'], notebook_config['notebook_ip'],
                   os.environ['azure_datalake_enable'])
        try:
            local("~/scripts/{}_{}.py {}".format(os.environ['application'], 'install_dataengine_kernels', params))
        except:
            traceback.print_exc()
            raise Exception
    except Exception as err:
        print('Error: {0}'.format(err))
        for i in range(notebook_config['instance_count'] - 1):
            slave_name = notebook_config['slave_node_name'] + '{}'.format(i+1)
            AzureActions().remove_instance(notebook_config['resource_group_name'], slave_name)
        AzureActions().remove_instance(notebook_config['resource_group_name'], notebook_config['master_node_name'])
        append_result("Failed installing Dataengine kernels.", str(err))
        sys.exit(1)

    try:
        logging.info('[UPDATING SPARK CONFIGURATION FILES ON NOTEBOOK]')
        print('[UPDATING SPARK CONFIGURATION FILES ON NOTEBOOK]')
        params = "--hostname {0} " \
                 "--keyfile {1} " \
                 "--os_user {2} " \
            .format(notebook_config['notebook_ip'],
                    notebook_config['key_path'],
                    notebook_config['dlab_ssh_user'])
        try:
            local("~/scripts/{0}.py {1}".format('common_configure_spark', params))
        except:
            traceback.print_exc()
            raise Exception
    except Exception as err:
        print('Error: {0}'.format(err))
        for i in range(notebook_config['instance_count'] - 1):
            slave_name = notebook_config['slave_node_name'] + '{}'.format(i+1)
            AzureActions().remove_instance(notebook_config['resource_group_name'], slave_name)
        AzureActions().remove_instance(notebook_config['resource_group_name'], notebook_config['master_node_name'])
        append_result("Failed to configure Spark.", str(err))
        sys.exit(1)

    try:
        with open("/root/result.json", 'w') as result:
            res = {"notebook_name": notebook_config['notebook_name'],
                   "Action": "Configure notebook server"}
            print(json.dumps(res))
            result.write(json.dumps(res))
    except:
        print("Failed writing results.")
        sys.exit(0)
