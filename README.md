# university-enroll
[![Build Status](https://api.travis-ci.org/nwestbury/quest-enroll.svg?branch=master)](https://travis-ci.org/nwestbury/quest-enroll)

This software checks your "Add" list in your schedule builder (not watchlist) for open classes. 
If one or more green circles is found, indicating that those classes are open, it attempts to 
enroll in those classes. Behavior is undefined for enrollment failures (ie after a failure it might 
retry enrollment many times, which is bad). Mailgun is used for email notification of enrollment attempts.

## Requirements
- Latest LTS version of [nodejs](https://nodejs.org/en/) 
- Latest stable version of [yarn](https://yarnpkg.com/lang/en/docs/install/)

## Usage
Sign up for [mailgun](https://mailgun.com) and create a file
called `credentials.json` with this content:

```
{
    "username": "your-username",
    "password": "your-password",
    "university": "[your-university-shorthand]",
    "mailgun_api_key": "key-[your-unique-key]",
    "mailgun_domain": "sandbox[your-unique-sandbox-id].mailgun.org",
    "notify_email": "[your-personal-email]@provider.com"
}
```

Then run in the terminal in the root directory:
```
yarn install
node index.js
```
