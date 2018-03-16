const fs = require('fs');
const chai = require('chai');
const expect = chai.expect;

const puppeteer = require('puppeteer');
const { login } = require('./login.js');

const credentials = JSON.parse(fs.readFileSync("credentials.json"));
const university = credentials.university || "ualberta";
const config = JSON.parse(fs.readFileSync("config.json"))[university];

describe('login()', function () {
    let browser, page;
    beforeEach(async function () {
        this.timeout(30*1000);
        browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
        page = await browser.newPage();
    });
    afterEach(async function () {
        this.timeout(30*1000);
        browser.close();
    });

    it('should login', async function () {
        this.timeout(30*1000);
        await login(page, config, credentials);
    });
});
