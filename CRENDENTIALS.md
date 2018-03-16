## How to Create Encrypted Credentials File for Travis

Create `credentials_${TEST_UNIVERSITY_ID}.json.enc` from `credentials.json`

```
$ export TEST_UNIVERSITY_ID=<your-university-id>
$ export encryption_key=$(openssl rand -hex 16) encryption_iv=$(openssl rand -hex 16)
$ openssl aes-256-cbc -K $encryption_key -iv $encryption_iv -in credentials.json -out credentials_${TEST_UNIVERSITY_ID}.json.enc
$ openssl aes-256-cbc -K $encryption_key -iv $encryption_iv -in credentials_${TEST_UNIVERSITY_ID}.json.enc -out credentials.json -d
```

Then in the Travis config, add the following env variables:
- `TEST_UNIVERSITY_ID` with your university identifier. 
  For this variable only, switch on 'Display value in build log'
- `encryption_key` with the output of `echo $encryption_key`.
- `encryption_iv` with the output of `echo $encryption_iv`.