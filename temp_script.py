import json
print(json.loads(open('temp_test_utf8.json', encoding='utf-8-sig').read())['test'])
