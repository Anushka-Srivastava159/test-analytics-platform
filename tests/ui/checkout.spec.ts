import{test, expect} from '../fixtures/auth';
import { InventoryPage } from '../pages/InventoryPage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';

test.describe('Checkout', () => {
    test('checkout to complete checkout', async ({ page, loggedInPage }) => {
        
        const checkoutPage = new CheckoutPage(page);
        const inventoryPage = new InventoryPage(page);
        const cartPage = new CartPage(page);

        await test.step('add item to cart and go to checkout', async () => {
        await inventoryPage.addItemToCart('Sauce Labs Backpack');
        await inventoryPage.gotoCart();
        await cartPage.checkout();
        await expect(page).toHaveURL('/checkout-step-one.html');
        await expect(checkoutPage.firstNameInput).toBeVisible();
        await expect(checkoutPage.lastNameInput).toBeVisible();
        await expect(checkoutPage.postalCodeInput).toBeVisible();
    });

        await test.step('fill in details and continue', async () => {
        await checkoutPage.fillDetails('xyz', 'abc', '1hd2345');
        await checkoutPage.continue();
        await expect(page).toHaveURL('/checkout-step-two.html');
        await expect(checkoutPage.summaryTotal).toBeVisible();
        await checkoutPage.finish();
        await expect(page).toHaveURL('/checkout-complete.html');
    });
        await test.step('checkout complete', async () => {
        await expect(checkoutPage.completeHeader).toBeVisible();
    });
});

const requiredFieldCases = [
    { firstName: '', lastName: 'abc', postalCode: '12345', missingField: 'First Name' },
    { firstName: 'xyz', lastName: '', postalCode: '12345', missingField: 'Last Name' },
    { firstName: 'xyz', lastName: 'abc', postalCode: '', missingField: 'Postal Code' },
];

for (const { firstName, lastName, postalCode, missingField } of requiredFieldCases) {
    test(`missing ${missingField} shows error message`, async ({ page, loggedInPage }) => {
        const checkoutPage = new CheckoutPage(page);
        const inventoryPage = new InventoryPage(page);
        const cartPage = new CartPage(page);

        await inventoryPage.addItemToCart('Sauce Labs Backpack');
        await inventoryPage.gotoCart();
        await cartPage.checkoutButton.click();
        await expect(page).toHaveURL('/checkout-step-one.html');

        await checkoutPage.fillDetails(firstName, lastName, postalCode);
        await checkoutPage.continueButton.click();

        await expect(checkoutPage.errorMessage).toHaveText(`Error: ${missingField} is required`);
        await expect(page).toHaveURL('/checkout-step-one.html');
    });
}

});
