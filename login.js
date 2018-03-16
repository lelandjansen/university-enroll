
async function login(page, config, credentials) {
    console.log('starting login');
    const {
        signin_url,
        signin_username_input,
        signin_password_input,
        signin_submit_button,
        signin_done_selector,
    } = config;
    await page.goto(signin_url, { waitUntil: 'networkidle0' });
    await page.waitForSelector(signin_username_input);
    console.log('reached login page');
    await page.type(signin_username_input, credentials.username);
    await page.type(signin_password_input, credentials.password);
    console.log('typed credentials in form');
    await page.click(signin_submit_button);
    await page.waitForSelector(signin_done_selector);
    console.log('logged in');
}

module.exports = {
    login,
};
