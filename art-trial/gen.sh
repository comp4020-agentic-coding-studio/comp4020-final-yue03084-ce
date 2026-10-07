#!/bin/sh
# usage: gen.sh <model> <size> <outfile> <prompt>
# Generates one image through the course proxy and downloads it at once,
# since the returned URL expires. The key comes from the environment.
set -eu
model=$1 size=$2 out=$3 prompt=$4
body=$(jq -n --arg m "$model" --arg s "$size" --arg p "$prompt" '{model:$m,size:$s,prompt:$p,n:1}')
resp=$(curl -s -m 180 https://strproxy.comp.anu.edu.au/api/images/generations \
  -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" -H "content-type: application/json" -d "$body")
url=$(printf '%s' "$resp" | jq -r '.data[0].url // empty')
if [ -z "$url" ]; then echo "FAIL $out: $(printf '%s' "$resp" | head -c 300)"; exit 1; fi
curl -s -m 120 -o "$out" "$url" && echo "ok $out"
