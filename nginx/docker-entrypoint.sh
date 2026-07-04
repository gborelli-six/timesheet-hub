#!/bin/sh
set -e
RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)
sed -i "s/__RESOLVER__/$RESOLVER/" /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
