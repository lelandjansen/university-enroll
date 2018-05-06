const fs = require('fs');
const process = require('process');
const puppeteer = require('puppeteer');
const mailgunjs = require('mailgun-js');
const {login} = require('./login');
const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const config =
    JSON.parse(fs.readFileSync('config.json'))[credentials.university];
const mailgun = mailgunjs({
  apiKey: credentials.mailgunApiKey,
  domain: credentials.mailgunDomain,
});
const rate = 15 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendEmailNotification(msg) {
    const data = {
        from: 'Watchlist Notifier <postmaster@'+credentials.mailgunDomain+'>',
        to: credentials.notifyEmail,
        subject: config.notificationSubject,
        html: msg,
    };
    try {
        const body = await mailgun.messages().send(data);
        console.log('sent email notification');
        console.log(body);
    } catch (e) {
        console.log(new Date());
        console.log('could not send email notification', e);
    }
}

function cleanStr(str) {
    // Remove <br> and non-space whitespaces from the input string
    return str.replace(/<br>|[^\S ]/g, '');
}

async function checkEnroll(page, enrollUrl) {
    const {
        enrollTableRowId,
        enrollCheckbox,
        enrollOpenImage,
        enrollClosedImage,
        enrollCourseTitle,
        enrollSectionTitle,
    } = config;

    await page.goto(enrollUrl);
    // await page.screenshot({path: 'screenshot.png', fullPage: true});

    const tableRows = await page.$$(enrollTableRowId);

    const openClasses = [];
    const closedClasses = [];

    for (const row of tableRows) {
        const select = await row.$(enrollCheckbox);
        const selectable = select !== null;
        if (selectable) {
            const open = await row.$(enrollOpenImage);
            const full = await row.$(enrollClosedImage);

            if (open !== null || full !== null) {
                const classSpan = await row.$(enrollCourseTitle);
                const classHtml =
                    await page.evaluate((span) => span.innerHTML, classSpan);
                const classText = cleanStr(classHtml);
                const sectionSpan = await row.$(enrollSectionTitle);
                const sectionHtml =
                    await page.evaluate((span) => span.innerHTML, sectionSpan);
                const sectionText = cleanStr(sectionHtml);

                const course = {
                    className: classText,
                    sectionName: sectionText,
                    name: `${classText} ${sectionText}`,
                    selectBox: select,
                };
                (open !== null ? openClasses : closedClasses).push(course);
            }
        }
    }
    return [openClasses, closedClasses];
}

async function getTermUrls(page) {
    const termUrls = [];
    const {
        enrollUrl,
        termTableRowId,
        termContinueButton,
        termRowRadioButton,
    } = config;
    await page.goto(enrollUrl);
    const termCount = (await page.$$(termTableRowId)).length;
    if (termCount === 0) {
        return [enrollUrl];
    }
    for (let rowIndex = 0; rowIndex < termCount; ++rowIndex) {
        await page.goto(enrollUrl);
        const continueButton = await page.$(termContinueButton);
        const row = (await page.$$(termTableRowId))[rowIndex];
        const termSelection = await row.$(termRowRadioButton);
        if (continueButton === null || termSelection === null) {
            continue;
        }
        await termSelection.click();
        await continueButton.click();
        await page.waitForNavigation();
        termUrls.push(await page.url());
    }
    return termUrls;
}

async function tryEnroll(page, enrollUrl, previousAvailability) {
    const [openClasses, closedClasses] = await checkEnroll(page, enrollUrl);
    const availability = `
        <p>
            open classes: ${openClasses.map((c) => c.name).join(', ')}
            <br/>
            closed classes: ${closedClasses.map((c) => c.name).join(', ')}
        </p>
        ${enrollUrl}`;
    if (previousAvailability !== availability && 0 < openClasses.length) {
        console.log(availability);
        previousAvailability = availability;
        for (const openClass of openClasses) {
            await openClass.selectBox.click();
            console.log(`Enrolling in ${openClass.name}`);
        }
        // await page.screenshot({path: 'selected.png', fullPage: true});
        await (await page.$(config.enrollSubmitButton)).click();
        // await page.screenshot({path: 'enrolling.png', fullPage: true});
        await page.waitForSelector(config.enrollSubmitConfirmButton);
        await (await page.$(config.enrollSubmitConfirmButton)).click();
        // await page.screenshot({path: 'done.png', fullPage: true});
        for (const openClass of openClasses) {
            console.log(`successfully enrolled in ${openClass.name}`);
        }
        sendEmailNotification(availability);
    } else {
        process.stdout.write('.');
    }
    return previousAvailability;
}

(async () => {
    console.log('launching browser');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    let urls = [];
    try {
        await login(page, config, credentials);
        console.log('retrieving enroll urls');
        urls = await getTermUrls(page);
        console.log(`retrieved ${urls.length} enroll urls`);
    } catch (e) {
        console.log('\n');
        console.log(new Date());
        console.log(e);
        // await page.screenshot({path: 'screenshot.png', fullPage: true});
        // console.log('error! saved screenshot');
        await sendEmailNotification(e.toString());
    } finally {
        browser.close();
    }

    for (const url of urls) {
        (async (enrollUrl) => {
            console.log('running enroller');
            const browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            const page = await browser.newPage();
            await login(page, config, credentials);
            let availability = '';
            while (true) { // eslint-disable-line no-constant-condition
                try {
                    availability =
                        await tryEnroll(page, enrollUrl, availability);
                    await sleep(rate);
                } catch (e) {
                    console.log('\n');
                    console.log(new Date());
                    console.log(e);
                    if (!e.message.toLowerCase().includes('timeout') &&
                        !e.message.includes('ERR_CONNECTION_RESET')) {
                        // await page.screenshot({
                        //     path: 'screenshot.png',
                        //     fullPage: true,
                        // });
                        // console.log('error! saved screenshot');
                        await sendEmailNotification(e.toString());
                    }
                    await sleep(30);
                }
            }
            browser.close();
        })(url);
    }
})();
