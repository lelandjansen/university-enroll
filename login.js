async function login(page, config, credentials) {
    console.log('starting login');
    const {
        signInUrl,
        signInUsernameInput,
        signInPasswordInput,
        signInSubmitButton,
        signInDoneSelector,
    } = config;
    await page.goto(signInUrl, {waitUntil: 'networkidle0'});
    await page.waitForSelector(signInUsernameInput);
    console.log('reached login page');
    await page.type(signInUsernameInput, credentials.username);
    await page.type(signInPasswordInput, credentials.password);
    console.log('typed credentials in form');
    await page.click(signInSubmitButton);
    await page.waitForSelector(signInDoneSelector);
    console.log('logged in');
}

module.exports = {
    login,
};
