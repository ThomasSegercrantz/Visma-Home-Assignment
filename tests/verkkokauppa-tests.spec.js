// @ts-check
import { test, expect } from '@playwright/test';

// Test file written by Thomas Segercrantz

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  
  // Click the "Vain välttämättömät" cookie button.
  await page.getByRole('button', { name: 'Vain välttämättömät' }).click();

});

// This is the test for Part 1 of the task
test('Part 1', async ({ page }) => {

  // Click and fill in the search field.
  const searchField = page.getByRole('combobox', { name: 'Hae kaupasta' });

  await searchField.click();
  await searchField.fill('Nikon'); 
  await searchField.press('Enter');

  // Sort the products from highest price to lowest price
  const sortSelector = page.getByRole('combobox', { name: 'Tuotteiden järjestys' });
  await sortSelector.selectOption({ label: 'Kalleimmat' });

  // After sorting, we dynamically click on the second product in the list, no matter the title
  const products = page.locator('article[data-product-id]');
  await products.nth(1).getByRole('link').click();

  // We assert for "Nikon Z30" in the product title
  const productTitle = page.getByRole('heading', { level: 1 });
  await expect(productTitle).toContainText('Nikon Z30');

});

// This is a test to check the functionality of adding a product to the cart and going to checkout
test('Part 2.1', async ({ page }) => {

  // Start the test by going to the cart and asserting that it is empty
  await page.getByRole('button', { name: 'Tarkastele ostoskoria' }).click();
  await expect(page.getByText('Ostoskori on tyhjä')).toBeVisible();

  // We search for a broad, stable term, that most likely will always yield a
  // a result of a product in stock, such as searching for a Keyboard
  const searchField = page.getByRole('combobox', { name: 'Hae kaupasta' });
  await searchField.fill('Näppäimistö');
  await searchField.press('Enter');

  // Product cards in the search results
  const cards = page.locator('article[data-product-id]');

  // Pick the first card that has a "Lisää ostoskoriin" button
  const addToCartButton = cards.locator('button', { hasText: 'Lisää ostoskoriin' }).first();
  await expect(addToCartButton).toBeVisible();
  await addToCartButton.click();

  // Click the shopping cart button to go to the cart page and assert that we have
  // a product added there
  await page.getByRole('button', { name: 'Tarkastele ostoskoria' }).click();
  // Assert that there is a product in the shopping cart
  await expect(page.locator('article[data-product-id]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Siirry kassalle' }).click();

  // We assert for "Sisäänkirjautuminen", it is the final page we should reach for this test
  const pageTitle = page.getByRole('heading', { level: 1 });
  await expect(pageTitle).toContainText('Sisäänkirjautuminen');

});

// This is a test to check the filtering functions of the page, we do so by selecting
// a filter and checking if filter is applied in URL, and that the showing products
// is less after filtering
test('Part 2.2', async ({ page }) => {

  // We search for a product, can be any but should be generic enough to yield many results
  const searchField = page.getByRole('combobox', { name: 'Hae kaupasta' });
  await searchField.fill('TV');
  await searchField.press('Enter');

  // Capture the number of results before applying the filter
  const beforeText = await page.getByText('tulosta haulla').first().textContent();
  const beforeCount = Number((beforeText || '').split(' ')[0]);

  // Apply the filter
  await page.getByRole('button', { name: 'Saatavuus' }).click();
  const hetiCheckbox = page.getByRole('checkbox', { name: 'Heti lähetettävissä' });
  await hetiCheckbox.scrollIntoViewIfNeeded();
  await hetiCheckbox.check({ force: true });
  await page.getByRole('button', { name: 'Suodata' }).click();

  // Capture the number of results after applying the filter
  const afterText = await page.getByText('tulosta haulla').first().textContent();
  const afterCount = Number((afterText || '').split(' ')[0]);

  // Assert filter has been applied
  expect(page.url()).toContain('filter%5BAvailableImmediatelyAllChannels%5D=');
  expect(afterCount).toBeLessThan(beforeCount);
  await expect(page.getByRole('button', { name: 'Tyhjennä valinnat' })).toBeVisible();

});

// This is a test to check that normal functions of the page still work when trying
// to access a product. We test navigating to it via the built in navigation menus
// instead of searching, and assert that much of the necessary information is shown
test('Part 2.3', async ({ page }) => {
  
  // In this test we navigate to a specific list of products using the built in navigation tools
  // Hover over the top-level menu
  await page.getByRole('link', { name: 'Pelaaminen' }).hover();
  // Click on the the submenu item
  await page.getByRole('link', { name: 'Pelikonsolit' }).click();

  // Click on the first product from the results
  const products = page.locator('article[data-product-id]');
  await products.first().getByRole('link').first().click();

  // Check for Product title (H1)
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toBeVisible();

  // Check for a price on the page
  const price = page.locator('main data[data-price="current"]').first();
  await expect(price).toBeVisible();

  // Check Add to cart UI exists
  const addToCart = page.getByRole('button', { name: 'Lisää ostoskoriin' }).first();
  await expect(addToCart).toBeVisible();
 
  // Check that we have the "Lisätiedot" details part of the page
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const details = page.getByRole('heading', { name: 'Lisätiedot' });
  await expect(details).toBeVisible();

  // Assert that basic info list exists under it
  await expect(page.getByText('Perustiedot')).toBeVisible();

});