"""Optional End-to-end smoke test. Run the static server on localhost:8080 first.
Requires: pip install playwright ; playwright install chromium
Not executed in the ChatGPT environment: browser navigation is administratively blocked there.
"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1280,'height':900})
    errors=[]
    page.on('pageerror',lambda ex:errors.append(str(ex)))
    page.goto('http://localhost:8080',wait_until='domcontentloaded')
    assert page.get_by_text('Business Pulse').count()==1
    page.locator('.nav [data-page="sales"]').click()
    assert page.get_by_text('Neuen Import vorbereiten').count()==1
    page.locator('.nav [data-page="menu"]').click()
    assert page.get_by_text('Artikelperformance').count()==1
    page.locator('.nav [data-page="inventory"]').click()
    assert page.get_by_text('Bestandsübersicht').count()==1
    page.locator('.nav [data-page="tasks"]').click()
    assert page.get_by_text('Aufgabenliste').count()==1
    assert not errors,errors
    browser.close()
print('Smoke test passed')
