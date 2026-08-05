import{Page, Locator} from '@playwright/test';

export class CartPage {
readonly page: Page;
readonly cartItems: Locator;
readonly checkoutButton: Locator;
readonly removeButton: Locator;
readonly continueShoppingButton: Locator;
constructor(page: Page) {
    this.page = page;
    this.cartItems = page.locator('[data-test="inventory-item"]');
    this.checkoutButton = page.getByRole('button', { name: 'Checkout' });
    this.removeButton = page.getByRole('button', { name: 'Remove' });
    this.continueShoppingButton = page.getByRole('button', { name: 'Continue Shopping' });
}

async removeItem(itemName: string) {
    const item = this.cartItems.filter({ hasText: itemName });
    await item.getByRole('button', { name: 'Remove' }).click();
}

async checkout() {
    await this.checkoutButton.click();
    await this.page.waitForURL('/checkout-step-one.html');
}

async continueShopping() {
    await this.continueShoppingButton.click();
    await this.page.waitForURL('/inventory.html');
}

async getItemCount(): Promise<number> {
    return await this.cartItems.count();
}

async getItemNames(): Promise<string[]> {
    return this.page.locator('[data-test="inventory-item-name"]').allTextContents();
}

}