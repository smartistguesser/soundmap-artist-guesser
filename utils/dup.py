#!/usr/bin/env python3
"""
Find duplicates in a JSON file.

Usage:
  python find_duplicates.py path/to/file.json [--key KEY]

If the JSON top-level is an array:
  - without --key: items are compared by full value (canonical JSON)
  - with --key: objects are considered duplicates when the value for KEY repeats

If the JSON top-level is an object:
  - finds identical values across different keys
"""
import argparse, json, sys
from collections import defaultdict

def canonical(x):
    return json.dumps(x, sort_keys=True, ensure_ascii=False)

def find_in_list(data, key=None):
    buckets = defaultdict(list)
    for i, item in enumerate(data):
        if key and isinstance(item, dict):
            identifier = item.get(key, None)
        else:
            identifier = canonical(item)
        buckets[identifier].append(i)
    return {id: idxs for id, idxs in buckets.items() if len(idxs) > 1}

def find_in_obj(data):
    buckets = defaultdict(list)
    for k, v in data.items():
        buckets[canonical(v)].append(k)
    return {val: keys for val, keys in buckets.items() if len(keys) > 1}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("file", help="JSON file path")
    p.add_argument("--key", help="object key to use for duplicate detection in arrays")
    args = p.parse_args()

    try:
        with open(args.file, "r", encoding="utf-8") as f:
            doc = json.load(f)
    except Exception as e:
        print("Error loading JSON:", e, file=sys.stderr)
        sys.exit(2)

    if isinstance(doc, list):
        dup = find_in_list(doc, key=args.key)
        if not dup:
            print("No duplicates found in array.")
            return
        print("Duplicates found (identifier -> list of indices):")
        for identifier, indices in dup.items():
            try:
                pretty = json.loads(identifier)
                print(json.dumps(pretty, ensure_ascii=False, indent=2))
            except Exception:
                print(identifier)
            print("Indices:", indices)
    elif isinstance(doc, dict):
        dup = find_in_obj(doc)
        if not dup:
            print("No duplicate values found across object keys.")
            return
        print("Duplicate values found (value -> list of keys):")
        for val, keys in dup.items():
            print(json.dumps(json.loads(val), ensure_ascii=False, indent=2))
            print("Keys:", keys)
    else:
        print("Top-level JSON is neither array nor object; nothing to check.")

if __name__ == "__main__":
    main()