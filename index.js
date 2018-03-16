const fs = require('fs');
const process = require('process');
const puppeteer = require('puppeteer');
const mailgunjs = require('mailgun-js');

const { login } = require('./login');

const credentials = JSON.parse(fs.readFileSync("credentials.json"));
const config = JSON.parse(fs.readFileSync("config.json"))[credentials.university];

const mailgun = mailgunjs({apiKey: credentials.mailgun_api_key, domain: credentials.mailgun_domain});
const rate = 15*1000;


async function send_email_notification(msg) {
    const data = {
        from: 'Watchlist Notifier <postmaster@'+credentials.mailgun_domain+'>',
        to: credentials.notify_email,
        subject: config.notification_subject,
        html: msg
    };

    try {
        const body = await mailgun.messages().send(data);
        console.log("sent email notification");
        console.log(body);
    } catch(e) {
        console.log("could not send email notification", e);
    }
}

function clean_str(str) {
    // Remove <br> and non-space whitespaces from the input string
    return str.replace(/\<br\>|[^\S ]/g, '');
}

async function check_enroll(page) {
    const {
        enroll_url,
        enroll_table_row_id,
        enroll_checkbox,
        enroll_open_img,
        enroll_close_img,
        enroll_course_title,
        enroll_section_title
    } = config;

    await page.goto(enroll_url);

    const table_rows = await page.$$(enroll_table_row_id);

    const open_classes = [];
    const closed_classes = [];

    for(const row of table_rows) {
        const select = await row.$(enroll_checkbox);
        const selectable = select !== null;
        if (selectable) {
            const open = await row.$(enroll_open_img);
            const full = await row.$(enroll_close_img);

            if (open !== null || full !== null) {
                const class_span = await row.$(enroll_course_title);
                const class_html = await page.evaluate(span => span.innerHTML, class_span);
                const class_text = clean_str(class_html);
                const section_span = await row.$(enroll_section_title);
                const section_html = await page.evaluate(span => span.innerHTML, section_span);
                const section_text = clean_str(section_html);

                const _class = {
                    class_name: class_text,
                    section_name: section_text,
                    name: `${class_text} ${section_text}`,
                    select_box: select
                };

                (open !== null ? open_classes : closed_classes).push(_class);
            }
        }
    }

    return [open_classes, closed_classes];
}

(async() => {
    console.log('launching browser');
    const browser = await puppeteer.launch();
    console.log('new page');
    const page = await browser.newPage();

    const { enroll_url } = config;

    try {
        await login(page, config, credentials);
        let prev_availability = "";

        while(true) {
            const [open_classes, closed_classes] = await check_enroll(page);

            const availability = `
                <p>
                    open classes: ${open_classes.map(c => c.name).join(", ")}<br/>
                    closed classes: ${closed_classes.map(c => c.name).join(", ")}
                </p>
                ${enroll_url}`;

            if(prev_availability !== availability) {
                console.log(availability);

                prev_availability = availability;
                await send_email_notification(availability);

                for(open_class of open_classes) {
                    await open_class.select_box.click();
                    await page.screenshot({path: 'selected.png', fullPage: true});

                    console.log(`Enrolling in ${open_class.name}`);
                    const enroll_handle = await page.$(config.enroll_submit_button);
                    await enroll_handle.click();

                    await page.screenshot({path: 'enrolling.png', fullPage: true});

                    await new Promise(resolve => setTimeout(resolve, 6000));

                    const finish_handle = await page.$(config.enroll_submit_confirm_button);
                    await finish_handle.click();

                    await new Promise(resolve => setTimeout(resolve, 6000));
                    await page.screenshot({path: 'done.png', fullPage: true});
                }
            } else {
                process.stdout.write('.');
            }

            await new Promise(resolve => setTimeout(resolve, rate));
        }

        browser.close();
    } catch(e) {
        console.log('error! saved screenshot');
        console.log(e);
        await page.screenshot({path: 'screenshot.png', fullPage: true});
    }

})();
