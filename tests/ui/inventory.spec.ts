import {test, expect} from '../fixtures/auth';
import {InventoryPage} from '../pages/InventoryPage';

test.describe('Inventory',()=>{
    /*const productImages = [
        {name:'Sauce Labs Backpack', image:'sauce-backpack'},
        {name:'Sauce Labs Bike Light', image:'bike-light'},
        {name:'Sauce Labs Bolt T-Shirt', image:'bolt-shirt'},
        {name:'Sauce Labs Fleece Jacket', image:'sauce-pullover'},
        {name:'Sauce Labs Onesie', image:'red-onesie'},
        {name:'Test.allTheThings() T-Shirt (Red)', image:'red-tatt'},
    ];
    
    test('product images are displayed for each item', async ({page, loggedInPage}) => {
        const inventoryPage = new InventoryPage(page);

        for(const {name, image} of productImages){
            await expect(inventoryPage.imageForItem(name))
            .toHaveAttribute('src', new RegExp(image));
        }*/
       
    //more dynamic test to check that all products have distinct images
    
    test('all products display distinct images', async ({page, loggedInPage}) => {
        const inventoryPage = new InventoryPage(page);
        const srcs=await page.locator('[data-test="inventory-item"] img')
        .evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src')));
        
        expect(srcs.length).toBeGreaterThan(0);
        expect(new Set(srcs).size).toBe(srcs.length);
    });

    function sortTest<T>(
        value: string,
        label: string,
        read: (p: InventoryPage) => Promise<T[]>,
        compare: (a: T, b: T) => number,
    ){
        test(`sorting by ${label} returns sorted items`, async ({page, loggedInPage}) => {
            const inventoryPage = new InventoryPage(page);
            await inventoryPage.sortBy(value);

            const actual=await read(inventoryPage);
            expect(actual).toEqual([...actual].sort(compare));
        });
    }

    sortTest('az', 'Name (A to Z)', p=>p.getItemNames(), (a,b)=>a.localeCompare(b));
    sortTest('za', 'Name (Z to A)', p=>p.getItemNames(), (a,b)=>b.localeCompare(a));
    sortTest('lohi', 'Price (low to high)', p=>p.getPrices(), (a,b)=>a-b);
    sortTest('hilo', 'Price (high to low)', p=>p.getPrices(), (a,b)=>b-a);

    test('every product row has a name, image and button', async ({page, loggedInPage}) => {
        const inventoryPage = new InventoryPage(page);
        const count=await inventoryPage.getItemCount();

        expect(count).toBeGreaterThan(0);
        await expect(inventoryPage.itemPrices).toHaveCount(count);
        await expect(inventoryPage.addToCartButtons).toHaveCount(count);
        await expect(page.locator('[data-test="inventory-item"] img')).toHaveCount(count);
    });

    test('cart badge is updated when items are added to cart', async ({page, loggedInPage}) => {
        const inventoryPage = new InventoryPage(page);
        const count=await inventoryPage.getItemNames();

        await expect(inventoryPage.cartBadge).toHaveCount(0);
        for(const [i, name] of count.entries()){
            await inventoryPage.addItemToCart(name);
            await expect(inventoryPage.cartBadge).toHaveText(String(i+1));
        }
        await expect(inventoryPage.removeButtons).toHaveCount(count.length);
        });
});