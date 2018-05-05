#!/usr/bin/env bash
n=0
until [ $n -ge 20 ]
do
  node index.js >> output.log && break
  n=$[$n+1]
  sleep 20
done
