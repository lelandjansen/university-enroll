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
        console.log('could not send email notification', e);
    }
}

function cleanStr(str) {
    // Remove <br> and non-space whitespaces from the input string
    return str.replace(/<br>|[^\S ]/g, '');
}

async function checkEnroll(page) {
    const {
        enrollUrl,
        enrollTableRowId,
        enrollCheckbox,
        enrollOpenImage,
        enrollClosedImage,
        enrollCourseTitle,
        enrollSectionTitle,
    } = config;

    await page.goto(enrollUrl);

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

(async () => {
    console.log('launching browser');
    const browser = await puppeteer.launch();
    console.log('new page');
    const page = await browser.newPage();
    const {enrollUrl} = config;

    try {
        await login(page, config, credentials);
        let previousAvailability = '';

        while (true) { // eslint-disable-line no-constant-condition
            const [openClasses, closedClasses] = await checkEnroll(page);
            const availability = `
                <p>
                    open classes: ${openClasses.map((c) => c.name).join(', ')}
                    <br/>
                    closed classes: ${
                        closedClasses.map((c) => c.name).join(', ')}
                </p>
                ${enrollUrl}`;

            if (previousAvailability !== availability) {
                console.log(availability);
                previousAvailability = availability;
                await sendEmailNotification(availability);
                for (let openClass of openClasses) {
                    await openClass.selectBox.click();
                    await page.screenshot({
                      path: 'selected.png',
                      fullPage: true,
                    });
                    console.log(`Enrolling in ${openClass.name}`);
                    const enrollHandle =
                        await page.$(config.enrollSubmitButton);
                    await enrollHandle.click();
                    await page.screenshot({
                      path: 'enrolling.png',
                      fullPage: true,
                    });
                    await new Promise((resolve) => setTimeout(resolve, 6000));
                    const finishHandle =
                        await page.$(config.enrollSubmitConfirmButton);
                    await finishHandle.click();
                    await new Promise((resolve) => setTimeout(resolve, 6000));
                    await page.screenshot({path: 'done.png', fullPage: true});
                }
            } else {
                process.stdout.write('.');
            }
            await new Promise((resolve) => setTimeout(resolve, rate));
        }
    } catch (e) {
        console.log('error! saved screenshot');
        console.log(e);
        await page.screenshot({path: 'screenshot.png', fullPage: true});
    } finally {
        browser.close();
    }
})();
