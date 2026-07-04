#!/bin/sh
set -e
# In CI nginx.ci.conf viene montato :ro e non contiene __RESOLVER__.
# Su Railway il file è nell'image layer (writable via overlay copy-on-write)
# e contiene il placeholder che va sostituito con il resolver reale.
if grep -q '__RESOLVER__' /etc/nginx/conf.d/default.conf 2>/dev/null; then
    RESOLVER=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)
    sed "s/__RESOLVER__/$RESOLVER/" /etc/nginx/conf.d/default.conf > /tmp/nginx-default.conf
    cat /tmp/nginx-default.conf > /etc/nginx/conf.d/default.conf
fi
exec nginx -g 'daemon off;'
