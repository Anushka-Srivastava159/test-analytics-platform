import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

export const test = base.extend<{ loggedInPage: void }>({
    loggedInPage: [async ({ page }, use) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.login('standard_user', 'secret_sauce');
        await use();
    }, {auto: false}],
});

export { expect } from '@playwright/test';
