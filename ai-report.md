1) Quick summary
- 1 test failed (Part 1). Assertion on the product page H1 expected “Nikon Z30” but landed on a different product (“Nikon NIKKOR Z 400mm f/2.8…”).
- Root cause is likely selecting/clicking an unstable search/listing result (e.g., first item) rather than the specific product by name. Not a timing issue; the wrong page loaded consistently.

2) Failing test details with probable cause and fixes
- Part 1 (verkkokauppa-tests.spec.js)
  - Probable cause:
    - The step that navigates to the product uses an imprecise locator (e.g., nth/first result or generic CSS), and listings order changed. You ended up on a lens product page instead of the Z30 camera page.
  - Actionable Playwright fixes:
    - Click the product by accessible name, not position:
      - await page.getByRole('link', { name: /nikon z30/i }).click();
      - Or scope to a product card/container and filter by text:
        - const z30Card = page.locator('[data-testid="product-card"]', { hasText: /nikon z30/i }).first();
        - await z30Card.getByRole('link').click();
    - Add URL and heading assertions after navigation to ensure you reached the intended PDP:
      - await expect(page).toHaveURL(/nikon-?z30/i);
      - await expect(page.getByRole('heading', { level: 1, name: /nikon z30/i })).toBeVisible();
    - If multiple Z30 variants exist, disambiguate:
      - page.locator('[data-testid="product-card"]', { has: page.getByRole('heading', { name: /nikon z30/i }) })
      - Or filter by additional text (e.g., “kit”, “runko”) as needed:
        - page.locator('[data-testid="product-card"]').filter({ hasText: /nikon z30(.*)(kit|runko)?/i }).first()
    - Avoid relying on CSS classes or nth() from a grid; those are brittle when sorting/promo blocks change.

3) Better locator strategy
- Prefer roles + accessible names:
  - For selecting the PDP heading in the assertion: page.getByRole('heading', { level: 1, name: /nikon z30/i })
  - For selecting the product from a list: container.getByRole('link', { name: /nikon z30/i })
- Scope locators to stable containers to avoid strict-mode conflicts:
  - const results = page.getByTestId('product-grid'); await results.getByRole('link', { name: /nikon z30/i }).click();
- If available, use test IDs for product cards/links:
  - page.getByTestId('product-card', { hasText: /nikon z30/i }).getByRole('link').click()

4) Stable waits/timeouts
- Wait for the correct page state, not arbitrary time:
  - After clicking the product:
    - await expect(page).toHaveURL(/nikon-?z30/i, { timeout: 15000 });
    - await expect(page.getByRole('heading', { level: 1, name: /nikon z30/i })).toBeVisible();
- Before clicking in results, wait for the results to be ready:
  - await expect(page.getByTestId('product-grid')).toBeVisible();
  - Optionally wait for spinners to disappear if present:
    - await expect(page.getByRole('progressbar')).toBeHidden(); (adjust to your app)
- Keep the assertion targeted (toHaveText/toContainText on the H1 with name filter) so failures clearly indicate a wrong navigation instead of generic heading mismatch.