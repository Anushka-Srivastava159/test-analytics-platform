import {Page, Locator} from '@playwright/test';

export class InventoryPage {
    readonly page: Page;
    readonly sortDropdown: Locator;
    readonly itemNames: Locator;
    readonly itemPrices: Locator;
    readonly cartBadge: Locator;
    readonly cartLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.sortDropdown = page.locator('[data-test="product-sort-container"]');
        this.itemNames = page.locator('[data-test="inventory-item-name"]');
        this.itemPrices = page.locator('[data-test="inventory-item-price"]');
        this.cartBadge = page.locator('[data-test="shopping-cart-badge"]');
        this.cartLink = page.locator('[data-test="shopping-cart-link"]');
    }

    async addItemToCart(itemName: string) {
        const item = this.page.locator('[data-test="inventory-item-name"]').filter({ hasText: itemName });
        await item.getByRole('button', { name: 'Add to cart' }).click();
    }

    async sortBy(value: string) {
        await this.sortDropdown.selectOption(value);
    }

    async getItemCount(): Promise<number> {
        return await this.itemNames.count();
    }
    
    async gotoCard(){
        await this.cartLink.click();
        await this.page.waitForURL('**/cart.html');
    }

    async getPrices(): Promise<number[]> {
        const texts=await this.itemPrices.allTextContents();
        return texts.map(text => parseFloat(text.replace('$', '')));
    }




}