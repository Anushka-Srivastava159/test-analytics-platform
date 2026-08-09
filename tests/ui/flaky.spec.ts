import{test,expect} from '../fixtures/auth'
import { CartPage } from '../pages/CartPage'
import { CheckoutPage } from '../pages/CheckoutPage'
import { InventoryPage } from '../pages/InventoryPage'
import { LoginPage } from '../pages/LoginPage'

test.describe('Flaky (intentional)', ()=>{
    //Flaky test1
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

        expect(Math.random()).toBeGreaterThan(0.2);
    });

    test('inventory renders within a tight budget', async({page, loggedInPage})=>{
        const inventory=new InventoryPage(page);

        await expect(inventory.itemNames.first()).toBeVisible({timeout:150});
        expect(await inventory.getItemCount()).toBe(6);
    });

    test('performance_glitch_user reaches inventory quickly', async ({ page }) => {
        test.setTimeout(6000)
        const loginPage = new LoginPage(page);
        const inventoryPage = new InventoryPage(page);

        await loginPage.goto();
        await loginPage.login('performance_glitch_user','secret_sauce');

        // INTENTIONAL: this account is throttled server-side, so it sits right
        // at the edge of this timeout. Also feeds the duration-trend chart.
        await expect(page).toHaveURL(/inventory\.html/);
        await expect(inventoryPage.itemNames).toHaveCount(6);
    });
})