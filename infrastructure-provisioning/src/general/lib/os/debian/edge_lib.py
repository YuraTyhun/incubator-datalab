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

import os
import sys
from fabric.api import *
from fabric.contrib.files import exists


def configure_http_proxy_server(config):
    try:
        if not exists('/tmp/http_proxy_ensured'):
            sudo('apt-get -y install squid')
            template_file = config['template_file']
            proxy_subnet = config['exploratory_subnet']
            put(template_file, '/tmp/squid.conf')
            sudo('\cp /tmp/squid.conf /etc/squid/squid.conf')
            sudo('sed -i "s|PROXY_SUBNET|{}|g" /etc/squid/squid.conf'.format(proxy_subnet))
            sudo('sed -i "s|EDGE_USER_NAME|{}|g" /etc/squid/squid.conf'.format(config['project_name']))
            sudo('sed -i "s|LDAP_HOST|{}|g" /etc/squid/squid.conf'.format(config['ldap_host']))
            sudo('sed -i "s|LDAP_DN|{}|g" /etc/squid/squid.conf'.format(config['ldap_dn']))
            sudo('sed -i "s|LDAP_SERVICE_USERNAME|{}|g" /etc/squid/squid.conf'.format(config['ldap_user']))
            sudo('sed -i "s|LDAP_SERVICE_PASSWORD|{}|g" /etc/squid/squid.conf'.format(config['ldap_password']))
            sudo('sed -i "s|LDAP_AUTH_PATH|{}|g" /etc/squid/squid.conf'.format('/usr/lib/squid/basic_ldap_auth'))
            replace_string = ''
            for cidr in config['vpc_cidrs']:
                replace_string += 'acl AWS_VPC_CIDR dst {}\\n'.format(cidr)
            sudo('sed -i "s|VPC_CIDRS|{}|g" /etc/squid/squid.conf'.format(replace_string))
            replace_string = ''
            for cidr in config['allowed_ip_cidr']:
                replace_string += 'acl AllowedCIDRS src {}\\n'.format(cidr)
            sudo('sed -i "s|ALLOWED_CIDRS|{}|g" /etc/squid/squid.conf'.format(replace_string))
            sudo('service squid reload')
            sudo('sysv-rc-conf squid on')
            sudo('touch /tmp/http_proxy_ensured')
    except Exception as err:
        print("Failed to install and configure squid: " + str(err))
        sys.exit(1)


def install_nginx_ldap(edge_ip, nginx_version, ldap_ip, ldap_dn, ldap_ou, ldap_service_pass, ldap_service_username,
                       user, hostname, step_cert_sans):
    try:
        if not os.path.exists('/tmp/nginx_installed'):
            sudo('apt-get install -y wget')
            sudo('apt-get -y install gcc build-essential make zlib1g-dev libpcre++-dev libssl-dev git libldap2-dev')
            if os.environ['conf_stepcerts_enabled'] == 'true':
                sudo('mkdir -p /home/{0}/keys'.format(user))
                sudo('echo "{0}" | base64 --decode > /home/{1}/keys/root_ca.crt'.format(
                     os.environ['conf_stepcerts_root_ca'], user))
                fingerprint = sudo('step certificate fingerprint /home/{0}/keys/root_ca.crt'.format(
                    user))
                sudo('step ca bootstrap --fingerprint {0} --ca-url "{1}"'.format(fingerprint,
                                                                                 os.environ['conf_stepcerts_ca_url']))
                sudo('echo "{0}" > /home/{1}/keys/provisioner_password'.format(
                     os.environ['conf_stepcerts_kid_password'], user))
                sans = "--san localhost --san 127.0.0.1 {0}".format(step_cert_sans)
                cn = edge_ip
                sudo('step ca token {3} --kid {0} --ca-url "{1}" --root /home/{2}/keys/root_ca.crt '
                     '--password-file /home/{2}/keys/provisioner_password {4} --output-file /tmp/step_token'.format(
                      os.environ['conf_stepcerts_kid'], os.environ['conf_stepcerts_ca_url'], user, cn, sans))
                token = sudo('cat /tmp/step_token')
                sudo('step ca certificate "{0}" /home/{2}/keys/dlab.crt /home/{2}/keys/dlab.key '
                     '--token "{1}" --kty=RSA --size 2048 --provisioner {3} '.format(cn, token, user,
                                                                                     os.environ['conf_stepcerts_kid']))
                sudo('cp /home/{0}/keys/dlab.crt /etc/ssl/certs/'.format(user))
                sudo('cp /home/{0}/keys/dlab.key /etc/ssl/certs/'.format(user))
                sudo('touch /var/log/renew_certificates.log')
                sudo('bash -c \'echo "0 */3 * * * root /usr/bin/step ca renew /etc/ssl/certs/dlab.crt '
                     '/etc/ssl/certs/dlab.key --exec "nginx -s reload" --ca-url "{1}" '
                     '--root /home/{0}/keys/root_ca.crt --force --expires-in 8h >> /var/log/renew_certificates.log '
                     '2>&1" >> /etc/crontab \''.format(user, os.environ['conf_stepcerts_ca_url']))
            else:
                sudo('openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout /etc/ssl/certs/dlab.key \
                     -out /etc/ssl/certs/dlab.crt -subj "/C=US/ST=US/L=US/O=dlab/CN={}"'.format(hostname))
            sudo('mkdir -p /tmp/nginx_auth_ldap')
            with cd('/tmp/nginx_auth_ldap'):
                sudo('git clone https://github.com/kvspb/nginx-auth-ldap.git')
            sudo('mkdir -p /tmp/src')
            with cd('/tmp/src/'):
                sudo('wget http://nginx.org/download/nginx-{}.tar.gz'.format(nginx_version))
                sudo('tar -xzf nginx-{}.tar.gz'.format(nginx_version))
                sudo('ln -sf nginx-{} nginx'.format(nginx_version))
            with cd('/tmp/src/nginx/'):
                sudo('./configure --user=nginx --group=nginx --prefix=/etc/nginx --sbin-path=/usr/sbin/nginx \
                              --conf-path=/etc/nginx/nginx.conf --pid-path=/run/nginx.pid --lock-path=/run/lock/subsys/nginx \
                              --error-log-path=/var/log/nginx/error.log --http-log-path=/var/log/nginx/access.log \
                              --with-http_gzip_static_module --with-http_stub_status_module --with-http_ssl_module --with-pcre \
                              --with-http_realip_module --with-file-aio --with-ipv6 --with-http_v2_module --with-debug \
                              --without-http_scgi_module --without-http_uwsgi_module --without-http_fastcgi_module --with-http_sub_module \
                              --add-module=/tmp/nginx_auth_ldap/nginx-auth-ldap/')
                sudo('make')
                sudo('make install')
            sudo('useradd -r nginx')
            sudo('rm -f /etc/nginx/nginx.conf')
            sudo('mkdir -p /opt/dlab/templates')
            put('/root/templates', '/opt/dlab', use_sudo=True)
            sudo('sed -i \'s/LDAP_IP/{}/g\' /opt/dlab/templates/nginx.conf'.format(ldap_ip))
            sudo('sed -i \'s/LDAP_DN/{}/g\' /opt/dlab/templates/nginx.conf'.format(ldap_dn))
            sudo('sed -i \'s/LDAP_OU/{}/g\' /opt/dlab/templates/nginx.conf'.format(ldap_ou))
            sudo('sed -i \'s/LDAP_SERVICE_PASSWORD/{}/g\' /opt/dlab/templates/nginx.conf'.format(ldap_service_pass))
            sudo('sed -i \'s/LDAP_SERVICE_USERNAME/{}/g\' /opt/dlab/templates/nginx.conf'.format(ldap_service_username))
            sudo('sed -i \'s/EDGE_IP/{}/g\' /opt/dlab/templates/conf.d/proxy.conf'.format(edge_ip))
            sudo('cp /opt/dlab/templates/nginx.conf /etc/nginx/')
            sudo('mkdir /etc/nginx/conf.d')
            sudo('cp /opt/dlab/templates/conf.d/proxy.conf /etc/nginx/conf.d/')
            sudo('mkdir /etc/nginx/locations')
            sudo('cp /opt/dlab/templates/nginx_debian /etc/init.d/nginx')
            sudo('chmod +x /etc/init.d/nginx')
            sudo('systemctl daemon-reload')
            sudo('systemctl enable nginx')
            sudo('/etc/init.d/nginx start')
            sudo('touch /tmp/nginx_installed')
    except Exception as err:
        print("Failed install nginx with ldap: " + str(err))
        sys.exit(1)
