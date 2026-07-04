#!/bin/sh
set -e
RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)
sed "s/__RESOLVER__/$RESOLVER/" /etc/nginx/conf.d/default.conf > /tmp/nginx-default.conf
cat /tmp/nginx-default.conf > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
