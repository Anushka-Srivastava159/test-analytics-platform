import {test, expect} from '../fixtures/auth';
import{ InventoryPage} from '../pages/InventoryPage';
import { CartPage } from '../pages/CartPage';

test.describe('Cart', () => {
    test('all items added from inventory appear in cart', async ({ page, loggedInPage }) => {
        const inventoryPage = new InventoryPage(page);
        const cartPage = new CartPage(page);

        const expected = await inventoryPage.getItemNames();
        expect(expected.length).toBeGreaterThan(0);

        for(const name of expected){
            await inventoryPage.addItemToCart(name);
        }

        await expect(inventoryPage.cartBadge).toHaveText(String(expected.length));

        await inventoryPage.gotoCart();

        for(const name of expected){
            await expect(cartPage.cartItems.filter({ hasText: name })).toHaveCount(1);
        }
        await expect(cartPage.cartItems).toHaveCount(expected.length);
    });

    test('removing an item empties cart', async({ page, loggedInPage }) => {
        const inventoryPage = new InventoryPage(page);
        const cartPage = new CartPage(page);

        await inventoryPage.addItemToCart('Sauce Labs Backpack');
        await inventoryPage.gotoCart();
        await expect(cartPage.cartItems).toHaveCount(1);

        await cartPage.removeItem('Sauce Labs Backpack');
        await expect(cartPage.cartItems).toHaveCount(0);
    });

    test('continue shopping button returns to inventory', async({ page, loggedInPage }) => {
        const inventoryPage = new InventoryPage(page);
        const cartPage = new CartPage(page);

        await inventoryPage.gotoCart();
        await cartPage.continueShopping();
        await expect(page).toHaveURL('/inventory.html');
    });



});