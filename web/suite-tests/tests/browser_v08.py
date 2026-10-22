from playwright.sync_api import sync_playwright
from pathlib import Path
import os, mimetypes
from urllib.parse import urlparse,unquote
ROOT='/mnt/data/GLB_AI_Suite_v0.8';os.chdir(ROOT)
mock=Path(ROOT+'/tests/mock_v08.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.route('**/cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,body=mock,content_type='text/javascript'))
    def serve(route):
        pathname=unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
        file=(Path(ROOT)/pathname).resolve()
        if not str(file).startswith(ROOT) or not file.is_file():
            route.fulfill(status=404,body='Not Found');return
        content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
        route.fulfill(status=200,body=file.read_bytes(),content_type=content_type)
    page.add_init_script(mock)
    page.goto('file:///mnt/data/GLB_AI_Suite_v0.8/index.html',wait_until='domcontentloaded',timeout=25000)
    page.wait_for_timeout(900)
    print('TITLE:',page.title(),'NAV:',page.locator('.glb08-nav-link').count())
    print('CLOUD:',page.locator('#cloud-sync-status').inner_text())
    page.locator('[data-view="menuimport"]').first.click()
    print('IMPORT VIEW:',page.locator('.v08-import-drop').count())
    page.locator('#v08-menu-text').fill('BURGER\nClassic Burger ........ 17,90 €\nVeggie Burger 16,50 €\nKAFFEE\nEspresso 3,40 €')
    page.locator('[data-v08="parse-text"]').click()
    print('REVIEW:',page.locator('.v08-review-item').count())
    page.locator('[data-v08="commit-menu"]').click()
    page.wait_for_timeout(1700)
    print('SAVE:',page.evaluate('window.__fake.saveCount'),'ITEMS:',page.evaluate('window.__fake.snapshots["org-1"].data.items.length'))
    page.screenshot(path=ROOT+'/V08_Desktop.png',full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-view="myday"]').first.click()
    page.wait_for_timeout(250)
    print('MOBILE BAR:',page.locator('#glb08-bottomnav').is_visible(),'BODYWIDTH',page.evaluate('document.body.scrollWidth'),'WIDTH',page.evaluate('window.innerWidth'))
    page.screenshot(path=ROOT+'/V08_Mobile.png',full_page=True)
    print('JS ERRORS:',errors[:10])
    browser.close()

