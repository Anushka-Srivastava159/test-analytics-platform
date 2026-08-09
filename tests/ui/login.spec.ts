import{test,expect} from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const loginCases = [
    {case: 'standard_user', username: 'standard_user', password: 'secret_sauce', outcome:'success'},
    {case: 'problem_user', username: 'problem_user', password: 'secret_sauce', outcome:'success'},
    {case: 'performance_glitch_user', username: 'performance_glitch_user', password: 'secret_sauce', outcome:'success'},
    {case: 'visual_user', username: 'visual_user', password: 'secret_sauce', outcome:'success'},
    {case: 'locked_out_user', username: 'locked_out_user', password: 'secret_sauce', outcome:'error', 
        errorMessage: 'Epic sadface: Sorry, this user has been locked out.'},
    {case: 'no username', username: '', password: 'secret_sauce', outcome:'error',
        errorMessage: 'Epic sadface: Username is required'},
    {case: 'no password', username: 'standard_user', password: '', outcome:'error',
        errorMessage: 'Epic sadface: Password is required'},
];

test.describe('Login Page', () => {
    for (const {case: label, username, password, outcome, errorMessage} of loginCases) {
        test(`login as ${label} ${outcome=== 'success' ? 'success' : 'shows an error'}`,
async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();
        await loginPage.login(username, password);

        if (outcome === 'success') {
            await expect(page).toHaveURL('/inventory.html');
        } else {
            await expect(loginPage.errorMessage).toHaveText(errorMessage!);
            await expect(page).toHaveURL('/');
        }
    });
    }
});
