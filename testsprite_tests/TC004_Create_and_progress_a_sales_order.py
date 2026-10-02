import asyncio
import re
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

        # Demo autofill and login
        await page.get_by_role('button', name='Acme Owner admin@acme.com', exact=True).click(timeout=10000)
        await page.locator('[id="submit-login-btn"]').click(timeout=10000)
        await expect(page).to_have_url(re.compile(r"/acme-corp"), timeout=15000)

        # Navigate to Orders
        await page.goto("http://localhost:3000/acme-corp/orders")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass

        # Open Create Order Modal
        await page.locator('[id="create-order-btn"]').click(timeout=10000)

        # Select first valid customer
        customer_select = page.locator("form select").first
        await customer_select.wait_for(state="visible", timeout=10000)
        await customer_select.select_option(index=1)

        # Submit create order
        await page.get_by_role('button', name='Create Draft Order').click(timeout=10000)

        # Open newly created order details from the first row
        first_row = page.locator("table tbody tr").first
        await expect(first_row).to_be_visible(timeout=15000)
        await first_row.locator("a[title='View Full Order Details']").click(timeout=10000)

        # Confirm order (DRAFT -> CONFIRMED)
        confirm_btn = page.locator('[id="confirm-order-btn"]')
        await expect(confirm_btn).to_be_visible(timeout=15000)
        await confirm_btn.click(timeout=10000)

        # Complete order (CONFIRMED -> COMPLETED)
        complete_btn = page.locator('[id="complete-order-btn"]')
        await expect(complete_btn).to_be_visible(timeout=15000)
        await complete_btn.click(timeout=10000)

        # Verify status is COMPLETED
        await expect(page.locator("text=COMPLETED").first).to_be_visible(timeout=15000)

        # Verify line items table has at least 1 item
        await expect(page.locator("table tbody tr").first).to_be_visible(timeout=15000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())