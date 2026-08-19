import{test,expect} from '../fixtures/auth'
import { CartPage } from '../pages/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { InventoryPage } from '../pages/InventoryPage'
import { LoginPage } from '../pages/LoginPage'

/**
 * INTENTIONALLY FLAKY — do not "fix" these.
 * This suite exists to give the stability dashboard real flaky data.
 * Each test fails for a different reason so the failure modes stay
 * distinguishable downstream. See README, "Deliberate flakiness".
 */
test.describe('Flaky (intentional)', ()=>{
    test('checkout flow under intermittent load', async({page, loggedInPage})=>{
        const inventoryPage=new InventoryPage(page);
        const cartPage=new CartPage(page);
        const checkoutPage=new CheckoutPage(page);

        await inventoryPage.addItemToCart('Sauce Labs Backpack');
        await inventoryPage.gotoCart();
        await cartPage.checkout();
        await checkoutPage.fillDetails('Abc', 'xyz', '34nnrw3');
        await checkoutPage.continue();
        await checkoutPage.finish();

        await expect(checkoutPage.completeHeader).toHaveText('Thank you for your order!');

        // INTENTIONAL: ~20% failure rate, independent per attempt, so retries
        // usually recover it and the run reports "flaky" rather than "failed".
        expect(Math.random()).toBeGreaterThan(0.2);
    });

    test('inventory renders within a tight timeout', async({page, loggedInPage})=>{
        const inventory=new InventoryPage(page);

        // INTENTIONAL: 150ms is below the real render time on a slow network.
        // Passes when the network is fast, fails when it is not — a true race.
        await expect(inventory.itemNames.first()).toBeVisible({timeout:150});
        expect(await inventory.getItemCount()).toBe(6);
    });

    test('performance_glitch_user reaches inventory quickly', async ({ page }) => {
        test.setTimeout(6000)
        const loginPage = new LoginPage(page);
        const inventoryPage = new InventoryPage(page);

        // Steps, not bare calls: test.step durations land in results.json, so the
        // pipeline can see *where* the time goes rather than only how long the
        // test took. The whole-test duration alone can't tell login from assertion.
        await test.step('navigate to login', async () => {
            await loginPage.goto();
        });

        await test.step('login as performance_glitch_user', async () => {
            await loginPage.login('performance_glitch_user','secret_sauce');
        });

        // INTENTIONAL: this account is throttled server-side, so it sits right
        // at the edge of this timeout. Also feeds the duration-trend chart.
        await test.step('assert inventory reached', async () => {
            await expect(page).toHaveURL(/inventory\.html/);
            await expect(inventoryPage.itemNames).toHaveCount(6);
        });
    });
})