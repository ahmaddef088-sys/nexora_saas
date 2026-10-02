import asyncio
import re
import time
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        pw = await async_api.async_playwright().start()
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        context = await browser.new_context()
        context.set_default_timeout(15000)
        page = await context.new_page()

        await page.goto("http://localhost:3000/login")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Login
        await page.get_by_role('button', name='Acme Owner admin@acme.com', exact=True).click(timeout=10000)
        await page.locator('[id="submit-login-btn"]').click(timeout=10000)
        await expect(page).to_have_url(re.compile(r"/acme-corp"), timeout=15000)

        # Open Products
        await page.goto("http://localhost:3000/acme-corp/products")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Open Add Product Modal
        await page.locator('[id="add-product-btn"]').click(timeout=10000)

        unique_id = int(time.time())
        prod_name = f"Test Product {unique_id}"
        sku_code = f"SKU-{unique_id}"

        # Fill Product Details
        name_input = page.get_by_placeholder('e.g. Ergonomic Office Chair', exact=True)
        await name_input.wait_for(state="visible", timeout=10000)
        await name_input.fill(prod_name)

        sku_input = page.get_by_placeholder('CHR-ERG-01', exact=True)
        await sku_input.fill(sku_code)

        price_input = page.get_by_placeholder('299.99', exact=True)
        await price_input.fill("49.99")

        stock_input = page.get_by_placeholder('10', exact=True)
        await stock_input.fill("25")

        # Submit
        await page.get_by_role('button', name='Create Product', exact=True).click(timeout=10000)

        # Verify product appears in the table with name, sku, and stock
        row = page.locator("table tbody tr", has_text=sku_code)
        await expect(row).to_be_visible(timeout=15000)
        await expect(row).to_contain_text(prod_name, timeout=15000)
        await expect(row).to_contain_text("25", timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())